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
 * ============================================================================
 * **画面の1文字は、声にすると何文字ぶんか**(第5.231節・2026-09 実機)。
 *
 *   > 2019、つまり twenty-nineteen の部分が、
 *   > twenty が終わったところで折り返されてしまいます。なぜでしょうか?
 *
 * 【何が起きていたか】
 *   `2019` は画面では4文字、声では `twenty nineteen` の15文字である。
 *   ところが重みは**画面の文字数**で付けていた。しかも `wordSpans()` は
 *   `[A-Za-z]` しか拾っていなかったので、**数字は語ですらなく、重み 0**
 *   だった。実測すると、こうなっていた。
 *
 *     Our technician found a worn belt inside the motor. It's an old part from 2019.
 *     ├─────────────── 見積もり 71.8% ───────────────┤├── 28.2% ──┤
 *     ├──────────── 本当は 56% ────────────┤├────── 44% ──────┤
 *
 *   **1文目の終わりが、声より 16% うしろにずれる。**
 *   その 16% は、ちょうど `twenty` を言い終えたあたりである ——
 *   だから1文をくり返すと、**次の文の `twenty` まで鳴ってから折り返す。**
 *
 * 【直し方 —— もらえる正解を捨てない】(CLAUDE.md)
 *   読み方は `speakText()` がすでに知っている(`$25` → `twenty-five
 *   dollars`)。**測り直さない。あちらに訊く。**
 *   `parts` は「画面の何文字目が、何と読まれたか」なので、
 *   **その読み方の長さを、覆っている画面の文字に配る。**
 *
 * 【語の外は数えない】
 *   `10 A.M.` のように**ひとかたまりの中に空白**があることがある。
 *   語の中の文字だけに配るので、**配った合計が語からこぼれない。**
 *
 * 【同じ英文を何度も訊かない】
 *   `weighWords()` は1回の読み上げで何度も呼ばれる。
 *   控えておく。**止まる条件を持たせる**(CLAUDE.md)ので上限を切る。
 * ============================================================================
 */
const SAY_MEMO = new Map()
const SAY_MEMO_MAX = 32

const spokenPerChar = (src, spans) => {
  const per = new Array(src.length).fill(1)
  if (!src) return per
  let parts = SAY_MEMO.get(src)
  if (!parts) {
    /* **読めなかったら、画面の文字数のまま。** 当てずっぽうで伸ばさない */
    try { parts = speakText(src).parts ?? [] } catch { parts = [] }
    if (SAY_MEMO.size >= SAY_MEMO_MAX) SAY_MEMO.clear()
    SAY_MEMO.set(src, parts)
  }
  if (!parts.length) return per
  // 語の中にいる文字だけに配る(語の外へ配ると、合計がこぼれる)
  const inWord = new Uint8Array(src.length)
  for (const w of spans) for (let i = w.at; i < w.end; i += 1) inWord[i] = 1
  for (const p of parts) {
    const at = Number(p?.at)
    const len = Number(p?.len) || 0
    const say = String(p?.say ?? '')
    if (!Number.isInteger(at) || at < 0 || len <= 0 || at + len > src.length) continue
    const mine = []
    for (let i = at; i < at + len; i += 1) if (inWord[i]) mine.push(i)
    if (!mine.length) continue
    /* **語の数ぶんの「間」も配る**(第5.231節)。
       重みは語ごとに +1 されるが(下の `weighWords`)、画面では
       `3.5%` が**1語**、声では `three point five percent` の**4語**である。
       差のぶん(4 − 1 = 3)をここで足しておかないと、
       **読みが長いかたまりほど、少しずつ短く見積もられる**(実測 3.4%)。
       **語の数え方は `wordSpans()` 1か所**(ここで数え直さない) */
    const share = say.length / mine.length
    for (const i of mine) per[i] = share
  }
  return per
}

/**
 * 語の位置と、その語に配る「重み」を出す。
 *
 * 長い語ほど時間がかかる。読点・句点のあとには**間**が入るので、
 * その分を足しておく。ここがずれると、色だけ先に進んでしまう。
 *
 * **長さは「声にしたときの長さ」で数える**(第5.231節・上記)。
 * 画面の文字数で数えると、数字や略語のところで区間がまるごとずれる。
 */
export const weighWords = (text) => {
  const src = String(text ?? '')
  const spans = wordSpans(src)
  const per = spokenPerChar(src, spans)
  const out = []
  for (const w of spans) {
    /* **語と句読点のあいだの記号は、またいで見る**(第5.231節・実測)。

       `3.5%.` の「間」が付いていなかった —— 語は `3.5`、
       そのうしろは `%` なので、**2文字の窓には `.` が入らない。**
       `$25.` `(2019).` `12kg.` でも同じことが起きる。
       文の終わりの「間」(重み6)は、区間のずれの中でいちばん大きい。

       **飛ばすのは記号だけ。** 空白も、語も、見たい句読点そのものも
       飛ばさない(飛ばすと、次の語の句読点を自分のものにしてしまう) */
    const after = src.slice(w.end, w.end + 4).replace(/^[^A-Za-z0-9\s.,;:!?]+/, '')
    // 語そのもの + 続く空白 + 句読点の間
    let weight = 1
    for (let i = w.at; i < w.end; i += 1) weight += per[i]
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
 *
 * **数字も語である**(第5.231節・2026-09 実機)。
 * `[A-Za-z]` しか拾っていなかったので、`2019` も `7:15` も `3.5` も
 * **語として存在せず、重み 0** だった。声にはちゃんと出ているのに、
 * 見積もりの上では一瞬で通り過ぎることになっていた。
 *
 * ・`2019` `1,000` `3.5` `7:15` … 数字でつながるあいだは1つの語
 * ・**うしろのピリオドは食べない**(`2019.` は `2019` と `.`)——
 *   食べると、文の終わりの「間」が付かなくなる
 */
export const wordSpans = (text) => {
  const src = String(text ?? '')
  const re = /[A-Za-z][A-Za-z'-]*|\d(?:[.,:/]?\d)*/g
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
 * ══════════════════════════════════════════════════════════════════
 * **`until` は「その語が終わった秒」ではない。「次の語が始まる秒」である**
 * (2026-09 実測。利用者の指摘「やっぱりハイライトが実際の音とずれます」)
 *
 * `markIndexAt()` は **`elapsedMs < until` になる最初の印**を返す。
 * つまり `until` は「**この印が現役でいられる終わり**」であって、
 * 「その語が鳴り終わった秒」ではない。
 *
 * 見積もりの `wordMarks()` は重みを足し上げるので、
 * **ある語の `until` = 次の語の頭**になっており、はじめからこの約束を
 * 満たしていた。**本当の時刻を使うこちらだけが、約束を破っていた。**
 *
 * 【何が起きていたか】
 *   本物の音声は、文と文のあいだに 0.3〜0.8 秒の**間(ま)**がある。
 *   ところが「その語が終わった秒」を `until` にすると、
 *   **前の文が鳴り終わった瞬間に次の文が光る。**
 *
 *     …a new machine.   ← 1.72 秒で鳴り終わる
 *     (0.55 秒の間)     ← ここで**もう2文目が光っている**
 *     Everyone was…     ← 実際に鳴り出すのは 2.27 秒
 *
 *   実測で **0.55 秒early**。ハイライトが声より先に走る、まさに
 *   利用者の言う「ずれ」である。**次の語の頭まで伸ばせば 0.01 秒**
 *   (10ms ごとに見ているので、それ以上は詰められない)。
 *
 * 【伸ばすだけ。縮めない】
 *   時刻が当てはまらなかった語は飛ばしてあるので、その手前の語は
 *   そのぶん長く現役でいる(**前の語の色がそのまま伸びる**)。
 *   縮めると、そこだけ色が消える。
 *
 * 【いちばん最後の語は、そのまま】
 *   次が無いので伸ばしようがない。`markIndexAt()` は行き過ぎたら
 *   最後の印を返すので、鳴り終わりまで光ったままになる。
 * ══════════════════════════════════════════════════════════════════
 *
 * @param {string} text その英文
 * @param {{start:number[],end:number[]}|null} times `charTimesOf()` の返り値
 * @returns {Array<{at:number,until:number}>} 当てはめられなければ空
 */
export const marksFromTimes = (text, times) => {
  const src = String(text ?? '')
  const from = times?.start
  const end = times?.end
  if (!Array.isArray(end) || end.length !== src.length) return []
  const out = []
  const words = wordSpans(src)
  for (const w of words) {
    // その語の**最後の文字**が終わった秒。空白は入っていない
    let sec = NaN
    for (let i = w.end - 1; i >= w.at; i -= 1) {
      if (Number.isFinite(end[i])) { sec = end[i]; break }
    }
    /* **当てはまらない語は飛ばす**(2026-09)。ElevenLabs は読むために
       文字を書き換えるので(`12%` → `twelve percent`)、そこだけ
       時刻が付かない。**飛ばしても前の語の色がそのまま伸びるだけ**で、
       戻ったり飛んだりはしない。**当てずっぽうで埋めない** */
    if (!Number.isFinite(sec)) continue
    out.push({ at: w.at, until: sec * 1000 })
  }
  /* **次の語が始まる秒まで伸ばす**(上記)。頭の時刻が揃っていないときは
     何もしない —— これまでどおりの動きに戻るだけである */
  if (Array.isArray(from) && from.length === src.length) {
    for (let i = 0; i < out.length - 1; i += 1) {
      let head = NaN
      for (let k = out[i + 1].at; k < src.length; k += 1) {
        if (Number.isFinite(from[k])) { head = from[k]; break }
      }
      // **伸ばすだけ。縮めない**(縮めると、そこだけ色が消える)
      if (Number.isFinite(head) && head * 1000 > out[i].until) out[i].until = head * 1000
    }
  }
  // **半分も当てはまらないなら、当てはめ方そのものが崩れている**
  if (!out.length || out.length < words.length * 0.6) return []
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

/* **文の切れ目は `sentenceSplit.js` が持つ**(第5.231節)。
   読み上げ用の英文(`speakText.js`)も同じものを使うので、
   ここに置いたままだと読み込みが輪になる。
   **呼ぶ側が1行も変わらないよう、ここから出し直す** */
export { ABBREVIATIONS, sentenceAt, splitSentences } from './sentenceSplit.js'
import { splitSentences } from './sentenceSplit.js'
/* **読み方は `speakText()` がすでに知っている。測り直さない**(第5.231節)。
   `sentenceSplit.js` を切り出したのは、ここが輪にならないようにするため */
import { speakText } from './speakText.js'

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
