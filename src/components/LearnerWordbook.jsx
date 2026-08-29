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
 * 【書き換えない】
 *   ここは**読むだけ**である。「知っていた / 知らなかった」はゲスト本人の
 *   申告であり、トレーナーが代わりに付けるものではない。
 *   仮に押しても RLS(`learner_id = auth.uid()`)が拒む。
 *   **画面と DB の両方で、同じことを守る。**
 *
 * 取り出しは `review_words()`。担当していないゲストは SQL 側で拒まれる。
 */
import { useEffect, useState } from 'react'
import { loadReviewWords } from '../lib/vocab.js'
import SpeakButton from './SpeakButton.jsx'
import Tabs from './Tabs.jsx'

const VIEWS = [
  { id: 'due', label: '今日の復習', status: 'unknown', dueOnly: true },
  { id: 'unknown', label: '知らなかった', status: 'unknown', dueOnly: false },
  { id: 'known', label: '覚えた', status: 'known', dueOnly: false },
]

/** 次に出る日を、日数で言い換える。日付だけだと遠さが分からない */
const whenLabel = (dueOn) => {
  if (!dueOn) return ''
  const days = Math.round(
    (new Date(`${dueOn}T00:00:00`) - new Date(new Date().toDateString())) / 86400000,
  )
  if (days <= 0) return '今日'
  if (days === 1) return '明日'
  return `${days} 日後`
}

export default function LearnerWordbook({ learnerId, learnerName = '' }) {
  const [view, setView] = useState('unknown')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

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

  return (
    <div className="learner-wordbook">
      <p className="card-hint">
        {learnerName ? `${learnerName} さんが` : 'このゲストが'}
        宿題の英文で「知らなかった」と付けた語と言い回しです。
        <strong>ここは見るだけで、書き換えはできません。</strong>
        次の教材を作るときの手がかりに使ってください。
      </p>

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

      <ul className="wordbook">
        {rows.map((row) => (
          <li key={row.word_norm} className="wordbook-row">
            <div className="wordbook-main">
              <span className="wordbook-word" lang="en">{row.display || row.word_norm}</span>
              {row.kind === 'phrase' && <span className="wordbook-kind">言い回し</span>}
              {row.pos && <span className="etext-pos">{row.pos}</span>}
              <SpeakButton text={row.display || row.word_norm} className="etext-listen" />
            </div>
            {row.meaning_ja && <div className="wordbook-mean">{row.meaning_ja}</div>}
            <div className="wordbook-actions">
              <span className="wordbook-when">
                箱 {row.box ?? 0} / 次は {whenLabel(row.due_on)}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
