/**
 * 画面の一部だけを印刷する(PDF で保存もできる)。
 *
 * 【なぜ別窓を開かないか】
 *   新しい窓を開く方式は、iPhone では止められることがある。
 *   利用者は会社の PC にアプリを入れられず、スマホも使う前提なので
 *   (仕様書 第1.2節)、**いまの画面のまま印刷する**方式にした。
 *
 * 【やっていること】
 *   印刷したい部分に印を付け、body にも印を付ける。
 *   印刷用の指定(styles.css の @media print)が、印の付いた部分以外を
 *   隠す。印刷が終わったら印を外す。
 */
export function printElement(element, { worksheet = false } = {}) {
  if (!element) return
  const body = document.body
  element.classList.add('print-target')
  // 書き込む用紙(ゲスト用)は、設問のあとに記入欄を出す
  if (worksheet) element.classList.add('print-worksheet')
  body.classList.add('is-printing')

  const cleanup = () => {
    element.classList.remove('print-target', 'print-worksheet')
    body.classList.remove('is-printing')
    window.removeEventListener('afterprint', cleanup)
  }
  window.addEventListener('afterprint', cleanup)

  // Safari は afterprint を返さないことがある。念のため時間でも戻す。
  window.setTimeout(cleanup, 60000)

  window.print()
}
