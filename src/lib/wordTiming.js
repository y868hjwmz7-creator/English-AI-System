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
