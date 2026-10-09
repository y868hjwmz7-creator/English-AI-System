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
/* ★ **棚の数と組の呼び名を、書き写さない**(第5.388節・2026-10-06)。
     もとは `=== 35` と `'趣味・娯楽'` を**そのまま書いて**いたので、
     利用者が分野を1つ足し、組の呼び名を「生活/趣味」に変えた日に
     **3か所が同時に赤くなった** —— 仕組みは1ミリも壊れていないのに。
     **性質で見る**(CLAUDE.md「値を書き写さない」)。 */
import { shelfList } from '../src/data/shelves.js'
import { INDUSTRY_GROUPS } from '../src/data/industries.js'
/** 棚は何冊あるか。**いまの分野の数から出す** */
const 棚の冊数 = () => shelfList().length
/** ★ 「出しかた」に並ぶ札の数。**どの一覧も、持ち主から読む**(第5.414節) */
const 札はいくつ = () => PICKS.length + SIZES.length + 2
  + QUIZ_FORMS.length + LEARN_STAGES.length + plainOrders(WORD_ORDERS).length
/** 組の呼び名(お仕事 / 生活-趣味)。**1か所から配る** */
const 組の呼び名 = () => INDUSTRY_GROUPS.map((g) => g.label)
/* **冊の数を書き写さない**(冊を足した日に、ここだけ古い数が残る) */
import { RIZAP_BOOKS } from '../src/data/rizapBooks.js'
import { SIX_STEPS } from '../src/lib/sixSteps.js'
/* **色の一覧を書き写さない**(第5.242節)。3つの色は `btnTone.js` 1か所 */
import { hasTone } from '../src/lib/btnTone.js'
/* **通しで鳴らすボタンの文字は `wholePlay.js` 1か所**(第5.290節)。
   ここに `'全体を聞く'` と書き写すと、**名前を変えた日に見張りだけが古くなる**
   (値を書き写さない。性質で見る・CLAUDE.md) */
import { WHOLE_PLAY_CORE, wholePlayText } from '../src/lib/wholePlay.js'
/* **1文ずつ鳴らすボタンの文字は `speakLabel.js` 1か所**(第5.297節)。
   **ここに `'聞く'` と書き写さない** —— 書き写すと、画面を戻しても緑になる */
import { SPEAK_LISTEN, SPEAK_STOP } from '../src/lib/speakLabel.js'
/** 1文ずつ鳴らすボタンかどうか。**頭で見る**(「全体を聞く」は頭が違うので混ざらない) */
const 聴くの形 = `^(${SPEAK_LISTEN}|${SPEAK_STOP})`
/* 本文(記事・会話)の演習。**一覧を書き写さない** ——
   種類を足した日に、ここだけ古い一覧が残らないようにする */
import { EXERCISE_TYPES } from '../src/data/exerciseTypes.js'

const PASSAGE_TYPES = EXERCISE_TYPES.filter((t) => t.isPassage).map((t) => t.id)
/* 「細かい指定」の欄の呼び名(第5.232節)。**書き写さない** */
import { kindLabel, subjectLabel } from '../src/data/materialKinds.js'
/* **余りの決まりは `fitRow.js` 1か所**(第5.316節)。**書き写さない** ——
   8 と書くと、値を変えた日に見張りだけが古くなる */
import { FIT_SLACK } from '../src/lib/fitRow.js'
/* **くり返しの4つは `wholeAudio.js` 1か所**。呼び名は `repeatLabel.js` */
import { REPEAT_UNITS } from '../src/lib/wholeAudio.js'
import { repeatLabel, repeatSay } from '../src/lib/repeatLabel.js'
/* **シャッフルの言い方も、あちらから受け取る**(第5.325節)。
   文字を書き写すと、言い方を変えた日に**見張りだけが古くなる** */
import { shuffleSay } from '../src/lib/shuffleSay.js'
/* ★ **札の数は、一覧から出す。書き写さない**(第5.414節・段階3) */
import {
  PICKS, SIZES, pickName, plainOrders, sizePickLabel,
} from '../src/lib/reviewScope.js'
/* ★ **カードを送る・判定する操作の境目は `cardMove.js` 1か所**(第5.417節)。
     **数を書き写さない** —— 44px / 56px を見張りに書くと、
     値を変えた日に期待値も一緒に動いて、仕組みを壊しても素通りする */
import {
  FLY_MS, KEY_MARK, TAP_MIN, keyLabel, keyMove,
} from '../src/lib/cardMove.js'
import { QUIZ_FORMS, WORD_ORDERS } from '../src/lib/wordQuiz.js'
/* **速さの段と端は `speechRate.js` 1か所** */
import { SPEECH_RATES } from '../src/lib/speechRate.js'
/* ★ **覚え具合の段は `learnStage.js` 1か所**(第5.406節)。
     **数を書き写さない** —— 4段階にした日に、見張りが「3つ出ていない」で
     赤くなった(仕組みは1ミリも壊れていないのに・CLAUDE.md) */
import { LEARN_STAGES, stageLabel } from '../src/lib/learnStage.js'

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
 * ・`全体を聞く` と操作盤 … 本文のページを開いているときだけ。
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
/* ★ **くり返しの言い方は、書き写さない**(2026-09-30・第5.320節)。
     **2度、ここで赤くなった。**
       ①「しない」の3文字を数えていた → **アイコン3つ**にした日に消えた
       ②「◯◯をくり返す」を3件数えていた → **ボタン1つ**に戻した日に消えた
     どちらも**見張りだけが古くなった**のであって、画面は正しかった。

     いまは `repeatSay()`(`repeatLabel.js`)から**そのまま**もらう ——
     範囲を足しても、言い方を変えても、**ひとりでに付いてくる。**
     開いた直後は「しない」なので、出るのは `REPEAT_UNITS[0]` のぶん1つ。
     **4つとも出てくることは、専用の節が押して確かめている。**
     単位は `countUnit()` が決めるが、骨組みの教材は会話なので「発言」 */
const くり返しの名 = [repeatSay(REPEAT_UNITS[0], '発言')]

const WANT = {
  'トレーナーが、ゲストと一緒に開いている': {
    q: '?role=trainer&who=g1',
    /* パソコン(1440px)。**「表示」は出ない** — 畳まないので札も要らない。

       ★ **「文字」「幅」「印刷」は帯から消えた**(2026-09-29 利用者の指定)。
         > 文字サイズ、幅、印刷/PDFボタンを設定ボタンを作って右上に
         > アイコンを置いてください
         3つは右上の「設定」の吹き出しの中にある(下の節で数えている)。

       ★ **`wholePlayText()` も帯には出ない。** 上の帯のプレーヤーは
         **絵だけ**になった(利用者の指定「『聴く』は必要なく、
         『▷』など、アイコンだけで作って」)。名前は `aria-label` に
         残っているので、そちらで数える(下の節)。 */
    wide: ['閉じる', '書き込む', 'メモ', ...くり返しの名, '速さ', '設定'],
    /* スマホ(390px)。**歯車の「表示」は廃止した**(2026-09-29 利用者の
       指定「ひとつにまとめます」)。道具(書き込む / メモ / 速さ)は
       「設定」の吹き出しの中へ移ったので、**帯には無い**(下の節が数える)。
       通しの読み上げは**画面の下の黒帯**なので、帯にはスイッチだけ */
    narrow: ['閉じる', '設定', '読み上げの操作を閉じる', '集中モード'],
    /* **帯から消えたことも数える。** 片方だけだと、戻しても緑のまま。
       **`wholePlayText()` はここに書かない** —— 絵だけになっても
       `aria-label` には残っている(残っていないと、何のボタンか分からない)。
       **見えているかどうか**は、下の「上の帯」の節が字で数えている */
    hasNot: ['文字', '幅', '印刷', '表示'],
    /* 狭い窓だけで「無い」もの。**広い窓では帯に並んでいる** ——
       だから `hasNot` には書けない(**出る側と出ない側の両方を見る**) */
    narrowHasNot: ['書き込む', 'メモ', '速さ'],
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
    wide: ['閉じる', '書き込む', 'メモ', ...くり返しの名, '速さ', '設定'],
    narrow: ['閉じる', '設定', '読み上げの操作を閉じる', '集中モード'],
    hasNot: ['文字', '幅', '印刷', '表示'],
    narrowHasNot: ['書き込む', 'メモ', '速さ'],
  },
  'ゲスト自身が開いている': {
    q: '?role=learner&who=g1',
    wide: ['閉じる', '書き込む', ...くり返しの名, '速さ', '設定'],
    narrow: ['閉じる', '設定', '読み上げの操作を閉じる', '集中モード'],
    // メモを書けるのは担当トレーナー(と管理者)だけ(0032)
    hasNot: ['メモ', '文字', '幅', '印刷', '表示'],
    narrowHasNot: ['書き込む', '速さ'],
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
  /* **畳む札(歯車の「表示」)は廃止した**(2026-09-29 利用者の指定)。
     狭い窓で帯に入りきらないものは「設定」の吹き出しへ移ったので、
     **帯そのものを数えれば足りる。** 吹き出しの中身は、別の節が数える */
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
    const 無いはず = [...want.hasNot, ...(where === 'スマホ' ? (want.narrowHasNot ?? []) : [])]
    const extra = 無いはず.filter((n) => got.some((g) => g === n))
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
  const listens = () => page.evaluate((re) =>
    [...document.querySelectorAll('.lesson-items button')]
      .filter((b) => new RegExp(re).test(b.textContent.trim())).length, 聴くの形)

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
    const inItem = (type) => page.evaluate(([t, re]) => {
      const li = document.querySelector(`[data-type="${t}"] .lesson-items > li`)
      if (!li) return null
      return [...li.querySelectorAll('button')]
        .filter((b) => new RegExp(re).test(b.textContent.trim())).length
    }, [type, 聴くの形])
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

    /* ★ **番号の丸と、地色のある箱が重なっていないか**(第5.397節・2026-10-06
         実機「問題の番号と問題が重なってしまってます」)。

       狭い画面では番号を `float` にしてある。**文字は横に回り込むが、
       地色と枠線を持つ箱は回り込まない** —— 左端から始まったままなので、
       丸がその上に乗る。**実測で 18px 重なっていた。**

       **狭い画面で測る**(広い画面では `float` ではないので、起きない)。
       **1つも拾えなかったら赤**にする(無ければ素通りを塞ぐ・CLAUDE.md)。 */
    await page.setViewportSize({ width: 393, height: 900 })
    await page.waitForTimeout(250)
    {
      const 重なり = await page.evaluate(() => {
        const 出 = []
        for (const li of document.querySelectorAll('.lesson-page:not(.is-closed) .lesson-items > li')) {
          const bf = window.getComputedStyle(li, '::before')
          /* **浮いていないときは、この決まりの相手ではない**(広い画面) */
          if (bf.float !== 'left') continue
          const lir = li.getBoundingClientRect()
          const 丸の右 = lir.left + parseFloat(window.getComputedStyle(li).paddingLeft)
            + parseFloat(bf.width)
          for (const box of li.children) {
            const c = window.getComputedStyle(box)
            /* **地色か左の線を持つ箱だけ**を見る(素の文字は回り込むので良い) */
            const 箱である = c.backgroundColor !== 'rgba(0, 0, 0, 0)'
              || parseFloat(c.borderLeftWidth) > 0
            if (!箱である) continue
            const br = box.getBoundingClientRect()
            if (br.width < 1) continue
            出.push({ 名: box.className || box.tagName, 差: Math.round(丸の右 - br.left) })
          }
        }
        return 出
      })
      const 悪い = 重なり.filter((x) => x.差 > 0)
      if (!重なり.length) {
        ng('番号の丸 … 浮かせた番号と箱の組を1つも拾えていない', '測っていないのと同じ')
      } else if (悪い.length) {
        ng('番号の丸が、地色のある箱に重なっている',
          悪い.map((x) => `${x.名} が ${x.差}px`).join(' / '))
      } else {
        ok(`番号の丸は、どの箱にも重なっていない(${重なり.length} 組・`
          + `いちばん近くて ${Math.abs(Math.max(...重なり.map((x) => x.差)))}px 空き)`)
      }
    }
    await page.setViewportSize({ width: 1500, height: 900 })
    await page.waitForTimeout(250)

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

/* ── **発言ごとの再生ボタンは、どの端末でも出す**(2026-09-29 利用者の指定)
 *
 *    > 記事やダイアローグ、会議の発言ごとの再生ボタンがなく非常に不便です。
 *    > やはり戻してください。
 *
 *    **一度は「出さない」を数えていた**(2026-09「段落ごとの listen も
 *    全てのデバイスで廃止にしましょう」)。記事は6段落・会話は14発言あるので
 *    同じものが並ぶ、というのが理由で、操作盤の送り戻しで代われると考えていた。
 *    **代われていなかった** —— n 番目まで行くのに n 回押すことになり、
 *    **読んでいるその発言を鳴らす**のがいちばん遠かった。
 *
 *    **この節は「出す」側を数える形に書き直した。** 幅を変えて、
 *    どの端末でも出ていることを見る(狭い画面だけ消す作りに戻すと赤くなる)。
 */
{
  const page = await browser.newPage({ viewport: { width: 1500, height: 900 } })
  await page.goto(`http://localhost:${PORT}/__bar.html?role=trainer&who=g1`,
    { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  console.log('\n── 発言ごとの再生ボタンは、どの端末でも出す ──')
  for (const w of [1500, 1200, 900, 390]) {
    await page.setViewportSize({ width: w, height: 900 })
    await page.waitForTimeout(300)
    const m = await page.evaluate(([passage, re]) => ({
      /* 本文の各発言に付くもの。**言葉で数える**
         (Listen / Stop のどちらの形でも拾う)。

         **本文の演習の中だけを数える**(2026-09・第5.230節)。
         `.lesson-items button` を画面ぜんぶから拾うと、レッスン表示は
         **開いていないページも描いてある**(紙のため)ので、
         語句や単語の演習を1つ足しただけで数が動く。
         種類の一覧は `exerciseTypes.js` 1か所から渡している */
      段落: passage.flatMap((t) =>
        [...document.querySelectorAll(`.lesson-page[data-type="${t}"] .lesson-items button`)])
        .filter((b) => new RegExp(re).test(b.textContent.trim())).length,
      /* **鳴らすものがある発言の数**(= 出るはずの数)。
         解答を開く「訳を見る」しか無い発言は数えない */
      発言: passage.flatMap((t) =>
        [...document.querySelectorAll(`.lesson-page[data-type="${t}"] .lesson-items > li`)])
        .filter((li) => li.querySelector('.lesson-acts')).length,
      /* **通しの読み上げは残す。** 上の「全体を聞く」と操作盤は別物 */
      全体: !!document.querySelector('.lesson-listen'),
      操作盤: !!document.querySelector('.player'),
    }), [PASSAGE_TYPES, 聴くの形])
    /* **「鳴らすものがある発言」の数だけ出る。** 数を書き写さない ——
       骨組みの発言を1つ足した日に、期待値も一緒に動く */
    if (!m.段落) {
      ng(`${w}px … 発言ごとの再生ボタンが1つも出ていない`,
        '記事・会話・会議のどれにも付ける(2026-09-29 利用者の指定で戻した)')
    } else if (m.段落 < m.発言) {
      ng(`${w}px … 発言ごとの再生ボタンが ${m.段落} / ${m.発言} 個しか出ていない`,
        '鳴らすものがある発言には、全部付ける')
    } else if (!m.全体) ng(`${w}px … 「${wholePlayText()}」まで消えている`)
    else if (!m.操作盤) ng(`${w}px … 操作盤が出ていない`, '鳴らす道が無くなる')
    else ok(`${w}px … 発言ごと ${m.段落} 個・通しと操作盤も残っている`)
  }
  await page.close()
}

/* ══════════════════════════════════════════════════════════════════
   ── **上の帯は、どの端末でも1段。黒帯は本文を隠さない**(第5.316節)
        2026-09-30 実機・利用者の指定(Safari と Chrome の写真を並べて)

          > Chromeでは上部の操作ボタンが1列に収まっていますが、
          > Safariでは設定アイコンだけが次の段に落ち…
          > 特定のブラウザーだけを場当たり的に小さくするのではなく…

        **原因はブラウザの中身の違いではない**(iOS はどちらも WebKit)。
        2枚の写真を測ると、同じ端末で Safari のほうが **1.13 倍**大きく
        描かれていた(白い丸 161px 対 142px)。つまり
        **Safari の CSS 上の画面幅が狭い**(393px に対しおよそ 345px)——
        ページのズームが 100% でないと、iOS はそのぶん幅を狭くする。

        こちらから直せるのは**幅が狭くても崩れないこと**である。だから
        ①どの幅でも1段 ②**余りを必ず残す**(`FIT_SLACK`)の2つを見る。
        **余りが 0 の行は、字形の違う端末で必ず折り返す** ——
        実際、直す前は 300〜430px のどこで測っても余りが **0px** だった。
   ══════════════════════════════════════════════════════════════════ */
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await page.goto(`http://localhost:${PORT}/__bar.html?role=trainer&who=g1`,
    { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  console.log('\n── 上の帯は、どの端末でも1段(第5.316節)──')
  /* **名札は隠して測る。** 利用者の写真に名札は出ていない
     (名札はもともと2段目へ落ちてよい・第5.178節)。
     隠すのは測るあいだだけで、本物の CSS は1行も変えていない */
  await page.addStyleTag({ content: '.lesson-owner { display: none !important }' })
  await page.waitForTimeout(150)
  for (const [w, big] of [
    [290, false], [300, false], [314, false], [320, false], [345, false],
    [360, false], [375, false], [390, false], [430, false],
    /* **端末の「表示を大きく」も模す。** 幅が同じでも入るかどうかは変わる */
    [375, true], [390, true], [430, true],
  ]) {
    await page.setViewportSize({ width: w, height: 844 })
    await page.evaluate((on) => {
      document.getElementById('eas-bigbar')?.remove()
      if (!on) return
      const st = document.createElement('style')
      st.id = 'eas-bigbar'
      st.textContent = '.lesson-bar .btn, .lesson-bar .lesson-pages,'
        + ' .lesson-bar .stepper { font-size: 16px !important }'
      document.head.appendChild(st)
    }, big)
    await page.evaluate(() => window.dispatchEvent(new Event('resize')))
    await page.waitForTimeout(220)
    const m = await page.evaluate((slack) => {
      const bar = document.querySelector('.lesson-bar')
      const main = document.querySelector('.lesson-bar-main')
      const sets = document.querySelector('.lesson-settings')
      if (!bar || !main || !sets) return null
      const 段 = (el) => Math.round(el.getBoundingClientRect().top)
      /* **余りは「測る形」にしてから見る。** ふだんは `margin-left: auto` で
         設定が右端に貼り付くので、どの幅でも 0 に見えてしまう
         (`fitRow.js` の `overWrapping` とまったく同じ形にする) */
      bar.classList.add('is-measuring-row')
      const cs = window.getComputedStyle(bar)
      const edge = bar.getBoundingClientRect().right - (parseFloat(cs.paddingRight) || 0)
      let 右 = -Infinity
      for (const k of bar.children) {
        const r = k.getBoundingClientRect()
        if (!r.width && !r.height) continue
        if (r.right > 右) 右 = r.right
      }
      bar.classList.remove('is-measuring-row')
      /* **絵だけのボタンは、全部おなじ大きさか**(2026-09-30 利用者の指定
           > 既存のアイコンセットを使って、他のボタンと大きさ・線・余白を
           > 揃えてください
         一覧は**画面に出ている絵だけのボタン**から作る —— 名指しで並べると、
         足した日に見張られなくなる */
      const 絵だけ = [...bar.querySelectorAll(
        '.lesson-pages .btn, .player-launch, .lesson-focus, .lesson-sets')]
        .filter((b) => b.getBoundingClientRect().width > 0)
        .map((b) => {
          const r = b.getBoundingClientRect()
          return { 名: b.getAttribute('aria-label') || b.className, w: Math.round(r.width), h: Math.round(r.height) }
        })
      return {
        段の数: new Set([...bar.children]
          .filter((c) => c.getBoundingClientRect().width > 0).map(段)).size,
        設定が1段目: 段(sets) === 段(main),
        余り: Math.round(edge - 右),
        要る余り: slack,
        絵だけ,
        帯の高さ: Math.round(bar.getBoundingClientRect().height),
      }
    }, FIT_SLACK)
    const 印 = big ? `${w}px(文字 1.25 倍)` : `${w}px`
    if (!m) { ng(`${印} … 上の帯が出ていない`); continue }
    if (!m.設定が1段目) {
      ng(`${印} … 設定の絵だけが、次の段に落ちている`,
        `帯が ${m.段の数} 段・高さ ${m.帯の高さ}px`)
    } else if (m.余り < m.要る余り) {
      ng(`${印} … 上の帯の余りが足りない`,
        `${m.余り}px しか無い(${m.要る余り}px 要る)。`
        + '**余りが 0 の行は、字形の違う端末で折り返す**')
    } else if (!m.絵だけ.length) {
      ng(`${印} … 絵だけのボタンが1つも見つからない`, '見張りが何もしていない')
    } else if (new Set(m.絵だけ.map((b) => `${b.w}x${b.h}`)).size !== 1) {
      ng(`${印} … 絵だけのボタンの大きさがそろっていない`,
        m.絵だけ.map((b) => `${b.名} ${b.w}x${b.h}`).join(' / '))
    } else {
      ok(`${印} … 1段・余り ${m.余り}px・絵だけのボタン ${m.絵だけ.length} 個が`
        + `ぜんぶ ${m.絵だけ[0].w}x${m.絵だけ[0].h}px`)
    }
  }
  await page.evaluate(() => document.getElementById('eas-bigbar')?.remove())

  /* ── **黒帯は、本文を隠さない**(2026-09-30 利用者の指定)
         > プレーヤーが本文に重ならないよう、スクロール領域にも
         > 必要な余白を確保してください

       もとは紙の下余白が **72px の決め打ち**で、黒帯は **118px** あった。
       **46px ぶん、本文の最後が隠れていた。**
       いまは `dockHeight.js` が黒帯を測って `--dock-h` に入れ、
       紙の余白はそれを読む(**数を2か所に書かない**)。 */
  console.log('\n── 黒帯は、本文を隠さない(第5.316節)──')
  for (const w of [320, 375, 390, 430]) {
    await page.setViewportSize({ width: w, height: 844 })
    await page.waitForTimeout(250)
    const m = await page.evaluate(() => {
      const dock = document.querySelector('.player-dock')
      const sheet = document.querySelector('.lesson-sheet')
      if (!dock || !sheet) return null
      const 高さ = Math.round(dock.getBoundingClientRect().height)
      const v = window.getComputedStyle(document.documentElement)
        .getPropertyValue('--dock-h').trim()
      return {
        黒帯: 高さ,
        変数: Math.round(parseFloat(v) || 0),
        紙の下余白: Math.round(parseFloat(window.getComputedStyle(sheet).paddingBottom) || 0),
      }
    })
    if (!m) { ng(`${w}px … 黒帯か紙が出ていない`); continue }
    if (!m.変数) {
      ng(`${w}px … --dock-h が入っていない`, '紙の余白が控えの数のままになる')
    } else if (Math.abs(m.変数 - m.黒帯) > 1) {
      ng(`${w}px … --dock-h が黒帯の高さと合っていない`,
        `変数 ${m.変数}px / 実寸 ${m.黒帯}px`)
    } else if (m.紙の下余白 <= m.黒帯) {
      ng(`${w}px … 紙の下余白が、黒帯より狭い`,
        `余白 ${m.紙の下余白}px ≤ 黒帯 ${m.黒帯}px。いちばん下の段落が隠れる`)
    } else {
      ok(`${w}px … 黒帯 ${m.黒帯}px・紙の下余白 ${m.紙の下余白}px(隠れない)`)
    }
  }

  /* ── **くり返しはボタン1つ。押すたびに4つを回る**
         (2026-09-30 利用者の指定・第5.320節)
         > 3つ並んだリピートのマークをひとつにして、
         > 押すたびに切り替わるようにできませんか?
         > 普通の再生の時はグレーアウトさせるか

       **一度は3つ並べた**(第5.318節)。帯の幅を 110px 使い、
       集中モードの帯であふれたので、**1つに戻した。**
       「しない」は**線を描かない + うすく**(利用者が選んだ案A)。

       **一覧は `REPEAT_UNITS` から**(書き写さない)。 */
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(250)
  {
    const 数 = await page.$$eval('.player--dock .repeat-key', (xs) => xs.length)
    const 文字 = await page.evaluate(() => {
      const b = document.querySelector('.player--dock .repeat-key')
      return b ? (b.textContent || '').trim() : null
    })
    if (数 !== 1) {
      ng(`くり返し … ボタンが ${数} 個(1つのはず)`, '押すたびに回る形にした(第5.320節)')
    } else if (文字) {
      ng('くり返し … 文字が残っている', `「${文字}」。**アイコン中心にする**指定である`)
    } else {
      /* **ひと回りするか。** 見るのは ①名前(`aria-label`)②押している印
         ③**絵そのもの**(「しない」は線が無い) */
      const 見た = []
      for (let i = 0; i <= REPEAT_UNITS.length; i += 1) {
        const m = await page.evaluate(() => {
          const b = document.querySelector('.player--dock .repeat-key')
          if (!b) return null
          const cs = window.getComputedStyle(b)
          return {
            名: b.getAttribute('aria-label') || '',
            押している: b.getAttribute('aria-pressed') === 'true',
            /* ★ **回す範囲は「点の数」**(2026-10-08 利用者がえらんだ案3・
                 第5.419節)。長さを測るのをやめた ——
                 **ボタン1つでは、長さを比べる相手がいない。**
                 「しない」は点が1つも無い */
            点: b.querySelectorAll('svg circle').length,
            うすい: Math.round((parseFloat(cs.opacity) || 1) * 100),
          }
        })
        if (!m) break
        見た.push(m)
        await page.click('.player--dock .repeat-key')
        await page.waitForTimeout(120)
      }
      const 名 = REPEAT_UNITS.map((id) => repeatLabel(id, '発言'))
      const 足りない = 名.filter((n) => !見た.some((v) => v.名.includes(`いまは ${n}`)))
      const しない = 見た.find((v) => v.名.includes(`いまは ${repeatLabel('off', '発言')}`))
      const 回す = 見た.filter((v) => v.押している)
      if (足りない.length) {
        ng(`くり返し … ${足りない.join(' / ')} が選べない`, `見えたのは ${見た.length} 通り`)
      } else if (見た[0]?.名 !== 見た[REPEAT_UNITS.length]?.名) {
        ng('くり返し … ひと回りして元に戻らない',
          `${見た[0]?.名} → ${見た[REPEAT_UNITS.length]?.名}`)
      } else if (!しない || しない.押している) {
        ng('くり返し … 「しない」が押している印のままになっている')
      } else if (しない.点 !== 0) {
        ng('くり返し … 「しない」なのに、回す範囲の点が描いてある',
          `${しない.点} つ。**点が無いことでも分かる**(色だけに頼らない)`)
      } else if (しない.うすい >= 90) {
        ng('くり返し … 「しない」がうすくなっていない', `${しない.うすい}%`)
      } else if (回す.some((v) => v.点 === 0)) {
        ng('くり返し … くり返す範囲なのに、点が1つも描かれていない')
      } else if (回す.length !== REPEAT_UNITS.length - 1) {
        ng(`くり返し … 押している印が ${回す.length} 通り`,
          `くり返す範囲は ${REPEAT_UNITS.length - 1} 通りある`)
      } else if (new Set(回す.map((v) => v.点)).size !== 回す.length) {
        ng('くり返し … 範囲が見分けられない',
          `点の数が ${回す.map((v) => v.点).join(' / ')} で、同じものがある`)
      } else if (回す.some((v, i) => i > 0 && v.点 <= 回す[i - 1].点)) {
        /* ★ **狭い順に増える**(文 → 段落 → 全文)。数そのものは書かない ——
             回る順(`REPEAT_UNITS`)のまま、**増えているか**だけを見る。
             逆に並べても「ぜんぶ違う」だけなら緑になってしまう */
        ng('くり返し … 範囲が広がる向きに、点が増えていない',
          `${回す.map((v) => `${v.点}`).join(' → ')}(狭い順に増えるはず)`)
      } else {
        ok(`くり返し … ボタン1つで ${名.join(' → ')} と回る。`
          + `「しない」は点なし・${しない.うすい}% のうすさ。`
          + `範囲は点の数 ${回す.map((v) => v.点).join(' / ')} で見分ける`)
      }
    }
  }

  /* ── **速さは「いま何%か」だけ。押すと右上の設定が開く**
         (2026-09-30 利用者の指定・第5.318節)
         > プレーヤー上には現在の速度だけを、枠のないシンプルな表示で
         > 速度表示をタップすると、画面右上にある既存の設定パネルを開き
         > プレーヤー上に速度変更用の矢印や枠付きボタンは置かないでください
         > 設定パネル内では、速度を70%から130%まで5%刻みで変更できる仕様を維持

       **出ると出ないの両方を見る。** 黒帯から欄を外した以上、
       「どこにも無い」と見分けられなければ、この見張りは何も守らない。 */
  {
    /* ①黒帯にあるのは「表示」だけ。**枠も三角も無い** */
    const m = await page.evaluate(() => {
      const el = document.querySelector('.player--dock .player-rate-now')
      if (!el) return null
      const cs = window.getComputedStyle(el)
      return {
        字: (el.textContent || '').trim(),
        枠: Math.round(parseFloat(cs.borderTopWidth) || 0)
          + Math.round(parseFloat(cs.borderLeftWidth) || 0),
        地色: cs.backgroundColor,
        三角: document.querySelectorAll('.player--dock .stepper-arrow').length,
        欄: document.querySelectorAll('.player--dock .stepper').length,
      }
    })
    if (!m) ng('速さ … 黒帯に「いまの速さ」が出ていない')
    else if (m.欄 || m.三角) {
      ng('速さ … 黒帯に、速さを変える欄が戻っている', `欄 ${m.欄} / 三角 ${m.三角}`)
    } else if (m.枠 > 0) {
      ng('速さ … 黒帯の速さに枠が付いている', `${m.枠}px。**枠のないシンプルな表示**にする`)
    } else if (!/^\d+%$/.test(m.字)) {
      ng('速さ … 黒帯の速さが「◯◯%」の形で出ていない', `「${m.字}」`)
    } else {
      /* ②押すと右上の設定が開き、**速さに焦点が当たる** */
      await page.click('.player--dock .player-rate-now')
      await page.waitForTimeout(350)
      const 欄 = '[role="group"][aria-label^="速さ"]'
      const 開いた = await page.evaluate((sel) => {
        const g = document.querySelector(sel)
        if (!g) return { 無い: true }
        return { 焦点: g.contains(document.activeElement) }
      }, 欄)
      if (開いた.無い) {
        ng('速さ … 黒帯の速さを押しても、設定の中に速さが出ない',
          '黒帯から外したのに、上にも無ければ「どこにも無い」')
      } else if (!開いた.焦点) {
        ng('速さ … 設定は開いたが、速さに焦点が当たっていない',
          '**見つけやすいようにする**(利用者の指定)')
      } else {
        /* ③その場で 70〜130% を端まで動かす */
        for (let i = 0; i < SPEECH_RATES.length + 2; i += 1) {
          const done = await page.evaluate((sel) => {
            const a2 = document.querySelector(`${sel} .stepper-arrow`)
            if (!a2 || a2.disabled) return true
            a2.click(); return false
          }, 欄)
          if (done) break
          await page.waitForTimeout(40)
        }
        const 下 = await page.evaluate((sel) => ({
          値: document.querySelector(`${sel} .stepper-now`)?.textContent?.trim(),
          止まる: document.querySelector(`${sel} .stepper-arrow`)?.disabled,
        }), 欄)
        for (let i = 0; i < SPEECH_RATES.length + 2; i += 1) {
          const done = await page.evaluate((sel) => {
            const a2 = [...document.querySelectorAll(`${sel} .stepper-arrow`)][1]
            if (!a2 || a2.disabled) return true
            a2.click(); return false
          }, 欄)
          if (done) break
          await page.waitForTimeout(40)
        }
        const 上 = await page.evaluate((sel) => ({
          値: document.querySelector(`${sel} .stepper-now`)?.textContent?.trim(),
          止まる: [...document.querySelectorAll(`${sel} .stepper-arrow`)][1]?.disabled,
        }), 欄)
        const 最小 = SPEECH_RATES[0].label
        const 最大 = SPEECH_RATES[SPEECH_RATES.length - 1].label
        if (下.値 !== 最小) ng(`速さ … いちばん下まで下げても ${最小} にならない`, `${下.値}`)
        else if (!下.止まる) ng(`速さ … ${最小} なのに、まだ下げられる`)
        else if (上.値 !== 最大) ng(`速さ … いちばん上まで上げても ${最大} にならない`, `${上.値}`)
        else if (!上.止まる) ng(`速さ … ${最大} なのに、まだ上げられる`)
        else {
          ok(`速さ … 黒帯は「${m.字}」の表示だけ(枠なし)。押すと右上の設定が開いて`
            + `焦点が当たり、${最小} 〜 ${最大}(${SPEECH_RATES.length} 段)で端から外へ出ない`)
        }
      }
      /* **元に戻す。** 速さは端末に覚えさせるので、130% のままにすると
         あとの節が別の速さで測る。**閉じるのは Esc**(狭い窓では
         後ろの覆いが設定のボタンを隠す・第5.316節で実測) */
      await page.evaluate(() => {
        try { window.localStorage.removeItem('eas.speechRate') } catch { /* 使えなくても困らない */ }
      })
      await page.keyboard.press('Escape')
      await page.waitForTimeout(200)
    }
  }

  /* ── **黒帯は、端で窮屈にならない。押す行はまん中で左右対称**
         (2026-09-30 実機・利用者の指定・第5.318節)
         > 段落番号の表示とリピート操作が画面端に近すぎます。
         > 左右に十分なパディングを設け、端で窮屈に見えないように
         > 再生ボタンを中心に、…左右対称に見えるよう整えてください
         > 操作ボタンを画面幅いっぱいに広げるのではなく、操作群を中央にまとめ */
  for (const w of [375, 390, 430]) {
    await page.setViewportSize({ width: w, height: 844 })
    await page.waitForTimeout(280)
    const m = await page.evaluate(() => {
      const dock = document.querySelector('.player-dock')
      const keys = document.querySelector('.player--dock .player-keys')
      const big = document.querySelector('.player--dock .player-big')
      const head = document.querySelector('.player-head')
      if (!dock || !keys || !big || !head) return null
      const cs = window.getComputedStyle(dock)
      const kr = keys.getBoundingClientRect()
      const brr = big.getBoundingClientRect()
      const kids = [...keys.children].map((c) => c.getBoundingClientRect())
      const 隙間 = []
      for (let i = 1; i < kids.length; i += 1) 隙間.push(Math.round(kids[i].left - kids[i - 1].right))
      /* 上の段のいちばん左と、いちばん右 */
      const hs = [...head.children].filter((c) => c.getBoundingClientRect().width > 0)
        .map((c) => c.getBoundingClientRect())
      return {
        左余白: Math.round(parseFloat(cs.paddingLeft) || 0),
        右余白: Math.round(parseFloat(cs.paddingRight) || 0),
        上段の左: hs.length ? Math.round(hs[0].left) : null,
        上段の右: hs.length ? Math.round(window.innerWidth - hs[hs.length - 1].right) : null,
        丸の中心: Math.round((brr.left + brr.right) / 2),
        窓の中心: Math.round(window.innerWidth / 2),
        押す行の左: Math.round(kr.left),
        押す行の右: Math.round(window.innerWidth - kr.right),
        押す行の幅: Math.round(kr.width),
        数: kids.length,
        隙間,
      }
    })
    if (!m) { ng(`黒帯 ${w}px … 黒帯が出ていない`); continue }
    /* **余白の下限は、押せる大きさの 1/3。** 数を書き写さず、
       いちばん狭い押すもの(34px)から決める —— 端に貼り付いて見えない広さ */
    const 要る余白 = 12
    if (m.左余白 < 要る余白 || m.右余白 < 要る余白) {
      ng(`黒帯 ${w}px … 左右の余白が足りない`,
        `左 ${m.左余白} / 右 ${m.右余白}px(${要る余白}px 以上)。端で窮屈に見える`)
    } else if (m.上段の左 < 要る余白 || m.上段の右 < 要る余白) {
      ng(`黒帯 ${w}px … 段落番号かくり返しが、画面の端に近すぎる`,
        `左 ${m.上段の左} / 右 ${m.上段の右}px`)
    } else if (Math.abs(m.丸の中心 - m.窓の中心) > 1) {
      ng(`黒帯 ${w}px … 鳴らすボタンが画面のまん中にいない`,
        `丸 ${m.丸の中心} / まん中 ${m.窓の中心}`)
    } else if (Math.abs(m.押す行の左 - m.押す行の右) > 1) {
      ng(`黒帯 ${w}px … 押す行の左右の余りがそろっていない`,
        `左 ${m.押す行の左} / 右 ${m.押す行の右}px`)
    } else if (m.押す行の左 <= m.左余白) {
      /* ★ **黒帯の余白と同じでは、「中央にまとめた」ことにならない。**
           はじめ「余りが 8px 以上か」で見ていたが、`max-width` を外しても
           黒帯の余白(16px)がそのまま残るので**赤くならなかった**(実測)。
           **押す行は、黒帯の内側よりさらに内へ**入っていなければならない */
      ng(`黒帯 ${w}px … 押す行が黒帯の内側いっぱいに広がっている`,
        `押す行の余り ${m.押す行の左}px ≤ 黒帯の余白 ${m.左余白}px。`
        + '**操作群は中央にまとめ、左右にも均等な余白を残す**(利用者の指定)')
    } else if (m.数 !== 5 || new Set(m.隙間).size !== 1) {
      ng(`黒帯 ${w}px … 送り戻しの隙間がそろっていない`,
        `${m.数} 個・隙間 ${m.隙間.join(' / ')}px`)
    } else {
      ok(`黒帯 ${w}px … 余白 左右 ${m.左余白}px・押す行は幅 ${m.押す行の幅}px で`
        + `まん中(左右の余り ${m.押す行の左}px)・5つの隙間はぜんぶ ${m.隙間[0]}px`)
    }
  }

  await page.close()
}

/* ── **セーフエリア。** iPhone のホームバーにボタンが重ならない
       (2026-09-30 利用者の指定「iPhoneのセーフエリアに対応してください」)。
     **描いて測れない**(この環境にセーフエリアが無い)ので、
     `env(safe-area-inset-bottom)` を読んでいるかを、決まりの字で見る。 */
{
  const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8')
  const 決まり = css.slice(css.indexOf('.player-dock {'), css.indexOf('.player-dock {') + 700)
  if (!/padding-bottom:\s*max\([^)]*env\(safe-area-inset-bottom\)/.test(決まり)) {
    ng('黒帯 … セーフエリアを読んでいない',
      'iPhone のホームバーに、鳴らすボタンが重なる')
  } else ok('黒帯 … セーフエリアのぶんだけ、下に余白を取っている')
}


/* ══════════════════════════════════════════════════════════════════
   ── **設定のシートは、用途ごとに分かれている**(第5.319節)
        2026-09-30 実機・利用者の指定。

        > 「書き込む」「メモ」「速さ」の操作が1列に詰め込まれ、
        > 文字サイズ調整も横に間延びしていて、
        > 設定項目同士のまとまりが分かりにくく見えます
        > 上部にドラッグ用ハンドル、タイトル「設定」、閉じるボタンを
        > まとめたヘッダーを設けてください
        > 現在のように、複数の異なる操作を一つの横長のカプセルに
        > 詰め込まないでください

      **375 / 390 / 430px で、実際に開いて測る。**
      **画面が低いときも見る** —— シートが画面を占めすぎないか、
      中が長ければ送れるかは、**高さでしか出てこない**
      (「無ければ素通り」する形の検証を書かない・CLAUDE.md)。
   ══════════════════════════════════════════════════════════════════ */
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await page.goto(`http://localhost:${PORT}/__bar.html?role=trainer&who=g1`,
    { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  console.log('\n── 設定のシート(用途ごとに分ける・第5.319節) ──')
  for (const [w, h] of [[375, 844], [390, 844], [430, 844], [390, 520]]) {
    await page.setViewportSize({ width: w, height: h })
    await page.waitForTimeout(280)
    await page.click('.lesson-sets')
    await page.waitForTimeout(350)
    const m = await page.evaluate(() => {
      const sheet = document.querySelector('.sheet')
      if (!sheet) return null
      const body = sheet.querySelector('.sheet-body')
      const R = (el) => el.getBoundingClientRect()
      const 見えている = (el) => { const r = R(el); return r.width > 0 && r.height > 0 }
      const 群 = [...sheet.querySelectorAll('.setgroup')].filter(見えている)
      const 対 = [...sheet.querySelectorAll('.setpair .btn')].filter(見えている)
      const 行 = [...sheet.querySelectorAll('.setrow')].filter(見えている)
      const 足 = sheet.querySelector('.setfoot .btn')
      /* **押せる大きさ。** 一覧を持たず、**シートの中の押すものを全部**拾う */
      const 押す = [...sheet.querySelectorAll('.setpair .btn, .setrow .stepper-arrow, .setfoot .btn')]
        .filter(見えている).map((b) => Math.round(R(b).height))
      return {
        つまみ: !!sheet.querySelector('.sheet-grip'),
        見出し: sheet.querySelector('.sheet-title')?.textContent?.trim() ?? '',
        閉じる: !!sheet.querySelector('.sheet-head .nav-icon-btn'),
        群の数: 群.length,
        群の見出し: 群.map((g) => g.querySelector('.setgroup-title')?.textContent?.trim() ?? ''),
        /* **境目の線。** 2つめの群と、印刷の上に引く */
        線: 群.slice(1).concat(足 ? [足.parentElement] : [])
          .map((g) => Math.round(parseFloat(window.getComputedStyle(g).borderTopWidth) || 0)),
        対の幅: 対.map((b) => Math.round(R(b).width)),
        対の高さ: 対.map((b) => Math.round(R(b).height)),
        /* **いまの値の左端。** 行をまたいでそろっていること */
        値の左: 行.map((r) => {
          const n = r.querySelector('.stepper-now')
          return n ? Math.round(R(n).left) : null
        }),
        行の名: 行.map((r) => r.querySelector('.stepper-label')?.textContent?.trim() ?? ''),
        印刷の幅: 足 ? Math.round(R(足).width) : null,
        群の幅: 群.length ? Math.round(R(群[0]).width) : null,
        押せる大きさ: 押す.length ? Math.min(...押す) : null,
        シートの高さ: Math.round(R(sheet).height),
        窓の高さ: window.innerHeight,
        送れる: body ? Math.round(body.scrollHeight) > Math.round(body.clientHeight) + 1 : null,
        あふれ: Math.round(R(sheet).bottom) - window.innerHeight,
      }
    })
    const 印 = `${w}×${h}`
    if (!m) { ng(`設定のシート ${印} … 開かない`); continue }
    if (!m.つまみ || m.見出し !== '設定' || !m.閉じる) {
      ng(`設定のシート ${印} … 頭にそろっていない`,
        `つまみ ${m.つまみ} / 見出し「${m.見出し}」/ 閉じる ${m.閉じる}`)
    } else if (m.群の数 < 2) {
      ng(`設定のシート ${印} … まとまりが ${m.群の数} つしかない`,
        '**用途別にグループ化する**(学習ツール / 表示)')
    } else if (m.群の見出し.some((t) => !t)) {
      ng(`設定のシート ${印} … 見出しの無いまとまりがある`, m.群の見出し.join(' / '))
    } else if (m.線.some((v) => v < 1)) {
      ng(`設定のシート ${印} … まとまりの境目に線が無い`, `${m.線.join(' / ')}px`)
    } else if (new Set(m.対の幅).size !== 1 || new Set(m.対の高さ).size !== 1) {
      ng(`設定のシート ${印} … 書き込む / メモの大きさがそろっていない`,
        `幅 ${m.対の幅.join(' / ')} / 高さ ${m.対の高さ.join(' / ')}`)
    } else if (m.値の左.some((v) => v == null) || new Set(m.値の左).size !== 1) {
      ng(`設定のシート ${印} … 設定の行で、いまの値の位置がそろっていない`,
        `${m.行の名.join(' / ')} → ${m.値の左.join(' / ')}px`)
    } else if (m.印刷の幅 !== m.群の幅) {
      ng(`設定のシート ${印} … 印刷が幅いっぱいでない`,
        `印刷 ${m.印刷の幅}px / まとまり ${m.群の幅}px`)
    } else if (m.押せる大きさ < 40) {
      ng(`設定のシート ${印} … 押せる大きさが足りない`,
        `いちばん低いもので ${m.押せる大きさ}px(40px 以上)`)
    } else if (m.あふれ > 1) {
      ng(`設定のシート ${印} … シートが画面からはみ出している`, `${m.あふれ}px`)
    } else if (m.シートの高さ > m.窓の高さ * 0.9) {
      ng(`設定のシート ${印} … シートが画面を占めすぎている`,
        `${m.シートの高さ} / ${m.窓の高さ}px`)
    } else {
      ok(`設定のシート ${印} … 頭(つまみ・設定・✕)+ ${m.群の数} まとまり`
        + `(${m.群の見出し.join(' / ')})・書き込む/メモは ${m.対の幅[0]}×${m.対の高さ[0]}px・`
        + `値の左は ${m.値の左[0]}px でそろう・印刷は幅いっぱい ${m.印刷の幅}px・`
        + `高さ ${m.シートの高さ}/${m.窓の高さ}px${m.送れる ? '(中だけ送れる)' : ''}`)
    }
    /* **閉じるのは Esc**(狭い窓では後ろの覆いがボタンを隠す・第5.316節) */
    await page.keyboard.press('Escape')
    await page.waitForTimeout(220)
  }

  /* ── **紙の幅は、狭い画面では行ごと出さない**(効かない操作を見せない)。
         **中の `Stepper` だけ隠すと、空の行が残る。**
         ここは1度、`.setrow { display: flex }` に負けて出たままだった
         (打ち消しは、いちばん後ろに置く・CLAUDE.md) */
  for (const [w, 出るはず] of [[390, false], [1440, true]]) {
    await page.setViewportSize({ width: w, height: 900 })
    await page.waitForTimeout(280)
    await page.click('.lesson-sets')
    await page.waitForTimeout(350)
    const m = await page.evaluate(() => {
      const el = document.querySelector('.lesson-widths')
      if (!el) return { 無い: true }
      const r = el.getBoundingClientRect()
      return { 見える: r.width > 0 && r.height > 0 }
    })
    if (m.無い) ng(`紙の幅 ${w}px … 行そのものが無い`)
    else if (m.見える !== 出るはず) {
      ng(`紙の幅 ${w}px … ${出るはず ? '出ていない' : '出ている'}`,
        出るはず ? '広い画面では選べる' : '狭い画面では紙を広げる余地が無い(効かない操作を見せない)')
    } else ok(`紙の幅 ${w}px … ${出るはず ? '出る' : '行ごと出ない'}`)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)
  }
  await page.close()
}

/* ── **シートは、端末の下の切り欠きを避ける**(2026-09-30 利用者の指定)
       > iPhoneのセーフエリアに対応させ、ホームインジケーターの背後に
       > ボタンが入り込まないようにしてください
     **描いて測れない**(この環境にセーフエリアが無い)ので、決まりの字で見る */
{
  const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8')
  const i = css.indexOf('.sheet {')
  const 決まり = css.slice(i, i + 600)
  if (!/padding-bottom:\s*env\(safe-area-inset-bottom\)/.test(決まり)) {
    ng('設定のシート … セーフエリアを読んでいない',
      'iPhone のホームバーに、いちばん下のボタンが隠れる')
  } else ok('設定のシート … セーフエリアのぶんだけ、下に余白を取っている')
}

/* ── **一度決める設定は、右上のアイコン1つの中**(2026-09-29 利用者の指定)──
 *
 *    > 文字サイズ、幅、印刷/PDFボタンを設定ボタンを作って右上にアイコンを
 *    > 置いてください。三本線と丸の組み合わせのアイコンにしてください
 *    > そして、上部のバーのボタンは「聴く」は必要なく、「▷」など、
 *    > アイコンだけで作って、下部に置くものと同じにしてください
 *
 *    3つを帯に出しっぱなしにしていたので、**パソコンでも帯が2段**に
 *    折り返していた(実機の写真)。**出す / 出さないの両方を見る** ——
 *    帯から消えたことは上の `WANT.hasNot` が、
 *    **吹き出しの中に在ること**をここが見る。片方だけだと、
 *    「どこにも無い」形に書き換えても緑のままになる。
 */
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.goto(`http://localhost:${PORT}/__bar.html?role=trainer&who=g1`,
    { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  console.log('\n── 一度決める設定(右上のアイコン) ──')

  for (const w of [1440, 390]) {
    await page.setViewportSize({ width: w, height: 900 })
    await page.waitForTimeout(350)
    /* **畳む札は廃止した。** 「設定」は、どの幅でも帯にそのまま出ている */
    const 札 = await page.$('.lesson-sets')
    if (!札 || !await 札.isVisible()) { ng(`設定 ${w}px … 設定のアイコンが出ていない`); continue }
    /* **絵だけ**(言葉を添えない)。押せる大きさは割らない */
    const m = await page.evaluate(() => {
      const b = document.querySelector('.lesson-sets')
      const r = b.getBoundingClientRect()
      return {
        字: (b.textContent || '').trim(),
        名: b.getAttribute('aria-label') ?? '',
        絵: b.querySelectorAll('svg').length,
        大きさ: `${Math.round(r.width)}x${Math.round(r.height)}`,
        高さ: Math.round(r.height),
      }
    })
    if (m.字) ng(`設定 ${w}px … アイコンに言葉が添えてある`, `「${m.字}」`)
    else if (m.絵 !== 1) ng(`設定 ${w}px … 絵が ${m.絵} つある`)
    else if (!m.名) ng(`設定 ${w}px … 名前(aria-label)が無い`, '絵だけなので、名前が要る')
    else if (m.名 !== '設定') ng(`設定 ${w}px … 名前が「設定」ではない`, `「${m.名}」`)
    else if (m.高さ < 30) ng(`設定 ${w}px … 押すには小さい`, m.大きさ)
    else ok(`設定 ${w}px … 絵だけ・名前は「${m.名}」(${m.大きさ})`)

    /* **押したら3つが出る。** `SettingsSheet` は広い窓では吹き出し、
       狭い窓では下から出るシートになる(どちらも同じ中身) */
    await page.click('.lesson-sets')
    await page.waitForTimeout(400)
    const 中 = await page.evaluate(() => {
      const pop = document.querySelector('.setpop, .sheet')
      return pop ? pop.innerText.replace(/\s+/g, ' ') : null
    })
    if (!中) ng(`設定 ${w}px … 押しても吹き出しが出ない`)
    else {
      /* **紙の幅は広い窓だけ**(スマホでは紙が画面いっぱいなので意味がない)。
         もとから CSS が `.lesson-widths` を狭い窓で隠している。

         ★ **狭い窓では、道具もここに入る**(2026-09-29 利用者の指定
           「ひとつにまとめます」)。畳む札を廃したので、
           **行き先はこの吹き出し1つ**である。
           入っていなければ**どこにも無い** —— 効かない操作より悪い。

         **出る側と出ない側の両方を見る** —— 片方だけだと、
         「どの幅でも出さない」に書き換えても緑のままになる */
      const 要る = w >= 1024
        ? ['文字', '幅', '印刷']
        : ['書き込む', 'メモ', '速さ', '文字', '印刷']
      const 無い = 要る.filter((t) => !中.includes(t))
      if (無い.length) ng(`設定 ${w}px … 吹き出しに ${無い.join(' / ')} が無い`, 中.slice(0, 120))
      else if (w < 1024 && 中.includes('幅')) {
        ng(`設定 ${w}px … 狭い窓に「幅」が出ている`, '紙は画面いっぱいなので、効かない操作になる')
      } else if (w >= 1024 && ['書き込む', 'メモ'].some((t) => 中.includes(t))) {
        ng(`設定 ${w}px … 広い窓で、帯にもある道具が吹き出しにも出ている`,
          '同じことをするものを2つ見せない')
      } else ok(`設定 ${w}px … 吹き出しに ${要る.join(' / ')} が入っている`)
    }
    await page.keyboard.press('Escape')
    await page.waitForTimeout(250)
  }

  /* ── **上の帯のプレーヤーは、絵だけ。黒帯と同じ絵** ──────────────
       > 上部のバーのボタンは「聴く」は必要なく、「▷」など、
       > アイコンだけで作って、下部に置くものと同じにしてください

     **言葉が消えても、名前は消えない** —— `aria-label` は
     `wholePlay.js` の言葉をそのまま言う(書き写さない)。
     **絵が同じであることは、同じ部品を使っているかで見る**
     (`.player-key` / `.player-big` は黒帯と共通) */
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.waitForTimeout(400)
  {
    const m = await page.evaluate(() => {
      const p = document.querySelector('.player--bar')
      if (!p) return null
      const 押す = [...p.querySelectorAll('button')]
      return {
        字: p.innerText.replace(/\s+/g, ' ').trim(),
        送り戻し: p.querySelectorAll('.player-key').length,
        鳴らす: p.querySelectorAll('.player-big').length,
        札: p.querySelectorAll('.player-key-cap').length,
        名前なし: 押す.filter((b) => !(b.getAttribute('aria-label') || b.textContent.trim())).length,
        鳴らすの名前: p.querySelector('.player-big')?.getAttribute('aria-label') ?? '',
        高さ: Math.round(p.getBoundingClientRect().height),
      }
    })
    if (!m) ng('上の帯 … プレーヤーが出ていない')
    else if (m.送り戻し !== 4) ng(`上の帯 … 送り戻しが4つ無い(${m.送り戻し} 個)`, '黒帯と同じ並びにする')
    else if (m.鳴らす !== 1) ng(`上の帯 … 鳴らすボタンが ${m.鳴らす} つある`)
    else if (m.札) ng(`上の帯 … 絵の下の札が ${m.札} つ出ている`, '1行しかないので出さない')
    else if (m.名前なし) ng(`上の帯 … 名前(aria-label)の無いボタンが ${m.名前なし} つある`)
    /* **名前は `wholePlay.js` 1か所から来る。** ここに書き写さない */
    else if (!m.鳴らすの名前.includes(WHOLE_PLAY_CORE)) {
      ng('上の帯 … 鳴らすボタンの名前が違う', `「${m.鳴らすの名前}」`)
    } else if (m.字.includes(WHOLE_PLAY_CORE)) {
      ng('上の帯 … 鳴らすボタンに言葉が出たままになっている', `「${m.字}」`)
    } else ok(`上の帯 … 絵だけ(送り戻し4つ + 鳴らす1つ)・名前は「${m.鳴らすの名前}」`)
  }
  await page.close()
}


/* ── **黒帯は3段。押すものの行は、絶対に折り返さない**(第5.311節)──────
 *
 *    > 再生プレーヤーが2行になるのは絶対にダメです
 *    > 画面下部分の音声プレーヤーを添付の写真のようなスタイルに
 *    > ①ふたつ実装してください(これは例外でOKです)
 *    > ②動かせるようにして段落を進めたり戻せるようにしてください
 *    > ③案Aは「画面下の黒帯」だけに当てます、そして浮くプレーヤーは廃止で
 *
 *    **「1行」の意味が変わった。** もとは操作盤まるごとが1行だったが、
 *    いまは**わざと3段**である(いまどこか / 進み具合 / 送り戻し)。
 *    だから**高さでは数えられない** —— 高さで見ていたころの本を
 *    そのまま残すと、案Aにした日から**必ず赤**になってしまう。
 *
 *    **見る先を、段ごとに分ける。**
 *
 *      | 段 | 何を見るか |
 *      |---|---|
 *      | `.player-head` | 1行に収まっているか(`useFitRow` が詰める) |
 *      | `.player-keys` | **折り返していないか**(利用者の「絶対にダメ」) |
 *
 *    **進み具合のバーは取り払った**(2026-09-29 利用者の指定
 *    「この再生バーは不必要なので取り払いましょう。場所を取るだけですね」)。
 *    つまみを数えていた本は消し、**出ていないこと**を数える本に替えた。
 *
 *    右端が画面から出ていないか・中身があふれていないかは、
 *    **これまでどおり**見る(押せなくなるため)。
 *
 *    あわせて**端末の「表示を大きく」**も模す(黒帯の文字を 1.25 倍)。
 *    幅が同じでも入るかどうかは変わるので、**幅の一覧では拾えない。**
 */
{
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } })
  await page.goto(`http://localhost:${PORT}/__bar.html?role=trainer&who=g1`,
    { waitUntil: 'networkidle' })
  await page.waitForTimeout(300)
  console.log('\n── 画面の下の黒帯(3段) ──')
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
        + ' .player--dock .player-key-cap'
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
      const p = document.querySelector('.player--dock')
      if (!p) return null
      const r = p.getBoundingClientRect()
      const head = p.querySelector('.player-head')
      const keys = p.querySelector('.player-keys')
      /** その行の子が、いちばん上の子より下へ落ちていないか(= 折り返した) */
      const 折り返した = (row) => {
        if (!row) return null
        const kids = [...row.children].filter((c) => c.getBoundingClientRect().width > 0)
        if (kids.length < 2) return false
        const 頭 = kids[0].getBoundingClientRect()
        return kids.some((c) => c.getBoundingClientRect().top > 頭.bottom - 1)
      }
      return {
        h: Math.round(r.height), right: Math.round(r.right), win: window.innerWidth,
        /* **自分は縮むので、中身のあふれも見る**(切れても高さは変わらない)。
           **段ごとに見る** —— 外側だけでは、中の行の切れを見落とす */
        spill: [p, head, keys].filter(Boolean)
          .some((b) => b.scrollWidth > b.clientWidth + 1),
        頭が折り返した: 折り返した(head),
        押す行が折り返した: 折り返した(keys),
        頭の高さ: head ? Math.round(head.getBoundingClientRect().height) : null,
        押す行: keys ? Math.round(keys.getBoundingClientRect().height) : null,
      }
    })
    const 印 = big ? `${w}px(文字 1.25 倍)` : `${w}px`
    if (!m) { ng(`${印} で黒帯が出ていない`); continue }
    /* ★ **押すものの行が折り返したら赤**(利用者の「絶対にダメです」)。
         高さでは見ない —— 3段なのだから、高さは 120px ほどが正しい */
    if (m.押す行が折り返した) {
      ng(`${印} で、送り戻しの行が折り返している`, `高さ ${m.押す行}px`)
    } else if (m.頭が折り返した) {
      ng(`${印} で、いちばん上の行が折り返している`, `高さ ${m.頭の高さ}px`)
    } else if (m.right > m.win) {
      ng(`${印} で黒帯が画面からはみ出している`, `右端 ${m.right} > ${m.win}`)
    } else if (m.spill) {
      ng(`${印} で黒帯の中身があふれている`, 'くり返しの単位が画面の外へ切れる')
    } else ok(`${印} … 3段とも折り返さない(黒帯 ${m.h}px / 押す行 ${m.押す行}px)`)
  }
  await page.evaluate(() => document.getElementById('eas-bigplayer')?.remove())

  /* ── **浮くプレーヤーは廃止した**(2026-09-29 利用者の指定・第5.311節)
         > そして浮くプレーヤーは廃止で。結局今まで使ったことがないです。

       もとは「スマホにだけ出さない」だった。いまは**どの幅にも無い。**
       `.player--float` も、つまんで動かすつまみ(`.player-grip`)も、
       元の場所へ戻す ⌖(`.player-home`)も、**1つも出ない。**
       **広い窓でも数える** —— 狭い窓だけ見ていると、
       `placeFor` に `float` を戻した日に**広い窓だけ緑のまま**になる。 */
  for (const w of [1440, 900, 390, 375, 320]) {
    await page.setViewportSize({ width: w, height: 900 })
    await page.waitForTimeout(300)
    const m = await page.evaluate(() => ({
      float: document.querySelectorAll('.player--float').length,
      grip: document.querySelectorAll('.player-grip').length,
      home: document.querySelectorAll('.player-home').length,
    }))
    if (m.float) ng(`${w}px に、浮くプレーヤーが出ている`, '第5.311節で廃止した')
    else if (m.grip) ng(`${w}px に、つまんで動かすつまみが出ている`)
    else if (m.home) ng(`${w}px に、元の場所へ戻す ⌖ が出ている`)
    else ok(`${w}px … 浮くプレーヤーも、つまみも、⌖ も出さない`)
  }

  /* ── **置き場所は2つ。行き先が無ければ、ボタンごと出さない** ──────
       上の帯は 1380px より狭いと1行に収まらない(`playerPlace.js`)。
       **出る / 出ないの両方を見る** —— 片方だけだと、
       「どこにも出さない」「全部に出す」に書き換えても緑のままになる。 */
  for (const [w, 出る] of [[1440, true], [900, false], [390, false], [320, false]]) {
    await page.setViewportSize({ width: w, height: 900 })
    await page.waitForTimeout(300)
    const n = await page.$$eval('.player-place', (xs) => xs.length)
    if (出る && !n) ng(`${w}px で、置き場所の切り替えが出ていない`, '上の帯へ移す道が無い')
    else if (!出る && n) ng(`${w}px に、置き場所の切り替えが出ている`, '行き先が無い(効かない操作)')
    else ok(`${w}px … 置き場所の切り替えは ${出る ? '出る' : '出ない'}`)
  }

  /* ── **広い窓では、上の帯と黒帯を行き来できる**(行き止まりを作らない) ── */
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.waitForTimeout(350)
  {
    const 見る = () => page.evaluate(() => ({
      bar: !!document.querySelector('.player--bar'),
      dock: !!document.querySelector('.player--dock'),
      次: document.querySelector('.player-place')?.getAttribute('aria-label') ?? null,
    }))
    const a = await 見る()
    if (!a.次) ng('1440px … 置き場所の切り替えが無い')
    else {
      await page.click('.player-place'); await page.waitForTimeout(350)
      const b = await 見る()
      if (a.bar === b.bar && a.dock === b.dock) {
        ng('1440px … 切り替えを押しても場所が変わらない', `${JSON.stringify(a)} → ${JSON.stringify(b)}`)
      } else if (b.bar && b.dock) {
        ng('1440px … 上の帯と黒帯が両方出ている', '同じものを2つ見せない')
      } else if (!b.次) {
        ng('1440px … 移したきり、戻る道が無い')
      } else {
        await page.click('.player-place'); await page.waitForTimeout(350)
        const c = await 見る()
        if (c.bar !== a.bar || c.dock !== a.dock) {
          ng('1440px … もう一度押しても元へ戻らない', JSON.stringify(c))
        } else ok(`1440px … ${a.bar ? '上の帯' : '黒帯'} ⇄ ${b.bar ? '上の帯' : '黒帯'} を行き来できる`)
      }
    }
  }

  /* ── ここから下は**黒帯の3段**を、段ごとに見る ───────────────── */
  await page.setViewportSize({ width: 390, height: 900 })
  await page.waitForTimeout(350)

  for (const w of [1280, 820, 390, 375, 320]) {
    await page.setViewportSize({ width: w, height: 900 })
    await page.waitForTimeout(320)

    /* ── ① **余った幅は、機能と機能のあいだへ配る**(2026-09 利用者の指定)
           > せっかくスペースに余裕ができたので、各機能の間にバランスよく
           > マージンを入れてください。触れすぎていて押し間違えをしそうな
           > 緊張感があります

         **見る先は押す行の中**(第5.311節)。3段にした日から、
         黒帯の直の子は「上の行 / つまみ / 押す行」の**縦積み**になったので、
         横の隙間をそこで数えても意味が無い。
         `space-between` にしてあるので、**余りがそのまま隙間になる**
         (`justify-content` を `center` に戻すと赤くなる)。 */
    const g = await page.evaluate(() => {
      const keys = document.querySelector('.player--dock .player-keys')
      if (!keys) return null
      const kids = [...keys.children].filter((c) => c.getBoundingClientRect().width > 0)
      const cs = window.getComputedStyle(keys)
      const 内側 = keys.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
      const 中身 = kids.reduce((s, c) => s + c.getBoundingClientRect().width, 0)
      return {
        数: kids.length,
        余り: Math.round(内側 - 中身),
        隙間: kids.slice(1).map((c, i) =>
          Math.round(c.getBoundingClientRect().left - kids[i].getBoundingClientRect().right)),
      }
    })
    if (!g) { ng(`${w}px … 押す行が無い`); continue }
    /* **5つ揃っているか。** 段落もどる / 文もどる / 鳴らす / 文すすむ /
       段落すすむ。**数を書き写さず、絵の中身で数える**のは下の本 */
    if (g.数 < 5) ng(`${w}px … 押す行に ${g.数} 個しかない`, '段落・文・鳴らすで5つ要る')
    else {
      const 最小 = Math.min(...g.隙間)
      /* **余りのほとんどが隙間になっているか。** 端数(1px)は数えない */
      if (最小 * g.隙間.length < g.余り - 1) {
        ng(`${w}px … 余った幅が隙間になっていない`,
          `余り ${g.余り}px なのに 隙間 ${g.隙間.join(' / ')}px`)
      } else ok(`${w}px … 余り ${g.余り}px を隙間へ配った(${g.隙間.join(' / ')}px)`)
    }

    /* ── ② **並ぶものの背丈をそろえる**(2026-09 実機・利用者の指定)
           > 段落送りの枠だけ細いのを、他のやつと同じにしてください

         **数えるのは押す行の中の5つ**(第5.311節)。
         まん中の鳴らすボタンだけは**わざと大きい**ので外す ——
         **名指しで外したことを、ここに書き残す。**
         送り戻しの4つは、絵も札も同じ形なので**1px も違わないはず**である。 */
    const hs = await page.evaluate(() => [...document.querySelectorAll('.player--dock .player-key')]
      .filter((c) => c.getBoundingClientRect().width > 0)
      .map((c) => Math.round(c.getBoundingClientRect().height)))
    if (hs.length !== 4) ng(`${w}px … 送り戻しが4つ無い(${hs.length} 個)`)
    else if (new Set(hs).size !== 1) {
      ng(`${w}px … 送り戻しの背丈がそろっていない`, `${hs.join(' / ')}px`)
    } else ok(`${w}px … 送り戻しの4つは全部 ${hs[0]}px(背丈がそろっている)`)

    /* ── ③ **取り払ったものが、戻っていないか**(2026-09-29 利用者の指定)
           > また、この再生バーは不必要なので取り払いましょう
           > 文、段落、の文字が不必要です

         **消したものは、消えたことを数える。** でないと、
         戻した日に誰も気づかない(黙って戻さない)。 */
    const 余分 = await page.evaluate(() => ({
      つまみ: document.querySelectorAll('.player--dock .player-seek,'
        + ' .player--dock .player-range, .player--dock .player-track').length,
      札: document.querySelectorAll('.player--dock .player-key-cap').length,
    }))
    if (余分.つまみ) ng(`${w}px … 進み具合のバーが戻っている`, `${余分.つまみ} 個`)
    else if (余分.札) ng(`${w}px … 送り戻しの札(文 / 段落)が戻っている`, `${余分.札} 個`)
    else ok(`${w}px … 進み具合のバーも、文 / 段落 の札も出ていない`)

    /* ── ③の2 **鳴らすボタンの絵は、丸のまん中に・丸に見合う大きさで**
           (2026-09-29 実機・利用者の指定を**2度**受けた)
           > 再生ボタンとストップボタンが丸の中心からズレていて非常にダサいです
           > 円に対して▶︎や■が私が渡した写真のデザインではもっと大きいでしょう

         **枠の大きさでは数えない。** `PlayIcon` は 20×20 の枠の中で
         三角が4〜5割しか塗っていないので、**枠を大きくしても絵は小さい。**
         実際それで1度ずれた(26px の枠で、見える三角は 10×12px)。
         **見える絵そのもの**(`path` / `rect` の箱)を測る。

         ★ **中心は、三角の「箱」では数えない。** 右向きの三角は
           箱の真ん中より重心が左にある(重心 9.67 / 箱の中心 11)ので、
           箱でそろえると**左に寄って見える。** 目で見て真ん中に来るのは
           **箱が少し右**のときである。だから「箱の中心が、丸の中心から
           右へ 0〜8%」を良しとする(左に出たら赤)。
           四角(■)は重心と箱が同じなので、そのまま真ん中に来る。 */
    const 絵 = await page.evaluate(() => {
      const big = document.querySelector('.player--dock .player-big')
      const g = big?.querySelector('svg path, svg rect')
      if (!g) return null
      const br = big.getBoundingClientRect(); const gr = g.getBoundingClientRect()
      return {
        丸: Math.round(br.height),
        高さの割合: Math.round((gr.height / br.height) * 100),
        横のずれ: Math.round(((gr.left + gr.right) / 2 - (br.left + br.right) / 2)
          / br.width * 1000) / 10,
        縦のずれ: Math.round(((gr.top + gr.bottom) / 2 - (br.top + br.bottom) / 2)
          / br.height * 1000) / 10,
        形: g.tagName,
      }
    })
    if (!絵) ng(`${w}px … 鳴らすボタンに絵が無い`)
    else if (絵.高さの割合 < 33) {
      ng(`${w}px … 鳴らすボタンの絵が小さい`,
        `丸 ${絵.丸}px に対して高さ ${絵.高さの割合}%(写真は4割ほど)`)
    } else if (絵.縦のずれ < -2 || 絵.縦のずれ > 2) {
      ng(`${w}px … 鳴らすボタンの絵が、丸の上下の中心にいない`, `${絵.縦のずれ}%`)
    } else if (絵.横のずれ < 0 || 絵.横のずれ > 8) {
      ng(`${w}px … 鳴らすボタンの絵が、丸の左右の中心からずれている`,
        `${絵.横のずれ}%(0〜8% に収める。左に出たら「ズレて見える」側)`)
    } else {
      ok(`${w}px … 鳴らすボタンの絵は丸の ${絵.高さの割合}%・`
        + `中心から 横 ${絵.横のずれ}% / 縦 ${絵.縦のずれ}%`)
    }

    /* ── ④ **速さは、黒帯には置かない**(2026-09-30 利用者の指定)
           > 速度は上部UIで変更できるので下部のプレーヤーからは排除しましょう

         一度は両方に置いた(第5.311節「①ふたつ実装してください」)。
         **消したものは、消えたことを数える** —— でないと、
         戻した日に誰も気づかない(黙って戻さない)。
         速さは `道具` 1か所にあり、広い窓では帯に、狭い窓では
         右上の「設定」の中に出る(それは下の節が数える)。 */
    const 速さ = await page.$$eval(
      '.player--dock .player-rate, .player--dock .stepper', (xs) => xs.length)
    if (速さ) ng(`${w}px … 黒帯に速さが戻っている`, `${速さ} 個`)
    else ok(`${w}px … 黒帯に速さは出ていない(上の UI にある)`)
  }

  /* ── ⑤ **矢印は、いま選ばれている物のもの**(第5.311節・実測で出た不具合)
       レッスン表示は**窓ぜんぶで矢印を聞いて**いる(ページ送り)。
       欄やつまみを触っているあいだも奪っていたので、
       **欄の中で矢印を押すと、紙のページまで送られていた。**

       ★ **測る相手が変わった**(2026-09-29 利用者の指定で、進み具合の
         バーを取り払った)。もとは操作盤のつまみで測っていたが、
         **決まりは「欄の中の矢印を奪わない」で、つまみ専用ではない。**
         だから**画面の中の欄(`input` / `textarea`)**で測る。
       **1つも無ければ赤** —— そのときは何も数えていない(CLAUDE.md)。 */
  await page.setViewportSize({ width: 1500, height: 900 })
  await page.waitForTimeout(350)
  {
    const いまのページ = () => page.evaluate(() =>
      [...document.querySelectorAll('.lesson-page')].findIndex((e) => !e.classList.contains('is-closed')))
    /* **欄を1つ出す。** 紙の上に欄が無いページもあるので、
       「メモ」を開いて確実に用意する(開かないと測る相手が居ない)。

       ★ **偽の応答を先に用意する。** セッションの記録は Supabase から
         読んでから欄を描く。この画面には差し替えを置いていなかったので、
         **押しても欄が出ず、見張りが「測る相手が居ない」と言っていた**
         (持ち帰らせた `{"メモの札":true,"欄ぜんぶ":0}` で分かった)。 */
    await page.route('**/rest/v1/**', (r) => r.fulfill({
      status: 200, contentType: 'application/json', body: '[]',
    }))
    const メモ = await page.$('.lesson-bar button[title^="この日のセッションの記録"]')
    if (メモ) { await メモ.click(); await page.waitForTimeout(700) }
    const 欄 = await page.$$eval('.lesson input:not([type=hidden]), .lesson textarea',
      (xs) => xs.filter((x) => x.offsetParent !== null).length)
    if (!欄) {
      /* **どこまで来たかを、必ず持ち帰る**(CLAUDE.md) */
      const 様子 = await page.evaluate(() => ({
        帯: !!document.querySelector('.lesson-bar'),
        メモの札: !!document.querySelector('.lesson-bar button[title^="この日のセッションの記録"]'),
        欄ぜんぶ: document.querySelectorAll('input, textarea').length,
      }))
      ng('矢印 … 画面に欄(input / textarea)が1つも無い',
        `この見張りは何も数えていない(測る相手が居ることを、先に確かめる)`
        + `\n    ${JSON.stringify(様子)}`)
    } else {
      const 前 = await いまのページ()
      await page.evaluate(() => {
        const el = [...document.querySelectorAll('.lesson input:not([type=hidden]), .lesson textarea')]
          .find((x) => x.offsetParent !== null)
        el.focus()
      })
      await page.keyboard.press('ArrowRight')
      await page.waitForTimeout(350)
      const 後 = await いまのページ()
      if (後 !== 前) {
        ng('矢印 … 欄の中で押したのに、紙のページが送られた',
          `${前} → ${後}。矢印は、いま選ばれている物のもの`)
      } else ok(`矢印 … 欄(${欄} 個)の中で押しても、ページは送られない`)
    }
  }
  await page.close()
}


/* ── **集中モードの音声プレーヤーは、紙の黒帯とまったく同じもの** ──────
 *    (2026-09-30 利用者の指定・第5.321節)
 *
 *    > 音声プレーヤーは、今これがあるところは全て同じ仕様にしてください
 *    > 集中モードもです。例外はありません。
 *
 *    **ここは以前「絶対に1行」を見ていた**(第5.208節)。あの指定は
 *    **この画面が自前で組んでいた古い帯**に向いたものである。
 *    利用者はそのあと黒帯を**2段の案A** に自分で決め、今回
 *    「例外はありません」と言った。**新しいほうが効く。**
 *
 *    **見るのは「同じかどうか」**である。持ちものを名前で数えて、
 *    紙の黒帯と1つも違わないことを見る ——
 *    **数だけ数えると、別のボタンに入れ替わっても緑になる。**
 *
 *    あわせて**あふれていないこと**も見る。折り返さない指定なので、
 *    足りなくなると外へ出て隠れる(高さでは分からない)。
 */
{
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } })
  await page.goto(`http://localhost:${PORT}/__bar.html?role=trainer&who=g1`,
    { waitUntil: 'networkidle' })
  await page.waitForTimeout(300)

  /** その黒帯に並んでいる、押せるものの名前(左から順に) */
  const 持ちもの = (sel) => page.evaluate((s) => {
    const p = document.querySelector(s)
    if (!p) return null
    return [...p.querySelectorAll('button')]
      .map((b) => (b.getAttribute('aria-label') || b.textContent || '').trim())
      .filter(Boolean)
  }, sel)

  /* ① 紙の黒帯を読む。**先に出しておく**(通しの読み上げが在る教材) */
  const 紙 = await 持ちもの('.player-dock .player--dock')
  if (!紙 || !紙.length) {
    ng('集中モード … くらべる相手(紙の黒帯)が出ていない',
      '**測る相手が居ることを、先に確かめる**(CLAUDE.md)')
  }

  /* ② 集中モードへ入って、同じものが並んでいるか */
  const 入る = async () => {
    const ok2 = await page.evaluate(() => {
      const b = [...document.querySelectorAll('.practice-row button')]
        .find((e) => (e.textContent || '').includes('集中モード'))
      if (!b) return false
      b.click(); return true
    })
    if (ok2) await page.waitForTimeout(400)
    return ok2
  }
  const 出る = async () => {
    await page.evaluate(() => {
      const x = [...document.querySelectorAll('.focus button')]
        .find((e) => (e.textContent || '').includes('集中モードを終える'))
      if (x) x.click()
    })
    await page.waitForFunction(() => [...document.querySelectorAll('.practice-row button')]
      .some((e) => (e.textContent || '').includes('集中モード')), null, { timeout: 5000 })
      .catch(() => {})
  }

  if (紙 && 紙.length && await 入る()) {
    const 集中 = await 持ちもの('.focus-bar .player--dock')
    if (!集中) {
      ng('集中モード … 下の帯が、紙の黒帯と別のものになっている',
        '`.focus-bar` の中に `.player--dock` が無い(自前で組んでいる)')
    } else {
      /* **数(3 / 6 段落)は教材のどこに居るかで変わる**ので、名前だけ見る。
         それ以外は1文字も違ってはいけない */
      const 落とす = (xs) => xs.filter((x) => !/^[—\d]+\s*\/\s*\d+/.test(x))
      const a = 落とす(紙).join(' / ')
      const b = 落とす(集中).join(' / ')
      if (a !== b) {
        ng('集中モード … プレーヤーの持ちものが、紙の黒帯と違う',
          `紙  : ${a}\n    集中: ${b}`)
      } else {
        ok(`集中モード … プレーヤーは紙の黒帯とまったく同じ(${落とす(集中).length} つ)`)
      }
    }
    await 出る()
  }

  /* ③ **どの幅でもあふれない。** 最後の段落(「まとめ」が出る)まで送る。
       端末の「表示を大きく」も模す —— 幅が同じでも入るかは変わる */
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
      st.textContent = '.focus-bar .btn, .focus-bar .player-at,'
        + ' .focus-top .btn { font-size: 15px !important }'
      document.head.appendChild(st)
    }, big)
    await page.waitForTimeout(150)
    const 印 = big ? `${w}px(文字 1.25 倍)` : `${w}px`
    if (!await 入る()) { ng(`${印} で集中モードの入り口が無い`); continue }

    let bad = false
    for (let step = 0; step < 12; step++) {
      const m = await page.evaluate(() => {
        const bar = document.querySelector('.focus-bar')
        const top = document.querySelector('.focus-top')
        if (!bar || !top) return null
        const spill = (el) => !!el
          && [el, ...el.children].some((b) => b.scrollWidth > b.clientWidth + 1)
        return {
          上: Math.round(top.getBoundingClientRect().height),
          /* **押す行**(⏮⏮ ⏮ ▶ ⏭ ⏭⏭)と、その上の行。どちらも1行 */
          keys: spill(bar.querySelector('.player-keys')),
          head: spill(bar.querySelector('.player-head')),
          top上: spill(top),
          末: /まとめ/.test(top.textContent || '') ? 'まとめ' : '中ほど',
        }
      })
      if (!m) { ng(`${印} で集中モードの下の帯が出ていない`); bad = true; break }
      if (m.keys || m.head) {
        ng(`${印} で集中モードのプレーヤーがあふれている(${m.末})`,
          `${m.keys ? '押す行' : '上の行'} … 折り返さない指定なので、隠れて押せなくなる`)
        bad = true; break
      }
      if (m.上 > 70 || m.top上) {
        ng(`${印} で集中モードの上の帯があふれている(${m.末})`,
          `高さ ${m.上}px(1行なら 60px ほど)`)
        bad = true; break
      }
      if (m.末.includes('まとめ')) break
      // 段落を送るのは**プレーヤーのいちばん外側のボタン**(⏭⏭)
      const moved = await page.evaluate(() => {
        const keys = document.querySelector('.focus-bar .player-keys')
        const b = keys ? [...keys.querySelectorAll('.player-key-btn')].pop() : null
        if (!b || b.disabled) return false
        b.click(); return true
      })
      if (!moved) break
      await page.waitForTimeout(150)
    }
    if (!bad) ok(`${印} … 集中モードのプレーヤーは、どの段落でもあふれない`)
    await 出る()
  }
  await page.close()
}

/* ── **上段と下段は、同じ左右にそろう**(2026-09-30 実機・利用者の指定・
 *    第5.322節)
 *
 *    > 上段の「−/30問」と、右側のリピートアイコン・「105%」が
 *    > 左右の端に寄りすぎて、数字やアイコンだけが外へ張り出して見えます
 *    > プレーヤー上段の情報と下段の再生操作を、同じ左右の余白を基準に
 *    > 揃えてください
 *
 *    **上段だけが黒帯の幅いっぱいだった。** 実測で 390px のとき
 *    左右それぞれ **35px**、430px では **51px** 外へ出ていた。
 *
 *    **見るのは「そろっているか」。** 幅そのものは書かない
 *    (`--player-w` を変えた日に、期待値も一緒に動いてしまう)——
 *    **番号の左端と外側キーの左端**、**速さの右端と外側キーの右端**が
 *    ぴったり並ぶことを見る。
 *
 *    **プレーヤーが在る画面をぜんぶ見る**(レッスン / 集中モード /
 *    スピーチ練習)。1つだけ見ると、**そろえ忘れた画面**が残る。
 */
{
  /** そのプレーヤーの、上段と下段の並び */
  const 並び = (page) => page.evaluate(() => {
    const out = []
    for (const [名, sel] of [
      ['黒帯', '.player-dock .player--dock'],
      ['集中モード', '.focus-bar .player--dock'],
    ]) {
      const p = document.querySelector(sel)
      if (!p) continue
      const 上 = p.querySelector('.player-head')
      const 下 = p.querySelector('.player-keys')
      if (!上 || !下) { out.push({ 名, 欠け: '上段か下段が無い' }); continue }
      const R = (el) => { const b = el.getBoundingClientRect(); return { l: b.left, r: b.right, w: b.width } }
      const sp = (el) => !!el && [el, ...el.children]
        .some((b) => b.scrollWidth > b.clientWidth + 1)
      const 鍵 = [...下.querySelectorAll('.player-key-btn')]
      const 番号 = 上.querySelector('.player-at')
      /* いちばん右にあるもの。速さが無い画面ではくり返しが右端になる */
      const 右端 = 上.querySelector('.player-rate-now') ?? 上.querySelector('.repeat-key')
      if (!鍵.length || !番号 || !右端) { out.push({ 名, 欠け: '測る相手が居ない' }); continue }
      /* **押すものの合計**(⏮⏮ ⏮ ▶ ⏭ ⏭⏭ / 少ない画面は ⏮ ▶ ⏭)。
         `space-between` は**余り**を隙間に配るので、
         **余りが同じなら、どの画面でも同じ詰まり具合に見える** */
      const 丸 = 下.querySelector('.player-big')
      const 中身 = [...鍵, ...(丸 ? [丸] : [])]
        .reduce((n, b) => n + R(b).w, 0)
      out.push({
        名,
        左: Math.round((R(番号).l - R(鍵[0]).l) * 10) / 10,
        右: Math.round((R(鍵[鍵.length - 1]).r - R(右端).r) * 10) / 10,
        /* **上段が下段より広くないこと**も見る(囲みそのものの幅) */
        幅の差: Math.round((R(上).w - R(下).w) * 10) / 10,
        /* **余り**(押す行の幅 − 押すものの合計)。**数は書かない** ——
           画面どうしで**同じ**であることだけを見る */
        余り: Math.round(R(下).w - 中身),
        あふれ: [sp(上) && '上段', sp(下) && '下段'].filter(Boolean).join(',') || '',
      })
    }
    return out
  })

  /** どれだけずれたら「ずれている」と言うか(小数の丸めぶんは許す) */
  const 許す = 1
  const 大きく = '.player--dock .player-at,'
    + ' .player--dock .player-rate-now { font-size: 15px !important }'

  /** 画面ごとの「余り」。**あとで突き合わせる**(下のまとめ) */
  const 余りたち = []
  for (const [画面, q, 開く] of [
    ['レッスン(ドリル)', '?kind=drill&role=trainer&who=g1', null],
    ['レッスン(本文)', '?role=trainer&who=g1', null],
    ['集中モード', '?role=trainer&who=g1', '集中モード'],
    /* ★ **スピーチも、いまは「ふつうの黒帯」である**(第5.323節)。
         添削ずみのスピーチは**モノローグ教材の画面**で開くので、
         `.player-dock--inline`(カードの中に置いた黒帯)は無くなった */
    ['スピーチ(教材の画面)', '?screen=speechboard', null],
  ]) {
    const 悪い = []
    let 見た = 0
    for (const [w, big] of [
      [430, false], [402, false], [390, false], [375, false], [344, false], [320, false],
      [430, true], [390, true], [375, true], [320, true],
    ]) {
      const page = await browser.newPage({ viewport: { width: w, height: 900 } })
      await page.goto(`http://localhost:${PORT}/__bar.html${q}`, { waitUntil: 'networkidle' })
      await page.waitForTimeout(400)
      if (開く) {
        await page.evaluate((t) => {
          const b = [...document.querySelectorAll('.practice-row button')]
            .find((e) => (e.textContent || '').includes(t))
          if (b) b.click()
        }, 開く)
        await page.waitForTimeout(450)
      }
      /* **端末の「表示を大きく」も模す。** 幅が同じでも、そろうかは変わる */
      if (big) { await page.addStyleTag({ content: 大きく }); await page.waitForTimeout(250) }
      const 印 = `${w}px${big ? '(文字1.25倍)' : ''}`
      const ms = await 並び(page)
      if (!ms.length) 悪い.push(`${印} … プレーヤーが1つも出ていない`)
      for (const m of ms) {
        見た += 1
        if (m.欠け) { 悪い.push(`${印} ${m.名} … ${m.欠け}`); continue }
        /* 広い窓でだけ集める(狭い窓はボタンごと縮むので、余りも変わる) */
        if (w === 430 && !big) 余りたち.push([`${画面} / ${m.名}`, m.余り])
        if (Math.abs(m.左) > 許す || Math.abs(m.右) > 許す) {
          悪い.push(`${印} ${m.名} … 左が ${m.左}px / 右が ${m.右}px ずれている`)
        } else if (m.幅の差 > 許す) {
          悪い.push(`${印} ${m.名} … 上段が下段より ${m.幅の差}px 広い`)
        } else if (m.あふれ) {
          悪い.push(`${印} ${m.名} … ${m.あふれ} があふれている`)
        }
      }
      await page.close()
    }
    if (!見た) {
      /* **測る相手が居ることを、先に確かめる**(CLAUDE.md) */
      ng(`${画面} … プレーヤーを1度も測れなかった`, '見張りが素通りしている')
    } else if (悪い.length) {
      ng(`${画面} … 上段と下段の左右がそろっていない(${悪い.length} 件)`,
        悪い.slice(0, 6).join('\n    '))
    } else {
      ok(`${画面} … 上段の数字と絵が、下段の再生操作とぴったり同じ左右`
        + `(${見た} 通りの幅と文字の大きさで測った)`)
    }
  }

  /* ── ★ **押す行の「余り」は、どの画面でも同じ**(第5.322節)──────
       `space-between` は余りを隙間に配るので、**余りが同じなら
       どの画面でも同じ詰まり具合に見える。**

       **押すものが3つになる画面**(単位が「文」= 内側の三角が要らない)
       では、そこだけ幅を詰めていないと**余りが 148px に開いて**
       隙間が 74px になり、1つの操作盤に見えなくなる
       (5つのときは 15px)。
       ★ スピーチ練習がそれだったが、**第5.323節でモノローグ教材の画面に
         なった**ので、いまはどの画面も5つである。決まりは残す ——
         また「文」を単位にする画面ができた日に、ひとりでに効く。

       **数は書かない。** 画面どうしで**同じ**であることだけを見る ——
       余りそのものを変えた日は、ぜんぶ一緒に動く。 */
  if (余りたち.length < 2) {
    ng('押す行の余り … くらべる相手が居ない',
      `${余りたち.length} 画面しか測れていない(見張りが素通りしている)`)
  } else {
    const 値 = [...new Set(余りたち.map(([, v]) => v))]
    if (値.length !== 1) {
      ng('押す行の余りが、画面によって違う',
        余りたち.map(([名, v]) => `${名} … 余り ${v}px`).join('\n    '))
    } else {
      ok(`押す行の余りは、${余りたち.length} 画面とも ${値[0]}px でそろっている`
        + '(隙間の詰まり具合が同じに見える)')
    }
  }
}

/* ══════════════════════════════════════════════════════════════════════
 * **黒帯の差し色と、上段と下段のあいだの線**(2026-10-08 実機・
 * 利用者の指定・第5.418節。5つ描いて見比べてもらい、**案B**に決まった)
 *
 *   > 下のプレーヤーのデザインが味気ないのを少し差し色を入れて、
 *   > 上下のパーツの間に薄いラインを入れるなどして改善できませんか？
 *   > いや、明るいモードの時は差し色は青ですよね
 *
 * **見るのは5つ。**
 *   ①上段の下に**線がある**(太さが 0 でなく、透明でもなく、下に隙間がある)
 *   ②**いま何問めか**と**速さ**が、黒帯の上で**読める**(4.5 : 1 以上)
 *   ③その色が、**ふつうの文字の白とは違う**(差し色になっている)
 *   ④その**色あい**が、その配色の `--accent` と同じ(青なら青・金なら金)
 *   ⑤**明るい配色と暗い配色で、色が変わる**
 *
 * **ここがいちばん効く見張りである(⑤)。** 金を直に書いてしまうと、
 * 明るい配色でも金のままになる —— そのとき**2つの配色の色が同じ**になるので、
 * ⑤が赤くなる。**値は1つも書き写していない**(金も青も、ここには無い)。
 *
 * ②は「黒帯は明るい配色でも黒いまま」から来る。素の青(`#2c6094`)は
 * 実測 2.4 : 1 で沈む —— **読めるかどうかを測る**ので、
 * どの色に変えても、沈めば赤くなる。
 * ══════════════════════════════════════════════════════════════════════ */
{
  /* ★ **色の文字列を、自分でほどかない**(2026-10-08)。
       `color-mix()` を使うと、Chromium は `color(srgb 0.54 0.65 0.76)` を
       返す —— `rgb(…)` のつもりで数字を拾うと、**0〜1 を 0〜255 として
       読んでしまい**、どの色も真っ黒に見える。
       **描かせて、その1粒を読む**(canvas)。どんな書き方でも 0〜255 で返る。 */
  /** その色の明るさ(WCAG の相対輝度) */
  const 明るさ = (rgb) => {
    const f = rgb.map((v) => {
      const x = v / 255
      return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2]
  }
  /** 2色のコントラスト比(1〜21) */
  const 比 = (a, b) => {
    const [x, y] = [明るさ(a), 明るさ(b)].sort((p, q) => q - p)
    return Math.round(((x + 0.05) / (y + 0.05)) * 10) / 10
  }
  /** その色の色あい(0〜360。灰色なら null) */
  const 色あい = (rgb) => {
    const [r, g, b] = rgb.map((v) => v / 255)
    const 大 = Math.max(r, g, b); const 小 = Math.min(r, g, b)
    if (大 - 小 < 0.02) return null
    let h = 0
    if (大 === r) h = ((g - b) / (大 - 小)) % 6
    else if (大 === g) h = (b - r) / (大 - 小) + 2
    else h = (r - g) / (大 - 小) + 4
    h *= 60
    return Math.round(h < 0 ? h + 360 : h)
  }
  /** 色あいがどれだけ離れているか(0〜180) */
  const 色の差 = (a, b) => {
    if (a == null || b == null) return 180
    const d = Math.abs(a - b) % 360
    return Math.round(d > 180 ? 360 - d : d)
  }

  const 測る = (page) => page.evaluate(() => {
    const p = document.querySelector('.player-dock .player--dock')
    if (!p) return { 欠け: '黒帯が無い' }
    /* **色の名前は1つも書かない。** `--accent` と `--player-ink` を
       いったん描かせて、そこから読み取る(値を書き写さない) */
    const 盤 = document.createElement('canvas')
    盤.width = 1; 盤.height = 1
    const 筆 = 盤.getContext('2d')
    /** その色を実際に塗って、0〜255 の組で読み取る */
    const 粒 = (c) => {
      筆.clearRect(0, 0, 1, 1)
      筆.fillStyle = '#000'
      筆.fillStyle = c
      筆.fillRect(0, 0, 1, 1)
      const d = 筆.getImageData(0, 0, 1, 1).data
      /* **4つめは濃さ(0〜255)。** これが 0 なら、その色は透明である ——
         `transparent` も `color(srgb … / 0)` も、ここで同じように分かる */
      return [d[0], d[1], d[2], d[3]]
    }
    const 読む = (値) => {
      const e = document.createElement('span')
      e.style.color = 値
      p.appendChild(e)
      const c = window.getComputedStyle(e).color
      e.remove()
      return { css: c, rgb: 粒(c) }
    }
    const 色で = (c) => (c == null ? null : { css: c, rgb: 粒(c) })
    const g = (sel) => {
      const el = p.querySelector(sel)
      return el ? window.getComputedStyle(el) : null
    }
    const 上 = g('.player-head')
    /* 黒帯の地色。**自分に地色が無ければ、親をたどる** */
    let 地 = ''
    for (let el = p; el; el = el.parentElement) {
      const bg = window.getComputedStyle(el).backgroundColor
      if (bg && !/,\s*0\)$/.test(bg) && bg !== 'transparent') { 地 = bg; break }
    }
    return {
      地: 色で(地),
      accent: 読む('var(--accent)'),
      白: 読む('var(--player-ink)'),
      線の太さ: 上 ? parseFloat(上.borderBottomWidth) || 0 : null,
      /* ★ **線は、上段と押す行のまん中に見えるか**(第5.420節)。
           上段の文字から線までより、線から丸までが**狭くない**こと ——
           狭いと、線が押す行のほうへ寄って見える。
           **数は書かない**(どちらも実測して比べるだけ) */
      文字から線: (() => {
        const 文字 = p.querySelector('.player-at')
        const h = p.querySelector('.player-head')
        if (!文字 || !h) return null
        return Math.round(h.getBoundingClientRect().bottom - 文字.getBoundingClientRect().bottom)
      })(),
      線から丸: (() => {
        const h = p.querySelector('.player-head')
        const 丸 = p.querySelector('.player-big')
        if (!h || !丸) return null
        return Math.round(丸.getBoundingClientRect().top - h.getBoundingClientRect().bottom)
      })(),
      線の色: 上 ? 色で(上.borderBottomColor) : null,
      線の下: 上 ? parseFloat(上.paddingBottom) || 0 : null,
      番号: 色で(g('.player-at-now')?.color ?? null),
      速さ: 色で(g('.player-rate-now')?.color ?? null),
      /* ★ **効いている印は、描かれているものを読む**(第5.419節)。
           `--pick-line` を覗くのをやめた —— 囲みを外したので、
           **その変数はもう誰も描いていない。**
           「描かれていないものを測る」と、見張りが素通りする */
      印: 色で(g('.repeat-key.is-on')?.color ?? null),
      /* 囲みを外したこと自体も見る(地色と枠線が**見えない**)。
         ★ **太さでは見ない。** 素の `.repeat-key` は
           `border: 1px solid transparent` を持っている ——
           **押したときに 1px ずれないよう、場所を取ってあるだけ**で、
           これは囲み線ではない(共通ルール「押しても、まわりの物が
           動かない」)。**見えるかどうか**は、濃さで決まる */
      印の地: 色で(g('.repeat-key.is-on')?.backgroundColor ?? null),
      印の枠: 色で(g('.repeat-key.is-on')?.borderTopColor ?? null),
    }
  })

  /** 配色ごとの「いま何問めか」の色。**あとで突き合わせる**(⑤) */
  const 配色ごとの色 = []
  for (const 配色 of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width: 390, height: 900 } })
    await page.goto(`http://localhost:${PORT}/__bar.html?kind=drill&role=trainer&who=g1`,
      { waitUntil: 'networkidle' })
    await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), 配色)
    await page.waitForTimeout(350)
    /* **効いている印を測るので、1回押して効かせる**(既定は「しない」)。
       **押せたかを確かめてから測る** —— 押せていなければ、
       そのあとの見張りは何もしていないのと同じである */
    const 押せた = await page.$('.player--dock .repeat-key')
    if (押せた) { await 押せた.click(); await page.waitForTimeout(250) }
    else ng('黒帯の差し色 … くり返しのボタンが無い', '見張りが素通りしている')
    const m = await 測る(page)
    await page.close()

    if (m.欠け) { ng(`黒帯の差し色(${配色}) … ${m.欠け}`, '見張りが素通りしている'); continue }
    const 悪い = []
    /* ①線。**太さと色の両方**を見る —— どちらか片方だと、
         `transparent` にしても・0 にしても緑のままになる */
    if (!m.線の太さ) 悪い.push('上段の下に線が無い(太さ 0)')
    else if (!(m.線の色?.rgb?.[3])) 悪い.push(`線が透明(${m.線の色?.css})`)
    /* **線と押す行がくっついていない**(共通ルール「すき間ゼロでくっつけない」)*/
    if (m.線の太さ && !m.線の下) 悪い.push('線と押す行のあいだに隙間が無い')
    /* ★ 線が、上段と押す行のまん中に見えるか(第5.420節) */
    if (m.文字から線 == null || m.線から丸 == null) 悪い.push('線の上下を測れない')
    else if (m.線から丸 < m.文字から線) {
      悪い.push(`線が押す行へ寄って見える(文字から線 ${m.文字から線}px / 線から丸 ${m.線から丸}px)`)
    }
    if (!m.地) 悪い.push('黒帯の地色が読み取れない')

    const 地 = m.地?.rgb ?? [0, 0, 0]
    const 白 = m.白.rgb
    const 色あいの基 = 色あい(m.accent.rgb)
    /* ★ **囲みを外したか**(2026-10-08 利用者の指定・第5.419節)。
         > 適用時は囲み線ではなく色の変化のみで OK です */
    if (m.印の枠 == null) 悪い.push('効いているくり返しが黒帯の中に無い')
    else {
      if (m.印の枠.rgb[3]) 悪い.push(`効いている印に枠線が見えている(${m.印の枠.css})`)
      if (m.印の地?.rgb?.[3]) 悪い.push(`効いている印に地色が残っている(${m.印の地.css})`)
    }
    for (const [名, v, 下限] of [['いま何問め', m.番号, 4.5], ['速さ', m.速さ, 4.5], ['効いている印', m.印, 4.5]]) {
      if (v == null) { 悪い.push(`${名} が黒帯の中に無い`); continue }
      /* ②黒帯の上で読めるか(文字は 4.5 : 1、枠線は 3 : 1) */
      const r = 比(v.rgb, 地)
      if (r < 下限) 悪い.push(`${名} が黒帯の上で沈んでいる(${r} : 1 / ${下限} : 1 は要る・${v.css})`)
      /* ③ふつうの文字の白と同じなら、差し色になっていない */
      if (比(v.rgb, 白) < 1.2) 悪い.push(`${名} が白のまま(差し色になっていない・${v.css})`)
      /* ④色あいが `--accent` と同じか(明るさは変えてよい) */
      const d = 色の差(色あい(v.rgb), 色あいの基)
      if (d > 25) 悪い.push(`${名} の色あいが --accent と違う(${d}° 離れている・${v.css} / --accent は ${m.accent.css})`)
    }
    配色ごとの色.push([配色, m.番号.css])

    if (悪い.length) {
      ng(`黒帯の差し色と線(${配色} ${悪い.length} 件)`, 悪い.join('\n    '))
    } else {
      ok(`黒帯(${配色}) … 上段の下にうすい線(${m.線の太さ}px。`
        + `文字から ${m.文字から線}px / 丸まで ${m.線から丸}px)があり、`
        + `いま何問め・速さ・効いている印が差し色`
        + `(${m.番号.css} / 地の色との比 ${比(m.番号.rgb, 地)} : 1)`)
    }
  }

  /* ── ⑤ **配色で色が変わる**(ここに金や青と書かないための見張り)──── */
  if (配色ごとの色.length < 2) {
    ng('黒帯の差し色 … 配色をくらべられない',
      `${配色ごとの色.length} 通りしか測れていない(見張りが素通りしている)`)
  } else if (配色ごとの色[0][1] === 配色ごとの色[1][1]) {
    ng('黒帯の差し色が、明るい配色でも暗い配色でも同じ',
      `${配色ごとの色.map(([t, c]) => `${t} … ${c}`).join('\n    ')}\n    `
      + '色を直に書いていないか(差し色は --accent から来る)')
  } else {
    ok(`黒帯の差し色は配色で変わる(${配色ごとの色.map(([t, c]) => `${t} ${c}`).join(' / ')})`)
  }
}

/* ══════════════════════════════════════════════════════════════════════
 * **スマホのメモ・シートの閉じ方・訳の色**(2026-10-08 実機・第5.426〜5.428節)
 *
 *   > スマホでのメモが機能してません
 *   > 右上の詳細ボタンで開いたものを再び同じボタンを押しても閉じられない
 *   > 青まで入れるとうるさく感じる
 *
 * **3つとも「出る」と「出ない」の両方を見る**(CLAUDE.md)。
 * ══════════════════════════════════════════════════════════════════════ */
{
  /** その幅で、学習ツール(メモ / 書き込む)を押したらどうなるか */
  const メモの出かた = async (w, 名 = 'メモ') => {
    const page = await browser.newPage({ viewport: { width: w, height: 900 } })
    await page.goto(`http://localhost:${PORT}/__bar.html?kind=drill&role=trainer&who=g1`,
      { waitUntil: 'networkidle' })
    await page.waitForTimeout(500)
    /* 「設定」を開いてから「メモ」を押す(狭い窓では帯に出ていない) */
    const 設定 = await page.$('.lesson-sets')
    if (設定) { await 設定.click(); await page.waitForTimeout(300) }
    const 押せた = await page.evaluate((n) => {
      const b = [...document.querySelectorAll('button')]
        .find((x) => new RegExp(n).test(x.textContent) && x.getBoundingClientRect().width > 0)
      if (!b) return false
      b.click()
      return true
    }, 名)
    await page.waitForTimeout(500)
    const m = await page.evaluate(() => ({
      シート: [...document.querySelectorAll('.sheet')]
        .some((e) => e.getAttribute('aria-label') === 'セッションの記録'),
      横の箱: !!document.querySelector('.lesson-notes'),
      /* **残った設定のシート**(2枚重なっていないか) */
      設定も: [...document.querySelectorAll('.sheet')]
        .some((e) => e.getAttribute('aria-label') === '設定'),
    }))
    await page.close()
    return { 押せた, ...m }
  }

  /* ── ★ **狭い画面では、下から出すシートで出す**(第5.426節)──────
       もとは**紙の下に積んでいた** —— 教材ぜんぶを送り切らないと
       たどり着けないので、押しても何も起きていないように見えた。
       **広い画面では、これまでどおり紙の右**(そこには置く余地がある)。 */
  const 狭い = await メモの出かた(390)
  const 広い = await メモの出かた(1280)
  /* ★ **「書き込む」も同じ**(2026-10-09 利用者の指定・第5.429節)——
       シートが紙の上に残っていては、書けない */
  const ペン = await メモの出かた(390, '書き込む')
  if (!狭い.押せた || !広い.押せた) {
    ng('メモ … ボタンを押せなかった', '見張りが素通りしている')
  } else if (!狭い.シート || 狭い.横の箱) {
    ng('メモ(390px) … 下から出すシートになっていない',
      `シート ${狭い.シート} / 横の箱 ${狭い.横の箱}`)
  } else if (狭い.設定も) {
    ng('メモ(390px) … 設定のシートが残ったまま(2枚重なる)')
  } else if (!ペン.押せた || ペン.設定も) {
    ng('書き込む(390px) … 設定のシートが残ったまま(紙の上に乗っていて書けない)',
      `押せた ${ペン.押せた} / 設定も ${ペン.設定も}`)
  } else if (広い.シート || !広い.横の箱) {
    ng('メモ(1280px) … 紙の右に出ていない',
      `シート ${広い.シート} / 横の箱 ${広い.横の箱}`)
  } else {
    ok('メモ … 狭い画面では下から出すシート、広い画面では紙の右'
      + '(メモも書き込むも、押したら設定のシートは残らない)')
  }

  /* ── ★ **シートは「押して離した」ときに閉じる**(第5.427節)──────
       膜は画面ぜんぶを覆うので、**開けたボタンの上にも乗っている。**
       `pointerdown` で閉じると膜はその場で消え、**あとから来る `click` が
       下のボタンに当たって、もう一度開く**(実機でそうなっていた)。
       ここでは**押しただけでは閉じないこと**を measure する ——
       閉じてしまう形に戻すと赤くなる。 */
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 900 } })
    await page.goto(`http://localhost:${PORT}/__bar.html?kind=drill&role=trainer&who=g1`,
      { waitUntil: 'networkidle' })
    await page.waitForTimeout(500)
    const 設定 = await page.$('.lesson-sets')
    if (!設定) {
      ng('シートの閉じ方 … 「設定」のボタンが無い', '見張りが素通りしている')
    } else {
      await 設定.click()
      await page.waitForTimeout(300)
      const 開いた = await page.evaluate(() => !!document.querySelector('.sheet'))
      /* **押しただけ**(離さない)。膜の上を押す */
      await page.evaluate(() => {
        const back = document.querySelector('.sheet-back')
        back?.dispatchEvent(new window.PointerEvent('pointerdown', { bubbles: true, clientX: 10, clientY: 10 }))
      })
      await page.waitForTimeout(250)
      const 押しただけ = await page.evaluate(() => !!document.querySelector('.sheet'))
      /* 離すと閉じる */
      await page.evaluate(() => {
        const back = document.querySelector('.sheet-back')
        back?.dispatchEvent(new window.MouseEvent('click', { bubbles: true, clientX: 10, clientY: 10 }))
      })
      await page.waitForTimeout(250)
      const 離したあと = await page.evaluate(() => !!document.querySelector('.sheet'))
      if (!開いた) ng('シートの閉じ方 … 「設定」を押しても開かない')
      else if (!押しただけ) {
        ng('シートの閉じ方 … 押しただけで閉じている',
          '膜が消えたあとの `click` が、下のボタンに当たってもう一度開く(実機)')
      } else if (離したあと) {
        ng('シートの閉じ方 … 膜を押して離しても閉じない')
      } else {
        ok('シートの閉じ方 … 押しただけでは閉じず、離したときに閉じる(開けたボタンに届かない)')
      }
    }
    await page.close()
  }

  /* ── ★ **暗い配色の紙で、訳に色を持たせない**(第5.428節)──────
       解答(緑)・補足(金)と3色並ぶと、1つの箱の中が賑やかになる。
       **数は書かない** —— 「ふつうの字と同じ色か」「解答・補足とは違うか」
       だけを見る。 */
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 900 } })
    await page.goto(`http://localhost:${PORT}/__bar.html?kind=drill&role=trainer&who=g1`,
      { waitUntil: 'networkidle' })
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
    await page.waitForTimeout(400)
    const c = await page.evaluate(() => {
      const 紙 = document.querySelector('.lesson-sheet')
      if (!紙) return null
      const e = document.createElement('span')
      紙.appendChild(e)
      const 読む = (v) => { e.style.color = v; return window.getComputedStyle(e).color }
      const out = {
        訳: 読む('var(--translate)'),
        解答: 読む('var(--answer)'),
        補足: 読む('var(--note)'),
        字: 読む('var(--text-secondary)'),
      }
      e.remove()
      return out
    })
    await page.close()
    if (!c) ng('紙の色 … 紙が出ていない', '見張りが素通りしている')
    else if (c.訳 !== c.字) {
      ng('紙の色(暗い配色) … 訳が、ふつうの字と違う色になっている',
        `訳 ${c.訳} / 字 ${c.字}`)
    } else if (c.解答 === c.字 || c.補足 === c.字) {
      ng('紙の色(暗い配色) … 解答か補足まで色が抜けている',
        `解答 ${c.解答} / 補足 ${c.補足} / 字 ${c.字}`)
    } else {
      ok(`紙の色(暗い配色) … 訳はふつうの字と同じ(${c.訳})。`
        + `解答(${c.解答})と補足(${c.補足})だけが色を持つ`)
    }
  }
}

/* ══════════════════════════════════════════════════════════════════════
 * **操作盤を開くボタンの絵は、「聴く」の絵と違う**
 * (2026-10-08 実機・利用者の指定・第5.424節)
 *
 *   > 上部バーの再生プレーヤーのオンオフのボタンのアイコンが
 *   > スピーカーになってます。他にアイコンの案はありませんか?
 *
 * **押しても音は出ない。下の操作盤が開くだけ**である。
 * ところがすぐ下に本物のスピーカー(「聴く」)が並ぶので、
 * 同じ絵だと「どちらを押しても同じこと」に見えていた。
 *
 * **絵の名前は書かない。** 2つの絵の中身(SVG)を突き合わせて、
 * **違うこと**だけを見る —— どちらの絵を変えた日も、そのまま付いてくる。
 * **測る相手が居ることも先に確かめる**(片方でも欠けたら赤)。
 * ══════════════════════════════════════════════════════════════════════ */
{
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } })
  await page.goto(`http://localhost:${PORT}/__bar.html?kind=drill&role=trainer&who=g1`,
    { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  const 絵 = await page.evaluate(() => {
    const 開く = document.querySelector('.player-launch svg')
    const 聴く = [...document.querySelectorAll('.lesson-items button')]
      .find((b) => b.querySelector('svg') && /聴く|聞く/.test(b.textContent))
    const 中 = (el) => (el ? el.innerHTML.replace(/\s+/g, '') : null)
    return { 開く: 中(開く), 聴く: 中(聴く?.querySelector('svg')) }
  })
  await page.close()
  if (!絵.開く) {
    ng('操作盤を開くボタンが出ていない', '見張りが素通りしている(390px の文型ドリル)')
  } else if (!絵.聴く) {
    ng('「聴く」のボタンが出ていない', 'くらべる相手が居ない(見張りが素通りしている)')
  } else if (絵.開く === 絵.聴く) {
    ng('操作盤を開くボタンが、「聴く」と同じ絵',
      '押しても音は出ない(下の操作盤が開くだけ)。同じ絵だと見分けられない')
  } else {
    ok('操作盤を開くボタンの絵は、「聴く」の絵と違う(押しても音は出ない)')
  }
}

/* ══════════════════════════════════════════════════════════════════════
 * **シャッフル**(2026-09-30 利用者の指定・第5.325節)
 *
 *   > 文型トレーニングで使うシャッフルボタンを追加してください。
 *   > プレーヤー上段の段落数／発言数表示のすぐ右隣に置き、
 *   > 数とシャッフルをひとまとまりに見せてください。
 *   > 使用中かどうかが見た目で分かる状態表示を付けてください。
 *   > 文型トレーニング以外では表示しないなど、既存の画面や機能に
 *   > 合わせてください。
 *
 * **見るのは6つ。「出る」と「出ない」の両方を見る**(CLAUDE.md)。
 *   ①文型ドリルには出る  ②**本文の教材には出ない**
 *   ③**右のまとまり(シャッフル・くり返し・速さ)の先頭**にいて、
 *     くり返しのすぐ左である(第5.430節で左から右へ移した。
 *     数は左に1人で残る)
 *   ④押すと**問の並びが変わり**、もう一度押すと**もとに戻る**
 *   ⑤名前と押している印が変わる(**言い方は `shuffleSay()` から受け取る**)
 *   ⑥**押しても、まわりの物が動かない**(箱の大きさも、隣の場所も)
 * ══════════════════════════════════════════════════════════════════════ */
{
  /**
   * ★ **混ぜたら、番号も「もとの何番か」に変わるか**(第5.329節)。
   *
   * **「出る」と「出ない」の両方を見る**(CLAUDE.md)——
   *   ・混ぜていないとき … 差し替えていない(`counter(lq)` が返る)
   *   ・混ぜたとき       … **並びとぴったり同じ順**に番号が並ぶ
   *
   * **値を書き写さない。性質で見る。** 「5,2,6…」と書くと、
   * まぐれの並びでしか緑にならない。**並びから求めた番号**と突き合わせる。
   */
  const 混ぜたら番号も動く = (もと, 入, 戻) => {
    const 元の位置 = new Map(もと.並び.split(',').map((k, i) => [k, i + 1]))
    if (!戻.every((x) => x.番号 === もと.番号)) return false
    return 入.every((x) => x.番号
      === x.並び.split(',').map((k) => 元の位置.get(k)).join(','))
  }

  /** その画面の、シャッフルまわり */
  const 見る = (page) => page.evaluate(() => {
    const R = (el) => { const b = el.getBoundingClientRect()
      return { l: Math.round(b.left * 10) / 10, r: Math.round(b.right * 10) / 10,
        w: Math.round(b.width * 10) / 10 } }
    const sh = document.querySelector('.player--dock .shuffle-key')
    const at = document.querySelector('.player--dock .player-at')
    const rep = document.querySelector('.player--dock .repeat-key')
    const 速 = document.querySelector('.player--dock .player-rate-now')
    const 右 = document.querySelector('.player--dock .player-head-r')
    return {
      有る: !!sh,
      名: sh?.getAttribute('aria-label') ?? '',
      押: sh?.getAttribute('aria-pressed') ?? '',
      箱: sh ? R(sh) : null,
      /* ★ **押すもの3つと同じまとまりの中に居るか**(第5.430節)。
           第5.325節では「数のすぐ右(左のまとまり)」だったが、
           利用者の指定でシャッフルを**右のまとまり**へ移した。
           別の入れ物にいると、狭い画面で離れて折り返す */
      同じ組: !!(右 && sh && rep && 速
        && 右.contains(sh) && 右.contains(rep) && 右.contains(速)),
      /* **くり返しのすぐ左。** あいだに押せるものが挟まっていないこと */
      すぐ左: !!(rep && sh && rep.previousElementSibling === sh),
      /* **数は左のまとまりに1人で残っている**(押すものが混ざらない) */
      数は左: !!(at && !右?.contains(at)),
      くり返し: rep ? R(rep) : null,
      並び: [...document.querySelectorAll('.lesson-page:not(.is-closed) li[data-key]')]
        .map((x) => x.getAttribute('data-key')).join(','),
      /* ★ **画面に出ている番号**(2026-09-30 実機・第5.329節)。
           > シャッフルボタンをオンにしていても番号順に進み、
           > シャッフルされません
         **並びは変わっていた。番号だけが 1・2・3… のままだった** ——
         番号は CSS の数え上げ(`counter(lq)`)なので、
         中身をどう並べ替えても振り直される。
         **並びだけを数えていたから、緑のまま見落とした。**
         渡していないときは `counter(lq)` が返る(差し替えていない印) */
      番号: [...document.querySelectorAll('.lesson-page:not(.is-closed) li[data-key]')]
        .map((x) => window.getComputedStyle(x, '::before').content.replace(/"/g, '')).join(','),
    }
  })

  const w = 390
  /* ── ①④⑤⑥ 文型ドリル ────────────────────────────────── */
  {
    const page = await browser.newPage({ viewport: { width: w, height: 900 } })
    await page.goto(`http://localhost:${PORT}/__bar.html?kind=drill&role=trainer&who=g1`,
      { waitUntil: 'networkidle' })
    await page.waitForTimeout(400)
    const a = await 見る(page)
    if (!a.有る) {
      ng('シャッフル … 文型ドリルに出ていない', '`.shuffle-key` が無い')
    } else if (!a.同じ組 || !a.すぐ左 || !a.数は左) {
      ng('シャッフル … くり返し・速さと同じまとまりの先頭に置かれていない',
        `同じまとまり ${a.同じ組} / くり返しのすぐ左 ${a.すぐ左}`
        + ` / 数は左に残っている ${a.数は左}`)
    } else if (a.名 !== shuffleSay(false) || a.押 !== 'false') {
      /* **言い方は1か所から受け取る。** 書き写すと、変えた日に古くなる */
      ng('シャッフル … はじめの名前か押している印が違う', `「${a.名}」/ ${a.押}`)
    } else {
      /* **押して、並びが変わるか。** 4つしかない骨組みでは、
         まぐれで同じ並びになることがある(24 通りに1回)。
         **何度か押して、1度でも変われば良し**とする ——
         「1度で変わること」を求めると、**まぐれで赤くなる** */
      const 見た = []
      for (let n = 0; n < 6; n += 1) {
        await page.click('.player--dock .shuffle-key')
        await page.waitForTimeout(160)
        見た.push(await 見る(page))
      }
      const 入 = 見た.filter((x, i) => i % 2 === 0)    // 奇数回め = シャッフル中
      const 戻 = 見た.filter((x, i) => i % 2 === 1)    // 偶数回め = もとの並び
      const 変わった = 入.some((x) => x.並び !== a.並び)
      const 同じ数 = 入.every((x) => x.並び.split(',').sort().join(',')
        === a.並び.split(',').sort().join(','))
      /* ⑥ **押しても、まわりの物が動かない**(共通ルール)。
           箱の大きさも、となりのくり返しの場所も 1px も変えない */
      const 動いた = 見た.some((x) => !x.箱 || !x.くり返し
        || Math.abs(x.箱.w - a.箱.w) > 0.5
        || Math.abs(x.くり返し.l - a.くり返し.l) > 0.5)
      if (!入.every((x) => x.押 === 'true') || !戻.every((x) => x.押 === 'false')) {
        ng('シャッフル … 押している印が、押すたびに入れ替わらない',
          見た.map((x) => x.押).join(' → '))
      } else if (入[0]?.名 !== shuffleSay(true)) {
        ng('シャッフル … 押したあとの名前が違う', `「${入[0]?.名}」`)
      } else if (!変わった) {
        ng('シャッフル … 3回押しても、問の並びが1度も変わらない', a.並び)
      } else if (!同じ数) {
        ng('シャッフル … 問が増えるか減っている(並べ替えではない)',
          `もと ${a.並び} → ${入.map((x) => x.並び).join(' / ')}`)
      } else if (!戻.every((x) => x.並び === a.並び)) {
        ng('シャッフル … もう一度押しても、もとの並びに戻らない',
          `もと ${a.並び} → ${戻.map((x) => x.並び).join(' / ')}`)
      } else if (動いた) {
        ng('シャッフル … 押すと、箱の大きさかとなりの場所が動く',
          `箱 ${a.箱.w} → ${見た.map((x) => x.箱?.w).join('/')} /`
          + ` くり返しの左 ${a.くり返し.l} → ${見た.map((x) => x.くり返し?.l).join('/')}`)
      } else if (!混ぜたら番号も動く(a, 入, 戻)) {
        ng('シャッフル … 並びは変わっても、画面の番号が 1・2・3… のまま',
          `もと ${a.番号} → ${入.map((x) => x.番号).join(' / ')}`)
      } else {
        ok(`シャッフル … 文型ドリルの右のまとまりの先頭にあり、押すと並びが変わって`
          + `(${a.並び} → ${入.find((x) => x.並び !== a.並び).並び})`
          + `、番号ももとの何番かに変わり`
          + `(${入.find((x) => x.並び !== a.並び).番号})`
          + `、もう一度押すと戻る。押しても 1px も動かない`)
      }
    }
    await page.close()
  }

  /* ── ①' **テスト対策(TOEIC L&R Part 2 の形)**(第5.329節)─────────
        利用者の指摘「TOEIC L&R の PART2 問題の教材ですが、シャッフル
        ボタンが出てきません」。**骨組みにテスト対策の教材が1本も無く、
        `canShuffleKind()` が真になる道のうち exam のほうを
        誰も描いていなかった。**
        設問が「(A) … (B) … (C) …」で見分けが付かない教材なので、
        **番号が変わるかどうかが、唯一の手がかり**である */
  {
    const page = await browser.newPage({ viewport: { width: w, height: 900 } })
    await page.goto(`http://localhost:${PORT}/__bar.html?kind=exam&role=trainer&who=g1`,
      { waitUntil: 'networkidle' })
    await page.waitForTimeout(400)
    const a = await 見る(page)
    if (!a.有る) {
      ng('シャッフル … テスト対策に出ていない', '`.shuffle-key` が無い')
    } else {
      const 見た = []
      for (let n = 0; n < 6; n += 1) {
        await page.click('.player--dock .shuffle-key')
        await page.waitForTimeout(160)
        見た.push(await 見る(page))
      }
      const 入 = 見た.filter((x, i) => i % 2 === 0)
      const 戻 = 見た.filter((x, i) => i % 2 === 1)
      if (!入.some((x) => x.並び !== a.並び)) {
        ng('シャッフル … テスト対策で、問の並びが1度も変わらない', a.並び)
      } else if (!混ぜたら番号も動く(a, 入, 戻)) {
        ng('シャッフル … テスト対策で、画面の番号が 1・2・3… のまま',
          `もと ${a.番号} → ${入.map((x) => x.番号).join(' / ')}`)
      } else {
        ok('シャッフル … テスト対策にも出て、並びと番号がそろって変わる'
          + `(${入.find((x) => x.並び !== a.並び).番号})`)
      }
    }
    await page.close()
  }

  /* ── ② **出ない側。** 本文の教材(会話)には出さない ────────────
        文型トレーニング以外で順を混ぜても意味が無い
        (**効かない操作を見せない**・CLAUDE.md) */
  {
    const page = await browser.newPage({ viewport: { width: w, height: 900 } })
    await page.goto(`http://localhost:${PORT}/__bar.html?role=trainer&who=g1`,
      { waitUntil: 'networkidle' })
    await page.waitForTimeout(400)
    const b = await 見る(page)
    const 黒帯 = await page.$('.player--dock')
    if (!黒帯) {
      ng('シャッフル … 会話の教材で、黒帯そのものが出ていない',
        '出ない側を測れない(この見張りは何も守らない)')
    } else if (b.有る) {
      ng('シャッフル … 文型ドリル以外にも出ている', '会話の教材に `.shuffle-key` がある')
    } else {
      ok('シャッフル … 文型ドリル以外(会話の教材)には出ない')
    }
    await page.close()
  }
}

/* ══════════════════════════════════════════════════════════════════════
   ★ **右の3つを、ひとまとまりに**(第5.430節・2026-10-09 利用者の指定)

     > シャッフルのアイコンを右に寄せて欲しいです。
     > そしてリピートのアイコンとその右の再生スピードと3つを
     > バランスよくまとめた上で大きさのバランスも整えてください。
     > シャッフルの右側の矢印が上下にはみ出してダイナミックなのに対して
     > 丸がない時のリピートが小さく、不揃いに見えるんですよね。
     > リピートの丸を矢印の囲いの中に入れるのはどうでしょうか？
     > シャッフルの矢印の上下へのはみ出しも減らしつつ

   【なぜ不揃いだったか】
   第5.419節では、点を**輪の下**に置く場所を作るために
   **輪だけを 0.74 倍**に縮めていた。そのため「しない」(点が0)のときは
   **点も無く、輪も小さい** —— となりのシャッフルより一回り小さく見えた。
   点を**囲いの中**に入れれば、縮める理由そのものが無くなる。

   【見るのは6つ。**値を書き写さず、2つの絵を突き合わせる**】
     ①輪は、シャッフルと同じくらい**幅いっぱい**に描かれている
       (0.74 倍に戻すと、ここが赤くなる)
     ②点は**囲いの中**にいる(輪の上端より下、下端より上)
     ③シャッフルのほうが**背が低い**(上下のはみ出しを減らした)
     ④輪の大きさは、**4つの段のどれでも同じ**
     ⑤シャッフルとくり返しは、**同じ大きさの箱**
     ⑥**速さの字は、左の数字より大きくない。** 3つのあいだはどこも同じ

   **`getBBox()` ではなく `getBoundingClientRect()` で測る** ——
   前者は**親の `transform` を見ない**ので、輪を 0.74 倍に戻しても
   同じ数が返り、**この見張りは何も守らなくなる。**
   ══════════════════════════════════════════════════════════════════════ */
{
  const w = 390
  const page = await browser.newPage({ viewport: { width: w, height: 900 } })
  await page.goto(`http://localhost:${PORT}/__bar.html?kind=drill&role=trainer&who=g1`,
    { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  const 測る = () => page.evaluate(() => {
    /** 描かれているものを、まとめて囲む箱(画面の座標) */
    const 囲み = (els) => {
      let x1 = Infinity; let y1 = Infinity; let x2 = -Infinity; let y2 = -Infinity
      for (const el of els) {
        const r = el.getBoundingClientRect()
        if (r.width === 0 && r.height === 0) continue
        x1 = Math.min(x1, r.left); y1 = Math.min(y1, r.top)
        x2 = Math.max(x2, r.right); y2 = Math.max(y2, r.bottom)
      }
      if (!Number.isFinite(x1)) return null
      const 丸 = (v) => Math.round(v * 10) / 10
      return { 幅: 丸(x2 - x1), 高: 丸(y2 - y1), 上: 丸(y1), 下: 丸(y2) }
    }
    const R = (el) => {
      const b = el.getBoundingClientRect(); const 丸 = (v) => Math.round(v * 10) / 10
      return { 左: 丸(b.left), 右: 丸(b.right), 幅: 丸(b.width), 高: 丸(b.height) }
    }
    const 字 = (el) => Math.round(parseFloat(window.getComputedStyle(el).fontSize) * 10) / 10
    const sh = document.querySelector('.player--dock .shuffle-key')
    const rep = document.querySelector('.player--dock .repeat-key')
    const 速 = document.querySelector('.player--dock .player-rate-now')
    const 数 = document.querySelector('.player--dock .player-at')
    const 数字 = document.querySelector('.player--dock .player-at-n')
    if (!sh || !rep || !速 || !数 || !数字) return null
    const svg = rep.querySelector('svg')
    return {
      輪: 囲み(svg.querySelectorAll('path')),
      点: 囲み(svg.querySelectorAll('circle')),
      点の数: svg.querySelectorAll('circle').length,
      シャ: 囲み(sh.querySelectorAll('svg > *')),
      箱シャ: R(sh), 箱くり: R(rep), 箱速: R(速), 箱数: R(数),
      速の字: 字(速), 数の字: 字(数字),
    }
  })
  const 見た = []
  for (let i = 0; i < 4; i += 1) {
    const m = await 測る()
    if (!m) break
    見た.push(m)
    await page.click('.player--dock .repeat-key')
    await page.waitForTimeout(140)
  }
  const a = 見た[0]
  const 点あり = 見た.filter((m) => m.点の数 > 0)
  /** 3つのあいだ(シャッフル→くり返し / くり返し→速さ) */
  const 間 = a ? [Math.round((a.箱くり.左 - a.箱シャ.右) * 10) / 10,
    Math.round((a.箱速.左 - a.箱くり.右) * 10) / 10] : []
  if (見た.length < 4 || !a?.輪 || !a?.シャ) {
    ng('右の3つ … 黒帯の絵が測れない', `${見た.length} 通りしか読めなかった`)
  } else if (a.輪.幅 < a.シャ.幅 * 0.9) {
    /* ①**輪を縮めると、ここが赤くなる**(0.74 倍に戻すと 3/4 になる) */
    ng('右の3つ … くり返しの輪が、シャッフルより小さく描かれている',
      `輪 ${a.輪.幅}px / シャッフル ${a.シャ.幅}px`
      + '。**点を囲いの中に入れたので、輪を縮める理由は無い**(第5.430節)')
  } else if (点あり.some((m) => m.点.上 <= m.輪.上 || m.点.下 >= m.輪.下)) {
    /* ②点を輪の外(下)へ戻すと赤くなる */
    const x = 点あり.find((m) => m.点.上 <= m.輪.上 || m.点.下 >= m.輪.下)
    ng('右の3つ … くり返しの点が、矢印の囲いの外に出ている',
      `点 ${x.点.上}〜${x.点.下} / 輪 ${x.輪.上}〜${x.輪.下}`)
  } else if (a.シャ.高 >= a.輪.高) {
    /* ③はみ出しを戻す(縦 1.0)と、2つの高さが同じになって赤くなる */
    ng('右の3つ … シャッフルの上下のはみ出しが、くり返しより小さくなっていない',
      `シャッフル ${a.シャ.高}px / 輪 ${a.輪.高}px`)
  } else if (new Set(見た.map((m) => `${m.輪.幅}x${m.輪.高}`)).size !== 1) {
    /* ④「しない」のときだけ小さい、が戻ってこないように */
    ng('右の3つ … くり返しの輪の大きさが、段によって変わる',
      見た.map((m) => `点${m.点の数}:${m.輪.幅}x${m.輪.高}`).join(' / '))
  } else if (a.箱シャ.幅 !== a.箱くり.幅 || a.箱シャ.高 !== a.箱くり.高) {
    ng('右の3つ … シャッフルとくり返しの、押せる箱の大きさが違う',
      `${a.箱シャ.幅}x${a.箱シャ.高} / ${a.箱くり.幅}x${a.箱くり.高}`)
  } else if (a.速の字 > a.数の字) {
    /* ⑥**めったに触らない速さが、いちばん目立つ**のを止める */
    ng('右の3つ … 速さの字が、左の数字より大きい',
      `速さ ${a.速の字}px / 数字 ${a.数の字}px`)
  } else if (間.some((g) => g < 0) || new Set(間).size !== 1) {
    ng('右の3つ … 3つのあいだが、組によって違う', `${間.join(' / ')} px`)
  } else {
    ok(`右の3つ … 輪は原寸(${a.輪.幅}px・シャッフル ${a.シャ.幅}px)で`
      + `4段とも同じ大きさ。点は囲いの中。シャッフルは ${a.シャ.高}px と`
      + `輪 ${a.輪.高}px より低い。箱は ${a.箱シャ.幅}x${a.箱シャ.高} でそろい、`
      + `速さ ${a.速の字}px ≦ 数字 ${a.数の字}px、あいだは ${間[0]}px`)
  }
  await page.close()
}

/* ══════════════════════════════════════════════════════════════════════
   ★ **ホームを 1行1つに**(第5.431節・2026-10-09 利用者の指定)

     > 情報の見せ方、余白、文字の階層、カードの配置を改善してください
     > 各カードの説明文も不要です
     > 見やすさの観点からいくと1列のBが良さそうです
     > PCでは…720で左寄せ一列で

   【見るのは8つ。**値を書き写さず、カードどうしを突き合わせる**】
     ①**1列**である(同じ行に2つ並ばない)
     ②高さ・左端・幅が、どのカードでも同じ
     ③**絵と矢印の場所**が、どのカードでも同じ
     ④矢印は名前と**重ならない**(名前が長いカードでも)
     ⑤**説明文が1つも無い**
     ⑥組の見出しが出る。**組が1つだけなら出ない**
     ⑦どの組にも入っていないものも、**黙って消えない**
     ⑧**広い画面でも、横に伸び続けない**(1280 と 1680 で同じ幅)

   **「出る」と「出ない」の両方を見る**(CLAUDE.md)——
   ⑥は `?one=1`(組が1つだけ)で、出ないほうも測る。
   ══════════════════════════════════════════════════════════════════════ */
{
  /** その幅のホームを測る */
  const 見る = (page) => page.evaluate(() => {
    const 丸 = (v) => Math.round(v * 10) / 10
    const R = (el) => {
      const b = el.getBoundingClientRect()
      return { 左: 丸(b.left), 右: 丸(b.right), 上: 丸(b.top), 下: 丸(b.bottom),
        幅: 丸(b.width), 高: 丸(b.height) }
    }
    const 箱 = [...document.querySelectorAll('.home-box')]
    return {
      数: 箱.length,
      名: 箱.map((e) => e.querySelector('.home-box-label')?.textContent ?? ''),
      形: 箱.map((e) => {
        const b = R(e)
        const ic = e.querySelector('.home-box-icon')
        const la = e.querySelector('.home-box-label')
        const go = e.querySelector('.home-box-go')
        return {
          幅: b.幅, 高: b.高, 左: b.左, 上: b.上, 下: b.下,
          絵の寄り: ic ? 丸(R(ic).左 - b.左) : null,
          矢の寄り: go ? 丸(b.右 - R(go).右) : null,
          /* **名前と矢印のあいだ。** 負なら重なっている */
          あいだ: (la && go) ? 丸(R(go).左 - R(la).右) : null,
        }
      }),
      説明: document.querySelectorAll('.home-box-desc').length,
      組: [...document.querySelectorAll('.home-group')].map((e) => e.textContent),
      /* **骨組みが渡した数。** 見張りの側に数を書き写さない */
      渡した数: Number(document.querySelector('[data-home-pages]')
        ?.getAttribute('data-home-pages') ?? -1),
      中身の幅: document.querySelector('.home')
        ? 丸(document.querySelector('.home').getBoundingClientRect().width) : null,
      帯の上: document.querySelector('.app-tabs')
        ? 丸(document.querySelector('.app-tabs').getBoundingClientRect().top) : null,
    }
  })
  /** いちばん下まで送る(指で払うのと同じ道) */
  const 下まで = async (page, w, h) => {
    await page.mouse.move(Math.round(w / 2), Math.round(h / 2))
    for (let i = 0; i < 24; i += 1) { await page.mouse.wheel(0, 300) }
    await page.waitForTimeout(350)
  }
  const 開く = async (w, h, 足し = '') => {
    const page = await browser.newPage({ viewport: { width: w, height: h } })
    await page.goto(`http://localhost:${PORT}/__bar.html?screen=home${足し}`,
      { waitUntil: 'networkidle' })
    await page.waitForSelector('.home-box', { timeout: 8000 })
    await page.waitForTimeout(300)
    return page
  }

  /* ── ①〜⑦ 狭い画面(いちばん厳しい 320px)────────────────────── */
  {
    const w = 320; const h = 568
    const page = await 開く(w, h)
    const a = await 見る(page)
    await 下まで(page, w, h)
    const 送った = await 見る(page)
    const 形 = a.形
    const 同じ = (読む) => new Set(形.map(読む)).size === 1
    /** 同じ行に2つ並んでいないか(縦に 4px 以上かぶったら同じ行) */
    const 横並び = 形.some((x, i) => 形.slice(i + 1)
      .some((y) => Math.min(x.下, y.下) - Math.max(x.上, y.上) > 4))
    if (a.数 < 2) {
      ng('ホーム … カードが描かれていない', `${a.数} 枚`)
    } else if (横並び) {
      ng('ホーム … 1列になっていない(同じ行に2つ並んでいる)',
        '利用者の指定は「1列のB」である(第5.431節)')
    } else if (!同じ((x) => x.高) || !同じ((x) => x.左) || !同じ((x) => x.幅)) {
      ng('ホーム … カードの高さ・左端・幅がそろっていない',
        `高 ${[...new Set(形.map((x) => x.高))].join('/')}`
        + ` 左 ${[...new Set(形.map((x) => x.左))].join('/')}`
        + ` 幅 ${[...new Set(形.map((x) => x.幅))].join('/')}`)
    } else if (a.説明 !== 0) {
      /* **矢印の検査より前に置く。** 説明文を戻すと矢印も押し出されるので、
         後ろに置くと**別の名前で赤くなり、読み違える**(赤チェックで分かった) */
      ng('ホーム … カードに説明文が残っている',
        `${a.説明} 本。利用者の指定は「各カードの説明文も不要です」`)
    } else if (!同じ((x) => x.絵の寄り) || !同じ((x) => x.矢の寄り)) {
      ng('ホーム … 絵と矢印の場所が、カードによって違う',
        `絵 ${[...new Set(形.map((x) => x.絵の寄り))].join('/')}`
        + ` 矢 ${[...new Set(形.map((x) => x.矢の寄り))].join('/')}`)
    } else if (形.some((x) => x.あいだ == null || x.あいだ < 0)) {
      ng('ホーム … 矢印が名前に重なっている',
        `いちばん近いところで ${Math.min(...形.map((x) => x.あいだ ?? -999))}px`)
    } else if (a.数 !== a.渡した数) {
      /* **渡したものが、黙って消えていないか。**
         どの組にも入っていないカードは、ここで初めて数に出る */
      ng('ホーム … 渡した行き先のうち、描かれていないものがある',
        `渡した ${a.渡した数} / 描いた ${a.数}`)
    } else if (a.組.length < 2) {
      ng('ホーム … 組の見出しが出ていない', `出たのは ${a.組.length} 個`)
    } else if (送った.形[送った.形.length - 1].下 > (送った.帯の上 ?? Infinity)) {
      ng('ホーム … いちばん下のカードが、下のメニューに隠れている',
        `カードの下 ${送った.形[送った.形.length - 1].下}`
        + ` / 帯の上 ${送った.帯の上}`)
    } else {
      ok(`ホーム(${w}px) … 1列・${a.数} 枚とも高さ ${形[0].高}px で`
        + `左端も幅もそろい、絵は ${形[0].絵の寄り}px・矢印は右から ${形[0].矢の寄り}px。`
        + `説明文は 0 本、組は「${a.組.join(' / ')}」。`
        + `送り切っても、いちばん下のカード(${送った.形[送った.形.length - 1].下})は`
        + `帯(${送った.帯の上})に隠れない`)
    }
    await page.close()
  }

  /* ── ⑥の出ない側 + ⑦ 組が1つだけなら、見出しを出さない ─────── */
  {
    const page = await 開く(390, 844)
    const 全 = await 見る(page)
    await page.close()
    const page2 = await 開く(390, 844, '&one=1')
    const 一 = await 見る(page2)
    await page2.close()
    if (!全.数 || !一.数) {
      ng('ホーム … 組の出し分けを測れない', `${全.数} 枚 / ${一.数} 枚`)
    } else if (一.組.length !== 0) {
      ng('ホーム … 組が1つしか無いのに、見出しが出ている',
        `「${一.組.join(' / ')}」。何も分けていない見出しは置かない`)
    } else if (一.数 !== 一.渡した数) {
      ng('ホーム … 組が1つだけのとき、渡した行き先が描かれていない',
        `渡した ${一.渡した数} / 描いた ${一.数}`)
    } else {
      ok(`ホーム … 組が1つだけのときは見出しを出さない(${一.数} 枚)。`
        + `渡した行き先は、どの組にも入っていないものも含めて全部出る`
        + `(ぜんぶ ${全.数} 枚)`)
    }
  }

  /* ── ⑧ 広い画面でも、1列のまま・書いてある幅で止まる ──────────
       **数を書き写さない。** `styles.css` に**いくつと書いてあるか**を
       先に読み取り、**そのとおりに描かれているか**だけを測る ——
       止め幅を変えても付いてくるし、**消せば読み取れずに赤くなる**
       (CLAUDE.md「名前を先に読み取ってから、その名前で性質を見る」)。

       **`.app` の側にも止め幅がある**ので、「1280 と 1680 で同じ幅」では
       素通りする(赤チェックで分かった —— どちらも 1068px だった)。 */
  {
    const 書いてある = (() => {
      const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8')
      const i = css.indexOf('\n.home {')
      if (i < 0) return null
      const 塊 = css.slice(i, css.indexOf('}', i))
      const m = /max-width:\s*(\d+)px/.exec(塊)
      return m ? Number(m[1]) : null
    })()
    const もっと広 = await 開く(1680, 900)
    const b2 = await 見る(もっと広)
    await もっと広.close()
    if (!b2.形.length) {
      ng('ホーム … 広い画面を測れない')
    } else if (書いてある == null) {
      ng('ホーム … 広い画面で止める幅が、`.home` に書かれていない',
        '止めないと、名前と矢印が 1,000px 以上離れる(第5.431節)')
    } else if (Math.round(b2.中身の幅) !== 書いてある) {
      ng('ホーム … 広い画面で、書いてある幅になっていない',
        `書いてある ${書いてある}px / 描かれた ${b2.中身の幅}px`)
    } else if (b2.形.some((x, i) => b2.形.slice(i + 1)
      .some((y) => Math.min(x.下, y.下) - Math.max(x.上, y.上) > 4))) {
      ng('ホーム … 広い画面で2列になっている', '利用者の指定は「720で左寄せ一列」')
    } else {
      ok(`ホーム(広い画面)… 1列のまま、書いてある ${書いてある}px で止まる`)
    }
  }
}

/* ══════════════════════════════════════════════════════════════════════
   ★ **メニューの並びと、「設定」へ移したもの**(第5.432節・2026-10-09)

     > 教材、ゲスト管理、教材アサイン、単語帳、Quick Response、スピーチ、
     > 講座、集計、の順にして、音楽は「設定」内に移動したいです
     > 「30日講座」は「講座」に変えましょう
     > 「テスト」と「テスト対策」が紛らわしいので「テスト」を
     > 「チェックテスト」に名前を変えてください

   **並びは利用者が決めたものなので、ここに書く。**
   `pages` から読み取ると、並べ替えた日に期待も一緒に動いて
   **緑のまま**になる(第5.337節「見張りが、自分と同じ出どころを見ている」。
   「設定」の中身の一覧を手で並べてあるのと、まったく同じ理由である)。
   ══════════════════════════════════════════════════════════════════════ */
{
  /** 利用者が決めた並び。**ゲスト向けの「今週の宿題」も、消さずに数える** */
  const WANT_ORDER = ['home', 'materials', 'learners', 'assign', 'homework',
    'wordbook', 'qr', 'pronunciation', 'course', 'admin', 'bgm']
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\/|\{\/\*[\s\S]*?\*\/\}/g, '')
  const 塊 = app.slice(app.indexOf('const pages = ['), app.indexOf('].filter(Boolean)'))
  const 並び = [...塊.matchAll(/\bid: (?:HOME_ID|'([a-z]+)')/g)]
    .map((m) => m[1] ?? 'home')
  if (並び.join(',') !== WANT_ORDER.join(',')) {
    ng('メニュー … 並びが利用者の指定どおりでない',
      `いま ${並び.join(' / ')}\n    ほしい ${WANT_ORDER.join(' / ')}`)
  } else if (!/id: 'bgm',[\s\S]{0,120}?inSettings: true/.test(塊)) {
    /* **「設定」の中へ移した印。** 一覧からは消さない ——
       消すと上の帯が名前も絵も引けなくなる(第5.432節) */
    ng('メニュー … 「音楽」が「設定」の中に移っていない',
      '`inSettings: true` が付いていない')
  } else if (/inSettings: true/.test(塊.replace(/id: 'bgm',[\s\S]{0,120}?inSettings: true/, ''))) {
    ng('メニュー … 「設定」の中へ移したものが、音楽のほかにもある',
      '移したものが増えたら、この見張りに書き足す')
  } else if (!/const 並べる = pages\.filter\(\(p\) => !p\.inSettings\)/.test(app)) {
    ng('メニュー … 「設定」の中のものを飛ばす場所が、1か所になっていない')
  } else if (!/navItems = jobBadge[\s\S]{0,400}?: 並べる/.test(app)
    || !/<AppHome pages=\{並べる\}/.test(app)) {
    /* **メニューとホームの両方**が、その1か所を通っているか。
       片方だけだと、もう片方に音楽が残る(「出る」と「出ない」の両方) */
    ng('メニュー … メニューとホームの両方が、同じ一覧を見ていない')
  } else {
    ok(`メニュー … 並びは ${並び.join(' / ')}。`
      + '「音楽」だけが「設定」の中で、メニューもホームも同じ一覧を見る')
  }

  /* ── 「チェックテスト」と「テスト対策」が、見分けられるか ───────
       **文字を書き写さない。** 2つの呼び名を突き合わせて、
       **どちらも、もう片方を含まない**ことだけを見る ——
       「テスト」に戻すと「テスト対策」に含まれてしまい、赤くなる */
  {
    const a = kindLabel('test')
    const b = kindLabel('exam')
    if (!a || !b) {
      ng('教材の種類 … 「テスト」か「テスト対策」の呼び名が無い', `${a} / ${b}`)
    } else if (a.includes(b) || b.includes(a)) {
      ng('教材の種類 … 2つの呼び名が、片方にもう片方を含んでいる',
        `「${a}」と「${b}」。利用者の指定は「紛らわしいので名前を変えて」`)
    } else {
      ok(`教材の種類 … 「${a}」と「${b}」は、どちらも相手を含まない`)
    }
  }
}

/* ══════════════════════════════════════════════════════════════════════
   ★ **正解の聞き流し**(第5.334節・2026-10-01 利用者の指定)

     > その上で、応答問題には正解の聞き流しモードを作ります。
     > 問題順をシャッフルもできる仕様です。

   **素の関数だけ見ると、画面が渡していなくても緑になる**(第5.330節で
   踏んだ)。`npm run test:response` が算段を数えているので、**ここは
   「本物の入り口から1回開く」ほうを受け持つ** ——
   押せるか・開くか・題が出るか・混ぜる欄があるか。

   **「出る」と「出ない」の両方を見る**(CLAUDE.md)——
   応答問題にだけ出て、**ほかの教材には1つも出ない。**
   ══════════════════════════════════════════════════════════════════════ */
{
  /* ★ **札を書き写さない**(第5.368節)。
       第5.355節で「正解を聞き流す」→「**応答を聞き流す**」に変えたのに、
       **ここだけ古い札のまま**だった ——
       **画面は1ミリも壊れていないのに、この見張りが2本赤いまま**だった
       (CLAUDE.md「式も、関数の名前も書き写さない」。4度めである)。
       **画面から読み取る** —— 次に呼び名が変わった日も付いてくる。
       目じるしは `answerRadio` を押すボタン(`listenAnswers`)。 */
  const lv = readFileSync(
    new URL('../src/components/LessonView.jsx', import.meta.url), 'utf8')
  const 名 = /onClick=\{listenAnswers\}[\s\S]*?<SpeakerIcon \/>([^<\n{]+)/
    .exec(lv)?.[1]?.trim() ?? ''
  if (!名) ng('正解の聞き流し … 画面から札を読み取れなかった')
  /* ── ① **出る側。** 応答問題で押せて、聞き流しが開く ───────────── */
  for (const w of [1280, 390]) {
    const page = await browser.newPage({ viewport: { width: w, height: 820 } })
    await page.goto(`http://localhost:${PORT}/__bar.html?kind=response&role=trainer&who=g1`,
      { waitUntil: 'networkidle' })
    await page.waitForTimeout(400)
    const 札 = await page.evaluate(() => [...document.querySelectorAll('.practice-row button')]
      .map((b) => b.textContent.trim()))
    /* ページに出ている問数(「リスニング + 理解(4 問)」の 4)。
       **ここも書き写さない** —— 骨組みの教材から読む */
    const ページの問数 = await page.evaluate(() => Number(
      document.body.innerText.match(/[(（]\s*(\d+)\s*問\s*[)）]/)?.[1] ?? 0,
    ))
    if (!札.includes(名)) {
      ng(`正解の聞き流し ${w}px … 応答問題にボタンが出ていない`, JSON.stringify(札))
      await page.close()
      continue
    }
    if (!(ページの問数 > 0)) {
      ng(`正解の聞き流し ${w}px … ページの問数が読めない`, '比べる相手が無い')
      await page.close()
      continue
    }
    await page.getByRole('button', { name: new RegExp(名) }).click()
    await page.waitForTimeout(900)
    /* **題は、聞きながら何を聞いているか分かるように**(第5.264節)。
       **問数も、英文の無い問を落としたあとの数**でなければならない ——
       そこを落とさないと、空の英文で窓口を呼ぶ */
    const 中 = await page.evaluate(() => {
      /* **いちばん後ろの題**(聞き流しのもの)。ページ送りの
         「1 / 1」を拾わないよう、聞き流しの題だけを見る */
      const hs = [...document.querySelectorAll('.drill-head')]
      const h = hs[hs.length - 1]
      return {
        題: h?.innerText?.replace(/\n+/g, ' / ') ?? '',
        とめる: [...document.querySelectorAll('button')]
          .some((b) => b.offsetParent && /とめる|聞き流しをやめる/.test(b.textContent)),
      }
    })
    /* **値を書き写さない。性質で見る**(CLAUDE.md)——
       骨組みの応答問題には**解答の無い問が1つ混ざっている**ので、
       聞き流しの問数は**ページの問数より必ず少なく、0 より多い。**
       「3 問」と書くと、問を1つ足した日に見張りだけが古くなる。

       **読むのは斜線の右(ぜんぶで何問か)。** 左(いま何問目)は
       鳴り進むと動くので、**そちらを見ると 4 問のままでも通ってしまう。**

       **ここが守るのは「渡しているのが、ページの問ぜんぶではない」**
       ことである。**空の解答を落とすこと自体は、ここでは測れない** ——
       聞き流しの側(`radioList`)が**英文の無い行をどのみち落とす**ので、
       `responseAnswers()` の `continue` を外しても緑のままだった(実測)。
       **ほかの見張りに吸われる**という、あの形である(CLAUDE.md)。
       あちらは `npm run test:response` が名指しで数えている */
    const 聞 = Number(中.題.match(/(\d+)\s*\/\s*(\d+)\s*$/)?.[2] ?? 0)
    if (!中.とめる) {
      ng(`正解の聞き流し ${w}px … 押しても聞き流しが開かない`, 中.題 || '(題も無い)')
    } else if (!/正解/.test(中.題)) {
      ng(`正解の聞き流し ${w}px … 題に「正解」が入っていない`, 中.題)
    } else if (!(聞 > 0 && 聞 < ページの問数)) {
      ng(`正解の聞き流し ${w}px … 流れているのが、ページの問ぜんぶになっている`,
        `聞き流し ${聞} 問 / ページ ${ページの問数} 問`)
    } else {
      ok(`正解の聞き流し ${w}px … 押すと開き、題と問数が出る(${中.題}`
        + `・ページの ${ページの問数} 問に対して、正解だけの ${聞} 問)`)
    }
    /* ── ② **問題順のシャッフル**(利用者の指定)。
             **設定の中に「ランダム」がある**こと。
             **混ぜ方を2つ持たない**ので、ここは聞き流しが元から持つ欄である */
    const 設定 = page.locator('button[aria-label="設定"]').last()
    await 設定.click()
    await page.waitForTimeout(500)
    const 一覧 = await page.evaluate(() => [...document.querySelectorAll('select')]
      .filter((e) => e.offsetParent !== null)
      .map((s2) => [...s2.options].map((o) => o.textContent.trim()).join('/')))
    const 並べ方 = 一覧.find((x) => /ランダム/.test(x))
    if (!並べ方) {
      ng(`正解の聞き流し ${w}px … 問題順を混ぜる欄が無い`, JSON.stringify(一覧))
    } else {
      ok(`正解の聞き流し ${w}px … 問題順を混ぜられる(${並べ方})`)
    }
    await page.close()
  }

  /* ── ②' **テスト対策の応答系にも出る**(第5.355節・利用者の指定)。

           > **応答問題、VERSANT PART Aなど**、応答系の問題の聞き流しが、
           > 解答の正解の選択肢が読み上げられるだけになっています

         骨組みの `kind=exam` は **TOEIC L&R Part 2**(まさに応答系)である。
         **ここを「出ない側」に入れていたのは、こちらの間違いだった** ——
         古い札(`正解を聞き流す`)で探していたので
         **「出ていない」と読めて、緑のままだった**(第5.368節で札を
         画面から読むようにして、初めて表に出た)。

         **判断は `asksAndReplies()` 1か所**である ——
         聞いて返す段を持つ教材には出て、持たない教材には出ない。 */
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } })
    await page.goto(`http://localhost:${PORT}/__bar.html?role=trainer&who=g1&kind=exam`,
      { waitUntil: 'networkidle' })
    await page.waitForTimeout(400)
    const 札 = await page.evaluate(() => [...document.querySelectorAll('.practice-row button')]
      .map((b) => b.textContent.trim()))
    if (札.includes(名)) ok(`正解の聞き流し … 応答系のテスト対策にも出る(${札.join(' / ')})`)
    else ng('正解の聞き流し … 応答系のテスト対策に出ていない', JSON.stringify(札))
    await page.close()
  }

  /* ── ③ **出ない側。** 聞いて返す段を持たない教材には1つも出ない
           (効かない操作を見せない・CLAUDE.md)。
           **ここを見ないと、どの教材にも出す形に書き換えても緑のまま**である */
  for (const [名前, qs] of [
    ['会話', ''], ['文型ドリル', 'kind=drill'],
    ['スピーチ', 'kind=speech'],
  ]) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } })
    await page.goto(`http://localhost:${PORT}/__bar.html?role=trainer&who=g1&${qs}`,
      { waitUntil: 'networkidle' })
    await page.waitForTimeout(400)
    const 行 = await page.$('.practice-row')
    const 札 = await page.evaluate(() => [...document.querySelectorAll('.practice-row button')]
      .map((b) => b.textContent.trim()))
    if (!行) {
      ng(`正解の聞き流し … ${名前} で練習の行そのものが出ていない`,
        '出ない側を測れない(この見張りは何も守らない)')
    } else if (札.includes(名)) {
      ng(`正解の聞き流し … ${名前} にも出ている`, JSON.stringify(札))
    } else {
      ok(`正解の聞き流し … ${名前} には出ない(${札.join(' / ')})`)
    }
    await page.close()
  }
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
      /* ★ **送るのは、音声プレーヤーのいちばん外側のボタン**(⏭⏭)。
             2026-09-30・第5.321節で、集中モードの帯は紙の黒帯そのものに
             なった。**錠剤(`.listenpill`)はもう無い。**
             読み上げが使えない画面(Supabase 未設定)だけは錠剤なので、
             **両方さがす** —— 片方だけ見ると、送れずに1枚で止まり、
             「語が落ちている」という**嘘の赤**が出る(実際に出た)。 */
      const keys = await page.$$('.focus-bar .player-keys .player-key-btn')
      let next = keys.length ? keys[keys.length - 1] : null
      if (!next) {
        const pills = await page.$$('.focus-mid .listenpill')
        next = pills.length
          ? await pills[pills.length - 1].$('.listenpill-arrow:last-child') : null
      }
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
    } else if (home.説明 !== 0) {
      /* ★ **裏返した**(第5.431節・2026-10-09 利用者の指定「各カードの
           説明文も不要です」)。もとは「どの箱にも説明が在るか」を見ていた ——
           **決まりが変わったら、見張りも裏返す**(古い見張りを残すと、
           直した日に赤くなって、直したほうを疑うことになる) */
      ng(`ホーム ${w}px … 箱に説明文が残っている(${home.説明} 本)`,
        '利用者の指定は「各カードの説明文も不要です」(第5.431節)')
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
    /* **1つの画面だけでは足りない。** 絵を1つに決め打ちしても、
       その画面では合ってしまう。だから**別の画面へ2つ移って**突き合わせる。

       ★ **ホームでは絵を出さない**(第5.431節・2026-10-09 利用者の指定
         「『ホーム』の文字とホームアイコンが重複して見えないよう、
          どちらを主役にするか整理してください」)。
       だから**開いた瞬間(ホーム)は「出ない側」**として見て、
       **絵そのものは、ホーム以外の2画面で突き合わせる。** */
    const 移る = async (名) => {
      await page.evaluate(() => {
        const burger = document.querySelector('.app-topbar .nav-burger')
        if (!document.querySelector('.app-nav-item')?.offsetParent) burger.click()
      })
      await page.waitForTimeout(150)
      const いけた = await page.evaluate((n) => {
        const x = [...document.querySelectorAll('.app-nav-item')]
          .find((e) => e.querySelector('.app-nav-label').textContent.trim() === n)
        if (!x) return false
        x.click()
        return true
      }, 名)
      await page.waitForTimeout(200)
      return いけた
    }
    const 移った = await 移る('単語帳')
    const look2 = 移った ? await 測る() : look
    const 移った3 = await 移る('Quick Response')
    const look3 = 移った3 ? await 測る() : look2
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
    } else if (look.絵) {
      /* **出ない側。** ホームは字だけである(第5.431節) */
      ng(`${どこ} … ホームなのに、いまいる画面の絵が出ている`,
        '「ホーム」の字とホームの絵が二重になる(第5.431節)')
    } else if (!look2.絵 || look2.絵 !== look2.メニューの絵) {
      ng(`${どこ} … 「${look2.名}」でメニューと違う絵が出ている`,
        '`pages` から引いたものをそのまま渡す(対応表を2つ持たない)')
    } else if (!look3.絵 || look3.絵 !== look3.メニューの絵) {
      ng(`${どこ} … 「${look3.名}」でメニューと違う絵が出ている`,
        '画面を移っても、メニューと同じ絵でなければならない'
        + '(1つの画面だけ見ると、絵を決め打ちしても緑になる)')
    } else if (look2.絵 === look3.絵) {
      ng(`${どこ} … 画面を移っても絵が変わらない(${look2.名} / ${look3.名})`,
        'いまいる画面の絵を出していない')
    } else {
      ok(`${どこ} … 白い(${look.地})・影あり・ホーム(${look.名})は字だけ・`
        + `「${look2.名}」「${look3.名}」はメニューと同じ絵`)
    }

    /* ── ★ **RIZAP のマークと ☰ は、端から同じだけ内側にいる**
           (2026-10-08 実機・利用者の指定・第5.422節)

             > 右上の RIZAP のロゴをもう少し内側に寄せられないですか?
             > 左のハンバーガーと左端の距離感とバランスを合わせてください

           **☰ は押せるので、絵のまわりに押しやすい余白を持っている。**
           ロゴは押せないので余白が無く、放っておくと**ロゴだけが外**に出る。

           **数は書かない。** 左右をそれぞれ実測して、**同じかどうか**
           だけを見る —— ☰ のボタンの大きさを変えた日も付いてくる。 */
    {
      const 端 = await page.evaluate(() => {
        const bar = document.querySelector('.app-topbar')
        const 絵 = bar?.querySelector('.nav-burger svg')
        const logo = bar?.querySelector('.rizap-logo')
        if (!bar || !絵 || !logo) return null
        const B = bar.getBoundingClientRect()
        return {
          左: Math.round((絵.getBoundingClientRect().left - B.left) * 10) / 10,
          右: Math.round((B.right - logo.getBoundingClientRect().right) * 10) / 10,
        }
      })
      if (!端) {
        ng(`上の帯 ${w}px … ☰ かマークが出ていない`, '見張りが素通りしている')
      } else if (Math.abs(端.左 - 端.右) > 1) {
        ng(`上の帯 ${w}px … ☰ とマークの端からの距離が違う`,
          `☰ の絵 ${端.左}px / マーク ${端.右}px`)
      } else {
        ok(`上の帯 ${w}px … ☰ の絵とマークが、端から同じだけ内側(${端.左}px)`)
      }
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

  /* ══ **メニューの「設定」は、画面が低くても必ず見える**(第5.317節)══
       2026-09-30 実機・利用者の指摘(Safari と Chrome の写真を並べて)。

       > Safariの方が明らかに全てがデカいままじゃないですか。
       > 窮屈に感じて勉強のする気が起きません。

     **写真でいちばん困っていたのはここ**である。Safari はページの
     ズームのぶん CSS 上の画面が狭く・低くなるので、メニューの
     **いちばん下の「設定」が画面から出ていた**(実測 44px)。

       | 窓 | 直す前の「設定」 | 見えたか |
       |---|---|---|
       | Chrome 相当 393×632 | 567〜632 | 見えていた |
       | **Safari 相当 362×581** | 560〜625 | **はみ出す** |
       | Safari 125% 相当 314×520 | 560〜625 | はみ出す |

     送れば出てくるのだが、**下に何かあることが画面から分からない。**
     メニューを「頭・一覧・設定」の3段にし、**送るのは一覧だけ**にした。

     **低い窓で測る。** 幅だけ変えても出てこない —— この不具合は
     **高さ**で決まる(「無ければ素通り」する形の検証を書かない・CLAUDE.md)。 */
  {
    const nav = await browser.newPage()
    for (const [名, w, h] of [
      ['Chrome 相当', 393, 632],
      ['Safari 相当', 362, 581],
      ['Safari 125% 相当', 314, 520],
      /* **いちばん低いところも見る。** ここが素通りすると、
         「3段にした」ことを何も守っていない */
      ['低い窓', 360, 420],
    ]) {
      await nav.setViewportSize({ width: w, height: h })
      await nav.goto(`http://localhost:${PORT2}/__shell.html`, { waitUntil: 'networkidle' })
      await nav.waitForTimeout(400)
      const 開いた = await nav.evaluate(() => {
        const b = [...document.querySelectorAll('button')]
          .find((x) => /メニュー/.test(x.getAttribute('aria-label') || ''))
        if (!b) return false
        b.click(); return true
      })
      await nav.waitForTimeout(350)
      const m = await nav.evaluate(() => {
        const el = document.querySelector('.app-nav')
        const foot = el?.querySelector('.app-nav-foot')
        const list = el?.querySelector('.app-nav-list')
        if (!el || !foot || !list) return null
        const f = foot.getBoundingClientRect()
        const l = list.getBoundingClientRect()
        return {
          設定の下端: Math.round(f.bottom),
          設定の上端: Math.round(f.top),
          窓の高さ: window.innerHeight,
          /* **一覧だけが送れる**(外側は動かさない) */
          外が動く: Math.round(el.scrollHeight) > Math.round(el.clientHeight) + 1,
          一覧が送れる: Math.round(list.scrollHeight) > Math.round(list.clientHeight) + 1,
          一覧の高さ: Math.round(l.height),
          行の数: el.querySelectorAll('.app-nav-item').length,
        }
      })
      if (!開いた) { ng(`メニュー ${名} … ☰ が見つからない`); continue }
      if (!m) { ng(`メニュー ${名}(${w}×${h}) … メニューか「設定」が無い`); continue }
      if (!m.行の数) ng(`メニュー ${名} … 行き先が1つも無い`, '見張りが何もしていない')
      else if (m.設定の下端 > m.窓の高さ + 0.5) {
        ng(`メニュー ${名}(${w}×${h}) … 「設定」が画面からはみ出している`,
          `下端 ${m.設定の下端} > 窓 ${m.窓の高さ}(${m.設定の下端 - m.窓の高さ}px 出ている)`)
      } else if (m.設定の上端 < -0.5) {
        ng(`メニュー ${名}(${w}×${h}) … 「設定」が画面より上へ出ている`, `${m.設定の上端}px`)
      } else if (m.外が動く) {
        ng(`メニュー ${名}(${w}×${h}) … メニューまるごとが送れてしまう`,
          '送るのは一覧だけ。外が動くと「設定」も一緒に流れる')
      } else {
        ok(`メニュー ${名}(${w}×${h}) … 行き先 ${m.行の数} 個・`
          + `「設定」は ${m.設定の上端}〜${m.設定の下端}(窓 ${m.窓の高さ})で見えている`
          + `${m.一覧が送れる ? '・一覧だけ送れる' : ''}`)
      }
    }
    await nav.close()
  }


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
  /** ★ ホーム(一覧の画面)の帯の高さ。**練習中と見くらべる**(第5.417節) */
  let ホームの帯 = null
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
        const lr = lab.getBoundingClientRect()
        return {
          名: lab.textContent,
          高: Math.round(t.getBoundingClientRect().height),
          切れ: lab.scrollWidth > lab.clientWidth + 1,
          /* ★ **ホーム(一覧の画面)では、札は出たまま**(第5.417節・
               2026-10-08 利用者の指定「ホーム画面では元の文字ありのメニュー」)。
               細くするのは**練習中だけ**である */
          札: lr.width > 1 && lr.height > 1,
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
        札なし: tabs.filter((t) => !t.札).map((t) => t.名),
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
    } else if (m.札なし.length) {
      /* ★ **ホームでは、札を消さない**(第5.417節・2026-10-08 利用者の指定)。
           細くするのは練習中だけ —— ここで消えていたら、やりすぎである */
      ng(`${どこ} … ホームなのに札が出ていない(${m.札なし.join(' / ')})`,
        '細くするのは練習中(`.focus`)だけである')
    } else if (m.低い.length) {
      ng(`${どこ} … 押せる大きさを割っている(${m.低い.join(' / ')})`)
    } else if (!m.印 || /rgba?\(0, 0, 0, 0\)/.test(m.印.地) || m.印.太さ !== '700') {
      ng(`${どこ} … いまいる画面の印が弱い(${JSON.stringify(m.印)})`,
        '色だけに頼らない —— 地色・文字色・太字・上の帯の4つで示す')
    } else if (m.はみ出し) {
      ng(`${どこ} … 横にはみ出している`)
    } else {
      /* ★ **練習中と見くらべるために、ホームの高さを控えておく**(第5.417節)。
           「練習中のほうが低い」は、**2つを比べないと測れない** ——
           数を書き写すと、帯の作りを変えた日に意味を失う */
      if (w === 390 && who === 'ゲスト') ホームの帯 = m.丈
      ok(`${どこ} … 4つとも出て切れない(帯 ${m.丈}px・印は「${m.印.名}」)`)
    }
  }

  /* ★ **4つのタブが、そろっているか**(第5.401節・2026-10-06 利用者の指定)。

       > 「Quick Response」のように2行になるラベルがあっても、
       > 各タブの内容が上下にずれて見えないよう、ラベル領域の高さを統一する
       > 各タブの間に、控えめな縦の区切り線を設ける

     **320px で測る** —— ここで「Quick Response」が2行になる。
     390px では折り返さないので、**そこだけで測ると素通りする**
     (CLAUDE.md「いちばん危ない形を、検証の中に必ず1つ置く」)。 */
  for (const w of [320, 390]) {
    await page.setViewportSize({ width: w, height: 844 })
    await page.goto(`http://localhost:${PORT}/__bar.html?screen=tabs`,
      { waitUntil: 'networkidle' })
    await page.waitForSelector('.app-tabs')
    await page.waitForTimeout(200)
    /* ★ **本文の下に取ってある余白が、帯より狭くなっていないか**(第5.401節)。
         `.app-shell.has-tabs .app` の `padding-bottom` は**決め打ち**なので、
         帯が高くなった日に**いちばん下の行が帯の下に隠れる。**
         CLAUDE.md「値を書き写さない。性質で見る」—— **測って比べる** */
    const 余白 = await page.evaluate(() => {
      const bar = document.querySelector('.app-tabs')
      const 本文 = document.querySelector('.app-shell.has-tabs .app')
      if (!bar || !本文) return null
      return { 帯: Math.round(bar.getBoundingClientRect().height),
               余白: Math.round(parseFloat(window.getComputedStyle(本文).paddingBottom)) }
    })
    if (余白 && 余白.余白 < 余白.帯) {
      ng(`下の行き先 ${w}px … 本文の下余白が帯より狭い`,
        `帯 ${余白.帯}px / 余白 ${余白.余白}px —— いちばん下の行が隠れる`)
    } else if (余白) {
      ok(`下の行き先 ${w}px … 本文の下余白が帯を覆っている(帯 ${余白.帯}px / 余白 ${余白.余白}px)`)
    }

    const m = await page.evaluate(() => {
      const 丸 = (n) => Math.round(n * 10) / 10
      const 帯 = document.querySelector('.app-tabs').getBoundingClientRect()
      return [...document.querySelectorAll('.app-tab')].map((x) => {
        const r = x.getBoundingClientRect()
        const ic = x.querySelector('.app-tab-icon').getBoundingClientRect()
        /* ★ **部品そのものも持っておく**(第5.401節)。
             `getComputedStyle` に渡せるのは**部品**であって、
             測った四角(`DOMRect`)ではない —— 渡すとその場で落ちる */
        const lbEl = x.querySelector('.app-tab-label')
        const lb = lbEl.getBoundingClientRect()
        /* ★ **字そのものの四角を測る**(第5.402節)。
             札の箱は2行ぶん取ってあるので、**箱を測っても字の位置は分からない** */
        const rg = document.createRange(); rg.selectNodeContents(lbEl)
        const 字四角 = rg.getBoundingClientRect()
        /* ★ **区切りは飾り(`::before`)に移した**(第5.402節)。
             `border-left` は場所を取るためだけに残してあるので、
             **色を見ても、もう何も分からない** */
        const 飾 = window.getComputedStyle(x, '::before')
        /* ★ **語ごとに1行になっているか**(第5.407節・2026-10-07 利用者の指定)。

             > 「Quick」と「Response」の2行に折り返し、中央揃えで表示する
             > …文字がはみ出したり「…」で省略されたりしない

           **名前は空白で区切って、語ごとの箱に入れてある**(`AppTabs.jsx`)。
           ここでは**その箱を1つずつ**測る ——
           ・語が2つなら2行になっているか(折り返しが起きているか)
           ・**どの語も1行に収まっているか**(語の途中で切れていないか)
           ・はみ出していないか・「…」で消えていないか
           **数は1つも書かない。** 語の数も行の高さも、描かれたものから読む */
        const 語箱 = [...x.querySelectorAll('.app-tab-word')]
        const 行高 = parseFloat(window.getComputedStyle(lbEl).lineHeight)
        const 語 = 語箱.map((e) => {
          const g = document.createRange(); g.selectNodeContents(e)
          const gr = g.getBoundingClientRect()
          return {
            字: e.textContent,
            行: Math.max(1, Math.round(gr.height / Math.max(1, 行高))),
          }
        })
        return {
          名: x.textContent.trim(),
          語,
          /* **「…」で消していないか。** `clip` 以外なら、どこかで切っている */
          省略: window.getComputedStyle(lbEl).textOverflow,
          幅: 丸(r.width),
          絵: 丸(ic.top),
          字: 丸(lb.top),
          /* ★ **札の箱ではなく、字を数える**(第5.402節)。
               箱は2行ぶん取ってあるので、**箱を割ると いつも 2 になり**、
               「320px で2行が無ければ赤」が**1度も働いていなかった** */
          行数: Math.round(字四角.height / parseFloat(window.getComputedStyle(lbEl).lineHeight)),
          行高: parseFloat(window.getComputedStyle(lbEl).lineHeight),
          はみ出し: lb.left < r.left - 0.5 || lb.right > r.right + 0.5,
          /* 絵の上と、字の下。**この2つがそろっていれば、まん中にある** */
          上: 丸(ic.top - 帯.top),
          下: 丸(帯.bottom - 字四角.bottom),
          /* ★ **絵そのものと、字の、横のまん中**(第5.403節)。
               `.app-tab-icon` の箱ではなく **`svg` を測る** ——
               `.icon` の `margin-right` は**箱の中**に入るので、
               箱はまん中にあるのに**絵だけが左へ寄る** */
          絵中心: (() => { const g = x.querySelector('.app-tab-icon svg')
            return g ? 丸((g.getBoundingClientRect().left
              + g.getBoundingClientRect().right) / 2) : null })(),
          字中心: 丸((字四角.left + 字四角.right) / 2),
          タブ高: 丸(r.height),
          区切り: 飾.content === 'none' ? null : {
            高さ: 丸(parseFloat(飾.height) || 0),
            色: 飾.backgroundColor,
          },
        }
      })
    })
    const ちがう = (k) => new Set(m.map((x) => x[k])).size !== 1
    const 透ける = (c) => /rgba?\([^)]*,\s*0\s*\)/.test(c)
    /* ★ **空白を含む名前の札**(第5.407節)。いまは「Quick Response」だけだが、
         **名前を書き写さない** —— 語の数で選ぶので、増えても減ってもついてくる。
         第5.401節の `折り返した`(字の四角の高さで数える)は、ここへ寄せた ——
         **語の箱そのものを数えるほうが細かい**(どの語が何行かまで分かる) */
    const 多語 = m.find((x) => x.語.length >= 2)
    const どこ = `下の行き先のそろい ${w}px`
    if (m.length !== 4) ng(`${どこ} … タブが4つではない(${m.length})`)
    else if (ちがう('幅')) {
      ng(`${どこ} … 幅がそろっていない`, m.map((x) => `${x.名} ${x.幅}`).join(' / '))
    } else if (ちがう('絵')) {
      ng(`${どこ} … 絵の高さがそろっていない(折り返しで上下にずれている)`,
        m.map((x) => `${x.名} ${x.絵}`).join(' / '))
    } else if (ちがう('字')) {
      ng(`${どこ} … ラベルの1行目がそろっていない`,
        m.map((x) => `${x.名} ${x.字}`).join(' / '))
    } else if (m.some((x) => x.はみ出し)) {
      ng(`${どこ} … ラベルが横にはみ出している`)
    } else if (m[0].区切り) {
      ng(`${どこ} … 1つめにも縦線が付いている`, 'いちばん左に、どこも分けていない線が出る')
    } else if (m.slice(1).some((x) => !x.区切り || 透ける(x.区切り.色))) {
      ng(`${どこ} … タブのあいだに縦の区切りが無い`,
        m.slice(1).map((x) => `${x.名} ${x.区切り ? x.区切り.色 : 'なし'}`).join(' / '))
    } else if (m.slice(1).some((x) => x.区切り.高さ > x.タブ高 * 0.8)) {
      /* ★ **上下いっぱいに伸ばさない**(第5.402節・利用者の指定)。
           **割合で見る** —— px を書くと、帯の高さを変えた日に意味を失う */
      ng(`${どこ} … 区切りが上下いっぱいに伸びている`,
        m.slice(1).map((x) => `${x.名} ${x.区切り.高さ} / タブ ${x.タブ高}`).join(' / '))
    } else if (m.slice(1).some((x) => x.区切り.高さ < x.タブ高 * 0.2)) {
      /* **短すぎても困る。** 消えたのと変わらない */
      ng(`${どこ} … 区切りが短すぎて見えない`,
        m.slice(1).map((x) => `${x.名} ${x.区切り.高さ} / タブ ${x.タブ高}`).join(' / '))
    } else if (m.some((x) => x.絵中心 == null)) {
      ng(`${どこ} … 絵(svg)が描かれていない`, '測る相手が無いので、下の見張りが素通りする')
    } else if (m.some((x) => Math.abs(x.絵中心 - x.字中心) >= 1)) {
      /* ★ **絵と字が、同じ縦の線の上にあるか**(第5.403節・利用者の指定)。

           > 教材と単語帳の中央が相変わらずアイコンとズレてます

         `.icon` は「絵のうしろに文字が続く」ための `margin-right` を
         持っている。**絵の下に字を置く形では使われないのに場所だけ取り**、
         絵が半分ぶん左へずれる(実測 3.8px)。これで4度目である */
      ng(`${どこ} … 絵と字の横のまん中がそろっていない`,
        m.map((x) => `${x.名} 絵 ${x.絵中心} / 字 ${x.字中心}`).join(' / '))
    } else if (m.some((x) => Math.abs(x.上 - x.下) > x.行高 / 2)) {
      /* ★ **絵と字の組が、帯のまん中にあるか**(第5.402節・利用者の指定)。

           > 教材、単語帳、今日の宿題の文字が中央からズレています

         札の箱は2行ぶん取ってあるので、**字を上にそろえると
         1行の札の下に1行ぶんの空きがまるまる残る。**
         **ものさしは行の高さの半分** —— px を書き写さない */
      ng(`${どこ} … 絵と字の組が、帯のまん中からずれている`,
        m.map((x) => `${x.名} 上 ${x.上} / 下 ${x.下}`).join(' / ')
        + ` —— 行の高さ ${m[0].行高}`)
    } else if (m.some((x) => !x.語.length)) {
      /* ★ **語の箱が1つも無ければ、下の3本は何も測っていない**(第5.407節)。
           `AppTabs.jsx` が語で割るのをやめた日に、**素通りさせない** */
      ng(`${どこ} … 名前が語ごとの箱に入っていない`,
        m.map((x) => `${x.名} ${x.語.length} 語`).join(' / '))
    } else if (!多語) {
      /* ★ **空白を含む名前が1つも無ければ、折り返しを測っていない**(第5.407節)。
           ここが赤いときは、**タブの名前から空白が消えた**ということである */
      ng(`${どこ} … 空白を含む名前が1つも無い`, '折り返しを測る相手がいない')
    } else if (m.some((x) => x.語.some((g) => g.行 !== 1))) {
      /* ★ **語の途中で切れていないか**(第5.407節・利用者の指定)。
           「Quick Respo / nse」になっていたら、どの語かが2行になる。
           **空白を含む札だけを見ない。** はじめ `多語` だけを見ていたが、
           1語の札(スピーチ練習)でも同じことが起きる ——
           **しかも札の高さは変わらない**(2行ぶん取ってあるので)ので、
           手前の「絵の高さがそろっていない」には捕まらない */
      ng(`${どこ} … 語の途中で折り返している`,
        m.flatMap((x) => x.語.filter((g) => g.行 !== 1)
          .map((g) => `${x.名}/${g.字}:${g.行}行`)).join(' / '))
    /* ★ **「横にはみ出していないか」は、ここでは見ない**(第5.407節)。

         足してみたが、**どうやっても自分の力では赤くならなかった。**
         横にはみ出した行は**左端から置かれる**(`text-align: center` は
         入りきる行しかまん中に寄せない)ので、**字のまん中が必ず右へずれ**、
         手前の「絵と字の横のまん中がそろっていない」(第5.403節)に
         先に当たる —— 実測で 絵 341.8 / 字 346.5(ずれ 4.7px)。

         はみ出しは**すでに2本が見張っている。**
         ①札の箱がタブからはみ出していないか(`はみ出し`・すぐ上)
         ②絵と字の横のまん中がそろっているか(第5.403節)
         **失敗しようのない行は、置いておくだけ害になる**(CLAUDE.md)。 */
    } else if (m.some((x) => x.省略 !== 'clip')) {
      /* ★ **「…」で消していないか**(第5.407節・利用者の指定) */
      ng(`${どこ} … 名前を「…」で省略している`,
        m.map((x) => `${x.名} ${x.省略}`).join(' / '))
    } else {
      ok(`${どこ} … 幅・絵・字の1行目がそろい、区切りは2つめから・上下いっぱいでない`
        + `(区切り ${m[1].区切り.高さ} / タブ ${m[1].タブ高}`
        + ` / まん中からのずれ 縦 ${Math.round(Math.abs(m[0].上 - m[0].下) * 10) / 10}`
        + ` 横 ${Math.round(Math.abs(m[0].絵中心 - m[0].字中心) * 10) / 10}`
        + ` / 「${多語.名}」は ${多語.語.map((g) => g.字).join(' / ')} の`
        + `${多語.語.length}行・はみ出しなし・省略なし)`)
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

  /* ══ 練習中も、下のメニューが出ているか(第5.405節・2026-10-07 利用者の指定)══

       > 単語帳やクイックレスポンスの下部をメニューボタンに変更する

     単語帳と Quick Response の練習は `.focus`(`z-index: 120`)で
     **画面ぜんぶを覆う**ので、下のメニュー(`z-index: 40`)が隠れていた。
     練習に入ると、ほかの画面へ移る道が無くなる。

     **「出ているか」だけを見ない。** 見えていても、上に透明なものが
     乗っていれば押せない。**押して、本当に移るか**まで見る。
     **広い画面(帯の出ない幅)も測る** —— そこまで短くしてしまうと、
     パソコンで下に空白の帯ができる(**出ない側**・CLAUDE.md)。 */
  for (const [名, q] of [
    ['単語帳', 'screen=mybook&tabs=1'],
    ['Quick Response', 'screen=qrrev&tabs=1'],
    /* ★ **聞き流しの最中も出す**(第5.417節・段階4の案C-1・利用者の指定)。
         あちらは `.focus.radio` で、**上の2つとは別の決まり**で短くしている
         —— 書き忘れると、聞きながら単語帳へ移れない
         (**行き止まりを作らない**・CLAUDE.md)。
         音を鳴らし続ける画面なので、この輪は `domcontentloaded` で待っている */
    ['聞き流し', 'screen=qrradio&tabs=1'],
  ]) {
    for (const w of [390, 320]) {
      await page.setViewportSize({ width: w, height: 760 })
      /* **`networkidle` を待たない**(CLAUDE.md)—— 音を鳴らす画面は
         いつまでも「通信中」に見える。出るはずのものを待つ */
      await page.goto(`http://localhost:${PORT}/__bar.html?${q}`,
        { waitUntil: 'domcontentloaded' })
      /* ★ **描けなかったことも、赤として数える**(第5.405節で踏んだ)。
           包まないと `waitForSelector` が投げて**検証そのものが止まり、
           このあとの「出ない側」を1本も測らない。**
           骨組みが帯を描き忘れたときに、ここが赤くなる */
      try {
        await page.waitForSelector('.app-tabs', { timeout: 8000 })
        await page.waitForSelector('.focus', { timeout: 8000 })
      } catch {
        /* **`page` はこの輪で使い回している。閉じない** ——
           閉じると、このあとの回が1本も測れなくなる */
        ng(`練習中のメニュー ${名} ${w}px … 帯か練習の画面が描かれない`,
          '骨組みが `&tabs=1` を受け取っていないか、画面が開いていない')
        continue
      }
      await page.waitForTimeout(250)
      const m = await page.evaluate(() => {
        const 丸 = (n) => Math.round(n * 10) / 10
        const 帯 = document.querySelector('.app-tabs').getBoundingClientRect()
        const 練習 = document.querySelector('.focus').getBoundingClientRect()
        const 押せるもの = [...document.querySelectorAll('.focus button')]
          .map((b) => b.getBoundingClientRect())
          .filter((r) => r.width > 0 && r.height > 0)
        /* ★ **練習中は、札を目から消して細くする**(第5.417節・
             2026-10-08 利用者の指定「トレーニング中だけ文字をなしに」)。
             **場所を取っていないこと**と、**名前が読み上げに残っていること**を
             同時に測る —— 消すと、絵だけのボタンが何なのか分からなくなる */
        const 札 = [...document.querySelectorAll('.app-tab-label')].map((e) => {
          const r = e.getBoundingClientRect()
          const cs = window.getComputedStyle(e)
          return {
            出ている: r.width > 1 || r.height > 1,
            読める: Boolean(e.textContent.trim())
              && cs.display !== 'none' && cs.visibility !== 'hidden',
          }
        })
        return {
          タブ数: document.querySelectorAll('.app-tab').length,
          帯の上: 丸(帯.top), 帯の高さ: 丸(帯.height),
          練習の下: 丸(練習.bottom),
          札が出ている: 札.filter((x) => x.出ている).length,
          読めない: 札.filter((x) => !x.読める).length,
          タブ高: 丸(Math.min(...[...document.querySelectorAll('.app-tab')]
            .map((t) => t.getBoundingClientRect().height))),
          ボタンの下: 押せるもの.length
            ? 丸(Math.max(...押せるもの.map((r) => r.bottom))) : null,
        }
      })
      const どこ = `練習中のメニュー ${名} ${w}px`
      const すき間 = Math.round((m.帯の上 - m.練習の下) * 10) / 10
      if (m.タブ数 !== 4) {
        ng(`${どこ} … 下のメニューが4つ出ていない(${m.タブ数})`)
      } else if (m.札が出ている) {
        /* ★ **練習中は細くする**(第5.417節・2026-10-08 利用者の指定) */
        ng(`${どこ} … 練習中なのに札が場所を取っている(${m.札が出ている} 枚)`,
          '練習中だけ、札を目から消して細くする決まりである')
      } else if (m.読めない) {
        ng(`${どこ} … 名前が読み上げに届かない(${m.読めない} 枚)`,
          '目から消すだけにする —— 消すと、絵だけのボタンが何なのか分からない')
      } else if (m.タブ高 < TAP_MIN) {
        ng(`${どこ} … 細くしすぎて、押せる大きさを割っている`,
          `タブ ${m.タブ高}px —— ${TAP_MIN}px 以上が要る`)
      } else if (ホームの帯 != null && m.帯の高さ >= ホームの帯) {
        /* ★ **ホームより低いか**(第5.417節)。**2つを比べる** ——
             数を書き写すと、帯の作りを変えた日に意味を失う */
        ng(`${どこ} … 練習中なのに、ホームより低くなっていない`,
          `練習中 ${m.帯の高さ} / ホーム ${ホームの帯}`)
      } else if (すき間 < 0) {
        ng(`${どこ} … 練習の画面が、メニューに被っている`,
          `練習の下 ${m.練習の下} / 帯の上 ${m.帯の上}`)
      } else if (すき間 > m.帯の高さ / 2) {
        /* **上げすぎてもいけない。** 「被っていない」だけを見ると、
           画面のはるか上へ逃がしても緑になる(浮きボタンと同じ考え方) */
        ng(`${どこ} … 練習の画面が、メニューより上に離れすぎている`,
          `すき間 ${すき間} / 帯 ${m.帯の高さ}`)
      } else if (m.ボタンの下 == null) {
        ng(`${どこ} … 押せるものが1つも無い`, '何も測っていない')
      } else if (m.ボタンの下 > m.帯の上 + 0.5) {
        ng(`${どこ} … 答えのボタンが、メニューの下に隠れている`,
          `ボタンの下 ${m.ボタンの下} / 帯の上 ${m.帯の上}`)
      } else {
        ok(`${どこ} … メニューが出て、被っても離れてもいない。札は目に出さず`
          + `読み上げには残る(すき間 ${すき間} / 帯 ${m.帯の高さ}`
          + `(ホーム ${ホームの帯}) / タブ ${m.タブ高} / ボタンの下 ${m.ボタンの下})`)
      }

      /* ★ **押して、本当に移るか。** 見えているだけでは意味がない。

           **押せなかったことも、赤として数える**(第5.405節で踏んだ)。
           帯の上に透明なものが乗っていると `tap()` はそこで落ちるので、
           包まないと**検証そのものが止まり、残りを1本も測らない。** */
      let 移った = null
      try { await page.locator('.app-tab').nth(2).tap({ timeout: 4000 }) }
      catch (e) { 移った = `押せなかった(${String(e.message).split('\n')[0].slice(0, 40)})` }
      if (移った === null) {
        移った = await page.evaluate(() => document.querySelector('.app-tabs').dataset.picked)
      }
      if (移った !== 'qr') {
        ng(`${どこ} … 練習中にメニューを押しても移らない(${移った ?? 'なし'} / qr)`)
      } else {
        ok(`${どこ} … 練習中でも、押せば移る`)
      }
    }

    /* **出ない側。** 帯の出ない広い画面では、これまでどおり下までいっぱい */
    await page.setViewportSize({ width: 1280, height: 760 })
    await page.goto(`http://localhost:${PORT}/__bar.html?${q.replace('&tabs=1', '')}`,
      { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('.focus')
    await page.waitForTimeout(250)
    const 広い = await page.evaluate(() => ({
      帯: Boolean(document.querySelector('.app-tabs')),
      下: Math.round(document.querySelector('.focus').getBoundingClientRect().bottom),
      窓: window.innerHeight,
    }))
    if (広い.帯) {
      ng(`練習中のメニュー ${名} 1280px … 帯が出ている`, 'この幅では測る意味が変わる')
    } else if (広い.下 < 広い.窓 - 1) {
      ng(`練習中のメニュー ${名} 1280px … 帯が無いのに、練習の画面が短い`,
        `下 ${広い.下} / 窓 ${広い.窓}`)
    } else {
      ok(`練習中のメニュー ${名} 1280px … 帯が無ければ、下までいっぱい(${広い.下})`)
    }
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
         読む・6Steps・レッスンは**これまでどおり出る。**

         **スピーチは第5.302節で集中モードごと外した**(利用者の指定
         「集中モードと文章コピーはやはり排除でよいです」)ので、
         ここには入れない —— **数を書き写さない。一覧から数える** */
    {
      const 骨 = readFileSync(join(ROOT, 'src/components/FocusFrame.jsx'), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
      const 帯で決める = /\{plain \|\| !bar \? null : \(/.test(骨)
      const 出る画面 = ['StepFocus', 'FocusReader', 'LessonView']
      const 帯を渡す = 出る画面
        .filter((n) => /\n\s*bar=\{/.test(
          readFileSync(join(ROOT, `src/components/${n}.jsx`), 'utf8')))
      if (!帯で決める) {
        ng('集中モードを終える … 出す / 出さないを、帯の有無で決めていない',
          '幅や画面の名前で分けると、置き場所の数だけ食い違う')
      } else if (帯を渡す.length !== 出る画面.length) {
        ng(`集中モードを終える … 帯を渡す画面が ${帯を渡す.length} つになった`,
          `出るはずの ${出る画面.length} 画面が減っている(${帯を渡す.join(' / ')})`)
      } else {
        ok(`集中モードを終える … 帯のある ${出る画面.length} 画面では、これまでどおり出る`)
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

  /* ══════════════════════════════════════════════════════════════════
     ★ **終わりの1枚が、地の色の箱からはみ出していないか**(第5.387節・
       2026-10-05 利用者の指摘「以前直したはずなのですが、改善していません」)

       > 終わった後のリストの背景の色が途中から切り替わっています。
       > これが、背景が黒の時は字の色と重なって読めなくなります。

     **測ったら、一覧 2906px が地の色を塗っている紙 809px の中にいた** ——
     7行目くらいから下は紙の外に乗り、途中で背景が切り替わっていた。

     ★ **前の直しが効いていなかった理由は2つ。**
       ①`.qr` を伸ばしても、**親(紙)が画面の高さで止まる**
       ②印を `.qr--done` に掛けていたが、**付けていたのは復習だけ** ——
         教材の中の Quick Response には1度も効いていなかった

     ★ **本物の `QuickResponse` を、本物の集中モードで動かして測る。**
       手書きの骨組みを作ると、**骨組みだけが直っていて本物は壊れている**
       が起きる(CLAUDE.md)。渡しているのは中身(30 問)だけである。
     ══════════════════════════════════════════════════════════════════ */
  {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`http://localhost:${PORT}/__bar.html?screen=qrdone`,
      { waitUntil: 'networkidle' })
    await page.waitForSelector('.qr-actions')
    /* 30 問ぜんぶ「まだ」で答える = **全部が終わりの一覧に出る**(いちばん長い形) */
    for (let i = 0; i < 40; i += 1) {
      if (await page.locator('.qr-result').count()) break
      const やめ = page.locator('.qr-actions .btn--quiet').first()
      if (!(await やめ.count())) break
      await やめ.click()
      await page.waitForTimeout(25)
    }
    const 出た = await page.locator('.qr-result-list > li').count()
    /* ★ **「無ければ素通り」させない。** 一覧が出ていなければ、
         何も測っていないのと同じである(CLAUDE.md) */
    if (出た < 10) {
      ng('QR終わり … 終わりの一覧が出ていない(測れていない)', `${出た} 行`)
    } else {
      const 測 = await page.evaluate(() => {
        /* **地の色を塗っている箱を、実際に探す。**
           名前を書き写すと、入れ物の名前が変わった日に黙って素通りする */
        const 一覧 = document.querySelector('.qr-result-list')
        const 透明 = (el) => {
          const c = (String(window.getComputedStyle(el).backgroundColor).match(/[\d.]+/g) ?? []).map(Number)
          return !(c.length >= 3 && (c[3] ?? 1) > 0.99)
        }
        let 箱 = null
        for (let n = 一覧.parentElement; n && n !== document.body; n = n.parentElement) {
          if (!透明(n)) { 箱 = n; break }
        }
        if (!箱) return { ある: false }
        const a = 一覧.getBoundingClientRect()
        const b = 箱.getBoundingClientRect()
        return {
          ある: true,
          名: 箱.className.split(' ')[0],
          一覧の高さ: Math.round(a.height),
          箱の高さ: Math.round(b.height),
          はみ出し: Math.round(a.bottom - b.bottom),
        }
      })
      if (!測.ある) {
        ng('QR終わり … 地の色を塗っている箱が見つからない', '測れていない')
      } else if (測.はみ出し > 1) {
        ng('QR終わり … 終わりの一覧が、地の色の箱からはみ出している',
          `一覧 ${測.一覧の高さ}px / 箱(${測.名}) ${測.箱の高さ}px`
          + ` → ${測.はみ出し}px はみ出し(そこから背景が切り替わる)`)
      } else {
        ok('QR終わり … 終わりの一覧が、地の色の箱に収まっている'
          + `(一覧 ${測.一覧の高さ}px / 箱 ${測.名} ${測.箱の高さ}px)`)
      }
      /* **送れること**も見る。伸ばしたせいで下まで行けないのでは直っていない。

         ★ **ここの `ok()` は、文字を出すだけである**(`ok(条件, 名前)` ではない)。
           `ok(送れる, '…')` と書いたら **`✓ true` と出て、失敗しようがなかった**
           —— CLAUDE.md が名指しで書いてある罠を、その日に踏んだ(第5.387節)。
           **赤くするのは `ng()` だけ。** 必ず `if (!条件) ng(…)` の形で書く */
      const 送り = await page.evaluate(() => {
        const b = document.querySelector('.focus-body')
        if (!b) return { ある: false }
        return {
          ある: true,
          中: b.scrollHeight,
          外: b.clientHeight,
          縦: window.getComputedStyle(b).overflowY,
        }
      })
      if (!送り.ある) {
        ng('QR終わり … 送る箱が見つからない', '測れていない')
      } else if (!(送り.中 > 送り.外) || 送り.縦 === 'hidden') {
        ng('QR終わり … 伸ばしたぶんを、下まで送れない',
          `中身 ${送り.中}px / 窓 ${送り.外}px / overflow-y: ${送り.縦}`)
      } else {
        ok(`QR終わり … 伸ばしたぶんは、そのまま下まで送れる(中身 ${送り.中}px / 窓 ${送り.外}px)`)
      }
    }
  }

  /* ══ **番号の丸は、日本語のときも英語のときも同じ場所**(第5.270節)══

       2026-09-26 実機・利用者の指摘。

       > 日本語の時だけ番号が左に行ってしまいます。直してください

     出題の箱は、**伏せているあいだは `<button>`、出したあとは `<div>`**
     である(第5.262節)。`<button>` には**ブラウザ自身の決まり**で
     `align-items: flex-start` が入っている端末があり(iPhone = WebKit)、
     入ると縦に積んだ行が**中身なりの幅に縮んで左端へ寄る**
     (実測 336px → 59px)。`.qr-ja` は `margin: 0 auto` を持っているので
     中央のまま残るため、**日本語のときだけ、番号だけが**左へ行くように見えた。

     **こちらの Chromium では再現しない**(`align-items` が `normal` に落ちる)。
     だから**その決まりを足してから測る** —— `button { align-items: flex-start }`
     は、ブラウザ自身の決まりより**弱い**書き方である。つまり
     `.qr-body` の側がきちんと書けていれば、こちらが勝つ。
     **足さずに測ると、壊れていても緑になる**
     (「無ければ素通り」する形の検証を書かない・CLAUDE.md)。

     **見るのは3つ。どれも1本ずつ外して赤くなるのを確かめてある。**
       ①行(`.qr-from`)が、箱の幅いっぱいに広がっているか
         —— 縮んだら左端へ寄る。**これが利用者の見た形**である
       ②丸の場所が、**2つの形で同じ**か(「日本語の時だけ」がこれ)
       ③行の中身が、その行のまん中に来ているか
         —— ①②だけだと、**両方とも左に寄せる**書き換えで緑のままになる

     **丸そのものが箱のまん中に来るとは限らない。** 話す人の名前が
     同じ行に並ぶので(`子の数` 2)、**2つを合わせたまん中**になる。
     だから「丸がまん中か」では測らない(実測 18px ずれる)。 */
  {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`http://localhost:${PORT}/__bar.html?screen=qrrev`,
      { waitUntil: 'networkidle' })
    await page.waitForSelector('.qr-card')
    /* **ブラウザ自身の `<button>` の決まりを、弱い形で足す** */
    await page.addStyleTag({ content: 'button { align-items: flex-start; }' })
    const 測る = () => page.evaluate(() => {
      const 箱 = document.querySelector('.qr-body')
      const 行 = document.querySelector('.qr-from')
      const 丸 = document.querySelector('.qr-from .num-badge')
      /* **無ければ素通りさせない。** 丸が消えた日に、ここが黙ってはいけない */
      if (!箱 || !行 || !丸) return { ある: false }
      const 内 = (el) => {
        const r = el.getBoundingClientRect()
        const p = window.getComputedStyle(el)
        const px = (v) => parseFloat(v) || 0
        return {
          左: r.left + px(p.paddingLeft) + px(p.borderLeftWidth),
          右: r.right - px(p.paddingRight) - px(p.borderRightWidth),
        }
      }
      const b = 内(箱)
      const f = 内(行)
      const 子 = [...行.children].map((c) => c.getBoundingClientRect())
      return {
        ある: true,
        形: 箱.tagName,
        そろえ方: window.getComputedStyle(箱).alignItems,
        行の幅: Math.round(f.右 - f.左),
        箱の幅: Math.round(b.右 - b.左),
        // 行の中身(丸 + 話す人)が、行のまん中に来ているか
        中身のずれ: Math.round(
          (Math.min(...子.map((r) => r.left)) - f.左)
          - (f.右 - Math.max(...子.map((r) => r.right)))),
        丸の左: Math.round(丸.getBoundingClientRect().left),
      }
    })
    const 伏せ = await 測る()          // 日本語が出ている(`<button>`)
    await page.click('.qr-body')
    await page.waitForTimeout(200)
    const 出し = await 測る()          // 英語が出ている(`<div>`)

    if (!伏せ.ある || !出し.ある) {
      ng('QR 番号の丸 … 行(`.qr-from`)か丸(`.num-badge`)が見つからない',
        '出題の箱・番号の行・丸が在ることが前提の見張りである(黙らせない)')
    } else if (伏せ.形 !== 'BUTTON' || 出し.形 !== 'DIV') {
      ng(`QR 番号の丸 … 箱の形が変わった(伏せ ${伏せ.形} / 出し ${出し.形})`,
        '第5.262節で「伏せているあいだだけ `<button>`」にした。'
        + '形が変わったのなら、この見張りの前提も見直す')
    } else if (伏せ.行の幅 !== 伏せ.箱の幅 || 出し.行の幅 !== 出し.箱の幅) {
      ng(`QR 番号の丸 … 行が箱の幅いっぱいに広がっていない`
        + `(伏せ ${伏せ.行の幅}/${伏せ.箱の幅}px・出し ${出し.行の幅}/${出し.箱の幅}px)`,
        '`.qr-body` に `align-items: stretch` を書く。書かないと '
        + '`<button>` にブラウザ自身の `flex-start` が入り、'
        + '**日本語のときだけ**番号が左端へ寄る(利用者の指摘)')
    } else if (伏せ.丸の左 !== 出し.丸の左) {
      ng(`QR 番号の丸 … 日本語のときと英語のときで場所が違う`
        + `(伏せ ${伏せ.丸の左}px / 出し ${出し.丸の左}px)`,
        '同じ `face` から描いているので、場所が動く理由は無い。'
        + '箱の側(`<button>` / `<div>`)の食い違いを疑う')
    } else if (Math.abs(伏せ.中身のずれ) > 2 || Math.abs(出し.中身のずれ) > 2) {
      ng(`QR 番号の丸 … 行の中身がまん中に無い`
        + `(伏せ ${伏せ.中身のずれ}px / 出し ${出し.中身のずれ}px)`,
        '`.qr-from` は `justify-content: center`。'
        + '**両方とも左に寄せても、上の2つは緑のまま**になる')
    } else if (伏せ.そろえ方 !== 出し.そろえ方) {
      ng(`QR 番号の丸 … 2つの形でそろえ方が違う`
        + `(伏せ ${伏せ.そろえ方} / 出し ${出し.そろえ方})`,
        '同じ見た目のはずの2つが食い違うと、端末によって寄り方が変わる')
    } else {
      ok(`QR 番号の丸 … 日本語(${伏せ.形})でも英語(${出し.形})でも同じ場所`
        + `(左 ${伏せ.丸の左}px・行 ${伏せ.行の幅}px・${伏せ.そろえ方})`)
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
          /* ★ **1段に並んでいるか**(第5.406節)。札の数を CSS に
               決め打ちしてあると、**1枚増やした日に2段へ落ちる** ——
               実際 `repeat(3, …)` と書いてあって 3 + 1 になっていた。
               **上端がそろっているか**で測る(数を書かない) */
          上: Math.round(b.getBoundingClientRect().top),
          押せない: Boolean(b.disabled),
          文言: (b.querySelector('.wb-stat-label')?.textContent ?? '').trim(),
          /* **文言が折り返していないか。** 2行になると札だけが背伸びする */
          字の行数: (() => {
            const el = b.querySelector('.wb-stat-label')
            if (!el) return 0
            const r = el.getBoundingClientRect()
            const 行の高さ = parseFloat(window.getComputedStyle(el).lineHeight) || r.height
            return Math.max(1, Math.round(r.height / Math.max(1, 行の高さ)))
          })(),
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
    let 畳んだまま = null
    if (開く) {
      await page.click('.rscope-go .btn--small')
      await page.waitForTimeout(140)
      /* ★ **「詳しくしぼる」は、はじめ畳んである**(第5.414節・段階3)。
           畳んだままの姿を先に控えてから、開いて中身を測る ——
           **「出る」と「出ない」の両方を見る**(CLAUDE.md) */
      畳んだまま = await page.evaluate(() => {
        const pop = document.querySelector('.sheet') || document.querySelector('.setpop')
        if (!pop) return null
        return {
          札の数: pop.querySelectorAll('.rscope-chip').length,
          見出し: [...pop.querySelectorAll('.rscope-head')]
            .map((e) => e.textContent.trim()).join('/'),
          しぼる欄: pop.querySelectorAll('.wbfilter-row').length,
          詳しく: !!pop.querySelector('.rscope-more-btn'),
          始める: (pop.querySelector('.rscope-go .btn--primary')?.textContent ?? '').trim(),
        }
      })
      const more = await page.$('.rscope-more-btn')
      if (more) { await more.click(); await page.waitForTimeout(180) }
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
          /* ★ **スイッチは問数の「すぐ下」**(第5.414節)。
               もとは同じ行だったが、シャッフルと2つになったので下の行へ */
          繰り返すが個数と同じ行: (() => {
            const sw = pop.querySelector('.rscope-switches')
            const row = pop.querySelector('[aria-labelledby="rscope-many"]')
            if (!sw || !row) return false
            const a = row.getBoundingClientRect()
            const b = sw.getBoundingClientRect()
            return b.top >= a.bottom - 1 && b.top - a.bottom < 24
          })(),
          低い札: Math.min(...chips.map((c) => Math.round(c.getBoundingClientRect().height))),
          押せない札: chips.filter((c) => c.disabled).length,
          /* ★ **0件の札は押せない**(第5.414節)。**数そのものを見る** ——
               「押せない札が N 個」では、N を書き写すことになる */
          数ゼロの札: chips.filter((c) => (c.querySelector('.chip-count')?.textContent ?? '') === '0').length,
          数ゼロで押せる札: chips
            .filter((c) => (c.querySelector('.chip-count')?.textContent ?? '') === '0' && !c.disabled)
            .length,
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
          /* ★ **行の名前は、そのままでは比べない**(第5.406節)。
                 利用者の指定で「レベル」→「**教材のレベル**」に変えた日、
                 **ちょうど一致**で探していたここだけが空になり、
                 **仕組みは1ミリも壊れていないのに赤くなった**
                 (CLAUDE.md「式も、関数の名前も書き写さない」の、言葉の側)。
                 すぐ下の「行が出ているか」の見張りは `includes` で見ており、
                 **同じファイルの中で2通りに書いてあった。**
                 言いまわしそのものは `npm run test:play` が見張っている
                 (「教材のレベル」と書いてあるか / ただの「レベル」が
                 残っていないか)ので、ここは**どの行かを当てるだけ**でよい。
                 `.wbfilter-name` に「レベル」を含む行は1つだけである */
          レベルの選択肢: [...pop.querySelectorAll('.wbfilter-row')]
            .filter((r) => (r.querySelector('.wbfilter-name')?.textContent ?? '').includes('レベル'))
            .flatMap((r) => [...r.querySelectorAll('option')].map((o) => o.textContent.trim())),
          画面内: r.left >= -1 && r.right <= window.innerWidth + 1
            && r.top >= -1 && r.bottom <= window.innerHeight + 1,
          幅: Math.round(r.width), 高さ: Math.round(r.height),
        }
      })
    }
    await page.close()
    return { 閉, 開, 畳んだまま }
  }

  for (const w of [1280, 430, 390, 375, 360, 320]) {
    const { 閉, 開, 畳んだまま } = await 測る(w)
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
    } else if (開.数を出している < PICKS.length + LEARN_STAGES.length) {
      ng(`復習の範囲 ${w}px … 札に数が出ていない(${開.数を出している} 個)`,
        '「苦手が8問ある」と見えて初めて、何を出すか選べる')
    /* ★ **数は一覧から出す。書き写さない**(第5.414節・CLAUDE.md)。
         何を出す4 + 問数3 + スイッチ2 + 訊き方4 + 段階4 + 並べ方 */
    } else if (開.札の数 !== 札はいくつ()) {
      ng(`復習の範囲 ${w}px … 札が ${札はいくつ()} 個`
        + `(何を出す${PICKS.length} + 問数${SIZES.length} + スイッチ2`
        + ` + 訊き方${QUIZ_FORMS.length} + 段階${LEARN_STAGES.length}`
        + ` + 並べ方${plainOrders(WORD_ORDERS).length})ではない`, `${開.札の数} 個`)
    /* ★ **「詳しくしぼる」は、はじめ畳んである**(利用者の指定)。
         **開いた姿と比べる** —— 畳んでも同じ数なら、畳めていない */
    } else if (!畳んだまま?.詳しく) {
      ng(`復習の範囲 ${w}px … 「詳しくしぼる」のボタンが無い`)
    } else if (畳んだまま.札の数 >= 開.札の数
      || 畳んだまま.しぼる欄 > 0) {
      ng(`復習の範囲 ${w}px … 「詳しくしぼる」が畳まれていない`,
        `畳んで札 ${畳んだまま.札の数} / 欄 ${畳んだまま.しぼる欄}`
        + ` → 開いて札 ${開.札の数}`)
    /* ★ **いちばん下に「◯問で始める」**(利用者の指定)。
         押す前に出題数が分かること */
    } else if (!/\d+ .で始める|ありません/.test(畳んだまま.始める)) {
      ng(`復習の範囲 ${w}px … シートの下に「◯問で始める」が無い`,
        畳んだまま.始める || '(無い)')
    /* **「おまかせ」は消した**(2026-09 実機・利用者の指定)。
       この人の単語帳はほとんどが箱0で、**ずっと4択**にしかならず、
       名前が嘘になっていた */
    } else if (開.札の言葉.includes('おまかせ') || 開.札の言葉.includes('つづりを書く')) {
      ng(`復習の範囲 ${w}px … 消したはずの形が札に残っている`, 開.札の言葉)
    /* **見出しが無いと、どの札が何なのか分からない** */
    } else if (!開.見出し.includes('何を出す') || !開.見出し.includes('訊き方')
      || !開.見出し.includes('段階')) {
      ng(`復習の範囲 ${w}px … 何を出す・訊き方・段階の見出しが出ていない`, 開.見出し)
    /* **繰り返すは「一度に出す個数の横」**(利用者の指定)。
       別の行に落ちていたら、言われたとおりに置けていない */
    } else if (!開.繰り返すが個数と同じ行) {
      ng(`復習の範囲 ${w}px … スイッチが問数のすぐ下にない`,
        '利用者の指定は「そのすぐ下に「シャッフル」「繰り返す」」である')
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
  /* ★ **数を書き写さない。性質で見る**(第5.414節・CLAUDE.md)。
       「0 と出ている札が、ぜんぶ押せないこと」だけを見る。
       **0 の札が1つも無ければ、何も測っていない**ので、そこも赤くする */
  if (!old.開 || !old.開.数ゼロの札) {
    ng('復習の範囲 … 0件の札が1つも無い(何も測れていない)',
      `0 の札 ${old.開?.数ゼロの札} 個`)
  } else if (old.開.数ゼロで押せる札 > 0) {
    ng('復習の範囲 … 0件の札が押せてしまう',
      `0 なのに押せる札 ${old.開.数ゼロで押せる札} 個`)
  } else if (!old.閉.ボタン.includes('ありません')) {
    ng('復習の範囲 … 出すものが無いのに、始められる', old.閉.ボタン)
  } else {
    ok(`復習の範囲 … 0件の札は押せない(0 の札 ${old.開.数ゼロの札} 個)`)
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
    /* ★ **数は `LEARN_STAGES` から読む**(第5.406節)。
         ここに `3` と書いてあったので、段階を4つにしたとたん
         **仕組みは正しいのに見張りだけが赤くなった**(CLAUDE.md
         「式も、関数の名前も書き写さない」の、数の側である) */
    const 要る = LEARN_STAGES.length
    if (閉.段.length !== 要る) {
      ng(`段を押す … 札が ${要る} つ出ていない`, `${閉.段.length} 個`)
    } else if (押せる段.length !== 要る) {
      ng('段を押す … 札が `<button>` になっていない',
        閉.段.map((g) => g.tag).join('/'))
    } else if (Math.min(...閉.段.map((g) => g.高さ)) < 40) {
      ng('段を押す … 押せる大きさ(40px)を割っている',
        閉.段.map((g) => g.高さ).join('/'))
    } else if (!閉.段の説明.includes('押すと')) {
      ng('段を押す … 押したら何が起きるかを言っていない', 閉.段の説明)
    } else {
      ok(`段を押す … ${要る} つとも押せる(${閉.段.map((g) => g.文言).join(' / ')}`
        + `・${閉.段[0].高さ}px)`)
    }

    /* ★ ══ **札は、狭い画面でも1段に並ぶ**(第5.406節)═══════════════
         `.wb-stats` に `repeat(3, …)` と**数を決め打ち**してあったので、
         4段階にしたとたん **4枚めだけが2段めへ落ちていた**(3 + 1)。
         **数を書かずに測る** —— 上端がそろっているか、字が折り返して
         いないかの2つだけ見る(CLAUDE.md「値を書き写さない。性質で見る」)。
         狭い画面(390px)で測るのは、**折り返しが起きるのはそちら**だから。 */
    if (閉.段.length) {
      const 上 = [...new Set(閉.段.map((g) => g.上))]
      const 折り返した = 閉.段.filter((g) => g.字の行数 > 1)
      if (上.length !== 1) {
        ng(`段の札 390px … ${上.length} 段になっている`
          + `(札 ${閉.段.length} 枚)`, 閉.段.map((g) => `${g.文言}:${g.上}`).join(' / '))
      } else if (折り返した.length) {
        ng('段の札 390px … 文言が2行に折り返している',
          折り返した.map((g) => `${g.文言}(${g.字の行数}行)`).join(' / '))
      } else {
        ok(`段の札 390px … ${閉.段.length} 枚が1段に並ぶ(折り返しなし)`)
      }
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
    /* ★ **「日付」は「出会った時期」に統合した**(第5.414節) */
    } else if (!名前.includes('出会った時期') || !名前.includes('分野')) {
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
    /* ★ **「日付」は「出会った時期」に統合した**(第5.414節) */
    } else if (!名前.includes('出会った時期') || !名前.includes('レベル')) {
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
      /* ★ **`networkidle` を待たない**(第5.285節)。聞き流しは
         **間も音で置く**ようになったので、`<audio>` が途切れずに
         読み込み続ける —— Chromium はそれを「まだ通信中」と数えるため、
         **この画面は二度と `networkidle` にならない**(実測・30 秒で落ちた)。
         描けたかどうかは、**出るはずのものを待って**確かめる */
      { waitUntil: 'domcontentloaded' })
      await page.waitForSelector('.radio-card', { timeout: 20000 })
    await page.waitForTimeout(300)
    const got = await page.evaluate(() => {
      const px = (el) => (el ? Math.round(el.getBoundingClientRect().height) : 0)
      const card = document.querySelector('.radio-card')
      const body = document.querySelector('.focus-body')
      const btns = [...document.querySelectorAll('.radio-tools .btn')]
      return {
        語: document.querySelector('.radio-en')?.textContent?.trim() ?? '',
        訳: document.querySelector('.radio-ja')?.textContent?.trim() ?? '',
        ボタン: btns.map((b) => ({ 文言: b.textContent.trim(), 高さ: px(b) })),
        // **送るものが無いか。** ここが出た瞬間、この画面の意味が消える
        たて: body ? body.scrollHeight - body.clientHeight : 0,
        よこ: body ? body.scrollWidth - body.clientWidth : 0,
        右: card ? Math.round(card.getBoundingClientRect().right) : 0,
      }
    })
    /* **設定は、下の「設定」を開かないと出てこない**(第5.271節)。
       上の帯から移したので、**帯を見ているだけでは何も数えられない。**
       開く前と開いたあとを、別々に測る */
    const 欄を読む = () => page.evaluate(() => {
      const 並び = (sel) => [...document.querySelectorAll(sel)]
        .flatMap((s) => [...s.options].map((o) => o.textContent.trim()))
      return {
        /* **欲しいものを名指しする**(第5.262節)。もとは
           「`--gap` 以外」という**外して数える形**だったので、
           欄が1つ増えるたびに巻き込まれていた
           (曲の題を数えた 2026-09-23、何問ずつを数えた 2026-09-26)。
           **読み方は `--mode` である** */
        読み方: 並び('.radio-set-body .radio-set-pick--mode'),
        間: 並び('.radio-set-body .radio-set-pick--gap'),
        /* **名前が見えているか**(第5.271節)。これが無いと
           「5 問」「3 秒」とだけ出て、何の設定か分からない
           —— それが利用者の指摘そのものである。
           **`sr-only` は数えない**(読み上げには届くが、目には見えない) */
        名前: [...document.querySelectorAll('.radio-set-body .radio-set-name')]
          .filter((el) => el.getBoundingClientRect().width > 0)
          .map((el) => el.textContent.trim()),
        /* **上の帯に、選び欄が1つも残っていないこと**(「出る」と「出ない」の
           両方を見る・CLAUDE.md)。移したつもりで置き忘れても、
           下だけを数えていると緑のままになる */
        帯の欄: document.querySelectorAll('.focus-top select').length,
      }
    })
    /* **畳んだままで1つも出ていないこと**も見る(第5.271節)——
       開かずに並んでいたら、上の帯にあったのと同じ読みにくさになる */
    const 畳んだまま = await 欄を読む()
    await page.click('.radio-gear')
    await page.waitForTimeout(150)
    const 設定 = await 欄を読む()
    const 開いて横 = await page.evaluate(() => {
      const b = document.querySelector('.focus-body')
      return b ? b.scrollWidth - b.clientWidth : 0
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
    } else if (畳んだまま.帯の欄 !== 0 || 設定.帯の欄 !== 0) {
      /* **上の帯に選び欄を戻していないか**(第5.271節・利用者の指摘
         「これではなんのことかよく分かりません」)。
         帯は細く1行なので、**名前を置く場所が無い** */
      ng(`聞き流し(${w}px) … 上の帯に選び欄が残っている`,
        `畳んで ${畳んだまま.帯の欄} 個 / 開いて ${設定.帯の欄} 個`
        + ' —— 設定は下の「設定」の中に置く')
    } else if (畳んだまま.間.length !== 0) {
      /* **畳んでいるあいだは、中身を描かない**(共通ルール)。
         `<details>` に `display` を書くと、畳んでも場所を取り続ける */
      ng(`聞き流し(${w}px) … 畳んでいるのに、設定の中身が出ている`,
        `間の札が ${畳んだまま.間.length} 個`)
    } else if (設定.名前.length < 2) {
      /* **名前が見えているか**(第5.271節)。値だけでは何の設定か分からない */
      ng(`聞き流し(${w}px) … 設定の名前が見えていない`,
        設定.名前.join('/') || '(名前が1つも無い)')
    } else if (開いて横 > 0) {
      ng(`聞き流し(${w}px) … 設定を開くと横にはみ出す`, `${開いて横}px`)
    } else if (設定.読み方.length !== 0) {
      /* **読み方は「英語だけ」1つになった**(2026-09 利用者の指定
         「日本語入りはいらないですね!こえの質が悪すぎます!」)。
         選べるものが1つなら、**欄そのものを出さない**
         —— 効かない操作を見せない(CLAUDE.md) */
      ng(`聞き流し(${w}px) … 選べるものが1つなのに、読み方の欄が出ている`,
        設定.読み方.join('/'))
    } else if (設定.間.length < 4 || !設定.間.some((t) => /秒/.test(t))) {
      /* **間の欄が出ているか**(2026-09 利用者の指定
         「単語帳もだが、間の時間設定もできるようにしてくれ」) */
      ng(`聞き流し(${w}px) … 間の長さを選べない`, 設定.間.join('/') || '(欄が無い)')
    } else if (got.ボタン.some((b) => b.高さ < 40)) {
      /* **押せる大きさ(40px)を割っていないか。**
         **数は書かない**(第5.280節)—— ここは `!== 2` と書いてあったので、
         「前へ」を1つ足した日に、**割ってもいないのに赤くなった。**
         **値を書き写さない。性質で見る**(CLAUDE.md)。
         「何が並ぶか」は下の行の見張りが名前で見ている */
      ng(`聞き流し(${w}px) … 押せる大きさ(40px)を割っている`,
        got.ボタン.map((b) => `${b.文言}:${b.高さ}`).join(' / '))
    } else if (!['とめる', 'つづける'].some((t) => got.ボタン.some((b) => b.文言.includes(t)))
      || !got.ボタン.some((b) => b.文言.includes('前へ'))
      || !got.ボタン.some((b) => b.文言.includes('次へ'))) {
      /* ★ **下の行に並ぶもの**(第5.280節・2026-09-27 利用者の指定)。
         とめる(つづける)/ 前へ / 次へ の3つ。**名前で見る** */
      ng(`聞き流し(${w}px) … 下の行に、とめる・前へ・次へ がそろっていない`,
        got.ボタン.map((b) => b.文言).join(' / '))
    } else if (got.よこ > 0 || got.右 > w) {
      ng(`聞き流し(${w}px) … 横にはみ出している`, `${got.よこ}px / 右 ${got.右}`)
    } else if (got.たて > 0) {
      ng(`聞き流し(${w}px) … 縦に送るものが出ている`,
        `${got.たて}px —— 1語だけに向き合う画面である`)
    } else {
      ok(`聞き流し(${w}px) … 語も訳も出て、送るものが無く、`
        + `設定は下に名前つきで畳んである(${設定.名前.join(' / ')})`)
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
      /* ★ **`networkidle` を待たない**(第5.285節)。聞き流しは
         **間も音で置く**ようになったので、`<audio>` が途切れずに
         読み込み続ける —— Chromium はそれを「まだ通信中」と数えるため、
         **この画面は二度と `networkidle` にならない**(実測・30 秒で落ちた)。
         描けたかどうかは、**出るはずのものを待って**確かめる */
      { waitUntil: 'domcontentloaded' })
      await page.waitForSelector('.radio-card', { timeout: 20000 })
    await page.waitForTimeout(300)
    const got = await page.evaluate(() => {
      const card = document.querySelector('.radio-card')
      const body = document.querySelector('.focus-body')
      return {
        文: document.querySelector('.radio-en')?.textContent?.trim() ?? '',
        訳: document.querySelector('.radio-ja')?.textContent?.trim() ?? '',
        たて: body ? body.scrollHeight - body.clientHeight : 0,
        よこ: body ? body.scrollWidth - body.clientWidth : 0,
        右: card ? Math.round(card.getBoundingClientRect().right) : 0,
      }
    })
    /* **設定は下の「設定」の中**(第5.271節)。単語帳とまったく同じ読み方を
       する —— **書き写さない**ために、同じ選び方(`.radio-set-pick--◯◯`)を使う */
    const 欄を読む = () => page.evaluate(() => {
      const 並び = (sel) => [...document.querySelectorAll(sel)]
        .flatMap((s) => [...s.options].map((o) => o.textContent.trim()))
      return {
        読み方: 並び('.radio-set-body .radio-set-pick--mode'),
        間: 並び('.radio-set-body .radio-set-pick--gap'),
        名前: [...document.querySelectorAll('.radio-set-body .radio-set-name')]
          .filter((el) => el.getBoundingClientRect().width > 0)
          .map((el) => el.textContent.trim()),
        帯の欄: document.querySelectorAll('.focus-top select').length,
      }
    })
    /* ★ **やめる道は、上の帯にあって、白い**(第5.276節・利用者の指定
         「×聞き流しをやめる、ボタンも上に移動、そして白にしてください」)。
       **地の色は、帯と比べて決める** —— 値を書き写すと、配色を直した日に
       画面は正しいのに赤くなる(**性質で見る**・CLAUDE.md)。 */
    const やめる = await page.evaluate(() => {
      const 帯 = document.querySelector('.focus-top')
      const q = document.querySelector('.focus-top .radio-quit')
      const 下 = [...document.querySelectorAll('.radio-tools .btn')]
        .map((b) => b.textContent.trim())
      if (!帯) return { 帯なし: true }
      const 明るさ = (c) => {
        const [r, g, b] = (String(c).match(/\d+/g) ?? []).map(Number)
        return [r, g, b].some((v) => v === undefined) ? -1 : (r + g + b) / 3
      }
      /* **白は「いちばん明るい」で見る。** 値(#ffffff)を書き写すと、
         配色を直した日に画面は正しいのに赤くなる(性質で見る・CLAUDE.md)。
         比べる相手は、同じ帯にいる**白いままのもの**ではなく、
         **白そのもの** —— `--btn-bg` を実際に描いて読む */
      const 白 = (() => {
        const el = document.createElement('div')
        el.style.background = 'var(--btn-bg)'
        document.body.appendChild(el)
        const v = 明るさ(window.getComputedStyle(el).backgroundColor)
        el.remove()
        return Math.round(v)
      })()
      const qs = q ? window.getComputedStyle(q) : null
      return {
        ある: !!q,
        字: q ? q.textContent.trim() : '',
        帯の明るさ: Math.round(明るさ(window.getComputedStyle(帯).backgroundColor)),
        やめるの明るさ: q
          ? Math.round(明るさ(window.getComputedStyle(q).backgroundColor)) : -1,
        白の明るさ: 白,
        /* **枠線があるか。** 地を帯と同じにするなら、枠が無いと
           「押せるもの」に見えなくなる(共通ルール) */
        枠: qs ? Math.round(parseFloat(qs.borderTopWidth) * 10) / 10 : -1,
        枠の色: qs ? qs.borderTopColor : '',
        // 帯が2段になっていないか(押すものを足して太らせない)
        帯の高さ: Math.round(帯.getBoundingClientRect().height),
        下に残っている: 下.some((t) => t.includes('やめる')),
        下のボタン: 下,
      }
    })
    const 畳んだまま = await 欄を読む()
    await page.click('.radio-gear')
    await page.waitForTimeout(150)
    const 設定 = await 欄を読む()
    /* ★ **いちばん長い名前で測る**(第5.273節・2026-09-26 実機・
         利用者の指摘「この UI は不細工ですね」)。

       第5.271節の見張りは、**既定の読み方でしか測っていなかった。**
       そのときの名前は短い「間の長さ」で、何も起きない。
       利用者が読み方を「日本語→英語」に変えたとたん、名前が長くなり、
       **選び欄が画面の右端からはみ出した。**
       「無ければ素通り」する形の検証を書かない(CLAUDE.md)——
       **いちばん危ない形を、検証の中に必ず1つ置く。**

       ここでは**読み方を1つずつ選び直して、すべての名前で測る。**
       名前を長くした日にも、ひとりでに試される(名前を書き写さない)。 */
    const 一番長い名前で = await (async () => {
      const 欄 = '.radio-set-body .radio-set-pick--mode'
      const 値 = await page.$$eval(`${欄} option`, (os) => os.map((o) => o.value))
      let 悪い = null
      for (const v of 値.length ? 値 : [null]) {
        if (v !== null) {
          await page.selectOption(欄, v)
          await page.waitForTimeout(120)
        }
        const r = await page.evaluate(() => {
          const b = document.querySelector('.focus-body')
          const 名 = [...document.querySelectorAll('.radio-set-body .radio-set-name')]
          const 欄 = [...document.querySelectorAll('.radio-set-body .radio-set-pick')]
          const box = (el) => el.getBoundingClientRect()
          return {
            よこ: b ? b.scrollWidth - b.clientWidth : 0,
            /* **欄が、はみ出していないか。** 右端が入れ物より外なら不合格 */
            はみ出し: b
              ? Math.round(Math.max(0, ...欄.map((el) => box(el).right - box(b).right)))
              : 0,
            /* **そろっているか。** 名前の長さがまちまちでも、
               欄は同じ場所から始まり、同じ幅でなければならない ——
               そこが揺れているのが「不細工」の中身である */
            始まりの幅: 欄.length
              ? Math.round(Math.max(...欄.map((el) => box(el).left))
                - Math.min(...欄.map((el) => box(el).left)))
              : 0,
            幅の差: 欄.length
              ? Math.round(Math.max(...欄.map((el) => box(el).width))
                - Math.min(...欄.map((el) => box(el).width)))
              : 0,
            名前: 名.map((el) => el.textContent.trim()),
            欄の数: 欄.length,
          }
        })
        if (!悪い || r.はみ出し > 悪い.はみ出し || r.始まりの幅 > 悪い.始まりの幅) 悪い = r
      }
      return 悪い
    })()
    const 開いて横 = 一番長い名前で.よこ
    await page.close()

    /* **どの文が出ているかは、測るたびに変わる**(上と同じ理由)。
       ただし**どちらも1行に収まらない長さ**にしてあるので、
       どちらが出ていても字の落とし方は試される */
    if (!/take on the project|walk me through/.test(got.文)) {
      ng(`QRの聞き流し(${w}px) … 文が出ていない`, got.文 || '(空)')
    } else if (!/[぀-ヿ㐀-鿿]/.test(got.訳)) {
      ng(`QRの聞き流し(${w}px) … 訳が出ていない`, got.訳 || '(空)')
    } else if (!やめる.ある) {
      /* **やめる道が、帯にあるか**(第5.276節)。
         消してしまうと、☰ の画面では練習へ戻れなくなる */
      ng(`QRの聞き流し(${w}px) … やめる道が上の帯に無い`, `下は ${やめる.下のボタン.join(' / ')}`)
    } else if (やめる.下に残っている) {
      /* **下にも残っていないか**(同じことをするものを2つ見せない) */
      ng(`QRの聞き流し(${w}px) … やめるが上と下の両方にある`, やめる.下のボタン.join(' / '))
    } else if (やめる.やめるの明るさ >= やめる.白の明るさ) {
      /* ★ **グレー**(第5.280節・利用者の指定「白は浮いて見えますね。
           グレーに戻しましょう」)。**値を書き写さず、白そのものと比べる** ——
         白と同じ明るさまで行ったら、また浮いている。
         (第5.276節はここが逆向き「帯より明るいか」だった) */
      ng(`QRの聞き流し(${w}px) … やめるが白いまま(グレーになっていない)`,
        `白 ${やめる.白の明るさ} / やめる ${やめる.やめるの明るさ} / 帯 ${やめる.帯の明るさ}`)
    } else if (!(やめる.枠 >= 0.5) || /rgba\(0, 0, 0, 0\)/.test(やめる.枠の色)) {
      /* **地を帯と同じにするなら、枠が要る。**
         地も枠も無くすと、**押せるものに見えない**(共通ルール)。
         白をやめたぶん、ここで埋める —— 弱めない */
      ng(`QRの聞き流し(${w}px) … やめるに枠線が無い(押せるものに見えない)`,
        `枠 ${やめる.枠}px / ${やめる.枠の色}`)
    } else if (やめる.帯の高さ > 72) {
      /* **帯を2段にしない**(`.focus-top` は「細く1行」という決まり)。
         押すものを足したときに、いちばん起きやすい壊れ方である */
      ng(`QRの聞き流し(${w}px) … 帯が2段になっている`, `${やめる.帯の高さ}px`)
    } else if (畳んだまま.帯の欄 !== 0 || 設定.帯の欄 !== 0) {
      /* **上の帯に選び欄を戻していないか**(第5.271節・利用者の指摘)。
         **こちらの画面が言われた場所である** —— 単語帳のほうも
         同じ部品なので、2つとも見る */
      ng(`QRの聞き流し(${w}px) … 上の帯に選び欄が残っている`,
        `畳んで ${畳んだまま.帯の欄} 個 / 開いて ${設定.帯の欄} 個`)
    } else if (畳んだまま.読み方.length !== 0 || 畳んだまま.間.length !== 0) {
      ng(`QRの聞き流し(${w}px) … 畳んでいるのに、設定の中身が出ている`,
        `読み方 ${畳んだまま.読み方.length} 個 / 間 ${畳んだまま.間.length} 個`)
    } else if (設定.名前.length < 3) {
      /* **こちらは読み方もあるので、名前は3つ以上**
         (何問ずつ / 読み方 / 間。曲は登録があるときだけ増える) */
      ng(`QRの聞き流し(${w}px) … 設定の名前が見えていない`,
        設定.名前.join('/') || '(名前が1つも無い)')
    } else if (開いて横 > 0 || 一番長い名前で.はみ出し > 1) {
      /* **どの読み方でも、欄がはみ出さないこと**(第5.273節)。
         いちばん長い名前のときに、ここが赤くなる */
      ng(`QRの聞き流し(${w}px) … 設定の欄が横にはみ出す`,
        `画面 ${開いて横}px / 欄 ${一番長い名前で.はみ出し}px`
        + `(名前「${一番長い名前で.名前.join(' / ')}」)`)
    } else if (一番長い名前で.欄の数 < 3) {
      /* **測る相手が居ることを、先に確かめる** ——
         欄が1つしか無ければ「そろっている」は必ず成り立ち、素通りする */
      ng(`QRの聞き流し(${w}px) … 設定の欄が ${一番長い名前で.欄の数} 個しかない`,
        'そろっているかを測るには、欄が3つ以上要る')
    } else if (一番長い名前で.始まりの幅 > 1 || 一番長い名前で.幅の差 > 1) {
      /* **名前の長さがまちまちでも、欄はそろう**(第5.273節)。
         行ごとの `flex` に戻すと、ここが赤くなる */
      ng(`QRの聞き流し(${w}px) … 設定の欄がそろっていない`,
        `始まりの差 ${一番長い名前で.始まりの幅}px / 幅の差 ${一番長い名前で.幅の差}px`
        + `(名前「${一番長い名前で.名前.join(' / ')}」)`)
    } else if (設定.読み方.length < 2) {
      /* **ここは利用者の指定で反転した**(2026-09「パタプラのようにしたい」)。
         Quick Response には「言う練習」が足してあるので、
         **読み方の欄が出ていなければならない。**
         単語帳(すぐ上)は「英語だけ」1つのままなので、**あちらは出ない** ——
         同じ部品が、場面で正しく分かれていることを、ここで見ている */
      ng(`QRの聞き流し(${w}px) … 読み方をえらべない(言う練習にたどり着けない)`,
        設定.読み方.join('/') || '(欄が無い)')
    } else if (!設定.読み方.some((t) => /日本語→英語/.test(t))) {
      ng(`QRの聞き流し(${w}px) … 「日本語→英語」が読み方に無い`, 設定.読み方.join('/'))
    } else if (設定.読み方.some((t) => /チャンク/.test(t))) {
      /* **チャンク系の2つは排除した**(第5.251節・2026-09-23 利用者の指定
         「ややこしく、分かりにくいので排除です」)。
         **「出る」だけでなく「出ない」も見る** —— 一覧に戻しても
         緑のままだと、消したことを誰も守らない */
      ng(`QRの聞き流し(${w}px) … チャンク系の読み方が戻っている`,
        設定.読み方.join('/'))
    } else if (設定.読み方.length !== 2) {
      ng(`QRの聞き流し(${w}px) … 読み方が2つではない`, 設定.読み方.join('/'))
    } else if (!設定.間.some((t) => /秒/.test(t))) {
      /* **間の欄は、Quick Response にも出る**(語は短く、文は長い) */
      ng(`QRの聞き流し(${w}px) … 間の長さを選べない`, 設定.間.join('/') || '(欄が無い)')
    } else if (got.よこ > 0 || got.右 > w) {
      ng(`QRの聞き流し(${w}px) … 横にはみ出している`, `${got.よこ}px / 右 ${got.右}`)
    } else if (got.たて > 0) {
      ng(`QRの聞き流し(${w}px) … 縦に送るものが出ている`,
        `${got.たて}px —— 1問だけに向き合う画面である`)
    } else {
      ok(`QRの聞き流し(${w}px) … 文も訳も出て、送るものが無く、`
        + `どの読み方でも設定の欄がそろう(名前「${一番長い名前で.名前.join(' / ')}」)。`
        + `やめるは帯にグレーで(白 ${やめる.白の明るさ} / やめる ${やめる.やめるの明るさ}`
        + ` / 枠 ${やめる.枠}px・帯 ${やめる.帯の高さ}px)`)
    }
  }

  /* ── ★ **聞き流しの中でも、教材(冊)をえらべる** ──────────────────
   *      第5.283節・2026-09-27 利用者の指定
   *
   *        > 聞き流し内でも教材を選び、ランダムなどの設定をできるように
   *        > したいです。
   *
   *      **描いて測る。** 欄を足しただけで満足すると、次の4つを
   *      1つも確かめられない —— どれも**画面を開くまで分からない**形である。
   *        ① 畳んだままでは出ない(開いて初めて出る)
   *        ② **いま鳴っている冊が選ばれている**
   *           (`value` が札に無い id だと、**空っぽの欄**になる)
   *        ③ **いちばん上**にある(ほかの設定は、その冊の中の話である)
   *        ④ 長い冊名でも、横にはみ出さない
   */
  for (const [名, screen, いまの冊] of [
    ['単語帳', 'radio', '自分の単語帳'],
    ['QR', 'qrradio', 'Native Flow Vol.1'],
  ]) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
    /* ★ **`networkidle` を待たない**(第5.285節)。聞き流しは間も音で置く
       ようになったので、`<audio>` が途切れずに読み込み続ける ——
       Chromium はそれを「まだ通信中」と数えるため、
       **この画面は二度と `networkidle` にならない**(実測・30 秒で落ちた)。
       **`?screen=${screen}` のように組み立てている行は、探し漏らしやすい**
       —— `screen=radio` の字で探して、ここだけ1度見落とした */
    await page.goto(`http://localhost:${PORT}/__bar.html?screen=${screen}`,
      { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('.radio-card', { timeout: 20000 })
    await page.waitForTimeout(300)
    /* **畳んだままでは出ていないこと**(すぐ上の設定と同じ読み方) */
    const 畳んだまま = await page.evaluate(
      () => document.querySelectorAll('.radio-set-pick--book').length)
    await page.click('.radio-gear')
    await page.waitForTimeout(200)
    const 開いて = await page.evaluate(() => {
      const s = document.querySelector('.radio-set-pick--book')
      const 箱 = document.querySelector('.radio-set-body')
      /* ★ **冊の中の区切り**(第5.288節・UNIT・章・型・段) */
      const sub = document.querySelector('.radio-set-sub')
      return {
        ある: Boolean(s),
        札: s ? [...s.options].map((o) => o.textContent.trim()) : [],
        いま: s ? (s.options[s.selectedIndex]?.textContent?.trim() ?? '') : '',
        名前: [...document.querySelectorAll('.radio-set-body .radio-set-name')]
          .map((el) => el.textContent.trim()),
        はみ出し: s && 箱
          ? Math.round(s.getBoundingClientRect().right - 箱.getBoundingClientRect().right)
          : 0,
        区切り: sub ? {
          押せるもの: sub.querySelectorAll('button, select').length,
          /* **教材のすぐ下か**(「どの冊の、どこ」が続けて決まる) */
          教材の次: [...箱.children].indexOf(sub)
            === [...箱.children].findIndex((c) => c.classList.contains('radio-set-pick--book')) + 1,
          はみ出し: Math.round(Math.max(0,
            sub.getBoundingClientRect().right - 箱.getBoundingClientRect().right,
            箱.getBoundingClientRect().left - sub.getBoundingClientRect().left)),
        } : null,
      }
    })
    await page.close()

    if (畳んだまま !== 0) {
      ng(`${名}の聞き流し … 畳んでいるのに、教材の欄が出ている`, `${畳んだまま} 個`)
    } else if (!開いて.ある) {
      ng(`${名}の聞き流し … 設定に教材の欄が無い`,
        開いて.名前.join(' / ') || '(名前が1つも無い)')
    } else if (開いて.札.length < 2) {
      /* **測る相手が居ることを、先に確かめる** ——
         札が1つなら「選べる」は確かめられない */
      ng(`${名}の聞き流し … 教材の札が ${開いて.札.length} 個しかない`, 開いて.札.join('/'))
    } else if (開いて.いま !== いまの冊) {
      ng(`${名}の聞き流し … いま鳴っている冊が選ばれていない`,
        `「${開いて.いま}」(「${いまの冊}」のはず)`)
    } else if (開いて.名前[0] !== '教材') {
      ng(`${名}の聞き流し … 教材が設定のいちばん上に無い`, 開いて.名前.join(' / '))
    } else if (開いて.はみ出し > 1) {
      ng(`${名}の聞き流し … 長い冊名で、欄が横にはみ出す`, `${開いて.はみ出し}px`)
    } else if (!開いて.区切り) {
      /* ★ **冊の中の区切り**(第5.288節・2026-09-27 利用者の指摘
         「聞き流し内のモードのソート内で冊の中のUNITなどが選べません」)。
         冊をえらべても、**その中の UNIT・型・段**が選べなければ、
         元の画面と同じことができない */
      ng(`${名}の聞き流し … 冊の中の区切り(UNIT・型・段)が出ていない`,
        開いて.名前.join(' / '))
    } else if (開いて.区切り.押せるもの === 0) {
      ng(`${名}の聞き流し … 区切りの欄はあるが、押せるものが1つも無い`)
    } else if (!開いて.区切り.教材の次) {
      ng(`${名}の聞き流し … 区切りが、教材のすぐ下に無い`, 開いて.名前.join(' / '))
    } else if (開いて.区切り.はみ出し > 1) {
      ng(`${名}の聞き流し … 区切りの欄が、設定の箱からはみ出す`,
        `${開いて.区切り.はみ出し}px`)
    } else {
      ok(`${名}の聞き流し … 設定のいちばん上で教材をえらべる`
        + `(${開いて.札.length} 冊・いま「${開いて.いま}」・名前 ${開いて.名前.join('/')})`
        + ` / そのすぐ下で冊の中の区切り(押せるもの ${開いて.区切り.押せるもの} 個)`)
    }
  }

  /* ★ **区切りの無い冊では、その行ごと出さない**(第5.288節)。
       「出る」と「出ない」の両方を見る —— これが無いと、
       **いつでも出す形**に書き換えても緑のままになる */
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
    page.setDefaultTimeout(9000)
    await page.goto(`http://localhost:${PORT}/__bar.html?screen=qrradio&sub=none`,
      { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('.radio-card', { timeout: 20000 })
    await page.waitForTimeout(300)
    await page.click('.radio-gear')
    await page.waitForTimeout(200)
    const 見えたもの = await page.evaluate(() => ({
      区切り: document.querySelectorAll('.radio-set-sub').length,
      ほか: document.querySelectorAll('.radio-set-body .radio-set-pick').length,
    }))
    await page.close()
    if (見えたもの.ほか === 0) {
      ng('QRの聞き流し … 区切りが無い冊で、設定が1つも開いていない',
        '「区切りの欄が無い」ことを確かめられていない')
    } else if (見えたもの.区切り !== 0) {
      ng('QRの聞き流し … 区切りの無い冊なのに、その行が出ている',
        `${見えたもの.区切り} 個`)
    } else {
      ok('QRの聞き流し … 区切りの無い冊では、その行ごと出さない'
        + `(ほかの設定は ${見えたもの.ほか} 個そのまま)`)
    }
  }

  /* ★ **冊が1つしか無いときは、欄そのものを出さない**(第5.283節)。
       押しても何も変わらないものを見せない(CLAUDE.md)。
       **「出る」と「出ない」の両方を見る** —— これが無いと、
       いつでも出す形に書き換えても緑のままになる。
       **`?books=one` を持っているのは Quick Response の骨組みだけ**なので、
       ここはその1つで測る(骨組みの持ちものは、上の見張りが数えている) */
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
    await page.goto(`http://localhost:${PORT}/__bar.html?screen=qrradio&books=one`,
      /* ★ **`networkidle` を待たない**(第5.285節)。聞き流しは
         **間も音で置く**ようになったので、`<audio>` が途切れずに
         読み込み続ける —— Chromium はそれを「まだ通信中」と数えるため、
         **この画面は二度と `networkidle` にならない**(実測・30 秒で落ちた)。
         描けたかどうかは、**出るはずのものを待って**確かめる */
      { waitUntil: 'domcontentloaded' })
      await page.waitForSelector('.radio-card', { timeout: 20000 })
    await page.waitForTimeout(300)
    await page.click('.radio-gear')
    await page.waitForTimeout(200)
    const 見えたもの = await page.evaluate(() => ({
      教材: document.querySelectorAll('.radio-set-pick--book').length,
      ほか: document.querySelectorAll('.radio-set-body .radio-set-pick').length,
    }))
    await page.close()
    if (見えたもの.ほか === 0) {
      /* **設定そのものが開いていないなら、何も測れていない**
         (無ければ素通りする形の検証を書かない・CLAUDE.md) */
      ng('QRの聞き流し … 冊が1つのとき、設定が1つも開いていない',
        '教材の欄が「無い」ことを確かめられていない')
    } else if (見えたもの.教材 !== 0) {
      ng('QRの聞き流し … 冊が1つなのに、教材の欄が出ている', `${見えたもの.教材} 個`)
    } else {
      ok('QRの聞き流し … 冊が1つのときは、教材の欄を出さない'
        + `(ほかの設定は ${見えたもの.ほか} 個そのまま)`)
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

  /* ── ★ **教材の中の Quick Response にも聞き流し**(第5.287節)────────
   *
   *   2026-09-27 利用者の指定「教材内のquick responseにも聞き流しの機能を」。
   *
   *   **押してみて、本当に聞き流しが開くか**まで見る ——
   *   ボタンだけ置いて、開く先を繋ぎ忘れても、
   *   「ボタンがあるか」だけの見張りは緑のままになる。
   *   ══════════════════════════════════════════════════════════════ */
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
    page.setDefaultTimeout(9000)
    await page.route('**/rest/v1/**', (r) => r.fulfill({
      status: 200, contentType: 'application/json', body: '[]',
    }))
    await page.goto(`http://localhost:${PORT}/__bar.html?screen=qrmode`,
      { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(800)
    const 押す = page.locator('.qr-head button', { hasText: '聞き流し' })
    const 数 = await 押す.count()
    if (!数) {
      const 並ぶもの = await page.evaluate(() => [...document.querySelectorAll('.qr-head button')]
        .map((b) => b.textContent.trim()).join(' / '))
      ng('教材の Quick Response … 聞き流しのボタンが無い', 並ぶもの || '(ボタンが1つも無い)')
    } else {
      await 押す.first().click()
      await page.waitForTimeout(900)
      const 開いた = await page.evaluate(() => {
        const card = document.querySelector('.radio-card')
        return {
          ある: !!card,
          題: document.querySelector('.focus-top')?.textContent?.trim().slice(0, 40) ?? '',
          文: document.querySelector('.radio-en')?.textContent?.trim() ?? '',
        }
      })
      if (!開いた.ある) ng('教材の Quick Response … 押しても聞き流しが開かない')
      else if (!開いた.文) ng('教材の Quick Response … 聞き流しは開いたが、文が出ていない')
      else ok(`教材の Quick Response … 聞き流しが開く(「${開いた.文.slice(0, 28)}」)`)
    }
    await page.close()
  }

  /* ── ★ **「全体を聞く」は、文型ドリルにも出るか**(第5.286節)──────
   *
   *   2026-09-27 利用者の指定「文型トレーニングに『全体を聞く』ボタンを
   *   作ってください」。もとは**本文(記事・会話)のときだけ**出していた。
   *
   *   **出る側と出ない側の両方を見る**(CLAUDE.md)。
   *     ・文型ドリルの英文和訳のページ(英文和訳)… 鳴らせる → **出る**
   *     ・3ページめ(誤り訂正)… `audioFrom: null` で1本も鳴らせない
   *       → **出ない**(効かない操作を見せない)
   *   出る側だけを見ていると、「どのページにも出す」形に壊しても緑になる。
   *   ══════════════════════════════════════════════════════════════ */
  {
    const page = await browser.newPage({ viewport: { width: 1100, height: 900 } })
    page.setDefaultTimeout(9000)
    await page.goto(`http://localhost:${PORT}/__bar.html?role=trainer&who=g1&kind=drill`,
      { waitUntil: 'networkidle' })
    await page.waitForTimeout(500)
    /** 見えている「全体を聞く」の数と、その文字 */
    const 読む = () => page.evaluate(() => {
      const 見える = [...document.querySelectorAll('.lesson-listen button')]
        .filter((b) => b.getBoundingClientRect().width > 0)
      return { 数: 見える.length, 文字: 見える.map((b) => b.textContent.trim()).join(' / ') }
    })
    const 英文和訳のページ = await 読む()
    /* 3ページめ(誤り訂正)へ。**▶ を2回** */
    for (let i = 0; i < 2; i += 1) {
      await page.locator('button[aria-label="次のページ"]').click()
      await page.waitForTimeout(350)
    }
    const 誤り訂正 = await 読む()
    const 何ページ = await page.evaluate(
      () => document.querySelector('.lesson-pages span')?.textContent?.trim() ?? '')
    await page.close()

    if (英文和訳のページ.数 !== 1) {
      ng('文型ドリル … 「全体を聞く」が出ていない',
        `英文和訳のページに ${英文和訳のページ.数} 個(${英文和訳のページ.文字 || '無し'})`)
    } else if (!/全体/.test(英文和訳のページ.文字)) {
      ng('文型ドリル … ボタンはあるが、通して聞くものではない', 英文和訳のページ.文字)
    } else if (何ページ !== '3 / 3') {
      /* **測る相手のところへ着いているか**(素通り防止) */
      ng('文型ドリル … 3ページめ(誤り訂正)へ移れていない', 何ページ || '(数が出ていない)')
    } else if (誤り訂正.数 !== 0) {
      ng('文型ドリル … 鳴らせない演習にも「全体を聞く」が出ている',
        誤り訂正.文字)
    } else {
      ok(`文型ドリル … 「全体を聞く」が出る(${英文和訳のページ.文字})/`
        + ' 鳴らせない誤り訂正には出ない')
    }
  }

  /* ── ★ **通しで鳴らすボタンの名前は、1か所から来ているか**(第5.290節)──
   *
   *   2026-09-27 利用者の指定「はい、全体を聞く、に変えます」。
   *
   *   `Listen (全体)` は**6か所に書き写してあった** —— 段の中のボタン
   *   (`LessonView`)、送っていったときの居場所(`PlayerBar`)、
   *   **音声をまとめたあとの案内**(`AudioDownloadNote`)、
   *   **本文の練習の ③⑤**(`PassagePractice`)、**Speech練習**
   *   (`SpeechPractice`)、そして**この見張り**である。
   *   案内のほうを追いかけ忘れると、
   *   **もう無いボタンを「押してください」と書くことになる。**
   *
   *   はじめは前の3つだけを直したが、利用者の指定
   *   「もちろん、全てに全体を聞くを追加して」で残り2つもそろえた。
   *   ──────────────────────────────────────────────── */
  {
    const 読む = (f) => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8')
    /* **コメントを落としてから数える**(CLAUDE.md)——
       説明の中の同じ語に当たって素通りする */
    const 素 = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '')
    const 書き写し = []
    for (const f of ['components/LessonView.jsx', 'components/PlayerBar.jsx',
      'components/AudioDownloadNote.jsx', 'components/PassagePractice.jsx',
      'components/SpeechPractice.jsx']) {
      const t = 素(読む(f))
      /* **古い名前が残っていないか** */
      if (/Listen \(全体\)/.test(t)) 書き写し.push(`${f} … 古い名前が残っている`)
      /* **新しい名前を直に書いていないか**(書いたら、次の改名で片方だけ古くなる) */
      if (new RegExp(wholePlayText()).test(t)) 書き写し.push(`${f} … 文字を直に書いている`)
    }
    if (書き写し.length) {
      ng('通しのボタン … 名前を書き写している場所がある', 書き写し.join('\n    '))
    } else ok('通しのボタン … 5つの場所とも `wholePlay.js` 1か所から引く(書き写しは0)')

    /* ── **落とすのは添えの言葉だけ** ───────────────────────────
       `CORE`(`聴く`)が `.wide-text` の中に入ると、狭い画面で
       **言葉がまるごと消えて、絵だけになる。**

       ★ **見る形が変わった**(2026-09-29 利用者の指定)。
         > 上部のバーのボタンは「聴く」は必要なく、「▷」など、
         > アイコンだけで作って、下部に置くものと同じにしてください

         操作盤の鳴らすボタンは、**はじめから言葉を持たない**ので、
         「添えだけ落ちているか」を数える相手がもう居ない。
         もとの本は `wide-text">{WHOLE_PLAY_WIDE}</span>{WHOLE_PLAY_CORE}`
         という**書き方そのもの**を探していたので、
         **絵だけにした日から、必ず赤**になってしまう。

         いま守りたいのは1つだけ —— **`CORE` を `.wide-text` に入れない。**
         入れたら、言葉を戻した日に狭い画面で消える。
         **名前が残っているか**(`aria-label`)は、実際に描いて
         「上の帯 … 絵だけ」の節が数えている(**両方で1組**)。 */
    const pb = 素(読む('components/PlayerBar.jsx'))
    if (/wide-text"[^>]*>\s*\{?WHOLE_PLAY_CORE/.test(pb)) {
      ng(`通しのボタン … 「${WHOLE_PLAY_CORE}」を \`.wide-text\` に入れている`,
        '狭い画面で言葉がまるごと消える。入れてよいのは添えの言葉だけ')
    } else ok(`通しのボタン … 「${WHOLE_PLAY_CORE}」を \`.wide-text\` に入れていない`)
  }

  /* ── ★ **1文ずつ鳴らすボタンの名前も、1か所から来ているか**(第5.297節)──
   *
   *   2026-09-28 利用者の指定。
   *
   *     > 文型トレーニングにおいては全体を通して聞く、と共に
   *     > 文章ごとの「聞く」も必要です。直してください。
   *     > 勝手になくすの、やめてください
   *
   *   **ボタンは消えていなかった。** 描いて数えたら出ていた
   *   (英文和訳 4/4・和文英訳 2/2)。**文字が `Listen` のまま**で、
   *   上が「全体を聞く」になったぶん、**見分けがつかなくなっていた。**
   *
   *   出す場所は2つ —— `SpeakButton`(設問ごと)と
   *   `PassagePractice`(本文の練習)。
   *   **「全体を聞く」とまったく同じ作法**で、
   *   `speakLabel.js` 1か所から引く。
   *
   *   ★ **`FocusReader`(集中モード)は、出す側から外れた**
   *     (2026-09-30・第5.321節)。あの帯は**音声プレーヤーそのもの**に
   *     なったので、鳴らすボタンの名前は `wholePlay.js` が持つ
   *     (そちらは上の節が見張っている)。
   *
   *     **「引いているか」と「書き写していないか」は、別に見る。**
   *     引く必要がなくなっても、**直に書いてよくなったわけではない** ——
   *     ここへ「聴く」と書き足した日に、赤くなってほしい。
   *   ──────────────────────────────────────────────── */
  {
    const 読む = (f) => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8')
    /* **コメントを落としてから数える**(CLAUDE.md)——
       説明の中に `Listen` が何十個も出てくるので、そのままでは永久に赤い */
    const 素 = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '')
    /** **出す場所** —— `speakLabel.js` から引いていなければならない */
    const 出す = ['components/SpeakButton.jsx', 'components/PassagePractice.jsx']
    /** **出さない場所** —— 引く必要は無いが、**直に書いてもいけない** */
    const 書かない = ['components/FocusReader.jsx']
    const 書き写し = []
    for (const f of [...出す, ...書かない]) {
      const t = 素(読む(f))
      /* ①**取り込んでいるか**(定義だけあって誰も呼ばなければ、何も起きない)。
         **出す場所だけ**見る */
      if (出す.includes(f) && !/from '\.\.\/lib\/speakLabel\.js'/.test(t)) {
        書き写し.push(`${f} … speakLabel.js から引いていない`)
      }
      /* ②**古い名前が残っていないか**(`addEventListener` などは頭が違う) */
      if (/['"`>]Listen\b/.test(t)) 書き写し.push(`${f} … 古い名前(Listen)が残っている`)
      /* ③**新しい名前を直に書いていないか**(書いたら、次の改名で片方だけ古くなる)。
         **出さない場所でも見る** —— あとで書き足されたら赤くなってほしい */
      if (new RegExp(`['"\`>]${SPEAK_LISTEN}`).test(t)) {
        書き写し.push(`${f} … 「${SPEAK_LISTEN}」を直に書いている`)
      }
    }
    if (書き写し.length) {
      ng('1文ずつの聞く … 名前を書き写している場所がある', 書き写し.join('\n    '))
    } else {
      ok(`1文ずつの聞く … 出す ${出す.length}つは \`speakLabel.js\` 1か所から引き、`
        + `出さない ${書かない.length}つも直に書いていない`)
    }

    /* **見張り自身が書き写していないか。**
       ここに `'聞く'` と書くと、画面を `Listen` に戻しても緑のままになる */
    const 自分 = 素(readFileSync(new URL(import.meta.url), 'utf8'))
    if (new RegExp(`聴くの形 = \`\\^\\(\\$\\{SPEAK_LISTEN\\}`).test(自分)) {
      ok('1文ずつの聞く … 見張りも `speakLabel.js` から読む(文字を書き写していない)')
    } else {
      ng('1文ずつの聞く … 見張りが文字を書き写している',
        '画面を戻しても緑になるので、何も守らない')
    }
  }

  /* ── ★ **画面を消しても、聞き流しは進むか**(第5.285節)─────────────
   *
   *   2026-09-27 実機・利用者の指定。
   *
   *     > 聞き流しの途中にスマホの電源を押して画面をオフにすると
   *     > 音声も消えてしまいます。ポケットにスマホを入れたまま
   *     > 聞き流せるように直してください。
   *
   *   **画面を消した端末のまねをする。** iPhone は画面を消すと
   *   **そのページの時計(`setTimeout`)を止める**ので、
   *   ここでも **0.15 秒以上の時計を1つも鳴らさない**ようにして測る。
   *
   *   **ソースを読んでも分からない。** 「時計を使っていないか」だけを
   *   見ても、どこか1か所に残っていれば止まる ——
   *   **実際に止めてみて、先へ進むかどうか**で見る。
   *
   *   **「ふつうの時計」でも測る**(出る / 出ないの両方・CLAUDE.md)。
   *   これが無いと、そもそも鳴っていないのに「進まない」を見逃す。
   *
   *   置き場所(Storage)は**無音の WAV で答える。** 窓口へは1度も行かない
   *   —— この環境からは届かないし、**1本ずつ課金**される道でもある。
   *   ══════════════════════════════════════════════════════════════ */
  {
    /** 無音の WAV。**画面側の `silentWav()` とは別に、ここで作る** ——
        検証が、測る相手の道具を使って自分を正当化しないため */
    const wav = (ms) => {
      const rate = 8000
      const n = Math.round((rate * ms) / 1000)
      const b = Buffer.alloc(44 + n * 2)
      b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8)
      b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22)
      b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28)
      b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34)
      b.write('data', 36); b.writeUInt32LE(n * 2, 40)
      return b
    }
    for (const 時計 of ['ふつう', '止めた']) {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
      page.setDefaultTimeout(9000)
      if (時計 === '止めた') {
        await page.addInitScript(() => {
          const real = window.setTimeout.bind(window)
          window.setTimeout = (fn, ms, ...rest) => (
            Number(ms) >= 150 ? 0 : real(fn, ms, ...rest))
        })
      }
      await page.route('**/storage/v1/object/public/**', (r) => r.fulfill({
        status: 200, contentType: 'audio/wav', body: wav(700),
      }))
      /* 窓口は断る(作らせない)。読み書きは空で答える */
      await page.route('**/functions/v1/**', (r) => r.fulfill({ status: 500, body: '{}' }))
      await page.route('**/rest/v1/**', (r) => r.fulfill({
        status: 200, contentType: 'application/json', body: '[]',
      }))
      await page.goto(`http://localhost:${PORT}/__bar.html?screen=qrradio`,
        { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(2000)
      /* **触ってから鳴らす**(iPhone と同じで、解錠が要る) */
      await page.mouse.click(195, 400)
      const 見た = new Set()
      for (let i = 0; i < 36; i += 1) {
        const t = await page.evaluate(
          () => document.querySelector('.radio-en')?.textContent?.trim() ?? '')
        if (t) 見た.add(t)
        await page.waitForTimeout(500)
      }
      const 帯 = await page.evaluate(() => {
        const m = navigator.mediaSession?.metadata
        return m ? `${m.title}/${navigator.mediaSession.playbackState}` : ''
      })
      /* ★ **画面に出ている題と突き合わせる**(第5.416節)。
           ここは「空でないか」しか見ていなかったので、
           **受け皿の題(「英語の練習」)に落ちても緑のまま**だった ——
           実際に落ちた(`readAloud()` に足した `setNowPlaying({ title: '' })` が、
           聞き流しが入れた冊名を消していた)。
           **「出る / 出ない」の両方を見る**(CLAUDE.md)—— 題が
           **何であるか**まで見ないと、見張ったことにならない */
      const 見出し = await page.evaluate(() => (
        document.querySelector('.drill-title')?.textContent ?? '').replace(/\s+/g, ' ').trim())
      await page.close()
      if (見た.size < 3) {
        ng(`聞き流し(時計 ${時計}) … 先へ進まない`,
          `18 秒で ${見た.size} 文しか出ていない`
          + (時計 === '止めた' ? '(間を時計で置いている)' : '(そもそも鳴っていない)'))
      } else if (!帯) {
        /* **ロック画面の帯**。これが無いと、端末はページごと寝かせる */
        ng(`聞き流し(時計 ${時計}) … ロック画面に出す題が入っていない`)
      } else if (!見出し) {
        ng(`聞き流し(時計 ${時計}) … 画面に、何を聞き流しているのかが出ていない`,
          '**突き合わせる相手**が無いので、題を測れない')
      } else if (!帯.startsWith(`${見出し}/`)) {
        ng(`聞き流し(時計 ${時計}) … ロック画面の題が、画面の題と違う`,
          `ロック画面「${帯}」/ 画面「${見出し}」`)
      } else {
        ok(`聞き流し(時計 ${時計}) … 18 秒で ${見た.size} 文すすむ`
          + ` / ロック画面の題は画面と同じ ${帯}`)
      }
    }

    /* ── ★ **教材でも、画面を消しても鳴り続けるか**(第5.416節)─────────
     *
     *   2026-10-07 実機・利用者の指摘。
     *
     *     > すべての教材で、スマホやタブレットで画面をオフにすると
     *     > 音が消えます💢これもいつの間にかこうなってました。
     *
     *   **第5.285節は、聞き流しだけを見張っていた。**
     *   「全ての機能で同じ仕様にしておきたい」と言われていたのに、
     *   **教材の読み上げ(`readAloud.js`)は1行も測っていなかった。**
     *
     *   測って分かったのは2つ。
     *     ①先へ進むのは、時計を止めても**直っている**(間は無音で置いている)
     *     ②**ロック画面の題が「英語の練習」のまま**だった ——
     *       `setNowPlaying()` を呼んでいるのは聞き流しだけで、
     *       教材は**受け皿の題**しか出していなかった。
     *       端末はこの帯を見て「止めてはいけない音」と扱う。
     *
     *   **題は、画面に出ているものと突き合わせる**(書き写さない)——
     *   `materialName()` が決める名前が、紙の見出し(`.mtitle-main`)と
     *   ロック画面の両方に出る。**どちらかを書き換えたら赤くなる。**
     *   ══════════════════════════════════════════════════════════════ */
    for (const 時計 of ['ふつう', '止めた']) {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
      page.setDefaultTimeout(9000)
      if (時計 === '止めた') {
        await page.addInitScript(() => {
          const real = window.setTimeout.bind(window)
          window.setTimeout = (fn, ms, ...rest) => (
            Number(ms) >= 150 ? 0 : real(fn, ms, ...rest))
        })
      }
      await page.route('**/storage/v1/object/public/**', (r) => r.fulfill({
        status: 200, contentType: 'audio/wav', body: wav(700),
      }))
      await page.route('**/functions/v1/**', (r) => r.fulfill({ status: 500, body: '{}' }))
      await page.route('**/rest/v1/**', (r) => r.fulfill({
        status: 200, contentType: 'application/json', body: '[]',
      }))
      /* **既定の画面が、教材の紙である**(`__screens.jsx` の最後) */
      await page.goto(`http://localhost:${PORT}/__bar.html`,
        { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(2000)
      /* **触ってから鳴らす**(iPhone と同じで、解錠が要る)。
         紙の上を押す —— ボタンの上を踏むと別のことが起きる */
      await page.mouse.click(10, 500)
      const 見出し = await page.evaluate(() => (
        document.querySelector('.mtitle-main')?.textContent ?? '').trim())
      await page.evaluate(() => { document.querySelector('.player-big')?.click() })
      const 見た = new Set()
      /* ★ **帯は、鳴っているあいだに読む**(第5.416節)。
           鳴り切ったら `clearNowPlaying()` が片づけるので、
           **終わってから読むと必ず空**になり、この見張りは
           いつも赤くなる(実際に1度そうなった)。
           だから**ひと刻みごとに読んで、空でなかったものを覚える。** */
      let 帯 = ''
      for (let i = 0; i < 24; i += 1) {
        const 一 = await page.evaluate(() => ({
          数: (document.querySelector('.player-at')?.textContent ?? '').trim(),
          題: navigator.mediaSession?.metadata?.title ?? '',
        }))
        if (一.数) 見た.add(一.数)
        if (!帯 && 一.題) 帯 = 一.題
        await page.waitForTimeout(500)
      }
      /* **鳴り切ったら片づいているか**(効かない操作を残さない) */
      const 残り = await page.evaluate(
        () => navigator.mediaSession?.metadata?.title ?? '')
      await page.close()
      if (!見出し) {
        ng(`教材(時計 ${時計}) … 紙に教材の名前が出ていない`,
          '**突き合わせる相手**が無いので、題を測れない')
      } else if (見た.size < 3) {
        /* 「— / 2 発言」→「1 / 2」→「2 / 2」→「— / 2」と動く。
           **3つ以上**見えていなければ、先へ進んでいない */
        ng(`教材(時計 ${時計}) … 読み上げが先へ進まない`,
          `12 秒で ${[...見た].join(' | ') || '(なし)'} しか出ていない`
          + (時計 === '止めた' ? '(間を時計で置いている)' : '(そもそも鳴っていない)'))
      } else if (!帯) {
        /* **ロック画面の帯**。これが無いと、端末はページごと寝かせる */
        ng(`教材(時計 ${時計}) … ロック画面に出す題が入っていない`)
      } else if (帯 !== 見出し) {
        /* ★ **受け皿の題(「英語の練習」)で終わらせない**(第5.416節)。
             **紙の見出しと1文字も違えない** —— どちらも
             `materialName()` が決めるので、食い違ったら
             「`setNowPlaying()` を呼んでいない」という意味である */
        ng(`教材(時計 ${時計}) … ロック画面の題が、紙の名前と違う`,
          `ロック画面「${帯}」/ 紙「${見出し}」`)
      } else if (残り) {
        /* **鳴り切ったら片づける**(第5.416節)。
           残すと、何も鳴っていないのに曲名と ▶ が出続け、
           押しても誰も受け取らない(**行き止まりを作らない**) */
        ng(`教材(時計 ${時計}) … 鳴り終わってもロック画面に帯が残っている`,
          `「${残り}」—— `
          + '止めたときは `stopReading()` が片づけるが、鳴り切った道は2つある')
      } else {
        ok(`教材(時計 ${時計}) … 12 秒で ${見た.size} 段落すすむ`
          + ` / ロック画面の題は紙と同じ「${帯}」・鳴り終われば片づく`)
      }
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
    const 名 = `30日講座の中身(${w}px)`
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
    /* ★ **あいだに「講座」の棚が入った**(第5.432節)。
         `App.jsx` → `Courses` → `BasicsCourse` と**2段をたどる** ——
         どちらか片方だけ見ると、棚が中身を描いていなくても緑になる */
    const 棚 = readFileSync(new URL('../src/components/Courses.jsx', import.meta.url), 'utf8')
      .replace(/\/\*[\s\S]*?\*\/|\{\/\*[\s\S]*?\*\/\}/g, '')
    if (!/<Courses me=\{profile\} \/>/.test(src)) {
      ng('講座 … メニューから開けない')
    } else if (!/<BasicsCourse me=\{me\} \/>/.test(棚)) {
      ng('講座 … 棚の中から 30日講座 が開けない',
        '`Courses.jsx` が `BasicsCourse` を描いていない(第5.432節)')
    /* **改行をまたげる形で見る。** `pages` の行は複数行になっている。
       **呼び名は書き写さない** —— 見ているのは「誰に出すか」であって
       名前ではない(名前を書くと、変えた日に赤くなる・CLAUDE.md) */
    /* **トレーナーに出さない、かつ指定したゲストにだけ出す**(0055)。
       > これは、トレーナー側から指定したゲストにのみ映るようにしてください */
    } else if (!/!isTrainer && basicsOn\)\) && \{\s*id: 'course'/.test(src)) {
      ng('講座 … ゲスト専用 / 指定したゲストだけ、になっていない')
    } else {
      ok('講座 … 指定したゲストのメニューから開け、棚の中に 30日講座 がある')
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
    } else if (前.冊 !== 棚の冊数() - 1) {
      /* **棚ぜんぶ − すでに出している1冊。**
         数そのものは書かない —— 分野を足した日に、ここだけ赤くなる */
      ng(`${名} … 足せる棚が ${棚の冊数() - 1} 冊そろっていない`, String(前.冊))
    } else if (前.組.length !== 組の呼び名().length
      || !組の呼び名().every((l) => 前.組.includes(l))) {
      ng(`${名} … 組が ${組の呼び名().join(' / ')} に分かれていない`, 前.組.join(' / '))
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
     ①**棚ぜんぶが選択肢にそろっているか**(+「分野をえらぶ」)
       ——**数は `shelfList()` から読む。** 書き写すと、分野を足した日に赤くなる
     ②`INDUSTRY_GROUPS` の2組に分かれているか(**呼び名もあちらから読む**)
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
    } else if (got.冊 !== 棚の冊数()) {
      ng(`${名} … 棚が ${棚の冊数()} 冊そろっていない`, String(got.冊))
    } else if (!got.空.includes('分野をえらぶ')) {
      ng(`${名} … 「分野をえらぶ」が無い`,
        '一度開いたら戻せなくなる(**行き止まりを作らない**)')
    } else if (got.組.length !== 組の呼び名().length
      || !組の呼び名().every((l) => got.組.includes(l))) {
      ng(`${名} … 組が ${組の呼び名().join(' / ')} に分かれていない`, got.組.join(' / '))
    } else if (got.いま !== 'it' || !got.名.includes('語')) {
      ng(`${名} … いま開いている冊が選ばれていない(${got.いま} / ${got.名})`,
        '選択肢には語数も出す(0 語なら、まだ空の棚だと分かる)')
    } else if (got.高さ < 40) {
      ng(`${名} … 押せる大きさを割っている`, String(got.高さ))
    } else if (got.よこ > 0 || got.右 > w) {
      ng(`${名} … 横にはみ出している`, `${got.よこ}px / 右 ${got.右}`)
    } else {
      ok(`${名} … ${棚の冊数()}冊が2組に分かれたプルダウン1つ(${got.高さ}px)`)
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
       押せば棚ぜんぶが並ぶ
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
      /* ★ **決め打ちの 700ms で測らない**(第5.413節)。
           読み直しのあいだ、画面は**帯1本**になる(`.wb-stat` が1つも無い)。
           手元で測ると 200ms では札が 0 枚・700ms には 1200 と出るが、
           **混んでいる回だけ 700ms を超える** —— 実際、700 本以上を
           まわしたこの検証の終盤で1度だけ `360 → 0` と赤くなった。
           **直っていないものが赤くなるのは、本当に壊れているものを
           見落とすもと**である(CLAUDE.md)。

           **「読み直しが終わったか」を待つ**(札がそろって、数が変わるまで)。
           待っても変わらなければ、**そのとき見えた数をそのまま出す** ——
           下の `基.語2 <= 基.語` が、ちゃんと赤くする。
           **札が1枚も無いときは `-1`** を返す ——
           0 を返すと「0 語だった」と読めてしまう(0 と null を取り違えない) */
      const 札の合計 = () => page2.evaluate(() => {
        const t = [...document.querySelectorAll('.wb-stat strong')]
        return t.length === 0 ? -1 : t.reduce((a, b) => a + Number(b.textContent || 0), 0)
      })
      await page2.waitForFunction((前) => {
        const t = [...document.querySelectorAll('.wb-stat strong')]
        return t.length > 0
          && t.reduce((a, b) => a + Number(b.textContent || 0), 0) !== 前
      }, 基.語, { timeout: 8000 }).catch(() => { /* 変わらなければ下で赤くなる */ })
      基.語2 = await 札の合計()
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
    } else if (開.冊 !== 棚の冊数()) {
      ng(`${名} … 棚が ${棚の冊数()} 冊そろっていない`, String(開.冊))
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
 * **スピーチは、モノローグ教材とまったく同じ画面で開く**
 * (0054 → 2026-09-30 利用者の指定・第5.323節)
 *
 *   > 普通の他の教材の画面、つまり1枚目の写真と同じ仕様にする様にして
 *   > ください。仕組みも同じです。つまり、モノローグの教材と全て同じです。
 *   > quick response もあります。
 *   > というよりも教材の中の2ページ目に添削の結果を入れます。
 *   > そのページ内では写真に写ってる聴くボタンを伴う各文章の表示は
 *   > 削除します。
 *
 *   もとはスピーチが**自前で練習の画面を組んで**いた(全体を聞く・
 *   文の一覧・訳を見る・速さ)。音声プレーヤーを入れたときに
 *   **見た目が食い違った**(利用者の写真)。
 *
 *   いまは `speechAsMaterial()` で**モノローグ教材の形に組み立て**、
 *   同じ `LessonView` に渡す。添削の結果は **2ページ目**である
 *   (`extraPage`)—— 教材はもともと `◀ 1 / 2 ▶` でページを送るので、
 *   **すでにある道の上に乗る。**
 *
 * **見るのは「同じかどうか」。**
 *   ①教材の枠で開く ②練習の行(6Steps / Quick Response / 集中モード)
 *   ③黒帯が**ふつうの黒帯**である ④1ページ目に1文ずつ 聴く / 訳を見る
 *   ⑤**自前の道具が戻っていない**(出ない側も見る)
 *   ⑥**2ページ目が「添削の結果」**で、直したところ・語句・原稿がある
 *     (同じ見出しは**1つだけ**。中のカードにも題を付けない)
 *     **文がちぎれて並ぶ箱**が1つも無いことも見る
 *   ⑦**2ページ目には、聴くボタンつきの文を1つも出さない**
 *   ⑧横にはみ出さない
 * ══════════════════════════════════════════════════════════════════════ */
for (const w of [1280, 390, 320]) {
  const page = await browser.newPage({ viewport: { width: w, height: 900 } })
  await page.goto(`http://localhost:${PORT}/__bar.html?screen=speechboard`,
    { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  /** いま開いているページの中身。**教材は全ページを描いて、CSS で隠す** */
  const 見る = () => page.evaluate(() => {
    const t = (sel) => [...document.querySelectorAll(sel)]
      .map((x) => (x.getAttribute('aria-label') || x.textContent || '').trim())
    const 開 = [...document.querySelectorAll('.lesson-page:not(.is-closed)')]
    const dock = document.querySelector('.player-dock .player--dock')
    return {
      枠: !!document.querySelector('.lesson'),
      練習: t('.practice-row button'),
      黒帯: dock ? t('.player-dock .player--dock button') : null,
      ページ: document.querySelector('.lesson-pages span')?.textContent?.trim() ?? null,
      見出し: 開.map((x) => (x.querySelector('.lesson-section')?.textContent ?? '').trim()),
      /* **そのページの中**の、聴くボタンつきの文の数 */
      聴く: 開.reduce((n, x) => n + [...x.querySelectorAll('button')]
        .filter((b) => /聴く/.test(b.textContent || '')).length, 0),
      /* **並べる箱(flex / grid)の中で、文がちぎれていないか。**
         字を直に置き、その途中に `<strong>` のような部品を挟むと、
         **前と後ろが別々の部品**になって、**それぞれ勝手に折り返す** ——
         1つの文が3列組みのように崩れる(第5.323節・撮って気づいた)。
         数えるのは「**続きの字のかたまり**が2つ以上あるか」。
         絵 + 字ひとつづき(ふつうの形)は1つなので当たらない */
      ちぎれ: 開.flatMap((x) => [...x.querySelectorAll('*')]).filter((el) => {
        if (!/flex|grid/.test(window.getComputedStyle(el).display)) return false
        let 組 = 0
        let 続き = false
        for (const n of el.childNodes) {
          const 字 = n.nodeType === 3 && n.textContent.trim() !== ''
          if (字 && !続き) 組 += 1
          続き = 字 || (n.nodeType === 3 && !字 && 続き)
          if (n.nodeType === 1) 続き = false
        }
        return 組 >= 2
      }).length,
      /* **同じ見出しが2つ並んでいないか。** ページそのものが
         「添削の結果」という見出しを持っているので、中の札は要らない */
      札: 開.reduce((n, x) => n + [...x.querySelectorAll('h1,h2,h3,h4,h5')]
        .filter((h) => (h.textContent || '').trim() === '添削の結果').length, 0),
      直し: 開.reduce((n, x) => n + x.querySelectorAll('.writing-notes > li').length, 0),
      /* **押せる大きさは、開いてから測る**(第5.325節)。畳んだページは
         高さが 0 になるので、閉じたまま測ると**いつでも 0 で赤い** */
      小: Math.min(99, ...開.flatMap((x) => [...x.querySelectorAll('.btn')])
        .map((b) => Math.round(b.getBoundingClientRect().height))),
      語句: 開.reduce((n, x) => n + x.querySelectorAll('.writing-phrases > li').length, 0),
      原稿: 開.some((x) => !!x.querySelector('.speech-edit textarea')),
      /* **出ない側。** 自前の道具が戻っていないか */
      自前: document.querySelectorAll('.player-dock--inline').length
        + document.querySelectorAll('.speech-sentences').length
        + document.querySelectorAll('.speech-swap').length,
      よこ: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }
  })
  const 一 = await 見る()
  /* **2ページ目へ送る。** 送れなければ、ページが増えていない */
  const 送れた = await page.evaluate(() => {
    const b = document.querySelector('.lesson-pages button[aria-label="次のページ"]')
    if (!b || b.disabled) return false
    b.click(); return true
  })
  await page.waitForTimeout(300)
  const 二 = 送れた ? await 見る() : null
  await page.close()

  const 名 = `スピーチ(${w}px)`
  const 黒帯の数 = 一.黒帯?.length ?? 0
  if (!一.枠) {
    ng(`${名} … 教材の画面で開いていない`, '`.lesson` が無い')
  } else if (!一.練習.includes('6Steps') || !一.練習.includes('Quick Response')
    || !一.練習.includes('集中モード')) {
    /* **利用者の指定「quick response もあります」** */
    ng(`${名} … 練習の行がそろっていない`, 一.練習.join(' / ') || '(空)')
  } else if (黒帯の数 !== 7) {
    /* くり返し / 速さ / 段落もどる / 文もどる / 全体を聴く / 文すすむ / 段落すすむ */
    ng(`${名} … 黒帯の持ちものが ${黒帯の数} 個(ふつうの教材は 7 個)`,
      (一.黒帯 ?? []).join(' / ') || '黒帯そのものが無い')
  } else if (!一.聴く) {
    ng(`${名} … 1ページ目に、1文ずつの「聴く」が出ていない`)
  } else if (一.自前) {
    ng(`${名} … 自前で組んだ練習の道具が戻っている`, `${一.自前} 個`)
  } else if (!送れた || !二) {
    ng(`${名} … 2ページ目が無い`, `札は「${一.ページ}」`)
  } else if (!二.見出し.includes('添削の結果')) {
    ng(`${名} … 2ページ目が「添削の結果」になっていない`,
      二.見出し.join(' / ') || '(見出しなし)')
  } else if (二.聴く !== 0) {
    /* **利用者の指定**「そのページ内では…各文章の表示は削除します」 */
    ng(`${名} … 2ページ目に、聴くボタンつきの文が ${二.聴く} 個ある`,
      '添削の結果のページには出さない')
  } else if (二.ちぎれ) {
    ng(`${名} … 2ページ目に、文がちぎれて並ぶ箱が ${二.ちぎれ} 個ある`,
      '並べる箱(flex / grid)の中に、字を直に置いている')
  } else if (二.札 !== 1) {
    /* **同じ言葉を2つ並べない**(CLAUDE.md「呼び名を2か所に書かない」)。
       ページの見出しと、中のカードの題が、どちらも「添削の結果」だった */
    ng(`${名} … 「添削の結果」という見出しが ${二.札} 個ある(1個のはず)`)
  } else if (二.小 < 34) {
    ng(`${名} … 2ページ目の押せる大きさを割っている`, `${二.小}px`)
  } else if (二.直し !== 1 || 二.語句 !== 2 || !二.原稿) {
    /* **黙って消さない。** 移した先に、ちゃんと中身がある */
    ng(`${名} … 2ページ目に、添削の結果や原稿が出ていない`,
      `直し ${二.直し} / 語句 ${二.語句} / 原稿 ${二.原稿}`)
  } else if (一.よこ > 0 || 二.よこ > 0) {
    ng(`${名} … 横にはみ出している`, `${一.よこ}px / ${二.よこ}px`)
  } else {
    ok(`${名} … モノローグ教材とまったく同じ画面`
      + `(${一.ページ} → ${二.ページ} / 練習の行 ${一.練習.length} /`
      + ` 黒帯 ${黒帯の数} / 1ページ目の聴く ${一.聴く} /`
      + ` 2ページ目は「添削の結果」で聴く ${二.聴く})`)
  }
}

/* ══════════════════════════════════════════════════════════════════════
 * **セッションの記録を、まとめて一本化**(第5.303節・2026-09-28 利用者の指定)
 *
 *   > ゲストとトレーナー共有のセッションの記録をまとめて一本化、
 *   > つまり日付と内容を見出しをつけてまとめて出力する機能や、
 *   > セッションの記録内の単語やフレーズを元に教材を作れたりすると最高です。
 *
 * **描かないと分からないこと**を測る ——
 *   ①日付ごとに見出しが付いて並ぶか(**新しい日から**)
 *   ②誰の記録かが、節ごとに出るか(トレーナー / ゲスト)
 *   ③**改行がそのまま**出ているか(白い紙と同じ見え方)
 *   ④語句の札が出て、選んでいるときだけ「この語で教材を作る」が出るか
 *   ⑤押せる大きさ ⑥横にはみ出していないか
 *
 * **「出る」と「出ない」の両方を見る**(CLAUDE.md)——
 * ④は `role=learner`(教材を作れない人)で**欄ごと出ない**ことまで見る。
 * 出す側だけを見ていると、**誰にでも出す形**に変えても緑のままになる。
 * ══════════════════════════════════════════════════════════════════════ */
for (const w of [1280, 390, 320]) {
  const page = await browser.newPage({ viewport: { width: w, height: 900 } })
  await page.goto(`http://localhost:${PORT}/__bar.html?screen=notesdigest`,
    { waitUntil: 'networkidle' })
  await page.waitForTimeout(250)
  const got = await page.evaluate(() => {
    const px = (el) => (el ? Math.round(el.getBoundingClientRect().height) : 0)
    const right = (el) => (el ? Math.round(el.getBoundingClientRect().right) : 0)
    const days = [...document.querySelectorAll('.ndg-day')]
    const btns = [...document.querySelectorAll('.ndg .btn')]
    const text = document.querySelector('.ndg-part .notes-read')
    return {
      日: days.length,
      見出し: days.map((d) => d.querySelector('.ndg-date')?.textContent.trim() ?? ''),
      /* **誰の記録かを、節ごとに出す。** 1本にまとめた紙で、
         どちらが書いたか分からなくなってはいけない */
      誰: days.map((d) => [...d.querySelectorAll('.field-label')]
        .map((e) => e.textContent.trim()).join('|')),
      /* **改行はそのまま**(`white-space: pre-wrap`)。
         **値ではなく性質で見る**(CLAUDE.md)—— 書いた数を写さない */
      改行: text ? window.getComputedStyle(text).whiteSpace : '',
      語句: document.querySelectorAll('.ndg-chips .btn').length,
      作る: [...document.querySelectorAll('.ndg-words-head .btn')]
        .some((b) => b.textContent.includes('教材を作る')),
      刷る: !!document.querySelector('.ndg-print'),
      /* **紙は、押すまで描かない**(単語帳と同じ作法)*/
      紙: document.querySelectorAll('#review-sheet').length,
      小: Math.min(...btns.map(px)),
      よこ: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      右: Math.max(0, ...btns.map(right), ...days.map(right)),
    }
  })
  await page.close()

  /* **ゲスト(教材を作れない人)には、語句の欄ごと出さない** */
  const p2 = await browser.newPage({ viewport: { width: w, height: 900 } })
  await p2.goto(`http://localhost:${PORT}/__bar.html?screen=notesdigest&role=learner`,
    { waitUntil: 'networkidle' })
  await p2.waitForTimeout(200)
  const 素 = await p2.evaluate(() => ({
    欄: document.querySelectorAll('.ndg-words').length,
    札: document.querySelectorAll('.ndg-chips .btn').length,
    日: document.querySelectorAll('.ndg-day').length,
  }))
  await p2.close()

  const 名 = `記録のまとめ(${w}px)`
  if (got.日 !== 2) {
    ng(`${名} … 日付ごとの節が並んでいない`, String(got.日))
  } else if (!/^9\/27/.test(got.見出し[0]) || !/^9\/24/.test(got.見出し[1])) {
    // **新しい日から**(1日ずつの画面と同じ向き)
    ng(`${名} … 見出しが日付になっていない(新しい日から)`, got.見出し.join(' / '))
  } else if (got.誰[0] !== 'トレーナーの記録|ゲストの記録') {
    ng(`${名} … 誰の記録かが節ごとに出ていない`, got.誰.join(' / '))
  } else if (got.誰[1] !== 'トレーナーの記録') {
    // **空の欄は出さない**(見出しだけの節を作らない)
    ng(`${名} … 空の欄まで見出しが出ている`, got.誰.join(' / '))
  } else if (got.改行 !== 'pre-wrap') {
    ng(`${名} … 改行がそのまま出ていない`, got.改行)
  } else if (got.語句 < 3) {
    ng(`${名} … 記録の中の語句が拾えていない`, String(got.語句))
  } else if (!got.作る) {
    ng(`${名} … 選んでいるのに「この語で教材を作る」が出ない`)
  } else if (!got.刷る) {
    ng(`${名} … 紙に出すボタンが無い`)
  } else if (got.紙 !== 0) {
    ng(`${名} … 押していないのに紙を描いている`, String(got.紙))
  } else if (got.小 < 34) {
    ng(`${名} … 押せる大きさを割っている`, `${got.小}px`)
  } else if (got.よこ > 0 || got.右 > w) {
    ng(`${名} … 横にはみ出している`, `${got.よこ}px / 右 ${got.右}`)
  } else if (素.欄 !== 0 || 素.札 !== 0) {
    // **出ない側**。教材を作れない人に、効かない操作を見せない
    ng(`${名} … 教材を作れない人にも語句の欄が出ている`, `${素.欄} / ${素.札}`)
  } else if (素.日 !== 2) {
    // **消しすぎていないか。** 記録そのものは、どちらにも出る
    ng(`${名} … 教材を作れない人には記録まで出ていない`, String(素.日))
  } else {
    ok(`${名} … ${got.日} 日ぶんが見出し付きで並び、語句 ${got.語句} から教材を作れる`
      + '(教材を作れない人には語句の欄ごと出ない)')
  }
}

/* ══════════════════════════════════════════════════════════════════════
 * **トレーナーのスピーチの画面**(第5.305節・2026-09-29 利用者の指定)
 *
 *   > `npm run test:bar` は `SpeechBoard`(トレーナーのスピーチ画面)を
 *   > 1度も描いていません。測れる形に切り出しますか →はい
 *
 * **これまで1度も描いていなかった。** `SpeechBoard` が自分で
 * `loadSpeeches()` を呼ぶので、Supabase の無いこの環境では
 * 「読み込んでいます…」のままだったためである。
 *
 *   ①一覧・畳み・欄・声・添削・消す が、ぜんぶ描かれるか
 *   ②**添削ずみ / まだ** の両方で形が変わるか(畳みが出る / 出ない)
 *   ③**ゲストには、添削のボタンも調子の欄も出ない**(出ない側)
 *   ④長すぎる原稿で、**押せないボタンと、その理由**が出るか
 *   ⑤押せる大きさ ⑥横にはみ出していないか
 * ══════════════════════════════════════════════════════════════════════ */
for (const w of [1280, 390, 320]) {
  const 見る = async (q) => {
    const page = await browser.newPage({ viewport: { width: w, height: 900 } })
    await page.goto(`http://localhost:${PORT}/__bar.html?screen=speechboard${q}`,
      { waitUntil: 'networkidle' })
    await page.waitForTimeout(250)
    const got = await page.evaluate(() => {
      const px = (el) => (el ? Math.round(el.getBoundingClientRect().height) : 0)
      const right = (el) => (el ? Math.round(el.getBoundingClientRect().right) : 0)
      /* ★ **教材の画面で開いたときも数える**(第5.323節)。
           添削ずみのスピーチは `.speechboard` を通らず、
           **教材の2ページ目**(`.speech-edit`)に出る */
      const btns = [...document.querySelectorAll('.speechboard .btn, .speech-edit .btn')]
      const ask = [...document.querySelectorAll('.writing-tools .btn')][0] ?? null
      return {
        一覧: document.querySelectorAll('.speech-list .speech-pick').length,
        札: [...document.querySelectorAll('.speech-flag')].map((e) => e.textContent.trim()),
        欄: document.querySelectorAll('.speech-edit .field').length,
        原稿: !!document.querySelector('.speech-edit textarea'),
        /* **畳みは、添削が済んだときだけ**(第5.301節) */
        畳み: [...document.querySelectorAll('.speech-edit > details > summary')]
          .map((e) => e.textContent.replace(/\s+/g, ' ').trim()),
        本文: document.querySelectorAll('.speech-body-text').length,
        数: document.querySelectorAll('.speech-count').length,
        声: document.querySelectorAll('.voice-row select').length,
        調子: document.querySelectorAll('.writing-tone select').length,
        頼む: ask ? ask.textContent.trim() : '',
        押せる: ask ? !ask.disabled : null,
        断り: document.querySelectorAll('.writing-handoff').length,
        長い: [...document.querySelectorAll('.speech-edit .notice--error')]
          .some((e) => /長すぎます/.test(e.textContent)),
        消す: [...btns].some((b) => b.textContent.includes('このスピーチを消す')),
        練習: document.querySelectorAll('.speech-practice').length,
        小: btns.length ? Math.min(...btns.map(px)) : 0,
        よこ: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        右: Math.max(0, ...btns.map(right),
          ...[...document.querySelectorAll('.speech-edit .field')].map(right)),
      }
    })
    await page.close()
    return got
  }

  /* ★ **本物は、添削ずみを開くと教材の画面を返してそこで終わる**
       (第5.323節 → 第5.325節で骨組みをそろえた)。
       **一覧と教材の画面が同時に出ることは無い**ので、
       一覧は「**何も開いていない**」形で測る */
  const 素 = await 見る('&open=no')             // 何も開いていない … 一覧と札
  const 素客 = await 見る('&open=no&role=learner')
  const 済 = await 見る('')                     // 添削ずみを開いた … 教材の2ページ目
  const 未 = await 見る('&done=no')             // 下書きを開いた … 板の画面
  const 客 = await 見る('&done=no&role=learner')
  const 長 = await 見る('&done=no&long=1')

  const 名 = `スピーチの画面(${w}px)`
  if (素.一覧 !== 2) {
    ng(`${名} … スピーチの一覧が描かれていない`, String(素.一覧))
  } else if (素.札.join('/') !== '添削ずみ/下書き') {
    // **色だけに頼らない**(言葉でも言う)
    ng(`${名} … 添削ずみ / 下書きの札が出ていない`, 素.札.join('/'))
  } else if (済.一覧 !== 0) {
    /* ★ **出ない側**(第5.325節)。添削ずみを開いたら、教材の画面だけ ——
         一覧が後ろに残っていたら、**本物には無い画面**である */
    ng(`${名} … 添削ずみを開いても、一覧が残っている`, String(済.一覧))
  } else if (!済.原稿 || 済.声 !== 2) {
    ng(`${名} … 原稿の欄か、声の欄が出ていない`, `原稿 ${済.原稿} / 声 ${済.声}`)
  } else if (済.畳み.length !== 2 || !/直した本文/.test(済.畳み[0])
    || !/原稿を直す/.test(済.畳み[1])) {
    // **添削が済んだら、直した本文と原稿の2つが畳まれる**(第5.301節)
    ng(`${名} … 添削ずみなのに、畳みが2つそろっていない`, 済.畳み.join(' / '))
  } else if (済.本文 !== 1) {
    ng(`${名} … 一本化した本文が出ていない`, String(済.本文))
  } else if (未.畳み.length !== 0 || 未.本文 !== 0 || 未.数 !== 1) {
    /* **まだ添削していないときは、畳まない。** これが「出ない側」——
       いつも畳む形に変えても、上だけ見ていれば緑のままになる */
    ng(`${名} … まだ添削していないのに畳んでいる`,
      `畳み ${未.畳み.length} / 本文 ${未.本文} / 文字数 ${未.数}`)
  } else if (済.調子 !== 1 || !/添削してもらう/.test(済.頼む) || 済.断り !== 0) {
    ng(`${名} … トレーナーに添削の欄が出ていない`, `${済.調子} / ${済.頼む}`)
  } else if (客.調子 !== 0 || 客.頼む !== '' || 客.断り !== 1) {
    /* **ゲストには出さない**(効かない操作を見せない)。
       ただし**どこへ行くのか**は1行で言う(黙って消さない) */
    ng(`${名} … ゲストにも添削のボタンが出ている`,
      `調子 ${客.調子} / ボタン「${客.頼む}」/ 断り ${客.断り}`)
  } else if (素客.一覧 !== 2 || !客.原稿) {
    // **消しすぎていないか。** 原稿も一覧も、ゲストにも出る
    ng(`${名} … ゲストには原稿まで出ていない`, `${素客.一覧} / ${客.原稿}`)
  } else if (!長.長い || 長.押せる !== false) {
    /* **押せないボタンの理由が、畳みの外に出ているか**(第5.301節) */
    ng(`${名} … 長すぎる原稿で、理由が出ないか、まだ押せる`,
      `知らせ ${長.長い} / 押せる ${長.押せる}`)
  } else if (!済.消す) {
    ng(`${名} … 消す道がその場に無い`)
  } else if (済.練習 !== 1 || 未.練習 !== 0) {
    /* **添削が済むまで練習を出さない**(まちがった英語を手本にしない) */
    ng(`${名} … 練習の出し分けが効いていない`, `済 ${済.練習} / 未 ${未.練習}`)
  } else if (未.小 < 34 || 素.小 < 34) {
    /* ★ **見えている画面で測る**(第5.325節)。教材の2ページ目は
         畳まれている(`display: none`)ので、そこの高さは 0 になる ——
         **2ページ目の押せる大きさは、開いてから測る**(スピーチの節) */
    ng(`${名} … 押せる大きさを割っている`, `下書き ${未.小}px / 一覧 ${素.小}px`)
  } else if (済.よこ > 0 || 未.右 > w || 長.よこ > 0 || 素.よこ > 0) {
    ng(`${名} … 横にはみ出している`,
      `${済.よこ}px / 右 ${未.右} / 長い原稿 ${長.よこ}px / 一覧 ${素.よこ}px`)
  } else {
    ok(`${名} … 一覧 ${素.一覧} 本・畳み2つ・声2つ・添削と練習が出る`
      + '(添削ずみを開くと教材の画面だけ / まだ添削していないときは畳まない'
      + ' / ゲストには添削の欄ごと出ない)')
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

  /* ★ **例文はいつもつく。巻末のレクチャーは廃止した**
       (2026-10-09 利用者の指定)。`?ex=off` / `?frames=off` は無くなった */
  const 既定 = await 測る('')

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
  } else if (既定.レクチャー) {
    /* ★ **巻末のレクチャーは廃止した**(2026-10-09 利用者の指定
         「巻末にレクチャーも不必要、かつ設定も必要ありません」)。
         **出ていたら赤** —— 戻ってきたことに気づける */
    ng('紙 … 廃止した巻末のレクチャーが、まだ刷られている', `${既定.型の数} 型`)
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

    /* **本当に段が減っているか。**
       名札が2段目へ折り返す幅では、消せば1段ぶん戻るはずである。

       ★ **幅を決め打ちしない**(2026-09-29 に踏んだ)。
         もとは 390px と 1024px を名指ししていた。ところが
         **1024px は、もう折り返さない** —— 文字 / 幅 / 印刷を
         「設定」の吹き出しへ移した(第5.312節)ぶん帯が短くなり、
         名札があっても1行に収まるようになったからである。
         **画面が良くなったのに、見張りだけが赤くなった。**
         だから「折り返している幅を**測って見つけ**、そこで数える」。

       **1つも折り返さなければ赤**(CLAUDE.md「無ければ素通りする形を
       書かない」)—— そのときは、この見張りは何も数えていない。 */
    {
      const 効いた = []
      for (const w of [320, 390, 560, 1024]) {
        const 指 = await 測る(w, true)
        const マウス = await 測る(w, false)
        /* マウス(名札あり)が1行に収まっているなら、消しても戻る段が無い */
        if (マウス.高さ <= 60) continue
        効いた.push(w)
        if (指.高さ < マウス.高さ) {
          ok(`名札を消す … ${w}px で1段ぶん戻った(${マウス.高さ} → ${指.高さ}px)`)
        } else {
          ng(`名札を消す … ${w}px で画面が広くなっていない`, `${マウス.高さ} → ${指.高さ}px`)
        }
      }
      if (!効いた.length) {
        ng('名札を消す … どの幅でも名札が2段目へ折り返さない',
          'この見張りは何も数えていない(測る相手が居ることを、先に確かめる)')
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
  /* ★ **道具は「出しかた」から出た**(第5.414節・段階3・利用者の指定)。
       聞き流しは**上の帯**へ、紙は **☰ の中**へ移した。
       だから「出しかたの中に道具が2つ」は、もう**無いのが正しい** ——
       **「出る」と「出ない」の両方を見る**(CLAUDE.md) */
  await page.evaluate(() => { document.querySelector('.rscope-sort')?.click() })
  await page.waitForTimeout(500)
  const 道具 = await page.evaluate(() =>
    [...document.querySelectorAll('.sheet .wb-listen, .setpop .wb-listen')]
      .map((x) => x.textContent.trim()))
  await page.evaluate(() => { document.querySelector('.sheet-back')?.click() })
  await page.waitForTimeout(300)
  /* **「出しかた」の中のものを、名指しで押す。**
     2026-09-26 に帯のボタンが「🔊 聞き流し」になり、**文字が同じになった。**
     `querySelectorAll('button')` から文字で探すと、
     **DOM で先に出てくる帯のほうに当たる** ——
     どちらも `listen()` を呼ぶので**緑のまま**で、
     この見張りは「出しかた」を測らなくなる
     (CLAUDE.md「置き換える前に `grep -n` で数える」の、測る側での同じ話)。 */
  /* ★ **上の帯の聞き流しを、名指しで押す**(第5.414節)。
       `querySelectorAll('button')` から文字で探すと、同じ言葉の
       ほかのボタンに当たる(CLAUDE.md「置き換える前に数える」)。
       **ここは Quick Response の画面**なので `qr-top-listen` である ——
       単語帳の `wb-top-listen` を書いていて、1本も押せていなかった
       (「練習の画面から押しても、何も出ない」が出ていた)。
       **どちらの画面でも押せるように、両方を並べる**
       (片方しか無いので、取り違えようがない)。 */
  await page.evaluate(() => {
    document.querySelector('.wb-top-listen, .qr-top-listen')?.click()
  })
  await page.waitForTimeout(1500)
  const 流 = await page.evaluate(() => ({
    ある: !!document.querySelector('.radio'),
    文: (document.querySelector('.radio')?.textContent ?? '').replace(/\s+/g, ' ').slice(0, 120),
  }))
  if (道具.length !== 0) {
    ng('聞き流し … 「出しかた」に道具が残っている(☰ と上の帯へ移した)',
      道具.join(' / '))
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
      /* ★ **`networkidle` を待たない**(第5.285節)。聞き流しは
         **間も音で置く**ようになったので、`<audio>` が途切れずに
         読み込み続ける —— Chromium はそれを「まだ通信中」と数えるため、
         **この画面は二度と `networkidle` にならない**(実測・30 秒で落ちた)。
         描けたかどうかは、**出るはずのものを待って**確かめる */
      { waitUntil: 'domcontentloaded' })
      await page.waitForSelector('.radio-card', { timeout: 20000 })
    await page.waitForTimeout(300)
    /* **設定を開いてから測る**(第5.271節 → 第5.274節で右上の歯車へ)。
       開かないと欄そのものが描かれていない */
    await page.click('.radio-gear')
    await page.waitForTimeout(150)
    const r = await page.evaluate(() => {
      const sel = document.querySelector('.radio-set-pick--song')
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
    /* **「まだ」を押し切る。** 20 回まで(1回ぶんは 10 問なので足りる)。

       ★ **ボタンの字を、そのまま書き写していた**(2026-10-08 に踏んだ)。
         `=== 'まだ'` と完全一致で探していたので、第5.417節で
         **キーの印が付いて「まだ ↓」になったとたん、1回も押せなくなった**
         —— 終わりの画面まで行けず、**この見張りが丸ごと死んだ。**
         仕組みは1ミリも壊れていないのに赤くなる形である
         (CLAUDE.md「式も、関数の名前も書き写さない」)。

       **印は `keyLabel()` 1か所から取る。** 指の端末では付かないので、
       **付いた形と付かない形の両方**を候補にする —— どちらで描かれても
       当たるし、**「まだ」そのものが変わったら赤くなる。** */
    const 押す字 = [keyLabel('まだ', 'yet'), keyLabel('まだ', 'yet', { keys: false })]
    for (let i = 0; i < 20; i += 1) {
      const 押せた = await page.evaluate((候補) => {
        const b2 = [...document.querySelectorAll('.qr-answers button')]
          .find((x) => 候補.includes((x.textContent || '').replace(/\s+/g, ' ').trim()))
        if (!b2) return false
        b2.click()
        return true
      }, 押す字)
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

  /* ★ **ゲストの名前を、はじめから並べない**(第5.398節・2026-10-06 実機)。

       > このゲストを選択する部分も普段は閉じておいてください。
       > ゲストと画面共有をしながらだと気まずいです。
       > 検索と、一覧を開く仕様にするべきです。

     この画面だけが**自前の札の一覧**を持っており、担当25人の名前が
     常に並んでいた。えらぶ欄は `LearnerPick` 1か所に寄せてある。

     **「開く前は0人、開いたら全員」の両方を見る**(CLAUDE.md)——
     片方だけだと、**どこにも出さない形**に書き換えても緑のままになる。 */
  {
    const 名前の数 = () => page.locator('.learner-pick .assign-list label').count()
    const 閉 = await 名前の数()
    const ひらく = page.locator('.learner-pick-head button')
    const あるか = await ひらく.count()
    if (!あるか) {
      ng('ゲストの欄 … 「一覧をひらく」が無い', '自前で札を並べていないか')
    } else if (閉 !== 0) {
      ng('ゲストの欄 … 開く前から名前が並んでいる', `${閉} 人ぶん見えている`)
    } else {
      await ひらく.first().click()
      await page.waitForTimeout(250)
      const 開 = await 名前の数()
      if (開 === 0) ng('ゲストの欄 … 開いても1人も出ない')
      else {
        /* **打てば、開いていなくても出る**(行き止まりを作らない) */
        await ひらく.first().click()
        await page.waitForTimeout(200)
        /* **`type` を書いていない入力である**(`SearchBar`)——
           `[type="text"]` では当たらない。**打てるものだけを外す** */
        await page.locator(
          '.learner-pick input:not([type="checkbox"]):not([type="radio"])',
        ).first().fill('検証ゲスト1')
        await page.waitForTimeout(250)
        const 打 = await 名前の数()
        if (打 === 0) ng('ゲストの欄 … 名前を打っても出ない')
        else ok(`ゲストの欄 … 既定は 0 人、開くと ${開} 人、打つと ${打} 人`)
      }
    }
    await page.goto(`http://localhost:${PORT}/__bar.html?screen=form&kind=reading`,
      { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(600)
  }

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
    /* ★ **紙に出す道具は、右上の「出しかた」の中**(2026-10-09 利用者の指定
         「左のハンバーガーに入れるのをやめてください。右上のメニューに」)。
         第5.414節では ☰ の中だったので、そちらを開いていた */
    if (got.紙 === null) {
      /* **先に、開いているシートを閉じる。** 本棚のシートが上に重なったまま
         だと「出しかた」が開かない(2026-10-09 に踏んだ) */
      await page.keyboard.press('Escape')
      await page.waitForTimeout(300)
      await page.evaluate(() => { document.querySelector('.rscope-sort')?.click() })
      await page.waitForTimeout(800)
      got = await 読む()
      await page.evaluate(() => { document.querySelector('.rscope-sort')?.click() })
      await page.waitForTimeout(300)
    }
    return got
  }
  /** 描かれているものを、そのまま読む */
  const 読む = () => page.evaluate(() => {
    const 拾う = (re) => {
      for (const b of document.querySelectorAll('button')) {
        /* ★ **読み上げの側も読む**(第5.414節)。上の帯の聞き流しは
             帯を2段にしないため**絵 + 短い言葉**にしてあり、
             語数は `aria-label` が持っている(消していない) */
        const t = `${b.textContent || ''}${b.getAttribute('aria-label') || ''}`
        const m = re.exec(t.replace(/\s+/g, ''))
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

  /** 紙のボタンの問数。★ **練習中は ☰ の中に入っている**(第5.414節) */
  const 問数 = async () => {
    const 拾う = () => qp.evaluate(() => {
      for (const b of document.querySelectorAll('button')) {
        const m = /印刷\/PDFで保存\((\d+)問\)/.exec((b.textContent || '').replace(/\s+/g, ''))
        if (m) return Number(m[1])
      }
      return null
    })
    let n = await 拾う()
    /* ★ **紙に出す道具は、右上の「出しかた」の中**(2026-10-09 利用者の指定)。
         第5.414節では ☰ の中だったので、そちらを開いていた */
    if (n === null) {
      /* **先に、開いているシートを閉じる**(上に重なっていると開かない) */
      await qp.keyboard.press('Escape')
      await qp.waitForTimeout(300)
      await qp.evaluate(() => { document.querySelector('.rscope-sort')?.click() })
      await qp.waitForTimeout(800)
      n = await 拾う()
      await qp.evaluate(() => { document.querySelector('.rscope-sort')?.click() })
      await qp.waitForTimeout(300)
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
  /* **12ある**(第5.257節で「音楽」が3つに割れ、
     第5.372節で「オフラインの音声」、第5.373節で「相棒」、
     第5.432節で「曲を入れる」が増えた)。
     **一度入れたものを勝手に減らさない**(共通ルール)。

     ★ **この一覧は、画面から読み取らない。** 読み取ると、
       行を消した日に期待も一緒に消えて**緑のまま**になる
       (第5.337節で踏んだ「見張りが、自分と同じ出どころを見ている」)。
       だから**手で並べる。足した日には、必ず一度赤くなる。** */
  const WANT_SET = ['配色', '色づかい', '説明の文', '相棒', '押したときの音',
    '英語の音声', '音楽', '曲', '音楽の大きさ', '曲を入れる',
    '教材の支度', 'オフラインの音声']
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
        /* **設定の絵は「三本線と丸」か**(2026-09-29 利用者の指定)
           > これから歯車は使いません。全て3本線と丸のものに統一です

           **歯車を見張っていた本を、そのまま書き換えた。**
           歯車には「歯が本体と地続きの1本の輪郭か」を数える本があった
           (離れた線8本だと 18px で太陽に見えたため・第5.189節)。
           絵が変わったので、**その絵に効く数え方**へ置き換える。

           三本線と丸は **3段 ×(線2本 + つまみ1つ)**である。
           ★ **つまみの位置は、わざとずらしてある。** そろえると
             「ただの三本線」に見え、第5.262節で言われた運動靴の印に戻る。
             だから **`cx` が3つとも同じなら赤**にする —— ここが、
             「絵がある」だけを見ないための1本である。 */
        絵: (() => {
          const sv = sums[0]?.querySelector('svg')
          if (!sv) return null
          const cs = [...sv.querySelectorAll('circle')]
          return {
            つまみ: cs.length,
            線: sv.querySelectorAll('path').length,
            /* つまみの左右の位置。**3つとも同じなら、ずらしていない** */
            位置: cs.map((c) => Number(c.getAttribute('cx'))),
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
    } else if (!閉.絵) {
      ng(`設定 ${W}px … 「設定」に絵が無い`)
    } else if (閉.絵.つまみ !== 2) {
      ng(`設定 ${W}px … 設定の絵のつまみが ${閉.絵.つまみ} つ`,
        '★ 横線2本 + つまみ2つ(第5.415節・利用者の指定)にそろえる')
    } else if (閉.絵.線 < 4) {
      /* ★ **2段 ×(つまみの左右に1本ずつ)= 4本**(第5.415節) */
      ng(`設定 ${W}px … 設定の絵の線が ${閉.絵.線} 本`,
        '2段 ×(つまみの左右に1本ずつ)= 4本')
    } else if (new Set(閉.絵.位置).size < 2) {
      /* **「絵がある」だけを見ない。** つまみをそろえて
         「ただの二本線」に戻したら赤くなる(第5.262節 / 第5.415節) */
      ng(`設定 ${W}px … 2つのつまみがそろっていて、ただの二本線に見える`,
        `位置 ${閉.絵.位置.join(' / ')}。**わざとずらす**(メニューの印に戻る)`)
    } else if (閉.高 < 40) {
      ng(`設定 ${W}px … 「設定」が ${閉.高}px しかなく、指で狙えない`)
    } else if (閉.はみ出し > 0) {
      ng(`設定 ${W}px … メニューの下が ${閉.はみ出し}px 横にはみ出している`)
    } else {
      ok(`設定 ${W}px … 畳んで「設定」1つ(${閉.高}px)・`
        + `自分の欄より上・横線2本 + つまみ(線 ${閉.絵.線}・`
        + `つまみ ${閉.絵.つまみ}・ずれている)・`
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

/* 見る画面。**押すものが縦に積まれるところ**を中心に並べる。
   **画面を足したら、ここにも足す** —— 足すまで見張られない */
const SCREENS = [
  /* ★ **ホーム**(第5.431節)。見出しと行が縦に積まれ、
       行の中では**絵・名前・矢印が横に並ぶ。**
       `one=1` は**組が1つだけ**(見出しが出ない形) */
  ['home', ''], ['home', 'one=1'],
  ['tools', ''], ['form', ''], ['search', ''], ['qr', ''], ['qrrev', ''],
  /* **テスト対策の、試験と PART**(第5.309節)。**横に2つ並ぶ**ので、
     横のすき間がいちばん出やすい。作れない PART の1行も、
     その下にくっつきうる(`?screen=form` の既定はモノローグなので、
     **種類を渡さないと1度も描かれない**) */
  ['form', 'kind=exam'],
  /* ★ **応答問題の欄**(0073・第5.332節)。出どころ・冊・UNIT・問題数・
       出し方・えらび方が**6つ縦に並ぶ**ので、縦のすき間が出やすい。
       さらに「表現をえらぶ」の下に**知らせの行**が出入りする */
  ['form', 'kind=response'],
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
  /* **セッションの記録のまとめ**(第5.303節)。帯・語句の札・日付ごとの節が
     縦に積まれ、**帯の中と語句の見出しの行は横に並ぶ。**
     `role=learner` は**語句の欄そのものが出ない**形(節の数が変わる) */
  ['notesdigest', ''], ['notesdigest', 'role=learner'],
  /* **トレーナーのスピーチの画面**(第5.305節)。一覧・畳み・欄・声の行・
     添削の行・消す行が縦に積まれ、**声は2つ横に並ぶ。**
     `done=no` は**まだ添削していない**形(畳みが無く、文字数の行が出る)、
     `role=learner` は**添削の欄ごと出ない**形 */
  ['speechboard', ''], ['speechboard', 'done=no'], ['speechboard', 'role=learner'],
  ['', 'role=trainer&who=g1'],
  /* ★ **応答問題のレッスン表示**(第5.334節)。練習の行に
       「応答を聞き流す」が増えて **4つ横に並ぶ**ので、
       狭い画面では折り返す —— **横のすき間がいちばん出やすい形**である。
       **ボタンの色**も、ここで数えられる(地の色のままなら赤くなる) */
  ['', 'role=trainer&who=g1&kind=response'],
]

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
    /* **「聞き流しをやめる」の名指しは外した**(第5.280節・2026-09-27)。

       第5.276節では白(色を1つも足さない)にしたので、
       ここに名指しで置くしかなかった。利用者の指定で
       **グレー(`btn--ghost`)に戻した**いま、**この決まりを
       そのまま守れる** —— だから外す。
       **名指しの外しは、減らせるときに減らす。** 増えるほど、
       見張りは何も守らなくなる。 */
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
    const 札 = await 見える('.lesson-more')
    if (札) { await gear.first().click(); await page.waitForTimeout(250) }
    const 開いたあと = await 見える('.focus-ver')
      ? (await page.locator('.focus-ver').first().textContent()).trim() : ''
    /* **どこまで来たかを、必ず持ち帰る**(CLAUDE.md「道が2つあるものは、
       いまどちらを通ったかを見えるようにしてから直す」)。
       これが無いと、赤くなったときに**画面が描けていないのか・
       札が出ていないのか**が分からない */
    const 様子 = await page.evaluate(() => ({
      枠: !!document.querySelector('.focus'),
      札の数: document.querySelectorAll('.lesson-more').length,
      欄: document.querySelector('.lesson-settings')?.className ?? '(無し)',
      札: document.querySelector('.focus-ver')?.textContent ?? '(無し)',
    }))
    await page.close()
    return { 閉じたまま, 開いたあと, 札, 様子 }
  }

  const あと = (r) => `枠 ${r.様子.枠} / 表示 ${r.様子.札の数}(見える ${r.札})`
    + ` / 欄「${r.様子.欄}」/ 札「${r.様子.札}」`
  const 狭 = await 見る(390)
  /* **まず、画面が描けているか。** ここが偽なら、下の2本は
     「出ない」ではなく「そもそも見ていない」である */
  if (狭.様子.枠 && 狭.様子.札の数 === 1) {
    ok('版 … 骨組みの集中モードが描けている(「表示」あり)')
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
        同じ英文和訳のページにある問で見る ── */
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
  await 送り.click()          // 英文和訳のページ(和訳)→ 2(英訳)→ 3(誤り訂正)
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
   **ゲストの持ちものからテストを作る**
   (第5.260節 → **第5.263節で作り直した**)

     > ゲストのページに教材や彼らの単語帳、quick response 帳があります。
     > それらのデータを基にテストを作りたいです。(2026-09-25)
     > テストは、ひとつの教材としてちゃんと作ってください。(2026-09-26)

   **算段は `npm run test:play` が見る。ここは描いて測る。**

   **問題はこの画面に並ばない**(第5.263節)—— 押すと教材が1本できて
   共有され、過去の宿題へ移る。だから測るのは**えらぶところ**だけである。

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
    /* **ボタンの文字に寄りかからない。** 第5.263節で
       「テストを作る」→「テストを作って共有する」に変わった ——
       言い方を直すたびに、この検証が黙って素通りしては困る */
    const make = [...document.querySelectorAll('.exammaker .btn')]
      .find((b) => /テストを作|作っています/.test(b.textContent))
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
        .find((b) => /テストを作/.test(b.textContent))?.click()
    })
    await page.waitForTimeout(700)
    const 後 = await 見る()
    /* Supabase に届かないので**1問もできない。** そのときに
       「作って共有しました」と言わないこと、**黙って終わらないこと**を見る。
       **教材を作りにいかないこと**も、ここで効いている ——
       1問も無いのに `createMaterial` を呼ぶと、空の教材が残る */
    const 言 = 後.言った.join(' / ')
    if (!言) {
      ng(`テスト ${W}px … 押したのに、何も言わずに終わった`,
        '成功と失敗を、同じ見た目で終わらせない(CLAUDE.md)')
    } else if (/共有しました|問できました/.test(言)) {
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

   ★ **数を書き写さない**(第5.414節・CLAUDE.md「値を書き写さない。
     性質で見る」)。ここは `['&size=5', 5, …]` と**書き写してあった** ——
     段階3で一覧が **10 / 20 / ぜんぶ**になり 5 が消えたので、
     `sizeOfValue()` が既定へ落とし、**絞った人と絞っていない人が
     同じ数になって、この見張りは何も測らなくなっていた。**

   いまは **`SIZES` から組む。**
   ①「ぜんぶ」で何問あるかを測り(= 骨組みの本数)
   ②一覧の数ひとつずつで、**ちょうどその数**になるかを測る。
   **骨組みが小さすぎたら赤くする** —— いちばん大きい数より多くないと、
   絞っても減らないので**何も測れない**(「無ければ素通り」を自分で塞ぐ)。
   ══════════════════════════════════════════════════════════════ */
/** 聞き流しを開いて、始まった問数と欄の中身を測る */
async function 聞き流しを測る(q2) {
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
  /* **設定を開いてから測る**(第5.271節 → 第5.274節で右上の絵へ)。
     「何問ずつ」の欄も設定の中なので、開かないと描かれていない */
  await page.click('.radio-gear')
  await page.waitForTimeout(150)
  /* **数はコンテンツの中**(第5.264節・2026-09-26 実機・利用者の指定
     「4/5などの数字は、コンテンツ部分内へ」)。
     帯の `.focus-count` から `.drill-count` へ移した ——
     **測る場所も一緒に移す**(移さないと、この見張りが黙る) */
  const m = await page.evaluate(() => ({
    数: (document.querySelector('.drill-count')?.textContent ?? '').trim(),
    題: (document.querySelector('.drill-title')?.textContent ?? '').trim(),
    帯の数: document.querySelectorAll('.focus-top .focus-count').length,
    札: [...(document.querySelector('.radio-set-pick--take')?.options ?? [])]
      .map((o) => o.textContent.trim()),
    いま: document.querySelector('.radio-set-pick--take')?.value ?? '',
  }))
  await page.close()
  return { ...m, 出た: Number((m.数.split('/')[1] ?? '').trim()) }
}

/* ① まず「ぜんぶ」。これが骨組みの本数である(**書き写さない**) */
const 全 = await 聞き流しを測る('&size=all')
/* 一覧の数(「ぜんぶ」を除いたもの)。**`SIZES` 1か所から来る** */
const 数の札 = SIZES.filter((n) => n !== 'all').map(Number)
if (!Number.isFinite(全.出た) || 全.出た < 1) {
  ng('聞き流し 390px … 「ぜんぶ」で何問あるのかが読めない', 全.数 || '(空)')
} else if (全.出た <= Math.max(...数の札)) {
  /* **ここが「無ければ素通り」を塞ぐ1本**(CLAUDE.md)。
     骨組みが一覧の最大より少ないと、どの数をえらんでも
     同じ本数になり、**絞りを外しても緑のまま**になる */
  ng('聞き流し 390px … 骨組みの本数が少なすぎて、絞りを測れない',
    `${全.出た} 問しか無い。一覧の最大 ${Math.max(...数の札)} より多く入れる`)
} else {
  ok(`聞き流し 390px … 「ぜんぶ」なら ${全.出た} 問`
    + `(一覧の最大 ${Math.max(...数の札)} より多い)`)
}

/* ② 一覧の数ひとつずつ。**ちょうどその数**になること */
for (const [q2, 期待, 何] of [
  ...数の札.map((n) => [`&size=${n}`, n, `${n}問に絞っていた人`]),
  ['&size=all', 全.出た, '絞っていない人'],
]) {
  const m = await 聞き流しを測る(q2)
  const 出た = m.出た
  /* ★ **欄の一覧も `SIZES` から組む**(第5.414節)。
       `'5 問'` と書き写してあったので、一覧から 5 を外した日に
       **本当は合っているのに赤くなった**(逆向きの事故・CLAUDE.md
       「式も、関数の名前も書き写さない」)。 */
  const 欄に要る = SIZES.map((n) => sizePickLabel(n, '問'))
  const 足りない札 = 欄に要る.filter((t) => !m.札.includes(t))
  if (!m.札.length) {
    ng(`聞き流し 390px … 「何問ずつ」の欄が出ていない(${何})`)
  } else if (!m.題) {
    /* **何を聞き流しているのかを出す**(第5.264節・利用者の指定)。
       題が無いと、開いた本人にも「どの冊を流しているのか」が分からない */
    ng(`聞き流し 390px … 何を聞き流しているのかが出ていない(${何})`,
      '題(冊の名前)がコンテンツの上に要る')
  } else if (m.帯の数 > 0) {
    /* **帯に数を残さない。** 移したつもりで両方に出ていると、
       同じものが2か所に並ぶ(**同じことをするものを2つ見せない**) */
    ng(`聞き流し 390px … 帯にまだ数が残っている(${何})`)
  } else if (出た !== 期待) {
    ng(`聞き流し 390px … ${何}なのに ${出た} 問で始まっている`,
      `「${m.数}」—— 期待は ${期待} 問`)
  } else if (足りない札.length) {
    ng('聞き流し 390px … 札の一覧が「出しかた」と合っていない',
      `出ている: ${m.札.join(' / ')} — 足りない: ${足りない札.join(' / ')}`)
  } else if (m.札.length !== 欄に要る.length) {
    /* **多いほうも見る**(出る / 出ないの両方・CLAUDE.md)。
       一覧に無い数を足しても緑のままでは、見張ったことにならない */
    ng('聞き流し 390px … 札の一覧に、「出しかた」に無いものが混ざっている',
      `出ている: ${m.札.join(' / ')} — あるべきは ${欄に要る.join(' / ')}`)
  } else {
    ok(`聞き流し 390px … ${何}は ${出た} 問で始まる`
      + `(題「${m.題}」・${m.札.join(' / ')})`)
  }
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
  /* ★ **いちばん小さい数で開いて、中で「ぜんぶ」に変える**(第5.414節)。
       `&size=5` と書き写してあったが、一覧から 5 が消えたので
       **既定へ落ちて「ぜんぶ」と同じ数**になり、
       この見張りは何も測らなくなっていた。`SIZES` から取る。 */
  const 最小 = Math.min(...SIZES.filter((x) => x !== 'all').map(Number))
  await page.goto(`http://localhost:${PORT}/__bar.html?screen=qrradio&size=${最小}`,
    { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(700)
  /* **設定を開いてから変える**(第5.271節 → 第5.274節) */
  await page.click('.radio-gear')
  await page.waitForTimeout(150)
  await page.selectOption('.radio-set-pick--take', 'all')
  await page.waitForTimeout(400)
  const 後 = await page.evaluate(() => (
    document.querySelector('.drill-count')?.textContent ?? '').trim())
  const n = Number((後.split('/')[1] ?? '').trim())
  /* **本数は、さきに「ぜんぶ」で測ったもの**(書き写さない) */
  if (n !== 全.出た) {
    ng('聞き流し 390px … 中で「ぜんぶ」にしても、問数が変わらない', `「${後}」`)
  } else {
    ok(`聞き流し 390px … 中で変えれば、その場で切り替わる(${後})`)
  }
  await page.close()
}

/* ══════════════════════════════════════════════════════════════════
   **単語帳の帯 — 絞り込み(出しかた)は、いちばん右**(第5.277節)

   2026-09-26 実機・利用者の指定。

     > ちなみに、単語帳の絞り込みも同じデザインにして、右に寄せてね

   絵も部品も Quick Response と同じ(`.rscope-sort`)。ちがったのは
   **置き場所だけ**で、単語帳には `🔊 聞き流し` が無いぶん、
   帯の右が大きく空いたまま左に寄っていた。

   **ソースでは測れない。** `margin-left: auto` は空きがあるときだけ
   効くので、**描いて、右端との差を読む**しかない。

   **いちばん危ない形を、必ず1つ置く**(CLAUDE.md)——
   ①広い画面(1280px)…… 空きがいちばん大きく、寄せ忘れが出る
   ②狭い画面(320px)…… 空きが無い。ここで2段に折れないか
   ③冊名が出る画面(`?screen=mybook`)と、出ない画面(`?screen=wordbook`)

   **「右に寄っているか」だけを見ない。** 手前のものに重ねても
   右端には着くので、**あいだが空いているか**も一緒に数える。

   **帯の左が ☰ かどうかも、ここで見る**(第5.278節・2026-09-27)。
   `?screen=mybook` は**本物と同じく `onMenu` を渡す** ——
   渡さないと「✕ とじる」が出て、**利用者が毎日見ている帯とは
   別のものを測る**ことになる(第5.276節で `?screen=qrradio` に
   踏んだのと同じ)。骨組みが戻ってしまわないよう、**赤くする。**
   ══════════════════════════════════════════════════════════════════ */
{
  const IN_SENTENCE = ['answer', 'engineer', 'stayed', 'quiet', 'during', 'whole',
    'review', 'meeting', 'later', 'admitted', 'nervous', 'anything']
  const WORDS = IN_SENTENCE.map((w, i) => ({
    word_norm: w, display: w, kind: 'phrase', pos: '熟語',
    status: 'learning', box: 2, learn_streak: 4,
    due_on: '2020-01-01', added_at: '2026-09-01', meaning_ja: `意味${i}`,
    seen_in: 'Not knowing the answer, the new engineer stayed quiet.',
    seen_in_ja: '答えを知らなかったので、黙っていた。',
    material_id: null, material_title: null, industry: 'it', topic: null,
  }))
  /* `wordbook` = 冊が1つ(えらぶ欄が出ない側)/ `mybook` = 棚を渡す側。
     **「出る」と「出ない」の両方を見る**(CLAUDE.md) */
  for (const [W, SCR] of [[1280, 'mybook'], [390, 'mybook'], [320, 'wordbook']]) {
    const page = await browser.newPage({ viewport: { width: W, height: 844 } })
    page.setDefaultTimeout(9000)
    await page.route('**/rest/v1/**', (r) => {
      const u = r.request().url()
      let body = []
      if (u.includes('review_words')) body = WORDS
      if (u.includes('vocab_week')) body = [{ days: 3, answered: 20, correct: 15, weeks: 5 }]
      if (u.includes('weekly_goal')) body = [{ words_goal: 0, words_done: 0, sent_goal: 0, sent_done: 0 }]
      return r.fulfill({
        status: 200, contentType: 'application/json', body: JSON.stringify(body),
      })
    })
    await page.route('**/auth/v1/**', (r) => r.fulfill({
      status: 200, contentType: 'application/json', body: '{"data":{"user":null}}',
    }))
    await page.goto(`http://localhost:${PORT}/__bar.html?screen=${SCR}`,
      { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1800)

    const 測る = await page.evaluate(() => {
      const bar = document.querySelector('.wb-run-head')
      if (!bar) return { なし: '.wb-run-head' }
      const sort = bar.querySelector('.rscope-sort')
      if (!sort) return { なし: '.rscope-sort' }
      const br = bar.getBoundingClientRect()
      const sr = sort.getBoundingClientRect()
      /* **流れの中にいるものだけ**を数える(浮いているものは、
         ただ上に重なっているだけである・.claude/rules/common.md) */
      const 兄弟 = [...bar.children].filter((k) => {
        const p = window.getComputedStyle(k).position
        return p !== 'fixed' && p !== 'absolute' && k.getBoundingClientRect().width > 0
      })
      const 手前 = 兄弟.filter((k) => k !== sort && !k.contains(sort))
        .map((k) => k.getBoundingClientRect())
        .filter((r) => r.right <= sr.right + 0.5)
        .sort((a, b) => b.right - a.right)[0] ?? null
      return {
        左はメニュー: !!bar.firstElementChild?.classList.contains('focus-burger'),
        右端との差: Math.round(br.right - sr.right),
        手前とのあいだ: 手前 ? Math.round(sr.left - 手前.right) : null,
        帯の高さ: Math.round(br.height),
        ボタンの高さ: Math.round(sr.height),
        並ぶ数: 兄弟.length,
      }
    })

    const 名 = `単語帳の帯 ${W}px(${SCR})`
    if (測る.なし) { ng(`${名} … ${測る.なし} が描かれていない`); await page.close(); continue }
    const 寄っている = 測る.右端との差 <= 2
    /* 帯は1行。**押すものを足したときの壊れ方**(2段になる)を見る ——
       ボタン1つぶんの 1.6 倍を超えたら、もう折り返している */
    const 一行 = 測る.帯の高さ <= 測る.ボタンの高さ * 1.6
    /* **重ねて右端に着けていないか。** すき間ゼロもここで捕まえる
       (`.claude/rules/common.md`「別々の物を、すき間ゼロでくっつけない」) */
    const 離れている = 測る.手前とのあいだ === null || 測る.手前とのあいだ >= 4
    /* **本物は ☰ を渡す**(`App.jsx`)。`?screen=wordbook` だけは
       トレーナーがゲストの単語帳を開く側なので、あちらは「✕ とじる」 */
    if (SCR === 'mybook' && !測る.左はメニュー) {
      ng(`${名} … 帯の左が ☰ ではない`,
        '骨組みが `onMenu` を渡していない。本物(`App.jsx`)は渡している')
    } else if (!寄っている) {
      ng(`${名} … 絞り込みが右端に寄っていない`,
        `右端まで ${測る.右端との差}px 空いている`)
    } else if (!一行) {
      ng(`${名} … 帯が2段になっている`,
        `帯 ${測る.帯の高さ}px / ボタン ${測る.ボタンの高さ}px`)
    } else if (!離れている) {
      ng(`${名} … 絞り込みが、手前のものに接している`,
        `あいだ ${測る.手前とのあいだ}px`)
    } else {
      ok(`${名} … 絞り込みは帯のいちばん右(右端まで ${測る.右端との差}px`
        + ` / 手前とのあいだ ${測る.手前とのあいだ ?? '—'}px / 帯 ${測る.帯の高さ}px・1行`
        + ` / 並ぶもの ${測る.並ぶ数}個)`)
    }
    await page.close()
  }
}

/* ══════════════════════════════════════════════════════════════════
   **Quick Response の練習の帯も、絞り込みは右端**(第5.284節・2026-09-27)

     > 全部やります(残り5つを、こちらで直す)

   第5.277節で単語帳を寄せたとき、**あちらは聞き流しが無いから左に寄って
   見えるのだ**と書いて、こちらは測らなかった。**測ってみたら空いていた** ——
   1280px で右端まで **952px**、390px で 89px、320px で 51px。

   **ソースでは測れない**(`margin-left: auto` は空きがあるときだけ効く)。
   単語帳とまったく同じ読み方をする —— **入れ物だけが違う**
   (`.wb-run-head` ↔ `.focus-top-main`)。

   **いちばん危ない形を置く。** ①広い画面(空きが最大)②狭い画面
   (空きが無い。ここで2段に折れないか)③重ねて右端に着けていないか。
   ══════════════════════════════════════════════════════════════════ */
{
  for (const W of [1280, 390, 320]) {
    const page = await browser.newPage({ viewport: { width: W, height: 844 } })
    page.setDefaultTimeout(9000)
    await page.goto(`http://localhost:${PORT}/__bar.html?screen=qrrev`,
      { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1800)
    /* **読み方は単語帳と同じ**(書き写しではなく、同じ見方をする) */
    const 測る = await page.evaluate(() => {
      const bar = document.querySelector('.qrfocus .focus-top-main')
      if (!bar) return { なし: '.qrfocus .focus-top-main' }
      const sort = bar.querySelector('.rscope-sort')
      if (!sort) return { なし: '.rscope-sort' }
      const br = bar.getBoundingClientRect()
      const sr = sort.getBoundingClientRect()
      const 兄弟 = [...bar.children].filter((k) => {
        const p = window.getComputedStyle(k).position
        return p !== 'fixed' && p !== 'absolute' && k.getBoundingClientRect().width > 0
      })
      const 手前 = 兄弟.filter((k) => k !== sort && !k.contains(sort))
        .map((k) => k.getBoundingClientRect())
        .filter((r) => r.right <= sr.right + 0.5)
        .sort((a, b) => b.right - a.right)[0] ?? null
      const top = document.querySelector('.qrfocus .focus-top')
      return {
        左はメニュー: !!bar.firstElementChild?.classList.contains('focus-burger'),
        右端との差: Math.round(br.right - sr.right),
        手前とのあいだ: 手前 ? Math.round(sr.left - 手前.right) : null,
        帯の高さ: Math.round((top ?? bar).getBoundingClientRect().height),
        ボタンの高さ: Math.round(sr.height),
        並ぶ数: 兄弟.length,
      }
    })
    const 名 = `QRの練習の帯 ${W}px`
    if (測る.なし) { ng(`${名} … ${測る.なし} が描かれていない`); await page.close(); continue }
    if (!測る.左はメニュー) {
      /* **本物は ☰ を渡す**(`QrReview` が `onMenu` を受け取る)。
         骨組みが渡さなくなったら、利用者の見ている帯とは別のものを測る */
      ng(`${名} … 帯の左が ☰ ではない`, '骨組みが `onMenu` を渡していない')
    } else if (測る.右端との差 > 2) {
      ng(`${名} … 絞り込みが右端に寄っていない`,
        `右端まで ${測る.右端との差}px 空いている`)
    } else if (測る.帯の高さ > 測る.ボタンの高さ * 2.2) {
      /* **帯は1行。** 押すものを足したときの壊れ方(2段)を見る。
         こちらの帯は上下に余白と切り欠きのぶんを持つので、
         単語帳(1.6倍)より緩い倍率で見る —— **実測 61px / 34px = 1.8倍** */
      ng(`${名} … 帯が2段になっている`,
        `帯 ${測る.帯の高さ}px / ボタン ${測る.ボタンの高さ}px`)
    } else if (測る.手前とのあいだ !== null && 測る.手前とのあいだ < 4) {
      ng(`${名} … 絞り込みが、手前のものに接している`,
        `あいだ ${測る.手前とのあいだ}px`)
    } else {
      ok(`${名} … 絞り込みは帯のいちばん右(右端まで ${測る.右端との差}px`
        + ` / 手前とのあいだ ${測る.手前とのあいだ ?? '—'}px / 帯 ${測る.帯の高さ}px・1行`
        + ` / 並ぶもの ${測る.並ぶ数}個)`)
    }
    await page.close()
  }
}

/* ══════════════════════════════════════════════════════════════════
   **聞き流しに「前へ」がある**(第5.280節)

   2026-09-27 利用者の指定。

     > 「次へ」ボタンに加えて「前へ」ボタンを追加してください

   **押して、数で確かめる。** ソースに `prevIndex` と書いてあるかは
   `npm run test:play` が見ている。ここで見るのは
   **押したときに、本当に1つ戻るか**である
   (「効かない操作を見せない」・CLAUDE.md)。

   **いちばん危ない形を1つ置く**(CLAUDE.md)——
   **1問目で「前へ」**。ここは末尾へ回り込むところで、
   `(at - 1) % n` と書くと JavaScript は負を返すので、
   **回り込まずに固まる**(`prevIndex` が `+ length` してある理由)。
   ══════════════════════════════════════════════════════════════════ */
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  page.setDefaultTimeout(8000)
  page.setDefaultNavigationTimeout(8000)
  await page.route('**/rest/v1/**', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: '[]',
  }))
  await page.route('**/auth/v1/**', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: '{}',
  }))
  await page.goto(`http://localhost:${PORT}/__bar.html?screen=qrradio`,
    { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(700)

  /** いま何問目か(`1 / 8` の左)。**数え方は画面から読む**(書き写さない) */
  const いま = async () => Number(((await page.evaluate(() => (
    document.querySelector('.drill-count')?.textContent ?? ''))).split('/')[0] ?? '')
    .trim())
  /** 下の行に並んでいる押すもの */
  const 下のボタン = () => page.evaluate(() => (
    [...document.querySelectorAll('.radio-tools .btn')].map((b) => b.textContent.trim())))
  /** その字のボタンを押す(**名前で探す** —— class を書き写さない) */
  const 押す = (字) => page.evaluate((t) => {
    const b = [...document.querySelectorAll('.radio-tools .btn')]
      .find((x) => x.textContent.trim() === t)
    if (b) b.click()
    return !!b
  }, 字)

  /* **まず止める。** 流れたままだと、押した結果か、ひとりでに進んだのかが
     分からない(道が2つあるものは、どちらを通ったかを見えるようにする) */
  await 押す('とめる')
  await page.waitForTimeout(250)

  const 並び = await 下のボタン()
  const 総数 = Number(((await page.evaluate(() => (
    document.querySelector('.drill-count')?.textContent ?? ''))).split('/')[1] ?? '')
    .trim())
  if (!並び.includes('前へ') || !並び.includes('次へ')) {
    ng('聞き流し … 下の行に「前へ」と「次へ」がそろっていない', 並び.join(' / '))
  } else if (並び.indexOf('前へ') > 並び.indexOf('次へ')) {
    ng('聞き流し … 並びが「次へ」「前へ」の順になっている', 並び.join(' / '))
  } else if (!(総数 > 1)) {
    /* **測る相手が居ることを、先に確かめる。**
       1問しか無ければ、どこへ動いても同じところに見える */
    ng('聞き流し … 問が1つしか無く、「前へ」を測れない', `${総数} 問`)
  } else {
    const 初め = await いま()
    await 押す('次へ'); await page.waitForTimeout(250)
    const 次へ後 = await いま()
    await 押す('前へ'); await page.waitForTimeout(250)
    const 戻った = await いま()
    /* ★ **1問目で「前へ」。** ここが末尾へ回り込むこと */
    while (await いま() !== 1) { await 押す('前へ'); await page.waitForTimeout(150) }
    await 押す('前へ'); await page.waitForTimeout(250)
    const 回り込み = await いま()
    if (次へ後 !== 初め + 1) {
      ng('聞き流し … 「次へ」で1つ進まない', `${初め} → ${次へ後}`)
    } else if (戻った !== 初め) {
      ng('聞き流し … 「前へ」で1つ戻らない', `${次へ後} → ${戻った}(${初め} のはず)`)
    } else if (回り込み !== 総数) {
      ng('聞き流し … 1問目で「前へ」を押しても、末尾へ回り込まない',
        `1 → ${回り込み}(${総数} のはず)`)
    } else {
      ok(`聞き流し … 「前へ」で1つ戻る(${次へ後} → ${戻った})`
        + ` / 1問目からは末尾へ回り込む(1 → ${回り込み} / 全 ${総数} 問)`
        + ` / 下の行は ${並び.join(' ')}`)
    }
  }
  await page.close()
}

/* ══════════════════════════════════════════════════════════════════
   **押しても、まわりの物が動かない**(第5.281節)

   2026-09-27 実機・利用者の指定。

     > 音声を「繰り返す」にすると文字数が増えた分表示が2段組になります。
     > こういう仕様が二度とどこでも起こらないように改善してください。
     > UI の配置が変化することをどの場所においても防いでください。

   実機で起きたのは、`.qr-peek`(折り返す行)の中で
   「くり返す」(4文字)→「1回」(2文字)とボタンが縮み、
   **3つ目が上の段へ上がって、2段が1段に組み変わった**ことだった。
   押した人は「もう出さない」を押そうとしていて、**指の下で入れ替わる。**

   ══ この見張りの考え方 ══
   **一覧を持たない。** 「文字が変わるボタン」を名指しで並べると、
   足した日に見張られない(CLAUDE.md)。だから **押して、確かめる。**

     ①画面を描く → ②ボタンを1つ押す → ③文字が変わったか見る
     ④変わったなら、**そのボタンの幅**と**まわりの物の場所**を比べる

   **文字が変わらなかったものは、この決まりの相手ではない**ので飛ばす。
   **画面ごと変わったもの**(次の問へ進む・シートが開く)も飛ばす ——
   利用者が禁じたのは「値が変わったときに動くこと」である。

   **押すたびに描き直す。** 続けて押すと状態が積み重なり、
   何が原因で動いたのか分からなくなる(道が2つあるものは、
   いまどちらを通ったかを見えるようにする・CLAUDE.md)。

   **狭い画面で測る。** 折り返しが起きるのは、たいてい狭いほうである。
   ══════════════════════════════════════════════════════════════════ */
{
  /** どれだけ動いたら「動いた」と言うか(小数の丸めぶんは許す) */
  const 許す = 0.6
  const 動いた = []
  let 押した数 = 0
  let 変わった数 = 0

  for (const [s, extra] of SCREENS) {
    for (const w of [390, 320]) {
      const page = await browser.newPage({ viewport: { width: w, height: 900 } })
      page.setDefaultTimeout(8000)
      page.setDefaultNavigationTimeout(8000)
      await page.route('**/rest/v1/**', (r) => r.fulfill({
        status: 200, contentType: 'application/json', body: '[]',
      }))
      await page.route('**/auth/v1/**', (r) => r.fulfill({
        status: 200, contentType: 'application/json', body: '{}',
      }))
      await page.route('**/functions/v1/**', (r) => r.fulfill({ status: 500, body: '{}' }))
      const url = `http://localhost:${PORT}/__bar.html?screen=${s}${extra ? `&${extra}` : ''}`
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded' })
        await page.waitForTimeout(600)
        /** その画面に、押せるものがいくつあるか */
        const 数 = await page.evaluate(() => (
          [...document.querySelectorAll('button')]
            .filter((b) => !b.disabled && b.getBoundingClientRect().width > 0).length))
        for (let i = 0; i < 数; i += 1) {
          /* **押すたびに描き直す**(状態を積み重ねない) */
          if (i > 0) {
            await page.goto(url, { waitUntil: 'domcontentloaded' })
            await page.waitForTimeout(500)
          }
          const 結果 = await page.evaluate(async (n) => {
            const 押せる = () => [...document.querySelectorAll('button')]
              .filter((b) => !b.disabled && b.getBoundingClientRect().width > 0)
            const b = 押せる()[n]
            if (!b) return null
            /* ★ **開け閉めするものは、この決まりの相手ではない。**
                 利用者が禁じたのは「**値が変わったとき**に動くこと」で、
                 出たり消えたりは別の話である(`.claude/rules/common.md`)。

                 **名指しの一覧で外さない。** `aria-expanded` は
                 **その札自身が「わたしは開け閉めします」と言っている**印で、
                 markup に書いてある。名前で外すと、足した日に守られない */
            if (b.hasAttribute('aria-expanded')) return { 画面が変わった: true }
            /* **描かれている物だけを、場所ごと控える。**
               浮いているもの(fixed / absolute)は流れの中にいないので数えない */
            const 控え = () => {
              const out = new Map()
              for (const el of document.querySelectorAll('body *')) {
                const st = window.getComputedStyle(el)
                if (st.position === 'fixed' || st.position === 'absolute') continue
                if (st.visibility === 'hidden' || st.display === 'none') continue
                const r = el.getBoundingClientRect()
                if (r.width < 1 || r.height < 1) continue
                out.set(el, { x: r.left, y: r.top, w: r.width, h: r.height })
              }
              return out
            }
            const 名 = (el) => (el.className && typeof el.className === 'string'
              ? el.className.split(/\s+/).slice(0, 2).join('.') : el.tagName.toLowerCase())
            const 前の字 = (b.textContent || '').replace(/\s+/g, '')
            const 前 = 控え()
            const 前のb = 前.get(b)
            const 前たけ = document.body.scrollHeight
            b.click()
            await new Promise((r) => setTimeout(r, 220))
            /* **押したもの自身が消えたら、画面が変わったということ** */
            if (!b.isConnected) return { 画面が変わった: true }
            const 後の字 = (b.textContent || '').replace(/\s+/g, '')
            if (後の字 === 前の字) return { 変わらない: true }
            const 後 = 控え()
            const 後たけ = document.body.scrollHeight
            /* **増えた / 消えた物があるなら、画面が変わったということ**
               (出たり消えたりは、この決まりの相手ではない) */
            if (後.size !== 前.size) return { 画面が変わった: true, 字: `${前の字}→${後の字}` }
            /* **数が同じでも、背が伸びたら画面が変わったということ**
               (読み込み中は何も描かない部品があり、数だけでは分からない) */
            if (Math.abs(後たけ - 前たけ) > 0.6) {
              return { 画面が変わった: true, 字: `${前の字}→${後の字}` }
            }
            const ずれ = []
            for (const [el, a] of 前) {
              const c = 後.get(el)
              if (!c) return { 画面が変わった: true, 字: `${前の字}→${後の字}` }
              /* **押したもの自身の中は数えない。**
                 中身が変わるのは当たり前で、字がまん中にそろい直すぶん
                 必ず動く。**守りたいのは「その箱の大きさ」と
                 「まわりの物の場所」**である(大きさは `幅の差` が見る) */
              if (b.contains(el)) continue
              const d = Math.max(Math.abs(a.x - c.x), Math.abs(a.y - c.y))
              if (d > 0.6) ずれ.push(`${名(el)} が ${Math.round(d)}px`)
            }
            const 幅の差 = Math.abs((前のb?.w ?? 0) - (後.get(b)?.w ?? 0))
            return {
              字: `${前の字}→${後の字}`,
              幅の差: Math.round(幅の差 * 10) / 10,
              ずれ: ずれ.slice(0, 3),
              ずれた数: ずれ.length,
            }
          }, i)
          if (!結果 || 結果.画面が変わった) continue
          押した数 += 1
          if (結果.変わらない) continue
          変わった数 += 1
          if (結果.幅の差 > 許す || 結果.ずれた数 > 0) {
            動いた.push(`${s}@${w}px 「${結果.字}」`
              + (結果.幅の差 > 許す ? ` 幅が ${結果.幅の差}px 変わった` : '')
              + (結果.ずれた数 ? ` / ${結果.ずれた数} 個が動いた(${結果.ずれ.join(' / ')})` : ''))
          }
        }
      } catch (e) {
        ng(`動かない … ${s}@${w}px を描けなかった`, e.message.split('\n')[0])
      }
      await page.close()
    }
  }

  const 一覧 = [...new Set(動いた)]
  if (!(変わった数 > 0)) {
    /* **測る相手が居ることを、先に確かめる**(CLAUDE.md)——
       1つも「文字が変わるボタン」を踏んでいなければ、
       この見張りは何もしていないのと同じである */
    ng('動かない … 文字が変わるボタンを1つも踏んでいない',
      `押せたのは ${押した数} 個。見張りが素通りしている`)
  } else if (一覧.length) {
    ng(`動かない … 押したら動くところが ${一覧.length} か所ある`,
      一覧.slice(0, 12).join('\n    '))
  } else {
    ok(`動かない … ${SCREENS.length} 画面 × 2幅で、`
      + `文字が変わるボタン ${変わった数} 個を押しても、幅も場所も動かない`)
  }
}

/* ══════════════════════════════════════════════════════════════════
   **つまみを動かしても、画面が横へ滑らない**(第5.282節)

   2026-09-27 実機・利用者の指定。

     > 音楽や音声のボリュームを調整しようとすると
     > 画面が横にスワイプされるような挙動になり使いづらいです。
     > 同じことが起きる場所は全て固定してください。

   指で横へ引くと、ブラウザは**まず「画面を横へ送る合図」**として
   受け取る。つまみは横に引いて使うものなので、**まともにぶつかる。**

   ══ 見方 ══
   **一覧を持たない。** つまみを名指しで並べると、足した日に守られない。
   **描いて、`touch-action` を読む。**

     ・`auto` / `pan-x` / `manipulation` … **横をブラウザに渡す**。だめ
     ・`pan-y` … 縦だけブラウザ。横はつまみに届く。よい
     ・`none`  … どちらも渡さない。よい(ただし縦に送れなくなる)

   **「1つも見つけていない」を赤くする** —— つまみが1本も描かれて
   いなければ、この見張りは何もしていないのと同じである。
   ══════════════════════════════════════════════════════════════════ */
{
  /** 横の指の動きを、ブラウザに渡してしまう指定 */
  const だめ = ['auto', 'pan-x', 'manipulation', 'pan-x pinch-zoom']
  const 見つけた = []
  const 悪い = []
  for (const [s, extra] of SCREENS) {
    const page = await browser.newPage({ viewport: { width: 390, height: 900 } })
    page.setDefaultTimeout(8000)
    page.setDefaultNavigationTimeout(8000)
    await page.route('**/rest/v1/**', (r) => r.fulfill({
      status: 200, contentType: 'application/json', body: '[]',
    }))
    await page.route('**/auth/v1/**', (r) => r.fulfill({
      status: 200, contentType: 'application/json', body: '{}',
    }))
    try {
      await page.goto(
        `http://localhost:${PORT}/__bar.html?screen=${s}${extra ? `&${extra}` : ''}`,
        { waitUntil: 'domcontentloaded' },
      )
      await page.waitForTimeout(500)
      /* ★ **畳んであるものは開いてから測る**(`.claude/rules/common.md`)。
           つまみは**設定の中**にいる —— メニューの設定は `<details>`、
           聞き流しの設定は歯車の吹き出しで、どちらも**既定では畳んである。**
           開かずに測ったら「つまみが1本も無い」になり、
           **素通りのガードが正しく赤くなった**(2026-09-27)。 */
      await page.evaluate(() => {
        for (const d of document.querySelectorAll('details')) d.open = true
        for (const b of document.querySelectorAll('[aria-expanded="false"]')) b.click()
      })
      await page.waitForTimeout(400)
      const つまみ = await page.evaluate(() => (
        [...document.querySelectorAll('input[type="range"]')].map((el) => ({
          名: el.getAttribute('aria-label') || el.className || '(名前なし)',
          指: window.getComputedStyle(el).touchAction,
        }))))
      for (const t of つまみ) {
        見つけた.push(`${s}:${t.名}`)
        if (だめ.includes(t.指)) 悪い.push(`${s} 「${t.名}」 touch-action: ${t.指}`)
      }
    } catch (e) {
      ng(`つまみ … ${s} を描けなかった`, e.message.split('\n')[0])
    }
    await page.close()
  }
  if (!見つけた.length) {
    /* **測る相手が居ることを、先に確かめる**(CLAUDE.md) */
    ng('つまみ … `input[type=range]` を1本も描いていない',
      `${SCREENS.length} 画面を見た。見張りが素通りしている`)
  } else if (悪い.length) {
    ng(`つまみ … 横に引くと画面が滑るものが ${悪い.length} 本ある`,
      悪い.slice(0, 8).join('\n    '))
  } else {
    ok(`つまみ … ${見つけた.length} 本とも、横に引いても画面が滑らない`
      + `(${[...new Set(見つけた)].slice(0, 4).join(' / ')})`)
  }
}

/* ══════════════════════════════════════════════════════════════════════
   第5.417節 —— カードを送る・判定する操作(2026-10-07 利用者の指定・段階4)

     | 操作 | 前へ | 次へ | 覚えた(言える) | まだ |
     |---|---|---|---|---|
     | 矢印キー | ← | → | ↑ | ↓ |
     | 紙の余白をクリック | 左 | 右 | — | — |
     | ◀▶ のボタン(指の端末だけ) | ◀ | ▶ | — | — |

   **算段は `npm run test:play` が素の node で見張る。**
   ここは**実際に描いて、押して測る** —— 「CSS に決まりがある」では
   見張ったことにならないのと同じ(CLAUDE.md `test:feel`)。

   **広い画面と狭い画面の両方で測る。** 押せる帯は余白が 44px 取れた
   ときだけ出すので、**スマホだけ見ていると「出さない」しか測れない。**
   ══════════════════════════════════════════════════════════════════════ */
{
  /* **名前は、この箱の中だけで通じるようにする**(ほかの見張りとぶつけない) */
  const IN_SENTENCE = ['answer', 'engineer', 'stayed', 'quiet', 'during', 'whole',
    'review', 'meeting', 'later', 'admitted', 'nervous', 'anything']
  const WORDS = Array.from({ length: 12 }, (_, i) => ({
    word_norm: IN_SENTENCE[i], display: IN_SENTENCE[i], kind: 'phrase', pos: '熟語',
    status: 'learning', box: 2, learn_streak: 4,
    due_on: '2020-01-01', added_at: '2026-09-01',
    meaning_ja: `意味${i}`,
    seen_in: 'Not knowing the answer, the new engineer stayed quiet during the whole review meeting.',
    seen_in_ja: '答えを知らなかったので、黙っていた。',
    material_id: null, material_title: null, industry: 'it', topic: null,
  }))
  const 単語帳を開く = async (opts, form = 'recall') => {
    const page = await browser.newPage(opts)
    await page.route('**/rest/v1/**', (route) => {
      const u = route.request().url()
      let body = []
      if (u.includes('review_words')) body = WORDS
      if (u.includes('vocab_week')) body = [{ days: 3, answered: 20, correct: 15, weeks: 5 }]
      if (u.includes('weekly_goal')) body = [{ words_goal: 0, words_done: 0, sent_goal: 0, sent_done: 0 }]
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
    })
    await page.route('**/auth/v1/**', (r) => r.fulfill({
      status: 200, contentType: 'application/json', body: '{"data":{"user":null}}',
    }))
    await page.addInitScript((f) => {
      try { localStorage.setItem('eas.review.word.form', f) } catch { /* 使えなくても困らない */ }
    }, form)
    await page.goto(`http://localhost:${PORT}/__bar.html?screen=wordbook`,
      { waitUntil: 'networkidle' })
    await page.waitForSelector('.wbfocus .wordcard', { timeout: 10000 })
    return page
  }
  /** いま出ている語(これが変わったら、カードが送られたということ) */
  const いまの語 = (page) => page.evaluate(() => (
    document.querySelector('.wordcard-face')?.textContent?.trim()?.slice(0, 40) ?? ''))

  console.log('\n▶ 紙の左右の余白を押せる(第5.417節・段階4)')
  {
    /* ★ **広い画面と狭い画面の両方で測る**(CLAUDE.md)。
         **「出る」と「出ない」の両方を見る** —— 片方だけだと、
         **どの幅でも出す形・どの幅でも出さない形**に書き換えても緑になる */
    for (const [名, 幅, 出るか] of [['広い画面', 1200, true], ['スマホ', 390, false]]) {
      const page = await 単語帳を開く({ viewport: { width: 幅, height: 900 } })
      const m = await page.evaluate(() => {
        const 箱 = (s) => {
          const el = document.querySelector(s)
          if (!el) return null
          const { x, y, width, height } = el.getBoundingClientRect()
          return { x, y, w: width, h: height, 見える: el.checkVisibility() }
        }
        return {
          入れ物: 箱('.cardmove'), カード: 箱('.wordcard'),
          /* **本体が無い形では、画面そのものが相手**(`CardMove` と同じ落とし方) */
          本体: 箱('.app-body') ?? 箱('html'),
          左: 箱('.cardmove-edge--l'), 右: 箱('.cardmove-edge--r'),
          上の帯: 箱('.focus-top'), タブ: 箱('.app-tabs'),
        }
      })
      if (出るか) {
        if (m.左?.見える && m.右?.見える) {
          ok(`${名} … 紙の左右に、押せる帯が出る`,
            `左 ${Math.round(m.左.w)}px / 右 ${Math.round(m.右.w)}px`)
          /* **44px 取れているか**(出すなら押せる大きさで出す) */
          const 狭い = Math.min(m.左.w, m.右.w)
          if (狭い >= TAP_MIN) ok(`${名} … 押せる大きさで出ている`, `${Math.round(狭い)}px`)
          else ng(`${名} … 帯が ${Math.round(狭い)}px しかない`, `${TAP_MIN}px 以上が要る`)
          /* ★ **縦は入れ物の中、横は空いているところいっぱい**
               (2026-10-09 利用者の指定「クリックできる範囲も画面幅
               いっぱいに広げてください」)。
               **縦だけを見る** —— 上の帯や下のタブにかからないのは
               縦の話であって、横に広がるのは困らない(利用者の指定
               「上部バーの部分は余白としてとらえない」はそのまま効く) */
          const 外 = [['左', m.左], ['右', m.右]].filter(([, b]) => (
            b.y < m.入れ物.y - 0.5 || b.y + b.h > m.入れ物.y + m.入れ物.h + 0.5))
          if (外.length) ng(`${名} … 押せる帯が、縦に入れ物からはみ出している`, JSON.stringify(外))
          else ok(`${名} … 押せる帯の縦は、紙の入れ物の中にある(上の帯にかからない)`)
          /* **横は、本体(`.app-body`)より外へは出ない** —— 出ると左の柱に重なる */
          const 本体 = m.本体
          const 横はみ = 本体 && [['左', m.左], ['右', m.右]].filter(([, b]) => (
            b.x < 本体.x - 0.5 || b.x + b.w > 本体.x + 本体.w + 0.5))
          if (横はみ && 横はみ.length) {
            ng(`${名} … 押せる帯が、本体より外へ出ている`, JSON.stringify(横はみ))
          } else ok(`${名} … 押せる帯の横は、空いているところに収まっている`)
          /* ★ **カードの上に乗っていないか** —— 乗ると、
               語をなぞる操作も、答えのボタンも押せなくなる */
          const かぶり = [['左', m.左], ['右', m.右]].filter(([, b]) => (
            b.x + b.w > m.カード.x + 0.5 && b.x < m.カード.x + m.カード.w - 0.5))
          if (かぶり.length) ng(`${名} … 押せる帯がカードに重なっている`, JSON.stringify(かぶり))
          else ok(`${名} … 押せる帯は、カードに重なっていない`)
          /* ★ **上の帯にかかっていないか**(実際の相手で測る) */
          const 帯かぶり = m.上の帯 && [m.左, m.右].some((b) => (
            b.y < m.上の帯.y + m.上の帯.h - 0.5))
          if (帯かぶり) ng(`${名} … 押せる帯が、上の帯にかかっている`)
          else ok(`${名} … 上の帯にはかかっていない`)
        } else ng(`${名} … 紙の左右に押せる帯が出ない`, JSON.stringify(m))
      } else if (m.左 || m.右) {
        ng(`${名} … 余白が無いのに、押せる帯を出している`,
          `${Math.round(m.左?.w ?? 0)}px / ${Math.round(m.右?.w ?? 0)}px`)
      } else {
        ok(`${名} … 余白が取れないので、押せる帯を出さない`,
          `紙と入れ物が同じ幅 ${Math.round(m.カード?.w ?? 0)}px`)
      }
      await page.close()
    }
  }

  console.log('\n▶ 押すと、本当に送られる(第5.417節)')
  {
    const page = await 単語帳を開く({ viewport: { width: 1200, height: 900 } })
    const ひとつめ = await いまの語(page)
    /* ★ **待ち時間は `FLY_MS` から出す**(2026-10-08)。
         送りは**飛んでから**入れ替わるので、決め打ちの 250ms では
         **直っているのに赤くなる**(実際そうなった)。
         **値を書き写さない。数は1か所から取る**(CLAUDE.md) */
    await page.click('.cardmove-edge--r')
    await page.waitForTimeout(FLY_MS + 250)
    const ふたつめ = await いまの語(page)
    if (ふたつめ && ふたつめ !== ひとつめ) ok('右の余白を押すと、次の語になる', `${ひとつめ} → ${ふたつめ}`)
    else ng('右の余白を押しても、語が変わらない', `${ひとつめ} / ${ふたつめ}`)
    await page.click('.cardmove-edge--l')
    await page.waitForTimeout(FLY_MS + 250)
    const 戻り = await いまの語(page)
    if (戻り === ひとつめ) ok('左の余白を押すと、前の語に戻る', 戻り)
    else ng('左の余白を押しても、前に戻らない', `${ひとつめ} → ${ふたつめ} → ${戻り}`)
    await page.close()
  }

  console.log('\n▶ 矢印キーで送る・判定する(第5.417節)')
  {
    const page = await 単語帳を開く({ viewport: { width: 1200, height: 900 } })
    const 頭 = await いまの語(page)
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(FLY_MS + 250)
    const 次 = await いまの語(page)
    if (次 && 次 !== 頭) ok('→ で次の語になる', `${頭} → ${次}`)
    else ng('→ を押しても、語が変わらない', `${頭} / ${次}`)
    await page.keyboard.press('ArrowLeft')
    await page.waitForTimeout(FLY_MS + 250)
    const 前 = await いまの語(page)
    if (前 === 頭) ok('← で前の語に戻る', 前)
    else ng('← を押しても、前に戻らない', `${頭} → ${次} → ${前}`)

    /* ★ **判定のキー。** 答えの記録まで通るので、**何問目かが進む** */
    const 何問目 = () => page.evaluate(() => (
      document.querySelector('.drill-count, .drillhead-count')?.textContent?.trim() ?? ''))
    const 前の数 = await 何問目()
    /* ★ **判定も流してから効く**(2026-10-09 利用者の指定「上か下に飛んで」)。
         **待ちは `FLY_MS` から出す** —— 400ms の決め打ちのままだと、
         飛んでいる最中に測って「判定されない」と出る(実際にそうなった) */
    await page.keyboard.press('ArrowDown')
    await page.waitForTimeout(FLY_MS + 250)
    const 後の数 = await 何問目()
    const 後の語 = await いまの語(page)
    if (後の語 !== 前) ok('↓(まだ)で判定され、次の語になる', `${前} → ${後の語}`)
    else ng('↓ を押しても、判定されない', `${前} / ${後の語} / 数 ${前の数} → ${後の数}`)
    await page.keyboard.press('ArrowUp')
    await page.waitForTimeout(FLY_MS + 250)
    const 上の語 = await いまの語(page)
    if (上の語 !== 後の語) ok('↑(覚えかけ)でも判定され、次の語になる', `${後の語} → ${上の語}`)
    else ng('↑ を押しても、判定されない', `${後の語} / ${上の語}`)
    await page.close()
  }

  console.log('\n▶ 字を打っているあいだは、矢印が効かない(第5.417節)')
  {
    /* ★ **いま、カードの中に字を打つ場所は1つも無い**(「つづり」の訊き方は
         廃止された・`QUIZ_FORMS`)。だから**字が入る場所を、こちらで置いて測る** ——
         守りは `document.activeElement` を見ているので、
         **どこの入力欄でも、同じ道を通る。**
         測っているのは「窓に来た矢印を、字を打っているあいだ捨てるか」である。

       ここを外すと、**あとで入力欄を1つ足した日に、黙って壊れる** ——
       つづりの訊き方が戻ってきたときが、まさにそれである */
    const page = await 単語帳を開く({ viewport: { width: 1200, height: 900 } })
    const 頭 = await いまの語(page)
    await page.evaluate(() => {
      const el = document.createElement('input')
      el.type = 'text'; el.id = '__typing'
      document.querySelector('.wordcard')?.append(el)
      el.focus()
    })
    await page.keyboard.type('ans')
    await page.keyboard.press('ArrowLeft')
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowUp')
    await page.keyboard.press('ArrowDown')
    await page.waitForTimeout(FLY_MS + 400)
    const 後 = await いまの語(page)
    const 中身 = await page.inputValue('#__typing')
    if (後 === 頭) ok('字を打っているあいだは、矢印でカードが動かない', 頭)
    else ng('字を打っているのに、カードが動いた', `${頭} → ${後}`)
    if (中身 === 'ans') ok('打った字も消えていない', 中身)
    else ng('打った字が変わった', 中身)
    /* ★ **外したら動く**ことも、同じ画面で確かめる ——
         でないと「そもそも矢印が効いていない」を見逃す(CLAUDE.md
         「『無ければ素通り』する形の検証を書かない」) */
    await page.evaluate(() => { document.querySelector('#__typing')?.remove() })
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(FLY_MS + 300)
    const 打ち終わり = await いまの語(page)
    if (打ち終わり !== 頭) ok('打つのをやめれば、矢印はまた効く', `${頭} → ${打ち終わり}`)
    else ng('打つのをやめても、矢印が効かない', '守りが外れていても同じ結果になる')
    await page.close()
  }

  console.log('\n▶ ◀▶ のボタンで送る。スワイプは廃止(第5.417節・2026-10-08)')
  {
    /* ★ **仕様変更**(2026-10-08 利用者の指定)。

         > スワイプが使いにくすぎるのでやめにしょう。スマホ、タブレットのみ
         > 仕様を変えましょう。◀▶で戻ったり進めるボタンを追加して
         > スワイプは廃止します。
         > 三角だけ、小さい方 /「まだ」「言えた」の左右に置く

       **ソースに `MoveArrow` と書いてあるかでは見張れない** ——
       本当に描いて、**押して、記録を数える**(`test:feel` と同じ考え方)。
       数えるのは**進み具合の帯の、済んだ段の数**である
       (判定するとここが1つ進む)。 */
    const 済み = (page) => page.evaluate(() => (
      document.querySelectorAll('.drill-bar > span.is-done').length))
    /** ◀▶ と、その上下にあるものを、**描かれたまま**読み取る */
    const 矢印の様子 = (page, 枠, 答え) => page.evaluate(([枠s, 答えs]) => {
      const 箱 = (sel) => {
        const el = document.querySelector(sel)
        if (!el) return null
        const r = el.getBoundingClientRect()
        return { top: Math.round(r.top), bottom: Math.round(r.bottom),
          left: Math.round(r.left), right: Math.round(r.right) }
      }
      const 矢 = [...document.querySelectorAll('.move-row .move-arrow')].map((el) => {
        const r = el.getBoundingClientRect()
        return {
          名: el.getAttribute('aria-label') || '',
          w: Math.round(r.width), h: Math.round(r.height),
          top: Math.round(r.top), 中: Math.round(r.left + r.width / 2),
          左: Math.round(r.left), 右: Math.round(r.right),
        }
      })
      return { 矢, 枠: 箱(枠s), 答え: 箱(答えs), 行: 箱('.move-row') }
    }, [枠, 答え])
    /**
     * ★ **飛んでいる最中の様子**(2026-10-08 利用者の指定)。
     *
     *   > 動くのは単語やクイックレスポンスの内容のみ、
     *   > 上の線と下の線の間にあるものだけです
     *
     * **動く側(出題の枠)と、動いてはいけない側(題・判定)を同時に測る** ——
     * 片方だけだと、**カードごと飛んでいても緑**になる。
     */
    const 飛び様 = (page, 答え) => page.evaluate((答えs) => {
      const ずれ = (sel) => {
        const el = document.querySelector(sel)
        if (!el) return null
        const t = window.getComputedStyle(el).transform
        return t === 'none' ? 0 : Math.round(parseFloat(t.split(',')[4] || '0'))
      }
      const 場所 = (sel) => {
        const el = document.querySelector(sel)
        if (!el) return null
        const r = el.getBoundingClientRect()
        return `${Math.round(r.left)},${Math.round(r.top)}`
      }
      return {
        中身: ずれ('.move-stage'),
        入れ物: ずれ('.cardmove'),
        題: 場所('.drill-bar'),
        答え: 場所(答えs),
      }
    }, 答え)
    const ずれ = async (page) => (await 飛び様(page, '.wordcard-answers')).中身
    /** 指で引きずる(**もう何も起きないはず**) */
    const 引きずる = async (page, 向き) => {
      const 箱 = await page.evaluate(() => {
        const el = document.querySelector('.wordcard-answers') ?? document.querySelector('.wordcard')
        const { x, y, width, height } = el.getBoundingClientRect()
        return { x: x + width / 2, y: y + height / 2 }
      })
      /* **押せる的の2倍**(もとのスワイプなら、確実に届いた長さ) */
      await page.mouse.move(箱.x - TAP_MIN * 向き, 箱.y)
      await page.mouse.down()
      await page.mouse.move(箱.x + TAP_MIN * 向き, 箱.y, { steps: 6 })
      await page.mouse.up()
      await page.waitForTimeout(FLY_MS + 400)
    }

    /* ── 指の端末 … ◀▶ が出て、押せば送れる ───────────── */
    {
      const page = await 単語帳を開く({
        viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true,
      })
      const 様子 = await 矢印の様子(page, '.wordcard-q', '.wordcard-answers')
      const 矢 = 様子.矢
      if (矢.length === 2) ok('指の端末 … ◀▶ が2つ出ている', 矢.map((x) => x.名).join(' / '))
      else ng('指の端末 … ◀▶ が2つ出ていない', `${矢.length} 個`)

      /* ★ **三角だけでも、押せる的は小さくしない**(利用者の指定「小さい方」は
           見た目の話である)。**数は `TAP_MIN` 1か所から取る** */
      const 小さい = 矢.filter((x) => x.w < TAP_MIN || x.h < TAP_MIN)
      if (矢.length && !小さい.length) {
        ok('指の端末 … ◀▶ は、押せる大きさで出ている',
          矢.map((x) => `${x.w}×${x.h}`).join(' / '))
      } else if (矢.length) {
        ng('指の端末 … ◀▶ が小さすぎる',
          `${小さい.map((x) => `${x.w}×${x.h}`).join(' / ')} —— ${TAP_MIN}px 以上が要る`)
      }

      /* ★ **置き場所は「出題の箱の下、判定より上」**(利用者が実機の写真に
           手書きの三角で描いた場所)。**描かれた座標で確かめる** */
      if (矢.length === 2 && 様子.枠 && 様子.答え) {
        const 下 = 矢.every((x) => x.top >= 様子.枠.bottom - 2)
        const 上 = 矢.every((x) => x.top < 様子.答え.top)
        if (下 && 上) {
          ok('指の端末 … ◀▶ は、出題の箱の下・判定より上にある',
            `枠 ${様子.枠.bottom}px < 矢印 ${矢[0].top}px < 答え ${様子.答え.top}px`)
        } else {
          ng('指の端末 … ◀▶ の置き場所がちがう',
            `枠 ${様子.枠.bottom}px / 矢印 ${矢[0].top}px / 答え ${様子.答え.top}px`)
        }
      }

      /* ★ **2つは1段に並び、まん中から左右へ同じだけ離れている**
           (利用者の指定「バランスよく配置する」)。
           **カードのまん中からの距離を比べる** —— 片寄っていたら赤 */
      if (矢.length === 2 && 様子.行) {
        const まん中 = (様子.行.left + 様子.行.right) / 2
        const 左 = Math.round(まん中 - 矢[0].中)
        const 右 = Math.round(矢[1].中 - まん中)
        const 同じ段 = 矢[0].top === 矢[1].top
        const あいだ = 矢[1].左 - 矢[0].右
        if (同じ段 && Math.abs(左 - 右) <= 1) {
          ok('指の端末 … ◀▶ は、まん中から左右へ同じだけ離れている', `左 ${左}px / 右 ${右}px`)
        } else {
          ng('指の端末 … ◀▶ が、まん中から片寄っている',
            `左 ${左}px / 右 ${右}px / 上端 ${矢[0].top} ${矢[1].top}`)
        }
        /* **くっつけない**(共通ルール「別々の物を、すき間ゼロでくっつけない」)。
           写真の三角も、はっきり離して描かれていた */
        if (あいだ >= TAP_MIN) ok('指の端末 … ◀▶ のあいだが、しっかり空いている', `${あいだ}px`)
        else ng('指の端末 … ◀▶ が近すぎる', `あいだ ${あいだ}px`)
      }

      /* ── ▶ を押すと、飛んでから次へ ───────────────── */
      const 頭 = await いまの語(page)
      const 記録 = await 済み(page)
      /* **押す前の場所を控える** —— 飛んでいる最中と比べる */
      const 止まるもの = await 飛び様(page, '.wordcard-answers')
      try {
        await page.locator('.move-row .move-arrow').last().tap({ timeout: 4000 })
      } catch (e) {
        ng('指の端末 … ▶ を指で押せない', String(e.message).split('\n')[0].slice(0, 60))
      }
      /* ★ **本当に飛んでいるか**(利用者の指定「飛ばす 600ms」)。
           **長さの半分のところ**を覗く —— CSS に決まりがあるかではなく、
           **動いている最中のずれ**を測る(CLAUDE.md `test:feel`) */
      await page.waitForTimeout(Math.round(FLY_MS / 2))
      const 飛び = await 飛び様(page, '.wordcard-answers')
      if (Math.abs(飛び.中身) > 1) ok('指の端末 … 出題の中身が、横へ飛んでいく', `${飛び.中身}px`)
      else ng('指の端末 … 中身が飛ばずに、ただ入れ替わっている', `ずれ ${飛び.中身}px`)
      /* ★★ **カードごと飛んでいないか**(2026-10-08 利用者の指定)。
           **入れ物が動いていたら赤** —— 題も進み具合の帯もボタンも
           一緒に飛ぶことになる */
      if (!飛び.入れ物) ok('指の端末 … 飛ぶのは中身だけ(カードは動かない)')
      else ng('指の端末 … カードごと飛んでいる', `入れ物のずれ ${飛び.入れ物}px`)
      if (飛び.題 === 止まるもの.題 && 飛び.答え === 止まるもの.答え) {
        ok('指の端末 … 題も判定のボタンも、1pxも動かない',
          `題 ${飛び.題} / 答え ${飛び.答え}`)
      } else {
        ng('指の端末 … 飛ばしたときに、題か判定のボタンが動いた',
          `題 ${止まるもの.題} → ${飛び.題} / 答え ${止まるもの.答え} → ${飛び.答え}`)
      }

      await page.waitForTimeout(FLY_MS)
      const 次 = await いまの語(page)
      const 記録2 = await 済み(page)
      if (次 !== 頭) ok('指の端末 … ▶ を押すと、ひとつ先へ進む', `${頭} → ${次}`)
      else ng('指の端末 … ▶ を押しても、何も起きない', `${頭} / ${次}`)
      /* ★ **飛び終わったら、ずれは残らない**(次の語が傾いたまま出ない) */
      const 残り = await ずれ(page)
      if (Math.abs(残り) <= 1) ok('指の端末 … 飛び終わったら、ずれは残らない')
      else ng('指の端末 … 飛んだあと、カードがずれたまま', `${残り}px`)
      /* ★★ **いちばん守りたいところ。** 送っただけで記録が動いたら赤 */
      if (記録2 === 記録) ok('指の端末 … ▶ で送っても、記録は1つも動かない', `済み ${記録} のまま`)
      else ng('指の端末 … ▶ で送っただけで、記録が動いた', `済み ${記録} → ${記録2}`)

      /* ── ◀ で、ひとつ前へ戻る ───────────────────── */
      try {
        await page.locator('.move-row .move-arrow').first().tap({ timeout: 4000 })
      } catch (e) {
        ng('指の端末 … ◀ を指で押せない', String(e.message).split('\n')[0].slice(0, 60))
      }
      await page.waitForTimeout(FLY_MS + 400)
      const 戻り = await いまの語(page)
      if (戻り === 頭) ok('指の端末 … ◀ を押すと、ひとつ前へ戻る', 戻り)
      else ng('指の端末 … ◀ を押しても、前に戻らない', `${頭} → ${次} → ${戻り}`)
      const 記録3 = await 済み(page)
      if (記録3 === 記録) ok('指の端末 … ◀ で戻っても、記録は動かない', `済み ${記録3}`)
      else ng('指の端末 … 戻ったときに記録が動いた', `済み ${記録} → ${記録3}`)

      /* ★ **出る側。** ボタンを押したときは、ちゃんと記録が動く ——
           これが無いと「どこを押しても記録されない」形でも緑になる。

           ★★ **本物のタップで押す。** `el.click()` を呼ぶと
           **指の動き(pointer)をまたいで届いてしまう**ので、
           **実機で1つも押せなくなっていても緑のまま**だった(2026-10-08)。 */
      try {
        await page.locator('.wordcard-answers button').first().tap({ timeout: 4000 })
      } catch (e) {
        ng('指の端末 … カードの中のボタンを、指で押せない',
          String(e.message).split('\n')[0].slice(0, 60))
      }
      await page.waitForTimeout(600)
      const 記録4 = await 済み(page)
      if (記録4 > 記録3) ok('指の端末 … 「まだ」を押したときは、記録が動く', `済み ${記録3} → ${記録4}`)
      else ng('指の端末 … 「まだ」を押しても記録が動かない', `済み ${記録3} → ${記録4}`)
      await page.close()
    }

    /* ── 指の端末 … 引きずっても、もう何も起きない ──────── */
    {
      /* ★ **スワイプを本当にやめたか**(2026-10-08)。
           **出ない側も測る** —— 「◀▶ が効く」だけを見ていると、
           **スワイプが生きたまま**でも緑になる(CLAUDE.md
           「『出る』と『出ない』の両方を見る」)。
           語をなぞって単語帳に入れる操作と、もうぶつからない。 */
      const page = await 単語帳を開く({
        viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true,
      })
      const 頭 = await いまの語(page)
      const 記録 = await 済み(page)
      await 引きずる(page, 1)
      const 後 = await いまの語(page)
      const 記録2 = await 済み(page)
      if (後 === 頭 && 記録2 === 記録) {
        ok('指の端末 … 引きずっても、送りも記録も動かない(スワイプは廃止)', 頭)
      } else {
        ng('指の端末 … 引きずったら、カードか記録が動いた',
          `${頭} → ${後} / 済み ${記録} → ${記録2} —— スワイプは廃止した決まりである`)
      }
      /* ★ **横の動きは、ブラウザに返した**(`touch-action` を縛っていない)。
           スワイプのために置いた2行は、要らなくなった */
      const 指の決まり = await page.evaluate(() => {
        const st = window.getComputedStyle(document.querySelector('.cardmove'))
        return { 指: st.touchAction, 選: st.userSelect }
      })
      if (/auto|manipulation/.test(指の決まり.指) && 指の決まり.選 !== 'none') {
        ok('指の端末 … 横の動きも、字を選ぶのも、ブラウザに返している',
          `touch-action: ${指の決まり.指} / user-select: ${指の決まり.選}`)
      } else {
        ng('指の端末 … スワイプのための縛りが残っている',
          `touch-action: ${指の決まり.指} / user-select: ${指の決まり.選}`)
      }
      await page.close()
    }

    /* ── マウスの端末 … ◀▶ は出さない ─────────────── */
    {
      /* ★ **パソコンには出さない**(利用者の指定「スマホ、タブレットのみ」)。
           あちらには**紙の左右の余白**と**矢印キー**がある ——
           **同じことをするものを2つ見せない**(CLAUDE.md) */
      const page = await 単語帳を開く({ viewport: { width: 1200, height: 900 } })
      const 矢 = (await 矢印の様子(page, '.wordcard-q', '.wordcard-answers')).矢
      if (矢.length === 0) ok('マウスの端末 … ◀▶ は出さない(余白とキーがある)')
      else ng('マウスの端末 … ◀▶ が出ている', `${矢.length} 個`)
      const 頭 = await いまの語(page)
      const 記録 = await 済み(page)
      await 引きずる(page, 1)
      const 後 = await いまの語(page)
      const 記録2 = await 済み(page)
      if (後 === 頭 && 記録2 === 記録) {
        ok('マウスの端末 … 引きずっても、送りも記録も動かない(なぞる操作とぶつけない)', 頭)
      } else {
        ng('マウスで引きずったら、カードか記録が動いた',
          `${頭} → ${後} / 済み ${記録} → ${記録2}`)
      }
      await page.close()
    }
  }

  console.log('\n▶ Quick Response にも、同じ ◀▶ が出る(第5.417節・2026-10-08)')
  {
    /* ★ **2つの画面が、同じ操作を受け取る**(CLAUDE.md「判断は1か所に持つ」)。
         単語帳だけ測っていると、**Quick Response に渡し忘れていても緑**になる。
         ここは幅も中身も違うので、**同じ形で出るか**を描いて確かめる。 */
    for (const [名, opts, 出るか] of [
      ['指の端末', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }, true],
      ['マウスの端末', { viewport: { width: 1200, height: 900 } }, false],
    ]) {
      const page = await browser.newPage(opts)
      await page.goto(`http://localhost:${PORT}/__bar.html?screen=qrreal`,
        { waitUntil: 'networkidle' })
      await page.waitForSelector('.qr-card', { timeout: 10000 })
      const 様子 = await page.evaluate(() => {
        const 箱 = (sel) => {
          const el = document.querySelector(sel)
          if (!el) return null
          const r = el.getBoundingClientRect()
          return { top: Math.round(r.top), bottom: Math.round(r.bottom),
            left: Math.round(r.left), right: Math.round(r.right) }
        }
        const 矢 = [...document.querySelectorAll('.move-row .move-arrow')].map((el) => {
          const r = el.getBoundingClientRect()
          return {
            名: el.getAttribute('aria-label') || '',
            w: Math.round(r.width), h: Math.round(r.height),
            top: Math.round(r.top), 中: Math.round(r.left + r.width / 2),
            左: Math.round(r.left), 右: Math.round(r.right),
          }
        })
        return { 矢, 本文: 箱('.qr-body'), 答え: 箱('.qr-answers'), 行: 箱('.move-row') }
      })
      const 矢 = 様子.矢
      if (!様子.答え) { ng(`Quick Response ${名} … 答えの行が描かれていない`); await page.close(); continue }
      if (出るか) {
        if (矢.length === 2) ok(`Quick Response ${名} … ◀▶ が2つ出ている`, 矢.map((x) => x.名).join(' / '))
        else ng(`Quick Response ${名} … ◀▶ が2つ出ていない`, `${矢.length} 個`)
        const 小さい = 矢.filter((x) => x.w < TAP_MIN || x.h < TAP_MIN)
        if (矢.length && !小さい.length) {
          ok(`Quick Response ${名} … ◀▶ は、押せる大きさで出ている`,
            矢.map((x) => `${x.w}×${x.h}`).join(' / '))
        } else if (矢.length) {
          ng(`Quick Response ${名} … ◀▶ が小さすぎる`, `${TAP_MIN}px 以上が要る`)
        }
        /* ★ **本文の下、判定より上**(利用者が実機の写真に描いた場所) */
        if (矢.length === 2 && 様子.本文) {
          const 下 = 矢.every((x) => x.top >= 様子.本文.bottom - 2)
          const 上 = 矢.every((x) => x.top < 様子.答え.top)
          if (下 && 上) {
            ok(`Quick Response ${名} … ◀▶ は、本文の下・判定より上にある`,
              `本文 ${様子.本文.bottom}px < 矢印 ${矢[0].top}px < 答え ${様子.答え.top}px`)
          } else {
            ng(`Quick Response ${名} … ◀▶ の置き場所がちがう`,
              `本文 ${様子.本文.bottom}px / 矢印 ${矢[0].top}px / 答え ${様子.答え.top}px`)
          }
        }
        /* ★ **まん中から左右へ同じだけ離れ、くっついていない** */
        if (矢.length === 2 && 様子.行) {
          const まん中 = (様子.行.left + 様子.行.right) / 2
          const 左 = Math.round(まん中 - 矢[0].中)
          const 右 = Math.round(矢[1].中 - まん中)
          const あいだ = 矢[1].左 - 矢[0].右
          if (矢[0].top === 矢[1].top && Math.abs(左 - 右) <= 1) {
            ok(`Quick Response ${名} … ◀▶ は、まん中から左右へ同じだけ離れている`, `左 ${左}px / 右 ${右}px`)
          } else {
            ng(`Quick Response ${名} … ◀▶ が、まん中から片寄っている`, `左 ${左}px / 右 ${右}px`)
          }
          if (あいだ >= TAP_MIN) ok(`Quick Response ${名} … ◀▶ のあいだが、しっかり空いている`, `${あいだ}px`)
          else ng(`Quick Response ${名} … ◀▶ が近すぎる`, `あいだ ${あいだ}px`)
        }
        /* ★ **押して、本当に文が変わるか**(出すだけで効かない形を弾く) */
        const 文 = () => page.evaluate(() => (
          document.querySelector('.qr-body')?.textContent?.trim()?.slice(0, 40) ?? ''))
        const 頭 = await 文()
        try { await page.locator('.move-row .move-arrow').last().tap({ timeout: 4000 }) }
        catch (e) { ng(`Quick Response ${名} … ▶ を指で押せない`, String(e.message).split('\n')[0].slice(0, 60)) }
        await page.waitForTimeout(FLY_MS + 400)
        const 次 = await 文()
        if (次 && 次 !== 頭) ok(`Quick Response ${名} … ▶ を押すと、次の文になる`, `${頭.slice(0, 14)} → ${次.slice(0, 14)}`)
        else ng(`Quick Response ${名} … ▶ を押しても、文が変わらない`, 頭.slice(0, 20))
      } else if (矢.length === 0) {
        ok(`Quick Response ${名} … ◀▶ は出さない(余白とキーがある)`)
      } else {
        ng(`Quick Response ${名} … ◀▶ が出ている`, `${矢.length} 個`)
      }
      await page.close()
    }
  }

  console.log('\n▶ キーの印は、キーの使える端末だけ(第5.417節)')
  {
    for (const [名, opts, 出るか] of [
      ['マウスの端末', { viewport: { width: 1200, height: 900 } }, true],
      ['指の端末', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }, false],
    ]) {
      const page = await 単語帳を開く(opts)
      const 字 = await page.evaluate(() => [...document.querySelectorAll('.wordcard-answers button')]
        .map((b) => b.textContent.trim()))
      if (字.length < 2) { ng(`${名} … 答えのボタンが2つ出ていない`, JSON.stringify(字)); await page.close(); continue }
      /* **印は `KEY_MARK` から読み取って突き合わせる**(書き写さない) */
      const 印 = 字.filter((t) => Object.values(KEY_MARK).some((m) => t.includes(m)))
      if (出るか) {
        if (印.length === 字.length) ok(`${名} … どのボタンにもキーの印が付く`, 字.join(' / '))
        else ng(`${名} … 印の付いていないボタンがある`, 字.join(' / '))
        /* ★ **上下の印が、上下のボタンに付いているか**(裏返っていたら赤)。

             **`KEY_MARK` と突き合わせてはいけない** —— 見比べる両方が
             同じ表から来るので、`ok` と `yet` を入れ替えても緑のままになる
             (赤チェックで見つけた・CLAUDE.md「見張りが、自分と
             同じ出どころを見ていないか」)。

             **突き合わせる相手は、キーの名前そのもの。**
             `ArrowDown` の印が「↓」であることは世界共通の事実で、
             このプロジェクトの値ではない。こちらは `keyMove()`
             (**別の表**)から引くので、**どちらか片方を書き換えれば
             必ず赤くなる。** */
        const 矢印 = { ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓' }
        const 印of = (move) => {
          const k = Object.keys(矢印).find((x) => keyMove({ key: x }) === move)
          return k ? 矢印[k] : ''
        }
        const まだ = 字.find((t) => t.startsWith('まだ')) ?? ''
        const 覚え = 字.find((t) => t.startsWith('覚え')) ?? ''
        if (印of('yet') && 印of('ok')
          && まだ.includes(印of('yet')) && 覚え.includes(印of('ok'))) {
          ok(`${名} … 「まだ」が ${印of('yet')} 、「覚え…」が ${印of('ok')}`
            + '(キーの名前と突き合わせた)')
        } else {
          ng(`${名} … 印とボタンの組が入れ替わっている`,
            `${まだ} / ${覚え}(まだ = ${印of('yet')} / 覚え = ${印of('ok')} のはず)`)
        }
      } else if (印.length === 0) {
        ok(`${名} … キーの印を出さない(押しようがないものを見せない)`, 字.join(' / '))
      } else {
        ng(`${名} … 指の端末にキーの印が出ている`, 印.join(' / '))
      }
      await page.close()
    }
  }

  console.log('\n▶ 覚え具合の札と、題の先頭(第5.417節・案A-3)')
  {
    const page = await 単語帳を開く({ viewport: { width: 390, height: 844 } })
    const m = await page.evaluate(() => {
      const 枠 = (el) => {
        if (!el) return null
        const b = el.getBoundingClientRect()
        return { t: b.top, b: b.bottom, l: b.left, r: b.right, h: b.height, w: b.width }
      }
      /* ★ **帯と同じ見た目のものを、カードの中に置いていないか**
           (2026-10-08 実機・利用者の指摘)。

           覚え具合を**進み具合の帯と同じ形・同じ金色の横棒**で描いたので、
           **1本の壊れた帯**に見えた。名前で探すと、次に別の名前で
           同じものを描いた日に素通りする —— **描かれた形で数える。**
           「低くて横に長い丸み」= 帯の段そのものの形である */
      const 帯の段 = [...document.querySelectorAll('.drill-bar > span')]
      const 高さ = 帯の段.length
        ? Math.max(...帯の段.map((x) => x.getBoundingClientRect().height)) : 0
      const そっくり = [...document.querySelectorAll('.wordcard *')].filter((el) => {
        if (el.closest('.drill-bar')) return false
        const b = el.getBoundingClientRect()
        if (b.height <= 0 || b.width <= 0) return false
        const c = window.getComputedStyle(el)
        if (c.backgroundColor === 'rgba(0, 0, 0, 0)') return false
        /* 帯の段と同じくらい低くて、横に長くて、丸い */
        return b.height <= 高さ + 2 && b.width >= b.height * 3
          && parseFloat(c.borderTopLeftRadius) >= b.height / 2 - 0.5
      }).map((el) => el.className || el.tagName)

      const 札 = document.querySelector('.wc-tag--stage')
      return {
        札: 札 ? { ...枠(札), 字: 札.textContent.trim() } : null,
        帯: 枠(document.querySelector('.drill-bar')),
        段の高さ: 高さ,
        そっくり,
        点が残っている: document.querySelectorAll('.learn-dot').length,
        紙: 枠(document.querySelector('.wordcard')),
        行: [...document.querySelectorAll('.wordcard-tags .wc-tag')]
          .map((x) => x.textContent.trim()),
        題: document.querySelector('.drill-title')?.textContent?.trim() ?? '',
        題の行: (() => {
          const el = document.querySelector('.drill-title')
          if (!el) return 0
          const h = el.getBoundingClientRect().height
          const ひと行 = parseFloat(window.getComputedStyle(el).lineHeight)
          return Number.isFinite(ひと行) && ひと行 > 0 ? Math.round(h / ひと行) : 0
        })(),
      }
    })

    /* ★ **丸く囲った文字で出す**(2026-10-08 利用者の指定)。
         **言葉は `learnStage.js` から読み取って突き合わせる**(書き写さない) */
    const 名 = stageLabel('learning')
    if (!m.札) {
      ng('覚え具合の札が出ていない', '`.wc-tag--stage` が描かれていない')
    } else if (m.札.字 !== 名) {
      ng(`覚え具合の札の字がちがう(${m.札.字})`, `箱2の語は「${名}」のはず`)
    } else {
      ok(`覚え具合は、丸く囲った文字で出る(${m.札.字})`)
    }
    /* **丸いか**(「丸く囲った文字」という指定そのもの) */
    if (m.札) {
      const 丸 = await page.evaluate(() => {
        const el = document.querySelector('.wc-tag--stage')
        const c = window.getComputedStyle(el)
        return parseFloat(c.borderTopLeftRadius) >= el.getBoundingClientRect().height / 2 - 0.5
      })
      if (丸) ok('覚え具合の札は、丸く囲ってある')
      else ng('覚え具合の札が、丸く囲われていない')
    }
    /* ★ **進み具合の帯と重なっていないか**(実機で重なっていた) */
    if (m.札 && m.帯) {
      const 重なり = !(m.札.b <= m.帯.t + 0.5 || m.札.t >= m.帯.b - 0.5
        || m.札.r <= m.帯.l + 0.5 || m.札.l >= m.帯.r - 0.5)
      if (重なり) {
        ng('覚え具合の札が、進み具合の帯と重なっている',
          `札 ${Math.round(m.札.t)}→${Math.round(m.札.b)} / 帯 ${Math.round(m.帯.t)}→${Math.round(m.帯.b)}`)
      } else {
        ok('覚え具合の札は、進み具合の帯と重なっていない',
          `すき間 ${Math.round(m.札.t - m.帯.b)}px`)
      }
    }
    /* ★ **帯とそっくりなものを、カードの中に置いていないか**(形で数える) */
    if (m.段の高さ <= 0) {
      ng('進み具合の帯が描かれていない', '形で見比べる相手がいない(見張りが素通りする)')
    } else if (m.そっくり.length) {
      ng(`進み具合の帯とそっくりなものが ${m.そっくり.length} 個ある`,
        `${m.そっくり.slice(0, 4).join(' / ')} —— 同じ見た目のものを2つ置かない`)
    } else {
      ok('進み具合の帯とそっくりなものを、カードの中に置いていない')
    }
    if (m.点が残っている) {
      ng(`やめたはずの点が ${m.点が残っている} 個残っている`, '`.learn-dot` は廃止した')
    } else ok('やめた点(`.learn-dot`)は、1つも残っていない')
    /* **もとからある札の行に入っているか**(新しい行を増やしていない) */
    if (m.行.includes(名)) ok('覚え具合は、もとからある札の行に並んでいる', m.行.join(' / '))
    else ng('覚え具合が、札の行の外にいる', m.行.join(' / ') || '(札が無い)')
    /* **段は4つとも言葉を持っている**(数も言葉も書き写さない) */
    const 言葉 = LEARN_STAGES.map((x) => stageLabel(x.id)).filter(Boolean)
    if (言葉.length === LEARN_STAGES.length) {
      ok(`段は ${LEARN_STAGES.length} つとも、字で言える`, 言葉.join(' / '))
    } else ng('段の名前が足りない', 言葉.join(' / '))

    /* ★ **A-3 は「1行にまとめる」**(2026-10-07 利用者の指定) */
    const 範囲 = pickName('due')
    if (m.題.startsWith(範囲)) ok('題の先頭に、いま出している範囲が出る', m.題)
    else ng('題の先頭に範囲が出ていない', `${m.題}(「${範囲}」で始まるはず)`)
    if (m.題の行 === 1) ok('題は1行にまとまっている', `${m.題の行} 行`)
    else ng(`題が ${m.題の行} 行になっている`, m.題)
    await page.close()
  }

  console.log('\n▶ Quick Response も、同じ操作(第5.417節)')
  {
    /* ★ **ここには「紙の余白」が無い。** `.qr-card` には幅の上限が無く、
         広い画面でもカードが列いっぱいに広がる(実測 782px / 782px)。
         **上限を足せば余白は生まれる**が、利用者の指定
         「Quick Response の幅は変えないでくださいよ」があるので触らない
         (`FocusFrame.jsx` に経緯がある)。

       **だから「出ない」を測る。** 44px 取れないときは帯を出さない ——
       出しても押せないものは、効かない操作である(CLAUDE.md)。
       **矢印キーは、こちらでも効く。◀▶ は指の端末だけに出る。** */
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 } })
    await page.goto(`http://localhost:${PORT}/__bar.html?screen=qrreal`,
      { waitUntil: 'networkidle' })
    await page.waitForSelector('.qr-card', { timeout: 10000 })
    const 文 = () => page.evaluate(() => (
      document.querySelector('.qr-card')?.textContent?.trim()?.slice(0, 40) ?? ''))
    const m = await page.evaluate(() => {
      const 箱 = (s2) => {
        const el = document.querySelector(s2)
        if (!el) return null
        const { x, y, width, height } = el.getBoundingClientRect()
        return { x, y, w: width, h: height, 見える: el.checkVisibility() }
      }
      /* 行の帯(左右の端)と、中のボタンの並び */
      const 行 = (s2) => {
        const el = document.querySelector(s2)
        if (!el) return null
        const b = el.getBoundingClientRect()
        const 子 = [...el.children].map((c) => {
          const r = c.getBoundingClientRect()
          return {
            字: (c.textContent || '').replace(/\s+/g, ' ').trim(),
            x: Math.round(r.left), 右: Math.round(r.right),
            w: Math.round(r.width), 上: Math.round(r.top), h: Math.round(r.height),
          }
        })
        return {
          x: Math.round(b.left), 右: Math.round(b.right), w: Math.round(b.width),
          段: new Set(子.map((c) => c.上)).size, 子,
        }
      }
      return {
        入れ物: 箱('.cardmove'), カード: 箱('.qr-card'),
        左: 箱('.cardmove-edge--l'), 右: 箱('.cardmove-edge--r'),
        本体: 箱('.app-body'), 画面: 箱('html'),
        隅が残っている: !!document.querySelector('.qr-card-corner'),
        /* ★ **上の行(聴く・リピート・もう出さない)と、下の答えの行** */
        上: 行('.qr-peek'), 下: 行('.qr-answers'),
        ボタン: [...document.querySelectorAll('.qr-card button')].map((b2) => b2.textContent.trim()),
      }
    })
    if (!m.入れ物) ng('Quick Response … カードが `CardMove` に包まれていない')
    else {
      /* ★ **余白は、本体(`.app-body`)まで数える**(2026-10-09 利用者の指定)。
           もとはカードの入れ物の中しか見ていなかったので、Quick Response は
           **カードが幅いっぱいで、帯が1度も出なかった**
           (利用者の指摘「余白のクリックも効きません」)。
           **幅は1ドットも変えていない** —— 数える相手を広げただけである */
      /* **本体が無い形では、画面そのものが相手**
         —— `CardMove` も `.app-body` が無ければ `documentElement` に落ちる。
         **落とし方を2通り持たない**(CLAUDE.md) */
      const 外 = m.本体 ?? m.画面
      const 余白 = 外
        ? Math.floor(Math.min(m.カード.x - 外.x, (外.x + 外.w) - (m.カード.x + m.カード.w)))
        : Math.floor((m.入れ物.w - m.カード.w) / 2)
      if (余白 >= TAP_MIN) {
        if (m.左?.見える && m.右?.見える) ok('Quick Response … 余白が取れたので、押せる帯が出る', `${余白}px`)
        else ng('Quick Response … 余白が取れているのに、押せる帯が出ない', `${余白}px`)
      } else if (m.左 || m.右) {
        ng('Quick Response … 余白が無いのに、押せる帯を出している', `${余白}px`)
      } else {
        ok('Quick Response … 余白が取れないので、押せる帯を出さない',
          `外 ${Math.round((m.本体 ?? m.画面)?.w ?? m.入れ物.w)}px / カード ${Math.round(m.カード.w)}px`)
      }
    }
    /* ★ **「もう出さない」は「聴く」「リピート」と同じ行の右端**
         (2026-10-08 利用者の指定)。

         > もう出さないのボタンは「聴く」「リピート」の右に収まるように
         > 置いてください。下の「まだ」「言えた」の合計の幅とバランスよく
         > なるように調整して、間も適切にバランスよく空けてください

       カードの右上へ浮かせていたが、**話し手の名前に重なった** ——
       名前の長さが問ごとに違うので、**重なるかどうかが問ごとに変わる**
       (浮かせたものは、下に何が来ても避けない)。 */
    if (m.隅が残っている) {
      ng('Quick Response … やめたはずの「右上の隅」が残っている',
        '`.qr-card-corner` は廃止した')
    } else ok('Quick Response … やめた「右上の隅」は残っていない')
    if (!m.上 || !m.下) {
      ng('Quick Response … 上の行か、答えの行が描かれていない')
    } else {
      const 字 = m.上.子.map((c) => c.字)
      const どこ = 字.findIndex((t) => t.includes('もう出さない'))
      if (どこ < 0) {
        ng('Quick Response … 「もう出さない」が上の行にいない', 字.join(' / '))
      } else if (どこ !== 字.length - 1) {
        ng('Quick Response … 「もう出さない」が、上の行のいちばん右にいない', 字.join(' / '))
      } else {
        ok('Quick Response … 「もう出さない」は「聴く」「リピート」の右にある',
          字.join(' / '))
      }
      /* ★ **上下の行が、同じ帯にそろっているか**(「バランスよく」の中身) */
      if (Math.abs(m.上.x - m.下.x) <= 1 && Math.abs(m.上.右 - m.下.右) <= 1) {
        ok('Quick Response … 上の行と答えの行が、同じ幅にそろっている',
          `${m.上.x}→${m.上.右}(${m.上.w}px)`)
      } else {
        ng('Quick Response … 上の行と答えの行で、幅がそろっていない',
          `上 ${m.上.x}→${m.上.右} / 下 ${m.下.x}→${m.下.右}`)
      }
      /* ★ **すき間も同じか**(となりどうしの間を、両方の行で測る) */
      const すき間 = (r) => r.子.slice(1).map((c, i) => c.x - r.子[i].右)
      const 上す = すき間(m.上)
      const 下す = すき間(m.下)
      const そろい = 上す.every((g) => 下す.every((h) => Math.abs(g - h) <= 1))
      if (上す.length && 下す.length && そろい) {
        ok('Quick Response … となりどうしのすき間も、上下で同じ',
          `上 ${上す.join(' / ')} / 下 ${下す.join(' / ')}`)
      } else {
        ng('Quick Response … 上下ですき間が違う',
          `上 ${上す.join(' / ')} / 下 ${下す.join(' / ')}`)
      }
      /* ★ **折り返していないか**(3つとも1行に収まる) */
      if (m.上.段 === 1) ok('Quick Response … 上の行は1行に収まっている', `${m.上.子.length} つ`)
      else ng(`Quick Response … 上の行が ${m.上.段} 段になっている`, 字.join(' / '))
      /* **高さもそろっているか**(字が折り返す狭い画面で、ぎざぎざにならない) */
      const 高さ = new Set(m.上.子.map((c) => c.h))
      if (高さ.size === 1) ok('Quick Response … 上の行は、高さもそろっている', `${[...高さ][0]}px`)
      else ng('Quick Response … 上の行の高さがばらばら', [...高さ].join(' / '))
    }
    /* ★ **矢印キーは、こちらでも効く** */
    const 頭 = await 文()
    /* ★ **待ち時間は `FLY_MS` から出す** —— 送りは飛んでから入れ替わる */
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(FLY_MS + 300)
    const 次 = await 文()
    if (次 !== 頭) ok('Quick Response … → で次の文になる')
    else ng('Quick Response … → を押しても、文が変わらない', 頭.slice(0, 30))
    await page.keyboard.press('ArrowLeft')
    await page.waitForTimeout(FLY_MS + 300)
    const 戻り = await 文()
    if (戻り === 頭) ok('Quick Response … ← で前の文に戻る')
    else ng('Quick Response … ← で前に戻らない')
    /* ★ **キーの印**(マウスの端末なので付く) */
    const 印 = m.ボタン.filter((t) => Object.values(KEY_MARK).some((k) => t.includes(k)))
    if (印.length === 2) ok('Quick Response … 答えの2つにキーの印が付く', 印.join(' / '))
    else ng('Quick Response … キーの印が付いていない', m.ボタン.join(' / ') || '(ボタンが無い)')
    await page.close()
  }

  console.log('\n▶ 上の行と答えの行を、狭い画面でもそろえる(第5.417節・2026-10-08)')
  {
    /* ★ **広い画面だけで測ると、何も守らない**(2026-10-08 に踏んだ)。

         折り返しの起点を中身に戻しても、高さをそろえるのをやめても、
         **1200px では3つとも 100px / 34px に収まるので緑のまま**だった。
         **いちばん危ない形(320px)を、検証の中に必ず1つ置く**
         (CLAUDE.md)—— あそこは帯が 266px しかなく、
         3つの中身(286px)が入りきらない。 */
    for (const w of [390, 320]) {
      const pg = await browser.newPage({ viewport: { width: w, height: 844 } })
      await pg.goto(`http://localhost:${PORT}/__bar.html?screen=qrreal`,
        { waitUntil: 'domcontentloaded' })
      try {
        await pg.waitForSelector('.qr-peek', { timeout: 10000 })
      } catch {
        ng(`行のそろい ${w}px … Quick Response が開かない`)
        await pg.close()
        continue
      }
      await pg.waitForTimeout(600)
      const m = await pg.evaluate(() => {
        const 行 = (q) => {
          const el = document.querySelector(q)
          if (!el) return null
          const b = el.getBoundingClientRect()
          const 子 = [...el.children].map((c) => {
            const r = c.getBoundingClientRect()
            return {
              字: (c.textContent || '').replace(/\s+/g, ' ').trim(),
              x: Math.round(r.left), 右: Math.round(r.right),
              w: Math.round(r.width), 上: Math.round(r.top), h: Math.round(r.height),
              はみ出し: Math.round(c.scrollWidth - c.clientWidth),
            }
          })
          return {
            x: Math.round(b.left), 右: Math.round(b.right),
            段: new Set(子.map((c) => c.上)).size, 子,
          }
        }
        return { 上: 行('.qr-peek'), 下: 行('.qr-answers') }
      })
      const どこ = `行のそろい ${w}px`
      if (!m.上 || !m.下) { ng(`${どこ} … 行が描かれていない`); await pg.close(); continue }
      /* **3つとも1行に収まるか**(狭い画面では、ここが落ちていた) */
      if (m.上.段 === 1) ok(`${どこ} … 上の行は1行`, m.上.子.map((c) => c.w).join(' / ') + 'px')
      else ng(`${どこ} … 上の行が ${m.上.段} 段になっている`, m.上.子.map((c) => c.字).join(' / '))
      /* **高さがそろっているか**(字が折り返すと、ここがばらつく) */
      const 高さ = new Set(m.上.子.map((c) => c.h))
      if (高さ.size === 1) ok(`${どこ} … 上の行は、高さもそろっている`, `${[...高さ][0]}px`)
      else ng(`${どこ} … 上の行の高さがばらばら`, [...高さ].join(' / '))
      /* **同じ帯か** */
      if (Math.abs(m.上.x - m.下.x) <= 1 && Math.abs(m.上.右 - m.下.右) <= 1) {
        ok(`${どこ} … 上下の行が、同じ幅にそろっている`, `${m.上.x}→${m.上.右}`)
      } else {
        ng(`${どこ} … 上下で幅がそろっていない`,
          `上 ${m.上.x}→${m.上.右} / 下 ${m.下.x}→${m.下.右}`)
      }
      /* **字が、ボタンからはみ出していないか** */
      const はみ = m.上.子.filter((c) => c.はみ出し > 1)
      if (はみ.length) ng(`${どこ} … 字がボタンからはみ出している`, はみ.map((c) => c.字).join(' / '))
      else ok(`${どこ} … 字は、どのボタンにも収まっている`)
      await pg.close()
    }
  }

  console.log('\n▶ 文の長さが変わっても、箱の大きさは変わらない(第5.417節)')
  {
    /* ★ **2026-10-08 実機・利用者の指摘。**

         > quick responseはなぜあんなに上によせたのですか？
         > 狭過ぎてスワイプできません。
         > 文の長さに関わらずかならず同じスペース、箱の大きさをキープして

       `CardMove` を挟んだ日に、`.qrfocus` の「残りいっぱいを取る」決まりを
       **入れ物へ渡し忘れた。** カードが中身なりの高さになり、問題も答えも
       **画面のてっぺんに寄り**、下はまるごと空白 ——
       **はらう場所も無くなっていた。**

       **測り方。** 同じ画面で**文の長さだけを変えて**、箱の大きさと場所が
       1px も動かないことを見る。**短い文だけで測ると、伸びていても緑のまま**
       である(CLAUDE.md「いちばん危ない形を、検証の中に必ず1つ置く」)。 */
    const 測る = async (pg) => pg.evaluate(() => {
      const 枠 = (q) => {
        const el = document.querySelector(q)
        if (!el) return null
        const b = el.getBoundingClientRect()
        return {
          t: Math.round(b.top), b: Math.round(b.bottom),
          h: Math.round(b.height), w: Math.round(b.width),
        }
      }
      const 本文 = document.querySelector('.qr-body')
      const 答え = document.querySelector('.qr-answers button')
      return {
        入れ物: 枠('.cardmove'), カード: 枠('.qr-card'), 箱: 枠('.qr'),
        答えの上: 答え ? Math.round(答え.getBoundingClientRect().top) : null,
        字数: (本文?.textContent ?? '').trim().length,
        はみ出し: 本文 ? 本文.scrollHeight - 本文.clientHeight : null,
        送る: document.scrollingElement.scrollHeight > window.innerHeight + 1,
      }
    })
    const 見た = []
    for (const [名, 倍] of [['短い文', 1], ['長い文', 6]]) {
      const pg = await browser.newPage({ viewport: { width: 390, height: 844 } })
      await pg.goto(`http://localhost:${PORT}/__bar.html?screen=qrreal`,
        { waitUntil: 'domcontentloaded' })
      try {
        await pg.waitForSelector('.qr-card', { timeout: 10000 })
      } catch {
        ng(`箱の大きさ ${名} … Quick Response が開かない`)
        await pg.close()
        continue
      }
      await pg.waitForTimeout(600)
      /* **文の長さだけを変える。** ほかは1ミリも動かさない */
      await pg.evaluate((n) => {
        const el = document.querySelector('.qr-body')
        if (el && n > 1) el.textContent = (el.textContent || '…').trim().repeat(n)
      }, 倍)
      await pg.waitForTimeout(200)
      見た.push([名, await 測る(pg)])
      await pg.close()
    }
    if (見た.length !== 2) {
      ng('箱の大きさ … 2通り測れなかった', `${見た.length} 通り`)
    } else {
      const 短 = 見た[0][1]
      const 長 = 見た[1][1]
      /* **長い文が、本当に長くなっているか**(でなければ何も測っていない) */
      if (長.字数 <= 短.字数) {
        ng('箱の大きさ … 文の長さが変わっていない',
          `${短.字数} → ${長.字数} 字。これでは伸びていても緑のまま`)
      } else {
        ok('箱の大きさ … 文の長さを変えて測った', `${短.字数} → ${長.字数} 字`)
        const 差 = ['t', 'b', 'h', 'w'].filter((k) => Math.abs(短.カード[k] - 長.カード[k]) > 1)
        if (差.length) {
          ng('箱の大きさ … 文の長さで、箱の大きさや場所が変わる',
            `${差.join(' / ')} が動いた(${JSON.stringify(短.カード)} → ${JSON.stringify(長.カード)})`)
        } else {
          ok('箱の大きさ … 文が長くなっても、箱の大きさと場所は同じ',
            `${短.カード.t}→${短.カード.b}(${短.カード.h}px)`)
        }
        if (短.答えの上 !== null && 短.答えの上 === 長.答えの上) {
          ok('箱の大きさ … 答えのボタンの場所も動かない', `${短.答えの上}px`)
        } else {
          ng('箱の大きさ … 答えのボタンが、文の長さで動く', `${短.答えの上} → ${長.答えの上}`)
        }
      }
      /* ★ **上に寄っていないか。** カードは練習の箱をいっぱいに使う ——
           使わないと下が空白になり、**はらう場所が無くなる** */
      for (const [名, m] of 見た) {
        if (!m.カード || !m.箱) {
          ng(`箱の大きさ ${名} … カードか箱が描かれていない`)
          continue
        }
        const 余り = m.箱.h - m.カード.h
        if (m.カード.h <= m.箱.h / 2) {
          ng(`箱の大きさ ${名} … カードが箱の半分も使っていない(上に寄っている)`,
            `カード ${m.カード.h} / 箱 ${m.箱.h}px`)
        } else if (余り > m.箱.h / 4) {
          ng(`箱の大きさ ${名} … カードの下に空白が多すぎる`,
            `余り ${余り} / 箱 ${m.箱.h}px —— はらう場所が無くなる`)
        } else {
          ok(`箱の大きさ ${名} … カードが練習の箱をいっぱいに使っている`,
            `カード ${m.カード.h} / 箱 ${m.箱.h}px`)
        }
        /* **挟んだ入れ物が、縦を止めていないか** */
        if (m.入れ物 && Math.abs(m.入れ物.h - m.カード.h) > 1) {
          ng(`箱の大きさ ${名} … 挟んだ入れ物とカードの高さが違う`,
            `入れ物 ${m.入れ物.h} / カード ${m.カード.h}px`)
        } else {
          ok(`箱の大きさ ${名} … 挟んだ入れ物は、縦の決まりをそのまま通している`)
        }
        if (m.はみ出し > 1) ng(`箱の大きさ ${名} … 本文が枠からはみ出している`, `${m.はみ出し}px`)
        if (m.送る) ng(`箱の大きさ ${名} … 画面を送ることになっている`)
      }
    }
  }
}

/* ════════════════════════════════════════════════════════════════════
   ★ **入れ物は「面」で分け、押せるものは「線」で示す**
     (第5.433節・2026-10-09 利用者の指定)

     > 基本的にボタンや弱点タグなどの枠線は消さずに、メニューも含め、
     > 箱など、入れ物の枠線を消すのが良いと思っています。

   **線を消しただけにすると、カードが消える。**
   いまカードと地の明暗差は 1.15 : 1 しかなく、
   **輪郭は 1px の線だけ**が作っていた(測って確かめた)。
   だから地を沈め、カードを持ち上げてある。

   ここで見るのは4つ。

     ① 入れ物(`.card`)の線が、**本当に透明になっているか**
     ② 押せるもの(`.btn` / `.chip`)の線は、**残っているか**
     ③ 線が透明なら、**地とカードの明暗差が足りているか**
        —— ここが戻ると、入れ物がまるごと見えなくなる
     ④ **紙では線が戻っているか**(面の差はインクに出ない)

   **値を書き写していない。** 色は画面から読み取り、
   明暗差は読み取った2色から計算する。
   ════════════════════════════════════════════════════════════════════ */
{
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } })
  console.log('\n── 入れ物は面、押せるものは線(第5.433節) ──')

  /** 暗い配色で開く。**配色を決め打ちしないと、ヘッドレスの既定で変わる** */
  const 開く = async (q) => {
    await page.goto(`http://localhost:${PORT}/__bar.html?screen=${q}`,
      { waitUntil: 'networkidle' })
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
    await page.waitForTimeout(200)
  }
  /** その部品の「幅のある辺の色」と、後ろに透けている地の色を読み取る */
  const 読む = (sel) => page.evaluate((s) => {
    const el = document.querySelector(s)
    if (!el) return null
    const cs = window.getComputedStyle(el)
    const 辺 = ['Top', 'Right', 'Bottom', 'Left']
      .map((d) => ({ w: parseFloat(cs[`border${d}Width`]) || 0, c: cs[`border${d}Color`] }))
      .filter((x) => x.w > 0)
    /* **後ろの地は、透けていない親までさかのぼって取る** ——
       入れ物の親は地色を持たないことが多い */
    const 透き = (c) => { const m = /rgba?\(([^)]+)\)/.exec(c || ''); if (!m) return 0
      const p = m[1].split(',').map(Number); return p.length > 3 ? p[3] : 1 }
    let 後ろ = el.parentElement
    while (後ろ && 透き(window.getComputedStyle(後ろ).backgroundColor) < 0.02) 後ろ = 後ろ.parentElement
    return {
      辺,
      地: cs.backgroundColor,
      後ろ: 後ろ ? window.getComputedStyle(後ろ).backgroundColor : null,
    }
  }, sel)
  const 不透明 = (c) => { const m = /rgba?\(([^)]+)\)/.exec(c || ''); if (!m) return 0
    const p = m[1].split(',').map(Number); return p.length > 3 ? p[3] : 1 }
  const 明るさ = (c) => {
    const m = /rgba?\(([^)]+)\)/.exec(c || '')
    if (!m) return null
    const [r, g, b] = m[1].split(',').map(Number)
    const f = (v) => (v / 255 <= 0.03928 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4)
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
  }
  const 明暗差 = (a, b) => {
    const [x, y] = [明るさ(a), 明るさ(b)].sort((p, q) => q - p)
    return (x + 0.05) / (y + 0.05)
  }

  await 開く('tools')

  /* ① 入れ物 —— 線は場所を取ったまま、色だけ透明になっている */
  {
    const m = await 読む('.card')
    if (!m) ng('入れ物 … カードが描かれていない')
    else if (!m.辺.length) {
      ng('入れ物 … カードに、幅のある辺が1つも無い',
        '幅ごと消すと、押しどころがずれる(色だけ透明にする)')
    } else if (m.辺.some((x) => 不透明(x.c) > 0.02)) {
      ng('入れ物 … カードに、まだ見える線がある',
        m.辺.map((x) => x.c).join(' / '))
    } else ok('入れ物 … カードの線は、場所だけ残して透明になっている')

    /* ③ 線が無いぶん、**面の差で分かれているか** */
    if (m && m.後ろ) {
      const r = 明暗差(m.地, m.後ろ)
      if (r < 1.25) {
        ng('入れ物 … カードと地が近すぎて、カードが消える',
          `${r.toFixed(2)} : 1(線が無いので、1.25 : 1 は要る)`)
      } else ok(`入れ物 … カードと地が、面で分かれている(${r.toFixed(2)} : 1)`)
    } else ng('入れ物 … カードの後ろの地が読み取れない')
  }

  /* ② 押せるもの —— 線が残っている */
  /* ★ **測る相手をまちがえない。**
       はじめ `.chip` と書いたら、**声の札**(`.cast-chip--quiet .cast-chip-btn`)に
       当たった —— あれは**この節の前から、わざと線を消してある**。
       **「わざと消してあるもの」を測ると、直っていても赤くなる。**
       選んでいる札(`.chip--on`)も外す —— あちらの線は金(`--accent-line`)で、
       `--border` を1度も通らない(2026-10-09 実測) */
  for (const [名, sel, 画面] of [
    ['ボタン', '.btn', null],
    /* ★ **札は、開かないと描かれない。**
         `?screen=search` の札は畳みの箱の中にあり、`open=1` を渡すまで
         1つも出ない —— **「無ければ素通り」する検証を書かない**(CLAUDE.md)。
         赤チェックで、壊していないのに赤いまま残って気づいた */
    ['札', '.chiprow > .chip:not(.chip--on)', 'search&open=1'],
  ]) {
    if (画面) await 開く(画面)
    const m = await 読む(sel)
    if (!m) ng(`押せるもの … ${名}が描かれていない`)
    else if (!m.辺.length) ng(`押せるもの … ${名}に、幅のある辺が1つも無い`)
    else if (m.辺.every((x) => 不透明(x.c) <= 0.02)) {
      ng(`押せるもの … ${名}の線まで消えている`,
        '押せるものの線は残す(第5.433節・利用者の指定)')
    } else ok(`押せるもの … ${名}には線が残っている`)
  }

  /* 下の帯も入れ物。**上の線は透明** */
  await 開く('tabs')
  {
    const m = await 読む('.app-tabs')
    if (!m) ng('入れ物 … 下の帯が描かれていない')
    else if (!m.辺.length) ng('入れ物 … 下の帯に、幅のある辺が1つも無い')
    else if (m.辺.some((x) => 不透明(x.c) > 0.02)) {
      ng('入れ物 … 下の帯に、まだ見える線がある', m.辺.map((x) => x.c).join(' / '))
    } else ok('入れ物 … 下の帯の線も透明になっている')
  }

  /* ④ 紙では戻す —— **面のわずかな差は、インクに出ない**

       **骨組みに紙の画面は無い。** だから「紙の決まりを当てた箱」を1つ作って、
       **決まりの重なり(カスケード)そのもの**を読む ——
       見たいのは「`.lesson-sheet` の中で `--box-line` が戻るか」であって、
       紙の画面が描けるかどうかではない。 */
  {
    const v = await page.evaluate(() => {
      const d = document.createElement('div')
      d.className = 'lesson-sheet'
      document.body.appendChild(d)
      const got = window.getComputedStyle(d).getPropertyValue('--box-line').trim()
      d.remove()
      return got
    })
    if (v === null) ng('紙 … 紙の決まりが読み取れない')
    else if (!v || v === 'transparent' || /^rgba\([^)]*,\s*0\s*\)$/.test(v)) {
      ng('紙 … 紙の上でも入れ物の線が消えている',
        `--box-line: ${v || '(空)'} —— 面の差はインクに出ない`)
    } else ok(`紙 … 紙では入れ物の線が戻っている(${v})`)
  }
  await page.close()
}

await browser.close()
console.log(bad === 0 ? '\n✅ 帯の持ちものは、すべて意図どおりです' : `\n❌ ${bad} 件`)
process.exit(bad === 0 ? 0 : 1)
