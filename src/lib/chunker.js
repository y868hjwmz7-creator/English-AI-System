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
 * 【機械で書けないもの】
 *   「初心者は動詞の前に必ずスラッシュ」だけは、**どれが動詞かを
 *   当てられないと書けない。** `run` は名詞にも動詞にもなる。
 *   語のリストでは無理なので、ここでは扱わない。
 *   区切りごとの**訳例**も同じ理由で、ここでは作れない(仕様書 第5.29節)。
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
    if (insideAux(words, at)) return              // 助動詞と動詞は離さない
    if (DETERMINERS.has(bare(words[at - 1]))) return  // 冠詞のあとで切らない
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
 * ゲストが入れた区切りを見て、直したほうがよいところを言う。
 *
 * **決まりで確かめられることだけを言う。** あやふやなことは言わない。
 * 「たぶん違う」と言われるほうが、何も言われないより困る。
 */
export function checkSlashes(sentence, marks) {
  const words = wordsOf(sentence)
  const at = [...new Set(marks)].sort((a, b) => a - b)
  const notes = []

  //
  // **`short` は吹き出しに出す一言。** その場に出すものなので短く。
  // `text` は詳しい言い方で、触れたときに出す(`title`)。
  for (const i of at) {
    if (i <= 0 || i >= words.length) continue
    // ① 区切りの最後が前置詞になっている(利用者の明示した NG)
    const prev = bare(words[i - 1])
    if (PREPOSITIONS.has(prev)) {
      notes.push({
        at: i, kind: 'ng',
        short: `${words[i - 1]} の前で区切る`,
        text: `「${words[i - 1]}」で区切りが終わっています。`
          + `前置詞＋名詞でひとかたまりなので、${words[i - 1]} の前で区切ります。`,
      })
    }
    // ② 助動詞と動詞のあいだで切っている
    const aux = insideAux(words, i)
    if (aux) {
      notes.push({
        at: i, kind: 'ng',
        short: `${aux} は切らない`,
        text: `「${aux}」の途中で区切れています。助動詞と動詞はひとかたまりで訳します。`,
      })
    }
    // ③ 冠詞・限定詞のあとで切っている
    if (DETERMINERS.has(prev)) {
      notes.push({
        at: i, kind: 'ng',
        short: `${words[i - 1]} は名詞と離さない`,
        text: `「${words[i - 1]}」のあとで区切れています。名詞と離さないでください。`,
      })
    }
  }
  return notes
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
 * > ゲストが引いたスラッシュの位置でも間違っているか、いないか、
 * > そういったことが即座に分かるように判定したうえで
 * > フィードバックを加えれるような仕組みに
 *
 * 【3通りにしか分けない】
 *   模範と違う = まちがい、**ではない。** 切り方には幅があり、
 *   模範は決まりから作った1つの案にすぎない。
 *   **決まりに反しているものだけを「ちがう」と言う。**
 *   あやふやなことを言わない、というこの仕組みの原則どおりである。
 *
 *   | 印 | いつ |
 *   |---|---|
 *   | `ok`    | 模範にもある。**確かに合っている** |
 *   | `ng`    | **決まりに反している**(前置詞のあと・助動詞の途中・冠詞のあと) |
 *   | `plain` | 模範には無いが、決まりにも反していない。**何も言わない** |
 *
 * @returns {{at: {[n]: {state, why}}, ok: number, ng: number, plain: number,
 *            missing: number, model: number[]}}
 */
export function judgeSlashes(sentence, marks, level = 'beginner') {
  const model = slashesFor(sentence, level)
  const modelAt = new Set(model.map((x) => x.at))
  const why = new Map(model.map((x) => [x.at, x.why]))
  const broken = new Map(checkSlashes(sentence, marks).map((n) => [n.at, n]))

  const at = {}
  let ok = 0
  let ng = 0
  let plain = 0
  for (const i of [...new Set(marks)].sort((a, b) => a - b)) {
    if (broken.has(i)) {
      const n = broken.get(i)
      at[i] = { state: 'ng', why: n.text, short: n.short }
      ng += 1
    }
    else if (modelAt.has(i)) { at[i] = { state: 'ok', why: why.get(i) }; ok += 1 }
    else { at[i] = { state: 'plain', why: '' }; plain += 1 }
  }
  // まだ入れていない模範の区切りの数。**場所は言わない。**
  // 数だけ分かれば「もう少しある」と気づける(答えは渡さない)
  const missing = model.filter((x) => !marks.includes(x.at)).length
  return { at, ok, ng, plain, missing, model: model.map((x) => x.at) }
}
