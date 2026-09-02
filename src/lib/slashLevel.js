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

/* ② の「カタマリの訳を出す」(`eas.chunkJa`)は**やめた**(2026-08)。
   ② は自分で区切って「この区切りで訳を出す」を押す形になり、
   出す / 出さないはその1つのボタンで足りる。
   **同じことをする操作を3つ置かない。** */

/**
 * 教材の「条件で絞り込む」を開いているか(2026-08 利用者の指定)。
 * **一度決める設定は覚える。** 絞り込みは毎回触るものではない。
 *
 * 【はじめは閉じておく】(2026-09 利用者の指定)
 *
 *   > 「条件で絞り込む」は最初は閉じておいてください
 *
 *   欄が5つ縦に並ぶので、開いたままだと**教材が1件も見えない。**
 *   まず一覧を見せ、絞りたい人だけが開く。
 *
 * **鍵の名前を変えてある**(`eas.materialSearch` → `eas.finderFilters`)。
 * 前の鍵には「開いている」が入ったままの端末があり、
 * 名前を変えないと**その人だけ開いたまま**になる。
 */
const SEARCH_KEY = 'eas.finderFilters'
export function loadSearchOpen() {
  try { return localStorage.getItem(SEARCH_KEY) === 'open' } catch { return false }
}
export function saveSearchOpen(open) {
  try { localStorage.setItem(SEARCH_KEY, open ? 'open' : 'closed') } catch { /* 使えなくても困らない */ }
}

/**
 * ゲストの「過去の宿題」のしぼり込みを開いているか(2026-08 利用者の指定)。
 *
 * **教材の欄(`eas.materialSearch`)とは別に覚える。**
 * 別の画面の別の欄なので、片方を閉じてもう片方まで閉じては困る。
 */
const PAST_KEY = 'eas.pastFilter'
export function loadPastFilterOpen() {
  try { return localStorage.getItem(PAST_KEY) === 'open' } catch { return false }
}
export function savePastFilterOpen(open) {
  try { localStorage.setItem(PAST_KEY, open ? 'open' : 'closed') } catch { /* 使えなくても困らない */ }
}
