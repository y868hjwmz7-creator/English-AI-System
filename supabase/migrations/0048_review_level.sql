-- ================================================================
-- 0048 — 復習の絞り込みに「レベル」を足す
--
-- 2026-09 利用者の指定。
--
--   > また、レベルの絞り込みも欲しいですね
--
-- 単語帳と Quick Response の復習は、**入った日・教材・分野・場面**で
-- 絞れる(0024 / 0028 / 0040)。ところが**レベル(CEFR)だけが無かった。**
-- 「B1 の教材で出会った語だけ」をさらう、という引き方ができない。
--
-- ----------------------------------------------------------------
-- 【表も列も増えない】
--
--   レベルは `materials.level`(0005 で CEFR の文字列にしてある)に
--   もともと入っている。**返していなかっただけ**である。
--   だから足すのは、2つの関数の返す列に1つずつ。
--
-- 【返す列を変える関数は、先に drop を置く】
--
--   `create or replace` だけでは
--   `cannot change return type of existing function` で止まる。
--   **列を変えていなくても drop を置く**のがこのリポジトリの決まりだが、
--   ここは実際に列が増えるので、置かないと必ず止まる(CLAUDE.md)。
--
-- 【貼る前でも壊れない】
--
--   貼るまでは `material_level` が返らないので、画面の側は
--   **レベルの行を出さない**(`levelOf()` が null を返す)。
--   絞り込みが1つ増えないだけで、復習はこれまでどおり動く。
-- ================================================================

-- ────────────────────────────────────────────────────────────────
-- 1. review_words() — 単語帳(0047 の中身に material_level を足しただけ)
-- ────────────────────────────────────────────────────────────────
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
  material_industry text,
  material_kind     text,
  material_genre    text,
  material_scene    text,
  material_level    text,
  learn_streak      smallint
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
           -- **見せ方も、控えが無ければ教材のとおりに**(0047)。
           -- `word_norm` は小文字にそろえた形なので、そのままだと
           -- 固有名詞まで小文字で並ぶ
           coalesce(g.display, nullif(mi.prompt_en, ''), r.word_norm),
           r.kind,
           coalesce(g.pos, ''),
           -- **控えが無いときは、教材に書いてある訳を出す**(0047)
           coalesce(nullif(g.meaning_ja, ''), nullif(mi.prompt_ja, ''), ''),
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
           m.scene,
           m.level,
           r.learn_streak
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
    -- **その語が入った教材に、訳が書いてあれば使う**(0047)。
    -- 語句の演習(単語 / フレーズ / 本文に出てきた語句)だけを見る
    left join lateral (
      select ii.prompt_en, ii.prompt_ja
      from public.material_items ii
      join public.material_sections ss on ss.id = ii.section_id
      where ss.material_id = r.material_id
        and ss.exercise_type in ('vocabulary', 'phrase', 'vocab_note')
        and public.norm_word(ii.prompt_en) = r.word_norm
      limit 1
    ) mi on true
    where r.learner_id = p_learner
      and (p_status is null
           or (p_status = 'todo' and r.status in ('unknown', 'learning'))
           or r.status = p_status)
      and (not p_due_only or r.due_on <= current_date)
    order by (r.status = 'learning'), r.due_on, r.box, r.updated_at desc
    limit greatest(1, least(coalesce(p_limit, 40), 200));
end;
$$;

comment on function public.review_words(uuid, text, int, boolean) is
  'ゲストの語を意味付きで返す。p_status に todo を渡すと「まだ + 覚えかけ」。'
  '絞り込みの手がかり(教材名・分野・種類・話題・場面・レベル)も返す(0048)。'
  '担当外のゲストを指定すると例外で拒否する。';

grant execute on function public.review_words(uuid, text, int, boolean) to authenticated;

-- ────────────────────────────────────────────────────────────────
-- 2. qr_items() — Quick Response(0040 の中身に material_level を足しただけ)
-- ────────────────────────────────────────────────────────────────
drop function if exists public.qr_items(uuid, text, int, boolean);

create or replace function public.qr_items(
  p_learner  uuid,
  p_status   text    default 'todo',
  p_limit    int     default 200,
  p_due_only boolean default false
)
returns table (
  en_norm           text,
  en                text,
  ja                text,
  speaker           text,
  status            text,
  box               smallint,
  learn_streak      smallint,
  due_on            date,
  added_at          timestamptz,
  updated_at        timestamptz,
  material_id       uuid,
  material_title    text,
  material_industry text,
  material_kind     text,
  material_genre    text,
  material_scene    text,
  material_level    text
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
    raise exception '担当していないゲストの復習は取得できません';
  end if;

  return query
    select q.en_norm, q.en, q.ja, q.speaker,
           q.status, q.box, q.learn_streak, q.due_on, q.added_at, q.updated_at,
           q.material_id, m.title, m.industry, m.kind, m.genre, m.scene, m.level
      from public.qr_reviews q
      -- **教材が消えていても文は残す。** 絞り込みの手がかりが減るだけ
      left join public.materials m on m.id = q.material_id
     where q.learner_id = p_learner
       and (p_status is null
            or (p_status = 'todo' and q.status in ('unknown', 'learning'))
            or q.status = p_status)
       and (not p_due_only or q.due_on <= current_date)
     -- **まだ を先に、言えかけ を次に**(単語帳と同じ)
     order by (q.status = 'learning'), q.due_on, q.box, q.updated_at desc
     limit greatest(1, least(coalesce(p_limit, 200), 500));
end;
$$;

comment on function public.qr_items(uuid, text, int, boolean) is
  'Quick Response の復習に出す文を返す(0040)。'
  'p_status に todo を渡すと「まだ + 言えかけ」。p_due_only で今日ぶんに絞る。'
  '絞り込みの手がかり(教材名・分野・種類・話題・場面・レベル)も返す(0048)。'
  '担当外は拒否する。';

grant execute on function public.qr_items(uuid, text, int, boolean) to authenticated;
