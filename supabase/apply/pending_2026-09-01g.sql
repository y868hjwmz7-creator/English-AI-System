-- ============================================================================
-- ★ Supabase の SQL Editor に、これを丸ごと貼って Run してください ★
--
--            これ1つで、残っているものが全部そろいます。
--
-- 【これは何か】
--   0027 から 0031 までの5つを、**正しい順番でまとめた**ものです。
--   中身は GitHub の supabase/migrations/ にある同じ名前のファイルと
--   まったく同じで、**新しいことは何もしていません。**
--
--   これまで1つずつお渡ししていましたが、順番を間違えるとうまく入らず、
--   どこまで貼ったかも分からなくなるため、1つにまとめました。
--   **すでに入っているものは飛ばされます。**
--
-- 【何が起きるか】
--   ① 0027 … 単語帳に「覚えかけ」が加わります
--             (いま「覚えかけ」を押すと断られるのは、これが理由です)
--   ② 0028 … 単語帳を、業界や場面でも絞り込めるようになります
--   ③ 0029 … 自分のアイコン(絵文字)を選べるようになります
--   ④ 0030 … 手で入れた語が、**その日のうちに**復習に出るようになります
--   ⑤ 0031 … ゲストごとに**ファイルを置ける**ようになります
--             (非公開。本人と、いま担当しているトレーナーだけが見られます)
--
-- 【どこまで影響するか】
--   ・**いま入っている語・教材・宿題・ゲストの情報は、1件も変わりません**
--   ・増えるのは、ファイルの表と置き場(どちらも空から始まります)と、
--     プロフィールの「アイコン」の欄だけです
--   ・単語帳の間隔の決まり(1 → 2 → 4 → 7 → 14 → 30 日)は変えていません
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
--  0027_learning_state
-- ════════════════════════════════════════════════════════════
-- ============================================================================
-- 0027 単語帳に「覚えかけ」を足す — 状態を3つにする
--
-- 【なぜ要るのか】(2026-08 利用者の指定)
--
--   > 覚えかけ、の定義をはっきりさせましょう。覚えかけというボタンを作るのが
--   > 良いと思います。今は覚えたとまだしかないからです。そうすると、まだを
--   > 優先して、覚え掛けを次に優先という出題アルゴリズムが組めますよね
--
--   これまで状態は **`known`(覚えた)と `unknown`(まだ)の2つ**しか
--   なかった。それなのに画面には「覚えかけ」という数を出しており、
--   中身は `unknown` の数そのものだった。**言葉と中身が食い違っていた。**
--
--   3つに分ければ、出す順番を「まだ → 覚えかけ」と決められる。
--
--     unknown  … まだ      … 意味が出てこない
--     learning … 覚えかけ  … 出てくるが、自信がない
--     known    … 覚えた    … すぐ出てくる
--
-- 【間隔の決め方】(**この関数だけが持つ。画面には持たせない**)
--
--   | 押したもの | 箱 | 次に出す |
--   |---|---|---|
--   | まだ     | 0 に戻す        | 翌日 |
--   | 覚えかけ | +1(**上限 3**) | 1 / 2 / 4 日 |
--   | 覚えた   | +1(上限 6)     | 1 / 2 / 4 / 7 / 14 / 30 日 |
--
--   **覚えかけの箱に上限を置く**のが要である。上限が無いと、
--   自信が無いまま押しつづけたものが30日先へ飛んでしまう。
--   3 で止めれば、**必ず4日以内に戻ってくる。**
--
-- 【何が変わるか】
--   ① `word_reviews.status` が 'learning' も取れるようになる
--   ② `mark_word()` が 'learning' を受け取る
--   ③ `review_words()` の `p_status` に **'todo'**(= まだ + 覚えかけ)を足す。
--      復習は、この2つを**まだ → 覚えかけ**の順で出す
--
-- 【どこまで影響するか】
--   ・**いま入っている語は1件も変わりません。** 状態も箱も日付もそのまま
--   ・教材・宿題・取り組みには**いっさい触れません**
--   ・広げる方向の変更なので、いまの行が新しい決まりに反することはない
--
-- 【何度貼っても安全】
--   `drop constraint if exists` → `add constraint`、`create or replace`。
--   `review_words()` は**返す列が変わらない**ので drop は要らない。
-- ============================================================================

-- ────────────────────────────────────────────────────────────────
-- 1. 状態を3つにする
-- ────────────────────────────────────────────────────────────────
alter table public.word_reviews
  drop constraint if exists word_reviews_status_check;

alter table public.word_reviews
  add constraint word_reviews_status_check
  check (status in ('known', 'learning', 'unknown'));

comment on table public.word_reviews is
  'ゲストごとの語の状態。unknown(まだ)/ learning(覚えかけ)/ known(覚えた)。'
  '復習は unknown を先に、learning を次に出す(0027)。';

-- ────────────────────────────────────────────────────────────────
-- 2. mark_word() が「覚えかけ」を受け取れるようにする
--
--   **引数も返す列も変えていない**ので、drop は要らない。
--   0025 の本文に「覚えかけ」の枝を足しただけである。
-- ────────────────────────────────────────────────────────────────
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
  v_days     int;
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
  -- **0027 で learning(覚えかけ)を足した**
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

  select r.box into v_box
    from public.word_reviews r
   where r.learner_id = v_who and r.word_norm = v_norm;
  v_box := coalesce(v_box, 0);

  if p_status = 'unknown' then
    -- 分からなかったものは、いちばん下の箱に戻して翌日また出す
    v_box := 0;
    v_days := 1;
  elsif p_status = 'learning' then
    -- **覚えかけは、箱を 3 で止める**(0027)。
    -- 上限が無いと、自信が無いまま押しつづけたものが30日先へ飛ぶ。
    -- 3 で止めれば必ず4日以内に戻ってくる
    v_box := least(v_box + 1, 3);
    v_days := case v_box when 1 then 1 when 2 then 2 else 4 end;
  else
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

  -- 続けた記録(0019)。**「覚えた」だけを正解として数える。**
  -- 覚えかけは、思い出せたが自信が無い状態なので、正解には数えない
  insert into public.vocab_days as d (learner_id, done_on, answered, correct)
  values (v_who, current_date, 1, case when p_status = 'known' then 1 else 0 end)
  on conflict (learner_id, done_on) do update
    set answered = d.answered + 1,
        correct  = d.correct + case when p_status = 'known' then 1 else 0 end;

  return query
  insert into public.word_reviews as w
    (learner_id, word_norm, kind, status, box, due_on, material_id,
     seen_in, seen_in_ja, updated_at)
  values
    (v_who, v_norm, coalesce(p_kind, 'word'), p_status,
     v_box, current_date + v_days, p_material, v_sentence, v_ja, now())
  on conflict (learner_id, word_norm) do update
    set status      = excluded.status,
        kind        = excluded.kind,
        box         = excluded.box,
        due_on      = excluded.due_on,
        material_id = coalesce(w.material_id, excluded.material_id),
        seen_in     = coalesce(w.seen_in, excluded.seen_in),
        seen_in_ja  = coalesce(w.seen_in_ja, excluded.seen_in_ja),
        updated_at  = now()
  returning w.word_norm, w.status, w.box, w.due_on;
end;
$$;

comment on function public.mark_word(text, text, text, uuid, text, text, uuid) is
  '語や句に「覚えた / 覚えかけ / まだ」を付け、次に出す日を決める(0027)。'
  '覚えかけは箱を 3 で止めるので、必ず4日以内に戻ってくる。'
  'p_learner を渡すと、担当しているゲストの記録として残す(0025)。'
  '間隔の決まりはこの関数だけが持つ。';

-- ────────────────────────────────────────────────────────────────
-- 3. review_words() に 'todo'(まだ + 覚えかけ)を足す
--
--   並びも変える。**まだ → 覚えかけ**の順に出す(利用者の指定)。
--
--   **先に drop を置く**(2026-09)。書いた時点では「返す列は変えていない」
--   ので要らなかったが、**あとから 0028 が返す列を増やした。**
--   そのため、0028 が入っている DB にこのファイルだけを貼り直すと
--   `cannot change return type of existing function` で止まる。
--   実際、0027〜0031 をまとめて貼るときに起きた。
--
--   **関数を作り直すファイルは、あとで誰かが列を足すかもしれない。**
--   だから、返す列を変えていなくても drop を置いておく。
--   すぐ下で作り直すので、消えたままにはならない。
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
  material_title text
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
           coalesce(g.display, r.word_norm),
           r.kind,
           coalesce(g.pos, ''),
           coalesce(g.meaning_ja, ''),
           r.seen_in,
           r.seen_in_ja,
           r.status,
           r.box,
           r.due_on,
           r.updated_at,
           r.added_at,
           r.material_id,
           m.title
    from public.word_reviews r
    left join lateral (
      select gg.display, gg.pos, gg.meaning_ja
      from public.word_glosses gg
      where gg.word_norm = r.word_norm
      order by (gg.context_key <> ''), gg.created_at
      limit 1
    ) g on true
    left join public.materials m on m.id = r.material_id
    where r.learner_id = p_learner
      -- **'todo' は「まだ + 覚えかけ」**(0027)。復習で使う
      and (p_status is null
           or (p_status = 'todo' and r.status in ('unknown', 'learning'))
           or r.status = p_status)
      and (not p_due_only or r.due_on <= current_date)
    -- **まだ を先に、覚えかけ を次に**(2026-08 利用者の指定)。
    -- そのあとは、出すべき日が早いもの・箱の低いもの(苦手なもの)から
    order by (r.status = 'learning'), r.due_on, r.box, r.updated_at desc
    limit greatest(1, least(coalesce(p_limit, 40), 200));
end;
$$;

comment on function public.review_words(uuid, text, int, boolean) is
  'ゲストの語を意味付きで返す。p_status に todo を渡すと「まだ + 覚えかけ」。'
  '並びは まだ → 覚えかけ の順(0027)。p_due_only で「今日出すもの」に絞る。'
  '出会った文・単語帳に入った日・出会った教材も返す。担当外は拒否する。';

-- ════════════════════════════════════════════════════════════
--  0028_wordbook_facets
-- ════════════════════════════════════════════════════════════
-- ============================================================================
-- 0028 単語帳を「分野」「場面・話題」でも絞れるようにする
--
-- 【なぜ要るのか】(2026-08 利用者の指定)
--
--   > あとは業界、趣味別、シチュエーション、話題から上手く絞り込める
--   > コンパクトなUIを作成してください。
--
--   単語帳は増えていく。いまは**入った日**と**教材名**でしか絞れない。
--   「医療の語だけ」「交渉の場面で出た語だけ」で引けると、
--   レッスンの前に**その日の話題に合わせて**復習できる。
--
--   絞るための手がかりは**すでに教材が持っている**
--   (`materials.industry` / `kind` / `genre` / `scene`)。
--   語は `word_reviews.material_id` で教材につながっているので、
--   **表も列も増やさない。** 返す列を増やすだけでよい。
--
-- 【何をするか】
--   `review_words()` が、出会った教材の
--   **分野・種類・話題・場面**も返すようにする。
--
-- 【どこまで影響するか】
--   ・**いま入っている語は1件も変わりません。** 読み取るだけ
--   ・教材・宿題・取り組みには**いっさい触れません**
--   ・教材が消されていた語は、これまでどおり空で返る(`left join`)
--
-- 【何度貼っても安全】
--   **返す列が増えるので、先に drop する**(CLAUDE.md)。
--   置き換えようとすると `cannot change return type of existing function`
--   で止まる(0015 と 0002 で実際に踏んでいる)。
-- ============================================================================

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
  -- ここから 0028。**絞り込みの手がかり**
  material_industry text,
  material_kind     text,
  material_genre    text,
  material_scene    text
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
           coalesce(g.display, r.word_norm),
           r.kind,
           coalesce(g.pos, ''),
           coalesce(g.meaning_ja, ''),
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
           m.scene
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
    where r.learner_id = p_learner
      -- **'todo' は「まだ + 覚えかけ」**(0027)。復習で使う
      and (p_status is null
           or (p_status = 'todo' and r.status in ('unknown', 'learning'))
           or r.status = p_status)
      and (not p_due_only or r.due_on <= current_date)
    -- **まだ を先に、覚えかけ を次に**(0027)
    order by (r.status = 'learning'), r.due_on, r.box, r.updated_at desc
    limit greatest(1, least(coalesce(p_limit, 40), 200));
end;
$$;

comment on function public.review_words(uuid, text, int, boolean) is
  'ゲストの語を意味付きで返す。p_status に todo を渡すと「まだ + 覚えかけ」。'
  '並びは まだ → 覚えかけ の順(0027)。p_due_only で「今日出すもの」に絞る。'
  '出会った教材の分野・種類・話題・場面も返す(0028)。単語帳の絞り込みに使う。'
  '担当外は拒否する。';

-- **drop したので、権限を付け直す。** 忘れると画面から呼べなくなる
grant execute on function public.review_words(uuid, text, int, boolean) to authenticated;

-- ════════════════════════════════════════════════════════════
--  0029_avatar
-- ════════════════════════════════════════════════════════════
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

-- ════════════════════════════════════════════════════════════
--  0030_due_today
-- ════════════════════════════════════════════════════════════
-- 0030 単語帳に入れたばかりの語を、その日の復習に出す
--
-- 【なぜ要るか】(2026-09 実機)
--
--   > 単語を手打ちで登録しても反映されません
--
--   `mark_word()` は「次に出すまでの間隔」を決める関数で、
--   「まだ」は翌日(`current_date + 1`)としていた。
--   間隔の決まりとしては正しいのだが、**初めて入る語まで翌日**になるため、
--   入れたその日は復習に1回も出てこない。
--   画面には「入れた語は『まだ』から始まります。復習に出てくるので…」と
--   書いてあるので、**言っていることと動きが食い違っていた。**
--
-- 【何が変わるか】
--   ・**初めて単語帳に入る語だけ**、その日から復習に出る
--   ・2回目以降の間隔は**まったく変えていない**(1 → 2 → 4 → 7 → 14 → 30 日)
--   ・すでに入っている語には触れない。**行は1つも書き換わらない**
--
-- 【どこまで影響するか】
--   `mark_word()` という関数を1つ置き換えるだけ。
--   表も列も増えず、いま入っているデータは1件も変わらない。
--
-- 【何度貼っても安全】
--   `create or replace` なので、同じものを何度貼っても同じ結果になる。

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
  v_days     int;
  v_sentence text;
  v_ja       text;
  v_new      boolean;
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
  -- **0027 で learning(覚えかけ)を足した**
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

  select r.box into v_box
    from public.word_reviews r
   where r.learner_id = v_who and r.word_norm = v_norm;
  -- **その語が単語帳に入るのは、これが初めてか。**
  -- `found` は直前の select が行を見つけたかどうかである
  v_new := not found;
  v_box := coalesce(v_box, 0);

  if p_status = 'unknown' then
    -- 分からなかったものは、いちばん下の箱に戻して翌日また出す
    v_box := 0;
    v_days := 1;
  elsif p_status = 'learning' then
    -- **覚えかけは、箱を 3 で止める**(0027)。
    -- 上限が無いと、自信が無いまま押しつづけたものが30日先へ飛ぶ。
    -- 3 で止めれば必ず4日以内に戻ってくる
    v_box := least(v_box + 1, 3);
    v_days := case v_box when 1 then 1 when 2 then 2 else 4 end;
  else
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

  -- ★★ 0030 ここだけが 0027 との違い ★★
  --
  -- **単語帳に入ったばかりの語は、その日の復習に出す。**
  --
  -- これまでは、初めて入る語も「翌日」からだった(`v_days` は
  -- 「もう一度出すまでの間隔」なので、間隔の決まりとしては正しい)。
  -- けれども**入れたその日に1回も出てこない**ので、
  -- 手で入れた人には「登録しても反映されない」ように見える
  -- (2026-09 実機)。宿題で「まだ」と付けた語も同じで、
  -- その日のうちに復習できなかった。
  --
  -- **間隔の決まりそのものは変えていない。** 2回目以降は
  -- これまでどおり 1 → 2 → 4 → 7 → 14 → 30 日である。
  if v_new then
    v_days := 0;
  end if;

  -- 続けた記録(0019)。**「覚えた」だけを正解として数える。**
  -- 覚えかけは、思い出せたが自信が無い状態なので、正解には数えない
  insert into public.vocab_days as d (learner_id, done_on, answered, correct)
  values (v_who, current_date, 1, case when p_status = 'known' then 1 else 0 end)
  on conflict (learner_id, done_on) do update
    set answered = d.answered + 1,
        correct  = d.correct + case when p_status = 'known' then 1 else 0 end;

  return query
  insert into public.word_reviews as w
    (learner_id, word_norm, kind, status, box, due_on, material_id,
     seen_in, seen_in_ja, updated_at)
  values
    (v_who, v_norm, coalesce(p_kind, 'word'), p_status,
     v_box, current_date + v_days, p_material, v_sentence, v_ja, now())
  on conflict (learner_id, word_norm) do update
    set status      = excluded.status,
        kind        = excluded.kind,
        box         = excluded.box,
        due_on      = excluded.due_on,
        material_id = coalesce(w.material_id, excluded.material_id),
        seen_in     = coalesce(w.seen_in, excluded.seen_in),
        seen_in_ja  = coalesce(w.seen_in_ja, excluded.seen_in_ja),
        updated_at  = now()
  returning w.word_norm, w.status, w.box, w.due_on;
end;
$$;


comment on function public.mark_word(text, text, text, uuid, text, text, uuid) is
  '語や句に「覚えた / 覚えかけ / まだ」を付け、次に出す日を決める(0030)。'
  '**初めて入る語は、その日から復習に出る。**'
  '2回目からは 1 → 2 → 4 → 7 → 14 → 30 日(覚えかけは箱 3 で止める)。'
  'p_learner を渡すと、担当しているゲストの記録として残す(0025)。'
  '間隔の決まりはこの関数だけが持つ。';

-- ════════════════════════════════════════════════════════════
--  0031_learner_files
-- ════════════════════════════════════════════════════════════
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
