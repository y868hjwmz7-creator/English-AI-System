/**
 * Supabase への接続がうまくいっていないときだけ出す、小さな帯。
 *
 * 【つながっているときは、何も出さない】(2026-09 実機・利用者の指定)
 *
 *   > 上部のsupabaseと試作版うんぬん、、をたたむ。というくだりを消せませんか
 *
 *   つなぎ込みの作業中は「どこで止まっているか」を確かめるために
 *   **成功も出していた。** けれども接続はもう当たり前になっており、
 *   毎回いちばん上に緑の箱が出るだけで、**読むものではなくなっていた。**
 *   このファイルの最初の版にも「接続が完了したらこの帯は外す」と
 *   書いてあり、そのときが来た。
 *
 * 【それでも、失敗は黙って消さない】
 *
 *   **成功と失敗を、同じ見た目で終わらせない**(CLAUDE.md)。
 *   消したのは**成功のときだけ**で、届かない・表がまだ無いといった
 *   ときは、これまでどおり出す。
 *
 * 【ゲストには出さない】
 *
 *   「Supabase に届きません」「SQL Editor で 0001 を実行してください」は
 *   **仕組みの内側の話**で、ゲストにできることは何も無い(CLAUDE.md)。
 *   出すのはトレーナーと管理者だけ。**既定は「見せない」**なので、
 *   役割が分からないうちも出ない。
 */
import { useEffect, useState } from 'react'
import { checkConnection, supabaseProjectRef } from '../lib/supabase.js'
import { canSeeSystemDetail } from '../lib/viewer.js'

const LOOK = {
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
  // **つながっているときは何も出さない**(利用者の指定)
  if (result.ok) return null
  // 内側の話なので、ゲストには出さない(既定は「見せない」)
  if (!canSeeSystemDetail()) return null

  const look = LOOK[result.reason] ?? LOOK.error

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
