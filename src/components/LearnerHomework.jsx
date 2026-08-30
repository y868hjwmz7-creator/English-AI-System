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
import QuickResponse from './QuickResponse.jsx'
import TeachingNote from './TeachingNote.jsx'
import PhraseChips from './PhraseChips.jsx'
import Phonetic from './Phonetic.jsx'
import Tabs from './Tabs.jsx'
import SpeakButton from './SpeakButton.jsx'
import { printElement } from '../lib/print.js'
import MaterialTitle from './MaterialTitle.jsx'
import LessonView from './LessonView.jsx'
import { kindLabel, loadMyAssignments, markAssignmentDone } from '../lib/materials.js'
import { weaknessTagLabel } from '../data/weaknessTags.js'
import { hasQuickResponse } from '../lib/quickResponse.js'
import { voiceTierFor } from '../lib/voiceTier.js'
import { resolveVoices } from '../data/clipVoices.js'
import { BoltIcon, PrintIcon, ScreenIcon } from './Icons.jsx'
import { SPEECH_RATES, loadRateId, saveRateId } from '../lib/speechRate.js'
import useWordStatuses from '../lib/useWordStatuses.js'
import EnglishText from './EnglishText.jsx'

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
  const [lessonOf, setLessonOf] = useState(null)   // レッスン表示で開いている教材
  // Quick Response を開いている宿題。**教材ごとに1つ。**
  // 「中身を見る」タブとは別の行為なので、開いているあいだは
  // タブの中身を出さない(注意が2つに割れる)
  const [qrOf, setQrOf] = useState(null)
  // 読み上げの速さ。**画面に1つだけ置く。** ここで選んだものが、
  // この画面のすべての読み上げに効く(2026-08 利用者の指定)
  const [rateId, setRateId] = useState(loadRateId)
  // 語の「知っていた / 知らなかった」。**画面を開いたときに1回だけ読む。**
  // 語ごとに問い合わせると、1画面で何十回も往復することになる。
  // 「知っていた / 知らなかった」。中身は useWordStatuses.js にある
  const { statuses: wordStatuses, mark: markWord, error: wordError } = useWordStatuses()

  const reload = async () => {
    const { data, error: e } = await loadMyAssignments()
    setLoading(false)
    if (e) { setError(e); return }
    setError(null)
    setAssignments(data)
  }

  useEffect(() => { reload() }, [])

  useEffect(() => { if (wordError) setError(wordError) }, [wordError])

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
      {lessonOf && (
        <LessonView material={lessonOf} onClose={() => setLessonOf(null)}
                    wordStatuses={wordStatuses} onMarkWord={markWord} />
      )}
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
        <label className="rate-pick">
          <span>読み上げの速さ</span>
          <select value={rateId}
                  onChange={(e) => { setRateId(e.target.value); saveRateId(e.target.value) }}>
            {SPEECH_RATES.map((r) => (
              <option key={r.id} value={r.id}>{r.label}({r.id}%)</option>
            ))}
          </select>
        </label>
      </div>

      {[['取り組む', todo], ['やったもの', done]].map(([label, list]) => (
        list.length > 0 && (
          <section key={label} className="stack">
            <h3 className="section-title">{label}({list.length})</h3>
            {list.map((a) => (
              <div key={a.id} className={`card homework-card${a.learner_done_at ? ' is-done' : ''}`}>
                {/* 見出しの行そのものを押して開く。以前は下の小さなボタンでしか
                    開けず、並んでいるだけの一覧に見えていた(2026-08 の指摘)。
                    ひらく・とじるの印(▸ ▾)も出して、押せることを示す。 */}
                <button
                  type="button"
                  className="homework-open no-print"
                  aria-expanded={openId === a.id}
                  onClick={() => { setOpenId(openId === a.id ? null : a.id); setQrOf(null) }}
                >
                  <span className="homework-open-mark">{openId === a.id ? '▾' : '▸'}</span>
                  <span className="homework-open-body">
                    <MaterialTitle
                      title={a.material?.title ?? '(教材が見つかりません)'}
                      as="span" size="row"
                      fallbackTags={a.material
                        ? [cefrLabel(a.material.level), kindLabel(a.material.kind)] : []}
                    />
                    <span className="card-hint">
                      {kindLabel(a.material?.kind)}
                      {a.material?.itemCount ? ` / 全 ${a.material.itemCount} 問` : ''}
                      {' / 共有 '}{formatDate(a.assigned_at)}
                      {a.due_on && ` / 次のレッスン ${a.due_on}`}
                    </span>
                  </span>
                  <span className={`badge ${a.learner_done_at ? 'badge--admin' : 'badge--warn'}`}>
                    {a.learner_done_at ? 'やった' : 'まだ'}
                  </span>
                </button>

                {a.material?.instruction_ja && (
                  <TeachingNote text={a.material.instruction_ja} title="やること" tone="todo" defaultOpen />
                )}

                {openId === a.id ? (
                  <div id={`homework-${a.id}`}>
                    <div className="print-only print-head">
                      <MaterialTitle title={a.material?.title} headline={a.material?.headline}
                                     as="strong" size="sheet" />
                      <div className="print-meta">
                        {cefrLabel(a.material?.level)} / {kindLabel(a.material?.kind)}
                        {' / '}共有 {formatDate(a.assigned_at)}
                        {a.due_on && ` / 次のレッスン ${a.due_on}`}
                        {/* 何の練習だったのかを、紙にも残す。
                            トレーナー側の紙には入っていて、ゲスト側だけ
                            抜けていた(2026-08 の見直し) */}
                        {a.material?.tagIds?.length
                          ? ` / ${a.material.tagIds.map(weaknessTagLabel).join('・')}` : ''}
                      </div>
                    </div>
                    <div className="btn-row no-print">
                      <button type="button" className="btn btn--small btn--primary"
                              onClick={() => setLessonOf(a.material)}>
                        <ScreenIcon />大きく表示する
                      </button>
                      <button type="button" className="btn btn--small"
                              onClick={() => printElement(
                                document.getElementById(`homework-${a.id}`),
                                { worksheet: true },
                              )}>
                        <PrintIcon />印刷 / PDFで保存(問題のみ)
                      </button>
                    </div>
                    {a.material?.teaching_point && (
                      <TeachingNote text={a.material.teaching_point} title="ここに注意" />
                    )}

                    {/* ── 通しで練習する ──────────────────────────
                        **「中身を見る」タブとは、行為が違う。**
                        タブは記事・設問・語句を見るためのもので、こちらは
                        教材1本を通しで練習するためのもの。
                        だから同じ形(札)にせず、絵の付いたボタンにして
                        タブの上に置く。押すと下がその練習だけになる */}
                    {hasQuickResponse(a.material) && (
                      <div className="practice-row no-print">
                        <button type="button"
                                className={`btn${qrOf === a.id ? ' btn--primary' : ''}`}
                                aria-pressed={qrOf === a.id}
                                onClick={() => setQrOf(qrOf === a.id ? null : a.id)}>
                          <BoltIcon />
                          Quick Response
                        </button>
                      </div>
                    )}

                    {qrOf === a.id ? (
                      <QuickResponse
                        material={a.material}
                        onClose={() => setQrOf(null)}
                        wordStatuses={wordStatuses}
                        onMarkWord={markWord}
                      />
                    ) : (
                    <>
                    {/* **はじめはどれも開かない**(2026-08 の指摘)。
                        1つ目が開いた状態で出ると、宿題を並べて見渡せない。
                        押したタブだけを開き、同じタブをもう一度押すと閉じる。
                        演習が1種類のときはタブが出ない(Tabs は2つ未満だと
                        描かない)ので、そのときだけ開いたままにする。 */}
                    {(() => {
                      const secs = a.material?.sections ?? []
                      return (
                        <Tabs
                          variant="sub"
                          ariaLabel="演習の切り替え"
                          value={openSection[a.id] ?? null}
                          onChange={(id) => setOpenSection((m) => ({
                            ...m, [a.id]: m[a.id] === id ? null : id,
                          }))}
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
                        sec.id === openSection[a.id]
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
                              tags={a.material?.tagIds}
                              voiceIds={a.material?.voiceIds}
                              headline={a.material?.headline}
                              isDialogue={sec.exercise_type === 'dialogue'}
                              level={a.material?.level}
                              wordStatuses={wordStatuses}
                              onMarkWord={markWord}
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
                                      clipVoice={resolveVoices(a.material?.voiceIds)[0]}
                                      tier={voiceTierFor({
                                        exerciseType: sec.exercise_type,
                                        tags: a.material?.tagIds,
                                      })}
                                    />
                                  </div>
                                )}
                                {/* リスニングは英文を見せない。聞いて答えるため。 */}
                                {!type?.hidePromptFromLearner && it.prompt_en && (
                                  <div className="homework-en">
                                    <EnglishText text={it.prompt_en} textJa={it.prompt_ja} level={a.material?.level}
                                                 statuses={wordStatuses} onMark={markWord} />
                                    <Phonetic value={it.phonetic} />
                                    <PhraseChips phrases={it.phrases} sentence={it.prompt_en}
                                                 level={a.material?.level}
                                                 statuses={wordStatuses} onMark={markWord} />
                                  </div>
                                )}
                                {it.prompt_ja && <div>{it.prompt_ja}</div>}
                                {it.question && (
                                  <div className="homework-en">
                                    <EnglishText text={it.question} level={a.material?.level}
                                                 statuses={wordStatuses} onMark={markWord} />
                                  </div>
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
                    </>
                    )}
                    <button type="button" className="btn btn--link no-print"
                            onClick={() => { setOpenId(null); setQrOf(null) }}>
                      閉じる
                    </button>
                  </div>
                ) : null}

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
