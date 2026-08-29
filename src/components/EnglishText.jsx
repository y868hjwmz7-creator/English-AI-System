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
import { lookupWord, preloadGlosses, splitWords } from '../lib/vocab.js'
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
  const parts = splitWords(text ?? '')

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

  useEffect(() => cancelHold, [])

  // **本文が出た時点で、控えにある語をまとめて読んでおく。**
  // 触れてから読みに行くと、そのぶん待たされる(2026-08 の指摘)。
  // 同じ画面の何本もの文が同時に頼むので、少し待って1回にまとめている。
  useEffect(() => { preloadGlosses(text) }, [text])

  // 外側を押す / Esc で閉じる。**留めたものを閉じる手段が要る**
  useEffect(() => {
    if (openIndex === null) return undefined
    const onDown = (e) => { if (!rootRef.current?.contains(e.target)) close() }
    const onKey = (e) => { if (e.key === 'Escape') close() }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [openIndex])


  const mark = async (status) => {
    const part = parts[openIndex]
    if (!part || !onMark) return
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
              className={`etext-word${status ? ` is-${status}` : ''}${isOpen ? ' is-open' : ''}`
                + `${isReading ? ' is-reading' : ''}`}
              aria-expanded={isOpen}
              // どの操作で来たかで分ける。**環境の当て推量に賭けない**
              onPointerDown={(e) => {
                touchRef.current = e.pointerType === 'touch'
                heldRef.current = false
                if (!touchRef.current) return
                // 触る端末: 少し長めに触れたときだけ開く
                cancelHold()
                holdTimer.current = window.setTimeout(() => {
                  heldRef.current = true
                  if (isOpen) close()
                  else open(i, part)
                }, HOLD_MS)
              }}
              // iPhone・iPad の長押しメニュー(コピー / Google で検索)を出さない。
              // CSS の -webkit-touch-callout と合わせて二重に止める
              onContextMenu={(e) => e.preventDefault()}
              onPointerUp={cancelHold}
              onPointerCancel={cancelHold}
              onPointerMove={() => { if (touchRef.current) cancelHold() }}
              onClick={() => {
                // 長押しで開いた直後の click は捨てる(すぐ閉じてしまうため)
                if (heldRef.current) { heldRef.current = false; return }
                // 触る端末では、軽く触れただけでは開かない
                if (touchRef.current) return
                if (isOpen) close()
                else open(i, part)
              }}
            >
              {part.text}
            </button>

            {/* 開いたら、閉じる操作をするまで留まる。
                離れた瞬間に閉じていたため、中のボタンを押せなかった */}
            {isOpen && (
              <GlossPopover
                gloss={gloss} busy={busy} error={error} status={status}
                fallbackText={part.text} deps={openIndex}
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
