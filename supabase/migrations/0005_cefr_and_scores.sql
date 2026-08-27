-- ============================================================================
-- English AI System — レベルを CEFR にし、TOEIC / VERSANT のスコアを持つ
--
-- 【これは何か】
--   0001〜0004 に続く5つ目の追加変更です。前のものを置き換えません。
--
-- 【何が変わるか】
--   1. 生徒のレベルを CEFR(A1〜C2)で持つ
--   2. 教材のレベルも CEFR にそろえる
--      ※ 生徒と教材で物差しが違うと、トレーナーが頭の中で変換することになる
--   3. TOEIC / VERSANT のスコアを履歴として持つ(受けるたびに増える)
--
-- 【既存のデータの扱い】
--   教材のレベルは 1/2/3 の数値だった。次のように移す。
--     1(初級) → A2   2(中級) → B1   3(上級) → B2
--   まだ教材がほとんど無い段階なので、影響は小さい。
-- ============================================================================

-- ────────────────────────────────────────────────────────────────
-- 1. 生徒のレベル(CEFR)
-- ────────────────────────────────────────────────────────────────

alter table public.profiles
  add column if not exists cefr text;

alter table public.profiles drop constraint if exists profiles_cefr_check;
alter table public.profiles
  add constraint profiles_cefr_check
  check (cefr is null or cefr in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2'));

comment on column public.profiles.cefr is
  'CEFR のレベル。A1(入門)〜C2(熟達)。未判定なら NULL。';

-- 生徒は自分のレベルを書き換えられない(判定するのはトレーナー)。
-- 0002 までで更新してよい列は display_name と industry に絞ってある。
-- cefr はその一覧に入れないので、そのままで書き換えられない。
-- トレーナーが更新できるように、担当生徒の行を対象にした権限を足す。
grant update (cefr) on public.profiles to authenticated;

-- 列の権限だけでは「誰の行か」を絞れない。RLS 側は 0001 の
-- 「自分のプロフィールを直す」が is_admin()(= is_trainer())を
-- 含んでいるので、トレーナーは担当生徒の行を更新できる。
-- 生徒自身も自分の行を更新できてしまうため、cefr を書き換えられないよう
-- トリガーで止める。
create or replace function public.guard_learner_self_edit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- 自分自身の行を、トレーナーでない人が触っている場合
  if new.id = auth.uid() and not public.is_trainer() then
    if new.cefr is distinct from old.cefr then
      raise exception '自分のレベルは変更できません';
    end if;
    if new.status is distinct from old.status then
      raise exception '自分の在籍状態は変更できません';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_learner_self_edit on public.profiles;
create trigger guard_learner_self_edit
  before update on public.profiles
  for each row execute function public.guard_learner_self_edit();

-- ────────────────────────────────────────────────────────────────
-- 2. 教材のレベルも CEFR にそろえる
-- ────────────────────────────────────────────────────────────────

do $$
begin
  -- 数値のままなら CEFR に移す(2回目以降は何もしない)
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'materials'
      and column_name = 'level' and data_type = 'integer'
  ) then
    alter table public.materials drop constraint if exists materials_level_check;
    alter table public.materials
      alter column level type text
      using case level when 1 then 'A2' when 2 then 'B1' when 3 then 'B2' else 'B1' end;
  end if;
end $$;

alter table public.materials drop constraint if exists materials_level_check;
alter table public.materials
  add constraint materials_level_check
  check (level in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2'));

comment on column public.materials.level is
  '教材の CEFR レベル。生徒の cefr と同じ物差しにしてある。';

-- ────────────────────────────────────────────────────────────────
-- 3. TOEIC / VERSANT のスコア(履歴)
--
--   1回きりの値ではなく履歴で持つ。受けるたびに増え、
--   伸びを見せられるようにするため。一覧には最新だけを出す。
-- ────────────────────────────────────────────────────────────────

create table if not exists public.learner_scores (
  id          uuid primary key default gen_random_uuid(),
  learner_id  uuid not null references public.profiles(id) on delete cascade,
  test_type   text not null check (test_type in ('toeic', 'versant', 'other')),
  score       numeric not null,
  taken_on    date not null,
  note        text,
  recorded_by uuid references public.profiles(id),
  created_at  timestamptz not null default now(),
  -- 試験ごとに取りうる範囲が違う。打ち間違いをここで止める。
  constraint learner_scores_range check (
    (test_type = 'toeic'   and score between 10 and 990)
    or (test_type = 'versant' and score between 20 and 80)
    or (test_type = 'other')
  )
);
create index if not exists learner_scores_learner_idx
  on public.learner_scores (learner_id, test_type, taken_on desc);

comment on table public.learner_scores is
  'TOEIC / VERSANT などのスコアの履歴。TOEIC は 10-990、VERSANT は 20-80。';

alter table public.learner_scores enable row level security;

drop policy if exists "自分のスコアを見る" on public.learner_scores;
create policy "自分のスコアを見る" on public.learner_scores
  for select to authenticated
  using (
    (learner_id = auth.uid() and public.can_use())
    or (public.is_trainer() and public.teaches(learner_id))
  );

drop policy if exists "スコアを記録できるのはトレーナーだけ" on public.learner_scores;
create policy "スコアを記録できるのはトレーナーだけ" on public.learner_scores
  for all to authenticated
  using (public.is_trainer() and public.teaches(learner_id))
  with check (public.is_trainer() and public.teaches(learner_id));

-- ────────────────────────────────────────────────────────────────
-- 4. 最新のスコアだけを取り出す
--
--   生徒一覧では「いちばん新しい TOEIC」「いちばん新しい VERSANT」だけ要る。
--   毎回すべての履歴を読むのは無駄なので、ここでまとめる。
-- ────────────────────────────────────────────────────────────────

create or replace view public.learner_latest_scores as
select distinct on (learner_id, test_type)
  learner_id, test_type, score, taken_on
from public.learner_scores
order by learner_id, test_type, taken_on desc, created_at desc;

-- ビューは元の表のアクセス制御をそのまま引き継ぐ
alter view public.learner_latest_scores set (security_invoker = on);
grant select on public.learner_latest_scores to authenticated;

-- ============================================================================
-- 完了。
--
-- 【CEFR の目安】
--   A1 入門 / A2 初級 / B1 中級 / B2 中上級 / C1 上級 / C2 熟達
--
-- 【スコアの範囲】
--   TOEIC   10〜990
--   VERSANT 20〜80
--   範囲外の値はデータベース側で受け付けない(打ち間違い防止)
-- ============================================================================
