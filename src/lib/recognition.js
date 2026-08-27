/**
 * 音声認識(話した英語を文字にする)。
 *
 * シャドーイングやリピーティングで、**言えたつもりで言えていない**箇所を
 * 見つけるために使う。点数ではなく「どの語が抜けたか・違ったか」を出す。
 *
 * ★ここは実機で何度も失敗した箇所である(CLAUDE.md にも記録がある)。
 *   繰り返さないための決まりごと:
 *
 *   1. **音声認識を始める前に、マイクを完全に手放す。**
 *      録音で掴んだままだと iOS では aborted / audio-capture で失敗する
 *   2. **確定(isFinal)が来なくても、認識できていれば採用する。**
 *      iOS は確定の合図を返さないことがあり、待つと
 *      「認識されませんでした」になってしまう
 *   3. **止めるときは abort() ではなく stop()。**
 *      abort() はここまでの認識結果を捨ててしまう
 *
 *   iOS では、どのブラウザも中身は Safari(WebKit)である。
 *   「Chrome を使えば回避できる」という手は存在しない。
 */
import { releaseMicrophone } from './speech.js'

const SR = typeof window !== 'undefined'
  ? (window.SpeechRecognition || window.webkitSpeechRecognition)
  : null

/** この端末で音声認識が使えるか */
export const isRecognitionSupported = () => !!SR

const ERROR_JA = {
  'no-speech': '声が聞き取れませんでした。もう一度、はっきりお願いします。',
  'audio-capture': 'マイクを使えませんでした。他のアプリがマイクを使っていないか確認してください。',
  'not-allowed': 'マイクの使用が許可されていません。ブラウザの設定をご確認ください。',
  'network': '通信できませんでした。電波の良いところでお試しください。',
  'service-not-allowed': 'この環境では音声認識が使えません。',
  'aborted': '認識が中断されました。',
}

/**
 * 話した内容を文字にする。
 *
 * @returns {{ stop: () => void, done: Promise<{text: string, confident: boolean}> }}
 *   stop() を呼ぶと確定を待って終わる。done は結果を返す。
 *   失敗した場合は done が reject し、日本語の理由が入る。
 */
export function startRecognition({ lang = 'en-US' } = {}) {
  if (!SR) {
    return {
      stop() {},
      done: Promise.reject(new Error('この端末・ブラウザは音声認識に対応していません。')),
    }
  }

  // ★掴んだままだと iOS で失敗する。認識の前に必ず手放す。
  releaseMicrophone()

  const recognition = new SR()
  recognition.lang = lang
  recognition.interimResults = true
  recognition.continuous = true
  recognition.maxAlternatives = 1

  let settled = false
  let final = ''
  let interim = ''
  let failure = null
  let resolveDone
  let rejectDone

  const done = new Promise((resolve, reject) => {
    resolveDone = resolve
    rejectDone = reject
  })

  recognition.onresult = (event) => {
    let running = ''
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const text = event.results[i][0].transcript
      if (event.results[i].isFinal) final += text
      else running += text
    }
    if (running) interim = running
  }

  recognition.onerror = (event) => {
    // 声が無かっただけなら、ここまでの結果で続ける
    if (event.error === 'no-speech' && (final || interim)) return
    failure = ERROR_JA[event.error] ?? `音声認識に失敗しました(${event.error})`
  }

  recognition.onend = () => {
    if (settled) return
    settled = true
    // ★確定が来ていなくても、認識できていればそれを採用する
    const text = (final || interim).trim()
    if (text) resolveDone({ text, confident: !!final })
    else rejectDone(new Error(failure ?? '何も聞き取れませんでした。'))
  }

  try {
    recognition.start()
  } catch (e) {
    settled = true
    rejectDone(new Error(`音声認識を始められませんでした(${e?.name ?? '原因不明'})`))
  }

  return {
    // stop() は「ここまでで確定して」の合図。abort() だと結果を捨ててしまう
    stop() { try { recognition.stop() } catch { /* すでに止まっていれば何もしない */ } },
    done,
  }
}
