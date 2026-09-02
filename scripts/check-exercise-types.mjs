/**
 * **画面が作れる演習の種類が、表の制約に全部入っているか**を確かめる。
 *
 * 【なぜ要るか】(2026-09 実機)
 *
 *   ディスカッションを足したとき、画面(`exerciseTypes.js`)と窓口
 *   (`generate-material`)には足したが、**表の制約に足し忘れた。**
 *   教材を発行しようとして、初めてこう出た。
 *
 *     演習を登録できませんでした: new row for relation "material_sections"
 *     violates check constraint "material_sections_type_check"
 *
 *   `npm run lint` も `npm run build` も通る。**作ってみるまで分からない。**
 *   だから機械で見張る。
 *
 * 使い方(`scripts/test-migration.sh` から呼ばれる):
 *
 *     node scripts/check-exercise-types.mjs "<制約の定義そのまま>"
 *
 * 制約の定義は `pg_get_constraintdef()` の文字列。そこから
 * `'...'` を取り出したものが「表が受け付ける種類」である。
 */
import { EXERCISE_TYPES } from '../src/data/exerciseTypes.js'

const def = process.argv[2] ?? ''
if (!def) {
  console.error('❌ 制約 material_sections_type_check が見つかりません')
  process.exit(1)
}

// 定義の中の 'xxx' を全部拾う
const allowed = new Set([...def.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]))
const missing = EXERCISE_TYPES.map((t) => t.id).filter((id) => !allowed.has(id))

if (missing.length) {
  console.error(`❌ 表の制約に入っていない演習の種類があります: ${missing.join(', ')}`)
  console.error('   supabase/migrations の制約 material_sections_type_check に足してください。')
  console.error('   (画面・窓口・制約の3か所に足す。1か所でも抜けると発行で止まります)')
  process.exit(1)
}

console.log(`  画面の演習の種類 ${EXERCISE_TYPES.length} 個は、すべて表の制約に入っています`)
