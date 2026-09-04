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
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
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
 * ・`メモ` … **相手(ゲスト)がいて、トレーナーが見ているときだけ。**
 *   セッションの記録は「ゲスト × 日付」で1行なので、
 *   相手がいないと書き込む先が無い(0032)
 * ・`Listen (全体)` と操作盤 … 本文のページを開いているときだけ
 * ・`速さ` `文字` `幅` … 「◀ いま ▶」の3つ
 */
const WANT = {
  'トレーナーが、ゲストと一緒に開いている': {
    q: '?role=trainer&who=g1',
    /* パソコン(1440px)。**「表示」は出ない** — 畳まないので札も要らない */
    wide: ['閉じる', '書き込む', 'メモ', '印刷', 'Listen (全体)', '速さ', '文字', '幅'],
    /* スマホ(390px)。「表示」に畳まれる(検証は開いてから数える)。
       通しの読み上げは**右下に浮く**ので帯には無く、帯にはスイッチだけ */
    narrow: ['閉じる', '表示', '書き込む', 'メモ', '印刷', '速さ', '文字', '幅',
      '読み上げの操作を開く'],
    hasNot: [],
  },
  'トレーナーが「教材」の画面から開いている': {
    q: '?role=trainer',
    wide: ['閉じる', '書き込む', '印刷', 'Listen (全体)', '速さ', '文字', '幅'],
    narrow: ['閉じる', '表示', '書き込む', '印刷', '速さ', '文字', '幅',
      '読み上げの操作を開く'],
    // 相手がいないので、セッションの記録は書けない(書き込む先が無い)
    hasNot: ['メモ'],
  },
  'ゲスト自身が開いている': {
    q: '?role=learner&who=g1',
    wide: ['閉じる', '書き込む', '印刷', 'Listen (全体)', '速さ', '文字', '幅'],
    narrow: ['閉じる', '表示', '書き込む', '印刷', '速さ', '文字', '幅',
      '読み上げの操作を開く'],
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
writeFileSync(CFG, `
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
  envDir: ${JSON.stringify(dir)},
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

await browser.close()
console.log(bad === 0 ? '\n✅ 帯の持ちものは、すべて意図どおりです' : `\n❌ ${bad} 件`)
process.exit(bad === 0 ? 0 : 1)
