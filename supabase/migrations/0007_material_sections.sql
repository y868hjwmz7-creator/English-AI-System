-- ============================================================================
-- English AI System — 教材の形を、実際のドリルに合わせて作り直す
--
-- 【なぜ必要か】
--   実際にレッスンで使っているドリルを見せてもらったところ、
--   教材は「英文の並び」ではなく、**1つの文法ポイントを軸にした
--   演習のまとまり**だった。
--
--     教材:「名詞 + to不定詞 =〜すべき/〜する必要がある」
--       ├ ① 英文和訳    × 10
--       ├ ② 穴埋め      × 10(与える語つき)
--       ├ ③ 和文英訳    × 10(解答例)
--       └ ④ リスニング  × 10(読み上げ文・設問・解答)
--
--   これで「3日分のほんの一部」。1教材 = 40問が出発点になる。
--
--   0001 の material_items は text_en / text_ja しか持たず、
--   ②の「与える語」も④の「設問」も表現できなかった。
--
-- 【何が変わるか】
--   1. materials に「指導ポイント」が付く(教材全体にかかる注意)
--   2. material_sections(演習)が入る。教材 → 演習 → 設問 の3階層になる
--   3. material_items が設問の形になる(提示・与える語・解答・設問・音声)
--   4. 教材の種類に「文型ドリル」が加わる
--
-- 【既存のデータの扱い】
--   これまでの material_items は text_en / text_ja を持っている。
--   各教材に「音読」の演習を1つ作り、その中へ移す。内容は失われない。
-- ============================================================================

-- ────────────────────────────────────────────────────────────────
-- 1. 教材全体にかかる指導ポイント
-- ────────────────────────────────────────────────────────────────

alter table public.materials
  add column if not exists teaching_point text;

comment on column public.materials.teaching_point is
  '教材全体にかかる注意。1問ごとではなく、この文法ポイント全体の勘所を書く。'
  '例「emails to reply to のように、reply to の to を落とさないこと」';

-- 教材の種類に「文型ドリル」を足す。
-- 同じ文法で違う文章を数十本くり返す形は、長文でも単語でもフレーズでもない。
alter table public.materials drop constraint if exists materials_kind_check;
alter table public.materials
  add constraint materials_kind_check
  check (kind in ('pattern', 'passage', 'word', 'phrase'));

comment on column public.materials.kind is
  'pattern=文型ドリル(同じ文法で違う文章をくり返す) / passage=長文 / word=単語 / phrase=フレーズ';

-- ────────────────────────────────────────────────────────────────
-- 2. 演習(教材の中の「①」「②」…)
-- ────────────────────────────────────────────────────────────────

create table if not exists public.material_sections (
  id            uuid primary key default gen_random_uuid(),
  material_id   uuid not null references public.materials(id) on delete cascade,
  seq           integer not null,
  exercise_type text not null,
  instruction   text,           -- 「次の英文を日本語に訳しなさい。…」
  created_at    timestamptz not null default now(),
  unique (material_id, seq)
);

alter table public.material_sections drop constraint if exists material_sections_type_check;
alter table public.material_sections
  add constraint material_sections_type_check check (exercise_type in (
    'translate_en_ja',  -- 英文和訳
    'fill_blank',       -- 穴埋め(与える語つき)
    'translate_ja_en',  -- 和文英訳(解答例)
    'listening',        -- リスニング + 理解(読み上げ文・設問・解答)
    'read_aloud',       -- 音読
    'overlapping',      -- オーバーラッピング
    'shadowing',        -- シャドーイング
    'repeating',        -- リピーティング
    'vocabulary',       -- 単語
    'phrase'            -- フレーズ
  ));

comment on table public.material_sections is
  '教材の中の演習ひとまとまり。実際のドリルの「① 英文和訳 ×10」に相当する。';

create index if not exists material_sections_material_idx
  on public.material_sections (material_id, seq);

-- ────────────────────────────────────────────────────────────────
-- 3. 設問(演習の中の1問)
--
--   演習の種類によって使う欄が違う。空でよい欄は空のままにする。
--
--   | 種類       | prompt_en | prompt_ja | hint    | question | answer   | audio_text |
--   |------------|-----------|-----------|---------|----------|----------|------------|
--   | 英文和訳   | 出題文    |           |         |          | 和訳     | 出題文     |
--   | 穴埋め     | 穴あき文  |           | 与える語|          | 入る語   |            |
--   | 和文英訳   |           | 出題文    |         |          | 解答例   | 解答例     |
--   | リスニング |           |           |         | 設問     | 解答     | 読み上げ文 |
--   | 音読ほか   | 英文      | 訳        |         |          |          | 英文       |
-- ────────────────────────────────────────────────────────────────

alter table public.material_items
  add column if not exists section_id  uuid references public.material_sections(id) on delete cascade,
  add column if not exists prompt_en   text,
  add column if not exists prompt_ja   text,
  add column if not exists hint        text,
  add column if not exists question    text,
  add column if not exists answer      text,
  add column if not exists answer_alt  text,
  add column if not exists audio_text  text,
  add column if not exists note        text;

comment on column public.material_items.hint is       '穴埋めで与える語。例「reply to」';
comment on column public.material_items.note is       '1問ごとの補足。0001 の note_ja を置き換える';
comment on column public.material_items.question is   'リスニングの設問。英文は見せずに読み上げる';
comment on column public.material_items.answer_alt is '別解。和文英訳は解答例なので複数ありうる。改行区切り';
comment on column public.material_items.audio_text is
  'お手本音声にする英文。空なら prompt_en を使う。音声を作る対象はこの欄。';

-- 既存の教材を、演習「音読」1つにまとめて移す
do $$
declare m record; new_section uuid;
begin
  for m in
    select distinct material_id from public.material_items where section_id is null
  loop
    insert into public.material_sections (material_id, seq, exercise_type, instruction)
    values (m.material_id, 1, 'read_aloud', '音読してください。')
    on conflict (material_id, seq) do nothing
    returning id into new_section;

    if new_section is null then
      select id into new_section from public.material_sections
      where material_id = m.material_id and seq = 1;
    end if;

    update public.material_items
    set section_id = new_section,
        prompt_en  = coalesce(prompt_en, text_en),
        prompt_ja  = coalesce(prompt_ja, text_ja),
        audio_text = coalesce(audio_text, text_en),
        note       = coalesce(note, note_ja)
    where material_id = m.material_id and section_id is null;
  end loop;
end $$;

-- 演習ごとに番号を振り直せるよう、教材単位の一意制約を外す
alter table public.material_items drop constraint if exists material_items_material_id_seq_key;
create unique index if not exists material_items_section_seq_uniq
  on public.material_items (section_id, seq);
create index if not exists material_items_section_idx
  on public.material_items (section_id, seq);

-- 古い列は残す(いきなり消すと、まだ読んでいる画面が壊れる)。
-- 新しい画面が出そろってから消す。
-- 新しい形では prompt_en を使うので、text_en の必須は外す。
alter table public.material_items alter column text_en drop not null;

-- 移行のあいだ、新旧どちらの列からでも読めるようにしておく。
-- 片方だけ埋めた行ができると、まだ古い列を読んでいる画面が空になる。
create or replace function public.sync_material_item_columns()
returns trigger language plpgsql as $$
begin
  new.prompt_en := coalesce(new.prompt_en, new.text_en);
  new.prompt_ja := coalesce(new.prompt_ja, new.text_ja);
  new.text_en   := coalesce(new.text_en, new.prompt_en, new.audio_text, '');
  new.text_ja   := coalesce(new.text_ja, new.prompt_ja);
  return new;
end;
$$;

drop trigger if exists sync_material_item_columns on public.material_items;
create trigger sync_material_item_columns
  before insert or update on public.material_items
  for each row execute function public.sync_material_item_columns();

comment on column public.material_items.text_en is
  '【旧】0007 より前の形。prompt_en に移してある。新しいコードでは使わない。';
comment on column public.material_items.text_ja is
  '【旧】0007 より前の形。prompt_ja に移してある。新しいコードでは使わない。';

-- ────────────────────────────────────────────────────────────────
-- 4. アクセス制御(演習は、親の教材が見えるかどうかで決まる)
-- ────────────────────────────────────────────────────────────────

alter table public.material_sections enable row level security;

drop policy if exists "教材の演習" on public.material_sections;
create policy "教材の演習" on public.material_sections
  for select to authenticated
  using (public.is_trainer() or public.is_assigned_material(material_id));

drop policy if exists "教材の演習はトレーナーだけ" on public.material_sections;
create policy "教材の演習はトレーナーだけ" on public.material_sections
  for all to authenticated
  using (public.is_trainer()) with check (public.is_trainer());

-- ============================================================================
-- 完了。
--
-- 【1教材の目安】
--   文型ドリル: 演習4つ × 10問 = 40問。これで3日分の一部。
--   音声を作るのは audio_text がある問だけ(和訳とリスニングの計20問ほど)。
--   穴埋めと和文英訳には音声を作らない。
-- ============================================================================
