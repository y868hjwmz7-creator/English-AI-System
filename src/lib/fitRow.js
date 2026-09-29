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
 *   - **足すのは `FIT_STAGES` の数まで。** それでも入らないなら、
 *     あふれたままにする。**言葉を削り続けて、何のボタンか
 *     分からなくするほうが悪い**
 *   - **「ぴったり入った」を、入ったと数えない**(第5.316節)。
 *     余りが 0 のまま出すと、**字形が少し違う端末で折り返す。**
 *     `overWrapping()` は `>=` で見ているので、ぴったりは「入っていない」
 */
import { useLayoutEffect } from 'react'

/**
 * 詰める段。**順に足す。** 何を削るかは `styles.css` が持つ。
 *
 * ★ **4つめを足した**(2026-09-30 実機・第5.316節)。
 *   3つめまで詰めても、iPhone の Safari(ページのズームが 100% でない ——
 *   **CSS 上の画面幅が狭くなる**)では入りきらず、**設定の絵だけが
 *   次の段へ落ちていた。** Chromium で測ると 345px のとき
 *   **余りがちょうど 0px** で、字形がほんの少し広いだけで折り返す。
 *   **「入っているが、余りが 0」は、入っていないのと同じ**である。
 */
export const FIT_STAGES = ['is-fit1', 'is-fit2', 'is-fit3', 'is-fit4']

/** その箱(と直の子)が、幅からあふれているか */
export function over(row) {
  if (row.scrollWidth > row.clientWidth + 1) return true
  for (const kid of row.children) {
    if (kid.scrollWidth > kid.clientWidth + 1) return true
  }
  return false
}

/**
 * **折り返す帯を測るための印。** `styles.css` がこの印のあいだだけ
 * `flex-wrap: nowrap` にする。
 *
 * 【なぜ要るのか】
 *   `over()` は `scrollWidth` を見ている。ところが**折り返す箱は
 *   あふれない** —— 入らなかったぶんは2段目へ落ちるだけなので、
 *   `scrollWidth` は `clientWidth` のままである。
 *   だから**測るあいだだけ折り返しを止めて**、あふれさせて測る。
 *   (`InkLayer` が測るあいだ自分を消すのと同じ考え方。)
 */
const MEASURING = 'is-measuring-row'

/**
 * **必ず残す余り(px)。**(2026-09-30 実機・第5.316節)
 *
 * これまでは「1px でも入っていれば入った」と数えていた。実測すると、
 * どの幅でも**余りがちょうど 0〜1px** で止まっていた ——
 * `fitRow()` は入った瞬間に手を止めるので、当然そうなる。
 *
 * ところが**同じ CSS でも、端末が変われば行の幅は変わる。**
 * 字形(iPhone はヒラギノ・この環境は Noto)も、
 * 太字の出かたも、丸めも違う。**余りが 0 なら、その差だけで折り返す。**
 * 実際そうなっていた —— iPhone の Safari で設定の絵だけが次の段へ落ち、
 * Chrome では落ちなかった(利用者の写真)。
 *
 * **iOS の字形は、この環境では1度も測れない。**
 * だから「測って合わせる」ことはできない。**余りを取っておく**ほうを選ぶ。
 * 8px は、絵だけのボタン1つ(32px)の 1/4 —— これ以上広げると、
 * 詰める必要のない幅まで詰まってしまう。
 */
export const FIT_SLACK = 8

/**
 * 折り返す帯が、1行に収まっていないか。
 *
 * **`scrollWidth` では見分けられない**(実測)。`clientWidth` には
 * 左右の余白が**両方**入るのに、`scrollWidth` には**左しか**入らない。
 * そのぶん(右の余白)だけ、あふれを見落とす。
 * だから**子の右端**が、余白の内側からはみ出していないかを見る。
 */
export function overWrapping(row, slack = FIT_SLACK) {
  row.classList.add(MEASURING)
  const r = row.getBoundingClientRect()
  const cs = window.getComputedStyle(row)
  const edge = r.right
    - (parseFloat(cs.paddingRight) || 0)
    - (parseFloat(cs.borderRightWidth) || 0)
  let bad = false
  for (const kid of row.children) {
    const k = kid.getBoundingClientRect()
    if (!k.width && !k.height) continue
    /* **ぴったりは「入っていない」と見る。** 端数の丸めで折り返すため
       (実測。900px で「1px 入る」と読んだのに2行になっていた)。
       ★ さらに `slack` のぶん手前で「入っていない」と見る ——
         **余りが 0 の行は、字形の違う端末で必ず折り返す**(第5.316節) */
    if (k.right >= edge - slack) { bad = true; break }
  }
  row.classList.remove(MEASURING)
  return bad
}

/**
 * 入るまで印を足す。**足した数**を返す(0 なら素のまま入っている)。
 * 素の node からも呼べるように、React には依存させていない。
 *
 * @param isOver あふれているかの見方。折り返す帯には `overWrapping` を渡す
 */
export function fitRow(row, stages = FIT_STAGES, isOver = over) {
  if (!row || typeof row.getBoundingClientRect !== 'function') return 0
  // ① まず素の姿に戻す。**戻さないと、広げたときに縮んだままになる**
  for (const c of stages) row.classList.remove(c)
  // ② 入るまで1つずつ
  let n = 0
  while (n < stages.length && isOver(row)) {
    row.classList.add(stages[n])
    n += 1
  }
  return n
}

/**
 * 描き直すたび・幅が変わるたびに測り直す。
 * @param ref    その帯(`.focus-bar` など)
 * @param stages 印の並び
 * @param isOver あふれているかの見方(折り返す帯は `overWrapping`)
 */
export function useFitRow(ref, stages = FIT_STAGES, isOver = over) {
  // **描き直すたびに走らせる**(見張りに何も渡さない)。
  // 中身が変わると、幅が同じでも入るかどうかが変わるためである
  useLayoutEffect(() => {
    const row = ref.current
    if (!row) return undefined

    // 目に映る前に1回(`useLayoutEffect` なので、ここは描く前である)
    fitRow(row, stages, isOver)

    let raf = 0
    const ask = () => {
      if (raf) return
      raf = requestAnimationFrame(() => { raf = 0; fitRow(row, stages, isOver) })
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
