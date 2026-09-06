/**
 * **教材を消す**(2026-09 利用者の指定)。
 *
 *   > また、ゲストに作った教材を消す方法を作って下さい。
 *   > 全ての場面にて「教材を消す」の機能を追加したいです。
 *   > トレーナーだけの機能です。ゲストには消せません
 *
 * ============================================================================
 * 【部品を1つにしてある】
 *
 *   教材のカードは**2か所**にある(トレーナーの「教材」/ ゲストのカードの
 *   「過去の宿題」)。ボタン・2段の確かめ・知らせは**まったく同じ**なので、
 *   ここ1つに置く。**書き写すと必ず片方だけ古くなる**
 *   (単語帳で `LearnerWordbook` を別に持って踏んだ失敗)。
 *
 *   ゲストの「今週の宿題」には**置いていない。**
 *   あの画面はゲストのもので、「ゲストには消せません」という指定である。
 *
 * 【2段にする】
 *
 *   1回目 …「教材を消す」→「本当に消す」に変わり、**何が消えるかを出す**
 *   2回目 … 消す
 *
 *   `erase_learner`(ゲストの記録をまとめて消す)ほどではないが、
 *   **元には戻せない**ので押し間違いを1段で受け止める
 *   (「練習の記録を消す」「読み上げ音声を作り直す」と同じ作法)。
 *
 * 【押せない人には、ボタンを出さない】
 *
 *   **選ばせてから断らない**(CLAUDE.md)。判断は
 *   `canDeleteMaterial()`(`materialDelete.js`)1か所で、
 *   **守っているのは RLS のほう**である(0001 + 0044)。
 *
 * 【何人に共有しているかを、押したときに数える】
 *
 *   教材は既定で**全トレーナーの共有物**なので、消すと
 *   **配った先の宿題からも黙って消える。** 数を出さないと、
 *   何が起きるのかが押す前に分からない。
 *   **中身は1件も取ってこない**(数だけを1回問い合わせる)。
 */
import { useState } from 'react'
import { deleteMaterial, materialShareCount } from '../lib/materials.js'
import { canDeleteMaterial, deleteWarning } from '../lib/materialDelete.js'

export default function MaterialDelete({ material, me, onDeleted }) {
  const [ask, setAsk] = useState(false)
  const [shared, setShared] = useState(null)   // 共有している人数(数えられなければ null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  // **消せない人には、何も描かない**(選ばせてから断らない)
  if (!canDeleteMaterial(material, me)) return null

  const start = async () => {
    setErr(null)
    setAsk(true)
    /* **数えるのは押したときだけ。** 一覧に出ている全部を先に数えると、
       35件ぶんの問い合わせがいつも走ることになる */
    setShared(await materialShareCount(material.id))
  }

  const run = async () => {
    setBusy(true)
    try {
      const { error } = await deleteMaterial(material.id)
      if (error) { setErr(error); setAsk(false); return }
      onDeleted?.(material.id)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {/* **いちばん下に、1つだけ置く。** ふだん押すもの(印刷・共有・
          セッションで使う)と同じ行に並べない —— 元に戻せない操作である */}
      <div className="btn-row material-danger">
        <button type="button"
                className={`btn btn--small ${ask ? 'btn--quiet' : 'btn--ghost'}`}
                disabled={busy}
                onClick={() => (ask ? run() : start())}>
          {busy ? '消しています…' : ask ? '本当に消す' : '教材を消す'}
        </button>
        {ask && !busy && (
          <button type="button" className="btn btn--small btn--ghost"
                  onClick={() => { setAsk(false); setShared(null) }}>
            やめる
          </button>
        )}
      </div>
      {/* **押した場所のすぐ下に出す**(CLAUDE.md) */}
      {ask && <p className="card-hint">{deleteWarning(shared)}</p>}
      {err && <p className="notice notice--error">{err}</p>}
    </>
  )
}
