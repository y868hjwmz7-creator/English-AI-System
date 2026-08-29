/**
 * 英文を読み上げるボタン。
 *
 * 宿題の画面には、これまで**読み上げの手段が1つも無かった。**
 * リスニングの演習は「英文は見せずに聞かせる」形なのに、聞く方法が
 * 無かったため、解きようがなかった(2026-08 の指摘)。
 *
 * 声の読み込みは端末ごとに時間がかかるので、**アプリ全体で1回だけ**行う。
 * 設問ごとに読み込むと、40問の画面で40回走ることになる。
 *
 * 【2026-08 — 鳴らすのは、こちらで作った音声】
 *   iPhone では端末の声がひどい(仕様書 5.2.1)。教材の英文は
 *   こちらで作った MP3 を配る形に変えた。どちらを鳴らすかは
 *   `readAloud.js` が決めるので、ここは呼ぶだけでよい。
 *   端末の声は、MP3 がまだ無いときの受け皿として渡している。
 */
import { useEffect, useState } from 'react'
import { loadEnglishVoices } from '../lib/speech.js'
import { canReadAloud, readAloud, stopReading } from '../lib/readAloud.js'
import { STANDARD } from '../lib/voiceTier.js'
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
  clipVoice = null, tier = STANDARD, onPlayingChange = null, onWord = null,
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

  if (!text || !canReadAloud()) return null

  // 読んでいるあいだ、親が「いまここ」を色で示せるように知らせる
  const setState = (on) => { setPlaying(on); onPlayingChange?.(on) }

  const play = () => {
    if (playing) { stopReading(); setState(false); onWord?.(null); return }
    setState(true)
    // いま読んでいる語の位置を親へ知らせる(色を付けるため)。
    // **読み終わったところで Stop から Listen に戻す。**
    // MP3 なら本当の読み終わり、端末の声なら保険の時間で戻る(speech.js)
    readAloud(text, { voice, clipVoice, clipTier: tier, rate: speed, onWord }).then(() => {
      setState(false)
      onWord?.(null)
    })
  }

  return (
    <button type="button" className={`btn btn--small no-print ${className}`} onClick={play}>
      {playing
        ? <><StopIcon />Stop</>
        : <><SpeakerIcon />{label}</>}
    </button>
  )
}
