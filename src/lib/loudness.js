/**
 * 声ごとの**音量のばらつき**をそろえる。**下げるだけ。**
 *
 * ============================================================================
 * 【やり方 — ここまでに2度やり直している。経緯ごと残す】
 *
 *   ① **決めた大きさ(0.15)に全員を寄せる**(2026-09 はじめの版)
 *      → 小さい声は 2〜3 倍に持ち上がる。**声だけでなく息の音も同じ倍率で
 *        大きくなった。**
 *
 *        > 音量のノーマライズを大きめにした際に、吐息や破裂音の空気の音が
 *        > 目立つようになってしまいました。
 *
 *   ② **いちばん小さい声に合わせて下げ、そのあと全体を少し上げる**(1.25倍)
 *      → 声と息の音の差は変わらなくなったが、**上げるための面倒**が残った
 *        (割れないように頭打ちを置き、はみ出す量を計算し…)
 *
 *   ③ **いまはこれ。上げるのをやめた**(2026-09 利用者の指定)
 *
 *        > 1番小さな声に合わせて、それ以上大きくしない
 *
 *      **倍率は必ず 1 以下になる。** だから、
 *        ・**割れない**(大きくしないので、原理的に起こらない)
 *        ・**息の音も破裂音も、1ミリも大きくならない**
 *        ・頭打ちの仕組みも、いちばん大きいところの測定も要らない
 *
 *      引き換えに、**全体の音量はいちばん小さい声に合う。**
 *      足りなければ端末の音量を上げてもらう。
 *      **こちらで足すと、必ず何かが一緒に大きくなる。**
 *
 * ============================================================================
 * 【なぜ「作るとき」ではなく「鳴らすとき」なのか】
 *
 *   音量をそろえるには、いったん音を**数値に戻して**大きさを測るしかない。
 *   ところが Supabase の関数は**1回の呼び出しで CPU 2秒**しか使えない
 *   (CLAUDE.md)。MP3 を解いて測って詰め直す処理は、そこに収まらない。
 *
 *   窓口の側で音量を指定する道も、全部はふさがっている。
 *   Google は `volumeGainDb`、Azure は `<prosody volume>` を持つが、
 *   **ElevenLabs には音量の指定が無い。** 気にしているのは
 *   良い声(ElevenLabs)どうしの差なので、それでは届かない。
 *
 * ============================================================================
 * 【1つの声につき1回だけ測る】
 *
 *   同じ声なら大きさはほぼ同じである(録り方が同じなので)。
 *   だから**声ごとに1回だけ**測り、端末に覚えておく。
 *   測るのは鳴らし**終えたあと**なので、
 *   **その声の1本目だけは、そろわないまま鳴る。**
 *   鳴る前に測ると、そのぶん待たせることになる。
 *
 *   測るのは**黙っているところを外した平均の大きさ(RMS)**だけ。
 *   間を入れて測ると「間の多い音」ほど小さいと判定される。
 *
 * 【かける先は2通り。どちらも安全側に倒す】
 *   ① Web Audio の `GainNode` … **iPhone でも効く**
 *   ② `<audio>` の `volume`   … **小さくするだけならこれで足りる**が、
 *                                **iOS は `volume` を無視する**
 *
 *   ①を使うには `<audio>` を Web Audio につなぎ替える必要があり、
 *   **別のドメインの音は、CORS の許しが無いと無音になる。**
 *   無音は「押しても何も起きない」に見える、いちばん困る壊れ方である。
 *   だから**測るための取得(fetch)が1回成功してはじめて**①に切り替え、
 *   **その事実は端末に覚える**(`CORS_KEY`)。覚えないと、
 *   全部の声を測り終えた翌日から二度と切り替わらない(下記)。
 */
import { audioContext } from './sfx.js'

/**
 * **そろえ先の下限。**
 *
 * そろえ先は「測った中でいちばん小さい声」だが、
 * **1つでも極端に小さい測定が混じると、全部がそこまで下がる。**
 * (間の多い音声・一部しか鳴らなかった MP3 など)
 * そうなると全体が聞こえないほど小さくなるので、下限を置く。
 */
const FLOOR_RMS = 0.05

/**
 * **下げすぎない。** ここまで下げても足りないなら、
 * それは測定のほうを疑うべきである(まともな声どうしで3倍を超える差は出ない)。
 */
const MIN_GAIN = 0.30

/** これより小さい波は「黙っている」とみなす */
const SILENCE = 0.02

const KEY = 'eas.loud'

/** 測った結果(声ごと)。`{ "premium|cgSg…": { rms } }` */
let table = null

function load() {
  if (table) return table
  try {
    table = JSON.parse(window.localStorage.getItem(KEY) || '{}') || {}
  } catch { table = {} }
  return table
}

function save() {
  try { window.localStorage.setItem(KEY, JSON.stringify(table)) } catch { /* 使えなくても困らない */ }
}

/** 声の鍵。**段も入れる**(良い声と標準の声は別のファイルである) */
export const loudKey = (tier, voice) => `${tier}|${voice}`

/**
 * **これまでに測った中で、いちばん小さい声の大きさ。** ここへ全員をそろえる。
 *
 * **測るたびに動く。** 新しく、より小さい声を測ると、そのぶん
 * ほかの声は次に鳴らすときから下がる。**そういう作りである。**
 * 動かないようにするには全部の声を先に測るしかなく、
 * それは鳴らしてもいない音声を取りに行くことになる。
 */
function quietest() {
  let min = Infinity
  for (const v of Object.values(load())) {
    if (v?.rms > 0 && v.rms < min) min = v.rms
  }
  if (!Number.isFinite(min)) return null
  return Math.max(min, FLOOR_RMS)
}

/**
 * その声にかける倍率。**必ず 1 以下。** 測っていなければ 1(そのまま)。
 *
 * 上げないので、**割れることも、息の音が大きくなることも起こらない。**
 */
export function gainFor(tier, voice) {
  const got = load()[loudKey(tier, voice)]
  if (!got?.rms) return 1
  const target = quietest()
  if (!target) return 1
  const down = Math.min(target / got.rms, 1)   // **1 を超えさせない**
  return Math.max(down, MIN_GAIN)
}

/** もう測ってあるか */
export const isMeasured = (tier, voice) => !!load()[loudKey(tier, voice)]?.rms

/** いま測っているもの。**同じ声を二度測らない** */
const measuring = new Set()

/**
 * **CORS の許しが出ていると分かったか。**(取得に1回成功したら true)
 *
 * 【**覚えておかないと、いつまでも効かない**】(2026-09。自分で開けた穴)
 *
 *     ① 声を測るのは「まだ測っていないとき」だけ
 *     ② ところがこの印は、その**測るための取得**でしか立たない
 *     ③ だから**全部の声を測り終えた翌日**からは、
 *        ページを開いても一度も立たない
 *     ④ すると `GainNode` につなぎ替えられず、`<audio>` の `volume` だけになり、
 *        **iPhone では丸ごと無視される**
 *
 *   「使い込むほど効かなくなる」という、いちばん気づきにくい壊れ方だった。
 *   置き場所(同じ Supabase)は変わらないので、一度分かったら覚えておけばよい。
 */
const CORS_KEY = 'eas.loudCors'
let corsOk = (() => {
  try { return window.localStorage.getItem(CORS_KEY) === '1' } catch { return false }
})()
const rememberCors = () => {
  if (corsOk) return
  corsOk = true
  try { window.localStorage.setItem(CORS_KEY, '1') } catch { /* 使えなくても困らない */ }
}
export const isCorsKnownGood = () => corsOk

/**
 * 1本の MP3 から、その声の大きさを測って覚える。
 *
 * **失敗しても何もしない。** 測れなくても読み上げは鳴る。
 * @returns {Promise<boolean>} 測れたら true
 */
export async function measureClip(url, tier, voice) {
  const key = loudKey(tier, voice)
  if (!url || measuring.has(key) || isMeasured(tier, voice)) return false
  measuring.add(key)
  try {
    // **端末の控えが効く。** `<audio>` が取ったばかりのものなので、
    // ここでもう一度取りに行っても、たいていは通信が起きない
    const res = await fetch(url, { mode: 'cors', cache: 'force-cache' })
    if (!res.ok) return false
    rememberCors()                     // 取れた = CORS の許しが出ている
    const bytes = await res.arrayBuffer()

    // **鳴らすための入れ物は使わない。** 解くだけなので、
    // 起こす(resume)必要のない `OfflineAudioContext` で足りる
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext
    if (!OAC) return false
    const off = new OAC(1, 1, 44100)
    const buf = await off.decodeAudioData(bytes)

    const data = buf.getChannelData(0)
    let sum = 0
    let heard = 0
    // 全部の波を見なくてよい。**間引いて測る**(長い記事でも一瞬で終わる)
    const step = Math.max(1, Math.floor(data.length / 200000))
    for (let i = 0; i < data.length; i += step) {
      const v = Math.abs(data[i])
      if (v > SILENCE) { sum += v * v; heard += 1 }
    }
    if (!heard) return false

    load()[key] = { rms: Math.sqrt(sum / heard) }
    save()
    return true
  } catch {
    return false                        // CORS で断られた・解けなかった
  } finally {
    measuring.delete(key)
  }
}

// ── `<audio>` を Web Audio につなぎ替える ──────────────────────
//
// **一度つなぐと、もう戻せない。** その `<audio>` の音は、以後かならず
// Web Audio を通って出る。だから**確かめてからつなぐ。**
let node = null
let gain = null

/**
 * つなぎ替えを試みる。**つなげたら true。**
 *
 * 呼ぶ側は、**新しい `src` を入れる直前**に呼ぶこと
 * (`crossOrigin` は `src` より先に立てないと効かない)。
 *
 * つながない条件は3つ。どれも「無音になるくらいなら、そろえない」である。
 *   ・CORS の許しをまだ確かめていない
 *   ・`AudioContext` が起きていない(iOS は触られるまで眠っている)
 *   ・そもそも Web Audio が無い
 */
export function routeThroughGain(el) {
  if (gain) return true
  if (!el || !corsOk) return false
  const ctx = audioContext()
  if (!ctx || ctx.state !== 'running') return false
  try {
    el.crossOrigin = 'anonymous'
    node = ctx.createMediaElementSource(el)
    gain = ctx.createGain()
    // **頭打ちは要らない。** 1 を超える倍率をかけないので、割れようがない
    node.connect(gain)
    gain.connect(ctx.destination)
    return true
  } catch {
    node = null
    gain = null
    return false
  }
}

/**
 * その1本にかける。**つないであれば `GainNode`、無ければ `volume`。**
 *
 * 倍率は必ず 1 以下なので、**`volume` でもそのまま表せる**
 * (`volume` は小さくすることしかできない)。
 * ただし **iOS は `volume` を無視する**ので、そこでは効かない。
 */
export function applyGain(el, tier, voice) {
  const g = gainFor(tier, voice)
  if (gain) {
    gain.gain.value = g
    try { el.volume = 1 } catch { /* iOS は無視する */ }
  } else {
    try { el.volume = g } catch { /* iOS は無視する */ }
  }
  return g
}

/** 手元の検証用。覚えた値を消す */
export function forgetLoudness() {
  table = {}
  save()
}
