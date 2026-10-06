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

/* ★ **暗いときの紙は、2つの紙をまとめて1組にした**(第5.391節・2026-10-06)。
     もとは `.focus-paper` だけを「アプリの色へ戻す」形だったが、
     利用者がレッスン表示の紙も暗くすることを選んだ(4案を描いて案C)ので、
     **両方の紙を同じ1組**にした。だから探す相手も両方を含む形になる。 */
const island = body('.lesson-sheet, .focus-paper {')
const darkA = body(':root[data-theme="dark"] .lesson-sheet,\n  :root[data-theme="dark"] .focus-paper {')
const darkB = body(':root:not([data-theme="light"]) .lesson-sheet,\n  :root:not([data-theme="light"]) .focus-paper {')

if (!island) ng('紙の島が見つからない', '`.lesson-sheet, .focus-paper {` が無い')
if (!darkA) ng('暗いときの紙(data-theme)が見つからない',
  '2つの紙(.lesson-sheet と .focus-paper)をまとめた欄が要る')
if (!darkB) ng('暗いときの紙(media)が見つからない',
  '2つの紙(.lesson-sheet と .focus-paper)をまとめた欄が要る')

if (island && darkA && darkB) {
  const want = varsIn(island)

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

  /* ③ **色の値を書き写していないか。**
       当てる場所は2つある(OS の設定 / 画面で切り替え)ので、
       向こうに生の色を書くと**必ず片方だけ古くなる。**
       値は `:root` の `--pd-…` 1組だけに置き、ここは並べるだけにする */
  for (const [name, text] of [['data-theme のほう', darkA], ['media のほう', darkB]]) {
    const literal = [...text.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)]
      .filter(([, , v]) => !/^var\(--(pd|rizap)-/.test(v.trim()))
    if (literal.length) {
      ng(`${name}が色の値を書き写している`,
        `出どころ(var(--pd-…))から取ること: ${literal.map(([, n]) => n).join(' ')}`)
    } else ok(`${name}は、色の値を1つも書き写していない`)
  }

  /* ④ **出どころ(`--pd-…`)が、`:root` にそろっているか。**
       `:root` に無い名前を引くと、その欄だけ**何も効かず明るいまま**残る */
  const root = body(':root {')
  const have = varsIn(root ?? '').filter((n) => n.startsWith('--pd-'))
  const 使う = [...new Set([...darkA.matchAll(/var\((--pd-[a-z0-9-]+)\)/g)].map((m) => m[1]))]
  const 無い = 使う.filter((n) => !have.includes(n))
  if (!root) ng('`:root` が見つからない', '')
  else if (無い.length) ng('`:root` に無い出どころを引いている', 無い.join(' '))
  else ok(`出どころは ${使う.length} 個、すべて \`:root\` にある`)

  /* ⑤ **紙に刷るときは、暗い紙が1つも届かないこと**(2026-10-06 利用者の指定
       「印刷は白いまま」)。`@media screen` で囲ってあるかを見る ——
       囲いを外すと、紙が真っ黒に刷られてインクを使い切る */
  /* ★ **コメントを落としてから探す**(CLAUDE.md)。
       この検証の説明文そのものに `@media screen` と書いてあるので、
       生のまま探すと**囲いを外しても、説明に当たって緑のまま**になる
       (2026-10-06 の赤チェックで、実際にそうなった)。
       **長さは変えずに空白へ潰す** —— 位置がずれると手前を見誤る */
  const 素 = css.replace(/\/\*[\s\S]*?\*\//g, (m) => ' '.repeat(m.length))
  for (const 印 of [':root[data-theme="dark"] .lesson-sheet',
                    ':root:not([data-theme="light"]) .lesson-sheet']) {
    const at = 素.indexOf(印)
    const 手前 = 素.slice(Math.max(0, at - 260), at)
    if (at < 0) ng('暗い紙の欄が見つからない', 印)
    else if (!/@media\s+screen/.test(手前)) {
      ng('暗い紙が、印刷にも届いてしまう', `${印} を @media screen で囲うこと`)
    } else ok(`印刷には届かない(${印.includes('not(') ? 'media' : 'data-theme'} のほう)`)
  }

  /* ⑥ **解答の緑は、利用者が選んだもの**(2026-10-06「ミント」)。
       **値は読み取ってから性質を見る** —— 書き写すと、変えた日に
       仕組みを壊していなくても赤くなる(CLAUDE.md) */
  {
    const m = (root ?? '').match(/--pd-answer:\s*(#[0-9a-f]{6})/i)
    const 紙 = (root ?? '').match(/--pd-paper:\s*(#[0-9a-f]{6})/i)
    if (!m || !紙) ng('解答の色か紙の色が読み取れない', '')
    else {
      const lin = (c) => (c / 255 <= 0.03928 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4)
      const L = (h) => { const v = [1, 3, 5].map((i) => lin(parseInt(h.slice(i, i + 2), 16))); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2] }
      const [x, y] = [L(m[1]), L(紙[1])].sort((a, b) => b - a)
      const r = (x + 0.05) / (y + 0.05)
      if (r < 4.5) ng('解答の緑が、紙の上で読みにくい', `${r.toFixed(2)} : 1(4.5 を割っている)`)
      else ok(`解答の緑は、紙の上で読める(${r.toFixed(2)} : 1)`)
    }
  }
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

/* ── **1段落おきの地色は、紙と違う色でなければ意味が無い**
      (第5.240節・2026-09-23 利用者の指摘)

     > 段落ごとに背景の色を入れ替えるなどしないと視覚的にとても
     > 分かりにくいです。

   同じ色にすると、**何も起きていないのに、直したように見える。**
   変数が在るかどうかだけでは捕まえられない(赤チェックで出た)。 */
{
  const 島 = css.match(/\.lesson-sheet, \.focus-paper \{([\s\S]*?)\n\}/)
  const 取る = (name) => {
    const m = (島?.[1] ?? '').match(new RegExp(`--${name}:\\s*([^;]+);`))
    return (m?.[1] ?? '').trim()
  }
  const paper = 取る('paper')
  const stripe = 取る('qa-stripe')
  if (!paper || !stripe) {
    ng('紙の色か、1段落おきの地色が見つからない', `paper=${paper} / stripe=${stripe}`)
  } else if (paper === stripe) {
    ng('1段落おきの地色が、紙と同じ色になっている',
      `どちらも ${paper}。**替えていることが目で分からない**`)
  } else ok(`1段落おきの地色は、紙と違う色(${paper} → ${stripe})`)
  /* **本当に使われているか。** 変数だけ用意して、どこにも書いていなければ
     何も起きない(「無ければ素通り」する形の検証を書かない・CLAUDE.md) */
  if (/nth-child\(even\)[\s\S]{0,160}var\(--qa-stripe/.test(css)) {
    ok('1段落おきの地色を、実際に1つおきの行へ当てている')
  } else ng('1段落おきの地色が、どこにも当たっていない', '変数を用意しただけになっている')
  /* **1文ずつ並ぶ画面は、3つとも同じにする**(2026-09-23 利用者の回答
     「はい、同じ形でお願いします」)。1つ抜けると、**同じ作りなのに
     そこだけ見え方が違う** —— 目で見つけるのは難しい */
  {
    const at = css.indexOf('nth-child(even)')
    const 塊 = at > 0 ? css.slice(Math.max(0, at - 200), css.indexOf('}', at)) : ''
    const 抜け = ['slash-list', 'dictation-list', 'stepsent-list']
      .filter((x) => !塊.includes(`.${x} > .qa-row:nth-child(even)`))
    if (抜け.length === 0) ok('1文ずつ並ぶ3つの画面すべてに、地色が入っている')
    else ng('地色が入っていない一覧がある', `${抜け.join(' / ')}(同じ作りなのに見え方が違う)`)
  }
}

console.log(bad === 0 ? '\n✅ 紙の色の検証は、すべて意図どおりです' : `\n❌ ${bad} 件`)
process.exit(bad === 0 ? 0 : 1)
