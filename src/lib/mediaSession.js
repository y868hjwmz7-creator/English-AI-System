/**
 * **端末に「いま音楽を鳴らしている」と伝える**
 * (第5.285節・2026-09-27 実機・利用者の指定)。
 *
 *   > ポケットにスマホを入れたまま聞き流せるように直してください。
 *   > これは全ての機能で同じ仕様にしておきたいです。
 *
 * 【なぜ要るか】
 *   画面を消したとき、iPhone は**音を鳴らしているページだけ**を生かす。
 *   その判断の手がかりが `navigator.mediaSession` である ——
 *   題を入れておくと、**ロック画面に操作の帯が出る**(曲名と ▶ ⏭)。
 *   出ていれば、端末は「これは止めてはいけない音だ」と扱う。
 *
 * 【ここに置く理由】
 *   **呼ぶのは1か所だけ**(`audioClips.js` の鳴らす道)。
 *   画面の中で `navigator.mediaSession` を直に触らない ——
 *   触る場所の数だけ、入れ忘れと消し忘れが出る(CLAUDE.md)。
 *
 * 【無い端末でも落ちない】
 *   `mediaSession` はパソコンの一部のブラウザに無い。
 *   **無ければ何もしない**(既定は「何も起きない」側)。
 */

const ok = () => typeof navigator !== 'undefined' && 'mediaSession' in navigator

/** いま何を鳴らしているか(題・冊の名前)。**覚えるのはここだけ** */
let now = { title: '', album: '' }

/** いま入れてある操作(止める・次へ・前へ)。画面が入れ替えたら差し替える */
let acts = {}

/**
 * 何を鳴らしているかを決める。**鳴らす前に呼ぶ。**
 * 題は画面に出ているものをそのまま渡す(**書き写さない**)。
 */
export function setNowPlaying({ title = '', album = '' } = {}) {
  now = { title: String(title || ''), album: String(album || '') }
  /* すでに帯が出ているなら、その場で書き替える(次の1本を待たない) */
  if (ok() && navigator.mediaSession.metadata) apply()
}

/**
 * いま覚えている題(検証と、画面から確かめるため)。
 *
 * **`nowPlaying` という名前は使えない。** `playMark.js` に
 * 「いま何段落目の何秒めか」を覚える `nowPlaying()` がすでにある ——
 * **違うものに同じ名前を付けない**(`.claude/rules/common.md`)。
 */
export const nowShown = () => now

function apply() {
  if (!ok()) return
  try {
    const M = window.MediaMetadata
    if (!M) return
    navigator.mediaSession.metadata = new M({
      /* **題が無いときも、空では出さない。** ロック画面に
         名前のない帯が出ると、何の音か分からない */
      title: now.title || '英語の練習',
      artist: now.album || '',
      album: now.album || '',
    })
  } catch { /* 入れられなくても、音そのものは鳴る */ }
}

/** 鳴り始めた。**帯を出す** */
export function showPlaying() {
  if (!ok()) return
  apply()
  try { navigator.mediaSession.playbackState = 'playing' } catch { /* 無視 */ }
}

/** 止まった(一時停止)。**帯は残す** —— 続きから鳴らせるようにする */
export function showPaused() {
  if (!ok()) return
  try { navigator.mediaSession.playbackState = 'paused' } catch { /* 無視 */ }
}

/** 終わった。**帯ごと片づける**(ロック画面に残り続けない) */
export function clearNowPlaying() {
  if (!ok()) return
  try {
    navigator.mediaSession.playbackState = 'none'
    navigator.mediaSession.metadata = null
  } catch { /* 無視 */ }
}

/**
 * ロック画面の操作を受け取る。
 *
 * **渡されなかったものは外す** —— 効かないボタンを出さない(CLAUDE.md)。
 * 画面を閉じるときは `setMediaActions({})` で全部外すこと。
 */
export function setMediaActions({
  onPlay = null, onPause = null, onStop = null, onNext = null, onPrev = null,
} = {}) {
  acts = { onPlay, onPause, onStop, onNext, onPrev }
  if (!ok()) return
  const 入れる = (name, fn) => {
    try { navigator.mediaSession.setActionHandler(name, fn ?? null) } catch { /* 無い操作は無視 */ }
  }
  入れる('play', onPlay)
  入れる('pause', onPause)
  入れる('stop', onStop)
  入れる('nexttrack', onNext)
  入れる('previoustrack', onPrev)
}

/** いま入れてある操作(検証のため) */
export const mediaActions = () => acts
