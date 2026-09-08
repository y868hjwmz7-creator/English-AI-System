/**
 * 集中モードの**骨組み**。3つの集中モードで分け合う。
 *
 * ============================================================================
 * 【なぜ1つにするのか】
 *   集中モードは3つある。
 *
 *   | どこ | 部品 | 中身 |
 *   |---|---|---|
 *   | 本文を読んで語を調べる | `FocusReader` | 1段落 / 1発言ずつ |
 *   | 6Steps | `StepFocus` | いまの取り組み方を1つずつ |
 *   | Quick Response | `QuickResponse` | 1問ずつ |
 *
 *   骨組み(`.focus` / 上の帯 / 白い紙 / 下の帯 / 出るボタン)は同じである。
 *   **書き写すと、必ずどこかだけ古くなる**
 *   (単語帳で `LearnerWordbook` を別に持って踏んだ失敗・CLAUDE.md)。
 *   だから**置き場所はここ1つ**にして、中身と帯の中だけを渡してもらう。
 *
 * 【ここが持つもの】
 *   - `createPortal` で **body の直下**に出す(紙の中に描かない)。
 *     紙は「明るい配色の島」なので、中に描くと画面ぜんぶが紙の白になる
 *   - **黒い地の上に、白い紙**(`.focus-paper`)。普通の画面と同じ形にする
 *   - **書き込む / メモ**(`useFocusBoard`)。帯の入れ替えも板もここ
 *   - うしろの画面を動かさない(`overflow: hidden`)
 *
 * 【ここが持たないもの】
 *   **キーボード**(Esc・矢印)は画面ごとに違う。
 *   ・`FocusReader` は「まとめ」を開いていたら Esc でそちらを先に閉じる
 *   ・`StepFocus` は文字を打っている最中は矢印を横取りしない
 *   ・Quick Response は矢印で送らない(答えて進む)
 *   **同じに見えて同じではないものを、無理に1つにしない。**
 */
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CloseIcon, GearIcon } from './Icons.jsx'
import { useFocusBoard } from './FocusBoard.jsx'
import { lockScroll } from '../lib/scrollLock.js'

/**
 * @param className  足すクラス(`stepfocus` / `qrfocus`)
 * @param width      紙の幅を引き継ぐ(`w100`〜`w150` / `wfit`)
 * @param learnerId  誰のセッションか(メモを出すかどうか)
 * @param page       線を持つ単位。**送るたびに変える**
 * @param bodyRef    送る箱。呼ぶ側でも使うときは渡す(`FocusReader` の送り戻し)
 * @param scrollKey  変わったら中身の先頭へ戻す(前の1つを下まで読んでいたとき)
 * @param onClose    集中モードを終える
 * @param top        上の帯の中身(「閉じる」と「書き込む / メモ」のあいだ)
 * @param topEnd     上の帯の右端(6Steps のプルダウン・見た印の点)
 * @param bar        下の帯の中身。**渡さなければ帯を出さない**
 *                   (Quick Response は自分の答えボタンで進む)
 * @param settings   速さ・文字・幅・印刷(2026-09 利用者の指定)。
 *                   **書き込む / メモと同じかたまりにして、右へ寄せる。**
 *                   狭い画面では「表示」に畳む(レッスン表示と同じ作法)
 */
export default function FocusFrame({
  className = '', width = 'w100', learnerId = null, page = 0,
  bodyRef = null, scrollKey = null, onClose,
  top = null, topEnd = null, bar = null, settings = null, children,
  /**
   * **紙を持たない集中モード**(2026-09 実機・利用者の指定)。
   *
   *   > あくまでバックグラウンドの色を白くして、
   *   > 集中モードではなくしてください
   *
   * Quick Response の復習は、単語帳の復習と**並ぶ画面**である
   * (どちらも左のメニューから開く、1問ずつの復習)。ところが
   * 片方だけ**黒い地に白い紙**の集中モードになっていた。
   *
   * `plain` を渡すと、単語帳の集中モード(`.wbfocus`)と同じ形になる。
   *
   * ・地を黒くしない(`focus--sheet` を付けない)
   * ・**上の帯も明るくする**(`focus--plain`)。地だけ白くして帯を
   *   黒いままにすると、**そこだけ集中モードが残って見える**
   * ・**紙(`.focus-paper`)の地・影・角丸をやめる。** ただし
   *   **入れ物と余白は残す**(`.focus-plainbox`)——
   *   消すと中身が 24px ずつ広がる(「幅は変えないでくださいよ」)
   * ・**書き込む / メモを出さない**(単語帳にも無い)
   * ・**中身が無ければ「表示」の札も出さない**(効かない操作を見せない)
   * ・**右下の「集中モードを終える」を出さない。**
   *   閉じるのは左上の「✕ 閉じる」1つ(単語帳とまったく同じ)
   *
   * **幅は1ドットも変えていない**(利用者の指定
   * 「Quick Response の幅は変えないでくださいよ」)。
   */
  plain = false,
  /* 下の帯そのもの。**「入るまで詰める」を掛けたい画面だけが渡す**
     (`useFitRow`・2026-09 利用者の指定「レスポンシブに幅に収まるように」) */
  barRef = null,
}) {
  /* 狭い画面で「表示」を開いているか。**覚えない** —
     一度決める設定なので、開くたびに畳んだところから始めてよい */
  const [openSettings, setOpenSettings] = useState(false)
  const ownRef = useRef(null)
  const ref = bodyRef ?? ownRef
  const board = useFocusBoard({ learnerId, page, bodyRef: ref })

  /* 「表示」に畳むものが1つも無ければ、**札そのものを出さない。**
     `plain` では書き込む / メモを出さないので、`settings` も渡されなければ
     中は空になる。**押しても何も起きない札を見せない**(CLAUDE.md) */
  const tools = plain ? null : board.tools
  const hasMore = Boolean(tools || settings)

  /* 送ったら、**中身の先頭へ戻す。** 前の1つを下まで読んでいると、
     次の1つが途中から始まって見える */
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = 0
  }, [scrollKey])

  /* 開いているあいだは、**うしろの画面を動かさない。**
     かぶせて開くメニュー(`AppNav`)と同じ作法。
     これが無いと、この画面の外側が指で送れてしまう */
  useEffect(() => lockScroll(), [])

  return createPortal(
    /* `focus--sheet` … **紙がある集中モード**の印(2026-09 利用者の指定)。
       地をいつも黒にする。単語帳の集中モードには紙が無いので付かない */
    <div className={`focus${plain ? ' focus--plain' : ' focus--sheet'}`
           + `${className ? ` ${className}` : ''} focus--${width}`}
         role="dialog" aria-modal="true" aria-label="集中モード">
      {/* ── 上の帯。**細く1行。** ここが太ると中身が下へ押し出される ──
          **書き込みのあいだは、まるごと入れ替える**(レッスン表示と同じ作法)。
          2段にすると、読むところがそのぶん狭くなる */}
      <div className="focus-top">
        {board.pen ? board.penBar : (
          <>
            {/* **いつも要るものは、1つの囲みにまとめて折り返させない**
                (レッスン表示の `.lesson-bar-main` と同じ作法)。
                帯ぜんぶを折り返させていたので、iPhone(390px)で
                6Steps のプルダウンが2段目に落ち、**帯の高さが2倍**に
                なっていた(実測 95px)。囲みにまとめれば、入らないぶんは
                プルダウンのほうが縮む(「…」で切れる) */}
            <div className="focus-top-main">
              {/* **狭い画面では絵だけになる**(`.wide-text`)ので、
                  読み上げのための名前を必ず添える */}
              <button type="button" className="btn btn--small btn--ghost"
                      aria-label="閉じる" onClick={onClose}>
                <CloseIcon /><span className="wide-text">閉じる</span>
              </button>
              {top}
              {topEnd}
            </div>
            {/* ── しまっておくもの(2026-09 利用者の指定)──────────
                > 速さ、画面の幅、印刷、文字の大きさのUIはこの写真のように
                > 黒のデザインで上部バーに配置しておいてください。
                > 「書き込む」も同じように他のUIと同じく右に寄せて

                レッスン表示の帯とまったく同じ形にする。
                **一度決めれば何度も要らない**ので、狭い画面では
                「表示」に畳み、押したときだけ2段目に出す。
                パソコンでは畳まない(CSS が決めるので、この札も出ない) */}
            {hasMore && (
              <>
                <button type="button" className="btn btn--small lesson-more"
                        aria-expanded={openSettings} aria-controls="focus-settings"
                        onClick={() => setOpenSettings((v) => !v)}>
                  <GearIcon /><span className="mid-text">表示</span>
                </button>
                <div id="focus-settings"
                     className={`lesson-settings${openSettings ? ' is-open' : ''}`}>
                  {/* **書き込む / メモ**(2026-09 利用者の指定)。
                      1つだけに向き合う場所なので、線を引きたくなるのも
                      気づいたことを残したくなるのも、まさにこの最中である */}
                  {/* **紙を持たない集中モードには出さない**(単語帳にも無い) */}
                  {tools}
                  {settings}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* ── 中身とメモを横に並べる。**送れるのは中身の側だけ** ─────── */}
      <div className="focus-main">
        <div className="focus-body" ref={ref}>
          {/* **黒い地の上に、白い紙**(2026-09 利用者の指定
              「真ん中に紙があり、コンテンツは基本白ベース、
                幅により余る左右のスペースが黒」)。
              紙があると、**どこからどこまでが読むところか**が目で分かる */}
          {/* **紙を持たないときも、入れ物は残す。**
              紙をやめると左右の余白(24px ずつ)が消えて、
              **中身がそのぶん広がる**(実測 390px で 342 → 366px)。
              言われたのは地の色の話であって、幅の話ではない
              (「Quick Response の幅は変えないでくださいよ」)。
              `.focus-plainbox` は**余白だけ**を紙と分け合う */}
          <div className={plain ? 'focus-plainbox' : 'focus-paper'}>{children}</div>
          {/* **板は送る箱の中に敷く。** 外に置くと、送ったときに
              線だけが取り残される(会議アプリのペンと同じ失敗) */}
          {plain ? null : board.inkLayer}
        </div>
        {plain ? null : board.notesPane}
      </div>

      {/* ── すぐ元に戻る(2026-09 利用者の指定)────────────────
          > そしてすぐに元に戻れるボタンも作ってください。

          **入った場所と、出る場所を同じ右下にそろえる。**
          左上の「✕ 閉じる」も残してあるが、
          スマホでは**親指がいちばん届かないのが左上**である。
          **帯の上に浮かせる**(`bottom: 100%`)。帯そのものに置くと
          「次 ▶」と重なるか、320px で1行に収まらなくなる。 */}
      <div className="focus-barwrap">
        {/* **紙を持たない集中モードには出さない。** 閉じるのは
            左上の「✕ 閉じる」1つ(単語帳とまったく同じ) */}
        {plain ? null : (
          <button type="button" className="btn btn--small focus-exit" onClick={onClose}>
            <CloseIcon />集中モードを終える
          </button>
        )}
        {/* 下の帯。**渡されなければ出さない**(効かない場所を作らない) */}
        {bar && <div className="focus-bar" ref={barRef}>{bar}</div>}
      </div>
    </div>,
    document.body,
  )
}
