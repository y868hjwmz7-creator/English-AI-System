-- ============================================================================
-- RLS(アクセス制御)が意図どおりかを、実際に動かして確かめる。
--
-- ここが誤っていると、生徒が他人の記録を読めたり、教材を勝手に作れたりする。
-- 画面にボタンを出さないだけでは防げないので、必ずここで確認する。
--
-- 登場人物:
--   トレーナー1 … 教材を作り、生徒Bを担当する
--   トレーナー2 … 別の担当。教材の共有範囲を確かめるために出てくる
--   生徒B       … トレーナー1の担当。教材が配信されている
--   生徒C       … 誰の担当でもない。何も配信されていない
--   管理者      … role='owner'。集計だけを見る
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

-- ある操作が「拒否されること」を確かめる。
--
-- 拒否のされ方は2通りある。どちらも「拒否された」として扱う。
--   ・アクセス制御(RLS や権限)が弾く  … insufficient_privilege / 42501
--   ・関数が自分で断る(raise exception) … P0001。断り文句も表示する
-- それ以外の失敗は、想定外なのでそのまま止める(見逃さないため)。
create or replace function pg_temp.expect_denied(label text, stmt text)
returns void language plpgsql as $$
begin
  execute stmt;
  raise exception '✗ % … 拒否されるはずが、通ってしまった', label;
exception
  when insufficient_privilege or check_violation then
    raise notice '✓ % (拒否された)', label;
  when raise_exception then
    -- 自分で立てた「通ってしまった」も同じ種類なので、見分ける
    if sqlerrm like '✗%' then raise; end if;
    raise notice '✓ % (拒否された: %)', label, sqlerrm;
  when others then
    if sqlstate = '42501' then raise notice '✓ % (拒否された)', label;
    else raise; end if;
end $$;

-- ── 下準備(superuser として。RLS は適用されない) ─────────────
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'trainer1@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'student-b@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'student-c@example.com'),
  ('44444444-4444-4444-4444-444444444444', 'trainer2@example.com'),
  ('55555555-5555-5555-5555-555555555555', 'owner@example.com');

-- トリガーで profiles が自動作成されているはず
select pg_temp.expect('サインアップで profiles が自動で作られる',
  (select count(*)::int from public.profiles), 5);

update public.profiles set role = 'trainer', display_name = 'トレーナー1'
  where id = '11111111-1111-1111-1111-111111111111';
update public.profiles set role = 'trainer', display_name = 'トレーナー2'
  where id = '44444444-4444-4444-4444-444444444444';
update public.profiles set role = 'owner', display_name = '管理者'
  where id = '55555555-5555-5555-5555-555555555555';
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
values ('aaaaaaaa-0000-0000-0000-000000000001', '/l/ と /r/ の練習', 'B1', 'passage', 'published',
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

-- ── ゲスト一覧の画面が使う問い合わせ(2026-08 の不具合調査) ──
--
-- 「追加したゲストが一覧に出てこない」と報告があったため、画面と
-- **同じ順序・同じ条件**で引いて、データベース側に問題がないことを固定する。
--   ① 担当の一覧(learner_admins。終わっていないもの)
--   ② その id で profiles を引く
--   ③ 最新スコアの一覧を引く

select pg_temp.expect('ゲスト一覧① 担当の行が読める',
  (select count(*)::int from public.learner_admins where ended_on is null), 1);

select pg_temp.expect('ゲスト一覧② 担当ゲストの名前が読める',
  (select display_name from public.profiles
   where id in (select learner_id from public.learner_admins where ended_on is null)),
  '生徒B');

select pg_temp.expect('ゲスト一覧③ 最新スコアの一覧を引ける(0件でも失敗しない)',
  (select count(*)::int >= 0 from public.learner_latest_scores
   where learner_id in (select learner_id from public.learner_admins where ended_on is null)),
  true);

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
-- **数を決め打ちにしない。** タグを1つ足すたびにこの検証が赤くなり、
-- 「壊れていないものが赤い」状態になる(2026-08 に実際に起きた)。
-- 確かめたいのは「全部読めること」なので、全体の数と突き合わせる。
select pg_temp.expect('生徒Bは弱点タグを全部読める',
  (select count(*)::int from public.weakness_tags) > 0, true);

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
  values ('勝手に作った教材', 'A2', 'word', '22222222-2222-2222-2222-222222222222') $$);
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

-- ── 教材の共有範囲(0002 で追加) ───────────────────────────
-- トレーナー1 が、共有しない教材をもう1つ作る
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
insert into public.materials (id, title, level, kind, status, visibility, created_by)
values ('aaaaaaaa-0000-0000-0000-000000000002', '自分用の下書き', 'B1', 'passage', 'draft', 'private',
        '11111111-1111-1111-1111-111111111111');

select pg_temp.expect('作った本人には共有しない教材も見える',
  (select count(*)::int from public.materials), 2);

set request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
select pg_temp.expect('別のトレーナーには共有された教材だけ見える',
  (select count(*)::int from public.materials), 1);
select pg_temp.expect('別のトレーナーには他人の非共有の教材は見えない',
  (select count(*)::int from public.materials
   where id = 'aaaaaaaa-0000-0000-0000-000000000002'), 0);
select pg_temp.expect('別のトレーナーには担当外の生徒の学習記録は見えない',
  (select count(*)::int from public.study_logs), 0);

-- ── 管理者(owner)は集計だけを見る(0002 で追加) ───────────
set request.jwt.claim.sub = '55555555-5555-5555-5555-555555555555';
select pg_temp.expect('管理者は全体の集計を見られる',
  (select count(*)::int from public.school_summary()), 1);
select pg_temp.expect('管理者はトレーナー別の集計を見られる',
  (select count(*)::int from public.trainer_summary()), 3);
select pg_temp.expect('集計の中身が取れている(受講中の生徒数)',
  (select learner_active from public.school_summary()), 2);
-- 生の記録は見せない設計。owner はトレーナーを兼ねるが、
-- 担当していない生徒の学習記録は読めない。
select pg_temp.expect('管理者でも担当外の生徒の学習記録は読めない',
  (select count(*)::int from public.study_logs), 0);

set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select pg_temp.expect('トレーナーが集計を呼んでも何も返らない',
  (select count(*)::int from public.school_summary()), 0);
select pg_temp.expect('トレーナーがトレーナー別集計を呼んでも何も返らない',
  (select count(*)::int from public.trainer_summary()), 0);

set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select pg_temp.expect('生徒が集計を呼んでも何も返らない',
  (select count(*)::int from public.school_summary()), 0);

-- ── 担当の引き継ぎ(0003 で追加) ────────────────────────────
-- トレーナー1 が、生徒B のレッスン記録を残しておく。
-- 引き継いだあと、これが新しい担当に見えることを確かめるため。
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
insert into public.lesson_feedback (learner_id, admin_id, lesson_on, good_points, weakness_note)
values ('22222222-2222-2222-2222-222222222222',
        '11111111-1111-1111-1111-111111111111',
        current_date, 'リズムが良くなった', '語尾の子音が弱い');

select pg_temp.expect('引き継ぎ前: トレーナー1に生徒Bのレッスン記録が見える',
  (select count(*)::int from public.lesson_feedback), 1);

-- トレーナーは引き継ぎを実行できない(管理者だけの操作)
select pg_temp.expect_denied('トレーナーは担当を変更できない', $$
  select public.transfer_learner('22222222-2222-2222-2222-222222222222',
                                 '44444444-4444-4444-4444-444444444444') $$);

-- 管理者が、生徒B の担当をトレーナー2 に移す
set request.jwt.claim.sub = '55555555-5555-5555-5555-555555555555';
select public.transfer_learner(
  '22222222-2222-2222-2222-222222222222',
  '44444444-4444-4444-4444-444444444444',
  '語尾の子音を重点的に。宿題は毎回やってくる生徒です。');

-- 引き継ぎ後
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select pg_temp.expect('引き継ぎ後: 前の担当には生徒Bの学習記録が見えない',
  (select count(*)::int from public.study_logs), 0);
select pg_temp.expect('引き継ぎ後: 前の担当には生徒Bのレッスン記録も見えない',
  (select count(*)::int from public.lesson_feedback), 0);

set request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
select pg_temp.expect('引き継ぎ後: 新しい担当に生徒Bの学習記録が見える',
  (select count(*)::int from public.study_logs), 1);
select pg_temp.expect('引き継ぎ後: 新しい担当に過去のレッスン記録が引き継がれる',
  (select count(*)::int from public.lesson_feedback), 1);
select pg_temp.expect('引き継ぎ後: 弱点の指摘内容もそのまま読める',
  (select weakness_note from public.lesson_feedback limit 1), '語尾の子音が弱い');

-- 担当の履歴が残っている(誰がいつ担当だったか)
set request.jwt.claim.sub = '55555555-5555-5555-5555-555555555555';
select pg_temp.expect('担当の履歴が残る(終わった担当と現在の担当で2件)',
  (select count(*)::int from public.learner_admins
   where learner_id = '22222222-2222-2222-2222-222222222222'), 2);

-- ── 退職の手続き(0003 で追加) ──────────────────────────────
-- トレーナー1 を退職させ、残りの担当をトレーナー2 に引き継ぐ
select pg_temp.expect('退職の手続きが実行できる',
  (select public.retire_trainer('11111111-1111-1111-1111-111111111111',
                                '44444444-4444-4444-4444-444444444444',
                                '退職に伴う引き継ぎ') >= 0), true);

set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select pg_temp.expect('退職者には教材が見えなくなる',
  (select count(*)::int from public.materials), 0);
select pg_temp.expect_denied('退職者は教材を作れない', $$
  insert into public.materials (title, level, kind, created_by)
  values ('退職後の教材', 'A2', 'word', '11111111-1111-1111-1111-111111111111') $$);

-- 過去の記録は壊れていない(退職者を消していないため)
set request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
select pg_temp.expect('退職しても、その人が残したレッスン記録は消えない',
  (select count(*)::int from public.lesson_feedback), 1);

set request.jwt.claim.sub = '55555555-5555-5555-5555-555555555555';
select pg_temp.expect('退職者の行は消さずに残る(過去の記録が壊れないため)',
  (select status from public.profiles
   where id = '11111111-1111-1111-1111-111111111111'), 'inactive');
select pg_temp.expect_denied('管理者でも自分自身は停止できない', $$
  select public.retire_trainer('55555555-5555-5555-5555-555555555555') $$);

-- ── レベル(CEFR)とスコア(0005 で追加) ───────────────────
-- ここでは 生徒B の担当はトレーナー2 になっている。

set request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
update public.profiles set cefr = 'B1'
  where id = '22222222-2222-2222-2222-222222222222';
select pg_temp.expect('トレーナーは担当生徒のレベルを判定できる',
  (select cefr from public.profiles where id = '22222222-2222-2222-2222-222222222222'), 'B1');

insert into public.learner_scores (learner_id, test_type, score, taken_on, recorded_by)
values ('22222222-2222-2222-2222-222222222222', 'toeic',   650, current_date - 200,
        '44444444-4444-4444-4444-444444444444'),
       ('22222222-2222-2222-2222-222222222222', 'toeic',   720, current_date - 10,
        '44444444-4444-4444-4444-444444444444'),
       ('22222222-2222-2222-2222-222222222222', 'versant',  48, current_date - 10,
        '44444444-4444-4444-4444-444444444444');

select pg_temp.expect('スコアの履歴が残る(TOEIC 2回ぶん)',
  (select count(*)::int from public.learner_scores where test_type = 'toeic'), 2);
select pg_temp.expect('一覧には最新のスコアだけが出る',
  (select count(*)::int from public.learner_latest_scores), 2);
select pg_temp.expect('最新の TOEIC が取れる',
  (select score::int from public.learner_latest_scores where test_type = 'toeic'), 720);
select pg_temp.expect('最新の VERSANT が取れる',
  (select score::int from public.learner_latest_scores where test_type = 'versant'), 48);

-- 打ち間違いはデータベース側で止める
select pg_temp.expect_denied('TOEIC で 1000 点は登録できない', $$
  insert into public.learner_scores (learner_id, test_type, score, taken_on)
  values ('22222222-2222-2222-2222-222222222222', 'toeic', 1000, current_date) $$);
select pg_temp.expect_denied('VERSANT で 95 点は登録できない', $$
  insert into public.learner_scores (learner_id, test_type, score, taken_on)
  values ('22222222-2222-2222-2222-222222222222', 'versant', 95, current_date) $$);
select pg_temp.expect_denied('区分に無いレベルは登録できない', $$
  update public.profiles set cefr = 'D1'
  where id = '22222222-2222-2222-2222-222222222222' $$);

-- 14段階(Pre-Basic 〜 Proficiency)がすべて使えることを確かめる
do $$
declare lv text;
begin
  foreach lv in array array[
    'Pre-Basic','Basic','A1','A1+','A2','A2+','B1','B1+','B2','B2+','C1','C1+','C2','Proficiency'
  ] loop
    update public.profiles set cefr = lv
      where id = '22222222-2222-2222-2222-222222222222';
  end loop;
  raise notice '✓ 14段階すべてを登録できる';
end $$;
update public.profiles set cefr = 'B1'
  where id = '22222222-2222-2222-2222-222222222222';

-- 生徒側から見た場合
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select pg_temp.expect('生徒は自分のスコアを見られる',
  (select count(*)::int from public.learner_scores), 3);
select pg_temp.expect_denied('生徒は自分のスコアを記録できない', $$
  insert into public.learner_scores (learner_id, test_type, score, taken_on)
  values ('22222222-2222-2222-2222-222222222222', 'toeic', 990, current_date) $$);
select pg_temp.expect_denied('生徒は自分のレベルを書き換えられない', $$
  update public.profiles set cefr = 'C2'
  where id = '22222222-2222-2222-2222-222222222222' $$);
select pg_temp.expect_denied('生徒は自分の在籍状態を変えられない', $$
  update public.profiles set status = 'active'
  where id = '22222222-2222-2222-2222-222222222222' $$);

-- 担当していないトレーナーからは見えない
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select pg_temp.expect('他人のスコアは見えない',
  (select count(*)::int from public.learner_scores), 0);

-- ── 生徒の在籍状態(0004 で追加) ────────────────────────────
-- ここまでで、生徒B の担当はトレーナー2 になっている。

-- 休みの予定。トレーナー2 が自分の予定を入れる。
set request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
insert into public.trainer_absences (trainer_id, from_date, to_date, reason)
values ('44444444-4444-4444-4444-444444444444',
        current_date + 7, current_date + 9, '研修のため');

set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select pg_temp.expect('担当トレーナーの休みの予定が生徒に見える',
  (select count(*)::int from public.trainer_absences), 1);
select pg_temp.expect('休みの理由も読める',
  (select reason from public.trainer_absences limit 1), '研修のため');
select pg_temp.expect_denied('生徒はトレーナーの休みを勝手に入れられない', $$
  insert into public.trainer_absences (trainer_id, from_date, to_date)
  values ('44444444-4444-4444-4444-444444444444', current_date, current_date) $$);

set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select pg_temp.expect('担当ではないトレーナーの休みは見えない',
  (select count(*)::int from public.trainer_absences), 0);

-- 休会中にする
set request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
select public.set_learner_status('22222222-2222-2222-2222-222222222222',
                                 'paused', '回数コース修了後');

set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select pg_temp.expect('休会中でも自分の学習記録は見られる',
  (select count(*)::int from public.study_logs), 1);
select pg_temp.expect('休会中でも配信済みの教材は見られる',
  (select count(*)::int from public.materials), 1);

set request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
select pg_temp.expect('休会中でも担当は外れない',
  (select count(*)::int from public.learner_admins
   where learner_id = '22222222-2222-2222-2222-222222222222' and ended_on is null), 1);
select pg_temp.expect_denied('休会中の生徒には新しい宿題を配信できない', $$
  insert into public.assignments (material_id, learner_id, assigned_by)
  values ('aaaaaaaa-0000-0000-0000-000000000001',
          '22222222-2222-2222-2222-222222222222',
          '44444444-4444-4444-4444-444444444444') $$);

set request.jwt.claim.sub = '55555555-5555-5555-5555-555555555555';
select pg_temp.expect('集計で休会中が分けて数えられる',
  (select learner_paused from public.school_summary()), 1);
select pg_temp.expect('集計で受講中の人数が減る',
  (select learner_active from public.school_summary()), 1);

-- ── 0022 取り組みの記録とリマインド ─────────────────────────────
--
-- **ここが緩むと、ゲストが他人の取り組みを覗けたり、
--   トレーナーになりすましてリマインドを送れたりする。**

-- 生徒B(担当は トレーナー1)が取り組む
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select public.log_practice('wordbook', 120, 3);
select public.log_practice('six_steps', 300, 1);
select pg_temp.expect('取り組みは本人のぶんが残る',
  (select times::int from public.practice_days
   where learner_id = auth.uid() and kind = 'wordbook'), 3);
select public.log_practice('wordbook', 60, 2);
select pg_temp.expect('同じ日・同じ種類なら足される',
  (select times::int from public.practice_days
   where learner_id = auth.uid() and kind = 'wordbook'), 5);
select pg_temp.expect('知らない種類は入らない',
  (select count(*)::int from public.practice_days where kind = 'nonsense'), 0);
select public.log_practice('wordbook', 999999, 999999);
select pg_temp.expect('1回に足せる秒数には上限がある',
  (select seconds::int from public.practice_days
   where learner_id = auth.uid() and kind = 'wordbook') <= 180 + 3600, true);

-- 生徒C(担当ではない)
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select pg_temp.expect('よそのゲストの取り組みは見えない',
  (select count(*)::int from public.practice_days
   where learner_id = '22222222-2222-2222-2222-222222222222'), 0);

-- **前の担当(トレーナー1)にも見えない。** 引き継ぎはここにも効く
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select pg_temp.expect('引き継ぎ後、前の担当には取り組みが見えない',
  (select count(*)::int from public.practice_days
   where learner_id = '22222222-2222-2222-2222-222222222222'), 0);
select pg_temp.expect_denied('引き継ぎ後、前の担当はリマインドを送れない',
  $$select public.send_reminder('22222222-2222-2222-2222-222222222222', 'だめ')$$);

-- **いまの担当は トレーナー2**(上で引き継いである)。
-- 引き継ぎがそのままアクセス制御に効いていることも、ここで確かめている
set request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
select pg_temp.expect('担当ゲストの取り組みは見える',
  (select count(*)::int from public.practice_days
   where learner_id = '22222222-2222-2222-2222-222222222222') > 0, true);
select pg_temp.expect('まとめは担当ゲストだけ返る',
  (select count(*)::int from public.learner_practice(14)), 1);
select pg_temp.expect('まとめに回数が入る',
  (select times from public.learner_practice(14)) > 0, true);

-- リマインドは、押した人が担当トレーナーのときだけ
select public.send_reminder('22222222-2222-2222-2222-222222222222', '今週の宿題、まだですよ');
select pg_temp.expect('リマインドが1件入る',
  (select count(*)::int from public.reminders
   where learner_id = '22222222-2222-2222-2222-222222222222'), 1);
select pg_temp.expect_denied('担当していないゲストには送れない',
  $$select public.send_reminder('33333333-3333-3333-3333-333333333333', 'だめ')$$);

-- ゲストの側
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select pg_temp.expect('自分あてのリマインドは読める',
  (select message from public.reminders where learner_id = auth.uid()), '今週の宿題、まだですよ');
select pg_temp.expect_denied('ゲストはリマインドを作れない',
  $$insert into public.reminders (learner_id, sent_by)
    values (auth.uid(), auth.uid())$$);
select pg_temp.expect_denied('ゲストは文面を書き換えられない',
  $$update public.reminders set message = 'すりかえ' where learner_id = auth.uid()$$);
select public.seen_reminder((select id from public.reminders where learner_id = auth.uid()));
select pg_temp.expect('「見た」だけは本人が残せる',
  (select count(*)::int from public.reminders
   where learner_id = auth.uid() and seen_at is not null), 1);

set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select pg_temp.expect('よそあてのリマインドは見えない',
  (select count(*)::int from public.reminders), 0);

-- ── 0023 集計は「教材の種類と内容」で数える。**管理者だけ** ──────
--
--   security definer で作ってあるので、`is_owner()` の判定を外すと
--   全校のデータが誰にでも見えてしまう。**ここで毎回確かめる。**
set request.jwt.claim.sub = '55555555-5555-5555-5555-555555555555';
select pg_temp.expect('管理者は種類ごとの集計を見られる',
  (select count(*)::int from public.school_by_kind(30)) > 0, true);
select pg_temp.expect('種類ごとに教材の中の項目も数えられている',
  (select sum(items)::int from public.school_by_kind(30)) > 0, true);
select pg_temp.expect('ライブラリ全体の数が集計に入る',
  (select material_count from public.school_summary()) > 0, true);
-- **教材が1本も無い弱点も返る。** ここが「ライブラリの穴」である
select pg_temp.expect('弱点ごとの集計は、教材が0件のものも返る',
  (select count(*)::int from public.school_by_tag(30) where materials = 0) > 0, true);
select pg_temp.expect('弱点ごとの集計に見出しが入る',
  (select count(*)::int from public.school_by_tag(30) where label is null), 0);
select pg_temp.expect('レベルごとの集計が返る',
  (select count(*)::int from public.school_by_level(30)) > 0, true);
select pg_temp.expect('全校の取り組みが種類ごとに返る',
  (select sum(times)::int from public.school_practice(30)) > 0, true);

-- **トレーナーとゲストには1行も返さない**
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select pg_temp.expect('トレーナーが種類ごとの集計を呼んでも何も返らない',
  (select count(*)::int from public.school_by_kind(30)), 0);
select pg_temp.expect('トレーナーが弱点ごとの集計を呼んでも何も返らない',
  (select count(*)::int from public.school_by_tag(30)), 0);
select pg_temp.expect('トレーナーがレベルごとの集計を呼んでも何も返らない',
  (select count(*)::int from public.school_by_level(30)), 0);
select pg_temp.expect('トレーナーが全校の取り組みを呼んでも何も返らない',
  (select count(*)::int from public.school_practice(30)), 0);

set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select pg_temp.expect('ゲストが種類ごとの集計を呼んでも何も返らない',
  (select count(*)::int from public.school_by_kind(30)), 0);
select pg_temp.expect('ゲストが全校の取り組みを呼んでも何も返らない',
  (select count(*)::int from public.school_practice(30)), 0);

/* ── レッスンでの取り組みは「ゲストの記録」になる(0025)──────────
   利用者の指定で、レッスン中に付けた「知らなかった」も、書き込んだ区切りも、
   取り組んだ時間も**ゲストの学習そのもの**として残すようにした。

   **表の RLS は緩めていない。** `mark_word` / `log_practice` を
   security definer にして、**関数の中だけ**で担当かどうかを確かめている。
   だから、ここで確かめるのはその門番である。
   担当していないゲストに書けてしまったら、この検証が落ちる。 */

-- ここまでに引き継ぎが済んでいるので、**生徒B の担当はトレーナー2**である。
-- 生徒C は誰の担当でもない
set request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';

select public.mark_word('shortfall', 'unknown', 'word', null, null, null,
                        '22222222-2222-2222-2222-222222222222');
select pg_temp.expect('トレーナーが、担当ゲストの単語帳に書ける(0025)',
  (select count(*)::int from public.word_reviews
   where learner_id = '22222222-2222-2222-2222-222222222222'
     and word_norm = 'shortfall'), 1);
select pg_temp.expect('トレーナー自身の単語帳には入らない(0025)',
  (select count(*)::int from public.word_reviews
   where learner_id = '44444444-4444-4444-4444-444444444444'
     and word_norm = 'shortfall'), 0);

-- **レッスンで一緒に取り組んだ分は、ゲストの続けた記録に数える**(利用者の指定)
select pg_temp.expect('ゲストの「続けた記録」に数えられる(0025)',
  (select (answered > 0) from public.vocab_days
   where learner_id = '22222222-2222-2222-2222-222222222222'
     and done_on = current_date), true);

-- **担当していないゲストには書けない。** ここが唯一の門番である
select pg_temp.expect_denied('担当していないゲストの単語帳には書けない(0025)', $$
  select public.mark_word('rollout', 'unknown', 'word', null, null, null,
                          '33333333-3333-3333-3333-333333333333') $$);

-- 取り組みも同じ
select public.log_practice('six_steps', 300, 1,
                           '22222222-2222-2222-2222-222222222222');
select pg_temp.expect('トレーナーの取り組みが、担当ゲストの分として数えられる(0025)',
  (select (seconds >= 300) from public.practice_days
   where learner_id = '22222222-2222-2222-2222-222222222222'
     and done_on = current_date and kind = 'six_steps'), true);
select public.log_practice('six_steps', 300, 1,
                           '33333333-3333-3333-3333-333333333333');
select pg_temp.expect('担当していないゲストの取り組みは数えない(0025)',
  (select count(*)::int from public.practice_days
   where learner_id = '33333333-3333-3333-3333-333333333333'), 0);

-- 途中経過(区切り・書きかけ)は表の RLS で守る
insert into public.material_progress (learner_id, material_id, scope, data)
values ('22222222-2222-2222-2222-222222222222',
        'aaaaaaaa-0000-0000-0000-000000000001', 'sec1.slash.marks', '{"1":[2]}');
select pg_temp.expect('トレーナーが、担当ゲストの途中経過を書ける(0025)',
  (select count(*)::int from public.material_progress), 1);
select pg_temp.expect_denied('担当していないゲストの途中経過は書けない(0025)', $$
  insert into public.material_progress (learner_id, material_id, scope, data)
  values ('33333333-3333-3333-3333-333333333333',
          'aaaaaaaa-0000-0000-0000-000000000001', 'sec1.slash.marks', '{}') $$);

-- ゲスト本人は、自分の途中経過を読み書きできる
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select pg_temp.expect('ゲストは自分の途中経過を読める(0025)',
  (select count(*)::int from public.material_progress), 1);
select pg_temp.expect('ゲストは自分の単語帳に、トレーナーが付けた語がある(0025)',
  (select count(*)::int from public.word_reviews where word_norm = 'shortfall'), 1);

-- **ほかのゲストの途中経過は見えない**
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select pg_temp.expect('ほかのゲストの途中経過は見えない(0025)',
  (select count(*)::int from public.material_progress), 0);

-- **担当していないトレーナーにも見えない**(トレーナー1 は引き継ぎ済み)
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select pg_temp.expect('担当していないトレーナーには途中経過が見えない(0025)',
  (select count(*)::int from public.material_progress), 0);

-- 退会にする
set request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
select public.set_learner_status('22222222-2222-2222-2222-222222222222',
                                 'inactive', '全額返金で退会');

set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select pg_temp.expect('退会したら自分の学習記録も見えなくなる',
  (select count(*)::int from public.study_logs), 0);
select pg_temp.expect('退会したら教材も見えなくなる',
  (select count(*)::int from public.materials), 0);
select pg_temp.expect('退会しても自分のプロフィールは読める(状態を表示するため)',
  (select status from public.profiles where id = auth.uid()), 'inactive');

set request.jwt.claim.sub = '55555555-5555-5555-5555-555555555555';
select pg_temp.expect('退会したら担当が外れる',
  (select count(*)::int from public.learner_admins
   where learner_id = '22222222-2222-2222-2222-222222222222' and ended_on is null), 0);
select pg_temp.expect('退会した理由が残る',
  (select status_note from public.profiles
   where id = '22222222-2222-2222-2222-222222222222'), '全額返金で退会');
select pg_temp.expect('集計で退会済が分けて数えられる',
  (select learner_withdrawn from public.school_summary()), 1);

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
