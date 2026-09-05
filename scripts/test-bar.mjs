/**
 * レッスン表示の帯の「持ちもの」を、実際に描いて数える。
 *
 * 【なぜ要るか】(2026-09 利用者の指定)
 *
 *   > 新しく何かを実装すると何か古いものが知らない間になくなることを
 *   > 防ぐようにできませんか?
 *
 *   帯に並ぶものは増え続ける。1つ足すたびに場所の取り合いになり、
 *   **折り返しや条件のかけ違いで、古いものが黙って消える。**
 *   `npm run lint` にも `npm run build` にも引っかからず、
 *   **その画面を、その条件で開くまで分からない。**
 *
 *   だから**実際に描かせて、並んでいるものを数える。**
 *   耳の代わりに `test:audio`、目の代わりに `test:paper` を置いたのと
 *   同じ考え方である。
 *
 * 【この検証の使い方】
 *   帯から何かを**わざと**外したときは、下の `WANT` を直す。
 *   **直さないと赤くなる** — つまり「知らない間に消えた」ことがなくなる。
 *   足したときも同じで、`WANT` に足すまで赤いままである
 *   (足したことを、必ず1回は自分の目で確かめることになる)。
 *
 * 【なぜ画面を描くのか。ソースを読むだけでは足りない】
 *   実際にあった話。メモのボタンは**ソースには書いてある**が、
 *   `learnerId` と役割の2つがそろわないと描かれない。
 *   ソースを読むだけの検証は「ある」と答えてしまう。
 *   **見えているかどうかは、描かせないと分からない。**
 */
import { spawn } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const PORT = 5198
const ROOT = new URL('..', import.meta.url).pathname

/**
 * 帯に並んでいてほしいもの。**条件ごとに書く。**
 *
 * ・`閉じる` `表示` … いつも要る
 * ・`書き込む` `印刷` … 一度決める設定と同じところ(「表示」の中)
 * ・`メモ` … **トレーナー・管理者のときだけ**(ゲストには出さない)。
 *   相手(ゲスト)がいなくても出し、**開いた中で選ばせる**
 *   (2026-09 利用者の指摘。セッションの記録は「ゲスト × 日付」で
 *   1行だが、それは書けない理由であってボタンを消す理由ではなかった)
 * ・`Listen (全体)` と操作盤 … 本文のページを開いているときだけ。
 *   **`くり返し`(反復の単位)も操作盤の持ちもの**(2026-09 利用者の指定
 *   「文章単位、段落単位、全文単位、三つ選べるような」)。
 *   狭い画面では操作盤ごと右下に浮くので、帯には出ない
 * ・スイッチの文言は **「読み上げの操作を閉じる」**(2026-09 利用者の指定)。
 *   > スマホではこのフロートプレーヤーが出ている状態をデフォルトに
 *   狭い画面では**はじめから右下に出している**ので、
 *   スイッチは「閉じる」から始まる。**既定を閉じるに戻すと、ここが赤くなる**
 *   —— そのときは、戻してよいのかを1度考えることになる
 * ・`集中モード` … **狭い画面だけ**(2026-09 利用者の指定
 *   「スマホでのこの集中モードの位置はダメです。画面上部のバーに収める方が
 *   良くないですか?」)。広い画面ではこれまでどおり右下に固定してある
 * ・`速さ` `文字` `幅` … 「◀ いま ▶」の3つ
 */
const WANT = {
  'トレーナーが、ゲストと一緒に開いている': {
    q: '?role=trainer&who=g1',
    /* パソコン(1440px)。**「表示」は出ない** — 畳まないので札も要らない */
    wide: ['閉じる', '書き込む', 'メモ', '印刷', 'Listen (全体)', 'しない', '速さ', '文字', '幅'],
    /* スマホ(390px)。「表示」に畳まれる(検証は開いてから数える)。
       通しの読み上げは**右下に浮く**ので帯には無く、帯にはスイッチだけ */
    narrow: ['閉じる', '表示', '書き込む', 'メモ', '印刷', '速さ', '文字', '幅',
      '読み上げの操作を閉じる', '集中モード'],
    hasNot: [],
  },
  'トレーナーが「教材」の画面から開いている': {
    q: '?role=trainer',
    /* **メモは、相手がいなくても出す**(2026-09 実機・利用者の指摘)。
       > 教材を開いている時のメモが消えたままです

       もとは相手(ゲスト)がいるときだけ出していた。セッションの記録は
       「ゲスト × 日付」で1枚なので、相手が決まらないと書けないためである。
       **それは書けない理由であって、ボタンを消す理由ではなかった。**
       利用者はふだんこの画面から開くので、一度も出てこなかった。
       いまは**開いた中で相手を選ばせる**(担当ゲストだけが並ぶ)。 */
    wide: ['閉じる', '書き込む', 'メモ', '印刷', 'Listen (全体)', 'しない', '速さ', '文字', '幅'],
    narrow: ['閉じる', '表示', '書き込む', 'メモ', '印刷', '速さ', '文字', '幅',
      '読み上げの操作を閉じる', '集中モード'],
    hasNot: [],
  },
  'ゲスト自身が開いている': {
    q: '?role=learner&who=g1',
    wide: ['閉じる', '書き込む', '印刷', 'Listen (全体)', 'しない', '速さ', '文字', '幅'],
    narrow: ['閉じる', '表示', '書き込む', '印刷', '速さ', '文字', '幅',
      '読み上げの操作を閉じる', '集中モード'],
    // メモを書けるのは担当トレーナー(と管理者)だけ(0032)
    hasNot: ['メモ'],
  },
}

/** 帯が1行に収まっていてほしい幅(第5.80節の実測) */
const WIDTHS = [1440, 1280, 390, 320]

let bad = 0
const ok = (s) => console.log(`✓ ${s}`)
const ng = (s, d = '') => { bad += 1; console.log(`✗ ${s}${d ? `\n    ${d}` : ''}`) }

// ── 検証用の入り口を用意する ──────────────────────────────────
// **`.env` を読ませない。** 読むと Supabase を設定済みとみなし、
// 届かない通信を待つことになる(この環境からは supabase.co に届かない)
const dir = mkdtempSync(join(tmpdir(), 'eas-bar-'))
// **設定はリポジトリの中に置く。** 外に置くと `vite` を見つけられない
// (node_modules をたどれないため)。読み込む `.env` の場所だけ外へ逃がす
const CFG = join(ROOT, 'vite.bar.config.js')
// **控え(`cacheDir`)も外に逃がす。** 既定は `node_modules/.vite` で、
// ふだんの開発サーバーと**同じ場所**である。中身が食い違うと
// 「`createRoot` が無い」のような**この検証とは関係のない失敗**が出て、
// 赤くなる(実際に一度出た)。**検証が、検証と関係ない理由で赤くならない**
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
writeFileSync(join(ROOT, '__bar.html'), `<!doctype html>
<html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>帯の検証</title></head>
<body><div id="root"></div>
<script type="module" src="/src/__screens.jsx"></script></body></html>
`)

const vite = spawn('npx', ['vite', '--config', CFG], { cwd: ROOT, stdio: 'ignore' })

const cleanup = () => {
  try { vite.kill('SIGTERM') } catch { /* もう止まっている */ }
  try { rmSync(join(ROOT, '__bar.html')) } catch { /* もう無い */ }
  try { rmSync(CFG) } catch { /* もう無い */ }
  try { rmSync(dir, { recursive: true, force: true }) } catch { /* もう無い */ }
}
process.on('exit', cleanup)

/** 立ち上がるまで待つ(最大20秒) */
async function waitUp() {
  for (let i = 0; i < 100; i += 1) {
    try {
      const r = await fetch(`http://localhost:${PORT}/__bar.html`)
      if (r.ok) return true
    } catch { /* まだ */ }
    await new Promise((r) => setTimeout(r, 200))
  }
  return false
}

if (!await waitUp()) {
  ng('開発サーバーが立ち上がらなかった', `http://localhost:${PORT}`)
  console.log(`\n❌ ${bad} 件`)
  process.exit(1)
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })

/** その画面の帯に、いま並んでいるものの名前 */
async function inventory(page) {
  // 狭い画面では「表示」に畳まれている。**開いてから数える**
  const more = await page.$('.lesson-more')
  if (more && await more.isVisible()) await more.click()
  await page.waitForTimeout(150)
  return page.$$eval('.lesson-bar', (bars) => {
    const bar = bars[0]
    if (!bar) return []
    const seen = []
    for (const el of bar.querySelectorAll('button')) {
      if (el.offsetParent === null && window.getComputedStyle(el).position !== 'fixed') continue
      const t = (el.textContent || '').trim() || el.getAttribute('aria-label') || ''
      if (t) seen.push(t)
    }
    // 「◀ いま ▶」の見出し(速さ / 文字 / 幅)
    for (const el of bar.querySelectorAll('.stepper-label')) {
      const t = (el.textContent || '').trim()
      if (t) seen.push(t)
    }
    return seen
  })
}

for (const [label, want] of Object.entries(WANT)) {
  for (const [where, width, has] of [['パソコン', 1440, want.wide], ['スマホ', 390, want.narrow]]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } })
    const errs = []
    page.on('pageerror', (e) => errs.push(String(e)))
    await page.goto(`http://localhost:${PORT}/__bar.html${want.q}`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(300)
    const got = await inventory(page)

    const missing = has.filter((n) => !got.some((g) => g === n || g.includes(n)))
    const extra = want.hasNot.filter((n) => got.some((g) => g === n))
    const head = `${label}(${where})`
    if (missing.length) {
      ng(`${head} — 帯から消えている`,
        `${missing.join(' / ')}\n    いま並んでいるもの: ${got.join(' / ')}`)
    } else ok(`${head} — ${has.length} つとも帯にある`)
    if (extra.length) ng(`${head} — 出てはいけないものが出ている`, extra.join(' / '))
    if (errs.length) ng(`${head} — 画面がエラーを出した`, errs.join('\n    '))
    await page.close()
  }
}

// ── 帯が1行に収まっているか(第5.80節の決まり)──────────────────
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.goto(`http://localhost:${PORT}/__bar.html?role=trainer&who=g1`,
    { waitUntil: 'networkidle' })
  for (const w of WIDTHS) {
    await page.setViewportSize({ width: w, height: 900 })
    await page.waitForTimeout(250)
    const m = await page.evaluate(() => {
      const bar = document.querySelector('.lesson-bar')
      return {
        h: Math.round(bar.getBoundingClientRect().height),
        over: document.documentElement.scrollWidth > window.innerWidth,
      }
    })
    // 1行はおよそ 50px。**2行になると倍**になるので、そこで見分ける
    if (m.h > 80) ng(`${w}px で帯が折り返している`, `高さ ${m.h}px(1行なら 50px ほど)`)
    else ok(`${w}px … 帯は1行(${m.h}px)`)
    if (m.over) ng(`${w}px で横にはみ出している`)
  }
  await page.close()
}

/* ── **右下の操作盤は、絶対に1行**(2026-09 実機・利用者の指定)──────
 *
 *    > 再生プレーヤーが2行になるのは絶対にダメです
 *
 *    押すものを1つ足すたびに折り返しやすくなるが、**折り返すこと自体が
 *    駄目**である。だから幅を変えて**実際に描かせ、高さで数える。**
 *    1行はおよそ 50px。2行になると倍になるので、そこで見分ける。
 *    右端が画面から出ていないかも一緒に見る(押せなくなるため)。
 */
{
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } })
  await page.goto(`http://localhost:${PORT}/__bar.html?role=trainer&who=g1`,
    { waitUntil: 'networkidle' })
  await page.waitForTimeout(300)
  for (const w of [560, 430, 390, 375, 360, 320]) {
    await page.setViewportSize({ width: w, height: 900 })
    await page.waitForTimeout(250)
    const m = await page.evaluate(() => {
      const p = document.querySelector('.player--float')
      if (!p) return null
      const r = p.getBoundingClientRect()
      return { h: Math.round(r.height), right: Math.round(r.right), win: window.innerWidth }
    })
    if (!m) { ng(`${w}px で右下の操作盤が出ていない`); continue }
    if (m.h > 70) ng(`${w}px で操作盤が2行になっている`, `高さ ${m.h}px(1行なら 50px ほど)`)
    else if (m.right > m.win) ng(`${w}px で操作盤が画面からはみ出している`, `右端 ${m.right} > ${m.win}`)
    else ok(`${w}px … 操作盤は1行(${m.h}px)`)
  }
  await page.close()
}

/* ── **集中モードの下の帯も、絶対に1行**(2026-09 実機・利用者の指定)──
 *
 *    > このスマホのプレーヤーのUI、2行ではなく1行にまとめてください
 *
 *    こちらは右下の操作盤とは**別の帯**である(集中モードの下)。
 *    文の ◀ ▶ とくり返しを足したぶん、iPhone(390px)で
 *    **61px → 97px の2段**になっていた。
 *
 *    **最後の段落も必ず測る。** そこだけ「次 ▶」が
 *    **「まとめ」という言葉のボタン**に変わるので、ふだんの段落を
 *    測っているだけでは気づけない(実際に 320px で 13px あふれていた)。
 *
 *    折り返さない指定にしてあるので、**足りなくなると外へあふれる**
 *    (隠れる)。だから高さだけでなく `scrollWidth` も見る。
 */
{
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } })
  await page.goto(`http://localhost:${PORT}/__bar.html?role=trainer&who=g1`,
    { waitUntil: 'networkidle' })
  await page.waitForTimeout(300)

  const look = () => page.evaluate(() => {
    const bar = document.querySelector('.focus-bar')
    if (!bar) return null
    const mid = bar.querySelector('.focus-mid')
    const last = [...bar.children].pop()
    return {
      h: Math.round(bar.getBoundingClientRect().height),
      over: mid ? mid.scrollWidth > mid.clientWidth + 1 : false,
      末: last ? (last.textContent || '').trim() : '',
    }
  })

  for (const w of [560, 430, 390, 375, 360, 320]) {
    await page.setViewportSize({ width: w, height: 900 })
    await page.waitForTimeout(200)
    // 集中モードへ入る(紙の「練習の行」から)
    const opened = await page.evaluate(() => {
      const b = [...document.querySelectorAll('.practice-row button')]
        .find((e) => (e.textContent || '').includes('集中モード'))
      if (!b) return false
      b.click(); return true
    })
    if (!opened) { ng(`${w}px で集中モードの入り口が無い`); continue }
    await page.waitForTimeout(350)

    let bad = false
    for (let step = 0; step < 12; step++) {
      const m = await look()
      if (!m) { ng(`${w}px で集中モードの下の帯が出ていない`); bad = true; break }
      if (m.h > 70) {
        ng(`${w}px で集中モードの下の帯が2段になっている(${m.末})`,
          `高さ ${m.h}px(1行なら 61px ほど)`)
        bad = true; break
      }
      if (m.over) {
        ng(`${w}px で集中モードの下の帯があふれている(${m.末})`,
          '折り返さない指定なので、あふれると隠れて押せなくなる')
        bad = true; break
      }
      if (m.末.includes('まとめ')) break        // 最後の段落まで見た
      const moved = await page.evaluate(() => {
        const b = [...document.querySelectorAll('.focus-bar .focus-move')].pop()
        if (!b || b.disabled) return false
        b.click(); return true
      })
      if (!moved) break
      await page.waitForTimeout(150)
    }
    if (!bad) ok(`${w}px … 集中モードの下の帯は1行(最後の段落まで)`)

    await page.evaluate(() => {
      const x = [...document.querySelectorAll('.focus button')]
        .find((e) => (e.textContent || '').includes('集中モードを終える'))
      if (x) x.click()
    })
    await page.waitForTimeout(200)
  }
  await page.close()
}

// ── ページそのものが横に送れないこと(2026-09 実機・利用者の指摘)────
//
//    > スマホで教材ページやその他のページを表示しスクロールする際に
//    > 左右にブレるので、これも固定されて動かないようにしてください。
//    > ただし、スマホやパッドを横向きにした時はその幅に
//    > レスポンシブに適合するように
//
//    `html, body { overflow-x: clip }` が効いているかを、**実際に
//    横へ送ってみて**確かめる。**`hidden` にすると貼り付く帯
//    (`position: sticky`)が効かなくなる**ので、そこも一緒に見る。
{
  const page = await browser.newPage({ viewport: { width: 390, height: 700 } })
  await page.goto(`http://localhost:${PORT}/__bar.html?role=trainer&who=g1`,
    { waitUntil: 'networkidle' })
  await page.waitForTimeout(300)
  for (const [what, w, h] of [['スマホ 縦', 390, 700], ['スマホ 横', 844, 390], ['320px', 320, 700]]) {
    await page.setViewportSize({ width: w, height: h })
    await page.waitForTimeout(200)
    const m = await page.evaluate(() => {
      // **わざと画面より広い箱を差し込んで**、横へ送れるかを試す
      const probe = document.createElement('div')
      probe.style.cssText = 'width:2000px;height:1px'
      document.body.appendChild(probe)
      window.scrollTo(500, 0)
      const x = window.scrollX
      probe.remove()
      window.scrollTo(0, 0)
      return { x, 幅: document.documentElement.clientWidth }
    })
    if (m.x !== 0) {
      ng(`${what} … 横に送れてしまう(${m.x}px)`,
        '`html, body { overflow-x: clip }` が効いていない')
    } else if (m.幅 !== w) {
      ng(`${what} … 幅が窓に合っていない`, `${m.幅} ≠ ${w}。横向きに広がらない`)
    } else ok(`${what} … 横に送れない / 幅は窓どおり(${m.幅}px)`)
  }
  await page.close()
}

/* **`hidden` にしていないこと**を、書いてあるものからも確かめる。
   `hidden` は箱を「送れる箱」に変えるので、貼り付く帯が効かなくなる */
{
  const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8')
  if (/html,\s*body\s*\{[^}]*overflow-x:\s*hidden/.test(css)) {
    ng('`html, body` を `overflow-x: hidden` にしている',
      '`clip` にする。`hidden` は送れる箱を作るので `position: sticky` が効かなくなる')
  } else if (!/html,\s*body\s*\{\s*overflow-x:\s*clip/.test(css)) {
    ng('`html, body { overflow-x: clip }` が無い', 'ページが横に送れて、左右に揺れる')
  } else ok('`html, body` は `clip`(送れる箱を作らない)')
}

await browser.close()
console.log(bad === 0 ? '\n✅ 帯の持ちものは、すべて意図どおりです' : `\n❌ ${bad} 件`)
process.exit(bad === 0 ? 0 : 1)
