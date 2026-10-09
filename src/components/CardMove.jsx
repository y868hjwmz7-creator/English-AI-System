/**
 * **カードを送る / 判定する操作**(第5.417節・2026-10-07 利用者の指定・段階4)。
 *
 * ============================================================================
 * 【この部品が受け持つもの】
 *
 *   | 操作 | 前へ | 次へ | 覚えた(言える) | まだ |
 *   |---|---|---|---|---|
 *   | **矢印キー** | **←** | **→** | **↑** | **↓** |
 *   | **紙の余白をクリック** | **左の余白** | **右の余白** | — | — |
 *   | **◀▶ のボタン**(指の端末だけ) | **◀** | **▶** | — | — |
 *
 *   ★ **スワイプは廃止した**(2026-10-08 利用者の指定)。
 *   理由は `cardMove.js` の `SWIPE_OFF` に書いてある。
 *   **パソコンの操作は1ミリも変えていない**(矢印キー・余白のクリック)。
 *
 *   ボタン(「まだ ↓」「覚えた ↑」)は**呼ぶ側が描く** ——
 *   あちらは答えの行の一部で、この部品の持ちものではない。
 *   **◀▶ も同じ行に並ぶ**ので、描くのは呼ぶ側(`MoveArrow`)である。
 *
 * 【どちらが決めるか】
 *   **当てはまるかどうかは `cardMove.js` 1か所**(`keyMove` / `edgeFits` /
 *   `FLY_MS` / `flyX`)。ここは**描くことと、測ることだけ**を受け持つ ——
 *   そうしておけば、算段は `npm run test:play` が素の node で見張れる。
 *
 * 【送る道は1本】
 *   矢印キーも、余白のクリックも、◀▶ のボタンも、**この `go()` を通る。**
 *   `MoveArrow` は `CardMoveCtx` から受け取るので、
 *   **流す動きを2か所に書かずに済む**(CLAUDE.md「判断は1か所に持つ」)。
 *
 * 【押せる帯は「紙の入れ物」の中に置く】
 *   窓に対して置くと、**上の帯にも下のタブバーにもかかる**
 *   (2026-10-07 利用者の指定「上部バーの部分は余白としてとらえない」)。
 *   `position: absolute` をこの入れ物に対して置けば、
 *   **構造として、外には出られない。**
 *
 * 【余白が狭ければ、出さない】
 *   広い画面では左右が大きく空くが、**狭い画面ではほとんど無い。**
 *   押せる幅(44px)が取れないときは**帯ごと描かない** ——
 *   出しても押せないものは、効かない操作である(CLAUDE.md)。
 *   **幅は実測する。決め打ちにしない。**
 * ============================================================================
 */
import {
  createContext, useCallback, useContext, useEffect, useRef, useState,
} from 'react'
import { FLY_MS, TAP_MIN, edgeBand, edgeFits, flies, flyX, flyY, keyMove } from '../lib/cardMove.js'

/**
 * ★ **送る道を、中のボタンへ渡す**(2026-10-08)。
 *
 * ◀▶ は「まだ」「言えた」と同じ行に並ぶ(利用者の指定)ので、
 * **カードの中**に描かれる。入れ物の `CardMove` までは props が届かないため、
 * **ここを通して渡す。**
 *
 * **無ければ `null`** —— そのとき `MoveArrow` は何も描かない
 * (**既定は「見せない」側**・CLAUDE.md)。
 */
export const CardMoveCtx = createContext(null)

/**
 * ★ **スペースで、正解を出したり消したり**(2026-10-09 利用者の指定)。
 *
 * **答えを出しているかどうかは、カードの中が持っている**
 * (Quick Response の `QrCard`)。入れ物の `CardMove` までは届かないので、
 * **カードの側から「これを呼んでください」と登録してもらう。**
 *
 * **道を2つ作らない** —— 登録が無ければ、画面が渡した `onPeek` を呼ぶ
 * (単語帳はそちらを使う)。
 */
export const CardPeekCtx = createContext(null)

/** いま字を打っているか。**打っていたら矢印キーを1つも効かせない** */
function typingNow() {
  try {
    const el = document.activeElement
    if (!el) return false
    if (el.isContentEditable) return true
    const tag = String(el.tagName || '').toLowerCase()
    return tag === 'input' || tag === 'textarea' || tag === 'select'
  } catch { return false }
}

export default function CardMove({
  /** 操作が来たときに呼ぶもの。**渡されなかったものは効かせない** */
  onPrev = null, onNext = null, onOk = null, onYet = null,
  /** ★ **スペース。正解を出したり消したり**(2026-10-09 利用者の指定) */
  onPeek = null,
  /** 効かせるか(終わりの画面などでは `false`) */
  on = true,
  children,
}) {
  const holdRef = useRef(null)
  /** 空いている幅と、その置き場所(px)。**実測した値だけを使う** */
  const [space, setSpace] = useState({ left: 0, right: 0, 左: 0, 右: 0 })
  /** 送ったあと、その向きへ流す */
  const [fly, setFly] = useState('')

  /* 鳴らしている最中に呼ぶものは控えで持つ(いつも最新になる) */
  const doRef = useRef({})
  /** カードの側が登録した「答えを出したり消したり」(無ければ画面のもの) */
  const peekRef = useRef(null)
  const 登録 = useCallback((fn) => { peekRef.current = fn ?? null }, [])
  doRef.current = {
    prev: onPrev,
    next: onNext,
    ok: onOk,
    yet: onYet,
    peek: () => { const f = peekRef.current ?? onPeek; if (typeof f === 'function') f() },
  }

  /** その操作を行う。**無ければ何もしない**(既定は「できない」側) */
  const run = useCallback((move) => {
    const fn = doRef.current[move]
    if (typeof fn === 'function') fn()
  }, [])

  /** 流している最中かどうか。**重ねて押されても1回しか送らない** */
  const 流し中 = useRef(null)
  /* **画面が消えるときは、必ず止める**(時計を置き去りにしない) */
  useEffect(() => () => {
    if (流し中.current) { window.clearTimeout(流し中.current); 流し中.current = null }
  }, [])

  /**
   * ★ **送る道は、ここ1本**(2026-10-08 / 2026-10-09)。
   *
   * **4つとも流して消す**(利用者の指定「飛ばす 600ms」)。
   * 送り(`prev` / `next`)は**横**、判定(`ok` / `yet`)は**上下**へ
   * —— 向きは `cardMove.js` の `flyX()` / `flyY()` 1か所が持つ。
   *
   * **飛ぶのは線と線のあいだの中身だけ**(第5.417節)なので、
   * ボタンも題も進み具合の帯も 1px も動かない
   * (共通ルール「押しても、まわりの物が動かない」を破っていない)。
   */
  const go = useCallback((move) => {
    if (!on || !move) return
    if (!flies(move)) { run(move); return }
    if (!doRef.current[move]) return
    /* **流している最中は、受け取らない**(二重に送らない) */
    if (流し中.current) return
    setFly(move)
    流し中.current = window.setTimeout(() => {
      流し中.current = null
      setFly('')
      run(move)
    }, FLY_MS)
  }, [on, run])

  /* ── 余白を実測する ────────────────────────────────────────── */
  useEffect(() => {
    const hold = holdRef.current
    if (!hold) return undefined
    const 測る = () => {
      const card = hold.firstElementChild
      if (!card) { setSpace({ left: 0, right: 0, hold: 0 }); return }
      /* ★ **空いているところいっぱいに広げる**(2026-10-09 利用者の指定)。
           外の入れ物は**本体(`.app-body`)** —— 窓まで広げると、
           左の柱(`.app-nav`)の上まで帯が伸びる。
           **柱は本体の外**なので、ここなら1ミリも重ならない。
           本体が見つからない形(集中モードを重ねたとき)は、窓そのもの */
      const 外 = hold.closest('.app-body') ?? document.documentElement
      const o = 外.getBoundingClientRect()
      const c = card.getBoundingClientRect()
      const h = hold.getBoundingClientRect()
      const 幅 = edgeBand(o, c)
      /* **置き場所は、入れ物からの距離で渡す**(`style` に渡すだけ) */
      setSpace({ ...幅, 左: Math.round(c.left - h.left - 幅.left), 右: Math.round(c.right - h.left) })
    }
    測る()
    /* **窓の幅が変わったら測り直す。** 決め打ちの数で判断しない */
    let ro = null
    try {
      ro = new window.ResizeObserver(測る)
      ro.observe(hold)
      if (hold.firstElementChild) ro.observe(hold.firstElementChild)
    } catch { /* 無い端末では、はじめの1回だけで決まる */ }
    window.addEventListener('resize', 測る)
    return () => {
      try { ro?.disconnect() } catch { /* もう外れている */ }
      window.removeEventListener('resize', 測る)
    }
  }, [children])

  /* ── 矢印キー ──────────────────────────────────────────────── */
  useEffect(() => {
    if (!on) return undefined
    const 聞く = (e) => {
      const move = keyMove(e, {
        typing: typingNow(),
        /* **ボタンの上でスペースを押したら、そのボタンに任せる** */
        onButton: document.activeElement?.tagName === 'BUTTON',
      })
      if (!move) return
      /* **ページの送りとぶつけない。** ↑↓ はふだん画面を送るキーである */
      e.preventDefault()
      go(move)
    }
    window.addEventListener('keydown', 聞く)
    return () => window.removeEventListener('keydown', 聞く)
  }, [on, go])

  const 左出す = edgeFits(space.left)
  const 右出す = edgeFits(space.right)

  return (
    <CardPeekCtx.Provider value={登録}>
    <CardMoveCtx.Provider value={on ? go : null}>
      {/* ★ **飛ぶのは、線と線のあいだの中身だけ**(2026-10-08 利用者の指定)。

            > 横に内容が動く際、黄色の線の内側の内容だけ動くようにできませんか？
            > 箱全体が動くのは不自然に感じます。動くのは単語やクイック
            > レスポンスの内容のみ、上の線と下の線の間にあるものだけです。

          **入れ物はここで動かさない。** 動くのは `.move-stage`
          (出題の枠 = `.qr-body` / `.wordcard-q`)で、見た目は CSS が持つ。
          **数は `cardMove.js` 1か所から来る** —— ここは `style` に渡すだけで、
          CSS にも画面にも書き写さない。 */}
      <div className={`cardmove${fly ? ' is-fly' : ''}`} ref={holdRef}
           style={fly
             ? { '--fly-x': flyX(fly), '--fly-y': flyY(fly), '--fly-ms': `${FLY_MS}ms` }
             : undefined}>
        {children}
        {/* ★ **押せる帯は、この入れ物の中**(第5.417節)。
              窓に対して置くと、上の帯にも下のタブバーにもかかる。
              **幅が取れないときは、描かない** */}
        {左出す && onPrev && (
          <button type="button" className="cardmove-edge cardmove-edge--l"
                  style={{ left: `${space.左}px`, width: `${space.left}px` }}
                  aria-label="前へ" onClick={() => go('prev')} />
        )}
        {右出す && onNext && (
          <button type="button" className="cardmove-edge cardmove-edge--r"
                  style={{ left: `${space.右}px`, width: `${space.right}px` }}
                  aria-label="次へ" onClick={() => go('next')} />
        )}
      </div>
    </CardMoveCtx.Provider>
    </CardPeekCtx.Provider>
  )
}

/**
 * ★ **◀▶ のボタン**(2026-10-08 利用者の指定・段階4)。
 *
 *   > 三角だけ、小さい方
 *   > 「まだ」「言えた」の左右に置く
 *
 * 9つの置き場所と、4通りの形・大きさを実際に描いて見くらべてもらい、
 * **「三角だけ・44px・『まだ』『言えた』の行の左右」**がえらばれた。
 *
 * - **指の端末にだけ出す**(利用者の指定「スマホ、タブレットのみ」)。
 *   パソコンには、これまでどおり**紙の左右の余白**と**矢印キー**がある ——
 *   **同じことをするものを2つ見せない**(CLAUDE.md)
 * - **三角だけでも、押せる的は 44px**(`TAP_MIN`)。
 *   見た目が軽くなるだけで、押しにくくはしない
 * - **送る道は `CardMoveCtx` から受け取る** —— 流す動きをここに書き写さない
 * - **入れ物が無ければ、何も描かない**(既定は「見せない」側)
 *
 * @param {'prev'|'next'} move どちらへ送るか
 * @param {boolean} show 出してよいか(呼ぶ側が `isCoarse()` で決める)
 */
export function MoveArrow({ move = 'next', show = false }) {
  const go = useContext(CardMoveCtx)
  if (!show || !go) return null
  const 前 = move === 'prev'
  return (
    <button type="button" className={`move-arrow move-arrow--${move}`}
            aria-label={前 ? '前へ' : '次へ'}
            /* **押せる的の大きさは `TAP_MIN` 1か所から**(CSS に書き写さない) */
            style={{ width: `${TAP_MIN}px`, height: `${TAP_MIN}px` }}
            onClick={() => go(move)}>
      {/* **絵文字(◀▶)は使わない** —— 端末ごとに形も大きさも違う
          (共通ルール)。線で描けば、どこでも同じ三角になる */}
      <svg viewBox="0 0 10 10" aria-hidden="true" focusable="false">
        <path d={前 ? 'M8 0 L2 5 L8 10 Z' : 'M2 0 L8 5 L2 10 Z'} fill="currentColor" />
      </svg>
    </button>
  )
}
