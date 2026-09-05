/**
 * **1行に収まるまで、順に詰める**(2026-09 利用者の指定)。
 *
 *   > レスポンシブに幅に収まるように
 *
 * ============================================================================
 * 【なぜ「幅の境目」ではだめだったのか】
 *
 *   集中モードの下の帯は、決め打ちの境目(560 / 480 / 400 / 370px)で
 *   言葉を落としていた。ところが**境目のあいだが、いちばん危ない。**
 *   実際、375px(iPhone SE)だけ余りが 8px しか残っていなかった
 *   (360px 以下でしか詰めていなかったため)。
 *
 *   しかも**幅だけでは決まらないものが3つある。**
 *
 *   | 何 | なぜ幅では分からないか |
 *   |---|---|
 *   | 端末の「表示を大きく」 | 同じ 390px でも文字が 1.25 倍になる |
 *   | 端末ごとの字形 | iPhone の Safari と Chromium で幅が違う |
 *   | 中身そのもの | 最後の段落だけ「次 ▶」が**「まとめ」**に変わる |
 *
 *   だから**幅から当てるのをやめて、実際に入ったかどうかを測る。**
 *   これは「実測でしか見つからない」(CLAUDE.md)を、検証だけでなく
 *   **動いている画面の側にも当てはめたもの**である。
 *
 * 【やり方】
 *
 *   ①いったん全部の印を外して、素の姿に戻す
 *   ②あふれているあいだ、印を1つずつ足す(足すたびに測り直す)
 *   ③入ったら止める
 *
 *   **印は「何を削るか」だけを決め、削り方は CSS が持つ。**
 *   ここに px を書かない(色や余白の値をコードに書かないのと同じ)。
 *
 * 【気をつけたこと】
 *
 *   - **見張るのは親のほう。** 自分を見張ると、印が余白を変える →
 *     幅が変わる → 測り直す → 印を外す … と**行ったり来たり**になる
 *   - **描き直すたびに測る。** 中身が変わる(Listen ⇄ Stop、
 *     次 ▶ ⇄ まとめ、訳を見る が出たり消えたり)ので、
 *     幅が同じでも入るかどうかは変わる
 *   - **足すのは3つまで。** それでも入らないなら、あふれたままにする。
 *     **言葉を削り続けて、何のボタンか分からなくするほうが悪い**
 */
import { useLayoutEffect } from 'react'

/** 詰める段。**順に足す。** 何を削るかは `styles.css` が持つ */
export const FIT_STAGES = ['is-fit1', 'is-fit2', 'is-fit3']

/** その箱(と直の子)が、幅からあふれているか */
function over(row) {
  if (row.scrollWidth > row.clientWidth + 1) return true
  for (const kid of row.children) {
    if (kid.scrollWidth > kid.clientWidth + 1) return true
  }
  return false
}

/**
 * 入るまで印を足す。**足した数**を返す(0 なら素のまま入っている)。
 * 素の node からも呼べるように、React には依存させていない。
 */
export function fitRow(row, stages = FIT_STAGES) {
  if (!row || typeof row.getBoundingClientRect !== 'function') return 0
  // ① まず素の姿に戻す。**戻さないと、広げたときに縮んだままになる**
  for (const c of stages) row.classList.remove(c)
  // ② 入るまで1つずつ
  let n = 0
  while (n < stages.length && over(row)) {
    row.classList.add(stages[n])
    n += 1
  }
  return n
}

/**
 * 描き直すたび・幅が変わるたびに測り直す。
 * @param ref    その帯(`.focus-bar` など)
 * @param stages 印の並び
 */
export function useFitRow(ref, stages = FIT_STAGES) {
  // **描き直すたびに走らせる**(見張りに何も渡さない)。
  // 中身が変わると、幅が同じでも入るかどうかが変わるためである
  useLayoutEffect(() => {
    const row = ref.current
    if (!row) return undefined

    // 目に映る前に1回(`useLayoutEffect` なので、ここは描く前である)
    fitRow(row, stages)

    let raf = 0
    const ask = () => {
      if (raf) return
      raf = requestAnimationFrame(() => { raf = 0; fitRow(row, stages) })
    }
    // **親を見張る。** 自分を見張ると、印が余白を変えて行ったり来たりする
    const watch = row.parentElement || row
    // `window.` を付けて呼ぶ(`InkLayer` / `GlossPopover` と同じ作法)
    const RO = window.ResizeObserver
    let ro = null
    if (typeof RO === 'function') {
      ro = new RO(ask)
      ro.observe(watch)
    }
    window.addEventListener('resize', ask)
    // 字が読み込まれると幅が変わる(端末の既定の字と、あとから来る字)
    document.fonts?.ready?.then?.(ask)?.catch?.(() => {})

    return () => {
      if (raf) cancelAnimationFrame(raf)
      ro?.disconnect()
      window.removeEventListener('resize', ask)
    }
  })
}
