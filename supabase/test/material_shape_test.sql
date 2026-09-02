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

-- ============================================================================
-- リーディング(記事)とダイアローグ(会話)が入るか(0010)
--
-- 「長文」で作ったら長文にならなかった件の作り直し。
-- 記事は段落の並び、会話は話者つきの発言の並びで持てることを確かめる。
-- ============================================================================

-- ── 記事 ──────────────────────────────────────────────────
insert into public.materials
  (id, title, level, kind, industry, visibility, status, headline, genre, topic, created_by)
values (
  'bbbbbbbb-0000-0000-0000-000000000002',
  '2026-08-27 / Why Small Teams Ship Faster / B1 / IT・技術',
  'B1', 'reading', 'it', 'school', 'published',
  'Why Small Teams Ship Faster',
  'trend',
  '少人数チームのほうが速く出せるのはなぜか',
  '99999999-9999-9999-9999-999999999999'
);

insert into public.material_sections (id, material_id, seq, exercise_type, instruction)
values ('cccccccc-0000-0000-0000-000000000011',
        'bbbbbbbb-0000-0000-0000-000000000002', 1, 'article',
        '記事を読んでください。声に出す練習は、下のボタンで切り替えられます。');

insert into public.material_items
  (material_id, section_id, seq, prompt_en, prompt_ja, audio_text)
values
  ('bbbbbbbb-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-000000000011', 1,
   'Last year, a payments company split its engineering group into teams of four. Six months later, the number of releases had tripled.',
   '昨年、ある決済会社はエンジニア部門を4人ずつのチームに分けた。半年後、リリースの回数は3倍になっていた。',
   'Last year, a payments company split its engineering group into teams of four. Six months later, the number of releases had tripled.'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-000000000011', 2,
   'The reason was not that the engineers worked longer hours. It was that fewer people had to agree before anything could move.',
   '理由は、エンジニアが長時間働くようになったからではない。何かを進める前に合意すべき人数が減ったからである。',
   'The reason was not that the engineers worked longer hours. It was that fewer people had to agree before anything could move.');

select pg_temp.expect2('記事は段落の並びとして入る',
  (select count(*)::int from public.material_items
   where section_id = 'cccccccc-0000-0000-0000-000000000011'), 2);

select pg_temp.expect2('記事の見出しが保てる',
  (select headline from public.materials
   where id = 'bbbbbbbb-0000-0000-0000-000000000002'), 'Why Small Teams Ship Faster');

select pg_temp.expect2('記事のジャンルが保てる',
  (select genre from public.materials
   where id = 'bbbbbbbb-0000-0000-0000-000000000002'), 'trend');

select pg_temp.expect2('段落は1文ではなく、まとまった長さで入る(40語以上)',
  (select min(array_length(string_to_array(prompt_en, ' '), 1))::int >= 20
   from public.material_items
   where section_id = 'cccccccc-0000-0000-0000-000000000011'), true);

-- ── 会話 ──────────────────────────────────────────────────
insert into public.materials
  (id, title, level, kind, industry, visibility, status, headline, scene, created_by)
values (
  'bbbbbbbb-0000-0000-0000-000000000003',
  '2026-08-27 / Did You Hear About the New Vendor? / B1 / IT・技術',
  'B1', 'dialogue', 'it', 'school', 'published',
  'Did You Hear About the New Vendor?',
  'gossip',
  '99999999-9999-9999-9999-999999999999'
);

insert into public.material_sections (id, material_id, seq, exercise_type)
values ('cccccccc-0000-0000-0000-000000000012',
        'bbbbbbbb-0000-0000-0000-000000000003', 1, 'dialogue');

insert into public.material_items
  (material_id, section_id, seq, speaker, prompt_en, prompt_ja)
values
  ('bbbbbbbb-0000-0000-0000-000000000003', 'cccccccc-0000-0000-0000-000000000012', 1,
   'Mika (QA Lead)', 'Hey, did you hear they picked a new vendor for the billing system?',
   'ねえ、請求システムの業者、新しいところに決まったって聞いた?'),
  ('bbbbbbbb-0000-0000-0000-000000000003', 'cccccccc-0000-0000-0000-000000000012', 2,
   'Dan (Backend Engineer)', 'No way. Already? I thought we were still comparing three of them.',
   'えっ、もう? まだ3社を比べてる途中だと思ってたけど。');

select pg_temp.expect2('会話は話者つきの発言として入る',
  (select count(*)::int from public.material_items
   where section_id = 'cccccccc-0000-0000-0000-000000000012' and speaker is not null), 2);

select pg_temp.expect2('話者に名前と肩書きが入る',
  (select speaker from public.material_items
   where section_id = 'cccccccc-0000-0000-0000-000000000012' and seq = 1), 'Mika (QA Lead)');

select pg_temp.expect2('会話の場面が保てる',
  (select scene from public.materials
   where id = 'bbbbbbbb-0000-0000-0000-000000000003'), 'gossip');

-- ── 旧「長文」は移されている ──────────────────────────────
select pg_temp.expect2('旧「長文」の教材は残っていない(reading に移した)',
  (select count(*)::int from public.materials where kind = 'passage'), 0);

-- ── ディスカッション(0033)──────────────────────────────
--
--   **正解が無い演習である。** 内容の理解とは違い `answer` は空のままで、
--   `note` に日本語の手がかりが入る。表がこれを受け付けるか確かめる
--   (0033 を貼る前は check constraint で弾かれていた・2026-09 実機)。
insert into public.material_sections (id, material_id, seq, exercise_type)
values ('cccccccc-0000-0000-0000-000000000013',
        'bbbbbbbb-0000-0000-0000-000000000003', 2, 'discussion');

insert into public.material_items
  (material_id, section_id, seq, question, note)
values
  ('bbbbbbbb-0000-0000-0000-000000000003', 'cccccccc-0000-0000-0000-000000000013', 1,
   'How do you usually hear about big decisions at your company?',
   '①社内で情報がどう伝わるかに絞る ②使える表現: word of mouth / find out from …');

select pg_temp.expect2('ディスカッションの演習が入る',
  (select count(*)::int from public.material_sections
   where id = 'cccccccc-0000-0000-0000-000000000013'), 1);

select pg_temp.expect2('ディスカッションは解答を持たない(正解が無い)',
  (select coalesce(answer, '') from public.material_items
   where section_id = 'cccccccc-0000-0000-0000-000000000013' and seq = 1), '');

select pg_temp.expect2('ディスカッションの手がかりは note に入る',
  (select note is not null from public.material_items
   where section_id = 'cccccccc-0000-0000-0000-000000000013' and seq = 1), true);


-- ── 誤り訂正(0034)──────────────────────────────────────
--
--   **穴埋めの置き換えである**(2026-09 利用者の指定)。
--   誤りのある英文と、直した英文まるごと、なぜ間違いかを持てるか。
--   0034 を貼る前は check constraint で弾かれていた。
insert into public.material_sections (id, material_id, seq, exercise_type)
values ('cccccccc-0000-0000-0000-000000000014',
        'bbbbbbbb-0000-0000-0000-000000000003', 3, 'error_correction');

insert into public.material_items
  (material_id, section_id, seq, prompt_en, answer, note)
values
  ('bbbbbbbb-0000-0000-0000-000000000003', 'cccccccc-0000-0000-0000-000000000014', 1,
   'I have a lot of emails to reply today.',
   'I have a lot of emails to reply to today.',
   'reply to an email なので、最後の to を落とさない。');

select pg_temp.expect2('誤り訂正の演習が入る',
  (select count(*)::int from public.material_sections
   where id = 'cccccccc-0000-0000-0000-000000000014'), 1);

select pg_temp.expect2('誤り訂正は、直した英文を1文まるごと持つ',
  (select answer from public.material_items
   where section_id = 'cccccccc-0000-0000-0000-000000000014' and seq = 1),
  'I have a lot of emails to reply to today.');

-- **穴埋めは一覧から消さない。** 消すと、すでに作った教材が開けなくなる
insert into public.material_sections (id, material_id, seq, exercise_type)
values ('cccccccc-0000-0000-0000-000000000015',
        'bbbbbbbb-0000-0000-0000-000000000003', 4, 'fill_blank');

select pg_temp.expect2('穴埋めは残っている(既存の教材のため)',
  (select count(*)::int from public.material_sections
   where id = 'cccccccc-0000-0000-0000-000000000015'), 1);
