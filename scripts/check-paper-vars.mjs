/**
 * 紙の色の「取りこぼし」を、機械的に見つける。
 *
 * 【なぜ要るか】
 *   紙(`.lesson-sheet, .focus-paper`)は、**アプリの色を差し替えた島**である。
 *   集中モードの紙は、暗い配色のときだけ**その島をアプリの色へ戻す**
 *   (2026-09 利用者の指定「配色が『暗い』の時は紙も黒です」)。
 *
 *   つまり同じ変数の一覧が**2か所**にある。片方に足してもう片方に
 *   足し忘れると、**その色だけ明るいまま暗い紙の上に残る。**
 *   これは一度やっている失敗である(CLAUDE.md)。
 *
 *     `.passage-part.is-speaking` は `--speaking-bg` を使うが、紙が
 *     持っていたのは `--speak-bg` という**別の名前**だった。
 *     名前が1つ違うだけで、シャドーイング中の段落が**真っ黒**になった。
 *
 *   `npm run lint` にも `npm run build` にも引っかからない。
 *   **暗い配色にして、その画面を開くまで分からない。**
 *   だから耳の代わりに `test:audio` を置いたのと同じ考え方で、
 *   **目の代わりにこの検証を置く。**
 *
 * 【見るもの】
 *   ① 島にある変数が、暗いときの戻し(2か所とも)に全部あるか
 *   ② 戻しの側にだけある変数が無いか(島から消したのに残っている)
 *   ③ 戻しは**値を書き写していないか**(`var(--app-…)` から取っているか)。
 *      色の値を書き写すと、配色を直したときに片方だけ古くなる
 *   ④ 別名(`--app-…`)が `.focus` にそろっているか
 *   ⑤ 紙のある集中モードの地が、**配色によらず黒**か
 */
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8')

let bad = 0
const ok = (label) => console.log(`✓ ${label}`)
const ng = (label, detail) => { bad += 1; console.log(`✗ ${label}\n    ${detail}`) }

/** そのセレクタのブロックの中身を取り出す(コメントは落とす) */
function body(selector) {
  const i = css.indexOf(selector)
  if (i < 0) return null
  const open = css.indexOf('{', i)
  // 入れ子(@media)があるので、括弧を数えて閉じを探す
  let depth = 0
  let end = open
  for (let k = open; k < css.length; k += 1) {
    if (css[k] === '{') depth += 1
    else if (css[k] === '}') { depth -= 1; if (depth === 0) { end = k; break } }
  }
  return css.slice(open + 1, end).replace(/\/\*[\s\S]*?\*\//g, '')
}

/** そのブロックが決めている変数の名前(出てきた順・重複なし) */
function varsIn(text) {
  const out = []
  for (const m of text.matchAll(/(--[a-z0-9-]+)\s*:/g)) {
    if (!out.includes(m[1])) out.push(m[1])
  }
  return out
}

const island = body('.lesson-sheet, .focus-paper {')
const darkA = body(':root[data-theme="dark"] .focus-paper {')
const darkB = body(':root:not([data-theme="light"]) .focus-paper {')
const focus = body('.focus {')

if (!island) ng('紙の島が見つからない', '`.lesson-sheet, .focus-paper {` が無い')
if (!darkA) ng('暗いときの戻し(data-theme)が見つからない', '')
if (!darkB) ng('暗いときの戻し(media)が見つからない', '')
if (!focus) ng('`.focus` が見つからない', '')

if (island && darkA && darkB && focus) {
  const want = varsIn(island)
  const aliases = varsIn(focus).filter((n) => n.startsWith('--app-'))

  // ① ②
  for (const [name, got] of [['data-theme のほう', varsIn(darkA)], ['media のほう', varsIn(darkB)]]) {
    const missing = want.filter((n) => !got.includes(n))
    const extra = got.filter((n) => !want.includes(n))
    if (missing.length) ng(`${name}に足りない変数がある`, `足りない: ${missing.join(' ')}`)
    else ok(`${name}は、島の ${want.length} 個をすべて戻している`)
    if (extra.length) ng(`${name}に、島に無い変数がある`, `余分: ${extra.join(' ')}`)
  }

  // 2か所が同じであること(片方だけ直す失敗を防ぐ)
  if (varsIn(darkA).join() !== varsIn(darkB).join()) {
    ng('暗いときの戻しが、2か所で食い違っている', '同じ並びにすること')
  } else ok('暗いときの戻しは、2か所とも同じ')

  // ③ 値を書き写していないか
  for (const [name, text] of [['data-theme のほう', darkA], ['media のほう', darkB]]) {
    const literal = [...text.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)]
      .filter(([, , v]) => !v.trim().startsWith('var(--app-'))
    if (literal.length) {
      ng(`${name}が色の値を書き写している`,
        `別名(var(--app-…))から取ること: ${literal.map(([, n]) => n).join(' ')}`)
    } else ok(`${name}は、色の値を1つも書き写していない`)
  }

  // ④ 別名がそろっているか
  const usedAlias = [...darkA.matchAll(/var\((--app-[a-z0-9-]+)\)/g)].map((m) => m[1])
  const noAlias = [...new Set(usedAlias)].filter((n) => !aliases.includes(n))
  if (noAlias.length) ng('`.focus` に控えていない別名を使っている', noAlias.join(' '))
  else ok(`別名は ${aliases.length} 個、すべて \`.focus\` に控えてある`)

  // 別名が自分自身を指していないか(輪になると黙って効かなくなる)
  const cycle = [...focus.matchAll(/(--app-[a-z0-9-]+)\s*:\s*var\((--[a-z0-9-]+)\)/g)]
    .filter(([, alias, src]) => `--app${src.slice(1)}` !== alias)
  if (cycle.length) ng('別名の付け方がずれている', cycle.map(([, a]) => a).join(' '))
  else ok('別名は、もとの名前とそろっている')
}

// ⑤ 紙のある集中モードの地は、配色によらず黒か
const ground = body('.focus--sheet {')
if (!ground) {
  ng('`.focus--sheet` が無い', '紙のある集中モードの地を、いつも黒にする指定')
} else if (/var\(/.test(ground)) {
  ng('集中モードの地が、配色で変わってしまう',
    '`.focus--sheet` の背景は決め打ちにする(利用者の指定「紙の周囲は黒で統一」)')
} else ok('紙のある集中モードの地は、配色によらず黒')

// ⑥ 集中モードの紙にかかる指定で、色を決め打ちしていないか
//
//    **これで実際に1つ見つけた**(2026-09)。
//    `.lesson-sheet .btn, .focus-paper .btn { background: #fff }` があり、
//    暗い配色の集中モードで**白い錠剤が黒い紙に載っていた。**
//    紙は「変数だけで色を決める」ので、決め打ちが1つでも混じると
//    そこだけ明るいまま残る。
{
  const rules = [...css.matchAll(/([^{}]*\.focus-paper[^{}]*)\{([^{}]*)\}/g)]
  const hits = []
  for (const [, sel, text] of rules) {
    // セレクタの前にはコメントが付いてくる。**落としてから見る**
    const only = sel.replace(/\/\*[\s\S]*?\*\//g, '').trim()
    if (only.startsWith('.lesson-sheet, .focus-paper')) continue   // 島そのもの
    const body2 = text.replace(/\/\*[\s\S]*?\*\//g, '')
    const lit = body2.match(/:\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)|white|black)\s*[;}]/g)
    if (lit) hits.push(`${only.replace(/\s+/g, ' ')} → ${lit.join(' ')}`)
  }
  if (hits.length) {
    ng('集中モードの紙に、色の決め打ちが混じっている', hits.join('\n    '))
  } else ok('集中モードの紙は、色をすべて変数から取っている')
}

console.log(bad === 0 ? '\n✅ 紙の色の検証は、すべて意図どおりです' : `\n❌ ${bad} 件`)
process.exit(bad === 0 ? 0 : 1)
