-- ============================================================================
-- 「行のある DB」を作る。**貼り直しの検証のためだけ**に使う。
--
-- 【なぜ要るのか】(2026-09 実機)
--   利用者が `supabase/apply/pending_matome.sql` をもう一度貼ったところ、
--
--       ERROR: 23514: check constraint "materials_kind_check"
--       of relation "materials" is violated by some row
--
--   で止まった。ところが `scripts/test-migration.sh` は**全部緑**だった。
--   理由は単純で、**検証の DB には行が1つも無かった**からである。
--   `check (… in (…))` を書き直す SQL は、**すでにある行**と食い違ったときに
--   だけ止まる。空の表に対しては、どんなに狭い一覧でも通ってしまう。
--
--   だから「そろった DB」に**許されている値を1つずつ実際に入れて**から、
--   もう一度貼ってみる。**空の表で試すのは、試したことにならない。**
--
-- 【何を入れるか】
--   **一覧はここに書かない。** 表の制約(`pg_get_constraintdef`)から
--   読み取って、**許されている値ぜんぶ**を1行ずつ入れる。
--   こうすれば、あとで種類を足したときも**書き足さずに**検証が付いてくる
--   (書き写すと、足し忘れたところだけ見張られなくなる)。
--
-- 【どこまで影響するか】
--   検証用の複製 DB にしか使わない。利用者の Supabase には貼らない。
-- ============================================================================

-- ログインの行 → トリガーが profiles を作る
insert into auth.users (id, email)
  values ('99999999-9999-9999-9999-999999999999', 'seed@example.com')
  on conflict do nothing;
update public.profiles set role = 'trainer', display_name = '検証用トレーナー'
  where id = '99999999-9999-9999-9999-999999999999';

-- ① 教材の種類 … 許されている値を1つずつ
do $$
declare v text; m uuid;
begin
  for v in
    select (regexp_matches(pg_get_constraintdef(oid), '''([a-z_]+)''', 'g'))[1]
    from pg_constraint where conname = 'materials_kind_check'
  loop
    insert into public.materials (title, level, kind, created_by)
      values ('検証用 ' || v, 'A2', v, '99999999-9999-9999-9999-999999999999')
      returning id into m;
    raise notice '  教材の種類 % を入れました', v;
  end loop;
end $$;

-- ② 演習の種類 … 許されている値を1つずつ(教材は①の1本目にぶら下げる)
do $$
declare v text; m uuid; s uuid; n int := 0;
begin
  select id into m from public.materials
    where created_by = '99999999-9999-9999-9999-999999999999' order by created_at limit 1;
  for v in
    select (regexp_matches(pg_get_constraintdef(oid), '''([a-z_]+)''', 'g'))[1]
    from pg_constraint where conname = 'material_sections_type_check'
  loop
    n := n + 1;
    insert into public.material_sections (material_id, seq, exercise_type)
      values (m, n, v) returning id into s;
    -- 中の問も1つ入れる(設問の側にも制約が増えるかもしれない)
    insert into public.material_items (material_id, section_id, seq, prompt_en)
      values (m, s, 1, 'This is a seed row.');
  end loop;
  raise notice '  演習の種類を % 種類ぶん入れました', n;
end $$;
