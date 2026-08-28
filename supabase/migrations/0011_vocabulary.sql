-- ============================================================================
-- English AI System — 語彙の定着(意味の表示 / 知っている・知らない / 復習)
--
-- 【なぜ必要か】
--   宿題は毎週出るが、そこに出てきた語がそのまま流れていく。
--   利用者から「出てくる単語を効果的に復習して習得に導く仕組みが欲しい」
--   「単語の教材を作るとき、これまでの宿題から体系立てて混ぜたい」
--   「本文の語に触れると意味と品詞が出て、知っていた / 知らなかったを
--   選べるようにしたい」と要望があった(2026-08)。
--
-- 【どうやるか】3つの表を足す
--
--   1. word_glosses  … 語の意味と品詞の**共有の控え**。
--      同じ語を何度も AI に尋ねないための置き場である。
--      スクール全体で1つ。一度引けば、以後は誰が触れても無料で出る。
--      **書き込むのは Edge Function だけ**(service_role)。
--      画面からは読むだけ。勝手な語を混ぜられないようにするため。
--
--   2. word_reviews  … ゲストごとの「知っていた / 知らなかった」。
--      これが復習の材料になる。ゲスト本人が付け、担当トレーナーが読む。
--
--   3. review_words() … トレーナーが「このゲストの復習すべき語」を
--      まとめて取り出すための関数。教材を作る画面から呼ぶ。
--
-- 【何を消すか】
--   何も消さない。表と関数を足すだけ。**何度実行してもよい。**
--
-- 【気をつけたこと】
--   語は必ず `norm_word()` でそろえてから鍵にする。
--   "Running" と "running" と "running," を別の語として数えない。
--   ただし**原形には戻さない**(runs → run のような処理はしない)。
--   戻すには辞書が要り、間違えると別の語の意味が出てしまう。
-- ============================================================================

-- ────────────────────────────────────────────────────────────────
-- 1. 語のそろえ方
--
--   小文字にし、前後の記号を落とすだけ。中の「'」と「-」は残す
--   (don't / well-known は、そのまま1語として扱う)。
-- ────────────────────────────────────────────────────────────────
create or replace function public.norm_word(t text)
returns text
language sql
immutable
as $$
  -- ① 小文字にする ② 英数字と「'」「-」以外を空白にする
  -- ③ 前後の空白・「'」「-」を落とす(「---」のような記号だけの塊を語にしない)
  select nullif(
    btrim(
      regexp_replace(lower(coalesce(t, '')), '[^a-z0-9''-]+', ' ', 'g'),
      ' ''-'
    ),
  '');
$$;

comment on function public.norm_word(text) is
  '語をそろえる。小文字にして前後の記号を落とす。原形には戻さない。';

-- ────────────────────────────────────────────────────────────────
-- 2. 語の意味と品詞(スクール全体で共有する控え)
-- ────────────────────────────────────────────────────────────────
create table if not exists public.word_glosses (
  word_norm   text primary key,
  display     text not null,             -- 見出しとして出す形
  pos         text not null,             -- 品詞(日本語。名詞 / 動詞 など)
  meaning_ja  text not null,             -- 意味(日本語)
  example_en  text,                      -- 短い例文
  note        text,                      -- 使いどころの注意
  created_at  timestamptz not null default now()
);

comment on table public.word_glosses is
  '語の意味と品詞の共有の控え。書き込むのは Edge Function(lookup-word)だけ。';

-- ────────────────────────────────────────────────────────────────
-- 3. ゲストごとの「知っていた / 知らなかった」
-- ────────────────────────────────────────────────────────────────
create table if not exists public.word_reviews (
  learner_id  uuid not null references public.profiles(id) on delete cascade,
  word_norm   text not null,
  status      text not null check (status in ('known', 'unknown')),
  -- どの教材で出会ったか。復習の教材を作るときの手がかりにする
  material_id uuid references public.materials(id) on delete set null,
  updated_at  timestamptz not null default now(),
  primary key (learner_id, word_norm)
);

comment on table public.word_reviews is
  'ゲストごとの語の状態。unknown が復習の材料になる。';

create index if not exists word_reviews_unknown_idx
  on public.word_reviews (learner_id, status, updated_at desc);

-- ────────────────────────────────────────────────────────────────
-- 4. RLS
--
--   word_glosses … 読むのは全員。**書き込みは誰にも許さない。**
--     Edge Function は service_role で入るので RLS を通らない。
--     画面から勝手な意味を書き込めないようにするため、
--     insert / update / delete のポリシーを1つも作らない。
--
--   word_reviews … 自分の行はゲスト本人が読み書きできる。
--     担当トレーナーと owner は読める。**書き換えはできない。**
--     「知っていた」はゲスト本人の申告であり、他人が上書きするものではない。
-- ────────────────────────────────────────────────────────────────
alter table public.word_glosses enable row level security;
alter table public.word_reviews enable row level security;

drop policy if exists word_glosses_read on public.word_glosses;
create policy word_glosses_read on public.word_glosses
  for select to authenticated
  using (true);

drop policy if exists word_reviews_own_read on public.word_reviews;
create policy word_reviews_own_read on public.word_reviews
  for select to authenticated
  using (
    learner_id = auth.uid()
    or public.teaches(learner_id)
    or public.is_owner()
  );

drop policy if exists word_reviews_own_write on public.word_reviews;
create policy word_reviews_own_write on public.word_reviews
  for insert to authenticated
  with check (learner_id = auth.uid());

drop policy if exists word_reviews_own_update on public.word_reviews;
create policy word_reviews_own_update on public.word_reviews
  for update to authenticated
  using (learner_id = auth.uid())
  with check (learner_id = auth.uid());

drop policy if exists word_reviews_own_delete on public.word_reviews;
create policy word_reviews_own_delete on public.word_reviews
  for delete to authenticated
  using (learner_id = auth.uid());

grant select on public.word_glosses to authenticated;
grant select, insert, update, delete on public.word_reviews to authenticated;

-- ────────────────────────────────────────────────────────────────
-- 5. トレーナーが復習の材料を取り出す
--
--   「このゲストが知らなかった語」を、意味付きで新しい順に返す。
--   教材を作る画面から呼び、単語の教材に混ぜる。
--
--   **security definer にしてある。** トレーナーは word_reviews を
--   読めるが、word_glosses との結合を1回で済ませるためここにまとめる。
--   関数の入口で「担当しているゲストか」を必ず確かめる。
-- ────────────────────────────────────────────────────────────────
create or replace function public.review_words(
  p_learner uuid,
  p_status  text default 'unknown',
  p_limit   int  default 40
)
returns table (
  word_norm  text,
  display    text,
  pos        text,
  meaning_ja text,
  status     text,
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
           coalesce(g.pos, ''),
           coalesce(g.meaning_ja, ''),
           r.status,
           r.updated_at
    from public.word_reviews r
    left join public.word_glosses g on g.word_norm = r.word_norm
    where r.learner_id = p_learner
      and (p_status is null or r.status = p_status)
    order by r.updated_at desc
    limit greatest(1, least(coalesce(p_limit, 40), 200));
end;
$$;

comment on function public.review_words(uuid, text, int) is
  'ゲストの「知らなかった語」を意味付きで返す。担当外は拒否する。';

grant execute on function public.norm_word(text)          to authenticated;
grant execute on function public.review_words(uuid, text, int) to authenticated;

-- ────────────────────────────────────────────────────────────────
-- 6. これまでの宿題に出てきた語
--
--   単語の教材を作るとき、「そのゲストが実際に触れた語」から選びたい。
--   配信済みの教材の中の、語句(vocab_note / vocabulary / phrase)を集める。
--
--   **本文の中の語まではここでは拾わない。** 拾うと数万語になり、
--   何を復習すべきかが決まらない。本文の語は、ゲストが触れて
--   「知らなかった」と付けたものだけが word_reviews に入る。
-- ────────────────────────────────────────────────────────────────
create or replace function public.homework_words(
  p_learner uuid,
  p_limit   int default 200
)
returns table (
  word_norm  text,
  display    text,
  meaning_ja text,
  seen_at    timestamptz,
  status     text
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
    raise exception '担当していないゲストの宿題の語は取得できません';
  end if;

  return query
    select public.norm_word(i.prompt_en) as word_norm,
           min(i.prompt_en)              as display,
           min(coalesce(i.prompt_ja, '')) as meaning_ja,
           max(a.assigned_at)            as seen_at,
           min(r.status)                 as status
    from public.assignments a
    join public.material_items i on i.material_id = a.material_id
    -- 演習の種類は 0007 以降 material_sections が持つ
    join public.material_sections s on s.id = i.section_id
    left join public.word_reviews r
           on r.learner_id = p_learner
          and r.word_norm = public.norm_word(i.prompt_en)
    where a.learner_id = p_learner
      and s.exercise_type in ('vocab_note', 'vocabulary', 'phrase')
      and public.norm_word(i.prompt_en) is not null
    group by public.norm_word(i.prompt_en)
    order by max(a.assigned_at) desc
    limit greatest(1, least(coalesce(p_limit, 200), 500));
end;
$$;

comment on function public.homework_words(uuid, int) is
  'これまで配信した教材に出てきた語句。単語の教材に混ぜるために使う。';

grant execute on function public.homework_words(uuid, int) to authenticated;
