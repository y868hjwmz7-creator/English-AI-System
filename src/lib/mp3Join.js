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
 * 最初の**ちゃんとしたフレーム**の頭を読む。
 *
 * @returns {{at, len, version, sampleRate, samplesPerFrame, header}|null}
 */
export function firstFrame(bytes) {
  const start = skipId3(bytes)
  const end = dropId3v1(bytes)
  for (let i = start; i < end - 4; i += 1) {
    if (bytes[i] !== 0xff || (bytes[i + 1] & 0xe0) !== 0xe0) continue
    const b1 = bytes[i + 1]
    const b2 = bytes[i + 2]
    const verBits = (b1 >> 3) & 0x03      // 3=MPEG1 / 2=MPEG2 / 0=MPEG2.5
    const layer = (b1 >> 1) & 0x03        // 1 = Layer III
    if (verBits === 1 || layer !== 1) continue
    const brIndex = (b2 >> 4) & 0x0f
    const srIndex = (b2 >> 2) & 0x03
    if (brIndex === 0 || brIndex === 15 || srIndex === 3) continue
    const mpeg1 = verBits === 3
    const bitrate = BITRATES[mpeg1 ? 1 : 2][brIndex] * 1000
    const sampleRate = RATES[verBits][srIndex]
    if (!bitrate || !sampleRate) continue
    const pad = (b2 >> 1) & 0x01
    const samplesPerFrame = mpeg1 ? 1152 : 576
    const len = Math.floor((samplesPerFrame / 8) * bitrate / sampleRate) + pad
    if (len < 8) continue
    return {
      at: i,
      len,
      version: verBits,
      sampleRate,
      samplesPerFrame,
      header: [bytes[i], b1, b2, bytes[i + 3]],
    }
  }
  return null
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
  for (const part of parts ?? []) {
    const raw = part?.bytes
    if (!raw?.length) continue
    /* **札(ID3)は落とす。** 先頭のものも含めて全部落とす。
       中ほどに札が残ると、そこで詰まる再生機がある */
    const from = skipId3(raw)
    const to = dropId3v1(raw)
    if (to <= from) continue
    chunks.push(raw.subarray(from, to))
    const gap = Number(part.gapMs) || 0
    if (gap > 0) {
      const frame = firstFrame(raw)
      const silence = silenceFor(frame, gap)
      if (silence.length) chunks.push(silence)
    }
  }
  const total = chunks.reduce((n, c) => n + c.length, 0)
  const out = new Uint8Array(total)
  let at = 0
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
