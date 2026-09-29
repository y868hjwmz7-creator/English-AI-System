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
 * 【いまは、3つ並べる】(2026-09-30 利用者の指定)
 *
 *   > リピート設定の「繰り返し」という表示文言は削除し、
 *   > アイコン中心の操作にしてください。
 *   > それぞれ、リピート範囲が見分けられる異なる矢印アイコンを
 *   > デザインしてください。
 *   > リピートしない状態も選べるようにし、現在の状態はアイコンの
 *   > 選択表示などで分かるようにしてください。
 *
 *   **押したものが光る。** もう一度押すと消える(= くり返さない)。
 *   これで4つの状態がぜんぶ選べて、**いまどれかが一目で分かる。**
 *
 * 【言葉は消していない】
 *   絵だけになったが、**名前は `aria-label` と `title` に残してある**
 *   (「段落をくり返す」「文をくり返す」「全文をくり返す」)。
 *   読み上げにも、マウスを乗せたときにも出る。
 *   **色だけに頼らない**(CLAUDE.md)—— 光っている印は
 *   地色 + 文字色 + `aria-pressed` の3つで示す。
 *
 * 【「段落」か「発言」かは、呼ぶ側が言う】
 *   記事は段落、会話・会議は発言(`countUnit()` の決まり)。
 *   **ここで数え直さない。**
 */
import { RepeatRangeIcon } from './Icons.jsx'
import { REPEAT_UNITS } from '../lib/wholeAudio.js'
import { repeatLabel } from '../lib/repeatLabel.js'

/* **呼び名は `repeatLabel.js` 1か所**(素の node からも呼べる形)。
   前から `RepeatUnit.jsx` を見ている人のために、ここからも出し直す */
export { repeatLabel } from '../lib/repeatLabel.js'

/**
 * @param value   'off' / 'sentence' / 'item' / 'all'
 * @param unit    段落 / 発言(教材の形から決まる言葉)
 * @param onChange 選んだ範囲(もう一度押したら 'off')
 */
export default function RepeatUnit({
  value = 'off', unit = '段落', onChange, className = '',
}) {
  /* **一覧は `REPEAT_UNITS` から作る。**「しない」はボタンにしない ——
     **押しているものをもう一度押せば消える**ので、4つめは要らない
     (効かない操作を見せない・同じことをするものを2つ見せない) */
  const 範囲 = REPEAT_UNITS.filter((id) => id !== 'off')
  return (
    <span className={`repeat-keys${className ? ` ${className}` : ''}`}
          role="group" aria-label="くり返す範囲">
      {範囲.map((id) => {
        const on = value === id
        const 名 = `${repeatLabel(id, unit)}をくり返す`
        return (
          <button key={id} type="button"
                  className={`repeat-key${on ? ' is-on' : ''}`}
                  aria-pressed={on}
                  /* **押すと消える**ことも言っておく —— 押す前に分かる */
                  aria-label={on ? `${名}(いま選んでいる。押すとやめる)` : 名}
                  title={on ? `${名} … 押すとやめる` : 名}
                  onClick={() => onChange?.(on ? 'off' : id)}>
            <RepeatRangeIcon range={id} />
          </button>
        )
      })}
    </span>
  )
}
