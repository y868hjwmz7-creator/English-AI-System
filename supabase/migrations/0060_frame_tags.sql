-- ============================================================================
-- English AI System — 苦手タグに「無生物主語」と「名詞構文」を足す
--
-- 【なぜ必要か】(2026-09 利用者の指定)
--
--   > 「無生物主語」と「名詞構文」のタグをつけ足してください。
--
--   英文を組み立てる「型」のうち、**この2つだけ行き先が無かった。**
--
--     無生物主語 … Cutting corners costs more in the long run.
--                  This tool allows you to share files instantly.
--     名詞構文   … We decided to postpone → Our decision to postpone
--
--   どちらも **日本語から訳しても絶対に出てこない**ので、
--   レッスンで指摘する値打ちがいちばん大きいところである。
--   ところが指摘しても、**貼る先のタグが無かった。**
--
-- 【なぜ、いまあるタグでは足りないか】
--
--   `sentence-pattern`(文型 SVOC)は**並びの決まり**、
--   `gerund`(動名詞)は **-ing を名詞にする形**そのものを指す。
--   どちらも「**人以外を主語の席に立てる**」「**文を名詞のかたまりにする**」
--   という**組み立ての型**は指せない。
--   **似たタグを2つ作らない**ので、重ならないところだけを足してある。
--
-- 【なぜ SQL が要るか — いちばん大事なところ】
--
--   弱点タグは**画面(`src/data/weaknessTags.js`)と表の2か所**にある。
--   しかも `material_tags.tag_id` は `weakness_tags(id)` を参照している。
--
--     tag_id text not null references public.weakness_tags(id)
--
--   だから**このファイルを貼る前に新しいタグで教材を発行すると、
--   その瞬間に外部キー違反で止まる。**
--   0050・0052 とまったく同じ落とし穴である(CLAUDE.md)。
--   `scripts/check-exercise-types.mjs` が、画面と表の食い違いを見張る。
--
-- 【何を消すか】
--   **何も消さない。何も書き換えない。** 既存のタグは1文字も触らない。
--   足すのは2行だけで、**何度実行してもよい**(`on conflict` で上書き)。
--
-- 【貼る前でも壊れない】
--   足したタグを選ばなければ、これまでどおり動く。
--   選んで発行したときだけ止まる(そして、その場でこのファイルを貼れば直る)。
-- ============================================================================

insert into public.weakness_tags (id, category, kind, label, hint, sort_order) values
  ('inanimate-subject', 'grammar', 'weakness', '無生物主語',
   '人以外を主語に立てる。Cutting corners costs more / This tool allows you to 〜', 519),
  ('nominalization',    'grammar', 'weakness', '名詞構文',
   '動詞や文を名詞のかたまりにする。We decided → our decision to 〜', 520)
on conflict (id) do update
  set category = excluded.category,
      kind     = excluded.kind,
      label    = excluded.label,
      hint     = excluded.hint;
