/**
 * スラッシュリーディング(②)の細かさを覚えておく。
 *
 * **一度決める設定は覚える。** 開くたびに選び直すのでは、
 * そのために操作欄を触ることになる(レッスン表示の文字の大きさで
 * 一度学んだこと・第5.25節)。
 */
const KEY = 'eas.slashLevel'

export function loadSlashLevel() {
  try { return localStorage.getItem(KEY) || 'beginner' } catch { return 'beginner' }
}

export function saveSlashLevel(id) {
  try { localStorage.setItem(KEY, id) } catch { /* 使えなくても困らない */ }
}
