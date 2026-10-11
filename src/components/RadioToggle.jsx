/**
 * ★ **聞き流しを、流す / とめる**(第5.445節・③・2026-10-10 利用者の指定)。
 *
 *   > こうなると上の帯の「聞き流し」のデザインもこだわりたいですね
 *
 * ============================================================================
 * 【置き場所は、いままでと同じ】
 *
 *   聞き流しが**別の画面**だったころ、このボタンは「聞き流しへ行く」
 *   入口だった。画面を分けるのをやめた(第5.445節・②)ので、
 *   **いまは「流す / とめる」の切り替え**である。
 *
 *   **置き場所は1ミリも動かしていない** —— 上の帯の、冊名のとなり。
 *   利用者が押し慣れたところで、意味だけが変わる。
 *
 * 【流しているあいだは、金が入る】
 *
 *   `.chip--on`(うすい金の地 + 金の字)**1か所から来る** ——
 *   ここで新しい配色を作らない(CLAUDE.md)。
 *   **色だけに頼らない** —— 絵が ■ になり、字が「とめる」になる。
 *   `aria-pressed` も付けるので、読み上げにも届く。
 *
 * 【押しても、まわりの物が動かない】(共通ルール)
 *
 *   「聞き流し」(4文字)が「とめる」(3文字)に縮むと、帯に並んでいる
 *   「出しかた」が左へずれる —— **押そうとしていたものが指の下で動く。**
 *   **起こりうる言葉のいちばん広いぶんを先に取る**(`SteadyLabel`)。
 *   言葉の一覧は `radioLabel.js` 1か所から来る(**数も字も書かない**)。
 */
import SteadyLabel from './SteadyLabel.jsx'
import { HeadphoneIcon, StopIcon } from './Icons.jsx'
import { RADIO_LISTEN, RADIO_STOP, RADIO_WORDS, radioCountLabel } from '../lib/radioLabel.js'

/**
 * @param {boolean} o.on       流れているか
 * @param {function} o.onToggle 押されたとき
 * @param {number} o.count     何語 / 何問ぶん流せるか(読み上げと吹き出しに出す)
 * @param {string} o.unit      「語」/「問」
 * @param {boolean} o.wide     **数まで字に出す**(一覧の下。幅に余裕がある)
 */
export default function RadioToggle({
  on = false, onToggle, count = 0, unit = '語',
  disabled = false, wide = false, className = '',
  /**
   * **前置き**(Quick Response だけ `RADIO_SAY_LEAD` を渡す)。
   * **言葉は `radioLabel.js` 1か所**から来る —— ここに書き写さない。
   */
  lead = '',
}) {
  /* **数は読み上げと吹き出しの側に残す**(第5.414節)。
     帯は ☰ / 冊名 ▾ / これ / 出しかた の4つが並ぶので、
     **語数まで字に入れると 320px で折り返した**(実測) */
  const 名前 = on ? RADIO_STOP : radioCountLabel(count, unit, lead)
  return (
    <button
      type="button"
      /* **一覧の下のぶんは灰の塗りつぶし、帯のぶんは枠線だけ** ——
         どちらも**もとの見た目のまま**(言われた場所だけを直す) */
      className={`btn btn--small ${wide ? 'btn--quiet' : 'btn--ghost'} ${className}`
        + (on ? ' chip--on' : '')}
      aria-pressed={on}
      disabled={disabled}
      aria-label={名前}
      title={名前}
      onClick={onToggle}
    >
      {on ? <StopIcon /> : <HeadphoneIcon />}
      {/* **取っておくのは `RADIO_WORDS` のぜんぶ**(書き写さない)。
          数まで出すぶんは、**いまの数で組んだものも**取っておく ——
          「12 語」が「120 語」になる日に、そこだけ動いては意味がない */}
      <SteadyLabel keep={wide ? [...RADIO_WORDS, radioCountLabel(count, unit, lead)] : RADIO_WORDS}>
        {wide ? 名前 : (on ? RADIO_STOP : RADIO_LISTEN)}
      </SteadyLabel>
    </button>
  )
}
