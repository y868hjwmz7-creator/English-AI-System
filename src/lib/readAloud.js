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
import { STANDARD } from './voiceTier.js'
import { clipSpeakerFor } from './voiceCast.js'
import { speedPadMs, turnGapMs } from './turnGap.js'
import { voiceRateOf } from '../data/clipVoices.js'

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
 * @param {string} o.clipTier  声の段(`voiceTier.js`)。既定は標準の声
 * @param {number} o.rate      速さの倍率
 * @param {Function} o.onWord  いま読んでいる語の位置({charIndex})
 * @param {Function} o.onStart **実際に音が出た瞬間**に1回だけ呼ばれる
 * @returns {Promise<void>} 読み終わったら解決する
 *
 * 【`onStart` はなぜ要るか】(2026-09 利用者の指摘)
 *
 *   > Listen 全て(どこにあるものでも共通)において、
 *   > 1度目に押すと反応しないことが多いです。
 *
 *   その英文の MP3 がまだ無いと、押してから
 *   **窓口(`speak`)が作り終わるまでの数秒間、何の音もしない。**
 *   ボタンは「Stop」に変わっているだけなので、
 *   利用者には**押しても何も起きなかった**ようにしか見えない。
 *   そこでもう一度押すと、それが「止める」になって本当に鳴らない。
 *   2度目に押したときには MP3 が出来上がっているので、そこで初めて鳴る。
 *   これが「1度目は反応しない」の正体である。
 *
 *   **押した/鳴っているを、同じ見た目で終わらせない**(CLAUDE.md)。
 *   鳴り始めた瞬間をここから知らせ、ボタンが「用意しています…」を出せるようにする。
 */
export async function readAloud(text, {
  voice = null, clipVoice = null, clipTier = STANDARD, rate = 0.9,
  onWord = null, onStart = null,
} = {}) {
  stopReading()
  const mine = session

  // **1回しか呼ばない。** MP3 と端末の声で二度呼ぶと、
  // 受け取る側が「用意中 → 再生中 → 用意中」と行き来する
  let told = false
  const started = () => { if (!told && mine === session) { told = true; onStart?.() } }

  const played = await playClip({
    text,
    voiceId: clipVoice ?? clipSpeakerFor(voice),
    tier: clipTier,
    rate,
    onWord,
    onStart: started,
  })
  if (mine !== session) return          // 途中で止められた・別のものが始まった
  if (played) return

  // MP3 を使えなかった。端末の声に落ちる
  started()
  await speakOnce(text, { voice, rate, onWord }).done
  if (mine === session) onWord?.(null)
}

/**
 * 何本かの英文を、**順に**読み上げる。
 *
 * 会話は話す人ごとに声を変えるため、1本にまとめて読ませることができない。
 * 1つ終わったら次を始める。
 *
 * 【読み込みでは黙らせない】
 *   MP3 は1本ずつ取りに行くので、**鳴らしているあいだに次を用意する。**
 *   これが無いと、発言のたびに1秒ほど黙る。
 *
 * 【ただし、人が替わるときは間を置く】(2026-09 実機・利用者の指摘)
 *
 *   > 女性の発話が不自然なくらい早いタイミングで食い気味に入ってきます。
 *
 *   以前はここで**間を 0 ミリ秒**にしていた。読み込み待ちを嫌ったためだが、
 *   v3 の音声は前後の無音がほとんど無いので、**息継ぎも無しに次が来る。**
 *   どれだけの間を置くかは `turnGap.js` が内容から決める。**判断を2か所に置かない。**
 *
 *   **入れるのは声が替わるときだけ。** 同じ声が続くのは一人が話し続けて
 *   いるところで、記事の段落と段落のあいだも同じ声なので、**これまでのまま**である。
 *
 * @param {Array<{text: string, voice?: object, clipVoice?: string}>} parts
 * @param {object} o { rate, clipTier, onIndex, onWord, onStart }
 *                   onIndex は再生中の番号(終わりで null)。
 *                   onStart は**最初の1本が鳴り始めた瞬間**に1回
 *                   (`readAloud` の `onStart` と同じ理由。上を参照)
 * @returns {Function} 止めるための関数
 */
export function readAloudSequence(parts, {
  rate = 0.9, clipTier = STANDARD, onIndex, onWord, onStart,
} = {}) {
  const list = (parts ?? []).filter((p) => String(p?.text ?? '').trim())
  stopReading()
  const mine = session
  if (!list.length) return () => {}

  const alive = () => mine === session

  // **最初の1本が鳴った瞬間だけ知らせる。** 2本目からは待ち時間が無い
  // (`prefetchClip` で先に用意してある)ので、そのつど知らせる意味がない
  let told = false
  const started = () => { if (!told && alive()) { told = true; onStart?.() } }

  /**
   * 間を置く。**止められるようにする。**
   * まとめて待つと、Stop を押しても最大 1.4 秒黙って動かない。
   * 50 ミリ秒ずつに刻んで、そのつど生きているかを見る。
   */
  const pause = async (ms) => {
    const until = Date.now() + ms
    while (Date.now() < until) {
      if (!alive()) return
      await new Promise((r) => { setTimeout(r, Math.min(50, until - Date.now())) })
    }
  }

  const run = async () => {
    for (let i = 0; i < list.length; i += 1) {
      if (!alive()) return
      const part = list[i]
      const clipVoice = part.clipVoice ?? clipSpeakerFor(part.voice)

      // **どの継ぎ目にも間を置く**(2026-09 利用者の指定「記事でも同じ仕様に」)。
      // はじめは話す人が替わるときだけにしていたが、記事も段落と段落が
      // 詰まって聞こえる。同じ声が続くところは `turnGap.js` が短めに返す。
      if (i > 0) {
        const prevVoice = list[i - 1].clipVoice ?? clipSpeakerFor(list[i - 1].voice)
        const sameVoice = clipVoice === prevVoice

        // ① 内容から決める間。**速さに合わせて縮める**
        //    (120% で聞いている人には、間も 120% で来る)
        const byContent = turnGapMs(list[i - 1].text, part.text, { sameVoice }) / (rate || 1)

        /* ② 速くした声のぶんの余白(2026-09 利用者の指定)。
         *
         *   > 速くした分と同じだけ前後に余白を入れてください。
         *   > そしてその余白は内容とは別に必ず入れるようにしてください。
         *
         * **再生速度は、音声の中の無音まで一緒に縮める。** だから
         * 1.2 倍にした声のまわりだけ詰まって聞こえる。
         *
         * **①とは足し算にする。** 詰まっているのは音声そのものであって、
         * 話の中身とは関係がない。「相づちだから短く」と打ち消し合わせない。
         * **前の声のうしろ + 次の声の前**の両方を足す(あいだの無音は1つ)。 */
        const bySpeed = speedPadMs(voiceRateOf(prevVoice)) + speedPadMs(voiceRateOf(clipVoice))

        await pause(byContent + bySpeed)
        if (!alive()) return
      }

      onIndex?.(i)

      const relay = onWord ? (at) => onWord(at ? { ...at, index: i } : null) : null

      const played = await playClip({
        text: part.text,
        voiceId: clipVoice,
        tier: clipTier,
        rate,
        onWord: relay,
        // 鳴り始めたら、次のぶんを裏で用意しておく
        onStart: () => {
          started()
          const ahead = list[i + 1]
          if (ahead) {
            prefetchClip(ahead.text, ahead.clipVoice ?? clipSpeakerFor(ahead.voice), clipTier)
          }
        },
      })
      if (!alive()) return
      if (played) continue

      // この1本だけ MP3 を使えなかった。端末の声で読む
      started()
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
