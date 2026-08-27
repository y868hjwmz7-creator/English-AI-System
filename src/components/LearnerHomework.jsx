/**
 * 生徒の「今週の宿題」画面。
 *
 * 配信された教材を並べ、取り組んだら「やった」を記録する。
 * 生徒が書き換えられるのはこの記録だけで、
 * 提出期限やトレーナーの確認印には触れられない(列単位の権限で絞ってある)。
 */
import { useEffect, useState } from 'react'
import { kindLabel, levelLabel, loadMyAssignments, markAssignmentDone } from '../lib/materials.js'

const formatDate = (iso) => (iso ? new Date(iso).toLocaleDateString('ja-JP') : '')

export default function LearnerHomework() {
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [openId, setOpenId] = useState(null)

  const reload = async () => {
    const { data, error: e } = await loadMyAssignments()
    setLoading(false)
    if (e) { setError(e); return }
    setError(null)
    setAssignments(data)
  }

  useEffect(() => { reload() }, [])

  const toggleDone = async (assignment) => {
    const next = !assignment.learner_done_at
    // 押した手ごたえをすぐ返す。失敗したら読み直して元に戻す。
    setAssignments((list) => list.map((a) =>
      a.id === assignment.id
        ? { ...a, learner_done_at: next ? new Date().toISOString() : null }
        : a))
    const { error: e } = await markAssignmentDone(assignment.id, next)
    if (e) { setError(e); reload() }
  }

  if (loading) return <p className="muted">読み込み中…</p>

  const todo = assignments.filter((a) => !a.learner_done_at)
  const done = assignments.filter((a) => a.learner_done_at)

  return (
    <div className="stack">
      {error && <div className="notice notice--warn" role="alert">{error}</div>}

      <div className="card">
        <h2 className="card-title">今週の宿題</h2>
        {assignments.length === 0 ? (
          <p className="card-hint">
            まだ宿題は配信されていません。次のレッスンのあとに届きます。
          </p>
        ) : (
          <p className="card-hint">
            残り <strong>{todo.length}</strong> 件 / 全 {assignments.length} 件
          </p>
        )}
      </div>

      {[['取り組む', todo], ['やったもの', done]].map(([label, list]) => (
        list.length > 0 && (
          <section key={label} className="stack">
            <h3 className="section-title">{label}({list.length})</h3>
            {list.map((a) => (
              <div key={a.id} className={`card homework-card${a.learner_done_at ? ' is-done' : ''}`}>
                <div className="material-head">
                  <h4 className="card-title">{a.material?.title ?? '(教材が見つかりません)'}</h4>
                  <span className="muted">
                    {a.material && `${levelLabel(a.material.level)} / ${kindLabel(a.material.kind)}`}
                  </span>
                </div>

                <p className="card-hint">
                  配信 {formatDate(a.assigned_at)}
                  {a.due_on && ` / 次のレッスン ${a.due_on}`}
                </p>

                {a.material?.instruction_ja && (
                  <p className="homework-instruction">{a.material.instruction_ja}</p>
                )}

                {openId === a.id ? (
                  <>
                    <ol className="material-preview">
                      {a.material?.items.map((it) => (
                        <li key={it.id}>
                          <span lang="en" className="homework-en">{it.text_en}</span>
                          {it.text_ja && <div className="muted">{it.text_ja}</div>}
                          {it.note_ja && <div className="field-hint">{it.note_ja}</div>}
                        </li>
                      ))}
                    </ol>
                    <button type="button" className="btn btn--link" onClick={() => setOpenId(null)}>
                      閉じる
                    </button>
                  </>
                ) : (
                  <button type="button" className="btn btn--small" onClick={() => setOpenId(a.id)}>
                    英文を見る({a.material?.items.length ?? 0} 文)
                  </button>
                )}

                <div className="btn-row">
                  <button
                    type="button"
                    className={`btn ${a.learner_done_at ? '' : 'btn--primary'}`}
                    onClick={() => toggleDone(a)}
                  >
                    {a.learner_done_at ? '「やった」を取り消す' : 'やった'}
                  </button>
                  {a.learner_done_at && (
                    <span className="muted">{formatDate(a.learner_done_at)} に記録</span>
                  )}
                </div>
              </div>
            ))}
          </section>
        )
      ))}
    </div>
  )
}
