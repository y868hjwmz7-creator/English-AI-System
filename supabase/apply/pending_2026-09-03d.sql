-- ============================================================================
-- ★ Supabase の SQL Editor に、これを丸ごと貼って Run してください ★
--
-- 【これは何か】
--   0038 の1つだけです。GitHub の
--   supabase/migrations/0038_learn_streak.sql と**まったく同じ**中身です。
--
-- 【先に貼っていただくもの】
--   まだでしたら pending_2026-09-02c.sql → pending_2026-09-03.sql →
--   pending_2026-09-03b.sql → pending_2026-09-03c.sql → これ、の順です。
--   順番を間違えても壊れませんが、02c を貼るまでは教材を発行できません。
--
-- 【これは窓口(Edge Function)の置き直しが要りません】
--   直しているのはデータベースの中だけです。**貼るだけで効きます。**
--
-- 【何が起きるか】
--   単語帳の表に「続けて思い出せた回数」の欄が1つ増え、
--   「覚えかけ」を25回続けて押した語が、しばらく(30日)出てこなくなります。
--   **いま入っている語の状態・箱・次に出す日は、1件も変わりません。**
--
-- 【成功の目安】
--   `Success. No rows returned` と出れば成功です。
--
-- 【うまくいかないとき】
--   赤い字が出たら、その文章をそのまま貼ってください。
--
-- 【もとの説明】
-- 0038 「覚えた」をやめ、**続けて押した回数**で卒業を決める
--
-- 【なぜ要るのか】(2026-09 利用者の指定)
--
--   > あと、「覚えた」はなくしましょう。
--   > 20-30回くらい連続で覚えかけを押すとしばらくは出てこない仕様にしましょう
--
--   これまで卒業の道は「覚えた」を**自分で押す**ことだった。
--   ところが申告は当てにならない。1回思い出せただけで押してしまうし、
--   押した瞬間に箱が上がって**30日先へ飛ぶ。** そして忘れる。
--
--   いまは押せるボタンを2つにする。
--
--     まだ     … 思い出せなかった   → 箱 0・翌日・**数えは 0 に戻る**
--     覚えかけ … 思い出せた         → 数えを1つ増やす
--
--   **25回続けて「覚えかけ」を押せた語だけが卒業する**(しばらく出てこない)。
--   利用者の言う「20〜30回くらい」の真ん中を採った。
--
-- 【間隔の決め方】(**この関数だけが持つ。画面には持たせない**)
--
--   | 押したもの | 数え | 箱 | 次に出す |
--   |---|---|---|---|
--   | まだ         | **0 に戻す** | 0 に戻す   | 翌日 |
--   | 覚えかけ(24回目まで) | +1 | +1(上限 3) | 1 / 2 / 4 日 |
--   | 覚えかけ(**25回目から**) | +1 | 6 | **30日** |
--   | 覚えた(古い呼び出し) | そのまま | +1(上限 6) | 1〜30日 |
--
--   **どれくらいで卒業するか。** 箱 3 で止まっているあいだは最長4日おきに
--   出るので、25回ためるにはおよそ **3か月**かかる。
--   途中で1度でも「まだ」を押せば 0 に戻る。
--   **早く卒業させたいときは、この 25 を小さくすれば済む**(1か所)。
--
--   卒業したあとも `status` は `learning` のままにする。
--   30日たてばまた出てくる(利用者の言う「**しばらく**は出てこない」)。
--   `known`(覚えた)にしてしまうと復習から**永久に**消えるので、
--   「しばらく」にならない。
--
-- 【「覚えた」は残す。ボタンを外しただけである】
--   `mark_word(..., 'known', ...)` はこれまでどおり動く。
--   本文(教材)の中で語に触れて押す「知っていた」がこの状態を使っており、
--   すでに `known` が付いている語も1件も変わらない。
--   **消すのと、見せるのは別のことである。**
--
-- 【何が変わるか】
--   ① `word_reviews` に `learn_streak`(続けて思い出せた回数)が増える。
--      **いまある行はすべて 0 から始まる**(既定値)
--   ② `mark_word()` がその数えを上げ下げし、25回で30日先へ送る
--
-- 【どこまで影響するか】
--   ・**いま入っている語の状態・箱・次に出す日は、1件も変わりません**
--   ・教材・宿題・取り組み・単語の意味には**いっさい触れません**
--   ・列が1つ増えるだけなので、貼る前の画面もそのまま動きます
--
-- 【何度貼っても安全】
--   `add column if not exists` と、drop してからの作り直しだけです。
-- ============================================================================

-- ────────────────────────────────────────────────────────────────
-- 1. 続けて思い出せた回数
--
--   **`box` では代われない。** 箱は「次にいつ出すか」を決める段で、
--   覚えかけでは 3 で頭打ちにしてある(0027)。
--   頭打ちのある数では「25回続いた」を数えられない。
-- ────────────────────────────────────────────────────────────────
alter table public.word_reviews
  add column if not exists learn_streak smallint not null default 0;

comment on column public.word_reviews.learn_streak is
  '「覚えかけ」を続けて押した回数(0038)。「まだ」を押すと 0 に戻る。'
  '25 に届いた語は、しばらく(30日)出てこない。';

-- ────────────────────────────────────────────────────────────────
-- 2. mark_word() — 数えを上げ下げし、25回で30日先へ送る
--
--   **先に drop を置く**(CLAUDE.md)。返す列は変えていないが、
--   あとで誰かが列を足したときに、このファイルだけを貼り直すと
--   `cannot change return type of existing function` で止まるためである
--   (0027 で実際に踏んだ)。すぐ下で作り直すので消えたままにはならない。
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
  -- **卒業までの回数。ここ1か所だけが持つ**(0038)。
  -- 利用者の指定「20-30回くらい」の真ん中
  c_graduate constant int := 25;
  -- 卒業した語を、どれくらい休ませるか(日)
  c_rest     constant int := 30;
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
  -- **その語が単語帳に入るのは、これが初めてか**(0030)。
  -- `found` は直前の select が行を見つけたかどうかである
  v_new    := not found;
  v_box    := coalesce(v_box, 0);
  v_streak := coalesce(v_streak, 0);

  if p_status = 'unknown' then
    -- 分からなかったものは、いちばん下の箱に戻して翌日また出す。
    -- **数えも 0 に戻す。**「続けて」思い出せた回数だからである
    v_box := 0;
    v_days := 1;
    v_streak := 0;
  elsif p_status = 'learning' then
    v_streak := v_streak + 1;
    if v_streak >= c_graduate then
      -- **卒業。しばらく出てこない**(0038・利用者の指定)。
      -- `status` は learning のままにしておく。30日たてばまた出る
      v_box := 6;
      v_days := c_rest;
    else
      -- **覚えかけは、箱を 3 で止める**(0027)。
      -- 上限が無いと、自信が無いまま押しつづけたものが30日先へ飛ぶ。
      -- 3 で止めれば必ず4日以内に戻ってくる
      v_box := least(v_box + 1, 3);
      v_days := case v_box when 1 then 1 when 2 then 2 else 4 end;
    end if;
  else
    -- **「覚えた」は、画面のボタンからは押せなくなった**(2026-09)。
    -- けれども本文の中の「知っていた」がこれを使うので、そのまま残す。
    -- 数えは触らない(復習で答えた回数ではないため)
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

  -- **単語帳に入ったばかりの語は、その日の復習に出す**(0030)。
  --
  -- これまでは、初めて入る語も「翌日」からだった(`v_days` は
  -- 「もう一度出すまでの間隔」なので、間隔の決まりとしては正しい)。
  -- けれども**入れたその日に1回も出てこない**ので、
  -- 手で入れた人には「登録しても反映されない」ように見える(2026-09 実機)。
  --
  -- **間隔の決まりそのものは変えていない。** 2回目からはこれまでどおり
  if v_new then
    v_days := 0;
  end if;

  -- 続けた記録(0019)。
  -- **「思い出せたか」で数える**(0038)。ボタンから「覚えた」が
  -- 無くなったので、`known` だけを正解に数えると**いつも 0** になる
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
  '語や句に「覚えかけ / まだ」を付け、次に出す日を決める(0038)。'
  '「覚えかけ」を25回続けて押した語は、しばらく(30日)出てこない。'
  '「まだ」を押すと数えは 0 に戻る。'
  'p_learner を渡すと、担当しているゲストの記録として残す(0025)。'
  '間隔の決まりはこの関数だけが持つ。';

-- drop したので、権限を付け直す
revoke all on function public.mark_word(text, text, text, uuid, text, text, uuid) from public;
grant execute on function public.mark_word(text, text, text, uuid, text, text, uuid)
  to authenticated;
