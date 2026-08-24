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
 * 使える英語の声の一覧を取得する。
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

    const pickEnglish = (voices) => voices.filter((v) => v.lang && v.lang.toLowerCase().startsWith('en'))

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
 * 英文を読み上げる。
 * @param {string} text 読み上げる英文
 * @param {object} options { voice, rate }
 */
export function speak(text, { voice, rate = 0.9 } = {}) {
  if (!isSpeechSupported()) return false
  window.speechSynthesis.cancel() // 前の読み上げが残っていたら止める
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = voice?.lang || 'en-US'
  if (voice) utterance.voice = voice
  utterance.rate = rate
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
  const recorder = new MediaRecorder(stream)
  const chunks = []

  recorder.addEventListener('dataavailable', (event) => {
    if (event.data.size > 0) chunks.push(event.data)
  })
  recorder.start()

  return {
    stop() {
      return new Promise((resolve) => {
        recorder.addEventListener(
          'stop',
          () => {
            // マイクを解放する(これを忘れるとブラウザの録音マークが消えません)
            stream.getTracks().forEach((track) => track.stop())
            const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' })
            resolve({ blob, url: URL.createObjectURL(blob), durationHint: chunks.length })
          },
          { once: true },
        )
        recorder.stop()
      })
    },
  }
}
