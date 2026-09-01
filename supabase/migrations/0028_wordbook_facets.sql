-- ============================================================================
-- 0028 単語帳を「分野」「場面・話題」でも絞れるようにする
--
-- 【なぜ要るのか】(2026-08 利用者の指定)
--
--   > あとは業界、趣味別、シチュエーション、話題から上手く絞り込める
--   > コンパクトなUIを作成してください。
--
--   単語帳は増えていく。いまは**入った日**と**教材名**でしか絞れない。
--   「医療の語だけ」「交渉の場面で出た語だけ」で引けると、
--   レッスンの前に**その日の話題に合わせて**復習できる。
--
--   絞るための手がかりは**すでに教材が持っている**
--   (`materials.industry` / `kind` / `genre` / `scene`)。
--   語は `word_reviews.material_id` で教材につながっているので、
--   **表も列も増やさない。** 返す列を増やすだけでよい。
--
-- 【何をするか】
--   `review_words()` が、出会った教材の
--   **分野・種類・話題・場面**も返すようにする。
--
-- 【どこまで影響するか】
--   ・**いま入っている語は1件も変わりません。** 読み取るだけ
--   ・教材・宿題・取り組みには**いっさい触れません**
--   ・教材が消されていた語は、これまでどおり空で返る(`left join`)
--
-- 【何度貼っても安全】
--   **返す列が増えるので、先に drop する**(CLAUDE.md)。
--   置き換えようとすると `cannot change return type of existing function`
--   で止まる(0015 と 0002 で実際に踏んでいる)。
-- ============================================================================

drop function if exists public.review_words(uuid, text, int, boolean);

create or replace function public.review_words(
  p_learner  uuid,
  p_status   text    default 'unknown',
  p_limit    int     default 40,
  p_due_only boolean default false
)
returns table (
  word_norm      text,
  display        text,
  kind           text,
  pos            text,
  meaning_ja     text,
  seen_in        text,
  seen_in_ja     text,
  status         text,
  box            smallint,
  due_on         date,
  updated_at     timestamptz,
  added_at       timestamptz,
  material_id    uuid,
  material_title text,
  -- ここから 0028。**絞り込みの手がかり**
  material_industry text,
  material_kind     text,
  material_genre    text,
  material_scene    text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
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
           r.seen_in_ja,
           r.status,
           r.box,
           r.due_on,
           r.updated_at,
           r.added_at,
           r.material_id,
           m.title,
           m.industry,
           m.kind,
           m.genre,
           m.scene
    from public.word_reviews r
    left join lateral (
      select gg.display, gg.pos, gg.meaning_ja
      from public.word_glosses gg
      where gg.word_norm = r.word_norm
      order by (gg.context_key <> ''), gg.created_at
      limit 1
    ) g on true
    -- **教材が消えていても語は残す。** 絞り込みの手がかりが減るだけ
    left join public.materials m on m.id = r.material_id
    where r.learner_id = p_learner
      -- **'todo' は「まだ + 覚えかけ」**(0027)。復習で使う
      and (p_status is null
           or (p_status = 'todo' and r.status in ('unknown', 'learning'))
           or r.status = p_status)
      and (not p_due_only or r.due_on <= current_date)
    -- **まだ を先に、覚えかけ を次に**(0027)
    order by (r.status = 'learning'), r.due_on, r.box, r.updated_at desc
    limit greatest(1, least(coalesce(p_limit, 40), 200));
end;
$$;

comment on function public.review_words(uuid, text, int, boolean) is
  'ゲストの語を意味付きで返す。p_status に todo を渡すと「まだ + 覚えかけ」。'
  '並びは まだ → 覚えかけ の順(0027)。p_due_only で「今日出すもの」に絞る。'
  '出会った教材の分野・種類・話題・場面も返す(0028)。単語帳の絞り込みに使う。'
  '担当外は拒否する。';

-- **drop したので、権限を付け直す。** 忘れると画面から呼べなくなる
grant execute on function public.review_words(uuid, text, int, boolean) to authenticated;
