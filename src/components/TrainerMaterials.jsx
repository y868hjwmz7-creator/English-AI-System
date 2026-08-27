/**
 * トレーナーの教材画面。
 *
 * 【設計の要件】(仕様書 第5.5節)
 *   既定の動線は「ライブラリから探す」。新しく作るのは2番目に置く。
 *   逆にすると毎回作ってしまい、再利用率が上がらない。
 *   トレーナー1人あたり週60レッスンを抱えるため、再利用が効かないと
 *   教材づくりに週9時間かかり、この仕組みは回らない。
 */
import { useEffect, useState } from 'react'
import MaterialForm from './MaterialForm.jsx'
import WeaknessTagPicker from './WeaknessTagPicker.jsx'
import { weaknessTagLabel } from '../data/weaknessTags.js'
import { CEFR_LEVELS, cefrLabel } from '../data/cefr.js'
import { INDUSTRIES, industryLabel } from '../data/industries.js'
import { assignMaterial, kindLabel, loadMyLearners, searchMaterials } from '../lib/materials.js'

export default function TrainerMaterials({ me }) {
  const [mode, setMode] = useState('search')      // 'search' | 'create'
  const [tagIds, setTagIds] = useState([])
  const [level, setLevel] = useState(null)
  const [keyword, setKeyword] = useState('')
  const [industry, setIndustry] = useState('')

  const [materials, setMaterials] = useState([])
  const [learners, setLearners] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [assigningId, setAssigningId] = useState(null)   // 配信先を選んでいる教材
  const [picked, setPicked] = useState([])
  const [message, setMessage] = useState(null)

  const search = async () => {
    setLoading(true)
    setError(null)
    const { data, error: e } = await searchMaterials({ tagIds, level, keyword, industry })
    setLoading(false)
    if (e) { setError(e); return }
    setMaterials(data)
  }

  // 絞り込みが変わったら探し直す。search 自体は毎回作り直されるので依存に入れない。
  useEffect(() => { search() }, [tagIds, level, industry])

  useEffect(() => {
    loadMyLearners().then(({ data, error: e }) => {
      if (e) setError(e)
      else setLearners(data)
    })
  }, [])

  const startAssign = (materialId) => {
    setAssigningId(materialId)
    setPicked([])
    setMessage(null)
  }

  const doAssign = async () => {
    const { data, error: e } = await assignMaterial({
      materialId: assigningId, learnerIds: picked, assignedBy: me.id,
    })
    if (e) { setError(e); return }
    setError(null)
    setMessage(`${data.count} 人に配信しました。`)
    setAssigningId(null)
    setPicked([])
  }

  if (mode === 'create') {
    return (
      <MaterialForm
        createdBy={me.id}
        onCancel={() => setMode('search')}
        onCreated={() => { setMode('search'); setMessage('教材を発行しました。'); search() }}
      />
    )
  }

  const active = learners.filter((l) => l.status === 'active')
  const notActive = learners.filter((l) => l.status !== 'active')

  return (
    <div className="stack">
      <div className="card">
        <h2 className="card-title">教材をさがす</h2>
        <p className="card-hint">
          レッスンで指摘した弱点を選ぶと、その弱点の教材が出ます。
          <strong>あればそのまま配信できます。</strong>作るより速く、生徒には同じ価値が届きます。
        </p>

        {/* さがす場面では基礎練習(子音全般・母音全般)も選べる。
            弱点として指摘する場面では出さない(粒度が違うため)。 */}
        <WeaknessTagPicker selected={tagIds} onChange={setTagIds} includeDrills />

        <div className="filter-row material-filter">
          <span className="filter-label">レベル</span>
          <button type="button" className={`btn btn--toggle${level === null ? ' is-active' : ''}`}
                  onClick={() => setLevel(null)}>すべて</button>
          {CEFR_LEVELS.map((l) => (
            <button key={l.id} type="button"
                    className={`btn btn--toggle${level === l.id ? ' is-active' : ''}`}
                    onClick={() => setLevel(l.id)} title={l.ja}>{l.label}</button>
          ))}
          <span className="filter-label">業界</span>
          <select value={industry} onChange={(e) => setIndustry(e.target.value)}>
            <option value="">すべて</option>
            {INDUSTRIES.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
          </select>
          <input className="material-keyword" value={keyword} placeholder="教材名で絞る"
                 onChange={(e) => setKeyword(e.target.value)}
                 onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); search() } }} />
          <button type="button" className="btn btn--small" onClick={search}>さがす</button>
        </div>
      </div>

      {message && <div className="notice notice--ok">{message}</div>}
      {error && <div className="notice notice--warn" role="alert">{error}</div>}

      {loading ? (
        <p className="muted">読み込み中…</p>
      ) : materials.length === 0 ? (
        <div className="card">
          <p className="card-hint">
            {tagIds.length
              ? 'この弱点の教材はまだありません。最初の1つを作ると、次からは全トレーナーがすぐ使えます。'
              : '教材がまだありません。'}
          </p>
          <button type="button" className="btn btn--primary" onClick={() => setMode('create')}>
            この弱点の教材を新しく作る
          </button>
        </div>
      ) : (
        <>
          <p className="muted">{materials.length} 件</p>
          {materials.map((m) => (
            <div key={m.id} className="card material-card">
              <div className="material-head">
                <h3 className="card-title">{m.title}</h3>
                <span className="muted">
                  {cefrLabel(m.level)} / {kindLabel(m.kind)} / {industryLabel(m.industry)}
                  {m.visibility === 'private' && ' / 自分だけ'}
                </span>
              </div>

              <div className="tagpicker-tags material-tags">
                {m.tagIds.map((t) => (
                  <span key={t} className="tagchip is-static">{weaknessTagLabel(t)}</span>
                ))}
              </div>

              {m.instruction_ja && <p className="card-hint">{m.instruction_ja}</p>}

              <ol className="material-preview">
                {m.items.slice(0, 3).map((it) => (
                  <li key={it.id}>
                    <span lang="en">{it.text_en}</span>
                    {it.text_ja && <span className="muted"> — {it.text_ja}</span>}
                  </li>
                ))}
                {m.items.length > 3 && <li className="muted">ほか {m.items.length - 3} 文</li>}
              </ol>

              {assigningId === m.id ? (
                <div className="assign-box">
                  <p className="field-label">配信する生徒を選んでください(複数可)</p>
                  {active.length === 0 && (
                    <p className="muted">受講中の生徒がいません。</p>
                  )}
                  <div className="assign-list">
                    {active.map((l) => (
                      <label key={l.id} className="toggle">
                        <input type="checkbox" checked={picked.includes(l.id)}
                               onChange={() => setPicked(
                                 picked.includes(l.id)
                                   ? picked.filter((x) => x !== l.id)
                                   : [...picked, l.id])} />
                        <span>{l.display_name}</span>
                      </label>
                    ))}
                  </div>
                  {notActive.length > 0 && (
                    <p className="field-hint">
                      休会中・退会済の {notActive.length} 人には配信できません。
                    </p>
                  )}
                  <div className="btn-row">
                    <button type="button" className="btn btn--primary"
                            onClick={doAssign} disabled={!picked.length}>
                      {picked.length ? `${picked.length} 人に配信する` : '配信する'}
                    </button>
                    <button type="button" className="btn" onClick={() => setAssigningId(null)}>
                      やめる
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" className="btn btn--primary"
                        onClick={() => startAssign(m.id)}>
                  この教材を配信する
                </button>
              )}
            </div>
          ))}
        </>
      )}

      {/* 新しく作るのは2番目の動線。目立たせすぎない。 */}
      <div className="card">
        <p className="card-hint">さがしても見つからなかったときは、新しく作ります。</p>
        <button type="button" className="btn" onClick={() => setMode('create')}>
          ＋ 教材を新しく作る
        </button>
      </div>
    </div>
  )
}
