-- ============================================================================
-- ★ここに残っている作業を、まとめて1回で実行するためのファイルです★
--
-- 【これは何か】
--   0013(発音記号)・0014(弱点の見出しの整理)・0015(復習の箱と句)・
--   0016(読み上げ音声の置き場)・0017(教材ごとの声)・
--   0018(単語帳に「出会った文」)を、そのままつなげたものです。
--   中身は migrations の6本と同じで、**新しいことは何もしていません。**
--   0013 と 0014 をすでに実行済みでも、そのまま実行して構いません。
--
-- 【何が起きるか】
--   ・word_glosses に「発音記号」の列が1つ増えます
--   ・弱点タグの見出しが「発音(子音)/発音(母音)」→「発音」にまとまります
--   ・弱点タグに「単語」の見出しが6つ増えます
--   ・word_reviews に「種類 / 箱 / 次に出す日」の3列が増えます
--   ・印を付ける関数(mark_word)が1つ増えます
--   ・material_items に「要点フレーズ」の列が1つ増えます
--   ・Storage に「tts」という置き場(バケツ)が1つできます。
--     ここに、こちらで作った読み上げ音声(MP3)が入ります
--   ・materials に「読み上げの声の並び」の列が1つ増えます。
--     空のままなら、これまでどおりアメリカ英語の女性で読み上げます
--   ・word_reviews に「出会った文」の列が1つ増えます。
--     これから付ける語に入ります。**すでに付けた語は空のままです**
--     (どの文で出会ったかは、もう分からないため)
--
-- 【どこまで影響するか】
--   ・**教材・宿題・ゲストの情報には一切触れません**
--   ・tts は**新しく作る置き場**です。いまある material-audio には触れません
--   ・タグの id は変えていないので、過去の教材との紐付けは切れません
--   ・これまでに付けた「知らなかった」は消えません。
--     箱 0・次は今日 として引き継がれ、**次の教材からすぐ復習に出ます**
--   ・**何度実行しても構いません**(すでに実行済みでも安全です)
--
-- 【どうなれば成功か】
--   `Success. No rows returned` と出れば成功です。
--   そのあと supabase/test/verify_migrations.sql を実行して、
--   **45行すべてが ✅ OK** になれば完了です。
-- ============================================================================



-- ==== 0013_word_phonetic.sql ======================================

-- ============================================================================
-- English AI System — 語の発音記号を控えに足す
--
-- 【なぜ必要か】
--   意味は分かっても**読み方が分からない**と、声に出す練習につながらない。
--   利用者から「吹き出しの中に発音記号と Listen ボタンを置いてほしい」と
--   要望があった(2026-08)。
--
-- 【なぜ文脈ごとに持つのか】
--   0012 で控えの鍵は (語, 出てきた文) の組になっている。発音記号も
--   その組ごとに持つ。**同じ綴りで読み方が変わる語があるため。**
--     read  … /riːd/(現在) と /red/(過去)
--     live  … /lɪv/(動詞) と /laɪv/(形容詞)
--     lead  … /liːd/(導く) と /led/(鉛)
--   文脈ごとに引いているので、その文での読み方が入る。
--
-- 【何を消すか】
--   何も消さない。列を1つ足すだけ。**何度実行してもよい。**
--   すでにある控えは発音記号が空のままだが、画面は空でも崩れない。
-- ============================================================================

alter table public.word_glosses
  add column if not exists phonetic text;

comment on column public.word_glosses.phonetic is
  '発音記号(IPA)。同じ綴りでも文脈で読み方が変わるため、文脈ごとに持つ。';


-- ==== 0014_tag_categories.sql =====================================

-- ============================================================================
-- English AI System — 弱点タグの見出しを6つに整理し、「単語」を足す
--
-- 【なぜ必要か】
--   弱点タグの見出しが「発音(子音)」「発音(母音)」と分かれていて、
--   選ぶときに探しにくかった。利用者の指定で、見出しを
--   **発音 / リズム / 文法 / 表現 / 単語 / 流暢性** の6つに整理する(2026-08)。
--
--   あわせて「単語」の見出しを新設する。**語そのものの問題は、
--   言い回し(表現)とは別に数える必要がある。**
--   「言いたい語が出てこない」は、言い回しではなく語の問題であることが多い。
--
-- 【id は変えない】
--   id を変えると、その id が付いていた過去の教材が行方不明になる。
--   **付け替えるのは category(見出し)と label だけ。**
--
-- 【何を消すか】
--   何も消さない。見出しを付け替え、行を6つ足すだけ。
--   **何度実行してもよい。**
-- ============================================================================

-- ────────────────────────────────────────────────────────────────
-- 1. 子音・母音を「発音」にまとめる
-- ────────────────────────────────────────────────────────────────
update public.weakness_tags
   set category = 'pronunciation'
 where category in ('consonant', 'vowel');

-- 「流暢さ」→「流暢性」(見出しの言い方をそろえる。id は変えない)
-- ※ 画面の見出しは src/data/weaknessTags.js が持っているので、
--    ここは SQL を直接見たときに食い違わないようにするための更新である。

-- ────────────────────────────────────────────────────────────────
-- 2. 「単語」の見出しを足す
--
--   sort_order は、既にある一番大きい値の後ろに続ける。
-- ────────────────────────────────────────────────────────────────
insert into public.weakness_tags (id, category, kind, label, hint, sort_order) values
  ('word-basic',    'word', 'weakness', '基礎語の抜け',
   'よく出るのに使えていない語。keep / hold / raise など', 400),
  ('word-abstract', 'word', 'weakness', '抽象語',
   '概念をあらわす語。approach / factor / extent / impact', 401),
  ('word-industry', 'word', 'weakness', '業界の語',
   'その業界でしか使わない語。仕事で必ず要る', 402),
  ('word-synonym',  'word', 'weakness', '類義語の使い分け',
   'problem / issue / trouble のような近い語の選び分け', 403),
  ('word-form',     'word', 'weakness', '語形の作り分け',
   'analyze / analysis / analytical のような品詞ちがい', 404),
  ('word-all',      'word', 'drill',    '単語全般',
   '特定の語ではなく、語彙をひととおり通す網羅型の練習', 405)
on conflict (id) do update
  set category = excluded.category,
      kind     = excluded.kind,
      label    = excluded.label,
      hint     = excluded.hint;


-- ==== 0015_vocab_spacing.sql ======================================

-- ============================================================================
-- 0015 語彙の復習 — 間隔をあけて出す / 句とイディオムも記録する
--
-- 【なぜ要るか】(2026-08 利用者の指定)
--   0011 で「知っていた / 知らなかった」を記録できるようにしたが、
--   2つ足りなかった。
--
--   ① **いつ再び出すかの仕組みが無い。**
--      一度「知っていた」にすると二度と出ず、「知らなかった」は
--      ずっと出続ける。忘れかけた頃に再会する形になっていない。
--
--   ② **句・イディオム・句動詞を記録できない。**
--      look forward to / put off のような、語を並べたものが要になる。
--
-- 【どう解くか】
--   ① 箱(Leitner)。段階(box)と、次に出す日(due_on)だけを持つ。
--
--        知らなかった → 箱を 0 に戻し、翌日にまた出す
--        知っていた   → 箱を1つ上げ、1 → 2 → 4 → 7 → 14 → 30 日後
--
--      **SM-2 のような細かい方式は採らない。** レッスンは週2回で、
--      宿題の回数が細かい間隔に追いつかない。6段で足りる。
--
--      **間隔の決まりは、この関数1つだけに置く**(`mark_word`)。
--      画面側で計算すると、端末の日付や時差で食い違う。
--
--   ② 表を増やさない。`word_reviews` の鍵は (人, そろえた形) である。
--      句は語を空白ひとつでつないだ形になるので、**そのまま入る**。
--      `norm_word()` は連続する記号を空白1つにするため、
--      "look forward to" はそのまま "look forward to" になる。
--      見分けるための `kind` を1列だけ足す。
--
-- 【何を消すか】
--   `review_words()` を作り直す(返す列が増えるため、置き換えではなく
--   一度落としてから作る)。表のデータは何も消さない。
--   **何度実行してもよい。**
-- ============================================================================

-- ────────────────────────────────────────────────────────────────
-- 1. word_reviews に3つ足す
--
--   既にある行には既定値が入る。box = 0 / due_on = 今日 なので、
--   これまで付けた語は**次の教材からすぐ復習に出る**。
-- ────────────────────────────────────────────────────────────────
alter table public.word_reviews
  add column if not exists kind   text     not null default 'word',
  add column if not exists box    smallint not null default 0,
  add column if not exists due_on date     not null default current_date;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'word_reviews_kind_check'
  ) then
    alter table public.word_reviews
      add constraint word_reviews_kind_check check (kind in ('word', 'phrase'));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'word_reviews_box_check'
  ) then
    alter table public.word_reviews
      add constraint word_reviews_box_check check (box between 0 and 6);
  end if;
end
$$;

comment on column public.word_reviews.kind is
  '語(word)か、句・イディオム・句動詞(phrase)か。鍵の作り方は同じ。';
comment on column public.word_reviews.box is
  '箱(0〜6)。0 = 覚えていない。上がるほど次に出るまでが長くなる。';
comment on column public.word_reviews.due_on is
  '次に出す日。教材を作るとき、この日を過ぎたものを先に混ぜる。';

-- 「今日出すべきもの」を引くための索引。復習の教材を作るたびに引く
create index if not exists word_reviews_due_idx
  on public.word_reviews (learner_id, due_on);

-- ────────────────────────────────────────────────────────────────
-- 2. 印を付ける — 間隔の決まりはここだけ
--
--   security definer にしない。**RLS をそのまま効かせる。**
--   自分の行しか書けないことは、既にポリシーが保証している
--   (word_reviews_own_write / _own_update)。
--   definer にすると、その保証を関数の中で作り直すことになる。
-- ────────────────────────────────────────────────────────────────
create or replace function public.mark_word(
  p_norm     text,
  p_status   text,
  p_kind     text default 'word',
  p_material uuid default null
)
returns table (word_norm text, status text, box smallint, due_on date)
language plpgsql
volatile
set search_path = public
as $$
-- 返す列の名前(word_norm / status / box / due_on)は、表の列名と同じである。
-- **同じ名前があると plpgsql は「どちらか分からない」と止まる。**
-- 迷ったら列のほうを指すと決めておく
#variable_conflict use_column
declare
  v_norm text;
  v_box  smallint;
  v_days int;
begin
  v_norm := public.norm_word(p_norm);
  if v_norm is null then
    raise exception '語が空です';
  end if;
  if p_status is null or p_status not in ('known', 'unknown') then
    raise exception '状態は known か unknown です';
  end if;

  select r.box into v_box
    from public.word_reviews r
   where r.learner_id = auth.uid() and r.word_norm = v_norm;
  v_box := coalesce(v_box, 0);

  if p_status = 'unknown' then
    -- 分からなかったものは、いちばん下の箱に戻して翌日また出す
    v_box := 0;
    v_days := 1;
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

  return query
  insert into public.word_reviews as w
    (learner_id, word_norm, kind, status, box, due_on, material_id, updated_at)
  values
    (auth.uid(), v_norm, coalesce(p_kind, 'word'), p_status,
     v_box, current_date + v_days, p_material, now())
  on conflict (learner_id, word_norm) do update
    set status      = excluded.status,
        kind        = excluded.kind,
        box         = excluded.box,
        due_on      = excluded.due_on,
        -- どの教材で出会ったかは、**最初のものを残す**。
        -- 上書きすると「いつ出会ったか」の手がかりが消える
        material_id = coalesce(w.material_id, excluded.material_id),
        updated_at  = now()
  returning w.word_norm, w.status, w.box, w.due_on;
end;
$$;

comment on function public.mark_word(text, text, text, uuid) is
  '語や句に「知っていた / 知らなかった」を付け、次に出す日を決める。'
  '間隔の決まりはこの関数だけが持つ。';

-- ────────────────────────────────────────────────────────────────
-- 3. 復習の材料を取り出す(作り直し)
--
--   返す列が増えるので、置き換えではなく一度落としてから作る。
--   `p_due_only` を true にすると、**今日出すべきものだけ**を返す。
-- ────────────────────────────────────────────────────────────────
drop function if exists public.review_words(uuid, text, int);
-- **いまの形(4引数)も落とす。** あとの移行(0018)が返す列を増やすので、
-- 増えたあとにこのファイルをもう一度流すと
-- 「cannot change return type of existing function」で止まる。
-- 実際、まとめて貼るファイルを2回実行して止まった(2026-08)。
drop function if exists public.review_words(uuid, text, int, boolean);

create or replace function public.review_words(
  p_learner  uuid,
  p_status   text    default 'unknown',
  p_limit    int     default 40,
  p_due_only boolean default false
)
returns table (
  word_norm  text,
  display    text,
  kind       text,
  pos        text,
  meaning_ja text,
  status     text,
  box        smallint,
  due_on     date,
  updated_at timestamptz
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
           r.status,
           r.box,
           r.due_on,
           r.updated_at
    from public.word_reviews r
    left join lateral (
      select gg.display, gg.pos, gg.meaning_ja
      from public.word_glosses gg
      where gg.word_norm = r.word_norm
      -- 文脈の指定が無いものを先に。同じ語で何件あっても1件だけ使う
      order by (gg.context_key <> ''), gg.created_at
      limit 1
    ) g on true
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
  '担当外は拒否する。';

grant execute on function public.mark_word(text, text, text, uuid)     to authenticated;
grant execute on function public.review_words(uuid, text, int, boolean) to authenticated;

-- ────────────────────────────────────────────────────────────────
-- 4. 本文の要点フレーズ
--
--   教材を作る時点で、本文の各文から要点となる句を拾っておく
--   (0〜2個)。**開くたびに AI に拾わせない。** 費用が毎回かかるうえ、
--   開くまで何が出るか分からない。作る時点なら道具の形で強制できる。
--
--   形: [{ "text": "look forward to", "note": "〜を楽しみに待つ" }, ...]
-- ────────────────────────────────────────────────────────────────
alter table public.material_items
  add column if not exists phrases jsonb;

comment on column public.material_items.phrases is
  'この項目の要点フレーズ。[{text, note}] の配列。押すと復習に入れられる。';



-- ==== 0016_tts_bucket.sql =========================================

-- ============================================================================
-- 0016 読み上げ音声の置き場(Storage)
--
-- 【なぜ要るか】(2026-08 実機の報告)
--   知り合いの iPhone で、開発中のリンクを Google Chrome で開いてもらったら、
--   こちらで聞こえる声とはまるで違う、ひどい声が出た。
--
--   これは不具合ではない。**iOS では、すべてのブラウザの中身が Safari
--   (WebKit)である**ため、Chrome を使っても回避できない。そして
--   **iOS は高品質な声を Web Speech API に一切公開しない**
--   (実機で生 47 件を確認し、premium は 0 件だった)。
--
--   端末の声に頼るかぎり、iPhone のゲストには良い音を届けられない。
--   **こちらで音声を作って配る**ほかに道がない。
--
-- 【何をするか】
--   `tts` というバケツを1つ作るだけ。表は増やさない。
--
--   置き場所は英文と話者から機械的に決まる。
--
--       tts/<話者>/<英文の SHA-256>.mp3
--
--   目録の表を持たない理由は、**持つと必ずファイルと食い違う**からである。
--   場所が計算で出るなら、画面は取りに行って「あるか無いか」で判断できる。
--
-- 【なぜ public(誰でも読める)にするのか】
--   ここに入るのは**教材の英文を読み上げた音声だけ**である。
--   ゲストの録音は入らない(録音は端末内に置いたまま、サーバーへ上げない。
--   仕様書 3.2)。名前は SHA-256 なので、URL を知らないかぎり当てられず、
--   一覧を取る手段も与えていない。
--
--   引き換えに得られるものが大きい。
--     ・`<audio src="...">` にそのまま渡せる。**iPhone でも確実に鳴る**
--     ・Supabase の CDN とブラウザの控えが効く。2回目からは通信すら起きない
--     ・署名付き URL の発行が要らない。再生のたびの往復が1回減る
--
--   非公開にすると、音声を毎回 fetch して Blob にしてから鳴らすことになり、
--   端末の控えが効かず、通信量が毎回かかる。**閉じたスクールの教材音声に
--   見合わない代償**だと判断した(2026-08)。
--
-- 【書けるのは窓口だけ】
--   `storage.objects` は RLS が有効で、この移行は tts 用の書き込みポリシーを
--   1つも作らない。したがって**画面(anon / authenticated)からは置けない。**
--   置けるのは service_role を持つ Edge Function(`speak`)だけである。
--   **ここを緩めない。** 緩めると、誰でも好きな音声を教材に紛れ込ませられる。
--
-- 【何度実行してもよい】
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('tts', 'tts', true)
on conflict (id) do nothing;

-- すでに非公開で作られていた場合に備えて、公開に直す。
-- (画面から `<audio src>` で直接鳴らせることが、この仕組みの前提である)
update storage.buckets set public = true where id = 'tts' and public is distinct from true;



-- ==== 0017_material_voice.sql =====================================

-- ============================================================================
-- 0017 教材ごとに読み上げの声を選べるようにする
--
-- 【なぜ要るか】(2026-08 利用者の指定)
--   > ElevenLabs の声を決めたら、教材作成の際に好きな声を選べるように
--   > 出来ますか？ アクセントの種類が恐らく10くらい、それに男女、
--   > くらいで選ぼうと思っています
--
--   ビジネス英語では、**相手の訛りが聞き取れないと仕事にならない。**
--   インド・シンガポール・スコットランドの英語は、教科書のアメリカ英語
--   しか聞いていないと歯が立たない。教材ごとに相手を変えられること自体に、
--   練習の価値がある。
--
-- 【何をするか】
--   `materials` に列を1つ足すだけ。**表は増やさない。**
--
--       voice_ids text[]   例: {'us-1'} / {'sc-2','sc-5'} / {'in-1','in-3'}
--
--   **並びである。** 会話は2人以上が話すので、1つでは足りない。
--   先頭から順に、出てくる話す人へ割り当てる。
--
--   値の一覧は画面側が持つ(`src/data/clipVoices.js`)。
--   **DB で選択肢を縛らない。** 声を足すたびに移行が要るのでは、
--   利用者が声を選び直すたびに SQL を貼ることになる。
--   知らない値が入っていても、画面が既定の声に丸める。
--
-- 【なぜ教材に持たせるのか(再生時に選ばせないのか)】
--   音声の置き場所の鍵は(段, 話者, 英文)である。再生のたびに訛りを
--   選べるようにすると、**同じ英文を訛りの数だけ作ることになり、
--   そのぶん課金される。** 教材ごとに1つ決めるほうが、
--   費用も、ゲストの耳の慣れ方も、素直になる。
--
-- 【影響】
--   ・空(NULL)なら、これまでどおりアメリカ英語の女性で読み上げる
--   ・すでにある教材には一切触れない
--   ・**何度実行してもよい**
-- ============================================================================

alter table public.materials
  add column if not exists voice_ids text[];

comment on column public.materials.voice_ids is
  '読み上げに使う声の並び。例: {sc-2,sc-5}。一覧は src/data/clipVoices.js。'
  '先頭から順に、出てくる話す人へ割り当てる。'
  'NULL や空なら既定(アメリカ英語・女性)。';

-- 【以前この移行を貼った方へ】
--   はじめは `voice_id`(1つだけ)にしていたが、会話には足りないため
--   `voice_ids`(並び)に変えた。`voice_id` が残っていても害はない。
--   何も書き込んでいないので、消しても残しても構わない。



-- ==== 0018_word_sentence.sql ======================================

-- ============================================================================
-- 0018 単語帳を「覚えられる形」にする — 出会った文を控える
--
-- 【なぜ要るか】(2026-08 利用者の指定「単語帳のパワーアップ」)
--   語だけを並べても覚えられない。**人は文脈ごと覚える。**
--   "consideration" を単独で覚えるより、
--   「Thank you for your consideration.」で出会ったことを思い出せるほうが、
--   次に会ったときに出てくる。
--
--   いまは `material_id`(どの教材か)しか控えていない。教材を開き直さないと
--   文にたどりつけず、復習の場では実質たどりつけない。
--
-- 【何をするか】
--   ① `word_reviews` に `seen_in`(出会った文)を1列足す
--   ② `mark_word()` に文を渡せるようにする(5つめの引数)
--   ③ `review_words()` が `seen_in` も返すようにする
--
--   **表は増やさない。** 語1つにつき1文で足りる。
--
-- 【最初の1文を残す】
--   `material_id` と同じ考え方で、**あとから上書きしない。**
--   最初に出会った文が、その語の思い出の手がかりになる。
--   上書きすると、覚えかけた手がかりが毎回入れ替わってしまう。
--
-- 【何を消すか】
--   `mark_word()` と `review_words()` を作り直す(引数と返す列が変わるため、
--   一度落としてから作る)。**表のデータは何も消さない。**
--   **何度実行してもよい。**
-- ============================================================================

-- ────────────────────────────────────────────────────────────────
-- 1. 出会った文を控える列
-- ────────────────────────────────────────────────────────────────
alter table public.word_reviews
  add column if not exists seen_in text;

comment on column public.word_reviews.seen_in is
  'その語に最初に出会った英文。復習のときに文脈ごと思い出すために出す。'
  '最初の1文だけを残し、あとから上書きしない。';

-- ────────────────────────────────────────────────────────────────
-- 2. mark_word() に文を渡せるようにする
--
--   **古い形(4引数)は落とす。** 残すと、4つで呼んだときにどちらの
--   関数か決められず PostgREST が断る。
-- ────────────────────────────────────────────────────────────────
drop function if exists public.mark_word(text, text, text, uuid);

create or replace function public.mark_word(
  p_norm     text,
  p_status   text,
  p_kind     text default 'word',
  p_material uuid default null,
  p_sentence text default null
)
returns table (word_norm text, status text, box smallint, due_on date)
language plpgsql
volatile
set search_path = public
as $$
-- 返す列の名前(word_norm / status / box / due_on)は、表の列名と同じである。
-- **同じ名前があると plpgsql は「どちらか分からない」と止まる。**
-- 迷ったら列のほうを指すと決めておく
#variable_conflict use_column
declare
  v_norm     text;
  v_box      smallint;
  v_days     int;
  v_sentence text;
begin
  v_norm := public.norm_word(p_norm);
  if v_norm is null then
    raise exception '語が空です';
  end if;
  if p_status is null or p_status not in ('known', 'unknown') then
    raise exception '状態は known か unknown です';
  end if;

  -- 文が長すぎると復習の画面で読みにくい。**入口で切る。**
  -- 空白の連なりもここでそろえておく(画面によって改行の入り方が違うため)
  v_sentence := nullif(btrim(regexp_replace(coalesce(p_sentence, ''), '\s+', ' ', 'g')), '');
  if v_sentence is not null then
    v_sentence := left(v_sentence, 300);
  end if;

  select r.box into v_box
    from public.word_reviews r
   where r.learner_id = auth.uid() and r.word_norm = v_norm;
  v_box := coalesce(v_box, 0);

  if p_status = 'unknown' then
    -- 分からなかったものは、いちばん下の箱に戻して翌日また出す
    v_box := 0;
    v_days := 1;
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

  return query
  insert into public.word_reviews as w
    (learner_id, word_norm, kind, status, box, due_on, material_id, seen_in, updated_at)
  values
    (auth.uid(), v_norm, coalesce(p_kind, 'word'), p_status,
     v_box, current_date + v_days, p_material, v_sentence, now())
  on conflict (learner_id, word_norm) do update
    set status      = excluded.status,
        kind        = excluded.kind,
        box         = excluded.box,
        due_on      = excluded.due_on,
        -- どの教材で出会ったかは、**最初のものを残す**。
        -- 上書きすると「いつ出会ったか」の手がかりが消える
        material_id = coalesce(w.material_id, excluded.material_id),
        -- 出会った文も同じ。**最初の1文が思い出の手がかりになる**
        seen_in     = coalesce(w.seen_in, excluded.seen_in),
        updated_at  = now()
  returning w.word_norm, w.status, w.box, w.due_on;
end;
$$;

comment on function public.mark_word(text, text, text, uuid, text) is
  '語や句に「知っていた / 知らなかった」を付け、次に出す日を決める。'
  '出会った文も控える(最初の1文だけ)。間隔の決まりはこの関数だけが持つ。';

-- ────────────────────────────────────────────────────────────────
-- 3. 復習の材料に「出会った文」を足す(作り直し)
--
--   0015 の中身をそのまま写し、返す列に `seen_in` を1つ足しただけである。
--   **並び順も権限の確かめ方も変えていない。** 返す列が変わるので、
--   置き換えではなく一度落としてから作る。
-- ────────────────────────────────────────────────────────────────
drop function if exists public.review_words(uuid, text, int, boolean);

create or replace function public.review_words(
  p_learner  uuid,
  p_status   text    default 'unknown',
  p_limit    int     default 40,
  p_due_only boolean default false
)
returns table (
  word_norm  text,
  display    text,
  kind       text,
  pos        text,
  meaning_ja text,
  seen_in    text,
  status     text,
  box        smallint,
  due_on     date,
  updated_at timestamptz
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
           r.status,
           r.box,
           r.due_on,
           r.updated_at
    from public.word_reviews r
    left join lateral (
      select gg.display, gg.pos, gg.meaning_ja
      from public.word_glosses gg
      where gg.word_norm = r.word_norm
      -- 文脈の指定が無いものを先に。同じ語で何件あっても1件だけ使う
      order by (gg.context_key <> ''), gg.created_at
      limit 1
    ) g on true
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
  '出会った文(seen_in)も返す。担当外は拒否する。';

-- ────────────────────────────────────────────────────────────────
-- 4. 権限。**作り直した関数には、もう一度付け直す**
-- ────────────────────────────────────────────────────────────────
grant execute on function public.mark_word(text, text, text, uuid, text) to authenticated;
grant execute on function public.review_words(uuid, text, int, boolean)  to authenticated;
