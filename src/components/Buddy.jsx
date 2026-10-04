/**
 * ============================================================================
 * **相棒**(第5.371節・2026-10-04 利用者の指定「キャラクター」)
 *
 * ── どんな見た目にしたか、と**しなかったか** ──────────────────
 *
 *   **動物のゆるキャラにしていない。** 使うのは働いている大人で、
 *   会社の英語スクールの道具である —— 子ども向けの絵柄は、
 *   「黒と濃い水色の塗りつぶしがダサい」と言われたのと同じ筋で外れる。
 *
 *   選んだのは**角の丸い四角に目が2つ**だけの、抽象的なかたちである。
 *   **色はアプリの色をそのまま使う**(`--accent` / `--surface-*`)——
 *   新しい色を1つも足していない(CLAUDE.md「色を2か所に書かない」)。
 *
 * ── **絵は1枚だけ。表情は顔が決める** ──────────────────────────
 *
 *   顔ごとに別の絵を描くと、**6枚が少しずつ食い違っていく。**
 *   かたちは1つで、**目と口だけ**を顔ごとに差し替える。
 *   どの顔になるかは `buddyFace()` 1か所が決める(ここでは決めない)。
 *
 * ── 動きは `motion.js` の長さと曲線だけ ─────────────────────
 *
 *   ここに数を書かない。**`styles.css` が `var(--motion-…)` を読む。**
 *   息をするかどうかも `buddyBreathes()` が決める。
 *
 * ── **場所を取る大きさは、顔で変わらない** ───────────────────
 *
 *   「押しても、まわりの物が動かない」(利用者の指定)。
 *   `viewBox` は固定で、太さも変えない —— **表情が変わっても
 *   箱の大きさは1px も動かない。**
 * ============================================================================
 */
import { buddyAlt, buddyBreathes } from '../lib/buddy.js'

/* **目の位置と大きさは、顔によらず同じ。** 変えるのは「どう描くか」だけ */
const 左目 = { cx: 25, cy: 29 }
const 右目 = { cx: 39, cy: 29 }

/** その顔の目。**閉じている目は線で描く**(丸を小さくすると遠くに見える) */
function Eyes({ face }) {
  if (face === 'glad' || face === 'proud') {
    /* よろこんでいる目は、上に弧を描く(「^ ^」) */
    return (
      <>
        <path d={`M ${左目.cx - 5} ${左目.cy + 1} Q ${左目.cx} ${左目.cy - 5} ${左目.cx + 5} ${左目.cy + 1}`}
              fill="none" strokeWidth="3" strokeLinecap="round" />
        <path d={`M ${右目.cx - 5} ${右目.cy + 1} Q ${右目.cx} ${右目.cy - 5} ${右目.cx + 5} ${右目.cy + 1}`}
              fill="none" strokeWidth="3" strokeLinecap="round" />
      </>
    )
  }
  if (face === 'think') {
    /* 考えている目は、**上を見る**(丸を上へ、横は細く)。
       描いてみたら `rest` とほとんど見分けが付かなかったので、
       **ずらす量を増やし、形も変えた**(測って決めた) */
    return (
      <>
        <ellipse cx={左目.cx} cy={左目.cy - 3.5} rx="3.6" ry="2.6" />
        <ellipse cx={右目.cx} cy={右目.cy - 3.5} rx="3.6" ry="2.6" />
      </>
    )
  }
  if (face === 'cheer') {
    /* 励ます目は、まっすぐ見る(大きめ) */
    return (
      <>
        <circle cx={左目.cx} cy={左目.cy} r="4" />
        <circle cx={右目.cx} cy={右目.cy} r="4" />
      </>
    )
  }
  /* 待つ・聞く。**まばたきは CSS がする**(ここで時計を持たない) */
  return (
    <>
      <circle className="buddy-blink" cx={左目.cx} cy={左目.cy} r="3.4" />
      <circle className="buddy-blink" cx={右目.cx} cy={右目.cy} r="3.4" />
    </>
  )
}

/** その顔の口。**無い顔もある**(待っているときは口を描かない) */
function Mouth({ face }) {
  if (face === 'glad' || face === 'proud') {
    return <path d="M 26 40 Q 32 46 38 40" fill="none" strokeWidth="3" strokeLinecap="round" />
  }
  if (face === 'cheer') {
    /* **口角は下げない。** 責めない顔にする。
       描いてみたら、まっすぐの線は**がっかりした顔**に見えた ——
       `glad` ほど笑わないが、**わずかに上向き**にする(測って決めた) */
    return <path d="M 26 40.5 Q 32 43.5 38 40.5" fill="none" strokeWidth="3" strokeLinecap="round" />
  }
  if (face === 'listen') {
    /* 聞いている口は開く。**小さすぎると `rest` と見分けが付かなかった**
       ので、一回り大きくした(測って決めた) */
    return <ellipse cx="32" cy="41.5" rx="3.8" ry="3.2" />
  }
  return null
}

/**
 * @param {object} p
 * @param {string} p.face  `buddyFace()` が決めた顔
 * @param {string} [p.size] `'sm'`(帯の中)/ `'md'`(既定)/ `'lg'`(やり切った1枚)
 */
export default function Buddy({ face = 'rest', size = 'md', className = '' }) {
  return (
    <span
      className={`buddy buddy--${size} buddy--${face}`
        + (buddyBreathes(face) ? ' is-breathing' : '')
        + (className ? ` ${className}` : '')}
      role="img"
      aria-label={buddyAlt(face)}
    >
      <svg viewBox="0 0 64 64" focusable="false" aria-hidden="true">
        {/* からだ。**塗りと線はどちらも CSS が決める** —— 色を書き写さない */}
        <rect className="buddy-body" x="8" y="10" width="48" height="44" rx="15" />
        <g className="buddy-ink">
          <Eyes face={face} />
          <Mouth face={face} />
        </g>
        {/* よろこんだときだけ出る、ほおの印。**場所は取らない**(重ねるだけ) */
        }
        {(face === 'glad' || face === 'proud') && (
          <>
            <circle className="buddy-blush" cx="16" cy="37" r="3.6" />
            <circle className="buddy-blush" cx="48" cy="37" r="3.6" />
          </>
        )}
        {/* 考えているときだけ出る点。**箱の中に描く**ので場所は取らない。
            3つが順に濃くなる(**待たせていることを隠さない**) */}
        {face === 'think' && (
          <g className="buddy-dots">
            <circle cx="24" cy="46" r="2" />
            <circle cx="32" cy="46" r="2" />
            <circle cx="40" cy="46" r="2" />
          </g>
        )}
      </svg>
    </span>
  )
}
