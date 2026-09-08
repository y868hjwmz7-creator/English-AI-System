/**
 * ゲスト名の箱 —— **開いているあいだ、画面の上に貼り付く**(2026-09 利用者の指定)。
 *
 *   > また、ゲストを一人選んでそのページの中にいるときは、
 *   > 常に画面上部にゲスト名ボックスが固定されているようにしたいです。
 *
 * ============================================================================
 * 【なぜ要るか】
 *
 *   ゲストのページは縦に長い(見出し → 切り替え → 宿題の一覧 →…)。
 *   下へ送ると**誰のページを開いているのかが画面から消える。**
 *   レッスンは画面を共有しながら行うので、
 *   **取り違えたまま気づかない**のがいちばん怖い。
 *
 * 【上に貼り付く帯は、1つの箱にまとめる】(CLAUDE.md)
 *
 *   自分では貼り付かない。貼り付く役は **`.app-stick`**(`App.jsx`)が
 *   持っている。ここで `top: 0` を書くと、送ったときに
 *   **上の帯と同じ場所に重なって ☰ が押せなくなる**
 *   (`.jobbar` でまったく同じことを踏んでいる)。
 *
 *   `.app-stick` の中に入れておけば、**`top` に帯の高さを書かずに済む** ——
 *   あの値は端末の切り欠き(`env(safe-area-inset-top)`)で変わるので、
 *   決め打ちにすると端末ごとにずれる。
 *
 * 【「← 一覧に戻る」も、この箱に入れる】
 *
 *   もとは中身のいちばん上に置いてあったが、**紙と一緒に送られて消える。**
 *   戻る道が画面から消えるのはいちばん困る(行き止まりを作らない)。
 *   **同じものを2か所に出さない**ので、上のボタンはこちらへ移した。
 *
 * 【名前をカードの中に二度書かない】
 *
 *   開いているあいだ、カードの側は名前と札を出さない
 *   (`TrainerLearners.jsx`)。この箱がいつも出しているためである。
 */
import { useEffect, useState } from 'react'
import { statusCls, statusLabel } from '../data/learnerStatus.js'
import { openLearner, rememberLearner, watchLearner } from '../lib/lastLearner.js'

export default function LearnerBar() {
  const [who, setWho] = useState(openLearner)
  useEffect(() => watchLearner(setWho), [])

  /* **開いていなければ、箱ごと出さない。**
     空の帯が残ると、そのぶん中身が下へ押し出される */
  if (!who?.id) return null

  return (
    <div className="learnerbar">
      <button type="button" className="btn btn--small btn--ghost learnerbar-back"
              onClick={() => rememberLearner(null)}>
        ← 一覧
      </button>
      {/* **名前は切らない。** 誰のページかが分からなくなる。
          入りきらないときは「…」で切るが、札は必ず残す */}
      <span className="learnerbar-name">{who.name || 'ゲスト'}</span>
      {who.status && (
        <span className={`badge ${statusCls(who.status)}`}>
          {statusLabel(who.status)}
        </span>
      )}
    </div>
  )
}
