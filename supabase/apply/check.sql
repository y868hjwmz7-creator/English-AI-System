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
--   23行の表が出ます。「⬜ まだです」があれば、その行に書いてあるファイルを
--   貼れば、そこがそろいます。
--   **「⬜ まだです」が2つ以上あるときは、まとめた1つを貼れば済みます。**
--     0026〜0031 … supabase/apply/pending_2026-09-01g.sql(まとめて)
--     0034〜0040 … supabase/apply/pending_2026-09-04.sql(まとめて)
--
--   1つずつ貼りたいときは、こちら。
--     0013〜0023 … supabase/apply/pending_2026-08-29.sql
--     0024       … supabase/apply/pending_2026-08-31.sql
--     0025       … supabase/apply/pending_2026-08-31b.sql
--     0026       … supabase/apply/pending_2026-09-01.sql
--     0027       … supabase/apply/pending_2026-09-01b.sql
--     0028       … supabase/apply/pending_2026-09-01c.sql
--     0029       … supabase/apply/pending_2026-09-01d.sql
--     0030       … supabase/apply/pending_2026-09-01e.sql
--     0031       … supabase/apply/pending_2026-09-01f.sql
--     0032       … supabase/apply/pending_2026-09-02.sql
--     0034〜0040 … supabase/apply/pending_2026-09-04.sql
--     0041       … supabase/apply/pending_2026-09-05.sql
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
  union all select '0032 セッションの記録(メモ)の置き場',
    exists (select 1 from pg_tables where tablename = 'lesson_notes'), 14
  union all select '0033 演習の種類にディスカッションを足す',
    exists (select 1 from pg_constraint
            where conname = 'material_sections_type_check'
              and pg_get_constraintdef(oid) like '%discussion%'), 15
  union all select '0034 演習の種類に誤り訂正を足す(穴埋めの置き換え)',
    exists (select 1 from pg_constraint
            where conname = 'material_sections_type_check'
              and pg_get_constraintdef(oid) like '%error_correction%'), 16
  union all select '0035 内容の理解に、設問と解答の訳を足す',
    exists (select 1 from information_schema.columns
            where table_name = 'material_items' and column_name = 'answer_ja'), 17
  union all select '0036 見出しに、小さな訳を添える',
    exists (select 1 from information_schema.columns
            where table_name = 'materials' and column_name = 'headline_ja'), 18
  union all select '0037 教材の種類に「会議」を足す',
    exists (select 1 from pg_constraint
            where conname = 'materials_kind_check'
              and pg_get_constraintdef(oid) like '%meeting%'), 19
  union all select '0038 単語帳を「続けて押した回数」で卒業させる',
    exists (select 1 from information_schema.columns
            where table_name = 'word_reviews' and column_name = 'learn_streak'), 20
  union all select '0039 一覧の「覚えた」を、積んだ語にだけ出す',
    exists (select 1 from pg_proc
            where proname = 'review_words'
              and pg_get_function_result(oid) like '%learn_streak%'), 21
  union all select '0040 Quick Response の復習',
    exists (select 1 from pg_tables where tablename = 'qr_reviews'), 22
  union all select '0041 ゲストの記録を、まとめて消せるようにする',
    exists (select 1 from pg_proc where proname = 'erase_learner'), 23
) t order by 順;
