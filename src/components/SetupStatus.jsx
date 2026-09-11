/**
 * **「まだ済んでいない準備」だけを出す、小さな帯**(2026-09 実機・利用者の問い)。
 *
 *   > これをやったかどうか覚えていません。この現象がなん度も起きています。
 *   > あなたで把握できる方法はないのですか？
 *
 * 【なぜ、この形か】
 *
 *   SQL を貼ったか・窓口を置き直したかは、**こちらからは確かめられない**
 *   (この環境から Supabase に届かない)。けれども**アプリからは確かめられる。**
 *   だから**覚えておくのをやめて、開くたびにアプリに訊かせる。**
 *
 *   これまでも知らせはあったが、**その操作をしたときにしか出なかった** ——
 *   窓口の版は「教材を作りに行ったとき」だけ、表の有無は「その画面を
 *   開いたとき」だけ。つまり**確かめるために、その操作をするしかなかった**
 *   (しかも教材づくりはそのまま課金である)。
 *
 * 【済んでいれば、1ドットも出さない】
 *
 *   `SupabaseStatus` とまったく同じ作法である(CLAUDE.md
 *   「画面のいちばん上に、読まないものを置かない」)。
 *   **出るのは、本当にやることが残っているときだけ。**
 *
 * 【ゲストには出さない】
 *
 *   「SQL を貼ってください」「Edge Function を置き直してください」は
 *   **仕組みの内側の話**で、ゲストにできることは何も無い。
 *   判断は `canSeeSystemDetail()` に任せる(**既定は「見せない」**)。
 */
import { useEffect, useState } from 'react'
import { pendingSetup } from '../lib/setupState.js'
import { canSeeSystemDetail } from '../lib/viewer.js'

export default function SetupStatus({ role = null }) {
  const [todo, setTodo] = useState([])
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    // **役割が分かってから訊く。** ゲストには出さないので、呼ぶ必要もない
    if (role !== 'trainer' && role !== 'owner') return undefined
    let alive = true
    pendingSetup().then((list) => { if (alive) { setTodo(list); setDone(true) } })
    return () => { alive = false }
  }, [role])

  /** 済ませたあとに**確かめ直す**(行き止まりを作らない) */
  const again = async () => {
    setBusy(true)
    try { setTodo(await pendingSetup(true)) } finally { setBusy(false) }
  }

  if (!canSeeSystemDetail()) return null
  if (!done || !todo.length) return null

  return (
    <div className="notice notice--warn app-notice setup-note">
      <strong>あと {todo.length} つ、Supabase でやることが残っています</strong>
      <ol className="setup-list">
        {todo.map((t) => (
          <li key={t.id}>
            <div className="setup-title">{t.title}</div>
            <div className="setup-why">{t.why}</div>
            <div className="setup-how">{t.how}</div>
            <div className="setup-links">
              <a href={t.url} target="_blank" rel="noreferrer">貼るものを開く</a>
              {t.more && (
                <a href={t.more} target="_blank" rel="noreferrer">
                  いま何が入っているか確かめる SQL
                </a>
              )}
            </div>
          </li>
        ))}
      </ol>
      <div className="btn-row">
        <button type="button" className="btn btn--small" onClick={again} disabled={busy}>
          {busy ? '確かめています…' : '済ませたので、確かめ直す'}
        </button>
      </div>
    </div>
  )
}
