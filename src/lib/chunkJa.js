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
import { postModifier, slashesFor, wordsOf } from './chunker.js'

/** 控えをそろえる区切りの細かさ。**ここを変えたら、控えも作り直しになる** */
export const BASE_LEVEL = 'beginner'

/** 突き合わせ用にそろえる(空白の数だけの違いは同じものとみなす) */
const norm = (text) => String(text ?? '').replace(/\s+/g, ' ').trim()

/**
 * 訳をつなぐ。**同じことを二度書かない**(2026-09 実機)。
 *
 *   are hard / to ignore.
 *   →「無視するのは難しい」「無視するのは」
 *
 * 窓口(AI)が、**隣のカタマリの意味まで書いてしまう**ことがある。
 * 指示には「そのカタマリだけの意味にする」と書いてあるが、守られない回が
 * ある。そのまま2つをつなぐと **「無視するのは難しい無視するのは」** と
 * 出る(利用者の写真で確認)。
 *
 * **すでに作ってある教材を直すために、出すときにも見る。**
 * 窓口の指示だけを直しても、**いま入っている訳は直らない。**
 *
 * 【行きすぎないようにしてある】
 *   ・見るのは**直前の1つ**だけ(離れたところの言葉は消さない)
 *   ・**3文字以上**のときだけ(「は」「に」のような助詞は消さない)
 *   ・長いほうを残す(短いほうは、その中に入っている)
 */
const joinJa = (list) => {
  const out = []
  for (const raw of list) {
    const t = String(raw ?? '').trim()
    if (!t) continue
    const prev = out[out.length - 1]
    if (prev && t.length >= 3 && prev.length >= 3) {
      if (prev.includes(t)) continue              // 前がすべて含んでいる
      if (t.includes(prev)) { out[out.length - 1] = t; continue }
    }
    out.push(t)
  }
  return out.join('').trim()
}

/**
 * その英文を、控えの単位(初級)で切る。
 * 教材を作るときに窓口へ渡すのは、この形である。
 *
 * @returns {string[]} カタマリの英語
 */
export function baseChunks(text) {
  const words = wordsOf(text)
  if (!words.length) return []
  const at = slashesFor(text, BASE_LEVEL)
    .map((x) => x.at)
    /* ★ 前の名詞を説明する語句は、名詞と**1つにまとめる**★
         (2026-09 利用者の指定)

       > 分詞修飾の訳し方がおかしいことが多いです。
       > the boy running in the park just said hello to me. の訳が
       > 「男の子は走っている / がたった今私にこんにちはと言いました」
       > 本来は、「走っている男の子」であるべきです

       ここで切ると、訳す単位が「The boy」と「running」に割れる。
       前から訳す決まりなので「男の子は」「走っている」となり、
       つなぐと**述語のように**読める。
       日本語では説明が名詞の**前**に来る(連体修飾)ので、
       **1つのカタマリとして訳させる**しかない
       (「走っている男の子は」)。

       **英語の区切り(スラッシュ)は変えていない。**
       「前の名詞を説明する分詞も初心者は分けて考えます」(2026-08)は
       そのままである。変えたのは**訳を作る単位**だけ。
       ゲストがそこで切っても、訳はその対のぶんがまとめて出る。 */
    /* ただし**文の切れ目は、絶対にまたがない。**
       前の文が分詞で終わっていると、次の文の頭が「前の名詞の説明」に
       見えることがある。そこでまとめると、2つの文が1つのカタマリになる */
    .filter((i) => !postModifier(words, i) || /[.!?]["')\]]*$/.test(words[i - 1] ?? ''))
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
 * 控えたときの**カタマリの英語**(2026-08 に足した)。
 *
 * 【なぜ持つのか】
 *   訳は「初級の区切り」でそろえて作る。以前はその区切りを
 *   **表示のたびに計算し直していた**ので、区切りの決まりを直すと
 *   カタマリの数が変わり、**すでに作った訳が丸ごと出なくなった**
 *   (2026-08 実機。句動詞の決まりを足したとき)。
 *
 *   控えたときの切れ目そのものを一緒に残しておけば、
 *   **あとで決まりを変えても、訳はずれない。**
 *
 * 【古い控えには入っていない】
 *   0021 で作ったものには `parts` が無い。そのときは null を返し、
 *   これまでどおり計算し直す(数が合わなければ訳を出さない)。
 */
export function storedParts(item) {
  const c = item?.chunks
  const parts = Array.isArray(c?.parts) ? c.parts.map((x) => String(x ?? '')) : null
  if (!parts?.length) return null
  // **中身が本文と食い違っていたら使わない。** つないで元に戻ることを見る
  if (norm(parts.join(' ')) !== norm(item?.prompt_en)) return null
  if (!Array.isArray(c?.ja) || c.ja.length !== parts.length) return null
  return parts
}

/** カタマリの英語から、区切りの位置(語数の積み上げ)を出す */
const cutsFromParts = (parts) => {
  const at = []
  let n = 0
  for (const p of parts.slice(0, -1)) { n += wordsOf(p).length; at.push(n) }
  return at
}

/**
 * 訳を分けられる位置。**控えに残っていればそれを使い、無ければ計算する。**
 * ここを1か所にしておかないと、表示と作成で切れ目が食い違う。
 */
const baseCuts = (text, parts) => (
  /* **控えが無いときも `baseChunks()` から出す。**
     ここで `slashesFor()` を直に呼んでいたので、分詞修飾を名詞と
     まとめたときに**作る側と出す側で切れ目が食い違い**、
     数が合わずに訳が丸ごと出なくなった(2026-09)。
     控えの単位は `baseChunks()` 1か所に置く */
  parts?.length ? cutsFromParts(parts) : cutsFromParts(baseChunks(text))
)

/**
 * 「英語のカタマリ + その訳」の対を作る。
 *
 * @param {string} text  英文(段落 / 発言まるごと)
 * @param {string[]|null} ja  控え(**初級の区切り**の数と同じ)
 * @param {string} level 画面で選んでいる細かさ
 * @returns {{en: string, ja: string}[]|null} 数が合わなければ null
 */
export function chunkPairs(text, ja, level = BASE_LEVEL, parts = null) {
  const words = wordsOf(text)
  if (!words.length) return null
  const base = baseCuts(text, parts)
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
      out.push({ en: en.join(' '), ja: joinJa(jp) })
      en = []
      jp = []
    }
  })
  return out
}

/**
 * その項目の訳を、**作り直したほうがよいか。**
 *
 * 4つのどれかに当てはまれば作り直す。**判断はここ1か所。**
 *   ① まだ訳が無い
 *   ② 数が合わず、対が作れない(英文を直した・古い決まりで作った)
 *   ③ **控えの切れ目が、いまの決まりと違う**(2026-09 に広げた)
 *   ④ **中身の空いたカタマリがある**(2026-09 実機)
 *
 * ③ ははじめ「いまのほうが**細かい**とき」だけだった(2026-08 利用者の指定)。
 * 区切りを細かくしたぶんを取り込むためである。
 *
 *   > そもそもの訳を作成するときにあらゆる可能性を考えた区切り方にして、
 *   > 全て訳が英文に対して中央に寄るようになれば完璧です。
 *
 * 控えが粗いと、ゲストがそこで切っても訳を分けられず、
 * 2つぶんの訳がまとめて出て**右へずれて見える。**
 * 細かくしたときに一度だけ作り直せば、そのあとはずれない。
 * (粗いままでも**訳は出る。** 作り直しは見た目をそろえるためである)
 *
 * **2026-09 に「細かいとき」から「違うとき」へ広げた。**
 * 分詞修飾を名詞とまとめたことで、いまの決まりのほうが**粗くなる**
 * ところができた。細かいときしか見ていないと、
 * 「男の子は / 走っている」と割れた古い控えがそのまま残り、
 * **直したはずの訳が直らない。**
 * 作り直しは、その教材を使ったとき(セッションで使う・印刷)に1回だけ走る。
 *
 * 【④ 中身の空いたカタマリがある】(2026-09 実機・利用者の指摘)
 *
 *   > やはり先ほど直したはずの区切り方のルールがしっかり適応されていません。
 *
 *   窓口の指示を直しても、**すでに作った訳は直らない。** 訳は教材に
 *   控えてあるからである。ところが「主語のカタマリに全部書いてしまう」形の
 *   訳には、**必ず空のカタマリが残る**(書く分が無くなるため)。
 *
 *     Last weekend's derby / gave tactics nerds / plenty to chew on,
 *     「先週末のダービーは戦術好きたちに十分なものを与えた考えるべき材料を」「」「」
 *
 *   **英語があるのに訳が空、というのは、どんな場合でも正しくない。**
 *   だからこれを見つけたら作り直す。窓口を配置し直したあとなら、
 *   次にその教材を使ったときに**ひとりでに直る。**
 *   (直っていれば ④ は当てはまらなくなるので、二度は走らない)
 */
export function needsChunkJa(item) {
  const text = String(item?.prompt_en ?? '').trim()
  if (!text) return false
  if (!chunkPairsOf(item)) return true            // ① ②
  const parts = storedParts(item)
  if (!parts) return false                        // 古い控え。数は合っている
  // ④ 英語があるのに訳が空。**どんな場合でも正しくない**
  const ja = storedChunks(item) ?? []
  if (parts.some((p, i) => p.trim() && !String(ja[i] ?? '').trim())) return true
  // ③ 切れ目そのものを見比べる。**数だけでは足りない**
  const now = baseChunks(text)
  if (now.length !== parts.length) return true
  return now.some((p, i) => norm(p) !== norm(parts[i]))
}

/** 画面から呼ぶ入口。項目と細かさを渡すと、対か null が返る */
export const chunkPairsOf = (item, level = BASE_LEVEL) =>
  chunkPairs(item?.prompt_en, storedChunks(item), level, storedParts(item))

/** 自分の区切りに合わせた対。**控えの切れ目を使う**(無ければ計算する) */
export const chunkPairsOfAtMarks = (item, marks) =>
  chunkPairsAtMarks(item?.prompt_en, storedChunks(item), marks, storedParts(item))

/**
 * **自分が入れた区切り**に、訳を当てる(2026-08 利用者の指定)。
 *
 *   > ③自分の区切りが反映された英文とそれに対応する日本語訳が
 *   > 一緒に表示される
 *
 * 【訳を切れるのは、控えの境目だけ】
 *   控え(0021)は**初級の区切り**でそろえて作ってある。
 *   だから訳は、その境目でしか分けられない。
 *   自分の区切りが控えの境目と重なっていれば、そこで分ける。
 *   重なっていない区切り(たとえば普通の動詞の前)は、**英語には出すが、
 *   訳はそのカタマリぶんをまとめて置く。**
 *
 *   ここで AI に訳し直させることもできるが、**押すたびに課金される。**
 *   控えを組み替えれば無料で、しかも待ち時間が無い。
 *   訳が少し大きい単位で付くだけで、対がずれるわけではない
 *   (「ずれた対は無いより悪い」に反しない)。
 *
 * @param {string} text  英文(段落 / 発言まるごと)
 * @param {string[]|null} ja  控え(**初級の区切り**の数と同じ)
 * @param {number[]} marks 自分が入れた区切りの位置
 * @returns {{segs: string[], ja: string}[]|null} 数が合わなければ null
 */
export function chunkPairsAtMarks(text, ja, marks, parts = null) {
  const words = wordsOf(text)
  if (!words.length) return null
  const base = baseCuts(text, parts)
  // **数が合わなければ切らない。** ずれた対は、無いより害が大きい
  if (!Array.isArray(ja) || ja.length !== base.length + 1) return null

  const mine = new Set([...new Set(marks)].filter((i) => i > 0 && i < words.length))
  // 訳を分けられるのは、**自分の区切りと控えの境目が重なったところ**だけ
  const cuts = new Set(base.filter((i) => mine.has(i)))

  const out = []
  let jp = []
  let from = 0        // いまのカタマリの先頭
  ;[...base, words.length].forEach((at, i) => {
    jp.push(ja[i])
    if (at < words.length && !cuts.has(at)) return   // まだ同じカタマリの中
    // ここで1カタマリぶん。**自分の区切りは、英語の側に残す**
    const inner = [...mine].filter((k) => k > from && k < at).sort((a, b) => a - b)
    const segs = []
    let s = from
    for (const k of [...inner, at]) { segs.push(words.slice(s, k).join(' ')); s = k }
    out.push({ segs, ja: joinJa(jp) })
    jp = []
    from = at
  })
  return out
}
