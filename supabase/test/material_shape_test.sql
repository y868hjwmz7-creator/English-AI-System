-- ============================================================================
-- 教材の形が、実際のドリルをそのまま収められるかを確かめる
--
-- レッスンで使われている本物のドリル(名詞 + to不定詞)を、
-- 4つの演習ぜんぶ、設問も解答も与える語も設問文も含めて入れてみる。
-- 「モデルが実物を表現できる」ことは、動かして確かめないと分からない。
-- ============================================================================

create or replace function pg_temp.expect2(label text, actual anyelement, wanted anyelement)
returns void language plpgsql as $$
begin
  if actual is distinct from wanted then
    raise exception '✗ % … 期待 % / 実際 %', label, wanted, actual;
  end if;
  raise notice '✓ %', label;
end $$;

-- 下準備(superuser で。RLS は通さない)
insert into auth.users (id, email) values
  ('99999999-9999-9999-9999-999999999999', 'shape-trainer@example.com')
on conflict do nothing;
update public.profiles set role = 'trainer', display_name = '形の確認用'
  where id = '99999999-9999-9999-9999-999999999999';

-- ── 教材本体 ──────────────────────────────────────────────
insert into public.materials
  (id, title, level, kind, industry, visibility, status, teaching_point,
   instruction_ja, created_by)
values (
  'bbbbbbbb-0000-0000-0000-000000000001',
  '名詞 + to不定詞 =「〜すべき / 〜する必要のある」',
  'B1', 'pattern', 'business', 'school', 'published',
  'emails to reply to のように、reply to の to を落とさないこと。'
  'reply は reply to an email なので、最後の to が要る。',
  'to不定詞を「〜すべき」「〜する必要がある」という感覚で捉えること。',
  '99999999-9999-9999-9999-999999999999'
);

insert into public.material_tags (material_id, tag_id)
values ('bbbbbbbb-0000-0000-0000-000000000001', 'infinitive');

-- ── ① 英文和訳 ────────────────────────────────────────────
insert into public.material_sections (id, material_id, seq, exercise_type, instruction)
values ('cccccccc-0000-0000-0000-000000000001',
        'bbbbbbbb-0000-0000-0000-000000000001', 1, 'translate_en_ja',
        '次の英文を日本語に訳しなさい。to不定詞を「〜すべき」「〜する必要がある」という感覚で捉えること。');

insert into public.material_items (section_id, material_id, seq, prompt_en, answer, audio_text) values
 ('cccccccc-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000001',1,
  'I have several things to do before the meeting.',
  '会議の前にやるべきことがいくつかあります。',
  'I have several things to do before the meeting.'),
 ('cccccccc-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000001',2,
  'There are still many problems to solve.',
  'まだ解決すべき問題がたくさんあります。',
  'There are still many problems to solve.'),
 ('cccccccc-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000001',3,
  'She made a list of people to contact.',
  '彼女は連絡すべき人たちのリストを作りました。',
  'She made a list of people to contact.');

-- ── ② 穴埋め(与える語つき) ──────────────────────────────
insert into public.material_sections (id, material_id, seq, exercise_type, instruction)
values ('cccccccc-0000-0000-0000-000000000002',
        'bbbbbbbb-0000-0000-0000-000000000001', 2, 'fill_blank',
        'カッコ内の動詞を使って、to不定詞を完成させなさい。');

insert into public.material_items (section_id, material_id, seq, prompt_en, hint, answer, note) values
 ('cccccccc-0000-0000-0000-000000000002','bbbbbbbb-0000-0000-0000-000000000001',1,
  'I have a lot of emails (　　　) today.', 'reply to', 'to reply to',
  'reply to an email なので、最後の to を落とさない。'),
 ('cccccccc-0000-0000-0000-000000000002','bbbbbbbb-0000-0000-0000-000000000001',2,
  'There are several issues (　　　) before the meeting.', 'discuss', 'to discuss', null),
 ('cccccccc-0000-0000-0000-000000000002','bbbbbbbb-0000-0000-0000-000000000001',3,
  'Here is a list of customers (　　　).', 'contact', 'to contact', null);

-- ── ③ 和文英訳(解答例) ──────────────────────────────────
insert into public.material_sections (id, material_id, seq, exercise_type, instruction)
values ('cccccccc-0000-0000-0000-000000000003',
        'bbbbbbbb-0000-0000-0000-000000000001', 3, 'translate_ja_en',
        '「〜すべき○○」を、なるべく 名詞 + to不定詞 で表現しなさい。');

insert into public.material_items (section_id, material_id, seq, prompt_ja, answer, answer_alt, audio_text) values
 ('cccccccc-0000-0000-0000-000000000003','bbbbbbbb-0000-0000-0000-000000000001',1,
  '今日やるべきことがたくさんあります。',
  'I have a lot of things to do today.',
  E'I have many things to do today.\nThere are a lot of things to do today.',
  'I have a lot of things to do today.'),
 ('cccccccc-0000-0000-0000-000000000003','bbbbbbbb-0000-0000-0000-000000000001',2,
  'まだ解決すべき問題が2つあります。',
  'There are still two problems to solve.', null,
  'There are still two problems to solve.');

-- ── ④ リスニング + 理解 ──────────────────────────────────
insert into public.material_sections (id, material_id, seq, exercise_type, instruction)
values ('cccccccc-0000-0000-0000-000000000004',
        'bbbbbbbb-0000-0000-0000-000000000001', 4, 'listening',
        '英文は見ずに聞くこと。聞いたあとの質問に、英語または日本語で答えなさい。');

insert into public.material_items (section_id, material_id, seq, audio_text, question, answer) values
 ('cccccccc-0000-0000-0000-000000000004','bbbbbbbb-0000-0000-0000-000000000001',1,
  'I have three things to do before I leave the office.',
  'How many things does the speaker need to do?', 'Three.'),
 ('cccccccc-0000-0000-0000-000000000004','bbbbbbbb-0000-0000-0000-000000000001',2,
  'My manager gave me five documents to check by Friday.',
  'What does the speaker need to check?', 'Five documents.'),
 ('cccccccc-0000-0000-0000-000000000004','bbbbbbbb-0000-0000-0000-000000000001',3,
  'I have a lot of work to finish today, so I probably can''t leave early.',
  'Why can''t the speaker leave early?',
  'Because they have a lot of work to finish.');

-- ── 確かめる ──────────────────────────────────────────────
select pg_temp.expect2('教材に4つの演習が入る',
  (select count(*)::int from public.material_sections
   where material_id = 'bbbbbbbb-0000-0000-0000-000000000001'), 4);

select pg_temp.expect2('演習の種類が4つとも別',
  (select count(distinct exercise_type)::int from public.material_sections
   where material_id = 'bbbbbbbb-0000-0000-0000-000000000001'), 4);

select pg_temp.expect2('穴埋めの「与える語」が保てる',
  (select hint from public.material_items
   where section_id = 'cccccccc-0000-0000-0000-000000000002' and seq = 1), 'reply to');

select pg_temp.expect2('穴埋めの解答に to が残る(落としてはいけない to)',
  (select answer from public.material_items
   where section_id = 'cccccccc-0000-0000-0000-000000000002' and seq = 1), 'to reply to');

select pg_temp.expect2('1問ごとの注意書きが保てる',
  (select note from public.material_items
   where section_id = 'cccccccc-0000-0000-0000-000000000002' and seq = 1),
  'reply to an email なので、最後の to を落とさない。');

select pg_temp.expect2('和文英訳の別解が保てる',
  (select array_length(string_to_array(answer_alt, E'\n'), 1) from public.material_items
   where section_id = 'cccccccc-0000-0000-0000-000000000003' and seq = 1), 2);

select pg_temp.expect2('リスニングは英文を見せずに設問だけ出せる',
  (select count(*)::int from public.material_items
   where section_id = 'cccccccc-0000-0000-0000-000000000004'
     and prompt_en is null and question is not null and audio_text is not null), 3);

select pg_temp.expect2('教材全体の指導ポイントが保てる',
  (select teaching_point like '%reply to の to を落とさない%' from public.materials
   where id = 'bbbbbbbb-0000-0000-0000-000000000001'), true);

-- 音声を作る対象は audio_text がある問だけ。穴埋めには作らない。
select pg_temp.expect2('音声を作る対象は8問(穴埋めの3問は対象外)',
  (select count(*)::int from public.material_items
   where material_id = 'bbbbbbbb-0000-0000-0000-000000000001' and audio_text is not null), 8);

select pg_temp.expect2('設問の総数(実物は各10問なので、ここは抜粋の11問)',
  (select count(*)::int from public.material_items
   where material_id = 'bbbbbbbb-0000-0000-0000-000000000001'), 11);

-- 演習ごとに番号が1から振れる(教材全体での通し番号ではない)
select pg_temp.expect2('演習ごとに番号を1から振れる',
  (select count(*)::int from public.material_items
   where material_id = 'bbbbbbbb-0000-0000-0000-000000000001' and seq = 1), 4);
