#!/usr/bin/env node
/**
 * **値の一覧を書き直すファイルは、どれも同じ一覧を書く。**
 *
 * 【なぜ要るのか】(2026-09 実機)
 *   利用者が `supabase/apply/pending_matome.sql` を**もう一度貼った**ところ、
 *   こう出て止まった。
 *
 *       ERROR: 23514: check constraint "materials_kind_check"
 *       of relation "materials" is violated by some row
 *
 *   原因は**中身の食い違い**である。まとめた1つの中で
 *   `materials_kind_check` が**2回**書き直されており、
 *
 *       0043 の段 … pattern / reading / dialogue / meeting / speech / word / phrase / passage
 *       0047 の段 … 上に **vocab** を足したもの
 *
 *   前の段のほうが**狭い。** すでに `kind = 'vocab'` の教材がある DB に
 *   貼ると、そこで止まる。**まっさらな DB では絶対に起きない**
 *   (行が1つも無いので、狭い一覧でも通る)。
 *   `scripts/test-migration.sh` は空の DB でしか試していなかったので、
 *   **検証を全部通っていた。**
 *
 * 【決まり】
 *   `check (… in (…))` の一覧を書き直すファイルは、**いちばん新しい一覧**を
 *   書く。あとで誰かが値を足すかもしれないからである。
 *   「関数を作り直すファイルは、返す列を変えていなくても drop を置く」
 *   (CLAUDE.md)とまったく同じ考え方。
 *
 *   まっさらな DB に順に流すぶんには、先の段で使わない値を許していても
 *   **何も起きない**(その値を作る仕組みが、まだ無い)。
 *   狭いままにしておく利点は1つも無く、**貼り直せなくなる害だけ**が残る。
 *
 * 【何を見るか】
 *   `supabase/migrations/*.sql` と `supabase/apply/*.sql` の中の
 *   `add constraint <名前> check (<列> in ( … ))` を全部集め、
 *   **同じ名前の制約は、どのファイルでも同じ一覧か**を確かめる。
 *   1つでも欠けていたら、そのファイル名と欠けている値を出して赤くする。
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const DIRS = ['supabase/migrations', 'supabase/apply']

/** 見張る制約。**値を足すことがあるものだけ**を並べる */
const WATCH = ['materials_kind_check', 'material_sections_type_check']

/**
 * `add constraint <名前> check ( … in ( … ) )` を取り出す。
 *
 * **改行と空白は、いくつあってもよい。** 名前と `check` のあいだで
 * 改行しているファイルが実際にあり(0007)、
 * 文字列の突き合わせだけで探していたときは**そこを見逃していた**
 * (行のある DB に流して、初めて赤くなった)。
 */
function blocksIn(text, name) {
  const out = []
  const head = new RegExp(`add\\s+constraint\\s+${name}\\s+check`, 'g')
  for (;;) {
    const m = head.exec(text)
    if (!m) break
    const i = m.index
    const at = i + m[0].length
    // ここから `));` までが1つの塊
    const end = text.indexOf('));', at)
    if (end < 0) break
    const body = text.slice(at, end)
    // 行の頭が `--` のものは注釈。値と取り違えない
    const values = body
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n')
      .match(/'[a-z_]+'/g)
    out.push({ line: text.slice(0, i).split('\n').length, values: values ?? [] })
  }
  return out
}

const files = []
for (const dir of DIRS) {
  for (const name of readdirSync(join(ROOT, dir)).sort()) {
    if (!name.endsWith('.sql')) continue
    files.push({ path: `${dir}/${name}`, text: readFileSync(join(ROOT, dir, name), 'utf8') })
  }
}

let bad = 0
for (const name of WATCH) {
  const found = []
  for (const f of files) {
    for (const b of blocksIn(f.text, name)) found.push({ ...b, path: f.path })
  }
  if (!found.length) {
    console.error(`❌ ${name} … 書いてあるファイルが1つもありません`)
    console.error('   名前を変えたのなら、この一覧(WATCH)も直してください')
    bad += 1
    continue
  }
  // すべての塊の**足し合わせ**が、あるべき一覧
  const all = new Set()
  for (const b of found) for (const v of b.values) all.add(v)

  console.log(`\n▶ ${name} … ${found.length} か所 / 値 ${all.size} 個`)
  for (const b of found) {
    const have = new Set(b.values)
    const miss = [...all].filter((v) => !have.has(v))
    if (miss.length) {
      console.error(`❌ ${b.path}:${b.line} … 足りない: ${miss.join(', ')}`)
      bad += 1
    }
  }
  if (!bad) console.log('  どのファイルも同じ一覧です')
}

if (bad) {
  console.error(`\n❌ ${bad} か所で一覧が食い違っています。`)
  console.error('   **狭いほうに合わせない。** 足りない値を書き足してください。')
  console.error('   狭い一覧のファイルは、すでにその値を使っている DB に')
  console.error('   貼り直すと "violated by some row" で止まります。')
  process.exit(1)
}
console.log('\n✅ 値の一覧は、どのファイルでもそろっています')
