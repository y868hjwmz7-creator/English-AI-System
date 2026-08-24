/**
 * 音声まわり(お手本の読み上げ / マイク録音)をまとめた場所。
 *
 * ★仕様書 5.2 の制約について
 *   お手本音声はブラウザに内蔵されている読み上げ機能(Web Speech API)を使っています。
 *   そのため、どんな声で読まれるかは「利用者の端末とブラウザ」に依存します。
 *   同じコードでも Windows / Mac / iPhone / Android で声が変わり、
 *   アメリカ英語・イギリス英語を確実に指定することはできません。
 *   本番で音声品質を揃えたい場合は、外部の音声合成サービスに切り替える必要があります。
 */

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
 *      → 名前と言語で重複を取り除く。
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

/** 品質の目安を日本語のラベルにする(画面に出すため) */
export function voiceQualityLabel(voice) {
  const both = ((voice.name || '') + ' ' + (voice.voiceURI || '')).toLowerCase()
  if (both.includes('premium') || both.includes('enhanced') || both.includes('neural') || both.includes('natural')) {
    return '高品質'
  }
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
      return voices
        .filter((v) => v.lang && v.lang.toLowerCase().startsWith('en'))
        .filter((v) => !isNoveltyVoice(v))
        .filter((v) => {
          // 同じ声が二重に現れる端末があるため、重複を取り除く
          const key = `${v.name}|${v.lang}`
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
        .sort((a, b) => scoreVoice(b) - scoreVoice(a))
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
 * 英文を読み上げる。
 * @param {string} text 読み上げる英文
 * @param {object} options { voice, rate }
 */
export function speak(text, { voice, rate = 0.9 } = {}) {
  if (!isSpeechSupported()) return false
  window.speechSynthesis.cancel() // 前の読み上げが残っていたら止める
  const utterance = new SpeechSynthesisUtterance(text)
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
 *
 * ★録音のたびにマイクを完全に解放する
 *   マイクを掴んだままにすると、iOS では音声認識が
 *   「aborted」で失敗する(実機で確認)。録音が終わったら必ず手放す。
 */

const TARGET_SAMPLE_RATE = 16000 // 音声認識・発音評価が扱いやすい標準的な値

/** 互換性のために残している。現在は録音のたびに解放しているため、通常は不要。 */
export function releaseMicrophone() {
  /* 各録音が自分で後始末するため、ここですることはない */
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

/** 音の大きさ(0〜1)。無音のまま録音していないかの判定に使う。 */
function peakLevel(samples) {
  let peak = 0
  for (let i = 0; i < samples.length; i += 1) {
    const value = Math.abs(samples[i])
    if (value > peak) peak = value
  }
  return peak
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

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  })

  const AudioContextClass = window.AudioContext || window.webkitAudioContext
  if (!AudioContextClass) {
    stream.getTracks().forEach((track) => track.stop())
    throw new Error('このブラウザは音声処理に対応していません。')
  }

  const context = new AudioContextClass()
  // iOS では利用者の操作のあとに resume しないと音が取れない
  if (context.state === 'suspended') {
    try {
      await context.resume()
    } catch {
      /* resume できなくても続行を試みる */
    }
  }

  const source = context.createMediaStreamSource(stream)
  const processor = context.createScriptProcessor(4096, 1, 1)

  // 音量ゼロの出口につなぐ。
  // 出口につながないと処理が動かないブラウザがある一方、
  // そのままスピーカーにつなぐと自分の声が返ってハウリングするため。
  const silence = context.createGain()
  silence.gain.value = 0

  const buffers = []
  let totalLength = 0

  processor.onaudioprocess = (event) => {
    const input = event.inputBuffer.getChannelData(0)
    buffers.push(new Float32Array(input))
    totalLength += input.length
  }

  source.connect(processor)
  processor.connect(silence)
  silence.connect(context.destination)

  let finished = false

  /** マイクと音声処理を完全に解放する */
  const cleanup = () => {
    processor.onaudioprocess = null
    try {
      source.disconnect()
      processor.disconnect()
      silence.disconnect()
    } catch {
      /* すでに切れていれば何もしない */
    }
    stream.getTracks().forEach((track) => track.stop())
    if (context.state !== 'closed') context.close().catch(() => {})
  }

  return {
    /** 録音を止め、WAV の音声データを返す。二重に呼ばれても安全。 */
    async stop() {
      if (finished) throw new Error('この録音はすでに終了しています。')
      finished = true

      const sourceRate = context.sampleRate
      cleanup()

      const merged = mergeBuffers(buffers, totalLength)
      const resampled = downsample(merged, sourceRate, TARGET_SAMPLE_RATE)
      const blob = encodeWav(resampled, TARGET_SAMPLE_RATE)

      return {
        blob,
        url: URL.createObjectURL(blob),
        mimeType: 'audio/wav',
        durationSeconds: resampled.length / TARGET_SAMPLE_RATE,
        peakLevel: peakLevel(resampled), // 無音だったかの判定に使う
      }
    },

    /** 録音を破棄する(保存せずにやめる場合) */
    cancel() {
      if (finished) return
      finished = true
      cleanup()
    },
  }
}
