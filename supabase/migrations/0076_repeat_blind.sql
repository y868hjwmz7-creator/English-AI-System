-- ════════════════════════════════════════════════════════════════
-- 0076 演習の種類に「復唱」を足す(英文を画面に出さない)
--
-- 【なぜ要るのか】(2026-10-04 利用者の指摘)
--
--     英文を繰り返す問題、VERSANTのPART Bのような問題ですが、
--     **初めから英文が見えている仕様は絶対にやめてください**
--
--   **音読と復唱は、正反対です。**
--
--     ・**音読**(TOEIC Speaking Q1-2・英検の二次試験)
--       … 画面の英文を見て読み上げる。**英文は見せる**
--     ・**復唱**(VERSANT Part B・TOEFL Listen and Repeat)
--       … 聞こえた英文を、そのまま繰り返す。**英文は見せない**
--
--   ところが**3つとも「音読」(`read_aloud`)で作っていました。**
--   あちらは英文を画面にそのまま出すので、**聞く前に答えが見えていて**、
--   復唱の練習になりませんでした(見て読めば、ただの音読です)。
--
-- 【何が起きるか】
--   ・`material_sections` の表に入れてよい演習の種類が**1つ増えます**
--     (`repeat_blind` = 復唱)
--   ・**増えるだけです。** いままで作れた種類は1つも減りません
--
-- 【どこまで影響するか】
--   ・**教材・宿題・ゲストの情報・音声には、いっさい触れません**
--   ・いまある教材は、これまでどおり開けます
--   ・**何度貼っても同じ結果**になります
--
-- 【あわせて必要な作業】
--   **ありません。** 窓口(`generate-material`)は GitHub から自動で
--   配られます(第5.233節)。
--
-- 【成功の目安】
--   `Success. No rows returned` と出れば成功です。
--
--   **一覧は、いちばん新しいものにそろえてあります**(CLAUDE.md)。
--   狭いままにすると、その値を使っている DB に貼り直したときに
--   "violated by some row" で止まります。
--   `scripts/check-constraint-lists.mjs` が文字で突き合わせ、
--   `scripts/test-migration.sh` が行のある DB に実際に流して見張ります。
-- ════════════════════════════════════════════════════════════════

alter table public.material_sections drop constraint if exists material_sections_type_check;
alter table public.material_sections
  add constraint material_sections_type_check check (exercise_type in (
    -- 文型ドリル
    --   error_correction … 誤りを1か所直す。**穴埋めの置き換え**(0034)
    'translate_en_ja', 'error_correction', 'translate_ja_en', 'listening',
    -- 本文(まとまった1本)
    'article', 'dialogue',
    -- 本文に対する設問と語句
    --   discussion   … 本文をきっかけに自分の考えを話す。**正解が無い**(0033)
    --   audience_qa  … 話し終えたあと、聴衆から投げられる質問。**正解が無い**(0045)
    --   culture_note … なぜそう言うのか。**問いではない**(0063)
    'comprehension', 'discussion', 'audience_qa', 'vocab_note', 'culture_note',
    -- 旧「長文」で使っていたもの。既存の行のために残す
    'read_aloud', 'overlapping', 'shadowing', 'repeating',
    -- ★ **復唱**(0076・第5.369節)。英文を画面に出さず、聞いて繰り返す。
    --   音読(`read_aloud`)とは**正反対** —— あちらは画面の英文を読み上げる。
    --   VERSANT Part B / TOEFL Listen and Repeat がこれである
    'repeat_blind',
    -- 穴埋め。**新規では使わない**(0034 で誤り訂正へ差し替えた)。
    -- すでに作った教材を開くために残す
    'fill_blank',
    -- 単語・フレーズ
    --   vocab_recall  … 日本語を見て、その単語を英語で言う(0067)
    --   phrase_recall … 日本語を見て、そのフレーズを英語で言う(0067)
    'vocabulary', 'phrase', 'vocab_recall', 'phrase_recall'
  ));
