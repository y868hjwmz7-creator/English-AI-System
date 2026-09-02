-- ============================================================================
-- 0034 演習の種類に「誤り訂正」を足す(穴埋めの置き換え)
--
-- 【なぜ要るか】(2026-09 利用者の指定)
--
--   > そもそもこの穴埋めはいらないかもしれない。
--   > なぜなら、穴埋めは複数の回答が考えられる場合があり、すっきりしない
--
--   きっかけは実機でこう出たこと。
--
--     Before kickoff, could you （　　　） me where the away fans usually sit?
--     与える語: tell
--     → tell
--
--   `could you` のうしろは原形なので**形を変える必要がなく**、
--   与える語がそのまま答えになっていた。空欄の位置そのものが誤っている。
--   加えて、空欄に入りうる語が1つに決まらないことがある。
--
--   誤り訂正なら、**直す1か所も、直した形も1つに決まる。**
--   弱点をそのまま誤りにできるので、「弱点 → 教材」の循環にもよく合う。
--
-- 【穴埋め(`fill_blank`)は消さない】
--   **すでに作った教材が開けなくなる。** 一覧に残したまま、
--   新規では使わないようにするだけ(旧「長文」と同じ扱い)。
--   だから、この移行は**一覧に1つ足すだけ**である。
--
-- 【何が起きるか】
--   `material_sections.exercise_type` に入れてよい値が**1つ増えるだけ。**
--   すでに入っている行は1つも書き換わらない。
--
-- 【何度実行しても安全】
--   `drop constraint if exists` を先に置いてある。
-- ============================================================================

alter table public.material_sections drop constraint if exists material_sections_type_check;
alter table public.material_sections
  add constraint material_sections_type_check check (exercise_type in (
    -- 文型ドリル
    --   error_correction … 誤りを1か所直す。**穴埋めの置き換え**(0034)
    'translate_en_ja', 'error_correction', 'translate_ja_en', 'listening',
    -- 本文(まとまった1本)
    'article', 'dialogue',
    -- 本文に対する設問と語句
    --   discussion … 本文をきっかけに自分の考えを話す。**正解が無い**(0033)
    'comprehension', 'discussion', 'vocab_note',
    -- 旧「長文」で使っていたもの。既存の行のために残す
    'read_aloud', 'overlapping', 'shadowing', 'repeating',
    -- 穴埋め。**新規では使わない**(0034 で誤り訂正へ差し替えた)。
    -- すでに作った教材を開くために残す
    'fill_blank',
    -- 単語・フレーズ
    'vocabulary', 'phrase'
  ));
