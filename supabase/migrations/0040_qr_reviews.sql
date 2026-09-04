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
