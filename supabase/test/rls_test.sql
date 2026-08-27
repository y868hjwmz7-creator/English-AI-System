-- ============================================================================
-- RLS(アクセス制御)が意図どおりかを、実際に動かして確かめる。
--
-- ここが誤っていると、生徒が他人の記録を読めたり、教材を勝手に作れたりする。
-- 画面にボタンを出さないだけでは防げないので、必ずここで確認する。
--
-- 登場人物:
--   トレーナー   … 教材を作り、生徒Bを担当する
--   生徒B  … トレーナーの担当。教材が配信されている
--   生徒C  … トレーナーの担当ではない。何も配信されていない
-- ============================================================================

\set ON_ERROR_STOP on
\set QUIET on

-- 検証用の期待値チェック。合わなければその場で止まる。
create or replace function pg_temp.expect(label text, actual anyelement, wanted anyelement)
returns void language plpgsql as $$
begin
  if actual is distinct from wanted then
    raise exception '✗ % … 期待 % / 実際 %', label, wanted, actual;
  end if;
  raise notice '✓ %', label;
end $$;

-- ある操作が「拒否されること」を確かめる
create or replace function pg_temp.expect_denied(label text, stmt text)
returns void language plpgsql as $$
begin
  execute stmt;
  raise exception '✗ % … 拒否されるはずが、通ってしまった', label;
exception
  when insufficient_privilege or check_violation then raise notice '✓ % (拒否された)', label;
  when others then
    if sqlstate = '42501' then raise notice '✓ % (拒否された)', label;
    else raise; end if;
end $$;

-- ── 下準備(superuser として。RLS は適用されない) ─────────────
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'teacher@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'student-b@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'student-c@example.com');

-- トリガーで profiles が自動作成されているはず
select pg_temp.expect('サインアップで profiles が自動で作られる',
  (select count(*)::int from public.profiles), 3);

update public.profiles set role = 'admin', display_name = 'トレーナー'
  where id = '11111111-1111-1111-1111-111111111111';
update public.profiles set display_name = '生徒B' where id = '22222222-2222-2222-2222-222222222222';
update public.profiles set display_name = '生徒C' where id = '33333333-3333-3333-3333-333333333333';

insert into public.learner_admins (admin_id, learner_id)
  values ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');

-- 生徒Bと生徒Cそれぞれの学習記録
insert into public.study_logs (user_id, studied_on, minutes, category) values
  ('22222222-2222-2222-2222-222222222222', current_date, 30, '音読'),
  ('33333333-3333-3333-3333-333333333333', current_date, 30, '音読');

-- ── トレーナーとして ───────────────────────────────────────────────
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

insert into public.materials (id, title, level, kind, status, created_by)
values ('aaaaaaaa-0000-0000-0000-000000000001', '/l/ と /r/ の練習', 2, 'passage', 'published',
        '11111111-1111-1111-1111-111111111111');

insert into public.material_items (material_id, seq, text_en, text_ja)
values ('aaaaaaaa-0000-0000-0000-000000000001', 1, 'I collect the correct light.', '正しい光を集めます。');

insert into public.material_tags (material_id, tag_id)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'l-r');

insert into public.assignments (material_id, learner_id, assigned_by)
values ('aaaaaaaa-0000-0000-0000-000000000001',
        '22222222-2222-2222-2222-222222222222',
        '11111111-1111-1111-1111-111111111111');

select pg_temp.expect('トレーナーは自分の教材が見える',
  (select count(*)::int from public.materials), 1);
select pg_temp.expect('トレーナーは担当している生徒Bの学習記録が見える',
  (select count(*)::int from public.study_logs
   where user_id = '22222222-2222-2222-2222-222222222222'), 1);
select pg_temp.expect('トレーナーでも担当外の生徒Cの学習記録は見えない',
  (select count(*)::int from public.study_logs
   where user_id = '33333333-3333-3333-3333-333333333333'), 0);

select pg_temp.expect_denied('トレーナーでも担当外の生徒Cには配信できない', $$
  insert into public.assignments (material_id, learner_id, assigned_by)
  values ('aaaaaaaa-0000-0000-0000-000000000001',
          '33333333-3333-3333-3333-333333333333',
          '11111111-1111-1111-1111-111111111111') $$);

-- ── 生徒B として(配信されている) ───────────────────────────
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';

select pg_temp.expect('生徒Bは配信された教材が見える',
  (select count(*)::int from public.materials), 1);
select pg_temp.expect('生徒Bは教材の英文が見える',
  (select count(*)::int from public.material_items), 1);
select pg_temp.expect('生徒Bは自分の宿題が見える',
  (select count(*)::int from public.assignments), 1);
select pg_temp.expect('生徒Bは自分の学習記録だけが見える',
  (select count(*)::int from public.study_logs), 1);
select pg_temp.expect('生徒Bは弱点タグを読める',
  (select count(*)::int from public.weakness_tags), 38);

-- 生徒が「やった」を記録するのは許す
update public.assignments set learner_done_at = now();
select pg_temp.expect('生徒Bは「やった」を記録できる',
  (select count(*)::int from public.assignments where learner_done_at is not null), 1);

-- しかし他の欄は書き換えられない
select pg_temp.expect_denied('生徒Bは提出期限を書き換えられない', $$
  update public.assignments set due_on = current_date $$);
select pg_temp.expect_denied('生徒Bはトレーナーの確認印を偽装できない', $$
  update public.assignments set admin_checked_at = now() $$);

-- 教材は作れない
select pg_temp.expect_denied('生徒Bは教材を作れない', $$
  insert into public.materials (title, level, kind, created_by)
  values ('勝手に作った教材', 1, 'word', '22222222-2222-2222-2222-222222222222') $$);
select pg_temp.expect_denied('生徒Bは自分に宿題を配信できない', $$
  insert into public.assignments (material_id, learner_id, assigned_by)
  values ('aaaaaaaa-0000-0000-0000-000000000001',
          '22222222-2222-2222-2222-222222222222',
          '22222222-2222-2222-2222-222222222222') $$);
select pg_temp.expect_denied('生徒Bは自分をトレーナーに昇格できない', $$
  update public.profiles set role = 'admin'
  where id = '22222222-2222-2222-2222-222222222222' $$);

-- ── 生徒C として(何も配信されていない) ─────────────────────
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';

select pg_temp.expect('生徒Cには教材が見えない',
  (select count(*)::int from public.materials), 0);
select pg_temp.expect('生徒Cには教材の英文も見えない',
  (select count(*)::int from public.material_items), 0);
select pg_temp.expect('生徒Cには他人の宿題が見えない',
  (select count(*)::int from public.assignments), 0);
select pg_temp.expect('生徒Cには自分の学習記録だけが見える',
  (select count(*)::int from public.study_logs), 1);
select pg_temp.expect('生徒Cには他人のプロフィールが見えない',
  (select count(*)::int from public.profiles), 1);

-- ── ログインしていない状態 ───────────────────────────────────
reset role;
set role anon;
set request.jwt.claim.sub = '';

select pg_temp.expect('未ログインでは教材が見えない',
  (select count(*)::int from public.materials), 0);
select pg_temp.expect('未ログインでは学習記録が見えない',
  (select count(*)::int from public.study_logs), 0);
select pg_temp.expect('未ログインではプロフィールが見えない',
  (select count(*)::int from public.profiles), 0);
select pg_temp.expect('未ログインでは弱点タグも見えない',
  (select count(*)::int from public.weakness_tags), 0);

reset role;
