import { useEffect, useMemo, useState } from 'react'
import AdminDashboard from './components/AdminDashboard.jsx'
import EnglishStudyLog from './components/EnglishStudyLog.jsx'
import LearnerHomework from './components/LearnerHomework.jsx'
import SignIn from './components/SignIn.jsx'
import TrainerLearners from './components/TrainerLearners.jsx'
import TrainerMaterials from './components/TrainerMaterials.jsx'
import SupabaseStatus from './components/SupabaseStatus.jsx'
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

  // owner はトレーナーの権限も兼ねる(データベース側の is_trainer() と同じ考え方)
  const isTrainer = profile?.role === 'trainer' || profile?.role === 'owner'
  const isOwner = profile?.role === 'owner'
  const isLearner = profile?.role === 'learner'

  // 生徒がトレーナー用の画面を開いていたら戻す。
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

  const currentLearner = useMemo(
    () => state?.learners.find((l) => l.id === learnerId) ?? null,
    [state, learnerId],
  )

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

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-main">
          <h1 className="app-title">English AI System</h1>
          <p className="app-subtitle">生徒の学習記録・発音練習と、トレーナー向けの管理画面(試作版)</p>
        </div>

        <nav className="tabs" aria-label="画面の切り替え">
          {/* 教材はトレーナーの中心機能なので最初に置く */}
          {(!isSupabaseConfigured || isTrainer) && (
            <button
              type="button"
              className={`tab${view === 'materials' ? ' is-active' : ''}`}
              onClick={() => setView('materials')}
            >
              教材
            </button>
          )}
          {(!isSupabaseConfigured || isTrainer) && (
            <button
              type="button"
              className={`tab${view === 'learners' ? ' is-active' : ''}`}
              onClick={() => setView('learners')}
            >
              生徒
            </button>
          )}
          {(!isSupabaseConfigured || !isTrainer) && (
            <button
              type="button"
              className={`tab${view === 'homework' ? ' is-active' : ''}`}
              onClick={() => setView('homework')}
            >
              今週の宿題
            </button>
          )}
          <button
            type="button"
            className={`tab${view === 'learner' ? ' is-active' : ''}`}
            onClick={() => setView('learner')}
          >
            学習の記録
          </button>
          {(!isSupabaseConfigured || isTrainer) && (
            <button
              type="button"
              className={`tab${view === 'admin' ? ' is-active' : ''}`}
              onClick={() => setView('admin')}
            >
              集計
            </button>
          )}
        </nav>
      </header>

      {session && (
        <div className="app-account">
          <span className="app-account-name">
            {profile?.display_name || session.user.email}
          </span>
          <span className={`badge ${isTrainer ? 'badge--admin' : 'badge--learner'}`}>
            {profile
              ? (isOwner ? '管理者' : isTrainer ? 'トレーナー' : '生徒')
              : '役割を確認中'}
          </span>
          <button type="button" className="btn btn--link" onClick={signOut}>
            ログアウト
          </button>
        </div>
      )}

      <div className="app-toolbar">
        {view === 'learner' && (
          <label className="field field--inline">
            <span>生徒</span>
            <select value={learnerId ?? ''} onChange={(e) => setLearnerId(e.target.value)}>
              {state.learners.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}({l.grade})
                </option>
              ))}
            </select>
          </label>
        )}
        <button type="button" className="btn btn--link" onClick={handleReset}>
          サンプルデータに戻す
        </button>
      </div>

      <SupabaseStatus />

      <div className="notice notice--info app-notice">
        <strong>この試作版について:</strong> Supabase への接続はできましたが、
        <strong>画面に出ているデータはまだこのブラウザの中のもの</strong>です
        (サンプルデータ)。これから順に Supabase へ移していきます。
        発音スコアは<strong>実際の音声を解析した結果ではなく、仮の数値</strong>です。
        詳しくは <code>docs/PROJECT_SPEC.md</code> の第5章をご覧ください。
      </div>

      <main className="app-main">
        {view === 'materials' ? (
          profile ? <TrainerMaterials me={profile} /> : <p className="muted">読み込み中…</p>
        ) : view === 'learners' ? (
          profile ? <TrainerLearners me={profile} /> : <p className="muted">読み込み中…</p>
        ) : view === 'homework' ? (
          <LearnerHomework />
        ) : view === 'learner' ? (
          currentLearner ? (
            <EnglishStudyLog state={state} setState={setState} learnerId={learnerId} />
          ) : (
            <p>生徒が登録されていません。</p>
          )
        ) : (
          <AdminDashboard state={state} />
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
      </footer>
    </div>
  )
}
