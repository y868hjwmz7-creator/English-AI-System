import { useEffect, useMemo, useState } from 'react'
import AdminDashboard from './components/AdminDashboard.jsx'
import EnglishStudyLog from './components/EnglishStudyLog.jsx'
import SupabaseStatus from './components/SupabaseStatus.jsx'
import { buildSeed } from './data/seed.js'
import { loadState, resetState, saveState } from './lib/store.js'

export default function App() {
  const [view, setView] = useState('learner') // 'learner' | 'admin'
  const [state, setState] = useState(null)
  const [learnerId, setLearnerId] = useState(null)

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

  if (!state) {
    return <div className="loading">読み込み中…</div>
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-main">
          <h1 className="app-title">English AI System</h1>
          <p className="app-subtitle">英語学習の記録・発音練習と、指導者向けの管理画面(試作版)</p>
        </div>

        <nav className="tabs" aria-label="画面の切り替え">
          <button
            type="button"
            className={`tab${view === 'learner' ? ' is-active' : ''}`}
            onClick={() => setView('learner')}
          >
            学習者の画面
          </button>
          <button
            type="button"
            className={`tab${view === 'admin' ? ' is-active' : ''}`}
            onClick={() => setView('admin')}
          >
            管理者の画面
          </button>
        </nav>
      </header>

      <div className="app-toolbar">
        {view === 'learner' && (
          <label className="field field--inline">
            <span>学習者</span>
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
        {view === 'learner' ? (
          currentLearner ? (
            <EnglishStudyLog state={state} setState={setState} learnerId={learnerId} />
          ) : (
            <p>学習者が登録されていません。</p>
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
