/**
 * 担当ゲストの単語帳を、トレーナーが**見る**ための画面。
 *
 * 【なぜ要るか】(2026-08 利用者の指定)
 *   > トレーナーのUIでゲストを選んだ時に、ここにゲストの単語帳を
 *   > 見れるタブが欲しい。
 *
 *   次の教材に何を混ぜるかを決めるとき、**その人が何につまずいたか**を
 *   見たい。いまは「混ぜる」欄に名前が並ぶだけで、箱や次に出す日までは
 *   見えなかった。
 *
 * 【ここが循環の要】(2026-08)
 *   見て終わりにしない。**選んだ語で、その場で教材を作れる。**
 *   「弱点を指摘した直後に教材を出す」がこのアプリの中心なので、
 *   単語帳から作る画面までを一続きにする。
 *
 * 【書き換えない】
 *   ここは**読むだけ**である。「知っていた / 知らなかった」はゲスト本人の
 *   申告であり、トレーナーが代わりに付けるものではない。
 *   仮に押しても RLS(`learner_id = auth.uid()`)が拒む。
 *   **画面と DB の両方で、同じことを守る。**
 *
 *   ただし「**見たこと**」だけは残す(`note_wordbook_view`、0019)。
 *   ゲストの画面に「トレーナーが見ました」と出る。
 *   **人が見ていると分かることが、どんなバッジより効く。**
 *
 * 取り出しは `review_words()`。担当していないゲストは SQL 側で拒まれる。
 */
import { useEffect, useState } from 'react'
import { loadReviewWords, loadVocabWeek, noteWordbookView } from '../lib/vocab.js'
import WordbookFilter, { applyWordbookFilter } from './WordbookFilter.jsx'
import SpeakButton from './SpeakButton.jsx'
import Tabs from './Tabs.jsx'

const VIEWS = [
  { id: 'due', label: '今日の復習', status: 'unknown', dueOnly: true },
  { id: 'unknown', label: '知らなかった', status: 'unknown', dueOnly: false },
  { id: 'known', label: '覚えた', status: 'known', dueOnly: false },
]

/** 選べる語の上限。これ以上入れても1つの教材には収まらない */
const MAX_PICK = 20


export default function LearnerWordbook({ learnerId, learnerName = '', onMakeMaterial = null }) {
  const [view, setView] = useState('unknown')
  const [rows, setRows] = useState([])
  /* **入った日と教材で絞る**(0024・2026-08 利用者の指定)。
     「この教材でつまずいた語だけ」で教材を作れるようにする */
  const [filter, setFilter] = useState({ day: null, material: null, field: null, topic: null })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  // 選んだ語(そろえた形をそのまま持つ)。タブを移っても消えない
  const [picked, setPicked] = useState([])
  const [week, setWeek] = useState(null)

  const current = VIEWS.find((v) => v.id === view) ?? VIEWS[0]

  useEffect(() => {
    let alive = true
    setLoading(true)
    loadReviewWords(learnerId, {
      status: current.status, dueOnly: current.dueOnly, limit: 200,
    }).then(({ data, error: e }) => {
      if (!alive) return
      setLoading(false)
      if (e) { setError(e); return }
      setError(null)
      setRows(data ?? [])
    })
    return () => { alive = false }
  }, [learnerId, current.status, current.dueOnly])

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
    <div className="learner-wordbook">
      {/* **地の上に文字を置きっぱなしにしない**(2026-08 利用者の指定)。
            > 青で選択されている部分、他の要素のように白でラップしてください。
          まわりが白いカードなので、ここだけ地の色の上に文字が乗っていた */}
      <div className="card wordbook-intro">
        <p className="card-hint">
          {learnerName ? `${learnerName} さんが` : 'このゲストが'}
          宿題の英文で「知らなかった」と付けた語と言い回しです。
          <strong>ここは見るだけで、書き換えはできません。</strong>
          語を選ぶと、その語で次の教材を作れます。
        </p>

        {/* 今週どれだけ取り組んだか(0019)。
            レッスンの入口で「今週やりましたね」と言えるようにする。
            **数が出ないだけで、単語帳は使える。** */}
        {week && week.days > 0 && (
          <p className="wordbook-week">
            今週は <strong>{week.days} 日</strong>取り組み、
            <strong>{week.answered} 問</strong>のうち {week.correct} 問を覚えていました。
            {week.weeks > 1 && <> 続けて <strong>{week.weeks} 週</strong>目です。</>}
          </p>
        )}
      </div>

      <Tabs
        variant="sub"
        ariaLabel="単語帳の切り替え"
        value={view}
        onChange={setView}
        items={VIEWS.map((v) => ({ id: v.id, label: v.label }))}
      />

      {error && <p className="notice notice--error">{error}</p>}
      {loading && <p className="hint">読み込み中…</p>}

      {!loading && !rows.length && (
        <p className="hint">
          {view === 'due'
            ? '今日出すものはありません。'
            : 'まだありません。宿題の英文で語に触れて選ぶと、ここに入ります。'}
        </p>
      )}

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
              <div className="wordbook-actions">
                <span className="wordbook-when">
                </span>
              </div>
            </li>
          )
        })}
      </ul>

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
    </div>
  )
}
