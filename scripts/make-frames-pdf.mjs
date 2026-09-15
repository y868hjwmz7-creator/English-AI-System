/**
 * 「英文の『型』」の資料(`docs/sentence-frames.html`)を PDF にする。
 *
 *   node scripts/make-frames-pdf.mjs
 *   → docs/sentence-frames.pdf
 *
 * **Chromium でそのまま刷る。** `reportlab` を使わないのは、
 * 日本語のフォントを自分で組み込むことになり、表の組みも手で書くことに
 * なるためである。**画面と同じ仕組みで刷れば、見たとおりに出る。**
 */
import { chromium } from '/opt/pw-browsers/../node22/lib/node_modules/playwright/index.mjs'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

const src = resolve('docs/sentence-frames.html')
const out = resolve('docs/sentence-frames.pdf')

const browser = await chromium.launch()
const page = await browser.newPage()
await page.goto(pathToFileURL(src).href, { waitUntil: 'networkidle' })
await page.emulateMedia({ media: 'print' })
await page.pdf({
  path: out,
  format: 'A4',
  printBackground: true,
  displayHeaderFooter: true,
  headerTemplate: '<div></div>',
  /* **ページ番号は、余白の箱でしか出せない**(CLAUDE.md・単語帳の紙と同じ) */
  footerTemplate: `
    <div style="width:100%;font-family:sans-serif;font-size:7.5pt;color:#6b6e76;
                padding:0 14mm;display:flex;justify-content:space-between;">
      <span>英文の「型」— 文を組み立てる骨組み</span>
      <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
    </div>`,
  margin: { top: '16mm', right: '14mm', bottom: '18mm', left: '14mm' },
})
await browser.close()
console.log(`✅ ${out}`)
