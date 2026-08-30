-- ============================================================================
-- 0022 取り組みを裏で記録し、トレーナーから「リマインド」を送れるようにする
--
-- 【設計の変更】(2026-08 利用者の指定)
--
--   > 集計や学習の記録はやっぱり必要ありません。というより設計を少し変更します。
--   > ゲストがアプリで取り組んだトレーニングや単語帳の情報は全てトレーナー側に
--   > 共有され、もう少しコンパクトに表示される仕組みにしてください。
--   > 回数や時間を裏で記録し、トレーナー側のゲストの情報に反映される仕組みです。
--   > そして、取り組んでいない場合はまるでトレーナーがリマインドしたかのように
--   > 通知がいく仕組みです。
--
--   これまでは**ゲストが自分で「何分やった」と入力する**画面(学習の記録)
--   だった。入力そのものが手間で、しかも入れ忘れる。
--   **やったことは、こちらが数える。** ゲストは何も入力しない。
--
-- 【リマインドは、トレーナーが押したときだけ飛ぶ】(利用者の指定)
--
--   > それはトレーナーがリマインドボタンを押した時のみ発動するようにしましょう。
--
--   自動では送らない。**実際にトレーナーが押している**ので、
--   ゲストに「トレーナーから」と出しても嘘にならない。
--
-- 【何を作るか】
--   ・`practice_days`     … 1人 × 1日 × 1種類 で1行。回数と秒
--   ・`log_practice()`    … 取り組むたびに足す(ゲスト本人だけ)
--   ・`learner_practice()`… 担当ゲストの取り組みをまとめて返す(トレーナー)
--   ・`reminders`         … トレーナーが送ったリマインド
--   ・`send_reminder()`   … 送る(担当ゲストにだけ)
--   ・`seen_reminder()`   … ゲストが見たことを残す
--
-- 【なぜ「日ごと × 種類ごと」で1行なのか】
--   1回ごとに行を作ると、ゲスト500人 × 1日数回 で年に数十万行になる。
--   **1人1日あたり多くても5行**(種類の数)に抑える。
--   `vocab_days`(0019)と同じ考え方である。
--
-- 【何を記録しないか】
--   **録音そのものは、これまでどおりサーバーに送らない**(仕様書 3.2)。
--   ここに入るのは「いつ・何を・何回・何秒」だけである。
--
-- 【貼る前でも壊れない】
--   画面は、この表と関数が無いときは**静かに何もしない。**
--   記録が付かないだけで、教材も宿題も単語帳もこれまでどおり動く
--   (第5.23節「貼る前でも動く道を残す」)。
--
-- 【何度実行してもよい】
-- ============================================================================

-- ────────────────────────────────────────────────────────────────
-- 1. 取り組みの記録
-- ────────────────────────────────────────────────────────────────

create table if not exists public.practice_days (
  learner_id uuid    not null references auth.users(id) on delete cascade,
  done_on    date    not null default current_date,
  -- 何に取り組んだか。**画面側の名前と1対1**(src/lib/practice.js)
  --   homework / six_steps / quick_response / wordbook / pronunciation
  kind       text    not null,
  times      integer not null default 0,   -- 取り組んだ回数
  seconds    integer not null default 0,   -- かかった時間(秒)
  primary key (learner_id, done_on, kind)
);

comment on table public.practice_days is
  'ゲストが取り組んだ記録。1人 × 1日 × 1種類 で1行。'
  '**録音そのものは入らない**(端末の中だけ・仕様書 3.2)。';

alter table public.practice_days enable row level security;

drop policy if exists "取り組みは本人と担当トレーナーが見る" on public.practice_days;
create policy "取り組みは本人と担当トレーナーが見る" on public.practice_days
  for select to authenticated
  using (learner_id = auth.uid() or (public.is_admin() and public.teaches(learner_id)));

-- **書けるのは本人だけ。** しかも `log_practice()` を通す(下の grant を参照)
drop policy if exists "取り組みを書けるのは本人だけ" on public.practice_days;
create policy "取り組みを書けるのは本人だけ" on public.practice_days
  for all to authenticated
  using (learner_id = auth.uid()) with check (learner_id = auth.uid());

create index if not exists practice_days_learner_idx
  on public.practice_days (learner_id, done_on desc);

/**
 * 取り組みを1回ぶん足す。**呼べるのは本人だけ**(auth.uid() を使う)。
 *
 * 【上限を置く理由】
 *   画面の不具合や、開きっぱなしのまま放置した端末から
 *   とんでもない秒数が入ると、集計が丸ごと使えなくなる。
 *   **1回に足せるのは 1時間まで**にしておく。
 */
drop function if exists public.log_practice(text, integer, integer);
create or replace function public.log_practice(
  p_kind    text,
  p_seconds integer default 0,
  p_times   integer default 1
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_kind text := lower(trim(coalesce(p_kind, '')));
begin
  if auth.uid() is null then return; end if;
  -- **知らない種類は入れない。** 綴り違いで種類が増えていくのを防ぐ
  if v_kind not in ('homework', 'six_steps', 'quick_response', 'wordbook', 'pronunciation') then
    return;
  end if;

  insert into public.practice_days as d (learner_id, done_on, kind, times, seconds)
  values (
    auth.uid(), current_date, v_kind,
    least(greatest(coalesce(p_times, 0), 0), 100),
    least(greatest(coalesce(p_seconds, 0), 0), 3600)
  )
  on conflict (learner_id, done_on, kind) do update
    set times   = d.times + excluded.times,
        seconds = d.seconds + excluded.seconds;
end;
$$;

/**
 * 担当ゲストの取り組みを、まとめて1人1行で返す。
 *
 * **コンパクトに出すための材料**である(利用者の指定)。
 * 画面はこれをそのまま並べるだけでよく、数え方を画面に持たない。
 */
drop function if exists public.learner_practice(integer);
create or replace function public.learner_practice(p_days integer default 14)
returns table (
  learner_id   uuid,
  display_name text,
  last_on      date,      -- 最後に取り組んだ日
  days         integer,   -- 期間中に取り組んだ日数
  times        integer,   -- 期間中の回数
  seconds      integer,   -- 期間中の秒
  kinds        jsonb      -- 種類ごとの回数 {"wordbook": 12, ...}
)
language sql security definer set search_path = public as $$
  with span as (select current_date - greatest(coalesce(p_days, 14), 1) + 1 as from_on),
  mine as (
    select p.id, p.display_name
    from public.profiles p
    where p.role = 'learner' and public.teaches(p.id)
  )
  select
    m.id,
    m.display_name,
    max(d.done_on)::date,
    count(distinct d.done_on)::integer,
    coalesce(sum(d.times), 0)::integer,
    coalesce(sum(d.seconds), 0)::integer,
    coalesce(jsonb_object_agg(k.kind, k.times) filter (where k.kind is not null), '{}'::jsonb)
  from mine m
  left join public.practice_days d
    on d.learner_id = m.id and d.done_on >= (select from_on from span)
  left join lateral (
    select d2.kind, sum(d2.times)::integer as times
    from public.practice_days d2
    where d2.learner_id = m.id and d2.done_on >= (select from_on from span)
    group by d2.kind
  ) k on true
  group by m.id, m.display_name
  order by max(d.done_on) desc nulls last, m.display_name;
$$;

-- ────────────────────────────────────────────────────────────────
-- 2. リマインド
-- ────────────────────────────────────────────────────────────────
--
-- **トレーナーが押したときだけ入る。** 自動では作らない。
-- だからゲストの画面に「トレーナーから」と出しても嘘にならない。

create table if not exists public.reminders (
  id         uuid primary key default gen_random_uuid(),
  learner_id uuid not null references auth.users(id) on delete cascade,
  sent_by    uuid not null references auth.users(id),
  sent_at    timestamptz not null default now(),
  message    text,
  seen_at    timestamptz
);

comment on table public.reminders is
  'トレーナーが送ったリマインド。**押したときだけ入る**(自動では作らない)。';

alter table public.reminders enable row level security;

drop policy if exists "リマインドは本人と担当トレーナーが見る" on public.reminders;
create policy "リマインドは本人と担当トレーナーが見る" on public.reminders
  for select to authenticated
  using (learner_id = auth.uid() or (public.is_admin() and public.teaches(learner_id)));

drop policy if exists "リマインドを送れるのは担当トレーナーだけ" on public.reminders;
create policy "リマインドを送れるのは担当トレーナーだけ" on public.reminders
  for insert to authenticated
  with check (public.is_admin() and public.teaches(learner_id) and sent_by = auth.uid());

-- **ゲストが変えられるのは「見た」だけ。**
-- 行だけ絞っても列は絞れないので、列単位の grant を併せる(第3.3.1節)
drop policy if exists "見たことは本人が残せる" on public.reminders;
create policy "見たことは本人が残せる" on public.reminders
  for update to authenticated
  using (learner_id = auth.uid()) with check (learner_id = auth.uid());

revoke update on public.reminders from authenticated;
grant update (seen_at) on public.reminders to authenticated;

create index if not exists reminders_learner_idx
  on public.reminders (learner_id, sent_at desc);

/** リマインドを送る。**担当ゲストにだけ。** 返すのは作った行の id */
drop function if exists public.send_reminder(uuid, text);
create or replace function public.send_reminder(
  p_learner_id uuid,
  p_message    text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not (public.is_admin() and public.teaches(p_learner_id)) then
    raise exception 'このゲストにリマインドを送る権限がありません';
  end if;
  insert into public.reminders (learner_id, sent_by, message)
  values (p_learner_id, auth.uid(), nullif(trim(coalesce(p_message, '')), ''))
  returning id into v_id;
  return v_id;
end;
$$;

/** ゲストが見たことを残す。**自分あてのものだけ** */
drop function if exists public.seen_reminder(uuid);
create or replace function public.seen_reminder(p_id uuid) returns void
language sql security definer set search_path = public as $$
  update public.reminders
     set seen_at = now()
   where id = p_id and learner_id = auth.uid() and seen_at is null;
$$;

-- ────────────────────────────────────────────────────────────────
-- 3. 呼べる人を絞る
-- ────────────────────────────────────────────────────────────────
grant execute on function public.log_practice(text, integer, integer)  to authenticated;
grant execute on function public.learner_practice(integer)             to authenticated;
grant execute on function public.send_reminder(uuid, text)             to authenticated;
grant execute on function public.seen_reminder(uuid)                   to authenticated;
