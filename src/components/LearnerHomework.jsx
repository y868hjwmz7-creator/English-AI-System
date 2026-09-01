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
import PhraseChips from './PhraseChips.jsx'
import Phonetic from './Phonetic.jsx'
import SpeakButton from './SpeakButton.jsx'
import { printElement } from '../lib/print.js'
import MaterialTitle from './MaterialTitle.jsx'
import LessonView from './LessonView.jsx'
import { kindLabel, loadMyAssignments, markAssignmentDone } from '../lib/materials.js'
import { weaknessTagLabel } from '../data/weaknessTags.js'
import { voiceTierFor } from '../lib/voiceTier.js'
import { resolveVoices } from '../data/clipVoices.js'
import { PrintIcon, ScreenIcon } from './Icons.jsx'
import { SPEECH_RATES, loadRateId, saveRateId } from '../lib/speechRate.js'
import useWordStatuses from '../lib/useWordStatuses.js'
import EnglishText from './EnglishText.jsx'
import { prefetchGlosses } from '../lib/vocab.js'
import { markIn } from '../lib/useWordStatuses.js'
import { loadMyReminder, markReminderSeen, usePracticeLog } from '../lib/practice.js'

const formatDate = (iso) => (iso ? new Date(iso).toLocaleDateString('ja-JP') : '')

export default function LearnerHomework({ me = null }) {
  /* **書き込んだものは、ゲスト自身の記録として残す**(0025)。
     トレーナーがレッスンで書いたものと同じ置き場所になるので、
     どちらから開いても続きから始められる */
  const learnerId = me?.id ?? null
  // 担当トレーナーからのリマインド(0022)。
  // **トレーナーが押したときだけ届く。** 自動では飛ばないので、
  // 「トレーナーから」と書いても嘘にならない(2026-08 利用者の指定)
  const [reminder, setReminder] = useState(null)
  useEffect(() => {
    loadMyReminder().then(({ data }) => setReminder(data))
  }, [])

  // 取り組みを**裏で数える**(0022)。ゲストのぶんだけ。
  // 記録が付かなくても練習は止まらない(貼る前でも動く)
  usePracticeLog('homework')

  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [openId, setOpenId] = useState(null)
  const [lessonOf, setLessonOf] = useState(null)   // レッスン表示で開いている教材
  /**
   * **いま紙に出している宿題**(null なら印刷していない)。
   *
   * 【なぜ状態が要るか】(2026-08 実機「PDFを出力すると中身が白紙になります」)
   *   画面では、押したタブの演習だけを描いている。だからタブを1つも
   *   押さずに印刷すると、**見出しだけの紙**が出ていた。
   *
   * 【なぜ「隠して描いておく」だけで済ませないか】
   *   ここの演習には `PassagePractice` が入っている。あれは
   *   `usePracticeLog('six_steps')` で**取り組みの時間を数えている**ので、
   *   隠したまま置いておくと、やってもいない練習が記録されてしまう。
   *   **印刷する一瞬だけ**すべての演習を描き、終わったら元に戻す。
   */
  const [printId, setPrintId] = useState(null)
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

  /**
   * 印刷。**すべての演習を描き終えてから**紙に送る。
   *
   * `printElement()` をボタンの中で直接呼ぶと、まだ描き替わる前の
   * 画面が紙になる(React は押した直後には描き直さない)。
   * 状態を立てて、描き終わったこの effect で送る。
   * 終わったら元の1演習だけの表示に戻す(`afterprint`。
   * Safari は返さないことがあるので、時間でも戻す)。
   */
  useEffect(() => {
    if (!printId) return undefined
    const el = document.getElementById(`homework-${printId}`)
    if (!el) { setPrintId(null); return undefined }
    const done = () => setPrintId(null)
    window.addEventListener('afterprint', done)
    const timer = window.setTimeout(done, 60000)
    printElement(el, { worksheet: true })
    return () => {
      window.removeEventListener('afterprint', done)
      window.clearTimeout(timer)
    }
  }, [printId])

  /**
   * **開いた時点で、まだ控えに無い語を裏で引いておく**(2026-08 実機)。
   *
   * 先読みは「本文の練習」(`PassagePractice`)にしか入っておらず、
   * 宿題を開いてすぐ語に触れると、はじめての語は3〜5秒待たされていた。
   * 英文が出る場所は4つある(CLAUDE.md)。ここもその1つである。
   */
  useEffect(() => {
    const a = assignments.find((x) => x.id === openId)
    const m = a?.material
    if (!m) return
    const texts = (m.sections ?? []).flatMap((sec) => (sec.items ?? [])
      .map((it) => it.prompt_en || it.question || '')
      .filter(Boolean)
      .map((text) => ({ text })))
    prefetchGlosses(texts, { level: m.level })
  }, [openId, assignments])

  /**
   * **取り組んだことを、こちらで記録する**(2026-09 利用者の指定)。
   *
   *   > やった もいらないです
   *   > やればトレーナー側でわかる仕組みにしてください
   *
   * これまではゲストが「やった」を押す申告だった。
   * **押し忘れれば「まだ」のまま**で、押しただけでも「やった」になる。
   * どちらにしてもトレーナーには本当のところが分からない。
   *
   * いまは**実際に開いたときに記録する。**
   * 記録するのは次の2つ。どちらも「宿題に取り組む」ための操作である。
   *
   *   ・「大きく表示する」で教材を開いた(取り組む場所はここだけになった)
   *   ・「印刷 / PDFで保存」で紙にした(紙で解く人はこちら)
   *
   * **1度だけ書く。** すでに日付が入っていれば触らない
   * (最初に取り組んだ日を残すため)。
   * **取り消す道は作らない。** 申告ではなく、起きたことの記録である。
   */
  const recordWorked = async (assignment) => {
    if (assignment.learner_done_at) return
    // 画面はすぐ変える。失敗したら読み直して元に戻す
    setAssignments((list) => list.map((a) =>
      a.id === assignment.id
        ? { ...a, learner_done_at: new Date().toISOString() } : a))
    const { error: e } = await markAssignmentDone(assignment.id, true)
    if (e) { setError(e); reload() }
  }

  if (loading) return <p className="muted">読み込み中…</p>

  const todo = assignments.filter((a) => !a.learner_done_at)
  const done = assignments.filter((a) => a.learner_done_at)

  return (
    <div className="stack">
      {/* **人が見てくれていると分かることが、どんなバッジより効く**
          (単語帳の「トレーナーが見ました」と同じ考え方・第5.26節)。
          これはトレーナーが**実際に押したとき**だけ出る */}
      {reminder && (
        <div className="notice notice--warn reminder" role="status">
          <strong>担当トレーナーからのリマインドです。</strong>
          {reminder.message ? ` ${reminder.message}` : ' 今週の宿題に取り組みましょう。'}
          <button type="button" className="btn btn--link reminder-close"
                  onClick={() => { markReminderSeen(reminder.id); setReminder(null) }}>
            わかりました
          </button>
        </div>
      )}
      {lessonOf && (
        <LessonView material={lessonOf} onClose={() => setLessonOf(null)}
                    learnerId={learnerId}
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
              <div key={a.id}
                   className={`card material-card homework-card${
                     a.learner_done_at ? ' is-done' : ''}`}>
                {/* **トレーナー側の教材カードと同じ形にする**(2026-08 利用者の指定)。
                      > ゲストエンド側の教材リストのUIデザインを
                      > トレーナーエンド側と統一してください。

                    押せることは、**押す前から**分かるようにする
                    (グレーの囲み +「中身を見る」の行・CLAUDE.md)。
                    中の並びも同じ … 日付と状態 → 見出し → カテゴリー名と日付
                    → 中身を見る。 */}
                <div className="material-head no-print">
                  <div className="material-open" role="button" tabIndex={0}
                       aria-expanded={openId === a.id}
                       onClick={() => setOpenId(openId === a.id ? null : a.id)}
                       onKeyDown={(e) => {
                         if (e.key !== 'Enter' && e.key !== ' ') return
                         e.preventDefault()
                         setOpenId(openId === a.id ? null : a.id)
                       }}>
                    <div className="past-head">
                      <span className="past-date">{formatDate(a.assigned_at)}</span>
                      <span className={`badge ${a.learner_done_at
                        ? 'badge--admin' : 'badge--warn'}`}>
                        {a.learner_done_at ? 'やった' : 'まだ'}
                      </span>
                      {a.due_on && (
                        <span className="past-date">次のレッスン {a.due_on}</span>
                      )}
                    </div>
                    {/* **弱点タグを2回出さない。** 弱点は教材名の中にすでにあり、
                        `MaterialTitle` が出す(トレーナー側と同じ決まり) */}
                    <MaterialTitle
                      title={a.material?.title ?? '(教材が見つかりません)'}
                      headline={a.material?.headline}
                      hideDate
                      weakness={(a.material?.tagIds ?? []).map(weaknessTagLabel).join(' + ')}
                      fallbackTags={a.material
                        ? [(a.material.tagIds ?? []).map(weaknessTagLabel).join(' + '),
                           cefrLabel(a.material.level)] : []}
                    />
                    <div className="material-meta">
                      <span className="material-kind">{kindLabel(a.material?.kind)}</span>
                      <span className="material-when">
                        {a.material?.itemCount ? `全 ${a.material.itemCount} 問` : ''}
                      </span>
                    </div>
                    {/* **「中身を見る・印刷する」の行は置かない**
                        (2026-09 利用者の指定)。

                          > 教材の欄の「中身を確認する」ボタンは不必要です。

                        開いたときは下に「閉じる」があり、
                        囲みそのものを押しても開け閉めできる。
                        **同じことをするものを2つ見せない。**
                        押せることは、▸ / ▾ の印と、はじめから出ている
                        グレーの囲みが示す(CLAUDE.md)。 */}
                    <span className="material-open-mark" aria-hidden="true">
                      {openId === a.id ? '▾' : '▸'}
                    </span>
                  </div>
                </div>

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
                    {/* **印刷を、大きく表示するの上に置く**(2026-09 利用者の指定)。
                          > 印刷する/PDFで保存するを大きく表示するの上に
                          > 置いてください
                        紙にして手元で解くほうが先に来る、という順序である */}
                    <div className="btn-row no-print">
                      <button type="button" className="btn btn--small"
                              onClick={() => { setPrintId(a.id); recordWorked(a) }}>
                        <PrintIcon />印刷 / PDFで保存(問題のみ)
                      </button>
                      <button type="button" className="btn btn--small btn--primary"
                              onClick={() => { setLessonOf(a.material); recordWorked(a) }}>
                        <ScreenIcon />大きく表示する
                      </button>
                    </div>
                    {/* **「ここに注意」は出さない**(2026-09 利用者の指定)。
                        > 赤で囲った部分は必要ないです。
                        > 教材のあるところ全てで適用してください。
                        **`TeachingNote` の見た目は変えていない。** 出す場所だけの話 */}

                    {/* **演習のタブは置かない**(2026-09 利用者の指定)。
                        > 赤で囲った部分は必要ないです。
                        > 教材のあるところ全てで適用してください。(ゲストエンドでも同じ)

                        取り組むのは「大きく表示する」、持ち出すのは「印刷」。
                        カードの中では、日付・教材名・何問あるかだけが分かればよい。

                        **描くのは、紙に出す一瞬だけ**(`printId`)。
                        隠したまま置いておくと、`PassagePractice` が
                        **やってもいない練習の時間を数えてしまう**(CLAUDE.md)。 */}
                    {a.material?.sections
                      .filter(() => printId === a.id)
                      .map((sec) => {
                      const cls = 'exercise-view is-closed'
                      const type = exerciseType(sec.exercise_type)
                      // 記事・会話は「問」ではなく1本の読み物。
                      // 声に出す練習は、この中で取り組み方を切り替える。
                      if (isPassageSection(sec.exercise_type)) {
                        return (
                          <section key={sec.id} className={cls}>
                            <h5 className="section-title">{exerciseLabel(sec.exercise_type)}</h5>
                            {sec.instruction && <p className="card-hint">{sec.instruction}</p>}
                            <PassagePractice
                              section={sec}
                              /* 途中経過を教材ごとにまとめて消せるようにするため、
                                 教材の id も渡す(`src/lib/progress.js`) */
                              materialId={a.material?.id}
                              learnerId={learnerId}
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
                        <section key={sec.id} className={cls}>
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
                                                 statuses={wordStatuses} onMark={markIn(markWord, a.material?.id)} />
                                    <Phonetic value={it.phonetic} />
                                    <PhraseChips phrases={it.phrases} sentence={it.prompt_en}
                                                 level={a.material?.level}
                                                 statuses={wordStatuses} onMark={markIn(markWord, a.material?.id)} />
                                  </div>
                                )}
                                {it.prompt_ja && <div>{it.prompt_ja}</div>}
                                {it.question && (
                                  <div className="homework-en">
                                    <EnglishText text={it.question} level={a.material?.level}
                                                 statuses={wordStatuses} onMark={markIn(markWord, a.material?.id)} />
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
                    {/* 「閉じる」は置かない(2026-09 利用者の指定)。
                        閉じるのは、上のグレーの囲みをもう一度押す。
                        教材が出るところは全部同じ形にする */}
                  </div>
                ) : null}

                {/* **「やった」のボタンは置かない**(2026-09 利用者の指定)。
                    開いた時点で記録されるので、押してもらう必要がない。
                    ただし**黙って記録しない。** 記録されたことは静かに出す */}
                {a.learner_done_at && (
                  <p className="muted homework-worked">
                    {formatDate(a.learner_done_at)} に取り組みました
                  </p>
                )}
              </div>
            ))}
          </section>
        )
      ))}
    </div>
  )
}
