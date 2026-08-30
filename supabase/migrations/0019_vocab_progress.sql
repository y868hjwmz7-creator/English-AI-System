-- ============================================================================
-- 0019 単語帳の続き — 続けた記録・トレーナーが見たこと・業界別の集計
--
-- 【なぜ要るか】(2026-08 の提案を利用者が全部採用)
--   ① **続けた記録**。終わりと積み上がりが見えないと続かない。
--      ただし**日ではなく週で数える。** レッスンが週2回なのだから週が自然で、
--      1日休んでも壊れない。壊れない記録だけが続く
--   ② **トレーナーが見た**ことを、ゲストに見えるようにする。
--      人が見ていると分かることが、どんなバッジより効く
--   ③ **業界別に、覚えた語を数える。** 自分の仕事の語が増えるのは、
--      大人の学習者にいちばん効く
--
-- 【何をするか】
--   ・`vocab_days`      … 日ごとの答えた数(語ではなく回数)
--   ・`wordbook_views`  … トレーナーが単語帳を見た記録
--   ・`mark_word()`     … 答えるたびに `vocab_days` を1つ増やす
--   ・`vocab_week()`    … 今週の日数・回数・正解率
--   ・`vocab_by_industry()` … 業界別に覚えた語の数
--   ・`note_wordbook_view()` … トレーナーが見たことを記録する
--
-- 【なぜ日ごとの表を作るのか】
--   `word_reviews.updated_at` は**上書きされる。** 月曜に答えて水曜に
--   答え直すと、月曜の記録が消える。「何日続けたか」は数えられない。
--   だから日ごとに1行だけ持つ。**1人1日1行なので、年に365行しか増えない。**
--
-- 【何度実行してもよい】
-- ============================================================================

-- ────────────────────────────────────────────────────────────────
-- 1. 日ごとの記録
-- ────────────────────────────────────────────────────────────────
create table if not exists public.vocab_days (
  learner_id uuid    not null references auth.users(id) on delete cascade,
  done_on    date    not null default current_date,
  answered   integer not null default 0,   -- 答えた回数(同じ語を2回なら2)
  correct    integer not null default 0,   -- そのうち「覚えた」を選んだ回数
  primary key (learner_id, done_on)
);

alter table public.vocab_days enable row level security;

drop policy if exists "自分と担当トレーナーが見る" on public.vocab_days;
create policy "自分と担当トレーナーが見る" on public.vocab_days
  for select to authenticated
  using (learner_id = auth.uid() or public.teaches(learner_id) or public.is_owner());

-- **書けるのは本人だけ。** 担当トレーナーでも書けない。
-- 学習の記録は本人のものである(0011 の word_reviews と同じ考え方)
drop policy if exists "自分の記録だけ書ける" on public.vocab_days;
create policy "自分の記録だけ書ける" on public.vocab_days
  for all to authenticated
  using (learner_id = auth.uid()) with check (learner_id = auth.uid());

comment on table public.vocab_days is
  '単語帳を何日やったかを数えるための、日ごとの記録。1人1日1行。'
  'word_reviews.updated_at は上書きされるので、そちらでは数えられない。';

-- ────────────────────────────────────────────────────────────────
-- 2. トレーナーが単語帳を見た記録
--
--   **人が見ていると分かることが、いちばん効く。**
--   ゲストの画面に「◯◯トレーナーが見ました」と出すために使う。
-- ────────────────────────────────────────────────────────────────
create table if not exists public.wordbook_views (
  learner_id uuid        not null references auth.users(id) on delete cascade,
  trainer_id uuid        not null references auth.users(id) on delete cascade,
  viewed_at  timestamptz not null default now(),
  primary key (learner_id, trainer_id)
);

alter table public.wordbook_views enable row level security;

drop policy if exists "本人と見た人が読む" on public.wordbook_views;
create policy "本人と見た人が読む" on public.wordbook_views
  for select to authenticated
  using (learner_id = auth.uid() or trainer_id = auth.uid() or public.is_owner());

-- 担当しているゲストのぶんだけ、自分の名前で残せる
drop policy if exists "担当トレーナーが残す" on public.wordbook_views;
create policy "担当トレーナーが残す" on public.wordbook_views
  for all to authenticated
  using (trainer_id = auth.uid() and public.teaches(learner_id))
  with check (trainer_id = auth.uid() and public.teaches(learner_id));

comment on table public.wordbook_views is
  'トレーナーがそのゲストの単語帳を見た記録。ゲストの画面に出す。';

-- ────────────────────────────────────────────────────────────────
-- 3. 答えるたびに、日ごとの記録を1つ増やす
--
--   `mark_word()` の中で行う。**画面から別に呼ばせない。**
--   呼び忘れれば記録が欠け、欠けた記録は二度と埋められない。
-- ────────────────────────────────────────────────────────────────
drop function if exists public.mark_word(text, text, text, uuid);
drop function if exists public.mark_word(text, text, text, uuid, text);
drop function if exists public.mark_word(text, text, text, uuid, text, text);

create or replace function public.mark_word(
  p_norm        text,
  p_status      text,
  p_kind        text default 'word',
  p_material    uuid default null,
  p_sentence    text default null,
  p_sentence_ja text default null
)
returns table (word_norm text, status text, box smallint, due_on date)
language plpgsql
volatile
set search_path = public
as $$
-- 返す列の名前は表の列名と同じである。**同じ名前があると plpgsql は止まる。**
-- 迷ったら列のほうを指すと決めておく
#variable_conflict use_column
declare
  v_norm     text;
  v_box      smallint;
  v_days     int;
  v_sentence text;
  v_ja       text;
begin
  v_norm := public.norm_word(p_norm);
  if v_norm is null then
    raise exception '語が空です';
  end if;
  if p_status is null or p_status not in ('known', 'unknown') then
    raise exception '状態は known か unknown です';
  end if;

  -- 文が長すぎると復習の画面で読みにくい。**入口で切る。**
  v_sentence := nullif(btrim(regexp_replace(coalesce(p_sentence, ''), '\s+', ' ', 'g')), '');
  if v_sentence is not null then
    v_sentence := left(v_sentence, 300);
  end if;
  v_ja := nullif(btrim(regexp_replace(coalesce(p_sentence_ja, ''), '\s+', ' ', 'g')), '');
  if v_ja is not null then
    v_ja := left(v_ja, 300);
  end if;

  select r.box into v_box
    from public.word_reviews r
   where r.learner_id = auth.uid() and r.word_norm = v_norm;
  v_box := coalesce(v_box, 0);

  if p_status = 'unknown' then
    -- 分からなかったものは、いちばん下の箱に戻して翌日また出す
    v_box := 0;
    v_days := 1;
  else
    v_box := least(v_box + 1, 6);
    v_days := case v_box
                when 1 then 1
                when 2 then 2
                when 3 then 4
                when 4 then 7
                when 5 then 14
                else 30
              end;
  end if;

  -- 続けた記録(0019)。**答えた回数をここで数える。**
  insert into public.vocab_days as d (learner_id, done_on, answered, correct)
  values (auth.uid(), current_date, 1, case when p_status = 'known' then 1 else 0 end)
  on conflict (learner_id, done_on) do update
    set answered = d.answered + 1,
        correct  = d.correct + case when p_status = 'known' then 1 else 0 end;

  return query
  insert into public.word_reviews as w
    (learner_id, word_norm, kind, status, box, due_on, material_id,
     seen_in, seen_in_ja, updated_at)
  values
    (auth.uid(), v_norm, coalesce(p_kind, 'word'), p_status,
     v_box, current_date + v_days, p_material, v_sentence, v_ja, now())
  on conflict (learner_id, word_norm) do update
    set status      = excluded.status,
        kind        = excluded.kind,
        box         = excluded.box,
        due_on      = excluded.due_on,
        -- どの教材で出会ったかは、**最初のものを残す**
        material_id = coalesce(w.material_id, excluded.material_id),
        -- 出会った文も同じ。**最初の1文が思い出の手がかりになる**
        seen_in     = coalesce(w.seen_in, excluded.seen_in),
        seen_in_ja  = coalesce(w.seen_in_ja, excluded.seen_in_ja),
        updated_at  = now()
  returning w.word_norm, w.status, w.box, w.due_on;
end;
$$;

comment on function public.mark_word(text, text, text, uuid, text, text) is
  '語や句に「知っていた / 知らなかった」を付け、次に出す日を決める。'
  '出会った文も控え、続けた記録(vocab_days)も1つ増やす。'
  '間隔の決まりはこの関数だけが持つ。';

-- ────────────────────────────────────────────────────────────────
-- 4. 今週の続き具合
--
--   **週で数える。** 日ごとの連続記録は、1日休んだだけで途切れる。
--   途切れる記録は、途切れた瞬間にやめる理由になる(2026-08 の判断)。
--   週の始まりは月曜(レッスンの週と合わせる)。
-- ────────────────────────────────────────────────────────────────
create or replace function public.vocab_week(p_learner uuid default null)
returns table (
  days      integer,   -- 今週やった日数
  answered  integer,   -- 今週答えた回数
  correct   integer,   -- そのうち「覚えた」
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
    select d.* from public.vocab_days d join allowed a on a.id = d.learner_id
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
  -- 上から順に「1週ずつきちんと下がっているか」を見る。
  -- どこかで1週抜けると、そこから下は式に合わなくなる
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

comment on function public.vocab_week(uuid) is
  '今週の単語帳の続き具合。日ではなく週で数える(1日休んでも壊れない)。';

-- ────────────────────────────────────────────────────────────────
-- 5. 業界別に、覚えた語を数える
--
--   語そのものには業界が付いていない。**出会った教材の業界**で数える。
--   自分の仕事の語が増えていくのが見えることに意味がある。
-- ────────────────────────────────────────────────────────────────
create or replace function public.vocab_by_industry(p_learner uuid default null)
returns table (industry text, known integer, learning integer)
language sql
stable
security definer
set search_path = public
as $$
  with me as (select coalesce(p_learner, auth.uid()) as id),
  allowed as (
    select id from me
     where id = auth.uid() or public.teaches(id) or public.is_owner()
  )
  select
    coalesce(m.industry, 'general') as industry,
    count(*) filter (where r.status = 'known')::int    as known,
    count(*) filter (where r.status = 'unknown')::int  as learning
  from public.word_reviews r
  join allowed a on a.id = r.learner_id
  left join public.materials m on m.id = r.material_id
  group by coalesce(m.industry, 'general')
  order by 2 desc, 1;
$$;

comment on function public.vocab_by_industry(uuid) is
  '業界別に、覚えた語と覚えかけの語を数える。業界は出会った教材のもの。';

-- ────────────────────────────────────────────────────────────────
-- 6. トレーナーが「見た」ことを残す
-- ────────────────────────────────────────────────────────────────
create or replace function public.note_wordbook_view(p_learner uuid)
returns void
language sql
volatile
set search_path = public
as $$
  insert into public.wordbook_views (learner_id, trainer_id, viewed_at)
  values (p_learner, auth.uid(), now())
  on conflict (learner_id, trainer_id) do update set viewed_at = now();
$$;

comment on function public.note_wordbook_view(uuid) is
  'トレーナーがそのゲストの単語帳を見たことを残す。ゲストの画面に出す。';

-- ────────────────────────────────────────────────────────────────
-- 7. 権限
-- ────────────────────────────────────────────────────────────────
grant execute on function public.mark_word(text, text, text, uuid, text, text) to authenticated;
grant execute on function public.vocab_week(uuid)                              to authenticated;
grant execute on function public.vocab_by_industry(uuid)                       to authenticated;
grant execute on function public.note_wordbook_view(uuid)                      to authenticated;
