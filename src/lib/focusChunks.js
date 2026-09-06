/**
 * 集中モードで、**長い段落を「ちょうど入る大きさ」に割る**
 * (2026-09 利用者の指定)。
 *
 *   > 集中モードに関して後一点。段落が長い場合、せっかく集中モードに
 *   > 入ってもそこでスクロールが発生してしまっています。ちょうど良い
 *   > 単語数、内容で区切る仕様にしないと通常モードと同じ操作感の悪さを
 *   > 引き継いでしまい、集中モードの存在意義が問われてしまいます
 *
 * ============================================================================
 * 【なぜ要るか】集中モードは「送るものを無くす」ことで成り立っている
 *
 *   語のタップと画面送りは同じ指の動きから始まる。3度直してもなお
 *   喧嘩が残ったので、**1段落だけを画面ぴったりに出して、送るものを
 *   無くした**(第5.44節)。ところが**貼った原稿は1段落が桁違いに長い**
 *   ので、その1段落だけで画面に入らず、**中で送ることになっていた。**
 *   送るものが在るなら、この画面である意味がない。
 *
 * ============================================================================
 * 【語数を決め打ちにしない。**入るまで割る**】
 *
 *   実測(Chromium)。同じ 146 語の段落でも、入るかどうかは端末で違う。
 *
 *   | 端末 | 本文の箱 | 1語あたり | 入る語数のめやす |
 *   |---|---|---|---|
 *   | iPhone 390×844 | 734px | 5.0px | **約 128 語** |
 *   | 320×568 | 458px | 6.4px | **約 57 語** |
 *   | パッド 820×1180 | 1070px | 2.9px | 146 語でも余る |
 *
 *   しかも紙の文字は3段(16 / 19 / 23px)あり、紙の幅も7段ある。
 *   **「◯語で切る」と決めた瞬間に、どこかで外れる。**
 *   320px・特大に合わせて 30 語で切れば、ふつうの記事(1段落 55 語ほど)
 *   まで真っ二つになる —— **切らなくてよいものまで切る。**
 *
 *   だから**幅で決めない。入るまで割る**(`useFitRow` と同じ考え方)。
 *   ここが持つのは「n 個に割る」算段だけで、
 *   **n をいくつにするかは、画面が測って決める**(`FocusReader`)。
 *
 * ============================================================================
 * 【決まりごと】
 *
 *   - **切れ目は必ず文の切れ目**(`pastedParagraphs` / `speakChunks` と同じ)。
 *     文の途中では切らない
 *   - **1語も落とさない。** 割ったものをつなぐと、元の英文に**1文字も
 *     違わず**戻る(`splitInto()` の検証がそれを見ている)
 *   - **`at`(元の英文の何文字目か)を必ず返す。** 読み上げ中の色は
 *     「その項目の何文字目か」で決まるので、足さないと
 *     **段落の先頭に戻って光る**(`speakChunks` で踏んだのと同じ穴)
 *   - **文の数より多くは割れない。** 割れないときは、そのまま返す
 *     (**行き止まりを作らない** —— 送ることにはなるが、消えはしない)
 *   - **訳は、数が合ったときだけ割る。** 合わなければ段落の訳を
 *     そのまま添える(`sentencePair.js` と同じ決まり。
 *     **ずれた対は、無いより悪い**)
 */
import { splitSentences } from './wordTiming.js'
import { splitJaSentences } from './sentencePair.js'

/** 語の数(空白で数えるだけ。**当てられることだけを見る**) */
const wordCount = (s) => (String(s ?? '').match(/\S+/g) ?? []).length

/**
 * 英文を、文の切れ目で **およそ n 等分**する。
 *
 * @param {string} text 元の英文
 * @param {number} n いくつに割るか(1 以下ならそのまま)
 * @returns {Array<{text: string, at: number}>} `at` は元の英文の何文字目か
 */
export function splitInto(text, n) {
  const src = String(text ?? '')
  const want = Math.max(1, Math.floor(Number(n) || 1))
  if (want <= 1 || !src.trim()) return [{ text: src, at: 0 }]

  const sents = splitSentences(src)
  // **文の数より多くは割れない。** 1文しか無ければ、そのまま返す
  if (sents.length <= 1) return [{ text: src, at: 0 }]

  const w = sents.map((s) => wordCount(src.slice(s.start, s.end)))
  const total = w.reduce((a, b) => a + b, 0)
  const out = []
  let from = 0
  let acc = 0
  let k = 1
  for (let i = 0; i < sents.length; i += 1) {
    acc += w[i]
    const need = want - k                  // まだ入れたい切れ目の数
    const left = sents.length - (i + 1)    // このあとに残る文の数
    if (k >= want || left < 1) continue
    // **残りの文が足りなくなったら、語数を待たずに切る。**
    // 待つと、望んだ数まで割れないまま終わる
    const must = left <= need
    if (must || acc >= Math.round((total * k) / want)) {
      out.push({ text: src.slice(sents[from].start, sents[i].end), at: sents[from].start })
      from = i + 1
      k += 1
    }
  }
  if (from < sents.length) {
    out.push({ text: src.slice(sents[from].start, src.length), at: sents[from].start })
  }
  return out
}

/** その段落を、いくつまで割れるか(= 文の数) */
export function maxPieces(text) {
  const src = String(text ?? '')
  if (!src.trim()) return 1
  return Math.max(1, splitSentences(src).length)
}

/**
 * 1つの段落(発言)を、n 個のかけらにする。**訳も一緒に割る。**
 *
 * @returns {Array<{en: string, ja: string, at: number, jaWhole: boolean}>}
 *   `jaWhole` … 訳を割れなかった(段落の訳をそのまま添えている)
 */
export function piecesOf(item, n) {
  const en = String(item?.prompt_en ?? '')
  const ja = String(item?.prompt_ja ?? '')
  const parts = splitInto(en, n)
  if (parts.length <= 1) return [{ en, ja, at: 0, jaWhole: false }]

  const enS = splitSentences(en)
  const jaS = splitJaSentences(ja)
  // **数が合ったときだけ割る。** 合わなければ段落の訳をそのまま添える
  const aligned = ja.trim() && jaS.length === enS.length
  if (!aligned) return parts.map((p) => ({ en: p.text, ja, at: p.at, jaWhole: !!ja.trim() }))

  // かけらの頭の位置から、何文目までが入っているかを数える
  const startAt = parts.map((p) => p.at)
  return parts.map((p, i) => {
    const from = enS.findIndex((s) => s.start === startAt[i])
    const to = i + 1 < parts.length
      ? enS.findIndex((s) => s.start === startAt[i + 1])
      : enS.length
    return {
      en: p.text,
      ja: jaS.slice(Math.max(from, 0), to > 0 ? to : jaS.length).join(''),
      at: p.at,
      jaWhole: false,
    }
  })
}
