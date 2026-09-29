/**
 * **鳴らし始める場所の検証**(第5.306節・2026-09-29 実機)。
 *
 *   > この問題から突然途中からしか再生されなかったり、全く音が鳴らなかったり
 *   > します。… 残りの1/3は初めの1単語が切れていたり、
 *   > ランダムに途中から再生されたり不安定です。
 *
 * ============================================================================
 * 【なぜ素の node では足りないか】
 *
 *   控えの出し入れ(`playMark.js`)は `npm run test:play` がすでに見ている。
 *   **壊れていたのは、その控えに渡す「秒」のほう**である。
 *   秒は `<audio>` の `currentTime` から来るので、
 *   **本物のブラウザで、本物の音を鳴らさないと測れない**(CLAUDE.md)。
 *
 * 【どう測るか】
 *
 *   ・音の入った WAV を**その場で作って**配る(**鍵も課金も要らない**)
 *   ・Supabase は**差し替える**(この環境から届かない)。
 *     置き場所の URL は、この検証の配り先へ向ける
 *   ・**本物の `audioClips.js` をそのまま読み込む。** 算段を1行も書き写さない
 *
 * 【Chromium で音を鳴らす】
 *   `--autoplay-policy=no-user-gesture-required` を渡す。
 *   headless でも `<audio>` は進む(`currentTime` が実際に増える)。
 * ============================================================================
 */
import { spawn } from 'node:child_process'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const PORT = 5199

let bad = 0
const ok = (s) => console.log(`✓ ${s}`)
const ng = (s, d = '') => { bad += 1; console.log(`✗ ${s}${d ? `\n    ${d}` : ''}`) }

const dir = mkdtempSync(join(tmpdir(), 'eas-clip-'))
const CFG = join(ROOT, 'vite.clip.config.js')
const PAGE = join(ROOT, '__clip.js')
const HTML = join(ROOT, '__clip.html')

/** 音の入った WAV(**0円・その場で作れる**)。長さだけ変えられる */
function toneWav(seconds) {
  const rate = 8000
  const n = Math.round(rate * seconds)
  const buf = Buffer.alloc(44 + n * 2)
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8)
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20)
  buf.writeUInt16LE(1, 22); buf.writeUInt32LE(rate, 24)
  buf.writeUInt32LE(rate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34)
  buf.write('data', 36); buf.writeUInt32LE(n * 2, 40)
  for (let i = 0; i < n; i += 1) {
    const hz = 440 + Math.floor(i / rate) * 60
    buf.writeInt16LE(Math.round(Math.sin((2 * Math.PI * hz * i) / rate) * 12000), 44 + i * 2)
  }
  return buf
}
/* **長さの違う音を用意する。** 「前の音のほうが長い / 短い」の
   両方を作れないと、いちばん危ない形を測れない(CLAUDE.md) */
const WAVS = { 2: toneWav(2), 6: toneWav(6), 9: toneWav(9) }
for (const [s, buf] of Object.entries(WAVS)) writeFileSync(join(dir, `t${s}.wav`), buf)

/* **本物をそのまま読み込む。** ここに算段を1行も書かない */
writeFileSync(PAGE, `
import { playClip, stopClip, clipTime, clipDuration } from '/src/lib/audioClips.js'
import { readAloud, stopReading } from '/src/lib/readAloud.js'
import { hasMark } from '/src/lib/playMark.js'
window.__clip = {
  playClip, stopClip, clipTime, clipDuration, readAloud, stopReading, hasMark,
}
window.__ready = true
`)
writeFileSync(HTML, `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><title>鳴らし始めの検証</title></head>
<body>
<script>
  /* 本物が使う音の入れ物を掴む。DOM に入らないので、作られる瞬間に控える
     —— **本物のコードには何も足していない** */
  window.__made = []
  const R = window.Audio
  window.Audio = function (...a) { const e = new R(...a); window.__made.push(e); return e }
</script>
<script type="module" src="/__clip.js"></script></body></html>
`)

writeFileSync(CFG, `
import { defineConfig } from 'vite'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
const DIR = ${JSON.stringify(dir)}
export default defineConfig({
  envDir: DIR,
  cacheDir: join(DIR, 'vite'),
  server: { port: ${PORT}, strictPort: true },
  plugins: [{
    name: 'tone',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url.startsWith('/storage/')) return next()
        if (req.url.includes('missing')) { res.statusCode = 404; res.end(); return }
        /* **頭出しできない配り方**(範囲の指定も長さも返さない)。
           実機で「まだ届いていない音声へ飛ぼうとした」ときと同じ形になる */
        if (req.url.includes('noseek')) {
          const wav = readFileSync(join(DIR, 't9.wav'))
          res.setHeader('content-type', 'audio/wav')
          res.end(wav)
          return
        }
        /* **声ごとに長さを変える。** 「前の音のほうが短い / 長い」の
           両方を作れないと、いちばん危ない形を測れない(CLAUDE.md) */
        const m = /sec(\\d+)/.exec(req.url)
        const byVoice = req.url.includes('/us-') ? '2'
          : req.url.includes('/uk-') ? '9' : null
        const wav = readFileSync(join(DIR, 't' + (m ? m[1] : (byVoice ?? '6')) + '.wav'))
        res.setHeader('content-type', 'audio/wav')
        res.setHeader('accept-ranges', 'bytes')
        res.setHeader('content-length', String(wav.length))
        res.end(wav)
      })
    },
  }],
})
`)
/* **本物の `supabase.js` をそのまま使う。** 置き場所をこの検証へ向けるだけで、
   窓口は1度も呼ばない(鳴らすのは `srcUrl` で渡した音である) */
writeFileSync(join(dir, '.env'), [
  `VITE_SUPABASE_URL=http://localhost:${PORT}`,
  'VITE_SUPABASE_ANON_KEY=sb_publishable_dummy_for_test',
].join('\n'))

const vite = spawn('npx', ['vite', '--config', CFG], { cwd: ROOT, stdio: 'ignore' })
const cleanup = () => {
  try { vite.kill('SIGTERM') } catch { /* もう止まっている */ }
  for (const f of [CFG, PAGE, HTML]) {
    try { rmSync(f) } catch { /* もう無い */ }
  }
  try { rmSync(dir, { recursive: true, force: true }) } catch { /* もう無い */ }
}
process.on('exit', cleanup)

async function waitUp() {
  for (let i = 0; i < 100; i += 1) {
    try { if ((await fetch(`http://localhost:${PORT}/__clip.html`)).ok) return true } catch { /* まだ */ }
    await new Promise((r) => setTimeout(r, 200))
  }
  return false
}
if (!await waitUp()) { console.log('✗ 開発サーバーが立ち上がらなかった'); process.exit(1) }

const browser = await chromium.launch({
  args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio'],
})
const page = await browser.newPage()
page.on('pageerror', (e) => ng('画面が落ちた', String(e)))
await page.goto(`http://localhost:${PORT}/__clip.html`, { waitUntil: 'load' })
await page.waitForFunction(() => window.__ready)

/** その長さの音の URL。**本物の置き場所の形に合わせてある** */
const src = (secs) => `http://localhost:${PORT}/storage/v1/object/public/tts/sec${secs}/a.wav`

console.log('\n▶ 鳴り終わったあとに「止めた場所」を訊く(第5.306節)')
{
  /* **いちばん危ない形**(CLAUDE.md)——
     ①1本を最後まで鳴らす ②鳴り終わる ③次の1本を押す前に `stopClip()`
     ここで**鳴り終わった秒**が返ると、それが**次の1本の「止めた場所」**に
     なってしまう(`stopReading()` が `stopped(at)` へ渡すため)。 */
  const got = await page.evaluate(async (url) => {
    const { playClip, stopClip, clipTime } = window.__clip
    /* **本当に鳴ったことを、先に確かめる**(鳴っていなければ測れていない) */
    let 最後 = 0
    const t = setInterval(() => { 最後 = clipTime() ?? 最後 }, 20)
    await playClip({ srcUrl: url, text: 'x' })       // 最後まで鳴らす
    clearInterval(t)
    return {
      鳴り終わり: 最後,
      止まっているか: clipTime() === null,
      返った秒: stopClip(),
    }
  }, src(2))
  if (got.鳴り終わり < 1.5) {
    ng('鳴り終わりまで進んでいない(測れていない)', JSON.stringify(got))
  } else if (got.返った秒 > 0.3) {
    ng('鳴り終わったあとなのに、止めた場所として秒を返す',
      `${got.返った秒.toFixed(2)} 秒を返した(次の1本が、ここから鳴り出す)`)
  } else {
    ok(`鳴り終わったあとは 0 を返す(${got.鳴り終わり.toFixed(2)} 秒まで鳴って、返りは ${got.返った秒})`)
  }
}

console.log('\n▶ 読み込みの途中で押し替えたとき')
{
  /* **鳴り出す前に押し替えても、控えを作らない。**
     `readAloud()` は鳴らす前に `nowPlaying()` を立てるので、
     ここで秒が返ると**1度も鳴っていない文**に控えが付く */
  const got = await page.evaluate(async (urls) => {
    const { playClip, stopClip } = window.__clip
    await playClip({ srcUrl: urls.a, text: 'a' })      // 最後まで鳴らす
    const p = playClip({ srcUrl: urls.b, text: 'b' })  // 読み込み中に…
    await new Promise((r) => setTimeout(r, 20))
    const out = { 途中の秒: stopClip() }
    await p
    return out
  }, { a: src(2), b: src(9) })
  if (got.途中の秒 > 0.3) {
    ng('読み込みの途中なのに、止めた場所として秒を返す',
      `${got.途中の秒.toFixed(2)} 秒(前の音の残り)`)
  } else ok('読み込みの途中で押し替えても、秒を返さない')
}

console.log('\n▶ 鳴っている途中で止めたら、その場所を返す(**外しすぎていないか**)')
{
  const got = await page.evaluate(async (url) => {
    const { playClip, stopClip } = window.__clip
    const p = playClip({ srcUrl: url, text: 'c' })
    await new Promise((r) => setTimeout(r, 900))
    const at = stopClip()
    await p
    return at
  }, src(9))
  if (got < 0.3) {
    ng('本当に止めたのに、場所を返さない(止めた場所からの再生が死ぬ)', String(got))
  } else ok(`鳴っている途中で止めたら、その場所を返す(${got.toFixed(2)} 秒)`)
}

console.log('\n▶ 区間だけを鳴らす(1本にまとめた音声の、その1文)')
{
  const got = await page.evaluate(async (url) => {
    const { playClip, clipTime } = window.__clip
    const seen = []
    const t = setInterval(() => { const v = clipTime(); if (v !== null) seen.push(v) }, 20)
    await playClip({ srcUrl: url, text: 'd', startAt: 4, stopAt: 6 })
    clearInterval(t)
    const 音あり = seen.filter((s) => s > 0)
    return {
      はじめ: 音あり[0] ?? -1,
      おわり: 音あり[音あり.length - 1] ?? -1,
      刻み: 音あり.length,
    }
  }, src(9))
  if (got.刻み < 3) {
    ng('区間が鳴っていない(すぐ終わった)', JSON.stringify(got))
  } else if (got.はじめ < 3.5 || got.はじめ > 4.6) {
    ng('区間の頭からずれて鳴り出した', `${got.はじめ.toFixed(2)} 秒(4.00 のはず)`)
  } else if (got.おわり > 6.5) {
    ng('区間の終わりを行き過ぎた', `${got.おわり.toFixed(2)} 秒(6.00 で止まるはず)`)
  } else {
    ok(`区間は 4→6 秒で鳴る(${got.はじめ.toFixed(2)} → ${got.おわり.toFixed(2)})`)
  }
}

console.log('\n▶ 頼んだ場所より手前で鳴り出したとき、音量が 0 のままにならないか')
{
  /* **無音の正体**(第5.306節)。`fade()` は「鳴らし始めてから何ミリ秒か」で
     入りの音量を決める。起点は**頼んだ場所**で取るが、
     **そこへ着くとは限らない**(MP3 の頭出し・まだ届いていない)。
     手前から鳴り出すと経過が**負**になり、**音量 0 のまま鳴り続ける** ——
     押した人には無音に聞こえる。

     **Chromium は小さい音なら必ず飛べてしまう**ので、待っていては
     この形を作れない(**「無ければ素通り」する検証を書かない**・CLAUDE.md)。
     だから**鳴り出したあとに、こちらで手前へ戻す** ——
     `seekClip()` を通さずに戻すのは、実機で「頼んだ場所に着かなかった」
     ときとまったく同じ形である。 */
  const got = await page.evaluate(async (url) => {
    const { playClip, stopClip } = window.__clip
    const el = window.__made[0]
    const p = playClip({ srcUrl: url, text: 'e', startAt: 6 })
    await new Promise((r) => setTimeout(r, 250))
    const 飛んだ先 = Number(el.currentTime) || 0
    el.currentTime = 0.2               // ← 着けなかったことにする(戻す道は通さない)
    let 最大 = 0
    const t = setInterval(() => { 最大 = Math.max(最大, Number(el.volume) || 0) }, 10)
    await new Promise((r) => setTimeout(r, 600))
    clearInterval(t)
    stopClip()
    await p
    return { 飛んだ先, 最大音量: 最大, 位置: Number(el.currentTime) || 0 }
  }, src(9))
  if (got.飛んだ先 < 5) {
    ng('そもそも頼んだ場所へ飛べていない(測れていない)', JSON.stringify(got))
  } else if (got.最大音量 <= 0) {
    ng('手前から鳴り出すと、音量が 0 のまま(無音に聞こえる)',
      `いちばん大きくて ${got.最大音量}(位置 ${got.位置.toFixed(2)} 秒)`)
  } else {
    ok(`手前から鳴り出しても、音は戻る(いちばん大きくて ${got.最大音量.toFixed(2)})`)
  }
}

console.log('\n▶ 前の文を最後まで聴いたあと、次の文を押す(**実機の症状そのもの**)')
{
  /* 2026-09-29 実機。
       > この問題から突然途中からしか再生されなかったり、
       > 全く音が鳴らなかったりします

     **`readAloud()` を通して測る。** `stopClip()` だけ見ても、
     控えに渡るまでの配線が切れていたら気づけない(**道が2つあるものは
     両方を数える**・CLAUDE.md)。

     文A は 2 秒・文B は 9 秒(声で長さを分けてある)。
     直す前は、**B が 2.00 秒から鳴り出していた。** */
  const got = await page.evaluate(async () => {
    const { readAloud, clipTime } = window.__clip
    await readAloud('Alpha bravo charlie.', { clipVoice: 'us-1', clipOnly: true })
    let 頭 = null
    const t = setInterval(() => {
      const v = clipTime()
      if (頭 === null && v !== null && v > 0) 頭 = v
    }, 10)
    const p = readAloud('Delta echo foxtrot golf.', { clipVoice: 'uk-1', clipOnly: true })
    await new Promise((r) => setTimeout(r, 700))
    window.__clip.stopReading()
    await p
    clearInterval(t)
    return { 次の頭: 頭 }
  })
  if (got.次の頭 === null) {
    ng('次の文が鳴らなかった(測れていない)', JSON.stringify(got))
  } else if (got.次の頭 > 0.5) {
    ng('前の文の残り秒から、次の文が鳴り出した',
      `${got.次の頭.toFixed(2)} 秒から(前の文は 2 秒)`)
  } else {
    ok(`次の文は頭から鳴る(はじめに見えた秒 ${got.次の頭.toFixed(2)})`)
  }
}

await browser.close()
console.log(bad
  ? `\n❌ ${bad} 件が意図どおりではありません`
  : '\n✅ 鳴らし始める場所は、すべて意図どおりです')
process.exit(bad ? 1 : 0)
