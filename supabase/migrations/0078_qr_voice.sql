-- ============================================================================
-- 0078 Quick Response の復習に「そのときの声」を持たせる
--
--   > A で良いです。復習はその時の声のキャラで構いません。
--   > その方が頭に残ります
--   (2026-10 利用者の指定・第5.446節)
--
-- 【何が困っていたか】
--   教材の中の Quick Response は、**本文とまったく同じ声**で鳴る
--   (第5.446節・②で、役ごとの割り振りを `quickResponsePairs()` に寄せた)。
--   ところが**復習の帳**(`qr_reviews`)には声を控える欄が無く、
--   溜めたあとは**いつも既定の声(us-female)**で鳴っていた。
--
--   ・会話から溜めた文が、**話していた人と違う声**で返ってくる
--   ・同じ英文なのに**置き場所が別**になるので、
--     教材の中で1本・復習でもう1本、**二度課金される**
--     (置き場所の鍵は `tts/<版>/<段>/<話者>/<英文の指紋>.mp3`)
--
-- 【何を足すか】
--   `qr_reviews` に2列だけ。**表も索引も増やさない。**
--     `clip_voice` … そのときの話者 id(`src/data/clipVoices.js` の id)
--     `clip_tier`  … そのときの段(`premium` / `standard`)
--
-- 【値の一覧は、ここに書かない】
--   `check (clip_tier in (…))` を置かない。**0066 とまったく同じ考え方**である。
--   段を1つ増やすたびに、利用者に SQL を貼り直してもらうことになる。
--   しかも**すでに行がある表では、狭い一覧で止まる**
--   (CLAUDE.md「空の表に貼るのは、試したことにならない」)。
--
-- 【いまある行は、埋めない(`null` のまま)】
--   **どの声で鳴っていたかを、こちらは知らない。**
--   `default 'us-female'` と書くのは**推測を事実として書くこと**である
--   (0066 が `'sentence'` で埋められたのは、**溜めていたのが文章だけ**だと
--   コードから分かっていたからで、あれは推測ではない)。
--
--   `null` の行をどう鳴らすかは **画面側の `qrVoiceOf()` 1か所**が決める
--   (`src/lib/qrReviews.js`)。だから `qr_items()` は
--   **教材にえらばれていた声(`materials.voice_ids`)も一緒に返す。**
--   そうすれば、古い行も**その教材の1人目の声**で鳴り、
--   教材の中の Quick Response と置き場所がそろう(課金が1回で済む)。
--
-- 【あとから上書きしない】
--   `on conflict` では `coalesce(q.clip_voice, excluded.clip_voice)` にする。
--   **教材と話す人(`material_id` / `speaker`)とまったく同じ扱い**で、
--   **最初に出会ったときの声のまま**にする ——
--   利用者の指定そのもの(「その時の声のキャラで構いません」)である。
--   あとから別の教材で同じ文に出会っても、声は動かない。
--
-- 【何度貼っても安全】
--   列は `if not exists`、関数は `drop` してから作り直す。
--   **引数が増えるので、古い形を必ず落とす** —— 残すと PostgREST が
--   「どちらか分からない」と断り、画面から呼べなくなる(CLAUDE.md)。
--
-- 【触らないもの】
--   教材・宿題・ゲストの情報。単語帳。qr_days(続けた記録)。
--   **すでに作ってある音声も1本も捨てない**(置き場所の決まりは変えていない)。
-- ============================================================================

-- ────────────────────────────────────────────────────────────────
-- 1. 声と段の欄
-- ────────────────────────────────────────────────────────────────
alter table public.qr_reviews
  add column if not exists clip_voice text,
  add column if not exists clip_tier  text;

comment on column public.qr_reviews.clip_voice is
  '溜めたときに鳴っていた話者 id(0078)。入れるときだけ決まり、あとから動かない。'
  'id の一覧は src/data/clipVoices.js が持つ。ここには書かない ——'
  '声を1つ足した日に、この注記だけが古くなる。'
  'null は「分からない」。どう鳴らすかは qrVoiceOf()(src/lib/qrReviews.js)1か所が決める。';

comment on column public.qr_reviews.clip_tier is
  '溜めたときの段(0078)。premium(ElevenLabs)/ standard(Google・Azure)。'
  '決めるのは voiceTierFor()(src/lib/voiceTier.js)1か所。一覧はここに書かない。';

-- **索引は足さない。** 声で絞って引くことはない(出す順は due_on と box で決まる)。
-- 要らない索引は、入れるたびに書き込みを遅くするだけである。

-- ────────────────────────────────────────────────────────────────
-- 2. mark_qr() — 溜めるときに、そのときの声も控える
--
--   **引数が2つ増える。** 古い形(7引数・8引数)を必ず落とす ——
--   残すと PostgREST がどちらを呼べばよいか分からなくなる。
--   **新しい形(10引数)も落とす** —— このファイルを貼り直したときに
--   返す列を変えていても止まらないようにするため
--   (CLAUDE.md「関数を作り直すファイルは、返す列を変えていなくても drop を置く」)。
-- ────────────────────────────────────────────────────────────────
drop function if exists public.mark_qr(text, text, text, uuid, text, uuid, boolean);
drop function if exists public.mark_qr(text, text, text, uuid, text, uuid, boolean, text);
drop function if exists public.mark_qr(text, text, text, uuid, text, uuid, boolean, text, text, text);

create or replace function public.mark_qr(
  p_en            text,
  p_ja            text,
  p_status        text default 'unknown',
  p_material      uuid default null,
  p_speaker       text default null,
  p_learner       uuid default null,
  -- true なら、**すでに溜まっている文だけ**を動かす(新しく溜めない)
  p_only_existing boolean default false,
  -- **どの冊に溜めるか**(0066)。`'sentence'`(自分の Quick Response 帳)/
  -- `'chunk'`(覚えておきたい表現集)。**一覧はここに書かない**
  p_source        text default 'sentence',
  -- ★ **そのときの声と段**(0078)。渡さなければ `null`(「分からない」)。
  --   **一覧はここに書かない** —— 声を1つ足すたびに貼り直すことになる
  p_clip_voice    text default null,
  p_clip_tier     text default null
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

  /* **続けた記録を1つ増やす**(0042)。
       `mark_word()` が `vocab_days` を増やしているのと同じ形。

       **「思い出せたか」で数える。**「言える」を押したときが correct で、
       「まだ」は数に入らない(`vocab_days.correct` と同じ考え方)。
       **「もう出さない」(known)は、答えたことにしない** ——
       あれは片づける操作であって、練習ではない。 */
  if p_status <> 'known' then
    insert into public.qr_days as d (learner_id, done_on, answered, correct)
    values (v_who, current_date, 1, case when p_status = 'learning' then 1 else 0 end)
    on conflict (learner_id, done_on) do update
      set answered = d.answered + 1,
          correct  = d.correct + case when p_status = 'learning' then 1 else 0 end;
  end if;

  return query
  insert into public.qr_reviews as q
    (learner_id, en_norm, en, ja, material_id, speaker,
     status, box, learn_streak, due_on, updated_at, source,
     clip_voice, clip_tier)
  values
    (v_who, v_norm, v_en, v_ja, p_material, nullif(btrim(coalesce(p_speaker, '')), ''),
     p_status, v_box, v_streak, current_date + v_days, now(),
     coalesce(nullif(btrim(coalesce(p_source, '')), ''), 'sentence'),
     -- ★ 空文字は `null` にそろえる(「分からない」と同じ扱いにする・0078)
     nullif(btrim(coalesce(p_clip_voice, '')), ''),
     nullif(btrim(coalesce(p_clip_tier, '')), ''))
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
        -- **冊は動かさない**(0066)。教材と話す人とまったく同じ扱いで、
        --   **最初に出会ったときの冊のまま**にする。
        --   途中で移すと、ゲストが溜めた冊から黙って消える
        -- ★ **声と段も動かさない**(0078)。利用者の指定
        --   「復習はその時の声のキャラで構いません。その方が頭に残ります」。
        --   ただし **`null`(分からない)のところだけは埋める** ——
        --   0078 を貼る前に溜まった行が、次に答えた日に声を持てる
        clip_voice   = coalesce(q.clip_voice, excluded.clip_voice),
        clip_tier    = coalesce(q.clip_tier, excluded.clip_tier),
        updated_at   = now()
  returning q.en_norm, q.status, q.box, q.due_on;
end;
$$;

comment on function public.mark_qr(text, text, text, uuid, text, uuid, boolean, text, text, text) is
  'Quick Response の文に「まだ / 言える」を付け、次に出す日を決める(0040)。'
  '間隔の決まりは単語帳(mark_word・0038)とまったく同じ。'
  '答えるたびに qr_days を1つ増やす(0042)。'
  'p_only_existing = true なら、すでに溜まっている文だけを動かす。'
  'p_learner を渡すと、担当しているゲストの記録として残す(0025 と同じ)。'
  'p_source は溜める冊(0066)。入れるときだけ効き、あとから移らない。'
  'p_clip_voice / p_clip_tier は、そのときに鳴っていた声と段(0078)。'
  '最初に出会ったものを残す(null のところだけ、あとから埋まる)。';

revoke all on function
  public.mark_qr(text, text, text, uuid, text, uuid, boolean, text, text, text) from public;
grant execute on function
  public.mark_qr(text, text, text, uuid, text, uuid, boolean, text, text, text)
  to authenticated;

-- ────────────────────────────────────────────────────────────────
-- 3. qr_items() — 声と段も返す
--
--   0066 の中身のまま、**返す列を3つ**足す。引数は1つも増やさない。
--
--   `material_voice_ids` を一緒に返すのは、**0078 より前に溜まった行**の
--   ためである。あちらは `clip_voice` が `null` なので、
--   画面の `qrVoiceOf()` が**その教材の1人目の声**に落とす ——
--   そうすれば教材の中の Quick Response と置き場所がそろい、
--   **すでに作ってある音声がそのまま鳴る**(課金が増えない)。
-- ────────────────────────────────────────────────────────────────
drop function if exists public.qr_items(uuid, text, int, boolean);
drop function if exists public.qr_items(uuid, text, int, boolean, text);

create or replace function public.qr_items(
  p_learner  uuid,
  p_status   text    default 'todo',
  p_limit    int     default 200,
  p_due_only boolean default false,
  -- **どの冊を読むか**(0066)。`null` なら**ぜんぶ**(これまでどおり)
  p_source   text    default null
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
  material_scene    text,
  material_level    text,
  -- どの冊のものか(0066)
  source            text,
  -- ★ 溜めたときの声と段(0078)
  clip_voice        text,
  clip_tier         text,
  -- ★ その教材にえらばれていた声(0078)。**声を持たない古い行の落ち先**
  material_voice_ids text[]
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
           q.material_id, m.title, m.industry, m.kind, m.genre, m.scene, m.level,
           q.source,
           q.clip_voice, q.clip_tier, m.voice_ids
      from public.qr_reviews q
      -- **教材が消えていても文は残す。** 絞り込みの手がかりが減るだけ
      left join public.materials m on m.id = q.material_id
     where q.learner_id = p_learner
       and (p_status is null
            or (p_status = 'todo' and q.status in ('unknown', 'learning'))
            or q.status = p_status)
       and (not p_due_only or q.due_on <= current_date)
       -- **冊で絞る**(0066)。渡さなければ、これまでどおりぜんぶ返す
       and (p_source is null or q.source = p_source)
     -- **まだ を先に、言えかけ を次に**(単語帳と同じ)
     order by (q.status = 'learning'), q.due_on, q.box, q.updated_at desc
     -- **上限は `qr_limit()` 1か所**(0062)。ここに数字を書かない
     limit greatest(1, least(coalesce(p_limit, 200), public.qr_limit()));
end;
$$;

comment on function public.qr_items(uuid, text, int, boolean, text) is
  'Quick Response の復習に出す文(0040 / 0048 / 0062)。'
  '上限は qr_limit() から読む。本人・担当トレーナー・管理者だけが呼べる。'
  'p_source で冊を絞る(0066)。渡さなければぜんぶ返す。'
  '溜めたときの声と段(clip_voice / clip_tier)も返す(0078)。'
  '声を持たない古い行のために、その教材の voice_ids も一緒に返す。';

grant execute on function public.qr_items(uuid, text, int, boolean, text) to authenticated;

-- ============================================================================
-- 完了。
--
-- 【確かめかた】
--   select count(*) as ぜんぶ,
--          count(clip_voice) as 声を控えたもの
--     from public.qr_reviews;
--   → 貼った直後は「声を控えたもの」が 0 です。**それで正しい状態です**
--     (これから溜める文と、これから答える文に入っていきます)。
-- ============================================================================
