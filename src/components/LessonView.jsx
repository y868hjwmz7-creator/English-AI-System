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
  countLabel, countUnit, exerciseType, isPassageSection, noteIsAnswer, sectionLabel,
} from '../data/exerciseTypes.js'
import AiNote from './AiNote.jsx'
import { weaknessTagLabel } from '../data/weaknessTags.js'
import { printElement } from '../lib/print.js'
import { loadEnglishVoices } from '../lib/speech.js'
import { stopReading } from '../lib/readAloud.js'
import { voiceTierFor } from '../lib/voiceTier.js'
import { castClipSpeakers, castVoices, voiceFor } from '../lib/voiceCast.js'
import { audioTextOf, wholeSliceOf } from '../lib/audioPlaylist.js'
import { resolveVoices } from '../data/clipVoices.js'
import { SPEECH_RATES, loadRateId, rateOf, saveRateId } from '../lib/speechRate.js'
import {
  BoltIcon, FocusIcon, GearIcon, NoteIcon, PenIcon, PrintIcon,
  SpeakerIcon, StepsIcon, StopIcon,
} from './Icons.jsx'
import FocusFrame from './FocusFrame.jsx'
import GrammarNote from './GrammarNote.jsx'
import FocusReader from './FocusReader.jsx'
import InkLayer from './InkLayer.jsx'
import LessonNotes from './LessonNotes.jsx'
import { loadMyLearners } from '../lib/materials.js'
/* **文法解説を出すかどうかの判断は `grammarNote.js` 1か所**(0051)。
   画面で `item.grammar` を直に見ない */
import { grammarFull, grammarOf } from '../lib/grammarNote.js'
/* 書き込みの色・道具・太さは `src/data/inkTools.js` 1か所。
   **集中モードでも同じものを出す**ので、ここには持たない */
import { INK_COLORS, INK_TOOLS, INK_WIDTH } from '../data/inkTools.js'
import { viewerRoleOf } from '../lib/viewer.js'
import { NAV_PUSH_AT, useWide } from '../lib/nav.js'
import EnglishText from './EnglishText.jsx'
import { prefetchGlosses } from '../lib/vocab.js'
import { markIn } from '../lib/useWordStatuses.js'
import SessionOwner from './SessionOwner.jsx'
import MaterialTitle from './MaterialTitle.jsx'
import CastChip from './CastChip.jsx'
import QuickResponse from './QuickResponse.jsx'
import QuickResponseSheet from './QuickResponseSheet.jsx'
import PassagePractice from './PassagePractice.jsx'
import { hasQuickResponse } from '../lib/quickResponse.js'
import SpeakButton, { preparingLabel } from './SpeakButton.jsx'
import AnswerEn from './AnswerEn.jsx'
import WritingAnswer from './WritingAnswer.jsx'
import PhraseChips from './PhraseChips.jsx'
import Phonetic from './Phonetic.jsx'
import Stepper from './Stepper.jsx'
import PlayerBar from './PlayerBar.jsx'
import useBodyAudio from '../lib/useBodyAudio.js'
import { FIT_STAGES, overWrapping, useFitRow } from '../lib/fitRow.js'
import { PLACES, PLACE_TO, nextPlace, placeFor } from '../lib/playerPlace.js'
import useDragBox from '../lib/dragBox.js'
import { lockScroll } from '../lib/scrollLock.js'

/** 本文のときだけ ◀ ▶ で挟む。**呼ぶ側に条件を書き散らさない** */

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
    return PLACES.includes(v) ? v : 'bar'
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

/**
 * 帯が1行に収まっていないか。
 *
 * **書き込みのあいだは測らない。** あのときは帯がまるごと道具に
 * 入れ替わっており(`.lesson-ink`)、**あちらは折り返してよい**
 * 作りになっている。測ると、意味のない詰めが入る。
 */
const barOverflows = (row) =>
  (row.classList.contains('is-inking') ? false : overWrapping(row))

export default function LessonView({
  material, onClose,
  // ゲストが開いたときは「知っていた / 知らなかった」も付けられる。
  // トレーナーが開いたときは意味を見るだけ(申告はゲスト本人のもの)
  wordStatuses = null, onMarkWord = null,
  /** 誰の学習として残すか(0025)。レッスン中のゲスト / 自分 */
  learnerId = null,
  /** 相手の名前。**帯の名札に出すだけ**(引きに行かせない) */
  learnerName = '',
  /**
   * **相手を切り替えたときの知らせ**(第5.178節)。
   *
   * **これが渡されているときだけ、帯の名札が押せる。**
   * 受け止める親がいなければ切り替えても表示(色)がついてこないので、
   * **判断はこの1つ**にしてある(`learnerId` の有無では決めない)。
   */
  onLearnerChange = null,
}) {
  /**
   * **いま、誰の記録として残るか**(第5.178節・2026-09 利用者の指摘)。
   *
   *   > 明らかに他のゲストが登録した単語などが入っていることがあります。
   *   > しっかり分けて管理する体制にしてください。
   *
   * 語も Quick Response もセッションの記録も、**この1つで決まる。**
   * 3つ別々に持つと、**片方だけ別の人のものになる**(CLAUDE.md)。
   */
  const owner = learnerId ?? null
  /* **どの教材で会ったかを添える**(0024)。単語帳を教材名で絞るのに要る。
     語に触れる場所は多いので、**教材が分かるここで1回だけかぶせる** */
  const markWord = markIn(onMarkWord, material?.id, owner)
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
   * **帯は、入るまで詰める**(2026-09 実機・利用者の指摘
   * 「またずれました。直して下さい」)。
   *
   * 帯は**幅の境目**(1380px)で操作盤を出し入れしていた。ところが
   * 実測すると、操作盤を入れた帯は **1403px** 要る。**23px 足りない。**
   * しかも端末の「表示を大きく」で文字が 1.25 倍になると **1514px** 要る
   * ので、1440px のパソコンでも2行になっていた。
   *
   * **幅から当てるのをやめる**(`useFitRow`・第5.94節)。
   * 実際にあふれているかを測り、入るまで印を1つずつ足す。
   * 何を削るかは `styles.css` が持つ(ここに px を書かない)。
   *
   * **折り返す帯なので `overWrapping` を渡す。** ふつうの `over()` は
   * `scrollWidth` を見るが、**折り返す箱はあふれない**ので気づけない。
   */
  const barRef = useRef(null)
  useFitRow(barRef, FIT_STAGES, barOverflows)
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
   * いまは**ボタンは必ず出す。** 相手は、紙のすぐ上の名札
   * (`SessionOwner`・第5.178節)で選ぶ —— **同じことをするものを
   * 2つ見せない**(CLAUDE.md)。あの名札は語と Quick Response の
   * 行き先でもあるので、**3つが同じ人のものになる。**
   * 選べる相手は「自分の担当ゲスト」だけである(RLS がそれ以外を断る)。 */
  const canNote = viewerRoleOf() === 'trainer' || viewerRoleOf() === 'owner'
  /**
   * 選ぶための担当ゲスト。**帯の名札を押したときに1回だけ読む。**
   *
   * `null` は「まだ読んでいない」で、`[]` は「担当がいない」である ——
   * **0 と `null` を取り違えない**(CLAUDE.md)。名札の側が書き分ける。
   */
  const [people, setPeople] = useState(null)
  const [wantPeople, setWantPeople] = useState(false)
  useEffect(() => {
    if (!wantPeople || people) return undefined
    let alive = true
    loadMyLearners().then(({ data }) => { if (alive) setPeople(data ?? []) })
    return () => { alive = false }
  }, [wantPeople, people])
  openSettingsRef.current = openSettings
  // 通しの練習を出しているか。
  // null / 'qr'(Quick Response)/ 'six'(6Steps)/ 'focus'(集中モード)。
  // **教材1本 / 本文1本を通しでやる**ので、出しているあいだは
  // ページ送りと解答のボタンを出さない(効かないため)
  const [run, setRun] = useState(null)
  /**
   * **文型ドリルの集中モードで、いま何問めか**(第5.208節・2026-09 利用者の指定)。
   *
   *   > いつの間にか文系トレーニングから集中モードが消えています
   *
   * **覚えない。** 開くたびに1問めから始める ——
   * ドリルは頭から順に解くもので、途中から始める人はいない
   * (本文の集中モードが `focusAt` を覚えているのとは、役目が違う)。
   */
  const [drillAt, setDrillAt] = useState(0)
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
   * **段落ごとの Listen は 2026-09 に廃止した**(利用者の指定
   * 「段落ごとの listen も全てのデバイスで廃止にしましょう」)ので、
   * 閉じたままだと**鳴らす道が画面から消える。** 開けておく。
   * **行き止まりにはならない** —— 上の帯のスイッチで開き直せる。
   *
   * **`true` にしても、広い画面には効かない。** あちらは `spot` が
   * 決めており、この値は `!fitsInBar` のときしか見ないためである。
   * **集中モードにも出ない** —— `.sheet-floats` は `!run` のときだけ描く。
   */
  const [floatOpen, setFloatOpen] = useState(true)
  /**
   * **パッド以上か**(`NAV_PUSH_AT` = 768px)。**判断は幅だけ。**
   *
   * ここが偽(= スマホ)のときは、**浮かせる道そのものを持たない**
   * (2026-09 実機・利用者の指定「フロートさせると機能を無くして」)。
   * `spot` より先に要るので、ここで出しておく。
   */
  const padUp = useWide(NAV_PUSH_AT)
  /**
   * 実際にどこへ出すか。**判断は `placeFor()` 1か所**(`playerPlace.js`)。
   *
   * **狭い窓に「上の帯」は無い**(1380px より狭いと1行に収まらない)。
   * そこでは**画面の下の黒帯**が既定で、
   * **パッド以上でだけ**浮かせることもできる
   * (2026-09 利用者の指定「スマホ…画面下部に黒帯にした中に固定に。
   * パッドでもデフォルトは同じ仕様で、任意でフロート型にして移動できる
   * ように」/「スマホでは狭すぎて意味がありません」)。
   *
   * **スマホでは、覚えている値によらず黒帯**である。
   * 切り替えのボタンも出ない(`nextPlace()` が `null` を返す)ので、
   * **戻す道が無くなることも、浮いた錠剤の下に隙間が残ることもない。**
   */
  const spot = placeFor(place, fitsInBar, padUp)
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
  /* **書き込みのあいだは、必ず右下に出す**(2026-09 利用者の指定)。

       > 書き込みモードを起動したら、プレーヤーは自動的にフロートに
       > なるようにしてください。

     書き込み中は**帯がまるごと道具に入れ替わる**ので、上の帯に入れて
     いた操作盤は**そのまま消えていた。** 線を引きながら聴きたいのに、
     止める場所も送る場所も無くなる。**行き止まりを作らない。**
     書き込みを終えれば、覚えている置き場所へ戻る(値は書き換えない)。 */
  /**
   * 操作盤が**紙の外(画面の下の黒帯、または浮いた錠剤)に出ているか。**
   *
   * 狭い窓では、上の帯のスイッチ(`.player-launch`)で開け閉めする。
   * 書き込みのあいだは、帯がまるごと道具に入れ替わるので**必ず出す。**
   *
   * **もとは「段落ごとのプレーヤーとの入れ替え」も兼ねていた**が、
   * 段落ごとは 2026-09 に廃止した(利用者の指定)。
   * いまは**操作盤をどこに描くか**だけを決める。
   */
  const outside = spot !== 'bar' && (fitsInBar || floatOpen || pen)
  /** 書き込み中に上の帯へ入れていたら、行き場が無くなる。**画面の下へ逃がす** */
  const shownSpot = pen && spot === 'bar' ? 'dock' : spot

  /* ── 浮かせた箱は、つまんで動かせる(2026-09 利用者の指定)──────────
       > PCの画面でもフロートにした時は端っこにドラッグできる部分を作って
       > 移動させれるようにしたいです

       > 移動式のプレーヤーは、PCやパッドでは残しましょう。
       > スマホでは狭すぎて意味がありません。

     **動かすのは箱ぜんぶ**(`.sheet-floats`)。中には「集中モード」も
     並んでいるので、操作盤だけを動かすと**別々に `fixed` で置く**ことに
     なり、片方が消えたときにもう片方が飛ぶ(CLAUDE.md)。

     **スマホには、そもそも浮かせる道が無い**(`placeFor` が黒帯に落とす)
     ので、ここも自然につまみが出ない。`padUp` は上で出してある。 */
  const floatsRef = useRef(null)

  /* ── 置き場所の切り替え。**行き先と押したときを、1組で持つ** ────────
       出す場所は3つ(上の帯 / 黒帯 / 浮かせたもの)ある。
       書き写すと必ずどこかだけ古くなるので、ここで1度だけ決める。

       **`placeNext` が `null` なら、ボタンごと出ない**(`PlayerBar`)。
       スマホは黒帯しか無いので、そこが `null` になる ——
       **効かない操作を見せない。** */
  const placeNext = PLACE_TO[nextPlace(spot, fitsInBar, padUp)] ?? null
  const movePlayer = () => {
    const v = nextPlace(spot, fitsInBar, padUp)
    if (!v) return          // 行き先が無い(スマホ)。何もしない
    setPlace(v); savePlace(v)
  }
  const drag = useDragBox(floatsRef, { enabled: shownSpot === 'float' && padUp })

  /* ── **「用意しています…」は、操作盤には出さない**(2026-09 利用者の指定)

       まずスマホだけで外し、そのあと**どの端末でも**外した。

       > プレイヤーの再生ボタンを押した際にいちいち用意していますと
       > 切り替えで表示されるとその度にプレイヤーの幅が広がり、
       > そしてすぐ元に戻るので、単語などが連続で再生される時に
       > 見ていて目が疲れます。これもスマホでは排除してください

       > どのデバイスでも段落送りをした時に再生ツールに「用意しています」が
       > 表示されて幅が広くなると、連続で押すときに押しにくいです。
       > 全てスマホと同じ、幅が変わらない仕様にして下さい

     実測(押すボタンの幅)。**どの端末でも伸びる。**

       | 幅 | 押す前 | 用意しています… | 用意中 N 秒 |
       |---|---|---|---|
       | スマホ 390px | **30px** | **141px** | 104px |
       | パッド 820px | 123px | **149px** | 112px |
       | PC 1200px | 123px | **149px** | 112px |

     しかも黒帯は**まん中寄せ**なので、伸びると**両隣もそのつど横へ動く。**
     段落を続けて送ると、押すたびに ◀ ▶ が左右に逃げる。

     **「音が出るまで何も起きていないように見える」への答えは残っている** ——
     絵がスピーカーから Stop に変わる(**幅は1px も動かない**)。
     文言は `PlayerBar` が持たない形にしたので、
     ここで組み立てるものも無い(**判断も文言も、1か所に無い = 事故が無い**)。

     **段落ごとの Listen には、これまでどおり出す**(言われた場所だけを直す)。
     あちらは押しっぱなしにするボタンではない。 */

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

  // 開いているあいだは、後ろの画面を動かさない(鍵は `scrollLock.js` 1か所)
  useEffect(() => lockScroll(), [])

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

  /* ══════════════════════════════════════════════════════════════
     **フックは、早い `return` より前に置く**(第5.223節)。

     React はフックを「何番目に呼ばれたか」で数える。
     `if (!material) return null` の**後ろ**に置くと、
     **教材が無いときと有るときでフックの数が変わり、画面がまるごと
     落ちる**(Rendered more hooks than during the previous render)。

     実際に「今週の宿題」でそれが起き、**画面が真っ白になった**
     (第5.220節)。ここは**たまたま落ちていなかっただけ**である ——
     呼ぶ側が `material` を持った状態でしか置いていないためで、
     `null` のまま一度でも置かれれば、同じように落ちる。

     **たまたまに頼るのをやめる。** 中身は1行も変えていない。
     ══════════════════════════════════════════════════════════════ */

  /**
   * ── **文法解説を、集中モードでなくても見られるようにする**
   *    (第5.209節・2026-09 利用者の指定)────────────────────
   *
   *   > 文法を見るのはそもそも集中モードでない場所で見れませんか?
   *   > もし変更を加えるなら全ての場所で同じようにしてください。
   *
   *   これまで文法解説は**本文の集中モード(`FocusReader`)の中だけ**に
   *   あった。紙の上からは開けないので、**開くために集中モードへ入る**
   *   必要があった。
   *
   *   ここは**トレーナーの教材もゲストの教材も、同じ `LessonView`**が
   *   描いている。だからここに置けば、**全ての場所で同じ**になる。
   *
   *   **解答とは別に覚える。** 答えを見ずに文法だけ見たいことがある。
   */
  const [gramItems, setGramItems] = useState(() => new Set())
  const gramOpen = (k) => gramItems.has(k)
  const toggleGram = (k) => {
    const next = new Set(gramItems)
    if (next.has(k)) next.delete(k)
    else next.add(k)
    setGramItems(next)
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
   * **1問ずつ出せるページか**(第5.208節・2026-09 利用者の指定)。
   *
   *   > いつの間にか文系トレーニングから集中モードが消えています
   *
   * 文型ドリル・単語・フレーズには**読む本文が無い**ので、
   * 本文を読む集中モード(`FocusReader`)には入れない。
   * 消したままにすると**行き止まり**なので、代わりに
   * **そのページの設問を1問ずつ**出す。
   *
   * **本文のページは、ここに入れない** —— あちらは `passageSection` が
   * 受け持つ(**判断を2か所に置かない**・CLAUDE.md)。
   */
  const drillable = !!section && !isPassageSection(section.exercise_type)
    && (section.items?.length ?? 0) > 0
  /* **ページの外へは出さない。** ページが変わっても、番号はそのページの中に収める
     (**黙って落ちない**・CLAUDE.md) */
  const drillNow = drillable
    ? Math.min(Math.max(0, drillAt), section.items.length - 1) : 0
  /* 添削のときに窓口へ渡す本文(**参考**)。何について書いているのかが
     分からないと、話の中身に合った直し方ができない */
  const bodyText = (passageSection?.items ?? [])
    .map((x) => String(x?.prompt_en ?? '').trim()).filter(Boolean).join('\n\n')

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

  const openFocus = () => {
    /* **鳴っている音は止めない**(2026-09 利用者の指定)。

         > 再生中に集中モードに入ったとしても、
         > 再生中の音はそのまま続くようにして下さい。

       以前はここで `stopAll()` を呼んでいたので、**入った瞬間に黙って**
       いた。聴きながら語を調べたいのだから、切る理由がない。
       止めたいときは、集中モードの Listen を押せば入れ替わる。 */
    backTo.current = sheetRef.current?.scrollTop ?? null
    setFocusAt(centeredFocusIndex())
    setRun('focus')
  }

  /**
   * **その英文の語を調べる行き先**(第5.212節・2026-09 実機の指摘)。
   *
   *   > 文系トレーニングで単語を調べようとしても
   *   > 集中モードへの誘導が表示されません
   *
   * 【なぜ出なかったか】
   *   狭い画面では、語を押せなくしてある —— 語のタップと画面送りが、
   *   同じ指の動きから始まるためである。代わりに**長押しすると
   *   「集中モードで調べられます」の案内**を出す。
   *
   *   ところがその案内は `onNeedFocus` があるときにしか出さず、
   *   こちらは**本文のときだけ**渡していた。
   *   第5.208節で**ドリルにも集中モードができた**のに、
   *   こちらを合わせていなかったので、
   *   文型ドリルでは**長押ししても何も出ず**、
   *   iPhone の「コピー / Google で検索」だけが出ていた。
   *
   * 【判断はここ1か所】
   *   英文が出る場所は、このカードだけで3つある
   *   (本文 / 設問 / 解答)。**画面のあちこちで
   *   `isPassageSection(...) ? … : …` と書かない** ——
   *   置く場所の数だけ食い違う(CLAUDE.md)。
   *
   *   **右下の「集中モード」ボタンと、まったく同じ行き先**にしてある。
   *   ボタンで入るところと、案内で入るところが違っては困る。
   *
   * @param sec その演習
   * @param i   その問が、演習の何番めか(**その問から開く**)
   * @returns 行き先。無ければ `null`(**行き先が無いのに誘わない**)
   */
  const focusFor = (sec, i) => {
    if (!sec) return null
    // 本文(記事・会話)は、これまでどおり本文を読む集中モードへ
    if (isPassageSection(sec.exercise_type)) return openFocus
    // 本文が無い教材は、**その問**を1問ずつ出す(第5.208節)
    if (!(sec.items?.length > 0)) return null
    return () => { stopAll(); setDrillAt(i); setRun('drill') }
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
      <button type="button" className="btn btn--small btn--quiet"
              onClick={() => printElement(document.getElementById('lesson-sheet'))}>
        <PrintIcon />印刷
      </button>
    </>
  )

  /**
   * 通しで鳴らせるもの(色を付ける目印つき)。
   *
   * **本文だけではない**(2026-09 利用者の指定
   * 「文型トレーニングに上のバーのプレーヤーが出ません。
   *   どんなトレーニングでも出るようにして下さい」)。
   *
   * 以前はここで `prompt_en` を直に見ていたので、
   * **和文英訳(読むのは `answer`)もリスニング(`audio_text`)も
   * 内容の理解(`question`)も、1本も拾えなかった。**
   * どの欄を読むかは **`audioFrom` 1か所**が決める(`audioTextOf`)。
   *
   * **誤り訂正と穴埋ては空になる**(`audioFrom: null`)。
   * 誤った英文を手本として聞かせられないので、そこには
   * 操作盤そのものが出ない —— **効かない操作を見せない。**
   *
   * **番号は元の並びで振る。** 先に `map` してから絞るのは、
   * 目印(`key`)が **`section.items` の中の何番目か**で決まるためである。
   * 絞ってから振ると、空の項目がある教材で色が別の行に付く。
   */
  const playableAll = (section?.items ?? [])
    .map((it, i) => ({ it, key: key(it, i), text: audioTextOf(it, section?.exercise_type) }))
    .filter((x) => x.text)

  /**
   * 操作盤を出すか。**「本文かどうか」では決めない**(2026-09 利用者の指定)。
   *
   * 鳴らせるものが1つでもあれば出す。そうすれば、演習を1つ足すたびに
   * ここを書き足す必要がない(**判断を2か所に置かない**)。
   */
  const canPlayAll = playableAll.length > 0

  playRef.current = playableAll

  /**
   * 本文を通して読み上げる。話す人が変わると声も変わる。
   *
   * **持ちものは `useBodyAudio` にある。** ここで渡すのは
   * 「何を・どの声で・どの速さで」だけである。
   */
  const playOpts = (startIndex = null) => ({
    parts: playableAll.map(({ it, text }) => ({
      text,
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
    /* **黒帯のぶん、紙の下に余白を足す**(下記の CSS)。
       足さないと、いちばん下の段落が帯に隠れて読めない */
    <div className={`lesson${
      canPlayAll && outside && shownSpot === 'dock' && !run ? ' lesson--dock' : ''}`}
         role="dialog" aria-label="セッションで使う表示">
      {/* 操作するところ。共有される側にも見えるが、紙の外に置く */}
      <div className={`lesson-bar no-print${pen ? ' is-inking' : ''}`} ref={barRef}>
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
            <button type="button" className="btn btn--small btn--ghost"
                    disabled={!(ink[page] ?? []).length}
                    onClick={() => setInk((m) => ({ ...m, [page]: (m[page] ?? []).slice(0, -1) }))}>
              ひとつ戻す
            </button>
            <button type="button" className="btn btn--small btn--ghost"
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
        <button type="button" className="btn btn--small btn--ghost"
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
              <button type="button" className="btn btn--small btn--ghost"
                      disabled={page === 0} aria-label="前のページ"
                      onClick={() => { setPage(page - 1); resetItems() }}>◀</button>
              <span>{page + 1} / {sections.length}</span>
              <button type="button" className="btn btn--small btn--ghost"
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
            {canPlayAll && !fitsInBar && (
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

        {/* ── 集中モード。**狭い画面では、ここに置く**(2026-09 実機・利用者の指定)

              > スマホでのこの集中モードの位置はダメです。
              > 画面上部のバーに収める方が良くないですか?
              > 再生プレーヤーが2行になるのは絶対にダメです

            右下では操作盤と場所を取り合い、**操作盤を2行に折らせていた。**
            帯なら絵1つぶんで収まる(320px でも1行のまま)。

            **広い画面ではこれまでどおり右下**(利用者の指定
            「常に右下にも固定してください」)。**同時には出さない** ——
            出し分けは CSS の幅だけで決める(`.lesson-focus`)。 */}
        {passageSection && !run && (
          <button type="button" className="btn btn--small lesson-focus"
                  aria-label="集中モード" onClick={openFocus}>
            <FocusIcon />
          </button>
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
          {canPlayAll && shownSpot === 'bar' && fitsInBar && (
            <PlayerBar
              place="bar"
              placeNext={placeNext}
              onPlace={movePlayer}
              playing={playingAll}
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
          {/* **言葉は `.mid-text` に入れておく。** 帯が入らないときは
              絵だけになる(`.lesson-bar.is-fit2`)。絵は別物なので
              取り違えないが、**`aria-label` は必ず添える** */}
          <button type="button" className="btn btn--small btn--quiet"
                  aria-label="印刷 / PDFで保存"
                  onClick={() => printElement(document.getElementById('lesson-sheet'))}>
            <PrintIcon /><span className="mid-text">印刷</span>
          </button>
        </div>

        </>
        )}
      </div>

      {/* **いま誰の記録として残るか**(第5.178節・2026-09 利用者の指摘)。

              > 明らかに他のゲストが登録した単語などが入っていることがあります。
              > しっかり分けて管理する体制にしてください。

          **帯の中には置けなかった。** 320px の帯は
          「閉じる31 + ページ送り103 + 3つの絵38×3 + すき間50 = 324px」で
          すでに満杯で、札を入れると **26px まで潰れて読めない**(実測)。
          読めない名札は、無いのと同じである。

          **だから帯のすぐ下に、1行まるごと使って出す** ——
          押すところ(切り替え)と読むところ(名前)を分けた第5.176節と
          同じ考え方で、こちらは**どの幅でも潰れない。**

          ゲストには出さない —— 相手は自分しかいないので、
          **効かない操作になる**(CLAUDE.md)。
          押せるのは、受け止める親がいるとき(教材の画面)だけである */}
      {canNote && (
        <SessionOwner
          learnerId={owner} name={learnerName} people={people}
          onPick={onLearnerChange}
          onOpen={() => setWantPeople(true)} />
      )}

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
          {/* ── 誰がどの声で読むか(2026-09 利用者の指定)────────────
                > 各教材のトップにスピーカーが確認できるタブをつけてください

              **置き場所は、右下**(2026-09 実機・利用者の指定)。

                > このタイトルの上の「読み上げの声」の位置ですが、
                > 右の方の日付の下の方にもう少し控えめにおいてくれませんか

              はじめは**教材名の上**に置いていたので、
              **いちばん先に目が行っていた。** ふだん読むものではないので、
              日付と同じ右側へ寄せ、字も一段落として静かに置く。
              話す人がいない教材(記事・ドリル・単語)では出ない。
              **紙には刷らない**(`no-print`)—— 記事・会話の紙は
              「書き込むための用紙」で、中身は決まっている(仕様書 5.70) */}
          <CastChip material={material} className="cast-chip--quiet" />
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
            {(passageSection || qr || drillable) && (
              <button type="button"
                      className={`btn btn--small${
                        run === 'focus' || run === 'drill' || (run === 'six' && sixFocus)
                        || (qr && qrFocus) ? ' btn--primary' : ''}`}
                      aria-pressed={run === 'focus' || run === 'drill'
                        || (run === 'six' && sixFocus) || (qr && qrFocus)}
                      onClick={() => {
                        // 6Steps の最中は、**その取り組み方**を1つずつ出す
                        if (run === 'six') { setSixFocus((v) => !v); return }
                        /* Quick Response の最中は、**その1問**を画面に固定する
                           (2026-09 実機「違うトレーニングになってしまいます」)。
                           ここで `openFocus()` を呼ぶと、本文を読んで語を調べる
                           画面へ飛ばされる — それが報告された不具合である */
                        if (qr) { setQrFocus((v) => !v); return }
                        if (run === 'focus' || run === 'drill') {
                          stopAll(); setRun(null); return
                        }
                        /* **本文がある教材は、これまでどおり本文を読む集中モード。**
                           内容理解のページを開いていても、本文へ入る
                           (2026-09 利用者の指定「KENJI が画面の中心に来ている時は
                           ②KENJI の集中モードに入り…」)。**ここは変えない** */
                        if (passageSection) { openFocus(); return }
                        /* **本文が無い教材**(文型ドリル・単語・フレーズ)は、
                           **いま開いているページの設問**を1問ずつ出す(第5.208節) */
                        setDrillAt(0)
                        setRun('drill')
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
        {(passageSection || canPlayAll) && !run && (
          <div
            ref={floatsRef}
            /* つまんでいるあいだ、指が箱の外へ出ても追いかける
               (`setPointerCapture` はつまみに付けてある) */
            onPointerMove={drag.enabled ? drag.onMove : undefined}
            onPointerUp={drag.enabled ? drag.onDrop : undefined}
            onPointerCancel={drag.enabled ? drag.onDrop : undefined}
            style={drag.style}
            /* **黒帯に隠されないよう、そのぶん上へ逃がす** */
            className={`sheet-floats no-print${
              outside && shownSpot === 'dock' ? ' is-above-dock' : ''}`}
          >
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
            {canPlayAll && outside && shownSpot === 'float' && (
              <PlayerBar
                place="float"
                /* **狭い窓でも切り替えを出す**(2026-09 利用者の指定
                   「パッドでも…任意でフロート型にして移動できるように」)。
                   行き先は `nextPlace()` が決める(判断を2か所に置かない) */
                placeNext={placeNext}
                onPlace={movePlayer}
                onGrab={drag.onGrab} moved={drag.moved} onResetPos={drag.reset}
                playing={playingAll}
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
            {/* **狭い画面では、ここには出さない**(2026-09 実機・利用者の指定)。

                  > スマホでのこの集中モードの位置はダメです。
                  > 画面上部のバーに収める方が良くないですか?
                  > 再生プレーヤーが2行になるのは絶対にダメです

                操作盤と場所を取り合い、**操作盤を2行に折らせていた。**
                狭い画面では上の帯へ移してある(`.lesson-focus`)。
                消すのは CSS の幅だけで、**同時に2つは出ない** */}
            {/* **集中モードは本文だけ。** ドリルには読む本文が無いので、
                ここに出しても行き止まりになる(効かない操作を見せない)。
                以前は囲みそのものが本文のときしか描かれなかったので、
                この判定は要らなかった —— 操作盤を**どの演習でも**出すように
                した日(2026-09)に、こちらへ移した */}
            {passageSection && (
              <button type="button" className="btn btn--small sheet-float"
                      onClick={openFocus}>
                <FocusIcon />集中モード
              </button>
            )}
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
            materialId={material.id} learnerId={owner}
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
            learnerId={owner}
            tags={allTags} voiceIds={material.voiceIds} level={material.level}
          />
        ) : run === 'drill' && drillable ? (
          /* ── **本文が無い教材の集中モード**(第5.208節・2026-09 利用者の指定)──
           *
           *   > いつの間にか文系トレーニングから集中モードが消えています
           *
           *   文型ドリル・単語・フレーズには読む本文が無いので、
           *   **いま開いているページの設問を1問ずつ**出す。
           *
           *   **設問の描き方は作り直さない。** 紙と同じ `renderSection()` に
           *   「その1問だけ」を頼む —— 書き写すと、**片方だけ古くなる**
           *   (CLAUDE.md「同じものを2つ作らない」)。
           *   だから Listen も、解答も、語をタップして意味を見るのも、
           *   **紙とまったく同じもの**が出る。 */
          <FocusFrame
            width={width} learnerId={owner}
            /* **送るたびに変える。** 書き込みの線を、問ごとに分けるため */
            page={`drill-${page}-${drillNow}`}
            scrollKey={`${page}-${drillNow}`}
            /* 速さ・文字・幅・印刷。**3つの集中モードで同じもの** */
            settings={focusSettings}
            onClose={() => setRun(null)}
            top={(
              <span className="focus-count">
                {drillNow + 1} / {section.items.length} 問
              </span>
            )}
            /* **送りは下の帯に。** `StepFocus` と同じ形にそろえる
               (同じことをするものを、別の見た目で出さない) */
            bar={(
              <>
                <button type="button" className="btn focus-move"
                        onClick={() => setDrillAt(Math.max(0, drillNow - 1))}
                        disabled={drillNow === 0}>
                  ◀ 前
                </button>
                <div className="focus-mid" />
                <button type="button" className="btn focus-move"
                        onClick={() => setDrillAt(Math.min(section.items.length - 1, drillNow + 1))}
                        disabled={drillNow >= section.items.length - 1}>
                  次 ▶
                </button>
              </>
            )}>
            {renderSection(section, page, drillNow)}
          </FocusFrame>
        ) : qr ? (
          <QuickResponse material={material} paper learnerId={owner}
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

        {/* **AI が作っていることを、教材の中で1行だけ言う**
            (2026-09 利用者の問い「音声や教材を『AIで作成してます』という
            注意書きはいらないのか？」)。

            **読むもののそばに置く** —— 変な英文に出会ったその場で、
            トレーナーに訊けばよいと分かる。画面のいちばん上に居座る帯は、
            まさにこの回で外したところなので、**作り直さない。**
            文言は `AiNote.jsx` 1か所(出す場所は2つある) */}
        <AiNote />

        {/* Quick Response の控え。**紙のいちばん後ろに置く**
            (2026-09 利用者の指定「ページは一番後ろで大丈夫です」)。
            画面には出さない(`print-only`)。練習は上のボタンから行う */}
        <QuickResponseSheet material={material} />
      </div>

        {/* ── 画面の下の黒帯(2026-09 利用者の指定)────────────────────
              > いっそのこと画面の下部に黒帯にした中に固定にした方が
              > スタイリッシュな気がします。パッドでもデフォルトは同じ仕様で

            **右下に浮く錠剤ではなく、横いっぱいの帯にする。**
            浮いた錠剤は場所が足りず、`useFitRow` で言葉を削って収めていた
            (削るほど何のボタンか分からなくなる)。横いっぱいなら、
            **削る理由がそもそも無い。**

            **`.sheet-floats` の外に置く。** あちらは右下に固定した箱で、
            こちらは画面の下いっぱいである。中に入れると幅を取り合う。 */}
        {canPlayAll && outside && shownSpot === 'dock' && !run && (
          <div className="player-dock no-print">
            <PlayerBar
              place="dock"
              placeNext={placeNext}
              onPlace={movePlayer}
              playing={playingAll}
              at={playAt} total={playableAll.length}
              unit={countUnit(section?.exercise_type)}
              onToggle={playWhole} onJump={jumpTo}
              repeat={player.repeat} onRepeat={player.setRepeat}
            />
          </div>
        )}


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
              <button type="button" className="btn btn--small btn--ghost"
                      onClick={() => setNotes(false)}>閉じる</button>
            </div>
            {owner ? (
              <LessonNotes learnerId={owner} bare />
            ) : (
              /* **相手を選ぶ欄は、ここには置かない**(第5.178節)。
                 帯の名札が「誰の記録になるか」を持っており、
                 **同じことをするものを2つ見せない**(CLAUDE.md)。
                 語も Quick Response も記録も、あの1つで決まる */
              <div className="lesson-notes-pick">
                <p className="tip card-hint">
                  いまは<strong>自分の記録</strong>になっています。
                  上の帯の「自分の記録 ▾」でゲストを選ぶと、
                  その人のセッションの記録になります
                  (単語帳と Quick Response も同じ人のものになります)。
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
  /**
   * 1ページぶんを描く。
   *
   * @param only **その1問だけを描く**(第5.208節・文型ドリルの集中モード)。
   *   `null` なら、これまでどおり全部。**番号(`i`)はずらさない** ——
   *   `key()` も `data-key` も番号から作っているので、
   *   詰めると**鳴っている問と印が食い違う**
   */
  function renderSection(sec, si, only = null) {
    if (!sec) return null
    const secType = exerciseType(sec.exercise_type)
    const secIsPassage = isPassageSection(sec.exercise_type)
    /* **ディスカッションと想定される質問には、解答が無い。**
       答え合わせで出したいのは `note`(日本語の手がかり)のほうである
       (`noteIsAnswer`・`exerciseTypes.js` 1か所) */
    const secNoteIsAnswer = noteIsAnswer(sec.exercise_type)
    const secCast = castVoices(voices, (sec.items ?? []).map((it) => it.speaker))
    const secClipCast = castClipSpeakers(
      (sec.items ?? []).map((it) => it.speaker), material.voiceIds,
    )
    const secTier = voiceTierFor({ exerciseType: sec.exercise_type, tags: allTags })
    const k = (it, i) => key(it, i, si)
    /**
     * ── **集中モードでは、幅によらず語を押せる**(第5.209節・2026-09 実機)──
     *
     *   > 文型トレーニングの集中モードで単語の意味を調べられません
     *
     *   `EnglishText` は、**狭い画面ではふだん語を押せなくしている** ——
     *   語のタップと画面送りが、同じ指の動きから始まるためである。
     *   **集中モードには送るものが無い**ので、その喧嘩は起きない。
     *   本文の集中モード(`FocusReader`)は `'always'` を渡しているのに、
     *   **こちらで渡し忘れていた。** 押せないと `<button>` ですらなくなるので、
     *   iPhone では「コピー / Google で検索」が出ていた。
     */
    const tap = only != null ? 'always' : 'auto'
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
    // 練習中(6Steps / Quick Response)は、どのページも画面には出さない。
    // **1問だけのとき**(集中モード)は、その紙そのものを出す
    const open = only != null || (si === page && !run)
    return (
          /* `data-type` は**紙用の目印**(2026-09 利用者の指定)。
             記事・会話の紙は「本文(訳なし)→ 内容理解 → ディスカッション →
             Quick Response」で、語句は出さない。**画面の見た目は変わらない** */
          <section key={sec.id ?? si} className={`lesson-page${open ? '' : ' is-closed'}`}
                   data-type={sec.exercise_type}>
            <h3 className="lesson-section">
              {/* **本文の名前は、種類に合わせる**(2026-09 実機・利用者の指摘)。
                  そのまま出すと Speech練習でも「記事」と書かれる */}
              {sectionLabel(material.kind, sec.exercise_type)}
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
                <button type="button" className="btn btn--small btn--quiet" onClick={playWhole}>
                  {playingAll
                    ? <><StopIcon />{allWaiting ? preparingLabel(allSecs) : 'Stop'}</>
                    : <><SpeakerIcon />Listen (全体)</>}
                </button>
              </div>
            )}

            <ol className="lesson-items">
              {sec.items.map((it, i) => (only != null && i !== only ? null : (
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
                                   /* 狭い画面で語を長押ししたら、調べ方を教える。
                                      **本文のときだけ** — 集中モードは本文を出す画面
                                      なので、ドリルや単語では行き先が無い
                                      (右下の「集中モード」を出す条件と同じ) */
                                   tappable={tap}
                                   /* **行き先は `focusFor()` 1か所が決める**
                                      (第5.212節)。ここで種類を見ない */
                                   onNeedFocus={focusFor(sec, i)}
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
                                   statuses={wordStatuses} onMark={markWord}
                                   tappable={tap}
                                   /* **設問にも誘導を出す**(第5.212節)。
                                      ここには1つも渡していなかったので、
                                      内容の理解・ディスカッション・
                                      リスニングの設問では、狭い画面から
                                      語を調べる道が**どこにも無かった** */
                                   onNeedFocus={focusFor(sec, i)} />
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
                  {/* ── **段落ごとの Listen は、どの端末でも出さない**
                        (2026-09 実機・利用者の指定)

                        > 段落ごとの listen も全てのデバイスで廃止にしましょう

                      もとは**操作盤との入れ替え**だった(浮いていれば隠し、
                      上の帯にしまってあれば出す)。ところが記事は6段落・
                      会話は14発言あるので、**同じものが6組も14組も並ぶ。**
                      操作盤の「◀ 3 / 6 段落 ▶」で同じことができるので、
                      **押すところを1か所に絞る。**

                      **行き止まりにはならない。** 段落を選ぶ道は操作盤に
                      残っており、狭い画面で操作盤を閉じても、
                      上の帯のスイッチでいつでも開き直せる。

                      **本文以外(内容の理解・語句・単語・フレーズ)は
                      これまでどおり。** あちらは「段落」ではなく、
                      1問ずつ聴き比べるためのものである
                      (言われた場所だけを直す)。 */}
                  {/* ── **Listen / 訳 / 文法 は、1つの行にまとめる**
                      (第5.209節・2026-09 利用者の指摘
                       「訳を見たり文法を見るためのボタンもわかりにくすぎます」)。

                      **隙間は `gap` で作る。余白で作らない**(CLAUDE.md)——
                      これまで `.lesson-reveal` が `margin-left` を持っていて、
                      **横に並べる相手が変わると効かなくなる**形だった */}
                  <div className="lesson-acts no-print">
                  {secIsPassage ? null
                    : secType?.audioFrom && it[secType.audioFrom]
                    && playingAll && speakingKey === k(it, i) ? (
                    /* **止めるときも、錠剤のまま**(2026-09 実機・利用者の指定)。

                         > 上部バーのプレーヤーUIで全体の再生を始めると、
                         > 段落ごとのUIが「Stop」しか表示されなくなります。
                         > 上部バーになるのと同じUIをしっかり確保してください。

                       鳴り出した瞬間に**素のボタン1つ**へ変えていたので、
                       1文ずつの ◀ ▶ が消えていた。
                       **いちばん使いたいのは、鳴っているあいだ**である
                       (聞き逃した文へ戻る・先へ飛ばす)。
                       **鳴らす前と後で、形を変えない。** 変わるのは
                       中の言葉(Listen ⇄ Stop)だけにする */
                    <button type="button" className="btn btn--small btn--quiet"
                            onClick={() => { stopAll(); setReadingAt(null) }}>
                      <StopIcon />{allWaiting ? preparingLabel(allSecs) : 'Stop'}
                    </button>
                  ) : secType?.audioFrom && it[secType.audioFrom] && (
                    /* **三角は添えない。** ここへ来るのは本文以外
                       (内容の理解・語句・単語・フレーズ)だけで、
                       1本の音声に入っていないので文で送る先が無い
                       (効かない操作を見せない) */
                    <SpeakButton
                      text={it[secType.audioFrom]}
                      voice={voiceFor(secCast, it.speaker)}
                      clipVoice={voiceFor(secClipCast, it.speaker, soloVoice)}
                      tier={secTier}
                      rate={rateOf(rateId)}
                      /* **区間は渡らない。** 本文以外は1本にまとめた
                         音声に入っていないので、必ず null が返る */
                      whole={wholeSliceOf(sec, secClipCast, soloVoice, it)}
                      onPlayingChange={(on) => {
                        setSpeakingKey(on ? k(it, i) : null)
                        if (!on) setReadingAt(null)
                      }}
                      onWord={(w) => setReadingAt(w ? w.charIndex : null)}
                    />
                  )}

                  {/* 解答は「全部出す」と「この問だけ出す」の両方から開ける。
                      レッスンで1問ずつ答え合わせをするために、問ごとが要る。 */}
                  {(it.answer || it.audio_text || (secNoteIsAnswer && it.note)
                    || (secIsPassage && it.prompt_ja)) && (
                    <button type="button" className="btn btn--small lesson-reveal"
                            aria-expanded={isOpen(k(it, i))}
                            onClick={() => toggleItem(k(it, i))}>
                      {secIsPassage
                        ? (isOpen(k(it, i)) ? '訳を隠す' : '訳を見る')
                        /* **「解答」と書かない。** 正解が無いものに解答は無い */
                        : secNoteIsAnswer
                          ? (isOpen(k(it, i)) ? '手がかりを隠す' : '手がかりを見る')
                          : (isOpen(k(it, i)) ? '解答を隠す' : '解答を見る')}
                    </button>
                  )}

                  {/* ── **文法**(0051・第5.209節・第5.210節)。
                      **解答とは別のボタン** —— 答えを見ずに、
                      文の組み立てだけ確かめたいことがある。

                      **どの欄の英文を解説するかは、演習ごとに違う**
                      (`exerciseTypes.js` の `grammarFrom` 1か所)。
                      誤り訂正なら `answer`(直した英文)、和文英訳も
                      `answer`、リスニングは `audio_text` である。
                      **ここで `sec.exercise_type === '…'` と書かない。**

                      **解説が無い問には出さない**(効かない操作を見せない) */}
                  {(grammarOf(it, sec.exercise_type) ?? []).length > 0 && (
                    <button type="button" className="btn btn--small lesson-reveal"
                            aria-expanded={gramOpen(k(it, i))}
                            onClick={() => toggleGram(k(it, i))}>
                      {gramOpen(k(it, i)) ? '文法を隠す' : '文法を見る'}
                    </button>
                  )}

                  </div>

                  {gramOpen(k(it, i)) && (
                    <GrammarNote sentences={grammarOf(it, sec.exercise_type)} unit="文"
                                 full={grammarFull(it, sec.exercise_type)} />
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
                          答えが先に耳から入ることはない。
                          **読み上げを出すかどうかは `AnswerEn` が決める**
                          (英文和訳の解答は和訳なので出ない・`answerHasAudio()`) */}
                      <AnswerEn
                        text={it.answer} ja={it.answer_ja} level={material.level}
                        statuses={wordStatuses} onMark={markWord}
                        className="lesson-answer" jaClassName="lesson-ja"
                        typeId={sec.exercise_type}
                        voice={voiceFor(secCast, it.speaker)}
                        clipVoice={voiceFor(secClipCast, it.speaker, soloVoice)}
                        tier={secTier} rate={rateOf(rateId)}
                        tappable={tap}
                        /* 解答の語も、同じ行き先で調べられるようにする
                           (第5.212節)。開いてある解答だけに出る */
                        onNeedFocus={focusFor(sec, i)}
                      />
                      {it.answer_alt && <div className="lesson-note">別解: {it.answer_alt}</div>}
                      {it.note && <div className="lesson-note">{it.note}</div>}
                    </>
                  )}

                  {/* ── 書いた答えと、その添削(2026-09 利用者の指定)──
                      **ディスカッションと想定される質問だけ。** あちらは
                      正解が無いので `answer` の欄そのものを持っておらず、
                      **自分で書いてみるまで英語がどこにも出てこない。**
                      内容の理解には足していない(言われた場所だけを直す) */}
                  {secNoteIsAnswer && (
                    <WritingAnswer
                      materialId={material.id} sectionId={sec.id ?? si}
                      itemKey={it.id ?? i}
                      question={it.question} questionJa={it.question_ja}
                      context={bodyText} level={material.level}
                      learnerId={owner}
                      statuses={wordStatuses} onMark={markWord}
                      clipVoice={voiceFor(secClipCast, it.speaker, soloVoice)}
                      tier={secTier} rate={rateOf(rateId)}
                    />
                  )}
                </li>
              )))}
            </ol>
          </section>
    )
  }
}
