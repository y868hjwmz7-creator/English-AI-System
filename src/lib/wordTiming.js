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
  const out = []
  for (const w of wordSpans(src)) {
    const after = src.slice(w.end, w.end + 2)
    // 語そのもの + 続く空白 + 句読点の間
    let weight = (w.end - w.at) + 1
    if (/^[,;:]/.test(after)) weight += 3
    if (/^[.!?]/.test(after)) weight += 6
    out.push({ at: w.at, weight })
  }
  return out
}

/**
 * 語の**位置と終わり**(何文字目から何文字目の手前まで)。
 *
 * **語の見つけ方は、ここ1か所。** 見積もる側(`weighWords`)と、
 * 本当の時刻を当てはめる側(`marksFromTimes`)が**別々に語を探すと、
 * 同じ本文なのに語の数が食い違う。**
 */
export const wordSpans = (text) => {
  const src = String(text ?? '')
  const re = /[A-Za-z][A-Za-z'-]*/g
  const out = []
  let m = re.exec(src)
  while (m) {
    out.push({ at: m.index, end: m.index + m[0].length })
    m = re.exec(src)
  }
  return out
}

/**
 * **本当の時刻から、語の印を作る**(2026-09 利用者の指摘)。
 *
 *   > 再生中の文章のハイライトのタイミングをもっと正確にできないですか?
 *
 * `wordMarks()` は**見積もり**である(語の長さと句読点から、全体の長さを
 * 比で割る)。合っているのは合計だけで、途中はどこもずれている。
 * ElevenLabs から文字ごとの時刻を控えてあるなら、**割る必要がない。**
 *
 * **返す形は `wordMarks()` とまったく同じ**(`{at, until}` のミリ秒)。
 * だから鳴らす側は、どちらが来たのかを知らなくてよい。
 *
 * @param {string} text その英文
 * @param {{start:number[],end:number[]}|null} times `charTimesOf()` の返り値
 * @returns {Array<{at:number,until:number}>} 当てはめられなければ空
 */
export const marksFromTimes = (text, times) => {
  const src = String(text ?? '')
  const end = times?.end
  if (!Array.isArray(end) || end.length !== src.length) return []
  const out = []
  for (const w of wordSpans(src)) {
    // その語の**最後の文字**が終わった秒。空白は入っていない
    let sec = NaN
    for (let i = w.end - 1; i >= w.at; i -= 1) {
      if (Number.isFinite(end[i])) { sec = end[i]; break }
    }
    // **1語でも当てはまらなければ、見積もりに戻す**(混ぜると途中で飛ぶ)
    if (!Number.isFinite(sec)) return []
    out.push({ at: w.at, until: sec * 1000 })
  }
  /* **時刻が前後していたら使わない。** `markIndexAt()` は
     「まだ来ていない最初の語」を探すので、並びが乱れると**戻って光る** */
  for (let i = 1; i < out.length; i += 1) {
    if (out[i].until < out[i - 1].until) return []
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
 *
 * 【略語のピリオドでは切らない】(2026-09 利用者の指定)
 *
 *   > Ph. D / Dr. Hara など、ピリオドが含まれるが文の終わりを示すわけでは
 *   > ない語句のリストを作り、これらのピリオドを文の終わりとして
 *   > 捉えないよう改善してください。
 *
 *   以前は「辞書は持たない(抜けが新しい不具合になる)」としていたが、
 *   **`Dr. Hara` が2つの文に割れると、色も送りも名前の途中で切れる。**
 *   見落とし(切らないまま長い1文になる)より害が大きい。
 *
 * @returns {Array<{start: number, end: number}>} 本文の何文字目から何文字目まで
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

/**
 * **1本の MP3 の中で、文がどこからどこまでか**を「割合」で出す(2026-09)。
 *
 * ════════════════════════════════════════════════════════════════
 * 【なぜ要るか】(2026-09 実機・利用者の指摘)
 *
 *   > 文を飛ばす機能、リピート機能などが一部機能しません。
 *   > これは、スピーチで自前で長い文を生成したものだけで、
 *   > 他の教材では機能しています。
 *
 *   文の区間は、これまで**1本にまとめた音声の時刻(`alignment`)からしか**
 *   出していなかった。ところがその1本は**2,800 文字まで**しか作れない
 *   (ElevenLabs の上限)。貼った原稿は桁違いに長いので1本にできず、
 *   段落ごとの MP3 に落ちる。そこには時刻が無いので、
 *   **1文ずつの ◀ ▶ も、文のくり返しも、丸ごと死んでいた。**
 *
 * 【なぜ見積もりでよいか】
 *   **語の色は、もともとこの重みで動いている**(`wordMarks`)。
 *   同じ物差しで区間を出せば、**色と送り先が必ず一致する** ——
 *   見た目に「いま光っている文の頭へ戻った」と映る。
 *   このファイルの冒頭の決まり(**経路ごとに書かない**)そのままである。
 *
 * 【なぜ秒ではなく割合か】
 *   秒にするには MP3 の長さが要るが、それが分かるのは**読み込んだあと**で
 *   ある。割合で持てば**鳴らす前に控えられる**ので、段落の切れ目で
 *   ◀ ▶ が一瞬押せなくなる、ということが起きない。
 *   秒に直すのは、押された瞬間に長さを掛けるだけでよい。
 * ════════════════════════════════════════════════════════════════
 *
 * @param {string} text その MP3 で読み上げる英文
 * @returns {Array<{start:number,end:number,charIndex:number}>}
 *   `start` / `end` は **0〜1 の割合**。`charIndex` は本文の何文字目か
 */
export const sentenceShares = (text) => {
  const src = String(text ?? '')
  const words = weighWords(src)
  const total = totalWeight(words)
  // 語が1つも無い(記号だけ)。**当てずっぽうで区切らない**
  if (!words.length || total <= 0) return []

  let acc = 0
  let w = 0
  const out = []
  for (const c of splitSentences(src)) {
    const start = acc / total
    // その文の終わりまでに含まれる語の重みを足す
    while (w < words.length && words[w].at < c.end) { acc += words[w].weight; w += 1 }
    const end = acc / total
    // 語を1つも含まない切れ端(空白だけ)は落とす
    if (end > start) out.push({ start, end, charIndex: c.start })
  }
  // **最後は必ず終わりまで。** 丸めの余りを残すと、最後の文だけ回らない
  if (out.length) out[out.length - 1].end = 1
  return out
}

/** 割合の区間を、その MP3 の長さ(秒)に直す */
export const sharesToTimes = (shares, seconds) => {
  const dur = Number(seconds)
  if (!Array.isArray(shares) || !shares.length || !(dur > 0)) return null
  return shares.map((s) => ({ ...s, start: s.start * dur, end: s.end * dur }))
}

/* ════════════════════════════════════════════════════════════════
 * **文の区間も、見積もりをやめる**(2026-09 利用者の指摘)
 *
 *   > 再生中の文章のハイライトのタイミングをもっと正確にできないですか?
 *
 * `sentenceShares()` は**語の重みで割った見積もり**である。
 * 合っているのは合計だけで、途中はどこもずれている。
 * ElevenLabs から文字ごとの時刻を控えてあるなら、**割る必要がない。**
 *
 * 【返す形は `sharesToTimes()` とまったく同じ】
 *   `{start, end, charIndex}` の**秒**。だから呼ぶ側は、
 *   どちらが来たのかを知らなくてよい(`repeatSeek` も `seekSentence` も
 *   `spanForRange` も、1行も変わらない)。
 *
 * 【当てはまらなければ `null`。**当てずっぽうで区切らない**】
 *   ずれた区間は、無いより悪い —— ◀ ▶ が**別の文へ飛ぶ**からである
 *   (`sentencePair.js` の「数が合わなければ切らない」と同じ決まり)。
 *   `null` のときは、これまでどおり見積もりに戻る。
 * ════════════════════════════════════════════════════════════════
 *
 * @param {string} text その MP3 で読み上げる英文
 * @param {{start:number[],end:number[]}|null} times `charTimesOf()` の返り値
 * @returns {Array<{start:number,end:number,charIndex:number}>|null}
 */
export const sentenceTimesOf = (text, times) => {
  const src = String(text ?? '')
  const from = times?.start
  const to = times?.end
  if (!Array.isArray(from) || from.length !== src.length) return null
  if (!Array.isArray(to) || to.length !== src.length) return null

  const out = []
  for (const c of splitSentences(src)) {
    // その文の中で、**いちばん初めに音になる文字**と、いちばん終わりの文字
    let start = NaN
    for (let i = c.start; i < c.end; i += 1) {
      if (Number.isFinite(from[i])) { start = from[i]; break }
    }
    let end = NaN
    for (let i = c.end - 1; i >= c.start; i -= 1) {
      if (Number.isFinite(to[i])) { end = to[i]; break }
    }
    // 音になる文字が1つも無い切れ端(空白・記号だけ)は落とす
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) continue
    out.push({ start, end, charIndex: c.start })
  }
  if (!out.length) return null
  // **前へ戻る並びは当てにしない。** 当てはめ方そのものが崩れている
  for (let i = 1; i < out.length; i += 1) {
    if (out[i].start < out[i - 1].start) return null
  }
  return out
}
