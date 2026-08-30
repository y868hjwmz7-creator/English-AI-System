/**
 * カタマリごとの訳(スラッシュリーディング②・オーバーラッピング③)。
 *
 * 【何を解いているか】(2026-08 利用者の指定)
 *   利用者が紙で配っている教材は、この形をしている。
 *
 *       どれくらいの長さですか / 乗っているのは
 *       How long              / is the ride?
 *
 *   **英語のカタマリの真上に、そのカタマリの訳を置く。**
 *   文まるごとの自然な訳では②の役に立たない。訳の語順が英語と
 *   入れ替わるので、「このカタマリは何と言うのか」が分からない。
 *
 * 【役割を2つに割ってある】
 *   ・**どこで切るか** … 決まりで出す(`chunker.js`)。AI に頼まない
 *   ・**何と訳すか**   … 決まりでは書けない。教材を作るときに1回だけ作り、
 *     `material_items.chunks` に控える(0021)
 *
 * 【なぜ初級ぶんだけを控えるのか】
 *   区切りは**上級ほど減る**(`LEVEL_RULE`)。初級はすべての区切りを出し、
 *   中級・上級はその**一部**なので、初級のカタマリを**隣どうしつなげば**
 *   そのまま作れる。3レベルぶんを作らせると、費用も3倍になる。
 *
 * 【数が合わなければ、出さない】
 *   `sentencePair.js` と同じ考え方である。**ずれた対は、無いより悪い。**
 *   英文を直した教材・決まりを直したあとの教材では数が変わるので、
 *   そのときは訳を出さずに英語だけを出す。
 */
import { slashesFor, wordsOf } from './chunker.js'

/** 控えをそろえる区切りの細かさ。**ここを変えたら、控えも作り直しになる** */
export const BASE_LEVEL = 'beginner'

/** 突き合わせ用にそろえる(空白の数だけの違いは同じものとみなす) */
const norm = (text) => String(text ?? '').replace(/\s+/g, ' ').trim()

/**
 * その英文を、控えの単位(初級)で切る。
 * 教材を作るときに窓口へ渡すのは、この形である。
 *
 * @returns {string[]} カタマリの英語
 */
export function baseChunks(text) {
  const words = wordsOf(text)
  if (!words.length) return []
  const at = slashesFor(text, BASE_LEVEL).map((x) => x.at)
  const out = []
  let from = 0
  for (const i of [...at, words.length]) {
    if (i > from) out.push(words.slice(from, i).join(' '))
    from = i
  }
  return out
}

/**
 * 教材の項目から、訳を作らせる一覧を組み立てる。
 *
 * **1項目(段落 / 発言)= 1件。** 文ごとに分けない。
 * 画面の②は段落まるごとを1つとして扱うので、文で分けて控えると
 * 文と文のつなぎ目の区切りが合わなくなる。
 */
export function chunkPlan(items) {
  return (items ?? [])
    .map((it, n) => ({
      no: n + 1,
      en: norm(it.prompt_en),
      chunks: baseChunks(it.prompt_en),
    }))
    .filter((p) => p.chunks.length > 1)   // 1つしかないなら区切る意味がない
}

/**
 * その項目の控えを取り出す。**英文が変わっていたら返さない。**
 * あとから本文を直すと、カタマリと訳の対が狂う。
 */
export function storedChunks(item) {
  const c = item?.chunks
  if (!c || typeof c !== 'object') return null
  const ja = Array.isArray(c.ja) ? c.ja.map((x) => String(x ?? '')) : null
  if (!ja?.length) return null
  if (norm(c.en) !== norm(item?.prompt_en)) return null
  return ja
}

/**
 * 「英語のカタマリ + その訳」の対を作る。
 *
 * @param {string} text  英文(段落 / 発言まるごと)
 * @param {string[]|null} ja  控え(**初級の区切り**の数と同じ)
 * @param {string} level 画面で選んでいる細かさ
 * @returns {{en: string, ja: string}[]|null} 数が合わなければ null
 */
export function chunkPairs(text, ja, level = BASE_LEVEL) {
  const words = wordsOf(text)
  if (!words.length) return null
  const base = slashesFor(text, BASE_LEVEL).map((x) => x.at)
  // **数が合わなければ切らない。** ずれた対は、無いより害が大きい
  if (!Array.isArray(ja) || ja.length !== base.length + 1) return null

  // そのレベルで出す区切りだけを、つなぎ目として使う。
  // 中級・上級の区切りは初級の一部なので、残りはつなぐ
  const keep = new Set(slashesFor(text, level).map((x) => x.at).filter((i) => base.includes(i)))

  const out = []
  let en = []
  let jp = []
  let from = 0
  ;[...base, words.length].forEach((at, i) => {
    en.push(words.slice(from, at).join(' '))
    jp.push(ja[i])
    from = at
    if (at >= words.length || keep.has(at)) {
      out.push({ en: en.join(' '), ja: jp.join('').trim() })
      en = []
      jp = []
    }
  })
  return out
}

/** 画面から呼ぶ入口。項目と細かさを渡すと、対か null が返る */
export const chunkPairsOf = (item, level = BASE_LEVEL) =>
  chunkPairs(item?.prompt_en, storedChunks(item), level)
