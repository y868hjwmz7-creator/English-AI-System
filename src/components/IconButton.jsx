/**
 * **絵だけのボタン。触れると名前が出る**(2026-09 利用者の指定)。
 *
 * ════════════════════════════════════════════════════════════════
 * 【なぜ要るか】(2026-09 実機・利用者の指摘)
 *
 *   > 印刷/PDF・練習の記録を消す・音声ダウンロード・読み上げ音声を作り直す
 *   > この4つはアイコン化して省スペースしてください。無理やり並べすぎていて
 *   > プロの仕事とは思えません。…今後、トレーナーは通勤中に電車で教材を
 *   > 準備したりするのです。見やすくコンパクトに、移遷しやすく、を徹底して
 *   > ください。アイコン化して、触れると説明が出る仕様でよくないですか?
 *
 *   iPhone(390px)では4つが1行に入らず、**1文字ずつ縦に割れて**
 *   「印 / 刷 / P / D / F …」と読める棒が4本並んでいた。
 *   カード1枚が画面の高さを丸ごと食い、教材を見比べられない。
 *
 * 【触る端末には「カーソルを載せる」が無い】
 *   だから `title` だけでは、何のボタンか一生分からない。
 *   **長押しで名前を出す。**
 *
 *   **長押しで「実行」しない。** 2026-08 に、長押しで語の意味を開いて
 *   3度踏んだ穴がある(送ろうとして指を置いただけで開く)。
 *   ここで出るのは**消せる案内1つ**なので、間違って出ても害が無い。
 *   しかも `EnglishText` とまったく同じ作法で、
 *   **動いた・画面が送られた時点で取り消す。**
 *
 * 【長押しのあとの指離しは、押したことにしない】
 *   名前を読もうとしただけで印刷が始まっては困る。
 *   案内を出したら、**続けて来る `click` を1回だけ捨てる**(`skip`)。
 *
 * 【言葉が要る状態では、言葉を出す】
 *   「本当に消す」「集めています… 3 / 14」「作っています… 3 / 14」は、
 *   **絵では言えない。** `text` を渡した回だけ横に言葉が出て、
 *   ボタンがその幅に広がる。ふだんは絵だけに戻る。
 *   **成功と失敗を、同じ見た目で終わらせない**(CLAUDE.md)。
 * ════════════════════════════════════════════════════════════════
 */
import { useEffect, useRef, useState } from 'react'
import Popover from './Popover.jsx'

/** 長押しと見なすまで(`EnglishText` の案内と同じ) */
const HOLD_MS = 400
/** これだけ動いたら、もう「押した」ではない */
const MOVE_SLOP = 10

export default function IconButton({
  /** 絵(`Icons.jsx` の部品を JSX で渡す) */
  icon,
  /** 何のボタンか。読み上げ機・カーソル・長押しの案内で**同じ文**を使う */
  label,
  /** 状態のことば。渡した回だけ絵の右に出る(「本当に消す」など) */
  text = null,
  onClick,
  disabled = false,
  /** 押している印(うすい青)。開いているあいだの「閉じる」など */
  pressed = false,
  className = '',
}) {
  const [hintAt, setHintAt] = useState(null)
  const timer = useRef(null)
  const off = useRef(null)
  /** 長押しで案内を出した → **次の `click` は「押した」ではない** */
  const skip = useRef(false)

  const stop = () => {
    if (timer.current) { window.clearTimeout(timer.current); timer.current = null }
    off.current?.()
    off.current = null
  }
  useEffect(() => stop, [])

  /* **案内は、送ったら消える。** 誤って出ても読むものを覆い隠さない */
  useEffect(() => {
    if (!hintAt) return undefined
    const go = () => setHintAt(null)
    document.addEventListener('scroll', go, { capture: true, passive: true })
    return () => document.removeEventListener('scroll', go, { capture: true })
  }, [hintAt])

  /**
   * 指を置いているあいだ、**動いたら・画面が送られたら、長押しをやめる。**
   * ボタンの上の `pointermove` だけでは足りない —— 画面が動き始めると
   * iOS はその要素へ知らせを送らなくなる(`EnglishText` と同じ理由)。
   */
  const watch = (x, y) => {
    const onMove = (ev) => {
      const t = ev.touches?.[0] ?? ev
      if (t.clientX == null) return
      if (Math.hypot(t.clientX - x, t.clientY - y) > MOVE_SLOP) stop()
    }
    const onScroll = () => stop()
    document.addEventListener('pointermove', onMove, { passive: true })
    document.addEventListener('touchmove', onMove, { passive: true })
    document.addEventListener('scroll', onScroll, { capture: true, passive: true })
    off.current = () => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('touchmove', onMove)
      document.removeEventListener('scroll', onScroll, { capture: true })
    }
  }

  const down = (e) => {
    skip.current = false
    // **カーソルには `title` がある。** 押しっぱなしで案内を出す理由がない
    if (e.pointerType === 'mouse') return
    const el = e.currentTarget          // setTimeout の中では読めなくなる
    stop()
    watch(e.clientX, e.clientY)
    timer.current = window.setTimeout(() => {
      timer.current = null
      skip.current = true
      setHintAt(el)
    }, HOLD_MS)
  }

  return (
    <>
      <button type="button"
              className={`btn btn--small iconbtn${pressed ? ' iconbtn--on' : ''}`
                + `${text ? ' iconbtn--wide' : ''}${className ? ` ${className}` : ''}`}
              // **読み上げ機には、いつも名前を渡す**(絵だけのボタンの決まり)
              aria-label={label}
              title={label}
              disabled={disabled}
              onPointerDown={down}
              onPointerUp={stop}
              onPointerCancel={stop}
              onPointerLeave={stop}
              onClick={() => {
                if (skip.current) { skip.current = false; return }
                onClick?.()
              }}>
        {icon}
        {text ? <span className="iconbtn-text">{text}</span> : null}
      </button>

      {/* **名前を1つ出すだけ。** ここから操作はさせない ——
          押したいなら、案内を閉じてもう一度押せばよい */}
      {hintAt && (
        <Popover anchorEl={hintAt} onClose={() => setHintAt(null)}
                 className="iconbtn-hint" label={label}>
          <p className="iconbtn-hint-line">{label}</p>
        </Popover>
      )}
    </>
  )
}
