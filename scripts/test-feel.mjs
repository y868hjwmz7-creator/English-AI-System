/**
 * ============================================================================
 * **手触りの検証**(第5.371節・2026-10-04 利用者の指定)
 *
 *   > 本当に驚く、英語が驚くほど上達し、驚くほど楽しいアプリに変えてください
 *
 * ── なぜ機械で見るのか ──────────────────────────────────────
 *
 *   動きは **`npm run lint` も `npm run build` も素通りする。**
 *   しかも**壊れていても画面は出る** —— 押しても沈まないだけなので、
 *   開いた本人も「こういうものか」と思って終わる。
 *
 *   作った日に、まさにそれを踏んだ。**`animation-fill-mode: both`** が
 *   終わったあとも `transform: none` を居座らせ、
 *   **`:active` の沈み込みを永久に打ち消していた**(`:active` には
 *   なっているのに `transform` が `matrix(1,0,0,1,0,0)` のまま)。
 *   `getComputedStyle` を出して、初めて分かった。
 *
 * ── **ここでいちばん危ない形** ────────────────────────────────
 *
 *   **「動かないのに緑」**である。だから
 *
 *     ・**押しているあいだの `transform` を、そのまま測る**
 *       (「`:active` の決まりが CSS にある」では見張ったことにならない)
 *     ・**動きを減らす端末では、動かないこと**も測る(出ない側)
 *     ・**ヘッドレスの既定は「動きを減らす」**である ——
 *       知らずに測ると**いつも「動かない」が返り、素通りする。**
 *       だから `reducedMotion` を**明示して2通り**走らせる
 * ============================================================================
 */
import { readFileSync, writeFileSync, rmSync, mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { spawn } from 'node:child_process'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const ROOT = new URL('..', import.meta.url).pathname
const PORT = 5293

let bad = 0
const ok = (s, d = '') => console.log(`✓ ${s}${d ? ` — ${d}` : ''}`)
const ng = (s, d = '') => { bad += 1; console.log(`✗ ${s}${d ? `\n    ${d}` : ''}`) }
const is = (cond, name, d = '') => (cond ? ok(name, d) : ng(name, d))
const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')
const noC = (t) => t.replace(/\/\*[\s\S]*?\*\/|\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\/.*$/gm, '')

const M = await import('../src/lib/motion.js')
const B = await import('../src/lib/buddy.js')

/* ══════════════════════════════════════════════════════════════════
   ① 算段(素の node)
   ══════════════════════════════════════════════════════════════════ */
console.log('\n▶ 動きの決まり(素の node で測る)')
{
  /* **段は少ないほどよい。** 増やすと、迷った数だけ押し心地がばらける */
  const 段 = Object.keys(M.MOTION_MS)
  is(段.length === 4, '長さの段は4つだけ', 段.join(' / '))
  /* **押した返りは速く、祝福は長い。** 値は書き写さず、**順**で見る */
  is(M.MOTION_MS.tap < M.MOTION_MS.move
    && M.MOTION_MS.move < M.MOTION_MS.sheet
    && M.MOTION_MS.sheet < M.MOTION_MS.cheer,
  '押した返りがいちばん速く、祝福がいちばん長い',
  Object.values(M.MOTION_MS).join(' < '))
  /* **人が「すぐ」と感じる上限**(およそ 150ms)を越えていないか */
  is(M.MOTION_MS.tap <= 150, '押した返りは、すぐと感じる速さにおさまっている',
    `${M.MOTION_MS.tap}ms`)

  /* 数え上げ。**終わりの値は、必ず渡された値**になる(値を書き換えない) */
  is(M.countUpAt(85, 600, 600) === 85 && M.countUpAt(85, 600, 9999) === 85,
    '数え上げは、必ず終わりの値に落ちる')
  is(M.countUpAt(85, 600, 0) === 0, '数え上げは 0 から始まる')
  const 途中 = M.countUpAt(85, 600, 300)
  is(途中 > 0 && 途中 < 85, '数え上げは、途中で止まっていない', String(途中))
  /* **出ない側。** 時間が 0 なら、最初から終わりの値 */
  is(M.countUpAt(85, 0, 0) === 85, '動かさないときは、最初から終わりの値')
  /* **数でないものを渡されたら、数えない**(0 と null を取り違えない) */
  is(M.countUpAt(null, 600, 300) === 0 && M.countUpAt('あ', 600, 300) === 0,
    '数でないものは、駆け上がらせない')

  /* 並べる遅れ。**積み上げない**(20 枚あっても最後が 1 秒後では待たされるだけ) */
  is(M.staggerMs(0) === 0, '1枚めは待たせない')
  is(M.staggerMs(99) === M.staggerMs(M.STAGGER_MAX),
    '遅れには上限がある(何枚あっても待たされない)', `${M.staggerMs(99)}ms`)

  /* **CSS に渡す変数が、長さの段ぜんぶを含んでいるか** ——
     1つ抜けると、その動きだけ消える(しかも画面は出る) */
  const v = M.motionVars()
  const 足りない = 段.filter((k) => !(`--motion-${k}` in v))
  is(!足りない.length, 'CSS へ渡す変数に、長さの段がぜんぶ入っている',
    足りない.join(' / '))
}

console.log('\n▶ 相棒の顔(素の node で測る)')
{
  /* **出る側と出ない側の両方**(CLAUDE.md) */
  is(B.buddyFace({ ok: true }) === 'glad' && B.buddyFace({ ok: false }) === 'cheer',
    '合っていた / 違っていた で顔が変わる')
  is(B.buddyFace({ busy: true, playing: true }) === 'think',
    '待たせているときは、音より先に「考えている」顔')
  is(B.buddyFace({ playing: true }) === 'listen', '音が鳴っていれば、聞いている顔')
  is(B.buddyFace({}) === B.BUDDY_DEFAULT, '何もしていなければ、居るだけの顔')
  /* **やり切ったら、点が低くても責めない** */
  is(B.buddyFace({ done: true, score: 85 }) === 'proud'
    && B.buddyFace({ done: true, score: 20 }) === 'cheer',
  'やり切ったとき、点で顔が変わる')
  /* ★ **0 と `null` を取り違えない**(CLAUDE.md。作った日に踏んだ) */
  is(B.buddyFace({ done: true }) === 'proud'
    && B.buddyFace({ done: true, score: 0 }) === 'cheer',
  '点を渡していないのと、0 点だったのを取り違えない')
  /* **知らない顔を返さない。** 画面は顔ごとに描き分けているので、
     一覧に無いものが返ると**その場面だけ何も描かれない** */
  const 場面 = [{}, { ok: true }, { ok: false }, { busy: true }, { playing: true },
    { done: true }, { done: true, score: 0 }, { done: true, score: 100 }]
  const 外 = 場面.map(B.buddyFace).filter((f) => !B.BUDDY_FACES.includes(f))
  is(!外.length, '返す顔は、いつも一覧の中にある', 外.join(' / '))
  /* **言葉を持たせていない**(声かけと二重にしない) */
  const src = noC(read('src/lib/buddy.js'))
  is(!/BUDDY_WORDS|praise|声かけ\s*=/.test(src),
    '相棒は言葉を持たない(声かけは、やり終えた1枚の役目)')
  /* **読み上げには伝わるか** */
  const 無い = B.BUDDY_FACES.filter((f) => !B.buddyAlt(f))
  is(!無い.length, `${B.BUDDY_FACES.length} つの顔すべてに、読み上げの言葉がある`, 無い.join(' / '))
}

console.log('\n▶ CSS は、ミリ秒を1つも持たない(数を2か所に書かない)')
{
  const css = read('src/styles.css')
  /* ★ **コメントを落としてから数える**(CLAUDE.md。ここでも踏んだ)。
       この層の説明には「押して 220ms 後に測る」「transition は 19 か所」
       のような**数と語**が書いてある。落とさずに数えると、
       **説明文に当たって、いつも赤くなる**(作った日に、そうなった) */
  const 全部 = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const 頭 = css.indexOf('★ 動きと相棒(第5.371節')
  const 層 = 全部.slice(全部.indexOf('.btn,\n.home-box,'))
  is(頭 > 0 && 層.length > 500, '動きの層が styles.css にある', `${層.length} 文字`)
  /* **この層の中に、生のミリ秒が書かれていないか。**
     `motion.js` が持つものを書き写すと、片方だけ古くなる */
  const 生の秒 = [...層.matchAll(/(?:transition|animation)[^;{]*?(\d+(?:\.\d+)?)m?s/g)]
    .map((m) => m[0]).filter((x) => !/var\(--motion/.test(x))
  /* **息・まばたき・考える点の周期は、ここで持ってよい** ——
     あれは「押し心地」ではなく、相棒の呼吸である。
     それ以外(押した返り・出てくるもの・祝福)は変数から読む */
  const 押し心地 = 生の秒.filter((x) => !/buddy-/.test(x))
  is(!押し心地.length, '押した返り・出てくるもの・祝福は、長さを書き写していない',
    押し心地.slice(0, 3).join(' / '))
  /* **動きを減らす人への断りがあるか** */
  is(/@media \(prefers-reduced-motion: reduce\)/.test(層),
    '滑る動きが苦手な人には、動かさないと言っている')
}

/* ══════════════════════════════════════════════════════════════════
   ② 実機(本当に沈むか・本当に駆け上がるか)
   ══════════════════════════════════════════════════════════════════ */
const dir = mkdtempSync(join(tmpdir(), 'eas-feel-'))
const CFG = join(ROOT, 'vite.feel.config.js')
writeFileSync(CFG, `
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
  envDir: ${JSON.stringify(dir)},
  cacheDir: ${JSON.stringify(join(dir, 'vite'))},
  plugins: [react()],
  server: { port: ${PORT}, strictPort: true },
})
`)
writeFileSync(join(dir, '.env'), 'VITE_SUPABASE_URL=\nVITE_SUPABASE_ANON_KEY=\n')
/* **本物の部品を、そのまま描く。** 骨組みを別に書くと、
   **骨組みだけが直っていて本物は壊れている**が起きる(CLAUDE.md) */
writeFileSync(join(ROOT, 'src/__feel.jsx'), `
import ReactDOM from 'react-dom/client'
import './styles.css'
import { motionVars } from './lib/motion.js'
import Buddy from './components/Buddy.jsx'
import { BUDDY_FACES } from './lib/buddy.js'
import AppHome from './components/AppHome.jsx'
import SessionResult from './components/SessionResult.jsx'
import { BookIcon, PenIcon, SpeakerIcon, ShelfIcon, HomeIcon } from './components/Icons.jsx'
for (const [k, v] of Object.entries(motionVars())) {
  document.documentElement.style.setProperty(k, v)
}
const pages = [
  { id: 'hw', label: '今週の宿題', desc: 'トレーナーから届いたもの', icon: BookIcon },
  { id: 'wb', label: '単語帳', desc: '覚えた語と、まだの語', icon: PenIcon },
  { id: 'qr', label: 'Quick Response', desc: '日本語を見て、英語で言う', icon: SpeakerIcon },
  { id: 'sh', label: '本棚', desc: '冊をえらぶ', icon: ShelfIcon },
  { id: 'home', label: 'ホーム', icon: HomeIcon },
]
const list = Array.from({ length: 12 }, (_, i) => ({ ok: i < 9, en: 'x ' + i, ja: 'や ' + i }))
ReactDOM.createRoot(document.getElementById('root')).render(
  <div className="app-shell is-wide" style={{ padding: 24, display: 'grid', gap: 32 }}>
    <section className="card" id="faces">
      {BUDDY_FACES.map((f) => <Buddy key={f} face={f} size="md" />)}
    </section>
    <section className="card"><AppHome pages={pages} onPick={() => {}} /></section>
    <section className="card"><SessionResult items={list} unit="問" /></section>
  </div>,
)
`)
writeFileSync(join(ROOT, '__feel.html'), `<!doctype html>
<html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>手触りの検証</title></head>
<body><div id="root"></div>
<script type="module" src="/src/__feel.jsx"></script></body></html>
`)

const vite = spawn('npx', ['vite', '--config', CFG], { cwd: ROOT, stdio: 'ignore' })
const cleanup = () => {
  try { vite.kill('SIGTERM') } catch { /* もう止まっている */ }
  try { rmSync(join(ROOT, '__feel.html')) } catch { /* もう無い */ }
  try { rmSync(join(ROOT, 'src/__feel.jsx')) } catch { /* もう無い */ }
  try { rmSync(CFG) } catch { /* もう無い */ }
  try { rmSync(dir, { recursive: true, force: true }) } catch { /* もう無い */ }
}
process.on('exit', cleanup)

let 立った = false
for (let i = 0; i < 100 && !立った; i += 1) {
  try { 立った = (await fetch(`http://localhost:${PORT}/__feel.html`)).ok } catch { /* まだ */ }
  if (!立った) await new Promise((r) => setTimeout(r, 200))
}
if (!立った) {
  ng('開発サーバーが立ち上がらなかった', `http://localhost:${PORT}`)
  console.log(`\n❌ ${bad} 件`)
  process.exit(1)
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })

/** 押しているあいだの `transform` を、そのまま測る */
async function 押して測る(動かす) {
  const page = await browser.newPage({
    viewport: { width: 900, height: 1200 },
    /* ★ **ヘッドレスの既定は「動きを減らす」である。**
         明示しないと、いつも「動かない」が返って素通りする */
    reducedMotion: 動かす ? 'no-preference' : 'reduce',
  })
  const 落ちた = []
  page.on('pageerror', (e) => 落ちた.push(e.message))
  await page.goto(`http://localhost:${PORT}/__feel.html`, { waitUntil: 'networkidle' })
  await page.waitForSelector('.home-box')
  await page.waitForTimeout(500)
  const box = await page.locator('.home-box').first().boundingBox()
  await page.mouse.move(box.x + 30, box.y + 20)
  await page.mouse.down()
  await page.waitForTimeout(200)
  const 押し = await page.evaluate(() => {
    const el = document.querySelector('.home-box')
    return { active: el.matches(':active'), t: window.getComputedStyle(el).transform }
  })
  await page.mouse.up()
  await page.waitForTimeout(260)
  const 後 = await page.evaluate(() => {
    const el = document.querySelector('.home-box')
    return { active: el.matches(':active'), t: window.getComputedStyle(el).transform }
  })
  const 顔 = await page.locator('#faces .buddy').count()
  await page.close()
  return { 押し, 後, 落ちた, 顔 }
}

console.log('\n▶ 本当に沈むか(実機で押して、そのまま測る)')
{
  const a = await 押して測る(true)
  is(!a.落ちた.length, '描いて落ちない', a.落ちた.slice(0, 1).join(''))
  is(a.顔 === B.BUDDY_FACES.length, `相棒の顔が ${B.BUDDY_FACES.length} つとも描かれる`, String(a.顔))
  is(a.押し.active, '押しているあいだ、`:active` になっている')
  /* ★ **ここが本番。** 「CSS に決まりがある」ではなく、
       **押しているあいだの `transform` が、本当に効いているか** */
  const 沈んだ = a.押し.active && a.押し.t !== 'none' && a.押し.t !== 'matrix(1, 0, 0, 1, 0, 0)'
  is(沈んだ, '押すと沈む(登場の動きに打ち消されていない)', a.押し.t)
  /* **離したら戻る。** 戻らないと、押した跡が残り続ける */
  is(a.後.t === 'none' || a.後.t === 'matrix(1, 0, 0, 1, 0, 0)',
    '離すと元どおりになる', a.後.t)

  /* ── **出ない側。** 動きを減らす端末では沈まない ── */
  const b2 = await 押して測る(false)
  is(b2.押し.active, '動きを減らす端末でも、`:active` にはなる')
  is(b2.押し.t === 'none' || b2.押し.t === 'matrix(1, 0, 0, 1, 0, 0)',
    '動きを減らす端末では、沈まない', b2.押し.t)
}

console.log('\n▶ 本当に駆け上がるか(描く前から見張る)')
{
  for (const 動かす of [true, false]) {
    const page = await browser.newPage({
      viewport: { width: 900, height: 1200 },
      reducedMotion: 動かす ? 'no-preference' : 'reduce',
    })
    /* ★ **読み込みを待つと、もう駆け上がり終わっている。**
         描く前から見張る(作った日に、これで1度空振りした) */
    await page.addInitScript(() => {
      window.__seen = []
      const t = setInterval(() => {
        const el = document.querySelector('.sresult-score strong')
        if (el) window.__seen.push(el.textContent)
        if (window.__seen.length > 60) clearInterval(t)
      }, 35)
    })
    await page.goto(`http://localhost:${PORT}/__feel.html`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('.sresult-score strong')
    await page.waitForTimeout(1500)
    const 見た = [...new Set(await page.evaluate(() => window.__seen))]
    const 終わり = await page.locator('.sresult-score strong').first().innerText()
    await page.close()
    if (動かす) {
      is(見た.length >= 4, '点が 0 から駆け上がる', 見た.join(' → '))
      is(見た[0] === '0', '0 から始まる', String(見た[0]))
    } else {
      is(見た.length === 1, '動きを減らす端末では、駆け上がらない', 見た.join(' → '))
    }
    is(終わり === '9', 'どちらでも、終わりの数は同じ(値を書き換えていない)', 終わり)
  }
}

await browser.close()
console.log(bad === 0 ? '\n✅ 手触りの検証は、すべて意図どおりです' : `\n❌ ${bad} 件`)
process.exit(bad === 0 ? 0 : 1)
