-- ============================================================================
-- 0073 教材の種類に「応答問題」を足す(第5.332節)
--
-- 【なぜ要るのか】(2026-10-01 利用者の指定)
--
--   > 今、完成した TOEIC L&R の PART2 問題を応用して、NATIVE FLOW の
--   > 応答問題を作りたい。問題形式は TOEIC L&R の PART2 と同じにして
--   > NATIVE FLOW で学ぶ表現が応答の正解となるようにするんです。
--   > 選択肢 A-C から選ぶんです。または、選択肢なしにも出来るように
--   > 作成時に選べるように。また、いくつか正解の候補がある場合は
--   > 別解を設け、明記すること。
--
-- 【何が起きるか】
--   `materials.kind` に入れてよい値の一覧に、**`response` を1つ足すだけ**です。
--   **表も、列も、1つも増えません。**
--   0037(会議)・0043(モノローグ)・0069(テスト)・0072(テスト対策)と、
--   まったく同じやり方です。
--
--   中身は **0007 からある「リスニング + 理解」1つだけ**です
--   (質問を聞く → 応答を選ぶ / 言う)。
--   **演習の種類は1つも増えないので、`material_sections_type_check` は
--   触りません。**
--
-- 【どこまで影響するか】
--   いまある教材・宿題・ゲストの情報には、いっさい触れません。
--   **いままで作れた種類は、1つも減りません。**
--
-- 【成功の目安】
--   `Success. No rows returned` と出れば成功です。
--
-- 【何度貼っても安全か】
--   安全です。`drop constraint if exists` → `add constraint` だけです。
--
--   **一覧は、いちばん新しいものにそろえてあります**(CLAUDE.md)。
--   狭いままだと、その値が入っている DB に貼り直したとき
--   "violated by some row" で止まります
--   (`scripts/check-constraint-lists.mjs` が見張っています)。
-- ============================================================================

alter table public.materials drop constraint if exists materials_kind_check;
alter table public.materials
  add constraint materials_kind_check check (kind in (
    -- **一覧はどのファイルでも同じにする。**あとの移行で足した値も、
    -- ここに書く。狭いままだと、その値を使っている DB に貼り直したとき
    -- "violated by some row" で止まる(scripts/check-constraint-lists.mjs)
    'pattern',    -- 文型ドリル(4演習 × 10問 = 40問)
    'reading',    -- リーディング(記事1本 + 内容理解 + ディスカッション + 語句)
    'dialogue',   -- ダイアローグ(会話1本。2人)
    'meeting',    -- 会議(会話と同じ形。**3〜4人**・0037)
    'speech',     -- モノローグ(記事と同じ形。**1人が話しきる**・0043)
    'vocab',      -- 単語 / フレーズ(単語10 + フレーズ10・0047)
    'test',       -- テスト(日本語 → 英語。**AI を使わない**・0069)
    'exam',       -- テスト対策(試験の PART べつの練習問題・0072)
    'response',   -- 応答問題(覚える表現が応答の正解になる・**0073**)
    'word',       -- 旧「単語」。新規では使わないが、既存の行のために残す
    'phrase',     -- 旧「フレーズ」。同上
    'passage'     -- 旧「長文」。同上
  ));

-- ────────────────────────────────────────────────────────────────
-- **このデータベースが受け付ける種類を、訊けるようにする**(0069 で作った)
--
--   **先に drop します。** 返す列を変えていなくても置く決まりです
--   (あとで誰かが列を足したとき、この段だけを貼り直せなくなるため・
--    CLAUDE.md「関数を作り直すファイルは、返す列を変えていなくても drop を置く」)。
-- ────────────────────────────────────────────────────────────────
drop function if exists public.material_kinds();

create or replace function public.material_kinds()
returns setof text
language sql
stable
as $$
  select (regexp_matches(pg_get_constraintdef(oid), '''([a-z_]+)''', 'g'))[1]
  from pg_constraint
  where conname = 'materials_kind_check'
$$;

comment on function public.material_kinds() is
  'このデータベースが受け付ける教材の種類(0069 で作り、0073 で足した)。'
  '制約そのものから読む。アプリの「準備の状態」が、'
  '知っている一覧との食い違いを出すのに使う。';

grant execute on function public.material_kinds() to authenticated;

comment on column public.materials.kind is
  '教材の種類。pattern / reading / dialogue / meeting / speech / vocab / test / '
  'exam / response / word / phrase / passage(うしろの3つは旧い形。'
  '新規では選べない)。'
  'response は 0073。TOEIC L&R Part 2 と同じ形の応答問題で、'
  '**覚えたい表現が応答の正解になる。** もとになる表現は'
  'テキスト(Native Flow / RIZAP)・ゲストの単語帳・Quick Response 帳から引く。'
  '中身は「リスニング + 理解」1つだけなので、演習の種類は増えていない。';
