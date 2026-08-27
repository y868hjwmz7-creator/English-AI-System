/**
 * 記事・会話の本文を、声に出して練習する画面。
 *
 * 【なぜ「取り組み方」を切り替える形にしたか】
 *   音読・オーバーラッピング・シャドーイング・リピーティングは、
 *   **別々の教材ではなく、同じ本文に対する取り組み方**である。
 *   以前はこれを演習として分けていたため、記事にならず、
 *   短い英文が並ぶだけの教材になっていた(仕様書 第5.17節)。
 *
 * 【文字起こしのフィードバックについて】
 *   話した内容を文字にして、お手本と単語ごとに突き合わせ、色で示す。
 *   点数を1つ出しても次に何を直せばよいか分からないが、
 *   「to が抜けている」と見えれば直せる。
 *
 *   **これは発音の良し悪しを測るものではない。** 音声認識が聞き取れたか
 *   どうかを見ているだけである。ただし「聞き取ってもらえない発音」は
 *   実用上通じない発音なので、練習の手がかりとしては十分に働く。
 *   この前提は画面にも書く(隠すと、点数を実力と誤解させる)。
 */
import { useEffect, useRef, useState } from 'react'
import { loadEnglishVoices, speak, stopSpeaking } from '../lib/speech.js'
import { isRecognitionSupported, startRecognition } from '../lib/recognition.js'
import { compareTranscript, spokenRatio } from '../lib/transcriptDiff.js'

/** 取り組み方。読む速さと、お手本の出し方が変わる */
const MODES = [
  {
    id: 'read', label: '音読', rate: 0.9,
    hint: 'お手本を聞いてから、自分のペースで読みます。まず意味と区切りをつかみます。',
  },
  {
    id: 'overlap', label: 'オーバーラッピング', rate: 0.85,
    hint: 'お手本と同時に、重ねて読みます。文字を見ながらで構いません。',
  },
  {
    id: 'shadow', label: 'シャドーイング', rate: 0.85,
    hint: 'お手本の少しあとを追いかけて読みます。慣れるまでは文字を見て構いません。',
  },
  {
    id: 'repeat', label: 'リピーティング', rate: 0.9,
    hint: 'お手本を聞き、止めてから繰り返します。1段落ずつ区切って行います。',
  },
]

export default function PassagePractice({ section, headline, isDialogue }) {
  const [mode, setMode] = useState('read')
  const [voice, setVoice] = useState(null)
  const [showJa, setShowJa] = useState(false)
  const [speakingId, setSpeakingId] = useState(null)
  const [listeningId, setListeningId] = useState(null)
  const [results, setResults] = useState({})   // 段落ごとの結果
  const [notice, setNotice] = useState(null)
  const sessionRef = useRef(null)

  useEffect(() => {
    let alive = true
    loadEnglishVoices().then((list) => { if (alive) setVoice(list[0] ?? null) })
    return () => { alive = false; stopSpeaking() }
  }, [])

  const current = MODES.find((m) => m.id === mode) ?? MODES[0]

  const playOne = (item) => {
    stopSpeaking()
    setSpeakingId(item.id)
    speak(item.audio_text || item.prompt_en, { voice, rate: current.rate })
    // 読み終わりの合図は端末によって来ないことがあるため、
    // 語数からおおよその時間で戻す。表示が戻らないより実害が小さい。
    const seconds = Math.max(2, (item.prompt_en ?? '').split(/\s+/).length / 2.2)
    window.setTimeout(() => setSpeakingId((id) => (id === item.id ? null : id)), seconds * 1000)
  }

  const playAll = () => {
    stopSpeaking()
    const text = section.items
      .map((it) => (isDialogue && it.speaker ? `${it.speaker}. ${it.prompt_en}` : it.prompt_en))
      .filter(Boolean).join(' ')
    speak(text, { voice, rate: current.rate })
  }

  /** 話して確かめる。もう一度押すと止めて、結果を出す。 */
  const checkOne = async (item) => {
    if (listeningId === item.id) { sessionRef.current?.stop(); return }
    setNotice(null)
    stopSpeaking()
    setListeningId(item.id)

    const session = startRecognition()
    sessionRef.current = session
    try {
      const { text, confident } = await session.done
      const diff = compareTranscript(item.prompt_en, text)
      setResults((r) => ({ ...r, [item.id]: { diff, text, confident } }))
    } catch (e) {
      setNotice(e.message)
    } finally {
      setListeningId(null)
      sessionRef.current = null
    }
  }

  return (
    <div className="passage">
      {headline && <h4 className="passage-headline" lang="en">{headline}</h4>}

      <div className="passage-modes" role="group" aria-label="取り組み方">
        {MODES.map((m) => (
          <button
            key={m.id} type="button"
            className={`chip${mode === m.id ? ' chip--on' : ''}`}
            onClick={() => { stopSpeaking(); setMode(m.id) }}
          >
            {m.label}
          </button>
        ))}
      </div>
      <p className="card-hint">{current.hint}</p>

      <div className="passage-tools">
        <button type="button" className="btn" onClick={playAll}>
          ▶ 通して聞く
        </button>
        <button type="button" className="btn" onClick={() => setShowJa(!showJa)}>
          {showJa ? '日本語を隠す' : '日本語を見る'}
        </button>
        <button type="button" className="btn" onClick={stopSpeaking}>■ 止める</button>
      </div>

      {notice && <div className="notice notice--warn passage-notice">{notice}</div>}

      <ol className="passage-body">
        {section.items.map((item) => {
          const result = results[item.id]
          return (
            <li key={item.id} className="passage-part">
              {isDialogue && item.speaker && (
                <div className="passage-speaker" lang="en">{item.speaker}</div>
              )}
              <p className="passage-en" lang="en">{item.prompt_en}</p>
              {showJa && item.prompt_ja && <p className="passage-ja">{item.prompt_ja}</p>}

              <div className="passage-actions">
                <button
                  type="button" className="btn btn--small"
                  onClick={() => playOne(item)}
                >
                  {speakingId === item.id ? '読んでいます…' : '🔊 お手本'}
                </button>
                {isRecognitionSupported() && (
                  <button
                    type="button"
                    className={`btn btn--small${listeningId === item.id ? ' btn--primary' : ''}`}
                    onClick={() => checkOne(item)}
                  >
                    {listeningId === item.id ? '■ 話し終わったら押す' : '🎤 話して確かめる'}
                  </button>
                )}
              </div>

              {result && (
                <div className="transcript">
                  <p className="transcript-line">
                    {result.diff.map((d, i) => (
                      <span key={i} className={`w w--${d.state}`}>{d.word} </span>
                    ))}
                  </p>
                  <p className="field-hint">
                    <span className="w w--ok">黒</span>=聞き取れた /{' '}
                    <span className="w w--missed">灰色の取り消し線</span>=抜けた・違う音になった /{' '}
                    <span className="w w--extra">下線</span>=お手本に無いものが聞こえた
                    {' … '}
                    {Math.round(spokenRatio(result.diff) * 100)}% 聞き取れました
                  </p>
                </div>
              )}
            </li>
          )
        })}
      </ol>

      {isRecognitionSupported() ? (
        <p className="field-hint">
          ※ これは<strong>発音の点数ではありません。</strong>
          音声認識が聞き取れたかどうかを見ています。
          ただし聞き取ってもらえない発音は実際にも通じにくいので、
          直す手がかりとしては使えます。
        </p>
      ) : (
        <p className="field-hint">
          ※ この端末は音声認識に対応していないため、「話して確かめる」は出ません。
          お手本を聞いて声に出す練習は、そのまま行えます。
        </p>
      )}
    </div>
  )
}
