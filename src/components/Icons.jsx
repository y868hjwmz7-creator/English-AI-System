/**
 * 画面で使う小さな絵(アイコン)。
 *
 * 【なぜ絵文字をやめたか】
 *   🔊 のような絵文字は、**端末ごとに形も色もばらばら**で、
 *   周りの文字と大きさも揃わない。並べたときに揃って見えない
 *   (2026-08 の指摘)。線で描いた絵にすると、どの端末でも同じ形になり、
 *   `currentColor` で文字と同じ色になるので、暗い配色でも紙の上でも
 *   そのまま馴染む。
 *
 *   大きさは `1em`。**文字に合わせて拡大縮小する。**
 *   レッスン表示では文字を3段階に変えられるので、固定の px にすると
 *   特大のときに絵だけ小さく取り残される。
 */

/** スピーカー。お手本の読み上げ */
export function SpeakerIcon({ className = 'icon' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M4 8h3l4-3.5v11L7 12H4z" fill="currentColor" />
      <path d="M13.5 7.5a3.5 3.5 0 0 1 0 5" fill="none" stroke="currentColor"
            strokeWidth="1.6" strokeLinecap="round" />
      <path d="M15.8 5.2a6.5 6.5 0 0 1 0 9.6" fill="none" stroke="currentColor"
            strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

/** マイク。自分の録音 */
export function MicIcon({ className = 'icon' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <rect x="7.5" y="2.5" width="5" height="9" rx="2.5" fill="currentColor" />
      <path d="M4.8 9.5a5.2 5.2 0 0 0 10.4 0" fill="none" stroke="currentColor"
            strokeWidth="1.6" strokeLinecap="round" />
      <path d="M10 14.7v2.8" fill="none" stroke="currentColor"
            strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

/** 停止 */
export function StopIcon({ className = 'icon' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <rect x="5.5" y="5.5" width="9" height="9" rx="1.6" fill="currentColor" />
    </svg>
  )
}

/** 画面(レッスンで大きく表示する) */
export function ScreenIcon({ className = 'icon' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <rect x="2.2" y="3.5" width="15.6" height="10.5" rx="1.8" fill="none"
            stroke="currentColor" strokeWidth="1.5" />
      <path d="M7 17h6" fill="none" stroke="currentColor"
            strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

/** 印刷 */
export function PrintIcon({ className = 'icon' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M6 7V3h8v4" fill="none" stroke="currentColor"
            strokeWidth="1.5" strokeLinejoin="round" />
      <rect x="2.5" y="7" width="15" height="7" rx="1.6" fill="none"
            stroke="currentColor" strokeWidth="1.5" />
      <rect x="6" y="12" width="8" height="5" rx="1" fill="none"
            stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

/**
 * 表示の設定(歯車)。
 * 狭い画面で、めったに触らない設定をしまっておく札に使う。
 * 大きさは `1em`。**px で固定しない**(レッスン表示は文字を3段階に変える)。
 */
export function GearIcon({ className = 'icon' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <circle cx="10" cy="10" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 2.4v2.1M10 15.5v2.1M17.6 10h-2.1M4.5 10H2.4
               M15.4 4.6l-1.5 1.5M6.1 13.9l-1.5 1.5M15.4 15.4l-1.5-1.5M6.1 6.1L4.6 4.6"
            fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}
