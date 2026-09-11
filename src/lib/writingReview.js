/**
 * **書いた答えの添削**(2026-09 利用者の指定)。
 *
 *   > 次に、ディスカッションや質問に対する回答をライティングで記入できる
 *   > ようにしてください。その記入した内容を添削する機能を実装できますか?
 *   > そして添削とフィードバックがもらえる仕組みです。フィードバック内の
 *   > 単語やフレーズは単語帳に登録できる。文章ごと、または回答全ても
 *   > そのままクイックレスポンスに登録し、自動的に文章ごとに分けてくれる。
 *   > また、添削の仕方の指定もスーパーカジュアル、カジュアル、
 *   > ビジネスカジュアル、ビジネスで選べると良いですね
 *
 * ============================================================================
 * 【どこに置くか】
 *
 *   **ディスカッションと想定される質問だけ**(`noteIsAnswer` が真の演習)。
 *   あちらは**正解が無い**ので、`answer` の欄そのものを持っていない
 *   (`SECTION_FIELDS.discussion`)。つまり
 *   **自分で書いてみるまで、英語がどこにも出てこない演習**である。
 *   だから書く場所と、直してもらう道がいちばん要る。
 *
 *   内容の理解には足していない(**言われた場所だけを直す**)。
 *   あちらは答えが本文の中にあり、`answer` が最初から付いている。
 *
 * 【入れ物は増やさない】
 *
 *   書いた英文も、返ってきた添削も **`material_progress`(0025)**に置く。
 *   ディクテーションの書きかけ・スラッシュの区切りと**まったく同じ道**
 *   (`useProgress`)なので、
 *
 *     ・**SQL は1行も要らない**
 *     ・ゲストが書いたものが、そのままトレーナーにも見える
 *     ・トレーナーがレッスン中に直したものが、ゲストにも残る
 *
 *   「あとから書いたほうが上書きしてよい」も、そのまま当てはまる
 *   (利用者の確認「添削できるからその方が良いです」)。
 *
 * 【文の切り方は、こちらでやらない】
 *
 *   Quick Response へ入れるには「英文 + 訳」の対が要る。
 *   ところが**こちらで英文を文に切って、訳を別に切って対にすると、
 *   数が合わないことがある**(`sentencePair.js` で何度も踏んだ)。
 *
 *   だから**窓口に、はじめから文ごとに返させる**(`sentences`)。
 *   画面に出す英文も、Quick Response に入れる対も、**同じ配列**である。
 *   **数え方を2通り持たない。**
 *
 * 【何にも依存しない】
 *   `npm run test:play` が素の node で読み込んで見張れるようにしてある
 *   (`playMark.js` / `gamify.js` / `speechDraft.js` と同じ考え方)。
 */
import { DEFAULT_TONE, writingToneOf } from '../data/writingTones.js'
import { viewerRoleOf } from './viewer.js'

/**
 * **添削を走らせられるのは、トレーナーと管理者だけ**
 * (2026-09 利用者の指定・**方針の変更**)。
 *
 *   > いや、ゲストには実行にしてください。ゲストから下書きをもらったら
 *   > トレーナー側だけでできるようにしたいです。もしくは課金プランなど、
 *   > 将来的に課金さしたときのみアンロックできるように、裏では取っておいてください。
 *
 * 【ゲストは「書く」まで。走らせるのはトレーナー】
 *
 *   ゲストが書いた英文は `material_progress`(0025)に残るので、
 *   **トレーナーがそのゲストのページで同じ教材を開けば、そのまま出てくる。**
 *   だから受け渡しの仕組みを新しく作る必要がない。
 *
 * 【裏に取ってある道】
 *
 *   窓口(`generate-material`)には、ゲストにも開ける道が**そのまま残して
 *   ある。** ただし **Secrets の `LEARNER_WRITING_REVIEW` が `on` の
 *   ときだけ**通る(既定は通らない)。課金プランを入れた日に、
 *   Supabase の画面でその1つを足せば開く。**コードは触らなくてよい。**
 *
 * 【判断はここ1か所】
 *   画面ごとに `viewerRoleOf() === 'learner'` と書くと、
 *   置く場所の数だけ食い違う(`remakeModeOf()` と同じ考え方)。
 *   **既定は「できない」** —— 役割が分からないうちは走らせない。
 */
export const canAskReview = () =>
  viewerRoleOf() === 'trainer' || viewerRoleOf() === 'owner'

/**
 * **1回に添削できる長さの上限。**
 *
 * ディスカッションの答えは、話すと 30〜60 秒ぶん(英語で 100〜200 語)である。
 * 1,500 文字あれば 250 語ほど入るので、**ふつうの答えは1文字も削られない。**
 *
 * 上限を置くのは、**この窓口をゲストも呼べるようにした**ためである
 * (`generate-material` の `mode: 'review_writing'`)。
 * 長い文章をそのまま投げられると、1回の課金が読めなくなる。
 */
export const MAX_WRITING_CHARS = 1500

/**
 * 1回あたりのおおよその費用(円)。**画面にそのまま出す。**
 *
 * Claude Sonnet 5(入力 $2 / 出力 $10・100万トークン)で、
 * 入力 1,200・出力 900 トークンほど。1ドル 150 円として約 2 円。
 * **見えない費用は管理できない**(CLAUDE.md)。
 */
export const REVIEW_COST_YEN = 2

/** 書いた答えが空か。空白だけなら「まだ書いていない」 */
export const isBlankAnswer = (text) => !String(text ?? '').trim()

/** 長すぎないか。**切らずに、断る。** 勝手に削ると答えが変わってしまう */
export const tooLongAnswer = (text) => String(text ?? '').trim().length > MAX_WRITING_CHARS

/**
 * 窓口へ渡す「どう直すか」の指定。
 *
 * **`speechBrief()` と同じ考え方である** —— 調子の文言を画面から渡すので、
 * 言い回しを変えたくなっても**窓口を置き直さなくてよい。**
 *
 * @param toneId `WRITING_TONES` の id
 */
export function toneBrief(toneId = DEFAULT_TONE) {
  const tone = writingToneOf(toneId)
  return `${tone.label}: ${tone.brief}`
}

/** 添削の結果を、画面が読める形にそろえる。**壊れていれば `null`** */
export function normalizeReview(raw) {
  if (!raw || typeof raw !== 'object') return null
  const str = (v) => String(v ?? '').trim()
  const sentences = (Array.isArray(raw.sentences) ? raw.sentences : [])
    .map((s) => ({ en: str(s?.en), ja: str(s?.ja) }))
    .filter((s) => s.en)
  // **英文が1つも無ければ、添削になっていない。** 空の成功を返さない
  if (!sentences.length) return null
  const notes = (Array.isArray(raw.notes) ? raw.notes : [])
    .map((n) => ({ before: str(n?.before), after: str(n?.after), why: str(n?.why) }))
    .filter((n) => n.why)
  // **同じ語句を二度出さない**(そろえた形で見る)
  const seen = new Set()
  const phrases = []
  for (const p of (Array.isArray(raw.phrases) ? raw.phrases : [])) {
    const en = str(p?.en)
    const ja = str(p?.ja)
    const key = en.toLowerCase()
    if (!en || !ja || seen.has(key)) continue
    seen.add(key)
    phrases.push({ en, ja })
    if (phrases.length >= 12) break
  }
  return {
    sentences,
    notes,
    phrases,
    good: str(raw.good),
    tone: str(raw.tone) || DEFAULT_TONE,
    at: str(raw.at) || new Date().toISOString().slice(0, 10),
  }
}

/**
 * 直した英文を、1本につないだもの(画面と読み上げに使う)。
 * **`sentences` からしか作らない** —— 別の欄を持つと必ず食い違う。
 */
export const reviewText = (review) =>
  (review?.sentences ?? []).map((s) => s.en).join(' ')

/**
 * Quick Response へ入れる対。
 *
 * **訳の無い文は入れない。** Quick Response は「日本語を見て英語を言う」
 * 練習なので、訳が無い対は出しようがない(`markQr` も弾く)。
 */
export const reviewPairs = (review) =>
  (review?.sentences ?? []).filter((s) => s.en && s.ja).map((s) => ({ en: s.en, ja: s.ja }))

/**
 * その語句が出てくる、直した英文の1文。**単語帳の「出会った文」に使う。**
 *
 * 人は文脈ごと覚える(`word_reviews.seen_in`・0018)。
 * 見つからなければ、つないだ英文ぜんぶを返す(**空にしない**)。
 */
export function seenSentenceFor(review, en) {
  const needle = String(en ?? '').trim().toLowerCase()
  if (!needle) return ''
  const hit = (review?.sentences ?? [])
    .find((s) => s.en.toLowerCase().includes(needle))
  return hit?.en || reviewText(review)
}

/** 語か言い回しか。**空白を含めば言い回し**(`WordbookAdd` と同じ判定) */
export const phraseKind = (en) =>
  (String(en ?? '').trim().includes(' ') ? 'phrase' : 'word')

/* ── 選んだ調子を覚える(一度決める設定は覚える・CLAUDE.md)──
 *
 * 【場面ごとに別に覚える】(2026-09 利用者の指定・スピーチ)
 *
 *   ・**ディスカッションの答え**(`WritingAnswer`)… 口に出して話す練習。
 *     既定は「カジュアル」
 *   ・**スピーチの原稿**(`SpeechBoard`)… 全社集会・学会・乾杯など、
 *     たいていは**もっと改まった場**である
 *
 *   同じ鍵で覚えると、**片方を直すともう片方まで変わる。**
 *   `eas.radioGap` / `eas.qrRadioGap`(聞き流しの間)を場面ごとに
 *   分けてあるのと、まったく同じ考え方である。
 *
 *   **読み書きは `toneStore()` 1か所。** 鍵の名前を画面に書かない ——
 *   書くと、鍵を直したときに片方だけ古くなる。
 */

const TONE_KEYS = {
  writing: 'eas.writingTone',
  speech: 'eas.speechTone',
}

/** 知らない場面は、**ディスカッションの鍵に落とす**(行き止まりを作らない) */
const toneKeyOf = (where) => TONE_KEYS[where] ?? TONE_KEYS.writing

export function loadWritingTone(where = 'writing') {
  try { return localStorage.getItem(toneKeyOf(where)) || DEFAULT_TONE } catch { return DEFAULT_TONE }
}

export function saveWritingTone(id, where = 'writing') {
  try { localStorage.setItem(toneKeyOf(where), id) } catch { /* 使えなくても困らない */ }
}
