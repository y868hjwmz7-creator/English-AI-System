/**
 * ============================================================================
 * 本文の音声を、**発言ごとではなく1本で**作る(2026-09 利用者の指定)
 *
 *   > 会話は、話者ごとに個別MP3を生成してアプリ側で連結せず、
 *   > ElevenLabs の Text to Dialogue API を使い、複数の voice_id を指定して
 *   > 会話全体を1本の音声として生成する。
 *   > 可能なら with-timestamps を使用し、各発話の開始・終了時刻を保存する。
 *
 * 【なぜ、つなぐのをやめるのか】
 *   発言の終わりの「プチッ」は、**ElevenLabs が返す MP3 そのものが
 *   音の途中で終わっている**ことが実測で分かっている(CLAUDE.md)。
 *   14発言のうち6発言が、いちばん大きいもので 0.11(−19dBFS)で
 *   ぶつりと 0 に落ちていた。
 *
 *   ほかの作り手も同じところで詰まっていて、出ている答えは3つある。
 *
 *     ① 継ぎ目にフェードをかける      … 減るが残る(いまの `fadeMp3Tail`)
 *     ② つないだあと丸ごと再エンコード … 消えるが**音を作り直す**
 *     ③ **そもそもつながない**        … 継ぎ目そのものが無くなる
 *
 *   ③がいちばん強い。**継ぎ目を上手に隠すのではなく、継ぎ目を無くす。**
 *
 * 【どこが何をするか】
 *   窓口(`speak`)… ElevenLabs から音声と**文字ごとの時刻**を受け取り、
 *                   MP3 と、時刻をそのまま入れた JSON を Storage に置く
 *   ここ          … その時刻から「何番目の発言は何秒から何秒か」を出す
 *   `readAloud.js`… 1本を鳴らし、時刻を見て「いま何番目か」を知らせる
 *
 *   **区切りの計算は、ここ1か所に置く。** 窓口に置くと、窓口を配置し直す
 *   までは直せなくなるし、**素の node で一度も確かめられない**
 *   (`playMark.js` / `mp3Join.js` と同じ考え方)。
 *
 * 【何にも依存しない】
 *   Supabase も `import.meta.env` も持たない。`npm run test:mp3` が
 *   ここを素の node で走らせて確かめる。
 * ============================================================================
 */

/** 覚えている切り替えの鍵(localStorage) */
export const WHOLE_KEY = 'eas.wholeAudio'

/**
 * **1本で作る形を使うか。** 既定は使う(利用者の指定「一度試してみたい」)。
 *
 * 今までの形(発言ごとに1本ずつ)へは、左のメニューの下でいつでも戻せる。
 * **戻せる道を必ず残す** — 新しい形で困ったときに、行き止まりにしない。
 */
export function wholeOn() {
  try {
    const v = window.localStorage.getItem(WHOLE_KEY)
    return v === null ? true : v === '1'
  } catch { return true }
}

/** 切り替えを覚える */
export function setWholeOn(on) {
  try { window.localStorage.setItem(WHOLE_KEY, on ? '1' : '0') } catch { /* 無視 */ }
}

/**
 * 置き場所を決めるための材料。
 *
 * **声と英文の両方から決める。** どちらか一方でも変われば別の音声になる。
 * 置き場所は `<版>/<段>/whole/<この材料の指紋>.mp3`(と `.json`)。
 *
 * **区切り文字は、英文に出てこないものを使う。** ふつうの記号でつなぐと、
 * 「A / B」と「A」+「/ B」が同じ指紋になりうる。
 */
export const wholeMark = (voiceIds, texts) => [
  'whole1',
  (voiceIds ?? []).join('␞'),
  (texts ?? []).join('␟'),
].join('␝')

/** 空白(改行を含む)か */
const isSpace = (c) => /\s/.test(c)

/** 空白でない文字の数 */
const solidCount = (s) => {
  let n = 0
  for (const c of String(s ?? '')) if (!isSpace(c)) n += 1
  return n
}

/**
 * **文字ごとの時刻から、項目ごとの「何秒から何秒か」を出す。**
 *
 * ElevenLabs は `alignment` に
 *   characters                    … 実際に読んだ文字の並び
 *   character_start_times_seconds … その文字が始まった秒
 *   character_end_times_seconds   … その文字が終わった秒
 * を返す。**渡した英文と同じ文字が、同じ順で並んでいる。**
 *
 * だから「1つめの発言の文字数だけ進む → そこまでが1つめ」で切れる。
 *
 * 【空白は数えない】
 *   会話をひと続きにするとき、向こうが改行や空白を足すことがある。
 *   **空白を数に入れなければ、足されても引かれても揺るがない。**
 *
 * 【合わなければ、何も返さない】
 *   数が合わないのに当てずっぽうで区切ると、**別の発言の場所を指す。**
 *   ずれた対は、無いより悪い(`sentencePair.js` と同じ考え方)。
 *
 * @param {object} alignment 窓口が控えた `alignment` そのもの
 * @param {string[]} texts   項目(段落 / 発言)の英文
 * @returns {Array<{start:number,end:number}>|null}
 */
export function spansOf(alignment, texts) {
  const chars = alignment?.characters
  const from = alignment?.character_start_times_seconds
  const to = alignment?.character_end_times_seconds
  const list = (texts ?? []).map((t) => String(t ?? ''))
  if (!Array.isArray(chars) || !Array.isArray(from) || !Array.isArray(to)) return null
  if (chars.length !== from.length || chars.length !== to.length) return null
  if (!list.length || !chars.length) return null

  const want = list.map(solidCount)
  if (want.some((n) => n === 0)) return null

  const out = []
  let at = 0
  for (const need of want) {
    // その項目の最初の文字まで進む(空白は読み飛ばす)
    while (at < chars.length && isSpace(chars[at])) at += 1
    if (at >= chars.length) return null
    const start = Number(from[at])
    let got = 0
    let last = -1
    while (at < chars.length && got < need) {
      if (!isSpace(chars[at])) { got += 1; last = at }
      at += 1
    }
    if (got < need || last < 0) return null
    const end = Number(to[last])
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null
    out.push({ start, end })
  }

  // 余りが多いときは、当てはめ方そのものが崩れている
  let left = 0
  for (let k = at; k < chars.length; k += 1) if (!isSpace(chars[k])) left += 1
  if (left > 2) return null

  // 前後が入れ替わっていないか(向こうの時刻が乱れていたら使わない)
  for (let i = 1; i < out.length; i += 1) {
    if (out[i].start < out[i - 1].start) return null
  }
  return out
}

/**
 * いま何番目を鳴らしているか(秒 → 番号)。
 *
 * **間(ま)の上に来たら、次の項目とみなす。** 発言と発言のあいだは
 * どちらのものでもないが、色は**これから話す人**に付いていてほしい。
 */
export function indexAtTime(spans, sec) {
  if (!Array.isArray(spans) || !spans.length) return -1
  const t = Number(sec) || 0
  if (t < spans[0].start) return 0
  for (let i = spans.length - 1; i >= 0; i -= 1) {
    if (t >= spans[i].start) return i
  }
  return 0
}

/**
 * その項目を鳴らす区間。**終わりは次の項目が始まる手前まで**にしない。
 *
 * 間(ま)まで鳴らすと、1つだけ聴いたときに最後が間延びする。
 * その項目が終わった秒でぴたりと止める。
 */
export function rangeOf(spans, i) {
  if (!Array.isArray(spans) || i < 0 || i >= spans.length) return null
  return { start: spans[i].start, end: spans[i].end }
}
