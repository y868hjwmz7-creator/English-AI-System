/**
 * ============================================================================
 * **ゲストの持ちものから、テストを組む**(第5.260節 → **第5.263節で作り直した**)
 *
 * 2026-09-25 利用者の指定。
 *
 *   > ゲストのページに教材や彼らの単語帳、quick response 帳があります。
 *   > それらのデータを基にテストを作りたいです。
 *
 * ── **作り直した理由**(2026-09-26 実機・利用者の指摘)───────────
 *
 *   > テストですが、こんなのでは使い物になりません。
 *   > 穴埋め問題の日本語がないのをまず直してください。
 *   > 基本は左に日本語、右に英語です。解答とか入りません。
 *   > その場で答えが見れないとだめです。
 *
 *   訊いたうえでの答えは2つ。
 *
 *   1. **穴埋めをやめて、日本語 → 英語だけにする**
 *   2. **テストは、ひとつの教材としてちゃんと作る**
 *
 *   前の作りは**その場で組んで、見て、刷るだけ**だった。
 *   残らないので、次のレッスンで開けず・共有できず・探せない。
 *   「新しい表も SQL も要らない」と書いたのは**こちらの都合**であって、
 *   利用者の求めていたものではなかった。
 *
 * ── **なぜ穴埋めが使い物にならなかったか**(同じ穴を二度掘らない)────
 *
 *   穴埋めは `英文の1語を ________ に替えたもの`だった。
 *   **日本語がどこにも出ない。** 英文を見ながら英語を埋めるので、
 *   「日本語を見て英語で言う」練習になっていない。
 *   しかも紙の左が日本語のときと英語のときで**列の意味が入れ替わる。**
 *   **問いの形を混ぜると、紙の読み方が1つに決まらない。**
 *
 * ── **新しい紙を1枚も作らない** ─────────────────────────
 *
 *   和文英訳(`translate_ja_en`)の設問は
 *   `{ prompt_ja: 日本語, answer: 英語 }` である。この対は
 *   `quickResponse.js` の `PAIR_FIELDS` がそのまま拾うので、
 *   **教材の紙(`QuickResponseSheet`)が「左=日本語・右=英語」で刷る。**
 *   画面では「解答を見る」で**その場で答えが出る**(`LessonView`)。
 *
 *   つまり**利用者の指定どおりのものが、もうある。**
 *   足すのは `materials.kind` の値1つ(`'test'`・0069)だけである。
 *   **演習の種類も足さない** —— `translate_ja_en` は 0007 からある。
 *
 * ── **AI を1回も呼ばない = 0円** ───────────────────────────
 *
 *   問題は**作らない。すでにあるものを組み替えるだけ**である。
 *   教材・単語帳・Quick Response 帳には、もう
 *   **英文と訳の対**が入っている。テストに要るのはそれだけである。
 *
 * ── ここは算段だけ。Supabase を持たない ────────────────────
 *
 *   **素の node で走らせられる形にしてある**(`playMark.js` と同じ作法)。
 *   引いてくるのは `examSources.js`(あちらが Supabase を持つ)。
 * ============================================================================
 */

import { exerciseType } from '../data/exerciseTypes.js'
import { DEFAULT_CEFR } from '../data/cefr.js'

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
 * **テストの教材の種類**(0069)。
 * **`'test'` と書くのは、ここと `materialKinds.js` だけ**にする。
 */
export const EXAM_KIND = 'test'

/**
 * **問いの形は1つだけ。**
 *
 * 日本語 → 英語(和文英訳 `translate_ja_en`)。**0007 からある演習**で、
 * 新しい種類は足さない(足すと窓口・画面・SQL の4か所に増える)。
 * **`'translate_ja_en'` と書くのは、ここ1か所**である。
 */
export const EXAM_TYPE = 'translate_ja_en'

/**
 * 演習の指示。**書き写さない** ——
 * 和文英訳の指示は `exerciseTypes.js` が持っている
 * (文型ドリルのテストと、こちらで文が違っては困る)。
 */
export const examInstruction = () => exerciseType(EXAM_TYPE)?.instruction ?? ''

/**
 * テストのレベル。**そのゲストの段をそのまま使う。**
 * 分かっていなければ既定の段に落ちる(`materials.level` は空にできない)。
 */
export const examLevel = (cefr) => String(cefr ?? '').trim() || DEFAULT_CEFR

/** そろえた形。**大文字小文字と前後の空白だけを落とす** */
export const examKey = (s) => String(s ?? '').trim().toLowerCase()

/**
 * **テストを組む。**
 *
 * @param rows  `[{ en, ja, from }]`(出どころをまぜたもの)
 * @param count 何問
 * @param order 並べ方。`'random'`(既定)か `'keep'`(そのまま)
 * @returns `[{ no, ja, en, from }]`
 *
 * **同じ英文を二度出さない。** 教材と Quick Response 帳には
 * 同じ文が入っていることがある(帳は教材から溜まる)。
 */
export function buildExam(rows, { count = DEFAULT_EXAM_COUNT, order = 'random' } = {}) {
  const want = Math.max(Number(count) || 0, 0)
  if (!want) return []
  /* **英語も訳も揃っているものだけ。** 片方だけでは問題にならない
     (訳が無ければ問いが作れず、英語が無ければ答えが無い) */
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
  return bag.slice(0, want).map((r, i) => ({ no: i + 1, ja: r.ja, en: r.en, from: r.from }))
}

/**
 * **教材の演習に組み直す**(第5.263節)。
 *
 * @param items `buildExam()` が返したもの
 * @returns `createMaterial({ sections })` にそのまま渡せる形
 *
 * 演習は**1つだけ**にする。日本語 → 英語しか無いので、
 * 2つに割ると同じ見出しが2回出るだけである。
 *
 * **日本語は `prompt_ja`、英語は `answer`。** この置き場所は
 * `quickResponse.js` の `PAIR_FIELDS` が決めていて、
 * **紙の左右もそこから決まる**(左=日本語・右=英語)。
 * ここで入れ替えると、紙の列が逆になる。
 *
 * **片方だけの行は入れない**(黙って空の問題を作らない)。
 */
export function examSections(items) {
  const list = (Array.isArray(items) ? items : [])
    .map((q) => ({
      prompt_ja: String(q?.ja ?? '').trim(),
      answer: String(q?.en ?? '').trim(),
    }))
    .filter((it) => it.prompt_ja && it.answer)
  if (!list.length) return []
  return [{ exercise_type: EXAM_TYPE, instruction: examInstruction(), items: list }]
}

/**
 * **1問も作れなかったときに言うこと。**
 * 「作れませんでした」で終わらせない —— **何が足りないのか**を言う
 * (起きたことをそのまま言う・CLAUDE.md)。
 */
export function examEmptyNote(sources = []) {
  const where = sources.map(examSourceLabel).filter(Boolean).join(' / ')
  return where
    ? `${where} に、英語と訳のそろった文がありませんでした`
    : '出どころを1つ以上えらんでください'
}

/**
 * **作ったあとに言うこと。**
 *
 * 何問できて、誰に共有したかを1行で言う。
 * **足りなかったときは、そのことも同じ行に言う** ——
 * 20 問と指定して 12 問しかできないことがあり(持ちものが少ない)、
 * 黙っていると「20 問あるつもり」で次のレッスンに持っていく。
 */
export function examMadeText(got, want, name) {
  const who = String(name ?? '').trim()
  const n = Math.max(Number(want) || 0, 0)
  const short = got < n ? `(${n} 問には足りませんでした)` : ''
  return `${got} 問のテストを作って、${who ? `${who}さんに` : 'このゲストに'}共有しました${short}`
}

/**
 * 教材名。**日付を入れる** ——
 * 同じゲストのテストが何本もできるので、いつのものか分からなくなる。
 */
export function examTitle(name, day = '') {
  const who = String(name ?? '').trim()
  return `${who ? `${who}さんの` : ''}テスト${day ? `(${day})` : ''}`
}
