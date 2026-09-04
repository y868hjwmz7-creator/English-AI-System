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
 * 【見た目も振る舞いも、切り出す前と1つも変えていない】
 *   ・入るなら問題と答えを並べる。**入るかどうかは実測する**
 *     (`scrollHeight > clientHeight`)。入らないときだけ入れ替える
 *   ・枠の高さは決め打ちなので、**文の長さが変わってもボタンは動かない**
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
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import SpeakButton from './SpeakButton.jsx'
import RepeatToggle from './RepeatToggle.jsx'
import EnglishText from './EnglishText.jsx'
import { stopReading } from '../lib/readAloud.js'

export default function QrCard({
  pair, no, level = null, clipVoice = null, tier = 'premium',
  wordStatuses = null, onMarkWord = null,
  onAnswer,
  /** ボタンの文言。**呼ぶ側が決める**(教材 = 言えた / 復習 = 言える) */
  yetLabel = 'まだ', okLabel = '言えた',
  /** 答えの右に足すもの(復習の「もう出さない」など)。無ければ出さない */
  extra = null,
}) {
  const [shown, setShown] = useState(false)
  // **両方いっしょに出せるか。** 出せないときだけ入れ替えに落とす
  const [tight, setTight] = useState(false)
  /** 答えの音をくり返すか。**覚えない**(次に開いたときは1回に戻す) */
  const [loop, setLoop] = useState(false)
  const bodyRef = useRef(null)        // 出題の枠。**動かすのはここだけ**
  const enRef = useRef(null)

  const key = pair?.key ?? pair?.en ?? ''

  // 出題が変わったら、答えは閉じた状態から。**入るかどうかも測り直す**
  useEffect(() => { setShown(false); setTight(false); stopReading() }, [key])

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
  }, [shown, key, tight])

  /**
   * **問題と答えを、いっしょに出せるかどうかを実測する**(2026-08 利用者の指定)。
   *
   * 文の長さは教材によって桁が違うので、**文字数で当て推量しない。**
   * まず両方を出してみて、枠に入りきらなかったときだけ入れ替えに落とす。
   */
  useLayoutEffect(() => {
    const body = bodyRef.current
    if (!body || !shown || tight) return
    if (body.scrollHeight > body.clientHeight + 1) setTight(true)
  }, [shown, key, tight])

  if (!pair) return null

  return (
    <div className="qr-card">
      {/* 出題と答えは**まん中**に、ボタンは**いつも同じ場所**に置く。
          以前は答えがボタンの下に出ていたので、画面のいちばん下へ
          押し出され、そのつど送らないと読めなかった(2026-08 の指摘)。
          **文の長さが変わっても、ボタンは動かない。** */}
      {/* 入りきらないときは**まん中に寄せる。**
          入るときは上詰めのまま(「2 / 30 のすぐ下に問題の上端」) */}
      <div className={`qr-body${tight && shown ? ' is-tight' : ''}`} ref={bodyRef}>
        {/* 話す人だけは残す。誰のせりふかで言い方が変わる。
            **「記事」「会話」の札は出さない**(2026-08 の指定)。
            **何問目か、丸の番号で出す**(2026-09 利用者の指定)。
            上の「2 / 25」は**どこまで来たか**の目安で、役目が違う */}
        <p className="qr-from">
          <span className="num-badge">{no}</span>
          {pair.speaker && <span>{pair.speaker}</span>}
        </p>

        {/* **入るなら、問題と答えを並べて出す**(2026-08 の指定)。
            入らないときだけ入れ替える。入れ替えなら必ず収まる。
            出す側は日本語だけ。**開くまで英語は出さない** */}
        {(!shown || !tight) && <p className="qr-ja">{pair.ja}</p>}
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
          </div>
        )}
      </div>

      {/* **単語帳と同じ形にそろえる**(言葉づかいも見た目も並べ方も)。
          「英語を見る」は答えではないので1段上に出し、
          **答えの2つはとなりどうし**に置く(2026-08 利用者の指定) */}
      <div className="qr-actions">
        <div className="qr-peek">
          <button type="button" className="btn btn--ghost btn--small"
                  aria-expanded={shown}
                  onClick={() => setShown((v) => !v)}>
            {shown ? '英語を隠す' : '英語を見る'}
          </button>
          {/* **英語を出さなくても、答えの音は聞ける**(2026-09 利用者の指定)。
              Quick Response は**口に出して言う**練習なので、自分で言ってから
              **耳で答え合わせをする**ほうが素直である */}
          <SpeakButton text={pair.en} className="btn--ghost"
                       clipVoice={clipVoice} tier={tier} repeat={loop} />
          {/* **くり返し**(2026-09 利用者の指定「オートリピートのボタン」)。
              口が追いつくまで、同じ英文を何度も聴く練習である */}
          <RepeatToggle on={loop} onChange={setLoop} className="btn--ghost" />
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
