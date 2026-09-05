/**
 * **くり返しの単位を選ぶボタン**(2026-09 利用者の指定)。
 *
 *   > UIを、もう少し大きくするか、上部バーに配置するかで反復ボタンを
 *   > 作って欲しいです。文章単位、段落単位、全文単位、三つ選べるような。
 *
 * ============================================================================
 * 【なぜ3つ要るのか】
 *
 *   これまでのくり返し(`RepeatToggle`)は**「くり返す / 1回」の2つ**で、
 *   回るのは**その1本まるごと**だけだった。ところが、まねて言う練習は
 *   **1文だけを何度も回したい**ことのほうが多い。逆に、聞き流したい人は
 *   **本文ぜんぶ**を回したい。単位が1つしかないと、どちらもできない。
 *
 * 【1つのボタンで、押すたびに移る】
 *   選択肢を4つ並べると、めったに触らないものが帯の場所を食う
 *   (`Stepper` を作ったときと同じ話)。**いまの単位を書いた
 *   ボタン1つ**にして、押すたびに次へ移す。多くても3回で戻ってこられる。
 *
 *   **押している印は、色と文字の両方で出す**(色だけに頼らない・CLAUDE.md)。
 *
 * 【「段落」か「発言」かは、呼ぶ側が言う】
 *   記事は段落、会話・会議は発言(`countUnit()` の決まり)。
 *   **ここで数え直さない。**
 */
import { RepeatIcon } from './Icons.jsx'
import { REPEAT_UNITS } from '../lib/wholeAudio.js'

/** その単位の呼び名。**「段落 / 発言」だけが教材で変わる** */
export const repeatLabel = (id, unit = '段落') => ({
  off: 'しない',
  sentence: '文',
  item: unit,
  all: '全文',
}[id] ?? 'しない')

/** 次に移る先。**並びは `REPEAT_UNITS` 1か所**(2か所に持たない) */
export const nextRepeat = (id) => {
  const i = REPEAT_UNITS.indexOf(id)
  return REPEAT_UNITS[(i < 0 ? 0 : i + 1) % REPEAT_UNITS.length]
}

/**
 * @param value   'off' / 'sentence' / 'item' / 'all'
 * @param unit    段落 / 発言(教材の形から決まる言葉)
 * @param onChange 次の単位
 */
export default function RepeatUnit({
  value = 'off', unit = '段落', onChange, className = '',
}) {
  const on = value !== 'off'
  const now = repeatLabel(value, unit)
  const next = repeatLabel(nextRepeat(value), unit)

  return (
    <button type="button"
            className={`btn btn--small repeat-unit${on ? ' btn--primary' : ''}${className ? ` ${className}` : ''}`}
            aria-pressed={on}
            title={`くり返し … いまは「${now}」。押すと「${next}」になります`}
            aria-label={`くり返しの単位。いまは ${now}。押すと ${next} になります`}
            onClick={() => onChange?.(nextRepeat(value))}>
      <RepeatIcon />
      {/* **狭い画面では「くり返し」を落とす。**
          単位そのもの(文 / 段落 / 全文)は必ず見えている */}
      <span className="wide-text">くり返し:</span>
      <span className="repeat-unit-now">{now}</span>
    </button>
  )
}
