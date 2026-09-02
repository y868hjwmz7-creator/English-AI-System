-- ============================================================================
-- 0033 演習の種類に「ディスカッション」を足す
--
-- 【なぜ要るか】(2026-09 利用者の指定)
--
--   > 記事とダイアローグに、ディスカッションを追加してくれ。
--   > 内容理解５問に追加して、新しいページにディスカッションというものを
--   > 追加してくれ。これも基本は５問、設定により１０問にできるように
--
--   画面と窓口(`generate-material`)には足したが、**表にも「入れてよい
--   種類」の一覧がある。** そこに `discussion` が無かったため、
--   教材を発行しようとすると次の断りで止まっていた(2026-09 実機)。
--
--     new row for relation "material_sections"
--     violates check constraint "material_sections_type_check"
--
--   **演習の種類を足すときは、ここも足す。** 足す場所は4つある。
--
--     ① `src/data/exerciseTypes.js`(画面)
--     ② `SECTION_INSTRUCTIONS` / `SECTION_FIELDS`(窓口)
--     ③ `needsContext`(窓口。本文が要る演習かどうか)
--     ④ **この制約**(表。入れてよい種類の一覧)
--
-- 【ディスカッションとは】
--   内容の理解(`comprehension`)とは別物である。あちらは
--   「本文に何が書いてあったか」を確かめるもので**答えは本文の中にある**が、
--   こちらは本文をきっかけに**自分の考えを話す**もので**正解が無い。**
--   だから `answer` は空のままで、`note` に日本語の手がかりが入る。
--   `material_items` は列を決め打ちしていないので、**表の形は変えなくてよい。**
--
-- 【何が起きるか】
--   `material_sections.exercise_type` に入れてよい値が**1つ増えるだけ。**
--   すでに入っている行は1つも書き換わらない。
--
-- 【何度実行しても安全】
--   `drop constraint if exists` を先に置いてあるので、
--   まとめて貼り直しても、単体で貼り直しても同じ結果になる。
-- ============================================================================

alter table public.material_sections drop constraint if exists material_sections_type_check;
alter table public.material_sections
  add constraint material_sections_type_check check (exercise_type in (
    -- 文型ドリル
    'translate_en_ja', 'fill_blank', 'translate_ja_en', 'listening',
    -- 本文(まとまった1本)
    'article', 'dialogue',
    -- 本文に対する設問と語句
    --   discussion … 本文をきっかけに自分の考えを話す。**正解が無い**(0033)
    'comprehension', 'discussion', 'vocab_note',
    -- 旧「長文」で使っていたもの。既存の行のために残す
    'read_aloud', 'overlapping', 'shadowing', 'repeating',
    -- 単語・フレーズ
    'vocabulary', 'phrase'
  ));
