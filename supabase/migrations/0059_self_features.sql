-- ============================================================================
-- 0059 トレーナーが、自分自身にも「出すもの」を決められるようにする
--
-- 【なぜ要るか】(2026-09 利用者の指定)
--
--   > その代わり、業種別単語帳のページではトレーナーは
--   > 自分自身にアサイン出来るように改良してください。
--
--   「その代わり」は、**トレーナーの単語帳も指定された冊だけに絞る**ことへの
--   引き換えである。0057 では「トレーナーには 35 冊ぜんぶ出す」と決めて
--   いたが、実機で見ると**自分が学びたい1冊を選ぶ場所**としては多すぎた。
--
--   絞るなら、**トレーナーが自分で自分に出せる**道が要る ——
--   さもないと、トレーナーの単語帳から「業種べつ」が丸ごと消える
--   (**行き止まりを作らない**)。
--
-- 【何が起きるか】
--   ・**表も列も1つも増えません。** 0055 の `learner_features` に、
--     `learner_id = 自分` の行が入るようになるだけです。
--   ・`set_learner_feature()` が作り直されます
--     (**門番に「自分のぶん」を1つ足しただけ**)。
--   ・`learner_features` の書き換えのポリシーも、同じ1つを足します。
--   ・教材・宿題・単語帳・ゲストの情報には**一切さわりません。**
--   ・**何度実行してもよい**です。
--
-- 【ゲストは、これまでどおり自分では決められない】
--
--   足したのは **`is_trainer()`(役割が trainer / owner で、在籍中)**
--   のときだけ通る道である。ゲストは `is_trainer()` が偽なので、
--   0055 の決まり(「自分で出せるなら『トレーナーが指定する』にならない」)は
--   **1文字も緩んでいない。**
--
-- 【なぜ `can_set_own_features()` を作るのか】
--
--   足した半分(**自分のぶんは、トレーナーなら決められる**)を、
--   **RPC の中と RLS の両方**が見る(**二重に塞ぐ**・0055 と同じ作法)。
--   2か所に `is_trainer()` と書き写すと、片方を直したときに食い違う。
--
--   **引数を取らない。** そのおかげで、画面の `SetupStatus` が
--   「0059 を貼ったか」の**印**としてそのまま呼べる
--   (0056 の `wordbook_limit()` と同じ考え方。**読むだけの関数**なので、
--   訊いただけで何かが書き換わることがない)。
-- ============================================================================

-- ────────────────────────────────────────────────────────────────
-- 1. 足した半分。**ここ1か所**
--
--    「**自分のぶんは、トレーナー(と管理者)なら決められる**」。
--    `is_owner()` は 0055 からどのゲストにも決められるので、ここには要らない
--    —— それでも `is_trainer()` は owner を含むので、管理者も通る。
-- ────────────────────────────────────────────────────────────────
create or replace function public.can_set_own_features()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_trainer();
$$;

comment on function public.can_set_own_features() is
  '自分自身に「出すもの」を決められるか(0059)。トレーナーと管理者だけ真。'
  'ゲストは偽 — 自分で出せるなら「トレーナーが指定する」にならない。'
  'set_learner_feature() と learner_features の RLS が、どちらもこれを見る。';

revoke all on function public.can_set_own_features() from public;
grant execute on function public.can_set_own_features() to authenticated;

-- ────────────────────────────────────────────────────────────────
-- 2. 書き換えのポリシーにも、同じ1つを足す
--
--    **RPC と RLS は、同じことを言っていなければならない**(0055)。
--    片方だけ広げると、次に読む人が「自分には決められない」と読む。
-- ────────────────────────────────────────────────────────────────
drop policy if exists "担当トレーナーが決める" on public.learner_features;
create policy "担当トレーナーが決める" on public.learner_features
  for all to authenticated
  using (
    public.teaches(learner_id)
    or public.is_owner()
    or (learner_id = auth.uid() and public.can_set_own_features())
  )
  with check (
    public.teaches(learner_id)
    or public.is_owner()
    or (learner_id = auth.uid() and public.can_set_own_features())
  );

-- ────────────────────────────────────────────────────────────────
-- 3. 決める窓口。**門番に1つ足しただけ**
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
  -- **担当トレーナーと管理者だけ。** ゲスト本人には決めさせない。
  -- ★ 0059 で足した1つ —— **自分自身のぶんは、トレーナーなら決められる**
  if not (
    public.teaches(p_learner)
    or public.is_owner()
    or (p_learner = auth.uid() and public.can_set_own_features())
  ) then
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
