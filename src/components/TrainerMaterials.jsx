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
import TeachingNote from './TeachingNote.jsx'
import Tabs from './Tabs.jsx'
import SpeakButton from './SpeakButton.jsx'
import { printElement } from '../lib/print.js'
import LessonView from './LessonView.jsx'
import MaterialTitle from './MaterialTitle.jsx'
import WeaknessTagPicker from './WeaknessTagPicker.jsx'
import { weaknessTagLabel } from '../data/weaknessTags.js'
import { voiceTierFor } from '../lib/voiceTier.js'
import { CEFR_LEVELS, cefrLabel } from '../data/cefr.js'
import { countLabel, exerciseLabel, exerciseType } from '../data/exerciseTypes.js'
import { INDUSTRIES, industryLabel } from '../data/industries.js'
import {
  NEW_MATERIAL_KINDS, assignMaterial, kindLabel, loadMyLearners, searchMaterials,
} from '../lib/materials.js'
import { DIALOGUE_SCENES, READING_GENRES } from '../data/genres.js'
import { PrintIcon, ScreenIcon } from './Icons.jsx'
import EnglishText from './EnglishText.jsx'
import PhraseChips from './PhraseChips.jsx'
import useWordStatuses from '../lib/useWordStatuses.js'

export default function TrainerMaterials({ me }) {
  const [mode, setMode] = useState('search')      // 'search' | 'create'
  const [tagIds, setTagIds] = useState([])
  const [level, setLevel] = useState(null)
  const [keyword, setKeyword] = useState('')
  const [industry, setIndustry] = useState('')
  const [kind, setKind] = useState('')         // 教材の種類で絞る
  const [genre, setGenre] = useState('')       // 記事のジャンル
  const [scene, setScene] = useState('')       // 会話の場面
  const [sort, setSort] = useState('new')      // 並び順
  const [openId, setOpenId] = useState(null)   // 中身を開いている教材
  const [openSection, setOpenSection] = useState({})  // 教材ごとに開いている演習
  // **トレーナー自身の語の記録。** トレーナーも日々英語を学んでいる
  // (2026-08 利用者の指定)。担当ゲストの記録には触れない
  const { statuses: wordStatuses, mark: markWord } = useWordStatuses()
  const [lessonOf, setLessonOf] = useState(null)      // レッスン表示で開いている教材

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
    const { data, error: e } = await searchMaterials({
      tagIds, level, keyword, industry,
      kind: kind || null,
      genre: kind === 'reading' ? (genre || null) : null,
      scene: kind === 'dialogue' ? (scene || null) : null,
    })
    setLoading(false)
    if (e) { setError(e); return }
    setMaterials(data)
  }

  // 絞り込みが変わったら探し直す。search 自体は毎回作り直されるので依存に入れない。
  useEffect(() => { search() }, [tagIds, level, industry, kind, genre, scene])

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
    setMessage(`${data.count} 人と共有しました。`)
    setAssigningId(null)
    setPicked([])
  }

  if (mode === 'create') {
    return (
      // さがすときに選んだ条件を、そのまま作成画面へ引き継ぐ。
      // 「探して → 無ければ作る」が既定の動線なので(第5.5節)、
      // ここで指定が消えると、同じことを2度入力させることになる。
      // **この画面にある指定は全部渡す。** 弱点だけ渡して種類を渡さなかったため、
      // ダイアローグを選んで作成に移ると文型トレーニングに戻っていた(2026-08)。
      <MaterialForm
        createdBy={me.id}
        learners={learners.filter((l) => l.status === 'active')}
        initial={{ tagIds, level: level ?? '', industry, kind, genre, scene }}
        onCancel={() => setMode('search')}
        onCreated={(id, shared) => {
          setMode('search')
          setMessage(shared
            ? `教材を発行し、${shared}人と共有しました。`
            : '教材を発行しました。一覧から共有できます。')
          search()
        }}
      />
    )
  }

  // 並べ替え。探しやすさは、絞り込みと並び順の両方で決まる。
  const sorted = [...materials].sort((a, b) => {
    if (sort === 'items') return b.itemCount - a.itemCount
    if (sort === 'title') return a.title.localeCompare(b.title, 'ja')
    return new Date(b.created_at) - new Date(a.created_at)
  })

  const active = learners.filter((l) => l.status === 'active')
  const notActive = learners.filter((l) => l.status !== 'active')

  return (
    <div className="stack">
      {lessonOf && (
        <LessonView material={lessonOf} onClose={() => setLessonOf(null)}
                    wordStatuses={wordStatuses} onMarkWord={markWord} />
      )}
      <div className="card">
        <h2 className="card-title">教材をさがす</h2>
        <p className="card-hint">
          レッスンで指摘した弱点を選ぶと、その弱点の教材が出ます。
          <strong>あればそのまま配信できます。</strong>作るより速く、ゲストには同じ価値が届きます。
        </p>

        {/* さがす場面では基礎練習(子音全般・母音全般)も選べる。
            弱点として指摘する場面では出さない(粒度が違うため)。 */}
        <WeaknessTagPicker selected={tagIds} onChange={setTagIds} includeDrills />

        <div className="filter-row material-filter">
          <span className="filter-label">レベル</span>
          <select value={level ?? ''} onChange={(e) => setLevel(e.target.value || null)}>
            <option value="">すべて</option>
            {CEFR_LEVELS.map((l) => (
              <option key={l.id} value={l.id}>{l.label} — {l.ja}</option>
            ))}
          </select>
          <span className="filter-label">種類</span>
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="">すべて</option>
            {NEW_MATERIAL_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
          </select>
          {kind === 'reading' && (
            <>
              <span className="filter-label">ジャンル</span>
              <select value={genre} onChange={(e) => setGenre(e.target.value)}>
                <option value="">すべて</option>
                {READING_GENRES.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
              </select>
            </>
          )}
          {kind === 'dialogue' && (
            <>
              <span className="filter-label">場面</span>
              <select value={scene} onChange={(e) => setScene(e.target.value)}>
                <option value="">すべて</option>
                {DIALOGUE_SCENES.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
              </select>
            </>
          )}
          <span className="filter-label">業界</span>
          <select value={industry} onChange={(e) => setIndustry(e.target.value)}>
            <option value="">すべて</option>
            {INDUSTRIES.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
          </select>
          <input className="material-keyword" value={keyword} placeholder="教材名・見出しで絞る"
                 onChange={(e) => setKeyword(e.target.value)}
                 onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); search() } }} />
          <button type="button" className="btn btn--small" onClick={search}>さがす</button>
          <span className="filter-label">並び順</span>
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="new">新しい順</option>
            <option value="items">問数の多い順</option>
            <option value="title">名前順</option>
          </select>
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
          {sorted.map((m) => (
            <div key={m.id} className="card material-card">
              <div className="material-head">
                {/* 見出しは弱点だけ。レベル・業界は小さな札、日付は右上 */}
                <MaterialTitle
                  title={m.title}
                  headline={m.headline}
                  fallbackTags={[cefrLabel(m.level), kindLabel(m.kind), industryLabel(m.industry)]}
                />
                <span className="muted">
                  {kindLabel(m.kind)}
                  {m.visibility === 'private' && ' / 自分だけ'}
                </span>
              </div>

              <div className="tagpicker-tags material-tags">
                {m.tagIds.map((t) => (
                  <span key={t} className="tagchip is-static">{weaknessTagLabel(t)}</span>
                ))}
              </div>

              {m.instruction_ja && <p className="card-hint">{m.instruction_ja}</p>}

              {m.teaching_point && (
                <TeachingNote text={m.teaching_point} />
              )}

              <p className="muted">
                演習 {m.sections.length} 種類 / 全 {m.itemCount} 問
              </p>
              <ul className="material-preview">
                {m.sections.map((sec) => (
                  <li key={sec.id}>
                    <strong>{exerciseLabel(sec.exercise_type)}</strong>({countLabel(sec.exercise_type, sec.items.length)})
                    {sec.items[0] && (
                      <span className="muted">
                        {' '}— {sec.items[0].prompt_en || sec.items[0].prompt_ja
                                || sec.items[0].question || sec.items[0].audio_text}
                      </span>
                    )}
                  </li>
                ))}
              </ul>

              {openId === m.id ? (
                <div className="material-detail" id={`material-${m.id}`}>
                  {/* 紙に出したときだけ出る見出し。何の教材か分からない
                      紙が配られると、あとで整理できない */}
                  <div className="print-only print-head">
                    <MaterialTitle title={m.title} headline={m.headline} as="strong" size="sheet"
                                   fallbackTags={[cefrLabel(m.level), kindLabel(m.kind),
                                     industryLabel(m.industry)]} />
                    <div className="print-meta">
                      {cefrLabel(m.level)} / {kindLabel(m.kind)} / {industryLabel(m.industry)}
                      {' / '}全 {m.itemCount} 問
                      {m.tagIds.length ? ` / ${m.tagIds.map(weaknessTagLabel).join('・')}` : ''}
                    </div>
                  </div>
                  <div className="btn-row no-print">
                    <button type="button" className="btn btn--small btn--primary"
                            onClick={() => setLessonOf(m)}>
                      <ScreenIcon />レッスンで使う(大きく表示)
                    </button>
                    <button type="button" className="btn btn--small"
                            onClick={() => printElement(document.getElementById(`material-${m.id}`))}>
                      <PrintIcon />印刷 / PDFで保存
                    </button>
                  </div>
                  <Tabs
                    variant="sub"
                    ariaLabel="演習の切り替え"
                    value={openSection[m.id] ?? null}
                    onChange={(id) => setOpenSection((x) => ({
                      ...x, [m.id]: x[m.id] === id ? null : id,
                    }))}
                    items={m.sections.map((sec) => ({
                      id: sec.id,
                      label: exerciseLabel(sec.exercise_type),
                      count: sec.items.length,
                    }))}
                  />
                  {m.sections
                    /* はじめはどれも開かない。演習が1種類のときだけ開く
                       (Tabs は2つ未満だと描かないため、押す先が無い) */
                    .filter((sec, i) => sec.id === openSection[m.id]
                      || (m.sections.length < 2 && i === 0))
                    .map((sec) => {
                    const type = exerciseType(sec.exercise_type)
                    return (
                      <section key={sec.id} className="exercise-view">
                        <h4 className="section-title">
                          {exerciseLabel(sec.exercise_type)}({countLabel(sec.exercise_type, sec.items.length)})
                          {!type?.audioFrom && <span className="field-hint"> 音声なし</span>}
                        </h4>
                        {sec.instruction && <p className="card-hint">{sec.instruction}</p>}
                        <ol className="material-preview">
                          {sec.items.map((it) => (
                            <li key={it.id}>
                              {it.tag_id && (
                                <span className="item-tag">{weaknessTagLabel(it.tag_id)}</span>
                              )}
                              {it.speaker && (
                                <div className="passage-speaker" lang="en">{it.speaker}</div>
                              )}
                              {type?.audioFrom && it[type.audioFrom] && (
                                <div className="item-audio">
                                  <SpeakButton
                                    text={it[type.audioFrom]}
                                    clipVoice={m.voiceId}
                                    tier={voiceTierFor({
                                      exerciseType: sec.exercise_type,
                                      tags: m.tagIds,
                                    })}
                                  />
                                </div>
                              )}
                              {/* 語に触れると意味が出る。**トレーナー自身も
                                  「知っていた / 知らなかった」を付けられる**
                                  (2026-08 利用者の指定)。付けた記録は
                                  トレーナー自身のもので、ゲストのものには触れない */}
                              {it.prompt_en && (
                                <div>
                                  <EnglishText text={it.prompt_en} level={m.level}
                                               statuses={wordStatuses} onMark={markWord} />
                                  <PhraseChips phrases={it.phrases} sentence={it.prompt_en}
                                               level={m.level}
                                               statuses={wordStatuses} onMark={markWord} />
                                </div>
                              )}
                              {it.prompt_ja && <div>{it.prompt_ja}</div>}
                              {it.question && (
                                <div><EnglishText text={it.question} level={m.level}
                                                  statuses={wordStatuses} onMark={markWord} /></div>
                              )}
                              {it.hint && <div className="field-hint">与える語: {it.hint}</div>}
                              {it.audio_text && !it.prompt_en && (
                                <div lang="en" className="muted">読み上げ: {it.audio_text}</div>
                              )}
                              {it.answer && <div className="detail-answer">→ {it.answer}</div>}
                              {it.answer_alt && (
                                <div className="muted">別解: {it.answer_alt}</div>
                              )}
                              {it.note && <div className="field-hint">{it.note}</div>}
                            </li>
                          ))}
                        </ol>
                      </section>
                    )
                  })}
                  <button type="button" className="btn btn--link" onClick={() => setOpenId(null)}>
                    中身を閉じる
                  </button>
                </div>
              ) : (
                <button type="button" className="btn btn--small" onClick={() => setOpenId(m.id)}>
                  中身を見る(全 {m.itemCount} 問)
                </button>
              )}

              {assigningId === m.id ? (
                <div className="assign-box">
                  <p className="field-label">共有するゲストを選んでください(複数可)</p>
                  {active.length === 0 && (
                    <p className="muted">受講中のゲストがいません。</p>
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
                      休会中・退会済の {notActive.length} 人とは共有できません。
                    </p>
                  )}
                  <div className="btn-row">
                    <button type="button" className="btn btn--primary"
                            onClick={doAssign} disabled={!picked.length}>
                      {picked.length ? `${picked.length} 人と共有する` : '配信する'}
                    </button>
                    <button type="button" className="btn" onClick={() => setAssigningId(null)}>
                      やめる
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" className="btn btn--primary"
                        onClick={() => startAssign(m.id)}>
                  この教材をゲストと共有する
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
