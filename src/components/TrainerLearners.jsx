/**
 * トレーナーの「ゲスト」画面。
 *
 * レッスン前に開く画面。担当しているゲストのレベル(CEFR)と
 * 最新の TOEIC / VERSANT が一目で分かるようにする。
 * レベルの物差しは教材と同じ CEFR にそろえてある。
 */
import { useEffect, useRef, useState } from 'react'
import { CEFR_LEVELS, SCORE_TESTS, cefrLabel, cefrOption, scoreTestLabel } from '../data/cefr.js'
import {
  addLearnerScore, createAccount, kindLabel, loadLearnerAssignments,
  loadMyLearnersDetailed, loadScoreHistory, setLearnerCefr, setLearnerStatus,
  loadMaterial,
} from '../lib/materials.js'
import { weaknessTagLabel } from '../data/weaknessTags.js'
import MaterialTitle from './MaterialTitle.jsx'
import MaterialBody from './MaterialBody.jsx'
import { parseMaterialTitle } from '../lib/format.js'
import { loadPastFilterOpen, savePastFilterOpen } from '../lib/slashLevel.js'
import LessonView from './LessonView.jsx'
import useWordStatuses, { markIn } from '../lib/useWordStatuses.js'
import Wordbook from './Wordbook.jsx'
import LearnerFiles from './LearnerFiles.jsx'
import LessonNotes from './LessonNotes.jsx'
import MaterialForm from './MaterialForm.jsx'
import SearchBar from './SearchBar.jsx'
import HomeworkFilter, { applyHomeworkFilter } from './HomeworkFilter.jsx'
import { PrintIcon, ScreenIcon } from './Icons.jsx'
import Popover from './Popover.jsx'
import { loadLearnerPractice, practiceStats, sendReminder } from '../lib/practice.js'
import { printElement } from '../lib/print.js'

const STATUS = {
  active:   { label: '受講中', cls: 'badge--admin' },
  paused:   { label: '休会中', cls: 'badge--warn' },
  inactive: { label: '退会済', cls: 'badge--learner' },
}

const today = () => new Date().toISOString().slice(0, 10)
const formatDate = (iso) => (iso ? new Date(iso).toLocaleDateString('ja-JP') : '')

export default function TrainerLearners({ me, navTick = 0 }) {
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
  const [printHwId, setPrintHwId] = useState(null) // 紙に出している宿題の id
  const [bodies, setBodies] = useState({})         // 教材id → 読んだ中身
  const [bodyBusy, setBodyBusy] = useState(null)   // いま読んでいる教材id
  // 絞り込みの欄を開いているか。**教材の欄とは別に覚える**(別の画面の別の欄)
  const [pastOpen, setPastOpen] = useState(loadPastFilterOpen)
  // 過去の宿題の絞り込み。
  // **出すのは、そのゲストの宿題に実際に含まれる弱点だけ。**
  // 39個の弱点タグを全部並べても、ほとんどが0件で選びようがない。
  /* 苦手項目・分野・場面・日付でも絞る(2026-08 利用者の指定)。
     **判断は `HomeworkFilter` 1か所**に置き、ここは値を持つだけ */
  const [pastFilter, setPastFilter] = useState({
    day: null, field: null, topic: null, tag: null,
  })
  const [pastDone, setPastDone] = useState('all')   // all | done | todo
  const [pastSort, setPastSort] = useState('new')   // new | old
  // **名前で引く**(2026-08 利用者の指定。教材の画面と同じ形にする)。
  // 宿題は多くても数十件なので、**手元で絞る。** 聞き直さない
  const [pastKeyword, setPastKeyword] = useState('')

  // スコアを入れるための一時的な入力欄
  const [form, setForm] = useState({ testType: 'toeic', score: '', takenOn: today() })

  // ゲストを追加するための入力欄
  const [adding, setAdding] = useState(false)
  const [newGuest, setNewGuest] = useState({ displayName: '', loginId: '', password: '' })
  const [addBusy, setAddBusy] = useState(false)
  /* **取り組みの細かい数は、押したときだけ出す**(2026-09 利用者の指定)。
     どのゲストの吹き出しを開いているか、と、その相手のボタン */
  const [practiceOf, setPracticeOf] = useState(null)
  const practiceBtn = useRef({})

  const reload = async () => {
    const { data, error: e } = await loadMyLearnersDetailed()
    setLoading(false)
    if (e) { setError(e); return }
    setError(null)
    setLearners(data)
  }
  useEffect(() => { reload() }, [])

  /**
   * **メニューの「ゲスト」をもう一度押したら、一覧へ戻す**(2026-08 利用者の指定)。
   *
   *   > 一人のゲストの情報内でサイドバーの「ゲスト」をクリック、または
   *   > タップしたらゲスト選択画面に戻れるようにしてください
   *
   * いまいる画面をもう一度押しても `view` は変わらないので、
   * App は**押された回数**(`navTick`)で知らせてくる。
   * 最初の描画でも動くが、そのときは開いているものが無いので何も起きない。
   */
  useEffect(() => {
    setOpenId(null)
    setLessonOf(null)
  }, [navTick])

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
   * 宿題を紙に出す。**中身は、押されてから読む。**
   * 一覧は軽くするため中身を持っていない(id と数だけ)。
   * 読み終えてから描き、描き終えてから `printElement` を呼ぶ(下の見張り)。
   */
  const printHw = async (a) => {
    const mid = a.material?.id
    if (!mid) return
    if (!bodies[mid]) {
      setBodyBusy(mid)
      const { data, error: e } = await loadMaterial(mid)
      setBodyBusy(null)
      if (e) { setError(e); return }
      setBodies((x) => ({ ...x, [mid]: data }))
    }
    setPrintHwId(a.id)
  }

  /** 描き終わってから紙に出す。ボタンの中で呼ぶと、前の画面が紙になる */
  useEffect(() => {
    if (!printHwId) return undefined
    const a = assignments.find((x) => x.id === printHwId)
    const el = a?.material?.id
      ? document.getElementById(`material-${a.material.id}`) : null
    if (!el) { setPrintHwId(null); return undefined }
    const done = () => setPrintHwId(null)
    window.addEventListener('afterprint', done)
    const timer = window.setTimeout(done, 60000)
    printElement(el)
    return () => {
      window.removeEventListener('afterprint', done)
      window.clearTimeout(timer)
    }
  }, [printHwId, assignments])

  const openDetail = async (id, tab = 'homework') => {
    setOpenId(id)
    // **開いたら、いちばん上へ。** 一覧の途中から開くと、
    // そのゲストの見出しが画面の外に残ったままになる
    window.scrollTo({ top: 0, behavior: 'auto' })
    setDetailTab(tab)
    setMustUse([])
    setPastFilter({ day: null, field: null, topic: null, tag: null })
    setPastDone('all')
    setPastKeyword('')
    setPrintHwId(null)
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
          /* **開いているあいだは、いちばん外側の囲みを外す**
             (2026-08 利用者の指定)。
               > ゲストモードの一番外側の囲み、いらないです。
               > これを取り除いて教材モードと同じデザインにしてください。
             教材の画面は「囲みの中にカードを入れ子にする」形をしていない。
             一覧では1人1枚のカード、開いたら**そのまま地の上に置く。** */
          <div key={l.id}
               className={`learner-card${openId === l.id ? ' learner-open' : ' card'}`}>
            {/* **見出しは2段にまとめる**(2026-08 利用者の指定)。

                  > この選択中で青くなっている部分、全て、ゲスト名の右手の方に
                  > 綺麗に整理できますよね。現代的で洗練された形で
                  > うまくまとめてください。

                以前はここが縦に4段(名前 / 取り組み / スコア / タブ)あり、
                本題の宿題が画面のずっと下にあった。**右側に寄せて2段にする。**

                  1段目 … 名前・状態      …………  タブ(開いているときだけ)
                  2段目 … 取り組み・スコア …………  リマインドする

                狭い画面では自然に折り返る(タブは横に流れる)。 */}
            <div className={openId === l.id ? 'card learner-headcard' : ''}>
            {/* **左に「誰か」、右に「どのくらいか」。**
                スコアとレベルは名前の真下(左)にあったが、右へ寄せてある
                (2026-09 利用者の指定)。

                **ゲストのアイコンは出さない**(2026-09 利用者の指定)。
                  > やはりゲストのアイコンは入りません。消してください。
                  > 全てのデバイスで不必要です。
                担当しているゲストは1人あたり25人ほどで、名前で足りる。
                丸が並ぶと、そのぶん名前が右へ押し出されて読みにくい。 */}
            {/* **切り替えは、見出しの下に横いっぱいで置く**(2026-09 利用者の指定)。
                  > プルダウンの機能が右にあるのも使いにくい。

                右上の隅は**いちばん指が届きにくい場所**である。
                しかもスコアの真上にあったので、押すたびに数字の列を
                またいでいた。見出しの下に1行取れば、**左端から始まり、
                幅も広く取れる。** スコアは右のままでよい
                (あれは読むもので、押すものではない)。 */}
            <div className="learner-top">
              <div className="learner-who">
                {/* **名前と札を離す**(2026-08 利用者の指定)。
                    > ゲスト名と「受講中」というアイコンが近すぎます。
                    名前そのものも押せる(開く道は下のボタンにもある) */}
                <div className="learner-head">
                  <button type="button" className="learner-name"
                          onClick={() => (openId === l.id ? setOpenId(null) : openDetail(l.id))}>
                    {l.display_name}
                  </button>
                  <span className={`badge ${STATUS[l.status]?.cls ?? ''}`}>
                    {STATUS[l.status]?.label ?? l.status}
                  </span>
                </div>
              </div>

              {/* 右側 … タブと、スコア・レベル。
                  **上下にそろえる。** 別々の行に散らすと目が行き来する */}
              <div className="learner-side">
                {/* スコアとレベル。**日付は出さない**(2026-08 利用者の指定)。
                      > TOEIC、VERSANTのスコアの横の日付ですが、ここでは
                      > 必要ありません。点数が表示されている状態でも3つの
                      > 要素が1行にバランスよく並ぶように直してください。
                    いつ受けたかは「レベルとスコア」のタブで見られる。
                    ここで見たいのは**いまどのくらいか**だけである。

                    **3つを同じ幅で並べる**(`.learner-meta` は3列の grid)。
                    点数が入っても幅が動かないので、ゲストを切り替えても
                    同じ場所に同じものがある。 */}
                <div className="learner-meta">
                  <span className="learner-meta-item">
                    <span className="score-label">TOEIC</span>
                    <span className="score-value">{toeic ? toeic.score : '—'}</span>
                  </span>
                  <span className="learner-meta-item">
                    <span className="score-label">VERSANT</span>
                    <span className="score-value">{versant ? versant.score : '—'}</span>
                  </span>
                  <span className="learner-meta-item">
                    <span className="score-label">レベル</span>
                    <span className="score-value">{cefrLabel(l.cefr)}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* **切り替えは、見出しの下に横いっぱいで置く**(2026-09 利用者の指定)。
                  > プルダウンの機能が右にあるのも使いにくい。

                以前は右上の隅にあった。**いちばん指が届きにくい場所**で、
                しかもスコアの真上なので、押すたびに数字の列をまたいでいた。
                見出しの下に1行取れば、**左端から始まり、幅も広く取れる。**
                スコアは右のままでよい(あれは読むもので、押すものではない)。

                中身は5つ(過去の宿題 / この人に教材を作る / 単語帳 /
                ファイル / レベルとスコア)。タブで横に流していたときは、
                スマホで最初の2つしか見えなかった。 */}
            {openId === l.id && (
              <div className="learner-tabrow">
                <label className="tabpick">
                  <span className="sr-only">ゲストの情報の切り替え</span>
                  <select value={detailTab}
                          onChange={(e) => setDetailTab(e.target.value)}>
                    <option value="homework">
                      過去の宿題{assignments.length ? `(${assignments.length})` : ''}
                    </option>
                    <option value="create">この人に教材を作る</option>
                    {/* 次に何を混ぜるかを決めるとき、その人が何につまずいたかを見たい */}
                    <option value="wordbook">単語帳</option>
                    {/* 会社からもらった英文メール、テストの結果、宿題の写真。
                        ここに置けば、次のレッスンで必ず見つかる(0031) */}
                    <option value="files">ファイル</option>
                    {/* レッスンで気づいたこと・次までの約束(0032)。
                        **ゲスト本人も読める。** 書けるのはトレーナーだけ */}
                    <option value="notes">セッションの記録</option>
                    <option value="record">レベルとスコア</option>
                  </select>
                </label>
              </div>
            )}

            {/* 3段目 … **取り組みを「札」で出す**(2026-08 利用者の指定)。

                  > この情報はこのラップ内の右下の方、「リマインドする」の左に。
                  > もっと情報として目がいくようなデザインにしてくれ。
                  > 文字というより、サインみたいな。

                1本の文は、読まないと分からない。レッスンの入口で見たいのは
                「最後はいつか」「続いているか」なので、**数を大きく、
                何の数かを小さく**添える。
                最後に取り組んだ近さは色でも示すが、
                **色だけに頼らず「きのう」という言葉も必ず出す**(CLAUDE.md)。

                取り組み(0022)はゲストが入力したものではなく、
                こちらが裏で数えたものである(`src/lib/practice.js`)。
                **やっていない人には、その場でリマインドを送れる。**
                自動では飛ばない(利用者の指定) */}
            {(() => {
              const st = practiceStats(practice[l.id])
              return (
                <div className="learner-signs">
                  {/* **いつも見えているのは「最後はいつか」だけ。**
                      レッスンの入口でまず知りたいのはここである */}
                  <span className={`sign sign--last is-${st.fresh}`}
                        title="最後にアプリで取り組んだ日">
                    <span className="sign-dot" aria-hidden="true" />
                    <span className="sign-value">{st.last}</span>
                    <span className="sign-label">最後</span>
                  </span>
                  {/* **細かい数は、押したときだけ出す**(2026-09 利用者の指定)。
                        > 日数とか取り組みの表示がたくさんある割にパッと見て
                        > 何もわからないです。それなら「取り組みをみる」とか、
                        > 何かいい名前のボタンを押してよりわかりやすい
                        > 吹き出しなどで表示される方が良いです

                      札を5つ並べていたので、スマホでは3行を食っていた。
                      **数が多いほど、どれも読まれない。** */}
                  <button type="button" ref={(el) => { practiceBtn.current[l.id] = el }}
                          className="btn btn--small btn--ghost"
                          aria-expanded={practiceOf === l.id}
                          onClick={() => setPracticeOf(practiceOf === l.id ? null : l.id)}>
                    取り組みを見る
                  </button>
                  {practiceOf === l.id && (
                    <Popover anchorEl={practiceBtn.current[l.id]}
                             onClose={() => setPracticeOf(null)}
                             className="practice-pop" label="このゲストの取り組み">
                      <p className="practice-pop-title">{l.display_name} さんの取り組み</p>
                      <dl className="practice-pop-list">
                        <div>
                          <dt>最後に取り組んだ日</dt>
                          <dd>{st.last}</dd>
                        </div>
                        {st.items.map((it) => (
                          <div key={it.label}>
                            {/* **吹き出しには場所がある。** 札の短い名前ではなく、
                                言葉で説明した名前(`full`)を出す */}
                            <dt>{it.full ?? it.label}</dt>
                            <dd>{it.value}{it.unit}</dd>
                          </div>
                        ))}
                      </dl>
                      {/* **やっていない人には、その場で知らせを送れる。**
                          自動では飛ばない(利用者の指定) */}
                      {l.status === 'active' && (
                        <button type="button" className="btn btn--small btn--quiet"
                                disabled={reminding === l.id || reminded[l.id]}
                                onClick={() => remind(l)}>
                          {reminded[l.id] ? '送りました'
                            : reminding === l.id ? '送っています…' : 'リマインドする'}
                        </button>
                      )}
                      <p className="field-hint">
                        アプリで取り組んだぶんを、こちらで数えています。
                        ゲストが入力したものではありません。
                      </p>
                    </Popover>
                  )}
                  {/* **開く道も、この行に置く**(2026-09 利用者の指定)。
                        > このゲストのボックス内の情報と見え方を
                        > プロの仕事で整理してください。

                      以前は「取り組み」の行が右、「この人を開く」が左と
                      **離れた2行**に散っていた。**押すものは1か所にまとめる。**
                      開いているあいだは出さない(上に「一覧に戻る」がある) */}
                  {openId !== l.id && (
                    <button type="button" className="btn btn--small btn--primary"
                            onClick={() => openDetail(l.id, 'homework')}>
                      この人を開く
                    </button>
                  )}
                </div>
              )
            })()}

            {l.status_note && <p className="field-hint">{l.status_note}</p>}
            {l.handoverNote && (
              <p className="homework-instruction">引き継ぎ: {l.handoverNote}</p>
            )}
            </div>{/* .learner-headcard ここまで */}

            {openId === l.id ? (
              /* **教材の画面と同じ形にする**(2026-08 利用者の指定)。
                 > 教材モードには、一番外側の白の枠内に実線がありません。
                 > ゲストモードの実線を消してください。そして、教材同士の間に
                 > 隙間を確保し、教材モードと全く同じデザインにしてください
                 `.assign-box`(青い実線の囲み)は**共有するゲストを選ぶ欄**の
                 ものなので、ここでは使わない。`.stack` と同じ縦の並びにする */
              <div className="learner-detail">

                {detailTab === 'homework' && (() => {
                  // 教材名と見出しで引く。**大文字小文字は問わない**
                  const needle = pastKeyword.trim().toLowerCase()
                  const shown = applyHomeworkFilter(assignments, pastFilter)
                    .filter((a) => (pastDone === 'all'
                      || (pastDone === 'done') === !!a.learner_done_at))
                    .filter((a) => (!needle
                      || `${a.material?.title ?? ''} ${a.material?.headline ?? ''}`
                        .toLowerCase().includes(needle)))
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

                    {/* **「宿題をさがす」を先に、「宿題をしぼる」をその下に**
                        (2026-08 利用者の指定)。
                          > 「宿題をしぼる」を「宿題をさがす」の下に移動させて
                          > ください。そして、教材モードと同じように、検索バーを
                          > 入れ、その右にプルダウンの並び替えをおいてください。
                        帯は `SearchBar.jsx` — 教材の画面と**同じ部品**である。 */}
                    {assignments.length > 0 && (
                      <SearchBar
                        title="宿題をさがす"
                        keyword={pastKeyword}
                        onKeyword={setPastKeyword}
                        placeholder="教材名・見出しでさがす"
                        count={shown.length}
                      />
                    )}

                    {/* **日付・分野・場面・苦手項目で絞る**(2026-08 利用者の指定)。
                          > ここも日付のタブを入れ、その中に新しい順、古い順の
                          > 機能をまとめてくれ。日付タブの右に業界、趣味、
                          > シチュエーション、話題で絞り込む機能を、
                          > そしてもう一つは苦手項目から絞り込む機能だ
                        並び順は**日付の吹き出しの中**に入っている。
                        日付にまつわる操作を1か所にまとめるため。
                        判断は `HomeworkFilter` 1か所(単語帳と同じ考え方) */}
                    {assignments.length > 0 && (
                      <HomeworkFilter
                        rows={assignments}
                        value={pastFilter}
                        onChange={setPastFilter}
                        sort={pastSort}
                        onSort={setPastSort}
                      />
                    )}

                    {/* **たたんでおけて、開閉は覚える。** 中の札は、その人に
                        出したものしか出ないのでそのまま残す(件数が付いていて、
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

                        {/* **苦手項目は、上の絞り込みの行へ移した**
                            (2026-08 利用者の指定)。ここに残すと2か所になる */}

                      </details>
                    )}


                    {assignments.length > 0 && shown.length === 0 && (
                      <p className="card-hint">
                        この条件に当てはまる宿題はありません。しぼり込みを外してください。
                      </p>
                    )}

                    {/* **教材のカードと同じ形にする**(2026-08 利用者の指定)。
                        **開く・閉じるはやめた**(2026-09 利用者の指定)。
                        押すものははじめから出ており、囲みはただの見出しである。 */}
                    {shown.map((a) => {
                      const m = a.material
                      const body = m ? bodies[m.id] : null
                      return (
                        <div key={a.id} className="card material-card">
                          <div className="material-head">
                            <div className="material-open">
                              {/* 出した日と、取り組みの状態。**いちばん上に置く**。

                                  **いつ取り組んだかも出す**(2026-09 利用者の指定)。
                                    > やった もいらないです
                                    > やればトレーナー側でわかる仕組みにしてください
                                  ゲストの申告をやめ、**開いた時点で記録される**ように
                                  したので、日付そのものが「いつ手を付けたか」になる。
                                  「やった」だけでは、今日なのか3週間前なのか分からない */}
                              <div className="past-head">
                                <span className="past-date">{formatDate(a.assigned_at)}</span>
                                <span className={`badge ${a.learner_done_at
                                  ? 'badge--admin' : 'badge--learner'}`}>
                                  {a.learner_done_at ? 'やった' : 'まだ'}
                                </span>
                                {a.learner_done_at && (
                                  <span className="past-date">
                                    {formatDate(a.learner_done_at)} に取り組み
                                  </span>
                                )}
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
                              {/* **開く・閉じるはやめた**(2026-09 利用者の指定)。
                                  教材が出るところは全部同じ形にする。
                                  **読み込み中だけは言葉で出す** */}
                              {bodyBusy === m?.id && (
                                <span className="material-open-cta">開いています…</span>
                              )}
                            </div>
                          </div>

                          {/* 指導ポイントはカードに出さない(2026-09 利用者の指定)。
                              教材のあるところ全てで同じにする */}

                          {/* 何が何問あるか。**1行に畳む**(教材の画面と同じ) */}
                          <p className="muted material-parts">
                            <span>
                              {m && kindLabel(m.kind)}
                              {m?.itemCount ? ` / ${m.itemCount} 問` : ''}
                            </span>
                          </p>

                          {/* **押すものは、はじめから出す**(2026-09 利用者の指定)。
                              教材が出るところは全部同じ形にする。
                              印刷は中身を読んでからなので、押すと少し待つ */}
                          {m && (
                            <div className="btn-row">
                              <button type="button" className="btn btn--small"
                                      disabled={bodyBusy === m.id}
                                      onClick={() => printHw(a)}>
                                <PrintIcon />
                                {bodyBusy === m.id ? '開いています…' : '印刷 / PDFで保存'}
                              </button>
                              {/* ここから開けば、**このゲストの教材しか映らない。**
                                  「教材」タブから探すと、他のゲストに出したものも
                                  画面に並んでしまう(画面共有では見せたくない) */}
                              <button type="button" className="btn btn--primary"
                                      disabled={lessonBusy === m.id}
                                      onClick={() => openLesson(m.id)}>
                                <ScreenIcon />
                                {lessonBusy === m.id
                                  ? '開いています…' : 'セッションで使う(大きく表示)'}
                              </button>
                            </div>
                          )}

                          {/* **中身は、紙に出す一瞬だけ描く** */}
                          {printHwId === a.id && body && (
                            <div className="print-holder">
                              <MaterialBody
                                material={body}
                                wordStatuses={wordStatuses}
                                /* **レッスンで付けた語は、そのゲストの単語帳へ**(0025) */
                                onMarkWord={markIn(markWord, body.id, openId)}
                              />
                            </div>
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

                {/* **単語帳は1つの部品**(2026-09 実機で3度目の指摘)。
                    トレーナー用に別のものを持っていたので、そろえたつもりでも
                    「おまかせ」も出題もこちらに無いままだった。
                    **同じ部品に、誰の単語帳かを渡すだけにする。**
                    こうすれば、片方だけ古くなることが起こりえない */}
                {detailTab === 'wordbook' && (
                  <Wordbook
                    learnerId={l.id} learnerName={l.display_name}
                    onMakeMaterial={(words) => { setMustUse(words); setDetailTab('create') }}
                  />
                )}

                {detailTab === 'files' && (
                  <LearnerFiles learnerId={l.id} learnerName={l.display_name} />
                )}

                {detailTab === 'notes' && (
                  <LessonNotes learnerId={l.id} learnerName={l.display_name} />
                )}

                {detailTab === 'record' && (
                <>
                <p className="field-label">レベル(CEFR)</p>
                <div className="btn-row">
                  {CEFR_LEVELS.map((c) => (
                    <button key={c.id} type="button" title={cefrOption(c.id)}
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
                  {/* **取りうる範囲を入力欄そのものに持たせる**
                      (2026-08 利用者の指定。TOEIC 100〜990 / VERSANT 10〜90)。
                      入れてから断られるより、入れる前に分かるほうがよい */}
                  {(() => {
                    const t = SCORE_TESTS.find((x) => x.id === form.testType)
                    return (
                      <input type="number" className="score-input"
                             placeholder={t && t.id !== 'other' ? `${t.min}〜${t.max}` : 'スコア'}
                             min={t?.min} max={t?.max} step={t?.step}
                             value={form.score}
                             onChange={(e) => setForm({ ...form, score: e.target.value })} />
                    )
                  })()}
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
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
