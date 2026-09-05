/**
 * レッスンで使う表示(画面共有用)。
 *
 * 【なぜ必要か】
 *   レッスン中に画面を共有して、弱点の問題を一緒に解く。そのとき
 *   ふだんの画面はボタンやタブが多く、**共有される側には読みにくい。**
 *   利用者から「アプリ上でも PDF に近い表示にできないか」と要望があった
 *   (2026-08)。紙に刷ったときと同じ見え方を、画面の上で出す。
 *
 * 【決めたこと】
 *   ・**紙は白のまま。** 暗い配色を選んでいても、ここだけは白い紙にする。
 *     画面共有では白いほうが見やすく、「PDF に近い」という要望にも合う
 *   ・演習ごとに1枚。行ったり来たりできる。40問を延々と流さない
 *   ・**解答の出し方を切り替えられる。** レッスンでは伏せておいて、
 *     答え合わせのときに出す。トレーナーが手元で決める
 *   ・文字の大きさを3段階で変えられる。共有先の画面の大きさが分からないため
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  countLabel, countUnit, exerciseLabel, exerciseType, isPassageSection,
} from '../data/exerciseTypes.js'
import { weaknessTagLabel } from '../data/weaknessTags.js'
import { printElement } from '../lib/print.js'
import { loadEnglishVoices } from '../lib/speech.js'
import { stopReading } from '../lib/readAloud.js'
import { voiceTierFor } from '../lib/voiceTier.js'
import { castClipSpeakers, castVoices, voiceFor } from '../lib/voiceCast.js'
import { wholeSliceOf } from '../lib/audioPlaylist.js'
import { resolveVoices } from '../data/clipVoices.js'
import { SPEECH_RATES, loadRateId, rateOf, saveRateId } from '../lib/speechRate.js'
import {
  BoltIcon, FocusIcon, GearIcon, NoteIcon, PenIcon, PrintIcon,
  SpeakerIcon, StepsIcon, StopIcon,
} from './Icons.jsx'
import FocusReader from './FocusReader.jsx'
import InkLayer from './InkLayer.jsx'
import LessonNotes from './LessonNotes.jsx'
import { loadMyLearners } from '../lib/materials.js'
/* 書き込みの色・道具・太さは `src/data/inkTools.js` 1か所。
   **集中モードでも同じものを出す**ので、ここには持たない */
import { INK_COLORS, INK_TOOLS, INK_WIDTH } from '../data/inkTools.js'
import { viewerRoleOf } from '../lib/viewer.js'
import { useWide } from '../lib/nav.js'
import EnglishText from './EnglishText.jsx'
import { prefetchGlosses } from '../lib/vocab.js'
import { markIn } from '../lib/useWordStatuses.js'
import MaterialTitle from './MaterialTitle.jsx'
import CastChip from './CastChip.jsx'
import QuickResponse from './QuickResponse.jsx'
import QuickResponseSheet from './QuickResponseSheet.jsx'
import PassagePractice from './PassagePractice.jsx'
import { hasQuickResponse } from '../lib/quickResponse.js'
import SpeakButton, { preparingLabel } from './SpeakButton.jsx'
import SentenceSkip from './SentenceSkip.jsx'
import AnswerEn from './AnswerEn.jsx'
import PhraseChips from './PhraseChips.jsx'
import Phonetic from './Phonetic.jsx'
import Stepper from './Stepper.jsx'
import PlayerBar from './PlayerBar.jsx'
import useBodyAudio from '../lib/useBodyAudio.js'

/** 本文のときだけ ◀ ▶ で挟む。**呼ぶ側に条件を書き散らさない** */
const withSkip = (on, node) => (on ? <SentenceSkip>{node}</SentenceSkip> : node)

const SIZES = [
  { id: 'm', label: '標準' },
  { id: 'l', label: '大' },
  { id: 'xl', label: '特大' },
]

/**
 * **紙の幅**(2026-09 利用者の指定)。
 *
 *   > PCで表示する際に、紙の幅を変えれるようにしてください。
 *   > 110% / 120% / 130% 三段階で。何故かというと、ctrl＋上下だと
 *   > ツールバーまで拡大して2列になってしまうからです。
 *
 * ブラウザの拡大(Ctrl と +)は**画面ぜんぶ**を大きくするので、
 * 上の操作欄まで太って2段になり、紙がそのぶん狭くなる。
 * ここで変えるのは**紙の幅だけ**なので、操作欄は1段のままである。
 *
 * **狭い画面では出さない。** あちらは紙が画面いっぱいで、
 * 広げる余地がそもそも無い(効かない操作を見せない・CLAUDE.md)。
 *
 * **100% から 150% まで 10% 刻み、その上が「画面いっぱい」**
 * (2026-09 利用者の指定)。
 *
 *   > 画面幅も100％から10%刻みで150%まで、そしてその上の最大値は
 *   > そのデバイスの画面幅に合わせる設定にしてください
 *
 * 「画面に合わせる」は**割合ではない。** 使える幅をそのまま使う
 * (紙の左右の余白 24px だけを残す)。%で足していくと、
 * どの端末でも「ちょうどいっぱい」にはならない。
 */
const WIDTHS = [
  { id: 'w100', label: '100%' },
  { id: 'w110', label: '110%' },
  { id: 'w120', label: '120%' },
  { id: 'w130', label: '130%' },
  { id: 'w140', label: '140%' },
  { id: 'w150', label: '150%' },
  { id: 'wfit', label: '画面いっぱい' },
]
/**
 * **メモの幅**(2026-09 利用者の指定)。
 *
 *   > メモを開いたときには、サイドバーの幅を変えれるようにしてください。
 *
 * 紙とメモの境目をつまんで動かす。**覚える**(一度決めれば毎回は触らない)。
 * 幅は px で持つ。割合にすると、画面の広さが変わったときに
 * 紙のほうが読めない幅まで細る。
 */
const NOTES_KEY = 'eas.lessonNotesW'
const NOTES_MIN = 240
const NOTES_MAX = 720
const loadNotesW = () => {
  try {
    const n = Number(window.localStorage.getItem(NOTES_KEY))
    return Number.isFinite(n) && n >= NOTES_MIN ? Math.min(n, NOTES_MAX) : 330
  } catch { return 330 }
}
const saveNotesW = (n) => {
  try { window.localStorage.setItem(NOTES_KEY, String(n)) } catch { /* 使えなくても困らない */ }
}

const WIDTH_KEY = 'eas.lessonWidth'
const loadWidth = () => {
  try {
    const id = window.localStorage.getItem(WIDTH_KEY)
    return WIDTHS.some((w) => w.id === id) ? id : 'w100'
  } catch { return 'w100' }
}
const saveWidth = (id) => {
  try { window.localStorage.setItem(WIDTH_KEY, id) } catch { /* 使えなくても困らない */ }
}

/**
 * 読み上げの操作盤を、どこに出すか(2026-09 利用者の指定)。
 *
 *   > 音声プレーヤーのUIを入れるのも良いですね。
 *   > (上部バーもしくはフロート(切り替えられると最高))
 *
 * **既定は上の帯(`bar`)。** 2026-09 の指定で右下から改めた。
 *
 *   > スマホ、パッド上のフロート再生UIはディフォルトでは
 *   > 上部バーに配置してください。幅が入らない場合はフロートUIを
 *   > 起動するスイッチのみを配置してください。
 *   > これはデバイスの画面幅により最適化される仕様にしてください
 *
 * **一度決めれば毎回選ぶものではない**ので、覚える(文字の大きさと同じ)。
 * ただし**幅が足りないときは、覚えている値によらず上の帯**にする
 * (下の `spot`)。狭い画面には切り替えのボタンを出していないので、
 * 右下のまま覚えていると**戻す道が無くなる。**
 */
const PLAYER_KEY = 'eas.playerPlace'
const loadPlace = () => {
  try {
    const v = window.localStorage.getItem(PLAYER_KEY)
    return v === 'float' ? 'float' : 'bar'
  } catch { return 'bar' }
}
const savePlace = (v) => {
  try { window.localStorage.setItem(PLAYER_KEY, v) } catch { /* 使えなくても困らない */ }
}

/**
 * 文字の大きさを覚えておく。
 * **一度決めれば、毎回選ぶものではない。** 覚えないから、開くたびに
 * 上の操作欄を触ることになり、それが場所を取る原因にもなっていた。
 */
const SIZE_KEY = 'eas.lessonSize'
const loadSize = () => {
  try {
    const id = window.localStorage.getItem(SIZE_KEY)
    return SIZES.some((s) => s.id === id) ? id : 'l'
  } catch { return 'l' }
}
const saveSize = (id) => {
  try { window.localStorage.setItem(SIZE_KEY, id) } catch { /* 使えなくても困らない */ }
}

export default function LessonView({
  material, onClose,
  // ゲストが開いたときは「知っていた / 知らなかった」も付けられる。
  // トレーナーが開いたときは意味を見るだけ(申告はゲスト本人のもの)
  wordStatuses = null, onMarkWord = null,
  /** 誰の学習として残すか(0025)。レッスン中のゲスト / 自分 */
  learnerId = null,
}) {
  /* **どの教材で会ったかを添える**(0024)。単語帳を教材名で絞るのに要る。
     語に触れる場所は多いので、**教材が分かるここで1回だけかぶせる** */
  const markWord = markIn(onMarkWord, material?.id, learnerId)
  const sections = material?.sections ?? []
  const [page, setPage] = useState(0)
  // 解答の出し方は2通り。**両方要る。**
  //   ・右上のボタン … 全部まとめて出す / 隠す(答え合わせのとき)
  //   ・問ごとのボタン … 1問ずつ出す / 隠す(一緒に進めるとき)
  //
  // 問ごとの状態は、右上の設定に対する「例外」として持つ。
  /* **解答は1問ずつ開く**(2026-09 利用者の指定で「すべての解答を出す」を
     帯から外した)。まとめて出す道が無くなったので、控えも1つでよい。
     `closedItems` と `showAnswers` は、そのとき一緒に落としてある。 */
  // こうすると、**どちらの状態からでも1問ずつ開け閉めできる。**
  // 一度見た解答をまた隠して解き直す、という使い方のため(2026-08 の要望)。
  const [openItems, setOpenItems] = useState(() => new Set())
  const [size, setSize] = useState(loadSize)
  // 紙の幅。**一度決めれば毎回選ぶものではない**ので覚える(文字の大きさと同じ)
  const [width, setWidth] = useState(loadWidth)
  // メモの幅。境目をつまんで変える(2026-09 利用者の指定)
  const [notesW, setNotesW] = useState(loadNotesW)
  // 画面の狭い端末では、めったに触らない設定をしまっておく。
  // **一度決めれば何度も要らないもの**(速さ・配色・文字の大きさ・印刷)。
  // パソコンでは常に出したままにする(CSS が決める。第5.22節)
  const [openSettings, setOpenSettings] = useState(false)
  // Esc の扱いで今の状態を見たい。`useEffect` の中から読めるように控える
  const openSettingsRef = useRef(false)
  /**
   * **紙への書き込み**(2026-09 利用者の指定)。
   *
   * 会議アプリのペンは画面のガラス面に描くので、送ると置いていかれる。
   * こちらは**紙の中に描く**ので、線は英文にくっついて動く。
   *
   * **ページごとに持つ。** 別のページの線が重なって出ると訳が分からない。
   * **保存はしない。** 閉じれば消える板書である
   * (残したいことは「メモ」に書く)。
   */
  const [pen, setPen] = useState(false)
  const [inkColor, setInkColor] = useState(INK_COLORS[0].color)
  // いま持っている道具(ペン / ハイライト / 消しゴム)
  const [inkTool, setInkTool] = useState('pen')
  const [ink, setInk] = useState({})     // ページ番号 → 線の配列
  const sheetRef = useRef(null)
  /**
   * **セッションの記録**(0032・2026-09 利用者の指定)。
   *
   *   > トレーニング中、または個々のゲストの情報内でセッションに関する
   *   > 記録やメモをするためのフリーボード(中略)を呼び出せると嬉しい
   *
   * 気づいたことは**その場で書けないと残らない。** レッスンが終わって
   * ゲストのカードまで戻るころには、半分忘れている。
   * 書き込み(ペン)が閉じれば消える板書であるのに対し、
   * こちらは**日付ごとに残る記録**である。
   */
  const [notes, setNotes] = useState(false)
  const notesRef = useRef(false)
  notesRef.current = notes
  /* **相手がいるときだけ出す。** トレーナーの「教材」画面から開いたときは
     `learnerId` が無い(誰のセッションでもない)。役割の判定は
     `viewer.js` の1か所に置いてある(**ここに作らない**) */
  /* **「教材」の画面からでもメモを出す**(2026-09 実機・利用者の指摘)。
   *
   *   > 教材を開いている時のメモが消えたままです
   *
   * もとは `learnerId` があるとき(ゲストのページから開いたとき)だけ
   * 出していた。**セッションの記録は「ゲスト × 日付」で1枚**なので、
   * 相手が決まらないと書けない、という理由である。
   *
   * **それは書けない理由であって、ボタンを消す理由ではなかった。**
   * 利用者はふだん「教材」の画面から開くので、そこにメモが無いと
   * **一度も出てこない。** 3度言わせてしまった。
   *
   * いまは**ボタンは必ず出し、相手が決まっていなければ中で選ばせる。**
   * 選ぶ相手は「自分の担当ゲスト」だけである(RLS がそれ以外を断る)。 */
  const canNote = viewerRoleOf() === 'trainer' || viewerRoleOf() === 'owner'
  /** メモを書く相手。**渡されていれば、それが答え**(選ばせない) */
  const [notesFor, setNotesFor] = useState(learnerId ?? null)
  /** 選ぶための担当ゲスト。**開いたときに1回だけ読む**(要らなければ読まない) */
  const [notePeople, setNotePeople] = useState(null)
  useEffect(() => { setNotesFor(learnerId ?? null) }, [learnerId])
  useEffect(() => {
    if (!notes || learnerId || notePeople) return undefined
    let alive = true
    loadMyLearners().then(({ data }) => { if (alive) setNotePeople(data ?? []) })
    return () => { alive = false }
  }, [notes, learnerId, notePeople])
  openSettingsRef.current = openSettings
  // 通しの練習を出しているか。
  // null / 'qr'(Quick Response)/ 'six'(6Steps)/ 'focus'(集中モード)。
  // **教材1本 / 本文1本を通しでやる**ので、出しているあいだは
  // ページ送りと解答のボタンを出さない(効かないため)
  const [run, setRun] = useState(null)
  const runRef = useRef(null)
  runRef.current = run
  const qr = run === 'qr'
  // 読み上げの速さ。**画面に1つだけ。** 端末に覚えさせる(2026-08 利用者の指定)
  const [rateId, setRateId] = useState(loadRateId)
  // 読み上げ。**会話は話す人ごとに声を変える**(2026-08 の指摘)。
  // 同じ声だと、どちらが話しているのか耳で分からない。
  const [voices, setVoices] = useState([])
  /**
   * **通しの読み上げは `useBodyAudio` が受け持つ**(2026-09)。
   *
   * 鳴っているか / どこまで来たか / 用意しています… / くり返しの単位は、
   * **紙(ここ)と集中モード(`FocusReader`)でまったく同じもの**である。
   * 書き写すと必ず片方だけ古くなるので、持ちものごと1つにまとめてある
   * (利用者の指定「普通の画面との統一感が欲しいところです」)。
   *
   * **何を鳴らすかは押したときに渡す**(声も速さも段もページで変わる)。
   */
  const player = useBodyAudio({
    onIndex: (i) => {
      setSpeakingKey(i === null ? null : playRef.current[i]?.key ?? null)
      setReadingAt(null)   // 次の文に移ったら、前の色を消す
    },
    onWord: (w) => setReadingAt(w ? w.charIndex : null),
  })
  const playingAll = player.playing
  // いま読み上げている項目。**色で示す。**
  // 通しで聞いているとき、どこを読んでいるのか目で追えないと
  // オーバーラッピングもシャドーイングもできない(2026-08 の要望)。
  const [speakingKey, setSpeakingKey] = useState(null)
  // いま読み上げている語の位置(もとの英文の何文字目か)。
  // **語ごとに色を移していくために要る**(2026-08 利用者の指定)。
  // 合図を出さない端末(iOS の Safari)では null のままで、
  // これまでどおり「文のかたまり」の色分けだけが残る
  const [readingAt, setReadingAt] = useState(null)
  /* **音が出るまでのあいだ**(2026-09 利用者の指摘「1度目に押すと反応しない」)。
     `SpeakButton` と同じ見せ方にする(文言も共通のものを使う) */
  const allWaiting = player.waiting
  const allSecs = player.secs
  /**
   * **いま通しで何番目を鳴らしているか**(操作盤のため・2026-09)。
   *
   * `speakingKey` は色を付けるための目印で、番号ではない。
   * 送り戻し(◀◀ ▶▶)には番号が要るので、別に持つ。
   * **止めても消さない。** 止めた場所から再開するので、
   * どこで止めたのかは出しておくほうが正しい。
   */
  const playAt = player.at
  /* 鳴っている番号 → 色を付ける鍵。**一覧は控えで渡す** ——
     `playableAll` はこれより下(`section` が決まってから)で作られる */
  const playRef = useRef([])
  /** 操作盤の置き場所(右下 / 上の帯の下)。**覚える** */
  const [place, setPlace] = useState(loadPlace)
  /**
   * 上の帯に置けるか。**判断は幅だけ**(CLAUDE.md)。
   *
   *   > 上部のバーに配置している際も…2行にならないようにしてください。
   *
   * **この数字は実測で決めた。** 帯にはもともと
   * 閉じる・ページ送り・解答・書き込む・メモ・速さ・文字・幅・印刷が
   * 並んでいて、そこへ操作盤(約 380px)を足すと、狭い窓では
   * **2行に折り返してしまう。** 折り返せば紙がそのぶん狭くなり、
   * 「2行にならないように」という指定に反する。
   *
   *   | 何が出ているか | 1行に収まる幅 |
   *   |---|---|
   *   | メモあり(担当ゲストと開いているとき) | **1380px 以上** |
   *   | メモなし(教材の画面から開いたとき)   | 1300px 以上 |
   *
   * **広いほう(1380px)に合わせる。** 狭いほうに合わせると、
   * ゲストと開いたときだけ2行になる。
   * **これより狭い窓では、上の帯には「スイッチだけ」を置く**
   * (2026-09 利用者の指定)。押すと右下の操作盤が開く。
   * 操作盤ごと入れようとすれば帯が2行になり、紙がそのぶん狭くなる。
   * **スイッチ1つ(絵だけ)なら、320px でも1行に収まる。**
   */
  const fitsInBar = useWide(1380)
  /**
   * 幅が足りないときに、右下の操作盤を開いているか。
   * **覚えない。** 押すたびに開け閉めするものである
   * (置き場所そのものは `place` が覚えている)。
   *
   * **はじめから開けておく**(2026-09 実機・利用者の指定)。
   *
   *   > 集中モード以外ではスマホではこのフロートプレーヤーが
   *   > 出ている状態をデフォルトにしましょう。
   *   > 各段落にプレーヤーがある始めの画面は少しうるさいです
   *
   * 段落ごとと操作盤は**入れ替え**なので(下の `floating`)、
   * 閉じたまま始めると**段落の数だけプレーヤーが並ぶ。**
   * 記事は6段落あるので、開いた瞬間の画面が騒がしくなる。
   *
   * **`true` にしても、広い画面には効かない。** あちらは `spot` が
   * 決めており、この値は `!fitsInBar` のときしか見ないためである。
   * **集中モードにも出ない** —— `.sheet-floats` は `!run` のときだけ描く。
   */
  const [floatOpen, setFloatOpen] = useState(true)
  /**
   * 実際にどこへ出すか。**幅が足りなければ、覚えている値によらず帯。**
   * 狭い画面には切り替えのボタンを出していないので、
   * 右下のまま覚えていると**戻す道が無くなる**(行き止まりを作らない)。
   */
  const spot = fitsInBar ? place : 'bar'
  /**
   * **いま、操作盤が右下に浮いているか**(2026-09 利用者の指定)。
   *
   *   > プレーヤーがフロートした時は各段落の再生ボタンは隠してください。
   *   > また、プレーヤーが上部バーに格納されている時は
   *   > 各段落にプレーヤーを配置してください
   *
   * **ちょうど入れ替えである。** 押すところは、いつも1か所だけにする。
   *
   * | 操作盤の居場所 | 段落ごと |
   * |---|---|
   * | **右下に浮いている** | **出さない**(すぐ手元に操作盤がある) |
   * | 上の帯にしまってある | **出す**(帯は遠いので、読んでいる場所で押せるように) |
   *
   * 狭い画面ではスイッチだけを帯に置いてあるので、
   * **開いているあいだだけ**「浮いている」と数える。
   * **この式は下の操作盤の出し分けと同じもの**(2か所に書かない)。
   */
  const floating = spot === 'float' || (!fitsInBar && floatOpen)

  /** 通しの読み上げを止める */
  const stopAll = player.stop

  /** ページを移ったら、1問ずつの開け閉めと読み上げを元に戻す */
  const resetItems = () => {
    setOpenItems(new Set())
    stopAll()
  }

  useEffect(() => {
    let alive = true
    loadEnglishVoices().then((list) => { if (alive) setVoices(list) })
    return () => { alive = false; stopReading() }
  }, [])

  /**
   * **いま読んでいるところを、紙のまん中に置く**(2026-09 利用者の指定)。
   *
   *   > 全体を再生中に、今再生している段落や発言がハイライトされるのですが、
   *   > その段落や発言のボックスが画面中央に表示されるようにしてください。
   *   > 今も追ってはくれるのですが、下の方に表示されてしまいます。
   *
   * 以前は `scrollIntoView({ block: 'nearest' })` だった。**あれは
   * 「見えるところまで、いちばん少なく動かす」**ので、下から入ってきた
   * 発言は**下端に貼り付いたまま**になる。そこは右下の操作盤と重なるうえ、
   * 次の発言が見えないので、話の流れが追えない。
   *
   * **`scrollIntoView` は使わない**(CLAUDE.md)。あれは紙だけでなく
   * 外側まで送ってしまう。紙は `overflow-y: auto` の箱なので、
   * **その箱の `scrollTop` だけ**を動かす。
   */
  useEffect(() => {
    if (!speakingKey) return
    const sheet = sheetRef.current
    const box = sheet?.querySelector(`[data-key="${window.CSS.escape(speakingKey)}"]`)
    if (!sheet || !box) return
    const s = sheet.getBoundingClientRect()
    const r = box.getBoundingClientRect()
    /* まん中に置くための送り。
       **画面より背の高い発言は、上をそろえる。** まん中に置くと
       頭が切れて、読み始めが見えなくなる(長い段落で起きる) */
    const room = s.height - r.height
    const want = (r.top - s.top) - (room > 0 ? room / 2 : 16)
    const max = Math.max(0, sheet.scrollHeight - sheet.clientHeight)
    const top = Math.max(0, Math.min(sheet.scrollTop + want, max))
    // **滑る動きが苦手な人がいる**(CLAUDE.md「`prefers-reduced-motion` を尊重」)
    const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
    sheet.scrollTo({ top, behavior: calm ? 'auto' : 'smooth' })
  }, [speakingKey])

  // **開いた時点で、まだ控えに無い語を裏で引いておく。**
  // 触れてから引きに行くと、はじめての語は数秒待たされる(2026-08 の要望)。
  // 見えているページの分だけ。全ページを一度に引くと無駄が出る。
  useEffect(() => {
    const sec = sections[page]
    if (!sec) return
    const texts = sec.items
      .map((it) => it.prompt_en || it.question || '')
      .filter(Boolean)
      .map((text) => ({ text }))
    prefetchGlosses(texts, { level: material?.level })
  }, [page, sections, material?.level])

  // 開いているあいだは、後ろの画面を動かさない
  useEffect(() => {
    const before = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = before }
  }, [])

  // Esc で閉じる。左右の矢印でページを送る。
  //
  // **`if (e.key !== 'Escape') return` を先頭に置いてはいけない。**
  // 「表示」を先に閉じる仕組みを足したとき(2026-08)これを置いてしまい、
  // **矢印でページを送れなくなっていた。** 早く帰る条件を足すときは、
  // その下にある処理が何を見ているかを必ず確かめる。
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        // **開いているものから閉じる。** いきなり画面ごと閉じない
        if (notesRef.current) { setNotes(false); return }
        if (openSettingsRef.current) { setOpenSettings(false); return }
        if (runRef.current) { setRun(null); return }
        stopReading(); onClose?.()
        return
      }
      // 通しの練習のあいだはページという考え方が無い(教材1本を通す)
      if (runRef.current) return
      if (e.key === 'ArrowRight') {
        setPage((p) => Math.min(p + 1, sections.length - 1))
        resetItems()
      }
      if (e.key === 'ArrowLeft') {
        setPage((p) => Math.max(p - 1, 0))
        resetItems()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, sections.length])

  if (!material) return null
  // 弱点は教材名にも入る。**全部入っているなら、札は出さない**(同じ言葉が
  // 2度並ぶため)。1つでも欠けていれば、**全部**を札で出す。
  // 一部だけを出すと、何が抜けているのか分からない一覧になる。
  const allTags = material.tagIds ?? []
  const titleText = String(material.title ?? '')
  const extraTags = allTags.every((t) => titleText.includes(weaknessTagLabel(t))) ? [] : allTags
  const section = sections[page]
  /* その問を見分ける鍵。**ページ(演習)の番号を頭に置く。**
     紙には全ページを出すので(下記)、`page` で作っていたころのままだと
     別の演習の同じ番号の問と鍵がぶつかり、読み上げの色が2か所に付く */
  const key = (it, i, si = page) => it.id ?? `${si}-${i}`

  /** その問の解答が出ているか */
  const isOpen = (k) => openItems.has(k)

  /** その問の解答を出す / 隠す */
  const toggleItem = (k) => {
    const next = new Set(openItems)
    if (next.has(k)) next.delete(k)
    else next.add(k)
    setOpenItems(next)
  }
  /* いま開いているページのぶん。**通しの読み上げ(`playWhole`)だけが使う。**
     ページごとの描き方は `renderSection()` の中で求め直す
     (紙には全ページを出すので、ページごとに声も種類も違いうる) */
  // 話す人 → 声。会話でないときは空(既定の声が使われる)
  const cast = castVoices(voices, (section?.items ?? []).map((it) => it.speaker))
  // こちらで作った音声(MP3)の話者。端末の声から換算しない(voiceCast.js)
  // 訛りは教材が決め、性別は役ごとに決まる(0017)
  const clipCast = castClipSpeakers(
    (section?.items ?? []).map((it) => it.speaker), material.voiceIds,
  )
  // 話す人が無い教材(ドリルなど)でも、1つめの声で読む
  const soloVoice = resolveVoices(material.voiceIds)[0]
  // 良い声を使うか、標準の声で足りるか(`voiceTier.js`)。
  // 記事・会話とリスニング、それに**発音・リズムの弱点**なら良い声にする
  const tier = voiceTierFor({ exerciseType: section?.exercise_type, tags: allTags })
  // 日本語と英語が対になった文が1つでもあれば、Quick Response ができる。
  // **穴埋め・リスニング・内容の理解しか無い教材では出さない**(`quickResponse.js`)
  const qrPossible = hasQuickResponse(material)
  // 6Steps は本文(記事・会話)に対する練習である。**本文のページを探して渡す。**
  // いま開いているページが語句や設問でも、6Steps は本文に対して行う
  const passageSection = sections.find((x) => isPassageSection(x.exercise_type)) ?? null

  /**
   * **いま紙のまん中に出ているのは、どの発言(段落)か**
   * (2026-09 利用者の指定)。
   *
   *   > KENJI が大体画面の中心に来ている時は集中モードを押したら
   *   > ②KENJI の集中モードに入り、解除したら同じ場所に戻るようにしてください。
   *
   * 集中モードは「どこまで見たか」を覚えているが、**紙を読んでいる途中で
   * 押したときは、そちらのほうが強い。** 目はいまその発言の上にあるので、
   * 別のところから始まると、探し直すことになる。
   *
   * 中心からの近さで選ぶ。**まん中にかかっていれば距離 0** なので、
   * 画面をまたぐ長い発言でも正しく当たる。
   * 見えていない(ページを閉じている)ときは `null` を返し、
   * **覚えている場所のまま**にする。
   */
  const centeredFocusIndex = () => {
    const el = sheetRef.current
    if (!el || !passageSection) return null
    const box = el.getBoundingClientRect()
    const mid = box.top + box.height / 2
    let best = null
    let bestGap = Infinity
    el.querySelectorAll('li[data-focus]').forEach((node) => {
      const r = node.getBoundingClientRect()
      if (r.height === 0) return          // 閉じているページは高さが 0
      const gap = r.top > mid ? r.top - mid : (r.bottom < mid ? mid - r.bottom : 0)
      if (gap < bestGap) { bestGap = gap; best = Number(node.dataset.focus) }
    })
    return Number.isFinite(best) ? best : null
  }

  /**
   * **集中モードに入る前の場所**(利用者の指定「解除したら同じ場所に戻る」)。
   *
   * 紙は `overflow-y: auto` の箱なので、送った量は `scrollTop` に入っている。
   * ただし練習中は `.lesson-sheet.is-running` で**並べ方が変わる**ため、
   * 戻ってきたときには送りの量が落ちていることがある。だから控えておく。
   */
  const backTo = useRef(null)
  /** 集中モードを、いま見ている発言から始める(`null` なら覚えている場所) */
  const [focusAt, setFocusAt] = useState(null)
  /**
   * 6Steps の最中の集中モード(2026-09 利用者の指定)。
   *
   *   > ディクテーション画面でもスラッシュリーディング画面でも
   *   > 同じにしてください
   *
   * ボタンの行は**この画面が持っている**ので、開いているかどうかも
   * ここで持ち、`PassagePractice` に渡す。中にも同じボタンを置くと、
   * **1つの画面に同じものが2つ**出る(CLAUDE.md)。
   */
  const [sixFocus, setSixFocus] = useState(false)
  /**
   * Quick Response の集中モードを開いているか(2026-09 実機・利用者の指摘)。
   *
   *   > Quick Response で集中モードを押すと違うトレーニングになってしまいます。
   *
   * 6Steps と**まったく同じ取り違え**だった。集中モードは
   * 「**いま取り組んでいることを1つずつ画面に固定する**」ものであって、
   * 別のトレーニングへ移るものではない。開いているかどうかは
   * ボタンのある**この画面**が持ち、`QuickResponse` へ渡す。
   */
  const [qrFocus, setQrFocus] = useState(false)
  /**
   * 「取り組み方」を開いている演習の id(2026-09 利用者の指定)。
   * **覚えない。** 「初めは閉じてて欲しい」という指定なので、
   * 開くたびに閉じたところから始める。
   */
  const [howOpen, setHowOpen] = useState(null)
  /**
   * **集中モードから 6Steps へ移るときの、行き先**(2026-09 利用者の指定)。
   *
   *   > 黒がメインの画面にも6stepsに行くためのタブを上部バーに
   *   > 実装してください。
   *
   * 「本文を読んで語を調べる」集中モード(`FocusReader`)で選ばれた
   * 取り組み方を、`PassagePractice` へ**1回だけ**渡す。
   * そのあとは中のプルダウンで自由に切り替えられる。
   */
  const [startStep, setStartStep] = useState(null)

  /* 練習をやめたら、集中モードも閉じる。**開きっぱなしにしない**
     (次に Quick Response を開いたとき、いきなり集中モードに入って驚く) */
  useEffect(() => { if (run !== 'six') setSixFocus(false) }, [run])
  useEffect(() => { if (run !== 'qr') setQrFocus(false) }, [run])

  const openFocus = () => {
    stopAll()
    backTo.current = sheetRef.current?.scrollTop ?? null
    setFocusAt(centeredFocusIndex())
    setRun('focus')
  }

  /**
   * 集中モードから 6Steps へ移る(`FocusReader` のプルダウン)。
   * **紙に戻る場所は控えたまま**にしておく — 6Steps を閉じれば、
   * 入る前と同じところへ戻れる。
   */
  const goStep = (id) => {
    stopAll()
    setStartStep(id)
    setRun('six')
    setSixFocus(true)
  }

  /**
   * **どの集中モードでも、上の帯に同じものを置く**(2026-09 利用者の指定)。
   *
   *   > 全ての集中モードにおいて、音声の速さ、画面の幅、印刷、
   *   > 文字の大きさのUIはこの写真のように黒のデザインで
   *   > 上部バーに配置しておいてください。
   *
   * **中身はここ1か所で作る。** 3つの集中モードそれぞれに書き写すと、
   * 必ずどれかだけ古くなる(CLAUDE.md)。
   * 押したときの動きも、レッスン表示の帯とまったく同じものを使う
   * ——「速さを変えたら読み上げを止める」「選んだ値は覚える」——
   * ので、**判断が2か所に分かれない。**
   *
   * 印刷は**紙(`#lesson-sheet`)を刷る。** 集中モードで見えているのは
   * 1つだけだが、紙は教材まるごとの控えである(CLAUDE.md
   * 「紙は教材まるごとの控え」)。
   */
  const focusSettings = (
    <>
      <Stepper label="速さ" options={SPEECH_RATES} value={rateId}
               onChange={(id) => { setRateId(id); saveRateId(id); stopAll() }} />
      <Stepper label="文字" options={SIZES} value={size}
               onChange={(id) => { setSize(id); saveSize(id) }} />
      {/* 紙の幅。**広い画面だけ**(CSS が狭い画面で隠す) */}
      <Stepper label="幅" options={WIDTHS} value={width} className="lesson-widths"
               onChange={(id) => { setWidth(id); saveWidth(id) }} />
      <button type="button" className="btn btn--small"
              onClick={() => printElement(document.getElementById('lesson-sheet'))}>
        <PrintIcon />印刷
      </button>
    </>
  )

  /* 練習をやめて紙に戻ったら、**入る前とぴったり同じ場所**へ送り直す。
     `useLayoutEffect` にしてあるのは、**描き直しのあと・目に映る前**に
     戻すため。`useEffect` だと、いったん頭に戻ったのが見えてしまう。
     並べ方が落ち着くのは次の1コマ先のことがあるので、そこでも念のため戻す */
  useLayoutEffect(() => {
    if (run !== null) return undefined
    const y = backTo.current
    if (y == null) return undefined
    backTo.current = null
    const put = () => { if (sheetRef.current) sheetRef.current.scrollTop = y }
    put()
    const id = window.requestAnimationFrame(put)
    return () => window.cancelAnimationFrame(id)
  }, [run])

  /** 通しで鳴らせる段落・発言(色を付ける目印つき) */
  const playableAll = (section?.items ?? [])
    .map((it, i) => ({ it, key: key(it, i) }))
    .filter(({ it }) => String(it.prompt_en ?? '').trim())

  playRef.current = playableAll

  /**
   * 本文を通して読み上げる。話す人が変わると声も変わる。
   *
   * **持ちものは `useBodyAudio` にある。** ここで渡すのは
   * 「何を・どの声で・どの速さで」だけである。
   */
  const playOpts = (startIndex = null) => ({
    parts: playableAll.map(({ it }) => ({
      text: it.prompt_en,
      voice: voiceFor(cast, it.speaker),
      clipVoice: voiceFor(clipCast, it.speaker, soloVoice),
    })),
    rate: rateOf(rateId),
    tier,
    /* **止めた場所から鳴らす**(2026-09 利用者の指定)。

         > 全文を聞いている途中にストップを押し、もう一度再生を押すと、
         > また元に戻ってしまいます。

       目印は**教材 + 演習**。何段落目の何秒めかは
       `readAloud.js` が1か所で覚える(画面ごとに持たない) */
    resumeKey: `all|${material.id}|${section?.id ?? ''}`,
    startIndex,
  })

  /** 鳴らす・止める(右下のボタンと操作盤の ▶ / ■ は同じもの) */
  const playWhole = () => {
    if (!playableAll.length) return
    player.toggle(playOpts(null))
  }

  /** その段落から鳴らし直す(操作盤の ◀◀ ▶▶) */
  const jumpTo = (i) => {
    if (!playableAll.length) return
    player.jump(playOpts(i))
  }

  return (
    <div className="lesson" role="dialog" aria-label="セッションで使う表示">
      {/* 操作するところ。共有される側にも見えるが、紙の外に置く */}
      <div className={`lesson-bar no-print${pen ? ' is-inking' : ''}`}>
        {/* ── 書き込みのあいだは、**帯をまるごと入れ替える** ──────
            2026-09 利用者の指定。

              > 「書き込み」を開いたときは、2列目に機能が表示されるのでは
              > なく、1列目にもともとのツールバーを一時的に消して
              > 表示させてください。

            2段にすると紙がそのぶん狭くなる。書いているあいだは
            ページ送りも速さも触らないので、**入れ替えてしまってよい。**
            **戻る道は必ず先頭に置く**(「書き込みを終える」)。
            これが無いと、閉じ方を探すことになる。 */}
        {pen ? (
          <div className="lesson-ink">
            <button type="button" className="btn btn--small btn--primary"
                    onClick={() => setPen(false)}>
              <PenIcon /><span className="mid-text">書き込みを終える</span>
            </button>
            <div className="ink-tools" role="group" aria-label="書き込みの道具">
              {INK_TOOLS.map((t) => (
                <button key={t.id} type="button"
                        className={`theme-btn${inkTool === t.id ? ' is-active' : ''}`}
                        aria-pressed={inkTool === t.id}
                        onClick={() => setInkTool(t.id)}>
                  {t.label}
                </button>
              ))}
            </div>
            {/* **消しゴムのときは色を出さない。** 効かない操作を見せない */}
            {inkTool !== 'eraser' && INK_COLORS.map((c) => (
              <button key={c.id} type="button"
                      className={`ink-color${inkColor === c.color ? ' is-on' : ''}`}
                      style={{ '--ink-color': c.color }}
                      aria-label={`${c.label}で書く`} aria-pressed={inkColor === c.color}
                      onClick={() => setInkColor(c.color)} />
            ))}
            {/* **ひとつ戻す**を先に置く。書き損じはたいてい直前の1本 */}
            <button type="button" className="btn btn--small"
                    disabled={!(ink[page] ?? []).length}
                    onClick={() => setInk((m) => ({ ...m, [page]: (m[page] ?? []).slice(0, -1) }))}>
              ひとつ戻す
            </button>
            <button type="button" className="btn btn--small"
                    disabled={!(ink[page] ?? []).length}
                    onClick={() => setInk((m) => ({ ...m, [page]: [] }))}>
              全部消す
            </button>
          </div>
        ) : (
        <>
        {/* ── いつも要るもの。**この1行に収める** ──────────────
            **1つの囲みにまとめて、折り返さないようにしてある。**
            以前は帯ぜんぶを折り返させていたので、iPhone(390px)で
            「表示」だけが2段目に落ち、**帯の高さが2倍**になっていた
            (2026-08 実機)。紙がそのぶん狭くなる。 */}
        <div className="lesson-bar-main">
        {/* ── いつも要るもの ──────────────────────────────
            スマホでは操作欄が4段になり、画面の4割を占めていた
            (2026-08 実機)。レッスン中に何度も触るのは
            「閉じる・ページ送り・解答」の3つだけである。
            狭い画面では言葉も短くする(`.wide-text` を隠す)。 */}
        <button type="button" className="btn btn--small"
                aria-label="閉じる"
                onClick={() => { stopReading(); onClose?.() }}>
          ✕<span className="wide-text"> 閉じる</span>
        </button>

        {/* Quick Response のあいだは出さない。**教材1本を通しでやる**ので
            ページという考え方が無く、解答は1問ずつその場で出るためである。
            効かないボタンを残しておくほうが、迷わせる */}
        {!run && (
          <>
            <div className="lesson-pages">
              <button type="button" className="btn btn--small"
                      disabled={page === 0} aria-label="前のページ"
                      onClick={() => { setPage(page - 1); resetItems() }}>◀</button>
              <span>{page + 1} / {sections.length}</span>
              <button type="button" className="btn btn--small"
                      disabled={page >= sections.length - 1} aria-label="次のページ"
                      onClick={() => { setPage(page + 1); resetItems() }}>▶</button>
            </div>

            {/* ── 読み上げの操作盤を呼ぶスイッチ(2026-09 利用者の指定)──
                > 幅が入らない場合はフロートUIを起動するスイッチのみを
                > 配置してください。これはデバイスの画面幅により
                > 最適化される仕様にしてください

                操作盤ごと帯に入れようとすれば、狭い窓では2行に折り返し、
                紙がそのぶん狭くなる。**スイッチ1つ(絵だけ)なら、
                320px でも1行に収まる。**

                **いつも見える行に置く。** 「表示」の中に畳むと、
                鳴らすまでに2回押すことになる(あそこは
                「一度決める設定」のための場所である)。

                **鳴っているあいだは押している印を出す。** 開いていなくても
                「いま鳴っている」ことが、この1つで分かる */}
            {isPassageSection(section?.exercise_type) && !fitsInBar && (
              <button type="button"
                      className={`btn btn--small player-launch${
                        floatOpen || playingAll ? ' is-on' : ''}`}
                      aria-label={floatOpen ? '読み上げの操作を閉じる' : '読み上げの操作を開く'}
                      aria-pressed={floatOpen}
                      onClick={() => setFloatOpen((v) => !v)}>
                <SpeakerIcon />
              </button>
            )}
          </>
        )}

        {/* ── しまっておくもの ────────────────────────────────
            速さ・配色・文字の大きさ・印刷は、**一度決めれば何度も
            要らない。** 狭い画面ではここに畳み、押したときだけ出す。
            パソコンでは畳まない(CSS が決めるので、この札も出ない)。 */}
        <button type="button" className="btn btn--small lesson-more"
                aria-expanded={openSettings} aria-controls="lesson-settings"
                onClick={() => setOpenSettings((v) => !v)}>
          <GearIcon /><span className="mid-text">表示</span>
        </button>
        </div>

        <div className={`lesson-settings${openSettings ? ' is-open' : ''}`}
             id="lesson-settings">
          {/* ── 読み上げの操作盤(2026-09 利用者の指定)──────────────
              > 上部のバーに配置している際もフロート時と同じ幅、同じUIに
              > して、2行にならないようにしてください。つまり、「書き込む」
              > など他のUIの左側に1行に並んで収まるようにしてください

              はじめは**帯の下にもう1本、横いっぱいの行**を足していた。
              けれども上の帯はもともと1行に収まっているので、
              **そこへ入れれば行は増えない。**
              置き場所は `.lesson-settings` の**先頭** —
              「書き込む」のすぐ左である(利用者の指定どおり)。

              **狭い窓では出さない**(`fitsInBar`・上に実測の表がある)。
              足すと帯が2行に折り返し、紙がそのぶん狭くなる。
              そのときは、いつも見える行に**スイッチだけ**を置く
              (`.player-launch`)。 */}
          {isPassageSection(section?.exercise_type) && spot === 'bar' && fitsInBar && (
            <PlayerBar
              place="bar" onPlace={(v) => { setPlace(v); savePlace(v) }}
              playing={playingAll}
              label={playingAll && allWaiting ? preparingLabel(allSecs) : null}
              at={playAt} total={playableAll.length}
              unit={countUnit(section?.exercise_type)}
              onToggle={playWhole} onJump={jumpTo}
              repeat={player.repeat} onRepeat={player.setRepeat}
            />
          )}

          {/* ── 紙への書き込み(2026-09 利用者の指定でここへ移した)──
              > 書き込む、の機能が画面に収まってません。
              > 文字の大きさや明暗の切り替えの機能と同じところに入れてください。

              いつも要るのは「閉じる・ページ送り・解答・表示」の4つだけで、
              **その1行に5つめを足したので、iPhone(390px)で
              画面の外へはみ出していた**(2026-09 実機)。
              書き込みは、始めるときと終わるときに1回ずつ触るものなので、
              **一度決める設定と同じところ**でよい。 */}
          <button type="button"
                  className={`btn btn--small${pen ? ' btn--primary' : ''}`}
                  aria-pressed={pen}
                  title="紙に書き込む(閉じると消えます)"
                  onClick={() => setPen((v) => !v)}>
            <PenIcon /><span className="mid-text">書き込む</span>
          </button>

          {/* ── セッションの記録(0032)──────────────────────
              **書き込むと同じ理由でここに置く。** いつも要る1行に
              足すと、同じようにはみ出す。
              出すのは、ゲストと一緒に開いているときだけ
              (トレーナーの「教材」画面には相手がいない)。 */}
          {canNote && (
            <button type="button"
                    className={`btn btn--small${notes ? ' btn--primary' : ''}`}
                    aria-pressed={notes}
                    title="この日のセッションの記録(日付ごとに残ります)"
                    onClick={() => setNotes((v) => !v)}>
              <NoteIcon /><span className="mid-text">メモ</span>
            </button>
          )}

          {/* ── 3つとも「◀ いま ▶」にそろえる(2026-09 利用者の指定)──
              > 画面幅、文字の大きさ、そして読み上げの速さ、全てを
              > 画面幅と文字の大きさのUIに統一し、そして、現在の設定の
              > 左右に三角を置くデザインにしてください。
              > そうすればスペースを有効に使えます。◀︎標準▶︎

              選択肢を全部並べる形は**段の数だけ横に伸びる。** 速さは13段、
              紙の幅は7段になったので、並べるやり方はもう成り立たない。
              **見出し(速さ / 文字 / 幅)は残す。** 3つとも同じ形になったので、
              見出しが無いとどれがどれか分からない(しかも2つは「%」である) */}
          <Stepper label="速さ" options={SPEECH_RATES} value={rateId}
                   onChange={(id) => { setRateId(id); saveRateId(id); stopAll() }} />
          <Stepper label="文字" options={SIZES} value={size}
                   onChange={(id) => { setSize(id); saveSize(id) }} />
          {/* 紙の幅。**広い画面だけ**(CSS が狭い画面で隠す) */}
          <Stepper label="幅" options={WIDTHS} value={width} className="lesson-widths"
                   onChange={(id) => { setWidth(id); saveWidth(id) }} />
          <button type="button" className="btn btn--small"
                  onClick={() => printElement(document.getElementById('lesson-sheet'))}>
            <PrintIcon />印刷
          </button>
        </div>

        </>
        )}
      </div>

      {/* 紙と、その横のメモ。**入れ物を1つはさむ**(0032)。
          メモを紙の上に重ねると、教材を見ながら書けない。
          横に並べるには、帯とは別の「行」が要る
          (`.lesson` は縦に積む入れ物である) */}
      <div className="lesson-body">
      {/* ここが「紙」。暗い配色を選んでいても白のまま */}
      {/* 通しの練習のあいだは、紙を**縦いっぱいの1枚**として使う。
          そうすると出題がまん中に落ち着き、**文の長さが変わっても
          ボタンの場所が動かない**(2026-08 の指摘) */}
      <div className={`lesson-sheet lesson-sheet--${size} lesson-sheet--${width}${run ? ' is-running' : ''}`}
           id="lesson-sheet" ref={sheetRef}>
        {/* **書き込みは、紙の中に敷く。** 送る箱の中にあるので、
            中身と一緒に動く(会議アプリのペンとの違いはここ) */}
        <InkLayer sheetRef={sheetRef} active={pen} color={inkColor}
                  tool={inkTool} width={INK_WIDTH}
                  strokes={ink[page] ?? []}
                  onChange={(next) => setInk((m) => ({ ...m, [page]: next }))} />
        {/* Quick Response のあいだは、題名の帯を出さない(2026-08 の指定)。
            **問題を出す場所を、そのぶん広く取る。**
            6Steps は本文を読む練習なので、題名はそのまま出す */}
        <div className={`lesson-head${qr ? ' is-hidden' : ''}`}>
          {/* ── 誰がどの声で読むか(2026-09 利用者の指定)────────────
                > 各教材のトップにスピーカーが確認できるタブをつけてください

              **紙のいちばん上**に置く。ふだんは畳んであるので、
              「読み上げの声」の札1つぶんしか場所を取らない。
              話す人がいない教材(記事・ドリル・単語)では出ない。
              **紙には刷らない**(`no-print`)—— 記事・会話の紙は
              「書き込むための用紙」で、中身は決まっている(仕様書 5.70) */}
          <CastChip material={material} />
          {/* **見出しには、小さな訳を添える**(0036・2026-09 利用者の指定)。
              0036 を貼る前に作った教材には入っていない(訳が出ないだけ) */}
          <MaterialTitle title={material.title} headline={material.headline}
                         headlineJa={material.headlineJa ?? material.headline_ja}
                         as="strong" size="sheet" />
          {/* **何の練習かを、紙の上に必ず残す。**
              記事・会話は場面の題名が主役になるため、弱点(文法事項)が
              どこにも出ていなかった。紙で復習するときに分からなくなる
              (2026-08 の指摘)。教材名にすでに入っているものは繰り返さない。 */}
          {extraTags.length > 0 && (
            <div className="lesson-weakness">
              <span className="lesson-weakness-label">文法事項</span>
              {extraTags.map((t) => (
                <span key={t} className="lesson-weakness-tag">{weaknessTagLabel(t)}</span>
              ))}
            </div>
          )}
        </div>

        {/* ── 通しで練習する ────────────────────────────────
            **「ページを見る」とは別の行為。** ページは教材の中身を
            順に見るもので、こちらは教材1本を通しで練習するもの。
            紙の中に置くのは、`Listen (全体)` と同じ考え方である
            (操作欄は狭い画面で場所が無い。第5.25節)。
            共有先には見えるが、印刷には出さない */}
        {(qrPossible || passageSection) && (
          <div className="practice-row no-print">
            {/* 6Steps は**本文があるときだけ。**
                文型ドリルや単語には本文が無く、音読も区切りもできない */}
            {passageSection && (
              <button type="button"
                      className={`btn btn--small${run === 'six' ? ' btn--primary' : ''}`}
                      aria-pressed={run === 'six'}
                      onClick={() => { stopAll(); setRun(run === 'six' ? null : 'six') }}>
                <StepsIcon />6Steps
              </button>
            )}
            {qrPossible && (
              <button type="button"
                      className={`btn btn--small${qr ? ' btn--primary' : ''}`}
                      aria-pressed={qr}
                      onClick={() => {
                        stopAll()
                        /* **押したら、そのまま集中モードで始まる**
                           (2026-09 利用者の指定)。

                             > Quick Response も、自動的に集中モードで
                             > 開始される仕様にしてください。

                           単語帳の復習と同じ考え方である
                           (**入口をもう1つ挟まない**)。ここを押した人は
                           もう答える気で来ているのに、これまでは
                           「Quick Response」→「集中モード」と2回押す
                           必要があった。**1問ずつ画面に固定するのが、
                           この練習の既定の形**である。
                           集中モードのボタンは残してあるので、
                           出たければそちらで閉じられる */
                        setQrFocus(!qr)
                        setRun(qr ? null : 'qr')
                      }}>
                <BoltIcon />Quick Response
              </button>
            )}
            {/* **集中モード**(2026-09 実機「どこにも集中モードがありません」)。

                はじめは `PassagePractice` の中にだけ置いていた。ところが
                この画面では `PassagePractice` は **6Steps を押したときにしか
                描かれない**ので、集中モードは 6Steps の**中に埋もれていた。**
                語を調べるのは 6Steps に入る**前**の段階なので、そこにあっては
                たどり着けない。**6Steps・Quick Response と横に並べる。**

                **並びは「6Steps → Quick Response → 集中モード」**
                (2026-09 利用者の指定)。

                  > トップの画面でのボタンの並びを左から「６Steps」
                  > 「Quick Response」「集中モード」にして、ディクテーション
                  > 画面でもスラッシュリーディング画面でも同じにしてください。

                **6Steps を開いているあいだも、同じ行のまま出す。**
                そのときは**いまの取り組み方**の集中モード
                (1文ずつ / 1発言ずつ)に入る。中に同じボタンを置かないので、
                **同じことをするボタンは、どの画面でも1つだけ**である */}
            {(passageSection || qr) && (
              <button type="button"
                      className={`btn btn--small${
                        run === 'focus' || (run === 'six' && sixFocus)
                        || (qr && qrFocus) ? ' btn--primary' : ''}`}
                      aria-pressed={run === 'focus' || (run === 'six' && sixFocus)
                        || (qr && qrFocus)}
                      onClick={() => {
                        // 6Steps の最中は、**その取り組み方**を1つずつ出す
                        if (run === 'six') { setSixFocus((v) => !v); return }
                        /* Quick Response の最中は、**その1問**を画面に固定する
                           (2026-09 実機「違うトレーニングになってしまいます」)。
                           ここで `openFocus()` を呼ぶと、本文を読んで語を調べる
                           画面へ飛ばされる — それが報告された不具合である */
                        if (qr) { setQrFocus((v) => !v); return }
                        if (run === 'focus') { stopAll(); setRun(null); return }
                        openFocus()
                      }}>
                <FocusIcon />集中モード
              </button>
            )}
          </div>
        )}

        {/* ── 右下に貼り付く「集中モード」(2026-09 利用者の指定)──────
            > このボタンは「教材を作る」のように常に右下にも固定してください。

            上のボタンの行は**紙と一緒に送られて消える。** 記事は6段落あるので、
            読んでいる途中で「この語を調べたい」と思ったときには
            もう画面の外にいる。**押したくなる場所に、いつでもある**ようにする
            (さがす画面の `.finder-float` と同じ考え方)。

            **入る場所と出る場所を、同じ右下にそろえる**
            (出るほうは `FocusReader` の `.focus-exit`)。
            通しの練習(6Steps / Quick Response)のあいだは出さない。
            あちらはあちらで下にボタンがあり、重なる */}
        {passageSection && !run && (
          <div className="sheet-floats no-print">
            {/* ── 通しの読み上げも、右下に置く(2026-09 利用者の指定)──────
                > 全体を再生を一度押すと、どこにも再生を止めるボタンがないので、
                > 右下の集中モードの横あたりに再生中ならstop、
                > 停止中ならlistenが出てる仕様にしてください。

                「Listen (全体)」は**本文のいちばん上**にある。押したあと
                読み進めると、**止めるボタンごと画面の外へ出ていく。**
                鳴らすボタンがそのまま Stop に変わる作法(CLAUDE.md)は
                合っていても、**その1つが見えないところにあっては止められない。**

                **同じことをするボタンを2つ見せない**のが決まりだが、これは
                「上のと同じもの」ではなく、**送っていったときの居場所**である
                (`.finder-float` と同じ考え方)。
                本文のページを開いているときだけ出す — ほかのページでは
                通しで鳴らすものが無い(効かない操作を見せない)。 */}
            {/* **右下に出す。** 選ばれているときと、**狭い画面のとき。**
                狭い画面では上の帯の設定が「表示」に畳まれるので、
                そちらに置くと鳴らすボタンがしまい込まれてしまう */}
            {/* **`!fitsInBar` を必ず添える。** 添えないと、右下を開いたまま
                窓を広げたときに**帯と右下の2つ**が出る(実測で確かめた) */}
            {isPassageSection(section?.exercise_type) && floating && (
              <PlayerBar
                place="float"
                /* **狭い画面では切り替えを出さない。** そこでは
                   上の帯にスイッチがあり、それが開け閉めを受け持つ。
                   置き場所を選べないので、選ばせない
                   ——効かない操作を見せない(CLAUDE.md) */
                onPlace={fitsInBar ? (v) => { setPlace(v); savePlace(v) } : null}
                playing={playingAll}
                label={playingAll && allWaiting ? preparingLabel(allSecs) : null}
                at={playAt} total={playableAll.length}
                unit={countUnit(section?.exercise_type)}
                onToggle={playWhole} onJump={jumpTo}
                repeat={player.repeat} onRepeat={player.setRepeat}
              />
            )}

            {/* ── 右下に貼り付く「集中モード」(2026-09 利用者の指定)──────
                > このボタンは「教材を作る」のように常に右下にも固定してください。

                上のボタンの行は**紙と一緒に送られて消える。** 記事は6段落あるので、
                読んでいる途中で「この語を調べたい」と思ったときには
                もう画面の外にいる。**押したくなる場所に、いつでもある**ようにする。

                **入る場所と出る場所を、同じ右下にそろえる**
                (出るほうは `FocusReader` の `.focus-exit`)。
                通しの練習(6Steps / Quick Response)のあいだは出さない。
                あちらはあちらで下にボタンがあり、重なる */}
            <button type="button" className="btn btn--small sheet-float"
                    onClick={openFocus}>
              <FocusIcon />集中モード
            </button>
          </div>
        )}

        {run === 'focus' ? (
          /* **集中モード。** 1段落だけを画面に固定して語を調べる。
             `PassagePractice` を通さず、ここから直に出す
             (6Steps の中の1つではなく、6Steps と並ぶもう1つの取り組み方) */
          <FocusReader
            section={passageSection}
            isDialogue={passageSection.exercise_type === 'dialogue'}
            voiceIds={material.voiceIds}
            tier={voiceTierFor({ exerciseType: passageSection.exercise_type, tags: allTags })}
            level={material.level}
            /* **紙のまん中に出ていた発言から始める**(2026-09 利用者の指定)。
               `null` のときだけ、覚えている場所から始まる */
            startAt={focusAt}
            /* **紙の幅をそのまま引き継ぐ**(2026-09 利用者の指定)。
               同じ教材を、同じ幅で読み続けられるようにする */
            width={width}
            wordStatuses={wordStatuses} onMarkWord={onMarkWord}
            materialId={material.id} learnerId={learnerId}
            /* **6Steps へは、上の帯から移れる**(2026-09 利用者の指定) */
            onGoStep={passageSection ? goStep : null}
            /* 速さ・文字・幅・印刷。**3つの集中モードで同じもの** */
            settings={focusSettings}
            onClose={() => setRun(null)}
          />
        ) : run === 'six' ? (
          <PassagePractice
            section={passageSection}
            /* **6Steps の中にも集中モードを出す**(2026-09 利用者の指定
               「6steps全てに集中モードを作ってください」)。
               こちらは**いまの取り組み方**を1つずつ出すもので、
               上のボタンの行にあるもの(本文を読んで語を調べる)とは別物である。
               同じ言葉が2つ並ばないよう、6Steps を開いているあいだは
               上の行のほうを引っ込めてある(すぐ上の `.practice-row`) */
            /* 集中モードのボタンは**上のボタンの行**にある(利用者の指定で、
               6Steps を開いているあいだも同じ行のまま出す)。
               ここにも出すと、1つの画面に同じボタンが2つ並ぶ */
            showFocus={false}
            focus={sixFocus} onFocusChange={setSixFocus}
            /* **紙の幅をそのまま引き継ぐ**(2026-09 実機
               「画面幅が引き継がれていません」)。130% にして読んでいた人が、
               集中モードに入った瞬間に別の幅に変わっては落ち着かない。
               `FocusReader` に渡しているものと**同じ値**である */
            focusWidth={width}
            /* 速さ・文字・幅・印刷。**3つの集中モードで同じもの** */
            focusSettings={focusSettings}
            /* 集中モードのプルダウンから来たときの行き先(1回だけ効く) */
            startStep={startStep}
            /* 見出しは紙の上にもう出ている。**同じ英語を2行続けて並べない** */
            isDialogue={passageSection.exercise_type === 'dialogue'}
            /* 途中経過を教材ごとにまとめて消せるようにするため、
               教材の id も渡す(`src/lib/progress.js`) */
            materialId={material.id}
            learnerId={learnerId}
            tags={allTags} voiceIds={material.voiceIds} level={material.level}
          />
        ) : qr ? (
          <QuickResponse material={material} paper learnerId={learnerId}
                         /* **集中モードは、この画面のボタンが持つ**
                            (中にも同じボタンを置くと2つ並ぶ) */
                         focus={qrFocus} onFocusClose={() => setQrFocus(false)}
                         /* 紙の幅をそのまま引き継ぐ(ほかの集中モードと同じ) */
                         focusWidth={width}
                         /* 速さ・文字・幅・印刷。**3つの集中モードで同じもの** */
                         focusSettings={focusSettings}
                         onClose={() => setRun(null)} />
        ) : null}

        {/* ── 演習のページ ──────────────────────────────────
            **画面には選んだページだけ。紙には全部のページを出す**
            (2026-09 利用者の指定「内容確認と出てきた語句のページも
            正しく印刷できるように」)。

            画面は ◀ 1 / 3 ▶ で1ページずつ見るものだが、
            **紙は教材まるごとの控え**である。ページを送りながら
            3回印刷させない。

            描かずにいると紙にも出ないので(`src/lib/print.js`)、
            **描いてから隠す**(`is-closed`)。紙用の指定が
            `display: block` に戻す。 */}
        {sections.map((sec, si) => renderSection(sec, si))}

        {/* Quick Response の控え。**紙のいちばん後ろに置く**
            (2026-09 利用者の指定「ページは一番後ろで大丈夫です」)。
            画面には出さない(`print-only`)。練習は上のボタンから行う */}
        <QuickResponseSheet material={material} />
      </div>

      {/* ── セッションの記録(0032)────────────────────────────
          紙の**上に重ねず、横に並べる。** 重ねると、教材を見ながら
          書けない。狭い画面では下から出す(CSS)。
          **紙には出さない**(`no-print`)。記録は教材の控えではない */}
      {canNote && notes && (
        <>
          {/* 紙とメモの境目。**つまんで動かすと、メモの幅が変わる**
              (2026-09 利用者の指定)。
              ・幅は px で持つ。割合だと、画面が狭いときに紙が読めなくなる
              ・**離した時点で覚える。** 動かしているあいだは書き込まない
              ・キーボードでも動かせるようにする(← → で 20px ずつ)。
                つまんで動かす操作は、それだけしか道が無いと届かない人がいる */}
          <div className="lesson-grip no-print" role="separator"
               aria-label="メモの幅を変える" aria-orientation="vertical"
               tabIndex={0}
               onKeyDown={(e) => {
                 const d = e.key === 'ArrowLeft' ? 20 : e.key === 'ArrowRight' ? -20 : 0
                 if (!d) return
                 e.preventDefault()
                 const next = Math.min(NOTES_MAX, Math.max(NOTES_MIN, notesW + d))
                 setNotesW(next); saveNotesW(next)
               }}
               onPointerDown={(e) => {
                 e.currentTarget.setPointerCapture?.(e.pointerId)
                 const startX = e.clientX
                 const startW = notesW
                 const el = e.currentTarget
                 // **右へ動かすとメモは細くなる。** メモは右側にあるため
                 const move = (ev) => {
                   const w = Math.min(NOTES_MAX,
                     Math.max(NOTES_MIN, startW - (ev.clientX - startX)))
                   setNotesW(w)
                 }
                 const up = (ev) => {
                   el.removeEventListener('pointermove', move)
                   el.removeEventListener('pointerup', up)
                   el.removeEventListener('pointercancel', up)
                   saveNotesW(Math.min(NOTES_MAX,
                     Math.max(NOTES_MIN, startW - (ev.clientX - startX))))
                 }
                 el.addEventListener('pointermove', move)
                 el.addEventListener('pointerup', up)
                 el.addEventListener('pointercancel', up)
               }} />
          <aside className="lesson-notes no-print" aria-label="セッションの記録"
                 style={{ '--notes-w': `${notesW}px` }}>
            <div className="lesson-notes-head">
              <strong>セッションの記録</strong>
              <button type="button" className="btn btn--small"
                      onClick={() => setNotes(false)}>閉じる</button>
            </div>
            {notesFor ? (
              <LessonNotes learnerId={notesFor} bare />
            ) : (
              /* **相手が決まっていない。** 教材の画面から開いたときは、
                 誰のセッションの記録かをここで選ぶ。
                 **選ばせてから断らない** —— 出るのは担当ゲストだけである */
              <div className="lesson-notes-pick">
                <label className="field">
                  <span>誰のセッションの記録ですか</span>
                  <select value="" onChange={(e) => setNotesFor(e.target.value || null)}>
                    <option value="">選んでください</option>
                    {(notePeople ?? []).map((p) => (
                      <option key={p.id} value={p.id}>{p.display_name}</option>
                    ))}
                  </select>
                </label>
                {notePeople === null && <p className="card-hint">読んでいます…</p>}
                {notePeople?.length === 0 && (
                  <p className="card-hint">担当しているゲストがいません。</p>
                )}
                <p className="card-hint">
                  記録はゲストごと・日付ごとに1枚残ります。
                  ゲストのページから教材を開いたときは、ここは出ません。
                </p>
              </div>
            )}
          </aside>
        </>
      )}
      </div>
    </div>
  )

  /**
   * 演習1つぶん。**どのページも同じ描き方**にするため、関数にしてある。
   * 声・種類は演習ごとに違うので、ここで求め直す。
   */
  function renderSection(sec, si) {
    if (!sec) return null
    const secType = exerciseType(sec.exercise_type)
    const secIsPassage = isPassageSection(sec.exercise_type)
    const secCast = castVoices(voices, (sec.items ?? []).map((it) => it.speaker))
    const secClipCast = castClipSpeakers(
      (sec.items ?? []).map((it) => it.speaker), material.voiceIds,
    )
    const secTier = voiceTierFor({ exerciseType: sec.exercise_type, tags: allTags })
    const k = (it, i) => key(it, i, si)
    /**
     * **集中モードでの番号**(2026-09 利用者の指定)。
     *
     *   > KENJI が大体画面の中心に来ている時は集中モードを押したら
     *   > ②KENJI の集中モードに入り…
     *
     * 「いま画面のまん中にあるのはどの発言か」を、押した瞬間に
     * 引き当てるための目印である。**`data-key` では足りない。**
     * あれは演習をまたいで一意なだけで、集中モードは
     * **本文が空の項目を外した番号**で数えているためである。
     */
    const focusNo = new Map()
    if (sec === passageSection) {
      let fi = 0
      ;(sec.items ?? []).forEach((it, i) => {
        if (!String(it?.prompt_en ?? '').trim()) return
        focusNo.set(i, fi)
        fi += 1
      })
    }
    // 練習中(6Steps / Quick Response)は、どのページも画面には出さない
    const open = si === page && !run
    return (
          /* `data-type` は**紙用の目印**(2026-09 利用者の指定)。
             記事・会話の紙は「本文(訳なし)→ 内容理解 → ディスカッション →
             Quick Response」で、語句は出さない。**画面の見た目は変わらない** */
          <section key={sec.id ?? si} className={`lesson-page${open ? '' : ' is-closed'}`}
                   data-type={sec.exercise_type}>
            <h3 className="lesson-section">
              {exerciseLabel(sec.exercise_type)}
              {`（${countLabel(sec.exercise_type, sec.items.length)}）`}
            </h3>
            {/* ── 取り組み方の説明。**畳んでおく**(2026-09 利用者の指定)──
                > 文章の前の指導のような内容、開いたり閉じたりできるように
                > してください。初めは閉じてて欲しいです。

                このページは**まず聞いて、読んで、集中モードで語に印を付けて、
                内容を確かめる**——いろいろなことを続けて行う場所である
                (利用者の説明)。そのたびに同じ説明を読むことはない。
                けれども**消してはいけない。** 初めて開いた人には要る。

                **開け閉めは覚えない**(「初めは閉じてて欲しい」)。
                6Steps の「やり方」は開閉を覚えているが、あちらは
                **ステップごとに中身が違う**ので、開いたまま次へ進みたい。
                こちらは1つの教材に1つなので、毎回閉じたところから始める。

                **紙には出す**(`open` を付ける)。紙で解く人には説明が要る */}
            {sec.instruction && (
              <div className="lesson-guide">
                <button type="button"
                        className={`lesson-guide-sum no-print${howOpen === sec.id ? ' is-open' : ''}`}
                        aria-expanded={howOpen === sec.id}
                        onClick={() => setHowOpen(howOpen === sec.id ? null : sec.id)}>
                  取り組み方
                </button>
                {/* **`<details>` は使わない。** 閉じている中身は、いまのブラウザでは
                    紙にも出せない(`content-visibility` で消える)。
                    **描いてから隠す**——`.lesson-page` と同じ作法にする */}
                <p className={`lesson-instruction${howOpen === sec.id ? '' : ' is-closed'}`}>
                  {sec.instruction}
                </p>
              </div>
            )}

            {/* **通して聞く手段を、大きく表示したときにも置く。**
                無いと、オーバーラッピングやシャドーイングができない
                (2026-08 の指摘)。話す人が変わると声も変わる。 */}
            {secIsPassage && (
              <div className="lesson-listen no-print">
                {/* **三角は付けない**(2026-09 利用者の指定)。
                    送り戻しは**操作盤の1つ**に集めた(下の `PlayerBar`)。
                    同じことをするものを、画面のあちこちに置かない */}
                <button type="button" className="btn btn--small" onClick={playWhole}>
                  {playingAll
                    ? <><StopIcon />{allWaiting ? preparingLabel(allSecs) : 'Stop'}</>
                    : <><SpeakerIcon />Listen (全体)</>}
                </button>
              </div>
            )}

            <ol className="lesson-items">
              {sec.items.map((it, i) => (
                <li key={k(it, i)} data-key={k(it, i)}
                    data-focus={focusNo.has(i) ? String(focusNo.get(i)) : undefined}
                    className={speakingKey === k(it, i) ? 'is-speaking' : undefined}>
                  {it.tag_id && <span className="lesson-tag">{weaknessTagLabel(it.tag_id)}</span>}
                  {it.speaker && <div className="lesson-speaker" lang="en">{it.speaker}</div>}

                  {/* リスニングは英文を出さない。聞いて答えるため */}
                  {/* 語に触れると意味が出る。**トレーナー側にも要る。**
                      レッスン中に「この語は?」と聞かれる場所そのものなので、
                      ここに無いと画面を離れて調べることになる(2026-08 の指摘)。 */}
                  {!secType?.hidePromptFromLearner && it.prompt_en && (
                    <div className="lesson-en">
                      <EnglishText text={it.prompt_en} textJa={it.prompt_ja} level={material.level}
                                   statuses={wordStatuses} onMark={markWord}
                                   readingAt={speakingKey === k(it, i) ? readingAt : null} />
                    </div>
                  )}
                  {it.phonetic && <Phonetic value={it.phonetic} />}
                  {it.prompt_en && (
                    <PhraseChips phrases={it.phrases} sentence={it.prompt_en}
                                 level={material.level}
                                 statuses={wordStatuses} onMark={markWord} />
                  )}
                  {/* 本文(記事・会話)の訳は、はじめは伏せる。
                      英文だけが出ていたほうがシャドーイングしやすく、
                      「訳を見る」で確かめられる。設問の日本語は伏せない。 */}
                  {it.prompt_ja && (secIsPassage
                    ? isOpen(k(it, i)) && <div className="lesson-ja">{it.prompt_ja}</div>
                    : <div className="lesson-ja">{it.prompt_ja}</div>)}
                  {it.question && (
                    <div className="lesson-en">
                      <EnglishText text={it.question} level={material.level}
                                   statuses={wordStatuses} onMark={markWord} />
                    </div>
                  )}
                  {/* 設問の訳(0035)。**伏せない。**
                      設問は「何を訊かれているか」であって、答えではない
                      (すぐ上の `prompt_ja` も、設問では伏せていない) */}
                  {it.question_ja && <div className="lesson-ja">{it.question_ja}</div>}
                  {it.hint && <div className="lesson-note">与える語: {it.hint}</div>}

                  {/* ── 通しで鳴らしているあいだは、**その段落の Listen が Stop になる**
                      (2026-09 利用者の指定)。

                      > そもそも全体を再生を押した後は、再生中の段落の
                      > listen ボタンは Stop ボタンになっているべきです

                      **鳴らすボタンがそのまま Stop に変わる**のがこのアプリの作法
                      (CLAUDE.md)。ところが通しの読み上げは `SpeakButton` の
                      外側で鳴らしているので、**その段落が鳴っていることを
                      ボタンが知らなかった。** 目はいま光っている段落にあるのに、
                      そこには「Listen」と書いてあり、押すと**二重に鳴り出す。**

                      押したら通しごと止める。**止める場所を探させない** */}
                  {/* **右下に浮いているあいだは出さない**(2026-09 利用者の指定)。
                      操作盤がすぐ手元にあるので、同じことをするものを
                      段落の数だけ並べない(記事なら6組になる) */}
                  {secIsPassage && floating ? null
                    : secType?.audioFrom && it[secType.audioFrom]
                    && playingAll && speakingKey === k(it, i) ? (
                    <button type="button" className="btn btn--small"
                            onClick={() => { stopAll(); setReadingAt(null) }}>
                      <StopIcon />{allWaiting ? preparingLabel(allSecs) : 'Stop'}
                    </button>
                  ) : secType?.audioFrom && it[secType.audioFrom] && (
                    /* **三角を添えるのは本文だけ**(2026-09)。
                       内容の理解や語句は1本の音声に入っていないので、
                       文で送る先が無い(効かない操作を見せない) */
                    withSkip(secIsPassage, (
                      <SpeakButton
                        text={it[secType.audioFrom]}
                        voice={voiceFor(secCast, it.speaker)}
                        clipVoice={voiceFor(secClipCast, it.speaker, soloVoice)}
                        tier={secTier}
                        rate={rateOf(rateId)}
                        /* **1本の中の、その区間だけを鳴らす**
                           (2026-09 利用者の指定で統一)。本文の演習でだけ
                           渡す —— 内容の理解や語句は1本に入っていない */
                        whole={wholeSliceOf(sec, secClipCast, soloVoice, it)}
                        onPlayingChange={(on) => {
                          setSpeakingKey(on ? k(it, i) : null)
                          if (!on) setReadingAt(null)
                        }}
                        onWord={(w) => setReadingAt(w ? w.charIndex : null)}
                      />
                    ))
                  )}

                  {/* 解答は「全部出す」と「この問だけ出す」の両方から開ける。
                      レッスンで1問ずつ答え合わせをするために、問ごとが要る。 */}
                  {(it.answer || it.audio_text || (secIsPassage && it.prompt_ja)) && (
                    <button type="button" className="btn btn--small lesson-reveal"
                            aria-expanded={isOpen(k(it, i))}
                            onClick={() => toggleItem(k(it, i))}>
                      {secIsPassage
                        ? (isOpen(k(it, i)) ? '訳を隠す' : '訳を見る')
                        : (isOpen(k(it, i)) ? '解答を隠す' : '解答を見る')}
                    </button>
                  )}

                  {isOpen(k(it, i)) && (
                    <>
                      {/* リスニングは英文を見せずに聞かせる。答え合わせでは
                          **読み上げた英文そのもの**を出す。何を言われたのかが
                          分からないと、直しようがない(2026-08 の指摘)。 */}
                      {secType?.hidePromptFromLearner && it.audio_text && (
                        <div className="lesson-heard">
                          <span className="lesson-heard-label">読み上げた英文</span>
                          <span lang="en">{it.audio_text}</span>
                        </div>
                      )}
                      {/* 解答も**語に触れれば意味が出て、単語帳に入れられる。**
                          訳と読み上げも付く(2026-09 利用者の指定)。
                          **解答を開いたあとにだけ出る**ので、
                          答えが先に耳から入ることはない */}
                      <AnswerEn
                        text={it.answer} ja={it.answer_ja} level={material.level}
                        statuses={wordStatuses} onMark={markWord}
                        className="lesson-answer" jaClassName="lesson-ja"
                        voice={voiceFor(secCast, it.speaker)}
                        clipVoice={voiceFor(secClipCast, it.speaker, soloVoice)}
                        tier={secTier} rate={rateOf(rateId)}
                      />
                      {it.answer_alt && <div className="lesson-note">別解: {it.answer_alt}</div>}
                      {it.note && <div className="lesson-note">{it.note}</div>}
                    </>
                  )}
                </li>
              ))}
            </ol>
          </section>
    )
  }
}
