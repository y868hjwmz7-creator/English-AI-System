-- ============================================================================
-- 0070 セッションの記録を、ゲストも書けるようにする(第5.267節)
--
-- 【なぜ要るのか】(2026-09-26 利用者の指定)
--
--   > ゲストログインしたさいの「セッションの記録」を、
--   > ゲストも入力、編集できるようにしたいです。
--
--   いまはトレーナーと管理者しか書けません(0032)。
--   ゲストは**読むだけ**でした。
--
-- 【上書きが起きないようにする】(利用者の指定)
--
--   > 同時に書いても大丈夫なようにしてください
--
--   記録は「1日に1枚」で、書き終えて 1.2 秒だまると自動で保存します。
--   同じ1枚を2人で書くと、**あとから保存したほうで上書きされます。**
--   離れた場所で同時に書いていると、片方が消えます。
--
--   そこで**欄を2つに分けます。**
--
--     body         … トレーナーの記録(これまでどおり)
--     learner_body … **ゲストの記録**(ここで足します)
--
--   お互いの欄は見えますが、**書けるのは自分の欄だけ**なので、
--   同時に書いても、どちらも消えません。
--
-- 【なぜ関数なのか】
--
--   「行」を絞るだけなら RLS で足りますが、ここで要るのは
--   **「ゲストは learner_body の欄だけ書ける」という列の制限**です。
--   列ごとの権限はロール(authenticated)単位でしか付けられず、
--   トレーナーとゲストを分けられません
--   (CLAUDE.md「RLS は『行』しか絞れない」)。
--
--   だから**関数1つ**にします。`set_learner_note()` は
--   **自分(auth.uid())の行の learner_body だけ**を書き換えます。
--   ほかの欄にも、ほかの人の行にも、触れません。
--
-- 【何が起きるか】
--   ・`lesson_notes` に欄が1つ増えます(`learner_body`)。**空から始まります**
--   ・読むだけの関数ではなく、**書く関数が1つ増えます**
--   ・**表も行も増えません。** いままでの記録は1文字も変わりません
--
-- 【どこまで影響するか】
--   教材・宿題・単語帳・ゲストの情報には、いっさい触れません。
--
-- 【成功の目安】
--   `Success. No rows returned` と出れば成功です。
--
-- 【何度貼っても安全か】
--   安全です。`add column if not exists` と `drop function if exists` だけです。
-- ============================================================================

-- ────────────────────────────────────────────────────────────────
-- 1. ゲストの欄
-- ────────────────────────────────────────────────────────────────
alter table public.lesson_notes
  add column if not exists learner_body text not null default '';

comment on column public.lesson_notes.learner_body is
  'ゲスト本人が書く記録(0070)。トレーナーの body とは別の欄にしてあるので、'
  '同時に書いても上書きされない。書けるのは set_learner_note() からだけ。';

-- ────────────────────────────────────────────────────────────────
-- 2. ゲストが、自分の欄だけを書く
--
--   **security definer** にしてあるのは、0032 の RLS が
--   「書けるのは担当トレーナーと管理者だけ」と決めているためです。
--   この関数の中では **auth.uid() の行の learner_body しか**触りません。
--
--   **返す型を変えていなくても drop を置きます**(CLAUDE.md)——
--   あとで誰かが返すものを足したときに、このファイルだけを貼り直すと
--   `cannot change return type` で止まるためです。
-- ────────────────────────────────────────────────────────────────
drop function if exists public.set_learner_note(date, text);

create or replace function public.set_learner_note(p_on_date date, p_body text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  txt text := coalesce(p_body, '');
  left_body text;
begin
  if me is null then
    raise exception 'ログインしていません';
  end if;
  if p_on_date is null then
    raise exception '日付がありません';
  end if;

  /* **自分の行だけ。** learner_id は auth.uid() で決め打ちなので、
     ほかの人の記録には触れようがない */
  insert into public.lesson_notes (learner_id, on_date, learner_body, updated_by)
  values (me, p_on_date, txt, me)
  on conflict (learner_id, on_date) do update
    /* **トレーナーの欄(body)には触らない。** ここが「同時に書いても
       大丈夫」の要である */
    set learner_body = excluded.learner_body;

  /* **両方とも空になったら、行ごと消す。**
     白紙の日をカレンダーに残さない(0032 と同じ決まり) */
  delete from public.lesson_notes
   where learner_id = me and on_date = p_on_date
     and coalesce(body, '') = '' and coalesce(learner_body, '') = '';

  select coalesce(body, '') into left_body
    from public.lesson_notes where learner_id = me and on_date = p_on_date;

  /* **起きたことを、そのまま返す**(成功と失敗を同じ見た目で終わらせない) */
  return jsonb_build_object(
    'ok', true,
    'kept', coalesce(left_body, '') <> '' or txt <> ''
  );
end;
$$;

comment on function public.set_learner_note(date, text) is
  'ゲストが、自分のその日の記録(learner_body)だけを書く(0070)。'
  'トレーナーの欄(body)には触らないので、同時に書いても上書きされない。';

grant execute on function public.set_learner_note(date, text) to authenticated;

-- ============================================================================
-- 完了。
--
-- 【確かめかた】
--   select column_name from information_schema.columns
--    where table_name = 'lesson_notes' and column_name = 'learner_body';
--   → 1行出れば入っています。
-- ============================================================================
