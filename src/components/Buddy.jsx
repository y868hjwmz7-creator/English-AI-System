/**
 * ============================================================================
 * **相棒**(第5.371節 → 第5.373節・2026-10-05 利用者の指定)
 *
 *   > というよりユーザーが選べるようにしたいです
 *
 *   **こちらが1人に決めない。** 3人のうちから、使う人がえらぶ
 *   (どれを選んだかは `buddyKind.js` が覚える)。
 *
 * ── ここまでに**捨てた**作り ─────────────────────────────────
 *
 *   ①「丸に顔」だけ(顔しか無い)…… **アイコンであって、キャラクターではない**
 *   ②紺と薄い青だけ …………………… **地味。** 利用者の指定で暖色にした
 *   ③まっすぐ正面で固い ……………… **首をかしげる**
 *   ④目が小さく、上にある ………… **大きく・低く・離す**
 *
 *   いまの形は、この4つを直したものである。
 *
 * ── 3人に**共通**なもの(書き写さない) ──────────────────────
 *
 *   目・ほお・考えている点・影・首のかしげ・手の角 —— ぜんぶ1つずつしか無い。
 *   **違うのは、からだの形と色と持ちものだけ**である。
 *
 * ── **小さいときは顔だけ** ──────────────────────────────────
 *
 *   全身を 28px に縮めると、ただの染みになる。
 *   **同じ絵のまま、`viewBox` で顔を切り出す**(別の絵を描かない ——
 *   2枚あると、必ず片方だけ古くなる)。
 *
 * ── **箱の大きさは、顔でも相棒でも 1px も動かない** ──────────
 *
 *   「押しても、まわりの物が動かない」(利用者の指定)。
 *   `viewBox` は固定で、手も足も**どの顔でも必ず描く。**
 *   きらめきと考えている点は `overflow: visible` で**重ねるだけ**で、
 *   場所を取らない。
 *
 * ── 色は、アプリが持っているものだけ ───────────────────────
 *
 *   `--series-4`(黄)/ `--series-2`(橙)/ `--series-5`(ほお)/
 *   `--accent`(輪郭と目)。**新しい色を1つも足していない。**
 * ============================================================================
 */
import { buddyAlt, buddyBreathes } from '../lib/buddy.js'
import { BUDDY_KIND_DEFAULT, buddyKindOf } from '../lib/buddyKind.js'
import { useBuddyKind } from '../lib/useBuddyKind.js'

/* **目は大きく・低く・離す。** これだけで、ぐっと親しみやすくなる */
const 目 = { l: 31, r: 51, y: 36, r0: 6.4 }

/** 片目。**まばたきは CSS がする**(ここで時計を持たない) */
function Eye({ cx, cy, r, blink }) {
  return (
    <g className={blink ? 'buddy-blink' : undefined}>
      <circle className="buddy-ink" cx={cx} cy={cy} r={r} />
      {/* ★ ハイライト。**無いと、どれだけ描いても「死んだ目」になる** */}
      <circle className="buddy-spark" cx={cx + 2.2} cy={cy - 2.2} r="2.2" />
      <circle className="buddy-spark" cx={cx - 2} cy={cy + 2.4} r="1" />
    </g>
  )
}

function Eyes({ face }) {
  if (face === 'glad' || face === 'proud') {
    /* よろこんでいる目は、上に弧を描く(「^ ^」) */
    return (
      <g className="buddy-ink" fill="none" strokeWidth="3.4" strokeLinecap="round">
        <path d={`M ${目.l - 6} ${目.y + 2} Q ${目.l} ${目.y - 6} ${目.l + 6} ${目.y + 2}`} />
        <path d={`M ${目.r - 6} ${目.y + 2} Q ${目.r} ${目.y - 6} ${目.r + 6} ${目.y + 2}`} />
      </g>
    )
  }
  /* 考えている目は**上を見る**。励ます目は**大きめ**。
     待つ・聞くは**まばたきする**(聞いているときは集中して、またたかない) */
  const dy = face === 'think' ? -2.5 : 0
  const r = face === 'cheer' ? 目.r0 + 0.8 : 目.r0
  const blink = face === 'rest'
  return (
    <>
      <Eye cx={目.l} cy={目.y + dy} r={r} blink={blink} />
      <Eye cx={目.r} cy={目.y + dy} r={r} blink={blink} />
    </>
  )
}

/** 口。**小鳥はくちばしが口のかわり**なので、こちらは使わない */
function Mouth({ face, y }) {
  const s = { fill: 'none', strokeWidth: 2.8, strokeLinecap: 'round' }
  if (face === 'glad' || face === 'proud') {
    return <path className="buddy-ink" d={`M 35 ${y - 1} Q 41 ${y + 5} 47 ${y - 1}`} {...s} />
  }
  if (face === 'cheer') return <path className="buddy-mouth" d={`M 34 ${y - 2} Q 41 ${y + 8} 48 ${y - 2} Z`} />
  if (face === 'listen') return <ellipse className="buddy-mouth" cx="41" cy={y + 1} rx="4.4" ry="4" />
  if (face === 'think') return <ellipse className="buddy-mouth" cx="41" cy={y} rx="2.8" ry="2.2" />
  return <path className="buddy-ink" d={`M 37 ${y} Q 41 ${y + 2.5} 45 ${y}`} {...s} />
}

/**
 * ほお。**出ない顔でも、同じ形を置いておく**(`opacity` だけ変える)——
 * 出し入れすると、そこだけ描き直しが起きる。
 */
const ほお = (face, y) => {
  const on = face === 'glad' || face === 'proud' || face === 'cheer'
  return (
    <>
      <ellipse className={`buddy-blush${on ? ' is-on' : ''}`} cx="21" cy={y} rx="5" ry="3.6" />
      <ellipse className={`buddy-blush${on ? ' is-on' : ''}`} cx="61" cy={y} rx="5" ry="3.6" />
    </>
  )
}

/** 足もとの影。**これが無いと、浮いて見える** */
const 影 = <ellipse className="buddy-shadow" cx="41" cy="75" rx="18" ry="3" />

/** 首のかしげ。**まっすぐ正面だけだと、固く見える** */
function 傾き(face) {
  if (face === 'listen') return -7
  if (face === 'think') return 7
  if (face === 'glad') return -4
  if (face === 'cheer') return 4
  return 0
}

/** 手の角。**顔ごとにしぐさを変える** —— ここが「アイコン」との差 */
function 手の角(face) {
  if (face === 'listen') return [-60, 12]   // 片手を耳に当てる
  if (face === 'cheer') return [-55, 55]    // 両手を上げる
  if (face === 'think') return [12, -52]    // 片手をあごに
  /* **やり切った**は、よろこんだだけより**高く上げる。**
     同じ形にしたら、`glad` と `proud` が見分けられなかった(描いて分かった) */
  if (face === 'proud') return [-78, 78]
  if (face === 'glad') return [-20, 20]
  return [6, -6]
}

/** 考えている点。**待たせていることを隠さない** */
const 考え = (face) => (face === 'think' ? (
  <g className="buddy-dots">
    <circle cx="66" cy="18" r="2.2" /><circle cx="72" cy="12" r="2.6" /><circle cx="78" cy="5" r="3" />
  </g>
) : null)

/** やり切ったときだけ出る、きらめき。**場所は取らない**(重ねるだけ) */
const きらめき = (face) => (face === 'proud' ? (
  <g className="buddy-star">
    <path d="M 12 16 l 1.8 4.4 4.4 1.8 -4.4 1.8 -1.8 4.4 -1.8 -4.4 -4.4 -1.8 4.4 -1.8 Z" />
    <path d="M 70 10 l 1.4 3.4 3.4 1.4 -3.4 1.4 -1.4 3.4 -1.4 -3.4 -3.4 -1.4 3.4 -1.4 Z" />
  </g>
) : null)

/* ══ ① 小鳥 + ヘッドホン ══════════════════════════════════ */
function Bird({ face }) {
  const [la, ra] = 手の角(face)
  return (
    <>
      {影}
      <ellipse className="buddy-body" cx="41" cy="58" rx="17" ry="15" />
      <ellipse className="buddy-belly" cx="41" cy="61" rx="10" ry="10" />
      <g transform={`rotate(${la} 25 54)`}>
        <path className="buddy-limb" d="M 25 48 Q 13 54 17 65 Q 26 59 28 50 Z" />
      </g>
      <g transform={`rotate(${ra} 57 54)`}>
        <path className="buddy-limb" d="M 57 48 Q 69 54 65 65 Q 56 59 54 50 Z" />
      </g>
      <path className="buddy-foot" d="M 34 71 L 34 75 M 30 75 L 38 75" />
      <path className="buddy-foot" d="M 48 71 L 48 75 M 44 75 L 52 75" />
      <g transform={`rotate(${傾き(face)} 41 40)`}>
        <circle className="buddy-body" cx="41" cy="33" r="23" />
        {/* ★ ヘッドホン。**ひと目で「聞く子」と分かるシルエット** */}
        <path className="buddy-gear" d="M 16 32 Q 41 2 66 32" fill="none" strokeWidth="5" strokeLinecap="round" />
        <rect className="buddy-gear2" x="9" y="26" width="12" height="18" rx="6" />
        <rect className="buddy-gear2" x="61" y="26" width="12" height="18" rx="6" />
        <Eyes face={face} />
        {ほお(face, 45)}
        {/* くちばし。**聞いているときと励ますときだけ開く** */}
        {face === 'listen' || face === 'cheer' ? (
          <>
            <path className="buddy-beak" d="M 35 44 L 47 44 L 41 50 Z" />
            <path className="buddy-beak" d="M 37 53 L 45 53 L 41 50.3 Z" />
          </>
        ) : <path className="buddy-beak" d="M 35 44 L 47 44 L 41 52 Z" />}
      </g>
    </>
  )
}

/* ══ ② キツネ ════════════════════════════════════════════ */
function Fox({ face }) {
  const [la, ra] = 手の角(face)
  return (
    <>
      {影}
      {/* しっぽ。**シルエットの引っかかり**(手と重ならない所まで下げてある) */}
      <path className="buddy-body" d="M 56 66 Q 78 66 78 50 Q 72 62 58 60 Z" />
      <path className="buddy-tip" d="M 74 54 Q 79 52 78 46 Q 75 52 72 53 Z" />
      <ellipse className="buddy-body" cx="41" cy="58" rx="16" ry="14" />
      <ellipse className="buddy-belly" cx="41" cy="61" rx="9.5" ry="9.5" />
      <g transform={`rotate(${la} 26 54)`}>
        <path className="buddy-limb" d="M 26 49 Q 15 54 18 64 Q 27 59 29 51 Z" />
      </g>
      <g transform={`rotate(${ra} 56 54)`}>
        <path className="buddy-limb" d="M 56 49 Q 67 54 64 64 Q 55 59 53 51 Z" />
      </g>
      <path className="buddy-foot" d="M 34 70 L 34 74 M 30 74 L 38 74" />
      <path className="buddy-foot" d="M 48 70 L 48 74 M 44 74 L 52 74" />
      <g transform={`rotate(${傾き(face)} 41 40)`}>
        <path className="buddy-body" d="M 21 22 L 16 2 L 36 14 Z" />
        <path className="buddy-body" d="M 61 22 L 66 2 L 46 14 Z" />
        <path className="buddy-tip" d="M 21.5 17 L 19 7 L 29 13 Z" />
        <path className="buddy-tip" d="M 60.5 17 L 63 7 L 53 13 Z" />
        <path className="buddy-body" d="M 41 10 C 59 10 64 24 64 36 C 64 50 54 58 41 58 C 28 58 18 50 18 36 C 18 24 23 10 41 10 Z" />
        <ellipse className="buddy-belly" cx="41" cy="47" rx="13" ry="10" />
        <Eyes face={face} />
        {ほお(face, 45)}
        <ellipse className="buddy-nose" cx="41" cy="43" rx="3.4" ry="2.6" />
        <Mouth face={face} y={50} />
      </g>
    </>
  )
}

/* ══ ③ まるい相棒 + マフラー ═══════════════════════════════ */
function Pal({ face }) {
  const [la, ra] = 手の角(face)
  return (
    <>
      {影}
      <path className="buddy-body"
            d="M 41 8 C 60 8 66 22 66 38 C 66 52 61 62 59 68 C 57 73 50 74 41 74 C 32 74 25 73 23 68 C 21 62 16 52 16 38 C 16 22 22 8 41 8 Z" />
      <ellipse className="buddy-belly" cx="41" cy="62" rx="12" ry="10" />
      <g transform={`rotate(${la} 21 55)`}>
        <path className="buddy-limb" d="M 21 50 Q 9 55 12 65 Q 22 60 24 52 Z" />
      </g>
      <g transform={`rotate(${ra} 61 55)`}>
        <path className="buddy-limb" d="M 61 50 Q 73 55 70 65 Q 60 60 58 52 Z" />
      </g>
      <g transform={`rotate(${傾き(face)} 41 40)`}>
        <Eyes face={face} />
        {ほお(face, 45)}
        <Mouth face={face} y={48} />
      </g>
      {/* マフラー。**首をかしげる箱の外**に置く —— 中に入れると一緒に回る */}
      <path className="buddy-gear2" d="M 22 50 Q 41 57 60 50 L 60 55.5 Q 41 62.5 22 55.5 Z" />
      <path className="buddy-gear2" d="M 54 54 L 63 72 L 55 73.5 L 49 57 Z" />
    </>
  )
}

/**
 * 相棒ごとの持ちもの。**ここ1か所**で、
 * 「どう描くか」と「小さいときに顔をどこで切り出すか」を決める。
 * **画面の中で `kind === '…'` と書かない**(CLAUDE.md)。
 */
const 相棒 = {
  bird: { 描く: Bird, 顔: '6 -2 70 70' },
  fox: { 描く: Fox, 顔: '10 -1 62 62' },
  pal: { 描く: Pal, 顔: '12 2 58 58' },
}

/**
 * 全身のときの箱。**きらめきも考えている点も、この中に収めてある** ——
 * はみ出させると `overflow: visible` が要り、そうすると
 * **小さいときの切り取りが効かなくなる。**
 */
const 全身 = '-1 -2 84 84'

/**
 * @param {object} p
 * @param {string} p.face  `buddyFace()` が決めた顔
 * @param {string} [p.size] `'sm'`(帯の中・**顔だけ**)/ `'md'` / `'lg'`
 * @param {string} [p.kind] **ふだんは渡さない**(選ばれているものを自分で読む)。
 *   渡せるようにしてあるのは、見張りが3人とも描いて測れるようにするため
 */
export default function Buddy({ face = 'rest', size = 'md', kind, className = '' }) {
  const 選び = useBuddyKind()
  const id = buddyKindOf(kind ?? 選び)
  const 人 = 相棒[id] ?? 相棒[BUDDY_KIND_DEFAULT]
  const Draw = 人.描く
  return (
    <span
      className={`buddy buddy--${size} buddy--${face} buddy--k-${id}`
        + (buddyBreathes(face) ? ' is-breathing' : '')
        + (className ? ` ${className}` : '')}
      role="img"
      aria-label={buddyAlt(face)}
    >
      {/* **小さいときは顔だけを切り出す。** 絵は1枚のまま */}
      <svg viewBox={size === 'sm' ? 人.顔 : 全身} focusable="false" aria-hidden="true">
        <Draw face={face} />
        {考え(face)}
        {きらめき(face)}
      </svg>
    </span>
  )
}
