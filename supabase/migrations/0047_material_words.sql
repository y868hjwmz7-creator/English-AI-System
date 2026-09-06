-- ============================================================================
-- 0047 単語 / フレーズを1つの種類にまとめ、**共有したら単語帳に入れる**
--
-- 【なぜ要るか】(2026-09 利用者の指定)
--
--   > 単語のトレーニング、これだけでは全くトレーニングとして
--   > 成り立っていません。。。単語、、、例えば、こういうふうに教材にする
--   > というより、ゲストの単語帳に課題としてアサインできる方が良いですね。
--   > または、２つ目のトレーニングに穴埋めがあったり、３つ目が日→英に
--   > なっていたり、そういう仕組みで単語が覚えられるような仕組みにしたい
--   > です。これは、フレーズのトレーニングとドッキングして一緒にするのも
--   > 良いかもしれません。
--
--   単語の教材は **20問を1回解いて終わり**だった。ところが同じアプリの
--   **単語帳のほうには、間隔をあけた復習(0015〜0039)がすでにある。**
--   出題の形も箱に応じて4つに変わる。
--   **練習の実体を、そちらへ移すのがいちばん近道である。**
--
-- 【このファイルがすること(3つ)】
--
--   ① `materials.kind` に **`vocab`**(単語 / フレーズ)を足す
--   ② **`add_material_words()`** … 教材の語句を、ゲストの単語帳へ入れる
--   ③ `review_words()` … 意味の控えがまだ無い語では、
--      **その教材に書いてある訳**を出す
--
-- 【何が起きるか】
--   ・教材の種類に入れてよい値が1つ増えます(**行は書き換わりません**)
--   ・関数が1つ増え、1つ作り直されます
--   ・**表も列も増えません**
--
-- 【どこまで影響するか】
--   ・いま単語帳に入っている語の状態・箱・次に出す日は、**1件も変わりません**
--   ・教材・宿題・ゲストの情報・取り組みの記録には触れません
--   ・RLS(見える範囲の決まり)も変えません
--
-- 【何度貼っても安全】
--   制約の貼り直しと、drop してからの作り直しだけです。
--
-- 【成功の目安】
--   `Success. No rows returned` と出れば成功です。
-- ============================================================================

-- ────────────────────────────────────────────────────────────────
-- ① 教材の種類に `vocab` を足す
--
--   **旧い `word` / `phrase` は消さない。** 消すと、その種類で作った
--   教材が開けなくなる(`fill_blank` を残したのと同じ考え方)。
--   新しく作るときだけ `vocab` を選ぶ(画面が旧い2つを出さない)。
-- ────────────────────────────────────────────────────────────────
alter table public.materials drop constraint if exists materials_kind_check;
alter table public.materials
  add constraint materials_kind_check check (kind in (
    'pattern',    -- 文型ドリル(4演習 × 10問 = 40問)
    'reading',    -- リーディング(記事1本 + 内容理解 + ディスカッション + 語句)
    'dialogue',   -- ダイアローグ(会話1本。2人)
    'meeting',    -- 会議(会話と同じ形。**3〜4人**・0037)
    'speech',     -- Speech練習(記事と同じ形。**1人が話しきる**・0043)
    'vocab',      -- 単語 / フレーズ(単語10 + フレーズ10・**0047**)
    'word',       -- 旧「単語」。新規では使わないが、既存の行のために残す
    'phrase',     -- 旧「フレーズ」。同上
    'passage'     -- 旧「長文」。同上
  ));

comment on column public.materials.kind is
  '教材の種類。pattern / reading / dialogue / meeting / speech / vocab / '
  'word / phrase / passage(うしろの3つは旧い形。新規では選べない)';

-- ────────────────────────────────────────────────────────────────
-- ② add_material_words() — 教材の語句を、ゲストの単語帳へ入れる
--
-- 【`mark_word()` を20回呼ばない】
--
--   1語ずつ呼ぶと20往復になるうえ、あちらは**答えた記録**
--   (`vocab_days`)まで増やしてしまう。**まだ誰も答えていない。**
--   だから入れるだけの関数を別に置く。
--
-- 【すでに入っている語は、いっさい触らない】
--
--   `on conflict do nothing`。**箱を 0 に戻さない。**
--   何度共有しても、覚えかけの語が振り出しに戻ることはない。
--
-- 【入るのは「まだ」、その日から出す】
--
--   手で入れた語(`WordbookAdd`)とまったく同じ扱いである(0030)。
--   共有したその日のレッスンで、そのまま復習に使える。
--
-- 【誰の単語帳に入れてよいか】
--
--   **判断はこの関数の中だけ。画面に持たせない。**
--   自分自身 / 担当しているゲスト(`teaches()`)/ 管理者(`is_owner()`)。
-- ────────────────────────────────────────────────────────────────
drop function if exists public.add_material_words(uuid[], uuid);

create or replace function public.add_material_words(
  p_learners uuid[],
  p_material uuid
)
-- **返す名前を `learner` にする。** `learner_id` は `word_reviews` の列名でも
-- あるので、同じ名前を返り値に使うと `on conflict (learner_id, ...)` の
-- ところで PL/pgSQL が変数と取り違える(「ambiguous」で止まる)
returns table (learner uuid, added int)
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
  if p_material is null then
    raise exception '教材が指定されていません';
  end if;

  foreach v_who in array coalesce(p_learners, array[]::uuid[])
  loop
    if v_who <> auth.uid()
       and not public.teaches(v_who)
       and not public.is_owner() then
      raise exception '担当していないゲストの単語帳には入れられません';
    end if;

    with src as (
      -- **語句の演習だけ**(単語 / フレーズ)。
      -- 記事の「本文に出てきた語句」(`vocab_note`)は入れない ——
      -- あちらはゲストが本文の中で触って自分で選ぶ道がすでにある。
      -- 全部入れると、記事1本ごとに8語ずつ勝手に溜まっていく
      select public.norm_word(i.prompt_en) as norm,
             case when s.exercise_type = 'phrase' then 'phrase' else 'word' end as kind
        from public.material_items i
        join public.material_sections s on s.id = i.section_id
       where s.material_id = p_material
         and s.exercise_type in ('vocabulary', 'phrase')
         and public.norm_word(i.prompt_en) is not null
       group by 1, 2
       limit 200          -- 際限なく入れない
    ), put as (
      insert into public.word_reviews as w
        (learner_id, word_norm, kind, status, box, due_on, material_id, updated_at)
      select v_who, src.norm, src.kind, 'unknown', 0, current_date, p_material, now()
        from src
      -- **すでにある語は、1つも触らない。** 箱も次に出す日もそのまま
      on conflict (learner_id, word_norm) do nothing
      returning 1
    )
    select count(*)::int into v_added from put;

    learner := v_who;
    added   := coalesce(v_added, 0);
    return next;
  end loop;
end;
$$;

comment on function public.add_material_words(uuid[], uuid) is
  '教材の語句(単語 / フレーズの演習)を、ゲストの単語帳に「まだ」として入れる(0047)。'
  'すでに入っている語には触らない(箱を戻さない)。'
  '答えた記録(vocab_days)は増やさない。まだ誰も答えていないため。'
  '担当外のゲストには入れられない。';

revoke all on function public.add_material_words(uuid[], uuid) from public;
grant execute on function public.add_material_words(uuid[], uuid) to authenticated;

-- ────────────────────────────────────────────────────────────────
-- ③ review_words() — 控えがまだ無い語では、教材に書いてある訳を出す
--
-- 【なぜ要るか】
--
--   ②で入れた語は、**まだ誰も意味を引いていない**ことがある
--   (`word_glosses` は、本文で語に触れたときに埋まる控えである)。
--   そのままだと単語帳に「(意味の控えがありません)」と並び、
--   4択も作れない(まちがいの選択肢は意味から作るため)。
--
--   **その意味は、教材の中にもう書いてある**(`material_items.prompt_ja`)。
--   控えが無いときだけ、そちらを出す。
--   **新しく AI に尋ねない = 費用は1円もかからない。**
--   **`word_glosses` には書き込まない** —— あそこに書けるのは
--   Edge Function だけ、という決まりは変えない(CLAUDE.md)。
--
-- 【返す列は変えていない】
--   それでも **先に drop を置く**(CLAUDE.md)。
--   あとで誰かが列を足したときに、このファイルだけを貼り直すと
--   `cannot change return type of existing function` で止まるためである。
-- ────────────────────────────────────────────────────────────────
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
  material_industry text,
  material_kind     text,
  material_genre    text,
  material_scene    text,
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
           -- **見せ方も、控えが無ければ教材のとおりに**(0047)。
           -- `word_norm` は小文字にそろえた形なので、そのままだと
           -- 固有名詞まで小文字で並ぶ
           coalesce(g.display, nullif(mi.prompt_en, ''), r.word_norm),
           r.kind,
           coalesce(g.pos, ''),
           -- **控えが無いときは、教材に書いてある訳を出す**(0047)
           coalesce(nullif(g.meaning_ja, ''), nullif(mi.prompt_ja, ''), ''),
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
    where r.learner_id = p_learner
      and (p_status is null
           or (p_status = 'todo' and r.status in ('unknown', 'learning'))
           or r.status = p_status)
      and (not p_due_only or r.due_on <= current_date)
    order by (r.status = 'learning'), r.due_on, r.box, r.updated_at desc
    limit greatest(1, least(coalesce(p_limit, 40), 200));
end;
$$;

comment on function public.review_words(uuid, text, int, boolean) is
  'ゲストの語を意味付きで返す。p_status に todo を渡すと「まだ + 覚えかけ」。'
  '並びは まだ → 覚えかけ の順(0027)。p_due_only で「今日出すもの」に絞る。'
  '出会った教材の分野・種類・話題・場面も返す(0028)。'
  '続けて思い出せた回数(learn_streak)も返す(0039)。'
  '意味の控えがまだ無い語では、その教材に書いてある訳を出す(0047)。'
  '担当外は拒否する。';

revoke all on function public.review_words(uuid, text, int, boolean) from public;
grant execute on function public.review_words(uuid, text, int, boolean) to authenticated;
