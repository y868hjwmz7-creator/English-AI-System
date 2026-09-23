-- ============================================================================
-- 0063 演習の種類に「文化の背景」を足す
--
-- 【なぜ要るか】(2026-09 利用者の指定)
--
--   > 追加で、文化的な背景や、UNIT のシチュエーションと英語レベルで
--   > 覚えておきたい、単語・決まり文句・フレーズ・名詞句・副詞句を
--   > 網羅してください。
--
--   RIZAP ENGLISH の教材(Conversation 1 ほか4冊)をこのアプリに取り込む
--   ための下ごしらえである。語句のほうは `vocab_note`(本文に出た語句)に
--   そのまま入るが、**文化の背景を置く枠がどこにも無かった。**
--
-- 【語句とは別物である】
--
--   ・本文に出た語句(`vocab_note`)… その語の意味と使い方
--   ・文化の背景(`culture_note`)  … **なぜそう言うのか。** 日本と何が違うのか
--
--   UNIT 1(Booking a Bus)でいえば、`departure` の意味は語句のほうだが、
--   「アメリカは鉄道が弱く、長距離はバスが基本」「電話では社名 + 自分の
--   下の名前だけを名乗る」「日付は月 → 日」は文化の背景である。
--   **意味が分かっても、これを知らないと会話が成り立たない。**
--
-- 【正解が無い。答えも音声も持たない】
--
--   読んで分かればよいもので、問いではない。だから
--   `question` も `answer` も持たせない(**書けない欄は最初から作らない**)。
--   読み上げも付けない —— 中身は日本語である。
--
-- 【何が起きるか】
--   `material_sections.exercise_type` に入れてよい値が**1つ増えるだけ。**
--   **表も列も増えません。すでに入っている行は1つも書き換わりません。**
--
-- 【どこまで影響するか】
--   教材・宿題・単語帳・ゲストの情報・取り組みの記録には触れません。
--   RLS(見える範囲の決まり)も変えません。
--   **何度貼っても同じ結果になります。**
--
-- 【あわせて必要な作業】
--   ありません。**関数の置き直しは要りません** ——
--   この演習は AI に作らせるものではなく、**こちらが書いて入れる**ものです。
--
-- 【成功の目安】
--   `Success. No rows returned` と出れば成功です。
-- ============================================================================

alter table public.material_sections drop constraint if exists material_sections_type_check;
alter table public.material_sections
  add constraint material_sections_type_check check (exercise_type in (
    -- **一覧はどのファイルでも同じにする。**あとの移行で足した値も、
    -- ここに書く。狭いままだと、その値を使っている DB に貼り直したとき
    -- "violated by some row" で止まる(scripts/check-constraint-lists.mjs)
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
    'vocabulary', 'phrase',
    -- 日本語を見て英語で言う(0067・第5.248節)
    'vocab_recall', 'phrase_recall'
  ));

-- ────────────────────────────────────────────────────────────────
-- 演習の種類の一覧を、データベース側から読めるようにする
--
--   **なぜ要るか。** この移行は**表も列も増やさない**ので、
--   アプリからは「貼ったかどうか」が見えない。見えないまま
--   「準備の状態」が ✅ になると、**本当は足りないのに全部 ✅**という
--   いちばん悪い壊れ方になる(CLAUDE.md)。
--
--   **印のためだけの関数ではない。** ここが答えるのは
--   「**このデータベースは、どの演習の種類を受け付けるか**」であり、
--   アプリが知っている一覧と食い違っていると、教材を作った最後の最後で
--   insert が落ちる。準備の状態が、その食い違いをそのまま出せる。
--
--   **一覧をここに書き写さない。** 上の制約そのものから読む ——
--   種類を足した日に、ここだけ古い一覧が残らない
--   (CLAUDE.md「呼び名を2か所に書かない」)。
--
--   **読むだけの関数**なので、訊いただけでは何も書き換わらない。
-- ────────────────────────────────────────────────────────────────

-- **返す列を変えていなくても drop を置く**(CLAUDE.md)。
-- あとで誰かが列を足すと、drop が無いファイルは貼り直せなくなる
drop function if exists public.section_types();

create or replace function public.section_types()
returns setof text
language sql
stable
as $$
  select (regexp_matches(pg_get_constraintdef(oid), '''([a-z_]+)''', 'g'))[1]
  from pg_constraint
  where conname = 'material_sections_type_check'
$$;

comment on function public.section_types() is
  'このデータベースが受け付ける演習の種類(0063)。制約そのものから読む。'
  'アプリの「準備の状態」が、知っている一覧との食い違いを出すのに使う。';

grant execute on function public.section_types() to authenticated;
