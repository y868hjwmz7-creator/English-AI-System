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

# ---------------------------------------------------------------------------
# 検証ファイルは、それぞれ「まっさらな DB の複製」の上で走らせる。
#
# 以前は1つの DB で続けて走らせていたため、先に走った検証が作った
# データが、あとの検証の数え上げを狂わせた(profiles が 5 のはずが 6)。
# 検証どうしが干渉すると、本当は壊れていないものが赤くなり、
# 本当に壊れているものを見落とす。複製は一瞬で作れるので、毎回分ける。
# ---------------------------------------------------------------------------
run_test() {           # run_test <検証ファイル> <見出し>
  local file=$1 title=$2 out status=0 db
  db="${DB}_$(basename "$file" .sql)"
  echo
  echo "▶ $title"
  su postgres -c "psql -q -c 'drop database if exists $db;'"
  su postgres -c "psql -q -c 'create database $db template $DB;'"

  # 出力を先に受け取る。パイプに直接つなぐと、psql が失敗しても
  # 後ろの grep の結果で成否が決まってしまい、赤くならない。
  out=$(su postgres -c "psql -v ON_ERROR_STOP=1 -d $db -f $file" 2>&1) || status=1

  printf '%s\n' "$out" \
    | sed 's/^psql:[^ ]* NOTICE:  //; s/^NOTICE:  //' \
    | grep -vE '^\s*(expect|expect2|expect3|expect_denied3|expect_denied|-+|\(1 row\)|INSERT [0-9]+ [0-9]+|UPDATE [0-9]+|DELETE [0-9]+|CREATE FUNCTION)?\s*$' || true

  su postgres -c "psql -q -c 'drop database if exists $db;'"
  if [ "$status" -ne 0 ]; then
    echo "❌ 「$title」で失敗しました"
    exit 1
  fi
}

run_test supabase/test/material_shape_test.sql "教材の形が実物のドリルを収められるか確かめる"
run_test supabase/test/dedup_test.sql          "同じ英文が二度出ないことを確かめる"
run_test supabase/test/rls_test.sql            "RLS(アクセス制御)が意図どおりか確かめる"
run_test supabase/test/vocab_test.sql          "語彙の定着(意味の控え・知っていた/知らなかった)を確かめる"

echo
echo "✅ 検証はすべて意図どおりです"
