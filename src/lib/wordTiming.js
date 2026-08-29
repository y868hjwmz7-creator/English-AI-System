/**
 * 「いま、どの語を読んでいるか」を時間から割り出すための計算。
 *
 * 【なぜ別の場所に置くか】
 *   読み上げには2つの経路がある。
 *     ・端末の声(`speech.js`)
 *     ・こちらで作った MP3(`audioClips.js`)
 *   **どちらも同じ物差しで語を送る。** 経路ごとに書くと、
 *   同じ本文なのに色の進み方が違う、という気持ちの悪いことが起きる。
 *
 * 【MP3 のほうが正確になる】
 *   端末の声では、**かかる時間そのものが分からない**ので、
 *   声ごとの実測値(1秒あたり何文字)から見積もるしかない。
 *   MP3 なら `audio.duration` で**長さが最初から分かっている。**
 *   配り方(語の重み)は同じでも、総量が正しいぶん精度が上がる。
 */

/**
 * 語の位置と、その語に配る「重み」を出す。
 *
 * 長い語ほど時間がかかる。読点・句点のあとには**間**が入るので、
 * その分を足しておく。ここがずれると、色だけ先に進んでしまう。
 */
export const weighWords = (text) => {
  const src = String(text ?? '')
  const re = /[A-Za-z][A-Za-z'-]*/g
  const out = []
  let m = re.exec(src)
  while (m) {
    const after = src.slice(m.index + m[0].length, m.index + m[0].length + 2)
    // 語そのもの + 続く空白 + 句読点の間
    let weight = m[0].length + 1
    if (/^[,;:]/.test(after)) weight += 3
    if (/^[.!?]/.test(after)) weight += 6
    out.push({ at: m.index, weight })
    m = re.exec(src)
  }
  return out
}

/** 重みの合計。実測から「1秒あたり何文字ぶん」を出すときにも使う */
export const totalWeight = (words) => words.reduce((n, w) => n + w.weight, 0)

/**
 * 「この語は、ここまでに読み終わっているはず」の時刻(ミリ秒)を並べる。
 *
 * @param {string} text  読み上げる英文
 * @param {number} totalMs 全体にかかる時間
 * @returns {Array<{at: number, until: number}>} at は本文の何文字目か
 */
export const wordMarks = (text, totalMs) => {
  const words = weighWords(text)
  const total = totalWeight(words)
  if (!words.length || total <= 0 || !(totalMs > 0)) return []
  let acc = 0
  return words.map((w) => {
    acc += w.weight
    return { at: w.at, until: (acc / total) * totalMs }
  })
}

/**
 * 経過時間から、いま色を付けるべき語を選ぶ。
 * **前と同じなら知らせない**(同じ語を何度も送ると画面が無駄に描き直される)。
 */
export const markIndexAt = (marks, elapsedMs) => {
  if (!marks.length) return -1
  const next = marks.findIndex((m) => elapsedMs < m.until)
  return next < 0 ? marks.length - 1 : next
}

/**
 * 本文を**文**に切る。フルストップからフルストップまで。
 *
 * 【なぜ要るか】(2026-08 利用者の指定)
 *   > 読み上げている単語のハイライトは、別に文章毎でも大丈夫です。
 *   > フルストップからフルストップまでをハイライト。
 *
 *   語ごとの色は、合図(`boundary`)を出さない端末では見積もりに頼るしかなく、
 *   **1語ずれると目に見えて気持ちが悪い。** 文の単位なら、多少ずれても
 *   「いまこの文を読んでいる」は正しいままである。
 *   **精度を上げるより、外れても困らない見せ方を選ぶ。**
 *
 * 【どこで切るか】
 *   `. ! ?` の並びと、そのあとに続く閉じ引用符・閉じ括弧までを1つの文に含める。
 *   区切りの記号を次の文の頭に付けると、色が1文字だけ先に動いて見える。
 *   **略語(Mr. / U.S.)では切れてしまう。** それでも困らない見せ方なので、
 *   辞書は持たない(持てば、その辞書の抜けが新しい不具合になる)。
 *
 * @returns {Array<{start: number, end: number}>} 本文の何文字目から何文字目まで
 */
export const splitSentences = (text) => {
  const src = String(text ?? '')
  const out = []
  const re = /[^.!?]*[.!?]+["'’”)\]]*\s*/g
  let last = 0
  let m = re.exec(src)
  while (m) {
    if (!m[0].length) break
    out.push({ start: m.index, end: m.index + m[0].length })
    last = m.index + m[0].length
    m = re.exec(src)
  }
  // 最後が句点で終わっていない本文(見出し・言いさし)も1つの文として扱う
  if (last < src.length) out.push({ start: last, end: src.length })
  return out.length ? out : [{ start: 0, end: src.length }]
}

/** その位置を含む文。無ければ null */
export const sentenceAt = (text, at) => {
  if (at == null) return null
  return splitSentences(text).find((s) => at >= s.start && at < s.end) ?? null
}
