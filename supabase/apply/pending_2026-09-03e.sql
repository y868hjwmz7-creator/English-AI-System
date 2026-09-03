-- ============================================================================
-- ★ Supabase の SQL Editor に、これを丸ごと貼って Run してください ★
--
-- 【これは何か】
--   0039 の1つだけです。GitHub の
--   supabase/migrations/0039_streak_in_review.sql と**まったく同じ**中身です。
--
-- 【先に貼っていただくもの】
--   まだでしたら pending_2026-09-02c.sql → pending_2026-09-03.sql →
--   pending_2026-09-03b.sql → pending_2026-09-03c.sql →
--   pending_2026-09-03d.sql → これ、の順です。
--   **0038(03d)より先にこれを貼ると失敗します**(数える欄がまだ無いため)。
--
-- 【これは窓口(Edge Function)の置き直しが要りません】
--   直しているのはデータベースの中だけです。**貼るだけで効きます。**
--
-- 【何が起きるか】
--   単語帳の一覧が「その語で『覚えかけ』を何回続けて押したか」を
--   受け取れるようになります。**十分に積んだ語にだけ**「覚えた」の
--   ボタンが出るようになります。
--
-- 【どこまで影響するか】
--   ・表(テーブル)には**いっさい触れません。** 列も行も増えません
--   ・いま入っている語の状態・箱・次に出す日は、1件も変わりません
--   ・教材・宿題・取り組み・単語の意味にも触れません
--
-- 【成功の目安】
--   `Success. No rows returned` と出れば成功です。
--
-- 【うまくいかないとき】
--   赤い字が出たら、その文章をそのまま貼ってください。
--
-- 【もとの説明】
-- ============================================================================
-- 0039 単語帳の一覧にも「続けて思い出せた回数」を渡す
--
-- 【なぜ要るのか】(2026-09 利用者の指定)
--
--   > はい、ある程度の回数「覚えかけ」を押さないと「覚えた」は
--   > 出ない仕様にしましょう。
--
--   0038 で**復習のカード**からは「覚えた」を外した(押せるのは
--   「まだ」/「覚えかけ」の2つ)。ところが単語帳の**一覧**(見返す用)には
--   「覚えた」が残っていて、そこから1回で卒業できてしまう。
--   **1つの画面で外したものが、別の画面から入れるのでは意味がない。**
--
--   かといって一覧から丸ごと外すこともできない。
--   本文の中で語に触れて押す「知っていた」がこの状態を使っており、
--   **すでに `known` が付いている語**もある。だから
--   **十分に「覚えかけ」を積んだ語にだけ、一覧の「覚えた」を出す。**
--
--   その判断には `learn_streak`(0038)が要る。ところが
--   `review_words()` は**その列を返していなかった**ので、画面からは
--   何回積んだのかが分からなかった。**返す列を1つ増やすだけである。**
--
-- 【何が変わるか】
--   `review_words()` が `learn_streak`(0038 で足した欄)も返します。
--   **数え方も、間隔の決まりも、1つも変えていません。**
--
-- 【どこまで影響するか】
--   ・表(テーブル)には**いっさい触れません。** 列も行も増えません
--   ・教材・宿題・取り組み・単語の意味にも触れません
--   ・貼る前の画面もそのまま動きます(増えた欄を見ないだけ)
--
-- 【何度貼っても安全】
--   **返す列が増えるので、先に drop する**(CLAUDE.md)。
--   置き換えようとすると `cannot change return type of existing function`
--   で止まる(0015・0002・0027 で実際に踏んでいる)。
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
  -- 0028。**絞り込みの手がかり**
  material_industry text,
  material_kind     text,
  material_genre    text,
  material_scene    text,
  -- ここから 0039。**続けて思い出せた回数**(0038 で足した欄)
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
  '出会った教材の分野・種類・話題・場面も返す(0028)。'
  '続けて思い出せた回数(learn_streak)も返す(0039)。'
  '一覧の「覚えた」を出してよいかの判断に使う。担当外は拒否する。';

-- **drop したので、権限を付け直す。** 忘れると画面から呼べなくなる
grant execute on function public.review_words(uuid, text, int, boolean) to authenticated;
