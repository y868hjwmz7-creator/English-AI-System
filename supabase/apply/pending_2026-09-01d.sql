-- ============================================================================
-- ★ Supabase の SQL Editor に、これを丸ごと貼って Run してください ★
--
-- 【これは何か】
--   0029 だけです。0028 までは、すでに実行済みのはずです。
--   中身は GitHub の supabase/migrations/0029_avatar.sql と同じです。
--
-- 【何が起きるか】
--   ゲスト(とトレーナー)が、**自分のアイコンを選べる**ようになります。
--   `profiles` の表に `avatar` という欄が1つ増えるだけです。
--   絵そのものは入りません。**選んだ印(短い文字)だけ**が入ります。
--
-- 【どこまで影響するか】
--   ・いま入っている情報は**1件も変わりません。**欄が増えるだけです
--   ・教材・宿題・単語帳・取り組みには**いっさい触れません**
--   ・`role`(役割)は**これまでどおり誰にも書き換えられません。**
--     開けるのは新しい `avatar` の欄だけです
--
-- 【何度貼っても安全です】
--   迷ったら、そのまま貼ってください。
--
-- 【どうなれば成功か】
--   `Success. No rows returned` と出れば成功です。
-- ============================================================================


-- 0029: 自分のアイコンを選べるようにする(2026-09 利用者の指定)
--
--   > 空いたスペースには、ゲストが選んだアイコンを入れれるとよいです。
--
-- 【なぜ列を1つ足すだけで済むのか】
--   絵そのものは保存しない。**選んだ印(短い文字)だけ**を残す。
--   画像を持つと Storage も要り、大きさも人によって変わる。
--   1人ぶん数バイトなので、1,500人でも数キロバイトにしかならない。
--
-- 【誰が書き換えられるか】
--   ・**本人**(列単位の grant で `avatar` を足す)
--   ・トレーナー(0001 の「自分のプロフィールを直す」が
--     `is_admin()` を含んでいるため)。ただし画面には出さない。
--     選ぶのは本人である
--   `role` は**これまでどおり誰にも書き換えさせない。**
--   足すのは `avatar` の1列だけで、0001 の考え方は変えていない。
--
-- 【2回貼っても安全】
--   `add column if not exists` と `drop constraint if exists` にしてある。

alter table public.profiles add column if not exists avatar text;

-- **長さを縛る。** 画面では丸の中に1文字ぶんとして出すので、
-- 長い文字列が入ると崩れる。絵文字は2〜4バイト・複数の符号で
-- 1文字になることがあるので、8文字まで許す。
alter table public.profiles drop constraint if exists profiles_avatar_check;
alter table public.profiles
  add constraint profiles_avatar_check
  check (avatar is null or char_length(avatar) between 1 and 8);

comment on column public.profiles.avatar is
  '自分で選んだアイコン(短い文字)。未選択なら NULL。'
  '画像は持たず、選んだ印だけを残す。';

-- 本人が自分のアイコンを選べるようにする。
-- **`revoke update ... from authenticated` は繰り返さない。**
-- 0001 で一度取り上げたうえで、必要な列だけを足していく形にしてある。
grant update (avatar) on public.profiles to authenticated;
