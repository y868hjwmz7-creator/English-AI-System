-- ============================================================================
-- ★ いま Supabase に何が入っていて、何がまだかを見るだけの SQL です ★
--
-- 【何が起きるか】
--   **何も書き換えません。** 見るだけです。表も行も一切さわりません。
--
-- 【どこで使うか】
--   Supabase → 左メニュー「SQL Editor」→「New query」に貼って、Run。
--
-- 【どうなれば成功か】
--   13行の表が出ます。「⬜ まだです」があれば、その行に書いてあるファイルを
--   貼れば、そこがそろいます。
--     0013〜0023 … supabase/apply/pending_2026-08-29.sql
--     0024       … supabase/apply/pending_2026-08-31.sql
--     0025       … supabase/apply/pending_2026-08-31b.sql
--     0026       … supabase/apply/pending_2026-09-01.sql
--     0027       … supabase/apply/pending_2026-09-01b.sql
--     0028       … supabase/apply/pending_2026-09-01c.sql
--     0029       … supabase/apply/pending_2026-09-01d.sql
--     0030       … supabase/apply/pending_2026-09-01e.sql
--     0031       … supabase/apply/pending_2026-09-01f.sql
-- ============================================================================

select 何が要るか, case when 済 then '✅ もう入っています' else '⬜ まだです' end as 状態
from (
  select '0013〜0019(発音記号・復習の箱・音声の置き場など)' as 何が要るか,
         exists (select 1 from pg_tables where tablename = 'vocab_days') as 済, 1 as 順
  union all select '0020 単語・フレーズの発音記号',
    exists (select 1 from information_schema.columns
            where table_name = 'material_items' and column_name = 'phonetic'), 2
  union all select '0021 カタマリごとの訳',
    exists (select 1 from information_schema.columns
            where table_name = 'material_items' and column_name = 'chunks'), 3
  union all select '0022 取り組みの記録とリマインド',
    exists (select 1 from pg_tables where tablename = 'practice_days'), 4
  union all select '0023 集計を教材の種類と内容で数える',
    exists (select 1 from pg_proc where proname = 'school_by_kind'), 5
  union all select '0024 単語帳を「入った日」と「教材名」で絞れる',
    exists (select 1 from information_schema.columns
            where table_name = 'word_reviews' and column_name = 'added_at'), 6
  union all select '0025 レッスンの記録をゲストと分かち合う',
    exists (select 1 from pg_tables where tablename = 'material_progress'), 7
  union all select '0026 スコアの範囲(TOEIC 100-990 / VERSANT 10-90)',
    exists (select 1 from pg_constraint
            where conname = 'learner_scores_range'
              and pg_get_constraintdef(oid) like '%100%990%'), 8
  union all select '0027 単語帳の「覚えかけ」',
    exists (select 1 from pg_constraint
            where conname = 'word_reviews_status_check'
              and pg_get_constraintdef(oid) like '%learning%'), 9
  union all select '0028 単語帳を分野・場面で絞る',
    exists (select 1 from pg_proc
            where proname = 'review_words'
              and pg_get_function_result(oid) like '%material_industry%'), 10
  union all select '0029 自分のアイコンを選べる',
    exists (select 1 from information_schema.columns
            where table_name = 'profiles' and column_name = 'avatar'), 11
  union all select '0030 入れたばかりの語が、その日の復習に出る',
    exists (select 1 from pg_proc
            where proname = 'mark_word'
              and pg_get_functiondef(oid) like '%v_new%'), 12
  union all select '0031 ゲストに関するファイルの置き場',
    exists (select 1 from pg_tables where tablename = 'learner_files'), 13
) t order by 順;
