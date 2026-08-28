/**
 * ゲストの「今週の宿題」画面。
 *
 * 共有された教材を並べ、取り組んだら「やった」を記録する。
 * ゲストが書き換えられるのはこの記録だけで、
 * 提出期限やトレーナーの確認印には触れられない(列単位の権限で絞ってある)。
 */
import { useEffect, useState } from 'react'
import { cefrLabel } from '../data/cefr.js'
import { exerciseLabel, exerciseType, isPassageSection } from '../data/exerciseTypes.js'
import PassagePractice from './PassagePractice.jsx'
import TeachingNote from './TeachingNote.jsx'
import Tabs from './Tabs.jsx'
import SpeakButton from './SpeakButton.jsx'
import { printElement } from '../lib/print.js'
import { kindLabel, loadMyAssignments, markAssignmentDone } from '../lib/materials.js'
import { weaknessTagLabel } from '../data/weaknessTags.js'

const formatDate = (iso) => (iso ? new Date(iso).toLocaleDateString('ja-JP') : '')

export default function LearnerHomework() {
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [openId, setOpenId] = useState(null)
  // 教材ごとに、いまどの演習を開いているか。
  // 記事・設問・語句を縦に全部並べると、スマホでは延々と流れて
  // 「どこまでやったか」が分からなくなる(2026-08 の指摘)。
  const [openSection, setOpenSection] = useState({})

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
            まだ宿題は届いていません。次のレッスンのあとに届きます。
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
                    {a.material && `${cefrLabel(a.material.level)} / ${kindLabel(a.material.kind)}`}
                  </span>
                </div>

                <p className="card-hint">
                  共有 {formatDate(a.assigned_at)}
                  {a.due_on && ` / 次のレッスン ${a.due_on}`}
                </p>

                {a.material?.instruction_ja && (
                  <TeachingNote text={a.material.instruction_ja} title="やること" tone="todo" />
                )}

                {openId === a.id ? (
                  <div id={`homework-${a.id}`}>
                    <div className="print-only print-head">
                      <strong>{a.material?.title}</strong>
                      {a.material?.headline && <div lang="en">{a.material.headline}</div>}
                      <div className="print-meta">
                        {cefrLabel(a.material?.level)} / {kindLabel(a.material?.kind)}
                        {' / '}共有 {formatDate(a.assigned_at)}
                        {a.due_on && ` / 次のレッスン ${a.due_on}`}
                      </div>
                    </div>
                    <div className="btn-row no-print">
                      <button type="button" className="btn btn--small"
                              onClick={() => printElement(
                                document.getElementById(`homework-${a.id}`),
                                { worksheet: true },
                              )}>
                        🖨 印刷 / PDFで保存(問題のみ)
                      </button>
                    </div>
                    {a.material?.teaching_point && (
                      <TeachingNote text={a.material.teaching_point} title="ここに注意" />
                    )}
                    {(() => {
                      const secs = a.material?.sections ?? []
                      const currentId = openSection[a.id] ?? secs[0]?.id
                      return (
                        <Tabs
                          variant="sub"
                          ariaLabel="演習の切り替え"
                          value={currentId}
                          onChange={(id) => setOpenSection((m) => ({ ...m, [a.id]: id }))}
                          items={secs.map((sec) => ({
                            id: sec.id,
                            label: exerciseLabel(sec.exercise_type),
                            count: isPassageSection(sec.exercise_type) ? null : sec.items.length,
                          }))}
                        />
                      )
                    })()}
                    {a.material?.sections
                      .filter((sec, i) =>
                        sec.id === (openSection[a.id] ?? a.material.sections[0]?.id)
                        || (a.material.sections.length < 2 && i === 0))
                      .map((sec) => {
                      const type = exerciseType(sec.exercise_type)
                      // 記事・会話は「問」ではなく1本の読み物。
                      // 声に出す練習は、この中で取り組み方を切り替える。
                      if (isPassageSection(sec.exercise_type)) {
                        return (
                          <section key={sec.id} className="exercise-view">
                            <h5 className="section-title">{exerciseLabel(sec.exercise_type)}</h5>
                            {sec.instruction && <p className="card-hint">{sec.instruction}</p>}
                            <PassagePractice
                              section={sec}
                              headline={a.material?.headline}
                              isDialogue={sec.exercise_type === 'dialogue'}
                            />
                          </section>
                        )
                      }
                      return (
                        <section key={sec.id} className="exercise-view">
                          <h5 className="section-title">
                            {exerciseLabel(sec.exercise_type)}({sec.items.length} 問)
                          </h5>
                          {sec.instruction && <p className="card-hint">{sec.instruction}</p>}
                          {/* 解答を隠す演習は、紙に書き込む余白を出す */}
                          <ol className={`material-preview${
                            type?.hideAnswerFromLearner ? ' writable' : ''}`}>
                            {sec.items.map((it) => (
                              <li key={it.id}>
                                {/* 混合ドリルでは、どの弱点の問題かを見せる。
                                    何に注意して解くかが分からないと練習にならない。 */}
                                {it.tag_id && (
                                  <span className="item-tag">{weaknessTagLabel(it.tag_id)}</span>
                                )}
                                {/* 読み上げ。リスニングは英文を見せずに音だけ出す。
                                    聞く手段が無いと、この演習は解きようがない。 */}
                                {type?.audioFrom && it[type.audioFrom] && (
                                  <div className="item-audio">
                                    <SpeakButton
                                      text={it[type.audioFrom]}
                                      label={type.hidePromptFromLearner ? '聞く' : 'お手本'}
                                    />
                                  </div>
                                )}
                                {/* リスニングは英文を見せない。聞いて答えるため。 */}
                                {!type?.hidePromptFromLearner && it.prompt_en && (
                                  <div lang="en" className="homework-en">{it.prompt_en}</div>
                                )}
                                {it.prompt_ja && <div>{it.prompt_ja}</div>}
                                {it.question && (
                                  <div lang="en" className="homework-en">{it.question}</div>
                                )}
                                {it.hint && <div className="field-hint">与える語: {it.hint}</div>}
                                {/* 解答は、答えを考える前に見えてはいけない */}
                                {it.answer && type?.hideAnswerFromLearner ? (
                                  <details className="answer">
                                    <summary>解答を見る</summary>
                                    <div>{it.answer}</div>
                                    {it.answer_alt && (
                                      <div className="muted">別解: {it.answer_alt}</div>
                                    )}
                                    {it.note && <div className="field-hint">{it.note}</div>}
                                  </details>
                                ) : (
                                  it.note && <div className="field-hint">{it.note}</div>
                                )}
                              </li>
                            ))}
                          </ol>
                        </section>
                      )
                    })}
                    <button type="button" className="btn btn--link no-print"
                            onClick={() => setOpenId(null)}>
                      閉じる
                    </button>
                  </div>
                ) : (
                  <button type="button" className="btn btn--small" onClick={() => setOpenId(a.id)}>
                    開く(演習 {a.material?.sections.length ?? 0} 種類 / {a.material?.itemCount ?? 0} 問)
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
