#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# supabase/migrations/*.sql を、手元の PostgreSQL で実際に実行して確かめる。
#
#   使い方:  bash scripts/test-migration.sh
#
# Supabase に貼り付ける前に、構文の誤りやテーブルの作成順の誤りを
# ここで見つけるためのもの。毎回まっさらなデータベースを作り直すので、
# 「2回実行しても通るか」も確認できる。
# ---------------------------------------------------------------------------
set -euo pipefail

DB=migration_test
PSQL=(su postgres -c)

run() { su postgres -c "psql -v ON_ERROR_STOP=1 -q $*"; }

echo "▶ まっさらなデータベースを作り直す"
su postgres -c "psql -q -c 'drop database if exists $DB;'"
su postgres -c "psql -q -c 'create database $DB;'"

echo "▶ Supabase 環境の最小の再現を入れる"
run "-d $DB -f supabase/test/supabase_stub.sql"

for f in supabase/migrations/*.sql; do
  echo "▶ $f を実行(1回目)"
  run "-d $DB -f $f"
  echo "▶ $f を実行(2回目 — 何度でも実行できることの確認)"
  run "-d $DB -f $f"
done

echo "▶ 出来たものを確認"
su postgres -c "psql -d $DB -tAc \"
  select 'テーブル: ' || count(*) from pg_tables where schemaname='public';\""
su postgres -c "psql -d $DB -tAc \"
  select 'RLS未設定のテーブル: ' || coalesce(string_agg(tablename, ', '), 'なし')
  from pg_tables where schemaname='public' and not rowsecurity;\""
su postgres -c "psql -d $DB -tAc \"
  select 'ポリシー: ' || count(*) from pg_policies where schemaname in ('public','storage');\""
su postgres -c "psql -d $DB -tAc \"
  select '弱点タグ: ' || count(*) from public.weakness_tags;\""

echo "✅ すべて通りました"

echo
echo "▶ RLS(アクセス制御)が意図どおりか確かめる"
su postgres -c "psql -v ON_ERROR_STOP=1 -d $DB -f supabase/test/rls_test.sql" 2>&1 \
  | sed 's/^psql:[^ ]* NOTICE:  //; s/^NOTICE:  //' \
  | grep -vE '^\s*(expect|expect_denied|-+|\(1 row\))?\s*$'
echo "✅ アクセス制御も意図どおりです"
