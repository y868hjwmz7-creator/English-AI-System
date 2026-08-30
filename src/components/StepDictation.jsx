/**
 * ① ディクテーション + まね音読(2026-08 利用者の指定)。
 *
 * > 1文ずつ繰り返し聞き、聞こえたと思うものをタイピングする、
 * > もしくは手元ノートなどに書き取る。
 * > なので、1文ずつ独立して音を再生、繰り返しができる UI が欲しいです。
 * > そして「解答を見る」で英文と訳が見れるしくみ。
 * > その後は文章ごとに発音をまねる練習をするステップ
 *
 * 【打ってもよいし、打たなくてもよい】
 *   手元のノートに書く人もいる。**入力欄を必須にしない。**
 *   打った人にだけ、語ごとの照らし合わせを出す。
 *
 * 【照らし合わせは、点数ではなく「どこが違うか」】
 *   `compareTranscript()` を使う。話して確かめるのと同じ仕組みで、
 *   **「to が抜けている」と見えれば直せる。**
 *   点数を1つ出しても、次に何を直せばよいか分からない。
 */
import { useState } from 'react'
import { compareTranscript, spokenRatio } from '../lib/transcriptDiff.js'
import { isRecognitionSupported } from '../lib/recognition.js'
import EnglishText from './EnglishText.jsx'
import SpeakButton from './SpeakButton.jsx'
import { MicIcon, StopIcon } from './Icons.jsx'

export default function StepDictation({
  sentences, clipVoice, tier, rate, level,
  wordStatuses, onMarkWord, listeningId, onCheck, results,
}) {
  const [typed, setTyped] = useState({})
  const [shown, setShown] = useState({})

  return (
    <div className="dictation">
      <ol className="dictation-list">
        {sentences.map((s, n) => {
          const open = shown[s.id]
          const mine = typed[s.id] ?? ''
          const diff = open && mine.trim() ? compareTranscript(s.text, mine) : null
          const spoken = results[s.id]
          return (
            <li key={s.id} className="dictation-row">
              <div className="dictation-head">
                <span className="dictation-no">{n + 1}</span>
                {s.speaker && <span className="passage-speaker" lang="en">{s.speaker}</span>}
                {/* **1文だけを、何度でも。** これがこのステップの中心 */}
                <SpeakButton text={s.text} className="etext-listen"
                             clipVoice={clipVoice} tier={tier} rate={rate} />
              </div>

              <textarea
                className="dictation-input" lang="en" rows={2}
                autoCapitalize="off" autoCorrect="off" spellCheck="false"
                placeholder="聞こえたとおりに書く(手元のノートに書くなら、空のままで構いません)"
                value={mine}
                onChange={(e) => setTyped((t) => ({ ...t, [s.id]: e.target.value }))}
              />

              {/* **照らし合わせは、書いた欄のすぐ下に置く。**
                  解答の下に置いていたので、自分が書いたものと離れていて
                  見比べられなかった(2026-08 の指摘)。
                  合っている=緑 / まちがい=赤。線も併せて付ける */}
              {diff && (
                <div className="dict-diff">
                  <p className="dict-diff-line">
                    {diff.map((d, i) => (
                      <span key={i} className={`w w--${d.state}`}>{d.word}</span>
                    ))}
                  </p>
                  <p className="dict-diff-score">
                    <strong>{diff.filter((d) => d.state === 'ok').length} / {diff.filter((d) => d.state !== 'extra').length} 語</strong>
                    {' '}合っています
                    {/* **余分な語も数える。** 数えないと、まちがいだらけでも
                        「4 / 4 合っています」と出てしまう(実測) */}
                    {diff.some((d) => d.state === 'extra')
                      && `(お手本に無い語が ${diff.filter((d) => d.state === 'extra').length} つ)`}
                    <span className="dict-key">
                      <span className="w w--ok">緑</span>=合っている
                      <span className="w w--missed">赤の取り消し線</span>=書けなかった
                      <span className="w w--extra">赤の波線</span>=お手本に無い語
                    </span>
                  </p>
                </div>
              )}

              <div className="passage-actions">
                {/* **べた塗りにしない。** 5文ぶん縦に並ぶので、
                    塗ると画面が重くなる(2026-08「塗りつぶしがダサい」) */}
                <button type="button" className="btn btn--small"
                        onClick={() => setShown((v) => ({ ...v, [s.id]: !v[s.id] }))}>
                  {open ? '解答を隠す' : '解答を見る'}
                </button>
                {/* 解答を出したあとが「まね音読」。
                    **出す前に話させない。** 何を言えばよいか分からない */}
                {open && isRecognitionSupported() && (
                  <button type="button"
                          className={`btn btn--small${listeningId === s.id ? ' btn--primary' : ''}`}
                          onClick={() => onCheck(s)}>
                    {listeningId === s.id
                      ? <><StopIcon />話し終わったら押す</>
                      : <><MicIcon />まねて言う</>}
                  </button>
                )}
              </div>

              {open && (
                <div className="dictation-answer">
                  <p className="dictation-en">
                    <EnglishText text={s.text} textJa={s.ja} level={level}
                                 statuses={wordStatuses} onMark={onMarkWord} />
                  </p>
                  {s.ja && (
                    <p className="passage-ja">
                      {s.jaIsWhole && <span className="slash-ja-label">段落の訳</span>}
                      {s.ja}
                    </p>
                  )}

                </div>
              )}

              {/* まねて言った結果 */}
              {spoken && (
                <div className="transcript">
                  <p className="transcript-line">
                    {spoken.diff.map((d, i) => (
                      <span key={i} className={`w w--${d.state}`}>{d.word} </span>
                    ))}
                  </p>
                  <p className="field-hint">
                    {Math.round(spokenRatio(spoken.diff) * 100)}% 聞き取れました
                  </p>
                </div>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
