/**
 * 音の合図(2026-09 利用者の指定)。
 *
 *   > タッチのデバイスで取り組むときは、ボタンなどを押したときは音が鳴るように、
 *   > そして正解したらピンポンとなるようにしてほしいです。体で感じれる仕様です
 *   > ぶるっとしたり、おとがなったり、そういうのを実装してください
 *
 * 【以前は「音は鳴らさない」と決めていた】
 *   レッスン中に邪魔になること、iOS の音まわりが録音と同じ資源を使うこと
 *   (仕様書 3.3.2)が理由だった。**利用者の指定で変える。**
 *   ただし心配は残るので、次の3つで抑えてある。
 *
 *   ・**音そのものを持たない。** ファイルを読み込まず、
 *     その場で短い波を作って鳴らす。読み込み待ちも容量も増えない
 *   ・**とても短く、とても小さく**(いちばん長い正解の和音で 0.51 秒)
 *   ・**切れる**(localStorage に覚える。左のメニューの下から)
 *
 * 【`AudioContext` は1つだけ作り、二度と閉じない】
 *   iOS では作り直すと数回で無音になる(仕様書 3.3.2 / `speech.js` と同じ作法)。
 *   **最初に画面へ触れた瞬間に起こす。** iOS は「押した流れの中で始まった音」
 *   しか鳴らさないためである。
 *
 * 【読み上げとぶつけない】
 *   お手本の読み上げ(`readAloud.js`)は `<audio>` と Web Speech を使う。
 *   こちらは `AudioContext` で短い波を鳴らすだけなので、止め合わない。
 */
let ctx = null
let unlocked = false

/** 覚えておく鍵。**1か所に置く**(読み上げの速さと同じ作法) */
const KEY = 'eas.sound'

/** 鳴らすかどうか。**覚える**(既定は鳴らす) */
let on = null
export function soundOn() {
  if (on === null) {
    try { on = window.localStorage.getItem(KEY) !== 'off' } catch { on = true }
  }
  return on
}
export function setSoundOn(next) {
  on = Boolean(next)
  try { window.localStorage.setItem(KEY, on ? 'on' : 'off') } catch { /* 使えなくても困らない */ }
}

/** 音の入れ物。**1つだけ作り、二度と閉じない** */
function context() {
  if (ctx) return ctx
  try {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return null
    ctx = new AC()
  } catch { return null }
  return ctx
}

/**
 * **押した流れの中で起こす。**
 * iOS は、触っていないところで始めた音を鳴らさない。
 * アプリで1回だけ呼ぶ(`installSfx`)。
 */
export function unlockSfx() {
  if (unlocked) return
  const c = context()
  if (!c) return
  unlocked = true
  if (c.state === 'suspended') c.resume().catch(() => {})
}

/**
 * 短い音を1つ鳴らす。
 * @param {number} freq  高さ(Hz)
 * @param {number} at    いまから何秒後に鳴らすか
 * @param {number} dur   長さ(秒)
 * @param {number} peak  大きさ(0〜1)
 * @param {string} wave  波の形。**既定は三角**(これまでの音を1つも変えない)
 */
function beep(freq, at, dur, peak, wave = 'triangle') {
  const c = context()
  if (!c) return
  const t = c.currentTime + at
  const osc = c.createOscillator()
  const gain = c.createGain()
  /**
   * **三角が既定。** 正弦は柔らかすぎて小さな音量では聞こえず、
   * 矩形はきつい。あいだを取る。
   *
   * **`sine` を選べるようにした**(第5.173節・2026-09 利用者の指定
   * 「正解時の音ももっと洒落たものにしてください」)。
   * 正解の音は**3つの音を重ねて和音にする**ので、
   * 三角のままだと倍音がぶつかって濁る。**重ねるときは正弦**である。
   */
  osc.type = wave
  osc.frequency.setValueAtTime(freq, t)
  // **立ち上がりと消え際をなだらかにする。** 角があると「プチッ」と鳴る
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(peak, t + 0.008)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  osc.connect(gain).connect(c.destination)
  osc.start(t)
  osc.stop(t + dur + 0.02)
}

/**
 * 合図の種類。**数を増やさない。** 覚えられるのはせいぜい3〜4種類である。
 *
 * | 何 | 音 |
 * |---|---|
 * | `tap`     | 押した。**いちばん短く、いちばん小さく**(何度も鳴るため) |
 * | `correct` | 言えた・覚えた。**ピンポン**(低い → 高い) |
 * | `miss`    | まだ。**責めない。** 低く1つだけ。ブーとは鳴らさない |
 * | `done`    | 裏の仕事が終わった。3つ上がって「できました」 |
 */
const SOUNDS = {
  /**
   * **押した音**(第5.173節・2026-09 利用者の指定
   * 「普段から押した音が出るようにしてください」)。
   *
   * **マウスでも鳴るようになった**ので、これまでより**たくさん鳴る。**
   * だから 880Hz の三角(カチッ)から、**正弦の2つ重ね**に変えた ——
   * 上に薄く倍音を乗せると、小さくしても**芯が残って聞こえる。**
   * 長さは 0.045 秒。**耳に残らない短さ**である。
   */
  tap: [
    [1174.7, 0, 0.045, 0.055, 'sine'],   // D6 …… 本体
    [2349.3, 0, 0.028, 0.016, 'sine'],   // D7 …… ほんの少しの艶
  ],
  /**
   * **言えた・覚えた**(第5.173節・2026-09 利用者の指定
   * 「正解時の音ももっと洒落たものにしてください」)。
   *
   * 前は**2つの音(ピンポン)**だった。これを
   * **ハ長調の分散和音(ド・ミ・ソ)+ 上のド**に変えた。
   *
   * **洒落て聞こえるのは、重なって響くからである。**
   * 1つ 0.34〜0.40 秒に対して、次を **0.055 秒**で追いかけるので、
   * 3つの尾が**同時に鳴って和音になる**(前は 0.10 秒ずらしで
   * ほとんど重なっていなかった)。いちばん上のドは**薄く**添えて、
   * 鈴のような艶だけを足す。
   *
   * **`sine` にしてある。** 三角のまま重ねると倍音がぶつかって濁る。
   */
  correct: [
    [1046.5, 0,     0.34, 0.085, 'sine'],   // C6
    [1318.5, 0.055, 0.34, 0.075, 'sine'],   // E6
    [1568.0, 0.110, 0.40, 0.085, 'sine'],   // G6 …… いちばん長く残す
    [2093.0, 0.110, 0.24, 0.030, 'sine'],   // C7 …… 艶だけ
  ],
  /* **まだ。責めない。** ここは1文字も変えていない(言われた場所だけを直す) */
  miss:    [[392, 0, 0.14, 0.07]],
  done:    [[659, 0, 0.12, 0.11], [784, 0.11, 0.12, 0.11], [1047, 0.22, 0.3, 0.12]],
}

/**
 * 合図を鳴らす。**鳴らせない端末では、静かに何もしない。**
 * @param {'tap'|'correct'|'miss'|'done'} kind
 */
export function playSfx(kind = 'tap') {
  if (!soundOn()) return
  const parts = SOUNDS[kind]
  if (!parts) return
  try {
    const c = context()
    if (!c) return
    // 触る前に呼ばれると止まったままのことがある。起こしてから鳴らす
    if (c.state === 'suspended') c.resume().catch(() => {})
    for (const [freq, at, dur, peak, wave] of parts) beep(freq, at, dur, peak, wave)
  } catch { /* 鳴らせない端末では、静かに何もしない */ }
}
