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
