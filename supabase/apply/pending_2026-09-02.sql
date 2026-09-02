-- ============================================================================
-- ★ Supabase の SQL Editor に、これを丸ごと貼って Run してください ★
--
-- 【これは何か】
--   0032 の1つだけです。GitHub の
--   supabase/migrations/0032_lesson_notes.sql と**まったく同じ**中身で、
--   ここで新しいことは何もしていません。
--
-- 【何が起きるか】
--   **セッションの記録(メモ)の置き場**が1つ増えます。
--   レッスン中に気づいたこと・次までの約束を、**日付ごと**に残せます。
--
--     ・書けるのは、いま担当しているトレーナー(と管理者)だけです
--     ・**そのゲスト本人も読めます。** ただし書けません
--     ・他のゲストからは、あることさえ見えません
--
-- 【どこまで影響するか】
--   ・**いま入っている教材・宿題・単語帳・ゲストの情報には触れません**
--   ・増えるのは `lesson_notes` という表1つだけで、**空から始まります**
--
-- 【何度貼っても安全です】
--   迷ったら、そのまま貼ってください。
--
-- 【どうなれば成功か】
--   `Success. No rows returned` と出れば成功です。
--
-- 【うまくいかないとき】
--   赤い字が出たら、その文章をそのまま貼って知らせてください。
--   **途中で止まっていても、もう一度そのまま貼り直せます。**
-- ============================================================================


-- ════════════════════════════════════════════════════════════
--  0032_lesson_notes
-- ════════════════════════════════════════════════════════════
-- ============================================================================
-- 0032 セッションの記録(メモ)を、日付ごとに残す
--
-- 【なぜ要るか】(2026-09 利用者の指定)
--
--   > トレーニング中、または個々のゲストの情報内でセッションに関する記録や
--   > メモをするためのフリーボード、例えばワードのようなものを呼び出せると
--   > 嬉しいですね。それはカレンダーと同期して呼び出せるものだと嬉しいです。
--
--   レッスン中に気づいたこと(言い間違い・宿題の約束・次に何をするか)は、
--   いまどこにも残らない。紙にメモすれば次のレッスンまでに失くすし、
--   **書き込み(ペン・第5.61節)は表示を閉じると消える。**
--   あれは板書であって、記録ではない。
--
-- 【日付ごとに1枚】
--   レッスンは**その日に1回**である。だから「ゲスト × 日付」で1行にする。
--   カレンダーと結び付けるのに、これがいちばん素直な形になる
--   (単語帳の `vocab_days`・取り組みの `practice_days` と同じ考え方)。
--
-- 【誰が書けて、誰が読めるか】(2026-09 利用者の判断)
--
--   > メモはゲストにも見せる
--
--   ・**書けるのは、いま担当しているトレーナー(と管理者)だけ**
--   ・**ゲスト本人は読める。書けない**
--
--   セッションの記録は、トレーナーが書いてゲストに渡すものである。
--   両方が書けるようにすると、レッスン中に**同じ1枚を二人で上書き**して
--   しまう(あとから書いたほうが勝つので、消えたことにも気づけない)。
--   ゲストが書きたいことは単語帳とファイル(0031)に置き場がある。
--
--   他のゲストからは、あることさえ見えない。
--
-- 【中身は、ただの文章として持つ】
--   見出しや太字の仕組みは持たない。**改行だけがある白い紙**にする。
--   ワードのような書式を持たせると、書式を保つ仕組みそのものが
--   壊れどころになる。読むのは人であって、機械ではない。
--
-- 【何度貼っても安全】
--   `create table if not exists` / `drop policy if exists`。
-- ============================================================================

-- ────────────────────────────────────────────────────────────────
-- 1. 表
-- ────────────────────────────────────────────────────────────────
create table if not exists public.lesson_notes (
  id         uuid primary key default gen_random_uuid(),
  learner_id uuid not null references public.profiles(id) on delete cascade,
  -- **その日の1枚。** 時刻は持たない(レッスンは日で数える)
  on_date    date not null,
  body       text not null default '',
  -- 最後に書いた人。**誰が書いたかは、あとで必ず知りたくなる**
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (learner_id, on_date)
);

-- カレンダーは「この月の、書いてある日」を引く。日付の降順で見る
create index if not exists lesson_notes_learner_idx
  on public.lesson_notes (learner_id, on_date desc);

comment on table public.lesson_notes is
  'セッションの記録(0032)。ゲスト×日付で1枚。'
  '書けるのは担当トレーナーと管理者だけ。ゲスト本人は読める。';

alter table public.lesson_notes enable row level security;

-- ────────────────────────────────────────────────────────────────
-- 2. 誰に見えて、誰が書けるか
--
--    `teaches()` は 0001 からある「いま担当しているか」の判定である。
--    **新しい判定を作らない**(CLAUDE.md)。
-- ────────────────────────────────────────────────────────────────

-- 見る … 本人・担当トレーナー・管理者
drop policy if exists "自分の記録と担当ゲストの記録を見る" on public.lesson_notes;
create policy "自分の記録と担当ゲストの記録を見る" on public.lesson_notes
  for select to authenticated
  using (learner_id = auth.uid() or public.teaches(learner_id) or public.is_owner());

-- 書き始める … **担当トレーナーと管理者だけ。** ゲスト本人は入れられない
drop policy if exists "担当ゲストの記録を書ける" on public.lesson_notes;
create policy "担当ゲストの記録を書ける" on public.lesson_notes
  for insert to authenticated
  with check (
    (public.teaches(learner_id) or public.is_owner())
    and updated_by = auth.uid()
  );

-- 書き直す … 同じ人だけ。`with check` も付ける。
-- **`using` だけだと、書き直すついでに別のゲストの行へ move できる**
drop policy if exists "担当ゲストの記録を書き直せる" on public.lesson_notes;
create policy "担当ゲストの記録を書き直せる" on public.lesson_notes
  for update to authenticated
  using (public.teaches(learner_id) or public.is_owner())
  with check (
    (public.teaches(learner_id) or public.is_owner())
    and updated_by = auth.uid()
  );

-- 消す … 白紙の日を残さないため。書けるのと同じ人だけ
drop policy if exists "担当ゲストの記録を消せる" on public.lesson_notes;
create policy "担当ゲストの記録を消せる" on public.lesson_notes
  for delete to authenticated
  using (public.teaches(learner_id) or public.is_owner());

grant select, insert, update, delete on public.lesson_notes to authenticated;

-- ────────────────────────────────────────────────────────────────
-- 3. 書いた時刻は、こちらで入れる
--
--    画面から `updated_at` を送らせると、**端末の時計**で決まる。
--    時差やずれた時計でカレンダーの並びが狂うので、DB で入れる
--    (間隔の決まりを画面に持たないのと同じ考え方・CLAUDE.md)。
-- ────────────────────────────────────────────────────────────────
create or replace function public.touch_lesson_note()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists lesson_notes_touch on public.lesson_notes;
create trigger lesson_notes_touch
  before update on public.lesson_notes
  for each row execute function public.touch_lesson_note();
