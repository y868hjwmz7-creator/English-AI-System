-- ============================================================================
-- ★ Supabase の SQL Editor に、これを丸ごと貼って Run してください ★
--
-- 【これは何か】
--   **まだ貼っていないものを、全部1つにまとめたもの**です(0034 〜 0040 の7つ)。
--   これ1つを貼れば、ほかのファイルを貼る必要はありません。
--   すでに貼ったものが混じっていても、**何度貼っても安全**です。
--
--   | 番号 | 何のためのものか |
--   |---|---|
--   | 0034 | 演習の種類に「誤り訂正」を足す(穴埋めの置き換え) |
--   | 0035 | 内容の理解の、設問と解答に訳を付ける |
--   | 0036 | 記事・会話の見出しに、小さな訳を付ける |
--   | 0037 | 教材の種類に「会議」を足す |
--   | 0038 | 「覚えた」をやめ、続けて押した回数で卒業を決める |
--   | 0039 | 単語帳の一覧にも、その回数を渡す |
--   | 0040 | **Quick Response の復習**(「まだ」を押した文を溜める)|
--
-- 【何が起きるか】
--   ・表が1つ増えます(`qr_reviews`)。**空から始まります**
--   ・欄がいくつか増えます(訳・見出しの訳・続けて押した回数)
--   ・関数がいくつか増え、いくつか作り直されます
--
-- 【どこまで影響するか】
--   ・**いま入っている教材・宿題・ゲストの情報・単語帳は、1行も変わりません**
--   ・貼る前に作った教材もそのまま開けます(増えた欄が空のままなだけ)
--
-- 【成功の目安】
--   `Success. No rows returned` と出れば成功です。
--   確かめたいときは、GitHub の supabase/apply/check.sql を続けて貼ると、
--   「まだです」が1件も出ないことを見られます。
--
-- 【うまくいかないとき】
--   赤い字が出たら、その文章をそのまま貼ってください。
--
-- 【あわせて必要な作業】
--   0034(誤り訂正)は、**窓口 `generate-material` の置き直し**も要ります。
--   置き直さないと、新しい教材で「誤り訂正」が作られません
--   (すでにある教材は、そのまま開けます)。
--
-- ============================================================================


-- ############################################################################
-- ##  0034_error_correction.sql
-- ############################################################################

-- ============================================================================
-- 0034 演習の種類に「誤り訂正」を足す(穴埋めの置き換え)
--
-- 【なぜ要るか】(2026-09 利用者の指定)
--
--   > そもそもこの穴埋めはいらないかもしれない。
--   > なぜなら、穴埋めは複数の回答が考えられる場合があり、すっきりしない
--
--   きっかけは実機でこう出たこと。
--
--     Before kickoff, could you （　　　） me where the away fans usually sit?
--     与える語: tell
--     → tell
--
--   `could you` のうしろは原形なので**形を変える必要がなく**、
--   与える語がそのまま答えになっていた。空欄の位置そのものが誤っている。
--   加えて、空欄に入りうる語が1つに決まらないことがある。
--
--   誤り訂正なら、**直す1か所も、直した形も1つに決まる。**
--   弱点をそのまま誤りにできるので、「弱点 → 教材」の循環にもよく合う。
--
-- 【穴埋め(`fill_blank`)は消さない】
--   **すでに作った教材が開けなくなる。** 一覧に残したまま、
--   新規では使わないようにするだけ(旧「長文」と同じ扱い)。
--   だから、この移行は**一覧に1つ足すだけ**である。
--
-- 【何が起きるか】
--   `material_sections.exercise_type` に入れてよい値が**1つ増えるだけ。**
--   すでに入っている行は1つも書き換わらない。
--
-- 【何度実行しても安全】
--   `drop constraint if exists` を先に置いてある。
-- ============================================================================

alter table public.material_sections drop constraint if exists material_sections_type_check;
alter table public.material_sections
  add constraint material_sections_type_check check (exercise_type in (
    -- 文型ドリル
    --   error_correction … 誤りを1か所直す。**穴埋めの置き換え**(0034)
    'translate_en_ja', 'error_correction', 'translate_ja_en', 'listening',
    -- 本文(まとまった1本)
    'article', 'dialogue',
    -- 本文に対する設問と語句
    --   discussion … 本文をきっかけに自分の考えを話す。**正解が無い**(0033)
    'comprehension', 'discussion', 'vocab_note',
    -- 旧「長文」で使っていたもの。既存の行のために残す
    'read_aloud', 'overlapping', 'shadowing', 'repeating',
    -- 穴埋め。**新規では使わない**(0034 で誤り訂正へ差し替えた)。
    -- すでに作った教材を開くために残す
    'fill_blank',
    -- 単語・フレーズ
    'vocabulary', 'phrase'
  ));


-- ############################################################################
-- ##  0035_qa_translation.sql
-- ############################################################################

-- ============================================================================
-- 0035 内容の理解に「設問の訳」と「解答の訳」を足す
--
-- 【なぜ要るか】(2026-09 利用者の指定)
--
--   > 内容理解の設問と解答の訳を見れるようにしてください。音も聞けるように。
--   > そして解答や設問も単語の意味を調べて単語帳に追加できるようにしてください。
--
--   内容の理解は、**設問も解答も英語**である。
--   ところが日本語が1つも無いため、設問の意味が取れないと
--   **設問そのものが壁**になり、本文の理解を確かめられない。
--
-- 【なぜ既にある列を使わないのか】
--   `prompt_ja`(日本語で提示するもの)は空いているが、
--   あれは**本文・問題文の訳**を入れる欄である。設問の訳をそこに入れると、
--   あとで「本文の訳」を扱う仕組みに内容の理解が紛れ込む
--   (Quick Response・スラッシュリーディング・カタマリの訳は、どれも
--   `prompt_en` / `prompt_ja` の対で動いている)。
--   **名前の違うものを、同じ欄に入れない。**
--
-- 【何が起きるか】
--   ・`material_items` に **text の列が2つ増えるだけ**です
--   ・**入っている行は1つも書き換わりません**(どちらも空のまま)
--   ・0035 を貼る前に作った教材には入っていません。
--     その教材では**訳が出ないだけ**で、これまでどおり使えます
--
-- 【どこまで影響するか】
--   教材・宿題・単語帳・ゲストの情報・取り組みの記録には触れません。
--   RLS(見える範囲の決まり)も変えません。`material_items` の
--   ポリシーはそのまま効きます(列を足しても行の見え方は変わりません)。
--
-- 【成功の目安】
--   `Success. No rows returned` と出れば成功です。
-- ============================================================================

-- 設問の訳。**内容の理解で使う。** ほかの演習では空のまま
alter table public.material_items
  add column if not exists question_ja text;

-- 解答の訳。**内容の理解で使う。** ほかの演習では空のまま
alter table public.material_items
  add column if not exists answer_ja text;

comment on column public.material_items.question_ja is
  '設問(question)の日本語訳。内容の理解で使う(0035)';
comment on column public.material_items.answer_ja is
  '解答(answer)の日本語訳。内容の理解で使う(0035)';


-- ############################################################################
-- ##  0036_headline_ja.sql
-- ############################################################################

-- ============================================================================
-- 0036 記事・会話の見出しに「訳」を足す
--
-- 【なぜ要るか】(2026-09 利用者の指定)
--
--   > あと、1番上のタイトルに、小さな訳をつけてください
--
--   レッスン表示のいちばん上には、教材名(日本語)の下に
--   **英語の見出し**(`headline`)が出る。
--   例: `The Tiny Equipment That Decides Boxing Matches`
--
--   教材名のほうは「意外な話」のような**短い呼び名**であって、
--   この英語の見出しの訳ではない。だから見出しだけが、
--   **このページで唯一「意味の分からないまま置かれている日本語なしの行」**
--   になっていた。本文を読む前にいちばん先に目が行くところである。
--
-- 【なぜ画面で訳さないのか】
--   訳すには AI に頼むしかなく、**開くたびに課金される。**
--   発音記号(0020)・要点フレーズ・カタマリの訳(0021)と同じで、
--   **作るときに1回だけ作って控える**のが決まりである。
--   見出しは1教材に1つなので、費用は1本あたり十数トークンで済む。
--
-- 【何が起きるか】
--   ・`materials` に **text の列が1つ増えるだけ**です
--   ・**入っている行は1つも書き換わりません**(空のまま)
--   ・**表は増えません**
--   ・0036 を貼る前に作った教材には入っていません。
--     その教材では**訳が出ないだけ**で、これまでどおり使えます
--
-- 【どこまで影響するか】
--   教材・宿題・単語帳・ゲストの情報・取り組みの記録には触れません。
--   RLS(見える範囲の決まり)も変えません。`materials` のポリシーは
--   そのまま効きます(列を足しても行の見え方は変わりません)。
--
-- 【成功の目安】
--   `Success. No rows returned` と出れば成功です。
-- ============================================================================

-- 見出しの訳。**記事・会話のときだけ入る。** 文型ドリルでは空のまま
alter table public.materials
  add column if not exists headline_ja text;

comment on column public.materials.headline_ja is
  '見出し(headline)の日本語訳。記事・会話で使う(0036)';


-- ############################################################################
-- ##  0037_meeting_kind.sql
-- ############################################################################

-- ============================================================================
-- 0037 教材の種類に「会議」を足す
--
-- 【なぜ要るか】(2026-09 利用者の指定)
--
--   > 会議の教材が追加されていない
--
--   「会議」は 2026-09 に**場面**(プロジェクトの立ち上げ会議・アイデア出しの
--   会議・部署をまたぐ会議)と**出てくる人数**(3〜4人)として作ったが、
--   **「トレーニングの種類」の一覧には出していなかった。**
--   だから会議を作るには「ダイアローグ(会話)」を選び、そのうえで人数を
--   3人にする必要があり、**探すときにも「会話」としてしか出てこなかった。**
--
-- 【なぜ演習の種類は増やさないのか】
--   中身は会話とまったく同じ(本文14発言 + 内容の理解5 + ディスカッション5 +
--   語句6)である。ちがうのは**出てくる人数が3〜4人**という1点だけ。
--   演習の種類(`material_sections.exercise_type`)を増やすと、
--   `material_sections_type_check` も窓口(`generate-material`)も触ることになり、
--   **すでに作った会話と別物**になってしまう。
--   **足すのは `materials.kind` の値1つだけ**にする。
--   人数は `materials.voice_ids` の長さがそのまま持つので、
--   **表も列も増えない**(CLAUDE.md)。
--
-- 【何が起きるか】
--   ・`materials` の「種類」に入れてよい値が**1つ増えるだけ**です
--   ・**入っている行は1つも書き換わりません**
--   ・**表も列も増えません**
--   ・これを貼るまでは、会議として発行しようとすると
--     `materials_kind_check` で止まります
--
-- 【どこまで影響するか】
--   教材・宿題・単語帳・ゲストの情報・取り組みの記録には触れません。
--   RLS(見える範囲の決まり)も変えません。
--
-- 【成功の目安】
--   `Success. No rows returned` と出れば成功です。
-- ============================================================================

alter table public.materials drop constraint if exists materials_kind_check;
alter table public.materials
  add constraint materials_kind_check check (kind in (
    'pattern',    -- 文型ドリル(4演習 × 10問 = 40問)
    'reading',    -- リーディング(記事1本 + 内容理解 + ディスカッション + 語句)
    'dialogue',   -- ダイアローグ(会話1本。2人)
    'meeting',    -- 会議(会話と同じ形。**3〜4人**・0037)
    'word',       -- 単語
    'phrase',     -- フレーズ
    'passage'     -- 旧「長文」。新規では使わないが、既存の行のために残す
  ));


-- ############################################################################
-- ##  0038_learn_streak.sql
-- ############################################################################

-- ============================================================================
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


-- ############################################################################
-- ##  0039_streak_in_review.sql
-- ############################################################################

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


-- ############################################################################
-- ##  0040_qr_reviews.sql
-- ############################################################################

-- ============================================================================
-- 0040 Quick Response の復習(「まだ」を押した文を溜める)
--
-- 【なぜ要るのか】(2026-09 利用者の指定)
--
--   > 教材の中で取り組んだ Quick Response の中で「まだ」を押したものは、
--   > Quick Response という復習用の機能を独立して作り、
--   > ひとつのアカウントにつきひとつ持たせてください。
--   > UI は通常の Quick Response の画面と同じです。
--   > 単語と同じく、「テキスト」「日付」「業界」「シチュエーション」などから
--   > 絞り込んで練習できるようにしてください。
--   > 「まだ」「おぼえかけ」の仕組みは同じです。
--
--   これまで Quick Response は**その場かぎり**だった(「記録は残さない」と
--   決めていた)。言えなかった文は、その教材を開き直さないと二度と出てこない。
--   **利用者の指定で、この決まりを変える。**
--   単語帳が語に対してしていることを、**文に対して**する。
--
-- 【単語帳と、まったく同じ間隔の決まりにする】
--
--   | 押したもの | 数え | 箱 | 次に出す |
--   |---|---|---|---|
--   | まだ                     | **0 に戻す** | 0 | 翌日 |
--   | 言える(24回目まで)      | +1 | +1(上限 3) | 1 / 2 / 4 日 |
--   | 言える(**25回目から**)  | +1 | 6 | **30日**(しばらく出てこない) |
--
--   数字(25回・30日)は `mark_word()`(0038)と同じものである。
--   **2つの仕組みで違う間隔にしない。** 覚え方の話は同じである。
--
-- 【誰の記録になるか】(0025 と同じ考え方)
--   ・ゲストが自分の宿題で押した          → そのゲスト
--   ・トレーナーが**ゲストのページで**押した → **そのゲスト**
--   ・トレーナーが自分の「教材」で押した   → **トレーナー自身**
--   判定は `mark_qr()` の中(`teaches()`)だけで行う。**画面には持たせない。**
--
-- 【溜めるのは「文章」だけ】(利用者の指定)
--   単語・フレーズは**単語帳**が持つ。2か所で同じ語の覚え具合が動かないよう、
--   ここへは入れない(画面側 `qrReviews.js` が `group === 'sentence'` に絞る)。
--
-- 【教材をまたいで1つにまとめる】(利用者の指定)
--   鍵は**そろえた英文**(`en_norm`)である。同じ英文が別の教材に出てきても
--   1行にまとまる(単語帳が、語を教材をまたいで1つにしているのと同じ)。
--   教材は**最初に出会ったもの**を残す(あとから上書きしない)。
--
--   **`material_items` の id を鍵にしない。** Quick Response の1問は
--   「1項目を文でほどいたもの」なので、区切りの決まりを直すと番号がずれる。
--   英文そのものなら、決まりが変わってもずれない。
--
-- 【何が起きるか】
--   ① 表が1つ増えます(`qr_reviews`)。**空から始まります**
--   ② 関数が3つ増えます(`norm_en` / `mark_qr` / `qr_items`)
--
-- 【どこまで影響するか】
--   ・**いまある表には、いっさい触れません。** 教材・宿題・単語帳・
--     取り組み・ゲストの情報は1行も変わりません
--   ・貼る前の画面もそのまま動きます(復習が溜まらないだけ)
--
-- 【何度貼っても安全】
--   `create table if not exists` と、drop してからの作り直しだけです。
-- ============================================================================

-- ────────────────────────────────────────────────────────────────
-- 1. 英文のそろえ方 — **すでにあるものを使う。新しく作らない**
--
--   `public.norm_en()` は 0008(同じ英文を二度出さないための台帳)で
--   すでに作ってある。画面側にも同じ規則の `normEn()`
--   (`src/lib/materials.js`)がある。
--
--     小文字にする → 英数字以外は空白にする → 前後を落とす
--
--   **同じことをする規則を、2つ持たない。** 語のそろえ方(`norm_word`)を
--   3か所でそろえるのに苦労したのと同じ話である。ここで別のものを作れば、
--   いつか必ずずれる。
--
--   `don't` は `don t` になるが、**鍵として使うぶんには何も困らない**
--   (同じ文はいつも同じ形になる)。出すときの英文は `en` の列がそのまま持つ。
-- ────────────────────────────────────────────────────────────────

-- ────────────────────────────────────────────────────────────────
-- 2. 溜める場所
--
--   **1人 × 1つの英文で1行。** 単語帳(`word_reviews`)と同じ形にしてある。
--   出題に要るもの(日本語・英文)は、この行が持つ。
--   **教材を読み直さなくても復習できる**ようにするためである
--   (教材が消えても、溜めた文は残る)。
-- ────────────────────────────────────────────────────────────────
create table if not exists public.qr_reviews (
  id           uuid primary key default gen_random_uuid(),
  learner_id   uuid not null references public.profiles(id) on delete cascade,
  -- そろえた英文。**これが鍵**である
  en_norm      text not null,
  -- 出すときの英文(そのまま。記号も大文字も残す)
  en           text not null,
  -- 出題の日本語
  ja           text not null,
  -- **最初に出会った教材。** あとから上書きしない(絞り込みの手がかり)
  material_id  uuid references public.materials(id) on delete set null,
  -- 誰のせりふか(会話のとき)。出題に添えるだけ
  speaker      text,
  status       text not null default 'unknown'
               check (status in ('unknown', 'learning', 'known')),
  box          smallint not null default 0,
  -- 続けて「言える」を押した回数。25 で卒業(0038 と同じ)
  learn_streak smallint not null default 0,
  due_on       date not null default current_date,
  added_at     timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (learner_id, en_norm)
);

comment on table public.qr_reviews is
  'Quick Response で「まだ」を押した文(0040)。1人 × 1つの英文で1行。'
  '間隔の決まりは単語帳(mark_word)とまったく同じ。';

create index if not exists qr_reviews_due_idx
  on public.qr_reviews (learner_id, due_on);

-- ────────────────────────────────────────────────────────────────
-- 3. RLS — **見えるのは自分の行だけ**
--
--   `word_reviews`(0011)とまったく同じ形にしてある。
--   トレーナーが担当ゲストのぶんを読み書きする道は、
--   **表を開けるのではなく、関数(`security definer`)1つに絞る。**
--   窓口を1つにするほうが、表そのものを開けるより穴が小さい(0025 の考え方)。
-- ────────────────────────────────────────────────────────────────
alter table public.qr_reviews enable row level security;

drop policy if exists qr_reviews_own_read on public.qr_reviews;
create policy qr_reviews_own_read on public.qr_reviews
  for select to authenticated
  using (learner_id = auth.uid());

drop policy if exists qr_reviews_own_write on public.qr_reviews;
create policy qr_reviews_own_write on public.qr_reviews
  for insert to authenticated
  with check (learner_id = auth.uid());

drop policy if exists qr_reviews_own_update on public.qr_reviews;
create policy qr_reviews_own_update on public.qr_reviews
  for update to authenticated
  using (learner_id = auth.uid())
  with check (learner_id = auth.uid());

drop policy if exists qr_reviews_own_delete on public.qr_reviews;
create policy qr_reviews_own_delete on public.qr_reviews
  for delete to authenticated
  using (learner_id = auth.uid());

grant select, insert, update, delete on public.qr_reviews to authenticated;

-- ────────────────────────────────────────────────────────────────
-- 4. mark_qr() — 「まだ」で溜め、「言える」で箱を上げる
--
--   **`p_only_existing` が要る理由。**
--   教材の中で「言えた」を押したとき、**まだ溜まっていない文まで
--   溜めてしまってはいけない。** 言えた文は復習に要らないからである。
--   けれども**すでに溜まっている文**を教材の中で言えたなら、
--   それは「言える」を押したのと同じ意味なので、箱を1つ上げる
--   (2026-09 利用者の確認)。
--
--     > すでに溜まっている問を、教材の中でもう一度やって「言えた」を
--     > 押したら、箱が1つ上がる(= 覚えかけと同じ)という理解でよいです。
--
--   **先に drop を置く**(CLAUDE.md)。返す列を変えていなくても置く。
--   あとで誰かが列を足したとき、このファイルだけを貼り直すと
--   `cannot change return type of existing function` で止まるためである。
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
  'p_only_existing = true なら、すでに溜まっている文だけを動かす。'
  'p_learner を渡すと、担当しているゲストの記録として残す(0025 と同じ)。';

revoke all on function public.mark_qr(text, text, text, uuid, text, uuid, boolean) from public;
grant execute on function public.mark_qr(text, text, text, uuid, text, uuid, boolean)
  to authenticated;

-- ────────────────────────────────────────────────────────────────
-- 5. qr_items() — 復習に出す文を読む
--
--   絞り込みの手がかり(教材名・分野・場面・話題)も一緒に返す。
--   **画面は、これ1回の問い合わせだけで絞り込みまでできる**
--   (`review_words()` と同じ考え方。選ぶたびに聞き直さない)。
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
    raise exception '担当していないゲストの復習は取得できません';
  end if;

  return query
    select q.en_norm, q.en, q.ja, q.speaker,
           q.status, q.box, q.learn_streak, q.due_on, q.added_at, q.updated_at,
           q.material_id, m.title, m.industry, m.kind, m.genre, m.scene
      from public.qr_reviews q
      -- **教材が消えていても文は残す。** 絞り込みの手がかりが減るだけ
      left join public.materials m on m.id = q.material_id
     where q.learner_id = p_learner
       and (p_status is null
            or (p_status = 'todo' and q.status in ('unknown', 'learning'))
            or q.status = p_status)
       and (not p_due_only or q.due_on <= current_date)
     -- **まだ を先に、覚えかけ を次に**(単語帳と同じ)
     order by (q.status = 'learning'), q.due_on, q.box, q.updated_at desc
     limit greatest(1, least(coalesce(p_limit, 200), 500));
end;
$$;

comment on function public.qr_items(uuid, text, int, boolean) is
  'Quick Response の復習に出す文を返す(0040)。'
  'p_status に todo を渡すと「まだ + 言えかけ」。p_due_only で今日ぶんに絞る。'
  '絞り込みの手がかり(教材名・分野・種類・話題・場面)も返す。担当外は拒否する。';

grant execute on function public.qr_items(uuid, text, int, boolean) to authenticated;

-- ────────────────────────────────────────────────────────────────
-- 6. drop_qr() — 復習から外す(間違えて溜めたとき)
--
--   **消す道を必ず用意する。** 溜まる一方だと、間違えて押した1問が
--   ずっと出続けることになる。
-- ────────────────────────────────────────────────────────────────
drop function if exists public.drop_qr(text, uuid);

create or replace function public.drop_qr(p_en text, p_learner uuid default null)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_who  uuid;
  v_norm text;
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
  if v_norm is null then return; end if;
  delete from public.qr_reviews
   where learner_id = v_who and en_norm = v_norm;
end;
$$;

comment on function public.drop_qr(text, uuid) is
  'Quick Response の復習からその文を外す(0040)。間違えて溜めたとき用。';

revoke all on function public.drop_qr(text, uuid) from public;
grant execute on function public.drop_qr(text, uuid) to authenticated;
