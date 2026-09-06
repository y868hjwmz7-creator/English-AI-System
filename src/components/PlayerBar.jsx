/**
 * 通しの読み上げの**操作盤**(2026-09 利用者の指定)。
 *
 * ============================================================================
 * 【なぜ要るのか】
 *
 *   > 全文を聞いている途中にストップを押し、もう一度再生を押すと、
 *   > また元に戻ってしまいます。止めた場所から再び再生する機能がほしいです。
 *   > これは段落ごとの再生ボタンでも同じ仕様にしてください。
 *   > そうすると音声プレーヤーのUIを入れるのも良いですね。
 *   > (上部バーもしくはフロート(切り替えられると最高))
 *
 *   「止めた場所から」が効くようになると、**いまどこを鳴らしているのか**が
 *   要る情報になる。5段落目から再開したのか、頭からなのかが分からないと、
 *   押した結果を確かめられない。あわせて**段落を送り戻す**道も要る
 *   (聞き逃した1つ前へ戻るのに、いちいち紙を探して押すことになる)。
 *
 * 【置き場所は3通り。**覚える**】(利用者の指定「切り替えられると最高」)
 *
 *   | どこ | いつ向くか |
 *   |---|---|
 *   | **上の帯の中**(`bar`)  | 画面共有のとき。相手にも見える。**広い窓だけ** |
 *   | **画面の下の黒帯**(`dock`) | スマホ・パッドの既定。親指が届く |
 *   | **浮かせる**(`float`) | 紙の見たいところを空けたいとき。**つまんで動かせる** |
 *
 *   2026-09、利用者の指定で**画面の下の黒帯**を足した。
 *
 *     > スマホの再生プレーヤーがダサいですね。。。いっそのこと画面の下部に
 *     > 黒帯にした中に固定にした方がスタイリッシュな気がします。
 *     > パッドでもデフォルトは同じ仕様で、任意でフロート型にして移動できる
 *     > ように。PCの画面でもフロートにした時は端っこにドラッグできる部分を
 *     > 作って移動させれるようにしたいです
 *
 *   **どこへ出すかの判断は `playerPlace.js` 1か所**(画面に持たせない)。
 *
 * 【出す数字は「段落」まで】
 *   1つの段落の中で何秒めか、までは出さない。**数えていないものを、
 *   数えているように見せない**(CLAUDE.md)。段落の単位なら、
 *   紙の上で光っている段落とぴったり合う。
 *
 * 【三角は文字で描く】
 *   絵文字は端末ごとに形も大きさも違う(`Stepper.jsx` と同じ理由)。
 */
import { useRef } from 'react'
import { SpeakerIcon, StopIcon } from './Icons.jsx'
import SentenceSkip from './SentenceSkip.jsx'
import RepeatUnit from './RepeatUnit.jsx'
import { useFitRow } from '../lib/fitRow.js'

/**
 * @param place     'bar'(上の帯)/ 'dock'(画面の下の黒帯)/ 'float'(浮かせる)
 * @param onPlace   置き場所を変える(次の行き先を渡してくる)
 * @param placeNext 次に移る先の名前(ボタンの説明に出す)
 * @param onGrab    浮かせているとき、つまんで動かすためのつまみ
 * @param playing   いま鳴っているか
 * @param label     ボタンの文言(用意しています… を出すため)
 * @param at        いま何番目(0 から)。鳴っていなければ null
 * @param total     ぜんぶで何個か
 * @param unit      数え方の名前(段落 / 発言)
 * @param onToggle  鳴らす・止める
 * @param onJump    その番号から鳴らす(送り戻し)
 * @param repeat    くり返しの単位('off' / 'sentence' / 'item' / 'all')
 * @param onRepeat  単位を変える
 */
export default function PlayerBar({
  place = 'float', onPlace = null, placeNext = null,
  onGrab = null, moved = false, onResetPos = null,
  playing = false, label = null, at = null, total = 0, unit = '段落',
  onToggle, onJump = null, repeat = null, onRepeat = null,
}) {
  /**
   * **右下では、入るまで詰める**(2026-09 実機・利用者の指摘
   * 「スマホで『繰り返す』がはみ出てしまう」)。
   *
   * 狭い画面の詰め方は **560px / 360px の境目**で書いてあった。
   * ところが端末の「表示を大きく」で文字が 1.25 倍になると、
   * **390px でも入らない**(くり返しの単位が画面の外へ切れる)。
   * **幅だけでは決まらない**ので、`useFitRow` で実際に測って詰める
   * (集中モードの下の帯・レッスン表示の帯と同じ考え方)。
   *
   * **上の帯のときは測らない。** あちらは `.lesson-bar` の側が
   * 帯まるごとを測って詰めており、**二重に詰めると食い違う。**
   *
   * **画面の下の黒帯でも測る**(2026-09)。横いっぱいでも、
   * iPhone(390px)では押すものが入りきらず、
   * **くり返しが画面の外へ切れていた**(実測して気づいた)。
   */
  const boxRef = useRef(null)
  useFitRow(boxRef)

  if (!total) return null
  const now = Number.isFinite(at) ? at : null
  // **鳴っていないときは、どこまで来たかを 0 にしない。**
  // 止めた場所から再開するので、その場所を出しておくほうが正しい
  const shown = now == null ? null : now + 1
  const ratio = shown == null ? 0 : shown / total

  return (
    <div className={`player player--${place} no-print`}
         ref={place === 'bar' ? null : boxRef}
         role="group" aria-label="読み上げの操作">
      {/* ── つまみ(2026-09 利用者の指定)────────────────────────────
            > フロートにした時は端っこにドラッグできる部分を作って
            > 移動させれるようにしたいです

          **浮かせているときだけ出す。** 帯の中や画面の下の黒帯は
          動かしようがないので、出しても効かない(効かない操作を見せない)。

          **押すボタンにしない。** ここは掴む場所であって、押しても何も
          起きない。だから `<span>` のまま `aria-hidden` にし、
          **戻す道はとなりの置き場所ボタン**が受け持つ */}
      {onGrab && (
        <span className="player-grip" aria-hidden="true"
              title="つまんで動かす" onPointerDown={onGrab} />
      )}

      {/* **鳴らすボタンの両脇は「文」**(2026-09 利用者の指定)。
          1本にまとめた音声のときだけ効く(時刻を控えてあるため) */}
      <SentenceSkip>
        <button type="button"
                className={`btn btn--small player-play${playing ? ' is-on' : ''}`}
                onClick={onToggle}>
          {/* **言葉は `.listen-word` に入れておく。** それでも入らないときは
              絵だけになる(`.player--float.is-fit1`)。すぐ右に「3 / 6」が
              あるので、鳴らすボタンだと分かる。
              **「用意しています…」は消さない** —— あれは `label` の側で、
              音が出るまで何も起きていないように見えてしまう */}
          {playing
            ? <><StopIcon />{label ?? <span className="listen-word">Stop</span>}</>
            /* **狭い画面では「(全体)」を落とす**(2026-09 実機・利用者の指定
                 「再生プレーヤーが2行になるのは絶対にダメです」)。
               すぐ右に「3 / 6 段落」があるので、通しであることは伝わる。
               **落とすのは添えの言葉だけ** —— 「Listen」は必ず残る */
            : <><SpeakerIcon />{label ?? (
              <span className="listen-word">Listen<span className="wide-text"> (全体)</span></span>
            )}</>}
        </button>
      </SentenceSkip>

      {/* **段落の数の両脇は「段落」**(2026-09 利用者の指定)。
            > 段落の数字の左右に◁▷を配置して、一つのプレーヤーで
            > 段落と文章どちらも飛ばせるようにしてください

          いまどこか。**幅をそろえる**(そろえないと、送るたびに隣が動く) */}
      <SentenceSkip
        label={`${unit}を`}
        onStep={(d) => onJump?.(now + d)}
        canBack={!!onJump && now != null && now > 0}
        canNext={!!onJump && now != null && now < total - 1}
      >
        <span className="player-at">
          {shown == null ? `— / ${total}` : `${shown} / ${total}`}
          {/* **単位の言葉だけを、狭い画面で落とす**(2026-09 実測)。
              数ごと消していたので、**中身の無い ◀ ▶** になっていた。
              数が残っていれば、何を送っているかは分かる */}
          <span className="wide-text"> {unit}</span>
        </span>
      </SentenceSkip>

      {/* **くり返し**(2026-09 利用者の指定)。
            > 文章単位、段落単位、全文単位、三つ選べるような。

          押すたびに単位が移る。**渡されなければ出さない**
          (効かない操作を見せない) */}
      {onRepeat && (
        <RepeatUnit value={repeat ?? 'off'} unit={unit} onChange={onRepeat} />
      )}

      {/* 進み具合。**段落の単位**である(秒までは数えていない) */}
      <span className="player-track" aria-hidden="true">
        <span className="player-fill" style={{ width: `${Math.round(ratio * 100)}%` }} />
      </span>

      {/* 動かした位置を元へ戻す。**動かしたときだけ出す**
          (押す前から出すと、何が「元」なのか分からない) */}
      {moved && onResetPos && (
        <button type="button" className="btn btn--small btn--ghost player-home"
                aria-label="元の場所へ戻す" title="元の場所へ戻す"
                onClick={onResetPos}>
          ⌖
        </button>
      )}

      {/* 置き場所。**一度決めれば触らない**ので、いちばん端に小さく置く。
          **押すたびに次へ移る**(上の帯 → 画面の下 → 浮かせる)。
          4つ並べると、めったに触らないものが場所を食う(`Stepper` と同じ)。
          **行き先を名前で言う** —— ▲▼ だけでは、3つあることが伝わらない */}
      {onPlace && placeNext && (
        <button type="button" className="btn btn--small btn--ghost player-place"
                aria-label={placeNext} title={placeNext}
                onClick={onPlace}>
          {place === 'bar' ? '▼' : place === 'dock' ? '◱' : '▲'}
        </button>
      )}
    </div>
  )
}
