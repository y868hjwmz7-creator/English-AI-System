/**
 * 本文のすぐ下に出す「この文の要点」。
 *
 * 【なぜ要るか】(2026-08 利用者の指定)
 *   > コロケーションはフレーズ、イディオム、句動詞などについても
 *   > 復習事項に入れれるようにしたい。教材内の各文章の傍にポイントと
 *   > なっているフレーズなどをピックアップし、それをクリック、または
 *   > タッチすると「知っている」「知らなかった」を選べるように。
 *
 *   語を1つずつ触れる仕組み(`EnglishText`)では、
 *   **語をまたぐ言い回しを拾えない。** look forward to / put off の
 *   ような句は、1語ずつ見ても意味が分からない。
 *
 * 【どこから来るか】
 *   教材を作る時点で拾ってある(`material_items.phrases`、0015)。
 *   **開くたびに AI に拾わせない。** 費用が毎回かかるうえ、
 *   開くまで何が出るか分からない。作る時点なら道具の形で強制できる。
 *
 * 【語と同じ扱いにする】
 *   ・押すと出るのは**語とまったく同じ吹き出し**(`GlossPopover`)
 *   ・記録先も同じ表。鍵は「そろえた形」なので、句もそのまま入る
 *   ・「知らなかった」と付けた句は色が残る。語と同じ見え方にする
 *
 * 【触り方は語と変える】
 *   語は本文の中にあるので、読んでいる途中に開かないよう
 *   「クリック / 長押し」で守っている。**こちらは札である。**
 *   押すためにそこに在るので、ひと押しで開く。
 */
import { useEffect, useRef, useState } from 'react'
import { lookupWord, normWord } from '../lib/vocab.js'
import GlossPopover from './GlossPopover.jsx'

export default function PhraseChips({
  phrases, sentence = '', level = 'B1', statuses = null, onMark = null,
}) {
  const list = (phrases ?? []).filter((p) => String(p?.text ?? '').trim())
  const [openIndex, setOpenIndex] = useState(null)
  const [gloss, setGloss] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const rootRef = useRef(null)

  const close = () => { setOpenIndex(null); setGloss(null); setError(null) }

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

  if (!list.length) return null

  const open = async (i, phrase) => {
    if (openIndex === i) { close(); return }
    setOpenIndex(i)
    setGloss(null)
    setError(null)
    setBusy(true)
    const { data, error: e } = await lookupWord({
      word: phrase.text, sentence: sentence || phrase.text, level,
    })
    setBusy(false)
    if (e) {
      // 窓口が使えなくても、**教材が持っている一言だけは出す。**
      // 何も出ないより、要点が分かるほうがよい
      if (phrase.note) setGloss({ display: phrase.text, senses: [{ meaning_ja: phrase.note }] })
      else setError(e)
      return
    }
    setGloss(data)
  }

  return (
    <div className="phrases no-print" ref={rootRef}>
      <span className="phrases-label">この文の要点</span>
      {list.map((phrase, i) => {
        const norm = normWord(phrase.text)
        const status = statuses?.get(norm) ?? null
        const isOpen = openIndex === i
        return (
          <span key={`${norm}-${i}`} className="phrase-wrap">
            <button
              type="button"
              className={`phrase-chip${status ? ` is-${status}` : ''}${isOpen ? ' is-open' : ''}`}
              aria-expanded={isOpen}
              title={phrase.note ?? ''}
              onClick={() => open(i, phrase)}
            >
              <span lang="en">{phrase.text}</span>
            </button>
            {isOpen && (
              <GlossPopover
                gloss={gloss} busy={busy} error={error} status={status}
                fallbackText={phrase.text} deps={openIndex}
                onMark={onMark ? (next) => { onMark(norm, next, 'phrase'); close() } : null}
                onClose={close}
              />
            )}
          </span>
        )
      })}
    </div>
  )
}
