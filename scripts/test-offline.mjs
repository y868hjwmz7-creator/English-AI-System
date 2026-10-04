/**
 * ============================================================================
 * **オフラインの検証**(第5.372節・2026-10-04 利用者)
 *
 *   > 通勤・移動中が多い
 *
 * ── **ここでいちばん危ない形は「控えが効いていないのに緑」** ──────
 *
 *   Service Worker は、`lint` も `build` も**一言も言わない。**
 *   しかも**壊れていても、電波があるうちは完璧に動く。**
 *   気づくのは、ゲストが地下鉄でアイコンを押した瞬間である。
 *
 *   だから、**本当に電波を切って測る**(`context.setOffline(true)`)。
 *   「`sw.js` に `caches` と書いてある」では、見張ったことにならない。
 *
 * ── **2つめに危ないのは「古い版に固まる」** ─────────────────
 *
 *   CLAUDE.md が何度も踏んでいる穴
 *   —— 「直したはずの不具合が直っていない = 古い内容が端末に残っていた」。
 *   **画面そのものは、電波があるかぎり通信が先**でなければならない。
 *   ここも**中身を書き換えて、本当に新しいほうが出るか**を測る。
 *
 * ── 走らせ方 ────────────────────────────────────────────────
 *
 *   `npm run build` で組み立て、`vite preview` で配り、Chromium で開く。
 *   **`localhost` は安全な置き場所**なので、Service Worker が動く
 *   (この環境で唯一、本物を走らせられる形である)。
 * ============================================================================
 */
import { readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const ROOT = new URL('..', import.meta.url).pathname
const PORT = 5295
const BASE = `http://localhost:${PORT}/`

let bad = 0
const ok = (s, d = '') => console.log(`✓ ${s}${d ? ` — ${d}` : ''}`)
const ng = (s, d = '') => { bad += 1; console.log(`✗ ${s}${d ? `\n    ${d}` : ''}`) }
const is = (cond, name, d = '') => (cond ? ok(name, d) : ng(name, d))
const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')
const noC = (t) => t.replace(/\/\*[\s\S]*?\*\/|\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\/.*$/gm, '')

const P = await import('../src/lib/swPlan.js')
const N = await import('../src/lib/offlineNote.js')
const F = await import('../src/lib/netFail.js')

/* ══════════════════════════════════════════════════════════════════
   ① どの URL を、どの道で取るか(素の node)
   ══════════════════════════════════════════════════════════════════ */
console.log('\n▶ 控えてよいもの / 絶対に控えないもの(素の node で測る)')
const 元 = 'https://x.github.io'
const 下 = '/English-AI-System/'
const 道 = (u, p = {}) => P.routeOf(u, { origin: 元, base: 下, ...p })
{
  /* ★ **ここがいちばん大事。** 鍵の要るものを控えたら、
       **別の人のものが出る**(RLS は人ごとに違うものを返す) */
  const 鍵の要るもの = [
    'https://zz.supabase.co/rest/v1/assignments?select=*',
    'https://zz.supabase.co/rest/v1/profiles?id=eq.1',
    'https://zz.supabase.co/auth/v1/token?grant_type=password',
    'https://zz.supabase.co/functions/v1/speak',
    'https://zz.supabase.co/storage/v1/object/sign/bgm/a.mp3',
  ]
  const 漏れ = 鍵の要るもの.filter((u) => 道(u) !== 'pass')
  is(!漏れ.length, '鍵の要るものは、1つも控えない', 漏れ.join(' / '))

  /* **既定が「触らない」か。** 知らない先が来たときに、控えてはいけない */
  is(道('https://どこか.example.com/なにか') === 'pass',
    '知らない先は、既定で触らない')

  /* **読む以外は1つも触らない**(書き込みを控えたら事故である) */
  const 書き = ['POST', 'PATCH', 'DELETE', 'PUT', 'HEAD'].filter(
    (m) => 道(`${元}${下}assets/a-1.js`, { method: m }) !== 'pass')
  is(!書き.length, '読む(GET)以外は、1つも触らない', 書き.join(' / '))

  /* 控えるもの。**出る側** */
  is(道(`${元}${下}assets/index-ab12cd.js`) === 'asset', '部品は控えが先(名前に指紋がある)')
  is(道(`${元}${下}`) === 'app', '入口は通信が先')
  is(道(`${元}${下}deep/link`, { mode: 'navigate' }) === 'app', 'どの道で開いても、画面は通信が先')
  is(道(`${元}${下}icon-192.png`) === 'app', '絵も控える')
  is(道('https://zz.supabase.co/storage/v1/object/public/clips/r/t/v/ab.mp3') === 'clip',
    '公開の置き場所の音声は控える')
  is(道('https://zz.supabase.co/storage/v1/object/public/clips/r/t/v/ab.json') === 'clip',
    '文字ごとの時刻も控える(音と同じ置き場所)')

  /* ★ **出ない側。** 控え優先にしてよいのは、**名前に指紋がある部品だけ** ——
       画面そのものを控え優先にすると、**古い版に固まる** */
  is(道(`${元}${下}index.html`) !== 'asset', '画面そのものは、控え優先にしない')
  is(道(`${元}${下}`) !== 'asset', '入口も、控え優先にしない')

  /* **別のフォルダに置かれたものは触らない**(同じ元でも、別のアプリ) */
  is(道(`${元}/ほかのアプリ/assets/a-1.js`) === 'pass', '別のフォルダのものは触らない')

  /* **http(s) 以外**(`blob:` `data:` `chrome-extension:`)は触らない */
  const 変なの = ['blob:https://x/1', 'data:text/plain,a', 'chrome-extension://abc/x.js']
    .filter((u) => 道(u) !== 'pass')
  is(!変なの.length, 'http(s) 以外は触らない', 変なの.join(' / '))
}

console.log('\n▶ 控えの名前と、捨てるもの')
{
  const a = P.cacheNamesOf('2026-10-04 15:40 UTC / abc1234')
  const b = P.cacheNamesOf('2026-10-05 09:00 UTC / def5678')
  is(a.app !== b.app && a.asset !== b.asset, '版が変われば、控えの名前も変わる')
  /* ★ **音声だけは版をまたぐ。** 出し直すたびに捨てたら、ただの落とし直しである */
  is(a.clip === b.clip, '音声の控えは、版をまたいで残る', a.clip)

  const 捨てる = P.staleCaches([a.app, a.asset, a.clip, b.app, b.asset, 'なにか'], '2026-10-05 09:00 UTC / def5678')
  is(捨てる.includes(a.app) && 捨てる.includes(a.asset),
    '古い版の控えは捨てる', 捨てる.join(' / '))
  is(!捨てる.includes(a.clip), '音声の控えは捨てない')
  is(捨てる.includes('なにか'), '身に覚えのない控えも捨てる')

  /* **溢れたぶんを、入れた順に捨てる。**
     ★ **上限ちょうどでは捨てない**(1本ずつ捨て続けると、毎回落とし直しになる) */
  const 鍵 = Array.from({ length: P.CLIP_MAX + 3 }, (_, i) => `k${i}`)
  is(P.clipEvict(鍵).length === 3, '溢れたぶんだけ捨てる')
  is(P.clipEvict(鍵)[0] === 'k0', '捨てるのは、入れた順にいちばん古いほう')
  is(P.clipEvict(鍵.slice(0, P.CLIP_MAX)).length === 0, 'ちょうどなら、1本も捨てない')
  is(P.clipEvict([]).length === 0, '1本も無くても落ちない')
}

console.log('\n▶ 登録してよい端末かどうか')
{
  is(P.canRegister({ protocol: 'https:', secure: true, has: true }) === true, '公開版では登録する')
  is(P.canRegister({ protocol: 'http:', secure: true, has: true }) === true,
    'localhost(安全な置き場所)でも登録する')
  /* ★ **出ない側。** ここを緩めると、直したものが届かなくなる */
  is(P.canRegister({ protocol: 'file:', secure: false, has: true }) === false,
    '1ファイル版(file:)では登録しない')
  is(P.canRegister({ protocol: 'https:', secure: false, has: true }) === false,
    '安全でない置き場所では登録しない')
  is(P.canRegister({ protocol: 'https:', secure: true, has: false }) === false,
    '仕組みの無いブラウザでは登録しない')
  is(P.canRegister({ protocol: 'https:', secure: true, has: true, dev: true }) === false,
    '開発中は登録しない(古い枠を掴むと、直しが届かない)')
}

console.log('\n▶ 先に落としてよい端末かどうか')
{
  is(P.keepsAhead({}) === true, '何も言ってこなければ、先に落とす')
  /* ★ **出ない側。** ここを緩めると、本人が止めている通信を勝手に使う */
  is(P.keepsAhead({ saveData: true }) === false,
    '端末が「データ節約」と言っていたら、何もしない')
  is(P.keepsAhead({ online: false }) === false, '電波が無ければ、何もしない')
  is(P.keepsAhead({ usable: false }) === false, '控えられない端末では、何もしない')
}

console.log('\n▶ 電波のせいかどうかの見分け')
{
  /* **ブラウザごとに言い方が違う。** 1つでも落とすと、そこで控えが出ない */
  const 電波 = ['Failed to fetch', 'Load failed', 'NetworkError when attempting to fetch resource.',
    'Network request failed']
  const 落ち = 電波.filter((m) => !F.isNetworkFail(m))
  is(!落ち.length, 'どのブラウザの言い方でも、電波のせいだと分かる', 落ち.join(' / '))
  is(F.isNetworkFail({ message: 'Failed to fetch' }), 'Supabase の error でも分かる')
  /* ★ **出ない側がここの本番。** 断られたのを「電波」と見ると、
       **消えた教材が、いつまでも控えから出続ける** */
  const 電波ではない = ['permission denied for table materials', 'JWT expired',
    'duplicate key value violates unique constraint', 'row not found']
  const 誤り = 電波ではない.filter((m) => F.isNetworkFail(m))
  is(!誤り.length, '断られたのを「電波のせい」と取り違えない', 誤り.join(' / '))
  is(!F.isNetworkFail(null) && !F.isNetworkFail(''), '何も無ければ、電波のせいではない')
}

console.log('\n▶ 画面に出すもの(素の node で測る)')
{
  is(N.offlineNote({}) === null, '何も無ければ、帯を出さない(空の帯で場所を取らない)')
  is(N.offlineNote({ offline: true })?.text === '電波がありません', '電波が無ければ、そう出す')
  is(N.offlineNote({ offline: true })?.action === null, '電波が無いときは、押すものを出さない')
  is(N.offlineNote({ update: true })?.action === '読み込み直す', '新しい版があれば、押せる')
  /* ★ **電波が無いあいだ読み込み直しても、新しい版は降りてこない** */
  is(N.offlineNote({ update: true, offline: true })?.text === '電波がありません',
    '電波が無いときは、効かない操作を見せない')

  const 今 = new Date('2026-10-04T14:30:00').getTime()
  is(N.copyAgeText(new Date('2026-10-04T08:12:00').getTime(), 今).startsWith('きょう'),
    '同じ日なら「きょう」と出す')
  is(/10月2日/.test(N.copyAgeText(new Date('2026-10-02T21:05:00').getTime(), 今)),
    '別の日なら日付を出す')
  /* ★ **0 と `null` を取り違えない。** 時刻が読めなければ、行ごと出さない */
  is(N.copyAgeText(null, 今) === '' && N.copyAgeText(0, 今) === '' && N.copyAgeText(NaN, 今) === '',
    '時刻が読めなければ、何も出さない')
}

console.log('\n▶ 書き写していないか(決まりは1か所)')
{
  /* **`public/sw.js` を手で置くと、決まりが2か所になる** */
  is(!existsSync(join(ROOT, 'public/sw.js')),
    'Service Worker を手で置いていない(組み立てで束ねる)')
  const sw = noC(read('src/sw.js'))
  is(/from '\.\/lib\/swPlan\.js'/.test(sw), 'Service Worker は、決まりを取り込んでいる')
  /* ★ **本番。** `sw.js` の中で道を数え直していないか */
  is(!/storage\/v1\/object\/public|rest\/v1|\/assets\//.test(sw),
    'Service Worker は、URL の見分けを自分で書いていない')
  /* **電波の見分けも1か所** */
  const sb = noC(read('src/lib/supabase.js'))
  const mt = noC(read('src/lib/materials.js'))
  const 写し = [['supabase.js', sb], ['materials.js', mt]]
    .filter(([, t]) => /failed to fetch|load failed|networkerror/i.test(t))
    .map(([n]) => n)
  is(!写し.length, '電波の見分けを書き写していない', 写し.join(' / '))

  /* ★ **「家で開いて、電車で聞く」が、本当に繋がっているか。**
       Service Worker が控えるのは**一度鳴らしたもの**だけなので、
       **開いた時点で先に落とす**呼び出しが無いと、まだ聞いていない宿題は
       電車で鳴らない。**呼んでいる場所があるか**を数える */
  const hw = noC(read('src/components/LearnerHomework.jsx'))
  is(/keepMaterialOffline\(/.test(hw), '教材を開いたら、その音声を先に控える')
  /* **その場で判断を書いていないか**(判断は `swPlan.js` 1か所) */
  is(/keepsAheadNow\(\)/.test(hw) && !/saveData/.test(hw),
    '先に落としてよいかは、画面で判断していない')

  /* ★ **逃げ道が、壊れるものの中に無いか。**
       控えが壊れているとアプリ自身が開けないので、
       **アプリの中に置いた逃げ道は、逃げ道にならない** */
  const sw2 = noC(read('src/sw.js'))
  const off = noC(read('src/lib/offline.js'))
  is(!/unregister/.test(sw2) && !/dropOffline/.test(off),
    '逃げ道を、Service Worker 側に頼っていない')
  const mic = read('public/mic-test.html')
  is(/getRegistrations\(\)/.test(mic) && /caches\.keys\(\)/.test(mic),
    '診断ページから、控えをまるごと捨てられる')
}

/* ══════════════════════════════════════════════════════════════════
   ② 本当にオフラインで開くか(組み立てて、電波を切って測る)
   ══════════════════════════════════════════════════════════════════ */
console.log('\n▶ 組み立てる')
const 組み立て = spawn('npm', ['run', 'build'], {
  cwd: ROOT, stdio: 'ignore',
  env: { ...process.env, VITE_BUILD_STAMP: '検証 1', VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' },
})
await new Promise((r) => 組み立て.on('exit', r))
is(existsSync(join(ROOT, 'dist/sw.js')), '組み立てで `dist/sw.js` が出る')
const 束 = existsSync(join(ROOT, 'dist/sw.js')) ? readFileSync(join(ROOT, 'dist/sw.js'), 'utf8') : ''
/* ★ **名前に指紋が付いていないか。** 付くと、同じ場所に置けない */
is(!/sw-[0-9a-f]{6,}\.js/.test(束) && 束.length > 0, 'Service Worker の名前に指紋が付いていない')
is(/検証 1/.test(束), '版が、そのまま差し込まれている')

/* ★ **`npx` を殺しても、中の vite は生き残る**(CLAUDE.md「残った vite を必ず殺す」)。
     別の組(`detached`)で立てて、**組ごと**止める ——
     これをしていなかったので、「サーバーを止めて測る」が
     **止まっていないサーバーを測っていた**(赤チェックで分かった)。 */
const 配る = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'],
  { cwd: ROOT, stdio: 'ignore', detached: true })
/* **組ごと、確実に止める。** SIGTERM は `npx` の中の vite に届かないことがある */
const 止める = () => {
  for (const 合図 of ['SIGTERM', 'SIGKILL']) {
    try { process.kill(-配る.pid, 合図) } catch { /* もう止まっている */ }
  }
}
const 片づけ = 止める
process.on('exit', 片づけ)

/* ★ **前の回の居座りを測らない**(CLAUDE.md「残った vite を必ず殺す」)。
     港が塞がっていると `--strictPort` は立ち上がらず、
     **古いサーバーをそのまま測る** —— 実際にそれで、
     「サーバーを止めて測る」節がまるごと嘘になっていた */
let 空いていた = false
try { await fetch(BASE) } catch { 空いていた = true }
is(空いていた, '前の回の居座りがいない(港が空いている)')

let 立った = false
for (let i = 0; i < 100 && !立った; i += 1) {
  try { 立った = (await fetch(BASE)).ok } catch { /* まだ */ }
  if (!立った) await new Promise((r) => setTimeout(r, 200))
}
if (!立った) {
  ng('配るサーバーが立ち上がらなかった', BASE)
  console.log(`\n❌ ${bad} 件`)
  process.exit(1)
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })

/* ★ **`setOffline(true)` では足りない**(作った日に測って分かった)。
     あれは **`127.0.0.1` を切らない** —— サーバーが生きているので
     **控えが1本も効いていなくても、全部つながって緑**になる。
     だから**サーバーそのものを止めて**測る。
     `setOffline` も併せて呼ぶが、あれは `navigator.onLine` のためである。 */

console.log('\n▶ 電波があるうちは、いつも新しいほうが出る(古い版に固まらない)')
const ctx = await browser.newContext()
const page = await ctx.newPage()
const 落ちた = []
page.on('pageerror', (e) => 落ちた.push(String(e)))
{
  await page.goto(BASE, { waitUntil: 'load' })
  const 動いた = await page.evaluate(() => navigator.serviceWorker.ready
    .then(() => new Promise((r) => {
      if (navigator.serviceWorker.controller) { r(true); return }
      navigator.serviceWorker.addEventListener('controllerchange', () => r(true))
      setTimeout(() => r(Boolean(navigator.serviceWorker.controller)), 4000)
    })).catch(() => false))
  is(動いた, 'Service Worker が登録されて、動き出す')
  await page.reload({ waitUntil: 'load' })
  await page.waitForTimeout(400)

  /* ★ **出ない側。** 電波があるうちは、あの帯を出さない */
  const 出ていない = await page.evaluate(
    () => !(document.body.innerText || '').includes('電波がありません'))
  is(出ていない, '電波があるときは、「電波がありません」を出さない')

  /* **配っている中身を書き換える**(新しい版を出したのと同じこと) */
  const 入口 = join(ROOT, 'dist/index.html')
  const 元の中身 = readFileSync(入口, 'utf8')
  writeFileSync(入口, 元の中身.replace('<title>', '<title>あたらしい版 '))
  try {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' })
    /* ★ **ここが本番。** 画面そのものを控え優先にすると、古い題が出る */
    is(/あたらしい版/.test(await page.title()), '電波があれば、いつも新しいほうが出る', await page.title())
  } finally {
    writeFileSync(入口, 元の中身)
  }
  await page.goto(BASE, { waitUntil: 'load' })
  await page.waitForTimeout(400)
}

console.log('\n▶ 一度聞いた音声が、サーバーが落ちても鳴るか')
{
  /* **別の港に、本物の小さなサーバーを立てる。**
     港が違えば**別の元**になり、`swPlan.js` は「公開の置き場所の音声」
     として扱う(Supabase と同じ道を通る)。
     ★ **`page.route` で差し替えてはいけない** —— あれは Service Worker の
     外側で返るので、**控えが効いていなくても鳴り続ける。** */
  const 音の港 = PORT + 1
  const 置き場所 = `http://127.0.0.1:${音の港}`
  const 届いた = []
  const 音サーバー = createServer((req, res) => {
    届いた.push(req.url)
    res.writeHead(200, {
      'content-type': /\.json(\?|$)/.test(req.url) ? 'application/json' : 'audio/mpeg',
      'access-control-allow-origin': '*',
      'cache-control': 'no-store',
    })
    res.end(/rest\/v1/.test(req.url) ? '[]' : 'ID3-ためし')
  })
  await new Promise((r) => 音サーバー.listen(音の港, '127.0.0.1', r))

  const 的 = `${置き場所}/storage/v1/object/public/clips/r1/std/v1/abc.mp3`
  const 表 = `${置き場所}/rest/v1/assignments?select=id`
  const 取る = (u) => page.evaluate((x) => fetch(x).then((r) => r.ok).catch(() => false), u)

  is(await 取る(的), '一度は取りに行ける')
  is(await 取る(表), '表のデータも、サーバーが生きていれば取れる')
  await page.waitForTimeout(500)

  /* ★ **ここが本番。本当にサーバーを止める** */
  await new Promise((r) => 音サーバー.close(r))
  届いた.length = 0

  is(await 取る(的), 'サーバーが落ちても、一度聞いた音声は鳴る')
  /* ★ **出ない側その1。** 聞いたことのない音声は鳴らない
       (**何でも鳴るなら、控えが効いているかどうか分からない**) */
  is(!(await 取る(`${置き場所}/storage/v1/object/public/clips/r1/std/v1/まだ.mp3`)),
    '聞いたことのない音声は、鳴らない')
  /* ★ **出ない側その2。ここがいちばん大事。**
       鍵の要るものを控えていたら、ここで「取れる」= **別の人のものが出る** */
  is(!(await 取る(表)), '鍵の要るもの(表のデータ)は、控えていない')
  is(!届いた.length, '控えから出しているので、サーバーには1回も行かない', 届いた.join(' / '))

  /* 本数が数えられる(**見えない費用は管理できない**) */
  /* `caches` はブラウザの中にある(ここは node なので、名前だけ外しておく) */
  /* eslint-disable no-undef */
  const 本数 = await page.evaluate(() => caches.keys()
    .then((ks) => Promise.all(ks.filter((k) => k.startsWith('clip-'))
      .map((k) => caches.open(k).then((c) => c.keys()))))
    .then((all) => all.flat().length))
  /* eslint-enable no-undef */
  is(本数 === 1, '控えてあるのは、聞いた1本だけ', String(本数))
}

console.log('\n▶ 配るサーバーを止めても開くか(**地下鉄で押したのと同じ**)')
{
  /* ★ **本当に止める。** ここから先、通信は1バイトも成り立たない */
  止める()
  let 落ちている = false
  for (let i = 0; i < 50 && !落ちている; i += 1) {
    try { await fetch(BASE) } catch { 落ちている = true }
    if (!落ちている) await new Promise((r) => setTimeout(r, 200))
  }
  /* ★ **ここを置かないと、この節まるごとが嘘になる。**
       実際、止めたつもりで止まっておらず、**入口の控えへ戻す道を
       外しても緑のまま**だった(赤チェックで分かった) */
  is(落ちている, '配るサーバーが、本当に落ちている')
  await ctx.setOffline(true)   // `navigator.onLine` を偽にするため

  /* ★ **一度も開いたことのない道で開く。**
       同じ道だと、ブラウザ自身の控えが返しているのかどうか分からない ——
       これなら、`sw.js` が入口の控えへ戻している証拠になる */
  落ちた.length = 0
  /* ★ **開けなかったら、そこで止めない。**
       `page.goto` は、開けないと例外を投げる —— 受けずに書いていたので、
       **見張りが1行も出ないまま検証そのものが落ちていた**
       (赤チェックで「赤にならない」のではなく「何も出ない」になった) */
  let 開けなかった = ''
  try {
    await page.goto(`${BASE}?地下鉄`, { waitUntil: 'domcontentloaded' })
  } catch (e) { 開けなかった = String(e?.message ?? e).split('\n')[0] }
  const 中身 = 開けなかった ? { root: 0, 文字: 開けなかった } : await page.evaluate(() => ({
    root: document.querySelector('#root')?.children.length ?? 0,
    文字: (document.body.innerText || '').slice(0, 90),
  }))
  is(中身.root > 0, 'サーバーが落ちていても、画面が描かれる',
    `入れ子 ${中身.root} / ${中身.文字.replace(/\n/g, ' ')}`)
  is(!落ちた.length, 'サーバーが落ちていても、落ちない', 落ちた.slice(0, 1).join(''))
  const 帯 = 開けなかった ? false
    : await page.evaluate(() => (document.body.innerText || '').includes('電波がありません'))
  is(帯, '電波が無いことを、画面に出している')
}

await ctx.close()
await browser.close()
片づけ()
/* **組み立てたものを残さない**(次の検証が古い dist を測る) */
try { rmSync(join(ROOT, 'dist'), { recursive: true, force: true }) } catch { /* もう無い */ }

console.log(bad ? `\n❌ ${bad} 件` : '\n✅ オフラインの検証は、すべて意図どおりです')
process.exit(bad ? 1 : 0)
