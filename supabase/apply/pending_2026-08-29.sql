-- ============================================================================
-- ★ここに残っている作業を、まとめて1回で実行するためのファイルです★
--
-- 【これは何か】
--   0013(発音記号)・0014(弱点の見出しの整理)・0015(復習の箱と句)・
--   0016(読み上げ音声の置き場)・0017(教材ごとの声)・
--   0018(単語帳に「出会った文」)・0019(続けた記録と集計)・
--   0020(単語・フレーズの発音記号)・0021(カタマリごとの訳)・
--   0022(取り組みの記録とリマインド)・
--   0023(集計を教材の種類と内容で数え直す)を、そのままつなげたものです。
--   中身は migrations の11本と同じで、**新しいことは何もしていません。**
--   0013 と 0014 をすでに実行済みでも、そのまま実行して構いません。
--
-- 【何が起きるか】
--   ・word_glosses に「発音記号」の列が1つ増えます
--   ・弱点タグの見出しが「発音(子音)/発音(母音)」→「発音」にまとまります
--   ・弱点タグに「単語」の見出しが6つ増えます
--   ・word_reviews に「種類 / 箱 / 次に出す日」の3列が増えます
--   ・印を付ける関数(mark_word)が1つ増えます
--   ・material_items に「要点フレーズ」の列が1つ増えます
--   ・material_items に「発音記号」の列が1つ増えます(0020)
--   ・material_items に「カタマリごとの訳」の列が1つ増えます(0021)。
--     **空から始まります。** これから作る記事・会話に入ります
--   ・practice_days(取り組みの記録)と reminders(リマインド)という
--     表が2つ増えます(0022)。**どちらも空から始まります**
--   ・集計の数え方が入れ替わります(0023)。**表は増えません。**
--     「ゲストが入力した学習時間」ではなく、**教材の種類・弱点・レベルと、
--     裏で数えた取り組み**で数えるようになります
--   ・Storage に「tts」という置き場(バケツ)が1つできます。
--     ここに、こちらで作った読み上げ音声(MP3)が入ります
--   ・materials に「読み上げの声の並び」の列が1つ増えます。
--     空のままなら、これまでどおりアメリカ英語の女性で読み上げます
--   ・vocab_days(日ごとの記録)と wordbook_views(トレーナーが見た記録)
--     という表が2つ増えます。**どちらも空から始まります**
--   ・word_reviews に「出会った文」と「その文の日本語」の列が増えます。
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
--   **48行すべてが ✅ OK** になれば完了です。
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
--   ① `word_reviews` に `seen_in`(出会った文)と
--      `seen_in_ja`(その文の日本語)を足す
--   ② `mark_word()` に文を渡せるようにする(5つめ・6つめの引数)
--   ③ `review_words()` が2つとも返すようにする
--
--   日本語のほうは**分かるときだけ**入る。文型ドリルは英文と和訳が
--   1対1なので入るが、記事の本文は段落ごとの訳しか無いため入らない。
--   **無いものを、あるように見せない。**
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
  add column if not exists seen_in    text,
  add column if not exists seen_in_ja text;

comment on column public.word_reviews.seen_in is
  'その語に最初に出会った英文。復習のときに文脈ごと思い出すために出す。'
  '最初の1文だけを残し、あとから上書きしない。';
comment on column public.word_reviews.seen_in_ja is
  'その文の日本語。分かるときだけ入る(英文と和訳が1対1の演習)。';

-- ────────────────────────────────────────────────────────────────
-- 2. mark_word() に文を渡せるようにする
--
--   **古い形(4引数)は落とす。** 残すと、4つで呼んだときにどちらの
--   関数か決められず PostgREST が断る。
-- ────────────────────────────────────────────────────────────────
drop function if exists public.mark_word(text, text, text, uuid);
drop function if exists public.mark_word(text, text, text, uuid, text);

create or replace function public.mark_word(
  p_norm     text,
  p_status   text,
  p_kind     text default 'word',
  p_material uuid default null,
  p_sentence text default null,
  p_sentence_ja text default null
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
  v_ja       text;
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
  v_ja := nullif(btrim(regexp_replace(coalesce(p_sentence_ja, ''), '\s+', ' ', 'g')), '');
  if v_ja is not null then
    v_ja := left(v_ja, 300);
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
    (learner_id, word_norm, kind, status, box, due_on, material_id,
     seen_in, seen_in_ja, updated_at)
  values
    (auth.uid(), v_norm, coalesce(p_kind, 'word'), p_status,
     v_box, current_date + v_days, p_material, v_sentence, v_ja, now())
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
        seen_in_ja  = coalesce(w.seen_in_ja, excluded.seen_in_ja),
        updated_at  = now()
  returning w.word_norm, w.status, w.box, w.due_on;
end;
$$;

comment on function public.mark_word(text, text, text, uuid, text, text) is
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
  seen_in_ja text,
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
           r.seen_in_ja,
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
grant execute on function public.mark_word(text, text, text, uuid, text, text) to authenticated;
grant execute on function public.review_words(uuid, text, int, boolean)  to authenticated;



-- ==== 0019_vocab_progress.sql =====================================

-- ============================================================================
-- 0019 単語帳の続き — 続けた記録・トレーナーが見たこと・業界別の集計
--
-- 【なぜ要るか】(2026-08 の提案を利用者が全部採用)
--   ① **続けた記録**。終わりと積み上がりが見えないと続かない。
--      ただし**日ではなく週で数える。** レッスンが週2回なのだから週が自然で、
--      1日休んでも壊れない。壊れない記録だけが続く
--   ② **トレーナーが見た**ことを、ゲストに見えるようにする。
--      人が見ていると分かることが、どんなバッジより効く
--   ③ **業界別に、覚えた語を数える。** 自分の仕事の語が増えるのは、
--      大人の学習者にいちばん効く
--
-- 【何をするか】
--   ・`vocab_days`      … 日ごとの答えた数(語ではなく回数)
--   ・`wordbook_views`  … トレーナーが単語帳を見た記録
--   ・`mark_word()`     … 答えるたびに `vocab_days` を1つ増やす
--   ・`vocab_week()`    … 今週の日数・回数・正解率
--   ・`vocab_by_industry()` … 業界別に覚えた語の数
--   ・`note_wordbook_view()` … トレーナーが見たことを記録する
--
-- 【なぜ日ごとの表を作るのか】
--   `word_reviews.updated_at` は**上書きされる。** 月曜に答えて水曜に
--   答え直すと、月曜の記録が消える。「何日続けたか」は数えられない。
--   だから日ごとに1行だけ持つ。**1人1日1行なので、年に365行しか増えない。**
--
-- 【何度実行してもよい】
-- ============================================================================

-- ────────────────────────────────────────────────────────────────
-- 1. 日ごとの記録
-- ────────────────────────────────────────────────────────────────
create table if not exists public.vocab_days (
  learner_id uuid    not null references auth.users(id) on delete cascade,
  done_on    date    not null default current_date,
  answered   integer not null default 0,   -- 答えた回数(同じ語を2回なら2)
  correct    integer not null default 0,   -- そのうち「覚えた」を選んだ回数
  primary key (learner_id, done_on)
);

alter table public.vocab_days enable row level security;

drop policy if exists "自分と担当トレーナーが見る" on public.vocab_days;
create policy "自分と担当トレーナーが見る" on public.vocab_days
  for select to authenticated
  using (learner_id = auth.uid() or public.teaches(learner_id) or public.is_owner());

-- **書けるのは本人だけ。** 担当トレーナーでも書けない。
-- 学習の記録は本人のものである(0011 の word_reviews と同じ考え方)
drop policy if exists "自分の記録だけ書ける" on public.vocab_days;
create policy "自分の記録だけ書ける" on public.vocab_days
  for all to authenticated
  using (learner_id = auth.uid()) with check (learner_id = auth.uid());

comment on table public.vocab_days is
  '単語帳を何日やったかを数えるための、日ごとの記録。1人1日1行。'
  'word_reviews.updated_at は上書きされるので、そちらでは数えられない。';

-- ────────────────────────────────────────────────────────────────
-- 2. トレーナーが単語帳を見た記録
--
--   **人が見ていると分かることが、いちばん効く。**
--   ゲストの画面に「◯◯トレーナーが見ました」と出すために使う。
-- ────────────────────────────────────────────────────────────────
create table if not exists public.wordbook_views (
  learner_id uuid        not null references auth.users(id) on delete cascade,
  trainer_id uuid        not null references auth.users(id) on delete cascade,
  viewed_at  timestamptz not null default now(),
  primary key (learner_id, trainer_id)
);

alter table public.wordbook_views enable row level security;

drop policy if exists "本人と見た人が読む" on public.wordbook_views;
create policy "本人と見た人が読む" on public.wordbook_views
  for select to authenticated
  using (learner_id = auth.uid() or trainer_id = auth.uid() or public.is_owner());

-- 担当しているゲストのぶんだけ、自分の名前で残せる
drop policy if exists "担当トレーナーが残す" on public.wordbook_views;
create policy "担当トレーナーが残す" on public.wordbook_views
  for all to authenticated
  using (trainer_id = auth.uid() and public.teaches(learner_id))
  with check (trainer_id = auth.uid() and public.teaches(learner_id));

comment on table public.wordbook_views is
  'トレーナーがそのゲストの単語帳を見た記録。ゲストの画面に出す。';

-- ────────────────────────────────────────────────────────────────
-- 3. 答えるたびに、日ごとの記録を1つ増やす
--
--   `mark_word()` の中で行う。**画面から別に呼ばせない。**
--   呼び忘れれば記録が欠け、欠けた記録は二度と埋められない。
-- ────────────────────────────────────────────────────────────────
drop function if exists public.mark_word(text, text, text, uuid);
drop function if exists public.mark_word(text, text, text, uuid, text);
drop function if exists public.mark_word(text, text, text, uuid, text, text);

create or replace function public.mark_word(
  p_norm        text,
  p_status      text,
  p_kind        text default 'word',
  p_material    uuid default null,
  p_sentence    text default null,
  p_sentence_ja text default null
)
returns table (word_norm text, status text, box smallint, due_on date)
language plpgsql
volatile
set search_path = public
as $$
-- 返す列の名前は表の列名と同じである。**同じ名前があると plpgsql は止まる。**
-- 迷ったら列のほうを指すと決めておく
#variable_conflict use_column
declare
  v_norm     text;
  v_box      smallint;
  v_days     int;
  v_sentence text;
  v_ja       text;
begin
  v_norm := public.norm_word(p_norm);
  if v_norm is null then
    raise exception '語が空です';
  end if;
  if p_status is null or p_status not in ('known', 'unknown') then
    raise exception '状態は known か unknown です';
  end if;

  -- 文が長すぎると復習の画面で読みにくい。**入口で切る。**
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

  -- 続けた記録(0019)。**答えた回数をここで数える。**
  insert into public.vocab_days as d (learner_id, done_on, answered, correct)
  values (auth.uid(), current_date, 1, case when p_status = 'known' then 1 else 0 end)
  on conflict (learner_id, done_on) do update
    set answered = d.answered + 1,
        correct  = d.correct + case when p_status = 'known' then 1 else 0 end;

  return query
  insert into public.word_reviews as w
    (learner_id, word_norm, kind, status, box, due_on, material_id,
     seen_in, seen_in_ja, updated_at)
  values
    (auth.uid(), v_norm, coalesce(p_kind, 'word'), p_status,
     v_box, current_date + v_days, p_material, v_sentence, v_ja, now())
  on conflict (learner_id, word_norm) do update
    set status      = excluded.status,
        kind        = excluded.kind,
        box         = excluded.box,
        due_on      = excluded.due_on,
        -- どの教材で出会ったかは、**最初のものを残す**
        material_id = coalesce(w.material_id, excluded.material_id),
        -- 出会った文も同じ。**最初の1文が思い出の手がかりになる**
        seen_in     = coalesce(w.seen_in, excluded.seen_in),
        seen_in_ja  = coalesce(w.seen_in_ja, excluded.seen_in_ja),
        updated_at  = now()
  returning w.word_norm, w.status, w.box, w.due_on;
end;
$$;

comment on function public.mark_word(text, text, text, uuid, text, text) is
  '語や句に「知っていた / 知らなかった」を付け、次に出す日を決める。'
  '出会った文も控え、続けた記録(vocab_days)も1つ増やす。'
  '間隔の決まりはこの関数だけが持つ。';

-- ────────────────────────────────────────────────────────────────
-- 4. 今週の続き具合
--
--   **週で数える。** 日ごとの連続記録は、1日休んだだけで途切れる。
--   途切れる記録は、途切れた瞬間にやめる理由になる(2026-08 の判断)。
--   週の始まりは月曜(レッスンの週と合わせる)。
-- ────────────────────────────────────────────────────────────────
create or replace function public.vocab_week(p_learner uuid default null)
returns table (
  days      integer,   -- 今週やった日数
  answered  integer,   -- 今週答えた回数
  correct   integer,   -- そのうち「覚えた」
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
    select d.* from public.vocab_days d join allowed a on a.id = d.learner_id
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
  -- 上から順に「1週ずつきちんと下がっているか」を見る。
  -- どこかで1週抜けると、そこから下は式に合わなくなる
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

comment on function public.vocab_week(uuid) is
  '今週の単語帳の続き具合。日ではなく週で数える(1日休んでも壊れない)。';

-- ────────────────────────────────────────────────────────────────
-- 5. 業界別に、覚えた語を数える
--
--   語そのものには業界が付いていない。**出会った教材の業界**で数える。
--   自分の仕事の語が増えていくのが見えることに意味がある。
-- ────────────────────────────────────────────────────────────────
create or replace function public.vocab_by_industry(p_learner uuid default null)
returns table (industry text, known integer, learning integer)
language sql
stable
security definer
set search_path = public
as $$
  with me as (select coalesce(p_learner, auth.uid()) as id),
  allowed as (
    select id from me
     where id = auth.uid() or public.teaches(id) or public.is_owner()
  )
  select
    coalesce(m.industry, 'general') as industry,
    count(*) filter (where r.status = 'known')::int    as known,
    count(*) filter (where r.status = 'unknown')::int  as learning
  from public.word_reviews r
  join allowed a on a.id = r.learner_id
  left join public.materials m on m.id = r.material_id
  group by coalesce(m.industry, 'general')
  order by 2 desc, 1;
$$;

comment on function public.vocab_by_industry(uuid) is
  '業界別に、覚えた語と覚えかけの語を数える。業界は出会った教材のもの。';

-- ────────────────────────────────────────────────────────────────
-- 6. トレーナーが「見た」ことを残す
-- ────────────────────────────────────────────────────────────────
create or replace function public.note_wordbook_view(p_learner uuid)
returns void
language sql
volatile
set search_path = public
as $$
  insert into public.wordbook_views (learner_id, trainer_id, viewed_at)
  values (p_learner, auth.uid(), now())
  on conflict (learner_id, trainer_id) do update set viewed_at = now();
$$;

comment on function public.note_wordbook_view(uuid) is
  'トレーナーがそのゲストの単語帳を見たことを残す。ゲストの画面に出す。';

-- ────────────────────────────────────────────────────────────────
-- 7. 権限
-- ────────────────────────────────────────────────────────────────
grant execute on function public.mark_word(text, text, text, uuid, text, text) to authenticated;
grant execute on function public.vocab_week(uuid)                              to authenticated;
grant execute on function public.vocab_by_industry(uuid)                       to authenticated;
grant execute on function public.note_wordbook_view(uuid)                      to authenticated;


-- ============================================================================
-- ==== 0020_item_phonetic.sql ======================================
-- ============================================================================
-- 0020 単語・フレーズの教材に、発音記号を持たせる
--
-- 【なぜ要るか】(2026-08 利用者の指定)
--   > フレーズや単語、発音のトレーニングはすべて発音記号を表示してください。
--
--   発音の練習をする教材なのに、どう読むのかが書いていなかった。
--   お手本の音は鳴らせるが、**耳で聞いただけでは、どの音を出しているのかが
--   分からない。** 記号があれば「語尾に母音を足さない」のような注意も、
--   目で確かめられる。
--
-- 【なぜ教材に持たせるのか — 開くたびに引かない】
--   語の意味の控え(`word_glosses`)にも発音記号はある(0013)。
--   だが、あれは**1語ずつ**引くもので、
--   「draft the contract」のような**言い回しまるごと**は入っていない。
--
--   引いて回ると、1教材20項目 × 500人ぶんの呼び出しになる。
--   **教材を作る時点で一緒に作れば、1教材につき1回で済む。**
--   要点フレーズ(`phrases`、0015)と同じ考え方である。
--
--   費用も桁が違う。
--     ・教材を作るときに一緒に … 1項目あたり約10トークン。**1本 0.3 円ほど**
--     ・開くたびに引く         … 1項目あたり約200トークン。**1本 6 円ほど**
--
-- 【何をするか】
--   `material_items` に `phonetic`(発音記号)を1列足すだけ。
--   **表は増やさない。** 権限も既存のまま(教材の項目と同じ扱い)。
--
-- 【貼る前でも壊れない】
--   画面は `runTolerant()` が、まだ無い列を外して読み直す(第5.23節)。
--   貼る前は発音記号が出ないだけで、教材はこれまでどおり開ける。
-- ============================================================================

alter table public.material_items
  add column if not exists phonetic text;

comment on column public.material_items.phonetic is
  '発音記号(IPA)。単語・フレーズの教材で使う。スラッシュは含めず、'
  '中身だけを入れる(例: dræft ðə ˈkɑːntrækt)。画面が / / を付けて出す。';

-- ==== 0021_item_chunks.sql ========================================
-- ============================================================================
-- 0021 本文に「カタマリごとの訳」を持たせる(スラッシュリーディング)
--
-- 【なぜ要るか】(2026-08 利用者の指定)
--   > スラッシュリーディングの英文の下に日本語の訳がスラッシュに
--   > 分けて表示されているのが分かるはずです。
--   > 日本語訳にもスラッシュを入れ、英語の語順と同じように
--   > 直訳寄りの訳にして下さい。
--
--   利用者が実際に紙で配っている教材が、この形になっている。
--
--       どれくらいの長さですか / 乗っているのは
--       How long              / is the ride?
--
--   **英語の真下(この画面では真上)に、そのカタマリの訳を置く。**
--   前から順に訳す型を身につけるのが②の狙いなので、
--   文まるごとの自然な訳では役に立たない。訳の語順が英語と入れ替わり、
--   「このカタマリは何と言うのか」が分からないためである。
--
-- 【どこで切るかは、決まりで出す。AI に頼まない】
--   区切る場所は `src/lib/chunker.js` が閉じた語のリストで決めている。
--   ここで持つのは**訳の文字だけ**である。
--   **切る場所を DB に持たせない。** 決まりを直したときに、
--   教材の側が古い区切りを持っていると、画面の区切りと食い違う。
--
-- 【なぜ教材に持たせるのか — 開くたびに作らない】
--   カタマリの訳だけは決まりでは書けない(仕様書 第5.29.3節)。
--   AI に頼むしかないが、**開くたびに頼むと桁が変わる。**
--
--     ・教材を作るときに一緒に … 記事1本で **2〜3円**。1回きり
--     ・開くたびに作る         … 同じ2〜3円が、ゲスト500人 × 開いた回数
--
--   要点フレーズ(`phrases`、0015)・発音記号(`phonetic`、0020)と
--   同じ考え方である。
--
-- 【何を入れるか】
--   `material_items.chunks` に、その項目(段落 / 発言)ぶんを1つだけ。
--
--     {"en": "How long is the ride?", "ja": ["どれくらいの長さですか", "乗っているのは"]}
--
--   ・`en` … 作ったときの英文。**あとで英文を直したら、対が狂う。**
--     画面は `en` が今の本文と一致するときだけ訳を出す(食い違ったら出さない)
--   ・`ja` … **初級の区切り**で切ったカタマリの数と同じ数、同じ順。
--     中級・上級は区切りが減るだけなので、隣どうしをつないで作れる
--     (`src/lib/chunkJa.js`)。**3レベルぶんを持たない。** 費用が3倍になる
--
-- 【何をするか】
--   `material_items` に `chunks`(jsonb)を1列足すだけ。
--   **表は増やさない。** 権限も既存のまま(教材の項目と同じ扱い)。
--
-- 【貼る前でも壊れない】
--   画面は `runTolerant()` が、まだ無い列を外して読み直す(第5.23節)。
--   貼る前は訳が出ないだけで、教材はこれまでどおり開ける。
-- ============================================================================

alter table public.material_items
  add column if not exists chunks jsonb;

comment on column public.material_items.chunks is
  'スラッシュリーディングのカタマリごとの訳。'
  '{"en": 作ったときの英文, "ja": [カタマリごとの訳]}。'
  'ja は**初級の区切り**の数と同じ。中級・上級は画面がつないで作る。';

-- ==== 0022_practice_and_reminders.sql =============================
-- ============================================================================
-- 0022 取り組みを裏で記録し、トレーナーから「リマインド」を送れるようにする
--
-- 【設計の変更】(2026-08 利用者の指定)
--
--   > 集計や学習の記録はやっぱり必要ありません。というより設計を少し変更します。
--   > ゲストがアプリで取り組んだトレーニングや単語帳の情報は全てトレーナー側に
--   > 共有され、もう少しコンパクトに表示される仕組みにしてください。
--   > 回数や時間を裏で記録し、トレーナー側のゲストの情報に反映される仕組みです。
--   > そして、取り組んでいない場合はまるでトレーナーがリマインドしたかのように
--   > 通知がいく仕組みです。
--
--   これまでは**ゲストが自分で「何分やった」と入力する**画面(学習の記録)
--   だった。入力そのものが手間で、しかも入れ忘れる。
--   **やったことは、こちらが数える。** ゲストは何も入力しない。
--
-- 【リマインドは、トレーナーが押したときだけ飛ぶ】(利用者の指定)
--
--   > それはトレーナーがリマインドボタンを押した時のみ発動するようにしましょう。
--
--   自動では送らない。**実際にトレーナーが押している**ので、
--   ゲストに「トレーナーから」と出しても嘘にならない。
--
-- 【何を作るか】
--   ・`practice_days`     … 1人 × 1日 × 1種類 で1行。回数と秒
--   ・`log_practice()`    … 取り組むたびに足す(ゲスト本人だけ)
--   ・`learner_practice()`… 担当ゲストの取り組みをまとめて返す(トレーナー)
--   ・`reminders`         … トレーナーが送ったリマインド
--   ・`send_reminder()`   … 送る(担当ゲストにだけ)
--   ・`seen_reminder()`   … ゲストが見たことを残す
--
-- 【なぜ「日ごと × 種類ごと」で1行なのか】
--   1回ごとに行を作ると、ゲスト500人 × 1日数回 で年に数十万行になる。
--   **1人1日あたり多くても5行**(種類の数)に抑える。
--   `vocab_days`(0019)と同じ考え方である。
--
-- 【何を記録しないか】
--   **録音そのものは、これまでどおりサーバーに送らない**(仕様書 3.2)。
--   ここに入るのは「いつ・何を・何回・何秒」だけである。
--
-- 【貼る前でも壊れない】
--   画面は、この表と関数が無いときは**静かに何もしない。**
--   記録が付かないだけで、教材も宿題も単語帳もこれまでどおり動く
--   (第5.23節「貼る前でも動く道を残す」)。
--
-- 【何度実行してもよい】
-- ============================================================================

-- ────────────────────────────────────────────────────────────────
-- 1. 取り組みの記録
-- ────────────────────────────────────────────────────────────────

create table if not exists public.practice_days (
  learner_id uuid    not null references auth.users(id) on delete cascade,
  done_on    date    not null default current_date,
  -- 何に取り組んだか。**画面側の名前と1対1**(src/lib/practice.js)
  --   homework / six_steps / quick_response / wordbook / pronunciation
  kind       text    not null,
  times      integer not null default 0,   -- 取り組んだ回数
  seconds    integer not null default 0,   -- かかった時間(秒)
  primary key (learner_id, done_on, kind)
);

comment on table public.practice_days is
  'ゲストが取り組んだ記録。1人 × 1日 × 1種類 で1行。'
  '**録音そのものは入らない**(端末の中だけ・仕様書 3.2)。';

alter table public.practice_days enable row level security;

drop policy if exists "取り組みは本人と担当トレーナーが見る" on public.practice_days;
create policy "取り組みは本人と担当トレーナーが見る" on public.practice_days
  for select to authenticated
  using (learner_id = auth.uid() or (public.is_admin() and public.teaches(learner_id)));

-- **書けるのは本人だけ。** しかも `log_practice()` を通す(下の grant を参照)
drop policy if exists "取り組みを書けるのは本人だけ" on public.practice_days;
create policy "取り組みを書けるのは本人だけ" on public.practice_days
  for all to authenticated
  using (learner_id = auth.uid()) with check (learner_id = auth.uid());

create index if not exists practice_days_learner_idx
  on public.practice_days (learner_id, done_on desc);

/**
 * 取り組みを1回ぶん足す。**呼べるのは本人だけ**(auth.uid() を使う)。
 *
 * 【上限を置く理由】
 *   画面の不具合や、開きっぱなしのまま放置した端末から
 *   とんでもない秒数が入ると、集計が丸ごと使えなくなる。
 *   **1回に足せるのは 1時間まで**にしておく。
 */
drop function if exists public.log_practice(text, integer, integer);
create or replace function public.log_practice(
  p_kind    text,
  p_seconds integer default 0,
  p_times   integer default 1
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_kind text := lower(trim(coalesce(p_kind, '')));
begin
  if auth.uid() is null then return; end if;
  -- **知らない種類は入れない。** 綴り違いで種類が増えていくのを防ぐ
  if v_kind not in ('homework', 'six_steps', 'quick_response', 'wordbook', 'pronunciation') then
    return;
  end if;

  insert into public.practice_days as d (learner_id, done_on, kind, times, seconds)
  values (
    auth.uid(), current_date, v_kind,
    least(greatest(coalesce(p_times, 0), 0), 100),
    least(greatest(coalesce(p_seconds, 0), 0), 3600)
  )
  on conflict (learner_id, done_on, kind) do update
    set times   = d.times + excluded.times,
        seconds = d.seconds + excluded.seconds;
end;
$$;

/**
 * 担当ゲストの取り組みを、まとめて1人1行で返す。
 *
 * **コンパクトに出すための材料**である(利用者の指定)。
 * 画面はこれをそのまま並べるだけでよく、数え方を画面に持たない。
 */
drop function if exists public.learner_practice(integer);
create or replace function public.learner_practice(p_days integer default 14)
returns table (
  learner_id   uuid,
  display_name text,
  last_on      date,      -- 最後に取り組んだ日
  days         integer,   -- 期間中に取り組んだ日数
  times        integer,   -- 期間中の回数
  seconds      integer,   -- 期間中の秒
  kinds        jsonb      -- 種類ごとの回数 {"wordbook": 12, ...}
)
language sql security definer set search_path = public as $$
  with span as (select current_date - greatest(coalesce(p_days, 14), 1) + 1 as from_on),
  mine as (
    select p.id, p.display_name
    from public.profiles p
    where p.role = 'learner' and public.teaches(p.id)
  )
  select
    m.id,
    m.display_name,
    max(d.done_on)::date,
    count(distinct d.done_on)::integer,
    coalesce(sum(d.times), 0)::integer,
    coalesce(sum(d.seconds), 0)::integer,
    coalesce(jsonb_object_agg(k.kind, k.times) filter (where k.kind is not null), '{}'::jsonb)
  from mine m
  left join public.practice_days d
    on d.learner_id = m.id and d.done_on >= (select from_on from span)
  left join lateral (
    select d2.kind, sum(d2.times)::integer as times
    from public.practice_days d2
    where d2.learner_id = m.id and d2.done_on >= (select from_on from span)
    group by d2.kind
  ) k on true
  group by m.id, m.display_name
  order by max(d.done_on) desc nulls last, m.display_name;
$$;

-- ────────────────────────────────────────────────────────────────
-- 2. リマインド
-- ────────────────────────────────────────────────────────────────
--
-- **トレーナーが押したときだけ入る。** 自動では作らない。
-- だからゲストの画面に「トレーナーから」と出しても嘘にならない。

create table if not exists public.reminders (
  id         uuid primary key default gen_random_uuid(),
  learner_id uuid not null references auth.users(id) on delete cascade,
  sent_by    uuid not null references auth.users(id),
  sent_at    timestamptz not null default now(),
  message    text,
  seen_at    timestamptz
);

comment on table public.reminders is
  'トレーナーが送ったリマインド。**押したときだけ入る**(自動では作らない)。';

alter table public.reminders enable row level security;

drop policy if exists "リマインドは本人と担当トレーナーが見る" on public.reminders;
create policy "リマインドは本人と担当トレーナーが見る" on public.reminders
  for select to authenticated
  using (learner_id = auth.uid() or (public.is_admin() and public.teaches(learner_id)));

drop policy if exists "リマインドを送れるのは担当トレーナーだけ" on public.reminders;
create policy "リマインドを送れるのは担当トレーナーだけ" on public.reminders
  for insert to authenticated
  with check (public.is_admin() and public.teaches(learner_id) and sent_by = auth.uid());

-- **ゲストが変えられるのは「見た」だけ。**
-- 行だけ絞っても列は絞れないので、列単位の grant を併せる(第3.3.1節)
drop policy if exists "見たことは本人が残せる" on public.reminders;
create policy "見たことは本人が残せる" on public.reminders
  for update to authenticated
  using (learner_id = auth.uid()) with check (learner_id = auth.uid());

revoke update on public.reminders from authenticated;
grant update (seen_at) on public.reminders to authenticated;

create index if not exists reminders_learner_idx
  on public.reminders (learner_id, sent_at desc);

/** リマインドを送る。**担当ゲストにだけ。** 返すのは作った行の id */
drop function if exists public.send_reminder(uuid, text);
create or replace function public.send_reminder(
  p_learner_id uuid,
  p_message    text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not (public.is_admin() and public.teaches(p_learner_id)) then
    raise exception 'このゲストにリマインドを送る権限がありません';
  end if;
  insert into public.reminders (learner_id, sent_by, message)
  values (p_learner_id, auth.uid(), nullif(trim(coalesce(p_message, '')), ''))
  returning id into v_id;
  return v_id;
end;
$$;

/** ゲストが見たことを残す。**自分あてのものだけ** */
drop function if exists public.seen_reminder(uuid);
create or replace function public.seen_reminder(p_id uuid) returns void
language sql security definer set search_path = public as $$
  update public.reminders
     set seen_at = now()
   where id = p_id and learner_id = auth.uid() and seen_at is null;
$$;

-- ────────────────────────────────────────────────────────────────
-- 3. 呼べる人を絞る
-- ────────────────────────────────────────────────────────────────
grant execute on function public.log_practice(text, integer, integer)  to authenticated;
grant execute on function public.learner_practice(integer)             to authenticated;
grant execute on function public.send_reminder(uuid, text)             to authenticated;
grant execute on function public.seen_reminder(uuid)                   to authenticated;


-- ============================================================================
-- 0023 集計を「教材の種類と内容」で数え直す
--
-- 【なぜ作り直すのか】(2026-08 利用者の指定)
--
--   > 集計だけは残してください。しかし今のままでは見にくすぎるので、
--   > 教材の種類と内容に準じたものに変えてください。
--
--   これまでの集計は **`study_logs`(ゲストが自分で入力した学習時間)**の上に
--   立っていた。その入力欄は 0022 の設計変更で無くなっている
--   (「回数や時間を裏で記録し」)。**入らなくなった数字を並べ続けると、
--   いつまでも 0 のグラフが出る。** 数えるものを、いま実際にあるものへ移す。
--
-- 【何で数えるか】
--   ・**種類**  … `materials.kind`(文型ドリル / リーディング / ダイアローグ /
--                 単語 / フレーズ)
--   ・**内容**  … `material_tags`(弱点)と `materials.level`(CEFR)
--   ・**届き方**… `assignments`(共有した回数と、ゲストが済ませた回数)
--   ・**取り組み**… `practice_days`(0022。裏で数えたもの)
--
-- 【管理者だけが見る】
--   `is_owner()` が偽なら**1行も返さない。** CLAUDE.md の
--   「管理者 — 全体の集計だけを見る」に合わせる。
--   security definer なので、この判定を外すと全校のデータが漏れる。
--   **判定を消さないこと。**
--
-- 【教材が0件の弱点も返す】
--   ここがいちばん見たいところである。**ライブラリの穴**(まだ1本も無い弱点)は、
--   0 の行が出て初めて分かる。`weakness_tags` から left join する。
--
-- 【何度実行してもよい】
--   返す列を変える関数は、先に `drop function if exists` を置いてある
--   (置かないと `cannot change return type of existing function` で止まる)。
-- ============================================================================

-- ────────────────────────────────────────────────────────────────
-- 1. 全体の数(school_summary を、いまあるもので数え直す)
--
--   0002 → 0004 と作り替えてきたもの。0004 の版は最後の欄が
--   `avg_minutes_weekly`(study_logs の合計)で、**もう何も入らない。**
--   代わりに 0022 の `practice_days` から「1人あたり週◯分」を出す。
--   `attempt_count`(発音の仮スコア)も外す。**測っていないものは数えない。**
-- ────────────────────────────────────────────────────────────────
drop function if exists public.school_summary(date, date);
create or replace function public.school_summary(
  from_date date default (current_date - 30),
  to_date   date default current_date
)
returns table (
  trainer_count       integer,   -- 在籍中のトレーナー
  learner_active      integer,   -- 受講中
  learner_paused      integer,   -- 休会中
  learner_withdrawn   integer,   -- 退会済
  material_count      integer,   -- ライブラリ全体(発行済み)
  material_new        integer,   -- 期間中に作られた教材
  assigned_count      integer,   -- 期間中に共有した回数
  done_count          integer,   -- うち、ゲストが済ませた回数
  done_rate           numeric,   -- 達成率(%)
  practice_minutes_weekly numeric -- 受講中のゲスト1人あたり、週◯分
)
language sql stable security definer set search_path = public as $$
  select
    (select count(*)::integer from profiles where role = 'trainer' and status = 'active'),
    (select count(*)::integer from profiles where role = 'learner' and status = 'active'),
    (select count(*)::integer from profiles where role = 'learner' and status = 'paused'),
    (select count(*)::integer from profiles where role = 'learner' and status = 'inactive'),
    (select count(*)::integer from materials where status = 'published'),
    (select count(*)::integer from materials
      where created_at::date between from_date and to_date),
    (select count(*)::integer from assignments
      where assigned_at::date between from_date and to_date),
    (select count(*)::integer from assignments
      where assigned_at::date between from_date and to_date and learner_done_at is not null),
    (select round(100.0 * count(*) filter (where learner_done_at is not null)
                  / nullif(count(*), 0), 1)
       from assignments where assigned_at::date between from_date and to_date),
    (select round(coalesce(sum(seconds), 0)::numeric / 60.0
                  / nullif((select count(*) from profiles
                            where role = 'learner' and status = 'active'), 0)
                  / nullif((to_date - from_date + 1) / 7.0, 0), 1)
       from practice_days where done_on between from_date and to_date)
  where public.is_owner();
$$;

-- ────────────────────────────────────────────────────────────────
-- 2. 教材の「種類」ごと
--
--   ライブラリに何がどれだけあり、そのうち実際に配られているのはどれか。
--   **作った数と配った数は別物**である(CLAUDE.md「配る数と新しく作る数を
--   混同しない」)。両方を並べて出す。
-- ────────────────────────────────────────────────────────────────
drop function if exists public.school_by_kind(integer);
create or replace function public.school_by_kind(p_days integer default 30)
returns table (
  kind       text,
  materials  integer,   -- ライブラリ全体(発行済み)
  fresh      integer,   -- 期間中に作られた数
  items      integer,   -- 中の項目の数(問・段落・発言)
  assigned   integer,   -- 期間中に共有した回数
  done       integer    -- うち、ゲストが済ませた回数
)
language sql stable security definer set search_path = public as $$
  with span as (select current_date - greatest(coalesce(p_days, 30), 1) + 1 as from_on),
  -- 教材1本につき1行にしてから足す。**先にまとめないと、
  -- 共有が2回ある教材が2本に数えられる**(join で行が増えるため)
  per as (
    select
      m.id, m.kind, m.status, m.created_at,
      (select count(*) from material_items i where i.material_id = m.id) as items,
      (select count(*) from assignments a
        where a.material_id = m.id
          and a.assigned_at::date >= (select from_on from span))            as assigned,
      (select count(*) from assignments a
        where a.material_id = m.id
          and a.assigned_at::date >= (select from_on from span)
          and a.learner_done_at is not null)                                as done
    from materials m
  )
  select
    per.kind,
    count(*) filter (where per.status = 'published')::integer,
    count(*) filter (where per.created_at::date >= (select from_on from span))::integer,
    coalesce(sum(per.items), 0)::integer,
    coalesce(sum(per.assigned), 0)::integer,
    coalesce(sum(per.done), 0)::integer
  from per
  where public.is_owner()
  group by per.kind
  order by 2 desc, per.kind;
$$;

-- ────────────────────────────────────────────────────────────────
-- 3. 教材の「内容」= 弱点ごと
--
--   **1本も無い弱点も返す。** ここが穴である。
--   教材が無い弱点は、レッスンで指摘しても宿題が出せない。
-- ────────────────────────────────────────────────────────────────
drop function if exists public.school_by_tag(integer);
create or replace function public.school_by_tag(p_days integer default 30)
returns table (
  tag_id     text,
  label      text,
  category   text,
  materials  integer,   -- その弱点が付いた教材(発行済み)
  assigned   integer,   -- 期間中に共有した回数
  done       integer
)
language sql stable security definer set search_path = public as $$
  with span as (select current_date - greatest(coalesce(p_days, 30), 1) + 1 as from_on)
  select
    t.id, t.label, t.category,
    count(distinct m.id) filter (where m.status = 'published')::integer,
    count(a.id) filter (where a.assigned_at::date >= (select from_on from span))::integer,
    count(a.id) filter (where a.assigned_at::date >= (select from_on from span)
                          and a.learner_done_at is not null)::integer
  from weakness_tags t
  left join material_tags mt on mt.tag_id = t.id
  left join materials    m   on m.id = mt.material_id
  left join assignments  a   on a.material_id = m.id
  where public.is_owner() and t.kind = 'weakness'
  group by t.id, t.label, t.category, t.sort_order
  order by t.sort_order, t.id;
$$;

-- ────────────────────────────────────────────────────────────────
-- 4. レベルごと(教材の数と、そのレベルのゲストの数)
--
--   **需要と供給のずれ**が見える。ゲストが多いレベルに教材が無ければ、
--   そこから作ればよい。数字が2つ並んで初めて分かる。
-- ────────────────────────────────────────────────────────────────
drop function if exists public.school_by_level(integer);
create or replace function public.school_by_level(p_days integer default 30)
returns table (
  level      text,
  materials  integer,
  learners   integer
)
language sql stable security definer set search_path = public as $$
  -- **並び順は 14 段階のとおり。** 文字の順に並べると A1+ が A2 の後に来る
  with order_of as (
    select t.level, t.pos from unnest(array[
      'Pre-Basic', 'Basic',
      'A1', 'A1+', 'A2', 'A2+',
      'B1', 'B1+', 'B2', 'B2+',
      'C1', 'C1+', 'C2',
      'Proficiency'
    ]) with ordinality as t(level, pos)
  ),
  lv as (
    select distinct m.level from materials m where m.level is not null
    union
    select distinct p.cefr from profiles p
     where p.role = 'learner' and p.status = 'active' and p.cefr is not null
  )
  select
    lv.level,
    (select count(*)::integer from materials m
      where m.level = lv.level and m.status = 'published'),
    (select count(*)::integer from profiles p
      where p.role = 'learner' and p.status = 'active' and p.cefr = lv.level)
  from lv
  left join order_of o on o.level = lv.level
  where public.is_owner()
  order by coalesce(o.pos, 99), lv.level;
$$;

-- ────────────────────────────────────────────────────────────────
-- 5. 取り組み(0022)を、種類ごとに全校で数える
--
--   `learner_practice()`(0022)は**担当ゲストだけ**を返す。あれはトレーナー用。
--   こちらは管理者用で、**学校ぜんぶ**を種類ごとにまとめる。
-- ────────────────────────────────────────────────────────────────
drop function if exists public.school_practice(integer);
create or replace function public.school_practice(p_days integer default 30)
returns table (
  kind     text,
  learners integer,   -- その種類に取り組んだ人数
  times    integer,
  seconds  integer
)
language sql stable security definer set search_path = public as $$
  with span as (select current_date - greatest(coalesce(p_days, 30), 1) + 1 as from_on)
  select
    d.kind,
    count(distinct d.learner_id)::integer,
    coalesce(sum(d.times), 0)::integer,
    coalesce(sum(d.seconds), 0)::integer
  from practice_days d
  where public.is_owner() and d.done_on >= (select from_on from span)
  group by d.kind
  order by 3 desc, d.kind;
$$;

-- ────────────────────────────────────────────────────────────────
-- 6. 呼べる人を絞る
--
--   `authenticated` に execute を渡すが、**関数の中で `is_owner()` を見る。**
--   トレーナーやゲストが呼んでも 0 行しか返らない。
-- ────────────────────────────────────────────────────────────────
grant execute on function public.school_summary(date, date)  to authenticated;
grant execute on function public.school_by_kind(integer)     to authenticated;
grant execute on function public.school_by_tag(integer)      to authenticated;
grant execute on function public.school_by_level(integer)    to authenticated;
grant execute on function public.school_practice(integer)    to authenticated;
