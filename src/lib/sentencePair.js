/**
 * 英文とその訳を、**1文ずつの対**にほどく。
 *
 * 【なぜ要るか】(2026-08 の指摘)
 *   > Quick Response、これでは長すぎます。あくまで1文ずつです。
 *
 *   教材の1項目は、記事なら**段落**、会話なら**発言**である。
 *   段落まるごとを1問にすると、日本語が5行も出て「これを英語で言え」に
 *   なってしまう。Quick Response は1文ずつでなければ練習にならない。
 *
 * 【いちばん気をつけること — ずれた対を作らない】
 *   英語だけ文で切っても、日本語をどう切るかが分からなければ対にならない。
 *   **数が合わないときは、切らずに項目まるごとを1つの対として返す。**
 *   長い対より、**まちがった対のほうが害が大きい。**
 *   日本語と違う英語が答えとして出れば、練習にならないどころか覚え違える。
 *
 *   教材は AI が1文ずつ訳して作るので、たいていは数が合う。
 *   合わないのは、訳をまとめた・分けた項目だけである。
 */
import { splitSentences } from './wordTiming.js'

/**
 * 日本語を文で切る。句点・感嘆符・疑問符のあと(閉じかっこは付けたまま)。
 * **英語の `splitSentences()` とは別物。** 日本語には空白の区切りが無い。
 */
export function splitJaSentences(text) {
  const src = String(text ?? '').trim()
  if (!src) return []
  const out = src.match(/[^。．！？!?]*[。．！？!?]+[」』）)”"']*\s*/g) ?? []
  const used = out.join('').length
  // 句点で終わっていない言いさしも、1文として拾う
  if (used < src.length) out.push(src.slice(used))
  return out.map((x) => x.trim()).filter(Boolean)
}

/** 英語を文で切る。切り方は読み上げと同じものを使う(**2か所に持たない**) */
export function splitEnSentences(text) {
  const src = String(text ?? '').trim()
  if (!src) return []
  return splitSentences(src)
    .map((s) => src.slice(s.start, s.end).trim())
    .filter(Boolean)
}

/**
 * 1項目(段落 / 発言)を、1文ずつの対にほどく。
 *
 * @returns {{en: string, ja: string, aligned: boolean}[]}
 *   `aligned` が false なら、**切らずにまるごと返した**という意味。
 *   画面はそれを見て「段落の訳」と札を付ける。
 */
/**
 * **日本語のほうが文の数が多いとき、まとめて数をそろえる**(2026-09 実機)。
 *
 *   > ディクテーション内での訳が、1文ずつになっていません。
 *   > 段落の訳が繰り返し表示されているだけです。
 *
 * 英語1文が、日本語では2文になることがある(コロンのところで切るなど)。
 * 実測した段落では**英語4文・日本語5文**で、数が合わないため
 * 段落まるごとの訳が4回並んでいた。
 *
 * 【どうやって当てるか】
 *   日本語と英語の**長さの比**は、同じ段落の中ではほぼ一定である。
 *   だから「英語の何%まで来たか」と「日本語の何%まで来たか」を
 *   突き合わせれば、どこでまとめればよいかが分かる。
 *
 * 【外れそうなときは、やらない】
 *   **ずれた対は、無いより悪い**(このファイルの冒頭)。
 *   区切りが目標から `TOLERANCE` 以上ずれたら **null を返して**、
 *   これまでどおり「段落の訳」を出す。
 */
const TOLERANCE = 0.12

const lenOf = (s) => String(s ?? '').trim().length

function mergeJaToMatch(enParts, jaParts) {
  const enLen = enParts.map(lenOf)
  const jaLen = jaParts.map(lenOf)
  const enTotal = enLen.reduce((a, b) => a + b, 0)
  const jaTotal = jaLen.reduce((a, b) => a + b, 0)
  if (!enTotal || !jaTotal) return null

  // 英語の「ここまでで何%」。これが目標になる
  const targets = []
  let acc = 0
  for (const l of enLen) { acc += l; targets.push(acc / enTotal) }

  const groups = []
  let cur = []
  let cum = 0
  for (let i = 0; i < jaParts.length; i += 1) {
    cur.push(jaParts[i])
    cum += jaLen[i]
    const gi = groups.length
    if (gi >= enParts.length - 1) continue        // 最後の組は残り全部
    const ratio = cum / jaTotal
    const next = i + 1 < jaParts.length ? (cum + jaLen[i + 1]) / jaTotal : Infinity
    // 残りの文を1つずつ配るしかないなら、ここで閉じる
    const mustClose = jaParts.length - i - 1 === enParts.length - gi - 1
    if (!mustClose && Math.abs(next - targets[gi]) < Math.abs(ratio - targets[gi])) continue
    // **外れすぎていたら、まとめない**(まちがった対を作らない)
    if (Math.abs(ratio - targets[gi]) > TOLERANCE) return null
    groups.push(cur.join(''))
    cur = []
  }
  if (cur.length) groups.push(cur.join(''))
  if (groups.length !== enParts.length) return null
  if (groups.some((g) => !g.trim())) return null
  return groups
}

export function alignedSentences(en, ja) {
  const enParts = splitEnSentences(en)
  const jaParts = splitJaSentences(ja)
  // **英文が1文なら、その訳はその文の訳である。**
  // ここを `aligned: false` にしていたので、1文の項目にまで
  // 「段落の訳」の札が出ていた(2026-08 の指摘)
  if (enParts.length <= 1) {
    return [{ en: String(en ?? '').trim(), ja: String(ja ?? '').trim(), aligned: true }]
  }
  if (enParts.length !== jaParts.length) {
    /* **日本語のほうが多いときは、まとめて数をそろえてみる**(2026-09)。
       英語1文がコロンのところで2文に訳されることがある。
       長さの比で当てられたときだけ使い、外れそうなら下へ落ちる */
    const merged = jaParts.length > enParts.length
      ? mergeJaToMatch(enParts, jaParts)
      : null
    if (merged) return enParts.map((t, i) => ({ en: t, ja: merged[i], aligned: true }))
    // **それでも合わなければ切らない。** ずれた対を作るほうが害が大きい
    return enParts.map((t) => ({ en: t, ja: String(ja ?? '').trim(), aligned: false }))
  }
  return enParts.map((t, i) => ({ en: t, ja: jaParts[i], aligned: true }))
}
