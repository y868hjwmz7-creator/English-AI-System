/**
 * レッスンで使う表示(画面共有用)。
 *
 * 【なぜ必要か】
 *   レッスン中に画面を共有して、弱点の問題を一緒に解く。そのとき
 *   ふだんの画面はボタンやタブが多く、**共有される側には読みにくい。**
 *   利用者から「アプリ上でも PDF に近い表示にできないか」と要望があった
 *   (2026-08)。紙に刷ったときと同じ見え方を、画面の上で出す。
 *
 * 【決めたこと】
 *   ・**紙は白のまま。** 暗い配色を選んでいても、ここだけは白い紙にする。
 *     画面共有では白いほうが見やすく、「PDF に近い」という要望にも合う
 *   ・演習ごとに1枚。行ったり来たりできる。40問を延々と流さない
 *   ・**解答の出し方を切り替えられる。** レッスンでは伏せておいて、
 *     答え合わせのときに出す。トレーナーが手元で決める
 *   ・文字の大きさを3段階で変えられる。共有先の画面の大きさが分からないため
 */
import { useEffect, useState } from 'react'
import { exerciseLabel, exerciseType, isPassageSection } from '../data/exerciseTypes.js'
import { weaknessTagLabel } from '../data/weaknessTags.js'
import { printElement } from '../lib/print.js'
import MaterialTitle from './MaterialTitle.jsx'
import SpeakButton from './SpeakButton.jsx'

const SIZES = [
  { id: 'm', label: '標準' },
  { id: 'l', label: '大' },
  { id: 'xl', label: '特大' },
]

export default function LessonView({ material, onClose }) {
  const sections = material?.sections ?? []
  const [page, setPage] = useState(0)
  const [showAnswers, setShowAnswers] = useState(false)
  const [size, setSize] = useState('l')

  // 開いているあいだは、後ろの画面を動かさない
  useEffect(() => {
    const before = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = before }
  }, [])

  // Esc で閉じる。左右の矢印でページを送る
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
      if (e.key === 'ArrowRight') setPage((p) => Math.min(p + 1, sections.length - 1))
      if (e.key === 'ArrowLeft') setPage((p) => Math.max(p - 1, 0))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, sections.length])

  if (!material) return null
  const section = sections[page]
  const type = section ? exerciseType(section.exercise_type) : null

  return (
    <div className="lesson" role="dialog" aria-label="レッスンで使う表示">
      {/* 操作するところ。共有される側にも見えるが、紙の外に置く */}
      <div className="lesson-bar no-print">
        <button type="button" className="btn btn--small" onClick={onClose}>✕ 閉じる</button>

        <div className="lesson-pages">
          <button type="button" className="btn btn--small"
                  disabled={page === 0} onClick={() => setPage(page - 1)}>◀</button>
          <span>{page + 1} / {sections.length}</span>
          <button type="button" className="btn btn--small"
                  disabled={page >= sections.length - 1} onClick={() => setPage(page + 1)}>▶</button>
        </div>

        <div className="lesson-tools">
          <button type="button"
                  className={`btn btn--small${showAnswers ? ' btn--primary' : ''}`}
                  onClick={() => setShowAnswers(!showAnswers)}>
            {showAnswers ? '解答を隠す' : '解答を出す'}
          </button>
          <div className="lesson-sizes">
            {SIZES.map((s) => (
              <button key={s.id} type="button"
                      className={`theme-btn${size === s.id ? ' is-active' : ''}`}
                      onClick={() => setSize(s.id)}>
                {s.label}
              </button>
            ))}
          </div>
          <button type="button" className="btn btn--small"
                  onClick={() => printElement(document.getElementById('lesson-sheet'))}>
            🖨 印刷
          </button>
        </div>
      </div>

      {/* ここが「紙」。暗い配色を選んでいても白のまま */}
      <div className={`lesson-sheet lesson-sheet--${size}`} id="lesson-sheet">
        <div className="lesson-head">
          <MaterialTitle title={material.title} headline={material.headline}
                         as="strong" size="sheet" />
        </div>

        {section && (
          <>
            <h3 className="lesson-section">
              {exerciseLabel(section.exercise_type)}
              {!isPassageSection(section.exercise_type) && `（${section.items.length} 問）`}
            </h3>
            {section.instruction && <p className="lesson-instruction">{section.instruction}</p>}

            <ol className="lesson-items">
              {section.items.map((it) => (
                <li key={it.id ?? it.seq}>
                  {it.tag_id && <span className="lesson-tag">{weaknessTagLabel(it.tag_id)}</span>}
                  {it.speaker && <div className="lesson-speaker" lang="en">{it.speaker}</div>}

                  {/* リスニングは英文を出さない。聞いて答えるため */}
                  {!type?.hidePromptFromLearner && it.prompt_en && (
                    <div className="lesson-en" lang="en">{it.prompt_en}</div>
                  )}
                  {it.prompt_ja && <div className="lesson-ja">{it.prompt_ja}</div>}
                  {it.question && <div className="lesson-en" lang="en">{it.question}</div>}
                  {it.hint && <div className="lesson-note">与える語: {it.hint}</div>}

                  {type?.audioFrom && it[type.audioFrom] && (
                    <SpeakButton
                      text={it[type.audioFrom]}
                      label={type.hidePromptFromLearner ? '聞く' : 'お手本'}
                    />
                  )}

                  {showAnswers && it.answer && (
                    <div className="lesson-answer">→ {it.answer}</div>
                  )}
                  {showAnswers && it.answer_alt && (
                    <div className="lesson-note">別解: {it.answer_alt}</div>
                  )}
                  {showAnswers && it.note && <div className="lesson-note">{it.note}</div>}
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
    </div>
  )
}
