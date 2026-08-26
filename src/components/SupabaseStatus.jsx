/**
 * Supabase への接続状態を表示する小さな帯。
 *
 * つなぎ込みの作業中に「どこで止まっているか」を画面で確かめるためのもの。
 * 接続が完了して実際にデータを読み書きするようになったら、この帯は外す。
 */
import { useEffect, useState } from 'react'
import { checkConnection, supabaseProjectRef } from '../lib/supabase.js'

const LOOK = {
  ok:           { cls: 'notice--ok',   title: 'Supabase に接続できています' },
  unconfigured: { cls: 'notice--info', title: 'Supabase はまだ設定されていません' },
  'no-schema':  { cls: 'notice--warn', title: 'あと一歩 — テーブルがまだありません' },
  network:      { cls: 'notice--warn', title: 'Supabase に届きませんでした' },
  error:        { cls: 'notice--warn', title: 'Supabase がエラーを返しました' },
}

export default function SupabaseStatus() {
  const [result, setResult] = useState(null)

  useEffect(() => {
    let alive = true
    checkConnection().then((r) => { if (alive) setResult(r) })
    return () => { alive = false }
  }, [])

  if (!result) return null

  const look = LOOK[result.ok ? 'ok' : result.reason] ?? LOOK.error

  return (
    <div className={`notice ${look.cls} app-notice`}>
      <strong>{look.title}</strong>
      <div>{result.message}</div>

      {result.reason === 'unconfigured' && (
        <div>
          <code>.env</code> に <code>VITE_SUPABASE_URL</code> と{' '}
          <code>VITE_SUPABASE_ANON_KEY</code> を書いてください。
          公開版では GitHub のシークレットから読み込みます。
          手順は <code>docs/SUPABASE_SETUP.md</code>。
        </div>
      )}

      {result.reason === 'no-schema' && (
        <div>
          Supabase の <strong>SQL Editor</strong> で{' '}
          <code>supabase/migrations/0001_init.sql</code> を実行してください。
          これでテーブルとアクセス制御(RLS)が作られます。
        </div>
      )}

      {supabaseProjectRef && (
        <div className="muted">接続先: {supabaseProjectRef}</div>
      )}
    </div>
  )
}
