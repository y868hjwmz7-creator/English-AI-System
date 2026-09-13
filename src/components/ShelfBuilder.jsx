import { useEffect, useMemo, useRef, useState } from 'react'
import {
  JOB_COST, SHELF_GROUPS, WORDS_PER_JOB,
  shelfLabel, shelfList, shelfSceneNames, shelfTarget, shelfTodo,
} from '../data/shelves.js'
import { sceneLabel } from '../data/genres.js'
import {
  dropShelfWord, loadShelfCounts, loadShelfWords, saveShelfWords, shelfWordsSupported,
} from '../lib/shelfWords.js'
import { estimateCost, genGatewayNote, generateShelfWords } from '../lib/materials.js'
import { PlusIcon, ShelfIcon } from './Icons.jsx'

/**
 * **業種べつの単語帳(棚)を作る**(0057・2026-09 利用者の指定)。
 *
 * ============================================================================
 * 【トレーナーだけの画面】
 *
 *   > 作りたい単語帳は、すべての業界、趣味について、すべての
 *   > シチュエーションと場面を想定したものを。
 *
 * 【**場面べつは、やめた**】(2026-09 利用者の指定)
 *
 *   > 場面別はやめましょう。細かすぎる。35冊、これだけにしましょう。
 *
 *   出したときは**場面を1つ選んで1回押す**形だったので、
 *   **883 回**押すことになっていた。まとめて作れるようにはしたが、
 *   **区切りそのものが細かすぎた。**
 *
 *   いまは **1冊 200 語**で、**20 語ずつ 10 回**に割って作る。
 *   場面は**窓口へまとめて渡すだけ**(偏らせないための手がかり)。
 *
 *   - **1つずつしか走らせない**(`startPrepareAll` と同じ作法)。
 *     まとめて投げると、いくらかかったのか分からないうちに終わる
 *   - **あと何回かを、いつも出す。**「やめる」はそのとなりに置く
 *   - **やめても、そこまでに作ったぶんは残る**(行き止まりを作らない)
 *   - **20 語だけ作る道も残してある。** いきなり 10 回まわす前に、
 *     出来ばえを1回ぶんだけ見られるようにする
 *
 * 【押す前に、語数と金額を出す】
 *
 *   **見えない費用は管理できない**(CLAUDE.md)。
 *   1回(20語)でおよそ $0.03〜0.06、1冊ぶん(10回)で $0.3〜0.6 である。
 *
 * 【入れる前に、必ず一覧で見せる】
 *
 *   **まとめて作っても、ここは変えない。** 作っただけでは棚に入らない。
 *   目を通して「入れる」を押すまで、どこにも保存されない。
 *   棚は**スクール全体で共有する**ので、発行前の確認を省かない
 *   (CLAUDE.md 冒頭「悪い教材1つが1,500人に届く」)。
 *
 * 【0057 を貼る前でも壊れない】
 *
 *   一度断られたら `shelfWordsSupported()` が偽になり、
 *   **そのあとは呼びに行かない。**
 */
export default function ShelfBuilder() {
  const shelves = useMemo(() => shelfList(), [])
  const [shelf, setShelf] = useState('')
  const [counts, setCounts] = useState(null)     // null = 数えられなかった
  const [rows, setRows] = useState(null)         // null = まだ読んでいない
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState(null)
  /**
   * 作ったばかりの語(**まだ棚に入っていない**)。
   * `[{ …, keep }]` —— **1冊ぶんを1つの並びで持つ。**
   * 場面べつをやめたので、まとめる単位そのものが無くなった。
   */
  const [draft, setDraft] = useState(null)
  const [cost, setCost] = useState(0)
  /** まとめて作っているあいだの様子(`{ at, total, label, startedAt }`) */
  const [run, setRun] = useState(null)
  const [secs, setSecs] = useState(0)
  /** 「やめる」の印。**通信そのものは取り消さない**(送った1回は課金される) */
  const stop = useRef(false)

  const stale = genGatewayNote()

  /* 棚ごとの語数。**どの棚がまだ空なのかが、数が無いと分からない** */
  useEffect(() => {
    let alive = true
    loadShelfCounts().then(({ data }) => { if (alive) setCounts(data) })
    return () => { alive = false }
  }, [])

  /* 経過秒数。**走っているあいだだけ数える**(`useJob()` と同じ作法) */
  const running = !!run
  const startedAt = run?.startedAt ?? 0
  useEffect(() => {
    if (!running) { setSecs(0); return undefined }
    const tick = () => setSecs(Math.max(0, Math.round((Date.now() - startedAt) / 1000)))
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [running, startedAt])

  const reload = async (id) => {
    const { data } = await loadShelfWords(id)
    setRows(data ?? [])
  }

  useEffect(() => {
    let alive = true
    if (!shelf) { setRows(null); return () => { alive = false } }
    setRows(null)
    setDraft(null)
    setNote(null)
    loadShelfWords(shelf).then(({ data }) => { if (alive) setRows(data ?? []) })
    return () => { alive = false }
  }, [shelf])

  /** いま何語あるか。**場面ごとには数えない**(場面べつはやめた) */
  const have = rows?.length ?? 0

  /**
   * **まだ足りないぶんだけ。** 判断は `shelfTodo()` 1か所で、
   * 画面では数え直さない(**数え方を2通り持たない**)。
   */
  const todo = useMemo(() => shelfTodo(shelf, have), [have, shelf])
  const todoWords = todo.reduce((n, j) => n + j.count, 0)

  /**
   * **上から順に1回ずつ**作る。
   *
   * 1回だけのときも、1冊ぶんまとめるときも、**同じ道を通る** ——
   * 書き分けると、片方だけ古くなる。
   */
  const runJobs = async (jobs) => {
    if (!jobs.length) return
    stop.current = false
    setBusy(true)
    setNote(null)
    setDraft(null)
    setCost(0)
    setRun({ at: 0, total: jobs.length, from: jobs[0].from, to: jobs[0].to,
      startedAt: Date.now() })

    /* **すでにある語は、もう一度作らせない。** 渡さないと、
       2回目にほとんど同じ語が返る。**この回で作った語も足していく**
       (回をまたいで重ならないように) */
    const known = new Set((rows ?? []).map((r) => r.word_norm))
    /* **場面は、まとめて手がかりとして渡す。** 区切りではない ——
       これが無いと、200 語がどれも「会議」まわりに寄る */
    const scenes = shelfSceneNames(shelf)
    const made = []
    let spent = 0
    let failed = null

    for (let i = 0; i < jobs.length; i += 1) {
      if (stop.current) break
      const j = jobs[i]
      setRun((v) => (v ? { ...v, at: i, from: j.from, to: j.to } : v))
      /* **1つずつしか走らせない。** まとめて投げると、
         いくらかかったのか分からないうちに終わる */
      const { data, error } = await generateShelfWords({
        industry: shelfLabel(shelf),
        scenes,
        count: j.count,
        have: [...known],
      })
      if (error) { failed = { at: i + 1, text: error }; break }
      spent += estimateCost(data.usage)
      for (const w of data.words ?? []) {
        made.push({ ...w, keep: true })
        known.add(String(w.en ?? '').trim().toLowerCase())
      }
      setDraft([...made])
      setCost(spent)
    }

    setRun(null)
    setBusy(false)

    /* **成功と失敗を、同じ見た目で終わらせない**(CLAUDE.md)。
       何ができたのかを、押した場所のすぐ下に出す */
    if (failed) {
      setNote({
        ng: true,
        text: `${failed.at} 回目でつまずきました — ${failed.text}`
          + (made.length ? `(ここまでの ${made.length} 語は下に残してあります)` : ''),
      })
      return
    }
    if (stop.current) {
      setNote({
        text: made.length
          ? `やめました。ここまでの ${made.length} 語は下に残してあります。`
          : 'やめました。',
      })
      return
    }
    setNote({
      text: `${made.length} 件できました。`
        + '目を通して「この単語帳に入れる」を押してください。',
    })
  }

  /** まず 20 語だけ作る(**いきなり 10 回まわす前に、1回ぶんを見る**) */
  const makeOne = () => { runJobs(todo.slice(0, 1)) }

  /** その棚の足りないぶんを、まとめて作る */
  const makeAll = () => { runJobs(todo) }

  /** 棚に入れる。**1回で置く** */
  const put = async () => {
    const keep = (draft ?? []).filter((w) => w.keep).map((w) => ({
      word: w.en, ja: w.ja, pos: w.pos, level: w.level,
      en: w.ex_en, enJa: w.ex_ja,
    }))
    if (!keep.length) return
    setBusy(true)
    const { data, error } = await saveShelfWords(shelf, keep)
    setBusy(false)
    if (error) { setNote({ ng: true, text: error.message ?? String(error) }); return }
    setDraft(null)
    setNote({ text: `${data} 語を「${shelfLabel(shelf)}」に入れました。` })
    await reload(shelf)
    const { data: c } = await loadShelfCounts()
    setCounts(c)
  }

  const drop = async (word) => {
    setBusy(true)
    const { error } = await dropShelfWord(shelf, word)
    setBusy(false)
    if (error) { setNote({ ng: true, text: error.message ?? String(error) }); return }
    await reload(shelf)
  }

  const keeping = (draft ?? []).filter((w) => w.keep).length

  return (
    <section className="card shelfbuild">
      <h2 className="card-title"><ShelfIcon /> 業種べつの単語帳</h2>
      <p className="card-hint">
        業種・趣味ごとに1冊ずつあります(全 {shelves.length} 冊)。
        ここで作った語句は<strong>ゲストの単語帳には混ざりません</strong> ——
        独立した単語帳として、そのまま練習できます(0058)。
      </p>

      {stale && <p className="notice notice--warn">{stale}</p>}
      {!shelfWordsSupported() && (
        <p className="notice notice--warn">
          業種べつの単語帳(0057)が、まだ Supabase にありません。
          GitHub のリポジトリにあるファイル(supabase/apply/pending_matome.sql)を、
          Supabase の 左メニュー「SQL Editor」で実行してください。
        </p>
      )}

      <label className="field">
        <span className="field-label">単語帳</span>
        <select className="input" value={shelf} disabled={busy}
                onChange={(e) => setShelf(e.target.value)}>
          <option value="">選んでください</option>
          {SHELF_GROUPS.map((g) => (
            <optgroup key={g.id} label={g.label}>
              {shelves.filter((s) => s.group === g.id).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                  {/* **数えられなかったら出さない。** 0 と取り違えると
                      「まだ1語もありません」という嘘になる */}
                  {counts ? `(${counts.get(s.id) ?? 0} 語)` : ''}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>

      {shelf && (
        <p className="card-hint">
          {/* **場面べつはやめた**(2026-09 利用者の指定)。
              どの冊も同じ語数にする —— 場面の数で決めると、
              冊ごとに桁が違うものができる */}
          この単語帳は <strong>{shelfTarget()} 語</strong>で1冊です
          (どの単語帳も同じ)。1回に {WORDS_PER_JOB} 語ずつ作ります。
        </p>
      )}

      {shelf && rows === null && <p className="muted">開いています…</p>}

      {shelf && rows !== null && (
        <>
          {/* ── ①まとめて作る ──────────────────────────────
              **一回一回押させない**(2026-09 利用者の問い) */}
          {todo.length > 0 && (
            <div className="shelfbuild-all">
              <p className="card-hint">
                いま <strong>{have} 語</strong>あります。
                あと <strong>{todoWords} 語</strong>で1冊そろいます。
                <strong>
                  {' '}AI を {todo.length} 回呼ぶので、およそ $
                  {(todo.length * JOB_COST.min).toFixed(2)}〜$
                  {(todo.length * JOB_COST.max).toFixed(2)} かかります。
                </strong>
                {' '}作っただけでは<strong>まだ入りません</strong> ——
                目を通してから入れます。
                作っているあいだは、この画面を開いたままにしてください。
              </p>
              <div className="btn-row">
                <button type="button" className="btn btn--primary"
                        disabled={busy || !shelfWordsSupported()} onClick={makeAll}>
                  <PlusIcon />
                  この単語帳をぜんぶ作る({todoWords} 語 / {todo.length} 回)
                </button>
                {/* **まず1回ぶんだけ見る道を残す**(行き止まりを作らない) */}
                <button type="button" className="btn btn--ghost"
                        disabled={busy || !shelfWordsSupported()} onClick={makeOne}>
                  まず {todo[0].count} 語だけ作る
                </button>
              </div>
            </div>
          )}

          {/* ── 走っているあいだ ──────────────────────────
              **あと何回かを出し、「やめる」をそのとなりに置く** */}
          {run && (
            <div className="shelfbuild-run">
              <p className="muted">
                {run.at + 1} / {run.total} 回 ——
                {' '}{run.from}〜{run.to} 語目を作っています…
                {secs > 2 ? `(${secs} 秒)` : ''}
              </p>
              <div className="btn-row">
                <button type="button" className="btn btn--quiet"
                        onClick={() => { stop.current = true }}>
                  {stop.current ? 'やめています…' : 'やめる'}
                </button>
              </div>
            </div>
          )}

          {note && (
            <p className={note.ng ? 'notice notice--warn' : 'muted'}>{note.text}</p>
          )}

          {/* ── できたもの。**入れる前に、必ず目を通す** ──────────── */}
          {draft && (
            <div className="shelfbuild-draft">
              <p className="field-label">
                {/* **実際にかかった額を出す**(`MaterialForm` と同じ書き方)。
                    円に直さない —— 為替をこちらで決め打ちしない */}
                できた語句 {draft.length} 件(この生成にかかった費用 約 ${cost.toFixed(2)})
              </p>
              <ul className="shelfbuild-list">
                {draft.map((w, i) => (
                  <li key={`${w.en}:${i}`} className={w.keep ? '' : 'is-off'}>
                    <label className="shelfbuild-keep">
                      <input type="checkbox" checked={w.keep}
                             onChange={() => setDraft((v) => v.map((y, k) => (
                               k === i ? { ...y, keep: !y.keep } : y
                             )))} />
                      <strong>{w.en}</strong>
                    </label>
                    <span className="shelfbuild-ja">{w.ja}</span>
                    <span className="shelfbuild-meta">{w.pos} / {w.level}</span>
                    <span className="shelfbuild-ex">{w.ex_en}</span>
                    <span className="shelfbuild-exja">{w.ex_ja}</span>
                  </li>
                ))}
              </ul>
              <div className="btn-row">
                <button type="button" className="btn btn--primary"
                        disabled={busy || !keeping} onClick={put}>
                  この単語帳に入れる({keeping} 語)
                </button>
                {/* **「やめる」を、走らせるボタンのとなりに置く**(CLAUDE.md) */}
                <button type="button" className="btn btn--quiet"
                        disabled={busy} onClick={() => { setDraft(null); setNote(null) }}>
                  やめる
                </button>
              </div>
            </div>
          )}

          {/* ── いま入っているもの ───────────────────────── */}
          {rows.length > 0 && (
            <>
              <p className="field-label">
                いま入っている語({rows.length} 語)
              </p>
              <ul className="shelfbuild-list">
                {rows.map((r) => (
                  <li key={r.word_norm}>
                    <strong>{r.display || r.word_norm}</strong>
                    <span className="shelfbuild-ja">{r.meaning_ja}</span>
                    <span className="shelfbuild-meta">
                      {r.pos} / {r.level}
                      {/* **場面べつはやめたが、前に作った語の場面は消さない**
                          (一度入れたものを勝手に減らさない・共通ルール) */}
                      {r.scene ? ` / ${sceneLabel(r.scene)}` : ''}
                    </span>
                    <span className="shelfbuild-ex">{r.example_en}</span>
                    <button type="button" className="btn btn--ghost btn--small"
                            disabled={busy} onClick={() => drop(r.word_norm)}>
                      外す
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </section>
  )
}
