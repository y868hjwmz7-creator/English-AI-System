/**
 * **本文の通し読み上げを、1か所で受け持つ**(2026-09)。
 *
 * ============================================================================
 * 【なぜ切り出したか】(2026-09 利用者の指定)
 *
 *   > 集中モードでも普通の画面と全く同じように文章送りができ、
 *   > 再生中の文章がハイライトされ、反復も同じようにできるのUIにして
 *   > 欲しいです。普通の画面との統一感が欲しいところです。
 *
 *   通しの読み上げには、見た目には出てこない持ちものが多い。
 *
 *     ・いま鳴っているか / どこまで来たか(**止めても消さない**番号)
 *     ・音が出るまでの「用意しています…」と経過秒数
 *     ・くり返しの単位(文 / 段落 / 全文)
 *     ・止めた場所からの再開
 *
 *   これを**紙(`LessonView`)と集中モード(`FocusReader`)の2か所に
 *   書き写すと、必ず片方だけ古くなる**(単語帳で踏んだ失敗・CLAUDE.md)。
 *   だから**部品ではなく、持ちものごと1つにまとめる。**
 *
 * ============================================================================
 * 【くり返しは覚えない】
 *   鳴りっぱなしになる指定なので、次に開いたときは必ず「しない」に戻す
 *   (`RepeatToggle` と同じ作法)。**ここが `useState` なので、
 *   画面を閉じれば消える** —— わざわざ消して回らなくてよい。
 *
 * 【単位は「訊きに行く」形で渡す】
 *   `readAloudSequence` には値ではなく `() => 単位` を渡す。
 *   **鳴らしている最中に切り替えても、次のひと刻みから効く。**
 *   値で渡すと、押し直すまで効かない。
 *
 * 【何を鳴らすかは、押したときに渡す】
 *   声も速さも段も、**開いているページで変わる。** ここで持つと
 *   古い値で鳴らすことになるので、`play()` にそのつど渡してもらう。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { readAloudSequence, stopReading } from './readAloud.js'
import { STANDARD } from './voiceTier.js'

/**
 * @param {object} o
 * @param {Function} o.onIndex いま鳴っている番号が変わったとき(終わりで null)
 * @param {Function} o.onWord  いま読んでいる文の位置(終わりで null)
 */
export default function useBodyAudio({ onIndex = null, onWord = null } = {}) {
  const [playing, setPlaying] = useState(false)
  /** 音が出るまでのあいだ(`SpeakButton` と同じ見せ方) */
  const [waiting, setWaiting] = useState(false)
  const [secs, setSecs] = useState(0)
  /**
   * **どこまで来たか。止めても消さない。**
   * 止めた場所から再開するので、その場所は出しておくほうが正しい。
   */
  const [at, setAt] = useState(null)
  /** **いま鳴っている番号。止めたら消す**(色を付けるための目印) */
  const [now, setNow] = useState(null)
  /** くり返しの単位。**覚えない** */
  const [repeat, setRepeat] = useState('off')

  /* 鳴らしている最中に呼ぶものは、控えで持つ(いつも最新になる) */
  const repeatRef = useRef(repeat)
  repeatRef.current = repeat
  const indexRef = useRef(onIndex)
  indexRef.current = onIndex
  const wordRef = useRef(onWord)
  wordRef.current = onWord

  const stopRef = useRef(null)
  const ticker = useRef(null)

  const clearTicker = () => {
    window.clearInterval(ticker.current)
    ticker.current = null
  }

  const stop = useCallback(() => {
    stopRef.current?.()
    stopRef.current = null
    /* **鳴っているものは、ぜんぶ止める。** 段落ごとの Listen が
       鳴っていることもある(速さを変えたときなど) */
    stopReading()
    clearTicker()
    setPlaying(false)
    setWaiting(false)
    setNow(null)
    indexRef.current?.(null)
    wordRef.current?.(null)
  }, [])

  /**
   * 鳴らす。
   *
   * @param {object} o
   * @param {Array}  o.parts     `{ text, voice, clipVoice }` の並び(本文ぜんぶ)
   * @param {string} o.resumeKey 止めた場所を覚える目印
   * @param {number} o.rate      速さ
   * @param {string} o.tier      声の段
   * @param {number|null} o.startIndex そこから鳴らす。`null` なら**止めた場所から**
   * @param {boolean} o.keep     `startIndex` を優先しつつ、
   *                             **その段落で止めた続き**があれば使う(集中モード)
   */
  const play = useCallback(({
    parts = [], resumeKey = null, rate = 0.9, tier = STANDARD,
    startIndex = null, keep = false,
  } = {}) => {
    const list = parts ?? []
    if (!list.length) return
    const jump = Number.isFinite(startIndex)
      ? Math.min(Math.max(startIndex, 0), list.length - 1) : null

    setPlaying(true)
    // **音が出るまでは「用意しています…」**(2026-09 利用者の指摘)。
    // MP3 をこれから作るときは数秒かかる。押しても反応が無いように見え、
    // もう一度押すとそれが「止める」になって、結局鳴らない
    setWaiting(true)
    setSecs(0)
    const from = Date.now()
    clearTicker()
    ticker.current = window.setInterval(() => {
      setSecs(Math.round((Date.now() - from) / 1000))
    }, 500)
    const heard = () => { clearTicker(); setWaiting(false) }

    stopRef.current = readAloudSequence(list, {
      rate,
      clipTier: tier,
      resumeKey,
      /* **単位は訊きに行く。** 鳴らしている最中に切り替えられる */
      repeatOf: () => repeatRef.current,
      ...(jump == null ? {} : (keep
        /* 集中モード … いま開いている段落から。控えの秒は
           **その段落のものだったときだけ**使う */
        ? { startIndex: jump, pinned: true }
        /* 送り戻し … 行き先はこちらが決めている。控えを当てると
           **押したのに動かない**ように見える */
        : { startIndex: jump, resume: false })),
      onIndex: (i) => {
        if (i === null) { stopRef.current = null; setPlaying(false); heard() }
        setNow(i)
        // **止めても番号は消さない。** どこで止めたかを操作盤が出す
        if (i !== null) setAt(i)
        indexRef.current?.(i)
      },
      onStart: heard,
      // **最後まで鳴りきったら、番号を消す。** 次に押したときは頭から
      onDone: () => setAt(null),
      onWord: (w) => wordRef.current?.(w),
    })
  }, [])

  /** 鳴らす・止める(1つのボタンが行き来する) */
  const toggle = useCallback((o = {}) => {
    if (stopRef.current) { stop(); return }
    play(o)
  }, [play, stop])

  /** その番号から鳴らし直す(操作盤の ◀◀ ▶▶) */
  const jump = useCallback((o = {}) => {
    stop()
    play(o)
  }, [play, stop])

  /* 画面から消えるときは必ず止める。**放っておくと鳴り続ける**
     (くり返しの指定があれば、なおさら) */
  useEffect(() => () => { stopRef.current?.(); window.clearInterval(ticker.current) }, [])

  return {
    playing, waiting, secs, at, now, repeat, setRepeat,
    play, stop, toggle, jump,
  }
}
