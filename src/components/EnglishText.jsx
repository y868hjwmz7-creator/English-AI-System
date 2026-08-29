/**
 * 英文を「1語ずつ触れる」形で出す。
 *
 * 【何ができるか】(2026-08 の要望)
 *   ・語に触れると**意味と品詞**が出る。**その文でふさわしい意味が先頭**
 *   ・その場で「知っていた」「知らなかった」を選べる
 *   ・**「知らなかった」と付けた語は色が変わり、次に開いても色のまま**
 *
 * 【触り方】(2026-08 利用者の指定)
 *
 *   | 端末 | 開き方 |
 *   |---|---|
 *   | パソコン(マウス・ペン) | 語を**クリック**する |
 *   | スマホ・タブレット | 語を **450ms 押し続ける**(少し長めに触れる) |
 *
 *   **カーソルを置いただけでは開かない。** 読んでいる途中で次々に開くと、
 *   本文が読めなくなる。**軽く触れただけでも開かない。**
 *   画面を送るだけで開いてしまうため。
 *
 *   判定は「その操作がどれで来たか」(`pointerType`)で行う。
 *   `(hover: hover)` のような**環境の当て推量に賭けない。**
 *   一度この判定を外して「何をしても開かない」状態になった(2026-08)。
 *
 *   【開いたら、閉じる操作をするまで留まる】
 *   語から外れた瞬間に閉じていたため、「知っていた」を押そうと
 *   カーソルを動かすと途中で消えていた(2026-08 の指摘)。
 *   いまは ✕ / 外側を押す / Esc / 同じ語をもう一度押す、で閉じる。
 *
 * 【意味はいつ引くか】
 *   **開いたときに初めて引く。** 本文を出した時点で全部引くと、
 *   1画面で何十回も窓口を呼ぶことになり、費用も時間もかかる。
 *   一度引いた語はスクール全体の控えに残るので、2回目からは無料で出る。
 *
 * 【印刷には出さない】
 *   紙には語の枠も色も要らない。`no-print` で消す。
 */
import { useEffect, useRef, useState } from 'react'
import { lookupWord, normWord, preloadGlosses, splitWords } from '../lib/vocab.js'
import GlossPopover from './GlossPopover.jsx'

/** 触る端末で「少し長め」と見なす長さ。短すぎると画面送りで開いてしまう */
const HOLD_MS = 450

export default function EnglishText({
  text, level = 'B1', statuses = null, onMark = null, className = '', lang = 'en',
  readingAt = null,
}) {
  const [openIndex, setOpenIndex] = useState(null)  // いま開いている語
  const [gloss, setGloss] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const holdTimer = useRef(null)   // 長押しの計測
  const heldRef = useRef(false)    // 長押しで開いた直後か(続く click を捨てる)
  const touchRef = useRef(false)   // 直前の操作が「触る」だったか
  const rootRef = useRef(null)
  const anchorRef = useRef(null)   // 吹き出しを出す位置(語 or なぞった範囲の先頭)
  const parts = splitWords(text ?? '')

  // ── なぞって句を選ぶ ────────────────────────────────────
  //
  // 【なぜ要るか】(2026-08 利用者の指定)
  //   > on の上でクリックし、house までドラッグしたら、まとめて
  //   > ハイライトされ、そのフレーズの訳が出てくるようにできないか？
  //
  //   `on the house` のような言い回しは、1語ずつ見ても意味が分からない。
  //   教材が拾った要点フレーズ(`PhraseChips`)だけでは、
  //   **その場で気づいたものを調べられない。**
  //
  // 【ブラウザの範囲選択は使わない】
  //   語には `user-select: none` を掛けてある(iPhone の長押しメニューを
  //   止めるため)。外すとあの問題が戻る。そこで**自前でなぞりを見る。**
  //   こうすると、マウスでも指でも同じ操作になる。
  const dragFrom = useRef(null)          // なぞり始めた語
  const [dragTo, setDragTo] = useState(null)   // いま指・カーソルの下にある語
  const [range, setRange] = useState(null)     // 確定した範囲 [from, to]

  /** その座標にある語の番号。無ければ null */
  const wordAt = (x, y) => {
    const el = document.elementFromPoint(x, y)?.closest?.('[data-widx]')
    const n = el ? Number(el.dataset.widx) : NaN
    return Number.isInteger(n) ? n : null
  }

  // なぞっている最中と、確定した範囲。どちらも同じ色で示す
  const span = range ?? (dragFrom.current != null && dragTo != null
    && dragTo !== dragFrom.current ? [dragFrom.current, dragTo] : null)
  const lo = span ? Math.min(span[0], span[1]) : -1
  const hi = span ? Math.max(span[0], span[1]) : -2

  /** 吹き出しに出す状態。句を開いているときは**句そのもの**の状態 */
  const popStatus = (() => {
    if (!range) return null
    const head = parts[range[0]]
    const tail = parts[range[1]]
    if (!head || !tail) return null
    const phrase = (text ?? '').slice(head.at, tail.at + tail.text.length).trim()
    return statuses?.get(normWord(phrase)) ?? null
  })()

  // いま読み上げられている語。
  //
  // ブラウザは「何文字目を読み始めた」しか教えてくれない。
  // その位置が空白や句読点に落ちることがあり、**そのたびに色が消えて
  // ちらつく。** そこで「その位置以前で、いちばん後ろにある語」を選ぶ。
  // こうすると次の語の合図が来るまで色が留まり、滑らかに移っていく。
  // **先回りして次の語を光らせない。** 読む前に色が動くと合わない。
  const readingIndex = readingAt == null ? -1 : parts.reduce(
    (found, part, i) => (part.word && part.at <= readingAt ? i : found), -1,
  )

  const cancelHold = () => {
    if (holdTimer.current) { window.clearTimeout(holdTimer.current); holdTimer.current = null }
  }

  const close = () => {
    cancelHold()
    setOpenIndex(null)
    setGloss(null)
    setError(null)
    setRange(null)
    dragFrom.current = null
    setDragTo(null)
  }

  const open = async (index, part) => {
    cancelHold()
    if (openIndex === index && gloss) return   // すでに出ている
    setOpenIndex(index)
    setGloss(null)
    setError(null)
    setBusy(true)
    const { data, error: e } = await lookupWord({ word: part.text, sentence: text, level })
    setBusy(false)
    if (e) { setError(e); return }
    setGloss(data)
  }

  /**
   * なぞった範囲を1つの言い回しとして引く。
   * **もとの英文からそのまま切り出す。** 語を空白でつなぎ直すと、
   * ハイフンやアポストロフィのある語で形が変わってしまう。
   */
  const openRange = async (from, to) => {
    const a = Math.min(from, to)
    const b = Math.max(from, to)
    const head = parts[a]
    const tail = parts[b]
    if (!head?.word || !tail?.word) return
    const phrase = (text ?? '').slice(head.at, tail.at + tail.text.length).trim()
    if (!phrase) return

    setRange([a, b])
    setOpenIndex(a)
    anchorRef.current = rootRef.current?.querySelector(`[data-widx="${a}"]`) ?? null
    setGloss(null)
    setError(null)
    setBusy(true)
    const { data, error: e } = await lookupWord({ word: phrase, sentence: text, level })
    setBusy(false)
    if (e) { setError(e); return }
    setGloss(data)
  }

  useEffect(() => cancelHold, [])

  // **本文が出た時点で、控えにある語をまとめて読んでおく。**
  // 触れてから読みに行くと、そのぶん待たされる(2026-08 の指摘)。
  // 同じ画面の何本もの文が同時に頼むので、少し待って1回にまとめている。
  useEffect(() => { preloadGlosses(text) }, [text])

  // 外側を押す / Esc で閉じる。**留めたものを閉じる手段が要る**
  useEffect(() => {
    if (openIndex === null) return undefined
    const onDown = (e) => {
      // 吹き出しは body の直下に出る(切られないため)。
      // **中を押したときに閉じてはいけない**
      if (rootRef.current?.contains(e.target)) return
      if (e.target?.closest?.('.etext-pop')) return
      close()
    }
    const onKey = (e) => { if (e.key === 'Escape') close() }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [openIndex])


  const mark = async (status) => {
    if (!onMark) return
    if (range) {
      // なぞって選んだ言い回し。**語ではなく句として記録する**
      const head = parts[range[0]]
      const tail = parts[range[1]]
      const phrase = (text ?? '').slice(head.at, tail.at + tail.text.length).trim()
      await onMark(normWord(phrase), status, 'phrase')
      close()
      return
    }
    const part = parts[openIndex]
    if (!part) return
    await onMark(part.norm, status)
    close()
  }

  return (
    <span className={`etext ${className}`} lang={lang} ref={rootRef}>
      {parts.map((part, i) => {
        if (!part.word) return <span key={i}>{part.text}</span>
        const status = statuses?.get(part.norm) ?? null
        const isOpen = openIndex === i
        const isReading = i === readingIndex
        return (
          <span key={i} className="etext-word-wrap">
            <button
              type="button"
              data-widx={i}
              className={`etext-word${status ? ` is-${status}` : ''}${isOpen ? ' is-open' : ''}`
                + `${isReading ? ' is-reading' : ''}`
                + `${i >= lo && i <= hi ? ' is-picked' : ''}`}
              aria-expanded={isOpen}
              // どの操作で来たかで分ける。**環境の当て推量に賭けない**
              onPointerDown={(e) => {
                touchRef.current = e.pointerType === 'touch'
                heldRef.current = false
                // なぞりの起点。指でもマウスでも同じ
                dragFrom.current = i
                setDragTo(i)
                setRange(null)
                if (!touchRef.current) return
                // 触る端末: 少し長めに触れたときだけ開く
                cancelHold()
                holdTimer.current = window.setTimeout(() => {
                  heldRef.current = true
                  anchorRef.current = e.currentTarget
                  if (isOpen) close()
                  else open(i, part)
                }, HOLD_MS)
              }}
              // iPhone・iPad の長押しメニュー(コピー / Google で検索)を出さない。
              // CSS の -webkit-touch-callout と合わせて二重に止める
              onContextMenu={(e) => e.preventDefault()}
              onPointerUp={(e) => {
                cancelHold()
                const from = dragFrom.current
                const to = wordAt(e.clientX, e.clientY)
                dragFrom.current = null
                setDragTo(null)
                // **2語以上をなぞったら、まとめて1つの言い回しとして引く**
                if (from != null && to != null && to !== from) {
                  heldRef.current = true   // 続く click を捨てる
                  openRange(from, to)
                }
              }}
              onPointerCancel={() => {
                cancelHold()
                dragFrom.current = null
                setDragTo(null)
              }}
              onPointerMove={(e) => {
                if (dragFrom.current == null) return
                const at = wordAt(e.clientX, e.clientY)
                if (at != null && at !== dragTo) setDragTo(at)
                // なぞり始めたら、長押しでの1語表示はやめる
                if (at != null && at !== dragFrom.current) cancelHold()
                else if (touchRef.current && at == null) cancelHold()
              }}
              onClick={(e) => {
                // 長押し・なぞりで開いた直後の click は捨てる(すぐ閉じてしまうため)
                if (heldRef.current) { heldRef.current = false; return }
                // 触る端末では、軽く触れただけでは開かない
                if (touchRef.current) return
                anchorRef.current = e.currentTarget
                if (isOpen) close()
                else open(i, part)
              }}
            >
              {part.text}
            </button>

            {/* 開いたら、閉じる操作をするまで留まる。
                離れた瞬間に閉じていたため、中のボタンを押せなかった。
                吹き出しは body の直下に出す(親に切られないため) */}
            {isOpen && (
              <GlossPopover
                anchorEl={anchorRef.current}
                gloss={gloss} busy={busy} error={error}
                status={range ? popStatus : status}
                fallbackText={part.text}
                onMark={onMark ? (next) => mark(next) : null}
                onClose={close}
              />
            )}
          </span>
        )
      })}
    </span>
  )
}
