/**
 * 英文を「1語ずつ触れる」形で出す。
 *
 * 【何ができるか】(2026-08 の要望)
 *   ・語に触れると**意味と品詞**が出る。**その文でふさわしい意味が先頭**
 *   ・その場で「知っていた」「知らなかった」を選べる
 *   ・**「知らなかった」と付けた語は色が変わり、次に開いても色のまま**
 *
 * 【触り方 — どの端末でも同じように使えること】
 *   最初の作りは「パソコンはカーソルを置くだけ / スマホは長押し」だった。
 *   これは2つの点で失敗した(2026-08 実機)。
 *
 *   ① **カーソルの判定を外すと、何をしても開かない。**
 *      `(hover: hover) and (pointer: fine)` は、触れる画面のついた
 *      パソコンなどで false になることがある。そのとき長押ししか
 *      残らないので、利用者からは「壊れている」ようにしか見えない。
 *   ② **吹き出しのボタンを押せない。**
 *      語から外れた瞬間に閉じていたため、「知っていた」を押そうと
 *      カーソルを動かすと、その途中で消えてしまった。
 *
 *   そこで作り直した。
 *
 *   | 操作 | 何が起きるか |
 *   |---|---|
 *   | **押す / 触る** | 開いて**そのまま留まる**。もう一度押すと閉じる |
 *   | カーソルを置く | 開く(留まらない) |
 *   | 語や吹き出しから離れる | **0.6秒待ってから**閉じる(留まっているときは閉じない) |
 *   | ✕ / 外側を押す / Esc | 閉じる |
 *
 *   **押す操作はどの端末でも必ず効く。** カーソルの判定は「おまけ」に
 *   格下げした。判定を外しても使えなくならない。
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
import { lookupWord, splitWords } from '../lib/vocab.js'

/** カーソルが使える端末か。**開けるかどうかを、これだけに頼らない** */
const hasHover = () => {
  try { return window.matchMedia('(hover: hover) and (pointer: fine)').matches } catch { return false }
}

/** 離れてから閉じるまでの猶予。吹き出しのボタンまで動かす時間 */
const CLOSE_DELAY = 600

export default function EnglishText({
  text, level = 'B1', statuses = null, onMark = null, className = '', lang = 'en',
}) {
  const [openIndex, setOpenIndex] = useState(null)  // いま開いている語
  const [pinned, setPinned] = useState(false)       // 押して開いた(留まる)
  const [gloss, setGloss] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const closeTimer = useRef(null)
  const popRef = useRef(null)
  const rootRef = useRef(null)
  const parts = splitWords(text ?? '')

  const cancelClose = () => {
    if (closeTimer.current) { window.clearTimeout(closeTimer.current); closeTimer.current = null }
  }

  const close = () => {
    cancelClose()
    setOpenIndex(null)
    setPinned(false)
    setGloss(null)
    setError(null)
  }

  /** 離れた。**すぐには閉じない。** 吹き出しまで動かす時間を残す */
  const scheduleClose = () => {
    if (pinned) return
    cancelClose()
    closeTimer.current = window.setTimeout(close, CLOSE_DELAY)
  }

  const open = async (index, part) => {
    cancelClose()
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

  useEffect(() => cancelClose, [])

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

  // 画面の右端からはみ出したら、右寄せにする。
  // はみ出したままだと、意味の続きが読めない
  useLayoutEffect(() => {
    const el = popRef.current
    if (!el) return
    el.classList.remove('is-right')
    const rect = el.getBoundingClientRect()
    if (rect.right > window.innerWidth - 8) el.classList.add('is-right')
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
              // **押す操作はどの端末でも必ず効く。** これが本筋
              onClick={() => {
                if (isOpen && pinned) { close(); return }
                setPinned(true)
                open(i, part)
              }}
              // カーソルはおまけ。置いただけでも出るが、留まらない
              onMouseEnter={() => { cancelClose(); if (hasHover() && !pinned) open(i, part) }}
              onMouseLeave={scheduleClose}
            >
              {part.text}
            </button>

            {isOpen && (
              <span
                className="etext-pop no-print" role="dialog" ref={popRef}
                onMouseEnter={cancelClose}
                onMouseLeave={scheduleClose}
              >
                {busy && <span className="etext-pop-busy">調べています…</span>}
                {error && <span className="etext-pop-error">{error}</span>}
                {gloss && (
                  <>
                    <span className="etext-pop-head">
                      <strong lang="en">{gloss.display}</strong>
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
