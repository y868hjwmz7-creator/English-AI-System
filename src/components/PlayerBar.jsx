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
 * 【置き場所は2通り。**覚える**】(利用者の指定「切り替えられると最高」)
 *
 *   | どこ | いつ向くか |
 *   |---|---|
 *   | **右下**(`float`・既定) | 紙を読みながら。押したいときに手元にある |
 *   | **上の帯の下**(`bar`)  | 画面共有のとき。相手にも見える場所に出る |
 *
 *   既定は右下。**これまでと同じ場所**なので、切り替えない人には
 *   何も変わったように見えない(2026-09 の「Listen (全体) を右下に」)。
 *
 * 【出す数字は「段落」まで】
 *   1つの段落の中で何秒めか、までは出さない。**数えていないものを、
 *   数えているように見せない**(CLAUDE.md)。段落の単位なら、
 *   紙の上で光っている段落とぴったり合う。
 *
 * 【三角は文字で描く】
 *   絵文字は端末ごとに形も大きさも違う(`Stepper.jsx` と同じ理由)。
 */
import { SpeakerIcon, StopIcon } from './Icons.jsx'
import SentenceSkip from './SentenceSkip.jsx'
import RepeatUnit from './RepeatUnit.jsx'

/**
 * @param place     'float'(右下)/ 'bar'(上の帯の下)
 * @param onPlace   置き場所を変える
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
  place = 'float', onPlace = null,
  playing = false, label = null, at = null, total = 0, unit = '段落',
  onToggle, onJump = null, repeat = null, onRepeat = null,
}) {
  if (!total) return null
  const now = Number.isFinite(at) ? at : null
  // **鳴っていないときは、どこまで来たかを 0 にしない。**
  // 止めた場所から再開するので、その場所を出しておくほうが正しい
  const shown = now == null ? null : now + 1
  const ratio = shown == null ? 0 : shown / total

  return (
    <div className={`player player--${place} no-print`}
         role="group" aria-label="読み上げの操作">
      {/* **鳴らすボタンの両脇は「文」**(2026-09 利用者の指定)。
          1本にまとめた音声のときだけ効く(時刻を控えてあるため) */}
      <SentenceSkip>
        <button type="button"
                className={`btn btn--small player-play${playing ? ' is-on' : ''}`}
                onClick={onToggle}>
          {playing
            ? <><StopIcon />{label ?? 'Stop'}</>
            /* **狭い画面では「(全体)」を落とす**(2026-09 実機・利用者の指定
                 「再生プレーヤーが2行になるのは絶対にダメです」)。
               すぐ右に「3 / 6 段落」があるので、通しであることは伝わる。
               **落とすのは添えの言葉だけ** —— 「Listen」は必ず残る */
            : <><SpeakerIcon />{label ?? (<>Listen<span className="wide-text"> (全体)</span></>)}</>}
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

      {/* 置き場所。**一度決めれば触らない**ので、いちばん端に小さく置く */}
      {onPlace && (
        <button type="button" className="btn btn--small btn--ghost player-place"
                aria-label={place === 'float' ? '上の帯に出す' : '右下に出す'}
                title={place === 'float' ? '上の帯に出す' : '右下に出す'}
                onClick={() => onPlace(place === 'float' ? 'bar' : 'float')}>
          {place === 'float' ? '▲' : '▼'}
        </button>
      )}
    </div>
  )
}
