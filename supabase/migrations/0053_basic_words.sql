-- ============================================================================
-- 0053 基礎単語(基本360語 / 標準1200語)を、まとめて単語帳に入れる
--
-- 【なぜ要るか】(2026-09 利用者の指定)
--
--   > そして、講座の中の単語はそれぞれ基本360語、標準1200語、として
--   > そもそもが独立して選べる単語帳にしてください
--
--   基礎単語は 0052 で **30日講座の中**にしか無かった。
--   「1日目を開いて、12語ずつ入れる」でしか単語帳へ入らないので、
--   **講座をやらない人には、この語に触れる道が1つも無かった。**
--
--   だから単語帳の側から **その段まるごと**を入れられるようにする。
--
-- 【`mark_word()` を 1,200 回呼ばない】(0047 とまったく同じ考え方)
--
--   1語ずつ呼ぶと 1,200 往復になる。
--   しかも `mark_word()` は**答えた記録**(`vocab_days`)まで増やす ——
--   **まだ誰も答えていない。**
--   だから「入れるだけ」の関数を、`add_material_words()` と同じ形で置く。
--
-- 【すでに入っている語は、いっさい触らない】
--
--   `on conflict do nothing`。**箱も、次に出す日も、1つも戻さない。**
--   何度押しても、覚えかけの語が振り出しに戻ることはない。
--
-- 【意味は引かない = 0円】
--
--   基礎単語の訳は `src/data/basicWords.js` に書いてあるので、
--   画面がそれを出す。**窓口(AI)を1回も呼ばない。**
--   `word_glosses` にも書き込まない —— あそこに書けるのは
--   Edge Function だけ、という決まりは変えない(CLAUDE.md)。
--
-- 【何が起きるか】
--   ・SQL の関数が1つ増えます
--   ・**表も列も増えません**
--   ・いま単語帳に入っている語の状態・箱・次に出す日は、**1件も変わりません**
--
-- 【どこまで影響するか】
--   教材・宿題・ゲストの情報・取り組みの記録には触れません。
--   RLS(見える範囲の決まり)も変えません。
--
-- 【何度貼っても安全】
--   drop してからの作り直しだけです。
--
-- 【成功の目安】
--   `Success. No rows returned` と出れば成功です。
-- ============================================================================

drop function if exists public.add_basic_words(text[], uuid);

create or replace function public.add_basic_words(
  p_words   text[],
  p_learner uuid default null
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

  -- **誰の単語帳に入れてよいか。判断はこの関数の中だけ。画面に持たせない**
  --   自分自身 / 担当しているゲスト(`teaches()`)/ 管理者(`is_owner()`)
  v_who := coalesce(p_learner, auth.uid());
  if v_who <> auth.uid()
     and not public.teaches(v_who)
     and not public.is_owner() then
    raise exception '担当していないゲストの単語帳には入れられません';
  end if;

  with src as (
    -- **そろえ方は `norm_word()` に任せる**(SQL / 窓口 / 画面の3か所で
    -- そろえてある規則を、ここで書き写さない)
    select distinct public.norm_word(w) as norm
      from unnest(coalesce(p_words, array[]::text[])) as w
     where public.norm_word(w) is not null
     limit 2000                    -- 際限なく入れない
  ), put as (
    insert into public.word_reviews as r
      (learner_id, word_norm, kind, status, box, due_on, updated_at)
    -- 基礎単語は**1語ずつ**である(`basicWords.js` が `/^[a-z'-]+$/` で
    -- 見張っている)。だから `kind` は `word` で決め打ちにしてよい
    select v_who, src.norm, 'word', 'unknown', 0, current_date, now()
      from src
    -- **すでにある語は、1つも触らない。** 箱も次に出す日もそのまま
    on conflict (learner_id, word_norm) do nothing
    returning 1
  )
  select count(*)::int into v_added from put;

  return coalesce(v_added, 0);
end;
$$;

comment on function public.add_basic_words(text[], uuid) is
  '基礎単語(基本360語 / 標準1200語)を、単語帳に「まだ」として入れる(0053)。'
  'すでに入っている語には触らない(箱を戻さない)。'
  '答えた記録(vocab_days)は増やさない。まだ誰も答えていないため。'
  '担当外のゲストには入れられない。新しく入った語数を返す。';

revoke all on function public.add_basic_words(text[], uuid) from public;
grant execute on function public.add_basic_words(text[], uuid) to authenticated;
