/**
 * こちらで作った読み上げ音声(MP3)を鳴らす。
 *
 * ============================================================================
 * 【なぜ必要になったか】(2026-08 実機の報告)
 *
 *   知り合いの iPhone で、開発中のリンクを **Google Chrome** で開いて
 *   もらったところ、こちらで聞こえている声とはまるで違う、
 *   ひどい声が出た。
 *
 *   これは不具合ではなく、**iOS の作りそのもの**である。
 *     ・iOS では、**すべてのブラウザの中身が Safari(WebKit)**。
 *       「Chrome を使えば回避できる」という手は存在しない
 *     ・iOS は高品質な声を Web Speech API に **一切公開しない**
 *       (実機で生 47 件を確認し、premium は 0 件)
 *
 *   つまり **端末の声に頼るかぎり、iPhone のゲストには良い音を届けられない。**
 *   唯一の解が、こちらで音声を作って配ることである。
 *
 * ============================================================================
 * 【どこから来るか】
 *
 *   置き場所は、英文と話者から**計算で決まる。**
 *
 *       tts/<版>/<段>/<話者>/<英文の SHA-256>.mp3
 *
 *   目録の表を持たない。**持つと必ずファイルと食い違う。**
 *   場所が計算で出るなら、取りに行って「鳴ったか、鳴らなかったか」で判る。
 *
 *     1. まずその場所を `<audio>` に渡す。**あれば、これだけで終わり。**
 *        Supabase の CDN から返り、2回目からは端末の控えから出る
 *     2. 無ければ窓口(`speak` 関数)に作らせ、返ってきた場所で鳴らす
 *     3. それも駄目なら false を返す。呼んだ側が端末の声に戻す
 *
 *   **1 で済むかぎり、窓口も Azure も呼ばれない。** 費用も通信も増えない。
 *
 * ============================================================================
 * 【止まる条件を持たせる】
 *
 *   外部の窓口を自動で呼ぶものには、必ず止まる条件を持たせる。
 *   Anthropic の残高が切れたとき、開くたびに呼びに行き、直らないことのために
 *   待たされ続けた(2026-08 実機)。同じ失敗をここで繰り返さない。
 *
 *   窓口が `fatal`(鍵が無い・設定していない)を返したら、
 *   **その画面のあいだは二度と取りに行かない。** 端末の声で読み上げる。
 *
 * ============================================================================
 * 【iPhone で鳴らすための作法】
 *
 *   iOS は「利用者が押した流れの中で始まった再生」しか許さない。
 *   ところが MP3 は取りに行くぶん待ちが入るので、押した流れが切れてしまう。
 *
 *   そこで **`<audio>` は最初に1つだけ作り、最初に画面へ触れた瞬間に
 *   無音を鳴らして解錠しておく。** 以後は待ちを挟んでも鳴らせる。
 *   録音の `AudioContext` で学んだ作法(1つだけ作り、作り直さない)と同じ。
 */
import { PREGENERATED_SPEAKERS } from '../data/speakers.js'
import { isSupabaseConfigured, supabase, supabaseUrl } from './supabase.js'
import { STANDARD } from './voiceTier.js'
import { markIndexAt, wordMarks } from './wordTiming.js'

/** 0016 で作るバケツ。窓口(supabase/functions/speak)と同じ名前にすること */
const BUCKET = 'tts'

/**
 * 音声の**版**。置き場所の頭に付く(`tts/<版>/<話者>/<指紋>.mp3`)。
 *
 * **`supabase/functions/speak/index.ts` の CLIP_REV と、必ず同じ値にすること。**
 * 画面と窓口の両方が同じ場所を計算する。片方だけ変えると、画面が見に行く
 * 場所と窓口が置く場所が食い違い、**毎回作り直して毎回課金される。**
 *
 * 声を変えたとき(会社を替えた・DragonHD にしたなど)に1つ進める。
 * 進めないと、前の声で作った MP3 がそのまま返り続ける。
 */
const CLIP_REV = '1'

/** 話者の指定が無いときの声。`PREGENERATED_SPEAKERS` の id である */
export const DEFAULT_CLIP_VOICE = 'us-female'

const VALID_VOICES = new Set(PREGENERATED_SPEAKERS.map((s) => s.id))

/** 使える話者に丸める。知らない id が来ても落とさない */
export const clipVoiceId = (id) =>
  (VALID_VOICES.has(id) ? id : DEFAULT_CLIP_VOICE)

// ── この画面のあいだ覚えておくこと ──────────────────────────
//
// **開くたびに同じ失敗を繰り返さない。** どれも画面を読み込み直せば消える。
let stopped = false          // 窓口が fatal を返した。もう取りに行かない
let lastDetail = null        // 係の人にだけ見せる原因(`src/lib/viewer.js` が判断)
const urlCache = new Map()   // 指紋 → 鳴らせる URL
const gaveUp = new Set()     // 窓口に頼んでも駄目だったもの

/** 係の人向けの、直近の原因。ゲストには出さない */
export const lastClipDetail = () => lastDetail

/**
 * そもそも取りに行けるか。
 * Supabase 未設定(手元での確認や1ファイル版)ではいつも false になり、
 * これまでどおり端末の声で読み上げる。
 */
export const canUseClips = () =>
  !stopped
  && isSupabaseConfigured
  && !!supabaseUrl
  && typeof window !== 'undefined'
  // 指紋は SHA-256 で取る。**http:// や file:// では使えない**(仕様上)
  && !!window.crypto?.subtle

/**
 * 英文の「指紋」。**窓口(`supabase/functions/speak`)と同じ規則にすること。**
 * ずれると同じ英文の音声を二度作ることになり、そのぶん課金される。
 *
 * 空白の連なりだけをそろえる。**小文字にはしない。**
 * 大文字か小文字かで読み方(強調・略語の読み)が変わるためである。
 */
const normText = (text) => String(text ?? '').replace(/\s+/g, ' ').trim()

async function fingerprint(voiceId, text) {
  const bytes = new TextEncoder().encode(`${voiceId}|${text}`)
  const hash = await window.crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * 置き場所。**段(`tier`)も鍵に入れる。**
 * 同じ英文でも、良い声と標準の声では別のファイルである。
 * 入れないと、先に作られたほうが両方に返ってしまう。
 */
const publicUrlOf = (tier, voiceId, hash) =>
  `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${CLIP_REV}/${tier}/${voiceId}/${hash}.mp3`

// ── 鳴らす道具は1つだけ ────────────────────────────────────
//
// iPhone のために、**作り直さない。** 作り直すと解錠がやり直しになる。
let element = null
let primed = false
/** 再生の世代。新しい再生が始まったら、古い再生の後始末は何もしない */
let generation = 0

function audioElement() {
  if (element) return element
  element = new Audio()
  element.preload = 'auto'
  return element
}

/** 無音を1回鳴らして解錠する。**利用者が触れた流れの中で呼ぶこと** */
function prime() {
  if (primed) return
  primed = true
  try {
    const el = audioElement()
    // 0.05 秒の無音(16bit モノラル 8kHz)。
    // 中身を作るのは、長い base64 の文字列をコードに貼らないため
    const samples = 400
    const buf = new ArrayBuffer(44 + samples * 2)
    const view = new DataView(buf)
    const put = (o, t) => { for (let i = 0; i < t.length; i += 1) view.setUint8(o + i, t.charCodeAt(i)) }
    put(0, 'RIFF'); view.setUint32(4, 36 + samples * 2, true); put(8, 'WAVEfmt ')
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true)
    view.setUint32(24, 8000, true); view.setUint32(28, 16000, true)
    view.setUint16(32, 2, true); view.setUint16(34, 16, true)
    put(36, 'data'); view.setUint32(40, samples * 2, true)
    el.src = URL.createObjectURL(new Blob([view], { type: 'audio/wav' }))
    const played = el.play()
    if (played?.catch) played.catch(() => { /* 解錠できなくても、押した直後の再生は鳴る */ })
  } catch { /* ここで落ちても、読み上げそのものは止めない */ }
}

if (typeof document !== 'undefined') {
  // 最初に画面へ触れた瞬間に解錠する。**押してから探しても間に合わない**
  const once = () => {
    prime()
    document.removeEventListener('pointerdown', once, true)
    document.removeEventListener('keydown', once, true)
  }
  document.addEventListener('pointerdown', once, true)
  document.addEventListener('keydown', once, true)
}

/**
 * 窓口に作らせる。**ここだけが Azure を使わせる入口である。**
 * 駄目だった理由が「待っても直らない」ものなら、以後は取りに行かない。
 */
async function askForClip(text, voiceId, tier) {
  if (!supabase) return null
  try {
    const { data, error } = await supabase.functions.invoke('speak', {
      body: { text, voice: voiceId, tier },
    })
    // 窓口が 4xx / 5xx を返すと error に入る。中身は data 側にある
    const body = data ?? {}
    if (body.url) return body.url
    if (body.fatal) stopped = true
    if (body.detail) lastDetail = body.detail
    else if (error) lastDetail = error.message
    return null
  } catch (e) {
    // 窓口をまだ配置していないと、ここに来る。**毎回叩きに行かない**
    stopped = true
    lastDetail = `読み上げ音声の窓口につながりません(${e?.message ?? e})。`
      + 'Supabase の Edge Functions に speak が配置されているか確認してください。'
    return null
  }
}

/**
 * その英文の MP3 が置かれる**はずの**場所を返す。
 *
 * **あるかどうかは、ここでは確かめない。** 先に HEAD で問い合わせると
 * 往復が1回増え、控えが効いていて一瞬で鳴るはずの場合まで遅くなる。
 * 「鳴ったか、鳴らなかったか」で判るので、それで足りる。
 */
export async function clipUrl(text, voiceId = DEFAULT_CLIP_VOICE, tier = STANDARD) {
  if (!canUseClips()) return null
  const body = normText(text)
  if (!body) return null
  const voice = clipVoiceId(voiceId)
  const key = `${tier}|${voice}|${body}`
  if (urlCache.has(key)) return urlCache.get(key)
  if (gaveUp.has(key)) return null

  const url = publicUrlOf(tier, voice, await fingerprint(voice, body))
  urlCache.set(key, url)
  return url
}

/** 「その場所には無かった」と分かったときに呼ぶ。窓口に作らせて場所を返す */
export async function makeClip(text, voiceId = DEFAULT_CLIP_VOICE, tier = STANDARD) {
  if (!canUseClips()) return null
  const body = normText(text)
  const voice = clipVoiceId(voiceId)
  const key = `${tier}|${voice}|${body}`
  if (gaveUp.has(key)) return null
  const url = await askForClip(body, voice, tier)
  if (!url) { gaveUp.add(key); urlCache.delete(key); return null }
  urlCache.set(key, url)
  return url
}

/**
 * 次に鳴らすものを、いま鳴らしているあいだに用意しておく。
 * 会話は発言ごとに1本なので、これが無いと発言のたびに間があく。
 * **失敗しても何もしない。** 先読みのために画面を止めない。
 */
export function prefetchClip(text, voiceId = DEFAULT_CLIP_VOICE, tier = STANDARD) {
  if (!canUseClips()) return
  clipUrl(text, voiceId, tier).then((url) => {
    if (!url) return
    // **`fetch` では取りに行かない。** 別のドメインなので CORS の許しが要る。
    // `<audio>` の先読みなら要らず、しかも端末の控えにそのまま入る。
    // ここで作った札は鳴らさない。控えを温めるためだけのもの
    const warm = new Audio()
    warm.preload = 'auto'
    warm.addEventListener('error', () => { makeClip(text, voiceId, tier) })
    warm.src = url
    warm.load()
  }).catch(() => {})
}

/**
 * 鳴っているものを止める。
 *
 * **待っている約束(Promise)も、その場で終わらせる。**
 * 止めても `ended` は来ないので、終わらせないと呼んだ側が待ち続ける。
 */
let endCurrent = null

export function stopClip() {
  generation += 1
  const end = endCurrent
  endCurrent = null
  if (element) {
    try {
      element.pause()
      element.currentTime = 0
    } catch { /* 止められなくても困らない */ }
  }
  end?.()
}

/**
 * MP3 で読み上げる。鳴らせたら true、鳴らせなければ false を返す。
 * false のときは、呼んだ側が端末の声に切り替える。
 *
 * @param {object} o
 * @param {string} o.text     読み上げる英文
 * @param {string} o.voiceId  話者(`PREGENERATED_SPEAKERS` の id)
 * @param {number} o.rate     速さの倍率。MP3 は自然な速さで作ってあるので、
 *                            遅く・速くするのはここ(`playbackRate`)で行う
 * @param {Function} o.onWord いま読んでいる語の位置({charIndex})
 * @param {Function} o.onStart 鳴り始めたときに1回
 */
export async function playClip({
  text, voiceId = DEFAULT_CLIP_VOICE, tier = STANDARD,
  rate = 1, onWord = null, onStart = null,
} = {}) {
  if (!canUseClips()) return false
  const body = normText(text)
  if (!body) return false

  let url = await clipUrl(body, voiceId, tier)
  if (!url) return false

  const mine = (generation += 1)
  const el = audioElement()

  /** 1回だけ鳴らしてみる。鳴らせなければ false */
  const tryPlay = (src) => new Promise((resolve) => {
    let settled = false
    const done = (ok) => {
      if (settled) return
      settled = true
      el.removeEventListener('loadeddata', onLoaded)
      el.removeEventListener('error', onError)
      resolve(ok)
    }
    const onLoaded = () => done(true)
    const onError = () => done(false)
    el.addEventListener('loadeddata', onLoaded)
    el.addEventListener('error', onError)
    try {
      el.src = src
      el.load()
    } catch { done(false) }
    // 取りに行けないまま待ち続けない。10秒で諦めて端末の声に戻す
    window.setTimeout(() => done(false), 10000)
  })

  let ok = await tryPlay(url)
  if (mine !== generation) return true   // 止められた・別のものが始まった
  if (!ok) {
    // その場所には無かった。窓口に作らせる
    url = await makeClip(body, voiceId, tier)
    if (!url) return false
    if (mine !== generation) return true
    ok = await tryPlay(url)
    if (!ok) return false
    if (mine !== generation) return true
  }

  el.playbackRate = rate
  // 速さを変えても声の高さは変えない(既定でそうなるが、明示しておく)
  if ('preservesPitch' in el) el.preservesPitch = true

  return new Promise((resolve) => {
    let frame = 0
    let index = -1
    const marks = wordMarks(body, (el.duration || 0) * 1000)

    const stopTrack = () => { if (frame) { window.cancelAnimationFrame(frame); frame = 0 } }
    const tick = () => {
      if (mine !== generation) { stopTrack(); return }
      const next = markIndexAt(marks, el.currentTime * 1000)
      if (next >= 0 && next !== index) {
        index = next
        onWord?.({ charIndex: marks[index].at, charLength: 0 })
      }
      frame = window.requestAnimationFrame(tick)
    }

    const finish = () => {
      if (endCurrent === finish) endCurrent = null
      el.removeEventListener('ended', finish)
      el.removeEventListener('error', finish)
      stopTrack()
      if (mine === generation) onWord?.(null)
      resolve(true)
    }
    el.addEventListener('ended', finish)
    el.addEventListener('error', finish)
    endCurrent = finish

    const started = el.play()
    if (started?.catch) {
      started.catch(() => {
        // 解錠できていないと、ここに来る。端末の声に戻す
        el.removeEventListener('ended', finish)
        el.removeEventListener('error', finish)
        stopTrack()
        resolve(false)
      })
    }
    onStart?.()
    if (marks.length) frame = window.requestAnimationFrame(tick)
  })
}
