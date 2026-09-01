-- 0031 ゲストに関するファイルの置き場
--
-- 【なぜ要るか】(2026-09 利用者の指定)
--
--   > 各ゲストの情報内に、ゲストに関するファイルをアップロードできる
--   > ようにできないですか?
--
--   レッスンでは紙の資料が行き交う。会社からもらった英文メール、
--   受けたテストの結果、宿題の写真。いまはメールや LINE で送り合っていて、
--   **どこに何があるか分からなくなる。**
--   ゲストのカードの中に置ければ、次のレッスンで必ず見つかる。
--
-- 【いちばん大事なこと ― 誰に見えるか】
--
--   ファイルには、その人のことが書いてある。**外に漏れてはいけない。**
--   見られるのは次の2人だけである。
--
--     ① そのゲスト本人
--     ② そのゲストを**いま担当している**トレーナー(と管理者)
--
--   他のゲストからは、名前も、あることさえも見えない。
--
-- 【バケットは非公開にする】
--   読み上げ音声(`tts`・0016)は**公開**にしてある。あれは教材の英文を
--   読んだだけのもので、誰に聞かれても困らないからである。
--   **こちらは違う。** URL を知っていれば誰でも取れる状態にはしない。
--   画面は、そのつど**期限付きの URL**(署名付き URL)を作って開く。
--
-- 【表と置き場を分ける】
--   ・**中身**(バイト列)は Storage の `learner-files` バケット
--   ・**何があるか**(名前・大きさ・入れた人・メモ)は `learner_files` の表
--
--   置き場だけでは「誰のものか」を SQL で絞れない。
--   表を1つ持てば、RLS で確実に守れるし、一覧も速い。
--
-- 【道は必ず `<ゲストの id>/…` で始める】
--   Storage 側のポリシーも、この先頭の部分だけを見て許す。
--   **表と置き場の両方で、同じ決まりを守らせる。**
--
-- 【何度貼っても安全】

-- ────────────────────────────────────────────────────────────
-- 1. 置き場(バケット)。**非公開**
-- ────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('learner-files', 'learner-files', false)
on conflict (id) do nothing;

-- すでに公開で作られていた場合に備えて、非公開に直す
update storage.buckets set public = false
 where id = 'learner-files' and public is distinct from false;

-- ────────────────────────────────────────────────────────────
-- 2. 何があるかの表
-- ────────────────────────────────────────────────────────────
create table if not exists public.learner_files (
  id          uuid primary key default gen_random_uuid(),
  learner_id  uuid not null references public.profiles(id) on delete cascade,
  -- 置き場の中の道。**必ず `<learner_id>/…` で始まる**
  path        text not null unique,
  -- 画面に出す名前(利用者が選んだファイルの名前そのまま)
  name        text not null,
  mime        text,
  size        bigint,
  -- 何のファイルかの短いメモ(任意)
  note        text,
  uploaded_by uuid references public.profiles(id),
  created_at  timestamptz not null default now()
);

create index if not exists learner_files_learner_idx
  on public.learner_files (learner_id, created_at desc);

comment on table public.learner_files is
  'ゲストに関するファイル(0031)。中身は Storage の learner-files バケット。'
  '見られるのは本人と、いま担当しているトレーナー(と管理者)だけ。';

alter table public.learner_files enable row level security;

-- ────────────────────────────────────────────────────────────
-- 3. 誰が見られて、誰が置けるか
--
--    **本人と、担当しているトレーナー。** それ以外には1行も見せない。
--    `teaches()` は 0001 からある「いま担当しているか」の判定である。
-- ────────────────────────────────────────────────────────────
drop policy if exists "自分のファイルと担当ゲストのファイルを見る" on public.learner_files;
create policy "自分のファイルと担当ゲストのファイルを見る" on public.learner_files
  for select to authenticated
  using (learner_id = auth.uid() or public.teaches(learner_id) or public.is_owner());

drop policy if exists "自分と担当ゲストのファイルを置ける" on public.learner_files;
create policy "自分と担当ゲストのファイルを置ける" on public.learner_files
  for insert to authenticated
  with check (
    (learner_id = auth.uid() or public.teaches(learner_id) or public.is_owner())
    -- **道は必ずゲストの id から始める。** ここを緩めると、
    -- 別の人のフォルダに置けてしまう
    and path like learner_id::text || '/%'
    and uploaded_by = auth.uid()
  );

-- **消せるのは「置いた本人」と、担当トレーナー。**
-- 間違えて上げたものを消せないと、消したいものが残りつづける
drop policy if exists "置いたファイルを消せる" on public.learner_files;
create policy "置いたファイルを消せる" on public.learner_files
  for delete to authenticated
  using (learner_id = auth.uid() or public.teaches(learner_id) or public.is_owner());

-- **書き換えはできない。** 直したいときは、消してから入れ直す。
-- 中身と表がずれるのがいちばん困る

grant select, insert, delete on public.learner_files to authenticated;

-- ────────────────────────────────────────────────────────────
-- 4. 置き場そのもののポリシー
--
--    表と**同じ決まり**を、Storage の側にも書く。
--    片方だけでは守れない(表を通さずに置き場を直に触られる)。
--    道の先頭(`<learner_id>/`)だけを見て許す。
-- ────────────────────────────────────────────────────────────
do $$
begin
  -- 見る
  begin
    drop policy if exists "ゲストのファイルを見る" on storage.objects;
    create policy "ゲストのファイルを見る" on storage.objects
      for select to authenticated
      using (
        bucket_id = 'learner-files'
        and (
          (storage.foldername(name))[1] = auth.uid()::text
          or public.teaches(((storage.foldername(name))[1])::uuid)
          or public.is_owner()
        )
      );

    -- 置く
    drop policy if exists "ゲストのファイルを置く" on storage.objects;
    create policy "ゲストのファイルを置く" on storage.objects
      for insert to authenticated
      with check (
        bucket_id = 'learner-files'
        and (
          (storage.foldername(name))[1] = auth.uid()::text
          or public.teaches(((storage.foldername(name))[1])::uuid)
          or public.is_owner()
        )
      );

    -- 消す
    drop policy if exists "ゲストのファイルを消す" on storage.objects;
    create policy "ゲストのファイルを消す" on storage.objects
      for delete to authenticated
      using (
        bucket_id = 'learner-files'
        and (
          (storage.foldername(name))[1] = auth.uid()::text
          or public.teaches(((storage.foldername(name))[1])::uuid)
          or public.is_owner()
        )
      );
  exception when insufficient_privilege or undefined_function or undefined_table then
    -- 手元の PostgreSQL には storage の所有権が無いことがある。
    -- **本番(Supabase)では通る。** ここで止めない
    raise notice 'storage.objects のポリシーは、この環境では作れませんでした';
  end;
end $$;
