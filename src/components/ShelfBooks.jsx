import { useMemo, useState } from 'react'
import { SHELF_GROUPS } from '../data/shelves.js'
import { BookIcon } from './Icons.jsx'

/**
 * **チェックを入れた分野だけを学ぶ**(0058・2026-09 利用者の指定)。
 *
 *   > 最終的にこうやって混ぜたくないんですよ。これは独立した単語帳に
 *   > したいんです。…チェックを入れた分野だけ単語が学べるようにしたいです
 *
 * ============================================================================
 * 【「追加する」ボタンは消えた】
 *
 *   0057 の `ShelfPick` は、棚の語を**自分の単語帳へ入れる**欄だった。
 *   入れた瞬間に教材の語と混ざるので、**混ぜる道ごと消した**
 *   (`ShelfPick.jsx` はファイルごと消してある・CLAUDE.md
 *   「値を偽にせず、道具ごと消す」)。
 *
 *   いまここは**どの冊を開くかを選ぶだけ**である。
 *   選んだ棚の語は、そのまま下の復習に出る ——
 *   覚え具合は `shelf_reviews`(0058)に、**棚の側として**残る。
 *
 * 【札ではなく、チェックにした】
 *
 *   利用者の言葉が「**チェックを入れた分野**」である。
 *   しかも棚は 35 冊あり、**いくつも選ぶ**もの
 *   (札の「押している / 押していない」より、四角い印のほうが
 *   「複数えらべる」と分かる)。
 *
 * 【自分では何も読まない】
 *
 *   語数も覚え具合も**呼ぶ側から受け取る**(`SpeechPractice` /
 *   `QrCard` と同じ「props で受け取る部品」)。
 *   自分で読みに行くと、**骨組み(Supabase 無し)では何も描かれず、
 *   描けないものは測れない。**
 */
export default function ShelfBooks({
  /** 出してよい棚(`shelvesFor()` が決めたもの) */
  shelves = [],
  /** 棚ごとの語数 `{ [id]: n }`(`loadShelfCounts()`) */
  counts = {},
  /** 棚ごとの覚え具合 `{ [id]: { learning, known } }`(`loadShelfProgress()`) */
  progress = {},
  /** チェックが入っている棚の id */
  picked = [],
  onPicked = null,
}) {
  /* **選んでいなければ開いておく。** 1冊も選んでいない状態で畳むと、
     下に何も出ないまま「どうすればよいか」が画面から消える */
  const [open, setOpen] = useState(picked.length === 0)

  const total = useMemo(
    () => picked.reduce((n, id) => n + (counts[id] ?? 0), 0),
    [picked, counts],
  )

  const toggle = (id) => {
    const next = picked.includes(id)
      ? picked.filter((x) => x !== id)
      : [...picked, id]
    onPicked?.(next)
  }

  /** **出す棚が1冊も無ければ、欄ごと出さない**(効かない操作を見せない) */
  if (!shelves.length) return null

  return (
    <div className="wb-add shelfbooks">
      <button type="button" className="btn btn--ghost btn--small wb-add-open"
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}>
        <BookIcon />
        {picked.length
          ? `学ぶ分野(${picked.length} 分野 / ${total} 語)`
          : `学ぶ分野をえらぶ(${shelves.length} 分野)`}
      </button>

      {open && (
        <div className="wb-add-body">
          <p className="basicpick-lead">
            チェックを入れた分野の語だけを練習します。
            <strong>自分の単語帳とは混ざりません。</strong>
            覚え具合は、この単語帳の側に残ります。
          </p>

          {SHELF_GROUPS.map((g) => {
            const list = shelves.filter((s) => s.group === g.id)
            if (!list.length) return null
            return (
              <div key={g.id} className="shelfbooks-group">
                <p className="field-label">{g.label}</p>
                <ul className="shelfbooks-list">
                  {list.map((s) => {
                    const n = counts[s.id] ?? 0
                    const p = progress[s.id] ?? null
                    return (
                      <li key={s.id}>
                        <label className={`shelfbook${picked.includes(s.id) ? ' is-on' : ''}`}>
                          <input type="checkbox"
                                 checked={picked.includes(s.id)}
                                 onChange={() => toggle(s.id)} />
                          <span className="shelfbook-name">{s.label}</span>
                          {/* **まだ空の棚も出す。** 隠すと「なぜ出ないのか」が
                              分からない。トレーナーが作るまで 0 語である */}
                          <span className="shelfbook-n">{n} 語</span>
                          {p && (p.learning > 0 || p.known > 0) && (
                            <span className="shelfbook-done">
                              覚えかけ {p.learning} / 覚えた {p.known}
                            </span>
                          )}
                        </label>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}

          {/* **外す道を、その場に置く**(1つずつ外して回らせない) */}
          {picked.length > 0 && (
            <div className="btn-row">
              <button type="button" className="btn btn--ghost btn--small"
                      onClick={() => onPicked?.([])}>
                チェックをぜんぶ外す
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
