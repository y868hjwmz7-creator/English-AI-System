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
 *   そこで**同じ語が、覚えるにつれて勝手に難しくなる**ようにした
 *   (0015 で入れた箱を、間隔だけでなく出題の形にも使う)。
 *
 * ============================================================================
 * 【「おまかせ」と「つづりを書く」は外した】(2026-09 実機・利用者の指定)
 *
 *   > 「おまかせ」という表示は分かりにくく、
 *   > 実際にはおまかせではなくずっと四択なのでなくしましょう。
 *   > そして、綴りを描くもいらないです。
 *
 *   **利用者の見立てのとおりだった。** おまかせは箱に合わせて形を変える
 *   仕組みだったが、この人の単語帳は「まだ」が 1,197 語 —— つまり
 *   **ほとんどが箱0**である。箱0は4択なので、
 *   **何度開いてもずっと4択**にしかならない。
 *   名前が「おまかせ」なのに中身が固定では、名前が嘘になる。
 *
 *   **箱に合わせて形を変える道は、いったん閉じた。**
 *   形は**自分で選ぶ**(既定は4択)。
 *   戻したくなったら「箱に合わせる」という名前で足し直す ——
 *   **「おまかせ」という名前では戻さない**(何が起きるか分からない)。
 *
 *   つづりを書く形も**道具ごと消した**(値を偽にするだけにしない・
 *   CLAUDE.md)。`want` は端末にしか残らないので、
 *   消しても過去の記録は1つも壊れない。
 *
 * ============================================================================
 * 【穴埋めを足した理由】(2026-09 利用者の指定)
 *
 *   > 単語のトレーニング、これだけでは全くトレーニングとして
 *   > 成り立っていません。…２つ目のトレーニングに穴埋めがあったり、
 *   > ３つ目が日→英になっていたり、そういう仕組みで単語が
 *   > 覚えられるような仕組みにしたいです。
 *
 *   段が「見て分かる(4択)→ 意味を言う(思い出す)→ 言える(日→英)」と
 *   飛んでいた。そのあいだに**文の中で使う**段が要る。
 *
 *   材料は **`word_reviews.seen_in`(0018)をそのまま伏せるだけ**なので、
 *   **AI を1回も呼ばない = 費用は1円もかからない**
 *   (どこを伏せるかは `clozeSentence.js` 1か所)。
 *
 *   **出会った文が無い語では作れない。** そのときは「思い出す」に落ちる
 *   (**行き止まりを作らない**)。
 *
 * ============================================================================
 * 【4択の「まちがいの選択肢」は、自分の単語帳から作る】
 *
 *   AI を呼ばない。**費用がかからない。**
 *   しかも自分が混同しやすい語どうしが並ぶので、教育的にも正しい。
 *   語が足りないときは4択にしない(**空欄の選択肢を出さない**)。
 */

import { hasCloze } from './clozeSentence.js'

/** 出題の形。id は画面と保存の両方で使う */
export const QUIZ_FORMS = [
  { id: 'choice', label: '4択', hint: '意味を選ぶ' },
  { id: 'recall', label: '思い出す', hint: '意味を言ってから確かめる' },
  { id: 'cloze', label: '穴埋め', hint: '文の空いたところに入る語を思い出す' },
  { id: 'ja2en', label: '日本語 → 英語', hint: '英語を言ってから確かめる' },
]

/** 何も選んでいないときの形。**「おまかせ」は作らない**(上記) */
export const DEFAULT_FORM = 'choice'

/** 知らない id(消した `auto` / `spell` が端末に残っている)は既定に落とす */
export const formOf = (id) => (QUIZ_FORMS.some((f) => f.id === id) ? id : DEFAULT_FORM)

export const formLabel = (id) => QUIZ_FORMS.find((f) => f.id === id)?.label ?? id

/**
 * 自分で答え合わせをする形か(4択だけは機械が判定する)。
 *
 * **穴埋めもこちら。** 箱3 の段でつづりまで求めるのは早すぎる
 * (書けるようにするのは箱6 の役目である)。
 * ここが**カードを画面いっぱいに伸ばすかどうか**も決めているので
 * (`wordcard--recall`・CLAUDE.md)、文を出す穴埋めにはちょうどよい。
 */
export const isSelfGraded = (form) =>
  form === 'recall' || form === 'ja2en' || form === 'cloze'

/**
 * ============================================================================
 * 【並べ方】(2026-09 実機・利用者の指定)
 *
 *   > 出し方の中に、「ランダムで」と「教材ごと」選んだを選べるように
 *
 * Quick Response の復習には**もともとある**(「混ぜる / 教材の順」)。
 * 単語帳だけが**いつも混ぜる**の一択だった。
 * 「先週の記事に出てきた語だけを、その並びでさらう」ができない。
 *
 * **一覧はここ1か所。** 画面(`ReviewScope`)は受け取って札にするだけで、
 * 自分では1つも持たない。
 */
export const WORD_ORDERS = [
  { id: 'random', label: 'ランダム' },
  { id: 'material', label: '教材ごと' },
]

export const DEFAULT_ORDER = 'random'
export const orderOf = (id) => (WORD_ORDERS.some((o) => o.id === id) ? id : DEFAULT_ORDER)

/**
 * 教材ごとにまとめる。**新しい教材から。**
 *
 * - 教材名は `2026-09-08 / …` で始まる(`copyTitleFor`)ので、
 *   名前の逆順がそのまま**新しい順**になる
 * - **教材の無い語(手で入れた語・基礎単語)は、いちばん後ろ。**
 *   落とさない —— 並べ替えは減らす道具ではない
 * - **中の並びは変えない。** サーバーが返した順のまま
 */
export function orderWords(rows, order = DEFAULT_ORDER) {
  const list = [...(rows ?? [])]
  if (orderOf(order) !== 'material') return list
  const groups = new Map()
  for (const r of list) {
    const k = String(r?.material_title ?? '').trim()
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k).push(r)
  }
  const named = [...groups.entries()]
    .filter(([k]) => k)
    .sort((a, b) => b[0].localeCompare(a[0], 'ja'))
  return [...named.flatMap(([, v]) => v), ...(groups.get('') ?? [])]
}

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
export function buildSession(
  rows, size = SESSION_SIZE, { shuffleAll = false, order = DEFAULT_ORDER } = {},
) {
  const list = rows ?? []
  /* **「教材ごと」を選んだら、混ぜない。**
     混ぜてしまうと、並べ方を選んだ意味がそもそも無い(2026-09) */
  if (orderOf(order) === 'material') return orderWords(list, 'material').slice(0, size)
  /* **おさらいでは、まるごと混ぜる**(2026-09 利用者の指定)。
     > 反復してランダムに出題するよう変更してください

     ふだんは「まだ」を先に出す(いちばん苦手な語が枠から外れないように)。
     ところが**おさらいは何度も回すもの**なので、その並びだと
     **毎回おなじ「まだ」の語ばかり**が出て、ほかが一度も出てこない。
     おさらいのときだけ、順ではなく**まるごとランダム**にする。 */
  if (shuffleAll) return shuffle(list).slice(0, size)
  const yet = shuffle(list.filter((r) => r.status === 'unknown'))
  const half = shuffle(list.filter((r) => r.status === 'learning'))
  // 状態の付いていない古い行は、いちばん後ろに置く(0027 より前のもの)
  const rest = shuffle(list.filter((r) => r.status !== 'unknown' && r.status !== 'learning'))
  return [...yet, ...half, ...rest].slice(0, size)
}

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
 *
 * **作れない形になったら「思い出す」に落とす**(行き止まりを作らない)。
 * 知らない id は既定(4択)に落とす —— 端末に残った `auto` / `spell` が
 * そのまま渡ってくることがある(2026-09 に消した形)。
 */
export function pickForm(row, pool, want = DEFAULT_FORM) {
  const form = formOf(want)
  // 4択は語が足りないと作れない。**空の選択肢を出すくらいなら形を変える**
  if (form === 'choice' && !makeChoices(row, pool)) return 'recall'
  /* 穴埋めは**出会った文**が要る(0018)。手で入れた語には無いし、
     文のほうを直した教材では語が消えていることもある。
     **判断は `hasCloze()` 1か所**。画面で数え直さない */
  if (form === 'cloze' && !hasCloze(row)) return 'recall'
  if (form === 'ja2en' && !String(row?.meaning_ja ?? '').trim()) return 'recall'
  return form
}
