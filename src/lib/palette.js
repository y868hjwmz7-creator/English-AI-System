/**
 * 色づかいの切り替え — プレイン / カラー。
 *
 * 【なぜ2通り要るのか】(2026-08 利用者の指定)
 *   種類ごとに色を付けると、訳・解答・補足が見分けやすくなる。
 *   その一方で、**色が多いほうが疲れる**という感じ方もある。
 *   どちらが良いかは人と場面で変わるので、選べるようにする。
 *
 *     plain … 黒とグレーだけ(色を足す前の見え方)
 *     color … 種類ごとに色を付ける(既定)
 *
 * 【明るい / 暗い とは別のものである】
 *   `theme.js` は**地の明るさ**を選ぶ。ここは**色を使うかどうか**を選ぶ。
 *   組み合わせは 3 × 2 = 6 通りになる。混ぜないこと。
 *
 * 色そのものは styles.css にある。ここは「どれを選んだか」を覚えて、
 * `<html>` に `data-palette` を付けるだけ。
 */
const KEY = 'english-ai-palette'

export const PALETTES = [
  { id: 'color', label: 'カラー', hint: '種類ごとに色を付けます(訳・解答・補足)' },
  { id: 'plain', label: 'プレイン', hint: '黒とグレーだけ。色を使いません' },
]

/** いま選ばれているもの。読めなければ「カラー」 */
export function loadPalette() {
  try {
    const saved = window.localStorage.getItem(KEY)
    return PALETTES.some((p) => p.id === saved) ? saved : 'color'
  } catch {
    // 端末の設定で保存が禁じられていることがある。既定に戻すだけでよい
    return 'color'
  }
}

/** 選んだものを覚えて、画面に反映する */
export function applyPalette(palette) {
  const root = document.documentElement
  // 既定(カラー)のときは印を付けない。**印が付いているときだけ色を消す**
  // という書き方にしておくと、色の定義を1か所も書き直さずに済む
  if (palette === 'plain') root.setAttribute('data-palette', 'plain')
  else root.removeAttribute('data-palette')
  try { window.localStorage.setItem(KEY, palette) } catch { /* 保存できなくても動く */ }
}
