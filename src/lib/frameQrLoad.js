/**
 * **66 の型を、覚え具合つきで読む**(2026-09)。
 *
 * ============================================================================
 * **`nativeFlowQr.js` と1文字も違わない形**にしてある。
 * 問と行の作り方は `frameQr.js`(**Supabase を引き連れない**)が持ち、
 * ここは Supabase から覚え具合を読んで渡すだけである ——
 * こう割っておかないと、`npm run test:shift` が
 * **素の node で1行も走らせられない**(CLAUDE.md)。
 *
 * 例外は投げず、必ず { data, error } の形で返す。
 * ============================================================================
 */
import { FIRST_FRAME_PART, frameQrRows } from './frameQr.js'
import { loadQrReviews } from './qrReviews.js'
import { todayKey } from './reviewScope.js'

const ok = (data) => ({ data, error: null })

/** 1回に読む覚え具合の上限。**際限なく読まない**(0062 を貼ると 5000 まで効く) */
export const FRAME_QR_SEEN_LIMIT = 5000

/**
 * 66 の型の問を、覚え具合つきで読む。
 *
 * **Supabase が無くても、ログインしていなくても、問は返る。**
 * 覚え具合が付かないだけで、問はファイルに書いてあるからである
 * (**行き止まりを作らない**)。
 *
 * @param learnerId 誰の覚え具合か(省くと自分)
 * @param part      どの中身か(`'swap'` / `'say'`)
 */
export async function loadFrameQr({ learnerId = null, part = FIRST_FRAME_PART } = {}) {
  const day = todayKey()
  /* **状態で絞らない。** 中身ぜんぶを出して、3枚の札(まだ / 練習中 / できた)も
     読んだ行から数える —— 分けて読むと、札の数と実際に出る問が食い違う */
  const { data, error } = await loadQrReviews(learnerId, {
    status: null, limit: FRAME_QR_SEEN_LIMIT,
  })
  /* **読めなくても、問は返す。** 0040 を貼る前もここに来る */
  if (error) return ok(frameQrRows([], { today: day, part }))
  return ok(frameQrRows(data ?? [], { today: day, part }))
}
