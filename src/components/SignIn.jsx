/**
 * ログイン画面。
 *
 * サインアップ欄は意図的に作っていない。アカウントはトレーナーが
 * Supabase の管理画面から発行する(`docs/PROJECT_SPEC.md` 第 1.2 節)。
 */
import { useState } from 'react'
import { signIn } from '../lib/auth.js'
import { checkConnection, supabaseProjectRef } from '../lib/supabase.js'

/**
 * 接続を確かめた結果を、**日本語で1文にする。**
 *
 * もとの言葉は英語なので、そのまま出しても何をすればよいか分からない
 * (「ゲストには、仕組みの内側を見せない」と同じ考え方)。
 * ただし**もとの言葉も小さく残す。** 直らないときに、こちらへ
 * そのまま貼ってもらうためである。
 */
const CONN_TEXT = {
  ok: 'Supabase まで届いています。ログインID とパスワードをご確認ください。',
  timeout: '返事がありませんでした。通信が届いていません。'
    + '電波・Wi-Fi・機内モードをご確認のうえ、もう一度お試しください。',
  network: 'Supabase まで届いていません。電波・Wi-Fi・機内モードをご確認ください。'
    + '会社のネットワークが通信を止めていることもあります。',
  unconfigured: 'この版には Supabase の接続情報が入っていません。トレーナーにお知らせください。',
  'no-schema': 'つながりましたが、データベースの準備がまだです。トレーナーにお知らせください。',
  error: 'つながりましたが、断られました。下の文をそのままトレーナーにお知らせください。',
}

export default function SignIn() {
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  // **どこで止まっているかを、その場で確かめられるようにする**(2026-08 実機)。
  // 「押しても何も起きない」と言われたとき、通信が届いていないのか、
  // ID とパスワードが違うのかを、こちらからは切り分けられない
  const [conn, setConn] = useState(null)
  const [checking, setChecking] = useState(false)

  const handleCheck = async () => {
    if (checking) return
    setChecking(true)
    setConn(null)
    const r = await checkConnection()
    setConn(r)
    setChecking(false)
  }

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

        {/* **ログインできないときに、押せる手を1つ用意しておく**(2026-08 実機)。
            「押しても何も起きない」だけでは、通信が届いていないのか、
            ID とパスワードが違うのかが分からない。ここで往復を1回試すと、
            そのどちらなのかがその場で分かる。 */}
        <div className="signin-diag">
          <button type="button" className="btn btn--ghost btn--small"
                  onClick={handleCheck} disabled={checking}>
            {checking ? '確かめています…' : '接続を確かめる'}
          </button>
          {conn && (
            <div className={`notice ${conn.ok ? 'notice--ok' : 'notice--warn'} signin-conn`}
                 role="status">
              <p>{CONN_TEXT[conn.ok ? 'ok' : conn.reason] ?? CONN_TEXT.error}</p>
              {/* **もとの言葉も小さく残す。** こちらに知らせてもらうときに要る */}
              {!conn.ok && <p className="muted signin-conn-raw">{conn.message}</p>}
            </div>
          )}
        </div>

        {/* **どの版を見ているかを、ログインの前から分かるようにする**(2026-08)。
            版はこれまでフッター(ログインしたあと)にしか出しておらず、
            ログインできない人は、古い内容が残っているのかどうかを
            確かめられなかった。 */}
        <p className="muted signin-ref">
          {supabaseProjectRef && <>接続先: {supabaseProjectRef}</>}
          {import.meta.env.VITE_BUILD_STAMP && (
            <> ／ 版: <code>{import.meta.env.VITE_BUILD_STAMP}</code></>
          )}
        </p>
      </div>
    </div>
  )
}
