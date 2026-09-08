-- ================================================================
-- 0049 — 自作の音楽(BGM)の置き場
--
-- 2026-09 利用者の指定。
--
--   > また、これからは自作の音楽が流れるようにしたいです。
--   > それとか音楽を流しながらどんどん登録されている単語が
--   > 読まれるモードも欲しいですね
--
-- 置き場所は利用者が選んだ ——「Supabase に置いて、画面から入れる」。
-- **リポジトリに MP3 を置かない**(曲を足すたびに GitHub の操作が要り、
-- 公開するファイルも重くなる)。
--
-- ----------------------------------------------------------------
-- 【中身は置き場、何があるかは表】(`learner_files`・0031 と同じ考え方)
--
--   置き場(Storage)だけでは「誰が入れた曲か」「題は何か」を
--   SQL で絞れない。だから**中身は `bgm` バケツ、控えは `bgm_tracks` 表**。
--
-- 【非公開にする】
--
--   読み上げ音声(`tts`)は public にしてある —— あれは
--   **教材の英文の読み上げだけ**だからである(CLAUDE.md)。
--   こちらは**利用者が作った曲**なので、URL を知っていれば誰でも
--   聴ける形にはしない。**押した瞬間に署名した URL を作る**
--   (`learner-files` と同じ作法。こちらは曲なので1時間もたせる)。
--
-- 【誰が何をできるか】
--
--   | | 聴く | 入れる / 消す |
--   |---|---|---|
--   | ゲスト | ○ | **×** |
--   | トレーナー・管理者 | ○ | ○ |
--
--   曲は**スクールみんなのもの**である。ゲストごとに分けない
--   (分けると、トレーナーが1人ずつ入れて回ることになる)。
--
-- 【貼る前でも壊れない】
--
--   貼るまでは表も置き場も無いので、画面は
--   **「音楽」の欄そのものを出さない**(`bgmSupported()`)。
--   単語帳も復習も、これまでどおり動く。
-- ================================================================

-- ────────────────────────────────────────────────────────────────
-- 1. 何があるか(控え)
-- ────────────────────────────────────────────────────────────────
create table if not exists public.bgm_tracks (
  id         uuid primary key default gen_random_uuid(),
  -- 画面に出す題。**ファイル名をそのまま出さない**(利用者が付ける)
  title      text not null check (length(btrim(title)) between 1 and 120),
  -- `bgm` バケツの中の道。**同じ道を2行に持たせない**
  path       text not null unique,
  bytes      bigint,
  added_by   uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

comment on table public.bgm_tracks is
  '自作の音楽(0049)。中身は bgm バケツ、ここは題と置き場所の控え。'
  'スクール全員で共有する。入れられるのはトレーナーと管理者だけ。';

create index if not exists bgm_tracks_created_idx
  on public.bgm_tracks (created_at desc);

alter table public.bgm_tracks enable row level security;

-- 聴くのは、ログインしていれば誰でも(ゲストも聴く)
drop policy if exists "曲は誰でも見られる" on public.bgm_tracks;
create policy "曲は誰でも見られる" on public.bgm_tracks
  for select to authenticated
  using (true);

-- 入れるのはトレーナーと管理者だけ。**判定は 0001 の関数を使い回す**
drop policy if exists "曲を入れられるのはトレーナー" on public.bgm_tracks;
create policy "曲を入れられるのはトレーナー" on public.bgm_tracks
  for insert to authenticated
  with check (added_by = auth.uid() and (public.is_trainer() or public.is_owner()));

drop policy if exists "曲を消せるのはトレーナー" on public.bgm_tracks;
create policy "曲を消せるのはトレーナー" on public.bgm_tracks
  for delete to authenticated
  using (public.is_trainer() or public.is_owner());

grant select, insert, delete on public.bgm_tracks to authenticated;

-- ────────────────────────────────────────────────────────────────
-- 2. 置き場そのもの(非公開のバケツ)
--
--    **表と同じ決まりを、Storage の側にも書く。**
--    片方だけでは守れない(表を通さずに置き場を直に触られる)。
-- ────────────────────────────────────────────────────────────────
do $$
begin
  insert into storage.buckets (id, name, public)
  values ('bgm', 'bgm', false)
  on conflict (id) do nothing;

  -- 聴く(ログインしていれば誰でも)
  drop policy if exists "曲を聴く" on storage.objects;
  create policy "曲を聴く" on storage.objects
    for select to authenticated
    using (bucket_id = 'bgm');

  -- 置く(トレーナー・管理者だけ)
  drop policy if exists "曲を置く" on storage.objects;
  create policy "曲を置く" on storage.objects
    for insert to authenticated
    with check (
      bucket_id = 'bgm' and (public.is_trainer() or public.is_owner())
    );

  -- 消す(同上)
  drop policy if exists "曲を消す" on storage.objects;
  create policy "曲を消す" on storage.objects
    for delete to authenticated
    using (
      bucket_id = 'bgm' and (public.is_trainer() or public.is_owner())
    );
exception when insufficient_privilege or undefined_function or undefined_table then
  -- 手元の PostgreSQL には storage の所有権が無いことがある。
  -- **本番(Supabase)では通る。** ここで止めない(0031 と同じ)
  raise notice 'storage(bgm)のポリシーは、この環境では作れませんでした';
end $$;

-- ────────────────────────────────────────────────────────────────
-- 3. ゲストを消すときに、曲は消さない
--
--    曲は**スクールの持ちもの**であって、その人の記録ではない
--    (教材や語の意味の控えと同じ扱い・0041)。
--    ただし入れた人の行が消えると `added_by` の参照が切れるので、
--    `on delete cascade` にしてある —— **トレーナーが退職したら、
--    その人が入れた曲も一緒に消える。**
--    残したい曲は、別のトレーナーが入れ直す。
-- ────────────────────────────────────────────────────────────────
