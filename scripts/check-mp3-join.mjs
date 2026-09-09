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
 *   ⑨ **本文を1本にまとめる**(つなぎ目そのものを無くす・2026-09)
 */
import { readFileSync } from 'node:fs'
import {
  alignEndOf, charTimesOf, clockScaleOf, indexAtTime, rangeOf, repeatSeek,
  scaleSpans, seekSentence, sentenceSpansOf, spansOf, wholeMark,
} from '../src/lib/wholeAudio.js'
import {
  audioFileName, countFrames, dropId3v1, firstFrame, joinMp3,
  silenceFor, skipId3, vbrTagFrame, vbrTagOf,
} from '../src/lib/mp3Join.js'
import {
  markIndexAt, marksFromTimes, sentenceShares, sentenceTimesOf, sharesToTimes,
  splitSentences, wordMarks,
} from '../src/lib/wordTiming.js'
import { SPEAK_MAX, speakChunks } from '../src/lib/speakChunks.js'

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

// ── ⑥b 落とすときも、**鳴らすときと同じ「かけら」**で集める ──────────
/* 【なぜ要るか】(2026-09 実機)
 *
 *   読み上げは長い段落を `speakChunks()` で**かけらに分けてから**窓口へ
 *   渡すので、MP3 の置き場所は**かけらの英文の指紋**で決まる。ところが
 *   ダウンロードは**段落まるごとの英文**で探していた。その指紋の MP3 は
 *   どこにも無いので、貼った原稿(Speech練習)では
 *
 *     音声が ◯ 本足りません
 *
 *   としか出ず、**1本も落とせなかった。** 作り直し(`remakeClips.js`)で
 *   踏んだのと**まったく同じ根**である。
 *
 *   `npm run lint` も `npm run build` も通る。**ふつうの教材では起きない**
 *   (AI が書く段落は 300 文字ほどで、分けても1つのまま)ので、
 *   長い原稿を貼った人にしか見えない。 */
{
  const { materialAudioClips, materialClipPieces, PIECE_GAP_MS } =
    await import('../src/lib/audioPlaylist.js')

  const art = (items) => ({
    sections: [{ exercise_type: 'article', items }],
    voiceIds: ['us-1'],
    tags: [],
  })
  // 窓口の上限を超える段落。**貼った原稿だけがこうなる**
  const longText = Array.from({ length: 90 },
    (unused, i) => `Sentence number ${i + 1} of this pasted script.`).join(' ')
  if (longText.length <= SPEAK_MAX) throw new Error('検証の英文が短すぎる')

  const one = materialClipPieces(art([{ prompt_en: longText }]))
  const want = speakChunks(longText).map((p) => p.text.trim()).filter(Boolean)
  if (one.length < 2) ng('長い段落を分けていない', `${one.length} 本`)
  else if (one.map((c) => c.text).join(' ') !== want.join(' ')) {
    ng('鳴らすときと違う英文で集めている(`speakChunks` を通っていない)')
  } else ok(`長い段落は、鳴らすときと同じ ${one.length} 本のかけらで集める`)

  // 1語も落ちない(つなげば元の英文に戻る)
  if (one.map((c) => c.text).join(' ').replace(/\s+/g, ' ')
      !== longText.replace(/\s+/g, ' ')) {
    ng('かけらをつないでも、元の英文に戻らない')
  } else ok('分けても1語も落ちない')

  // **段落の間は、最後のかけらのうしろにだけ。** 途中は 90ms
  const two = materialClipPieces(art([
    { prompt_en: longText }, { prompt_en: 'And that is the whole story.' },
  ]))
  const mid = two.slice(0, one.length)
  if (mid.slice(0, -1).some((c) => c.gapMs !== PIECE_GAP_MS)) {
    ng('かけらのあいだに、段落の間を入れている', mid.map((c) => c.gapMs).join(','))
  } else if (!(mid.at(-1).gapMs > PIECE_GAP_MS)) {
    ng('段落の切れ目に、段落の間が入っていない', String(mid.at(-1).gapMs))
  } else if (two.at(-1).gapMs !== 0) {
    ng('いちばん最後のあとにも間を入れている')
  } else ok(`かけらのあいだは ${PIECE_GAP_MS}ms、段落の切れ目だけ長い`)

  /* **ふつうの教材では、これまでと1本も変わらない。**
     ここが変わると、すでにある音声が全部作り直し(= 再課金)になる */
  const normal = art(Array.from({ length: 6 },
    (unused, i) => ({ prompt_en: `This is paragraph ${i + 1}. It is short.` })))
  const before = JSON.stringify(materialAudioClips(normal))
  const after = JSON.stringify(materialClipPieces(normal))
  if (before !== after) ng('ふつうの段落まで分けている(すでにある音声が無駄になる)')
  else ok('ふつうの段落は、1文字も変わらない')

  if (materialClipPieces(null).length || materialClipPieces({}).length) {
    ng('教材が無いのに何かを返している')
  } else ok('教材が無ければ 0 本')

  /* 【呼んでいるか】**定義だけあって誰も呼ばなければ、何も直らない。**
     しかも**音は鳴る**ので、押してみても気づけない。
     **コメントを落としてから、使っている形で見る** ——
     説明の中にも同じ名前が出てくるので、名前だけを探すと
     呼び出しを外しても緑のままになる(この回、2度踏んだ落とし穴) */
  const bare = (p) => readFileSync(new URL(p, import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')

  const dl = bare('../src/lib/downloadAudio.js')
  if (!/=\s*materialClipPieces\(material\)/.test(dl)) {
    ng('ダウンロードが、かけらではなく段落まるごとで集めている')
  } else ok('ダウンロードは `materialClipPieces(material)` で集めている')

  /* 画面が数える本数も、同じものでなければならない ——
     違うと**「3 / 14」と出ているのに 22 本目まで進む** */
  const tm = bare('../src/components/TrainerMaterials.jsx')
  if (/materialAudioClips\(m\)/.test(tm)) {
    ng('画面が、段落まるごとの本数を出している(進み具合が実際と食い違う)')
  } else if ((tm.match(/materialClipPieces\(m\)\.length/g) ?? []).length < 2) {
    ng('画面が `materialClipPieces` で数えていない')
  } else ok('画面も、同じかけらの数で出している(ボタンの出し分けと進み具合)')
}

/* ── 通しで鳴らすものは、演習ごとに違う欄から取る(2026-09 利用者の指定)──
 *
 *   > 文型トレーニングに上のバーのプレーヤーが出ません。
 *   > どんなトレーニングでも出るようにして下さい。
 *
 *   以前は `audio_text || prompt_en` と決め打ちしていた。本文(記事・会話)は
 *   それで正しかったが、**本文以外では1本も拾えない。**
 *   和文英訳は `answer`、リスニングは `audio_text`、内容の理解は `question`
 *   から読む。**どれも `audioFrom` 1か所が決めている。**
 *
 *   逆に**誤り訂正と穴埋めは、絶対に拾ってはいけない**(`audioFrom: null`)。
 *   誤った英文を手本として聞かせることになる(CLAUDE.md)。
 *   ここが緩むと、**音は鳴るので誰も気づけない。** */
{
  const { audioItemsOf, audioTextOf } = await import('../src/lib/audioPlaylist.js')
  console.log('\n── どの演習でも、読む欄を間違えない ──')

  const it = {
    prompt_en: 'She has finished.', prompt_ja: '彼女は終えた。',
    answer: 'She has already finished.', audio_text: 'Listen carefully.',
    question: 'What did she finish?', note: 'メモ',
  }
  const cases = [
    ['記事', 'article', 'She has finished.'],
    ['会話', 'dialogue', 'She has finished.'],
    ['英文和訳', 'translate_en_ja', 'She has finished.'],
    // **和文英訳は解答を読む。** 問題文は日本語なので、読み上げようがない
    ['和文英訳', 'translate_ja_en', 'She has already finished.'],
    ['リスニング', 'listening', 'Listen carefully.'],
    ['内容の理解', 'comprehension', 'What did she finish?'],
    ['ディスカッション', 'discussion', 'What did she finish?'],
    ['想定される質問', 'audience_qa', 'What did she finish?'],
    ['単語', 'vocabulary', 'She has finished.'],
    ['フレーズ', 'phrase', 'She has finished.'],
    // **音声を付けない演習**。誤った英文を手本にできない
    ['誤り訂正', 'error_correction', ''],
    ['穴埋め', 'fill_blank', ''],
    // 知らない種類でも落ちない(**空を返す**)
    ['知らない種類', 'no_such_type', ''],
    ['種類を渡していない', undefined, ''],
  ]
  for (const [what, typeId, want] of cases) {
    const got = audioTextOf(it, typeId)
    if (got !== want) ng(`${what} … 読む欄がちがう`, `「${got}」≠「${want}」`)
    else ok(`${what} … ${want ? `「${want}」を読む` : '読み上げない'}`)
  }

  // 数え上げも同じ絞り方。**空の項目は数えない**
  const drill = [
    { prompt_en: 'One.' }, { prompt_en: '  ' }, { prompt_en: 'Two.' }, {},
  ]
  const n = audioItemsOf(drill, 'translate_en_ja').length
  if (n !== 2) ng('文型ドリルの数え上げがちがう', `${n} ≠ 2`)
  else ok('文型ドリル … 中身のある2問だけを数える')

  if (audioItemsOf(drill, 'error_correction').length !== 0) {
    ng('誤り訂正を数えている(誤った英文を読み上げてしまう)')
  } else ok('誤り訂正 … 1問も数えない(操作盤そのものが出ない)')

  if (audioItemsOf(null, 'article').length || audioItemsOf(undefined).length) {
    ng('項目が無いのに何か返している')
  } else ok('項目が無ければ 0 件')
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


// ── ⑨ 本文を1本にまとめる(2026-09 利用者の指定)────────────────
//
//   > 会話は…ElevenLabs の Text to Dialogue API を使い、
//   > 会話全体を1本の音声として生成する。
//   > 可能なら with-timestamps を使用し、各発話の開始・終了時刻を保存する。
//
//   **つなぎ目が無くなるので、「プチッ」も無くなる。**
//   ここで見るのは「時刻から、何番目が何秒から何秒かを正しく出せるか」。
//   **ずれた区切りは、無いより悪い**(別の発言の場所を指す)。
{
  const src = readFileSync(new URL('../src/lib/wholeAudio.js', import.meta.url), 'utf8')

  /** 英文から、それらしい `alignment` を作る(1文字 0.1 秒) */
  const fakeAlign = (texts, join = ' ') => {
    const whole = texts.join(join)
    const characters = [...whole]
    const character_start_times_seconds = characters.map((_, i) => i * 0.1)
    const character_end_times_seconds = characters.map((_, i) => (i + 1) * 0.1)
    return { characters, character_start_times_seconds, character_end_times_seconds }
  }

  const texts = ['Hello there.', 'How are you?', 'Fine, thanks.']

  // 区切れるか(空白でつないだとき)
  {
    const spans = spansOf(fakeAlign(texts), texts)
    if (!spans || spans.length !== 3) {
      ng('3つに区切れていない', String(spans && spans.length))
    } else if (Math.abs(spans[0].start - 0) > 1e-9) {
      ng('1つめの始まりがずれている', String(spans[0].start))
    } else if (Math.abs(spans[0].end - 1.2) > 1e-9) {
      ng('1つめの終わりがずれている', `${spans[0].end} ≠ 1.2`)
    } else if (!(spans[1].start > spans[0].end && spans[2].start > spans[1].end)) {
      ng('区切りが前後している')
    } else ok(`3つに区切れる(1つめ ${spans[0].start}〜${spans[0].end} 秒)`)
  }

  // **空白の入り方が変わっても揺るがない**(向こうが改行を足すことがある)
  {
    const a = spansOf(fakeAlign(texts, ' '), texts)
    const b = spansOf(fakeAlign(texts, '\n\n'), texts)
    if (!a || !b) ng('空白を変えると区切れなくなる')
    else if (a.length !== b.length) ng('空白で区切りの数が変わる')
    else ok('空白(改行)が足されても、区切りの数は変わらない')
  }

  // **数が合わなければ、何も返さない**(当てずっぽうで区切らない)
  {
    const short = spansOf(fakeAlign(['Hello there.']), texts)
    if (short) ng('足りないのに区切っている', '別の発言の場所を指してしまう')
    else ok('文字が足りなければ、区切らない')

    /* **うしろに余りがあるのは、断る理由にならない**(2026-09)。
       求めているのは**文ごとの区切り**であって、1文字ずつの照合ではない。
       こちらの英文が頭から順に当てはまっているなら、
       そのぶんの区切りは正しい —— **うしろに何が続いていようと関係ない。**
       別の中身かどうかは、下の「当てはまった割合」が見ている */
    const extra = spansOf(fakeAlign([...texts, 'And a lot more text here.']), texts)
    const base = spansOf(fakeAlign(texts), texts)
    if (!extra || extra.length !== 3) {
      ng('うしろに余りがあるだけで、区切りを捨てている')
    } else if (extra.some((sp, i) => Math.abs(sp.start - base[i].start) > 1e-9)) {
      ng('うしろの余りで、区切りがずれている')
    } else ok('うしろに余りがあっても、区切りはずれない')

    // **中身がまるで違えば、当てずっぽうで区切らない**
    const other = spansOf(fakeAlign(['Completely different words over here.']), texts)
    if (other) ng('別の中身の時刻で区切っている', 'ずれた区間は、無いより悪い')
    else ok('別の中身なら、区切らない')

    if (spansOf(null, texts)) ng('時刻が無いのに区切っている')
    else if (spansOf(fakeAlign(texts), [])) ng('英文が無いのに区切っている')
    else ok('材料が欠けていれば、区切らない')
  }

  // いま何番目か / その区間
  {
    const spans = spansOf(fakeAlign(texts), texts)
    const at = (t) => indexAtTime(spans, t)
    if (at(0) !== 0 || at(0.5) !== 0) ng('始めが1つめになっていない')
    else if (at(spans[1].start + 0.01) !== 1) ng('2つめに入っていない')
    else if (at(spans[2].end + 5) !== 2) ng('終わったあとが最後になっていない')
    else if (at((spans[0].end + spans[1].start) / 2) !== 0
      && at((spans[0].end + spans[1].start) / 2) !== 1) ng('間(ま)の上で番号が壊れる')
    else ok('秒から「いま何番目か」が出せる')

    const r = rangeOf(spans, 1)
    if (!r || r.start !== spans[1].start || r.end !== spans[1].end) ng('区間を取り出せない')
    else if (rangeOf(spans, 9)) ng('無い番号でも区間を返している')
    else ok('「その発言だけ」の区間を取り出せる')
  }

  /* ── **1文ずつ、飛ばす / 戻す**(2026-09 利用者の指定)──────────────
   *
   *   > 「全体を聞く」「段落ごと」りょうほうの横に◁▷をおいて、
   *   > 1文ずつ飛ばしたり戻したりできる仕様です
   *
   * **`spansOf()` をそのまま使う**ので、数え方は1つのままである。
   * ここが壊れると**押しても動かない / 別の場所へ飛ぶ**が、
   * `npm run lint` にも `npm run build` にも引っかからない。 */
  {
    // 3項目・全部で5文(1つめが2文、2つめが2文、3つめが1文)
    const groups = [
      ['One two three.', 'Four five.'],
      ['Six seven.', 'Eight nine ten.'],
      ['Eleven twelve.'],
    ]
    const flat = groups.flat()
    const sent = sentenceSpansOf(fakeAlign(flat), groups)
    if (!sent) ng('文で区切れない')
    else if (sent.length !== 5) ng(`文の数が合わない(${sent.length} ≠ 5)`)
    else if (sent.map((x) => x.item).join(',') !== '0,0,1,1,2') {
      ng('どの項目の文かがずれている', sent.map((x) => x.item).join(','))
    } else if (!(sent[1].start > sent[0].start && sent[4].start > sent[3].start)) {
      ng('文の区間が前後している')
    } else ok(`文ごとに区切れる(全 ${sent.length} 文 / 3 項目)`)

    // **数が合わなければ、何も返さない**(項目のときと同じ守り)
    if (sentenceSpansOf(fakeAlign(['One two three.']), groups)) {
      ng('文字が足りないのに文で区切っている')
    } else if (sentenceSpansOf(null, groups)) {
      ng('時刻が無いのに文で区切っている')
    } else if (sentenceSpansOf(fakeAlign(flat), [])) {
      ng('英文が無いのに文で区切っている')
    } else ok('文でも、合わなければ区切らない')
  }

  // 飛ぶ先の決め方
  {
    /* **1文を長めにする。** この検証の時刻は「1文字 = 0.1 秒」なので、
       短い文だと1文まるごとが 1.2 秒に満たず、
       「その文の頭へ戻す」の枝を一度も通れない */
    const groups = [
      ['Alpha bravo charlie delta.', 'Echo foxtrot golf hotel.'],
      ['India juliett kilo lima.', 'Mike november oscar papa.'],
    ]
    const sent = sentenceSpansOf(fakeAlign(groups.flat()), groups)
    const s0 = sent[0].start
    const s1 = sent[1].start
    const s2 = sent[2].start

    if (seekSentence(sent, s0, 1) !== s1) ng('次の文へ進めない')
    else if (seekSentence(sent, s1, -1) !== s0) ng('前の文へ戻れない')
    else ok('◁▷ で1文ずつ動く')

    /* **文の途中まで来ていたら、その文の頭へ戻す。**
       聞き逃したのは、たいていいま鳴っている文である */
    if (seekSentence(sent, s1 + 1.5, -1) !== s1) ng('途中から、その文の頭に戻らない')
    else if (seekSentence(sent, s1 + 0.3, -1) !== s0) ng('入った直後なのに、もう1つ前へ行かない')
    else ok('入って間もなければ1つ前、途中ならその文の頭へ')

    // **端では動かさない**(`null` を返す → 画面は何もしない)
    if (seekSentence(sent, s0, -1) !== null) ng('先頭より前へ行こうとしている')
    else if (seekSentence(sent, sent[3].start, 1) !== null) ng('最後より先へ行こうとしている')
    else ok('端では動かない')

    /* **段落ごとに押したときは、その段落の中だけ。**
       押した段落から出ていってしまうと、押した意味がなくなる */
    const bound = { start: s2, end: sent[3].end }
    if (seekSentence(sent, s2, -1, bound) !== null) ng('段落の外へ戻れてしまう(境目を見ていない)')
    else if (seekSentence(sent, s2, 1, bound) !== sent[3].start) ng('段落の中で進めない')
    else if (seekSentence(sent, sent[3].start, 1, bound) !== null) {
      ng('段落の終わりを越えて進んでいる')
    } else ok('段落ごとに押したときは、その段落の中だけで動く')

    if (seekSentence(null, 0, 1) !== null || seekSentence([], 0, 1) !== null) {
      ng('区間が無いのに動かそうとしている')
    } else ok('区間が無ければ、何も返さない')

    /* ══════════════════════════════════════════════════════════
     * **くり返しは3つの単位から選ぶ**(2026-09 利用者の指定)
     *
     *   > 反復ボタンを作って欲しいです。
     *   > 文章単位、段落単位、全文単位、三つ選べるような。
     *
     * 間違えても `npm run lint` にも `npm run build` にも引っかからず、
     * **押して聴いてみるまで分からない。** だから区間を選ぶ算段だけを
     * `wholeAudio.js` に出して、ここで数字として確かめる。
     * ══════════════════════════════════════════════════════════ */
    const items = spansOf(fakeAlign(groups.map((g) => g.join(' '))),
      groups.map((g) => g.join(' ')))
    const o = { spans: items, sentences: sent }

    // ① しない … いつまでも戻らない
    if (repeatSeek('off', sent[1].end, o) !== null) ng('「しない」なのに戻している')
    else ok('「しない」では、どこまで来ても戻らない')

    // ② 文 … その文の終わりまで来たら、その文の頭へ
    if (repeatSeek('sentence', sent[1].start + 0.5, o) !== null) {
      ng('文の途中なのに戻している')
    } else if (repeatSeek('sentence', sent[1].end, o) !== sent[1].start) {
      ng('文の終わりで、その文の頭に戻らない')
    } else ok('文をくり返す(その文の頭へ)')

    // ③ 段落 … その段落の終わりまで来たら、その段落の頭へ
    if (repeatSeek('item', sent[1].end, o) !== items[0].start) {
      ng('段落の終わりで、その段落の頭に戻らない')
    } else if (repeatSeek('item', sent[0].end, o) !== null) {
      ng('段落の途中(1文目の終わり)で戻している')
    } else ok('段落をくり返す(その段落の頭へ)')

    // ④ 全文 … いちばん最後まで来たら、本文の頭へ
    if (repeatSeek('all', items[0].end, o) !== null) {
      ng('1段落目の終わりで、全文を戻している')
    } else if (repeatSeek('all', items[items.length - 1].end, o) !== items[0].start) {
      ng('本文の終わりで、頭に戻らない')
    } else ok('全文をくり返す(本文の頭へ)')

    /* **文の区間が出せないときは、段落で回す。**
       1本にできなかった教材では文の区間が無い。
       **何も起きないより、近い単位で回すほうがよい**(行き止まりを作らない) */
    if (repeatSeek('sentence', items[0].end, { spans: items }) !== items[0].start) {
      ng('文の区間が無いときに、段落で回していない')
    } else ok('文の区間が無ければ、段落で回す')

    // **知らない単位は「しない」に落とす**(渡し間違いで鳴り続けない)
    if (repeatSeek('paragraph', sent[1].end, o) !== null) {
      ng('知らない単位で回してしまう')
    } else if (repeatSeek('all', 0, { spans: null }) !== null) {
      ng('区間が無いのに回そうとしている')
    } else ok('知らない単位・区間が無いときは、回さない')
  }

  // 置き場所の材料。**声か英文が変われば、別の音声になる**
  {
    const m1 = wholeMark(['us-1', 'uk-2'], texts)
    const m2 = wholeMark(['us-1', 'uk-3'], texts)
    const m3 = wholeMark(['us-1', 'uk-2'], [...texts.slice(0, 2), 'Fine, thanks!'])
    if (m1 === m2 || m1 === m3) ng('声や英文を変えても同じ置き場所になる', '前の音声が返り続ける')
    else if (wholeMark(['us-1', 'uk-2'], texts) !== m1) ng('同じ材料で違う置き場所になる')
    else ok('置き場所は、声と英文の両方から決まる')
  }

  /* **切り替えは廃止された**(2026-09 利用者の指定)。
     「1本にまとめる」に統一したので、選ばせる道が残っていてはいけない。
     **戻ってきたら赤くする** —— 聴き比べのために置いていたものである */
  {
    const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
    /* **書き出しているかどうかで見る。** 経緯を残したコメントに
       名前が出てくるので、ただの部分一致では消したのに赤くなる */
    if (/export\s+(function|const)\s+(wholeOn|setWholeOn|WHOLE_KEY)/.test(src)) {
      ng('1本 / 発言ごと の切り替えが残っている', '仕様は1本に統一した')
    } else if (/wholeOn|setWholeOn/.test(app)) {
      ng('メニューに切り替えが残っている')
    } else ok('切り替えは廃止。いつでも1本で作る')
  }

  /* **段落ごとの Listen も、1本の中の区間を鳴らす**(利用者の指定)。
     ここが切れると**別の MP3 を作って二度課金する**が、
     **音は鳴る**ので画面には何も出ない。だから道を1本ずつ見る */
  {
    const play = readFileSync(new URL('../src/lib/audioPlaylist.js', import.meta.url), 'utf8')
    const read = readFileSync(new URL('../src/lib/readAloud.js', import.meta.url), 'utf8')
    const btn = readFileSync(new URL('../src/components/SpeakButton.jsx', import.meta.url), 'utf8')
    const want = [
      ['区間を出す道具がある', play, /export function wholeSliceOf\(/],
      ['本文でなければ null を返す', play, /if \(!isPassageSection\(section\?\.exercise_type\)\) return null/],
      /* **演習の種類ごと渡す**(2026-09)。どの欄を読むかは `audioFrom` が
         決めるので、種類を渡さないと**本文以外で1本も拾えない** */
      ['番号は audioItemsOf で数える',
        play, /const list = audioItemsOf\(section\.items, section\.exercise_type\)/],
      ['通しの一覧も同じ絞り方',
        play, /const items = audioItemsOf\(body\.items, body\.exercise_type\)/],
      ['読む欄は audioFrom 1か所が決める', play, /exerciseType\(typeId\)\?\.audioFrom/],
      ['読み上げが区間を受け取る', read, /whole = null,/],
      ['読み上げが区間を鳴らす', read, /rangeOf\(got\.spans, whole\.index\)/],
      ['終わりで止める', read, /stopAt: span\.end/],
      ['ボタンが素通しで渡す', btn, /onStart: heard, whole,/],
    ]
    let bad0 = bad
    for (const [what, text, re] of want) if (!re.test(text)) ng(`区間で鳴らす: ${what}`)
    if (bad === bad0) ok('段落ごとの Listen は、1本の中の区間を鳴らす')
  }

  /* **渡す側が1つでも抜けると、そこだけ別の MP3 を作る。**
     `npm run lint` にも `npm run build` にも引っかからず、
     **音は鳴る**ので気づけない。だから画面を名指しで数える */
  {
    const screens = [
      ['レッスン表示', 'LessonView'],
      ['教材の中身', 'MaterialBody'],
      ['6Steps(③⑤ の段落再生)', 'PassagePractice'],
    ]
    let bad0 = bad
    for (const [what, file] of screens) {
      const s = readFileSync(new URL(`../src/components/${file}.jsx`, import.meta.url), 'utf8')
      if (!/wholeSliceOf\(/.test(s)) ng(`${what}(${file})が区間を渡していない`)
    }
    if (bad === bad0) ok(`本文を鳴らす ${screens.length} つの画面が、すべて区間を渡している`)

    /* **集中モードは、紙とまったく同じ道具で鳴らす**(2026-09 利用者の指定)。
     *
     *   > 集中モードでも普通の画面と全く同じように文章送りができ、
     *   > 再生中の文章がハイライトされ、反復も同じようにできるのUIに
     *
     * こちらは `wholeSliceOf`(その段落だけ)ではなく、
     * **紙と同じ `useBodyAudio`**(= 通しの読み上げ)を使う。
     * どちらも 1本にまとめた音声を鳴らすので、**課金は増えない。**
     * 別々に書くと、必ず片方だけ古くなる(CLAUDE.md)。 */
    {
      const fr = readFileSync(new URL('../src/components/FocusReader.jsx', import.meta.url), 'utf8')
      const lv = readFileSync(new URL('../src/components/LessonView.jsx', import.meta.url), 'utf8')
      if (!/useBodyAudio\(\{/.test(fr)) ng('集中モードが、紙と同じ道具で鳴らしていない')
      else if (!/useBodyAudio\(\{/.test(lv)) ng('紙(レッスン表示)が、共通の道具を使っていない')
      else if (/wholeSliceOf\(/.test(fr)) ng('集中モードに、段落だけを鳴らす道が残っている')
      else ok('集中モードと紙は、同じ道具で鳴らしている')
    }
  }

  /* **◁▷ が、本当につながっているか**(2026-09 利用者の指定)。
     定義だけあって誰も呼ばなければ、何も起きない
     (`noteFnRev` を定義だけして呼んでいなかったのと同じ落とし穴) */
  {
    const read = readFileSync(new URL('../src/lib/readAloud.js', import.meta.url), 'utf8')
    const clips = readFileSync(new URL('../src/lib/audioClips.js', import.meta.url), 'utf8')
    const skip = readFileSync(new URL('../src/components/SentenceSkip.jsx', import.meta.url), 'utf8')
    const want = [
      ['区間を控える', read, /const sent = sentenceSpansFor\(got, whole\.texts\)/],
      ['通しでも控える', read, /let sent = sentenceSpansFor\(got, list\.map/],
      ['止めたら捨てる', read, /stopReading\(\) \{\s+setCursor\(null\)/],
      ['動かす道がある', read, /export function skipSentence\(/],
      ['鳴らしたまま場所だけ移す', clips, /export function seekClip\(/],
      ['いまの秒を返す', clips, /export function clipTime\(/],
      ['部品が呼んでいる', skip, /skipSentence\(d\)/],
      ['部品が見張っている', skip, /watchSentenceSkip\(setBySentence\)/],
      /* **いま読んでいる文を光らせる**(2026-09 実機・利用者の指摘)。
         1本にまとめて鳴らすようにしたとき `onWord` を渡し忘れ、
         **文のハイライトが消えていた。** 音は鳴るので気づけない */
      ['文の位置を持ち帰る', read, /charIndex: parts\[sp\.item\]/],
      ['段落ごとに光らせる', read, /tellSentence\(sent, sec, \(\) => whole\.index/],
      ['通しでも光らせる', read, /tellSentence\(sent, sec, \(\) => shown/],
    ]
    let bad0 = bad
    for (const [what, text, re] of want) if (!re.test(text)) ng(`1文ずつ: ${what}`)
    /* **出す場所は4つ。** 「全体を聞く」の横(操作盤・レッスン表示・6Steps)と、
       段落ごとの Listen の横。1つ抜けても lint / build は通る */
    /* **置き場所は操作盤の1つだけ**(2026-09 利用者の指定)。
         > 各段落のプレーヤー、いらないですね。
         > 上部バーのプレーヤーの段落の数字の左右に◁▷を配置して、
         > 一つのプレーヤーで段落と文章どちらも飛ばせるように

       記事は6段落あるので、段落ごとに置くと**同じものが6組**並ぶ。
       **戻ってきたら赤くする** */
    const bar = readFileSync(new URL('../src/components/PlayerBar.jsx', import.meta.url), 'utf8')
    if ((bar.match(/<SentenceSkip[\s>]/g) ?? []).length !== 2) {
      ng('操作盤の錠剤が2つ(文 / 段落)になっていない')
    }
    if (!/onStep=\{\(d\) => onJump\?\.\(now \+ d\)\}/.test(bar)) {
      ng('段落の数の両脇が、段落を送っていない')
    }
    for (const [what, file] of [
      ['6Steps(③⑤)', 'PassagePractice'],
    ]) {
      const t = readFileSync(new URL(`../src/components/${file}.jsx`, import.meta.url), 'utf8')
      if (/<SentenceSkip[\s>]/.test(t)) ng(`${what}(${file})に、段落ごとの三角が残っている`)
    }

    /* **集中モードの下の帯は、操作盤とまったく同じ形にする**
         (2026-09 実機・利用者の指定)

         > これと同じにすれば収まりますよね?色は黒くしたいですが

       もとは「文の三角は1組だけ。段落は両端の『前 / 次』が受け持つ」と
       していた。ところが両端のボタンが場所を食って**狭い画面で入らず**、
       利用者の判断で**紙の右下のプレーヤーに一本化した。**
       だから錠剤は `PlayerBar` と同じ**2つ**(文 / 段落)である。
       **「前 / 次」は無い** —— 戻すと、また入らなくなる */
    {
      const fr = readFileSync(new URL('../src/components/FocusReader.jsx', import.meta.url), 'utf8')
      const n = (fr.match(/<SentenceSkip[\s>]/g) ?? []).length
      if (n !== 2) ng(`集中モードの錠剤が ${n} 組ある(文 / 段落 の2組であってほしい)`)
      /* **1枚ずつ動く**(2026-09 利用者の指定で、長い段落を割るようになった)。
         割れている段落では、まず段落の中を進む。
         `go(index + d)` に戻すと、**割った段落の 2 枚目以降へ行けなくなる** */
      else if (!/onStep=\{step\}/.test(fr)) {
        ng('集中モードで、段落の数の両脇が1枚ずつ送っていない')
      } else if (!/const step = \(d\) => \{[\s\S]{0,400}go\(index \+ d, d < 0 \? 'tail' : 'head'\)/.test(fr)) {
        ng('集中モードで、段落をまたぐときに端の1枚へ着けていない')
      } else if (/focus-move--tight/.test(fr)) {
        ng('集中モードに、両端の「前 / 次」が戻っている',
          'プレーヤーに一本化したはずである(狭い画面で入らなくなる)')
      } else if (!/readingAt=\{inPiece \? readingAt - \(piece\?\.at \?\? 0\) : null\}/.test(fr)) {
        ng('集中モードで、いま読んでいる文が光らない',
          'かけらの頭(`at`)を引かないと、段落の先頭に戻って光る')
      } else ok('集中モードの下の帯は、操作盤と同じ2組 + ハイライト(1枚ずつ送る)')
    }

    /* ══════════════════════════════════════════════════════════
     * **くり返しの道が、1本も切れていないか**(2026-09 利用者の指定)
     *
     *   > 反復ボタンを作って欲しいです。
     *   > 文章単位、段落単位、全文単位、三つ選べるような。
     *
     * 押しても**何も起きない**形で切れると、`npm run lint` にも
     * `npm run build` にも引っかからない。**押して待ってみるまで
     * 分からない**ので、ここで道そのものを数える。
     * ══════════════════════════════════════════════════════════ */
    {
      const hook = readFileSync(new URL('../src/lib/useBodyAudio.js', import.meta.url), 'utf8')
      const ru = readFileSync(new URL('../src/components/RepeatUnit.jsx', import.meta.url), 'utf8')
      const bar2 = readFileSync(new URL('../src/components/PlayerBar.jsx', import.meta.url), 'utf8')
      const fr = readFileSync(new URL('../src/components/FocusReader.jsx', import.meta.url), 'utf8')
      const lv2 = readFileSync(new URL('../src/components/LessonView.jsx', import.meta.url), 'utf8')
      const want3 = [
        ['単位は4つ(しない + 3つ)', ru, /REPEAT_UNITS/],
        ['押すたびに次へ移る', ru, /export const nextRepeat/],
        ['部品が単位を渡す', ru, /onChange\?\.\(nextRepeat\(value\)\)/],
        ['操作盤が出す', bar2, /<RepeatUnit value=\{repeat \?\? 'off'\}/],
        ['集中モードも出す', fr, /<RepeatUnit value=\{player\.repeat\}/],
        ['紙が渡す', lv2, /repeat=\{player\.repeat\} onRepeat=\{player\.setRepeat\}/],
        /* **値ではなく、訊きに行く形で渡す。** 値で渡すと、
           鳴らしている最中に切り替えても押し直すまで効かない */
        ['訊きに行く形で渡す', hook, /repeatOf: \(\) => repeatRef\.current/],
        ['読み上げが受け取る', read, /repeatOf = null,/],
        ['1本のときは戻して回す', read, /spans: only \?\? spans, sentences: sent,/],
        ['戻せたら、そのひと刻みは何もしない', read, /if \(back !== null && seekClip\(back\)\) return/],
        ['発言ごとのときも回す', read, /if \(\(unit === 'sentence' \|\| unit === 'item'\) && ok\) \{/],
        /* ── **かけらを「段落」としてくり返す**(2026-09 利用者の指定)──
             > 集中モード内ではそれらを段落として扱い、繰り返し再生できる
             > ようにしてください。…段落は元々の段落を参照してしまい、
             > 次のページに進んでしまいます

           **道が1本でも切れると、段落まるごとが回って画面が進む。**
           しかも**音は鳴る**ので、聴いていても気づけない */
        ['集中モードが範囲を渡す', fr, /partRangeOf: \(i\) =>/],
        ['持ちものが受け取って渡す', hook, /partRangeOf = null,/],
        ['持ちものが読み上げへ渡す', hook, /^\s+partRangeOf,$/m],
        ['読み上げが受け取る', read, /partRangeOf = null,/],
        ['狭める算段は1か所', read, /const span = spanForRange\(sents, r, base\)/],
        ['1本のときも狭める', read, /const only = shownPiece >= 0/],
        ['発言ごとのときも狭める', read, /const only = partSpan\(part\.index, sentSecs, part\.at\)/],
        ['鳴らし直すのは、かけらの頭から', read, /replayAt = unit === 'item' \? backTo : 0/],
        ['全文は頭から回す', read, /if \(repeatNow\(\) !== 'all' \|\| !heard\) break/],
        /* **戻したら、なだらかな上げ下げの起点も戻す。**
           戻さないと「鳴っているのに音が出ない」になる(音量 0 のまま) */
        ['戻したら起点も戻す', clips, /fadeOrigin\?\.\(t\)/],
        ['起点を書き換える窓口がある', clips, /fadeOrigin = moveOrigin/],
      ]
      let bad1 = bad
      for (const [what, text, re] of want3) if (!re.test(text)) ng(`くり返し: ${what}`)
      if (bad === bad1) ok('くり返しは、画面から音まで道が1本もつながっている')
    }

    /* **段落ごとの Listen は、どの端末でも出さない**(2026-09 利用者の指定)。

         > 段落ごとの listen も全てのデバイスで廃止にしましょう

       もとは**操作盤との入れ替え**だった(浮いていれば隠し、上の帯に
       しまってあれば出す)。ところが記事は6段落・会話は14発言あるので、
       同じものが6組も14組も並ぶ。操作盤の「◀ 3 / 6 段落 ▶」で
       同じことができるので、**押すところを1か所に絞った。** */
    const lv = readFileSync(new URL('../src/components/LessonView.jsx', import.meta.url), 'utf8')
    const want2 = [
      /* **書き込み中は必ず右下**(2026-09 利用者の指定)。
         帯は道具にまるごと入れ替わるので、`pen` を外すと操作盤が消える */
      /* **置き場所は3つになった**(2026-09 利用者の指定)。
         上の帯 / **画面の下の黒帯** / 浮かせる。
         「紙の外に出ているか」は `outside` 1か所で決める */
      ['どこへ出すかは playerPlace.js が決める',
        /const spot = placeFor\(place, fitsInBar, padUp\)/],
      ['紙の外に出ているかを1か所で決める',
        /const outside = spot !== 'bar' && \(fitsInBar \|\| floatOpen \|\| pen\)/],
      /* **「本文かどうか」で出し分けない**(2026-09 利用者の指定
           「文型トレーニングに上のバーのプレーヤーが出ません。
             どんなトレーニングでも出るようにして下さい」)。
         鳴らせるものが1つでもあれば出す(`canPlayAll`) */
      ['浮いた操作盤も同じ式で出す', /canPlayAll && outside && shownSpot === 'float' && \(/],
      ['画面の下の黒帯も同じ式で出す', /canPlayAll && outside && shownSpot === 'dock' && !run && \(/],
      ['出すかどうかは「鳴らせるものがあるか」で決める',
        /const canPlayAll = playableAll\.length > 0/],
      ['上の帯の操作盤も同じ判断', /\{canPlayAll && shownSpot === 'bar' && fitsInBar && \(/],
      ['狭い画面のスイッチも同じ判断', /\{canPlayAll && !fitsInBar && \(/],
      /* **読む英文も `audioFrom` から取る。** `prompt_en` を直に見ると、
         和文英訳・リスニング・内容の理解が1本も鳴らない */
      ['通しの英文も audioFrom から取る', /text: audioTextOf\(it, section\?\.exercise_type\)/],
      ['本文には段落ごとのボタンを出さない', /\{secIsPassage \? null/],
      /* **スマホでは、はじめから右下に出す**(2026-09 利用者の指定)。
           > 各段落にプレーヤーがある始めの画面は少しうるさいです

         `false` に戻すと、開いた瞬間に段落の数だけプレーヤーが並ぶ。
         記事は6段落あるので、そこがいちばん騒がしくなる */
      ['スマホでは、はじめから開いている', /const \[floatOpen, setFloatOpen\] = useState\(true\)/],
      /* **つまんで動かせる**(2026-09 利用者の指定)。動かすのは
         箱ぜんぶ(`.sheet-floats`)—— 操作盤だけを動かすと、
         「別々に `fixed` で置かない」を破ることになる */
      /* **つまんで動かせるのはパッド以上だけ**(2026-09 利用者の判断
         「移動式のプレーヤーは、PCやパッドでは残しましょう。
           スマホでは狭すぎて意味がありません」)。
         スマホでは浮いた操作盤だけで画面幅のほとんどを使う */
      ['パッド以上かを1か所で決める', /const padUp = useWide\(NAV_PUSH_AT\)/],
      ['浮かせた箱は、つまんで動かせる',
        /useDragBox\(floatsRef, \{ enabled: shownSpot === 'float' && padUp \}\)/],
      /* **黒帯は、紙の外に描く**(2026-09 実機・利用者の指摘
         「再生のマークが黒字に黒なので見えない」)。
         紙(`.lesson-sheet`)は明るい配色の島なので、中に置くと
         `.lesson-sheet .listenpill .btn { color: var(--ink) }` が勝ち、
         **黒地に黒**になる(実測 rgb(36,41,47) on rgb(51,51,45)) */
      ['黒帯は紙のうしろに置く', /<\/div>\s*\n\s*\{\/\* ── 画面の下の黒帯/],
      ['つまみを操作盤へ渡す', /onGrab=\{drag\.onGrab\} moved=\{drag\.moved\} onResetPos=\{drag\.reset\}/],
      /* **置き場所の切り替えも1組で持つ**(2026-09 実機・利用者の指摘
         「フロートさせると下に変な隙間ができる、しかも戻せない」)。
         出す場所は3つあるので、行き先と押したときを書き写すと
         必ずどこかだけ古くなる。**`placeNext` が `null` のときは
         ボタンごと出ない** —— スマホには浮かせる道が無い */
      ['行き先と押したときを1組で持つ',
        /const placeNext = PLACE_TO\[nextPlace\(spot, fitsInBar, padUp\)\] \?\? null/],
      ['3つとも同じ切り替えを使う',
        /placeNext=\{placeNext\}[\s\S]*placeNext=\{placeNext\}[\s\S]*placeNext=\{placeNext\}/],
    ]
    for (const [what, re] of want2) if (!re.test(lv)) ng(`入れ替え: ${what}`)

    /* ── **「用意しています…」を、操作盤には出さない**(2026-09 利用者の指定)
           > どのデバイスでも段落送りをした時に再生ツールに
           > 「用意しています」が表示されて幅が広くなると、
           > 連続で押すときに押しにくいです。
           > 全てスマホと同じ、幅が変わらない仕様にして下さい

         押すボタンが 123px → 149px(スマホでは 30px → 141px)伸び縮みし、
         **まん中寄せなので両隣も一緒に動く**(実測)。段落を続けて送ると、
         押すたびに ◀ ▶ が左右へ逃げる。

         **`PlayerBar` に文言の欄そのものを持たせない。**
         そうすると「渡し忘れ」も「片方だけ残る」も起こりえない ——
         戻したくなったら、まず prop を足すことになる。

         **段落ごとの Listen には、これまでどおり出す**(言われた場所だけを
         直す)。あちらは押しっぱなしにするボタンではないので、
         `preparingLabel` を使っている行が消えていないことも一緒に見る。 */
    const pb = readFileSync(
      new URL('../src/components/PlayerBar.jsx', import.meta.url), 'utf8')
    /* **受け取る欄の並びだけ**を見る(`aria-label` や、
       中で使っている `label={…}` に当てない) */
    const props = pb.slice(pb.indexOf('PlayerBar({'), pb.indexOf('}) {'))
    if (/(^|[,{\s])label\s*[=,]/.test(props))
      ng('操作盤が文言の欄を持っている', '幅が伸び縮みして、押し間違えのもとになる')
    else ok('操作盤は「用意しています…」を持たない(幅が変わらない)')
    if (/label=\{playerLabel\}/.test(lv))
      ng('操作盤に「用意しています…」を渡している')
    /* **本文以外(内容の理解・語句・単語・フレーズ)の Listen は残す。**
       あちらは「段落」ではなく、1問ずつ聴き比べるためのものである
       (言われた場所だけを直す) */
    if (!/<SpeakButton\n\s+text=\{it\[secType\.audioFrom\]\}/.test(lv))
      ng('本文以外の Listen まで消えている', '言われたのは段落ごとだけである')
    else ok('本文以外(語句・単語・フレーズ)の Listen は残っている')
    /* **段落ごとの錠剤は、道具ごと消えている。**
       残っていれば「1か所に絞った」が守られていない
       (`withSkip` / `SentenceSkip` は `PlayerBar` の中だけで使う) */
    if (/withSkip/.test(lv)) ng('レッスン表示に、段落の錠剤を作る道具が残っている')
    else if (/from '\.\/SentenceSkip\.jsx'/.test(lv))
      ng('レッスン表示が、まだ ◀ ▶ の錠剤を読み込んでいる')
    else ok('段落ごとの Listen は、道具ごと消えている')
    if (bad === bad0) ok('◀ ▶ は、操作盤の1か所だけに出る')
  }

  // 窓口が、**実際に**新しい API を呼んでいるか
  {
    const fn = readFileSync(new URL('../supabase/functions/speak/index.ts', import.meta.url), 'utf8')
    const want = [
      ['会話は Text to Dialogue', /v1\/text-to-dialogue\/with-timestamps/],
      ['記事は with-timestamps', /v1\/text-to-speech\/\$\{unique\[0\]\}\/with-timestamps/],
      ['1本の入り口がある', /if \(body\.whole\) \{/],
      ['時刻をそのまま控える', /alignment: made\.alignment/],
      ['終わりをなだらかに下げる', /fadeMp3Tail\(made\.audio\)/],
    ]
    let bad0 = bad
    for (const [what, re] of want) if (!re.test(fn)) ng(`窓口: ${what}`)
    if (bad === bad0) ok('窓口は、1本にまとめる道を持っている')
  }

  // 画面が、**呼んでいる**か(定義だけあって誰も呼ばなければ同じこと)
  {
    const read = readFileSync(new URL('../src/lib/readAloud.js', import.meta.url), 'utf8')
    const clips = readFileSync(new URL('../src/lib/audioClips.js', import.meta.url), 'utf8')
    if (!/await wholeClip\(\{/.test(read)) ng('読み上げが wholeClip を呼んでいない')
    else if (!/runWhole\(\)\.then\(/.test(read)) ng('1本を試してから今までの形に落ちていない')
    else if (!/export async function wholeClip\(/.test(clips)) ng('wholeClip が無い')
    else if (!/whole: \{ mark, texts: body, elevenIds \}/.test(clips)) ng('窓口へ材料を渡していない')
    else if (!/stopAt > 0 &&/.test(clips)) ng('区間の終わりで止められない')
    else ok('画面は1本を試し、駄目なら今までの形に落ちる')
  }

  /* **発行したら、裏で支度しておく**(2026-09 利用者の指定)。
   *
   *   > 初めて再生するときの待ち時間が３０秒近くあり、これは、教材が
   *   > 完成した際にバックグランドで準備する仕様にできないでしょうか？
   *   > 単語の意味についても同様の仕様にできないでしょうか？
   *
   * **定義だけあって誰も呼ばなければ、何も起きない**(`noteFnRev` と
   * 同じ落とし穴)。だから**呼んでいる形**で見る。 */
  {
    const prep = readFileSync(new URL('../src/lib/prepareJob.js', import.meta.url), 'utf8')
    const form = readFileSync(new URL('../src/components/MaterialForm.jsx', import.meta.url), 'utf8')
    const finder = readFileSync(new URL('../src/components/TrainerMaterials.jsx', import.meta.url), 'utf8')
    const want = [
      ['音声を先に作る', prep, /await wholeClip\(\{/],
      ['語の意味も先に引く', prep, /await prefetchGlosses\(/],
      ['同じ教材は二度やらない', prep, /if \(!id \|\| done\.has\(id\)\) return false/],
      ['走っているあいだは始めない', prep, /if \(prepareRunning\(\)\) \{/],
      ['失敗してもやり直さない', prep, /state: 'done', audio, error:/],
      ['発行したら支度する', form, /startPrepare\(\s*\{ id: data\.id/],
      ['「セッションで使う」でも支度する', finder, /startPrepare\(m, \{ title: m\.title/],
      ['走っていたら順番待ちにする', prep, /queue\.push\(\{ material, title, level, id \}\)/],
      ['終わったら次を始める', prep, /runNext\(\)/],
      ['何ができたかを持ち帰る', prep, /audio = got \? 'ok' : 'ng'/],
      ['できなかった理由を出す', prep, /lastWholeDetail\(\)/],
      ['過去の教材もまとめて積める', prep, /export function startPrepareAll\(/],
      ['一覧を開いたら積む', finder, /startPrepareAll\(materials\)/],
      ['やめたら順番待ちも空にする', prep, /queue\.length = 0/],
      ['やめたあとに次を始めない', prep, /if \(task\?\.id === mine && !task\.cancelled\) runNext\(\)/],
      ['あと何本かを出す', prep, /export const prepareQueued = /],
      ['自動にするかを切り替えられる', prep, /export function setPrepareAllOn\(/],
    ]
    let before = bad
    for (const [what, src2, re] of want) if (!re.test(src2)) ng(`支度: ${what}`)
    if (bad === before) ok('発行・「セッションで使う」・一覧で、裏で支度している')

    /* **既定は自動。** ただし**費用が出ていく**ので、切れる道を必ず残す
       (「見えない費用は管理できない」・CLAUDE.md) */
    if (!/return v === null \? true : v === '1'/.test(prep)) {
      ng('支度: 既定が自動になっていない')
    } else if (!/if \(queue\.length >= 50\) break/.test(prep)) {
      ng('支度: 順番待ちに上限が無い')
    } else ok('支度は既定で自動。1本ずつ・上限つき・いつでも止められる')
  }

  /* **鳴り始める前に「鳴った」と言わない**(2026-09 実機・こちらの入れ違い)。
   *
   *   > バックグラウンドでの再生準備が全然できていません。
   *
   * 1本目を作っている 30 秒のあいだに `started()` を呼んでいたので、
   * ボタンの「用意しています…」が**すぐ消えて Stop になり**、
   * そのあと 30 秒黙っていた。押した人には無反応にしか見えない。
   * 2026-09 に直した「Listen の1度目が反応しない」の作り直しである。 */
  {
    const read = readFileSync(new URL('../src/lib/readAloud.js', import.meta.url), 'utf8')
    const from = read.indexOf('const runWhole = async')
    const to = read.indexOf('await playClip({', from)
    const head = from >= 0 && to > from ? read.slice(from, to) : ''
    if (!head) ng('1本で鳴らすところが見つからない')
    else if (/^\s*started\(\)\s*$/m.test(head)) {
      ng('音が出る前に「鳴った」と知らせている', '「用意しています…」が消えてしまう')
    } else if (!/onStart: started/.test(read)) {
      ng('鳴り始めたときの知らせが無い')
    } else ok('「鳴った」と言うのは、本当に音が出た瞬間だけ')
  }
}

/**
 * ============================================================================
 * ⑩ **1本にまとめられない教材でも、文の単位が使える**(2026-09 実機)
 *
 *   > 文を飛ばす機能、リピート機能などが一部機能しません。
 *   > これは、スピーチで自前で長い文を生成したものだけで、
 *   > 他の教材では機能しています。
 *
 *   1本にまとめられるのは **2,800 文字まで**(ElevenLabs の上限)。
 *   貼った原稿はそれを超えるので段落ごとの MP3 に落ちる。
 *   そこには時刻(`alignment`)が無いので、**◀ ▶ もくり返しも
 *   文の単位が丸ごと死んでいた。**
 *
 *   いまは語の重みから**割合**で見積もる(`sentenceShares`)。
 *   **語の色ももともと同じ重みで動いている**ので、
 *   色と送り先が食い違うことがない —— そこまで数字で確かめる。
 * ============================================================================
 */
{
  console.log('\n▶ 1本にできない教材の、文の単位')

  const TEXT = 'Good afternoon, everyone. First, I would like to thank everyone '
    + 'for being here today. Before I talk about my research, I would like to '
    + 'introduce my background. I am originally from Chiba in Japan.'
  const DUR = 20
  const shares = sentenceShares(TEXT)
  const secs = sharesToTimes(shares, DUR)
  const cuts = splitSentences(TEXT)

  if (shares.length !== cuts.length) {
    ng(`文の数が合わない(区間 ${shares.length} / 文 ${cuts.length})`)
  } else ok(`文の数だけ区間が出る(${shares.length} 文)`)

  /* **控えるのは割合。** 長さは読み込んだあとにしか分からないので、
     秒で控えると段落の切れ目で ◀ ▶ が一瞬押せなくなる */
  if (shares[0].start !== 0 || shares[shares.length - 1].end !== 1) {
    ng('割合が 0〜1 に収まっていない', '最後は必ず終わりまで(丸めの余りを残さない)')
  } else ok('区間は 0〜1 の割合。最後は必ず終わりまで')

  if (!secs || secs[secs.length - 1].end !== DUR) {
    ng('秒に直せていない')
  } else ok(`長さを掛ければ秒になる(${DUR} 秒ぶん)`)
  if (sharesToTimes(shares, 0) !== null) ng('長さが分からないのに秒を返している')
  else ok('長さが分からなければ、何も返さない')

  /* **いちばん大事なところ。** 飛んだ先で光る文が、飛ぼうとした文と同じか。
     語の色は `wordMarks`、送り先は `sentenceShares` —— **同じ重み**から
     出しているので必ず一致する。ここがずれると、
     「押したのに別の文が光る」という、いちばん気持ちの悪い形になる */
  {
    const marks = wordMarks(TEXT, DUR * 1000)
    let bad2 = 0
    secs.forEach((s, k) => {
      const at = marks[markIndexAt(marks, (s.start + 0.01) * 1000)].at
      if (!(at >= cuts[k].start && at < cuts[k].end)) bad2 += 1
    })
    if (bad2) ng(`飛んだ先と光る文が食い違う(${bad2} / ${secs.length} 文)`)
    else ok('飛んだ先で光るのは、その文である(色と同じ重みから出している)')
  }

  /* 送り戻しの作法は、1本にまとめたときとまったく同じ(`seekSentence`)。
     **文の途中まで来ていたらその文の頭へ、頭すぐなら1つ前へ** */
  {
    const back = seekSentence(secs, secs[1].start + 2, -1)
    const backHead = seekSentence(secs, secs[1].start + 0.1, -1)
    if (back !== secs[1].start) ng('文の途中から戻ると、その文の頭に来ない')
    else if (backHead !== secs[0].start) ng('文の頭すぐから戻ると、1つ前に来ない')
    else if (seekSentence(secs, 0, 1) !== secs[1].start) ng('次の文へ進めない')
    else if (seekSentence(secs, 0, -1) !== null) ng('先頭より前へ戻ろうとしている')
    else if (seekSentence(secs, DUR - 0.01, 1) !== null) ng('最後より先へ進もうとしている')
    else ok('送り戻しの作法は、1本にまとめたときと同じ')
  }

  /* くり返しは**文だけ**をここで受け持つ。段落・全文は周回のほうが
     受け持つので、`repeatSeek` に文の区間だけ渡しても動いてはいけない */
  {
    const end = secs[1].end - 0.01
    if (repeatSeek('sentence', end, { sentences: secs }) !== secs[1].start) {
      ng('文の終わりで、その文の頭へ戻らない')
    } else if (repeatSeek('item', end, { sentences: secs }) !== null
      || repeatSeek('all', end, { sentences: secs }) !== null
      || repeatSeek('off', end, { sentences: secs }) !== null) {
      ng('文いがいの単位まで、ここで折り返している')
    } else ok('文でだけ折り返す(段落・全文は周回が受け持つ)')
  }

  /* **語が1つも無いときは、当てずっぽうで区切らない** */
  if (sentenceShares('...').length || sentenceShares('').length) {
    ng('語が無いのに区間を作っている')
  } else ok('語が無ければ、区間を作らない(段落で回るほうへ落ちる)')

  /* **画面がほんとうに使っているか。** 定義だけあって誰も呼ばなければ、
     いままでと何も変わらない(`noteFnRev` と同じ落とし穴・CLAUDE.md) */
  {
    const read = readFileSync(new URL('../src/lib/readAloud.js', import.meta.url), 'utf8')
    const want = [
      ['段落ごとに文の区間を見積もる', /const shares = sentenceShares\(part\.text\)/],
      ['段落ごとの Listen でも控える', /else holdCursor\(sentenceShares\(piece\.text\), null, true\)/],
      ['割合として控えている', /else holdCursor\(shares, null, true\)/],
      /* **控えるのは鳴り出したときだけ。** 端末の声に落ちたら途中から
         鳴らす手段が無いので、押せるように見せてはいけない */
      ['控えるのは、鳴り出したときだけ',
        /onStart: \(\) => \{\s*\n\s*if \(exact\) holdCursor\(exact\.sents, null\)\s*\n\s*else holdCursor\(sentenceShares\(piece\.text\)/],
      ['押された瞬間に秒へ直す', /sharesToTimes\(cursor\.spans, clipDuration\(\)\)/],
      /* 段落ごとの MP3 でも、文でくり返す。**`spans` は集中モードが
         かけらに狭めるためのもの**で、渡さなければ `null`(段落で回る) */
      ['文のくり返しを、周回の中でも見る', /spans: only, sentences: sentSecs,/],
    ]
    const before = bad
    for (const [what, re] of want) if (!re.test(read)) ng(`文の単位: ${what}`)
    if (bad === before) ok('1本にできないときも、画面から文の単位が使える')
  }

  /* **長さを渡す道が切れていないか。** `onTime` が秒だけを渡していた頃の
     形に戻すと、割合を秒に直せなくなる(**音は鳴るので気づけない**) */
  {
    const clips = readFileSync(new URL('../src/lib/audioClips.js', import.meta.url), 'utf8')
    if (!/onTime\?\.\(Number\(el\.currentTime\) \|\| 0, Number\(el\.duration\) \|\| 0\)/.test(clips)) {
      ng('鳴らす側が、長さを渡していない')
    } else if (!/export function clipDuration\(/.test(clips)) {
      ng('いま鳴っているものの長さを訊く道が無い')
    } else ok('鳴らす側が、いまの秒と長さの両方を渡している')
  }
}

/**
 * ============================================================================
 * ⑪ **直ったら、知らせを引っ込める**(2026-09 実機・利用者の指摘)
 *
 *   > そして、音声がちゃんと作られているのにいまだにこの表示が
 *   > 消えないです。
 *
 *   知らせは**出しっぱなし**だった。一度でも失敗すると、そのあと
 *   音声が作れるようになっても ✕ を押すまで居座る。
 *
 *   しかも**1本にまとめられなかっただけ**のときにまで
 *   「読み上げ音声を作れませんでした。端末の声で鳴らしています。」と
 *   出していた。**どちらも本当ではない** —— 段落ごとの音声は作られるし、
 *   端末の声にも落ちていない。1本にできないときは
 *   **黙って今までの形に落ちる**というのが、もともとの決まりである。
 * ============================================================================
 */
{
  console.log('\n▶ 音声の知らせは、直ったら引っ込む')

  const clips = readFileSync(new URL('../src/lib/audioClips.js', import.meta.url), 'utf8')
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')

  if (!/const clearDetail = \(\) => \{/.test(clips)) ng('知らせを引っ込める道が無い')
  else ok('知らせを引っ込める道がある')

  /* **作れたら引っ込める。** 窓口が URL を返した時点で、
     「作れませんでした」はもう本当ではない */
  if (!/if \(body\.url\) \{ lastReason = ''; clearDetail\(\);/.test(clips)) {
    ng('音声を作れても、知らせを引っ込めていない')
  } else ok('窓口が音声を返したら、知らせを引っ込める')
  if (!/wholeNote = null\n\s*clearDetail\(\)/.test(clips)) {
    ng('1本にまとめられても、知らせを引っ込めていない')
  } else ok('1本にまとめられたら、知らせを引っ込める')

  /* **「窓口が古い」だけは残す。** 古くても音は鳴るので、
     引っ込めると永久に気づけない(だから版を返させるようにした) */
  if (!/const staleNote = \(\) => \(clipFnStale\(\)/.test(clips)) {
    ng('「窓口が古い」を1か所で作っていない')
  } else if (!/const keep = staleNote\(\)/.test(clips)) {
    ng('引っ込めるときに「窓口が古い」まで消している')
  } else ok('「窓口が古い」だけは残る(音は鳴るので、言わないと気づけない)')

  /* **1本にできなかっただけで「端末の声」と言わない。**
     `FAILED` を添えてよいのは、本当に MP3 を作れなかったときだけ */
  {
    const from = clips.indexOf('export async function wholeClip')
    const to = clips.indexOf('export function prefetchClip', from)
    const body = from >= 0 && to > from ? clips.slice(from, to) : ''
    if (!body) ng('1本にまとめるところが見つからない')
    else if (/FAILED/.test(body)) {
      ng('1本にできないだけで「端末の声で鳴らしています」と出している',
        '段落ごとの音声は作られるので、どちらも本当ではない')
    } else if (/setDetail\(/.test(body)) {
      ng('1本にできないだけで、画面に知らせを出している',
        '黙って今までの形に落ちる、が決まりである(CLAUDE.md)')
    } else ok('1本にできないときは黙って落ちる(理由は支度の帯が出す)')
  }

  /* **画面が `null` を受け取って消しているか。**
     以前は `if (!detail) return` で捨てていたので、引っ込められなかった */
  if (/onClipTrouble\(\(detail\) => \{\s*\n\s*if \(!detail\) return/.test(app)) {
    ng('画面が「直った」の知らせを捨てている')
  } else if (!/setClipNote\(detail \? String\(detail\) : null\)/.test(app)) {
    ng('画面が `null` で知らせを消していない')
  } else ok('画面は「直った」を受け取って、知らせを消す')

  /* 支度の帯は、これまでどおり理由まで出す(**出す場所はそちら**) */
  {
    const prep = readFileSync(new URL('../src/lib/prepareJob.js', import.meta.url), 'utf8')
    if (!/t\.note \? ` — \$\{t\.note\}` : ''/.test(prep)) {
      ng('支度の帯が、用意できなかった理由を出していない')
    } else ok('用意できなかった理由は、支度の帯が出す')
  }
}

/**
 * ============================================================================
 * ⑫ **窓口が受け取れる長さを、絶対に超えない**(2026-09 実機・利用者の指摘)
 *
 *   > このspeech練習の教材、9段落目だけ最低な質の日本語英語の女性の
 *   > 音声になっているので直してください。
 *
 *   窓口(`speak`)は1回に 2,000 文字まで。超えると 400 で断られ、
 *   **その段落だけ端末の声**(iPhone では日本語の声が英語を読む)に落ちる。
 *   しかも**黙って**落ちるので、17 段落を聴き通すまで気づけない。
 *
 *   貼るときの上限(`speechDraft.js` の 900)では足りない ——
 *   あれは**貼った原稿にしか効かず**、AI が書いた段落も、
 *   **すでに作った教材**も素通りする。だから**窓口へ渡す直前**で切る。
 * ============================================================================
 */
{
  console.log('\n▶ 窓口へ渡す英文は、必ず受け取れる長さに収まる')

  const sen = (n) => `We collected maternal plasma and extracted cfDNA number ${n}.`
  const long = Array.from({ length: 60 }, (_, i) => sen(i)).join(' ')

  /* **収まっていれば1文字も動かさない。** ふつうの段落は今までどおり */
  const one = sen(1)
  const kept = speakChunks(one)
  if (kept.length !== 1 || kept[0].text !== one || kept[0].at !== 0) {
    ng('収まっている英文まで切っている')
  } else ok('収まっていれば、1文字も動かさない')

  {
    const cs = speakChunks(long)
    if (cs.length < 2) ng(`長すぎる英文を切っていない(${long.length} 文字)`)
    else if (!cs.every((c) => c.text.length <= SPEAK_MAX)) {
      ng('切ったあとも上限を超えている', cs.map((c) => c.text.length).join(' / '))
    } else if (!cs.every((c) => long.slice(c.at, c.at + c.text.length) === c.text)) {
      ng('位置(at)が本文と合っていない', '語の色が別の場所を指す')
    } else if (cs.map((c) => c.text).join(' ').replace(/\s+/g, ' ')
      !== long.replace(/\s+/g, ' ')) {
      ng('切ったときに文字が落ちている')
    } else {
      ok(`長すぎる英文は分ける(${long.length} 文字 → ${cs.map((c) => c.text.length).join(' / ')})`)
    }
  }

  /* **1文で超えるもの・切れ目が無いもの**でも、必ず収める */
  {
    const huge = `${'a'.repeat(1200)} ${'b'.repeat(1200)}.`
    const none = `${'x'.repeat(4000)}.`
    const okAll = [huge, none].every((t) =>
      speakChunks(t).every((c) => c.text.length <= SPEAK_MAX))
    if (!okAll) ng('1文で超えるもの・語の切れ目が無いものが収まっていない')
    else ok('1文で超えても、語の切れ目が無くても、必ず収まる')
  }

  /* 窓口の上限より**手前**で切っているか(少し変えても足りなくなることがない) */
  {
    const fn = readFileSync(
      new URL('../supabase/functions/speak/index.ts', import.meta.url), 'utf8')
    const m = /const MAX_CHARS = (\d+)/.exec(fn)
    const limit = m ? Number(m[1]) : 0
    if (!limit) ng('窓口の上限が読めない')
    else if (SPEAK_MAX >= limit) ng(`切る長さ(${SPEAK_MAX})が窓口の上限(${limit})以上`)
    else ok(`窓口の上限 ${limit} より手前(${SPEAK_MAX})で切っている`)
  }

  /* **画面が本当に使っているか。** 切る道があっても、渡す側が
     素の本文をそのまま渡していたら、いままでと何も変わらない */
  {
    const read = readFileSync(new URL('../src/lib/readAloud.js', import.meta.url), 'utf8')
    const want = [
      ['通しの読み上げで分けている', /for \(const c of speakChunks\(p\.text\)\)/],
      ['段落ごとの Listen でも分けている', /const pieces = speakChunks\(text\)/],
      ['番号は元の段落のまま知らせる', /onIndex\?\.\(part\.index\)/],
      ['語の色は段落の中の位置で送る', /charIndex: \(w\.charIndex \?\? 0\) \+ part\.at/],
      ['段落でくり返すと、段落の頭へ戻る', /i = pieceOf\[part\.index\] - 1/],
      ['端末の声に落ちたら、何段落目かを言う', /noteFellBack\(`\$\{part\.index \+ 1\} 段落目の`\)/],
    ]
    const before = bad
    for (const [what, re] of want) if (!re.test(read)) ng(`長い段落: ${what}`)
    if (bad === before) ok('画面が、窓口へ渡す前に必ず分けている')
  }

  /* **断られた理由を読めているか。**「non-2xx」は supabase-js の
     決まり文句であって、理由ではない(窓口は `detail` を返している) */
  {
    const clips = readFileSync(new URL('../src/lib/audioClips.js', import.meta.url), 'utf8')
    if (!/async function errBody\(error\)/.test(clips)) {
      ng('窓口が断った理由を読む道が無い')
    } else if (!/const body = data \?\? await errBody\(error\)/.test(clips)) {
      ng('断られたときに、理由を読んでいない', '「non-2xx」しか出ない')
    } else if (!/const noteFnRev = \(rev, absentIsOld = false\)/.test(clips)) {
      ng('版が付いてこないだけで「窓口が古い」と言い出す')
    } else if (!/noteFnRev\(rev, true\)/.test(clips)) {
      ng('ping のときに「版なし = 古い」と読めていない')
    } else ok('断られた理由をそのまま出す(「版なし」と取り違えない)')
  }
}

  /* ── **ハイライトのタイミング**(2026-09 利用者の指摘)────────────
   *
   *   > 再生中の文章のハイライトのタイミングをもっと正確にできないですか?
   *
   * 1本にまとめた音声は前から `/with-timestamps` で作っており、正確だった。
   * **段落ごとの MP3 だけが、ただでもらえる時刻を捨てていた。**
   * 道は「窓口 → Storage の `.json` → 画面 → `playClip`」の4つ。
   * **1本でも切れると、音は鳴るのに色だけがずれる**(気づけない形) */
  {
    const speak = readFileSync(
      new URL('../supabase/functions/speak/index.ts', import.meta.url), 'utf8')
    const clips = readFileSync(
      new URL('../src/lib/audioClips.js', import.meta.url), 'utf8')
    const read = readFileSync(
      new URL('../src/lib/readAloud.js', import.meta.url), 'utf8')

    const before = bad
    // ① 窓口が、段落ごとの1本でも時刻ごと受け取る
    const one = speak.slice(speak.indexOf('async function synthEleven('))
    const body = one.slice(0, one.indexOf('\n}\n'))
    if (!body.includes('/with-timestamps') || !body.includes('synthElevenTimed(')) {
      ng('段落ごとの1本が、時刻を捨てている', '課金は変わらないのに、もらわない')
    }
    // ② MP3 のとなりに `.json` で置く。**失敗しても音は落とさない**
    if (!/\$\{path\.replace\(\/\\\.mp3\$\/, '\.json'\)\}/.test(speak)) {
      ng('時刻を、MP3 のとなりに置いていない')
    }
    if (!/body: JSON\.stringify\(\{ rev: FN_REV, text, alignment \}\),[\s\S]{0,200}?\.catch\(\(\) => null\)/
      .test(speak)) {
      ng('時刻を置けなかったときに、音声まで落としている')
    }
    // ③ 画面が読む。**窓口は呼ばない = 0円**
    if (!/export async function clipAlignment/.test(clips)) {
      ng('画面に、時刻を読む道が無い')
    }
    if (!/normText\(got\.text\) === body/.test(clips)) {
      ng('別の英文の時刻で光りかねない', '同じ英文か確かめていない')
    }
    if (!/timesCache\.delete\(key\)/.test(clips)) {
      ng('作り直したのに、古い時刻を覚えたまま')
    }
    // ④ `playClip` が、あれば見積もらない
    if (!/const exact = alignment \? marksFromTimes\(body, charTimesOf\(alignment, body\)\) : \[\]/
      .test(clips)) {
      ng('時刻があっても、色は見積もりのまま')
    }
    if (!/const marks = exact\.length \? exact : wordMarks\(/.test(clips)) {
      ng('時刻が無いときに、見積もりへ戻れない', '行き止まりを作らない')
    }
    // ⑤ 呼ぶ側(通し・段落ごとの両方)
    if ((read.match(/exactTimesFor\(/g) ?? []).length < 3) {
      ng('時刻を読みに行っていない経路がある')
    }
    if ((read.match(/alignment: exact\?\.alignment \?\? null/g) ?? []).length !== 2) {
      ng('`playClip` へ時刻を渡していない経路がある')
    }
    if (bad === before) ok('ハイライトは、見積もりではなく本当の時刻で動く')
  }

  /* ── **向こうは「読むために文字を書き換える」**(2026-09 利用者の指摘)──
   *
   *   > 普段使っている教材の再生のハイライトが正確でないから頼んだのです。
   *   > 元々正確ではないです。スピーチもですが。
   *
   * **1本にまとめた側にも、同じ穴があった。** 当てはめが
   * 「空白を除けば1文字ずつ同じ」を前提に**数えるだけ**だったので、
   * `12%` や `2026` が `twelve percent` `twenty twenty-six` と
   * 読み替えられた時点で崩れ、**黙って見積もりに落ちていた。** */
  {
    const align = (read) => {
      const characters = [...read]
      const from = []
      const to = []
      let t = 0
      for (const ch of characters) {
        if (/\s/.test(ch)) { from.push(t); to.push(t); continue }
        from.push(t); t = Number((t + 0.1).toFixed(6)); to.push(t)
      }
      return {
        characters,
        character_start_times_seconds: from,
        character_end_times_seconds: to,
      }
    }
    const MINE = ['Sales grew 12% in 2026.', 'That is a big jump.']
    const READ = 'Sales grew twelve percent in twenty twenty-six.\n\nThat is a big jump.'
    const A = align(READ)
    const before = bad

    // ① 書き換えがあっても、項目の区切りが出せる
    const sp = spansOf(A, MINE)
    if (!sp || sp.length !== 2) {
      ng('書き換えがあると、区切りが出せない', '見積もりに落ちる')
    } else {
      // 2つめの本当の開始秒(向こうの文字を数えて出した答え)
      const at = READ.indexOf('That is a big jump.')
      const want = Number(
        ([...READ.slice(0, at)].filter((c) => !/\s/.test(c)).length * 0.1).toFixed(6),
      )
      if (Math.abs(sp[1].start - want) > 0.001) {
        ng(`2つめの発言の開始秒がずれている(${sp[1].start} / ${want})`)
      }
    }

    // ② 文の区切りも、同じ時刻から正しく出る
    const ONE = 'Sales grew 12% in 2026. That is a big jump.'
    const A2 = align('Sales grew twelve percent in twenty twenty-six. That is a big jump.')
    const st = sentenceTimesOf(ONE, charTimesOf(A2, ONE))
    if (!st || st.length !== 2) {
      ng('書き換えがあると、文の区切りが出せない')
    } else if (st[1].charIndex !== ONE.indexOf('That')) {
      ng('文の頭の位置が、画面の英文とずれている')
    }

    // ③ 語の印も残る(**書き換えられた語だけ飛ばす**)
    if (marksFromTimes(ONE, charTimesOf(A2, ONE)).length < 6) {
      ng('書き換えがあると、語の印が丸ごと消える')
    }

    // ④ **書き換えが無いときは、これまでと1つも変わらない**
    const plain = ['Hello there.', 'How are you?']
    const ps = spansOf(align(plain.join('\n\n')), plain)
    if (!ps || ps.length !== 2 || ps[0].start !== 0) {
      ng('ふつうの本文で、区切りが出せなくなっている')
    }

    // ⑤ **まったく別の英文なら、当てずっぽうで区切らない**
    if (spansOf(align('Completely unrelated words here.'), MINE)) {
      ng('別の英文の時刻で区切っている', 'ずれた区間は、無いより悪い')
    }
    /* **半分も当てはまらないなら、使わない。**
       頭だけ合っていて残りが別物、というときに効く */
    if (spansOf(align('Hello xxxxxxx.'), ['Hello there.'])) {
      ng('半分も当てはまらないのに区切っている')
    }
    if (bad === before) ok('読み替えられても、時刻を正しく当てはめる')
  }

/* ══════════════════════════════════════════════════════════════════
 * ⑩ **控えた時刻の時計を、鳴らしている音声に合わせる**(2026-09 実機)
 *
 *   > 14発言の会話で大体2-3発言分くらいハイライトが発言より
 *   > 先に進んでしまいます。
 *
 * 【なぜ「文字の当てはめ」ではないと言えるか】
 *   14発言の会話で、読み下し・余分な文字・短縮形の展開を通しても
 *   `spansOf()` の誤差は 0.00 秒だった(合わないときは `null` を返して
 *   発言ごとの音声に落ちる)。**当てはめでは、先へは進まない。**
 *
 * 【残るのは、時計そのもの】
 *   Text to Dialogue は発言と発言のあいだに**間(無音)**を入れて
 *   1本にする。その無音が控えの秒に入っていなければ、
 *   **継ぎ目を通るたびにハイライトがそのぶん先に出て、積み上がる。**
 *
 *   ここでは**その形をそのまま作って**、直す前と直したあとの
 *   「何発言ぶん先に出るか」を数える。
 * ══════════════════════════════════════════════════════════════════ */
{
  const before = bad

  // ── ㋐ 道具そのもの ─────────────────────────────────────────
  const mk = (ends) => ({
    characters: ends.map(() => 'a'),
    character_start_times_seconds: ends.map((e, i) => (i ? ends[i - 1] : 0)),
    character_end_times_seconds: ends,
  })
  if (alignEndOf(mk([0.1, 0.2, 1.5])) !== 1.5) ng('控えの終わりの秒が取れない')
  if (alignEndOf(null) !== null) ng('控えが無いのに秒を返している')

  if (clockScaleOf(10, 10.1) !== 1) {
    ng('**そろっているのに伸ばしている**', '2% 以内は1ミリ秒も動かさない')
  }
  if (clockScaleOf(41, 50) <= 1.2) ng('食い違っているのに伸ばしていない')
  if (clockScaleOf(10, 100) !== 1) ng('外れすぎているのに伸ばしている')
  if (clockScaleOf(0, 50) !== 1 || clockScaleOf(10, 0) !== 1) {
    ng('長さが分からないのに伸ばしている')
  }
  const same = [{ start: 1, end: 2, item: 0, charIndex: 5 }]
  if (scaleSpans(same, 1) !== same) ng('倍率 1 なのに、区間を作り直している')
  const bigger = scaleSpans(same, 2)
  if (bigger[0].start !== 2 || bigger[0].item !== 0 || bigger[0].charIndex !== 5) {
    ng('伸ばしたときに `item` / `charIndex` が落ちている')
  }

  // ── ㋑ 14発言の会話で、何発言ぶん先に出るか ────────────────────
  {
    const TURNS = [
      'Hey, thanks for making time today.',
      "Of course. What's on your mind?",
      'I wanted to walk you through the schedule.',
      "Sure. Let's start there.",
      "We'd begin on the twelfth.",
      'That is tight. Can we push it a week?',
      'We can, but it adds to the cost.',
      "Understood. What's the total then?",
      'Around four thousand dollars.',
      'Right. And that covers everything?',
      'Everything except travel.',
      'Okay. Let me take this to my manager.',
      "Of course. I'll send a summary.",
      'Perfect. Thanks again for your time.',
    ]
    const CPS = 0.055
    const GAP = 0.7                       // 継ぎ目の間(控えには入っていない)
    const chars = []
    const from = []
    const to = []
    let t = 0
    const alignStart = []
    TURNS.forEach((turn) => {
      alignStart.push(t)
      for (const c of turn) { chars.push(c); from.push(t); to.push(t + CPS); t += CPS }
    })
    const alignment = {
      characters: chars,
      character_start_times_seconds: from,
      character_end_times_seconds: to,
    }
    const alignEnd = t
    const duration = alignEnd + GAP * (TURNS.length - 1)
    // 本当の(音声の中の)発言の頭
    const trueStart = alignStart.map((a, i) => a + GAP * i)
    const trueAt = (sec) => {
      let n = 0
      for (let i = trueStart.length - 1; i >= 0; i -= 1) {
        if (sec >= trueStart[i]) { n = i; break }
      }
      return n
    }
    const spans = spansOf(alignment, TURNS)
    if (!spans || spans.length !== TURNS.length) {
      ng('14発言の区切りが出せない')
    } else {
      const worst = (sp) => {
        let w = 0
        for (let sec = 0; sec < duration; sec += 0.1) {
          const d = indexAtTime(sp, sec) - trueAt(sec)
          if (d > w) w = d
        }
        return w
      }
      const wasAhead = worst(spans)
      const nowAhead = worst(scaleSpans(spans, clockScaleOf(alignEnd, duration)))
      if (wasAhead < 2) {
        ng('この作りでは、そもそも先に進んでいない', `直す前 ${wasAhead} 発言ぶん`)
      }
      if (nowAhead > 1) {
        ng('時計を合わせても、まだ先に進む', `直す前 ${wasAhead} / いま ${nowAhead}`)
      } else {
        ok(`14発言 … 先に進む量 ${wasAhead} 発言ぶん → ${nowAhead} 発言ぶん`)
      }
    }
  }

  // ── ㋒ 画面が本当に呼んでいるか。**「名前が出てくるか」で見ない** ──
  {
    const src = readFileSync(new URL('../src/lib/readAloud.js', import.meta.url), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    if (!/clockScaleOf\(alignEndOf\(got\.alignment\), dur\)/.test(src)) {
      ng('1本の道が、時計を突き合わせていない')
    }
    if (!/spans = scaleSpans\(spans, k\)/.test(src) || !/sent = scaleSpans\(sent, k\)/.test(src)) {
      ng('区間を伸ばしていない(片方だけになっている)')
    }
    /* **番号は段落で知らせる**(かけらの番号をそのまま渡さない)。
       分けた段落があると、かけらの番号は先へ行くほど開く */
    if (!/const itemOf = \(i\) => list\[i\]\?\.index \?\? i/.test(src)) {
      ng('1本の道が、かけらの番号を段落の番号に直していない')
    }
    if (/nowPlaying\(resumeKey, i\)\s*\n\s*onIndex\?\.\(i\)/.test(src)) {
      ng('**かけらの番号をそのまま知らせている**', '分けた段落で必ず先に進む')
    }
    if (!/charIndex: \(w\.charIndex \?\? 0\) \+ \(p\.at \?\? 0\), index: p\.index/.test(src)) {
      ng('1本の道が、文の位置を段落の頭からに直していない')
    }
  }

  if (bad === before) ok('時計を音声に合わせ、番号は段落で知らせる')
}

console.log(bad === 0 ? '\n✅ 音声のまとめの検証は、すべて意図どおりです' : `\n❌ ${bad} 件`)
process.exit(bad === 0 ? 0 : 1)
