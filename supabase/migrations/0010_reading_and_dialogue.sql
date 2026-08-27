-- ============================================================================
-- English AI System — リーディング(記事)とダイアローグ(会話)を作れるようにする
--
-- 【なぜ必要か】
--   「長文」で教材を作ったら、長文ではなかった。
--   実際にできたのは「音読8問 + シャドーイング8問 = 16問」で、
--   短い英文が16個並んだだけだった。設計そのものの誤りである。
--
--   利用者が求めているのは次の2つで、どちらも**まとまった1本の文章**である。
--
--   1. リーディング … 業界別のニュース記事(Engoo のような)。
--      その業界の面白いネタや時事を扱う
--   2. ダイアローグ … 会話。噂話・オフィスでの雑談・真面目な会議・交渉など、
--      場面を変えて作れること
--
--   音読・オーバーラッピング・シャドーイング・リピーティングは、
--   **別々の演習ではなく、同じ本文に対する取り組み方**である。
--   これを演習として並べたことが、16問に割れた原因だった。
--
-- 【何が変わるか】
--   1. 教材の種類に reading(リーディング)と dialogue(ダイアローグ)が入る。
--      既存の passage(長文)は reading に移す
--   2. materials に headline(見出し)・genre(記事のジャンル)・
--      scene(会話の場面)・topic(話題の指定)が入る
--   3. material_items に speaker(会話の話者)が入る
--   4. 演習の種類に article / dialogue / comprehension / vocab_note が入る
--
-- 【既存のデータの扱い】
--   何も消さない。passage の教材は kind を reading に変えるだけで、
--   中の設問はそのまま残る。何度実行してもよい。
-- ============================================================================

-- ────────────────────────────────────────────────────────────────
-- 1. 教材の種類
-- ────────────────────────────────────────────────────────────────
alter table public.materials drop constraint if exists materials_kind_check;
alter table public.materials
  add constraint materials_kind_check check (kind in (
    'pattern',    -- 文型ドリル(4演習 × 10問 = 40問)
    'reading',    -- リーディング(記事1本 + 内容理解 + 語句)
    'dialogue',   -- ダイアローグ(会話1本 + 内容理解 + 語句)
    'word',       -- 単語
    'phrase',     -- フレーズ
    'passage'     -- 旧「長文」。新規では使わないが、既存の行のために残す
  ));

-- 旧「長文」はリーディングに移す。中身はそのまま。
update public.materials set kind = 'reading' where kind = 'passage';

-- ────────────────────────────────────────────────────────────────
-- 2. 記事・会話のための欄
--
--   見出しと本文の題名は、教材名とは別に持つ。教材名は
--   「日付 / 弱点 / レベル / ゲスト名」で自動生成されるため、
--   記事の見出しを入れる場所が無い。
-- ────────────────────────────────────────────────────────────────
alter table public.materials
  add column if not exists headline text,
  add column if not exists genre    text,
  add column if not exists scene    text,
  add column if not exists topic    text;

comment on column public.materials.headline is
  '記事の見出し / 会話の題名。教材名とは別物';
comment on column public.materials.genre is
  'リーディングのジャンル(テクノロジー、ビジネス、健康 など)';
comment on column public.materials.scene is
  'ダイアローグの場面(噂話、オフィスでの雑談、会議、交渉 など)';
comment on column public.materials.topic is
  'トレーナーが指定した話題。空なら AI が業界とジャンルから決める';

-- 会話の話者。「A / B」ではなく名前と肩書きが入る想定
-- (Sarah (Product Manager) のように)。誰の発言かが分からないと、
-- 役になりきって読む練習ができない。
alter table public.material_items
  add column if not exists speaker text;

comment on column public.material_items.speaker is
  'ダイアローグでの話者。記事や文型ドリルでは null';

-- ────────────────────────────────────────────────────────────────
-- 3. 演習の種類
--
--   article / dialogue は「本文」であって設問ではない。1つの演習の中に
--   段落(または発言)が順に並ぶ。ゲストはこの本文に対して、音読・
--   オーバーラッピング・シャドーイング・リピーティングを行う。
-- ────────────────────────────────────────────────────────────────
alter table public.material_sections drop constraint if exists material_sections_type_check;
alter table public.material_sections
  add constraint material_sections_type_check check (exercise_type in (
    -- 文型ドリル
    'translate_en_ja', 'fill_blank', 'translate_ja_en', 'listening',
    -- 本文(まとまった1本)
    'article', 'dialogue',
    -- 本文に対する設問と語句
    'comprehension', 'vocab_note',
    -- 旧「長文」で使っていたもの。既存の行のために残す
    'read_aloud', 'overlapping', 'shadowing', 'repeating',
    -- 単語・フレーズ
    'vocabulary', 'phrase'
  ));
