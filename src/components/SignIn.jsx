/**
 * ログイン画面。
 *
 * サインアップ欄は意図的に作っていない。アカウントはトレーナーが
 * Supabase の管理画面から発行する(`docs/PROJECT_SPEC.md` 第 1.2 節)。
 */
import { useState } from 'react'
import { signIn } from '../lib/auth.js'
import { supabaseProjectRef } from '../lib/supabase.js'

export default function SignIn() {
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    const { error: message } = await signIn(loginId, password)
    // 成功した場合は App 側がログイン状態の変化を受け取って画面を差し替える。
    // ここでは失敗したときだけ後始末をする。
    if (message) {
      setError(message)
      setBusy(false)
    }
  }

  return (
    <div className="signin">
      <div className="card signin-card">
        <h1 className="app-title">English AI System</h1>
        <p className="card-hint">ログインしてください。</p>

        <form onSubmit={handleSubmit}>
          {/*
            ゲストとトレーナーには「tanaka01」のようなIDだけを渡す。
            メールアドレスを用意させない方針のため、type="email" にはしない
            (ブラウザが「@ を入れてください」と拒むため)。
            @ が入っていればメールアドレスとして扱う。
          */}
          <label className="field">
            <span>ログインID</span>
            <input
              type="text"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck="false"
              required
              autoFocus
            />
            <span className="field-hint">
              ゲストの方は、トレーナーから渡されたIDをそのまま入れてください。
              トレーナー・管理者の方は、<strong>ご自身のメールアドレス</strong>で入ります。
            </span>
          </label>

          <label className="field signin-field">
            <span>パスワード</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>

          {error && (
            <div className="notice notice--warn signin-error" role="alert">
              {error}
            </div>
          )}

          <button type="submit" className="btn btn--primary signin-submit" disabled={busy}>
            {busy ? 'ログインしています…' : 'ログイン'}
          </button>
        </form>

        <p className="card-hint signin-note">
          アカウントはトレーナーが発行します。ご自身での登録はできません。
          ログインできない場合はトレーナーにお問い合わせください。
        </p>

        {supabaseProjectRef && (
          <p className="muted signin-ref">接続先: {supabaseProjectRef}</p>
        )}
      </div>
    </div>
  )
}
