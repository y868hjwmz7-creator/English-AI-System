/**
 * 単語帳 — 自分が「知らなかった」と付けた語と句。
 *
 * 【なぜ要るか】(2026-08 の設計)
 *   これまで、語に印を付けても**本人からは何も見えなかった。**
 *   選んだ手応えが無いものは続かない。ここが復習の入口になる。
 *
 * 【間隔をあけて出す】(0015)
 *   「知っていた」を押すたびに箱が1つ上がり、次に出るまでが
 *   1 → 2 → 4 → 7 → 14 → 30 日と延びる。忘れたら箱 0 に戻る。
 *   **次にいつ出すかは SQL(`mark_word`)が決める。** 画面では計算しない。
 *   端末の日付や時差で食い違わないようにするためである。
 *
 * 【トレーナーも使う】
 *   `word_reviews` はログインしている人ごとの記録である。
 *   トレーナーが開けばトレーナー自身の単語帳になる。
 */
import { useCallback, useEffect, useState } from 'react'
import { loadMyWordbook, setWordStatus } from '../lib/vocab.js'
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

export default function Wordbook() {
  const [view, setView] = useState('due')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(null)

  const current = VIEWS.find((v) => v.id === view) ?? VIEWS[0]

  const reload = useCallback(async () => {
    setLoading(true)
    const { data, error: e } = await loadMyWordbook({
      status: current.status, dueOnly: current.dueOnly, limit: 200,
    })
    setLoading(false)
    if (e) { setError(e); return }
    setError(null)
    setRows(data)
  }, [current.status, current.dueOnly])

  useEffect(() => { reload() }, [reload])

  /**
   * その場で答える。**押した行はすぐ消す。**
   * 読み直しを待って消えるのでは、押した手ごたえが無い。
   */
  const answer = async (row, status) => {
    setBusy(row.word_norm)
    const { error: e } = await setWordStatus(row.word_norm, status, { kind: row.kind })
    setBusy(null)
    if (e) { setError(e); return }
    setRows((list) => list.filter((r) => r.word_norm !== row.word_norm))
  }

  return (
    <section className="card">
      <h2 className="card-title">単語帳</h2>
      <p className="card-hint">
        宿題の英文で「知らなかった」と付けた語と言い回しが並びます。
        <strong>覚えたものは、日をあけてもう一度出ます。</strong>
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
            ? '今日出すものはありません。よくできました。'
            : 'まだありません。宿題の英文で語に触れて、「知らなかった」を選ぶとここに入ります。'}
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
              {/* 箱と次に出る日。**進んでいることが見えないと続かない** */}
              <span className="wordbook-when">
                箱 {row.box} / 次は {whenLabel(row.due_on)}
              </span>
              <button type="button" className="btn btn--small"
                      disabled={busy === row.word_norm}
                      onClick={() => answer(row, 'known')}>覚えた</button>
              <button type="button" className="btn btn--small btn--warnish"
                      disabled={busy === row.word_norm}
                      onClick={() => answer(row, 'unknown')}>まだ</button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
