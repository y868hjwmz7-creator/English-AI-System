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

/** 声の読み込みは1回だけ。以降は同じ約束を使い回す */
let voicePromise = null
const bestVoice = () => {
  if (!voicePromise) voicePromise = loadEnglishVoices().then((list) => list[0] ?? null)
  return voicePromise
}

export default function SpeakButton({ text, label = 'お手本', rate = 0.9, className = '' }) {
  const [voice, setVoice] = useState(null)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    let alive = true
    bestVoice().then((v) => { if (alive) setVoice(v) })
    return () => { alive = false }
  }, [])

  if (!text || !isSpeechSupported()) return null

  const play = () => {
    if (playing) { stopSpeaking(); setPlaying(false); return }
    stopSpeaking()
    setPlaying(true)
    speak(text, { voice, rate })
    // 読み終わりの合図は端末によって来ないことがあるため、
    // 語数からおおよその時間で戻す。押せないままになるより実害が小さい。
    const seconds = Math.max(2, String(text).split(/\s+/).length / 2.2)
    window.setTimeout(() => setPlaying(false), seconds * 1000)
  }

  return (
    <button type="button" className={`btn btn--small no-print ${className}`} onClick={play}>
      {playing ? '■ 止める' : `🔊 ${label}`}
    </button>
  )
}
