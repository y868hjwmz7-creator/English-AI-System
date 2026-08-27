/**
 * 教材を新しく作る画面。
 *
 * 【設計の要件】(仕様書 第5.5節)
 *   発行時に弱点タグを必須にする。タグの付いていない教材は
 *   二度と見つからず、資産にならない。
 */
import { useState } from 'react'
import WeaknessTagPicker from './WeaknessTagPicker.jsx'
import { LEVELS, MATERIAL_KINDS, createMaterial } from '../lib/materials.js'

const emptyRow = () => ({ text_en: '', text_ja: '' })

export default function MaterialForm({ createdBy, onCreated, onCancel }) {
  const [title, setTitle] = useState('')
  const [level, setLevel] = useState(2)
  const [kind, setKind] = useState('passage')
  const [instruction, setInstruction] = useState('')
  const [visibility, setVisibility] = useState('school')
  const [rows, setRows] = useState([emptyRow(), emptyRow(), emptyRow()])
  const [tagIds, setTagIds] = useState([])
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const setRow = (i, key, value) =>
    setRows(rows.map((r, idx) => (idx === i ? { ...r, [key]: value } : r)))

  const filled = rows.filter((r) => r.text_en.trim()).length

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    const { data, error: message } = await createMaterial({
      title, level, kind, instruction_ja: instruction, visibility,
      items: rows, tagIds, createdBy,
    })
    setBusy(false)
    if (message) { setError(message); return }
    onCreated?.(data.id)
  }

  return (
    <form className="card" onSubmit={handleSubmit}>
      <h2 className="card-title">教材を新しく作る</h2>
      <p className="card-hint">
        まずライブラリを探して、無いときにここへ来てください。
        既にある教材を使うほうが、作るよりずっと速く配信できます。
      </p>

      <label className="field">
        <span>教材名</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)}
               placeholder="例: /l/ と /r/ の聞き分け(中級)" required />
      </label>

      <div className="field-row material-form-row">
        <label className="field">
          <span>レベル</span>
          <select value={level} onChange={(e) => setLevel(Number(e.target.value))}>
            {LEVELS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
          </select>
        </label>
        <label className="field">
          <span>種類</span>
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            {MATERIAL_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
          </select>
        </label>
      </div>
      <p className="field-hint material-kind-hint">
        {MATERIAL_KINDS.find((k) => k.id === kind)?.hint}
      </p>

      <label className="field">
        <span>取り組み方(生徒に見えます・任意)</span>
        <input value={instruction} onChange={(e) => setInstruction(e.target.value)}
               placeholder="例: お手本を聞いてから、3回音読してください" />
      </label>

      <fieldset className="field material-items">
        <legend>
          英文
          <span className="field-hint">{filled} 文</span>
        </legend>
        {rows.map((row, i) => (
          <div key={i} className="material-item-row">
            <span className="material-item-no">{i + 1}</span>
            <input
              value={row.text_en}
              onChange={(e) => setRow(i, 'text_en', e.target.value)}
              placeholder="English sentence"
              lang="en"
            />
            <input
              value={row.text_ja}
              onChange={(e) => setRow(i, 'text_ja', e.target.value)}
              placeholder="日本語訳(任意)"
            />
            {rows.length > 1 && (
              <button type="button" className="btn btn--link"
                      onClick={() => setRows(rows.filter((_, idx) => idx !== i))}>
                削除
              </button>
            )}
          </div>
        ))}
        <button type="button" className="btn btn--small"
                onClick={() => setRows([...rows, emptyRow()])}>
          ＋ 行を追加
        </button>
      </fieldset>

      <fieldset className="field">
        <legend>
          弱点タグ
          <span className="field-hint">
            必須。ここで付けておかないと、次に同じ弱点の生徒が来たときに見つけられません
          </span>
        </legend>
        <WeaknessTagPicker selected={tagIds} onChange={setTagIds} />
      </fieldset>

      <fieldset className="field">
        <legend>公開範囲</legend>
        <div className="btn-row">
          <button type="button"
                  className={`btn btn--toggle${visibility === 'school' ? ' is-active' : ''}`}
                  onClick={() => setVisibility('school')}>
            全トレーナーで共有(おすすめ)
          </button>
          <button type="button"
                  className={`btn btn--toggle${visibility === 'private' ? ' is-active' : ''}`}
                  onClick={() => setVisibility('private')}>
            自分だけ
          </button>
        </div>
        <p className="field-hint">
          共有すると他のトレーナーも使えます。50人で共有すれば、必要な教材が7週でそろいます。
        </p>
      </fieldset>

      {error && <div className="notice notice--warn" role="alert">{error}</div>}

      <div className="btn-row">
        <button type="submit" className="btn btn--primary" disabled={busy}>
          {busy ? '発行しています…' : '発行する'}
        </button>
        <button type="button" className="btn" onClick={onCancel}>やめる</button>
      </div>
    </form>
  )
}
