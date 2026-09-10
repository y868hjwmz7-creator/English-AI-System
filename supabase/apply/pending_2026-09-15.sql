-- ============================================================================
-- 0054 スピーチの原稿を置く(スピーチ練習)
--
-- 【なぜ要るか】(2026-09 利用者の指定)
--
--   > スピーチ練習を実装しましょう。
--   > これは、ゲストアカウントのスピーチ内から受け取ったスピーチの原稿を
--   > AIにより添削し、そしてその文の音声を作成、ゲスト側で練習できる
--   > 機能です。トレーナー側からもゲスト毎にスピーチを登録できます。
--   > そして、単語帳にはスピーチの単語帳も作ります。
--
--   書いた英文の添削は、もう通っている道がある
--   (`generate-material` の `mode: 'review_writing'`・第5.104節)。
--   ところがあれは**教材の中の設問に書いた答え**を直すもので、
--   置き場所は `material_progress`(0025)である。
--   あの表は `material_id` が **not null** なので、
--   **教材に結び付かないスピーチの原稿は置けない。**
--
--   だから置き場所だけを1つ足す。**添削も、音声も、単語帳も、
--   すでにある道をそのまま使う**(CLAUDE.md「新しい仕組みを作らない」)。
--
-- 【ゲスト × スピーチで1行】
--
--   1人が何本も持つ(先月のプレゼン・来週の乾杯の挨拶)。
--   日付では数えない —— 同じ日に2本書くことも、
--   1本を何日もかけて直すこともある。だから id を持つ。
--
-- 【誰が書けて、誰が読めるか】
--
--   ・**ゲスト本人**……自分の原稿を書ける・読める・消せる
--   ・**担当トレーナー(と管理者)**……そのゲストの原稿を
--     書ける・読める・消せる(利用者の指定
--     「トレーナー側からもゲスト毎にスピーチを登録できます」)
--
--   `lesson_notes`(0032)とは**ここが違う。** あちらは
--   「トレーナーが書いてゲストに渡す記録」なのでゲストは読むだけだが、
--   こちらは**ゲストが書いたものをトレーナーが直す**ものである。
--   `material_progress`(0025)の
--   「**あとから書いたほうが上書きしてよい**」と同じ考え方
--   (利用者の確認「添削できるからその方が良いです」)。
--
--   他のゲストからは、あることさえ見えない。
--
-- 【添削の結果は、そのまま jsonb で持つ】
--
--   窓口が返す形(`sentences` / `notes` / `phrases` / `good`)を
--   **1行も読み替えずに**置く。**DB は中身を読まない。**
--   読み取るのは画面の `normalizeReview()` 1か所である
--   (`material_progress.data` とまったく同じ作法)。
--
-- 【何が起きるか】
--   ・表が1つ増えます(`speeches`)。**空から始まります。**
--   ・`erase_learner()` が作り直されます
--     (**中身は 0052 のものに、消す表を1つ足しただけ**)。
--   ・教材・宿題・単語帳・ゲストの情報には**一切さわりません。**
--
-- 【どこまで影響するか】
--   いま入っているものは1行も書き換わりません。消えるものもありません。
--
-- 【貼る前でも壊れない】
--   スピーチの画面は、一度断られたらそのあと呼びに行かない。
--   **スピーチが使えないだけ**で、教材も単語帳も今までどおり動きます。
--
-- 【何度貼っても安全】
--   `create table if not exists` / `drop policy if exists` /
--   `create or replace`。
--
-- 【成功の目安】
--   `Success. No rows returned` と出れば成功です。
-- ============================================================================

-- ────────────────────────────────────────────────────────────────
-- 1. 表
-- ────────────────────────────────────────────────────────────────
create table if not exists public.speeches (
  id          uuid primary key default gen_random_uuid(),
  -- **誰のスピーチか。** トレーナーが登録したものも、ゲストのものになる
  learner_id  uuid not null references public.profiles(id) on delete cascade,
  -- 題名。**空でもよい**(画面が原稿の1行目から作る)
  title       text not null default '',
  -- 原稿そのもの。**そのまま持つ**(段落に切るのは画面の仕事)
  draft       text not null default '',
  -- 添削の結果。**窓口が返した形のまま**(DB は中身を読まない)
  review      jsonb,
  -- どの調子で直したか(`writingTones.js` の id)
  tone        text,
  -- 読み上げの声(`clipVoices.js` の id)。**名簿はコード側にある**
  voice_id    text,
  -- 最初に置いた人。**ゲスト本人か、登録したトレーナーか**が分かる
  created_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.speeches is
  'スピーチの原稿と、その添削(0054)。ゲスト×スピーチで1行。'
  'ゲスト本人も、担当トレーナー(と管理者)も書ける。'
  'あとから書いたほうが上書きする(レッスンで直せるように・0025 と同じ考え方)。';

-- 一覧は「新しい順」で出す
create index if not exists speeches_learner_idx
  on public.speeches (learner_id, updated_at desc);

alter table public.speeches enable row level security;

-- ────────────────────────────────────────────────────────────────
-- 2. 誰に見えて、誰が書けるか
--
--    `teaches()` / `is_owner()` は 0001 からある判定である。
--    **新しい判定を作らない**(CLAUDE.md)。
-- ────────────────────────────────────────────────────────────────

-- 見る … 本人・担当トレーナー・管理者
drop policy if exists "自分と担当ゲストのスピーチを見る" on public.speeches;
create policy "自分と担当ゲストのスピーチを見る" on public.speeches
  for select to authenticated
  using (learner_id = auth.uid() or public.teaches(learner_id) or public.is_owner());

-- 置く … 同じ人。**置いた人は自分でなければならない**
--   (`lesson_notes` の `updated_by` と同じ作法。他人の名前で置かせない)
drop policy if exists "自分と担当ゲストのスピーチを置ける" on public.speeches;
create policy "自分と担当ゲストのスピーチを置ける" on public.speeches
  for insert to authenticated
  with check (
    (learner_id = auth.uid() or public.teaches(learner_id) or public.is_owner())
    and created_by = auth.uid()
  );

-- 書き直す … 同じ人。**`with check` も付ける。**
--   `using` だけだと、書き直すついでに別のゲストの行へ move できる
--
--   **`created_by` はここでは見ない。** 最初に置いた人はそのまま残る
--   (ゲストが書いた原稿を、トレーナーが直せなければ意味がない)
drop policy if exists "自分と担当ゲストのスピーチを書き直せる" on public.speeches;
create policy "自分と担当ゲストのスピーチを書き直せる" on public.speeches
  for update to authenticated
  using (learner_id = auth.uid() or public.teaches(learner_id) or public.is_owner())
  with check (learner_id = auth.uid() or public.teaches(learner_id) or public.is_owner());

-- 消す … 同じ人
drop policy if exists "自分と担当ゲストのスピーチを消せる" on public.speeches;
create policy "自分と担当ゲストのスピーチを消せる" on public.speeches
  for delete to authenticated
  using (learner_id = auth.uid() or public.teaches(learner_id) or public.is_owner());

grant select, insert, update, delete on public.speeches to authenticated;

-- ────────────────────────────────────────────────────────────────
-- 3. 書いた時刻は、こちらで入れる
--
--    画面から `updated_at` を送らせると、**端末の時計**で決まる。
--    時差やずれた時計で並びが狂うので、DB で入れる
--    (`lesson_notes` の trigger とまったく同じ・CLAUDE.md)。
-- ────────────────────────────────────────────────────────────────
create or replace function public.touch_speech()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists speeches_touch on public.speeches;
create trigger speeches_touch
  before update on public.speeches
  for each row execute function public.touch_speech();

-- ────────────────────────────────────────────────────────────────
-- 4. ゲストをまとめて消すときに、スピーチも消す
--
--    **表を足したら、消す側にも足す**(CLAUDE.md)。
--    中身は 0052 のものと**1か所しか違わない**(`speeches` を消す行)。
--
--    `speeches` は `profiles` を参照しているので `on delete cascade` でも
--    消えるが、**何件消えたのかを利用者に返すために**明示的に消す
--    (`lesson_notes` とまったく同じ扱い)。
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

  -- ★ 0054 で足した1つ。**何件消えたのかを返すために明示的に消す**
  delete from public.speeches where learner_id = p_learner;
  get diagnostics v_n = row_count;
  v_out := v_out || jsonb_build_object('スピーチ', v_n);

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
