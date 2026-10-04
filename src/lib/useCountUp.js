/**
 * ============================================================================
 * ★ **数が駆け上がる**(第5.371節・2026-10-04 利用者の指定)
 *
 *   > 本当に驚く、英語が驚くほど上達し、驚くほど楽しいアプリに変えてください
 *
 * 点数が「8」とだけ出るのと、**0 から 8 まで駆け上がる**のは、
 * 同じ数字でも受け取り方がまるで違う。**やり切ったことが体で分かる。**
 *
 * ── **数そのものは、1つも書き換えない** ───────────────────────
 *
 *   返すのは「いま見せる数」だけで、**終わりの値は必ず渡された値**に
 *   なる(`countUpAt` が `t >= ms` で丸める)。
 *   **0 と `null` を取り違えない**(CLAUDE.md)—— 数でないものを
 *   渡されたら、駆け上がらせずにそのまま返す。
 *
 * ── **滑る動きが苦手な人には、動かさない** ───────────────────
 *
 *   `motionOff()` のときは**最初から終わりの値**を出す。
 *   0 から数えて見せない —— 動かさないとは、そういうことである。
 *
 * ── `requestAnimationFrame` を使ってよい場面である ───────────────
 *
 *   CLAUDE.md が `rAF` を禁じているのは**音の間を置くとき**である
 *   (画面を消すと止まるため)。ここは**見た目だけ**なので、
 *   画面が見えていないあいだ止まるのは、むしろ正しい。
 *   **止まったまま終わらない、ということは無い** ——
 *   `t >= ms` で必ず終わりの値に落ちる。
 * ============================================================================
 */
import { useEffect, useRef, useState } from 'react'
import { countUpAt, motionMs, motionOff } from './motion.js'

/**
 * @param {number} to  最後の数
 * @param {string} [kind] 動きの段(`motion.js` の `MOTION_MS`)
 * @returns {number} いま見せる数
 */
export function useCountUp(to, kind = 'cheer') {
  const 数 = Number(to)
  const 数である = Number.isFinite(数)
  /* **動かさないなら、最初から終わりの値。** 0 から数えて見せない */
  const [now, setNow] = useState(() => (数である && !motionOff() ? 0 : 数))
  /* いちばん新しい値を、時計の中から読むための控え */
  const 的 = useRef(数)
  的.current = 数

  useEffect(() => {
    if (!数である) { setNow(数); return undefined }
    const ms = motionMs(kind)
    if (!(ms > 0)) { setNow(数); return undefined }
    let 生きている = true
    const 始め = (typeof performance !== 'undefined' ? performance.now() : Date.now())
    const 歩く = () => {
      if (!生きている) return
      const t = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - 始め
      setNow(countUpAt(的.current, ms, t))
      if (t < ms) requestAnimationFrame(歩く)
    }
    requestAnimationFrame(歩く)
    return () => { 生きている = false }
  }, [数, 数である, kind])

  return now
}
