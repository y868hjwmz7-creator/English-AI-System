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
import { useEffect, useRef, useState } from 'react'
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
  /**
   * **くり返し鳴らすか**(2026-09 利用者の指定・ディクテーション)。
   * 止めるまで、少し間を置いて何度でも読み直す。
   * 書き取りは1回では聞き取れないので、押し直す手間をなくす。
   */
  repeat = false,
}) {
  // 速さの指定が無ければ、端末に覚えさせた速さを使う。
  // こうしておくと、速さを選ぶ場所が無い画面でも同じ速さで鳴る
  const speed = rate ?? rateOf(loadRateId())
  // 会話では話す人ごとに声を変える。指定があればそれを使う(voiceCast.js)
  const [auto, setAuto] = useState(null)
  const voice = given ?? auto
  const [playing, setPlaying] = useState(false)
  /*
   * **音が出るまでのあいだ**(2026-09 利用者の指摘)。
   *
   *   > Listen 全て(どこにあるものでも共通)において、
   *   > 1度目に押すと反応しないことが多いです。
   *
   * その英文の MP3 がまだ無いと、窓口(`speak`)が作り終わるまで
   * **数秒間まったく音がしない。** ボタンは Stop に変わっているだけなので、
   * 押しても何も起きなかったように見え、もう一度押す。
   * ところがその2度目は「止める」なので、やはり鳴らない。
   * 鳴るのは3度目である。これが「1度目は反応しない」の正体だった。
   *
   * **成功と失敗(いま起きていることと、何も起きていないこと)を、
   * 同じ見た目で終わらせない**(CLAUDE.md)。用意しているあいだは
   * そう書き、**2秒を過ぎたら経過秒数も出す。**
   */
  const [waiting, setWaiting] = useState(false)
  const [secs, setSecs] = useState(0)

  useEffect(() => {
    let alive = true
    bestVoice().then((v) => { if (alive) setAuto(v) })
    return () => { alive = false }
  }, [])

  /* **くり返しは、押しっぱなしの状態として持つ。**
     `playing`(見た目)だけで見ていると、読み終わりの一瞬に false になり、
     そこでくり返しが止まる。**「押した」ことを ref で持つ** */
  const playingRef = useRef(false)
  const repeatRef = useRef(repeat)
  repeatRef.current = repeat
  const timer = useRef(null)

  /** 経過秒数を数える札。**用意しているあいだだけ動かす** */
  const ticker = useRef(null)
  const stopTicker = () => {
    window.clearInterval(ticker.current)
    ticker.current = null
  }

  /** 止める。**くり返しの予約も消す** */
  const stop = () => {
    playingRef.current = false
    window.clearTimeout(timer.current)
    stopTicker()
    setWaiting(false)
    stopReading()
    setState(false)
    onWord?.(null)
  }

  /**
   * 1回ぶん鳴らす。**終わったら、くり返しの指定があればもう一度。**
   *
   * 【止まる条件を持たせる】(CLAUDE.md)
   *   鳴らせない状況(音声が無い・切られた)では、読み上げがすぐ終わる。
   *   そのままくり返すと、**目にも見えないまま回り続ける。**
   *   0.3秒に満たずに終わったら、失敗とみなしてやめる。
   */
  const run = () => {
    const from = Date.now()
    // **押した瞬間から「用意しています…」。** 鳴り始めたら消す
    setWaiting(true)
    setSecs(0)
    stopTicker()
    ticker.current = window.setInterval(() => {
      setSecs(Math.round((Date.now() - from) / 1000))
    }, 500)
    const heard = () => { stopTicker(); setWaiting(false) }

    readAloud(text, {
      voice, clipVoice, clipTier: tier, rate: speed, onWord, onStart: heard,
    }).then(() => {
      heard()
      onWord?.(null)
      if (!playingRef.current) return                 // 止められた
      if (!repeatRef.current || Date.now() - from < 300) {
        playingRef.current = false
        setState(false)
        return
      }
      // **少し間を置く。** 続けて鳴らすと、文の切れ目が分からない
      timer.current = window.setTimeout(() => { if (playingRef.current) run() }, 700)
    }).catch(() => {
      // **鳴らなかったときも、必ず Listen に戻す。**
      // 押しっぱなしの見た目で止まると、もう一度押しても止めるだけになる
      heard()
      playingRef.current = false
      setState(false)
    })
  }

  /* 画面から消えるときは止める。**くり返しは、放っておくと鳴り続ける** */
  useEffect(() => () => {
    if (playingRef.current) { playingRef.current = false; stopReading() }
    window.clearTimeout(timer.current)
    window.clearInterval(ticker.current)
  }, [])

  if (!text || !canReadAloud()) return null

  // 読んでいるあいだ、親が「いまここ」を色で示せるように知らせる
  const setState = (on) => { setPlaying(on); onPlayingChange?.(on) }

  const play = () => {
    if (playingRef.current) { stop(); return }
    playingRef.current = true
    setState(true)
    run()
  }

  return (
    <button type="button" className={`btn btn--small no-print ${className}`} onClick={play}>
      {playing
        ? <><StopIcon />{waiting ? preparingLabel(secs) : 'Stop'}</>
        : <><SpeakerIcon />{label}</>}
    </button>
  )
}

/**
 * 用意しているあいだの文言。**2秒を過ぎたら経過秒数も出す。**
 * すぐ鳴る場合(控えが効いているとき)に数字が一瞬ちらつかないよう、
 * はじめの2秒は出さない。**ここだけに置く**(2か所に書き分けない)。
 */
export const preparingLabel = (secs) => (secs >= 2 ? `用意中 ${secs} 秒` : '用意しています…')
