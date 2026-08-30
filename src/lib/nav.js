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

/** ここより広ければ、メニューは画面を押し出して並ぶ(PC) */
export const WIDE_AT = 1024

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
