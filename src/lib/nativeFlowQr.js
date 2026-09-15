/**
 * **Native Flow Vol.1 を、それだけで練習する**(2026-09 利用者の指定)。
 *
 *   > これらを教材として独立させて登録せよ。
 *   > Native flow は Quick Response 教材、コロケーション基本動詞は単語帳だ。
 *
 * ============================================================================
 * 【新しい仕組みを1つも作っていない】
 *
 *   | 何 | どの道を使うか |
 *   |---|---|
 *   | 690 問 | `src/data/nativeFlow.js`(**ファイル・0円**) |
 *   | 覚え具合 | **`qr_reviews`(0040)** —— ふだんの Quick Response と同じ |
 *   | 溜める | `markQr()` → `mark_qr` |
 *   | 出題・絞り込み・聞き流し・紙 | `QrReview.jsx` そのまま |
 *
 *   **表も列も RPC も1つも増えていない。**
 *   基礎単語(`basicReviews.js`)とまったく同じ考え方である。
 *
 * 【「まず入れる」という段を作らない】
 *
 *   0053 で一度その形にして、**入れるまで1問も練習できなかった。**
 *   ここでは冊そのものにしてあるので、**開いた瞬間から練習できる。**
 *   答えた問にだけ `qr_reviews` へ行ができる。
 *
 * 【`qr_items()` を通す理由】
 *
 *   `qr_reviews` の RLS は **`learner_id = auth.uid()` だけ**(0040)。
 *   表を直に読むと、**トレーナーがゲストのページから開いたときに0問**になる。
 *   `qr_items()` は `security definer` で
 *   「本人 / 担当トレーナー / 管理者」を見てくれる ——
 *   **画面で役割を判定しない**(必ず食い違う)。
 *
 *   棚と基礎単語が表を直に読んでいるのは、あちらの RLS が
 *   担当トレーナーにも開いているからである。**事情が違う。**
 *
 * 【上限は 0062 で上げた】
 *
 *   `qr_items()` は **SQL 側で 500 に切っていた**(0048)。
 *   Native Flow だけで 690 問あるので、**貼る前は後ろが丸ごと「まだ」に見える。**
 *   0062 で `public.wordbook_limit()` から読むようにしてある。
 *
 *   **貼る前でも壊れない** —— 500 問までは覚え具合が付き、
 *   その先は「まだ」として出るだけである(練習はできる)。
 *   画面が「いま読めているのは ◯◯ 問までです」と自分で言う。
 *
 * 例外は投げず、必ず { data, error } の形で返す。
 * ============================================================================
 */
import { nativeFlowRows } from '../data/nativeFlow.js'
import { loadQrReviews } from './qrReviews.js'
import { todayKey } from './reviewScope.js'

const ok = (data) => ({ data, error: null })

/** 1回に読む覚え具合の上限。**際限なく読まない**(0062 を貼ると 5000 まで効く) */
export const NATIVE_FLOW_SEEN_LIMIT = 5000

/**
 * Native Flow の 690 問を、覚え具合つきで読む。
 *
 * **Supabase が無くても、ログインしていなくても、問は返る。**
 * 覚え具合が付かないだけで、690 問はファイルに書いてあるからである
 * (**行き止まりを作らない**)。
 *
 * @param learnerId 誰の覚え具合か(省くと自分)
 */
export async function loadNativeFlowQr({ learnerId = null } = {}) {
  const day = todayKey()
  /* **状態で絞らない。** 冊ぜんぶを出して、3枚の札(まだ / 言えかけ /
     言える)も読んだ行から数える —— 分けて読むと、札の数と
     実際に出る問が食い違う(`Wordbook.jsx` の棚・基礎単語と同じ作法) */
  const { data, error } = await loadQrReviews(learnerId, {
    status: null, limit: NATIVE_FLOW_SEEN_LIMIT,
  })
  /* **読めなくても、問は返す。** 0040 を貼る前もここに来る */
  if (error) return ok(nativeFlowRows([], { today: day }))
  return ok(nativeFlowRows(data ?? [], { today: day }))
}
