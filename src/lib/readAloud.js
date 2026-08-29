/**
 * 英文を読み上げる。**画面はここだけを呼ぶ。**
 *
 * ============================================================================
 * 【なぜ振り分ける場所を作ったか】(2026-08 実機の報告)
 *
 *   知り合いの iPhone で、開発中のリンクを Google Chrome で開いてもらったら、
 *   こちらで聞こえる声とはまるで違う、ひどい声が出た。
 *
 *   これは不具合ではない。**iOS では、すべてのブラウザの中身が
 *   Safari(WebKit)である。**「Chrome を使えば回避できる」という手は
 *   存在しない。そして **iOS は高品質な声を Web Speech API に一切公開しない**
 *   (実機で生 47 件を確認し、premium は 0 件)。
 *
 *   端末の声に頼るかぎり、iPhone のゲストには良い音を届けられない。
 *   そこで教材の英文は **こちらで作った MP3 を配る**形に変えた。
 *
 * ============================================================================
 * 【2つの経路を、画面から見えなくする】
 *
 *   ① こちらで作った MP3(`audioClips.js`)… 全端末で同じ音。**こちらが本命**
 *   ② 端末の声(`speech.js`)… ①が無いとき・使えないときの受け皿
 *
 *   画面がどちらを使うか決めると、**判断が画面の数だけ増える。**
 *   英文が出る場所は4つある(宿題・本文の練習・レッスン表示・教材の中身)。
 *   4か所に同じ分岐を書けば、必ず食い違う。だからここ1つに置く。
 *
 *   ①が使えないのは、次のいずれかのとき。**どれも黙って②に落ちる。**
 *     ・Supabase を設定していない(手元での確認、1ファイル版)
 *     ・窓口(`speak` 関数)をまだ配置していない
 *     ・Azure の鍵をまだ入れていない
 *     ・その英文の音声がまだ無く、作るのに失敗した
 *
 *   **音声の失敗は画面に出さない。** 端末の声で読み上げられるので、
 *   利用者から見れば「これまでどおり」である。原因は
 *   `lastClipDetail()` に残してあり、係の人だけが見られる。
 *
 * ============================================================================
 * 【速さ】
 *   MP3 は**自然な速さで1本だけ**作ってある。遅く・速くするのは
 *   `playbackRate`。速さの段階ごとに作ると、費用も置き場所も5倍になる。
 */
import {
  DEFAULT_CLIP_VOICE, canUseClips, playClip, prefetchClip, stopClip,
} from './audioClips.js'
import { isSpeechSupported, speakOnce, stopSpeaking } from './speech.js'
import { clipSpeakerFor } from './voiceCast.js'

/** いまの読み上げ。あとから始まったものだけが有効 */
let session = 0

/** 読み上げを止める。**両方の経路を止める** */
export function stopReading() {
  session += 1
  stopClip()
  stopSpeaking()
}

/**
 * 読み上げる手段があるか(Listen のボタンを出すかどうか)。
 *
 * **端末の読み上げに対応していなくても、MP3 なら鳴らせる。**
 * `isSpeechSupported()` だけで判断すると、そういう端末でボタンが消える。
 */
export const canReadAloud = () => isSpeechSupported() || canUseClips()

/**
 * 英文を1本読み上げる。読み終わる(または止められる)まで待てる。
 *
 * @param {string} text 読み上げる英文
 * @param {object} o
 * @param {object} o.voice     端末の声(受け皿として使う)
 * @param {string} o.clipVoice MP3 の話者 id。省略時は端末の声から決める
 * @param {number} o.rate      速さの倍率
 * @param {Function} o.onWord  いま読んでいる語の位置({charIndex})
 * @returns {Promise<void>} 読み終わったら解決する
 */
export async function readAloud(text, {
  voice = null, clipVoice = null, rate = 0.9, onWord = null,
} = {}) {
  stopReading()
  const mine = session

  const played = await playClip({
    text,
    voiceId: clipVoice ?? clipSpeakerFor(voice),
    rate,
    onWord,
  })
  if (mine !== session) return          // 途中で止められた・別のものが始まった
  if (played) return

  // MP3 を使えなかった。端末の声に落ちる
  await speakOnce(text, { voice, rate, onWord }).done
  if (mine === session) onWord?.(null)
}

/**
 * 何本かの英文を、**順に**読み上げる。
 *
 * 会話は話す人ごとに声を変えるため、1本にまとめて読ませることができない。
 * 1つ終わったら次を始める。
 *
 * 【間をあけない】
 *   MP3 は1本ずつ取りに行くので、**鳴らしているあいだに次を用意する。**
 *   これが無いと、発言のたびに1秒ほど黙る。
 *
 * @param {Array<{text: string, voice?: object, clipVoice?: string}>} parts
 * @param {object} o { rate, onIndex, onWord } onIndex は再生中の番号(終わりで null)
 * @returns {Function} 止めるための関数
 */
export function readAloudSequence(parts, { rate = 0.9, onIndex, onWord } = {}) {
  const list = (parts ?? []).filter((p) => String(p?.text ?? '').trim())
  stopReading()
  const mine = session
  if (!list.length) return () => {}

  const alive = () => mine === session

  const run = async () => {
    for (let i = 0; i < list.length; i += 1) {
      if (!alive()) return
      const part = list[i]
      const clipVoice = part.clipVoice ?? clipSpeakerFor(part.voice)
      onIndex?.(i)

      const relay = onWord ? (at) => onWord(at ? { ...at, index: i } : null) : null

      const played = await playClip({
        text: part.text,
        voiceId: clipVoice,
        rate,
        onWord: relay,
        // 鳴り始めたら、次のぶんを裏で用意しておく
        onStart: () => {
          const ahead = list[i + 1]
          if (ahead) prefetchClip(ahead.text, ahead.clipVoice ?? clipSpeakerFor(ahead.voice))
        },
      })
      if (!alive()) return
      if (played) continue

      // この1本だけ MP3 を使えなかった。端末の声で読む
      await speakOnce(part.text, { voice: part.voice, rate, onWord: relay }).done
      if (!alive()) return
    }
    onIndex?.(null)
    onWord?.(null)
  }
  run()

  return () => {
    if (!alive()) return
    stopReading()
    onIndex?.(null)
    onWord?.(null)
  }
}

export { DEFAULT_CLIP_VOICE }
