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
/* **1文ずつのボタンの文字は `speakLabel.js` 1か所**(第5.297節)。
   ここに書き写すと、片方だけ古くなる */
import { SPEAK_LISTEN, SPEAK_STOP } from '../lib/speakLabel.js'
import SteadyLabel from './SteadyLabel.jsx'
import { loadEnglishVoices } from '../lib/speech.js'
import { canReadAloud, readAloud, stopReading } from '../lib/readAloud.js'
import { STANDARD } from '../lib/voiceTier.js'
import { SpeakerIcon, StopIcon } from './Icons.jsx'
/* **色は1か所で決める**(第5.242節・2026-09-23 利用者の指摘
   「ボタンが全て白なのも分かりにくい要因の一つです」)。
   Listen は**行ごとに1つずつ並ぶ**ものなので灰。
   鳴っているあいだだけ青にする —— 同時に鳴るのは1本だけなので、
   「青は1つの画面に1つだけ」も守れる */
import { toneOn } from '../lib/btnTone.js'
import { loadRateId, rateOf } from '../lib/speechRate.js'
/* ★ **止めた場所から鳴らすのは、本文の段落だけ**(第5.335節)。
   **判断は `isPassageSection()` 1か所** —— ここで `typeId === 'article'` と
   書かない(CLAUDE.md)。第5.333節で**文の数**で当てようとしたが、
   あれは当て推量で、**2文の問では効かなかった**(実測) */
import { isPassageSection } from '../data/exerciseTypes.js'

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
  text, label = SPEAK_LISTEN, rate = null, className = '', voice: given = null,
  clipVoice = null, tier = STANDARD, onPlayingChange = null, onWord = null,
  /**
   * ★ **絵を出すか**(第5.440節・2026-10-10 利用者の指定)。
   *
   *   > あとは聴くの横のスピーカーのアイコンをなくしましょう。
   *   > 他と統一のデザインにします
   *
   * **練習の升目**では、となりの3つが「字だけ(10 問)」か
   * 「絵だけ(シャッフル・リピート)」のどちらかである。
   * 「聴く」だけが**絵と字の両方**を持っていて、そこだけ賑やかだった。
   *
   * **既定は出す側のまま。** ほかの画面の Listen は1つも変わらない
   * (**言われた場所だけを直す**・CLAUDE.md)。
   *
   * ★ **翌日、升目は「絵だけ」の側に決まった**(第5.441節・
   * 2026-10-10 利用者の指定「囲みなしのアイコンのみに」)。
   * **決まりは同じ**(升目は字だけか絵だけのどちらか)で、
   * **えらんだ側が逆になった** —— いまは2か所とも `label={null}` を
   * 渡して**字**を消しており、このスイッチは既定のままである。
   * **消していないのは、同じ決まりの逆向きが要る日のため**ではなく、
   * `label` と `icon` で**どちらを消すかを選べる**形そのものが
   * この決まりの中身だからである。
   */
  icon = true,
  /**
   * **くり返し鳴らすか**(2026-09 利用者の指定・ディクテーション)。
   * 止めるまで、少し間を置いて何度でも読み直す。
   * 書き取りは1回では聞き取れないので、押し直す手間をなくす。
   */
  repeat = false,
  /**
   * **1本にまとめた音声の、どこを鳴らすか**(2026-09 利用者の指定で統一)。
   * `wholeSliceOf()` が作ったものをそのまま渡す。渡さなければ、
   * これまでどおりその英文だけの MP3 を作って鳴らす
   * (単語帳・ディクテーションなど、本文の段落ではない Listen)。
   */
  whole = null,
  /**
   * ★ **演習の種類**(第5.335節・2026-10-01 実機・利用者の指摘)。
   *
   *   > 問題ごとに音声を聴くと文の途中から再生されて使い物になりません
   *
   * **これで「止めた場所から鳴らす」かどうかが決まる。**
   * 本文(記事・会話・会議)の段落だけが真で、問・解答・語は偽である。
   *
   * **渡さなければ、いつも頭から**(既定は「しない」側・CLAUDE.md)。
   * 渡し忘れても出るのは「頭から鳴る」だけで、**報告された壊れ方には
   * ならない。** 判断は `isPassageSection()` 1か所である。
   */
  typeId = null,
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

  /* ★ **経過秒数は、もう数えていない**(第5.418節・2026-10-08)。
       「用意中 N 秒」を出すためだけの札だったが、**文言ごと外した**
       (横に伸びるため)。数える仕組みも一緒に落とす ——
       **使われない仕組みを残すと、まだ何かを守っていると誤読される** */

  /** 止める。**くり返しの予約も消す** */
  const stop = () => {
    playingRef.current = false
    window.clearTimeout(timer.current)
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
    const heard = () => setWaiting(false)

    readAloud(text, {
      voice, clipVoice, clipTier: tier, rate: speed, onWord, onStart: heard, whole,
      /* **止めた場所から鳴らす**(2026-09 利用者の指定)。
         > これは段落ごとの再生ボタンでも同じ仕様にしてください。

         目印は**英文と声**そのものにしてある。この部品はアプリ中の
         Listen をすべて受け持っているので、ここに1つ書けば
         **紙・宿題・単語帳・ディクテーション、どこでも同じように効く。**
         呼ぶ側に鍵を配らせると、必ずどこかが渡し忘れる(CLAUDE.md)。

         ★ **控えるのは、本文の段落だけ**(第5.335節・2026-10-01 実機)。

              > 問題ごとに音声を聴くと文の途中から再生されて
              > 使い物になりません

            鳴らしかけて止める(別の問を押す・待ちきれずにもう一度押す)と
            **その場所が控えに残り、次に押すと途中から鳴る。**

            **第5.333節では「文が2つ以上なら控える」と当てた。外していた。**
            本物の音を鳴らして測ったら、

              | 問の英文 | もう一度押したとき |
              |---|---|
              | 1文 | 0.01 秒(頭から) |
              | **2文** | **0.73 秒(途中から)** |

            **長さは、控えるかどうかの手がかりではない。**
            利用者が頼んだのは **本文の段落ごとの再生**(第5.306節)で、
            問の読み上げではない。だから**演習の種類で決める** ——
            `isPassageSection()` が真なのは記事・会話・会議だけである。

            **渡っていなければ、いつも頭から**(既定は「しない」側)。 */
      ...(isPassageSection(typeId)
        ? { resumeKey: `one|${clipVoice ?? ''}|${text}` }
        : {}),
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

  /* ★ **押しても、横に伸びない**(第5.418節・2026-10-08 利用者の指定)。

       > 段落を飛ばす時に、「聴く」ボタンが準備中になって横に伸びるせいで
       > 段落の縦の長さが伸びてしまいます。横に伸びないようにしてください。
       > すべての教材、すべてのページでこの仕様に揃えてください

     **「用意しています…」は、もう出さない。** あれは 30px の「聴く」を
     141px にする(実測・第5.311節の表)ので、**どう取っておいても
     ボタンが4倍以上に太る。** 操作盤(`PlayerBar`)では
     **2026-09 に同じ理由で外してある** —— 画面ぜんぶを、そこに揃える。

     **起きていることは、絵で伝える** —— スピーカーが Stop に変わり、
     音が出るまでは**その絵がゆっくり明滅する**(`is-waiting`)。
     明滅は `opacity` だけなので、**場所も大きさも1px も動かない**
     (共通ルール「押しても、まわりの物が動かない」)。

     幅は `SteadyLabel` が**起こりうる言葉のいちばん広いぶん**で取る ——
     数を書かないので、言葉を変えた日もついてくる。 */
  return (
    <button type="button"
            className={`btn btn--small no-print ${toneOn(playing, className)} ${className}`
              + (waiting ? ' is-waiting' : '')}
            /* **字があるときは付けない。** 見えている字と二重に名前を
               持つと、読み上げがどちらを読むか端末まかせになる */
            aria-label={label ? undefined : (playing ? SPEAK_STOP : SPEAK_LISTEN)}
            title={label ? undefined : (playing ? SPEAK_STOP : SPEAK_LISTEN)}
            onClick={play}>
      {icon && (playing ? <StopIcon /> : <SpeakerIcon />)}
      {/* ★ **`label={null}` なら、字を1つも出さない**(第5.441節・
            2026-10-10 利用者の指定)。練習の操作の行は**絵だけ4つ**に
            そろえたので、ここに字が入ると1つだけ背が違って見える。

            **場所を取っておくのもやめる** —— `SteadyLabel` は
            「起こりうるいちばん広い字」のぶんを先に取るので、
            残しておくと**絵の右に「Stop」ぶんの空白**が居座り、
            升目の中で絵が左へずれる(「押しても、まわりの物が動かない」の
            ために取っておくものなので、**字が無いときは要らない**)。

            **名前は `aria-label` で届ける** —— 字が無いボタンは、
            読み上げでは「ボタン」としか言われない。
            **言葉は `speakLabel.js` 1か所**から引く(書き写さない) */}
      {label
        ? <SteadyLabel keep={[label, SPEAK_STOP]}>{playing ? SPEAK_STOP : label}</SteadyLabel>
        : null}
    </button>
  )
}

/**
 * 用意しているあいだの文言。**2秒を過ぎたら経過秒数も出す。**
 * すぐ鳴る場合(控えが効いているとき)に数字が一瞬ちらつかないよう、
 * はじめの2秒は出さない。**ここだけに置く**(2か所に書き分けない)。
 */
export const preparingLabel = (secs) => (secs >= 2 ? `用意中 ${secs} 秒` : '用意しています…')
