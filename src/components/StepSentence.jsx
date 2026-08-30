/**
 * ④ 意味音読(Read & Lookup)と ⑥ リピーティング。
 * どちらも「**1文ずつ、顔を上げて、日本語 → 英語**」なので1つにした。
 *
 * 【④ 意味音読】(2026-08 利用者の指定)
 *   > ②で理解した文法と意味を考えながら音読をするステップ。
 *   > 速く読むのが目的ではない。慣れたら、一文を読み、顔を上げて
 *   > 日本語の意味を言う→英語を言う
 *   → **本文を見た状態から始める。**
 *
 * 【⑥ リピーティング】
 *   > 1文を通して聴き理解し、聞き終わった後に同じ英文を口に出す。
 *   > 2段階目は聞いた後に日本語で意味を言った後に英語で言う。
 *   > わからなくなってしまったら音声を再度再生して聞く。
 *   → **本文を隠した状態から始める。**
 *
 * ちがいは「はじめに英文が見えているか」だけである。
 * **同じ操作を2か所に書き写さない。**
 */
import { useEffect, useState } from 'react'
import { isRecognitionSupported } from '../lib/recognition.js'
import EnglishText from './EnglishText.jsx'
import SpeakButton from './SpeakButton.jsx'
import { MicIcon, StopIcon } from './Icons.jsx'
import { spokenRatio } from '../lib/transcriptDiff.js'

export default function StepSentence({
  sentences, startVisible, clipVoice, tier, rate, level,
  wordStatuses, onMarkWord, listeningId, onCheck, results,
}) {
  // 文ごとに「英語が見えているか」。ステップを移ったら、はじめの状態に戻す
  const [openEn, setOpenEn] = useState({})
  const [openJa, setOpenJa] = useState({})
  useEffect(() => { setOpenEn({}); setOpenJa({}) }, [startVisible])

  const enShown = (id) => (openEn[id] === undefined ? startVisible : openEn[id])

  return (
    <ol className="stepsent-list">
      {sentences.map((s, n) => {
        const en = enShown(s.id)
        const ja = openJa[s.id]
        const spoken = results[s.id]
        return (
          <li key={s.id} className="stepsent-row">
            {/* **操作は右上にまとめる。** 話者の名前と反対側に置くと、
                本文をそのぶん上に寄せられる(2026-08 の指摘) */}
            <div className="row-head">
              <span className="dictation-no">{n + 1}</span>
              {s.speaker && <span className="passage-speaker" lang="en">{s.speaker}</span>}
              <span className="row-tools">
                <SpeakButton text={s.text} className="etext-listen"
                             clipVoice={clipVoice} tier={tier} rate={rate} />
                <button type="button" className="btn btn--small"
                        onClick={() => setOpenEn((v) => ({ ...v, [s.id]: !en }))}>
                  {en ? '英語を隠す' : '英語を見る'}
                </button>
                {s.ja && (
                  <button type="button" className="btn btn--small"
                          onClick={() => setOpenJa((v) => ({ ...v, [s.id]: !v[s.id] }))}>
                    {ja ? '日本語を隠す' : '日本語を見る'}
                  </button>
                )}
                {isRecognitionSupported() && (
                  <button type="button"
                          className={`btn btn--small${listeningId === s.id ? ' btn--primary' : ''}`}
                          onClick={() => onCheck(s)}>
                    {listeningId === s.id
                      ? <><StopIcon />話し終わったら押す</>
                      : <><MicIcon />英語で言う</>}
                  </button>
                )}
              </span>
            </div>

            {/* 英語。**隠しているあいだは、場所だけ残す。**
                行が消えると、いくつ文があるのか分からなくなる */}
            {en ? (
              <p className="stepsent-en">
                <EnglishText text={s.text} textJa={s.ja} level={level}
                             statuses={wordStatuses} onMark={onMarkWord} />
              </p>
            ) : (
              <p className="stepsent-hidden" aria-hidden="true">　</p>
            )}

            {ja && s.ja && (
              <p className="passage-ja">
                {s.jaIsWhole && <span className="slash-ja-label">段落の訳</span>}
                {s.ja}
              </p>
            )}

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
  )
}
