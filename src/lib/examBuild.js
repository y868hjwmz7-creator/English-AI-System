/**
 * ============================================================================
 * **ゲストのデータからテストを作る**(第5.260節)
 *
 * 2026-09-25 利用者の指定。
 *
 *   > ゲストのページに教材や彼らの単語帳、quick response 帳があります。
 *   > それらのデータを基にテストを作りたいです。
 *
 * 利用者の答え(その場で訊いた)。
 *
 *   ・出どころは **都度えらぶ。複数同時にえらべる**
 *   ・形は **日本語 → 英語 と 穴埋めを混ぜる**
 *   ・**画面と紙の両方**
 *   ・**AI は使わない(0円)**
 *
 * ── **AI を1回も呼ばない = 0円** ───────────────────────────
 *
 *   問題は**作らない。すでにあるものを組み替えるだけ**である。
 *   教材・単語帳・Quick Response 帳には、もう
 *   **英文と訳の対**が入っている。テストに要るのはそれだけである。
 *
 *   ・**日本語 → 英語** … 訳を出して、英文を書かせる
 *   ・**穴埋め**       … 英文の1語を伏せて、そこを書かせる
 *
 *   どちらも**手元の文字を並べ替えるだけ**で、問い合わせも課金も無い。
 *
 * ── **穴埋めの位置は、単語帳とまったく同じ道で探す** ──────────
 *
 *   `clozeSentence.js` の `clozeAt()` が、単語帳の穴埋めで
 *   **もう同じことをしている。** 自分で `indexOf` を書くと、
 *   `in` が `internal` の中に当たって `___ternal` になる
 *   (2026-09 に単語帳で実際に踏んだ)。**数え方を2通り持たない。**
 *
 * ── ここは算段だけ。Supabase を持たない ────────────────────
 *
 *   **素の node で走らせられる形にしてある**(`playMark.js` と同じ作法)。
 *   引いてくるのは `examSources.js`(あちらが Supabase を持つ)。
 * ============================================================================
 */

import { clozeAt } from './clozeSentence.js'

/**
 * **出どころ。並べ替えない。減らさない**(共通ルール)。
 * 利用者が名指しした3つである。
 */
export const EXAM_SOURCES = [
  { id: 'material', label: '教材', hint: 'この人に出してある教材の英文' },
  { id: 'word', label: '単語帳', hint: 'この人の単語帳の語' },
  { id: 'qr', label: 'Quick Response 帳', hint: 'この人が溜めた表現' },
]

export const examSourceLabel = (id) =>
  EXAM_SOURCES.find((s) => s.id === id)?.label ?? ''

/** 何問にするか。**紙1枚に収まる 10 から** */
export const EXAM_COUNTS = [10, 20, 30, 40]
export const DEFAULT_EXAM_COUNT = 20

/**
 * 出し方。**「混ぜる」が既定**(2026-09-25 利用者の指定「日→英と穴埋めを混ぜる」)。
 *
 * **片方だけを選ぶ道も残す** —— 単語帳だけでテストを作るときは、
 * 穴埋めにしようがない語が多いためである。
 */
export const EXAM_FORMS = [
  { id: 'mix', label: '混ぜる', hint: '日本語 → 英語 と 穴埋めを半々に' },
  { id: 'ja_en', label: '日本語 → 英語', hint: '訳を見て、英文を書く' },
  { id: 'blank', label: '穴埋め', hint: '英文の1語を伏せる' },
]
export const DEFAULT_EXAM_FORM = 'mix'

export const examFormLabel = (id) =>
  EXAM_FORMS.find((f) => f.id === id)?.label ?? ''

/** 伏せたところに出す印。**画面にも紙にも、この1つ** */
export const BLANK_MARK = '________'

/**
 * 穴埋めに使わない語。**短い語・働きの語は伏せても問題にならない**
 * (`the` を伏せても、英語の練習にならない)。
 * **減らさない。** 増やすときは、ここ1か所に足す。
 */
const SKIP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'so', 'if', 'as', 'of', 'to', 'in',
  'on', 'at', 'by', 'for', 'with', 'from', 'into', 'over', 'about',
  'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being',
  'do', 'does', 'did', 'have', 'has', 'had',
  'i', 'you', 'he', 'she', 'it', 'we', 'they',
  'my', 'your', 'his', 'her', 'its', 'our', 'their',
  'this', 'that', 'these', 'those', 'there', 'here',
  'not', 'no', 'yes', 'will', 'would', 'can', 'could', 'may', 'might',
  'shall', 'should', 'must',
])

/** そろえた形。**大文字小文字と前後の空白だけを落とす** */
export const examKey = (s) => String(s ?? '').trim().toLowerCase()

/**
 * **英文から、伏せる1語を選ぶ。**
 *
 * 選ぶのは「**いちばん長い、働きの語ではない語**」。
 * 長い語はたいてい中身のある語で、そこを書かせるのがいちばん練習になる。
 *
 * @returns `{ question, answer }` —— **選べなければ `null`。**
 *   短い文や働きの語だけの文では、穴埋めにしようがない
 *   (**黙って空の問題を作らない**)。
 */
export function blankOf(en) {
  const text = String(en ?? '').trim()
  if (!text) return null
  /* 伏せる**候補**を拾う。**4文字以上で、働きの語ではないもの** */
  const words = text.match(/[A-Za-z][A-Za-z'’-]*/g) ?? []
  const live = words.filter((w) => w.length >= 4 && !SKIP_WORDS.has(examKey(w)))
  if (!live.length) return null
  /* **いちばん長いもの。同じ長さなら、あとに出てくるほう** ——
     文の先頭の語を伏せると、大文字から答えが透ける */
  let best = live[0]
  for (const w of live) if (w.length >= best.length) best = w
  /* **どこを伏せるかは `clozeAt()` 1か所に任せる**(`clozeSentence.js`)。
     単語帳の穴埋めが**もう同じことをしている** ——
     自分で `indexOf` を書くと、`in` が `internal` の中に当たって
     `___ternal` になる(2026-09 に単語帳で踏んだところ)。
     **数え方を2通り持たない**(CLAUDE.md)。
     **伏せるのは1か所だけ** —— あちらは最初に当たった1つだけを返す */
  const cut = clozeAt(text, best)
  if (!cut) return null
  return { question: `${cut.before}${BLANK_MARK}${cut.after}`, answer: cut.hit }
}

/**
 * **問題を1つ組む。**
 *
 * @param row  `{ en, ja }`
 * @param form `'ja_en'` か `'blank'`
 * @returns `{ form, ja, en, question, answer }`
 *   **穴埋めにできない行は、日本語 → 英語に落とす**(黙って捨てない)。
 */
export function examItem(row, form) {
  const en = String(row?.en ?? '').trim()
  const ja = String(row?.ja ?? '').trim()
  if (form === 'blank') {
    const b = blankOf(en)
    if (b) return { form: 'blank', ja, en, question: b.question, answer: b.answer }
  }
  return { form: 'ja_en', ja, en, question: ja, answer: en }
}

/**
 * **テストを組む。**
 *
 * @param rows  `[{ en, ja, from }]`(出どころをまぜたもの)
 * @param count 何問
 * @param form  `EXAM_FORMS` の id
 * @param order 並べ方。`'random'`(既定)か `'keep'`(そのまま)
 * @returns `[{ no, form, ja, en, question, answer, from }]`
 *
 * **同じ英文を二度出さない。** 教材と Quick Response 帳には
 * 同じ文が入っていることがある(帳は教材から溜まる)。
 */
export function buildExam(rows, {
  count = DEFAULT_EXAM_COUNT, form = DEFAULT_EXAM_FORM, order = 'random',
} = {}) {
  const want = Math.max(Number(count) || 0, 0)
  if (!want) return []
  /* **英語も訳も揃っているものだけ。** 片方だけでは問題にならない
     (訳が無ければ日本語 → 英語が作れず、英語が無ければ何も出ない) */
  const seen = new Set()
  const live = []
  for (const r of rows ?? []) {
    const en = String(r?.en ?? '').trim()
    const ja = String(r?.ja ?? '').trim()
    if (!en || !ja) continue
    const k = examKey(en)
    if (seen.has(k)) continue
    seen.add(k)
    live.push({ en, ja, from: String(r?.from ?? '') })
  }
  let bag = live
  if (order === 'random') {
    bag = [...live]
    for (let i = bag.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[bag[i], bag[j]] = [bag[j], bag[i]]
    }
  }
  const take = bag.slice(0, want)
  return take.map((r, i) => {
    /* **混ぜるときは、1問おき。** まとめて出すと、前半と後半で
       別のテストのように見える(しかも穴埋めだけの紙が続く) */
    const f = form === 'mix' ? (i % 2 === 0 ? 'ja_en' : 'blank') : form
    return { no: i + 1, from: r.from, ...examItem(r, f) }
  })
}

/**
 * **何問できたのかを、そのまま言う。**
 * 「作りました」で終わらせない(起きたことをそのまま言う・CLAUDE.md)。
 */
export function examNote(got, want, sources = []) {
  const where = sources.map(examSourceLabel).filter(Boolean).join(' / ')
  if (!got) {
    return where
      ? `${where} に、英語と訳のそろった文がありませんでした`
      : '出どころを1つ以上えらんでください'
  }
  if (got < want) {
    return `${where} から ${got} 問できました(${want} 問ぶんは足りませんでした)`
  }
  return `${where} から ${got} 問できました`
}

/**
 * 紙と画面に出す題。**日付を入れる** ——
 * 同じゲストのテストが何枚も出るので、いつのものか分からなくなる。
 */
export function examTitle(name, day = '') {
  const who = String(name ?? '').trim()
  return `${who ? `${who}さんの` : ''}テスト${day ? `(${day})` : ''}`
}

/** 何問あるか。**画面にも紙にも、この1つ**(数え方を2通り持たない) */
export const examCountNote = (items) => {
  const list = Array.isArray(items) ? items : []
  const b = list.filter((x) => x.form === 'blank').length
  return `全 ${list.length} 問(日本語 → 英語 ${list.length - b} 問 / 穴埋め ${b} 問)`
}
