-- ============================================================================
-- 同じ英文が二度出ないことを確かめる
--
-- 「AI に『同じ文を作るな』と指示してある」だけでは保証にならない。
-- 指示を守らなかった場合に、機械的に弾けるかどうかをここで確かめる。
--
-- 確かめること:
--   ・記号や大文字小文字だけ違う文を、同じ文と見なせるか
--   ・穴埋めの「___」入りの文と、その解答文が同じ文と見なせるか
--   ・設問を登録すると台帳に自動で積まれるか(積み忘れが起きないか)
--   ・そのゲストに共有済みの文を「既出」と判定できるか
--   ・同じ弱点のライブラリにある文を「既出」と判定できるか
--   ・関係のないゲスト・関係のない弱点では「既出」にしないか
--   ・トレーナー以外は照合を呼べないか
-- ============================================================================

create or replace function pg_temp.expect3(label text, actual anyelement, wanted anyelement)
returns void language plpgsql as $$
begin
  if actual is distinct from wanted then
    raise exception '✗ % … 期待 % / 実際 %', label, wanted, actual;
  end if;
  raise notice '✓ %', label;
end $$;

create or replace function pg_temp.expect_denied3(label text, stmt text)
returns void language plpgsql as $$
begin
  execute stmt;
  raise exception '✗ % … 通ってしまった', label;
exception
  when insufficient_privilege or foreign_key_violation or check_violation then
    raise notice '✓ % (拒否された)', label;
  when raise_exception then
    if sqlerrm like '✗%' then raise; end if;
    raise notice '✓ % (拒否された: %)', label, sqlerrm;
end $$;

-- ── 下準備(superuser。RLS は通さない) ──────────────────────────
insert into auth.users (id, email) values
  ('d1111111-1111-1111-1111-111111111111', 'dedup-trainer@example.com'),
  ('d2222222-2222-2222-2222-222222222222', 'dedup-guest-a@example.com'),
  ('d3333333-3333-3333-3333-333333333333', 'dedup-guest-b@example.com');

update public.profiles set role = 'trainer', display_name = 'トレーナー'
  where id = 'd1111111-1111-1111-1111-111111111111';
update public.profiles set display_name = 'ゲストA'
  where id = 'd2222222-2222-2222-2222-222222222222';
update public.profiles set display_name = 'ゲストB'
  where id = 'd3333333-3333-3333-3333-333333333333';

-- ゲストAだけを担当する(ゲストBは担当外)
insert into public.learner_admins (admin_id, learner_id) values
  ('d1111111-1111-1111-1111-111111111111', 'd2222222-2222-2222-2222-222222222222');

-- ── そろえ方そのものの確認 ────────────────────────────────────
select pg_temp.expect3('大文字小文字と記号の違いを無視する',
  public.norm_en('I have work to do.') = public.norm_en('i have WORK to do!!'), true);

select pg_temp.expect3('穴埋めの「___」入りの文は、その解答文と同じ形になる',
  public.norm_en('I have several emails ___ to reply to.')
    = public.norm_en('I have several emails to reply to.'), true);

select pg_temp.expect3('前後の空白や連続した空白を無視する',
  public.norm_en('  Do  you have anything to eat? ')
    = public.norm_en('Do you have anything to eat?'), true);

select pg_temp.expect3('日本語だけの文字列は台帳に載せない(null になる)',
  public.norm_en('返信すべきメールが何通かあります。'), null::text);

select pg_temp.expect3('別の文は別の形になる',
  public.norm_en('I have work to do.') = public.norm_en('I have a job to do.'), false);

-- ── トレーナーとして教材を1つ作る ─────────────────────────────
set role authenticated;
set request.jwt.claim.sub = 'd1111111-1111-1111-1111-111111111111';

insert into public.materials (id, title, level, kind, status, created_by)
values ('dddddddd-0000-0000-0000-000000000001', '名詞 + to不定詞', 'B1', 'pattern', 'published',
        'd1111111-1111-1111-1111-111111111111');

insert into public.material_tags (material_id, tag_id)
values ('dddddddd-0000-0000-0000-000000000001', 'infinitive');

insert into public.material_sections (id, material_id, seq, exercise_type)
values ('dddddddd-1111-0000-0000-000000000001',
        'dddddddd-0000-0000-0000-000000000001', 1, 'translate_en_ja');

insert into public.material_items (material_id, section_id, seq, prompt_en, prompt_ja)
values
  ('dddddddd-0000-0000-0000-000000000001', 'dddddddd-1111-0000-0000-000000000001', 1,
   'I have several emails to reply to.', '返信すべきメールが何通かあります。'),
  ('dddddddd-0000-0000-0000-000000000001', 'dddddddd-1111-0000-0000-000000000001', 2,
   'Do you have anything to eat?', '何か食べるものはありますか。');

-- ── 台帳が自動で積まれているか ────────────────────────────────
select pg_temp.expect3('設問を登録すると英文が台帳に積まれる',
  (select count(*)::int from public.material_sentences
   where material_id = 'dddddddd-0000-0000-0000-000000000001'), 2);

select pg_temp.expect3('台帳にはそろえた形で入っている',
  (select count(*)::int from public.material_sentences
   where text_norm = 'i have several emails to reply to'), 1);

-- ── まだ誰にも共有していない段階 ──────────────────────────────
-- ライブラリには既にあるので、同じ弱点なら「既出」になる。
select pg_temp.expect3('同じ弱点のライブラリにある文は既出になる',
  (select count(*)::int from public.used_sentences(
     null,
     array['infinitive'],
     array['I have several emails to reply to.'])), 1);

select pg_temp.expect3('関係のない弱点では既出にしない',
  (select count(*)::int from public.used_sentences(
     null,
     array['l-r'],
     array['I have several emails to reply to.'])), 0);

select pg_temp.expect3('まだ共有していないので、ゲストA基準では既出にしない',
  (select count(*)::int from public.used_sentences(
     'd2222222-2222-2222-2222-222222222222',
     null,
     array['I have several emails to reply to.'])), 0);

-- ── ゲストAに共有する ─────────────────────────────────────────
insert into public.assignments (material_id, learner_id, assigned_by)
values ('dddddddd-0000-0000-0000-000000000001',
        'd2222222-2222-2222-2222-222222222222',
        'd1111111-1111-1111-1111-111111111111');

select pg_temp.expect3('共有したあとは、ゲストA基準で既出になる',
  (select count(*)::int from public.used_sentences(
     'd2222222-2222-2222-2222-222222222222',
     null,
     array['I have several emails to reply to.'])), 1);

select pg_temp.expect3('記号と大文字小文字が違うだけの文も既出になる',
  (select count(*)::int from public.used_sentences(
     'd2222222-2222-2222-2222-222222222222',
     null,
     array['i have several emails to reply to!'])), 1);

select pg_temp.expect3('穴埋めの形で出し直そうとしても既出になる',
  (select count(*)::int from public.used_sentences(
     'd2222222-2222-2222-2222-222222222222',
     null,
     array['I have several emails ___ to reply to.'])), 1);

select pg_temp.expect3('弱点が違っても、そのゲストに出した文は既出になる',
  (select count(*)::int from public.used_sentences(
     'd2222222-2222-2222-2222-222222222222',
     array['l-r'],
     array['Do you have anything to eat?'])), 1);

select pg_temp.expect3('まだ出していない文は既出にならない',
  (select count(*)::int from public.used_sentences(
     'd2222222-2222-2222-2222-222222222222',
     array['infinitive'],
     array['I have a report to finish.'])), 0);

select pg_temp.expect3('候補をまとめて渡すと、既出のものだけが返る',
  (select count(*)::int from public.used_sentences(
     'd2222222-2222-2222-2222-222222222222',
     array['infinitive'],
     array['I have several emails to reply to.',
           'Do you have anything to eat?',
           'I have a report to finish.',
           'She has a lot of work to do.'])), 2);

-- ── 設問を消したら台帳からも消える ────────────────────────────
delete from public.material_items
where material_id = 'dddddddd-0000-0000-0000-000000000001' and seq = 2;

select pg_temp.expect3('設問を消すと、その英文は台帳から外れる',
  (select count(*)::int from public.material_sentences
   where text_norm = 'do you have anything to eat'), 0);

-- ── 意味の近さでの判定(0009) ──────────────────────────────────
--
-- 実際の変換(gte-small)は Edge Function の中でしか動かないため、
-- ここでは並びを手で作って、**判定の理屈が正しいか**だけを確かめる。
-- 「同じ向きなら 1、直角なら 0」という性質を使う。

reset role;

-- 384個の数値。pos の位置だけ 1、other の位置に w を置く。
create or replace function pg_temp.onehot(pos int, other int default null, w real default 0)
returns vector(384) language sql as $$
  select ('[' || array_to_string(array(
    select case when i = pos then 1::real
                when i = other then w
                else 0::real end
    from generate_series(1, 384) i), ',') || ']')::vector(384);
$$;

-- 関数に渡すための JSON にする
create or replace function pg_temp.as_json(v vector) returns jsonb language sql as $$
  select to_jsonb(string_to_array(btrim(v::text, '[]'), ',')::real[]);
$$;

-- 残っている英文(1文)に並びを与える
insert into public.sentence_embeddings (text_norm, embedding)
values ('i have several emails to reply to', pg_temp.onehot(1));

set role authenticated;
set request.jwt.claim.sub = 'd1111111-1111-1111-1111-111111111111';

select pg_temp.expect3('同じ向きの文は「近すぎる」と判定される',
  (select count(*)::int from public.similar_sentences(
     'd2222222-2222-2222-2222-222222222222', null,
     jsonb_build_array(pg_temp.as_json(pg_temp.onehot(1))), 0.92)), 1);

select pg_temp.expect3('どれと近いかが返る',
  (select matched from public.similar_sentences(
     'd2222222-2222-2222-2222-222222222222', null,
     jsonb_build_array(pg_temp.as_json(pg_temp.onehot(1))), 0.92)),
  'i have several emails to reply to');

select pg_temp.expect3('ほとんど同じ向き(近さ約0.995)も弾かれる',
  (select count(*)::int from public.similar_sentences(
     'd2222222-2222-2222-2222-222222222222', null,
     jsonb_build_array(pg_temp.as_json(pg_temp.onehot(1, 2, 0.1))), 0.92)), 1);

select pg_temp.expect3('向きが違う文は弾かれない',
  (select count(*)::int from public.similar_sentences(
     'd2222222-2222-2222-2222-222222222222', null,
     jsonb_build_array(pg_temp.as_json(pg_temp.onehot(5))), 0.92)), 0);

select pg_temp.expect3('しきい値を上げると、少し違うだけの文は通る',
  (select count(*)::int from public.similar_sentences(
     'd2222222-2222-2222-2222-222222222222', null,
     jsonb_build_array(pg_temp.as_json(pg_temp.onehot(1, 2, 0.5))), 0.92)), 0);

select pg_temp.expect3('候補をまとめて渡すと、近すぎるものだけ返る',
  (select count(*)::int from public.similar_sentences(
     'd2222222-2222-2222-2222-222222222222', null,
     jsonb_build_array(
       pg_temp.as_json(pg_temp.onehot(1)),
       pg_temp.as_json(pg_temp.onehot(5)),
       pg_temp.as_json(pg_temp.onehot(1, 2, 0.05))), 0.92)), 2);

select pg_temp.expect3('何番目の候補かが返る(0から数える)',
  (select min(idx)::int from public.similar_sentences(
     'd2222222-2222-2222-2222-222222222222', null,
     jsonb_build_array(
       pg_temp.as_json(pg_temp.onehot(5)),
       pg_temp.as_json(pg_temp.onehot(1))), 0.92)), 1);

select pg_temp.expect3('関係のないゲストの範囲では判定しない',
  (select count(*)::int from public.similar_sentences(
     null, array['l-r'],
     jsonb_build_array(pg_temp.as_json(pg_temp.onehot(1))), 0.92)), 0);

-- ── まだ変換していない英文を探す ──────────────────────────────
reset role;
insert into public.material_items (material_id, section_id, seq, prompt_en, prompt_ja)
values ('dddddddd-0000-0000-0000-000000000001', 'dddddddd-1111-0000-0000-000000000001', 3,
        'She has a report to finish.', '彼女には仕上げるべき報告書があります。');
set role authenticated;
set request.jwt.claim.sub = 'd1111111-1111-1111-1111-111111111111';

select pg_temp.expect3('並びの無い英文が拾える',
  (select count(*)::int from public.sentences_without_embedding(
     'd2222222-2222-2222-2222-222222222222', null, 200)), 1);

select pg_temp.expect3('拾えるのは、まだ変換していない文だけ',
  (select array_agg(s) from public.sentences_without_embedding(
     'd2222222-2222-2222-2222-222222222222', null, 200) as s),
  array['she has a report to finish']);

select pg_temp.expect3('上限を0にすると何も返らない',
  (select count(*)::int from public.sentences_without_embedding(
     'd2222222-2222-2222-2222-222222222222', null, 0)), 0);

-- ── 混合ドリル:1問ごとの弱点(0009) ──────────────────────────
update public.material_items set tag_id = 'infinitive'
  where material_id = 'dddddddd-0000-0000-0000-000000000001' and seq = 1;

select pg_temp.expect3('1問ごとに弱点を持たせられる',
  (select tag_id from public.material_items
   where material_id = 'dddddddd-0000-0000-0000-000000000001' and seq = 1), 'infinitive');

select pg_temp.expect_denied3('存在しない弱点は持たせられない', $$
  update public.material_items set tag_id = 'nonexistent-tag'
  where material_id = 'dddddddd-0000-0000-0000-000000000001' and seq = 1
$$);

-- ── 呼べる人の制限 ────────────────────────────────────────────
select pg_temp.expect_denied3('担当していないゲストは指定できない', $$
  select * from public.used_sentences(
    'd3333333-3333-3333-3333-333333333333', null, array['I have work to do.'])
$$);

set request.jwt.claim.sub = 'd2222222-2222-2222-2222-222222222222';

select pg_temp.expect_denied3('ゲストは照合を呼べない', $$
  select * from public.used_sentences(null, array['infinitive'], array['I have work to do.'])
$$);

select pg_temp.expect_denied3('ゲストは意味の近さの照合を呼べない', $$
  select * from public.similar_sentences(null, array['infinitive'], '[]'::jsonb, 0.92)
$$);

select pg_temp.expect_denied3('ゲストは未変換の英文を読み出せない', $$
  select * from public.sentences_without_embedding(null, array['infinitive'], 10)
$$);

select pg_temp.expect3('ゲストには英文の並びが見えない',
  (select count(*)::int from public.sentence_embeddings), 0);

select pg_temp.expect3('ゲストには英文の台帳が見えない',
  (select count(*)::int from public.material_sentences), 0);

reset role;
