/**
 * 単語帳の出題。**どの形で出すかを、箱の段階で変える。**
 *
 * ============================================================================
 * 【なぜ形を変えるのか】(2026-08 の調査と提案)
 *
 *   売れている単語アプリ(mikan など)の中核は**4択の高速タップ**である。
 *   1語2秒で回せるので、触れる回数が桁違いに増える。
 *
 *   ただし4択は「見て分かる」(再認)であって、
 *   「口から出る」(再生)より**弱い。** 4択だけでは話せるようにならない。
 *
 *   そこで**同じ語が、覚えるにつれて勝手に難しくなる**ようにした。
 *   0015 で入れた箱(0〜6)を、**間隔だけでなく出題の形にも使う。**
 *
 *   | 箱 | 形 | 何の力がつくか |
 *   |---|---|---|
 *   | 0〜1 | 4択 | まず触れる回数を稼ぐ |
 *   | 2〜3 | 思い出す(自己申告) | 意味を引き出す |
 *   | 4〜5 | 日本語 → 英語 | 話すときに出てくる |
 *   | 6    | つづりを書く | メールで書ける |
 *
 *   **表も列も増やさない。** 箱はもう入っている。
 *
 * ============================================================================
 * 【4択の「まちがいの選択肢」は、自分の単語帳から作る】
 *
 *   AI を呼ばない。**費用がかからない。**
 *   しかも自分が混同しやすい語どうしが並ぶので、教育的にも正しい。
 *   語が足りないときは4択にしない(**空欄の選択肢を出さない**)。
 */

/** 出題の形。id は画面と保存の両方で使う */
export const QUIZ_FORMS = [
  { id: 'choice', label: '4択', hint: '意味を選ぶ' },
  { id: 'recall', label: '思い出す', hint: '意味を言ってから確かめる' },
  { id: 'ja2en', label: '日本語 → 英語', hint: '英語を言ってから確かめる' },
  { id: 'spell', label: 'つづりを書く', hint: '打ち込んで答える' },
]

export const formLabel = (id) => QUIZ_FORMS.find((f) => f.id === id)?.label ?? id

/** 自動でえらぶときの形。**箱が上がるほど難しくなる** */
export function formForBox(box) {
  const b = Number(box ?? 0)
  if (b <= 1) return 'choice'
  if (b <= 3) return 'recall'
  if (b <= 5) return 'ja2en'
  return 'spell'
}

/** 自分で答え合わせをする形か(4択とつづりは機械が判定する) */
export const isSelfGraded = (form) => form === 'recall' || form === 'ja2en'

/** 混ぜる。**毎回順番を変える。** 並び順で覚えると思い出す練習にならない */
export function shuffle(list) {
  const out = [...(list ?? [])]
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/**
 * 1回ぶんの語数。**終わりの見えない作業は続かない。**
 * 残り全部ではなく、10語で区切って結果を出す。終わったらまた次の10語。
 */
export const SESSION_SIZE = 10

/**
 * 1回ぶんの出題をつくる。
 *
 * **「まだ」を先に、「覚えかけ」を次に**(2026-08 利用者の指定・0027)。
 *
 *   > まだを優先して、覚え掛けを次に優先という出題アルゴリズムが組めますよね
 *
 * 分かっていない語を先に出す。混ぜてしまうと、いちばん苦手な語が
 * 10語の枠から外れて、いつまでも出てこないことがある。
 *
 * **それぞれの中では混ぜる。** 並び順で覚えてしまわないようにするため
 * (単語帳の決まり・CLAUDE.md)。
 */
export function buildSession(rows, size = SESSION_SIZE) {
  const list = rows ?? []
  const yet = shuffle(list.filter((r) => r.status === 'unknown'))
  const half = shuffle(list.filter((r) => r.status === 'learning'))
  // 状態の付いていない古い行は、いちばん後ろに置く(0027 より前のもの)
  const rest = shuffle(list.filter((r) => r.status !== 'unknown' && r.status !== 'learning'))
  return [...yet, ...half, ...rest].slice(0, size)
}

/** 答え合わせに使う形にそろえる。大文字小文字と前後の空白は見ない */
const normAnswer = (text) => String(text ?? '')
  .toLowerCase().replace(/\s+/g, ' ').replace(/[.,!?;:"']/g, '')
  .trim()

/** つづりの答え合わせ */
export const spellMatches = (typed, word) => !!normAnswer(typed)
  && normAnswer(typed) === normAnswer(word)

/**
 * 4択をつくる。正解1つ + まちがい3つ。
 *
 * @param {object} row  出す語
 * @param {Array}  pool その人の単語帳(まちがいの元)
 * @returns {Array<{text: string, correct: boolean}>|null}
 *          作れないときは null(語が足りない)。**空の選択肢は出さない**
 */
export function makeChoices(row, pool, count = 4) {
  const right = String(row?.meaning_ja ?? '').trim()
  if (!right) return null

  const others = shuffle(
    (pool ?? []).filter((r) => r.word_norm !== row.word_norm
      && String(r.meaning_ja ?? '').trim()
      && String(r.meaning_ja).trim() !== right),
  )
  // 同じ意味が2つ並ばないようにする
  const seen = new Set([right])
  const wrong = []
  for (const r of others) {
    const m = String(r.meaning_ja).trim()
    if (seen.has(m)) continue
    seen.add(m)
    wrong.push(m)
    if (wrong.length >= count - 1) break
  }
  if (wrong.length < count - 1) return null   // 語が足りない。4択にしない

  return shuffle([
    { text: right, correct: true },
    ...wrong.map((m) => ({ text: m, correct: false })),
  ])
}

/**
 * その語をどの形で出すか決める。
 * `want` が 'auto' なら箱に合わせる。作れない形になったら思い出す形に落とす。
 */
export function pickForm(row, pool, want = 'auto') {
  const form = want === 'auto' ? formForBox(row?.box) : want
  // 4択は語が足りないと作れない。**空の選択肢を出すくらいなら形を変える**
  if (form === 'choice' && !makeChoices(row, pool)) return 'recall'
  if (form === 'ja2en' && !String(row?.meaning_ja ?? '').trim()) return 'recall'
  return form
}
