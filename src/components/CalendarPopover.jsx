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
import { useState } from 'react'
import { toDateKey } from '../lib/format.js'
import Popover from './Popover.jsx'

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
  const has = new Set(days)

  /* **出す場所の決め方と閉じ方は `Popover` に置いてある。**
     同じ決まりを2か所に持たない(CLAUDE.md)。
     月を変えると高さが変わるので、`placeKey` で置き直させる */

  const cells = monthGrid(at.y, at.m)
  const move = (d) => setAt(({ y, m }) => {
    const next = new Date(y, m + d, 1)
    return { y: next.getFullYear(), m: next.getMonth() }
  })

  return (
    <Popover anchorEl={anchorEl} onClose={onClose} className="wbcal"
             label="日付で絞る" placeKey={`${at.y}-${at.m}`}>
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
    </Popover>
  )
}

