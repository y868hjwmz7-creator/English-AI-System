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

/**
 * 画面の切り替え(2026-08 利用者の指定・0027)。
 *
 *   > 今日の復習というボタンにせず、復習にし、選んだら基本は今日のものから
 *   > 出題するようにそして日付ボタンも入れます。知らなかったボタンは
 *   > 必要ありません。
 *
 * 「復習」は**日を絞らなければ今日の分**を出す。日付を選ぶと、
 * その日に単語帳へ入った語から出す。
 * 「知らなかった」は外した(復習と役割が重なっていた)。
 */
const VIEWS = [
  // **まだ + 覚えかけ**をまとめて読む(0027 の 'todo')。
  // 日を絞れるように、ここでは due で切らずに読み、画面の側で選ぶ
  { id: 'due', label: '復習', status: 'todo', dueOnly: false },
  { id: 'learning', label: '覚えかけ', status: 'learning', dueOnly: false },
  { id: 'known', label: '覚えた', status: 'known', dueOnly: false },
  { id: 'progress', label: '積み上がり' },
]

/** 今日(端末の日付)。「今日出すもの」を選ぶのに使う */
const todayKey = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}


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
  const [counts, setCounts] = useState({ due: 0, unknown: 0, learning: 0, known: 0 })
  const [week, setWeek] = useState({ days: 0, answered: 0, correct: 0, weeks: 0 })
  const [byIndustry, setByIndustry] = useState([])
  const [viewers, setViewers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(null)
  const [shown, setShown] = useState(false)     // 答えを出したか
  /* **出会った文は、畳んでおく**(2026-08 利用者の指定)。
       > 例文は折りたたみ式で、基本はスマホで見た時に4択の全てが
       > 画面内に収まるようにしたいです。
     長い文が開いたままだと、答えの4択が画面の外へ出てしまう。 */
  const [seenOpen, setSeenOpen] = useState(false)
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
    setQueue([])
    doneRef.current = []
    setResult(null)
    setShown(false); setDeep(false); setTyped(''); setJudged(null); setSeenOpen(false)
  }, [current.status, current.dueOnly])

  useEffect(() => { reload() }, [reload])

  const shownRows = applyWordbookFilter(rows, filter)

  /**
   * 復習に出す10語を組む(2026-08 利用者の指定・0027)。
   *
   *   > 復習にし、選んだら基本は今日のものから出題するように
   *   > そして日付ボタンも入れます。
   *
   * **日を選んでいなければ、今日出すもの**(`due_on` が今日まで)。
   * 日を選んだら、**その日に単語帳へ入った語**から出す。
   * 並びは `buildSession()` が決める(まだ → 覚えかけ)。
   *
   * **絞り込みを変えたら組み直す。** 変えても前の10語のままだと、
   * 何のために選んだのか分からない。
   */
  useEffect(() => {
    if (!isQuiz || loading) return
    const today = todayKey()
    const pool = filter.day || filter.material
      ? applyWordbookFilter(rows, filter)
      : rows.filter((r) => !r.due_on || r.due_on <= today)
    setQueue(buildSession(pool))
    doneRef.current = []
    setResult(null)
    setShown(false); setDeep(false); setTyped(''); setJudged(null); setSeenOpen(false)
    // rows は reload で入れ替わる。中身ではなく、その入れ替わりを見ている
  }, [isQuiz, loading, rows, filter.day, filter.material])
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
    setShown(false); setDeep(false); setTyped(''); setJudged(null); setSeenOpen(false)
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
      {/* **題と、続いている記録は同じ行**(2026-08 利用者の指定)。
            > 単語帳、もっと洗練して直観的にしてください。
            > 現代的、分かりやすく使いやすい、シンプルに変更して。 */}
      <div className="wb-head">
        <h2 className="card-title">単語帳</h2>
        {week.weeks > 0 && (
          <span className="wb-streak" title="続けている週の数">
            {week.weeks} 週つづけて<span className="wb-streak-sub">今週 {week.days} 日</span>
          </span>
        )}
      </div>

      {/* 数は**3枚の札**にする。以前は1行に流していたので、
          どれが「いま何をすればよいか」なのか分からなかった。
          **「今日出す」だけを目立たせる。** そこが行動につながる数である */}
      {/* **札は「状態」そのものにする**(2026-08 利用者の指定・0027)。
            > 覚えかけ、の定義をはっきりさせましょう。
          以前は「覚えかけ」と書いておきながら、中身は「まだ」の数だった。
          **言葉と中身が食い違っていた。**
          いまはカードの3つのボタンと、この3枚の札が1対1で対応する。
          「今日出す」の数は、復習のタブに付く */}
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
        items={VIEWS.map((v) => ({
          id: v.id, label: v.label,
          // **復習には「今日出す数」を付ける。** 押す前に、やることの量が分かる
          count: v.id === 'due' && counts.due > 0 ? counts.due : null,
        }))}
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
          {/* **終わったときの点数は、大きく出す。**
              10語やり切ったことが分かるようにする(2026-08 利用者の指定) */}
          <p className="wb-score">
            <strong>{result.filter((r) => r.ok).length}</strong>
            <span className="wb-score-of">/ {result.length} 語</span>
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

      {/* **復習にも日付の絞り込みを置く**(2026-08 利用者の指定)。
            > 選んだら基本は今日のものから出題するようにそして日付ボタンも入れます。
          何も選ばなければ今日の分。日を選ぶと、その日に入った語から出す */}
      {isQuiz && !loading && (
        <WordbookFilter rows={rows} value={filter} onChange={setFilter} />
      )}

      {isQuiz && !loading && !result && !card && (
        /* **「ありません」と「読めていません」を、同じ見た目で終わらせない**
           (CLAUDE.md)。数え上げは表を直に見ているので、
           「復習 118」と出ているのに1語も出せないなら、それは
           **やり切ったのではなく、読めていない。** */
        (filter.day || filter.material)
          ? <p className="hint">その絞り込みに当てはまる語はありません。</p>
          : counts.due > 0
            ? (
              <p className="notice notice--warn">
                今日出す語が <strong>{counts.due} 語</strong>あるはずですが、
                読み出せませんでした。しばらくしてから開き直してください。
              </p>
            )
            : <p className="hint">今日出すものはありません。よくできました。</p>
      )}

      {card && (
        <>
          {/* **この回の進み具合**(2026-08 利用者の指定)。
                > あと10語みたいなのも、入れるのであればしっかりメリハリを
                > つけて存在意義があるように。
              「のこり 10 語」という小さな文字は、あってもなくても同じだった。
              **何問目かを数で出し、帯で見せる。**
              終わりが見えるから、あと3つなら続ける気になる。

              出題の形は**プルダウン1つ**にした。札を5つ並べていたので、
              いちばん押す「答える」ボタンより目立っていた。
              既定の「おまかせ」は、覚えの深さ(箱)から自動で決まる */}
          {(() => {
            const done = doneRef.current.length
            const total = done + queue.length
            return (
              <div className="wb-run">
                <div className="wb-run-head">
                  <span className="wb-run-count">
                    <strong>{done + 1}</strong> / {total} 語
                  </span>
                  <label className="wb-run-form">
                    <span className="sr-only">出題の形</span>
                    <select value={want}
                            onChange={(e) => {
                              setWant(e.target.value); setShown(false); setJudged(null)
                            }}>
                      <option value="auto">おまかせ</option>
                      {QUIZ_FORMS.map((f) => (
                        <option key={f.id} value={f.id}>{f.label}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="wb-run-bar" role="presentation">
                  {Array.from({ length: total }, (unused, i) => (
                    <span key={i} className={i < done ? 'is-done' : i === done ? 'is-now' : ''} />
                  ))}
                </div>
              </div>
            )
          })()}

          <div className="wordcard">

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
                    <SpeakButton text={word} className="etext-listen" />
                  </>
                )}
            </div>

            {/* **種類と品詞は、さりげなく**(2026-08 利用者の指定)。
                  > 言い回し、コロケーション、単語、イディオム などの
                  > カテゴリ表示はさりげなくオシャレに。
                  > あと品詞の表示も欲しいね

                塗りつぶした札にすると、語より目立ってしまう。
                **細い字と中黒だけ**で並べる。

                **控えにあるのは `word` か `phrase` の2つだけ。**
                コロケーションとイディオムは、いまのデータでは見分けられない
                (どちらも `phrase` として入る)。
                **あやふやなことを言わない**(CLAUDE.md)ので、
                見分けられるようになるまでは「言い回し」とだけ書く。 */}
            <p className="wordcard-tags">
              <span className="wc-tag">{card.kind === 'phrase' ? '言い回し' : '単語'}</span>
              {card.pos && <span className="wc-tag wc-tag--pos">{card.pos}</span>}
            </p>

            {/* 出会った文。訳なしで先に出す。日本語→英語のときは答えを伏せる。

                **畳んでおく**(2026-08 利用者の指定)。長い文が開いたままだと、
                答えの4択が画面の外へ出る。

                **Listen は文の横に置かない。**
                  > 例文の横のlistenのせいで例文の折り返しがかなり
                  > 窮屈になってしまってます。
                横に置くとスマホで文の幅が半分になり、1行3語ほどで折り返す。
                開け閉めの行へ移し、**文には幅をぜんぶ渡す。** */}
            {card.seen_in && (
              <div className="wordcard-seenbox">
                <div className="wordcard-seenbar">
                  <button type="button" className="btn btn--ghost btn--small"
                          aria-expanded={seenOpen}
                          onClick={() => setSeenOpen((v) => !v)}>
                    {seenOpen ? '▾ 出会った文' : '▸ 出会った文'}
                  </button>
                  {/* 答えが聞こえてしまう形では、出す前に鳴らさない */}
                  {seenOpen && ((form !== 'ja2en' && form !== 'spell') || shown) && (
                    <SpeakButton text={card.seen_in} className="etext-listen" />
                  )}
                </div>
                {seenOpen && (
                  <SeenIn sentence={card.seen_in} word={word}
                          hide={(form === 'ja2en' || form === 'spell') && !shown} />
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
                {/* **答えは3つ**(2026-08 利用者の指定・0027)。
                    まだ / 覚えかけ / 覚えた。
                    「覚えかけ」は**思い出せたが自信がない**とき。
                    箱を 3 で止めるので、必ず4日以内に戻ってくる。
                    **3つはとなりどうしに置く**(CLAUDE.md)。
                    「意味を見る」は答えではないので1段上にある */}
                <div className="wordcard-answers">
                  <button type="button" className="btn btn--quiet"
                          disabled={busy === card.word_norm}
                          onClick={() => answer(card, 'unknown')}>まだ</button>
                  <button type="button" className="btn btn--half"
                          disabled={busy === card.word_norm}
                          onClick={() => answer(card, 'learning')}>覚えかけ</button>
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
