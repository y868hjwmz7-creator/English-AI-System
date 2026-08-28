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
import { countLabel, exerciseLabel, exerciseType, isPassageSection } from '../data/exerciseTypes.js'
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
  // 解答の出し方は2通り。**両方要る。**
  //   ・右上のボタン … 全部まとめて出す / 隠す(答え合わせのとき)
  //   ・問ごとのボタン … 1問ずつ出す / 隠す(一緒に進めるとき)
  //
  // 問ごとの状態は、右上の設定に対する「例外」として持つ。
  //   全部隠しているとき … openItems に入っているものだけ出す
  //   全部出しているとき … closedItems に入っているものだけ隠す
  // こうすると、**どちらの状態からでも1問ずつ開け閉めできる。**
  // 一度見た解答をまた隠して解き直す、という使い方のため(2026-08 の要望)。
  const [showAnswers, setShowAnswers] = useState(false)
  const [openItems, setOpenItems] = useState(() => new Set())
  const [closedItems, setClosedItems] = useState(() => new Set())
  const [size, setSize] = useState('l')

  /** ページを移ったら、1問ずつの開け閉めは元に戻す */
  const resetItems = () => { setOpenItems(new Set()); setClosedItems(new Set()) }

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
      if (e.key === 'ArrowRight') {
        setPage((p) => Math.min(p + 1, sections.length - 1))
        resetItems()
      }
      if (e.key === 'ArrowLeft') {
        setPage((p) => Math.max(p - 1, 0))
        resetItems()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, sections.length])

  if (!material) return null
  // 弱点は教材名にも入る。**全部入っているなら、札は出さない**(同じ言葉が
  // 2度並ぶため)。1つでも欠けていれば、**全部**を札で出す。
  // 一部だけを出すと、何が抜けているのか分からない一覧になる。
  const allTags = material.tagIds ?? []
  const titleText = String(material.title ?? '')
  const extraTags = allTags.every((t) => titleText.includes(weaknessTagLabel(t))) ? [] : allTags
  const section = sections[page]
  const key = (it, i) => it.id ?? `${page}-${i}`

  /** その問の解答が出ているか */
  const isOpen = (k) => (showAnswers ? !closedItems.has(k) : openItems.has(k))

  /** その問の解答を出す / 隠す */
  const toggleItem = (k) => {
    const target = showAnswers ? closedItems : openItems
    const next = new Set(target)
    if (next.has(k)) next.delete(k)
    else next.add(k)
    if (showAnswers) setClosedItems(next)
    else setOpenItems(next)
  }
  const type = section ? exerciseType(section.exercise_type) : null
  const isPassage = section ? isPassageSection(section.exercise_type) : false

  return (
    <div className="lesson" role="dialog" aria-label="レッスンで使う表示">
      {/* 操作するところ。共有される側にも見えるが、紙の外に置く */}
      <div className="lesson-bar no-print">
        <button type="button" className="btn btn--small" onClick={onClose}>✕ 閉じる</button>

        <div className="lesson-pages">
          <button type="button" className="btn btn--small"
                  disabled={page === 0}
                  onClick={() => { setPage(page - 1); resetItems() }}>◀</button>
          <span>{page + 1} / {sections.length}</span>
          <button type="button" className="btn btn--small"
                  disabled={page >= sections.length - 1}
                  onClick={() => { setPage(page + 1); resetItems() }}>▶</button>
        </div>

        <div className="lesson-tools">
          <button type="button"
                  className={`btn btn--small${showAnswers ? ' btn--primary' : ''}`}
                  onClick={() => {
                    // 全部出す・全部隠す。1問ずつ開いたものも一緒に閉じる
                    setShowAnswers(!showAnswers)
                    setOpenItems(new Set())
                    setClosedItems(new Set())
                  }}>
            {showAnswers ? 'すべての解答を隠す' : 'すべての解答を出す'}
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
          {/* **何の練習かを、紙の上に必ず残す。**
              記事・会話は場面の題名が主役になるため、弱点(文法事項)が
              どこにも出ていなかった。紙で復習するときに分からなくなる
              (2026-08 の指摘)。教材名にすでに入っているものは繰り返さない。 */}
          {extraTags.length > 0 && (
            <div className="lesson-weakness">
              <span className="lesson-weakness-label">文法事項</span>
              {extraTags.map((t) => (
                <span key={t} className="lesson-weakness-tag">{weaknessTagLabel(t)}</span>
              ))}
            </div>
          )}
        </div>

        {section && (
          <>
            <h3 className="lesson-section">
              {exerciseLabel(section.exercise_type)}
              {`（${countLabel(section.exercise_type, section.items.length)}）`}
            </h3>
            {section.instruction && <p className="lesson-instruction">{section.instruction}</p>}

            <ol className="lesson-items">
              {section.items.map((it, i) => (
                <li key={key(it, i)}>
                  {it.tag_id && <span className="lesson-tag">{weaknessTagLabel(it.tag_id)}</span>}
                  {it.speaker && <div className="lesson-speaker" lang="en">{it.speaker}</div>}

                  {/* リスニングは英文を出さない。聞いて答えるため */}
                  {!type?.hidePromptFromLearner && it.prompt_en && (
                    <div className="lesson-en" lang="en">{it.prompt_en}</div>
                  )}
                  {/* 本文(記事・会話)の訳は、はじめは伏せる。
                      英文だけが出ていたほうがシャドーイングしやすく、
                      「訳を見る」で確かめられる。設問の日本語は伏せない。 */}
                  {it.prompt_ja && (isPassage
                    ? isOpen(key(it, i)) && <div className="lesson-ja">{it.prompt_ja}</div>
                    : <div className="lesson-ja">{it.prompt_ja}</div>)}
                  {it.question && <div className="lesson-en" lang="en">{it.question}</div>}
                  {it.hint && <div className="lesson-note">与える語: {it.hint}</div>}

                  {type?.audioFrom && it[type.audioFrom] && (
                    <SpeakButton
                      text={it[type.audioFrom]}
                      label={type.hidePromptFromLearner ? '聞く' : 'お手本'}
                    />
                  )}

                  {/* 解答は「全部出す」と「この問だけ出す」の両方から開ける。
                      レッスンで1問ずつ答え合わせをするために、問ごとが要る。 */}
                  {(it.answer || it.audio_text || (isPassage && it.prompt_ja)) && (
                    <button type="button" className="btn btn--small lesson-reveal"
                            aria-expanded={isOpen(key(it, i))}
                            onClick={() => toggleItem(key(it, i))}>
                      {isPassage
                        ? (isOpen(key(it, i)) ? '訳を隠す' : '訳を見る')
                        : (isOpen(key(it, i)) ? '解答を隠す' : '解答を見る')}
                    </button>
                  )}

                  {isOpen(key(it, i)) && (
                    <>
                      {/* リスニングは英文を見せずに聞かせる。答え合わせでは
                          **読み上げた英文そのもの**を出す。何を言われたのかが
                          分からないと、直しようがない(2026-08 の指摘)。 */}
                      {type?.hidePromptFromLearner && it.audio_text && (
                        <div className="lesson-heard">
                          <span className="lesson-heard-label">読み上げた英文</span>
                          <span lang="en">{it.audio_text}</span>
                        </div>
                      )}
                      {it.answer && <div className="lesson-answer">→ {it.answer}</div>}
                      {it.answer_alt && <div className="lesson-note">別解: {it.answer_alt}</div>}
                      {it.note && <div className="lesson-note">{it.note}</div>}
                    </>
                  )}
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
    </div>
  )
}
