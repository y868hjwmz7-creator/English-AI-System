-- ============================================================================
-- 0055 ゲストごとに「出すもの / 出さないもの」を決める
--
-- 【なぜ要るか】(2026-09 利用者の指定)
--
--   > ゲストの画面から
--   > 基礎英文法講座と基本単語を取り除いてください。
--   > これは、トレーナー側から指定したゲストにのみ映るようにしてください
--
--   文法30日集中講座と基礎単語(0052 / 0053)は、
--   **Pre-Basic と Basic のための道具**である(0052 の指定そのもの)。
--   ところがいまは**すべてのゲストの画面に出ている。**
--   B2 の人にも中学英語の講座が並ぶので、
--   「自分に要るもの」が読み取りにくくなっていた。
--
-- 【何が起きるか】
--   ・表が1つ増えます(`learner_features`)。**空から始まります。**
--   ・したがって、貼った直後は**どのゲストにも講座は出ません。**
--     出したいゲストは、トレーナーが
--     「ゲスト → その人を開く → レベルとスコア」で入れてください。
--   ・`erase_learner()` が作り直されます
--     (**中身は 0052 のものに、消す表を1つ足しただけ**)。
--   ・教材・宿題・単語帳・ゲストの情報には**一切さわりません。**
--   ・**何度実行してもよい**です。
--
-- 【貼る前でも壊れない】
--   表が無ければ「1つも開いていない」として読む。
--   つまり**既定のまま(講座は出ない)**で、ほかは何も変わりません。
--   トレーナーが入れようとしたときだけ、この 0055 が要ると画面が言います。
--
-- 【なぜ `profiles` に列を足さないのか】
--   `profiles` の更新は**列単位の grant**で絞ってある
--   (`display_name` / `industry` / `avatar` だけ)。
--   ここに列を足すと、トレーナーが書けるようにするために
--   その grant を広げることになり、**0001 で塞いだ穴**
--   (ゲストが自分の `role` を書き換えられた)に近づく。
--   **別の表にすれば、行ごと RLS で守れる**(`weekly_goals` と同じ形)。
--
-- 【なぜ `feature` に一覧(check)を付けないのか】
--   付けると、**次に1つ足すたびに SQL を貼り直してもらう**ことになる
--   (`material_sections_type_check` で二度踏んだ落とし穴と同じ形)。
--   ここは「どのゲストに何を出すか」だけを持つ入れ物なので、
--   **名前の一覧はコード側(`src/data/learnerFeatures.js`)が1か所で持つ。**
--   知らない名前が入っても、画面はそれを読まないだけで害がない。
-- ============================================================================

-- ────────────────────────────────────────────────────────────────
-- 1. ゲストごとの「出すもの」
--
--    **ゲスト × 名前で1行**(`weekly_goals` とほぼ同じ形)。
--    `enabled` が偽の行は「一度出したが、いまは出さない」である ——
--    行ごと消さないのは、**誰がいつ決めたか**を残すためである。
--
--    **`auth.users` を参照する**(`course_days` / `weekly_goals` と同じ)。
--    したがって `profiles` を消しても道連れにならないので、
--    `erase_learner()` の側で明示的に消す(下の 3)。
-- ────────────────────────────────────────────────────────────────
create table if not exists public.learner_features (
  learner_id uuid        not null references auth.users(id) on delete cascade,
  feature    text        not null,
  enabled    boolean     not null default false,
  set_by     uuid        references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (learner_id, feature)
);

comment on table public.learner_features is
  'ゲストごとに「この人にだけ出すもの」を決める。ゲスト × 名前で1行。'
  '行が無ければ「出さない」。名前の一覧はコード側'
  '(src/data/learnerFeatures.js)が持つ — ここに check を置くと、'
  '1つ足すたびに SQL を貼り直すことになる。';

alter table public.learner_features enable row level security;

-- **本人も読める。** 読めないと、ゲストの画面が何を出すか決められない
drop policy if exists "自分と担当トレーナーが見る" on public.learner_features;
create policy "自分と担当トレーナーが見る" on public.learner_features
  for select to authenticated
  using (learner_id = auth.uid() or public.teaches(learner_id) or public.is_owner());

-- **決められるのは担当トレーナー(と管理者)だけ。**
-- 自分で出せるなら「トレーナーが指定する」にならない(週の目標と同じ考え方)
drop policy if exists "担当トレーナーが決める" on public.learner_features;
create policy "担当トレーナーが決める" on public.learner_features
  for all to authenticated
  using (public.teaches(learner_id) or public.is_owner())
  with check (public.teaches(learner_id) or public.is_owner());

grant select, insert, update, delete on public.learner_features to authenticated;

-- ────────────────────────────────────────────────────────────────
-- 2. 決める窓口
--
--    **門番は関数の中だけ**(`set_weekly_goal()` と同じ作法)。
--    画面に持たせると、置く場所の数だけ食い違う。
--    RLS でも同じことを守っているので、**二重に塞いである。**
--
--    **返す列を変えていなくても drop を置く**(CLAUDE.md)。
-- ────────────────────────────────────────────────────────────────
drop function if exists public.set_learner_feature(uuid, text, boolean);

create or replace function public.set_learner_feature(
  p_learner uuid,
  p_feature text,
  p_on      boolean
)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if p_learner is null or p_feature is null or p_feature = '' then
    raise exception 'ゲストと、出すものの名前が要ります';
  end if;
  -- **担当トレーナーと管理者だけ。** ゲスト本人には決めさせない
  if not (public.teaches(p_learner) or public.is_owner()) then
    raise exception 'このゲストの担当ではありません';
  end if;

  insert into public.learner_features (learner_id, feature, enabled, set_by, updated_at)
  values (p_learner, p_feature, coalesce(p_on, false), auth.uid(), now())
  on conflict (learner_id, feature) do update
    set enabled    = excluded.enabled,
        set_by     = excluded.set_by,
        updated_at = excluded.updated_at;
end;
$$;

revoke all on function public.set_learner_feature(uuid, text, boolean) from public;
grant execute on function public.set_learner_feature(uuid, text, boolean) to authenticated;

-- ────────────────────────────────────────────────────────────────
-- 3. ゲストをまとめて消すときに、この記録も消す
--
--    **表を足したら、消す側にも足す**(CLAUDE.md)。
--    中身は 0052 のものと**1か所しか違わない**(`learner_features` の行)。
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

  delete from public.qr_days where learner_id = p_learner;
  get diagnostics v_n = row_count;
  v_out := v_out || jsonb_build_object('文の日ごとの記録', v_n);

  delete from public.weekly_goals where learner_id = p_learner;
  get diagnostics v_n = row_count;
  v_out := v_out || jsonb_build_object('週の目標', v_n);

  delete from public.course_days where learner_id = p_learner;
  get diagnostics v_n = row_count;
  v_out := v_out || jsonb_build_object('講座の進み具合', v_n);

  -- ★ 0054 で足した1つ。**何件消えたのかを返すために明示的に消す**
  delete from public.speeches where learner_id = p_learner;
  get diagnostics v_n = row_count;
  v_out := v_out || jsonb_build_object('スピーチ', v_n);

  -- ★ 0055 で足した1つ。**`auth.users` を参照しているので、
  --    `profiles` を消しても道連れにならない。明示的に消す**
  delete from public.learner_features where learner_id = p_learner;
  get diagnostics v_n = row_count;
  v_out := v_out || jsonb_build_object('この人に出すもの', v_n);

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
