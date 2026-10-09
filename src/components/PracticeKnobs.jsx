/**
 * ★ **練習の最中に出す「出しかた」の3つ**(第5.437節・2026-10-09 利用者の指定)。
 *
 *   > この空いたスペースに、出す数と繰り返しとランダムのオンオフの
 *   > ボタンをおきたいです
 *   > 繰り返しとランダムは音声プレーヤーのアイコンを流用します。
 *   > これは角が丸い長方形で囲います。
 *   > 何問ずつ出すかは5問から選べ、そしてプルダウンか何かの形にします。
 *
 * ============================================================================
 * 【なぜ部品にしたか】
 *
 *   単語帳と Quick Response の**両方**に、まったく同じ3つを置く
 *   (2026-10-09 利用者の指定「これは単語帳にも共通の仕様にしたいです」)。
 *   **書き写すと、片方だけ古くなる**(CLAUDE.md「判断は1か所に持つ」)。
 *
 * 【絵は、下のプレーヤーとまったく同じもの】
 *
 *   `ShuffleIcon` / `RepeatIcon` は `Icons.jsx` 1か所にある。
 *   **ここで描き直さない** —— 描き直すと、片方だけ形が変わる。
 *
 * 【字を出さないので、読み上げには `aria-label` で届ける】
 *
 *   絵だけにしたのは、**鳴っている最中に「聴く」→「Stop」で幅が
 *   変わらないようにする**ためでもある(「押しても、まわりの物が
 *   動かない」・共通ルール)。
 *
 * 【押している印は、色だけに頼らない】
 *
 *   `aria-pressed` + うすい地色 + 枠線 + 絵の色。`.chip--on` が
 *   その4つをまとめて持っているので、**ここで新しい配色を作らない。**
 */
import { SIZES, sizeOfValue, sizePickLabel } from '../lib/reviewScope.js'
import { RepeatIcon, ShuffleIcon } from './Icons.jsx'

export default function PracticeKnobs({
  unit = '問',
  size, onSize,
  shuffle = true, onShuffle = null,
  repeat = false, onRepeat = null,
}) {
  return (
    <>
      {/* **何問ずつ。** 一覧も言い方も `reviewScope.js` 1か所 */}
      <label className="knob knob-size">
        <span className="sr-only">{`何${unit}ずつ`}</span>
        <select value={String(size)} onChange={(e) => onSize(sizeOfValue(e.target.value))}>
          {SIZES.map((n) => (
            <option key={String(n)} value={String(n)}>{sizePickLabel(n, unit)}</option>
          ))}
        </select>
      </label>
      {onShuffle && (
        <button
          type="button"
          aria-pressed={shuffle}
          aria-label="ランダム"
          title="ランダム"
          className={`btn btn--quiet knob${shuffle ? ' chip--on' : ''}`}
          onClick={() => onShuffle(!shuffle)}
        >
          <ShuffleIcon />
        </button>
      )}
      {onRepeat && (
        <button
          type="button"
          aria-pressed={repeat}
          aria-label="くり返す"
          title="くり返す"
          className={`btn btn--quiet knob${repeat ? ' chip--on' : ''}`}
          onClick={() => onRepeat(!repeat)}
        >
          <RepeatIcon />
        </button>
      )}
    </>
  )
}
