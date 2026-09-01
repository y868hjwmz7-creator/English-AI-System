-- ============================================================================
-- 移行SQLが全部入ったかを確かめる(いつ実行しても安全)
--
-- 【使い方】
--   Supabase の SQL Editor に貼って Run するだけ。
--   何も書き換えず、何も消しません。**見るだけ**の SQL です。
--
-- 【成功したときの見え方】
--   40行の表が出て、すべて「✅ OK」になります。
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
  union all
  select '㉛ 意味を複数持てる(0012)', exists (
    select 1 from information_schema.columns
    where table_name = 'word_glosses' and column_name = 'senses'), 31
  union all
  select '㉜ 文脈ごとに控えを持てる(0012)', (
    select array_length(conkey, 1) = 2 from pg_constraint
    where conrelid = 'public.word_glosses'::regclass and contype = 'p'), 32
  union all
  select '㉝ 発音記号を持てる(0013)', exists (
    select 1 from information_schema.columns
    where table_name = 'word_glosses' and column_name = 'phonetic'), 33
  union all
  select '㉞ 弱点の見出しが6つに整理されている(0014)', (
    select count(distinct category) = 6 from public.weakness_tags), 34
  union all
  select '㉟ 「単語」の弱点タグがある(0014)', (
    select count(*) = 6 from public.weakness_tags where category = 'word'), 35
  union all
  select '㊱ 復習の箱と次に出す日がある(0015)', (
    select count(*) = 3 from information_schema.columns
    where table_name = 'word_reviews'
      and column_name in ('kind', 'box', 'due_on')), 36
  union all
  select '㊲ 印を付ける関数がある(0015)', exists (
    select 1 from pg_proc where proname = 'mark_word'), 37
  union all
  select '㊳ 間隔の決まりが入っている(0015)', (
    -- 知らなかった → 箱 0・翌日。**数字ごと確かめる**
    select prosrc like '%when 5 then 14%' from pg_proc where proname = 'mark_word'), 38
  union all
  select '㊴ 今日出すべきものだけに絞れる(0015)', (
    select count(*) = 4 from pg_proc p,
      unnest(p.proargnames) a where p.proname = 'review_words'
      and a in ('p_learner', 'p_status', 'p_limit', 'p_due_only')), 39
  union all
  select '㊵ 要点フレーズを持てる(0015)', exists (
    select 1 from information_schema.columns
    where table_name = 'material_items' and column_name = 'phrases'), 40
  union all
  select '㊶ 読み上げ音声の置き場がある(0016)', (
    select public from storage.buckets where id = 'tts'), 41
  union all
  select '㊷ 音声を置けるのは窓口だけ(0016)', (
    -- tts に書き込みを許すポリシーが**1つも無い**ことを確かめる。
    -- ここが緩むと、誰でも好きな音声を教材に紛れ込ませられる
    select count(*) = 0 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and cmd in ('INSERT', 'UPDATE', 'ALL')
      and coalesce(qual, '') || coalesce(with_check, '') like '%''tts''%'), 42
  union all
  select '㊸ 教材ごとに声を選べる(0017)', exists (
    select 1 from information_schema.columns
    where table_name = 'materials' and column_name = 'voice_ids'), 43
  union all
  select '㊹ 出会った文を控えられる(0018)', (
    select count(*) = 2 from information_schema.columns
    where table_name = 'word_reviews'
      and column_name in ('seen_in', 'seen_in_ja')), 44
  union all
  select '㊺ 復習の一覧が出会った文を返す(0018)', (
    select count(*) = 1 from pg_proc p, unnest(p.proargnames) a
    where p.proname = 'review_words' and a = 'p_due_only'
      and pg_get_function_result(p.oid) like '%seen_in%'), 45
  union all
  select '㊻ 続けた記録を残せる(0019)', exists (
    select 1 from pg_tables where tablename = 'vocab_days'), 46
  union all
  select '㊼ トレーナーが見た記録を残せる(0019)', exists (
    select 1 from pg_tables where tablename = 'wordbook_views'), 47
  union all
  select '㊽ 週の続き具合と業界別を数えられる(0019)', (
    select count(distinct proname) = 3 from pg_proc
    where proname in ('vocab_week', 'vocab_by_industry', 'note_wordbook_view')), 48
  union all
  select '㊾ 単語・フレーズに発音記号を持てる(0020)', exists (
    select 1 from information_schema.columns
    where table_name = 'material_items' and column_name = 'phonetic'), 49
  union all
  select '㊿ カタマリごとの訳を持てる(0021)', exists (
    select 1 from information_schema.columns
    where table_name = 'material_items' and column_name = 'chunks'
      and data_type = 'jsonb'), 50
  union all
  select '(51) 取り組みを裏で記録できる(0022)', exists (
    select 1 from pg_tables where tablename = 'practice_days'), 51
  union all
  select '(52) 取り組みを足す・まとめる関数がある(0022)', (
    select count(distinct proname) = 2 from pg_proc
    where proname in ('log_practice', 'learner_practice')), 52
  union all
  select '(53) リマインドを送れる(0022)', (
    select count(distinct proname) = 2 from pg_proc
    where proname in ('send_reminder', 'seen_reminder')), 53
  union all
  select '(54) ゲストが変えられるのは「見た」だけ(0022)', (
    -- **列単位の grant** が効いていること。行だけ絞っても列は絞れない
    select count(*) = 1 from information_schema.column_privileges
    where table_name = 'reminders' and privilege_type = 'UPDATE'
      and grantee = 'authenticated' and column_name = 'seen_at'), 54
  union all
  select '(55) 集計を教材の種類と内容で数える(0023)', (
    select count(distinct proname) = 4 from pg_proc
    where proname in ('school_by_kind', 'school_by_tag',
                      'school_by_level', 'school_practice')), 55
  union all
  select '(56) 全体の集計が、いまあるもので数え直されている(0023)', (
    -- study_logs の学習時間ではなく、practice_days の分になっていること
    select pg_get_function_result(p.oid) like '%practice_minutes_weekly%'
    from pg_proc p where p.proname = 'school_summary'), 56
  union all
  select '(57) 単語帳に「入った日」がある(0024)', exists (
    select 1 from information_schema.columns
    where table_name = 'word_reviews' and column_name = 'added_at'), 57
  union all
  select '(58) 復習の一覧が、入った日と教材名も返す(0024)', (
    select pg_get_function_result(p.oid) like '%material_title%'
       and pg_get_function_result(p.oid) like '%added_at%'
    from pg_proc p where p.proname = 'review_words'), 58
  union all
  select '(59) 途中経過をゲストと共有できる(0025)', exists (
    select 1 from pg_tables where tablename = 'material_progress'), 59
  union all
  select '(60) レッスンの記録をゲストのものにできる(0025)', (
    -- mark_word / log_practice が「誰の記録にするか」を受け取れること
    select count(*) = 2 from pg_proc p
    where p.proname in ('mark_word', 'log_practice')
      and pg_get_function_identity_arguments(p.oid) like '%uuid'), 60
  union all
  select '(61) スコアの範囲が実際の試験に合っている(0026)', (
    -- TOEIC 100〜990 / VERSANT 10〜90(新形式)
    select pg_get_constraintdef(c.oid) like '%100%990%'
       and pg_get_constraintdef(c.oid) like '%10%90%'
    from pg_constraint c where c.conname = 'learner_scores_range'), 61
) t order by 順;
