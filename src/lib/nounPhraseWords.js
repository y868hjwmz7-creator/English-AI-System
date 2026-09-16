/**
 * **名詞句を、それだけで練習する**(2026-09 利用者の指定)。
 *
 *   > どのビジネスでも使える「名詞句」を厳選し、
 *   > 単語帳に一つのコンテンツとして置き……
 *
 * ============================================================================
 * 【新しい仕組みを1つも作っていない】
 *
 *   | 何 | どの道を使うか |
 *   |---|---|
 *   | 80 件 | `src/data/nounPhrases.js`(**ファイル・0円**) |
 *   | 覚え具合 | **`word_reviews`** —— 自分の単語帳と同じ表 |
 *   | 書き戻す | `setWordStatus()` → `mark_word` |
 *   | 出題・4択・絞り込み・聞き流し・紙 | `Wordbook.jsx` そのまま |
 *
 *   **表も列も RPC も SQL も1行も増えていない。**
 *   コロケーション(`collocationWords.js`)と**1文字も違わない形**にしてある。
 *
 * 【`review_words()` を通さない理由】
 *
 *   あちらは上限で切る。80 件なら切られないが、
 *   **切られるかどうかを数に頼らない** —— 棚・基礎単語・コロケーションと
 *   同じく表を直に読めば、上限そのものに当たらない。
 *
 * 例外は投げず、必ず { data, error } の形で返す。
 * ============================================================================
 */
import { supabase } from './supabase.js'
import { nounPhraseRows } from '../data/nounPhrases.js'
import { todayKey } from './reviewScope.js'

const ok = (data) => ({ data, error: null })
const ng = (error) => ({ data: null, error })

/** 1回に読む覚え具合の上限。**際限なく読まない** */
export const NOUN_PHRASE_SEEN_LIMIT = 5000

/**
 * 80 件の名詞句を、覚え具合つきで読む。
 *
 * **Supabase が無くても、ログインしていなくても、語句は返る。**
 * 覚え具合が付かないだけである(**行き止まりを作らない**)。
 *
 * @param learnerId 誰の覚え具合か(省くと自分)
 */
export async function loadNounPhraseWordbook({ learnerId = null } = {}) {
  const day = todayKey()
  if (!supabase) return ok(nounPhraseRows([], { today: day }))

  /* **例外を外に出さない。** ここで投げると、呼んだ側の `await` が
     そこで止まり、**語句が1つも描かれない**(行き止まり) */
  let who = learnerId
  if (!who) {
    try { who = (await supabase.auth.getUser()).data?.user?.id ?? null }
    catch { who = null }
  }
  if (!who) return ok(nounPhraseRows([], { today: day }))

  const { data, error } = await supabase
    .from('word_reviews')
    .select('word_norm, status, box, due_on, learn_streak, added_at, updated_at')
    .eq('learner_id', who)
    .limit(NOUN_PHRASE_SEEN_LIMIT)
  if (error) return ng(error)

  return ok(nounPhraseRows(data ?? [], { today: day }))
}
