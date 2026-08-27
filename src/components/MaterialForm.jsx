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
import {
  EXERCISE_TYPES, FIELD_LABELS, defaultSectionsFor, exerciseLabel, exerciseType,
} from '../data/exerciseTypes.js'
import { INDUSTRIES, industryLabel } from '../data/industries.js'
import { weaknessTagLabel, weaknessTags } from '../data/weaknessTags.js'
import {
  MATERIAL_KINDS, createMaterial, generateSectionUnique, loadUsedSentences, normEn,
} from '../lib/materials.js'

/** 今日の日付。教材名を自動で付けるのに使う。 */
const todayLabel = () => new Date().toISOString().slice(0, 10)

const newSection = (typeId = 'translate_en_ja') => ({
  exercise_type: typeId,
  instruction: exerciseType(typeId)?.instruction ?? '',
  items: [{}, {}, {}],
})

export default function MaterialForm({ createdBy, learners = [], onCreated, onCancel }) {
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
  const [generating, setGenerating] = useState(null)   // 生成中の進み具合
  const [showEditor, setShowEditor] = useState(false)  // 手で直す欄を出すか
  const [dropped, setDropped] = useState(0)            // 重複で外した数
  const [short, setShort] = useState(0)                // 作り直しても足りなかった数
  const [forLearner, setForLearner] = useState('')     // 誰に出す教材か(任意)

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

  /**
   * AI に下書きを作らせる。
   *
   * 選んだ弱点タグとレベル・業界をそのまま渡す。トレーナーが打つのは
   * この2つだけで、40問は AI が作る(仕様書 第5.13.5節)。
   * **生成した内容は保存しない。** 発行を押すまでは下書きのままである。
   */
  const generate = async () => {
    if (tagIds.length !== 1) {
      setError(tagIds.length === 0
        ? '弱点タグを1つ選んでください。何の練習かが決まらないと作れません。'
        : '教材は弱点1つにつき1つ作ります。タグを1つだけ選んでください。'
          + '複数の弱点に出したい場合は、この手順を弱点の数だけ繰り返してください。')
      return
    }
    setError(null)
    setDropped(0)
    setShort(0)

    const tag = weaknessTags.find((t) => t.id === tagIds[0])
    const topic = tag ? `${tag.label}${tag.hint ? `(${tag.hint})` : ''}` : tagIds[0]

    // ① 生成の前に、すでに使った英文を渡して避けさせる(誘導)
    const { data: used } = await loadUsedSentences(tagIds)
    const usedSet = new Set((used ?? []).map(normEn))

    const plan = defaultSectionsFor(kind)
    const made = []
    let point = teachingPoint
    let droppedCount = 0
    let shortCount = 0

    for (let i = 0; i < plan.length; i += 1) {
      setGenerating({ done: i, total: plan.length, label: exerciseLabel(plan[i].exercise_type) })

      // ② 生成のあとに、データベースへ照合して既出を落とし、
      //    落ちた分は作り直す。ここが「絶対に被らない」の担保。
      const result = await generateSectionUnique(
        {
          sectionType: plan[i].exercise_type,
          count: plan[i].count,
          topic, level, industry, isFirst: i === 0,
        },
        { usedSet, learnerId: forLearner || null, tagIds },
      )
      if (result.error) { setGenerating(null); setError(result.error); return }

      droppedCount += result.dropped
      shortCount += result.short
      made.push(result.section)
      if (result.teaching_point && !point) point = result.teaching_point
    }

    setGenerating(null)
    setSections(made)
    setTeachingPoint(point)
    setDropped(droppedCount)
    setShort(shortCount)
    if (!title.trim()) {
      const parts = [todayLabel(), weaknessTagLabel(tagIds[0]), level]
      if (industry) parts.push(industryLabel(industry))
      const name = learners.find((l) => l.id === forLearner)?.display_name
      if (name) parts.push(name)
      setTitle(parts.join(' / '))
    }
  }

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
          <span className="field-hint">選ばなければ「汎用」。どのゲストにも使えます</span>
        </span>
        <select value={industry} onChange={(e) => setIndustry(e.target.value)}>
          <option value="">汎用(全員)</option>
          {INDUSTRIES.map((i) => (
            <option key={i.id} value={i.id}>{i.label} — {i.hint}</option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>取り組み方(ゲストに見えます・任意)</span>
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
          弱点タグ
          <span className="field-hint">
            必須。ここで付けておかないと、次に同じ弱点のゲストが来たときに見つけられません
          </span>
        </legend>
        <WeaknessTagPicker selected={tagIds} onChange={setTagIds} />
      </fieldset>

      <div className="generate-box">
        <h3 className="card-title">AI に下書きを作らせる</h3>
        <p className="card-hint">
          上の<strong>弱点タグを1つ</strong>選んでから押してください。
          レベルと業界も自動で反映されます。
          {kind === 'pattern' && ' 文型ドリルは 4演習 × 10問 = 40問 作ります。'}
        </p>
        <p className="card-hint">
          <strong>教材は弱点1つにつき1つ</strong>作ります
          (実物のドリルと同じく、1つの文法ポイントに絞るため)。
          複数の弱点に出したいときは、この手順を弱点の数だけ繰り返してください。
        </p>
        <label className="field">
          このゲスト向けに作る(任意)
          <select value={forLearner} onChange={(e) => setForLearner(e.target.value)}>
            <option value="">指定しない</option>
            {learners.map((l) => (
              <option key={l.id} value={l.id}>{l.display_name}</option>
            ))}
          </select>
          <span className="field-hint">
            指定すると、<strong>そのゲストがこれまでに受け取った英文を1文も使いません</strong>
            (弱点を問わず、共有済みの教材すべてと照合します)。教材名にもお名前が入ります。
          </span>
        </label>

        <p className="card-hint">
          同じ英文は二度出しません。生成するたびにデータベースと照合し、
          すでに出した文が混じっていれば取り除いて<strong>その分を作り直します。</strong>
          ただし<strong>意味が近いだけの別の文は防げません</strong>
          (I have work to do. / I have a job to do.)。
        </p>
        <button type="button" className="btn btn--primary"
                onClick={generate} disabled={!!generating || busy}>
          {generating
            ? `作っています… ${generating.label}(${generating.done + 1}/${generating.total})`
            : `下書きを作る(${defaultSectionsFor(kind).reduce((n, s2) => n + s2.count, 0)} 問)`}
        </button>
        <p className="field-hint">
          作ったあと、<strong>必ず目を通して直してください。</strong>
          共有した教材は他のトレーナーのゲストにも届きます。
        </p>
      </div>

      <fieldset className="field">
        <legend>
          演習
          <span className="field-hint">
            {sections.length} 種類 / 合計 {totalItems} 問
            {dropped > 0 && ` / 前と同じ英文だった ${dropped} 問は作り直しました`}
            {short > 0 && ` / ${short} 問は足りません(この弱点で英文が出尽くしています)`}
          </span>
        </legend>

        {/* 手入力は「どうしても直したいとき」のためのもの。
            40問を毎回打つことは想定していないので、既定では隠す。 */}
        {!showEditor ? (
          <div className="editor-toggle">
            {totalItems > 0 ? (
              <>
                <p className="card-hint">
                  {sections.map((sec) => `${exerciseLabel(sec.exercise_type)} ${sec.items.length}問`)
                    .join(' / ')}
                </p>
                <button type="button" className="btn btn--small"
                        onClick={() => setShowEditor(true)}>
                  中身を見て直す
                </button>
              </>
            ) : (
              <>
                <p className="card-hint">まだ中身がありません。上のボタンで作ってください。</p>
                <button type="button" className="btn btn--link"
                        onClick={() => setShowEditor(true)}>
                  手で入力する
                </button>
              </>
            )}
          </div>
        ) : (
        <>

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

        <div className="btn-row">
          <button type="button" className="btn btn--small"
                  onClick={() => setSections([...sections, newSection()])}>
            ＋ 演習を追加
          </button>
          <button type="button" className="btn btn--link" onClick={() => setShowEditor(false)}>
            折りたたむ
          </button>
        </div>
        </>
        )}
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
