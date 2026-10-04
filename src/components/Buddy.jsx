/**
 * ============================================================================
 * **相棒**(第5.371節・2026-10-04 利用者の指定「キャラクター」
 *                      → 2026-10-04 追加指定「もうちょっと個性のあるキャラに」)
 *
 * ── なぜ**鳥(インコ)**なのか ───────────────────────────────
 *
 *   はじめは「角の丸い四角に目が2つ」の抽象的なかたちにしていたが、
 *   **それは記号であって、キャラクターではなかった。**
 *
 *   インコにしたのは、かわいいからではない ——
 *   **聞いて、そのまま返す**生きものだからである。
 *   このアプリがゲストにさせているのは、まさにそれ
 *   (Quick Response・音読・復唱・Native Flow)。
 *   **相棒が、アプリのやっていることそのもの**になっている。
 *
 *   ほかに描いて比べたのは、ヘッドホン / 吹き出し / おむすびの3つ。
 *   どれも**きれいだが、意味が無い**(ヘッドホンは道具、吹き出しは記号、
 *   おむすびは無関係)。**見た目で選ばず、意味で選んだ。**
 *
 * ── **個性は「眉」が作る** ─────────────────────────────────
 *
 *   目と口だけでは、どの顔も似てしまう(最初の版がそうだった)。
 *   **眉を足したとたんに、顔がしゃべり出す。**
 *   だからここは、顔ごとに**眉・目・くちばし**の3つを差し替える。
 *
 *   **絵は1枚だけ。** 顔ごとに別の絵を描くと、6枚が少しずつ食い違う。
 *   かたち(からだ・冠羽・翼)は1つで、差し替えるのは顔だけ。
 *   どの顔になるかは `buddyFace()` 1か所が決める(ここでは決めない)。
 *
 * ── 色は1つも足していない ──────────────────────────────────
 *
 *   `--accent` / `--accent-soft` / `--accent-line` / `--series-4`(くちばし)/
 *   `--series-5`(ほお)。**すべて既にアプリにある色**である
 *   (CLAUDE.md「呼び名・色・幅を2か所に書かない」)。
 *
 * ── 動きは `motion.js` の長さと曲線だけ ─────────────────────
 *
 *   ここに数を書かない。**`styles.css` が `var(--motion-…)` を読む。**
 *   息をするかどうかも `buddyBreathes()` が決める。
 *
 * ── **場所を取る大きさは、顔で変わらない** ───────────────────
 *
 *   「押しても、まわりの物が動かない」(利用者の指定)。
 *   `viewBox` は固定で、冠羽も翼も**どの顔でも必ず描く** ——
 *   表情が変わっても**箱の大きさは 1px も動かない。**
 * ============================================================================
 */
import { buddyAlt, buddyBreathes } from '../lib/buddy.js'

/* **目の位置は、顔によらず同じ。** 変えるのは「どう描くか」だけ */
const 左目 = { cx: 25, cy: 33 }
const 右目 = { cx: 39, cy: 33 }

/**
 * その顔の**眉**。**ここがいちばん個性を作る。**
 * 左右で別の形にできる(`think` は片方だけ上げる)。
 */
function Brows({ face }) {
  if (face === 'glad' || face === 'proud') {
    /* よろこんでいる眉は、ゆるく上へ */
    return (<><path d="M 19 25 Q 25 21.5 30 25" /><path d="M 34 25 Q 39 21.5 45 25" /></>)
  }
  if (face === 'cheer') {
    /* 励ます眉は、**ぐっと跳ね上げる。**
       内側が下がる形(「ハ」の逆)は、描いてみたら**ニヤリ**に見えた */
    return (<><path d="M 19 25 Q 25 19 30 22" /><path d="M 34 22 Q 39 19 45 25" /></>)
  }
  if (face === 'think') {
    /* 考えている眉は、**片方だけ上げる。**
       左右そろえると、`rest` と見分けが付かなかった(測って決めた) */
    return (<><path d="M 19 26 Q 25 20.5 30 23.5" /><path d="M 34 25 L 45 25" /></>)
  }
  if (face === 'listen') {
    /* 聞いている眉は、**両方わずかに上げる**(耳を澄ましている) */
    return (<><path d="M 19 25.5 L 30 23" /><path d="M 34 23 L 45 25.5" /></>)
  }
  /* 待っている。**まっすぐ** */
  return (<><path d="M 19 25 L 30 25" /><path d="M 34 25 L 45 25" /></>)
}

/** その顔の目。**閉じている目は線で描く**(丸を小さくすると遠くに見える) */
function Eyes({ face }) {
  if (face === 'glad' || face === 'proud') {
    return (
      <>
        <path d={`M ${左目.cx - 4.5} ${左目.cy + 1} Q ${左目.cx} ${左目.cy - 4.5} ${左目.cx + 4.5} ${左目.cy + 1}`}
              fill="none" strokeWidth="3" strokeLinecap="round" />
        <path d={`M ${右目.cx - 4.5} ${右目.cy + 1} Q ${右目.cx} ${右目.cy - 4.5} ${右目.cx + 4.5} ${右目.cy + 1}`}
              fill="none" strokeWidth="3" strokeLinecap="round" />
      </>
    )
  }
  if (face === 'think') {
    /* 考えている目は、**上を見る**(丸を上へ、横は細く) */
    return (
      <>
        <ellipse cx={左目.cx} cy={左目.cy - 3} rx="3.4" ry="2.4" />
        <ellipse cx={右目.cx} cy={右目.cy - 3} rx="3.4" ry="2.4" />
      </>
    )
  }
  if (face === 'cheer') {
    /* 励ます目は、まっすぐ見る(大きめ) */
    return (<><circle cx={左目.cx} cy={左目.cy} r="3.8" /><circle cx={右目.cx} cy={右目.cy} r="3.8" /></>)
  }
  if (face === 'listen') {
    /* 聞いている目は、**まばたきしない**(集中している) */
    return (<><circle cx={左目.cx} cy={左目.cy} r="3.2" /><circle cx={右目.cx} cy={右目.cy} r="3.2" /></>)
  }
  /* 待つ。**まばたきは CSS がする**(ここで時計を持たない) */
  return (
    <>
      <circle className="buddy-blink" cx={左目.cx} cy={左目.cy} r="3.2" />
      <circle className="buddy-blink" cx={右目.cx} cy={右目.cy} r="3.2" />
    </>
  )
}

/**
 * **くちばし。** 口のかわりである。
 * **聞いているときだけ開く** —— インコは、聞いたそばから返す。
 * 開いても**上下に広がるだけ**で、`viewBox` の外へは出ない。
 */
function Beak({ face }) {
  if (face === 'listen') {
    return (
      <>
        <path className="buddy-beak" d="M 27 40 L 37 40 L 32 45 Z" />
        <path className="buddy-beak" d="M 28.5 47.5 L 35.5 47.5 L 32 45.2 Z" />
      </>
    )
  }
  return <path className="buddy-beak" d="M 27 40 L 37 40 L 32 47 Z" />
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
        {/* 冠羽(とさか)。**どの顔でも描く** —— 場所が動かないように */}
        <path className="buddy-crest" d="M 29 21 Q 22 11 27 4 Q 32 10 33 21 Z" />
        <path className="buddy-crest" d="M 33 21 Q 35 10 42 7 Q 41 16 37 22 Z" />
        {/* からだ。**塗りと線はどちらも CSS が決める** —— 色を書き写さない */}
        <ellipse className="buddy-body" cx="32" cy="38" rx="21" ry="18" />
        {/* 翼。**左右に1枚ずつ。** 片側だけだと「垂れた耳」に見えた。
            **いつも同じ場所**(はばたかせない —— 動きは `transform` だけ) */}
        <path className="buddy-wing" d="M 15 37 Q 10.5 44 16.5 49.5 Q 20 43 18.5 38 Z" />
        <path className="buddy-wing" d="M 49 37 Q 53.5 44 47.5 49.5 Q 44 43 45.5 38 Z" />
        <g className="buddy-ink" strokeWidth="2.6" strokeLinecap="round" fill="none">
          <Brows face={face} />
        </g>
        <g className="buddy-ink">
          <Eyes face={face} />
        </g>
        <Beak face={face} />
        {/* よろこんだときだけ出る、ほおの印。**場所は取らない**(重ねるだけ) */}
        {(face === 'glad' || face === 'proud') && (
          <>
            <circle className="buddy-blush" cx="19" cy="40" r="3.4" />
            <circle className="buddy-blush" cx="45" cy="40" r="3.4" />
          </>
        )}
        {/* 考えているときだけ出る点。**箱の中に描く**ので場所は取らない。
            3つが順に濃くなる(**待たせていることを隠さない**) */}
        {face === 'think' && (
          <g className="buddy-dots">
            <circle cx="45" cy="18" r="2" />
            <circle cx="51" cy="14" r="2" />
            <circle cx="57" cy="10" r="2" />
          </g>
        )}
      </svg>
    </span>
  )
}
