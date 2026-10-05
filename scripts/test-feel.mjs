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
const K = await import('../src/lib/buddyKind.js')
const H = await import('../src/lib/handLine.js')

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

console.log('\n▶ 相棒をえらぶ(妖怪 12 体・素の node で測る)')
{
  /* ★ **この一覧は手で並べる。** 画面から読み取ると、
       妖怪を1体消した日に期待も一緒に消えて**緑のまま**になる
       (第5.337節で踏んだ「見張りが、自分と同じ出どころを見ている」)。
       **一度入れたものを勝手に減らさない**(共通ルール) */
  const 居るはず = ['kappa', 'oni', 'tengu', 'yuki', 'kasa', 'zashiki',
    'nurikabe', 'rokuro', 'bakeneko', 'konaki', 'momen', 'hitotsume']
  const 居る = K.BUDDY_KINDS.map((k) => k.id)
  const 消えた = 居るはず.filter((id) => !居る.includes(id))
  is(!消えた.length, `妖怪が ${居るはず.length} 体とも居る`, 消えた.join(' / '))
  is(new Set(居る).size === 居る.length, '同じ id が2つ無い', 居る.join(' / '))
  const 名無し = K.BUDDY_KINDS.filter((k) => !k.label)
  is(!名無し.length, 'どの妖怪にも名前がある(読み上げが読む)', 名無し.map((k) => k.id).join(' / '))

  is(居る.includes(K.BUDDY_KIND_DEFAULT), '既定の妖怪は、一覧の中に居る', K.BUDDY_KIND_DEFAULT)
  /* ★ **出ない側がここの本番。** 知らない値で相棒が1人も出ない、は行き止まり */
  const 変なの = ['zzz', '', null, undefined, 0, {}]
  const 外 = 変なの.filter((v) => !居る.includes(K.buddyKindOf(v)))
  is(!外.length, '知らない値でも、必ず誰かに落ちる', String(外.length))
  is(K.buddyKindOf('oni') === 'oni', '正しい値は、そのまま通る')

  /* **鍵の名前を画面に書かない**(`TIPS_KEY` と同じ作法) */
  const nav = noC(read('src/components/NavSettings.jsx'))
  const bud = noC(read('src/components/Buddy.jsx'))
  is(!/localStorage/.test(nav) && !/localStorage/.test(bud),
    '画面は、覚える場所を自分で触らない')
  /* ★ **判断は1か所。** 画面の中で相棒の名前を書いて分けていないか */
  is(!/kind === '|kind === "/.test(nav), '設定の画面で、相棒ごとに書き分けていない')
  /* **選ばせる絵は、本物の相棒そのもの。** 別の絵を置くと、選んだ先と食い違う */
  is(/<Buddy\b/.test(nav), '選ぶところに、本物の相棒を描いている')
}

console.log('\n▶ 手で描いた線(素の node で測る)')
{
  /* ★ **同じ種なら、いつも同じ形。**
       `Math.random()` を使うと、**描き直すたびに相棒が歪み直す** ——
       画面を触るたびに顔が変わるのは、気味が悪いだけである */
  const a = H.手のまる(32, 32, 20, 20, 7)
  const b = H.手のまる(32, 32, 20, 20, 7)
  is(a === b && a.length > 40, '同じ種なら、いつも同じ形', `${a.length} 文字`)
  is(H.手のまる(32, 32, 20, 20, 9) !== a, '種が違えば、形も違う')

  /* ★ **本当に震えているか。** ここが本番 ——
       震えが 0 なら、ただのきれいな円に戻る(直す前のあれである) */
  const 読む = (d) => (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number)
  const 揺れ = 読む(H.手のまる(32, 32, 20, 20, 5, { amp: 1.4 }))
  const 素 = 読む(H.閉じる(H.まる(32, 32, 20, 20)))
  const ずれ = 揺れ.map((v, i) => Math.abs(v - (素[i] ?? v)))
  const 最大 = Math.max(...ずれ)
  is(最大 > 0.4, '線が、本当に震えている', `いちばんのずれ ${最大.toFixed(1)}px`)
  /* **震えすぎてもいけない。** 形が分からなくなる */
  is(最大 < 6, '震えすぎて、形が崩れていない', `${最大.toFixed(1)}px`)

  /* **左右をそろえない。** きれいな円は1つも使わない(あちらの絵の肝) */
  const 丸 = H.まる(32, 32, 20, 20, 13)
  is(丸.length === 13, 'きれいな円ではなく、点を並べて描く', `${丸.length} 点`)
  is(H.閉じる([[0, 0], [1, 1]]) === '', '点が少なすぎたら、線を引かない')
  is(H.ゆらす(null, 1).length === 0 && H.手の線([], 1) === '', '何も渡されなくても落ちない')
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
import { useState } from 'react'
import ReactDOM from 'react-dom/client'
import './styles.css'
import { motionVars } from './lib/motion.js'
import Buddy from './components/Buddy.jsx'
import { BUDDY_FACES } from './lib/buddy.js'
import { BUDDY_KINDS, BUDDY_KIND_DEFAULT, saveBuddyKind } from './lib/buddyKind.js'
import NavSettings from './components/NavSettings.jsx'
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
function Shell() {
  /* **本物の設定の部品をそのまま置く。** 骨組みを別に書くと、
     骨組みだけが直っていて本物は壊れている、が起きる */
  const [buddy, setBuddy] = useState(BUDDY_KIND_DEFAULT)
  return (
    <div className="app-shell is-wide" style={{ padding: 24, display: 'grid', gap: 32 }}>
      <section className="card" id="faces">
        {BUDDY_FACES.map((f) => <Buddy key={f} face={f} size="md" />)}
      </section>
      <section className="card" id="kinds">
        {BUDDY_KINDS.map((k) => (
          <span key={k.id} data-kind={k.id}>
            {BUDDY_FACES.map((f) => <Buddy key={f} kind={k.id} face={f} size="md" />)}
            <Buddy kind={k.id} face="rest" size="sm" />
          </span>
        ))}
      </section>
      <section className="card" id="pick">
        <NavSettings
          theme="light" onTheme={() => {}} palette="a" onPalette={() => {}}
          tips="off" onTips={() => {}} sound="on" onSound={() => {}}
          voiceVol={60} onVoiceVol={() => {}} bgmVol={40} onBgmVol={() => {}}
          music="off" onMusic={() => {}} songs={[]} song="" onSong={() => {}}
          showPrepare prepare="off" onPrepare={() => {}}
          clipsKept={12} onClipsClear={() => {}}
          buddy={buddy} onBuddy={(v) => setBuddy(saveBuddyKind(v))}
        />
      </section>
      <section className="card"><AppHome pages={pages} onPick={() => {}} /></section>
      <section className="card"><SessionResult items={list} unit="問" /></section>
    </div>
  )
}
ReactDOM.createRoot(document.getElementById('root')).render(<Shell />)
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

console.log('\n▶ 相棒を変えても、場所が動かないか(実機で測る)')
{
  const page = await browser.newPage({ viewport: { width: 1000, height: 1400 } })
  const 落ちた = []
  page.on('pageerror', (e) => 落ちた.push(String(e)))
  await page.goto(`http://localhost:${PORT}/__feel.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#kinds .buddy')
  await page.waitForTimeout(400)
  is(!落ちた.length, `${K.BUDDY_KINDS.length} 体とも描いて落ちない`, 落ちた.slice(0, 1).join(''))

  const 数 = await page.locator('#kinds .buddy').count()
  const はず = K.BUDDY_KINDS.length * (B.BUDDY_FACES.length + 1)
  is(数 === はず, `妖怪 ${K.BUDDY_KINDS.length} 体 × 顔 ${B.BUDDY_FACES.length} つが、ぜんぶ描かれる`, String(数))

  /* ★ **ここが本番。** 相棒を変えても・顔が変わっても、箱は 1px も動かない
       (利用者の指定「UI の配置が変化することをどの場所においても防いでください」) */
  const 箱 = await page.$$eval('#kinds .buddy--md', (els) => els.map((el) => {
    const r = el.getBoundingClientRect()
    return `${Math.round(r.width)}x${Math.round(r.height)}`
  }))
  is(new Set(箱).size === 1, '相棒が違っても・顔が違っても、箱の大きさは同じ', [...new Set(箱)].join(' / '))

  /* **絵の箱は、相棒でも大きさでも1つ。**
     立ち姿に戻しても(第5.376節)、**小さいときに顔を切り出さない** ——
     妖怪は形で見分けるもので、顔を抜くと**ぬりかべといったんもめんの
     区別がつかなくなる**(えらぶ画面が、まさにそれである) */
  const 枠 = await page.$$eval('#kinds .buddy', (els) => els.map(
    (el) => el.querySelector('svg')?.getAttribute('viewBox') ?? ''))
  is(new Set(枠).size === 1, '絵の箱は、相棒が違っても大きさが違っても同じ', [...new Set(枠)].join(' / '))

  /* ★ **顔は1か所で描いて、妖怪ごとの場所へ置いている**(第5.376節)。
       全身になったので、顔の置き場も大きさも妖怪ごとに違う ——
       ここが全部そろっていたら、**顔を12通り書き写したか、
       `顔` の指定が1体も効いていない**かのどちらかである。
       **目の場所を、絵の箱の中での割合で見る**(px で見ると、
       画面の大きさが混ざって、そこの違いだけで緑になる) */
  const 目の場 = await page.$$eval('#kinds [data-kind]', (els) => els.map((el) => {
    const svg = el.querySelector('.buddy--md svg')
    const 目 = svg?.querySelector('.buddy-ink path')
    if (!svg || !目) return ''
    const s = svg.getBoundingClientRect()
    const e = 目.getBoundingClientRect()
    if (!s.width || !s.height) return ''
    return `${Math.round(((e.top + e.height / 2) - s.top) / s.height * 100)}`
      + `/${Math.round(e.height / s.height * 100)}`
  }))
  is(!目の場.includes(''), 'どの妖怪にも、目が描かれている', 目の場.join(' '))
  is(new Set(目の場).size >= 6,
    '顔の置き場と大きさは、妖怪ごとに違う', `${new Set(目の場).size} 通り / ${目の場.length} 体`)

  /* ★ **顔を `transform` で縮めていないか。**
       `<g transform="scale(…)">` で縮めると、**線の太さまで縮む** ——
       顔の小さい妖怪(ろくろくび)だけ線が細くなり、並べたときに弱って見える。
       だから**点のほうを計算して置く**(`Face` の `P()`)。
       ここは「書いていないこと」を測る ——
       絵の中に `transform` が1つも無ければ、縮めようがない */
  const 縮め = await page.$$eval('#kinds .buddy svg *[transform]', (els) => els.length)
  is(縮め === 0, '顔を transform で縮めていない(線の太さがそろう)', `${縮め} か所`)

  /* ★ **塗りつぶしの妖怪が、ちゃんと混ざっているか。**
       全部おなじ描き方だと、並べたときに退屈になる(2026-10-05 の指定) */
  const 塗り = await page.$$eval('#kinds .buddy.is-solid',
    (els) => [...new Set(els.map((el) => [...el.classList].find((c) => c.startsWith('buddy--k-'))))].length)
  is(塗り >= 1 && 塗り < K.BUDDY_KINDS.length,
    '塗りつぶしと線だけが、どちらも居る', `塗り ${塗り} 体 / 全 ${K.BUDDY_KINDS.length} 体`)

  /* ★ **飾りの線が、塗りつぶしの相棒で消えていないか。**
       実際、うちゅうじんの触角が**白くなって1本も見えなかった**(第5.374節)——
       飾りは**からだの外**にあるので、白くなると紙に溶ける。

       ★ **箱の背景と比べてはいけない**(作った日に、これで赤チェックが空振りした)。
       箱の背景は透明なので、**どんな色にしても一致しない。**
       比べる相手は「**線だけの相棒の、同じ飾り**」である ——
       塗りつぶしかどうかで色が変わっていないことを、そのまま測る。 */
  const 飾り = await page.$$eval('#kinds .buddy', (els) => {
    const 取る = (sel) => {
      const el = document.querySelector(sel)
      return el ? window.getComputedStyle(el).stroke : ''
    }
    return {
      塗り: 取る('#kinds .buddy.is-solid .buddy-out'),
      線: 取る('#kinds .buddy:not(.is-solid) .buddy-out'),
      本数: els.length,
    }
  })
  is(Boolean(飾り.塗り) && Boolean(飾り.線),
    '塗りつぶしにも線だけにも、外の飾りがある', `${飾り.塗り} / ${飾り.線}`)
  is(飾り.塗り === 飾り.線,
    '外の飾りの色は、塗りつぶしでも変わらない(紙に溶けない)', `${飾り.塗り} / ${飾り.線}`)

  /* ★ **選び直すと、同じ画面の相棒がその場で変わるか。**
       合図が届いていないと、設定を閉じるまで絵が変わらない */
  const 今 = () => page.$eval('#faces .buddy', (el) => el.className)
  const 前 = await 今()
  /* **設定は畳んである。** 開かないと押せない(閉じた箱は測れない・共通ルール) */
  await page.click('#pick .nav-settings-sum')
  await page.waitForTimeout(250)
  const 行 = await page.locator('#pick .buddy-pick-btn').count()
  is(行 === K.BUDDY_KINDS.length, `えらぶボタンが ${K.BUDDY_KINDS.length} つ出る(12 体ぶん)`, String(行))
  const 幅前 = await page.locator('#pick .buddy-pick').boundingBox()
  await page.locator('#pick .buddy-pick-btn').nth(1).click()
  await page.waitForTimeout(300)
  const 後 = await 今()
  const 幅後 = await page.locator('#pick .buddy-pick').boundingBox()
  is(前 !== 後, '選び直すと、同じ画面の相棒がその場で変わる', `${前} → ${後}`)
  /* **押しても、まわりの物が動かない**(共通ルール) */
  is(Math.round(幅前.width) === Math.round(幅後.width)
    && Math.round(幅前.height) === Math.round(幅後.height),
    '選び直しても、えらぶ行の大きさは動かない',
    `${Math.round(幅前.width)}x${Math.round(幅前.height)} → ${Math.round(幅後.width)}x${Math.round(幅後.height)}`)
  await page.close()
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
