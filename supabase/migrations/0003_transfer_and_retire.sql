-- ============================================================================
-- English AI System — 担当の引き継ぎと、退職したトレーナーの停止
--
-- 【これは何か】
--   0001 → 0002 に続く3つ目の追加変更です。前のものを置き換えません。
--   0001、0002 を実行した後に、続けてこれを実行してください。
--
-- 【なぜ必要か】
--   トレーナーは退職する。生徒の希望で担当が変わることもある。
--   このとき次の3つを同時に満たす必要がある。
--
--     1. 過去の記録を壊さない
--        「誰が配信したか」「誰がフィードバックしたか」はトレーナーに
--        紐づいている。退職者を消すと過去の記録ごと壊れる。
--        → 消さずに「停止」する。
--
--     2. 新しいトレーナーが、その生徒の弱点の履歴を引き継げる
--        担当が変わっても、過去のレッスン記録と弱点は残り、
--        新しい担当から見える。紙の引き継ぎより確実。
--
--     3. 前の担当には見えなくなる
--        退職後も担当生徒のデータが見え続けてはいけない(第 5.6.6 節)。
--
-- 【何が変わるか】
--   1. profiles に status(在籍中 / 停止)が付く
--   2. learner_admins に担当した期間が付く。過去の担当も履歴として残る
--   3. 担当の引き継ぎと、退職の手続きを行う関数が増える(管理者のみ)
-- ============================================================================

-- ────────────────────────────────────────────────────────────────
-- 1. 在籍しているかどうか
-- ────────────────────────────────────────────────────────────────

alter table public.profiles
  add column if not exists status text not null default 'active';

alter table public.profiles drop constraint if exists profiles_status_check;
alter table public.profiles
  add constraint profiles_status_check check (status in ('active', 'inactive'));

comment on column public.profiles.status is
  'active=在籍中 / inactive=停止(退職・退会)。行は消さない。消すと過去の記録が壊れる。';

-- 停止されたら、ログインできてもデータは一切見えない。
-- 行を消さずに閲覧だけを止められる。
create or replace function public.is_active()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and status = 'active'
  );
$$;

create or replace function public.is_trainer()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('trainer', 'owner') and status = 'active'
  );
$$;

create or replace function public.is_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'owner' and status = 'active'
  );
$$;

-- ────────────────────────────────────────────────────────────────
-- 2. 担当には期間がある
--
--   これまでは「担当かどうか」しか持っていなかった。
--   期間を持たせると、担当を外すのは「終わりの日を入れる」だけで済み、
--   過去に誰が担当したかも残る。
-- ────────────────────────────────────────────────────────────────

alter table public.learner_admins
  add column if not exists id uuid not null default gen_random_uuid(),
  add column if not exists started_on date not null default current_date,
  add column if not exists ended_on date,
  add column if not exists handover_note text;

comment on column public.learner_admins.ended_on is
  'NULL = 現在の担当。日付が入っていれば、その日で担当が終わったという履歴。';
comment on column public.learner_admins.handover_note is
  '引き継ぎのときの申し送り。次の担当が最初に読む。';

-- 同じ組み合わせが再び担当になることがある(戻ってくる場合)。
-- 元の複合キーだと2回目を登録できないので、行ごとの id に切り替える。
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'learner_admins_pkey' and conrelid = 'public.learner_admins'::regclass
  ) then
    alter table public.learner_admins drop constraint learner_admins_pkey;
  end if;
end $$;

alter table public.learner_admins add primary key (id);

-- 同じ担当を二重に登録しない(終わっていないものが1件だけ)
create unique index if not exists learner_admins_active_uniq
  on public.learner_admins (admin_id, learner_id) where ended_on is null;

create index if not exists learner_admins_current_idx
  on public.learner_admins (learner_id) where ended_on is null;

-- 「担当している」の判定に、終わっていないことを加える。
-- これで退職や担当変更が、そのままアクセス制御に効く。
create or replace function public.teaches(target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.learner_admins
    where admin_id = auth.uid() and learner_id = target and ended_on is null
  );
$$;

-- 管理者は、誰が誰を担当しているかの一覧を見られる必要がある
-- (引き継ぎの画面で使う)。見えるのは担当の関係だけで、
-- 生徒の学習記録が見えるようになるわけではない。
drop policy if exists "管理者は担当関係をすべて見る" on public.learner_admins;
create policy "管理者は担当関係をすべて見る" on public.learner_admins
  for select to authenticated using (public.is_owner());

-- ────────────────────────────────────────────────────────────────
-- 3. 担当の引き継ぎ(管理者のみ)
--
--   前の担当を終わらせ、新しい担当を始める。この2つを1回で行う。
--   別々に行うと、片方だけ実行された中途半端な状態が起こりうる。
-- ────────────────────────────────────────────────────────────────

create or replace function public.transfer_learner(
  p_learner_id     uuid,
  p_new_trainer_id uuid,
  p_note           text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_owner() then
    raise exception '担当を変更できるのは管理者だけです';
  end if;

  if not exists (
    select 1 from profiles
    where id = p_new_trainer_id and role in ('trainer', 'owner') and status = 'active'
  ) then
    raise exception '新しい担当が見つからないか、在籍していません';
  end if;

  if not exists (
    select 1 from profiles where id = p_learner_id and role = 'learner'
  ) then
    raise exception '生徒が見つかりません';
  end if;

  -- 今の担当をすべて終わらせる(副担当がいる場合も含めて)
  update learner_admins
  set ended_on = current_date
  where learner_id = p_learner_id and ended_on is null;

  -- 新しい担当を始める
  insert into learner_admins (admin_id, learner_id, started_on, handover_note)
  values (p_new_trainer_id, p_learner_id, current_date, p_note);
end;
$$;

-- ────────────────────────────────────────────────────────────────
-- 4. 退職の手続き(管理者のみ)
--
--   担当生徒をまとめて引き継ぎ、本人を停止する。
--   行は消さない。消すと過去の配信やフィードバックの記録が壊れる。
-- ────────────────────────────────────────────────────────────────

create or replace function public.retire_trainer(
  p_trainer_id     uuid,
  p_new_trainer_id uuid default null,   -- NULL なら担当なしにする
  p_note           text default null
)
returns integer                          -- 引き継いだ生徒の人数
language plpgsql
security definer
set search_path = public
as $$
declare
  moved integer := 0;
  r record;
begin
  if not public.is_owner() then
    raise exception '退職の手続きができるのは管理者だけです';
  end if;

  if p_trainer_id = auth.uid() then
    raise exception '自分自身を停止することはできません';
  end if;

  if p_new_trainer_id is not null then
    if not exists (
      select 1 from profiles
      where id = p_new_trainer_id and role in ('trainer', 'owner') and status = 'active'
    ) then
      raise exception '引き継ぎ先が見つからないか、在籍していません';
    end if;

    for r in
      select learner_id from learner_admins
      where admin_id = p_trainer_id and ended_on is null
    loop
      insert into learner_admins (admin_id, learner_id, started_on, handover_note)
      values (p_new_trainer_id, r.learner_id, current_date, p_note)
      on conflict do nothing;   -- すでに副担当だった場合は増やさない
      moved := moved + 1;
    end loop;
  end if;

  -- 本人の担当をすべて終わらせる
  update learner_admins
  set ended_on = current_date
  where admin_id = p_trainer_id and ended_on is null;

  -- 本人を停止する。行は消さない。
  update profiles set status = 'inactive' where id = p_trainer_id;

  return moved;
end;
$$;

-- ────────────────────────────────────────────────────────────────
-- 5. 生徒の退会(管理者・担当トレーナー)
-- ────────────────────────────────────────────────────────────────

create or replace function public.deactivate_learner(p_learner_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.is_owner() or public.teaches(p_learner_id)) then
    raise exception 'この生徒を停止する権限がありません';
  end if;

  update learner_admins set ended_on = current_date
  where learner_id = p_learner_id and ended_on is null;

  update profiles set status = 'inactive' where id = p_learner_id;
end;
$$;

grant execute on function public.transfer_learner(uuid, uuid, text)   to authenticated;
grant execute on function public.retire_trainer(uuid, uuid, text)     to authenticated;
grant execute on function public.deactivate_learner(uuid)             to authenticated;

-- ============================================================================
-- 完了。
--
-- 【引き継ぎで失われないもの】
--   新しい担当には、その生徒の過去のレッスン記録・弱点タグ・学習記録が
--   そのまま見える。前の担当が積み上げた情報を引き継げる。
--   紙の引き継ぎより確実で、これがこのアプリの利点のひとつになる。
--
-- 【引き継ぎで断たれるもの】
--   前の担当には、その生徒が一切見えなくなる(その日のうちに)。
-- ============================================================================
