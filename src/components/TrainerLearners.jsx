/**
 * トレーナーの「ゲスト」画面。
 *
 * レッスン前に開く画面。担当しているゲストのレベル(CEFR)と
 * 最新の TOEIC / VERSANT が一目で分かるようにする。
 * レベルの物差しは教材と同じ CEFR にそろえてある。
 */
import { useEffect, useState } from 'react'
import { CEFR_LEVELS, SCORE_TESTS, cefrLabel, scoreTestLabel } from '../data/cefr.js'
import {
  addLearnerScore, createAccount, kindLabel, loadLearnerAssignments,
  loadMyLearnersDetailed, loadScoreHistory, setLearnerCefr, setLearnerStatus,
  loadMaterial,
} from '../lib/materials.js'
import { weaknessTagLabel } from '../data/weaknessTags.js'
import Tabs from './Tabs.jsx'
import MaterialTitle from './MaterialTitle.jsx'
import MaterialBody from './MaterialBody.jsx'
import TeachingNote from './TeachingNote.jsx'
import { parseMaterialTitle } from '../lib/format.js'
import { loadPastFilterOpen, savePastFilterOpen } from '../lib/slashLevel.js'
import LessonView from './LessonView.jsx'
import useWordStatuses, { markIn } from '../lib/useWordStatuses.js'
import LearnerWordbook from './LearnerWordbook.jsx'
import MaterialForm from './MaterialForm.jsx'
import { ScreenIcon } from './Icons.jsx'
import { loadLearnerPractice, practiceLine, sendReminder } from '../lib/practice.js'

const STATUS = {
  active:   { label: '受講中', cls: 'badge--admin' },
  paused:   { label: '休会中', cls: 'badge--warn' },
  inactive: { label: '退会済', cls: 'badge--learner' },
}

const today = () => new Date().toISOString().slice(0, 10)
const formatDate = (iso) => (iso ? new Date(iso).toLocaleDateString('ja-JP') : '')

export default function TrainerLearners({ me }) {
  const [learners, setLearners] = useState([])
  // ゲストがアプリで取り組んだこと(0022)。**1人1行でコンパクトに出す**
  const [practice, setPractice] = useState({})
  const [reminding, setReminding] = useState(null)
  const [reminded, setReminded] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)
  const [openId, setOpenId] = useState(null)
  const [history, setHistory] = useState([])
  // ゲストを開いたときの中身。レッスン前に見るのは「先週何を出したか」なので、
  // 過去の宿題を最初に開く(2026-08 の要望)。
  const [detailTab, setDetailTab] = useState('homework')
  // 単語帳で選んだ語。「この語で教材を作る」で「作る」タブへ持って行く。
  // **復習が、そのまま次の宿題になる**(2026-08)。
  // ゲストを切り替えたら必ず空にする — 別の人の語を混ぜてはいけない
  const [mustUse, setMustUse] = useState([])
  // レッスンで大きく表示している教材。**このゲストの分しか出ない。**
  // 画面共有のとき、他のゲストの情報を出さずに進められる(2026-08 の要望)
  const [lessonOf, setLessonOf] = useState(null)
  /* **ゲストのカードの中では、そのゲストの記録を映す**(0025・利用者の指定)。
     レッスンは一緒に進めるので、そこで付けた語はゲストの学習である。
     一覧に戻れば(`openId` が空)、これまでどおりトレーナー自身のもの */
  const { statuses: wordStatuses, mark: markWord } = useWordStatuses(openId)
  const [lessonBusy, setLessonBusy] = useState(null)
  const [assignments, setAssignments] = useState([])
  const [detailBusy, setDetailBusy] = useState(false)
  /**
   * **宿題のカードを、教材のカードと同じ形にする**(2026-08 利用者の指定)。
   *
   *   > 宿題の表示をトレーナーの教材の表示と統一してください。
   *
   * 教材と同じく、グレーの囲みを押すと中身が開く。
   * ただし一覧(`loadLearnerAssignments`)は**中身を持っていない**
   * (id と数だけ)ので、開いた教材だけ `loadMaterial()` で読み、
   * ここに控える。**同じ教材を二度読まない。**
   */
  const [openHw, setOpenHw] = useState(null)      // 開いている宿題の id
  const [bodies, setBodies] = useState({})        // 教材id → 読んだ中身
  const [bodyBusy, setBodyBusy] = useState(null)  // いま読んでいる教材id
  const [hwSection, setHwSection] = useState({})  // 教材ごとに開いている演習
  // 絞り込みの欄を開いているか。**教材の欄とは別に覚える**(別の画面の別の欄)
  const [pastOpen, setPastOpen] = useState(loadPastFilterOpen)
  // 過去の宿題の絞り込み。
  // **出すのは、そのゲストの宿題に実際に含まれる弱点だけ。**
  // 39個の弱点タグを全部並べても、ほとんどが0件で選びようがない。
  const [pastTags, setPastTags] = useState([])
  const [pastDone, setPastDone] = useState('all')   // all | done | todo
  const [pastSort, setPastSort] = useState('new')   // new | old

  // スコアを入れるための一時的な入力欄
  const [form, setForm] = useState({ testType: 'toeic', score: '', takenOn: today() })

  // ゲストを追加するための入力欄
  const [adding, setAdding] = useState(false)
  const [newGuest, setNewGuest] = useState({ displayName: '', loginId: '', password: '' })
  const [addBusy, setAddBusy] = useState(false)

  const reload = async () => {
    const { data, error: e } = await loadMyLearnersDetailed()
    setLoading(false)
    if (e) { setError(e); return }
    setError(null)
    setLearners(data)
  }
  useEffect(() => { reload() }, [])

  // ゲストの取り組み(0022)。**数え方は DB に置いてある**ので、ここは並べるだけ。
  // 0022 をまだ貼っていないときは空が返る(画面は壊れない)
  useEffect(() => {
    loadLearnerPractice(14).then(({ data }) => {
      setPractice(Object.fromEntries((data ?? []).map((r) => [r.learnerId, r])))
    })
  }, [])

  /**
   * リマインドを送る。**トレーナーが押したときだけ飛ぶ**(2026-08 利用者の指定)。
   * 自動では送らないので、ゲストの画面に「トレーナーから」と出しても嘘にならない。
   */
  const remind = async (l) => {
    setReminding(l.id)
    const { error: e } = await sendReminder(l.id)
    setReminding(null)
    if (e) { setError(e); return }
    setReminded((v) => ({ ...v, [l.id]: true }))
    setMessage(`${l.display_name} さんにリマインドを送りました。`)
  }

  /**
   * 過去の宿題を「セッションで使う形」(大きく表示)で開く。
   *
   * 一覧は軽くするため中身を読んでいない(数だけ)。開くときに読む。
   * **ここから開くのは、そのゲストに出した教材だけ。**
   * 画面共有のとき、他のゲストの情報を出さずに進められる(2026-08 の要望)。
   */
  const openLesson = async (materialId) => {
    setLessonBusy(materialId)
    const { data, error: e } = await loadMaterial(materialId)
    setLessonBusy(null)
    if (e) { setError(e); return }
    setLessonOf(data)
  }

  /**
   * 宿題の中身を開く。**開いた教材だけ読む。**
   * 一覧は軽くするため中身を持っていない(数だけ)。
   */
  const toggleHw = async (a) => {
    if (openHw === a.id) { setOpenHw(null); return }
    setOpenHw(a.id)
    const mid = a.material?.id
    if (!mid || bodies[mid]) return
    setBodyBusy(mid)
    const { data, error: e } = await loadMaterial(mid)
    setBodyBusy(null)
    if (e) { setError(e); return }
    setBodies((x) => ({ ...x, [mid]: data }))
  }

  const openDetail = async (id, tab = 'homework') => {
    setOpenId(id)
    // **開いたら、いちばん上へ。** 一覧の途中から開くと、
    // そのゲストの見出しが画面の外に残ったままになる
    window.scrollTo({ top: 0, behavior: 'auto' })
    setDetailTab(tab)
    setMustUse([])
    setPastTags([])
    setPastDone('all')
    setOpenHw(null)
    setMessage(null)
    setForm({ testType: 'toeic', score: '', takenOn: today() })
    setDetailBusy(true)
    // `loadLearnerSummary`(study_logs の合計)は読まない。
    // **もう誰も入力しないので、いつも 0 になる**(2026-08 の設計変更)
    const [{ data: hist }, { data: past }] = await Promise.all([
      loadScoreHistory(id), loadLearnerAssignments(id),
    ])
    setHistory(hist ?? [])
    setAssignments(past ?? [])
    setDetailBusy(false)
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

  const submitGuest = async (event) => {
    event.preventDefault()
    if (addBusy) return
    setAddBusy(true)
    setError(null)
    const { data, error: e } = await createAccount({ ...newGuest, role: 'learner' })
    setAddBusy(false)
    if (e) { setError(e); return }
    // トレーナーがそのままゲストに伝えられる形で出す。
    // 何を渡せばよいか分からないと、発行しても使ってもらえない。
    setMessage(`${data.displayName} さんを追加しました。`
      + `このアプリのURL・ログインID「${data.loginId}」・いま決めたパスワードの`
      + '3つを、ご本人にお伝えください(メールアドレスは要りません)。')
    setNewGuest({ displayName: '', loginId: '', password: '' })
    setAdding(false)
    reload()
  }

  if (loading) return <p className="muted">読み込み中…</p>

  return (
    <div className="stack">
      {lessonOf && (
        /* **レッスンで書いたものは、そのゲストの学習として残す**(0025)。
           > セッションで一緒に取り組んでいるので学習時間に入ります */
        <LessonView material={lessonOf} onClose={() => setLessonOf(null)}
                    learnerId={openId}
                    wordStatuses={wordStatuses} onMarkWord={markWord} />
      )}
      {message && <div className="notice notice--ok">{message}</div>}
      {error && <div className="notice notice--warn" role="alert">{error}</div>}

      {/**
        * **一人のゲストを開いているあいだは、そのゲストだけを映す**
        * (2026-08 実機・利用者の指定)。
        *
        *   > Airi の情報内にいるのにスクロールしていくとテスト太郎の情報が
        *   > 出てきます。これではレッスン中、画面共有の際にトラブルになります。
        *
        * レッスンは**ゲストと画面を共有しながら**行う。下へ送っただけで
        * 他のゲストの名前・スコア・取り組みが出るのは、見せてはいけない情報が
        * 漏れているということである。人数(「12 人 / 受講中 9 人」)も同じで、
        * **他のゲストの情報**にあたる。
        *
        * 仕様書 5.5 に「他のゲストの名前は出ません」と書いてあったのは
        * 教材を作る欄の話で、**一覧の側で破れていた。**
        */}
      {openId && (
        <button type="button" className="btn btn--ghost btn--small learner-back"
                onClick={() => setOpenId(null)}>
          ← ゲストの一覧に戻る
        </button>
      )}

      {!openId && (
      <div className="card">
        <div className="material-head">
          <h2 className="card-title">担当しているゲスト</h2>
          {!adding && (
            <button type="button" className="btn btn--primary btn--small"
                    onClick={() => { setAdding(true); setMessage(null) }}>
              ＋ ゲストを追加
            </button>
          )}
        </div>
        {learners.length === 0 ? (
          <p className="card-hint">
            まだ担当しているゲストがいません。ゲストのアカウントを作ると、ここに並びます。
          </p>
        ) : (
          <p className="card-hint">
            {learners.length} 人 / 受講中 {learners.filter((l) => l.status === 'active').length} 人
          </p>
        )}
      </div>
      )}

      {!openId && adding && (
        <form className="card" onSubmit={submitGuest}>
          <h3 className="card-title">ゲストを追加する</h3>
          <p className="card-hint">
            追加したゲストは<strong>自動であなたの担当になります。</strong>
            ログインIDとパスワードは、あなたからご本人に伝えてください。
          </p>

          <label className="field">
            <span>お名前</span>
            <input value={newGuest.displayName} required
                   placeholder="例: 田中 みなみ"
                   onChange={(e) => setNewGuest({ ...newGuest, displayName: e.target.value })} />
          </label>

          <label className="field">
            <span>
              ログインID
              <span className="field-hint">半角の英数字と . _ - だけ。3文字以上</span>
            </span>
            <input value={newGuest.loginId} required
                   placeholder="例: tanaka01" autoComplete="off"
                   onChange={(e) => setNewGuest({ ...newGuest, loginId: e.target.value })} />
          </label>

          <label className="field">
            <span>
              パスワード
              <span className="field-hint">8文字以上。必ず控えてください</span>
            </span>
            {/* あえて伏せ字にしない。トレーナーが控えてゲストに伝えるため。 */}
            <input value={newGuest.password} required minLength={8}
                   autoComplete="off"
                   onChange={(e) => setNewGuest({ ...newGuest, password: e.target.value })} />
          </label>

          <p className="field-hint">
            パスワードを忘れた場合、ご本人では戻せません。あなたが再設定します。
          </p>

          <div className="btn-row">
            <button type="submit" className="btn btn--primary" disabled={addBusy}>
              {addBusy ? '追加しています…' : '追加する'}
            </button>
            <button type="button" className="btn" onClick={() => setAdding(false)}>やめる</button>
          </div>
        </form>
      )}

      {/* **開いているゲストだけを描く。** 下へ送っても、次のゲストは出てこない */}
      {(openId ? learners.filter((l) => l.id === openId) : learners).map((l) => {
        const toeic = l.scores.toeic
        const versant = l.scores.versant
        return (
          <div key={l.id} className="card learner-card">
            <div className="material-head">
              <h3 className="card-title">
                {/* 名前を押すと開く。カードのどこかに小さなボタンがあるより、
                    名前そのものが入口になっているほうが迷わない */}
                <button type="button" className="learner-name"
                        onClick={() => (openId === l.id ? setOpenId(null) : openDetail(l.id))}>
                  {l.display_name}
                </button>
                <span className={`badge ${STATUS[l.status]?.cls ?? ''}`}>
                  {STATUS[l.status]?.label ?? l.status}
                </span>
              </h3>
              <span className="muted">{cefrLabel(l.cefr)}</span>
            </div>

            {/* **アプリでの取り組み**(0022)。1行に畳む。
                ゲストが自分で入力していた「学習の記録」の代わりで、
                こちらが裏で数えたものである(`src/lib/practice.js`)。

                **やっていない人には、その場でリマインドを送れる。**
                自動では飛ばない(利用者の指定) */}
            <div className="practice-row">
              <span className="muted practice-sum">{practiceLine(practice[l.id])}</span>
              {l.status === 'active' && (
                <button type="button" className="btn btn--small btn--quiet"
                        disabled={reminding === l.id || reminded[l.id]}
                        title="このゲストに「取り組みましょう」と知らせます"
                        onClick={() => remind(l)}>
                  {reminded[l.id] ? '送りました'
                    : reminding === l.id ? '送っています…' : 'リマインドする'}
                </button>
              )}
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
              /* **教材の画面と同じ形にする**(2026-08 利用者の指定)。
                 > 教材モードには、一番外側の白の枠内に実線がありません。
                 > ゲストモードの実線を消してください。そして、教材同士の間に
                 > 隙間を確保し、教材モードと全く同じデザインにしてください
                 `.assign-box`(青い実線の囲み)は**共有するゲストを選ぶ欄**の
                 ものなので、ここでは使わない。`.stack` と同じ縦の並びにする */
              <div className="learner-detail">
                <Tabs
                  variant="sub"
                  ariaLabel="ゲストの情報の切り替え"
                  value={detailTab}
                  onChange={setDetailTab}
                  items={[
                    { id: 'homework', label: '過去の宿題', count: assignments.length },
                    { id: 'create', label: 'この人に教材を作る' },
                    // 次に何を混ぜるかを決めるとき、その人が何につまずいたかを見たい
                    { id: 'wordbook', label: '単語帳' },
                    { id: 'record', label: 'レベルとスコア' },
                  ]}
                />

                {detailTab === 'homework' && (() => {
                  // 弱点ごとの件数。0件の弱点は出さない
                  const counts = new Map()
                  for (const a of assignments) {
                    for (const t of a.material?.tagIds ?? []) {
                      counts.set(t, (counts.get(t) ?? 0) + 1)
                    }
                  }
                  const tagList = [...counts.entries()].sort((x, y) => y[1] - x[1])

                  const shown = assignments
                    .filter((a) => (pastDone === 'all'
                      || (pastDone === 'done') === !!a.learner_done_at))
                    .filter((a) => (pastTags.length === 0
                      || (a.material?.tagIds ?? []).some((t) => pastTags.includes(t))))
                    .sort((x, y) => (pastSort === 'old'
                      ? new Date(x.assigned_at) - new Date(y.assigned_at)
                      : new Date(y.assigned_at) - new Date(x.assigned_at)))

                  return (
                  <>
                    {/* **アプリでの取り組みは、ここには出さない**(2026-08 利用者の指定)。
                        カードの上(タブの外)に同じ行がすでにあり、
                        **同じ内容が2回並んでいた。**
                        取り組みはこのゲストのことなので、タブの中ではなく
                        カードの上に置く(「リマインドする」もそこにある)。 */}
                    {detailBusy && <p className="muted">読み込み中…</p>}
                    {!detailBusy && assignments.length === 0 && (
                      <p className="card-hint">
                        まだ何も共有していません。「教材」タブから共有できます。
                      </p>
                    )}

                    {/* **教材の「さがす・作る」と同じ形にする**(2026-08 利用者の指定)。
                        たたんでおけて、開閉を覚える。中の札は、その人に出した
                        ものしか出ないのでそのまま残す(件数が付いていて、
                        押す前に結果が読める) */}
                    {assignments.length > 0 && (
                      <details className="card material-search" open={pastOpen}
                               onToggle={(e) => {
                                 setPastOpen(e.currentTarget.open)
                                 savePastFilterOpen(e.currentTarget.open)
                               }}>
                        <summary className="card-title material-search-sum">宿題をしぼる</summary>
                        {/* 取り組みの状態。件数を添えると、押す前に結果が読める */}
                        <div className="chiprow">
                          {[
                            { id: 'all', label: 'すべて', n: assignments.length },
                            { id: 'done', label: 'やった',
                              n: assignments.filter((a) => a.learner_done_at).length },
                            { id: 'todo', label: 'まだ',
                              n: assignments.filter((a) => !a.learner_done_at).length },
                          ].map((f) => (
                            <button key={f.id} type="button"
                                    className={`chip${pastDone === f.id ? ' chip--on' : ''}`}
                                    onClick={() => setPastDone(f.id)}>
                              {f.label} <span className="chip-count">{f.n}</span>
                            </button>
                          ))}
                        </div>

                        {tagList.length > 0 && (
                          <>
                            <p className="field-hint">
                              文法・弱点でしぼる(この人に出したものだけ出ます)
                            </p>
                            <div className="chiprow">
                              {tagList.map(([tag, n]) => (
                                <button key={tag} type="button"
                                        className={`chip${pastTags.includes(tag) ? ' chip--on' : ''}`}
                                        onClick={() => setPastTags(pastTags.includes(tag)
                                          ? pastTags.filter((x) => x !== tag)
                                          : [...pastTags, tag])}>
                                  {weaknessTagLabel(tag)} <span className="chip-count">{n}</span>
                                </button>
                              ))}
                              {pastTags.length > 0 && (
                                <button type="button" className="btn btn--link"
                                        onClick={() => setPastTags([])}>
                                  しぼり込みを外す
                                </button>
                              )}
                            </div>
                          </>
                        )}

                        {/* 並び順は、教材の絞り込みと同じ `filter-row` に置く */}
                        <div className="filter-row">
                          <span className="filter-label">並び順</span>
                          <select value={pastSort} onChange={(e) => setPastSort(e.target.value)}>
                            <option value="new">新しい順</option>
                            <option value="old">古い順</option>
                          </select>
                        </div>
                      </details>
                    )}
                    {assignments.length > 0 && <p className="muted">{shown.length} 件</p>}

                    {assignments.length > 0 && shown.length === 0 && (
                      <p className="card-hint">
                        この条件に当てはまる宿題はありません。しぼり込みを外してください。
                      </p>
                    )}

                    {/* **教材のカードと同じ形にする**(2026-08 利用者の指定)。
                        グレーの囲みを押すと中身が開き、印刷もできる。
                        中身は `MaterialBody` — 教材の画面と同じ部品である。 */}
                    {shown.map((a) => {
                      const m = a.material
                      const open = openHw === a.id
                      const body = m ? bodies[m.id] : null
                      return (
                        <div key={a.id} className="card material-card">
                          <div className="material-head">
                            <div className="material-open" role="button" tabIndex={0}
                                 aria-expanded={open}
                                 onClick={() => m && toggleHw(a)}
                                 onKeyDown={(e) => {
                                   if (e.key !== 'Enter' && e.key !== ' ') return
                                   e.preventDefault()
                                   if (m) toggleHw(a)
                                 }}>
                              {/* 出した日と、取り組みの状態。**いちばん上に置く** */}
                              <div className="past-head">
                                <span className="past-date">{formatDate(a.assigned_at)}</span>
                                <span className={`badge ${a.learner_done_at
                                  ? 'badge--admin' : 'badge--learner'}`}>
                                  {a.learner_done_at ? 'やった' : 'まだ'}
                                </span>
                                {a.admin_checked_at && <span className="badge">確認済</span>}
                              </div>
                              {/* **弱点タグを2回出さない**(教材をさがす画面と同じ決まり)。
                                  弱点は教材名の中にすでに入っており、`MaterialTitle` が
                                  出す(ドリルは見出しそのもの、記事はグレーの札)。
                                  手で名前を付けた教材のために、`fallbackTags` に渡す */}
                              <MaterialTitle
                                title={m?.title ?? '(消された教材)'}
                                headline={m?.headline}
                                hideDate
                                weakness={(m?.tagIds ?? []).map(weaknessTagLabel).join(' + ')}
                                fallbackTags={[(m?.tagIds ?? [])
                                  .map(weaknessTagLabel).join(' + '), cefrLabel(m?.level)]}
                              />
                              {/* カテゴリー名(左)と日付(右)。教材の画面と同じ並び */}
                              <div className="material-meta">
                                <span className="material-kind">{m && kindLabel(m.kind)}</span>
                                <span className="material-when">
                                  {parseMaterialTitle(m?.title ?? '').date}
                                </span>
                              </div>
                              {m && (
                                <span className="material-open-cta">
                                  <span className="material-open-mark" aria-hidden="true">
                                    {open ? '▾' : '▸'}
                                  </span>
                                  {bodyBusy === m.id ? '開いています…'
                                    : open ? '中身を閉じる' : '中身を見る・印刷する'}
                                </span>
                              )}
                            </div>
                          </div>

                          {m?.teaching_point && <TeachingNote text={m.teaching_point} />}

                          {/* 何が何問あるか。**1行に畳む**(教材の画面と同じ) */}
                          <p className="muted material-parts">
                            <span>
                              {m && kindLabel(m.kind)}
                              {m?.itemCount ? ` / ${m.itemCount} 問` : ''}
                            </span>
                          </p>

                          {open && body && (
                            <MaterialBody
                              material={body}
                              openSection={hwSection[body.id] ?? null}
                              onSection={(id) => setHwSection((x) => ({ ...x, [body.id]: id }))}
                              wordStatuses={wordStatuses}
                              /* **レッスンで付けた語は、そのゲストの単語帳へ**(0025) */
                              onMarkWord={markIn(markWord, body.id, openId)}
                              onClose={() => setOpenHw(null)}
                            />
                          )}

                          {/* ここから開けば、**このゲストの教材しか映らない。**
                              「教材」タブから探すと、他のゲストに出したものも
                              画面に並んでしまう(画面共有では見せたくない) */}
                          {m && (
                            <button type="button" className="btn btn--primary"
                                    disabled={lessonBusy === m.id}
                                    onClick={() => openLesson(m.id)}>
                              <ScreenIcon />
                              {lessonBusy === m.id
                                ? '開いています…' : 'セッションで使う(大きく表示)'}
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </>
                  )
                })()}

                {/* **「教材」タブの作る画面と、まったく同じにする**
                    (2026-08 利用者の指定)。

                      > 教材作成のデザインはゲストモード内でも教材モードと
                      > 全く同じにしてください。ゲストモード内は余計な文言が
                      > 多すぎて無駄が多いので注意書きも教材モードと同じく
                      > ほとんどない状態にしてください

                    ここに置いていた「◯◯さんだけに共有されます」の断り書きは
                    外した。**選べるゲストがその人1人しか出ていないので、
                    画面を見れば分かる。** 分かることを文で言わない。 */}
                {detailTab === 'create' && (
                  <>
                    <MaterialForm
                      // 選んだ語が変わったら作り直す。
                      // **key を変えないと、開きっぱなしの入力欄に反映されない**
                      key={mustUse.join('|')}
                      createdBy={me.id}
                      // **この1人しか選べない。** 誤って他のゲストへ
                      // 共有することも、名前が見えることもない
                      learners={[{ id: l.id, display_name: l.display_name, status: 'active' }]}
                      initial={{ level: l.level ?? '', shareWith: [l.id], mustUse }}
                      onCancel={() => setDetailTab('homework')}
                      onCreated={(id, shared) => {
                        setMessage(shared
                          ? `${l.display_name} さんに共有しました。`
                          : '教材を発行しました。');
                        openDetail(l.id, 'homework')
                      }}
                    />
                  </>
                )}

                {detailTab === 'wordbook' && (
                  <LearnerWordbook
                    learnerId={l.id} learnerName={l.display_name}
                    onMakeMaterial={(words) => { setMustUse(words); setDetailTab('create') }}
                  />
                )}

                {detailTab === 'record' && (
                <>
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

                </>
                )}

                <div className="btn-row">
                  <button type="button" className="btn" onClick={() => setOpenId(null)}>閉じる</button>
                </div>
              </div>
            ) : (
              <div className="btn-row">
                <button type="button" className="btn btn--small"
                        onClick={() => openDetail(l.id, 'homework')}>
                  過去の宿題を見る
                </button>
                <button type="button" className="btn btn--small"
                        onClick={() => openDetail(l.id, 'record')}>
                  レベル・スコアを記録する
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
