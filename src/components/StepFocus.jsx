/**
 * 6Steps の集中モード — **いまの取り組み方を、1つずつ画面いっぱいに出す。**
 *
 * ============================================================================
 * 【なぜ要るのか】(2026-09 利用者の指定)
 *
 *   > 6steps全てに集中モードを作ってください。今は形式的にはボタンがあっても、
 *   > 押すとトップの単語チェックのページの集中モードに飛ばされてしまいます。
 *   > ディクテーションやスラッシュリーディングでこれをできるようにしてください
 *
 *   これまで 6Steps の中の「集中モード」は、押すと `FocusReader`
 *   (**本文を読んで語を調べる**ための画面)を開いていた。
 *   ディクテーションを書いている途中でも、スラッシュを入れている途中でも、
 *   **同じ「語を調べる画面」に飛ばされる。**
 *   いま取り組んでいることが、そこには無い。
 *
 *   集中モードの値打ちは「**1つだけを画面に固定して、送る必要をなくす**」
 *   ことにある(`FocusReader` の冒頭)。だから
 *   **その取り組み方そのものを、1つずつ出す。**
 *
 * 【骨組みは `FocusReader` と同じものを使う】
 *   `.focus` / `.focus-top` / `.focus-body` / `.focus-bar` は使い回す。
 *   **同じ見た目を2か所に書き写さない**(CLAUDE.md)。
 *   足すのは「6Steps を切り替えるプルダウンを上の帯に置く」1点だけ。
 *
 * 【中身は、この部品が作らない】
 *   ディクテーション・スラッシュリーディング・1文ずつ・本文まるごとの
 *   描き方は `PassagePractice` が持っている。ここへは**そのまま**渡す。
 *   書き写すと、片方だけ古くなる(単語帳で一度やった失敗)。
 */
import { useEffect } from 'react'
import FocusFrame from './FocusFrame.jsx'
import { SIX_STEPS } from '../lib/sixSteps.js'

/**
 * @param step        いまの取り組み方の id
 * @param onStepChange 取り組み方を変える(**集中モードから出さずに**変えられる)
 * @param at          いま何番目か(0 から)
 * @param total       ぜんぶで何個か
 * @param unit        数え方の名前(文 / 段落 / 発言 / 文章)
 * @param onMove      送る(番号を渡す)
 * @param onClose     集中モードを終える
 */
export default function StepFocus({
  step, onStepChange, at, total, unit = '文', width = 'w100',
  onMove, onClose, children,
  /** 誰のセッションか。**メモを出すかどうかを決める**(`FocusBoard`) */
  learnerId = null,
}) {
  /* Esc で終える。矢印で送る。
     **早く帰る条件を足したら、その下を必ず見る**(CLAUDE.md)。
     ただし**書き込んでいる最中は、矢印を横取りしない。**
     ディクテーションは文字を打つ画面なので、
     入力欄の中でカーソルを動かせなくなると書けなくなる */
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose?.(); return }
      const el = e.target
      const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA'
        || el.isContentEditable)
      if (typing) return
      if (e.key === 'ArrowRight' && at < total - 1) onMove?.(at + 1)
      if (e.key === 'ArrowLeft' && at > 0) onMove?.(at - 1)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  })

  /* **骨組みは `FocusFrame` 1つ**(`FocusReader` / Quick Response と共通)。
     足すのは「上の帯の右に 6Steps のプルダウンを置く」1点だけである */
  return (
    <FocusFrame
      className="stepfocus"
      /* **紙の幅を引き継ぐ**(2026-09 実機「画面幅が引き継がれていません」) */
      width={width}
      /* **メモを出すかどうかは、相手がいるかで決まる** */
      learnerId={learnerId}
      /* 線は**取り組み方 × 何番目**ごとに持つ(重なって出ると訳が分からない) */
      page={`${step}:${at}`}
      scrollKey={`${step}:${at}`}
      onClose={onClose}
      top={<span className="focus-count">{at + 1} / {total} {unit}</span>}
      topEnd={(
        /* **6Steps は、ここで切り替えられる**(利用者の指定「6steps全てに」)。
           いちいち出て、選び直して、また入る…では続かない */
        <label className="wb-formpick stepfocus-pick">
          <span className="sr-only">6Steps の切り替え</span>
          <select value={step} onChange={(e) => onStepChange?.(e.target.value)}>
            {SIX_STEPS.map((m) => (
              <option key={m.id} value={m.id}>{m.no} {m.label}</option>
            ))}
          </select>
        </label>
      )}
      bar={(
        <>
          <button type="button" className="btn focus-move"
                  onClick={() => onMove?.(at - 1)} disabled={at === 0}>
            ◀ 前
          </button>
          <div className="focus-mid" />
          <button type="button" className="btn focus-move"
                  onClick={() => onMove?.(at + 1)} disabled={at >= total - 1}>
            次 ▶
          </button>
        </>
      )}
    >
      {children}
    </FocusFrame>
  )
}
