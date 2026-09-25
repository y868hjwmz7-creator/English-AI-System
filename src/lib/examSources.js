/**
 * ============================================================================
 * **テストのもとになる英文を、ゲストの持ちものから引く**(第5.260節)
 *
 * 2026-09-25 利用者の指定。
 *
 *   > ゲストのページに教材や彼らの単語帳、quick response 帳があります。
 *   > それらのデータを基にテストを作りたいです。
 *
 * ── **AI を1回も呼ばない = 0円** ───────────────────────────
 *
 *   もう入っているものを読むだけである。**作らない。**
 *
 * ── **読む道は、すでにあるものをそのまま使う** ────────────────
 *
 *   | 出どころ | 通る道 | 対に直す |
 *   |---|---|---|
 *   | 教材 | `loadMaterial()` | `quickResponsePairs()` |
 *   | 単語帳 | `loadMyWordbook()` | `wordSheetPairs()` |
 *   | Quick Response 帳 | `loadQrReviews()` | `qrPairOf()` |
 *
 *   **新しい読み方を1つも作らない**(数え方を2通り持たない・CLAUDE.md)。
 *   紙に出すときと**まったく同じ対**が出る。
 *
 * ── **黙って落とさない・黙って絞らない** ───────────────────
 *
 *   どれか1つが読めなくても、**残りは出す。**
 *   そのかわり「**どこが読めなかったか**」を必ず返す ——
 *   問題数が少ないのが「そういうものなのか」「失敗したのか」を、
 *   押した人が見分けられるようにするためである。
 *
 * ── 算段は `examBuild.js`(**素の node で確かめられる**)──────────
 * ============================================================================
 */
import { loadMaterial } from './materials.js'
import { quickResponsePairs } from './quickResponse.js'
import { loadMyWordbook } from './vocab.js'
import { loadQrReviews, qrPairOf } from './qrReviews.js'
import { wordSheetPairs } from './reviewSheet.js'
import { examSourceLabel } from './examBuild.js'

/**
 * 1つの出どころから、どれだけ読むか。
 * **問題数より多めに読む** —— 英語と訳のそろっていない行が落ちるので、
 * ぴったり読むと足りなくなる。
 */
const PER_SOURCE = 200

/**
 * **テストのもとになる英文を集める。**
 *
 * @param learnerId    だれの持ちものか
 * @param sources      `EXAM_SOURCES` の id(**複数**)
 * @param materialIds  「教材」をえらんだときに、どの教材から引くか
 * @returns `{ rows, failed }`
 *   `rows` は `[{ en, ja, from }]`、
 *   `failed` は**読めなかった出どころの名前**(空なら全部読めた)。
 */
export async function loadExamRows(learnerId, { sources = [], materialIds = [] } = {}) {
  const want = new Set(sources)
  const rows = []
  const failed = []

  if (want.has('word')) {
    try {
      /* **「まだ」だけに絞らない。** テストは覚えたものも試すものである
         (`'all'` は `review_words` が受け取る言葉) */
      const { data, error } = await loadMyWordbook({
        learnerId, status: 'all', limit: PER_SOURCE,
      })
      if (error) failed.push(examSourceLabel('word'))
      else {
        for (const p of wordSheetPairs(data ?? [])) {
          rows.push({ en: p.en, ja: p.ja, from: examSourceLabel('word') })
        }
      }
    } catch { failed.push(examSourceLabel('word')) }
  }

  if (want.has('qr')) {
    try {
      const { data, error } = await loadQrReviews(learnerId, {
        status: 'all', limit: PER_SOURCE,
      })
      if (error) failed.push(examSourceLabel('qr'))
      else {
        for (const r of data ?? []) {
          const p = qrPairOf(r)
          rows.push({ en: p.en, ja: p.ja, from: p.from || examSourceLabel('qr') })
        }
      }
    } catch { failed.push(examSourceLabel('qr')) }
  }

  if (want.has('material')) {
    /* **えらんだ教材だけを読む。** 全部読むと、宿題の数だけ往復する。
       **1つ落ちても、残りは出す**(黙って全部やめない) */
    for (const id of materialIds ?? []) {
      try {
        const { data, error } = await loadMaterial(id)
        if (error || !data) { failed.push(examSourceLabel('material')); continue }
        for (const p of quickResponsePairs(data)) {
          rows.push({ en: p.en, ja: p.ja, from: data.title ?? examSourceLabel('material') })
        }
      } catch { failed.push(examSourceLabel('material')) }
    }
  }

  /* **同じ名前を2度返さない**(教材が3本落ちても「教材」は1つ) */
  return { rows, failed: [...new Set(failed)] }
}
