-- ============================================================================
-- 0018 単語帳を「覚えられる形」にする — 出会った文を控える
--
-- 【なぜ要るか】(2026-08 利用者の指定「単語帳のパワーアップ」)
--   語だけを並べても覚えられない。**人は文脈ごと覚える。**
--   "consideration" を単独で覚えるより、
--   「Thank you for your consideration.」で出会ったことを思い出せるほうが、
--   次に会ったときに出てくる。
--
--   いまは `material_id`(どの教材か)しか控えていない。教材を開き直さないと
--   文にたどりつけず、復習の場では実質たどりつけない。
--
-- 【何をするか】
--   ① `word_reviews` に `seen_in`(出会った文)を1列足す
--   ② `mark_word()` に文を渡せるようにする(5つめの引数)
--   ③ `review_words()` が `seen_in` も返すようにする
--
--   **表は増やさない。** 語1つにつき1文で足りる。
--
-- 【最初の1文を残す】
--   `material_id` と同じ考え方で、**あとから上書きしない。**
--   最初に出会った文が、その語の思い出の手がかりになる。
--   上書きすると、覚えかけた手がかりが毎回入れ替わってしまう。
--
-- 【何を消すか】
--   `mark_word()` と `review_words()` を作り直す(引数と返す列が変わるため、
--   一度落としてから作る)。**表のデータは何も消さない。**
--   **何度実行してもよい。**
-- ============================================================================

-- ────────────────────────────────────────────────────────────────
-- 1. 出会った文を控える列
-- ────────────────────────────────────────────────────────────────
alter table public.word_reviews
  add column if not exists seen_in text;

comment on column public.word_reviews.seen_in is
  'その語に最初に出会った英文。復習のときに文脈ごと思い出すために出す。'
  '最初の1文だけを残し、あとから上書きしない。';

-- ────────────────────────────────────────────────────────────────
-- 2. mark_word() に文を渡せるようにする
--
--   **古い形(4引数)は落とす。** 残すと、4つで呼んだときにどちらの
--   関数か決められず PostgREST が断る。
-- ────────────────────────────────────────────────────────────────
drop function if exists public.mark_word(text, text, text, uuid);

create or replace function public.mark_word(
  p_norm     text,
  p_status   text,
  p_kind     text default 'word',
  p_material uuid default null,
  p_sentence text default null
)
returns table (word_norm text, status text, box smallint, due_on date)
language plpgsql
volatile
set search_path = public
as $$
-- 返す列の名前(word_norm / status / box / due_on)は、表の列名と同じである。
-- **同じ名前があると plpgsql は「どちらか分からない」と止まる。**
-- 迷ったら列のほうを指すと決めておく
#variable_conflict use_column
declare
  v_norm     text;
  v_box      smallint;
  v_days     int;
  v_sentence text;
begin
  v_norm := public.norm_word(p_norm);
  if v_norm is null then
    raise exception '語が空です';
  end if;
  if p_status is null or p_status not in ('known', 'unknown') then
    raise exception '状態は known か unknown です';
  end if;

  -- 文が長すぎると復習の画面で読みにくい。**入口で切る。**
  -- 空白の連なりもここでそろえておく(画面によって改行の入り方が違うため)
  v_sentence := nullif(btrim(regexp_replace(coalesce(p_sentence, ''), '\s+', ' ', 'g')), '');
  if v_sentence is not null then
    v_sentence := left(v_sentence, 300);
  end if;

  select r.box into v_box
    from public.word_reviews r
   where r.learner_id = auth.uid() and r.word_norm = v_norm;
  v_box := coalesce(v_box, 0);

  if p_status = 'unknown' then
    -- 分からなかったものは、いちばん下の箱に戻して翌日また出す
    v_box := 0;
    v_days := 1;
  else
    v_box := least(v_box + 1, 6);
    v_days := case v_box
                when 1 then 1
                when 2 then 2
                when 3 then 4
                when 4 then 7
                when 5 then 14
                else 30
              end;
  end if;

  return query
  insert into public.word_reviews as w
    (learner_id, word_norm, kind, status, box, due_on, material_id, seen_in, updated_at)
  values
    (auth.uid(), v_norm, coalesce(p_kind, 'word'), p_status,
     v_box, current_date + v_days, p_material, v_sentence, now())
  on conflict (learner_id, word_norm) do update
    set status      = excluded.status,
        kind        = excluded.kind,
        box         = excluded.box,
        due_on      = excluded.due_on,
        -- どの教材で出会ったかは、**最初のものを残す**。
        -- 上書きすると「いつ出会ったか」の手がかりが消える
        material_id = coalesce(w.material_id, excluded.material_id),
        -- 出会った文も同じ。**最初の1文が思い出の手がかりになる**
        seen_in     = coalesce(w.seen_in, excluded.seen_in),
        updated_at  = now()
  returning w.word_norm, w.status, w.box, w.due_on;
end;
$$;

comment on function public.mark_word(text, text, text, uuid, text) is
  '語や句に「知っていた / 知らなかった」を付け、次に出す日を決める。'
  '出会った文も控える(最初の1文だけ)。間隔の決まりはこの関数だけが持つ。';

-- ────────────────────────────────────────────────────────────────
-- 3. 復習の材料に「出会った文」を足す(作り直し)
--
--   0015 の中身をそのまま写し、返す列に `seen_in` を1つ足しただけである。
--   **並び順も権限の確かめ方も変えていない。** 返す列が変わるので、
--   置き換えではなく一度落としてから作る。
-- ────────────────────────────────────────────────────────────────
drop function if exists public.review_words(uuid, text, int, boolean);

create or replace function public.review_words(
  p_learner  uuid,
  p_status   text    default 'unknown',
  p_limit    int     default 40,
  p_due_only boolean default false
)
returns table (
  word_norm  text,
  display    text,
  kind       text,
  pos        text,
  meaning_ja text,
  seen_in    text,
  status     text,
  box        smallint,
  due_on     date,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  -- 担当しているゲスト、本人、または owner だけ
  if not (
    p_learner = auth.uid()
    or public.teaches(p_learner)
    or public.is_owner()
  ) then
    raise exception '担当していないゲストの復習語は取得できません';
  end if;

  return query
    select r.word_norm,
           coalesce(g.display, r.word_norm),
           r.kind,
           coalesce(g.pos, ''),
           coalesce(g.meaning_ja, ''),
           r.seen_in,
           r.status,
           r.box,
           r.due_on,
           r.updated_at
    from public.word_reviews r
    left join lateral (
      select gg.display, gg.pos, gg.meaning_ja
      from public.word_glosses gg
      where gg.word_norm = r.word_norm
      -- 文脈の指定が無いものを先に。同じ語で何件あっても1件だけ使う
      order by (gg.context_key <> ''), gg.created_at
      limit 1
    ) g on true
    where r.learner_id = p_learner
      and (p_status is null or r.status = p_status)
      and (not p_due_only or r.due_on <= current_date)
    -- **出すべきものが先。** 同じ日なら、箱の低いもの(苦手なもの)から
    order by r.due_on, r.box, r.updated_at desc
    limit greatest(1, least(coalesce(p_limit, 40), 200));
end;
$$;

comment on function public.review_words(uuid, text, int, boolean) is
  'ゲストの復習語を意味付きで返す。p_due_only で「今日出すべきもの」に絞る。'
  '出会った文(seen_in)も返す。担当外は拒否する。';

-- ────────────────────────────────────────────────────────────────
-- 4. 権限。**作り直した関数には、もう一度付け直す**
-- ────────────────────────────────────────────────────────────────
grant execute on function public.mark_word(text, text, text, uuid, text) to authenticated;
grant execute on function public.review_words(uuid, text, int, boolean)  to authenticated;
