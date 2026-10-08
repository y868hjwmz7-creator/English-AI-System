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
 *   | **スワイプ**(指の端末だけ) | **左へ** | **右へ** | — | — |
 *
 *   ★ **横の動きは、どれも「送る」である**(2026-10-08 利用者の指定)。
 *   **スワイプでは判定しない** —— はらっただけで記録が変わってはいけない。
 *
 *   ボタン(「まだ ↓」「覚えた ↑」)は**呼ぶ側が描く** ——
 *   あちらは答えの行の一部で、この部品の持ちものではない。
 *
 * 【どちらが決めるか】
 *   **当てはまるかどうかは `cardMove.js` 1か所**(`keyMove` / `swipeMove` /
 *   `edgeFits`)。ここは**描くことと、測ることだけ**を受け持つ ——
 *   そうしておけば、算段は `npm run test:play` が素の node で見張れる。
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
 *
 * 【なぞる操作とぶつけない】
 *   語をなぞって単語帳に入れる道(第5.17節)は、**指で横に引く動き**である。
 *   そのままだと、なぞるたびに判定が走る。
 *   だから**英文の上から始まった指の動きは、スワイプとして見ない**
 *   (`.etext` の中で始まったかどうかで見分ける)。
 * ============================================================================
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  FLY_MS, dragShift, edgeFits, edgeSpace, flyX, isCoarse, keyMove, swipeMove,
} from '../lib/cardMove.js'

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
  /** 効かせるか(終わりの画面などでは `false`) */
  on = true,
  children,
}) {
  const holdRef = useRef(null)
  /** 片側の余白(px)。**実測した値だけを使う** */
  const [space, setSpace] = useState(0)
  /** スワイプで送ったあと、その向きへ流す */
  const [fly, setFly] = useState('')
  /** ★ 引いている最中の、指についていくズレ(px) */
  const [drag, setDrag] = useState(0)

  /* 鳴らしている最中に呼ぶものは控えで持つ(いつも最新になる) */
  const doRef = useRef({})
  doRef.current = { prev: onPrev, next: onNext, ok: onOk, yet: onYet }

  /** その操作を行う。**無ければ何もしない**(既定は「できない」側) */
  const run = useCallback((move) => {
    const fn = doRef.current[move]
    if (typeof fn === 'function') fn()
  }, [])

  /* ── 余白を実測する ────────────────────────────────────────── */
  useEffect(() => {
    const hold = holdRef.current
    if (!hold) return undefined
    const 測る = () => {
      const card = hold.firstElementChild
      if (!card) { setSpace(0); return }
      setSpace(edgeSpace(hold.getBoundingClientRect().width,
        card.getBoundingClientRect().width))
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
      const move = keyMove(e, { typing: typingNow() })
      if (!move) return
      /* **ページの送りとぶつけない。** ↑↓ はふだん画面を送るキーである */
      e.preventDefault()
      run(move)
    }
    window.addEventListener('keydown', 聞く)
    return () => window.removeEventListener('keydown', 聞く)
  }, [on, run])

  /* ── スワイプ(指の端末だけ)──────────────────────────────── */
  const 指 = useRef(null)
  /** 引いているあいだ、窓で聞いているものを外す道 */
  const 外す = useRef(null)
  const 終い = useCallback(() => {
    if (外す.current) { 外す.current(); 外す.current = null }
    指.current = null
    setDrag(0)
  }, [])
  /* **画面が消えるときは、必ず外す**(聞きっぱなしにしない) */
  useEffect(() => 終い, [終い])

  const down = (e) => {
    if (!on || !isCoarse()) return
    /* **英文の上から始まった動きは、なぞる操作である**(第5.17節)。
       ここで送りに取ると、語を選ぶたびにカードが飛ぶ */
    try { if (e.target?.closest?.('.etext')) return } catch { /* 下で拾う */ }
    const from = { x: e.clientX, y: e.clientY, t: Date.now() }
    指.current = from

    /* ★ **指は「窓」で追いかける**(2026-10-08)。
         カードの外へ出ても届くので、端ではらっても途中で消えない。

         ★★ **`setPointerCapture` は使わない。**
         いちど使ったところ、**指の端末でカードの中のボタンが
         1つも押せなくなった**(実測 —— `click` が、押したボタンではなく
         `.cardmove` に当たる)。捕まえると、そのあとの `pointerup` まで
         入れ物へ付け替えられるので、**ブラウザがボタンを押したと見なせない。**
         窓で聞けば、付け替えは起きない。 */
    /** 引いたか(ただ触れただけか)。**引いたなら、押したことにしない** */
    let 引いた = false
    const 動く = (ev) => {
      const f = 指.current
      if (!f) return
      const ずれ = dragShift({ dx: ev.clientX - f.x, dy: ev.clientY - f.y })
      if (ずれ) 引いた = true
      setDrag(ずれ)
    }
    const 離す = (ev) => {
      const f = 指.current
      終い()
      /* ★ **引いたあとの「押した」を飲み込む**(2026-10-08 実測)。

           はらい始めが「まだ」「言える」の上だと、**はらったあとに
           そのボタンまで押されて、記録が動いていた。**
           (`setPointerCapture` をやめた日に出てきた —— あれは
           ついでにクリックも殺していたので、隠れていた。)

           **引いたときだけ飲み込む。** ただ触れただけなら、
           これまでどおり押したことになる。 */
      if (引いた) {
        const 飲む = (ev2) => { ev2.stopPropagation(); ev2.preventDefault() }
        window.addEventListener('click', 飲む, true)
        window.setTimeout(() => window.removeEventListener('click', 飲む, true), 0)
      }
      if (!f) return
      const 行き先 = swipeMove({
        dx: ev.clientX - f.x, dy: ev.clientY - f.y, ms: Date.now() - f.t,
      })
      /* **届かなかったら、その場へ戻る。** 戻る動きが見えるので、
         「効かなかった」ことが分かる(黙って何も起きない、をやめる) */
      if (!行き先) return
      /* ★ **その向きへ流して、すぐ送る**(2026-10-07 利用者の指定)。
           **ボタンで押したときは流さない** —— 指がボタンの上にあるので、
           動かすと次の問のボタンが指の下に来る(共通ルール)。
           **ここへ来るのは `prev` / `next` だけ**(`swipeMove` は
           判定を返さない・2026-10-08 の仕様変更) */
      setFly(行き先)
      window.setTimeout(() => { setFly(''); run(行き先) }, FLY_MS)
    }
    window.addEventListener('pointermove', 動く)
    window.addEventListener('pointerup', 離す)
    window.addEventListener('pointercancel', 終い)
    外す.current = () => {
      window.removeEventListener('pointermove', 動く)
      window.removeEventListener('pointerup', 離す)
      window.removeEventListener('pointercancel', 終い)
    }
  }

  const 出す = edgeFits(space)
  const 幅 = `${space}px`

  return (
    <div className="cardmove" ref={holdRef} onPointerDown={down}
         style={(() => {
           /* **数は `cardMove.js` 1か所から来る。** CSS にも書かない */
           if (fly) {
             return {
               transform: `translateX(${flyX(fly)})`,
               opacity: 0,
               transition: `transform ${FLY_MS}ms ease-in, opacity ${FLY_MS}ms ease-in`,
             }
           }
           /* ★ **引いている最中は、指についていく。**
                `transition` を付けない —— 付けると指より遅れて動き、
                **引っぱっているのに重い**と感じる */
           if (drag) return { transform: `translateX(${drag}px)`, transition: 'none' }
           /* **離して届かなかったときは、ここへ戻る**(戻る動きは見せる) */
           return undefined
         })()}>
      {children}
      {/* ★ **押せる帯は、この入れ物の中**(第5.417節)。
            窓に対して置くと、上の帯にも下のタブバーにもかかる。
            **幅が取れないときは、描かない** */}
      {出す && onPrev && (
        <button type="button" className="cardmove-edge cardmove-edge--l"
                style={{ width: 幅 }} aria-label="前へ" onClick={() => run('prev')} />
      )}
      {出す && onNext && (
        <button type="button" className="cardmove-edge cardmove-edge--r"
                style={{ width: 幅 }} aria-label="次へ" onClick={() => run('next')} />
      )}
    </div>
  )
}
