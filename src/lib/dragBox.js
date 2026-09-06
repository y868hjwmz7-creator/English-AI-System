/**
 * 浮かせた箱を、**つまんで動かす**(2026-09 利用者の指定)。
 *
 *   > PCの画面でもフロートにした時は端っこにドラッグできる部分を作って
 *   > 移動させれるようにしたいです
 *
 * ============================================================================
 * 【動かすのは、箱ぜんぶ】
 *   浮いているのは操作盤だけではない。**右下には「集中モード」も一緒に
 *   並んでいる**(`.sheet-floats`)。片方だけ動かすと、
 *   「別々に `fixed` で置かない」という決まりを破ることになる
 *   (片方が消えたときに、もう片方が飛ぶ)。だから**親の箱**を動かす。
 *
 * 【画面の外へ出さない】
 *   窓を小さくしたあと、動かした先が画面の外に残ると
 *   **二度と掴めなくなる。** 位置は必ず窓の中へ収める(`clampPos`)。
 *   ここは**何にも依存しない形**にしてあるので、素の node で確かめられる
 *   (`playMark.js` / `mp3Join.js` と同じ考え方)。
 *
 * 【覚える。ただし窓に収めてから】
 *   「一度決める設定は覚える」(CLAUDE.md)。ただし別の端末・別の向きで
 *   開くと画面の外になりうるので、**読むときにも収め直す。**
 */
import { useCallback, useEffect, useRef, useState } from 'react'

const KEY = 'eas.playerPos'

/**
 * 位置を窓の中へ収める。**何にも依存しない**(素の node で確かめられる)。
 *
 * **箱が窓より大きいときは、左上にそろえる。** そこから先はどうしようもない
 * (負の値を返すと、上や左が切れて掴めなくなる)。
 *
 * @param pos {x, y} 窓の左上からの px
 * @param box {w, h} 箱の大きさ
 * @param win {w, h} 窓の大きさ
 */
export function clampPos(pos, box, win) {
  if (!pos || !Number.isFinite(pos.x) || !Number.isFinite(pos.y)) return null
  const maxX = Math.max(0, (win?.w ?? 0) - (box?.w ?? 0))
  const maxY = Math.max(0, (win?.h ?? 0) - (box?.h ?? 0))
  return {
    x: Math.min(Math.max(pos.x, 0), maxX),
    y: Math.min(Math.max(pos.y, 0), maxY),
  }
}

function load() {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return null
    const v = JSON.parse(raw)
    return Number.isFinite(v?.x) && Number.isFinite(v?.y) ? { x: v.x, y: v.y } : null
  } catch { return null }
}

function save(pos) {
  try {
    if (pos) window.localStorage.setItem(KEY, JSON.stringify(pos))
    else window.localStorage.removeItem(KEY)
  } catch { /* 使えなくても困らない */ }
}

/**
 * @param ref      動かす箱(`.sheet-floats`)
 * @param enabled  浮かせているときだけ動かせる
 */
export default function useDragBox(ref, { enabled = true } = {}) {
  const [pos, setPos] = useState(() => load())
  const grab = useRef(null)

  /** いまの箱と窓の大きさで、位置を収め直す */
  const fit = useCallback((p) => {
    const el = ref.current
    if (!el || !p) return p
    const r = el.getBoundingClientRect()
    return clampPos(p, { w: r.width, h: r.height },
      { w: window.innerWidth, h: window.innerHeight })
  }, [ref])

  /* 窓の大きさが変わったら、必ず中へ戻す。**掴めなくなるのを防ぐ** */
  useEffect(() => {
    if (!enabled) return undefined
    const on = () => setPos((p) => (p ? fit(p) : p))
    on()
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [enabled, fit])

  /** つまみを押した。**指でもマウスでも同じ道**(pointer で受ける) */
  const onGrab = useCallback((e) => {
    const el = ref.current
    if (!el || !enabled) return
    const r = el.getBoundingClientRect()
    grab.current = { dx: e.clientX - r.left, dy: e.clientY - r.top }
    e.currentTarget.setPointerCapture?.(e.pointerId)
    // つまんでいるあいだは、画面を送らせない(指で動かすため)
    e.preventDefault()
  }, [enabled, ref])

  const onMove = useCallback((e) => {
    if (!grab.current) return
    setPos(fit({ x: e.clientX - grab.current.dx, y: e.clientY - grab.current.dy }))
  }, [fit])

  const onDrop = useCallback(() => {
    if (!grab.current) return
    grab.current = null
    setPos((p) => { save(p); return p })
  }, [])

  /** 元の場所(右下)へ戻す */
  const reset = useCallback(() => { save(null); setPos(null) }, [])

  /**
   * 箱に付ける指定。**位置を決めたときだけ**左上で置く。
   * 決めていなければ、これまでどおり CSS の右下のままである。
   */
  const style = enabled && pos
    ? { left: `${pos.x}px`, top: `${pos.y}px`, right: 'auto', bottom: 'auto' }
    : undefined

  return { pos, style, moved: !!(enabled && pos), onGrab, onMove, onDrop, reset }
}
