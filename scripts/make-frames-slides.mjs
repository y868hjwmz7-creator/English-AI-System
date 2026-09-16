/**
 * **66 の型を、素人にも分かるプレゼン資料にする**(2026-09 利用者の指定)。
 *
 *   node scripts/make-frames-slides.mjs
 *   → docs/frames-slides.html   … 画面で見る・利用者の PC で刷る
 *   → docs/frames-slides.pdf    … そのまま配れる
 *
 * ============================================================================
 * 【66 型を、ここに書き写さない】
 *
 *   型と例文と訳は **`src/data/sentenceFrames.js` が唯一の出どころ**である。
 *   ここは**読んで組むだけ。** 書き写すと、型を直した日に
 *   資料だけが古くなる(`docs/sentence-frames.html` は手書きなので、
 *   `npm run test:play` が「66 型が両方に在るか」を毎回突き合わせている ——
 *   **こちらは、そもそも食い違えない**)。
 *
 *   **手で書いてあるのは「言葉の説明」だけ**(`LEAD` / `GROUP`)。
 *   節や組を足したのに説明を足し忘れたら、`npm run test:play` が赤くする。
 *
 * 【`docs/sentence-frames.html` とは役目が違う。2つとも要る】
 *
 *   | | 誰に | 何を |
 *   |---|---|---|
 *   | `sentence-frames`  | **トレーナー** | なぜその型が要るか・教える順番まで |
 *   | `frames-slides`(これ) | **素人・ゲスト・初めての人** | **1枚1つ**。見て分かる |
 *
 * 【フォント】(2026-09 利用者の指定「事態はメイリオで、英語は Arial」)
 *
 *   `font-family: Arial, Meiryo, …` の順に書く。
 *   **英字は Arial から、日本語は Arial に無いので Meiryo へ落ちる** ——
 *   これが「英語は Arial・日本語はメイリオ」を1つの指定で出す書き方である。
 *
 *   **この環境には Meiryo も Arial も入っていない**(実測: IPA と
 *   Liberation だけ)。だから**ここで刷った PDF は代役の字**になる。
 *   **利用者の Windows で HTML を開けば、指定どおりに出る**
 *   (そこから Ctrl+P で刷れば、本物のメイリオの PDF になる)。
 * ============================================================================
 */
import { chromium } from '/opt/pw-browsers/../node22/lib/node_modules/playwright/index.mjs'
import { writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { FRAME_SECTIONS, frameCount } from '../src/data/sentenceFrames.js'
import { GROUP, LEAD } from '../src/data/frameSlides.js'

/* **説明の言葉は `src/data/frameSlides.js` 1か所。** ここは読んで組むだけである
   —— この道具は読み込むと PDF まで刷るので、検証から読ませない */

/* ──────────────────────────────────────────────────────────── */

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** 1枚。**紙1ページ = スライド1枚**(`break-after`)*/
const slide = (inner, cls = '') => `<section class="slide ${cls}">${inner}</section>`

const rows = (list) => list.map((r) => `
      <tr>
        <td class="form">${esc(r.form)}</td>
        <td class="ex en">${esc(r.ex)}</td>
        <td class="ja">${esc(r.ja ?? '')}</td>
      </tr>`).join('')

/** 行が多い組は、字を詰める。**枚ごとに手で直さない**(型を足した日に崩れる) */
const DENSE_FROM = 8

const groupSlide = (sec, g, no) => slide(`
    <p class="eyebrow">${esc(sec.no)} ${esc(LEAD[sec.id].title)}</p>
    <h2>${esc(g.label)}<span class="count">${g.rows.length} 型</span></h2>
    <p class="say">${GROUP[g.id] ?? ''}</p>
    ${g.note ? `<p class="note">${esc(g.note)}</p>` : ''}
    <table${g.rows.length >= DENSE_FROM ? ' class="dense"' : ''}>
      <thead><tr><th>型</th><th>例文</th><th>意味</th></tr></thead>
      <tbody>${rows(g.rows)}</tbody>
    </table>
    <p class="foot">${no}</p>`)

const sectionSlide = (sec) => {
  const L = LEAD[sec.id]
  const n = sec.groups.reduce((t, g) => t + g.rows.length, 0)
  return slide(`
    <p class="eyebrow big">${esc(sec.no)}</p>
    <h1 class="cover-h">${esc(L.title)}</h1>
    <p class="say big">${esc(L.say)}</p>
    <div class="swap">
      <div class="swap-ja"><span class="tag">言いたいこと</span>${esc(L.before)}</div>
      <div class="arrow">↓</div>
      <div class="swap-en en"><span class="tag">英語では</span>${esc(L.after)}</div>
    </div>
    <p class="note wide">${L.note}</p>
    <p class="foot">この節に ${n} 型</p>`, 'divider')
}

const html = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<title>英文の「型」66 — 文が組み立てられるようになる</title>
<style>
  /* **英語は Arial、日本語はメイリオ**(2026-09 利用者の指定)。
     Arial を先に書くと、英字は Arial・日本語は(Arial に無いので)
     メイリオへ落ちる。**1つの指定で2つを分けられる** */
  :root {
    --ink: #1c2430; --sub: #5b6573; --line: #d6dce4;
    --accent: #2c6094; --accent-bg: #edf4f7; --accent-line: #b9cde3;
    --font: Arial, Meiryo, "メイリオ", "Hiragino Kaku Gothic ProN", sans-serif;
  }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: var(--font); color: var(--ink); background: #eef1f5; }
  /* **1枚 = 横向き16:9。** 紙でもそのまま1ページになる */
  .slide {
    width: 297mm; height: 167mm; padding: 14mm 16mm 10mm;
    background: #fff; margin: 0 auto 6mm; position: relative;
    display: flex; flex-direction: column; gap: 4mm;
    break-after: page; page-break-after: always; overflow: hidden;
  }
  .slide:last-child { break-after: auto; page-break-after: auto; }
  h1 { margin: 0; font-size: 30pt; line-height: 1.25; letter-spacing: .01em; }
  h2 { margin: 0; font-size: 21pt; line-height: 1.3; display: flex;
       align-items: baseline; gap: 4mm; flex-wrap: wrap; }
  .count { font-size: 11pt; color: var(--accent); background: var(--accent-bg);
           border: 1px solid var(--accent-line); border-radius: 999px; padding: 1mm 3mm; }
  .eyebrow { margin: 0; font-size: 11pt; color: var(--sub); letter-spacing: .08em; }
  .eyebrow.big { font-size: 40pt; color: var(--accent); line-height: 1; margin-bottom: 2mm; }
  .say { margin: 0; font-size: 13pt; line-height: 1.7; color: var(--ink); }
  .say.big { font-size: 16pt; }
  .note { margin: 0; font-size: 11pt; line-height: 1.7; color: var(--sub);
          background: var(--accent-bg); border: 1px solid var(--accent-line);
          border-radius: 3mm; padding: 3mm 4mm; }
  .note.wide { font-size: 12pt; color: var(--ink); }
  .en { font-family: Arial, sans-serif; }
  table { width: 100%; border-collapse: collapse; font-size: 10.5pt; }
  th { text-align: left; font-size: 9.5pt; color: var(--sub); font-weight: 700;
       border-bottom: 2px solid var(--line); padding: 2mm 2mm; }
  td { border-bottom: 1px solid var(--line); padding: 2.2mm 2mm; vertical-align: top;
       line-height: 1.5; }
  td.form { width: 27%; font-weight: 700; color: var(--accent); }
  td.ex { width: 40%; }
  td.ja { width: 33%; color: var(--sub); }
  /* **行が多い組は、字を詰める**(①1「させる」は 9 型ある)。
     枚ごとに手で直すと、型を足した日にどれかがはみ出す */
  table.dense { font-size: 9.5pt; }
  table.dense td { padding: 1.5mm 2mm; line-height: 1.45; }
  .foot { position: absolute; right: 16mm; bottom: 6mm; margin: 0;
          font-size: 9pt; color: var(--sub); }
  .divider { justify-content: center; }
  .swap { display: flex; flex-direction: column; gap: 2mm; align-items: flex-start;
          margin-top: 2mm; }
  .swap-ja, .swap-en { font-size: 15pt; line-height: 1.5; padding: 3mm 4mm;
          border-radius: 3mm; width: 100%; }
  .swap-ja { background: #f2f4f7; border: 1px solid var(--line); }
  .swap-en { background: var(--accent-bg); border: 1px solid var(--accent-line);
             color: var(--accent); font-weight: 700; }
  .tag { display: inline-block; font-size: 9pt; font-weight: 700; color: var(--sub);
         background: #fff; border: 1px solid var(--line); border-radius: 999px;
         padding: .5mm 2.5mm; margin-right: 3mm; vertical-align: middle;
         font-family: var(--font); }
  .arrow { font-size: 14pt; color: var(--sub); align-self: center; }
  .cover { justify-content: center; align-items: flex-start; }
  .cover h1 { font-size: 38pt; }
  .cover .say { font-size: 15pt; }
  .map { display: flex; gap: 5mm; margin-top: 2mm; }
  .map-col { flex: 1; border: 1px solid var(--line); border-radius: 3mm; padding: 4mm; }
  .map-col h3 { margin: 0 0 2mm; font-size: 13pt; color: var(--accent); }
  .map-col p { margin: 0 0 2mm; font-size: 10.5pt; color: var(--sub); line-height: 1.6; }
  .map-col ul { margin: 0; padding-left: 5mm; font-size: 10pt; line-height: 1.8; }
  .big-num { font-size: 22pt; font-weight: 700; color: var(--accent); }
  ol.how { margin: 0; padding-left: 7mm; font-size: 13pt; line-height: 2.1; }
  ol.how b { color: var(--accent); }
  @page { size: A4 landscape; margin: 0; }
  @media print { body { background: #fff; } .slide { margin: 0; box-shadow: none; } }
</style>
</head>
<body>

${slide(`
  <p class="eyebrow">英語が「出てこない」を、仕組みで解く</p>
  <h1>英文の「型」${frameCount()}<br>— 語を知っていても、文にならない理由</h1>
  <p class="say">単語は覚えた。文法も習った。<br>
    それでも口から出てこないのは、<b>組み立て方の引き出しが無い</b>からです。</p>
  <p class="note wide">この資料は、仕事で使う英文を組み立てる<b>${frameCount()} の型</b>を、
    1枚に1つずつ並べたものです。順番に読む必要はありません。</p>`, 'cover')}

${slide(`
  <h1>型とは、文の「骨」です</h1>
  <p class="say">語は<b>肉</b>。骨が無いと、肉だけがバラバラに散らばります。</p>
  <div class="swap">
    <div class="swap-ja"><span class="tag">語だけ</span>tool / share / files / instantly</div>
    <div class="arrow">↓ 骨に載せる</div>
    <div class="swap-en en"><span class="tag">型に入れる</span>This tool <u>allows you to</u> share files instantly.</div>
  </div>
  <p class="note wide">同じ骨に、別の肉を入れれば別の文になります。<br>
    <span class="en">The new contract <u>allows us to</u> start in April.</span><br>
    <b>骨を ${frameCount()} 本持てば、言えることが一気に増えます。</b></p>`)}

${slide(`
  <h1>${frameCount()} の型は、3つに分かれます</h1>
  <div class="map">
    ${FRAME_SECTIONS.map((sec) => {
    const n = sec.groups.reduce((t, g) => t + g.rows.length, 0)
    return `<div class="map-col">
        <h3>${esc(sec.no)} ${esc(LEAD[sec.id].title)}</h3>
        <p><span class="big-num">${n}</span> 型</p>
        <p>${esc(LEAD[sec.id].say)}</p>
        <ul>${sec.groups.map((g) => `<li>${esc(g.label)}</li>`).join('')}</ul>
      </div>`
  }).join('')}
  </div>
  <p class="note wide">いちばん効くのは <b>①</b> です。日本語から訳しても、まず出てこない形だからです。</p>`)}

${FRAME_SECTIONS.map((sec) => {
    const parts = [sectionSlide(sec)]
    for (const g of sec.groups) parts.push(groupSlide(sec, g, `${sec.no} ${g.label}`))
    return parts.join('\n')
  }).join('\n')}

${slide(`
  <h1>どう練習するか</h1>
  <ol class="how">
    <li><b>読む</b> … この資料で、型を眺める(いま、ここ)</li>
    <li><b>見分ける</b> … 英文を見て「これは何の型か」を言えるようにする</li>
    <li><b>使い分ける</b> … 言いたいことに、どの型を使うかを選べるようにする</li>
    <li><b>作る</b> … 型は固定したまま、<b>中身だけ入れ替えて</b>何度も口に出す</li>
  </ol>
  <p class="note wide">4 がいちばん大事です。<b>同じ骨に違う肉を入れる</b>練習を繰り返すと、
    考えなくても骨が出てくるようになります。</p>`)}

</body>
</html>
`

const out = resolve('docs/frames-slides.html')
writeFileSync(out, html)
console.log(`✅ ${out}`)

const pdf = resolve('docs/frames-slides.pdf')
const browser = await chromium.launch()
const page = await browser.newPage()
await page.goto(pathToFileURL(out).href, { waitUntil: 'networkidle' })
await page.emulateMedia({ media: 'print' })
await page.pdf({
  path: pdf,
  width: '297mm',
  height: '167mm',
  printBackground: true,
  /* **余白は中身(`.slide`)が持っている。** ここで足すと2重になる */
  margin: { top: 0, right: 0, bottom: 0, left: 0 },
})
await browser.close()
console.log(`✅ ${pdf}`)
