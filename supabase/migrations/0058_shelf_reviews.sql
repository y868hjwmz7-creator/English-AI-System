-- ============================================================================
-- 0058 業種べつの単語帳を、**独立した単語帳**にする
--
-- 【なぜ要るか】(2026-09 利用者の指定)
--
--   > 最終的にこうやって混ぜたくないんですよ。これは独立した単語帳に
--   > したいんです。…チェックを入れた分野だけ単語が学べるようにしたいです
--
--   0057 では、棚(`shelf_words`)に並んだ語を
--   **「自分の単語帳に追加する」で `word_reviews` に入れて**から練習した。
--   ところが入れた瞬間に、教材で出会った語と**同じ1冊に混ざる。**
--   利用者が見たのは、まさにその混ざったあとの単語帳だった。
--
--   **だから、混ぜるのをやめる。**
--   棚はそれだけで練習でき、覚え具合も**棚の側**に残る。
--
-- 【入れ物】
--
--   | 何 | どこ | 誰のものか |
--   |---|---|---|
--   | 棚に並ぶ語 | `shelf_words`(0057) | **スクール全体で1組** |
--   | その語の覚え具合 | **`shelf_reviews`(この移行)** | ゲスト1人ずつ |
--
--   **「追加する」という段そのものが無くなる。**
--   棚を開けばすぐ練習でき、答えた語だけ `shelf_reviews` に行ができる
--   (まだ答えていない語は「まだ・箱0・今日出す」として扱う)。
--   だから 2000 語をまとめて入れる仕組みも、その上限も要らない。
--
-- 【`word_reviews` に列を足さない】
--
--   あの表の鍵は **(learner_id, word_norm)** である。冊を足すには
--   **鍵そのものを変える**ことになり、いちばん大事な表を、
--   すでに本物の記録が入っている状態で作り直すことになる。
--   しかも「同じ語が2冊にある」を許さない鍵なので、
--   `budget` のような語が**棚から黙って消える**。
--
--   **別の表なら、鍵を1文字も触らずに済む。**
--   Quick Response の復習(0040)を `word_reviews` に混ぜなかったのと
--   まったく同じ考え方である。
--
-- 【間隔の決まりは、**1か所にまとめる**】
--
--   箱・次に出す日・卒業までの回数は、これまで `mark_word()` の中に
--   だけあった。棚にも同じ決まりが要るので、**`review_next()` に切り出し、
--   `mark_word()` もそれを呼ぶ形に作り直す。**
--   数字は1つも変えていない(`vocab_test.sql` が日数を見張っている)。
--
-- 【何が起きるか】
--   ・表が1つ増えます(`shelf_reviews`)。**空から始まります**
--   ・SQL の関数が2つ増え(`review_next` / `mark_shelf_word`)、
--     2つ作り直されます(`mark_word` / `erase_learner`)
--   ・**混ぜるための関数が1つ消えます**(`add_shelf_words`)
--   ・いま単語帳に入っている語の状態・箱・次に出す日は、**1件も変わりません**
--
-- 【どこまで影響するか】
--   教材・宿題・ゲストの情報・取り組みの記録には触れません。
--   **すでに「自分の単語帳に追加する」で入れた語も、そのまま残ります**
--   (混ざったままなのが気になるときは、単語帳から1語ずつ消します)。
--
-- 【何度貼っても安全】
--   `create table if not exists` と、drop してからの作り直しだけです。
--
-- 【成功の目安】
--   `Success. No rows returned` と出れば成功です。
-- ============================================================================

-- ────────────────────────────────────────────────────────────────
-- 1. 間隔の決まりを、1か所に切り出す
--
--    **中身は `mark_word()`(0038)からそのまま移したもの。**
--    数字も枝も1つも変えていない。変えたのは「どこに書いてあるか」だけ。
--
--    こうしておかないと、棚の側にもう1つ同じ決まりを書くことになり、
--    **片方だけ直したときに、冊によって間隔が違う**という、
--    誰にも気づけない食い違いが生まれる。
-- ────────────────────────────────────────────────────────────────
drop function if exists public.review_next(smallint, smallint, text, boolean);

create or replace function public.review_next(
  p_box    smallint,
  p_streak smallint,
  p_status text,
  -- **その語が単語帳に入るのは、これが初めてか**(0030)
  p_new    boolean default false
)
returns table (box smallint, days int, streak smallint)
language plpgsql
immutable
as $$
declare
  -- **卒業までの回数。ここ1か所だけが持つ**(0038)。
  -- 利用者の指定「20-30回くらい」の真ん中
  c_graduate constant int := 25;
  -- 卒業した語を、どれくらい休ませるか(日)
  c_rest     constant int := 30;
  v_box      smallint := coalesce(p_box, 0::smallint);
  v_streak   int      := coalesce(p_streak, 0);
  v_days     int;
begin
  if p_status = 'unknown' then
    -- 分からなかったものは、いちばん下の箱に戻して翌日また出す。
    -- **数えも 0 に戻す。**「続けて」思い出せた回数だからである
    v_box := 0;
    v_days := 1;
    v_streak := 0;
  elsif p_status = 'learning' then
    v_streak := v_streak + 1;
    if v_streak >= c_graduate then
      -- **卒業。しばらく出てこない**(0038・利用者の指定)
      v_box := 6;
      v_days := c_rest;
    else
      -- **覚えかけは、箱を 3 で止める**(0027)。
      -- 上限が無いと、自信が無いまま押しつづけたものが30日先へ飛ぶ
      v_box := least(v_box + 1, 3);
      v_days := case v_box when 1 then 1 when 2 then 2 else 4 end;
    end if;
  else
    -- 「覚えた」。数えは触らない(復習で答えた回数ではないため)
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

  -- **単語帳に入ったばかりの語は、その日の復習に出す**(0030)
  if p_new then
    v_days := 0;
  end if;

  box := v_box;
  days := v_days;
  streak := v_streak::smallint;
  return next;
end;
$$;

comment on function public.review_next(smallint, smallint, text, boolean) is
  '間隔をあけた復習の決まり(0015〜0038)を1か所にまとめたもの。'
  '箱・次に出すまでの日数・続けて思い出せた回数を返す。'
  'mark_word() と mark_shelf_word() の両方がここを呼ぶ —— '
  '2か所に書くと、冊によって間隔が違うという食い違いが生まれる。';

-- ────────────────────────────────────────────────────────────────
-- 2. 棚の覚え具合
--
--    **ゲスト × 棚 × 語で1行。** 答えた語にだけ行ができる。
--    まだ答えていない語は行が無く、画面では「まだ・箱0・今日出す」になる
--    (だから 2000 語をまとめて入れる仕組みが要らない)。
--
--    **`shelf_words` を参照する。** 棚から語を消したら、
--    その覚え具合も一緒に消える(取り残さない)。
-- ────────────────────────────────────────────────────────────────
create table if not exists public.shelf_reviews (
  learner_id   uuid        not null references auth.users(id) on delete cascade,
  industry     text        not null,
  word_norm    text        not null,
  status       text        not null default 'unknown',
  box          smallint    not null default 0,
  due_on       date        not null default current_date,
  learn_streak smallint    not null default 0,
  added_at     timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (learner_id, industry, word_norm),
  foreign key (industry, word_norm)
    references public.shelf_words(industry, word_norm) on delete cascade
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'shelf_reviews_status_check'
  ) then
    alter table public.shelf_reviews
      add constraint shelf_reviews_status_check
      check (status in ('unknown', 'learning', 'known'));
  end if;
end $$;

comment on table public.shelf_reviews is
  '業種べつの単語帳(棚)の覚え具合(0058)。ゲスト × 棚 × 語で1行。'
  '自分の単語帳(word_reviews)とは混ざらない —— 利用者の指定'
  '「これは独立した単語帳にしたいんです」。'
  '答えた語にだけ行ができる(行が無い語は まだ・箱0・今日出す)。'
  '書けるのは mark_shelf_word() だけ(表そのものに書き込みは開けない)。';

create index if not exists shelf_reviews_due_idx
  on public.shelf_reviews (learner_id, industry, due_on);

alter table public.shelf_reviews enable row level security;

-- **読めるのは本人・担当トレーナー・管理者。**
-- 判定は 0001 の `teaches()` をそのまま使う(新しい判定を作らない)
drop policy if exists "棚の覚え具合を読む" on public.shelf_reviews;
create policy "棚の覚え具合を読む" on public.shelf_reviews
  for select to authenticated
  using (
    learner_id = auth.uid()
    or public.teaches(learner_id)
    or public.is_owner()
  );

-- **書き込みのポリシーは作らない。**
-- 窓口を1つに絞る(`mark_shelf_word`)ほうが、表そのものを開けるより
-- 穴が小さい —— `mark_word()` と同じ作法である
grant select on public.shelf_reviews to authenticated;

-- ────────────────────────────────────────────────────────────────
-- 3. 棚の語に「まだ / 覚えかけ / 覚えた」を付ける
--
--    **`mark_word()` と同じ形。** ちがうのは
--      ① どの棚の語かを渡す(同じ語が2つの棚にあってもよい)
--      ② 教材・出会った文を持たない(棚の側に書いてある)
--    の2つだけである。
--
--    **続けた記録(`vocab_days`)は、これまでどおり増やす。**
--    棚は別の冊だが、**取り組んだのは同じ人**である。
--    週の目標(0042)も、ここを見ている。
-- ────────────────────────────────────────────────────────────────
drop function if exists public.mark_shelf_word(text, text, text, uuid);

create or replace function public.mark_shelf_word(
  p_industry text,
  p_norm     text,
  p_status   text,
  p_learner  uuid default null
)
returns table (word_norm text, status text, box smallint, due_on date)
language plpgsql
volatile
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_who    uuid;
  v_norm   text;
  v_box    smallint;
  v_streak int;
  v_days   int;
  v_new    boolean;
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

  if p_industry is null or p_industry = '' then
    raise exception 'どの単語帳の語なのかが要ります';
  end if;
  v_norm := public.norm_word(p_norm);
  if v_norm is null then
    raise exception '語が空です';
  end if;
  if p_status is null or p_status not in ('known', 'learning', 'unknown') then
    raise exception '状態は known / learning / unknown です';
  end if;

  -- **棚に無い語は受け取らない。** 外部キーでも弾かれるが、
  -- そこで出る断りは利用者に意味が通らない
  if not exists (
    select 1 from public.shelf_words s
     where s.industry = p_industry and s.word_norm = v_norm
  ) then
    raise exception 'その語は、この単語帳にありません';
  end if;

  select r.box, r.learn_streak into v_box, v_streak
    from public.shelf_reviews r
   where r.learner_id = v_who
     and r.industry = p_industry
     and r.word_norm = v_norm;
  v_new := not found;

  -- **間隔の決まりは `review_next()` 1か所**(自分の単語帳と同じもの)
  select n.box, n.days, n.streak
    into v_box, v_days, v_streak
    from public.review_next(coalesce(v_box, 0::smallint),
                            coalesce(v_streak, 0)::smallint,
                            p_status, v_new) n;

  -- 続けた記録(0019)。**取り組んだのは同じ人**なので、冊で分けない
  insert into public.vocab_days as d (learner_id, done_on, answered, correct)
  values (v_who, current_date, 1, case when p_status = 'unknown' then 0 else 1 end)
  on conflict (learner_id, done_on) do update
    set answered = d.answered + 1,
        correct  = d.correct + case when p_status = 'unknown' then 0 else 1 end;

  return query
  insert into public.shelf_reviews as w
    (learner_id, industry, word_norm, status, box, due_on, learn_streak, updated_at)
  values
    (v_who, p_industry, v_norm, p_status, v_box, current_date + v_days,
     v_streak, now())
  on conflict (learner_id, industry, word_norm) do update
    set status       = excluded.status,
        box          = excluded.box,
        due_on       = excluded.due_on,
        learn_streak = excluded.learn_streak,
        updated_at   = now()
  returning w.word_norm, w.status, w.box, w.due_on;
end;
$$;

comment on function public.mark_shelf_word(text, text, text, uuid) is
  '業種べつの単語帳(棚)の語に「まだ / 覚えかけ / 覚えた」を付ける(0058)。'
  '自分の単語帳(word_reviews)には1行も書かない —— 混ざらないため。'
  '間隔の決まりは review_next()(mark_word と同じもの)。'
  '続けた記録(vocab_days)は増やす。取り組んだのは同じ人だからである。'
  '担当外のゲストには書けない。';

revoke all on function public.mark_shelf_word(text, text, text, uuid) from public;
grant execute on function public.mark_shelf_word(text, text, text, uuid) to authenticated;

-- ────────────────────────────────────────────────────────────────
-- 4. `mark_word()` を、`review_next()` を呼ぶ形に作り直す
--
--    **振る舞いは1つも変えていない。** 箱の上げ方も、卒業の回数も、
--    休ませる日数も、初めての日に出すことも、そのままである。
--    移したのは「決まりがどこに書いてあるか」だけ。
--
--    返す列も変えていないが、**`drop function if exists` を先に置く**
--    (CLAUDE.md「関数を作り直すファイルは、返す列を変えていなくても
--    drop を置く。あとで誰かが列を足すかもしれない」)。
-- ────────────────────────────────────────────────────────────────
drop function if exists public.mark_word(text, text, text, uuid, text, text, uuid);

create or replace function public.mark_word(
  p_norm        text,
  p_status      text,
  p_kind        text default 'word',
  p_material    uuid default null,
  p_sentence    text default null,
  p_sentence_ja text default null,
  p_learner     uuid default null
)
returns table (word_norm text, status text, box smallint, due_on date)
language plpgsql
volatile
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_who      uuid;
  v_norm     text;
  v_box      smallint;
  v_streak   int;
  v_days     int;
  -- その語が単語帳に入るのは、これが初めてか(0030)
  v_new      boolean;
  v_sentence text;
  v_ja       text;
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

  v_norm := public.norm_word(p_norm);
  if v_norm is null then
    raise exception '語が空です';
  end if;
  if p_status is null or p_status not in ('known', 'learning', 'unknown') then
    raise exception '状態は known / learning / unknown です';
  end if;

  v_sentence := nullif(btrim(regexp_replace(coalesce(p_sentence, ''), '\s+', ' ', 'g')), '');
  if v_sentence is not null then
    v_sentence := left(v_sentence, 300);
  end if;
  v_ja := nullif(btrim(regexp_replace(coalesce(p_sentence_ja, ''), '\s+', ' ', 'g')), '');
  if v_ja is not null then
    v_ja := left(v_ja, 300);
  end if;

  select r.box, r.learn_streak into v_box, v_streak
    from public.word_reviews r
   where r.learner_id = v_who and r.word_norm = v_norm;
  -- `found` は直前の select が行を見つけたかどうかである
  v_new := not found;

  -- **間隔の決まりは `review_next()` 1か所**(0058)。棚と同じものを通る
  select n.box, n.days, n.streak
    into v_box, v_days, v_streak
    from public.review_next(coalesce(v_box, 0::smallint),
                            coalesce(v_streak, 0)::smallint,
                            p_status, v_new) n;

  -- 続けた記録(0019)。**「思い出せたか」で数える**(0038)
  insert into public.vocab_days as d (learner_id, done_on, answered, correct)
  values (v_who, current_date, 1, case when p_status = 'unknown' then 0 else 1 end)
  on conflict (learner_id, done_on) do update
    set answered = d.answered + 1,
        correct  = d.correct + case when p_status = 'unknown' then 0 else 1 end;

  return query
  insert into public.word_reviews as w
    (learner_id, word_norm, kind, status, box, due_on, material_id,
     seen_in, seen_in_ja, learn_streak, updated_at)
  values
    (v_who, v_norm, coalesce(p_kind, 'word'), p_status,
     v_box, current_date + v_days, p_material, v_sentence, v_ja,
     v_streak, now())
  on conflict (learner_id, word_norm) do update
    set status       = excluded.status,
        kind         = excluded.kind,
        box          = excluded.box,
        due_on       = excluded.due_on,
        learn_streak = excluded.learn_streak,
        material_id  = coalesce(w.material_id, excluded.material_id),
        seen_in      = coalesce(w.seen_in, excluded.seen_in),
        seen_in_ja   = coalesce(w.seen_in_ja, excluded.seen_in_ja),
        updated_at   = now()
  returning w.word_norm, w.status, w.box, w.due_on;
end;
$$;

comment on function public.mark_word(text, text, text, uuid, text, text, uuid) is
  '語に「まだ / 覚えかけ / 覚えた」を付け、次に出す日を決める。'
  '間隔の決まりは review_next()(0058)。棚(mark_shelf_word)と同じものを通る。'
  '担当していないゲストの記録には書けない。';

revoke all on function public.mark_word(text, text, text, uuid, text, text, uuid) from public;
grant execute on function public.mark_word(text, text, text, uuid, text, text, uuid) to authenticated;

-- ────────────────────────────────────────────────────────────────
-- 5. **混ぜる道を、道具ごと消す**
--
--    `add_shelf_words()`(0057)は、棚の語を `word_reviews` に
--    まとめて入れるための関数だった。**利用者が要らないと決めた道**である。
--
--    > 最終的にこうやって混ぜたくないんですよ。
--
--    **値を偽にして残さない**(CLAUDE.md)。残すと、次に見た人が
--    「まだ使うのかもしれない」と読む。
--
--    **すでに入れてしまった語は、この移行では消さない。**
--    どれが棚から来た語なのかを、`word_reviews` は持っていない
--    (教材から来た語と見分けられない)。**当てずっぽうで消さない。**
--    気になるものは、単語帳から1語ずつ消す。
-- ────────────────────────────────────────────────────────────────
drop function if exists public.add_shelf_words(text, text[], uuid);

-- ────────────────────────────────────────────────────────────────
-- 6. ゲストをまとめて消すときに、棚の覚え具合も消す
--
--    **表を足したら、消す側にも足す**(CLAUDE.md)。
--    中身は 0055 のものと**1か所しか違わない**(`shelf_reviews` の行)。
--
--    **棚そのもの(`shelf_words`)には触らない。**
--    あちらはスクールの共有物で、そのゲストの記録ではない(教材と同じ)。
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

  -- ② 相手がゲストであることを確かめる
  select role into v_role from public.profiles where id = p_learner;
  if v_role is null then
    raise exception 'そのゲストは見つかりません';
  end if;
  if v_role <> 'learner' then
    raise exception 'ゲスト以外は消せません(いまの役割: %)', v_role;
  end if;

  -- ③ 置いてあるファイルの中身。**表より先に消す**
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
  v_out := v_out || jsonb_build_object('Quick Response の日ごと', v_n);

  delete from public.weekly_goals where learner_id = p_learner;
  get diagnostics v_n = row_count;
  v_out := v_out || jsonb_build_object('週の目標', v_n);

  delete from public.course_days where learner_id = p_learner;
  get diagnostics v_n = row_count;
  v_out := v_out || jsonb_build_object('30日講座の進み', v_n);

  delete from public.speeches where learner_id = p_learner;
  get diagnostics v_n = row_count;
  v_out := v_out || jsonb_build_object('スピーチの原稿', v_n);

  delete from public.learner_features where learner_id = p_learner;
  get diagnostics v_n = row_count;
  v_out := v_out || jsonb_build_object('出すものの指定', v_n);

  -- **業種べつの単語帳の覚え具合**(0058)。
  -- 棚そのもの(shelf_words)はスクールの共有物なので触らない
  delete from public.shelf_reviews where learner_id = p_learner;
  get diagnostics v_n = row_count;
  v_out := v_out || jsonb_build_object('業種べつの単語帳', v_n);

  delete from public.word_reviews where learner_id = p_learner;
  get diagnostics v_n = row_count;
  v_out := v_out || jsonb_build_object('単語帳', v_n);

  delete from public.vocab_days where learner_id = p_learner;
  get diagnostics v_n = row_count;
  v_out := v_out || jsonb_build_object('単語の日ごと', v_n);

  delete from public.practice_days where learner_id = p_learner;
  get diagnostics v_n = row_count;
  v_out := v_out || jsonb_build_object('取り組みの日ごと', v_n);

  delete from public.material_progress where learner_id = p_learner;
  get diagnostics v_n = row_count;
  v_out := v_out || jsonb_build_object('書きかけ・区切り', v_n);

  delete from public.attempts where user_id = p_learner;
  get diagnostics v_n = row_count;
  v_out := v_out || jsonb_build_object('発音の記録', v_n);

  delete from public.study_logs where user_id = p_learner;
  get diagnostics v_n = row_count;
  v_out := v_out || jsonb_build_object('学習の記録(旧)', v_n);

  -- ⑤ トレーナーが書いたもの
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

  -- ⑥ 配ったもの・担当
  delete from public.assignments where learner_id = p_learner;
  get diagnostics v_n = row_count;
  v_out := v_out || jsonb_build_object('宿題', v_n);

  delete from public.learner_admins where learner_id = p_learner;
  get diagnostics v_n = row_count;
  v_out := v_out || jsonb_build_object('担当', v_n);

  -- ⑦ 最後にゲストの欄
  delete from public.profiles where id = p_learner;
  get diagnostics v_n = row_count;
  v_out := v_out || jsonb_build_object('ゲストの欄', v_n);

  return v_out;
end;
$$;

revoke all on function public.erase_learner(uuid) from public;
grant execute on function public.erase_learner(uuid) to authenticated;
