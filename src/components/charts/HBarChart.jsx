import { formatMinutes } from '../../lib/format.js'

/**
 * 横棒グラフ(カテゴリ別・生徒別の内訳などに使用)
 *
 * 項目名と数値を棒のすぐ横に文字で出しているため、
 * 色が見分けにくい方でも内容が分かるようにしています。
 *
 * data: [{ key, label, value, color }] の配列
 */
export default function HBarChart({ data, unit = 'minutes', emptyMessage = 'データがありません' }) {
  const max = Math.max(1, ...data.map((d) => d.value))
  const hasData = data.some((d) => d.value > 0)

  const formatValue = (v) => {
    if (unit === 'minutes') return formatMinutes(v)
    if (unit === 'count') return `${v}件`
    return `${v}`
  }

  if (!hasData) return <p className="chart-empty chart-empty--block">{emptyMessage}</p>

  return (
    <ul className="hbar">
      {data.map((d) => (
        <li key={d.key} className="hbar-row">
          <span className="hbar-label">{d.label}</span>
          <span className="hbar-track">
            <span
              className="hbar-fill"
              style={{ width: `${(d.value / max) * 100}%`, background: d.color ?? 'var(--series-1)' }}
            />
          </span>
          <span className="hbar-value">{formatValue(d.value)}</span>
        </li>
      ))}
    </ul>
  )
}
