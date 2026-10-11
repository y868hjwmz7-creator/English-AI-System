/**
 * ★ **聞き流しを「練習のカードのままの状態」にする**
 *   (第5.445節・②③・2026-10-10 利用者の指摘)。
 *
 * ============================================================================
 * 【何が壊れていたか】
 *
 *   > 単語帳とQuick Responseの聞き流しで、全く違うものが聞き流しに
 *   > 適用されてしまいます。基本的に単語帳で取り組んでいる最中に
 *   > 聞き流しに移行したりするので、そのままのデザインでできないのですか？
 *   > シャッフルやリピートのボタンも消え不便です。
 *   > これではゲストは使い方が分からず悩みます。
 *
 *   聞き流しは**別の画面**(`WordRadio`)だった。そこへ飛ぶと、
 *   練習のカードも、シャッフルも、くり返すも、問数も消えていた。
 *
 *   **画面を分けるのをやめる。** 聞き流しは**カードの上の状態**であって、
 *   行き先ではない。
 *
 * 【決まった形】(2026-10-10 利用者の指定)
 *
 *   > ボタンは四つだけにしつつ、上記の問題を解決する天才的な閃きは
 *   > ないですか
 *
 *   ・**絵は4つのまま。** 5つめを足さない
 *   ・**「聴く」は、いつも1つだけ鳴らして止まる** ——
 *     「純粋にその単語や文を聞きたい時は止めるタイミングなど気を使います」
 *     が、これで消える
 *   ・**流すかどうかは、上の帯のボタン**(いままで「聞き流し」が
 *     あったところ)。流しているあいだは「とめる」になる
 *   ・流しているあいだ、**4つめの絵は ■** になり、金が入る
 *   ・**設定(読み方・間・曲・音量)は、右上の「出しかた」の中**
 *     (2026-10-10 利用者の指定「聞き流しの設定は右上にしましょう」)
 *
 * ============================================================================
 * 【ここが持っているもの】
 *
 *   **鳴らす算段は持っていない** —— それは `playRadioRow()` 1か所である
 *   (第5.445節・①)。**読む順・間の置き方・先読み・声の選び方**は
 *   あちらにあり、聞き流しの画面(`WordRadio`・応答問題の正解)と
 *   **まったく同じものを通る。**
 *
 *   ここが持つのは**回し続けること**だけである ——
 *   1枚鳴り終わったら次へ送り、止められるまで続ける。
 *
 * 【どこまで来たかは、控えで持つ】
 *
 *   **画面を消すと React は描き直さない**(第5.285節)。だから
 *   「次へ送る」は**控え**を動かし、その場で次の行を返す形にしてある ——
 *   送り方の2通り(並びを回す / 番号を進める)は `cardCursor.js` 1か所。
 *
 * 【記録は1ミリも動かさない】
 *
 *   聞き流しは**答える練習ではない**ので、箱も次に出す日も動かさない。
 *   送るのは `cursor` が渡された道だけで、`answer()` は1度も通らない
 *   (もとの `WordRadio` とまったく同じ約束)。
 */
import { useEffect, useRef, useState } from 'react'
/* ★ **鳴らす算段は `playRadioRow()` 1か所**(第5.445節・①) */
import { EMPTY, playRadioRow } from './radioPlay.js'
/* **間は音で置く**(第5.285節)。境目も作り方も `audioClips.js` 1か所 */
import { quietWait } from './audioClips.js'
import { stopReading } from './readAloud.js'
import { setMediaActions, setNowPlaying } from './mediaSession.js'
import { listTracks, setBgmVolume, startBgm, stopBgm } from './bgm.js'
import { bgmPickOf, bgmPlan, loadBgmPick, saveBgmPick } from './bgmPick.js'
import { bgmLevel, setVoiceLevel, voiceLevel } from './mixVolume.js'
import {
  bgmPlaysIn, loadBgmPlace, loadRadioGap, loadRadioMode,
  saveRadioGap, saveRadioMode,
} from './wordRadio.js'

/**
 * **読むものが無い行のあとに、少しだけ譲る長さ**(ミリ秒)。
 *
 * もとの聞き流し(`WordRadio`)と同じ値である。一覧ぜんぶが空だった
 * ときに、画面ごと固まらないようにするためのもの。
 */
const SKIP_MS = 120
/** カードがまだ無いときに、待ってから見直す長さ(ミリ秒) */
const WAIT_MS = 200
/**
 * ★ **カードが出てこないまま、何回まで待つか**(**止まる条件**・CLAUDE.md)。
 *
 * この回を出し切ると、画面は「終わりの一覧」になって**カードが消える。**
 * そのまま流しっぱなしにすると、**誰にも聞こえない回り方**を続ける
 * (しかも上の帯は「とめる」のままで、何も鳴っていない)。
 *
 * **押してから出てくるまでを待てる長さ**にする ——
 * 一覧の下から押した人は、まず読み込みが走る。
 */
const WAIT_MAX = 50

/**
 * @param {object} o
 * @param {object} o.cursor `cardCursor.js` が作ったもの(`now` / `peek` / `go` / `back`)
 * @param {string} o.where  `'word'` / `'qr'`(読み方・間の覚える鍵)
 * @param {number} o.rate   速さ
 * @param {string} o.label  ロック画面に出す題。**画面に出ているものをそのまま**
 * @param {string} o.place  音楽を流す場所の名(`bgmPlaysIn()` に渡す)
 */
export default function useRadioRun({
  cursor, where = 'word', rate = 1, label = '', place = 'radio',
} = {}) {
  const [on, setOn] = useState(false)
  /* **読み方ごとに別に覚える**(第5.251節)。覚える鍵は `wordRadio.js` 1か所 */
  const [mode, setMode] = useState(() => loadRadioMode(where))
  const [gap, setGap] = useState(() => loadRadioGap(where, loadRadioMode(where)))
  /* 曲。**消えた曲を握ったままにしない**(`bgmPickOf` が落とす) */
  const [pick, setPick] = useState(loadBgmPick)
  const [tracks, setTracks] = useState([])
  /* ★ **読めなかった理由**(第5.396節)。**0 曲と取り違えない**(CLAUDE.md) */
  const [tracksError, setTracksError] = useState(null)
  /* 音量。**覚えるのは `mixVolume.js`** —— ここは画面に出すための写しだけ */
  const [voiceVol, setVoiceVol] = useState(voiceLevel)
  const [bgmVol, setBgmVol] = useState(bgmLevel)

  /** 止めるための印。**画面を離れたら、そこで終わる**(止まる条件を持たせる) */
  const liveRef = useRef(0)
  /* **送り方は、描き直すたびに新しく作られる。** 控えに写して、
     回している途中でも**いつも最新のもの**を呼ぶ */
  const cursorRef = useRef(cursor)
  cursorRef.current = cursor

  const now = () => cursorRef.current?.now?.() ?? null
  const go = () => cursorRef.current?.go?.() ?? null
  const back = () => cursorRef.current?.back?.() ?? null

  const 選んでいる = bgmPickOf(tracks, pick)

  /**
   * **流し始める。**
   *
   * 曲は**押したときに引く**(開いた瞬間ではない)。押さない人には
   * 1回も問い合わせが飛ばない。**曲が0本でも流れる**
   * (音楽が鳴らないだけ・**行き止まりを作らない**・CLAUDE.md)。
   */
  const start = async () => {
    setOn(true)
    /* ★ **読めなかったことを、0 曲として出さない**(第5.396節) */
    const { data, error: 曲error } = await listTracks()
    setTracks(data ?? [])
    setTracksError(曲error ?? null)
  }

  /** **止める。** 鳴っているものも曲も、その場で止める */
  const stop = () => {
    liveRef.current += 1
    setOn(false)
    stopReading()
    stopBgm()
  }

  const toggle = () => { if (on) stop(); else start() }

  /* ──── 音楽(第5.194節)。**どれを流すかは `bgmPlan()` 1か所** ────
       **流す場所の指定に従う**(`bgmPlaysIn`)—— 切ってあれば1曲も
       鳴らさない(レッスン中に画面を共有するため) */
  useEffect(() => {
    if (!on) return undefined
    if (bgmPlaysIn(loadBgmPlace(), place)) {
      const 計画 = bgmPlan(tracks, 選んでいる)
      startBgm(計画.tracks, { shuffle: 計画.shuffle })
    }
    return () => { stopBgm() }
  }, [on, tracks, 選んでいる, place])

  /* ──── 上から順に鳴らす ────────────────────────────────
       **1枚ぶんは `playRadioRow()`**(第5.445節・①)。ここは
       **鳴り終わったら次へ送る**ことだけを受け持つ。

       **止まる条件を必ず持たせる**(CLAUDE.md)。`liveRef` が変わったら
       途中でも黙って終える —— そうしないと画面を離れても鳴り続ける。

       **`cursor` を見張りに入れない。** 描き直すたびに新しく作られるので、
       入れると**1枚進むたびに組み直され、鳴っている途中で切れる。**
       控え(`cursorRef`)から呼ぶので、入れ直さなくても最新である。 */
  useEffect(() => {
    if (!on) return undefined
    const mine = liveRef.current + 1
    liveRef.current = mine
    const alive = () => liveRef.current === mine

    const run = async () => {
      let 空振り = 0
      while (alive()) {
        const row = now()
        /* **カードがまだ無いことがある**(始める前に押された・読み込み中)。
           **黙って終わらせない** —— 少し待って、もう一度見る。
           **ただし、いつまでも待たない**(止まる条件を持たせる・CLAUDE.md)
           —— 出し切ったあとは画面が「終わりの一覧」になり、
           カードが二度と出てこない */
        if (!row) {
          空振り += 1
          if (空振り > WAIT_MAX) { stop(); return }
          await quietWait(WAIT_MS, alive)
          continue
        }
        空振り = 0
        const 結果 = await playRadioRow(row, {
          mode,
          gap,
          rate,
          /* **次に出る行を、いま鳴らしているあいだに温める**(第5.251節)。
             **何を温めるかは `playRadioRow()` が決める** */
          next: cursorRef.current?.peek?.() ?? null,
          alive,
          /* **ほかから動かされたら、この行はもう読まない**
             (答えた・「次へ」を押した・冊を替えた) */
          here: () => now() === row,
          /* **進めるのは、間を置く前**(その順は `playRadioRow()` が持つ) */
          onNext: go,
        })
        if (!alive()) return
        if (結果 === EMPTY) {
          /* **読むものが無い行は、待たずに次へ。ただし少しだけ譲る** */
          go()
          await quietWait(SKIP_MS, alive)
        }
      }
    }
    run()
    return () => { liveRef.current += 1; stopReading() }
  }, [on, mode, gap, rate])

  /**
   * ★ **ロック画面に、いま聞いているものを出す**(第5.285節)。
   *
   * 題は**画面に出ているものをそのまま**渡す(`label`)——
   * 書き写すと、冊を替えた日にロック画面だけが古くなる。
   *
   * **操作も渡す。** ポケットに入れたまま次へ送れる ——
   * 次へ / 前へ は、**画面のボタンと同じ道**(`cursor`)である。
   *
   * **閉じたら外す。** 効かないボタンをロック画面に残さない。
   */
  useEffect(() => {
    if (!on) return undefined
    setNowPlaying({ title: label || '聞き流し' })
    setMediaActions({
      onStop: stop,
      onNext: () => { stopReading(); go() },
      onPrev: () => { stopReading(); back() },
    })
    return () => { setMediaActions({}) }
  }, [on, label])

  /* 画面を離れるときは、鳴っているものも曲も止める */
  useEffect(() => () => { liveRef.current += 1; stopReading(); stopBgm() }, [])

  return {
    on,
    start,
    stop,
    toggle,
    /**
     * **「出しかた」の中に入れる欄**(`<RadioSettings {...settings} />`)。
     * **欄の形はあちら1か所**で、ここは値と書き替え方だけを渡す。
     */
    settings: {
      where,
      mode,
      onMode: (next) => {
        setMode(next); saveRadioMode(next, where)
        /* **間も、その読み方のものに持ち替える**(第5.251節)。
           持ち替えないと、**「英語だけ」で選んだ 3秒が
           「日本語 → 英語」のあいだに化ける** */
        setGap(loadRadioGap(where, next))
      },
      gap,
      onGap: (ms) => { setGap(ms); saveRadioGap(ms, where, mode) },
      tracks,
      tracksError,
      pick: 選んでいる,
      onPick: (id) => { setPick(id); saveBgmPick(id) },
      voiceVol,
      onVoiceVol: (v) => { setVoiceVol(v); setVoiceLevel(v) },
      bgmVol,
      onBgmVol: (v) => { setBgmVol(v); setBgmVolume(v) },
    },
  }
}
