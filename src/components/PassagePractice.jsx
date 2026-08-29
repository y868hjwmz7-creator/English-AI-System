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
import { loadEnglishVoices } from '../lib/speech.js'
import { readAloud, readAloudSequence, stopReading } from '../lib/readAloud.js'
import { voiceTierFor } from '../lib/voiceTier.js'
import { castClipSpeakers, castVoices, voiceFor } from '../lib/voiceCast.js'
import { prefetchGlosses } from '../lib/vocab.js'
import { SPEECH_RATES, loadRateId, rateOf, saveRateId } from '../lib/speechRate.js'
import { MicIcon, SpeakerIcon, StopIcon } from './Icons.jsx'
import EnglishText from './EnglishText.jsx'
import PhraseChips from './PhraseChips.jsx'
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

export default function PassagePractice({
  section, headline, isDialogue, tags = null, voiceId = null,
  level = 'B1', wordStatuses = null, onMarkWord = null,
}) {
  const [mode, setMode] = useState('read')
  const [voices, setVoices] = useState([])
  const [showJa, setShowJa] = useState(false)
  // 読み上げの速さ。取り組み方ごとのもとの速さに**掛ける**ので、
  // 音読・シャドーイングの差は保たれる
  const [rateId, setRateId] = useState(loadRateId)
  const [speakingId, setSpeakingId] = useState(null)
  // いま読み上げている語の位置(何文字目か)。合図を出さない端末では
  // null のままで、これまでどおり発言ごとの色分けだけが残る
  const [readingAt, setReadingAt] = useState(null)
  const [listeningId, setListeningId] = useState(null)
  const [results, setResults] = useState({})   // 段落ごとの結果
  const [notice, setNotice] = useState(null)
  const sessionRef = useRef(null)
  const stopAllRef = useRef(null)   // 通しの読み上げを止めるための関数

  useEffect(() => {
    let alive = true
    loadEnglishVoices().then((list) => { if (alive) setVoices(list) })
    return () => { alive = false; stopReading() }
  }, [])

  // 開いた時点で、まだ控えに無い語を裏で引いておく(2026-08 の要望)
  useEffect(() => {
    prefetchGlosses(
      section.items.map((it) => ({ text: it.prompt_en })).filter((x) => x.text),
      { level },
    )
  }, [section, level])

  // 読んでいるところまで画面を送る。すでに見えていれば動かない
  useEffect(() => {
    if (!speakingId) return
    document.querySelector(`[data-part="${window.CSS.escape(String(speakingId))}"]`)
      ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [speakingId])

  const current = MODES.find((m) => m.id === mode) ?? MODES[0]
  // 話す人 → 声。**会話は1人1声。** 同じ声だと役を追えない(2026-08 の指摘)
  const cast = castVoices(voices, section.items.map((it) => it.speaker))
  // こちらで作った音声(MP3)の話者。**端末の声から換算しない。**
  // 端末に英語の声が1つも無いと、2人とも同じ話者になってしまう
  // 訛りは教材が決め、性別は役ごとに決まる(0017)
  const clipCast = castClipSpeakers(section.items.map((it) => it.speaker), voiceId)
  // 本文はシャドーイングの素材なので、**良い声を使う**(`voiceTier.js`)
  const tier = voiceTierFor({ exerciseType: section.exercise_type, tags })
  const voice = voices[0] ?? null

  /** 読み上げを止める。通しでも1発言でも、同じところで止める */
  const stopPlaying = () => {
    stopAllRef.current?.()
    stopAllRef.current = null
    stopReading()
    setSpeakingId(null)
    setReadingAt(null)
  }

  const playOne = (item) => {
    // 鳴っているものをもう一度押したら、止める(Listen ⇄ Stop)
    if (speakingId === item.id) { stopPlaying(); return }
    stopPlaying()
    setSpeakingId(item.id)
    // 読み終わったら Listen に戻す。**MP3 なら本当の読み終わりで戻る。**
    // 端末の声のときは、合図が来ない端末のための保険が speakOnce にある
    readAloud(item.audio_text || item.prompt_en, {
      voice: voiceFor(cast, item.speaker, voice),
      clipVoice: voiceFor(clipCast, item.speaker, voiceId),
      clipTier: tier,
      rate: rateOf(rateId, current.rate),
      onWord: (w) => setReadingAt(w ? w.charIndex : null),
    }).then(() => {
      setSpeakingId((id) => (id === item.id ? null : id))
      setReadingAt(null)
    })
  }

  /**
   * 通して読み上げる。
   * **1本にまとめて読ませない。** 話す人ごとに声を変えるため、
   * 1発言ずつ順に読ませる(readAloudSequence)。
   */
  const playAll = () => {
    stopPlaying()
    // 先に「読めるもの」だけに絞ってから並べる。絞ったあとで番号を数えないと、
    // 「いま読んでいる発言」の印が1つずれる
    const playable = section.items.filter((it) => String(it.prompt_en ?? '').trim())
    stopAllRef.current = readAloudSequence(
      playable.map((it) => ({
        text: it.prompt_en,
        voice: voiceFor(cast, it.speaker, voice),
        clipVoice: voiceFor(clipCast, it.speaker, voiceId),
      })),
      {
        rate: rateOf(rateId, current.rate),
        clipTier: tier,
        onIndex: (i) => {
          if (i === null) stopAllRef.current = null
          setSpeakingId(i === null ? null : playable[i]?.id ?? null)
          setReadingAt(null)   // 次の発言に移ったら、前の語の色を消す
        },
        onWord: (w) => setReadingAt(w ? w.charIndex : null),
      },
    )
  }

  /** 話して確かめる。もう一度押すと止めて、結果を出す。 */
  const checkOne = async (item) => {
    if (listeningId === item.id) { sessionRef.current?.stop(); return }
    setNotice(null)
    stopPlaying()
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
            onClick={() => { stopPlaying(); setMode(m.id) }}
          >
            {m.label}
          </button>
        ))}
      </div>
      <p className="card-hint">{current.hint}</p>

      <div className="passage-tools">
        <button type="button" className="btn" onClick={playAll}>
          <SpeakerIcon />Listen (全体)
        </button>
        <label className="rate-pick">
          <span>速さ</span>
          <select value={rateId}
                  onChange={(e) => { setRateId(e.target.value); saveRateId(e.target.value); stopPlaying() }}>
            {SPEECH_RATES.map((r) => (
              <option key={r.id} value={r.id}>{r.label}({r.id}%)</option>
            ))}
          </select>
        </label>
        <button type="button" className="btn" onClick={() => setShowJa(!showJa)}>
          {showJa ? '日本語を隠す' : '日本語を見る'}
        </button>
        <button type="button" className="btn" onClick={stopPlaying}>
          <StopIcon />Stop
        </button>
      </div>

      {notice && <div className="notice notice--warn passage-notice">{notice}</div>}

      <ol className="passage-body">
        {section.items.map((item) => {
          const result = results[item.id]
          return (
            <li key={item.id} data-part={item.id}
                className={`passage-part${speakingId === item.id ? ' is-speaking' : ''}`}>
              {isDialogue && item.speaker && (
                <div className="passage-speaker" lang="en">{item.speaker}</div>
              )}
              <p className="passage-en">
                <EnglishText text={item.prompt_en} level={level}
                             statuses={wordStatuses} onMark={onMarkWord}
                             readingAt={speakingId === item.id ? readingAt : null} />
              </p>
              {/* 語をまたぐ言い回しは、語1つでは拾えない。札にして横に置く */}
              <PhraseChips phrases={item.phrases} sentence={item.prompt_en}
                           level={level} statuses={wordStatuses} onMark={onMarkWord} />
              {showJa && item.prompt_ja && <p className="passage-ja">{item.prompt_ja}</p>}

              <div className="passage-actions">
                <button
                  type="button" className="btn btn--small"
                  onClick={() => playOne(item)}
                >
                  {speakingId === item.id
                    ? <><StopIcon />Stop</>
                    : <><SpeakerIcon />Listen</>}
                </button>
                {isRecognitionSupported() && (
                  <button
                    type="button"
                    className={`btn btn--small${listeningId === item.id ? ' btn--primary' : ''}`}
                    onClick={() => checkOne(item)}
                  >
                    {listeningId === item.id
                      ? <><StopIcon />話し終わったら押す</>
                      : <><MicIcon />話して確かめる</>}
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
