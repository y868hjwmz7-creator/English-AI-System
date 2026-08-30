/**
 * スラッシュリーディング(②)の区切り。
 *
 * 【なぜ AI に作らせないのか】
 *   利用者が挙げた決まりは、**どれも「閉じた語のリスト」で判定できる**。
 *
 *     ・前置詞＋名詞で区切る(区切りの最後に前置詞があるのは NG)
 *     ・助動詞と動詞(be going to / want to / have to など)は一区切り
 *
 *   前置詞も助動詞も**数が決まっている**ので、辞書に並べれば機械で判定できる。
 *   AI に頼めば1文ごとに課金され、しかも同じ文で毎回同じ答えが返る保証もない。
 *   **決まりで書けるものを、AI に頼まない。**
 *
 * 【「動詞の前で切る」は、当てられるぶんだけ】
 *   「初心者は動詞の前に必ずスラッシュ」は、**どれが動詞かを
 *   当てられないと書けない。** `run` は名詞にも動詞にもなる。
 *   ただし**助動詞と be動詞だけは数が決まっていて、しかも必ず動詞である。**
 *   そこだけを入れてある(強さ1なので**初級でしか出ない**)。
 *   一般の動詞は当て推量になるので、いまも扱わない。
 *   **あやふやなことを言わない。**
 *
 * 【機械で書けないもの】
 *   区切りごとの**訳**は決まりでは書けない。教材を作るときに1回だけ
 *   作って控える(`src/lib/chunkJa.js`・0021・仕様書 第5.29.3節)。
 *
 * 【レベルが上がるほど区切りは減る】(利用者の指定)
 *   区切りには「強さ」を持たせてある。
 *   初級はぜんぶ、中級は強さ2以上、上級は強さ3だけを出す。
 */
import { splitEnSentences } from './sentencePair.js'

/** 前置詞。**この語の前で切る。** 区切りの最後がこれになってはいけない */
const PREPOSITIONS = new Set([
  'about', 'above', 'across', 'after', 'against', 'along', 'among', 'around',
  'as', 'at', 'before', 'behind', 'below', 'beneath', 'beside', 'besides',
  'between', 'beyond', 'by', 'despite', 'down', 'during', 'except', 'for',
  'from', 'in', 'inside', 'into', 'like', 'near', 'of', 'off', 'on', 'onto',
  'outside', 'over', 'past', 'since', 'through', 'throughout', 'till', 'to',
  'toward', 'towards', 'under', 'underneath', 'until', 'up', 'upon', 'via',
  'with', 'within', 'without',
])

/** 接続詞・関係詞。**この語の前で切る。** ここが意味の切れ目になる */
const CONNECTORS = new Set([
  'although', 'because', 'before', 'but', 'however', 'if', 'once', 'since',
  'so', 'that', 'though', 'unless', 'until', 'when', 'whenever', 'where',
  'whereas', 'wherever', 'whether', 'which', 'while', 'who', 'whom', 'whose', 'why',
])

/**
 * 助動詞のまとまり。**この中では切らない。**
 * 「be going to」「have to」を途中で切ると、動詞と離れて訳せなくなる。
 * 長いものから順に見る(`have to` より `have got to` を先に当てる)。
 */
const AUX_GROUPS = [
  ['have', 'got', 'to'], ['be', 'going', 'to'], ['am', 'going', 'to'],
  ['is', 'going', 'to'], ['are', 'going', 'to'], ['was', 'going', 'to'],
  ['were', 'going', 'to'], ['used', 'to'], ['ought', 'to'],
  ['have', 'to'], ['has', 'to'], ['had', 'to'],
  ['want', 'to'], ['wants', 'to'], ['wanted', 'to'],
  ['need', 'to'], ['needs', 'to'], ['needed', 'to'],
  ['would', 'like', 'to'], ['be', 'able', 'to'], ['is', 'able', 'to'],
  ['are', 'able', 'to'], ['was', 'able', 'to'],
]

/** 1語の助動詞。**次の語(動詞)と離さない** */
const MODALS = new Set([
  'can', 'could', 'may', 'might', 'must', 'shall', 'should', 'will', 'would',
  'do', 'does', 'did', 'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had',
])

/** 冠詞・限定詞。**この語のあとで切らない。** 名詞と離れる */
const DETERMINERS = new Set([
  'a', 'an', 'the', 'this', 'that', 'these', 'those', 'my', 'your', 'his',
  'her', 'its', 'our', 'their', 'some', 'any', 'no', 'every', 'each', 'both',
])

/**
 * **カタマリの先頭にしか立てない語**(2026-08 利用者の指定で足した)。
 *
 * 接続詞・関係詞のうち、**副詞としては使えないもの**だけを入れてある。
 * `and / the report` のように、この語でカタマリを終えると、
 * 次のまとまりを引き連れる語だけが前に取り残される。
 *
 * `once` `before` `since` `until` `when` `where` `so` は**副詞にもなる**
 * (「以前」「そのとき」など)ので、**入れない。**
 * あやふやなことを言わない、というこの仕組みの原則どおりである。
 */
const HEAD_WORDS = new Set([
  'and', 'or', 'but', 'nor',
  'that', 'which', 'who', 'whom', 'whose',
  'because', 'although', 'though', 'unless', 'whether', 'if', 'while', 'whereas',
])

/** 文の終わり(`.` `?` `!`)。**ここでの区切りは、いつでも正しい** */
const endsSentence = (w) => /[.!?…]["'”’)\]]*$/.test(String(w ?? ''))

/** 読点(`,` `;` `:`)。ここも意味の切れ目なので、**いつでも正しい** */
const endsClause = (w) => /[,;:]["'”’)\]]*$/.test(String(w ?? ''))

/** 所有格(`the company's` の `'s`)。**次の名詞と離さない** */
const isPossessive = (w) => /['’]s$/i.test(String(w ?? '').replace(/[^A-Za-z'’]+$/, ''))

/**
 * レベルごとの出し方。
 *
 * **上級ほど区切りが減る**(利用者の指定)。減らし方は2つ組み合わせる。
 *   `min`   … 区切りの強さ。弱いものから消える
 *   `least` … **カタマリの最小の語数。** これより短くなる区切りは消す
 *
 * 語の種類だけで決めると、初級と中級がほとんど同じになる(実測)。
 * 「大きく区切る」は要するに**カタマリが長くなる**ことなので、
 * 語数でも絞るほうが、レベルの差がそのまま見た目に出る。
 */
export const LEVEL_RULE = {
  beginner: { min: 1, least: 1 },
  middle: { min: 2, least: 3 },
  advanced: { min: 3, least: 5 },
}

/** レベルの選択肢。**上級ほど区切りが減る**(利用者の指定) */
export const SLASH_LEVELS = [
  { id: 'beginner', label: '初級', hint: 'こまかく区切る。前から訳す型を覚える段階' },
  { id: 'middle', label: '中級', hint: '意味のまとまりで区切る' },
  { id: 'advanced', label: '上級', hint: '大きく区切る。長い区切りのまま前から読む' },
]

/** 英単語だけを取り出す(記号は語に付けたまま持つ) */
export function wordsOf(sentence) {
  return String(sentence ?? '').trim().split(/\s+/).filter(Boolean)
}

/** 記号を落とした小文字。`don't` の `'` は残す */
const bare = (w) => String(w ?? '').toLowerCase().replace(/^[^a-z']+|[^a-z']+$/g, '')

/**
 * その位置(i 語目の**前**)が、助動詞のまとまりの内側かどうか。
 * 内側なら切ってはいけない。
 */
function insideAux(words, i) {
  for (const group of AUX_GROUPS) {
    for (let start = Math.max(0, i - group.length + 1); start < i; start += 1) {
      if (start + group.length <= i) continue
      const hit = group.every((g, k) => bare(words[start + k]) === g)
      if (hit) return group.join(' ')
    }
  }
  // 助動詞1語 + 動詞。あいだで切らない
  if (i > 0 && MODALS.has(bare(words[i - 1]))) return bare(words[i - 1])
  return null
}

/**
 * 模範の区切り。**語と語のあいだの番号**の集合を返す
 * (1 なら「1語目と2語目のあいだ」)。
 *
 * @returns {{at: number, strength: number, why: string}[]}
 */
export function idealSlashes(sentence) {
  const words = wordsOf(sentence)
  const out = []
  const add = (at, strength, why) => {
    if (at <= 0 || at >= words.length) return
    // **判定は `slashProblem` 1か所。** ここに書き写すと必ず食い違い、
    // 模範が自分の決まりを破る(`npm run test:chunk` が落ちる)
    if (slashProblem(words, at)) return
    const found = out.find((x) => x.at === at)
    if (found) { if (strength > found.strength) { found.strength = strength; found.why = why } return }
    out.push({ at, strength, why })
  }

  // **文の切れ目。** ここが切れないと、段落の中で文がつながって出る
  // (「the ride? Can you」が1つのカタマリになっていた・2026-08 実測)。
  // 切り方は読み上げ・Quick Response と同じものを使う。**2か所に持たない**
  let n = 0
  for (const sent of splitEnSentences(sentence)) {
    n += wordsOf(sent).length
    add(n, 3, '文の切れ目')
  }

  words.forEach((w, i) => {
    const b = bare(w)
    // 読点のあと。**いちばん強い切れ目**
    if (/[,;:]$/.test(w)) add(i + 1, 3, '読点のあと')
    // 接続詞・関係詞の前。ここから意味が変わる
    if (CONNECTORS.has(b)) add(i, 3, `${b} の前(ここから意味が変わる)`)
    // 前置詞の前。**前置詞＋名詞でひとかたまり**
    else if (PREPOSITIONS.has(b)) add(i, b === 'of' ? 1 : 2, `${b} の前(前置詞＋名詞でひとかたまり)`)
    // 助動詞・be動詞の前。**主語と動詞を切って、動詞から先に訳す**
    //
    // 利用者の指定「初心者は動詞の前に必ずスラッシュ」のうち、
    // **機械で当てられるぶんだけ**を入れてある。一般の動詞は語のリストでは
    // 当てられない(`run` は名詞にも動詞にもなる)が、
    // **助動詞と be動詞は数が決まっていて、しかも必ず動詞である。**
    // 強さ1なので**初級でしか出ない。** 初心者向けの決まりだからである
    else if (MODALS.has(b)) add(i, 1, `${b} の前(主語と動詞を切り、動詞から先に訳す)`)
  })

  return out.sort((a, b) => a.at - b.at)
}

/** そのレベルで出す区切りだけに絞る */
export function slashesFor(sentence, level = 'beginner') {
  const rule = LEVEL_RULE[level] ?? LEVEL_RULE.beginner
  const total = wordsOf(sentence).length
  const strong = idealSlashes(sentence).filter((s) => s.strength >= rule.min)

  // 短いカタマリを作る区切りを、前から順に落としていく。
  // **強い区切り(読点・接続詞)は落とさない。** そこは意味の切れ目である
  const kept = []
  let from = 0
  for (const s of strong) {
    const short = s.at - from < rule.least
    if (short && s.strength < 3) continue
    kept.push(s)
    from = s.at
  }
  // 最後のカタマリが短くなりすぎたら、直前の区切りをやめる
  const last = kept[kept.length - 1]
  if (last && total - last.at < rule.least && last.strength < 3) kept.pop()
  return kept
}

/**
 * その位置(i 語目の**前**)に区切りを入れてよいか。
 * **駄目なときだけ**、理由を返す。よければ `null`。
 *
 * 【なぜ1か所にまとめるのか】
 *   同じ判定を「模範を作るとき」と「ゲストの区切りを見るとき」の2か所に
 *   書くと、必ず食い違う。**模範が自分の決まりに違反する**という形で出る。
 *   `npm run test:chunk` はそれを見張っているが、そもそも1つにしておく。
 *
 * 【貫いている考え方】(2026-08 利用者の指定)
 *   > 前置詞を区切りの最後に置く / 冠詞と名詞の間に区切りを置く /
 *   > 前置詞と冠詞の間に区切りを置く
 *
 *   どれも **「うしろの語にかかる語で、カタマリを終えない」** という
 *   1つのことの言い換えである。前置詞・冠詞・助動詞・接続詞・所有格は、
 *   単独では意味をなさず、次の語と組になって初めて訳せる。
 *
 * 【文の切れ目は、いつでも正しい】(利用者の指定)
 *   > 「以前」という意味の副詞として before が使用され、文の最後に置かれ、
 *   > ピリオドが続き、そのピリオドとその後の文の始まりの間に区切りを
 *   > 置くことは何ら問題はありません。他にも前置詞にも副詞にもなり得る
 *   > 単語で同じケースがあればそれらについても OK
 *
 *   `before` `after` `since` `over` `in` … は前置詞にも副詞にもなる。
 *   **どちらで使われているかは語のリストでは当てられない。**
 *   しかし**文が終わっていれば、それは前置詞ではありえない**(前置詞なら
 *   うしろに名詞が要る)。だから **`.` `?` `!` と読点のあとは、
 *   何が来ていても正しい**として、いっさい咎めない。
 *   これは当て推量ではなく、記号から確実に分かることである。
 */
export function slashProblem(words, i) {
  if (i <= 0 || i >= words.length) return null
  const raw = words[i - 1]
  // **文の切れ目・読点のあとは、いつでも正しい。**(上記・利用者の指定)
  if (endsSentence(raw) || endsClause(raw)) return null

  const prev = bare(raw)
  const next = bare(words[i] ?? '')

  // ① 助動詞のまとまりの途中(be going to / have to / 助動詞 + 動詞)
  const aux = insideAux(words, i)
  if (aux) {
    return {
      at: i,
      short: `${aux} は切らない`,
      text: `「${aux}」の途中で区切れています。助動詞と動詞はひとかたまりで訳します。`,
    }
  }
  // ② 区切りの最後が前置詞になっている(利用者の明示した NG)
  if (PREPOSITIONS.has(prev)) {
    // **前置詞と冠詞のあいだ**は、同じことだが言い方を変えたほうが分かりやすい
    const detail = DETERMINERS.has(next)
      ? `前置詞「${raw}」と冠詞「${words[i]}」のあいだで区切れています。`
        + `「${raw} ${words[i]} …」でひとかたまりです。`
      : `「${raw}」で区切りが終わっています。`
        + `前置詞＋名詞でひとかたまりなので、${raw} の前で区切ります。`
    return { at: i, short: `${raw} の前で区切る`, text: detail }
  }
  // ③ 冠詞・限定詞のあとで切っている
  if (DETERMINERS.has(prev)) {
    return {
      at: i,
      short: `${raw} は名詞と離さない`,
      text: `冠詞「${raw}」のあとで区切れています。冠詞と名詞のあいだは切りません。`,
    }
  }
  // ④ 所有格('s)のあとで切っている。冠詞と同じで、次の名詞にかかる
  if (isPossessive(raw)) {
    return {
      at: i,
      short: `${raw} は名詞と離さない`,
      text: `「${raw}」は次の名詞にかかります。あいだでは区切りません。`,
    }
  }
  // ⑤ 接続詞・関係詞でカタマリを終えている。**次のまとまりの先頭に置く**
  if (HEAD_WORDS.has(prev)) {
    return {
      at: i,
      short: `${raw} の前で区切る`,
      text: `「${raw}」でカタマリが終わっています。`
        + `接続詞や関係詞は、次のまとまりの先頭に置きます。`,
    }
  }
  return null
}

/**
 * ゲストが入れた区切りを見て、直したほうがよいところを言う。
 *
 * **決まりで確かめられることだけを言う。** あやふやなことは言わない。
 * 「たぶん違う」と言われるほうが、何も言われないより困る。
 *
 * **`short` は吹き出しに出す一言。** その場に出すものなので短く。
 * `text` は詳しい言い方で、触れたときに出す(`title`)。
 */
export function checkSlashes(sentence, marks) {
  const words = wordsOf(sentence)
  return [...new Set(marks)].sort((a, b) => a - b)
    .map((i) => slashProblem(words, i))
    .filter(Boolean)
    .map((n) => ({ ...n, kind: 'ng' }))
}

/** 区切りを入れた文を、カタマリの配列にする */
export function chunksOf(sentence, marks) {
  const words = wordsOf(sentence)
  const at = [...new Set(marks)].filter((i) => i > 0 && i < words.length).sort((a, b) => a - b)
  const out = []
  let from = 0
  for (const i of [...at, words.length]) {
    if (i > from) out.push(words.slice(from, i).join(' '))
    from = i
  }
  return out
}

/**
 * ゲストが入れた区切りを、**1本ずつその場で判定する**(2026-08 利用者の指定)。
 *
 * 【模範と比べるのは、やめた】(2026-08 利用者の判断)
 *
 *   > そもそもが区切り方を比べる自体が難しいです。視覚からパッと入って
 *   > 来ません。比べる気も起こりません。そして、区切り方は、ルールとして
 *   > 決めたこと以外、正解はないからです。
 *
 *   以前は「模範にもある(緑)/ 決まりに反する(赤)/ 模範には無い(灰)」の
 *   3通りに分け、「あと N か所」まで出していた。**これは採点である。**
 *   けれども区切り方に正解は無く、模範は決まりから作った1つの案にすぎない。
 *   案と違うだけのものを灰色で並べ、足りない数まで数えると、
 *   **決まりに反している1本**が、その中に埋もれてしまう。
 *
 *   **言うのは「決まりに反している」ことだけにする。** それ以外は何も言わない。
 *
 * @returns {{at: {[n]: {state: 'ng'|'plain', why: string, short: string}}, ng: number}}
 */
export function judgeSlashes(sentence, marks) {
  const words = wordsOf(sentence)
  const at = {}
  let ng = 0
  for (const i of [...new Set(marks)].sort((a, b) => a - b)) {
    const bad = slashProblem(words, i)
    if (bad) { at[i] = { state: 'ng', why: bad.text, short: bad.short }; ng += 1 }
    else at[i] = { state: 'plain', why: '', short: '' }
  }
  return { at, ng }
}
