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

/** 学習用として明らかに不適切な声(macOS のネタ声)。一覧から除外する。 */
const NOVELTY_VOICES = [
  'albert', 'bad news', 'bahh', 'bells', 'boing', 'bubbles', 'cellos', 'deranged',
  'good news', 'hysterical', 'jester', 'organ', 'pipe organ', 'trinoids',
  'whisper', 'wobble', 'zarvox', 'superstar', 'princess',
]

/** Apple の標準的な英語話者。ネタ声ではなく、お手本として使える。 */
const APPLE_STANDARD = [
  'samantha', 'ava', 'allison', 'susan', 'nicky', 'aaron', 'tom',
  'serena', 'daniel', 'kate', 'oliver', 'karen', 'moira', 'tessa', 'rishi',
]

/** 学習用には向かない、癖の強い声。使えるが優先しない。 */
const LOW_PRIORITY = ['grandma', 'grandpa', 'rocko', 'sandy', 'shelley', 'eddy', 'flo', 'reed', 'junior', 'kathy', 'fred', 'ralph', 'agnes', 'vicki', 'victoria', 'bruce']

/**
 * 声の品質を点数で評価する。数字が大きいほど良い。
 * 端末によって入っている声が違うため、名前から推定するしかない。
 */
function scoreVoice(voice) {
  const name = (voice.name || '').toLowerCase()
  let score = 0

  // 各社の高品質版。名前に品質を示す語が入っている
  if (name.includes('premium')) score += 100
  if (name.includes('enhanced')) score += 90
  if (name.includes('neural') || name.includes('natural')) score += 90
  if (name.includes('siri')) score += 80

  // 提供元による傾向
  if (name.startsWith('google')) score += 70
  if (APPLE_STANDARD.some((n) => name.startsWith(n))) score += 60
  if (name.startsWith('microsoft')) score += 50

  // 通信を使う声は、端末内蔵の簡易な声より品質が高いことが多い
  if (voice.localService === false) score += 20

  // 簡易版・癖の強い声は下げる
  if (name.includes('compact')) score -= 60
  if (LOW_PRIORITY.some((n) => name.startsWith(n))) score -= 50

  // 端末の既定の声は、わずかに優遇する
  if (voice.default) score += 5

  return score
}

/** 品質の目安を日本語のラベルにする(画面に出すため) */
export function voiceQualityLabel(voice) {
  const score = scoreVoice(voice)
  if (score >= 80) return '高品質'
  if (score >= 50) return '標準'
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

    const pickEnglish = (voices) =>
      voices
        .filter((v) => v.lang && v.lang.toLowerCase().startsWith('en'))
        .filter((v) => !NOVELTY_VOICES.some((n) => (v.name || '').toLowerCase().startsWith(n)))
        .sort((a, b) => scoreVoice(b) - scoreVoice(a))

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
  return voices.some((v) => scoreVoice(v) >= 50)
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
 * マイク録音を開始する。
 *
 * 戻り値は { stop } というオブジェクト。
 * stop() を呼ぶと録音が止まり、音声データ(Blob)の URL が返ってきます。
 *
 * ★仕様書 3.2 の方針どおり、録音した音声はサーバーに送りません。
 *   ブラウザのメモリ上に置くだけで、ページを閉じれば消えます。
 */
export async function startRecording() {
  if (!isRecordingSupported()) {
    throw new Error('このブラウザは録音に対応していません。')
  }

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

  // 録音の形式はブラウザによって異なる。
  //   Chrome / Edge / Firefox → audio/webm
  //   iOS Safari             → audio/mp4
  // 対応している形式を順に試し、どれも指定できなければブラウザ既定に任せる。
  // (形式を決め打ちすると、対応していないブラウザで録音開始に失敗する)
  const preferred = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']
  const supported =
    typeof MediaRecorder.isTypeSupported === 'function'
      ? preferred.find((type) => MediaRecorder.isTypeSupported(type))
      : undefined

  // マイクを解放する。録音の成否にかかわらず必ず呼ぶ。
  // 解放し忘れると、ブラウザの録音マークが消えないうえ、
  // iOS Safari では次の録音が開始できなくなる。
  const releaseMic = () => {
    stream.getTracks().forEach((track) => track.stop())
  }

  let recorder
  try {
    recorder = supported ? new MediaRecorder(stream, { mimeType: supported }) : new MediaRecorder(stream)
  } catch (err) {
    // 形式の指定が拒否された場合は、指定なしでもう一度試す
    console.warn('録音形式の指定に失敗したため、ブラウザ既定の形式で録音します。', err)
    try {
      recorder = new MediaRecorder(stream)
    } catch (err2) {
      releaseMic() // ここで解放しないとマイクが掴まれたままになる
      throw err2
    }
  }

  const chunks = []
  const mimeType = recorder.mimeType || supported || 'audio/webm'
  let finished = false

  recorder.addEventListener('dataavailable', (event) => {
    if (event.data.size > 0) chunks.push(event.data)
  })

  try {
    recorder.start()
  } catch (err) {
    releaseMic()
    throw err
  }

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
            releaseMic()
            const blob = new Blob(chunks, { type: mimeType })
            resolve({ blob, url: URL.createObjectURL(blob), mimeType })
          },
          { once: true },
        )

        try {
          recorder.stop()
        } catch (err) {
          releaseMic()
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
      releaseMic()
    },
  }
}
