-- ================================================================
-- 0062 … Quick Response の復習を、1回に何問まで返すか
--
-- 【なぜ要るか】
--   2026-09、利用者が **Native Flow Vol.1**(690 問)を
--   Quick Response 教材として渡した。
--
--     > これらを教材として独立させて登録せよ。
--     > Native flow は Quick Response 教材、コロケーション基本動詞は単語帳だ。
--
--   ところが `qr_items()` は **SQL の本文で 500 に切っていた**(0048)。
--
--       limit greatest(1, least(coalesce(p_limit, 200), 500));
--
--   690 問あるので、**後ろの 190 問は覚え具合が付かず、
--   何度答えても「まだ」に見える。**
--   単語帳が 200 で切られていたのと、まったく同じ壊れ方である(0056)。
--
-- 【直し方】上限を上げる。ただし**出どころを1か所にする**
--   `public.qr_limit()` を作り、`qr_items()` はそこから読む。
--   中身は `public.wordbook_limit()`(0056)を返すだけ ——
--   **数字を2か所に書かない。**
--
--   **印のためだけの関数ではない。** 語(単語帳)と文(Quick Response)
--   では溜まる数が違うので、**別の値にしたくなる日が来る。**
--   そのときは、この関数の1行を書き換える。
--
-- 【貼る前でも壊れない】
--   貼るまでは 500 問で切られるだけで、Quick Response も Native Flow も動く。
--   画面が「いま読めているのは ◯◯ 問までです」と自分で言う。
--
-- 【返す列は1つも変えていない】
--   それでも `drop function if exists` を先に置く(CLAUDE.md)——
--   **あとから誰かが列を足すかもしれない。** そのとき、この移行だけを
--   貼り直すと `cannot change return type of existing function` で止まる。
--
-- 【表も列も作らない】
--   だから画面の `SetupStatus` は、**`qr_limit()` が在るかどうか**で
--   「0062 を貼ったか」を見る(0056 とまったく同じ作法)。
-- ================================================================

-- ────────────────────────────────────────────────────────────────
-- 1. 上限そのもの。**ここが唯一の出どころ**
-- ────────────────────────────────────────────────────────────────
create or replace function public.qr_limit()
returns int
language sql
immutable
set search_path = public
as $$ select public.wordbook_limit() $$;

comment on function public.qr_limit() is
  'Quick Response の復習を1回に何問まで返すか(0062)。qr_items() がここから読む。'
  'いまは単語帳と同じ値。画面はこの関数の有無で「0062 を貼ったか」を見る。';

grant execute on function public.qr_limit() to authenticated;

-- ────────────────────────────────────────────────────────────────
-- 2. qr_items() — 0048 の中身のまま、上限だけを差し替える
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
     -- **上限は `qr_limit()` 1か所**(0062)。ここに数字を書かない
     limit greatest(1, least(coalesce(p_limit, 200), public.qr_limit()));
end;
$$;

comment on function public.qr_items(uuid, text, int, boolean) is
  'Quick Response の復習に出す文(0040 / 0048 / 0062)。'
  '上限は qr_limit() から読む。本人・担当トレーナー・管理者だけが呼べる。';

grant execute on function public.qr_items(uuid, text, int, boolean) to authenticated;
