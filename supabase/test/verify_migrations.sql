-- ============================================================================
-- 移行SQLが全部入ったかを確かめる(いつ実行しても安全)
--
-- 【使い方】
--   Supabase の SQL Editor に貼って Run するだけ。
--   何も書き換えず、何も消しません。**見るだけ**の SQL です。
--
-- 【成功したときの見え方】
--   24行の表が出て、すべて「✅ OK」になります。
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
  select '⑨ 弱点タグがある', (
    select count(*) >= 38 from public.weakness_tags), 9
  union all
  select '⑩ レベル(CEFR)がある(0005)', exists (
    select 1 from information_schema.columns
    where table_name = 'profiles' and column_name = 'cefr'), 10
  union all
  select '⑪ スコアの表がある(0005)', exists (
    select 1 from pg_tables where tablename = 'learner_scores'), 11
  union all
  select '⑫ レベルが14段階ある(0006)', exists (
    select 1 from pg_constraint
    where conname = 'profiles_cefr_check'
      and pg_get_constraintdef(oid) like '%Proficiency%'), 12
  union all
  select '⑬ 演習の表がある(0007)', exists (
    select 1 from pg_tables where tablename = 'material_sections'), 13
  union all
  select '⑭ 設問に与える語・設問・解答がある(0007)', (
    select count(*) = 4 from information_schema.columns
    where table_name = 'material_items'
      and column_name in ('hint', 'question', 'answer', 'audio_text')), 14
  union all
  select '⑮ 文型ドリルが選べる(0007)', exists (
    select 1 from pg_constraint
    where conname = 'materials_kind_check'
      and pg_get_constraintdef(oid) like '%pattern%'), 15
  union all
  select '⑯ 英文の台帳がある(0008)', exists (
    select 1 from pg_tables where tablename = 'material_sentences'), 16
  union all
  select '⑰ 英文をそろえる関数が正しく動く(0008)', (
    select public.norm_en('I have several emails ___ to reply to.')
         = public.norm_en('I have several emails to reply to.')), 17
  union all
  select '⑱ 既出の照合ができる(0008)', exists (
    select 1 from pg_proc where proname = 'used_sentences'), 18
  union all
  select '⑲ 英文の並び(意味の判定)の表がある(0009)', exists (
    select 1 from pg_tables where tablename = 'sentence_embeddings'), 19
  union all
  select '⑳ 意味の近さの照合ができる(0009)', exists (
    select 1 from pg_proc where proname = 'similar_sentences'), 20
  union all
  select '㉑ 1問ごとの弱点を持てる(0009・混合ドリル)', exists (
    select 1 from information_schema.columns
    where table_name = 'material_items' and column_name = 'tag_id'), 21
  union all
  select '㉒ リーディングと会話が選べる(0010)', (
    select pg_get_constraintdef(oid) like '%reading%'
       and pg_get_constraintdef(oid) like '%dialogue%'
    from pg_constraint where conname = 'materials_kind_check'), 22
  union all
  select '㉓ 見出し・ジャンル・場面・話題がある(0010)', (
    select count(*) = 4 from information_schema.columns
    where table_name = 'materials'
      and column_name in ('headline', 'genre', 'scene', 'topic')), 23
  union all
  select '㉔ 会話の話者を持てる(0010)', exists (
    select 1 from information_schema.columns
    where table_name = 'material_items' and column_name = 'speaker'), 24
  union all
  select '㉕ 語の意味の控えがある(0011)', exists (
    select 1 from pg_tables where tablename = 'word_glosses'), 25
  union all
  select '㉖ 意味の控えは読むだけ(書き込みのポリシーが無い)(0011)', (
    select count(*) = 0 from pg_policies
    where tablename = 'word_glosses' and cmd <> 'SELECT'), 26
  union all
  select '㉗ 知っていた / 知らなかった を持てる(0011)', exists (
    select 1 from pg_tables where tablename = 'word_reviews'), 27
  union all
  select '㉘ 復習語を取り出せる(0011)', exists (
    select 1 from pg_proc where proname = 'review_words'), 28
  union all
  select '㉙ 宿題に出た語句を取り出せる(0011)', exists (
    select 1 from pg_proc where proname = 'homework_words'), 29
  union all
  select '㉚ 語のそろえ方がある(0011)', (
    select public.norm_word('"Deployment,"') = 'deployment'), 30
) t order by 順;
