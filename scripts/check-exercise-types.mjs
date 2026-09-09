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
import { EXERCISE_TYPES, DEFAULT_SECTIONS, isBlankItem, isWrongShape } from '../src/data/exerciseTypes.js'
// **`src/lib/materials.js` からは読まない。** あちらは Supabase を
// 引き連れているので、素の node では読み込めない(だから種類だけ分けてある)
import { MATERIAL_KINDS } from '../src/data/materialKinds.js'
/* **弱点タグは、表(`weakness_tags`)にも同じものが要る。**
   `material_tags.tag_id` が参照しているので、画面にだけ足すと
   **そのタグで教材を発行した瞬間に外部キー違反で止まる**(2026-09)。
   演習の種類・教材の種類とまったく同じ落とし穴なので、同じ場所で見張る */
import { weaknessTags } from '../src/data/weaknessTags.js'

const def = process.argv[2] ?? ''
if (!def) {
  console.error('❌ 制約 material_sections_type_check が見つかりません')
  process.exit(1)
}

/** 制約の定義の中の 'xxx' を全部拾う */
const listOf = (text) => new Set([...text.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]))

const allowed = listOf(def)
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
 * **教材の「種類」も、まったく同じ形で抜ける**(2026-09)。
 *
 *   演習の種類は上で見張っていたが、**`materials.kind` は見ていなかった。**
 *   画面(`MATERIAL_KINDS`)に足して `materials_kind_check` に足し忘れると、
 *   やはり**発行した瞬間に**「violates check constraint」で止まる。
 *   lint もビルドも通る。**同じ落とし穴を2つめの場所に空けておかない。**
 *
 *   あわせて「その種類で作る演習の構成があるか」も見る。
 *   `DEFAULT_SECTIONS` に無いと `defaultSectionsFor()` が
 *   **黙って文型ドリルに落ちる**(記事のつもりが40問のドリルになる)。
 * ============================================================================
 */
const kindDef = process.argv[3] ?? ''
if (!kindDef) {
  console.error('❌ 制約 materials_kind_check が見つかりません')
  process.exit(1)
}
const kindsOk = listOf(kindDef)
const kindMissing = MATERIAL_KINDS.map((k) => k.id).filter((id) => !kindsOk.has(id))
if (kindMissing.length) {
  console.error(`❌ 表の制約に入っていない教材の種類があります: ${kindMissing.join(', ')}`)
  console.error('   supabase/migrations の制約 materials_kind_check に足してください。')
  process.exit(1)
}
const noPlan = MATERIAL_KINDS.map((k) => k.id).filter((id) => !DEFAULT_SECTIONS[id])
if (noPlan.length) {
  console.error(`❌ 演習の構成が無い教材の種類があります: ${noPlan.join(', ')}`)
  console.error('   src/data/exerciseTypes.js の DEFAULT_SECTIONS に足してください。')
  console.error('   (無いと、黙って文型ドリルの構成に落ちます)')
  process.exit(1)
}
console.log(`  画面の教材の種類 ${MATERIAL_KINDS.length} 個も、すべて表の制約に入っています`)

/*
 * ============================================================================
 * **弱点タグも、まったく同じ形で抜ける**(2026-09)。
 *
 *   タグは**画面(`weaknessTags.js`)と表(`weakness_tags`)の2か所**にある。
 *   しかも `material_tags.tag_id` は表を参照している。
 *
 *     tag_id text not null references public.weakness_tags(id)
 *
 *   だから画面にだけ足すと、**そのタグで教材を発行した瞬間に
 *   外部キー違反で止まる。** 演習の種類・教材の種類で2度踏んだ穴と
 *   まったく同じで、`npm run lint` も `npm run build` も通る。
 *
 *   **足し忘れたときだけ赤くなる。** 表のほうが多いぶんには何も言わない
 *   —— 使わなくなったタグを表から消さない(過去の教材が行方不明になる)
 *   ので、そちらは正しい状態である。
 * ============================================================================
 */
const tagList = process.argv[4] ?? ''
if (!tagList) {
  console.error('❌ 表 weakness_tags のタグ一覧が渡っていません')
  process.exit(1)
}
const inDb = new Set(tagList.split(',').map((s) => s.trim()).filter(Boolean))
const tagMissing = weaknessTags.map((t) => t.id).filter((id) => !inDb.has(id))
if (tagMissing.length) {
  console.error(`❌ 表 weakness_tags に入っていない弱点タグがあります: ${tagMissing.join(', ')}`)
  console.error('   supabase/migrations に insert を足してください(0050 と同じ形)。')
  console.error('   (足さないと、そのタグを付けた教材を発行した瞬間に止まります)')
  process.exit(1)
}
console.log(`  画面の弱点タグ ${weaknessTags.length} 個も、すべて表に入っています`)

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
