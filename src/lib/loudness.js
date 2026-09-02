/**
 * 声ごとの**音量のばらつき**をそろえる(2026-09 利用者の指摘)。
 *
 *   > スピーカーによって音量の差が気になります。
 *   > 音の出力段階でノーマライズをさせませんか?
 *
 * ============================================================================
 * 【なぜ「作るとき」ではなく「鳴らすとき」なのか】
 *
 *   音量をそろえるには、いったん音を**数値に戻して**大きさを測るしかない。
 *   ところが Supabase の関数は**1回の呼び出しで CPU 2秒**しか使えない
 *   (CLAUDE.md)。MP3 を解いて測って詰め直す処理は、そこに収まらない。
 *   **落ちると応答に CORS の印が付かず、画面には「窓口につながりません」と
 *   しか出ない**ので、未配置と区別がつかなくなる。
 *
 *   窓口の側で音量を指定する道も、全部はふさがっている。
 *   Google は `volumeGainDb`、Azure は `<prosody volume>` を持つが、
 *   **ElevenLabs には音量の指定が無い。** 利用者が気にしているのは
 *   良い声(ElevenLabs)どうしの差なので、それでは届かない。
 *
 *   だから**ブラウザ側で、鳴らす直前に**そろえる。
 *
 * ============================================================================
 * 【1つの声につき1回だけ測る】
 *
 *   声が変わっても、同じ声なら大きさはほぼ同じである(録り方が同じなので)。
 *   だから**声ごとに1回だけ**測り、端末に覚えておく。
 *   2回目からは測らない。測るのは鳴らし**終えたあと**なので、
 *   **その声の1本目だけは、そろわないまま鳴る。**
 *   これは正直に受け入れる(鳴る前に測ると、そのぶん待たせることになる)。
 *
 * 【測り方】
 *   ・**黙っているところを外して**平均の大きさ(RMS)を取る。
 *     入れてしまうと「間の多い音」ほど小さいと判定され、上げすぎになる
 *   ・いちばん大きいところ(peak)も見る。**割れさせないため**である
 *
 * 【かける先は2通り。**どちらも安全側に倒す**】
 *   ① Web Audio の `GainNode` … 大きくも小さくもできる。**iPhone でも効く**
 *   ② `<audio>` の `volume`   … **小さくしかできない。**
 *                                しかも **iOS は `volume` を無視する**
 *
 *   ①を使うには `<audio>` を Web Audio につなぎ替える必要があり、
 *   **別のドメインの音は、CORS の許しが無いと無音になる。**
 *   無音は「押しても何も起きない」に見える、いちばん困る壊れ方である。
 *   だから**測るための取得(fetch)が成功した声があってはじめて**①に切り替える。
 *   取得できたということは、CORS の許しが出ている証拠だからである。
 *   それまでと、切り替えられない端末では②で我慢する。
 */
import { audioContext } from './sfx.js'

/**
 * ============================================================================
 * 【そろえ方 — 「下げてそろえ、そのあと全体を少し上げる」】
 *
 * **2026-09 利用者の指定で、やり方そのものを変えた。**
 *
 *   > 音量のノーマライズを大きめにした際に、吐息や破裂音の空気の音が
 *   > 目立つようになってしまいました。なので、小さい声のボリュームに合わせ、
 *   > 大きい声のボリュームを落とし、そこから全体的に少し音量を上げる。
 *
 * はじめは「決めた大きさ(0.15)に全員を寄せる」やり方だった。
 * ところが**小さい声は 2〜3 倍に持ち上がる**ので、
 * 声だけでなく**息の音も破裂音も同じ倍率で大きくなる。**
 * ノイズは声より下の層にあり、上げれば必ず一緒に上がる。
 * **持ち上げるかぎり、この問題は消えない。**
 *
 * だから**持ち上げない。**
 *
 *   ① そろえ先は**いちばん小さい声**にする(`quietest()`)
 *   ② どの声も **1 倍を超えない**(大きい声を下げるだけ)
 *   ③ そのうえで**全体に同じ倍率**をかける(`LIFT`)
 *
 * ③ は全員に同じだけかかるので、**声とノイズの差(S/N)は変わらない。**
 * ①② で下げた声も、もともと小さかった声も、同じ 1.25 倍を受けるだけ。
 * 「大きい声のぶんノイズが目立つ」ということが起きない。
 * ============================================================================
 */

/**
 * **そろえたあと、全体にかける倍率。**
 * 「そこから全体的に少し音量を上げる」(利用者の指定)の「少し」。
 * 1.25 はおよそ +2dB。**ここだけを触れば、全体の音量を調整できる。**
 */
const LIFT = 1.25

/**
 * **そろえ先の下限。**
 *
 * そろえ先は「測った中でいちばん小さい声」だが、
 * **1つでも極端に小さい測定が混じると、全部がそこまで下がる。**
 * (間の多い音声・一部しか鳴らなかった MP3 など)
 * そうなると全体が聞こえないほど小さくなるので、下限を置く。
 */
const FLOOR_RMS = 0.05

/** 上げ下げの上限。**上げすぎ・下げすぎで不自然にしない** */
const MIN_GAIN = 0.35
const MAX_GAIN = LIFT       // **持ち上げない。** 上限は全体の底上げぶんだけ
/** これより小さい波は「黙っている」とみなす */
const SILENCE = 0.02
/**
 * **いちばん大きいところを、どこまで超えてよいか。**
 *
 * 小さい声を上げると、ひときわ大きい音(破裂音など)が割れる。
 * ふつうは「割れない範囲まで」しか上げられないが、それでは
 * **「平均は小さいのに、一発だけ大きい」声を上げられない。**
 * うしろに頭打ちの仕組み(`DynamicsCompressorNode`)を置いてあるので、
 * そこで抑えられる分(約 3dB = 1.4倍)までは超えてよい。
 */
const PEAK_ROOM = 1.4

const KEY = 'eas.loud'

/** 測った結果(声ごと)。`{ "premium|cgSg…": { rms, peak } }` */
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
 * **これまでに測った中で、いちばん小さい声の大きさ。**
 *
 * ここへ全員をそろえる(利用者の指定「小さい声のボリュームに合わせ、
 * 大きい声のボリュームを落とし」)。
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
 * その声にかける倍率。測っていなければ 1(そのまま)。
 *
 * 【やり方】(2026-09 利用者の指定)
 *   ① いちばん小さい声に合わせて、**大きい声を下げる**(1 を超えない)
 *   ② そのうえで**全体に同じ倍率**(`LIFT`)をかける
 *
 * ②は全員に同じだけかかるので、**声と息の音の差は変わらない。**
 * 持ち上げてそろえると、小さい声ほど息の音まで大きくなっていた。
 *
 * **割れさせない。** いちばん大きいところが 1 を超えないところで止める。
 */
export function gainFor(tier, voice) {
  const got = load()[loudKey(tier, voice)]
  if (!got?.rms) return 1
  const target = quietest()
  if (!target) return 1
  // ① **下げるだけ。** 小さい声はそのまま(1 倍)
  const down = Math.min(target / got.rms, 1)
  // ② 全体を少し上げる
  const capped = Math.min(Math.max(down * LIFT, MIN_GAIN), MAX_GAIN)
  if (!got.peak) return capped
  // **頭打ちの仕組みがあるかどうかで、超えてよい量が変わる。**
  // つないでいないときは `volume` しか使えず、抑える手立てが無いので割れさせない
  const room = limiter ? PEAK_ROOM : 0.99
  return Math.min(capped, room / got.peak)
}

/** もう測ってあるか */
export const isMeasured = (tier, voice) => !!load()[loudKey(tier, voice)]?.rms

/** いま測っているもの。**同じ声を二度測らない** */
const measuring = new Set()

/** **CORS の許しが出ていると分かったか。**(取得に1回成功したら true) */
let corsOk = false
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
    corsOk = true                      // 取れた = CORS の許しが出ている
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
    let peak = 0
    // 全部の波を見なくてよい。**間引いて測る**(長い記事でも一瞬で終わる)
    const step = Math.max(1, Math.floor(data.length / 200000))
    for (let i = 0; i < data.length; i += step) {
      const v = Math.abs(data[i])
      if (v > peak) peak = v
      if (v > SILENCE) { sum += v * v; heard += 1 }
    }
    if (!heard) return false

    load()[key] = { rms: Math.sqrt(sum / heard), peak }
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
let limiter = null

/**
 * つなぎ替えを試みる。**つなげたら true。**
 *
 * 呼ぶ側は、**新しい `src` を入れる直前**に呼ぶこと。
 * `crossOrigin` は `src` より先に立てないと効かない。
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
    /*
     * **頭打ち。** 小さい声を上げると、ひときわ大きい音が割れる。
     * ここで上だけを抑えれば、割れずに上げられる
     * (2026-09「気になるのはデフォルトで小さすぎる声です」)。
     *
     * **音を作り変える道具ではない。** しきい値を高くし、
     * ふだんは何もせず、はみ出したところだけを押さえる設定にしてある。
     */
    limiter = ctx.createDynamicsCompressor()
    limiter.threshold.value = -3      // ここを超えたぶんだけ押さえる
    limiter.knee.value = 0            // なだらかにしない(頭打ちとして使う)
    limiter.ratio.value = 20          // 超えた分はほぼ通さない
    limiter.attack.value = 0.002      // 立ち上がりに間に合わせる
    limiter.release.value = 0.15
    node.connect(gain)
    gain.connect(limiter)
    limiter.connect(ctx.destination)
    return true
  } catch {
    node = null
    gain = null
    limiter = null
    return false
  }
}

/**
 * その1本にかける。**つないであれば `GainNode`、無ければ `volume`。**
 *
 * `volume` は**小さくしかできない**(1 を超えられない)ので、
 * つながっていないあいだは「大きい声を下げるだけ」になる。
 * それでも、そろえないよりはそろう。
 */
export function applyGain(el, tier, voice) {
  const g = gainFor(tier, voice)
  if (gain) {
    gain.gain.value = g
    try { el.volume = 1 } catch { /* iOS は無視する */ }
    return g
  }
  try { el.volume = Math.min(g, 1) } catch { /* iOS は無視する */ }
  return Math.min(g, 1)
}

/** 手元の検証用。覚えた値を消す */
export function forgetLoudness() {
  table = {}
  save()
}
