/**
 * ★ **練習の最中に出す操作**(第5.437節 → **第5.441節で絵だけにした**)。
 *
 * ============================================================================
 * 【いまの形】(2026-10-10 利用者の指定・実寸の絵を並べて選んでもらった)
 *
 *   > シャッフルとリピートは囲みなしのアイコンのみにするべきな気がします。
 *   > 出し方はやはり右上のアイコンからだけにする方が良いかもしれません。
 *   > うるさすぎます
 *   > 問数(10 問)はカードから外し、右上の絞り込みの中だけでよいか → はい
 *
 *   **囲みを全部外し、絵だけ4つ**にした。
 *
 *     [卒業帽]  [札シャッフル]  [10 を囲む矢印]  [スピーカー]
 *
 *   ・**問数のプルダウンは廃止した。** 選ぶのは右上の絞り込みの中だけ。
 *     ただし**いま何問ずつ回っているかは見えていないと困る**ので、
 *     くり返しの絵の中に数を入れた(`RepeatCountIcon`)
 *   ・4つめの「聴く」は**呼ぶ側(`QrCard` / `Wordbook`)が置く** ——
 *     あれは `SpeakButton` が鳴らす状態を持っているので、ここには来ない
 *
 * 【なぜ部品にしたか】
 *
 *   単語帳と Quick Response の**両方**に、まったく同じものを置く
 *   (2026-10-09 利用者の指定「これは単語帳にも共通の仕様にしたいです」)。
 *   **書き写すと、片方だけ古くなる**(CLAUDE.md「判断は1か所に持つ」)。
 *   **並び順も、ここ1か所が持つ。**
 *
 * 【高さ・大きさ・色は、ここで1つも書かない】
 *
 *   4つとも `btn btn--small knob` を着る。
 *   **足りないぶん(押せる的の大きさ・絵の大きさ・囲みを外すこと)は
 *   `.knob` が1か所で持つ**(`styles.css`)——
 *   数を書き写さない(CLAUDE.md)。
 *
 * 【入っている印は `.chip--on` 1か所から来る】
 *
 *   うすい金の地 + 金の絵。**色だけに頼らない**(CLAUDE.md)ので、
 *   休んでいるときは地色が無く、**形の違いでも分かる。**
 *   `aria-pressed` も付けるので、読み上げにも届く。
 *   **ここで新しい配色を作らない。**
 *
 * 【字を出さないので、読み上げには `aria-label` で届ける】
 *
 *   くり返しは**いま何問ずつかも言う** —— 絵の中の数は
 *   `aria-hidden` の中にいるので、字で言い直さないと伝わらない。
 */
/* **問数の言い方は `sizeLabel()` 1か所**(第5.441節)。
   `'all'` を「All」と書くのはあちらの持ちもので、ここに書き写さない */
import { sizeLabel } from '../lib/reviewScope.js'
import { CardShuffleIcon, RepeatCountIcon } from './Icons.jsx'

export default function PracticeKnobs({
  unit = '問',
  size,
  shuffle = true, onShuffle = null,
  repeat = false, onRepeat = null,
  /**
   * ★ **行のいちばん左に置くもの**(第5.441節)。
   * 復習の画面の「もう出さない」(卒業帽)がここに入る。
   *
   * **渡されなければ出ない** —— 単語帳と、教材の中の Quick Response には
   * 「もう出さない」が無い(**言われていない場所を変えない**)。
   *
   * **並び順をここに持つ**ために、呼ぶ側から中身だけを受け取る ——
   * もとはカードの右上(`corner`)に置いていたが、
   * **番号(丸の数字)を右端へ押しのけていた**(2026-10-10 利用者の指摘)。
   */
  retire = null,
}) {
  return (
    <>
      {retire}
      {onShuffle && (
        <button
          type="button"
          aria-pressed={shuffle}
          aria-label="ランダム"
          title="ランダム"
          className={`btn btn--small knob${shuffle ? ' chip--on' : ''}`}
          onClick={() => onShuffle(!shuffle)}
        >
          <CardShuffleIcon />
        </button>
      )}
      {onRepeat && (
        <button
          type="button"
          aria-pressed={repeat}
          aria-label={`くり返す(${sizeLabel(size)} ${unit}ずつ)`}
          title={`くり返す(${sizeLabel(size)} ${unit}ずつ)`}
          className={`btn btn--small knob${repeat ? ' chip--on' : ''}`}
          onClick={() => onRepeat(!repeat)}
        >
          <RepeatCountIcon label={sizeLabel(size)} />
        </button>
      )}
    </>
  )
}
