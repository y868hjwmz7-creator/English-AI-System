/**
 * 紙の上への書き込み(ペン)。
 *
 * 【なぜ要るか】(2026-09 利用者の指定)
 *
 *   > セッションの実施中にゲストと画面共有で何かしらのトレーニングを
 *   > している際、ペンツールから画面に書き込んだ際、画面をスクロールすると
 *   > 書き込んだ内容だけが同じ場所にとどまり続けてしまうのですが、
 *   > これを解消できませんか?
 *
 *   会議アプリ(Zoom・Teams など)のペンは、**画面のガラス面**に描いている。
 *   こちらのページを送っても、書き込みは画面に貼り付いたまま動かない。
 *   **向こうの仕組みなので、こちらからは直せない。**
 *
 *   そこで**紙の中に描く層**をこちらで持つ。紙と一緒に送られるので、
 *   線は英文にくっついて動く。
 *
 * 【どこに置くか】
 *   `.lesson-sheet`(送る箱)の**中**に、`position: absolute` で敷く。
 *   送る箱の中に入れてあるので、**中身と一緒に動く。**
 *   高さは中身の丈(`scrollHeight`)に合わせる。
 *
 * 【触れるのはペンを持っているあいだだけ】
 *   ふだんは `pointer-events: none`。そうしないと、語に触れて意味を出す・
 *   なぞって調べる・解答を開く、が全部できなくなる。
 *
 * 【残さない】
 *   書き込みは**この表示を閉じるまで**のもの。保存はしない。
 *   レッスン中の板書であって、教材そのものではない。
 *   残したいことは「メモ」に書く(そちらは日付ごとに保存される)。
 */
import { useEffect, useRef, useState } from 'react'

/** 線をなめらかに見せる最小の間隔(これ未満の動きは点として捨てる) */
const MIN_STEP = 1.5

export default function InkLayer({
  /** 描く紙(送る箱)の DOM */
  sheetRef,
  /** ペンを持っているか */
  active = false,
  color = '#e0483f',
  width = 3,
  /** いまの線。`[{ color, width, points: [[x, y], …] }, …]` */
  strokes = [],
  onChange,
}) {
  const [size, setSize] = useState({ w: 0, h: 0 })
  const drawing = useRef(null)

  /* 紙の中身の丈に合わせる。**送っても足りなくならないよう `scrollHeight`。**
     文字の大きさを変えたりページを送ったりすると丈が変わるので、
     見張って測り直す */
  useEffect(() => {
    const el = sheetRef?.current
    if (!el) return undefined
    const measure = () => setSize({ w: el.scrollWidth, h: el.scrollHeight })
    measure()
    const ro = new window.ResizeObserver(measure)
    ro.observe(el)
    // 中身が増えても丈は変わる。子の入れ替わりも見張る
    const mo = new window.MutationObserver(measure)
    mo.observe(el, { childList: true, subtree: true, characterData: true })
    return () => { ro.disconnect(); mo.disconnect() }
  }, [sheetRef])

  /** 画面の座標を、紙の中の座標に直す(送った量を足す) */
  const at = (e) => {
    const el = sheetRef?.current
    if (!el) return [0, 0]
    const r = el.getBoundingClientRect()
    return [
      e.clientX - r.left + el.scrollLeft,
      e.clientY - r.top + el.scrollTop,
    ]
  }

  const down = (e) => {
    if (!active) return
    e.preventDefault()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    drawing.current = { color, width, points: [at(e)] }
    onChange?.([...strokes, drawing.current])
  }

  const move = (e) => {
    if (!active || !drawing.current) return
    e.preventDefault()
    const p = at(e)
    const last = drawing.current.points[drawing.current.points.length - 1]
    // 細かすぎる動きは捨てる。点が増えすぎると、あとで消すのも重くなる
    if (Math.hypot(p[0] - last[0], p[1] - last[1]) < MIN_STEP) return
    drawing.current.points.push(p)
    onChange?.([...strokes.slice(0, -1), { ...drawing.current }])
  }

  const up = () => { drawing.current = null }

  return (
    <svg
      className={`ink-layer no-print${active ? ' is-active' : ''}`}
      width={size.w || '100%'}
      height={size.h || '100%'}
      viewBox={size.w ? `0 0 ${size.w} ${size.h}` : undefined}
      /* 読み上げ機には何も伝えない。**線は絵であって、文ではない** */
      aria-hidden="true"
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
    >
      {strokes.map((s, i) => (
        <polyline
          key={i}
          points={s.points.map(([x, y]) => `${x},${y}`).join(' ')}
          fill="none"
          stroke={s.color}
          strokeWidth={s.width}
          strokeLinecap="round"
          strokeLinejoin="round"
          /* 1点だけのときも見えるように(点を打っただけ) */
          strokeDasharray={s.points.length === 1 ? '0.1 0' : undefined}
        />
      ))}
    </svg>
  )
}
