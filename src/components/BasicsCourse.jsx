import { useEffect, useMemo, useRef, useState } from 'react'
import SpeakButton from './SpeakButton.jsx'
import { COURSE_TIERS, tierForLevel, tierOf } from '../data/basicsCourse.js'
import {
  courseList, courseRatio, dayPairs, nextDay, wordsForDay,
} from '../lib/basicsCourse.js'
import {
  courseSupported, loadCourseDays, markCourseDay, unmarkCourseDay,
} from '../lib/courseDays.js'
import { lookupWord, normWord, setWordStatus } from '../lib/vocab.js'
import { weaknessTags } from '../data/weaknessTags.js'

/**
 * 文法30日集中講座 + 基礎単語(2026-09 利用者の指定)。
 *
 *   > pre basic と basic に基礎単語習得モードとか文法30日集中講座などが
 *   > 欲しい。日本ではいわゆる中学英語と呼ばれるものだ。
 *   > ただ網羅するのではなく、単語と基礎的な文法の仕組みを
 *   > 楽しんで身に付けられるコースにして欲しい。
 *
 * 【新しい練習を作らない】(CLAUDE.md)
 *   読み上げは `SpeakButton`、語は単語帳(`setWordStatus`)。
 *   **この講座のためだけの仕組みは1つも作っていない。**
 *   だから講座で入れた語も、ふだんの単語帳とまったく同じように
 *   間隔をあけて出てくる(0015〜0039)。
 *
 * 【ゲスト専用】(利用者が選んだ)
 *   トレーナーの画面には出さない。
 *
 * 【0052 を貼る前でも壊れない】
 *   進み具合が残らないだけで、**30日の中身も、語も、読み上げも動く。**
 *   一度断られたら `courseSupported()` が偽になり、二度と呼びに行かない。
 */
export default function BasicsCourse({ me = null }) {
  const level = me?.level ?? me?.cefr ?? null
  /** どちらの段か。**レベルから初めの1つを選ぶだけ**で、いつでも切り替えられる */
  const [tier, setTier] = useState(() => tierForLevel(level))
  const [done, setDone] = useState([])
  const [openDay, setOpenDay] = useState(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState(null)
  /** 単語帳へ入れ終わった語(この画面のあいだだけ覚える) */
  const [added, setAdded] = useState(() => new Set())
  const stop = useRef(false)

  useEffect(() => {
    let alive = true
    setDone([])
    loadCourseDays(tier, null).then(({ data }) => { if (alive) setDone(data ?? []) })
    return () => { alive = false }
  }, [tier, me?.id])

  // 画面から離れたら、まとめて入れるのをやめる(**止まる条件を持たせる**)
  useEffect(() => () => { stop.current = true }, [])

  const days = useMemo(() => courseList(done), [done])
  const next = nextDay(done)
  const ratio = courseRatio(done)
  const tierInfo = tierOf(tier)

  const open = days.find((d) => d.no === openDay) ?? null
  const words = open ? wordsForDay(open.no, tier) : []
  const pairs = open ? dayPairs(open.no) : []

  /** つまずいたときの弱点タグ(名前だけ出す)。**ゲストは教材を作れない** */
  const tagLabels = (open?.tagIds ?? [])
    .map((id) => weaknessTags.find((t) => t.id === id)?.label)
    .filter(Boolean)

  /** その日を終えた / 戻す */
  const toggleDone = async (no, isDone) => {
    setNote(null)
    const run = isDone ? unmarkCourseDay : markCourseDay
    const { error } = await run(tier, no, me?.id ?? null)
    if (error) { setNote({ ng: true, text: error }); return }
    setDone((v) => (isDone ? v.filter((x) => x !== no) : [...new Set([...v, no])]))
  }

  /**
   * 語を単語帳へ入れる。**`WordbookAdd` とまったく同じ道**
   * (`lookupWord` → `setWordStatus`)。
   *
   * **意味は入れるときに1回だけ引く。** 単語帳の画面は控えを読むだけで
   * AI に尋ね直さないので、引かずに入れると
   * 「意味の控えがありません」のまま残る。
   */
  const addWord = async (row) => {
    const norm = normWord(row.w)
    if (!norm || added.has(norm)) return true
    await lookupWord({ word: row.w, sentence: '', level: level || 'A1' })
    const { error } = await setWordStatus(row.w, 'unknown', {
      kind: row.w.includes(' ') ? 'phrase' : 'word',
      learnerId: me?.id ?? null,
    })
    if (error) { setNote({ ng: true, text: error }); return false }
    setAdded((v) => new Set(v).add(norm))
    return true
  }

  /**
   * その日の語を、まとめて単語帳へ。
   *
   * **押す前に、何語で、いくらかかるかを出す**(見えない費用は管理できない)。
   * **1語ずつ順に入れる**(まとめて投げると、いくらかかったのか
   * 分からないうちに終わる)。**やめる**を押したら、そこで止まる。
   */
  const addAll = async () => {
    stop.current = false
    setBusy(true)
    setNote(null)
    let n = 0
    for (const row of words) {
      if (stop.current) break
      const okAdd = await addWord(row)
      if (!okAdd) break
      n += 1
      setNote({ text: `単語帳に入れています… ${n} / ${words.length} 語` })
    }
    setBusy(false)
    setNote({ text: `${n} 語を単語帳に入れました。ふだんの単語帳に出てきます。` })
  }

  return (
    <section className="stack">
      {/* ── どちらの段か ────────────────────────────────
          **基本360語 は 1200 の一部。** 別の一覧を持たない */}
      <div className="card course-head">
        <div className="chiprow" role="group" aria-label="コースの段">
          {COURSE_TIERS.map((t) => (
            <button key={t.id} type="button"
                    className={`chip${t.id === tier ? ' chip--on' : ''}`}
                    aria-pressed={t.id === tier}
                    onClick={() => { setTier(t.id); setOpenDay(null) }}>
              {t.label}
              <span className="chip-count">{t.ja}</span>
            </button>
          ))}
        </div>
        <p className="course-hint">{tierInfo.hint}</p>

        {/* 進み具合。**数も必ず添える**(色だけに頼らない) */}
        <div className="course-bar" aria-hidden="true">
          <span style={{ width: `${Math.round(ratio * 100)}%` }} />
        </div>
        <p className="course-count">
          <strong>{done.length}</strong> / 30 日
          {next == null
            ? 'すべて終わりました。おつかれさまでした。'
            : ` — 次は ${next} 日目です`}
        </p>
        {!courseSupported() && (
          /* **黙って落とさない。** ゲストにできることは無いので、
             仕組みの内側の話にはしない(CLAUDE.md) */
          <p className="muted course-nosave">
            いまは進み具合が残りません(トレーナーの設定待ちです)。
            中身と単語はそのまま使えます。
          </p>
        )}
      </div>

      {/* ── 30日の一覧 ─────────────────────────────── */}
      <ol className="course-list">
        {days.map((d) => (
          <li key={d.no} className={`card course-day${d.done ? ' is-done' : ''}`}>
            <button type="button" className="course-open"
                    aria-expanded={openDay === d.no}
                    onClick={() => setOpenDay(openDay === d.no ? null : d.no)}>
              <span className="course-no">{d.no}</span>
              <span className="course-title">
                {d.title}
                <span className="course-aim">{d.aim}</span>
              </span>
              {/* 終えた印は、色だけに頼らない */}
              {d.done && <span className="course-done">済</span>}
              <span className="course-mark" aria-hidden="true">{openDay === d.no ? '▾' : '▸'}</span>
            </button>

            {openDay === d.no && (
              <div className="course-body">
                {/* 仕組み。**1行に1つ**(指導ポイントと同じ作法) */}
                <ul className="course-points">
                  {d.points.map((t) => <li key={t}>{t}</li>)}
                </ul>

                {/* 例文。**訳を必ず添える**(無いものをあるように見せない) */}
                <ul className="course-ex">
                  {pairs.map((p) => (
                    <li key={p.key}>
                      <span className="course-en" lang="en">{p.en}</span>
                      <SpeakButton text={p.en} />
                      <span className="course-ja">{p.ja}</span>
                    </li>
                  ))}
                </ul>

                {/* その日の語 */}
                <p className="field-label course-wordhead">
                  この日の語 {words.length} 語
                </p>
                <ul className="course-words">
                  {words.map((row) => {
                    const inBook = added.has(normWord(row.w))
                    return (
                      <li key={row.w}>
                        <span className="course-w" lang="en">{row.w}</span>
                        <span className="course-wja">{row.ja}</span>
                        <SpeakButton text={row.w} />
                        <button type="button"
                                className="btn btn--small btn--ghost"
                                disabled={inBook || busy}
                                onClick={() => addWord(row)}>
                          {inBook ? '入れました' : '単語帳へ'}
                        </button>
                      </li>
                    )
                  })}
                </ul>

                <div className="btn-row">
                  {/* **押す前に、何語かを出す**(見えない費用は管理できない) */}
                  <button type="button" className="btn btn--small"
                          disabled={busy} onClick={addAll}>
                    {busy ? '入れています…' : `この日の ${words.length} 語をまとめて単語帳へ`}
                  </button>
                  {busy && (
                    <button type="button" className="btn btn--small btn--quiet"
                            onClick={() => { stop.current = true }}>
                      やめる
                    </button>
                  )}
                </div>

                {/* つまずいたときの行き先。**ゲストは教材を作れない**ので、
                    ここでは弱点の名前を伝えるだけにする(効かない操作を見せない) */}
                {tagLabels.length > 0 && (
                  <p className="course-weak">
                    うまく言えなかったら、トレーナーに
                    <strong>「{tagLabels.join(' / ')}」</strong>
                    が苦手だと伝えてください。その弱点で教材を作ってもらえます。
                  </p>
                )}

                <div className="btn-row">
                  <button type="button"
                          className={`btn btn--small${d.done ? ' btn--quiet' : ' btn--primary'}`}
                          onClick={() => toggleDone(d.no, d.done)}>
                    {d.done ? 'まだにする' : 'この日を終えた'}
                  </button>
                </div>

                {note && (
                  <p className={note.ng ? 'notice notice--warn' : 'muted'}>{note.text}</p>
                )}
              </div>
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}
