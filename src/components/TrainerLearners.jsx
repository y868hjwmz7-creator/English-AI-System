/**
 * トレーナーの「ゲスト」画面。
 *
 * レッスン前に開く画面。担当しているゲストのレベル(CEFR)と
 * 最新の TOEIC / VERSANT が一目で分かるようにする。
 * レベルの物差しは教材と同じ CEFR にそろえてある。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Loading from './Loading.jsx'
import { CEFR_LEVELS, SCORE_TESTS, cefrLabel, cefrOption, scoreTestLabel } from '../data/cefr.js'
import { lastLearner, rememberLearner, watchLearner } from '../lib/lastLearner.js'
/* **状態の対応表は `data/learnerStatus.js` 1か所。**
   上に貼り付く箱(`LearnerBar`)でも同じ札を出す */
import { LEARNER_STATUS, statusCls, statusLabel } from '../data/learnerStatus.js'
import {
  addLearnerScore, createAccount, kindLabel, loadLearnerAssignments,
  eraseLearner, loadMyLearnersDetailed, loadScoreHistory, setLearnerCefr, setLearnerStatus,
  loadMaterial, wordsAddedNote,
} from '../lib/materials.js'
import { weaknessTagLabel } from '../data/weaknessTags.js'
import MaterialTitle from './MaterialTitle.jsx'
import MaterialBody from './MaterialBody.jsx'
import MaterialDelete from './MaterialDelete.jsx'
import { parseMaterialTitle } from '../lib/format.js'
import { loadPastSearchOpen, savePastSearchOpen } from '../lib/slashLevel.js'
import LessonView from './LessonView.jsx'
import useWordStatuses, { markIn } from '../lib/useWordStatuses.js'
import Wordbook from './Wordbook.jsx'
/* **教材をさがす画面は1つ**(2026-09 利用者の指定)。
   ゲストのページの中でも、トレーナーの「教材」とまったく同じものを出す */
import TrainerMaterials from './TrainerMaterials.jsx'
import QrReview from './QrReview.jsx'
import LearnerFiles from './LearnerFiles.jsx'
import LessonNotes from './LessonNotes.jsx'
import SpeechBoard from './SpeechBoard.jsx'
import MaterialForm from './MaterialForm.jsx'
import SearchBar from './SearchBar.jsx'
import HomeworkFilter from './HomeworkFilter.jsx'
/* **絞る・引く・並べるは `homeworkFilter.js` 1か所**(ゲストの
   「今週の宿題」と分け合っている)。画面ごとに書くと必ず食い違う */
import { homeworkFilterOn, narrowHomework } from '../lib/homeworkFilter.js'
import { PrintIcon, ScreenIcon } from './Icons.jsx'
import Popover from './Popover.jsx'
import { loadLearnerPractice, practiceStats, sendReminder } from '../lib/practice.js'
import { loadWeeklyGoal, setWeeklyGoal } from '../lib/goals.js'
import { loadLearnerFeatures, setLearnerFeature } from '../lib/learnerFeatures.js'
import { LEARNER_FEATURES } from '../data/learnerFeatures.js'
import { printElement } from '../lib/print.js'
import { viewerRoleOf } from '../lib/viewer.js'


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
  /* **開いているゲスト。控えは `lastLearner.js` 1か所**(2026-09 実機)。
     ほかの画面へ移るとこの部品ごと外れるので、`useState` だけだと
     戻ってきたときに一覧に立っている。**設定ではなく居場所**なので、
     端末には残さない(読み込み直せば消える) */
  const [openId, setOpenIdRaw] = useState(null)
  const setOpenId = useCallback((id) => { rememberLearner(id); setOpenIdRaw(id) }, [])
  /* **名前から探す**(2026-09 利用者の指定
     「担当しているゲスト内に『名前から探す』を入れて下さい」)。
     いま担当が 22 人いて、これから 25 人まで増える(CLAUDE.md 冒頭)。
     名前で引けないと、目当ての人を見つけるのに一覧を送ることになる。
     **覚えない** —— 探すのはその場の操作であって、設定ではない。 */
  const [who, setWho] = useState('')
  /* **絞るのは一覧だけ。** 開いているゲストは `openId` で引くので、
     打ち込んだ名前に当てはまらなくても**開いたまま**である
     (絞り込みのせいで、開いていた人が消えては困る)。 */
  const shown = useMemo(() => {
    const q = who.trim().toLowerCase()
    if (!q) return learners
    return learners.filter((l) => (l.display_name || '').toLowerCase().includes(q))
  }, [learners, who])
  /* 記録をすべて消すとき(0041)。**名前を打ち込ませる**ので、
     どのゲストの、いま何を入力しているかまで覚える */
  const [erasing, setErasing] = useState(null)
  const [history, setHistory] = useState([])
  /* **週の目標**(0042・2026-09 利用者の指定「週の目標と、達成の印」)。
     **決めるのはトレーナー。ゲスト本人ではない** ——
     自分で下げられる目標は、目標にならない。判定は `set_weekly_goal()` の中 */
  const [goal, setGoal] = useState({ words: '', sentences: '' })
  const [goalBusy, setGoalBusy] = useState(false)

  /* **この人に出すもの**(0055・2026-09 利用者の指定)。
     > これは、トレーナー側から指定したゲストにのみ映るようにしてください
     一覧は `src/data/learnerFeatures.js` 1か所。**ここに書き写さない** */
  const [features, setFeatures] = useState(new Set())
  const [featureBusy, setFeatureBusy] = useState(null)
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
  /* 「宿題をさがす・しぼる」の開け閉め。**教材の欄とは別に覚える**
     (別の画面の別の欄)。2026-09 に**さがすとしぼるを1つにまとめた**ので、
     控えも1つになった(`eas.pastFilter` は使わなくなり、消してある)。
     **値を偽にするだけにしない** —— 残すと、次に見た人が
     「まだ使うのかもしれない」と読む */
  const [pastSearchOpen, setPastSearchOpen] = useState(loadPastSearchOpen)
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
   * **ゲスト名の箱に、名前と状態を渡す**(2026-09 利用者の指定)。
   *
   *   > ゲストを一人選んでそのページの中にいるときは、
   *   > 常に画面上部にゲスト名ボックスが固定されているように
   *
   * 箱を描くのは `App.jsx`(貼り付く役は `.app-stick` 1つが持っている)。
   * **id だけでは箱に何も書けない**ので、名前と状態もここから渡す ——
   * こちらはもう持っているので、**取りに行かせない。**
   */
  useEffect(() => {
    if (!openId) return
    const l = learners.find((x) => x.id === openId)
    if (l) rememberLearner(openId, { name: l.display_name, status: l.status })
  }, [openId, learners])

  /**
   * **箱の「← 一覧」を押したら、こちらも閉じる。**
   *
   * 押したのは `App.jsx` の側にある部品なので、
   * `setOpenId(null)` は通らない。**控えを見張って合わせる** ——
   * 合わせないと、箱だけ消えてゲストのページが開いたまま残る。
   */
  useEffect(() => watchLearner((who) => {
    if (!who) setOpenIdRaw(null)
  }), [])

  /* 控えていたゲストが、いまの担当から外れていることがある(退会・担当替え)。
     そのときは**黙って一覧へ戻す** —— 絞り込むと0件になり、
     「← ゲストの一覧に戻る」だけが浮いた白い画面が残る */
  useEffect(() => {
    if (loading || !openId) return
    if (!learners.some((l) => l.id === openId)) setOpenId(null)
  }, [loading, learners, openId, setOpenId])

  /**
   * **メニューの「ゲスト」をもう一度押したら、一覧へ戻す**(2026-08 利用者の指定)。
   *
   *   > 一人のゲストの情報内でサイドバーの「ゲスト」をクリック、または
   *   > タップしたらゲスト選択画面に戻れるようにしてください
   *
   * いまいる画面をもう一度押しても `view` は変わらないので、
   * App は**押された回数**(`navTick`)で知らせてくる。
   * **App が数えるのは「同じ画面をもう一度押したとき」だけ**なので、
   * 教材を見に行って戻ってきただけでは、ここは動かない(2026-09 実機)。
   *
   * **最初の描画では動かさない**(`first`)。開いていたゲストを
   * 開き直す(下の `useEffect`)ので、そこで打ち消してしまう。
   */
  const first = useRef(true)
  useEffect(() => {
    if (first.current) { first.current = false; return }
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
    setGoal({ words: '', sentences: '' })
    setFeatures(new Set())
    setDetailBusy(true)
    // `loadLearnerSummary`(study_logs の合計)は読まない。
    // **もう誰も入力しないので、いつも 0 になる**(2026-08 の設計変更)
    const [{ data: hist }, { data: past }, { data: aim }, { data: feat }] = await Promise.all([
      loadScoreHistory(id), loadLearnerAssignments(id),
      /* 0042 を貼る前は 0 が返る。**欄が空になるだけで、画面は壊れない** */
      loadWeeklyGoal(id),
      /* 0055 を貼る前は空の集合が返る。**既定(出さない)のままになる** */
      loadLearnerFeatures(id),
    ])
    setHistory(hist ?? [])
    setAssignments(past ?? [])
    setGoal({
      words: aim?.wordsGoal ? String(aim.wordsGoal) : '',
      sentences: aim?.sentGoal ? String(aim.sentGoal) : '',
    })
    setFeatures(feat ?? new Set())
    setDetailBusy(false)
  }

  /* **開いていたゲストのまま戻る**(2026-09 実機・利用者の指定)。
     ほかの画面から戻ってきたときは、名前を探し直させない。
     **開くのは `openDetail` に任せる** —— 中身(スコア・宿題・目標)を
     読み込むのはあちらなので、`openId` だけ戻しても欄が空のままになる。
     一覧に戻る道(メニューの「ゲスト」・「← 一覧に戻る」・「閉じる」)は
     どれも `setOpenId(null)` を通り、控えも一緒に消える */
  useEffect(() => {
    const back = lastLearner()
    if (back) openDetail(back)
  }, [])

  /**
   * 週の目標を決める(0042)。
   * **0(空欄)は「決めていない」。** 消す道を別に作らない ——
   * 空にすれば、ゲストの画面から目標そのものが消える。
   */
  const submitGoal = async (learner) => {
    if (goalBusy) return
    setGoalBusy(true)
    const { error: e } = await setWeeklyGoal(
      learner.id, Number(goal.words) || 0, Number(goal.sentences) || 0,
    )
    setGoalBusy(false)
    if (e) { setError(e); return }
    setError(null)
    const w = Number(goal.words) || 0
    const t = Number(goal.sentences) || 0
    setMessage(w || t
      ? `${learner.display_name} さんの今週の目標を、語 ${w} / 文 ${t} にしました。`
      : `${learner.display_name} さんの週の目標を外しました。`)
  }

  /**
   * **この人に出すものを決める**(0055・2026-09 利用者の指定)。
   *
   *   > これは、トレーナー側から指定したゲストにのみ映るようにしてください
   *
   * **門番は `set_learner_feature()` の中**(担当トレーナーと管理者だけ)。
   * 画面に持たせない —— 2か所に置くと必ず食い違う。
   *
   * **黙って切り替えない。** 何が起きたのかを1行で出す
   * (成功と失敗を、同じ見た目で終わらせない)。
   */
  const toggleFeature = async (learner, feat) => {
    if (featureBusy) return
    const next = !features.has(feat.id)
    setFeatureBusy(feat.id)
    const { error: e } = await setLearnerFeature(learner.id, feat.id, next)
    setFeatureBusy(null)
    if (e) { setError(e); return }
    setError(null)
    const now = new Set(features)
    if (next) now.add(feat.id); else now.delete(feat.id)
    setFeatures(now)
    setMessage(next
      ? `${learner.display_name} さんの画面に「${feat.label}」を出しました。`
      : `${learner.display_name} さんの画面から「${feat.label}」を外しました。`)
  }

  const changeCefr = async (learner, cefr) => {
    const { error: e } = await setLearnerCefr(learner.id, cefr)
    if (e) { setError(e); return }
    setError(null)
    setMessage(`${learner.display_name} さんのレベルを ${cefr || '未判定'} にしました。`)
    reload()
  }

  /**
   * 記録をすべて消す(0041)。**管理者だけ。**
   *
   * 消したあとは、そのゲストのカードごと一覧から消えるので、
   * **開いている画面も閉じて**一覧を読み直す。
   */
  const eraseNow = async (learner) => {
    setErasing({ ...erasing, busy: true })
    const { data, error: e } = await eraseLearner(learner.id)
    if (e) { setErasing({ ...erasing, busy: false }); setError(e); return }
    /* **何件消したかを、そのまま出す。**「消しました」だけだと、
       本当に消えたのか、何も無かったのかが分からない */
    const counts = Object.entries(data ?? {})
      .filter(([, n]) => n > 0).map(([k, n]) => `${k} ${n}`).join(' / ')
    setErasing(null)
    setOpenId(null)
    setError(null)
    setMessage(`${learner.display_name} さんの記録を消しました`
      + `${counts ? `(${counts})` : ''}。`
      + ' ログインそのものは残っています —— Supabase の Authentication → Users から'
      + ' その人を Delete user してください。')
    reload()
  }

  const changeStatus = async (learner, status) => {
    const note = window.prompt(
      `${learner.display_name} さんを「${statusLabel(status)}」にします。理由をひとこと(任意)`,
      status === 'paused' ? '月額コース休止中' : status === 'inactive' ? '退会' : '',
    )
    if (note === null) return   // 取り消し
    const { error: e } = await setLearnerStatus(learner.id, status, note)
    if (e) { setError(e); return }
    setError(null)
    setMessage(`${learner.display_name} さんを「${statusLabel(status)}」にしました。`)
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

  if (loading) return <Loading />

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
      {/* **「← 一覧に戻る」は、上の箱へ移した**(2026-09 利用者の指定)。
          ここに置くと**中身と一緒に送られて消える** ——
          戻る道が画面から消えるのはいちばん困る。
          **同じものを2か所に出さない**ので、こちらからは外してある
          (下の「閉じる」は残る。行き止まりにはならない)。 */}

      {/* **形は「教材をさがす」とそろえる**(`card finder` + `finder-head`)。
          題とボタンが1行、その下に名前で引く欄。**同じ見た目を
          書き写さない**ので、欄そのものは `SearchBar` を使い回す。 */}
      {!openId && (
      <div className="card finder">
        <div className="finder-head">
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
          <>
            {/* **件数(◯ 件)は渡さない。** ゲストは「人」で数える。
                下の1行が、絞ったあとの人数まで受け持つ */}
            <SearchBar keyword={who} onKeyword={setWho} placeholder="名前から探す" />
            {/* **黙って絞らない**(CLAUDE.md)。当てはまる人がいないときは、
                いないことをはっきり言う ——「まだ担当がいない」のか
                「絞り込みで消えた」のかが分からないと、行き止まりになる */}
            <p className="card-hint">
              {who.trim()
                ? (shown.length === 0
                  ? `「${who.trim()}」に当てはまるゲストがいません。`
                  : `該当 ${shown.length} 人 / 担当 ${learners.length} 人`)
                : `${learners.length} 人 / 受講中 ${learners.filter((l) => l.status === 'active').length} 人`}
            </p>
          </>
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
      {(openId ? learners.filter((l) => l.id === openId) : shown).map((l) => {
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
                  {/* **開いているあいだは、名前で閉じない**(2026-09 実機)。
                      ここは見出しでいちばん大きい字(20px 太字)なので、
                      画面共有中に触れただけで一覧へ飛んでいた。
                        > 何か一つ間違えるとすぐにゲスト一覧に飛んでしまい
                      閉じる道は「← ゲストの一覧に戻る」と下の「閉じる」の
                      2つ残る。**行き止まりにはならない** */}
                  {/* **開いているあいだも、名前は出す**(2026-09 実機・
                      利用者の指定。**方針の変更**)。

                        > 一番上のVERSANTのスコアなどが表示されている
                        > ボックス内の左上、元々ゲストの名前があった
                        > ところにも名前を入れて下さい。
                        > ぽっかり空いていてデザインが微妙です。

                      一度は「上に貼り付く箱(`LearnerBar`)が出しているので
                      同じものが2つになる」として外したが、**この箱の左上が
                      まるごと空き、右のスコアだけが浮いて見えた。**
                      貼り付く箱は**画面の上端**にあり、この箱は**紙面の
                      いちばん上**なので、役目が違う ——
                      あちらは送っても消えない道しるべ、こちらは
                      「この数字は誰のものか」の見出しである。

                      **札(受講中)は足さない。** 言われたのは名前だけで、
                      札は貼り付く箱の右端に出ている。

                      **押せなくする**(2026-09 実機)。ここは名前でいちばん
                      大きい字なので、画面共有中に触れただけで一覧へ飛んで
                      いた。閉じる道は「← 一覧」と下の「閉じる」の2つ残る。 */}
                  {openId === l.id ? (
                    <span className="learner-name is-open">{l.display_name}</span>
                  ) : (
                    <>
                      <button type="button" className="learner-name"
                              onClick={() => openDetail(l.id)}>
                        {l.display_name}
                      </button>
                      <span className={`badge ${statusCls(l.status)}`}>
                        {statusLabel(l.status)}
                      </span>
                    </>
                  )}
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
                    {/* **ゲストのページの中でも、教材をさがせる**
                        (2026-09 利用者の指定)。

                          > 同じくゲストページ内で自分の教材を検索できる
                          > ようにしたいぞ。要するにトレーナーの教材の
                          > 画面の表示と同じようにしてくれ

                        **部品は `TrainerMaterials` そのもの。** 書き写すと
                        必ず片方だけ古くなる(単語帳で踏んだ失敗)。
                        **教材ライブラリの再利用がこの仕組みの前提**なので
                        (CLAUDE.md 冒頭)、「作る」より先に置く */}
                    <option value="library">教材をさがす</option>
                    <option value="create">この人に教材を作る</option>
                    {/* 次に何を混ぜるかを決めるとき、その人が何につまずいたかを見たい */}
                    <option value="wordbook">単語帳</option>
                    {/* **Quick Response の復習**(0040)。教材の中で「まだ」を
                        押した文が溜まる。単語帳と同じで、レッスン中に
                        一緒に取り組めば、それはゲストの学習として残る */}
                    <option value="qr">Quick Response</option>
                    {/* **スピーチ**(0054・2026-09 利用者の指定)。
                          > トレーナー側からもゲスト毎にスピーチを
                          > 登録できます。
                        部品は `SpeechBoard` そのもの。**書き写さない** ——
                        ゲストの「スピーチ練習」とまったく同じものが出る */}
                    <option value="speech">スピーチ</option>
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
                  // 絞る・引く・並べるは `narrowHomework()` 1か所
                  const shown = narrowHomework(assignments, {
                    filter: pastFilter, keyword: pastKeyword,
                    done: pastDone, sort: pastSort,
                  })

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

                    {/* ── **さがすとしぼるは、1つの箱にまとめる** ──────────
                        2026-09 実機・利用者の指定。

                          > 「教材をさがす」と「教材を絞る」を１つにまとめて、
                          > そして「日付・並び順」「分野: すべて」
                          > 「苦手項目で絞る」をその下においてくれ

                        **畳める箱が2つ、同じ見た目で縦に並んでいた**
                        (「宿題をさがす」と「宿題をしぼる」)。しかも
                        そのあいだに絞り込みの行が挟まっていたので、
                        **どちらを開けばよいのか押すまで分からない。**
                        中身は「名前で引く」と「取り組みで絞る」で、
                        **どちらも一覧を狭めるという1つのこと**である。

                        並びは
                          ▸ 宿題をさがす・しぼる            [3 件]
                          [日付・並び順][分野][苦手項目]     ← その下

                        帯は `SearchBar.jsx` — 教材の画面と**同じ部品**。
                        件数の札は畳んだままでも見えるので、
                        **開かなくても何件あるかは分かる。**

                        **教材の画面(トレーナーの「教材」)は1ドットも
                        変えていない。** あちらは「探す / 条件で絞り込む / 作る」の
                        3つで、まとめてよいものが別である
                        (言われた場所だけを直す)。 */}
                    {assignments.length > 0 && (
                      <SearchBar
                        title="宿題をさがす・しぼる"
                        keyword={pastKeyword}
                        onKeyword={setPastKeyword}
                        placeholder="教材名・見出しでさがす"
                        count={shown.length}
                        collapsible
                        open={pastSearchOpen}
                        onOpenChange={(v) => { setPastSearchOpen(v); savePastSearchOpen(v) }}
                        /* **黙って絞らない。** 欄は畳むと見えなくなるので、
                           掛かっているときだけ題のとなりに印を出す(CLAUDE.md) */
                        mark={homeworkFilterOn(pastFilter) ? 'しぼり込み中' : null}
                      >
                        {/* 取り組みの状態。件数を添えると、押す前に結果が読める。
                            **その人に出したものしか出ない**ので、教材の画面の
                            `WeaknessTagPicker`(39個ぜんぶ)には替えない */}
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

                        {/* **日付・分野・場面・苦手項目で絞る**(2026-08 利用者の指定)。
                              > ここも日付のタブを入れ、その中に新しい順、古い順の
                              > 機能をまとめてくれ。日付タブの右に業界、趣味、
                              > シチュエーション、話題で絞り込む機能を、
                              > そしてもう一つは苦手項目から絞り込む機能だ
                            並び順は**日付の吹き出しの中**に入っている。
                            日付にまつわる操作を1か所にまとめるため。
                            判断は `HomeworkFilter` 1か所(単語帳と同じ考え方)。

                            **置くのは、まとめた箱の中**(2026-09 実機・利用者の指定)。
                              > 日付や絞り込みのプルダンは
                              > 「宿題をさがす・しぼる」の中にしまって欲しいです
                            箱の下に並べていたので、**畳んでも欄だけが残って**いた */}
                        <HomeworkFilter
                          rows={assignments}
                          value={pastFilter}
                          onChange={setPastFilter}
                          sort={pastSort}
                          onSort={setPastSort}
                        />
                      </SearchBar>
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

                          {/* **教材を消す**(2026-09 利用者の指定
                              「全ての場面にて」)。部品は教材の画面と同じ1つで、
                              消せない人にはボタンごと出ない。
                              **消えるのは教材そのもの**なので、この宿題も
                              道連れになる(`assignments` は cascade) */}
                          {m && (
                            <MaterialDelete
                              material={m} me={me}
                              onDeleted={(id) => setAssignments((list) => list
                                .filter((x) => x.material?.id !== id))} />
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
                {detailTab === 'library' && (
                  <TrainerMaterials
                    me={me}
                    /* **共有先はこの1人に決まる。**
                       選ぶ欄を出すと、担当ゲスト25人の名前が
                       画面共有に映る(仕様書 5.5) */
                    forLearner={{ id: l.id, name: l.display_name }}
                    /* **「教材を作る」は、となりのタブへ回す。**
                       同じことをするものを2つ見せない */
                    onCreate={() => setDetailTab('create')}
                  />
                )}

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
                      onCreated={(id, shared, words) => {
                        setMessage(shared
                          ? `${l.display_name} さんに共有しました。${wordsAddedNote(words)}`
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

                {/* **復習の画面は1つ**(`QrReview`)。単語帳と同じ考え方で、
                    「誰の復習か」を渡すだけにする。**似たものを2つ持たない**
                    (単語帳で `LearnerWordbook` を別に持って踏んだ失敗) */}
                {detailTab === 'qr' && (
                  <QrReview learnerId={l.id} learnerName={l.display_name} />
                )}

                {/* **スピーチの原稿と、その添削**(0054)。
                    ゲストの「スピーチ練習」と**まったく同じ部品**である。
                    ちがうのは `learnerId` を渡すかどうかだけ */}
                {/* **添削も語の意味も、そのゲストのレベルで頼む**
                    (2026-09 利用者の指定)。落とし先は `speechLevelOf()` */}
                {detailTab === 'speech' && (
                  <SpeechBoard learnerId={l.id} learnerName={l.display_name}
                               level={l.cefr ?? null} />
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

                {/* ── 週の目標(0042・2026-09 利用者の指定)──────────────
                    > 週の目標と、達成の印

                    **決めるのはトレーナー。ゲスト本人ではない。**
                    自分で下げられる目標は、目標にならない。
                    守っているのは画面ではなく `set_weekly_goal()` の中である。

                    **空欄(0)は「決めていない」。** 外す道を別に作らない ——
                    空にして押せば、ゲストの画面から目標そのものが消える。 */}
                <p className="field-label">週の目標</p>
                <div className="filter-row">
                  <label className="filter-label">
                    単語帳
                    <input type="number" className="score-input" min="0" max="2000"
                           placeholder="語" value={goal.words}
                           onChange={(e) => setGoal({ ...goal, words: e.target.value })} />
                  </label>
                  <label className="filter-label">
                    Quick Response
                    <input type="number" className="score-input" min="0" max="2000"
                           placeholder="文" value={goal.sentences}
                           onChange={(e) => setGoal({ ...goal, sentences: e.target.value })} />
                  </label>
                  <button type="button" className="btn btn--small"
                          disabled={goalBusy} onClick={() => submitGoal(l)}>
                    {goalBusy ? '決めています…' : '決める'}
                  </button>
                </div>
                <p className="field-hint">
                  1週間に答える数です。ゲストの単語帳と Quick Response に、
                  あと何問かが出ます。空にして押せば外れます。
                  日ではなく週で数えるので、1日休んでも途切れません。
                </p>

                {/* ── この人に出すもの(0055・2026-09 利用者の指定)────────
                    > ゲストの画面から基礎英文法講座と基本単語を取り除いて
                    > ください。これは、トレーナー側から指定したゲストにのみ
                    > 映るようにしてください

                    **既定は「出さない」。** 入れたゲストの画面にだけ出る。
                    一覧は `src/data/learnerFeatures.js` 1か所 ——
                    ここに書き写すと、足したときに片方だけ残る
                    (`LEARNER_STATUS` と同じ考え方)。

                    **守っているのは画面ではなく `set_learner_feature()` の中**
                    であって、担当していないゲストには書けない。 */}
                <p className="field-label">この人の画面に出すもの</p>
                {LEARNER_FEATURES.map((f) => (
                  <div key={f.id} className="feature-row">
                    <button type="button"
                            className={`btn btn--toggle${features.has(f.id) ? ' is-active' : ''}`}
                            disabled={featureBusy === f.id}
                            aria-pressed={features.has(f.id)}
                            onClick={() => toggleFeature(l, f)}>
                      {featureBusy === f.id
                        ? '決めています…'
                        : `${features.has(f.id) ? '出しています' : '出していません'} — ${f.label}`}
                    </button>
                    <p className="field-hint">{f.hint}</p>
                  </div>
                ))}

                <p className="field-label">在籍状態</p>
                <div className="btn-row">
                  {/* **一覧は `learnerStatus.js` 1か所。**
                      ここに書き写すと、状態を足したときに片方だけ残る */}
                  {Object.keys(LEARNER_STATUS).map((st) => (
                    <button key={st} type="button"
                            className={`btn btn--toggle${l.status === st ? ' is-active' : ''}`}
                            onClick={() => l.status !== st && changeStatus(l, st)}>
                      {statusLabel(st)}
                    </button>
                  ))}
                </div>

                {/* ── 記録をすべて消す(0041・管理者だけ)────────────────
                    2026-09 の安全性レビュー 03-3位。

                      > 退会したときに、まとめて消す手順がありません。
                      > 「消してほしい」と言われたときに応えられない状態です。

                    **取り返しがつかないので、押し間違いでは進めない。**
                    ・出すのは管理者だけ(判定は `viewer.js` を通す。
                      守っているのは画面ではなく `erase_learner()` の中である)
                    ・**名前を打ち込ませる。** 2段(「本当に消す」)だけでは、
                      並んだカードの取り違えを防げない
                    ・**何件消したかを返して、そのまま出す**
                      (成功と失敗を、同じ見た目で終わらせない) */}
                {viewerRoleOf() === 'owner' && (
                  <div className="erase-box">
                    <p className="field-label">記録をすべて消す</p>
                    {erasing?.id !== l.id ? (
                      <button type="button" className="btn btn--small"
                              onClick={() => { setErasing({ id: l.id, typed: '' }); setError(null) }}>
                        このゲストの記録をすべて消す…
                      </button>
                    ) : (
                      <>
                        <p className="field-hint">
                          <strong>取り消せません。</strong>
                          名前・スコア・セッションの記録・単語帳・置いたファイルまで、
                          すべて消えます(教材そのものは残ります)。
                          進めるには <strong>{l.display_name}</strong> と入力してください。
                        </p>
                        <div className="card-tools">
                          <input type="text" value={erasing.typed}
                                 aria-label="消すゲストの名前"
                                 placeholder={l.display_name}
                                 onChange={(e) => setErasing({ ...erasing, typed: e.target.value })} />
                          <button type="button" className="btn btn--small btn--danger"
                                  disabled={erasing.typed.trim() !== (l.display_name ?? '').trim()
                                    || erasing.busy}
                                  onClick={() => eraseNow(l)}>
                            {erasing.busy ? '消しています…' : '消す'}
                          </button>
                          <button type="button" className="btn btn--small"
                                  onClick={() => setErasing(null)}>やめる</button>
                        </div>
                      </>
                    )}
                  </div>
                )}

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
