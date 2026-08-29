-- ============================================================================
-- 0015 語彙の復習 — 間隔をあけて出す / 句とイディオムも記録する
--
-- 【なぜ要るか】(2026-08 利用者の指定)
--   0011 で「知っていた / 知らなかった」を記録できるようにしたが、
--   2つ足りなかった。
--
--   ① **いつ再び出すかの仕組みが無い。**
--      一度「知っていた」にすると二度と出ず、「知らなかった」は
--      ずっと出続ける。忘れかけた頃に再会する形になっていない。
--
--   ② **句・イディオム・句動詞を記録できない。**
--      look forward to / put off のような、語を並べたものが要になる。
--
-- 【どう解くか】
--   ① 箱(Leitner)。段階(box)と、次に出す日(due_on)だけを持つ。
--
--        知らなかった → 箱を 0 に戻し、翌日にまた出す
--        知っていた   → 箱を1つ上げ、1 → 2 → 4 → 7 → 14 → 30 日後
--
--      **SM-2 のような細かい方式は採らない。** レッスンは週2回で、
--      宿題の回数が細かい間隔に追いつかない。6段で足りる。
--
--      **間隔の決まりは、この関数1つだけに置く**(`mark_word`)。
--      画面側で計算すると、端末の日付や時差で食い違う。
--
--   ② 表を増やさない。`word_reviews` の鍵は (人, そろえた形) である。
--      句は語を空白ひとつでつないだ形になるので、**そのまま入る**。
--      `norm_word()` は連続する記号を空白1つにするため、
--      "look forward to" はそのまま "look forward to" になる。
--      見分けるための `kind` を1列だけ足す。
--
-- 【何を消すか】
--   `review_words()` を作り直す(返す列が増えるため、置き換えではなく
--   一度落としてから作る)。表のデータは何も消さない。
--   **何度実行してもよい。**
-- ============================================================================

-- ────────────────────────────────────────────────────────────────
-- 1. word_reviews に3つ足す
--
--   既にある行には既定値が入る。box = 0 / due_on = 今日 なので、
--   これまで付けた語は**次の教材からすぐ復習に出る**。
-- ────────────────────────────────────────────────────────────────
alter table public.word_reviews
  add column if not exists kind   text     not null default 'word',
  add column if not exists box    smallint not null default 0,
  add column if not exists due_on date     not null default current_date;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'word_reviews_kind_check'
  ) then
    alter table public.word_reviews
      add constraint word_reviews_kind_check check (kind in ('word', 'phrase'));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'word_reviews_box_check'
  ) then
    alter table public.word_reviews
      add constraint word_reviews_box_check check (box between 0 and 6);
  end if;
end
$$;

comment on column public.word_reviews.kind is
  '語(word)か、句・イディオム・句動詞(phrase)か。鍵の作り方は同じ。';
comment on column public.word_reviews.box is
  '箱(0〜6)。0 = 覚えていない。上がるほど次に出るまでが長くなる。';
comment on column public.word_reviews.due_on is
  '次に出す日。教材を作るとき、この日を過ぎたものを先に混ぜる。';

-- 「今日出すべきもの」を引くための索引。復習の教材を作るたびに引く
create index if not exists word_reviews_due_idx
  on public.word_reviews (learner_id, due_on);

-- ────────────────────────────────────────────────────────────────
-- 2. 印を付ける — 間隔の決まりはここだけ
--
--   security definer にしない。**RLS をそのまま効かせる。**
--   自分の行しか書けないことは、既にポリシーが保証している
--   (word_reviews_own_write / _own_update)。
--   definer にすると、その保証を関数の中で作り直すことになる。
-- ────────────────────────────────────────────────────────────────
create or replace function public.mark_word(
  p_norm     text,
  p_status   text,
  p_kind     text default 'word',
  p_material uuid default null
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
  v_norm text;
  v_box  smallint;
  v_days int;
begin
  v_norm := public.norm_word(p_norm);
  if v_norm is null then
    raise exception '語が空です';
  end if;
  if p_status is null or p_status not in ('known', 'unknown') then
    raise exception '状態は known か unknown です';
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
    (learner_id, word_norm, kind, status, box, due_on, material_id, updated_at)
  values
    (auth.uid(), v_norm, coalesce(p_kind, 'word'), p_status,
     v_box, current_date + v_days, p_material, now())
  on conflict (learner_id, word_norm) do update
    set status      = excluded.status,
        kind        = excluded.kind,
        box         = excluded.box,
        due_on      = excluded.due_on,
        -- どの教材で出会ったかは、**最初のものを残す**。
        -- 上書きすると「いつ出会ったか」の手がかりが消える
        material_id = coalesce(w.material_id, excluded.material_id),
        updated_at  = now()
  returning w.word_norm, w.status, w.box, w.due_on;
end;
$$;

comment on function public.mark_word(text, text, text, uuid) is
  '語や句に「知っていた / 知らなかった」を付け、次に出す日を決める。'
  '間隔の決まりはこの関数だけが持つ。';

-- ────────────────────────────────────────────────────────────────
-- 3. 復習の材料を取り出す(作り直し)
--
--   返す列が増えるので、置き換えではなく一度落としてから作る。
--   `p_due_only` を true にすると、**今日出すべきものだけ**を返す。
-- ────────────────────────────────────────────────────────────────
drop function if exists public.review_words(uuid, text, int);

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
  '担当外は拒否する。';

grant execute on function public.mark_word(text, text, text, uuid)     to authenticated;
grant execute on function public.review_words(uuid, text, int, boolean) to authenticated;

-- ────────────────────────────────────────────────────────────────
-- 4. 本文の要点フレーズ
--
--   教材を作る時点で、本文の各文から要点となる句を拾っておく
--   (0〜2個)。**開くたびに AI に拾わせない。** 費用が毎回かかるうえ、
--   開くまで何が出るか分からない。作る時点なら道具の形で強制できる。
--
--   形: [{ "text": "look forward to", "note": "〜を楽しみに待つ" }, ...]
-- ────────────────────────────────────────────────────────────────
alter table public.material_items
  add column if not exists phrases jsonb;

comment on column public.material_items.phrases is
  'この項目の要点フレーズ。[{text, note}] の配列。押すと復習に入れられる。';
