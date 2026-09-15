/**
 * 英語の音声と、音楽の音量。**それぞれ別に覚える**(2026-09 利用者の指定)。
 *
 *   > アプリに好きな音楽を追加し、英語の音声と音楽を独立してそれぞれ
 *   > 音量を調整出来るようにしたいです。
 *   > 英語音声が再生される時に自動で音楽の音量を下げる機能は必要ありません
 *
 * ============================================================================
 * 【自動で下げる仕組み(`duckBgm`)は、道具ごと消した】
 *
 *   0049 のときは「声が鳴っているあいだは曲を小さくする」を入れていたが、
 *   **利用者が要らないと決めた。** 値を偽にして残すと、次に見た人が
 *   「まだ使うのかもしれない」と読む(「サンプルデータに戻す」と同じ作法)。
 *   `BGM_DUCKED` / `bgmVolume()` / `duckBgm()` は1つも残っていない
 *   (0049 の `BGM_VOLUME` は、下の `DEFAULT_BGM` が引き継いでいる)
 *   (`npm run test:play` が、`src/` のどこにも無いことを見張っている)。
 *
 *   **代わりに、聴く人が自分で決める。** 声を小さくしたい人も、
 *   曲を小さくしたい人も、同じ2つのつまみで足りる。
 * ============================================================================
 * 【なぜ `<audio>` の `volume` だけを動かすのか】
 *
 *   **音量を変えるために、音の通り道を変えない**(CLAUDE.md)。
 *   Web Audio(`GainNode`)に通せば iPhone でも効くが、2026-09 に
 *   それをやって**全部の声でバリバリ雑音**が乗った。いちばん高くついた失敗で、
 *   「そろわないことより、雑音が入ることのほうが悪い」と決めてある。
 *   **ここでも同じ判断をする。**
 *
 * 【だから、効かない端末がある】
 *
 *   **iOS は `<audio>` の `volume` を無視する**(CLAUDE.md に何度も出てくる)。
 *   つまり iPhone / iPad では、この2つのつまみはどちらも効かない。
 *
 *   **端末の名前で決めつけない**(`volumeWorks()`)。実際に入れて読み返せば、
 *   効くかどうかはその場で分かる —— 端末を当て推量しないで済むし、
 *   iOS がいつか受け付けるようになった日には**ひとりでにつまみが出る。**
 *
 * 【ここは素の node で走らせられる形にしてある】
 *
 *   Supabase も `import.meta.env` も持たない(`playMark.js` と同じ考え方)。
 *   `bgm.js` / `audioClips.js` はどちらも引き連れているので、
 *   **算段だけをこちらへ出してある。**
 */

/** つまみの刻み。5% より細かくしても、耳では分からない */
export const VOL_STEP = 0.05

/**
 * 英語の音声の既定。**1(そのまま)** ——
 * 何も触らなければ、これまでとまったく同じ音量である。
 * 声どうしをそろえる倍率(`loudness.js` の `gainFor`)は別にかかる。
 */
export const DEFAULT_VOICE = 1

/**
 * 音楽の既定。**0.4**。
 *
 * 0049 のときの `BGM_VOLUME` は **0.42** だったが、つまみは 5% 刻みなので
 * **刻みの上に置く**(0.42 のままだと、画面に「40%」と出ているのに
 * 中身は 42% という食い違いが残る)。
 * 差は 0.02 —— **耳では分からない**(−0.4dB)。
 */
export const DEFAULT_BGM = 0.4

const VOICE_KEY = 'eas.vol.voice'
const BGM_KEY = 'eas.vol.bgm'

/**
 * 0〜1 に収め、5% 刻みにそろえる。
 * **知らない値・範囲の外は、既定に落とす**(行き止まりを作らない)。
 */
export function clampLevel(v, fallback) {
  const n = Number(v)
  if (!Number.isFinite(n)) return fallback
  const inside = Math.min(1, Math.max(0, n))
  // 小数の誤差で 0.35000000000000003 のような値にしない
  return Math.round(Math.round(inside / VOL_STEP) * VOL_STEP * 100) / 100
}

/* **控えは画面の中に持つ。** `fade()` は 10ms ごとに回るので、
   そのたびに localStorage を読みに行かせない */
let voice = null
let bgm = null

function read(key, fallback) {
  try {
    const saved = localStorage.getItem(key)
    return saved === null ? fallback : clampLevel(saved, fallback)
  } catch { return fallback }
}

function write(key, v) {
  try { localStorage.setItem(key, String(v)) } catch { /* 使えなくても困らない */ }
}

/** 英語の音声の大きさ(0〜1)。**読むだけ。安いので何度呼んでもよい** */
export function voiceLevel() {
  if (voice === null) voice = read(VOICE_KEY, DEFAULT_VOICE)
  return voice
}

/** 英語の音声の大きさを決める。**丸めたあとの値を返す** */
export function setVoiceLevel(v) {
  voice = clampLevel(v, DEFAULT_VOICE)
  write(VOICE_KEY, voice)
  return voice
}

/** 音楽の大きさ(0〜1) */
export function bgmLevel() {
  if (bgm === null) bgm = read(BGM_KEY, DEFAULT_BGM)
  return bgm
}

/**
 * 音楽の大きさを覚える。
 * **鳴っている曲に当てるのは `bgm.js` の `setBgmVolume()`** ——
 * あちらだけが `<audio>` を持っている。画面はそちらを呼ぶこと。
 */
export function setBgmLevel(v) {
  bgm = clampLevel(v, DEFAULT_BGM)
  write(BGM_KEY, bgm)
  return bgm
}

/** 画面に出す言い方。**2か所に書き写さない** */
export const pctLabel = (v) => `${Math.round(clampLevel(v, 0) * 100)}%`

/**
 * **この端末は、ページからの音量指定を受け付けるか。**
 *
 * 入れて読み返すだけ —— 端末の名前(UA)を見ない。
 * iOS は `volume` を**黙って無視する**(入れても 1 のまま返る)ので、
 * この1回で分かる。
 *
 * **鳴らさない。** `src` も付けないので、iPhone の解錠にも一切関わらない
 * (「`<audio>` は1つだけ作り、作り直さない」は**鳴らすほう**の決まりである)。
 *
 * **分からなければ「効く」と答える**(行き止まりを作らない)。
 * つまみを出しておくほうが、黙って隠すよりましである。
 */
let works = null
export function volumeWorks() {
  if (works !== null) return works
  try {
    if (typeof Audio === 'undefined') { works = true; return works }
    const probe = new Audio()
    probe.volume = 0.5
    works = Math.abs(Number(probe.volume) - 0.5) < 0.01
  } catch { works = true }
  return works
}

/** 手元の検証用。覚えた値を捨てる */
export function forgetLevels() {
  voice = null
  bgm = null
  works = null
}
