/**
 * ② スラッシュリーディング(2026-08 利用者の指定)。
 *
 * > 文章をスラッシュ( / )で区切り、意味ごとのカタマリで文法と意味を理解し、
 * > カタマリ毎の訳を前から言えるようにするトレーニング。
 *
 * 【どう区切らせるか】
 *   **語と語のあいだを押す。** パソコンでもスマホでも同じ操作になる。
 *   なぞって範囲を選ばせる形にしなかったのは、スマホで狙いにくく、
 *   iPhone では長押しのメニューが割り込むためである
 *   (語の意味の吹き出しで一度学んだこと)。
 *   押すところは**語のあいだの細い帯**だが、当たり判定は指の幅ぶん広げてある。
 *
 * 【模範の区切りは、決まりで出す。AI に頼まない】
 *   利用者が挙げた決まりは、どれも閉じた語のリストで判定できる
 *   (`src/lib/chunker.js`)。1文ごとに課金する理由がない。
 *
 * 【まだ無いもの】
 *   **カタマリごとの訳例**は、まだ出せない。
 *   どこで切るかは決まりで分かるが、そのカタマリを日本語で何と言うかは
 *   決まりでは書けない。いまは**文ぜんぶの訳**を下に出している。
 *   仕様書 第5.29.3節に、入れ方の案を残してある。
 */
import { useState } from 'react'
import {
  SLASH_LEVELS, checkSlashes, chunksOf, slashesFor, wordsOf,
} from '../lib/chunker.js'
import SpeakButton from './SpeakButton.jsx'

export default function SlashReading({
  sentences, clipVoice, tier, rate, level, onLevelChange,
}) {
  // 文ごとに、ゲストが入れた区切り(語のあいだの番号)
  const [marks, setMarks] = useState({})
  const [shown, setShown] = useState({})   // 「解答を見る」を押した文

  const toggle = (id, at) => setMarks((m) => {
    const now = new Set(m[id] ?? [])
    if (now.has(at)) now.delete(at)
    else now.add(at)
    return { ...m, [id]: [...now] }
  })

  const clear = (id) => setMarks((m) => ({ ...m, [id]: [] }))

  return (
    <div className="slash">
      <div className="slash-head">
        {/* やり方はステップの説明に書いてある。**同じ文を2度書かない** */}
        <label className="rate-pick">
          <span>区切りの細かさ</span>
          <select value={level} onChange={(e) => onLevelChange(e.target.value)}>
            {SLASH_LEVELS.map((l) => (
              <option key={l.id} value={l.id} title={l.hint}>{l.label}</option>
            ))}
          </select>
        </label>
      </div>

      <ol className="slash-list">
        {sentences.map((s) => {
          const words = wordsOf(s.text)
          const mine = marks[s.id] ?? []
          const open = shown[s.id]
          const model = slashesFor(s.text, level)
          const notes = checkSlashes(s.text, mine)
          return (
            <li key={s.id} className="slash-row">
              {s.speaker && <div className="passage-speaker" lang="en">{s.speaker}</div>}

              {/* 自分で区切るところ */}
              <p className="slash-line" lang="en">
                {words.map((w, i) => (
                  <span key={i} className="slash-w">
                    {i > 0 && (
                      <button type="button"
                              className={`slash-gap${mine.includes(i) ? ' is-on' : ''}`}
                              aria-label={`${words[i - 1]} と ${w} のあいだで区切る`}
                              aria-pressed={mine.includes(i)}
                              onClick={() => toggle(s.id, i)}>
                        <span aria-hidden="true">/</span>
                      </button>
                    )}
                    {w}
                  </span>
                ))}
              </p>

              {/* 自分の区切りを、カタマリとして並べ直す。
                  **前から順に訳す練習なので、並びが見えることが要る** */}
              {mine.length > 0 && (
                <p className="slash-mine">
                  {chunksOf(s.text, mine).map((c, i) => (
                    <span key={i} className="slash-chunk" lang="en">{c}</span>
                  ))}
                </p>
              )}

              {/* 決まりで確かめられることだけを言う。
                  **あやふやなことは言わない。**「たぶん違う」は、
                  何も言われないより困る */}
              {notes.length > 0 && (
                <ul className="slash-notes">
                  {notes.map((n, i) => (
                    <li key={i}>{n.text.split('**').map((t, k) => (
                      k % 2 ? <strong key={k}>{t}</strong> : t
                    ))}</li>
                  ))}
                </ul>
              )}

              <div className="passage-actions">
                <SpeakButton text={s.text} className="etext-listen"
                             clipVoice={clipVoice} tier={tier} rate={rate} />
                <button type="button" className="btn btn--small"
                        onClick={() => setShown((v) => ({ ...v, [s.id]: !v[s.id] }))}>
                  {open ? '解答を隠す' : '解答を見る'}
                </button>
                {mine.length > 0 && (
                  <button type="button" className="btn btn--small btn--link"
                          onClick={() => clear(s.id)}>区切りを消す</button>
                )}
              </div>

              {open && (
                <div className="slash-answer">
                  <p className="slash-answer-label">
                    模範の区切り({SLASH_LEVELS.find((l) => l.id === level)?.label})
                  </p>
                  <p className="slash-model">
                    {chunksOf(s.text, model.map((x) => x.at)).map((c, i) => (
                      <span key={i} className="slash-chunk" lang="en">{c}</span>
                    ))}
                  </p>
                  {model.length > 0 && (
                    <ul className="slash-why">
                      {model.map((x, i) => <li key={i}>{x.why}</li>)}
                    </ul>
                  )}
                  {s.ja && (
                    <p className="slash-ja">
                      {s.jaIsWhole && <span className="slash-ja-label">段落の訳</span>}
                      {s.ja}
                    </p>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
