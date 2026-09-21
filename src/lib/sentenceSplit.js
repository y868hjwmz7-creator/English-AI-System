/**
 * **英文を、文の切れ目で割る。**
 *
 * 【なぜ別のファイルに出したか】(第5.231節・2026-09)
 *   `wordTiming.js` が**読み上げ用の英文**(`speakText.js`)を
 *   使うようになった(数字は画面より長く読まれる)。
 *   ところが `speakText.js` のほうも、ここの `splitSentences()` を
 *   使っている。**そのままだと読み込みが輪になる。**
 *
 *   **どちらからも使われるものだけ**を、ここへ出した。
 *   中身は1文字も変えていない(`wordTiming.js` が、これまでどおり
 *   同じ名前で出し直すので、**呼ぶ側は1行も変わらない**)。
 */

/**
 * **ピリオドが付いても、文の終わりではない語**(ピリオドを除いた形・小文字)。
 *
 * **ほかの品詞にならない語だけを入れる**(`chunker.js` の
 * `SURE_PREPS` とまったく同じ考え方)。`no.`(No. 5)や `apt.`(apt)、
 * `etc.` や `sun.` のように**ふつうの語として文末に立つもの**は
 * **入れない** —— 入れると `The answer is no.` が次の文とつながる。
 * **見落としは長い1文になるだけだが、取り違えは文をつなげてしまう。**
 *
 * `U.S.` `e.g.` `a.m.` `Ph.D.` のような**ドットでつないだ形は、
 * 一覧に並べない。** 形だけで見分けられるうえ(下の②)、
 * **最後のドットは本当に文を終えることがある**(`She holds a Ph.D. Everyone…`)。
 * 一覧に入れると、そこで永久に切れなくなる。
 */
export const ABBREVIATIONS = [
  // 敬称・肩書き
  'mr', 'mrs', 'ms', 'mx', 'dr', 'prof', 'rev', 'hon', 'gov', 'sen', 'rep',
  'capt', 'lt', 'sgt', 'col', 'gen', 'maj', 'adm', 'messrs', 'mme', 'mlle',
  'jr', 'sr', 'st',
  // 学位(`Ph. D` のように離して書かれることがある)
  'ph',
  // 会社・組織
  'inc', 'ltd', 'co', 'corp', 'llc', 'plc', 'bros', 'dept', 'univ',
  // 場所
  'ave', 'blvd', 'rd', 'mt', 'ste',
  // 月(**曜日は入れない** —— `sun.` `sat.` はふつうの語である)
  'jan', 'feb', 'apr', 'jun', 'jul', 'aug', 'sep', 'sept', 'oct', 'nov', 'dec',
  // そのほか
  'vol', 'chap', 'approx', 'cf', 'viz', 'vs',
]

const ABBREV = new Set(ABBREVIATIONS)

/**
 * その `.` は**文の終わりではない**か。見るのは4つ。
 *
 *   ⓪ すぐ次が数字 … `3.5`(小数点)
 *   ① 次のことばが**小文字で始まる** … `a Ph.D. in physics`
 *      **英語の文は小文字では始まらない。** ここは確かなので、
 *      一覧に無い略語(`etc. and …`)も、これで拾える
 *   ② `U.S.` `a.m.` の**途中**のドット(次が「1文字 + ドット」)。
 *      **最後のドットは見ない** —— あれは文を終えることがある
 *   ③ 上の一覧にある語
 *
 * **`!` `?` は見ない。** 略語に使われることがないためである。
 */
function abbrevAt(src, end) {
  let i = end - 1
  while (i >= 0 && /[\s"'’”)\]]/.test(src[i])) i -= 1
  if (i < 0 || src[i] !== '.') return false
  const rest = src.slice(i + 1)
  if (/^\d/.test(rest)) return true                       // ⓪ 小数点
  /* ⓪-2 **省略記号(`. . .`)の途中**(第5.216節・2026-09 実機)。
   *
   *   > まだ飛ばされている要素があります(利用者・4度め)
   *
   *   `Let's see . . . there's a 7:15 departure` を切ると、
   *   **2つめのピリオドで切れて `"."` だけの「文」ができていた。**
   *   ①(次が小文字)は次が `.` なので当たらず、②③も当たらない。
   *
   *   その「文」は**語を1つも持たない**ので、時刻の上では
   *   **幅ゼロの区間**になる。幅ゼロは**決して光らず(＝飛ばされ)**、
   *   前後の文の境目も 0.1〜0.2 秒(ちょうど1語ぶん)ずれる。
   *
   *   **第5.206節は、この幅ゼロを「置ける場所へ置く」で済ませていた。**
   *   症状に蓋をしただけで、**元を断っていなかった。**
   *   英語の文は「.」では始まらない —— **次の字も点なら、そこは文末でない。**
   *
   *   `...`(空白なし)と `…` は、もともと切れない
   *   (`[.!?]+` がまとめて食う / そもそも `[.!?]` でない)。
   *   **空白で離した `. . .` だけが抜けていた。** */
  if (/^\s*\./.test(rest)) return true
  if (/^["'’”)\]\s]*[a-z]/.test(rest)) return true        // ① 次が小文字
  if (/^\s?[A-Za-z]\./.test(rest)) return true            // ② つないだ形の途中
  let j = i
  while (j > 0 && /[A-Za-z.]/.test(src[j - 1])) j -= 1     // ③ 一覧
  const raw = src.slice(j, i)
  return !!raw && ABBREV.has(raw.toLowerCase())
}

export const splitSentences = (text) => {
  const src = String(text ?? '')
  const out = []
  const re = /[^.!?]*[.!?]+["'’”)\]]*\s*/g
  let last = 0
  let from = null                          // 略語でつないでいる最中の頭
  let m = re.exec(src)
  while (m) {
    if (!m[0].length) break
    const end = m.index + m[0].length
    if (from === null) from = m.index
    /* **略語のピリオドなら、次のかたまりとつなぐ。**
       いちばん最後のかたまりは、つなぐ先が無いのでそのまま出す */
    if (!(abbrevAt(src, end) && (re.lastIndex < src.length))) {
      out.push({ start: from, end })
      from = null
    }
    last = end
    m = re.exec(src)
  }
  // 最後が句点で終わっていない本文(見出し・言いさし)も1つの文として扱う
  if (last < src.length) out.push({ start: from ?? last, end: src.length })
  else if (from !== null) out.push({ start: from, end: last })
  return out.length ? out : [{ start: 0, end: src.length }]
}

/** その位置を含む文。無ければ null */
export const sentenceAt = (text, at) => {
  if (at == null) return null
  return splitSentences(text).find((s) => at >= s.start && at < s.end) ?? null
}

