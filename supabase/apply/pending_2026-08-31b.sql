-- ============================================================================
-- ★ Supabase の SQL Editor に、これを丸ごと貼って Run してください ★
--
-- 【これは何か】
--   0025(レッスンでの取り組みを「ゲストの記録」にする)だけです。
--   0024 までは、すでに実行済みのはずです。
--
-- 【何が起きるか】
--   ・レッスン中にトレーナーが付けた「知らなかった」が、
--     **そのゲストの単語帳**に入るようになります
--   ・レッスンで一緒に取り組んだ時間が、**そのゲストの取り組み**に数えられます
--   ・`material_progress` という表が1つ増えます。**空から始まります。**
--     スラッシュの区切り・ディクテーションの書きかけが、ここに入ります
--
-- 【どこまで影響するか】
--   ・**いまある単語帳・宿題・教材・集計には、いっさい触れません**
--   ・トレーナーが「教材」画面で自分のために付けた語は、
--     **これまでどおりトレーナー自身の記録**です(2026-08 のご確認どおり)
--   ・**担当していないゲストの記録には書けません。**
--     表の決まり(RLS)は1文字も緩めていません。
--     代わりに、関数の中だけで「担当かどうか」を確かめています
--
-- 【何度貼っても安全です】
--   すでに入っていれば飛ばされます。迷ったら、そのまま貼ってください。
--
-- 【どうなれば成功か】
--   `Success. No rows returned` と出れば成功です。
--   途中に緑の NOTICE(「... does not exist, skipping」)が出ますが、
--   **それは正常です**(まだ無いものを消そうとしただけです)。
-- ============================================================================

-- ============================================================================
-- 0025 レッスンでの取り組みを「ゲストの記録」にする
--
-- 【なぜ変えるのか】(2026-08 利用者の確認と指定)
--
--   > ゲストモードに入り、レッスンに入ったらそのゲストのカード内に入り、
--   > あとはそこで全てができるようにしてほしい。(中略)
--   > そこで取り組んだ教材で「知らなかった」単語は常にゲスト側でも同じ扱いを
--   > し、スラッシュリーディングの区切りやディクテーションで書き込んだことや、
--   > 取り組んだ回数なども同じ扱いとしてゲスト側に共有され保存される。
--
--   レッスンは**トレーナーとゲストが一緒に**進める。だからレッスン中に
--   付けた「知らなかった」も、書き込んだ区切りも、取り組んだ時間も、
--   **ゲストの学習そのもの**である。これまでは押した人自身の記録になっており、
--   ゲストの単語帳には何も残らなかった。
--
--   **これは第5.23.5節の設計の転換である。** 利用者に確認したうえで変える。
--
-- 【3つのことを変える】
--   ① `mark_word()`   … 誰の記録にするかを選べるようにする
--   ② `log_practice()`… 同じく
--   ③ `material_progress`(新しい表)… 区切り・書きかけを端末の外に出す
--
-- 【RLS は緩めない】
--   `word_reviews` / `practice_days` の**行の決まりは1文字も変えない。**
--   代わりに、①②を `security definer` にして
--   **関数の中だけで「担当しているゲストか」を確かめる。**
--   窓口を1つに絞るほうが、表そのものを開けるより穴が小さい。
--   `supabase/test/rls_test.sql` が「担当外には書けない」を見張る。
--
-- 【トレーナー自身の記録は、これまでどおり】(利用者の確認)
--   > トレーナーが「教材」画面で自分のために触った語は、
--   > これまでどおりトレーナー自身の記録でよいですか → はい
--
--   `p_learner` を渡さなければ、いままでと同じ(押した人の記録)になる。
--
-- 【何度貼っても安全】
--   `create table if not exists` / `create or replace` / `drop ... if exists`。
-- ============================================================================

-- ────────────────────────────────────────────────────────────────
-- 1. 誰の記録にするかを選べる mark_word()
--
--   **引数が増えるので、古いものを drop する。**
--   同じ名前の関数が2つ残ると PostgREST が「どちらか分からない」と断り、
--   画面から呼べなくなる(CLAUDE.md)。
-- ────────────────────────────────────────────────────────────────
drop function if exists public.mark_word(text, text, text, uuid, text, text);
drop function if exists public.mark_word(text, text, text, uuid);
drop function if exists public.mark_word(text, text, text, uuid, text, text, uuid);

create or replace function public.mark_word(
  p_norm        text,
  p_status      text,
  p_kind        text default 'word',
  p_material    uuid default null,
  p_sentence    text default null,
  p_sentence_ja text default null,
  -- **誰の記録にするか。** 渡さなければ押した人自身(これまでどおり)
  p_learner     uuid default null
)
returns table (word_norm text, status text, box smallint, due_on date)
language plpgsql
volatile
-- **security definer。** 担当ゲストの行に書くために要る。
-- 判定はこの関数の中だけで行う(表の RLS は緩めない)
security definer
set search_path = public
as $$
-- 返す列の名前は表の列名と同じである。**同じ名前があると plpgsql は止まる。**
-- 迷ったら列のほうを指すと決めておく
#variable_conflict use_column
declare
  v_who      uuid;
  v_norm     text;
  v_box      smallint;
  v_days     int;
  v_sentence text;
  v_ja       text;
begin
  if auth.uid() is null then
    raise exception 'ログインしていません';
  end if;

  -- **誰の記録にするか。** 自分か、担当しているゲストだけ。
  -- ここが唯一の門番である(security definer なので RLS は通らない)
  v_who := coalesce(p_learner, auth.uid());
  if v_who <> auth.uid()
     and not public.teaches(v_who)
     and not public.is_owner() then
    raise exception '担当していないゲストの記録には書けません';
  end if;

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
   where r.learner_id = v_who and r.word_norm = v_norm;
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
  --
  -- **レッスンで一緒に取り組んだ分も、ゲストの学習に数える**(利用者の指定)。
  --   > セッションで一緒に取り組んでいるので学習時間に入りますので
  --   > 答えは「はい」
  insert into public.vocab_days as d (learner_id, done_on, answered, correct)
  values (v_who, current_date, 1, case when p_status = 'known' then 1 else 0 end)
  on conflict (learner_id, done_on) do update
    set answered = d.answered + 1,
        correct  = d.correct + case when p_status = 'known' then 1 else 0 end;

  return query
  insert into public.word_reviews as w
    (learner_id, word_norm, kind, status, box, due_on, material_id,
     seen_in, seen_in_ja, updated_at)
  values
    (v_who, v_norm, coalesce(p_kind, 'word'), p_status,
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

comment on function public.mark_word(text, text, text, uuid, text, text, uuid) is
  '語や句に「知っていた / 知らなかった」を付け、次に出す日を決める。'
  'p_learner を渡すと、担当しているゲストの記録として残す(0025)。'
  '渡さなければ押した人自身の記録。間隔の決まりはこの関数だけが持つ。';

-- ────────────────────────────────────────────────────────────────
-- 2. 取り組みも、ゲストの記録にできるようにする
--
--   レッスンで一緒に取り組んだ時間は**ゲストの学習時間**である(利用者の指定)。
-- ────────────────────────────────────────────────────────────────
drop function if exists public.log_practice(text, integer, integer);
drop function if exists public.log_practice(text, integer, integer, uuid);

create or replace function public.log_practice(
  p_kind    text,
  p_seconds integer default 0,
  p_times   integer default 1,
  -- **誰の取り組みにするか。** 渡さなければ押した人自身
  p_learner uuid default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_kind text := lower(trim(coalesce(p_kind, '')));
  v_who  uuid;
begin
  if auth.uid() is null then return; end if;

  v_who := coalesce(p_learner, auth.uid());
  -- **自分か、担当しているゲストだけ。** ここが唯一の門番である
  if v_who <> auth.uid()
     and not public.teaches(v_who)
     and not public.is_owner() then
    return;
  end if;

  -- **知らない種類は入れない。** 綴り違いで種類が増えていくのを防ぐ
  if v_kind not in ('homework', 'six_steps', 'quick_response', 'wordbook', 'pronunciation') then
    return;
  end if;

  insert into public.practice_days as d (learner_id, done_on, kind, times, seconds)
  values (
    v_who, current_date, v_kind,
    least(greatest(coalesce(p_times, 0), 0), 100),
    least(greatest(coalesce(p_seconds, 0), 0), 3600)
  )
  on conflict (learner_id, done_on, kind) do update
    set times   = d.times + excluded.times,
        seconds = d.seconds + excluded.seconds;
end;
$$;

comment on function public.log_practice(text, integer, integer, uuid) is
  '取り組みを1つ足す。p_learner を渡すと担当ゲストの分として数える(0025)。'
  'レッスンで一緒に取り組んだ時間は、ゲストの学習時間である。';

-- ────────────────────────────────────────────────────────────────
-- 3. 練習の途中経過を、端末の外に出す
--
--   スラッシュの区切り・ディクテーションの書きかけ・Quick Response の
--   進み具合は、これまで**その端末の中(localStorage)**にしか無かった。
--   ゲストの画面にも、トレーナーの別の端末にも出ない。
--
--   **あとから開いたほうが上書きしてよい**(利用者の指定)。
--     > レッスン中にトレーナーが書いたものが、ゲストの書きかけを
--     > 消してよいですか → 大丈夫です。添削できるからその方が良いです。
--
--   だから「どちらが新しいか」を争わせず、**書いた順にそのまま上書きする。**
--
--   `scope` は「どの演習の、何の途中か」の鍵(例 `sec-1.slash-para.marks`)。
--   画面が決める形をそのまま入れる。**DB は中身を読まない**(jsonb のまま)。
-- ────────────────────────────────────────────────────────────────
create table if not exists public.material_progress (
  learner_id  uuid not null references public.profiles(id) on delete cascade,
  material_id uuid not null references public.materials(id) on delete cascade,
  scope       text not null,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  primary key (learner_id, material_id, scope)
);

comment on table public.material_progress is
  '練習の途中経過(区切り・書きかけ・進み具合)。ゲストとトレーナーで共有する。'
  'あとから書いたほうが上書きする(レッスンで添削できるように・0025)。';

create index if not exists material_progress_learner_idx
  on public.material_progress (learner_id, updated_at desc);

alter table public.material_progress enable row level security;

-- **本人と、担当しているトレーナーだけ。**
-- owner(管理者)は**全体の集計だけを見る**ので、ここには入れない
drop policy if exists material_progress_read on public.material_progress;
create policy material_progress_read on public.material_progress
  for select to authenticated
  using (learner_id = auth.uid() or public.teaches(learner_id));

drop policy if exists material_progress_write on public.material_progress;
create policy material_progress_write on public.material_progress
  for insert to authenticated
  with check (learner_id = auth.uid() or public.teaches(learner_id));

drop policy if exists material_progress_update on public.material_progress;
create policy material_progress_update on public.material_progress
  for update to authenticated
  using (learner_id = auth.uid() or public.teaches(learner_id))
  with check (learner_id = auth.uid() or public.teaches(learner_id));

drop policy if exists material_progress_delete on public.material_progress;
create policy material_progress_delete on public.material_progress
  for delete to authenticated
  using (learner_id = auth.uid() or public.teaches(learner_id));

grant select, insert, update, delete on public.material_progress to authenticated;

-- ────────────────────────────────────────────────────────────────
-- 4. 権限(drop したので付け直す)
-- ────────────────────────────────────────────────────────────────
grant execute on function public.mark_word(text, text, text, uuid, text, text, uuid)
  to authenticated;
grant execute on function public.log_practice(text, integer, integer, uuid)
  to authenticated;
