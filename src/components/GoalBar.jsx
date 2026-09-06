/**
 * **週の目標と、達成の印**(0042・2026-09 利用者の指定
 * 「単語帳とクイックレスポンス帳にゲーミフィケーションを追加したいです」)。
 *
 * ============================================================================
 * 【目標を決めるのはトレーナー。ゲストではない】
 *
 *   **自分で下げられる目標は、目標にならない。**
 *   だから決める側は `set_weekly_goal()`(担当トレーナーと管理者だけ)で、
 *   ここは**出すだけ**である。
 *
 * 【「決めていない」と「まだ届いていない」は別物】
 *
 *   目標が 0 のときは**行ごと出さない。**「0 / 0」と出すと、
 *   何もしていないように見える。判断は `goalPart()`(`goals.js`)1か所。
 *
 * 【達成しても、責めない・煽らない】
 *
 *   届いていないときに出すのは「あと ◯」だけである。
 *   赤くしたり、遅れを数えたりしない —— 続けるための印であって、
 *   点数ではない(「まだ」を赤くしない、と同じ考え方・CLAUDE.md)。
 *
 * 【色だけに頼らない】
 *   達成の印は、**色と言葉と形**の3つで出す(CLAUDE.md)。
 *
 * 【言葉と算段は `gamify.js`】
 *   `goals.js` は Supabase を引き連れているので、素の node で
 *   確かめられない。**判断だけを何にも依存しない形に出してある。**
 */
import { goalPart, goalLine } from '../lib/gamify.js'

/**
 * @param goal 週の目標(0 なら出さない)
 * @param done 今週やった数
 * @param unit 数え方の言葉(語 / 文)
 */
export default function GoalBar({ goal = 0, done = 0, unit = '語' }) {
  const p = goalPart(goal, done)
  if (!p) return null

  const pct = Math.min(100, Math.round((p.done / p.goal) * 100))

  return (
    <div className={`goalbar${p.hit ? ' is-hit' : ''}`}>
      <p className="goalbar-line">
        {/* **達成の印は、色と言葉と形の3つで**(色だけに頼らない)。
            印は ✓ の文字。**絵文字は使わない**(端末ごとに形が違う) */}
        {p.hit && <span className="goalbar-hit" aria-hidden="true">✓</span>}
        {goalLine(p.goal, p.done, unit)}
      </p>
      <span className="goalbar-track" aria-hidden="true">
        <span style={{ width: `${pct}%` }} />
      </span>
    </div>
  )
}
