/**
 * **窓口へ渡す英文を、受け取れる長さに収める**(2026-09 実機・利用者の指摘)。
 *
 * 【なぜ切り出したか】
 *   `readAloud.js` は Supabase を引き連れているので、**素の node で
 *   一度も走らせられない。** 算段だけをここへ出しておけば、
 *   `npm run test:mp3` が押してみなくても確かめられる
 *   (`playMark.js` / `mp3Join.js` と同じ考え方)。
 */
import { splitSentences } from './wordTiming.js'

/* ══════════════════════════════════════════════════════════════════
 * **窓口が受け取れる長さを、絶対に超えない**(2026-09 実機・利用者の指摘)
 *
 *   > このspeech練習の教材、9段落目だけ最低な質の日本語英語の女性の
 *   > 音声になっているので直してください。
 *
 * **読み上げの窓口(`speak`)は、1回に 2,000 文字までしか受け取らない。**
 * 超えると 400 で断られ、画面は端末の声に落ちる。iPhone の端末の声は
 * **日本語の声が英語を読む**ので、選んだ声とは似ても似つかない。
 * しかも**その段落だけ**そうなるので、17 段落を通しで聴くまで気づけない。
 *
 * 【なぜ貼るときの上限(`speechDraft.js` の 900)では足りないか】
 *   あれは**貼った原稿にしか効かない。** AI が書いたスピーチや記事の
 *   段落は、どこでも長さを見ていない。**しかも、すでに作った教材は
 *   直らない**(段落は教材に保存されている)。
 *
 *   だから**窓口へ渡す直前**で切る。ここが最後の関所なので、
 *   **どこから来た本文でも、作った日がいつでも、必ず収まる。**
 *
 * 【切り方】
 *   ・**収まっていれば1文字も動かさない**(ふつうの段落は今までどおり)
 *   ・切れ目は**文の切れ目**。文の途中では切らない
 *   ・**1文で超えるときだけ**、語の切れ目で分ける(それでも超えるなら、
 *     窓口に断られて端末の声に落ちる —— そこは変えようがない)
 *   ・**1文字も落とさない。** 位置(`at`)も持ち帰るので、
 *     語の色も文の送りも、段落の中の正しい場所を指す
 * ══════════════════════════════════════════════════════════════════ */

/** 窓口(`speak`)の上限は 2,000。**手前で切る** */
export const SPEAK_MAX = 1700

/** 語の切れ目で、上限に収まるところまで切る(1文で超えたときだけ通る) */
function splitLongSentence(src, from, to) {
  const out = []
  let at = from
  while (to - at > SPEAK_MAX) {
    const limit = at + SPEAK_MAX
    let cut = src.lastIndexOf(' ', limit)
    // 語の切れ目が見つからない(URL など)。**そこで切る**
    if (cut <= at) cut = limit
    out.push({ text: src.slice(at, cut), at })
    at = cut + (src[cut] === ' ' ? 1 : 0)
  }
  if (to > at) out.push({ text: src.slice(at, to), at })
  return out
}

/**
 * 英文を、窓口が受け取れる長さに分ける。
 * @returns {Array<{text:string, at:number}>} `at` は元の英文の何文字目か
 */
export function speakChunks(text) {
  const src = String(text ?? '')
  if (src.length <= SPEAK_MAX) return [{ text: src, at: 0 }]

  const out = []
  let from = -1
  let to = 0
  for (const s of splitSentences(src)) {
    // **1文で超えるものは、そこだけ語の切れ目で分ける**
    if (s.end - s.start > SPEAK_MAX) {
      if (from >= 0) { out.push({ text: src.slice(from, to), at: from }); from = -1 }
      out.push(...splitLongSentence(src, s.start, s.end))
      continue
    }
    if (from >= 0 && (s.end - from) > SPEAK_MAX) {
      out.push({ text: src.slice(from, to), at: from })
      from = -1
    }
    if (from < 0) from = s.start
    to = s.end
  }
  if (from >= 0) out.push({ text: src.slice(from, to), at: from })
  return out.filter((p) => p.text.trim())
}
