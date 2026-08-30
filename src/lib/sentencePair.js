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
export function alignedSentences(en, ja) {
  const enParts = splitEnSentences(en)
  const jaParts = splitJaSentences(ja)
  const whole = [{ en: String(en ?? '').trim(), ja: String(ja ?? '').trim(), aligned: false }]

  if (enParts.length <= 1) return whole
  // **数が合わなければ切らない。** ずれた対を作るほうが害が大きい
  if (enParts.length !== jaParts.length) {
    return enParts.map((t) => ({ en: t, ja: String(ja ?? '').trim(), aligned: false }))
  }
  return enParts.map((t, i) => ({ en: t, ja: jaParts[i], aligned: true }))
}
