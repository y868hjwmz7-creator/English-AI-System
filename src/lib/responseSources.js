/**
 * ============================================================================
 * **応答問題の「正解にする表現」を引いてくる**(0073・第5.332節)
 *
 * 2026-10-01 利用者の指定。
 *
 *   > すべてのテキスト、そしてゲストの単語帳と quick response からえらべるように
 *
 * ── **新しい読み方を1つも作らない**(CLAUDE.md)────────────────
 *
 *   | 出どころ | 通る道 | もともと誰のものか |
 *   |---|---|---|
 *   | テキスト(Native Flow / RIZAP) | `loadTextPhrases()` | 第5.259節 |
 *   | ゲストの単語帳 | `loadExamRows()` | 第5.260節 |
 *   | ゲストの Quick Response 帳 | 同上 | 同上 |
 *
 *   **数え方を2通り持たない。** テストの画面が引くのと**まったく同じ対**が
 *   出る(あちらを直したら、こちらも直る)。
 *
 * ── **AI を1回も呼ばない = 0円** ───────────────────────────
 *
 *   もう手元にあるものを読むだけである。Native Flow は**ファイルの中**、
 *   RIZAP とゲストの持ちものは Supabase を**読むだけ**。
 *
 * ── **0 と「読めなかった」を取り違えない**(CLAUDE.md)────────────
 *
 *   読めなかったら `error` を返す。**空の配列にしない。**
 *   「その UNIT に表現が無い」と「Supabase に届かなかった」は別である ——
 *   前者は選び直せばよく、後者は何度選び直しても直らない。
 * ============================================================================
 */
import { loadTextPhrases } from './textBooks.js'
import { loadExamRows } from './examSources.js'
import { needsLearner, responseSourceLabel, usesTextBook } from './responseDrill.js'
import { MIX_ALL_UNITS } from './textMix.js'

const ok = (data) => ({ data, error: null })
const ng = (message) => ({ data: null, error: { message } })

/**
 * **その出どころから、英文と訳の対を引く。**
 *
 * @param {object} o
 *   - `source` … `RESPONSE_SOURCES` の id
 *   - `learnerId` … 単語帳 / Quick Response 帳のときに**誰の持ちものか**
 *   - `bookId` / `unitKey` … テキストのときに、どの冊のどの UNIT か
 * @returns `{ data: [{en, ja, from}], error }`
 */
export async function loadResponseRows({
  source, learnerId = null, bookId = '', unitKey = MIX_ALL_UNITS,
} = {}) {
  if (!source) return ng('もとになる表現の出どころを選んでください')

  if (usesTextBook(source)) {
    if (!bookId) return ng('テキストの冊を選んでください')
    const got = await loadTextPhrases(bookId, unitKey)
    if (got.error) return ng(got.error.message ?? 'テキストの表現を読めませんでした')
    /* **どこから来たかを添える**(画面に出す。`loadExamRows` と同じ形) */
    return ok((got.data ?? []).map((r) => ({ ...r, from: responseSourceLabel(source) })))
  }

  /* **ゲストを選んでいないのに、空を返さない**(黙って落とさない)——
     持ちものの出どころは、誰のものかが決まらないと読めない */
  if (needsLearner(source) && !learnerId) {
    return ng(`${responseSourceLabel(source)}から引くには、先にゲストを選んでください`)
  }

  const { rows, failed } = await loadExamRows(learnerId, { sources: [source] })
  /* **読めなかったものは名前で返す**(第5.260節と同じ決まり)。
     **0件と読めなかったのを混ぜない** */
  if (failed?.length) return ng(`${failed.join(' / ')}を読めませんでした`)
  return ok(rows ?? [])
}
