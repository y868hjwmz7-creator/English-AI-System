/**
 * タブ。画面の切り替えにも、教材の中の切り替えにも使う。
 *
 * 【なぜ1つにまとめたか】
 *   画面ごとに別々の見た目で作ると、同じ「切り替え」なのに操作感が変わる。
 *   利用者から「タブでもう少し見やすくしたい」と要望があり(2026-08)、
 *   トレーナー画面とゲスト画面の両方に入れるため、部品を1つにした。
 *
 * 【スマホでの決まりごと】
 *   タブは**折り返さない。** 折り返すと「教」「材」のように縦に割れ、
 *   何のタブか読めなくなる(実機で確認)。入りきらないときは
 *   **横に流して、指でなぞって選ぶ**形にする。
 */
import { useEffect, useRef } from 'react'

export default function Tabs({
  items, value, onChange, ariaLabel = '切り替え', variant = 'main',
}) {
  const barRef = useRef(null)
  const list = (items ?? []).filter(Boolean)

  // 選んでいるタブが画面の外にあると、いまどこにいるか分からない。
  // 横に流れるので、選ばれたタブを見える位置まで寄せる。
  useEffect(() => {
    const active = barRef.current?.querySelector('.is-active')
    active?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [value])

  if (list.length < 2) return null

  return (
    <nav
      ref={barRef}
      className={`tabbar tabbar--${variant}`}
      aria-label={ariaLabel}
      role="tablist"
    >
      {list.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={value === item.id}
          className={`tabbar-tab${value === item.id ? ' is-active' : ''}`}
          onClick={() => onChange(item.id)}
        >
          {item.label}
          {item.count != null && <span className="tabbar-count">{item.count}</span>}
        </button>
      ))}
    </nav>
  )
}
