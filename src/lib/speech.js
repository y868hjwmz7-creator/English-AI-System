/**
 * 音声まわり(お手本の読み上げ / マイク録音)をまとめた場所。
 *
 * ★仕様書 5.2 の制約について
 *   お手本音声はブラウザに内蔵されている読み上げ機能(Web Speech API)を使っています。
 *   そのため、どんな声で読まれるかは「利用者の端末とブラウザ」に依存します。
 *   同じコードでも Windows / Mac / iPhone / Android で声が変わり、
 *   アメリカ英語・イギリス英語を確実に指定することはできません。
 *   本番で音声品質を揃えたい場合は、外部の音声合成サービスに切り替える必要があります。
 *
 * ★2026-08 追記 — ここは**予備の経路**になった
 *   iPhone では、どのブラウザを使っても良い声が出せないことが実機で確定した
 *   (仕様書 5.2.1)。そこで教材の英文は、こちらで作った MP3 を配る形に変えた。
 *   その振り分けは `readAloud.js` が行う。**画面はそちらを呼ぶこと。**
 *   このファイルの `speak()` は、MP3 がまだ無いときの受け皿である。
 */
import { markIndexAt, totalWeight, weighWords, wordMarks } from './wordTiming.js'

/** ブラウザが読み上げ機能に対応しているか */
export function isSpeechSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

/** ブラウザがマイク録音に対応しているか */
export function isRecordingSupported() {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function' &&
    typeof window !== 'undefined' &&
    'MediaRecorder' in window
  )
}

/**
 * ここから: 声の選び方
 *
 * ★なぜ選び方が重要か
 *   端末には英語の声が何種類も入っており、getVoices() が返す並び順は
 *   品質順ではありません。単純に先頭を選ぶと、
 *   「簡易版(Compact)の声」や、macOS に入っている
 *   ネタ用の声(Bells, Zarvox など)が選ばれてしまいます。
 *   学習用のお手本としては使い物になりません。
 *
 *   そのため、名前から品質を判定して並べ替え、いちばん良い声を既定にします。
 */

/**
 * ★実機(iOS 18.7)で分かったこと
 *
 *   1. ネタ声の名前は端末の言語に翻訳される。
 *      日本語環境では Bells が「ベル」、Jester が「道化」、
 *      Whisper が「ささやき声」として現れる。
 *      → 英語名だけで判定してはいけない。voiceURI で判定する。
 *
 *   2. 同じ声が二重に現れる端末がある(39個中12個が重複だった)。
 *      → 品質順に並べてから重複を取り除く。並べる前に除くと、
 *        簡易版のほうを残してしまう恐れがある。
 *
 *   3. Apple の声の品質は voiceURI に現れる。
 *      com.apple.voice.premium.*  / .enhanced.*  / .compact.*
 *      ネタ声は com.apple.speech.synthesis.voice.* という古い系統にある。
 *      → 表示名より voiceURI のほうが信頼できる。
 *
 *   4. 学習者向けにはアメリカ英語が基準。
 *      評価が同点だと、オーストラリア英語などが選ばれてしまっていた。
 *      → アクセントに優先順位を付ける。
 */

/** 学習用として明らかに不適切な声(ネタ声)。一覧から除外する。 */
const NOVELTY_VOICES = [
  // 英語名
  'albert', 'bad news', 'bahh', 'bells', 'boing', 'bubbles', 'cellos', 'deranged',
  'good news', 'hysterical', 'jester', 'organ', 'pipe organ', 'trinoids',
  'whisper', 'wobble', 'zarvox', 'superstar', 'princess',
  // 日本語環境での表示名(実機で確認)
  'ベル', '道化', 'オルガン', 'スーパースター', 'トリノイド', 'ささやき声', '震え',
  '鐘', '泡', 'チェロ', '悪い知らせ', '良い知らせ', 'うなり', 'きしみ', '風変わり',
]

/** Apple の標準的な英語話者。ネタ声ではなく、お手本として使える。 */
const APPLE_STANDARD = [
  'samantha', 'ava', 'allison', 'susan', 'nicky', 'aaron', 'tom',
  'serena', 'daniel', 'kate', 'oliver', 'karen', 'moira', 'tessa', 'rishi',
]

/** 学習用には向かない、癖の強い声。使えるが優先しない。 */
const LOW_PRIORITY = ['grandma', 'grandpa', 'rocko', 'sandy', 'shelley', 'eddy', 'flo', 'reed', 'junior', 'kathy', 'fred', 'ralph', 'agnes', 'vicki', 'victoria', 'bruce']

/**
 * 学習のお手本として望ましいアクセントの順位。
 * 日本の英語教育はアメリカ英語が基準のため、en-US を最優先にする。
 */
const ACCENT_PRIORITY = { 'en-us': 30, 'en-gb': 24, 'en-ca': 10, 'en-au': 6, 'en-ie': 4, 'en-nz': 4, 'en-za': 2, 'en-in': 2 }

/** ネタ声かどうか。表示名と voiceURI の両方で判定する。 */
function isNoveltyVoice(voice) {
  const name = (voice.name || '').toLowerCase()
  const uri = (voice.voiceURI || '').toLowerCase()
  // Apple の古い系統(com.apple.speech.synthesis.voice.*)はネタ声とレガシー音声
  if (uri.includes('speech.synthesis.voice.')) return true
  return NOVELTY_VOICES.some((n) => name.startsWith(n.toLowerCase()))
}

/**
 * 声の品質を点数で評価する。数字が大きいほど良い。
 * 表示名は端末の言語に翻訳されるため、voiceURI を優先して見る。
 */
function scoreVoice(voice) {
  const name = (voice.name || '').toLowerCase()
  const uri = (voice.voiceURI || '').toLowerCase()
  const both = name + ' ' + uri
  let score = 0

  // 各社の高品質版
  if (both.includes('premium')) score += 100
  if (both.includes('enhanced')) score += 90
  if (both.includes('neural') || both.includes('natural')) score += 90
  if (both.includes('siri')) score += 80

  // 提供元による傾向
  if (name.startsWith('google')) score += 70
  if (APPLE_STANDARD.some((n) => name.startsWith(n))) score += 40
  if (name.startsWith('microsoft')) score += 50

  // 通信を使う声は、端末内蔵の簡易な声より品質が高いことが多い
  if (voice.localService === false) score += 20

  // 簡易版・癖の強い声は下げる
  if (both.includes('compact')) score -= 60
  if (LOW_PRIORITY.some((n) => name.startsWith(n))) score -= 50

  // 学習のお手本として望ましいアクセントを優先する
  score += ACCENT_PRIORITY[(voice.lang || '').toLowerCase()] ?? 0

  // 端末の既定の声は、わずかに優遇する
  if (voice.default) score += 5

  return score
}

/**
 * 品質の目安を日本語のラベルにする(画面に出すため)
 *
 * ★通信を使う声は「高品質」に含める(実機の報告より)
 *   Chrome の Google 音声は名前に Premium などの語を含まないため、
 *   当初は「標準」と判定していた。しかし実際には通信先で生成される
 *   ニューラル音声であり、端末内蔵の声より明確に自然である。
 *   実機で「Chrome で開いたら音声の質がとても良かった」との報告があり、
 *   判定基準を見直した。
 */
export function voiceQualityLabel(voice) {
  const name = (voice.name || '').toLowerCase()
  const both = name + ' ' + (voice.voiceURI || '').toLowerCase()

  // 各社が明示している高品質版
  if (both.includes('premium') || both.includes('enhanced') || both.includes('neural') || both.includes('natural')) {
    return '高品質'
  }
  // 通信して生成する声。端末に入っている簡易な声より質が高い。
  if (voice.localService === false) return '高品質'
  if (name.startsWith('google')) return '高品質'

  if (both.includes('compact')) return '簡易'
  if (scoreVoice(voice) >= 50) return '標準'
  return '簡易'
}

/** アメリカ英語かイギリス英語かなどを日本語にする */
export function voiceAccentLabel(voice) {
  const lang = (voice.lang || '').toLowerCase()
  const map = {
    'en-us': 'アメリカ英語',
    'en-gb': 'イギリス英語',
    'en-au': 'オーストラリア英語',
    'en-ca': 'カナダ英語',
    'en-ie': 'アイルランド英語',
    'en-in': 'インド英語',
    'en-nz': 'ニュージーランド英語',
    'en-za': '南アフリカ英語',
  }
  return map[lang] || lang
}

/**
 * 使える英語の声の一覧を、品質の良い順に並べて返す。
 *
 * ★既知の落とし穴:
 *   getVoices() は最初の1回目に空の配列を返す端末があります。
 *   voiceschanged イベントを待つ必要があるため、Promise で包んでいます。
 */
export function loadEnglishVoices() {
  return new Promise((resolve) => {
    if (!isSpeechSupported()) {
      resolve([])
      return
    }

    const pickEnglish = (voices) => {
      const seen = new Set()
      return (
        voices
          .filter((v) => v.lang && v.lang.toLowerCase().startsWith('en'))
          .filter((v) => !isNoveltyVoice(v))
          // ★先に品質順へ並べてから重複を除く(実機の報告より)
          //   同じ表示名で簡易版と高品質版の両方を返す端末がある。
          //   iOS の Chrome は同じ名前の声を2つずつ返していた。
          //   先に見つかったほうを残す実装では、高品質版を捨てる恐れがあった。
          //   並べ替えてから除けば、必ず良いほうが残る。
          .sort((a, b) => scoreVoice(b) - scoreVoice(a))
          .filter((v) => {
            const key = `${v.name}|${v.lang}`
            if (seen.has(key)) return false
            seen.add(key)
            return true
          })
      )
    }

    const immediate = pickEnglish(window.speechSynthesis.getVoices())
    if (immediate.length > 0) {
      resolve(immediate)
      return
    }

    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      window.speechSynthesis.removeEventListener('voiceschanged', finish)
      resolve(pickEnglish(window.speechSynthesis.getVoices()))
    }

    window.speechSynthesis.addEventListener('voiceschanged', finish)
    // イベントが来ない端末のための保険
    setTimeout(finish, 1500)
  })
}

/**
 * 一覧の中に、お手本として使える品質の声があるか。
 * なければ画面で「端末に良い声を追加する方法」を案内する。
 */
export function hasGoodVoice(voices) {
  return voices.some((v) => voiceQualityLabel(v) === '高品質')
}

/**
 * 読み上げの速さの見積もり。**声ごとに実測して覚える。**
 *
 * 単位は「1秒あたりの重み」(速さ1.0のとき)。重みは下の `weighWords()` が
 * 決めるもので、**文字数そのものではない**(語ごとに +1、句読点の間も足す)。
 * 英語の読み上げはおよそ 15 文字/秒。重みは文字数の 1.2 倍ほどになるので、
 * 初期値は 18 にしてある。
 *
 * 1回読み上げるたびに、実際にかかった時間で直していく。
 * **推測を推測のままにしない。** 2回目からはその声の実測値で動く。
 */
const CPS_KEY = 'english-ai-speech-cps'
const CPS_DEFAULT = 18
const CPS_MIN = 6
const CPS_MAX = 34

const loadCps = (voiceName) => {
  try {
    const all = JSON.parse(window.localStorage.getItem(CPS_KEY) ?? '{}')
    const v = Number(all[voiceName || '既定'])
    return Number.isFinite(v) && v >= CPS_MIN && v <= CPS_MAX ? v : CPS_DEFAULT
  } catch {
    return CPS_DEFAULT
  }
}

const saveCps = (voiceName, cps) => {
  if (!Number.isFinite(cps) || cps < CPS_MIN || cps > CPS_MAX) return
  try {
    const all = JSON.parse(window.localStorage.getItem(CPS_KEY) ?? '{}')
    const key = voiceName || '既定'
    // 急に振れないよう、前の値と半々で混ぜる
    const before = Number(all[key])
    all[key] = Number.isFinite(before) ? (before + cps) / 2 : cps
    window.localStorage.setItem(CPS_KEY, JSON.stringify(all))
  } catch { /* 保存できなくても動く */ }
}

/**
 * **いま読んでいる語**を知らせる。
 *
 * 【なぜ要るか】(2026-08 利用者の指定)
 *   文のかたまりごとに色を付けていたが、どこを読んでいるのか分からない。
 *   語ごとに、滑らかに移っていくようにする。
 *
 * 【仕組みは2段構え】
 *
 *   ① ブラウザの合図(`boundary`)を使う。**これがあるときは正確。**
 *      「いま何文字目から読み始めた」だけが渡されるので、
 *      文字の位置を画面へ返し、受け取った側が語を突き止める。
 *
 *   ② **合図が来ない端末では、時間から見積もって動かす。**
 *
 * 【なぜ②が要るのか】(2026-08 実機で確定)
 *   利用者の会社PC(Windows / Chrome)に入っている英語の声は3つとも
 *   Google の「通信を使う声」で、**3つとも合図を出さなかった**
 *   (mic-test.html で 0 回を確認)。iOS の Safari でも出ないことがある。
 *   合図だけに頼ると、**主に使う端末で語の色が一度も動かない。**
 *
 * 【見積もりを推測のままにしない】
 *   語の長さと句読点の間で時間を配り、読み終わったら**実際にかかった
 *   時間で声ごとの速さを覚える**(`saveCps`)。2回目からはその実測値で動く。
 *   合図が1回でも来たら、見積もりは即座にやめて合図に従う。
 */
const attachWordTracking = (utterance, onWord, { text, rate = 1, voiceName = '' } = {}) => {
  if (!onWord) return () => {}

  const words = weighWords(text ?? utterance.text ?? '')
  let gotBoundary = false
  let timer = null
  let startedAt = 0

  const stopTimer = () => {
    if (timer) { window.clearInterval(timer); timer = null }
  }

  utterance.onboundary = (e) => {
    // 語の切れ目だけを見る。文の切れ目(sentence)は無視する
    if (e.name && e.name !== 'word') return
    if (typeof e.charIndex !== 'number') return
    // **合図が来た端末では、見積もりを使わない**
    gotBoundary = true
    stopTimer()
    onWord({ charIndex: e.charIndex, charLength: e.charLength ?? 0 })
  }

  const startEstimate = () => {
    if (gotBoundary || timer || !words.length) return
    const cps = loadCps(voiceName) * (rate || 1)
    // 語ごとの「ここまでに終わっているはず」の時刻。配り方は MP3 と同じ
    const marks = wordMarks(text ?? utterance.text ?? '', (totalWeight(words) / cps) * 1000)
    let index = -1
    timer = window.setInterval(() => {
      const next = markIndexAt(marks, Date.now() - startedAt)
      if (next >= 0 && next !== index) {
        index = next
        onWord({ charIndex: marks[index].at, charLength: 0 })
      }
    }, 60)
  }

  utterance.onstart = () => {
    startedAt = Date.now()
    // 合図が来る端末なら、この間に来る。来なければ見積もりに切り替える
    window.setTimeout(startEstimate, 350)
  }

  const finish = () => {
    stopTimer()
    // 実際にかかった時間から、この声の速さを覚える。次からはこれを使う
    const spent = (Date.now() - startedAt) / 1000
    const chars = totalWeight(words)
    if (startedAt && spent > 0.5 && chars > 0) {
      saveCps(voiceName, chars / spent / (rate || 1))
    }
  }
  utterance.addEventListener?.('end', finish)
  utterance.addEventListener?.('error', finish)

  return stopTimer
}

/**
 * 英文を読み上げる。
 * @param {string} text 読み上げる英文
 * @param {object} options { voice, rate }
 */
export function speak(text, { voice, rate = 0.9, onWord } = {}) {
  if (!isSpeechSupported()) return false
  window.speechSynthesis.cancel() // 前の読み上げが残っていたら止める
  const utterance = new SpeechSynthesisUtterance(text)
  attachWordTracking(utterance, onWord, { text, rate, voiceName: voice?.name })
  utterance.lang = voice?.lang || 'en-US'
  // 声の指定が拒否される場合がある。失敗しても読み上げ自体は続けたいので、
  // ここで握りつぶして端末の既定の声に任せる。
  try {
    if (voice) utterance.voice = voice
  } catch (err) {
    console.warn('指定された声を使えないため、端末の既定の声で読み上げます。', err)
  }
  utterance.rate = rate
  utterance.pitch = 1
  utterance.volume = 1
  window.speechSynthesis.speak(utterance)
  return true
}

/**
 * 英文を1本だけ読み上げ、**読み終わるまで待てる**形にしたもの。
 *
 * 【なぜ要るか】
 *   会話は話す人ごとに声を変えるため、1本にまとめて読ませられない
 *   (`speak()` は前の読み上げを止めてしまう)。1つ終わったら次を始める。
 *   その「順に」の面倒は `readAloud.js` が見るので、
 *   ここは **1本ぶんの約束(Promise)**だけを返す。
 *
 * 【気をつけたこと】
 *   読み終わりの合図(onend)は端末によって来ないことがある。
 *   来なかったときに**そこで止まってしまう**ので、語数から見積もった
 *   時間で先へ進む保険を入れてある。
 *
 * @returns {{done: Promise<void>, stop: Function}}
 */
export function speakOnce(text, { voice, rate = 0.9, onWord } = {}) {
  if (!isSpeechSupported() || !String(text ?? '').trim()) {
    return { done: Promise.resolve(), stop: () => {} }
  }

  let settle = () => {}
  const done = new Promise((resolve) => { settle = resolve })

  const utterance = new SpeechSynthesisUtterance(text)
  const stopWords = attachWordTracking(utterance, onWord, {
    text, rate, voiceName: voice?.name,
  })
  utterance.lang = voice?.lang || 'en-US'
  // 声の指定が拒否される場合がある。失敗しても読み上げ自体は続けたい
  try {
    if (voice) utterance.voice = voice
  } catch (err) {
    console.warn('指定された声を使えないため、端末の既定の声で読み上げます。', err)
  }
  utterance.rate = rate
  utterance.pitch = 1
  utterance.volume = 1

  let finished = false
  let timer = null
  const finish = () => {
    if (finished) return
    finished = true
    if (timer) { window.clearTimeout(timer); timer = null }
    stopWords()
    settle()
  }
  utterance.onend = finish
  utterance.onerror = finish
  // 合図が来なかったときの保険。見積もりの2倍 + 2秒で先へ進む
  const words = String(text).split(/\s+/).length
  timer = window.setTimeout(finish, (Math.max(2, words / 2.2) * 2 + 2) * 1000)

  window.speechSynthesis.speak(utterance)

  return {
    done,
    stop: () => { finish(); window.speechSynthesis.cancel() },
  }
}

/** 中断はエラーではない。別の声を押した、画面を離れた等で起きる。 */
export function isBenignSpeechError(error) {
  return error === 'canceled' || error === 'interrupted'
}

/** 読み上げを止める */
export function stopSpeaking() {
  if (isSpeechSupported()) window.speechSynthesis.cancel()
}

/**
 * ===================================================================
 *  マイク録音 — Web Audio 方式
 * ===================================================================
 *
 * ★なぜ MediaRecorder を使わないのか(実機 iOS 18.7 Safari で確認)
 *
 *   iOS Safari では MediaRecorder が2回目以降まともに動かない。
 *     - 新しい MediaRecorder を作り直す方式 → 2回目が失敗
 *     - 同じ MediaRecorder を start() し直す方式 → 音声が空(5バイト)になる
 *
 *   そこで MediaRecorder を使わず、Web Audio API で生の音声を自分で集め、
 *   WAV 形式に組み立てる方式に変更した。この方式には利点が多い。
 *
 *     - iOS を含む全ブラウザで同じように動く
 *     - 出来上がる形式が常に WAV。端末ごとに webm / mp4 と分かれない
 *     - 発音評価サービスは WAV をそのまま受け取れるものが多い
 *     - 16kHz に落として送るため、通信量も小さい
 */

const TARGET_SAMPLE_RATE = 16000 // 音声認識・発音評価が扱いやすい標準的な値

/**
 * ★AudioContext は1つだけ作って使い回す(実機 iOS 18.7 で判明)
 *
 *   録音のたびに新しい AudioContext を作り、終わったら close() する実装では、
 *   iOS Safari で2回目以降の録音が**すべて無音**になった。
 *   エラーは出ず、音量0の音声が返ってくるため気づきにくい。
 *
 *     録音1回目: 音量=100% サイズ=131116B   ← 成功
 *     録音2回目: 無音 音量=0.000
 *     録音3回目: 無音 音量=0.000
 *
 *   さらに、そのあと音声認識まで aborted で失敗するようになった。
 *   iOS では音声の入出力が端末全体で1つの資源として扱われており、
 *   AudioContext を作っては壊すとその資源が壊れるためと考えられる。
 *
 *   対処: AudioContext はページに1つだけ作り、close() しない。
 *         録音していない間は suspend() して、音声認識に資源を明け渡す。
 */
let audioContext = null

/** 使い回す AudioContext を取り出す(無ければ作る) */
function getAudioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext
  if (!AudioContextClass) return null
  if (!audioContext || audioContext.state === 'closed') {
    audioContext = new AudioContextClass()
  }
  return audioContext
}

/**
 * ★マイクへの接続も1組だけ作って使い回す(実機 iOS 18.7 で判明)
 *
 *   AudioContext を使い回すようにしても、録音のたびに
 *   getUserMedia と createMediaStreamSource をやり直していると、
 *   数回〜十数回で**エラーを出さないまま無音になる**。
 *
 *     1周目の録音7回: すべて成功(音量83〜100%)
 *     音声認識6回: すべて成功
 *     2周目の録音: 2回成功したあと、3回目から音量0
 *
 *   iOS は音声入力の経路を端末全体で持っており、
 *   接続部品を作っては捨てると経路が壊れると考えられる。
 *
 *   対処: マイクと接続部品は最初の1回だけ作り、そのまま保持する。
 *         録音の開始・停止は「音を集めるかどうか」の切り替えだけで行う。
 *
 * ★引き換えに、練習中はマイクを掴んだままになる
 *   端末の録音マークが出続けるため、練習画面を離れるときは
 *   releaseMicrophone() を必ず呼ぶこと。
 *   また音声認識を使う前にも、releaseMicrophone() で明け渡すこと。
 */
let micStream = null
let sourceNode = null
let processorNode = null
let silenceNode = null

/** 録音中に音を集める入れ物。null なら録音していない。 */
let collector = null

/**
 * ★マイクの機器が入れ替わったら、接続を作り直す(実機の報告より)
 *
 *   接続を保持する設計にしたため、練習の途中で
 *   Bluetooth のイヤホンを繋いだ・外した・接続が切れた場合に、
 *   すでに存在しない機器を掴んだままになる。
 *   その結果、無音になったり音量が極端に小さくなったりする。
 *
 *   英語学習では Bluetooth のイヤホンを使う人が多いと想定されるため、
 *   機器の入れ替わりを検知して、次の録音で接続を作り直す。
 */
let graphIsStale = false

if (typeof navigator !== 'undefined' && navigator.mediaDevices?.addEventListener) {
  navigator.mediaDevices.addEventListener('devicechange', () => {
    if (collector) {
      // 録音中は中断させたくないので、印だけ付けて次回に作り直す
      graphIsStale = true
    } else {
      teardownAudioGraph()
    }
  })
}

/** いま使っているマイクの名前(画面に出して、機器の取り違えに気づけるようにする) */
export function currentMicLabel() {
  const track = micStream?.getAudioTracks?.()[0]
  return track?.label || ''
}

/** マイクへの接続を組み立てる(すでにあれば何もしない) */
async function ensureAudioGraph() {
  const context = getAudioContext()
  if (!context) throw new Error('このブラウザは音声処理に対応していません。')

  // iOS では利用者の操作のあとに resume しないと音が取れない
  if (context.state !== 'running') {
    try {
      await context.resume()
    } catch {
      /* resume できなくても続行を試みる */
    }
  }

  const graphIsAlive =
    !graphIsStale &&
    micStream && micStream.active && micStream.getAudioTracks().some((t) => t.readyState === 'live') && sourceNode && processorNode

  if (graphIsAlive) return context

  teardownAudioGraph()

  micStream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  })

  sourceNode = context.createMediaStreamSource(micStream)
  processorNode = context.createScriptProcessor(4096, 1, 1)

  // 音量ゼロの出口につなぐ。
  // 出口につながないと処理が動かないブラウザがある一方、
  // そのままスピーカーにつなぐと自分の声が返ってハウリングするため。
  silenceNode = context.createGain()
  silenceNode.gain.value = 0

  processorNode.onaudioprocess = (event) => {
    if (!collector) return // 録音していない間は捨てる
    const input = event.inputBuffer.getChannelData(0)
    collector.buffers.push(new Float32Array(input))
    collector.total += input.length
  }

  sourceNode.connect(processorNode)
  processorNode.connect(silenceNode)
  silenceNode.connect(context.destination)
  graphIsStale = false

  return context
}

/** マイクへの接続を解体する */
function teardownAudioGraph() {
  if (processorNode) processorNode.onaudioprocess = null
  try {
    if (sourceNode) sourceNode.disconnect()
    if (processorNode) processorNode.disconnect()
    if (silenceNode) silenceNode.disconnect()
  } catch {
    /* すでに切れていれば何もしない */
  }
  if (micStream) micStream.getTracks().forEach((track) => track.stop())
  sourceNode = null
  processorNode = null
  silenceNode = null
  micStream = null
  collector = null
  graphIsStale = false
}

/**
 * 音声処理を休止する。
 *
 * ★音声認識を始める前に必ず呼ぶこと。
 *   録音のあとに休止せずに音声認識を始めると、iOS では
 *   aborted / audio-capture で失敗する(実機で確認)。
 */
export async function suspendAudio() {
  if (audioContext && audioContext.state === 'running') {
    try {
      await audioContext.suspend()
    } catch {
      /* 休止できなくても処理は続ける */
    }
  }
}

/**
 * マイクを完全に手放す。
 *
 * ★次の場面で必ず呼ぶこと。
 *   - 練習画面を離れるとき(録音マークが出続けるため)
 *   - 音声認識を始める前(掴んだままだと iOS で失敗するため)
 */
export function releaseMicrophone() {
  teardownAudioGraph()
  suspendAudio()
}

/** 集めた音声の断片を1本につなぐ */
function mergeBuffers(buffers, totalLength) {
  const result = new Float32Array(totalLength)
  let offset = 0
  for (const buffer of buffers) {
    result.set(buffer, offset)
    offset += buffer.length
  }
  return result
}

/** 標本化周波数を落とす(48kHz → 16kHz など)。単純な線形補間で十分。 */
function downsample(samples, fromRate, toRate) {
  if (toRate >= fromRate) return samples
  const ratio = fromRate / toRate
  const newLength = Math.round(samples.length / ratio)
  const result = new Float32Array(newLength)
  for (let i = 0; i < newLength; i += 1) {
    const position = i * ratio
    const index = Math.floor(position)
    const fraction = position - index
    const a = samples[index] ?? 0
    const b = samples[index + 1] ?? a
    result[i] = a + (b - a) * fraction
  }
  return result
}

/** 音声データを WAV ファイルの形に組み立てる(16bit モノラル) */
function encodeWav(samples, sampleRate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)

  const writeText = (offset, text) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i))
  }

  writeText(0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  writeText(8, 'WAVE')
  writeText(12, 'fmt ')
  view.setUint32(16, 16, true) // fmt チャンクの長さ
  view.setUint16(20, 1, true) // 1 = 圧縮なし(PCM)
  view.setUint16(22, 1, true) // モノラル
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true) // 1秒あたりのバイト数
  view.setUint16(32, 2, true) // 1標本あたりのバイト数
  view.setUint16(34, 16, true) // 16bit
  writeText(36, 'data')
  view.setUint32(40, samples.length * 2, true)

  // -1.0〜1.0 の値を 16bit の整数に変換する
  let offset = 44
  for (let i = 0; i < samples.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true)
    offset += 2
  }

  return new Blob([view], { type: 'audio/wav' })
}

/**
 * 音の大きさを測る。
 *
 * ★最大音量だけで判定してはいけない(実機の報告より)
 *   当初は最大音量が1%未満なら「無音」としていたが、
 *   Bluetooth のマイクは音量が小さくなりやすく、
 *   耳では聞こえていて音声認識も通る音声を
 *   「無音」と誤判定してしまう恐れがあった。
 *
 *   また最大音量だけを見ると、雑音が一瞬入っただけで
 *   「音がある」と誤判定してしまう。
 *
 *   そこで、最大音量(peak)と平均的な音量(rms)の両方を見る。
 *     - 本当に無音: peak も rms も極端に小さい
 *     - 小さいが有効: rms は小さいが、peak との差がある(声の抑揚)
 */
function measureLevel(samples) {
  let peak = 0
  let sumOfSquares = 0
  for (let i = 0; i < samples.length; i += 1) {
    const value = samples[i]
    const magnitude = Math.abs(value)
    if (magnitude > peak) peak = magnitude
    sumOfSquares += value * value
  }
  const rms = samples.length ? Math.sqrt(sumOfSquares / samples.length) : 0
  return { peak: peak > 1 ? 1 : peak, rms: rms > 1 ? 1 : rms }
}

/** 本当に何も録れていないか。ここを厳しくしすぎると、小声の録音を弾いてしまう。 */
function isTrulySilent({ peak, rms }) {
  return peak < 0.005 && rms < 0.002
}

/** 録れてはいるが小さい。採点はするが、利用者に知らせる。 */
function isQuietLevel({ peak, rms }) {
  return !isTrulySilent({ peak, rms }) && (peak < 0.08 || rms < 0.01)
}

/**
 * マイク録音を開始する。
 *
 * 戻り値は { stop, cancel }。
 * stop() を呼ぶと録音が止まり、WAV 形式の音声データが返ってきます。
 *
 * ★録音した音声はサーバーに送りません(仕様書 3.2)。
 */
export async function startRecording() {
  if (!isRecordingSupported()) {
    throw new Error('このブラウザは録音に対応していません。')
  }

  const context = await ensureAudioGraph()
  const sampleRate = context.sampleRate

  // 音を集め始める。接続はそのまま使い回す。
  const myCollector = { buffers: [], total: 0 }
  collector = myCollector

  let finished = false

  const finish = () => {
    finished = true
    if (collector === myCollector) collector = null
  }

  return {
    /** 録音を止め、WAV の音声データを返す。二重に呼ばれても安全。 */
    async stop() {
      if (finished) throw new Error('この録音はすでに終了しています。')
      finish()

      const deviceLabel = currentMicLabel()
      const merged = mergeBuffers(myCollector.buffers, myCollector.total)
      const resampled = downsample(merged, sampleRate, TARGET_SAMPLE_RATE)
      const level = measureLevel(resampled)
      const silent = isTrulySilent(level)

      // 本当に無音だった場合は、マイクへの接続が壊れている可能性がある。
      // 次の録音で作り直せるよう、ここで解体しておく。
      if (silent) teardownAudioGraph()

      const blob = encodeWav(resampled, TARGET_SAMPLE_RATE)
      return {
        blob,
        url: URL.createObjectURL(blob),
        mimeType: 'audio/wav',
        durationSeconds: resampled.length / TARGET_SAMPLE_RATE,
        peakLevel: level.peak,
        rmsLevel: level.rms,
        isSilent: silent,
        // 録れてはいるが小さい。Bluetooth 機器では起きやすい。
        isQuiet: isQuietLevel(level),
        deviceLabel,
      }
    },

    /** 録音を破棄する(保存せずにやめる場合) */
    cancel() {
      if (finished) return
      finish()
    },
  }
}
