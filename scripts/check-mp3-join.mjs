/**
 * 教材の音声を**1本の MP3 にまとめる**ところを、機械的に確かめる。
 *
 * 【なぜ要るか】(2026-09 利用者の指定)
 *
 *   > 各教材の音声をダウンロード出来るようにしてください。
 *   > 全体の音声をひとつ。これだけでOKです。
 *   > 教材と同じビットレートのMP3でOKです。
 *
 *   **こちらには音が聞こえない。** しかも出来上がるのはファイルなので、
 *   壊れていても**画面には何も出ない。** 落とした人が再生して、
 *   はじめて分かる。だから**数字で確かめる。**
 *   耳の代わりに `test:audio` を置いたのと同じ考え方である。
 *
 * 【何を見るか】
 *   ① 頭(フレームヘッダ)を正しく読めるか — ビットレート・周波数・長さ
 *   ② 札(ID3)を落とせるか — **中ほどに残ると、そこで詰まる**
 *   ③ 無音が**元の音声と同じ形**になるか — ここが食い違うと音が壊れる
 *   ④ つないだ結果が、**フレームだけの並び**になっているか
 *   ⑤ 中身が**1バイトも書き換わっていない**か(作り直さない、という指定)
 */
import {
  audioFileName, dropId3v1, firstFrame, joinMp3, silenceFor, skipId3,
} from '../src/lib/mp3Join.js'

let bad = 0
const ok = (s) => console.log(`✓ ${s}`)
const ng = (s, d = '') => { bad += 1; console.log(`✗ ${s}${d ? `\n    ${d}` : ''}`) }

/**
 * 本物と同じ形の MP3 をこしらえる。
 * **中身は何でもよい**(ここで見るのは並べ方であって、音ではない)。
 */
function fakeMp3({ mpeg1 = true, kbps = 128, hz = 44100, frames = 4, id3 = false } = {}) {
  const brTable = mpeg1
    ? [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320]
    : [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160]
  const brIndex = brTable.indexOf(kbps)
  const srIndex = (mpeg1 ? [44100, 48000, 32000] : [22050, 24000, 16000]).indexOf(hz)
  const spf = mpeg1 ? 1152 : 576
  const len = Math.floor((spf / 8) * kbps * 1000 / hz)
  const verBits = mpeg1 ? 3 : 2
  const out = []
  if (id3) {
    // ID3v2:「ID3」+ 版2 + 旗1 + 大きさ4(同期安全整数)+ 中身
    const size = 20
    out.push(0x49, 0x44, 0x33, 3, 0, 0, 0, 0, 0, size)
    for (let i = 0; i < size; i += 1) out.push(0x41)
  }
  for (let f = 0; f < frames; f += 1) {
    out.push(0xff, 0xe0 | (verBits << 3) | (1 << 1) | 1, (brIndex << 4) | (srIndex << 2), 0xc4)
    // 中身。**0 以外を入れておく**(無音と見分けるため)
    for (let i = 4; i < len; i += 1) out.push((i + f) % 251 + 1)
  }
  return { bytes: new Uint8Array(out), len, spf, hz, frames }
}

// ── ① 頭を正しく読めるか ──────────────────────────────────────
{
  const cases = [
    ['MPEG1 128kbps 44.1kHz(ElevenLabs のよくある形)', { mpeg1: true, kbps: 128, hz: 44100 }, 417, 1152],
    ['MPEG2 48kbps 24kHz(Azure のよくある形)', { mpeg1: false, kbps: 48, hz: 24000 }, 144, 576],
    ['MPEG1 320kbps 48kHz', { mpeg1: true, kbps: 320, hz: 48000 }, 960, 1152],
  ]
  for (const [what, opt, wantLen, wantSpf] of cases) {
    const f = firstFrame(fakeMp3(opt).bytes)
    if (!f) ng(`${what} … 頭を読めない`)
    else if (f.len !== wantLen) ng(`${what} … 長さがちがう`, `${f.len} ≠ ${wantLen}`)
    else if (f.sampleRate !== opt.hz) ng(`${what} … 周波数がちがう`, `${f.sampleRate}`)
    else if (f.samplesPerFrame !== wantSpf) ng(`${what} … 1枚ぶんの長さがちがう`)
    else ok(`${what} … ${f.len} バイト / ${f.sampleRate}Hz`)
  }
  // **でたらめなものは、読めないと言う**(黙って何か返さない)
  if (firstFrame(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]))) ng('MP3 でないものを読めたと言っている')
  else ok('MP3 でないものは「読めない」と返す')
}

// ── ② 札(ID3)を落とせるか ──────────────────────────────────
{
  const withTag = fakeMp3({ id3: true })
  if (skipId3(withTag.bytes) !== 30) {
    ng('ID3v2 の札を飛ばせていない', `${skipId3(withTag.bytes)} バイト目のはずが違う`)
  } else ok('ID3v2 の札(先頭)を飛ばせる')

  const plain = fakeMp3()
  if (skipId3(plain.bytes) !== 0) ng('札が無いのに飛ばしている')

  // ID3v1(末尾の 128 バイト)
  const v1 = new Uint8Array(plain.bytes.length + 128)
  v1.set(plain.bytes, 0)
  v1[plain.bytes.length] = 0x54; v1[plain.bytes.length + 1] = 0x41
  v1[plain.bytes.length + 2] = 0x47
  if (dropId3v1(v1) !== plain.bytes.length) ng('ID3v1 の札(末尾)を落とせていない')
  else ok('ID3v1 の札(末尾)を落とせる')
}

// ── ③ 無音が、元の音声と同じ形になるか ────────────────────────
{
  const src = fakeMp3({ mpeg1: true, kbps: 128, hz: 44100 })
  const f = firstFrame(src.bytes)
  const ms = 300
  const s = silenceFor(f, ms)
  const perFrame = (f.samplesPerFrame / f.sampleRate) * 1000     // 26.12ms
  const want = Math.round(ms / perFrame)
  if (s.length !== want * f.len) {
    ng('無音の長さが合っていない', `${s.length} ≠ ${want} 枚 × ${f.len}`)
  } else ok(`無音 ${ms}ms … ${want} 枚(1枚 ${perFrame.toFixed(2)}ms)`)

  // **頭は元の音声と同じ**でなければならない(ビットレート・周波数)
  const sf = firstFrame(s)
  if (!sf) ng('作った無音の頭が読めない')
  else if (sf.sampleRate !== f.sampleRate || sf.len !== f.len) {
    ng('無音の形が本編と食い違っている',
      `${sf.sampleRate}Hz ${sf.len}B ≠ ${f.sampleRate}Hz ${f.len}B`)
  } else ok('無音は、本編と同じビットレート・同じ周波数')

  // **中身は 0** でなければ無音にならない
  const body = s.subarray(4, f.len)
  if (body.some((b) => b !== 0)) ng('無音の中身が 0 になっていない')
  else ok('無音の中身は 0(だから無音になる)')

  // **CRC は付けない**(0 で埋めた中身と食い違って弾かれる)
  if ((s[1] & 0x01) !== 1) ng('無音のフレームに CRC 有りの印が付いている')
  else ok('無音のフレームは CRC 無し')

  // MPEG2(24kHz)でも同じことができる
  const src2 = fakeMp3({ mpeg1: false, kbps: 48, hz: 24000 })
  const f2 = firstFrame(src2.bytes)
  const s2 = firstFrame(silenceFor(f2, 300))
  if (!s2 || s2.sampleRate !== 24000 || s2.len !== f2.len) {
    ng('MPEG2 の音声で、無音の形が合わない')
  } else ok('MPEG2(24kHz)でも、無音は本編と同じ形')

  // 間が 0 なら、何も作らない(**要らないものを足さない**)
  if (silenceFor(f, 0).length) ng('間が 0 なのに無音を作っている')
}

// ── ④⑤ つないだ結果 ──────────────────────────────────────────
{
  const a = fakeMp3({ frames: 3, id3: true })
  const b = fakeMp3({ frames: 2 })
  const joined = joinMp3([{ bytes: a.bytes, gapMs: 300 }, { bytes: b.bytes, gapMs: 0 }])

  // **札は1つも残っていない**(中ほどに残ると、そこで詰まる)
  let tags = 0
  for (let i = 0; i < joined.length - 2; i += 1) {
    if (joined[i] === 0x49 && joined[i + 1] === 0x44 && joined[i + 2] === 0x33) tags += 1
  }
  if (tags) ng(`つないだ中に ID3 の札が ${tags} 個残っている`)
  else ok('つないだ中に、札は1つも残らない')

  // **頭から終わりまで、フレームだけが並んでいる**(隙間が無い)
  const f = firstFrame(a.bytes)
  const gapFrames = Math.round(300 / ((f.samplesPerFrame / f.sampleRate) * 1000))
  const wantLen = a.len * 3 + f.len * gapFrames + b.len * 2
  if (joined.length !== wantLen) {
    ng('つないだ長さが合わない', `${joined.length} ≠ ${wantLen}`)
  } else ok(`つないだ長さ … ${joined.length} バイト(本編 5 枚 + 無音 ${gapFrames} 枚)`)

  let at = 0
  let count = 0
  while (at < joined.length - 4) {
    if (joined[at] !== 0xff || (joined[at + 1] & 0xe0) !== 0xe0) break
    const one = firstFrame(joined.subarray(at))
    if (!one || one.at !== 0) break
    at += one.len
    count += 1
  }
  if (at !== joined.length) {
    ng('フレームの並びが途中で切れている', `${at} バイト目で止まった(全 ${joined.length})`)
  } else ok(`フレームだけが ${count} 枚、隙間なく並んでいる`)

  /* **中身を1バイトも書き換えない**(利用者の指定「作り直さなくてよい」)。
     本編のバイト列が、そのままの形で入っていること */
  const head = a.bytes.subarray(30)      // 札のうしろ = 本編
  let same = true
  for (let i = 0; i < head.length; i += 1) if (joined[i] !== head[i]) { same = false; break }
  if (!same) ng('本編の中身が書き換わっている', '作り直さない、という指定である')
  else ok('本編の中身は1バイトも書き換わっていない')

  // 空のもの・壊れたものを渡されても落ちない
  if (joinMp3([]).length !== 0) ng('空を渡したのに何か返している')
  if (joinMp3([{ bytes: null }, { bytes: new Uint8Array(0) }]).length !== 0) {
    ng('中身の無いものを渡すと落ちる')
  } else ok('空・中身の無いものを渡しても落ちない')
}

// ── 名前 ──────────────────────────────────────────────────────
{
  const n = audioFileName('2026-09-04 / 少子化と災害 / 数字 + 数の表現')
  if (!n.endsWith('.mp3')) ng('拡張子が付いていない')
  else if (/[\\/:*?"<>|]/.test(n)) ng('保存できない記号が残っている', n)
  else ok(`名前 … ${n}`)
  if (audioFileName('') !== '教材の音声.mp3') ng('名前が空のときの控えが無い')
}

console.log(bad === 0 ? '\n✅ 音声のまとめの検証は、すべて意図どおりです' : `\n❌ ${bad} 件`)
process.exit(bad === 0 ? 0 : 1)
