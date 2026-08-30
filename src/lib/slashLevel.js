import { useSyncExternalStore } from 'react'

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

/**
 * 6Steps の「やり方」を開いているか。
 * **一度読めば、しばらく要らない。** 毎回たたみ直させない。
 */
const GUIDE_KEY = 'eas.stepGuide'

export function loadGuideOpen() {
  try { return localStorage.getItem(GUIDE_KEY) !== 'closed' } catch { return true }
}

export function saveGuideOpen(open) {
  try { localStorage.setItem(GUIDE_KEY, open ? 'open' : 'closed') } catch { /* 使えなくても困らない */ }
}

/** ② の単位。段落ごと(`para`)か、本文まるごと(`whole`)か */
const UNIT_KEY = 'eas.slashUnit'
export function loadSlashUnit() {
  try { return localStorage.getItem(UNIT_KEY) || 'para' } catch { return 'para' }
}
export function saveSlashUnit(id) {
  try { localStorage.setItem(UNIT_KEY, id) } catch { /* 使えなくても困らない */ }
}

/** ① ディクテーションの難易度(一度に書き取る文の数) */
const DICT_KEY = 'eas.dictSize'
export function loadDictSize() {
  try { return Number(localStorage.getItem(DICT_KEY)) || 1 } catch { return 1 }
}
export function saveDictSize(n) {
  try { localStorage.setItem(DICT_KEY, String(n)) } catch { /* 使えなくても困らない */ }
}

/**
 * ② の「カタマリの訳を出す」(0021)。
 * **一度決める設定は覚える。** 自分で言えるか試すときは消し、
 * 確かめるときは出す、という使い分けを毎回やり直させない。
 */
const CHUNK_JA_KEY = 'eas.chunkJa'
export function loadChunkJa() {
  try { return localStorage.getItem(CHUNK_JA_KEY) !== 'off' } catch { return true }
}
export function saveChunkJa(on) {
  try { localStorage.setItem(CHUNK_JA_KEY, on ? 'on' : 'off') } catch { /* 使えなくても困らない */ }
}

/**
 * 狭い画面(スマホ)で、カタマリの**英語と訳のどちらを出すか**。
 *
 * > スマホの時は日本語と英語は切り替え表示、同じ位置になるようにしてください。
 * > 無理して両方見せても窮屈に感じますね。
 * >                                        ── 2026-08 利用者の指定
 *
 * 広い画面では英語の下に訳を並べる。狭い画面では**1カタマリで1行を
 * 使い切る**ので、上下に並べると行数が倍になり、窮屈で読みづらい。
 * そこで**同じ場所で入れ替える。**
 *
 * 【なぜモジュールに置くのか】
 *   カタマリは1画面にいくつも出る(段落ごと・発言ごと)。
 *   部品ごとに状態を持つと、**1つ切り替えても他が付いてこない。**
 *   ひとつの値をみんなで見て、切り替えたら**全部が一度に変わる**ようにする。
 */
const SIDE_KEY = 'eas.chunkSide'

const readSide = () => {
  try { return localStorage.getItem(SIDE_KEY) === 'ja' ? 'ja' : 'en' } catch { return 'en' }
}

let side = readSide()
const listeners = new Set()

/** いまどちらを出しているか。`'en'` か `'ja'` */
export const getChunkSide = () => side

export function setChunkSide(next) {
  side = next === 'ja' ? 'ja' : 'en'
  try { localStorage.setItem(SIDE_KEY, side) } catch { /* 使えなくても困らない */ }
  listeners.forEach((fn) => fn())
}

function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** いまどちらを出しているかを見る。**切り替えたら、画面中が一度に変わる** */
export function useChunkSide() {
  return useSyncExternalStore(subscribe, getChunkSide, getChunkSide)
}

/**
 * ここより狭ければ「切り替え表示」にする。
 * **判断は幅だけ**(`useWide()` と同じ考え方。UA も `pointer` も見ない)。
 */
export const NARROW_AT = 860
