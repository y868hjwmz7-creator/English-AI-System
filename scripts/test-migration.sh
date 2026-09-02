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

# ---------------------------------------------------------------------------
# **最初からもう一度、全部を通す。**
#
#   上のループは「1ファイルを2回」しか試していない。ところが利用者は
#   supabase/apply/*.sql を**まとめて貼る**ので、実際には
#   「0001 から 0018 までを、頭からもう一度」が起きる。
#
#   ここを見ていなかったために、0015 が 0018 のあとに走ると
#   「cannot change return type of existing function」で止まる、
#   という穴を見落とした(2026-08)。**利用者の貼り方で試す。**
# ---------------------------------------------------------------------------
echo
echo "▶ 最初から全部をもう一度実行(まとめて貼り直したときと同じ順序)"
for f in supabase/migrations/*.sql; do
  run "-d $DB -f $f"
done

# 同じ名前の関数が2つ残っていないか。残ると PostgREST が
# 「どちらか分からない」と断り、画面からは呼べなくなる
# 拡張機能(pgvector など)が持ち込む同名の関数は数えない。
# あれは向こうの都合であって、こちらの移行の重複ではない
dup=$(su postgres -c "psql -d $DB -tAc \"
  select string_agg(proname || '(' || n || ')', ', ')
  from (select p.proname, count(*) n from pg_proc p
        join pg_namespace ns on ns.oid = p.pronamespace
        where ns.nspname = 'public'
          and not exists (select 1 from pg_depend d
                          where d.objid = p.oid and d.deptype = 'e')
        group by p.proname having count(*) > 1) x;\"")
if [ -n "$dup" ]; then
  echo "❌ 同じ名前の関数が2つ以上あります: $dup"
  exit 1
fi
echo "  同じ名前の関数の重なり: なし"

# ---------------------------------------------------------------------------
# **画面が作れる演習の種類が、表の制約に全部入っているか。**
#
#   ディスカッションを足したとき、画面と窓口には足したのに
#   `material_sections_type_check` に足し忘れ、**教材を発行した瞬間に**
#   「violates check constraint」で止まった(2026-09 実機)。
#   lint もビルドも通るので、作ってみるまで分からない。ここで見張る。
# ---------------------------------------------------------------------------
echo "▶ 画面の演習の種類が、表の制約に全部入っているか確かめる"
typedef=$(su postgres -c "psql -d $DB -tAc \"
  select pg_get_constraintdef(oid) from pg_constraint
  where conname = 'material_sections_type_check';\"")
node scripts/check-exercise-types.mjs "$typedef"

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

# ---------------------------------------------------------------------------
# 利用者が Supabase に貼る確認 SQL も、ここで毎回まわす。
#
# **この確認 SQL 自体が古びる。** 移行を足したのに確認項目を足し忘れると、
# 「全部 OK」と出ているのに入っていない、という最悪の見え方になる。
# ---------------------------------------------------------------------------
# ---------------------------------------------------------------------------
# **利用者に渡す「貼る SQL」も、そのまま貼れるか確かめる。**
#
#   supabase/apply/*.sql は、移行ファイルを抜き出して並べたものである。
#   利用者は**そろっている DB に、あとから1つだけ貼る**ことがあるので、
#   「順番に全部流す」だけでは足りない。
#
#   実際、0027 は `review_words()` を drop せずに作り直していた。
#   書いた時点では返す列が同じだったが、**あとから 0028 が列を増やした。**
#   そのため 0027 だけを貼り直すと
#   `cannot change return type of existing function` で止まった(2026-09)。
#   全部を順に流す検証では、手前の 0024 が drop してくれるので気づけない。
# ---------------------------------------------------------------------------
echo
echo "▶ 利用者に渡す「貼る SQL」を、そろった DB に貼ってみる"
for f in supabase/apply/pending_*.sql; do
  db="${DB}_apply"
  su postgres -c "psql -q -c 'drop database if exists $db;'"
  su postgres -c "psql -q -c 'create database $db template $DB;'"
  out=$(su postgres -c "psql -v ON_ERROR_STOP=1 -q -d $db -f $f" 2>&1) || {
    printf '%s\n' "$out" | grep -E 'ERROR|FATAL' || printf '%s\n' "$out"
    su postgres -c "psql -q -c 'drop database if exists $db;'"
    echo "❌ $f は、そろった DB に貼れませんでした"
    exit 1
  }
  su postgres -c "psql -q -c 'drop database if exists $db;'"
  echo "  ✓ $(basename "$f")"
done

echo
echo "▶ 利用者に渡す確認 SQL(verify_migrations.sql)"
db="${DB}_verify"
su postgres -c "psql -q -c 'drop database if exists $db;'"
su postgres -c "psql -q -c 'create database $db template $DB;'"
verify_out=$(su postgres -c "psql -v ON_ERROR_STOP=1 -d $db -tA -f supabase/test/verify_migrations.sql" 2>&1) || {
  echo "$verify_out"; echo "❌ 確認 SQL が実行できませんでした"; exit 1; }
su postgres -c "psql -q -c 'drop database if exists $db;'"
ng=$(printf '%s\n' "$verify_out" | grep -c 'まだです' || true)
total=$(printf '%s\n' "$verify_out" | grep -c '|' || true)
echo "  確認項目 $total 件 / まだのもの $ng 件"
if [ "$ng" -ne 0 ]; then
  printf '%s\n' "$verify_out" | grep 'まだです'
  echo "❌ 確認 SQL に「まだです」があります"
  exit 1
fi

echo
echo "✅ 検証はすべて意図どおりです"
