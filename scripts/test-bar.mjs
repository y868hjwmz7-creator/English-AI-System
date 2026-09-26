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
import zlib from 'node:zlib'
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
/** 系の数(= 人に見せる型の数)。**書き写さない**(第5.177節) */
import { frameGroupCount } from '../src/data/sentenceFrames.js'
/* **冊の数を書き写さない**(冊を足した日に、ここだけ古い数が残る) */
import { RIZAP_BOOKS } from '../src/data/rizapBooks.js'
import { SIX_STEPS } from '../src/lib/sixSteps.js'
/* **色の一覧を書き写さない**(第5.242節)。3つの色は `btnTone.js` 1か所 */
import { hasTone } from '../src/lib/btnTone.js'
/* 本文(記事・会話)の演習。**一覧を書き写さない** ——
   種類を足した日に、ここだけ古い一覧が残らないようにする */
import { EXERCISE_TYPES } from '../src/data/exerciseTypes.js'

const PASSAGE_TYPES = EXERCISE_TYPES.filter((t) => t.isPassage).map((t) => t.id)
/* 「細かい指定」の欄の呼び名(第5.232節)。**書き写さない** */
import { subjectLabel } from '../src/data/materialKinds.js'

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
/**
 * **本棚のシートを開く。開いていたら押さない**(第5.200節)。
 *
 * `冊名 ▾` は入り切り(トグル)なので、**開いているときに押すと閉じる。**
 * いつ閉じるかは読み込みの速さで変わる —— `hasSub` の冊は
 * えらんでも閉じない(第5.173節)、接続が無いと描き分けが変わる、
 * 空なら中身のある冊へ移る(第5.200節)。
 * **「押す」ではなく「開いている状態にする」と書く。**
 */
const 本棚をひらく = async (pg) => {
  const 開いている = await pg.evaluate(
    () => [...document.querySelectorAll('.shelf-pick')].some((e) => e.offsetParent),
  )
  if (開いている) return
  await pg.locator('.bookpick').last().click()
  await pg.waitForTimeout(350)
}
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

/** **版の札を、検証でも出せるようにする**(第5.207節)。
    本物は GitHub Actions が入れる(`VITE_BUILD_STAMP`)。
    ここで入れないと、**札そのものが描かれず、見張りが素通りする** */
const STAMP = '2026-09-19 00:00 UTC / testtest'
const vite = spawn('npx', ['vite', '--config', CFG], {
  cwd: ROOT, stdio: 'ignore', env: { ...process.env, VITE_BUILD_STAMP: STAMP },
})

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
      const main = document.querySelector('.lesson-bar-main')
      const own = document.querySelector('.lesson-owner')
      const h = () => Math.round(bar.getBoundingClientRect().height)
      const 名札あり = h()
      /* **名札を外したときと比べる**(第5.230節)。
         「いつも要る4つ」が1行に収まっているかと、
         **名札のせいで段が増えていないか**は、別の話である */
      let 名札なし = 名札あり
      if (own) {
        const 前 = own.style.display
        own.style.display = 'none'
        名札なし = h()
        own.style.display = 前
      }
      return {
        h: 名札あり,
        素: 名札なし,
        主: Math.round(main.getBoundingClientRect().height),
        名札: !!own,
        over: document.documentElement.scrollWidth > window.innerWidth,
      }
    })
    const 印 = big ? `${w}px(文字 1.25 倍)` : `${w}px`
    /* ── **いつも要る4つ(閉じる・ページ送り・解答・表示)は、必ず1行** ──
         これが第5.80節の決まりそのものである。1行はおよそ 34〜42px */
    if (m.主 > 60) ng(`${印} で「いつも要る4つ」が折り返している`, `高さ ${m.主}px`)
    else ok(`${印} … いつも要る4つは1行(${m.主}px)`)
    /* ── **名札(誰の記録か)は、帯の中で折り返してよい**(第5.230節)──
         もとは**帯のすぐ下に1行まるごと**使っていた(第5.178節)。
         いまは帯の中に入れてあるので、

           ・広い画面 … 帯と同じ行に並ぶ = **1行まるごと浮く**
           ・狭い画面 … 帯の2段目へ折り返す = **前と同じ高さ**

         見るのは「**名札を外したときと比べて、増えた段が1つまでか**」。
         段の高さを書き写さない —— 名札を外したときの高さから求める */
    if (m.名札) {
      const 増えた = m.h - m.素
      if (増えた === 0) ok(`${印} … 名札は帯と同じ行(1行まるごと浮いた・${m.h}px)`)
      else if (増えた <= m.素) {
        ok(`${印} … 名札は帯の2段目(${m.h}px。前は帯 ${m.素}px + 名札の行)`)
      } else {
        ng(`${印} で名札が2段以上に折り返している`,
          `名札あり ${m.h}px / 名札なし ${m.素}px`)
      }
    }
    /* ── **名札を外した帯は、どの幅でも1行**(もとの決まりのまま) ── */
    if (m.素 > 80) ng(`${印} で帯が折り返している`, `高さ ${m.素}px(1行なら 50px ほど)`)
    else ok(`${印} … 帯は1行(${m.素}px)`)
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
    /* **いま開いているページの問数。** 操作盤の数と突き合わせる相手である。
       **数を書き写さない**(CLAUDE.md)—— 骨組みに1問足しただけで
       赤くなり、直っているのに直っていないように見える(2026-09 に踏んだ) */
    items: document.querySelectorAll('.lesson-page:not(.is-closed) .lesson-items > li').length,
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
    else if (!m.items || !new RegExp(`/ *${m.items} `).test(m.at ?? '')) {
      ng('問数が、画面に出ている問の数と合っていない', `「${m.at}」/ 画面は ${m.items} 問`)
    } else ok(`英文和訳 … 上の帯に操作盤が出る(${m.at})`)

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

  /* ⑥ **解答の読み上げ**(2026-09 利用者の指定)
   *
   *    > 文型トレーニングなどの解答の和訳に「listen」ボタンは不要なので
   *    > 同じ仕様になっているところは全て削除してください
   *
   *    英文和訳の `answer` は**和訳(日本語)**なので、そこに Listen を
   *    出しても日本語を英語の声で読むだけになる。
   *
   *    **ソースを読むだけでは足りない。** `AnswerEn` は3つの画面から
   *    呼ばれており、**本当に消えたか**は描かないと分からない。
   *    **出す側も一緒に数える** —— 片方だけだと、
   *    「どこにも出さない」と書き換えても緑のままになる。 */
  await page.setViewportSize({ width: 1500, height: 900 })
  await page.waitForTimeout(200)
  {
    /* **演習は `data-type` で選り分ける。**
       レッスン表示は**ページを送っていない演習も描いてある**
       (紙に教材まるごとを刷るため・`.lesson-page.is-closed`)。
       だから `.lesson-items > li` を頭から数えると、
       **いつも1つめの演習を見てしまう**(実測して気づいた) */

    /** その演習の1問目に出ている Listen の数 */
    const inItem = (type) => page.evaluate((t) => {
      const li = document.querySelector(`[data-type="${t}"] .lesson-items > li`)
      if (!li) return null
      return [...li.querySelectorAll('button')]
        .filter((b) => /^(Listen|Stop)/.test(b.textContent.trim())).length
    }, type)
    /** その演習の1問目の「解答を見る」を押す */
    const open = async (type) => {
      await page.evaluate((t) => {
        document.querySelector(`[data-type="${t}"] .lesson-items > li .lesson-reveal`)?.click()
      }, type)
      await page.waitForTimeout(200)
    }

    // 英文和訳 … 解答を開いても、Listen は**増えない**(問題文の1つだけ)
    const jaBefore = await inItem('translate_en_ja')
    await open('translate_en_ja')
    const jaAfter = await inItem('translate_en_ja')
    if (jaBefore !== 1) ng('英文和訳 … 問題文の Listen が1つではない', `${jaBefore} 個`)
    else if (jaAfter !== 1) {
      ng('英文和訳 … 解答(和訳)に Listen が出ている', `開くと ${jaAfter} 個に増える`)
    } else ok('英文和訳 … 解答を開いても Listen は増えない(和訳は鳴らさない)')

    /* 誤り訂正 … **出る側も数える。** 片方だけだと、
       「どこにも出さない」と書き換えても緑のままになる。
       ここは問題文に音が無い(`audioFrom: null`)ので、
       **増えた1つが解答のものだ**と確かめられる */
    const ecBefore = await inItem('error_correction')
    await open('error_correction')
    const ecAfter = await inItem('error_correction')
    if (ecBefore !== 0) ng('誤り訂正 … 誤った英文に Listen が出ている', `${ecBefore} 個`)
    else if (ecAfter !== 1) {
      ng('誤り訂正 … 解答(直した英文)の Listen が出ていない', `開いても ${ecAfter} 個`)
    } else ok('誤り訂正 … 解答を開くと、直した英文の Listen が出る')
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
    const m = await page.evaluate((passage) => ({
      /* 本文の各段落に付いていたもの。**言葉で数える**
         (Listen / Stop のどちらの形でも拾う)。

         **本文の演習の中だけを数える**(2026-09・第5.230節)。
         もとは `.lesson-items button` を画面ぜんぶから拾っていたが、
         レッスン表示は**開いていないページも描いてある**(紙のため)ので、
         語句や単語の演習を1つ足しただけで赤くなっていた。
         **設問ごとの Listen は残すのが決まり**である
         (すぐ上の注記「出る側は上の文型ドリルで数えている」)。
         種類の一覧は `exerciseTypes.js` 1か所から渡している */
      段落: passage.flatMap((t) =>
        [...document.querySelectorAll(`.lesson-page[data-type="${t}"] .lesson-items button`)])
        .filter((b) => /^(Listen|Stop)/.test(b.textContent.trim())).length,
      /* **通しの読み上げは残す。** 上の「Listen (全体)」と操作盤は別物 */
      全体: !!document.querySelector('.lesson-listen'),
      操作盤: !!document.querySelector('.player'),
    }), PASSAGE_TYPES)
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
    /* **閉じ終わるのを、時間ではなく「出たか」で待つ**(第5.215節)。
       200ms の決め打ちでは間に合わないことがあり、**次の幅で
       「集中モードの入り口が無い」と赤くなった**(同じコードで
       もう一度走らせると緑だった)。
       **壊れていないものが赤くなると、本当の赤を見落とす**(CLAUDE.md) */
    await page.waitForFunction(() => [...document.querySelectorAll('.practice-row button')]
      .some((e) => (e.textContent || '').includes('集中モード')), null, { timeout: 5000 })
      .catch(() => {})
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
  /* 4択は伸ばさないが、**出題の枠は画面の余りから決める**
     (2026-09 実機・利用者の指定)。ここを決め打ち(9rem)に戻すと、
     ホーム画面(ブラウザの帯が無く縦が長い)で
     **「出会った文」が枠の中で切れ、余りはただの空白になる。**

     **形は「箱」ではなく、選んだものから決まる**(2026-09 実機・
     利用者の指定「おまかせ…なくしましょう」)。だから端末の控えに
     入れてから開く —— **画面が本当にそこを読んでいるか**も、
     これで一緒に確かめられる。
     `[何を, 幅, 高さ, 形, 伸ばすか, 枠の下限]` */
  const CASES = [
    ['スマホ / 思い出す', 390, 844, 'recall', true],
    ['320px / 思い出す', 320, 568, 'recall', true],
    /* **穴埋め**(0047)。出会った文をまるごと出すので、いちばん背が高い。
       ここが伸びないと、答えの2つが画面の外へ出る */
    ['スマホ / 穴埋め', 390, 844, 'cloze', true],
    ['320px / 穴埋め', 320, 568, 'cloze', true],
    ['スマホ / 日本語 → 英語', 390, 844, 'ja2en', true],
    /* **ホーム画面(PWA)**。ブラウザの帯が無いぶん縦が長い。
       ここがいちばん空いていた(上下 176px ずつ・実測) */
    ['スマホ / 4択 / ホーム画面 844', 390, 844, 'choice', false, 320],
    /* **Chrome**(帯のぶん 110px ほど低い) */
    ['スマホ / 4択 / Chrome 734', 390, 734, 'choice', false, 300],
  ]
  for (const [what, w, h, useForm, wantTall, wantQ] of CASES) {
    /* 箱は据え置き(2)。**形は箱で決まらない**ので、どれでもよい */
    box = 2
    await page.addInitScript((f) => {
      try { localStorage.setItem('eas.review.word.form', f) } catch { /* 使えなくても困らない */ }
    }, useForm)
    await page.setViewportSize({ width: w, height: h })
    await page.goto(`http://localhost:${PORT}/__bar.html?screen=wordbook`,
      { waitUntil: 'networkidle' })
    /* **開いた瞬間に1問目**(第5.167節・2026-09 利用者の指定)。
         > サイドバーや下のタブからクリックしたらすぐに実際の
         > トレーニングの画面に飛び、その画面にメニューを足す。
       「◯語を出す」を押す段は**無くなった。**
       **だから、押さずに待つ** —— この待ちそのものが
       「開いたらすぐ始まる」の見張りになる */
    try {
      await page.waitForSelector('.wbfocus .wordcard', { timeout: 8000 })
    } catch {
      ng(`${what} … 開いても1問目が出ない`,
        '語を読めていないか、自分で始める道(`started`)が変わった')
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
    if (useForm === 'cloze' && !m.穴埋め) {
      ng(`${what} … 穴埋めになっていない`,
        '`pickForm()` が「思い出す」に落ちている(出会った文にその語が無い)')
    } else if (m.伸ばす印 !== wantTall) {
      ng(`${what} … 伸ばす印(\`wordcard--recall\`)が ${m.伸ばす印 ? '付いている' : '付いていない'}`,
        wantTall
          ? '「思い出す」「穴埋め」「日本語 → 英語」には付ける'
          : '4択には付けない(下に選択肢がある)')
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
    if (process.env.SHOT && useForm === 'cloze' && w === 390) {
      await page.screenshot({ path: `${process.env.SHOT}/cloze-q.png` })
      /* **箱そのものを押す**(第5.262節)。「英語を見る」のボタンは廃止した */
      await page.click('.wordcard-face--tap')
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
  /* **開いた瞬間に1問目**(第5.167節・上と同じ)。**絞ったときは「ぜんぶ」**に
     なるので、期限で切られず3語とも出る(0047 の決まり) */
  try {
    await page.waitForSelector('.wbfocus .wordcard', { timeout: 8000 })
  } catch {
    ng('その教材の語だけ … 集中モードが開かない')
  }
  /* **何語で組まれたかは、進み具合の点の数で数える。**
     以前は「◯ / ◯ 語」の文字を読んでいたが、あれは 2026-09 の指定で
     画面から消えた。**点は1問=1目盛り**なので、同じ数を指している

     **絞っていることは、冊の名前そのものが言う**(第5.222節・
     2026-09 利用者の指定)。札の行・日付・「単語帳ぜんぶに戻す」は消した。
     だから**見る場所が変わった** —— 決まり(黙って絞らない)は同じ */
  const onlyM = await page.evaluate(() => {
    const dots = document.querySelectorAll('.drill-bar > span').length
    const name = document.querySelector('.drill-title')?.textContent ?? ''
    /* **消したものが、本当に消えているか。**「出る」と「出ない」の両方 */
    const chip = document.querySelectorAll('.wb-only').length
    const back = [...document.querySelectorAll('button')]
      .some((b) => (b.textContent ?? '').includes('単語帳ぜんぶに戻す'))
    return { dots, name, chip, back }
  })
  // 語は12語あるが、`only` で3語に絞ってある
  if (onlyM.dots !== 3) {
    ng(`その教材の語だけ … 3語に絞れていない(${onlyM.dots} 語)`,
      '読み込んだ直後に落としているか(`onlySet`)')
  } else if (!onlyM.name.includes('この教材の語だけ') || !/3\s*語/.test(onlyM.name)) {
    ng(`その教材の語だけ … 冊の名前が絞りを言っていない(${onlyM.name.trim()})`,
      '黙って絞ると、単語帳がまるごと減ったように見える(第5.222節)')
  } else if (onlyM.chip || onlyM.back) {
    ng(`その教材の語だけ … 消したはずの札(${onlyM.chip} 個)`
      + `${onlyM.back ? '・「単語帳ぜんぶに戻す」' : ''}が残っている`,
      '2026-09 利用者の指定で消した(第5.222節)')
  } else {
    ok(`その教材の語だけ … ${onlyM.dots} 語・冊の名前「${onlyM.name.trim()}」`
      + '・札と戻すボタンは無い')
  }
  /* **名前と進み具合は、カードの中の上**(第5.180節・2026-09 実機・
     利用者の指定「quick response のようにコンテンツの上部にタイトルを、
     そして単語帳 のように個数のバーを。それで統一してください」)。

     **カードの外に置いていたのが、そろっていなかった理由**である。
     ソースを読んでも「中か外か」は分からない —— **描いて測る。** */
  const 頭 = await page.evaluate(() => {
    const card = document.querySelector('.wordcard')
    const head = document.querySelector('.drill-head')
    const title = document.querySelector('.drill-title')
    const bar = document.querySelector('.drill-bar')
    if (!card || !head) return null
    return {
      中: card.contains(head),
      題: (title?.textContent ?? '').trim(),
      /** **題がバーより上にいるか**(並びも見る) */
      順: !!(title && bar
        && title.getBoundingClientRect().bottom <= bar.getBoundingClientRect().top + 0.5),
      区切り: bar ? bar.children.length : 0,
    }
  })
  if (!頭) ng('単語帳の頭 … 名前と進み具合が描かれていない')
  else {
    if (頭.中) ok('単語帳の頭 … 名前と進み具合は、カードの中にある')
    else ng('単語帳の頭 … カードの外に出ている(Quick Response とそろわない)')
    if (頭.題) ok(`単語帳の頭 … 名前が出ている(${頭.題})`)
    else ng('単語帳の頭 … 名前が出ていない')
    if (頭.順) ok('単語帳の頭 … 名前が先、進み具合があと')
    else ng('単語帳の頭 … 名前と進み具合の順が逆')
    if (頭.区切り === 3) ok(`単語帳の頭 … 1問 = 1つの区切り(${頭.区切り})`)
    else ng('単語帳の頭 … 区切りの数が問の数と合わない', String(頭.区切り))
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

  /* ── ④⑤ **文型ドリルでも出る**(第5.212節・2026-09 実機の指摘)──

       > 文系トレーニングで単語を調べようとしても
       > 集中モードへの誘導が表示されません

     案内は `onNeedFocus` があるときだけ出る。そこを**本文のときだけ**
     渡していたので、文型ドリルでは長押ししても何も出ず、
     iPhone の「コピー / Google で検索」だけが出ていた。

     **「出る」だけを見ない。** どの問から開いたかまで見る ——
     いつも1問めから開く形に壊しても、出るだけなら緑になる。 */
  await page.setViewportSize({ width: 390, height: 780 })
  /** 文型ドリルの n 問めに、指を置いて待つ */
  const holdDrill = async (nth) => {
    await page.goto(`http://localhost:${PORT}/__bar.html?role=trainer&who=g1&kind=drill`,
      { waitUntil: 'networkidle' })
    await page.waitForSelector('.lesson-items .etext-sent', { timeout: 15000 })
    const el = page.locator('.lesson-page:not(.is-closed) .lesson-items > li')
      .nth(nth).locator('.etext-sent').first()
    const b = await el.boundingBox()
    await el.dispatchEvent('pointerdown',
      { pointerType: 'touch', clientX: b.x + 3, clientY: b.y + 3 })
    await page.waitForTimeout(700)
    return page.$('.etext-hint')
  }

  if (!await holdDrill(0)) {
    ng('長押しの案内 … 文型ドリルで出ない',
      '本文が無い教材にも集中モードはある(第5.208節)。行き先はある')
  } else {
    await page.click('.etext-hint .btn')
    await page.waitForTimeout(400)
    const 札 = (await page.locator('.focus-count').innerText().catch(() => '')).trim()
    if (!await page.$('.focus')) ng('長押しの案内 … 文型ドリルで、押しても集中モードに入らない')
    else if (!/^1 \//.test(札)) ng('長押しの案内 … 1問めから開いていない', `「${札}」`)
    else ok(`長押しの案内 … 文型ドリルでも出て、その問の集中モードへ入る(${札})`)
  }

  // ⑤ **長押しした問から開く**(いつも1問めではない)
  if (!await holdDrill(2)) {
    ng('長押しの案内 … 文型ドリルの3問めで出ない')
  } else {
    await page.click('.etext-hint .btn')
    await page.waitForTimeout(400)
    const 札 = (await page.locator('.focus-count').innerText().catch(() => '')).trim()
    if (/^3 \//.test(札)) ok(`長押しの案内 … 長押しした問から開く(${札})`)
    else ng('長押しの案内 … 長押しした問から開いていない', `「${札}」(3問めを長押しした)`)
  }

  /* ── ⑥ **設問にも出る**(第5.212節)。
        `it.question` には `onNeedFocus` を**1つも渡していなかった**ので、
        内容の理解・ディスカッション・想定される質問・リスニングでは、
        狭い画面から語を調べる道がどこにも無かった ── */
  await page.goto(`http://localhost:${PORT}/__bar.html?role=trainer&who=g1&kind=speech`,
    { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  const 送り2 = page.locator('.lesson-pages button[aria-label="次のページ"]')
  if (!await 送り2.count()) {
    ng('長押しの案内 … 設問のページへ送れない(390px)')
  } else {
    await 送り2.click()
    await page.waitForTimeout(400)
    const q = page.locator('.lesson-page:not(.is-closed) .lesson-items > li')
      .first().locator('.etext-sent').first()
    const b2 = await q.boundingBox()
    await q.dispatchEvent('pointerdown',
      { pointerType: 'touch', clientX: b2.x + 3, clientY: b2.y + 3 })
    await page.waitForTimeout(700)
    if (!await page.$('.etext-hint')) {
      ng('長押しの案内 … 設問(想定される質問)で出ない',
        '設問にも `onNeedFocus` を渡すこと')
    } else {
      await page.click('.etext-hint .btn')
      await page.waitForTimeout(400)
      if (await page.$('.focus')) ok('長押しの案内 … 設問でも出て、集中モードへ入る')
      else ng('長押しの案内 … 設問から集中モードに入れない')
    }
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

    /* ══ ホーム — **読み込みが終わったら、まず行き先を並べる** ══════════
         2026-09 利用者の指定。

           > ロードの後いきなり教材が映るのではなく、何か箱を並べて、
           > 選択したモードに飛ぶ仕様にしたいです

       **「出る」と「出ない」の両方を見る**(CLAUDE.md)。
       箱が並んでいることだけを見ると、
         ・ホームそのものの箱まで並べる(押しても動かない)
         ・押しても移らない
         ・戻る道が無い
       のどれに壊しても**緑のまま**になる。だから
       ①開いた瞬間がホームか ②`pages` から1つ減った数だけ並ぶか
       ③ホームの箱が混ざっていないか ④名前と説明が出ているか
       ⑤押せる大きさか ⑥押すと本当に移るか ⑦**☰ から戻れるか**
       を、まとめて見る。 */
    const home = await page.evaluate(() => {
      const boxes = [...document.querySelectorAll('.home-box')]
      return {
        名: document.querySelector('.app-topbar-title')?.textContent.trim() ?? '',
        箱: boxes.length,
        行き先: document.querySelectorAll('.app-nav-item').length,
        札: boxes.map((e) => e.querySelector('.home-box-label')?.textContent.trim() ?? ''),
        説明: boxes.filter((e) => e.querySelector('.home-box-desc')).length,
        押せる: boxes.every((e) => e.getBoundingClientRect().height >= 44),
        押せる形: boxes.every((e) => e.tagName === 'BUTTON'),
        低い: Math.min(...boxes.map((e) => Math.round(e.getBoundingClientRect().height))),
        はみ出し: document.documentElement.scrollWidth > window.innerWidth,
      }
    })
    /* 押して移る → ☰ から戻る。**片道だけ見ない**(行き止まりを作らない) */
    const 移動 = await page.evaluate(async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms))
      const 題 = () => document.querySelector('.app-topbar-title')?.textContent.trim() ?? ''
      const box = [...document.querySelectorAll('.home-box')]
        .find((e) => e.querySelector('.home-box-label')?.textContent.trim() === '単語帳')
      if (!box) return null
      box.click()
      await wait(300)
      const 押した後 = 題()
      // かぶせて開く幅では、まず ☰ を押す
      if (!document.querySelector('.app-nav-item')?.offsetParent) {
        document.querySelector('.app-topbar .nav-burger')?.click()
        await wait(250)
      }
      const back = [...document.querySelectorAll('.app-nav-item')]
        .find((e) => e.querySelector('.app-nav-label')?.textContent.trim() === 'ホーム')
      if (!back) return { 押した後, 戻れる: false, 戻った箱: 0 }
      back.click()
      await wait(300)
      return {
        押した後,
        戻れる: 題() === 'ホーム',
        戻った箱: document.querySelectorAll('.home-box').length,
      }
    })
    if (home.名 !== 'ホーム') {
      ng(`ホーム ${w}px … 開いた瞬間がホームではない(${home.名 || '空'})`,
        '`view` の初めの値は `HOME_ID`(リンク `?m=…` で来たときだけ教材)')
    } else if (home.箱 !== home.行き先 - 1) {
      ng(`ホーム ${w}px … 箱が ${home.箱} 個(メニューは ${home.行き先} 項目)`,
        '`pages` をそのまま並べ、ホームそのものだけを外す')
    } else if (home.札.includes('ホーム')) {
      ng(`ホーム ${w}px … ホームそのものの箱が並んでいる`,
        '押しても同じ場所に留まるだけ。**効かない操作を見せない**')
    } else if (home.説明 !== home.箱) {
      ng(`ホーム ${w}px … 説明の無い箱がある(${home.説明} / ${home.箱})`,
        '`desc` は `pages` が持つ(呼び名と説明を2か所に分けない)')
    } else if (!home.押せる形 || !home.押せる) {
      ng(`ホーム ${w}px … 押せる形になっていない`
        + `(button ${home.押せる形} / いちばん低い箱 ${home.低い}px)`)
    } else if (home.はみ出し) {
      ng(`ホーム ${w}px … 横にはみ出している`)
    } else if (!移動) {
      ng(`ホーム ${w}px … 「単語帳」の箱が無い`)
    } else if (移動.押した後 !== '単語帳') {
      ng(`ホーム ${w}px … 箱を押しても移らない(${移動.押した後 || '空'})`,
        '「選択したモードに飛ぶ」(利用者の指定)')
    } else if (!移動.戻れる || 移動.戻った箱 !== home.箱) {
      ng(`ホーム ${w}px … ☰ からホームへ戻れない(箱 ${移動.戻った箱} 個)`,
        '**行き止まりを作らない。** ホームは `pages` の先頭に入れてある')
    } else {
      ok(`ホーム ${w}px … 箱 ${home.箱} 個(${home.低い}px 以上)・`
        + '押すと移る・☰ から戻れる')
    }
    /* **次の検証のために、開いた直後の姿へ戻す。**
       上のやりとりで画面もメニューも動いているので、
       ここで読み直さないと**このあとの測りが引きずられる** */
    await page.goto(`http://localhost:${PORT2}/__shell.html`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(400)

    /* ══ 上の帯は**白く、下の帯とそろえる**(2026-09 実機・利用者の指定)══
         > 全てのページで共通して上部バーを白くしてください。
         > そして下部のタブと同じようにボーダー部分は薄い影を入れて
         > 自然にしてください。そして「教材」など、今いるページを示す
         > 項目の横にサイドバーと同じアイコンを置いてください

       **色も影も、描かないと分からない**(ソースを読むだけでは、
       変数がどの値に解決されるか分からない)。見るのは4つ。
         ①地色が下の行き先の帯とそろっているか
         ②影が入っているか(`.app-stick` が箱ごと落とす)
         ③絵が出ているか
         ④**その絵が、メニューの絵とまったく同じか**

       ④がかなめである。**「絵が在るか」だけを見ると、
       別の絵を置いても緑のまま**になる。中身(SVG)を突き合わせる。 */
    /** いま出ているものを測る */
    const 測る = () => page.evaluate(() => {
      const bar = document.querySelector('.app-topbar')
      const tabs = document.querySelector('.app-tabs')
      const ic = bar.querySelector('.app-topbar-icon svg')
      const navIc = document.querySelector('.app-nav-item.is-active .app-nav-icon svg')
      return {
        名: bar.querySelector('.app-topbar-title').textContent.trim(),
        地: window.getComputedStyle(bar).backgroundColor,
        下の帯: tabs ? window.getComputedStyle(tabs).backgroundColor : null,
        影: window.getComputedStyle(document.querySelector('.app-stick')).boxShadow,
        絵: ic ? ic.innerHTML : null,
        メニューの絵: navIc ? navIc.innerHTML : null,
      }
    })
    const look = await 測る()
    /* **1つの画面だけでは足りない。** 開いた瞬間は必ず「ホーム」なので、
       絵を1つに決め打ちしても**そこでは合ってしまう。**
       だから**別の画面へ移って、もう一度**突き合わせる */
    await page.evaluate(() => {
      const burger = document.querySelector('.app-topbar .nav-burger')
      if (!document.querySelector('.app-nav-item')?.offsetParent) burger.click()
    })
    await page.waitForTimeout(150)
    const 移った = await page.evaluate(() => {
      const x = [...document.querySelectorAll('.app-nav-item')]
        .find((e) => e.querySelector('.app-nav-label').textContent.trim() === '単語帳')
      if (!x) return false
      x.click()
      return true
    })
    await page.waitForTimeout(200)
    const look2 = 移った ? await 測る() : look
    /* **地の上(`--surface-0`)のままではないか。**
       明るい配色では #eaecef、暗い配色では #0c0c0b である */
    const 白い = /^rgb\(255, 255, 255\)$/.test(look.地)
    const どこ = `上の帯 ${w}px`
    if (!白い) {
      ng(`${どこ} … 白くない(${look.地})`,
        '`--surface-1`(下の行き先の帯と同じ地色)にする')
    } else if (look.下の帯 && look.下の帯 !== look.地) {
      ng(`${どこ} … 下の帯と地色が違う(上 ${look.地} / 下 ${look.下の帯})`)
    } else if (!look.影 || look.影 === 'none') {
      ng(`${どこ} … 影が入っていない`,
        '`.app-stick` が箱ごと落とす(帯が3つまで入るので、帯そのものに'
        + ' 付けると下の帯に隠れて見えない)')
    } else if (!look.絵) {
      ng(`${どこ} … いまいる画面の絵が出ていない`)
    } else if (look.絵 !== look.メニューの絵) {
      ng(`${どこ} … メニューと違う絵が出ている`,
        '`pages` から引いたものをそのまま渡す(対応表を2つ持たない)')
    } else if (!look2.絵 || look2.絵 !== look2.メニューの絵) {
      ng(`${どこ} … 「${look2.名}」でメニューと違う絵が出ている`,
        '画面を移っても、メニューと同じ絵でなければならない'
        + '(1つの画面だけ見ると、絵を決め打ちしても緑になる)')
    } else if (look2.絵 === look.絵) {
      ng(`${どこ} … 画面を移っても絵が変わらない(${look.名} / ${look2.名})`,
        'いまいる画面の絵を出していない')
    } else {
      ok(`${どこ} … 白い(${look.地})・影あり・`
        + `「${look.名}」「${look2.名}」ともメニューと同じ絵`)
    }

    /* **ホームへ戻してから測る**(第5.200節で足した)。
       すぐ上の絵くらべで**単語帳へ移っている**が、単語帳は
       「開いた瞬間に1問目」(第5.167節)で集中モードに入り、
       **わざと画面を止める**(`lockScroll`)。あそこには
       専用の ☰ が左上にあるので、上の帯そのものが出ていない。
       **ここで測りたいのは「ふつうに送れる画面で、上の帯が貼り付くか」**
       なので、ふつうの画面(ホーム)へ戻す。
       戻さないと、**止めてある画面を「貼り付いていない」と読んでしまう** */
    await page.evaluate(() => {
      const burger = document.querySelector('.app-topbar .nav-burger')
      if (burger && !document.querySelector('.app-nav-item')?.offsetParent) burger.click()
    })
    await page.waitForTimeout(150)
    await page.evaluate(() => {
      const x = [...document.querySelectorAll('.app-nav-item')]
        .find((e) => e.querySelector('.app-nav-label').textContent.trim() === 'ホーム')
      x?.click()
    })
    await page.waitForTimeout(250)

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

  /* ══ **開いて落ちないか。行き先を1つずつ、全部**(第5.220節)══════
       2026-09 実機・利用者。

       > ゲストログインして宿題を開くと、この画面のまま何も映らなく
       > なってしまいました(画面が真っ白)

     `if (loading) return <Loading />` の**後ろ**に `useState` を足した。
     React はフックを「何番目に呼ばれたか」で数えるので、読み込み中と
     読み込み後で数が変わり、**画面がまるごと落ちた**
     (Rendered more hooks than during the previous render)。
     `npm run lint` も `npm run build` も通っていた。

     **ここまで、本物の `LearnerHomework` を一度も描いていなかった。**
     骨組み(`__screens.jsx`)が描くのは帯やカードなど部品だけで、
     ゲストの画面の中身はどこも通っていない。
     **描けないものは測れない**(CLAUDE.md)。

     同じ形そのものは `react-hooks/rules-of-hooks` を
     `npm run lint` に足して止めた。**こちらは「それでも開いて
     落ちないか」を実際に描いて見る** —— 落ち方は1つではない。 */
  {
    const p2 = await browser.newPage()
    await p2.setViewportSize({ width: 390, height: 844 })
    const errs = []
    p2.on('pageerror', (e) => errs.push(String(e)))
    await p2.goto(`http://localhost:${PORT2}/__shell.html`, { waitUntil: 'networkidle' })
    await p2.waitForTimeout(400)
    /* **行き先は名簿から引く。書き写さない**(増えたら自動で付いてくる) */
    const 行き先 = await p2.evaluate(() => {
      const burger = document.querySelector('.app-topbar .nav-burger')
      if (!document.querySelector('.app-nav-item')?.offsetParent) burger?.click()
      return [...document.querySelectorAll('.app-nav-item .app-nav-label')]
        .map((e) => e.textContent.trim())
    })
    const 落ちた = []
    const 空 = []
    for (const 名 of 行き先) {
      errs.length = 0
      /* **毎回、開いた直後へ戻す。** 単語帳は開くと画面を止めるので、
         続けて押すと次の画面が「空」に見える */
      await p2.goto(`http://localhost:${PORT2}/__shell.html`, { waitUntil: 'networkidle' })
      await p2.waitForTimeout(250)
      const 押せた = await p2.evaluate((n) => {
        const burger = document.querySelector('.app-topbar .nav-burger')
        if (!document.querySelector('.app-nav-item')?.offsetParent) burger?.click()
        const x = [...document.querySelectorAll('.app-nav-item')]
          .find((e) => e.querySelector('.app-nav-label').textContent.trim() === n)
        if (!x) return false
        x.click()
        return true
      }, 名)
      await p2.waitForTimeout(800)
      const 中身 = await p2.evaluate(() => document.querySelectorAll('#root *').length)
      if (errs.length) 落ちた.push(`${名} … ${errs[0].slice(0, 140)}`)
      else if (!押せた) 落ちた.push(`${名} … メニューに無い`)
      /* **真っ白は 0 個だった。** 「空かどうか」を見ている(数は性質) */
      else if (中身 < 10) 空.push(`${名}(${中身} 個)`)
    }
    if (行き先.length < 4) {
      ng('開いて落ちないか … 行き先が引けなかった', `${行き先.length} 個`)
    } else if (落ちた.length) {
      ng(`開いて落ちないか … ${落ちた.length} 画面で落ちた`, 落ちた.join('\n    '))
    } else if (空.length) {
      ng(`開いて落ちないか … ${空.length} 画面が空になった`, 空.join(' / '))
    } else {
      ok(`開いて落ちないか … ${行き先.length} 画面すべて、落ちずに中身が出る`)
    }
    await p2.close()
  }
  drop2()
}

/* ══════════════════════════════════════════════════════════════
   ⑩ 教材のカードの操作は、**役目ごとに2つの行へ**(2026-09 利用者の指定)

     > 「音声を作り直す」「学習の記録を消す」を教材を消すの左側に並べて、
     > 「印刷 / PDF」と「音声ダウンロード」アイコンを今の位置に並べて
     > ください。…もともとスペースの問題だったのでこれで解決です。

   4つを1行に詰めていたので、iPhone(390px)で文字が1字ずつ縦に割れ、
   **4本の棒**になっていた。いまは**役目で2つの行に分ける。**

     `.card-tools`     ふだん使う**3つ**。**言葉つき**
     `.material-foot`  めったに押さない3つ。**絵のまま**(11文字は入らない)

   **上の行は 2026-09 に3つへ増えた**(利用者の指定・方針の変更)。

     > 「教材をシェア」と「教材をゲストと共有」はボタンをひとつにして
     > その中でゲストと共有なのか普通の共有なのかを選べるように
     > してください。省スペースです。そして、スマホの表示で、
     > 「印刷/PDF」「音声ダウンロード」「教材をシェア」を適宜言葉を減らして
     > アイコンを活かすことで３つ並ぶようにしてください。
     > 直感でわかれば良いのです。

   **絵だけには戻していない。** 削ったのは添えの部分だけで、
   **何のボタンかを言う語は1つずつ残っている**(PDF / 音声 / 共有)。

   **両側を見る。**
     ①上の行に**言葉が出ているか**(絵だけに戻すと、この指定が消える)
     ②上の3つが**同じ1行に並んでいるか**(利用者の指定そのもの)
     ③下の行の3つが**同じ1行に並んでいるか**(「教材を消すの左側」)
     ④**押せる大きさ(40px)を割っていないか**
     ⑤**読み上げ機に名前が渡っているか**(絵だけのボタンの決まり)
     ⑥**長押しで名前が出るか**(触る端末にはカーソルが無い)
     ⑦**言葉が要る状態では、言葉が出るか**(進み具合・2段めの確認)
     ⑧**「共有」の中で2つから選べるか**(ゲストと共有 / リンクを渡す)
   ①だけを見ると、**下の行を消しても緑のまま**になる。
   ══════════════════════════════════════════════════════════════ */
{
  // **触る端末として開く。** 絵だけのボタンは、そこでしか名前を出せない
  const page = await browser.newPage({ hasTouch: true })
  /** 下の行(絵のまま)。**名前が渡っていること**を見る */
  const FOOT = ['読み上げ音声を作り直す', '練習の記録を消す']
  /** 上の行(言葉つき)。**画面に見えていること**を見る。
      **3つとも語を1つずつ持っている** —— 絵だけにはしない */
  const TOOLS = ['PDF', '音声', '共有']

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
      const tools = [...row.querySelectorAll('.btn')]
      return {
        上の文字: tools.map((b) => (b.textContent ?? '').trim()),
        上の高さ: Math.round(row.getBoundingClientRect().height),
        上のあふれ: row.scrollWidth > row.clientWidth + 1,
        /* **3つが同じ1行に並んでいるか**(2026-09 利用者の指定)。
           `.card-tools` は `nowrap` なので折り返しでは割れないが、
           **ボタンの中の字が2行に折り返す**ことはある(実測 34 → 55px)。
           だから高さでも見る(すぐ下の `上の高さ`) */
        上の段: [...new Set(tools.map((b) => Math.round(b.getBoundingClientRect().top)))].length,
        上の数: tools.length,
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
        '絵だけでは「PDF も出せる」「何を落とすのか」「何をするのか」が'
        + '読めない(利用者の指定)')
    } else if (m.上の数 !== 3) {
      ng(`教材の操作 ${w}px … 上の行が ${m.上の数} つ(3つのはず)`,
        '「印刷/PDF」「音声」「共有」を3つ並べる(2026-09 利用者の指定)')
    } else if (missing.length) {
      ng(`教材の操作 ${w}px … 下の行に名前が渡っていない(${missing.join(' / ')})`,
        '絵だけのボタンには `aria-label` を必ず添える(CLAUDE.md)')
    } else if (m.上の段 !== 1 || m.上の高さ > 48) {
      ng(`教材の操作 ${w}px … 上の3つが1行に収まっていない`
        + `(${m.上の段} 段 / ${m.上の高さ}px)`,
        '言葉を減らして3つ並べる(利用者の指定)。'
        + '`nowrap` なので、割れるとしたらボタンの中の字が折り返したとき')
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
      ok(`教材の操作 ${w}px … 上は言葉つき3つが1行(${m.上の高さ}px)・`
        + '下は絵2つ + 教材を消すの1行')
    }
  }

  /* **端末の「表示を大きく」でも、3つが1行のままか**(2026-09 実機で測って足した)。
     幅だけでは決まらない —— 実際、320px + 1.25 倍 + 音声を集めている最中で、
     **3px 足りずにボタンの中の字が2行**になっていた(34 → 55px)。
     **いちばん狭い端末では余白だけを詰めてある**(言葉も本数も削らない) */
  for (const [w, state] of [[390, ''], [375, ''], [360, ''], [320, ''],
    [390, '&state=busy'], [360, '&state=busy'], [320, '&state=busy']]) {
    await page.setViewportSize({ width: w, height: 844 })
    await page.goto(`http://localhost:${PORT}/__bar.html?screen=tools${state}`,
      { waitUntil: 'networkidle' })
    await page.waitForSelector('.card-tools .btn')
    await page.evaluate(() => {
      const st = document.createElement('style')
      st.textContent = '.card-tools .btn { font-size: 16px !important }'
      document.head.appendChild(st)
    })
    await page.waitForTimeout(150)
    const big = await page.evaluate(() => {
      const row = document.querySelector('.card-tools')
      const bs = [...row.querySelectorAll('.btn')]
      return {
        高さ: Math.round(row.getBoundingClientRect().height),
        段: [...new Set(bs.map((b) => Math.round(b.getBoundingClientRect().top)))].length,
        あふれ: row.scrollWidth > row.clientWidth + 1,
        はみ出し: document.documentElement.scrollWidth > window.innerWidth,
        文字: bs.map((b) => (b.textContent ?? '').trim()),
      }
    })
    const 印 = `${w}px(文字 1.25 倍${state ? '・集めている最中' : ''})`
    if (big.段 !== 1 || big.高さ > 48) {
      ng(`教材の操作 ${印} … 3つが1行に収まらない(${big.段} 段 / ${big.高さ}px)`,
        '狭い端末では余白を詰める。**言葉も、集めた本数も削らない**')
    } else if (big.あふれ || big.はみ出し) {
      ng(`教材の操作 ${印} … はみ出している`)
    } else if (state && !big.文字.some((t) => t.includes('3 / 14'))) {
      ng(`教材の操作 ${印} … 集めた本数が消えている(${big.文字.join(' / ')})`,
        '**進み具合は必ず数で出す**(CLAUDE.md)。削ってよいのは動詞だけ')
    } else {
      ok(`教材の操作 ${印} … 3つが1行(${big.高さ}px)`)
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

  /* ── ⑧ **共有はボタン1つ。中で2つから選ぶ**(2026-09 利用者の指定)────

       > 「教材をシェア」と「教材をゲストと共有」はボタンをひとつにして
       > その中でゲストと共有なのか普通の共有なのかを選べるように
       > してください。省スペースです。

     **「1つになったか」だけを見ない。** それだと、**片方の道を消しても
     緑のまま**になる —— まさにこの回にやりかけたことである。
     ①ボタンが1つか ②開くと**2つとも選べるか**
     ③**既定はゲストと共有か**(このアプリの中心はそちら)
     ④切り替えると**中身が本当に入れ替わるか**
     ⑤**狭い画面ではみ出さないか** */
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`http://localhost:${PORT}/__bar.html?screen=tools`,
    { waitUntil: 'networkidle' })
  await page.waitForSelector('.material-foot .iconbtn')
  const share = await page.evaluate(() => {
    const all = [...document.querySelectorAll('.btn')].map((b) => (b.textContent ?? '').trim())
    return {
      共有: all.filter((t) => t === '共有').length,
      // **もとの2つが残っていないか**(1つにまとめた、が守れているか)
      古い: all.filter((t) => t.includes('教材をシェア')
        || t.includes('この教材をゲストと共有する')).length,
      はみ出し: document.documentElement.scrollWidth > window.innerWidth,
    }
  })
  if (share.共有 !== 1) {
    ng(`教材の操作 … 「共有」のボタンが ${share.共有} つ(1つのはず)`,
      'ゲストと共有・リンクを渡すを、**ボタン1つ**にまとめる(利用者の指定)')
  } else if (share.古い > 0) {
    ng('教材の操作 … 前の2つのボタンが残っている',
      '「教材をシェア」「この教材をゲストと共有する」は、1つにまとめた')
  } else if (share.はみ出し) {
    ng('教材の操作 … 共有を足したらはみ出した')
  } else {
    ok('教材の操作 … 「共有」はボタン1つ(前の2つは残っていない)')
  }

  /* **狭い画面でも確かめる。** 中にゲストの一覧と2つの欄が入るので、
     iPhone(390px)ではみ出さないかは**描いてみないと分からない** */
  for (const w of [390, 320]) {
    await page.setViewportSize({ width: w, height: 900 })
    await page.goto(`http://localhost:${PORT}/__bar.html?screen=tools`,
      { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: '共有', exact: true }).click()
    try {
      await page.waitForSelector('.share-box', { timeout: 4000 })
    } catch { ng(`共有 ${w}px … 押しても欄が開かない`); continue }

    /* ── ②③ 開いたら、2つとも選べる。**既定はゲストと共有** ── */
    const pick = await page.evaluate(() => {
      const box = document.querySelector('.share-box')
      const chips = [...box.querySelectorAll('.share-pick .chip')]
      const row = document.querySelector('.card-tools')
      const btns = [...row.querySelectorAll(':scope > .btn')]
      const bb = box.getBoundingClientRect()
      return {
        札: chips.map((c) => (c.textContent ?? '').trim()),
        選: chips.filter((c) => c.classList.contains('chip--on'))
          .map((c) => (c.textContent ?? '').trim()),
        小さい: chips.filter((c) => Math.round(c.getBoundingClientRect().height) < 36).length,
        ゲストの欄: !!box.querySelector('.assign-list input[type="checkbox"]'),
        リンクの欄: !!box.querySelector('input.share-url'),
        やめる: !!([...box.querySelectorAll('button')]
          .find((b) => b.textContent.trim() === 'やめる')),
        はみ出し: document.documentElement.scrollWidth > window.innerWidth,
        あふれ: box.scrollWidth > box.clientWidth + 1,
        /* **開いたら、箱は3つの「下」に来る**(2026-09 実機で撮って気づいた)。
           箱が行の一員のままだと、**ボタンが縦棒に潰れる。**
           高さもはみ出しも正常のままなので、**ここを測らないと気づけない** */
        箱は下: btns.length > 0
          && Math.round(bb.top) >= Math.round(Math.max(...btns.map((b) => b.getBoundingClientRect().bottom))),
        ボタンの段: [...new Set(btns.map((b) => Math.round(b.getBoundingClientRect().top)))].length,
        ボタンの幅: Math.min(...btns.map((b) => Math.round(b.getBoundingClientRect().width))),
      }
    })
    if (!pick.箱は下 || pick.ボタンの段 !== 1 || pick.ボタンの幅 < 50) {
      ng(`共有 ${w}px … 開いたら3つの行が崩れた`
        + `(箱は下 ${pick.箱は下} / ${pick.ボタンの段} 段 / 細いもの ${pick.ボタンの幅}px)`,
        '**箱は行の外へ落とす。** 行の一員のままだと、ボタンが縦棒に潰れる')
    } else if (pick.札.join('/') !== 'ゲストと共有/リンクを渡す') {
      ng(`共有 ${w}px … 2つから選べない(${pick.札.join(' / ') || '札が無い'})`,
        '「その中でゲストと共有なのか普通の共有なのかを選べるように」(利用者の指定)')
    } else if (pick.選.join('') !== 'ゲストと共有') {
      ng(`共有 ${w}px … 既定が「ゲストと共有」ではない(${pick.選.join(' / ') || '無し'})`,
        'このアプリの中心は「弱点から作って、指定したゲストに配る」循環である')
    } else if (!pick.ゲストの欄 || pick.リンクの欄) {
      ng(`共有 ${w}px … 開いた中身が「ゲストと共有」になっていない`,
        `ゲストの欄 ${pick.ゲストの欄} / リンクの欄 ${pick.リンクの欄}`)
    } else if (pick.小さい > 0) {
      ng(`共有 ${w}px … 札が 36px を割っている`, '押せる大きさを割らない(CLAUDE.md)')
    } else if (!pick.やめる) {
      ng(`共有 ${w}px … 「やめる」が無い`,
        '走らせるボタンのとなりに置く(CLAUDE.md)')
    } else if (pick.はみ出し || pick.あふれ) {
      ng(`共有 ${w}px … はみ出している`)
    } else {
      ok(`共有 ${w}px … 2つから選べる・既定はゲストと共有・`
        + `箱は3つの下(ボタン ${pick.ボタンの幅}px)`)
    }

    if (process.env.SHOT) {
      await page.locator('.card').screenshot({ path: `${process.env.SHOT}/share-guest-${w}.png` })
    }

    /* ── ④ 切り替えると、中身が**入れ替わる** ── */
    await page.getByRole('button', { name: 'リンクを渡す' }).click()
    await page.waitForTimeout(80)
    const sh = await page.evaluate(() => {
      const box = document.querySelector('.share-box')
      const link = box.querySelector('input.share-url')
      const mailBtn = [...box.querySelectorAll('a.btn')]
        .find((a) => a.textContent.trim() === 'メールを開く')
      return {
        文: (box.textContent ?? ''),
        リンク: link ? link.value : '',
        宛先の欄: !!box.querySelector('input[type="email"]'),
        // **入れ替わっているか**(並べると箱が画面2枚ぶんになる)
        ゲストの欄: !!box.querySelector('.assign-list input[type="checkbox"]'),
        // **形が違ううちは押せない**(選ばせてから断らない)
        押せる: mailBtn ? !mailBtn.classList.contains('is-off') : null,
        はみ出し: document.documentElement.scrollWidth > window.innerWidth,
        あふれ: box.scrollWidth > box.clientWidth + 1,
      }
    })

    if (!sh.宛先の欄 || !sh.文.includes('① メールで送る')) {
      ng(`共有 ${w}px … ①メールで送るが無い`)
    } else if (!sh.リンク.includes('?m=') || !sh.文.includes('② リンクをコピー')) {
      ng(`共有 ${w}px … ②リンクが出ていない(${sh.リンク})`,
        'コピーを断る端末でも手で選べるよう、いつも見えるところに出す')
    } else if (sh.ゲストの欄) {
      ng(`共有 ${w}px … リンクに切り替えてもゲストの欄が残っている`,
        '**並べない。入れ替える** —— 並べると箱が画面2枚ぶんになる')
    } else if (sh.押せる !== false) {
      ng(`共有 ${w}px … 宛先が空でも「メールを開く」が押せる`,
        '**選ばせてから断らない**(CLAUDE.md)')
    } else if (sh.はみ出し || sh.あふれ) {
      ng(`共有 ${w}px … リンク側ではみ出している`)
    } else {
      ok(`共有 ${w}px … リンクへ切り替わる(2つとも出る・宛先が空なら押せない)`)
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
      ng(`共有 ${w}px … 宛先を書いても押せないまま`)
    } else if (!on.行き先.startsWith('mailto:a@b.com?')) {
      ng(`共有 ${w}px … 行き先が mailto ではない(${on.行き先.slice(0, 40)})`)
    } else {
      ok(`共有 ${w}px … 宛先を書くと mailto: が入る`)
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
  if (!busyM.上.some((t) => t.includes('3 / 14'))) {
    ng(`教材の操作 … 集めているあいだ、進み具合が出ない(${busyM.上.join(' / ')})`,
      '進み具合は必ず数で出す(CLAUDE.md)。'
      + '3つ並ぶ行なので動詞は落としてあるが、**数は1文字も削らない**')
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
    ['<PrintIcon />PDF', '上の行は言葉つき(絵だけでは PDF が出せることが読めない)'],
    ['<DownloadIcon />{dlShort(m)}',
      '**短い言い方**(2026-09 利用者の指定)。動詞は落とすが、数は削らない'],
    ['<MaterialShare', '渡す道はボタン1つ(2026-09 利用者の指定)'],
    ['guest={(', '**ゲストと共有の中身は、こちらが渡す**(担当ゲストを知っている)'],
    ['material-foot', 'めったに押さない3つは、教材を消すと同じ行'],
    ['読み上げ音声を作り直す', '下の行(絵のまま)'],
    ['練習の記録を消す', '同上'],
  ]
  const gone = want.filter(([t]) => !src.includes(t))
  /* **`.card-tools` の中に3つとも入っているか。**
     「あるか」だけを見ると、**共有だけ別の行へ戻しても緑のまま**になる */
  const row = src.match(/className="btn-row card-tools"[\s\S]*?\n {14}<\/div>/)?.[0] ?? ''
  /* **コメントを落としてから探す**(CLAUDE.md「名前が出てくるか」で見ない)。
     この画面は**利用者の言葉をそのまま引いてある**ので、
     「教材をシェア」も「教材をゲストと共有」も注釈の中に出てくる */
  const noC = src.replace(/\/\*[\s\S]*?\*\/|\{\/\*[\s\S]*?\*\/\}/g, '')
  if (gone.length) {
    ng(`教材の操作 … 画面に無い(${gone.map(([t]) => t).join(' / ')})`,
      gone[0][1])
  } else if (!/<PrintIcon/.test(row) || !/dlShort\(m\)/.test(row)
    || !/<MaterialShare/.test(row)) {
    ng('教材の操作 … 3つが同じ `.card-tools` の中にいない',
      '「３つ並ぶようにしてください」(2026-09 利用者の指定)')
  } else if (noC.includes('この教材をゲストと共有する') || noC.includes('教材をシェア')) {
    ng('教材の操作 … 前の2つのボタンが残っている',
      '1つにまとめた(**同じことをするものを2つ見せない**)')
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
      /* **絞り込みの欄も、畳んだら一緒に隠れる**(2026-09 実機・利用者の指定
           > 日付や絞り込みのプルダンは
           > 「宿題をさがす・しぼる」の中にしまって欲しいです
         箱の外に置いていたので、畳んでも欄だけが残っていた */
      畳んでも絞り込みが見えるか:
        !!document.querySelector('[data-hw] .wbfilter')?.checkVisibility(),
      /* **黙って絞らない。** 掛かっているときは、畳んだままでも印が出る */
      しぼり込み中の印: document
        .querySelector('[data-hw] .searchbar-mark')?.textContent.trim() ?? null,
      // 渡していない側(`data-fold`)には出ない。**「出る」だけを見ない**
      印を渡していない側: !!document.querySelector('[data-fold] .searchbar-mark'),
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
  } else if (shut.畳んでも絞り込みが見えるか) {
    ng('宿題をさがす … 畳んでも絞り込みの欄が残っている',
      '「日付や絞り込みのプルダンは…中にしまって欲しい」(利用者の指定)')
  } else if (shut.しぼり込み中の印 !== 'しぼり込み中') {
    ng(`宿題をさがす … 畳むと絞っていることが分からない(${shut.しぼり込み中の印})`,
      '**黙って絞らない**(CLAUDE.md)。欄を隠したぶん、印で見せる')
  } else if (shut.印を渡していない側) {
    ng('宿題をさがす … 渡していない側にも印が出ている',
      '掛かっているときだけ出す(効かない印を見せない)')
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
  /** `<SearchBar …> … <HomeworkFilter …> … </SearchBar>` の形か */
  /* **いちばん先頭の `<SearchBar` を見ない**(2026-09)。
     ゲストの一覧にも「名前から探す」の `SearchBar` が入ったので、
     `indexOf` だと**そちら**を拾って、宿題の箱が壊れていても通ってしまう。
     閉じタグから**手前へ**さかのぼって、その組だけを見る */
  const filterInsideBar = (src) => {
    const z = src.indexOf('</SearchBar>')
    if (z < 0) return false
    const a = src.lastIndexOf('<SearchBar', z)
    const f = src.indexOf('<HomeworkFilter')
    return a >= 0 && f > a && z > f
  }
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
  /* **絞り込みの欄は、まとめた箱の「中」**(2026-09 実機・利用者の指定)。
       > 日付や絞り込みのプルダンは
       > 「宿題をさがす・しぼる」の中にしまって欲しいです
     ソースの並び順で見る —— 開きタグ → `HomeworkFilter` → 閉じタグ。
     **「あとに書いてあるか」だけでは足りない** ——
     箱の下に戻しても、それは満たされてしまう */
  } else if (!filterInsideBar(tl)) {
    ng('宿題をさがす … 絞り込みの欄が箱の中に入っていない',
      '`<SearchBar>` の中身として書く(利用者の指定)')
  } else if (!/mark=\{homeworkFilterOn\(/.test(tl)) {
    ng('宿題をさがす … 絞っている印を出していない',
      '欄を隠したぶん、畳んだままでも分かるようにする(黙って絞らない)')
  } else if (tl.includes('PastFilterOpen')) {
    ng('宿題をさがす … 使わなくなった控え(`eas.pastFilter`)が残っている',
      '**値を偽にするだけにしない。** 残すと次に見た人が迷う(CLAUDE.md)')
  } else {
    ok('宿題をさがす・しぼる … 1つの箱・絞り込みはその中・教材の側は変えていない')
  }

  /* ══════════════════════════════════════════════════════════════
     ゲストの一覧を「名前から探す」で絞る(2026-09 利用者の指定)

       > 担当しているゲスト内に「名前から探す」を入れて下さい。

     いま担当は 22 人、伸ばしたあとは1人あたり 25 人になる
     (CLAUDE.md 冒頭)。名前で引けないと、一覧を送って目で探すことになる。

     **`TrainerLearners` は Supabase を引き連れている**ので、
     この骨組み(`__screens.jsx`)には描けない。だから**書いてある形**で
     見る —— ただし「名前が出てくるか」ではなく、
     **本当に使っている形**(`: shown).map(`)で見る。
     ══════════════════════════════════════════════════════════════ */
  if (!/placeholder="名前から探す"/.test(tl)) {
    ng('ゲストの一覧 … 「名前から探す」の欄が無い',
      '`SearchBar` を使い回す(同じ見た目を書き写さない)')
  /* **一覧に本当に効いているか。** 欄だけ置いて絞っていなければ、
     打ち込んでも何も起きない(しかも画面は普通に出るので気づけない) */
  /* **形が変わった**(第5.238節)。一覧は既定で畳むようになったので、
     `: shown).map(` ではなく `? shown : [])).map(` になっている。
     見たいのは**絞ったほう(`shown`)を描いているか** ——
     ここが `learners` に戻ると、打ち込んでも絞られない */
  } else if (!/showsLearnerList\(who, listOpen\) \? shown : \[\]\)\)\.map\(/.test(tl)) {
    ng('ゲストの一覧 … 打ち込んだ名前で絞っていない',
      '欄を置いただけでは何も起きない。`shown` を描く')
  /* **開いているゲストは、絞り込みに関係なく開いたまま。**
     `shown` から引くと、名前が当てはまらなくなった瞬間に消える */
  /* **空白と改行をまたげる形で見る**(第5.238節で踏んだ)——
     行が長くなって折り返した日に、**仕組みは何も変わっていないのに**
     赤くなった。見たいのは「`learners` から引いているか」1点である */
  } else if (!/openId\s*\?\s*learners\.filter\(\(l\) => l\.id === openId\)/.test(tl)) {
    ng('ゲストの一覧 … 開いているゲストを、絞り込みの側から引いている',
      '開いた人が絞り込みで消えると、行き止まりになる')
  /* **黙って絞らない**(CLAUDE.md)。0人のときに何も言わないと、
     「まだ担当がいない」のか「絞り込みで消えた」のか分からない */
  } else if (!/に当てはまるゲストがいません/.test(tl)) {
    ng('ゲストの一覧 … 当てはまる人がいないことを言っていない',
      '「まだ担当がいない」と見分けられない(黙って絞らない)')
  /* **開いた箱の左上に名前**(2026-09 実機・利用者の指定)。
       > 元々ゲストの名前があったところにも名前を入れて下さい。
     **押せなくしておく** —— ここは名前でいちばん大きい字なので、
     `<button>` に戻すと画面共有中に触れただけで一覧へ飛ぶ */
  } else if (!/<span className="learner-name is-open">\{l\.display_name\}<\/span>/.test(tl)) {
    ng('ゲストのページ … スコアの箱の左上に名前が出ていない',
      '空いたままだと、右のスコアだけが浮いて見える(利用者の指定)')
  } else {
    ok('ゲストの一覧 … 名前から探せる / 開いた箱の左上に名前が出る')
  }

  /* ══════════════════════════════════════════════════════════════
     ゲスト自身の「今週の宿題」にも、同じさがす・しぼるを置く
     (2026-09 利用者の指定「今日の宿題のところにも実装してください」)

     **トレーナーの教材画面をそのまま置かない。** あちらには
     **押すと課金になる操作**(読み上げ音声を作り直す)が並んでいるうえ、
     宿題のカードは**もう出ている**ので二重になる。
     置くのは**同じ形のさがす・しぼる**だけである。

     **描かないと分からないこと**を測る —— 絞り込みの欄が
     狭い画面で押せる大きさに収まるか・横にはみ出さないか・
     **取り組みの札が入っていないか**(すぐ下の見出しと二重になる)。
     ══════════════════════════════════════════════════════════════ */
  const hw = await page.evaluate(() => {
    const box = document.querySelector('[data-hw]')
    const fold = box.querySelector('details')
    /* **箱の中から探す。** 外に置いてあると、ここで見つからない
       (2026-09 実機・利用者の指定で、欄ごと中へしまった) */
    const filter = fold.querySelector('.wbfilter')
    /* **押すものそのものを測る。** `.wbfilter` は `display: block` なので、
       包んでいる `<label>` は**行の高さ(18px)しか無い** ——
       そこを測ると、押せる大きさを割っていないのに赤くなる(実測して気づいた) */
    const parts = filter ? [...filter.querySelectorAll('button, select')] : []
    return {
      札の行: !!box.querySelector('.chiprow'),
      絞り込みがある: !!filter,
      絞り込みの数: parts.length,
      いちばん低い: parts.length
        ? Math.round(Math.min(...parts.map((el) => el.getBoundingClientRect().height))) : 0,
      検索の行の下: Math.round(fold.querySelector('.searchbar-row')
        .getBoundingClientRect().bottom),
      絞り込みの上: filter ? Math.round(filter.getBoundingClientRect().top) : 0,
      はみ出し: filter
        ? Math.round(Math.max(...parts.map((el) => el.getBoundingClientRect().right)))
        : 0,
      窓: window.innerWidth,
    }
  })
  if (hw.札の行) {
    ng('今週の宿題 … 取り組みの札が入っている',
      'カードの1行目の「やった / まだ」と同じことを2か所に出さない')
  } else if (!hw.絞り込みがある || hw.絞り込みの数 < 3) {
    ng(`今週の宿題 … 絞り込みの欄が箱の中に出ていない(${hw.絞り込みの数} 個)`,
      '日付・分野・場面・苦手項目で絞れるようにする(欄は箱の中)')
  } else if (hw.絞り込みの上 < hw.検索の行の下) {
    ng('今週の宿題 … 絞り込みが、検索の欄より上にいる')
  } else if (hw.いちばん低い < 32) {
    ng(`今週の宿題 … 絞り込みが押せる大きさを割っている(${hw.いちばん低い}px)`)
  } else if (hw.はみ出し > hw.窓) {
    ng(`今週の宿題 … 絞り込みが横にはみ出している(${hw.はみ出し} > ${hw.窓})`)
  } else {
    ok(`今週の宿題 … さがす箱の中に絞り込み ${hw.絞り込みの数} 個`
      + `(${hw.いちばん低い}px・${hw.窓}px に収まる)`)
  }

  /* ── 画面が本当に呼んでいるか。**検証だけが緑にならないように** ── */
  const lh = readFileSync(new URL('../src/components/LearnerHomework.jsx',
    import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\/|\{\/\*[\s\S]*?\*\/\}/g, '')
  if (!/title="宿題をさがす・しぼる"[\s\S]{0,400}collapsible/.test(lh)) {
    ng('今週の宿題 … 画面がさがす帯を出していない',
      '部品に足しても、渡さなければ利用者の画面は変わらない')
  /* **「名前が出てくるか」で見ない。** `{false && (<SearchBar` のように
     出さなくしても、名前は残る(実際に試して素通りした)。
     **本当に描いている形**で見る */
  } else if (!/assignments\.length > 0 && \(\s*<SearchBar/.test(lh)) {
    ng('今週の宿題 … さがす・しぼるを出していない')
  /* **絞り込みの欄は箱の中**(2026-09 実機・利用者の指定)。
     開きタグ → `HomeworkFilter` → 閉じタグ の順で書いてあるか */
  } else if (!filterInsideBar(lh)) {
    ng('今週の宿題 … 絞り込みの欄が箱の中に入っていない',
      '`<SearchBar>` の中身として書く(利用者の指定)')
  } else if (!/mark=\{homeworkFilterOn\(/.test(lh)) {
    ng('今週の宿題 … 絞っている印を出していない',
      '欄を隠したぶん、畳んだままでも分かるようにする(黙って絞らない)')
  } else if (!lh.includes('saveHwSearchOpen(')) {
    ng('今週の宿題 … 開け閉めを覚えていない', '一度決める設定は覚える(CLAUDE.md)')
  } else if (/<TrainerMaterials|VoiceRemake|MaterialDelete/.test(lh)) {
    ng('今週の宿題 … トレーナー向けの操作が混ざっている',
      '作り直す(課金)・消す・共有するは、ゲストの画面に出さない')
  } else {
    ok('今週の宿題 … 画面が同じ部品を出している(課金になる操作は混ざっていない)')
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

  /* ══ 浮きボタンが、下の帯に被っていないか(2026-09 実機・利用者の指摘)══
       > トレーナーの教材画面で、下部のタブに「教材をつくる」が
       > 被ってしまっています。少し上に移動させて被らないように
       > してください。タブから少しだけマージンは取ってください

     `.finder-float` も `.app-tabs` もどちらも `position: fixed` で、
     **帯のほうがあとに描かれる。** だから被っても
     `npm run lint` にも `npm run build` にも引っかからず、
     **狭い画面でその画面を開くまで分からない。**

     **「重なっていない」だけを見ない。** それだと画面のはるか上へ
     逃がしても緑になる(利用者が言ったのは「少しだけマージン」である)。
     すき間が**8〜24px に収まっているか**まで見る。 */
  for (const w of [430, 390, 375, 360, 320]) {
    await page.setViewportSize({ width: w, height: 844 })
    await page.goto(`http://localhost:${PORT}/__bar.html?screen=tabs&role=trainer`,
      { waitUntil: 'networkidle' })
    await page.waitForSelector('.finder-float')
    const m = await page.evaluate(() => {
      const t = document.querySelector('.app-tabs').getBoundingClientRect()
      const f = document.querySelector('.finder-float').getBoundingClientRect()
      return {
        すき間: Math.round(t.top - f.bottom),
        帯: Math.round(t.height),
        画面内: f.top >= 0 && f.right <= window.innerWidth + 1,
      }
    })
    const どこ = `浮きボタン ${w}px`
    if (m.すき間 < 0) {
      ng(`${どこ} … 下の帯に ${-m.すき間}px 被っている`,
        '「＋ 教材を作る」が帯の下にもぐる(2026-09 実機)')
    } else if (m.すき間 < 8 || m.すき間 > 24) {
      ng(`${どこ} … 帯とのすき間が ${m.すき間}px`,
        '「タブから少しだけマージン」— 8〜24px に収める')
    } else if (!m.画面内) {
      ng(`${どこ} … 画面からはみ出している`)
    } else {
      ok(`${どこ} … 帯(${m.帯}px)の ${m.すき間}px 上に出る`)
    }
  }

  /* **広い画面まで持ち上げない。** 帯が出るのは「狭い画面 かつ 行き先が
     ある」ときだけなので、**逃がす指定も `.app-shell.has-tabs` に絞る。**
     素の `.finder-float` に書くと、帯の無い画面でも 69px 浮いてしまう。

     **「`.has-tabs` の指定が在るか」だけを見ない** —— それだと
     持ち上げを素の `.finder-float` へ移しても、狭い画面ぶんの指定が
     残っているかぎり**緑のまま**になる(実際にそうなった)。
     **素の `.finder-float` が置いている `bottom` の値**を1つずつ見て、
     帯の高さ(57px)ぶん浮いていないことを確かめる。 */
  {
    const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
    /* 素の `.finder-float { … }`(`.has-tabs` の付いていないもの)*/
    const bare = [...css.matchAll(/(^|[{},])\s*\.finder-float\s*\{([^}]*)\}/g)]
      .map((m) => /bottom:\s*calc\(\s*(\d+)px/.exec(m[2]))
      .filter(Boolean).map((m) => Number(m[1]))
    const 高い = bare.filter((n) => n > 24)
    if (!/\.app-shell\.has-tabs \.finder-float\s*\{[^}]*bottom:/.test(css)) {
      ng('浮きボタン … 逃がす指定が `.app-shell.has-tabs` に無い',
        '帯があるときだけ持ち上げる(幅の境目で決めない)')
    } else if (高い.length) {
      ng(`浮きボタン … 素の指定が ${高い.join('px / ')}px 浮いている`,
        '帯の無い広い画面まで持ち上がる。持ち上げは `.has-tabs` の側だけに書く')
    } else {
      ok(`浮きボタン … 帯があるときだけ持ち上げる`
        + `(素の指定は ${bare.join('px / ')}px のまま)`)
    }
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
    /* **箱そのものを押す**(第5.262節・2026-09-26 利用者の指定)。
       「英語を見る」のボタンは廃止したので、`.qr-peek` の先頭は Listen になる */
    await page.click('.qr-body--tap')
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
        /* **「◯ / ◯」は帯から消えた**(第5.176節)。進み具合の帯が言う。
           **読めるかを測る相手を、いま在るものに移す** ——
           帳面の名前(`DrillTitle`)である。教材の中には無いので `null` */
        const 数 = cs(document.querySelector('.drill-title'))
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
          /* **背は帯ではなく紙**(タイトルは帯の下に出るため) */
          名前の読みやすさ: 数 ? さ(数.color, 地.backgroundColor) : -1,
          名前がある: Boolean(数),
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
    } else if (!復習.名前がある) {
      ng('QR復習 … 帳面の名前(タイトル)が出ていない',
        '帯の札は「…」で切れるので、**全文はここが受け止める**(第5.176節)')
    } else if (復習.名前の読みやすさ < 60) {
      ng(`QR復習 … 帳面の名前が地に埋もれている(差 ${復習.名前の読みやすさ})`,
        '`.drill-title` を、明るい地で読める色にする')
    } else {
      ok(`QR復習 … 地も帯も明るい(${復習.地の明るさ}・名前の差 ${復習.名前の読みやすさ})`)
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
    } else if (!中.紙) {
      ng('QR教材の中 … 紙が消えた',
        '「紙の周囲は黒」は、あちらの別の指定である(言われた場所だけを直す)')
    } else if (中.終える) {
      /* **第5.250節**(2026-09-23 利用者の指定)。
           > 下の「集中モードを出る」というボタンはいらなくないですか？
           > 集中モードと、わざわざ銘打つ必要がないからです
         この画面は**下の帯を渡さない。** あのボタンは帯の上に
         浮かせる作り(`bottom: 100%`)なので、浮かせる先が無いと
         **いちばん下に落ちて「言えた」に重なる**(利用者の写真) */
      ng('QR教材の中 … 下の帯が無いのに「集中モードを終える」を浮かせている',
        '落ちてきて「言えた」に重なる。出る道は左上の ✕ 1つでよい')
    } else {
      ok(`QR教材の中 … 黒い地に白い紙のまま、浮かぶボタンは無し(地 ${中.地の明るさ})`)
    }

    /* **「出る」と「出ない」の両方を見る**(CLAUDE.md)。
         上だけだと、**どの画面にも出さない**形に書き換えても緑になる。
         消えるのは「帯を渡していない画面」だけで、
         読む・6Steps・レッスン・スピーチは**これまでどおり出る。** */
    {
      const 骨 = readFileSync(join(ROOT, 'src/components/FocusFrame.jsx'), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
      const 帯で決める = /\{plain \|\| !bar \? null : \(/.test(骨)
      const 帯を渡す = ['StepFocus', 'FocusReader', 'LessonView', 'SpeechPractice']
        .filter((n) => /\n\s*bar=\{/.test(
          readFileSync(join(ROOT, `src/components/${n}.jsx`), 'utf8')))
      if (!帯で決める) {
        ng('集中モードを終える … 出す / 出さないを、帯の有無で決めていない',
          '幅や画面の名前で分けると、置き場所の数だけ食い違う')
      } else if (帯を渡す.length !== 4) {
        ng(`集中モードを終える … 帯を渡す画面が ${帯を渡す.length} つになった`,
          `出るはずの4画面が減っている(${帯を渡す.join(' / ')})`)
      } else {
        ok('集中モードを終える … 帯のある4画面では、これまでどおり出る')
      }
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
  /* **ゲスト名の箱を入れて、帯を3つにして測る**(2026-09 利用者の指定)。
       > ゲストを一人選んでそのページの中にいるときは、
       > 常に画面上部にゲスト名ボックスが固定されているように
     箱は `.app-stick` の中にいるので、**帯が3つでも ☰ は押せる**はずである。
     ここを `?who=` 無しで測ると、箱が描かれず**素通り**する */
  for (const w of [1280, 900, 768, 390]) {
    await page.setViewportSize({ width: w, height: 800 })
    await page.goto(`http://localhost:${PORT}/__bar.html?screen=sticky&role=trainer&who=g1`,
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
      const nm = document.querySelector('.learnerbar-name')
      return { 帯: box('.app-topbar'), 支度: box('.jobbar'),
        ゲスト: box('.learnerbar'),
        名前: nm?.textContent?.trim() ?? '',
        // **名前は切れても、札は残す**(誰のページかが分からなくなる)
        札: document.querySelector('.learnerbar .badge')?.textContent?.trim() ?? '',
        戻る: Math.round(
          document.querySelector('.learnerbar-back')?.getBoundingClientRect().width ?? 0),
        はみ出し: (() => {
          const b = document.querySelector('.learnerbar')
          return b ? b.scrollWidth - b.clientWidth : 0
        })(),
        押せる: !!(hit && hit.closest('.nav-burger')) }
    })
    if (!m.帯 || !m.支度) {
      ng(`貼り付く帯 ${w}px … 帯が描かれていない`)
    } else if (!m.ゲスト) {
      ng(`ゲスト名の箱 ${w}px … 出ていない`,
        '開いているあいだ、誰のページかが画面から消える')
    } else if (!m.名前.includes('長谷川')) {
      ng(`ゲスト名の箱 ${w}px … 名前が出ていない`, m.名前 || '(空)')
    } else if (m.札 !== '受講中') {
      ng(`ゲスト名の箱 ${w}px … 状態の札が消えている`, m.札 || '(空)')
    } else if (m.戻る < 40) {
      ng(`ゲスト名の箱 ${w}px … 「← 一覧」が無い`, `幅 ${m.戻る}px`)
    } else if (m.はみ出し > 0) {
      ng(`ゲスト名の箱 ${w}px … 横にはみ出している`, `${m.はみ出し}px`)
    } else if (m.ゲスト.top < m.帯.bottom || m.支度.top < m.ゲスト.bottom) {
      ng(`ゲスト名の箱 ${w}px … 帯どうしが重なっている`,
        `帯 ${m.帯.bottom} / ゲスト ${m.ゲスト.top}〜${m.ゲスト.bottom} / 支度 ${m.支度.top}`)
    } else if (!m.押せる) {
      ng(`貼り付く帯 ${w}px … 送ると ☰ が押せない`,
        '支度の帯が上の帯にかぶっている。貼り付く箱は `.app-stick` 1つにする')
    } else if (m.支度.top < m.帯.bottom) {
      ng(`貼り付く帯 ${w}px … 支度の帯が上の帯に重なっている`
        + `(帯 ${m.帯.top}〜${m.帯.bottom} / 支度 ${m.支度.top}〜${m.支度.bottom})`)
    } else {
      ok(`貼り付く帯 ${w}px … 3つとも縦に並ぶ`
        + `(帯 ${m.帯.top}〜${m.帯.bottom} / ゲスト ${m.ゲスト.top}〜${m.ゲスト.bottom}`
        + ` / 支度 ${m.支度.top}〜${m.支度.bottom})・☰ 押せる`)
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
        /* **段の札**(2026-09 利用者の指定「タッチすればそれらを
           復習できるようにしたい」)。**押せるかどうかは、描いてみないと
           分からない** —— `<span>` のままでも見た目は変わらない */
        段: [...document.querySelectorAll('.wb-stats > .wb-stat')].map((b) => ({
          tag: b.tagName,
          高さ: Math.round(b.getBoundingClientRect().height),
          押せない: Boolean(b.disabled),
          文言: (b.querySelector('.wb-stat-label')?.textContent ?? '').trim(),
        })),
        段の説明: (document.querySelector('.wb-stats-lead')?.textContent ?? '').trim(),
        /* **「出しかた」は絵だけ**(第5.184節・2026-09 利用者の指定
           「添付した『ソートアイコン』にして、文字をなくしてください」)。

           **「絵が出ているか」だけを見ない** —— 文字を残したまま絵を
           足しても緑になる。**文字が無いこと・名前が残っていること・
           押せる大きさ・絵が真ん中にいること**の4つを持ち帰る。

           名前は消していない(`aria-label`)。**黙って消さない**
           ——読み上げでは「ボタン」としか読まれなくなる。 */
        出しかた: (() => {
          const b = document.querySelector('.rscope-sort')
          if (!b) return null
          const r = b.getBoundingClientRect()
          const sv = b.querySelector('svg')
          const sr = sv?.getBoundingClientRect()
          return {
            /* **数の丸(`.chip-count`)は数えない** —— あれは絞り込みの
               件数で、消す約束をしたのは**ボタンの文字**である */
            文字: [...b.childNodes]
              .filter((n) => !n.classList?.contains('chip-count'))
              .map((n) => n.textContent || '').join('').replace(/\s/g, ''),
            名: b.getAttribute('aria-label') || '',
            題: b.getAttribute('title') || '',
            絵: !!sv,
            幅: Math.round(r.width), 高さ: Math.round(r.height),
            /* **絵が真ん中にいるか。** `.icon` は「絵のうしろに文字が続く」
               前提で `margin-right: .38em` を持っているので、
               **戻し忘れると右にだけ余白が残って左に寄る**(実測で踏んだ) */
            絵のずれ: sr
              ? Math.round(Math.abs((sr.left + sr.right) / 2 - (r.left + r.right) / 2) * 10) / 10
              : null,
          }
        })(),
      }
    })
    let 開 = null
    if (開く) {
      await page.click('.rscope-go .btn--small')
      await page.waitForTimeout(140)
      開 = await page.evaluate(() => {
        /* **狭い画面は下から出るシート、広い画面は吹き出し**
           (2026-09 利用者の指定)。どちらの形かも一緒に持ち帰る */
        const pop = document.querySelector('.sheet') || document.querySelector('.setpop')
        if (!pop) return null
        const r = pop.getBoundingClientRect()
        const chips = [...pop.querySelectorAll('.rscope-chip')]
        return {
          形: document.querySelector('.sheet') ? 'シート' : '吹き出し',
          札の数: chips.length,
          /* **消した形が残っていないか**(2026-09)。数だけ見ていると、
             「おまかせ」を残したまま別の札を消しても緑になる */
          札の言葉: chips.map((c) => c.textContent.trim()).join('/'),
          見出し: [...pop.querySelectorAll('.rscope-head')]
            .map((e) => e.textContent.trim()).join('/'),
          /* **「繰り返す」が、個数の札と同じ行にいるか**(利用者の指定
             「一度に出す個数の横に」)。別の行に落ちていたら赤くする */
          繰り返すが個数と同じ行: (() => {
            const rep = pop.querySelector('.rscope-repeat')
            const row = pop.querySelector('[aria-labelledby="rscope-many"]')
            return !!rep && !!row && row.contains(rep)
          })(),
          低い札: Math.min(...chips.map((c) => Math.round(c.getBoundingClientRect().height))),
          押せない札: chips.filter((c) => c.disabled).length,
          数を出している: pop.querySelectorAll('.chip-count').length,
          /* **絞り込みの欄が、ぜんぶ同じ幅か。** ここがそろっていないと
             ぎざぎざに折り返して「素人っぽい」見た目になる(利用者の指摘) */
          欄の幅: [...pop.querySelectorAll('.wbfilter-ctl')]
            .map((e) => Math.round(e.getBoundingClientRect().width)),
          /* **どの絞り込みが出ているか**(0048 でレベルを足した)。
             名前で数えるので、行ごと消せば必ず赤くなる */
          欄の名前: [...pop.querySelectorAll('.wbfilter-name')]
            .map((e) => e.textContent.trim()),
          /* **品詞の選択肢**(2026-09 利用者の指定「品詞ごとに分ける
             絞り込み機能」)。行が出ているだけでは足りない ——
             `pos` に入る文字は日本語と短い印の2通りあるので、
             **両方がまとまって出ているか**まで見る */
          品詞の選択肢: [...pop.querySelectorAll('.wbfilter-row')]
            .filter((r) => r.querySelector('.wbfilter-name')?.textContent.trim() === '品詞')
            .flatMap((r) => [...r.querySelectorAll('option')].map((o) => o.textContent.trim())),
          /* **レベルの選択肢**(2026-09 利用者の指定「カッコでGSEスコアも
             添えて」)。行が出ているだけでは足りない —— 名前が
             `cefrLabel`(「B1(中級)」)に戻っても行は出るので、
             **何と書いてあるか**まで読む */
          レベルの選択肢: [...pop.querySelectorAll('.wbfilter-row')]
            .filter((r) => r.querySelector('.wbfilter-name')?.textContent.trim() === 'レベル')
            .flatMap((r) => [...r.querySelectorAll('option')].map((o) => o.textContent.trim())),
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
    /* ── 「出しかた」は絵だけ(第5.184節)──────────────────── */
    } else if (!閉.出しかた) {
      ng(`復習の範囲 ${w}px … 「出しかた」のボタンが無い`, '`.rscope-sort`')
    } else if (閉.出しかた.文字 !== '') {
      ng(`復習の範囲 ${w}px … 「出しかた」に文字が残っている`,
        `「${閉.出しかた.文字}」。利用者の指定は「文字をなくしてください」である`)
    } else if (!閉.出しかた.絵) {
      ng(`復習の範囲 ${w}px … 「出しかた」に絵が無い`,
        '文字も絵も無いと、何のボタンか分からない')
    } else if (閉.出しかた.名 !== '出しかた' || 閉.出しかた.題 !== '出しかた') {
      ng(`復習の範囲 ${w}px … 「出しかた」の名前が消えている`,
        `aria-label「${閉.出しかた.名}」/ title「${閉.出しかた.題}」。`
        + '文字を消しても、読み上げと吹き出しには名前が要る')
    } else if (閉.出しかた.幅 < 40 || 閉.出しかた.高さ < 34) {
      ng(`復習の範囲 ${w}px … 「出しかた」が小さすぎる`,
        `${閉.出しかた.幅}×${閉.出しかた.高さ}px。文字を消しても押す場所は小さくしない`)
    } else if (閉.出しかた.絵のずれ > 0.6) {
      ng(`復習の範囲 ${w}px … 「出しかた」の絵が真ん中にいない`,
        `${閉.出しかた.絵のずれ}px ずれている。`
        + '`.icon` の `margin-right` を 0 に戻し忘れていないか')
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
    /* 範囲8 + 個数5 + 繰り返す1 + 訊き方4 + 並べ方2 = 20
       (2026-09 実機・利用者の指定で、上の帯から3つを移した) */
    } else if (開.札の数 !== 20) {
      ng(`復習の範囲 ${w}px … 札が 20 個`
        + `(範囲8 + 個数5 + 繰り返す1 + 訊き方4 + 並べ方2)ではない`, `${開.札の数} 個`)
    /* **「おまかせ」は消した**(2026-09 実機・利用者の指定)。
       この人の単語帳はほとんどが箱0で、**ずっと4択**にしかならず、
       名前が嘘になっていた */
    } else if (開.札の言葉.includes('おまかせ') || 開.札の言葉.includes('つづりを書く')) {
      ng(`復習の範囲 ${w}px … 消したはずの形が札に残っている`, 開.札の言葉)
    /* **見出しが無いと、どの札が何なのか分からない** */
    } else if (!開.見出し.includes('訊き方') || !開.見出し.includes('並べ方')) {
      ng(`復習の範囲 ${w}px … 訊き方・並べ方の見出しが出ていない`, 開.見出し)
    /* **繰り返すは「一度に出す個数の横」**(利用者の指定)。
       別の行に落ちていたら、言われたとおりに置けていない */
    } else if (!開.繰り返すが個数と同じ行) {
      ng(`復習の範囲 ${w}px … 「繰り返す」が個数と別の行にある`,
        '利用者の指定は「一度に出す個数の横に」である')
    /* **吹き出しが画面からはみ出さない。** はみ出すと、
       いちばん下の札に永久に手が届かない(語の意味の吹き出しと同じ話) */
    } else if (!開.画面内) {
      ng(`復習の範囲 ${w}px … ${開.形}が画面からはみ出している`
        + `(${開.幅}×${開.高さ})`)
    /* **狭い画面は下から出るシート**(利用者の指定)。
       **「シートが出る」だけを見ない** —— 広い画面まで
       シートにしても緑のままになる */
    } else if (開.形 !== (w < 768 ? 'シート' : '吹き出し')) {
      ng(`復習の範囲 ${w}px … ${開.形}で出ている`,
        w < 768 ? 'スマホでは下から出るシート' : '広い画面では吹き出し')
    /* **絞り込みの欄は、ぜんぶ同じ幅。** 直す前は中身なりの幅で
       ばらばらに折り返していた(実測 84 / 152 / 178 / 233 / 161) */
    } else if (開.欄の幅.length < 3) {
      ng(`復習の範囲 ${w}px … 絞り込みが「出しかた」の中に無い`,
        `欄 ${開.欄の幅.length} 個。設定は1か所にまとめる`)
    } else if (new Set(開.欄の幅).size !== 1) {
      ng(`復習の範囲 ${w}px … 絞り込みの欄の幅がそろっていない`,
        `${開.欄の幅.join(' / ')}px`)
    } else {
      ok(`復習の範囲 ${w}px … 畳んで ${閉.高さ}px(${閉.ボタン})`
        + `・出しかたは絵だけ ${閉.出しかた.幅}×${閉.出しかた.高さ}px`
        + `・${開.形} ${開.幅}×${開.高さ}・欄 ${開.欄の幅[0]}px でそろう`)
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

  /* ══ **段の札は、押せる**(2026-09 利用者の指定)═══════════════════
       > 学習者の心理としては、覚えた、を押すのは少し勇気がいるものです。
       > なので、それぞれ数を示すだけではなく、
       > タッチすればそれらを復習できるようにしたいです。

     **押せるかどうかは、描いてみないと分からない** ——
     `<span>` に戻しても見た目は1ドットも変わらない。
     あわせて「0件の段は押せない」も見る(効かない操作を見せない)。 */
  {
    const { 閉 } = await 測る(390, '', false)
    const 押せる段 = 閉.段.filter((g) => g.tag === 'BUTTON')
    if (閉.段.length !== 3) {
      ng('段を押す … 札が3つ出ていない', `${閉.段.length} 個`)
    } else if (押せる段.length !== 3) {
      ng('段を押す … 札が `<button>` になっていない',
        閉.段.map((g) => g.tag).join('/'))
    } else if (Math.min(...閉.段.map((g) => g.高さ)) < 40) {
      ng('段を押す … 押せる大きさ(40px)を割っている',
        閉.段.map((g) => g.高さ).join('/'))
    } else if (!閉.段の説明.includes('押すと')) {
      ng('段を押す … 押したら何が起きるかを言っていない', 閉.段の説明)
    } else {
      ok(`段を押す … 3つとも押せる(${閉.段.map((g) => g.文言).join(' / ')}`
        + `・${閉.段[0].高さ}px)`)
    }

    /* **押した印が出るか。** 色だけに頼らない印(`is-on` + `aria-pressed`)を、
       実際に押して確かめる。ここが無いと、どれを選んだのか分からない */
    const page = await browser.newPage({ viewport: { width: 390, height: 900 } })
    await page.goto(`http://localhost:${PORT}/__bar.html?screen=rscope`,
      { waitUntil: 'networkidle' })
    await page.waitForSelector('.wb-stats')
    await page.click('.wb-stats > .wb-stat:last-child')
    await page.waitForTimeout(80)
    const 押した = await page.evaluate(() => {
      const b = document.querySelector('.wb-stats > .wb-stat:last-child')
      return {
        印: b.classList.contains('is-on'),
        よみあげ: b.getAttribute('aria-pressed'),
        説明: (document.querySelector('.wb-stats-lead')?.textContent ?? '').trim(),
      }
    })
    await page.close()
    if (!押した.印 || 押した.よみあげ !== 'true') {
      ng('段を押す … 押した印が出ていない',
        `is-on ${押した.印} / aria-pressed ${押した.よみあげ}`)
    } else if (!押した.説明.includes('もう一度押す')) {
      ng('段を押す … 戻り方を言っていない', 押した.説明)
    } else {
      ok('段を押す … 押した印(色 + 枠 + aria-pressed)と、戻り方が出る')
    }
  }

  /* ══ **レベルでも絞り込める**(0048・2026-09 利用者の指定)═══════════
       > また、レベルの絞り込みも欲しいですね
     **行ごと消しても、幅の検証は緑のまま**なので、名前で数える */
  {
    const { 開 } = await 測る(390)
    const 名前 = (開?.欄の名前 ?? []).join('/')
    if (!名前.includes('レベル')) {
      ng('絞り込み … レベルの行が出ていない', 名前 || '(1つも無い)')
    } else if (!名前.includes('日付') || !名前.includes('分野')) {
      ng('絞り込み … もとからあった行が消えている', 名前)
    } else {
      ok(`絞り込み … レベルが出て、もとの行も残っている(${名前})`)
    }
    /* **カッコで GSE を添える**(2026-09 利用者の指定)。
       選ぶときは VERSANT のスコアと突き合わせたいので数字が要る
       (`cefr.js`「選ぶときと、見るときでは要る情報が違う」)。
       **「すべて」以外の全部**に付いているかを読む */
    const 選択肢 = (開?.レベルの選択肢 ?? []).filter((t) => t && t !== 'すべて')
    const GSE無し = 選択肢.filter((t) => !/\(GSE /.test(t))
    if (!選択肢.length) {
      ng('絞り込み … レベルの選択肢が1つも無い')
    } else if (GSE無し.length) {
      ng('絞り込み … レベルの選択肢に GSE が添っていない', GSE無し.join(' / '))
    } else {
      ok(`絞り込み … レベルの選択肢に GSE が添う(${選択肢.join(' / ')})`)
    }
  }

  /* ══ **品詞でも絞り込める**(2026-09 利用者の指定)═══════════════════
       > 全ての単語に対して効くようにして欲しいのが
       > 品詞ごとに分ける絞り込み機能です。

     **「出る」と「出ない」の両方を見る**(CLAUDE.md)。
     「出る」だけを見ると、**選べるものが1つしか無いときにも出す形**に
     壊しても緑のままになる(効かない操作を見せない)。

     仮の語は **`pos` に2通りの言葉**を入れてある —— 窓口が引いた
     日本語(「他動詞」)と、基礎単語の短い印(`n`)。
     「他動詞」は**一覧にそのままの言葉では無い**ので、
     `posGroupOf()` が動詞へ寄せて初めて、この行が出る。 */
  {
    const { 開 } = await 測る(390)
    const 名前 = (開?.欄の名前 ?? []).join('/')
    const 選択肢 = (開?.品詞の選択肢 ?? []).join('/')
    /* `?rows=old` は**ぜんぶ同じ品詞**なので、選べるものが1つしか無い */
    const 一つだけ = (old.開?.欄の名前 ?? []).includes('品詞')
    if (!名前.includes('品詞')) {
      ng('品詞の絞り込み … 行が出ていない', 名前 || '(1つも無い)')
    } else if (!選択肢.includes('名詞') || !選択肢.includes('動詞')) {
      ng('品詞の絞り込み … 2通りの言葉がまとまっていない',
        `${選択肢 || '(選択肢が無い)'} — 「他動詞」は動詞へ、「n」は名詞へ寄せる`)
    } else if (!選択肢.includes('すべて')) {
      ng('品詞の絞り込み … 絞りを外す選択肢が無い(行き止まりを作らない)', 選択肢)
    } else if (一つだけ) {
      ng('品詞の絞り込み … 選べるものが1つしか無いのに出している',
        '効かない操作を見せない(CLAUDE.md)')
    } else if (!名前.includes('日付') || !名前.includes('レベル')) {
      ng('品詞の絞り込み … もとからあった行が消えている', 名前)
    } else {
      ok(`品詞の絞り込み … 2通りの言葉がまとまって出る(${選択肢})`)
    }
  }

  /* **押す前に、何が起きるかを言う。** ここが
     「仕組みが分かりにくい」への答えである。
     **畳んでいても見えている**ので、吹き出しを開かずに測る */
  const one = await 測る(390, '', false)
  /* **文言は `scopeLead()` 1か所**(第5.245節で言い直した)。
     「今日出すぶんから出します」→「今日が復習の日のものから出します」 */
  if (!one.閉.説明.includes('今日が復習の日のものから出します')) {
    ng('復習の範囲 … 押す前の説明が出ていない', one.閉.説明)
  } else ok('復習の範囲 … 畳んだままでも、何が出るのかを1行で言う')

  /* **画面が本当に使っているか。** 検証の入り口(`__screens.jsx`)だけ
     直しても、利用者の画面は変わらない */
  for (const f of ['Wordbook', 'QrReview']) {
    const src = readFileSync(new URL(`../src/components/${f}.jsx`, import.meta.url), 'utf8')
      .replace(/\/\*[\s\S]*?\*\/|\{\/\*[\s\S]*?\*\/\}/g, '')
    if (!/<ReviewScope\b/.test(src)) {
      ng(`復習の範囲 … ${f} が札を出していない`)
    /* **絞り込みも中へ入れているか**(2026-09 利用者の指定)。
       外に出したままだと、設定がまた2か所に分かれる。

       **「あとに書いてあるか」では足りない**(`SearchBar` で一度踏んだ)——
       箱の下に戻しても、それは満たされてしまう。
       **開きタグ → 絞り込み → 閉じタグ**の順で見る。
       字数で見張ると、props を足したときに巻き添えで赤くなる */
    } else if (!/<ReviewScope[\s\S]*?<WordbookFilter\b[\s\S]*?<\/ReviewScope>/.test(src)) {
      ng(`復習の範囲 … ${f} が絞り込みを「出しかた」の外に置いている`,
        '設定は1か所。押すものは「出す」と「出しかた」の2つだけにする')
    } else {
      ok(`復習の範囲 … ${f} が札も絞り込みも同じ場所に出している`)
    }
  }

  /* ══ **上下の説明は出さない**(2026-09 実機・利用者の指定)══════════
       > 上下の説明が不要です。これはquick response、単語帳に共通です。

     一度読めば足りるものが、毎日いちばん上に居座っていた。
     **消したことを、書いてある形で見張る** —— 戻すと赤くなる */
  {
    /* **空のときの案内は消さない** —— 「まだ1問も溜まっていません。
       教材の Quick Response で『まだ』を押すと…」は、
       **何も無いときに何をすればよいか**を言うものである
       (行き止まりを作らない・CLAUDE.md)。消したのは
       **毎日いちばん上に居座っていた説明**だけなので、
       そちらにしか無い言い回しで見る */
    const 消したもの = [
      ['QrReview', '出てくる間隔があきます'],
      ['QrReview', '今日出す<'],
      ['QrReview', '溜まっている<'],
      ['WordbookAdd', '入れた語は'],
    ]
    let 残り = []
    for (const [f, 文] of 消したもの) {
      const src = readFileSync(new URL(`../src/components/${f}.jsx`, import.meta.url), 'utf8')
        .replace(/\/\*[\s\S]*?\*\/|\{\/\*[\s\S]*?\*\/\}/g, '')
      if (src.includes(文)) 残り.push(`${f}:${文}`)
    }
    if (残り.length) {
      ng('復習の説明 … 消したはずの文が残っている', 残り.join(' / '))
    } else {
      ok('復習の説明 … 上下の説明も、古い数え方の文言も残っていない')
    }
  }

  /* ══ **「やめる」を、入れるボタンのとなりに**(2026-09 実機)══════════
       > 自分で単語帳に書き込みをしようとすると、戻るボタンがないのが困ります。

     閉じる道は上にもあるが、**入力欄まで送るとそこは画面の外**である。
     「読み上げ音声を作り直す」でまったく同じ指摘を受けている */
  {
    const src = readFileSync(new URL('../src/components/WordbookAdd.jsx', import.meta.url), 'utf8')
      .replace(/\/\*[\s\S]*?\*\/|\{\/\*[\s\S]*?\*\/\}/g, '')
    if (!/<div className="btn-row">[\s\S]{0,700}setOpen\(false\)[\s\S]{0,80}やめる/.test(src)) {
      ng('語句を手で入れる … 「やめる」が入れるボタンのとなりに無い',
        '上のボタンは、入力欄まで送ると画面の外にいる')
    } else {
      ok('語句を手で入れる … 「やめる」が入れるボタンのとなりにある')
    }
  }
}

// ══════════════════════════════════════════════════════════════════════
// 聞き流し(2026-09 利用者の指定)
//
//   > 音楽を流しながらどんどん登録されている単語が読まれるモード
//
// **1語だけに向き合う画面なので、送るものが出ていてはいけない**
// (集中モードと同じ考え方)。どの幅で送るようになるかは
// **ソースを読んでも分からない。描いて測る。**
//
// **「出る」と「出ない」の両方を見る**(CLAUDE.md) ——
// 語と訳が出ていることと、送るものが無いことの両方を数える。
// ══════════════════════════════════════════════════════════════════════
{
  for (const [w, h] of [[390, 844], [320, 568], [1280, 900]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } })
    await page.goto(`http://localhost:${PORT}/__bar.html?screen=radio`,
      { waitUntil: 'networkidle' })
    await page.waitForTimeout(300)
    const got = await page.evaluate(() => {
      const px = (el) => (el ? Math.round(el.getBoundingClientRect().height) : 0)
      const card = document.querySelector('.radio-card')
      const body = document.querySelector('.focus-body')
      const btns = [...document.querySelectorAll('.radio-tools .btn')]
      return {
        語: document.querySelector('.radio-en')?.textContent?.trim() ?? '',
        訳: document.querySelector('.radio-ja')?.textContent?.trim() ?? '',
        /* **読み方と間は、別々の欄である。**
           `.focus-top select option` をまとめて数えると、
           片方を消しても合計が合ってしまう(素通りする)。
           **並び順で取らない** —— 読み方の欄が消えると、そこが
           間の欄に入れ替わって**気づけない**(実際にそうなった) */
        読み方: [...document.querySelectorAll('.focus-top .radio-pick:not(.radio-pick--gap) select')]
          .flatMap((s) => [...s.options].map((o) => o.textContent.trim())),
        間: [...document.querySelectorAll('.focus-top .radio-pick--gap select')]
          .flatMap((s) => [...s.options].map((o) => o.textContent.trim())),
        ボタン: btns.map((b) => ({ 文言: b.textContent.trim(), 高さ: px(b) })),
        // **送るものが無いか。** ここが出た瞬間、この画面の意味が消える
        たて: body ? body.scrollHeight - body.clientHeight : 0,
        よこ: body ? body.scrollWidth - body.clientWidth : 0,
        右: card ? Math.round(card.getBoundingClientRect().right) : 0,
      }
    })
    await page.close()

    /* **どの語が出ているかは、測るたびに変わる**(開いた瞬間から回っている)。
       だから**特定の語を待たない** —— 一覧のどれかが出ていればよい。
       ここで `take on` を決め打ちにすると、読み方や間を変えたときに
       **画面は正しいのに赤くなる**(実際に一度そうなった) */
    if (!['take on', 'gist'].includes(got.語)) {
      ng(`聞き流し(${w}px) … 語が出ていない`, got.語 || '(空)')
    } else if (!/[぀-ヿ㐀-鿿]/.test(got.訳)) {
      ng(`聞き流し(${w}px) … 訳が出ていない`, got.訳 || '(空)')
    } else if (got.読み方.length !== 0) {
      /* **読み方は「英語だけ」1つになった**(2026-09 利用者の指定
         「日本語入りはいらないですね!こえの質が悪すぎます!」)。
         選べるものが1つなら、**欄そのものを出さない**
         —— 効かない操作を見せない(CLAUDE.md) */
      ng(`聞き流し(${w}px) … 選べるものが1つなのに、読み方の欄が出ている`,
        got.読み方.join('/'))
    } else if (got.間.length < 4 || !got.間.some((t) => /秒/.test(t))) {
      /* **間の欄が出ているか**(2026-09 利用者の指定
         「単語帳もだが、間の時間設定もできるようにしてくれ」) */
      ng(`聞き流し(${w}px) … 間の長さを選べない`, got.間.join('/') || '(欄が無い)')
    } else if (got.ボタン.length !== 2 || got.ボタン.some((b) => b.高さ < 40)) {
      ng(`聞き流し(${w}px) … 押せる大きさ(40px)を割っている`,
        got.ボタン.map((b) => `${b.文言}:${b.高さ}`).join(' / '))
    } else if (got.よこ > 0 || got.右 > w) {
      ng(`聞き流し(${w}px) … 横にはみ出している`, `${got.よこ}px / 右 ${got.右}`)
    } else if (got.たて > 0) {
      ng(`聞き流し(${w}px) … 縦に送るものが出ている`,
        `${got.たて}px —— 1語だけに向き合う画面である`)
    } else {
      ok(`聞き流し(${w}px) … 語も訳も出て、間も選べて、送るものが無い`)
    }
  }

  /* ── Quick Response の聞き流し(2026-09 利用者の指定)────────────────
   *
   *   > Quick Responseにも聞き流しを作ってくれ。
   *
   *   **部品は単語帳とまったく同じ。** けれども**中身が文になる**ので、
   *   語のときと同じ字の大きさでは狭い画面で6行になり、
   *   **送るものが出てこの画面の意味が消える。**
   *   どの幅で送るようになるかは**ソースを読んでも分からない。描いて測る。**
   */
  for (const [w, h] of [[390, 844], [320, 568], [1280, 900]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } })
    await page.goto(`http://localhost:${PORT}/__bar.html?screen=qrradio`,
      { waitUntil: 'networkidle' })
    await page.waitForTimeout(300)
    const got = await page.evaluate(() => {
      const card = document.querySelector('.radio-card')
      const body = document.querySelector('.focus-body')
      return {
        文: document.querySelector('.radio-en')?.textContent?.trim() ?? '',
        訳: document.querySelector('.radio-ja')?.textContent?.trim() ?? '',
        /* **曲の欄を混ぜない**(2026-09-23)。`--gap` だけを外していたので、
           **曲の題まで「読み方」として数えていた** —— 読み方の数を
           見ようとして、はじめ赤くなった。曲は `--song` である */
        読み方: [...document.querySelectorAll(
          '.focus-top .radio-pick:not(.radio-pick--gap):not(.radio-pick--song) select',
        )].flatMap((s) => [...s.options].map((o) => o.textContent.trim())),
        間: [...document.querySelectorAll('.focus-top .radio-pick--gap select')]
          .flatMap((s) => [...s.options].map((o) => o.textContent.trim())),
        たて: body ? body.scrollHeight - body.clientHeight : 0,
        よこ: body ? body.scrollWidth - body.clientWidth : 0,
        右: card ? Math.round(card.getBoundingClientRect().right) : 0,
      }
    })
    await page.close()

    /* **どの文が出ているかは、測るたびに変わる**(上と同じ理由)。
       ただし**どちらも1行に収まらない長さ**にしてあるので、
       どちらが出ていても字の落とし方は試される */
    if (!/take on the project|walk me through/.test(got.文)) {
      ng(`QRの聞き流し(${w}px) … 文が出ていない`, got.文 || '(空)')
    } else if (!/[぀-ヿ㐀-鿿]/.test(got.訳)) {
      ng(`QRの聞き流し(${w}px) … 訳が出ていない`, got.訳 || '(空)')
    } else if (got.読み方.length < 2) {
      /* **ここは利用者の指定で反転した**(2026-09「パタプラのようにしたい」)。
         Quick Response には「言う練習」が足してあるので、
         **読み方の欄が出ていなければならない。**
         単語帳(すぐ上)は「英語だけ」1つのままなので、**あちらは出ない** ——
         同じ部品が、場面で正しく分かれていることを、ここで見ている */
      ng(`QRの聞き流し(${w}px) … 読み方をえらべない(言う練習にたどり着けない)`,
        got.読み方.join('/') || '(欄が無い)')
    } else if (!got.読み方.some((t) => /日本語→英語/.test(t))) {
      ng(`QRの聞き流し(${w}px) … 「日本語→英語」が読み方に無い`, got.読み方.join('/'))
    } else if (got.読み方.some((t) => /チャンク/.test(t))) {
      /* **チャンク系の2つは排除した**(第5.251節・2026-09-23 利用者の指定
         「ややこしく、分かりにくいので排除です」)。
         **「出る」だけでなく「出ない」も見る** —— 一覧に戻しても
         緑のままだと、消したことを誰も守らない */
      ng(`QRの聞き流し(${w}px) … チャンク系の読み方が戻っている`,
        got.読み方.join('/'))
    } else if (got.読み方.length !== 2) {
      ng(`QRの聞き流し(${w}px) … 読み方が2つではない`, got.読み方.join('/'))
    } else if (!got.間.some((t) => /秒/.test(t))) {
      /* **間の欄は、Quick Response にも出る**(語は短く、文は長い) */
      ng(`QRの聞き流し(${w}px) … 間の長さを選べない`, got.間.join('/') || '(欄が無い)')
    } else if (got.よこ > 0 || got.右 > w) {
      ng(`QRの聞き流し(${w}px) … 横にはみ出している`, `${got.よこ}px / 右 ${got.右}`)
    } else if (got.たて > 0) {
      ng(`QRの聞き流し(${w}px) … 縦に送るものが出ている`,
        `${got.たて}px —— 1問だけに向き合う画面である`)
    } else {
      ok(`QRの聞き流し(${w}px) … 文も訳も出て、送るものが無い`)
    }
  }

  /* ── **本当に鳴らしてみる**(2026-09 実機・利用者の指摘)────────────
   *
   *   > 一つの単語が4回読み上げられたり、3回だったり、2回だったり、
   *   > 一回だったり、不規則です。そして画面に表示されている単語と
   *   > メチャクチャにズレてしまってます
   *
   *   **形を読むだけでは、絶対に見つからない。** `npm run lint` も
   *   `npm run build` も通り、**音は鳴る**ので押しても分からない。
   *   だから**端末の声の入口を差し替えて、何を読んだかを数える。**
   *   置き換えるのは `speechSynthesis` だけで、画面のコードは1行も触らない。
   *
   *   見るのは3つ。**どれか1つでも欠けると素通りする。**
   *     ① 同じ語を続けて2回読んでいるか
   *     ② 読んだ英語と、そのとき画面に出ている語が同じか
   *     ③ **日本語を1つも読んでいないか**(2026-09 利用者の指定)
   *
   *   ①だけだと、画面が1つ先を指したままでも緑になる。
   *   ②だけだと、同じ語を二度読んでも(画面も同じなので)緑になる。
   *
   *   ③は「日本語入りはいらないですね!こえの質が悪すぎます!」への
   *   見張りである。**端末に古い `enja` が残っていても**、
   *   `radioModeOf()` が `en` に落とすので日本語は読まれない ——
   *   だから**両方の値で試す。**
   */
  for (const [mode, 続けて] of [['enja', 2], ['en', 2]]) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
    await page.addInitScript((m) => {
      try { localStorage.setItem('eas.radioMode', m) } catch { /* 使えなくても困らない */ }
      window.__log = []
      const voices = [{ name: 'T EN', lang: 'en-US' }, { name: 'T JA', lang: 'ja-JP' }]
      const fake = {
        getVoices: () => voices,
        cancel: () => {},
        speak: (u) => {
          window.__log.push({
            読んだ: u.text,
            画面: document.querySelector('.radio-en')?.textContent?.trim() ?? '',
          })
          setTimeout(() => { u.onend?.() }, 120)
        },
        speaking: false, pending: false, paused: false,
        addEventListener: () => {}, removeEventListener: () => {},
      }
      /* **代入では効かない。** `window.speechSynthesis` は読み取り専用の
         getter なので、`=` は黙って捨てられる(実際に一度踏んだ) */
      Object.defineProperty(window, 'speechSynthesis', { value: fake, configurable: true })
      window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t } }
    }, mode)
    await page.goto(`http://localhost:${PORT}/__bar.html?screen=radio`,
      { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(7000)
    const log = await page.evaluate(() => window.__log)
    await page.close()

    const 英語 = log.filter((r) => /^[A-Za-z][A-Za-z ]*$/.test(r.読んだ))
    /* **日本語を読んでいないか。** 端末に `enja` が残っていても、
       読み方は `en` に落ちるので1つも読まれないのが正しい */
    const 日本語 = log.filter((r) => /[぀-ヿ㐀-鿿、。]/.test(r.読んだ))
    // 同じ英語が何回続いたか(`en` は 2 が正しい。3以上・不揃いは事故)
    const 連続 = []
    for (const r of 英語) {
      const 末 = 連続[連続.length - 1]
      if (末 && 末.語 === r.読んだ) 末.回 += 1
      else 連続.push({ 語: r.読んだ, 回: 1 })
    }
    // 最後の1組は途中で切れているので数えない
    const 中身 = 連続.slice(0, -1)
    const ずれ = 英語.filter((r) => r.読んだ !== r.画面)

    if (英語.length < 3) {
      ng(`聞き流し(${mode}) … 読み上げが動いていない`, `${英語.length} 回`)
    } else if (日本語.length > 0) {
      ng(`聞き流し(${mode}) … **日本語を読んでいる**(端末の声には戻さない)`,
        日本語.map((r) => r.読んだ).join(' / '))
    } else if (中身.some((c) => c.回 !== 続けて)) {
      ng(`聞き流し(${mode}) … 同じ語を ${続けて} 回ずつ読んでいない`,
        中身.map((c) => `${c.語}×${c.回}`).join(' / '))
    } else if (ずれ.length > 0) {
      ng(`聞き流し(${mode}) … 読んでいる語と画面がずれている`,
        ずれ.map((r) => `読「${r.読んだ}」画面「${r.画面}」`).join(' / '))
    } else {
      ok(`聞き流し(${mode}) … 1語ずつ ${続けて} 回、画面とそろって読む`
        + `。日本語は0回(${中身.map((c) => c.語).join(' → ')})`)
    }
  }

  /* ── **端末の声の入口を差し替える。** 上の実測とまったく同じ仕掛けで、
        「何を読んだか」と「そのとき画面に何が出ていたか」を控える ────── */
  const 声をすりかえる = (page, 控え) => page.addInitScript((kv) => {
    for (const [k, v] of kv) {
      try { localStorage.setItem(k, v) } catch { /* 使えなくても困らない */ }
    }
    window.__log = []
    const voices = [{ name: 'T EN', lang: 'en-US' }, { name: 'T JA', lang: 'ja-JP' }]
    const fake = {
      getVoices: () => voices,
      cancel: () => {},
      speak: (u) => {
        window.__log.push({
          読んだ: u.text,
          画面: document.querySelector('.radio-en')?.textContent?.trim() ?? '',
        })
        setTimeout(() => { u.onend?.() }, 120)
      },
      speaking: false, pending: false, paused: false,
      addEventListener: () => {}, removeEventListener: () => {},
    }
    /* **代入では効かない。** 読み取り専用の getter である */
    Object.defineProperty(window, 'speechSynthesis', { value: fake, configurable: true })
    window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t } }
  }, 控え)

  /** 日本語の字が1つも無ければ英語(文には `.` や `?` も入る) */
  const 英語か = (t) => !/[぀-ヿ㐀-鿿、。]/.test(t)

  /* ── **Quick Response でも、日本語は読まない**(2026-09 利用者の指定)──
   *
   *   > 日本語入りはいらないですね!こえの質が悪すぎます!
   *
   *   **形を読むだけでは足りない。** 一覧から `jaen` を外しても、
   *   `radioSteps` に枝が残っていれば**日本語が鳴る。**
   *   しかも**音は鳴る**ので、聴いた人にしか分からない。
   *   だから**端末に `jaen` を残したまま鳴らして、読んだものを数える。**
   *
   *   間はいちばん短い 0.5 秒にしてある —— 6秒で何周も回るので、
   *   1周ぶんの偶然では緑にならない。
   */
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
    await 声をすりかえる(page, [['eas.qrRadioMode', 'jaen'], ['eas.qrRadioGap', '500']])
    await page.goto(`http://localhost:${PORT}/__bar.html?screen=qrradio`,
      { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(6000)
    const log = await page.evaluate(() => window.__log)
    await page.close()

    const 英 = log.filter((r) => 英語か(r.読んだ))
    const 和 = log.filter((r) => !英語か(r.読んだ))
    const ずれ = 英.filter((r) => r.読んだ !== r.画面)

    if (英.length < 2) {
      ng('QRの聞き流し … 読み上げが動いていない', `英 ${英.length} 回`)
    } else if (和.length > 0) {
      ng('QRの聞き流し … **日本語を読んでいる**(端末に `jaen` が残っていても読まない)',
        和.map((r) => r.読んだ.slice(0, 20)).join(' / '))
    } else if (ずれ.length > 0) {
      ng('QRの聞き流し … 読んでいる文と画面がずれている',
        ずれ.map((r) => `読「${r.読んだ.slice(0, 20)}」画面「${r.画面.slice(0, 20)}」`).join(' / '))
    } else {
      ok(`QRの聞き流し … 英語だけを、画面とそろって読む(${英.length} 文・日本語は0回)`)
    }
  }

  /* ── **間の設定は、本当に効いているか**(2026-09 利用者の指定)──────
   *
   *   > 単語帳もだが、間の時間設定もできるようにしてくれ。
   *
   *   **欄が出ているだけでは足りない。** 選んだ値が `radioSteps()` にも
   *   語と語のあいだにも届いていなければ、**押しても何も変わらない**
   *   (しかも音は鳴るので、押した人には分からない)。
   *   だから**同じ時間だけ鳴らして、読んだ回数を数える。**
   */
  {
    const 数える = async (gap) => {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
      await 声をすりかえる(page, [['eas.radioMode', 'en'], ['eas.radioGap', String(gap)]])
      await page.goto(`http://localhost:${PORT}/__bar.html?screen=radio`,
        { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(6000)
      const log = await page.evaluate(() => window.__log)
      await page.close()
      return log.length
    }
    const 短い = await 数える(500)
    const 長い = await 数える(3000)
    if (短い < 4) {
      ng('間 … 読み上げが動いていない', `${短い} 回`)
    } else if (短い <= 長い * 1.5) {
      ng('間 … 長さを変えても、鳴る速さが変わっていない',
        `0.5秒 ${短い} 回 / 3秒 ${長い} 回(6秒のあいだ)`)
    } else {
      ok(`間 … 選んだ長さが本当に効く(6秒で 0.5秒 ${短い} 回 / 3秒 ${長い} 回)`)
    }
  }

  /* ── **違う語へ移るときの間を、本当に測る**(2026-09 実機・利用者の指定)
   *
   *   > 違う単語に移る際の間を 0.5 秒くらいまで縮められませんか?
   *   > 同じ単語の2回繰り返す際の間は今のままでOKです
   *
   *   **回数を数えるだけでは足りない。** 上の見張りは「長さを変えたら
   *   鳴る速さが変わるか」しか見ないので、**語のあいだだけが 1 秒に
   *   戻っていても緑のまま**になる(実際、そこが 965ms だったことに
   *   何か月も気づけなかった)。だから**鳴り終わりから次の鳴り始めまで**を
   *   1つずつ数え、**同じ語のときと、別の語のとき**で分ける。
   *
   *   **両方を見る。** 「別の語」だけを見ると、
   *   利用者が「今のままでOK」と言った**同じ語のあいだまで縮めても**
   *   緑になる。 */
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
    await page.addInitScript(() => {
      try {
        localStorage.setItem('eas.radioMode', 'en')
        /* **既定(1.5秒)で測る。** 利用者が「1秒くらいある」と言ったのは
           この状態である(選び直していない人に、いちばん効く) */
        localStorage.removeItem('eas.radioGap')
      } catch { /* 使えなくても困らない */ }
      window.__log = []
      const voices = [{ name: 'T EN', lang: 'en-US' }]
      const fake = {
        getVoices: () => voices,
        cancel: () => {},
        speak: (u) => {
          window.__log.push({ t: performance.now(), kind: 'start', text: u.text })
          setTimeout(() => {
            window.__log.push({ t: performance.now(), kind: 'end', text: u.text })
            u.onend?.()
          }, 300)
        },
        speaking: false, pending: false, paused: false,
        addEventListener: () => {}, removeEventListener: () => {},
      }
      Object.defineProperty(window, 'speechSynthesis', { value: fake, configurable: true })
      window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t } }
    })
    await page.goto(`http://localhost:${PORT}/__bar.html?screen=radio`,
      { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(9000)
    const log = await page.evaluate(() => window.__log)
    await page.close()

    const 同じ語 = []
    const 別の語 = []
    for (let i = 0; i + 1 < log.length; i += 1) {
      if (log[i].kind !== 'end' || log[i + 1].kind !== 'start') continue
      const ms = Math.round(log[i + 1].t - log[i].t)
      ;(log[i].text === log[i + 1].text ? 同じ語 : 別の語).push(ms)
    }
    /* **1本目は数えない。** 立ち上がりのぶんが乗る(実測で +400ms ほど) */
    const 平均 = (a) => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : null)
    const 別 = 平均(別の語.slice(1))
    const 同 = 平均(同じ語)
    if (別の語.length < 2 || 同じ語.length < 2) {
      ng('間 … 語のあいだを測れていない', `別 ${別の語.length} / 同 ${同じ語.length}`)
    } else if (別 > 420) {
      /* **2026-09 にもう一段詰めた**(利用者の指定「違う単語同士の間を
         もっと詰めれませんか？もっとサクサク読み上げてほしいです」)。
         965 → 536 → **268ms**。しきい値も一緒に下げる ——
         下げないと、**戻しても緑のまま**になる */
      ng('間 … 違う語へ移るときの間が長すぎる(もっとサクサク)', `${別}ms`)
    } else if (同 < 400) {
      /* **同じ語の2回のあいだは、一度も動かしていない**
         (「今のままでOKです」)。**ついでに縮めない** */
      ng('間 … 同じ語を2回読むあいだまで縮んでいる(「今のままでOK」)', `${同}ms`)
    } else {
      ok(`間 … 違う語へ移るとき ${別}ms(965 → 536 → いま)`
        + ` / 同じ語の2回のあいだ ${同}ms(今のまま)`)
    }
  }

  /* **画面が本当に呼んでいるか。** 検証の入り口(`__screens.jsx`)だけ
     直しても、利用者の画面からは入れない */
  {
    const src = readFileSync(new URL('../src/components/Wordbook.jsx', import.meta.url), 'utf8')
      .replace(/\/\*[\s\S]*?\*\/|\{\/\*[\s\S]*?\*\/\}/g, '')
    const qr = readFileSync(new URL('../src/components/QrReview.jsx', import.meta.url), 'utf8')
      .replace(/\/\*[\s\S]*?\*\/|\{\/\*[\s\S]*?\*\/\}/g, '')
    if (!/<WordRadio\b/.test(src)) {
      ng('聞き流し … 単語帳から入れない')
    } else if (!/onClick=\{listen\}/.test(src)) {
      ng('聞き流し … 入口のボタンが無い')
    } else if (!/<WordRadio\b/.test(qr) || !/onClick=\{listen\}/.test(qr)) {
      /* **Quick Response からも入れるか。** 検証の入り口だけ直しても、
         利用者の画面からは入れない(単語帳とまったく同じ落とし穴) */
      ng('聞き流し … Quick Response から入れない')
    } else {
      ok('聞き流し … 単語帳と Quick Response の「出す」のとなりから入れる')
    }
  }
}

// ══════════════════════════════════════════════════════════════════════
// 文法解説(SVOC と修飾要素・0051・2026-09 利用者の指定)
//
//   > 文章ごとにSVOCと修飾要素についての解説をしてくれる、
//   > 文法解説モードが欲しい。
//
// **色は5つに分けず、「骨組み(S/V/O/C)か、飾り(M)か」の2つだけ**を
// 目で分ける(`GrammarNote.jsx` に理由を書いてある)。
// つまり**その2つが本当に見分けられるか**が、この画面の成否である。
// ソースを読んでも分からないので、**描いて色を測る。**
//
// あわせて、集中モードの紙の上にいることを確かめる ——
// ここは**紙の島**なので、色を決め打ちすると
// **暗い配色で黒い紙に黒い文字**になる(CLAUDE.md で何度も踏んだ穴)。
// ══════════════════════════════════════════════════════════════════════
{
  for (const dark of [false, true]) {
    for (const w of [1280, 390, 320]) {
      const page = await browser.newPage({ viewport: { width: w, height: 844 } })
      await page.goto(`http://localhost:${PORT}/__bar.html?screen=gnote`,
        { waitUntil: 'networkidle' })
      if (dark) await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
      await page.waitForTimeout(250)
      const got = await page.evaluate(() => {
        const cs = (el) => (el ? window.getComputedStyle(el) : null)
        const rgb = (v) => (String(v).match(/\d+/g) ?? []).slice(0, 3).map(Number)
        /* 見えるかどうかは、**地との差**で見る。
           人の目のおおよその明るさ(ITU-R BT.601)で比べる */
        const lum = (v) => { const [r, g, b] = rgb(v); return (r * 299 + g * 587 + b * 114) / 1000 }
        const paper = document.querySelector('.focus-paper')
        const parts = [...document.querySelectorAll('.gnote-part')]
        const roles = parts.map((p) => {
          const tag = p.querySelector('.gnote-r')
          return {
            役: tag?.textContent?.trim().slice(0, 1) ?? '',
            骨組み: p.classList.contains('gnote-part--core'),
            地: cs(tag).backgroundColor,
            文字: cs(tag).color,
            枠: cs(tag).borderTopStyle,
          }
        })
        const en = document.querySelector('.gnote-en')
        const note = document.querySelector('.gnote-note')
        return {
          紙: paper ? cs(paper).backgroundColor : '',
          紙のあかるさ: paper ? lum(cs(paper).backgroundColor) : null,
          役: roles.map((r) => ({
            ...r,
            地のあかるさ: lum(r.地), 文字のあかるさ: lum(r.文字),
            透明: /rgba?\([^)]*,\s*0\)/.test(r.地),
          })),
          文の数: document.querySelectorAll('.gnote-item').length,
          文型: [...document.querySelectorAll('.gnote-pat')].map((x) => x.textContent.trim()),
          説明のあかるさ: note ? lum(cs(note).color) : null,
          // **横にはみ出していないか。** かたまりは折り返す約束である
          よこ: en ? en.scrollWidth - en.clientWidth : 0,
          右: en ? Math.round(en.getBoundingClientRect().right) : 0,
        }
      })
      await page.close()
      const 名 = `文法解説(${w}px・${dark ? '暗い' : '明るい'})`
      const 骨 = got.役.filter((r) => r.骨組み)
      const 飾 = got.役.filter((r) => !r.骨組み)
      const 差 = (a) => Math.abs(a.文字のあかるさ - a.地のあかるさ)
      const 紙差 = (a) => Math.abs(a.文字のあかるさ - got.紙のあかるさ)

      if (got.文の数 !== 2) {
        ng(`${名} … 文が2つ出ていない`, String(got.文の数))
      } else if (got.文型.length !== 2 || !got.文型[0].includes('第3文型')) {
        ng(`${名} … 文型の眉が出ていない`, got.文型.join(' / '))
      } else if (骨.length !== 6 || 飾.length !== 2) {
        // 骨組み S/V/O + S/V/O = 6、飾り M + M = 2
        ng(`${名} … 骨組みと飾りの数が合わない`, `骨 ${骨.length} / 飾 ${飾.length}`)
      } else if (骨.some((r) => 差(r) < 40)) {
        ng(`${名} … 骨組みの札が、地と近すぎて読めない`,
          骨.map((r) => `${r.役}:${Math.round(差(r))}`).join(' '))
      } else if (飾.some((r) => 紙差(r) < 40)) {
        ng(`${名} … 飾り(M)の札が、紙と近すぎて読めない`,
          飾.map((r) => `${r.役}:${Math.round(紙差(r))}`).join(' '))
      } else if (!飾.every((r) => r.透明 && r.枠 === 'dashed')) {
        /* **塗りを2つ並べない。** 飾りは枠線だけにする決まりである
           (ここが塗りに戻ると、骨組みと飾りが見分けられなくなる) */
        ng(`${名} … 飾り(M)が、枠線だけになっていない`,
          飾.map((r) => `${r.地}/${r.枠}`).join(' '))
      } else if (Math.abs(骨[0].地のあかるさ - 飾[0].地のあかるさ) < 8) {
        ng(`${名} … 骨組みと飾りの地が、同じに見える`,
          `${骨[0].地} / ${飾[0].地}`)
      } else if (got.説明のあかるさ == null
        || Math.abs(got.説明のあかるさ - got.紙のあかるさ) < 40) {
        ng(`${名} … 日本語の説明が、紙と近すぎて読めない`,
          `${Math.round(got.説明のあかるさ ?? -1)} / 紙 ${Math.round(got.紙のあかるさ)}`)
      } else if (got.よこ > 0 || got.右 > w) {
        ng(`${名} … 横にはみ出している`, `${got.よこ}px / 右 ${got.右}`)
      } else {
        ok(`${名} … 骨組みと飾りが見分けられ、はみ出しも無い`)
      }
    }
  }

  /* **画面が本当に呼んでいるか。** 検証の入り口(`__screens.jsx`)だけ
     直しても、利用者の画面からは出てこない。
     **「名前が出てくるか」で見ない** —— 説明の中にも同じ語がある */
  {
    const src = readFileSync(new URL('../src/components/FocusReader.jsx', import.meta.url), 'utf8')
      .replace(/\/\*[\s\S]*?\*\/|\{\/\*[\s\S]*?\*\/\}/g, '')
    if (!/<GrammarNote sentences=\{gramHere\}/.test(src)) {
      ng('文法解説 … 集中モードから出てこない')
    } else if (!/view === 'grammar' \?/.test(src)) {
      ng('文法解説 … 見せ方の切り替えに入っていない')
    } else {
      ok('文法解説 … 集中モードの「訳を見る」の次に出てくる')
    }
  }
}

// ══════════════════════════════════════════════════════════════════════
// 文法30日集中講座 + 基礎単語(0052・2026-09 利用者の指定)
//
//   > pre basic と basic に基礎単語習得モードとか文法30日集中講座などが欲しい
//
// **30日ぶんのカードが縦に並ぶ画面**なので、狭い端末で
// 押せる大きさを割っていないか・横にはみ出していないかは、
// **ソースを読んでも分からない。描いて測る。**
//
// **「出る」と「出ない」の両方を見る**(CLAUDE.md) ——
// 30日そろっていることと、開いたときに語と例文が出ることの両方。
// ══════════════════════════════════════════════════════════════════════
{
  for (const w of [1280, 390, 320]) {
    const page = await browser.newPage({ viewport: { width: w, height: 900 } })
    await page.goto(`http://localhost:${PORT}/__bar.html?screen=course`,
      { waitUntil: 'networkidle' })
    await page.waitForTimeout(250)
    // 1日目を開く。**開かないと中身が描かれない**
    await page.click('.course-day:first-child .course-open')
    await page.waitForTimeout(200)
    const got = await page.evaluate(() => {
      const px = (el) => (el ? Math.round(el.getBoundingClientRect().height) : 0)
      const right = (el) => (el ? Math.round(el.getBoundingClientRect().right) : 0)
      const opens = [...document.querySelectorAll('.course-open')]
      const body = document.querySelector('.course-body')
      return {
        日数: opens.length,
        段: [...document.querySelectorAll('.course-head .chip')].map((c) => c.textContent.trim()),
        帯: document.querySelector('.course-bar') ? 1 : 0,
        押せる高さ: Math.min(...opens.map(px)),
        例文: body ? body.querySelectorAll('.course-ex > li').length : 0,
        訳: body ? [...body.querySelectorAll('.course-ja')].every((x) => x.textContent.trim()) : false,
        語: body ? body.querySelectorAll('.course-words > li').length : 0,
        ボタン低さ: body
          ? Math.min(...[...body.querySelectorAll('button')].map(px))
          : 0,
        // **横にはみ出していないか**
        よこ: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        右: Math.max(0, ...opens.map(right), ...(body ? [right(body)] : [])),
      }
    })
    await page.close()
    const 名 = `30日講座(${w}px)`
    if (got.日数 !== 30) {
      ng(`${名} … 30日そろっていない`, String(got.日数))
    } else if (got.段.length !== 2 || !got.段[0].includes('基本360語')) {
      ng(`${名} … 段が2つ出ていない`, got.段.join(' / '))
    } else if (!got.帯) {
      ng(`${名} … 進み具合の帯が無い`)
    } else if (got.押せる高さ < 44) {
      ng(`${名} … 日のカードが、押せる大きさ(44px)を割っている`, String(got.押せる高さ))
    } else if (got.例文 < 3 || !got.訳) {
      ng(`${名} … 例文か、その訳が出ていない`, `${got.例文} 文 / 訳 ${got.訳}`)
    } else if (got.語 !== 12) {
      // Pre-Basic で開くので「基本360語」= 1日 12 語
      ng(`${名} … その日の語が 12 語ではない`, String(got.語))
    } else if (got.ボタン低さ < 34) {
      ng(`${名} … 中のボタンが、押せる大きさ(34px)を割っている`, String(got.ボタン低さ))
    } else if (got.よこ > 0 || got.右 > w) {
      ng(`${名} … 横にはみ出している`, `${got.よこ}px / 右 ${got.右}`)
    } else {
      ok(`${名} … 30日そろい、語も例文も出て、はみ出しも無い`)
    }
  }

  /* **画面が本当に呼んでいるか。** 検証の入り口(`__screens.jsx`)だけ
     直しても、利用者の画面からは入れない。
     **「名前が出てくるか」で見ない** —— 説明の中にも同じ語がある */
  {
    const src = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
      .replace(/\/\*[\s\S]*?\*\/|\{\/\*[\s\S]*?\*\/\}/g, '')
    if (!/<BasicsCourse me=\{profile\} \/>/.test(src)) {
      ng('30日講座 … メニューから開けない')
    /* **改行をまたげる形で見る。** `pages` の行は説明(`desc`)が付いて
       複数行になった(2026-09・ホーム)。1行の形で探していたので、
       **中身は1文字も変わっていないのに赤くなった** */
    /* **トレーナーに出さない、かつ指定したゲストにだけ出す**(0055)。
       > これは、トレーナー側から指定したゲストにのみ映るようにしてください */
    } else if (!/!isTrainer && basicsOn\)\) && \{\s*id: 'course', label: '30日講座'/.test(src)) {
      ng('30日講座 … ゲスト専用 / 指定したゲストだけ、になっていない')
    } else {
      ok('30日講座 … 指定したゲストのメニューから開ける')
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     基礎単語(0053・2026-09 利用者の指定)

       > 講座の中の単語はそれぞれ基本360語、標準1200語、として
       > そもそもが独立して選べる単語帳にしてください

     **2026-09 に役目が1つになった**(利用者の指定「基礎単語360/1200も
     業種別の横に置いてください」)。段の札は**冊の側**(`.wb-tiers`)へ
     移り、ここは**「自分の単語帳にも入れる」だけ**になった
     (0053 の `add_basic_words()` は道具ごと残してある)。

     **描かないと分からないこと**を測る ——
     ①畳んだときに中身が1つも出ていないか(単語帳の頭が長くならない)
     ②**段の札がここに残っていないか**(同じものを2か所に見せない)
     ③**何が起きるかが押す前に書いてあるか**(お金の話も)
     ④押せる大きさを割っていないか ⑤横にはみ出していないか

     **「出る」と「出ない」の両方を見る**(CLAUDE.md) ——
     ①だけだと欄ごと消しても緑、③だけだと出しっぱなしでも緑になる。
     ══════════════════════════════════════════════════════════════════ */
  for (const w of [1280, 390, 320]) {
    const page = await browser.newPage({ viewport: { width: w, height: 900 } })
    await page.goto(`http://localhost:${PORT}/__bar.html?screen=basicpick`,
      { waitUntil: 'networkidle' })
    await page.waitForTimeout(250)
    // ① 畳んでいるあいだは、中身が1つも出ていない
    const 畳 = await page.evaluate(() => ({
      中身: document.querySelectorAll('.basicpick .wb-add-body').length,
      入口: document.querySelector('.basicpick .wb-add-open')?.textContent.trim() ?? '',
    }))
    await page.click('.basicpick .wb-add-open')
    await page.waitForTimeout(200)
    const got = await page.evaluate(() => {
      const px = (el) => (el ? Math.round(el.getBoundingClientRect().height) : 0)
      const right = (el) => (el ? Math.round(el.getBoundingClientRect().right) : 0)
      const btn = document.querySelector('.basicpick .btn--primary')
      return {
        // **段の札は、ここには無い**(冊の `.wb-tiers` が持っている)
        札: document.querySelectorAll('.basicpick .chip').length,
        すすめ: document.querySelector('.basicpick-lead')?.textContent.trim() ?? '',
        走る: btn?.textContent.trim() ?? '',
        走る高さ: px(btn),
        よこ: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        右: Math.max(0, ...(btn ? [right(btn)] : [])),
      }
    })
    await page.close()
    const 名 = `基礎単語(${w}px)`
    if (畳.中身 !== 0) {
      ng(`${名} … 畳んでいるのに、中身が出ている`, String(畳.中身))
    } else if (!畳.入口.includes('入れる')) {
      ng(`${名} … 畳んだ入口が、何をする欄なのか言っていない`, 畳.入口)
    } else if (got.札 !== 0) {
      // **段は冊の側にある。** 2か所に置くと食い違う
      ng(`${名} … 段の札が、この欄に残っている`, String(got.札))
    } else if (!got.すすめ.includes('お金はかかりません')
      || !got.すすめ.includes('1つも戻りません')) {
      ng(`${名} … 何が起きるかが、押す前に書かれていない`, got.すすめ)
    } else if (!got.すすめ.includes('基本360語')) {
      ng(`${名} … 受け取った段の名前を言っていない`, got.すすめ)
    } else if (!got.走る.includes('入れる')) {
      ng(`${名} … 走らせるボタンが、何をするか言っていない`, got.走る)
    } else if (got.走る高さ < 40) {
      ng(`${名} … 押せる大きさを割っている`, `ボタン ${got.走る高さ}`)
    } else if (got.よこ > 0 || got.右 > w) {
      ng(`${名} … 横にはみ出している`, `${got.よこ}px / 右 ${got.右}`)
    } else {
      ok(`${名} … 畳めて、開けば何が起きるかも出て、はみ出しも無い`)
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     **この人に出す冊**(0057 / 第5.186節・2026-09 実機)

       > ゲストの単語帳（トレーナーアカウント）で、業界別の単語帳を
       > アサインできません。アサインしたい単語帳を選んだ後にできることが
       > なにもありませんし、アサインされる様子もありません。

     出どころは**知らせの置き場所**だった。成功も失敗も画面のいちばん上
     (`message` / `error`)に出していたので、**単語帳のタブまで送った人には
     1文字も見えなかった**(CLAUDE.md「失敗の知らせは、その操作をした
     場所に出す」)。

     **いまは「冊をえらぶ」と同じ 1行1冊**(第5.186節・利用者の指定
     「説明は一才必要ありません」「単語帳とquick responseの冊を選ぶ方法と
     同じ仕様に」)。業種べつの 35 冊は、**その行を開いた中**にある。

     **「欄がある」だけを見ない。** 選んでも何も起きない形に戻しても
     緑のままになる。**開いて、押して、札が増えるか・結果がこの場に出るか**
     まで数える。
     ══════════════════════════════════════════════════════════════════ */
  for (const w of [1280, 390, 320]) {
    const page = await browser.newPage({ viewport: { width: w, height: 900 } })
    await page.goto(`http://localhost:${PORT}/__bar.html?screen=assign`,
      { waitUntil: 'networkidle' })
    await page.waitForTimeout(250)

    /* **畳んだままの形**を先に測る。ここが利用者の見る形である。

       **「いちばん上のカード」で引かない**(第5.238節で踏んだ)——
       ゲストを選ぶカードが上に増えた日に、**単語帳の冊が0行に見えて
       赤くなった。** 画面の並びは変わってよいので、
       **冊の行を持っているカード**を名指しで引く */
    const 畳 = await page.evaluate(() => {
      const card = [...document.querySelectorAll('.card')]
        .find((c) => c.querySelector('.shelf-row'))
      const rows = [...card.querySelectorAll('.shelf-row')]
      return {
        行: rows.length,
        文言: rows.map((r) => (r.querySelector('.shelf-name')?.textContent ?? '').trim()),
        印: rows.map((r) => (r.querySelector('.shelf-mark')?.textContent ?? '').trim()),
        /* **押せる大きさを割らない**(CLAUDE.md) */
        低い行: Math.round(Math.min(...rows
          .map((r) => r.querySelector('.shelf-pick').getBoundingClientRect().height), 999)),
        /* **説明は1つも出していない**(利用者の指定)。
           `.field-hint` も `.tip` も、畳んだ形には1つも無い */
        説明: card.querySelectorAll('.field-hint, .tip').length,
        /* **中身は、開くまで出さない** */
        中身: card.querySelectorAll('.shelf-sub').length,
        知らせ: card.querySelectorAll('.notice').length,
        よこ: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      }
    })

    /* **開いてみる。** 35 冊はこの中にある */
    await page.evaluate(() => {
      for (const b of document.querySelectorAll('.card .shelf-pick')) {
        if (b.getAttribute('aria-expanded') === 'false') b.click()
      }
    })
    await page.waitForTimeout(200)

    const 前 = await page.evaluate(() => {
      const card = [...document.querySelectorAll('.card')]
        .find((c) => c.querySelector('.shelf-row'))
      const sel = card.querySelector('.shelf-sub select')
      if (!sel) return null
      const r = sel.getBoundingClientRect()
      return {
        冊: sel.querySelectorAll('optgroup option').length,
        空: (sel.querySelector('option[value=""]')?.textContent ?? '').trim(),
        組: [...sel.querySelectorAll('optgroup')].map((g) => g.label),
        札: card.querySelectorAll('.shelf-sub .chip--on').length,
        /* **札も押すもの。** 36px を割らない(CLAUDE.md) */
        札高: Math.round(Math.min(...[...card.querySelectorAll('.shelf-sub .chip--on')]
          .map((c) => c.getBoundingClientRect().height), 999)),
        知らせ: card.querySelectorAll('.notice').length,
        高さ: Math.round(r.height),
        右: Math.round(r.right),
        よこ: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      }
    })

    /* **選んでみる。** ここがこの見張りの本体である */
    let 後 = null
    if (前) {
      const v = await page.evaluate(() => {
        const sel = document.querySelector('.card .shelf-sub select')
        return sel?.querySelector('optgroup option')?.value ?? ''
      })
      await page.selectOption('.card .shelf-sub select', v)
      await page.waitForTimeout(200)
      後 = await page.evaluate(() => {
        const card = [...document.querySelectorAll('.card')]
          .find((c) => c.querySelector('.shelf-row'))
        const n = card.querySelector('.notice')
        return {
          札: card.querySelectorAll('.shelf-sub .chip--on').length,
          知らせ: (n?.textContent ?? '').trim(),
          /* **知らせは、この欄の中にいるか。**
             画面のいちばん上へ戻すと、ここが 0 になる */
          中: card.querySelectorAll('.notice').length,
          /* **数も、印も、出した数に付いてくる**(説明のかわりに数が言う) */
          数: (card.querySelector('.shelf-row--on .shelf-n')?.textContent ?? '').trim(),
          よこ: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        }
      })
    }
    await page.close()

    const 名 = `冊を出す(${w}px)`
    if (畳.行 !== 2) {
      /* 文法30日集中講座と基礎単語 + 業種べつの単語帳。
         **冊を足したら、ここも直す** */
      ng(`${名} … 単語帳の冊が2行そろっていない`, `${畳.行} 行 / ${畳.文言.join(' / ')}`)
    } else if (!畳.文言.some((t) => t.includes('業種べつ'))) {
      ng(`${名} … 「業種べつの単語帳」の行が無い`, 畳.文言.join(' / '))
    } else if (!畳.印.includes('●') || !畳.印.includes('○')) {
      /* **出している冊と、出していない冊の両方**が印で読み取れるか。
         **色だけに頼らない**(CLAUDE.md)。片方だけだと、
         **全部 ● にする形・全部 ○ にする形**に壊しても緑になる */
      ng(`${名} … 出している / いないの印が読み取れない`, 畳.印.join(' / '))
    } else if (畳.説明 !== 0) {
      ng(`${名} … 畳んだ形に説明が出ている(${畳.説明} 個)`,
        '利用者の指定は「説明は一才必要ありません」である')
    } else if (畳.中身 !== 0) {
      ng(`${名} … 畳んでいるのに、冊の中身が出ている`, String(畳.中身))
    } else if (畳.知らせ !== 0) {
      ng(`${名} … 押す前から知らせが出ている`, String(畳.知らせ))
    } else if (畳.低い行 < 44) {
      ng(`${名} … 行が押せる大きさを割っている`, String(畳.低い行))
    } else if (畳.よこ > 0) {
      ng(`${名} … 畳んだ形で横にはみ出している`, `${畳.よこ}px`)
    } else if (!前) {
      ng(`${名} … 行を開いても、棚をえらぶ欄が出ない`)
    } else if (前.冊 !== 34) {
      /* 35冊 − すでに出している1冊。**分野を足したら、ここも直す** */
      ng(`${名} … 足せる棚が34冊そろっていない`, String(前.冊))
    } else if (前.組.length !== 2
      || !前.組.includes('お仕事') || !前.組.includes('趣味・娯楽')) {
      ng(`${名} … お仕事と趣味・娯楽に分かれていない`, 前.組.join(' / '))
    } else if (!前.空.includes('すぐ出します')) {
      ng(`${名} … 「えらぶと、すぐ出します」が無い`,
        '**選んだ瞬間に出す。** 言わないと「選んだあと、できることがない」と読める')
    } else if (前.高さ < 40) {
      ng(`${名} … プルダウンが押せる大きさを割っている`, String(前.高さ))
    } else if (前.札高 < 36) {
      ng(`${名} … 札が押せる大きさを割っている`, String(前.札高))
    } else if (前.よこ > 0 || 前.右 > w) {
      ng(`${名} … 横にはみ出している`, `${前.よこ}px / 右 ${前.右}`)
    } else if (後.札 !== 前.札 + 1) {
      ng(`${名} … えらんでも札が増えない(${前.札} → ${後.札})`,
        '**選んだ瞬間に出す。** ここが増えないと「アサインされる様子がない」')
    } else if (後.中 === 0 || !後.知らせ.includes('出しました')) {
      ng(`${名} … 押した結果が、この欄に出ない`,
        `${後.中} 件 / 「${後.知らせ}」 —— 画面のいちばん上に出すと、`
        + '単語帳のタブまで送った人には見えない')
    } else if (後.数 !== `${後.札} 冊`) {
      /* **説明のかわりに、数が言う**(第5.186節)。
         「いま何冊出しているか」が行に出ていないと、
         **開くまで分からない**(消した説明が、本当に要らなかったと言えない) */
      ng(`${名} … 行に出している冊数が出ていない`, `「${後.数}」/ 札 ${後.札}`)
    } else if (後.よこ > 0) {
      ng(`${名} … えらんだあと横にはみ出す`, `${後.よこ}px`)
    } else {
      ok(`${名} … 畳んで2行(${畳.印.join('')}・説明0)、`
        + `開くと34冊から1つえらべて札が ${前.札} → ${後.札}、`
        + `行に「${後.数}」、結果もその場に出る`)
    }
  }


  /* **画面が本当に置いているか。** 検証の入り口(`__screens.jsx`)だけ
     直しても、利用者の画面には出ない */
  {
    const tl = readFileSync(new URL('../src/components/TrainerLearners.jsx', import.meta.url), 'utf8')
      .replace(/\/\*[\s\S]*?\*\/|\{\/\*[\s\S]*?\*\/\}/g, '')
    if (!/<AssignShelf\s/.test(tl)) {
      ng('冊を出す … ゲストのページに置かれていない',
        '**「アサインする」の画面とまったく同じ部品**(第5.186節)')
    } else if ((tl.match(/<AssignShelf\s/g) ?? []).length !== 2) {
      /* **単語帳のタブと Quick Response のタブ、2つとも。**
         片方だけだと、振り分け(`group`)を壊しても気づけない */
      ng('冊を出す … ゲストのページの2つのタブに置かれていない',
        `${(tl.match(/<AssignShelf\s/g) ?? []).length} 個`)
    } else if (!/onShelf=\{\(sh\) => pickShelf\(l, sh\)\}/.test(tl)) {
      ng('冊を出す … 押しても何も起きない形になっている',
        '`onShelf` を渡さないと、えらんでも1冊も出ない')
    } else if (!/note=\{wordNote\}/.test(tl) || !/note=\{qrNote\}/.test(tl)) {
      ng('冊を出す … 知らせを渡していない',
        '**その操作をした場所に出す** —— 渡さないと、また画面の上にしか出ない')
    } else if (!/\{ quiet: true \}/.test(tl)) {
      ng('冊を出す … 上の帯にも同じ知らせを出している',
        '**同じものを2か所に出さない**(CLAUDE.md)')
    } else {
      ok('冊を出す … ゲストのページも、同じ `AssignShelf` に任せている')
    }
  }

  /* **画面が本当に置いているか。** 検証の入り口(`__screens.jsx`)だけ
     直しても、利用者の単語帳には出ない */
  {
    const src = readFileSync(new URL('../src/components/Wordbook.jsx', import.meta.url), 'utf8')
      .replace(/\/\*[\s\S]*?\*\/|\{\/\*[\s\S]*?\*\/\}/g, '')
    if (!/<BasicWordsPick\s/.test(src)) {
      ng('基礎単語 … 単語帳の画面に置かれていない')
    } else if (!/\{basicBook && \(\s*<BasicWordsPick/.test(src)) {
      ng('基礎単語 … 「自分の単語帳にも入れる」が、この冊の中に置かれていない')
    } else if (!/<BasicWordsPick tier=\{tier\}/.test(src)) {
      ng('基礎単語 … 段を渡していない(欄の中でもう一度選ばせない)')
    /* **指定したゲストにだけ出す**(0055)。30日講座とまったく同じ判断を
       受け取る —— **2つで1つ**なので、片方だけ出さない。
       2026-09 に、見る場所が「畳んだ欄を出すか」から
       「冊を並べるか」へ移った(判断の渡り方は1文字も変わっていない) */
    /* **`hasSub` が付いた**(第5.173節)。見ているのは
       「`showBasics` のときだけ並べるか」で、そこは1文字も変わっていない */
    } else if (!/showBasics \? \[\{ id: 'basic', label: '基礎単語'/.test(src)) {
      ng('基礎単語 … 指定したゲストだけ、になっていない')
    } else if (!/showBasics=\{basicsOn\}/.test(
      readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
        .replace(/\/\*[\s\S]*?\*\/|\{\/\*[\s\S]*?\*\/\}/g, ''),
    )) {
      ng('基礎単語 … App が判断(basicsOn)を渡していない')
    } else {
      ok('基礎単語 … 指定したゲストの単語帳から、その段だけを練習できる')
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     業種べつの単語帳(棚・0057・2026-09 利用者の指定)

       > 何冊も違う単語帳を持てるようにしてほしいんです。…
       > 「自分の単語帳に追加する」みたいのを押したものだけ
       > 自分の単語帳に追加されてほしいんです。

     **2026-09 に、チェックの一覧をプルダウンへ改めた**(利用者の指定)。

       > こんなに沢山のチェックリストは必要ありません。アサインされた
       > 業種のものだけがプルダウンで表示されれば十分です。
       > ここはアサインするための場所ではないので。

     **描かないと分からないこと**を測る ——
     ①**35冊が選択肢にそろっているか**(+「分野をえらぶ」)
     ②お仕事と趣味・娯楽に分かれているか
     ③いま開いている冊が選ばれているか
     ④押せる大きさ(40px)を割っていないか ⑤横にはみ出していないか

     **「出る」と「出ない」の両方を見る**(CLAUDE.md)——
     **前のチェックの一覧(`.shelfbook`)が残っていないか**も数える。
     ══════════════════════════════════════════════════════════════════ */
  for (const w of [1280, 390, 320]) {
    const page = await browser.newPage({ viewport: { width: w, height: 900 } })
    await page.goto(`http://localhost:${PORT}/__bar.html?screen=shelfpick`,
      { waitUntil: 'networkidle' })
    await page.waitForTimeout(250)
    const got = await page.evaluate(() => {
      const sel = document.querySelector('.shelfbooks select')
      if (!sel) return null
      const r = sel.getBoundingClientRect()
      return {
        冊: sel.querySelectorAll('optgroup option').length,
        空: (sel.querySelector('option[value=""]')?.textContent ?? '').trim(),
        組: [...sel.querySelectorAll('optgroup')].map((g) => g.label),
        いま: sel.value,
        名: (sel.selectedOptions[0]?.textContent ?? '').trim(),
        高さ: Math.round(r.height),
        右: Math.round(r.right),
        // **前のチェックの一覧が残っていないか**(道具ごと消してある)
        古い: document.querySelectorAll('.shelfbook, .shelfbooks-list').length,
        よこ: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      }
    })
    await page.close()
    const 名 = `棚(${w}px)`
    if (!got) {
      ng(`${名} … プルダウンが描かれない`)
    } else if (got.古い !== 0) {
      ng(`${名} … チェックの一覧が残っている`,
        '2026-09 にプルダウンへ改めた。**値を偽にせず、道具ごと消す**')
    } else if (got.冊 !== 35) {
      // **分野を足せば棚も1冊増える。** 数が変わったら、ここも直す
      ng(`${名} … 棚が35冊そろっていない`, String(got.冊))
    } else if (!got.空.includes('分野をえらぶ')) {
      ng(`${名} … 「分野をえらぶ」が無い`,
        '一度開いたら戻せなくなる(**行き止まりを作らない**)')
    } else if (got.組.length !== 2
      || !got.組.includes('お仕事') || !got.組.includes('趣味・娯楽')) {
      ng(`${名} … お仕事と趣味・娯楽に分かれていない`, got.組.join(' / '))
    } else if (got.いま !== 'it' || !got.名.includes('語')) {
      ng(`${名} … いま開いている冊が選ばれていない(${got.いま} / ${got.名})`,
        '選択肢には語数も出す(0 語なら、まだ空の棚だと分かる)')
    } else if (got.高さ < 40) {
      ng(`${名} … 押せる大きさを割っている`, String(got.高さ))
    } else if (got.よこ > 0 || got.右 > w) {
      ng(`${名} … 横にはみ出している`, `${got.よこ}px / 右 ${got.右}`)
    } else {
      ok(`${名} … 35冊が2組に分かれたプルダウン1つ(${got.高さ}px)`)
    }
  }

  /* **画面が本当に置いているか。** 検証の入り口(`__screens.jsx`)だけ
     直しても、利用者の単語帳には出ない */
  {
    const src = readFileSync(new URL('../src/components/Wordbook.jsx', import.meta.url), 'utf8')
      .replace(/\/\*[\s\S]*?\*\/|\{\/\*[\s\S]*?\*\/\}/g, '')
    const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
      .replace(/\/\*[\s\S]*?\*\/|\{\/\*[\s\S]*?\*\/\}/g, '')
    if (!/<ShelfBooks\s/.test(src)) {
      ng('棚 … 単語帳の画面に置かれていない')
    } else if (!/setShelfWordStatus\(row\.shelf/.test(src)) {
      ng('棚 … 答えを棚の側に書き戻していない(混ざる)')
    } else if (/<ShelfPick\s|addShelfWords/.test(src)) {
      ng('棚 … 自分の単語帳へ混ぜる道が残っている')
    } else if (!/shelves=\{myShelves\}/.test(app)) {
      ng('棚 … App が、その人に出す棚を渡していない')
    } else {
      ok('棚 … 指定した棚だけが、独立した単語帳として並ぶ')
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     **トレーナー自身の単語帳から、棚を自由に学べるか**(2026-09 利用者の指定)

       > これらの単語帳はトレーナーアカウントでは独立した単語帳として
       > 自由に学習できるようにして下さい。

     判断は `showsShelf()` 1か所で、**ゲスト以外にはぜんぶ出す**。
     ところが「出す」と決めてあっても、**画面に切り替えが無ければ
     たどり着けない。** ここは**描いて数える。**

     **「出る」と「出ない」の両方を見る**(CLAUDE.md)——
     ①トレーナー自身の単語帳(`?screen=mybook`)には切り替えが出て、
       押せば35冊が並ぶ
     ②**既定は自分の単語帳**で、そのあいだ棚の欄は1つも出ていない
       (**混ざらないことが、この機能の要である**)
     ③棚も基礎単語も渡していない画面(`?screen=wordbook`)には、
       切り替えごと出ない

   **基礎単語(3冊目)も、この行で測る**(2026-09 利用者の指定)。

     > 基礎単語360/1200も業種別の横に置いてください。

   **置き場所は帯の `冊名 ▾` へ移った**(第5.167節)。だから
   **押して本棚を開いてから**数える —— 札が4つ並んでいるか、
   押したときに**段の切り替え(`.wb-tiers`)がその行の中に出て**、
   語がそのまま並ぶかまで見る。0053 では「まず入れる」を押すまで
   1語も出なかった。
     ══════════════════════════════════════════════════════════════════ */
  /** 帯の `冊名 ▾` を押して、本棚を開く。
      **いちばん後ろの1つを押す** —— 復習に入っていると
      (第5.167節「開いた瞬間に1問目」)、帯の側があとに描かれる */
  const 本棚を開く = 本棚をひらく
  /** 本棚から1冊えらぶ(えらぶと、本棚は閉じる) */
  const 冊をえらぶ = async (pg, 名) => {
    await 本棚を開く(pg)
    await pg.locator('.shelf-pick', { hasText: 名 }).first().click()
    await pg.waitForTimeout(450)
  }
  for (const w of [1280, 390]) {
    const page = await browser.newPage({ viewport: { width: w, height: 900 } })
    await page.goto(`http://localhost:${PORT}/__bar.html?screen=mybook`,
      { waitUntil: 'networkidle' })
    /* **`冊名 ▾` が出るまで待つ。** 決め打ちの 300ms では、
       語が届く前に測ってしまい「帯に冊名が出ていない」と誤って赤くなる
       (語を渡すようにして、問い合わせが1往復増えたため) */
    await page.waitForSelector('.bookpick', { timeout: 10000 })
    await page.waitForTimeout(300)

    /* **帯に冊名が出ているか。** トップ画面が無くなったので、
       ここが消えると**いまどの帳面をやっているか分からなくなる** */
    const 帯 = (await page.locator('.bookpick').last().textContent() ?? '').trim()
    await 本棚を開く(page)
    const 初 = await page.evaluate(() => ({
      札: [...document.querySelectorAll('.shelf-pick')]
        .map((b) => (b.querySelector('.shelf-name')?.textContent ?? '').trim()),
      押: [...document.querySelectorAll('.shelf-pick')]
        .filter((b) => b.getAttribute('aria-current') === 'true')
        .map((b) => (b.querySelector('.shelf-name')?.textContent ?? '').trim()),
      棚: document.querySelectorAll('.shelfbooks').length,
    }))
    await page.keyboard.press('Escape')
    await page.waitForTimeout(250)

    let 開 = { 冊: 0, 低い: 0, よこ: 0 }
    if (初.札.length === 4) {
      await 冊をえらぶ(page, '業種べつ')
      /* **プルダウンで数える**(2026-09 にチェックの一覧から改めた)。
         ここで 35 冊そろうのは、**骨組みが `shelfList()` を直に渡している**
         ためである(`__screens.jsx`)—— 実際の画面では
         `shelvesFor()` が「出された冊だけ」に絞る(0059)。
         **測っているのは「渡した冊が1冊残らず並ぶか」**であって、
         誰に何冊出すかではない(そちらは `npm run test:play`)。
         **棚の欄は、本棚の「業種べつ」の行の中**にある(第5.167節) */
      await 本棚を開く(page)
      開 = await page.evaluate(() => {
        const sel = document.querySelector('.shelf-sub .shelfbooks select')
        return {
          冊: sel ? sel.querySelectorAll('optgroup option').length : 0,
          低い: sel ? Math.round(sel.getBoundingClientRect().height) : 0,
          よこ: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        }
      })
      // **戻せるか。** 戻したら棚の欄は消える(混ざらない)
      await page.locator('.shelf-pick', { hasText: '自分の単語帳' }).first().click()
      await page.waitForTimeout(350)
      await 本棚を開く(page)
    }
    const 戻 = await page.evaluate(() => document.querySelectorAll('.shelfbooks').length)
    await page.close()

    /* ── 3冊目(基礎単語)。**押したら、そのまま語が並ぶか** ──────
       段は2つ(基本360語 / 標準1200語)。**段を切り替えたら、
       語の数もその段のものになる** —— そこまで数えないと、
       札だけ出して中身が変わらない形に書き換えても緑のままになる */
    let 基 = { 段: [], 語: 0, 語2: 0, 低い: 0, よこ: 0, 棚: 1 }
    if (初.札.length === 4) {
      const page2 = await browser.newPage({ viewport: { width: w, height: 900 } })
      await page2.goto(`http://localhost:${PORT}/__bar.html?screen=mybook`,
        { waitUntil: 'networkidle' })
      await page2.waitForSelector('.bookpick', { timeout: 10000 })
      await page2.waitForTimeout(300)
      await 冊をえらぶ(page2, '基礎単語')
      await 本棚を開く(page2)
      基 = await page2.evaluate(() => {
        /* **段は、本棚の「基礎単語」の行の中**(第5.167節)。
           `.shelf-sub` の中を見ることで、**その冊の行に入っているか**まで数える */
        const tab = [...document.querySelectorAll('.shelf-sub .wb-tiers .chip')]
        return {
          段: tab.map((b) => b.textContent.replace(/\s+/g, ' ').trim()),
          /* **語の数は3枚の札から数える**(まだ / 練習中 / できた)。
             一覧(`.wordbook-row`)は段を押したときだけ出るので、
             既定の画面では0になる —— **見えているもので数える** */
          語: [...document.querySelectorAll('.wb-stat strong')]
            .reduce((a, b) => a + Number(b.textContent || 0), 0),
          語2: 0,
          低い: tab.length
            ? Math.min(...tab.map((b) => Math.round(b.getBoundingClientRect().height))) : 0,
          よこ: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          // **棚の欄は出ていない**(混ざらない)
          棚: document.querySelectorAll('.shelfbooks').length,
        }
      })
      // 段を「標準1200語」へ。**語の数がその段のものになるか**
      for (const b of await page2.$$('.shelf-sub .wb-tiers .chip')) {
        if (((await b.textContent()) ?? '').includes('1200')) { await b.click(); break }
      }
      await page2.waitForTimeout(700)
      基.語2 = await page2.evaluate(
        () => [...document.querySelectorAll('.wb-stat strong')]
          .reduce((a, b) => a + Number(b.textContent || 0), 0),
      )
      await page2.close()
    }

    const 名 = `トレーナーの単語帳(${w}px)`
    if (!帯.replace('▾', '').trim()) {
      // **帯に冊名が出ていないと、冊を間違えたまま進む**(第5.167節)
      ng(`${名} … 帯に冊名が出ていない`, 帯 || '(無し)')
    /* **3冊が1冊にまとまった**(第5.199節)。コロケーション / 名詞句 /
       副詞句は「ビジネス必須チャンク集」の中の段になった。
       **決まりは同じ** —— 本棚に冊が並んでいるか、を見ている */
    } else if (初.札.join(' / ')
      !== '自分の単語帳 / 業種べつ / 基礎単語 / ビジネス必須チャンク集') {
      ng(`${名} … 本棚に冊が並んでいない`, 初.札.join(' / ') || '(無し)')
    } else if (初.押.join('') === '自分の単語帳') {
      /* **この土台では、自分の単語帳が 0 語である**(第5.200節で分かった)——
         `?screen=mybook` は `learnerId` を渡さない「自分の単語帳」なので、
         ログインした人がいないと窓口を1回も呼ばず、語が1つも入らない。
         だから**中身のある冊へ移っているのが正しい。**

         **「既定は自分の単語帳」のほうは、語がある土台で見る**
         (第5.200節の「語があれば移らない」)。**どちらも残してある** ——
         片方だけだと、いつも移る形・一度も移らない形のどちらに
         書き換えても緑のままになる */
      ng(`${名} … 自分の単語帳が空なのに、空のまま開いている`,
        '第5.200節「空の冊に降ろさない」が効いていない')
    } else if (初.棚 !== 0) {
      ng(`${名} … 自分の単語帳なのに、棚の欄が出ている(混ざって見える)`)
    } else if (開.冊 !== 35) {
      // **分野を足せば棚も1冊増える。** 数が変わったら、ここも直す
      ng(`${名} … 35冊そろっていない`, String(開.冊))
    } else if (開.低い < 40) {
      ng(`${名} … 押せる大きさを割っている`, String(開.低い))
    } else if (開.よこ > 0) {
      ng(`${名} … 横にはみ出している`, `${開.よこ}px`)
    } else if (戻 !== 0) {
      ng(`${名} … 自分の単語帳に戻しても、棚の欄が残っている`)
    } else if (基.段.length !== 2) {
      ng(`${名} … 基礎単語の段(基本360語 / 標準1200語)が、その冊の行の中に出ていない`,
        基.段.join(' / ') || '(無し)')
    } else if (!基.段[0].includes('360') || !基.段[1].includes('1200')) {
      ng(`${名} … 段に語数が出ていない`, 基.段.join(' / '))
    } else if (基.棚 !== 0) {
      ng(`${名} … 基礎単語なのに、棚の欄が出ている(混ざって見える)`)
    } else if (基.語 < 300) {
      // **「まず入れる」を押さなくても、そのまま並ぶ**(2026-09 の指定)
      ng(`${名} … 基礎単語の語が並んでいない`, `${基.語} 語`)
    } else if (基.語2 <= 基.語) {
      ng(`${名} … 段を変えても語が入れ替わっていない`, `${基.語} → ${基.語2}`)
    } else if (基.低い < 36) {
      ng(`${名} … 段の札が押せる大きさを割っている`, String(基.低い))
    } else if (基.よこ > 0) {
      ng(`${名} … 基礎単語で横にはみ出している`, `${基.よこ}px`)
    } else {
      ok(`${名} … 帯の「${帯.replace('▾', '').trim()}」から、`
        + '渡した 35 冊と基礎単語が1冊残らず開ける')
    }
  }

  /* **冊が1つしか無い画面には、えらぶ場所ごと出さない**
     (効かない操作を見せない)。ゲストの単語帳をトレーナーが開いたときは、
     そのゲストに指定された棚だけが渡る —— **1冊も無ければ、ここは空。**
     基礎単語も 0055 で外されていれば同じである */
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
    await page.goto(`http://localhost:${PORT}/__bar.html?screen=wordbook`,
      { waitUntil: 'networkidle' })
    await page.waitForTimeout(300)
    const n = await page.evaluate(() => document.querySelectorAll('.bookpick').length)
    await page.close()
    if (n !== 0) ng('棚 … 出す棚が1冊も無いのに、冊をえらぶ場所が出ている', String(n))
    else ok('棚 … 出す棚が無い単語帳には、えらぶ場所を出さない')
  }
}

/* ══════════════════════════════════════════════════════════════════════
 * スピーチ練習(0054・2026-09 利用者の指定)
 *
 *   > ゲストアカウントのスピーチ内から受け取ったスピーチの原稿をAIにより
 *   > 添削し、そしてその文の音声を作成、ゲスト側で練習できる機能です。
 *   > そして、単語帳にはスピーチの単語帳も作ります。
 *
 * **描かないと分からないこと**を測る ——
 *   ①直した英文が1文ずつ番号つきで並ぶか(紙と同じ丸)
 *   ②1文ずつに Listen があるか(**その文の音声**)
 *   ③「訳を見る」で**入れ替わる**か(並べない・箱が2倍にならない)
 *   ④押せる大きさを割っていないか ⑤横にはみ出していないか
 *
 * **「出る」と「出ない」の両方を見る**(CLAUDE.md) ——
 * ③は「訳が出る」だけを見ると、**英文と並べて出しても緑**になる。
 * だから**英文が消えていること**まで数える。
 * ══════════════════════════════════════════════════════════════════════ */
for (const w of [1280, 390, 320]) {
  const page = await browser.newPage({ viewport: { width: w, height: 900 } })
  await page.goto(`http://localhost:${PORT}/__bar.html?screen=speech`,
    { waitUntil: 'networkidle' })
  await page.waitForTimeout(250)
  const got = await page.evaluate(() => {
    const px = (el) => (el ? Math.round(el.getBoundingClientRect().height) : 0)
    const right = (el) => (el ? Math.round(el.getBoundingClientRect().right) : 0)
    const rows = [...document.querySelectorAll('.speech-sentences > li')]
    /* **押すものそのものを測る。** 語は1つずつ `<button>` で描いてあり
       (`EnglishText`)、`Stepper` の三角は 28px でよいと決めてある。
       `button` をぜんぶ数えると、**押せる大きさの検証にならない** */
    const btns = [...document.querySelectorAll('.speech-practice .btn')]
    return {
      文: rows.length,
      番号: rows.map((r) => r.querySelector('.num-badge')?.textContent.trim() ?? ''),
      聴く: rows.filter((r) => /Listen|Stop/.test(r.textContent)).length,
      英: rows.filter((r) => r.querySelector('.writing-en')).length,
      訳: rows.filter((r) => r.querySelector('.writing-ja')).length,
      通し: document.querySelector('.speech-bar .btn--primary')?.textContent.trim() ?? '',
      直し: document.querySelectorAll('.writing-notes > li').length,
      語句: document.querySelectorAll('.writing-phrases > li').length,
      案内: document.querySelector('.speech-tolist')?.textContent.trim() ?? '',
      小: Math.min(...btns.map(px)),
      よこ: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      右: Math.max(0, ...btns.map(right),
        ...rows.map(right)),
    }
  })
  // ③ 「訳を見る」で**入れ替わる**(並べない)
  await page.click('.speech-swap')
  await page.waitForTimeout(150)
  const 訳 = await page.evaluate(() => ({
    英: document.querySelectorAll('.speech-sentences .writing-en').length,
    訳: document.querySelectorAll('.speech-sentences .writing-ja').length,
    札: document.querySelector('.speech-swap')?.textContent.trim() ?? '',
  }))

  /* ── **集中モード**(2026-09 利用者の指定「今のままに集中モードだけつけて」)──
     **「出る」と「出ない」の両方を見る**(CLAUDE.md)。
     開く前に `.focus` があってはいけない(勝手に集中モードで始まらない)。 */
  const 前 = await page.evaluate(() => document.querySelectorAll('.focus').length)
  await page.click('.speech-swap')          // **英語に戻してから**開く
  await page.click('.speech-focus-open')
  await page.waitForTimeout(200)
  const 集 = await page.evaluate(() => {
    const el = document.querySelector('.focus.speechfocus')
    const rows = [...document.querySelectorAll('.speechfocus .speech-sentences > li')]
    return {
      開く: !!el,
      紙: !!document.querySelector('.speechfocus .focus-paper'),
      文: rows.length,
      英: rows[0]?.querySelector('.writing-en')?.textContent.trim() ?? '',
      聴く: rows.filter((r) => /Listen|Stop/.test(r.textContent)).length,
      数: document.querySelector('.speechfocus .focus-count')?.textContent.trim() ?? '',
      速さ: !!document.querySelector('.speechfocus .stepper'),
      よこ: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }
  })
  /* **送れるか。** 1文ずつ出す画面なので、送れないと2文目へ行けない */
  await page.click('.speechfocus .focus-bar > .btn:last-child')
  await page.waitForTimeout(150)
  const 次 = await page.evaluate(() => ({
    数: document.querySelector('.speechfocus .focus-count')?.textContent.trim() ?? '',
    英: document.querySelector('.speechfocus .writing-en')?.textContent.trim() ?? '',
  }))
  /* **戻る道。** 閉じられないと行き止まりになる */
  await page.click('.speechfocus .focus-exit')
  await page.waitForTimeout(150)
  const 閉 = await page.evaluate(() => document.querySelectorAll('.focus').length)
  await page.close()

  const 名 = `スピーチ(${w}px)`
  if (got.文 !== 2) {
    ng(`${名} … 直した英文が1文ずつ並んでいない`, String(got.文))
  } else if (got.番号.join('/') !== '1/2') {
    ng(`${名} … 文に番号(紙と同じ丸)が付いていない`, got.番号.join('/'))
  } else if (got.聴く !== 2) {
    ng(`${名} … 1文ずつの Listen が無い`, String(got.聴く))
  } else if (!got.通し.includes('Listen (全体)')) {
    ng(`${名} … 通しの Listen が無い`, got.通し)
  } else if (got.英 !== 2 || got.訳 !== 0) {
    ng(`${名} … はじめは英語だけを出す`, `英 ${got.英} / 訳 ${got.訳}`)
  } else if (訳.訳 !== 2 || 訳.英 !== 0) {
    // **並べない。入れ替える**(集中モードの訳と同じ決まり)
    ng(`${名} … 訳を出したのに、英文が並んだまま`, `英 ${訳.英} / 訳 ${訳.訳}`)
  } else if (!訳.札.includes('英語に戻す')) {
    ng(`${名} … 戻る道が同じボタンに出ていない`, 訳.札)
  } else if (got.直し !== 1 || got.語句 !== 2) {
    ng(`${名} … 直したところ・覚えたい語句が出ていない`, `${got.直し} / ${got.語句}`)
  } else if (!got.案内.includes('スピーチの語句')) {
    // **単語帳からまとめて練習できることを、その場で言う**
    ng(`${名} … 単語帳への行き先が書かれていない`, got.案内)
  } else if (got.小 < 34) {
    ng(`${名} … 押せる大きさを割っている`, `${got.小}px`)
  } else if (got.よこ > 0 || got.右 > w) {
    ng(`${名} … 横にはみ出している`, `${got.よこ}px / 右 ${got.右}`)
  } else if (前 !== 0) {
    // **勝手に集中モードで始まらない**(押したときだけ開く)
    ng(`${名} … 開いた瞬間から集中モードになっている`, String(前))
  } else if (!集.開く || !集.紙) {
    ng(`${名} … 集中モードが開かない(黒い地に白い紙)`, `${集.開く} / 紙 ${集.紙}`)
  } else if (集.文 !== 1) {
    // **1つずつ出す。** これが集中モードの役目そのものである
    ng(`${名} … 集中モードで1文だけになっていない`, String(集.文))
  } else if (集.数 !== '1 / 2 文') {
    ng(`${名} … 集中モードに「何文めか」が出ていない`, 集.数)
  } else if (集.聴く !== 1 || !集.速さ) {
    ng(`${名} … 集中モードに Listen / 速さが無い`, `${集.聴く} / 速さ ${集.速さ}`)
  } else if (集.よこ > 0) {
    ng(`${名} … 集中モードが横にはみ出している`, `${集.よこ}px`)
  } else if (次.数 !== '2 / 2 文' || 次.英 === 集.英) {
    // **送ると、本当に別の文が出る**(数字だけ動いても意味がない)
    ng(`${名} … 集中モードで次の文へ送れない`, `${次.数} / 同じ文 ${次.英 === 集.英}`)
  } else if (閉 !== 0) {
    ng(`${名} … 集中モードから戻れない(行き止まり)`, String(閉))
  } else {
    ok(`${名} … 1文ずつ聴けて、訳は入れ替わり、集中モードも1文ずつ`)
  }
}

/* **画面が本当に置いているか。** 検証の入り口(`__screens.jsx`)だけ
   直しても、利用者の画面には出ない。
   **「名前が出てくるか」で見ない** —— 説明にも同じ語があるので、
   **使っている形**で見る(CLAUDE.md) */
{
  const noC = (t) => t.replace(/\/\*[\s\S]*?\*\/|\{\/\*[\s\S]*?\*\/\}/g, '')
  const pron = noC(readFileSync(
    new URL('../src/components/PronunciationPractice.jsx', import.meta.url), 'utf8'))
  const learners = noC(readFileSync(
    new URL('../src/components/TrainerLearners.jsx', import.meta.url), 'utf8'))
  const wb = noC(readFileSync(
    new URL('../src/components/Wordbook.jsx', import.meta.url), 'utf8'))
  if (!/<SpeechBoard level=\{me\?\.cefr/.test(pron)) {
    /* **レベルはゲストのものを使う**(2026-09 利用者の指定)。
       渡さなくなると、**画面は普通に出るのに B1 で添削される**ので気づけない */
    ng('スピーチ … 「スピーチ練習」の画面に置かれていない / レベルを渡していない')
  } else if (!/<SpeechBoard learnerId=\{l\.id\} learnerName=\{l\.display_name\}\s+level=\{l\.cefr/.test(learners)) {
    ng('スピーチ … ゲストのページに置かれていない / そのゲストのレベルを渡していない')
  } else if (!/<option value="speech">スピーチ<\/option>/.test(learners)) {
    ng('スピーチ … ゲストのページの切り替えに出ていない')
  } else if (!/onPicked=\{onPickWords\}/.test(wb) || !/<SpeechWordsPick\s/.test(wb)) {
    ng('スピーチ … 単語帳に「スピーチの語句」が置かれていない')
  } else {
    ok('スピーチ … 3つの画面(スピーチ練習 / ゲストのページ / 単語帳)に置いてある')
  }
}

/* ══════════════════════════════════════════════════════════════════════
 * 「この文の要点」は、**紙にも刷る**(2026-09 実機・利用者の指定)
 *
 *   > 今でも存在しているけど印刷すると「この文の要点」が消えてしまいます。
 *   > 印刷されるようにしてください。そしてボールドと下線で強調
 *
 * **`no-print` が付いていた。** それを外すだけでは足りない ——
 * 札は1つずつ `<button>` なので、`@media print` の
 * `button:not(.etext-word) { display: none }` が**札だけを消す。**
 * すると**見出しの「この文の要点」だけが紙に残る**、いちばん分かりにくい形になる。
 *
 * **ソースを読むだけでは分からない。** 2つの指定が噛み合っているかは、
 * **印刷の見え方をそのまま描いて測る**しかない(`emulateMedia`)。
 *
 * **「出る」と「出ない」の両方を見る**(CLAUDE.md) ——
 * 札が出ることと、**吹き出しが紙に出ないこと**の両方を数える。
 * ══════════════════════════════════════════════════════════════════════ */
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  await page.goto(`http://localhost:${PORT}/__bar.html?role=trainer&who=g1`,
    { waitUntil: 'networkidle' })
  await page.waitForTimeout(300)
  /* **本物の `printElement()` と同じ印を付ける。**
     `is-printing` / `print-target` / `print-path` の3つがそろって
     初めて紙の指定が効く(`src/lib/print.js`) */
  await page.evaluate(() => {
    const sheet = document.querySelector('#lesson-sheet') ?? document.querySelector('.lesson-sheet')
    if (!sheet) return
    sheet.classList.add('print-target')
    document.body.classList.add('is-printing')
    for (let el = sheet.parentElement; el && el !== document.body; el = el.parentElement) {
      el.classList.add('print-path')
    }
  })
  await page.emulateMedia({ media: 'print' })
  await page.waitForTimeout(200)

  const got = await page.evaluate(() => {
    const 見える = (el) => !!el && el.checkVisibility?.() !== false
      && el.getBoundingClientRect().height > 0
    const chips = [...document.querySelectorAll('.print-target .phrase-chip')]
    const label = document.querySelector('.print-target .phrases-label')
    const one = chips[0]
    const cs = one ? window.getComputedStyle(one) : null
    return {
      見出し: 見える(label),
      札の数: chips.filter(見える).length,
      文字: one?.textContent?.trim() ?? '',
      太さ: cs?.fontWeight ?? '',
      下線: cs?.textDecorationLine ?? '',
      枠: cs?.borderTopWidth ?? '',
      色: cs?.color ?? '',
      吹き出し: [...document.querySelectorAll('.etext-pop')].filter(見える).length,
    }
  })
  await page.close()

  if (!got.見出し || got.札の数 === 0) {
    ng('紙 … 「この文の要点」が刷られていない',
      `見出し ${got.見出し ? '有' : '無'} / 札 ${got.札の数} 個`)
  } else if (Number(got.太さ) < 600) {
    ng('紙 … 要点の札が太字になっていない', `font-weight ${got.太さ}`)
  } else if (!/underline/.test(got.下線)) {
    ng('紙 … 要点の札に下線が無い', got.下線 || '(無し)')
  } else if (got.枠 !== '0px') {
    /* **紙では錠剤の枠を落とす。** 残すと枠だけが目立って中身が読みにくい
       (「囲みも帯も増やさない。字づかいだけで層を分ける」) */
    ng('紙 … 要点の札に錠剤の枠が残っている', `border ${got.枠}`)
  } else if (got.色 !== 'rgb(0, 0, 0)') {
    /* **紙の灰色は、画面の値をそのまま持ってこない**(CLAUDE.md) */
    ng('紙 … 要点の札が黒で刷られない', got.色)
  } else if (got.吹き出し > 0) {
    ng('紙 … 開いたままの吹き出しが刷られる', `${got.吹き出し} 個`)
  } else {
    ok(`紙 … 「この文の要点」が太字 + 下線で刷られる(${got.札の数} 個・${got.文字})`)
  }
}

/* ══════════════════════════════════════════════════════════════════════
 * 単語帳 / Quick Response 帳の紙(2026-09 利用者の指定)
 *
 *   > フォーマットは、左に日本語、右に英語が来るようにしてください。
 *   > 教材を印刷、PDFにした時のクイックレスポンの部分と同じ仕様です
 *
 * **ソースを読むだけでは分からない。** 「左が日本語・右が英語」は
 * CSS の格子(`grid-template-columns: 1fr 1fr`)で決まっており、
 * しかも **`@media print` の `.print-target …` の中にしか無い。**
 * 印が付いていなければ1つも当たらないので、
 * **印刷の見え方をそのまま描いて測る**しかない。
 *
 * 印は画面の側(`markPrint()`)が付ける ——
 * ここで付け直すと、**付け方を2通り持つ**ことになる(CLAUDE.md)。
 *
 * **「出る」と「出ない」の両方を見る** ——
 * 左右に並んでいることだけを見ると、**縦に積む形に戻しても
 * 「日本語も英語も出ている」で緑のまま**になる。
 *
 * 【**幅は1つだけ見ない**】(2026-09 実機・利用者の指摘)
 *
 *   > 単語帳を印刷した際に、現状は上に日本語、下に英語、という
 *   > デザインになるのですが
 *
 *   ここは **1280px でしか測っていなかった。** ところが CSS には
 *   `@media (max-width: 120mm)` で**1列に畳む**指定があり(こちらが
 *   確かめずに書いたもの)、**453px 以下でだけ**上下に積んでいた。
 *   つまり**不具合が実在するあいだ、この検証はずっと緑だった。**
 *   「無ければ素通りする検証を書かない」の、幅の版である。
 *   **狭い紙(スマホから刷ったとき)まで測る。**
 * ══════════════════════════════════════════════════════════════════════ */
/* ══════════════════════════════════════════════════════════════════════
   **紙は A4。中身は用紙幅を使い切る**(2026-09 実機・利用者の指定)

     > 紙のサイズはデフォルトで何になっていますか？A4にしてください。
     > プレビューだとちょうどよい余白に見えるのに、
     > 実際に印刷すると余白がすごく大きいです。

   **サイズはもとから A4 だった。** 広かったのは `@page` の余白のほうで、
   16/14/18mm は**紙の 13.3% を捨てて**いた(いまは 12/10/14mm = 9.5%)。

   **いまは `size: auto` である**(第5.248節・2026-09-23 実機)。
   用紙の大きさをこちらで決めると、印刷機の紙と食い違ったときに
   「入るように縮める」が働き、**中身だけが小さくなる。**
   `auto` なら印刷機の紙のままで組むので、縮めるものが無い。
   **余白と中身の幅は、これまでどおり A4(210mm)を物差しに測る** ——
   設計として想定している紙は変わっていない。

   **「A4 と書いてあるか」だけを見ない** —— それだと、余白を
   30mm に広げても緑のままになる。**中身が用紙幅を使い切っているか**まで
   描いて測る(`.print-target` が縮んでいれば、そのぶん余白が増える)。

   **赤チェックは、`@media print` に指定を足す形でやらない。**
   `body.is-printing .print-target { max-width: none !important }` が
   必ず勝つので、**壊れていないのに壊したつもり**になる(実際に踏んだ)。
   壊すなら**その打ち消しそのもの**を `560px` などにする。
   ══════════════════════════════════════════════════════════════════════ */
{
  const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8')
  const m = css.match(/@page\s*\{\s*size:\s*([A-Za-z0-9]+);\s*margin:\s*([^;}]+)[;}]/)
  const MM = 96 / 25.4
  if (!m) {
    ng('紙 … `@page { size: … ; margin: … }` が見つからない')
  } else if (m[1] !== 'auto') {
    /* **紙の大きさを決め打ちしない**(第5.248節)。
       `A4` と書くと、印刷機の紙と食い違ったときに縮む */
    ng('紙 … 用紙の大きさを決め打ちしている(印刷機で縮む元になる)', m[1])
  } else {
    ok('紙 … 用紙の大きさは印刷機にまかせている(size: auto)')
    /* 「12mm 10mm 14mm」→ 上 / 左右 / 下 */
    const mm = m[2].trim().split(/\s+/).map((v) => parseFloat(v))
    const [上, 左右, 下] = [mm[0], mm[1], mm[2] ?? mm[0]]
    const 幅 = 210 - 左右 * 2
    const 割合 = 幅 / 210 * 100
    if (!(左右 >= 10)) {
      /* **プリンタは端 5〜6.4mm を刷れない。** 割ると端が切れる */
      ng('紙 … 左右の余白が 10mm を割っている(端が切れる)', `${左右}mm`)
    } else if (!(下 >= 12)) {
      /* 下には**ページ番号と紙の名前**(9pt)が入る */
      ng('紙 … 下の余白が足りない(ページ番号が入らない)', `${下}mm`)
    } else if (割合 < 88) {
      ng('紙 … 中身に使える幅が狭すぎる', `${幅}mm(${割合.toFixed(1)}%)`)
    } else {
      ok(`紙 … A4 / 余白 上${上} 左右${左右} 下${下}mm`
        + ` → 中身 ${幅}mm(${割合.toFixed(1)}%)`)

      /* **描いて測る。** 中身が本当にその幅を使い切っているか ——
         `max-width` や `padding` が残っていると、紙の上でそのぶん余る */
      const W = Math.round(幅 * MM)
      const page = await browser.newPage({ viewport: { width: W, height: 1000 } })
      await page.goto(`http://localhost:${PORT}/__bar.html?screen=sheet`,
        { waitUntil: 'networkidle' })
      await page.waitForTimeout(300)
      await page.emulateMedia({ media: 'print' })
      await page.waitForTimeout(200)
      const got = await page.evaluate(() => {
        const t = document.querySelector('.print-target')
        if (!t) return null
        const cs = window.getComputedStyle(t)
        const 行 = [...t.querySelectorAll('li, p')]
          .map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0)
        return {
          幅: Math.round(t.getBoundingClientRect().width),
          maxW: cs.maxWidth, padL: cs.paddingLeft, padR: cs.paddingRight,
          右端: 行.length ? Math.round(Math.max(...行.map((r) => r.right))) : 0,
          窓: document.documentElement.clientWidth,
        }
      })
      await page.close()
      if (!got) {
        ng('紙 … 印刷の中身(`.print-target`)が描かれない')
      } else if (got.幅 < got.窓) {
        ng('紙 … 中身が用紙幅を使い切っていない',
          `${got.幅}px / 紙 ${got.窓}px(max-width ${got.maxW} padding ${got.padL}/${got.padR})`)
      } else if (got.右端 < got.窓 - 24) {
        /* 24px(約 6mm)まではふつうの行末。それ以上余るなら、何かが縮めている */
        ng('紙 … 本文が右まで届いていない', `右端 ${got.右端}px / 紙 ${got.窓}px`)
      } else {
        ok(`紙 … 中身が用紙幅を使い切っている(${got.幅}px = ${幅}mm・余り 0)`)
      }
    }
  }
}

for (const W of [1280, 794, 453, 390, 320]) {
  const page = await browser.newPage({ viewport: { width: W, height: 900 } })
  await page.goto(`http://localhost:${PORT}/__bar.html?screen=sheet`,
    { waitUntil: 'networkidle' })
  await page.waitForTimeout(300)
  await page.emulateMedia({ media: 'print' })
  await page.waitForTimeout(200)

  const got = await page.evaluate(() => {
    const 見える = (el) => !!el && el.checkVisibility?.() !== false
      && el.getBoundingClientRect().height > 0
    const rows = [...document.querySelectorAll('.print-target ol.qrsheet-list > li')]
    const 行 = rows.map((li) => {
      const ja = li.querySelector('.qrsheet-ja')
      /* **英語そのものを測る。** `.qrsheet-en` は囲みになっていて、
         中に品詞とレベルの札も入る(2026-09) */
      const en = li.querySelector('.qrsheet-word')
      const tag = li.querySelector('.qrsheet-tags')
      const jb = ja?.getBoundingClientRect()
      const eb = en?.getBoundingClientRect()
      const tb = tag?.getBoundingClientRect()
      return {
        ja: ja?.textContent?.trim() ?? '',
        en: en?.textContent?.trim() ?? '',
        札: tag ? tag.textContent.trim() : '',
        /* **箱そのものが在るか**も見る。中身が空の札を出しても
           高さが 0 になるので、見えるかどうかでは見分けられない */
        札の箱: !!tag,
        札X: tb ? Math.round(tb.left) : null,
        札大きさ: tag ? parseFloat(window.getComputedStyle(tag).fontSize) : null,
        語大きさ: en ? parseFloat(window.getComputedStyle(en).fontSize) : null,
        jaX: jb ? Math.round(jb.left) : null,
        enX: eb ? Math.round(eb.left) : null,
        jaY: jb ? Math.round(jb.top) : null,
        enY: eb ? Math.round(eb.top) : null,
        番号: window.getComputedStyle(li, '::before').content,
      }
    })
    const head = document.querySelector('.print-target .print-head')
    return {
      印: document.body.classList.contains('is-printing'),
      行,
      見出し: 見える(head) ? head.textContent.trim() : '',
      /* ページの下に出す題は **DOM に無い**(`@page` の余白の箱)。
         `<html>` に置いたカスタムプロパティを、そのまま読む */
      下の題: document.documentElement.style.getPropertyValue('--sheet-name').trim(),
      はみ出し: document.documentElement.scrollWidth
        > document.documentElement.clientWidth + 1,
    }
  })
  await page.close()

  const 並ぶ = got.行.filter((r) => r.jaX !== null && r.enX !== null)
  /* 左右に並んでいる = 英語が日本語より**右**にあり、しかも**同じ行**にいる。
     縦に積むと、英語は下(Y が違う)へ回る */
  const 左右 = 並ぶ.filter((r) => r.enX > r.jaX && Math.abs(r.enY - r.jaY) < 8)
  const 番号あり = got.行.filter((r) => r.番号 && r.番号 !== 'none' && r.番号 !== 'normal')
  const 札あり = got.行.filter((r) => r.札)
  /* **品詞もレベルも無い語に、空の札を出していないか。**
     骨組みの `gist` がそれにあたる(控えがまだ引けていない語)。
     **箱の有無で見る** —— 中身が空の札は高さ 0 になるので、
     見えるかどうかでは「出していない」と見分けが付かない */
  const 空札 = got.行.filter((r) => r.札の箱 && !r.札)

  if (!got.印) {
    ng(`紙 ${W}px … 印(\`is-printing\`)が付いていない`, '`markPrint()` が呼ばれていない')
  } else if (got.行.length !== 5) {
    ng(`紙 ${W}px … 単語帳の対が刷られていない`, `${got.行.length} 行`)
  } else if (左右.length !== 5) {
    ng(`紙 ${W}px … 左に日本語・右に英語で並んでいない`,
      並ぶ.map((r) => `ja ${r.jaX},${r.jaY} / en ${r.enX},${r.enY}`).join(' | '))
  } else if (!got.行.some((r) => r.ja === '' && r.en === 'gist')) {
    /* **訳の無い語も落とさない**(控えがまだ引けていないだけ) */
    ng(`紙 ${W}px … 訳の無い語が落ちている`, got.行.map((r) => r.en).join(' / '))
  } else if (番号あり.length !== 5) {
    ng(`紙 ${W}px … 通し番号が出ていない`, `${番号あり.length} / 5`)
  } else if (!got.見出し.includes('単語帳') || !got.見出し.includes('全 5 語')) {
    ng(`紙 ${W}px … 何の紙かが書かれていない`, got.見出し || '(無し)')
  } else if (!got.見出し.includes('ビジネス全般')) {
    /* **どの冊を刷ったのかを、題に書く**(2026-09 実機・利用者の指定)。
         > タイトルの部分を「単語」だけでなく「ビジネス一般」と
       単語帳は3冊あるので、「単語帳」だけでは刷った紙から分からない */
    ng(`紙 ${W}px … 題に、どの単語帳かが書かれていない`, got.見出し)
  } else if (!got.下の題.includes('ビジネス全般')) {
    /* ページの下の題(`@page` の余白の箱)。**2枚目から先で効く**ので、
       ここが欠けると**10 枚刷ったうちの9枚**が名無しになる */
    ng(`紙 ${W}px … どのページの下にも出す題(--sheet-name)が置かれていない`,
      got.下の題 || '(無し)')
  } else if (札あり.length !== 4) {
    /* **品詞とレベル**(2026-09 実機・利用者の指定「また、品詞とレベルも。」)。
       骨組みは**わざと1語だけ**空けてある(`gist`)—— 5つとも付けて数えると、
       **無い語にも空の札を出す形に書き換えても緑のまま**になる */
    ng(`紙 ${W}px … 品詞とレベルの札が出ていない`,
      `${札あり.length} / 4(${got.行.map((r) => r.札 || '-').join(' | ')})`)
  } else if (空札.length) {
    ng(`紙 ${W}px … 品詞もレベルも無い語に、空の札を出している`,
      空札.map((r) => r.en).join(' / '))
  } else if (!got.行.some((r) => r.札 === '熟語 · B1')) {
    ng(`紙 ${W}px … 品詞とレベルが両方そろっていない`,
      got.行.map((r) => r.札 || '-').join(' | '))
  } else if (札あり.some((r) => !(r.札大きさ < r.語大きさ))) {
    /* **添え物なので、語より先に目が行ってはいけない**(CLAUDE.md)。
       **値を書き写さない** —— 語の大きさと比べる */
    ng(`紙 ${W}px … 札が語より小さくない`,
      札あり.map((r) => `${r.札大きさ} / ${r.語大きさ}`).join(' | '))
  } else if (札あり.some((r) => r.札X <= r.enX)) {
    ng(`紙 ${W}px … 札が英語のうしろに置かれていない`,
      札あり.map((r) => `札 ${r.札X} / 英 ${r.enX}`).join(' | '))
  } else if (got.はみ出し) {
    ng(`紙 ${W}px … 横にはみ出している`)
  } else {
    const w = 並ぶ[0]
    ok(`紙 ${W}px … 左が日本語・右が英語(5 行・ja x=${w.jaX} / en x=${w.enX})`
      + ` / 題「${got.見出し.split('全 ')[0].trim()}」`
      + ` / 札 ${札あり.map((r) => r.札).join('・')}`)
  }
}

/* ══════════════════════════════════════════════════════════════════
   単語帳の紙 — **品詞ごとの小見出し / 例文 / 巻末のレクチャー**
   (2026-09 利用者の指定)

     > 単語帳のPDF化の際に、品詞ごとに並び替えて、小見出しをつけて
     > 表示されるようにしてほしい。また、例文をつける、つけないも
     > 選べるようにしたい。そして、単語帳の巻末とか間、どこでもよいけど、
     > このレクチャーを入れてただの単語帳ではなく、
     > 使いこなすことをイメージできる単語帳にしたい。

   **描いて測るしかない。** 小見出しも例文の行も巻末の紙も、
   見え方は `@media print` の中にしかない。しかも
   **通し番号を振り直していないか**は、CSS の計算結果を読むしかない
   (`::before` の中身は DOM に無い)。

   **「出る」と「出ない」の両方を見る** —— 例文は `?ex=off`、
   レクチャーは `?frames=off` でも測る。
   出るほうだけを見ると、**いつでも出す形に書き換えても緑のまま**になる。
   ══════════════════════════════════════════════════════════════════ */
{
  const 測る = async (q2) => {
    const page = await browser.newPage({ viewport: { width: 794, height: 1000 } })
    await page.goto(`http://localhost:${PORT}/__bar.html?screen=sheet${q2}`,
      { waitUntil: 'networkidle' })
    await page.waitForTimeout(300)
    await page.emulateMedia({ media: 'print' })
    await page.waitForTimeout(200)
    const got = await page.evaluate(() => {
      const 箱 = document.querySelector('.print-target .qrsheet-groups')
      const 例 = [...document.querySelectorAll('.print-target .qrsheet-ex')]
      const frames = document.querySelector('.print-target .frames-sheet')
      const 型 = [...document.querySelectorAll('.print-target ul.frames-list > li')]
      const 型1 = 型[0]
      const f = 型1?.querySelector('.frames-form')?.getBoundingClientRect()
      const e = 型1?.querySelector('.frames-ex')?.getBoundingClientRect()
      return {
        小見出し: [...document.querySelectorAll(
          '.print-target .qrsheet-groups .qrsheet-title')].map((t) => t.textContent.trim()),
        /* **番号を振り直していないか。** 包みで1度だけ数え始め、
           中の `<ol>` は打ち消す —— ここが崩れると、節ごとに 1 へ戻る */
        包みの数え始め: 箱 ? window.getComputedStyle(箱).counterReset : '(包みが無い)',
        中の数え直し: [...document.querySelectorAll(
          '.print-target .qrsheet-groups ol.qrsheet-list')]
          .map((o) => window.getComputedStyle(o).counterReset),
        例文の数: 例.length,
        /* **1本目だけを見ない。** 品詞ごとに並べ替えるので、
           1本目がどの語のものかは並びで変わる ——
           骨組みは**訳のある例文と、無い例文を1本ずつ**持たせてある */
        例文: 例.map((e) => {
          const li = e.closest('li')
          const w = li?.querySelector('.qrsheet-word')
          return {
            幅: Math.round(e.getBoundingClientRect().width),
            行の幅: Math.round(li.getBoundingClientRect().width),
            下か: e.getBoundingClientRect().top
              > (w?.getBoundingClientRect().bottom ?? 0) - 1,
            訳: !!e.querySelector('.qrsheet-exja'),
          }
        }),
        レクチャー: !!frames,
        型の数: 型.length,
        型の並び: f && e ? { 型X: Math.round(f.left), 例X: Math.round(e.left),
          同じ行: Math.abs(f.top - e.top) < 8 } : null,
        /* 巻末は**新しい紙から**(語の一覧の続きに見せない) */
        改ページ: frames ? window.getComputedStyle(frames).breakBefore : '',
        はみ出し: document.documentElement.scrollWidth
          > document.documentElement.clientWidth + 1,
      }
    })
    await page.close()
    return got
  }

  const 既定 = await 測る('')
  const 例文なし = await 測る('&ex=off')
  const 型なし = await 測る('&frames=off')

  const 欲しい小見出し = ['名詞', '動詞', '熟語・言い回し', '品詞の記録なし']
  const 見出しが合う = 欲しい小見出し.every((w, i) => 既定.小見出し[i]?.startsWith(w))

  if (既定.小見出し.length !== 4 || !見出しが合う) {
    /* **品詞ごとに分かれ、絞り込みと同じ並びで出ているか。**
       骨組みは**わざと4つの品詞**を混ぜてある —— 1つだけだと、
       **分けるのをやめても小見出しが1つ出て緑のまま**になる */
    ng('紙 … 品詞ごとの小見出しが出ていない',
      既定.小見出し.join(' / ') || '(1つも無い)')
  } else if (!/qr/.test(既定.包みの数え始め)) {
    ng('紙 … 通し番号を、包みで数え始めていない', 既定.包みの数え始め)
  } else if (既定.中の数え直し.some((c) => /qr/.test(c))) {
    /* **ここが崩れると、節ごとに番号が 1 へ戻る。**
       `::before` の中身は DOM に無いので、**計算結果で見るしかない** */
    ng('紙 … 節ごとに番号を振り直している(通し番号にならない)',
      既定.中の数え直し.join(' / '))
  } else if (既定.例文の数 !== 2) {
    /* 骨組みは**わざと2語にだけ**出会った文を付けてある ——
       5つとも付けると、**無い語にも空の行を出す形に書き換えても
       緑のまま**になる */
    ng('紙 … 例文が出ていない', `${既定.例文の数} / 2`)
  } else if (!既定.例文.every((e) => e.下か)) {
    ng('紙 … 例文が、語の下の行に置かれていない')
  } else if (!既定.例文.every((e) => e.幅 > e.行の幅 * 0.8)) {
    /* **両方の列にまたがる。** 片方の列に押し込むと、
       語の訳と例文の訳が同じ列で混ざって読めなくなる */
    ng('紙 … 例文が両方の列にまたがっていない',
      既定.例文.map((e) => `${e.幅}/${e.行の幅}`).join(' | '))
  } else if (既定.例文.filter((e) => e.訳).length !== 1) {
    /* **訳の無い例文に、空の行を作らない。**
       骨組みは**訳のある例文1本・無い例文1本**にしてある ——
       2本とも訳を持たせると、**空の訳を出す形に書き換えても緑のまま**になる */
    ng('紙 … 例文の訳の出し方が意図どおりでない',
      `訳あり ${既定.例文.filter((e) => e.訳).length} / 2 本中 1 本`)
  } else if (例文なし.例文の数 !== 0) {
    /* **「つけない」を選んだら、本当に消えるか。**
       ここを見ないと、**いつでも出す形に書き換えても緑のまま**になる */
    ng('紙 … 「例文をつけない」を選んでも、例文が残っている',
      `${例文なし.例文の数} 行`)
  } else if (例文なし.小見出し.length !== 4) {
    /* 例文をやめても、**品詞の小見出しは残る**(別の話である) */
    ng('紙 … 例文をやめると、小見出しまで消える', 例文なし.小見出し.join(' / '))
  } else if (!既定.レクチャー) {
    ng('紙 … 巻末の「英文の型」のレクチャーが出ていない')
  } else if (既定.型の数 < 60) {
    /* **型を減らさない。** `sentenceFrames.js` の 66 型がそのまま並ぶ */
    ng('紙 … 巻末のレクチャーの型が足りない', `${既定.型の数} 型`)
  } else if (!既定.型の並び?.同じ行 || !(既定.型の並び.例X > 既定.型の並び.型X)) {
    /* **型が左、例文が右。** 語の一覧と同じ向きにそろえる */
    ng('紙 … 巻末のレクチャーが「左が型・右が例文」で並んでいない',
      JSON.stringify(既定.型の並び))
  } else if (既定.改ページ !== 'page') {
    /* **新しい紙から始める。** 語の一覧の余りに続けると、
       最後の品詞の続きのように見える */
    ng('紙 … 巻末のレクチャーが、新しい紙から始まっていない', 既定.改ページ)
  } else if (型なし.レクチャー) {
    ng('紙 … レクチャーを出さない指定が効いていない')
  } else if (型なし.小見出し.length !== 4) {
    ng('紙 … レクチャーをやめると、語の一覧まで消える')
  } else if (既定.はみ出し) {
    ng('紙 … 横にはみ出している')
  } else {
    ok(`紙 … 品詞ごとの小見出し ${既定.小見出し.join('・')}`
      + ` / 通し番号は振り直さない / 例文 ${既定.例文の数} 行(訳つき 1・off で 0)`
      + ` / 巻末のレクチャー ${既定.型の数} 型`)
  }
}

/* ══════════════════════════════════════════════════════════════════
   「〜系ぜんぶ」が、本当に欄に出ているか(第5.177節・2026-09 利用者の指定)

     > 66の型ですが、実際はもっと少ないはずです。
     > 写真のように「させる系」で一つと数えた時の数に変えてください。
     > そして、選択肢に「〜系全て」を追加してください。

   **`npm run test:shift` は「書いてあるか」までしか見られない。**
   `<optgroup>` の中に `<option>` を1つ足す話なので、
   **描いてみないと、本当に選べるかは分からない**(CLAUDE.md
   「描けないものは測れない」)。

   **「出る」と「出ない」の両方を数える** —— 系ぜんぶだけになっても、
   型ひとつだけになっても赤くなるようにする。
   ══════════════════════════════════════════════════════════════════ */
{
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } })
  await page.goto(`http://localhost:${PORT}/__bar.html?screen=shift`,
    { waitUntil: 'networkidle' })
  await page.waitForTimeout(200)
  const 欄 = await page.evaluate(() => {
    /* **型の欄は、2つめの `<select>`**(1つめは「中身」)。
       名前で探さない —— 名前は画面の言葉で、変わりうる */
    const sel = [...document.querySelectorAll('.nfunits select')][1]
    if (!sel) return null
    const opts = [...sel.querySelectorAll('option')]
    return {
      組: sel.querySelectorAll('optgroup').length,
      ぜんぶ: opts.length,
      系: opts.filter((o) => /系ぜんぶ/.test(o.textContent)).length,
      /* **その系の見出しの中に入っているか**(よそに紛れていない) */
      組の中: [...sel.querySelectorAll('optgroup')]
        .filter((g) => /系ぜんぶ/.test(g.querySelector('option')?.textContent ?? '')).length,
      値: new Set(opts.map((o) => o.value)).size,
      見える: sel.checkVisibility(),
    }
  })
  if (!欄) ng('型の欄そのものが描かれていない')
  else {
    if (欄.系 === frameGroupCount()) ok(`「〜系ぜんぶ」が系の数だけ出ている(${欄.系})`)
    else ng('「〜系ぜんぶ」の数が、系の数と合わない', `${欄.系} / ${frameGroupCount()}`)
    if (欄.組 === frameGroupCount()) ok(`組の見出しも系の数だけある(${欄.組})`)
    else ng('組の見出しの数が、系の数と合わない', `${欄.組} / ${frameGroupCount()}`)
    if (欄.組の中 === frameGroupCount()) ok('「〜系ぜんぶ」は、どれもその系の先頭にある')
    else ng('「〜系ぜんぶ」が、その系の先頭に無い組がある', String(欄.組の中))
    /* **型ひとつも、これまでどおり選べる**(系ぜんぶに置き換わっていない) */
    if (欄.ぜんぶ > 欄.系 + 1) ok(`型ひとつの選択肢も残っている(${欄.ぜんぶ} 個)`)
    else ng('型ひとつが選べなくなっている', `${欄.ぜんぶ} / ${欄.系}`)
    /* **値が1つも重なっていない** —— 重なると、別のものが出る */
    if (欄.値 === 欄.ぜんぶ) ok('選択肢の値が、1つも重なっていない')
    else ng('選択肢の値が重なっている', `${欄.値} / ${欄.ぜんぶ}`)
    if (欄.見える) ok('型の欄が見えている')
    else ng('型の欄が見えていない')
  }
  await page.close()
}

/* ══════════════════════════════════════════════════════════════════
   いま誰の記録として残るか(第5.178節・2026-09 利用者の指摘)

     > ゲストページ内のそのゲストの宿題になっている教材内で単語やフレーズを
     > 単語帳に登録しているはずなのに、明らかに他のゲストが登録した単語などが
     > 入っていることがあります。しっかり分けて管理する体制にしてください。

   **読めない名札は、無いのと同じである。** はじめ `.lesson-bar-main`
   (折り返さない囲み)の中に置いたところ、320px で **26px まで潰れて**
   「…」しか見えなかった(実測)。だから帯のすぐ下の1行に移した。

   **2026-09、その1行をやめた**(利用者の指摘)。

     > 「この教材で拾った語は〜に入ります」これで１行分のスペースを
     > 使うのがもったいないです。何か代替案はありませんか？

   説明の文を消し、札だけを**折り返す `.lesson-bar` の直の子**に置いた。
   広い画面では帯と同じ行に並び(**1行まるごと浮く**)、
   狭い画面では帯の2段目へ折り返す(**潰れない**)。
   **本物のレッスン表示で測る** —— 骨組みには帯の中身が無いので、
   どんな幅でも入ってしまう(**「無ければ素通り」する形**)。

   **「出る」と「出ない」の両方を見る** —— ゲストには出さない
   (相手が自分しかいないので、効かない操作になる)。
   ══════════════════════════════════════════════════════════════════ */
{
  /* ① **本物の帯の中で**、名札が読める幅で出ているか。
       いちばん狭い画面(320px)を必ず入れる */
  for (const w of [320, 390, 1280]) {
    const page = await browser.newPage({ viewport: { width: w, height: 900 } })
    await page.goto(`http://localhost:${PORT}/__bar.html?role=trainer&who=g1`,
      { waitUntil: 'networkidle' })
    await page.waitForTimeout(400)
    const r = await page.evaluate(() => {
      const bar = document.querySelector('.lesson-bar')
      const own = document.querySelector('.lesson-owner')
      if (!bar || !own) return null
      const name = own.querySelector('.lesson-owner-name')
      return {
        はみ出し: Math.round(bar.scrollWidth - bar.clientWidth),
        /* **切れていないか。** 中身の幅より狭ければ「…」になっている */
        切れ: Math.round(name.scrollWidth - name.clientWidth),
        /* **帯の中にいるか。** 外に出ると、また1行まるごと使うことになる */
        帯の中: own.parentElement === bar,
        /* **説明の文が残っていないか**(`.claude/rules/common.md`) */
        文: bar.textContent.replace(/\s+/g, ''),
        見える: own.checkVisibility(),
        /* **名札のせいで帯の言葉が削られていないか**(`.is-measuring-row`)。
           削る段が付いていたら、測るときに名札を数に入れてしまっている */
        詰め: [...bar.classList].filter((c) => /^is-fit/.test(c)).join(' '),
      }
    })
    if (!r) { ng(`誰の記録か … ${w}px で名札が描かれていない`); continue }
    if (r.はみ出し === 0) ok(`誰の記録か … ${w}px で帯がはみ出さない`)
    else ng(`誰の記録か … ${w}px で帯がはみ出す`, `${r.はみ出し}px`)
    /* **名前が「…」で切れていない。**
       `.lesson-bar-main` の中に置いていたときは、320px で切れていた */
    if (r.切れ <= 0) ok(`誰の記録か … ${w}px で名前が切れない`)
    else ng(`誰の記録か … ${w}px で名前が「…」に切れている`, `${r.切れ}px`)
    if (r.帯の中) ok(`誰の記録か … ${w}px で帯の中にいる(1行を使わない)`)
    else ng(`誰の記録か … ${w}px で帯の外に出ている`)
    /* **説明の文は置かない**(残してよいのは「いまの状態」だけ) */
    if (!/この教材で拾った語は/.test(r.文) && !/に入ります/.test(r.文)) {
      ok(`誰の記録か … ${w}px で説明の文を置いていない`)
    } else ng(`誰の記録か … ${w}px に説明の文が残っている`, r.文.slice(0, 40))
    if (r.見える) ok(`誰の記録か … ${w}px で見えている`)
    else ng(`誰の記録か … ${w}px で見えていない`)
    await page.close()
  }

  /* ①' **広い画面では、名札のせいで帯の言葉が削られない。**
       `fitRow.js` の `over()` は**子の `scrollWidth`** も見るので、
       名札(長い名前で「…」に切れる)を数に入れると
       **いつでもあふれている**と読まれ、「閉じる」の語などが消える。
       `.is-measuring-row .lesson-owner { display: none }` を外すと赤くなる */
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
    await page.goto(`http://localhost:${PORT}/__bar.html?role=trainer&who=g1`,
      { waitUntil: 'networkidle' })
    await page.waitForTimeout(400)
    const r = await page.evaluate(() => {
      const bar = document.querySelector('.lesson-bar')
      const own = document.querySelector('.lesson-owner')
      if (!bar || !own) return null
      /* **測るときの姿で見る。** 印を付けたあいだ、名札は消えていること */
      bar.classList.add('is-measuring-row')
      const 消えた = !own.checkVisibility()
      bar.classList.remove('is-measuring-row')
      return { 消えた, 詰め: [...bar.classList].filter((c) => /^is-fit/.test(c)).join(' ') }
    })
    if (!r) ng('誰の記録か … 1280px で帯が描かれていない')
    else {
      if (r.消えた) ok('誰の記録か … 測るあいだは名札を数に入れない')
      else ng('誰の記録か … 測るあいだも名札が数に入っている')
      if (!r.詰め) ok('誰の記録か … 1280px で帯の言葉が削られていない')
      else ng('誰の記録か … 名札のせいで帯の言葉が削られた', r.詰め)
    }
    await page.close()
  }

  /* ② 押すと相手を選べて、**選んだ相手が名札に出る** */
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 900 } })
    await page.goto(`http://localhost:${PORT}/__bar.html?screen=owner`,
      { waitUntil: 'networkidle' })
    await page.waitForTimeout(200)
    const 名 = () => page.evaluate(() =>
      document.querySelector('.lesson-owner-name')?.textContent?.trim() ?? '')
    const 前 = await 名()
    /* **押せなくても、そこで止めない**(第5.235節 / 第5.236節)。
       `page.click()` は見えない相手を 30 秒待って**例外を投げる**ので、
       名札を消す書き方をしたとたん、**この先の検証がまるごと走らなくなる**
       (実際そうなった —— 新しい見張りが「緑」に見えていた)。
       **止まる検証は、その先ぜんぶを黙って見逃す。**
       ここはマウスの画面なので、見えていないこと自体が赤である */
    let 押せた = true
    await page.click('.lesson-owner', { timeout: 3000 }).catch(() => { 押せた = false })
    if (!押せた) ng('誰の記録か … マウスの画面で名札を押せない(消えている)')
    await page.waitForTimeout(300)
    const 行 = await page.evaluate(() => [...document.querySelectorAll('.shelf-pick')]
      .map((el) => el.textContent.replace(/\s+/g, '')))
    /* **「自分」と担当ゲストが並ぶ。** 自分が消えると、これまでの道が無くなる */
    if (行.length >= 2 && /自分の記録/.test(行[0])) {
      ok(`誰の記録か … 「自分」と担当ゲストが並ぶ(${行.length} 行)`)
    } else ng('誰の記録か … 選ぶ一覧が出ない', 行.join(' / '))
    await page.evaluate(() => {
      const rows = [...document.querySelectorAll('.shelf-pick')]
      // **空でも落とさない**(上と同じ理由。落ちるとこの先が走らない)
      rows[rows.length - 1]?.click()
    })
    await page.waitForTimeout(300)
    const 後 = await 名()
    /* **選んだら、名札がその人に変わる。**
       変わらなければ、どこに入るのか分からないまま書き込むことになる */
    if (後 !== 前 && /さんの記録/.test(後)) ok(`誰の記録か … 選ぶと名札が変わる(${前} → ${後})`)
    else ng('誰の記録か … 選んでも名札が変わらない', `${前} → ${後}`)
    /* **選んだら閉じる**(もう一度押さないと教材に戻れない、をなくす) */
    const 開いたまま = await page.evaluate(() => !!document.querySelector('.shelf-pick'))
    if (!開いたまま) ok('誰の記録か … 選ぶと閉じる')
    else ng('誰の記録か … 選んでも閉じない')
    await page.close()
  }

  /* ③ **指で使う端末では、名札を出さない**(第5.236節・2026-09 実機)

       > スマホとタブレット端末においては「自分の記録」のタブは排除して
       > ください。折り返されて2行目に表示され、画面が狭くなるからです。
       > PCでは残してください。

     **幅では見分けられない。** iPad を横にすると 1024px、12.9インチなら
     1366px で、**ノートパソコンと同じか、それより広い。**
     見分けるのは `pointer: coarse`(その端末のおもな入力が指か)である。

     **「出る」と「出ない」の両方を見る**(CLAUDE.md)——
     指のときだけ消えて、**マウスのときは同じ幅でも残っている**か。
     片方だけだと、**どの端末でも消す**書き方でも緑のままになる。

     **高さを書き写さない。** 「消えたぶん帯が低くなったか」は、
     **同じ幅のマウスのときと比べて**確かめる(性質で見る・CLAUDE.md)。 */
  {
    const 測る = async (w, touch) => {
      const page = await browser.newPage({ viewport: { width: w, height: 900 }, hasTouch: touch })
      await page.goto(`http://localhost:${PORT}/__bar.html?role=trainer&who=g1`,
        { waitUntil: 'networkidle' })
      await page.waitForTimeout(400)
      const r = await page.evaluate(() => {
        const bar = document.querySelector('.lesson-bar')
        const own = document.querySelector('.lesson-owner')
        return {
          帯あり: !!bar,
          名札あり: !!own,
          見える: own ? own.checkVisibility() : null,
          高さ: bar ? Math.round(bar.getBoundingClientRect().height) : 0,
          はみ出し: bar ? Math.round(bar.scrollWidth - bar.clientWidth) : 0,
          /* **指のときだけ消える決まりが効いているか。**
             `matchMedia` そのものを見て、**端末の見分けが付いているか**
             まで確かめる —— 付いていなければ、上の「見える」は
             ただ幅で消えているだけかもしれない */
          指: window.matchMedia('(pointer: coarse)').matches,
        }
      })
      await page.close()
      return r
    }

    /* **狭いほうも広いほうも見る。** タブレットの横向き(1024 / 1366)は
       **ノートパソコンより広い**ので、ここを外すと何も守らない */
    for (const w of [320, 390, 1024, 1366]) {
      const 指 = await 測る(w, true)
      const マウス = await 測る(w, false)
      if (!指.帯あり || !マウス.帯あり) { ng(`名札を消す … ${w}px で帯が描かれていない`); continue }
      if (!指.指) { ng(`名札を消す … ${w}px で「指の端末」と見分けられていない`); continue }
      if (マウス.指) { ng(`名札を消す … ${w}px のマウスが「指」と読まれている`); continue }

      if (指.名札あり && !指.見える) ok(`名札を消す … ${w}px の指の端末では出ない`)
      else ng(`名札を消す … ${w}px の指の端末に名札が出ている`)

      /* **マウスでは残す**(利用者の指定「PCでは残してください」) */
      if (マウス.見える) ok(`名札を消す … ${w}px のマウスでは残っている`)
      else ng(`名札を消す … ${w}px のマウスでも消えている(PCでは残す決まり)`)

      /* **消したぶん、帯が低くなっているか。** 同じ幅で比べる ——
         名札が2段目へ折り返していた幅では、必ず低くなる */
      if (指.高さ <= マウス.高さ) ok(`名札を消す … ${w}px で帯が高くならない(${マウス.高さ} → ${指.高さ}px)`)
      else ng(`名札を消す … ${w}px で帯が高くなった`, `${マウス.高さ} → ${指.高さ}px`)

      if (指.はみ出し === 0) ok(`名札を消す … ${w}px の指の端末で帯がはみ出さない`)
      else ng(`名札を消す … ${w}px の指の端末で帯がはみ出す`, `${指.はみ出し}px`)
    }

    /* **いちばん効いてほしい幅では、本当に段が減っているか。**
       390px(スマホ)と 1024px(タブレットの横向き)は、
       **マウスだと名札が2段目へ折り返す**幅である。
       ここで高さが変わらなければ、**消しても画面は広くなっていない** */
    for (const w of [390, 1024]) {
      const 指 = await 測る(w, true)
      const マウス = await 測る(w, false)
      if (指.高さ < マウス.高さ) {
        ok(`名札を消す … ${w}px で1段ぶん戻った(${マウス.高さ} → ${指.高さ}px)`)
      } else {
        ng(`名札を消す … ${w}px で画面が広くなっていない`, `${マウス.高さ} → ${指.高さ}px`)
      }
    }
  }

  /* ③ 相手が決まっているときは、**押せない名札**(取り違えを起こさない) */
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 900 } })
    await page.goto(`http://localhost:${PORT}/__bar.html?screen=owner&owner=fixed`,
      { waitUntil: 'networkidle' })
    await page.waitForTimeout(200)
    const t = await page.evaluate(() => document.querySelector('.lesson-owner')?.tagName ?? '(無し)')
    if (t === 'SPAN') ok('誰の記録か … 相手が決まっていれば、押せない名札')
    else ng('誰の記録か … 相手が決まっているのに押せてしまう', t)
    await page.close()
  }

  /* ④ 担当ゲストがいなければ、**黙って空にしない** */
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 900 } })
    await page.goto(`http://localhost:${PORT}/__bar.html?screen=owner&owner=empty`,
      { waitUntil: 'networkidle' })
    await page.waitForTimeout(200)
    await page.click('.lesson-owner')
    await page.waitForTimeout(300)
    const 文 = await page.evaluate(() => [...document.querySelectorAll('.card-hint')]
      .map((e) => e.textContent.trim()).join(' / '))
    if (/担当しているゲストがいません/.test(文)) ok('誰の記録か … 担当がいないときは、そう書く')
    else ng('誰の記録か … 担当がいないのに、黙って空になる', 文.slice(0, 60))
    await page.close()
  }

  /* ⑤ **ゲストには出さない。**「出る」と「出ない」の両方を見る ——
       片方だけだと、誰にも出さない形に書き換えても緑のままになる */
  for (const [role, 出る] of [['trainer', true], ['learner', false]]) {
    const page = await browser.newPage({ viewport: { width: 390, height: 900 } })
    await page.goto(`http://localhost:${PORT}/__bar.html?role=${role}&who=g1`,
      { waitUntil: 'networkidle' })
    await page.waitForTimeout(300)
    const 在る = await page.evaluate(() => !!document.querySelector('.lesson-owner'))
    if (在る === 出る) ok(`誰の記録か … ${role} には${出る ? '出る' : '出ない'}`)
    else ng(`誰の記録か … ${role} に${出る ? '出ていない' : '出てしまう'}`)
    await page.close()
  }
}

/* ══════════════════════════════════════════════════════════════════
   その取り組み方に要らないものは、出さない(第5.239節・2026-09-22)

     > スラッシュリーディングの段階で集中モードは必要ないので排除で良い
     > かと思いますが。そういう意味での 6steps のスマート化とシンプル化を
     > 図りたいというのが先ほどからの私の希望です

   **「出る」と「出ない」の両方を見る**(CLAUDE.md)——
   ② だけ消えて、**ほかの5つでは残っている**か。
   片方だけだと、**どこにも出さない形**に書き換えても緑のままになる。
   ══════════════════════════════════════════════════════════════════ */
{
  const page = await browser.newPage({ viewport: { width: 1100, height: 1000 } })
  page.setDefaultTimeout(6000)
  await page.goto(`http://localhost:${PORT}/__bar.html?role=learner&who=g1`,
    { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  const 集中 = () => page.evaluate(() => [...document.querySelectorAll('.practice-row .btn')]
    .some((b) => /集中モード/.test(b.textContent)))

  /* **6Steps を開く前は、本文を読む集中モード。**ここは変えていない */
  if (await 集中()) ok('要らないものを出さない … 6Steps を開く前は、集中モードがある')
  else ng('要らないものを出さない … 6Steps を開く前から集中モードが消えている')

  /* **押せなくても、そこで止めない**(CLAUDE.md・第5.236節で踏んだ) */
  let 開けた = true
  await page.click('.practice-row .btn:has-text("6Steps")', { timeout: 4000 })
    .catch(() => { 開けた = false })
  if (!開けた) ng('要らないものを出さない … 6Steps を開けない(この先は測れていない)')
  await page.waitForTimeout(500)

  for (const s of SIX_STEPS) {
    let 押せた = true
    await page.click(`.step-bar-item[aria-label^="${s.no}"]`, { timeout: 4000 })
      .catch(() => { 押せた = false })
    if (!押せた) { ng(`要らないものを出さない … ${s.no} の丸を押せない`); continue }
    await page.waitForTimeout(400)
    const 出た = await 集中()
    /* **表(`SIX_STEPS.focus`)と、画面が合っているか。**
       数を書き写さない —— 表を変えた日に、検証も一緒に動く(性質で見る) */
    if (出た === s.focus) {
      ok(`要らないものを出さない … ${s.no} ${s.label} の集中モードは ${s.focus ? 'ある' : '無い'}`)
    } else {
      ng(`要らないものを出さない … ${s.no} ${s.label} の集中モードが表と食い違う`,
        `画面 ${出た ? 'あり' : 'なし'} / 表 ${s.focus ? 'あり' : 'なし'}`)
    }
  }

  /* **居座らないか。** ① で入ってから、集中モードの中の切り替えで ② を選ぶ。
     閉じないと、**出せないはずの形のまま残る**(行き止まり) */
  await page.click('.step-bar-item[aria-label^="①"]', { timeout: 4000 }).catch(() => {})
  await page.waitForTimeout(300)
  await page.click('.practice-row .btn:has-text("集中モード")', { timeout: 4000 }).catch(() => {})
  await page.waitForTimeout(500)
  const 入った = await page.evaluate(() => !!document.querySelector('.passage--focus'))
  if (入った) ok('要らないものを出さない … ① では集中モードに入れる')
  else ng('要らないものを出さない … ① で集中モードに入れない')
  await page.selectOption('.stepfocus-pick select', 'slash', { timeout: 4000 }).catch(() => {})
  await page.waitForTimeout(600)
  const 残った = await page.evaluate(() => !!document.querySelector('.passage--focus'))
  if (!残った) ok('要らないものを出さない … 集中モードの中から ② へ移ると、その場で閉じる')
  else ng('要らないものを出さない … ② へ移っても集中モードが居座る')
  await page.close()
}

/* ══════════════════════════════════════════════════════════════════
   アサインの手順(第5.238節・2026-09 利用者の指定)

     > 初めに教材の一覧から教材を選択(複数同時選択可)、そしてゲストを
     > 選ぶのはその次にしてください。また、ゲストのリストは開くための
     > ボタンを一つ配置し、デフォルトでは名前を記入して検索する仕様に
     > してください。

   **この決まりは、実際に開くまで分からない。**
   `lint` も `build` も通ったまま、25人ぶんのチェックが常に並んでいたり、
   打ったのに何も出なかったり、選んだ人が見えないままになる。

   **「出る」と「出ない」の両方を見る**(CLAUDE.md)——
   既定で出ない / 押したら出る / 打ったら出る の3つとも測る。
   ══════════════════════════════════════════════════════════════════ */
{
  const 開く = async (q2, w = 1280) => {
    const page = await browser.newPage({ viewport: { width: w, height: 900 } })
    page.setDefaultTimeout(8000)
    await page.goto(`http://localhost:${PORT}/__bar.html?${q2}`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(300)
    return page
  }
  /** いま並んでいるゲストの行(`.assign-list` の中のチェック) */
  const 行 = (page) => page.evaluate(() => [...document.querySelectorAll('.assign-list .toggle')]
    .map((e) => e.textContent.trim()))

  /* ── ① 既定では羅列しない(共通ルール「長い一覧は、開くまで羅列しない」)── */
  {
    const page = await 開く('screen=pick&pick=shut')
    /* **選ぶ欄そのものは出ている。**出ていなければ、以下は何も測れていない。
       **まとめて共有する帯とチェックは、第5.248節で排除した** ——
       残っているのは、カードの「共有」を押すと出るこの欄だけである */
    const 欄 = await page.evaluate(() => !!document.querySelector('.learner-pick-head'))
    if (欄) ok('ゲストを選ぶ … 選ぶ欄そのものが出ている')
    else ng('ゲストを選ぶ … 欄そのものが出ていない(この先は何も測れていない)')
    /* **帯とチェックは、もう無い**(第5.248節)。戻ってきたら赤くなる */
    const 帯 = await page.evaluate(() => !!document.querySelector('.pick-bar')
      || !!document.querySelector('.material-pick'))
    if (!帯) ok('まとめて共有 … 帯もチェックも残っていない(第5.248節)')
    else ng('まとめて共有 … 排除したはずの帯かチェックが出ている')
    const n = (await 行(page)).length
    if (n === 0) ok('ゲストを選ぶ … 畳んでいるあいだは、ゲストを羅列しない')
    else ng('ゲストを選ぶ … 畳んでいるのにゲストが並んでいる', `${n} 行`)
    await page.close()
  }

  /* ── ② 開いても、まだ羅列しない。**「一覧をひらく」を押して初めて出る** ── */
  {
    const page = await 開く('screen=pick')
    const 前 = (await 行(page)).length
    if (前 === 0) ok('ゲストを選ぶ … 既定では、名前で探す欄だけ')
    else ng('ゲストを選ぶ … 既定でゲストが並んでいる', `${前} 行`)

    /* **押せなくても、そこで止めない。**`page.click()` は見えない相手を
       待って**例外を投げる**ので、札を消したとたん
       **この先の検証がまるごと走らなくなる**(CLAUDE.md・第5.236節で踏んだ) */
    let 押せた = true
    await page.click('.learner-pick-head button', { timeout: 3000 })
      .catch(() => { 押せた = false })
    if (!押せた) ng('ゲストを選ぶ … 「一覧をひらく」が押せない(消えている)')
    await page.waitForTimeout(250)
    const 後 = await 行(page)
    if (後.length >= 3) ok(`ゲストを選ぶ … 押すと一覧が出る(${後.length} 行)`)
    else ng('ゲストを選ぶ … 押しても一覧が出ない', 後.join(' / '))
    await page.close()
  }

  /* ── ③ 打ったときは、開いていなくても出る(行き止まりを作らない)── */
  {
    const page = await 開く('screen=pick')
    /* **`type` で引かない。**`SearchBar` の欄は `type` を持っていない
       (端末が勝手な ✕ を付けるので、わざと外してある)。
       **打てなくても、そこで止めない** —— `page.fill()` は見えない相手を
       待って例外を投げ、**その先がまるごと走らなくなる**(CLAUDE.md) */
    const 欄 = '.learner-pick .searchbar-field input'
    let 打てた = true
    await page.fill(欄, '西大路', { timeout: 3000 }).catch(() => { 打てた = false })
    if (!打てた) ng('ゲストを選ぶ … 名前を打つ欄が無い')
    await page.waitForTimeout(250)
    const 当たり = await 行(page)
    if (当たり.length === 1 && /西大路/.test(当たり[0])) {
      ok('ゲストを選ぶ … 名前を打つと、開いていなくても絞って出る')
    } else ng('ゲストを選ぶ … 名前を打っても絞れていない', 当たり.join(' / '))

    /* **黙って絞らない。** 当てはまらなかったことを、そのまま言う */
    await page.fill(欄, 'いない人', { timeout: 3000 }).catch(() => {})
    await page.waitForTimeout(250)
    const 文 = await page.evaluate(() => [...document.querySelectorAll('.learner-pick .card-hint')]
      .map((e) => e.textContent.trim()).join(' / '))
    if (/当てはまるゲストがいません/.test(文)) ok('ゲストを選ぶ … 0人のときは、そう書く')
    else ng('ゲストを選ぶ … 0人のときに黙って空になる', 文.slice(0, 60))
    await page.close()
  }

  /* ── ④ 選んだ人は、一覧を畳んでも見えている ── */
  {
    const page = await 開く('screen=pick')
    await page.click('.learner-pick-head button', { timeout: 3000 }).catch(() => {})
    await page.waitForTimeout(250)
    await page.click('.assign-list .toggle input', { timeout: 3000 }).catch(() => {})
    await page.waitForTimeout(250)
    /* もう一度押して畳む */
    await page.click('.learner-pick-head button', { timeout: 3000 }).catch(() => {})
    await page.waitForTimeout(250)
    const 残り = (await 行(page)).length
    const 名 = await page.evaluate(() =>
      document.querySelector('.learner-pick-now')?.textContent?.trim() ?? '')
    if (残り === 0 && /山田はなこ/.test(名)) {
      ok('ゲストを選ぶ … 畳んでも、選んだ人は見えている')
    } else ng('ゲストを選ぶ … 畳むと、誰を選んだのか分からなくなる', `${残り} 行 / ${名}`)
    await page.close()
  }

  /* ── ⑤ 「アサインする」の、その他の教材 ── */
  {
    /* **既定では畳んである**(利用者の指定「サブ的な扱いで」) */
    const page = await 開く('screen=assign&mats=shut')
    const n = await page.evaluate(() =>
      document.querySelectorAll('.assign-mats .toggle').length)
    if (n === 0) ok('その他の教材 … 既定では、教材を羅列しない')
    else ng('その他の教材 … 畳んでいるのに教材が並んでいる', `${n} 件`)
    await page.close()
  }
  {
    const page = await 開く('screen=assign')
    const n = await page.evaluate(() =>
      document.querySelectorAll('.assign-mats .toggle').length)
    if (n >= 3) ok(`その他の教材 … 開くと並ぶ(${n} 件)`)
    else ng('その他の教材 … 開いても並ばない', `${n} 件`)
    /* **大項目が消えていないか**(単語帳・RIZAP・Quick Response)——
       足したついでに、前からあるものを落としていないかを見る */
    const 題 = await page.evaluate(() => [...document.querySelectorAll('.card-title')]
      .map((e) => e.textContent.trim()))
    for (const t of ['アサインする', '単語帳の冊', 'Quick Response の冊', 'その他の教材']) {
      if (題.includes(t)) ok(`アサインする … 「${t}」がある`)
      else ng(`アサインする … 「${t}」が消えている`, 題.join(' / '))
    }
    await page.close()
  }
  {
    /* **読み込み中と、0件を書き分ける**(黙って空にしない)。
       **「出る」と「出ない」の両方を見る** —— `||` でつなぐと、
       **どちらか片方に当たって素通りする**(CLAUDE.md) */
    const page = await 開く('screen=assign&mats=wait')
    const r = await page.evaluate(() => ({
      待ち: !!document.querySelector('.loading'),
      無い: /当てはまる教材がありません/.test(document.body.textContent),
    }))
    if (r.待ち && !r.無い) ok('その他の教材 … 読み込み中は、そう見える')
    else ng('その他の教材 … 読み込み中と、0件の区別が付かない',
      `読み込み中の印 ${r.待ち} / 「ありません」 ${r.無い}`)
    await page.close()
  }
  {
    const page = await 開く('screen=assign&mats=none')
    const 文 = await page.evaluate(() => [...document.querySelectorAll('.card-hint')]
      .map((e) => e.textContent.trim()).join(' / '))
    if (/当てはまる教材がありません/.test(文)) ok('その他の教材 … 0件のときは、そう書く')
    else ng('その他の教材 … 0件のときに黙って空になる', 文.slice(0, 60))
    /* **1件もえらんでいなければ、押せるものを出さない** */
    const 有 = await page.evaluate(() => [...document.querySelectorAll('.btn--primary')]
      .some((b) => /件を共有する/.test(b.textContent)))
    if (!有) ok('その他の教材 … えらんでいなければ、共有のボタンを出さない')
    else ng('その他の教材 … 0件なのに「共有する」が出ている')
    await page.close()
  }
}

/* ══════════════════════════════════════════════════════════════════
   本文から拾った かたまり(第5.230節・2026-09 利用者の設計)

     > 「練習する」をクリックすると５問から１０問の日本語が表示され、
     > それぞれ「解答を見る」のボタンがある。このような設計はどうでしょうか？

   **押してみないと分からない**形である。ソースを読んでも
   「押したら本当に問が出るか」「古い教材で『練習する』が出ないか」は
   分からない。**本物のレッスン表示を描いて、実際に押す。**

   **「出る」と「出ない」の両方を見る** —— 分類も練習も無い問
   (0065 を貼る前 / 窓口を置き直す前に作った教材)で、
   札と「練習する」が**出ないこと**まで見る。
   ══════════════════════════════════════════════════════════════════ */
{
  const open = async (w = 390) => {
    const page = await browser.newPage({ viewport: { width: w, height: 1200 } })
    await page.goto(`http://localhost:${PORT}/__bar.html?screen=chunk`,
      { waitUntil: 'networkidle' })
    await page.waitForTimeout(300)
    return page
  }

  /* ① カードが並び、**分類の札は、分類のある問にだけ出る** */
  {
    const page = await open()
    const r = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('.chunk')]
      return cards.map((c) => ({
        en: c.querySelector('.chunk-en')?.textContent.trim() ?? '',
        札: c.querySelector('.chunk-kind')?.textContent.trim() ?? '',
        引用: c.querySelector('.chunk-source')?.textContent.trim() ?? '',
        練習: !!c.querySelector('.chunk-go'),
      }))
    })
    if (r.length === 3) ok(`かたまり … カードが3枚出ている`)
    else ng('かたまり … カードの数が合わない', `${r.length} 枚`)
    const 句 = r.find((x) => x.en.startsWith('come up with'))
    const 古 = r.find((x) => x.en.startsWith('behind the goal'))
    if (句?.札 === '句動詞') ok('かたまり … 分類の札が出る(句動詞)')
    else ng('かたまり … 分類の札が出ない', 句?.札 ?? '(カードが無い)')
    if (句?.引用) ok('かたまり … 本文の文章が出る')
    else ng('かたまり … 本文の文章が出ない')
    if (句?.練習) ok('かたまり … 「練習する」が出る')
    else ng('かたまり … 「練習する」が出ない')
    /* **いちばん危ない形。** 分類も本文の文章も練習も無い古い問で、
       札を出したり、押しても何も起きないボタンを出したりしないこと */
    if (古 && !古.札) ok('かたまり … 分類の無い問では、札を出さない')
    else ng('かたまり … 分類が無いのに札が出た', 古?.札 ?? '(カードが無い)')
    if (古 && !古.引用) ok('かたまり … 本文の文章が無ければ、その行を出さない')
    else ng('かたまり … 本文の文章が無いのに行が出た')
    if (古 && !古.練習) ok('かたまり … 練習が無ければ「練習する」を出さない')
    else ng('かたまり … 練習が0問なのに「練習する」が出た')
    await page.close()
  }

  /* ② 押すと問が出る。**片方しか無い問は落ちている**(6 → 5問) */
  {
    const page = await open()
    /* **「見えているか」で数える**(2026-09・第5.230節)。
       紙に出すために**描いてから隠す**形にしたので、
       畳んでいても `.chunk-drill` は DOM にある。
       `querySelectorAll` の数で見ていると、
       **畳んであっても「開いている」と読まれる** */
    const 前 = await page.evaluate(() => [...document.querySelectorAll('.chunk-drill')]
      .filter((e) => e.checkVisibility()).length)
    await page.evaluate(() => {
      const c = [...document.querySelectorAll('.chunk')]
        .find((x) => x.querySelector('.chunk-en')?.textContent.startsWith('come up with'))
      c.querySelector('.chunk-go').click()
    })
    await page.waitForTimeout(250)
    const r = await page.evaluate(() => {
      const c = [...document.querySelectorAll('.chunk')]
        .find((x) => x.querySelector('.chunk-en')?.textContent.startsWith('come up with'))
      /* **見えているものだけ**(描いてから隠す形なので、数では見られない) */
      const 見える = (e) => e.checkVisibility()
      return {
        問: [...c.querySelectorAll('.chunk-drill-ja')].filter(見える)
          .map((e) => e.textContent.trim()),
        英: [...c.querySelectorAll('.chunk-drill-en')].filter(見える)
          .map((e) => e.textContent.trim()),
        札: c.querySelector('.chunk-go').textContent.trim(),
      }
    })
    if (前 === 0) ok('かたまり … はじめは練習を畳んである')
    else ng('かたまり … はじめから練習が開いている', `${前} 問`)
    /* **数を書き写さない。** 骨組みには6問あり、そのうち1問は
       英語が空である。**落ちて5問になる**のが「そろえ方」の性質である */
    if (r.問.length === 5) ok(`かたまり … 押すと問が出る(5 問。片方しか無い1問は落ちる)`)
    else ng('かたまり … 問の数が合わない', `${r.問.length} 問`)
    if (!r.英.length) ok('かたまり … 解答は、押すまで出ない')
    else ng('かたまり … 解答が先に出てしまっている', r.英.join(' / '))
    /* **鳴らすボタンがそのまま止めるに変わる**のが、このアプリの作法 */
    if (/練習を閉じる/.test(r.札)) ok('かたまり … 開いたら「練習を閉じる」に変わる')
    else ng('かたまり … 開いても言葉が変わらない', r.札)

    /* ③ 「解答を見る」を押すと、その問だけ英文が出る */
    await page.evaluate(() => {
      const c = [...document.querySelectorAll('.chunk')]
        .find((x) => x.querySelector('.chunk-en')?.textContent.startsWith('come up with'))
      c.querySelectorAll('.chunk-drill-show')[0].click()
    })
    await page.waitForTimeout(200)
    const r2 = await page.evaluate(() => {
      const c = [...document.querySelectorAll('.chunk')]
        .find((x) => x.querySelector('.chunk-en')?.textContent.startsWith('come up with'))
      return {
        英: [...c.querySelectorAll('.chunk-drill-en')].filter((e) => e.checkVisibility())
          .map((e) => e.textContent.trim()),
        札: [...c.querySelectorAll('.chunk-drill-show')].map((e) => e.textContent.trim()),
      }
    })
    if (r2.英.length === 1) ok(`かたまり … 押した問だけ解答が出る(${r2.英[0]})`)
    else ng('かたまり … 解答の出かたがおかしい', `${r2.英.length} 問ぶん出た`)
    if (/解答を隠す/.test(r2.札[0]) && /解答を見る/.test(r2.札[1])) {
      ok('かたまり … 開いた問だけ「解答を隠す」に変わる')
    } else ng('かたまり … 解答の札が変わらない', r2.札.join(' / '))
    await page.close()
  }

  /* ④' **紙にも出る。左が日本語・右が解答の英語**(2026-09 利用者の指定)

       > はい、紙にも表示されるようにしてください。その際は
       > quick response と同じように、左側に日本語、右側に解答の英語
       > というフォーマットでお願いします。

     **ソースを読むだけでは分からない。** 紙の見え方は
     「`no-print` が付いているか」「`.btn` をまとめて消す決まり」
     「`qrsheet-list` の2列の組み」の**掛け合わせ**で決まる。
     **印刷の見え方をそのまま描いて測る**(`emulateMedia`)。

     **いちばん危ない形で測る** —— 練習を**畳んだまま**印刷する。
     「描いてから隠す」をやめて `open &&` に戻すと、ここが赤くなる。

     **「出る」と「出ない」の両方を見る** —— 解答が出ることと、
     押すもの(練習する / 解答を見る)が紙に出ないことの両方。 */
  {
    const page = await open(1280)
    /* **本物の `printElement()` と同じ印を付ける。**
       `is-printing` / `print-target` / `print-path` の3つがそろって
       初めて紙の指定が効く(`src/lib/print.js`) */
    await page.evaluate(() => {
      const sheet = document.querySelector('#lesson-sheet') ?? document.querySelector('.lesson-sheet')
      if (!sheet) return
      sheet.classList.add('print-target')
      document.body.classList.add('is-printing')
      for (let el = sheet.parentElement; el && el !== document.body; el = el.parentElement) {
        el.classList.add('print-path')
      }
    })
    await page.emulateMedia({ media: 'print' })
    await page.waitForTimeout(250)
    const r = await page.evaluate(() => {
      const 見える = (el) => !!el && el.checkVisibility?.() !== false
        && el.getBoundingClientRect().height > 0
      const 箱 = document.querySelector('.print-target [data-type="vocab_note"]')
      const 行 = [...document.querySelectorAll('.print-target .chunk-drill')].filter(見える)
      const one = 行[0]
      const ja = one?.querySelector('.chunk-drill-ja')
      const en = one?.querySelector('.chunk-drill-en')
      return {
        ページ: 見える(箱),
        問: 行.length,
        /* **左と右。** 日本語の右端が、英語の左端より左にあること */
        左右: ja && en ? Math.round(en.getBoundingClientRect().left
          - ja.getBoundingClientRect().right) : null,
        解答: 見える(en),
        /* 通し番号の丸のぶんの余白。**Quick Response の紙の組みが効いた印** */
        番号よけ: one ? Math.round(parseFloat(window.getComputedStyle(one).paddingLeft)) : 0,
        押すもの: [...document.querySelectorAll('.print-target .chunk-go, .print-target .chunk-drill-show')]
          .filter(見える).length,
      }
    })
    if (r.ページ) ok('かたまり(紙) … ページが紙に出る')
    else ng('かたまり(紙) … ページが紙に出ていない')
    /* **畳んだままでも出る。** 数は骨組みの中身から決まる(書き写さない) */
    if (r.問 >= 5) ok(`かたまり(紙) … 畳んだままでも練習が出る(${r.問} 問)`)
    else ng('かたまり(紙) … 畳んだままだと練習が出ない', `${r.問} 問`)
    if (r.左右 !== null && r.左右 >= 0) {
      ok(`かたまり(紙) … 左が日本語・右が解答の英語(あいだ ${r.左右}px)`)
    } else ng('かたまり(紙) … 左右に分かれていない', `あいだ ${r.左右}px`)
    if (r.解答) ok('かたまり(紙) … 解答が出ている')
    else ng('かたまり(紙) … 解答が紙に出ていない')
    if (r.番号よけ > 0) ok(`かたまり(紙) … 通し番号の場所がある(${r.番号よけ}px)`)
    else ng('かたまり(紙) … Quick Response の紙の組みが効いていない')
    if (r.押すもの === 0) ok('かたまり(紙) … 押すものは紙に出ない')
    else ng('かたまり(紙) … 押すものが紙に出ている', `${r.押すもの} 個`)
    await page.close()
  }

  /* ④'' **PDF にも入る**(2026-09 利用者の指定「もちろん pdf にもです」)

     「PDF で保存」は、**印刷の画面から保存するもの**である
     (`printElement()` → `window.print()`)。別の仕組みは1つも無い。
     けれども**そう書くだけでは確かめたことにならない** ——
     `page.pdf()` は本物の PDF を作る道そのものなので、**作って測る。**

     **数を書き写さない**(CLAUDE.md)。同じ画面から

       ①そのまま               … 文字を置く命令 N 個
       ②表現のページを隠して   … 文字を置く命令 M 個

     の2つを作り、**N が M より、少なくとも「紙に出ている問の数」だけ
     多い**ことを見る。1問につき、日本語と英語で最低1回ずつ置かれる。
     もう一度「紙に出さない」指定を足すと、N が M に落ちて赤くなる。

     **ページ数では見ない** —— 実測したところ、練習を消しても
     3枚のままだった(`break-before: page` の側で決まるため)。
     **「無ければ素通り」する形の検証を書かない**(CLAUDE.md)。 */
  {
    /* PDF の中の「文字を置く命令」を数える。**素の node だけで読む** ——
       流れ(stream)は FlateDecode で圧縮してあるので、ほどいてから数える。
       Chromium は16進の文字列(`<0014> Tj`)で書くので、そちらも拾う */
    const 文字置き = (buf) => {
      let n = 0
      let i = 0
      for (;;) {
        const a = buf.indexOf('stream', i)
        if (a < 0) break
        let st = a + 6
        if (buf[st] === 0x0d) st += 1
        if (buf[st] === 0x0a) st += 1
        const b = buf.indexOf('endstream', st)
        if (b < 0) break
        try {
          n += (zlib.inflateSync(buf.subarray(st, b)).toString('latin1')
            .match(/(?:\)|>|\])\s*T[jJ]/g) ?? []).length
        } catch { /* ほどけない流れは数えない(画像など) */ }
        i = b + 9
      }
      return n
    }

    const page = await open(1280)
    await page.evaluate(() => {
      const sheet = document.querySelector('#lesson-sheet') ?? document.querySelector('.lesson-sheet')
      if (!sheet) return
      sheet.classList.add('print-target')
      document.body.classList.add('is-printing')
      for (let el = sheet.parentElement; el && el !== document.body; el = el.parentElement) {
        el.classList.add('print-path')
      }
    })
    await page.emulateMedia({ media: 'print' })
    await page.waitForTimeout(250)
    /* **紙に出ている問の数**(差の下限は、ここから決める) */
    const 問数 = await page.evaluate(() => [...document.querySelectorAll('.print-target .chunk-drill')]
      .filter((e) => e.checkVisibility()).length)
    const あり = await page.pdf({ format: 'A4', printBackground: true })
    /* **表現のページごと隠して、もう1枚作る。**
       打ち消しの強さは、本物の指定(`body.is-printing …`)より上にする */
    await page.addStyleTag({
      content: '@media print { body.is-printing .print-target [data-type="vocab_note"],'
        + ' .print-target [data-type="vocab_note"] { display: none !important } }',
    })
    await page.waitForTimeout(200)
    const 隠れた = await page.evaluate(() => {
      const el = document.querySelector('.print-target [data-type="vocab_note"]')
      return el ? window.getComputedStyle(el).display === 'none' : false
    })
    const なし = await page.pdf({ format: 'A4', printBackground: true })
    await page.close()

    if (あり.subarray(0, 5).toString() === '%PDF-') ok('かたまり(PDF) … PDF ができている')
    else ng('かたまり(PDF) … PDF になっていない', あり.subarray(0, 8).toString())
    if (!隠れた) {
      ng('かたまり(PDF) … 比べる相手(ページを隠した紙)を作れていない',
        '打ち消しの指定が本物に負けている')
    } else if (問数 < 5) {
      ng('かたまり(PDF) … 紙に練習が出ていない', `${問数} 問`)
    } else {
      const N = 文字置き(あり)
      const M = 文字置き(なし)
      if (N - M >= 問数 * 2) {
        ok(`かたまり(PDF) … 表現のページが PDF に入っている(${N} → ${M}・${問数} 問)`)
      } else {
        ng('かたまり(PDF) … 表現のページが PDF に入っていない',
          `そのまま ${N} / 隠して ${M}(問は ${問数})`)
      }
    }
  }

  /* ④ **いちばん狭い画面で、はみ出さない。**
       長いかたまり(to put it another way)と長い日本語を置いてある */
  for (const w of [320, 390]) {
    const page = await open(w)
    await page.evaluate(() => {
      for (const b of document.querySelectorAll('.chunk-go')) b.click()
    })
    await page.waitForTimeout(250)
    const r = await page.evaluate(() => {
      const sheet = document.querySelector('.lesson-sheet')
      const over = [...document.querySelectorAll('.chunk, .chunk-drill-row')]
        .filter((e) => e.scrollWidth > e.clientWidth + 1).length
      return { 紙: Math.round(sheet.scrollWidth - sheet.clientWidth), over }
    })
    if (r.紙 <= 0) ok(`かたまり … ${w}px で紙が横にはみ出さない`)
    else ng(`かたまり … ${w}px で紙が横にはみ出す`, `${r.紙}px`)
    if (r.over === 0) ok(`かたまり … ${w}px でカードがはみ出さない`)
    else ng(`かたまり … ${w}px で ${r.over} か所はみ出す`)
    await page.close()
  }
}

/* ══════════════════════════════════════════════════════════════════
   **「細かい指定」に書いたら、それが主になる**(第5.232節・2026-09 実機)

     > 唐揚げの加工工場の話だと指定したら、「悪い知らせをする」という
     > 切り口が強制的に選ばれ、そのような話になってしまいました

   **押してみないと分からない形**である。欄の出し分けは
   「細かい指定に字があるか」で毎回変わるので、**実際に打って確かめる。**

   **「出る」と「出ない」の両方を見る**(CLAUDE.md)——
   書く前は出ないこと、消したら戻ることまで数える。
   ══════════════════════════════════════════════════════════════════ */
{
  const みる = async (kind) => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } })
    await page.goto(`http://localhost:${PORT}/__bar.html?screen=form&kind=${kind}`,
      { waitUntil: 'networkidle' })
    await page.waitForTimeout(400)
    /** いまの欄の様子(選べるものの1つめと、「選ばない」があるか) */
    const 様子 = () => page.evaluate(() => {
      const 欄 = (label) => [...document.querySelectorAll('label.field')]
        .find((l) => (l.querySelector('span')?.textContent ?? '').trim() === label)
        ?.querySelector('select')
      const opts = (el) => [...(el?.options ?? [])].map((o) => o.textContent.trim())
      return {
        切り口: opts(欄('話の切り口')),
        場面: opts(欄('シチュエーション')),
        話題: opts(欄('話題')),
      }
    })
    /* **「細かい指定」の欄を、呼び名で探す**(第5.232節)。
       `textarea` の1つめでは当たらない —— **モノローグには
       「原稿を貼る」欄が上にあり、そちらを埋めてしまう**(実際に踏んだ)。
       **呼び名は書き写さない** —— `materialKinds.js` から借りる */
    const 指定 = page.locator('label.field', { hasText: subjectLabel(kind) })
      .locator('textarea')
    return { page, 様子, 指定 }
  }

  /* ① 会話 —— 書く前 / 書いたあと / 消したあと */
  {
    const { page, 様子, 指定 } = await みる('dialogue')
    const 前 = await 様子()
    if (/^おまかせ/.test(前.切り口[0] ?? '')) ok('細かい指定 … 書く前は「おまかせ」')
    else ng('細かい指定 … 書く前の切り口がおかしい', 前.切り口[0] ?? '(無し)')
    if (!前.場面.some((x) => /選ばない/.test(x))) ok('細かい指定 … 書く前は「選ばない」を出さない')
    else ng('細かい指定 … 書いていないのに「選ばない」が出ている')

    const 欄 = 指定
    await 欄.fill('唐揚げの加工工場で、冷凍ラインの入れ替えを相談する話')
    await page.waitForTimeout(300)
    const 後 = await 様子()
    if (/切り口は付けない/.test(後.切り口[0] ?? '')) {
      ok('細かい指定 … 書いたら「切り口は付けない」に変わる')
    } else ng('細かい指定 … 書いても切り口が「おまかせ」のまま', 後.切り口[0] ?? '(無し)')
    if (後.場面.some((x) => /場面は選ばない/.test(x))) ok('細かい指定 … 場面を「選ばない」にできる')
    else ng('細かい指定 … 場面の「選ばない」が出ない')
    /* **切り口そのものは消さない。** 選びたければ選べる(行き止まりを作らない) */
    if (後.切り口.length > 1) ok(`細かい指定 … 切り口は、選びたければ選べる(${後.切り口.length - 1} 件)`)
    else ng('細かい指定 … 切り口が選べなくなっている')

    await 欄.fill('')
    await page.waitForTimeout(300)
    const 戻り = await 様子()
    if (/^おまかせ/.test(戻り.切り口[0] ?? '')) ok('細かい指定 … 消したら「おまかせ」に戻る')
    else ng('細かい指定 … 消しても戻らない', 戻り.切り口[0] ?? '(無し)')
    if (!戻り.場面.some((x) => /選ばない/.test(x))) ok('細かい指定 … 消したら「選ばない」も消える')
    else ng('細かい指定 … 消しても「選ばない」が残る')
    await page.close()
  }

  /* ② 会議でも同じ(**`kind === 'dialogue'` と書いていたら、ここで落ちる**) */
  {
    const { page, 様子, 指定 } = await みる('meeting')
    await 指定.fill('唐揚げの加工工場の朝礼')
    await page.waitForTimeout(300)
    const r = await 様子()
    if (/切り口は付けない/.test(r.切り口[0] ?? '')) ok('細かい指定 … 会議でも効く')
    else ng('細かい指定 … 会議で効いていない', r.切り口[0] ?? '(無し)')
    await page.close()
  }

  /* ③ 記事 —— こちらは「話題(ジャンル)」のほう */
  {
    const { page, 様子, 指定 } = await みる('reading')
    const 前 = await 様子()
    if (!前.話題.some((x) => /選ばない/.test(x))) ok('細かい指定 … 記事も、書く前は出さない')
    else ng('細かい指定 … 記事で、書いていないのに「選ばない」が出ている')
    await 指定.fill('唐揚げの加工工場の自動化')
    await page.waitForTimeout(300)
    const 後 = await 様子()
    if (後.話題.some((x) => /話題は選ばない/.test(x))) ok('細かい指定 … 記事の話題も「選ばない」にできる')
    else ng('細かい指定 … 記事の話題の「選ばない」が出ない')
    if (/切り口は付けない/.test(後.切り口[0] ?? '')) ok('細かい指定 … 記事でも切り口を付けない')
    else ng('細かい指定 … 記事で切り口が「おまかせ」のまま', 後.切り口[0] ?? '(無し)')
    await page.close()
  }

  /* ④ モノローグ —— 切り口はもともと無い。**場面のほうが効く**
       (第5.228節。**そこを壊していないか**を、ここで押さえる) */
  {
    const { page, 様子, 指定 } = await みる('speech')
    await 指定.fill('唐揚げの加工工場の改善報告')
    await page.waitForTimeout(300)
    const r = await 様子()
    if (!r.切り口.length) ok('細かい指定 … モノローグには、そもそも切り口が無い')
    else ng('細かい指定 … モノローグに切り口が出ている', r.切り口.join(' / '))
    if (r.場面.some((x) => /場面は選ばない/.test(x))) ok('細かい指定 … モノローグの場面は、これまでどおり選ばなくてよい')
    else ng('細かい指定 … 第5.228節が壊れている(モノローグの場面)')
    await page.close()
  }
}

/* ══════════════════════════════════════════════════════════════════
   冊の中の絞り込みと、聞き流し(第5.191節・2026-09 実機・利用者の指摘)

     > quick responseの冊の絞り込みが全く機能していません。
     > また、聞き流しも機能していません。

   **どちらも「持ちものの側」の壊れ方**で、ソースを読んでも分からなかった。

   ①絞ると `dropRun()` が「開いた瞬間に1問目」をもう一度走らせ、
    **新しい中身が届く前に、古い問で組んで**始まってしまう。
    しかも組み直しの鍵(`runKey`)に冊の中の区切りが入っていないので、
    **届いても組み直されない。** 画面の題は新しい型を出しているのに、
    出てくる問は絞る前のまま —— だから「全く機能していない」に見える
   ②聞き流しを**押すボタンは2か所**にあるのに、**描く側は1か所**
    (「始める前」の枝)にしかなかった。第5.167節でトップ画面を無くして
    からは、利用者はほぼずっと練習の画面にいるので、**押しても何も起きない**

   **本物の `QrReview` を描いて、押して、出てきた問を読む**
   (`?screen=qrreal`)。写した骨組みでは、どちらも1ミリも測れない。
   ══════════════════════════════════════════════════════════════════ */
{
  const page = await browser.newPage({ viewport: { width: 420, height: 900 } })
  page.setDefaultTimeout(9000)
  await page.goto(`http://localhost:${PORT}/__bar.html?screen=qrreal`,
    { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)

  /** 66 の型の冊へ移る。**名前は `FRAME_BOOK_LABEL` 1か所**(書き写さない) */
  const 冊へ = async () => {
    await 本棚をひらく(page)
    await page.waitForTimeout(300)
    await page.evaluate(() => {
      for (const x of document.querySelectorAll('.shelf-pick')) {
        if ((x.textContent || '').includes('の型')) { x.click(); return }
      }
    })
    await page.waitForTimeout(1400)
  }
  await 冊へ()
  /* **接続の無い骨組みでは、冊を替えた瞬間に描き分けが変わる**
     (「Supabase が設定されていません」の枝 → 本体)。
     そのぶんシートが畳まれるので、ここだけ開き直す */
  await 本棚をひらく(page)
  await page.waitForTimeout(500)

  const 型を = async (n) => page.evaluate((i) => {
    const s2 = [...document.querySelectorAll('select')].find((x) => x.options.length > 50)
    if (!s2) return null
    const v = s2.options[i].value
    s2.value = v
    s2.dispatchEvent(new Event('change', { bubbles: true }))
    return v
  }, n)

  const 見る = () => page.evaluate(() => ({
    シート: !!document.querySelector('.sheet, .setpop'),
    題: (document.querySelector('.drill-title')?.textContent ?? '').trim(),
    型: (() => {
      const s2 = [...document.querySelectorAll('select')].find((x) => x.options.length > 50)
      return s2 ? s2.options[s2.selectedIndex].textContent.trim() : ''
    })(),
    /* **出ている問の英文だけ**を読む(`英語を見る` を押してから)。
       **`.qr` を丸ごと読まない** —— あそこには題(「14 の型 / 言い換え /
       S enables 人 to do」)も入っているので、**型の名前が必ず当たってしまう**
       (赤チェックで踏んだ・CLAUDE.md「名前が出てくるかで見ない」) */
    英文: (document.querySelector('.qr-en')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
    /* **その問に付いている型の札。** 選んだ型と突き合わせる ——
       ここが本丸である(題だけ新しくして中身が前のままなら、食い違う) */
    札: (document.querySelector('.qr-frame')?.textContent ?? '')
      .replace(/^型/, '').replace(/\s+/g, ' ').trim(),
  }))

  const 前 = await 見る()
  const 型 = await 型を(3)
  await page.waitForTimeout(1500)
  const 後 = await 見る()

  if (!型) {
    ng('冊の絞り込み … 型をえらぶ欄が出ない')
  } else if (!後.シート) {
    /* **絞るたびに畳まれると、2つめを選べない**(第5.191節) */
    ng('冊の絞り込み … 型をえらんだら、本棚のシートが閉じてしまう',
      '**絞っただけで練習を始め直さない** —— 中身と型を続けて選べなくなる')
  } else if (後.型 === 前.型) {
    ng('冊の絞り込み … えらんでも、欄が変わらない', `${前.型} → ${後.型}`)
  } else if (!後.題.includes(型)) {
    /* **題は、いま出しているものの名前**(第5.187節) */
    ng('冊の絞り込み … 題が、えらんだ型になっていない', `「${後.題}」/ ${型}`)
  } else {
    ok(`冊の絞り込み … 型をえらんでもシートは開いたまま(${後.型})`)
  }

  /* **中身(日本語 → 英語 / 言い換え)も、続けて選べるか。**
     ここが本丸である —— 1つ選ぶたびに始まり直すと、2つめに手が届かない */
  const 中身 = await page.evaluate(() => {
    const s2 = [...document.querySelectorAll('select')].find((x) => x.options.length === 2)
    if (!s2) return null
    s2.value = s2.options[1].value
    s2.dispatchEvent(new Event('change', { bubbles: true }))
    return s2.options[1].textContent.trim()
  })
  await page.waitForTimeout(1500)
  const 二つめ = await 見る()
  if (!中身) ng('冊の絞り込み … 中身をえらぶ欄が出ない')
  else if (!二つめ.題.includes(型)) {
    ng('冊の絞り込み … 2つめを選ぶと、1つめの絞り込みが消える', 二つめ.題)
  } else ok(`冊の絞り込み … 型のあとに中身も続けて選べる(${二つめ.題})`)

  /* **出てくる問が、えらんだ型のものか。**
     ここを見ないと、**題だけ新しくして中身は前のまま**でも緑になる ——
     実機で起きていたのは、まさにそれである */
  await page.evaluate(() => { document.querySelector('.sheet-back')?.click() })
  await page.waitForTimeout(400)
  /* **箱そのものを押す**(第5.262節・2026-09-26 利用者の指定)。
     「英語を見る / 答えを見る」のボタンは廃止した ——
     **文字で探していたので、廃止した日にここが黙るところだった** */
  await page.evaluate(() => { document.querySelector('.qr-body--tap')?.click() })
  await page.waitForTimeout(700)
  const 出た = await 見る()
  /* 型の名前は `S enables 人 to do` のような形。**動詞だけを取り出して**
     英文に入っているかを見る(**値を書き写さない**・CLAUDE.md) */
  const 動詞 = (型.match(/^S\s+(\w+)/) ?? [])[1] ?? ''
  if (!動詞) {
    ng('冊の絞り込み … 型の名前から動詞が読めない', 型)
  } else if (出た.札 && 出た.札 !== 型) {
    /* **札が、選んだ型と違う。** ここが「絞り込みが全く機能していない」の正体 */
    ng('冊の絞り込み … 出ている問の型が、えらんだ型と違う',
      `${型} を選んだのに、札は「${出た.札}」(${出た.英文.slice(0, 80)})`)
  } else if (!出た.英文) {
    ng('冊の絞り込み … 英文が読めない(箱を押しても切り替わっていない)')
  } else if (!new RegExp(動詞, 'i').test(出た.英文)) {
    ng('冊の絞り込み … 出ている英文が、えらんだ型のものではない',
      `${型} を選んだのに「${出た.英文.slice(0, 120)}」`)
  } else {
    ok(`冊の絞り込み … 出てくる問も、えらんだ型のものになる`
      + `(札「${出た.札}」・${出た.英文.slice(0, 40)})`)
  }

  /* ── 聞き流し。**練習の画面から押して、本当に出るか** ───────────── */
  await page.evaluate(() => { document.querySelector('.rscope-sort')?.click() })
  await page.waitForTimeout(500)
  const 道具 = await page.evaluate(() =>
    [...document.querySelectorAll('.sheet .wb-listen, .setpop .wb-listen')]
      .map((x) => x.textContent.trim()))
  await page.evaluate(() => {
    const b2 = [...document.querySelectorAll('button')]
      .find((x) => (x.textContent || '').includes('聞き流し'))
    if (b2) b2.click()
  })
  await page.waitForTimeout(1500)
  const 流 = await page.evaluate(() => ({
    ある: !!document.querySelector('.radio'),
    文: (document.querySelector('.radio')?.textContent ?? '').replace(/\s+/g, ' ').slice(0, 120),
  }))
  if (道具.length !== 2) {
    ng('聞き流し … 練習の「出しかた」に道具が2つ出ていない', 道具.join(' / '))
  } else if (!流.ある) {
    ng('聞き流し … 練習の画面から押しても、何も出ない',
      '**押す場所と、受け取る場所は同じ数だけ要る**(第5.191節)')
  } else {
    ok(`聞き流し … 練習の画面からも開ける(${流.文.slice(0, 40)}…)`)
  }
  await page.close()
}

/* ══════════════════════════════════════════════════════════════════
   どの画面も、開いた瞬間に落ちない(第5.195節・2026-09 利用者の指定)

     > 現状で壊れていて機能していないことが他にないか、
     > 一度徹底してチェックしてください。

   **`npm run build` が通っても安心してはいけない**(CLAUDE.md)——
   import を書き忘れてもビルドは成功し、**開いた瞬間に落ちる。**
   実際に `App.jsx` で `TrainerMaterials` の import が抜けたまま
   ビルドが通り、画面を開くまで分からない状態になった(2026-08)。

   **骨組みで描ける画面を、1つも漏らさず開く。**
   一覧は `__screens.jsx` から読み取る —— **書き写さない。**
   画面を足した日に、ここが**ひとりでに増える。**

   見るのは3つ。
   ①落ちない(`pageerror` が1つも出ない)
   ②空っぽでない(描かれている)
   ③横にはみ出さない
   ══════════════════════════════════════════════════════════════════ */
{
  /** 骨組みが知っている画面。**一覧は向こうが持つ** */
  const 画面 = [...new Set([...readFileSync(
    new URL('../src/__screens.jsx', import.meta.url), 'utf8')
    .matchAll(/q\.get\('screen'\) === '([a-z]+)'/g)].map((m) => m[1]))]

  /* **わざと空になる画面**は、名指しで外す。
     `jobbar` は役割を渡さないと何も出さない(**それが正しい**)、
     `sticky` は貼り付く帯そのものを測るための1行だけの画面である。
     **「並んでいるから」では外さない**(CLAUDE.md) */
  const 空でよい = new Set(['jobbar', 'sticky'])

  const 落ちた = []
  const 空 = []
  const はみ出た = []
  for (const s of 画面) {
    const page = await browser.newPage({ viewport: { width: 390, height: 800 } })
    page.setDefaultTimeout(9000)
    const err = []
    page.on('pageerror', (e) => err.push(String(e).split('\n')[0].slice(0, 120)))
    await page.route('**/rest/v1/**', (r) => r.fulfill({
      status: 200, contentType: 'application/json', body: '[]',
    }))
    await page.route('**/auth/v1/**', (r) => r.fulfill({
      status: 200, contentType: 'application/json', body: '{}',
    }))
    try {
      await page.goto(`http://localhost:${PORT}/__bar.html?screen=${s}`,
        { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(1200)
    } catch (e) { err.push(String(e).split('\n')[0].slice(0, 120)) }
    const m = await page.evaluate(() => ({
      文字: (document.body.textContent ?? '').replace(/\s+/g, ' ').trim().length,
      /* **押せるものも数える**(2026-09・第5.230節)。

         文字の数だけで見ていたので、**説明の文を消した画面が
         「空っぽ」と読まれた** —— `?screen=owner` は
         「この教材で拾った語は〜に入ります」をやめて札1つになり、
         文字が 6 つになった(`.claude/rules/common.md`
         「余計な説明書きを置かない」を守ったら赤くなった)。

         見たいのは「**描かれていない**」であって、
         「文字が少ない」ではない。**文字も押せるものも無い**ときだけ空とする */
      物: document.querySelectorAll('button, input, select, textarea, a, img, svg').length,
      よこ: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    })).catch(() => ({ 文字: 0, 物: 0, よこ: 0 }))
    if (err.length) 落ちた.push(`${s}: ${err[0]}`)
    else if (m.文字 < 10 && m.物 === 0 && !空でよい.has(s)) 空.push(s)
    else if (m.よこ > 0) はみ出た.push(`${s}(${m.よこ}px)`)
    await page.close()
  }

  if (落ちた.length) {
    ng(`どの画面も落ちない … ${落ちた.length} 画面で落ちた`, 落ちた.slice(0, 4).join('\n    '))
  } else if (空.length) {
    ng(`どの画面も落ちない … ${空.length} 画面が空っぽ`,
      `${空.join(' / ')}。わざと空なら、名指しで外す(「並んでいるから」では外さない)`)
  } else if (はみ出た.length) {
    ng(`どの画面も落ちない … ${はみ出た.length} 画面が横にはみ出す`, はみ出た.join(' / '))
  } else {
    ok(`どの画面も落ちない … ${画面.length} 画面ぜんぶ、開いて描かれて、はみ出さない`)
  }
}

/* ══════════════════════════════════════════════════════════════════
   どの曲を流すか(第5.194節・2026-09 利用者の指定)

     > また、複数登録した曲から選べるようにしてください。

   **「出る」と「出ない」の両方を見る**(CLAUDE.md)。
   曲が1つしかないときは**欄そのものを出さない**
   (「ぜんぶ」とその1曲は同じもの・効かない操作を見せない)。
   ここを見ないと、**いつも出す形に戻しても緑のまま**になる。

   **帯からはみ出さないことも測る。** 曲の題は長い(`?screen=qrradio` に
   長い題を1つ混ぜてある)ので、読み方・間と並べると押し出される。
   ══════════════════════════════════════════════════════════════════ */
{
  const 見る = async (w, q = '') => {
    const page = await browser.newPage({ viewport: { width: w, height: 800 } })
    await page.goto(`http://localhost:${PORT}/__bar.html?screen=qrradio${q}`,
      { waitUntil: 'networkidle' })
    await page.waitForTimeout(300)
    const r = await page.evaluate(() => {
      const sel = document.querySelector('.radio-pick--song select')
      const bar = document.querySelector('.focus-top')
      return {
        ある: !!sel,
        選択肢: sel ? [...sel.options].map((o) => o.textContent.trim()) : [],
        いま: sel ? sel.value : null,
        /* **帯からはみ出さないか。** 題が長いと押し出される */
        はみ出し: bar ? Math.max(0, Math.round(bar.scrollWidth - bar.clientWidth)) : 0,
        よこ: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      }
    })
    await page.close()
    return r
  }

  for (const w of [390, 320, 1280]) {
    const a2 = await 見る(w)
    const 名 = `曲をえらぶ(${w}px)`
    if (!a2.ある) {
      ng(`${名} … 曲をえらぶ欄が出ない`, '2曲以上あるときは選べること')
    } else if (a2.選択肢.length !== 4) {
      /* ぜんぶ + 3曲。**曲を足したら、ここも直す** */
      ng(`${名} … 選択肢が「ぜんぶ + 3曲」になっていない`, a2.選択肢.join(' / '))
    } else if (a2.選択肢[0] !== 'ぜんぶ(順不同)') {
      ng(`${名} … 先頭が「ぜんぶ」ではない`, a2.選択肢[0])
    } else if (a2.いま !== '') {
      ng(`${名} … 既定が「ぜんぶ」ではない`, `いま「${a2.いま}」`)
    } else if (a2.選択肢.some((x) => !x)) {
      /* **名前の無い曲にも、何か出す**(空の行を出さない) */
      ng(`${名} … 名前の無い曲が、空の行になっている`, a2.選択肢.join(' / '))
    } else if (a2.はみ出し > 0 || a2.よこ > 0) {
      ng(`${名} … 帯からはみ出している`, `帯 ${a2.はみ出し}px / 画面 ${a2.よこ}px`)
    } else {
      ok(`${名} … ぜんぶ + 3曲からえらべる(既定はぜんぶ・はみ出しなし)`)
    }
  }

  /* **1曲しかないときは、欄ごと出さない**(「出ない」側) */
  const one = await 見る(390, '&songs=one')
  if (one.ある) {
    ng('曲をえらぶ … 1曲しかないのに、えらぶ欄が出ている',
      '「ぜんぶ」とその1曲は同じもの(効かない操作を見せない)')
  } else ok('曲をえらぶ … 1曲しかないときは、欄ごと出さない')
}

/* ══════════════════════════════════════════════════════════════════
   やり終えたあとの1枚(第5.193節・2026-09 実機・利用者の指摘)

     > 終わった後のリストの背景の色が途中から切り替わっています。
     > これが、背景が黒の時は時の色と重なって読めなくなります。
     > 下まで白くなるように改善してください。
     > また、下までスクロールしないと「続ける」ボタンがクリックできません。

   **どちらも「描いてみないと分からない」形**である。
   ①白い箱は `flex: 1 1 auto; min-height: 0` で画面ぶんの高さで止まり、
    はみ出した一覧は**地の色の上**に乗っていた(暗い配色では読めない)
   ②ボタンは一覧のいちばん下にあり、**20 問ぶん送らないと届かなかった**

   **本物を描いて、最後まで答えて、測る**(`?screen=qrreal`)。
   ══════════════════════════════════════════════════════════════════ */
{
  for (const w of [390, 1280]) {
    const page = await browser.newPage({ viewport: { width: w, height: 760 } })
    page.setDefaultTimeout(9000)
    await page.goto(`http://localhost:${PORT}/__bar.html?screen=qrreal`,
      { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1500)
    /* 66 の型の冊へ。**いちばん長い一覧になるように、ぜんぶ「まだ」で答える** */
    await 本棚をひらく(page)
    await page.waitForTimeout(300)
    await page.evaluate(() => {
      for (const x of document.querySelectorAll('.shelf-pick')) {
        if ((x.textContent || '').includes('の型')) { x.click(); return }
      }
    })
    await page.waitForTimeout(1500)
    /* **「まだ」を押し切る。** 20 回まで(1回ぶんは 10 問なので足りる) */
    for (let i = 0; i < 20; i += 1) {
      const 押せた = await page.evaluate(() => {
        const b2 = [...document.querySelectorAll('.qr-answers button')]
          .find((x) => (x.textContent || '').trim() === 'まだ')
        if (!b2) return false
        b2.click()
        return true
      })
      if (!押せた) break
      await page.waitForTimeout(120)
    }
    await page.waitForTimeout(500)

    const 見た = await page.evaluate(() => {
      const box = document.querySelector('.qr')
      const res = document.querySelector('.qr-result')
      const row = document.querySelector('.qr-result .btn-row')
      if (!box || !res) return null
      const br = box.getBoundingClientRect()
      const rr = res.getBoundingClientRect()
      const wr = row?.getBoundingClientRect() ?? null
      /* **いちばん下の1行が、白い箱の中にいるか。**
         はみ出していると、そこだけ地の色の上に乗る */
      const 行 = [...document.querySelectorAll('.sresult-miss > li')]
      const 最後 = 行.length ? 行[行.length - 1].getBoundingClientRect() : null
      return {
        行数: 行.length,
        箱の下: Math.round(br.bottom),
        中身の下: Math.round(rr.bottom),
        はみ出し: Math.round(rr.bottom - br.bottom),
        最後の行がはみ出し: 最後 ? Math.round(最後.bottom - br.bottom) : null,
        /* **ボタンが、送らずに押せるか。** 画面の中にいるか見る */
        ボタン: wr ? {
          文: (row.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 20),
          画面内: wr.top >= 0 && wr.bottom <= window.innerHeight + 1,
          貼り付き: window.getComputedStyle(row).position === 'sticky',
          /* **地の色が敷いてあるか。** 透けると下の文字が重なる */
          地: window.getComputedStyle(row).backgroundColor,
        } : null,
        /* いちばん下まで送らずに、その場で押せるか(実際に押してみる) */
        送った: window.scrollY,
      }
    })

    const 名 = `終わりの1枚(${w}px)`
    if (!見た) {
      ng(`${名} … 終わりの画面まで行けなかった`)
    } else if (見た.行数 < 5) {
      ng(`${名} … 一覧が短すぎて、はみ出しを測れない`, `${見た.行数} 行`)
    } else if (見た.はみ出し > 1) {
      ng(`${名} … 白い箱から中身がはみ出している`,
        `${見た.はみ出し}px。暗い配色では、そこだけ同じ色の字になって読めない`)
    } else if (見た.最後の行がはみ出し > 1) {
      ng(`${名} … いちばん下の行が、白い箱の外にいる`,
        `${見た.最後の行がはみ出し}px`)
    } else if (!見た.ボタン) {
      ng(`${名} … つぎへ進むボタンが無い`)
    } else if (!見た.ボタン.貼り付き) {
      ng(`${名} … ボタンが画面に貼り付いていない`,
        '**下まで送らないと押せない** —— 終わったあとに、いちばんしたいことである')
    } else if (!見た.ボタン.画面内) {
      ng(`${名} … ボタンが画面の外にいる`, '送らずに押せること')
    } else if (/rgba\(0, 0, 0, 0\)|transparent/.test(見た.ボタン.地)) {
      ng(`${名} … ボタンの地の色が透けている`,
        '下を流れている文字が、ボタンに重なって読めなくなる')
    } else {
      ok(`${名} … ${見た.行数} 行でも下まで地が続き、`
        + `ボタンは送らずに押せる(${見た.ボタン.文})`)
    }
    await page.close()
  }
}

/* ══════════════════════════════════════════════════════════════════
   自由に書く「中身」の欄(第5.190節・2026-09 利用者の指定)

     > それとも、スピーチの場合は「話す内容(任意)」に追加すると
     > よいでしょうか? もしそうであれば、記事や会話、ほかの
     > トレーニングにもその項目を追加してください。

   直す前はこうだった ——
   スピーチだけ**上に出ていて**、記事・会話・会議は
   **「詳しく設定する(任意)」の中に畳まれ**、文型ドリルと
   単語 / フレーズには**そもそも無かった。**

   **描いて数える。** 「ソースに1つある」だけでは、
   **畳んだ中に入っているのか、外に出ているのか**が分からない。

   ①どの種類でも出るか ②畳まずに見えているか ③1つだけか
   ④呼び名が種類ごとに変わるか ⑤畳んだ箱の中に残っていないか
   ══════════════════════════════════════════════════════════════════ */
{
  /** 新しく作れる種類。**書き写さない** —— 一覧から拾う */
  const { NEW_MATERIAL_KINDS, subjectLabel } =
    await import('../src/data/materialKinds.js')

  const 見た = []
  for (const k of NEW_MATERIAL_KINDS) {
    const page = await browser.newPage({ viewport: { width: 390, height: 900 } })
    page.setDefaultTimeout(8000)
    await page.route('**/rest/v1/**', (r) => r.fulfill({
      status: 200, contentType: 'application/json', body: '[]',
    }))
    await page.goto(`http://localhost:${PORT}/__bar.html?screen=form&kind=${k.id}`,
      { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(500)
    const got = await page.evaluate((want) => {
      /** その名前の欄を、**描かれている位置ごと**拾う */
      const 欄 = [...document.querySelectorAll('label.field')]
        .filter((l) => (l.querySelector('span')?.firstChild?.textContent ?? '')
          .trim() === want)
      /* **畳んだ箱(詳しく設定する)の中にいないか。**
         `checkVisibility()` で見る —— 畳んだ中は `offsetParent` では
         見分けられない(CLAUDE.md) */
      return {
        数: 欄.length,
        見える: 欄.filter((l) => l.checkVisibility?.() ?? true).length,
        /* **1行ではなく、書ける箱であること**(第5.213節)。
           1行だと、注文を2つ3つ書いた先から左へ流れて消える */
        箱: 欄.filter((l) => l.querySelector('textarea')).length,
      }
    }, subjectLabel(k.id))
    await page.close()
    見た.push({ id: k.id, 名: subjectLabel(k.id), ...got })
  }

  const 無い = 見た.filter((x) => x.数 === 0)
  if (無い.length) {
    ng(`書く欄 … ${無い.length} つの種類に出ていない`,
      無い.map((x) => `${x.id}(${x.名})`).join(' / '))
  } else ok(`書く欄 … ${見た.length} つの種類ぜんぶに出る`)

  /* ══ **モノローグは、細かい指定を書けば場面を選ばなくてよい**
       (第5.228節・2026-09 利用者の指定)══════════════════════════

         > モノローグの教材の場面設定は、「細かい指定」に記入した場合には、
         > 選択はオプションに出来ないでしょうか?

     **「出る」と「出ない」の両方を見る**(CLAUDE.md)。
     書く前は出さず、書いたら出て、消したら**場面が戻る** ——
     どちらも空のまま作れてしまう形にしない。
     **ソースを読むだけでは言えない**ので、実際に打ち込んで測る。 */
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 900 } })
    page.setDefaultTimeout(8000)
    await page.route('**/rest/v1/**', (r) => r.fulfill({
      status: 200, contentType: 'application/json', body: '[]',
    }))
    await page.goto(`http://localhost:${PORT}/__bar.html?screen=form&kind=speech`,
      { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(500)
    /** 場面の欄のいま */
    const 見る = () => page.evaluate(() => {
      const 名 = (el) => el?.closest('label')?.querySelector('span')?.textContent?.trim() ?? ''
      const sel = [...document.querySelectorAll('select')]
        .find((x) => 名(x).startsWith('シチュエーション'))
      return {
        欄: !!sel,
        選ばない: sel ? [...sel.options].some((o) => o.value === '') : false,
        値: sel?.value ?? null,
      }
    })
    /** 細かい指定に打ち込む(空文字なら消す) */
    const 書く = (t) => page.evaluate((text) => {
      const 名 = (el) => el?.closest('label')?.querySelector('span')?.textContent?.trim() ?? ''
      const ta = [...document.querySelectorAll('textarea')]
        .find((x) => 名(x).startsWith('細かい指定'))
      if (!ta) return
      const set = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype, 'value').set
      set.call(ta, text)
      ta.dispatchEvent(new Event('input', { bubbles: true }))
    }, t)

    const 前 = await 見る()
    await 書く('新しい安全手順を、現場の全員に伝えるスピーチ')
    await page.waitForTimeout(400)
    const 後 = await 見る()
    await page.evaluate(() => {
      const 名 = (el) => el?.closest('label')?.querySelector('span')?.textContent?.trim() ?? ''
      const sel = [...document.querySelectorAll('select')]
        .find((x) => 名(x).startsWith('シチュエーション'))
      if (sel) { sel.value = ''; sel.dispatchEvent(new Event('change', { bubbles: true })) }
    })
    await page.waitForTimeout(400)
    const 選んだ = await 見る()
    await 書く('')
    await page.waitForTimeout(500)
    const 消した = await 見る()
    await page.close()

    if (!前.欄) {
      ng('場面はオプション … モノローグに場面の欄が無い')
    } else if (前.選ばない) {
      ng('場面はオプション … 細かい指定が空なのに「選ばない」が出ている',
        '**効かない操作を見せない** —— どちらも空のまま作れてしまう')
    } else if (!後.選ばない) {
      ng('場面はオプション … 細かい指定を書いても「選ばない」が出ない')
    } else if (選んだ.値 !== '') {
      ng('場面はオプション … 「選ばない」を選んでも場面が残る', String(選んだ.値))
    } else if (消した.選ばない || !消した.値) {
      ng('場面はオプション … 細かい指定を消しても、場面が戻らない',
        `選ばない ${消した.選ばない} / 値「${消した.値}」。**黙って無指定にしない**`)
    } else {
      ok(`場面はオプション … 書く前は出ない・書けば出る・選べば空(${選んだ.値 === '' ? '空' : 選んだ.値})`
        + `・消せば戻る(${消した.値})`)
    }
  }

  const 二重 = 見た.filter((x) => x.数 > 1)
  if (二重.length) {
    ng('書く欄 … 同じ欄が2つ並んでいる',
      二重.map((x) => `${x.id}: ${x.数} 個`).join(' / '))
  } else ok('書く欄 … どの種類でも1つだけ(2か所に出ていない)')

  const 隠れ = 見た.filter((x) => x.見える === 0)
  if (隠れ.length) {
    ng('書く欄 … 畳んだ中に隠れている',
      隠れ.map((x) => x.id).join(' / ') + '。**選ぶ欄の続きに、そのまま出す**')
  } else ok('書く欄 … どの種類でも、畳まずに見えている')

  /* **呼び名は、どの種類でも同じ**(第5.213節・2026-09 利用者の指定)。

       > 記事や会話、会議も含めた全ての教材を作成する際に、
       > 細かい指定を書き込める欄を作ってください。
       > 現状は文型トレーニングやスピーチ練習にはすでにあります。

     欄は第5.190節で全種類に出ていた。**呼び分けていたせいで、
     同じ物が4つの別物に見えていた。** ここは 2026-09 に
     「種類ごとに変わること」から**逆向きに**書き換えた見張りである。 */
  const 名 = new Set(見た.map((x) => x.名))
  if (名.size !== 1) {
    ng('書く欄 … 呼び名が種類ごとに違う', [...名].join(' / '))
  } else ok(`書く欄 … 呼び名はどの種類でも同じ(${[...名].join('')})`)

  const 一行 = 見た.filter((x) => x.箱 === 0)
  if (一行.length) {
    ng('書く欄 … 1行の入力のままになっている',
      一行.map((x) => x.id).join(' / ') + '。**複数行の箱にする**')
  } else ok('書く欄 … どの種類でも、複数行の箱になっている')
}

/* ══════════════════════════════════════════════════════════════════
   文法解説を作るかどうか(第5.213節・2026-09 利用者の指定)

     > 文法解説をつけるかつけないかを教材を作る時に指定できると最高です

   **既定は「作る」。** いままで必ず作っていたので、既定で外すと
   黙って機能が減る。**押す前に件数と金額を出す**(見えない費用は
   管理できない)。**解説が1つも付かない構成では、出さない。**
   ══════════════════════════════════════════════════════════════════ */
{
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } })
  page.setDefaultTimeout(8000)
  await page.route('**/rest/v1/**', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: '[]',
  }))
  /** 文法解説のチェックと、その下の1行 */
  const 見る = () => page.evaluate(() => {
    const l = [...document.querySelectorAll('label.amount-label')]
      .find((x) => /文法解説も作る/.test(x.textContent))
    if (!l) return { ある: false }
    const box = l.querySelector('input[type="checkbox"]')
    return {
      ある: true,
      入っている: !!box?.checked,
      /* **すぐ隣の1行を読む。** 親から探すと、1つ上の
         「チェックを外した演習は作りません」を拾ってしまう
         (`<>…</>` は DOM を作らないので、兄弟として並んでいる) */
      文: (l.nextElementSibling?.matches?.('p.field-hint')
        ? l.nextElementSibling.textContent : '').replace(/\s+/g, ' ').trim(),
    }
  })

  await page.goto(`http://localhost:${PORT}/__bar.html?screen=form&kind=reading`,
    { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(600)
  const 初め = await 見る()
  if (!初め.ある) ng('文法解説の指定 … 記事の作成画面に出ていない')
  else if (!初め.入っている) {
    ng('文法解説の指定 … 既定で外れている', 'いままで必ず作っていた。既定を下げない')
  } else if (!/\d+ 件/.test(初め.文) || !/およそ [\d.]+ 円/.test(初め.文)) {
    ng('文法解説の指定 … 件数か金額が出ていない', `「${初め.文}」`)
  } else ok(`文法解説の指定 … 記事で出て、既定は「作る」(${初め.文.slice(0, 28)}…)`)

  // **外したら、そう書く**(成功と失敗を同じ見た目で終わらせない)
  if (初め.ある) {
    await page.locator('label.amount-label', { hasText: '文法解説も作る' })
      .locator('input[type="checkbox"]').click()
    await page.waitForTimeout(300)
    const 外し = await 見る()
    if (外し.入っている) ng('文法解説の指定 … 押しても外れない')
    else if (!/課金されません/.test(外し.文)) {
      ng('文法解説の指定 … 外したときに、課金されないことを言っていない', `「${外し.文}」`)
    } else ok('文法解説の指定 … 外すと「そのぶん課金されません」と出る')
  }

  /* **出ない側。** 解説の付く演習を1つも作らない構成では、
     チェックごと出さない(効かない操作を見せない)。
     単語 / フレーズで**フレーズを外す**と、残るのは単語だけになり、
     単語には解説が付かない(1語に S も V も無い・第5.210節) */
  await page.goto(`http://localhost:${PORT}/__bar.html?screen=form&kind=vocab`,
    { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(600)
  const 前 = await 見る()
  const フレーズ = page.locator('label.amount-label', { hasText: 'フレーズ' })
    .locator('input[type="checkbox"]')
  if (!前.ある) ng('文法解説の指定 … 単語 / フレーズで出ていない(フレーズには付く)')
  else if (!await フレーズ.count()) ng('文法解説の指定 … フレーズのチェックが見つからない')
  else {
    await フレーズ.first().click()
    await page.waitForTimeout(300)
    const 後 = await 見る()
    if (後.ある) {
      ng('文法解説の指定 … 単語だけにしても、チェックが残っている',
        '1語に S も V も無い。効かない操作を見せない')
    } else ok('文法解説の指定 … 解説の付く演習が無くなると、チェックごと消える')
  }
  await page.close()
}

/* ══════════════════════════════════════════════════════════════════
   ビジネス必須チャンク集 — 絞り込んだうえで紙に出す(第5.199節)

     > ビジネス必須チャンク集(冊名)、その中の名詞句、その中の-ing、
     > 5WH +SV、などなど。副詞句の中の前置詞句、などなど

     > そして、単語帳、quick responseともに絞り込んだ上での印刷、
     > PDF出力ともにちゃんと出来るようにしてください

   **描いて、絞って、数を読む。** ソースを読んでも
   「画面は 10 語なのに紙は 120 語」は分からない ——
   一覧・聞き流し・紙が**別々に絞っていないか**は、押して数えるしかない。

   **「絞る」と「戻す」の両方を見る**(CLAUDE.md)。
   まとめへ戻せなければ、その段をまるごと練習する道が無くなる。
   ══════════════════════════════════════════════════════════════════ */
{
  const { chunkGroups, chunkPartCount } = await import('../src/lib/chunkBook.js')
  const page = await browser.newPage({ viewport: { width: 420, height: 900 } })
  page.setDefaultTimeout(9000)
  await page.route('**/rest/v1/**', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: '[]',
  }))
  await page.goto(`http://localhost:${PORT}/__bar.html?screen=wordbook&chunk=1`,
    { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)

  /** チャンク集の冊へ移る。**名前は書き写さない**(「チャンク」で拾う) */
  await 本棚をひらく(page)
  const 冊名 = await page.evaluate(() => {
    for (const x of document.querySelectorAll('.shelf-pick')) {
      if ((x.textContent || '').includes('チャンク')) { x.click(); return x.textContent.trim() }
    }
    return ''
  })
  await page.waitForTimeout(1500)
  if (!冊名) ng('チャンク集 … 冊の一覧に出ていない')
  else ok(`チャンク集 … 冊の一覧に出る(${冊名.replace(/\s+/g, ' ')})`)

  /** 欄を開き直す(冊を替えるとシートが畳まれることがある)。
      **開いていたら押さない**(押すと閉じる・第5.200節) */
  const 開く = async () => {
    await 本棚をひらく(page)
    await page.waitForTimeout(300)
  }
  /** 段 / 組の欄。**`.nfunits` の中の `<select>` を順に** */
  const えらぶ = async (i, value) => {
    const got = await page.evaluate(([n, v]) => {
      const sel = [...document.querySelectorAll('.nfunits select')][n]
      if (!sel) return null
      if (![...sel.options].some((o) => o.value === v)) return null
      sel.value = v
      sel.dispatchEvent(new Event('change', { bubbles: true }))
      return sel.options[sel.selectedIndex].textContent.trim()
    }, [i, value])
    await page.waitForTimeout(1200)
    return got
  }
  /**
   * いま画面に出ている数。**聞き流し / 紙 を、それぞれ読む。**
   *
   * **練習が始まると、道具は「出しかた」の中に入る**(第5.191節)。
   * 単語帳は開いた瞬間に始まるので、**絞ったあとはほぼ必ずそちら**である。
   * 見つからなければ「出しかた」を開いてから読み直す ——
   * **道が2つあるものは、いまどちらを通ったかを見えるようにする**(CLAUDE.md)。
   */
  const 数 = async () => {
    let got = await 読む()
    if (got.紙 === null) {
      await page.evaluate(() => { document.querySelector('.rscope-sort')?.click() })
      await page.waitForTimeout(500)
      got = await 読む()
    }
    return got
  }
  /** 描かれているものを、そのまま読む */
  const 読む = () => page.evaluate(() => {
    const 拾う = (re) => {
      for (const b of document.querySelectorAll('button')) {
        const m = re.exec((b.textContent || '').replace(/\s+/g, ''))
        if (m) return Number(m[1])
      }
      return null
    }
    return {
      札: Number((document.querySelector('.wb-tally .num, .tally-n')?.textContent ?? '')
        .replace(/[^0-9]/g, '')) || null,
      聞き流し: 拾う(/聞き流す\((\d+)語\)/),
      紙: 拾う(/印刷\/PDFで保存\((\d+)語\)/),
      題: (document.querySelector('.drill-title')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
    }
  })

  await 開く()
  const 欄 = await page.evaluate(() =>
    [...document.querySelectorAll('.nfunits select')].length)
  if (欄 < 2) ng('チャンク集 … 段と組の欄が2つそろっていない', `いま ${欄} 個`)
  else ok('チャンク集 … 段(中身)と組の欄が、2つとも出る')

  const 全 = await 数()
  /* **絞る。** いちばん小さい組をえらぶ —— 数がはっきり変わる */
  const 組 = chunkGroups('np').filter((g) => g.id).sort((a, b) => a.n - b.n)[0]
  const 組名 = await えらぶ(1, 組.id)
  const 絞 = await 数()
  if (!組名) {
    ng('チャンク集 … 組をえらべない', 組.id)
  } else if (絞.紙 === null || 全.紙 === null) {
    ng('チャンク集 … 印刷のボタンに語数が出ていない', JSON.stringify(絞))
  } else if (絞.紙 !== 組.n) {
    /* **ここが本丸。** 一覧だけ絞れて紙が絞れていないと、
       120 語ぜんぶが刷られる(利用者の指摘そのもの) */
    ng('チャンク集 … 紙に出る数が、絞ったぶんになっていない',
      `${組.label} は ${組.n} 語のはずが、紙は ${絞.紙} 語`)
  } else if (!絞.題.includes(組.label)) {
    ng('チャンク集 … 題が、えらんだ組になっていない', `「${絞.題}」/ ${組.label}`)
  } else {
    ok(`チャンク集 … 絞ると、紙に出る数も題も、その組になる`
      + `(${組.label} ${組.n} 語)`)
  }

  /* **戻せるか。** まとめへ戻せなければ、段をまるごと練習する道が無い。

     **「さっきの数に戻ったか」では見ない。** さっきの数も同じ仕組みが
     出しているので、**まとめが 7 語しか出さない形**に壊しても
     7 → 7 でそろってしまい、緑のままになる(赤チェックで踏んだ)。
     **名簿が持っている、その段ぜんぶの数**と突き合わせる */
  await えらぶ(1, '')
  const 戻 = await 数()
  if (戻.紙 !== chunkPartCount('np')) {
    ng('チャンク集 … 「まとめ」に戻しても、その段ぜんぶにならない',
      `${chunkPartCount('np')} 語のはずが ${戻.紙}`)
  } else ok(`チャンク集 … 「まとめ」に戻すと、その段ぜんぶに戻る(${戻.紙} 語)`)

  /* **段を替えたら、組は「まとめ」に戻る。**
     残すと、その段に無い組が選ばれたままになる(0件の画面) */
  await えらぶ(1, chunkGroups('np').filter((g) => g.id)[0].id)
  await えらぶ(0, 'adv')
  const 段 = await page.evaluate(() => {
    const sel = [...document.querySelectorAll('.nfunits select')][1]
    return sel ? { 値: sel.value, 文: sel.options[sel.selectedIndex].textContent.trim() } : null
  })
  if (!段) ng('チャンク集 … 段を替えたあと、組の欄が消えた')
  else if (段.値 !== '') {
    ng('チャンク集 … 段を替えても、前の段の組が残っている', 段.文)
  } else ok(`チャンク集 … 段を替えると、組は「まとめ」に戻る(${段.文})`)

  /* ── **出題そのものも絞れているか** ───────────────────────────
     聞き流しと紙は、どちらも「画面に出ている一覧」から作る
     (`forScope = shownRows`)。**同じ1つを2通りに数えているだけ**なので、
     片方を壊してももう片方で捕まる —— つまり**あちらを数えても、
     出題が絞れているかは分からない**(赤チェックで判った)。

     出題は別の道(`poolNow`)を通る。**組み上がった問の数**は
     帯の区切りの数がそのまま出しているので、そこを数える ——
     **出す語数(10)より小さい組**をえらべば、上限に当たらず、
     組の数がそのまま出る(`いつ` は 6 語)。 */
  const 小 = chunkGroups('adv').filter((g) => g.id).sort((a, b) => a.n - b.n)[0]
  const 前 = await page.evaluate(() => document.querySelectorAll('.drill-bar span').length)
  await えらぶ(1, 小.id)
  const 区切り = await page.evaluate(() => document.querySelectorAll('.drill-bar span').length)
  if (小.n >= 前) {
    ok(`チャンク集 … 出題の数は測らない(いちばん小さい組 ${小.n} が、出す語数 ${前} 以上)`)
  } else if (区切り !== 小.n) {
    ng('チャンク集 … 出す問が、絞ったぶんになっていない',
      `${小.label} は ${小.n} 語のはずが、帯は ${区切り} 区切り`)
  } else {
    ok(`チャンク集 … 出題そのものも、その組だけから組む(${前} → ${区切り} 区切り)`)
  }

  await page.close()

  /* ── Quick Response のほうも、同じ約束を果たしているか ─────────────
     利用者の指定は「**単語帳、quick responseともに**」である。
     **型で絞って、紙に出る問の数がそのぶんになるか**を数える ——
     題だけ直して中身が絞れていなければ、直したことにならない */
  const qp = await browser.newPage({ viewport: { width: 420, height: 900 } })
  qp.setDefaultTimeout(9000)
  await qp.goto(`http://localhost:${PORT}/__bar.html?screen=qrreal`,
    { waitUntil: 'domcontentloaded' })
  await qp.waitForTimeout(1500)
  await 本棚をひらく(qp)
  await qp.evaluate(() => {
    for (const x of document.querySelectorAll('.shelf-pick')) {
      if ((x.textContent || '').includes('の型')) { x.click(); return }
    }
  })
  await qp.waitForTimeout(1500)
  await 本棚をひらく(qp)
  await qp.waitForTimeout(300)

  /** 紙のボタンの問数。**練習中は「出しかた」の中に入っている** */
  const 問数 = async () => {
    const 拾う = () => qp.evaluate(() => {
      for (const b of document.querySelectorAll('button')) {
        const m = /印刷\/PDFで保存\((\d+)問\)/.exec((b.textContent || '').replace(/\s+/g, ''))
        if (m) return Number(m[1])
      }
      return null
    })
    let n = await 拾う()
    if (n === null) {
      await qp.evaluate(() => { document.querySelector('.rscope-sort')?.click() })
      await qp.waitForTimeout(500)
      n = await 拾う()
    }
    return n
  }

  const 型なし = await 問数()
  /* **型を1つえらぶ。** 欄に出ている数と、紙の数を突き合わせる ——
     **札の数は欄が持っている**ので、こちらで数え直さない */
  const えらび = await qp.evaluate(() => {
    const sel = [...document.querySelectorAll('select')].find((x) => x.options.length > 50)
    if (!sel) return null
    /* 「〜系ぜんぶ」ではなく、**型ひとつ**をえらぶ(数がはっきり決まる) */
    const opt = [...sel.options].find((o) => /\(\d+ 問\)$/.test(o.textContent.trim())
      && !/ぜんぶ/.test(o.textContent))
    if (!opt) return null
    sel.value = opt.value
    sel.dispatchEvent(new Event('change', { bubbles: true }))
    return { 文: opt.textContent.trim(), n: Number(/\((\d+) 問\)$/.exec(opt.textContent.trim())[1]) }
  })
  await qp.waitForTimeout(1600)
  await qp.evaluate(() => { document.querySelector('.sheet-back')?.click() })
  await qp.waitForTimeout(400)
  const 型あり = await 問数()
  const 題 = await qp.evaluate(() =>
    (document.querySelector('.drill-title')?.textContent ?? '').replace(/\s+/g, ' ').trim())

  if (!えらび) {
    ng('Quick Response の紙 … 型をえらぶ欄が出ない')
  } else if (型なし === null || 型あり === null) {
    ng('Quick Response の紙 … 印刷のボタンに問数が出ていない', `${型なし} → ${型あり}`)
  } else if (型あり !== えらび.n) {
    ng('Quick Response の紙 … 紙に出る数が、絞ったぶんになっていない',
      `${えらび.文} のはずが、紙は ${型あり} 問`)
  } else if (型あり >= 型なし) {
    ng('Quick Response の紙 … 絞っても、数が減っていない', `${型なし} → ${型あり}`)
  } else if (!題) {
    ng('Quick Response の紙 … いま出しているものの題が無い')
  } else {
    ok(`Quick Response の紙 … 型で絞ると、紙もそのぶんになる`
      + `(${型なし} → ${型あり} 問・${題})`)
  }
  await qp.close()
}

/* ══════════════════════════════════════════════════════════════════
   言い換えは、英文を英文に言い換える(第5.198節・2026-09 実機・利用者の指摘)

     > 14の型の「言い換え」トレーニングが機能していません。
     > 日本語→英語と同じになってしまっています。「言い換え」は英語が
     > 書いてあり、それを型に則って別の形の英語で言い換えるトレーニングです。
     > ヒントを押せば使う型が表示され、訳を見るを押せば日本語訳も見れる

   **本物の `QrReview` を描いて、中身を切り替えて、出ているものを読む。**
   写した骨組みでは、**問がどちらの文になるか**を1ミリも測れない ——
   壊れていたのは `frameQr.js` が素の英文を落としていたところで、
   そこは行の形を見ないと分からない。

   **「出る」と「出ない」の両方を見る**(CLAUDE.md)。
   日本語 → 英語のほうまで英文になってしまっては、直したことにならない。
   ══════════════════════════════════════════════════════════════════ */
{
  const page = await browser.newPage({ viewport: { width: 420, height: 900 } })
  page.setDefaultTimeout(9000)
  await page.goto(`http://localhost:${PORT}/__bar.html?screen=qrreal`,
    { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)

  /** 66 の型の冊へ移る。**名前は書き写さない**(「の型」で拾う) */
  await 本棚をひらく(page)
  await page.waitForTimeout(300)
  await page.evaluate(() => {
    for (const x of document.querySelectorAll('.shelf-pick')) {
      if ((x.textContent || '').includes('の型')) { x.click(); return }
    }
  })
  await page.waitForTimeout(1400)

  /** 中身(日本語 → 英語 / 言い換え)を、何番目かで選ぶ */
  const 中身を = async (i) => {
    await 本棚をひらく(page)
    const 名 = await page.evaluate((n) => {
      const s2 = [...document.querySelectorAll('select')].find((x) => x.options.length === 2)
      if (!s2) return null
      s2.value = s2.options[n].value
      s2.dispatchEvent(new Event('change', { bubbles: true }))
      return s2.options[n].textContent.trim()
    }, i)
    await page.waitForTimeout(1500)
    await page.evaluate(() => { document.querySelector('.sheet-back')?.click() })
    await page.waitForTimeout(500)
    return 名
  }

  const 見る = () => page.evaluate(() => ({
    /* **出題の英文と、日本語の問は、別の場所である。**
       どちらが描かれているかで、どちらの練習かが決まる */
    出題英: (document.querySelector('.qr-ask')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
    出題和: (document.querySelector('.qr-ja')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
    訳: (document.querySelector('.qr-ask-ja')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
    札: (document.querySelector('.qr-frame')?.textContent ?? '')
      .replace(/^型/, '').replace(/\s+/g, ' ').trim(),
    ボタン: [...document.querySelectorAll('.qr-peek button')]
      .map((x) => (x.textContent || '').trim()).filter(Boolean),
    /* **箱そのものが押すもの**(第5.262節・2026-09-26 利用者の指定)。
       「英語を見る / 答えを見る」のボタンは廃止したので、
       **言葉は読み上げの名前(`aria-label`)に移った。**
       文字を消しただけで、**言葉は消していない**(黙って消さない) */
    箱: document.querySelector('.qr-body--tap')?.getAttribute('aria-label') ?? '',
  }))
  /* **ボタンの文字でも、箱の読み上げの名前でも探す**(第5.262節)。
     「答えを見る」はボタンから箱へ移ったが、「訳を見る」はボタンのままである */
  const 押す = async (名) => page.evaluate((t) => {
    const b2 = [...document.querySelectorAll('.qr-peek button')]
      .find((x) => (x.textContent || '').trim() === t)
    if (b2) { b2.click(); return true }
    const box = document.querySelector('.qr-body--tap')
    if (box && box.getAttribute('aria-label') === t) { box.click(); return true }
    return false
  }, 名)

  /* ── ① 日本語 → 英語(冊に入った時点の既定)────────────────────
     **こちらを先に見る。** 答えを開いたあとに戻そうとすると、
     シートの開き直しに引っかかって**測れていないのに緑**になりかねない。
     **「出ない」側を、いちばん確かな場所で見ておく** */
  await page.evaluate(() => { document.querySelector('.sheet-back')?.click() })
  await page.waitForTimeout(500)
  const 和 = await 見る()
  if (和.出題英) {
    ng('日本語 → 英語 … こちらまで英文が問になっている', 和.出題英.slice(0, 40))
  } else if (!和.出題和) {
    ng('日本語 → 英語 … 日本語の問が出ていない', JSON.stringify(和).slice(0, 120))
  } else if (和.ボタン.includes('訳を見る')) {
    ng('日本語 → 英語 … 効かない「訳を見る」が出ている', 和.ボタン.join(' / '))
  } else if (和.ボタン.includes('英語を見る')) {
    /* **ボタンは廃止した**(第5.262節)。残っていたら、箱と同じことをする
       ものが2つ並ぶ(同じことをするものを2つ見せない・CLAUDE.md) */
    ng('日本語 → 英語 … 廃止したはずの「英語を見る」ボタンが残っている',
      和.ボタン.join(' / '))
  } else if (和.箱 !== '英語を見る') {
    ng('日本語 → 英語 … 箱の読み上げの名前が「英語を見る」ではない',
      `いま「${和.箱}」`)
  } else {
    ok(`日本語 → 英語 … これまでどおり日本語が問(${和.出題和.slice(0, 30)})`)
  }

  // ── ② 言い換え(2番目の中身)────────────────────────────────
  const 言い換え名 = await 中身を(1)
  const 言 = await 見る()
  if (!言い換え名) {
    ng('言い換え … 中身をえらぶ欄が出ない')
  } else if (!言.出題英) {
    ng(`言い換え … 出題が英文になっていない(${言い換え名})`,
      `いま出ているのは「${言.出題和.slice(0, 40)}」—— これでは和文英訳のままである`)
  } else if (言.出題和) {
    ng('言い換え … 英文と日本語が、両方とも問として出ている', 言.出題和.slice(0, 40))
  } else if (!/[A-Za-z]/.test(言.出題英)) {
    ng('言い換え … 出題が英語でない', 言.出題英.slice(0, 40))
  } else {
    ok(`言い換え … 出題が英文になっている(${言.出題英.slice(0, 44)})`)
  }

  /* **押す前に、訳は出ていない。** 既定で出していたら、
     読む前に答えが見えてしまう(「訳を見る」の意味が無い)。
     **`ok(条件, …)` と書かない** —— この検証の `ok()` は文字を出すだけで、
     条件を渡すと `✓ true` と出て**失敗しようがない**(CLAUDE.md) */
  if (言.訳) ng('言い換え … 押していないのに、訳が出ている', 言.訳.slice(0, 40))
  else ok('言い換え … 訳は、押すまで出ない')

  /* **名前は、中身で変わる。** 出題が英語なのに「英語を見る」とは書けない。
     **答えを開く言葉は、箱の読み上げの名前へ移った**(第5.262節) */
  const 名前 = `箱「${言.箱}」/ ボタン ${言.ボタン.join(' / ')}`
  if (言.箱 === '英語を見る') {
    ng('言い換え … 出題が英語なのに、箱が「英語を見る」と名乗っている', 名前)
  } else if (言.箱 !== '答えを見る') {
    ng('言い換え … 箱が「答えを見る」と名乗っていない', 名前)
  } else if (!言.ボタン.includes('訳を見る')) {
    ng('言い換え … 「訳を見る」が無い(日本語にたどり着けない)', 名前)
  } else ok(`言い換え … 箱は「答えを見る」、ボタンに「訳を見る」(${名前})`)

  // ── ③ 訳を押したら、日本語が出るか ───────────────────────────
  const 押せた = await 押す('訳を見る')
  await page.waitForTimeout(400)
  const 訳後 = await 見る()
  if (!押せた) {
    ng('言い換え … 「訳を見る」を押せない')
  } else if (!訳後.訳) {
    ng('言い換え … 「訳を見る」を押しても、訳が出ない')
  } else if (!/[ぁ-んァ-ヶ一-龠]/.test(訳後.訳)) {
    ng('言い換え … 出たものが日本語でない', 訳後.訳.slice(0, 40))
  } else if (訳後.出題英 !== 言.出題英) {
    /* **訳を出しても、出題は消えない。** 消えると見比べられない */
    ng('言い換え … 訳を出すと、出題の英文が消える')
  } else ok(`言い換え … 「訳を見る」で日本語が出る(${訳後.訳.slice(0, 30)})`)
  /* **もう一度押したら引っ込む。** 行き止まりを作らない */
  await 押す('訳を隠す')
  await page.waitForTimeout(300)
  const 隠した = await 見る()
  if (隠した.訳) ng('言い換え … 「訳を隠す」を押しても隠れない', 隠した.訳.slice(0, 40))
  else ok('言い換え … 「訳を隠す」で、また隠れる')

  // ── ④ 答えは、別の英文か ─────────────────────────────────
  await 押す('答えを見る')
  await page.waitForTimeout(500)
  const 答 = await page.evaluate(() => ({
    英文: (document.querySelector('.qr-en')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
    ボタン: [...document.querySelectorAll('.qr-peek button')]
      .map((x) => (x.textContent || '').trim()).filter(Boolean),
    /* 開いたあとも、**戻せることが名前で分かるか**(第5.262節) */
    箱: document.querySelector('.qr-body--tap')?.getAttribute('aria-label') ?? '',
  }))
  const そろえる = (t) => String(t).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  if (!答.英文) {
    ng('言い換え … 「答えを見る」を押しても、答えが出ない')
  } else if (そろえる(答.英文) === そろえる(言.出題英)) {
    ng('言い換え … 答えが、出題とまったく同じ文である', 答.英文.slice(0, 60))
  } else if (答.箱 !== '答えを隠す') {
    /* **開いたあとは「隠す」に変わる。** 変わらないと、
       読み上げでは開いているのか閉じているのか分からない */
    ng('言い換え … 開いたあと、箱の名前が「答えを隠す」に変わっていない',
      `いま「${答.箱}」`)
  } else ok(`言い換え … 答えは別の英文になる(${答.英文.slice(0, 44)})`)

  await page.close()
}

/* ══════════════════════════════════════════════════════════════════
   読み方 —— 訛りと感情を、都度えらぶ(第5.196節・2026-09 利用者の指定)

     > 発音について、訛りと感情どちらを重視するか都度指定させてください。

   **描いて数える。** ソースに `READ_STYLES.map(` が1つあるだけでは、
   ①本当に画面に出ているのか ②畳んだ中に隠れていないか
   ③良い声がいない訛りで消えるか(効かない操作を見せない)
   ④作り直しの欄で、**いまの読み方が入っているか**
   —— どれも分からない。

   **「出る」と「出ない」の両方を見る**(CLAUDE.md)。片方だけだと、
   **どこにも出さない形・どの訛りでも出す形**に書き換えても緑になる。
   ══════════════════════════════════════════════════════════════════ */
{
  const { READ_STYLES, voicesOfAccent, CLIP_ACCENTS } =
    await import('../src/data/clipVoices.js')
  /** その画面の読み方の欄を返す。**開いたままにして、選び直せるようにする** */
  const 開く = async (url) => {
    const page = await browser.newPage({ viewport: { width: 390, height: 900 } })
    page.setDefaultTimeout(8000)
    await page.route('**/rest/v1/**', (r) => r.fulfill({
      status: 200, contentType: 'application/json', body: '[]',
    }))
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(500)
    return page
  }

  /** 読み方の欄を、**描かれているとおりに**拾う */
  const 測る = async (page) => {
    const got = await page.evaluate(() => {
      const 欄 = [...document.querySelectorAll('label.field')]
        .filter((l) => (l.querySelector('span')?.firstChild?.textContent ?? '')
          .trim() === '声の出し方')
      const sel = 欄[0]?.querySelector('select')
      /* **代償の1行は、`tip` ではない。** 説明の文を消している人にも
         出ていなければならないので、**見えているかどうかまで見る** */
      const hint = 欄[0]?.querySelector('.field-hint')
      return {
        数: 欄.length,
        /* **畳んだ中にいないか。** `checkVisibility()` で見る */
        見える: 欄.filter((l) => l.checkVisibility?.() ?? true).length,
        文: sel ? [...sel.options].map((o) => o.textContent.trim()) : [],
        いま: sel ? sel.value : null,
        代償: (hint?.checkVisibility?.() ?? !!hint) ? (hint?.textContent ?? '').trim() : '',
        /* **選択肢が、閉じたまま読み切れるか。**
           `<select>` は `scrollWidth` が伸びない —— **あれでは測れない**
           (実際に長い名前に差し替えても緑のままだった)。
           **同じ字で描いた幅**と、中身の入る幅(内側の幅 − 余白 − 三角)を
           突き合わせる。選択肢を長くしたら赤くなる */
        切れ: (() => {
          if (!sel) return false
          const cs = window.getComputedStyle(sel)
          const ruler = document.createElement('span')
          ruler.style.cssText = 'position:absolute;visibility:hidden;white-space:pre'
          ruler.style.font = cs.font
          ruler.style.letterSpacing = cs.letterSpacing
          document.body.appendChild(ruler)
          const 入る = sel.clientWidth
            - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 26
          let 出た = false
          for (const o of sel.options) {
            ruler.textContent = o.textContent
            if (ruler.offsetWidth > 入る) 出た = true
          }
          ruler.remove()
          return 出た
        })(),
      }
    })
    return got
  }
  /** 開いて、測って、閉じる(1回きりのとき) */
  const 読む = async (url) => {
    const page = await 開く(url)
    const got = await 測る(page)
    await page.close()
    return got
  }

  const 作る = await 読む(`http://localhost:${PORT}/__bar.html?screen=form&kind=reading`)
  if (作る.数 === 0) {
    ng('声の出し方 … 教材を作る画面に出ていない', '訛りと感情をえらぶ欄が要る')
  } else if (作る.見える === 0) {
    ng('声の出し方 … 畳んだ中に隠れている', '声をえらぶ流れの中に、そのまま出す')
  } else if (作る.数 > 1) {
    ng('声の出し方 … 同じ欄が2つ並んでいる', `${作る.数} 個`)
  } else ok(`声の出し方 … 教材を作る画面に、畳まずに出る(いま「${作る.いま}」)`)

  /* **選択肢は2つとも、名簿のとおりか。** 画面で書き直すと、
     名簿を直しても画面が古いままになる(呼び名を2か所に書かない) */
  const 名簿の文 = READ_STYLES.map((st) => st.label)
  if (String(作る.文) !== String(名簿の文)) {
    ng('声の出し方 … 選択肢が名簿(READ_STYLES)のとおりでない',
      `画面 ${作る.文.join(' / ')}\n    名簿 ${名簿の文.join(' / ')}`)
  } else if (作る.切れ) {
    ng('声の出し方 … 選択肢が 390px で切れている', `${作る.文.join(' / ')}`)
  } else ok(`声の出し方 … 選択肢は名簿のとおりで、390px でも切れない(${作る.文.join(' / ')})`)

  /* **失うほうが、画面に出ているか**(第5.192節で踏んだところ)。
     **2つとも選び直して、実際に描かれた1行を読む** ——
     片方だけだと、**いつも同じ1行を出す形**に書き換えても緑になる。
     `tip` を付けていないので、説明の文を消していても出ていなければならない */
  {
    const page = await 開く(`http://localhost:${PORT}/__bar.html?screen=form&kind=reading`)
    const 見た = []
    for (const st of READ_STYLES) {
      await page.selectOption('label.voice-style select', st.id)
      await page.waitForTimeout(150)
      見た.push({ id: st.id, ...(await 測る(page)) })
    }
    await page.close()
    const 無 = 見た.filter((x) => !x.代償.includes('訛り'))
    const 同 = new Set(見た.map((x) => x.代償)).size < READ_STYLES.length
    if (無.length) {
      ng('声の出し方 … 「訛り」がどうなるかが、画面に出ていない',
        無.map((x) => `${x.id}「${x.代償}」`).join(' / '))
    } else if (同) {
      ng('声の出し方 … どちらを選んでも、同じ1行しか出ない',
        見た.map((x) => x.代償).join(' / '))
    } else {
      ok(`声の出し方 … 選ぶたびに、失うほうが出る(${見た.map((x) => `${x.id}: ${x.代償}`).join(' / ')})`)
    }
  }

  /* ③ **良い声が1人もいない訛りでは、出ない。**
     標準の段(Google / Azure)に `stability` は無く、どちらを選んでも
     同じ音が鳴る —— **効かない操作を見せない**(CLAUDE.md)。
     **一覧から拾う**(どの訛りに声がいないかを書き写さない) */
  const 声なし = CLIP_ACCENTS.find((a) => voicesOfAccent(a.id, 'narration').length === 0)
  if (!声なし) {
    ok('声の出し方 … 声のいない訛りが1つも無いので、消える側は測れない')
  } else {
    const 消える = await 読む(
      `http://localhost:${PORT}/__bar.html?screen=form&kind=reading&accent=${声なし.id}`)
    if (消える.数 > 0) {
      ng(`声の出し方 … 良い声のいない訛り(${声なし.label})でも出ている`,
        '標準の段に stability は無く、えらんでも何も変わらない')
    } else ok(`声の出し方 … 良い声のいない訛り(${声なし.label})では出ない`)
  }

  /* ④ **作り直しの欄。** ここが無いと、作ったあとで読み方だけを
     変える道がどこにも無い。**いまの読み方が入っているか**も見る
     ——既定に戻っていると、押しただけで読み方が変わり、課金される */
  const 直す = await 読む(`http://localhost:${PORT}/__bar.html?screen=remake`)
  const 直す感情 = await 読む(
    `http://localhost:${PORT}/__bar.html?screen=remake&style=emotion`)
  if (直す.数 === 0 || 直す.見える === 0) {
    ng('声の出し方 … 音声を作り直す欄に出ていない', '作ったあとで変える道が無くなる')
  } else if (直す.いま === 直す感情.いま) {
    /* **両方見る。** 片方だけだと、**いつも同じ値を出す形**に
       書き換えても緑のままになる */
    ng('声の出し方 … 作り直しの欄が、いまの読み方を読んでいない',
      `訛りの教材も感情の教材も「${直す.いま}」で開く`)
  } else if (直す.いま !== 'accent' || 直す感情.いま !== 'emotion') {
    ng('声の出し方 … 作り直しの欄が、教材と違う読み方で開く',
      `訛りの教材 → ${直す.いま} / 感情の教材 → ${直す感情.いま}`)
  } else ok('声の出し方 … 作り直しの欄は、その教材の読み方で開く(訛り / 感情)')

  /* **押す前に、何で作るのかが読めるか。** 声の名前だけだと、
     いま訛りと感情のどちらで作ろうとしているのかが分からない */
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 900 } })
    page.setDefaultTimeout(8000)
    await page.goto(`http://localhost:${PORT}/__bar.html?screen=remake&style=emotion`,
      { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(400)
    const 札 = await page.evaluate(() => (
      document.querySelector('.voice-remake-cast')?.textContent ?? ''))
    await page.close()
    const 名 = READ_STYLES.find((st) => st.id === 'emotion').label
    if (!札.includes(名)) {
      ng('声の出し方 … 作り直しの札に、読み方が出ていない', `いま「${札.trim()}」`)
    } else ok(`声の出し方 … 作り直しの札に読み方が出る(${札.trim()})`)
  }
}

/* ══════════════════════════════════════════════════════════════════
   アサインする(第5.181節 / 第5.186節・2026-09 利用者の指定)

     > 新しい冊をアサインするのは各ゲストの単語帳もquick response帳、
     > もしくは「アサインする」の機能を作り…

     > 教材のアサイン内に説明は一才必要ありません。消してください。
     > シンプルに単語帳とquick responseの冊を選ぶ方法と同じ仕様に…

   **どちらの帳面の冊かを、画面で振り分けない**(`featuresIn()`)。
   片方だけ描いていると、振り分けを壊しても気づけないので、
   **単語帳の冊と Quick Response の冊を、2つとも数える。**

   **色だけに頼らない**(CLAUDE.md)—— 印(●/○)と `aria-pressed` の
   両方を見る。文字は消したので、**ここが最後の砦**である。
   ══════════════════════════════════════════════════════════════════ */
{
  const 見る = async (q = '') => {
    const page = await browser.newPage({ viewport: { width: 390, height: 900 } })
    await page.goto(`http://localhost:${PORT}/__bar.html?screen=assign${q}`,
      { waitUntil: 'networkidle' })
    await page.waitForTimeout(200)
    const r = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('.card')]
      const 見出しの = (c) => (c.querySelector('.card-title')?.textContent ?? '').trim()
      /* ── **役目が違う束を、同じ数え方でまとめない**(第5.202節・2026-09)
       *
       *   RIZAP ENGLISH の教材が、**同じ `.shelf` の見た目を借りて**
       *   3つめの束として並んだ。ところがここは画面ぜんぶを数えていたので、
       *   **「2つ」と決め打った行が2本とも赤くなった。**
       *   数を増やして黙らせると、**振り分けを壊しても緑**になる。
       *   だから**束ごとに分けて、それぞれを数える。**
       *
       *   ・冊(単語帳 / Quick Response)… `aria-pressed` で出す / 外す
       *   ・教材(RIZAP)… 出したら戻せないので、**印は持たない** */
      const 教材カード = cards.find((c) => /RIZAP/.test(見出しの(c))) ?? null
      const 冊カード = cards.filter((c) => c !== 教材カード)
      const 中の = (root, sel) => (root ? [...root.querySelectorAll(sel)] : [])
      const 名の = (b) => (b.querySelector('.shelf-name')?.textContent ?? '').trim()
      /* **素の冊だけ**(中に区切りがある冊は `aria-expanded` を持つ)。
         **役目が違うものを、同じ数え方でまとめない** */
      const rows = 冊カード.flatMap((c) => 中の(c, '.assignshelf .shelf-row'))
        .filter((x) => x.querySelector('.shelf-pick[aria-pressed]'))
      return {
        見出し: cards.map((c) => c.querySelector('.card-title')?.textContent ?? ''),
        /* **教材の束も、冊と同じ見た目を借りているか**(第5.186節・第5.202節)。
           同じページに3つ並ぶので、1つだけ作りが違うと考えさせる */
        教材の形: 教材カード && 教材カード.querySelector('.assignshelf.shelf') ? 1 : 0,
        /* **教材はどれも開ける**(UNIT をえらぶプルダウンが中にある) */
        教材の開く: 中の(教材カード, '.shelf-pick[aria-expanded]').map(名の),
        /* **教材の行は、出す / 外すの印を持たない**(戻す操作がここに無い)。
           同じ印を、違う意味で使わない */
        教材の印: 中の(教材カード, '.shelf-pick[aria-pressed], .shelf-mark').length,
        札: rows.map((x) => {
          const b = x.querySelector('button')
          return {
            名: (x.querySelector('.shelf-name')?.textContent ?? '').trim(),
            印: (x.querySelector('.shelf-mark')?.textContent ?? '').trim(),
            押した: b?.getAttribute('aria-pressed'),
            止めて: !!b?.disabled,
            /* **説明は1つも無い**(利用者の指定)。
               行の中に `.field-hint` が残っていたら赤くする */
            説明: x.querySelectorAll('.field-hint, .tip').length,
          }
        }),
        /* **開く冊は、開く合図を持つ**(押すと何が起きるか) */
        開く: 冊カード.flatMap((c) => 中の(c, '.assignshelf .shelf-pick[aria-expanded]'))
          .map(名の),
        /* **冊のえらび方と、同じ見た目か。** `.shelf` を着ていなければ
           別の見た目になっている(「同じ仕様に」が守れていない) */
        同じ形: 冊カード.filter((c) => c.querySelector('.assignshelf.shelf')).length,
        はみ出し: Math.round(document.body.scrollWidth - document.body.clientWidth),
      }
    })
    await page.close()
    return r
  }

  const a = await 見る()
  /* **2つの帳面が、別の見出しで並ぶ**(振り分けが効いている) */
  if (a.見出し.some((t) => /単語帳の冊/.test(t)) && a.見出し.some((t) => /Quick Response の冊/.test(t))) {
    ok('アサイン … 単語帳の冊と Quick Response の冊が、別々に並ぶ')
  } else ng('アサイン … 帳面ごとに分かれていない', a.見出し.join(' / '))
  if (a.札.length >= 2) ok(`アサイン … 出せる冊が ${a.札.length} 並ぶ`)
  else ng('アサイン … 冊が並んでいない', String(a.札.length))
  /* **冊をえらぶのと、同じ見た目**(第5.186節・利用者の指定)。
     `.shelf` を外して別の見た目に戻したら赤くなる */
  if (a.同じ形 === 2) ok('アサイン … 単語帳の冊をえらぶのと、同じ見た目(`.shelf`)')
  else ng('アサイン … 冊のえらび方と見た目が違う', `${a.同じ形} / 2`)
  /* **色だけに頼らない。** 印と `aria-pressed` の両方が、同じことを言う */
  const そろう = a.札.every((x) => (x.押した === 'true' ? x.印 === '●' : x.印 === '○'))
  if (そろう) ok('アサイン … 印(●/○)と aria-pressed が合う')
  else ng('アサイン … 印と読み上げが食い違う', a.札.map((x) => `${x.名}${x.印}[${x.押した}]`).join(' / '))
  /* **出ている冊と、出ていない冊の両方**を描いている
     (片方だけだと、いつも「出している」に書き換えても緑のまま) */
  const 両方 = a.札.some((x) => x.押した === 'true') && a.札.some((x) => x.押した === 'false')
  if (両方) ok('アサイン … 出している冊と、出していない冊の両方がある')
  else ng('アサイン … 片方しか描いていない(見張りが効かない)')
  /* **説明は1つも無い**(2026-09 利用者の指定「説明は一才必要ありません」) */
  if (a.札.every((x) => x.説明 === 0)) ok('アサイン … どの冊にも説明が付いていない')
  else ng('アサイン … 説明が残っている冊がある',
    a.札.filter((x) => x.説明 > 0).map((x) => x.名).join(' / '))
  /* **中に区切りがある冊は、開く合図を持つ**(押すと何が起きるか)。
     業種べつ(単語帳)と Native Flow(Quick Response)の2つ */
  if (a.開く.length === 2) ok(`アサイン … 中に区切りがある冊は開ける(${a.開く.join(' / ')})`)
  else ng('アサイン … 開ける冊が2つではない', a.開く.join(' / '))

  /* ── **RIZAP ENGLISH の教材**(第5.202節・利用者の指定)─────────
   *
   *   > 教材のアサインのページから Conversation1、2、3、
   *   > Business Conversation 1、2 をアサインできるようにしてください。
   *
   *   **冊と同じ見た目を借りる**が、**役目は違う**(出したら戻せない)。
   *   だから「同じ見た目か」と「印を持たないか」を、**両方**見る ——
   *   片方だけだと、冊のほうへ寄せすぎても・離しすぎても緑のままになる。 */
  if (a.教材の形 === 1) ok('アサイン … RIZAP の教材も、冊と同じ見た目(`.shelf`)')
  else ng('アサイン … RIZAP の教材だけ、見た目が違う', `${a.教材の形} / 1`)
  if (a.教材の開く.length === RIZAP_BOOKS.length) {
    ok(`アサイン … RIZAP の冊は ${a.教材の開く.length} 冊とも開ける(${a.教材の開く[0]} …)`)
  } else ng('アサイン … RIZAP の冊の数が合わない',
    `${a.教材の開く.length} / ${RIZAP_BOOKS.length}(${a.教材の開く.join(' / ')})`)
  /* **出す / 外すの印を、違う意味で使わない**(一度出したら戻す操作が無い) */
  if (a.教材の印 === 0) ok('アサイン … RIZAP の教材には、出す / 外すの印を付けない')
  else ng('アサイン … RIZAP の教材に、冊と同じ印が付いている', String(a.教材の印))
  if (a.はみ出し === 0) ok('アサイン … 390px で横にはみ出さない')
  else ng('アサイン … 横にはみ出す', `${a.はみ出し}px`)

  /* **1つも出していない形も見る**(「出ない」側)。
     **全部 ● にする形に壊しても緑のまま**にならないようにする */
  const c = await 見る('&assign=none')
  if (c.札.every((x) => x.印 === '○' && x.押した === 'false')) {
    ok('アサイン … 1つも出していないときは、ぜんぶ ○ になる')
  } else ng('アサイン … 出していないのに ● が付いている',
    c.札.map((x) => `${x.名}${x.印}`).join(' / '))

  /* **決めている最中は、二度押させない** */
  const b = await 見る('&busy=on')
  if (b.札.every((x) => x.止めて)) ok('アサイン … 決めている最中は押せない')
  else ng('アサイン … 決めている最中も押せてしまう')
}

/* ══════════════════════════════════════════════════════════════════
   説明の文は、既定では出さない(2026-09 利用者の指定)

     > 全てのデザインから言葉による説明を省いてください。
     > 目指すのは説明がない、直感的なUIです。
     > tool tipモードをオンにすればカーソルを当てた時に
     > ポップアップするくらいの扱いでOKです。

   **「出ない」だけを見ない。** それだと、**畳む決まりを
   「いつでも消す」に書き換えても緑のまま**になり、
   戻す道が死んでいることに気づけない。
   ①既定で1つも見えないか ②オンにすると本当に出るか
   ③**文を畳んだぶん、形で言えているか**(えらぶ欄が読めるか)を
   いつも一緒に数える。
   ══════════════════════════════════════════════════════════════════ */
{
  const W = 390
  const page = await browser.newPage({ viewport: { width: W, height: 900 } })

  /* ① 既定(出さない)。**単語帳で測る**(第5.226節)。

       業種べつの冊(`shelfpick`)に置いていた説明は、
       2026-09 の指定「余計な説明書きは全て排除」で**消した。**
       畳む仕組みそのものは生きているので、**まだ説明がある画面**で
       ①②を測る。③(形で言う)は、これまでどおり `shelfpick` で測る —— */
  await page.goto(`http://localhost:${PORT}/__bar.html?screen=wordbook`,
    { waitUntil: 'networkidle' })
  await page.evaluate(() => { try { localStorage.removeItem('eas.tips') } catch { /* 端末が断ることがある */ } })
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(200)
  const 既定 = await page.evaluate(() => {
    const all = [...document.querySelectorAll('.tip')]
    return {
      印: document.documentElement.getAttribute('data-tips'),
      在る: all.length,
      見える: all.filter((el) => el.checkVisibility()).length,
    }
  })

  /* ② オンにすると出る */
  await page.evaluate(() => { try { localStorage.setItem('eas.tips', 'on') } catch { /* 同上 */ } })
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(200)
  const オン = await page.evaluate(() => {
    const all = [...document.querySelectorAll('.tip')]
    const み = all.filter((el) => el.checkVisibility())
    return {
      印: document.documentElement.getAttribute('data-tips'),
      見える: み.length,
      文: (み[0]?.textContent ?? '').replace(/\s+/g, '').slice(0, 20),
    }
  })

  /* ③ 文を畳んだぶん、形で言う —— **えらぶ欄が読めるか。**

       **「そこに在るか」だけを見ない**(2026-09 実機)。

         > 業種別単語帳のボタンが真っ青です

       あのときは `.wb-add-open { color: var(--accent) }` が
       `.btn--primary` より**あとに書いてあって重さが同じ**だったので、
       青い地に青い文字になり、**絵ごと消えてただの青い板**になっていた。
       ところが検証は **`className` に `btn--primary` が入っているか**しか
       見ていなかったので、**ずっと緑のまま**だった ——
       「名前が出てくるか」で見ない、の色の版である。

       **青いボタンそのものは、もう無い**(2026-09 にプルダウンへ改めた)。
       **測り方だけを引き継ぐ** —— いま押すところは
       `.shelfbooks select` 1つなので、**その字が地に沈んでいないか**を
       明るい側と暗い側の両方で測る
       (CLAUDE.md「確認は明るい・暗いの両方で行う」)。 */
  await page.evaluate(() => { try { localStorage.removeItem('eas.tips') } catch { /* 同上 */ } })
  const 青 = {}
  for (const [key, q] of [['無し', '&picked=none'], ['有り', '']]) {
    await page.goto(`http://localhost:${PORT}/__bar.html?screen=shelfpick${q}`,
      { waitUntil: 'networkidle' })
    await page.waitForTimeout(200)
    for (const 配色 of ['light', 'dark']) {
      await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), 配色)
      await page.waitForTimeout(80)
      const m = await page.evaluate(() => {
        const el = document.querySelector('.shelfbooks select')
        if (!el) return null
        const 明 = (c) => {
          const [r, g, b] = (c.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number)
            .map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 })
          return 0.2126 * r + 0.7152 * g + 0.0722 * b
        }
        /* **地は、自分から上へたどって最初の不透明なもの。**
           枠線だけのボタンは自分の地を持たないことがある */
        const 地の色 = () => {
          for (let n = el; n; n = n.parentElement) {
            const c = window.getComputedStyle(n).backgroundColor
            if (c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c)) return c
          }
          return 'rgb(255, 255, 255)'
        }
        const 字 = window.getComputedStyle(el).color
        const 地 = 地の色()
        const x = 明(字); const y = 明(地)
        return {
          cls: el.className,
          字,
          地,
          差: Math.round(((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)) * 10) / 10,
        }
      })
      青[`${key}:${配色}`] = m
    }
    await page.evaluate(() => document.documentElement.removeAttribute('data-theme'))
    青[key] = 青[`${key}:light`]?.cls ?? ''
  }
  await page.close()

  /** **字が読めない**(地との差が小さすぎる)ものを探す */
  const 読めない = Object.entries(青)
    .filter(([k, v]) => k.includes(':') && v && v.差 < 3)
    .map(([k, v]) => `${k} 差 ${v.差}(字 ${v.字} / 地 ${v.地})`)

  if (既定.印 !== null) {
    ng('説明の文 … 既定なのに `data-tips` が付いている', String(既定.印))
  } else if (既定.在る === 0) {
    ng('説明の文 … 畳むはずの説明が、そもそも1つも無い')
  } else if (既定.見える !== 0) {
    ng('説明の文 … 既定で説明が見えている', `${既定.見える} / ${既定.在る} 個`)
  } else if (オン.印 !== 'on') {
    ng('説明の文 … オンにしても印が付かない', String(オン.印))
  } else if (オン.見える === 0) {
    ng('説明の文 … オンにしても出てこない(戻す道が死んでいる)')
  } else if (オン.文.length < 4) {
    ng('説明の文 … オンで出たのに、中身が無い', `「${オン.文}」`)
  } else if (読めない.length) {
    ng('説明の文 … えらぶ欄の字が、地に沈んで読めない',
      `${読めない.join(' / ')}。地と同じ色を当てていないか`)
  } else {
    ok(`説明の文 ${W}px … 既定は 0 / ${既定.在る} 個・オンで ${オン.見える} 個`
      + `(「${オン.文}…」)・えらぶ欄の字が読める`
      + `(明 ${青['無し:light']?.差} / 暗 ${青['無し:dark']?.差})`)
  }
}

/* ══════════════════════════════════════════════════════════════════
   畳んだのは説明の側だけ(2026-09 利用者の指定「こういうの、いらないです」)

   「今日が復習の日のものから出します。」と**先取りの断り**は、
   **同じ1つの段落にいた。** だから畳むには**行を分ける**しかない。

   **「消えたか」だけを見ない。** 段落ごと畳んでも、それは緑になる ——
   そのとき**先取りの断りまで一緒に消えている**(黙って動かさない・CLAUDE.md)。
   ①説明が消えるか ②**断りは残るか**を、いつも一緒に数える。
   ══════════════════════════════════════════════════════════════════ */
{
  const W = 390
  const page = await browser.newPage({ viewport: { width: W, height: 900 } })
  await page.goto(`http://localhost:${PORT}/__bar.html?screen=rscope`,
    { waitUntil: 'networkidle' })
  await page.evaluate(() => { try { localStorage.removeItem('eas.tips') } catch { /* 端末が断ることがある */ } })
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForSelector('.rscope', { timeout: 8000 })

  /* **範囲を「ぜんぶ」へ広げる。** 既定の「今日の復習」では
     先取りが 0 件で、**断りの行がそもそも描かれない**
     (それでは、畳んだかどうかを測ったことにならない) */
  await page.click('.rscope-go .btn--small')
  await page.waitForTimeout(200)
  await page.evaluate(() => {
    const 札 = [...document.querySelectorAll('.rscope-chip')]
      .find((b) => b.textContent.trim().startsWith('ぜんぶ'))
    札?.click()
  })
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)

  const 見え = await page.evaluate(() => {
    const 文 = (el) => (el.textContent ?? '').replace(/\s+/g, '')
    const 行 = [...document.querySelectorAll('.rscope-lead')]
    return {
      説明: 行.filter((el) => 文(el).includes('から出します') && el.checkVisibility()).length,
      断り: 行.filter((el) => 文(el).includes('次に出る日は動きません') && el.checkVisibility()).length,
    }
  })
  await page.close()

  if (見え.説明 !== 0) {
    ng('説明の文 … 「…から出します。」が既定で見えている', String(見え.説明))
  } else if (見え.断り !== 1) {
    ng('説明の文 … 先取りの断りまで畳んでしまっている(黙って動かさない)', String(見え.断り))
  } else {
    ok(`説明の文 ${W}px … 復習は、説明だけ畳んで**先取りの断りは残る**`)
  }
}

/* ══════════════════════════════════════════════════════════════
   **英語の音声と音楽の音量は、メニューの下で別々に決める**
   (2026-09 利用者の指定)

     > アプリに好きな音楽を追加し、英語の音声と音楽を独立してそれぞれ
     > 音量を調整出来るようにしたいです。
     > 英語音声が再生される時に自動で音楽の音量を下げる機能は必要ありません

   **算段は `npm run test:play` が見る。ここは描いて測る。**
   ①2本そろっているか ②いまの大きさが数で出ているか
   ③動かすと本当に値が変わるか ④**片方を動かして、もう片方が動かないか**
   ⑤指で掴める高さか ⑥横にはみ出していないか。

   **「2本ある」だけを見ない** —— 同じつまみを2つ並べただけでも
   それは満たされる。**独立していること**が、この指定そのものである。
   ══════════════════════════════════════════════════════════════ */
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  page.setDefaultTimeout(8000)
  page.setDefaultNavigationTimeout(8000)
  await page.route('**/rest/v1/**', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: '[]',
  }))
  await page.route('**/auth/v1/**', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: '{}',
  }))
  /* **本物のメニューは、ここには描けない**(ログインした `App` の中にある)。
     骨組みは `?screen=navfoot` で、**`App.jsx` とまったく同じ形**の
     自分の欄と「設定」を置いてある。**画面が本当に呼んでいるか**は
     `npm run test:play` が見張っている(役目が違う)。

     **つまみは「設定」の中にある**(2026-09 利用者の指定でまとめた)ので、
     **利用者と同じように開いてから測る。** 骨組みの側を開きっぱなしに
     すると、**本物と食い違って何も守らなくなる** */
  await page.goto(`http://localhost:${PORT}/__bar.html?screen=navfoot`,
    { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(700)
  await page.click('.nav-settings-sum')
  await page.waitForTimeout(250)

  const 見る = () => page.evaluate(() => {
    const rows = [...document.querySelectorAll('.app-nav-foot .nav-setting')]
      .filter((r) => r.querySelector('.nav-vol'))
    const nav = document.querySelector('.app-nav-foot')
    return {
      本数: rows.length,
      名: rows.map((r) => r.querySelector('.nav-setting-label')?.firstChild?.textContent?.trim()),
      数: rows.map((r) => r.querySelector('.nav-vol-pct')?.textContent ?? ''),
      値: rows.map((r) => Number(r.querySelector('.nav-vol').value)),
      高: rows.map((r) => Math.round(r.querySelector('.nav-vol').getBoundingClientRect().height)),
      はみ出し: nav ? Math.max(0, nav.scrollWidth - nav.clientWidth) : 0,
    }
  })

  const before = await 見る()
  if (before.本数 !== 2) {
    ng(`音量 … メニューの下のつまみが ${before.本数} 本`,
      '「英語の音声」と「音楽の大きさ」の2本を、それぞれ別に決められること')
  } else if (before.名[0] !== '英語の音声' || before.名[1] !== '音楽の大きさ') {
    ng(`音量 … 名前が「${before.名.join(' / ')}」`, '何のつまみか読み取れない')
  } else if (!/^\d+%$/.test(before.数[0]) || !/^\d+%$/.test(before.数[1])) {
    ng(`音量 … いまの大きさが数で出ていない(${before.数.join(' / ')})`,
      'つまみの位置だけでは、もう一方と同じ大きさか読み取れない')
  } else if (Math.min(...before.高) < 24) {
    ng(`音量 … つまみが細すぎて狙えない(${before.高.join(' / ')}px)`)
  } else if (before.はみ出し > 0) {
    ng(`音量 … メニューの下が ${before.はみ出し}px 横にはみ出している`)
  } else {
    ok(`音量 1280px … 「英語の音声 ${before.数[0]}」「音楽の大きさ ${before.数[1]}」`
      + `(高さ ${before.高.join(' / ')}px・はみ出し無し)`)
  }

  if (before.本数 === 2) {
    /* **独立しているか。** 英語の音声だけを動かして、音楽が動かないこと */
    await page.evaluate(() => {
      const el = [...document.querySelectorAll('.nav-vol')][0]
      const set = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, 'value').set
      set.call(el, '0.3')
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await page.waitForTimeout(250)
    const after = await 見る()
    if (after.値[0] !== 0.3) {
      ng(`音量 … 動かしても値が変わらない(${before.値[0]} → ${after.値[0]})`,
        '画面が `setVoiceLevel()` を呼んでいない')
    } else if (after.数[0] !== '30%') {
      ng(`音量 … 動かしても数が追わない(${after.数[0]})`)
    } else if (after.値[1] !== before.値[1]) {
      ng(`音量 … 英語の音声を動かしたら、音楽まで動いた`
        + `(${before.値[1]} → ${after.値[1]})`,
      '**独立してそれぞれ**調整できること(利用者の指定)')
    } else {
      ok(`音量 1280px … 英語の音声だけが 30% になり、音楽の大きさは ${after.数[1]} のまま`)
    }
  }
  await page.close()
}

/* ══════════════════════════════════════════════════════════════
   **設定は「設定」1つにまとめ、メニューのいちばん下に置く**
   (2026-09 利用者の指定)

     > サイドバーの「配色」から「教材の支度」までの項目をすべてまとめて
     > 「設定」としてサイドバーの一番下に配置してください。

   設定が**7つ縦に並んで**いた(配色 / 色づかい / 説明の文 /
   押したときの音 / 英語の音声 / 音楽 / 教材の支度)。どれも
   **一度決めたら何度も触らないもの**なのに、メニューを開くたびに
   行き先(画面の一覧)と同じだけの高さを占めていた。

   【「出る」と「出ない」の両方を見る】
   **「畳めている」だけを見ると、7つのうち何本か落としても緑のまま**に
   なる —— 一度入れたものを勝手に減らさない(共通ルール)。だから
   **開いて7つとも数える。** 逆に**開いたときだけを見ると、
   畳むのをやめても緑**になるので、閉じているときも一緒に数える。

   ①畳んだら、設定の行が1つも見えないか
   ②押すものは「設定」1つか ③**自分の欄(名前・ログアウト)より上にいるか**
      —— 2026-09 に利用者の指定で動かした(第5.189節)。
      **いちばん下は自分の欄**で、あそこは行き先でも設定でもない
   ④押せる大きさ(40px)か ⑤開くと**7つとも**出るか ⑥はみ出さないか
   ══════════════════════════════════════════════════════════════ */
{
  /* **9つある**(第5.257節で「音楽」が3つに割れた ——
     オン / オフ・曲・大きさ)。**一度入れたものを勝手に減らさない** */
  const WANT_SET = ['配色', '色づかい', '説明の文', '押したときの音',
    '英語の音声', '音楽', '曲', '音楽の大きさ', '教材の支度']
  for (const W of [1280, 390]) {
    const page = await browser.newPage({ viewport: { width: W, height: 900 } })
    page.setDefaultTimeout(8000)
    page.setDefaultNavigationTimeout(8000)
    await page.route('**/rest/v1/**', (r) => r.fulfill({
      status: 200, contentType: 'application/json', body: '[]',
    }))
    await page.route('**/auth/v1/**', (r) => r.fulfill({
      status: 200, contentType: 'application/json', body: '{}',
    }))
    await page.goto(`http://localhost:${PORT}/__bar.html?screen=navfoot`,
      { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(600)

    /* **畳んだ `<details>` の中は `offsetParent` では見分けられない**
       (CLAUDE.md)。`checkVisibility()` で見る */
    const 見る = () => page.evaluate(() => {
      const foot = document.querySelector('.app-nav-foot')
      const sums = [...document.querySelectorAll('.nav-settings-sum')]
      const rows = [...document.querySelectorAll('.app-nav-foot .nav-setting')]
      const 名 = (r) => r.querySelector('.nav-setting-label')
        ?.firstChild?.textContent?.trim() ?? ''
      const acc = document.querySelector('.nav-account')
      const det = document.querySelector('.nav-settings')
      return {
        押すもの: sums.length,
        題: sums[0]?.innerText?.trim() ?? '',
        高: sums[0] ? Math.round(sums[0].getBoundingClientRect().height) : 0,
        在る: rows.length,
        見える: rows.filter((r) => r.checkVisibility?.() ?? true).map(名),
        /* **自分の欄より上にいるか**(第5.189節)。
           ソースの並びではなく、**描いた位置**で見る */
        上か: !!(acc && det
          && det.getBoundingClientRect().bottom <= acc.getBoundingClientRect().top + 1),
        /* **歯車は、本当に歯車の形か**(第5.189節・利用者の指定
           「今はライトの設定のように見える」)。
           もとは丸1つ + 離れた線8本で、**18px では太陽にしか見えない**。
           線の本数ではなく、**歯が本体と地続きの1本の輪郭**になっていることを見る
           —— `path` が1つで、閉じていて(`Z`)、点が十分にあること */
        歯車: (() => {
          const sv = sums[0]?.querySelector('svg')
          if (!sv) return null
          const ps = [...sv.querySelectorAll('path')]
          const d = ps.map((x) => x.getAttribute('d') || '').join('')
          return {
            輪郭: ps.length,
            閉じ: /Z\s*$/.test(d.trim()),
            /* **離れた線の集まりではない。** `M` が1つだけ
               (太陽は `M` が何度も出てくる) */
            切れ目: (d.match(/M/g) ?? []).length,
            /* 歯の数だけ角がある(6歯 = 24 点) */
            角: (d.match(/L/g) ?? []).length,
            /* 軸の穴 */
            穴: sv.querySelectorAll('circle').length,
          }
        })(),
        はみ出し: foot ? Math.max(0, foot.scrollWidth - foot.clientWidth) : 0,
      }
    })

    const 閉 = await 見る()
    if (閉.押すもの !== 1) {
      ng(`設定 ${W}px … メニューの下の「設定」が ${閉.押すもの} つ`,
        '**すべてまとめて「設定」として**(利用者の指定)')
    } else if (閉.題 !== '設定') {
      ng(`設定 ${W}px … 題が「${閉.題}」`, '「設定」と書いてあること')
    } else if (閉.見える.length !== 0) {
      ng(`設定 ${W}px … 畳んだのに ${閉.見える.length} 行が出たまま`,
        `見えている: ${閉.見える.join(' / ')}`)
    } else if (!閉.上か) {
      ng(`設定 ${W}px … 「設定」が自分の欄より下にいる`,
        '**位置を名前の要素の上に**(2026-09 利用者の指定・第5.189節)')
    } else if (!閉.歯車) {
      ng(`設定 ${W}px … 「設定」に絵が無い`)
    } else if (閉.歯車.切れ目 !== 1 || !閉.歯車.閉じ) {
      /* **「絵がある」だけを見ない。** 太陽(離れた線の集まり)に
         戻したら赤くなる —— `M` が本数ぶん出てくる */
      ng(`設定 ${W}px … 歯車が、離れた線の集まりになっている`,
        `切れ目 ${閉.歯車.切れ目} / 閉じ ${閉.歯車.閉じ}。`
        + '歯は本体と地続きの1本の輪郭で描く(18px では太陽に見える)')
    } else if (閉.歯車.角 < 12 || 閉.歯車.穴 !== 1) {
      ng(`設定 ${W}px … 歯車の歯か軸の穴が足りない`,
        `角 ${閉.歯車.角} / 穴 ${閉.歯車.穴}`)
    } else if (閉.高 < 40) {
      ng(`設定 ${W}px … 「設定」が ${閉.高}px しかなく、指で狙えない`)
    } else if (閉.はみ出し > 0) {
      ng(`設定 ${W}px … メニューの下が ${閉.はみ出し}px 横にはみ出している`)
    } else {
      ok(`設定 ${W}px … 畳んで「設定」1つ(${閉.高}px)・`
        + `自分の欄より上・歯車(角 ${閉.歯車.角}・穴1)・`
        + `中の ${閉.在る} 行は見えていない`)
    }

    if (閉.押すもの === 1) {
      await page.click('.nav-settings-sum')
      await page.waitForTimeout(250)
      const 開 = await 見る()
      const 足りない = WANT_SET.filter((n) => !開.見える.includes(n))
      if (足りない.length) {
        ng(`設定 ${W}px … 開いても ${足りない.join(' / ')} が出てこない`,
          '**一度入れたものを勝手に減らさない**(共通ルール)。'
          + `いま出ているのは ${開.見える.join(' / ')}`)
      } else if (開.見える.length !== WANT_SET.length) {
        ng(`設定 ${W}px … 開くと ${開.見える.length} 行`,
          `${WANT_SET.length} 行のはず(${開.見える.join(' / ')})`)
      } else if (開.はみ出し > 0) {
        ng(`設定 ${W}px … 開くと ${開.はみ出し}px 横にはみ出す`)
      } else {
        ok(`設定 ${W}px … 開くと ${開.見える.join(' / ')} の ${開.見える.length} 行`)
      }
    }
    await page.close()
  }
}

/* ══════════════════════════════════════════════════════════════
   **音楽のオン / オフと、曲のえらび**(第5.257節・2026-09-25 利用者の指定)

     > 設定から音楽の音量を0%にしても音楽が消えません。
     > 音量設定はそのまましっかり機能するようにし、
     > それに加えて音楽on / offの設定も追加してください。
     > on にしたら曲が選べるプルダインも出るように

   **算段は `npm run test:play` が見る。ここは描いて測る。**

   【「出る」と「出ない」の両方を見る】(CLAUDE.md)
   **「オンのとき出るか」だけを見ると、いつでも出す形に書き換えても
   緑のまま**になる —— それでは「オフにしたら曲が選べる」という、
   いちばん妙な画面を素通りさせる。**押して、消えることまで見る。**

   【いちばん危ない形を、検証の中に置く】(CLAUDE.md)
   **曲が1つしか無い**形(`&songs=one`)も測る。あそこで欄を出すと、
   「ぜんぶ」とその1曲が並ぶだけで、**押しても何も変わらない。**

   ①オンのとき、曲と大きさが出るか ②オフにしたら、その2つが消えるか
   ③オンに戻したら、また出るか ④曲が1つのときは、えらびを出さないか
   ⑤プルダウンが指で狙える高さか ⑥横にはみ出していないか
   ══════════════════════════════════════════════════════════════ */
for (const W of [1280, 390]) {
  const page = await browser.newPage({ viewport: { width: W, height: 900 } })
  page.setDefaultTimeout(8000)
  page.setDefaultNavigationTimeout(8000)
  await page.route('**/rest/v1/**', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: '[]',
  }))
  await page.route('**/auth/v1/**', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: '{}',
  }))
  await page.goto(`http://localhost:${PORT}/__bar.html?screen=navfoot`,
    { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(600)
  await page.click('.nav-settings-sum')
  await page.waitForTimeout(250)

  const 見る = () => page.evaluate(() => {
    const foot = document.querySelector('.app-nav-foot')
    const 名 = (r) => r.querySelector('.nav-setting-label')
      ?.firstChild?.textContent?.trim() ?? ''
    const rows = [...document.querySelectorAll('.app-nav-foot .nav-setting')]
      .filter((r) => r.checkVisibility?.() ?? true)
    const pick = document.querySelector('.nav-song-pick')
    return {
      見える: rows.map(名),
      曲数: pick ? pick.options.length : 0,
      曲高: pick ? Math.round(pick.getBoundingClientRect().height) : 0,
      /* **いま押されているほうが、見て分かるか**(色だけに頼らない) */
      押: [...document.querySelectorAll('[aria-label="音楽"] .theme-btn')]
        .map((b) => `${b.textContent.trim()}${b.classList.contains('is-active') ? '*' : ''}`)
        .join(' '),
      はみ出し: foot ? Math.max(0, foot.scrollWidth - foot.clientWidth) : 0,
    }
  })
  /* **押すのは、利用者と同じ道で。** `aria-label` で組を絞ってから
     文字で選ぶ —— 並び順で決めると、入れ替えた日に黙って別のものを押す */
  const 押す = async (文字) => {
    await page.evaluate((t) => {
      const b = [...document.querySelectorAll('[aria-label="音楽"] .theme-btn')]
        .find((x) => x.textContent.trim() === t)
      b?.click()
    }, 文字)
    await page.waitForTimeout(250)
  }

  const 入 = await 見る()
  if (!入.見える.includes('曲') || !入.見える.includes('音楽の大きさ')) {
    ng(`音楽 ${W}px … オンなのに「曲」か「音楽の大きさ」が出てこない`,
      `出ているのは ${入.見える.join(' / ')}`)
  } else if (入.曲数 < 3) {
    ng(`音楽 ${W}px … 曲のえらびが ${入.曲数} 行`,
      '「ぜんぶ(順不同)」+ 登録した曲が並ぶこと')
  } else if (入.曲高 < 40) {
    ng(`音楽 ${W}px … 曲のえらびが ${入.曲高}px しかなく、指で狙えない`)
  } else if (入.押 !== 'オン* オフ') {
    ng(`音楽 ${W}px … いま押されているほうが読み取れない(${入.押})`,
      '既定はオン(これまでどおり鳴る)')
  } else if (入.はみ出し > 0) {
    ng(`音楽 ${W}px … メニューの下が ${入.はみ出し}px 横にはみ出している`)
  } else {
    ok(`音楽 ${W}px … オン … 曲(${入.曲数} 行・${入.曲高}px)と`
      + '「音楽の大きさ」が出る')
  }

  await 押す('オフ')
  const 切 = await 見る()
  if (切.見える.includes('曲') || 切.見える.includes('音楽の大きさ')) {
    ng(`音楽 ${W}px … オフにしても「${
      ['曲', '音楽の大きさ'].filter((n) => 切.見える.includes(n)).join(' / ')
    }」が出たまま`, '鳴らないのに選ばせない(効かない操作を見せない)')
  } else if (!切.見える.includes('音楽')) {
    ng(`音楽 ${W}px … オフにしたら「音楽」の行そのものが消えた`,
      '戻せなくなる(行き止まりを作らない)')
  } else if (切.押 !== 'オン オフ*') {
    ng(`音楽 ${W}px … オフを押しても、押されたほうが変わらない(${切.押})`)
  } else {
    ok(`音楽 ${W}px … オフ … 曲も大きさも消える(${切.見える.length} 行)`)
  }

  await 押す('オン')
  const 戻 = await 見る()
  if (!戻.見える.includes('曲') || !戻.見える.includes('音楽の大きさ')) {
    ng(`音楽 ${W}px … オンに戻しても出てこない`, `${戻.見える.join(' / ')}`)
  } else {
    ok(`音楽 ${W}px … オンに戻すと、また曲と大きさが出る`)
  }
  await page.close()
}
/* **曲が1つのときは、えらびそのものを出さない**(`bgmChoices`)——
   「ぜんぶ」とその1曲は同じもので、押しても何も変わらない */
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  page.setDefaultTimeout(8000)
  page.setDefaultNavigationTimeout(8000)
  await page.route('**/rest/v1/**', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: '[]',
  }))
  await page.route('**/auth/v1/**', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: '{}',
  }))
  await page.goto(`http://localhost:${PORT}/__bar.html?screen=navfoot&songs=one`,
    { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(600)
  await page.click('.nav-settings-sum')
  await page.waitForTimeout(250)
  const 一 = await page.evaluate(() => ({
    曲: !!document.querySelector('.nav-song-pick'),
    大: [...document.querySelectorAll('.app-nav-foot .nav-setting')]
      .some((r) => r.querySelector('.nav-setting-label')
        ?.firstChild?.textContent?.trim() === '音楽の大きさ'),
  }))
  if (一.曲) {
    ng('音楽 … 曲が1つしか無いのに、えらぶ欄が出ている',
      '「ぜんぶ」とその1曲は同じもの(効かない操作を見せない)')
  } else if (!一.大) {
    ng('音楽 … 曲が1つだと「音楽の大きさ」まで消えている',
      '大きさは曲の数と関わりがない')
  } else {
    ok('音楽 … 曲が1つのときは、えらぶ欄を出さない(大きさは出る)')
  }
  await page.close()
}

/* ══════════════════════════════════════════════════════════════
   **別々の物を、すき間ゼロでくっつけない**(2026-09 実機・利用者の指定)

     > 大きく表示のボタンとその上の3つのボタンが隙間がなく接触しています。
     > ダサいのですぐ直してください。他にもこういう場所がありました。
     > 全て探して直してください。プロはこんなデザインは作りません。
     > これはこれからどんなアプリを作る時も共通のルールにしてください

   実際に起きていたこと。`.card-tools` は
   **`margin-bottom: 0` + 「次が `.btn-row` のときだけ 8px 戻す」**
   という書き方だった。ところが下に来るものが
   **素の `<button>`**(「セッションで使う」)に変わった日から、
   その指定がどこにも当たらず、**隙間が 0 になった。**

   【この検証がいちばん大事にしていること】

   ・**DOM の兄弟では測らない。** `.card-tools` のような行は
     枠も地色も持たない**透明な入れ物**なので、兄弟どうしで測ると
     **素通りする**(実際、最初に書いた測り方はこれで捕まえられなかった)。
     **描かれている物(いちばん内側)だけ**を拾って、縦に並べ直す
   ・**浮いているものは数えない**(`fixed` / `sticky` / `absolute`)。
     あちらは流れの中にいない ——ただ上に重なっているだけである
   ・**わざと接しているものは、名指しで外す**(`TOUCH_OK`)。
     一覧の行(`li + li`)のように、**線を接して1つに見せる**作りは
     正しい。**外したものは、必ずここに理由を書く**

   【なぜ測るのか。ソースを読むだけでは絶対に分からない】
   隙間は「上の余白」「下の余白」「`gap`」「隣り合わせの指定」の
   **掛け合わせ**で決まる。1つのファイルを読んでも答えは出ない。

   ══════════════════════════════════════════════════════════════
   **縦だけ測っていた。横に並ぶ組は一度も見ていなかった**
   (2026-09 実機・利用者の指摘)

     > 「聞き流す」と「印刷・PDF」ボタンの間に隙間がありません。
     > これは PC での表示ですが、**すべてのデバイスでこれが起こらないように
     > 徹底してください。**

   もとの測り方は、はじめの1行が

       if (b.r.top < a.r.bottom - 0.5) continue        // 横に並んでいる

   で、**横に並ぶ組をまるごと読み飛ばしていた。** だから
   `.wb-listen` が2つ横に並んで接していても、**ずっと緑だった。**

   「徹底する」とは、**測るものを増やすこと**である。
   いまは**縦と横の両方**を測る。横は「同じ行にいて、あいだが 0」。 */
{
  /** わざと接している(接することに意味がある)もの —— **縦に並ぶ組** */
  const TOUCH_OK = [
    // 一覧の行。**線を接して1つの表に見せる**(`li + li { border-top }`)
    ['li', 'li'],
    // 下から出るシートの「つまみ」。飾りであって、別の物ではない
    ['sheet-grip', 'sheet-head'],
  ]
  /**
   * わざと接している **横に並ぶ組。**
   *
   * **1つの部品に見せるために、わざと継ぎ目を無くしてあるもの**だけを
   * 名指しで外す。**「並んでいるから」では外さない** ——
   * それをやると、この見張りは何も守らなくなる。
   */
  const TOUCH_OK_X = [
    /* 錠剤(`◀ Listen ▶`)。**枠と地は錠剤が持ち、中のボタンは持たない** ——
       離すと「またボタンが3つ」に見える(CLAUDE.md に書いてある決まり) */
    ['listenpill', 'listenpill'],
    ['listenpill-mid', 'listenpill'],
    ['listenpill', 'listenpill-mid'],
    /* 段を送る欄(`◀ 標準 ▶`)。**いまの値の左右に三角**という
       1つの部品である(`Stepper.jsx`) */
    ['stepper', 'stepper'],
    /* 選んでいる1つを示す帯(配色・色づかい・説明の文・音)。
       **継ぎ目を無くして1本の帯に見せる**作りである */
    ['theme-btn', 'theme-btn'],
    ['seg-btn', 'seg-btn'],
    // 一覧の行。縦と同じ理由(横に並ぶ表もある)
    ['li', 'li'],
  ]
  /** 画面の中の、描かれている物どうしの接触を拾う(縦と横の両方) */
  const FIND = ([okPairs, okPairsX]) => {
    const rgb = (s) => {
      const m = /rgba?\(([^)]+)\)/.exec(s || '')
      if (!m) return null
      const p = m[1].split(',').map((x) => parseFloat(x))
      return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }
    }
    const same = (a, b) => (!a && !b)
      || (a && b && a.r === b.r && a.g === b.g && a.b === b.b && a.a === b.a)
    /** 「別々の物」に見えるか(押せるもの / 枠がある / 地色が親と違う) */
    const isObject = (el) => {
      if (['BUTTON', 'SELECT', 'INPUT', 'TEXTAREA'].includes(el.tagName)) return true
      const cs = window.getComputedStyle(el)
      const bw = ['Top', 'Right', 'Bottom', 'Left']
        .map((s) => parseFloat(cs[`border${s}Width`]) || 0)
      if (bw.some((w) => w > 0)) return true
      const me = rgb(cs.backgroundColor)
      if (me && me.a > 0.02) {
        const pa = el.parentElement
          ? rgb(window.getComputedStyle(el.parentElement).backgroundColor) : null
        if (!same(me, pa)) return true
      }
      return false
    }
    const name = (el) => {
      const c = (el.className || '').toString().trim().split(/\s+/).filter(Boolean)
      return el.tagName.toLowerCase() + (c.length ? `.${c.slice(0, 3).join('.')}` : '')
    }
    const tags = (el) => [el.tagName.toLowerCase(),
      ...(el.className || '').toString().trim().split(/\s+/).filter(Boolean)]
    const painted = []
    for (const el of document.querySelectorAll('*')) {
      if (!isObject(el)) continue
      const r = el.getBoundingClientRect()
      if (r.width < 2 || r.height < 2) continue
      const cs = window.getComputedStyle(el)
      if (cs.visibility === 'hidden' || cs.display === 'none') continue
      let floating = false
      for (let n = el; n && n !== document.body; n = n.parentElement) {
        const p = window.getComputedStyle(n).position
        if (p === 'fixed' || p === 'sticky' || p === 'absolute') { floating = true; break }
      }
      if (floating) continue
      painted.push({ el, r })
    }
    // **いちばん内側だけ残す。** 中にも物があるなら、外側は「囲み」である
    const inner = painted.filter((p) => !painted.some((q) => q !== p && p.el.contains(q.el)))
    const out = []
    const 許す = (list, a, b) => {
      const ta = tags(a.el); const tb = tags(b.el)
      return list.some(([x, y]) => ta.includes(x) && tb.includes(y))
    }

    /* ── 縦に並ぶ組 ────────────────────────────────────────── */
    inner.sort((a, b) => a.r.top - b.r.top || a.r.left - b.r.left)
    for (let i = 0; i < inner.length; i += 1) {
      for (let j = i + 1; j < inner.length; j += 1) {
        const a = inner[i]; const b = inner[j]
        if (b.r.top < a.r.bottom - 0.5) continue        // 横に並んでいる
        const gap = b.r.top - a.r.bottom
        if (gap >= 4) break                             // これより下は離れている
        if (Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left) < 4) continue
        if (許す(okPairs, a, b)) continue
        out.push({ dir: '縦', gap: Math.round(gap * 10) / 10, a: name(a.el), b: name(b.el) })
      }
    }

    /* ── 横に並ぶ組(2026-09 実機。**ここを一度も見ていなかった**)──
       「同じ行にいて(縦に 4px 以上かぶっていて)、あいだが 4px 未満」。
       **左から順に並べ替えてから見る** —— そうすれば、
       あいだが開いた時点でそれより右は見なくてよい */
    const 左順 = [...inner].sort((a, b) => a.r.left - b.r.left || a.r.top - b.r.top)
    for (let i = 0; i < 左順.length; i += 1) {
      for (let j = i + 1; j < 左順.length; j += 1) {
        const a = 左順[i]; const b = 左順[j]
        const gap = b.r.left - a.r.right
        if (gap >= 4) break                             // これより右は離れている
        /* **重なっているものは数えない。** 別々に置いた物ではなく、
           上に載せた飾りのことが多い(端まで来ると -1px ほどずれる) */
        if (gap < -1.5) continue
        // 同じ行にいるか(縦のかぶり)
        if (Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top) < 4) continue
        if (許す(okPairsX, a, b)) continue
        out.push({ dir: '横', gap: Math.round(gap * 10) / 10, a: name(a.el), b: name(b.el) })
      }
    }
    return out
  }

  /* 見る画面。**押すものが縦に積まれるところ**を中心に並べる。
     **画面を足したら、ここにも足す** —— 足すまで見張られない */
  const SCREENS = [
    ['tools', ''], ['form', ''], ['search', ''], ['qr', ''], ['qrrev', ''],
    /* **音声を作り直す欄**(第5.196節)。訛り・話す人・読み方が
       横に並ぶので、**横のすき間**がいちばん出やすい */
    ['remake', ''],
    ['rscope', ''], ['wordbook', ''], ['mybook', ''], ['result', ''],
    ['radio', ''], ['qrradio', ''], ['course', ''], ['basicpick', ''],
    ['shelfpick', ''], ['speech', ''], ['gnote', ''], ['tabs', ''],
    ['volume', ''], ['shift', ''],
    /* **冊をえらぶ本棚**(第5.167節)。トップ画面を無くしたので、
       冊をえらぶ場所は**この1枚だけ**になった。
       `books=one` は**冊が1つのとき**(えらぶ場所そのものが出ない) */
    ['shelf', ''], ['shelf', 'books=one'],
    /* **誰の記録として残るか**(第5.178節)。押せる形と、押せない名札と、
       担当がいないときの3つとも測る */
    ['owner', ''], ['owner', 'owner=fixed'], ['owner', 'owner=empty'],
    /* **本文から拾った かたまり**(第5.230節)。札・意味・由来・本文の文章・
       「練習する」が縦に積まれ、練習を開くと**日本語と「解答を見る」が
       横に並ぶ。** 縦も横も、いちばん接しやすい形である */
    ['chunk', ''],
    /* **足りない演習を足す欄**(第5.234節)。チェックの行・知らせ・
       ボタンの行が縦に積まれ、**ボタンは横に2つ並ぶ。**
       `full=1` は**ぜんぶ揃っている形**(欄そのものが出ない) */
    ['fill', ''], ['fill', 'full=1'],
    /* **教材の中の Quick Response**(第5.235節)。取り組み方が
       **3つ横に並ぶ**ようになったので、横のすき間がいちばん出やすい。
       `groups=one` は**切り替えの行ごと出ない**形 */
    ['qrmode', ''], ['qrmode', 'groups=one'],
    /* **アサインする**(第5.181節 / 第5.186節)。1行1冊で縦に並ぶ。
       **1つも出していない形も測る** —— 印が全部 ○ になり、
       数も出ないので、**行の高さが変わる** */
    ['assign', ''], ['assign', 'assign=none'],
    /* **アサインの手順**(第5.238節)。ゲストを選ぶ欄(名前で探す欄 +
       「一覧をひらく」+ 選んだ人)と、**その他の教材**の節が縦に積まれる。
       `mats=shut` は**畳んだ形**(畳みの札と、下の知らせが接しやすい)、
       `mats=wait` は**読み込み中**、`mats=none` は**0件** */
    ['assign', 'mats=shut'], ['assign', 'mats=wait'], ['assign', 'mats=none'],
    /* **`pick`(教材を先にえらぶ帯)は廃止した**(第5.248節・
       2026-09-23 利用者の指定)。本物からチェックと帯が消えたので、
       骨組みにも測るものが無い */
    /* **6Steps の帯**(第5.239節)。**6つが横に並ぶ**ので、
       狭い画面では折り返す。`steps=last` は**いちばん後ろを選んでいる形**
       (端が切れていないか) */
    ['steps', ''], ['steps', 'steps=last'],
    /* **「達成具合」は廃止した**(第5.246節・2026-09-23 利用者の指定)。
       `×` と「おわる」の行き先だったので、**ホームへ戻す**ように変えた。
       ホーム(`['', …]`)は、この一覧のいちばん下で測っている */
    ['', 'role=trainer&who=g1'],
  ]
  const 見つかった = []
  /* **色を決めずに置いたボタン**(第5.244節)。すき間と同じ周回で数える */
  const 色なし = []
  /**
   * **わざと地の色のままにしてあるもの。**
   *
   * ここに書いてよいのは、**そう作ってある理由が言えるもの**だけである。
   * 「見た目が違うから」では外さない —— それをやると何も守らなくなる
   * (共通ルール「わざと接している横の組は、別の一覧で名指しに外す」と同じ)。
   */
  const 白でよい = [
    // 浮いているもの。**紙の色 + 影**で浮かせてある。色を敷くと浮遊感が消える
    'sheet-float', 'finder-float', 'focus-exit',
    // 冊をえらぶプルダウン(`冊名 ▾`)。となりの `select` と同じ見た目が正しい
    'bookpick',
    // 単語帳の選択肢。押すと**緑 / 赤**になる。休みに灰を敷くと差が弱まる
    'wordbook-choice',
    // 絵だけのボタン。上の3つと同じ帯に並ぶ
    'rscope-sort', 'iconbtn',
  ]
  for (const [s, extra] of SCREENS) {
    for (const w of [390, 1280]) {
      const page = await browser.newPage({ viewport: { width: w, height: 900 } })
      page.setDefaultTimeout(8000)
      page.setDefaultNavigationTimeout(8000)
      /* **描けないものは測れない**(CLAUDE.md)。
         `[]` を返していたので、単語帳も Quick Response 帳も
         **`rows.length > 0` の中身がまるごと描かれず**、
         「聞き流す」「印刷 / PDF」はここに一度も出ていなかった
         (2026-09 実機。**だから接していても緑だった**)。
         **窓口の応答を差し替えて、実際に描かせてから測る** */
      await page.route('**/rest/v1/**', (r) => {
        const u = r.request().url()
        let body = []
        if (u.includes('review_words')) {
          body = ['budget', 'forecast', 'margin'].map((w, i) => ({
            word_norm: w, display: w, kind: 'word', pos: '名詞',
            status: 'unknown', box: 0, learn_streak: 0,
            due_on: '2020-01-01', added_at: '2026-09-01',
            meaning_ja: `意味${i}`, seen_in: '', seen_in_ja: '',
            material_id: null, material_title: null, industry: 'it', topic: null,
          }))
        }
        if (u.includes('qr_items')) {
          body = ['We need the budget.', 'I will send it.'].map((en, i) => ({
            en_norm: en.toLowerCase(), en, ja: `訳${i}`,
            box: 0, due_on: '2020-01-01', added_at: '2026-09-01',
            material_id: null, material_title: null, industry: 'it',
            scene: null, level: 'b1',
          }))
        }
        return r.fulfill({
          status: 200, contentType: 'application/json', body: JSON.stringify(body),
        })
      })
      await page.route('**/auth/v1/**', (r) => r.fulfill({
        status: 200, contentType: 'application/json', body: '{"data":{"user":null}}',
      }))
      const q = s ? `?screen=${s}${extra ? `&${extra}` : ''}` : `?${extra}`
      try {
        await page.goto(`http://localhost:${PORT}/__bar.html${q}`,
          { waitUntil: 'domcontentloaded' })
        await page.waitForTimeout(600)
        let hits = await page.evaluate(FIND, [TOUCH_OK, TOUCH_OK_X])
        /* **畳んであるものを開いてから、もう一度測る。**
           開いた箱(共有・絞り込み)は、閉じているあいだ測れない */
        await page.evaluate(() => {
          for (const d of document.querySelectorAll('details')) d.open = true
          /* **畳んだ冊の行も開く**(第5.186節)。
             ここを足さないと、業種べつ 35 冊のプルダウンも
             Native Flow の札6つも、**誰も測らなくなる**
             ——「出しかた」で踏んだのと、まったく同じ形である */
          for (const b of document.querySelectorAll('.assignshelf .shelf-pick')) {
            if (b.getAttribute('aria-expanded') === 'false') b.click()
          }
          for (const b of document.querySelectorAll('button')) {
            /* **文字だけで探さない**(第5.184節)。「出しかた」は**絵だけ**に
               なったので `textContent` は空である —— 名前は `aria-label` が
               持っている。ここを直さないと、**黙って見張りが減る**
               (畳んだ箱の中のすき間を、誰も測らなくなる) */
            const 名 = `${(b.textContent || '').trim()} `
              + `${b.getAttribute('aria-label') || ''}`
            if (/共有|出しかた|分野をえらぶ/.test(名)) b.click()
            /* **かたまりの練習も開く**(第5.230節)。畳んだままだと
               日本語と「解答を見る」の横のすき間が**誰にも測られない**
               (「畳んであるものは開いてから測る」・共通ルール) */
            if (/^練習する$/.test((b.textContent || '').trim())) b.click()
          }
        })
        await page.waitForTimeout(400)
        hits = hits.concat(await page.evaluate(FIND, [TOUCH_OK, TOUCH_OK_X]))
        /* **地の色のままのボタンを拾う**(第5.244節)。
           畳んだ箱を開いたあとで数える —— 閉じたままでは測れない。

           **class の名前では見ない。** 黒い帯やプレーヤーは
           **箱のほうが色を決めている**(`.lesson-bar .btn` など)ので、
           `btn--quiet` などが付いていなくても、ちゃんと色がある。
           **描いた地色を、その面が決めている「素の色」と突き合わせる** ——
           `#fff` とは書き写さない(**値を書き写さない。性質で見る**)。
           枠線だけ(`btn--ghost`)は透明なので、ここには当たらない */
        for (const b of await page.evaluate(() => {
          const 色 = (v) => {
            const d = document.createElement('div')
            d.style.background = v
            document.body.appendChild(d)
            const got = window.getComputedStyle(d).backgroundColor
            d.remove()
            return got
          }
          return [...document.querySelectorAll('.btn')]
            .filter((e) => e.getBoundingClientRect().width > 0)
            .map((e) => {
              const 面 = e.closest('.lesson-sheet, .focus-paper, .qr--paper') ?? document.body
              const 素 = window.getComputedStyle(面).getPropertyValue('--btn-bg').trim()
              return {
                cls: e.className,
                t: e.textContent.trim().slice(0, 18),
                素のまま: window.getComputedStyle(e).backgroundColor === 色(素 || '#ffffff'),
              }
            })
            .filter((x) => x.素のまま)
        })) {
          const names = String(b.cls).split(/\s+/)
          if (names.some((c) => 白でよい.includes(c))) continue
          色なし.push(`${s || 'レッスン表示'}@${w}px  ${b.cls} 「${b.t || '(絵だけ)'}」`)
        }
        for (const h of hits) {
          見つかった.push(`${s || 'レッスン表示'}@${w}px  ${h.dir} ${h.gap}px  ${h.a} / ${h.b}`)
        }
      } catch (e) {
        ng(`すき間 … ${s || 'レッスン表示'}@${w}px を描けなかった`,
          e.message.split('\n')[0])
      }
      await page.close()
    }
  }
  /* ── **色を決めずに置いたボタンが1つも無いか**(第5.244節)──

       共通ルール「**既定のボタン(地の色のまま)は、白い紙の上で
       『押せるもの』に見えない。色を決めずに置かない。**」

       **わざとそうしているものだけを、名指しで外す**(すき間の決まりで
       「わざと接している横の組は、別の一覧で名指しに外す」としたのと
       まったく同じ作法)。**「見た目が違うから」では外さない** ——
       それをやると、何も守らなくなる。 */
  const 一覧 = [...new Set(見つかった)]
  if (一覧.length) {
    ng(`すき間 … 別々の物が ${一覧.length} 組、すき間ゼロで接している`,
      一覧.slice(0, 12).join('\n    '))
  } else {
    ok(`すき間 … ${SCREENS.length} 画面 × 2幅、縦と横の両方で、接している組は無い`)
  }

  /* **色を決めずに置いたボタン**(第5.244節)。同じ組は1回だけ言う */
  const 色の一覧 = [...new Set(色なし)]
  if (色の一覧.length) {
    ng(`ボタンの色 … ${色の一覧.length} 個が、地の色のまま置かれている`,
      色の一覧.slice(0, 12).join('\n    '))
  } else {
    ok(`ボタンの色 … ${SCREENS.length} 画面 × 2幅、地の色のままのボタンは無い`)
  }
}

/* ══════════════════════════════════════════════════════════════════
   **空の冊に降ろさない**(第5.200節・2026-09 実機・利用者の指摘)

     > ゲストログインして単語帳にいくと、「ビジネス必須チャンク」
     > 「基礎単語」「コロケーション」などが全くないので直してください。
     > また、ゲストログインだと単語帳とクイックレスポンス帳に
     > トップ画面がいまだにあります。それぞれ排除してください

   **入りたてのゲストそのものを描く** —— `review_words` が空を返す。
   これが「いちばん危ない形」である(CLAUDE.md「**無ければ素通り**する
   形の検証を書かない」)。

   **「出る」と「出ない」の両方を見る**(CLAUDE.md)。
   ・移る先がある(`?chunk=1`)… 出題に入り、**トップ画面は出ない**
   ・移る先が無い(素の `?screen=wordbook`)… これまでどおり一覧に残す。
     ここを見ないと、**いつでも移る形**に書き換えても緑のままになる。
   ══════════════════════════════════════════════════════════════════ */
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await page.route('**/rest/v1/**', (route) => {
    const u = route.request().url()
    let body = []
    /* **`review_words` は空のまま。** 入りたてのゲストの単語帳である */
    if (u.includes('vocab_week')) body = [{ days: 0, answered: 0, correct: 0, weeks: 0 }]
    if (u.includes('weekly_goal')) {
      body = [{ words_goal: 0, words_done: 0, sent_goal: 0, sent_done: 0 }]
    }
    return route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify(body),
    })
  })
  await page.route('**/auth/v1/**', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: '{"data":{"user":null}}',
  }))

  /* ── ① 移る先がある … そのまま始まる ─────────────────────── */
  await page.goto(`http://localhost:${PORT}/__bar.html?screen=wordbook&chunk=1`,
    { waitUntil: 'networkidle' })
  let 始まった = true
  try {
    await page.waitForSelector('.wbfocus .wordcard', { timeout: 10000 })
  } catch { 始まった = false }
  if (始まった) {
    ok('空の単語帳 … 中身のある冊へ移って、そのまま始まる(トップ画面が出ない)')
  } else {
    ng('空の単語帳 … 開いてもトップ画面のままで、出題に入らない',
      '自分の単語帳が 0 語のゲストが、いつも見ている画面である')
  }

  /* **どの冊へ移ったのかも数える。** 「始まったか」だけだと、
     **自分の単語帳のまま始まる形**に書き換えても緑になる */
  const 冊 = await page.evaluate(
    () => document.querySelector('.bookpick-name')?.textContent?.trim() ?? '',
  )
  if (冊 && 冊 !== '自分の単語帳') {
    ok(`空の単語帳 … 中身のある冊が開いている(${冊})`)
  } else {
    ng(`空の単語帳 … 空のままの冊が開いている(${冊 || '名前が出ていない'})`,
      '移る先が無かったか、移る判断が効いていない')
  }

  /* ── ② 語があれば、移らない(**「出ない」側**)────────────────
     ここを見ないと、**いつでも移る形**に書き換えても緑のままになる。
     `?screen=wordbook` は `learnerId` を渡すので、窓口に語を返せる */
  const page2 = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await page2.route('**/rest/v1/**', (route) => {
    const u = route.request().url()
    let body = []
    if (u.includes('review_words')) {
      body = ['answer', 'engineer', 'quiet'].map((x, i) => ({
        word_norm: x, display: x, kind: 'phrase', pos: '熟語',
        status: 'learning', box: 2, learn_streak: 4,
        due_on: '2020-01-01', added_at: '2026-09-01', meaning_ja: `意味${i}`,
        seen_in: null, seen_in_ja: null,
        material_id: null, material_title: null, industry: 'it', topic: null,
      }))
    }
    return route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify(body),
    })
  })
  await page2.route('**/auth/v1/**', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: '{"data":{"user":null}}',
  }))
  await page2.goto(`http://localhost:${PORT}/__bar.html?screen=wordbook&chunk=1`,
    { waitUntil: 'networkidle' })
  await page2.waitForSelector('.bookpick', { timeout: 10000 })
  await page2.waitForTimeout(800)
  const 語あり = await page2.evaluate(
    () => document.querySelector('.bookpick-name')?.textContent?.trim() ?? '',
  )
  if (語あり === '自分の単語帳') {
    ok('語がある単語帳 … 既定のまま(自分の単語帳)。勝手に移らない')
  } else {
    ng(`語がある単語帳 … 勝手に「${語あり || '(名前なし)'}」へ移っている`,
      '移ってよいのは、いまの冊が空のときだけ(第5.200節)')
  }
  await page2.close()

  /* ── ③ 移る先が無い … これまでどおり一覧に残す ───────────── */
  await page.goto(`http://localhost:${PORT}/__bar.html?screen=wordbook`,
    { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  const 残った = await page.evaluate(() => !document.querySelector('.wbfocus .wordcard'))
  if (残った) {
    ok('空の単語帳 … 移る先が1冊も無ければ、これまでどおり一覧に残す')
  } else {
    ng('空の単語帳 … 移る先が無いのに、出題に入っている',
      '1語も無いところから問を作っている(行き止まり)')
  }
  await page.close()
}


/* ══════════════════════════════════════════════════════════════════
   **集中モードで、いま見ている版が分かる**(第5.207節・2026-09 実機)

     > 集中モードの歯車の中に、版を1行出しましょうか → はい(利用者)

   集中モードは画面をまるごと覆うので、フッターの版が見えない。
   「直したはずのものが直っていない」の多くは**端末に残った古い内容**
   なので、**閉じずに確かめられる**ようにする。

   **帯を2行にしてまでは出さない**(利用者の指定)。だから
   **狭い画面で「表示」を開いたときだけ**出す。
   **「出る」と「出ない」の両方を見る** —— 片方だけだと、
   いつも出す形にも・どこにも出さない形にも書き換えられる。
   ══════════════════════════════════════════════════════════════════ */
{
  const 見る = async (w) => {
    const page = await browser.newPage({ viewport: { width: w, height: 900 } })
    await page.goto(`http://localhost:${PORT}/__bar.html?screen=focusver`,
      { waitUntil: 'networkidle' })
    await page.waitForTimeout(250)
    /* **見えているか**は Playwright に訊く。`offsetParent` は
       **先祖が `position: fixed` だと null になる**ので、
       集中モードのように浮いている画面では当てにならない */
    const 見える = async (sel) => {
      const el = page.locator(sel)
      return (await el.count()) ? el.first().isVisible() : false
    }
    const 閉じたまま = await 見える('.focus-ver')
    /* 「表示」を開く(狭い画面にしかない) */
    const gear = page.locator('.lesson-more')
    const 歯車 = await 見える('.lesson-more')
    if (歯車) { await gear.first().click(); await page.waitForTimeout(250) }
    const 開いたあと = await 見える('.focus-ver')
      ? (await page.locator('.focus-ver').first().textContent()).trim() : ''
    /* **どこまで来たかを、必ず持ち帰る**(CLAUDE.md「道が2つあるものは、
       いまどちらを通ったかを見えるようにしてから直す」)。
       これが無いと、赤くなったときに**画面が描けていないのか・
       札が出ていないのか**が分からない */
    const 様子 = await page.evaluate(() => ({
      枠: !!document.querySelector('.focus'),
      歯車の数: document.querySelectorAll('.lesson-more').length,
      欄: document.querySelector('.lesson-settings')?.className ?? '(無し)',
      札: document.querySelector('.focus-ver')?.textContent ?? '(無し)',
    }))
    await page.close()
    return { 閉じたまま, 開いたあと, 歯車, 様子 }
  }

  const あと = (r) => `枠 ${r.様子.枠} / 歯車 ${r.様子.歯車の数}(見える ${r.歯車})`
    + ` / 欄「${r.様子.欄}」/ 札「${r.様子.札}」`
  const 狭 = await 見る(390)
  /* **まず、画面が描けているか。** ここが偽なら、下の2本は
     「出ない」ではなく「そもそも見ていない」である */
  if (狭.様子.枠 && 狭.様子.歯車の数 === 1) {
    ok('版 … 骨組みの集中モードが描けている(歯車あり)')
  } else ng('版 … 骨組みの集中モードが描けていない', あと(狭))
  if (!狭.閉じたまま) {
    ok('版 … 畳んでいるあいだは出さない(帯を太らせない)')
  } else ng('版 … 畳んでいるのに、版が出ている', あと(狭))
  if (狭.開いたあと.includes(STAMP)) {
    ok(`版 … 「表示」を開くと出る(${狭.開いたあと})`)
  } else ng('版 … 「表示」を開いても、版が出ない', あと(狭))

  const 広 = await 見る(1280)
  if (!広.閉じたまま) ok('版 … パソコンの帯には出さない(閉じればフッターに出ている)')
  else ng('版 … パソコンの帯にも出てしまう', あと(広))
}

/* ══════════════════════════════════════════════════════════════════
   **本文が無い教材の集中モード**(第5.208節・2026-09 実機)

     > いつの間にか文系トレーニングから集中モードが消えています

   文型ドリルには読む本文が無いので、本文を読む集中モード
   (`FocusReader`)には入れない。そこでボタンごと消してしまい、
   **行き止まり**になっていた。いまは**そのページの設問を1問ずつ**出す。

   **「出る」と「出ない」の両方を見る**(CLAUDE.md)——
   本文のある教材で、これまでどおり**本文を読む**集中モードに
   入ることまで見ないと、そちらを壊しても緑のままになる。
   ══════════════════════════════════════════════════════════════════ */
{
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } })
  await page.goto(`http://localhost:${PORT}/__bar.html?kind=drill`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)

  /** 紙のほう(押す前)。**`only` を足したせいで全問が消えていないか** */
  const 紙の問 = await page.evaluate(
    () => document.querySelectorAll('.lesson-page:not(.is-closed) .lesson-items > li').length,
  )
  if (紙の問 >= 3) ok(`ドリル … 紙には設問がぜんぶ出る(${紙の問} 問)`)
  else ng('ドリル … 紙から設問が消えている', String(紙の問))

  const 集中 = page.locator('.practice-row .btn', { hasText: '集中モード' })
  if (await 集中.count()) ok('ドリル … 集中モードのボタンが出る(行き止まりにしない)')
  else {
    ng('ドリル … 集中モードのボタンが無い',
      (await page.locator('.practice-row .btn').allTextContents()).join(' / '))
  }
  if (await 集中.count()) {
    await 集中.first().click()
    await page.waitForTimeout(500)
    const 中 = await page.evaluate(() => ({
      枠: !!document.querySelector('.focus'),
      問: document.querySelectorAll('.focus .lesson-items > li').length,
      札: (document.querySelector('.focus-count')?.textContent ?? '').trim(),
      前が押せるか: !document.querySelector('.focus-move')?.disabled,
      本文の画面か: !!document.querySelector('.focus .etext-sent'),
    }))
    if (中.枠 && 中.問 === 1) ok(`ドリル … 集中モードは1問だけ(${中.札})`)
    else ng('ドリル … 1問だけになっていない', `枠 ${中.枠} / 問 ${中.問}`)
    /* **何問めかを必ず出す**(数が無いと、どこまで来たか分からない) */
    if (/^1 \/ \d+ 問$/.test(中.札)) ok('ドリル … 何問めかが札に出る')
    else ng('ドリル … 何問めかが出ていない', 中.札 || '(空)')
    /* **先頭で「前」は押せない**(効かない操作を見せない) */
    if (!中.前が押せるか) ok('ドリル … 1問めでは「前」を押せない')
    else ng('ドリル … 1問めなのに「前」が押せる')

    await page.locator('.focus-move', { hasText: '次' }).first().click()
    await page.waitForTimeout(400)
    const 次 = await page.evaluate(() => ({
      札: (document.querySelector('.focus-count')?.textContent ?? '').trim(),
      前が押せるか: !document.querySelector('.focus-move')?.disabled,
    }))
    if (/^2 \/ /.test(次.札) && 次.前が押せるか) ok(`ドリル … 送ると次の問へ(${次.札})`)
    else ng('ドリル … 送っても次の問へ行かない', `${次.札} / 前 ${次.前が押せるか}`)
  }
  await page.close()

  /* ── **「出ない」側。** 本文のある教材は、これまでどおり本文を読む ───── */
  const page2 = await browser.newPage({ viewport: { width: 390, height: 900 } })
  await page2.goto(`http://localhost:${PORT}/__bar.html`, { waitUntil: 'networkidle' })
  await page2.waitForTimeout(600)
  const 集中2 = page2.locator('.practice-row .btn', { hasText: '集中モード' })
  if (await 集中2.count()) {
    await 集中2.first().click()
    await page2.waitForTimeout(600)
    const 本文 = await page2.evaluate(() => ({
      枠: !!document.querySelector('.focus'),
      本文の画面か: !!document.querySelector('.focus .etext'),
      設問の紙か: !!document.querySelector('.focus .lesson-items'),
    }))
    if (本文.枠 && 本文.本文の画面か && !本文.設問の紙か) {
      ok('本文のある教材 … これまでどおり、本文を読む集中モードに入る')
    } else {
      ng('本文のある教材 … 集中モードの中身が変わっている',
        `本文 ${本文.本文の画面か} / 設問 ${本文.設問の紙か}`)
    }
  } else ng('本文のある教材 … 集中モードのボタンが消えた')
  await page2.close()
}

/* ══════════════════════════════════════════════════════════════════
   **文法を、集中モードでない場所でも見る**(第5.209節・第5.210節)

     > 文法を見るのはそもそも集中モードでない場所で見れませんか？
     > もし変更を加えるなら全ての場所で同じようにしてください。

   **源の見張り(`npm run test:play`)だけでは足りない。** あちらは
   「`grammarOf(it, sec.exercise_type)` と書いてあるか」を見ているだけで、
   **本当に画面に札が出るか**は分からない。

   ここでいちばん見たいのは**誤り訂正**である。解説は `answer`
   (直した英文)に付いているので、`prompt_en`(誤った文)のほうを
   見に行くと控えと食い違い、**解説がまるごと消える。**
   ══════════════════════════════════════════════════════════════════ */
{
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } })
  await page.goto(`http://localhost:${PORT}/__bar.html?role=trainer&who=g1&kind=drill`,
    { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)

  /** その問(`data-key` ではなく英文で探す)の行と、文法のボタン */
  const 問 = (en) => page.locator('.lesson-items > li')
    .filter({ hasText: en }).first()

  // ── **出る側①** 英文和訳。解説は `prompt_en` に付いている ──
  const 和訳 = 問('She has just finished her report.')
  const 和訳ボタン = 和訳.locator('button', { hasText: '文法を見る' })
  if (await 和訳ボタン.count()) {
    ok('文法 … 英文和訳の問に「文法を見る」が出ている')
    await 和訳ボタン.first().click()
    await page.waitForTimeout(300)
    const 札 = await 和訳.locator('.gnote-part .gnote-r').allInnerTexts()
    const 役 = 札.map((t) => t.trim().charAt(0)).join('')
    if (役 === 'SVO') ok(`文法 … 押すと S / V / O の札が出る(${役})`)
    else ng('文法 … 札が出ない、または役が違う', 役 || '(0個)')
    const 眉 = (await 和訳.locator('.gnote-pat').innerText().catch(() => '')).trim()
    if (/第3文型/.test(眉)) ok(`文法 … 文型も出ている(${眉})`)
    else ng('文法 … 文型が出ていない', 眉 || '(無し)')
  } else ng('文法 … 英文和訳の問に「文法を見る」が出ない')

  /* ── **出ない側。** 控えの無い問にはボタンを出さない
        (効かない操作を見せない)。**これが無いと、
        「どの問にも出す」形に壊しても緑のまま**になる。
        同じ1ページめにある問で見る ── */
  const 無し = 問('They have known each other for ten years.')
  if (await 無し.locator('button', { hasText: '文法' }).count() === 0) {
    ok('文法 … 解説の無い問には、ボタンごと出さない')
  } else ng('文法 … 解説が無いのに「文法を見る」が出ている')

  /* ── **実機で消えていた形**(第5.211節・利用者の写真)。
        `Let's see . . .` を文に切ると `"."` だけの「文」ができる。
        S も V も無いので札を付けようがなく、**発言まるごと
        「文法を見る」が出なくなっていた** ── */
  const 点 = 問("Let's see")
  const 点ボタン = 点.locator('button', { hasText: '文法を見る' })
  if (await 点ボタン.count()) {
    ok('文法 … `. . .` を含む発言にも「文法を見る」が出る')
    await 点ボタン.first().click()
    await page.waitForTimeout(300)
    const 数 = await 点.locator('.gnote-item').count()
    if (数 === 2) ok(`文法 … 札の付く2文だけが出る(${数} 文)`)
    else ng('文法 … 出る文の数が違う', String(数))
    /* **注意書きは出さない。** 句読点は字でも数字でもないので、
       「出していない文がある」には当たらない */
    if (await 点.locator('.gnote-empty').count() === 0) {
      ok('文法 … 句読点だけの「文」を、足りない文として数えていない')
    } else ng('文法 … 出ている文は全部出ているのに、注意書きが出ている')
  } else ng('文法 … `. . .` を含む発言に「文法を見る」が出ない')

  /* ── **出る側②(ここが要)** 誤り訂正。
        画面に出るのは**直した英文**であって、誤った文ではない。

        **ページを送ってから見る。** レッスン表示はいま開いている
        1ページだけを見せる作りで、ほかのページは `is-closed` で
        隠れている(描いてはあるので `count()` は 1 を返す ——
        **在るかどうかだけで見ると、押せないものを押しに行く**) ── */
  const 送り = page.locator('.lesson-pages button[aria-label="次のページ"]')
  await 送り.click()
  await page.waitForTimeout(300)
  await 送り.click()          // 1ページめ(和訳)→ 2(英訳)→ 3(誤り訂正)
  await page.waitForTimeout(400)
  const 誤り = 問('I have went to the office already.')
  const 誤りボタン = 誤り.locator('button', { hasText: '文法を見る' })
  if (await 誤りボタン.count()) {
    ok('文法 … 誤り訂正の問にも「文法を見る」が出ている')
    await 誤りボタン.first().click()
    await page.waitForTimeout(300)
    const 文 = (await 誤り.locator('.gnote-en').innerText().catch(() => ''))
      .replace(/\s+/g, ' ').trim()
    // 札(S / V / M)が字のあいだに混ざるので、語の有無で見る
    if (/gone/.test(文) && !/went/.test(文)) {
      ok('文法 … 誤り訂正は、直した英文のほうを解説している')
    } else {
      ng('文法 … 誤り訂正の解説が、誤った文のほうを向いている', 文 || '(空)')
    }
  } else ng('文法 … 誤り訂正の問に「文法を見る」が出ない')

  /* ── 隠せること(**行き止まりを作らない**)。
        **開いたそのページで見る** —— 誤り訂正のページに居るので、
        戻らずにここで押す ── */
  const 隠す = 誤り.locator('button', { hasText: '文法を隠す' })
  if (await 隠す.count()) {
    await 隠す.first().click()
    await page.waitForTimeout(250)
    if (await 誤り.locator('.gnote').count() === 0) ok('文法 … もう一度押すと閉じる')
    else ng('文法 … 押しても閉じない')
  } else ng('文法 … 開いたあとのボタンが「文法を隠す」になっていない')

  await page.close()
}

/* ══════════════════════════════════════════════════════════════════
   ② スラッシュリーディングと、ボタンの色(第5.242節・2026-09-23)

     > スラッシュリーディングの「区切りを出す、隠す」「訳を出す、隠す」
     > 「通しで見る」などの UI がアプリの作成をしている私でもよくわからず
     > 混乱します。結局スラッシュを入れ終えれば、必要なのは
     > **スラッシュを入れ終えた英文と訳が並んでいる部分だけです。**
     > そして、何よりも全体の統一感というかわかりやすさをかいぜんして
     > ください。

     > **ボタンが全て白なのも分かりにくい要因の一つです**

   **この4つは、実際に描くまで分からない。**
   `lint` も `build` も通ったまま、押すものが3つに戻っていたり、
   英文が2回出ていたり、紙の上で全部が白くなっていたりする。
   ══════════════════════════════════════════════════════════════════ */
{
  const page = await browser.newPage({ viewport: { width: 420, height: 1200 } })
  page.setDefaultTimeout(6000)
  await page.goto(`http://localhost:${PORT}/__bar.html?role=learner&who=g1`,
    { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)

  /* **押せなくても、そこで止めない**(CLAUDE.md)——
     ここで例外を投げると、**この先ぜんぶが黙って測られなくなる** */
  let 開けた = true
  await page.click('.practice-row .btn:has-text("6Steps")').catch(() => { 開けた = false })
  if (!開けた) ng('②と色 … 6Steps を開けない(この先は何も測れていない)')
  await page.waitForTimeout(500)

  /** いま出ている紙の中のボタンを読む(**見えているものだけ**) */
  const 紙のボタン = () => page.evaluate(() => {
    const sheet = document.querySelector('.lesson-sheet')
    // **紙そのものが決めている「素の地色」**を読む。#fff と書き写さない
    const 素 = window.getComputedStyle(sheet ?? document.body)
      .getPropertyValue('--btn-bg').trim()
    const 色 = (v) => {
      const d = document.createElement('div')
      d.style.background = v
      document.body.appendChild(d)
      const out = window.getComputedStyle(d).backgroundColor
      d.remove()
      return out
    }
    const 素の色 = 色(素)
    return [...(sheet?.querySelectorAll('.btn') ?? [])]
      .filter((e) => e.getBoundingClientRect().width > 0)
      .map((e) => ({
        t: e.textContent.trim().slice(0, 18),
        cls: e.className,
        素のまま: window.getComputedStyle(e).backgroundColor === 素の色,
      }))
  })

  /* ── ① **色を決めずに置かない。**6つのステップぜんぶを見て回る ──
        (共通ルール「既定のボタンは、白い紙の上で押せるものに見えない」)

        **2通りで見る。片方だけでは足りない。**
          ・描いた地色が、紙の素の色と同じではないか(**性質で見る**)
          ・`btnTone.js` の3つの色のどれかを持っているか(**一覧は書き写さない**) */
  for (const s of SIX_STEPS) {
    let 押せた = true
    await page.click(`.step-bar-item[aria-label^="${s.no}"]`).catch(() => { 押せた = false })
    if (!押せた) { ng(`ボタンの色 … ${s.no} の丸を押せない`); continue }
    await page.waitForTimeout(450)
    const 並び = await 紙のボタン()
    if (!並び.length) { ng(`ボタンの色 … ${s.no} ${s.label} に、紙のボタンが1つも無い`); continue }
    const 白 = 並び.filter((b) => b.素のまま).map((b) => b.t)
    const 無色 = 並び.filter((b) => !hasTone(b.cls)).map((b) => b.t)
    if (白.length) {
      ng(`ボタンの色 … ${s.no} ${s.label} に、紙の地色のままのボタンがある`, 白.join(' / '))
    } else if (無色.length) {
      ng(`ボタンの色 … ${s.no} ${s.label} に、色を決めていないボタンがある`, 無色.join(' / '))
    } else {
      ok(`ボタンの色 … ${s.no} ${s.label} の ${並び.length} 個とも、色を持っている`)
    }
  }

  /* ── ② **選ぶ欄は、6つとも同じ帯に並ぶ** ──
        ①の「難易度」と②の「単位」だけが**自分用の行を別に持ち、右寄せ**
        だった。ステップを移るたびに選ぶ欄の場所が動くので、
        「統一感が無い」の正体の1つだった。
        **「帯に在る」と「帯の外に無い」の両方を見る** */
  for (const no of ['①', '②']) {
    await page.click(`.step-bar-item[aria-label^="${no}"]`).catch(() => {})
    await page.waitForTimeout(450)
    const 数 = await page.evaluate(() => ({
      帯: document.querySelectorAll('.passage-tools .rate-pick').length,
      外: [...document.querySelectorAll('.rate-pick')]
        .filter((e) => !e.closest('.passage-tools') && e.getBoundingClientRect().width > 0).length,
    }))
    if (数.帯 > 0 && 数.外 === 0) ok(`選ぶ欄 … ${no} の選ぶ欄 ${数.帯} 個は、ぜんぶ帯の中`)
    else ng(`選ぶ欄 … ${no} の選ぶ欄が帯の外にある`, `帯 ${数.帯} / 外 ${数.外}`)
  }

  /* ── ③ ②に押すものは、Listen と「区切りを消す」だけ ──
        消した3つ(「訳を出す / 隠す」「すべての訳」「通しで見る」)が
        戻ってきたら赤くする。**文言そのものを見る** */
  await page.click('.step-bar-item[aria-label^="②"]').catch(() => {})
  await page.waitForTimeout(500)
  const 消した = await page.evaluate(() => [...document.querySelectorAll('.slash .btn')]
    .map((e) => e.textContent.trim())
    .filter((t) => /訳を出す|訳を隠す|通しで見る|区切りに戻る|すべての/.test(t)))
  if (消した.length === 0) ok('② … 「訳を出す」「通しで見る」は、もう出していない')
  else ng('② … 消したはずの押すものが戻っている', 消した.join(' / '))

  /* ── ④ **英文は1つだけ。**押して区切る行と、確かめる箱で
        **同じ英文を2回**出していた。

        **描いたものから期待値を作らない**(2026-09-23 に、ここで一度転んだ)。
        はじめ「`.slash-body` の字を `wordsOf()` で数えた数 = `.slash-w` の数」
        と書いたが、**2回描くと両方とも倍になる**ので、
        わざと2回描いても緑のままだった。
        **外に持ち出せる期待値が無いときは、中だけで成り立つ性質で見る。**

          ・押せる語は、**どれか1つのカタマリの中**にいる
          ・**同じ4語のつながりが、二度出てこない**
            —— 英文を2回描けば、どの4語も必ず二度出る。
               ふつうの英文で同じ4語が並ぶことは、まず無い */
  const 二重 = await page.evaluate(() => {
    const out = []
    const rows = [...document.querySelectorAll('.slash-row')]
    if (!rows.length) return ['そもそも本文が1つも描かれていない']
    for (const li of rows) {
      const body = li.querySelector('.slash-body')
      if (!body) { out.push('本文の箱が無い'); continue }
      const 札 = [...body.querySelectorAll('.slash-w')]
      if (!札.length) { out.push('押せる語が1つも無い'); continue }
      const 外 = 札.filter((e) => !e.closest('.slash-chunk')).length
      if (外) out.push(`${外} 語が、カタマリの外にいる`)
      const 語 = 札.map((e) => e.textContent.trim().toLowerCase()).filter(Boolean)
      const 見た = new Set()
      for (let i = 0; i + 4 <= 語.length; i += 1) {
        const key = 語.slice(i, i + 4).join(' ')
        if (見た.has(key)) { out.push(`「${key}」が二度出ている`); break }
        見た.add(key)
      }
    }
    return out
  })
  const 語数 = await page.evaluate(() => document.querySelectorAll('.slash-w').length)
  if (二重.length === 0 && 語数 > 0) ok(`② … 英文は1つだけ(${語数} 語を、1回ずつ)`)
  else ng('② … 英文を2回描いている / 描けていない', 二重.join(' / ') || `${語数} 語`)

  /* ── ⑤ **区切りを入れるまで訳は出ない。入れたら、その場に出る** ──
        「出る」と「出ない」の両方を見る —— 片方だけだと、
        **どこにも出さない形・はじめから全部出す形**に書き換えても緑のまま */
  const 訳の数 = () => page.evaluate(() => ({
    かたまり: document.querySelectorAll('.slash-chunk-ja').length,
    まるごと: document.querySelectorAll('.slash-ja').length,
  }))
  const 前 = await 訳の数()
  if (前.かたまり === 0 && 前.まるごと === 0) ok('② … 区切りを入れる前は、訳を出さない')
  else ng('② … 区切っていないのに訳が出ている', JSON.stringify(前))

  /* **控えのある段落**(`it-1`)で区切る。`me` の前は決まりに反しない */
  let 押せた = true
  await page.click('.slash-word:text-is("me")').catch(() => { 押せた = false })
  if (!押せた) ng('② … 語を押せない(この先は測れていない)')
  await page.waitForTimeout(500)
  const 後 = await 訳の数()
  if (後.かたまり > 0) ok(`② … 区切ると、そのカタマリの下に訳が出る(${後.かたまり} 個)`)
  else ng('② … 区切っても、カタマリの訳が出ない')

  /* ── ⑥ **控えが無い段落**(骨組みの `it-2`)でも、黙って落とさない ──
        **「無ければ素通り」する形を、検証の中に必ず置く**(CLAUDE.md)。
        カタマリの訳が無ければ、これまでどおり発言まるごとの訳を出す */
  let 押せた2 = true
  await page.click('.slash-word:text-is("behind")').catch(() => { 押せた2 = false })
  if (!押せた2) ng('② … 控えの無い段落の語を押せない(この先は測れていない)')
  await page.waitForTimeout(500)
  const 逃げ道 = await 訳の数()
  if (逃げ道.まるごと > 0) ok('② … カタマリの訳が無い教材では、発言まるごとの訳を出す')
  else ng('② … 控えの無い教材で、訳が1つも出ない(黙って落としている)')

  await page.close()
}

/* ══════════════════════════════════════════════════════════════════
   紙の「覚えておきたい表現」は、表現ごとに見出しを立てる
   (第5.243節・2026-09-23 実機・利用者の指定)

     > 覚えておきたい表現の見出しをしっかりつけてほしいです。
     > PDF化したときに①の「bring up」⑧の「look into」⑭の「keep up with」
     > など、これらピックアップした表現ごとに見出しにして、問題の番号も
     > それぞれ①〜⑥(問題数に応じて)にするべきです。

   42 問がひと続きの通し番号で並び、**表現そのものも1問として混ざって
   いた。** どこからどこまでが同じ表現の練習なのか、紙では分からない。

   **紙の見え方は、描くまで分からない**(`print-only` で画面には出ない)。
   **数を書き写さない** —— 紙の見出しを、**画面のかたまりの札**と
   突き合わせる(同じものを2通りに数えない・CLAUDE.md)。
   ══════════════════════════════════════════════════════════════════ */
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } })
  page.setDefaultTimeout(6000)
  await page.goto(`http://localhost:${PORT}/__bar.html?role=trainer&who=g1`,
    { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)

  /* **画面に出ているかたまり**(これが期待値。どこにも書き写さない) */
  const 画面 = await page.evaluate(() => [...document.querySelectorAll('.chunk .chunk-en')]
    .map((e) => e.textContent.trim()).filter(Boolean))

  /* **本物の `printElement()` と同じ印を付ける**(`src/lib/print.js`)。
     3つそろって初めて紙の指定が効く */
  await page.evaluate(() => {
    const sheet = document.querySelector('#lesson-sheet') ?? document.querySelector('.lesson-sheet')
    if (!sheet) return
    sheet.classList.add('print-target')
    document.body.classList.add('is-printing')
    for (let el = sheet.parentElement; el && el !== document.body; el = el.parentElement) {
      el.classList.add('print-path')
    }
  })
  await page.emulateMedia({ media: 'print' })
  await page.waitForTimeout(300)

  const 紙 = await page.evaluate(() => ({
    見出し: [...document.querySelectorAll('.qrsheet-sub [lang="en"]')]
      .map((e) => e.textContent.trim()),
    訳: [...document.querySelectorAll('.qrsheet-subja')].map((e) => e.textContent.trim()),
    束: [...document.querySelectorAll('.qrsheet-head')].map((h) => {
      const ol = h.querySelector('ol.qrsheet-list')
      return {
        // **番号を振り直す指定が、本当に当たっているか。**
        // `.qrsheet-groups` に包むと `counter-reset: none` で通しになる
        /* **練習が1つも無い表現には `<ol>` が無い**(`ch-2`)。
           そこは `null` にして、下では**問のある束だけ**を見る */
        振り直す: ol ? window.getComputedStyle(ol).counterReset : null,
        問: [...h.querySelectorAll('ol.qrsheet-list > li .qrsheet-ja')]
          .map((e) => e.textContent.trim()),
      }
    }),
    組: [...document.querySelectorAll('.qrsheet-title')].map((e) => e.textContent.trim()),
  }))
  await page.close()

  /* ── ① **表現ごとに見出しが立っている。**画面の札と突き合わせる ── */
  if (!画面.length) {
    ng('紙の表現 … 画面にかたまりが1つも無い(この先は何も測れていない)')
  } else if (紙.見出し.join('|') === 画面.join('|')) {
    ok(`紙の表現 … ${画面.length} 個とも、表現ごとに見出しになっている`)
  } else {
    ng('紙の表現 … 見出しが画面のかたまりと合わない',
      `紙 ${紙.見出し.join(' / ') || '(無し)'} / 画面 ${画面.join(' / ')}`)
  }

  /* ── ② **番号は表現ごとに1から。**振り直す指定が効いているか ──
        `.qrsheet-groups` に包むと `counter-reset: none` になり、
        番号が表現をまたいで通しになる。**そこを直に見る** */
  const 問のある束 = 紙.束.filter((b) => b.問.length > 0)
  const 通し = 問のある束.filter((b) => !/\bqr\b/.test(b.振り直す ?? ''))
  if (!問のある束.length) {
    ng('紙の表現 … 練習の付いた表現が1つも無い(この行は何も測れていない)')
  } else if (!通し.length) {
    ok(`紙の表現 … 番号は表現ごとに振り直す(${問のある束.length} 束とも)`)
  } else {
    ng('紙の表現 … 番号が表現をまたいで続いている',
      通し.map((b) => b.振り直す ?? '(一覧が無い)').join(' / '))
  }

  /* ── ③ **表現そのものが、番号の付いた問に混ざっていない** ──
        いちばん直したかったところ。「① (話題を)持ち出す・切り出す |
        bring up」が1問として並んでいた */
  const 訳の集合 = new Set(紙.訳.filter(Boolean))
  const 混ざり = 紙.束.flatMap((b) => b.問).filter((ja) => 訳の集合.has(ja))
  if (訳の集合.size && !混ざり.length) {
    ok('紙の表現 … 表現そのものは、番号の付いた問に混ざっていない')
  } else if (!訳の集合.size) {
    ng('紙の表現 … 見出しに意味が出ていない(この行は何も測れていない)')
  } else {
    ng('紙の表現 … 表現そのものが、まだ1問として並んでいる', 混ざり.join(' / '))
  }

  /* ── ④ **練習が1つも無い表現も、見出しだけ出す** ──
        **「無ければ素通り」する形を、検証の中に必ず置く**(CLAUDE.md)。
        骨組みの `ch-2`(behind the goal)には練習が無い。
        落としてしまうと、教材にあるものが紙から黙って消える */
  const 空 = 紙.束.filter((b) => b.問.length === 0).length
  if (空 > 0) ok(`紙の表現 … 練習の無い表現も、見出しは出る(${空} 個)`)
  else ng('紙の表現 … 練習の無い表現が、紙から落ちている')

  /* ── ⑤ **組の見出しは、数え直した数を出す** ──
        表現を見出しにしたぶん、問の数は減る。書き写すと片方だけ古くなる */
  const 問の数 = 紙.束.reduce((n, b) => n + b.問.length, 0)
  const 組 = 紙.組.find((t) => /表現/.test(t)) ?? ''
  if (組.includes(`${紙.束.length} 表現`) && 組.includes(`${問の数} 問`)) {
    ok(`紙の表現 … 組の見出しが、いまの中身と合っている(${組})`)
  } else {
    ng('紙の表現 … 組の見出しの数が、並んでいるものと合わない',
      `${組 || '(無し)'} / 実際は ${紙.束.length} 表現・${問の数} 問`)
  }
}

/* ══════════════════════════════════════════════════════════════
   **ゲストの持ちものからテストを作る**(第5.260節・2026-09-25 利用者の指定)

     > ゲストのページに教材や彼らの単語帳、quick response 帳があります。
     > それらのデータを基にテストを作りたいです。

   **算段は `npm run test:play` が見る。ここは描いて測る。**

   ①出どころの3つが、押して入り切りできるか
   ②1つも選んでいなければ、押せないか(行き止まりを作らない)
   ③「教材」を選んだときだけ、どの教材かの欄が出るか(出る / 出ないの両方)
   ④**1本も出していないゲスト**では、札ではなくその旨を出すか
   ⑤押したら、何か言うか(黙って終わらない)
   ⑥狭い画面で横にはみ出さないか
   ══════════════════════════════════════════════════════════════ */
for (const W of [1280, 390]) {
  const page = await browser.newPage({ viewport: { width: W, height: 900 } })
  page.setDefaultTimeout(8000)
  page.setDefaultNavigationTimeout(8000)
  await page.route('**/rest/v1/**', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: '[]',
  }))
  await page.route('**/auth/v1/**', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: '{}',
  }))
  await page.goto(`http://localhost:${PORT}/__bar.html?screen=exam`,
    { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(700)

  const 見る = () => page.evaluate(() => {
    const box = document.querySelector('.exammaker')
    const 押 = (label) => [...document.querySelectorAll(`[aria-label="${label}"] .theme-btn`)]
      .map((b) => `${b.textContent.trim()}${b.getAttribute('aria-pressed') === 'true' ? '*' : ''}`)
    const make = [...document.querySelectorAll('.exammaker .btn')]
      .find((b) => /テストを作る|作っています/.test(b.textContent))
    return {
      有る: !!box,
      出どころ: 押('どこから出すか'),
      作れる: make ? !make.disabled : null,
      教材欄: document.querySelectorAll('.exammaker-list .theme-btn').length,
      無い文: [...document.querySelectorAll('.exammaker .field-hint')]
        .some((p2) => /まだありません/.test(p2.textContent)),
      言った: [...document.querySelectorAll('.exammaker .field-hint, .exammaker .notice')]
        .map((p2) => p2.textContent.trim()).filter(Boolean),
      はみ出し: box ? Math.max(0, box.scrollWidth - box.clientWidth) : 0,
    }
  })
  /* **押すのは、利用者と同じ道で。** `aria-label` で組を絞ってから文字で選ぶ */
  const 押す = async (label, text) => {
    await page.evaluate(([l, t]) => {
      const b = [...document.querySelectorAll(`[aria-label="${l}"] .theme-btn`)]
        .find((x) => x.textContent.trim() === t)
      b?.click()
    }, [label, text])
    await page.waitForTimeout(250)
  }

  const 初 = await 見る()
  if (!初.有る) {
    ng(`テスト ${W}px … 画面が描けていない`, '`?screen=exam` が開かない')
  } else if (初.出どころ.join(' ') !== '教材 単語帳* Quick Response 帳*') {
    ng(`テスト ${W}px … 出どころの既定が読み取れない(${初.出どころ.join(' / ')})`,
      '「単語帳」と「Quick Response 帳」が押されていること')
  } else if (初.教材欄 !== 0) {
    ng(`テスト ${W}px … 「教材」を選んでいないのに、教材の札が ${初.教材欄} 個出ている`,
      '効かない操作を見せない(CLAUDE.md)')
  } else if (初.はみ出し > 0) {
    ng(`テスト ${W}px … ${初.はみ出し}px 横にはみ出している`)
  } else {
    ok(`テスト ${W}px … 出どころ3つ(既定は単語帳 / QR 帳)・教材の札は出ない`)
  }

  if (初.有る) {
    /* ── ② **1つも選んでいなければ押せない** ── */
    await 押す('どこから出すか', '単語帳')
    await 押す('どこから出すか', 'Quick Response 帳')
    const 空 = await 見る()
    if (空.作れる !== false) {
      ng(`テスト ${W}px … 出どころを1つも選んでいないのに押せる`,
        '行き止まりを作らない(押しても何も起きない、を作らない)')
    } else {
      ok(`テスト ${W}px … 出どころを1つも選ばなければ、押せない`)
    }

    /* ── ③ **「教材」を選ぶと、どの教材かの欄が出る**(出る / 出ないの両方)── */
    await 押す('どこから出すか', '教材')
    const 教 = await 見る()
    if (教.教材欄 < 3) {
      ng(`テスト ${W}px … 「教材」を選んでも、えらぶ札が ${教.教材欄} 個`,
        '骨組みには3本入れてある')
    } else if (教.作れる !== false) {
      ng(`テスト ${W}px … 教材を1本も選んでいないのに押せる`)
    } else {
      ok(`テスト ${W}px … 「教材」を選ぶと、どれから出すかの札が ${教.教材欄} 個出る`)
    }

    /* ── ⑤ **押したら、何か言う**(黙って終わらない)── */
    await 押す('どこから出すか', '単語帳')
    await page.evaluate(() => {
      [...document.querySelectorAll('.exammaker .btn')]
        .find((b) => /テストを作る/.test(b.textContent))?.click()
    })
    await page.waitForTimeout(700)
    const 後 = await 見る()
    /* Supabase に届かないので**1問もできない。** そのときに
       「作りました」と言わないこと、**黙って終わらないこと**を見る */
    const 言 = 後.言った.join(' / ')
    if (!言) {
      ng(`テスト ${W}px … 押したのに、何も言わずに終わった`,
        '成功と失敗を、同じ見た目で終わらせない(CLAUDE.md)')
    } else if (/問できました/.test(言)) {
      ng(`テスト ${W}px … 1問もできていないのに「できました」と言っている(${言})`)
    } else {
      ok(`テスト ${W}px … 押すと、起きたことをそのまま言う(${言})`)
    }
  }
  await page.close()
}
/* **1本も教材を出していないゲスト**では、札ではなくその旨を出す ——
   **「無ければ素通り」する形を、検証の中に必ず置く**(CLAUDE.md) */
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  page.setDefaultTimeout(8000)
  page.setDefaultNavigationTimeout(8000)
  await page.route('**/rest/v1/**', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: '[]',
  }))
  await page.route('**/auth/v1/**', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: '{}',
  }))
  await page.goto(`http://localhost:${PORT}/__bar.html?screen=exam&materials=none`,
    { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(700)
  await page.evaluate(() => {
    [...document.querySelectorAll('[aria-label="どこから出すか"] .theme-btn')]
      .find((b) => b.textContent.trim() === '教材')?.click()
  })
  await page.waitForTimeout(250)
  const 無 = await page.evaluate(() => ({
    札: document.querySelectorAll('.exammaker-list .theme-btn').length,
    文: [...document.querySelectorAll('.exammaker .field-hint')]
      .some((p2) => /まだありません/.test(p2.textContent)),
  }))
  if (無.札 > 0) {
    ng('テスト … 教材が1本も無いのに、えらぶ札が出ている', `${無.札} 個`)
  } else if (!無.文) {
    ng('テスト … 教材が1本も無いことを、画面で言っていない',
      '黙って空にしない(CLAUDE.md)')
  } else {
    ok('テスト … 教材が1本も無いゲストでは、札ではなくその旨を出す')
  }
  await page.close()
}

/* ══════════════════════════════════════════════════════════════
   **聞き流しの「何問ずつ」**(第5.262節・2026-09-26 利用者の指定)

     > この写真だと絞り込みで絞っているのは5問、そして繰り返しにしてある。
     > そういう場合は聞き流しモードもそれに合わせて5問を繰り返してください。
     > 30問選んでいれば30問を繰り返すように。というよりも聞き流しモードの
     > 中でそれを選べるようにしてください。

   **算段は `npm run test:play` が見る。ここは描いて測る。**
   骨組みには**8問**入れてある(上限より多い形・CLAUDE.md)ので、
   5問に絞れば本当に減る —— **絞りを外したら赤くなる。**
   ══════════════════════════════════════════════════════════════ */
for (const [q2, 期待, 何] of [['&size=5', 5, '5問に絞っていた人'], ['', 8, '絞っていない人']]) {
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } })
  page.setDefaultTimeout(8000)
  page.setDefaultNavigationTimeout(8000)
  await page.route('**/rest/v1/**', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: '[]',
  }))
  await page.route('**/auth/v1/**', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: '{}',
  }))
  await page.goto(`http://localhost:${PORT}/__bar.html?screen=qrradio${q2}`,
    { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(700)
  const m = await page.evaluate(() => ({
    数: (document.querySelector('.focus-count')?.textContent ?? '').trim(),
    札: [...(document.querySelector('.radio-pick--take select')?.options ?? [])]
      .map((o) => o.textContent.trim()),
    いま: document.querySelector('.radio-pick--take select')?.value ?? '',
  }))
  const 出た = Number((m.数.split('/')[1] ?? '').trim())
  if (!m.札.length) {
    ng(`聞き流し 390px … 「何問ずつ」の欄が出ていない(${何})`)
  } else if (出た !== 期待) {
    ng(`聞き流し 390px … ${何}なのに ${出た} 問で始まっている`,
      `「${m.数}」—— 期待は ${期待} 問`)
  } else if (!m.札.includes('ぜんぶ') || !m.札.includes('5 問')) {
    ng('聞き流し 390px … 札の一覧が「出しかた」と合っていない', m.札.join(' / '))
  } else {
    ok(`聞き流し 390px … ${何}は ${出た} 問で始まる(${m.札.join(' / ')})`)
  }
  await page.close()
}
/* **中で変えたら、その場で切り替わるか**(出る / 出ないの両方)。
   **「持ち込めている」だけを見ると、中で変えられなくても緑**になる */
{
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } })
  page.setDefaultTimeout(8000)
  page.setDefaultNavigationTimeout(8000)
  await page.route('**/rest/v1/**', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: '[]',
  }))
  await page.route('**/auth/v1/**', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: '{}',
  }))
  await page.goto(`http://localhost:${PORT}/__bar.html?screen=qrradio&size=5`,
    { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(700)
  await page.selectOption('.radio-pick--take select', 'all')
  await page.waitForTimeout(400)
  const 後 = await page.evaluate(() => (
    document.querySelector('.focus-count')?.textContent ?? '').trim())
  const n = Number((後.split('/')[1] ?? '').trim())
  if (n !== 8) {
    ng('聞き流し 390px … 中で「ぜんぶ」にしても、問数が変わらない', `「${後}」`)
  } else {
    ok(`聞き流し 390px … 中で変えれば、その場で切り替わる(${後})`)
  }
  await page.close()
}

await browser.close()
console.log(bad === 0 ? '\n✅ 帯の持ちものは、すべて意図どおりです' : `\n❌ ${bad} 件`)
process.exit(bad === 0 ? 0 : 1)
