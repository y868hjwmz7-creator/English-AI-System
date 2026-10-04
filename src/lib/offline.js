/**
 * ============================================================================
 * **オフライン —— 画面の側**(第5.372節)
 *
 *   Service Worker を登録し、**いまの状態**を画面に渡す。
 *   どの URL をどう扱うかは `swPlan.js`、当てはめるのは `sw.js`。
 *   ここは**その2つと話すだけ**で、決まりを1つも持たない。
 *
 * ── **黙って落ちない・黙って消さない** ───────────────────────
 *
 *   - 電波が無いときは、そうと分かる(`useOnline`)
 *   - 新しい版が控えているときは、**押せる操作として**出す
 *   - 控えが何本あるかを出し、**消せる**(見えない費用は管理できない)
 * ============================================================================
 */
import { useEffect, useState } from 'react'
import { canRegister, keepsAhead } from './swPlan.js'

/** いま登録してある窓口。**無ければ、何を頼んでも `null` を返すだけ** */
let reg = null

/** **この端末で登録してよいか。** 判断は `swPlan.js` に置いてある */
export function offlineUsable() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false
  return canRegister({
    protocol: window.location.protocol,
    secure: window.isSecureContext === true,
    has: 'serviceWorker' in navigator,
    dev: Boolean(import.meta.env?.DEV),
  })
}

/**
 * 登録する。**1度だけ呼ぶ**(`main.jsx`)。
 *
 * @param {(waiting: boolean) => void} onUpdate 新しい版が控えたら呼ばれる
 */
export async function startOffline(onUpdate) {
  if (!offlineUsable()) return null
  const url = `${import.meta.env.BASE_URL || '/'}sw.js`
  try {
    reg = await navigator.serviceWorker.register(url)
  } catch {
    /* **登録できなくても、アプリは何も変わらない。** 控えが無いだけ */
    return null
  }
  const 見る = () => {
    /* **すでに動いているものがあるときだけ**「新しい版」である。
       初めての登録で `waiting` は立たないし、立っても知らせる意味が無い */
    if (reg.waiting && navigator.serviceWorker.controller) onUpdate?.(true)
  }
  見る()
  reg.addEventListener('updatefound', () => {
    const w = reg.installing
    w?.addEventListener('statechange', () => { if (w.state === 'installed') 見る() })
  })
  return reg
}

/** 窓口に頼んで、返事を待つ。**返事が来なければ `null`**(待たせ続けない) */
function 頼む(msg, ms = 4000) {
  const sw = reg?.active || navigator?.serviceWorker?.controller
  if (!sw) return Promise.resolve(null)
  return new Promise((done) => {
    const ch = new MessageChannel()
    const t = window.setTimeout(() => done(null), ms)
    ch.port1.onmessage = (e) => { window.clearTimeout(t); done(e.data ?? null) }
    try { sw.postMessage(msg, [ch.port2]) } catch { window.clearTimeout(t); done(null) }
  })
}

/** 控えてある音声の本数。**数えられなければ `null`**(0 と取り違えない) */
export async function clipCount() {
  const r = await 頼む({ type: 'clip-count' })
  return Number.isFinite(r?.count) ? r.count : null
}

/** 控えてある音声を、ぜんぶ捨てる */
export async function clipClear() {
  return Boolean((await 頼む({ type: 'clip-clear' }, 10000))?.ok)
}

/** 先に落としてよい端末か。**判断は `swPlan.js` 1か所**(ここで決めない) */
export function keepsAheadNow() {
  if (typeof navigator === 'undefined') return false
  return keepsAhead({
    saveData: navigator.connection?.saveData === true,
    online: navigator.onLine !== false,
    usable: offlineUsable(),
  })
}

/**
 * **持ち出す。** その英文たちの音声を、先に落として控える。
 * @returns {Promise<{added:number,total:number|null}|null>}
 */
export async function keepClips(urls) {
  const 一覧 = (urls || []).filter(Boolean)
  if (!一覧.length) return { added: 0, total: null }
  return 頼む({ type: 'keep', urls: 一覧 }, 120000)
}

/** 新しい版に入れ替えて、読み込み直す */
export async function applyUpdate() {
  if (reg?.waiting) {
    const ch = new MessageChannel()
    try { reg.waiting.postMessage({ type: 'skip-waiting' }, [ch.port2]) } catch { /* もう居ない */ }
    await new Promise((r) => { window.setTimeout(r, 300) })
  }
  window.location.reload()
}

/* ★ **逃げ道は、ここには置かない**(第5.372節)。
     控えが壊れているときは、**アプリ自身が開けないことがある** ——
     **壊れているものに頼る逃げ道は、逃げ道にならない。**
     だから `public/mic-test.html`(診断ページ)から、素の JS で直に捨てる。 */

/** いま電波があるか。**無いときだけ、画面に出す** */
export function useOnline() {
  const [on, set] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine !== false))
  useEffect(() => {
    const up = () => set(true)
    const down = () => set(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down) }
  }, [])
  return on
}
