import { useEffect, useMemo, useState } from 'react'
import { SHELF_GROUPS, shelfLabel, shelfScenes } from '../data/shelves.js'
import { sceneLabel } from '../data/genres.js'
import { addShelfWords, loadShelfWords, shelfWordsSupported } from '../lib/shelfWords.js'
import { BookIcon } from './Icons.jsx'

/**
 * **業種べつの単語帳(棚)から、自分の単語帳へ**(0057・2026-09 利用者の指定)。
 *
 * ============================================================================
 * 【混ざらないこと。それがこの画面の役目である】
 *
 *   > 基本は自分の単語帳、Quick Response が表示され、
 *   > 他の独立した業種や趣味別の単語帳とはそもそも混ざらないように
 *   > したいんです。「自分の単語帳に追加する」みたいのを押したものだけ
 *   > 自分の単語帳に追加されてほしいんです。
 *
 *   棚は**別の表**(`shelf_words`)にある。ここに並んでいるあいだは
 *   復習に1問も出てこない。**押して初めて `word_reviews` に入り、**
 *   そこから間隔をあけた復習(0015〜0039)が動き出す。
 *
 * 【形は `BasicWordsPick` と同じ】(CLAUDE.md「並べて置くものは、同じ形にする」)
 *
 *   畳んで置く / どれかを選ぶ / **押すのは1つだけ** /
 *   何が起きるかを押す前に1行で書く。
 *   すぐ上に基礎単語の欄が並ぶので、**別の形にしない。**
 *
 * 【場面は「絞り込み」であって、冊ではない】(利用者の指定)
 *
 *   > 単語帳は業種ごと、出し方の中に場面やシチュエーションで絞り込み
 *
 *   場面まで冊を分けると **約 1,700 冊**になる(`shelves.js` に数がある)。
 *   だから冊は業種ごとにして、場面はこの中の札で絞る。
 *
 *   **語が1つも無い場面の札は出さない。** 押しても0語になる
 *   (効かない操作を見せない・CLAUDE.md)。
 *
 * 【0057 を貼る前でも壊れない】
 *
 *   一度断られたら `shelfWordsSupported()` が偽になり、
 *   **そのあとは呼びに行かない。** 押せなくなるだけである。
 */
export default function ShelfPick({
  shelves = [], learnerId = null, learnerName = '', onPicked = null,
}) {
  /* **誰の単語帳に入るのかを、はっきり言う**(`BasicWordsPick` と同じ作法) */
  const name = String(learnerName ?? '').trim()
  const honored = /(さん|様|先生)$/.test(name) ? name : `${name} さん`
  const whose = learnerId ? `${name ? honored : 'このゲスト'}の単語帳` : '自分の単語帳'

  const [open, setOpen] = useState(false)
  const [shelf, setShelf] = useState('')
  /** 選んでいる場面(**空なら、その棚ぜんぶ**) */
  const [scenes, setScenes] = useState([])
  const [rows, setRows] = useState(null)      // null = まだ読んでいない
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState(null)

  /* **棚を選んだら、その棚だけを読む。** 35冊ぶんを先に読まない。
     絞り込みは手元で行う(単語帳の絞り込みとまったく同じ作法) */
  useEffect(() => {
    let alive = true
    if (!open || !shelf) { setRows(null); return () => { alive = false } }
    setRows(null)
    setScenes([])
    setNote(null)
    loadShelfWords(shelf).then(({ data }) => {
      if (alive) setRows(data ?? [])
    })
    return () => { alive = false }
  }, [open, shelf])

  /* **語のある場面だけ**を札にする。並びは `shelfScenes()` のまま ——
     並べ替えると、教材を作る画面と順が食い違う */
  const sceneChips = useMemo(() => {
    if (!rows?.length) return []
    const n = new Map()
    for (const r of rows) n.set(r.scene ?? '', (n.get(r.scene ?? '') ?? 0) + 1)
    const out = shelfScenes(shelf)
      .filter((s) => n.has(s.id))
      .map((s) => ({ id: s.id, label: s.label, n: n.get(s.id) }))
    /* 場面の付いていない語(古い棚・手で入れたもの)も**落とさない。**
       札には出さないが、「ぜんぶ」には必ず入る */
    return out
  }, [rows, shelf])

  /** いま入る語。**場面を選んでいなければ、その棚ぜんぶ** */
  const picked = useMemo(() => {
    if (!rows?.length) return []
    if (!scenes.length) return rows
    const want = new Set(scenes)
    return rows.filter((r) => want.has(r.scene ?? ''))
  }, [rows, scenes])

  const toggle = (id) => {
    setNote(null)
    setScenes((v) => (v.includes(id) ? v.filter((x) => x !== id) : [...v, id]))
  }

  /**
   * 棚の語を、単語帳に入れてから絞る。
   *
   * **語の一覧を窓口に渡さない**(`addShelfWords` の決まり)。
   * 棚と場面だけを渡し、どの語かは SQL が引く ——
   * 画面が作ると、**見えている語と入る語が食い違う。**
   */
  const run = async () => {
    setBusy(true)
    setNote(null)
    const { data, error } = await addShelfWords(shelf, scenes, learnerId)
    setBusy(false)
    if (error) { setNote({ ng: true, text: error.message ?? String(error) }); return }
    /* **何語「新しく」入ったのかを言う。** 0 を「失敗」と読ませない ——
       2度目に押したときは、すでに全部入っているのが正しい */
    setNote({
      text: data > 0
        ? `${data} 語を新しく入れました`
          + `(残りの ${picked.length - data} 語は、すでに入っていました)。`
        : `${picked.length} 語とも、すでに入っていました。`,
    })
    /* 絞るのは呼ぶ側(`Wordbook` → `App`)。**絞り込みを2つ持たない** */
    onPicked?.(
      picked.map((r) => r.word_norm),
      `${shelfLabel(shelf)}${scenes.length ? `(${scenes.length} 場面)` : ''}`,
      'この単語帳の語',
    )
  }

  /** **出す棚が1冊も無ければ、欄ごと出さない**(効かない操作を見せない) */
  if (!shelves.length) return null

  return (
    <div className="wb-add basicpick shelfpick">
      <button type="button" className="btn btn--ghost btn--small wb-add-open"
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}>
        <BookIcon />
        {open ? '業種べつの単語帳を閉じる' : `業種べつの単語帳(${shelves.length} 冊)`}
      </button>

      {open && (
        <div className="wb-add-body">
          {/* ── どの棚か ────────────────────────────────────
              **35冊あるので、札ではなくプルダウン。**
              お仕事 / 趣味・娯楽 に分けるのは、教材を作る画面と同じ */}
          <label className="field">
            <span className="field-label">単語帳</span>
            <select className="input" value={shelf}
                    onChange={(e) => setShelf(e.target.value)}>
              <option value="">選んでください</option>
              {SHELF_GROUPS.map((g) => {
                const list = shelves.filter((s) => s.group === g.id)
                if (!list.length) return null
                return (
                  <optgroup key={g.id} label={g.label}>
                    {list.map((s) => (
                      <option key={s.id} value={s.id}>{s.label}</option>
                    ))}
                  </optgroup>
                )
              })}
            </select>
          </label>

          {shelf && rows === null && <p className="muted">開いています…</p>}

          {shelf && rows !== null && rows.length === 0 && (
            <p className="muted">
              この単語帳は、まだ空です。
              {shelfWordsSupported()
                ? 'トレーナーが「業種べつの単語帳」の画面で作ります。'
                : '(Supabase に 0057 がまだ入っていません)'}
            </p>
          )}

          {shelf && rows !== null && rows.length > 0 && (
            <>
              {/* ── 場面でしぼる ──────────────────────────
                  **選ばなければ、その棚ぜんぶ。** 行き止まりを作らない */}
              {sceneChips.length > 0 && (
                <>
                  <p className="field-label">場面でしぼる(選ばなければ、ぜんぶ)</p>
                  <div className="chiprow" role="group" aria-label="場面でしぼる">
                    {sceneChips.map((s) => (
                      <button key={s.id} type="button"
                              className={`chip${scenes.includes(s.id) ? ' chip--on' : ''}`}
                              aria-pressed={scenes.includes(s.id)}
                              onClick={() => toggle(s.id)}>
                        {sceneLabel(s.id)}
                        <span className="chip-count">{s.n}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* **何が起きるかを、押す前に1行で書く**(CLAUDE.md)。
                  **お金はかからない**ことも、はっきり言う */}
              <p className="basicpick-lead">
                {whose}に {picked.length} 語を「まだ」として入れ、
                <strong>この {picked.length} 語だけ</strong>を練習します。
                すでに入っている語の覚え具合は<strong>1つも戻りません</strong>。
                <span className="basicpick-free">お金はかかりません。</span>
              </p>

              <div className="btn-row">
                <button type="button" className="btn btn--primary"
                        disabled={busy || !picked.length || !shelfWordsSupported()}
                        onClick={run}>
                  {/* **どちらの単語帳に入るのかを、ボタンに書く**
                      (`WordbookAdd` と同じ作法)。黙っていると、
                      トレーナーは自分のに入れたつもりになる */}
                  {busy ? '入れています…' : `${whose}に追加する`}
                </button>
              </div>
            </>
          )}

          {note && (
            <p className={note.ng ? 'notice notice--warn' : 'muted'}>{note.text}</p>
          )}
        </div>
      )}
    </div>
  )
}
