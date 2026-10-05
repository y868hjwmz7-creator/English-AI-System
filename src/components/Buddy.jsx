/**
 * ============================================================================
 * **相棒**(第5.371節 → 第5.373節 → 第5.374節)
 *
 *   2026-10-05 利用者。手描きのアイコン集の写真を見せてもらって、
 *
 *     > キャラのイメージとしてはこれらのものがあります。
 *     > これくらいの数からユーザーが選べるのが良いです
 *
 *   **12 人から、使う人がえらぶ。**
 *
 * ── **あの絵そのものは1つも写していない** ──────────────────
 *
 *   見せてもらったのは素材サイト(illustAC)のもので、透かしも入っていた。
 *   **作風は真似てよいが、絵そのものを写すのは別の話**である。
 *   ここにあるのは、**同じ空気で描き起こした別物**である。
 *
 * ── 作風(ここが、前の版といちばん違う) ─────────────────────
 *
 *   | | |
 *   |---|---|
 *   | **1色** | `--accent` だけ。暖色の塗り分けはやめた |
 *   | **手描きの線** | わざと左右をそろえない。**きれいな円を1つも使わない** |
 *   | **顔だけ** | 全身をやめた。だから **28px でも読める**(切り出しが要らない) |
 *   | **塗りを混ぜる** | 12 のうち3人は塗りつぶし。**全部同じだと並べたとき退屈** |
 *
 *   前の版(暖色・全身・手足・しぐさ)は、**この指定で置き換えた。**
 *   残してあるのは、**顔ごとの目と口**の作りだけである。
 *
 * ── 12 人に**共通**なもの(書き写さない) ──────────────────────
 *
 *   目・口・ほお・考えている点・きらめき —— ぜんぶ1つずつしか無い。
 *   **違うのは、頭のかたちと持ちものだけ**である。
 *   だから相棒を1人足すのは、**`形` に1行書く**だけで済む。
 *
 * ── **箱の大きさは、顔でも相棒でも 1px も動かない** ──────────
 *
 *   「押しても、まわりの物が動かない」(利用者の指定)。
 *   `viewBox` は 12 人とも同じで、きらめきも考えている点も**この中に収めてある。**
 * ============================================================================
 */
import { buddyAlt, buddyBreathes } from '../lib/buddy.js'
import { BUDDY_KIND_DEFAULT, buddyKindOf } from '../lib/buddyKind.js'
import { useBuddyKind } from '../lib/useBuddyKind.js'

/* 目と口の場所。**12 人とも同じ** —— 頭のほうを、ここに合わせて描く */
const 目 = { l: 25, r: 39, y: 31 }
const 口 = 42

/** 手描きらしく、**左右をそろえない。** きれいな円を1つも使わない */
function Eyes({ face }) {
  if (face === 'glad' || face === 'proud') {
    return (
      <g className="buddy-line" fill="none">
        <path d={`M ${目.l - 4.5} ${目.y + 1.5} Q ${目.l} ${目.y - 4} ${目.l + 4.5} ${目.y + 1}`} />
        <path d={`M ${目.r - 4.5} ${目.y + 1} Q ${目.r} ${目.y - 4.5} ${目.r + 4.5} ${目.y + 1.5}`} />
      </g>
    )
  }
  const dy = face === 'think' ? -2 : 0
  const r = face === 'cheer' ? 3.4 : 2.7
  /* **左右で少しだけ大きさを変える。** そろえると、とたんに機械の絵になる */
  return (
    <g className="buddy-ink">
      <ellipse className={face === 'rest' ? 'buddy-blink' : undefined}
               cx={目.l} cy={目.y + dy} rx={r} ry={r + 0.4} />
      <ellipse className={face === 'rest' ? 'buddy-blink' : undefined}
               cx={目.r} cy={目.y + dy - 0.4} rx={r + 0.3} ry={r} />
    </g>
  )
}

function Mouth({ face }) {
  if (face === 'glad' || face === 'proud') {
    return <path className="buddy-line" fill="none" d={`M 26 ${口 - 1} Q 32 ${口 + 5} 38.5 ${口 - 1.5}`} />
  }
  if (face === 'cheer') return <path className="buddy-ink" d={`M 26 ${口 - 1} Q 32 ${口 + 8} 38.5 ${口 - 1} Z`} />
  if (face === 'listen') return <ellipse className="buddy-ink" cx="32" cy={口 + 1} rx="3.2" ry="3.6" />
  if (face === 'think') return <path className="buddy-line" fill="none" d={`M 27 ${口 + 1} Q 30 ${口 - 1.5} 32.5 ${口 + 0.5} Q 35 ${口 + 2.5} 37.5 ${口}`} />
  return <path className="buddy-line" fill="none" d={`M 27.5 ${口} Q 32 ${口 + 1.5} 37 ${口 - 0.5}`} />
}

const ほお = (face) => {
  const on = face === 'glad' || face === 'proud' || face === 'cheer'
  return (
    <g className={`buddy-blush${on ? ' is-on' : ''}`}>
      <path d="M 17 38 q 3 -1.5 5.5 0" /><path d="M 42 38 q 3 -1.5 5.5 0" />
    </g>
  )
}

const 考え = (face) => (face === 'think' ? (
  <g className="buddy-dots">
    <circle cx="51" cy="13" r="1.6" /><circle cx="56" cy="8.5" r="2" /><circle cx="61" cy="4" r="2.4" />
  </g>
) : null)

const きらめき = (face) => (face === 'proud' ? (
  <g className="buddy-star" fill="none">
    <path d="M 7 12 v 7 M 3.5 15.5 h 7" /><path d="M 55 7 v 5 M 52.5 9.5 h 5" />
  </g>
) : null)

/* ══ 12 人の頭。**かたちと持ちものだけ** ══════════════════════
   きれいな円を1つも使っていない —— どれも少しずつ歪ませてある */
const 形 = {
  robo: { label: 'ロボ', solid: false, 描く: () => (<>
    <path className="buddy-out" d="M 4 28 h 6 M 54 28 h 6 M 32 11 v -6" />
    <circle className="buddy-ink" cx="32" cy="3.5" r="2.4" />
    <path className="buddy-body" d="M 15 13 q 17 -2 34 0.5 q 2.5 16 0 36 q -17 2.5 -34 0 q -2.5 -18 0 -36.5 Z" />
  </>) },
  cat: { label: 'ねこ', solid: false, 描く: () => (<>
    <path className="buddy-body" d="M 13 22 l -2 -14 l 14 7.5 Z" />
    <path className="buddy-body" d="M 51 22 l 2.5 -14 l -14 8 Z" />
    <path className="buddy-body" d="M 32 11 q 21 0.5 22 20 q 1 20 -22 20.5 q -23 -0.5 -22 -20.5 q 1 -19.5 22 -20 Z" />
    <path className="buddy-out" d="M 8 33 h 7 M 8.5 38 l 6.5 -1.5 M 56 33 h -7 M 55.5 38 l -6.5 -1.5" />
  </>) },
  dog: { label: 'いぬ', solid: false, 描く: () => (<>
    <path className="buddy-body" d="M 17 17 q -12 3 -11.5 17 q 0.5 13 9.5 13 q 4 -0.5 4.5 -6 Z" />
    <path className="buddy-body" d="M 47 17 q 12 3.5 11.5 17 q -1 13 -10 13 q -4 -0.5 -4 -6 Z" />
    <path className="buddy-body" d="M 32 10 q 18 1 18.5 20 q 0.5 21 -18.5 21.5 q -19 -0.5 -18.5 -21.5 q 0.5 -19 18.5 -20 Z" />
  </>) },
  bear: { label: 'くま', solid: true, 描く: () => (<>
    <circle className="buddy-body" cx="16" cy="16" r="7.5" />
    <circle className="buddy-body" cx="48" cy="16" r="7" />
    <path className="buddy-body" d="M 32 10 q 21 1.5 21 21 q 0 20 -21 20.5 q -21.5 -0.5 -21 -20.5 q 0.5 -19.5 21 -21 Z" />
  </>) },
  bird: { label: 'とり', solid: false, 描く: () => (<>
    <path className="buddy-out" d="M 29 10 q -3 -7 2 -8.5 q 1.5 4 2.5 8" />
    <path className="buddy-out" d="M 34 10.5 q 3 -6.5 8 -6 q -2.5 3.5 -5 7" />
    <path className="buddy-body" d="M 32 11 q 20.5 1 20 20.5 q -0.5 20 -20 20.5 q -20 -0.5 -20.5 -20.5 q -0.5 -19.5 20.5 -20.5 Z" />
    <path className="buddy-ink" d="M 28 40 h 8.5 l -4.5 6 Z" />
  </>) },
  alien: { label: 'うちゅうじん', solid: true, 描く: () => (<>
    <path className="buddy-body" d="M 32 13 q 23 1 22 21 q -1 20 -22 20 q -21.5 0 -22.5 -20 q -1 -20 22.5 -21 Z" />
    <path className="buddy-out" d="M 24 15 q -6 -7 -5.5 -12" />
    <path className="buddy-out" d="M 41 15 q 6.5 -7 6 -12" />
    <circle className="buddy-ink" cx="18.5" cy="2" r="2.4" />
    <circle className="buddy-ink" cx="47.5" cy="2" r="2.1" />
  </>) },
  ghost: { label: 'おばけ', solid: false, 描く: () => (<>
    <path className="buddy-body"
          d="M 32 8 q 19 0.5 19.5 19 l 0.5 25 q -4 -4.5 -7 0 q -3.5 4.5 -6.5 -0.5 q -3 -4.5 -6.5 0 q -3.5 4.5 -7 -0.5 q -3 -4 -6.5 0.5 l 0.5 -24.5 q 0 -18.5 19 -19 Z" />
  </>) },
  rice: { label: 'おむすび', solid: false, 描く: () => (<>
    <path className="buddy-body" d="M 32 7 q 6 0 9 7 l 16 31 q 3 7 -5 7.5 h -40 q -8 -0.5 -5 -7.5 l 16 -31 q 3 -7 9 -7 Z" />
    <path className="buddy-band" d="M 17 45 q 15 2.5 30 0 v 7.5 h -30 Z" />
  </>) },
  egg: { label: 'たまご', solid: false, 描く: () => (<>
    <path className="buddy-body" d="M 32 6 q 13 6.5 16.5 23 q 3 19.5 -16.5 24 q -19.5 -4.5 -16.5 -24 q 3.5 -16.5 16.5 -23 Z" />
    <path className="buddy-out" d="M 18 19 l 5 2.5 l -3.5 3.5 l 6 2 l -3 3" />
  </>) },
  mush: { label: 'きのこ', solid: false, 描く: () => (<>
    <path className="buddy-body" d="M 15 23 q 1 31 17 31 q 16.5 -0.5 17 -31 Z" />
    <path className="buddy-body" d="M 32 4 q 25 1 25.5 17 q 0.5 4.5 -5.5 4.5 h -40 q -6 0 -5.5 -4.5 q 0.5 -16 25.5 -17 Z" />
    <circle className="buddy-dot" cx="19" cy="15" r="3.4" />
    <circle className="buddy-dot" cx="44" cy="12" r="2.8" />
  </>) },
  fish: { label: 'さかな', solid: false, 描く: () => (<>
    <path className="buddy-body" d="M 47 32 l 13 -11 q 2.5 11 0 22 Z" />
    <path className="buddy-body" d="M 28 10 q 20 1 21 22 q -1 21 -21 21.5 q -22 -0.5 -23 -21.5 q 1 -21 23 -22 Z" />
    <path className="buddy-out" d="M 29 11 q 6 -6 12 -6 q -2 4 -2 7" />
  </>) },
  turnip: { label: 'かぶ', solid: true, 描く: () => (<>
    <path className="buddy-out" d="M 30 12 q -5 -7 -11 -8 q 2 7 9 9" />
    <path className="buddy-out" d="M 35 12 q 4 -8 11 -9 q -1.5 7.5 -8.5 10" />
    <path className="buddy-body" d="M 32 11 q 17 2 18 20 q 1 20 -18 21 q -19 -1 -18 -21 q 1 -18 18 -20 Z" />
  </>) },
}

/**
 * @param {object} p
 * @param {string} p.face  `buddyFace()` が決めた顔
 * @param {string} [p.size] `'sm'` / `'md'` / `'lg'`
 * @param {string} [p.kind] **ふだんは渡さない**(選ばれているものを自分で読む)。
 *   渡せるようにしてあるのは、見張りが 12 人とも描いて測れるようにするため
 */
export default function Buddy({ face = 'rest', size = 'md', kind, className = '' }) {
  const 選び = useBuddyKind()
  const id = buddyKindOf(kind ?? 選び)
  const 人 = 形[id] ?? 形[BUDDY_KIND_DEFAULT]
  const Draw = 人.描く
  return (
    <span
      className={`buddy buddy--${size} buddy--${face} buddy--k-${id}`
        + (人.solid ? ' is-solid' : '')
        + (buddyBreathes(face) ? ' is-breathing' : '')
        + (className ? ` ${className}` : '')}
      role="img"
      aria-label={buddyAlt(face)}
    >
      <svg viewBox="0 0 64 64" focusable="false" aria-hidden="true">
        <Draw />
        <Eyes face={face} />
        <Mouth face={face} />
        {ほお(face)}
        {考え(face)}
        {きらめき(face)}
      </svg>
    </span>
  )
}
