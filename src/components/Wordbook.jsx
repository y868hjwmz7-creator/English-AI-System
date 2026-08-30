/**
 * 単語帳 — 自分が「知らなかった」と付けた語と句。
 *
 * ============================================================================
 * 【今日の復習は、1語ずつのカード】(2026-08 利用者の指定)
 *
 *   記憶は**思い出そうとしたときに**強くなる。読み返した回数ではない。
 *   だから語と意味を同時には出さない。
 *
 *   > 「意味を見る」ボタンはそのままに、「覚えた」「まだ」を左右に置き、
 *   > 意味を開かなくても押せるようにしたい。そして毎回順番をシャッフルする。
 *   > そして「意味を見る」の上に訳なしのその単語やフレーズが出て来た一文を
 *   > 入れて欲しい。意味を見るで文の意味も確認できる。
 *   > 文の音声ももちろん聴ける。そして別モードで日本語→英語も欲しい。
 *
 *   ┌──────────────────────────────┐
 *   │              のこり 12 語                    │
 *   │                                              │
 *   │          look forward to        [Listen]     │  ← 出す側
 *   │                                              │
 *   │  We look forward to hearing from you. [Listen]│  ← 出会った文(訳なし)
 *   │                                              │
 *   │   [ まだ ]   [ 意味を見る ]   [ 覚えた ]     │
 *   └──────────────────────────────┘
 *
 *   ・**「覚えた」「まだ」は最初から押せる。** 分かっているものを
 *     いちいち開かせない。分からないときだけ「意味を見る」を押す
 *   ・**毎回順番を混ぜる。** 並び順で覚えてしまうと、意味を思い出さずに
 *     答えられてしまう
 *   ・**出会った文を、訳なしで先に出す。** 人は文脈ごと覚える。
 *     文の中で見れば、意味を思い出す手がかりになる
 *   ・「意味を見る」で、語の意味と**文の意味**の両方が出る
 *
 * 【日本語 → 英語のモードもある】
 *   出す側と答える側を入れ替えるだけ。**話すための力は、こちら向きで育つ。**
 *   英語を見て意味が分かるのと、日本語から英語が出てくるのは別の力である。
 *
 * 【間隔をあけて出す】(0015)
 *   「覚えた」を押すたびに箱が1つ上がり、次に出るまでが
 *   1 → 2 → 4 → 7 → 14 → 30 日と延びる。忘れたら箱 0 に戻る。
 *   **次にいつ出すかは SQL(`mark_word`)が決める。** 画面では計算しない。
 *
 * 【トレーナーも使う】
 *   `word_reviews` はログインしている人ごとの記録である。
 */
import { useCallback, useEffect, useState } from 'react'
import {
  loadGlossDetail, loadMyWordbook, loadWordbookCounts, setWordStatus,
} from '../lib/vocab.js'
import SpeakButton from './SpeakButton.jsx'
import Tabs from './Tabs.jsx'

const VIEWS = [
  { id: 'due', label: '今日の復習', status: 'unknown', dueOnly: true },
  { id: 'unknown', label: '知らなかった', status: 'unknown', dueOnly: false },
  { id: 'known', label: '覚えた', status: 'known', dueOnly: false },
]

/** 出す側。英語から思い出すか、日本語から思い出すか */
const MODES = [
  { id: 'en', label: '英語 → 日本語', hint: '読んで分かる力' },
  { id: 'ja', label: '日本語 → 英語', hint: '話すときに出てくる力' },
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

/** **毎回混ぜる。** 並び順で覚えてしまうと、思い出す練習にならない */
const shuffle = (list) => {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/**
 * 出会った文。その語のところを**太字**にする。
 * 文の中のどこに居たかが見えると、思い出しやすい。
 */
function SeenIn({ sentence, word, hideWord = false }) {
  if (!sentence) return null
  const needle = String(word ?? '').trim()
  const at = needle ? sentence.toLowerCase().indexOf(needle.toLowerCase()) : -1
  if (at < 0) return <p className="wordbook-seen" lang="en">{sentence}</p>
  return (
    <p className="wordbook-seen" lang="en">
      {sentence.slice(0, at)}
      {/* 日本語 → 英語のときは、答えになる語を隠す */}
      {hideWord
        ? <span className="wordbook-blank">{'　'.repeat(Math.max(2, Math.ceil(needle.length / 3)))}</span>
        : <strong>{sentence.slice(at, at + needle.length)}</strong>}
      {sentence.slice(at + needle.length)}
    </p>
  )
}

/** 単語帳から深掘りする。**控えを読むだけ。AI に尋ね直さない** */
function Detail({ wordNorm }) {
  const [rows, setRows] = useState(null)
  useEffect(() => {
    let alive = true
    loadGlossDetail(wordNorm).then(({ data }) => { if (alive) setRows(data ?? []) })
    return () => { alive = false }
  }, [wordNorm])

  if (rows === null) return <p className="hint">読み込み中…</p>
  const senses = rows.flatMap((r) => (Array.isArray(r.senses) && r.senses.length
    ? r.senses
    : [{ pos: r.pos, meaning_ja: r.meaning_ja }]))
  if (!senses.length) return <p className="hint">くわしい控えはまだありません。</p>
  return (
    <ul className="wordbook-detail">
      {senses.map((se, i) => (
        <li key={i}>
          {se.pos && <span className="etext-pos">{se.pos}</span>}
          <span className="wordbook-detail-mean">{se.meaning_ja}</span>
          {se.example_en && <span className="wordbook-detail-ex" lang="en">{se.example_en}</span>}
          {se.note && <span className="wordbook-detail-note">{se.note}</span>}
        </li>
      ))}
    </ul>
  )
}

export default function Wordbook() {
  const [view, setView] = useState('due')
  const [mode, setMode] = useState('en')
  const [rows, setRows] = useState([])
  const [counts, setCounts] = useState({ due: 0, unknown: 0, known: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(null)
  // 「意味を見る」を押したか。**答えを見る前に、必ず1回考える**
  const [shown, setShown] = useState(false)
  const [deep, setDeep] = useState(false)
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
    // 今日の復習だけ混ぜる。見返す用の一覧は、出た順のままがよい
    setRows(current.dueOnly ? shuffle(list.data) : list.data)
    setShown(false)
    setDeep(false)
  }, [current.status, current.dueOnly])

  useEffect(() => { reload() }, [reload])

  /** その場で答える。**押した行はすぐ消す。** 待たされると手ごたえが無い */
  const answer = async (row, status) => {
    setBusy(row.word_norm)
    const { error: e } = await setWordStatus(row.word_norm, status, { kind: row.kind })
    setBusy(null)
    if (e) { setError(e); return }
    setRows((list) => list.filter((r) => r.word_norm !== row.word_norm))
    setShown(false)
    setDeep(false)
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
  const word = card ? (card.display || card.word_norm) : ''
  const fromJa = mode === 'ja'

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
        variant="sub" ariaLabel="単語帳の切り替え"
        value={view} onChange={setView}
        items={VIEWS.map((v) => ({ id: v.id, label: v.label }))}
      />

      {/* 出す側を入れ替える。**話す力は日本語 → 英語で育つ** */}
      {current.dueOnly && (
        <div className="wordbook-mode" role="group" aria-label="出題の向き">
          {MODES.map((m) => (
            <button key={m.id} type="button"
                    className={`chip${mode === m.id ? ' is-selected' : ''}`}
                    aria-pressed={mode === m.id}
                    onClick={() => { setMode(m.id); setShown(false); setDeep(false) }}>
              {m.label}
            </button>
          ))}
          <span className="field-hint">{MODES.find((m) => m.id === mode)?.hint}</span>
        </div>
      )}

      {error && <p className="notice notice--error">{error}</p>}
      {loading && <p className="hint">読み込み中…</p>}

      {!loading && !rows.length && (
        <p className="hint">
          {view === 'due'
            ? '今日出すものはありません。よくできました。'
            : 'まだありません。宿題の英文で語に触れて、「知らなかった」を選ぶとここに入ります。'}
        </p>
      )}

      {card && (
        <div className="wordcard">
          <p className="wordcard-count">のこり {rows.length} 語</p>

          {/* 出す側 */}
          <div className="wordcard-face">
            {fromJa ? (
              <span className="wordcard-word">{card.meaning_ja || '(意味の控えがありません)'}</span>
            ) : (
              <>
                <span className="wordcard-word" lang="en">{word}</span>
                {card.kind === 'phrase' && <span className="wordbook-kind">言い回し</span>}
                <SpeakButton text={word} className="etext-listen" />
              </>
            )}
          </div>

          {/* 出会った文。**訳なしで、答えを見る前に出す。** 文の音も聴ける */}
          {card.seen_in && (
            <div className="wordcard-seen">
              <SeenIn sentence={card.seen_in} word={word} hideWord={fromJa && !shown} />
              {/* 日本語 → 英語のときは、答えを見るまで音を出さない。
                  **鳴らせば答えが聞こえてしまい、思い出す練習にならない** */}
              {(!fromJa || shown) && (
                <SpeakButton text={card.seen_in} className="etext-listen" />
              )}
            </div>
          )}

          {/* 「覚えた」「まだ」は**左右に、最初から押せる** */}
          <div className="wordcard-actions">
            <button type="button" className="btn btn--warnish"
                    disabled={busy === card.word_norm}
                    onClick={() => answer(card, 'unknown')}>まだ</button>
            <button type="button" className="btn"
                    aria-expanded={shown}
                    onClick={() => setShown((v) => !v)}>
              {fromJa
                ? (shown ? '英語を隠す' : '英語を見る')
                : (shown ? '意味を隠す' : '意味を見る')}
            </button>
            <button type="button" className="btn btn--primary"
                    disabled={busy === card.word_norm}
                    onClick={() => answer(card, 'known')}>覚えた</button>
          </div>

          {shown && (
            <div className="wordcard-back">
              {fromJa ? (
                <p className="wordcard-answer">
                  <span className="wordcard-mean" lang="en">{word}</span>
                  <SpeakButton text={word} className="etext-listen" />
                </p>
              ) : (
                <p className="wordcard-answer">
                  {card.pos && <span className="etext-pos">{card.pos}</span>}
                  <span className="wordcard-mean">{card.meaning_ja || '(意味の控えがありません)'}</span>
                </p>
              )}
              {/* 文の意味。**分かるときだけ入っている**(0018) */}
              {card.seen_in_ja && <p className="wordcard-seen-ja">{card.seen_in_ja}</p>}

              <button type="button" className="btn btn--link"
                      onClick={() => setDeep((v) => !v)}>
                {deep ? 'とじる' : 'くわしく'}
              </button>
              {deep && <Detail wordNorm={card.word_norm} />}
            </div>
          )}

          <p className="wordbook-when wordcard-when">
            箱 {card.box} / 次は {whenLabel(card.due_on)}
          </p>
        </div>
      )}

      {/* 見返す用の一覧。こちらは意味を隠さない */}
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
              {row.seen_in_ja && <p className="wordcard-seen-ja">{row.seen_in_ja}</p>}
              <div className="wordbook-actions">
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
