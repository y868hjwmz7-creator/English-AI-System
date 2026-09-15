/**
 * **コロケーション基本動詞を、それだけで練習する**(2026-09 利用者の指定)。
 *
 *   > これらを教材として独立させて登録せよ。
 *   > Native flow は Quick Response 教材、コロケーション基本動詞は単語帳だ。
 *
 * ============================================================================
 * 【新しい仕組みを1つも作っていない】
 *
 *   | 何 | どの道を使うか |
 *   |---|---|
 *   | 50 件 | `src/data/collocations.js`(**ファイル・0円**) |
 *   | 覚え具合 | **`word_reviews`** —— 自分の単語帳と同じ表 |
 *   | 書き戻す | `setWordStatus()` → `mark_word` |
 *   | 出題・4択・絞り込み・聞き流し・紙 | `Wordbook.jsx` そのまま |
 *
 *   **表も列も RPC も SQL も1行も増えていない。**
 *   基礎単語(`basicReviews.js`)とまったく同じ形である。
 *
 * 【`review_words()` を通さない理由】
 *
 *   あちらは上限で切る。50 件なら切られないが、
 *   **切られるかどうかを数に頼らない** —— 棚・基礎単語と同じく
 *   表を直に読めば、上限そのものに当たらない。
 *
 * 【語で絞り込まない理由】
 *
 *   `.in('word_norm', 50語)` でも通るが、**基礎単語と同じ形にそろえる。**
 *   その人の行をまとめて読んでから、**ファイルの側から突き合わせる**
 *   (`collocationRows()`)。読み方を2通り持たない。
 *
 * 例外は投げず、必ず { data, error } の形で返す。
 * ============================================================================
 */
import { supabase } from './supabase.js'
import { collocationRows } from '../data/collocations.js'
import { todayKey } from './reviewScope.js'

const ok = (data) => ({ data, error: null })
const ng = (error) => ({ data: null, error })

/** 1回に読む覚え具合の上限。**際限なく読まない** */
export const COLLOCATION_SEEN_LIMIT = 5000

/**
 * 50 件の語句を、覚え具合つきで読む。
 *
 * **Supabase が無くても、ログインしていなくても、語句は返る。**
 * 覚え具合が付かないだけである(**行き止まりを作らない**)。
 *
 * @param learnerId 誰の覚え具合か(省くと自分)
 */
export async function loadCollocationWordbook({ learnerId = null } = {}) {
  const day = todayKey()
  if (!supabase) return ok(collocationRows([], { today: day }))

  /* **例外を外に出さない。** ここで投げると、呼んだ側の `await` が
     そこで止まり、**語句が1つも描かれない**(行き止まり) */
  let who = learnerId
  if (!who) {
    try { who = (await supabase.auth.getUser()).data?.user?.id ?? null }
    catch { who = null }
  }
  if (!who) return ok(collocationRows([], { today: day }))

  const { data, error } = await supabase
    .from('word_reviews')
    .select('word_norm, status, box, due_on, learn_streak, added_at, updated_at')
    .eq('learner_id', who)
    .limit(COLLOCATION_SEEN_LIMIT)
  if (error) return ng(error)

  return ok(collocationRows(data ?? [], { today: day }))
}
