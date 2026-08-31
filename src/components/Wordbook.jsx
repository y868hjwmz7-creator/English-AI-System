/**
 * 単語帳 — 覚えるための画面。
 *
 * ============================================================================
 * 【考え方】(2026-08 の調査と、利用者の指定)
 *
 *   記憶は**思い出そうとしたときに**強くなる。読み返した回数ではない。
 *   だから語と意味を同時には出さない。**答えを見る前に、必ず1回考える。**
 *
 *   売れている単語アプリの中核は**4択の高速タップ**である(1語2秒)。
 *   ただし4択は「見て分かる」であって、「口から出る」より弱い。
 *   **どちらか一方では足りない。**
 *
 *   そこで **同じ語が、覚えるにつれて勝手に難しくなる**ようにした。
 *   0015 で入れた箱(0〜6)を、間隔だけでなく出題の形にも使う
 *   (`src/lib/wordQuiz.js`)。
 *
 *     箱 0〜1 → 4択      触れる回数を稼ぐ
 *     箱 2〜3 → 思い出す  意味を引き出す
 *     箱 4〜5 → 日本語→英語 話すときに出てくる
 *     箱 6    → つづり    メールで書ける
 *
 * 【10語で区切る】
 *   **終わりの見えない作業は続かない。** 残り全部ではなく10語で区切り、
 *   終わったら結果を出す。もう一度押せば次の10語。
 *
 * 【続けた記録は「週」で数える】(0019)
 *   日ごとの連続記録は1日休んだだけで途切れる。**途切れる記録は、
 *   途切れた瞬間にやめる理由になる。** レッスンが週2回なのだから週が自然。
 *
 * 【トレーナーが見ている】
 *   人が見ていると分かることが、どんなバッジより効く。
 *   トレーナーが単語帳を開いた記録を、ここに出す(0019)。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  loadGlossDetail, loadMyWordbook, loadVocabByIndustry, loadVocabWeek,
  loadWordbookCounts, loadWordbookViewers, setWordStatus,
} from '../lib/vocab.js'
import {
  QUIZ_FORMS, buildSession, isSelfGraded, makeChoices, pickForm, spellMatches,
} from '../lib/wordQuiz.js'
import { cefrProgress } from '../data/cefrVocab.js'
import { industryLabel } from '../data/industries.js'
import { shortDate } from '../lib/format.js'
import SpeakButton from './SpeakButton.jsx'
import Tabs from './Tabs.jsx'
import { usePracticeLog } from '../lib/practice.js'
import WordbookFilter, { applyWordbookFilter } from './WordbookFilter.jsx'

const VIEWS = [
  { id: 'due', label: '今日の復習', status: 'unknown', dueOnly: true },
  { id: 'unknown', label: '知らなかった', status: 'unknown', dueOnly: false },
  { id: 'known', label: '覚えた', status: 'known', dueOnly: false },
  { id: 'progress', label: '積み上がり' },
]


/** 出会った文。その語のところを太字に。伏せるときは下線に置き換える */
function SeenIn({ sentence, word, hide = false }) {
  if (!sentence) return null
  const needle = String(word ?? '').trim()
  const at = needle ? sentence.toLowerCase().indexOf(needle.toLowerCase()) : -1
  if (at < 0) return <p className="wordbook-seen" lang="en">{sentence}</p>
  return (
    <p className="wordbook-seen" lang="en">
      {sentence.slice(0, at)}
      {hide
        ? <span className="wordbook-blank" aria-label="ここに入る語">　　　</span>
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
    ? r.senses : [{ pos: r.pos, meaning_ja: r.meaning_ja }]))
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

export default function Wordbook({ level = null }) {
  // 取り組みを**裏で数える**(0022)。ゲストのぶんだけ。
  // 記録が付かなくても練習は止まらない(貼る前でも動く)
  usePracticeLog('wordbook')

  const [view, setView] = useState('due')
  const [want, setWant] = useState('auto')      // 出題の形。auto は箱に合わせる
  const [rows, setRows] = useState([])          // その一覧ぜんぶ
  /* **入った日と教材で絞る**(0024・2026-08 利用者の指定)。
     絞り込みは手元で行う。選ぶたびに聞き直さない */
  const [filter, setFilter] = useState({ day: null, material: null })
  const [queue, setQueue] = useState([])        // いまの10語
  const [result, setResult] = useState(null)    // 終わったときの結果
  const [counts, setCounts] = useState({ due: 0, unknown: 0, known: 0 })
  const [week, setWeek] = useState({ days: 0, answered: 0, correct: 0, weeks: 0 })
  const [byIndustry, setByIndustry] = useState([])
  const [viewers, setViewers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(null)
  const [shown, setShown] = useState(false)     // 答えを出したか
  const [deep, setDeep] = useState(false)
  const [typed, setTyped] = useState('')        // つづりの入力
  const [judged, setJudged] = useState(null)    // 4択・つづりの判定
  const doneRef = useRef([])                    // この10語の結果

  const current = VIEWS.find((v) => v.id === view) ?? VIEWS[0]
  const isQuiz = view === 'due'

  const reload = useCallback(async () => {
    setLoading(true)
    const [list, tally, wk, ind, seen] = await Promise.all([
      current.status
        ? loadMyWordbook({ status: current.status, dueOnly: current.dueOnly, limit: 200 })
        : Promise.resolve({ data: [] }),
      loadWordbookCounts(), loadVocabWeek(), loadVocabByIndustry(), loadWordbookViewers(),
    ])
    setLoading(false)
    if (tally.data) setCounts(tally.data)
    if (wk.data) setWeek(wk.data)
    if (ind.data) setByIndustry(ind.data)
    if (seen.data) setViewers(seen.data)
    if (list.error) { setError(list.error); return }
    setError(null)
    setRows(list.data ?? [])
    setQueue(current.dueOnly ? buildSession(list.data ?? []) : [])
    doneRef.current = []
    setResult(null)
    setShown(false); setDeep(false); setTyped(''); setJudged(null)
  }, [current.status, current.dueOnly])

  useEffect(() => { reload() }, [reload])

  // 見返す用の一覧に出す行。**出題(今日の復習)は絞らない。**
  // あちらは「今日出すべきもの」なので、選んで減らすものではない
  const shownRows = applyWordbookFilter(rows, filter)
  const card = isQuiz ? queue[0] : null
  const word = card ? (card.display || card.word_norm) : ''
  const form = card ? pickForm(card, rows, want) : 'recall'
  const choices = card && form === 'choice' ? makeChoices(card, rows) : null

  /** 1語ぶん答える。**押した語はすぐ消す。** 待たされると手ごたえが無い */
  const answer = async (row, status) => {
    setBusy(row.word_norm)
    const { error: e } = await setWordStatus(row.word_norm, status, { kind: row.kind })
    setBusy(null)
    if (e) { setError(e); return }
    doneRef.current.push({ word: row.display || row.word_norm, ok: status === 'known' })
    setRows((list) => list.filter((r) => r.word_norm !== row.word_norm))
    setShown(false); setDeep(false); setTyped(''); setJudged(null)
    setCounts((c) => ({
      ...c,
      due: Math.max(0, c.due - 1),
      unknown: status === 'known' ? Math.max(0, c.unknown - 1) : c.unknown,
      known: status === 'known' ? c.known + 1 : c.known,
    }))
    setQueue((q) => {
      const rest = q.slice(1)
      // **10語で区切る。** 終わったら結果を出す
      if (!rest.length) setResult([...doneRef.current])
      return rest
    })
  }

  /** 4択・つづりは機械が判定する。**自己申告より正直な記録になる** */
  const judge = (ok) => {
    setJudged(ok)
    setShown(true)
    // 少しだけ見せてから次へ。すぐ消えると、何が正解だったか分からない
    window.setTimeout(() => answer(card, ok ? 'known' : 'unknown'), ok ? 700 : 1600)
  }

  const cefr = level ? cefrProgress(level, counts.known) : null

  return (
    <section className="card">
      <h2 className="card-title">単語帳</h2>

      {/* 進み具合。**終わりが見えない作業は続かない** */}
      <div className="wordbook-tally">
        <span><strong>{counts.due}</strong> 今日出す</span>
        <span><strong>{counts.unknown}</strong> 覚えかけ</span>
        <span><strong>{counts.known}</strong> 覚えた</span>
        {week.weeks > 0 && (
          <span className="wordbook-done">{week.weeks} 週つづけて / 今週 {week.days} 日</span>
        )}
      </div>

      {/* トレーナーが見た。**人が見ていると分かることが、いちばん効く** */}
      {viewers.length > 0 && (
        <p className="wordbook-seenby">
          {/* `viewed_at` は時刻まで入った値なので、**日付だけに切ってから渡す。**
              そのまま渡すと "8/NaN" になる(実際にそう出した) */}
          担当トレーナーが {shortDate(String(viewers[0].viewed_at).slice(0, 10))}
          {' '}にこの単語帳を見ました。
        </p>
      )}

      <Tabs
        variant="sub" ariaLabel="単語帳の切り替え"
        value={view} onChange={setView}
        items={VIEWS.map((v) => ({ id: v.id, label: v.label }))}
      />

      {error && <p className="notice notice--error">{error}</p>}
      {loading && <p className="hint">読み込み中…</p>}

      {/* ── 積み上がり ────────────────────────────────────────── */}
      {view === 'progress' && !loading && (
        <div className="wordbook-progress">
          {cefr ? (
            <div className="wordbook-goal">
              <p className="wordbook-goal-line">
                <strong>{level}</strong> のめやす {cefr.need} 語のうち
                <strong> {cefr.known} 語</strong>({cefr.percent}%)
              </p>
              <div className="wordbook-bar"><span style={{ width: `${cefr.percent}%` }} /></div>
              {cefr.next && (
                <p className="hint">
                  次の {cefr.next.level} まで あと {cefr.next.remain} 語
                </p>
              )}
              <p className="hint">
                ここに入るのは<strong>「知らなかった」と付けた語だけ</strong>です。
                もともと知っている語は数えていません。
              </p>
            </div>
          ) : (
            <p className="hint">レベルが分かると、めやすに対する達成率が出せます。</p>
          )}

          <h3 className="wordbook-sub">業界べつ</h3>
          {!byIndustry.length && <p className="hint">まだありません。</p>}
          <ul className="wordbook-industry">
            {byIndustry.map((r) => (
              <li key={r.industry}>
                <span>{r.industry === 'general' ? '汎用' : industryLabel(r.industry)}</span>
                <strong>{r.known}</strong> 語
                {r.learning > 0 && <span className="hint">(覚えかけ {r.learning})</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── 今日の復習(10語ずつ)────────────────────────────── */}
      {isQuiz && !loading && result && (
        <div className="wordcard wordcard--result">
          <p className="wordcard-count">
            {result.filter((r) => r.ok).length} / {result.length} 語
          </p>
          <ul className="wordbook-result">
            {result.map((r, i) => (
              <li key={i} className={r.ok ? 'is-ok' : 'is-ng'}>
                <span aria-hidden="true">{r.ok ? '○' : '×'}</span>
                <span lang="en">{r.word}</span>
              </li>
            ))}
          </ul>
          {counts.due > 0
            ? (
              <button type="button" className="btn btn--primary" onClick={reload}>
                つぎの {Math.min(10, counts.due)} 語
              </button>
            )
            : <p className="hint">今日の分は終わりです。よくできました。</p>}
        </div>
      )}

      {isQuiz && !loading && !result && !card && (
        <p className="hint">今日出すものはありません。よくできました。</p>
      )}

      {card && (
        <>
          <div className="wordbook-mode" role="group" aria-label="出題の形">
            <button type="button"
                    className={`chip${want === 'auto' ? ' is-selected' : ''}`}
                    onClick={() => setWant('auto')}>おまかせ</button>
            {QUIZ_FORMS.map((f) => (
              <button key={f.id} type="button" title={f.hint}
                      className={`chip${want === f.id ? ' is-selected' : ''}`}
                      onClick={() => { setWant(f.id); setShown(false); setJudged(null) }}>
                {f.label}
              </button>
            ))}
          </div>

          <div className="wordcard">
            <p className="wordcard-count">
              のこり {queue.length} 語(全 {counts.due})
            </p>

            {/* 出す側。
                **答えを出しておいて答えさせない。** つづりを書く形で英語を
                そのまま見せていたので、写すだけで正解できた(2026-08 の実測)。
                日本語 → 英語と同じく、意味だけを出す */}
            <div className="wordcard-face">
              {form === 'ja2en' || form === 'spell'
                ? <span className="wordcard-word">{card.meaning_ja || '(意味の控えがありません)'}</span>
                : (
                  <>
                    <span className="wordcard-word" lang="en">{word}</span>
                    {card.kind === 'phrase' && <span className="wordbook-kind">言い回し</span>}
                    <SpeakButton text={word} className="etext-listen" />
                  </>
                )}
            </div>

            {/* 出会った文。訳なしで先に出す。日本語→英語のときは答えを伏せる */}
            {card.seen_in && (
              <div className="wordcard-seen">
                <SeenIn sentence={card.seen_in} word={word}
                        hide={(form === 'ja2en' || form === 'spell') && !shown} />
                {/* 答えが聞こえてしまう形では、出す前に鳴らさない */}
                {((form !== 'ja2en' && form !== 'spell') || shown) && (
                  <SpeakButton text={card.seen_in} className="etext-listen" />
                )}
              </div>
            )}

            {/* ── 4択 ───────────────────────────────────────── */}
            {form === 'choice' && choices && (
              <ul className="wordbook-choices">
                {choices.map((c, i) => (
                  <li key={i}>
                    <button type="button" disabled={judged !== null || busy}
                            className={`btn wordbook-choice${
                              judged !== null && c.correct ? ' is-right' : ''}`}
                            onClick={() => judge(c.correct)}>
                      {c.text}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* ── つづりを書く ───────────────────────────────── */}
            {form === 'spell' && (
              <form className="wordbook-spell"
                    onSubmit={(e) => { e.preventDefault(); judge(spellMatches(typed, word)) }}>
                <input type="text" value={typed} lang="en" autoCapitalize="off"
                       autoCorrect="off" spellCheck="false" placeholder="英語で書く"
                       disabled={judged !== null}
                       onChange={(e) => setTyped(e.target.value)} />
                <button type="submit" className="btn btn--primary"
                        disabled={judged !== null || !typed.trim()}>答える</button>
                {judged === false && (
                  <p className="wordbook-right" lang="en">正しくは <strong>{word}</strong></p>
                )}
              </form>
            )}

            {/* ── 思い出す / 日本語 → 英語 ───────────────────── */}
            {isSelfGraded(form) && (
              <div className="wordcard-actions">
                {/* **答えの2つを、となりどうしに置く**(2026-08 利用者の指定)。
                    以前は「意味を見る」をまん中に挟んでいたが、狭い画面では
                    [まだ][意味を見る] / [覚えた] と折り返して、
                    **答えの2つが上下に分かれていた**(実機)。
                    見るほうを1段上に出せば、どの幅でも2つは並ぶ */}
                <button type="button" className="btn btn--ghost btn--small"
                        aria-expanded={shown}
                        onClick={() => setShown((v) => !v)}>
                  {form === 'ja2en'
                    ? (shown ? '英語を隠す' : '英語を見る')
                    : (shown ? '意味を隠す' : '意味を見る')}
                </button>
                <div className="wordcard-answers">
                  <button type="button" className="btn btn--quiet"
                          disabled={busy === card.word_norm}
                          onClick={() => answer(card, 'unknown')}>まだ</button>
                  <button type="button" className="btn btn--primary"
                          disabled={busy === card.word_norm}
                          onClick={() => answer(card, 'known')}>覚えた</button>
                </div>
              </div>
            )}

            {shown && (
              <div className="wordcard-back">
                {form === 'ja2en' || form === 'spell' ? (
                  <p className="wordcard-answer">
                    <span className="wordcard-mean" lang="en">{word}</span>
                    <SpeakButton text={word} className="etext-listen" />
                  </p>
                ) : (
                  <p className="wordcard-answer">
                    {card.pos && <span className="etext-pos">{card.pos}</span>}
                    <span className="wordcard-mean">
                      {card.meaning_ja || '(意味の控えがありません)'}
                    </span>
                  </p>
                )}
                {card.seen_in_ja && <p className="wordcard-seen-ja">{card.seen_in_ja}</p>}
                <button type="button" className="btn btn--link"
                        onClick={() => setDeep((v) => !v)}>
                  {deep ? 'とじる' : 'くわしく'}
                </button>
                {deep && <Detail wordNorm={card.word_norm} />}
              </div>
            )}

            {/* **「箱 0 / 次は今日」は出さない**(2026-08 利用者の指定)。
                > 単語帳内の「箱0 / 次は今日」はバックグラウンドのデータとして
                > 表には出さないでください。
                箱と次に出す日は、**この仕組みが内側で使う数字**である。
                ゲストにできることは何も無く、覚える助けにもならない。 */}
          </div>
        </>
      )}

      {/* ── 見返す用の一覧 ────────────────────────────────────── */}
      {!isQuiz && view !== 'progress' && !loading && (
        <>
          <WordbookFilter rows={rows} value={filter} onChange={setFilter} />
          {!rows.length && <p className="hint">まだありません。</p>}
          {rows.length > 0 && !shownRows.length && (
            <p className="hint">その絞り込みに当てはまる語はありません。</p>
          )}
          <ul className="wordbook">
            {shownRows.map((row) => (
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
                  <button type="button" className="btn btn--small"
                          disabled={busy === row.word_norm}
                          onClick={() => answer(row, 'known')}>覚えた</button>
                  <button type="button" className="btn btn--small btn--quiet"
                          disabled={busy === row.word_norm}
                          onClick={() => answer(row, 'unknown')}>まだ</button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
