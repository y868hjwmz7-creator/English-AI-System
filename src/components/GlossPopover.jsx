/**
 * 意味の吹き出し。
 *
 * 【なぜ部品にしたか】(2026-08)
 *   語(`EnglishText`)と、本文の要点フレーズ(`PhraseChips`)の
 *   両方から同じものを出す。**同じ見た目を2か所に書き写さない。**
 *   書き写すと片方だけ直して食い違う。語の吹き出しで一度やっている。
 *
 * 【中身】
 *   ・見出し(語・発音記号・Listen)
 *   ・意味。**その文でふさわしいものが先頭**で、大きく出す
 *   ・「知っていた」「知らなかった」
 *
 * 【画面の中に収める】
 *   語の位置に合わせて出すので、行の端では画面からはみ出す。
 *   **右へはみ出すときは左へ、左へはみ出すときは右へずらす。**
 *   片側だけ直すと、逆側にはみ出して読めなくなる(スマホで実際に起きた)。
 */
import { useLayoutEffect, useRef } from 'react'
import { posKind } from '../lib/vocab.js'
import SpeakButton from './SpeakButton.jsx'

export default function GlossPopover({
  gloss, busy, error, status = null, fallbackText = '',
  onMark = null, onClose, deps = null,
}) {
  const popRef = useRef(null)

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
  }, [deps, gloss, busy, error])

  return (
    <span className="etext-pop no-print" role="dialog" ref={popRef}>
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
    </span>
  )
}
