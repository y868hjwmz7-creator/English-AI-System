/**
 * 単語帳 — 自分が「知らなかった」と付けた語と句。
 *
 * ============================================================================
 * 【なぜ作り直したか】(2026-08 利用者の指定「単語帳のパワーアップ」)
 *
 *   前の形は、語と意味を**同時に**並べて出していた。これでは
 *   「読んで、うなずいて、終わり」になる。**思い出す機会が1度も無い。**
 *
 *   記憶は**思い出そうとしたときに**強くなる。読み返した回数ではない。
 *   そこで「今日の復習」を作り直した。
 *
 *     ① 語だけを出す。意味は隠す        ← ここで思い出そうとする
 *     ② 「意味を見る」で答え合わせ
 *     ③ 「覚えた / まだ」を選ぶ         ← 次にいつ出すかが決まる
 *
 *   **答えを見る前に、必ず1回考える。** これがこの画面の全部である。
 *
 * 【出会った文を一緒に出す】(0018)
 *   人は文脈ごと覚える。"consideration" を単独で覚えるより、
 *   「Thank you for your consideration.」で出会ったことを思い出せるほうが、
 *   次に会ったときに出てくる。出会った文は、その語を最初に付けたときに
 *   控えてある。**思い出す手がかりなので、意味と一緒に出す。**
 *
 * 【残りが見える】
 *   終わりの見えない作業は続かない。今日の残りと、覚えた数を上に出す。
 *
 * 【間隔をあけて出す】(0015)
 *   「覚えた」を押すたびに箱が1つ上がり、次に出るまでが
 *   1 → 2 → 4 → 7 → 14 → 30 日と延びる。忘れたら箱 0 に戻る。
 *   **次にいつ出すかは SQL(`mark_word`)が決める。** 画面では計算しない。
 *
 * 【トレーナーも使う】
 *   `word_reviews` はログインしている人ごとの記録である。
 *   トレーナーが開けばトレーナー自身の単語帳になる。
 */
import { useCallback, useEffect, useState } from 'react'
import { loadMyWordbook, loadWordbookCounts, setWordStatus } from '../lib/vocab.js'
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

/**
 * 出会った文の中で、その語を**太字にする**。
 * 文の中のどこに居たかが見えると、思い出しやすい。
 * 見つからなければ、そのまま出す(活用形が違うときなど)。
 */
function SeenIn({ sentence, word }) {
  if (!sentence) return null
  const needle = String(word ?? '').trim()
  const at = needle
    ? sentence.toLowerCase().indexOf(needle.toLowerCase())
    : -1
  return (
    <p className="wordbook-seen" lang="en">
      {at < 0 ? sentence : (
        <>
          {sentence.slice(0, at)}
          <strong>{sentence.slice(at, at + needle.length)}</strong>
          {sentence.slice(at + needle.length)}
        </>
      )}
    </p>
  )
}

export default function Wordbook() {
  const [view, setView] = useState('due')
  const [rows, setRows] = useState([])
  const [counts, setCounts] = useState({ due: 0, unknown: 0, known: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(null)
  // 「意味を見る」を押したか。**答えを見る前に、必ず1回考える**
  const [shown, setShown] = useState(false)
  // 今日この画面で答えた数。減っていくのが見えると続く
  const [done, setDone] = useState(0)

  const current = VIEWS.find((v) => v.id === view) ?? VIEWS[0]

  const reload = useCallback(async () => {
    setLoading(true)
    const [list, tally] = await Promise.all([
      loadMyWordbook({ status: current.status, dueOnly: current.dueOnly, limit: 200 }),
      loadWordbookCounts(),
    ])
    setLoading(false)
    if (tally.data) setCounts(tally.data)
    if (list.error) { setError(list.error); return }
    setError(null)
    setRows(list.data)
    setShown(false)
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
    setShown(false)
    if (current.dueOnly) {
      setDone((n) => n + 1)
      setCounts((c) => ({
        ...c,
        due: Math.max(0, c.due - 1),
        unknown: status === 'known' ? Math.max(0, c.unknown - 1) : c.unknown,
        known: status === 'known' ? c.known + 1 : c.known,
      }))
    }
  }

  const card = current.dueOnly ? rows[0] : null

  return (
    <section className="card">
      <h2 className="card-title">単語帳</h2>

      {/* 進み具合。**終わりが見えない作業は続かない** */}
      <div className="wordbook-tally">
        <span><strong>{counts.due}</strong> 今日出す</span>
        <span><strong>{counts.unknown}</strong> 覚えかけ</span>
        <span><strong>{counts.known}</strong> 覚えた</span>
        {done > 0 && <span className="wordbook-done">今日 {done} 語 おわり</span>}
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
            ? '今日出すものはありません。よくできました。'
            : 'まだありません。宿題の英文で語に触れて、「知らなかった」を選ぶとここに入ります。'}
        </p>
      )}

      {/* ── 今日の復習は、1語ずつ。**先に思い出す** ─────────────── */}
      {card && (
        <div className="wordcard">
          <p className="wordcard-count">のこり {rows.length} 語</p>

          <div className="wordcard-face">
            <span className="wordcard-word" lang="en">
              {card.display || card.word_norm}
            </span>
            {card.kind === 'phrase' && <span className="wordbook-kind">言い回し</span>}
            <SpeakButton text={card.display || card.word_norm} className="etext-listen" />
          </div>

          {!shown && (
            <>
              <p className="wordcard-ask">意味を思い出してから、押してください</p>
              <button type="button" className="btn btn--primary wordcard-reveal"
                      onClick={() => setShown(true)}>意味を見る</button>
            </>
          )}

          {shown && (
            <>
              <div className="wordcard-back">
                {card.pos && <span className="etext-pos">{card.pos}</span>}
                <span className="wordcard-mean">{card.meaning_ja || '(意味の控えがありません)'}</span>
              </div>
              <SeenIn sentence={card.seen_in} word={card.display || card.word_norm} />
              <div className="wordcard-actions">
                <button type="button" className="btn btn--primary"
                        disabled={busy === card.word_norm}
                        onClick={() => answer(card, 'known')}>覚えた</button>
                <button type="button" className="btn btn--warnish"
                        disabled={busy === card.word_norm}
                        onClick={() => answer(card, 'unknown')}>まだ</button>
                <span className="wordbook-when">箱 {card.box} / 次は {whenLabel(card.due_on)}</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── 見返す用の一覧。こちらは意味を隠さない ────────────────── */}
      {!current.dueOnly && (
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
              <SeenIn sentence={row.seen_in} word={row.display || row.word_norm} />
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
      )}
    </section>
  )
}
