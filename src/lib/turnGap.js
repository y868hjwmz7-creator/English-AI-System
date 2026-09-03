/**
 * 会話の**受け答えのあいだ**(間)を、内容から決める。
 *
 * ============================================================================
 * 【なぜ要るか】(2026-09 実機・利用者の指摘)
 *
 *   > 女性の発話が不自然なくらい早いタイミングで食い気味に入ってきます。
 *   > 本当の会話っぽい間をいれれないものでしょうか?特に内容によって。。。
 *   > 確かに食い気味に返答することもあるとは思いますので、
 *   > 間がある時と食い気味な時を内容によって自動でコントロールできませんか?
 *
 *   会話は発言ごとに別の MP3 を作って順に鳴らしている。ところが
 *   `readAloudSequence()` は**鳴り終わった瞬間に次を始めていた**(間 0 ミリ秒)。
 *   ElevenLabs の音声は前後の無音がほとんど無いので、
 *   **息継ぎも無しに次の人が話し出す。** これが「食い気味」の正体である。
 *
 * ============================================================================
 * 【決まりで書く。AI に頼まない】
 *
 *   スラッシュリーディングの区切り(`chunker.js`)と同じ考え方である。
 *   「考えてから答える」「すぐ相づちを打つ」を分けるのに要るのは、
 *   **記号と、閉じた語のリスト**だけで足りる。1発言ごとに課金する理由がない。
 *
 *   **当てられることだけを見る。**「この話題は重いから考えるはず」のような
 *   判断はできない。**あやふやな間は、無い間より気持ちが悪い**ので入れない。
 *
 * ============================================================================
 * 【記事にも同じように入れる】(2026-09 利用者の指定)
 *
 *   > 記事でも同じ仕様にしてください。
 *
 *   はじめは**話す人が替わるときだけ**にしていたが、記事も段落と段落が
 *   詰まって聞こえる。いまは**どの継ぎ目にも**間を置く。
 *
 *   ただし**同じ人が続けて話すとき**(記事の段落・一人が続けて話す発言)は、
 *   受け答えの規則を当てない。相づちも付加疑問も**相手がいる話**であって、
 *   一人で読んでいるところには無い。当てると
 *   「段落が Right, で始まったので食い気味」という、意味のない間になる。
 *
 *   同じ人が続けるときに要るのは**息継ぎ**である。少し長めの一定の間を置き、
 *   問いかけで終わっていれば一拍足す(問いかけたまま次へ流さない)。
 * ============================================================================
 */

/** ふつうの受け答え。ここが基準 */
const BASE = 380

/** 食い気味。相づち・即答・割り込み */
const QUICK = 120

/** 考えてから答える */
const THINK = 900

/**
 * **息継ぎ。** 同じ人が続けて話すとき(記事の段落の切れ目など)。
 * 受け答えより少し長い。段落は「話がひとまとまり終わった」ところだからである。
 */
const BREATH = 600

/** どんなに長くても、ここで止める(待たされている感じになる) */
const MAX_GAP = 1400

/**
 * **すぐ返ってくる言い方。** 相づち・同意・即答。
 * どれも「聞いた瞬間に口が動く」ものだけを入れてある。
 */
const QUICK_STARTS = [
  'right', 'exactly', 'sure', 'yeah', 'yep', 'yes', 'no', 'nope',
  'absolutely', 'definitely', 'agreed', 'true', 'okay', 'ok', 'alright',
  'of course', 'fair enough', 'got it', 'understood', 'makes sense',
  'good point', 'that works', 'will do', 'exactly right',
]

/**
 * **言いよどみ。** これで始まるなら、考えてから話している。
 *
 * **`so` は入れない。** ただのつなぎ言葉として文頭に立つことが多く、
 * 間があるとは限らない(`HEAD_WORDS` に副詞を入れないのと同じ理由)。
 */
const THINK_STARTS = [
  'well', 'hmm', 'hm', 'um', 'uh', 'er',
  'let me', 'let\'s see', 'actually', 'honestly', 'to be honest',
  'i mean', 'i suppose', 'i guess', 'i think',
  'that\'s a good question', 'good question', 'that depends', 'it depends',
]

/**
 * **付加疑問の尻尾。** 「…だよね?」は答えを求めているのではなく
 * 同意を求めているので、**間を置かずに返る。**
 *
 * ここも閉じたリストにしてある。「?で終わって、最後のコンマから先が短い」
 * だけで判定すると、`Do you want tea, coffee, or juice?` を
 * 付加疑問と取り違える(実際に書いてみて気づいた)。
 */
const TAG_TAILS = [
  'right', 'correct', 'okay', 'ok', 'yeah', 'no',
  'isn\'t it', 'is it', 'aren\'t they', 'aren\'t you', 'are you',
  'don\'t you', 'do you', 'doesn\'t it', 'does it',
  'didn\'t you', 'did you', 'won\'t you', 'will you',
  'wouldn\'t you', 'can\'t you', 'couldn\'t you', 'shouldn\'t we',
  'hasn\'t it', 'haven\'t you', 'wasn\'t it', 'weren\'t they',
  'shall we', 'you know',
]

/** 記号と余分な空白を落として、頭から見比べられる形にする */
const head = (text) => String(text ?? '')
  .trim()
  .toLowerCase()
  .replace(/^[“"'(\[]+/, '')

const startsWithAny = (text, list) => {
  const t = head(text)
  return list.some((w) => t === w || t.startsWith(`${w} `) || t.startsWith(`${w},`)
    || t.startsWith(`${w}.`) || t.startsWith(`${w}!`) || t.startsWith(`${w}?`)
    || t.startsWith(`${w}—`) || t.startsWith(`${w}'`))
}

/** 言い終わっていない(割り込まれた・言いよどんで消えた) */
const trailsOff = (text) => /(—|--|\.\.\.|…)\s*["'”’)]?\s*$/.test(String(text ?? '').trim())

/** 「…だよね?」で終わっているか */
function isTagQuestion(text) {
  const t = String(text ?? '').trim()
  if (!/\?\s*["'”’)]?\s*$/.test(t)) return false
  const at = t.lastIndexOf(',')
  if (at < 0) return false
  const tail = t.slice(at + 1).replace(/[?!.\s"'”’)]+$/g, '').trim().toLowerCase()
  return TAG_TAILS.includes(tail)
}

/** ふつうの疑問文(付加疑問は含まない) */
const isQuestion = (text) => /\?\s*["'”’)]?\s*$/.test(String(text ?? '').trim())
  && !isTagQuestion(text)

const wordCount = (text) => String(text ?? '').trim().split(/\s+/).filter(Boolean).length

/**
 * 直前の発言と、次の発言から、あいだに置く間(ミリ秒)を決める。
 *
 * **上から順に見て、当てはまった時点で決める。** 足し合わせない
 * (「相づちなのに疑問文だから長い」のような、説明できない値になる)。
 *
 * @param {string} prev 直前の発言
 * @param {string} next これから鳴らす発言
 * @param {object} [o]
 * @param {boolean} [o.sameVoice] 同じ人が続けて話すか(記事の段落など)
 * @returns {number} ミリ秒
 */
export function turnGapMs(prev, next, { sameVoice = false } = {}) {
  // ① 言い終わっていない → 相手が引き取る。**いちばん短い**
  if (trailsOff(prev)) return QUICK

  // ── 同じ人が続けて話すとき(記事の段落・続けての発言)──────────
  //
  //   **受け答えの規則は当てない。** 相づちも付加疑問も「相手がいる」話で、
  //   一人で読んでいるところには無い。要るのは息継ぎである。
  if (sameVoice) {
    // 問いかけて終わっていれば一拍おく(問うたまま次へ流さない)
    if (isQuestion(prev)) return Math.min(BREATH + 300, MAX_GAP)
    const words = wordCount(prev)
    if (words >= 40) return Math.min(BREATH + 200, MAX_GAP)
    return BREATH
  }

  // ② 相づち・即答で始まる → 聞いた瞬間に口が動いている
  if (startsWithAny(next, QUICK_STARTS)) return QUICK

  // ③ 「…だよね?」→ 答えではなく同意なので、すぐ返る
  if (isTagQuestion(prev)) return QUICK

  // ④ 言いよどみで始まる → 考えている
  if (startsWithAny(next, THINK_STARTS)) return THINK

  // ⑤ 問われた → 考えてから答える。**長い問いほど、飲み込むのに時間がいる**
  if (isQuestion(prev)) {
    const extra = Math.min(Math.floor(wordCount(prev) / 10) * 100, MAX_GAP - THINK)
    return THINK + extra
  }

  // ⑥ それ以外。**前が長ければ、少しだけ足す**
  const n = wordCount(prev)
  if (n >= 40) return Math.min(BASE + 300, MAX_GAP)
  if (n >= 25) return BASE + 150
  return BASE
}

export const GAP_VALUES = { BASE, QUICK, THINK, BREATH, MAX_GAP }
