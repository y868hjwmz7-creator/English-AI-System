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
import { storedChunks, storedParts } from '../lib/chunkJa.js'
import { SPEECH_RATES, loadRateId, rateOf, saveRateId } from '../lib/speechRate.js'
import { progressKey, useProgress } from '../lib/progress.js'
import { markIn } from '../lib/useWordStatuses.js'
import { MicIcon, SpeakerIcon, StopIcon } from './Icons.jsx'
import { preparingLabel } from './SpeakButton.jsx'
import EnglishText from './EnglishText.jsx'
import RepeatToggle from './RepeatToggle.jsx'
import StepFocus from './StepFocus.jsx'
import { isRecognitionSupported, startRecognition } from '../lib/recognition.js'
import { compareTranscript, spokenRatio } from '../lib/transcriptDiff.js'
import { SLASH_LEVELS } from '../lib/chunker.js'
import {
  PASSAGE_VIEWS, SIX_STEPS, blocksOf, groupSentences, sentencesOf, stepOf,
} from '../lib/sixSteps.js'
import ChunkedText from './ChunkedText.jsx'
import SlashReading from './SlashReading.jsx'
import SlashedText from './SlashedText.jsx'
import StepDictation from './StepDictation.jsx'
import StepSentence from './StepSentence.jsx'
import {
  loadDictSize, loadGuideOpen, loadSlashLevel, loadSlashUnit,
  saveDictSize, saveGuideOpen, saveSlashLevel, saveSlashUnit,
} from '../lib/slashLevel.js'
import { usePracticeLog } from '../lib/practice.js'

export default function PassagePractice({
  section, headline, isDialogue, tags = null, voiceIds = null,
  level = 'B1', wordStatuses = null, onMarkWord = null, materialId = null,
  /** 誰の学習として残すか(0025)。ゲスト自身 / レッスン中のゲスト */
  learnerId = null,
  /**
   * 集中モードのボタンをここに出すか(2026-09 実機)。
   *
   * レッスン表示(`LessonView`)は、集中モードを **6Steps と並ぶ
   * もう1つの取り組み方**として上のボタンの行に置いている。
   * この部品はその 6Steps の中身なので、**そこでは出さない。**
   * **同じことをするボタンを、1つの画面に2つ見せない**(CLAUDE.md)。
   */
  showFocus = true,
  /**
   * 集中モードの幅(`w100`〜`w150` / `wfit`・2026-09 実機)。
   * レッスン表示の紙で選んでいる幅を、そのまま引き継ぐ。
   * **数字は `.lesson-sheet--w*` と同じもの**(`FocusReader` と共通)。
   * 紙の外(ゲストの宿題など)からは指定が無いので、そのままの幅になる。
   */
  focusWidth = 'w100',
}) {
  // 取り組みを**裏で数える**(0022)。ゲストのぶんだけ数える
  usePracticeLog('six_steps', true, learnerId)
  /** 集中モード(1段落ずつ調べる画面)を出しているか(2026-09 利用者の指定)。
      **覚えない。** 開くたびに本文から始めるほうが素直である */
  const [focus, setFocus] = useState(false)
  /** 集中モードで、いま何番目を出しているか。**取り組み方を変えたら先頭へ戻す** */
  const [focusAt, setFocusAt] = useState(0)
  /* **どの教材で会ったかを添える**(0024)。単語帳を教材名で絞るのに要る */
  const markWord = markIn(onMarkWord, materialId, learnerId)
  /**
   * **やりかけを覚えておく**(2026-08 利用者の指定)。
   *
   *   > 各種トレーニングをやり途中で他のページに行ってから戻ると
   *   > 途中まで区切ったスラッシュリーディングや書き途中だった
   *   > ディクテーションが消えてしまいます。
   *
   * どのトレーニングを開いていたかも、そのうちの1つである。
   * 中身(区切り・書きかけ)は、それぞれの部品が同じ鍵の形で覚える。
   */
  const [step, setStep] = useProgress(
    progressKey(materialId, section.id, 'step'), 'dictation', learnerId,
  )
  const [voices, setVoices] = useState([])
  const [showJa, setShowJa] = useState(false)
  // 読み上げの速さ。取り組み方ごとのもとの速さに**掛ける**ので、
  // 音読・シャドーイングの差は保たれる
  const [rateId, setRateId] = useState(loadRateId)
  const [speakingId, setSpeakingId] = useState(null)
  /* いま鳴らしている段落。**`useEffect` の外から読むので ref でも持つ。**
     くり返しの判定は読み上げが終わった瞬間に行うので、
     そのときの状態が要る(state はまだ古いことがある) */
  const speakingRef = useRef(null)
  /**
   * くり返して鳴らす段落(2026-09 利用者の指定)。
   *
   *   > 意味音読、オーバーラッピング、シャドーイングも段落内の
   *   > 再生ボタンの横にはリピートボタンを配置してください。
   *
   * ③⑤ は**本文まるごと**を見ながらまねる練習なので、
   * 同じ段落を何度も聴く。押し直していては口が追いつかない。
   * **覚えない**(鳴りっぱなしになる指定・CLAUDE.md)。
   * ①②④⑥ は文ごとの部品(`StepDictation` / `StepSentence`)が持つ。
   */
  const [loopIds, setLoopIds] = useState(() => new Set())
  const loopRef = useRef(loopIds)
  loopRef.current = loopIds
  /* **通しで鳴らしているか。** 押した瞬間に立てる(2026-09)。
     `speakingId` は最初の合図が来るまで空なので、それだけで見ていると
     押しても Stop に変わらない時間ができる(`LessonView` と同じ作法) */
  const [playingAll, setPlayingAll] = useState(false)
  /* **音が出るまでのあいだ**(2026-09 利用者の指摘「1度目に押すと反応しない」)。
     MP3 をこれから作るときは数秒かかる。`SpeakButton` と同じ見せ方にする */
  const [allWaiting, setAllWaiting] = useState(false)
  const [allSecs, setAllSecs] = useState(0)
  const allTicker = useRef(null)
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
  // ② の単位(段落 / 全体)と ① の難易度(1〜3文ずつ)。どちらも覚える
  const [slashUnit, setSlashUnit] = useState(loadSlashUnit)
  const [dictSize, setDictSize] = useState(loadDictSize)
  // ③⑤ の見せ方(素の文章 / 区切りを出す)と、段落で区切らない通し表示
  const [view, setView] = useState('plain')
  const [flow, setFlow] = useState(false)
  // 通し表示になるのは、本文を見せるステップ(③)のときだけ。
  // ⑤ は本文を隠すので、続けて並べても意味がない
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

  const current = stepOf(step)
  // ①④⑥ は1文ずつ。段落・発言をさらにほどく
  const sentences = useMemo(() => sentencesOf(section.items), [section.items])
  // ② は**段落ごと、または本文まるごと。**
  // 1文ずつでは細かすぎる(2026-08 の指摘)
  const slashBlocks = useMemo(() => blocksOf(section.items, slashUnit), [section.items, slashUnit])
  /* ① は**短すぎる文を次とまとめて**から出す(`StepDictation` と同じ数え方)。
     集中モードで「何個あるか」を数えるのに要るので、ここでも作る。
     **数え方を2通り持たない** — 同じ `groupSentences()` を通す */
  const dictGroups = useMemo(() => groupSentences(sentences, dictSize), [sentences, dictSize])
  // 通し表示にするか。**本文を見せるステップのときだけ**
  const flowing = flow && current.script && current.unit === 'passage'
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
  /* 取り組み方を変えたら、集中モードは**先頭へ戻す。**
     数え方も個数も変わるので、前の番号をそのまま使うと別の場所に飛ぶ。
     ②の単位(段落 / 文章全体)と①の難易度でも数が変わる */
  useEffect(() => { setFocusAt(0) }, [step, slashUnit, dictSize])


  /** 読み上げを止める。通しでも1発言でも、同じところで止める */
  const stopPlaying = () => {
    stopAllRef.current?.()
    stopAllRef.current = null
    stopReading()
    setSpeakingId(null)
    speakingRef.current = null
    setPlayingAll(false)
    window.clearInterval(allTicker.current)
    allTicker.current = null
    setAllWaiting(false)
    setReadingAt(null)
  }

  /**
   * 1段落を1回鳴らす。**押し分けはしない**(下の `playOne` が受け持つ)。
   * くり返す指定なら、鳴り終わったところで自分をもう一度呼ぶ。
   */
  const speakOnce = (item) => {
    const from = Date.now()
    // 読み終わったら Listen に戻す。**MP3 なら本当の読み終わりで戻る。**
    // 端末の声のときは、合図が来ない端末のための保険が speakOnce にある
    readAloud(item.audio_text || item.prompt_en, {
      voice: voiceFor(cast, item.speaker, voice),
      clipVoice: voiceFor(clipCast, item.speaker, soloVoice),
      clipTier: tier,
      rate: rateOf(rateId, current.rate),
      onWord: (w) => setReadingAt(w ? w.charIndex : null),
    }).then(() => {
      /* **くり返す指定なら、もう一度鳴らす**(2026-09 利用者の指定)。
         止まる条件は `SpeakButton` と同じ考え方で3つ。
         ① 押して止めた(`speakingRef` がもうこの段落ではない)
         ② くり返しを切った
         ③ **0.3秒に満たずに終わった** — 鳴っていないのに回り続けるのを防ぐ */
      if (speakingRef.current !== item.id) { setReadingAt(null); return }
      const quick = Date.now() - from < 300
      if (!quick && loopRef.current.has(item.id)) { speakOnce(item); return }
      speakingRef.current = null
      setSpeakingId((id) => (id === item.id ? null : id))
      setReadingAt(null)
    })
  }

  const playOne = (item) => {
    // 鳴っているものをもう一度押したら、止める(Listen ⇄ Stop)
    if (speakingRef.current === item.id) { stopPlaying(); return }
    stopPlaying()
    setSpeakingId(item.id)
    speakingRef.current = item.id
    speakOnce(item)
  }

  /**
   * 通して読み上げる。
   * **1本にまとめて読ませない。** 話す人ごとに声を変えるため、
   * 1発言ずつ順に読ませる(readAloudSequence)。
   */
  //
  // **押したところから始められる**(2026-08 の要望)。
  // 通しで聴いていて「ここをもう一度」と思ったとき、頭から聴き直さなくてよい。
  const playAll = (fromId = null) => {
    stopPlaying()
    setPlayingAll(true)
    // **音が出るまでは「用意しています…」**(2026-09 利用者の指摘)。
    // MP3 がまだ無いと数秒間まったく音がせず、押しても反応が無いように見える。
    // 文言は `SpeakButton` と共通のものを使う(2か所に書き分けない)
    setAllWaiting(true)
    setAllSecs(0)
    const from = Date.now()
    window.clearInterval(allTicker.current)
    allTicker.current = window.setInterval(() => {
      setAllSecs(Math.round((Date.now() - from) / 1000))
    }, 500)
    const heard = () => {
      window.clearInterval(allTicker.current)
      allTicker.current = null
      setAllWaiting(false)
    }
    // 先に「読めるもの」だけに絞ってから並べる。絞ったあとで番号を数えないと、
    // 「いま読んでいる発言」の印が1つずれる
    const all = section.items.filter((it) => String(it.prompt_en ?? '').trim())
    const at = fromId ? all.findIndex((it) => it.id === fromId) : 0
    const playable = at > 0 ? all.slice(at) : all
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
          if (i === null) { stopAllRef.current = null; setPlayingAll(false); heard() }
          const id = i === null ? null : playable[i]?.id ?? null
          setSpeakingId(id)
          /* **控えの側も一緒に動かす**(2026-09 利用者の指定)。
             > 全体を再生を押した後は、再生中の段落の listen ボタンは
             > Stop ボタンになっているべきです

             その段落のボタンは `speakingId` を見て Stop になるが、
             **押したときに止まるかどうかは `speakingRef` が決めている。**
             ここを動かさないでいると、Stop と書いてあるボタンを押しても
             止まらず、**通しの上にもう1本重ねて鳴らして**いた */
          speakingRef.current = id
          setReadingAt(null)   // 次の発言に移ったら、前の語の色を消す
        },
        onStart: heard,
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

  /**
   * 集中モードで出す「1つ」の並び。**取り組み方ごとに単位が違う。**
   *
   *   ① ディクテーション … 文(短いものは次とまとめてある)
   *   ② スラッシュリーディング … 段落 / 発言、または文章まるごと
   *   ③⑤ 本文まるごと … 段落 / 発言
   *   ④⑥ 1文ずつ … 文
   *
   * **数え方を2通り持たない。** どれも、ふだんの画面が並べているものと
   * まったく同じ並びから1つを取り出しているだけである。
   */
  const focusUnits = step === 'dictation' ? dictGroups
    : step === 'slash' ? slashBlocks
      : current.unit === 'passage' ? section.items
        : sentences
  const focusTotal = focusUnits.length
  /* **範囲の外に出さない。** 取り組み方や難易度を変えると数が変わる
     (やりかけの控えと同じ注意・CLAUDE.md) */
  const at = Math.min(Math.max(0, focusAt), Math.max(0, focusTotal - 1))
  const partWord = isDialogue ? '発言' : '段落'
  const focusUnitLabel = step === 'slash'
    ? (slashUnit === 'all' ? '文章' : partWord)
    : current.unit === 'passage' ? partWord : '文'

  /* ① は「まとめたかたまり」で数えているので、そのかたまりに入っている
     文だけを渡す(`StepDictation` が同じ決まりでまとめ直す)。
     **かたまりそのものを渡さない。** あちらは文の一覧を受け取る作りである */
  const dictSlice = () => {
    let off = 0
    for (let k = 0; k < at; k += 1) off += dictGroups[k]?.count ?? 1
    return sentences.slice(off, off + (dictGroups[at]?.count ?? 1))
  }

  const body = (
    <div className={`passage${focus ? ' passage--focus' : ''}`}>
      {!focus && headline && <h4 className="passage-headline" lang="en">{headline}</h4>}

      {/* **集中モード**(2026-09 利用者の指定。名前も利用者が選んだ)。
          ここに置けば、トレーナーの「セッションで使う」とゲストの
          「今週の宿題」の**両方に入る**(どちらもこの部品を呼んでいる)。
          **同じものを2か所に書き写さない。**

          **開くのは「いまの取り組み方」の集中モード**(2026-09 利用者の指定)。

            > 6steps全てに集中モードを作ってください。今は形式的にはボタンが
            > あっても、押すとトップの単語チェックのページの集中モードに
            > 飛ばされてしまいます。

          以前はここから `FocusReader`(**本文を読んで語を調べる**画面)を
          開いていた。書き取りの途中でも、区切りを入れる途中でも、
          **同じ「語を調べる画面」に飛ばされていた。**

          **単位(段落 / 発言 / 文)を名前に入れない。** 名前は1つにしておき、
          いま何番目かは中の「3 / 14 文」が言う */}
      {!focus && showFocus && focusTotal > 0 && (
        <button type="button" className="btn btn--small btn--ghost passage-focus"
                onClick={() => { stopPlaying(); setFocus(true) }}>
          集中モード
        </button>
      )}

      {/* 6Steps。**プルダウンにする**(2026-08 利用者の指定)。
          札を6つ横に並べていたが、狭い画面では2段になり、
          紙(レッスン表示)で文字を大きくすると帯だけで場所を食っていた。
          **番号を出す。** 順にやるものなので、いま何番目かが
          分かることそのものが道しるべになる。 */}
      {/* 集中モードでは、上の帯にある(`StepFocus`)。**2つ見せない** */}
      {!focus && (
        <label className="step-pick">
          <span className="step-pick-label">6Steps</span>
          <select value={step} aria-label="6Steps の切り替え"
                  onChange={(e) => { stopPlaying(); setStep(e.target.value) }}>
            {SIX_STEPS.map((m) => (
              <option key={m.id} value={m.id}>{m.no} {m.label}</option>
            ))}
          </select>
        </label>
      )}
      {/* やり方。**1行に1つ。** 1つの段落に流すと、改行も区切りも無い棒になって
          読めない(指導ポイントで一度学んだこと)。
          狭い画面では畳めるようにする。何度も読むものではない */}
      {/* **指導ポイントと同じ形にそろえた**(2026-08 利用者の指定)。
          畳んだときは1行の見出し、開くと中身の枠になる。
          色だけは 6Steps の緑(`--accent`)のままにしてある。

          ちがうのは**中身が「手順」**だという1点。指導ポイントは
          並びに意味の無い箇条書きなので丸い点だが、こちらは順番に
          意味があるので**番号の丸**にした。ねらいは、見出しの札にして
          いちばん上に置く(何のための練習かが先に目に入る)。 */}
      {/* **集中モードでは出さない。** 何度も読むものではないので、
          1つのことに向き合っている場所を、そのぶん狭めない */}
      {!focus && (
      <details className="step-guide" open={guideOpen}
               onToggle={(e) => { setGuideOpen(e.currentTarget.open); saveGuideOpen(e.currentTarget.open) }}>
        <summary className="step-guide-sum">
          <span className="step-guide-caret" aria-hidden="true" />
          <span className="step-guide-label">やり方</span>
          <span className="step-guide-count">{current.how.length} 手順</span>
        </summary>
        <div className="step-guide-body">
          <p className="step-guide-aimrow">
            <span className="step-guide-tag">ねらい</span>
            <span className="step-guide-aim">{current.aim}</span>
          </p>
          <ol className="step-guide-how">
            {current.how.map((line, i) => (
              <li key={i}>
                {line.split('**').map((t, k) => (k % 2 ? <strong key={k}>{t}</strong> : t))}
              </li>
            ))}
          </ol>
        </div>
      </details>
      )}

      <div className="passage-tools">
        {/* 通しの読み上げは、本文まるごとのステップ(③⑤)でだけ意味がある。
            1文ずつのステップでは、各文の Listen を使う。

            **通しの読み上げは、同じボタンで止める**(2026-09 利用者の指定)。
              > STOPボタンが必要ないです。削除して下さい。
              > すべてのページで同じにしてください。

            鳴っているあいだは Stop になる。**各文の Listen と同じ作法**で、
            止める場所を探さなくてよい(`SpeakButton` も同じ形)。 */}
        {current.unit === 'passage' && (
          <button type="button"
                  className={`btn${playingAll ? ' btn--primary' : ''}`}
                  onClick={() => (playingAll ? stopPlaying() : playAll())}>
            {playingAll
              ? <><StopIcon />{allWaiting ? preparingLabel(allSecs) : 'Stop (全体)'}</>
              : <><SpeakerIcon />Listen (全体)</>}
          </button>
        )}
        {/* **速さは、①ディクテーションでは出さない**(2026-09 利用者の指定)。

              > 再生スピード調整タブも、削除しする代わりに各文につけてください。

            書き取りは**1文ずつ**の練習なので、速さは文ごとに置いてある。
            ③⑤(本文まるごと)は「Listen (全体)」を鳴らすので、ここに要る。

            **Stop はどの取り組み方でも出さない**(2026-09 利用者の指定)。
            鳴らすボタンがそのまま Stop に変わるので、別に置く必要がない。 */}
        {step !== 'dictation' && (
          <label className="rate-pick">
            <span>速さ</span>
            <select value={rateId}
                    onChange={(e) => { setRateId(e.target.value); saveRateId(e.target.value); stopPlaying() }}>
              {SPEECH_RATES.map((r) => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </select>
          </label>
        )}
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
      </div>

      {notice && <div className="notice notice--warn passage-notice">{notice}</div>}

      {/* ── ①②④⑥ は1文ずつ ──────────────────────────── */}
      {step === 'dictation' && (
        <StepDictation
          /* 集中モードでは**1つだけ**渡す。中身の描き方は変えない
             (**同じ見た目を2か所に書き写さない**・CLAUDE.md) */
          sentences={focus ? dictSlice() : sentences} clipVoice={soloVoice} tier={tier}
          /* **もとの速さ(この取り組み方の速さ)をそのまま渡す**(2026-09)。
             倍率は文ごとに掛けるので、ここで掛けてはいけない
             (掛けると二重になる) */
          rate={current.rate} level={level}
          wordStatuses={wordStatuses} onMarkWord={markWord}
          listeningId={listeningId} onCheck={checkOne} results={results}
          size={dictSize}
          onSizeChange={(v) => { setDictSize(v); saveDictSize(v) }}
          /* **書きかけを覚えておく**(2026-08 利用者の指定)。鍵の形は1か所 */
          progressAt={progressKey(materialId, section.id, 'dictation')}
          learnerId={learnerId}
        />
      )}
      {step === 'slash' && (
        <SlashReading
          blocks={focus ? slashBlocks.slice(at, at + 1) : slashBlocks}
          clipVoice={soloVoice} tier={tier}
          rate={rateOf(rateId, current.rate)}
          unit={slashUnit} isDialogue={isDialogue}
          onUnitChange={(v) => { setSlashUnit(v); saveSlashUnit(v) }}
          /* **入れかけの区切りを覚えておく**(2026-08 利用者の指定) */
          progressAt={progressKey(materialId, section.id, `slash-${slashUnit}`)}
          learnerId={learnerId}
        />
      )}
      {(step === 'meaning' || step === 'repeat') && (
        <StepSentence
          sentences={focus ? sentences.slice(at, at + 1) : sentences}
          startVisible={current.script}
          clipVoice={soloVoice} tier={tier}
          rate={rateOf(rateId, current.rate)} level={level}
          wordStatuses={wordStatuses} onMarkWord={markWord}
          listeningId={listeningId} onCheck={checkOne} results={results}
          /* ④⑥ で開いた行も覚えておく(2026-08 利用者の指定) */
          progressAt={progressKey(materialId, section.id, `sentence-${step}`)}
          learnerId={learnerId}
        />
      )}

      {/* ── ③⑤ は本文まるごと ───────────────────────────
          ⑤ シャドーイングは**本文を見ないで**行う(利用者の指定)。
          隠すのは英語だけで、Listen も話して確かめるもそのまま使える */}
      {/* ③⑤ の見せ方を選ぶ(2026-08 の要望)。
          **同じ本文を、どう見ながら重ねて読むか**が変わるだけである */}
      {current.unit === 'passage' && current.script && (
        <div className="passage-views" role="group" aria-label="本文の見せ方"
             data-focus={focus ? 'on' : undefined}>
          {PASSAGE_VIEWS.map((v) => (
            <button key={v.id} type="button" title={v.hint}
                    className={`chip${view === v.id ? ' chip--on' : ''}`}
                    onClick={() => setView(v.id)}>
              {v.label}
            </button>
          ))}
          {/* **集中モードでは出さない。** 1つしか出していないので、
              「段落で区切らない」は効きようがない(効かない操作を見せない) */}
          {!focus && (
            <label className="passage-flow">
              <input type="checkbox" checked={flow}
                     onChange={(e) => setFlow(e.target.checked)} />
              {/* 通しで聴くときは、段落で切れていないほうが追いやすい */}
              段落で区切らない
            </label>
          )}
          {/* **区切りの細かさは、ここでしか効かなくなった。**
              ② スラッシュリーディングは自分で区切る画面になり、
              決まりから作った区切り(模範)を出さなくなったためである
              (2026-08 利用者の判断)。**効かない場所に操作を置かない** */}
          {view !== 'plain' && (
            <label className="rate-pick">
              <span>区切りの細かさ</span>
              <select value={slashLevel}
                      onChange={(e) => { setSlashLevel(e.target.value); saveSlashLevel(e.target.value) }}>
                {SLASH_LEVELS.map((l) => (
                  <option key={l.id} value={l.id} title={l.hint}>{l.label}</option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}

      {current.unit === 'passage' && (
      <ol className={`passage-body${current.script || peek ? '' : ' is-hidden-text'}`
                     + (flowing ? ' is-flow' : '')}>
        {(focus ? section.items.slice(at, at + 1) : section.items).map((item) => {
          const result = results[item.id]
          return (
            <li key={item.id} data-part={item.id}
                className={`passage-part${speakingId === item.id ? ' is-speaking' : ''}`}
                {...(flowing ? {
                  role: 'button',
                  tabIndex: 0,
                  title: 'ここから通して聴く',
                  onClick: () => playAll(item.id),
                  onKeyDown: (e) => {
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); playAll(item.id) }
                  },
                } : {})}>
              {isDialogue && item.speaker && (
                <div className="passage-speaker" lang="en">{item.speaker}</div>
              )}
              {current.script || peek ? (
                <p className="passage-en">
                  {/* 通し表示では**語の意味を引かない。**
                      押したところから読み上げを始めるので、語ごとの
                      吹き出しと操作がぶつかる。読むことだけに集中させる */}
                  {view === 'chunk' && !flowing ? (
                    /* **カタマリの真上に、そのカタマリの訳**(0021)。
                       控えが無い教材では英語だけになる */
                    <ChunkedText text={item.prompt_en} ja={storedChunks(item)}
                                 parts={storedParts(item)} level={slashLevel} />
                  ) : view === 'slash' || flowing ? (
                    /* 区切りを見ながら重ねて読む。区切りは②と同じ決まりで出す */
                    <SlashedText text={item.prompt_en}
                                 level={view === 'plain' ? null : slashLevel} />
                  ) : (
                    <EnglishText text={item.prompt_en} textJa={item.prompt_ja} level={level}
                                 statuses={wordStatuses} onMark={markWord}
                                 readingAt={speakingId === item.id ? readingAt : null} />
                  )}
                </p>
              ) : (
                /* 隠していても**場所は残す。** 消すと、いくつ段落があるのか
                   分からなくなり、いま何番目を追っているのかも見失う */
                <p className="passage-en passage-en--hidden" aria-hidden="true">　</p>
              )}
              {/* **要点の札は出さない。** ③⑤ は声に出す練習なので、
                  読むものが増えると気が散る(2026-08 の指摘) */}
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
                {/* **Listen のとなりに、くり返し**(2026-09 利用者の指定) */}
                <RepeatToggle on={loopIds.has(item.id)}
                              onChange={() => setLoopIds((v) => {
                                const next = new Set(v)
                                if (next.has(item.id)) next.delete(item.id)
                                else next.add(item.id)
                                return next
                              })} />
                {/* **ここから通して聴く**(2026-08 の要望)。
                    途中で聴き直したいとき、頭から掛け直さなくてよい */}
                <button type="button" className="btn btn--small"
                        onClick={() => playAll(item.id)}>
                  <SpeakerIcon />ここから
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

      {/* 音声認識の断り書きは、**話す仕組みがあるステップにだけ**出す。
          ② スラッシュリーディングには話すボタンが無いので、
          「発音の点数ではありません」は関係がない(2026-08 の指摘) */}
      {focus ? null : step === 'slash' ? null : isRecognitionSupported() ? (
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

  /* **集中モードは、同じ中身をそのまま画面いっぱいに出すだけ。**
     中身を別に作らない(作ると、片方だけ直り忘れる) */
  if (focus) {
    return (
      <StepFocus step={step} onStepChange={(v) => { stopPlaying(); setStep(v) }}
                 at={at} total={focusTotal} unit={focusUnitLabel} width={focusWidth}
                 onMove={(n) => { stopPlaying(); setFocusAt(Math.min(Math.max(0, n), focusTotal - 1)) }}
                 onClose={() => { stopPlaying(); setFocus(false) }}>
        {body}
      </StepFocus>
    )
  }
  return body
}
