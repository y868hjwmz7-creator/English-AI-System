/**
 * 意味の吹き出し。
 *
 * 【なぜ部品にしたか】(2026-08)
 *   語(`EnglishText`)と、本文の要点フレーズ(`PhraseChips`)の
 *   両方から同じものを出す。**同じ見た目を2か所に書き写さない。**
 *   書き写すと片方だけ直して食い違う。語の吹き出しで一度やっている。
 *
 * 【画面の直下に出す】(2026-08 実機で判明)
 *   以前は語のすぐ隣に置いていた(`position: absolute`)。ところが
 *   **紙(`.lesson-sheet`)は `overflow-y: auto` である。**
 *   CSS では片方だけ `auto` にすると、もう片方の `visible` も `auto` に
 *   なる。つまり紙は横方向にも切る。端の語で開くと吹き出しが切れ、
 *   さらに紙が横にスクロールできてしまい、**画面全体が右にずれた。**
 *
 *   そこで `createPortal` で **body の直下**に出し、`position: fixed` で
 *   置く。どの親にも切られない。位置は語の場所から毎回計算する。
 *
 * 【はみ出さない】
 *   右に出きらなければ左へ、左に出きらなければ右へ寄せる。
 *   下に入らなければ**語の上**に出す。片側だけ直すと逆側にはみ出す。
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { posKind } from '../lib/vocab.js'
import SpeakButton from './SpeakButton.jsx'

const MARGIN = 8

export default function GlossPopover({
  anchorEl, gloss, busy, error, status = null, fallbackText = '',
  onMark = null, onClose,
}) {
  const popRef = useRef(null)
  const [place, setPlace] = useState(null)

  /** 語の位置に合わせて置き直す。画面の外へ出さない */
  const position = () => {
    const el = popRef.current
    const anchor = anchorEl
    if (!el || !anchor) return
    const a = anchor.getBoundingClientRect()
    const w = el.offsetWidth
    const h = el.offsetHeight
    const vw = window.innerWidth
    const vh = window.innerHeight

    let left = a.left
    if (left + w > vw - MARGIN) left = vw - MARGIN - w
    if (left < MARGIN) left = MARGIN

    // 下に入らなければ上に出す。**入らないまま下に出さない**
    let top = a.bottom + 6
    if (top + h > vh - MARGIN && a.top - 6 - h > MARGIN) top = a.top - 6 - h
    if (top < MARGIN) top = MARGIN

    setPlace({ left: Math.round(left), top: Math.round(top) })
  }

  useLayoutEffect(position, [anchorEl, gloss, busy, error])

  // 画面を動かしたら追いかける。**閉じない。**
  // 読みながら少し送ることがあるので、消えるとかえって困る。
  //
  // **大きさが変わったときも置き直す。** 「調べています…」から意味が
  // 入れ替わると幅が広がる。そのときに直さないと、広がった分だけ
  // 画面からはみ出す(2026-08 実機で、右端が画面ちょうどに張り付いた)。
  useEffect(() => {
    let frame = 0
    const onMove = () => {
      if (frame) return
      frame = window.requestAnimationFrame(() => { frame = 0; position() })
    }
    window.addEventListener('scroll', onMove, true)
    window.addEventListener('resize', onMove)
    const RO = window.ResizeObserver
    const ro = typeof RO === 'function' ? new RO(onMove) : null
    if (ro && popRef.current) ro.observe(popRef.current)
    return () => {
      window.removeEventListener('scroll', onMove, true)
      window.removeEventListener('resize', onMove)
      ro?.disconnect()
      if (frame) window.cancelAnimationFrame(frame)
    }
  })

  // 紙の上では、紙に合わせた明るい色にする。
  // body の直下に出すので、`.lesson-sheet .etext-pop` では届かない
  const onPaper = !!anchorEl?.closest?.('.lesson-sheet')

  return createPortal(
    <span
      className={`etext-pop no-print${onPaper ? ' etext-pop--paper' : ''}`}
      role="dialog"
      ref={popRef}
      style={{
        left: place ? `${place.left}px` : 0,
        top: place ? `${place.top}px` : 0,
        // 場所が決まるまでは見せない。左上に一瞬出るのを防ぐ
        visibility: place ? 'visible' : 'hidden',
      }}
    >
      {busy && <span className="etext-pop-busy">調べています…</span>}
      {error && <span className="etext-pop-error">{error}</span>}
      {gloss && (
        <>
          <span className="etext-pop-head">
            <strong lang="en">{gloss.display || fallbackText}</strong>
            {/* 発音記号。意味が分かっても読み方が分からないと、
                声に出す練習につながらない(2026-08 の要望)。
                スラッシュは画面側で付ける(控えには裸で入っている) */}
            {gloss.phonetic && (
              <span className="etext-phonetic">/{gloss.phonetic}/</span>
            )}
            <SpeakButton text={gloss.display || fallbackText} className="etext-listen" />
          </span>
          {/* **その文でふさわしい意味が先頭に来る**(2026-08 の指定)。
              先頭は大きく、二番目からは小さく出す。 */}
          {(gloss.senses ?? []).map((sense, si) => (
            <span key={si} className={`etext-sense${si === 0 ? ' is-main' : ''}`}>
              <span className="etext-sense-line">
                {si > 0 && <span className="etext-sense-no">{si + 1}</span>}
                {sense.pos && (
                  <span className={`etext-pos etext-pos--${posKind(sense.pos)}`}>
                    {sense.pos}
                  </span>
                )}
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
      {/* はじめて引いた語だけ、かかった時間を小さく出す。
          2回目からは控えから出るので出ない(2026-08) */}
      {gloss?.lookedUpMs != null && (
        <span className="etext-pop-time">
          はじめて調べました({(gloss.lookedUpMs / 1000).toFixed(1)} 秒)
        </span>
      )}
      {onMark && (
        <span className="etext-pop-actions">
          <button type="button" className="btn btn--small"
                  onClick={() => onMark('known')}>知っていた</button>
          <button type="button" className="btn btn--small btn--warnish"
                  onClick={() => onMark('unknown')}>知らなかった</button>
          {status && (
            <button type="button" className="btn btn--link"
                    onClick={() => onMark(null)}>取り消す</button>
          )}
        </span>
      )}
      <button type="button" className="etext-pop-close" onClick={onClose}
              aria-label="閉じる">✕</button>
    </span>,
    document.body,
  )
}
