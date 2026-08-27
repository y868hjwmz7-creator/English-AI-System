/**
 * 教材を新しく作る画面。
 *
 * 【教材の形】(仕様書 第5.13節 / 実物のドリルに合わせた)
 *   教材 = 1つの文法ポイント
 *     └ 演習(和訳・穴埋め・英訳・リスニング…)
 *          └ 設問
 *
 * 【設計の要件】(仕様書 第5.5節)
 *   発行時に弱点タグを必須にする。タグの付いていない教材は
 *   二度と見つからず、資産にならない。
 *
 * 手入力は「AI 生成がまだ無い間のつなぎ」と「AI の下書きを直す土台」。
 * 1教材40問を毎回ここで打つことは想定していない。
 */
import { useState } from 'react'
import WeaknessTagPicker from './WeaknessTagPicker.jsx'
import { CEFR_LEVELS, cefrLabel } from '../data/cefr.js'
import { EXERCISE_TYPES, FIELD_LABELS, exerciseType } from '../data/exerciseTypes.js'
import { INDUSTRIES } from '../data/industries.js'
import { MATERIAL_KINDS, createMaterial } from '../lib/materials.js'

const newSection = (typeId = 'translate_en_ja') => ({
  exercise_type: typeId,
  instruction: exerciseType(typeId)?.instruction ?? '',
  items: [{}, {}, {}],
})

export default function MaterialForm({ createdBy, onCreated, onCancel }) {
  const [title, setTitle] = useState('')
  const [level, setLevel] = useState('B1')
  const [kind, setKind] = useState('pattern')
  const [instruction, setInstruction] = useState('')
  const [teachingPoint, setTeachingPoint] = useState('')
  const [visibility, setVisibility] = useState('school')
  const [industry, setIndustry] = useState('')
  const [sections, setSections] = useState([newSection()])
  const [tagIds, setTagIds] = useState([])
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const patchSection = (si, patch) =>
    setSections(sections.map((sec, i) => (i === si ? { ...sec, ...patch } : sec)))

  const patchItem = (si, ii, field, value) =>
    patchSection(si, {
      items: sections[si].items.map((it, j) => (j === ii ? { ...it, [field]: value } : it)),
    })

  const changeType = (si, typeId) =>
    patchSection(si, {
      exercise_type: typeId,
      instruction: exerciseType(typeId)?.instruction ?? '',
    })

  const totalItems = sections.reduce(
    (n, sec) => n + sec.items.filter((it) => Object.values(it).some((v) => String(v ?? '').trim())).length,
    0,
  )

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    const { data, error: message } = await createMaterial({
      title, level, kind, instruction_ja: instruction, teaching_point: teachingPoint,
      visibility, industry, sections, tagIds, createdBy,
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
               placeholder="例: 名詞 + to不定詞 =「〜すべき / 〜する必要のある」" required />
      </label>

      <div className="field-row material-form-row">
        <label className="field">
          <span>レベル</span>
          <select value={level} onChange={(e) => setLevel(e.target.value)}>
            {CEFR_LEVELS.map((l) => (
              <option key={l.id} value={l.id}>{cefrLabel(l.id)}</option>
            ))}
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
        <span>
          業界
          <span className="field-hint">選ばなければ「汎用」。どの生徒にも使えます</span>
        </span>
        <select value={industry} onChange={(e) => setIndustry(e.target.value)}>
          <option value="">汎用(全員)</option>
          {INDUSTRIES.map((i) => (
            <option key={i.id} value={i.id}>{i.label} — {i.hint}</option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>取り組み方(生徒に見えます・任意)</span>
        <input value={instruction} onChange={(e) => setInstruction(e.target.value)}
               placeholder="例: to不定詞を「〜すべき」という感覚で捉えること" />
      </label>

      <label className="field">
        <span>
          指導ポイント
          <span className="field-hint">この文法全体の勘所。1問ごとではなく教材全体にかかるもの</span>
        </span>
        <textarea rows={2} value={teachingPoint}
                  onChange={(e) => setTeachingPoint(e.target.value)}
                  placeholder="例: emails to reply to のように、reply to の to を落とさないこと" />
      </label>

      <fieldset className="field">
        <legend>
          演習
          <span className="field-hint">{sections.length} 種類 / 合計 {totalItems} 問</span>
        </legend>

        {sections.map((sec, si) => {
          const type = exerciseType(sec.exercise_type)
          const fields = type?.fields ?? ['prompt_en']
          return (
            <div key={si} className="exercise-block">
              <div className="exercise-head">
                <span className="exercise-no">{si + 1}</span>
                <select value={sec.exercise_type} onChange={(e) => changeType(si, e.target.value)}>
                  {EXERCISE_TYPES.map((t) => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
                {!type?.audioFrom && (
                  <span className="field-hint">この演習には音声を作りません</span>
                )}
                {sections.length > 1 && (
                  <button type="button" className="btn btn--link"
                          onClick={() => setSections(sections.filter((_, i) => i !== si))}>
                    この演習を削除
                  </button>
                )}
              </div>

              <input className="exercise-instruction" value={sec.instruction}
                     onChange={(e) => patchSection(si, { instruction: e.target.value })}
                     placeholder="この演習の指示文" />

              {sec.items.map((it, ii) => (
                <div key={ii} className="exercise-item">
                  <span className="material-item-no">{ii + 1}</span>
                  <div className="exercise-fields">
                    {fields.map((f) => (
                      <input key={f} value={it[f] ?? ''} lang={f.endsWith('_en') ? 'en' : undefined}
                             onChange={(e) => patchItem(si, ii, f, e.target.value)}
                             placeholder={`${FIELD_LABELS[f]?.label ?? f} — ${FIELD_LABELS[f]?.placeholder ?? ''}`} />
                    ))}
                  </div>
                  {sec.items.length > 1 && (
                    <button type="button" className="btn btn--link"
                            onClick={() => patchSection(si, {
                              items: sec.items.filter((_, j) => j !== ii),
                            })}>
                      削除
                    </button>
                  )}
                </div>
              ))}

              <button type="button" className="btn btn--small"
                      onClick={() => patchSection(si, { items: [...sec.items, {}] })}>
                ＋ 設問を追加
              </button>
            </div>
          )
        })}

        <button type="button" className="btn"
                onClick={() => setSections([...sections, newSection()])}>
          ＋ 演習を追加
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
