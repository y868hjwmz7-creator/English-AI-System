/**
 * **基礎単語を、それだけで練習する**(2026-09 利用者の指定)。
 *
 *   > 基礎単語360/1200も業種別の横に置いてください。
 *
 * ============================================================================
 * 【「まず入れる」という段を、無くした】
 *
 *   0053 では、段まるごと(360〜1,200語)を `add_basic_words()` で
 *   **単語帳へ入れてから**、その語だけに絞って練習していた。
 *   ところがそれでは、**入れるまで1語も練習できない。**
 *
 *   いまは冊そのものになった(「自分の単語帳 / 業種べつ / 基礎単語」)。
 *   段の語は `basicWords.js` にぜんぶ書いてあるので、
 *   **入れなくても、開いた瞬間から練習できる。**
 *
 * 【業種べつとの違いは、1つだけ】
 *
 *   | | 語はどこから | 覚え具合はどこへ |
 *   |---|---|---|
 *   | 業種べつ(0058) | `shelf_words` | **`shelf_reviews`**(混ぜない) |
 *   | **基礎単語** | **`basicWords.js`**(ファイル・0円) | **`word_reviews`**(自分の単語帳) |
 *
 *   棚は「混ぜたくない」という指定だったが、基礎単語は 0053 で
 *   **逆の指定**を受けている。
 *
 *     > 講座から単語帳に登録を押せば、
 *     > 単語帳の中の自分の普段の単語に追加される感じで
 *
 *   だから**書き戻す道は、これまでどおり `setWordStatus()`(`mark_word`)**
 *   である。`Wordbook.jsx` は1文字も書き分けていない。
 *
 * 【SQL の移行も、窓口の置き直しも要らない】
 *
 *   読むのは `word_reviews` を直に `select` するだけ。
 *   0011 の RLS が「自分 / 担当ゲスト / 管理者」に開いてある。
 *
 * 【`review_words()` を使わない理由】
 *
 *   あちらは上限(0056 より前は 200 行)で切る。基礎単語は 1,200 語
 *   あるので、**切られると段の後ろが丸ごと「まだ」に見える。**
 *   表を直に読めば上限に当たらない(棚とまったく同じ判断)。
 *
 * 【語で絞り込まない理由】
 *
 *   `.in('word_norm', 1200語)` は URL が長すぎて通らない。
 *   その人の行をまとめて読んでから、**段の語の側から突き合わせる**
 *   (`basicRows()`)。
 *
 * 例外は投げず、必ず { data, error } の形で返す。
 */
import { supabase } from './supabase.js'
import { basicRows } from './basicsCourse.js'

const ok = (data) => ({ data, error: null })
const ng = (error) => ({ data: null, error })

/** 1回に読む覚え具合の上限。**際限なく読まない** */
export const BASIC_SEEN_LIMIT = 5000

/** きょうの日付(端末の日付。`.slice(0, 10)` だと世界標準時になる) */
const today = () => {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/**
 * その段の語を、覚え具合つきで読む。
 *
 * **Supabase が無くても、ログインしていなくても、語は返る。**
 * 覚え具合が付かないだけで、段はファイルに書いてあるからである
 * (**行き止まりを作らない**)。
 *
 * @param learnerId 誰の覚え具合か(省くと自分)
 * @param tier      'core'(基本360語)/ 'full'(標準1200語)
 */
export async function loadBasicWordbook({ learnerId = null, tier = 'core' } = {}) {
  const day = today()
  if (!supabase) return ok(basicRows(tier, [], { today: day }))

  /* **例外を外に出さない。** ここで投げると、呼んだ側の `await` が
     そこで止まり、**段の語が1つも描かれない**(行き止まり)。
     ログインしていない・届かないときは、覚え具合が付かないだけである */
  let who = learnerId
  if (!who) {
    try { who = (await supabase.auth.getUser()).data?.user?.id ?? null }
    catch { who = null }
  }
  if (!who) return ok(basicRows(tier, [], { today: day }))

  const { data, error } = await supabase
    .from('word_reviews')
    .select('word_norm, status, box, due_on, learn_streak, added_at, updated_at')
    .eq('learner_id', who)
    .limit(BASIC_SEEN_LIMIT)
  if (error) return ng(error)

  return ok(basicRows(tier, data ?? [], { today: day }))
}
