/**
 * カタマリの「英語 / 訳」を切り替える札。**狭い画面にだけ出す。**
 *
 * > スマホの時は日本語と英語は切り替え表示、同じ位置になるようにしてください。
 * > 無理して両方見せても窮屈に感じますね。(2026-08 利用者の指定)
 *
 * 広い画面では英語の下に訳が並ぶので、この札は要らない。**出さない。**
 * (「同じことをするボタンを2つ見せない」と同じ考え方。
 *  必要のないところに操作を置かない)
 *
 * 状態は `slashLevel.js` が1つだけ持っている。カタマリは1画面に
 * いくつも出るので、部品ごとに持つと**1つ切り替えても他が付いてこない。**
 */
import { NARROW_AT, setChunkSide, useChunkSide } from '../lib/slashLevel.js'
import { useWide } from '../lib/nav.js'

const SIDES = [
  { id: 'en', label: '英語' },
  { id: 'ja', label: '訳' },
]

export default function ChunkSideToggle() {
  const wide = useWide(NARROW_AT)
  const side = useChunkSide()
  if (wide) return null

  return (
    <span className="chunk-side" role="group" aria-label="カタマリの表示">
      {SIDES.map((s) => (
        <button key={s.id} type="button"
                className={`btn btn--toggle btn--small${side === s.id ? ' is-active' : ''}`}
                aria-pressed={side === s.id}
                onClick={() => setChunkSide(s.id)}>
          {s.label}
        </button>
      ))}
    </span>
  )
}
