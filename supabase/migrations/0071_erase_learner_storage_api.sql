-- ════════════════════════════════════════════════════════════════
-- 0071 ゲストの消去から、ストレージの直接削除を外す
--
-- 【何が起きたか】(2026-09-28 実機)
--   ゲストを消そうとして、こう出て止まった。
--
--     記録を消せませんでした:
--     Direct deletion from storage tables is not allowed.
--     Use the Storage API instead.
--
--   Supabase が `storage.objects` への直接の delete を断るようになった。
--   0041 から 0058 まで、`erase_learner()` はずっとこれをやっていた。
--   **1行でも失敗すると関数ごと巻き戻る**ので、
--   ゲストは1人も消せない状態だった。
--
-- 【どう直したか】
--   ・この関数からは**ストレージを消す段を外す**(表だけを消す)
--   ・**置いた中身は、画面の側が Storage API で先に消す**
--     (`removeAllLearnerFiles()` → そのあと `erase_learner()`)
--   ・先に消して、失敗したら**表には手をつけない**。
--     もう一度押せば、続きからやり直せる
--
-- 【何が起きるか / どこまで影響するか】
--   ・**関数の中身を置き換えるだけ**です。表も行も1つも触りません
--   ・ゲストのデータ・教材・宿題には**何も起きません**
--   ・**何度貼っても同じ結果**になります
--
-- 【成功の目安】
--   `Success. No rows returned` と出れば成功です。
--
-- **返す型を変えていなくても drop を置く**(CLAUDE.md)——
-- あとで誰かが返すものを変えるかもしれない。
-- ════════════════════════════════════════════════════════════════

drop function if exists public.erase_learner(uuid);

create or replace function public.erase_learner(p_learner uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role  text;
  v_out   jsonb := '{}'::jsonb;
  v_n     integer;
begin
  -- ① 管理者だけ。**判定を画面に持たせない**
  if not public.is_owner() then
    raise exception 'この操作ができるのは管理者だけです';
  end if;

  -- ② 相手がゲストであることを確かめる
  select role into v_role from public.profiles where id = p_learner;
  if v_role is null then
    raise exception 'そのゲストは見つかりません';
  end if;
  if v_role <> 'learner' then
    raise exception 'ゲスト以外は消せません(いまの役割: %)', v_role;
  end if;

  -- ③ **置いてあるファイルの中身は、ここでは消さない**(0071)。
  --    Supabase は SQL からの直接削除を断るようになった。
  --      Direct deletion from storage tables is not allowed.
  --      Use the Storage API instead.
  --    画面の側が Storage API で先に消してから、この関数を呼ぶ。
  --    **控え(learner_files)はここで消す** —— 表は表の側でまとめる

  delete from public.learner_files where learner_id = p_learner;
  get diagnostics v_n = row_count;
  v_out := v_out || jsonb_build_object('ファイルの控え', v_n);

  -- ④ 学習の記録
  delete from public.qr_reviews where learner_id = p_learner;
  get diagnostics v_n = row_count;
  v_out := v_out || jsonb_build_object('Quick Response の復習', v_n);

  delete from public.qr_days where learner_id = p_learner;
  get diagnostics v_n = row_count;
  v_out := v_out || jsonb_build_object('Quick Response の日ごと', v_n);

  delete from public.weekly_goals where learner_id = p_learner;
  get diagnostics v_n = row_count;
  v_out := v_out || jsonb_build_object('週の目標', v_n);

  delete from public.course_days where learner_id = p_learner;
  get diagnostics v_n = row_count;
  v_out := v_out || jsonb_build_object('30日講座の進み', v_n);

  delete from public.speeches where learner_id = p_learner;
  get diagnostics v_n = row_count;
  v_out := v_out || jsonb_build_object('スピーチの原稿', v_n);

  delete from public.learner_features where learner_id = p_learner;
  get diagnostics v_n = row_count;
  v_out := v_out || jsonb_build_object('出すものの指定', v_n);

  -- **業種べつの単語帳の覚え具合**(0058)。
  -- 棚そのもの(shelf_words)はスクールの共有物なので触らない
  delete from public.shelf_reviews where learner_id = p_learner;
  get diagnostics v_n = row_count;
  v_out := v_out || jsonb_build_object('業種べつの単語帳', v_n);

  delete from public.word_reviews where learner_id = p_learner;
  get diagnostics v_n = row_count;
  v_out := v_out || jsonb_build_object('単語帳', v_n);

  delete from public.vocab_days where learner_id = p_learner;
  get diagnostics v_n = row_count;
  v_out := v_out || jsonb_build_object('単語の日ごと', v_n);

  delete from public.practice_days where learner_id = p_learner;
  get diagnostics v_n = row_count;
  v_out := v_out || jsonb_build_object('取り組みの日ごと', v_n);

  delete from public.material_progress where learner_id = p_learner;
  get diagnostics v_n = row_count;
  v_out := v_out || jsonb_build_object('書きかけ・区切り', v_n);

  delete from public.attempts where user_id = p_learner;
  get diagnostics v_n = row_count;
  v_out := v_out || jsonb_build_object('発音の記録', v_n);

  delete from public.study_logs where user_id = p_learner;
  get diagnostics v_n = row_count;
  v_out := v_out || jsonb_build_object('学習の記録(旧)', v_n);

  -- ⑤ トレーナーが書いたもの
  delete from public.lesson_feedback where learner_id = p_learner;
  get diagnostics v_n = row_count;
  v_out := v_out || jsonb_build_object('レッスンの記録', v_n);

  delete from public.lesson_notes where learner_id = p_learner;
  get diagnostics v_n = row_count;
  v_out := v_out || jsonb_build_object('セッションの記録', v_n);

  delete from public.learner_scores where learner_id = p_learner;
  get diagnostics v_n = row_count;
  v_out := v_out || jsonb_build_object('スコア', v_n);

  delete from public.reminders where learner_id = p_learner;
  get diagnostics v_n = row_count;
  v_out := v_out || jsonb_build_object('リマインド', v_n);

  delete from public.wordbook_views where learner_id = p_learner;
  get diagnostics v_n = row_count;
  v_out := v_out || jsonb_build_object('単語帳を見た記録', v_n);

  -- ⑥ 配ったもの・担当
  delete from public.assignments where learner_id = p_learner;
  get diagnostics v_n = row_count;
  v_out := v_out || jsonb_build_object('宿題', v_n);

  delete from public.learner_admins where learner_id = p_learner;
  get diagnostics v_n = row_count;
  v_out := v_out || jsonb_build_object('担当', v_n);

  -- ⑦ 最後にゲストの欄
  delete from public.profiles where id = p_learner;
  get diagnostics v_n = row_count;
  v_out := v_out || jsonb_build_object('ゲストの欄', v_n);

  return v_out;
end;
$$;
