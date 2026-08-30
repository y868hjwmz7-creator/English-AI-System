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

/* ── 画面の切り替え(左のメニュー)で使う絵 ────────────────────
   **どれも同じ枠(20×20)・同じ線の太さ(1.5)で描く。**
   1つだけ太かったり大きかったりすると、並べたときに揃って見えない。
   細くたたんだメニューでは、この絵だけが目印になるので、
   **形で見分けられること**を優先している(色は付けない)。 */

/** 三本線。メニューの開け閉め */
export function MenuIcon({ className = 'icon' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M3 5.5h14M3 10h14M3 14.5h14" fill="none" stroke="currentColor"
            strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}

/** ✕。開いたものを閉じる */
export function CloseIcon({ className = 'icon' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M5 5l10 10M15 5L5 15" fill="none" stroke="currentColor"
            strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}

/** 本。教材 */
export function BookIcon({ className = 'icon' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M3.5 4.2c2.4-.7 4.3-.7 6.5.5v11c-2.2-1.2-4.1-1.2-6.5-.5z"
            fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M16.5 4.2c-2.4-.7-4.3-.7-6.5.5v11c2.2-1.2 4.1-1.2 6.5-.5z"
            fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

/** 人が2人。ゲスト */
export function PeopleIcon({ className = 'icon' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <circle cx="7.6" cy="6.6" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2.6 16c0-2.8 2.2-4.6 5-4.6s5 1.8 5 4.6"
            fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M13.4 4.4a2.6 2.6 0 0 1 0 4.9M14.2 11.7c2.1.4 3.4 2 3.4 4.3"
            fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

/** 棒グラフ。集計 */
export function ChartIcon({ className = 'icon' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M3 16.5h14" fill="none" stroke="currentColor"
            strokeWidth="1.5" strokeLinecap="round" />
      <path d="M5.5 16.5V11M10 16.5V4.5M14.5 16.5V8" fill="none" stroke="currentColor"
            strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}

/** 書類とチェック。今週の宿題 */
export function TaskIcon({ className = 'icon' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <rect x="4" y="2.8" width="12" height="14.4" rx="2"
            fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7.3 9.6l1.9 1.9 3.8-4" fill="none" stroke="currentColor"
            strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** 重ねた札。単語帳 */
export function CardsIcon({ className = 'icon' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <rect x="2.8" y="6" width="10.4" height="10.4" rx="2"
            fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6.4 3.6h8.2a2.4 2.4 0 0 1 2.4 2.4v8" fill="none" stroke="currentColor"
            strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

/** 折れ線。学習の記録 */
export function TrendIcon({ className = 'icon' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M3 16.5h14" fill="none" stroke="currentColor"
            strokeWidth="1.5" strokeLinecap="round" />
      <path d="M4.5 13l3.6-4.2 3 2.6 4.4-5.4" fill="none" stroke="currentColor"
            strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** 稲妻。Quick Response(日本語を見て、すぐ英語で言う)
    **学習の記録の折れ線を使い回さない。** 同じ絵は同じ意味に見える */
export function BoltIcon({ className = 'icon' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M11.2 2.5L4.8 11h4.3l-.8 6.5L15.4 9h-4.4z" fill="none" stroke="currentColor"
            strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

/** 段。6Steps(順に積み上げるトレーニング) */
export function StepsIcon({ className = 'icon' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M2.5 16.5h4v-4h4v-4h4v-4h3" fill="none" stroke="currentColor"
            strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
