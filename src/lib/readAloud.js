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
import { finished, nowPlaying, stopped, takeMark } from './playMark.js'

/** いまの読み上げ。あとから始まったものだけが有効 */
let session = 0

/* ── 止めた場所を覚えておく(2026-09 利用者の指定)─────────────────
 *
 *   > 全文を聞いている途中にストップを押し、もう一度再生を押すと、
 *   > また元に戻ってしまいます。止めた場所から再び再生する機能がほしいです。
 *   > これは段落ごとの再生ボタンでも同じ仕様にしてください。
 *
 * 記事は6段落あるので、4段落目で止めて押し直すと**また1段落目から**に
 * なっていた。聞き直したいのは止めたところであって、頭ではない。
 *
 * 【覚えるのはここ1か所】
 *   `audioClips.js` は「いま鳴っている MP3」しか知らず、
 *   それが何番目の段落なのかを知らない。画面ごとに覚えると、
 *   本文・宿題・レッスン表示で**別々にずれる。**
 *   だからここに1つだけ置き、**画面は `resumeKey` を渡すだけ**にする。
 *
 * 【`resumeKey` は「同じものを聴き直したか」の目印】
 *   段落ごとの Listen なら「教材 + 演習 + 段落」、通しなら「教材 + 演習」。
 *   **渡さなければ、これまでどおり頭から鳴る**(古い呼び出しは壊れない)。
 */

/* 控えそのものは `playMark.js` に置いてある。**何にも依存しないので、
   素の node で確かめられる**(`npm run test:play`)。ここに書くと
   Supabase を引き連れてしまい、手元で一度も走らせられない */

/**
 * 読み上げを止める。**両方の経路を止める。**
 * あわせて、**どこまで鳴っていたか**を覚える(上記)。
 */
export function stopReading() {
  session += 1
  const at = stopClip()
  stopSpeaking()
  stopped(at)
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
  /** 止めた場所から鳴らすための目印。**渡さなければ、いつも頭から** */
  resumeKey = null,
} = {}) {
  /* **止めるより先に、控えを取り出す。** `stopReading()` は
     いま鳴っているものの控えを作り直すので、順を逆にすると
     自分の控えを自分で消してしまう */
  const from = takeMark(resumeKey)
  stopReading()
  const mine = session
  nowPlaying(resumeKey, 0)

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
    startAt: from?.at ?? 0,
  })
  if (mine !== session) return          // 途中で止められた・別のものが始まった
  if (played) { if (mine === session) finished(); return }

  // MP3 を使えなかった。端末の声に落ちる
  started()
  await speakOnce(text, { voice, rate, onWord }).done
  if (mine === session) { finished(); onWord?.(null) }
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
  /** **最後まで鳴りきったときだけ**呼ばれる(止めたときは来ない) */
  onDone = null,
  /**
   * 止めた場所から鳴らすための目印(2026-09 利用者の指定)。
   * **何番目の段落の、何秒めか**まで覚えてある。
   * 渡さなければ、これまでどおり頭から鳴る。
   */
  resumeKey = null,
  /**
   * **どこから始めるか**(押した段落から鳴らすとき)。
   *
   * **一覧そのものを切り取って渡さないこと。** 切り取ると番号がずれ、
   * 「止めた場所」の控え(`resumeKey`)が別の段落を指してしまう。
   * 一覧はいつも丸ごと渡し、始める場所だけをここで言う。
   */
  startIndex = 0,
  /**
   * **控えを使うか**(2026-09)。
   *
   * 「次の段落へ」を押したときは、行き先をこちらが決めている。
   * そこへ控えを当てると、**押したのに動かない**ように見える。
   * だからそのときだけ `false` を渡す。控えは**取り出して捨てる**
   * (残すと、そのあと ▶ を押したときに古い場所へ飛ぶ)。
   */
  resume = true,
} = {}) {
  const list = (parts ?? []).filter((p) => String(p?.text ?? '').trim())
  // **止めるより先に控えを取り出す**(`readAloud` と同じ理由)
  const taken = takeMark(resumeKey)
  const from = resume ? taken : null
  stopReading()
  const mine = session
  if (!list.length) return () => {}
  /* 続きから始める番号。**一覧より外に出ていたら、言われた場所から**
     (教材を直すと段落の数が変わる。CLAUDE.md「範囲の外になっていることがある」) */
  const head = Math.min(Math.max(startIndex | 0, 0), list.length - 1)
  const first = (from && from.index >= 0 && from.index < list.length) ? from.index : head

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
    for (let i = first; i < list.length; i += 1) {
      if (!alive()) return
      const part = list[i]
      const clipVoice = part.clipVoice ?? clipSpeakerFor(part.voice)
      // **いま何番目を鳴らしているか**を控える(`stopReading()` が使う)
      nowPlaying(resumeKey, i)

      // **どの継ぎ目にも間を置く**(2026-09 利用者の指定「記事でも同じ仕様に」)。
      // はじめは話す人が替わるときだけにしていたが、記事も段落と段落が
      // 詰まって聞こえる。同じ声が続くところは `turnGap.js` が短めに返す。
      // **続きから始めた1本目には間を置かない**(`i > first`)。
      // 前の発言は鳴っていないので、そこに息継ぎを入れる理由がない
      if (i > first) {
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
        // **続きから始めた1本目だけ、その途中から**(2本目からは頭から)
        startAt: (i === first ? (from?.at ?? 0) : 0),
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
    // **最後まで鳴りきった。** 控えを持ったままにすると、
    // 次に押したときに終わりぎわから始まってしまう
    finished()
    /* **最後まで鳴りきったときだけ**知らせる(2026-09)。
       `onIndex(null)` は止めたときにも来るので、これだけでは
       「止めた」と「終わった」を見分けられない。操作盤は
       **止めたときは番号を残し、終わったら消す**ので、両方が要る */
    onDone?.()
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
