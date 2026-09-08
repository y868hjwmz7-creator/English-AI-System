/**
 * 設定を出す箱 — **スマホでは下から、パソコンでは吹き出し**
 * (2026-09 実機・利用者の指定)。
 *
 *   > 単語帳とQuick Response帳は…選択肢が多すぎて、どちらかというと
 *   > 設定の吹き出しなどを作ってそこで設定できるとよさそうです
 *
 * ============================================================================
 * 【なぜ2つの形を持つか】
 *
 *   吹き出しは**押したボタンの近く**に出るものなので、中身が増えるほど
 *   狭い画面では収まらなくなる(実測: 範囲8 + 個数5 + 絞り込み5 で 450px)。
 *   スマホでは**下から出るシート**のほうが、
 *
 *     ①親指が届く ②横いっぱい使える ③中が長ければそこだけ送れる
 *
 *   **判断は幅だけ**(`useWide`)。UA も `pointer` も見ない —— 横向きに
 *   すれば吹き出しになるのも素直である(CLAUDE.md)。
 *
 * 【中身は呼ぶ側が持つ】
 *   ここは**入れ物だけ。** 何を選ばせるかは知らない。
 *   だから単語帳と Quick Response で**同じものを使い回せる。**
 *
 * 【閉じ方は3つとも用意する】
 *   ✕ / 外側 / Esc。**1つしか無いと閉じ方を探すことになる**
 *   (かぶせて開くメニューと同じ決まり・CLAUDE.md)。
 *   広い画面の吹き出しは `Popover` が外側と Esc を持っているので、
 *   **同じ判定を書き写さない。**
 */
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import Popover from './Popover.jsx'
import { NAV_PUSH_AT, useWide } from '../lib/nav.js'
import { lockScroll } from '../lib/scrollLock.js'
import { CloseIcon } from './Icons.jsx'

export default function SettingsSheet({
  /** どれの近くに出すか(広い画面の吹き出しだけが使う) */
  anchorEl,
  /** 閉じたいときに呼ばれる */
  onClose,
  /** 見出し(シートの上に出す。吹き出しにも出す) */
  title = '',
  /** 中身の高さが変わったときに置き直すための合図 */
  placeKey = null,
  children,
}) {
  /* **判断は幅だけ。** 768px は「メニューがかぶせて開く」境目と同じで、
     そこから下は**親指で操作する画面**である */
  const wide = useWide(NAV_PUSH_AT)

  /* うしろを送れなくする。**自分で `body` を触らない** ——
     入れ子になったときに取り残される(`scrollLock.js`・CLAUDE.md) */
  useEffect(() => {
    if (wide) return undefined
    return lockScroll()
  }, [wide])

  /* Esc で閉じる。**広い画面では `Popover` が持っているので書かない** */
  useEffect(() => {
    if (wide) return undefined
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [wide, onClose])

  if (wide) {
    return (
      <Popover anchorEl={anchorEl} onClose={onClose}
               className="setpop" label={title} placeKey={placeKey}>
        <div className="setpop-head">
          <span className="setpop-title">{title}</span>
          <button type="button" className="nav-icon-btn"
                  onClick={onClose} aria-label="閉じる">
            <CloseIcon />
          </button>
        </div>
        {children}
      </Popover>
    )
  }

  return createPortal(
    /* **膜そのものを押しても閉じる**(外側を押した、と同じこと)。
       シートの中は `stopPropagation` で守る */
    <div className="sheet-back" onPointerDown={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}
           onPointerDown={(e) => e.stopPropagation()}>
        {/* **つまみ**(見た目だけ)。下から出てきたことが目で分かる。
            つまんで下ろす操作は付けていない —— ✕ と外側と Esc で足りる */}
        <div className="sheet-grip" aria-hidden="true" />
        <div className="sheet-head">
          <span className="sheet-title">{title}</span>
          <button type="button" className="nav-icon-btn"
                  onClick={onClose} aria-label="閉じる">
            <CloseIcon />
          </button>
        </div>
        {/* **中が長ければ、ここだけを送る。** シートそのものは動かない */}
        <div className="sheet-body">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
