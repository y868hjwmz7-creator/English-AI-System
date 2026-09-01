/**
 * 担当ゲストの単語帳を、トレーナーが見る画面。
 *
 * 【なぜ要るか】(2026-08 利用者の指定)
 *   > トレーナーのUIでゲストを選んだ時に、ここにゲストの単語帳を
 *   > 見れるタブが欲しい。
 *
 *   次の教材に何を混ぜるかを決めるとき、**その人が何につまずいたか**を
 *   見たい。
 *
 * 【ここが循環の要】(2026-08)
 *   見て終わりにしない。**選んだ語で、その場で教材を作れる。**
 *   「弱点を指摘した直後に教材を出す」がこのアプリの中心なので、
 *   単語帳から作る画面までを一続きにする。
 *
 * 【手で入れられる】(2026-09 利用者の指定・**方針の変更**)
 *
 *   > トレーナーエンドのゲストの単語帳にはトレーナーもゲストも手打ちで
 *   > 単語やフレーズを入れれるようにして下さい。大事なところです。
 *
 *   ここは長らく「**読むだけ**」と決めていた。
 *   けれどもレッスンは**ゲストと一緒に画面を見ながら**進めるので、
 *   その場で出てきた語をここに入れられないと、
 *   **紙にメモして、あとで入れ直す**ことになる。
 *   0025 で「レッスン中の記録はゲストのもの」と決めてあるので、
 *   ここから入れた語も**そのゲストの単語帳**に入る(`mark_word` の
 *   `p_learner`。担当していないゲストには SQL 側が書かせない)。
 *
 *   **「覚えた / まだ」を代わりに付ける道は、いまも作っていない。**
 *   あれはゲスト本人の申告である。足すのは「語そのもの」だけ。
 *
 * 【見た目は、自分の単語帳とそろえる】(2026-09 利用者の指定)
 *
 *   > 教材モード内の単語帳と、ゲストモード内の単語帳のUIがまだ
 *   > 異なっています。ゲストモード内のものを教材モード内のものと
 *   > 同じにしてください。
 *
 *   題と続けている週、3枚の札(まだ / 覚えかけ / 覚えた)、
 *   見るものの**プルダウン**、絞り込み、語のカード。
 *   **`Wordbook.jsx` と同じ部品・同じ決まりを使う。**
 *   ちがうのは「選んで教材を作れる」ことと、
 *   「復習(10語ずつの出題)をここでは行わない」ことだけである。
 *   出題はゲスト本人がやるものなので、トレーナーが代わりに答えると
 *   **やってもいない復習が記録されてしまう。**
 *
 * 取り出しは `review_words()`。担当していないゲストは SQL 側で拒まれる。
 */
import { useCallback, useEffect, useState } from 'react'
import {
  loadReviewWords, loadVocabWeek, loadWordbookCounts, noteWordbookView,
} from '../lib/vocab.js'
import WordbookFilter, { applyWordbookFilter } from './WordbookFilter.jsx'
import WordbookAdd from './WordbookAdd.jsx'
import SpeakButton from './SpeakButton.jsx'

/** 見るもの。**`Wordbook.jsx` と同じ3つ・同じ言葉**(2026-09) */
const VIEWS = [
  // **まだ + 覚えかけ**をまとめて読む(0027 の 'todo')
  { id: 'due', label: '復習', status: 'todo' },
  { id: 'learning', label: '覚えかけ', status: 'learning' },
  { id: 'known', label: '覚えた', status: 'known' },
]

/** 選べる語の上限。これ以上入れても1つの教材には収まらない */
const MAX_PICK = 20

export default function LearnerWordbook({ learnerId, learnerName = '', onMakeMaterial = null }) {
  const [view, setView] = useState('due')
  const [rows, setRows] = useState([])
  /* **入った日と教材で絞る**(0024・2026-08 利用者の指定)。
     「この教材でつまずいた語だけ」で教材を作れるようにする */
  const [filter, setFilter] = useState({ day: null, material: null, field: null, topic: null })
  const [counts, setCounts] = useState({ due: 0, unknown: 0, learning: 0, known: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  // 選んだ語(そろえた形をそのまま持つ)。見るものを変えても消えない
  const [picked, setPicked] = useState([])
  const [week, setWeek] = useState(null)

  const current = VIEWS.find((v) => v.id === view) ?? VIEWS[0]

  const reload = useCallback(async () => {
    setLoading(true)
    const [list, tally] = await Promise.all([
      loadReviewWords(learnerId, { status: current.status, limit: 200 }),
      loadWordbookCounts(learnerId),
    ])
    setLoading(false)
    if (tally.data) setCounts(tally.data)
    if (list.error) { setError(list.error); return }
    setError(null)
    setRows(list.data ?? [])
  }, [learnerId, current.status])

  useEffect(() => { reload() }, [reload])

  // 見たことを残し、今週の取り組みを読む。
  // **どちらも失敗しても単語帳は出す**(0019 を貼る前でも壊れない)
  useEffect(() => {
    let alive = true
    setPicked([])
    noteWordbookView(learnerId)
    loadVocabWeek(learnerId).then(({ data }) => { if (alive) setWeek(data ?? null) })
    return () => { alive = false }
  }, [learnerId])

  // 絞ったあとの行。**選んだ語(picked)は絞り込みでは消さない。**
  // 絞りを変えるたびに選択が消えると、集めて教材にできない
  const shown = applyWordbookFilter(rows, filter)

  const toggle = (word) => {
    setPicked((prev) => (prev.includes(word)
      ? prev.filter((w) => w !== word)
      : prev.length >= MAX_PICK ? prev : [...prev, word]))
  }

  return (
    /* **白いカードに載せる**(2026-09 実機で「まだ同じになっていません」)。
       自分の単語帳(`Wordbook.jsx`)は `<section className="card">` の中に
       あるのに、こちらは地の上に直に置いていた。中身をそろえても、
       **囲みが違えば別の画面に見える。** */
    <section className="card learner-wordbook">
      {/* **見た目は自分の単語帳とそろえる**(2026-09 利用者の指定)。
          題と、続けている週を同じ行に置く */}
      <div className="wb-head">
        <h2 className="card-title">
          {learnerName ? `${learnerName} さんの単語帳` : '単語帳'}
        </h2>
        {week?.weeks > 0 && (
          <span className="wb-streak" title="続けている週の数">
            {week.weeks} 週つづけて<span className="wb-streak-sub">今週 {week.days} 日</span>
          </span>
        )}
      </div>

      {/* 3枚の札。**カードのボタンと1対1で対応する**(`Wordbook.jsx` と同じ) */}
      <div className="wb-stats">
        <span className={`wb-stat${counts.unknown > 0 ? ' is-due' : ''}`}>
          <strong>{counts.unknown}</strong>
          <span className="wb-stat-label">まだ</span>
        </span>
        <span className="wb-stat">
          <strong>{counts.learning}</strong>
          <span className="wb-stat-label">覚えかけ</span>
        </span>
        <span className="wb-stat">
          <strong>{counts.known}</strong>
          <span className="wb-stat-label">覚えた</span>
        </span>
      </div>

      {/* **手で入れる**(2026-09 利用者の指定)。レッスン中に出てきた語を、
          その場でこのゲストの単語帳に入れる。入る先はゲストの記録である
          (0025 の `p_learner`)。担当外のゲストには SQL 側が書かせない */}
      <WordbookAdd learnerId={learnerId} learnerName={learnerName} onAdded={reload} />

      {/* 見るものの切り替え。**プルダウン**(`Wordbook.jsx` と同じ)。
          タブにすると、狭い画面で文字が切れて重なる(2026-08 実機) */}
      <div className="wb-tabrow">
        <label className="wb-viewpick">
          <span className="sr-only">見るものの切り替え</span>
          <select value={view} onChange={(e) => setView(e.target.value)}>
            {VIEWS.map((v) => (
              <option key={v.id} value={v.id}>
                {v.id === 'due' && counts.due > 0 ? `${v.label}(${counts.due})` : v.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && <p className="notice notice--error">{error}</p>}
      {loading && <p className="hint">読み込み中…</p>}

      {!loading && !rows.length && (
        <p className="hint">
          {view === 'known'
            ? 'まだ「覚えた」に入った語はありません。'
            : 'まだありません。宿題の英文で語に触れるか、上の「語句を手で入れる」から入れられます。'}
        </p>
      )}

      {!loading && (
        <>
          <WordbookFilter rows={rows} value={filter} onChange={setFilter} />
          {rows.length > 0 && !shown.length && (
            <p className="hint">その絞り込みに当てはまる語はありません。</p>
          )}
          <ul className="wordbook">
            {shown.map((row) => {
              const word = row.display || row.word_norm
              const on = picked.includes(word)
              return (
                <li key={row.word_norm} className={`wordbook-row${on ? ' is-picked' : ''}`}>
                  <div className="wordbook-main">
                    {onMakeMaterial && (
                      <label className="wordbook-pick">
                        <input type="checkbox" checked={on} onChange={() => toggle(word)} />
                        <span className="sr-only">{word} を教材に入れる</span>
                      </label>
                    )}
                    <span className="wordbook-word" lang="en">{word}</span>
                    {row.kind === 'phrase' && <span className="wordbook-kind">言い回し</span>}
                    {row.pos && <span className="etext-pos">{row.pos}</span>}
                    <SpeakButton text={word} className="etext-listen" />
                  </div>
                  {row.meaning_ja && <div className="wordbook-mean">{row.meaning_ja}</div>}
                  {/* 出会った文(0018)。**どの場面でつまずいたか**が分かると、
                      次の教材を作るときの手がかりになる */}
                  {row.seen_in && <p className="wordbook-seen" lang="en">{row.seen_in}</p>}
                  {row.seen_in_ja && <p className="wordcard-seen-ja">{row.seen_in_ja}</p>}
                </li>
              )
            })}
          </ul>
        </>
      )}

      {/* 選んだ語で教材を作る。**画面の下に貼り付けて、常に見えるようにする。**
          200語まで並ぶので、下まで送ってから押すのでは遠い */}
      {onMakeMaterial && picked.length > 0 && (
        <div className="wordbook-pickbar">
          <span>
            <strong>{picked.length} 語</strong>選んでいます
            {picked.length >= MAX_PICK && <>(ここまで)</>}
          </span>
          <button type="button" className="btn btn--link" onClick={() => setPicked([])}>
            選び直す
          </button>
          <button type="button" className="btn btn--primary"
                  onClick={() => onMakeMaterial(picked)}>
            この語で教材を作る
          </button>
        </div>
      )}
    </section>
  )
}
