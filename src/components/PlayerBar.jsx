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
 * 【置き場所は2通り。**覚える**】(**浮かせるは廃止**・第5.311節)
 *
 *   | どこ | いつ向くか | 形 |
 *   |---|---|---|
 *   | **上の帯の中**(`bar`)  | 画面共有。相手にも見える。**広い窓だけ** | 絵だけの1行 |
 *   | **画面の下の黒帯**(`dock`) | それ以外ぜんぶ。親指が届く | 3段 |
 *
 *   **押すものは、どちらも同じ `PlayKey` と同じ鳴らすボタン**である
 *   (2026-09-29 利用者の指定「下部に置くものと同じにしてください」)。
 *   違うのは**札を出すかどうか**だけ —— 上の帯は1行しかないためである。
 *
 *   **どこへ出すかの判断は `playerPlace.js` 1か所**(画面に持たせない)。
 *
 * ============================================================================
 * 【**黒帯は3段。音楽プレーヤーの形**】(2026-09-29 利用者の指定・第5.311節)
 *
 *   > 画面下部分の音声プレーヤーを添付の写真のようなスタイルに
 *   > 変更してもらえませんか？ ここにどうやって段落と文章ごとの
 *   > 先送りと戻しボタンをしれこむかが課題です。
 *
 *   4枚描いて見比べてもらい、**案A**(外側が段落・内側が文)に決まった。
 *
 *       ╭──────────────────────────────────────────╮
 *       │  3 / 6 段落        ⤺ しない   速さ ◀100%▶ │
 *       │  ━━━━━━━━━●────────────────────────────  │
 *       │    ⏮⏮      ⏮      ( ▶ )     ⏭      ⏭⏭    │
 *       │    段落     文               文     段落   │
 *       ╰──────────────────────────────────────────╯
 *
 *   **送り戻しが「外側 = 段落 / 内側 = 文」**になっているので、
 *   どちらを送るのかが**指の位置で決まる**(札も添えてある)。
 *
 *   **上の帯(`bar`)は1行のまま。** 言われたのは「画面下部分」なので、
 *   そちらは触っていない(**言われた場所だけを直す**・CLAUDE.md)。
 *
 * 【速さは、ここにも置く】(2026-09-29 利用者の指定)
 *
 *   > ①ふたつ実装してください(これは例外でOKです)
 *
 *   速さは「大きく表示」の帯にもある。**同じことをするものを2つ見せない**
 *   という決まりの例外として、利用者の指定で**両方に置く。**
 *   **中身は同じ `Stepper` と同じ `SPEECH_RATES`** なので、
 *   段の数や刻みが食い違うことは無い(呼び名も数え方も1か所)。
 *
 * 【出す数字は「段落」まで】
 *   1つの段落の中で何秒めか、までは出さない。**数えていないものを、
 *   数えているように見せない**(CLAUDE.md)。段落の単位なら、
 *   紙の上で光っている段落とぴったり合う。
 *   **つまみも段落に吸い付く**(2026-09-29 利用者の指定
 *   「動かせるようにして段落を進めたり戻せるようにしてください」)——
 *   `<input type="range">` の `step=1` がそのまま段落1つぶんである。
 *   指でもマウスでもキーボードでも動かせる。
 *
 * 【三角は文字で描く】
 *   絵文字は端末ごとに形も大きさも違う(`Stepper.jsx` と同じ理由)。
 */
import { useEffect, useRef, useState } from 'react'
/* ★ **まん中は ▶ と ■**(2026-09-29 実機・利用者の指定)。
     > 中央の再生ボタンはスピーカーのマークではなく▶︎と■にしてください
   スピーカーの絵は「音が出る」としか言っていない ——
   **鳴っているのか止まっているのか**が、絵から分からなかった。
   `PlayIcon`(三角)/ `StopIcon`(四角)は**すでにある絵**である
   (聞き流しの「つづける」と同じ)。ここで新しく描かない */
import { PlayIcon, StopIcon } from './Icons.jsx'
import RepeatUnit from './RepeatUnit.jsx'
import Stepper from './Stepper.jsx'
import { SPEECH_RATES } from '../lib/speechRate.js'
import { canSkipSentence, skipSentence, watchSentenceSkip } from '../lib/readAloud.js'
import { useFitRow } from '../lib/fitRow.js'
/* **通しで鳴らすボタンの文字は1か所**(第5.290節)。
   狭い画面で落とすのは `WIDE` のほうだけ —— `CORE` は必ず残る */
import { WHOLE_PLAY_CORE, WHOLE_PLAY_WIDE } from '../lib/wholePlay.js'

/**
 * **送り戻しのボタン1つ**(黒帯の下の行)。
 *
 * **三角は自分で描く**(絵文字は端末ごとに形が違う・CLAUDE.md)。
 * 外側(段落)は三角2つ + 縦棒、内側(文)は三角1つ + 縦棒にして、
 * **絵だけで「どちらが大きく飛ぶか」**が分かるようにする。
 */
function PlayKey({ dir, label, wide, disabled, onClick }) {
  const say = `${label}${dir < 0 ? 'もどる' : 'すすむ'}`
  return (
    <span className="player-key">
      <button type="button" className="player-key-btn"
              aria-label={say} title={say}
              disabled={disabled} onClick={onClick}>
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"
             fill="currentColor" className="player-key-icon">
          {dir < 0 ? (
            <>
              <rect x="4" y="5" width="2.6" height="14" rx="1.3" />
              <path d="M16 5.6v12.8L7.6 12z" />
              {wide && <path d="M23 5.6v12.8L14.6 12z" />}
            </>
          ) : (
            <>
              {wide && <path d="M1 5.6v12.8L9.4 12z" />}
              <path d="M8 5.6v12.8L16.4 12z" />
              <rect x="17.4" y="5" width="2.6" height="14" rx="1.3" />
            </>
          )}
        </svg>
      </button>
      {/* ★ **札(文 / 段落)は出さない**(2026-09-29 実機・利用者の指定)。
            > 文、段落、の文字が不必要です

          **名前は消えていない** —— `aria-label` と `title` が
          「段落すすむ」「文もどる」と言う(読み上げにも、
          マウスを乗せたときにも出る)。
          絵のほうも、**三角の数**で見分けられる(2つ = 段落・1つ = 文)。 */}
    </span>
  )
}

/**
 * @param place     'bar'(上の帯)/ 'dock'(画面の下の黒帯)
 * @param onPlace   置き場所を変える(次の行き先を渡してくる)
 * @param placeNext 次に移る先の名前(ボタンの説明に出す)
 * @param playing   いま鳴っているか
 * @param at        いま何番目(0 から)。鳴っていなければ null
 * @param total     ぜんぶで何個か
 * @param unit      数え方の名前(段落 / 発言)
 * @param onToggle  鳴らす・止める
 * @param onJump    その番号から鳴らす(送り戻し・つまみ)
 * @param repeat    くり返しの単位('off' / 'sentence' / 'item' / 'all')
 * @param onRepeat  単位を変える
 * @param rate      読み上げの速さ(`SPEECH_RATES` の id)
 * @param onRate    速さを変える。**渡されたときだけ出す**
 */
export default function PlayerBar({
  place = 'dock', onPlace = null, placeNext = null,
  playing = false, at = null, total = 0, unit = '段落',
  onToggle, onJump = null, repeat = null, onRepeat = null,
  rate = null, onRate = null,
}) {
  /**
   * **入るまで詰める**(2026-09 実機・利用者の指摘
   * 「スマホで『繰り返す』がはみ出てしまう」)。
   *
   * 狭い画面の詰め方は **560px / 360px の境目**で書いてあった。
   * ところが端末の「表示を大きく」で文字が 1.25 倍になると、
   * **390px でも入らない**(くり返しの単位が画面の外へ切れる)。
   * **幅だけでは決まらない**ので、`useFitRow` で実際に測って詰める。
   *
   * **上の帯のときは測らない。** あちらは `.lesson-bar` の側が
   * 帯まるごとを測って詰めており、**二重に詰めると食い違う。**
   *
   * **黒帯では、測るのは上の行だけ。**(第5.311節)
   * 下の行は5つのボタンだけで、言葉を削る余地がそもそも無い ——
   * あちらは CSS の側が、幅に合わせてボタンを縮める。
   */
  const barRef = useRef(null)
  const headRef = useRef(null)
  useFitRow(place === 'dock' ? headRef : barRef)

  /* 1文ずつ動かせるか。**知っているのは `readAloud.js`** なので、そちらに訊く
     (`SentenceSkip` とまったく同じ引き方 —— 判断を画面に持たせない) */
  const [bySentence, setBySentence] = useState(canSkipSentence)
  useEffect(() => watchSentenceSkip(setBySentence), [])


  if (!total) return null
  const now = Number.isFinite(at) ? at : null
  // **鳴っていないときは、どこまで来たかを 0 にしない。**
  // 止めた場所から再開するので、その場所を出しておくほうが正しい
  const shown = now == null ? null : now + 1

  /** 鳴らす・止めるボタンの説明。**言葉は `wholePlay.js` 1か所**(第5.290節) */
  const playSay = playing ? '止める' : `${WHOLE_PLAY_WIDE}${WHOLE_PLAY_CORE}`

  /* ══════════════════════════════════════════════════════════════
     **上の帯(`bar`)—— 絵だけの1行**(2026-09-29 利用者の指定)

       > 上部のバーのボタンは「聴く」は必要なく、「▷」など、
       > アイコンだけで作って、下部に置くものと同じにしてください

     **下の黒帯と同じ `PlayKey` と同じ鳴らすボタン**を使う ——
     絵を2組持つと、片方だけ古くなる(**判断は1か所**・CLAUDE.md)。
     違うのは**札を出さないこと**だけで、それは1行しかないためである
     (名前は `aria-label` と `title` に、どちらも同じ言葉で残っている)。
     ══════════════════════════════════════════════════════════════ */
  if (place !== 'dock') {
    return (
      <div className={`player player--${place} no-print`}
           ref={place === 'bar' ? null : barRef}
           role="group" aria-label="読み上げの操作">
        <span className="player-at">
          {shown == null ? `— / ${total}` : `${shown} / ${total}`}
          <span className="wide-text"> {unit}</span>
        </span>

        {/* **外側が段落・内側が文**(黒帯とまったく同じ並び) */}
        <div className="player-keys player-keys--bar">
          <PlayKey dir={-1} label={unit} wide
                   disabled={!onJump || now == null || now <= 0}
                   onClick={() => onJump?.(now - 1)} />
          <PlayKey dir={-1} label="文"
                   disabled={!bySentence}
                   onClick={() => skipSentence(-1)} />

          <button type="button"
                  className={`player-big player-big--bar${playing ? ' is-on' : ''}`}
                  aria-label={playSay} title={playSay}
                  onClick={onToggle}>
            {playing ? <StopIcon className="icon" /> : <PlayIcon className="icon" />}
          </button>

          <PlayKey dir={1} label="文"
                   disabled={!bySentence}
                   onClick={() => skipSentence(1)} />
          <PlayKey dir={1} label={unit} wide
                   disabled={!onJump || now == null || now >= total - 1}
                   onClick={() => onJump?.(now + 1)} />
        </div>

        {onRepeat && (
          <RepeatUnit value={repeat ?? 'off'} unit={unit} onChange={onRepeat} />
        )}

        {onPlace && placeNext && (
          <button type="button" className="btn btn--small btn--ghost player-place"
                  aria-label={placeNext} title={placeNext}
                  onClick={onPlace}>▼</button>
        )}
      </div>
    )
  }

  /* ══════════════════════════════════════════════════════════════
     **画面の下の黒帯 —— 3段**(第5.311節・利用者の指定した案A)
     ══════════════════════════════════════════════════════════════ */
  /* 進み具合のバーを取り払ったので、動かしているあいだの見た目も要らない
     (2026-09-29 利用者の指定)。出す数字は、鳴っている場所そのもの */
  const dockShown = shown
  return (
    <div className="player player--dock no-print"
         role="group" aria-label="読み上げの操作">

      {/* ── ① いまどこか・くり返し・速さ ────────────────────────── */}
      <div className="player-head" ref={headRef}>
        <span className="player-at">
          {dockShown == null ? `— / ${total}` : `${dockShown} / ${total}`}
          <span className="wide-text"> {unit}</span>
        </span>

        {onRepeat && (
          <RepeatUnit value={repeat ?? 'off'} unit={unit} onChange={onRepeat} />
        )}

        {/* **速さも、ここに置く**(2026-09-29 利用者の指定「ふたつ実装して」)。
            **段も刻みも `SPEECH_RATES` 1か所**なので、
            「大きく表示」の帯にあるものと食い違わない */}
        {onRate && (
          <Stepper label="速さ" options={SPEECH_RATES} value={rate}
                   onChange={onRate} className="player-rate" />
        )}

        {onPlace && placeNext && (
          <button type="button" className="btn btn--small btn--ghost player-place"
                  aria-label={placeNext} title={placeNext}
                  onClick={onPlace}>▲</button>
        )}
      </div>

      {/* ★ **進み具合のバーは取り払った**(2026-09-29 実機・利用者の指定)。
            > また、この再生バーは不必要なので取り払いましょう。
            > 場所を取るだけですね

          段落を選ぶ道は**なくなっていない** —— 送り戻しの ⏮⏮ / ⏭⏭ と、
          本文の**発言ごとの再生ボタン**(同じ日に戻した)が受け持つ。
          いまどこかは、上の行の「3 / 14 発言」がそのまま言っている。 */}

      {/* ── ② 送り戻しと、鳴らすボタン ──────────────────────────
            **外側が段落・内側が文**(利用者がえらんだ案A)。
            どちらを送るのかが、指の位置で決まる */}
      <div className="player-keys">
        <PlayKey dir={-1} label={unit} wide
                 disabled={!onJump || now == null || now <= 0}
                 onClick={() => onJump?.(now - 1)} />
        <PlayKey dir={-1} label="文"
                 disabled={!bySentence}
                 onClick={() => skipSentence(-1)} />

        <button type="button"
                className={`player-big${playing ? ' is-on' : ''}`}
                aria-label={playSay} title={playSay}
                onClick={onToggle}>
          {playing ? <StopIcon className="icon" /> : <PlayIcon className="icon" />}
        </button>

        <PlayKey dir={1} label="文"
                 disabled={!bySentence}
                 onClick={() => skipSentence(1)} />
        <PlayKey dir={1} label={unit} wide
                 disabled={!onJump || now == null || now >= total - 1}
                 onClick={() => onJump?.(now + 1)} />
      </div>
    </div>
  )
}
