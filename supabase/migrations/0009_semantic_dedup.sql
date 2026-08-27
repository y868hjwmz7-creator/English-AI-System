-- ============================================================================
-- English AI System — 意味の近さでも重複を弾く
--
-- 【なぜ必要か】
--   0008 で「一字一句同じ英文」は完全に防げるようになった。しかし
--   「I have work to do.」と「I have a job to do.」は別の文として通る。
--   ゲストから見れば同じ練習であり、これでは「前と同じ」を防げていない。
--   利用者から「意味の近さで判定できるようにしてほしい」と要望があった。
--
-- 【どうやるか】
--   英文を384個の数値の並び(埋め込みベクトル)に変換して置いておく。
--   意味が近い文どうしは、この並びも近くなる。新しく作った文を同じように
--   変換し、既にある文との近さを測って、近すぎるものを弾く。
--
--   変換は **Supabase の Edge Function の中で完結する**(gte-small)。
--   外部のサービスに送らず、新しい鍵も要らず、追加の費用もかからない。
--   英語専用のモデルなので、この用途にちょうど合う。
--
-- 【何が変わるか】
--   1. vector 拡張を有効にする
--   2. sentence_embeddings … 英文1つにつき1つの並びを持つ表。
--      同じ英文を何度も変換しないよう、そろえた形を鍵にする
--   3. similar_sentences() … 候補の並びを渡すと、近すぎる既存の文を返す
--   4. material_items.tag_id … 混合ドリル用。どの弱点の問題かを1問ごとに持つ
--
-- 【既存のデータの扱い】
--   何も消さない。表と列と関数を足すだけ。何度実行してもよい。
--   既にある英文の変換は、次に照合したときに少しずつ埋まる(下の説明)。
-- ============================================================================

-- ────────────────────────────────────────────────────────────────
-- 1. vector 拡張
--
--   Supabase では Database → Extensions からも入れられるが、
--   ここで入れておけば手順が1つ減る。すでに入っていれば何も起きない。
-- ────────────────────────────────────────────────────────────────
create extension if not exists vector;

-- ────────────────────────────────────────────────────────────────
-- 2. 英文の並び(埋め込み)
--
--   material_sentences とは分けてある。同じ英文が複数の教材に出ても、
--   変換は1回で済ませたいため。鍵は「そろえた形」(norm_en の結果)。
-- ────────────────────────────────────────────────────────────────
create table if not exists public.sentence_embeddings (
  text_norm  text primary key,
  embedding  vector(384) not null,
  created_at timestamptz not null default now()
);

comment on table public.sentence_embeddings is
  '英文を384個の数値に変換したもの。意味の近さを測るために使う(gte-small)';

-- 近いものを探すための索引。件数が少ないうちは総当たりでも足りるが、
-- 教材が増えたときに効いてくる。
create index if not exists sentence_embeddings_vec_idx
  on public.sentence_embeddings using hnsw (embedding vector_cosine_ops);

alter table public.sentence_embeddings enable row level security;

drop policy if exists "トレーナーは英文の並びを見る" on public.sentence_embeddings;
create policy "トレーナーは英文の並びを見る" on public.sentence_embeddings
  for select to authenticated using (public.is_trainer());

-- 書き込むのは Edge Function(管理者の鍵)だけ。画面からは触らせない。
revoke insert, update, delete on public.sentence_embeddings from authenticated;

-- ────────────────────────────────────────────────────────────────
-- 3. まだ変換していない英文を探す
--
--   0008 より前からある教材の英文には並びが無い。照合のたびに、
--   その範囲で足りていないものを少しずつ埋める。一度に全部やろうとすると
--   時間切れになるため、上限をつけて呼ぶ側が繰り返す。
-- ────────────────────────────────────────────────────────────────
create or replace function public.sentences_without_embedding(
  p_learner uuid,
  p_tags    text[],
  p_limit   int default 200
) returns setof text
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_trainer() then
    raise exception '教材を作れるのはトレーナーだけです';
  end if;

  if p_learner is not null and not public.teaches(p_learner) then
    raise exception '担当していないゲストは指定できません';
  end if;

  return query
  select distinct ms.text_norm
  from public.material_sentences ms
  where not exists (
    select 1 from public.sentence_embeddings se where se.text_norm = ms.text_norm
  )
  and (
    (p_learner is not null and exists (
      select 1 from public.assignments a
      where a.material_id = ms.material_id and a.learner_id = p_learner))
    or
    (p_tags is not null and array_length(p_tags, 1) is not null and exists (
      select 1 from public.material_tags mt
      where mt.material_id = ms.material_id and mt.tag_id = any(p_tags)))
  )
  limit greatest(p_limit, 0);
end;
$$;

-- ────────────────────────────────────────────────────────────────
-- 4. 意味が近すぎる文を探す
--
--   p_embeddings は「384個の数値の配列」の配列(JSON)。
--   候補ごとに、範囲の中で最も近い既存の文を1つ返す。
--   返るのは近さが p_threshold 以上のものだけ。
--
--   近さは 0〜1。1 に近いほど似ている。
--   ※ しきい値は実際の教材で調整する前提の初期値である。
--     同じ文法の40問は、そもそも構造が似ているため、下げすぎると
--     正しい問題まで弾いてしまう(仕様書 第5.16.2節)。
-- ────────────────────────────────────────────────────────────────
create or replace function public.similar_sentences(
  p_learner    uuid,
  p_tags       text[],
  p_embeddings jsonb,
  p_threshold  real default 0.92
) returns table (idx int, matched text, similarity real)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_trainer() then
    raise exception '教材を作れるのはトレーナーだけです';
  end if;

  if p_learner is not null and not public.teaches(p_learner) then
    raise exception '担当していないゲストは指定できません';
  end if;

  return query
  with cand as (
    select (t.i - 1)::int as idx,
           (
             select array_agg(x::real order by u.ord)
             from jsonb_array_elements_text(t.e) with ordinality as u(x, ord)
           )::real[]::vector(384) as v
    from jsonb_array_elements(coalesce(p_embeddings, '[]'::jsonb))
         with ordinality as t(e, i)
  ),
  scope as (
    select distinct se.text_norm, se.embedding
    from public.material_sentences ms
    join public.sentence_embeddings se on se.text_norm = ms.text_norm
    where (p_learner is not null and exists (
            select 1 from public.assignments a
            where a.material_id = ms.material_id and a.learner_id = p_learner))
       or (p_tags is not null and array_length(p_tags, 1) is not null and exists (
            select 1 from public.material_tags mt
            where mt.material_id = ms.material_id and mt.tag_id = any(p_tags)))
  )
  select c.idx, s.text_norm, s.sim
  from cand c
  cross join lateral (
    select scope.text_norm, (1 - (scope.embedding <=> c.v))::real as sim
    from scope
    order by scope.embedding <=> c.v
    limit 1
  ) s
  where s.sim >= p_threshold;
end;
$$;

comment on function public.similar_sentences(uuid, text[], jsonb, real) is
  '候補の英文のうち、意味が近すぎる既存の文があるものを返す';

grant execute on function public.sentences_without_embedding(uuid, text[], int) to authenticated;
grant execute on function public.similar_sentences(uuid, text[], jsonb, real) to authenticated;

-- ────────────────────────────────────────────────────────────────
-- 5. 混合ドリル — 1問ごとに、どの弱点の問題かを持つ
--
--   これまでは1教材=1弱点だった。2〜3の弱点を混ぜた40問も作れるように
--   する(仕様書 第5.16.1節を改訂)。意識が分散した状態でも、それぞれの
--   弱点に注意を保つ練習になるため。
--
--   混ぜたときに「この問題はどの弱点のものか」が分からないと、
--   間違えた原因をたどれない。1問ごとに持たせる。
--   1弱点だけの教材では null のままでよい(教材のタグで足りる)。
-- ────────────────────────────────────────────────────────────────
alter table public.material_items
  add column if not exists tag_id text references public.weakness_tags(id);

comment on column public.material_items.tag_id is
  '混合ドリルで、この問題がどの弱点のものか。単一の弱点の教材では null';

create index if not exists material_items_tag_idx
  on public.material_items (tag_id) where tag_id is not null;
