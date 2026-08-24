import { useState } from 'react'
import { formatMinutes } from '../../lib/format.js'

/**
 * 縦棒グラフ(日ごとの学習時間などに使用)
 *
 * data: [{ key, label, value }] の配列
 * 1系列だけなので凡例は付けません(タイトルが何のグラフか示しています)。
 */
export default function BarChart({
  data,
  unit = 'minutes',
  height = 160,
  emptyMessage = 'データがありません',
  labelEnds = false, // true にすると、最初と最後の棒に数値を直接表示する
}) {
  const [hover, setHover] = useState(null)

  const max = Math.max(1, ...data.map((d) => d.value))
  const hasData = data.some((d) => d.value > 0)

  const formatValue = (v) => (unit === 'minutes' ? formatMinutes(v) : `${v}点`)

  return (
    <div className={`chart${labelEnds ? ' chart--labeled' : ''}`}>
      <div className="chart-plot" style={{ height }} onMouseLeave={() => setHover(null)}>
        {/* 目盛り線(控えめに) */}
        <div className="chart-grid" aria-hidden="true">
          <span style={{ bottom: '100%' }} />
          <span style={{ bottom: '50%' }} />
          <span style={{ bottom: 0 }} />
        </div>

        {data.map((d, i) => (
          <div
            key={d.key}
            className="chart-col"
            onMouseEnter={() => setHover(d)}
            onFocus={() => setHover(d)}
            onBlur={() => setHover(null)}
            tabIndex={0}
            role="img"
            aria-label={`${d.label} ${formatValue(d.value)}`}
          >
            <div
              className={`chart-bar${hover?.key === d.key ? ' is-hover' : ''}`}
              style={{ height: `${(d.value / max) * 100}%` }}
            >
              {/* 全部に数値を書くと読みにくいので、最初と最後だけ表示する */}
              {labelEnds && (i === 0 || i === data.length - 1) && d.value > 0 && (
                <span className="chart-endlabel">{formatValue(d.value)}</span>
              )}
            </div>
          </div>
        ))}

        {hover && (
          <div className="chart-tooltip" role="status">
            <strong>{hover.label}</strong>
            <span>{formatValue(hover.value)}</span>
          </div>
        )}

        {!hasData && <p className="chart-empty">{emptyMessage}</p>}
      </div>

      <div className="chart-axis">
        {data.map((d, i) => (
          // ラベルが重ならないよう、本数が多いときは間引いて表示する
          <span key={d.key}>{data.length > 10 && i % 3 !== 0 ? '' : d.axisLabel ?? d.label}</span>
        ))}
      </div>
    </div>
  )
}
