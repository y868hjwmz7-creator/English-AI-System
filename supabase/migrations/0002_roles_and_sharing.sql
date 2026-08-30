-- ============================================================================
-- English AI System — 役割を3つにし、教材の共有範囲を足す
--
-- 【これは何か】
--   0001_init.sql の「追加変更」です。0001 を置き換えるものではありません。
--   0001 を実行した後に、続けてこれを実行してください。
--
-- 【なぜ必要か】
--   0001 では役割が2つ(生徒 / トレーナー)しかなかった。
--   トレーナーが50人、生徒が1,500人になる構想では、
--   「全体の集計を見る管理者」という3つ目の役割が要る。
--   アカウントが増えてから変えると、全員のデータを移す作業になる。
--
-- 【何が変わるか】
--   1. 役割が learner / trainer / owner の3つになる
--      既存の 'admin' は自動的に 'trainer' に移る(データは失われない)
--   2. 教材に「公開範囲」が付く。既定は school(全トレーナーで共有)
--   3. owner だけが呼べる「集計を返す関数」が増える
--      ※ owner に生の記録を見せる権限は与えない(下記の設計方針を参照)
--
-- 【設計方針:owner には集計しか返さない】
--   「全部見える権限」を作ると、その権限が漏れたとき全生徒のデータが出る。
--   owner が見るのは平均や件数なので、**集計を計算して返す関数**だけを渡す。
--   関数の中だけが RLS を迂回し、外に出るのは集計値のみ。
--   生の行を読む権限は誰にも増やさない。
--
-- 【注意】
--   0001 を再実行した場合は、必ずこの 0002 も実行し直してください。
--   0001 はアクセス制御を作り直すため、ここでの変更が戻ってしまいます。
-- ============================================================================

-- ────────────────────────────────────────────────────────────────
-- 1. 役割を3つにする
-- ────────────────────────────────────────────────────────────────

-- 先に古い制限を外してからでないと、値を移せない
alter table public.profiles drop constraint if exists profiles_role_check;

-- 既存の 'admin' を 'trainer' に移す(0001 で作ったアカウントが該当)
update public.profiles set role = 'trainer' where role = 'admin';

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('learner', 'trainer', 'owner'));

comment on column public.profiles.role is
  'learner=生徒 / trainer=トレーナー / owner=全体の集計を見る管理者。画面では「生徒」「トレーナー」「管理者」と書く。';

-- ────────────────────────────────────────────────────────────────
-- 2. 判定関数を入れ替える
-- ────────────────────────────────────────────────────────────────

create or replace function public.is_trainer()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('trainer', 'owner')
  );
$$;

create or replace function public.is_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'owner'
  );
$$;

-- 0001 の is_admin() は is_trainer() に置き換わった。
-- 中身を差し替えておけば、0001 が作ったポリシーもそのまま新しい判定で動く。
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_trainer();
$$;
comment on function public.is_admin() is
  '0002 以降は is_trainer() の別名。新しく書くコードでは is_trainer() を使うこと。';

-- ────────────────────────────────────────────────────────────────
-- 3. 教材の公開範囲
--
--   50人のトレーナーが教材を共有すると、ライブラリが一気に育つ。
--   1人が週1件作るだけで、全体では週50件。7週で必要な数がそろう。
--   したがって既定は「共有する」にする。
-- ────────────────────────────────────────────────────────────────

alter table public.materials
  add column if not exists visibility text not null default 'school';

alter table public.materials drop constraint if exists materials_visibility_check;
alter table public.materials
  add constraint materials_visibility_check check (visibility in ('private', 'school'));

comment on column public.materials.visibility is
  'school=全トレーナーが使える(既定) / private=作った本人だけ';

-- 教材が見える条件を作り直す
drop policy if exists "配信された教材だけ見える" on public.materials;
create policy "配信された教材だけ見える" on public.materials
  for select to authenticated
  using (
    -- 生徒: 自分に配信されたものだけ
    public.is_assigned_material(id)
    -- トレーナー: 共有されているもの + 自分が作ったもの
    or (public.is_trainer() and (visibility = 'school' or created_by = auth.uid()))
  );

-- ────────────────────────────────────────────────────────────────
-- 4. 管理者(owner)向けの集計
--
--   owner に行を読む権限は与えない。集計した結果だけを返す。
-- ────────────────────────────────────────────────────────────────

-- 全体の集計。生徒個人は特定できない。
-- **先に落とす。** あとの移行(0004)が返す列を増やすので、増えたあとに
-- このファイルをもう一度流すと
-- 「cannot change return type of existing function」で止まる。
-- 頭から全部を貼り直す使い方があるため、ここで備えておく(2026-08)。
drop function if exists public.school_summary(date, date);

create or replace function public.school_summary(
  from_date date default (current_date - 30),
  to_date   date default current_date
)
returns table (
  trainer_count      integer,
  learner_count      integer,
  assigned_count     integer,
  done_count         integer,
  done_rate          numeric,   -- 宿題の実施率(%)
  attempt_count      integer,
  avg_minutes_weekly numeric    -- 生徒1人あたりの週の学習時間(分)
)
language sql stable security definer set search_path = public as $$
  select
    (select count(*)::integer from profiles where role = 'trainer'),
    (select count(*)::integer from profiles where role = 'learner'),
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
                  / nullif((select count(*) from profiles where role = 'learner'), 0)
                  / nullif((to_date - from_date + 1) / 7.0, 0), 1)
       from study_logs where studied_on between from_date and to_date)
  where public.is_owner();   -- owner でなければ0行。データは一切出ない
$$;

-- トレーナー別の集計。担当生徒の名前は出さない。
create or replace function public.trainer_summary(
  from_date date default (current_date - 30),
  to_date   date default current_date
)
returns table (
  trainer_id     uuid,
  trainer_name   text,
  learner_count  integer,
  assigned_count integer,
  done_rate      numeric
)
language sql stable security definer set search_path = public as $$
  select
    p.id,
    p.display_name,
    (select count(*)::integer from learner_admins la where la.admin_id = p.id),
    (select count(*)::integer from assignments a
      where a.assigned_by = p.id and a.assigned_at::date between from_date and to_date),
    (select round(100.0 * count(*) filter (where a.learner_done_at is not null)
                  / nullif(count(*), 0), 1)
       from assignments a
      where a.assigned_by = p.id and a.assigned_at::date between from_date and to_date)
  from profiles p
  where p.role in ('trainer', 'owner') and public.is_owner()
  order by p.display_name;
$$;

-- ログインしている人なら呼べるが、owner でなければ0行しか返らない
grant execute on function public.school_summary(date, date)  to authenticated;
grant execute on function public.trainer_summary(date, date) to authenticated;

-- ============================================================================
-- 完了。
--
-- 【この直後に行うこと】
--   自分を管理者(owner)にする場合:
--     update public.profiles set role = 'owner'
--     where id = (select id from auth.users where email = 'あなたのメールアドレス');
--
--   ※ owner はトレーナーの権限も兼ねる(is_trainer() が真になる)。
--     教材の作成も配信もできる。
-- ============================================================================
