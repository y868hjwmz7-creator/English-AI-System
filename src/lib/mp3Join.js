/**
 * ============================================================================
 * MP3 を**つなぐ**(2026-09 利用者の指定)。
 *
 *   > 各教材の音声をダウンロード出来るようにしてください。
 *   > 全体の音声をひとつ。これだけでOKです。
 *   > 教材と同じビットレートのMP3でOKです。
 *
 * 教材の音声は**1文(1発言)ごとに1本の MP3** である
 * (置き場所は `<版>/<段>/<声の id>/<英文の指紋>.mp3`)。
 * 「全体をひとつ」にするには、それをつなぐ。
 *
 * 【作り直さない】
 *   利用者の指定どおり、**中身は1ビットも作り直さない。**
 *   MP3 は「フレーム」という小さな塊が並んだだけの形なので、
 *   **並べれば、それがそのまま1本の MP3 になる。**
 *   だから音は劣化せず、ビットレートも元のままである。
 *
 * 【間(ま)も入れる】
 *   ただし**つなぐだけでは、発言と発言が地続きになる。**
 *   このアプリは会話の「間」を内容から決めている(`turnGap.js`)。
 *   v3 の音声は前後の無音がほとんど無いので、そのままつなぐと
 *   **息継ぎも無しに次の人が話し出す。**
 *
 *   そこで**無音のフレーム**を挟む。中身が全部 0 のフレームは無音になる。
 *   **頭(ヘッダ)は、その音声から読み取ったものをそのまま使う**ので、
 *   ビットレートも周波数も本編と1つも違わない。
 *
 * 【ここには何も持ち込まない】
 *   Supabase も `import.meta.env` も使わない。**素の node で走らせられる**
 *   ようにしてある(`playMark.js` と同じ考え方)。
 * ============================================================================
 */

/** MPEG1 / MPEG2・2.5 の Layer III のビットレート(kbps) */
const BITRATES = {
  1: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0],
  2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0],
}
/** 周波数。版ごとに違う */
const RATES = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] }

/** ID3v2 の札(先頭)を飛ばす。**中ほどに札が残ると、そこで詰まる** */
export function skipId3(bytes) {
  if (bytes.length >= 10
    && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
    // 大きさは「同期安全整数」(各バイトの下位7ビットだけを使う)
    const size = ((bytes[6] & 0x7f) << 21) | ((bytes[7] & 0x7f) << 14)
      | ((bytes[8] & 0x7f) << 7) | (bytes[9] & 0x7f)
    return 10 + size
  }
  return 0
}

/** ID3v1 の札(末尾の 128 バイト)を落とした長さ */
export function dropId3v1(bytes) {
  const n = bytes.length
  if (n >= 128 && bytes[n - 128] === 0x54 && bytes[n - 127] === 0x41
    && bytes[n - 126] === 0x47) return n - 128
  return n
}

/**
 * **その場所にフレームの頭があるか**を読む(探さない)。
 *
 * @returns {{at, len, version, sampleRate, samplesPerFrame, header}|null}
 */
function frameAt(bytes, i) {
  if (i + 4 > bytes.length) return null
  if (bytes[i] !== 0xff || (bytes[i + 1] & 0xe0) !== 0xe0) return null
  const b1 = bytes[i + 1]
  const b2 = bytes[i + 2]
  const verBits = (b1 >> 3) & 0x03      // 3=MPEG1 / 2=MPEG2 / 0=MPEG2.5
  const layer = (b1 >> 1) & 0x03        // 1 = Layer III
  if (verBits === 1 || layer !== 1) return null
  const brIndex = (b2 >> 4) & 0x0f
  const srIndex = (b2 >> 2) & 0x03
  if (brIndex === 0 || brIndex === 15 || srIndex === 3) return null
  const mpeg1 = verBits === 3
  const bitrate = BITRATES[mpeg1 ? 1 : 2][brIndex] * 1000
  const sampleRate = RATES[verBits][srIndex]
  if (!bitrate || !sampleRate) return null
  const pad = (b2 >> 1) & 0x01
  const samplesPerFrame = mpeg1 ? 1152 : 576
  const len = Math.floor((samplesPerFrame / 8) * bitrate / sampleRate) + pad
  if (len < 8) return null
  return {
    at: i,
    len,
    version: verBits,
    sampleRate,
    samplesPerFrame,
    header: [bytes[i], b1, b2, bytes[i + 3]],
  }
}

/**
 * 最初の**ちゃんとしたフレーム**の頭を読む。
 *
 * @returns {{at, len, version, sampleRate, samplesPerFrame, header}|null}
 */
export function firstFrame(bytes) {
  const start = skipId3(bytes)
  const end = dropId3v1(bytes)
  for (let i = start; i < end - 4; i += 1) {
    const f = frameAt(bytes, i)
    if (f) return f
  }
  return null
}

/**
 * 【この MP3 は何分何秒か】を書いた**札**が、そのフレームに入っているか。
 *
 * MP3 そのものには「長さ」がどこにも書かれていない。
 * だから多くの作り手は、**いちばん先頭に音の出ないフレームを1枚置き、
 * その中に「全部で何枚あるか」を書く。**
 * 再生機はそれを読んで、再生バーの長さを決める。
 *
 * 名前は3つある(中身の役目は同じ)。
 *
 *   `Xing` … 場所によってビットレートが変わるもの
 *   `Info` … ビットレートが最後まで同じもの
 *   `VBRI` … Fraunhofer 系の作り手が使う別の形
 *
 * @returns {'Xing'|'Info'|'VBRI'|null}
 */
export function vbrTagOf(bytes, frame) {
  if (!frame) return null
  const at4 = (i) => String.fromCharCode(bytes[i], bytes[i + 1], bytes[i + 2], bytes[i + 3])
  // VBRI は、頭から 32 バイトうしろと決まっている
  if (frame.at + 40 <= bytes.length && at4(frame.at + 36) === 'VBRI') return 'VBRI'
  const start = frame.at + 4 + sideInfoLen(frame)
  if (start + 4 > bytes.length) return null
  const tag = at4(start)
  return (tag === 'Xing' || tag === 'Info') ? tag : null
}

/** 頭のうしろに続く「副情報」の長さ。版と、モノラルかどうかで決まる */
function sideInfoLen(frame) {
  const mono = ((frame.header[3] >> 6) & 0x03) === 3
  return frame.version === 3 ? (mono ? 17 : 32) : (mono ? 9 : 17)
}

/**
 * そのバイト列が**フレームだけで隙間なく**並んでいるとき、その枚数。
 * 1枚でも読めなければ `null`(そのときは札を付けない)。
 */
export function countFrames(bytes) {
  let at = 0
  let n = 0
  while (at < bytes.length) {
    const f = frameAt(bytes, at)
    if (!f) return null
    at += f.len
    n += 1
  }
  return at === bytes.length ? n : null
}

/**
 * **長さを書いた札(先頭の1枚)を、こちらで作る。**
 *
 * つないだ音声の長さは「フレームの枚数 × 1枚ぶんの時間」で決まるので、
 * 枚数さえ正しく書けば、再生機は正しい長さを出せる。
 *
 * @param frame  形をまねる元(本編の最初のフレーム)
 * @param frames **本編の枚数。この札そのものは数に入れない**(慣例)
 * @param bytes  **この札も含めた全体のバイト数**(慣例)
 * @param cbr    最後まで同じビットレートなら true(`Info`)、違えば `Xing`
 */
export function vbrTagFrame(frame, frames, bytes, cbr = true) {
  if (!frame || !(frames > 0)) return new Uint8Array(0)
  const pad = (frame.header[2] >> 1) & 0x01
  const len = frame.len - pad
  const at = 4 + sideInfoLen(frame)
  // 入りきらないフレーム(極端に低いビットレート)には付けない
  if (len < at + 16) return new Uint8Array(0)
  const out = new Uint8Array(len)
  out[0] = frame.header[0]
  out[1] = frame.header[1] | 0x01       // CRC 無し
  out[2] = frame.header[2] & ~0x02      // 詰め物 無し
  out[3] = frame.header[3]
  const tag = cbr ? 'Info' : 'Xing'
  for (let i = 0; i < 4; i += 1) out[at + i] = tag.charCodeAt(i)
  out[at + 7] = 0x03                    // 枚数と大きさを書いた、という印
  const put = (o, v) => {
    out[o] = (v >>> 24) & 0xff
    out[o + 1] = (v >>> 16) & 0xff
    out[o + 2] = (v >>> 8) & 0xff
    out[o + 3] = v & 0xff
  }
  put(at + 8, frames)
  put(at + 12, bytes)
  // 残りは 0 のまま(= 音の出ないフレーム)
  return out
}

/**
 * その音声と**同じ形の無音**を、指定のミリ秒ぶん作る。
 *
 * **中身は全部 0 にする。** Layer III では、それが無音になる。
 * 頭だけ元の音声から写すので、ビットレートも周波数も食い違わない。
 *
 * **誤り検出(CRC)は付けない**(頭の下位ビットを 1 にする)。
 * 付ける形のままだと、0 で埋めた中身と食い違って弾く再生機がある。
 */
export function silenceFor(frame, ms) {
  if (!frame || ms <= 0) return new Uint8Array(0)
  const perFrame = (frame.samplesPerFrame / frame.sampleRate) * 1000
  const count = Math.round(ms / perFrame)
  if (count <= 0) return new Uint8Array(0)
  // 詰め物(padding)のぶんは作らない。**長さがぶれないほうが確かである**
  const pad = (frame.header[2] >> 1) & 0x01
  const len = frame.len - pad
  const out = new Uint8Array(len * count)
  for (let i = 0; i < count; i += 1) {
    const at = i * len
    out[at] = frame.header[0]
    out[at + 1] = frame.header[1] | 0x01        // CRC 無し
    out[at + 2] = frame.header[2] & ~0x02       // 詰め物 無し
    out[at + 3] = frame.header[3]
    // 残りは 0 のまま = 無音
  }
  return out
}

/**
 * MP3 を順につなぐ。あいだに `gapMs` ぶんの無音を挟む。
 *
 * @param {Array<{bytes: Uint8Array, gapMs?: number}>} parts
 * @returns {Uint8Array}
 */
export function joinMp3(parts) {
  const chunks = []
  let head = null        // 形をまねる元(いちばん最初のフレーム)
  let frames = 0         // 本編 + 無音の、フレームの枚数
  let counted = true     // 1つでも数え損ねたら、札を付けない
  let cbr = true         // 最後まで同じビットレートか
  for (const part of parts ?? []) {
    const raw = part?.bytes
    if (!raw?.length) continue
    /* **札(ID3)は落とす。** 先頭のものも含めて全部落とす。
       中ほどに札が残ると、そこで詰まる再生機がある */
    let from = skipId3(raw)
    const to = dropId3v1(raw)
    if (to <= from) continue
    const frame = firstFrame(raw)

    /* **長さを書いた札(Xing / Info / VBRI)も落とす**(2026-09 実機)。
     *
     *   > 実際は2分29秒の音声が、プレーヤーでは22秒として表示されます。
     *   > 22秒のところで再生バーは終了するのに音声だけは続く
     *
     *   **22秒は、1つめの発言の長さである。**
     *   その札には「この音声は◯枚ぶん」と書いてあり、再生機はそれを
     *   信じて再生バーの長さを決める。つないだあともそのまま先頭に
     *   残っていたので、**1本目の長さが全体の長さとして出ていた。**
     *   中ほどに残ったぶんは、そこで数え直す再生機を混乱させる。
     *   だから**全部落として、正しい枚数の札をこちらで1枚だけ付ける。** */
    if (frame && frame.at >= from && vbrTagOf(raw, frame)) {
      from = frame.at + frame.len
      if (to <= from) continue
    }

    const body = raw.subarray(from, to)
    chunks.push(body)
    if (!head) head = frame
    else if (frame && frame.len !== head.len) cbr = false

    const n = countFrames(body)
    if (n === null) counted = false
    else frames += n

    const gap = Number(part.gapMs) || 0
    if (gap > 0 && frame) {
      const silence = silenceFor(frame, gap)
      if (silence.length) {
        chunks.push(silence)
        // 無音は「詰め物なし」の同じ長さで作ってあるので、割り切れる
        frames += silence.length / (frame.len - ((frame.header[2] >> 1) & 0x01))
      }
    }
  }

  const body = chunks.reduce((n, c) => n + c.length, 0)
  if (!body) return new Uint8Array(0)

  /* **長さの札を、いちばん前に1枚だけ置く。**
     数え損ねたときは付けない —— **間違った長さを書くくらいなら、
     書かないほうがよい**(そのときは再生機が大きさから見積もる) */
  /* 2回作っているのは、**「全体のバイト数」に札そのものも入れる**
     決まりだからである(1回目は、その札が何バイトになるかを知るため) */
  const size = counted ? vbrTagFrame(head, frames, 0, cbr).length : 0
  const tag = size ? vbrTagFrame(head, frames, body + size, cbr) : new Uint8Array(0)

  const out = new Uint8Array(tag.length + body)
  let at = 0
  if (tag.length) { out.set(tag, 0); at = tag.length }
  for (const c of chunks) { out.set(c, at); at += c.length }
  return out
}

/**
 * ダウンロードするときの名前。
 * **記号を落とす。** そのままだと端末によっては保存できない。
 */
export function audioFileName(title) {
  const name = String(title ?? '')
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
  return `${name || '教材の音声'}.mp3`
}
