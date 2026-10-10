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
 * 【見た目は、4つとも1つの形】(第5.439節・2026-10-09 利用者の指摘)
 *
 *   > 現状は各ボタンの高さ・幅・色・枠線のルールが揃っておらず(略)
 *   > 4つの操作ボタンを、同じ高さ・角丸・枠線の太さで揃える
 *
 *   **高さ・角丸・枠線・色を、ここで決めない。** 3つとも
 *   `btn btn--small btn--quiet`(ふつうのボタン・小さめ・灰)を着せ、
 *   足りないぶんだけ `.knob` が足す。**4つめの「聴く」も同じ組**を着る
 *   (呼ぶ側が `SpeakButton` に渡している)ので、**ひとりでにそろう** ——
 *   **数も色も書き写さない**(CLAUDE.md)。
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
      {/* ★ **何問ずつ。プルダウンだが、見た目はとなりの3つとまったく同じ**
             (第5.439節・2026-10-09 利用者の指摘「高さ・幅・色・枠線の
             ルールが揃っておらず」)。

             **素の `<select>` をそのまま置くと、3つとそろわない。**
             理由は2つ。

               ①狭い画面では `font-size: 16px` を強いている(iOS が
                 16px 未満の入力欄に触れると画面を拡大するため・CLAUDE.md)。
                 となりのボタンは 13px なので、**字の大きさが違う**
               ②Safari の矢印のぶんの `padding-right: 28px` が要る。
                 72px の升目では「10 問」が入り切らない

             だから**見えている面は `<span>` で描き、`<select>` は
             透明にして升目いっぱいに重ねる。** 押すと端末の選ぶ画面が出る
             —— 本物の `<select>` なので、読み上げもキーボードもそのまま効く。
             **16px のままなので、iOS も拡大しない。**

             **言葉は `sizePickLabel()` 1か所**(見えている面と、
             中の選択肢の両方が、同じところから来る) */}
      <label className="btn btn--small btn--quiet knob knob-size">
        <span className="knob-face">
          {sizePickLabel(size, unit)}
          <span className="knob-caret" aria-hidden="true" />
        </span>
        <select
          className="knob-pick"
          aria-label={`何${unit}ずつ`}
          value={String(size)}
          onChange={(e) => onSize(sizeOfValue(e.target.value))}
        >
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
          className={`btn btn--small btn--quiet knob${shuffle ? ' chip--on' : ''}`}
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
          className={`btn btn--small btn--quiet knob${repeat ? ' chip--on' : ''}`}
          onClick={() => onRepeat(!repeat)}
        >
          <RepeatIcon />
        </button>
      )}
    </>
  )
}
