-- ================================================================
-- 0056  単語帳を、全部読めるようにする
--
-- 2026-09 実機・利用者の問い:
--
--   > なぜ「まだ」が1900個以上あるのに出し方で選べるのが200個なのですか？
--
-- 【出どころ】
--   `review_words()` が **200 件で切っていた**(0028 から)。
--   画面の3つの札(まだ 1197 / 覚えかけ 111 / 覚えた 205)は
--   `wordbook_counts()` が**表を直に数えている**ので正しい。
--   ところが「出しかた」の札(今日出す / 1週間 / … / ぜんぶ)は、
--   **読み込んだ 200 行から数えている。**
--   だから**どの範囲を選んでも 200** と出て、範囲を選ぶ意味が消えていた。
--
--   しかも数だけの話ではない。実際に出る語も 200 語のうちからしか選ばれず、
--   4択のまちがいの選択肢も、聞き流しも、紙に出す一覧も、
--   **ぜんぶ同じ 200 語の中**で回っていた。
--
-- 【直し方】上限を上げる。ただし**出どころを1か所にする**
--   `public.wordbook_limit()` を作り、`review_words()` はそこから読む。
--   次に変えたくなったとき、**関数の本文を探し回らずに済む。**
--   画面の `SetupStatus` も、この関数が在るかどうかで
--   「0056 を貼ったか」を見る(**表を作らない移行の印**)。
--
-- 【貼る前でも壊れない】
--   貼るまでは 200 件で切られるだけで、単語帳も復習も動く。
--   画面が「◯◯ 語までしか読めていません」と自分で言う。
--
-- 【`qr_items()` は触っていない】(言われた場所だけを直す)
--   あちらの上限は 500 で、いまの Quick Response 帳は 87 問である。
-- ================================================================

-- ────────────────────────────────────────────────────────────────
-- 1. 上限そのもの。**ここが唯一の出どころ**
-- ────────────────────────────────────────────────────────────────
create or replace function public.wordbook_limit()
returns int
language sql
immutable
set search_path = public
as $$ select 5000 $$;

comment on function public.wordbook_limit() is
  '単語帳を1回に何語まで返すか(0056)。review_words() がここから読む。'
  '画面はこの関数の有無で「0056 を貼ったか」を見る。';

grant execute on function public.wordbook_limit() to authenticated;

-- ────────────────────────────────────────────────────────────────
-- 2. review_words() — 0048 の中身のまま、上限だけを差し替える
--
--    **返す列は1つも変えていない。** それでも
--    `drop function if exists` を先に置く(CLAUDE.md)——
--    あとで誰かが列を足したときに、このファイルだけを貼り直せなくなる。
-- ────────────────────────────────────────────────────────────────
drop function if exists public.review_words(uuid, text, int, boolean);

create or replace function public.review_words(
  p_learner  uuid,
  p_status   text    default 'unknown',
  p_limit    int     default 200,
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
    -- **上限は `wordbook_limit()` 1か所**(0056)。ここに数字を書かない
    limit greatest(1, least(coalesce(p_limit, 200), public.wordbook_limit()));
end;
$$;

comment on function public.review_words(uuid, text, int, boolean) is
  'ゲストの語を意味付きで返す。p_status に todo を渡すと「まだ + 覚えかけ」。'
  '絞り込みの手がかり(教材名・分野・種類・話題・場面・レベル)も返す(0048)。'
  '上限は wordbook_limit()(0056)。担当外のゲストを指定すると例外で拒否する。';
