/**
 * **ビジネス単語 200 語を、それだけで練習する**(2026-10 利用者の指定)。
 *
 *   > また、ビジネス単語200語も
 *
 * ============================================================================
 * 【新しい仕組みを1つも作っていない】
 *
 *   | 何 | どの道を使うか |
 *   |---|---|
 *   | 200 語 | `src/data/businessWords.js`(**ファイル・0円**) |
 *   | 覚え具合 | **`word_reviews`** —— 自分の単語帳と同じ表 |
 *   | 書き戻す | `setWordStatus()` → `mark_word` |
 *   | 出題・4択・絞り込み・聞き流し・紙 | `Wordbook.jsx` そのまま |
 *
 *   **表も列も RPC も、貼る SQL も1行も増えていない。**
 *   副詞句(`adverbPhraseWords.js`)と**1文字も違わない形**にしてある。
 *
 * 【`review_words()` を通さない理由】
 *   あちらは上限で切るので、200 語では**後ろのほうが丸ごと「まだ」に見える。**
 *   棚・基礎単語・コロケーションと同じく表を直に読めば、上限に当たらない
 *   (第5.404節「表を直に読めば切られない」は**読む件数の上限**の話とは別。
 *   こちらは `word_reviews` を自分で読み、`limit` も自分で持っている)。
 *
 * 例外は投げず、必ず { data, error } の形で返す。
 * ============================================================================
 */
import { supabase } from './supabase.js'
import { businessWordRows } from '../data/businessWords.js'
import { todayKey } from './reviewScope.js'

const ok = (data) => ({ data, error: null })
const ng = (error) => ({ data: null, error })

/** 1回に読む覚え具合の上限。**際限なく読まない** */
export const BUSINESS_WORD_SEEN_LIMIT = 5000

/**
 * 200 語を、覚え具合つきで読む。
 *
 * **Supabase が無くても、ログインしていなくても、語は返る。**
 * 覚え具合が付かないだけである(**行き止まりを作らない**)。
 *
 * @param learnerId 誰の覚え具合か(省くと自分)
 */
export async function loadBusinessWordbook({ learnerId = null } = {}) {
  const day = todayKey()
  if (!supabase) return ok(businessWordRows([], { today: day }))

  /* **例外を外に出さない。** ここで投げると、呼んだ側の `await` が
     そこで止まり、**語が1つも描かれない**(行き止まり) */
  let who = learnerId
  if (!who) {
    try { who = (await supabase.auth.getUser()).data?.user?.id ?? null }
    catch { who = null }
  }
  if (!who) return ok(businessWordRows([], { today: day }))

  const { data, error } = await supabase
    .from('word_reviews')
    .select('word_norm, status, box, due_on, learn_streak, added_at, updated_at')
    .eq('learner_id', who)
    .limit(BUSINESS_WORD_SEEN_LIMIT)
  if (error) return ng(error)

  return ok(businessWordRows(data ?? [], { today: day }))
}
