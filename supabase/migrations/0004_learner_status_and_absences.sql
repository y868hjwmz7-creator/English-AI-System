-- ============================================================================
-- English AI System — 生徒の在籍状態と、トレーナーの休みの予定
--
-- 【これは何か】
--   0001 → 0002 → 0003 に続く4つ目の追加変更です。
--   前のものを置き換えません。順に実行してください。
--
-- 【何が変わるか】
--   1. 生徒の在籍状態が3つになる(受講中 / 休会中 / 退会済)
--   2. 休会中は自分の記録を見られるが、新しい宿題は配信されない
--   3. 退会済は何も見えない
--   4. トレーナーの休みの予定を、担当している生徒が見られるようになる
-- ============================================================================

-- ────────────────────────────────────────────────────────────────
-- 1. 在籍状態を3つにする
--
--   0003 では active / inactive の2つだった。
--   生徒には「休会中」という、その中間の状態がある。
--
--   | status   | 生徒            | トレーナー |
--   |----------|-----------------|-----------|
--   | active   | 受講中          | 在籍中     |
--   | paused   | 休会中          | (使わない) |
--   | inactive | 退会済          | 退職       |
-- ────────────────────────────────────────────────────────────────

alter table public.profiles drop constraint if exists profiles_status_check;
alter table public.profiles
  add constraint profiles_status_check check (status in ('active', 'paused', 'inactive'));

alter table public.profiles
  add column if not exists status_note text,
  add column if not exists status_changed_at timestamptz not null default now();

comment on column public.profiles.status is
  '生徒: active=受講中 / paused=休会中 / inactive=退会済。'
  'トレーナー: active=在籍中 / inactive=退職。行は消さない。';
comment on column public.profiles.status_note is
  '状態を変えた理由。例「月額コース休止中」「回数コース修了後」「全額返金で退会」';

-- 使える人かどうか(休会中は使える。退会済・退職は使えない)
create or replace function public.can_use()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and status in ('active', 'paused')
  );
$$;

-- ────────────────────────────────────────────────────────────────
-- 2. 退会した生徒には見えないようにする
--
--   0001 のポリシーは「自分の行かどうか」しか見ていなかった。
--   退会しても自分の記録が見え続けてしまうため、状態の確認を足す。
--
--   ※ profiles(自分の名前と状態)だけは読めるままにする。
--     読めないと、アプリが「退会済です」と表示することもできなくなる。
-- ────────────────────────────────────────────────────────────────

drop policy if exists "自分の学習記録" on public.study_logs;
create policy "自分の学習記録" on public.study_logs
  for all to authenticated
  using (user_id = auth.uid() and public.can_use())
  with check (user_id = auth.uid() and public.can_use());

drop policy if exists "自分の発音練習" on public.attempts;
create policy "自分の発音練習" on public.attempts
  for all to authenticated
  using (user_id = auth.uid() and public.can_use())
  with check (user_id = auth.uid() and public.can_use());

drop policy if exists "自分の宿題を見る" on public.assignments;
create policy "自分の宿題を見る" on public.assignments
  for select to authenticated
  using (
    (learner_id = auth.uid() and public.can_use())
    or (public.is_trainer() and public.teaches(learner_id))
  );

drop policy if exists "生徒はやった記録だけ更新できる" on public.assignments;
create policy "生徒はやった記録だけ更新できる" on public.assignments
  for update to authenticated
  using (learner_id = auth.uid() and public.can_use())
  with check (learner_id = auth.uid() and public.can_use());

drop policy if exists "自分へのフィードバックを見る" on public.lesson_feedback;
create policy "自分へのフィードバックを見る" on public.lesson_feedback
  for select to authenticated
  using (
    (learner_id = auth.uid() and public.can_use())
    or (public.is_trainer() and public.teaches(learner_id))
  );

-- 配信された教材が見えるかどうかにも、状態を効かせる
create or replace function public.is_assigned_material(target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.can_use() and exists (
    select 1 from public.assignments
    where material_id = target and learner_id = auth.uid()
  );
$$;

-- ────────────────────────────────────────────────────────────────
-- 3. 休会中の生徒には、新しい宿題を配信しない
--
--   画面で止めるだけでは足りない。データベース側でも受け付けない。
-- ────────────────────────────────────────────────────────────────

drop policy if exists "配信できるのはトレーナーだけ" on public.assignments;
create policy "配信できるのはトレーナーだけ" on public.assignments
  for all to authenticated
  using (public.is_trainer() and public.teaches(learner_id))
  with check (
    public.is_trainer()
    and public.teaches(learner_id)
    and assigned_by = auth.uid()
    and exists (
      select 1 from public.profiles
      where id = learner_id and status = 'active'   -- 受講中のみ
    )
  );

-- ────────────────────────────────────────────────────────────────
-- 4. 在籍状態を変える(管理者、または担当トレーナー)
-- ────────────────────────────────────────────────────────────────

create or replace function public.set_learner_status(
  p_learner_id uuid,
  p_status     text,              -- 'active' / 'paused' / 'inactive'
  p_note       text default null  -- 例「回数コース修了後」「全額返金で退会」
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.is_owner() or public.teaches(p_learner_id)) then
    raise exception 'この生徒の状態を変える権限がありません';
  end if;

  if p_status not in ('active', 'paused', 'inactive') then
    raise exception '状態の指定が正しくありません';
  end if;

  if not exists (select 1 from profiles where id = p_learner_id and role = 'learner') then
    raise exception '生徒が見つかりません';
  end if;

  update profiles
  set status = p_status, status_note = p_note, status_changed_at = now()
  where id = p_learner_id;

  -- 退会したら担当も終える。休会は担当のまま(戻ってくるため)。
  if p_status = 'inactive' then
    update learner_admins set ended_on = current_date
    where learner_id = p_learner_id and ended_on is null;
  end if;
end;
$$;

-- 0003 の deactivate_learner は、これの「退会」を指す別名として残す
create or replace function public.deactivate_learner(p_learner_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.set_learner_status(p_learner_id, 'inactive', '退会');
end;
$$;

-- ────────────────────────────────────────────────────────────────
-- 5. トレーナーの休みの予定
--
--   生徒から「次のレッスンの担当は休みではないか」が見えるようにする。
--   予定を入れるのは本人と管理者。見えるのは担当している生徒。
-- ────────────────────────────────────────────────────────────────

create table if not exists public.trainer_absences (
  id         uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.profiles(id) on delete cascade,
  from_date  date not null,
  to_date    date not null,
  reason     text,          -- 生徒にも見える一言。例「研修のため」「夏季休暇」
  created_at timestamptz not null default now(),
  check (to_date >= from_date)
);
create index if not exists trainer_absences_trainer_idx
  on public.trainer_absences (trainer_id, from_date);

comment on table public.trainer_absences is
  'トレーナーの休みの予定。担当している生徒から見える。'
  'reason は生徒にも見えるので、私的な事情は書かない前提で運用する。';

alter table public.trainer_absences enable row level security;

drop policy if exists "休みの予定を見る" on public.trainer_absences;
create policy "休みの予定を見る" on public.trainer_absences
  for select to authenticated
  using (
    trainer_id = auth.uid()                       -- 本人
    or public.is_owner()                          -- 管理者
    or (                                          -- その人が担当している生徒
      public.can_use() and exists (
        select 1 from public.learner_admins
        where admin_id = trainer_absences.trainer_id
          and learner_id = auth.uid()
          and ended_on is null
      )
    )
  );

drop policy if exists "休みの予定を入れる" on public.trainer_absences;
create policy "休みの予定を入れる" on public.trainer_absences
  for all to authenticated
  using (trainer_id = auth.uid() or public.is_owner())
  with check (
    (trainer_id = auth.uid() and public.is_trainer()) or public.is_owner()
  );

-- ────────────────────────────────────────────────────────────────
-- 6. 集計に在籍状態を反映する
-- ────────────────────────────────────────────────────────────────

drop function if exists public.school_summary(date, date);
create or replace function public.school_summary(
  from_date date default (current_date - 30),
  to_date   date default current_date
)
returns table (
  trainer_count      integer,   -- 在籍中のトレーナー
  learner_active     integer,   -- 受講中
  learner_paused     integer,   -- 休会中
  learner_withdrawn  integer,   -- 退会済
  assigned_count     integer,
  done_count         integer,
  done_rate          numeric,
  attempt_count      integer,
  avg_minutes_weekly numeric
)
language sql stable security definer set search_path = public as $$
  select
    (select count(*)::integer from profiles where role = 'trainer' and status = 'active'),
    (select count(*)::integer from profiles where role = 'learner' and status = 'active'),
    (select count(*)::integer from profiles where role = 'learner' and status = 'paused'),
    (select count(*)::integer from profiles where role = 'learner' and status = 'inactive'),
    (select count(*)::integer from assignments
      where assigned_at::date between from_date and to_date),
    (select count(*)::integer from assignments
      where assigned_at::date between from_date and to_date and learner_done_at is not null),
    (select round(100.0 * count(*) filter (where learner_done_at is not null)
                  / nullif(count(*), 0), 1)
       from assignments where assigned_at::date between from_date and to_date),
    (select count(*)::integer from attempts
      where attempted_at::date between from_date and to_date),
    (select round(sum(minutes)::numeric
                  / nullif((select count(*) from profiles
                            where role = 'learner' and status = 'active'), 0)
                  / nullif((to_date - from_date + 1) / 7.0, 0), 1)
       from study_logs where studied_on between from_date and to_date)
  where public.is_owner();
$$;

grant execute on function public.school_summary(date, date)               to authenticated;
grant execute on function public.set_learner_status(uuid, text, text)     to authenticated;

-- ============================================================================
-- 完了。
--
-- 【休会中の扱い(まとめ)】
--   ・自分の過去の記録と、配信済みの教材は見られる
--   ・新しい宿題は配信されない(データベース側で受け付けない)
--   ・担当は外れない(戻ってきたときにそのまま再開できる)
--   ・集計では「受講中」と分けて数える
-- ============================================================================
