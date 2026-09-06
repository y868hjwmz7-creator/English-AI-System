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
  DEFAULT_CLIP_VOICE, canUseClips, clipDuration, clipTime, noteFellBack, playClip,
  prefetchClip, seekClip, stopClip, wholeClip,
} from './audioClips.js'
import { isSpeechSupported, speakOnce, stopSpeaking } from './speech.js'
import { clipSpeakerFor } from './voiceCast.js'
import { speedPadMs, turnGapMs } from './turnGap.js'
import { voiceRateOf } from '../data/clipVoices.js'
import { finished, nowPlaying, stopped, takeMark } from './playMark.js'
import {
  REPEAT_UNITS, indexAtTime, rangeOf, repeatSeek, seekSentence, sentenceSpansOf,
} from './wholeAudio.js'
import { sentenceShares, sharesToTimes, splitSentences } from './wordTiming.js'
import { speakChunks } from './speakChunks.js'
import { PREMIUM, STANDARD } from './voiceTier.js'

/** いまの読み上げ。あとから始まったものだけが有効 */
let session = 0

/* ══════════════════════════════════════════════════════════════════
 * **1文ずつ、飛ばす / 戻す**(2026-09 利用者の指定)
 *
 *   > 「全体を聞く」「段落ごと」りょうほうの横に◁▷をおいて、
 *   > 1文ずつ飛ばしたり戻したりできる仕様です
 *
 * **1本にまとめた音声だからできる。** 文の区間は、通しの音声と一緒に
 * 控えてある時刻(`alignment`)から出す(`sentenceSpansOf`)。
 *
 * 【止めて鳴らし直さない】
 *   `seekClip()` が `currentTime` を動かすだけなので、その場で続きが鳴る。
 *   止めると「どこまで聴いたか」の控えが動くうえ、鳴らし直しで黙る。
 *
 * 【控えを、画面ごとに持たせない】
 *   いま鳴っているものは1つだけなので、**ここに1つ**置く
 *   (`playMark.js` と同じ考え方)。画面は `skipSentence(±1)` を呼ぶだけ。
 *
 * 【1本にできなかったときも、動かせる】(2026-09 実機・利用者の指摘)
 *
 *   > 文を飛ばす機能、リピート機能などが一部機能しません。
 *   > これは、スピーチで自前で長い文を生成したものだけで、
 *   > 他の教材では機能しています。
 *
 *   **1本にまとめられるのは 2,800 文字まで**(ElevenLabs の上限)。
 *   貼った原稿はそれを軽く超えるので段落ごとの MP3 に落ち、
 *   そこには時刻が無いので**この控えが空のままだった。**
 *   ◀ ▶ が押せず、文のくり返しも段落で回っていた。
 *
 *   いまは**語の重みから見積もった割合**を控える(`sentenceShares`)。
 *   語の色ももともと同じ重みで動いているので、
 *   **色と送り先が食い違うことがない。**
 *   `relative` を立てて控え、押された瞬間に長さを掛けて秒に直す。
 * ══════════════════════════════════════════════════════════════════ */

/**
 * いま鳴っているものの文の区間。`{ spans, bound, session, relative }`
 *
 * `relative` が立っているとき、`spans` は**秒ではなく 0〜1 の割合**である
 * (1本にまとめられなかったとき。長さは鳴らしてみるまで分からない)。
 */
let cursor = null
const cursorSubs = new Set()
const tellCursor = () => { for (const fn of [...cursorSubs]) fn(!!cursor) }

const setCursor = (next) => {
  const had = !!cursor
  cursor = next
  if (had !== !!cursor) tellCursor()
}

/** 1文ずつの送り戻しが使えるか。**変わったら知らせる** */
export function watchSentenceSkip(fn) {
  cursorSubs.add(fn)
  fn(!!cursor)
  return () => { cursorSubs.delete(fn) }
}

/** いま、1文ずつ動かせるか */
export const canSkipSentence = () => !!cursor

/**
 * 1文ぶん、飛ばす / 戻す。
 *
 * @param {number} delta -1(前の文へ)/ +1(次の文へ)
 * @returns {boolean} 動かせたか
 */
export function skipSentence(delta) {
  if (!cursor || cursor.session !== session) return false
  const at = clipTime()
  if (at === null) return false
  const spans = cursorSpans()
  if (!spans) return false
  const to = seekSentence(spans, at, delta, cursor.bound)
  if (to === null) return false
  return seekClip(to)
}

/**
 * 控えてある区間を、**秒**にして返す。
 *
 * 1本にまとめた音声では、控えがそのまま秒である。
 * 1本にできなかったときは**割合**なので、いま鳴っている MP3 の長さを掛ける
 * (長さが分かるのは読み込んだあとなので、控えるのは割合にしてある)。
 */
function cursorSpans() {
  if (!cursor?.spans?.length) return null
  if (!cursor.relative) return cursor.spans
  return sharesToTimes(cursor.spans, clipDuration())
}

/** 文の区間を、鳴らし始めるときに控える。**止めたら捨てる** */
function holdCursor(spans, bound, relative = false) {
  setCursor(spans?.length ? { spans, bound, session, relative } : null)
}

/**
 * 項目の英文から、文の区間を出す。**切り方は `splitSentences` 1か所**
 * (`splitEnSentences` が中で使っているのと同じもの)。
 *
 * **文字の位置(`charIndex`)も一緒に持ち帰る**(2026-09 実機・利用者の指摘)。
 *
 *   > 今再生している文章をハイライトしてください。
 *   > いつの間にか再生中の文章がハイライトされなくなりました。
 *
 * 1本にまとめた音声で鳴らすようにしたとき、**`onWord` を渡し忘れていた。**
 * 画面は「いま何文字目を読んでいるか」から文を光らせるので
 * (`EnglishText` の `readingAt`)、渡さないと**光らない。**
 * 音は鳴るので、**気づけない形の抜け**だった。
 *
 * 位置は**その項目の英文の中での文字数**である(段落ごとに 0 から数える)。
 * 画面はその項目の英文をそのまま描いているので、これで文が当たる。
 */
function sentenceSpansFor(got, texts) {
  /* **切って、位置も覚える。** `splitEnSentences` は位置を捨てるので、
     ここでは元の `splitSentences` を使う(**切り方は同じ**)。
     空白だけの文を落とすところまで、あちらとそろえる */
  const parts = texts.map((t) => {
    const src = String(t ?? '')
    return splitSentences(src)
      .map((m) => ({ at: m.start, text: src.slice(m.start, m.end).trim() }))
      .filter((x) => x.text)
  })
  const spans = sentenceSpansOf(got?.alignment, parts.map((g) => g.map((x) => x.text)))
  if (!spans) return null
  /* 何番目の項目の、何番目の文か。**`sentenceSpansOf` と同じ順**に
     並んでいるので、項目ごとに数え上げれば当たる */
  const seen = new Map()
  return spans.map((sp) => {
    const n = seen.get(sp.item) ?? 0
    seen.set(sp.item, n + 1)
    return { ...sp, charIndex: parts[sp.item]?.[n]?.at ?? 0 }
  })
}

/**
 * いま鳴っている秒から、**光らせる文の位置**を出して知らせる。
 * **同じ文のあいだは、何度も呼ばない**(描き直しが増えるだけ)。
 */
function tellSentence(spans, sec, only, state, onWord) {
  if (!onWord || !spans) return
  let hit = -1
  for (let i = spans.length - 1; i >= 0; i -= 1) {
    if (sec >= spans[i].start - 0.001) { hit = i; break }
  }
  if (hit < 0 || hit === state.at) return
  state.at = hit
  const sp = spans[hit]
  // 通しでは、いま光っている項目のものだけを送る(別の段落を光らせない)
  if (only != null && sp.item !== only()) return
  onWord({ charIndex: sp.charIndex, index: sp.item })
}

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
  setCursor(null)
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
  /**
   * **1本にまとめた音声の、どこを鳴らすか**(2026-09 利用者の指定)。
   *
   *   > 音声については「1本にまとめる」の仕様に統一しましょう。
   *   > 「段落ごと」は廃止です
   *
   * `{ texts, voiceIds, index }`(`wholeSliceOf()` が作る)。
   * 渡すと、**その教材の1本の音声の中の、その区間だけ**を鳴らす。
   * **別の MP3 を作らないので、二度課金にならない**うえ、
   * 通しで聴いたときとまったく同じ音になる(継ぎ目が無い)。
   *
   * **作れなかったときは、これまでどおり1本ずつ作って鳴らす。**
   * 鍵が無い・文字数が多すぎる・名簿に無い声が混じっている・
   * 時刻が本文と合わない、のどれかである。**行き止まりを作らない。**
   */
  whole = null,
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

  /* ── 1本の中の区間を鳴らす(2026-09 利用者の指定で、こちらに統一)──
   *
   *   **`started()` をここで呼ばない。** 1本目を作っている 30 秒のあいだは
   *   まだ何も鳴っていないので、呼ぶと「用意しています…」が消えて
   *   **無反応のまま黙っている**ように見える(`readAloudSequence` と同じ)。
   *   合図は `playClip` の `onStart` が、本当に鳴り始めた瞬間に出す。 */
  if (whole && clipTier === PREMIUM && whole.texts?.length >= 2) {
    const got = await wholeClip({ texts: whole.texts, voiceIds: whole.voiceIds })
    if (mine !== session) return              // 待っているあいだに止められた
    const span = got?.spans?.length === whole.texts.length
      ? rangeOf(got.spans, whole.index) : null
    if (span) {
      /* 控えの秒は「1本の中の秒」なので、**その区間に収まっているときだけ**
         使う(発言ごとに作っていた頃の秒が残っていても、変な場所から
         鳴らさない)。`readAloudSequence` とまったく同じ守り */
      const at = (from && from.at > span.start && from.at < span.end)
        ? from.at : span.start
      /* **文の区間を控える**(1文ずつの ◁▷)。段落ごとに押したときは、
         **その段落の中だけ**で動かす(押した段落から出ていかない) */
      const sent = sentenceSpansFor(got, whole.texts)
      holdCursor(sent, span)
      /* **いま読んでいる文を光らせる**(2026-09 実機・利用者の指摘)。
         この項目の文だけを送る(ほかの段落を光らせない) */
      const mine2 = { at: -1 }
      const cut = await playClip({
        srcUrl: got.url,
        // 1本には声が何人ぶんも入っている。**声ごとの速さの補正は当てない**
        voiceId: 'whole',
        tier: clipTier,
        rate,
        startAt: at,
        stopAt: span.end,
        onStart: started,
        onTime: (sec) => {
          if (mine === session) tellSentence(sent, sec, () => whole.index, mine2, onWord)
        },
      })
      if (mine !== session) return
      if (cut) { finished(); onWord?.(null); return }
      // 鳴らせなかった。**下へ落ちて、これまでどおり1本ずつ作る**
    }
  }

  /* **窓口が受け取れる長さを超える段落は、分けて続けて鳴らす**(2026-09 実機)。
     超えたまま渡すと 400 で断られ、**その段落だけ端末の声**
     (iPhone では日本語の声)に落ちる。詳しくは `speakChunks.js` */
  const pieces = speakChunks(text)
  let played = false
  for (const [n, piece] of pieces.entries()) {
    played = await playClip({
      text: piece.text,
      voiceId: clipVoice ?? clipSpeakerFor(voice),
      tier: clipTier,
      rate,
      /* 語の色は**段落の中の位置**で送る。分けたかけらは 0 から数え直すので、
         そのかけらの頭を足さないと**段落の先頭に戻って光る** */
      onWord: onWord
        ? (w) => onWord(w ? { ...w, charIndex: (w.charIndex ?? 0) + piece.at } : null)
        : null,
      /* **1本にできなかったときも、1文ずつ動かせるようにする**
         (2026-09 実機・利用者の指摘)。時刻が無いので、語の色と同じ重みから
         見積もった**割合**を控える。秒に直すのは押された瞬間。
         **控えるのは MP3 が鳴り出したときだけ** —— 端末の声に落ちたときは
         途中から鳴らす手段が無いので、押せるように見せてはいけない */
      onStart: () => { holdCursor(sentenceShares(piece.text), null, true); started() },
      // **分けたときは頭から。** 控えの秒がどのかけらのものか決められない
      startAt: (n === 0 && pieces.length < 2) ? (from?.at ?? 0) : 0,
    })
    if (mine !== session) return        // 途中で止められた・別のものが始まった
    if (!played) break                 // 1つでも鳴らせなければ、端末の声へ
  }
  if (played) { if (mine === session) finished(); return }

  // MP3 を使えなかった。端末の声に落ちる。**黙って落ちない**
  noteFellBack('')
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
  /**
   * **始める場所を、控えより優先する**(2026-09・集中モード)。
   *
   * 集中モードは「いま開いている段落」から鳴らす。ところが控えには
   * **別の段落の秒**が残っていることがあり、そのまま当てると
   * **開いていない段落が鳴り出す。** `pinned` を渡すと、
   * 始めるのは必ず `startIndex` で、控えの秒は
   * **その段落のものだったときだけ**使う(そこで止めた続きから鳴る)。
   */
  pinned = false,
  /**
   * **くり返しの単位**(2026-09 利用者の指定)。
   *
   *   > 文章単位、段落単位、全文単位、三つ選べるような。
   *
   * `() => 'off' | 'sentence' | 'item' | 'all'` を渡す。
   * **値ではなく、訊きに行く形にしてある** —— 鳴らしている最中に
   * 切り替えても、次のひと刻みから効く(押し直させない)。
   */
  repeatOf = null,
} = {}) {
  const shown = (parts ?? []).filter((p) => String(p?.text ?? '').trim())
  /* ── **窓口が受け取れる長さを超える段落は、ここで分ける**(2026-09 実機)
   *
   *   > このspeech練習の教材、9段落目だけ最低な質の日本語英語の女性の
   *   > 音声になっているので直してください。
   *
   *   窓口(`speak`)は1回に 2,000 文字まで。超えると 400 で断られ、
   *   **その段落だけ端末の声**(iPhone では日本語の声)に落ちる。
   *
   *   **画面に出す段落は1つも変えない。** 分けるのは
   *   「窓口へ何を渡すか」だけである。だから
   *   **番号(`index`)は元の段落のまま**で、色も送りも今までどおり当たる。
   *   `at` は元の段落の何文字目か —— 語の色をここでずらす。 */
  const list = []
  const pieceOf = []                       // 段落の番号 → 最初のかけらの番号
  shown.forEach((p, index) => {
    pieceOf[index] = list.length
    for (const c of speakChunks(p.text)) list.push({ ...p, text: c.text, index, at: c.at })
  })
  // **止めるより先に控えを取り出す**(`readAloud` と同じ理由)
  const taken = takeMark(resumeKey)
  const from = resume ? taken : null
  stopReading()
  const mine = session
  if (!list.length) return () => {}
  /* 続きから始める番号。**一覧より外に出ていたら、言われた場所から**
     (教材を直すと段落の数が変わる。CLAUDE.md「範囲の外になっていることがある」)。
     **控えも `startIndex` も「段落の番号」である**(かけらの番号ではない) */
  const at = (d) => pieceOf[Math.min(Math.max(d | 0, 0), shown.length - 1)] ?? 0
  const head = at(startIndex)
  const first = (!pinned && from && from.index >= 0 && from.index < shown.length)
    ? at(from.index) : head
  /* 控えの秒を当ててよいのは、**その段落のものだったときだけ。**
     **分けた段落では頭から鳴らす** —— 控えの秒は「段落の音声の何秒め」で、
     分けたあとはどのかけらの秒なのかが決められない。
     **当てずっぽうで飛ばすより、頭から鳴らすほうが説明できる** */
  const split = list[first] && list[first + 1]?.index === list[first].index
  const fromAt = (!split && from && at(from.index) === first) ? (from.at ?? 0) : 0

  /** いまのくり返しの単位。**知らない値は「しない」に落とす** */
  const repeatNow = () => {
    const u = repeatOf?.()
    return REPEAT_UNITS.includes(u) ? u : 'off'
  }

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

  /* ══════════════════════════════════════════════════════════════
   * **本文まるごとを1本で鳴らす**(2026-09 利用者の指定)
   *
   *   > 話者ごとに個別MP3を生成してアプリ側で連結せず、
   *   > …会話全体を1本の音声として生成する。
   *   > timestamps を使って全文再生・発話単位再生を可能にする。
   *
   *   発言と発言の「プチッ」は**つなぎ目があるから**出る。
   *   1本なら、つなぎ目そのものが無い。
   *
   * 【今までの形にも戻せる】(利用者の指定)
   *   左のメニューの下の切り替えで、いつでも発言ごとに戻せる。
   *   **1本を作れなかったときも、黙って今までの形に落ちる。**
   *   だから行き止まりにはならない。
   *
   * 【1本にすると効かなくなるもの】
   *   ・`turnGap.js`(内容から決める間)… 間を作るのは ElevenLabs になる
   *   ・語ごとの色 … 文字ごとの時刻は控えてあるが、まだ使っていない
   *   段落 / 発言ごとの色(`onIndex`)は、時刻から出すのでこれまでどおり。
   * ══════════════════════════════════════════════════════════════ */
  const canWhole = clipTier === PREMIUM && list.length >= 2

  const runWhole = async () => {
    if (!canWhole) return false
    const got = await wholeClip({
      texts: list.map((p) => p.text),
      voiceIds: list.map((p) => p.clipVoice ?? clipSpeakerFor(p.voice)),
    })
    if (!alive()) return true                 // 待っているあいだに止められた
    if (!got?.spans?.length || got.spans.length !== list.length) return false

    const { spans } = got
    /* **どこから鳴らすか。** 控えの秒は「1本の中の秒」なので、
       その項目の中に収まっているときだけ使う(今までの形で覚えた秒が
       混ざっても、変なところから鳴らさない) */
    const s = spans[first]
    const at = (fromAt > s.start && fromAt < s.end) ? fromAt : s.start

    let shown = -1
    const seen = (i) => {
      if (i < 0 || i === shown) return
      shown = i
      nowPlaying(resumeKey, i)
      onIndex?.(i)
    }
    seen(first)
    /* **ここで `started()` を呼ばない**(2026-09 実機・こちらの入れ違い)。
     *
     *   > バックグラウンドでの再生準備が全然できていません。
     *
     * `started()` は「**実際に音が出た**」という合図で、これを呼ぶと
     * ボタンの「用意しています…」が消えて Stop に変わる。
     * ところが 1本目を作っている 30 秒のあいだはまだ何も鳴っていないので、
     * **押した人には「無反応のまま黙っている」ようにしか見えない。**
     * 2026-09 に直したはずの「Listen の1度目が反応しない」を、
     * こちらで作り直していた(CLAUDE.md)。
     *
     * 合図は `playClip` の `onStart` が、**本当に鳴り始めた瞬間**に出す。 */

    /* **文の区間を控える**(1文ずつの ◁▷)。通しでは**本文ぜんぶ**を
       行き来できる(段落をまたいでも構わない) */
    const sent = sentenceSpansFor(got, list.map((p) => p.text))
    holdCursor(sent, null)
    /* **いま読んでいる文を光らせる**(2026-09 実機・利用者の指摘)。
       通しでは、**いま光っている段落の文だけ**を送る */
    const seenSent = { at: -1 }
    const played = await playClip({
      srcUrl: got.url,
      // 1本には声が2人ぶん入っている。**声ごとの速さの補正は当てない**
      voiceId: 'whole',
      tier: clipTier,
      rate,
      startAt: at,
      onStart: started,
      onTime: (sec) => {
        if (!alive()) return
        /* ── **くり返し**(2026-09 利用者の指定)──────────────────
           > 文章単位、段落単位、全文単位、三つ選べるような。

           **止めて鳴らし直さない。** 1本の中を戻すだけなので、
           そのまま続けて鳴る(1文ずつの ◁▷ と同じ道具)。
           戻したら、そのひと刻みは何もしない —— 秒がもう古いので、
           そのまま数えると**一瞬だけ次の段落が光る** */
        const back = repeatSeek(repeatNow(), sec, { spans, sentences: sent })
        if (back !== null && seekClip(back)) return
        seen(indexAtTime(spans, sec))
        tellSentence(sent, sec, () => shown, seenSent, onWord)
      },
    })
    if (!alive()) return true
    if (!played) return false                 // 鳴らせなかった。今までの形へ

    finished()
    onDone?.()
    onIndex?.(null)
    onWord?.(null)
    return true
  }

  /* ══════════════════════════════════════════════════════════════
   * **1本にできなかったときの、くり返し**
   *
   *   こちらは英文ごとに別の MP3 を鳴らすので、**文の区間が無い。**
   *   だから「文」と言われても、こちらの知っているいちばん細かい単位は
   *   段落である。**近い単位で回す**(何も起きないより、そのほうがよい)。
   *   `repeatSeek()` が同じ考え方で落としているのと合わせてある。
   *
   *   **止まる条件を持たせる**(CLAUDE.md)。鳴らせない状況では
   *   読み上げがすぐ終わる。そのまま回すと**目に見えないまま回り続ける。**
   *   0.3 秒に満たずに終わったら、失敗とみなしてやめる
   *   (`SpeakButton` のくり返しとまったく同じ歯止め)。
   * ══════════════════════════════════════════════════════════════ */
  const run = async () => {
    let start = first
    /* **鳴らせないまま回り続けない。** ひと周のあいだに
       1本も 0.3 秒以上鳴らなければ、そこでやめる */
    let heard = false
    for (;;) {
      for (let i = start; i < list.length; i += 1) {
        if (!alive()) return
        const part = list[i]
        const began = Date.now()
        const clipVoice = part.clipVoice ?? clipSpeakerFor(part.voice)
        /* **いま何番目を鳴らしているか**を控える(`stopReading()` が使う)。
           **控えるのは段落の番号**(かけらの番号ではない) —— 次に開いた
           ときに段落の分け方が変わっても、指す先がずれない */
        nowPlaying(resumeKey, part.index)

        // **どの継ぎ目にも間を置く**(2026-09 利用者の指定「記事でも同じ仕様に」)。
        // はじめは話す人が替わるときだけにしていたが、記事も段落と段落が
        // 詰まって聞こえる。同じ声が続くところは `turnGap.js` が短めに返す。
        // **続きから始めた1本目には間を置かない**(`i > first`)。
        // 前の発言は鳴っていないので、そこに息継ぎを入れる理由がない
        /* **同じ段落を分けたかけらのあいだには、段落の間を置かない。**
           分けたのはこちらの都合で、話のうえでは文と文の切れ目である */
        const joined = i > start && list[i - 1].index === part.index
        if (joined) { await pause(90 / (rate || 1)); if (!alive()) return }
        if (i > start && !joined) {
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

        onIndex?.(part.index)

        /* 語の色は**段落の中の位置**で送る。分けたかけらは 0 から数え直すので、
           そのかけらの頭(`part.at`)を足さないと**段落の先頭に戻って光る** */
        const relay = onWord
          ? (w) => onWord(w
            ? { ...w, charIndex: (w.charIndex ?? 0) + part.at, index: part.index }
            : null)
          : null

        /* ── **1本にできなかったときの、文の単位**(2026-09 実機)──────
         *
         *   > 文を飛ばす機能、リピート機能などが一部機能しません。
         *   > これは、スピーチで自前で長い文を生成したものだけで、
         *   > 他の教材では機能しています。
         *
         * 貼った原稿は 2,800 文字を超えるので1本にまとめられず、
         * ここへ落ちる。そこには時刻が無いため、**◀ ▶ もくり返しも
         * 文の単位が丸ごと死んでいた。** 語の色と同じ重みから見積もる。
         *
         * **控えるのは鳴らす前**(割合なので長さが要らない)。
         * こうすると段落の切れ目で ◀ ▶ が一瞬押せなくなることがない ——
         * 鳴っていないあいだは `clipTime()` が `null` を返すので、
         * **前の段落の区間で誤って飛ぶこともない。** */
        const shares = sentenceShares(part.text)
        let sentSecs = null

        const played = await playClip({
          text: part.text,
          voiceId: clipVoice,
          tier: clipTier,
          rate,
          onWord: relay,
          onTime: (sec, dur) => {
            if (!alive()) return
            /* **文でくり返す。** 段落・全文はこの下の周回が受け持つので、
               `repeatSeek` には文の区間だけを渡す(単位が違えば `null`)。
               見積もれなかったときも `null` になり、
               これまでどおり**段落で回る**(行き止まりを作らない) */
            if (!sentSecs) sentSecs = sharesToTimes(shares, dur)
            if (!sentSecs) return
            const back = repeatSeek(repeatNow(), sec, { sentences: sentSecs })
            if (back !== null) seekClip(back)
          },
          // **続きから始めた1本目だけ、その途中から**(2本目からは頭から)。
          // くり返しで頭へ戻ったあとも、控えは当てない(`start === first`)
          startAt: (i === first && start === first ? fromAt : 0),
          // 鳴り始めたら、次のぶんを裏で用意しておく
          onStart: () => {
            /* **控えるのは MP3 が鳴り出したときだけ。** 端末の声に落ちたら
               途中から鳴らす手段が無いので、押せるように見せてはいけない。
               **段落の切れ目では、前の控えをそのまま残す** ——
               鳴っていないあいだは `clipTime()` が `null` を返すので
               誤って飛ぶことはなく、◀ ▶ が一瞬押せなくなることもない */
            holdCursor(shares, null, true)
            started()
            const ahead = list[i + 1]
            if (ahead) {
              prefetchClip(ahead.text, ahead.clipVoice ?? clipSpeakerFor(ahead.voice), clipTier)
            }
          },
        })
        if (!alive()) return
        if (!played) {
          /* この1本だけ MP3 を使えなかった。端末の声で読む。
             **どの段落かを必ず言う**(2026-09 実機・利用者の指摘)。
             iPhone の端末の声は日本語の声が英語を読むので、
             **黙って落ちると「最低な質の音声」として耳に入るまで気づけない** */
          noteFellBack(`${part.index + 1} 段落目の`)
          started()
          await speakOnce(part.text, { voice: part.voice, rate, onWord: relay }).done
          if (!alive()) return
        }

        /* **同じところをもう一度**(文 / 段落)。0.3 秒に満たずに終わったら、
           鳴らせていないので回さない(上の歯止め) */
        const ok = Date.now() - began >= 300
        if (ok) heard = true
        const unit = repeatNow()
        /* **段落でくり返すときは、段落の頭へ戻す。**
           長すぎて分けた段落では、いま鳴らしたかけらだけを回すと
           **段落の後ろ半分だけが延々と鳴る** */
        if ((unit === 'sentence' || unit === 'item') && ok) i = pieceOf[part.index] - 1
      }
      if (!alive()) return
      // **全文をくり返す。** 次の周は、本文の頭から。
      // **1本も鳴らなかった周のあとは回さない**(目に見えないまま回り続ける)
      if (repeatNow() !== 'all' || !heard) break
      heard = false
      start = 0
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
  /* **まず1本を試し、駄目なら今までどおり発言ごとに鳴らす。**
     どちらに落ちても、押した人には同じに見える */
  runWhole().then((done) => { if (!done && alive()) run() })

  return () => {
    if (!alive()) return
    stopReading()
    onIndex?.(null)
    onWord?.(null)
  }
}

export { DEFAULT_CLIP_VOICE }
