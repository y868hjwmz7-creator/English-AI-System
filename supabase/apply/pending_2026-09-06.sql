-- ============================================================================
-- 0042 続けた記録(Quick Response)と、週の目標
--
-- 【なぜ要るか】(2026-09 利用者の指定)
--
--   > 単語帳とクイックレスポンス帳にゲーミフィケーションを追加したいです
--   > ・続けた記録を QR にも
--   > ・週の目標と、達成の印
--
--   単語帳には 0019 から「今週 3 日 / 5 週つづけて」があるのに、
--   **Quick Response には何も無かった。** 同じ形の入れ物を足す。
--
-- 【日ではなく、週で数える】
--   日ごとの連続記録は**1日休んだ瞬間に途切れ、それがやめる理由になる。**
--   このスクールは週2回のレッスンに合わせて宿題を出しているので、
--   毎日やる前提そのものが合っていない。0019 とまったく同じ考え方である。
--
-- 【目標を決めるのはトレーナー。ゲスト本人ではない】
--   **自分で下げられる目標は、目標にならない。**
--   `set_weekly_goal()` は担当トレーナーと管理者だけが呼べる。
--   ゲストは読めるが書けない。**判定は関数の中**であって、画面には持たせない。
--
-- 【何が起きるか】
--   ・表が2つ増えます(`qr_days` / `weekly_goals`)。**空から始まります**
--   ・関数が3つ増えます(`qr_week` / `weekly_goal` / `set_weekly_goal`)
--   ・`mark_qr()` と `erase_learner()` を作り直します(中身は同じ + 追加分)
--
-- 【どこまで影響するか】
--   教材・宿題・単語帳・ゲストの情報には**触れません。**
--   すでに溜まっている Quick Response の文(`qr_reviews`)もそのままです。
--   **何度貼っても同じ結果になります。**
--
-- 【成功の目安】
--   `Success. No rows returned` と出れば成功です。
-- ============================================================================

-- ============================================================================
-- 0042 — Quick Response の「続けた記録」と、週の目標
--
--   2026-09 利用者の指定
--   「単語帳とクイックレスポンス帳にゲーミフィケーションを追加したいです」
--   のうち、**貼る作業が要る2つ**である。
--
--   ・`qr_days`        … Quick Response を何日やったか(日ごとに1行)
--   ・`mark_qr()`      … 答えるたびに `qr_days` を1つ増やす(作り直し)
--   ・`qr_week()`      … 今週の日数・回数・正解、続いている週数
--   ・`weekly_goals`   … 週の目標(トレーナーがゲストごとに決める)
--   ・`set_weekly_goal()` / `weekly_goal()`
--
-- ────────────────────────────────────────────────────────────────
-- 【なぜ Quick Response にも要るのか】
--
--   **続けた記録は、単語帳にしか無かった。**
--   Quick Response の復習(0040)には**1つも記録が無く**、
--   何日やったのかも、続いているのかも、誰にも見えなかった。
--   単語帳と**同じ形**にそろえる(`vocab_days` / `vocab_week` の写し)。
--
-- 【日ではなく、週で数える】(0019 からの決まり)
--
--   日ごとの連続記録は**1日休んだ瞬間に途切れ、それがやめる理由になる。**
--   週2回のレッスンに合わせた宿題なので、毎日やる前提が合っていない。
--   **ここでも週で数える。** 単語帳と違う数え方にしない。
--
-- 【週の目標は、トレーナーが決める】
--
--   ゲスト本人は**読めるが、書けない。**
--   自分で下げられる目標は目標にならないし、
--   レッスンの見立て(いまどのくらい押せるか)はトレーナーが持っている。
--   `lesson_notes`(0032)と同じ考え方である。
--
--   **達成できなくても、責める作りにしない。** 進み具合を出すだけで、
--   届かなかったことを画面から言わない(「まだ」を赤くしないのと同じ)。
--
-- 【何度実行してもよい】
--   `create table if not exists` と、drop してからの作り直しだけ。
-- ============================================================================

-- ────────────────────────────────────────────────────────────────
-- 1. Quick Response を何日やったか
--
--   `qr_reviews.updated_at` は**上書きされる。** 月曜に答えて水曜に
--   答え直すと、月曜の記録が消える。「何日続けたか」は数えられない。
--   だから日ごとに1行だけ持つ(`vocab_days` とまったく同じ)。
--   **1人1日1行なので、年に365行しか増えない。**
-- ────────────────────────────────────────────────────────────────
create table if not exists public.qr_days (
  learner_id uuid    not null references auth.users(id) on delete cascade,
  done_on    date    not null default current_date,
  answered   integer not null default 0,   -- 答えた回数(同じ文を2回なら2)
  correct    integer not null default 0,   -- そのうち「言える」を選んだ回数
  primary key (learner_id, done_on)
);

alter table public.qr_days enable row level security;

drop policy if exists "自分と担当トレーナーが見る" on public.qr_days;
create policy "自分と担当トレーナーが見る" on public.qr_days
  for select to authenticated
  using (learner_id = auth.uid() or public.teaches(learner_id) or public.is_owner());

-- **書けるのは本人だけ。** 担当トレーナーでも直に書けない。
-- 記録は `mark_qr()`(security definer)を通して増える
drop policy if exists "自分の記録だけ書ける" on public.qr_days;
create policy "自分の記録だけ書ける" on public.qr_days
  for all to authenticated
  using (learner_id = auth.uid()) with check (learner_id = auth.uid());

comment on table public.qr_days is
  'Quick Response を何日やったかを数えるための、日ごとの記録。1人1日1行。'
  'qr_reviews.updated_at は上書きされるので、そちらでは数えられない(0019 と同じ)。';

-- ────────────────────────────────────────────────────────────────
-- 2. 週の目標
--
--   **1人1行。** 週ごとに行を増やさない ——
--   「先週の目標は何だったか」を振り返る場面が無いためである。
--   増やしたくなったら、そのときに表を足す。
-- ────────────────────────────────────────────────────────────────
create table if not exists public.weekly_goals (
  learner_id uuid        primary key references auth.users(id) on delete cascade,
  words      integer     not null default 0,   -- 週に答える語の数(0 なら決めていない)
  sentences  integer     not null default 0,   -- 週に答える文の数
  set_by     uuid        references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.weekly_goals enable row level security;

-- **本人も読める。** 目標が見えないと、進み具合に意味がない
drop policy if exists "自分と担当トレーナーが見る" on public.weekly_goals;
create policy "自分と担当トレーナーが見る" on public.weekly_goals
  for select to authenticated
  using (learner_id = auth.uid() or public.teaches(learner_id) or public.is_owner());

-- **書けるのは担当トレーナー(と管理者)だけ。**
-- 自分で下げられる目標は、目標にならない
drop policy if exists "担当トレーナーが決める" on public.weekly_goals;
create policy "担当トレーナーが決める" on public.weekly_goals
  for all to authenticated
  using (public.teaches(learner_id) or public.is_owner())
  with check (public.teaches(learner_id) or public.is_owner());

comment on table public.weekly_goals is
  '週の目標(語の数 / 文の数)。1人1行。トレーナーが決め、ゲストは読むだけ。'
  '0 は「決めていない」。届かなくても責める作りにはしない。';

-- ────────────────────────────────────────────────────────────────
-- 3. mark_qr() — 答えるたびに qr_days を1つ増やす
--
--   **返す列は変えていない。** それでも drop を置く ——
--   あとで誰かが列を足したときに、このファイルだけを貼り直すと
--   `cannot change return type` で止まるためである
--   (CLAUDE.md「関数を作り直すファイルは、返す列を変えていなくても
--    drop を置く」)。
--
--   **`mark_word()` と同じ形にそろえる。** あちらは 0019 から
--   `vocab_days` を増やしている。
-- ────────────────────────────────────────────────────────────────
drop function if exists public.mark_qr(text, text, text, uuid, text, uuid, boolean);

create or replace function public.mark_qr(
  p_en            text,
  p_ja            text,
  p_status        text default 'unknown',
  p_material      uuid default null,
  p_speaker       text default null,
  p_learner       uuid default null,
  -- true なら、**すでに溜まっている文だけ**を動かす(新しく溜めない)
  p_only_existing boolean default false
)
returns table (en_norm text, status text, box smallint, due_on date)
language plpgsql
volatile
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  -- **卒業までの回数・休ませる日数は、単語帳と同じ**(0038)
  c_graduate constant int := 25;
  c_rest     constant int := 30;
  v_who    uuid;
  v_norm   text;
  v_box    smallint;
  v_streak int;
  v_days   int;
  v_new    boolean;
  v_ja     text;
  v_en     text;
begin
  if auth.uid() is null then
    raise exception 'ログインしていません';
  end if;

  v_who := coalesce(p_learner, auth.uid());
  if v_who <> auth.uid()
     and not public.teaches(v_who)
     and not public.is_owner() then
    raise exception '担当していないゲストの記録には書けません';
  end if;

  v_norm := public.norm_en(p_en);
  if v_norm is null then
    raise exception '英文が空です';
  end if;
  if p_status is null or p_status not in ('unknown', 'learning', 'known') then
    raise exception '状態は unknown / learning / known です';
  end if;

  -- 長すぎるものは切る(1問がこれより長いことはない)
  v_en := left(btrim(regexp_replace(coalesce(p_en, ''), '\s+', ' ', 'g')), 600);
  v_ja := left(btrim(regexp_replace(coalesce(p_ja, ''), '\s+', ' ', 'g')), 600);

  select r.box, r.learn_streak into v_box, v_streak
    from public.qr_reviews r
   where r.learner_id = v_who and r.en_norm = v_norm;
  v_new    := not found;
  v_box    := coalesce(v_box, 0);
  v_streak := coalesce(v_streak, 0);

  -- **まだ溜まっていない文は、ここで打ち切る。**
  -- 教材の中で「言えた」を押しただけでは溜めない
  if v_new and p_only_existing then
    return;
  end if;

  if p_status = 'unknown' then
    v_box := 0;
    v_days := 1;
    v_streak := 0;
  elsif p_status = 'learning' then
    v_streak := v_streak + 1;
    if v_streak >= c_graduate then
      -- **卒業。しばらく出てこない。**
      -- `status` は learning のままにする(30日たてばまた出る)
      v_box := 6;
      v_days := c_rest;
    else
      -- 箱は 3 で止める。必ず4日以内に戻ってくる(0027 と同じ)
      v_box := least(v_box + 1, 3);
      v_days := case v_box when 1 then 1 when 2 then 2 else 4 end;
    end if;
  else
    -- 「もう出さない」。復習の一覧からは消える
    v_box := 6;
    v_days := c_rest;
  end if;

  -- **溜めたその日に、1回は出す**(0030 と同じ考え方)。
  -- 「まだ」を押した直後に復習を開いて1件も出てこないと、
  -- 溜まっていないように見える
  if v_new then
    v_days := 0;
  end if;

  /* ★ **続けた記録を1つ増やす**(0042)。
       `mark_word()` が `vocab_days` を増やしているのと同じ形。

       **「思い出せたか」で数える。**「言える」を押したときが correct で、
       「まだ」は数に入らない(`vocab_days.correct` と同じ考え方)。
       **「もう出さない」(known)は、答えたことにしない** ——
       あれは片づける操作であって、練習ではない。 */
  if p_status <> 'known' then
    insert into public.qr_days as d (learner_id, done_on, answered, correct)
    values (v_who, current_date, 1, case when p_status = 'learning' then 1 else 0 end)
    on conflict (learner_id, done_on) do update
      set answered = d.answered + 1,
          correct  = d.correct + case when p_status = 'learning' then 1 else 0 end;
  end if;

  return query
  insert into public.qr_reviews as q
    (learner_id, en_norm, en, ja, material_id, speaker,
     status, box, learn_streak, due_on, updated_at)
  values
    (v_who, v_norm, v_en, v_ja, p_material, nullif(btrim(coalesce(p_speaker, '')), ''),
     p_status, v_box, v_streak, current_date + v_days, now())
  on conflict (learner_id, en_norm) do update
    set status       = excluded.status,
        box          = excluded.box,
        learn_streak = excluded.learn_streak,
        due_on       = excluded.due_on,
        -- **英文と訳は、そのつど新しいものにそろえる**(教材を直したとき)
        en           = excluded.en,
        ja           = excluded.ja,
        -- **教材と話す人は、最初に出会ったものを残す**(あとから上書きしない)
        material_id  = coalesce(q.material_id, excluded.material_id),
        speaker      = coalesce(q.speaker, excluded.speaker),
        updated_at   = now()
  returning q.en_norm, q.status, q.box, q.due_on;
end;
$$;

comment on function public.mark_qr(text, text, text, uuid, text, uuid, boolean) is
  'Quick Response の文に「まだ / 言える」を付け、次に出す日を決める(0040)。'
  '間隔の決まりは単語帳(mark_word・0038)とまったく同じ。'
  '答えるたびに qr_days を1つ増やす(0042)。'
  'p_only_existing = true なら、すでに溜まっている文だけを動かす。'
  'p_learner を渡すと、担当しているゲストの記録として残す(0025 と同じ)。';

revoke all on function public.mark_qr(text, text, text, uuid, text, uuid, boolean) from public;
grant execute on function public.mark_qr(text, text, text, uuid, text, uuid, boolean)
  to authenticated;

-- ────────────────────────────────────────────────────────────────
-- 4. qr_week() — 今週の続き具合
--
--   **`vocab_week()`(0019)とまったく同じ数え方。**
--   単語帳と Quick Response で違う数え方にすると、
--   同じ「5週つづけて」が別の意味になる。
-- ────────────────────────────────────────────────────────────────
drop function if exists public.qr_week(uuid);

create or replace function public.qr_week(p_learner uuid default null)
returns table (
  days      integer,   -- 今週やった日数
  answered  integer,   -- 今週答えた回数
  correct   integer,   -- そのうち「言える」
  weeks     integer    -- 何週続いているか(1週まるごと空けば切れる)
)
language sql
stable
security definer
set search_path = public
as $$
  with allowed as (
    select coalesce(p_learner, auth.uid()) as id
     where coalesce(p_learner, auth.uid()) = auth.uid()
        or public.teaches(coalesce(p_learner, auth.uid()))
        or public.is_owner()
  ),
  mine as (
    select d.* from public.qr_days d join allowed a on a.id = d.learner_id
  ),
  this_week as (
    select
      count(*)::int                   as days,
      coalesce(sum(answered), 0)::int as answered,
      coalesce(sum(correct), 0)::int  as correct
    from mine
    where done_on >= date_trunc('week', current_date)::date
  ),
  -- やった週を新しい順に並べる
  wk as (select distinct date_trunc('week', done_on)::date as w from mine),
  ranked as (select w, (row_number() over (order by w desc))::int as n from wk),
  -- 上から順に「1週ずつきちんと下がっているか」を見る
  run as (
    select count(*)::int as weeks from ranked
     where w = (select max(w) from wk) - ((n - 1) * 7)
  )
  select
    t.days, t.answered, t.correct,
    -- 今週か先週にやっていなければ、続いているとは言わない
    case when (select max(w) from wk) >= date_trunc('week', current_date)::date - 7
         then (select weeks from run) else 0 end
  from this_week t;
$$;

comment on function public.qr_week(uuid) is
  '今週の Quick Response の続き具合。日ではなく週で数える(vocab_week と同じ)。';

revoke all on function public.qr_week(uuid) from public;
grant execute on function public.qr_week(uuid) to authenticated;

-- ────────────────────────────────────────────────────────────────
-- 5. 週の目標を決める / 読む
--
--   **数え方は DB に置く。** 画面で足し直さない(0022 / 0023 と同じ)。
--   目標と、今週やった数を**1回で返す** —— 画面が2つの窓口を呼んで
--   足し合わせると、そこがずれる。
-- ────────────────────────────────────────────────────────────────
drop function if exists public.set_weekly_goal(uuid, integer, integer);

create or replace function public.set_weekly_goal(
  p_learner   uuid,
  p_words     integer default 0,
  p_sentences integer default 0
)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  -- **決められるのは担当トレーナー(と管理者)だけ。**
  -- 判定は**この中だけ**に置く(画面に持たせない)
  if not (public.teaches(p_learner) or public.is_owner()) then
    raise exception '担当していないゲストの目標は決められません';
  end if;

  -- **とんでもない数を入れさせない。** 0 は「決めていない」
  insert into public.weekly_goals as g (learner_id, words, sentences, set_by, updated_at)
  values (p_learner,
          greatest(0, least(coalesce(p_words, 0), 2000)),
          greatest(0, least(coalesce(p_sentences, 0), 2000)),
          auth.uid(), now())
  on conflict (learner_id) do update
    set words      = excluded.words,
        sentences  = excluded.sentences,
        set_by     = excluded.set_by,
        updated_at = now();
end;
$$;

comment on function public.set_weekly_goal(uuid, integer, integer) is
  '週の目標(語 / 文)を決める。担当トレーナーと管理者だけ(0042)。0 は決めていない。';

revoke all on function public.set_weekly_goal(uuid, integer, integer) from public;
grant execute on function public.set_weekly_goal(uuid, integer, integer) to authenticated;

drop function if exists public.weekly_goal(uuid);

create or replace function public.weekly_goal(p_learner uuid default null)
returns table (
  words_goal integer,   -- 週の目標(語)。0 なら決めていない
  words_done integer,   -- 今週答えた語の回数
  sent_goal  integer,   -- 週の目標(文)
  sent_done  integer    -- 今週答えた文の回数
)
language sql
stable
security definer
set search_path = public
as $$
  with me as (select coalesce(p_learner, auth.uid()) as id),
  allowed as (
    select id from me
     where id = auth.uid() or public.teaches(id) or public.is_owner()
  ),
  goal as (
    select g.words, g.sentences
      from public.weekly_goals g join allowed a on a.id = g.learner_id
  ),
  w as (
    select coalesce(sum(d.answered), 0)::int as n
      from public.vocab_days d join allowed a on a.id = d.learner_id
     where d.done_on >= date_trunc('week', current_date)::date
  ),
  s as (
    select coalesce(sum(d.answered), 0)::int as n
      from public.qr_days d join allowed a on a.id = d.learner_id
     where d.done_on >= date_trunc('week', current_date)::date
  )
  -- **見えない人には 0 を返す。** 「見られません」と例外にすると、
  -- 画面がそこで止まる(0 なら「決めていない」と同じ見た目になる)
  select
    coalesce((select words from goal), 0),
    (select n from w),
    coalesce((select sentences from goal), 0),
    (select n from s);
$$;

comment on function public.weekly_goal(uuid) is
  '週の目標と、今週やった数を1回で返す(0042)。数え方は DB に置く。';

revoke all on function public.weekly_goal(uuid) from public;
grant execute on function public.weekly_goal(uuid) to authenticated;

-- ────────────────────────────────────────────────────────────────
-- 6. まとめて消すときに、この2つも消す(0041 の作り直し)
--
--   **表を足したら、消す側にも足す**(CLAUDE.md)。
--   中身は 0041 をそのまま写し、`qr_days` と `weekly_goals` の
--   2つだけを足してある。**キーの名前も日本語のまま**である ——
--   画面はこれをそのまま出すし、`rls_test.sql` もこの名前で数えている。
-- ────────────────────────────────────────────────────────────────
drop function if exists public.erase_learner(uuid);

create or replace function public.erase_learner(p_learner uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role  text;
  v_out   jsonb := '{}'::jsonb;
  v_n     integer;
begin
  -- ① 管理者だけ。**判定を画面に持たせない**
  if not public.is_owner() then
    raise exception 'この操作ができるのは管理者だけです';
  end if;

  -- ② 相手がゲストであることを確かめる。
  --    **トレーナーや管理者を、まちがって消せないようにする**
  select role into v_role from public.profiles where id = p_learner;
  if v_role is null then
    raise exception 'そのゲストは見つかりません';
  end if;
  if v_role <> 'learner' then
    raise exception 'ゲスト以外は消せません(いまの役割: %)', v_role;
  end if;

  -- ③ 置いてあるファイルの中身。**表より先に消す。**
  --    先に控えを消すと、どのファイルがその人のものだったか分からなくなる
  delete from storage.objects
   where bucket_id = 'learner-files'
     and name like p_learner::text || '/%';
  get diagnostics v_n = row_count;
  v_out := v_out || jsonb_build_object('置いたファイル', v_n);

  delete from public.learner_files where learner_id = p_learner;
  get diagnostics v_n = row_count;
  v_out := v_out || jsonb_build_object('ファイルの控え', v_n);

  -- ④ 学習の記録
  delete from public.qr_reviews where learner_id = p_learner;
  get diagnostics v_n = row_count;
  v_out := v_out || jsonb_build_object('Quick Response の復習', v_n);

  -- ★ 0042 で足した2つ。**`auth.users` を参照しているので、
  --    `profiles` を消しても道連れにならない。明示的に消す**
  --    (`vocab_days` / `practice_days` と同じ・CLAUDE.md)
  delete from public.qr_days where learner_id = p_learner;
  get diagnostics v_n = row_count;
  v_out := v_out || jsonb_build_object('文の日ごとの記録', v_n);

  delete from public.weekly_goals where learner_id = p_learner;
  get diagnostics v_n = row_count;
  v_out := v_out || jsonb_build_object('週の目標', v_n);

  delete from public.word_reviews where learner_id = p_learner;
  get diagnostics v_n = row_count;
  v_out := v_out || jsonb_build_object('単語帳', v_n);

  delete from public.vocab_days where learner_id = p_learner;
  get diagnostics v_n = row_count;
  v_out := v_out || jsonb_build_object('単語の日ごとの記録', v_n);

  delete from public.practice_days where learner_id = p_learner;
  get diagnostics v_n = row_count;
  v_out := v_out || jsonb_build_object('取り組みの記録', v_n);

  delete from public.material_progress where learner_id = p_learner;
  get diagnostics v_n = row_count;
  v_out := v_out || jsonb_build_object('やりかけの途中経過', v_n);

  delete from public.attempts where user_id = p_learner;
  get diagnostics v_n = row_count;
  v_out := v_out || jsonb_build_object('解答の記録', v_n);

  delete from public.study_logs where user_id = p_learner;
  get diagnostics v_n = row_count;
  v_out := v_out || jsonb_build_object('学習時間の記録', v_n);

  -- ⑤ レッスンにまつわるもの
  --    `lesson_feedback_tags` は `on delete cascade` なので、一緒に消える
  delete from public.lesson_feedback where learner_id = p_learner;
  get diagnostics v_n = row_count;
  v_out := v_out || jsonb_build_object('レッスンの記録', v_n);

  delete from public.lesson_notes where learner_id = p_learner;
  get diagnostics v_n = row_count;
  v_out := v_out || jsonb_build_object('セッションの記録', v_n);

  delete from public.learner_scores where learner_id = p_learner;
  get diagnostics v_n = row_count;
  v_out := v_out || jsonb_build_object('スコア', v_n);

  delete from public.reminders where learner_id = p_learner;
  get diagnostics v_n = row_count;
  v_out := v_out || jsonb_build_object('リマインド', v_n);

  delete from public.wordbook_views where learner_id = p_learner;
  get diagnostics v_n = row_count;
  v_out := v_out || jsonb_build_object('単語帳を見た記録', v_n);

  -- ⑥ 配った教材の記録。**教材そのものは消さない**(スクールの共有物)
  delete from public.assignments where learner_id = p_learner;
  get diagnostics v_n = row_count;
  v_out := v_out || jsonb_build_object('配った教材の記録', v_n);

  -- ⑦ 担当の割り当て
  delete from public.learner_admins where learner_id = p_learner;
  get diagnostics v_n = row_count;
  v_out := v_out || jsonb_build_object('担当の割り当て', v_n);

  -- ⑧ 最後に本人の欄。**名前も、選んだアイコンも、レベルも消える**
  delete from public.profiles where id = p_learner;
  get diagnostics v_n = row_count;
  v_out := v_out || jsonb_build_object('ゲストの欄', v_n);

  return v_out;
end;
$$;

revoke all on function public.erase_learner(uuid) from public;
grant execute on function public.erase_learner(uuid) to authenticated;

comment on function public.erase_learner(uuid) is
  'ゲスト1人の記録を、表をまたいでまとめて消す(管理者だけ)。'
  'ログインそのもの(auth.users)は消さない —— Supabase の画面から消す。';
