import { useEffect, useMemo, useRef, useState } from 'react'
import {
  SCENE_COST, SHELF_GROUPS, WORDS_PER_SCENE,
  shelfJobs, shelfLabel, shelfList, shelfScenes, shelfTarget, shelfTodo,
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
 *   35冊 × 平均 6.3 場面 = **約 220 の場面**がある。
 *
 * 【**一回一回は押させない**】(2026-09 利用者の問い)
 *
 *   > 一回一回単語を作るのですか？
 *
 *   出したときは**場面を1つ選んで1回押す**形だったので、
 *   そのとおり**約 220 回**押すことになっていた。
 *   いまは **「この単語帳をぜんぶ作る」** で、
 *   **その棚の足りない場面を、上から順に1つずつ**作る。
 *
 *   - **1つずつしか走らせない**(`startPrepareAll` と同じ作法)。
 *     まとめて投げると、いくらかかったのか分からないうちに終わる
 *   - **あと何場面かを、いつも出す。**「やめる」はそのとなりに置く
 *   - **やめても、そこまでに作ったぶんは残る**(行き止まりを作らない)
 *   - **場面を1つずつ作る道も、そのまま残してある**(消さない)
 *
 * 【押す前に、語数と金額を出す】
 *
 *   **見えない費用は管理できない**(CLAUDE.md)。
 *   1場面(12語)でおよそ $0.02〜0.05、1冊ぶんならその場面数ぶんである。
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
  const [scene, setScene] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState(null)
  /**
   * 作ったばかりの語(**まだ棚に入っていない**)。
   * `[{ scene, label, words: [{ …, keep }] }]` —— **場面ごとにまとめる。**
   * まとめて作ると場面をまたぐので、どの語がどの場面のものかを持っておく。
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
    setScene('')
    setDraft(null)
    setNote(null)
    loadShelfWords(shelf).then(({ data }) => { if (alive) setRows(data ?? []) })
    return () => { alive = false }
  }, [shelf])

  /** 場面ごとに、いま何語あるか */
  const have = useMemo(() => {
    const n = new Map()
    for (const r of rows ?? []) n.set(r.scene ?? '', (n.get(r.scene ?? '') ?? 0) + 1)
    return n
  }, [rows])

  /** その棚の場面ぜんぶ(プルダウン用) */
  const scenes = useMemo(
    () => shelfJobs(shelf).map((j) => ({ ...j, have: have.get(j.scene) ?? 0 })),
    [have, shelf],
  )

  /**
   * **まだ足りない場面だけ。** 判断は `shelfTodo()` 1か所で、
   * 画面では数え直さない(**数え方を2通り持たない**)。
   */
  const todo = useMemo(() => shelfTodo(shelf, have), [have, shelf])
  const todoWords = todo.reduce((n, j) => n + j.count, 0)

  /**
   * 場面の一覧を、**上から順に1つずつ**作る。
   *
   * 場面が1つだけのときも、まとめて作るときも、**同じ道を通る** ——
   * 書き分けると、片方だけ古くなる。
   */
  const runJobs = async (jobs) => {
    if (!jobs.length) return
    stop.current = false
    setBusy(true)
    setNote(null)
    setDraft(null)
    setCost(0)
    setRun({ at: 0, total: jobs.length, label: jobs[0].label, startedAt: Date.now() })

    /* **すでにある語は、もう一度作らせない。** 渡さないと、
       2回目にほとんど同じ語が返る。**まとめて作るときは、
       この回で作った語も足していく**(場面をまたいで重ならないように) */
    const known = new Set((rows ?? []).map((r) => r.word_norm))
    const groups = []
    let spent = 0
    let failed = null

    for (let i = 0; i < jobs.length; i += 1) {
      if (stop.current) break
      const j = jobs[i]
      setRun((v) => (v ? { ...v, at: i, label: j.label } : v))
      /* **1つずつしか走らせない。** まとめて投げると、
         いくらかかったのか分からないうちに終わる */
      const { data, error } = await generateShelfWords({
        industry: shelfLabel(shelf),
        scene: j.label,
        sceneHint: j.hint,
        count: j.count,
        have: [...known],
      })
      if (error) { failed = { label: j.label, text: error }; break }
      spent += estimateCost(data.usage)
      const words = (data.words ?? []).map((w) => ({ ...w, keep: true }))
      for (const w of words) known.add(String(w.en ?? '').trim().toLowerCase())
      groups.push({ scene: j.scene, label: j.label, words })
      setDraft(groups.map((g) => ({ ...g, words: [...g.words] })))
      setCost(spent)
    }

    setRun(null)
    setBusy(false)

    const made = groups.reduce((n, g) => n + g.words.length, 0)
    /* **成功と失敗を、同じ見た目で終わらせない**(CLAUDE.md)。
       何ができたのかを、押した場所のすぐ下に出す */
    if (failed) {
      setNote({
        ng: true,
        text: `「${failed.label}」でつまずきました — ${failed.text}`
          + (made ? `(ここまでの ${made} 語は下に残してあります)` : ''),
      })
      return
    }
    if (stop.current) {
      setNote({
        text: made
          ? `やめました。ここまでの ${made} 語は下に残してあります。`
          : 'やめました。',
      })
      return
    }
    setNote({
      text: `${groups.length} 場面 / ${made} 件できました。`
        + '目を通して「この単語帳に入れる」を押してください。',
    })
  }

  /** 場面を1つだけ作る(これまでどおりの道。**消していない**) */
  const make = () => {
    const job = scenes.find((s) => s.scene === scene)
    if (job) runJobs([job])
  }

  /** その棚の足りない場面を、まとめて作る */
  const makeAll = () => { runJobs(todo) }

  /** 棚に入れる。**場面をまたいでいても、1回で置く** */
  const put = async () => {
    const keep = []
    for (const g of draft ?? []) {
      for (const w of g.words) {
        if (!w.keep) continue
        keep.push({
          word: w.en, ja: w.ja, pos: w.pos, level: w.level,
          en: w.ex_en, enJa: w.ex_ja, scene: g.scene,
        })
      }
    }
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

  const keeping = (draft ?? []).reduce(
    (n, g) => n + g.words.filter((w) => w.keep).length, 0,
  )

  return (
    <section className="card shelfbuild">
      <h2 className="card-title"><ShelfIcon /> 業種べつの単語帳</h2>
      <p className="card-hint">
        業種・趣味ごとに1冊ずつあります(全 {shelves.length} 冊)。
        ここで作った語句は<strong>ゲストの単語帳には混ざりません</strong> ——
        ゲストが「自分の単語帳に追加する」を押したものだけが入ります。
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
          この単語帳の場面は {shelfScenes(shelf).length} 件、
          ぜんぶ作るとおよそ {shelfTarget(shelf)} 語になります
          (1場面 {WORDS_PER_SCENE} 語)。
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
                まだ足りない場面が <strong>{todo.length} 件</strong>あります。
                上から順に、あわせて <strong>{todoWords} 語</strong>を作ります。
                <strong>
                  {' '}AI を {todo.length} 回呼ぶので、およそ $
                  {(todo.length * SCENE_COST.min).toFixed(2)}〜$
                  {(todo.length * SCENE_COST.max).toFixed(2)} かかります。
                </strong>
                {' '}作っただけでは<strong>まだ入りません</strong> ——
                目を通してから入れます。
                作っているあいだは、この画面を開いたままにしてください。
              </p>
              <div className="btn-row">
                <button type="button" className="btn btn--primary"
                        disabled={busy || !shelfWordsSupported()} onClick={makeAll}>
                  <PlusIcon />
                  この単語帳をぜんぶ作る({todo.length} 場面)
                </button>
              </div>
            </div>
          )}

          {/* ── 走っているあいだ ──────────────────────────
              **あと何場面かを出し、「やめる」をそのとなりに置く** */}
          {run && (
            <div className="shelfbuild-run">
              <p className="muted">
                {run.at + 1} / {run.total} 場面 —— 「{run.label}」を作っています…
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

          {/* ── ②場面を1つだけ作る(**この道も残す**)────────── */}
          <label className="field">
            <span className="field-label">場面(1つだけ作るとき)</span>
            <select className="input" value={scene} disabled={busy}
                    onChange={(e) => { setScene(e.target.value); setDraft(null); setNote(null) }}>
              <option value="">選んでください</option>
              {scenes.map((s) => (
                <option key={s.scene} value={s.scene}>
                  {s.label}({s.have} 語)
                </option>
              ))}
            </select>
          </label>

          {scene && !run && (
            <>
              <p className="card-hint">
                この場面の語句を <strong>{WORDS_PER_SCENE} 件</strong>作ります。
                すでにある語は渡してあるので、同じ語は返りません。
                <strong> AI を1回呼ぶので、およそ $0.02〜0.05 かかります。</strong>
              </p>
              <div className="btn-row">
                <button type="button" className="btn btn--ghost"
                        disabled={busy || !shelfWordsSupported()} onClick={make}>
                  この場面の語句を作る
                </button>
              </div>
            </>
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
                できた語句(この生成にかかった費用 約 ${cost.toFixed(2)})
              </p>
              {draft.map((g, gi) => (
                <div key={g.scene}>
                  {/* **どの場面のものかを、必ず書く。** まとめて作ると
                      場面をまたぐので、書かないとどこへ入るのか分からない */}
                  <p className="shelfbuild-group">
                    {g.label}({g.words.length} 件)
                  </p>
                  <ul className="shelfbuild-list">
                    {g.words.map((w, i) => (
                      <li key={`${w.en}:${i}`} className={w.keep ? '' : 'is-off'}>
                        <label className="shelfbuild-keep">
                          <input type="checkbox" checked={w.keep}
                                 onChange={() => setDraft((v) => v.map((x, j) => (
                                   j === gi
                                     ? {
                                       ...x,
                                       words: x.words.map((y, k) => (
                                         k === i ? { ...y, keep: !y.keep } : y
                                       )),
                                     }
                                     : x
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
                </div>
              ))}
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
                {rows
                  .filter((r) => !scene || (r.scene ?? '') === scene)
                  .map((r) => (
                    <li key={r.word_norm}>
                      <strong>{r.display || r.word_norm}</strong>
                      <span className="shelfbuild-ja">{r.meaning_ja}</span>
                      <span className="shelfbuild-meta">
                        {r.pos} / {r.level} / {sceneLabel(r.scene)}
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
