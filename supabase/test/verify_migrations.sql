-- ============================================================================
-- 移行SQLが全部入ったかを確かめる(いつ実行しても安全)
--
-- 【使い方】
--   Supabase の SQL Editor に貼って Run するだけ。
--   何も書き換えず、何も消しません。**見るだけ**の SQL です。
--
-- 【成功したときの見え方】
--   9行の表が出て、すべて「✅ OK」になります。
--   「❌ まだです」がある行は、その番号のファイルがまだ実行されていません。
-- ============================================================================

select 確認項目, case when 結果 then '✅ OK' else '❌ まだです' end as 状態
from (
  select '① 役割が3つある(0002)' as 確認項目, exists (
    select 1 from pg_constraint
    where conname = 'profiles_role_check'
      and pg_get_constraintdef(oid) like '%owner%') as 結果, 1 as 順
  union all
  select '② 教材に公開範囲がある(0002)', exists (
    select 1 from information_schema.columns
    where table_name = 'materials' and column_name = 'visibility'), 2
  union all
  select '③ 集計の関数がある(0002)', exists (
    select 1 from pg_proc where proname = 'school_summary'), 3
  union all
  select '④ 担当に期間がある(0003)', exists (
    select 1 from information_schema.columns
    where table_name = 'learner_admins' and column_name = 'ended_on'), 4
  union all
  select '⑤ 引き継ぎの関数がある(0003)', exists (
    select 1 from pg_proc where proname = 'transfer_learner'), 5
  union all
  select '⑥ 退職の関数がある(0003)', exists (
    select 1 from pg_proc where proname = 'retire_trainer'), 6
  union all
  select '⑦ 在籍状態が3つある(0004)', exists (
    select 1 from pg_constraint
    where conname = 'profiles_status_check'
      and pg_get_constraintdef(oid) like '%paused%'), 7
  union all
  select '⑧ 休みの予定の表がある(0004)', exists (
    select 1 from pg_tables where tablename = 'trainer_absences'), 8
  union all
  select '⑨ 弱点タグが38件ある', (
    select count(*) = 38 from public.weakness_tags), 9
) t order by 順;
