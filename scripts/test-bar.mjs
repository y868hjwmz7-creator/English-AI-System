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

/**
 * 帯が1行に収まっていてほしい幅(第5.80節の実測)。
 *
 * **境目でない幅も混ぜる。** 決め打ちの境目(1380px)で操作盤を
 * 出し入れしていたころは、**1380〜1400px と 861〜1024px に穴**があった
 * (2026-09 実機「またずれました」)。いまは `useFitRow` が測って詰めるので、
 * **どの幅でも入る**はずである。
 *
 * あわせて**端末の「表示を大きく」**も模す(帯の文字を 1.25 倍)。
 * 幅が同じでも入るかどうかは変わるので、**幅の一覧では拾えない。**
 */
const WIDTHS = [
  [1600, false], [1500, false], [1440, false], [1420, false], [1400, false],
  [1380, false], [1360, false], [1280, false], [1100, false], [1024, false],
  [900, false], [861, false], [860, false], [768, false], [560, false],
  [430, false], [390, false], [375, false], [320, false],
  [1600, true], [1500, true], [1440, true], [1400, true], [1380, true],
  [1100, true], [1024, true], [900, true], [861, true], [560, true],
  [390, true], [320, true],
]

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
/* **仮の接続先を置く**(2026-09)。単語帳の集中モードは、語が1つも
   無いと開かない。`supabase` が `null` だと `loadMyWordbook()` は
   何も返さないので、**形だけ**の接続先を作っておく。
   実際の通信は Playwright が差し替えるので、外へは1度も出ない
   (**この環境から Supabase へは、そもそも届かない**)。
   ほかの検証は窓口を呼ばないので、これで見え方は変わらない */
writeFileSync(join(dir, '.env'), [
  'VITE_SUPABASE_URL=https://example.invalid',
  'VITE_SUPABASE_ANON_KEY=sb_publishable_dummy_for_test',
].join('\n'))

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
  for (const [w, big] of WIDTHS) {
    await page.setViewportSize({ width: w, height: 900 })
    await page.waitForTimeout(200)
    // 端末の「表示を大きく」を模す(13px → 16px。およそ 1.25 倍)
    await page.evaluate((on) => {
      document.getElementById('eas-bigbar')?.remove()
      if (!on) return
      const st = document.createElement('style')
      st.id = 'eas-bigbar'
      st.textContent = '.lesson-bar .btn, .lesson-bar .player-at,'
        + ' .lesson-bar .stepper { font-size: 16px !important }'
      document.head.appendChild(st)
    }, big)
    await page.waitForTimeout(200)
    const m = await page.evaluate(() => {
      const bar = document.querySelector('.lesson-bar')
      return {
        h: Math.round(bar.getBoundingClientRect().height),
        over: document.documentElement.scrollWidth > window.innerWidth,
      }
    })
    const 印 = big ? `${w}px(文字 1.25 倍)` : `${w}px`
    // 1行はおよそ 50px。**2行になると倍**になるので、そこで見分ける
    if (m.h > 80) ng(`${印} で帯が折り返している`, `高さ ${m.h}px(1行なら 50px ほど)`)
    else ok(`${印} … 帯は1行(${m.h}px)`)
    if (m.over) ng(`${印} で横にはみ出している`)
  }
  await page.evaluate(() => document.getElementById('eas-bigbar')?.remove())
  await page.close()
}

/* ── **どのトレーニングでも、読み上げの操作盤が出る**(2026-09 利用者の指定)──
 *
 *    > 文型トレーニングに上のバーのプレーヤーが出ません。
 *    > どんなトレーニングでも出るようにして下さい。
 *
 *    以前は「本文(記事・会話)の演習か」で出し分けていたので、
 *    **文型ドリル・単語・フレーズ・内容の理解では1つも出なかった。**
 *    いまは**鳴らせるものが1つでもあるか**で決める(`canPlayAll`)。
 *
 *    **誤り訂正と穴埋めだけは、出ないのが正しい**(`audioFrom: null`)。
 *    誤った英文を手本として聞かせられないので、鳴らすものが無い。
 *    **出す / 出さないの両方を見る** —— 片方だけだと、
 *    「全部に出す」と書き換えても緑のままになる。
 */
{
  const page = await browser.newPage({ viewport: { width: 1500, height: 900 } })
  await page.goto(`http://localhost:${PORT}/__bar.html?role=trainer&who=g1&kind=drill`,
    { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  console.log('\n── 文型ドリルでも、読み上げの操作盤が出る ──')

  /** いま出ている操作盤(帯の中 / 右下)と、そこに出ている数 */
  const seen = () => page.evaluate(() => ({
    bar: !!document.querySelector('.player--bar'),
    float: !!document.querySelector('.player--float'),
    launch: !!document.querySelector('.player-launch'),
    at: document.querySelector('.player-at')?.textContent?.trim() ?? null,
  }))
  /** ページを送る(◀ ▶ は帯の中にある) */
  const go = async (n) => {
    for (let i = 0; i < n; i += 1) {
      await page.click('[aria-label="次のページ"]')
      await page.waitForTimeout(200)
    }
  }

  // ① 英文和訳(`prompt_en` を読む)。**広い画面では帯の中に出る**
  {
    const m = await seen()
    if (!m.bar) ng('文型ドリル(英文和訳)で、上の帯に操作盤が出ていない')
    else if (!/3/.test(m.at ?? '')) ng('問数が出ていない', `「${m.at}」`)
    else ok(`英文和訳 … 上の帯に操作盤が出る(${m.at})`)
  }

  // ② 和文英訳。**読むのは `answer`** —— `prompt_en` は無い
  await go(1)
  {
    const m = await seen()
    if (!m.bar) ng('和文英訳で操作盤が出ていない(読むのは answer である)')
    else if (!/2/.test(m.at ?? '')) ng('和文英訳の問数がちがう', `「${m.at}」`)
    else ok(`和文英訳 … 解答を読む形でも出る(${m.at})`)
  }

  // ③ 誤り訂正。**出ないのが正しい**(誤った英文を手本にできない)
  await go(1)
  {
    const m = await seen()
    if (m.bar || m.float || m.launch) {
      ng('誤り訂正で操作盤が出ている', '誤った英文を読み上げてしまう')
    } else ok('誤り訂正 … 操作盤そのものが出ない(効かない操作を見せない)')
  }

  // ④ 狭い画面では、いつも見える行に**スイッチ**が出て、右下が開く
  await page.setViewportSize({ width: 390, height: 900 })
  await page.waitForTimeout(200)
  await page.click('[aria-label="前のページ"]')
  await page.waitForTimeout(250)
  {
    const m = await seen()
    if (!m.launch) ng('狭い画面の文型ドリルで、操作盤のスイッチが出ていない')
    else if (!m.float) ng('狭い画面の文型ドリルで、右下の操作盤が開いていない')
    else ok('狭い画面 … スイッチと右下の操作盤が出る')
  }

  /* ⑤ **集中モードは本文だけ。** ドリルには読む本文が無いので、
        右下に出しても行き止まりになる */
  {
    const n = await page.$$eval('.sheet-float', (xs) => xs.length)
    if (n) ng('本文の無い教材に、右下の「集中モード」が出ている')
    else ok('文型ドリル … 右下に集中モードは出さない(読む本文が無い)')
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
 *
 *    **高さと右端だけでは足りない**(2026-09 実機・利用者の指摘
 *    「スマホで『繰り返す』がはみ出てしまう」)。操作盤は
 *    `flex: 0 1 auto; min-width: 0` で**自分は縮む**ので、右端は画面の
 *    内側のままでも、**中身がその箱からあふれて切れる。**
 *    だから `scrollWidth` も見る。
 *
 *    あわせて**端末の「表示を大きく」**も模す(操作盤の文字を 1.25 倍)。
 *    幅が同じでも入るかどうかは変わるので、**幅の一覧では拾えない。**
 */
{
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } })
  await page.goto(`http://localhost:${PORT}/__bar.html?role=trainer&who=g1`,
    { waitUntil: 'networkidle' })
  await page.waitForTimeout(300)
  for (const [w, big] of [
    [560, false], [430, false], [402, false], [393, false], [390, false],
    [384, false], [375, false], [368, false], [360, false], [344, false], [320, false],
    [430, true], [402, true], [390, true], [375, true], [360, true], [320, true],
  ]) {
    await page.setViewportSize({ width: w, height: 900 })
    await page.waitForTimeout(180)
    await page.evaluate((on) => {
      document.getElementById('eas-bigplayer')?.remove()
      if (!on) return
      const st = document.createElement('style')
      st.id = 'eas-bigplayer'
      st.textContent = '.player--float .btn, .player--float .player-at'
        + ' { font-size: 16px !important }'
      document.head.appendChild(st)
    }, big)
    await page.waitForTimeout(180)
    const m = await page.evaluate(() => {
      const p = document.querySelector('.player--float')
      if (!p) return null
      const r = p.getBoundingClientRect()
      return {
        h: Math.round(r.height), right: Math.round(r.right), win: window.innerWidth,
        // **自分は縮むので、中身のあふれも見る**(切れても高さは変わらない)
        spill: [p, ...p.children].some((b) => b.scrollWidth > b.clientWidth + 1),
      }
    })
    const 印 = big ? `${w}px(文字 1.25 倍)` : `${w}px`
    if (!m) { ng(`${印} で右下の操作盤が出ていない`); continue }
    if (m.h > 70) ng(`${印} で操作盤が2行になっている`, `高さ ${m.h}px(1行なら 50px ほど)`)
    else if (m.right > m.win) ng(`${印} で操作盤が画面からはみ出している`, `右端 ${m.right} > ${m.win}`)
    else if (m.spill) ng(`${印} で操作盤の中身があふれている`, 'くり返しの単位が画面の外へ切れる')
    else ok(`${印} … 操作盤は1行(${m.h}px)・あふれ無し`)
  }
  await page.evaluate(() => document.getElementById('eas-bigplayer')?.remove())
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
    const top = document.querySelector('.focus-top')
    if (!bar || !top) return null
    const spill = (el) => [el, ...el.children].some((b) => b.scrollWidth > b.clientWidth + 1)
    const mid = bar.querySelector('.focus-mid')
    return {
      h: Math.round(bar.getBoundingClientRect().height),
      上: Math.round(top.getBoundingClientRect().height),
      // **上の帯も一緒に見る。** 最後の段落では「まとめ」がそちらに増える
      over: spill(bar) || spill(top) || (mid ? spill(mid) : false),
      // 最後の段落だけ「まとめ」が出る。**そこまで送って測る**
      末: /まとめ/.test(top.textContent || '') ? 'まとめ' : '中ほど',
    }
  })

  /* **境目でない幅も混ぜる。** 決め打ちの境目で詰めていたころは、
     360px は入るのに **375px だけ余りが 8px** という穴があった。
     いまは測って詰めるので、**どの幅でも入る**はずである。
     あわせて **端末の「表示を大きく」** も模す(帯の文字を 1.25 倍)。
     幅が同じでも入るかどうかは変わる —— そこが幅の境目では拾えない */
  for (const [w, big] of [
    [560, false], [430, false], [402, false], [393, false], [390, false],
    [384, false], [375, false], [368, false], [360, false], [344, false], [320, false],
    [430, true], [402, true], [390, true], [375, true], [360, true], [320, true],
  ]) {
    await page.setViewportSize({ width: w, height: 900 })
    await page.waitForTimeout(200)
    await page.evaluate((on) => {
      const id = 'eas-bigtext'
      document.getElementById(id)?.remove()
      if (!on) return
      const st = document.createElement('style')
      st.id = id
      st.textContent = '.focus-bar .btn, .focus-bar .player-at { font-size: 15px !important }'
      document.head.appendChild(st)
    }, big)
    await page.waitForTimeout(150)
    const 印 = big ? `${w}px(文字 1.25 倍)` : `${w}px`
    // 集中モードへ入る(紙の「練習の行」から)
    const opened = await page.evaluate(() => {
      const b = [...document.querySelectorAll('.practice-row button')]
        .find((e) => (e.textContent || '').includes('集中モード'))
      if (!b) return false
      b.click(); return true
    })
    if (!opened) { ng(`${印} で集中モードの入り口が無い`); continue }
    await page.waitForTimeout(350)

    let bad = false
    for (let step = 0; step < 12; step++) {
      const m = await look()
      if (!m) { ng(`${印} で集中モードの下の帯が出ていない`); bad = true; break }
      if (m.h > 70 || m.上 > 70) {
        ng(`${印} で集中モードの帯が2段になっている(${m.末})`,
          `下 ${m.h}px / 上 ${m.上}px(どちらも1行なら 60px ほど)`)
        bad = true; break
      }
      if (m.over) {
        ng(`${印} で集中モードの下の帯があふれている(${m.末})`,
          '折り返さない指定なので、あふれると隠れて押せなくなる')
        bad = true; break
      }
      if (m.末.includes('まとめ')) break        // 最後の段落まで見た
      // 段落を送るのは**プレーヤーの「◀ 3 / 6 段落 ▶」**(2026-09 利用者の指定
      // 「これと同じにすれば収まりますよね?」で、両端の「前 / 次」は無くした)
      const moved = await page.evaluate(() => {
        const pill = document.querySelector('.focus-mid .player-at')?.closest('.listenpill')
        const b = pill ? [...pill.querySelectorAll('.listenpill-arrow')].pop() : null
        if (!b || b.disabled) return false
        b.click(); return true
      })
      if (!moved) break
      await page.waitForTimeout(150)
    }
    if (!bad) ok(`${印} … 集中モードの帯は上下とも1行(最後の段落まで)`)

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

/* ── **単語帳の集中モードは、カードで画面を使い切る**(2026-09 利用者の指定)──
 *
 *   > もっと大きく画面を使ってください。出会った英文を押した際に
 *   > いちいちスクロールしなければいけない回数が減るからです
 *
 *   直す前は iPhone(390×844)でカードが **311px**(画面の 1/3 強)しか
 *   使っておらず、出題の枠は **144px** だった。だから「出会った文」を
 *   開くと、その狭い枠の中で送ることになっていた。
 *
 *   ここが元に戻っても `npm run lint` にも `npm run build` にも
 *   引っかからない。**開いてみるまで分からない**ので、実際に描いて測る。
 *   語の中身は窓口の応答を差し替えて渡す(この環境から Supabase へは届かない)。
 */
{
  /* **語は、出会った文の中に実際に出てくるものにする**(0047)。
     でたらめな語(`w0` など)にしていると、穴埋めが作れず
     `pickForm()` が「思い出す」に落ちる —— **穴埋めを測っているつもりで、
     ずっと思い出すを測っていた**(2026-09 に実際にそうなっていた)。 */
  const IN_SENTENCE = ['answer', 'engineer', 'stayed', 'quiet', 'during', 'whole',
    'review', 'meeting', 'later', 'admitted', 'nervous', 'anything']
  const WORDS = (box) => Array.from({ length: 12 }, (_, i) => ({
    word_norm: IN_SENTENCE[i], display: IN_SENTENCE[i], kind: 'phrase', pos: '熟語',
    status: 'learning', box, learn_streak: 4,
    due_on: '2020-01-01', added_at: '2026-09-01',
    meaning_ja: `意味${i}`,
    seen_in: 'Not knowing the answer, the new engineer stayed quiet during the'
      + ' whole review meeting, and later admitted that she had been too nervous'
      + ' to ask anything at all.',
    seen_in_ja: '答えを知らなかったので、その新人は会議のあいだ黙っていた。',
    material_id: null, material_title: null, industry: 'it', topic: null,
  }))
  /* **箱で出題の形が決まる**(`formForBox`)。
     0〜1 = 4択 / 2 = 思い出す / **3 = 穴埋め**(0047)/
     4〜5 = 日本語 → 英語 / 6 = つづり */
  let box = 2
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await page.route('**/rest/v1/**', (route) => {
    const u = route.request().url()
    let body = []
    if (u.includes('review_words')) body = WORDS(box)
    if (u.includes('vocab_week')) body = [{ days: 3, answered: 20, correct: 15, weeks: 5 }]
    if (u.includes('weekly_goal')) body = [{ words_goal: 0, words_done: 0, sent_goal: 0, sent_done: 0 }]
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  })
  await page.route('**/auth/v1/**', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: '{"data":{"user":null}}',
  }))

  /* **伸ばすのは「思い出す」と「日本語 → 英語」だけ**(利用者の指定)。
     4択とつづりは、下に選択肢や入力欄があるので**もともと空いていない** ——
     伸ばすと語と選択肢が数百 px 離れる。**両方向を見る** */
  const CASES = [
    ['スマホ / 思い出す', 390, 844, 2, true],
    ['320px / 思い出す', 320, 568, 2, true],
    /* **穴埋め**(0047)。出会った文をまるごと出すので、いちばん背が高い。
       ここが伸びないと、答えの2つが画面の外へ出る */
    ['スマホ / 穴埋め', 390, 844, 3, true],
    ['320px / 穴埋め', 320, 568, 3, true],
    ['スマホ / 日本語 → 英語', 390, 844, 4, true],
    ['スマホ / 4択', 390, 844, 0, false],
    ['スマホ / つづり', 390, 844, 6, false],
  ]
  for (const [what, w, h, useBox, wantTall] of CASES) {
    box = useBox
    await page.setViewportSize({ width: w, height: h })
    await page.goto(`http://localhost:${PORT}/__bar.html?screen=wordbook`,
      { waitUntil: 'networkidle' })
    /* **入口をもう1つ挟まない**(CLAUDE.md)ので、語がそろえば
       集中モードは**開いた瞬間から出る。** 押すものは無い */
    try {
      await page.waitForSelector('.wbfocus .wordcard', { timeout: 8000 })
    } catch {
      ng(`${what} … 集中モードが開かない`, '語を読めていないか、開く道が変わった')
      continue
    }
    // 「出会った文」を開いた状態で測る(いちばん背が高くなる形)
    for (const btn of await page.$$('button')) {
      if (((await btn.textContent()) ?? '').includes('出会った文')) { await btn.click(); break }
    }
    await page.waitForTimeout(300)

    const m = await page.evaluate(() => {
      const box = (s) => document.querySelector(s)
      const card = box('.wbfocus .wordcard')
      const ans = box('.wordcard-answers')
      const body = box('.focus-body')
      return {
        画面: window.innerHeight,
        // **伸ばす印**。付いている形が変わったら、そこで気づけるようにする
        伸ばす印: card ? card.className.includes('wordcard--recall') : false,
        カード: card ? Math.round(card.getBoundingClientRect().height) : 0,
        答えの下端: ans ? Math.round(ans.getBoundingClientRect().bottom) : null,
        本体を送るか: body ? body.scrollHeight > body.clientHeight + 1 : null,
        横: document.documentElement.scrollWidth > window.innerWidth,
        // **本当に穴埋めが出ているか。** 出ていなければ「思い出す」に
        // 落ちており、伸ばす印だけを見ていると**気づけない**
        穴埋め: !!box('.wordcard-cloze-en'),
      }
    })
    /* **高さの割合で「伸ばしていない」を見ない。** 4択は選択肢が4つ並ぶので、
       伸ばさなくても画面の半分ほどになる(実測 424 / 844px)。
       見るのは**印が付いている形かどうか**と、
       付いている形が**本当に画面を使い切っているか**の2つである */
    if (useBox === 3 && !m.穴埋め) {
      ng(`${what} … 穴埋めになっていない`,
        '`pickForm()` が「思い出す」に落ちている(出会った文にその語が無い)')
    } else if (m.伸ばす印 !== wantTall) {
      ng(`${what} … 伸ばす印(\`wordcard--recall\`)が ${m.伸ばす印 ? '付いている' : '付いていない'}`,
        wantTall
          ? '「思い出す」と「日本語 → 英語」には付ける'
          : '4択とつづりには付けない(下に選択肢や入力欄がある)')
    } else if (wantTall && m.カード < m.画面 * 0.5) {
      ng(`${what} … カードが画面の半分も使っていない(${m.カード} / ${m.画面}px)`,
        '`.wbfocus .wordcard--recall` を伸ばす指定が外れている')
    } else if (m.答えの下端 !== null && m.答えの下端 > m.画面) {
      ng(`${what} … 答えの行が画面の外に出ている(${m.答えの下端} > ${m.画面})`)
    } else if (m.本体を送るか) {
      ng(`${what} … 集中モードなのに画面を送ることになっている`)
    } else if (m.横) {
      ng(`${what} … 横にはみ出している`)
    } else {
      ok(`${what} … カード ${m.カード} / ${m.画面}px`
        + `(${wantTall ? '伸ばす' : '伸ばさない'})・画面は送らない`)
    }
    /* **穴埋めは、目でも1枚だけ確かめる**(こちらには画面が見えないので、
       せめて絵にして残す)。答えを開いた形も撮る */
    if (process.env.SHOT && useBox === 3 && w === 390) {
      await page.screenshot({ path: `${process.env.SHOT}/cloze-q.png` })
      for (const btn of await page.$$('button')) {
        if (((await btn.textContent()) ?? '').includes('英語を見る')) { await btn.click(); break }
      }
      await page.waitForTimeout(200)
      await page.screenshot({ path: `${process.env.SHOT}/cloze-a.png` })
    }
  }
  /* ── **その教材の語だけに絞る**(0047・2026-09 利用者の指摘)──────
     > とりあえずその単語とフレーズだけに取り組めるよう(任意)に
     > しないと、今のままでは何も気づかない

     絞れているか・**絞っていることが画面に出ているか**・
     **外す道があるか**の3つを、実際に描いて数える。
     ソースを読むだけでは「絞れている」までしか言えない */
  box = 2
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(
    `http://localhost:${PORT}/__bar.html?screen=wordbook&only=answer,engineer,quiet`,
    { waitUntil: 'networkidle' },
  )
  try {
    await page.waitForSelector('.wbfocus .wordcard', { timeout: 8000 })
  } catch {
    ng('その教材の語だけ … 集中モードが開かない')
  }
  const onlyM = await page.evaluate(() => {
    const total = document.querySelector('.wb-run-count')?.textContent ?? ''
    const chip = document.querySelector('.wb-only-label')?.textContent ?? ''
    const back = [...document.querySelectorAll('.wb-only button')]
      .some((b) => (b.textContent ?? '').includes('ぜんぶ'))
    return { total, chip, back }
  })
  // 語は12語あるが、`only` で3語に絞ってある
  if (!/\/\s*3\s*語/.test(onlyM.total)) {
    ng(`その教材の語だけ … 3語に絞れていない(${onlyM.total.trim()})`,
      '読み込んだ直後に落としているか(`onlySet`)')
  } else if (!onlyM.chip.includes('この教材の語だけ') || !/3\s*語/.test(onlyM.chip)) {
    ng(`その教材の語だけ … 絞っている札が出ていない(${onlyM.chip.trim()})`,
      '黙って絞ると、単語帳がまるごと減ったように見える')
  } else if (!onlyM.back) {
    ng('その教材の語だけ … 単語帳ぜんぶに戻す道が無い', '行き止まりを作らない')
  } else {
    ok(`その教材の語だけ … ${onlyM.total.trim()}・札「${onlyM.chip.trim()}」・戻る道あり`)
  }
  if (process.env.SHOT) await page.screenshot({ path: `${process.env.SHOT}/only.png` })

  await page.close()
}

await browser.close()
console.log(bad === 0 ? '\n✅ 帯の持ちものは、すべて意図どおりです' : `\n❌ ${bad} 件`)
process.exit(bad === 0 ? 0 : 1)
