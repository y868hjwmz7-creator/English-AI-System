/**
 * 聞き流し —— **音楽を流しながら、単語帳の語が読まれる**(2026-09 利用者の指定)。
 *
 *   > それとか音楽を流しながらどんどん登録されている単語が
 *   > 読まれるモードも欲しいですね
 *
 * **読むのは英語だけ**(2026-09 利用者の指定)。
 *
 *   > 日本語入りはいらないですね!こえの質が悪すぎます!
 *
 * はじめは「英語 → 間 → 日本語」も選べたが、**日本語は端末の声でしか
 * 読めず、質を選べなかった**(詳しくは `wordRadio.js` の読み方の節)。
 * **画面に出す訳は、これまでどおり。**
 *
 * ============================================================================
 * 【1語ずつ画面に固定する。**集中モードと同じ骨組み**】
 *
 *   `FocusFrame` をそのまま使う(`FocusReader` / `StepFocus` /
 *   Quick Response の復習と同じもの)。**書き写さない**(CLAUDE.md)。
 *   聞き流しは**手が空いている**ので、送るものが無い形がいちばん合う。
 *
 * 【何をどの順で読むかは `wordRadio.js` 1か所】
 *   画面はそれを上から処理するだけ。**素の node で確かめられる**形に
 *   出してある(`playMark.js` と同じ考え方)。
 *
 * 【費用】
 *   語の読み上げは**標準の段**(Google / Azure の無料枠)で、
 *   **同じ語は1回しか課金されない**(置き場所が英文の指紋で決まる)。
 *   2周目からは0円なので、何時間回しても増えない。
 *
 * 【記録は動かさない】
 *   聞き流しは**答える練習ではない**ので、箱も次に出す日も1ミリも動かさない。
 *   「遅く出す方へは動かさない」よりさらに手前の話である。
 */
import { useEffect, useRef, useState } from 'react'
import FocusFrame from './FocusFrame.jsx'
import { CloseIcon, PlayIcon, StopIcon } from './Icons.jsx'
import { prepareRead, readAloud, stopReading } from '../lib/readAloud.js'
import { JA_VOICE } from '../data/clipVoices.js'
import { PREMIUM } from '../lib/voiceTier.js'
import { startBgm, stopBgm } from '../lib/bgm.js'
/* **どの曲を流すか**(第5.194節)。選び方も文言も、あちら1か所が持つ */
import {
  bgmChoices, bgmPickOf, bgmPlan, loadBgmPick, saveBgmPick,
} from '../lib/bgmPick.js'
/* **何問ずつ流すか**(第5.262節)。**単語帳・Quick Response と同じ一覧**を
   使う —— 出しかたの札で 5 / 10 / 20 / 30 / ぜんぶ を選ぶのと同じものである
   (**数え方を2通り持たない**・CLAUDE.md) */
import { SIZES, sizeOfValue, sizePickLabel, takeCount } from '../lib/reviewScope.js'
import {
  bgmPlaysIn, loadBgmPlace, loadRadioGap, loadRadioMode,
  hidesAnswer,
  nextIndex, radioGapLabelFor, radioGapsFor, radioGapsOf, radioJaOf,
  radioModesFor,
  radioSteps, radioTextOf, radioWarmups, saveRadioGap, saveRadioMode,
} from '../lib/wordRadio.js'

export default function WordRadio({
  /** 読むもの(**絞り込みと範囲を当てたあとの一覧**)。語でも文でもよい */
  rows,
  /**
   * どの画面から来たか(`word` = 単語帳 / `qr` = Quick Response)。
   *
   * **読み方の一覧も、覚える鍵も、これで決まる**(`wordRadio.js` 1か所)。
   * **間の長さは場面ごとに覚える** —— 語は短く、文は長い。
   */
  where = 'word',
  /**
   * **何問ずつ流すか、の初期値**(第5.262節・2026-09-26 利用者の指定)。
   *
   *   > この写真だと絞り込みで絞っているのは5問、そして繰り返しにしてある。
   *   > そういう場合は聞き流しモードもそれに合わせて5問を繰り返してください。
   *   > 30問選んでいれば30問を繰り返すように。
   *   > というよりも聞き流しモードの中でそれを選べるようにしてください。
   *
   * **「出しかた」で選んでいる数を、そのまま持ち込む**(利用者の指定)。
   * 中で変えられるので、ここは**始めの値**だけである。
   * `SIZES` の1つ(5 / 10 / 20 / 30 / 'all')。
   */
  size = 'all',
  /** 曲(`listTracks()` が返したもの)。無ければ音楽は流れない */
  tracks = [],
  rate = 1,
  learnerId = null,
  onClose,
  /**
   * **左上の ☰**(第5.172節・2026-09 利用者の指定)。
   *
   *   > 聞き流しの時も左上にはバーガーです。
   *
   * **渡しても、やめる道は消さない**(下の「聞き流しをやめる」)——
   * ☰ だけにすると、**練習へ戻るのにメニューを1周する**ことになる
   * (**行き止まりを作らない**・CLAUDE.md)。
   */
  onMenu = null,
}) {
  const modes = radioModesFor(where)
  const [mode, setMode] = useState(() => loadRadioMode(where))
  /**
   * **間(ま)の長さ**(2026-09 利用者の指定「間の時間設定もできるように」)。
   *
   * 選ぶのは**秒数1つだけ**で、語と語のあいだも
   * くり返しのあいだも**同じ比でそろって動く**(`radioGapsOf()` 1か所)。
   * **片方だけ縮めると、そこだけ不自然に詰まる**(`turnGap.js` と同じ考え方)。
   */
  /* **読み方ごとに別に覚える**(第5.251節)。「英語だけ」の間と
     「日本語 → 英語」のあいだは**別のもの**である */
  const [gap, setGap] = useState(() => loadRadioGap(where, mode))
  const [at, setAt] = useState(0)
  /**
   * **いま鳴っている文字**(かたまりのときは、そのかたまり)。
   * `null` なら、まだ何も鳴っていない。
   *
   * **画面で文を切り直さない** —— 何を鳴らすかは `radioSteps()` が
   * 決めてあるので、その `text` をそのまま出す(**数え方を2通り持たない**)。
   */
  const [line, setLine] = useState(null)
  /**
   * **答えを開いたか。**
   *
   * 言う練習(2026-09 利用者の指定「パタプラのようにしたい」)では、
   * **英文が先に出ていたら、ただ読み上げているだけ**になる。
   * 1つめの音が鳴った瞬間に開き、次の問へ移ったら閉じる。
   *
   * **開くかどうかを決めるのは `hidesAnswer()` 1か所**(`wordRadio.js`)。
   * ここで `mode === 'say'` と書かない。
   */
  const [open, setOpen] = useState(false)
  const [say, setSay] = useState(null)   // いま読んでいるもの('en' / 'ja')
  const [on, setOn] = useState(true)     // 鳴らしているか
  /** 止めるための印。**画面を離れたら、そこで終わる**(止まる条件を持たせる) */
  const liveRef = useRef(0)
  /**
   * いま読んでいる語。**控えのほうが本体で、`at` はその写しである**
   * (2026-09 実機・利用者の指摘「一つの単語が4回読み上げられたり…
   * 画面に表示されている単語とメチャクチャにズレてしまってます」)。
   *
   * **もとは `atRef.current = at` と、描くたびに写していた。** ところが
   * 読み上げの繰り返しは `setAt()` で進めたあと、**描き直しを待たずに
   * すぐ次の周に入って `atRef.current` を読む。** React の状態は
   * その場では変わっていないので、**同じ語をもう一度読む。**
   * しかも `setAt` は2回ぶん進むので、**そこから先は画面が1つ先を指したまま**
   * になる(実測: take on を3回・gist を1回、訳は次の語の画面で読まれていた)。
   *
   * だから**進めるのは `move()` 1か所**にし、控えと画面を必ず一緒に動かす。
   */
  const atRef = useRef(0)

  /** いま読んでいる語を移す。**控えが先、画面はその写し** */
  const move = (i) => { atRef.current = i; setAt(i) }

  /* **読むものがある語だけを並べる。** 「読むものがあるか」の判断は
     `radioTextOf()` 1か所(`wordRadio.js`)—— ここで書き写すと、
     空白だけの語が残って**鳴らす側が待たずに回り続ける** */
  /**
   * **何問ずつ流すか**(第5.262節)。
   *
   * **持ち込んだ数から始める** —— 5問に絞って練習していた人が
   * 聞き流しを開いたら、そのまま5問が回る。
   * **知らない値は既定に落とす**(`sizeOfValue()`・行き止まりを作らない)。
   */
  const [take, setTake] = useState(() => sizeOfValue(size))
  const 読めるもの = (rows ?? []).filter((r) => radioTextOf(r))
  /* **数えるのは `takeCount()` 1か所**(`reviewScope.js`)——
     出しかたの札とまったく同じ数え方である。
     **`'all'` を画面で `=== 'all'` と書かない** */
  const list = 読めるもの.slice(0, takeCount(take, 読めるもの.length))
  const now = list[at] ?? null

  /**
   * **どの曲を流すか**(第5.194節・2026-09 利用者の指定
   * 「複数登録した曲から選べるようにしてください」)。
   *
   * 既定は「ぜんぶ(順不同)」—— **これまでと1ミリも変わらない。**
   * **消えた曲を握ったままにしない**(`bgmPickOf` が落とす)。
   */
  const [pick, setPick] = useState(loadBgmPick)
  const song選び = bgmChoices(tracks)
  const 選んでいる = bgmPickOf(tracks, pick)

  /* **音楽は、流す場所の指定に従う**(`bgmPlaysIn` 1か所)。
     切ってあれば1曲も鳴らさない —— レッスン中に画面を共有するので、
     **切る場所を必ず用意する**(CLAUDE.md)。

     **どれを流すかは `bgmPlan()` 1か所**(第5.194節)。
     混ぜるかどうかも、あちらが決める —— 1曲だけのときに順を混ぜても
     意味がないので、**画面で書き分けない** */
  useEffect(() => {
    if (bgmPlaysIn(loadBgmPlace(), 'radio')) {
      const 計画 = bgmPlan(tracks, 選んでいる)
      /* **題は覚えない**(第5.252節)。画面に出さなくなったので、
         覚えておく先がどこにも無い */
      startBgm(計画.tracks, { shuffle: 計画.shuffle })
    }
    return () => { stopBgm() }
  }, [tracks, 選んでいる])

  /**
   * 上から順に読む。**1語ぶんの並びは `radioSteps()` が決める。**
   *
   * **止まる条件を必ず持たせる**(CLAUDE.md)。`liveRef` が変わったら、
   * 途中でも黙って終える —— そうしないと画面を閉じても鳴り続ける。
   */
  useEffect(() => {
    if (!on || !list.length) return undefined
    const mine = liveRef.current + 1
    liveRef.current = mine
    const alive = () => liveRef.current === mine

    const wait = (ms) => new Promise((r) => { setTimeout(r, ms) })
    /* **3つの間は、選んだ秒から一度に出す**(`radioGapsOf()` 1か所)。
       ここで `WORD_GAP_MS` を直に使うと、間を変えても
       **語と語のあいだだけが動かない** */
    const gaps = radioGapsOf(gap, mode)

    const run = async () => {
      while (alive()) {
        /* **控えから読む。** ここが「いま読んでいる語」である。
           1周のあいだ動かさないので、読んでいる語と画面が必ず一致する */
        const i = atRef.current
        const row = list[i]
        const steps = radioSteps(row, mode, gap)
        /* **問が変わったら、答えは閉じる。** 前の問の英文が残っていると、
           次の問の「言う番」に**前の答えが出たまま**になる */
        setLine(null); setOpen(false)
        /* **次の語は、いま鳴らしているあいだに用意する**
           (2026-09 実機・利用者の指定「違う単語に移る際の間を
           0.5 秒くらいまで縮められませんか」)。

           耳に届く間は**「決めた間 + 用意の待ち」**である。語が変わると
           MP3 と文字ごとの時刻を取りに行くが、**同じ語の2回目には
           起きない**(もう控えにある)。だから間の値だけを縮めても、
           「別の語のときだけ長い」は半分しか直らない。

           **1つ先だけ**(`readAloudSequence` の `ahead` と同じ作法)。
           どのみち次に鳴らすものなので、**費用は増えない**。
           失敗しても何もしない —— 先読みのために画面を止めない */
        /* ══════════════════════════════════════════════════════
           **訳も先読みする**(第5.251節・2026-09-23 利用者の指定)

             > そしてそもそも日本が言われるまでの時間、これが今は長い。
             > これも最速にしましょう。

           **英語しか先読みしていなかった。** 言う練習は訳から始まるので、
           問が変わるたびに**訳の MP3 を取りに行ってから**鳴っていた ——
           これが「そもそも日本語が言われるまで」の正体である。
           **間の値をいくら縮めても、ここは1ミリも縮まらない。**

           **何を先読みするかは `radioWarmups()` が決める**
           (歩みそのものから読む)。ここで「言う練習なら訳も」と
           書くと、読む順を変えた日に先読みだけが古くなる。

           **費用は増えない。** どのみち次に鳴らすもので、鍵が同じなら
           0円である(CLAUDE.md「音声は鍵が同じなら 0 円」)。
           **1つ先だけ**にしてあるので、鳴らす前に取り終わる ——
           同じ瞬間に2回作りに行くことも無い。
           ══════════════════════════════════════════════════════ */
        for (const w of radioWarmups(list[nextIndex(i, list.length)], mode)) {
          prepareRead(w.text, w.ja
            ? { clipVoice: JA_VOICE, clipTier: PREMIUM }
            : undefined)
        }
        if (!steps.length) {
          /* **読むものが無い語は、待たずに次へ。**「読んだことにして」
             間だけ置くと、無音の時間が延びるだけである。
             **ただし少しだけ譲る** —— 一覧ぜんぶが空だったときに、
             画面ごと固まらないようにする(`radioTextOf` で先に落として
             あるので、ここへ来るのは行が入れ替わった一瞬だけ) */
          move(nextIndex(i, list.length))
          await wait(120)
          continue
        }
        for (const st of steps) {
          if (!alive()) return
          /* 「次へ」で移されたら、この語はもう読まない */
          if (atRef.current !== i) break
          /* **「言う番」は、ただの間ではない。** 画面にそう出す ——
             黙って止まっていると、待たされているのか壊れたのか分からない */
          if (st.kind === 'wait') {
            setSay(st.you ? 'you' : null)
            await wait(st.ms)
            continue
          }
          setSay(st.kind)
          /* **鳴らすものを、そのまま画面に出す。** かたまりのときは
             かたまりが出る。ここで開く(答えは、鳴ってから見せる) */
          setLine(st.text); setOpen(true)
          /* **描き替えを1手待ってから鳴らす**(2026-09)。
             React は `setLine()` をその場では描き替えないので、
             すぐ鳴らすと**音が先、文字があと**になる ——
             実測で「`Could you walk me through…` を読んでいるのに、
             画面は1つ前のかたまり」だった(`npm run test:bar`)。
             `setAt()` で踏んだのとまったく同じ落とし穴である。

             **`requestAnimationFrame` は使わない** ——
             別のタブへ移ると止まるので、そこで練習ごと固まる */
          await wait(0)
          if (!alive() || atRef.current !== i) return
          /* **曲は、鳴っているあいだも小さくしない**(2026-09 利用者の指定
             「英語音声が再生される時に自動で音楽の音量を下げる機能は
             必要ありません」)。大きさは聴く人が左のメニューの下で決める */
          /* ══════════════════════════════════════════════════════
             **訳は、窓口の声でだけ読む**(2026-09 利用者の指定)。

               > 日本語の声のIDです Shohei (male) ID IVNAqtksLGNGcgvh8Jez

             2026-09 に日本語を外したのは「こえの質が悪すぎます!」
             だったが、**あれは端末の声**である。あのとき
             「窓口で作れるようになった日には戻す。
             **端末の声には二度と戻さない**」と書き残してあった。

             だから `clipOnly` を渡す —— 窓口で作れなかったときは
             **鳴らさずに次へ**。落ちた先で悪い声が鳴るくらいなら、
             一瞬だまるほうがよい。

             **聞き流し(英語だけ)は1ミリも変えていない** ——
             あちらに `ja` の段は1つも出ない(`radioSteps`)。
             どの声で読むかは `JA_VOICE` 1か所である
             ══════════════════════════════════════════════════════ */
          await (st.kind === 'ja'
            ? readAloud(st.text, {
              rate,
              clipVoice: JA_VOICE,
              /* **良い段で頼む。** `JA_VOICE` は ElevenLabs にしかいないので、
                 標準の段(Google / Azure)に落とすと**代役の英語の声**になる */
              clipTier: PREMIUM,
              clipOnly: true,
            })
            : readAloud(st.text, { rate }))
        }
        if (!alive()) return
        setSay(null)
        /* 「次へ」で移されていたら、**語のあいだの間は置かない。**
           押したのに 0.9 秒だまるのは、効いていないように見える */
        if (atRef.current !== i) continue
        /* **進めるのが先、間を置くのがあと。**
           React は `setAt()` をその場では描き替えないので、
           **間よりあとに進めると、音が出た時点で画面がまだ1つ前**になる
           (実測: 「gist」を読んでいるのに画面は「take on」)。
           先に進めておけば、語と語のあいだの 0.9 秒で必ず追いつく */
        move(nextIndex(i, list.length))
        await wait(gaps.word)
        if (!alive()) return
      }
    }
    run()
    return () => { liveRef.current += 1; stopReading() }
  }, [on, mode, gap, list.length, rate])

  const stop = () => {
    liveRef.current += 1
    stopReading()
    stopBgm()
    onClose?.()
  }

  /* **答えを隠す読み方か。** 判断は `hidesAnswer()` 1か所(`wordRadio.js`) */
  const hidden = hidesAnswer(mode)

  return (
    <FocusFrame
      /* **文は語より長い。** Quick Response では英文が1行に収まらないので、
         そこだけ字を一段落とす(`radio--qr`)—— 落とさないと
         狭い画面で**送るものが出て、この画面の意味が消える** */
      className={where === 'qr' ? 'radio radio--qr' : 'radio'}
      plain
      learnerId={learnerId}
      /* **語ごとに変えない。** ここを変えると、1語進むたびに
         `useFocusBoard` が作り直される(`plain` では描かないので、
         そのぶんが丸ごと無駄になる) */
      page="radio"
      onClose={stop}
      /* **左上は ☰**(第5.172節)。渡されなければ ✕ 閉じるのまま */
      onMenu={onMenu}
      top={(
        <span className="focus-count">
          {list.length ? `${at + 1} / ${list.length}` : '0'}
        </span>
      )}
      /* **間は、変えたくなる場所のとなりに置く。**
         **聴きながら「もう少し長く」と思う**ものなので、
         画面のはるか上ではなく、ここに置く
         (単語帳の「出題の形」を進み具合の行へ移したのと同じ考え方) */
      topEnd={(
        <>
          {/* **何問ずつ流すか**(第5.262節・2026-09-26 利用者の指定)。

                > そういう場合は聞き流しモードもそれに合わせて5問を
                > 繰り返してください。30問選んでいれば30問を繰り返すように。
                > というよりも聞き流しモードの中でそれを選べるようにして
                > ください。

              **「出しかた」で選んでいる数を持ち込んで始まる**ので、
              5問に絞って練習していた人には、そのまま5問が回る。
              ここで変えれば、その場で切り替わる。

              **札の一覧も、数え方も `reviewScope.js` 1か所**である ——
              出しかたの札とまったく同じ 5 / 10 / 20 / 30 / ぜんぶ が並ぶ
              (**数え方を2通り持たない**・CLAUDE.md)。 */}
          <label className="wb-formpick radio-pick radio-pick--take">
            <span className="sr-only">何問ずつ</span>
            <select value={String(take)}
                    onChange={(e) => {
                      setTake(sizeOfValue(e.target.value))
                      /* **頭から読み直す。** 減らしたときに、いま読んでいる
                         場所が一覧の外へ出たままになるのを防ぐ */
                      move(0)
                    }}>
              {SIZES.map((n) => (
                <option key={String(n)} value={String(n)}>{sizePickLabel(n, '問')}</option>
              ))}
            </select>
          </label>
          {/* **読み方は、選べるものが2つ以上あるときだけ出す**
              (**効かない操作を見せない**・CLAUDE.md)。
              日本語の読み上げを外したので、いまは「英語だけ」1つである。

              **自分の名前(`--mode`)を持つ**(第5.262節)。見張りは
              「`--gap` と `--song` 以外」という**外して数える形**だったので、
              欄が1つ増えるたびに巻き込まれていた
              (曲の題を数えてしまった 2026-09-23 と、まったく同じ形)。
              **欲しいものを名指しする**ほうが、増えても壊れない */}
          {modes.length > 1 && (
            <label className="wb-formpick radio-pick radio-pick--mode">
              <span className="sr-only">読み方</span>
              <select value={mode}
                      onChange={(e) => {
                        const next = e.target.value
                        setMode(next); saveRadioMode(next, where)
                        /* **間も、その読み方のものに持ち替える**(第5.251節)。
                           持ち替えないと、**「英語だけ」で選んだ 3秒が
                           「日本語 → 英語」のあいだに化ける** */
                        setGap(loadRadioGap(where, next))
                      }}>
                {modes.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </label>
          )}
          {/* **どの曲を流すか**(第5.194節・2026-09 利用者の指定)。

              > 複数登録した曲から選べるようにしてください。

              **2曲以上あるときだけ出す**(`bgmChoices` が決める)——
              1曲しか無ければ「ぜんぶ」とその1曲は同じもので、
              **押しても何も変わらない**(効かない操作を見せない・CLAUDE.md)。

              **置き場所は、間の長さのとなり。** 聴きながら
              「この曲じゃないな」と思うものなので、画面のはるか上ではなく
              ここに置く(読み方・間とまったく同じ考え方) */}
          {song選び.length > 0 && (
            <label className="wb-formpick radio-pick radio-pick--song">
              <span className="sr-only">曲</span>
              <select value={選んでいる}
                      onChange={(e) => { setPick(e.target.value); saveBgmPick(e.target.value) }}>
                {song選び.map((x) => (
                  <option key={x.id || 'all'} value={x.id}>{x.label}</option>
                ))}
              </select>
            </label>
          )}
          {/* **間の長さ。** 数(秒)は1文字も削らない —— そこが読めないと、
              何を選んでいるのか分からない(CLAUDE.md) */}
          <label className="wb-formpick radio-pick radio-pick--gap">
            <span className="sr-only">{radioGapLabelFor(where, mode)}</span>
            <select value={gap}
                    onChange={(e) => {
                      const ms = Number(e.target.value)
                      setGap(ms); saveRadioGap(ms, where, mode)
                    }}>
              {radioGapsFor(where, mode)
                .map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
            </select>
          </label>
        </>
      )}
    >
      <div className="radio-card">
        {/* **いま読んでいるものを、目でも分かるようにする。**
            聞き流しは耳だけの練習だが、ふと見たときに追えないと
            「いまどれ?」になる(色だけに頼らないので、印は枠と太字) */}
        {/* **出す文字も `radioTextOf()` / `radioJaOf()` を通す。**
            ここで `display || word_norm` と書き写すと、
            **鳴らす側と画面で数え方が2通り**になる(CLAUDE.md) */}
        {/* **言う練習では、答えを先に見せない**(2026-09 利用者の指定
            「パタプラのようにしたい」)。英文が出ていたら、
            **間の中で「言う」のではなく「読む」**ことになる。

            出すのは**鳴っているそのもの**(かたまりのときは、かたまり)。
            **色だけに頼らない** —— 枠と太字と、この文字そのもので示す */}
        {hidden && !open ? (
          <p className="radio-en radio-en--you" lang="ja">
            {say === 'you' ? '声に出して言ってください' : 'つぎの英語を思い出してください'}
          </p>
        ) : (
          <p className={`radio-en${say === 'en' ? ' is-now' : ''}`} lang="en">
            {(hidden ? line : null) || radioTextOf(now) || '—'}
          </p>
        )}
        {/* **日本語は、いつも出ている。** これが出題そのものである
            (読み上げるのは英語だけ —— 2026-09 利用者の指定) */}
        <p className={`radio-ja${say === 'ja' ? ' is-now' : ''}`}>
          {radioJaOf(now)}
        </p>
        {now?.seen_in && <p className="radio-seen" lang="en">{now.seen_in}</p>}

        <div className="btn-row radio-tools">
          <button type="button" className="btn btn--primary" onClick={() => setOn((v) => !v)}>
            {on ? <><StopIcon />とめる</> : <><PlayIcon />つづける</>}
          </button>
          {/* **「次へ」も `move()` を通す。** `setAt` だけを動かすと
              控えと食い違い、読んでいる語と画面がずれる。
              いま鳴っているものは**その場で止める** —— 押したのに
              最後まで読み切ってから移るのでは、効いていないように見える */}
          <button type="button" className="btn btn--quiet"
                  onClick={() => { stopReading(); move(nextIndex(atRef.current, list.length)) }}>
            次へ
          </button>
          {/* **やめる道は、ここに残す**(第5.172節)。
              左上が ☰ になったので、**押さないと練習へ戻れなくなる。**
              ☰ から戻ることもできるが、それはメニューを1周する道である
              (**行き止まりを作らない**・CLAUDE.md)。
              ✕ のままの画面では、左上と2つになってしまうので出さない */}
          {onMenu && (
            <button type="button" className="btn btn--ghost" onClick={stop}>
              <CloseIcon />聞き流しをやめる
            </button>
          )}
        </div>
        {/* ══════════════════════════════════════════════════════
            **説明書きと曲名は置かない**(第5.252節・2026-09-23 利用者の指定)

              > 下の説明と曲名を消して

            ここには2つ出ていた。
            ①この読み方で何が起きるかの文(`radioLead`)
            ②いま鳴っている曲の題

            **どちらも「押せば分かる」ことである**
            (共通ルール「余計な説明書きは全て排除」)。
            曲は上の欄で選ぶので、**選んだものが在るところに在る。**

            **消したのは画面の文だけ**で、鳴らす仕組みは1つも触っていない。
            ══════════════════════════════════════════════════════ */}
      </div>
    </FocusFrame>
  )
}
