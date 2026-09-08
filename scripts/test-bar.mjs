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

/* **本物のアプリ**(左のメニュー込み)を描く入り口。
   `__screens.jsx` は部品を1つずつ描くだけなので、
   **骨組み(メニュー・上の帯)はそちらには無い。**
   `.env` を空にしてあるので Supabase 未設定として立ち上がり、
   ログインを通さずに中の画面が開く(CLAUDE.md) */
writeFileSync(join(ROOT, '__shell.html'), `<!doctype html>
<html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>骨組みの検証</title></head>
<body><div id="root"></div>
<script type="module" src="/src/main.jsx"></script></body></html>
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
  try { rmSync(join(ROOT, '__shell.html')) } catch { /* もう無い */ }
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
    dock: !!document.querySelector('.player--dock'),
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

  /** 設問ごとに出ている Listen の数 */
  const listens = () => page.evaluate(() => [...document.querySelectorAll('.lesson-items button')]
    .filter((b) => /^(Listen|Stop)/.test(b.textContent.trim())).length)

  // ① 英文和訳(`prompt_en` を読む)。**広い画面では帯の中に出る**
  {
    const m = await seen()
    if (!m.bar) ng('文型ドリル(英文和訳)で、上の帯に操作盤が出ていない')
    else if (!/3/.test(m.at ?? '')) ng('問数が出ていない', `「${m.at}」`)
    else ok(`英文和訳 … 上の帯に操作盤が出る(${m.at})`)

    /* **本文以外の Listen は残す**(2026-09 利用者の指定は「段落ごと」だけ)。
       ここが 0 になったら、削りすぎている */
    const n = await listens()
    if (!n) ng('本文以外(設問ごと)の Listen まで消えている', '言われたのは段落ごとだけ')
    else ok(`英文和訳 … 設問ごとの Listen は残っている(${n} 個)`)
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
    if (m.bar || m.float || m.dock || m.launch) {
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
    /* **狭い画面の既定は「画面の下の黒帯」**(2026-09 利用者の指定)。
       右下に浮く錠剤ではない —— 戻すと、ここが赤くなる */
    else if (!m.dock) ng('狭い画面の文型ドリルで、画面の下の黒帯が出ていない')
    else ok('狭い画面 … スイッチと画面の下の黒帯が出る')
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

/* ── **段落ごとの Listen は、どの端末でも出さない**(2026-09 利用者の指定)
 *
 *    > 段落ごとの listen も全てのデバイスで廃止にしましょう
 *
 *    もとは**操作盤との入れ替え**だった(浮いていれば隠し、上の帯に
 *    しまってあれば出す)。ところが記事は6段落・会話は14発言あるので、
 *    同じものが6組も14組も並ぶ。操作盤の「◀ 3 / 6 段落 ▶」で同じことが
 *    できるので、**押すところを1か所に絞った。**
 *
 *    **出る側は上の文型ドリルで数えている**(設問ごとの Listen は残す)。
 *    ここでは**出ない側**を、幅を変えて数える。
 */
{
  const page = await browser.newPage({ viewport: { width: 1500, height: 900 } })
  await page.goto(`http://localhost:${PORT}/__bar.html?role=trainer&who=g1`,
    { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  console.log('\n── 段落ごとの Listen は、どの端末でも出さない ──')
  for (const w of [1500, 1200, 900, 390]) {
    await page.setViewportSize({ width: w, height: 900 })
    await page.waitForTimeout(300)
    const m = await page.evaluate(() => ({
      /* 本文の各段落に付いていたもの。**言葉で数える**
         (Listen / Stop のどちらの形でも拾う) */
      段落: [...document.querySelectorAll('.lesson-items button')]
        .filter((b) => /^(Listen|Stop)/.test(b.textContent.trim())).length,
      /* **通しの読み上げは残す。** 上の「Listen (全体)」と操作盤は別物 */
      全体: !!document.querySelector('.lesson-listen'),
      操作盤: !!document.querySelector('.player'),
    }))
    if (m.段落) ng(`${w}px … 段落ごとの Listen が ${m.段落} 個 出ている`)
    else if (!m.全体) ng(`${w}px … 「Listen (全体)」まで消えている`)
    else if (!m.操作盤) ng(`${w}px … 操作盤が出ていない`, '鳴らす道が無くなる')
    else ok(`${w}px … 段落ごとは0個・通しと操作盤は残っている`)
  }
  await page.close()
}

/* ── **狭い画面の操作盤は、絶対に1行**(2026-09 実機・利用者の指定)──────
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
      st.textContent = '.player--dock .btn, .player--dock .player-at,'
        + ' .player--float .btn, .player--float .player-at'
        + ' { font-size: 16px !important }'
      document.head.appendChild(st)
    }, big)
    /* **字を差し替えたら、測り直させる。**
       端末の「表示を大きく」は本来**描く前**から効いているので、
       あとから足したときは合図を送らないと `useFitRow` が走らない
       (検証だけの都合。画面の側は描くたびに測っている) */
    await page.evaluate(() => window.dispatchEvent(new Event('resize')))
    await page.waitForTimeout(180)
    const m = await page.evaluate(() => {
      /* **既定は「画面の下の黒帯」**(2026-09 利用者の指定)。
         浮かせているときは、そちらを測る */
      const p = document.querySelector('.player--dock') ?? document.querySelector('.player--float')
      if (!p) return null
      const r = p.getBoundingClientRect()
      return {
        h: Math.round(r.height), right: Math.round(r.right), win: window.innerWidth,
        // **自分は縮むので、中身のあふれも見る**(切れても高さは変わらない)
        spill: [p, ...p.children].some((b) => b.scrollWidth > b.clientWidth + 1),
      }
    })
    const 印 = big ? `${w}px(文字 1.25 倍)` : `${w}px`
    if (!m) { ng(`${印} で操作盤が出ていない`); continue }
    if (m.h > 70) ng(`${印} で操作盤が2行になっている`, `高さ ${m.h}px(1行なら 50px ほど)`)
    else if (m.right > m.win) ng(`${印} で操作盤が画面からはみ出している`, `右端 ${m.right} > ${m.win}`)
    else if (m.spill) ng(`${印} で操作盤の中身があふれている`, 'くり返しの単位が画面の外へ切れる')
    else ok(`${印} … 操作盤は1行(${m.h}px)・あふれ無し`)
  }
  await page.evaluate(() => document.getElementById('eas-bigplayer')?.remove())

  /* ── **スマホには「浮かせる」を出さない**(2026-09 実機・利用者の指定)
         > フロートさせると下に変な隙間ができる、しかも戻せない。
         > フロートさせると機能を無くしてくださいと先ほど頼みませんでしたか?

       浮かせると押すものが画面の幅に入りきらず、
       **置き場所のボタンが画面の外**へ出て黒帯へ戻せなくなっていた。
       しかも浮いた錠剤の下に、黒帯のぶんの余白だけが残る。

       だから**選べる場所そのものを黒帯だけ**にした。
       切り替えのボタンが1つも無いことを、ここで数える
       (`placeFor` を「スマホでも float」に戻すと赤くなる)。 */
  for (const w of [390, 375, 320]) {
    await page.setViewportSize({ width: w, height: 900 })
    await page.waitForTimeout(300)
    const m = await page.evaluate(() => {
      const p = document.querySelector('.player--dock')
      return {
        float: !!document.querySelector('.player--float'),
        dock: !!p,
        place: document.querySelectorAll('.player-place').length,
        grip: document.querySelectorAll('.player-grip').length,
        h: p ? Math.round(p.getBoundingClientRect().height) : null,
      }
    })
    if (m.float) ng(`${w}px で、浮かせた操作盤が出ている`, 'スマホには浮かせる道を持たせない')
    else if (!m.dock) ng(`${w}px で、画面の下の黒帯が出ていない`)
    else if (m.place) ng(`${w}px に、置き場所の切り替えが出ている`, '行き先が無い(効かない操作)')
    else if (m.grip) ng(`${w}px に、つまんで動かすつまみが出ている`)
    else ok(`${w}px … 黒帯だけ・切り替えもつまみも出さない`)

    /* ── **余った幅は、機能と機能のあいだへ配る**(2026-09 利用者の指定)
           > せっかくスペースに余裕ができたので、各機能の間にバランスよく
           > マージンを入れてください。触れすぎていて押し間違えをしそうな
           > 緊張感があります

         `space-between` にしてあるので、**余りがそのまま隙間になる。**
         決め打ちの数を足していないので、ここでは
         「**余っているのに詰まったままではないか**」だけを見る
         (`justify-content` を `center` に戻すと赤くなる)。 */
    const g = await page.evaluate(() => {
      const p = document.querySelector('.player--dock')
      const kids = [...p.children].filter((c) => c.getBoundingClientRect().width > 0)
      const 器 = p.parentElement
      const cs = window.getComputedStyle(器)
      const 内側 = 器.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
      const 中身 = kids.reduce((s, c) => s + c.getBoundingClientRect().width, 0)
      return {
        余り: Math.round(内側 - 中身),
        隙間: kids.slice(1).map((c, i) =>
          Math.round(c.getBoundingClientRect().left - kids[i].getBoundingClientRect().right)),
      }
    })
    const 最小 = Math.min(...g.隙間)
    /* **余りのほとんどが隙間になっているか。** 端数(1px)は数えない */
    if (最小 * g.隙間.length < g.余り - 1) {
      ng(`${w}px … 余った幅が隙間になっていない`,
        `余り ${g.余り}px なのに 隙間 ${g.隙間.join(' / ')}px`)
    } else ok(`${w}px … 余り ${g.余り}px を隙間へ配った(${g.隙間.join(' / ')}px)`)

    /* ── **並ぶものの背丈をそろえる**(2026-09 実機・利用者の指定)
           > 段落送りの枠だけ細いのを、他のやつと同じにしてください

         錠剤の背丈は**中身なり**である。Listen のまん中は
         `.btn--small`(34px)なので 36px になるが、段落送りのまん中は
         `.player-at` という**ただの文字**なので 22.4px しかなく、
         隣に並ぶと1つだけ細く見えていた(実測)。

         **1つでも背丈が違えば赤くする。** `.listenpill-mid` の
         `min-height` を外すと、ここが 36 / 22 / 36 になる。 */
    const hs = await page.evaluate(() => {
      const p = document.querySelector('.player--dock')
      return [...p.children]
        .filter((c) => c.getBoundingClientRect().width > 0)
        .map((c) => Math.round(c.getBoundingClientRect().height))
    })
    if (new Set(hs).size !== 1) {
      ng(`${w}px … 操作盤に並ぶものの背丈がそろっていない`, `${hs.join(' / ')}px`)
    } else ok(`${w}px … 並ぶものは全部 ${hs[0]}px(背丈がそろっている)`)
  }

  /* **パッド以上では、これまでどおり浮かせられる**(利用者の判断
     「移動式のプレーヤーは、PCやパッドでは残しましょう」)。
     **出す / 出さないの両方を見る** —— 片方だけだと、
     「全部に出す」と書き換えても緑のままになる */
  await page.setViewportSize({ width: 900, height: 900 })
  await page.waitForTimeout(300)
  {
    const has = await page.$$eval('.player-place', (xs) => xs.length)
    if (!has) ng('パッドで、置き場所の切り替えが出ていない', '浮かせる道が無くなっている')
    else {
      await page.click('.player-place')
      await page.waitForTimeout(300)
      const m = await page.evaluate(() => {
        const p = document.querySelector('.player--float')
        if (!p) return null
        const r = p.getBoundingClientRect()
        return {
          h: Math.round(r.height), right: Math.round(r.right), win: window.innerWidth,
          grip: !!document.querySelector('.player-grip'),
          dock: !!document.querySelector('.player--dock'),
          back: document.querySelectorAll('.player-place').length,
          spill: [p, ...p.children].some((b) => b.scrollWidth > b.clientWidth + 1),
        }
      })
      if (!m) ng('パッドで、浮かせる形に切り替えられない')
      else if (m.dock) ng('浮かせたのに、画面の下の黒帯も出ている', '同じものを2つ見せない')
      else if (!m.grip) ng('パッドで、つまんで動かすつまみが出ていない')
      /* **戻す道が要る。** これが 0 だと、浮かせたきり黒帯へ帰れない */
      else if (!m.back) ng('浮かせたあと、黒帯へ戻す道が無い')
      else if (m.h > 70) ng('浮かせた操作盤が2行になっている', `高さ ${m.h}px`)
      else if (m.right > m.win || m.spill) ng('浮かせた操作盤があふれている')
      else ok(`900px … 浮かせても1行(${m.h}px)・つまみと戻る道がある`)
    }
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
  /* 4択・つづりは伸ばさないが、**出題の枠は画面の余りから決める**
     (2026-09 実機・利用者の指定)。ここを決め打ち(9rem)に戻すと、
     ホーム画面(ブラウザの帯が無く縦が長い)で
     **「出会った文」が枠の中で切れ、余りはただの空白になる。**
     `[何を, 幅, 高さ, 箱, 伸ばすか, 枠の下限]` */
  const CASES = [
    ['スマホ / 思い出す', 390, 844, 2, true],
    ['320px / 思い出す', 320, 568, 2, true],
    /* **穴埋め**(0047)。出会った文をまるごと出すので、いちばん背が高い。
       ここが伸びないと、答えの2つが画面の外へ出る */
    ['スマホ / 穴埋め', 390, 844, 3, true],
    ['320px / 穴埋め', 320, 568, 3, true],
    ['スマホ / 日本語 → 英語', 390, 844, 4, true],
    /* **ホーム画面(PWA)**。ブラウザの帯が無いぶん縦が長い。
       ここがいちばん空いていた(上下 176px ずつ・実測) */
    ['スマホ / 4択 / ホーム画面 844', 390, 844, 0, false, 320],
    /* **Chrome**(帯のぶん 110px ほど低い) */
    ['スマホ / 4択 / Chrome 734', 390, 734, 0, false, 300],
    ['スマホ / つづり', 390, 844, 6, false, 320],
  ]
  for (const [what, w, h, useBox, wantTall, wantQ] of CASES) {
    box = useBox
    await page.setViewportSize({ width: w, height: h })
    await page.goto(`http://localhost:${PORT}/__bar.html?screen=wordbook`,
      { waitUntil: 'networkidle' })
    /* **範囲と個数を選んでから始める形になった**(2026-09 利用者の指定)。
       「集中モードを開く」という段は**いまも1つも挟んでいない** ——
       押すのは「◯語を出す」で、そのまま集中モードに入る */
    try {
      await page.waitForSelector('.rscope .btn--primary:not([disabled])', { timeout: 8000 })
      await page.click('.rscope .btn--primary')
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
        /* 出題の枠。**「出会った文」を開いた状態**で測っているので、
           はみ出しが残っていれば、その文が枠の中で切れている */
        枠: box('.wordcard-q')
          ? Math.round(box('.wordcard-q').getBoundingClientRect().height) : 0,
        枠のはみ出し: box('.wordcard-q')
          ? box('.wordcard-q').scrollHeight - box('.wordcard-q').clientHeight : 0,
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
    /* **伸ばさない形でも、出題の枠は画面の余りから決める**
       (2026-09 実機・利用者の指定)。決め打ち(9rem = 144px)に戻すと
       ここで赤くなる。**枠の広さと、切れていないことを両方見る** ——
       広さだけを見ると、中身がもっと長い教材で切れても気づけない */
    } else if (wantQ && m.枠 < wantQ) {
      ng(`${what} … 出題の枠が狭い(${m.枠} < ${wantQ}px)`,
        '`.wbfocus .wordcard:not(--recall) > .wordcard-q` の高さが'
        + '決め打ち(9rem)に戻っている。ホーム画面では余りがただの空白になる')
    } else if (wantQ && m.枠のはみ出し > 0) {
      ng(`${what} … 「出会った文」が枠の中で切れている(${m.枠のはみ出し}px)`,
        '出題の枠が中身より低い')
    } else if (m.答えの下端 !== null && m.答えの下端 > m.画面) {
      ng(`${what} … 答えの行が画面の外に出ている(${m.答えの下端} > ${m.画面})`)
    } else if (m.本体を送るか) {
      ng(`${what} … 集中モードなのに画面を送ることになっている`)
    } else if (m.横) {
      ng(`${what} … 横にはみ出している`)
    } else {
      ok(`${what} … カード ${m.カード} / ${m.画面}px`
        + `(${wantTall ? '伸ばす' : '伸ばさない'})・画面は送らない`
        + (wantQ ? `・出題の枠 ${m.枠}px で切れない` : ''))
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
  /* 範囲と個数を選んでから始める(上と同じ)。**絞ったときは「ぜんぶ」**に
     なるので、期限で切られず3語とも出る(0047 の決まり) */
  try {
    await page.waitForSelector('.rscope .btn--primary:not([disabled])', { timeout: 8000 })
    await page.click('.rscope .btn--primary')
  } catch { /* 下の待ちで赤くなる */ }
  try {
    await page.waitForSelector('.wbfocus .wordcard', { timeout: 8000 })
  } catch {
    ng('その教材の語だけ … 集中モードが開かない')
  }
  /* **何語で組まれたかは、進み具合の点の数で数える。**
     以前は「◯ / ◯ 語」の文字を読んでいたが、あれは 2026-09 の指定で
     画面から消えた。**点は1問=1目盛り**なので、同じ数を指している */
  const onlyM = await page.evaluate(() => {
    const dots = document.querySelectorAll('.wb-run-bar > span').length
    const chip = document.querySelector('.wb-only-label')?.textContent ?? ''
    const back = [...document.querySelectorAll('.wb-only button')]
      .some((b) => (b.textContent ?? '').includes('ぜんぶ'))
    return { dots, chip, back }
  })
  // 語は12語あるが、`only` で3語に絞ってある
  if (onlyM.dots !== 3) {
    ng(`その教材の語だけ … 3語に絞れていない(${onlyM.dots} 語)`,
      '読み込んだ直後に落としているか(`onlySet`)')
  } else if (!onlyM.chip.includes('この教材の語だけ') || !/3\s*語/.test(onlyM.chip)) {
    ng(`その教材の語だけ … 絞っている札が出ていない(${onlyM.chip.trim()})`,
      '黙って絞ると、単語帳がまるごと減ったように見える')
  } else if (!onlyM.back) {
    ng('その教材の語だけ … 単語帳ぜんぶに戻す道が無い', '行き止まりを作らない')
  } else {
    ok(`その教材の語だけ … ${onlyM.dots} 語・札「${onlyM.chip.trim()}」・戻る道あり`)
  }
  if (process.env.SHOT) await page.screenshot({ path: `${process.env.SHOT}/only.png` })

  await page.close()
}

/* ══════════════════════════════════════════════════════════════
   ⑨-1 集中モードで、**長い段落を送らずに読めるか**(2026-09 利用者の指定)

     > 段落が長い場合、せっかく集中モードに入ってもそこでスクロールが
     > 発生してしまっています。ちょうど良い単語数、内容で区切る仕様に
     > しないと通常モードと同じ操作感の悪さを引き継いでしまい、
     > 集中モードの存在意義が問われてしまいます

   **語数を決め打ちにしていない**ので、入るかどうかは描かないと分からない。
   見るのは3つ。**「割れる」だけを見ない** —— ふつうの段落まで
   割るようになったら、それも赤くならなければいけない。
   ══════════════════════════════════════════════════════════════ */
{
  /** 集中モードを開く(狭い画面ではボタンが絵だけなので `aria-label` も見る) */
  const enter = async (page, kind) => {
    await page.goto(`http://localhost:${PORT}/__bar.html?kind=${kind}&role=trainer&who=g1`,
      { waitUntil: 'networkidle' })
    await page.waitForTimeout(300)
    for (const b of await page.$$('button')) {
      const t = ((await b.textContent()) ?? '') + ' ' + ((await b.getAttribute('aria-label')) ?? '')
      if (t.includes('集中モード') && await b.isVisible()) { await b.click(); break }
    }
    await page.waitForSelector('.focus-body', { timeout: 15000 })
    await page.waitForTimeout(400)
  }
  const look = (page) => page.evaluate(() => {
    const b = document.querySelector('.focus-body')
    const en = document.querySelector('.focus-en')
    const part = document.querySelector('.focus-part')
    return {
      over: b.scrollHeight > b.clientHeight + 1,
      sh: b.scrollHeight, ch: b.clientHeight,
      words: en ? (en.innerText.trim().match(/\S+/g) || []).length : 0,
      part: part ? part.innerText.replace(/\s+/g, '') : '',
      text: en ? en.innerText.trim() : '',
    }
  })

  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true })
  for (const [w, h] of [[390, 844], [320, 568], [820, 1180]]) {
    await page.setViewportSize({ width: w, height: h })
    await enter(page, 'long')
    const seen = []
    for (let i = 0; i < 10; i += 1) {
      seen.push(await look(page))
      const pills = await page.$$('.focus-mid .listenpill')
      const next = pills.length ? await pills[pills.length - 1].$('.listenpill-arrow:last-child') : null
      if (!next || await next.isDisabled()) break
      await next.click()
      await page.waitForTimeout(300)
    }
    const over = seen.filter((m) => m.over)
    // 1段落目(146 語)ぶんの語を数える。**1語も落としていないこと**
    const first = seen.filter((m) => m.part || m.words > 100)
    const words = first.reduce((n, m) => n + m.words, 0)
    if (over.length) {
      ng(`集中モード ${w}x${h} … ${over.length} 枚が送れてしまう`
        + `(${over.map((m) => `${m.words}語 ${m.sh}/${m.ch}`).join(' / ')})`,
      '長い段落は、入るまで割る')
    } else if (words !== 146) {
      ng(`集中モード ${w}x${h} … 1段落目の語が ${words} 語(146 のはず)`,
        '割るときに1語も落とさない')
    } else {
      ok(`集中モード ${w}x${h} … ${seen.length} 枚・どれも送らない`
        + `(1段落目 ${first.length} 枚 ${first.map((m) => m.words).join('+')} 語)`)
    }
  }

  /* **ふつうの段落は、1つも割らない。** ここが赤くなるのは
     「割りすぎ」のときで、**入るまで割る**の裏返しである */
  await page.setViewportSize({ width: 390, height: 844 })
  await enter(page, 'dialogue')
  const m = await look(page)
  if (m.part) ng(`集中モード … ふつうの会話まで割っている(${m.part})`)
  else if (m.over) ng('集中モード … ふつうの会話で送れてしまう')
  else ok(`集中モード … ふつうの会話(${m.words} 語)は割らない`)

  await page.close()
}

/* ══════════════════════════════════════════════════════════════
   ⑨-2 語を長押ししたら、調べ方を教える(2026-09 利用者の指定)

     > 単語に長押しした時に表示が出るようにしましょう

   狭い画面では語を押せない(送りとぶつかるため・CLAUDE.md)。
   ところが**押しても何も起きない**ので、調べられないのか
   壊れているのかが、利用者には分からなかった。

   見るのは4つ。**「出る」だけを見ない** ——
   広い画面でも出るようにしてしまったら、緑のままになる。
   ══════════════════════════════════════════════════════════════ */
{
  const page = await browser.newPage({ viewport: { width: 390, height: 780 }, hasTouch: true })
  /** 指を置いて、動かさずに待つ。`.etext-sent` は必ずある(文の箱) */
  const hold = async (scroll = false) => {
    await page.goto(`http://localhost:${PORT}/__bar.html?role=trainer&who=g1`,
      { waitUntil: 'networkidle' })
    await page.waitForSelector('.etext-sent', { timeout: 15000 })
    const b = await (await page.$('.etext-sent')).boundingBox()
    await page.dispatchEvent('.etext-sent', 'pointerdown',
      { pointerType: 'touch', clientX: b.x + 3, clientY: b.y + 3 })
    if (scroll) await page.evaluate(() => { document.querySelector('.lesson-sheet').scrollTop += 120 })
    await page.waitForTimeout(700)
    return page.$('.etext-hint')
  }

  // ① 狭い画面では出る。**行き先(集中モード)まで届く**
  let hint = await hold()
  if (!hint) {
    ng('長押しの案内 … 390px で出ない',
      '押しても何も起きないと、調べられないのか壊れているのか分からない')
  } else {
    const r = await hint.boundingBox()
    if (r.x < 0 || r.x + r.width > 390) {
      ng(`長押しの案内 … 画面からはみ出している(${Math.round(r.x)}〜${Math.round(r.x + r.width)} / 390)`)
    } else {
      await page.click('.etext-hint .btn')
      await page.waitForTimeout(400)
      if (!await page.$('.focus')) ng('長押しの案内 … 押しても集中モードに入らない')
      else if (await page.$('.etext-hint')) ng('長押しの案内 … 押しても消えない')
      else ok(`長押しの案内 … 390px で出て、集中モードへ入る(${Math.round(r.width)}px)`)
    }
  }

  // ② 送ろうとして指を置いただけでは出ない
  if (await hold(true)) {
    ng('長押しの案内 … 画面を送っているのに出た',
      '`watchHold` の取り消しが効いていない')
  } else {
    ok('長押しの案内 … 送っているあいだは出ない')
  }

  // ③ 広い画面では出さない(語をそのまま押せるので要らない)
  await page.setViewportSize({ width: 1440, height: 900 })
  if (await hold()) {
    ng('長押しの案内 … 1440px でも出た',
      '広い画面では語を押せば意味が出る。**同じことを2つ見せない**')
  } else {
    ok('長押しの案内 … 1440px では出ない')
  }

  await page.close()
}

/* ══════════════════════════════════════════════════════════════
   ⑩ 骨組み — **どこにいるかが、いつでも画面に出ているか**(2026-09・第3週)

   実測して2つ見つけた。

   ①**メニューが 1024px 未満で丸ごと隠れていた。** パッドの縦向き(768px)
     でも、画面を移るたびに ☰ を押すことになっていた。
     いまは **768〜1023px では絵だけの細い柱(68px)**を出す。

   ②**開いた瞬間の画面が、メニューのどれでもなかった。**
     `view` が `'learner'`(0022 で外した画面)から始まっていたので、
     **メニューの印も、上の帯の名前も出ない。**
     パソコンでは名前が並ぶので気づけなかったが、
     **絵だけの柱では本当に分からない。**

   どちらも `npm run lint` にも `npm run build` にも引っかからない。
   **描かせて、数えるしかない。**
   ══════════════════════════════════════════════════════════════ */
{
  /* **Supabase を設定した状態では、この検証はできない。**
     設定してあるとログインを求められ(`<SignIn />`)、骨組みが描かれない。
     だから**空の `.env` を持つ開発サーバーをもう1本**立てる
     (ほかの検証は窓口を呼ばないので、あちらの `.env` はそのままでよい)。 */
  const dir2 = mkdtempSync(join(tmpdir(), 'eas-shell-'))
  const CFG2 = join(ROOT, 'vite.shell.config.js')
  const PORT2 = PORT + 7   // 手元の使い捨てとぶつからない番号にする
  writeFileSync(CFG2, `
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
  envDir: ${JSON.stringify(dir2)},
  cacheDir: ${JSON.stringify(join(dir2, 'vite'))},
  plugins: [react()],
  server: { port: ${PORT2}, strictPort: true },
})
`)
  writeFileSync(join(dir2, '.env'), '\n')
  const vite2 = spawn('npx', ['vite', '--config', CFG2], { cwd: ROOT, stdio: 'ignore' })
  const drop2 = () => {
    try { vite2.kill('SIGTERM') } catch { /* もう止まっている */ }
    try { rmSync(CFG2) } catch { /* もう無い */ }
    try { rmSync(dir2, { recursive: true, force: true }) } catch { /* もう無い */ }
  }
  process.on('exit', drop2)
  let up = false
  for (let i = 0; i < 150 && !up; i += 1) {
    try { const r = await fetch(`http://localhost:${PORT2}/__shell.html`); up = r.ok } catch { /* まだ */ }
    if (!up) await new Promise((r) => setTimeout(r, 200))
  }
  if (!up) ng('骨組み … 開発サーバーが立ち上がらなかった')

  const page = await browser.newPage()
  for (const [w, want] of up ? [[1280, 248], [900, 68], [768, 68], [390, 0]] : []) {
    await page.setViewportSize({ width: w, height: 900 })
    await page.goto(`http://localhost:${PORT2}/__shell.html`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(600)
    const m = await page.evaluate(() => {
      const nav = document.querySelector('.app-nav')
      const shown = nav && window.getComputedStyle(nav).visibility !== 'hidden'
      const title = document.querySelector('.app-topbar-title')
      return {
        幅: shown ? Math.round(nav.getBoundingClientRect().width) : 0,
        印: !!document.querySelector('.app-nav-item.is-active'),
        名前: title ? title.textContent.trim() : '',
        はみ出し: document.documentElement.scrollWidth > window.innerWidth,
      }
    })
    if (m.幅 !== want) {
      ng(`骨組み ${w}px … メニューの幅が ${m.幅}px(${want}px のはず)`,
        want === 68 ? 'パッドでは絵だけの細い柱を出す(`NAV_PUSH_AT`)'
          : want === 0 ? 'スマホではかぶせる形。ふだんは隠す'
            : 'PC では名前つきで並ぶ')
    } else if (!m.印) {
      ng(`骨組み ${w}px … 「いまどこにいるか」の印が1つも点いていない`,
        '`view` の初めの値が、メニューに無い id になっていないか')
    } else if (!m.名前 || m.名前 === 'English AI System') {
      ng(`骨組み ${w}px … 上の帯に画面の名前が出ていない(${m.名前 || '空'})`,
        '`pageLabel` が控えに落ちている = その画面はメニューに無い')
    } else if (m.はみ出し) {
      ng(`骨組み ${w}px … 横にはみ出している`)
    } else {
      ok(`骨組み ${w}px … メニュー ${m.幅}px・印あり・帯に「${m.名前}」`)
    }

    /* ── ☰ は、**送ったあとも押せる**(2026-09 実機・利用者の指摘)──────
         > スクロールを始めるとサイドバーのハンバーガーが触れなくなる

       上の帯は `position: sticky` で貼り付いている。ところが
       `body` に `overflow: hidden` が**取り残される**と、
       あそこが「送れる箱」に変わって**貼り付かなくなる**
       (CLAUDE.md に書いてあるとおり)。すると帯ごと画面の外へ流れ出て、
       ☰ に手が届かない。**端末によらない**(実測 上端 8px → −592px)。

       だから**ここで両方を測る。**
         ①ふつうに送ったとき … 貼り付いて、押せる
         ②`hidden` が残ったとき … 押せなくなる(壊れ方そのものを確かめる)
       ②が「押せる」に変わったら、この検証は用をなしていない */
    const s = await page.evaluate(() => {
      const host = document.querySelector('.app')
      const tall = document.createElement('div')
      tall.style.height = '3000px'
      tall.dataset.probe = '1'
      host.appendChild(tall)
      const btn = document.querySelector('.app-topbar .nav-icon-btn')
      const look = () => {
        const se = document.scrollingElement
        se.scrollTop = 600; window.scrollTo(0, 600)
        const r = btn.getBoundingClientRect()
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
        return { 上端: Math.round(r.top), 押せる: !!(hit && btn.contains(hit)) }
      }
      const 素直 = look()
      document.scrollingElement.scrollTop = 0; window.scrollTo(0, 0)
      document.body.style.overflow = 'hidden'
      const 取り残し = look()
      document.body.style.overflow = ''
      tall.remove()
      return { 素直, 取り残し }
    })
    if (!s.素直.押せる) {
      ng(`☰ ${w}px … 送ったあと押せない(帯の上端 ${s.素直.上端}px)`,
        '上の帯が貼り付いていない。`body` に `overflow: hidden` が'
        + ' 取り残されていないか(鍵は `src/lib/scrollLock.js` 1か所)')
    } else if (s.取り残し.押せる) {
      ng(`☰ ${w}px … \`overflow: hidden\` が残っても押せてしまう`,
        'この検証が壊れ方を捕まえられていない。'
        + '**押せることだけを見ると、貼り付きが外れても気づけない**')
    } else {
      ok(`☰ ${w}px … 送っても押せる(上端 ${s.素直.上端}px)`
        + `・hidden が残ると押せなくなる(${s.取り残し.上端}px)`)
    }

    /* **メニューを開いた状態でも貼り付くか**(2026-09 実機・利用者の指摘
         「PCでは相変わらず下にスクロールすると上部バーが消えてしまい
         『ハンバーガー』が消えてしまいます」)。
       前の検証は**既定の状態しか見ていなかった** —— PC では
       メニューを開いて使うことが多く、そこは一度も測っていない */
    /* **かぶせて開く幅(768px 未満)では測らない。** あそこは
       開いているあいだ、うしろの画面をわざと動かさない(`lockScroll`)ので、
       「送っても押せる」を問うこと自体が的外れである */
    const opened = w < 768 ? null : await page.evaluate(() => {
      const burger = document.querySelector('.app-topbar .nav-burger')
      if (!burger) return null
      burger.click()
      return true
    })
    if (opened) {
      await page.waitForTimeout(250)
      const s2 = await page.evaluate(() => {
        const tall = document.createElement('div')
        tall.style.height = '3000px'
        document.querySelector('.app').appendChild(tall)
        const btn = document.querySelector('.app-topbar .nav-burger')
        document.scrollingElement.scrollTop = 600
        window.scrollTo(0, 600)
        const r = btn.getBoundingClientRect()
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
        const out = { 上端: Math.round(r.top), 押せる: !!(hit && btn.contains(hit)) }
        document.scrollingElement.scrollTop = 0
        window.scrollTo(0, 0)
        tall.remove()
        return out
      })
      // もとに戻す(次の幅の測りに引きずらない)
      await page.evaluate(() => document.querySelector('.app-topbar .nav-burger')?.click())
      await page.waitForTimeout(200)
      if (!s2.押せる) {
        ng(`☰ ${w}px(メニューを開いた状態)… 送ったあと押せない(上端 ${s2.上端}px)`,
          'PC ではメニューを開いて使うことが多い。その状態でも貼り付くこと')
      } else {
        ok(`☰ ${w}px(メニューを開いた状態)… 送っても押せる(上端 ${s2.上端}px)`)
      }
    }

    /* **画面のいちばん上に、読まないものを置かない**(2026-09 利用者の指定)。

         > 上部のsupabaseと試作版うんぬん、、をたたむ。というくだりを
         > 消せませんか

       骨組みは Supabase 未設定 かつ 役割が分からない状態なので、
       **接続の知らせも断り書きも1つも出てはいけない**
       (接続の知らせは「つながっていない × トレーナー」のときだけ)。
       **版(`VITE_BUILD_STAMP`)はフッターに残す** ——
       どの版を見ているかを確かめる唯一の手がかりである */
    const top = await page.evaluate(() => ({
      箱: document.querySelectorAll('.app-notice').length,
      断り書き: document.body.innerText.includes('試作版についての断り書き'),
      接続: document.body.innerText.includes('Supabase に接続でき'),
      版: !!document.querySelector('.app-footer'),
      // **試作版のサンプルデータに戻す道は、消えていること**
      戻す: document.body.innerText.includes('サンプルデータに戻す'),
    }))
    if (top.箱 !== 0 || top.断り書き || top.接続) {
      ng(`画面の上 ${w}px … 読まないものが残っている`
        + `(箱 ${top.箱} / 断り書き ${top.断り書き} / 接続 ${top.接続})`,
        '接続の知らせは「つながっていない × トレーナー」のときだけ出す')
    } else if (!top.版) {
      ng(`画面の上 ${w}px … フッター(版)まで消えている`,
        'どの版を見ているかを確かめる唯一の手がかりである')
    } else if (top.戻す) {
      ng(`画面の上 ${w}px … 「サンプルデータに戻す」が残っている`,
        'ゲストの画面にも出ており、しかも確認の文が嘘だった(2026-09 利用者の指摘)')
    } else {
      ok(`画面の上 ${w}px … 断り書きも接続の知らせも「戻す」も出ない(版は残っている)`)
    }

    /* **画面の下の行き先は、狭い画面だけ**(2026-09 利用者の指定)。

       もとは**ゲストだけ**だったが、利用者の指定で**トレーナーにも出す**
       (そのかわり4つに絞った)。役割では分けなくなったので、
       ここで見るのは**幅**である ——
       768px 以上ではメニューが柱として見えているので、
       帯を出すと**同じことをするものが2つ**になる。

       **「出る」と「出ない」の両方を見る。** 片方だけだと、
       どの幅でも出す形・どの幅でも出さない形の**どちらに壊しても緑**になる。
       あわせて**4つだけか**も数える(`pages` をそのまま渡すと6つ出る)。 */
    const tabs = await page.evaluate(() => ({
      帯: document.querySelectorAll('.app-tabs').length,
      数: document.querySelectorAll('.app-tab').length,
      名: [...document.querySelectorAll('.app-tab-label')].map((e) => e.textContent),
    }))
    const 出るはず = w < 768
    if (出るはず !== (tabs.帯 > 0)) {
      ng(`下の行き先 ${w}px … ${出るはず ? '狭い画面なのに出ない' : '広い画面なのに出ている'}`
        + `(帯 ${tabs.帯} 個)`,
        '768px 以上ではメニューが柱として見えており、同じことをするものが2つになる')
    } else if (出るはず && tabs.数 !== 4) {
      ng(`下の行き先 ${w}px … 4つになっていない(${tabs.数} 個・${tabs.名.join(' / ')})`,
        '「この四つにしてください」(利用者の指定)。`pages` をそのまま渡さない')
    } else {
      ok(`下の行き先 ${w}px … ${出るはず ? `4つ出る(${tabs.名.join(' / ')})` : '出ない'}`)
    }
  }
  await page.close()
  drop2()
}

/* ══════════════════════════════════════════════════════════════
   ⑩ 教材のカードの操作は、**役目ごとに2つの行へ**(2026-09 利用者の指定)

     > 「音声を作り直す」「学習の記録を消す」を教材を消すの左側に並べて、
     > 「印刷 / PDF」と「音声ダウンロード」アイコンを今の位置に並べて
     > ください。…「🖨️」だけでは PDF が出せることがわからないので、
     > 「印刷 / PDF」として、音声ダウンロードもそのまま「音声ダウンロード」
     > としましょう。もともとスペースの問題だったのでこれで解決です。

   4つを1行に詰めていたので、iPhone(390px)で文字が1字ずつ縦に割れ、
   **4本の棒**になっていた。**絵にして詰める**のが前の直しだったが、
   それでは印刷の絵から「PDF でも出せる」が読み取れない。
   いまは**役目で2つの行に分ける。**

     `.card-tools`     ふだん使う2つ。**言葉つき**
     `.material-foot`  めったに押さない3つ。**絵のまま**(11文字は入らない)

   **両側を見る。**
     ①上の行に**言葉が出ているか**(絵だけに戻すと、この指定が消える)
     ②下の行の3つが**同じ1行に並んでいるか**(「教材を消すの左側」)
     ③**押せる大きさ(40px)を割っていないか**
     ④**読み上げ機に名前が渡っているか**(絵だけのボタンの決まり)
     ⑤**長押しで名前が出るか**(触る端末にはカーソルが無い)
     ⑥**言葉が要る状態では、言葉が出るか**(進み具合・2段めの確認)
     ⑦**「教材をシェア」があるか**(トレーナー間でリンクを渡す)
   ①だけを見ると、**下の行を消しても緑のまま**になる。
   ══════════════════════════════════════════════════════════════ */
{
  // **触る端末として開く。** 絵だけのボタンは、そこでしか名前を出せない
  const page = await browser.newPage({ hasTouch: true })
  /** 下の行(絵のまま)。**名前が渡っていること**を見る */
  const FOOT = ['読み上げ音声を作り直す', '練習の記録を消す']
  /** 上の行(言葉つき)。**画面に見えていること**を見る */
  const TOOLS = ['印刷 / PDF', '音声ダウンロード']

  /* ══ **「読み上げの声」の札は、問数の行に入らない**(2026-09 実機・利用者の指定)══
       > スマホでの「読み上げの声」のタブを「教材をシェア」の右に収めるか、
       > もっと小さくしてどこか違うところに置くなりできないですか

     実測(390px)。カードの中身は 356px で、問数の3つが 328px を使う。
     **残り 18px** —— 札(112px)は絶対に入らないので、**まるごと1行**を取り、
     宙に浮いて見えていた。「教材をシェアの右」も同じ理由で入らない
     (共有 194 + シェア 125 + 札 112 = 441 > 356)。

     だから**いちばん下の行の左端**へ、小さく静かに移した。
     ここは 390px で右の3つを引いても 66px 余る。 */
  for (const w of [390, 320]) {
    await page.setViewportSize({ width: w, height: 900 })
    await page.goto(`http://localhost:${PORT}/__bar.html?screen=tools`,
      { waitUntil: 'networkidle' })
    await page.waitForSelector('.cast-chip-btn')
    const m = await page.evaluate(() => {
      const box = (s) => document.querySelector(s)?.getBoundingClientRect() ?? null
      const parts = box('.material-parts')
      const chip = box('.cast-chip-btn')
      const foot = box('.material-foot')
      const first = document.querySelector('.material-foot .iconbtn')?.getBoundingClientRect()
      return {
        問数丈: Math.round(parts?.height ?? 0),
        札幅: Math.round(chip?.width ?? 0),
        // **問数の行の中にいないこと**(下の行へ移したので、下端より下にいる)
        札は下: !!(parts && chip && chip.top >= parts.bottom),
        // **左端にいること**(右の3つは後戻りが利かない操作。混ぜない)
        札は左: !!(chip && foot && Math.round(chip.left) === Math.round(foot.left)),
        /* **右の3つより先にいること。** 360px を割ると札は自分の行を持つので、
           「同じ行で左」ではなく「同じ行か、その上」で見る。
           **3つが1行に並んでいるか**は、すぐ上の「教材の操作」が数えている */
        札は先: !!(chip && first && (chip.right <= first.left || chip.bottom <= first.top)),
      }
    })
    if (m.問数丈 === 0 || m.札幅 === 0) {
      ng(`読み上げの声 ${w}px … 札か問数の行が描かれない`)
    } else if (!m.札は下) {
      ng(`読み上げの声 ${w}px … まだ問数の行の中にいる`,
        '390px では残り 18px しかなく、札が1行まるごと取ってしまう')
    } else if (!m.札は左 || !m.札は先) {
      ng(`読み上げの声 ${w}px … 下の行の左端にいない`,
        '右の3つは**後戻りが利かない操作**。あいだに割り込ませない')
    } else if (w === 390 && m.問数丈 > 30) {
      ng(`読み上げの声 390px … 問数の行がまだ ${m.問数丈}px(2行)`,
        '札を出したぶん折り返している。1行(22px)に収まるはず')
    } else {
      ok(`読み上げの声 ${w}px … 下の行の左端に小さく(札 ${m.札幅}px`
        + `・問数の行 ${m.問数丈}px)`)
    }
  }
  /* 画面が本当にそう書いているか(検証の入り口だけ直しても、
     利用者の画面は変わらない) */
  {
    const src = readFileSync(
      new URL('../src/components/TrainerMaterials.jsx', import.meta.url), 'utf8')
      .replace(/\/\*[\s\S]*?\*\/|\{\/\*[\s\S]*?\*\/\}/g, '')
    if (!/<CastChip[^>]*cast-chip--foot/.test(src)) {
      ng('読み上げの声 … `TrainerMaterials` が下の行に置いていない')
    } else if (/cast-chip--inline/.test(src)) {
      ng('読み上げの声 … 問数の行の札(`--inline`)が残っている',
        '同じ札を2か所に出さない')
    } else {
      ok('読み上げの声 … `TrainerMaterials` が同じ形で書いている')
    }
  }

  for (const w of [390, 375, 360, 320]) {
    await page.setViewportSize({ width: w, height: 844 })
    await page.goto(`http://localhost:${PORT}/__bar.html?screen=tools`,
      { waitUntil: 'networkidle' })
    try {
      await page.waitForSelector('.material-foot .iconbtn', { timeout: 8000 })
    } catch { ng(`教材の操作 ${w}px … 下の行の絵のボタンが描かれない`); continue }

    const m = await page.evaluate(() => {
      const row = document.querySelector('.card-tools')
      const foot = document.querySelector('.material-foot')
      const icons = [...foot.querySelectorAll('.iconbtn')]
      const del = foot.querySelector('.material-danger .btn')
      const line = [...icons, del].filter(Boolean)
      return {
        上の文字: [...row.querySelectorAll('.btn')].map((b) => (b.textContent ?? '').trim()),
        上の高さ: Math.round(row.getBoundingClientRect().height),
        上のあふれ: row.scrollWidth > row.clientWidth + 1,
        はみ出し: document.documentElement.scrollWidth > window.innerWidth,
        名前: icons.map((b) => b.getAttribute('aria-label') ?? ''),
        /* **同じ1行に並んでいるか。**
           上端では見られない —— 絵のボタンは 40px、「教材を消す」は 34px
           なので、まん中でそろえてある行では上端が 3px ずれる(実測)。
           **背の高さが違うものを、上端で比べない。** 見るのはまん中 */
        段: [...new Set(line.map((b) => {
          const r = b.getBoundingClientRect()
          return Math.round((r.top + r.bottom) / 2)
        }))].length,
        // **教材を消すが、いちばん右か**(「その左側に並べて」)
        消すが右端: del
          ? Math.round(del.getBoundingClientRect().left)
            >= Math.max(...icons.map((b) => Math.round(b.getBoundingClientRect().left)))
          : false,
        小さい: icons
          .filter((b) => {
            const r = b.getBoundingClientRect()
            return Math.round(r.width) < 40 || Math.round(r.height) < 40
          })
          .map((b) => b.getAttribute('aria-label')),
      }
    })

    const noWord = TOOLS.filter((t) => !m.上の文字.some((s) => s.includes(t)))
    const missing = FOOT.filter((t) => !m.名前.includes(t))
    if (noWord.length) {
      ng(`教材の操作 ${w}px … 上の行に言葉が無い(${noWord.join(' / ')})`,
        '絵だけでは「PDF も出せる」「何を落とすのか」が読めない(利用者の指定)')
    } else if (missing.length) {
      ng(`教材の操作 ${w}px … 下の行に名前が渡っていない(${missing.join(' / ')})`,
        '絵だけのボタンには `aria-label` を必ず添える(CLAUDE.md)')
    } else if (m.上の高さ > 48) {
      ng(`教材の操作 ${w}px … 上の行が ${m.上の高さ}px(1行なら 34〜40px)`,
        '2つに減らしたのだから、言葉つきでも1行に収まるはず')
    } else if (m.上のあふれ || m.はみ出し) {
      ng(`教材の操作 ${w}px … はみ出している`,
        '`.card-tools` は `nowrap`。入らないぶんは外へ出て切れる')
    } else if (m.段 !== 1) {
      ng(`教材の操作 ${w}px … 下の3つが ${m.段} 段に割れている`,
        '「音声を作り直す」「記録を消す」は**教材を消すの左**(利用者の指定)')
    } else if (!m.消すが右端) {
      ng(`教材の操作 ${w}px … 「教材を消す」が右端にいない`,
        '2つは「教材を消すの左側」に並べる(利用者の指定)')
    } else if (m.小さい.length) {
      ng(`教材の操作 ${w}px … 40px を割っている(${m.小さい.join(' / ')})`,
        '押せる大きさ(40px)は割らない(CLAUDE.md)')
    } else {
      ok(`教材の操作 ${w}px … 上は言葉つき2つ(${m.上の高さ}px)・`
        + '下は絵2つ + 教材を消すの1行')
    }
  }

  if (process.env.SHOT) {
    for (const [n, w] of [['tools-390', 390], ['tools-1440', 1440]]) {
      await page.setViewportSize({ width: w, height: 700 })
      await page.goto(`http://localhost:${PORT}/__bar.html?screen=tools`,
        { waitUntil: 'networkidle' })
      await page.locator('.card').screenshot({ path: `${process.env.SHOT}/${n}.png` })
    }
    await page.goto(`http://localhost:${PORT}/__bar.html?screen=tools&state=busy`,
      { waitUntil: 'networkidle' })
    await page.locator('.card').screenshot({ path: `${process.env.SHOT}/tools-busy.png` })
  }

  /* ── ⑦ **教材をシェア**(トレーナー間でリンクを渡す)─────────── */
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`http://localhost:${PORT}/__bar.html?screen=tools`,
    { waitUntil: 'networkidle' })
  await page.waitForSelector('.material-foot .iconbtn')
  const share = await page.evaluate(() => {
    const all = [...document.querySelectorAll('.btn')].map((b) => (b.textContent ?? '').trim())
    return {
      シェア: all.some((t) => t.includes('教材をシェア')),
      ゲスト: all.some((t) => t.includes('この教材をゲストと共有する')),
      はみ出し: document.documentElement.scrollWidth > window.innerWidth,
    }
  })
  if (!share.シェア) {
    ng('教材の操作 … 「教材をシェア」が無い',
      'トレーナー間でリンクを渡す道(2026-09 利用者の指定)')
  } else if (!share.ゲスト) {
    ng('教材の操作 … 「この教材をゲストと共有する」が消えている',
      '**渡す相手が違う2つ**。片方を足したついでに、もう片方を消さない')
  } else if (share.はみ出し) {
    ng('教材の操作 … シェアを足したらはみ出した')
  } else {
    ok('教材の操作 … 「教材をシェア」と「ゲストと共有する」が両方ある')
  }

  /* **渡し方は2つ。並べて出す**(2026-09 利用者の指定)

       > シェアする際はメールアドレスを入れる、またはリンクを生成して
       > 好きなところに貼り付けれるように、2つから選べると良いですね

     **狭い画面でも確かめる。** 欄が2つ増えるので、
     iPhone(390px)ではみ出さないかは**描いてみないと分からない** */
  for (const w of [390, 320]) {
    await page.setViewportSize({ width: w, height: 900 })
    await page.goto(`http://localhost:${PORT}/__bar.html?screen=tools`,
      { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: '教材をシェア' }).click()
    try {
      await page.waitForSelector('.share-box', { timeout: 4000 })
    } catch { ng(`教材をシェア ${w}px … 押しても欄が開かない`); continue }

    const sh = await page.evaluate(() => {
      const box = document.querySelector('.share-box')
      const link = box.querySelector('input.share-url')
      const mailBtn = [...box.querySelectorAll('a.btn')]
        .find((a) => a.textContent.trim() === 'メールを開く')
      return {
        文: (box.textContent ?? ''),
        リンク: link ? link.value : '',
        宛先の欄: !!box.querySelector('input[type="email"]'),
        // **形が違ううちは押せない**(選ばせてから断らない)
        押せる: mailBtn ? !mailBtn.classList.contains('is-off') : null,
        はみ出し: document.documentElement.scrollWidth > window.innerWidth,
        あふれ: box.scrollWidth > box.clientWidth + 1,
        やめる: !!([...box.querySelectorAll('button')]
          .find((b) => b.textContent.trim() === 'やめる')),
      }
    })

    if (!sh.宛先の欄 || !sh.文.includes('① メールで送る')) {
      ng(`教材をシェア ${w}px … ①メールで送るが無い`)
    } else if (!sh.リンク.includes('?m=') || !sh.文.includes('② リンクをコピー')) {
      ng(`教材をシェア ${w}px … ②リンクが出ていない(${sh.リンク})`,
        'コピーを断る端末でも手で選べるよう、いつも見えるところに出す')
    } else if (sh.押せる !== false) {
      ng(`教材をシェア ${w}px … 宛先が空でも「メールを開く」が押せる`,
        '**選ばせてから断らない**(CLAUDE.md)')
    } else if (!sh.やめる) {
      ng(`教材をシェア ${w}px … 「やめる」が無い`,
        '走らせるボタンのとなりに置く(CLAUDE.md)')
    } else if (sh.はみ出し || sh.あふれ) {
      ng(`教材をシェア ${w}px … はみ出している`)
    } else {
      ok(`教材をシェア ${w}px … 2つとも出る・宛先が空なら押せない・やめるがある`)
    }

    if (process.env.SHOT) {
      await page.locator('.card').screenshot({ path: `${process.env.SHOT}/share-${w}.png` })
    }

    // **宛先を書いたら押せるようになる**(行き止まりを作らない)
    await page.locator('.share-box input[type="email"]').fill('a@b.com')
    const on = await page.evaluate(() => {
      const a = [...document.querySelectorAll('.share-box a.btn')]
        .find((x) => x.textContent.trim() === 'メールを開く')
      return { 押せる: !a.classList.contains('is-off'), 行き先: a.getAttribute('href') ?? '' }
    })
    if (!on.押せる) {
      ng(`教材をシェア ${w}px … 宛先を書いても押せないまま`)
    } else if (!on.行き先.startsWith('mailto:a@b.com?')) {
      ng(`教材をシェア ${w}px … 行き先が mailto ではない(${on.行き先.slice(0, 40)})`)
    } else {
      ok(`教材をシェア ${w}px … 宛先を書くと mailto: が入る`)
    }
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`http://localhost:${PORT}/__bar.html?screen=tools`,
    { waitUntil: 'networkidle' })
  await page.waitForSelector('.material-foot .iconbtn')

  /* ── ⑤ **長押しで名前が出るか**(触る端末にはカーソルが無い)──── */
  const box = await page.locator('.material-foot .iconbtn').nth(0).boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  // **触る端末として押す。** カーソルのときは `title` があるので出さない
  await page.evaluate(() => {
    const b = document.querySelectorAll('.material-foot .iconbtn')[0]
    b.dispatchEvent(new window.PointerEvent('pointerdown', {
      bubbles: true, pointerType: 'touch',
      clientX: b.getBoundingClientRect().x + 10,
      clientY: b.getBoundingClientRect().y + 10,
    }))
  })
  await page.waitForTimeout(700)
  const hint = await page.evaluate(() => {
    const el = document.querySelector('.iconbtn-hint')
    return {
      出た: !!el,
      文: el ? (el.textContent ?? '').trim() : '',
      右: el ? Math.round(el.getBoundingClientRect().right) : 0,
      幅: window.innerWidth,
    }
  })
  if (!hint.出た) {
    ng('教材の操作 … 長押しで名前が出ない',
      '触る端末には「カーソルを載せる」が無い。`title` だけでは伝わらない')
  } else if (hint.文 !== '読み上げ音声を作り直す') {
    ng(`教材の操作 … 長押しで出た名前が違う(${hint.文})`)
  } else if (hint.右 > hint.幅) {
    ng(`教材の操作 … 名前が画面からはみ出す(${hint.右} > ${hint.幅})`)
  } else {
    ok(`教材の操作 … 長押しで「${hint.文}」が出る(右端 ${hint.右} ≦ ${hint.幅})`)
  }

  /* **長押しのあとの指離しは、押したことにしない。**
     名前を読もうとしただけで作り直しが始まっては困る(そのまま課金になる) */
  await page.evaluate(() => {
    const b = document.querySelectorAll('.material-foot .iconbtn')[0]
    b.dispatchEvent(new window.PointerEvent('pointerup', { bubbles: true, pointerType: 'touch' }))
    b.click()
  })
  if (await page.evaluate(() => document.querySelector('.card-tools').dataset.hits) !== '0') {
    ng('教材の操作 … 長押しで名前を読んだだけで、押したことになる',
      '`skip` が効いていない')
  } else {
    ok('教材の操作 … 長押しのあとの指離しは、押したことにしない')
  }

  /* **送ったら消える。** 誤って出ても、読むものを覆い隠さない */
  await page.evaluate(() => {
    document.dispatchEvent(new window.Event('scroll', { bubbles: false }))
  })
  await page.waitForTimeout(120)
  if (await page.evaluate(() => !!document.querySelector('.iconbtn-hint'))) {
    ng('教材の操作 … 画面を送っても名前が消えない')
  } else {
    ok('教材の操作 … 送ったら名前は消える')
  }

  /* **ふつうのタップは、これまでどおり効く。**
     ここが壊れると**どのボタンも押せなくなる**(絵にした日の最悪の壊れ方) */
  await page.goto(`http://localhost:${PORT}/__bar.html?screen=tools`,
    { waitUntil: 'networkidle' })
  await page.waitForSelector('.material-foot .iconbtn')
  await page.locator('.card-tools .btn').nth(0).tap()
  await page.locator('.material-foot .iconbtn').nth(0).tap()
  const hits = await page.evaluate(() => document.querySelector('.card-tools').dataset.hits)
  if (hits !== '2') {
    ng(`教材の操作 … タップが効かない(${hits} / 2)`,
      '長押しの見張りが、ふつうの指離しまで捨てていないか')
  } else {
    ok('教材の操作 … ふつうのタップは効く(2 / 2)')
  }

  /* ── ⑥ **言葉が要る状態では、言葉を出す**──────────────────── */
  await page.goto(`http://localhost:${PORT}/__bar.html?screen=tools&state=busy`,
    { waitUntil: 'networkidle' })
  await page.waitForSelector('.material-foot .iconbtn')
  const busyM = await page.evaluate(() => ({
    上: [...document.querySelectorAll('.card-tools .btn')].map((b) => b.textContent.trim()),
    下: [...document.querySelectorAll('.material-foot .iconbtn-text')]
      .map((s) => s.textContent.trim()),
    はみ出し: document.documentElement.scrollWidth > window.innerWidth,
  }))
  if (!busyM.上.some((t) => t.includes('集めています… 3 / 14'))) {
    ng(`教材の操作 … 集めているあいだ、進み具合が出ない(${busyM.上.join(' / ')})`,
      '進み具合は必ず数で出す(CLAUDE.md)')
  } else if (!busyM.下.some((t) => t.includes('作っています… 3 / 14'))) {
    ng(`教材の操作 … 作っているあいだ、進み具合が出ない(${busyM.下.join(' / ')})`,
      '作り直しは課金が走っている。絵だけでは止まって見える')
  } else if (!busyM.下.includes('本当に消す')) {
    ng('教材の操作 … 2段めの「本当に消す」が言葉で出ない',
      '元に戻せない操作は、絵では言えない')
  } else if (busyM.はみ出し) {
    ng('教材の操作 … 言葉を出したらはみ出した')
  } else {
    ok(`教材の操作 … 状態のときだけ言葉が出る(${busyM.下.join(' / ')})`)
  }

  /* ── 画面が本当に使っているか(検証だけが緑にならないように)──── */
  const src = readFileSync(new URL('../src/components/TrainerMaterials.jsx',
    import.meta.url), 'utf8')
  const want = [
    ['印刷 / PDF', '上の行は言葉つき(絵だけでは PDF が読めない)'],
    ['音声ダウンロード', '同上'],
    ['<MaterialShare material={m} />',
      'トレーナー間でリンクを渡す(2026-09 利用者の指定)。渡し方は `MaterialShare` が持つ'],
    ['material-foot', 'めったに押さない3つは、教材を消すと同じ行'],
    ['読み上げ音声を作り直す', '下の行(絵のまま)'],
    ['練習の記録を消す', '同上'],
  ]
  const gone = want.filter(([t]) => !src.includes(t))
  if (gone.length) {
    ng(`教材の操作 … 画面に無い(${gone.map(([t]) => t).join(' / ')})`,
      gone[0][1])
  } else if ((src.match(/<IconButton/g) ?? []).length < 2) {
    ng('教材の操作 … 下の行の `IconButton` が2つ揃っていない')
  } else if (!src.includes('<MaterialDelete')) {
    ng('教材の操作 … `MaterialDelete` が消えている')
  } else {
    ok('教材の操作 … `TrainerMaterials` が同じ形で書いている')
  }

  await page.close()
}

/* ══════════════════════════════════════════════════════════════
   **「宿題をさがす」は畳める。件数の札は題の反対側**(2026-09 利用者の指定)

     > 宿題を探すも折りたたみ式にしてください。そして検索バーの下の「3件」は
     > 丸などで囲って何か配色してください。そして位置は宿題を探すの文字の
     > 反対側、検索バーの右端の上にしてください

   **`SearchBar` は2か所で使っている**(ゲストの「宿題をさがす」と
   トレーナーの「教材をさがす」)。畳めるのは前者だけなので、
   **両方を描いて、後者が1ドットも変わっていないこと**まで数える。
   「畳める」だけを見ると、**教材の画面まで畳んでも緑のまま**になる。
   ══════════════════════════════════════════════════════════════ */
{
  const page = await browser.newPage()
  await page.setViewportSize({ width: 390, height: 844 })

  await page.goto(`http://localhost:${PORT}/__bar.html?screen=search`,
    { waitUntil: 'networkidle' })
  await page.waitForSelector('[data-fold] details')

  const shut = await page.evaluate(() => {
    const box = (el) => (el ? el.getBoundingClientRect() : null)
    const fold = document.querySelector('[data-fold] details')
    const sum = fold.querySelector('summary')
    const badge = fold.querySelector('.searchbar-badge')
    const input = fold.querySelector('.searchbar-field > input')
    const plain = document.querySelector('[data-plain] .searchbar')
    return {
      畳んである: !fold.open,
      題: sum.textContent.trim(),
      札: badge ? badge.textContent.trim() : null,
      札の色: badge ? window.getComputedStyle(badge).backgroundColor : null,
      札の丸み: badge ? window.getComputedStyle(badge).borderRadius : null,
      札の右: badge ? Math.round(box(badge).right) : null,
      題の右: Math.round(box(sum).right),
      /* **`offsetParent` では見分けられない。** 畳んだ `<details>` の中は
         `content-visibility: hidden` で描かれないだけで、`offsetParent` は
         残っている(実測して気づいた)。`checkVisibility()` で見る */
      入力が見えるか: !!(input && input.checkVisibility()),
      畳んだ丈: Math.round(box(fold).height),
      /* **さがすとしぼるは、1つの箱**(2026-09 実機・利用者の指定)。
         取り組みの札が、検索の欄と**同じ `<details>` の中**にいるか */
      札の行が中にいる: !!fold.querySelector('.chiprow'),
      畳める箱の数: document.querySelectorAll('[data-fold] details').length,
      // 教材の側 —— 畳んでいない・札を使っていない・件数はこれまでどおり
      教材は畳めない: !!plain && plain.tagName === 'SECTION',
      教材の札: !!document.querySelector('[data-plain] .searchbar-badge'),
      教材の件数: document.querySelector('[data-plain] .searchbar-count')?.textContent.trim(),
      はみ出し: document.documentElement.scrollWidth > window.innerWidth,
    }
  })

  if (!shut.畳んである) {
    ng('宿題をさがす … 既定で開いている', '開いたままだと宿題が1件も見えない')
  } else if (shut.入力が見えるか) {
    ng('宿題をさがす … 畳んでいるのに検索の欄が見えている')
  } else if (shut.札 !== '3 件') {
    ng(`宿題をさがす … 畳んだままでは件数が見えない(${shut.札})`,
      '何件あるかは、開かなくても分かるようにする')
  } else if (shut.札の丸み === '0px' || /rgba?\(0, 0, 0, 0\)/.test(shut.札の色)) {
    ng(`宿題をさがす … 札に色も丸みも無い(${shut.札の色} / ${shut.札の丸み})`,
      '「丸などで囲って何か配色してください」(利用者の指定)')
  } else if (Math.abs(shut.札の右 - shut.題の右) > 2) {
    ng(`宿題をさがす … 札が右端にいない(札 ${shut.札の右} / 行 ${shut.題の右})`,
      '「宿題を探すの文字の反対側」(利用者の指定)')
  } else if (shut.はみ出し) {
    ng('宿題をさがす … 横にはみ出している')
  } else if (!shut.札の行が中にいる || shut.畳める箱の数 !== 1) {
    ng(`宿題をさがす … さがすとしぼるが1つになっていない`
      + `(箱 ${shut.畳める箱の数} 個・札の行は中に ${shut.札の行が中にいる})`,
      '「「教材をさがす」と「教材を絞る」を１つにまとめて」(利用者の指定)')
  } else {
    ok(`宿題をさがす・しぼる … 畳んで ${shut.畳んだ丈}px・箱は1つ`
      + `・札が右端に出る(${shut.札}・${shut.札の右}px)`)
  }

  /* **教材の画面は1ドットも変わっていない。**
     こちらは `collapsible` を渡していないので、これまでどおり
     `section.searchbar` + 行の中の「35 件」である */
  if (!shut.教材は畳めない) {
    ng('教材をさがす … 畳める形になっている', '言われた場所だけを直す(共通ルール)')
  } else if (shut.教材の札) {
    ng('教材をさがす … 札が出ている', '同上。あちらの件数は行の中である')
  } else if (shut.教材の件数 !== '35 件') {
    ng(`教材をさがす … 件数が消えている(${shut.教材の件数})`)
  } else {
    ok('教材をさがす … これまでどおり(畳めない・札なし・行の中に 35 件)')
  }

  /* ── 開いたら、検索の欄が**札の下**に出る ──────────────────── */
  await page.goto(`http://localhost:${PORT}/__bar.html?screen=search&open=1`,
    { waitUntil: 'networkidle' })
  await page.waitForSelector('[data-fold] details[open]')
  const open = await page.evaluate(() => {
    const fold = document.querySelector('[data-fold] details')
    const b = fold.querySelector('.searchbar-badge').getBoundingClientRect()
    const r = fold.querySelector('.searchbar-row').getBoundingClientRect()
    const input = fold.querySelector('.searchbar-field > input')
    return {
      入力が見えるか: !!(input && input.checkVisibility()),
      札の下: Math.round(b.bottom),
      行の上: Math.round(r.top),
      // **同じ数を2か所に出さない**
      行の中の件数: !!fold.querySelector('.searchbar-count'),
      はみ出し: document.documentElement.scrollWidth > window.innerWidth,
    }
  })
  if (!open.入力が見えるか) {
    ng('宿題をさがす … 開いても検索の欄が出ない')
  } else if (open.札の下 > open.行の上) {
    ng(`宿題をさがす … 札が検索バーの上にいない(札 ${open.札の下} / 行 ${open.行の上})`,
      '「検索バーの右端の上に」(利用者の指定)')
  } else if (open.行の中の件数) {
    ng('宿題をさがす … 件数が2か所に出ている', '札と行の両方に出さない')
  } else if (open.はみ出し) {
    ng('宿題をさがす … 開いたら横にはみ出した')
  } else {
    ok(`宿題をさがす … 開くと検索の欄が札の下に出る(札 ${open.札の下} → 行 ${open.行の上})`)
  }

  /* ── 画面が本当に呼んでいるか(検証だけが緑にならないように)──── */
  const tl = readFileSync(new URL('../src/components/TrainerLearners.jsx',
    import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\/|\{\/\*[\s\S]*?\*\/\}/g, '')
  if (!/title="宿題をさがす・しぼる"[\s\S]{0,400}collapsible/.test(tl)) {
    ng('宿題をさがす … 画面が `collapsible` を渡していない',
      '部品に足しても、渡さなければ利用者の画面は変わらない')
  } else if (!tl.includes('savePastSearchOpen(')) {
    ng('宿題をさがす … 開け閉めを覚えていない',
      '一度決める設定は覚える(CLAUDE.md)')
  } else if (readFileSync(new URL('../src/components/TrainerMaterials.jsx',
    import.meta.url), 'utf8').includes('collapsible')) {
    ng('教材をさがす … `collapsible` を渡している', '言われた場所だけを直す')
  /* **箱を2つに戻していないか。** `<details className="card material-search"`
     を自分で書いていたら、それが「宿題をしぼる」の箱である */
  } else if (/<details className="card material-search"/.test(tl)) {
    ng('宿題をさがす … 畳める箱が2つに戻っている',
      '「1つにまとめて」(利用者の指定)。しぼるは `SearchBar` の中身にする')
  /* **絞り込みの行は、まとめた箱の「下」**(利用者の指定)。
     ソースの並び順で見る —— `SearchBar` が先、`HomeworkFilter` が後 */
  } else if (tl.indexOf('<HomeworkFilter') < tl.indexOf('<SearchBar')) {
    ng('宿題をさがす … 絞り込みの行が箱より上にいる',
      '「「日付・並び順」「分野: すべて」「苦手項目で絞る」をその下に」')
  } else if (tl.includes('PastFilterOpen')) {
    ng('宿題をさがす … 使わなくなった控え(`eas.pastFilter`)が残っている',
      '**値を偽にするだけにしない。** 残すと次に見た人が迷う(CLAUDE.md)')
  } else {
    ok('宿題をさがす・しぼる … 1つの箱・絞り込みはその下・教材の側は変えていない')
  }

  await page.close()
}

/* ══════════════════════════════════════════════════════════════
   **画面の下の行き先は、狭い画面だけ。トレーナーにも出す**(2026-09 利用者の指定)

     > ゲストとしてログインするとメニューにたどり着く方法が
     > 1番上までスクロールしてハンバーガーを押すしかないのが
     > かなり不便かつ分かりにくいです

     > トレーナーのアカウントでも、ゲストと同じようにスマホやパッドで
     > 見る時には下段のメニューを表示するようにしてください。
     > 教材、単語帳、Quick Response、スピーチ この四つにしてください。

   **「出る」だけを見ない。** それだと**広い画面にも出すように
   書き換えて緑のまま**になる(あちらはメニューが柱として
   見えているので、同じことをするものが2つ並ぶ)。
   だから ①狭い幅で出て、押せて、名前が切れないこと
   ②**広い画面には1つも出ないこと**の両方を数える(骨組みの側)。

   **ゲストとトレーナーの両方を測る。** ちがうのは先頭の1つだけだが、
   **「教材」は「今週の宿題」より短い**ので、片方だけ測ると
   もう片方で名前があふれても気づけない。
   ══════════════════════════════════════════════════════════════ */
{
  // **押して確かめる**ので、触れる画面として開く
  const page = await browser.newPage({ hasTouch: true })

  /* 幅は**境目でないものも混ぜる**(端末の「画面表示を拡大」で 320px になる)。
     `[誰, 先頭の行き先]` */
  const ROLES = [['ゲスト', '今週の宿題', ''], ['トレーナー', '教材', '&role=trainer']]
  for (const [who, first, extra] of ROLES) for (const w of [390, 375, 360, 320]) {
    await page.setViewportSize({ width: w, height: 844 })
    await page.goto(`http://localhost:${PORT}/__bar.html?screen=tabs&view=wordbook${extra}`,
      { waitUntil: 'networkidle' })
    await page.waitForSelector('.app-tabs')

    /* **送っても消えないことが、この帯の役目そのものである。**
       ただし「画面の中にあるか」だけでは足りない —— 貼り付きをやめても、
       送った先ではたまたま画面の中に入る(実際にそれで**緑のまま**だった)。
       だから**送る前と送ったあとの両方で、下端が画面の下端に重なるか**を見る。
       貼り付いていなければ、送る前は 1200px 下にいるので必ず外れる */
    const atBottom = async (y) => {
      await page.evaluate((to) => window.scrollTo(0, to), y)
      await page.waitForTimeout(150)
      return page.evaluate(() => {
        const r = document.querySelector('.app-tabs').getBoundingClientRect()
        return Math.abs(r.bottom - window.innerHeight) <= 1
      })
    }
    const 貼り付き = await atBottom(0) && await atBottom(800)

    const m = await page.evaluate(() => {
      const bar = document.querySelector('.app-tabs')
      const r = bar.getBoundingClientRect()
      const tabs = [...document.querySelectorAll('.app-tab')].map((t) => {
        const lab = t.querySelector('.app-tab-label')
        return {
          名: lab.textContent,
          高: Math.round(t.getBoundingClientRect().height),
          切れ: lab.scrollWidth > lab.clientWidth + 1,
        }
      })
      const on = document.querySelector('.app-tab.is-on')
      const cs = on ? window.getComputedStyle(on) : null
      return {
        下端: Math.round(r.bottom), 窓: window.innerHeight,
        丈: Math.round(r.height),
        名: tabs.map((t) => t.名),
        低い: tabs.filter((t) => t.高 < 44).map((t) => t.名),
        切れ: tabs.filter((t) => t.切れ).map((t) => t.名),
        印: on ? { 名: on.textContent, 地: cs.backgroundColor, 太さ: cs.fontWeight } : null,
        はみ出し: document.documentElement.scrollWidth > window.innerWidth,
      }
    })

    /* **「スピーチ練習」**(2026-09 利用者の指定で「発音練習」から改名)。
       ゲストもトレーナーも同じ名前である */
    const want = [first, '単語帳', 'Quick Response', 'スピーチ練習']
    const どこ = `下の行き先 ${who} ${w}px`
    if (!貼り付き) {
      ng(`${どこ} … 画面の下端に貼り付いていない(下端 ${m.下端} / 窓 ${m.窓})`,
        '送っても消えないことが、この帯の役目である')
    } else if (m.名.join('/') !== want.join('/')) {
      ng(`${どこ} … 行き先が違う(${m.名.join(' / ')})`, `ほしいのは ${want.join(' / ')}`)
    } else if (m.切れ.length) {
      ng(`${どこ} … 名前が切れている(${m.切れ.join(' / ')})`,
        '「Quick…」では何のボタンか分からない。切らずに2行へ折り返させる')
    } else if (m.低い.length) {
      ng(`${どこ} … 押せる大きさを割っている(${m.低い.join(' / ')})`)
    } else if (!m.印 || /rgba?\(0, 0, 0, 0\)/.test(m.印.地) || m.印.太さ !== '700') {
      ng(`${どこ} … いまいる画面の印が弱い(${JSON.stringify(m.印)})`,
        '色だけに頼らない —— 地色・文字色・太字・上の帯の4つで示す')
    } else if (m.はみ出し) {
      ng(`${どこ} … 横にはみ出している`)
    } else {
      ok(`${どこ} … 4つとも出て切れない(帯 ${m.丈}px・印は「${m.印.名}」)`)
    }
  }

  /* **押したら本当に効くか。** 出ているだけで動かなければ意味がない */
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`http://localhost:${PORT}/__bar.html?screen=tabs`,
    { waitUntil: 'networkidle' })
  await page.waitForSelector('.app-tabs')
  await page.locator('.app-tab').nth(2).tap()
  const picked = await page.evaluate(() => document.querySelector('.app-tabs').dataset.picked)
  if (picked !== 'qr') {
    ng(`下の行き先 … 押しても移らない(${picked ?? 'なし'} / qr)`)
  } else {
    ok('下の行き先 … 押すとその画面へ移る')
  }

  /* ══ **Quick Response の表示は、単語帳と同じ**(2026-09 利用者の指定)══
       > quick reponse内の表示だが、単語帳と同じにしてくれ

     単語帳は**答えを同じ場所で入れ替える。** Quick Response は
     「入るなら並べる」だったので、**開いたときの動きが違っていた。**

     **見るのは2つ。** ①日本語と英語が同時に出ていないか(=入れ替え)
     ②**押したあともボタンが動かないか。** ②を見ないと、
     入れ替えても枠が伸びる形に書き換えたときに気づけない。
     **長い英文で測る** —— 短い文では、足しても動かないので分からない。

     **本物の置かれ方(集中モード)で測る。** 高さの決まりは置かれ方で
     変わるので、裸の `<div>` に置いて測ると**壊れていても緑になる。**
     実際、はじめ `div.app-main` に置いていたので 390px で 19px 動いたが、
     それが「入れ物が本物と違うせい」なのか「本当に壊れている」のかを
     切り分けるのに一手よけいにかかった(答えは**本当に壊れていた**)。 */
  for (const w of [390, 1280]) {
    await page.setViewportSize({ width: w, height: 844 })
    await page.goto(`http://localhost:${PORT}/__bar.html?screen=qr`,
      { waitUntil: 'networkidle' })
    await page.waitForSelector('.qr-card')
    const before = await page.evaluate(() => {
      const r = document.querySelector('.qr-answers').getBoundingClientRect()
      const b = document.querySelector('.qr-body')
      return {
        答えの行: Math.round(r.top),
        日本語: !!document.querySelector('.qr-ja'),
        枠: Math.round(b.getBoundingClientRect().height),
        中身: b.scrollHeight,
      }
    })
    await page.locator('.qr-peek .btn').first().click()
    await page.waitForTimeout(250)
    const after = await page.evaluate(() => {
      const r = document.querySelector('.qr-answers').getBoundingClientRect()
      const b = document.querySelector('.qr-body')
      return {
        答えの行: Math.round(r.top),
        日本語: !!document.querySelector('.qr-ja'),
        英語: !!document.querySelector('.qr-en'),
        枠: Math.round(b.getBoundingClientRect().height),
        中身: b.scrollHeight,
      }
    })
    const ずれ = Math.abs(after.答えの行 - before.答えの行)
    if (!before.日本語 || !after.英語) {
      ng(`QR ${w}px … 出題か答えが出ていない`)
    } else if (after.日本語) {
      ng(`QR ${w}px … 日本語と英語が同時に出ている`,
        '単語帳と同じで、答えは同じ場所で入れ替える(足さない)')
    } else if (ずれ > 1) {
      ng(`QR ${w}px … 開いたらボタンが ${ずれ}px 動いた`
        + `(枠 ${before.枠} → ${after.枠}px)`,
        '出題の枠は**残りの高さ**を取る。中身なりに伸ばさない'
        + '(`.qrfocus .qr-body { flex: 1 1 auto; max-height: none }`)')
    } else {
      ok(`QR ${w}px … 入れ替えで出て、ボタンは動かない`
        + `(枠 ${before.枠}px・ボタン ${before.答えの行}px)`)
    }
  }

  /* ══ **Quick Response の復習は、単語帳とそろえる**(2026-09 実機・利用者の指定)══
       > 単語帳とQuick Responseとの表示を揃えてください
       > 同じといってもQuick Response の幅は変えないでくださいよ。
       > 狭くしないでくださいよ。あくまでバックグラウンドの色を白くして、
       > 集中モードではなくしてください

     **余白は、そのあと利用者の判断で改めた**(2026-09 実機)。

       > スマホでの quick response の表示、余白が広く画面のスペースを
       > 生かし切れていないから、比較として添付した単語帳と
       > 上下左右共に同じ余白にしてください。PCでの表示は現状問題ありません。

     **見るのは5つ。**
       ①復習(`?screen=qrrev`)は**地も帯も明るい**か
       ②**スマホでは、カードが `.focus-body` の余白にぴったり合う**か
         (単語帳の復習とまったく同じ余白。実測 390px で左右 12 / 12px)
       ③紙・「集中モードを終える」・「表示」が消えているか
       ④**教材の中(`?screen=qr`)は、これまでどおり黒いまま**か
       ⑤**PC(1280px)の幅は1ドットも変わっていない**か
         (「PCでの表示は現状問題ありません」)

     ④⑤を見ないと、**ついでに教材の中まで明るくしても、
     PC の幅まで変えても緑のまま**になる
     (「出る」と「出ない」の両方を見る・CLAUDE.md)。 */
  {
    const 測る = async (screen, w = 390) => {
      await page.setViewportSize({ width: w, height: 844 })
      await page.goto(`http://localhost:${PORT}/__bar.html?screen=${screen}`,
        { waitUntil: 'networkidle' })
      await page.waitForSelector('.qr-card')
      return page.evaluate(() => {
        const cs = (el) => (el ? window.getComputedStyle(el) : null)
        const 地 = cs(document.querySelector('.focus'))
        const 帯 = cs(document.querySelector('.focus-top'))
        const 数 = cs(document.querySelector('.focus-count'))
        const num = (c) => (c.match(/\d+/g) ?? []).slice(0, 3).map(Number)
        const 明るさ = (c) => { const [r, g, b] = num(c); return (r + g + b) / 3 }
        const さ = (a, b) => {
          const [x, y, z] = num(a); const [p, q, r] = num(b)
          return Math.abs(x - p) + Math.abs(y - q) + Math.abs(z - r)
        }
        return {
          地の明るさ: Math.round(明るさ(地.backgroundColor)),
          帯の明るさ: Math.round(明るさ(帯.backgroundColor)),
          地と帯の差: さ(地.backgroundColor, 帯.backgroundColor),
          数の読みやすさ: 数 ? さ(数.color, 帯.backgroundColor) : -1,
          幅: Math.round(document.querySelector('.qr').getBoundingClientRect().width),
          紙: !!document.querySelector('.focus-paper'),
          終える: !!document.querySelector('.focus-exit'),
          表示: !!document.querySelector('.lesson-more'),
          /* **カードが `.focus-body` の余白にぴったり合っているか。**
             単語帳の復習(`.wbfocus .wordcard`)はそうなっている ——
             入れ物が余白を足していると、そのぶん内側に入る */
          ...(() => {
            const b = document.querySelector('.focus-body')
            const r = document.querySelector('.qr').getBoundingClientRect()
            const br = b.getBoundingClientRect()
            const p = window.getComputedStyle(b)
            const px = (v) => Math.round(parseFloat(v))
            return {
              余白: [px(p.paddingTop), px(p.paddingRight),
                px(p.paddingBottom), px(p.paddingLeft)],
              // 枠の内側から、カードまでの余り(0 なら、ぴったり合っている)
              余り: [
                Math.round(r.left - (br.left + px(p.paddingLeft))),
                Math.round((br.right - px(p.paddingRight)) - r.right),
              ],
              上の余り: Math.round(r.top - (br.top + px(p.paddingTop))),
            }
          })(),
        }
      })
    }
    const 中 = await 測る('qr')      // 教材の中(紙のある集中モード)
    const 復習 = await 測る('qrrev')  // 復習(紙を持たない)
    // PC は「現状問題ありません」なので、**変わっていないこと**を数える
    const 中PC = await 測る('qr', 1280)
    const 復習PC = await 測る('qrrev', 1280)

    /* ① 明るいか。**帯だけ黒く残ると、そこだけ集中モードが残って見える** */
    if (復習.地の明るさ < 128 || 復習.帯の明るさ < 128) {
      ng(`QR復習 … 地か帯がまだ暗い(地 ${復習.地の明るさ} / 帯 ${復習.帯の明るさ})`,
        '`focus--plain` で、地も上の帯も明るくする(単語帳の復習と同じ)')
    } else if (復習.地と帯の差 > 12) {
      ng(`QR復習 … 帯が地と違う色になっている(差 ${復習.地と帯の差})`,
        '単語帳の帯(`.wbfocus > .wb-run`)は、地と同じ色 + 下に線1本')
    } else if (復習.数の読みやすさ < 60) {
      ng(`QR復習 … 「◯ / ◯」が帯に埋もれている(差 ${復習.数の読みやすさ})`,
        '`.focus--plain .focus-count` を明るい帯で読める色にする')
    } else {
      ok(`QR復習 … 地も帯も明るい(${復習.地の明るさ}・数の差 ${復習.数の読みやすさ})`)
    }

    /* ② **スマホでは、単語帳の復習とまったく同じ余白**(2026-09 利用者の指定)。
         入れ物(`.focus-plainbox`)が紙と同じ余白を持っていたので、
         カードが**左右 12px ずつ内側**に入り、幅も 24px 細かった。
         いまは `.focus-body` の余白(16 / 12)にぴったり合う */
    const 余り = 復習.余り
    if (余り[0] !== 0 || 余り[1] !== 0 || 復習.上の余り !== 0) {
      ng(`QR復習 390px … 枠の余白に合っていない`
        + `(左右の余り ${余り.join(' / ')}px・上の余り ${復習.上の余り}px)`,
        'スマホでは `.focus-plainbox` の余白を落とし、'
        + '単語帳の復習と同じ余白にする(利用者の指定)')
    } else {
      ok(`QR復習 390px … 単語帳と同じ余白(上下左右 ${復習.余白.join(' / ')}px`
        + `・カード ${復習.幅}px)`)
    }

    /* ⑤ **PC は1ドットも変えていない**(「PCでの表示は現状問題ありません」)。
         狭い画面だけを直したので、ここは教材の中とそろったままである */
    if (復習PC.幅 !== 中PC.幅) {
      ng(`QR復習 1280px … PC の幅が変わった(${中PC.幅} → ${復習PC.幅}px)`,
        '直したのは狭い画面だけ(「PCでの表示は現状問題ありません」)')
    } else {
      ok(`QR復習 1280px … PC の幅は変わっていない(どちらも ${復習PC.幅}px)`)
    }

    /* ③ 紙・出るボタン・「表示」が消えているか */
    if (復習.紙 || 復習.終える) {
      ng(`QR復習 … 紙(${復習.紙})か「集中モードを終える」(${復習.終える})が残っている`,
        '`plain` では、どちらも出さない(単語帳の復習と同じ)')
    } else if (復習.表示) {
      ng('QR復習 … 中身の無い「表示」の札が出ている',
        '書き込む / メモも設定も無いので、押しても何も起きない')
    } else {
      ok('QR復習 … 紙も「終える」も「表示」も出さない')
    }

    /* ④ **教材の中は、これまでどおり黒いまま**(言われた場所だけを直す) */
    if (中.地の明るさ > 60 || 中.帯の明るさ > 60) {
      ng(`QR教材の中 … 明るくなってしまった(地 ${中.地の明るさ} / 帯 ${中.帯の明るさ})`,
        '「紙の周囲は黒」は、あちらの別の指定である(言われた場所だけを直す)')
    } else if (!中.紙 || !中.終える) {
      ng(`QR教材の中 … 紙(${中.紙})か「集中モードを終える」(${中.終える})が消えた`)
    } else {
      ok(`QR教材の中 … 黒い地に白い紙のまま(地 ${中.地の明るさ})`)
    }

    /* ⑥ **画面が本当に `plain` を渡しているか**(CLAUDE.md)。
         ここまでは検証が自分で `plain` を渡して描いているので、
         **`QrReview.jsx` の側で外しても、①〜④は緑のまま**になる。
         **「名前が出てくるか」で見ない** —— 説明の中にも `plain` と
         書いてあるので、コメントを落としてから、**渡している形**で見る */
    const rev = readFileSync(join(ROOT, 'src/components/QrReview.jsx'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    const 教材の中 = readFileSync(join(ROOT, 'src/components/QuickResponse.jsx'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    if (!/\n\s*plain\s*$/m.test(rev)) {
      ng('QR復習 … `QrReview.jsx` が `FocusFrame` に `plain` を渡していない',
        '渡さないと、利用者の画面は黒い集中モードのままである')
    } else if (/\n\s*plain\s*$/m.test(教材の中)) {
      ng('QR教材の中 … `QuickResponse.jsx` にも `plain` が付いた',
        '「紙の周囲は黒」はあちらの別の指定(言われた場所だけを直す)')
    } else if (rev.includes('qr--paper')) {
      ng('QR復習 … `qr--paper` が残っている',
        '紙の上の色に差し替えるものなので、地が白いこの画面では要らない')
    } else {
      ok('QR復習 … 復習だけが `plain`(教材の中はこれまでどおり)')
    }
  }

  /* ── **「AI が作っています」の1行は、教材の中に出る**(2026-09 利用者の問い)──
       > 音声や教材を「AIで作成してます」という注意書きはいらないのか？

     **画面のいちばん上の帯に戻さない。** まさにこの回で外したところである。
     読むもののそばに、静かに1行だけ置く。
     **色は紙の変数から取る**(値を直に書くと、暗い配色の紙で黒に黒になる) */
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`http://localhost:${PORT}/__bar.html?role=learner&who=g1`,
    { waitUntil: 'networkidle' })
  await page.waitForSelector('.lesson-sheet')
  const ai = await page.evaluate(() => {
    const el = document.querySelector('.ai-note')
    if (!el) return { 無い: true }
    const cs = window.getComputedStyle(el)
    const paper = window.getComputedStyle(document.querySelector('.lesson-sheet'))
    const num = (c) => (c.match(/\d+/g) ?? []).slice(0, 3).map(Number)
    const [r, g, bl] = num(cs.color)
    const [pr, pg, pb] = num(paper.backgroundColor)
    return {
      文: el.textContent.replace(/\s+/g, ''),
      // **紙の地色と、読めるだけ離れているか**(黒い紙に黒い文字を作らない)
      差: Math.abs(r - pr) + Math.abs(g - pg) + Math.abs(bl - pb),
      大きさ: Math.round(parseFloat(cs.fontSize)),
      上に居る: !!el.closest('.app-topbar'),
    }
  })
  if (ai.無い) {
    ng('AI の断り … 教材の中に出ていない', '読むもののそばに1行だけ置く')
  } else if (!ai.文.includes('AIが作っています') || !ai.文.includes('トレーナーに知らせて')) {
    ng(`AI の断り … 文言が違う(${ai.文})`,
      '「AI が作っています」だけでは、読んだ人にできることが無い')
  } else if (ai.上に居る) {
    ng('AI の断り … 画面のいちばん上の帯に出ている',
      'まさにこの回で外したところである。作り直さない')
  } else if (ai.差 < 60) {
    ng(`AI の断り … 紙の地色と近すぎて読めない(差 ${ai.差})`,
      '色は紙の変数から取る(値を直に書くと、暗い紙で黒に黒になる)')
  } else if (ai.大きさ > 13) {
    ng(`AI の断り … 本文より先に目が行く大きさ(${ai.大きさ}px)`)
  } else {
    ok(`AI の断り … 教材の中に静かに1行(${ai.大きさ}px・紙との差 ${ai.差})`)
  }

  /* **色を決め打ちしていないか**は、描いて測っても分からない ——
     明るい紙の上では、黒く決め打ちしても「読める」ので通ってしまう
     (実際に `#1c1c1a` に戻して、緑のままだった)。
     **書いてある形で見る。** 紙は配色の島なので、値を直に書くと
     暗い側で黒に黒になる(CLAUDE.md) */
  const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8')
  const block = css.match(/\.ai-note \{[^}]*\}/)?.[0] ?? ''
  const decls = [...block.matchAll(/(color|border-top-color)\s*:\s*([^;]+);/g)]
  const 直書き = decls.filter(([, , v]) => !v.includes('var(')).map(([, k]) => k)
  if (!block) {
    ng('AI の断り … `.ai-note` の指定が無い')
  } else if (直書き.length) {
    ng(`AI の断り … 色を決め打ちしている(${直書き.join(' / ')})`,
      '紙は配色の島である。値を直に書くと、暗い側で黒い紙に黒い文字になる')
  } else {
    ok('AI の断り … 色は変数から取っている')
  }

  /* ══ **支度の帯は、ゲストには出さない**(2026-09 実機・利用者の指定)══
       > そもそもゲストには出さない(役割で判定する)

     ゲストの画面のいちばん上に、支度の帯が
     「2026-09-04 / 食事の話 / 決まり文句 …  閉じる」として残っていた。
     教材を作るのも支度を始めるのもトレーナーだけなのに、
     **帯そのものには役割の判定が1つも無かった。**

     **「出ない」だけを見ない** —— それだと**誰にも出さない形に壊しても
     緑のまま**になる。トレーナーに出ることも一緒に数える。 */
  await page.setViewportSize({ width: 390, height: 844 })
  for (const [role, 出るべきか] of [['learner', false], ['trainer', true], ['owner', true]]) {
    await page.goto(`http://localhost:${PORT}/__bar.html?screen=jobbar&role=${role}`,
      { waitUntil: 'networkidle' })
    await page.waitForTimeout(120)
    const 出た = await page.evaluate(() => !!document.querySelector('.jobbar'))
    const 教材名 = await page.evaluate(
      () => document.querySelector('.jobbar-title')?.textContent ?? '')
    if (出た !== 出るべきか) {
      ng(`支度の帯 ${role} … ${出た ? '出ている' : '出ていない'}`,
        出た
          ? 'ゲストには仕組みの内側を見せない(教材の名前も、支度の進み具合も)'
          : 'トレーナーには出す。**「出ない」だけを見ると、消しすぎても緑になる**')
    } else if (出るべきか && !教材名.includes('食事の話')) {
      ng(`支度の帯 ${role} … 出ているが、何の支度か分からない(${教材名})`)
    } else {
      ok(`支度の帯 ${role} … ${出た ? `出る(${教材名.slice(0, 20)}…)` : '出ない'}`)
    }
  }
  /* 役割の判定を、部品の中に置いているか(呼ぶ側に書くと必ずどこかが抜ける)。
     **説明の文には引っかからないよう、書いてある形で見る** */
  {
    const src = readFileSync(new URL('../src/components/JobBar.jsx', import.meta.url), 'utf8')
      .replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')
    if (!/if\s*\(!canSeeSystemDetail\(\)\)\s*return null/.test(src)) {
      ng('支度の帯 … `canSeeSystemDetail()` で帰っていない',
        '判定は1か所。**既定は「見せない」**(役割が分からないうちも出さない)')
    } else {
      ok('支度の帯 … 判定は `canSeeSystemDetail()` 1か所(部品の中)')
    }
  }

  /* ══ **支度の帯が、上の帯にかぶらない**(2026-09 実機・利用者の指摘)══
       > 上部バーは消えていなかったのですが、このバックグラウンドロード中の
       > 表示のバーがスクロールするとかぶってしまっているのが原因でした。

     **どちらも `position: sticky; top: 0; z-index: 30`** だったので、
     送ると2つとも上端 0 へ来て、あとに書いてある支度の帯が
     上の帯をまるごと覆っていた。実測(直す前・4つの幅とも):
     送る前 帯 0〜61 / 支度 61〜120 → 送った後 帯 0〜61・**支度 0〜59**、
     **☰ が押せない。**

     **送る前だけを見ない** —— そこでは縦に並ぶので、
     **壊れたままでも緑になる。** 送ったあとを必ず測る。 */
  for (const w of [1280, 900, 768, 390]) {
    await page.setViewportSize({ width: w, height: 800 })
    await page.goto(`http://localhost:${PORT}/__bar.html?screen=sticky&role=trainer`,
      { waitUntil: 'networkidle' })
    await page.waitForSelector('.jobbar', { timeout: 8000 })
    await page.evaluate(() => window.scrollTo(0, 600))
    await page.waitForTimeout(80)
    const m = await page.evaluate(() => {
      const box = (s) => {
        const el = document.querySelector(s)
        if (!el) return null
        const r = el.getBoundingClientRect()
        return { top: Math.round(r.top), bottom: Math.round(r.bottom) }
      }
      const bur = document.querySelector('.nav-burger')?.getBoundingClientRect()
      const hit = bur
        ? document.elementFromPoint(bur.left + bur.width / 2, bur.top + bur.height / 2)
        : null
      return { 帯: box('.app-topbar'), 支度: box('.jobbar'),
        押せる: !!(hit && hit.closest('.nav-burger')) }
    })
    if (!m.帯 || !m.支度) {
      ng(`貼り付く帯 ${w}px … 帯が描かれていない`)
    } else if (!m.押せる) {
      ng(`貼り付く帯 ${w}px … 送ると ☰ が押せない`,
        '支度の帯が上の帯にかぶっている。貼り付く箱は `.app-stick` 1つにする')
    } else if (m.支度.top < m.帯.bottom) {
      ng(`貼り付く帯 ${w}px … 支度の帯が上の帯に重なっている`
        + `(帯 ${m.帯.top}〜${m.帯.bottom} / 支度 ${m.支度.top}〜${m.支度.bottom})`)
    } else {
      ok(`貼り付く帯 ${w}px … 送っても縦に並ぶ`
        + `(帯 ${m.帯.top}〜${m.帯.bottom} / 支度 ${m.支度.top}〜${m.支度.bottom})・☰ 押せる`)
    }
  }
  /* **貼り付く役を、2つに持たせない。**
     `.jobbar` の側で `top: 0` を書き戻すと、また同じことが起きる */
  {
    const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8')
    const 帯 = /\.jobbar\s*\{[^}]*\}/.exec(css)?.[0] ?? ''
    if (/position:\s*sticky/.test(帯)) {
      ng('貼り付く帯 … `.jobbar` が自分で貼り付いている',
        '貼り付く役は `.app-stick` 1つ。2つに持たせると上の帯と重なる')
    } else if (!/\.app-stick\s*\{[^}]*position:\s*sticky/.test(css)) {
      ng('貼り付く帯 … `.app-stick` が貼り付いていない')
    } else {
      ok('貼り付く帯 … 貼り付く役は `.app-stick` 1か所')
    }
  }
  /* **画面が本当に包んでいるか。** 検証は自分で `.app-stick` を書いて
     描くので、`App.jsx` の側で外しても描くほうは緑のままになる */
  {
    const src = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
      .replace(/\/\*[\s\S]*?\*\/|\{\/\*[\s\S]*?\*\/\}/g, '')
    if (!/<div className="app-stick">[\s\S]{0,600}<AppTopbar[\s\S]{0,900}<JobBar[\s\S]{0,600}<\/div>/
      .test(src)) {
      ng('貼り付く帯 … `App.jsx` が帯2つを `.app-stick` で包んでいない',
        '包まないと、送ったときに支度の帯が上の帯にかぶる')
    } else {
      ok('貼り付く帯 … `App.jsx` も帯2つを1つの箱で包んでいる')
    }
  }

  /* ── 画面が本当に出しているか(検証だけが緑にならないように)──── */
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\/|\{\/\*[\s\S]*?\*\/\}/g, '')
  if (!/const showTabs = !navPush && tabs\.length > 0/.test(app)) {
    ng('下の行き先 … 出す条件が「狭い画面」になっていない',
      'トレーナーにも出す(2026-09 利用者の指定)。'
      + '広い画面ではメニューが柱として見えており、同じことをするものが2つになる')
  } else if (!/<AppTabs[\s\S]{0,120}pages=\{tabs\}/.test(app)) {
    ng('下の行き先 … 4つに絞ったものを渡していない',
      '`pages` をそのまま渡すと6つ出る(「この四つにしてください」)')
  /* **並びと中身は `TAB_IDS` 1か所。** ここが崩れると、
     描いて測るほうの検証は harness の一覧しか見ていないので緑のまま */
  } else if (!/'materials', 'wordbook', 'qr', 'pronunciation'/.test(app)
    || !/'homework', 'wordbook', 'qr', 'pronunciation'/.test(app)) {
    ng('下の行き先 … 出す4つが変わっている',
      'トレーナー = 教材 / 単語帳 / Quick Response / スピーチ練習、'
      + 'ゲストは先頭が今週の宿題(利用者の指定)')
  } else if (!/label: 'スピーチ練習'/.test(app)) {
    ng('下の行き先 … 「スピーチ練習」に改名していない',
      '「発音を練習」を「スピーチ練習」にしてください(利用者の指定)')
  } else if (!app.includes("showTabs ? ' has-tabs' : ''")) {
    ng('下の行き先 … 本文の下に余白を足す印が無い',
      'いちばん下の行が帯に隠れて読めなくなる')
  } else if (!readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8')
    .includes('.app-shell.has-tabs .app { padding-bottom')) {
    ng('下の行き先 … その余白の指定が無い')
  } else {
    ok('下の行き先 … `App.jsx` が狭い画面にだけ4つ出している')
  }

  await page.close()
}

// ══════════════════════════════════════════════════════════════════════
// 復習の「いつのぶん・何問ずつ」(2026-09 利用者の指定)
//
//   > 結局ただランダムに出てくるだけですごく仕組みが分かりにくい。
//   > …これを直感的に選択できる仕組みを作り上げたい。
//
// **描いて測る。** 8つの札が狭い画面で何行になるか、押せる大きさを
// 割っていないか、0件の札が押せないかは、**ソースを読んでも分からない。**
//
// **「出る」と「出ない」の両方を見る**(CLAUDE.md)。
// `?rows=old` は今日出すものが1つも無い状態で、そこでは札が押せない。
// ══════════════════════════════════════════════════════════════════════
{
  const 測る = async (w, extra = '', 開く = true) => {
    const page = await browser.newPage({ viewport: { width: w, height: 900 } })
    await page.goto(`http://localhost:${PORT}/__bar.html?screen=rscope${extra}`,
      { waitUntil: 'networkidle' })
    await page.waitForSelector('.rscope', { timeout: 8000 })
    /* **閉じているときの高さ**を先に測る。ここが利用者の見る形である */
    const 閉 = await page.evaluate(() => {
      const doc = document.documentElement
      return {
        高さ: Math.round(document.querySelector('.rscope').getBoundingClientRect().height),
        外に出ている札: document.querySelectorAll('.rscope > .chiprow .rscope-chip').length,
        ボタン: document.querySelector('.rscope .btn--primary').textContent.trim(),
        説明: document.querySelector('.rscope-lead').textContent.trim(),
        横あふれ: doc.scrollWidth > doc.clientWidth,
      }
    })
    let 開 = null
    if (開く) {
      await page.click('.rscope-go .btn--small')
      await page.waitForTimeout(140)
      開 = await page.evaluate(() => {
        const pop = document.querySelector('.rscope-pop')
        if (!pop) return null
        const r = pop.getBoundingClientRect()
        const chips = [...pop.querySelectorAll('.rscope-chip')]
        const top = (el) => Math.round(el.getBoundingClientRect().top)
        return {
          札の数: chips.length,
          低い札: Math.min(...chips.map((c) => Math.round(c.getBoundingClientRect().height))),
          押せない札: chips.filter((c) => c.disabled).length,
          数を出している: pop.querySelectorAll('.chip-count').length,
          範囲の行数: new Set(
            [...pop.querySelectorAll('.chiprow')][0]
              .querySelectorAll('.rscope-chip')).size && new Set(
            [...[...pop.querySelectorAll('.chiprow')][0]
              .querySelectorAll('.rscope-chip')].map(top)).size,
          画面内: r.left >= -1 && r.right <= window.innerWidth + 1
            && r.top >= -1 && r.bottom <= window.innerHeight + 1,
          幅: Math.round(r.width), 高さ: Math.round(r.height),
        }
      })
    }
    await page.close()
    return { 閉, 開 }
  }

  for (const w of [1280, 430, 390, 375, 360, 320]) {
    const { 閉, 開 } = await 測る(w)
    /* **閉じているあいだ、札は1つも外に出ていない**(利用者の指定)。
       ここが緩むと、また13個が並んで始めるボタンが下へ押し出される */
    if (閉.外に出ている札 > 0) {
      ng(`復習の範囲 ${w}px … 札が吹き出しの外に出ている(${閉.外に出ている札} 個)`,
        '選ぶものは吹き出しの中だけ。同じものを2か所に出さない')
    } else if (閉.横あふれ) {
      ng(`復習の範囲 ${w}px … 横にはみ出している`)
    /* **畳んだ帯が場所を取りすぎない。** 直す前は 259〜301px あった */
    } else if (閉.高さ > 120) {
      ng(`復習の範囲 ${w}px … 畳んでも帯が高い(${閉.高さ}px)`,
        '押すものは「出す」と「出しかた」の2つだけである')
    } else if (!開) {
      ng(`復習の範囲 ${w}px … 「出しかた」を押しても吹き出しが出ない`)
    /* **押せる大きさを割らない**(CLAUDE.md) */
    } else if (開.低い札 < 36) {
      ng(`復習の範囲 ${w}px … 札が小さすぎる(${開.低い札}px)`)
    /* **数が札の中に出ているか。** ここが「直感的」の核心で、
       消すと「1週間以内に何問あるか」が分からないまま選ぶことになる */
    } else if (開.数を出している < 8) {
      ng(`復習の範囲 ${w}px … 札に数が出ていない(${開.数を出している} 個)`,
        '「1週間以内に23問ある」と見えて初めて、範囲を選べる')
    } else if (開.札の数 !== 13) {
      ng(`復習の範囲 ${w}px … 札が 13 個(範囲8 + 個数5)ではない`, `${開.札の数} 個`)
    /* **吹き出しが画面からはみ出さない。** はみ出すと、
       いちばん下の札に永久に手が届かない(語の意味の吹き出しと同じ話) */
    } else if (!開.画面内) {
      ng(`復習の範囲 ${w}px … 吹き出しが画面からはみ出している`
        + `(${開.幅}×${開.高さ})`)
    } else {
      ok(`復習の範囲 ${w}px … 畳んで ${閉.高さ}px(${閉.ボタン})`
        + `・開くと ${開.幅}×${開.高さ}・札 ${開.低い札}px`)
    }
  }

  /* **0件の札は押せない**(効かない操作を見せない)。
     「出ない」側を見ないと、**全部押せる形に壊しても緑のまま**になる */
  const old = await 測る(390, '&rows=old')
  if (!old.開 || old.開.押せない札 < 7) {
    ng('復習の範囲 … 0件の札が押せてしまう', `押せない札 ${old.開?.押せない札} 個`)
  } else if (!old.閉.ボタン.includes('ありません')) {
    ng('復習の範囲 … 出すものが無いのに、始められる', old.閉.ボタン)
  } else {
    ok(`復習の範囲 … 0件の札は押せない(${old.開.押せない札} 個)`)
  }

  /* **押す前に、何が起きるかを言う。** ここが
     「仕組みが分かりにくい」への答えである。
     **畳んでいても見えている**ので、吹き出しを開かずに測る */
  const one = await 測る(390, '', false)
  if (!one.閉.説明.includes('今日出すぶんから出します')) {
    ng('復習の範囲 … 押す前の説明が出ていない', one.閉.説明)
  } else ok('復習の範囲 … 畳んだままでも、何が出るのかを1行で言う')

  /* **画面が本当に使っているか。** 検証の入り口(`__screens.jsx`)だけ
     直しても、利用者の画面は変わらない */
  for (const f of ['Wordbook', 'QrReview']) {
    const src = readFileSync(new URL(`../src/components/${f}.jsx`, import.meta.url), 'utf8')
      .replace(/\/\*[\s\S]*?\*\/|\{\/\*[\s\S]*?\*\/\}/g, '')
    if (!/<ReviewScope\b/.test(src)) ng(`復習の範囲 … ${f} が札を出していない`)
    else ok(`復習の範囲 … ${f} が同じ札を出している`)
  }
}

await browser.close()
console.log(bad === 0 ? '\n✅ 帯の持ちものは、すべて意図どおりです' : `\n❌ ${bad} 件`)
process.exit(bad === 0 ? 0 : 1)
