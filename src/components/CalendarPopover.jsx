/**
 * カレンダーの吹き出し(日付で絞る)。
 *
 * 【なぜ部品にしたか】(2026-08 利用者の指定)
 *   単語帳と、ゲストの過去の宿題の**両方**で使う。
 *   **同じ見た目を2か所に書き写さない**(CLAUDE.md)。
 *
 * 【中に「並び順」も入れられる】
 *   > ここも日付のタブを入れ、その中に新しい順、古い順の機能を
 *   > まとめてくれ。
 *   日付にまつわる操作は、日付の吹き出しの中にまとめる。
 *   `sortOptions` を渡したときだけ出す。
 */
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { toDateKey } from '../lib/format.js'

/** 月の初日から並べた、6週ぶんのマス(前後の月は null で埋める) */
function monthGrid(year, month) {
  const first = new Date(year, month, 1)
  const lead = first.getDay()                 // 日曜始まり
  const days = new Date(year, month + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < lead; i += 1) cells.push(null)
  for (let d = 1; d <= days; d += 1) cells.push(new Date(year, month, d))
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

const WEEK = ['日', '月', '火', '水', '木', '金', '土']

/**
 * カレンダーの吹き出し。
 *
 * **語が入っている日にだけ印を付け、無い日は押せない。**
 * 押せない日を押せるように見せると、押して何も起きない目に遭う。
 */
export default function CalendarPopover({
  anchorEl, days, value, onPick, onClose,
  sort = null, onSort = null, sortOptions = [],
}) {
  const [at, setAt] = useState(() => {
    const base = value ? new Date(value) : (days[0] ? new Date(days[0]) : new Date())
    return { y: base.getFullYear(), m: base.getMonth() }
  })
  const boxRef = useRef(null)
  const has = new Set(days)

  // 外側を押す・Esc で閉じる。**吹き出しの中は「外側」ではない**
  useEffect(() => {
    const onDown = (e) => { if (!boxRef.current?.contains(e.target)) onClose() }
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    // 開いたその指離しで閉じないよう、次の間合いから見張る
    const t = window.setTimeout(() => {
      document.addEventListener('pointerdown', onDown)
    }, 0)
    document.addEventListener('keydown', onKey)
    return () => {
      window.clearTimeout(t)
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  /* 出す場所。**紙(`.lesson-sheet`)などに切られないよう body の直下に出す。**

     **画面から はみ出させない**(2026-08 利用者の指定)。
       > スクロールが下に入っている時に日付を選ぼうとすると
       > ちゃんと表示されません。常に全体が映るように。

     以前は「ボタンの下」に決め打ちで出していたので、
     ボタンが画面の下のほうにあると**カレンダーの下半分が画面の外**に出て、
     日を押せなかった。`position: fixed` なので画面を送っても追いかけてくる。

     ① まず自分の高さを測る(`boxRef` は描いたあとに入る)
     ② 下に入らなければ**ボタンの上**に出す
     ③ それでも入らなければ、入るところまで押し上げる */
  const [pos, setPos] = useState(null)
  useEffect(() => {
    const place = () => {
      const r = anchorEl?.getBoundingClientRect()
      const h = boxRef.current?.offsetHeight ?? 320
      const w = boxRef.current?.offsetWidth ?? 300
      const margin = 8
      if (!r) { setPos({ top: margin, left: margin }); return }
      const below = window.innerHeight - r.bottom - margin
      const top = below >= h
        ? r.bottom + 6                                  // ① 下に入る
        : r.top - 6 - h >= margin
          ? r.top - 6 - h                               // ② 上に入る
          : Math.max(margin, window.innerHeight - h - margin)  // ③ 押し上げる
      setPos({
        top,
        left: Math.max(margin, Math.min(r.left, window.innerWidth - w - margin)),
      })
    }
    place()
    // 画面を送ったり、向きを変えたりしたら置き直す
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [anchorEl, at])
  // **測る前は描かない。** 一度どこかに出してから動かすと、ちらつく
  const style = pos
    ? { ...pos, visibility: 'visible' }
    : { top: 0, left: 0, visibility: 'hidden' }

  const cells = monthGrid(at.y, at.m)
  const move = (d) => setAt(({ y, m }) => {
    const next = new Date(y, m + d, 1)
    return { y: next.getFullYear(), m: next.getMonth() }
  })

  return createPortal(
    <div className="wbcal" style={style} ref={boxRef} role="dialog" aria-label="日付で絞る">
      <div className="wbcal-head">
        <button type="button" className="btn btn--ghost btn--small" onClick={() => move(-1)}
                aria-label="前の月">‹</button>
        <span className="wbcal-title">{at.y} 年 {at.m + 1} 月</span>
        <button type="button" className="btn btn--ghost btn--small" onClick={() => move(1)}
                aria-label="次の月">›</button>
      </div>
      <div className="wbcal-week">
        {WEEK.map((w) => <span key={w}>{w}</span>)}
      </div>
      <div className="wbcal-grid">
        {cells.map((d, i) => {
          if (!d) return <span key={i} className="wbcal-cell is-empty" />
          const key = toDateKey(d)
          const on = has.has(key)
          return (
            <button
              key={key}
              type="button"
              className={`wbcal-cell${on ? ' has-words' : ''}${value === key ? ' is-on' : ''}`}
              disabled={!on}
              onClick={() => { onPick(key); onClose() }}
            >
              {d.getDate()}
            </button>
          )
        })}
      </div>
      {/* **並び順も、この吹き出しの中に**(2026-08 利用者の指定)。
          日付にまつわる操作を1か所にまとめる */}
      {onSort && sortOptions.length > 0 && (
        <div className="wbcal-sort">
          {sortOptions.map((o) => (
            <button key={o.id} type="button"
                    className={`chip${sort === o.id ? ' chip--on' : ''}`}
                    onClick={() => onSort(o.id)}>
              {o.label}
            </button>
          ))}
        </div>
      )}
      <div className="wbcal-foot">
        <button type="button" className="btn btn--ghost btn--small"
                onClick={() => { onPick(null); onClose() }}>
          すべての日
        </button>
      </div>
    </div>,
    document.body,
  )
}

