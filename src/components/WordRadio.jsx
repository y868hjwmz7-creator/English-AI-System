/**
 * 聞き流し —— **音楽を流しながら、単語帳の語が読まれる**(2026-09 利用者の指定)。
 *
 *   > それとか音楽を流しながらどんどん登録されている単語が
 *   > 読まれるモードも欲しいですね
 *
 * 読み方は利用者が選んだ2つ。
 *
 *   > 英語だけを繰り返し、と英語→間→日本語の2モードを選べるように
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
 *   日本語は端末の声(0円)。
 *
 * 【記録は動かさない】
 *   聞き流しは**答える練習ではない**ので、箱も次に出す日も1ミリも動かさない。
 *   「遅く出す方へは動かさない」よりさらに手前の話である。
 */
import { useEffect, useRef, useState } from 'react'
import FocusFrame from './FocusFrame.jsx'
import { PlayIcon, StopIcon } from './Icons.jsx'
import { readAloud, stopReading } from '../lib/readAloud.js'
import { japaneseVoice, speakOnce } from '../lib/speech.js'
import { duckBgm, nowPlaying, startBgm, stopBgm } from '../lib/bgm.js'
import {
  RADIO_GAPS, bgmPlaysIn, loadBgmPlace, loadRadioGap, loadRadioMode,
  nextIndex, radioGapsOf, radioJaOf, radioLead, radioModesFor, radioSteps,
  radioTextOf, saveRadioGap, saveRadioMode,
} from '../lib/wordRadio.js'

export default function WordRadio({
  /** 読むもの(**絞り込みと範囲を当てたあとの一覧**)。語でも文でもよい */
  rows,
  /**
   * どの画面から来たか(`word` = 単語帳 / `qr` = Quick Response)。
   *
   * **読み方の一覧も、覚える鍵も、これで決まる**(`wordRadio.js` 1か所)。
   * Quick Response は**日本語 → 英語**が既定である ——
   * あちらは日本語を見て英語を言う練習なので、聞き流しも同じ向きにする。
   */
  where = 'word',
  /** 曲(`listTracks()` が返したもの)。無ければ音楽は流れない */
  tracks = [],
  rate = 1,
  learnerId = null,
  onClose,
}) {
  const modes = radioModesFor(where)
  const [mode, setMode] = useState(() => loadRadioMode(where))
  /**
   * **間(ま)の長さ**(2026-09 利用者の指定「間の時間設定もできるように」)。
   *
   * 選ぶのは**「考える間」の秒数1つだけ**で、語と語のあいだも
   * くり返しのあいだも**同じ比でそろって動く**(`radioGapsOf()` 1か所)。
   * **片方だけ縮めると、そこだけ不自然に詰まる**(`turnGap.js` と同じ考え方)。
   */
  const [gap, setGap] = useState(() => loadRadioGap(where))
  const [at, setAt] = useState(0)
  const [say, setSay] = useState(null)   // いま読んでいるもの('en' / 'ja')
  const [on, setOn] = useState(true)     // 鳴らしているか
  const [song, setSong] = useState(null) // いま鳴っている曲の題
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
  const list = (rows ?? []).filter((r) => radioTextOf(r))
  const now = list[at] ?? null

  /* **音楽は、流す場所の指定に従う**(`bgmPlaysIn` 1か所)。
     切ってあれば1曲も鳴らさない —— レッスン中に画面を共有するので、
     **切る場所を必ず用意する**(CLAUDE.md) */
  useEffect(() => {
    let alive = true
    if (bgmPlaysIn(loadBgmPlace(), 'radio')) {
      startBgm(tracks).then((started) => {
        if (alive && started) setSong(nowPlaying()?.title ?? null)
      })
    }
    return () => { alive = false; stopBgm() }
  }, [tracks])

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
    const gaps = radioGapsOf(gap)

    const run = async () => {
      while (alive()) {
        /* **控えから読む。** ここが「いま読んでいる語」である。
           1周のあいだ動かさないので、読んでいる語と画面が必ず一致する */
        const i = atRef.current
        const row = list[i]
        const steps = radioSteps(row, mode, gap)
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
          if (st.kind === 'wait') { setSay(null); await wait(st.ms); continue }
          setSay(st.kind)
          /* **声が鳴っているあいだは、曲を小さくする**(利用者が選んだ) */
          duckBgm(true)
          if (st.kind === 'en') {
            await readAloud(st.text, { rate })
          } else {
            const ja = japaneseVoice()
            /* **日本語の声が無ければ、読まない。** 英語の声で読ませると
               ローマ字読みになる。画面には出ているので行き止まりにはならない */
            if (ja) await speakOnce(st.text, { voice: ja, rate: 1 }).done
            else await wait(700)
          }
          duckBgm(false)
        }
        if (!alive()) return
        setSay(null)
        setSong(nowPlaying()?.title ?? null)
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
    return () => { liveRef.current += 1; stopReading(); duckBgm(false) }
  }, [on, mode, gap, list.length, rate])

  const stop = () => {
    liveRef.current += 1
    stopReading()
    stopBgm()
    onClose?.()
  }

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
      top={(
        <span className="focus-count">
          {list.length ? `${at + 1} / ${list.length}` : '0'}
        </span>
      )}
      /* **読み方と間は、となりどうしに置く。** どちらも「どう読むか」で、
         しかも**聴きながら「もう少し長く」と思う**ものである。
         画面のはるか上ではなく、**変えたくなる場所のとなり**に置く
         (単語帳の「出題の形」を進み具合の行へ移したのと同じ考え方) */
      topEnd={(
        <>
          <label className="wb-formpick radio-pick">
            <span className="sr-only">読み方</span>
            <select value={mode}
                    onChange={(e) => { setMode(e.target.value); saveRadioMode(e.target.value, where) }}>
              {modes.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </label>
          {/* **間の長さ。** 数(秒)は1文字も削らない —— そこが読めないと、
              何を選んでいるのか分からない(CLAUDE.md) */}
          <label className="wb-formpick radio-pick radio-pick--gap">
            <span className="sr-only">間の長さ</span>
            <select value={gap}
                    onChange={(e) => {
                      const ms = Number(e.target.value)
                      setGap(ms); saveRadioGap(ms, where)
                    }}>
              {RADIO_GAPS.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
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
        <p className={`radio-en${say === 'en' ? ' is-now' : ''}`} lang="en">
          {radioTextOf(now) || '—'}
        </p>
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
        </div>
        <p className="card-hint radio-lead">
          {radioLead(mode)}
          {' '}最後まで行ったら、頭から回り直します。
          <strong>覚えた・まだ の記録は動きません。</strong>
        </p>
        {/* **いま鳴っている曲を出す。** 何が流れているか分からないと、
            曲を入れ替えたくなったときに探せない */}
        {song && <p className="card-hint radio-song">♪ {song}</p>}
      </div>
    </FocusFrame>
  )
}
