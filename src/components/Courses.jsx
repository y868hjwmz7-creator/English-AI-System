/**
 * ============================================================================
 * **講座の棚**(2026-10-09 利用者の指定・第5.432節)
 *
 *   > 「30日講座」は「講座」に変えましょう。30日講座はその下の階層に
 *   > 置きます。ここには動画なども置いて、場合においては有料コンテンツも
 *   > 入れる場所にしていきたいです。
 *
 * 【なぜ階層にしたか】
 *   「30日講座」は**中身の名前**であって、**置き場の名前ではない。**
 *   置き場を「講座」にしておけば、講座が増えても
 *   **メニューの行き先は1つのまま**である
 *   (「型シフトを Quick Response の中の冊にした」のと同じ作法)。
 *
 * 【いまは1つだけ。**空の棚を飾らない**】
 *   中にあるのは「文法30日集中講座」1つである。
 *   **「これから動画が入ります」のような説明書きは置かない**
 *   (余計な説明書きを置かない・共通ルール)。入ったときに並ぶ。
 *
 * 【行き止まりを作らない】
 *   開いたら、上に「講座」へ戻る1行を出す。
 *
 * 【並べ方は、ホームとまったく同じ】
 *   1行1つ(絵・名前・矢印)。`.home-grid` / `.home-box` をそのまま使う ——
 *   **見た目を2組持たない**(CLAUDE.md)。
 * ============================================================================
 */
import { useState } from 'react'
import BasicsCourse from './BasicsCourse.jsx'
import { ChevronIcon, StepsIcon } from './Icons.jsx'
import { TONE_SIDE } from '../lib/btnTone.js'

/**
 * **講座の一覧は、ここ1か所。**
 *
 * 足すときはこの配列に1行足す。画面の中で `id === '…'` と書かない。
 */
export const COURSES = [
  { id: 'basics', label: '文法30日集中講座', icon: StepsIcon },
]

export default function Courses({ me = null }) {
  const [open, setOpen] = useState(null)
  const now = COURSES.find((c) => c.id === open) ?? null

  if (now) {
    return (
      <section className="stack">
        {/* **行き止まりを作らない。** 戻る道を、いちばん上に1つだけ置く */}
        <div className="btn-row">
          <button type="button" className={`btn btn--small ${TONE_SIDE}`}
                  onClick={() => setOpen(null)}>
            ← 講座
          </button>
        </div>
        {now.id === 'basics' && <BasicsCourse me={me} />}
      </section>
    )
  }

  return (
    <section className="home">
      <div className="home-sect">
        <div className="home-grid">
          {COURSES.map((c) => {
            const Icon = c.icon
            return (
              <button key={c.id} type="button" className="home-box"
                      onClick={() => setOpen(c.id)}>
                <span className="home-box-icon" aria-hidden="true"><Icon /></span>
                <span className="home-box-label">{c.label}</span>
                <ChevronIcon className="icon home-box-go" />
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}
