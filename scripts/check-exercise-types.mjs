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
import { EXERCISE_TYPES, isBlankItem, isWrongShape } from '../src/data/exerciseTypes.js'

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

/*
 * ============================================================================
 * **出来上がった問を落とす検査**が、実機で出たものを本当に落とすか。
 *
 * 【なぜ要るか】(2026-09 実機・利用者の指摘)
 *
 *   > フレーズ作成でバグが出ています。
 *   > また、フレーズが英語的におかしいです。こういうバグは出ないようにしてください。
 *
 *   フレーズ20問のうち **1問目が空**(札だけで英文も訳も無い)で、
 *   それでも画面には「全 20 問」と出ていた。
 *   道具の形は `strict: true` で保証されているが、
 *   **空文字も「形としては正しい」**ので API は通してしまう。
 *
 *   落とす仕組みを入れても、**それ自体が壊れたら気づけない。**
 *   だから実機で出たものそのものを、ここに残して見張る。
 * ============================================================================
 */
const cases = [
  // [ 落とすべきか, 演習, 中身, 説明 ]
  [true,  'phrase', { prompt_en: '', prompt_ja: '', phonetic: '' },
    '実機で出た「空の1問目」'],
  [true,  'phrase', { prompt_en: 'read the room', prompt_ja: '', phonetic: 'riːd' },
    '訳が空'],
  [false, 'phrase', { prompt_en: 'read the room', prompt_ja: '空気を読む', phonetic: 'riːd' },
    'そろっている'],
  // 発音記号は 0020 より前の教材に無い。**無くても落とさない**
  [false, 'phrase', { prompt_en: 'read the room', prompt_ja: '空気を読む', phonetic: '' },
    '発音記号だけ無い(0020 より前の教材)'],
  // 別解は「あれば」の欄。**無いのがふつう**
  [false, 'translate_ja_en', { prompt_ja: '雨が降る', answer: 'It rains.', answer_alt: '' },
    '別解だけ無い'],
  [true,  'comprehension', { question: 'What did she buy?', answer: '' },
    '解答が空'],
  [true,  'discussion', { question: 'What would you do?', note: '' },
    '手がかりが空'],
]
for (const [want, type, item, why] of cases) {
  if (isBlankItem(type, item) !== want) {
    console.error(`❌ 空の問の判定がちがいます(${type} / ${why})`)
    process.exit(1)
  }
}

const shapes = [
  // 実機で出たもの。フレーズなのに1語 = それは単語である
  [true,  'phrase',     'beatmatch',            'フレーズが1語'],
  [false, 'phrase',     'read the room',        'フレーズが2語以上'],
  [false, 'phrase',     "Sorry, that's not really my thing.", '決まり文句'],
  [true,  'vocabulary', 'read the room',        '単語が2語以上'],
  [false, 'vocabulary', 'beatmatch',            '単語が1語'],
  [false, 'vocabulary', 'well-known',           'ハイフンでつながる語は1語'],
  // ほかの演習では見ない(英文の長さで落としてはいけない)
  [false, 'translate_en_ja', 'Yes.',            '英文和訳は語数で落とさない'],
]
for (const [want, type, prompt_en, why] of shapes) {
  if (isWrongShape(type, { prompt_en }) !== want) {
    console.error(`❌ 単語 / フレーズの取り違えの判定がちがいます(${type} / ${why})`)
    process.exit(1)
  }
}

console.log(`  出来上がった問を落とす検査 ${cases.length + shapes.length} 件、すべて期待どおりです`)
