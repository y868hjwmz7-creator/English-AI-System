-- ============================================================================
-- ★ Supabase の SQL Editor に、これを丸ごと貼って Run してください ★
--
-- 【これは何か】
--   0030 だけです。0029 までは、すでに実行済みのはずです。
--   中身は GitHub の supabase/migrations/0030_due_today.sql と同じです。
--
-- 【何が起きるか】
--   **単語帳に入れたばかりの語が、その日の復習に出る**ようになります。
--   いままでは初めて入る語も「翌日」からだったので、
--   手で入れたその日には1回も出てきませんでした
--   (「登録しても反映されない」ように見えていたのは、これが原因です)。
--
-- 【どこまで影響するか】
--   ・`mark_word` という関数を1つ置き換えるだけです
--   ・**いま入っている語は1件も変わりません**
--   ・表も列も増えません
--   ・2回目以降の間隔(1 → 2 → 4 → 7 → 14 → 30 日)は**変えていません**
--
-- 【何度貼っても安全です】
--   迷ったら、そのまま貼ってください。
--
-- 【どうなれば成功か】
--   `Success. No rows returned` と出れば成功です。
-- ============================================================================


-- 0030 単語帳に入れたばかりの語を、その日の復習に出す
--
-- 【なぜ要るか】(2026-09 実機)
--
--   > 単語を手打ちで登録しても反映されません
--
--   `mark_word()` は「次に出すまでの間隔」を決める関数で、
--   「まだ」は翌日(`current_date + 1`)としていた。
--   間隔の決まりとしては正しいのだが、**初めて入る語まで翌日**になるため、
--   入れたその日は復習に1回も出てこない。
--   画面には「入れた語は『まだ』から始まります。復習に出てくるので…」と
--   書いてあるので、**言っていることと動きが食い違っていた。**
--
-- 【何が変わるか】
--   ・**初めて単語帳に入る語だけ**、その日から復習に出る
--   ・2回目以降の間隔は**まったく変えていない**(1 → 2 → 4 → 7 → 14 → 30 日)
--   ・すでに入っている語には触れない。**行は1つも書き換わらない**
--
-- 【どこまで影響するか】
--   `mark_word()` という関数を1つ置き換えるだけ。
--   表も列も増えず、いま入っているデータは1件も変わらない。
--
-- 【何度貼っても安全】
--   `create or replace` なので、同じものを何度貼っても同じ結果になる。

create or replace function public.mark_word(
  p_norm        text,
  p_status      text,
  p_kind        text default 'word',
  p_material    uuid default null,
  p_sentence    text default null,
  p_sentence_ja text default null,
  p_learner     uuid default null
)
returns table (word_norm text, status text, box smallint, due_on date)
language plpgsql
volatile
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_who      uuid;
  v_norm     text;
  v_box      smallint;
  v_days     int;
  v_sentence text;
  v_ja       text;
  v_new      boolean;
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

  v_norm := public.norm_word(p_norm);
  if v_norm is null then
    raise exception '語が空です';
  end if;
  -- **0027 で learning(覚えかけ)を足した**
  if p_status is null or p_status not in ('known', 'learning', 'unknown') then
    raise exception '状態は known / learning / unknown です';
  end if;

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
   where r.learner_id = v_who and r.word_norm = v_norm;
  -- **その語が単語帳に入るのは、これが初めてか。**
  -- `found` は直前の select が行を見つけたかどうかである
  v_new := not found;
  v_box := coalesce(v_box, 0);

  if p_status = 'unknown' then
    -- 分からなかったものは、いちばん下の箱に戻して翌日また出す
    v_box := 0;
    v_days := 1;
  elsif p_status = 'learning' then
    -- **覚えかけは、箱を 3 で止める**(0027)。
    -- 上限が無いと、自信が無いまま押しつづけたものが30日先へ飛ぶ。
    -- 3 で止めれば必ず4日以内に戻ってくる
    v_box := least(v_box + 1, 3);
    v_days := case v_box when 1 then 1 when 2 then 2 else 4 end;
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

  -- ★★ 0030 ここだけが 0027 との違い ★★
  --
  -- **単語帳に入ったばかりの語は、その日の復習に出す。**
  --
  -- これまでは、初めて入る語も「翌日」からだった(`v_days` は
  -- 「もう一度出すまでの間隔」なので、間隔の決まりとしては正しい)。
  -- けれども**入れたその日に1回も出てこない**ので、
  -- 手で入れた人には「登録しても反映されない」ように見える
  -- (2026-09 実機)。宿題で「まだ」と付けた語も同じで、
  -- その日のうちに復習できなかった。
  --
  -- **間隔の決まりそのものは変えていない。** 2回目以降は
  -- これまでどおり 1 → 2 → 4 → 7 → 14 → 30 日である。
  if v_new then
    v_days := 0;
  end if;

  -- 続けた記録(0019)。**「覚えた」だけを正解として数える。**
  -- 覚えかけは、思い出せたが自信が無い状態なので、正解には数えない
  insert into public.vocab_days as d (learner_id, done_on, answered, correct)
  values (v_who, current_date, 1, case when p_status = 'known' then 1 else 0 end)
  on conflict (learner_id, done_on) do update
    set answered = d.answered + 1,
        correct  = d.correct + case when p_status = 'known' then 1 else 0 end;

  return query
  insert into public.word_reviews as w
    (learner_id, word_norm, kind, status, box, due_on, material_id,
     seen_in, seen_in_ja, updated_at)
  values
    (v_who, v_norm, coalesce(p_kind, 'word'), p_status,
     v_box, current_date + v_days, p_material, v_sentence, v_ja, now())
  on conflict (learner_id, word_norm) do update
    set status      = excluded.status,
        kind        = excluded.kind,
        box         = excluded.box,
        due_on      = excluded.due_on,
        material_id = coalesce(w.material_id, excluded.material_id),
        seen_in     = coalesce(w.seen_in, excluded.seen_in),
        seen_in_ja  = coalesce(w.seen_in_ja, excluded.seen_in_ja),
        updated_at  = now()
  returning w.word_norm, w.status, w.box, w.due_on;
end;
$$;


comment on function public.mark_word(text, text, text, uuid, text, text, uuid) is
  '語や句に「覚えた / 覚えかけ / まだ」を付け、次に出す日を決める(0030)。'
  '**初めて入る語は、その日から復習に出る。**'
  '2回目からは 1 → 2 → 4 → 7 → 14 → 30 日(覚えかけは箱 3 で止める)。'
  'p_learner を渡すと、担当しているゲストの記録として残す(0025)。'
  '間隔の決まりはこの関数だけが持つ。';
