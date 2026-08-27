-- ============================================================================
-- English AI System — 同じ英文を二度出さないための台帳
--
-- 【なぜ必要か】
--   これまでの重複防止は「生成する前に、使った英文をいくつか AI に見せて
--   避けさせる」だけだった。つまり AI が指示を守るかどうかに頼っていた。
--   守らなければ同じ文が出る。しかも渡せる数に上限があるため、教材が
--   増えるほど古い英文は渡されなくなり、素通りする。
--
--   同じゲストに同じ弱点の教材を続けて出す運用では、これでは足りない。
--   **AI の善意ではなく、データベース側の照合で保証する。**
--
-- 【何が変わるか】
--   1. norm_en() … 英文を突き合わせ用の形にそろえる
--      「I have work to do.」「i have work to do!」→ 同じ「i have work to do」
--   2. material_sentences … 教材に含まれる英文の台帳。設問が登録された
--      ときに自動で積まれる。既存の教材の分も入れ直す
--   3. used_sentences() … 候補の英文を渡すと、そのうち
--      「そのゲストに共有済み」または「同じ弱点のライブラリに既にある」
--      ものを返す。これで生成後に機械的にふるい落とせる
--
-- 【これで防げること・防げないこと】
--   防げる: 一字一句同じ文、記号や大文字小文字だけ違う文、
--           穴埋めの「___」を含む文とその解答文の一致
--   防げない: 意味が近いだけの別の文(I have work to do. / I have a job to do.)
--             ここは意味の近さを測る仕組みが要るため、今回は入れていない
--
-- 【既存のデータの扱い】
--   何も消さない。既にある設問から台帳を作り直すだけ。
--   何度実行してもよい(2回流しても結果は同じ)。
-- ============================================================================

-- ────────────────────────────────────────────────────────────────
-- 1. 突き合わせ用の形にそろえる
--
--   英数字以外(記号・空白・日本語)をすべて空白に潰し、小文字にする。
--   ・「Do you have anything to eat?」→「do you have anything to eat」
--   ・「I have several emails ___ to reply to.」→
--     「i have several emails to reply to」= その解答文と一致する。
--     穴埋めと和訳で同じ文が出るのも防げる
--   ・日本語だけの文字列は空になるので、台帳には載らない
--
--   画面側(src/lib/materials.js の normEn)と同じ規則にしてある。
--   片方だけ変えると、手元の判定とデータベースの判定がずれる。
-- ────────────────────────────────────────────────────────────────
create or replace function public.norm_en(t text)
returns text language sql immutable as $$
  select nullif(btrim(regexp_replace(lower(coalesce(t, '')), '[^a-z0-9]+', ' ', 'g')), '');
$$;

comment on function public.norm_en(text) is
  '英文を突き合わせ用の形にそろえる。記号と大文字小文字の違いを無視する';

-- ────────────────────────────────────────────────────────────────
-- 2. 英文の台帳
--
--   設問1つにつき、英語の欄(提示文・読み上げ文・解答)から
--   最大3つの英文が生まれる。そのすべてを載せる。
--   1つでも一致すれば「この文は前に出した」と判定するため。
-- ────────────────────────────────────────────────────────────────
create table if not exists public.material_sentences (
  material_id uuid not null references public.materials(id) on delete cascade,
  text_norm   text not null,
  primary key (material_id, text_norm)
);

create index if not exists material_sentences_norm_idx
  on public.material_sentences (text_norm);

comment on table public.material_sentences is
  '教材に含まれる英文(そろえた形)。同じ英文を二度出さないための照合に使う';

alter table public.material_sentences enable row level security;

-- 台帳そのものは教材ライブラリと同じ内容なので、トレーナーは見てよい。
-- ゲストには見せない(他のゲストの教材の英文まで見えてしまうため)。
drop policy if exists "トレーナーは英文の台帳を見る" on public.material_sentences;
create policy "トレーナーは英文の台帳を見る" on public.material_sentences
  for select to authenticated using (public.is_trainer());

-- 書き込みは下のトリガーだけが行う。画面からは触らせない。
revoke insert, update, delete on public.material_sentences from authenticated;

-- ────────────────────────────────────────────────────────────────
-- 3. 設問が入ったら台帳に積む
--
--   画面側で積み忘れると、その分だけ重複が素通りする。
--   忘れようがないよう、データベース側で自動的に行う。
-- ────────────────────────────────────────────────────────────────
create or replace function public.sync_material_sentences()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_material uuid;
begin
  v_material := coalesce(new.material_id, old.material_id);

  if tg_op in ('INSERT', 'UPDATE') then
    insert into public.material_sentences (material_id, text_norm)
    select v_material, n
    from unnest(array[
      public.norm_en(new.prompt_en),
      public.norm_en(new.audio_text),
      public.norm_en(new.answer),
      public.norm_en(new.text_en)      -- 0001 の古い列。移行中の教材のため
    ]) as n
    where n is not null
    on conflict do nothing;
  end if;

  -- 設問が消された/書き換えられた場合、どこからも参照されなくなった
  -- 英文は台帳から外す。残すと、実在しない文で新しい教材を弾いてしまう。
  if tg_op in ('UPDATE', 'DELETE') then
    delete from public.material_sentences ms
    where ms.material_id = v_material
      and not exists (
        select 1 from public.material_items mi
        where mi.material_id = v_material
          and ms.text_norm in (
            public.norm_en(mi.prompt_en), public.norm_en(mi.audio_text),
            public.norm_en(mi.answer),    public.norm_en(mi.text_en)
          )
      );
  end if;

  return null;
end;
$$;

drop trigger if exists material_items_sentences on public.material_items;
create trigger material_items_sentences
  after insert or update or delete on public.material_items
  for each row execute function public.sync_material_sentences();

-- 既にある教材の分を入れ直す。何度実行しても同じ結果になる。
insert into public.material_sentences (material_id, text_norm)
select mi.material_id, n
from public.material_items mi
cross join lateral unnest(array[
  public.norm_en(mi.prompt_en), public.norm_en(mi.audio_text),
  public.norm_en(mi.answer),    public.norm_en(mi.text_en)
]) as n
where n is not null
on conflict do nothing;

-- ────────────────────────────────────────────────────────────────
-- 4. 「この英文はもう出したか」を照合する
--
--   候補の英文を渡すと、そのうち既に使われているものだけを返す。
--   ライブラリ全体を画面側へ読み出す方式(件数の上限が必要になる)と違い、
--   **候補の数だけを問い合わせる**ので、教材が何万件に増えても効く。
--
--   2つの範囲を同時に見る:
--     p_learner … そのゲストに共有済みの教材すべて(弱点を問わない)
--     p_tags    … 同じ弱点のライブラリ全体(まだ誰にも共有していない分も)
--
--   トレーナー以外は呼べない。担当していないゲストも指定できない。
-- ────────────────────────────────────────────────────────────────
create or replace function public.used_sentences(
  p_learner    uuid,
  p_tags       text[],
  p_candidates text[]
) returns setof text
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_trainer() then
    raise exception '教材を作れるのはトレーナーだけです';
  end if;

  if p_learner is not null and not public.teaches(p_learner) then
    raise exception '担当していないゲストは指定できません';
  end if;

  return query
  with cand as (
    select distinct public.norm_en(c) as n
    from unnest(coalesce(p_candidates, array[]::text[])) as c
  )
  select c.n
  from cand c
  where c.n is not null
    and exists (
      select 1
      from public.material_sentences ms
      where ms.text_norm = c.n
        and (
          (p_learner is not null and exists (
            select 1 from public.assignments a
            where a.material_id = ms.material_id and a.learner_id = p_learner
          ))
          or
          (p_tags is not null and array_length(p_tags, 1) is not null and exists (
            select 1 from public.material_tags mt
            where mt.material_id = ms.material_id and mt.tag_id = any(p_tags)
          ))
        )
    );
end;
$$;

comment on function public.used_sentences(uuid, text[], text[]) is
  '候補の英文のうち、そのゲストに共有済み・または同じ弱点のライブラリに既にあるものを返す';

grant execute on function public.norm_en(text) to authenticated;
grant execute on function public.used_sentences(uuid, text[], text[]) to authenticated;
