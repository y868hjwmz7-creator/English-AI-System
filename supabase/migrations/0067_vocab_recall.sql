-- ============================================================================
-- 0067 単語 / フレーズに「日本語 → 英語で言う」を足す(第5.248節)
--
-- 【なぜ要るのか】(2026-09-23 利用者の指定)
--
--   > そして単語、フレーズそれぞれについて日本語→英語の練習が7個ずつ。
--
--   単語とフレーズの教材は、これまで**並んだものを見るだけ**でした。
--   見て分かることと、何も見ずに口から出ることは別です。
--   日本語だけを見せて英語を言わせる段を、それぞれに1つ足します。
--
-- 【何が起きるか】
--   `material_sections` の「演習の種類」に、値を**2つ足すだけ**です。
--   `vocab_recall`(単語を言う)と `phrase_recall`(フレーズを言う)。
--
-- 【どこまで影響するか】
--   **表も行も増えません。** すでにある教材・宿題・ゲストの情報には
--   いっさい触れません。制約の一覧が広がるだけです。
--
-- 【成功の目安】
--   `Success. No rows returned` と出れば成功です。
--
-- 【何度貼っても安全か】
--   安全です。`drop constraint if exists` → `add constraint` なので、
--   すでに入っていても同じ形に置き直されるだけです。
--
-- 【値の一覧について】(CLAUDE.md)
--   **一覧を書き直すファイルは、どれも同じ一覧を書く。**
--   0063 の一覧をそのまま写し、**いちばん下に2つ足して**あります。
--   狭いままにすると、その値を使っている DB に貼り直したときに
--   "violated by some row" で止まります。
--   `scripts/check-constraint-lists.mjs` が文字で突き合わせ、
--   `scripts/test-migration.sh` が行のある DB に実際に流して見張ります。
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
    --   discussion   … 本文をきっかけに自分の考えを話す。**正解が無い**(0033)
    --   audience_qa  … 話し終えたあと、聴衆から投げられる質問。**正解が無い**(0045)
    --   culture_note … なぜそう言うのか。**問いではない**(0063)
    'comprehension', 'discussion', 'audience_qa', 'vocab_note', 'culture_note',
    -- 旧「長文」で使っていたもの。既存の行のために残す
    'read_aloud', 'overlapping', 'shadowing', 'repeating',
    -- 穴埋め。**新規では使わない**(0034 で誤り訂正へ差し替えた)。
    -- すでに作った教材を開くために残す
    'fill_blank',
    -- 単語・フレーズ
    --   vocab_recall  … 日本語を見て、その単語を英語で言う(0067)
    --   phrase_recall … 日本語を見て、そのフレーズを英語で言う(0067)
    'vocabulary', 'phrase', 'vocab_recall', 'phrase_recall'
  ));
