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

/* ══════════════════════════════════════════════════════════════════
 * **切り替えは廃止した**(2026-09 利用者の指定)
 *
 *   > その後、いくつか視聴して決めました。「1本にまとめる」の方が
 *   > 切れ目もなく音が良いのでこちらにしようと思います。
 *   > 音声については「1本にまとめる」の仕様に統一しましょう。
 *   > 「段落ごと」は廃止です
 *
 * 左のメニューの下にあった「本文の読み上げ … 1本 / 発言ごと」を外し、
 * `wholeOn()` / `setWholeOn()` / `WHOLE_KEY` も消した。
 * **聴き比べるために置いていたもの**なので、決まったら要らない。
 *
 * 【それでも「発言ごと」の道は残っている。ただし選ぶものではない】
 *   1本を作れないときは**黙ってそちらに落ちる**(鍵が無い・文字数が
 *   多すぎる・名簿に無い声が混じっている・時刻が本文と合わない)。
 *   **これは受け皿であって、仕様の選択肢ではない。**
 *   消すと**行き止まりになる**(音が1つも鳴らなくなる)ので、消さない。
 *
 * 【段落ごとの Listen も、この1本から鳴る】
 *   利用者の確認「段落ごとのボタンはもちろん残します」。
 *   ボタンは残し、**鳴らすのは1本の中の区間**にした
 *   (`wholeSliceOf()` → `readAloud({ whole })`)。
 *   **別の MP3 を作らないので、二度課金にならない。**
 * ══════════════════════════════════════════════════════════════════ */

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
 * **文ごとの区間**(2026-09 利用者の指定)。
 *
 *   > 「全体を聞く」「段落ごと」りょうほうの横に◁▷をおいて、
 *   > 1文ずつ飛ばしたり戻したりできる仕様です
 *
 * **`spansOf()` をそのまま使う。** 渡すものを「項目」から「文」に
 * 変えるだけで、**数え方は1つのまま**である
 * (文に切っても、空白でない文字の並びは1文字も変わらない)。
 *
 * **文に切るのは呼ぶ側**(`splitEnSentences`)。ここに切り方を持ち込むと、
 * このファイルが素の node で走らせられなくなる(`playMark.js` と同じ考え方)。
 *
 * @param {object} alignment 窓口が控えた `alignment` そのもの
 * @param {string[][]} groups 項目ごとの文の一覧(`[[文,文],[文],…]`)
 * @returns {Array<{start:number,end:number,item:number}>|null}
 */
export function sentenceSpansOf(alignment, groups) {
  const list = Array.isArray(groups) ? groups : []
  const flat = []
  list.forEach((sentences, item) => {
    for (const s of sentences ?? []) flat.push({ item, text: String(s ?? '') })
  })
  if (!flat.length) return null
  const spans = spansOf(alignment, flat.map((f) => f.text))
  if (!spans) return null
  return spans.map((s, i) => ({ ...s, item: flat[i].item }))
}

/**
 * いまの秒から、**1つ先 / 1つ前の文の頭**を出す。
 *
 * **いま鳴っている文の頭に戻るのではなく、1つ前の文へ**戻す
 * (音楽プレーヤーの ◀◀ と同じにすると、押しても同じ文が鳴り直すだけで
 * 「戻った」と感じられない)。ただし**文の途中まで来ていたら
 * その文の頭へ**戻す —— 聞き逃したのはたいていその文である。
 *
 * @param {Array} spans `sentenceSpansOf()` の返り値
 * @param {number} sec  いまの秒
 * @param {number} delta -1(前へ)/ +1(次へ)
 * @param {object} [bound] `{start, end}` を渡すと、その中だけで動く
 * @returns {number|null} 飛ぶ先の秒。**行き先が無ければ null**
 */
export function seekSentence(spans, sec, delta, bound = null) {
  if (!Array.isArray(spans) || !spans.length) return null
  const list = bound
    ? spans.filter((s) => s.start >= bound.start - 0.001 && s.start < bound.end)
    : spans
  if (!list.length) return null
  const t = Number(sec) || 0
  // いま何番目の文か(まだ始まっていなければ先頭)
  let at = 0
  for (let i = list.length - 1; i >= 0; i -= 1) {
    if (t >= list[i].start - 0.001) { at = i; break }
  }
  if (delta < 0) {
    /* **その文に入って 1.2 秒を過ぎていたら、その文の頭へ。**
       頭から 1.2 秒以内なら、押した人は「もう1つ前」を求めている */
    if (t - list[at].start > 1.2) return list[at].start
    return at > 0 ? list[at - 1].start : null
  }
  return at < list.length - 1 ? list[at + 1].start : null
}

/* ══════════════════════════════════════════════════════════════════
 * **くり返しは、3つの単位から選ぶ**(2026-09 利用者の指定)
 *
 *   > 反復ボタンを作って欲しいです。
 *   > 文章単位、段落単位、全文単位、三つ選べるような。
 *
 * これまでの「くり返す / 1回」(`RepeatToggle`)は**段落単位しか無かった。**
 * まねて言う練習は、1文だけを何度も回したいことのほうが多い。
 *
 * 【止めて鳴らし直さない】
 *   1本にまとめた音声の中を **`seekClip()` で戻すだけ**にする
 *   (1文ずつの ◁▷ とまったく同じ道具)。止めて鳴らし直すと、
 *   そのあいだ黙るうえ、「どこまで聴いたか」の控えが動く。
 *
 * 【判断はここに置く。**素の node で確かめられる**】
 *   `readAloud.js` は Supabase を引き連れているので、手元で走らせられない。
 *   区間を選ぶ算段だけをここへ出しておけば、`npm run test:mp3` が
 *   **押してみなくても**確かめられる(`playMark.js` と同じ考え方)。
 * ══════════════════════════════════════════════════════════════════ */

/** くり返しの単位。**並びがそのまま押したときの順**である */
export const REPEAT_UNITS = ['off', 'sentence', 'item', 'all']

/**
 * 折り返しの手前。**10ms ごとに見ている**ので、これだけあれば取りこぼさない
 * (`audioClips.js` の `FADE_STEP`)。速さ 2.5 倍でも 25ms しか進まない。
 */
const REPEAT_EPS = 0.04

/**
 * **くり返しの折り返し先の秒。** まだ終わりに来ていなければ `null`。
 *
 * @param {string} unit 'off' / 'sentence' / 'item' / 'all'
 * @param {number} sec  いまの秒
 * @param {object} o
 * @param {Array} o.spans     項目(段落 / 発言)の区間
 * @param {Array} o.sentences 文の区間(`sentenceSpansOf()`)
 * @returns {number|null} 戻る先の秒
 *
 * 【文の区間が無いときは、段落で回す】
 *   文の区間は1本にまとめた音声の時刻から出す。出せないのは
 *   **1本そのものが作れていないとき**で、そのときは段落が
 *   こちらの知っているいちばん細かい単位である。
 *   **何も起きないより、近い単位で回すほうがよい**(行き止まりを作らない)。
 */
export function repeatSeek(unit, sec, { spans = null, sentences = null } = {}) {
  if (!REPEAT_UNITS.includes(unit) || unit === 'off') return null
  const t = Number(sec) || 0
  const items = Array.isArray(spans) && spans.length ? spans : null
  const sents = Array.isArray(sentences) && sentences.length ? sentences : null

  let span = null
  if (unit === 'sentence') {
    span = sents ? sents[indexAtTime(sents, t)] : null
    if (!span && items) span = items[indexAtTime(items, t)]
  } else if (unit === 'item') {
    span = items ? items[indexAtTime(items, t)] : null
  } else if (unit === 'all') {
    // **全文は、いつも頭へ戻す。** 途中から鳴らし始めていても、
    // 「全文をくり返す」と言った以上は本文の頭から回る
    if (items) span = { start: items[0].start, end: items[items.length - 1].end }
  }
  if (!span || !Number.isFinite(span.start) || !Number.isFinite(span.end)) return null
  return t >= span.end - REPEAT_EPS ? span.start : null
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
