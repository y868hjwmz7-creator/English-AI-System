import { useMemo, useState } from 'react'
import { categories, categoryColor, categoryLabel } from '../data/categories.js'
import { calculateStreak, formatMinutes, lastNDays, shortDate } from '../lib/format.js'
import BarChart from './charts/BarChart.jsx'
import HBarChart from './charts/HBarChart.jsx'

const RANGES = [
  { id: 7, label: '直近7日' },
  { id: 14, label: '直近14日' },
  { id: 30, label: '直近30日' },
]

/** トレーナー向けの管理画面 */
export default function AdminDashboard({ state }) {
  const [rangeDays, setRangeDays] = useState(14)
  const [selectedLearnerId, setSelectedLearnerId] = useState(null)

  const days = useMemo(() => lastNDays(rangeDays), [rangeDays])
  const daySet = useMemo(() => new Set(days), [days])

  const logsInRange = useMemo(
    () => state.studyLogs.filter((log) => daySet.has(log.studiedOn)),
    [state.studyLogs, daySet],
  )

  /** 生徒ごとの集計 */
  const learnerStats = useMemo(() => {
    return state.learners
      .map((learner) => {
        const logs = logsInRange.filter((log) => log.learnerId === learner.id)
        const allLogs = state.studyLogs.filter((log) => log.learnerId === learner.id)
        const attempts = state.pronunciationAttempts.filter((a) => a.learnerId === learner.id)
        const minutes = logs.reduce((sum, log) => sum + log.minutes, 0)
        const scores = attempts.map((a) => a.score)

        return {
          ...learner,
          minutes,
          sessions: logs.length,
          streak: calculateStreak(allLogs.map((log) => log.studiedOn)),
          lastStudiedOn: allLogs[0]?.studiedOn ?? null,
          averageScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
          attemptCount: attempts.length,
        }
      })
      .sort((a, b) => b.minutes - a.minutes)
  }, [state, logsInRange])

  const totalMinutes = logsInRange.reduce((sum, log) => sum + log.minutes, 0)
  const activeLearners = learnerStats.filter((l) => l.minutes > 0).length
  const selected = learnerStats.find((l) => l.id === selectedLearnerId) ?? null

  return (
    <div className="stack-lg">
      {/* 絞り込みは常にグラフの上に1列で置く */}
      <div className="filter-row">
        <span className="filter-label">表示期間</span>
        {RANGES.map((r) => (
          <button
            key={r.id}
            type="button"
            className={`btn btn--toggle${rangeDays === r.id ? ' is-active' : ''}`}
            onClick={() => setRangeDays(r.id)}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="stat-row">
        <Stat label="生徒の人数" value={state.learners.length} unit="人" />
        <Stat label="期間中に学習した人" value={activeLearners} unit="人" />
        <Stat label="期間中の合計学習時間" value={formatMinutes(totalMinutes)} />
        <Stat
          label="1人あたり平均"
          value={formatMinutes(state.learners.length ? Math.round(totalMinutes / state.learners.length) : 0)}
        />
      </div>

      <div className="grid-2">
        <section className="card">
          <h2 className="card-title">全体の学習時間の推移</h2>
          <BarChart
            data={days.map((day) => ({
              key: day,
              label: shortDate(day),
              axisLabel: shortDate(day),
              value: logsInRange.filter((log) => log.studiedOn === day).reduce((sum, log) => sum + log.minutes, 0),
            }))}
          />
        </section>

        <section className="card">
          <h2 className="card-title">生徒別の学習時間</h2>
          <HBarChart
            data={learnerStats.map((l) => ({ key: l.id, label: l.name, value: l.minutes }))}
            emptyMessage="この期間に学習記録がありません。"
          />
        </section>
      </div>

      <section className="card">
        <h2 className="card-title">生徒一覧</h2>
        <p className="card-hint">名前をクリックすると、その生徒の内訳を表示します。</p>

        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>生徒</th>
                <th>レベル</th>
                <th className="num">期間中の学習時間</th>
                <th className="num">記録件数</th>
                <th className="num">連続学習日数</th>
                <th>最終学習日</th>
                <th className="num">発音スコア平均</th>
              </tr>
            </thead>
            <tbody>
              {learnerStats.map((l) => (
                <tr
                  key={l.id}
                  className={`is-clickable${selectedLearnerId === l.id ? ' is-selected' : ''}`}
                  onClick={() => setSelectedLearnerId(selectedLearnerId === l.id ? null : l.id)}
                >
                  <td>
                    <button type="button" className="btn btn--link">{l.name}</button>
                  </td>
                  <td>{l.grade}</td>
                  <td className="num">{formatMinutes(l.minutes)}</td>
                  <td className="num">{l.sessions}件</td>
                  <td className="num">{l.streak}日</td>
                  <td>
                    {l.lastStudiedOn ?? '—'}
                    {isStale(l.lastStudiedOn) && <span className="badge badge--alert">要フォロー</span>}
                  </td>
                  <td className="num">
                    {l.averageScore === null ? '—' : `${l.averageScore}点`}
                    {l.averageScore !== null && <small className="muted"> ※仮</small>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {selected && <LearnerDetail learner={selected} state={state} days={days} />}
    </div>
  )
}

/** 最終学習日から5日以上空いていたら「要フォロー」とする */
function isStale(lastStudiedOn) {
  if (!lastStudiedOn) return true
  const diffDays = (Date.now() - new Date(lastStudiedOn).getTime()) / (1000 * 60 * 60 * 24)
  return diffDays >= 5
}

function Stat({ label, value, unit = '' }) {
  return (
    <div className="stat">
      <p className="stat-label">{label}</p>
      <p className="stat-value">
        {value}
        {unit && <span className="stat-unit">{unit}</span>}
      </p>
    </div>
  )
}

/** 選ばれた生徒の詳細 */
function LearnerDetail({ learner, state, days }) {
  const logs = state.studyLogs.filter((log) => log.learnerId === learner.id)
  const daySet = new Set(days)
  const logsInRange = logs.filter((log) => daySet.has(log.studiedOn))
  const attempts = state.pronunciationAttempts.filter((a) => a.learnerId === learner.id).slice(0, 10).reverse()

  return (
    <section className="card card--highlight">
      <h2 className="card-title">{learner.name} さんの内訳</h2>

      <div className="grid-2">
        <div className="chart-block">
          <h3 className="chart-title">日ごとの学習時間</h3>
          <BarChart
            data={days.map((day) => ({
              key: day,
              label: shortDate(day),
              axisLabel: shortDate(day),
              value: logsInRange.filter((log) => log.studiedOn === day).reduce((sum, log) => sum + log.minutes, 0),
            }))}
          />
        </div>

        <div className="chart-block">
          <h3 className="chart-title">カテゴリ別(期間中)</h3>
          <HBarChart
            data={categories.map((cat) => ({
              key: cat.id,
              label: cat.label,
              color: cat.color,
              value: logsInRange.filter((log) => log.category === cat.id).reduce((sum, log) => sum + log.minutes, 0),
            }))}
            emptyMessage="この期間に学習記録がありません。"
          />
        </div>
      </div>

      {attempts.length > 0 && (
        <div className="chart-block">
          <h3 className="chart-title">
            発音スコアの推移 <span className="badge badge--warn">シミュレーション値</span>
          </h3>
          <BarChart
            unit="score"
            height={110}
            labelEnds
            data={attempts.map((a, i) => ({ key: a.id, label: `${i + 1}回目`, axisLabel: '', value: a.score }))}
          />
        </div>
      )}

      <div className="chart-block">
        <h3 className="chart-title">直近の記録</h3>
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>学習日</th>
                <th>カテゴリ</th>
                <th className="num">時間</th>
                <th>教材</th>
              </tr>
            </thead>
            <tbody>
              {logs.slice(0, 8).map((log) => (
                <tr key={log.id}>
                  <td>{log.studiedOn}</td>
                  <td>
                    <span className="chip-dot" style={{ background: categoryColor(log.category) }} aria-hidden="true" />
                    {categoryLabel(log.category)}
                  </td>
                  <td className="num">{formatMinutes(log.minutes)}</td>
                  <td>{log.material || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
