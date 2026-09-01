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
