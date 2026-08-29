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
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { lookupWord, preloadGlosses, splitWords } from '../lib/vocab.js'
import SpeakButton from './SpeakButton.jsx'

/** 触る端末で「少し長め」と見なす長さ。短すぎると画面送りで開いてしまう */
const HOLD_MS = 450

export default function EnglishText({
  text, level = 'B1', statuses = null, onMark = null, className = '', lang = 'en',
}) {
  const [openIndex, setOpenIndex] = useState(null)  // いま開いている語
  const [gloss, setGloss] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const holdTimer = useRef(null)   // 長押しの計測
  const heldRef = useRef(false)    // 長押しで開いた直後か(続く click を捨てる)
  const touchRef = useRef(false)   // 直前の操作が「触る」だったか
  const popRef = useRef(null)
  const rootRef = useRef(null)
  const parts = splitWords(text ?? '')

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

  /**
   * 吹き出しを画面の中に収める。
   *
   * 語の位置に合わせて出すので、行の端の語では画面からはみ出す。
   * **右へはみ出すときは左へ、左へはみ出すときは右へずらす。**
   * 片側だけ直すと、逆側にはみ出して読めなくなる(スマホで実際に起きた)。
   */
  useLayoutEffect(() => {
    const el = popRef.current
    if (!el) return
    el.style.left = '0px'
    const rect = el.getBoundingClientRect()
    const margin = 8
    let shift = 0
    if (rect.right > window.innerWidth - margin) shift = window.innerWidth - margin - rect.right
    if (rect.left + shift < margin) shift = margin - rect.left
    if (shift) el.style.left = `${Math.round(shift)}px`
  }, [openIndex, gloss, busy, error])

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
        return (
          <span key={i} className="etext-word-wrap">
            <button
              type="button"
              className={`etext-word${status ? ` is-${status}` : ''}${isOpen ? ' is-open' : ''}`}
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
              <span className="etext-pop no-print" role="dialog" ref={popRef}>
                {busy && <span className="etext-pop-busy">調べています…</span>}
                {error && <span className="etext-pop-error">{error}</span>}
                {gloss && (
                  <>
                    <span className="etext-pop-head">
                      <strong lang="en">{gloss.display}</strong>
                      {/* 発音記号。意味が分かっても読み方が分からないと、
                          声に出す練習につながらない(2026-08 の要望)。
                          スラッシュは画面側で付ける(控えには裸で入っている) */}
                      {gloss.phonetic && (
                        <span className="etext-phonetic">/{gloss.phonetic}/</span>
                      )}
                      <SpeakButton text={gloss.display || part.text}
                                   className="etext-listen" />
                    </span>
                    {/* **その文でふさわしい意味が先頭に来る**(2026-08 の指定)。
                        先頭は大きく、二番目からは小さく出す。 */}
                    {(gloss.senses ?? []).map((sense, si) => (
                      <span key={si} className={`etext-sense${si === 0 ? ' is-main' : ''}`}>
                        <span className="etext-sense-line">
                          {si > 0 && <span className="etext-sense-no">{si + 1}</span>}
                          {sense.pos && <span className="etext-pos">{sense.pos}</span>}
                          <span className="etext-sense-mean">{sense.meaning_ja}</span>
                        </span>
                        {sense.example_en && (
                          <span className="etext-pop-ex" lang="en">{sense.example_en}</span>
                        )}
                        {sense.note && <span className="etext-pop-note">{sense.note}</span>}
                      </span>
                    ))}
                  </>
                )}
                {onMark && (
                  <span className="etext-pop-actions">
                    <button type="button" className="btn btn--small"
                            onClick={() => mark('known')}>知っていた</button>
                    <button type="button" className="btn btn--small btn--warnish"
                            onClick={() => mark('unknown')}>知らなかった</button>
                    {status && (
                      <button type="button" className="btn btn--link"
                              onClick={() => mark(null)}>取り消す</button>
                    )}
                  </span>
                )}
                <button type="button" className="etext-pop-close" onClick={close}
                        aria-label="閉じる">✕</button>
              </span>
            )}
          </span>
        )
      })}
    </span>
  )
}
