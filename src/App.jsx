import { useEffect, useState } from 'react'
import AdminDashboard from './components/AdminDashboard.jsx'
import LearnerHomework from './components/LearnerHomework.jsx'
import SignIn from './components/SignIn.jsx'
import TrainerLearners from './components/TrainerLearners.jsx'
import TrainerMaterials from './components/TrainerMaterials.jsx'
import SupabaseStatus from './components/SupabaseStatus.jsx'
import AppNav, { AppTopbar } from './components/AppNav.jsx'
import {
  BookIcon, CardsIcon, ChartIcon, CloseIcon, MicIcon, PeopleIcon, TaskIcon,
} from './components/Icons.jsx'
import { THEMES, applyTheme, loadTheme } from './lib/theme.js'
import { PALETTES, applyPalette, loadPalette } from './lib/palette.js'
import { loadNavOpen, loadNoticeOpen, saveNavOpen, saveNoticeOpen, useWide } from './lib/nav.js'
import { setViewerRole } from './lib/viewer.js'
import { installTapFeedback } from './lib/haptics.js'
import { playSfx, setSoundOn, soundOn } from './lib/sfx.js'
import { markJobSeen, watchJob } from './lib/generateJob.js'
import Wordbook from './components/Wordbook.jsx'
import PronunciationPractice from './components/PronunciationPractice.jsx'
import { buildSeed } from './data/seed.js'
import { getSession, loadProfile, onAuthChange, signOut } from './lib/auth.js'
import { loadState, resetState, saveState } from './lib/store.js'
import { isSupabaseConfigured } from './lib/supabase.js'

export default function App() {
  // 'materials' 教材 / 'homework' 今週の宿題 / 'learner' 学習の記録 / 'admin' 集計
  const [view, setView] = useState('learner')
  const [state, setState] = useState(null)
  const [learnerId, setLearnerId] = useState(null)

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
  const [navOpen, setNavOpen] = useState(loadNavOpen)
  // 狭い画面へ移ったときは、開いたままにしない。
  // かぶせる形なので、開いたままだと中身が読めない
  useEffect(() => { if (!wide) setNavOpen(false) }, [wide])
  // 試作版の断り書き。一度閉じたら覚えておく
  const [noticeOpen, setNoticeOpen] = useState(loadNoticeOpen)
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

  // ログインしている人の表示名と役割を読む
  useEffect(() => {
    if (!session?.user?.id) { setProfile(null); return }
    let alive = true
    loadProfile(session.user.id).then((p) => { if (alive) setProfile(p) })
    return () => { alive = false }
  }, [session])

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

  // ログインした直後は、その人が最初に見たい画面を開く
  const [landed, setLanded] = useState(false)
  useEffect(() => {
    if (!isSupabaseConfigured || !profile || landed) return
    setView(isTrainer ? 'materials' : 'homework')
    setLanded(true)
  }, [profile, isTrainer, landed])

  // 起動時にデータを読み込む(なければサンプルデータを作る)
  useEffect(() => {
    const loaded = loadState(buildSeed())
    setState(loaded)
    setLearnerId(loaded.learners[0]?.id ?? null)
  }, [])

  // データが変わるたびに保存する
  useEffect(() => {
    if (state) saveState(state)
  }, [state])

  const handleReset = () => {
    if (!window.confirm('保存されているデータをすべて消して、サンプルデータに戻します。よろしいですか?')) return
    const fresh = resetState(buildSeed())
    setState(fresh)
    setLearnerId(fresh.learners[0]?.id ?? null)
  }

  if (!authChecked || !state) {
    return <div className="loading">読み込み中…</div>
  }

  // Supabase が設定されているならログインを必須にする。
  // 未設定のときは従来どおり、ログインなしで動く。
  if (isSupabaseConfigured && !session) {
    return <SignIn />
  }

  // 画面の一覧。**メニューも、帯に出す名前も、これ1つを見る。**
  // 2か所に書くと、並びと呼び名が必ず食い違う。
  //
  // 並びは役割の順。トレーナーには「教材 → ゲスト → 集計」が仕事の順で、
  // 「今週の宿題 / 学習の記録」は自分自身の学習の画面である。
  const pages = [
    (!isSupabaseConfigured || isTrainer) && { id: 'materials', label: '教材', icon: BookIcon },
    (!isSupabaseConfigured || isTrainer) && { id: 'learners', label: 'ゲスト', icon: PeopleIcon },
    // **集計は管理者だけ**(2026-08 の設計変更)。トレーナーが見るのは
    // 「ゲスト」画面に出る取り組みのほうで、スクール全体の数字ではない
    (!isSupabaseConfigured || isOwner) && { id: 'admin', label: '集計', icon: ChartIcon },
    (!isSupabaseConfigured || !isTrainer) && { id: 'homework', label: '今週の宿題', icon: TaskIcon },
    // 単語帳は**トレーナーも使う。** トレーナーも日々英語を学んでいる
    // (2026-08 利用者の指定)。記録はログインしている人ごとに分かれる
    { id: 'wordbook', label: '単語帳', icon: CardsIcon },
    // **発音練習だけは独立した機能にする**(2026-08 利用者の指定)
    { id: 'pronunciation', label: '発音練習', icon: MicIcon },
    // 「学習の記録」は外した(2026-08 の設計変更)。
    // **やったことは、こちらが裏で数える**(0022・`src/lib/practice.js`)。
    // ゲストに何分やったかを入力させない。入力そのものが手間で、
    // しかも入れ忘れる。数えたものはトレーナーの「ゲスト」画面に出る
  ].filter(Boolean)
  const pageLabel = pages.find((p) => p.id === view)?.label ?? 'English AI System'

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
    <div className={`app-shell${wide ? ' is-wide' : ' is-narrow'}`
                    + (navOpen ? ' nav-open' : ' nav-closed')}>
      <AppNav
        items={pages} value={view}
        /* **いまいる画面をもう一度押したら、その画面の先頭に戻す**
           (2026-08 利用者の指定)。
             > 一人のゲストの情報内でサイドバーの「ゲスト」をクリック、
             > またはタップしたらゲスト選択画面に戻れるようにしてください
           `view` は変わらないので、押されたことを数で伝える。
           受け取った画面が、自分の中の「開いているもの」を閉じる */
        onChange={(id) => { setView(id); setNavTick((n) => n + 1) }}
        open={navOpen} wide={wide}
        onClose={() => setNavOpen(false)}
        title="English AI System"
        footer={navFooter}
      />

      <div className="app-body">
        {/* どこにいても ☰ が同じ場所にある。名前も出すので、
            スマホでメニューが隠れていても「いまどこか」が分かる */}
        <AppTopbar
          onToggle={toggleNav} open={navOpen} wide={wide} pageLabel={pageLabel}
        />

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
            {jobNote.state === 'done' && view !== 'materials' && (
              <button type="button" className="btn btn--small btn--primary"
                      onClick={() => { setView('materials'); setJobNote(null) }}>
                教材の画面を開く
              </button>
            )}
            <button type="button" className="nav-icon-btn"
                    onClick={() => setJobNote(null)} aria-label="お知らせを閉じる">
              <CloseIcon />
            </button>
          </div>
        )}

        <div className="app">
          {/* 本文の上に置くのは、**その画面で使うものだけ。**
              「サンプルデータに戻す」はどの画面にも要らないので下へ移した
              (試作版の後始末であって、日々の操作ではない) */}
          {view === 'learner' && (
            <div className="app-toolbar">
              <label className="field field--inline">
                <span>ゲスト</span>
                <select value={learnerId ?? ''} onChange={(e) => setLearnerId(e.target.value)}>
                  {state.learners.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}({l.grade})
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          <SupabaseStatus />

          {/* 試作版の断り書き。**毎回ぜんぶ読ませない。**
              どの画面にも出るので、開いたままだと本文が下へ押し下げられる。
              一度閉じたら覚えておき、見たいときだけ開く */}
          {noticeOpen ? (
            <div className="notice notice--info app-notice">
              <button type="button" className="btn btn--link app-notice-close"
                      onClick={() => { setNoticeOpen(false); saveNoticeOpen(false) }}>
                とじる
              </button>
              <strong>この試作版について:</strong> Supabase への接続はできましたが、
              <strong>画面に出ているデータはまだこのブラウザの中のもの</strong>です
              (サンプルデータ)。これから順に Supabase へ移していきます。
              発音スコアは<strong>実際の音声を解析した結果ではなく、仮の数値</strong>です。
              詳しくは <code>docs/PROJECT_SPEC.md</code> の第5章をご覧ください。
            </div>
          ) : (
            <button type="button" className="btn btn--link app-notice-open"
                    onClick={() => { setNoticeOpen(true); saveNoticeOpen(true) }}>
              この試作版についての断り書きを読む
            </button>
          )}

          <main className="app-main">
            {view === 'materials' ? (
              profile ? <TrainerMaterials me={profile} /> : <p className="muted">読み込み中…</p>
            ) : view === 'learners' ? (
              profile ? <TrainerLearners me={profile} navTick={navTick} />
                : <p className="muted">読み込み中…</p>
            ) : view === 'homework' ? (
              <LearnerHomework me={profile} />
            ) : view === 'wordbook' ? (
              <Wordbook />
            ) : view === 'pronunciation' ? (
              <PronunciationPractice />
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
            <button type="button" className="btn btn--link" onClick={handleReset}>
              サンプルデータに戻す
            </button>
          </footer>
        </div>
      </div>
    </div>
  )
}
