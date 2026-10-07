/* 「紙(カード)」と、その左右の余白を**実測して図にする** */
import { spawn } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const REPO = '/home/user/English-AI-System'
const OUT = '/tmp/claude-0/-home-user-English-AI-System/342de889-cbab-51ad-8035-74f6750da648/scratchpad/v412'
const PORT = 5199
const dir = mkdtempSync(join(tmpdir(), 'eas-probe-'))
const CFG = join(REPO, 'vite.probe.config.js')
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
writeFileSync(join(dir, '.env'), [
  'VITE_SUPABASE_URL=https://example.invalid',
  'VITE_SUPABASE_ANON_KEY=sb_publishable_dummy_for_test',
].join('\n'))
writeFileSync(join(REPO, '__probe.html'), `<!doctype html>
<html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>probe</title></head>
<body><div id="root"></div>
<script type="module" src="/src/__screens.jsx"></script></body></html>
`)
const vite = spawn('npx', ['vite', '--config', CFG], { cwd: REPO, stdio: 'ignore' })
const cleanup = () => {
  try { vite.kill('SIGTERM') } catch { /* もう止まっている */ }
  try { rmSync(join(REPO, '__probe.html')) } catch { /* もう無い */ }
  try { rmSync(CFG) } catch { /* もう無い */ }
  try { rmSync(dir, { recursive: true, force: true }) } catch { /* もう無い */ }
}
process.on('exit', cleanup)
for (let i = 0; i < 100; i += 1) {
  try { const r = await fetch(`http://localhost:${PORT}/__probe.html`); if (r.ok) break } catch { /* まだ */ }
  await new Promise((r) => setTimeout(r, 200))
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
for (const [名, w] of [['pc', 1280], ['tablet', 834], ['phone', 390]]) {
  const page = await browser.newPage({ viewport: { width: w, height: 860 } })
  await page.goto(`http://localhost:${PORT}/__probe.html?screen=mybook`, { waitUntil: 'networkidle' })
  await page.waitForSelector('.bookpick', { timeout: 10000 })
  await page.waitForTimeout(400)
  // 基礎単語をえらぶ(語があるので、そのまま出題に入る)
  const 開 = await page.evaluate(
    () => [...document.querySelectorAll('.shelf-pick')].some((e) => e.offsetParent),
  )
  if (!開) { await page.locator('.bookpick').last().click(); await page.waitForTimeout(350) }
  await page.locator('.shelf-pick', { hasText: '基礎単語' }).first().click()
  await page.waitForTimeout(900)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)

  const 測 = await page.evaluate(() => {
    const box = (sel) => {
      const e = document.querySelector(sel)
      if (!e) return null
      const r = e.getBoundingClientRect()
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }
    }
    return {
      focus: box('.focus'),
      top: box('.focus-top'),
      body: box('.focus-body'),
      card: box('.wordcard'),
      tabs: box('.app-tabs'),
      あった: Boolean(document.querySelector('.wordcard')),
    }
  })
  console.log(名, w, JSON.stringify(測))

  // ── 余白に色を塗って図にする ───────────────────────────
  await page.evaluate(() => {
    const body = document.querySelector('.focus-body')
    const card = document.querySelector('.wordcard')
    if (!body || !card) return
    const b = body.getBoundingClientRect()
    const c = card.getBoundingClientRect()
    const 置く = (left, width, 文字, 色) => {
      if (width < 1) return
      const d = document.createElement('div')
      d.style.cssText = `position:fixed;left:${left}px;top:${b.top}px;width:${width}px;`
        + `height:${b.height}px;background:${色};z-index:9999;display:flex;`
        + 'align-items:center;justify-content:center;font:700 13px/1.3 sans-serif;'
        + 'color:#fff;text-align:center;writing-mode:vertical-rl;pointer-events:none;'
        + 'outline:2px dashed rgba(255,255,255,.9);outline-offset:-4px'
      d.textContent = 文字
      document.body.appendChild(d)
    }
    置く(b.left, c.left - b.left, `← 前へ (${Math.round(c.left - b.left)}px)`, 'rgba(37,99,235,.55)')
    置く(c.right, b.right - c.right, `次へ → (${Math.round(b.right - c.right)}px)`, 'rgba(22,163,74,.55)')
    // カードの輪郭
    const o = document.createElement('div')
    o.style.cssText = `position:fixed;left:${c.left}px;top:${c.top}px;width:${c.width}px;`
      + `height:${c.height}px;outline:3px solid #dc2626;z-index:9998;pointer-events:none`
    document.body.appendChild(o)
    const lab = document.createElement('div')
    lab.style.cssText = `position:fixed;left:${c.left}px;top:${c.top}px;z-index:10000;`
      + 'background:#dc2626;color:#fff;font:700 12px sans-serif;padding:2px 6px;pointer-events:none'
    lab.textContent = '紙(カード) .wordcard'
    document.body.appendChild(lab)
    // 上の帯は「余白ではない」
    const t = document.querySelector('.focus-top')
    if (t) {
      const r = t.getBoundingClientRect()
      const d = document.createElement('div')
      d.style.cssText = `position:fixed;left:${r.left}px;top:${r.top}px;width:${r.width}px;`
        + `height:${r.height}px;background:repeating-linear-gradient(45deg,rgba(120,120,120,.35) 0 8px,rgba(0,0,0,0) 8px 16px);`
        + 'z-index:10000;pointer-events:none;outline:2px solid #6b7280;'
        + 'display:flex;align-items:center;justify-content:center;'
        + 'font:700 12px sans-serif;color:#111'
      d.textContent = '上の帯 ← ここは余白にしない'
      document.body.appendChild(d)
    }
  })
  await page.screenshot({ path: `${OUT}/zone-${名}.png` })
  await page.close()
}
await browser.close()
