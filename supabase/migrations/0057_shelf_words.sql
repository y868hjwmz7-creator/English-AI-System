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
