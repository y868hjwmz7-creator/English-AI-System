import { useEffect, useRef, useState } from 'react'
import AdminDashboard from './components/AdminDashboard.jsx'
import LearnerHomework from './components/LearnerHomework.jsx'
import BasicsCourse from './components/BasicsCourse.jsx'
import SignIn from './components/SignIn.jsx'
import TrainerLearners from './components/TrainerLearners.jsx'
import TrainerMaterials from './components/TrainerMaterials.jsx'
import SupabaseStatus from './components/SupabaseStatus.jsx'
import SetupStatus from './components/SetupStatus.jsx'
import AppNav, { AppTopbar } from './components/AppNav.jsx'
import AppTabs from './components/AppTabs.jsx'
import AppHome, { HOME_ID } from './components/AppHome.jsx'
import {
  BoltIcon, BookIcon, CardsIcon, ChartIcon, CloseIcon, HomeIcon, MicIcon, MusicIcon,
  PeopleIcon, StepsIcon, TaskIcon,
} from './components/Icons.jsx'
import { THEMES, applyTheme, loadTheme } from './lib/theme.js'
import { PALETTES, applyPalette, loadPalette } from './lib/palette.js'
import { NAV_PUSH_AT, loadNavOpen, saveNavOpen, useWide } from './lib/nav.js'
import { setViewerRole } from './lib/viewer.js'
/* **教材へのリンク**(`?m=…`・2026-09 利用者の指定)。
   読み方も外し方も `materialLink.js` 1か所 */
import { materialIdFromUrl, urlWithoutMaterial } from './lib/materialLink.js'
import { installTapFeedback } from './lib/haptics.js'
import { playSfx, setSoundOn, soundOn } from './lib/sfx.js'
import { forgetJob, markJobSeen, useJob, watchJob } from './lib/generateJob.js'
import {
  forgetPrepare, prepareAllOn, setPrepareAllOn, usePrepare,
} from './lib/prepareJob.js'
import JobBar from './components/JobBar.jsx'
import Loading from './components/Loading.jsx'
import LearnerBar from './components/LearnerBar.jsx'
import { onClipTrouble, checkClipGateway } from './lib/audioClips.js'
import { viewerRoleOf } from './lib/viewer.js'
import Wordbook from './components/Wordbook.jsx'
import QrReview from './components/QrReview.jsx'
import PronunciationPractice from './components/PronunciationPractice.jsx'
import BgmLibrary from './components/BgmLibrary.jsx'
import { getSession, loadProfile, onAuthChange, signOut } from './lib/auth.js'
import { isSupabaseConfigured } from './lib/supabase.js'

export default function App() {
  /**
   * **リンクで指された教材**(`?m=…`・2026-09 利用者の指定)。
   *
   *   > 「教材をシェア」ボタンをつけてトレーナー間でシェアできるように
   *   > してください。これで教材へのリンクをシェアできるようにします。
   *
   * **読むのは、開いた瞬間の1回だけ。** `useState` の初期値として読み、
   * そのあと URL からは外す(`urlWithoutMaterial`)。残しておくと、
   * 別の教材を発行して一覧を読み直すたびに**リンクの教材へ引き戻される**
   * (`playMark.js` の「取り出したら消す」と同じ作法)。
   *
   * **`view` より前に置く。** 下の初めの値がこれを見る ——
   * リンクで来た人をホームに落とすと、渡した教材に着かない。
   */
  const [askOpenId] = useState(() => materialIdFromUrl(window.location.search))
  useEffect(() => {
    if (!askOpenId) return
    // 印だけを外す。**`?v=` などほかの印は残す**
    window.history.replaceState(null, '', urlWithoutMaterial(window.location))
  }, [askOpenId])

  /**
   * いま開いている画面。`HOME_ID` ホーム / 'materials' 教材 /
   * 'learners' ゲスト / 'admin' 集計 / 'homework' 今週の宿題 /
   * 'wordbook' 単語帳 / 'qr' Quick Response /
   * 'pronunciation' スピーチ練習(**id は変えない**・下記)。
   *
   * 【**ホームから始める**】(2026-09 利用者の指定)
   *
   *   > ロードの後いきなり教材が映るのではなく、何か箱を並べて、
   *   > 選択したモードに飛ぶ仕様にしたいです
   *
   *   **ただしリンクで来た人は別**(`?m=…`)。あれは
   *   「この教材を見てください」と名指しで渡されたものなので、
   *   ホームに落とすと**渡した教材に着かない。**
   *
   * 【`'learner'` から始めない】(2026-09・第3週に実測して気づいた)
   *
   *   ここは長く `'learner'`(学習の記録)から始まっていた。
   *   ところが**その画面は 0022 で外してある。** つまり
   *   **開いた瞬間の画面が、メニューのどれでもない**状態だった。
   *
   *   - 左のメニューで**どこにいるかの印が1つも点かない**
   *   - 上の帯の名前も出ない(`pageLabel` が控えの
   *     「English AI System」に落ちる)
   *   - 中身は最後の枝(集計)に落ち、その上にゲストを選ぶ欄だけが残る
   *
   *   パソコンでは名前が並んでいるので気づけなかったが、
   *   **パッドの細い柱は絵だけ**なので、印が無いと本当に分からない。
   *   下の `useEffect` が「メニューに無い画面なら、先頭へ移す」ようにしてある。
   */
  const [view, setView] = useState(askOpenId ? 'materials' : HOME_ID)
  /**
   * **「この教材の語だけ練習する」で渡ってきた語**(0047・2026-09)。
   *
   *   > とりあえずその単語とフレーズだけに取り組めるよう(任意)に
   *   > しないと、今のままでは何も気づかない
   *
   * 「今週の宿題」のカードから押すと、単語帳がその語だけになる。
   * **教材の id では絞れない** —— すでに単語帳にあった語は
   * 前の教材の名前を持ったままなので、**語そのもの**で渡す。
   */
  const [onlyWords, setOnlyWords] = useState(null)
  /* **「発行する画面へ」を押した合図**(2026-09 利用者の指定)。
     数を1つ増やすだけ。`TrainerMaterials` がこれを見て、
     作る画面(下書きが入った状態)を開く。
     真偽値にすると、2度目に押したときに変わらず効かない */
  const [askCreate, setAskCreate] = useState(0)
  /** どこにいても、ワンタッチで発行の画面へ */
  const goPublish = () => {
    setView('materials')
    setAskCreate((n) => n + 1)
    setJobNote(null)
  }

  // ログイン状態。Supabase 未設定のときは最初から「確認済み・未ログイン」にする
  // (その場合はログインを求めず、これまでどおり端末内のデータで動かす)。
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [authChecked, setAuthChecked] = useState(!isSupabaseConfigured)
  const [theme, setTheme] = useState(loadTheme)
  // メニューを押した回数。**同じ画面をもう一度押したことを伝えるためだけ**に使う。
  // **早く帰る条件より前に置く**(hook は必ず同じ順で呼ばれなければならない)
  const [navTick, setNavTick] = useState(0)
  const [palette, setPalette] = useState(loadPalette)
  /* 押したときの音。**覚える**(`src/lib/sfx.js`)。
     切れるようにしてあるのは、レッスン中に邪魔なことがあるため */
  const [sound, setSound] = useState(soundOn)
  /* 本文の読み上げを1本にまとめるか。**戻せる道を残す**(利用者の指定) */
  /**
   * 裏で作っている教材のお知らせ(2026-09 利用者の指定)。
   *
   *   > バックグラウンドでの作成が終わったら音やポップアップでの通知
   *
   * 教材の画面を離れても作りつづけるので(`src/lib/generateJob.js`)、
   * **どの画面にいても見える場所**で終わりを伝える。
   * **知らせるのは1回だけ**(`markJobSeen`)。何度も出しては邪魔になる。
   */
  const [jobNote, setJobNote] = useState(null)
  /* 進み具合の帯と、メニューの青い丸のもと(2026-09 利用者の指定)。
     **経過秒数もここで数える**(`useJob`)。走っていないあいだは数えない */
  const { job, secs: jobSecs } = useJob()
  /* 発行したあとの支度(音声と語の意味)。**教材を作る仕事とは別の枠** */
  const { prep, secs: prepSecs } = usePrepare()
  /* 過去の教材も裏で支度するか。**費用が出ていくので切れるようにする** */
  const [prepAll, setPrepAll] = useState(prepareAllOn)
  useEffect(() => watchJob((j) => {
    if (!j || j.seen) return
    if (j.state === 'done') {
      playSfx('done')
      setJobNote({ state: 'done', text: `${j.title}の下書きができました。` })
      markJobSeen()
    }
    if (j.state === 'error') {
      setJobNote({ state: 'error', text: `${j.title}を作れませんでした。${j.error ?? ''}` })
      markJobSeen()
    }
  }), [])

  // 左のメニュー。広い画面(1024px 以上)では画面を押し出して並び、
  // 狭い画面ではふだん隠れていて ☰ でかぶせて開く。
  // **たたんだかどうかは覚える**(毎回たたみ直すのでは意味がない)。
  const wide = useWide()
  /* **パッドの縦向き(768〜1023px)には、絵だけの細い柱を出す**(2026-09・第3週)。
     実測すると 1024px 未満はすべて「スマホと同じ」扱いで、
     **メニューが丸ごと隠れていた。** 768px でも残り 700px あるので、
     68px の柱を置く幅は十分にある。
     **`wide`(1024)はそのまま。** あちらは語のタップなど**メニュー以外**も
     見ている値なので、動かすと関係のないところが変わる */
  const navPush = useWide(NAV_PUSH_AT)
  const [navOpen, setNavOpen] = useState(loadNavOpen)
  // 狭い画面へ移ったときは、開いたままにしない。
  // かぶせる形なので、開いたままだと中身が読めない
  useEffect(() => { if (!wide) setNavOpen(false) }, [wide])
  // 試作版の断り書き。一度閉じたら覚えておく
  /**
   * **読み上げ音声を作れなかった理由**(2026-09 実機)。
   *
   *   `speak` を配置していなかったあいだ、画面は**黙って端末の声に落ちて**
   *   いた。理由は集めていたのに、どこからも読んでいなかったので、
   *   「良い声にならない」ことに何日も気づけなかった。
   *
   * **出すのはトレーナーと管理者だけ。** ゲストには出さない
   * (仕組みの内側の話で、ゲストにできることは何も無い・CLAUDE.md)。
   * **役割が分からないうちも出さない**(既定は「見せない」)。
   */
  const [clipNote, setClipNote] = useState(null)
  useEffect(() => onClipTrouble((detail) => {
    const role = viewerRoleOf()
    if (role !== 'trainer' && role !== 'owner') return
    /* **`null` は「直った」という知らせである**(2026-09 実機・利用者の指摘)。
       以前はここで捨てていたので、一度出た知らせが
       **音声が作れるようになっても居座っていた。**
       「音声がちゃんと作られているのにいまだにこの表示が消えない」 */
    setClipNote(detail ? String(detail) : null)
  }), [])
  /* 試作版の断り書きの開け閉め(`noticeOpen`)は**外した**(2026-09)。
     断り書きそのものを消したので、覚えておくものが無い。
     `loadNoticeOpen` / `saveNoticeOpen`(`nav.js`)は残してあるが、
     どこからも呼んでいない —— 断り書きを戻す日には、そのまま使える */
  const toggleNav = () => setNavOpen((v) => {
    const next = !v
    if (wide) saveNavOpen(next)   // 覚えるのは PC のときだけ
    return next
  })

  // 選んだ配色を画面に反映する。最初の1回も含めてここで行う
  // 触る端末で、押したときに短い手応えを返す(2026-08 の要望)。
  // **アプリで1か所だけ。** 画面ごとに書くと、新しいボタンで必ず抜ける
  useEffect(() => installTapFeedback(), [])

  useEffect(() => { applyTheme(theme) }, [theme])
  useEffect(() => { applyPalette(palette) }, [palette])
  // 仕組みの内側の事情(鍵・残高)を出してよい相手かどうかの判断に使う。
  // **ゲストには内側の話を見せない**(2026-08 利用者の指定)
  useEffect(() => { setViewerRole(profile?.role ?? null) }, [profile])

  /**
   * **読み上げの窓口が古くないかを、こちらから訊きに行く**(2026-09 実機)。
   *
   *   > トレーナーの画面に赤い知らせが出なくなってます
   *
   * 版の見比べは、これまで**音声を作ったときにしか起きていなかった。**
   * すでに MP3 のある教材を聴くだけでは窓口が呼ばれないので、
   * 古いままでも何も出ない。だから開いたときに1度だけ訊く。
   *
   * **音声は作らないので1円もかからない。**
   * **トレーナー・管理者のときだけ**(知らせを出す相手が他にいない)。
   */
  useEffect(() => {
    const role = profile?.role
    if (role !== 'trainer' && role !== 'owner') return
    checkClipGateway()
  }, [profile])

  // 起動時に一度、以降はログイン状態が変わるたびに追いかける
  useEffect(() => {
    if (!isSupabaseConfigured) return
    let alive = true
    getSession().then((s) => {
      if (!alive) return
      setSession(s)
      setAuthChecked(true)
    })
    return onAuthChange((s) => {
      if (!alive) return
      setSession(s)
      setAuthChecked(true)
    })
  }, [])

  /* ── **ログインした人が変わったら、前の人のものを忘れる**(2026-09 実機)
   *
   *     > 両方(= ゲストには出さない + ログインし直したら消す)
   *
   *   教材の生成も音声の支度も、状態は**書類(モジュール)に1つだけ**
   *   置いてある。**画面を読み込み直すまで消えない**ので、トレーナーで
   *   教材を作ったあと、そのままゲストで入り直すと
   *   **前の人の教材の名前が帯に残っていた。**
   *
   *   ・**見るのは「人が変わったか」だけ。** 同じ人のまま画面を移っても
   *     呼ばれない(そこで消したら「画面を移っても作りつづける」が壊れる)
   *   ・**初めの1回では呼ばない。** ログインした瞬間に消すと、
   *     読み込み直した直後に走っている仕事まで消えることになる
   *   ・ログアウト(`null`)も「変わった」に数える ——
   *     次に別の人が入ってくるかもしれない
   *   ・お知らせ(`jobNote`)も一緒に消す。**帯だけ消しても、
   *     すぐ下の「◯◯の下書きができました」が残る** */
  const lastUser = useRef(undefined)
  useEffect(() => {
    const id = session?.user?.id ?? null
    if (lastUser.current === undefined) { lastUser.current = id; return }
    if (lastUser.current === id) return
    lastUser.current = id
    forgetJob()
    forgetPrepare()
    setJobNote(null)
  }, [session])

  /* ログインしている人の表示名と役割を読む。
     **読み終えたかどうかも控える**(`profileRead`・下の `booting`)。
     **中身が空でも「読み終えた」ことにする** —— プロフィールが引けない
     ときに立てないでいると、**起動画面から二度と出られなくなる**
     (行き止まりを作らない)。 */
  const [profileRead, setProfileRead] = useState(false)
  useEffect(() => {
    if (!session?.user?.id) { setProfile(null); setProfileRead(false); return }
    let alive = true
    const done = (p) => { if (!alive) return; setProfile(p); setProfileRead(true) }
    loadProfile(session.user.id).then(done, () => done(null))
    return () => { alive = false }
  }, [session])

  /**
   * **役割が分かるまでは、まだ起動の途中である**(2026-09 実機・利用者の指摘)。
   *
   *   > 今は田中みなみの画面が一瞬映ったりして微妙だ
   *
   * 下の `pages` は**役割で中身が変わる。** プロフィールを読み終えるまで
   * `isTrainer` は偽なので、そのあいだの `pages` は**ゲストの一覧**
   * (今週の宿題 / 30日講座 / 単語帳 …)になる。すると
   * 「メニューに無い画面なら先頭へ移す」見張りが働いて、
   * **トレーナーで入っても、いったんゲストの画面が出ていた。**
   * そのあとプロフィールが届いて「教材」へ跳ぶ ——
   * これが**一瞬だけ別の画面が映る**正体である。
   *
   * レッスンは**ゲストと画面を共有しながら**行うので、
   * 見せる気のない画面が一瞬でも出るのは見た目の問題では済まない。
   * **役割が分かるまでは、起動画面のまま待つ。**
   */
  const booting = isSupabaseConfigured && !!session && !profileRead

  /* アイコンを選ぶ欄は外した(2026-09 利用者の指定「アイコンはいらない」)。
     **入れ物(`profiles.avatar`・0029)と保存の窓口(`saveMyAvatar`)は
     そのまま残してある。** また要るときは、ここに欄を戻すだけでよい。 */

  // owner はトレーナーの権限も兼ねる(データベース側の is_trainer() と同じ考え方)
  const isTrainer = profile?.role === 'trainer' || profile?.role === 'owner'
  const isOwner = profile?.role === 'owner'
  const isLearner = profile?.role === 'learner'

  // ゲストがトレーナー用の画面を開いていたら戻す。
  // 見えるデータはどのみち RLS が止めるが、画面としても出さない。
  useEffect(() => {
    if (!isSupabaseConfigured || !profile) return
    if (isLearner && ['materials', 'learners', 'admin'].includes(view)) setView('homework')
  }, [profile, isLearner, view])

  /* ログインした直後に開く画面。
     **ホームから始める**(2026-09 利用者の指定)。
       > ロードの後いきなり教材が映るのではなく、何か箱を並べて、
       > 選択したモードに飛ぶ仕様にしたいです

     **リンクで来た人だけは、その教材へ**(`?m=…`)。名指しで渡された
     ものなので、ホームに落とすと**渡した教材に着かない。**
     ゲストに「教材」の画面は無いので、そこはホームのままにする
     (どのみち下の見張りが追い出す)。 */
  const [landed, setLanded] = useState(false)
  useEffect(() => {
    if (!isSupabaseConfigured || !profile || landed) return
    setView(isTrainer && askOpenId ? 'materials' : HOME_ID)
    setLanded(true)
  }, [profile, isTrainer, landed, askOpenId])

  /* 試作版のサンプルデータ(`store.js` / `seed.js`)は**道具ごと消した**
     (2026-09 実機・利用者の指摘)。

       > ゲストのIDとパスワードでログインすると危険そうなものがあるぞ。
       > 1番下の、「サンプルデータに戻す」というやつです

     **`state` は、どの画面からも読まれていなかった。** 読み込んで、
     保存して、消すだけの入れ物が残っていただけである
     (`learners` / `studyLogs` / `pronunciationAttempts` の3つで、
     どれも Supabase と `word_reviews` に移ったあとのもの)。

     それでも**押させてはいけなかった。** 出ていた確認の文が
     「保存されているデータをすべて消して、サンプルデータに戻します」で、
     **これは嘘である** —— 単語帳も宿題も Supabase にあるので消えない。
     読んだゲストは**自分の記録が消えると思う。**
     **古い注意書きは、消し忘れると嘘になる**(CLAUDE.md)。

     **値を偽にするだけにしない。** 残すと、次に見た人が
     「まだ使うのかもしれない」と読む(`withSkip` を消したときと同じ)。 */

  // 画面の一覧。**メニューも、帯に出す名前も、これ1つを見る。**
  // 2か所に書くと、並びと呼び名が必ず食い違う。
  //
  // 並びは役割の順。トレーナーには「教材 → ゲスト → 集計」が仕事の順で、
  // 「今週の宿題 / 学習の記録」は自分自身の学習の画面である。
  //
  // **`desc`(1行の説明)も、ここが持つ**(2026-09 利用者の指定)。
  // ホームの箱がそれを出す。**呼び名と説明を2か所に分けない** ——
  // 分けると、名前を変えたときに説明だけが古いまま残る。
  const pages = [
    /* **ホーム**(2026-09 利用者の指定)。
         > ロードの後いきなり教材が映るのではなく、何か箱を並べて、
         > 選択したモードに飛ぶ仕様にしたいです
       **いちばん上に置く。** 「メニューに無い画面なら先頭へ移す」の
       行き先(`ids[0]`)にもなるので、どの役割でも必ず在る場所である。
       **下の帯(`TAB_IDS`)には足さない** —— あちらは利用者が4つと
       決めている。ホームへは ☰ から戻る(「ゲスト」「集計」と同じ扱い) */
    { id: HOME_ID, label: 'ホーム', icon: HomeIcon },
    (!isSupabaseConfigured || isTrainer) && {
      id: 'materials', label: '教材', icon: BookIcon,
      desc: 'さがす・作る・ゲストに共有する',
    },
    (!isSupabaseConfigured || isTrainer) && {
      id: 'learners', label: 'ゲスト', icon: PeopleIcon,
      desc: '担当ゲストの宿題と取り組み',
    },
    // **集計は管理者だけ**(2026-08 の設計変更)。トレーナーが見るのは
    // 「ゲスト」画面に出る取り組みのほうで、スクール全体の数字ではない
    (!isSupabaseConfigured || isOwner) && {
      id: 'admin', label: '集計', icon: ChartIcon,
      desc: 'スクール全体の教材とゲストの数',
    },
    (!isSupabaseConfigured || !isTrainer) && {
      id: 'homework', label: '今週の宿題', icon: TaskIcon,
      desc: 'トレーナーから届いた教材',
    },
    /* **文法30日集中講座 + 基礎単語**(0052・2026-09 利用者の指定)。
       > pre basic と basic に基礎単語習得モードとか文法30日集中講座などが欲しい
       **ゲスト専用**(利用者が選んだ)。トレーナーには出さない。
       **下の帯(`TAB_IDS`)には足さない** —— あちらは利用者が4つと決めている */
    (!isSupabaseConfigured || !isTrainer) && {
      id: 'course', label: '30日講座', icon: StepsIcon,
      desc: '文法30日と、基礎の単語',
    },
    // 単語帳は**トレーナーも使う。** トレーナーも日々英語を学んでいる
    // (2026-08 利用者の指定)。記録はログインしている人ごとに分かれる
    {
      id: 'wordbook', label: '単語帳', icon: CardsIcon,
      desc: '覚えた語を、間をあけてくり返す',
    },
    /* **Quick Response の復習**(0040・2026-09 利用者の指定)。
       教材の中で「まだ」を押した文が、**1つのアカウントに1つ**溜まる。
       単語帳のとなりに置く — あちらは**語**、こちらは**文**で、
       やることは同じ(思い出して、口から出す)である。
       トレーナーも使う(単語帳と同じ理由。トレーナーも日々英語を学んでいる) */
    {
      id: 'qr', label: 'Quick Response', icon: BoltIcon,
      desc: '日本語を見て、英語で言う',
    },
    /* **発音練習だけは独立した機能にする**(2026-08 利用者の指定)。
       **名前は「スピーチ練習」**(2026-09 利用者の指定)。
       > 「発音を練習」を「スピーチ練習」にしてください
       **id(`pronunciation`)は変えない** —— 覚えている画面
       (`eas.*`)も、取り組みの記録(`practice_days.kind`)も
       この id で残っている。**呼び名だけを変える** */
    {
      id: 'pronunciation', label: 'スピーチ練習', icon: MicIcon,
      desc: '声に出して、話す練習をする',
    },
    /* **音楽**(0049・2026-09 利用者の指定「自作の音楽が流れるように」)。
       曲を入れるのも消すのも**トレーナーと管理者だけ**なので、
       ゲストには出さない —— ゲストは**聞き流しのときに聴くだけ**である
       (**効かない操作を見せない**)。
       **下の帯(`TAB_IDS`)には足さない。** あちらは利用者が4つと決めている */
    (!isSupabaseConfigured || isTrainer) && {
      id: 'bgm', label: '音楽', icon: MusicIcon,
      desc: '聞き流しのときに流す曲',
    },
    // 「学習の記録」は外した(2026-08 の設計変更)。
    // **やったことは、こちらが裏で数える**(0022・`src/lib/practice.js`)。
    // ゲストに何分やったかを入力させない。入力そのものが手間で、
    // しかも入れ忘れる。数えたものはトレーナーの「ゲスト」画面に出る
  ].filter(Boolean)

  /**
   * **画面の下の帯**(2026-09 利用者の指定)。
   *
   *   > ゲストとしてログインするとメニューにたどり着く方法が
   *   > 1番上までスクロールしてハンバーガーを押すしかないのが
   *   > かなり不便かつ分かりにくいです
   *
   * 上の帯は貼り付いているので ☰ は送っても消えない(実測)。
   * 直したのは**入口が1つしか無く、しかも隠れていること**のほうである。
   *
   * - **狭い画面だけ**(768px 未満 = メニューがかぶせて開く幅)。
   *   それ以上では柱が出ているので、**同じことをするものが2つ**になる
   *
   * 【トレーナーにも出す。**ただし4つだけ**】(2026-09 利用者の指定)
   *
   *   > トレーナーのアカウントでも、ゲストと同じようにスマホやパッドで
   *   > 見る時には下段のメニューを表示するようにしてください。
   *   > 教材、単語帳、Quick Response、スピーチ この四つにしてください。
   *
   *   もとは**ゲストだけ**だった。理由は「トレーナーは行き先が6つあり、
   *   1行に収まらない」である。**それは行き先を全部出す前提の話**で、
   *   利用者は**4つに絞る**という別の答えを選んだ。
   *
   *   だから **`pages` をそのまま渡すのはやめた**(前はそうしていた)。
   *   出すのは `TAB_IDS` の4つだけで、**並びもここが決める。**
   *   ゲストとトレーナーで違うのは**先頭の1つ**だけ
   *   (今週の宿題 / 教材)。残りの3つはまったく同じである。
   *
   *   **「ゲスト」と「集計」は下の帯に出さない。** よく行く4つを
   *   親指の届くところに置くのがこの帯の役目で、
   *   **全部の行き先を並べる場所ではない**(☰ にはこれまでどおり全部ある)。
   *   そのぶん、その2つを開いているあいだは**どの札にも印が付かない。**
   *   いま何の画面かは、上の帯の名前が言う
   */
  const TAB_IDS = isTrainer
    ? ['materials', 'wordbook', 'qr', 'pronunciation']
    : ['homework', 'wordbook', 'qr', 'pronunciation']
  /* **`pages` から引く。** 名前も絵も一覧はあちら1つで、
     ここは「どれを、どの順で出すか」だけを持つ。
     役割で無い画面(ゲストの「教材」)は、引けないので落ちる */
  const tabs = TAB_IDS.map((id) => pages.find((p) => p.id === id)).filter(Boolean)
  const showTabs = !navPush && tabs.length > 0

  /**
   * **メニューに無い画面を開いたままにしない**(2026-09・第3週)。
   *
   * 並ぶ項目は役割で変わる(ゲストに「教材」は無い)。役割が分かるのは
   * ログインしたあとなので、**開いたときの画面がそのままでは合わないことがある。**
   * そのときは**先頭の画面へ移す。**
   *
   * ここが無いと、左のメニューの印も上の帯の名前も出ないまま、
   * 中身だけが最後の枝に落ちる —— それが 0022 から続いていた状態である。
   *
   * **見張るのは id の並びだけ。** `pages` は描くたびに新しい配列になるので、
   * そのまま渡すと**毎回動いてしまう**(「見張りに、自分が書き換えるものを
   * 入れない」と同じ落とし穴)。
   *
   * **早く帰る条件より前に置く**(hook は必ず同じ順で呼ばれなければならない)。
   * 後ろに置いて、実際に画面が真っ白になった。
   */
  const pageIds = pages.map((p) => p.id).join(',')
  useEffect(() => {
    /* **役割が分かるまでは動かさない。** そのあいだの `pages` は
       ゲストの一覧なので、ここが「教材」を追い出してしまう(上記) */
    if (booting) return
    const ids = pageIds ? pageIds.split(',') : []
    if (!ids.length || ids.includes(view)) return
    setView(ids[0])
  }, [booting, pageIds, view])

  /* **起動画面は1つ**(`Loading.jsx`・`index.html` と同じ形)。
     `booting` のあいだも出す —— 役割が分かる前に中身を描くと、
     **一瞬だけゲストの画面が映る**(上記) */
  if (!authChecked || booting) {
    return <Loading full />
  }

  // Supabase が設定されているならログインを必須にする。
  // 未設定のときは従来どおり、ログインなしで動く。
  if (isSupabaseConfigured && !session) {
    return <SignIn />
  }


  /* 教材の画面に付ける印(2026-09 利用者の指定)。
     **できあがったことを、音だけで伝えない。**
     音は切れるし、レッスン中や席を外しているときは聞こえない。

     ・作っている最中 … `running`(ゆっくり息をする)
     ・下書きができた … `done`(点きっぱなし)

     **受け取るまで消えない。** `takeJobResult()` が仕事を片づけた時点で
     消えるので、「見たのに何も無い」が起こらない。
     `markJobSeen()`(お知らせを出した印)とは別物である。 */
  const jobBadge = job?.state === 'running' ? 'running'
    : (job?.state === 'done' ? 'done' : null)
  const navItems = jobBadge
    ? pages.map((p) => (p.id === 'materials'
      ? { ...p,
        badge: jobBadge,
        badgeTitle: `${p.label} — ${job.title}${jobBadge === 'done' ? 'の下書きができました' : 'を作っています'}` }
      : p))
    : pages
  /* いま見ている画面。**名前も絵も、ここから引く**(2026-09 利用者の指定
     「今いるページを示す項目の横にサイドバーと同じアイコンを」)。
     `pages` はメニューが見ているのと同じ一覧なので、**画面を足しても
     帯とメニューで食い違わない**(呼び名を2か所に持たない) */
  const nowPage = pages.find((p) => p.id === view) ?? null
  const pageLabel = nowPage?.label ?? 'English AI System'


  /* 左のメニューの下に置くもの。
     **配色も色づかいも、一度決めたら何度も触るものではない。**
     上に出しっぱなしにすると、スマホでは題名と同じ幅を食う
     (レッスン表示の操作欄で一度学んだこと・第5.25節)。 */
  const navFooter = (
    <>
      <div className="nav-setting">
        <span className="nav-setting-label">配色</span>
        <div className="theme-switch" role="group" aria-label="配色">
          {THEMES.map((t) => (
            <button key={t.id} type="button" title={t.hint}
                    className={`theme-btn${theme === t.id ? ' is-active' : ''}`}
                    onClick={() => setTheme(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="nav-setting">
        <span className="nav-setting-label">色づかい</span>
        <div className="theme-switch" role="group" aria-label="色づかい">
          {PALETTES.map((x) => (
            <button key={x.id} type="button" title={x.hint}
                    className={`theme-btn${palette === x.id ? ' is-active' : ''}`}
                    onClick={() => setPalette(x.id)}>
              {x.label}
            </button>
          ))}
        </div>
      </div>

      {/* 押した手応え(音とふるえ)。**一度決める設定なので、ここに置く。**
          レッスン中に鳴ると邪魔なことがあるので、切れるようにしてある
          (2026-09 に「鳴らさない」から改めた・利用者の指定) */}
      <div className="nav-setting">
        <span className="nav-setting-label">押したときの音</span>
        <div className="theme-switch" role="group" aria-label="押したときの音">
          {[{ id: true, label: '鳴らす' }, { id: false, label: '鳴らさない' }].map((x) => (
            <button key={String(x.id)} type="button"
                    className={`theme-btn${sound === x.id ? ' is-active' : ''}`}
                    onClick={() => { setSound(x.id); setSoundOn(x.id) }}>
              {x.label}
            </button>
          ))}
        </div>
      </div>

      {/* **過去の教材も、裏で順に支度するか**(2026-09 利用者の指定)。

            > 過去に作成したものも常にバックグラウンドで再生準備を
            > 進められないでしょうか？

          教材の画面を開いているあいだ、まだ音声の無い教材を1本ずつ
          用意していく。**費用が出ていく**ので、切れるようにしてある
          (「見えない費用は管理できない」・CLAUDE.md)。
          いま何本待っているかは、上の帯がいつも出している。 */}
      {(profile?.role === 'trainer' || profile?.role === 'owner') && (
        <div className="nav-setting">
          <span className="nav-setting-label">教材の支度</span>
          <div className="theme-switch" role="group" aria-label="教材の支度">
            {[
              { id: true, label: '自動', hint: '過去の教材も、裏で順に用意しておく' },
              { id: false, label: '使うときだけ', hint: '発行と「セッションで使う」のときだけ' },
            ].map((x) => (
              <button key={String(x.id)} type="button" title={x.hint}
                      className={`theme-btn${prepAll === x.id ? ' is-active' : ''}`}
                      onClick={() => { setPrepAll(x.id); setPrepareAllOn(x.id) }}>
                {x.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {session && (
        <div className="nav-account">
          {/* **アイコンは出さない**(2026-09 利用者の指定)。
                > アイコンはいらないって言ったのになぜ消してくれないのですか?
              ゲストの一覧から消したあと、ここ(自分の欄)に残っていた。
              **「アイコンはいらない」は、画面ぜんぶの話である。**
              0029 の列(`profiles.avatar`)はそのままにしてあるので、
              また要るときは戻せる(すでに選んだ人の印も消えない)。 */}
          <div className="nav-account-text">
            <span className="nav-account-name">
              {profile?.display_name || session.user.email}
            </span>
            <div className="nav-account-row">
              <span className={`badge ${isTrainer ? 'badge--admin' : 'badge--learner'}`}>
                {profile
                  ? (isOwner ? '管理者' : isTrainer ? 'トレーナー' : 'ゲスト')
                  : '役割を確認中'}
              </span>
              <button type="button" className="btn btn--link" onClick={signOut}>
                ログアウト
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )

  return (
    <div className={`app-shell${navPush ? ' is-wide' : ' is-narrow'}`
                    + (navOpen ? ' nav-open' : ' nav-closed')
                    /* 下の帯のぶん、本文の下に余白を足すための印。
                       足さないと、いちばん下の行が帯に隠れて読めない */
                    + (showTabs ? ' has-tabs' : '')}>
      <AppNav
        items={navItems} value={view}
        /* **いまいる画面をもう一度押したら、その画面の先頭に戻す**
           (2026-08 利用者の指定)。
             > 一人のゲストの情報内でサイドバーの「ゲスト」をクリック、
             > またはタップしたらゲスト選択画面に戻れるようにしてください
           `view` は変わらないので、押されたことを数で伝える。
           受け取った画面が、自分の中の「開いているもの」を閉じる。

           **数えるのは「同じ画面をもう一度押したとき」だけ**(2026-09 実機)。
           以前はどの項目を押しても数えていたので、ゲストを開いたまま
           「教材」を見に行って戻るだけで**一覧に飛ばされていた。**
             > 何か一つ間違えるとすぐにゲスト一覧に飛んでしまい
             > ゲストと画面共有中に非常にやりにくい
           上の指定は「**その画面にいるときに**もう一度押したら」なので、
           ここを狭めても指定は1文字も崩れない */
        onChange={(id) => { if (id === view) setNavTick((n) => n + 1); setView(id) }}
        open={navOpen} wide={navPush} compact={!wide}
        onClose={() => setNavOpen(false)}
        title="English AI System"
        footer={navFooter}
      />

      <div className="app-body">
        {/* ── 貼り付くのは、この箱1つ ──────────────────────────
            2026-09 実機・利用者の指摘。

              > 上部バーは消えていなかったのですが、このバックグラウンド
              > ロード中の表示のバーがスクロールするとかぶってしまっている
              > のが原因でした。

            **帯2つが、どちらも `top: 0` で貼り付いていた。** 送る前は
            縦に並ぶので気づけないが、送ると支度の帯が上の帯を覆い、
            **☰ が押せなくなる。** まとめて1つの箱で貼り付ければ、
            **帯の高さを測って `top` に書く必要がない**(`styles.css`)。 */}
        <div className="app-stick">
        {/* どこにいても ☰ が同じ場所にある。名前も出すので、
            スマホでメニューが隠れていても「いまどこか」が分かる */}
        <AppTopbar
          onToggle={toggleNav} open={navOpen} wide={navPush} pageLabel={pageLabel}
          icon={nowPage?.icon ?? null}
          /* **いま見ている画面の印だけ**を出す。
             「単語帳」の横に青い丸が出ても、何の印か分からない */
          badge={view === 'materials' ? jobBadge : null}
        />

        {/* ── ゲスト名の箱(2026-09 利用者の指定)──────────────
              > ゲストを一人選んでそのページの中にいるときは、
              > 常に画面上部にゲスト名ボックスが固定されているように

            **ゲストの画面にいるときだけ**出す。開いたまま「教材」へ
            移っても控えは残るが、そこは**そのゲストのページではない。**

            **貼り付く役は `.app-stick` 1つ**が持っているので、
            この中に入れておけば `top` に帯の高さを書かずに済む
            (`.jobbar` で踏んだのと同じ落とし穴を避ける)。 */}
        {view === 'learners' && <LearnerBar />}

        {/* ── 進み具合の帯 ────────────────────────────────────
            2026-09 利用者の指定。

              > 作成中の進行度合いを示すバーを作成して、
              > どのページにいても見えるように

            **帯の下・お知らせの上に置く。** 教材の画面を離れても
            作りつづけるので、移った先にも手がかりが要る。 */}
        <JobBar
          job={job} secs={jobSecs}
          prep={prep} prepSecs={prepSecs}
          showOpen={view !== 'materials'}
          onOpen={() => setView('materials')}
          /* できあがったら、**どこからでもワンタッチで発行の画面へ。**
             教材の画面にいても出す — あそこは「さがす」画面なので、
             下書きは**まだ目の前に無い**(2026-09 利用者の指定) */
          onPublish={goPublish}
        />
        </div>

        {/* ── 裏で作っている教材のお知らせ ────────────────────
            2026-09 利用者の指定。

              > バックグラウンドでの作成が終わったら音やポップアップでの
              > 通知してください。

            **どの画面にいても見える場所に置く。** 教材の画面を離れても
            作りつづけるので、終わったことを伝える場所が要る。
            音は `sfx.js` の「できました」。 */}
        {jobNote && (
          <div className={`jobnote${jobNote.state === 'error' ? ' is-error' : ''}`}
               role="status" aria-live="polite">
            <span className="jobnote-text">{jobNote.text}</span>
            {/* **お知らせからも、同じ場所へ行けるようにする。**
                「教材の画面を開く」では、さがす画面に着くだけだった
                (そこから「教材を作る」をもう一度押す必要があった) */}
            {jobNote.state === 'done' && (
              <button type="button" className="btn btn--small btn--primary"
                      onClick={goPublish}>
                発行する画面へ
              </button>
            )}
            <button type="button" className="nav-icon-btn"
                    onClick={() => setJobNote(null)} aria-label="お知らせを閉じる">
              <CloseIcon />
            </button>
          </div>
        )}

        {/* ── 読み上げ音声を作れなかった知らせ(トレーナー・管理者だけ)──
            **成功と失敗が、同じ見た目で終わってはいけない**(CLAUDE.md)。
            音そのものは端末の声で鳴っているので、**邪魔をしない静かな出し方**
            にする。閉じれば消える(直すまで毎回出したいので、覚えない)。 */}
        {clipNote && (
          <div className="jobnote is-quiet" role="status" aria-live="polite">
            {/* **文言はここに決め打ちしない**(2026-09 実機)。
                「作れませんでした」と固定していたので、**版が古いことを
                伝えるだけの知らせ**にもその文が付き、作りに行ってすら
                いないのに「作れませんでした」と出ていた。
                起きたことは `audioClips.js` の側が書く */}
            <span className="jobnote-text">{clipNote}</span>
            <button type="button" className="nav-icon-btn"
                    onClick={() => setClipNote(null)} aria-label="お知らせを閉じる">
              <CloseIcon />
            </button>
          </div>
        )}

        <div className="app">
          {/* 本文の上に置くのは、**その画面で使うものだけ。**
              「サンプルデータに戻す」はどの画面にも要らないので下へ移した
              (試作版の後始末であって、日々の操作ではない) */}
          {/* ここには「ゲスト」を選ぶ欄があった。**外した**(2026-09・第3週)。
              `view === 'learner'`(学習の記録)のときだけ出す作りだったが、
              **その画面は 0022 で無くなっている。** 選んだ値(`learnerId`)も
              どこからも読まれていなかった —— つまり**押しても何も起きない欄**が、
              開いた瞬間の画面に1つ置かれていた。 */}

          {/* **つながっていないときだけ**出る(2026-09 利用者の指定)。
              緑の「接続できています」は消した —— 接続はもう当たり前で、
              毎回いちばん上に出るだけの、読まれない箱になっていた。
              **失敗は黙って消さない**ので、届かないときは出る
              (トレーナーと管理者だけ。ゲストには内側の話を見せない) */}
          <SupabaseStatus />

          {/* **まだ済んでいない準備だけ**を出す(2026-09 実機・利用者の問い)。

                > これをやったかどうか覚えていません。この現象がなん度も
                > 起きています。あなたで把握できる方法はないのですか？

              こちらからは Supabase に届かないので確かめられないが、
              **アプリからは 0 円で確かめられる**(表の印を読むだけ・
              窓口には読めない中身を送って断らせるだけ)。
              **済んでいれば1ドットも出ない。** ゲストにも出さない */}
          <SetupStatus role={profile?.role ?? null} />

          {/* 試作版の断り書きは**外した**(2026-09 利用者の指定)。

                > 上部のsupabaseと試作版うんぬん、、をたたむ。というくだりを
                > 消せませんか

              しかも中身が**もう本当ではなかった** ——「画面に出ている
              データはまだこのブラウザの中のもの」と書いてあったが、
              いまは教材も単語帳も Supabase にある。
              **古い注意書きは、消し忘れると嘘になる**(CLAUDE.md)。

              発音の断り(点数は付かない)は**消えていない** ——
              `PronunciationPractice` の中に、その場で書いてある。
              版(`VITE_BUILD_STAMP`)も下のフッターに残っている */}

          <main className="app-main">
            {/* **ホーム — 行き先を箱で並べる**(2026-09 利用者の指定)。
                並べるのは `pages` そのままなので、**画面を足せば
                ここにも自動で並ぶ**(行き先の一覧を2つ持たない)。
                役割で並ぶものが変わるのも、そのまま効く */}
            {view === HOME_ID ? (
              <AppHome pages={pages} onPick={setView} />
            ) : view === 'materials' ? (
              profile ? <TrainerMaterials me={profile} askCreate={askCreate}
                                          askOpenId={askOpenId} />
                : <Loading />
            ) : view === 'learners' ? (
              profile ? <TrainerLearners me={profile} navTick={navTick} />
                : <Loading />
            ) : view === 'homework' ? (
              <LearnerHomework
                me={profile}
                onPracticeWords={(words, label) => {
                  setOnlyWords({ words, label, what: 'この教材の語' })
                  setView('wordbook')
                }}
              />
            ) : view === 'course' ? (
              <BasicsCourse me={profile} />
            ) : view === 'wordbook' ? (
              <Wordbook only={onlyWords?.words ?? null}
                        onlyLabel={onlyWords?.label ?? ''}
                        onlyWhat={onlyWords?.what ?? 'この教材の語'}
                        onClearOnly={() => setOnlyWords(null)}
                        /* **基礎単語の段だけを練習する**(0053・2026-09)。
                           絞り込みは**この1か所だけ**が持つ ——
                           「今週の宿題」から来る道とまったく同じ入れ物に置く。
                           画面ごとに別の絞り込みを持たない(CLAUDE.md) */
                        /* **何で絞っているのかは、呼ぶ側が言う**(CLAUDE.md)。
                           基礎単語は「この段の語」、スピーチは
                           「このスピーチの語句」。**入れ物は1つのまま** */
                        onPickWords={(words, label, what = 'この段の語') => {
                          setOnlyWords({ words, label, what })
                        }} />
            ) : view === 'qr' ? (
              <QrReview />
            ) : view === 'pronunciation' ? (
              <PronunciationPractice me={profile} />
            ) : view === 'bgm' ? (
              <BgmLibrary userId={profile?.id ?? null} />
            ) : (
              <AdminDashboard />
            )}
          </main>

          <footer className="app-footer">
            <p>
              English AI System — 試作版 v0.1.0
              {/* 公開時に版が埋め込まれる。手元で動かしているときは出ない。
                  「見ているのが新しい版かどうか」をこれで確かめる。 */}
              {import.meta.env.VITE_BUILD_STAMP && (
                <> ／ 版: <code>{import.meta.env.VITE_BUILD_STAMP}</code></>
              )}
            </p>
            {/* 「サンプルデータに戻す」は**外した**(2026-09 利用者の指摘)。
                ゲストの画面にも出ており、しかも確認の文が嘘だった。
                **版はここに残す** —— どの版を見ているかを確かめる
                唯一の手がかりである */}
          </footer>
        </div>

        {/* ── 画面の下に貼り付く行き先(ゲスト・狭い画面だけ)────────
            2026-09 利用者の指定。**メニューの代わりではなく、近道である。**
            ☰ はこれまでどおり上の帯にあり、配色・音などの設定は
            そちらの中に残っている(同じものを2か所に置かない)。

            **`.app` の外に置く。** 中に入れると本文と一緒に送られて
            消えてしまう —— それでは「送っても消えない」という
            この帯の役目そのものが無くなる(右下の操作盤と同じ考え方)。

            **押したときは `setView` だけ。** 上のメニューが持っている
            「同じ画面をもう一度押したら先頭へ戻す」(`navTick`)は
            ここでは数えない —— あれは**ゲストの一覧に戻す**ための印で、
            ゲストの画面には戻る先の一覧が無い */}
        {showTabs && (
          <AppTabs pages={tabs} view={view} onChange={setView} />
        )}
      </div>
    </div>
  )
}
