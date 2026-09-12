-- ============================================================================
-- ★★ いま貼っていただくのは、このファイル1つだけです ★★
--
-- 【これは何か】
--   Supabase(データの置き場)に、まだ入っていない17個の追加を
--   **1つにまとめたもの**です。
--   これまで「0041」「0042」…と別々のファイルでお願いしていたものを、
--   1回で済むようにまとめ直しました。
--   **もう別々のファイルを貼る必要はありません。**
--
-- 【中身(17個)】
--   0041 … ゲストの記録を、まとめて消せるようにする(退会したとき)
--   0042 … 続けた記録(Quick Response)と、週の目標
--   0043 … 教材の種類に「Speech練習」を足す
--   0044 … 管理者は、どの教材でも消せるようにする
--   0045 … 演習の種類に「想定される質問」を足す
--   0046 … 教材に「切り口」と「何の話だったか」を控える(似た教材を作らないため)
--   0047 … 単語 / フレーズを1つの種類にまとめ、共有したらゲストの単語帳に入れる
--   0048 … 復習を「レベル(A1〜C2)」でも絞り込めるようにする
--   0049 … 自作の音楽(BGM)の置き場を作る
--   0050 … 苦手タグの文法項目を15件足す(受動態・助動詞・動名詞・文型 など)
--          あわせて、もとから抜けていた「母音全般」も足します
--   0051 … 本文に「文法解説(SVOC と修飾要素)」を持たせる
--   0052 … 文法30日集中講座の進み具合。あわせて文法タグを4つ足します
--          (be動詞 / 動詞の形 / 疑問文 / 三人称単数の -s)
--   0053 … 基礎単語(基本360語 / 標準1200語)を、まとめて単語帳に入れる
--   0054 … スピーチの原稿と、その添削の置き場(スピーチ練習)
--   0055 … ゲストごとに「出すもの」を決める
--          (文法30日集中講座と基礎単語を、指定したゲストにだけ出す)
--   0056 … 単語帳を、200 語より先まで読めるようにする
--   0057 … 業種べつの単語帳(棚)。**自分の単語帳とは混ざりません** ——
--          「自分の単語帳に追加する」を押したものだけが入ります
--
-- 【何が起きるか】
--   ・`materials` の表に、列が2つ増えます(0046)。**どちらも空から始まります。**
--   ・`material_items` の表に、列が1つ増えます(0051)。**空から始まります。**
--   ・表が1つ増えます(`course_days`・0052)。**空から始まります。**
--   ・表が1つ増えます(`speeches`・0054)。**空から始まります。**
--   ・表が1つ増えます(`shelf_words`・0057)。**空から始まります。**
--     業種べつの単語帳(棚)の置き場です。中身はトレーナーが作ります。
--   ・表が1つ増えます(`learner_features`・0055)。**空から始まります。**
--     そのため、貼った直後は**どのゲストにも 30日講座は出ません。**
--     出したいゲストは「ゲスト → その人を開く → レベルとスコア」で
--     「この人の画面に出すもの」を押してください。
--   ・表が増えます(`qr_days` / `weekly_goals` / `bgm_tracks`)。
--     **どれも空から始まります。**
--   ・教材の種類と演習の種類に、入れてよい値が増えます。
--   ・SQL の関数がいくつか増えます / 作り直されます。
--
-- 【どこまで影響するか】
--   **いま入っている教材・宿題・単語帳・ゲストの情報・取り組みの記録は、
--   1行も書き換わりません。** 消えるものもありません。
--
-- 【何度貼っても安全です】
--   すでに入っているところは、そのまま素通りします。
--   途中で止まったときも、もう一度そのまま貼れば続きから入ります。
--
-- 【どうなれば成功か】
--   赤い字が出ずに終われば成功です。
--   確かめたいときは `supabase/apply/check.sql` を貼ると、
--   37行の表に「✅ もう入っています」が並びます。
-- ============================================================================


-- ============================================================================
-- 0041 ゲストの記録を、まとめて消せるようにする
--
-- 【なぜ要るか】(2026-09 安全性レビュー 03-3位)
--   名前・スコア・セッションの記録・単語帳・アップロードしたファイル。
--   **退会したときに、まとめて消す手順がどこにも無かった。**
--   「消してほしい」と言われたときに応えられない状態だった。
--
--   表をまたいで15か所以上あるので、**画面から順に消させない。**
--   途中で失敗すれば、どこまで消えたのか誰にも分からなくなる。
--   **SQL の関数1つにまとめ、まるごと成功するか、まるごと失敗するか**にする。
--
-- 【誰ができるか】
--   **管理者(`is_owner()`)だけ。** トレーナーにはできない。
--   担当ゲストを持つトレーナーが1人でも消せると、事故が大きすぎる。
--
-- 【消せないもの】
--   ・**ログインそのもの**(`auth.users`)は、ここからは消せない。
--     消すには管理者の鍵(service_role)が要る。
--     この関数はプロフィールを消すので**そのアカウントはアプリを使えなくなる**が、
--     ログインの行そのものは Supabase の画面から消してもらう
--     (Authentication → Users → その人 → Delete user)。
--     **鍵を扱わない**という決まりを、この機能のために曲げない。
--   ・**教材そのもの**(`materials`)は消さない。スクール全体で共有していて、
--     ほかのゲストにも配られている。消えるのは「誰に配ったか」の記録だけ。
--   ・**単語の意味の控え**(`word_glosses`)も消さない。
--     あれは英単語の辞書であって、その人の記録ではない。
--
-- 【必ず数えて返す】
--   何も消さずに「消しました」と返さない。**表ごとの件数を返す**ので、
--   画面はそれをそのまま出せる(成功と失敗を同じ見た目で終わらせない)。
-- ============================================================================

-- **返す型を変えていなくても drop を置く。** あとで誰かが列を足したときに、
-- このファイルだけを貼り直すと `cannot change return type` で止まるため
-- (CLAUDE.md「関数を作り直すファイルは、返す列を変えていなくても drop を置く」)
drop function if exists public.erase_learner(uuid);

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

comment on function public.erase_learner(uuid) is
  'ゲスト1人の記録を、表をまたいでまとめて消す(管理者だけ)。'
  'ログインそのもの(auth.users)は消さない —— Supabase の画面から消す。';

-- ============================================================================
-- 0042 続けた記録(Quick Response)と、週の目標
--
-- 【なぜ要るか】(2026-09 利用者の指定)
--
--   > 単語帳とクイックレスポンス帳にゲーミフィケーションを追加したいです
--   > ・続けた記録を QR にも
--   > ・週の目標と、達成の印
--
--   単語帳には 0019 から「今週 3 日 / 5 週つづけて」があるのに、
--   **Quick Response には何も無かった。** 同じ形の入れ物を足す。
--
-- 【日ではなく、週で数える】
--   日ごとの連続記録は**1日休んだ瞬間に途切れ、それがやめる理由になる。**
--   このスクールは週2回のレッスンに合わせて宿題を出しているので、
--   毎日やる前提そのものが合っていない。0019 とまったく同じ考え方である。
--
-- 【目標を決めるのはトレーナー。ゲスト本人ではない】
--   **自分で下げられる目標は、目標にならない。**
--   `set_weekly_goal()` は担当トレーナーと管理者だけが呼べる。
--   ゲストは読めるが書けない。**判定は関数の中**であって、画面には持たせない。
--
-- 【何が起きるか】
--   ・表が2つ増えます(`qr_days` / `weekly_goals`)。**空から始まります**
--   ・関数が3つ増えます(`qr_week` / `weekly_goal` / `set_weekly_goal`)
--   ・`mark_qr()` と `erase_learner()` を作り直します(中身は同じ + 追加分)
--
-- 【どこまで影響するか】
--   教材・宿題・単語帳・ゲストの情報には**触れません。**
--   すでに溜まっている Quick Response の文(`qr_reviews`)もそのままです。
--   **何度貼っても同じ結果になります。**
--
-- 【成功の目安】
--   `Success. No rows returned` と出れば成功です。
-- ============================================================================

-- ============================================================================
-- 0042 — Quick Response の「続けた記録」と、週の目標
--
--   2026-09 利用者の指定
--   「単語帳とクイックレスポンス帳にゲーミフィケーションを追加したいです」
--   のうち、**貼る作業が要る2つ**である。
--
--   ・`qr_days`        … Quick Response を何日やったか(日ごとに1行)
--   ・`mark_qr()`      … 答えるたびに `qr_days` を1つ増やす(作り直し)
--   ・`qr_week()`      … 今週の日数・回数・正解、続いている週数
--   ・`weekly_goals`   … 週の目標(トレーナーがゲストごとに決める)
--   ・`set_weekly_goal()` / `weekly_goal()`
--
-- ────────────────────────────────────────────────────────────────
-- 【なぜ Quick Response にも要るのか】
--
--   **続けた記録は、単語帳にしか無かった。**
--   Quick Response の復習(0040)には**1つも記録が無く**、
--   何日やったのかも、続いているのかも、誰にも見えなかった。
--   単語帳と**同じ形**にそろえる(`vocab_days` / `vocab_week` の写し)。
--
-- 【日ではなく、週で数える】(0019 からの決まり)
--
--   日ごとの連続記録は**1日休んだ瞬間に途切れ、それがやめる理由になる。**
--   週2回のレッスンに合わせた宿題なので、毎日やる前提が合っていない。
--   **ここでも週で数える。** 単語帳と違う数え方にしない。
--
-- 【週の目標は、トレーナーが決める】
--
--   ゲスト本人は**読めるが、書けない。**
--   自分で下げられる目標は目標にならないし、
--   レッスンの見立て(いまどのくらい押せるか)はトレーナーが持っている。
--   `lesson_notes`(0032)と同じ考え方である。
--
--   **達成できなくても、責める作りにしない。** 進み具合を出すだけで、
--   届かなかったことを画面から言わない(「まだ」を赤くしないのと同じ)。
--
-- 【何度実行してもよい】
--   `create table if not exists` と、drop してからの作り直しだけ。
-- ============================================================================

-- ────────────────────────────────────────────────────────────────
-- 1. Quick Response を何日やったか
--
--   `qr_reviews.updated_at` は**上書きされる。** 月曜に答えて水曜に
--   答え直すと、月曜の記録が消える。「何日続けたか」は数えられない。
--   だから日ごとに1行だけ持つ(`vocab_days` とまったく同じ)。
--   **1人1日1行なので、年に365行しか増えない。**
-- ────────────────────────────────────────────────────────────────
create table if not exists public.qr_days (
  learner_id uuid    not null references auth.users(id) on delete cascade,
  done_on    date    not null default current_date,
  answered   integer not null default 0,   -- 答えた回数(同じ文を2回なら2)
  correct    integer not null default 0,   -- そのうち「言える」を選んだ回数
  primary key (learner_id, done_on)
);

alter table public.qr_days enable row level security;

drop policy if exists "自分と担当トレーナーが見る" on public.qr_days;
create policy "自分と担当トレーナーが見る" on public.qr_days
  for select to authenticated
  using (learner_id = auth.uid() or public.teaches(learner_id) or public.is_owner());

-- **書けるのは本人だけ。** 担当トレーナーでも直に書けない。
-- 記録は `mark_qr()`(security definer)を通して増える
drop policy if exists "自分の記録だけ書ける" on public.qr_days;
create policy "自分の記録だけ書ける" on public.qr_days
  for all to authenticated
  using (learner_id = auth.uid()) with check (learner_id = auth.uid());

comment on table public.qr_days is
  'Quick Response を何日やったかを数えるための、日ごとの記録。1人1日1行。'
  'qr_reviews.updated_at は上書きされるので、そちらでは数えられない(0019 と同じ)。';

-- ────────────────────────────────────────────────────────────────
-- 2. 週の目標
--
--   **1人1行。** 週ごとに行を増やさない ——
--   「先週の目標は何だったか」を振り返る場面が無いためである。
--   増やしたくなったら、そのときに表を足す。
-- ────────────────────────────────────────────────────────────────
create table if not exists public.weekly_goals (
  learner_id uuid        primary key references auth.users(id) on delete cascade,
  words      integer     not null default 0,   -- 週に答える語の数(0 なら決めていない)
  sentences  integer     not null default 0,   -- 週に答える文の数
  set_by     uuid        references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.weekly_goals enable row level security;

-- **本人も読める。** 目標が見えないと、進み具合に意味がない
drop policy if exists "自分と担当トレーナーが見る" on public.weekly_goals;
create policy "自分と担当トレーナーが見る" on public.weekly_goals
  for select to authenticated
  using (learner_id = auth.uid() or public.teaches(learner_id) or public.is_owner());

-- **書けるのは担当トレーナー(と管理者)だけ。**
-- 自分で下げられる目標は、目標にならない
drop policy if exists "担当トレーナーが決める" on public.weekly_goals;
create policy "担当トレーナーが決める" on public.weekly_goals
  for all to authenticated
  using (public.teaches(learner_id) or public.is_owner())
  with check (public.teaches(learner_id) or public.is_owner());

comment on table public.weekly_goals is
  '週の目標(語の数 / 文の数)。1人1行。トレーナーが決め、ゲストは読むだけ。'
  '0 は「決めていない」。届かなくても責める作りにはしない。';

-- ────────────────────────────────────────────────────────────────
-- 3. mark_qr() — 答えるたびに qr_days を1つ増やす
--
--   **返す列は変えていない。** それでも drop を置く ——
--   あとで誰かが列を足したときに、このファイルだけを貼り直すと
--   `cannot change return type` で止まるためである
--   (CLAUDE.md「関数を作り直すファイルは、返す列を変えていなくても
--    drop を置く」)。
--
--   **`mark_word()` と同じ形にそろえる。** あちらは 0019 から
--   `vocab_days` を増やしている。
-- ────────────────────────────────────────────────────────────────
drop function if exists public.mark_qr(text, text, text, uuid, text, uuid, boolean);

create or replace function public.mark_qr(
  p_en            text,
  p_ja            text,
  p_status        text default 'unknown',
  p_material      uuid default null,
  p_speaker       text default null,
  p_learner       uuid default null,
  -- true なら、**すでに溜まっている文だけ**を動かす(新しく溜めない)
  p_only_existing boolean default false
)
returns table (en_norm text, status text, box smallint, due_on date)
language plpgsql
volatile
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  -- **卒業までの回数・休ませる日数は、単語帳と同じ**(0038)
  c_graduate constant int := 25;
  c_rest     constant int := 30;
  v_who    uuid;
  v_norm   text;
  v_box    smallint;
  v_streak int;
  v_days   int;
  v_new    boolean;
  v_ja     text;
  v_en     text;
begin
  if auth.uid() is null then
    raise exception 'ログインしていません';
  end if;

  v_who := coalesce(p_learner, auth.uid());
  if v_who <> auth.uid()
     and not public.teaches(v_who)
     and not public.is_owner() then
    raise exception '担当していないゲストの記録には書けません';
  end if;

  v_norm := public.norm_en(p_en);
  if v_norm is null then
    raise exception '英文が空です';
  end if;
  if p_status is null or p_status not in ('unknown', 'learning', 'known') then
    raise exception '状態は unknown / learning / known です';
  end if;

  -- 長すぎるものは切る(1問がこれより長いことはない)
  v_en := left(btrim(regexp_replace(coalesce(p_en, ''), '\s+', ' ', 'g')), 600);
  v_ja := left(btrim(regexp_replace(coalesce(p_ja, ''), '\s+', ' ', 'g')), 600);

  select r.box, r.learn_streak into v_box, v_streak
    from public.qr_reviews r
   where r.learner_id = v_who and r.en_norm = v_norm;
  v_new    := not found;
  v_box    := coalesce(v_box, 0);
  v_streak := coalesce(v_streak, 0);

  -- **まだ溜まっていない文は、ここで打ち切る。**
  -- 教材の中で「言えた」を押しただけでは溜めない
  if v_new and p_only_existing then
    return;
  end if;

  if p_status = 'unknown' then
    v_box := 0;
    v_days := 1;
    v_streak := 0;
  elsif p_status = 'learning' then
    v_streak := v_streak + 1;
    if v_streak >= c_graduate then
      -- **卒業。しばらく出てこない。**
      -- `status` は learning のままにする(30日たてばまた出る)
      v_box := 6;
      v_days := c_rest;
    else
      -- 箱は 3 で止める。必ず4日以内に戻ってくる(0027 と同じ)
      v_box := least(v_box + 1, 3);
      v_days := case v_box when 1 then 1 when 2 then 2 else 4 end;
    end if;
  else
    -- 「もう出さない」。復習の一覧からは消える
    v_box := 6;
    v_days := c_rest;
  end if;

  -- **溜めたその日に、1回は出す**(0030 と同じ考え方)。
  -- 「まだ」を押した直後に復習を開いて1件も出てこないと、
  -- 溜まっていないように見える
  if v_new then
    v_days := 0;
  end if;

  /* ★ **続けた記録を1つ増やす**(0042)。
       `mark_word()` が `vocab_days` を増やしているのと同じ形。

       **「思い出せたか」で数える。**「言える」を押したときが correct で、
       「まだ」は数に入らない(`vocab_days.correct` と同じ考え方)。
       **「もう出さない」(known)は、答えたことにしない** ——
       あれは片づける操作であって、練習ではない。 */
  if p_status <> 'known' then
    insert into public.qr_days as d (learner_id, done_on, answered, correct)
    values (v_who, current_date, 1, case when p_status = 'learning' then 1 else 0 end)
    on conflict (learner_id, done_on) do update
      set answered = d.answered + 1,
          correct  = d.correct + case when p_status = 'learning' then 1 else 0 end;
  end if;

  return query
  insert into public.qr_reviews as q
    (learner_id, en_norm, en, ja, material_id, speaker,
     status, box, learn_streak, due_on, updated_at)
  values
    (v_who, v_norm, v_en, v_ja, p_material, nullif(btrim(coalesce(p_speaker, '')), ''),
     p_status, v_box, v_streak, current_date + v_days, now())
  on conflict (learner_id, en_norm) do update
    set status       = excluded.status,
        box          = excluded.box,
        learn_streak = excluded.learn_streak,
        due_on       = excluded.due_on,
        -- **英文と訳は、そのつど新しいものにそろえる**(教材を直したとき)
        en           = excluded.en,
        ja           = excluded.ja,
        -- **教材と話す人は、最初に出会ったものを残す**(あとから上書きしない)
        material_id  = coalesce(q.material_id, excluded.material_id),
        speaker      = coalesce(q.speaker, excluded.speaker),
        updated_at   = now()
  returning q.en_norm, q.status, q.box, q.due_on;
end;
$$;

comment on function public.mark_qr(text, text, text, uuid, text, uuid, boolean) is
  'Quick Response の文に「まだ / 言える」を付け、次に出す日を決める(0040)。'
  '間隔の決まりは単語帳(mark_word・0038)とまったく同じ。'
  '答えるたびに qr_days を1つ増やす(0042)。'
  'p_only_existing = true なら、すでに溜まっている文だけを動かす。'
  'p_learner を渡すと、担当しているゲストの記録として残す(0025 と同じ)。';

revoke all on function public.mark_qr(text, text, text, uuid, text, uuid, boolean) from public;
grant execute on function public.mark_qr(text, text, text, uuid, text, uuid, boolean)
  to authenticated;

-- ────────────────────────────────────────────────────────────────
-- 4. qr_week() — 今週の続き具合
--
--   **`vocab_week()`(0019)とまったく同じ数え方。**
--   単語帳と Quick Response で違う数え方にすると、
--   同じ「5週つづけて」が別の意味になる。
-- ────────────────────────────────────────────────────────────────
drop function if exists public.qr_week(uuid);

create or replace function public.qr_week(p_learner uuid default null)
returns table (
  days      integer,   -- 今週やった日数
  answered  integer,   -- 今週答えた回数
  correct   integer,   -- そのうち「言える」
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
    select d.* from public.qr_days d join allowed a on a.id = d.learner_id
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
  -- 上から順に「1週ずつきちんと下がっているか」を見る
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

comment on function public.qr_week(uuid) is
  '今週の Quick Response の続き具合。日ではなく週で数える(vocab_week と同じ)。';

revoke all on function public.qr_week(uuid) from public;
grant execute on function public.qr_week(uuid) to authenticated;

-- ────────────────────────────────────────────────────────────────
-- 5. 週の目標を決める / 読む
--
--   **数え方は DB に置く。** 画面で足し直さない(0022 / 0023 と同じ)。
--   目標と、今週やった数を**1回で返す** —— 画面が2つの窓口を呼んで
--   足し合わせると、そこがずれる。
-- ────────────────────────────────────────────────────────────────
drop function if exists public.set_weekly_goal(uuid, integer, integer);

create or replace function public.set_weekly_goal(
  p_learner   uuid,
  p_words     integer default 0,
  p_sentences integer default 0
)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  -- **決められるのは担当トレーナー(と管理者)だけ。**
  -- 判定は**この中だけ**に置く(画面に持たせない)
  if not (public.teaches(p_learner) or public.is_owner()) then
    raise exception '担当していないゲストの目標は決められません';
  end if;

  -- **とんでもない数を入れさせない。** 0 は「決めていない」
  insert into public.weekly_goals as g (learner_id, words, sentences, set_by, updated_at)
  values (p_learner,
          greatest(0, least(coalesce(p_words, 0), 2000)),
          greatest(0, least(coalesce(p_sentences, 0), 2000)),
          auth.uid(), now())
  on conflict (learner_id) do update
    set words      = excluded.words,
        sentences  = excluded.sentences,
        set_by     = excluded.set_by,
        updated_at = now();
end;
$$;

comment on function public.set_weekly_goal(uuid, integer, integer) is
  '週の目標(語 / 文)を決める。担当トレーナーと管理者だけ(0042)。0 は決めていない。';

revoke all on function public.set_weekly_goal(uuid, integer, integer) from public;
grant execute on function public.set_weekly_goal(uuid, integer, integer) to authenticated;

drop function if exists public.weekly_goal(uuid);

create or replace function public.weekly_goal(p_learner uuid default null)
returns table (
  words_goal integer,   -- 週の目標(語)。0 なら決めていない
  words_done integer,   -- 今週答えた語の回数
  sent_goal  integer,   -- 週の目標(文)
  sent_done  integer    -- 今週答えた文の回数
)
language sql
stable
security definer
set search_path = public
as $$
  with me as (select coalesce(p_learner, auth.uid()) as id),
  allowed as (
    select id from me
     where id = auth.uid() or public.teaches(id) or public.is_owner()
  ),
  goal as (
    select g.words, g.sentences
      from public.weekly_goals g join allowed a on a.id = g.learner_id
  ),
  w as (
    select coalesce(sum(d.answered), 0)::int as n
      from public.vocab_days d join allowed a on a.id = d.learner_id
     where d.done_on >= date_trunc('week', current_date)::date
  ),
  s as (
    select coalesce(sum(d.answered), 0)::int as n
      from public.qr_days d join allowed a on a.id = d.learner_id
     where d.done_on >= date_trunc('week', current_date)::date
  )
  -- **見えない人には 0 を返す。** 「見られません」と例外にすると、
  -- 画面がそこで止まる(0 なら「決めていない」と同じ見た目になる)
  select
    coalesce((select words from goal), 0),
    (select n from w),
    coalesce((select sentences from goal), 0),
    (select n from s);
$$;

comment on function public.weekly_goal(uuid) is
  '週の目標と、今週やった数を1回で返す(0042)。数え方は DB に置く。';

revoke all on function public.weekly_goal(uuid) from public;
grant execute on function public.weekly_goal(uuid) to authenticated;

-- ────────────────────────────────────────────────────────────────
-- 6. まとめて消すときに、この2つも消す(0041 の作り直し)
--
--   **表を足したら、消す側にも足す**(CLAUDE.md)。
--   中身は 0041 をそのまま写し、`qr_days` と `weekly_goals` の
--   2つだけを足してある。**キーの名前も日本語のまま**である ——
--   画面はこれをそのまま出すし、`rls_test.sql` もこの名前で数えている。
-- ────────────────────────────────────────────────────────────────
drop function if exists public.erase_learner(uuid);

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

comment on function public.erase_learner(uuid) is
  'ゲスト1人の記録を、表をまたいでまとめて消す(管理者だけ)。'
  'ログインそのもの(auth.users)は消さない —— Supabase の画面から消す。';

-- ============================================================================
-- 0043 教材の種類に「Speech練習」を足す
--
-- 【なぜ要るか】(2026-09 利用者の指定)
--
--   > 自分でスピーチなどを考えてもらったものをそのままコピペして
--   > 指定する音声で text to speech をして、オーバーラッピングや
--   > シャドーイングのように練習できるモードが欲しいです。
--   > 基本的に「記事」と同じで大丈夫なのですが、タイトルを
--   > 「Speech練習」などにしてほしいです。
--   > そして、教材作成の一覧に「Speech練習」を追加して下さい。
--
-- 【足すのは `materials.kind` の値1つだけ】
--
--   スピーチの本文は、記事とまったく同じ形である
--   (段落が並び、話す人は1人)。だから**演習の種類は増やしていない。**
--   増やすと `material_sections_type_check` も窓口も触ることになり、
--   すでに作った記事と別物になってしまう。
--   **会議(0037)とまったく同じ考え方**である。
--
-- 【窓口(Edge Function)の置き直しは要りません】
--
--   「記事ではなくスピーチとして書く」という指示は、
--   すでにある「話題の指定」に画面が組み立てて渡している
--   (`src/lib/speechDraft.js`)。窓口のコードは1行も変えていない。
--
-- 【何が起きるか】
--   `materials` の「種類」に入れてよい値が1つ増えます。
--   **表も列も増えません。** 行は1つも書き換わりません。
--
-- 【どこまで影響するか】
--   教材・宿題・単語帳・ゲストの情報・取り組みの記録には触れません。
--   RLS(見える範囲の決まり)も変えません。
--   **何度貼っても同じ結果になります。**
--
-- 【成功の目安】
--   `Success. No rows returned` と出れば成功です。
-- ============================================================================

alter table public.materials drop constraint if exists materials_kind_check;
alter table public.materials
  add constraint materials_kind_check check (kind in (
    -- **一覧はどのファイルでも同じにする。**あとの移行で足した値も、
    -- ここに書く。狭いままだと、その値を使っている DB に貼り直したとき
    -- "violated by some row" で止まる(scripts/check-constraint-lists.mjs)
    'pattern',    -- 文型ドリル(4演習 × 10問 = 40問)
    'reading',    -- リーディング(記事1本 + 内容理解 + ディスカッション + 語句)
    'dialogue',   -- ダイアローグ(会話1本。2人)
    'meeting',    -- 会議(会話と同じ形。**3〜4人**・0037)
    'speech',     -- Speech練習(記事と同じ形。**1人が話しきる**・0043)
    'vocab',      -- 単語 / フレーズ(単語10 + フレーズ10・**0047**)
    'word',       -- 旧「単語」。新規では使わないが、既存の行のために残す
    'phrase',     -- 旧「フレーズ」。同上
    'passage'     -- 旧「長文」。同上
  ));

comment on column public.materials.kind is
  '教材の種類。pattern / reading / dialogue / meeting / speech / word / phrase / passage';

-- ============================================================================
-- 0044 管理者は、どの教材でも消せるようにする
--
-- 【なぜ要るか】(2026-09 利用者の指定)
--
--   > ゲストに作った教材を消す方法を作って下さい。
--   > 全ての場面にて「教材を消す」の機能を追加したいです。
--   > トレーナーだけの機能です。ゲストには消せません
--
-- 【いまの決まり】
--
--   0001 の「教材を作れるのはトレーナーだけ」は
--
--       for all ... using (public.is_admin() and created_by = auth.uid())
--
--   なので、**消せるのは作った本人だけ**である(`for all` には
--   delete も含まれる)。**ここは1文字も変えていない。**
--
--   ところが教材は既定で**全トレーナーの共有物**(`visibility = 'school'`)
--   なので、作った人が退会すると**誰にも消せない教材**が残る。
--   0041(ゲストの記録をまとめて消す)で見つけたのと同じ穴である。
--
-- 【だから、管理者にだけ delete を足す】
--
--   RLS のポリシーは **or** で足し合わされるので、
--   「作った本人」はこれまでどおり消せて、そこに管理者が加わるだけ。
--
--   - **トレーナーには足さない。** 人の作った教材を消せると事故が大きい
--     (担当ゲスト全員の宿題から、黙って消える)
--   - **ゲストには足さない。** そもそも `is_owner()` が false である
--   - **判定はこの関数の中だけ。画面には持たせない**(CLAUDE.md)
--
-- 【消すと、何が道連れになるか】
--
--   `materials` を参照している表は、どれも `on delete cascade`
--   (または `set null`)である。**あとから足した表も全部そうなっている。**
--
--     material_tags / material_items / material_audio / assignments (0001)
--     sentence_ledger (0008) / material_sections (0007)
--     material_progress (0025)
--     word_reviews.material_id (0011)   … set null(語そのものは残る)
--     qr_reviews.material_id  (0040)   … set null(文そのものは残る)
--
--   **単語帳と Quick Response の復習は消えない。** あちらは
--   「その語・その文」の記録であって、教材の持ち物ではない。
--
-- 【何が起きるか】
--   `materials` に delete のポリシーが1つ増えます。
--   **表も列も増えません。行は1つも書き換わりません。**
--
-- 【どこまで影響するか】
--   見える範囲(select)も、作る・直す(insert / update)も変えません。
--   **何度貼っても同じ結果になります。**
--
-- 【成功の目安】
--   `Success. No rows returned` と出れば成功です。
-- ============================================================================

drop policy if exists "教材を消せるのは管理者も" on public.materials;
create policy "教材を消せるのは管理者も" on public.materials
  for delete to authenticated
  using (public.is_owner());

comment on table public.materials is
  '教材。消せるのは作った本人(0001)と管理者(0044)だけ。ゲストは消せない';

-- ============================================================================
-- 0045 演習の種類に「想定される質問」を足す
--
-- 【なぜ要るか】(2026-09 利用者の指定)
--
--   > 作成したスピーチに対して、聴衆から想定される質問を作る機能を
--   > 実装して下さい。質問は、他の演習と同じように個数を5個、10個と
--   > 選べるようにして下さい。
--
-- 【ディスカッションとは、向きが逆である】
--
--   ・ディスカッション … 本文をきっかけに**自分から**考えを話す
--   ・想定される質問   … 話し終えたあと、**相手から**投げられる
--
--   スピーチで本当に怖いのは原稿そのものではなく、**そのあとの質疑**である。
--   だから「答えを読む」のではなく「答えを用意しておく」ための演習にした。
--   `answer` は持たせない —— 答えるのは話し手本人で、正解は1つに決まらない
--   (ディスカッションとまったく同じ考え方)。
--
-- 【出すのは Speech練習だけ】
--   記事にも会話にも、話し終えたあとの聴衆はいない。
--   `DEFAULT_SECTIONS.speech` にだけ入れてある。
--
-- 【何が起きるか】
--   `material_sections.exercise_type` に入れてよい値が**1つ増えるだけ。**
--   **表も列も増えません。すでに入っている行は1つも書き換わりません。**
--
-- 【どこまで影響するか】
--   教材・宿題・単語帳・ゲストの情報・取り組みの記録には触れません。
--   RLS(見える範囲の決まり)も変えません。
--   **何度貼っても同じ結果になります。**
--
-- 【あわせて必要な作業】
--   **`generate-material`(教材を作る関数)の置き直しが要ります。**
--   置き直すまで、Speech練習の「想定される質問」だけが作られません
--   (ほかの演習はこれまでどおり作られます)。画面が赤く知らせます。
--
-- 【成功の目安】
--   `Success. No rows returned` と出れば成功です。
-- ============================================================================

alter table public.material_sections drop constraint if exists material_sections_type_check;
alter table public.material_sections
  add constraint material_sections_type_check check (exercise_type in (
    -- **一覧はどのファイルでも同じにする。**あとの移行で足した値も、
    -- ここに書く。狭いままだと、その値を使っている DB に貼り直したとき
    -- "violated by some row" で止まる(scripts/check-constraint-lists.mjs)
    -- 文型ドリル
    --   error_correction … 誤りを1か所直す。**穴埋めの置き換え**(0034)
    'translate_en_ja', 'error_correction', 'translate_ja_en', 'listening',
    -- 本文(まとまった1本)
    'article', 'dialogue',
    -- 本文に対する設問と語句
    --   discussion  … 本文をきっかけに自分の考えを話す。**正解が無い**(0033)
    --   audience_qa … 話し終えたあと、聴衆から投げられる質問。**正解が無い**(0045)
    'comprehension', 'discussion', 'audience_qa', 'vocab_note',
    -- 旧「長文」で使っていたもの。既存の行のために残す
    'read_aloud', 'overlapping', 'shadowing', 'repeating',
    -- 穴埋め。**新規では使わない**(0034 で誤り訂正へ差し替えた)。
    -- すでに作った教材を開くために残す
    'fill_blank',
    -- 単語・フレーズ
    'vocabulary', 'phrase'
  ));


-- ============================================================================
-- 0046 教材に「切り口」と「何の話だったか」を控える
--
-- 【なぜ要るか】(2026-09 利用者の指定)
--   「同じ条件で作っても、過去の内容に被らないようにしたい」。
--
--   これまで「被らない」を守っていたのは**英文の単位だけ**だった。
--   ところが英文が1つも一致しなくても、
--   「会議に遅れた新人が上司に謝る話」と
--   「打ち合わせに遅れた新人が先輩に謝る話」は、
--   ゲストから見れば**同じような話**である。
--
--   angle … その教材を**どの切り口で作ったか**。
--           保存しないと、おまかせが同じ切り口を続けて引く。
--   gist  … その教材が**何の話だったか**を日本語1〜2行。
--           次に同じ業界・場面で作るとき、これを渡して避けさせる。
--
-- 【何が起きるか】
--   `materials` の表に**列が2つ増えるだけ**です。
--   **すでに入っている教材は1行も書き換わりません**(2列とも空になります)。
--   空でも困りません —— 見出しと話題は前から入っているので、
--   **貼ったその日から「避ける」は効きます。**
--
-- 【何度貼っても安全です】
--   `add column if not exists` なので、2回貼っても同じ結果になります。
-- ============================================================================

alter table public.materials
  add column if not exists angle text,
  add column if not exists gist  text;

comment on column public.materials.angle is
  '話の切り口(src/data/materialAngles.js の id)。保存しないと、おまかせが同じ切り口を続けて引く';

comment on column public.materials.gist is
  'その教材が何の話だったか(日本語1〜2行)。次に同じ業界・場面で作るとき、これを渡して同じ筋を避けさせる';

create index if not exists materials_industry_kind_idx
  on public.materials (industry, kind, created_at desc);


-- ============================================================================
-- 0047 単語 / フレーズを1つの種類にまとめ、**共有したら単語帳に入れる**
--
-- 【なぜ要るか】(2026-09 利用者の指定)
--
--   > 単語のトレーニング、これだけでは全くトレーニングとして
--   > 成り立っていません。。。単語、、、例えば、こういうふうに教材にする
--   > というより、ゲストの単語帳に課題としてアサインできる方が良いですね。
--   > または、２つ目のトレーニングに穴埋めがあったり、３つ目が日→英に
--   > なっていたり、そういう仕組みで単語が覚えられるような仕組みにしたい
--   > です。これは、フレーズのトレーニングとドッキングして一緒にするのも
--   > 良いかもしれません。
--
--   単語の教材は **20問を1回解いて終わり**だった。ところが同じアプリの
--   **単語帳のほうには、間隔をあけた復習(0015〜0039)がすでにある。**
--   出題の形も箱に応じて4つに変わる。
--   **練習の実体を、そちらへ移すのがいちばん近道である。**
--
-- 【このファイルがすること(3つ)】
--
--   ① `materials.kind` に **`vocab`**(単語 / フレーズ)を足す
--   ② **`add_material_words()`** … 教材の語句を、ゲストの単語帳へ入れる
--   ③ `review_words()` … 意味の控えがまだ無い語では、
--      **その教材に書いてある訳**を出す
--
-- 【何が起きるか】
--   ・教材の種類に入れてよい値が1つ増えます(**行は書き換わりません**)
--   ・関数が1つ増え、1つ作り直されます
--   ・**表も列も増えません**
--
-- 【どこまで影響するか】
--   ・いま単語帳に入っている語の状態・箱・次に出す日は、**1件も変わりません**
--   ・教材・宿題・ゲストの情報・取り組みの記録には触れません
--   ・RLS(見える範囲の決まり)も変えません
--
-- 【何度貼っても安全】
--   制約の貼り直しと、drop してからの作り直しだけです。
--
-- 【成功の目安】
--   `Success. No rows returned` と出れば成功です。
-- ============================================================================

-- ────────────────────────────────────────────────────────────────
-- ① 教材の種類に `vocab` を足す
--
--   **旧い `word` / `phrase` は消さない。** 消すと、その種類で作った
--   教材が開けなくなる(`fill_blank` を残したのと同じ考え方)。
--   新しく作るときだけ `vocab` を選ぶ(画面が旧い2つを出さない)。
-- ────────────────────────────────────────────────────────────────
alter table public.materials drop constraint if exists materials_kind_check;
alter table public.materials
  add constraint materials_kind_check check (kind in (
    -- **一覧はどのファイルでも同じにする。**あとの移行で足した値も、
    -- ここに書く。狭いままだと、その値を使っている DB に貼り直したとき
    -- "violated by some row" で止まる(scripts/check-constraint-lists.mjs)
    'pattern',    -- 文型ドリル(4演習 × 10問 = 40問)
    'reading',    -- リーディング(記事1本 + 内容理解 + ディスカッション + 語句)
    'dialogue',   -- ダイアローグ(会話1本。2人)
    'meeting',    -- 会議(会話と同じ形。**3〜4人**・0037)
    'speech',     -- Speech練習(記事と同じ形。**1人が話しきる**・0043)
    'vocab',      -- 単語 / フレーズ(単語10 + フレーズ10・**0047**)
    'word',       -- 旧「単語」。新規では使わないが、既存の行のために残す
    'phrase',     -- 旧「フレーズ」。同上
    'passage'     -- 旧「長文」。同上
  ));

comment on column public.materials.kind is
  '教材の種類。pattern / reading / dialogue / meeting / speech / vocab / '
  'word / phrase / passage(うしろの3つは旧い形。新規では選べない)';

-- ────────────────────────────────────────────────────────────────
-- ② add_material_words() — 教材の語句を、ゲストの単語帳へ入れる
--
-- 【`mark_word()` を20回呼ばない】
--
--   1語ずつ呼ぶと20往復になるうえ、あちらは**答えた記録**
--   (`vocab_days`)まで増やしてしまう。**まだ誰も答えていない。**
--   だから入れるだけの関数を別に置く。
--
-- 【すでに入っている語は、いっさい触らない】
--
--   `on conflict do nothing`。**箱を 0 に戻さない。**
--   何度共有しても、覚えかけの語が振り出しに戻ることはない。
--
-- 【入るのは「まだ」、その日から出す】
--
--   手で入れた語(`WordbookAdd`)とまったく同じ扱いである(0030)。
--   共有したその日のレッスンで、そのまま復習に使える。
--
-- 【誰の単語帳に入れてよいか】
--
--   **判断はこの関数の中だけ。画面に持たせない。**
--   自分自身 / 担当しているゲスト(`teaches()`)/ 管理者(`is_owner()`)。
-- ────────────────────────────────────────────────────────────────
drop function if exists public.add_material_words(uuid[], uuid);

create or replace function public.add_material_words(
  p_learners uuid[],
  p_material uuid
)
-- **返す名前を `learner` にする。** `learner_id` は `word_reviews` の列名でも
-- あるので、同じ名前を返り値に使うと `on conflict (learner_id, ...)` の
-- ところで PL/pgSQL が変数と取り違える(「ambiguous」で止まる)
returns table (learner uuid, added int)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_who   uuid;
  v_added int;
begin
  if auth.uid() is null then
    raise exception 'ログインしていません';
  end if;
  if p_material is null then
    raise exception '教材が指定されていません';
  end if;

  foreach v_who in array coalesce(p_learners, array[]::uuid[])
  loop
    if v_who <> auth.uid()
       and not public.teaches(v_who)
       and not public.is_owner() then
      raise exception '担当していないゲストの単語帳には入れられません';
    end if;

    with src as (
      -- **語句の演習だけ**(単語 / フレーズ)。
      -- 記事の「本文に出てきた語句」(`vocab_note`)は入れない ——
      -- あちらはゲストが本文の中で触って自分で選ぶ道がすでにある。
      -- 全部入れると、記事1本ごとに8語ずつ勝手に溜まっていく
      select public.norm_word(i.prompt_en) as norm,
             case when s.exercise_type = 'phrase' then 'phrase' else 'word' end as kind
        from public.material_items i
        join public.material_sections s on s.id = i.section_id
       where s.material_id = p_material
         and s.exercise_type in ('vocabulary', 'phrase')
         and public.norm_word(i.prompt_en) is not null
       group by 1, 2
       limit 200          -- 際限なく入れない
    ), put as (
      insert into public.word_reviews as w
        (learner_id, word_norm, kind, status, box, due_on, material_id, updated_at)
      select v_who, src.norm, src.kind, 'unknown', 0, current_date, p_material, now()
        from src
      -- **すでにある語は、1つも触らない。** 箱も次に出す日もそのまま
      on conflict (learner_id, word_norm) do nothing
      returning 1
    )
    select count(*)::int into v_added from put;

    learner := v_who;
    added   := coalesce(v_added, 0);
    return next;
  end loop;
end;
$$;

comment on function public.add_material_words(uuid[], uuid) is
  '教材の語句(単語 / フレーズの演習)を、ゲストの単語帳に「まだ」として入れる(0047)。'
  'すでに入っている語には触らない(箱を戻さない)。'
  '答えた記録(vocab_days)は増やさない。まだ誰も答えていないため。'
  '担当外のゲストには入れられない。';

revoke all on function public.add_material_words(uuid[], uuid) from public;
grant execute on function public.add_material_words(uuid[], uuid) to authenticated;

-- ────────────────────────────────────────────────────────────────
-- ③ review_words() — 控えがまだ無い語では、教材に書いてある訳を出す
--
-- 【なぜ要るか】
--
--   ②で入れた語は、**まだ誰も意味を引いていない**ことがある
--   (`word_glosses` は、本文で語に触れたときに埋まる控えである)。
--   そのままだと単語帳に「(意味の控えがありません)」と並び、
--   4択も作れない(まちがいの選択肢は意味から作るため)。
--
--   **その意味は、教材の中にもう書いてある**(`material_items.prompt_ja`)。
--   控えが無いときだけ、そちらを出す。
--   **新しく AI に尋ねない = 費用は1円もかからない。**
--   **`word_glosses` には書き込まない** —— あそこに書けるのは
--   Edge Function だけ、という決まりは変えない(CLAUDE.md)。
--
-- 【返す列は変えていない】
--   それでも **先に drop を置く**(CLAUDE.md)。
--   あとで誰かが列を足したときに、このファイルだけを貼り直すと
--   `cannot change return type of existing function` で止まるためである。
-- ────────────────────────────────────────────────────────────────
drop function if exists public.review_words(uuid, text, int, boolean);

create or replace function public.review_words(
  p_learner  uuid,
  p_status   text    default 'unknown',
  p_limit    int     default 40,
  p_due_only boolean default false
)
returns table (
  word_norm      text,
  display        text,
  kind           text,
  pos            text,
  meaning_ja     text,
  seen_in        text,
  seen_in_ja     text,
  status         text,
  box            smallint,
  due_on         date,
  updated_at     timestamptz,
  added_at       timestamptz,
  material_id    uuid,
  material_title text,
  material_industry text,
  material_kind     text,
  material_genre    text,
  material_scene    text,
  learn_streak      smallint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not (
    p_learner = auth.uid()
    or public.teaches(p_learner)
    or public.is_owner()
  ) then
    raise exception '担当していないゲストの復習語は取得できません';
  end if;

  return query
    select r.word_norm,
           -- **見せ方も、控えが無ければ教材のとおりに**(0047)。
           -- `word_norm` は小文字にそろえた形なので、そのままだと
           -- 固有名詞まで小文字で並ぶ
           coalesce(g.display, nullif(mi.prompt_en, ''), r.word_norm),
           r.kind,
           coalesce(g.pos, ''),
           -- **控えが無いときは、教材に書いてある訳を出す**(0047)
           coalesce(nullif(g.meaning_ja, ''), nullif(mi.prompt_ja, ''), ''),
           r.seen_in,
           r.seen_in_ja,
           r.status,
           r.box,
           r.due_on,
           r.updated_at,
           r.added_at,
           r.material_id,
           m.title,
           m.industry,
           m.kind,
           m.genre,
           m.scene,
           r.learn_streak
    from public.word_reviews r
    left join lateral (
      select gg.display, gg.pos, gg.meaning_ja
      from public.word_glosses gg
      where gg.word_norm = r.word_norm
      order by (gg.context_key <> ''), gg.created_at
      limit 1
    ) g on true
    -- **教材が消えていても語は残す。** 絞り込みの手がかりが減るだけ
    left join public.materials m on m.id = r.material_id
    -- **その語が入った教材に、訳が書いてあれば使う**(0047)。
    -- 語句の演習(単語 / フレーズ / 本文に出てきた語句)だけを見る
    left join lateral (
      select ii.prompt_en, ii.prompt_ja
      from public.material_items ii
      join public.material_sections ss on ss.id = ii.section_id
      where ss.material_id = r.material_id
        and ss.exercise_type in ('vocabulary', 'phrase', 'vocab_note')
        and public.norm_word(ii.prompt_en) = r.word_norm
      limit 1
    ) mi on true
    where r.learner_id = p_learner
      and (p_status is null
           or (p_status = 'todo' and r.status in ('unknown', 'learning'))
           or r.status = p_status)
      and (not p_due_only or r.due_on <= current_date)
    order by (r.status = 'learning'), r.due_on, r.box, r.updated_at desc
    limit greatest(1, least(coalesce(p_limit, 40), 200));
end;
$$;

comment on function public.review_words(uuid, text, int, boolean) is
  'ゲストの語を意味付きで返す。p_status に todo を渡すと「まだ + 覚えかけ」。'
  '並びは まだ → 覚えかけ の順(0027)。p_due_only で「今日出すもの」に絞る。'
  '出会った教材の分野・種類・話題・場面も返す(0028)。'
  '続けて思い出せた回数(learn_streak)も返す(0039)。'
  '意味の控えがまだ無い語では、その教材に書いてある訳を出す(0047)。'
  '担当外は拒否する。';

revoke all on function public.review_words(uuid, text, int, boolean) from public;
grant execute on function public.review_words(uuid, text, int, boolean) to authenticated;

-- ============================================================================
-- 0048 復習の絞り込みに「レベル」を足す
--
--   単語帳と Quick Response の復習を、教材の**レベル(CEFR)**でも
--   絞り込めるようにします。**表も列も増えません** ——
--   `materials.level` にもともと入っている値を、返していなかっただけです。
--   関数を2つ作り直すだけなので、いまの単語帳・復習の中身は1行も変わりません。
-- ============================================================================

-- ────────────────────────────────────────────────────────────────
-- 1. review_words() — 単語帳(0047 の中身に material_level を足しただけ)
-- ────────────────────────────────────────────────────────────────
drop function if exists public.review_words(uuid, text, int, boolean);

create or replace function public.review_words(
  p_learner  uuid,
  p_status   text    default 'unknown',
  p_limit    int     default 40,
  p_due_only boolean default false
)
returns table (
  word_norm      text,
  display        text,
  kind           text,
  pos            text,
  meaning_ja     text,
  seen_in        text,
  seen_in_ja     text,
  status         text,
  box            smallint,
  due_on         date,
  updated_at     timestamptz,
  added_at       timestamptz,
  material_id    uuid,
  material_title text,
  material_industry text,
  material_kind     text,
  material_genre    text,
  material_scene    text,
  material_level    text,
  learn_streak      smallint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not (
    p_learner = auth.uid()
    or public.teaches(p_learner)
    or public.is_owner()
  ) then
    raise exception '担当していないゲストの復習語は取得できません';
  end if;

  return query
    select r.word_norm,
           -- **見せ方も、控えが無ければ教材のとおりに**(0047)。
           -- `word_norm` は小文字にそろえた形なので、そのままだと
           -- 固有名詞まで小文字で並ぶ
           coalesce(g.display, nullif(mi.prompt_en, ''), r.word_norm),
           r.kind,
           coalesce(g.pos, ''),
           -- **控えが無いときは、教材に書いてある訳を出す**(0047)
           coalesce(nullif(g.meaning_ja, ''), nullif(mi.prompt_ja, ''), ''),
           r.seen_in,
           r.seen_in_ja,
           r.status,
           r.box,
           r.due_on,
           r.updated_at,
           r.added_at,
           r.material_id,
           m.title,
           m.industry,
           m.kind,
           m.genre,
           m.scene,
           m.level,
           r.learn_streak
    from public.word_reviews r
    left join lateral (
      select gg.display, gg.pos, gg.meaning_ja
      from public.word_glosses gg
      where gg.word_norm = r.word_norm
      order by (gg.context_key <> ''), gg.created_at
      limit 1
    ) g on true
    -- **教材が消えていても語は残す。** 絞り込みの手がかりが減るだけ
    left join public.materials m on m.id = r.material_id
    -- **その語が入った教材に、訳が書いてあれば使う**(0047)。
    -- 語句の演習(単語 / フレーズ / 本文に出てきた語句)だけを見る
    left join lateral (
      select ii.prompt_en, ii.prompt_ja
      from public.material_items ii
      join public.material_sections ss on ss.id = ii.section_id
      where ss.material_id = r.material_id
        and ss.exercise_type in ('vocabulary', 'phrase', 'vocab_note')
        and public.norm_word(ii.prompt_en) = r.word_norm
      limit 1
    ) mi on true
    where r.learner_id = p_learner
      and (p_status is null
           or (p_status = 'todo' and r.status in ('unknown', 'learning'))
           or r.status = p_status)
      and (not p_due_only or r.due_on <= current_date)
    order by (r.status = 'learning'), r.due_on, r.box, r.updated_at desc
    limit greatest(1, least(coalesce(p_limit, 40), 200));
end;
$$;

comment on function public.review_words(uuid, text, int, boolean) is
  'ゲストの語を意味付きで返す。p_status に todo を渡すと「まだ + 覚えかけ」。'
  '絞り込みの手がかり(教材名・分野・種類・話題・場面・レベル)も返す(0048)。'
  '担当外のゲストを指定すると例外で拒否する。';

grant execute on function public.review_words(uuid, text, int, boolean) to authenticated;

-- ────────────────────────────────────────────────────────────────
-- 2. qr_items() — Quick Response(0040 の中身に material_level を足しただけ)
-- ────────────────────────────────────────────────────────────────
drop function if exists public.qr_items(uuid, text, int, boolean);

create or replace function public.qr_items(
  p_learner  uuid,
  p_status   text    default 'todo',
  p_limit    int     default 200,
  p_due_only boolean default false
)
returns table (
  en_norm           text,
  en                text,
  ja                text,
  speaker           text,
  status            text,
  box               smallint,
  learn_streak      smallint,
  due_on            date,
  added_at          timestamptz,
  updated_at        timestamptz,
  material_id       uuid,
  material_title    text,
  material_industry text,
  material_kind     text,
  material_genre    text,
  material_scene    text,
  material_level    text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not (
    p_learner = auth.uid()
    or public.teaches(p_learner)
    or public.is_owner()
  ) then
    raise exception '担当していないゲストの復習は取得できません';
  end if;

  return query
    select q.en_norm, q.en, q.ja, q.speaker,
           q.status, q.box, q.learn_streak, q.due_on, q.added_at, q.updated_at,
           q.material_id, m.title, m.industry, m.kind, m.genre, m.scene, m.level
      from public.qr_reviews q
      -- **教材が消えていても文は残す。** 絞り込みの手がかりが減るだけ
      left join public.materials m on m.id = q.material_id
     where q.learner_id = p_learner
       and (p_status is null
            or (p_status = 'todo' and q.status in ('unknown', 'learning'))
            or q.status = p_status)
       and (not p_due_only or q.due_on <= current_date)
     -- **まだ を先に、言えかけ を次に**(単語帳と同じ)
     order by (q.status = 'learning'), q.due_on, q.box, q.updated_at desc
     limit greatest(1, least(coalesce(p_limit, 200), 500));
end;
$$;

comment on function public.qr_items(uuid, text, int, boolean) is
  'Quick Response の復習に出す文を返す(0040)。'
  'p_status に todo を渡すと「まだ + 言えかけ」。p_due_only で今日ぶんに絞る。'
  '絞り込みの手がかり(教材名・分野・種類・話題・場面・レベル)も返す(0048)。'
  '担当外は拒否する。';

grant execute on function public.qr_items(uuid, text, int, boolean) to authenticated;



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


-- ============================================================================
-- English AI System — 苦手タグの文法項目を15件足す
--
-- 【なぜ必要か】(2026-09 利用者の指定)
--
--   > ついでに苦手タグの文法項目にまだないもので
--   > 一般的なものがあれば追加してください
--
--   文法の見出しには16件しか無く、**受動態・助動詞・動名詞・文型といった、
--   どの文法書にも見出しがあるものが選べなかった。**
--   中学英語(30日講座)をそのまま乗せられないうえ、
--   レッスンで「受け身が言えていない」と気づいても、
--   その弱点で教材を作れなかった。
--
-- 【なぜ SQL が要るか — いちばん大事なところ】
--
--   弱点タグは**画面(`src/data/weaknessTags.js`)と表の2か所**にある。
--   しかも `material_tags.tag_id` は `weakness_tags(id)` を参照している。
--
--     tag_id text not null references public.weakness_tags(id)
--
--   だから**このファイルを貼る前に新しいタグで教材を発行すると、
--   その瞬間に外部キー違反で止まる。**
--   演習の種類・教材の種類とまったく同じ落とし穴である(CLAUDE.md)。
--   `scripts/check-exercise-types.mjs` が、画面と表の食い違いを見張る。
--
-- 【何を消すか】
--   **何も消さない。何も書き換えない。** 既存の16件は1文字も触らない。
--   足すのは15行だけで、**何度実行してもよい**(`on conflict` で上書き)。
--
-- 【貼る前でも壊れない】
--   足したタグを選ばなければ、これまでどおり動く。
--   選んで発行したときだけ止まる(そして、その場でこのファイルを貼れば直る)。
-- ============================================================================

-- ────────────────────────────────────────────────────────────────
-- 0. **もとから抜けていた「母音全般」を足す**(2026-09)
--
--    この見張りを作った日に、いちばん最初に赤くなったのがこれである。
--    `all-consonants`(子音全般)は 0001 で入っているのに、
--    **`all-vowels`(母音全般)はどの移行にも無かった。**
--    画面(`weaknessTags.js`)には最初からあるので、
--    **そのタグを付けて教材を発行すると、ずっと止まっていた**ことになる。
--
--    誰も踏まなかったのは、これが `drill`(網羅型の練習)で、
--    弱点の選択肢には出ないタグだからである。
--    **見張りが無ければ、踏むまで分からなかった。**
-- ────────────────────────────────────────────────────────────────
insert into public.weakness_tags (id, category, kind, label, hint, sort_order) values
  ('all-vowels',       'pronunciation', 'drill', '母音全般',
   '特定の音ではなく、母音をひととおり通す網羅型の練習', 75)
on conflict (id) do update
  set category = excluded.category,
      kind     = excluded.kind,
      label    = excluded.label,
      hint     = excluded.hint;

-- ────────────────────────────────────────────────────────────────
-- 1. 文法の項目を15件足す
-- ────────────────────────────────────────────────────────────────
insert into public.weakness_tags (id, category, kind, label, hint, sort_order) values
  ('sentence-pattern', 'grammar', 'weakness', '文型(SVOC)',
   'S / V / O / C の並び。「誰が どうする 何を」の骨組み', 500),
  ('passive',          'grammar', 'weakness', '受動態',
   'be + 過去分詞。誰がしたかを言わずに済ませる形', 501),
  ('modal',            'grammar', 'weakness', '助動詞',
   'can / will / must / should / may。丁寧さと確信の強さが変わる', 502),
  ('gerund',           'grammar', 'weakness', '動名詞',
   '-ing を名詞として使う形。enjoy -ing / want to do の使い分け', 503),
  ('relative-adverb',  'grammar', 'weakness', '関係副詞',
   'where / when / why / how。関係代名詞との違い', 504),
  ('pronoun',          'grammar', 'weakness', '代名詞',
   'it / they / one / this。何を指しているかが相手に伝わるか', 505),
  ('causative',        'grammar', 'weakness', '使役・知覚動詞',
   'make / let / have + 原形、see / hear + O + doing', 506),
  ('reported-speech',  'grammar', 'weakness', '話法',
   '「彼はこう言った」。時制と語順の移し方', 507),
  ('negation',         'grammar', 'weakness', '否定',
   'not / no / never / hardly。部分否定と全体否定', 508),
  ('emphasis',         'grammar', 'weakness', '強調・倒置',
   'It is 〜 that、do + 原形、Never have I 〜', 509),
  ('adverb-form',      'grammar', 'weakness', '形容詞と副詞',
   'good / well、hard / hardly。どちらの形を使うか', 510),
  ('future',           'grammar', 'weakness', '未来の言い方',
   'will / be going to / 現在進行形。決まっている予定かどうか', 511),
  ('there-is',         'grammar', 'weakness', 'there の文',
   'There is / are。「〜がある」を主語を立てずに言う形', 512),
  ('imperative',       'grammar', 'weakness', '命令文・依頼',
   'Do 〜 / Please 〜 / Could you 〜。頼み方の強さ', 513),
  ('time-clause',      'grammar', 'weakness', '時・条件の節',
   'When / If の中では、未来のことも現在形で言う', 514)
on conflict (id) do update
  set category = excluded.category,
      kind     = excluded.kind,
      label    = excluded.label,
      hint     = excluded.hint;

-- ============================================================================
-- 0051 本文に「文法解説(SVOC と修飾要素)」を持たせる
--
-- 【なぜ要るか】(2026-09 利用者の指定)
--
--   > 文章ごとにSVOCと修飾要素についての解説をしてくれる、
--   > 文法解説モードが欲しい。
--
--   スラッシュリーディング(②)は「どこで切るか」までしか教えない。
--   切ったかたまりが**文の中で何の役をしているか**が見えないと、
--   長い文になったとたんに読めなくなる。
--
--       The office / bought / a new coffee machine / last week.
--          S          V            O                  M
--
-- 【なぜ AI に頼むのか — 決まりでは書けない】
--   区切る場所は閉じた語のリストで決められる(`src/lib/chunker.js`)。
--   ところが**一般の動詞は語のリストでは当てられない**
--   (`run` は名詞にも動詞にもなる)。この点は CLAUDE.md に何度も
--   書いてあるとおりで、**SVOC は決まりでは出せない。**
--
-- 【なぜ教材に持たせるのか — 開くたびに作らない】
--   発音記号(0020)・要点フレーズ(0015)・カタマリの訳(0021)と
--   まったく同じ考え方である。
--
--     ・教材を作るときに一緒に … 記事1本で **5〜6円**。1回きり
--     ・開くたびに作る         … 同じ額が、ゲスト500人 × 開いた回数
--
-- 【何を入れるか】
--   `material_items.grammar` に、その項目(段落 / 発言)ぶんを1つだけ。
--
--     {
--       "en": "The office bought a new coffee machine last week.",
--       "sentences": [
--         {
--           "en": "The office bought a new coffee machine last week.",
--           "pattern": "SVO",
--           "parts": [
--             {"t": "The office", "r": "S"},
--             {"t": "bought", "r": "V"},
--             {"t": "a new coffee machine", "r": "O"},
--             {"t": "last week.", "r": "M"}
--           ],
--           "note": "「誰が どうする 何を」の第3文型。last week は「いつ」を足す飾りで、無くても文は成り立つ。"
--         }
--       ]
--     }
--
--   ・`en` … 作ったときの**段落まるごとの**英文。
--     **あとで英文を直したら、対が狂う。** 画面は `en` が今の本文と
--     一致するときだけ解説を出す(食い違ったら出さない)
--   ・`sentences` … **文ごと。** 文の切れ目そのものを控えるので、
--     あとで略語の決まり(`ABBREVIATIONS`)を直しても解説はずれない
--     (カタマリの訳で `parts` を控えたのと、まったく同じ理由)
--   ・`r` … **S / V / O / C / M の5つだけ**(`src/lib/grammarNote.js`)。
--     ここに無い役が入っていたら、画面はその項目の解説を出さない
--   ・`parts` … つなぐと元の文に戻ること。戻らなければ出さない
--     (**ずれた対は、無いより悪い**)
--
-- 【何をするか】
--   `material_items` に `grammar`(jsonb)を1列足すだけ。
--   **表は増やさない。** 権限も既存のまま(教材の項目と同じ扱い)。
--   **既存の行は1つも書き換えない。** 何度実行してもよい。
--
-- 【貼る前でも壊れない】
--   画面は `runTolerant()` が、まだ無い列を外して読み直す(第5.23節)。
--   貼る前は解説が出ないだけで、教材はこれまでどおり開ける。
-- ============================================================================

alter table public.material_items
  add column if not exists grammar jsonb;

comment on column public.material_items.grammar is
  '文法解説(SVOC と修飾要素)。'
  '{"en": 作ったときの段落まるごとの英文, "sentences": [{en, pattern, parts:[{t,r}], note}]}。'
  'r は S / V / O / C / M のみ。parts をつなぐと元の文に戻ること。';

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

-- ============================================================================
-- 0053 基礎単語(基本360語 / 標準1200語)を、まとめて単語帳に入れる
--
-- 【なぜ要るか】(2026-09 利用者の指定)
--
--   > そして、講座の中の単語はそれぞれ基本360語、標準1200語、として
--   > そもそもが独立して選べる単語帳にしてください
--
--   基礎単語は 0052 で **30日講座の中**にしか無かった。
--   「1日目を開いて、12語ずつ入れる」でしか単語帳へ入らないので、
--   **講座をやらない人には、この語に触れる道が1つも無かった。**
--
--   だから単語帳の側から **その段まるごと**を入れられるようにする。
--
-- 【`mark_word()` を 1,200 回呼ばない】(0047 とまったく同じ考え方)
--
--   1語ずつ呼ぶと 1,200 往復になる。
--   しかも `mark_word()` は**答えた記録**(`vocab_days`)まで増やす ——
--   **まだ誰も答えていない。**
--   だから「入れるだけ」の関数を、`add_material_words()` と同じ形で置く。
--
-- 【すでに入っている語は、いっさい触らない】
--
--   `on conflict do nothing`。**箱も、次に出す日も、1つも戻さない。**
--   何度押しても、覚えかけの語が振り出しに戻ることはない。
--
-- 【意味は引かない = 0円】
--
--   基礎単語の訳は `src/data/basicWords.js` に書いてあるので、
--   画面がそれを出す。**窓口(AI)を1回も呼ばない。**
--   `word_glosses` にも書き込まない —— あそこに書けるのは
--   Edge Function だけ、という決まりは変えない(CLAUDE.md)。
--
-- 【何が起きるか】
--   ・SQL の関数が1つ増えます
--   ・**表も列も増えません**
--   ・いま単語帳に入っている語の状態・箱・次に出す日は、**1件も変わりません**
--
-- 【どこまで影響するか】
--   教材・宿題・ゲストの情報・取り組みの記録には触れません。
--   RLS(見える範囲の決まり)も変えません。
--
-- 【何度貼っても安全】
--   drop してからの作り直しだけです。
--
-- 【成功の目安】
--   `Success. No rows returned` と出れば成功です。
-- ============================================================================

drop function if exists public.add_basic_words(text[], uuid);

create or replace function public.add_basic_words(
  p_words   text[],
  p_learner uuid default null
)
returns int
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_who   uuid;
  v_added int;
begin
  if auth.uid() is null then
    raise exception 'ログインしていません';
  end if;

  -- **誰の単語帳に入れてよいか。判断はこの関数の中だけ。画面に持たせない**
  --   自分自身 / 担当しているゲスト(`teaches()`)/ 管理者(`is_owner()`)
  v_who := coalesce(p_learner, auth.uid());
  if v_who <> auth.uid()
     and not public.teaches(v_who)
     and not public.is_owner() then
    raise exception '担当していないゲストの単語帳には入れられません';
  end if;

  with src as (
    -- **そろえ方は `norm_word()` に任せる**(SQL / 窓口 / 画面の3か所で
    -- そろえてある規則を、ここで書き写さない)
    select distinct public.norm_word(w) as norm
      from unnest(coalesce(p_words, array[]::text[])) as w
     where public.norm_word(w) is not null
     limit 2000                    -- 際限なく入れない
  ), put as (
    insert into public.word_reviews as r
      (learner_id, word_norm, kind, status, box, due_on, updated_at)
    -- 基礎単語は**1語ずつ**である(`basicWords.js` が `/^[a-z'-]+$/` で
    -- 見張っている)。だから `kind` は `word` で決め打ちにしてよい
    select v_who, src.norm, 'word', 'unknown', 0, current_date, now()
      from src
    -- **すでにある語は、1つも触らない。** 箱も次に出す日もそのまま
    on conflict (learner_id, word_norm) do nothing
    returning 1
  )
  select count(*)::int into v_added from put;

  return coalesce(v_added, 0);
end;
$$;

comment on function public.add_basic_words(text[], uuid) is
  '基礎単語(基本360語 / 標準1200語)を、単語帳に「まだ」として入れる(0053)。'
  'すでに入っている語には触らない(箱を戻さない)。'
  '答えた記録(vocab_days)は増やさない。まだ誰も答えていないため。'
  '担当外のゲストには入れられない。新しく入った語数を返す。';

revoke all on function public.add_basic_words(text[], uuid) from public;
grant execute on function public.add_basic_words(text[], uuid) to authenticated;


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


-- ============================================================================
-- 0055 ゲストごとに「出すもの」を決める
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
--
-- 【何が起きるか】
--   ・表が1つ増えます(`learner_features`)。**空から始まります。**
--   ・したがって、貼った直後は**どのゲストにも講座は出ません。**
--     出したいゲストは「ゲスト → その人を開く → レベルとスコア」で
--     「この人の画面に出すもの」を押してください。
--   ・`erase_learner()` が作り直されます
--     (**中身は 0054 のものに、消す表を1つ足しただけ**)。
--   ・教材・宿題・単語帳・ゲストの情報には**一切さわりません。**
--   ・**何度実行してもよい**です。
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


-- ============================================================================
-- 0056 単語帳を、200 語より先まで読めるようにする
--
-- **何度貼っても安全である。**
-- ============================================================================

-- ================================================================
-- 0056  単語帳を、全部読めるようにする
--
-- 2026-09 実機・利用者の問い:
--
--   > なぜ「まだ」が1900個以上あるのに出し方で選べるのが200個なのですか？
--
-- 【出どころ】
--   `review_words()` が **200 件で切っていた**(0028 から)。
--   画面の3つの札(まだ 1197 / 覚えかけ 111 / 覚えた 205)は
--   `wordbook_counts()` が**表を直に数えている**ので正しい。
--   ところが「出しかた」の札(今日出す / 1週間 / … / ぜんぶ)は、
--   **読み込んだ 200 行から数えている。**
--   だから**どの範囲を選んでも 200** と出て、範囲を選ぶ意味が消えていた。
--
--   しかも数だけの話ではない。実際に出る語も 200 語のうちからしか選ばれず、
--   4択のまちがいの選択肢も、聞き流しも、紙に出す一覧も、
--   **ぜんぶ同じ 200 語の中**で回っていた。
--
-- 【直し方】上限を上げる。ただし**出どころを1か所にする**
--   `public.wordbook_limit()` を作り、`review_words()` はそこから読む。
--   次に変えたくなったとき、**関数の本文を探し回らずに済む。**
--   画面の `SetupStatus` も、この関数が在るかどうかで
--   「0056 を貼ったか」を見る(**表を作らない移行の印**)。
--
-- 【貼る前でも壊れない】
--   貼るまでは 200 件で切られるだけで、単語帳も復習も動く。
--   画面が「◯◯ 語までしか読めていません」と自分で言う。
--
-- 【`qr_items()` は触っていない】(言われた場所だけを直す)
--   あちらの上限は 500 で、いまの Quick Response 帳は 87 問である。
-- ================================================================

-- ────────────────────────────────────────────────────────────────
-- 1. 上限そのもの。**ここが唯一の出どころ**
-- ────────────────────────────────────────────────────────────────
create or replace function public.wordbook_limit()
returns int
language sql
immutable
set search_path = public
as $$ select 5000 $$;

comment on function public.wordbook_limit() is
  '単語帳を1回に何語まで返すか(0056)。review_words() がここから読む。'
  '画面はこの関数の有無で「0056 を貼ったか」を見る。';

grant execute on function public.wordbook_limit() to authenticated;

-- ────────────────────────────────────────────────────────────────
-- 2. review_words() — 0048 の中身のまま、上限だけを差し替える
--
--    **返す列は1つも変えていない。** それでも
--    `drop function if exists` を先に置く(CLAUDE.md)——
--    あとで誰かが列を足したときに、このファイルだけを貼り直せなくなる。
-- ────────────────────────────────────────────────────────────────
drop function if exists public.review_words(uuid, text, int, boolean);

create or replace function public.review_words(
  p_learner  uuid,
  p_status   text    default 'unknown',
  p_limit    int     default 200,
  p_due_only boolean default false
)
returns table (
  word_norm      text,
  display        text,
  kind           text,
  pos            text,
  meaning_ja     text,
  seen_in        text,
  seen_in_ja     text,
  status         text,
  box            smallint,
  due_on         date,
  updated_at     timestamptz,
  added_at       timestamptz,
  material_id    uuid,
  material_title text,
  material_industry text,
  material_kind     text,
  material_genre    text,
  material_scene    text,
  material_level    text,
  learn_streak      smallint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not (
    p_learner = auth.uid()
    or public.teaches(p_learner)
    or public.is_owner()
  ) then
    raise exception '担当していないゲストの復習語は取得できません';
  end if;

  return query
    select r.word_norm,
           -- **見せ方も、控えが無ければ教材のとおりに**(0047)。
           -- `word_norm` は小文字にそろえた形なので、そのままだと
           -- 固有名詞まで小文字で並ぶ
           coalesce(g.display, nullif(mi.prompt_en, ''), r.word_norm),
           r.kind,
           coalesce(g.pos, ''),
           -- **控えが無いときは、教材に書いてある訳を出す**(0047)
           coalesce(nullif(g.meaning_ja, ''), nullif(mi.prompt_ja, ''), ''),
           r.seen_in,
           r.seen_in_ja,
           r.status,
           r.box,
           r.due_on,
           r.updated_at,
           r.added_at,
           r.material_id,
           m.title,
           m.industry,
           m.kind,
           m.genre,
           m.scene,
           m.level,
           r.learn_streak
    from public.word_reviews r
    left join lateral (
      select gg.display, gg.pos, gg.meaning_ja
      from public.word_glosses gg
      where gg.word_norm = r.word_norm
      order by (gg.context_key <> ''), gg.created_at
      limit 1
    ) g on true
    -- **教材が消えていても語は残す。** 絞り込みの手がかりが減るだけ
    left join public.materials m on m.id = r.material_id
    -- **その語が入った教材に、訳が書いてあれば使う**(0047)。
    -- 語句の演習(単語 / フレーズ / 本文に出てきた語句)だけを見る
    left join lateral (
      select ii.prompt_en, ii.prompt_ja
      from public.material_items ii
      join public.material_sections ss on ss.id = ii.section_id
      where ss.material_id = r.material_id
        and ss.exercise_type in ('vocabulary', 'phrase', 'vocab_note')
        and public.norm_word(ii.prompt_en) = r.word_norm
      limit 1
    ) mi on true
    where r.learner_id = p_learner
      and (p_status is null
           or (p_status = 'todo' and r.status in ('unknown', 'learning'))
           or r.status = p_status)
      and (not p_due_only or r.due_on <= current_date)
    order by (r.status = 'learning'), r.due_on, r.box, r.updated_at desc
    -- **上限は `wordbook_limit()` 1か所**(0056)。ここに数字を書かない
    limit greatest(1, least(coalesce(p_limit, 200), public.wordbook_limit()));
end;
$$;

comment on function public.review_words(uuid, text, int, boolean) is
  'ゲストの語を意味付きで返す。p_status に todo を渡すと「まだ + 覚えかけ」。'
  '絞り込みの手がかり(教材名・分野・種類・話題・場面・レベル)も返す(0048)。'
  '上限は wordbook_limit()(0056)。担当外のゲストを指定すると例外で拒否する。';


-- ============================================================================
-- 0057 業種べつの単語帳(棚)
--
-- **何度貼っても安全である。**
-- ============================================================================

-- ============================================================================
-- 0057 業種べつの単語帳(棚)
--
-- 【なぜ要るか】(2026-09 利用者の指定)
--
--   > 何冊も違う単語帳を持てるようにしてほしいんです。基本は自分の単語帳、
--   > Quick Response が表示され、他の独立した業種や趣味別の単語帳とは
--   > そもそも混ざらないようにしたいんです。「自分の単語帳に追加する」
--   > みたいのを押したものだけ自分の単語帳に追加されてほしいんです。
--   > …そして、ゲストにはトレーナーが指定した単語帳のみが追加されるのです。
--
--   いままで単語帳は**1人1冊**しか無かった(`word_reviews`)。
--   だから業種の語を入れると、教材で出会った語と混ざってしまう。
--
--   **棚は、混ざらない置き場所である。**
--   棚に並んでいるだけでは復習に出てこない。
--   「自分の単語帳に追加する」を押して初めて `word_reviews` に入り、
--   そこから間隔をあけた復習(0015〜0039)が動き出す。
--
-- 【冊の数は 35。**場面ごとには作らない**】
--
--   分野は 83、うち**親は 35**(お仕事 26 / 趣味 9)。
--   場面まで掛けると **約 1,700 通り**になり、CLAUDE.md が
--   「手で書けない。**書けない表は作らない**」と書いた数そのものになる。
--
--   だから**棚は親の分野ごとに1冊**にして、場面は
--   **冊の中の絞り込み**(`scene` の列)にした。利用者の指定である ——
--
--   > 単語帳は業種ごと、出し方の中に場面やシチュエーションで絞り込み
--
-- 【`industry` に check を置かない】
--
--   置くと、**分野を1つ足すたびに SQL を貼り直してもらう**ことになる
--   (`material_sections_type_check` で二度踏んだ落とし穴)。
--   棚の一覧は **`src/data/shelves.js` 1か所**が持ち、
--   そこは `industries.js` の親をそのまま読む(別の一覧を作らない)。
--
-- 【ゲストへの指定に、新しい表を作らない】
--
--   「トレーナーが指定した単語帳のみ」は **0055 の `learner_features`**
--   (ゲスト × 名前で1行)にそのまま入る。あの表は `feature` に
--   check を持たず、comment に「名前の一覧はコード側が持つ」と書いてある。
--   名前は **`shelf:<分野の id>`**(作り方は `shelves.js` 1か所)。
--
--     ・新しい表も、新しい RPC も、新しい RLS も要らない
--     ・`set_learner_feature()` の門番(`teaches()` / `is_owner()`)が効く
--     ・`erase_learner()` が**すでに消している**
--
-- 【何が起きるか】
--   ・表が1つ増えます(`shelf_words`)。**空から始まります**
--   ・SQL の関数が1つ増え(`add_shelf_words`)、1つ作り直されます
--     (`review_words` — **返す列は1つも変わりません**)
--   ・いま単語帳に入っている語の状態・箱・次に出す日は、**1件も変わりません**
--
-- 【どこまで影響するか】
--   教材・宿題・ゲストの情報・取り組みの記録には触れません。
--
-- 【何度貼っても安全】
--   `create table if not exists` と、drop してからの作り直しだけです。
--
-- 【成功の目安】
--   `Success. No rows returned` と出れば成功です。
-- ============================================================================

-- ────────────────────────────────────────────────────────────────
-- 1. 棚そのもの
--
--    **スクール全体で1組**(利用者の指定・ゲストごとに複製しない)。
--    1つの分野に同じ語を二度置かない —— 場面が違っても、
--    **単語帳としては同じ1語**である。だから鍵は (分野, そろえた語)。
-- ────────────────────────────────────────────────────────────────
create table if not exists public.shelf_words (
  -- 棚 = 親の分野の id(`industries.js`)。**check を置かない**(上記)
  industry   text        not null,
  -- そろえた語。**鍵は `norm_word()` と同じそろえ方**(単語帳と同じ)
  word_norm  text        not null,
  -- 画面に出す形(`Marketing` のような大文字を残すため)
  display    text        not null default '',
  kind       text        not null default 'word',
  pos        text        not null default '',
  meaning_ja text        not null default '',
  -- 出会う文。**`word_reviews.seen_in` にそのまま写す**ので、
  -- 自分の単語帳に入れたあと**穴埋め**(箱3)がそのまま効く
  example_en text        not null default '',
  example_ja text        not null default '',
  -- どの場面の語か。**冊の中の絞り込み**に使う(`genres.js` の場面の id)
  scene      text        not null default '',
  -- CEFR。やさしい順に並べ替えたり、レベルで絞ったりするため
  level      text        not null default '',
  created_by uuid        references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (industry, word_norm)
);

-- **`word_reviews` とまったく同じ2つ**(`word_reviews_kind_check`)。
-- 句・イディオム・句動詞は `phrase`。語は `word`
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'shelf_words_kind_check'
  ) then
    alter table public.shelf_words
      add constraint shelf_words_kind_check check (kind in ('word', 'phrase'));
  end if;
end $$;

comment on table public.shelf_words is
  '業種べつの単語帳(棚・0057)。スクール全体で1組。棚は親の分野ごとに1冊。'
  '場面(scene)は冊の中の絞り込みで、冊は分けない。'
  'ここに並んでいるだけでは復習に出ない —— 「自分の単語帳に追加する」を'
  '押して word_reviews に入って初めて、間隔をあけた復習が動き出す。'
  'industry に check を置かないのは、分野を足すたびに SQL を'
  '貼り直すことにならないため。棚の一覧は src/data/shelves.js が持つ。';

create index if not exists shelf_words_scene_idx
  on public.shelf_words (industry, scene);

alter table public.shelf_words enable row level security;

-- **聴くのは全員、入れられるのはトレーナーと管理者だけ。**
-- 棚はスクールみんなのものである(ゲストごとに作ると、
-- トレーナーが1人ずつ作って回ることになる)
drop policy if exists "棚は全員が読む" on public.shelf_words;
create policy "棚は全員が読む" on public.shelf_words
  for select to authenticated
  using (true);

-- **書けるのはトレーナーと管理者だけ。**
-- `is_trainer()` は `is_admin()` の別名ではなく、新しく書くコードで使う側
drop policy if exists "棚を作るのはトレーナー" on public.shelf_words;
create policy "棚を作るのはトレーナー" on public.shelf_words
  for all to authenticated
  using (public.is_trainer() or public.is_owner())
  with check (public.is_trainer() or public.is_owner());

grant select, insert, update, delete on public.shelf_words to authenticated;

-- ────────────────────────────────────────────────────────────────
-- 2. 棚の語を、まとめて自分の単語帳に入れる
--
--    **`add_basic_words()`(0053)とまったく同じ形。**
--    1語ずつ `mark_word()` を呼ばない —— 100 語なら 100 往復になるうえ、
--    あちらは**答えた記録**(`vocab_days`)まで増やす。
--    **まだ誰も答えていない。**
--
--    ちがうのは2つだけ。
--      ① 語の一覧を**渡させない。** 棚と場面から、この関数が引く ——
--         画面が一覧を作ると、**見えている語と入る語が食い違う**
--      ② `kind` / `seen_in` / `seen_in_ja` を**棚から写す。**
--         写さないと、自分の単語帳で穴埋め(箱3)が作れない
-- ────────────────────────────────────────────────────────────────
drop function if exists public.add_shelf_words(text, text[], uuid);

create or replace function public.add_shelf_words(
  p_industry text,
  p_scenes   text[] default null,   -- null か空なら、その棚ぜんぶ
  p_learner  uuid   default null
)
returns int
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_who   uuid;
  v_added int;
begin
  if auth.uid() is null then
    raise exception 'ログインしていません';
  end if;
  if p_industry is null or p_industry = '' then
    raise exception 'どの単語帳から入れるのかが要ります';
  end if;

  -- **誰の単語帳に入れてよいか。判断はこの関数の中だけ。画面に持たせない**
  v_who := coalesce(p_learner, auth.uid());
  if v_who <> auth.uid()
     and not public.teaches(v_who)
     and not public.is_owner() then
    raise exception '担当していないゲストの単語帳には入れられません';
  end if;

  with src as (
    select s.word_norm, s.kind, s.example_en, s.example_ja
      from public.shelf_words s
     where s.industry = p_industry
       -- **場面を渡さなければ、その棚ぜんぶ**(行き止まりを作らない)
       and (p_scenes is null
            or array_length(p_scenes, 1) is null
            or s.scene = any (p_scenes))
     limit 2000                    -- 際限なく入れない
  ), put as (
    insert into public.word_reviews as r
      (learner_id, word_norm, kind, status, box, due_on, updated_at,
       seen_in, seen_in_ja)
    select v_who, src.word_norm, src.kind, 'unknown', 0, current_date, now(),
           nullif(src.example_en, ''), nullif(src.example_ja, '')
      from src
    -- **すでにある語は、1つも触らない。** 箱も次に出す日もそのまま
    on conflict (learner_id, word_norm) do nothing
    returning 1
  )
  select count(*)::int into v_added from put;

  return coalesce(v_added, 0);
end;
$$;

comment on function public.add_shelf_words(text, text[], uuid) is
  '棚(業種べつの単語帳・0057)の語を、自分の単語帳に「まだ」として入れる。'
  '語の一覧は渡させない — 棚と場面からこの関数が引く'
  '(画面が作ると、見えている語と入る語が食い違う)。'
  'すでに入っている語には触らない(箱を戻さない)。'
  '答えた記録(vocab_days)は増やさない。まだ誰も答えていないため。'
  '出会う文(example_en / example_ja)も写すので、穴埋め(箱3)が効く。'
  '担当外のゲストには入れられない。新しく入った語数を返す。';

revoke all on function public.add_shelf_words(text, text[], uuid) from public;
grant execute on function public.add_shelf_words(text, text[], uuid) to authenticated;

-- ────────────────────────────────────────────────────────────────
-- 3. review_words() — **棚に書いてある訳を、控えが無いときに出す**
--
--    棚から入れた語は、**まだ誰も意味を引いていない**(0円で入れるため)。
--    そのままだと単語帳に「(意味の控えがありません)」が並び、
--    4択も作れない(まちがいの選択肢は意味から作る)。
--
--    **その意味は棚に書いてある。** 0047 が教材の `prompt_ja` を
--    出しているのと**まったく同じ考え方**である。**AI には尋ねない = 0円。**
--    `word_glosses` には書き込まない —— あそこに書けるのは
--    Edge Function だけ、という決まりは変えない。
--
--    **返す列は1つも変えていない**(0056 のまま)。それでも
--    `drop function if exists` を先に置く(CLAUDE.md)。
--
--    **どの棚から引くかは指定しない。** 同じ語が2つの棚にあることは
--    ありうるが、意味はほとんど同じである。**当てずっぽうで棚を選ぶより、
--    1つ出すほうが役に立つ**(教材の訳を優先し、棚はそのあと)。
-- ────────────────────────────────────────────────────────────────
drop function if exists public.review_words(uuid, text, int, boolean);

create or replace function public.review_words(
  p_learner  uuid,
  p_status   text    default 'unknown',
  p_limit    int     default 200,
  p_due_only boolean default false
)
returns table (
  word_norm      text,
  display        text,
  kind           text,
  pos            text,
  meaning_ja     text,
  seen_in        text,
  seen_in_ja     text,
  status         text,
  box            smallint,
  due_on         date,
  updated_at     timestamptz,
  added_at       timestamptz,
  material_id    uuid,
  material_title text,
  material_industry text,
  material_kind     text,
  material_genre    text,
  material_scene    text,
  material_level    text,
  learn_streak      smallint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not (
    p_learner = auth.uid()
    or public.teaches(p_learner)
    or public.is_owner()
  ) then
    raise exception '担当していないゲストの復習語は取得できません';
  end if;

  return query
    select r.word_norm,
           -- **見せ方も、控えが無ければ教材や棚のとおりに**(0047 / 0057)。
           -- `word_norm` は小文字にそろえた形なので、そのままだと
           -- 固有名詞まで小文字で並ぶ
           coalesce(g.display, nullif(mi.prompt_en, ''), nullif(sw.display, ''),
                    r.word_norm),
           r.kind,
           coalesce(nullif(g.pos, ''), nullif(sw.pos, ''), ''),
           -- **控えが無いときは、教材に書いてある訳を出す**(0047)。
           -- それも無ければ、棚に書いてある訳(0057)
           coalesce(nullif(g.meaning_ja, ''), nullif(mi.prompt_ja, ''),
                    nullif(sw.meaning_ja, ''), ''),
           r.seen_in,
           r.seen_in_ja,
           r.status,
           r.box,
           r.due_on,
           r.updated_at,
           r.added_at,
           r.material_id,
           m.title,
           m.industry,
           m.kind,
           m.genre,
           m.scene,
           m.level,
           r.learn_streak
    from public.word_reviews r
    left join lateral (
      select gg.display, gg.pos, gg.meaning_ja
      from public.word_glosses gg
      where gg.word_norm = r.word_norm
      order by (gg.context_key <> ''), gg.created_at
      limit 1
    ) g on true
    -- **教材が消えていても語は残す。** 絞り込みの手がかりが減るだけ
    left join public.materials m on m.id = r.material_id
    -- **その語が入った教材に、訳が書いてあれば使う**(0047)。
    -- 語句の演習(単語 / フレーズ / 本文に出てきた語句)だけを見る
    left join lateral (
      select ii.prompt_en, ii.prompt_ja
      from public.material_items ii
      join public.material_sections ss on ss.id = ii.section_id
      where ss.material_id = r.material_id
        and ss.exercise_type in ('vocabulary', 'phrase', 'vocab_note')
        and public.norm_word(ii.prompt_en) = r.word_norm
      limit 1
    ) mi on true
    -- **棚に書いてある訳**(0057)。**窓口を1回も呼ばない = 0円**
    left join lateral (
      select ww.display, ww.pos, ww.meaning_ja
      from public.shelf_words ww
      where ww.word_norm = r.word_norm
      order by ww.created_at
      limit 1
    ) sw on true
    where r.learner_id = p_learner
      and (p_status is null
           or (p_status = 'todo' and r.status in ('unknown', 'learning'))
           or r.status = p_status)
      and (not p_due_only or r.due_on <= current_date)
    order by (r.status = 'learning'), r.due_on, r.box, r.updated_at desc
    -- **上限は `wordbook_limit()` 1か所**(0056)。ここに数字を書かない
    limit greatest(1, least(coalesce(p_limit, 200), public.wordbook_limit()));
end;
$$;

comment on function public.review_words(uuid, text, int, boolean) is
  'ゲストの語を意味付きで返す。p_status に todo を渡すと「まだ + 覚えかけ」。'
  '絞り込みの手がかり(教材名・分野・種類・話題・場面・レベル)も返す(0048)。'
  '控えが無いときは、教材の訳(0047)→ 棚の訳(0057)の順に出す。'
  '上限は wordbook_limit()(0056)。担当外のゲストを指定すると例外で拒否する。';
