/**
 * トレーナーの「生徒」画面。
 *
 * レッスン前に開く画面。担当している生徒のレベル(CEFR)と
 * 最新の TOEIC / VERSANT が一目で分かるようにする。
 * レベルの物差しは教材と同じ CEFR にそろえてある。
 */
import { useEffect, useState } from 'react'
import { CEFR_LEVELS, SCORE_TESTS, cefrLabel, scoreTestLabel } from '../data/cefr.js'
import {
  addLearnerScore, loadMyLearnersDetailed, loadScoreHistory,
  setLearnerCefr, setLearnerStatus,
} from '../lib/materials.js'

const STATUS = {
  active:   { label: '受講中', cls: 'badge--admin' },
  paused:   { label: '休会中', cls: 'badge--warn' },
  inactive: { label: '退会済', cls: 'badge--learner' },
}

const today = () => new Date().toISOString().slice(0, 10)

export default function TrainerLearners({ me }) {
  const [learners, setLearners] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)
  const [openId, setOpenId] = useState(null)
  const [history, setHistory] = useState([])

  // スコアを入れるための一時的な入力欄
  const [form, setForm] = useState({ testType: 'toeic', score: '', takenOn: today() })

  const reload = async () => {
    const { data, error: e } = await loadMyLearnersDetailed()
    setLoading(false)
    if (e) { setError(e); return }
    setError(null)
    setLearners(data)
  }
  useEffect(() => { reload() }, [])

  const openDetail = async (id) => {
    setOpenId(id)
    setMessage(null)
    setForm({ testType: 'toeic', score: '', takenOn: today() })
    const { data } = await loadScoreHistory(id)
    setHistory(data ?? [])
  }

  const changeCefr = async (learner, cefr) => {
    const { error: e } = await setLearnerCefr(learner.id, cefr)
    if (e) { setError(e); return }
    setError(null)
    setMessage(`${learner.display_name} さんのレベルを ${cefr || '未判定'} にしました。`)
    reload()
  }

  const changeStatus = async (learner, status) => {
    const note = window.prompt(
      `${learner.display_name} さんを「${STATUS[status].label}」にします。理由をひとこと(任意)`,
      status === 'paused' ? '月額コース休止中' : status === 'inactive' ? '退会' : '',
    )
    if (note === null) return   // 取り消し
    const { error: e } = await setLearnerStatus(learner.id, status, note)
    if (e) { setError(e); return }
    setError(null)
    setMessage(`${learner.display_name} さんを「${STATUS[status].label}」にしました。`)
    reload()
  }

  const submitScore = async (learner) => {
    const { error: e } = await addLearnerScore({
      learnerId: learner.id, testType: form.testType,
      score: form.score, takenOn: form.takenOn, recordedBy: me.id,
    })
    if (e) { setError(e); return }
    setError(null)
    setMessage(`${scoreTestLabel(form.testType)} ${form.score} を記録しました。`)
    setForm({ ...form, score: '' })
    openDetail(learner.id)
    reload()
  }

  if (loading) return <p className="muted">読み込み中…</p>

  return (
    <div className="stack">
      {message && <div className="notice notice--ok">{message}</div>}
      {error && <div className="notice notice--warn" role="alert">{error}</div>}

      <div className="card">
        <h2 className="card-title">担当している生徒</h2>
        {learners.length === 0 ? (
          <p className="card-hint">
            まだ担当している生徒がいません。生徒のアカウントを作ると、ここに並びます。
          </p>
        ) : (
          <p className="card-hint">
            {learners.length} 人 / 受講中 {learners.filter((l) => l.status === 'active').length} 人
          </p>
        )}
      </div>

      {learners.map((l) => {
        const toeic = l.scores.toeic
        const versant = l.scores.versant
        return (
          <div key={l.id} className="card learner-card">
            <div className="material-head">
              <h3 className="card-title">
                {l.display_name}
                <span className={`badge ${STATUS[l.status]?.cls ?? ''}`}>
                  {STATUS[l.status]?.label ?? l.status}
                </span>
              </h3>
              <span className="muted">{cefrLabel(l.cefr)}</span>
            </div>

            {l.status_note && <p className="field-hint">{l.status_note}</p>}
            {l.handoverNote && (
              <p className="homework-instruction">引き継ぎ: {l.handoverNote}</p>
            )}

            <div className="score-row">
              <div className="score-cell">
                <span className="score-label">TOEIC</span>
                <span className="score-value">{toeic ? toeic.score : '—'}</span>
                {toeic && <span className="muted">{toeic.takenOn}</span>}
              </div>
              <div className="score-cell">
                <span className="score-label">VERSANT</span>
                <span className="score-value">{versant ? versant.score : '—'}</span>
                {versant && <span className="muted">{versant.takenOn}</span>}
              </div>
            </div>

            {openId === l.id ? (
              <div className="assign-box">
                <p className="field-label">レベル(CEFR)</p>
                <div className="btn-row">
                  {CEFR_LEVELS.map((c) => (
                    <button key={c.id} type="button" title={c.ja}
                            className={`btn btn--toggle${l.cefr === c.id ? ' is-active' : ''}`}
                            onClick={() => changeCefr(l, c.id)}>
                      {c.label}
                    </button>
                  ))}
                  <button type="button" className="btn btn--link"
                          onClick={() => changeCefr(l, null)}>未判定に戻す</button>
                </div>

                <p className="field-label">スコアを記録する</p>
                <div className="filter-row">
                  <select value={form.testType}
                          onChange={(e) => setForm({ ...form, testType: e.target.value })}>
                    {SCORE_TESTS.map((t) => (
                      <option key={t.id} value={t.id}>{t.label}</option>
                    ))}
                  </select>
                  <input type="number" className="score-input" placeholder="スコア"
                         value={form.score}
                         onChange={(e) => setForm({ ...form, score: e.target.value })} />
                  <input type="date" value={form.takenOn}
                         onChange={(e) => setForm({ ...form, takenOn: e.target.value })} />
                  <button type="button" className="btn btn--small" onClick={() => submitScore(l)}>
                    記録する
                  </button>
                </div>
                <p className="field-hint">
                  TOEIC は 10〜990、VERSANT は 20〜80。範囲の外は登録できません。
                </p>

                {history.length > 0 && (
                  <>
                    <p className="field-label">これまでのスコア</p>
                    <ul className="score-history">
                      {history.map((h) => (
                        <li key={h.id}>
                          {h.taken_on} — {scoreTestLabel(h.test_type)} <strong>{Number(h.score)}</strong>
                          {h.note && <span className="muted"> {h.note}</span>}
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                <p className="field-label">在籍状態</p>
                <div className="btn-row">
                  {['active', 'paused', 'inactive'].map((st) => (
                    <button key={st} type="button"
                            className={`btn btn--toggle${l.status === st ? ' is-active' : ''}`}
                            onClick={() => l.status !== st && changeStatus(l, st)}>
                      {STATUS[st].label}
                    </button>
                  ))}
                </div>

                <div className="btn-row">
                  <button type="button" className="btn" onClick={() => setOpenId(null)}>閉じる</button>
                </div>
              </div>
            ) : (
              <button type="button" className="btn btn--small" onClick={() => openDetail(l.id)}>
                レベル・スコアを記録する
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
