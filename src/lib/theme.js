/**
 * 明るい / 暗い の切り替え。
 *
 * 色の定義そのものは styles.css にある(:root と data-theme="dark")。
 * ここは「どれを選んだか」を覚えて、`<html>` に印を付けるだけ。
 *
 * 3通りある:
 *   auto  … 端末の設定に従う(既定)
 *   light … いつも明るい
 *   dark  … いつも暗い
 *
 * レッスン中の画面共有では明るいほうが見やすく、夜の自習では暗いほうが
 * 目が楽である。**どちらが良いかは場面によるので、選べるようにする。**
 */
const KEY = 'english-ai-theme'

export const THEMES = [
  { id: 'auto',  label: '自動', hint: '端末の設定に合わせます' },
  { id: 'light', label: '明るい', hint: 'いつも明るい配色' },
  { id: 'dark',  label: '暗い', hint: 'いつも暗い配色' },
]

/** いま選ばれているもの。読めなければ「自動」 */
export function loadTheme() {
  try {
    const saved = window.localStorage.getItem(KEY)
    return THEMES.some((t) => t.id === saved) ? saved : 'auto'
  } catch {
    // 端末の設定で保存が禁じられていることがある。既定に戻すだけでよい
    return 'auto'
  }
}

/** 選んだものを覚えて、画面に反映する */
export function applyTheme(theme) {
  const root = document.documentElement
  if (theme === 'auto') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', theme)
  try { window.localStorage.setItem(KEY, theme) } catch { /* 保存できなくても動く */ }
}
