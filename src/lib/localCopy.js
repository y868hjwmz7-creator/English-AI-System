/**
 * ============================================================================
 * **手元の控え**(第5.372節・オフラインで開ける)
 *
 *   > 通勤・移動中が多い
 *
 *   枠(アプリ)と音声は Service Worker が控える。**中身は控えられない** ——
 *   `/rest/v1/` は鍵が要り、RLS で人ごとに違うものが返るので、
 *   **通信そのものを控えると、別の人のものが出る**(`swPlan.js` の `pass`)。
 *
 *   だから**読めたものを、こちら側で控える。**
 *   次に電波が無いとき、同じものを出す。
 *
 * ── **人ごとに分ける。ログアウトで捨てる** ───────────────────
 *
 *   会社の PC は**ゲストとトレーナーが同じ端末を使う**ことがある。
 *   控えに人の印を付けないと、**次に開いた人に前の人の宿題が出る。**
 *   だから鍵に**その人の id** を入れ、**ログアウトでまるごと捨てる。**
 *
 * ── **控えだと分かるように出す**(黙って出さない) ───────────
 *
 *   いつ取った控えかを一緒に持たせる。画面はそれを出す ——
 *   **古い宿題を、今日のものとして見せない。**
 *
 * ── 置き場所は IndexedDB ────────────────────────────────────
 *
 *   `localStorage` は**およそ 5MB** で、しかも**書くあいだ画面が止まる。**
 *   宿題50件ぶんの英文と訳はそれを超える。IndexedDB なら非同期で、
 *   端末の空きまで入る。**使えなければ、控えないだけ**(行き止まりにしない)。
 * ============================================================================
 */
const DB = 'eas-copy'
const STORE = 'copy'
const 版 = 1

let 開く中 = null

/** **使えなければ `null`。** 内緒窓・止めてある端末でも落ちない */
function openDb() {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null)
  if (開く中) return 開く中
  開く中 = new Promise((done) => {
    let req
    try { req = indexedDB.open(DB, 版) } catch { done(null); return }
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    req.onsuccess = () => done(req.result)
    req.onerror = () => done(null)
    req.onblocked = () => done(null)
  })
  return 開く中
}

function 取引(mode, fn) {
  return openDb().then((db) => {
    if (!db) return null
    return new Promise((done) => {
      let tx
      try { tx = db.transaction(STORE, mode) } catch { done(null); return }
      const store = tx.objectStore(STORE)
      let out = null
      try { out = fn(store) } catch { done(null); return }
      tx.oncomplete = () => done(out?.result !== undefined ? out.result : (out ?? true))
      tx.onerror = () => done(null)
      tx.onabort = () => done(null)
    })
  }).catch(() => null)
}

/* ══════════════════════════════════════════════════════════════════
 * **最後に分かっていた人を、覚えておく**
 *
 *   控えを読むには**人の印**が要る。ところが印を取りに行く
 *   `supabase.auth.getSession()` は、**切符の期限が切れていると
 *   取り直しに行く** —— 電波の無いところでは、それが失敗する。
 *
 *   **つまり、控えがいちばん要る場面で、鍵が作れない。**
 *
 *   だから**最後に分かっていた人を覚えておき**、取れなかったときに使う。
 *   **ログアウトでは、控えと一緒に忘れる**(次の人に出さないため)。
 * ══════════════════════════════════════════════════════════════════ */
let 覚えた人 = null

/** 分かったときに覚える(**空なら、何もしない**) */
export function rememberWho(id) {
  const v = String(id ?? '').trim()
  if (v) 覚えた人 = v
}

/** 最後に分かっていた人。**分からなければ `null`** */
export function lastWho() {
  return 覚えた人
}

/**
 * 控えの鍵。**人の印が無ければ控えない。**
 * @returns {string|null}
 */
export function copyKey(who, name) {
  const u = String(who ?? '').trim()
  const n = String(name ?? '').trim()
  return (u && n) ? `${u}|${n}` : null
}

/** 控える。**失敗しても何も起きない**(控えが無いだけ) */
export async function saveCopy(who, name, data) {
  const key = copyKey(who, name)
  if (!key) return false
  const r = await 取引('readwrite', (s) => s.put({ at: Date.now(), data }, key))
  return r !== null
}

/**
 * 控えを読む。
 * @returns {Promise<{data:unknown, at:number}|null>} 無ければ `null`
 */
export async function readCopy(who, name) {
  const key = copyKey(who, name)
  if (!key) return null
  const r = await 取引('readonly', (s) => s.get(key))
  return (r && typeof r === 'object' && 'data' in r) ? r : null
}

/** **ログアウトで、まるごと捨てる。** 次の人に前の人のものを見せない */
export async function dropCopies() {
  /* **覚えている人も忘れる。** 残すと、次の人の鍵として使われる */
  覚えた人 = null
  await 取引('readwrite', (s) => s.clear())
  return true
}

/** 控えが何件あるか。**数えられなければ `null`**(0 と取り違えない) */
export async function copyCount() {
  const r = await 取引('readonly', (s) => s.count())
  return typeof r === 'number' ? r : null
}
