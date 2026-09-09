-- ============================================================================
-- 0052 文法30日集中講座 — 進み具合の置き場と、足りなかった文法タグ
--
-- 【なぜ要るか】(2026-09 利用者の指定)
--
--   > pre basic と basic に基礎単語習得モードとか文法30日集中講座などが
--   > 欲しい。日本ではいわゆる中学英語と呼ばれるものだ。
--   > ただ網羅するのではなく、単語と基礎的な文法の仕組みを
--   > 楽しんで身に付けられるコースにして欲しい。
--
--   30日の中身も、1,200 語の単語も**コードの中にある**
--   (`src/data/basicsCourse.js` / `src/data/basicWords.js`)。
--   ここで足すのは「**誰が、どの段の、何日目を終えたか**」だけである。
--
-- 【何が起きるか】
--   ・表が1つ増えます(`course_days`)。**空から始まります。**
--   ・弱点タグが4つ増えます(be動詞 / 動詞の形 / 疑問文 / 三人称単数の -s)。
--   ・`erase_learner()` が作り直されます
--     (**中身は 0042 のものに、消す表を1つ足しただけ**)。
--   ・教材・宿題・ゲストの情報には**一切さわりません。**
--   ・**何度実行してもよい**です。
--
-- 【貼る前でも壊れない】
--   講座の画面は、一度断られたらそのあと呼びに行かない。
--   進み具合が残らないだけで、30日の中身も単語もそのまま見られます。
-- ============================================================================

-- ────────────────────────────────────────────────────────────────
-- 1. 足りなかった文法タグ4つ
--
--    30日の講座を作るときに、**この4つだけ行き先が無かった。**
--    どれも「まだないもので一般的なもの」(利用者の指定)そのもので、
--    しかも**つまずく人がいちばん多いところ**である。
--
--    **画面(`src/data/weaknessTags.js`)にも同じものが入っている。**
--    片方だけに足すと、そのタグを付けた教材を発行した瞬間に
--    外部キー違反で止まる(0050 とまったく同じ落とし穴)。
-- ────────────────────────────────────────────────────────────────
insert into public.weakness_tags (id, category, kind, label, hint, sort_order) values
  ('be-verb',      'grammar', 'weakness', 'be動詞',
   'am / is / are / was / were。一般動詞と2つ並べない', 515),
  ('verb-form',    'grammar', 'weakness', '動詞の形',
   '原形・-s・-ing・過去形。どれを置くかで意味が変わる', 516),
  ('question',     'grammar', 'weakness', '疑問文',
   'Do / Does / Did、be動詞を前へ。答え方もそろえる', 517),
  ('third-person', 'grammar', 'weakness', '三人称単数の -s',
   'he / she / it のときだけ動詞に -s。does のうしろは原形', 518)
on conflict (id) do update
  set category = excluded.category,
      kind     = excluded.kind,
      label    = excluded.label,
      hint     = excluded.hint;

-- ────────────────────────────────────────────────────────────────
-- 2. 講座の進み具合
--
--    **ゲスト × 段 × 日で1行**(`vocab_days` / `practice_days` と同じ形)。
--    「終えた」ことだけを残す。**点数も時間も持たない** ——
--    講座は測るためのものではなく、順にたどるためのものである。
--
--    **`auth.users` を参照する**(`vocab_days` と同じ)。
--    したがって `profiles` を消しても道連れにならないので、
--    `erase_learner()` の側で明示的に消す(下の 4)。
-- ────────────────────────────────────────────────────────────────
create table if not exists public.course_days (
  learner_id uuid        not null references auth.users(id) on delete cascade,
  course     text        not null check (course in ('core', 'full')),
  day        integer     not null check (day between 1 and 30),
  done_at    timestamptz not null default now(),
  primary key (learner_id, course, day)
);

comment on table public.course_days is
  '文法30日集中講座の進み具合。ゲスト × 段(core / full)× 日で1行。'
  '中身(30日の文法と1,200語)はコード側が持つ。ここは「終えた」だけ。';

alter table public.course_days enable row level security;

-- **自分の記録は読み書きできる。担当トレーナーと管理者は読める。**
-- 判定は 0001 の `teaches()` / `is_owner()` を使い回す。**新しい判定を作らない**
drop policy if exists "自分と担当トレーナーが見る" on public.course_days;
create policy "自分と担当トレーナーが見る"
  on public.course_days for select
  using (
    learner_id = auth.uid()
    or public.teaches(learner_id)
    or public.is_owner()
  );

-- **書けるのは本人だけ。** 講座はゲストが自分で進めるものなので、
-- トレーナーが代わりに「終えた」ことにする道は作らない
drop policy if exists "自分の記録だけ書ける" on public.course_days;
create policy "自分の記録だけ書ける"
  on public.course_days for insert
  with check (learner_id = auth.uid());

drop policy if exists "自分の記録だけ消せる" on public.course_days;
create policy "自分の記録だけ消せる"
  on public.course_days for delete
  using (learner_id = auth.uid());

grant select, insert, delete on public.course_days to authenticated;

-- ────────────────────────────────────────────────────────────────
-- 3. 何日目まで終えたか(読む側)
--
--    **画面で数え直さない。** 終えた日の番号だけを返す
--    (「次はどこか」「何%か」は `src/lib/basicsCourse.js` が出す)。
--
--    **返す列を変える関数は、先に drop を置く**(CLAUDE.md)。
-- ────────────────────────────────────────────────────────────────
drop function if exists public.course_progress(uuid, text);

create or replace function public.course_progress(p_learner uuid, p_course text)
returns table (day integer, done_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select c.day, c.done_at
    from public.course_days c
   where c.learner_id = coalesce(p_learner, auth.uid())
     and c.course = p_course
     and (
       coalesce(p_learner, auth.uid()) = auth.uid()
       or public.teaches(coalesce(p_learner, auth.uid()))
       or public.is_owner()
     )
   order by c.day;
$$;

revoke all on function public.course_progress(uuid, text) from public;
grant execute on function public.course_progress(uuid, text) to authenticated;

-- ────────────────────────────────────────────────────────────────
-- 4. ゲストをまとめて消すときに、講座の記録も消す
--
--    **表を足したら、消す側にも足す**(CLAUDE.md)。
--    中身は 0042 のものと**1か所しか違わない**(`course_days` を消す行)。
-- ────────────────────────────────────────────────────────────────
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

  -- ★ 0052 で足した1つ。**`auth.users` を参照しているので、
  --    `profiles` を消しても道連れにならない。明示的に消す**
  delete from public.course_days where learner_id = p_learner;
  get diagnostics v_n = row_count;
  v_out := v_out || jsonb_build_object('講座の進み具合', v_n);

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
