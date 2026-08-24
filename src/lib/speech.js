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

/** 読み上げを止める */
export function stopSpeaking() {
  if (isSpeechSupported()) window.speechSynthesis.cancel()
}

/**
 * ===================================================================
 *  マイク録音
 * ===================================================================
 *
 * ★iOS Safari の制約について(実機で判明)
 *
 *   当初は「録音のたびにマイクを取り直す」実装にしたが、
 *   iOS Safari では2回目以降が依然として失敗した。
 *
 *   より確からしい原因は、**同じページで2つ目の MediaRecorder を
 *   作ること**そのものが失敗する点にある。
 *   そこで、いったん作った録音器とマイクをそのまま保持し、
 *   2回目以降は同じ録音器を start() し直す方式に変更した。
 *
 *   万一この方式が使えない環境のために、順に別の方法を試す。
 *     方法1: 既存の録音器を start() し直す(iOS 向けの本命)
 *     方法2: 生きているマイクに新しい録音器を作る
 *     方法3: マイクを取り直して新しい録音器を作る
 *
 *   どの方法で成功したかは lastRecordingStrategy に記録し、
 *   診断ページで確認できるようにしている。
 *
 * ★マイクの解放
 *   上記の方式では、練習中はマイクを掴んだままになる。
 *   録り直しのたびに許可の確認が挟まらない利点がある一方、
 *   録音マークが出続けるため、練習画面を離れるときに
 *   releaseMicrophone() で必ず解放すること。
 */

let sharedStream = null
let sharedRecorder = null
let sharedMimeType = ''

/** どの方法で録音を開始できたか(診断用) */
export let lastRecordingStrategy = ''

/** マイクが生きているか */
function streamIsLive(stream) {
  return !!stream && stream.active && stream.getAudioTracks().some((t) => t.readyState === 'live')
}

/** この端末が対応している録音形式を選ぶ */
function pickMimeType() {
  if (typeof MediaRecorder.isTypeSupported !== 'function') return ''
  const preferred = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']
  return preferred.find((type) => MediaRecorder.isTypeSupported(type)) || ''
}

/**
 * マイクを解放する。
 * 練習画面を離れるとき、アプリを閉じるときに必ず呼ぶこと。
 * 呼ばないと、ブラウザの録音マークが出続ける。
 */
export function releaseMicrophone() {
  try {
    if (sharedRecorder && sharedRecorder.state !== 'inactive') sharedRecorder.stop()
  } catch {
    /* すでに止まっていれば何もしない */
  }
  sharedRecorder = null
  if (sharedStream) sharedStream.getTracks().forEach((track) => track.stop())
  sharedStream = null
}

/**
 * マイク録音を開始する。
 *
 * 戻り値は { stop, cancel }。
 * stop() を呼ぶと録音が止まり、音声データが返ってきます。
 *
 * ★録音した音声はサーバーに送りません(仕様書 3.2)。
 */
export async function startRecording() {
  if (!isRecordingSupported()) {
    throw new Error('このブラウザは録音に対応していません。')
  }

  // マイクが死んでいたら取り直す。取り直した場合、録音器も作り直す。
  if (!streamIsLive(sharedStream)) {
    sharedStream = await navigator.mediaDevices.getUserMedia({ audio: true })
    sharedRecorder = null
  }

  const chunks = []
  const collect = (event) => {
    if (event.data && event.data.size > 0) chunks.push(event.data)
  }

  const makeRecorder = () => {
    const mimeType = pickMimeType()
    const rec = mimeType
      ? new MediaRecorder(sharedStream, { mimeType })
      : new MediaRecorder(sharedStream)
    sharedMimeType = rec.mimeType || mimeType || 'audio/webm'
    return rec
  }

  let started = false

  // 方法1: 既存の録音器を start() し直す(iOS Safari 向けの本命)
  if (sharedRecorder && sharedRecorder.state === 'inactive') {
    try {
      sharedRecorder.ondataavailable = collect
      sharedRecorder.start()
      started = true
      lastRecordingStrategy = '既存の録音器を再開'
    } catch (err) {
      console.warn('既存の録音器を再開できませんでした。', err)
      sharedRecorder = null
    }
  }

  // 方法2: 生きているマイクに新しい録音器を作る
  if (!started) {
    try {
      sharedRecorder = makeRecorder()
      sharedRecorder.ondataavailable = collect
      sharedRecorder.start()
      started = true
      lastRecordingStrategy = '新しい録音器を作成'
    } catch (err) {
      console.warn('新しい録音器を作れませんでした。マイクを取り直します。', err)
      sharedRecorder = null
    }
  }

  // 方法3: マイクごと取り直す
  if (!started) {
    if (sharedStream) sharedStream.getTracks().forEach((t) => t.stop())
    sharedStream = await navigator.mediaDevices.getUserMedia({ audio: true })
    try {
      sharedRecorder = makeRecorder()
      sharedRecorder.ondataavailable = collect
      sharedRecorder.start()
      lastRecordingStrategy = 'マイクを取り直して作成'
    } catch (err) {
      releaseMicrophone()
      throw err
    }
  }

  const recorder = sharedRecorder
  const mimeType = sharedMimeType
  let finished = false

  return {
    /** 録音を止め、音声データを返す。二重に呼ばれても安全。 */
    stop() {
      return new Promise((resolve, reject) => {
        if (finished) {
          reject(new Error('この録音はすでに終了しています。'))
          return
        }
        finished = true

        recorder.addEventListener(
          'stop',
          () => {
            // ここでマイクは解放しない。次の録音で同じ録音器を使い回すため。
            // 練習画面を離れるときに releaseMicrophone() で解放する。
            const blob = new Blob(chunks, { type: mimeType })
            resolve({ blob, url: URL.createObjectURL(blob), mimeType, strategy: lastRecordingStrategy })
          },
          { once: true },
        )

        try {
          recorder.stop()
        } catch (err) {
          reject(err)
        }
      })
    },

    /** 録音を破棄する(保存せずにやめる場合) */
    cancel() {
      if (finished) return
      finished = true
      try {
        if (recorder.state !== 'inactive') recorder.stop()
      } catch {
        /* すでに止まっていれば何もしない */
      }
    },
  }
}
