/**
 * 英文を読み上げるボタン。
 *
 * 宿題の画面には、これまで**読み上げの手段が1つも無かった。**
 * リスニングの演習は「英文は見せずに聞かせる」形なのに、聞く方法が
 * 無かったため、解きようがなかった(2026-08 の指摘)。
 *
 * 声の読み込みは端末ごとに時間がかかるので、**アプリ全体で1回だけ**行う。
 * 設問ごとに読み込むと、40問の画面で40回走ることになる。
 */
import { useEffect, useState } from 'react'
import { isSpeechSupported, loadEnglishVoices, speak, stopSpeaking } from '../lib/speech.js'
import { SpeakerIcon, StopIcon } from './Icons.jsx'
import { loadRateId, rateOf } from '../lib/speechRate.js'

/** 声の読み込みは1回だけ。以降は同じ約束を使い回す */
let voicePromise = null
const bestVoice = () => {
  if (!voicePromise) voicePromise = loadEnglishVoices().then((list) => list[0] ?? null)
  return voicePromise
}

// 読み上げのボタンは、どの演習でも **Listen**、止めるときは **Stop**
// (2026-08 利用者の指定)。「お手本」「聞く」と場所によって違っていた。
// **対になる操作は、どちらも同じ言葉づかいにする。**
// Listen と「止める」が並ぶと、押し分けが一瞬わからない。
export default function SpeakButton({
  text, label = 'Listen', rate = null, className = '', voice: given = null,
  onPlayingChange = null,
}) {
  // 速さの指定が無ければ、端末に覚えさせた速さを使う。
  // こうしておくと、速さを選ぶ場所が無い画面でも同じ速さで鳴る
  const speed = rate ?? rateOf(loadRateId())
  // 会話では話す人ごとに声を変える。指定があればそれを使う(voiceCast.js)
  const [auto, setAuto] = useState(null)
  const voice = given ?? auto
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    let alive = true
    bestVoice().then((v) => { if (alive) setAuto(v) })
    return () => { alive = false }
  }, [])

  if (!text || !isSpeechSupported()) return null

  // 読んでいるあいだ、親が「いまここ」を色で示せるように知らせる
  const setState = (on) => { setPlaying(on); onPlayingChange?.(on) }

  const play = () => {
    if (playing) { stopSpeaking(); setState(false); return }
    stopSpeaking()
    setState(true)
    speak(text, { voice, rate: speed })
    // 読み終わりの合図は端末によって来ないことがあるため、
    // 語数からおおよその時間で戻す。押せないままになるより実害が小さい。
    const seconds = Math.max(2, String(text).split(/\s+/).length / 2.2)
    window.setTimeout(() => setState(false), seconds * 1000)
  }

  return (
    <button type="button" className={`btn btn--small no-print ${className}`} onClick={play}>
      {playing
        ? <><StopIcon />Stop</>
        : <><SpeakerIcon />{label}</>}
    </button>
  )
}
