/**
 * スラッシュリーディング(②)の区切りの検証。
 *
 * **決まりで書いたものは、決まりで確かめられる。**
 * ここが崩れると、模範の区切りが自分の決まりに違反したまま出る。
 * 前置詞や助動詞を足したときは、必ずここを通すこと。
 *
 *   npm run test:chunk
 */
import {
  checkSlashes, chunksOf, slashesFor, wordsOf,
} from '../src/lib/chunker.js'

let ng = 0
const ok = (name, cond, detail = '') => {
  console.log(`${cond ? '✓' : '✗'} ${name}${cond || !detail ? '' : `\n    ${detail}`}`)
  if (!cond) ng += 1
}
const cut = (s, lv) => chunksOf(s, slashesFor(s, lv).map((x) => x.at)).join(' / ')

const S = {
  office: 'The office bought a new coffee machine for the meeting room last week.',
  going: 'I am going to talk to my manager about the new plan.',
  hasTo: 'She has to finish the report before she leaves for the day.',
  that: 'We think that the price of the machine is too high.',
  wants: 'He wants to know where the meeting will be held.',
  rinse: 'Please rinse the pot in the kitchen before you leave for the day.',
}

console.log('▶ 模範の区切りが、自分の決まりを守っていること')
for (const [name, text] of Object.entries(S)) {
  for (const lv of ['beginner', 'middle', 'advanced']) {
    const marks = slashesFor(text, lv).map((x) => x.at)
    const notes = checkSlashes(text, marks)
    ok(`${name} / ${lv}`, notes.length === 0,
      `${cut(text, lv)}\n    ${notes.map((n) => n.text).join('\n    ')}`)
  }
}

console.log('\n▶ 上級ほど区切りが減る(利用者の指定)')
for (const [name, text] of Object.entries(S)) {
  const b = slashesFor(text, 'beginner').length
  const m = slashesFor(text, 'middle').length
  const a = slashesFor(text, 'advanced').length
  ok(`${name}: 初級 ${b} ≥ 中級 ${m} ≥ 上級 ${a}`, b >= m && m >= a)
}

console.log('\n▶ 決まりに反する区切りには、必ず注意が出る')
// 語: 0 The 1 office 2 bought 3 a 4 new 5 coffee 6 machine 7 for 8 the ...
ok('区切りの最後が前置詞', checkSlashes(S.office, [8]).length > 0)
ok('冠詞のあとで切る', checkSlashes(S.office, [4]).length > 0)
// 0 I 1 am 2 going 3 to 4 talk ...
ok('be going to の途中で切る', checkSlashes(S.going, [3]).length > 0)
ok('has to の途中で切る', checkSlashes(S.hasTo, [2]).length > 0)

console.log('\n▶ 正しい区切りには、何も言わない')
ok('前置詞の前で切る', checkSlashes(S.office, [7]).length === 0)
ok('接続詞の前で切る', checkSlashes(S.that, [2]).length === 0)

console.log('\n▶ カタマリをつなぐと、もとの文に戻る')
for (const [name, text] of Object.entries(S)) {
  for (const lv of ['beginner', 'middle', 'advanced']) {
    const joined = cut(text, lv).split(' / ').join(' ')
    ok(`${name} / ${lv}`, joined === wordsOf(text).join(' '), joined)
  }
}

console.log(ng === 0 ? '\n✅ 区切りの検証はすべて意図どおりです' : `\n❌ ${ng} 件おかしい`)
process.exit(ng === 0 ? 0 : 1)
