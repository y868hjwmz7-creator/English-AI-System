/**
 * **段1「見分ける」** —— 文を見て、どの型かを4つから選ぶ(2026-09 利用者の指定)。
 *
 *   > それぞれの型でどのように量をこなし……
 *
 * ============================================================================
 * 【なぜ別の部品にしたか】
 *
 *   言い直す練習(`FrameShift`)とは**手の動きがまるで違う**
 *   (あちらは話す、こちらは押すだけ)。同じ画面に詰めると、
 *   **どちらの条件でも描けないもの**ができて測れなくなる。
 *
 * 【props で受け取るだけ】
 *
 *   問も、控えも、控えに足す道も、呼ぶ側が持つ。
 *   **描けないものは測れない**ので、この部品だけを骨組みに描ける形にする
 *   (`SpeechPractice` / `QrCard` / `NativeFlowAssign` と同じ作法・CLAUDE.md)。
 *
 * 【判断を持ち込まない】
 *
 *   合っているかは `judgeQuiz()` が決める。
 *   画面の中で `picked === q.form` と書かない ——
 *   **置く場所の数だけ食い違う**(CLAUDE.md)。
 *
 * 【書き込む欄は置かない】
 *
 *   型シフトの共通仕様(2026-09 利用者の指定)。ここは押すだけである。
 *
 * @param questions 出す問(`quizQuestions()` が組み立てたもの)
 * @param done      すでに当てた問の id(`Set`)
 * @param onRight   当たったときに呼ぶ(控えに足すのは呼ぶ側)
 */
import { useEffect, useState } from 'react'
import { judgeQuiz } from '../lib/frameQuiz.js'
import { answerFeedback } from '../lib/haptics.js'

export default function FrameQuiz({ questions = [], done = null, onRight = null }) {
  const [at, setAt] = useState(0)
  /** いま押した選択肢。**`null` なら、まだ押していない** */
  const [picked, setPicked] = useState(null)

  /* **範囲の外に出さない。** 絞り込みを変えると数が変わる */
  const nth = Math.min(Math.max(0, at), Math.max(0, questions.length - 1))
  const q = questions[nth] ?? null

  /* 問が変われば、押したものを消す。**前の問の答えを次に残さない** */
  useEffect(() => { setPicked(null) }, [q?.qid])
  /* 出す問が入れ替わったら先頭へ */
  useEffect(() => { setAt(0) }, [questions.length])

  const has = done instanceof Set ? done : new Set()

  if (!q) {
    /* **行き止まりを作らない。** 0問のときは、その旨を出す */
    return <div className="card fshift-none"><p>この絞り込みでは、問がありません。</p></div>
  }

  const judged = judgeQuiz(picked, q)

  const tap = (form) => {
    if (picked) return                       // 二度押しで答えが変わらない
    setPicked(form)
    const j = judgeQuiz(form, q)
    answerFeedback(j.right)
    if (j.right) onRight?.(q.qid)
  }

  return (
    <>
      <div className="card fquiz">
        <div className="fshift-qhead">
          <span className="chip-count">{nth + 1} / {questions.length}</span>
          {has.has(q.qid) && <span className="fshift-doneflag">当てた</span>}
        </div>

        <p className="fquiz-en">{q.en}</p>
        <span className="field-label">どの型ですか</span>

        <div className="fquiz-choices">
          {q.choices.map((form) => {
            /* **色だけに頼らない**(CLAUDE.md)。印の文字も添える。
               押すまでは、どれも同じ見た目である */
            const mark = !picked ? ''
              : form === judged.want ? ' fquiz-btn--right'
                : form === picked ? ' fquiz-btn--wrong' : ''
            return (
              <button key={form} type="button"
                      className={`btn fquiz-btn${mark}`}
                      disabled={!!picked}
                      onClick={() => tap(form)}>
                <span className="fquiz-form">{form}</span>
                {!!picked && form === judged.want && <span className="fquiz-mark">正しい型</span>}
                {!!picked && form === picked && form !== judged.want
                  && <span className="fquiz-mark">選んだもの</span>}
              </button>
            )
          })}
        </div>

        {judged.answered && (
          /* **成功と失敗を、同じ見た目で終わらせない**(CLAUDE.md) */
          <div className={`fshift-verdict fshift-verdict--${judged.right ? 'ok' : 'other'}`}
               role="status">
            <p className="fshift-vhead">{judged.right ? '当たりです' : 'ちがいます'}</p>
            <p className="fshift-vbody">
              {judged.right ? `「${judged.want}」です。`
                : `正しいのは「${judged.want}」です。`}
              {' '}{q.sectionNo} {q.groupLabel}
            </p>
          </div>
        )}
      </div>

      <div className="card fshift-move">
        <div className="btn-row fshift-moverow">
          <button type="button" className="btn btn--ghost"
                  disabled={nth <= 0} onClick={() => setAt(nth - 1)}>前へ</button>
          <button type="button" className="btn"
                  disabled={nth >= questions.length - 1}
                  onClick={() => setAt(nth + 1)}>次へ</button>
        </div>
        <p className="muted fshift-count">
          当てた問: {questions.filter((x) => has.has(x.qid)).length} / {questions.length}
        </p>
      </div>
    </>
  )
}
