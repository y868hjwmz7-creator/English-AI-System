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
  FLY_MS, edgeFits, edgeSpace, flyX, isCoarse, keyMove, swipeMove,
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
  /** スワイプで判定したあと、その向きへ流す */
  const [fly, setFly] = useState('')

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
  const down = (e) => {
    if (!on || !isCoarse()) return
    /* **英文の上から始まった動きは、なぞる操作である**(第5.17節)。
       ここで判定に取ると、語を選ぶたびにカードが飛ぶ */
    try { if (e.target?.closest?.('.etext')) return } catch { /* 下で拾う */ }
    指.current = { x: e.clientX, y: e.clientY, t: Date.now() }
  }
  const up = (e) => {
    const from = 指.current
    指.current = null
    if (!from) return
    const move = swipeMove({
      dx: e.clientX - from.x, dy: e.clientY - from.y, ms: Date.now() - from.t,
    })
    if (!move) return
    /* ★ **その向きへ流して、すぐ送る**(2026-10-07 利用者の指定)。
         **ボタンで押したときは流さない** —— 指がボタンの上にあるので、
         動かすと次の問のボタンが指の下に来る(共通ルール)。
         **ここへ来るのは `prev` / `next` だけ**(`swipeMove` は
         判定を返さない・2026-10-08 の仕様変更) */
    setFly(move)
    window.setTimeout(() => { setFly(''); run(move) }, FLY_MS)
  }

  const 出す = edgeFits(space)
  const 幅 = `${space}px`

  return (
    <div className="cardmove" ref={holdRef}
         onPointerDown={down} onPointerUp={up}
         onPointerCancel={() => { 指.current = null }}
         style={fly ? {
           /* **数は `cardMove.js` 1か所から来る。** CSS にも書かない */
           transform: `translateX(${flyX(fly)})`,
           opacity: 0,
           transition: `transform ${FLY_MS}ms ease-in, opacity ${FLY_MS}ms ease-in`,
         } : undefined}>
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
