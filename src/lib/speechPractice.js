/**
 * **スピーチ練習の算段**(2026-09 利用者の指定)。
 *
 *   > スピーチ練習を実装しましょう。
 *   > これは、ゲストアカウントのスピーチ内から受け取ったスピーチの原稿を
 *   > AIにより添削し、そしてその文の音声を作成、ゲスト側で練習できる
 *   > 機能です。トレーナー側からもゲスト毎にスピーチを登録できます。
 *   > そして、単語帳にはスピーチの単語帳も作ります。
 *
 * ============================================================================
 * 【新しい仕組みを1つも作っていない】(CLAUDE.md)
 *
 *   | 何 | どの道を使うか |
 *   |---|---|
 *   | 添削 | `generate-material` の `mode: 'review_writing'`(第5.104節) |
 *   | 音声 | `speak` → `readAloudSequence`(`useBodyAudio`) |
 *   | 単語帳 | `lookupWord` → `setWordStatus` → `word_reviews` |
 *   | 絞り込み | `App.jsx` の `onlyWords` 1つ(0047 の `only`) |
 *
 *   足したのは**置き場所だけ**(`speeches`・0054)である。
 *   `material_progress`(0025)は `material_id` が not null なので、
 *   **教材に結び付かないスピーチの原稿は置けなかった。**
 *
 * 【呼び名を取り違えない】(CLAUDE.md)
 *
 *   ・**スピーチ練習** … この画面(`pages.id = 'pronunciation'`)
 *   ・**Speech練習**   … 教材の種類(`materials.kind = 'speech'`)
 *
 *   **3つめの名前を作らない。** 利用者が言った
 *   「ゲストアカウントのスピーチ内から」はこの画面のことなので、
 *   **すでにある画面の中**に置く。
 *
 * 【何にも依存しない】
 *   `npm run test:play` が素の node で読み込んで見張れるようにしてある
 *   (`playMark.js` / `writingReview.js` と同じ考え方)。
 *   Supabase を触るものは `speeches.js` の側にある。
 */
import { reviewText } from './writingReview.js'

/**
 * **1本のスピーチの長さの上限。**
 *
 * ディスカッションの答え(`MAX_WRITING_CHARS` = 1,500)では足りない。
 * 話して3分のスピーチは英語で 400 語ほど =**2,200 文字**あり、
 * 1,500 で切ると**終わりのほうが黙って落ちる。**
 *
 * 3,000 文字あれば 500 語ほど(4分)まで入る。
 * **これより長いスピーチは、切らずに断る**(勝手に削ると原稿が変わる)。
 *
 * **窓口の側も同じ数まで受け取る**(`generate-material`)。
 * あちらが最後の関所なので、**必ずこちらと同じか、これ以上**にしておく。
 */
export const MAX_SPEECH_CHARS = 3000

/**
 * 1回あたりのおおよその費用(円)。**画面にそのまま出す。**
 *
 * Claude Sonnet 5(入力 $2 / 出力 $10・100万トークン)で、
 * 3,000 文字なら入力 1,500・出力 2,000 トークンほど。1ドル 150 円として約 4 円。
 * **見えない費用は管理できない**(CLAUDE.md)。
 */
export const SPEECH_COST_YEN = 4

/** 原稿が空か。空白だけなら「まだ書いていない」 */
export const isBlankDraft = (text) => !String(text ?? '').trim()

/** 長すぎないか。**切らずに、断る** */
export const tooLongDraft = (text) =>
  String(text ?? '').trim().length > MAX_SPEECH_CHARS

/**
 * 画面に出す題名。
 *
 * **題名は空でよい**(書かせると、書くことが1つ増える)。
 * 空のときは**原稿のいちばん初めから**作る —— スピーチの1行目は
 * たいてい呼びかけか主題なので、そのまま見出しになる。
 *
 * **「無題」で終わらせない。** 一覧に同じ名前が並ぶと選べない。
 */
export function speechTitleOf(speech) {
  const title = String(speech?.title ?? '').trim()
  if (title) return title
  const head = String(speech?.draft ?? '')
    .split(/\r?\n/).map((s) => s.trim()).find(Boolean) ?? ''
  if (!head) return '書きかけのスピーチ'
  return head.length > 40 ? `${head.slice(0, 40)}…` : head
}

/**
 * 添削が済んでいるか。**済むまで練習の場所を出さない。**
 *
 * 直す前の原稿を読み上げると、**まちがった英語を手本として聞かせる**
 * ことになる(誤り訂正の英文に音声を付けないのと同じ考え方・CLAUDE.md)。
 */
export const isReviewed = (speech) =>
  Boolean((speech?.review?.sentences ?? []).some((s) => String(s?.en ?? '').trim()))

/**
 * 通しの読み上げに渡す並び(`useBodyAudio` の `parts`)。
 *
 * **1文で1つ。** 添削の窓口が**はじめから文ごとに返している**ので、
 * こちらで切り直さない(**数え方を2通り持たない**・CLAUDE.md)。
 *
 * 声は**全部同じ**である —— スピーチは1人が最後まで話しきるもので、
 * 話す人は1人しかいない(`materials.kind = 'speech'` と同じ考え方)。
 */
export const speechParts = (speech) =>
  (speech?.review?.sentences ?? [])
    .map((s) => ({ text: String(s?.en ?? '').trim(), clipVoice: speech?.voice_id || null }))
    .filter((p) => p.text)

/** 直した英文を1本につないだもの。**`sentences` からしか作らない** */
export const speechText = (speech) => reviewText(speech?.review)

/**
 * **スピーチの単語帳に入れる語句。**
 *
 *   > そして、単語帳にはスピーチの単語帳も作ります。
 *
 * 添削の窓口が返す `phrases`(3〜8)をそのまま使う。
 * あれは「この答えを言うために覚えておくとよい語句」で、
 * **en は直した英文の中に実際に出てくる形**になっている
 * (単語帳の「出会った文」に当てられるようにするため)。
 *
 * **別の一覧を作らない** —— 作ると、`WritingAnswer` の
 * 「単語帳へ」で入る語と食い違う。
 */
export const speechPhrases = (speech) =>
  (speech?.review?.phrases ?? [])
    .map((p) => ({ en: String(p?.en ?? '').trim(), ja: String(p?.ja ?? '').trim() }))
    .filter((p) => p.en)

/** 単語帳を絞るときに渡す語の一覧(`App.jsx` の `onlyWords`) */
export const speechWordList = (speech) => speechPhrases(speech).map((p) => p.en)

/**
 * 添削の1回あたりのおおよその費用(円)。
 * **短い原稿なら、そのぶん安い。** 押す前に出す数字なので、
 * **多めに見せない**(実際より高く見せて、押すのをためらわせない)。
 */
export function speechCostYen(text) {
  const n = String(text ?? '').trim().length
  if (!n) return 0
  const yen = Math.ceil((n / MAX_SPEECH_CHARS) * SPEECH_COST_YEN)
  return Math.max(1, Math.min(yen, SPEECH_COST_YEN))
}

/**
 * 一覧の並び。**新しく直したものが上。**
 * 同じ時刻なら題名で並べる(端末によって順が入れ替わらないように)。
 */
export const sortSpeeches = (rows) => [...(rows ?? [])].sort((a, b) => {
  const at = String(b?.updated_at ?? '').localeCompare(String(a?.updated_at ?? ''))
  if (at !== 0) return at
  return speechTitleOf(a).localeCompare(speechTitleOf(b))
})
