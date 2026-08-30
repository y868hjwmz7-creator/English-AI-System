/**
 * Quick Response — 日本語を見て、すぐ英語で言う。
 *
 * 【何のためか】(2026-08 利用者の指定)
 *   利用者のスクールのトレーニングの1つ。
 *   読んで分かる力と、**話すときに口から出てくる力は別物**である。
 *   宿題でひととおり読んだあと、同じ英文を日本語から言い直すことで、
 *   「見れば分かる」を「言える」に変える。
 *
 * 【材料は作らない。教材にあるものをそのまま使う】
 *   教材には英語と日本語がすでに対で入っている(`quickResponse.js`)。
 *   AI に作り直させれば1回ぶん課金され、しかも
 *   **宿題でやった文とは別の文**になる。それでは復習にならない。
 *   したがって **SQL も Edge Function も生成の費用も要らない。**
 *
 * 【出し方の決まり】単語帳の「日本語 → 英語」と同じ考え方でそろえる
 *   ・**答えの2つ(言えた / 言えなかった)は最初から押せる。**
 *     分かっているものをいちいち開かせない。「英語を見る」は真ん中
 *   ・**開く前に音を鳴らさない。** 鳴らせば答えが聞こえてしまう
 *   ・**順番は教材のまま。** 記事と会話には話の流れがあり、混ぜると場面が飛ぶ
 *     (単語帳は逆に毎回混ぜる。あちらは並び順で覚えてしまうため)
 *
 * 【記録は残さない】
 *   単語帳の「箱」とは別のものである。ここで残すと、
 *   同じ語の覚え具合が2か所で動くことになる。
 *   画面に「言えた数」を出すだけにしてある。
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { quickResponsePairs } from '../lib/quickResponse.js'
import { voiceTierFor } from '../lib/voiceTier.js'
import { resolveVoices } from '../data/clipVoices.js'
import { stopReading } from '../lib/readAloud.js'
import SpeakButton from './SpeakButton.jsx'
import EnglishText from './EnglishText.jsx'
import { CloseIcon } from './Icons.jsx'

export default function QuickResponse({
  material, onClose, wordStatuses = null, onMarkWord = null, paper = false,
}) {
  const pairs = useMemo(() => quickResponsePairs(material), [material])
  const [at, setAt] = useState(0)
  const [shown, setShown] = useState(false)
  const doneRef = useRef([])          // 言えた / 言えなかったの記録(この1回ぶん)
  const enRef = useRef(null)          // 開いた答え(入りきらないときに送る先)
  const bodyRef = useRef(null)        // 出題の枠。**動かすのはここだけ**
  const [finished, setFinished] = useState(false)
  // **両方いっしょに出せるか。** 出せないときだけ入れ替えに落とす
  // (2026-08 利用者の指定)。判断は「実際に入るかどうか」で行う
  const [tight, setTight] = useState(false)

  // 画面を離れるときは、鳴っているものを止める
  useEffect(() => () => stopReading(), [])

  // 出題が変わったら、答えは閉じた状態から。**入るかどうかも測り直す**
  useEffect(() => { setShown(false); setTight(false); stopReading() }, [at])

  // **開いた答えが枠に入りきらないときは、こちらで送る。**
  // 「上下にスクロールして微調整せずに」(2026-08 利用者の指定)。
  // ボタンは動かさないので、動くのはこの枠の中だけである
  //
  // **送りの面倒は、この1つの effect に集める。**
  // 「開いたら送る」と「問が変わったら戻す」を別々に書いたら、
  // 問を進めた瞬間に前の状態のまま送られ、**次の問の日本語が枠の外から
  // 始まった**(2026-08 の実測。scrollTop が 40 のまま残っていた)。
  useEffect(() => {
    const body = bodyRef.current
    if (!body) return
    // **いつも上から。** 問題と答えは入れ替えて出すので、
    // どちらも枠の先頭から始まる。送る必要そのものが無くなった
    body.scrollTop = 0
  }, [shown, at, tight])

  /**
   * **問題と答えを、いっしょに出せるかどうかを実測する**(2026-08 利用者の指定)。
   *
   * > 問題と解答を同時に表示できないときは、それぞれもっと中央に配置してください。
   * > 同時に表示できるときは今のまま
   *
   * 文の長さは教材によって桁が違うので、**文字数で当て推量しない。**
   * まず両方を出してみて、枠に入りきらなかったときだけ入れ替えに落とす。
   * 枠の高さは決め打ち(`.qr-body`)なので、**ボタンの場所は動かない。**
   */
  useLayoutEffect(() => {
    const body = bodyRef.current
    if (!body || !shown || tight) return
    if (body.scrollHeight > body.clientHeight + 1) setTight(true)
  }, [shown, at, tight])

  const card = pairs[at] ?? null
  // 本文は良い声で読む。判断は `voiceTier.js` 1か所
  const tier = voiceTierFor({ exerciseType: 'article', tags: material?.tagIds })
  const clipVoice = resolveVoices(material?.voiceIds ?? material?.voice_ids)[0]

  const answer = (ok) => {
    doneRef.current = [...doneRef.current, { ...card, ok }]
    if (at + 1 >= pairs.length) { setFinished(true); return }
    setAt(at + 1)
  }

  const restart = () => {
    doneRef.current = []
    setAt(0); setShown(false); setFinished(false)
  }

  if (!pairs.length) {
    return (
      <section className={`qr${paper ? ' qr--paper' : ''}`}>
        <div className="qr-head">
          <strong className="qr-title">Quick Response</strong>
          {onClose && (
            <button type="button" className="nav-icon-btn" onClick={onClose}
                    aria-label="Quick Response を閉じる"><CloseIcon /></button>
          )}
        </div>
        <p className="hint">
          この教材には、日本語と英語が対になった文がありません。
          <br />
          穴埋めとリスニングは英文だけ、内容の理解は設問も答えも英語なので、
          Quick Response には使えません。
        </p>
      </section>
    )
  }

  const ok = doneRef.current.filter((x) => x.ok).length

  return (
    <section className={`qr${paper ? ' qr--paper' : ''}`}>
      <div className="qr-head">
        {/* 紙(大きく表示)では、すぐ上のボタンが「Quick Response」なので
            ここには出さない。**同じ言葉を20px 離して2度書かない** */}
        {!paper && <strong className="qr-title">Quick Response</strong>}
        <span className="qr-count">
          {finished ? `${pairs.length} / ${pairs.length}` : `${at + 1} / ${pairs.length}`}
        </span>
        {onClose && (
          <button type="button" className="nav-icon-btn" onClick={onClose}
                  aria-label="Quick Response を閉じる"><CloseIcon /></button>
        )}
      </div>

      {/* どこまで来たか。**終わりが見えないと続かない**(単語帳と同じ) */}
      <div className="qr-bar" aria-hidden="true">
        <span style={{ width: `${Math.round(((finished ? pairs.length : at) / pairs.length) * 100)}%` }} />
      </div>

      {finished ? (
        <div className="qr-result">
          <p className="qr-result-score">
            <strong>{ok} / {pairs.length} 言えました。</strong>
          </p>
          <ul className="qr-result-list">
            {doneRef.current.filter((x) => !x.ok).map((x, i) => (
              <li key={i}>
                <span className="qr-result-ja">{x.ja}</span>
                <span lang="en">{x.en}</span>
              </li>
            ))}
          </ul>
          {ok === pairs.length
            ? <p className="hint">全部言えました。</p>
            : <p className="hint">上に出ているのが、言えなかった文です。</p>}
          <div className="btn-row">
            <button type="button" className="btn btn--primary" onClick={restart}>
              もう一度
            </button>
            {onClose && (
              <button type="button" className="btn" onClick={onClose}>とじる</button>
            )}
          </div>
        </div>
      ) : (
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
                どの教材から出ているかは、上の題名を見れば分かる */}
            {card.speaker && <p className="qr-from">{card.speaker}</p>}

            {/* **入るなら、問題と答えを並べて出す**(2026-08 の指定)。
                入らないときだけ入れ替える。入れ替えなら必ず収まる。
                出す側は日本語だけ。**開くまで英語は出さない。音も鳴らさない** */}
            {(!shown || !tight) && <p className="qr-ja">{card.ja}</p>}
            {shown && (
              /* **答えはうすい色の囲みに入れる**(2026-08 の指定)。
                 ほかのトレーニングの解答(`.answer-box`)と同じ形にそろえる。
                 部品ごとに書くと、必ずどこかだけ違う見た目になる */
              <div className="answer-box qr-answer" ref={enRef}>
                <div className="qr-en">
                  <EnglishText text={card.en} textJa={card.ja} level={material?.level}
                               statuses={wordStatuses} onMark={onMarkWord} />
                  <SpeakButton text={card.en} className="etext-listen"
                               clipVoice={clipVoice} tier={tier} />
                </div>
              </div>
            )}
          </div>

          {/* **単語帳と同じ形にそろえる**(言葉づかいも見た目も並べ方も)。
              「英語を見る」は答えではないので1段上に出し、
              **答えの2つはとなりどうし**に置く(2026-08 利用者の指定)。
              「言えなかった」は6文字あり、スマホで2行に割れた(実測)ので
              「まだ」にしてある */}
          <div className="qr-actions">
            <button type="button" className="btn btn--ghost btn--small"
                    aria-expanded={shown}
                    onClick={() => setShown((v) => !v)}>
              {shown ? '英語を隠す' : '英語を見る'}
            </button>
            <div className="qr-answers">
              <button type="button" className="btn btn--quiet"
                      onClick={() => answer(false)}>まだ</button>
              <button type="button" className="btn btn--primary"
                      onClick={() => answer(true)}>言えた</button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
