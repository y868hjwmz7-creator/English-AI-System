import { useEffect, useMemo, useState } from 'react'
import {
  SHELF_GROUPS, WORDS_PER_SCENE, shelfJobs, shelfLabel, shelfList, shelfScenes, shelfTarget,
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
 *   一度に作らず、**1つの場面ずつ**作って目を通す。
 *   悪い教材1つが1,500人に届くのと同じで、**棚もスクール全体で共有する**
 *   ので、発行前の確認を省かない(CLAUDE.md 冒頭)。
 *
 * 【押す前に、語数と金額を出す】
 *
 *   **見えない費用は管理できない**(CLAUDE.md)。
 *   1場面(12語)でおよそ 3〜5 円である。
 *
 * 【入れる前に、必ず一覧で見せる】
 *
 *   作っただけでは棚に入らない。**目を通して「入れる」を押すまで**、
 *   どこにも保存されない。要らない語はその場で外せる。
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
  /** 作ったばかりの語(**まだ棚に入っていない**) */
  const [draft, setDraft] = useState(null)
  const [cost, setCost] = useState(0)

  const stale = genGatewayNote()

  /* 棚ごとの語数。**どの棚がまだ空なのかが、数が無いと分からない** */
  useEffect(() => {
    let alive = true
    loadShelfCounts().then(({ data }) => { if (alive) setCounts(data) })
    return () => { alive = false }
  }, [])

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

  /** その棚の場面と、いま何語あるか */
  const scenes = useMemo(() => {
    const n = new Map()
    for (const r of rows ?? []) n.set(r.scene ?? '', (n.get(r.scene ?? '') ?? 0) + 1)
    return shelfJobs(shelf).map((j) => ({ ...j, have: n.get(j.scene) ?? 0 }))
  }, [rows, shelf])

  /** 作る */
  const make = async () => {
    const job = scenes.find((s) => s.scene === scene)
    if (!job) return
    setBusy(true)
    setNote(null)
    setDraft(null)
    const { data, error } = await generateShelfWords({
      industry: shelfLabel(shelf),
      scene: job.label,
      sceneHint: job.hint,
      count: job.count,
      /* **すでにある語は、もう一度作らせない。**
         渡さないと、2回目にほとんど同じ語が返る */
      have: (rows ?? []).map((r) => r.word_norm),
    })
    setBusy(false)
    if (error) { setNote({ ng: true, text: error }); return }
    setDraft(data.words.map((w) => ({ ...w, keep: true })))
    setCost(estimateCost(data.usage))
    /* **成功と失敗を、同じ見た目で終わらせない**(CLAUDE.md)。
       何ができたのかを、押した場所のすぐ下に出す */
    setNote({
      text: `${data.words.length} 件できました`
        + (data.dropped ? `(形の合わない ${data.dropped} 件は落としました)` : '')
        + `。目を通して「この単語帳に入れる」を押してください。`,
    })
  }

  /** 棚に入れる */
  const put = async () => {
    const keep = (draft ?? []).filter((w) => w.keep)
    if (!keep.length) return
    setBusy(true)
    const { data, error } = await saveShelfWords(shelf, keep.map((w) => ({
      word: w.en, ja: w.ja, pos: w.pos, level: w.level,
      en: w.ex_en, enJa: w.ex_ja, scene,
    })))
    setBusy(false)
    if (error) { setNote({ ng: true, text: error.message ?? String(error) }); return }
    setDraft(null)
    setNote({ text: `${data} 語を「${sceneLabel(scene)}」に入れました。` })
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
        <select className="input" value={shelf} onChange={(e) => setShelf(e.target.value)}>
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
          {/* ── 場面を1つ選んで作る ────────────────────────── */}
          <label className="field">
            <span className="field-label">場面</span>
            <select className="input" value={scene}
                    onChange={(e) => { setScene(e.target.value); setDraft(null); setNote(null) }}>
              <option value="">選んでください</option>
              {scenes.map((s) => (
                <option key={s.scene} value={s.scene}>
                  {s.label}({s.have} 語)
                </option>
              ))}
            </select>
          </label>

          {scene && (
            <>
              <p className="card-hint">
                この場面の語句を <strong>{WORDS_PER_SCENE} 件</strong>作ります。
                すでにある語は渡してあるので、同じ語は返りません。
                <strong> AI を1回呼ぶので、およそ $0.02〜0.05 かかります。</strong>
                作っただけでは<strong>まだ入りません</strong> ——
                目を通してから入れます。
              </p>
              <div className="btn-row">
                <button type="button" className="btn btn--primary"
                        disabled={busy || !shelfWordsSupported()} onClick={make}>
                  <PlusIcon />
                  {busy ? '作っています…' : 'この場面の語句を作る'}
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
              <ul className="shelfbuild-list">
                {draft.map((w, i) => (
                  <li key={`${w.en}:${i}`} className={w.keep ? '' : 'is-off'}>
                    <label className="shelfbuild-keep">
                      <input type="checkbox" checked={w.keep}
                             onChange={() => setDraft((v) => v.map((x, j) => (
                               j === i ? { ...x, keep: !x.keep } : x
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
                        disabled={busy || !draft.some((w) => w.keep)} onClick={put}>
                  この単語帳に入れる({draft.filter((w) => w.keep).length} 語)
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
