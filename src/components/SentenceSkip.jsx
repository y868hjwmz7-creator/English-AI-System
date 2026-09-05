/**
 * **1文ずつ、飛ばす / 戻す**(2026-09 利用者の指定)。
 *
 *   > 「全体を聞く」「段落ごと」りょうほうの横に◁▷をおいて、
 *   > 1文ずつ飛ばしたり戻したりできる仕様です
 *
 * ============================================================================
 * 【置き場所は、操作盤の1つだけ】(2026-09 実機・利用者の指定)
 *
 *   > 各段落のプレーヤー、いらないですね。
 *   > 上部バーのプレーヤー(フロートプレーヤー)の段落の数字の左右に
 *   > ◁▷ を配置して、一つのプレーヤーで段落と文章どちらも
 *   > 飛ばせるようにしてください。
 *
 *   はじめは**段落ごとの Listen にも**三角を添えていた。ところが
 *   記事は6段落あるので、**同じものが6組**並ぶことになる。
 *   送り戻しは**1か所にまとめる**(`PlayerBar`)。
 *
 *       ╭────────────────────────────────────────────╮
 *       │  ◀  🔊 Listen (全体)  ▶   ◁ 3 / 6 段落 ▷    │
 *       ╰────────────────────────────────────────────╯
 *         └─ 文で動かす ─┘        └─ 段落で動かす ─┘
 *
 *   **どちらも同じ形の三角にする。** 場所と、隣にあるものが違いを言う
 *   (Listen の隣なら文、段落の数の隣なら段落)。
 *
 * ============================================================================
 * 【文で動かせるのは、1本にまとめた音声のときだけ】
 *
 *   文の区間は、**1本にまとめた音声と一緒に控えた時刻**から出す
 *   (`sentenceSpansOf`)。1本を作れなかった教材(鍵が無い・名簿に無い声が
 *   混じっている・時刻が本文と合わない)では出せない。
 *   そのときは**押せなくする**(効かない操作を見せない・CLAUDE.md)。
 *
 * 【三角は文字で描く】
 *   絵文字は端末ごとに形も大きさも違う(`PlayerBar` / `Stepper` と同じ)。
 */
import { useEffect, useState } from 'react'
import { canSkipSentence, skipSentence, watchSentenceSkip } from '../lib/readAloud.js'

/**
 * 中身を ◀ ▶ ではさむ、小さな錠剤。
 *
 * @param children  まん中に置くもの
 * @param onStep    押されたときにやること(`-1` / `+1`)。
 *                  **渡さなければ、1文ずつの送り戻しをする**
 * @param canBack   `onStep` のとき、前へ動けるか
 * @param canNext   `onStep` のとき、次へ動けるか
 * @param label     触れたときの説明(`もどる` / `すすむ` の前に付く言葉)
 */
export default function SentenceSkip({
  children, className = '',
  onStep = null, canBack = true, canNext = true, label = '1文',
}) {
  /* 1文ずつ動かせるか。**知っているのは `readAloud.js`** なので、
     そちらに訊く(判断を画面に持たせない)。
     `onStep` を渡されているときは、そちらが受け持つので見ない */
  const [bySentence, setBySentence] = useState(canSkipSentence)
  useEffect(() => (onStep ? undefined : watchSentenceSkip(setBySentence)), [onStep])

  const go = (d) => { if (onStep) onStep(d); else skipSentence(d) }
  const dead = (d) => (onStep
    ? (d < 0 ? !canBack : !canNext)
    : !bySentence)
  const say = (d) => `${label}${d < 0 ? 'もどる' : 'すすむ'}`

  return (
    <span className={`listenpill ${className}`.trim()}>
      <button type="button" className="listenpill-arrow"
              title={say(-1)} aria-label={say(-1)}
              disabled={dead(-1)} onClick={() => go(-1)}>◀</button>
      <span className="listenpill-mid">{children}</span>
      <button type="button" className="listenpill-arrow"
              title={say(1)} aria-label={say(1)}
              disabled={dead(1)} onClick={() => go(1)}>▶</button>
    </span>
  )
}
