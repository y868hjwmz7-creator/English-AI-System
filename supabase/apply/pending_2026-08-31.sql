-- ============================================================================
-- ★ Supabase の SQL Editor に、これを丸ごと貼って Run してください ★
--
-- 【これは何か】
--   0024(単語帳を「入った日」と「教材名」で絞れるようにする)だけです。
--   0023 までは、すでに実行済みのはずです。
--   中身は GitHub の `supabase/migrations/0024_word_added.sql` と同じで、
--   **新しいことは何もしていません。**
--
-- 【何が起きるか】
--   ・`word_reviews`(単語帳)に **`added_at`(単語帳に入った日)** の列が
--     1つ増えます。**いまある語は、最後に答えた日を入った日とみなします**
--     (いちばん近い見積もりです)
--   ・復習語を返す関数 `review_words()` が、
--     **入った日・出会った教材の id・教材名**も返すようになります
--
-- 【どこまで影響するか】
--   ・**語そのもの・箱・次に出す日・出会った文は、いっさい変わりません**
--   ・教材・宿題・ゲストの情報・集計には**触れません**
--   ・これまでに登録した語の「教材名」は**空のままです。**
--     教材名が付くのは、これから登録する語からです
--
-- 【何度貼っても安全です】
--   すでに入っていれば飛ばされます。迷ったら、そのまま貼ってください。
--
-- 【どうなれば成功か】
--   `Success. No rows returned` と出れば成功です。
-- ============================================================================

-- ============================================================================
-- 0024 単語帳を「いつ入ったか」「どの教材で会ったか」で絞れるようにする
--
-- 【なぜ要るのか】(2026-08 利用者の指定)
--
--   > 単語帳に吹き出しのカレンダーをつけて、単語帳に追加された日付、
--   > 教材名で絞り込みできるようにしてください
--
--   単語帳は増えていくので、そのうち一覧では探せなくなる。
--   ところが、いまの `word_reviews` には**絞るための手がかりが無い。**
--
--     ・`updated_at` … **最後に答えた日**であって、入った日ではない。
--                      復習するたびに動くので、日付で絞る役には立たない
--     ・`material_id` … 列はあるが、**画面から渡していなかった**ので空である
--
-- 【何をするか】
--   ① `added_at`(単語帳に入った日)を足す。**あとから動かさない**
--   ② `review_words()` が `added_at` / `material_id` / 教材名 も返すようにする
--
--   `mark_word()` は**触らない。** あの関数の `insert` は列を並べて書いており、
--   `added_at` を書いていないので**入るときは既定値(now())**が入り、
--   `on conflict do update` でも触らないので**あとから動かない。**
--   欲しい振る舞いがそのまま出る。**書かなくてよいものは書かない。**
--
-- 【古い語の教材名は、空のままにする】(利用者の指定)
--
--   > これからの分だけでよい
--
--   出会った文から教材を**推測して**結びつけることもできるが、
--   当たらなければ**間違った教材名**が出る。
--   「あやふやなことを言わない」— スラッシュリーディングの注意と同じ考え方。
--
-- 【何度貼っても安全】
--   `add column if not exists` と `create or replace` だけ。
--   `review_words()` は**返す列が増えるので、先に drop する**
--   (返す列を変える関数は先に drop function if exists・CLAUDE.md)。
-- ============================================================================

-- ────────────────────────────────────────────────────────────────
-- 1. 単語帳に入った日
--
--   既存の行は `updated_at`(最後に答えた日)へ寄せる。
--   **いちばん近い見積もり**であって、正確な日ではない。
--   貼った日(now())がずらりと並ぶよりは、ずっと役に立つ。
-- ────────────────────────────────────────────────────────────────
alter table public.word_reviews
  add column if not exists added_at timestamptz not null default now();

comment on column public.word_reviews.added_at is
  '単語帳に入った日。あとから動かさない(mark_word は on conflict で触らない)。'
  '0024 より前からある行は updated_at に寄せてある(見積もり)。';

-- **一度だけ寄せる。** 2回目からは `added_at <= updated_at` なので何も起きない
update public.word_reviews
   set added_at = updated_at
 where added_at > updated_at;

create index if not exists word_reviews_added_idx
  on public.word_reviews (learner_id, added_at desc);

-- ────────────────────────────────────────────────────────────────
-- 2. 復習語に「入った日」と「出会った教材」を添えて返す
--
--   **返す列が増えるので、先に drop する。**
--   置き換えようとすると `cannot change return type of existing function`
--   で止まる(0015 と 0002 で実際に踏んでいる)。
--
--   教材は `left join`。**教材が消えていても語は残す**
--   (`material_id` は `on delete set null` なので、そもそも空になる)。
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
  -- 担当しているゲスト、本人、または owner だけ
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
      -- 文脈の指定が無いものを先に。同じ語で何件あっても1件だけ使う
      order by (gg.context_key <> ''), gg.created_at
      limit 1
    ) g on true
    -- **教材が消えていても語は残す。** 絞り込みの手がかりが1つ減るだけ
    left join public.materials m on m.id = r.material_id
    where r.learner_id = p_learner
      and (p_status is null or r.status = p_status)
      and (not p_due_only or r.due_on <= current_date)
    -- **出すべきものが先。** 同じ日なら、箱の低いもの(苦手なもの)から
    order by r.due_on, r.box, r.updated_at desc
    limit greatest(1, least(coalesce(p_limit, 40), 200));
end;
$$;

comment on function public.review_words(uuid, text, int, boolean) is
  'ゲストの復習語を意味付きで返す。p_due_only で「今日出すべきもの」に絞る。'
  '出会った文(seen_in)・単語帳に入った日(added_at)・出会った教材も返す。'
  '担当外は拒否する。';

-- ────────────────────────────────────────────────────────────────
-- 3. 権限
--
--   drop したので**付け直しが要る。** 忘れると画面から呼べなくなる。
-- ────────────────────────────────────────────────────────────────
grant execute on function public.review_words(uuid, text, int, boolean) to authenticated;
