/**
 * 吹き出し(押したものの近くに、小さな箱を出す)。
 *
 * 【なぜ部品にしたか】
 *   出す場所の決め方と、閉じ方は**どの吹き出しでも同じ**である。
 *   カレンダー(`CalendarPopover`)と、ゲストの取り組み
 *   (`TrainerLearners`)が同じことを書いていた。
 *   **同じ決まりを2か所に持たない**(CLAUDE.md)。
 *
 * 【body の直下に出す】
 *   紙(`.lesson-sheet`)のように `overflow` を持つ入れ物の中に出すと、
 *   端で切られる。`createPortal` で body の直下に出し、
 *   `position: fixed` で画面に対して置く。
 *
 * 【画面から はみ出させない】(2026-08 利用者の指定)
 *   > スクロールが下に入っている時に日付を選ぼうとすると
 *   > ちゃんと表示されません。常に全体が映るように。
 *
 *   ① まず自分の高さを測る ② 下に入らなければ**押したものの上**に出す
 *   ③ それでも入らなければ、入るところまで押し上げる
 *
 * 【閉じ方は3つとも用意する】
 *   外側を押す / Esc / 中の操作。**吹き出しの中は「外側」ではない。**
 *   開いたその指離しで閉じないよう、次の間合いから見張る。
 */
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export default function Popover({
  /** どれの近くに出すか(押したボタンの DOM) */
  anchorEl,
  /** 閉じたいときに呼ばれる */
  onClose,
  /** 箱に付ける名前(見た目は呼ぶ側の CSS で決める) */
  className = '',
  /** 読み上げ機に伝える、この吹き出しの名前 */
  label = '',
  /** 中身の高さが変わったときに置き直すための合図(月を変えた、など) */
  placeKey = null,
  children,
}) {
  const boxRef = useRef(null)
  const [pos, setPos] = useState(null)

  useEffect(() => {
    const onDown = (e) => { if (!boxRef.current?.contains(e.target)) onClose() }
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    const t = window.setTimeout(() => {
      document.addEventListener('pointerdown', onDown)
    }, 0)
    document.addEventListener('keydown', onKey)
    return () => {
      window.clearTimeout(t)
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  useEffect(() => {
    const place = () => {
      const r = anchorEl?.getBoundingClientRect()
      const h = boxRef.current?.offsetHeight ?? 320
      const w = boxRef.current?.offsetWidth ?? 300
      const margin = 8
      if (!r) { setPos({ top: margin, left: margin }); return }
      const below = window.innerHeight - r.bottom - margin
      const top = below >= h
        ? r.bottom + 6                                       // ① 下に入る
        : r.top - 6 - h >= margin
          ? r.top - 6 - h                                    // ② 上に入る
          : Math.max(margin, window.innerHeight - h - margin) // ③ 押し上げる
      setPos({
        top,
        left: Math.max(margin, Math.min(r.left, window.innerWidth - w - margin)),
      })
    }
    place()
    // 画面を送ったり、向きを変えたりしたら置き直す
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [anchorEl, placeKey])

  // **測る前は描かない。** 一度どこかに出してから動かすと、ちらつく
  const style = pos
    ? { ...pos, visibility: 'visible' }
    : { top: 0, left: 0, visibility: 'hidden' }

  return createPortal(
    <div className={className} style={style} ref={boxRef} role="dialog" aria-label={label}>
      {children}
    </div>,
    document.body,
  )
}
