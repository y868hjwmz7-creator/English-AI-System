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
 * 【かける先は `<audio>` の `volume` **だけ**にする】
 *
 *   **一度 Web Audio(`MediaElementAudioSourceNode` → `GainNode`)を
 *   通していたが、やめた**(2026-09 実機)。
 *
 *     > 小さな音量に合わせたはずなのに1回目の再生からバリバリ雑音だらけです。
 *     > 1.25持ち上げると言う処理をやめたのに不思議です。
 *     > ホワイトノイズが入るのであれば理解できるのですが。
 *     > イギリス英語の音声が特に酷いです。
 *
 *   **利用者の疑問がそのまま答えである。**
 *   音を小さくする掛け算(0.4倍など)は、**雑音を作れない。**
 *   小さくすれば雑音も一緒に小さくなるだけである。
 *   つまり**原因は音量の値ではなく、音の通り道**にある。
 *
 *   Web Audio を通すと、次の3つが**新しく**加わっていた。
 *
 *     ・**`ctx.destination` は ±1.0 で切り落とす**(ハードクリップ)。
 *       素の `<audio>` はブラウザの出力へ直接流れる
 *     ・**再生速度**(利用者は 120% で使っている)。
 *       声の高さを保つ処理は山を一時的に持ち上げるので、
 *       もともと大きく録れている音源ほど上で切られる
 *     ・**入れ物の周波数への変換**(MP3 と `AudioContext` で違うことがある)
 *
 *   どれも**音源によって出方が変わる**ので、
 *   「イギリスの声だけひどい」という偏りとも噛み合う。
 *
 *   **倍率は必ず 1 以下**(上げない)なので、
 *   `<audio>` の `volume` だけで過不足なく表せる。
 *   通り道を変えずに済むなら、変えないほうがよい。
 *
 *   **引き換え: iOS は `volume` を無視する。**
 *   iPhone / iPad では音量がそろわない。
 *   **雑音が入るより、そろわないほうがましである。**
 */

/**
 * **明らかに測り損ねたもの。** これより小さければ、人の声ではない
 * (鳴り終わる前に取れた・ほとんど無音だった、など)。
 *
 * **そろえ先の計算から外す。** 以前は「下限 0.05」で押し上げていたが、
 * **それがそろえるのを壊していた**(2026-09)。
 * 本当にいちばん小さい声が 0.04 だと、そろえ先が 0.05 になり、
 *
 *     いちばん小さい声 … 0.05/0.04 は 1 を超えるので 1 倍のまま → 0.04
 *     ほかの声         … 0.05 まで下がる                       → 0.05
 *
 * **いちばん小さい声だけが、いちばん小さいまま残る。**
 * 人の声の平均は 0.03〜0.08 あたりなので、これは日常的に起きていた。
 * **押し上げるのではなく、外す。**
 */
const BROKEN_RMS = 0.01

/**
 * **下げすぎの歯止め。** ここまで来たら測定のほうを疑う。
 *
 * **0.30 から 0.20 へ下げた**(2026-09)。3.3 倍ひらいた声が
 * ここで止まってそろわなかったため。まともな声どうしなら、まず届かない。
 */
const MIN_GAIN = 0.20

/** これより小さい波は「黙っている」とみなす */
const SILENCE = 0.02

/**
 * **測り方の版。** 変えたら**必ず1つ進める。**
 *
 * 進めないと、**古いやり方で測った値と新しい値が混ざる。**
 * 混ざったまま比べると、そろえ先が実際とずれる。
 * 進めれば、次に鳴らしたときに測り直される(1声につき1回だけ)。
 *
 *   1 … 波形をそのまま二乗した平均(素の RMS)
 *   2 … **耳の感じ方に合わせてから**測る(下記)
 */
const MEASURE_REV = 2

const KEY = `eas.loud.${MEASURE_REV}`

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
 * 測った声の**平均**と、**いちばん小さい声**。
 *
 * **明らかに測り損ねたものは外す**(`BROKEN_RMS`)。
 * 押し上げて帳尻を合わせると、**いちばん小さい声だけがそろわない**
 * (`BROKEN_RMS` の説明を参照)。
 */
function stats() {
  const list = Object.values(load())
    .map((v) => v?.rms)
    .filter((r) => r > BROKEN_RMS)
  if (!list.length) return null
  return {
    avg: list.reduce((a, b) => a + b, 0) / list.length,
    min: Math.min(...list),
  }
}

/**
 * その声にかける倍率。**必ず 1 以下。** 測っていなければ 1(そのまま)。
 *
 * ============================================================================
 * 【そろえ先は「全部の声の平均」】(2026-09 利用者の指定)
 *
 *   > コンプレッションやリミッターをかけるのではなく、ボリューム調整だけで、
 *   > 全ての声の音量の平均値をとり、そこに全てを合わせてみてください
 *
 *   まず**平均に合わせる倍率**を出す(`平均 ÷ その声`)。
 *   平均より小さい声では、これは **1 を超える**。
 *
 *   ところが `<audio>` の `volume` は**下げることしかできない。**
 *   そこで**全体を「いちばん大きい倍率」で割って**、どれも 1 以下に収める。
 *
 *   **声どうしの比は、これでまったく変わらない。** 変わるのは全体の音量だけ
 *   (結果として「いちばん小さい声にそろえた」のと同じ値になる)。
 *   上げられるようになった日には、割るのをやめれば平均そのものに合う。
 * ============================================================================
 */
export function gainFor(tier, voice) {
  const got = load()[loudKey(tier, voice)]
  if (!got?.rms) return 1
  const s = stats()
  if (!s) return 1

  // ① 平均に合わせる(平均より小さい声では 1 を超える)
  const want = s.avg / got.rms
  // ② いちばん大きい倍率で全体を割り、1 以下に収める。**比は変わらない**
  const loudestNeed = s.avg / s.min
  const scaled = loudestNeed > 1 ? want / loudestNeed : want

  // 上げられないので必ず 1 以下に。下げすぎの歯止めも置く
  return Math.max(Math.min(scaled, 1), MIN_GAIN)
}

/** もう測ってあるか */
export const isMeasured = (tier, voice) => !!load()[loudKey(tier, voice)]?.rms

/** いま測っているもの。**同じ声を二度測らない** */
const measuring = new Set()

/**
 * **耳の感じ方に合わせた波**を返す(測るためだけに使う)。
 *
 * 放送の決まり(ITU-R BS.1770 の K特性)と同じ形。
 * **外に出してあるのは、実機で効きを確かめるため**(`npm run test:audio` は
 * 素の node なので Web Audio を持たない。ブラウザでしか確かめられない)。
 *
 * 通せなかった端末では `null` を返し、呼んだ側は測るのをやめる
 * (**素の波で測ると、低音の多い声を下げすぎる**ので、
 * 中途半端に測るくらいなら測らないほうがよい)。
 */
export async function weighted(OAC, buf) {
  try {
    const off = new OAC(1, buf.length, buf.sampleRate)
    const src = off.createBufferSource()
    src.buffer = buf

    // ① 高い側を +4dB(耳の感度に合わせる)
    const shelf = off.createBiquadFilter()
    shelf.type = 'highshelf'
    shelf.frequency.value = 1500
    shelf.gain.value = 4

    // ② とても低いところを落とす(声ではない揺れ)
    const hp = off.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 38
    hp.Q.value = 0.5

    src.connect(shelf).connect(hp).connect(off.destination)
    src.start()
    const out = await off.startRendering()
    return out.getChannelData(0)
  } catch {
    return null
  }
}

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
    const bytes = await res.arrayBuffer()

    // **鳴らすための入れ物は使わない。** 解くだけなので、
    // 起こす(resume)必要のない `OfflineAudioContext` で足りる
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext
    if (!OAC) return false
    const off = new OAC(1, 1, 44100)
    const buf = await off.decodeAudioData(bytes)

    /*
     * **耳の感じ方に合わせてから測る**(2026-09 実機)。
     *
     *   > 音の通り道が整った今、あらためて…全ての声の音量の平均値をとり、
     *   > そこに全てを合わせてみてください
     *
     * 平均に合わせても差が残るなら、**測り方そのものを疑う。**
     * これまでは波形をそのまま二乗した平均(素の RMS)だったが、
     * **耳は低い音に鈍く、中〜高音に敏感である。**
     * だから低音の多い声(男性に多い)は、
     * **数字上は大きいのに、そう聞こえない。** 下げすぎていた。
     *
     * 放送で使われている決まり(ITU-R BS.1770 の K特性)と同じ形に整える。
     *   ・**高い側を +4dB 持ち上げる**(1.5kHz からの棚)… 耳の感度に合わせる
     *   ・**とても低いところを落とす**(38Hz からの高域通過)… 声ではない揺れ
     *
     * **ここは測るためだけの処理である。** 鳴らす音には一切かからない
     * (通り道を変えると雑音が出た。上の説明を参照)。
     */
    const shaped = await weighted(OAC, buf)
    if (!shaped) return false

    const data = shaped
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

/**
 * その1本にかける。**`<audio>` の `volume` だけを使う。**
 *
 * 倍率は必ず 1 以下なので、`volume`(小さくすることしかできない)で
 * 過不足なく表せる。**音の通り道は変えない**(上の説明を参照)。
 *
 * **iOS は `volume` を無視する。** iPhone / iPad ではそろわないが、
 * 雑音が入るよりはましである。
 */
export function applyGain(el, tier, voice) {
  const g = gainFor(tier, voice)
  try { el.volume = g } catch { /* iOS は無視する */ }
  return g
}

/** 手元の検証用。覚えた値を消す */
export function forgetLoudness() {
  table = {}
  save()
}
