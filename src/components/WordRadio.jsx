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
  RADIO_MODES, WORD_GAP_MS, bgmPlaysIn, loadBgmPlace, loadRadioMode,
  nextIndex, radioLead, radioSteps, saveRadioMode,
} from '../lib/wordRadio.js'

export default function WordRadio({
  /** 読む語(**絞り込みと範囲を当てたあとの一覧**) */
  rows,
  /** 曲(`listTracks()` が返したもの)。無ければ音楽は流れない */
  tracks = [],
  rate = 1,
  learnerId = null,
  onClose,
}) {
  const [mode, setMode] = useState(loadRadioMode)
  const [at, setAt] = useState(0)
  const [say, setSay] = useState(null)   // いま読んでいるもの('en' / 'ja')
  const [on, setOn] = useState(true)     // 鳴らしているか
  const [song, setSong] = useState(null) // いま鳴っている曲の題
  /** 止めるための印。**画面を離れたら、そこで終わる**(止まる条件を持たせる) */
  const liveRef = useRef(0)
  const atRef = useRef(0)
  atRef.current = at

  const list = (rows ?? []).filter((r) => (r?.display || r?.word_norm))
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

    const run = async () => {
      while (alive()) {
        const row = list[atRef.current]
        const steps = radioSteps(row, mode)
        if (!steps.length) {
          /* **読むものが無い語は、待たずに次へ。**「読んだことにして」
             間だけ置くと、無音の時間が延びるだけである */
          setAt((i) => nextIndex(i, list.length))
          continue
        }
        for (const st of steps) {
          if (!alive()) return
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
        await wait(WORD_GAP_MS)
        if (!alive()) return
        setAt((i) => nextIndex(i, list.length))
        setSong(nowPlaying()?.title ?? null)
      }
    }
    run()
    return () => { liveRef.current += 1; stopReading(); duckBgm(false) }
  }, [on, mode, list.length, rate])

  const stop = () => {
    liveRef.current += 1
    stopReading()
    stopBgm()
    onClose?.()
  }

  return (
    <FocusFrame
      className="radio"
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
      topEnd={(
        <label className="wb-formpick">
          <span className="sr-only">読み方</span>
          <select value={mode}
                  onChange={(e) => { setMode(e.target.value); saveRadioMode(e.target.value) }}>
            {RADIO_MODES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </label>
      )}
    >
      <div className="radio-card">
        {/* **いま読んでいるものを、目でも分かるようにする。**
            聞き流しは耳だけの練習だが、ふと見たときに追えないと
            「いまどれ?」になる(色だけに頼らないので、印は枠と太字) */}
        <p className={`radio-en${say === 'en' ? ' is-now' : ''}`} lang="en">
          {now?.display || now?.word_norm || '—'}
        </p>
        <p className={`radio-ja${say === 'ja' ? ' is-now' : ''}`}>
          {now?.meaning_ja || ''}
        </p>
        {now?.seen_in && <p className="radio-seen" lang="en">{now.seen_in}</p>}

        <div className="btn-row radio-tools">
          <button type="button" className="btn btn--primary" onClick={() => setOn((v) => !v)}>
            {on ? <><StopIcon />とめる</> : <><PlayIcon />つづける</>}
          </button>
          <button type="button" className="btn btn--quiet"
                  onClick={() => setAt((i) => nextIndex(i, list.length))}>
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
