/**
 * **くり返す範囲を選ぶ**(2026-09-30 利用者の指定で作り直した・第5.318節)。
 *
 * ============================================================================
 * 【もとは、ボタン1つで回していた】
 *
 *   > UIを、もう少し大きくするか、上部バーに配置するかで反復ボタンを
 *   > 作って欲しいです。文章単位、段落単位、全文単位、三つ選べるような。
 *
 *   「しない → 文 → 段落 → 全文」と押すたびに移る形にしていた。
 *   場所は取らないが、**いま何を回しているかを読むために、
 *   文字を出す必要があった**(「くり返し: しない」)。
 *
 * 【いまは、ボタン1つ。押すたびに回る】(2026-09-30 利用者の指定・第5.320節)
 *
 *   > 3つ並んだリピートのマークをひとつにして、押すたびに切り替わるように
 *   > できませんか? …4つ目の普通の再生を示すマークを作るか、
 *   > それとも普通の再生の時はグレーアウトさせるか、、提案してください
 *
 *   **一度は3つ並べた**(第5.318節)。いま何を回しているかは一目で分かるが、
 *   **帯の幅を 110px 使う** —— 集中モードの帯では 320px + 文字を大きくした
 *   ときにあふれ、`is-fit3` で絵を 26px まで詰めることになった。
 *
 *   2案を 20 / 28 / 36px で描いて見比べ、**利用者が案A を選んだ。**
 *
 *   ・「しない」… **回す範囲の線を描かない + うすく**
 *   ・押すたび しない → 文 → 段落 → 全文 → しない と回る
 *
 *   **色だけに頼っていない**(CLAUDE.md)—— うすいだけでなく、
 *   **線が無い**ので形でも分かる。`aria-pressed` と `title` にも出る。
 *
 * 【言葉は消していない】
 *   絵だけになったが、**名前は `aria-label` と `title` に残してある**
 *   (「いまは 段落。押すと 全文 になります」)。
 *
 * 【「段落」か「発言」かは、呼ぶ側が言う】
 *   記事は段落、会話・会議は発言(`countUnit()` の決まり)。
 *   **ここで数え直さない。**
 */
import { RepeatRangeIcon } from './Icons.jsx'
import { nextRepeat, repeatSay } from '../lib/repeatLabel.js'

/* **呼び名と「次へ」は `repeatLabel.js` 1か所**(素の node からも呼べる形)。
   前から `RepeatUnit.jsx` を見ている人のために、ここからも出し直す */
export { repeatLabel, nextRepeat } from '../lib/repeatLabel.js'

/**
 * @param value   'off' / 'sentence' / 'item' / 'all'
 * @param unit    段落 / 発言(教材の形から決まる言葉)
 * @param onChange 次の単位
 */
export default function RepeatUnit({
  value = 'off', unit = '段落', onChange, className = '',
}) {
  const on = value !== 'off'
  /* **言い方は `repeatLabel.js` 1か所**(第5.320節)。
     ここで組み立てると、見張りが書き写すことになる */
  const 言い方 = repeatSay(value, unit)
  return (
    <button type="button"
            className={`repeat-key${on ? ' is-on' : ''}${className ? ` ${className}` : ''}`}
            aria-pressed={on}
            aria-label={言い方} title={言い方}
            onClick={() => onChange?.(nextRepeat(value, unit))}>
      {/* **「しない」は線が無く、うすい**(`.repeat-key` が色を決める) */}
      <RepeatRangeIcon range={value} />
    </button>
  )
}
