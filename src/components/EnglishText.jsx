/**
 * 英文を「1語ずつ触れる」形で出す。
 *
 * 【何ができるか】(2026-08 の要望)
 *   ・語の上にカーソルを置く(パソコン)、長めに触れる(スマホ)と
 *     **意味と品詞**が出る
 *   ・その場で「知っていた」「知らなかった」を選べる
 *   ・**「知らなかった」と付けた語は色が変わり、次に開いても色のまま**
 *
 * 【なぜ長押しなのか】
 *   軽く触れただけで出すと、画面を送るだけで意味が次々に開いてしまう。
 *   逆にパソコンで長押しを求めると、操作が重い。
 *   **端末に合わせて分ける。** カーソルが使える端末はカーソルを置くだけ、
 *   触る端末は 400ms 押し続けたときだけ開く。
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
import { lookupWord, splitWords } from '../lib/vocab.js'

/** カーソルが使える端末か(スマホ・タブレットは false) */
const hasHover = () => {
  try { return window.matchMedia('(hover: hover) and (pointer: fine)').matches } catch { return false }
}

export default function EnglishText({
  text, level = 'B1', statuses = null, onMark = null, className = '', lang = 'en',
}) {
  const [openIndex, setOpenIndex] = useState(null)  // いま開いている語
  const [gloss, setGloss] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const timerRef = useRef(null)
  const parts = splitWords(text ?? '')

  // 開いている語を切り替えたら、前の中身は捨てる
  useEffect(() => () => { if (timerRef.current) window.clearTimeout(timerRef.current) }, [])

  const open = async (index, part) => {
    setOpenIndex(index)
    setGloss(null)
    setError(null)
    setBusy(true)
    const { data, error: e } = await lookupWord({ word: part.text, sentence: text, level })
    setBusy(false)
    if (e) { setError(e); return }
    setGloss(data)
  }

  const close = () => {
    if (timerRef.current) window.clearTimeout(timerRef.current)
    setOpenIndex(null)
    setGloss(null)
    setError(null)
  }

  /** 触る端末: 長めに押したときだけ開く */
  const holdStart = (index, part) => {
    if (hasHover()) return
    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => open(index, part), 400)
  }
  const holdEnd = () => {
    if (timerRef.current) { window.clearTimeout(timerRef.current); timerRef.current = null }
  }

  const mark = async (status) => {
    const part = parts[openIndex]
    if (!part || !onMark) return
    await onMark(part.norm, status)
    close()
  }

  return (
    <span className={`etext ${className}`} lang={lang}>
      {parts.map((part, i) => {
        if (!part.word) return <span key={i}>{part.text}</span>
        const status = statuses?.get(part.norm) ?? null
        return (
          <span key={i} className="etext-word-wrap">
            <button
              type="button"
              className={`etext-word${status ? ` is-${status}` : ''}${openIndex === i ? ' is-open' : ''}`}
              // パソコンはカーソルを置くだけ。スマホは長押し
              onMouseEnter={() => { if (hasHover()) open(i, part) }}
              onMouseLeave={() => { if (hasHover() && openIndex === i) close() }}
              onTouchStart={() => holdStart(i, part)}
              onTouchEnd={holdEnd}
              onTouchMove={holdEnd}
              onClick={(e) => {
                // スマホで軽く触れたときは何も起こさない(画面送りの邪魔をしない)。
                // パソコンでは押しても開く(カーソルが使えない環境の保険)
                e.preventDefault()
                if (!hasHover()) return
                if (openIndex === i) close()
                else open(i, part)
              }}
            >
              {part.text}
            </button>

            {openIndex === i && (
              <span className="etext-pop no-print" role="dialog"
                    onMouseEnter={() => { if (timerRef.current) window.clearTimeout(timerRef.current) }}>
                {busy && <span className="etext-pop-busy">調べています…</span>}
                {error && <span className="etext-pop-error">{error}</span>}
                {gloss && (
                  <>
                    <span className="etext-pop-head">
                      <strong lang="en">{gloss.display}</strong>
                    </span>
                    {/* **その文でふさわしい意味が先頭に来る**(2026-08 の指定)。
                        先頭は大きく、二番目からは小さく出す。
                        「走る」の文脈なら「走る」が大きく、
                        「運営する」「走らせる」が下に小さく並ぶ。 */}
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
