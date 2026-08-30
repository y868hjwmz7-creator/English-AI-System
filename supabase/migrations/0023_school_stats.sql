-- ============================================================================
-- 0023 集計を「教材の種類と内容」で数え直す
--
-- 【なぜ作り直すのか】(2026-08 利用者の指定)
--
--   > 集計だけは残してください。しかし今のままでは見にくすぎるので、
--   > 教材の種類と内容に準じたものに変えてください。
--
--   これまでの集計は **`study_logs`(ゲストが自分で入力した学習時間)**の上に
--   立っていた。その入力欄は 0022 の設計変更で無くなっている
--   (「回数や時間を裏で記録し」)。**入らなくなった数字を並べ続けると、
--   いつまでも 0 のグラフが出る。** 数えるものを、いま実際にあるものへ移す。
--
-- 【何で数えるか】
--   ・**種類**  … `materials.kind`(文型ドリル / リーディング / ダイアローグ /
--                 単語 / フレーズ)
--   ・**内容**  … `material_tags`(弱点)と `materials.level`(CEFR)
--   ・**届き方**… `assignments`(共有した回数と、ゲストが済ませた回数)
--   ・**取り組み**… `practice_days`(0022。裏で数えたもの)
--
-- 【管理者だけが見る】
--   `is_owner()` が偽なら**1行も返さない。** CLAUDE.md の
--   「管理者 — 全体の集計だけを見る」に合わせる。
--   security definer なので、この判定を外すと全校のデータが漏れる。
--   **判定を消さないこと。**
--
-- 【教材が0件の弱点も返す】
--   ここがいちばん見たいところである。**ライブラリの穴**(まだ1本も無い弱点)は、
--   0 の行が出て初めて分かる。`weakness_tags` から left join する。
--
-- 【何度実行してもよい】
--   返す列を変える関数は、先に `drop function if exists` を置いてある
--   (置かないと `cannot change return type of existing function` で止まる)。
-- ============================================================================

-- ────────────────────────────────────────────────────────────────
-- 1. 全体の数(school_summary を、いまあるもので数え直す)
--
--   0002 → 0004 と作り替えてきたもの。0004 の版は最後の欄が
--   `avg_minutes_weekly`(study_logs の合計)で、**もう何も入らない。**
--   代わりに 0022 の `practice_days` から「1人あたり週◯分」を出す。
--   `attempt_count`(発音の仮スコア)も外す。**測っていないものは数えない。**
-- ────────────────────────────────────────────────────────────────
drop function if exists public.school_summary(date, date);
create or replace function public.school_summary(
  from_date date default (current_date - 30),
  to_date   date default current_date
)
returns table (
  trainer_count       integer,   -- 在籍中のトレーナー
  learner_active      integer,   -- 受講中
  learner_paused      integer,   -- 休会中
  learner_withdrawn   integer,   -- 退会済
  material_count      integer,   -- ライブラリ全体(発行済み)
  material_new        integer,   -- 期間中に作られた教材
  assigned_count      integer,   -- 期間中に共有した回数
  done_count          integer,   -- うち、ゲストが済ませた回数
  done_rate           numeric,   -- 達成率(%)
  practice_minutes_weekly numeric -- 受講中のゲスト1人あたり、週◯分
)
language sql stable security definer set search_path = public as $$
  select
    (select count(*)::integer from profiles where role = 'trainer' and status = 'active'),
    (select count(*)::integer from profiles where role = 'learner' and status = 'active'),
    (select count(*)::integer from profiles where role = 'learner' and status = 'paused'),
    (select count(*)::integer from profiles where role = 'learner' and status = 'inactive'),
    (select count(*)::integer from materials where status = 'published'),
    (select count(*)::integer from materials
      where created_at::date between from_date and to_date),
    (select count(*)::integer from assignments
      where assigned_at::date between from_date and to_date),
    (select count(*)::integer from assignments
      where assigned_at::date between from_date and to_date and learner_done_at is not null),
    (select round(100.0 * count(*) filter (where learner_done_at is not null)
                  / nullif(count(*), 0), 1)
       from assignments where assigned_at::date between from_date and to_date),
    (select round(coalesce(sum(seconds), 0)::numeric / 60.0
                  / nullif((select count(*) from profiles
                            where role = 'learner' and status = 'active'), 0)
                  / nullif((to_date - from_date + 1) / 7.0, 0), 1)
       from practice_days where done_on between from_date and to_date)
  where public.is_owner();
$$;

-- ────────────────────────────────────────────────────────────────
-- 2. 教材の「種類」ごと
--
--   ライブラリに何がどれだけあり、そのうち実際に配られているのはどれか。
--   **作った数と配った数は別物**である(CLAUDE.md「配る数と新しく作る数を
--   混同しない」)。両方を並べて出す。
-- ────────────────────────────────────────────────────────────────
drop function if exists public.school_by_kind(integer);
create or replace function public.school_by_kind(p_days integer default 30)
returns table (
  kind       text,
  materials  integer,   -- ライブラリ全体(発行済み)
  fresh      integer,   -- 期間中に作られた数
  items      integer,   -- 中の項目の数(問・段落・発言)
  assigned   integer,   -- 期間中に共有した回数
  done       integer    -- うち、ゲストが済ませた回数
)
language sql stable security definer set search_path = public as $$
  with span as (select current_date - greatest(coalesce(p_days, 30), 1) + 1 as from_on),
  -- 教材1本につき1行にしてから足す。**先にまとめないと、
  -- 共有が2回ある教材が2本に数えられる**(join で行が増えるため)
  per as (
    select
      m.id, m.kind, m.status, m.created_at,
      (select count(*) from material_items i where i.material_id = m.id) as items,
      (select count(*) from assignments a
        where a.material_id = m.id
          and a.assigned_at::date >= (select from_on from span))            as assigned,
      (select count(*) from assignments a
        where a.material_id = m.id
          and a.assigned_at::date >= (select from_on from span)
          and a.learner_done_at is not null)                                as done
    from materials m
  )
  select
    per.kind,
    count(*) filter (where per.status = 'published')::integer,
    count(*) filter (where per.created_at::date >= (select from_on from span))::integer,
    coalesce(sum(per.items), 0)::integer,
    coalesce(sum(per.assigned), 0)::integer,
    coalesce(sum(per.done), 0)::integer
  from per
  where public.is_owner()
  group by per.kind
  order by 2 desc, per.kind;
$$;

-- ────────────────────────────────────────────────────────────────
-- 3. 教材の「内容」= 弱点ごと
--
--   **1本も無い弱点も返す。** ここが穴である。
--   教材が無い弱点は、レッスンで指摘しても宿題が出せない。
-- ────────────────────────────────────────────────────────────────
drop function if exists public.school_by_tag(integer);
create or replace function public.school_by_tag(p_days integer default 30)
returns table (
  tag_id     text,
  label      text,
  category   text,
  materials  integer,   -- その弱点が付いた教材(発行済み)
  assigned   integer,   -- 期間中に共有した回数
  done       integer
)
language sql stable security definer set search_path = public as $$
  with span as (select current_date - greatest(coalesce(p_days, 30), 1) + 1 as from_on)
  select
    t.id, t.label, t.category,
    count(distinct m.id) filter (where m.status = 'published')::integer,
    count(a.id) filter (where a.assigned_at::date >= (select from_on from span))::integer,
    count(a.id) filter (where a.assigned_at::date >= (select from_on from span)
                          and a.learner_done_at is not null)::integer
  from weakness_tags t
  left join material_tags mt on mt.tag_id = t.id
  left join materials    m   on m.id = mt.material_id
  left join assignments  a   on a.material_id = m.id
  where public.is_owner() and t.kind = 'weakness'
  group by t.id, t.label, t.category, t.sort_order
  order by t.sort_order, t.id;
$$;

-- ────────────────────────────────────────────────────────────────
-- 4. レベルごと(教材の数と、そのレベルのゲストの数)
--
--   **需要と供給のずれ**が見える。ゲストが多いレベルに教材が無ければ、
--   そこから作ればよい。数字が2つ並んで初めて分かる。
-- ────────────────────────────────────────────────────────────────
drop function if exists public.school_by_level(integer);
create or replace function public.school_by_level(p_days integer default 30)
returns table (
  level      text,
  materials  integer,
  learners   integer
)
language sql stable security definer set search_path = public as $$
  -- **並び順は 14 段階のとおり。** 文字の順に並べると A1+ が A2 の後に来る
  with order_of as (
    select t.level, t.pos from unnest(array[
      'Pre-Basic', 'Basic',
      'A1', 'A1+', 'A2', 'A2+',
      'B1', 'B1+', 'B2', 'B2+',
      'C1', 'C1+', 'C2',
      'Proficiency'
    ]) with ordinality as t(level, pos)
  ),
  lv as (
    select distinct m.level from materials m where m.level is not null
    union
    select distinct p.cefr from profiles p
     where p.role = 'learner' and p.status = 'active' and p.cefr is not null
  )
  select
    lv.level,
    (select count(*)::integer from materials m
      where m.level = lv.level and m.status = 'published'),
    (select count(*)::integer from profiles p
      where p.role = 'learner' and p.status = 'active' and p.cefr = lv.level)
  from lv
  left join order_of o on o.level = lv.level
  where public.is_owner()
  order by coalesce(o.pos, 99), lv.level;
$$;

-- ────────────────────────────────────────────────────────────────
-- 5. 取り組み(0022)を、種類ごとに全校で数える
--
--   `learner_practice()`(0022)は**担当ゲストだけ**を返す。あれはトレーナー用。
--   こちらは管理者用で、**学校ぜんぶ**を種類ごとにまとめる。
-- ────────────────────────────────────────────────────────────────
drop function if exists public.school_practice(integer);
create or replace function public.school_practice(p_days integer default 30)
returns table (
  kind     text,
  learners integer,   -- その種類に取り組んだ人数
  times    integer,
  seconds  integer
)
language sql stable security definer set search_path = public as $$
  with span as (select current_date - greatest(coalesce(p_days, 30), 1) + 1 as from_on)
  select
    d.kind,
    count(distinct d.learner_id)::integer,
    coalesce(sum(d.times), 0)::integer,
    coalesce(sum(d.seconds), 0)::integer
  from practice_days d
  where public.is_owner() and d.done_on >= (select from_on from span)
  group by d.kind
  order by 3 desc, d.kind;
$$;

-- ────────────────────────────────────────────────────────────────
-- 6. 呼べる人を絞る
--
--   `authenticated` に execute を渡すが、**関数の中で `is_owner()` を見る。**
--   トレーナーやゲストが呼んでも 0 行しか返らない。
-- ────────────────────────────────────────────────────────────────
grant execute on function public.school_summary(date, date)  to authenticated;
grant execute on function public.school_by_kind(integer)     to authenticated;
grant execute on function public.school_by_tag(integer)      to authenticated;
grant execute on function public.school_by_level(integer)    to authenticated;
grant execute on function public.school_practice(integer)    to authenticated;
