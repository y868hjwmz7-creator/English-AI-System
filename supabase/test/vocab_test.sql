-- ============================================================================
-- 語彙の定着(0011)が意図どおりか確かめる
--
-- 確かめること:
--   ・語のそろえ方(大文字小文字・前後の記号・中の「'」「-」)
--   ・意味の控え(word_glosses)は誰でも読めるが、**誰も書き込めない**
--   ・「知っていた / 知らなかった」は本人だけが書ける
--   ・**他人の行を作れない・書き換えられない**
--   ・担当トレーナーは読めるが、書き換えられない
--   ・担当外のトレーナーは読めない
--   ・review_words() は担当外を拒否する
--   ・homework_words() は配信済みの語句だけを返し、担当外を拒否する
-- ============================================================================

create or replace function pg_temp.ok(label text, actual anyelement, wanted anyelement)
returns void language plpgsql as $$
begin
  if actual is distinct from wanted then
    raise exception '✗ % … 期待 % / 実際 %', label, wanted, actual;
  end if;
  raise notice '✓ %', label;
end $$;

create or replace function pg_temp.denied(label text, stmt text)
returns void language plpgsql as $$
begin
  execute stmt;
  raise exception '✗ % … 通ってしまった', label;
exception
  when insufficient_privilege or foreign_key_violation or check_violation then
    raise notice '✓ % (拒否された)', label;
  when raise_exception then
    if sqlerrm like '✗%' then raise; end if;
    raise notice '✓ % (拒否された: %)', label, sqlerrm;
end $$;

-- ── 下準備(superuser) ───────────────────────────────────────
insert into auth.users (id, email) values
  ('e1111111-1111-1111-1111-111111111111', 'vocab-trainer@example.com'),
  ('e9999999-9999-9999-9999-999999999999', 'vocab-other-trainer@example.com'),
  ('e2222222-2222-2222-2222-222222222222', 'vocab-guest-a@example.com'),
  ('e3333333-3333-3333-3333-333333333333', 'vocab-guest-b@example.com');

update public.profiles set role = 'trainer', display_name = 'トレーナー'
  where id in ('e1111111-1111-1111-1111-111111111111',
               'e9999999-9999-9999-9999-999999999999');
update public.profiles set display_name = 'ゲストA'
  where id = 'e2222222-2222-2222-2222-222222222222';
update public.profiles set display_name = 'ゲストB'
  where id = 'e3333333-3333-3333-3333-333333333333';

insert into public.learner_admins (admin_id, learner_id) values
  ('e1111111-1111-1111-1111-111111111111', 'e2222222-2222-2222-2222-222222222222');

-- 意味の控えを1つ置く(本番では Edge Function が service_role で入れる)
insert into public.word_glosses (word_norm, display, pos, meaning_ja, example_en)
values ('deployment', 'deployment', '名詞', '(システムの)配置・リリース',
        'The deployment failed last night.');

-- ── 語のそろえ方 ──────────────────────────────────────────────
select pg_temp.ok('大文字小文字をそろえる',
  public.norm_word('Deployment') = public.norm_word('deployment'), true);

select pg_temp.ok('前後の記号を落とす',
  public.norm_word('"deployment,"') = 'deployment', true);

select pg_temp.ok('中の「''」は残す(don''t を1語として扱う)',
  public.norm_word('Don''t'), 'don''t');

select pg_temp.ok('中の「-」は残す(well-known を1語として扱う)',
  public.norm_word('well-known'), 'well-known');

select pg_temp.ok('記号だけの文字列は語にしない',
  public.norm_word('---'), null::text);

select pg_temp.ok('日本語だけの文字列は語にしない',
  public.norm_word('配置'), null::text);

-- ── ゲストAとして ─────────────────────────────────────────────
set role authenticated;
set request.jwt.claim.sub = 'e2222222-2222-2222-2222-222222222222';

select pg_temp.ok('意味の控えは読める',
  (select meaning_ja from public.word_glosses where word_norm = 'deployment'),
  '(システムの)配置・リリース');

select pg_temp.denied('意味の控えは書き込めない(勝手な意味を混ぜられない)',
  $$insert into public.word_glosses (word_norm, display, pos, meaning_ja)
    values ('hack', 'hack', '動詞', 'でたらめ')$$);

-- 書き換えは、許すポリシーが無ければ**0行で静かに終わる**(エラーにならない)。
-- 「拒否された」ではなく「変わっていない」で確かめる。
update public.word_glosses set meaning_ja = 'でたらめ' where word_norm = 'deployment';
select pg_temp.ok('意味の控えは書き換えられない(値が変わらない)',
  (select meaning_ja from public.word_glosses where word_norm = 'deployment'),
  '(システムの)配置・リリース');

delete from public.word_glosses where word_norm = 'deployment';
select pg_temp.ok('意味の控えは消せない',
  (select count(*)::int from public.word_glosses where word_norm = 'deployment'), 1);

insert into public.word_reviews (learner_id, word_norm, status)
values ('e2222222-2222-2222-2222-222222222222', 'deployment', 'unknown');

select pg_temp.ok('自分の「知らなかった」は付けられる',
  (select status from public.word_reviews
   where learner_id = 'e2222222-2222-2222-2222-222222222222'
     and word_norm = 'deployment'), 'unknown');

update public.word_reviews set status = 'known', updated_at = now()
 where learner_id = 'e2222222-2222-2222-2222-222222222222' and word_norm = 'deployment';

select pg_temp.ok('自分の申告は「知っていた」に変えられる',
  (select status from public.word_reviews
   where learner_id = 'e2222222-2222-2222-2222-222222222222'
     and word_norm = 'deployment'), 'known');

select pg_temp.denied('決められた値しか入らない(known / unknown のみ)',
  $$insert into public.word_reviews (learner_id, word_norm, status)
    values ('e2222222-2222-2222-2222-222222222222', 'maybe', 'たぶん')$$);

select pg_temp.denied('他人の行は作れない',
  $$insert into public.word_reviews (learner_id, word_norm, status)
    values ('e3333333-3333-3333-3333-333333333333', 'deployment', 'known')$$);

-- 戻しておく(以降の確認で unknown が要る)
update public.word_reviews set status = 'unknown'
 where learner_id = 'e2222222-2222-2222-2222-222222222222';

select pg_temp.ok('自分の復習語は自分でも取り出せる',
  (select count(*)::int from public.review_words(
     'e2222222-2222-2222-2222-222222222222', 'unknown', 40)), 1);

select pg_temp.denied('他のゲストの復習語は取り出せない',
  $$select * from public.review_words(
      'e3333333-3333-3333-3333-333333333333', 'unknown', 40)$$);

-- ── ゲストBとして ─────────────────────────────────────────────
set request.jwt.claim.sub = 'e3333333-3333-3333-3333-333333333333';

select pg_temp.ok('他のゲストの申告は見えない',
  (select count(*)::int from public.word_reviews
   where learner_id = 'e2222222-2222-2222-2222-222222222222'), 0);

-- 書き換えは、許すポリシーが無ければ**0行で静かに終わる**(エラーにならない)。
-- 「変わっていない」ことで確かめる。**ここを「拒否されるはず」と書くと、
-- 実際には守られているのに赤くなる。**
update public.word_reviews set status = 'known'
 where learner_id = 'e2222222-2222-2222-2222-222222222222';
set role postgres;
select pg_temp.ok('他のゲストの申告は変わっていない',
  (select status from public.word_reviews
   where learner_id = 'e2222222-2222-2222-2222-222222222222'
     and word_norm = 'deployment'), 'unknown');

-- ── 教材を作って配信する(担当トレーナー) ─────────────────────
set role authenticated;
set request.jwt.claim.sub = 'e1111111-1111-1111-1111-111111111111';

insert into public.materials (id, title, level, kind, status, created_by)
values ('eeeeeeee-0000-0000-0000-000000000001', '単語 / B1', 'B1', 'word', 'published',
        'e1111111-1111-1111-1111-111111111111');

insert into public.material_sections (id, material_id, seq, exercise_type)
values ('eeeeeeee-1111-0000-0000-000000000001',
        'eeeeeeee-0000-0000-0000-000000000001', 1, 'vocabulary');

insert into public.material_items (material_id, section_id, seq, prompt_en, prompt_ja)
values
  ('eeeeeeee-0000-0000-0000-000000000001', 'eeeeeeee-1111-0000-0000-000000000001', 1,
   'deployment', '(システムの)配置'),
  ('eeeeeeee-0000-0000-0000-000000000001', 'eeeeeeee-1111-0000-0000-000000000001', 2,
   'rollback', '巻き戻し');

insert into public.assignments (material_id, learner_id, assigned_by)
values ('eeeeeeee-0000-0000-0000-000000000001',
        'e2222222-2222-2222-2222-222222222222',
        'e1111111-1111-1111-1111-111111111111');

select pg_temp.ok('担当ゲストの復習語を読める',
  (select count(*)::int from public.review_words(
     'e2222222-2222-2222-2222-222222222222', 'unknown', 40)), 1);

select pg_temp.ok('復習語には意味と品詞が付いてくる',
  (select pos from public.review_words(
     'e2222222-2222-2222-2222-222222222222', 'unknown', 40)), '名詞');

select pg_temp.ok('配信した語句を取り出せる',
  (select count(*)::int from public.homework_words(
     'e2222222-2222-2222-2222-222222222222', 200)), 2);

select pg_temp.ok('取り出した語には、その子の申告が付いてくる',
  (select status from public.homework_words(
     'e2222222-2222-2222-2222-222222222222', 200)
   where word_norm = 'deployment'), 'unknown');

-- トレーナーは読めるが書き換えられない。ここも0行で終わる
update public.word_reviews set status = 'known'
 where learner_id = 'e2222222-2222-2222-2222-222222222222';

set role postgres;
select pg_temp.ok('トレーナーが書き換えようとしても変わっていない',
  (select status from public.word_reviews
   where learner_id = 'e2222222-2222-2222-2222-222222222222'
     and word_norm = 'deployment'), 'unknown');

-- ── 担当外のトレーナーとして ──────────────────────────────────
set role authenticated;
set request.jwt.claim.sub = 'e9999999-9999-9999-9999-999999999999';

select pg_temp.ok('担当外のゲストの申告は見えない',
  (select count(*)::int from public.word_reviews
   where learner_id = 'e2222222-2222-2222-2222-222222222222'), 0);

select pg_temp.denied('担当外のゲストの復習語は取り出せない',
  $$select * from public.review_words(
      'e2222222-2222-2222-2222-222222222222', 'unknown', 40)$$);

select pg_temp.denied('担当外のゲストの宿題の語は取り出せない',
  $$select * from public.homework_words(
      'e2222222-2222-2222-2222-222222222222', 200)$$);

reset role;
