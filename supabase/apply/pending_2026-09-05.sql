-- ============================================================================
-- 0041 ゲストの記録を、まとめて消せるようにする
--
-- 【なぜ要るか】(2026-09 安全性レビュー 03-3位)
--   名前・スコア・セッションの記録・単語帳・アップロードしたファイル。
--   **退会したときに、まとめて消す手順がどこにも無かった。**
--   「消してほしい」と言われたときに応えられない状態だった。
--
--   表をまたいで15か所以上あるので、**画面から順に消させない。**
--   途中で失敗すれば、どこまで消えたのか誰にも分からなくなる。
--   **SQL の関数1つにまとめ、まるごと成功するか、まるごと失敗するか**にする。
--
-- 【誰ができるか】
--   **管理者(`is_owner()`)だけ。** トレーナーにはできない。
--   担当ゲストを持つトレーナーが1人でも消せると、事故が大きすぎる。
--
-- 【消せないもの】
--   ・**ログインそのもの**(`auth.users`)は、ここからは消せない。
--     消すには管理者の鍵(service_role)が要る。
--     この関数はプロフィールを消すので**そのアカウントはアプリを使えなくなる**が、
--     ログインの行そのものは Supabase の画面から消してもらう
--     (Authentication → Users → その人 → Delete user)。
--     **鍵を扱わない**という決まりを、この機能のために曲げない。
--   ・**教材そのもの**(`materials`)は消さない。スクール全体で共有していて、
--     ほかのゲストにも配られている。消えるのは「誰に配ったか」の記録だけ。
--   ・**単語の意味の控え**(`word_glosses`)も消さない。
--     あれは英単語の辞書であって、その人の記録ではない。
--
-- 【必ず数えて返す】
--   何も消さずに「消しました」と返さない。**表ごとの件数を返す**ので、
--   画面はそれをそのまま出せる(成功と失敗を同じ見た目で終わらせない)。
-- ============================================================================

-- **返す型を変えていなくても drop を置く。** あとで誰かが列を足したときに、
-- このファイルだけを貼り直すと `cannot change return type` で止まるため
-- (CLAUDE.md「関数を作り直すファイルは、返す列を変えていなくても drop を置く」)
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

  -- ② 相手がゲストであることを確かめる。
  --    **トレーナーや管理者を、まちがって消せないようにする**
  select role into v_role from public.profiles where id = p_learner;
  if v_role is null then
    raise exception 'そのゲストは見つかりません';
  end if;
  if v_role <> 'learner' then
    raise exception 'ゲスト以外は消せません(いまの役割: %)', v_role;
  end if;

  -- ③ 置いてあるファイルの中身。**表より先に消す。**
  --    先に控えを消すと、どのファイルがその人のものだったか分からなくなる
  delete from storage.objects
   where bucket_id = 'learner-files'
     and name like p_learner::text || '/%';
  get diagnostics v_n = row_count;
  v_out := v_out || jsonb_build_object('置いたファイル', v_n);

  delete from public.learner_files where learner_id = p_learner;
  get diagnostics v_n = row_count;
  v_out := v_out || jsonb_build_object('ファイルの控え', v_n);

  -- ④ 学習の記録
  delete from public.qr_reviews where learner_id = p_learner;
  get diagnostics v_n = row_count;
  v_out := v_out || jsonb_build_object('Quick Response の復習', v_n);

  delete from public.word_reviews where learner_id = p_learner;
  get diagnostics v_n = row_count;
  v_out := v_out || jsonb_build_object('単語帳', v_n);

  delete from public.vocab_days where learner_id = p_learner;
  get diagnostics v_n = row_count;
  v_out := v_out || jsonb_build_object('単語の日ごとの記録', v_n);

  delete from public.practice_days where learner_id = p_learner;
  get diagnostics v_n = row_count;
  v_out := v_out || jsonb_build_object('取り組みの記録', v_n);

  delete from public.material_progress where learner_id = p_learner;
  get diagnostics v_n = row_count;
  v_out := v_out || jsonb_build_object('やりかけの途中経過', v_n);

  delete from public.attempts where user_id = p_learner;
  get diagnostics v_n = row_count;
  v_out := v_out || jsonb_build_object('解答の記録', v_n);

  delete from public.study_logs where user_id = p_learner;
  get diagnostics v_n = row_count;
  v_out := v_out || jsonb_build_object('学習時間の記録', v_n);

  -- ⑤ レッスンにまつわるもの
  --    `lesson_feedback_tags` は `on delete cascade` なので、一緒に消える
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

  -- ⑥ 配った教材の記録。**教材そのものは消さない**(スクールの共有物)
  delete from public.assignments where learner_id = p_learner;
  get diagnostics v_n = row_count;
  v_out := v_out || jsonb_build_object('配った教材の記録', v_n);

  -- ⑦ 担当の割り当て
  delete from public.learner_admins where learner_id = p_learner;
  get diagnostics v_n = row_count;
  v_out := v_out || jsonb_build_object('担当の割り当て', v_n);

  -- ⑧ 最後に本人の欄。**名前も、選んだアイコンも、レベルも消える**
  delete from public.profiles where id = p_learner;
  get diagnostics v_n = row_count;
  v_out := v_out || jsonb_build_object('ゲストの欄', v_n);

  return v_out;
end;
$$;

revoke all on function public.erase_learner(uuid) from public;
grant execute on function public.erase_learner(uuid) to authenticated;

comment on function public.erase_learner(uuid) is
  'ゲスト1人の記録を、表をまたいでまとめて消す(管理者だけ)。'
  'ログインそのもの(auth.users)は消さない —— Supabase の画面から消す。';
