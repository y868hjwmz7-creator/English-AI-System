/**
 * **声で言って、聞き取れたかを確かめるボタン**(第5.239節)。
 *
 * ════════════════════════════════════════════════════════════════
 * 6Steps の3か所に、**まったく同じものが書き写されていた**
 * (①ディクテーション「まねて言う」/ ④⑥「英語で言う」/ ③⑤ 本文)。
 * 違うのは**押す前の文言だけ**である。
 *
 * **押したあとの文言は1つ。**「話し終わったら押す」——
 * ここが場所ごとに違うと、同じ操作が別のものに見える
 * (CLAUDE.md「呼び名を2か所に書かない」)。
 *
 * **鳴っているあいだは、そのまま止めるボタンになる**(`SpeakButton` と
 * 同じ作法)。止める場所を探さなくてよい。
 * ════════════════════════════════════════════════════════════════
 *
 * @param label 押す前の文言(「英語で言う」「まねて言う」など)
 * @param on    いま聞いているか
 */
import { MicIcon, StopIcon } from './Icons.jsx'
/* **色は1か所で決める**(第5.242節)。
   `on ? ' btn--primary' : ''` と書いていたので、**押す前が白**だった */
import { toneOn } from '../lib/btnTone.js'

/** **聞いている最中の文言は、ここ1か所** */
export const LISTENING_LABEL = '話し終わったら押す'

export default function SpeakCheckButton({ label, on = false, onClick, disabled = false }) {
  return (
    <button type="button" disabled={disabled}
            className={`btn btn--small ${toneOn(on)}`}
            onClick={onClick}>
      {on ? <><StopIcon />{LISTENING_LABEL}</> : <><MicIcon />{label}</>}
    </button>
  )
}
