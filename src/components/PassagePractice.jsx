/**
 * 記事・会話の本文を、6Steps で練習する画面。
 *
 * 【6Steps とは】(2026-08 利用者の指定)
 *   利用者のスクールのトレーニング。①ディクテーション ②スラッシュリーディング
 *   ③オーバーラッピング ④意味音読 ⑤シャドーイング ⑥リピーティング。
 *
 *   **6つは別々の教材ではない。同じ本文に対する取り組み方**である。
 *   だから演習(セクション)として分けない。分けたために「長文」が
 *   16個の短文になった失敗が、すでに一度ある(仕様書 第5.17節)。
 *
 *   もともとこの画面にあった「音読 / オーバーラッピング / シャドーイング /
 *   リピーティング」の4つが、**そのまま 6Steps の一部**だった。
 *   横に別のボタンを足すのではなく、**この切り替えを 6Steps に置き換えた。**
 *   同じことをするものが2つ並ぶのを避けるためである(第5.29節)。
 *
 * 【単位が2通りある】
 *   ①②④⑥ は**1文ずつ**、③⑤ は**本文まるごと**。
 *   本文の項目は段落(記事)/ 発言(会話)なので、
 *   1文ずつのステップでは `sentencesOf()` でさらにほどく。
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
import { useEffect, useMemo, useRef, useState } from 'react'
import { loadEnglishVoices } from '../lib/speech.js'
import { readAloud, readAloudSequence, stopReading } from '../lib/readAloud.js'
import { voiceTierFor } from '../lib/voiceTier.js'
import { resolveVoices } from '../data/clipVoices.js'
import { castClipSpeakers, castVoices, voiceFor } from '../lib/voiceCast.js'
import { prefetchGlosses } from '../lib/vocab.js'
import { SPEECH_RATES, loadRateId, rateOf, saveRateId } from '../lib/speechRate.js'
import { MicIcon, SpeakerIcon, StopIcon } from './Icons.jsx'
import EnglishText from './EnglishText.jsx'
import PhraseChips from './PhraseChips.jsx'
import { isRecognitionSupported, startRecognition } from '../lib/recognition.js'
import { compareTranscript, spokenRatio } from '../lib/transcriptDiff.js'
import { SIX_STEPS, sentencesOf, stepOf } from '../lib/sixSteps.js'
import SlashReading from './SlashReading.jsx'
import StepDictation from './StepDictation.jsx'
import StepSentence from './StepSentence.jsx'
import { loadGuideOpen, loadSlashLevel, saveGuideOpen, saveSlashLevel } from '../lib/slashLevel.js'

export default function PassagePractice({
  section, headline, isDialogue, tags = null, voiceIds = null,
  level = 'B1', wordStatuses = null, onMarkWord = null,
}) {
  const [step, setStep] = useState('dictation')
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
  const [results, setResults] = useState({})   // 段落 / 文ごとの結果
  const [notice, setNotice] = useState(null)
  // ② の区切りの細かさ。**覚えておく**(開くたびに選び直させない)
  const [slashLevel, setSlashLevel] = useState(loadSlashLevel)
  // ⑤ シャドーイングは本文を隠して行う。追いつけないときの逃げ道は残す
  const [peek, setPeek] = useState(false)
  // やり方の説明を開いているか。**一度読めば、しばらく要らない**ので覚える
  const [guideOpen, setGuideOpen] = useState(loadGuideOpen)
  const sessionRef = useRef(null)
  const stopAllRef = useRef(null)   // 通しの読み上げを止めるための関数
  const stepBarRef = useRef(null)   // 6Steps の帯(選んでいるものを見える位置へ寄せる)

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

  const current = stepOf(step)
  // ①②④⑥ は1文ずつ。段落・発言をさらにほどく
  const sentences = useMemo(() => sentencesOf(section.items), [section.items])
  // 話す人 → 声。**会話は1人1声。** 同じ声だと役を追えない(2026-08 の指摘)
  const cast = castVoices(voices, section.items.map((it) => it.speaker))
  // こちらで作った音声(MP3)の話者。**端末の声から換算しない。**
  // 端末に英語の声が1つも無いと、2人とも同じ話者になってしまう
  // 訛りは教材が決め、性別は役ごとに決まる(0017)
  const clipCast = castClipSpeakers(section.items.map((it) => it.speaker), voiceIds)
  // 記事のように話す人がいない本文は、1つめの声で読む
  const soloVoice = resolveVoices(voiceIds)[0]
  // 本文はシャドーイングの素材なので、**良い声を使う**(`voiceTier.js`)
  const tier = voiceTierFor({ exerciseType: section.exercise_type, tags })
  const voice = voices[0] ?? null

  // ステップを移ったら、鳴っているものを止め、⑤ の「本文を出す」も戻す
  useEffect(() => { stopReading(); setSpeakingId(null); setReadingAt(null); setPeek(false) }, [step])

  // 6つは横に流れるので、**選んでいるものを見える位置へ寄せる。**
  // どこにいるか分からないまま端の項目を探すことになる(タブと同じ)。
  // **帯だけを動かす。** `scrollIntoView` は画面ごと横へずらすことがある
  useEffect(() => {
    const bar = stepBarRef.current
    const on = bar?.querySelector('.chip--on')
    if (!bar || !on) return
    bar.scrollLeft = Math.max(0, on.offsetLeft - (bar.clientWidth - on.offsetWidth) / 2)
  }, [step])

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
      clipVoice: voiceFor(clipCast, item.speaker, soloVoice),
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
        clipVoice: voiceFor(clipCast, it.speaker, soloVoice),
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
  //
  // **段落でも1文でも、同じ関数を使う。** 段落は `prompt_en`、
  // 1文は `text` に英語が入っている。呼び分けを2か所に置かない
  const checkOne = async (item) => {
    if (listeningId === item.id) { sessionRef.current?.stop(); return }
    const model = item.prompt_en ?? item.text ?? ''
    setNotice(null)
    stopPlaying()
    setListeningId(item.id)

    const session = startRecognition()
    sessionRef.current = session
    try {
      const { text, confident } = await session.done
      const diff = compareTranscript(model, text)
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

      {/* 6Steps。**番号を出す。** 順にやるものなので、
          いま何番目かが分かることそのものが道しるべになる。
          折り返さず横に流し、選んでいるものを見える位置へ寄せる
          (タブで一度学んだこと) */}
      <div className="passage-modes steps" role="group" aria-label="6Steps" ref={stepBarRef}>
        {SIX_STEPS.map((m) => (
          <button
            key={m.id} type="button" title={m.hint}
            className={`chip${step === m.id ? ' chip--on' : ''}`}
            onClick={() => { stopPlaying(); setStep(m.id) }}
          >
            <span className="step-no">{m.no}</span>{m.label}
          </button>
        ))}
      </div>
      {/* やり方。**1行に1つ。** 1つの段落に流すと、改行も区切りも無い棒になって
          読めない(指導ポイントで一度学んだこと)。
          狭い画面では畳めるようにする。何度も読むものではない */}
      <details className="step-guide" open={guideOpen}
               onToggle={(e) => { setGuideOpen(e.currentTarget.open); saveGuideOpen(e.currentTarget.open) }}>
        <summary className="step-guide-sum">
          <span className="step-guide-aim">{current.aim}</span>
        </summary>
        <ol className="step-guide-how">
          {current.how.map((line, i) => (
            <li key={i}>
              {line.split('**').map((t, k) => (k % 2 ? <strong key={k}>{t}</strong> : t))}
            </li>
          ))}
        </ol>
      </details>

      <div className="passage-tools">
        {/* 通しの読み上げは、本文まるごとのステップ(③⑤)でだけ意味がある。
            1文ずつのステップでは、各文の Listen を使う */}
        {current.unit === 'passage' && (
          <button type="button" className="btn" onClick={playAll}>
            <SpeakerIcon />Listen (全体)
          </button>
        )}
        <label className="rate-pick">
          <span>速さ</span>
          <select value={rateId}
                  onChange={(e) => { setRateId(e.target.value); saveRateId(e.target.value); stopPlaying() }}>
            {SPEECH_RATES.map((r) => (
              <option key={r.id} value={r.id}>{r.label}({r.id}%)</option>
            ))}
          </select>
        </label>
        {current.unit === 'passage' && (
          <button type="button" className="btn" onClick={() => setShowJa(!showJa)}>
            {showJa ? '日本語を隠す' : '日本語を見る'}
          </button>
        )}
        {/* ⑤ は本文を見ないで行う。**追いつけないときの逃げ道は残す** */}
        {!current.script && current.unit === 'passage' && (
          <button type="button" className="btn" onClick={() => setPeek(!peek)}>
            {peek ? '本文を隠す' : '本文を出す'}
          </button>
        )}
        <button type="button" className="btn" onClick={stopPlaying}>
          <StopIcon />Stop
        </button>
      </div>

      {notice && <div className="notice notice--warn passage-notice">{notice}</div>}

      {/* ── ①②④⑥ は1文ずつ ──────────────────────────── */}
      {step === 'dictation' && (
        <StepDictation
          sentences={sentences} clipVoice={soloVoice} tier={tier}
          rate={rateOf(rateId, current.rate)} level={level}
          wordStatuses={wordStatuses} onMarkWord={onMarkWord}
          listeningId={listeningId} onCheck={checkOne} results={results}
        />
      )}
      {step === 'slash' && (
        <SlashReading
          sentences={sentences} clipVoice={soloVoice} tier={tier}
          rate={rateOf(rateId, current.rate)}
          level={slashLevel}
          onLevelChange={(v) => { setSlashLevel(v); saveSlashLevel(v) }}
        />
      )}
      {(step === 'meaning' || step === 'repeat') && (
        <StepSentence
          sentences={sentences} startVisible={current.script}
          clipVoice={soloVoice} tier={tier}
          rate={rateOf(rateId, current.rate)} level={level}
          wordStatuses={wordStatuses} onMarkWord={onMarkWord}
          listeningId={listeningId} onCheck={checkOne} results={results}
        />
      )}

      {/* ── ③⑤ は本文まるごと ───────────────────────────
          ⑤ シャドーイングは**本文を見ないで**行う(利用者の指定)。
          隠すのは英語だけで、Listen も話して確かめるもそのまま使える */}
      {current.unit === 'passage' && (
      <ol className={`passage-body${current.script || peek ? '' : ' is-hidden-text'}`}>
        {section.items.map((item) => {
          const result = results[item.id]
          return (
            <li key={item.id} data-part={item.id}
                className={`passage-part${speakingId === item.id ? ' is-speaking' : ''}`}>
              {isDialogue && item.speaker && (
                <div className="passage-speaker" lang="en">{item.speaker}</div>
              )}
              {current.script || peek ? (
                <p className="passage-en">
                  <EnglishText text={item.prompt_en} textJa={item.prompt_ja} level={level}
                               statuses={wordStatuses} onMark={onMarkWord}
                               readingAt={speakingId === item.id ? readingAt : null} />
                </p>
              ) : (
                /* 隠していても**場所は残す。** 消すと、いくつ段落があるのか
                   分からなくなり、いま何番目を追っているのかも見失う */
                <p className="passage-en passage-en--hidden" aria-hidden="true">　</p>
              )}
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
      )}

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
