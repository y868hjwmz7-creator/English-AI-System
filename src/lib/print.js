/**
 * 画面の一部だけを印刷する(PDF で保存もできる)。
 *
 * 【なぜ別窓を開かないか】
 *   新しい窓を開く方式は、iPhone では止められることがある。
 *   利用者は会社の PC にアプリを入れられず、スマホも使う前提なので
 *   (仕様書 第1.2節)、**いまの画面のまま印刷する**方式にした。
 *
 * 【やっていること】
 *   紙に出したい部分に印(`print-target`)を付け、
 *   **body からそこまでの「道筋」にも印(`print-path`)を付ける。**
 *   印刷用の指定(styles.css の @media print)が、
 *   ①道筋から外れたものを消し ②道筋を「ただの入れ物」に戻す。
 *   印刷が終わったら、付けた印を全部外す。
 *
 * 【なぜ「道筋」に印が要るのか】(2026-09 実機)
 *
 *   > とりあえず印刷しようとするとデザインがずれまくってる
 *
 *   以前は「他を `visibility: hidden` で隠し、出す部分を
 *   `position: absolute` で紙の左上に置く」やり方だった。
 *
 *   ・`visibility: hidden` は**場所を空けたまま**なので、
 *     隠したものの高さがそっくり紙に残る(白いページが増える)
 *   ・**位置を動かした箱は、ページの区切りをまたげない。**
 *     2ページ目から先で見出しの上に本文が重なり、
 *     語(`<button>`)だけが消えて句読点だけが宙に浮いていた
 *   ・レッスン表示の紙は `overflow-y: auto` の「中で送る箱」なので、
 *     そのまま刷ると画面に見えているぶんしか正しく出ない
 *
 *   道筋に印を付ければ、外れたものは**場所ごと**消せる。
 *   中身はふつうの流れのまま並ぶので、**ページの区切りは
 *   ブラウザが正しく決められる。**
 */
export function printElement(element, { worksheet = false } = {}) {
  if (!element) return
  const body = document.body
  element.classList.add('print-target')
  // 書き込む用紙(ゲスト用)は、設問のあとに記入欄を出す
  if (worksheet) element.classList.add('print-worksheet')
  body.classList.add('is-printing')

  // body から、出したい部分の**すぐ上まで**に印を付ける。
  // 出したい部分そのものには付けない(付けると、その中身まで消えてしまう)
  const path = []
  for (let el = element.parentElement; el && el !== body; el = el.parentElement) {
    el.classList.add('print-path')
    path.push(el)
  }

  let done = false
  const cleanup = () => {
    if (done) return
    done = true
    element.classList.remove('print-target', 'print-worksheet')
    for (const el of path) el.classList.remove('print-path')
    body.classList.remove('is-printing')
    window.removeEventListener('afterprint', cleanup)
  }
  window.addEventListener('afterprint', cleanup)

  // Safari は afterprint を返さないことがある。念のため時間でも戻す。
  window.setTimeout(cleanup, 60000)

  window.print()
}
