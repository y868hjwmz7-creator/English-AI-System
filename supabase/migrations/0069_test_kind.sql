-- ============================================================================
-- 0069 教材の種類に「テスト」を足す(第5.263節)
--
-- 【なぜ要るのか】(2026-09-26 利用者の指定)
--
--   > テストは、ひとつの教材としてちゃんと作ってください。
--
--   はじめは「作って、見て、刷るだけ」の使い捨てにしていました(第5.260節)。
--   けれども**教材として残らなければ**、次のレッスンで開き直せませんし、
--   ゲストに共有もできませんし、ライブラリからも探せません。
--   **この仕組みは「教材」で回っています。**
--
-- 【何が起きるか】
--   `materials.kind` に入れてよい値の一覧に、**`test` を1つ足すだけ**です。
--   **表も、列も、1つも増えません。**
--   あわせて **`material_kinds()`** という読むだけの関数を作ります ——
--   「このデータベースは、どの種類を受け付けるか」を返すもので、
--   アプリの「準備の状態」がこれを見て 0069 の有無を判じます
--   (0063 の `section_types()` とまったく同じ立て付けです)。
--   0037(会議)・0043(Speech練習)とまったく同じやり方です。
--
--   テストの中身は **`translate_ja_en`(和文英訳)** で、
--   これは 0007 からある演習の種類です。**そちらも触りません。**
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
    'speech',     -- Speech練習(記事と同じ形。**1人が話しきる**・0043)
    'vocab',      -- 単語 / フレーズ(単語10 + フレーズ10・0047)
    'test',       -- テスト(日本語 → 英語。**AI を使わない**・**0069**)
    'word',       -- 旧「単語」。新規では使わないが、既存の行のために残す
    'phrase',     -- 旧「フレーズ」。同上
    'passage'     -- 旧「長文」。同上
  ));

-- ────────────────────────────────────────────────────────────────
-- **このデータベースが受け付ける種類を、訊けるようにする**
--
--   `section_types()`(0063)とまったく同じ立て付けです。
--   **制約そのものを読んで返す**ので、貼ったかどうかがそのまま値の有無に
--   なります。アプリの「準備の状態」が、これで 0069 の有無を見ます。
--
--   **表も行も増えません。** 読むだけの関数です。
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
  'このデータベースが受け付ける教材の種類(0069)。制約そのものから読む。'
  'アプリの「準備の状態」が、知っている一覧との食い違いを出すのに使う。'
  'section_types()(0063)とまったく同じ立て付け。';

grant execute on function public.material_kinds() to authenticated;

comment on column public.materials.kind is
  '教材の種類。pattern / reading / dialogue / meeting / speech / vocab / test / '
  'word / phrase / passage(うしろの3つは旧い形。新規では選べない)。'
  'test は 0069。ゲストの持ちもの(教材・単語帳・Quick Response 帳)から '
  '組んだ日本語 → 英語のテストで、**AI を1回も呼ばない**';
