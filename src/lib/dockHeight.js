/**
 * **画面の下の黒帯の高さを、そのまま CSS へ流し込む**(第5.316節)。
 *
 * ============================================================================
 * 【なぜ要るか — 決め打ちは、必ず食い違う】
 *
 *   2026-09-30 実機・利用者の指摘。
 *
 *     > プレーヤーが本文に重ならないよう、スクロール領域にも
 *     > 必要な余白を確保してください。
 *
 *   紙の下余白は **`72px` の決め打ち**だった。ところが黒帯は段が増えて
 *   **実測 118px** になっており、**本文の最後が黒帯に隠れて読めなかった。**
 *   紙は送れる箱なので、いちばん下まで送っても出てこない。
 *
 *   **段の数も、ボタンの大きさも、端末のセーフエリアも変わる。**
 *   そのたびに余白の数を直すことはできない —— 直し忘れるからである
 *   (**呼び名・値を2か所に書かない**・CLAUDE.md)。
 *
 * 【どうしたか】
 *   黒帯そのものを測って `--dock-h` に入れる。余白はそれを読む。
 *   **セーフエリアのぶんも、測った高さに入っている**
 *   (`.player-dock` が `env(safe-area-inset-bottom)` を padding に持つ)ので、
 *   読む側で足し直さない。**二重に足すと、そのぶん白い帯ができる。**
 *
 * 【消すときも忘れない】
 *   黒帯を出さない画面に移ったら、**変数ごと外す。**
 *   残すと、黒帯が無いのに紙の下だけ空く。
 */
import { useLayoutEffect } from 'react'

/** CSS から読む名前。**1か所**(styles.css も、この名前を読む) */
export const DOCK_VAR = '--dock-h'

/**
 * @param ref 黒帯(`.player-dock`)。`null` のときは変数を外す
 */
export function useDockHeight(ref) {
  useLayoutEffect(() => {
    const root = document.documentElement
    const el = ref?.current
    if (!el) {
      root.style.removeProperty(DOCK_VAR)
      return undefined
    }
    /* **切り上げる。** 端数を切り捨てると 1px だけ本文がかぶる */
    const put = () => {
      const h = Math.ceil(el.getBoundingClientRect().height)
      if (h > 0) root.style.setProperty(DOCK_VAR, `${h}px`)
    }
    put()
    // `window.` を付けて呼ぶ(`fitRow.js` / `InkLayer` と同じ作法)
    const RO = window.ResizeObserver
    let ro = null
    if (typeof RO === 'function') { ro = new RO(put); ro.observe(el) }
    window.addEventListener('resize', put)
    return () => {
      ro?.disconnect()
      window.removeEventListener('resize', put)
      root.style.removeProperty(DOCK_VAR)
    }
  })
}
