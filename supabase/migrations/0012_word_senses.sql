-- ============================================================================
-- English AI System — 語の意味を「文脈ごとに、複数」持てるようにする
--
-- 【なぜ必要か】
--   0011 では語1つにつき意味を1つだけ控えていた。しかし run は
--   「走る」とは限らない。利用者から
--   「文脈で優先となる意味を先頭に置いてほしい。『走る』の意味になる
--   文脈では『走る』を先頭に大きめに、『運営する』『走らせる』を
--   二番目以降に少し小さめに」と指定があった(2026-08)。
--
-- 【どう変えるか】
--   控えの鍵を **(語, 出てきた文) の組**にする。
--   同じ語でも、出てきた文が違えば別の控えになり、それぞれの文脈で
--   ふさわしい順に意味が並ぶ。
--
--   ・意味は `senses`(JSON の配列)に、**ふさわしい順**で入る
--     [{ pos, meaning_ja, example_en, note }, …] 1〜4件
--   ・文は長さがまちまちなので、そろえた文の**短い指紋**を鍵にする
--     (指紋の作り方は Edge Function 側にある。SHA-256 の先頭16文字)
--
-- 【費用はどうなるか】
--   同じ教材の同じ文に出る語は、**最初の1人が触れたときだけ**費用がかかり、
--   以後は誰が触れても無料である。教材はスクール全体で共有しているので、
--   よく使う教材ほど早く無料になる。
--   別の文に出てきた同じ語は、そのとき一度だけ引き直す(およそ 0.001 円)。
--
-- 【0011 を実行済みでも、未実行でも通る】
--   列を足し、既にある1件を配列に移し、主キーを付け替えるだけ。
--   **何度実行してもよい。**
-- ============================================================================

-- ────────────────────────────────────────────────────────────────
-- 1. 列を足す
--
--   古い列(pos / meaning_ja / example_en / note)は**消さない。**
--   先頭の意味をそのまま入れておく。0011 の時点で作った控えが
--   読めなくなるのを避けるためと、SQL から中身を眺めやすくするため。
-- ────────────────────────────────────────────────────────────────
alter table public.word_glosses
  add column if not exists context_key text not null default '',
  add column if not exists senses      jsonb not null default '[]'::jsonb;

comment on column public.word_glosses.context_key is
  '出てきた文の指紋。空文字は「文脈の指定なし」。';
comment on column public.word_glosses.senses is
  '意味の並び。[{pos, meaning_ja, example_en, note}, …] 文脈にふさわしい順。';

-- 0011 で作った控えを配列に移す(まだ配列が空のものだけ)
update public.word_glosses
   set senses = jsonb_build_array(jsonb_build_object(
         'pos',        coalesce(pos, ''),
         'meaning_ja', coalesce(meaning_ja, ''),
         'example_en', coalesce(example_en, ''),
         'note',       coalesce(note, '')))
 where jsonb_array_length(senses) = 0
   and coalesce(meaning_ja, '') <> '';

-- ────────────────────────────────────────────────────────────────
-- 2. 主キーを (語, 文の指紋) に付け替える
--
--   すでに付け替わっていれば何もしない。
-- ────────────────────────────────────────────────────────────────
do $$
declare
  key_count int;
begin
  select array_length(conkey, 1) into key_count
  from pg_constraint
  where conrelid = 'public.word_glosses'::regclass and contype = 'p';

  if key_count = 1 then
    alter table public.word_glosses drop constraint word_glosses_pkey;
    alter table public.word_glosses add primary key (word_norm, context_key);
  end if;
end $$;

-- 語だけで引くこともある(復習の一覧など)
create index if not exists word_glosses_word_idx
  on public.word_glosses (word_norm);

-- ────────────────────────────────────────────────────────────────
-- 3. 復習の一覧は、語ごとに1件だけ拾う
--
--   0012 で同じ語の控えが複数になったため、そのまま結合すると
--   **同じ語が何度も並ぶ。** 文脈の指定が無いものを優先し、
--   無ければどれか1件を使う。
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
    left join lateral (
      select gg.display, gg.pos, gg.meaning_ja
      from public.word_glosses gg
      where gg.word_norm = r.word_norm
      -- 文脈の指定が無いものを先に。同じ語で何件あっても1件だけ使う
      order by (gg.context_key <> '') , gg.created_at
      limit 1
    ) g on true
    where r.learner_id = p_learner
      and (p_status is null or r.status = p_status)
    order by r.updated_at desc
    limit greatest(1, least(coalesce(p_limit, 40), 200));
end;
$$;

grant execute on function public.review_words(uuid, text, int) to authenticated;
