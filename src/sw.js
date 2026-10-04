/**
 * ============================================================================
 * **Service Worker**(第5.372節・オフラインで開ける)
 *
 *   判断は**1つも書かない。** どの URL をどう扱うかは
 *   `src/lib/swPlan.js` 1か所にある(素の node で確かめられる)。
 *   ここにあるのは、**その決まりを `caches` に当てはめる手つき**だけである。
 *
 * ── **これは `src/` に置くが、画面からは読み込まない** ──────────
 *
 *   `vite.config.js` が、組み立てのときに **esbuild で1本に束ねて**
 *   `dist/sw.js` に出す。だから `swPlan.js` を**書き写さずに済む。**
 *   (`public/sw.js` に手で置くと、決まりが2か所になる ——
 *    CLAUDE.md「数え方を2通り持たない」)
 *
 * ── **古い版に固まらない**(ここがいちばん危ない) ─────────────
 *
 *   - 画面そのものは**通信が先**(`app`)。電波があれば、いつも最新
 *   - 版が変われば控えの名前も変わり、**古いのは `activate` で捨てる**
 *   - それでも困ったときは、**診断ページ**(`public/mic-test.html`)から
 *     控えをまるごと捨てられる —— **ここに受け口は置かない。**
 *     壊れていたら、この窓口自体が返事をしないからである
 *
 * ── **新しいのが来ても、勝手に入れ替わらない** ───────────────
 *
 *   `install` で `skipWaiting()` を呼ぶと、**動いているページの下で
 *   古い控えが消える。** そのページがこれから取りに行く部品は
 *   古い名前なので、**開いている最中に落ちることがある。**
 *
 *   だから**待たせる。** 新しいのが控えているあいだ、画面には
 *   「新しい版があります」と出て、押したときだけ入れ替わる
 *   (`{ type: 'skip-waiting' }` → 読み込み直す)。
 *   押さなくても、**タブを全部閉じれば次に開いたときに入れ替わる。**
 *
 *   **画面そのものは通信が先**なので、待たせているあいだも
 *   `index.html` と部品はいつも最新が降りてくる ——
 *   **古い版に固まることはない。**
 * ============================================================================
 */
/* global self, caches, clients, __SW_STAMP__ */
import { routeOf, staleCaches, cacheNamesOf, clipEvict, CLIP_MAX } from './lib/swPlan.js'

/** 組み立てのときに差し込まれる版。**入っていなければ `dev`** */
const STAMP = typeof __SW_STAMP__ === 'string' ? __SW_STAMP__ : 'dev'
const NAMES = cacheNamesOf(STAMP)
/** 配られているフォルダ(`/English-AI-System/`)。**SW の置き場所から分かる** */
const BASE = new URL('./', self.location.href).pathname

self.addEventListener('install', (e) => {
  /* **入口だけ、先に控える。** アプリを入れた直後に電波が切れても開ける。
     ここで落ちても入れ替えは止めない(控えは通信のときにも溜まる) */
  e.waitUntil(caches.open(NAMES.app).then((c) => c.add(BASE)).catch(() => {}))
})

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const all = await caches.keys()
    await Promise.all(staleCaches(all, STAMP).map((n) => caches.delete(n)))
    await clients.claim()
  })())
})

/**
 * 控えに入れて、音声は溢れたぶんを**入れた順に**捨てる。
 *
 * ★ **写しは、呼ぶ側がその場で取る**(`写し()`)。
 *   ここで `res.clone()` を呼ぶと、**`caches.open()` を待つあいだに
 *   画面が中身を読み始めていて、`clone()` が断られる** ——
 *   そして控えが**1本も入らない。**
 *   しかも**鳴るほうは成功している**ので、画面を見ても分からない
 *   (`clip-1` という空の控えだけが残る・作った日に踏んだ)。
 */
async function put(cacheName, req, res) {
  if (!res) return
  const cache = await caches.open(cacheName)
  await cache.put(req, res)
  if (cacheName !== NAMES.clip) return
  const keys = await cache.keys()
  await Promise.all(clipEvict(keys, CLIP_MAX).map((k) => cache.delete(k)))
}

/** **その場で写しを取る。** 読まれる前でないと取れない */
const 写し = (res) => (res && res.ok ? res.clone() : null)

/** **控えが先。** 無ければ取りに行って、控える */
async function cacheFirst(cacheName, req) {
  const hit = await caches.match(req, { cacheName })
  if (hit) return hit
  const res = await fetch(req)
  const copy = 写し(res)
  /* 待たずに控える —— **鳴り始めを遅らせない** */
  if (copy) put(cacheName, req, copy).catch(() => { /* 置き場所が一杯。鳴らすほうは済んでいる */ })
  return res
}

/** **通信が先。** 落ちたら控え。画面そのものは、最後に入口の控えへ戻す */
async function networkFirst(req, isNav) {
  try {
    const res = await fetch(req)
    const copy = 写し(res)
    if (copy) put(NAMES.app, req, copy).catch(() => { /* 置き場所が一杯 */ })
    return res
  } catch (e) {
    const hit = await caches.match(req, { cacheName: NAMES.app })
    if (hit) return hit
    if (!isNav) throw e
    /* ★ **入口そのもの。** 中の道(`?screen=…`)で開いても、
         控えてあるのは入口なので、そこへ戻す */
    const top = await caches.match(BASE, { cacheName: NAMES.app })
    if (top) return top
    throw e
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request
  const isNav = req.mode === 'navigate'
  const road = routeOf(req.url, {
    origin: self.location.origin, base: BASE, method: req.method, mode: req.mode,
  })
  /* ★ **`pass` は `respondWith` すら呼ばない。**
       呼ぶと、この SW がその通信の責任を持つことになる ——
       鍵の付いた要求を、こちらで取り次ぐ理由が1つも無い */
  if (road === 'pass') return
  if (road === 'app') { e.respondWith(networkFirst(req, isNav)); return }
  e.respondWith(cacheFirst(road === 'clip' ? NAMES.clip : NAMES.asset, req))
})

/** 画面からの頼みごと。**返事は、頼んだ窓口へそのまま返す** */
self.addEventListener('message', (e) => {
  const msg = e.data || {}
  const reply = (v) => e.ports?.[0]?.postMessage(v)

  if (msg.type === 'skip-waiting') {
    /* **画面が「読み込み直す」を押したときだけ**入れ替わる */
    self.skipWaiting()
    reply({ ok: true })
    return
  }
  if (msg.type === 'clip-count') {
    caches.open(NAMES.clip).then((c) => c.keys())
      .then((k) => reply({ count: k.length, max: CLIP_MAX }))
      .catch(() => reply({ count: null, max: CLIP_MAX }))
    return
  }
  if (msg.type === 'clip-clear') {
    caches.delete(NAMES.clip).then(() => reply({ ok: true })).catch(() => reply({ ok: false }))
    return
  }
  if (msg.type === 'keep') {
    /* **持ち出す。** 先に落としておくと、電波の無いところで鳴る */
    const urls = Array.isArray(msg.urls) ? msg.urls : []
    caches.open(NAMES.clip).then(async (cache) => {
      let 足した = 0
      for (const u of urls) {
        if (await cache.match(u)) continue
        try {
          const res = await fetch(u)
          if (res.ok) { await cache.put(u, res.clone()); 足した += 1 }
        } catch { /* 1本落ちても、残りは続ける */ }
      }
      const keys = await cache.keys()
      await Promise.all(clipEvict(keys, CLIP_MAX).map((k) => cache.delete(k)))
      reply({ added: 足した, total: keys.length })
    }).catch(() => reply({ added: 0, total: null }))
    return
  }
})
