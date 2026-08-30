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
import { useEffect, useMemo, useRef, useState } from 'react'
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
  const [finished, setFinished] = useState(false)

  // 画面を離れるときは、鳴っているものを止める
  useEffect(() => () => stopReading(), [])

  // 出題が変わったら、答えは閉じた状態から
  useEffect(() => { setShown(false); stopReading() }, [at])

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
          <p className="qr-from">
            {card.from}{card.speaker && ` / ${card.speaker}`}
          </p>

          {/* 出す側は日本語だけ。**英語は出さない。音も鳴らさない** */}
          <p className="qr-ja">{card.ja}</p>

          <div className="qr-actions">
            {/* **単語帳と同じ言葉づかいにする。** あちらは「まだ / 覚えた」。
                「言えなかった」は6文字あり、スマホで2行に割れた(実測) */}
            <button type="button" className="btn btn--warnish"
                    onClick={() => answer(false)}>まだ</button>
            <button type="button" className="btn" aria-expanded={shown}
                    onClick={() => setShown((v) => !v)}>
              {shown ? '英語を隠す' : '英語を見る'}
            </button>
            <button type="button" className="btn btn--primary"
                    onClick={() => answer(true)}>言えた</button>
          </div>

          {/* 開いてはじめて、英語と音が出る */}
          {shown && (
            <div className="qr-en">
              <EnglishText text={card.en} textJa={card.ja} level={material?.level}
                           statuses={wordStatuses} onMark={onMarkWord} />
              <SpeakButton text={card.en} className="etext-listen"
                           clipVoice={clipVoice} tier={tier} />
            </div>
          )}
        </div>
      )}
    </section>
  )
}
