/**
 * Quick Response の1問。**出題の枠と、答えと、ボタンの行。**
 *
 * 【なぜ部品にしたか】(2026-09 利用者の指定)
 *
 *   > UI は通常の Quick Response の画面と同じです。
 *
 *   Quick Response は2か所にある。
 *
 *     ・教材の中(`QuickResponse.jsx`)      … その教材を通しでやる
 *     ・復習(`QrReview.jsx`・0040)         … 「まだ」を押した文が溜まる
 *
 *   **同じ見た目を2か所に書き写さない**(CLAUDE.md)。書き写すと必ず
 *   片方だけ古くなる(単語帳で `LearnerWordbook` を別に持って踏んだ失敗)。
 *   囲みの外(取り組み方の札 / 絞り込み)は役目が違うので、
 *   **1問ぶんだけ**をここに置く。
 *
 【決まりごと】
 *   ・**答えは同じ場所で入れ替える**(2026-09・単語帳とそろえた)
 *   ・**枠の高さは、入れ物が決める**(中身では決まらない)。だから
 *     文の長さが変わってもボタンは動かない。紙の上は
 *     `.lesson-sheet.is-running`、集中モードは `.qrfocus` が
 *     「残りいっぱいを取る」を渡している(`styles.css`)
 *   ・答えはうすい色の囲み(`.answer-box`)。ほかのトレーニングと同じ形
 *   ・**答えのすぐ横に Listen を置かない。** 下の行に1つだけ
 *
 * 【言葉づかいだけは、呼ぶ側が決める】(2026-09 利用者の指定)
 *
 *   > 教材の中では「言えた」と「まだ」で OK です。
 *   > 新しい復習の画面では、「まだ」/「言える」にします。
 *
 *   教材の中は**その場で言えたか**、復習は**これから言えるか**を訊いている。
 *   単語帳が「まだ」/「覚えかけ」と訊くのと同じ関係である。
 */
import { useEffect, useRef, useState } from 'react'
import SpeakButton from './SpeakButton.jsx'
import RepeatToggle from './RepeatToggle.jsx'
import EnglishText from './EnglishText.jsx'
import { stopReading } from '../lib/readAloud.js'
import { frameFormOf } from '../lib/frameMatch.js'
/* **問題の箱をタップして切り替える**(第5.262節・2026-09-26 利用者の指定)。
   「英語を見る」のボタンは廃止した。**判断は `tapReveal.js` 1か所** */
import { revealLabel, tapToggles } from '../lib/tapReveal.js'
import { HintIcon } from './Icons.jsx'

/**
 * **型の札**(2026-09 利用者の指定「青で囲まれた『〜の型』をヒントに」)。
 *
 * **ヒントと、答えを開いたあとに出るものは、同じ札**である ——
 * 同じことを2つの見た目で見せない(CLAUDE.md)。
 * だから**ここ1つにまとめてある。** 巻末の一覧・PDF と同じ名前で出すので、
 * そのまま引きに行ける。**色だけに頼らない** ——
 * うすい地色 + 同じ色の文字 + 枠線 + 太字 + 「型」の文字。
 */
function FrameTag({ form }) {
  if (!form) return null
  return <p className="qr-frame"><span className="qr-frame-name">型</span>{form}</p>
}

export default function QrCard({
  pair, no, level = null, clipVoice = null, tier = 'premium',
  wordStatuses = null, onMarkWord = null,
  onAnswer,
  /** ボタンの文言。**呼ぶ側が決める**(教材 = 言えた / 復習 = 言える) */
  yetLabel = 'まだ', okLabel = '言えた',
  /** 答えの右に足すもの(復習の「もう出さない」など)。無ければ出さない */
  extra = null,
  /**
   * **英文の「型」を、答えの下に出すか**(2026-09 利用者の指定)。
   *
   *   > 型の見分け、使い分けは必ず実現したいトレーニングです
   *
   * 「見分け」は、**言ったあとに答え合わせをするその場**で効く ——
   * 自分で言ってから英語を開いたとき、そこに型の名前があれば、
   * 「いまのは `S allows 人 to do` だったのか」と結びつく。
   *
   * **既定は出さない。呼ぶ側が決める**(`showCol` / `showNf` と同じ作法)。
   * 紙に刷るときや集中モードにまで勝手に出すと、
   * **言われていない場所が変わる**(CLAUDE.md)。
   */
  showFrame = false,
  /**
   * **ヒントを出しているか**(2026-09 利用者の指定)。
   *
   *   > ヒントボタンをつけて、一度ボタンを押したら問題を跨いでも、
   *   > もう一度ヒントボタンを押すまでヒントが出続けるようにして欲しい。
   *
   * **この部品は覚えない。** 押した状態は**呼ぶ側が持つ** ——
   * カードは問ごとに描き直されるので、ここに持つと1問で消える
   * (「問題を跨いでも」が成り立たない)。`RepeatToggle` と同じ作法。
   */
  hintOn = false, onHint = null,
}) {
  const [shown, setShown] = useState(false)
  /**
   * **訳を出しているか**(第5.198節・2026-09 利用者の指定)。
   *
   *   > ヒントを押せば使う型が表示され、訳を見るを押せば日本語訳も見れる
   *
   * **この問だけ。次の問では閉じる**(ヒントとは違う)。ヒントは
   * 「どの型で言うか」という**お題の一部**なので問をまたいで残すが、
   * 訳は**読めなかったときの助け**なので、既定は出さない側にしておく。
   */
  const [jaOn, setJaOn] = useState(false)
  /** 答えの音をくり返すか。**覚えない**(次に開いたときは1回に戻す) */
  const [loop, setLoop] = useState(false)
  const bodyRef = useRef(null)        // 出題の枠。**動かすのはここだけ**
  const enRef = useRef(null)

  const key = pair?.key ?? pair?.en ?? ''

  // 出題が変わったら、答えも訳も閉じた状態から
  useEffect(() => { setShown(false); setJaOn(false); stopReading() }, [key])

  // 画面を離れるときは、鳴っているものを止める
  useEffect(() => () => stopReading(), [])

  /* **送りの面倒は、この1つの effect に集める。**
     「開いたら送る」と「問が変わったら戻す」を別々に書いたら、
     問を進めた瞬間に前の状態のまま送られ、**次の問の日本語が枠の外から
     始まった**(2026-08 の実測)。
     **いつも上から。** 問題と答えは入れ替えて出すので、どちらも先頭から始まる */
  useEffect(() => {
    const body = bodyRef.current
    if (body) body.scrollTop = 0
  }, [shown, key])

  /* **型が言い当てられなかった文には、何も出さない**(`frameMatch.js`)。
     当てずっぽうで型を付けると、練習そのものが嘘になる */
  const frame = showFrame ? frameFormOf(pair?.en) : null

  if (!pair) return null

  /**
   * **問題と答えの中身**(第5.262節)。
   *
   * **1つの変数から描く。** 伏せているとき(`<button>`)と
   * 出しているとき(素の入れ物)で**同じものを出す**ためである ——
   * 2か所に書き写すと、必ず片方だけ古くなる(CLAUDE.md)。
   */
  const face = (
    <>
          {/* 話す人だけは残す。誰のせりふかで言い方が変わる。
              **「記事」「会話」の札は出さない**(2026-08 の指定)。
              **何問目か、丸の番号で出す**(2026-09 利用者の指定)。
              上の「2 / 25」は**どこまで来たか**の目安で、役目が違う */}
          <p className="qr-from">
            <span className="num-badge">{no}</span>
            {pair.speaker && <span>{pair.speaker}</span>}
          </p>

          {/* **答えは「足す」のではなく、同じ場所で入れ替える**
              (2026-09 利用者の指定・**方針の変更**)。

                > quick reponse内の表示だが、単語帳と同じにしてくれ

              2026-08 は「入るなら問題と答えを並べる。入らないときだけ
              入れ替える」だった。ところが**単語帳は入れ替えである**
              (「英語を見るにすると日本語と入れ替えで同じ場所に表示して
              ください」)。同じことをする2つの画面で、**開いたときの
              動きが違っていた。**

              入れ替えなら箱の高さが変わらないので、
              **押す場所も、目を向ける場所も動かない。**
              測って出し分ける必要もなくなった(`is-tight` ごと消した)。 */}
          {!shown && (
            <>
              {/* **言い換えは、英文が問である**(第5.198節・利用者の指摘
                  「言い換えは英語が書いてあり、それを型に則って別の形の
                  英語で言い換えるトレーニングです」)。

                  それまでは日本語しか持っていなかったので、
                  **日本語 → 英語とまったく同じ画面**になっていた。
                  素の英文(`askEn`)を持つ問だけ、そちらを出す。
                  **持たない問はこれまでどおり日本語**(書き分けはここ1か所)。

                  **語をタップできる形(`EnglishText`)にはしない。**
                  あれは意味を引きに行く道で、**出題を読むだけで課金が動く。**
                  答えの側は残してあるので、意味はそこで引ける */}
              {pair.askEn
                ? <p className="qr-ask">{pair.askEn}</p>
                : <p className="qr-ja">{pair.ja}</p>}
              {/* **訳**(第5.198節)。英文が問のときだけ出せる ——
                  日本語が問のときは、押しても同じものが2つ並ぶだけである */}
              {pair.askEn && jaOn && <p className="qr-ask-ja">{pair.ja}</p>}
              {/* **ヒントは、問の下に置く**(2026-09 利用者の指定)。
                  答えではないので、答えの囲み(`.answer-box`)には入れない。
                  **出すのは、答えの下に出るのとまったく同じ札**である
                  (利用者の指定「青で囲まれた『〜の型』をヒントに」)。
                  型の名前は `frameQr.js` が持つ。**書き写さない** */}
              {hintOn && <FrameTag form={pair.hint} />}
            </>
          )}
          {shown && (
            /* **答えはうすい色の囲みに入れる**(2026-08 の指定)。
               ほかのトレーニングの解答(`.answer-box`)と同じ形にそろえる */
            <div className="answer-box qr-answer" ref={enRef}>
              {/* **答えのすぐ横に Listen を置かない**(2026-09 利用者の指定)。
                  下のボタンの行にも Listen がある。
                  **同じことをするボタンを2つ見せない**(CLAUDE.md) */}
              <div className="qr-en">
                <EnglishText text={pair.en} textJa={pair.ja} level={level}
                             statuses={wordStatuses} onMark={onMarkWord} />
              </div>
              {/* **型**(2026-09 利用者の指定)。**ヒントと同じ札**
                  (`FrameTag`)—— 書き写すと、片方だけ古くなる */}
              <FrameTag form={frame} />
            </div>
          )}

    </>
  )


  return (
    <div className="qr-card">
      {/* 出題と答えは**まん中**に、ボタンは**いつも同じ場所**に置く。
          以前は答えがボタンの下に出ていたので、画面のいちばん下へ
          押し出され、そのつど送らないと読めなかった(2026-08 の指摘)。
          **枠の高さは入れ物が決める**(中身では決まらない)ので、
          文の長さが変わってもボタンは動かない。長すぎる英文だけが、
          この中で送られる。 */}
      {/* ── **箱ぜんぶをタップで切り替える**(第5.262節・2026-09-26 利用者の指定)──

            > 単語帳や quick response の「英語を見る」ボタンは廃止。
            > 日本語の表示されているあたりをタップすれば英語に切り替わる
            > ようにしてください。タップできる範囲は広めにとってください。

          **伏せているあいだは、本物の `<button>`。** 中に押せるものが
          1つも無いので、そのまま押せるものにできる ——
          キーボードでも読み上げでも、ふつうに押せる。

          **出したあとは素の入れ物**にする。答えの側には語ごとの
          `<button>`(`EnglishText`)が並ぶので、箱ごとボタンにすると
          **押せるものの中に押せるものが入る。** 語を押したつもりが
          問題に戻ってしまう。だから**押された場所を見て**、
          押せるものを踏んでいたら切り替えない(`tapToggles`)。

          **送りの面倒(`bodyRef`)は、どちらの形でも同じところに付ける。** */}
      {!shown ? (
        <button type="button" className="qr-body qr-body--tap" ref={bodyRef}
                aria-expanded={false}
                aria-label={revealLabel(false, pair.askEn ? 'answer' : 'en')}
                onClick={() => setShown(true)}>
          {face}
        </button>
      ) : (
        <div className="qr-body qr-body--tap is-shown" ref={bodyRef}
             onClick={(e) => { if (tapToggles(e.target)) setShown(false) }}>
          {face}
        </div>
      )}

      {/* **単語帳と同じ形にそろえる**(言葉づかいも見た目も並べ方も)。
          「英語を見る」は答えではないので1段上に出し、
          **答えの2つはとなりどうし**に置く(2026-08 利用者の指定) */}
      <div className="qr-actions">
        <div className="qr-peek">
          {/* **「英語を見る」のボタンは廃止した**(第5.262節・2026-09-26
              利用者の指定)。**問題の箱そのものを押す**ようにしたので、
              同じことをするボタンが2つ並ぶことになる
              (**同じことをするものを2つ見せない**・CLAUDE.md)。
              言葉は消していない —— 読み上げには `aria-label` で届く
              (`revealLabel()` 1か所) */}
          {/* **英語を出さなくても、答えの音は聞ける**(2026-09 利用者の指定)。
              Quick Response は**口に出して言う**練習なので、自分で言ってから
              **耳で答え合わせをする**ほうが素直である */}
          <SpeakButton text={pair.en} className="btn--ghost"
                       clipVoice={clipVoice} tier={tier} repeat={loop} />
          {/* **くり返し**(2026-09 利用者の指定「オートリピートのボタン」)。
              口が追いつくまで、同じ英文を何度も聴く練習である */}
          <RepeatToggle on={loop} onChange={setLoop} className="btn--ghost" />
          {/* **ヒント**(2026-09 利用者の指定)。
              **ヒントを持たない問には出さない** —— ふだんの Quick Response と
              Native Flow の行は `hint` が `null` なので、ボタンごと出ない
              (効かない操作を見せない・CLAUDE.md)。
              **押している状態は、色だけに頼らない**(`aria-pressed` + 地色) */}
          {onHint && pair.hint && (
            <button type="button"
                    className={`btn btn--small btn--ghost${hintOn ? ' chip--on' : ''}`}
                    aria-pressed={hintOn}
                    onClick={() => onHint(!hintOn)}>
              <HintIcon />{hintOn ? 'ヒントを消す' : 'ヒント'}
            </button>
          )}
          {/* **訳を見る**(第5.198節・利用者の指定)。
              **英文が問のときだけ出す** —— 日本語が問のときに押しても
              同じものが2つ並ぶだけである(効かない操作を見せない)。
              **押している状態は、色だけに頼らない**(`aria-pressed` + 地色) */}
          {pair.askEn && (
            <button type="button"
                    className={`btn btn--small btn--ghost${jaOn ? ' chip--on' : ''}`}
                    aria-pressed={jaOn}
                    onClick={() => setJaOn((v) => !v)}>
              {jaOn ? '訳を隠す' : '訳を見る'}
            </button>
          )}
          {extra}
        </div>
        <div className="qr-answers">
          <button type="button" className="btn btn--quiet"
                  onClick={() => onAnswer(false)}>{yetLabel}</button>
          <button type="button" className="btn btn--primary"
                  onClick={() => onAnswer(true)}>{okLabel}</button>
        </div>
      </div>
    </div>
  )
}
