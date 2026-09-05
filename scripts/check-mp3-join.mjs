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
 *   ⑥ どの教材で何本集まるか(`audioPlaylist.js`)
 *   ⑦ **長さの札**が、全体の長さを指しているか(2026-09 実機)
 *   ⑧ **発言の終わり**をなだらかに下げているか(2026-09 実機・プチッ)
 */
import { readFileSync } from 'node:fs'
import {
  audioFileName, countFrames, dropId3v1, firstFrame, joinMp3,
  silenceFor, skipId3, vbrTagFrame, vbrTagOf,
} from '../src/lib/mp3Join.js'

let bad = 0
const ok = (s) => console.log(`✓ ${s}`)
const ng = (s, d = '') => { bad += 1; console.log(`✗ ${s}${d ? `\n    ${d}` : ''}`) }

/**
 * 本物と同じ形の MP3 をこしらえる。
 * **中身は何でもよい**(ここで見るのは並べ方であって、音ではない)。
 */
function fakeMp3({
  mpeg1 = true, kbps = 128, hz = 44100, frames = 4, id3 = false,
  /* **長さの札**(先頭の1枚)を付ける。本物の MP3 にはたいてい付いている。
     ここに書いた枚数を、再生機は「この音声の長さ」として読む。
     **わざと嘘の枚数を書ける**ようにしてある(落とせているかを見るため) */
  xing = 0,
} = {}) {
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
  const head = () => out.push(
    0xff, 0xe0 | (verBits << 3) | (1 << 1) | 1, (brIndex << 4) | (srIndex << 2), 0xc4,
  )
  if (xing) {
    /* 頭 → 副情報(0 で埋める)→ `Xing` → 旗 → 枚数 → 大きさ。
       **ここは手で組む。** 検証する側と同じ関数で作ると、
       その関数が間違っていても気づけない。
       **ちょうど1枚(len バイト)にする** */
    const side = mpeg1 ? 17 : 9        // 0xc4 はモノラル
    const at = 4 + side
    const f = new Array(len).fill(0)
    f[0] = 0xff
    f[1] = 0xe0 | (verBits << 3) | (1 << 1) | 1
    f[2] = (brIndex << 4) | (srIndex << 2)
    f[3] = 0xc4
    ;[0x58, 0x69, 0x6e, 0x67].forEach((b, i) => { f[at + i] = b })   // "Xing"
    f[at + 7] = 0x03                   // 枚数と大きさを書いた、という印
    f[at + 8] = (xing >>> 24) & 0xff
    f[at + 9] = (xing >>> 16) & 0xff
    f[at + 10] = (xing >>> 8) & 0xff
    f[at + 11] = xing & 0xff
    out.push(...f)
  }
  for (let f = 0; f < frames; f += 1) {
    head()
    // 中身。**0 以外を入れておく**(無音と見分けるため)
    for (let i = 4; i < len; i += 1) out.push((i + f) % 251 + 1)
  }
  return { bytes: new Uint8Array(out), len, spf, hz, frames, xing }
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
  // 先頭には**長さの札が1枚**付く(2026-09。下の⑦)
  const tagLen = f.len
  const wantLen = tagLen + a.len * 3 + f.len * gapFrames + b.len * 2
  if (joined.length !== wantLen) {
    ng('つないだ長さが合わない', `${joined.length} ≠ ${wantLen}`)
  } else ok(`つないだ長さ … ${joined.length} バイト(札 1 + 本編 5 + 無音 ${gapFrames} 枚)`)

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
  // **長さの札のぶんだけ、うしろから**(本編そのものは1バイトも変えない)
  for (let i = 0; i < head.length; i += 1) {
    if (joined[tagLen + i] !== head[i]) { same = false; break }
  }
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

// ── ⑥ どの教材で「音声をダウンロード」が出るか ────────────────
/* 【なぜ要るか】(2026-09 実機)
 *
 *   > あれ？先ほど作成した「ダイアローグ」では音声のダウンロードが
 *   > できるのですが、その後に作成した「記事」ではダメでした。
 *
 *   本文の演習かどうかを、`exercise_type === 'reading'` と**直に書いて**
 *   いた。記事の演習の id は **`article`** なので、記事だけ 0 件になり、
 *   ボタンそのものが出なかった。`npm run lint` も `npm run build` も通る。
 *
 *   利用者の指定は「**記事・会話・会議**に付ける。短文だけのトレーニングは要らない」。
 *   会議は本文が `dialogue` なので、本文かどうかで数えれば3つとも入る。 */
{
  const { materialAudioClips } = await import('../src/lib/audioPlaylist.js')

  const body = (type, items) => ({
    sections: [{ exercise_type: type, items }],
    voiceIds: [],
    tags: [],
  })
  const para = (n) => Array.from({ length: n }, (_, i) => ({
    prompt_en: `This is paragraph ${i + 1}.`, speaker: null,
  }))
  const turns = (n) => Array.from({ length: n }, (_, i) => ({
    prompt_en: `Line ${i + 1}, right?`, speaker: i % 2 ? 'Mika' : 'Josh',
  }))

  const cases = [
    ['記事', body('article', para(6)), 6],
    ['会話', body('dialogue', turns(14)), 14],
    // 会議は「種類」であって演習ではない。本文は会話と同じ `dialogue`
    ['会議(3人)', { ...body('dialogue', turns(14)), kind: 'meeting' }, 14],
    // **短文だけのトレーニングには要らない**(利用者の指定)
    ['文型ドリル', body('translate_en_ja', para(10)), 0],
    ['単語', body('vocabulary', para(20)), 0],
    ['フレーズ', body('phrase', para(20)), 0],
    ['内容の理解', body('comprehension', para(5)), 0],
  ]
  for (const [what, material, want] of cases) {
    const got = materialAudioClips(material).length
    if (got !== want) ng(`${what} … 集める本数がちがう`, `${got} ≠ ${want}`)
    else ok(`${what} … ${want} 本${want ? '' : '(ボタンを出さない)'}`)
  }

  // 中身が無い項目は数えない(空の無音を挟まないため)
  const holes = materialAudioClips(body('article', [
    { prompt_en: 'One.' }, { prompt_en: '   ' }, { prompt_en: 'Two.' },
  ]))
  if (holes.length !== 2) ng('中身の空いた項目を数えている', `${holes.length} 本`)
  else ok('中身の空いた項目は数えない')

  // 最後のあとに間は要らない / 間は 0 以上
  if (holes.at(-1).gapMs !== 0) ng('いちばん最後のあとにも間を入れている')
  else if (holes.some((c) => !(c.gapMs >= 0))) ng('間が数になっていない')
  else ok('間は、最後のあとだけ 0')

  /* 声と段が、1本ずつちゃんと決まっている。
     **声は教材に保存されているもの**を渡す(`castClipSpeakers` が
     最初に話す人から順に当てる)。選んでいない教材は
     代役1つに落ちるので、そちらは声の数を見ない */
  const talk = materialAudioClips({
    ...body('dialogue', turns(4)), voiceIds: ['us-2', 'us-1'],
  })
  if (talk.some((c) => !c.voiceId)) ng('声が当たっていない本がある')
  else if (talk.map((c) => c.voiceId).join(',') !== 'us-2,us-1,us-2,us-1') {
    ng('話す人ごとの声が、選んだ順になっていない', talk.map((c) => c.voiceId).join(','))
  } else if (talk.some((c) => c.tier !== 'premium')) {
    ng('本文なのに、良い声の段になっていない')
  } else ok('会話 … 選んだ声が、最初に話す人から順に当たる(段は premium)')

  // 声を選んでいない教材でも、鳴る(代役に落ちる)。**0本にしない**
  const noVoice = materialAudioClips(body('dialogue', turns(4)))
  if (noVoice.length !== 4 || noVoice.some((c) => !c.voiceId)) {
    ng('声を選んでいない会話で、集められなくなっている')
  } else ok('声を選んでいない会話も、代役の声で集められる')

  if (materialAudioClips(null).length || materialAudioClips({}).length) {
    ng('教材が無いのに何か返している')
  } else ok('教材が無ければ 0 本')
}

// ── ⑦ 長さの札 ────────────────────────────────────────────────
/* 【なぜ要るか】(2026-09 実機・利用者の指摘)
 *
 *   > 実際は2分29秒の音声が、プレーヤーでは22秒として表示されます。
 *   > 22秒のところで再生バーは終了するのに音声だけは続く
 *
 *   **22秒は、1つめの発言の長さである。** MP3 そのものには長さが
 *   書かれていないので、多くの作り手は先頭に音の出ないフレームを1枚
 *   置き、そこに「全部で何枚あるか」を書く。つないだあとも
 *   **1本目のその札がそのまま先頭に残っていた。**
 *
 *   **こちらには音が聞こえず、再生機も無い。** だから数字で見る。 */
{
  const one = fakeMp3({ frames: 10, xing: 10 })   // 札に「10枚」と書いてある
  const two = fakeMp3({ frames: 20, xing: 20 })

  // まず、札を見つけられるか(見つけられなければ落とせない)
  const tagged = firstFrame(one.bytes)
  if (vbrTagOf(one.bytes, tagged) !== 'Xing') {
    ng('長さの札を見つけられない', '落とせないので、1本目の長さが全体になる')
  } else ok('長さの札(Xing)を見分けられる')

  const plain = fakeMp3({ frames: 3 })
  if (vbrTagOf(plain.bytes, firstFrame(plain.bytes))) {
    ng('札が無いのに「ある」と言っている', 'ふつうのフレームを1枚捨ててしまう')
  } else ok('札が無ければ「無い」と返す')

  const joined = joinMp3([{ bytes: one.bytes, gapMs: 0 }, { bytes: two.bytes, gapMs: 0 }])

  /* **元の札は1枚も残っていない。** 中ほどに残ると、そこで数え直す
     再生機を混乱させる。先頭の1枚は、こちらが作り直したものである */
  let stale = 0
  let at = 0
  while (at < joined.length) {
    const fr = firstFrame(joined.subarray(at))
    if (!fr || fr.at !== 0) break
    if (at > 0 && vbrTagOf(joined.subarray(at), fr)) stale += 1
    at += fr.len
  }
  if (stale) ng(`元の長さの札が ${stale} 枚残っている`)
  else ok('元の長さの札は、1枚も残っていない')

  // 先頭は、こちらが作った札
  const lead = firstFrame(joined)
  const kind = vbrTagOf(joined, lead)
  if (!kind) ng('先頭に長さの札が無い', '再生機が長さを見積もれない')
  else ok(`先頭に長さの札がある(${kind} … ビットレートが最後まで同じ)`)

  /* **書いてある枚数が、本当の枚数と合っているか。**
     ここがこの検証のかなめである。合っていなければ、
     再生バーはまた途中で終わる */
  const sideLen = 4 + 17               // MPEG1・モノラル
  const readU32 = (o) => (joined[o] << 24 | joined[o + 1] << 16
    | joined[o + 2] << 8 | joined[o + 3]) >>> 0
  const wroteFrames = readU32(sideLen + 8)
  const wroteBytes = readU32(sideLen + 12)
  const realFrames = countFrames(joined.subarray(lead.len))
  if (wroteFrames !== 30) {
    ng('札に書いた枚数がちがう', `${wroteFrames} ≠ 30(10 + 20)`)
  } else if (realFrames !== 30) {
    ng('本当に並んでいる枚数がちがう', `${realFrames} ≠ 30`)
  } else if (wroteBytes !== joined.length) {
    ng('札に書いた大きさがちがう', `${wroteBytes} ≠ ${joined.length}`)
  } else {
    const secs = (wroteFrames * one.spf) / one.hz
    ok(`札の枚数 ${wroteFrames} 枚 = 実際の枚数(${secs.toFixed(2)} 秒ぶん)`)
  }

  // 間(ま)の無音も、枚数に入る。**入れ忘れると、そのぶん短く出る**
  const withGap = joinMp3([{ bytes: one.bytes, gapMs: 300 }, { bytes: two.bytes, gapMs: 0 }])
  const gapFrames = Math.round(300 / ((one.spf / one.hz) * 1000))
  const lead2 = firstFrame(withGap)
  const wrote2 = ((withGap[sideLen + 8] << 24 | withGap[sideLen + 9] << 16
    | withGap[sideLen + 10] << 8 | withGap[sideLen + 11]) >>> 0)
  if (wrote2 !== 30 + gapFrames) {
    ng('間(ま)の無音が、枚数に入っていない', `${wrote2} ≠ ${30 + gapFrames}`)
  } else if (countFrames(withGap.subarray(lead2.len)) !== wrote2) {
    ng('間を入れると、枚数と中身が食い違う')
  } else ok(`間(ま)の無音 ${gapFrames} 枚も、枚数に入っている`)

  // 数え損ねたら、**札は付けない**(間違った長さを書くくらいなら書かない)
  const broken = new Uint8Array([...one.bytes.subarray(0, one.len * 3), 9, 9, 9])
  const out = joinMp3([{ bytes: broken, gapMs: 0 }])
  if (vbrTagOf(out, firstFrame(out))) {
    ng('数え損ねたのに札を付けている', '間違った長さを書くほうが悪い')
  } else ok('枚数を数え損ねたときは、札を付けない')

  // 札そのものを作れるか(入りきらない形では作らない)
  if (!vbrTagFrame(lead, 30, 1234, true).length) ng('札を作れていない')
  else if (vbrTagFrame(lead, 0, 0, true).length) ng('0 枚なのに札を作っている')
  else ok('札は、枚数があるときだけ作る')
}


// ── ⑧ 発言の終わりを、なだらかに下げているか ──────────────────
//
//   2026-09 利用者の指定「本気で解決策を考えてください」。
//
//   実測したところ、**ElevenLabs が返す MP3 そのもの**が、音のある途中で
//   ぶつりと終わっていた(14発言のうち6発言。最大 0.11 = -19dBFS)。
//   だから窓口(`speak`)が、置く前に**終わりだけを段々小さくする。**
//
//   ここでは**その中身を、窓口のソースから取り出して**確かめる。
//   窓口は1ファイルで完結させる決まり(配置の手順を増やさないため)なので、
//   同じものを `src/lib/` にも置くと**2か所でそろえること**になる。
//   だから「取り出して走らせる」。**書き写さない。**
{
  const src = readFileSync(new URL('../supabase/functions/speak/index.ts', import.meta.url), 'utf8')
  const a = src.indexOf('// ── ここから mp3-fade')
  const b = src.indexOf('// ── ここまで mp3-fade')
  if (a < 0 || b < 0) {
    ng('窓口(speak)に mp3-fade の印が無い', '印を消すと、この検証が何も見なくなる')
  } else {
    const block = src.slice(a, b)
    const { fadeMp3Tail, FADE_RAMP } = new Function(
      `${block}\nreturn { fadeMp3Tail, FADE_RAMP }`,
    )()

    // 窓口が**実際に呼んでいる**か。定義だけあって誰も呼ばなければ同じこと
    if (!/const stored = provider === 'eleven' \? fadeMp3Tail\(audio\) : audio/.test(src)) {
      ng('窓口が fadeMp3Tail を呼んでいない')
    } else if (!/body: stored,/.test(src)) {
      ng('なだらかにしたほうを置いていない', 'body: audio のままでは何も変わらない')
    } else ok('窓口は、置く前になだらかにしている(ElevenLabs のときだけ)')

    /** MPEG1・モノラルの global_gain(グラニュール 0 / 1)を読む */
    const gainAt = (bytes, at, gr) => {
      const base = at + 4
      const off = gr ? 98 : 39
      let v = 0
      for (let k = 0; k < 8; k += 1) {
        const p = off + k
        v = (v << 1) | ((bytes[base + (p >> 3)] >> (7 - (p & 7))) & 1)
      }
      return v
    }
    /** フレームの頭の場所を並べる */
    const spots = (bytes) => {
      const out = []
      let i = 0
      while (i < bytes.length) {
        const f = firstFrame(bytes.subarray(i))
        if (!f) break
        out.push(i + f.at)
        i += f.at + f.len
      }
      return out
    }

    const src1 = fakeMp3({ frames: 8 })
    const done = fadeMp3Tail(src1.bytes)

    if (done.length !== src1.bytes.length) {
      ng('長さが変わっている', `${src1.bytes.length} → ${done.length}`)
    } else ok(`1バイトも増えていない(${done.length} バイト)`)

    const before = spots(src1.bytes)
    const after = spots(done)
    if (before.join() !== after.join() || before.length !== src1.frames) {
      ng('フレームの並びが崩れている', `${before.length} → ${after.length}`)
    } else ok(`フレームは ${after.length} 枚のまま、場所も動いていない`)

    // 下げたのは**終わりの数グラニュールだけ**か
    const grains = []
    for (const at of after) { grains.push([at, 0], [at, 1]) }
    let moved = 0
    let wrong = 0
    for (let k = 0; k < grains.length; k += 1) {
      const [at, gr] = grains[k]
      const was = gainAt(src1.bytes, at, gr)
      const now = gainAt(done, at, gr)
      const back = grains.length - 1 - k              // 終わりから何番目か
      const want = back < FADE_RAMP.length
        ? Math.max(0, was - Math.round(FADE_RAMP[back] / 1.5)) : was
      if (now !== want) wrong += 1
      if (now !== was) moved += 1
    }
    if (wrong) ng(`${wrong} 個のグラニュールが、思ったとおりに下がっていない`)
    else if (moved !== FADE_RAMP.length) {
      ng(`下げた数が合わない`, `${moved} ≠ ${FADE_RAMP.length}`)
    } else ok(`終わりの ${FADE_RAMP.length} グラニュール(約 ${Math.round(FADE_RAMP.length * 13)}ms)だけを下げている`)

    // **段々**下がっているか(いちばん最後がいちばん小さい)
    const ramp = FADE_RAMP.slice()
    const desc = ramp.every((v, k) => k === 0 || v < ramp[k - 1])
    if (!desc) ng('下げ方が段々になっていない', '終わりに近いほど大きく下げる')
    else ok(`下げ方 … ${ramp.join('dB → ')}dB(終わりから遡って)`)

    // 中身(音のデータ)は1バイトも書き換えていない。
    // 変わってよいのは side info の中の global_gain だけである
    let touched = 0
    for (let i = 0; i < done.length; i += 1) if (done[i] !== src1.bytes[i]) touched += 1
    const last3 = after.slice(-3)
    let outside = 0
    for (let i = 0; i < done.length; i += 1) {
      if (done[i] === src1.bytes[i]) continue
      // 4 + side info(17 バイト)の中か
      if (!last3.some((at) => i >= at + 4 && i < at + 4 + 17)) outside += 1
    }
    if (outside) ng(`side info の外を ${outside} バイト書き換えている`)
    else ok(`書き換えたのは side info の中だけ(${touched} バイト)`)

    // 触れない形は、そのまま返す
    const m2 = fakeMp3({ mpeg1: false, kbps: 48, hz: 24000, frames: 8 })
    const kept = fadeMp3Tail(m2.bytes)
    if (kept.some((v, i) => v !== m2.bytes[i])) {
      ng('MPEG2(24kHz)を書き換えている', 'Azure / Google の音声には触らない')
    } else ok('MPEG2(24kHz・Azure / Google)には何もしない')

    const tiny = fakeMp3({ frames: 2 })
    const kept2 = fadeMp3Tail(tiny.bytes)
    if (kept2.some((v, i) => v !== tiny.bytes[i])) ng('短すぎるものを書き換えている')
    else ok('フレームが足りないものには何もしない')

    if (fadeMp3Tail(new Uint8Array(0)).length !== 0) ng('空を渡すと落ちる')
    else ok('空を渡しても落ちない')
  }
}

console.log(bad === 0 ? '\n✅ 音声のまとめの検証は、すべて意図どおりです' : `\n❌ ${bad} 件`)
process.exit(bad === 0 ? 0 : 1)
