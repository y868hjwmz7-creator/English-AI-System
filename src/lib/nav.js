/**
 * 左のメニュー(サイドメニュー)の開け閉めを覚えておく。
 *
 * 【なぜ覚えるのか】
 *   「一度決める設定は覚える」は、レッスン表示の文字の大きさで
 *   一度学んだことである(第5.25節)。毎回たたみ直すのでは、
 *   たためる意味がない。
 *
 * 【なぜ幅だけで決めるのか】
 *   端末の種類は当て推量しない。UA も `pointer` も見ず、
 *   **見えている幅だけ**で「押し出す(PC)」か「かぶせる(スマホ・パッド)」かを
 *   決める。横向きにすれば広い扱いになるのも素直である
 *   (`.etext-pop` や レッスン表示の操作欄と同じ考え方)。
 */
import { useEffect, useState } from 'react'

/** ここより広ければ、メニューは名前つきで開いたままにできる(PC) */
export const WIDE_AT = 1024

/**
 * ここより広ければ、メニューは**かぶせず、画面を押し出して並ぶ。**
 *
 * 【なぜ 768 を足したか】(2026-09・第3週)
 *   実測すると、768〜1023px(パッドの縦向き)では
 *   **メニューが丸ごと隠れていた。** 1024px 未満はすべて「スマホと同じ」
 *   扱いだったためである。ところがパッドには **68px の細い柱を置く幅が
 *   十分にある**(768px なら残り 700px)。
 *   隠すと、画面を移るたびに ☰ を押すことになる。
 *
 * 【広さで3段になる】
 *   1024px 以上 … 名前つきで並ぶ(たたんだかどうかを覚える)
 *   768〜1023px … **絵だけの細い柱。押すと名前が出る**(覚えない)
 *   768px 未満  … 隠れていて、☰ でかぶせて開く(これまでどおり)
 *
 * **`WIDE_AT` は動かさない。** あちらは語のタップ・集中モードの帯など
 * **メニュー以外**も見ている値である(`useWide()` の既定)。
 */
export const NAV_PUSH_AT = 768

const KEY = 'eas.navOpen'

/** たたんでいたかどうかを読む。既定は「開いている」 */
export function loadNavOpen() {
  try { return localStorage.getItem(KEY) !== 'closed' } catch { return true }
}

export function saveNavOpen(open) {
  try { localStorage.setItem(KEY, open ? 'open' : 'closed') } catch { /* 使えなくても困らない */ }
}

/**
 * いま「広い画面」かどうか。**幅が変わったら追いかける。**
 * パッドを横向きにした瞬間に PC の形へ変わってほしい。
 */
export function useWide(px = WIDE_AT) {
  const query = `(min-width: ${px}px)`
  const [wide, setWide] = useState(
    () => (typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia(query).matches : true),
  )
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined
    const mq = window.matchMedia(query)
    const on = (e) => setWide(e.matches)
    setWide(mq.matches)
    // Safari の古い版は addEventListener を持たない
    if (mq.addEventListener) { mq.addEventListener('change', on); return () => mq.removeEventListener('change', on) }
    mq.addListener(on)
    return () => mq.removeListener(on)
  }, [query])
  return wide
}

/* ── 試作版の断り書き ─────────────────────────────────────────
   どの画面にも出るものなので、閉じられるようにして覚えておく。
   **消すのではなく、たたむ。** 読みたくなったときに開ける道を残す。 */
const NOTICE_KEY = 'eas.noticeOpen'

export function loadNoticeOpen() {
  try { return localStorage.getItem(NOTICE_KEY) !== 'closed' } catch { return true }
}

export function saveNoticeOpen(open) {
  try { localStorage.setItem(NOTICE_KEY, open ? 'open' : 'closed') } catch { /* 使えなくても困らない */ }
}
