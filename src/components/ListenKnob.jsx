/**
 * ★ **練習の行の4つめの絵**(第5.445節・②・2026-10-10 利用者の指定)。
 *
 *   > ボタンは四つだけにしつつ、上記の問題を解決する天才的な閃きは
 *   > ないですか
 *
 * ============================================================================
 * 【何が悩みだったか】
 *
 *   > 音声を聞くのと聞き流しが同じボタンなのはアイデアとしては良いですが、
 *   > そのまま進みたくない時は自分で止める必要がありますよね？
 *   > 純粋にその単語や文を聞きたい時は止めるタイミングなど気を使います。
 *
 *   **「聴く」は、いつも1枚だけ鳴らして止まる**(`SpeakButton` の
 *   ふだんのふるまい)。流すかどうかは**上の帯のボタン**が決める
 *   (`RadioToggle`)。だから「止めるタイミング」に気を使う場面が無い。
 *
 *   **絵は4つのまま。** 5つめを足さない(利用者の指摘
 *   「アイコン5個はうるさいと感じます」)。
 *
 * 【流しているあいだは、ここが ■ になる】
 *
 *   流れているときに「聴く」を押せるままにすると、**音が二重に鳴る。**
 *   だから**同じ場所が「とめる」になる** ——
 *   いちばん近いところに止める道がある形でもある
 *   (**行き止まりを作らない**・CLAUDE.md)。
 *
 *   色は `.chip--on` 1か所から(うすい金の地 + 金の絵)。
 *   **色だけに頼らない** —— 絵がスピーカーから ■ に変わる。
 *
 * 【大きさは1つも書かない】
 *
 *   `.knob` が押せる的(44px)と絵(32px)を1か所で持っている。
 *   **ここで数を書かない**(CLAUDE.md)—— 絵が入れ替わっても
 *   **的の大きさは変わらない**ので、まわりの物は1px も動かない
 *   (共通ルール「押しても、まわりの物が動かない」)。
 */
import SpeakButton from './SpeakButton.jsx'
import { StopIcon } from './Icons.jsx'
import { RADIO_STOP } from '../lib/radioLabel.js'

/**
 * @param {string} o.text    鳴らす英文
 * @param {boolean} o.radioOn 聞き流しが流れているか
 * @param {function} o.onRadioStop 流れているときに押されたら
 */
export default function ListenKnob({
  text, radioOn = false, onRadioStop = null, ...rest
}) {
  /* **流れていて、止める道が渡っているときだけ ■ にする。**
     渡っていなければ、これまでどおりの「聴く」である
     (**既定は、いままでと同じ側**・CLAUDE.md) */
  if (radioOn && onRadioStop) {
    return (
      <button type="button" className="btn btn--small knob chip--on"
              aria-pressed="true" aria-label={RADIO_STOP} title={RADIO_STOP}
              onClick={onRadioStop}>
        <StopIcon />
      </button>
    )
  }
  /* **字は出さない**(第5.441節)。練習の行は**絵だけ4つ**にそろえてある ——
     `label={null}` / `icon` の決まりは `SpeakButton` 1か所が持つ */
  return <SpeakButton text={text} className="knob" label={null} {...rest} />
}
