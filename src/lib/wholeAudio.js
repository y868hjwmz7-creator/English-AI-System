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

/* ══════════════════════════════════════════════════════════════════
 * **当てはめは「ぴったり同じ」を前提にしない**(2026-09 利用者の指摘)
 *
 *   > 普段使っている教材の再生のハイライトが正確でないから頼んだのです。
 *   > 元々正確ではないです。スピーチもですが。
 *
 * **ここが元の穴だった。** これまでの当てはめは
 *
 *   「向こうが読んだ文字」と「こちらが渡した英文」は、
 *    空白を除けば**1文字ずつ、同じ順で、同じ数**である
 *
 * を前提に、**数えるだけ**で区切っていた。ところが ElevenLabs は
 * **読むために文字を書き換える**(`apply_text_normalization` の既定は
 * `auto`)。数字・記号・略語がそうなる。
 *
 *   こちらが渡した英文 … `It grew 12% in 2026.`
 *   向こうが読んだ文字 … `It grew twelve percent in twenty twenty-six.`
 *
 * **これは音のためには正しい。**(`2026` を「に、ぜろ、に、ろく」と
 * 読まれては困る)。困るのは、こちらが**数えて区切っていた**ことである。
 *
 * 【何が起きていたか。2つに分かれる】
 *
 *   ①ずれが大きい … 末尾の余りが増えるので `null` を返し、
 *                    **黙って見積もりに戻っていた**(不正確)
 *   ②ずれが小さい … 末尾では帳尻が合うので**通ってしまい**、
 *                    書き換えのあった場所から先の区切りが**全部ずれる**
 *
 * **どちらも「音は鳴る」ので、気づけない。**
 *
 * 【直し方 — 数えるのをやめて、突き合わせる】
 *   1文字ずつ**同じ文字を探しながら**進む。すぐ次が同じ文字なら
 *   そのまま進む(**書き換えが無いときは、これまでと1つも変わらない**)。
 *   食い違ったら、向こうの側だけを先へ送って**同じ文字が出るまで待つ。**
 *
 *   `12%` の `1` `2` `%` は当てはまらないが、そのすぐあとの `in` で
 *   **必ず追いつく。** 文の頭と終わりはほとんどが文字なので、
 *   区切りはこれで取れる。
 *
 * 【当てはまらなかった文字は `-1`。捨てずに残す】
 *   呼ぶ側が「その範囲で**最初に当てはまった文字**」を使えるようにする。
 *   **当てずっぽうで埋めない**(ずれた時刻は、無いより悪い)。
 *
 * 【どれだけ当てはまったかも返す】
 *   半分も当てはまらないなら、当てはめ方そのものが崩れている。
 *   そのときは**これまでどおり見積もりに戻す。**
 * ══════════════════════════════════════════════════════════════════ */

/** 追いかける範囲(向こうの文字を、これだけ先まで見て探す) */
const LOOKAHEAD = 60

/** 当てはまったと認める最低の割合。これを下回ったら使わない */
const MIN_HIT = 0.6

/**
 * 向こうの読んだ文字の上を、順に歩く道具を作る。
 *
 * **1つの道具を使い回す**(項目をまたいでも位置を持ち越す)。
 * 作り直すと、2つめの項目が先頭から探し直して**前へ戻る。**
 */
function walker(chars) {
  let k = 0
  /**
   * @param {string} text 当てはめたい英文
   * @returns {{list:Array<{at:number,k:number}>, hit:number}}
   *   `at` は英文の何文字目か、`k` は向こうの何文字目か(-1 = 当たらず)
   */
  return (text) => {
    const src = String(text ?? '')
    const list = []
    let hit = 0
    for (let i = 0; i < src.length; i += 1) {
      const c = src[i]
      if (isSpace(c)) continue
      const want = c.toLowerCase()
      let j = k
      let hops = 0
      let found = -1
      while (j < chars.length && hops <= LOOKAHEAD) {
        const d = chars[j]
        if (isSpace(d)) { j += 1; continue }
        if (String(d).toLowerCase() === want) { found = j; break }
        j += 1
        hops += 1
      }
      if (found >= 0) { list.push({ at: i, k: found }); k = found + 1; hit += 1 }
      else list.push({ at: i, k: -1 })
    }
    return { list, hit }
  }
}

/** `alignment` から、使える3つの並びを取り出す。形が違えば `null` */
function partsOf(alignment) {
  const chars = alignment?.characters
  const from = alignment?.character_start_times_seconds
  const to = alignment?.character_end_times_seconds
  if (!Array.isArray(chars) || !Array.isArray(from) || !Array.isArray(to)) return null
  if (chars.length !== from.length || chars.length !== to.length) return null
  if (!chars.length) return null
  return { chars, from, to }
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
  const got = partsOf(alignment)
  const list = (texts ?? []).map((t) => String(t ?? ''))
  if (!got || !list.length) return null
  if (list.some((t) => solidCount(t) === 0)) return null

  const walk = walker(got.chars)
  const out = []
  for (const text of list) {
    const { list: marks, hit } = walk(text)
    if (!marks.length || hit / marks.length < MIN_HIT) return null
    /* **その項目で、最初に当てはまった文字と最後に当てはまった文字。**
       書き換えられた場所(数字・記号)は当たらないので飛ばす */
    const first = marks.find((m) => m.k >= 0)
    let last = null
    for (let i = marks.length - 1; i >= 0; i -= 1) {
      if (marks[i].k >= 0) { last = marks[i]; break }
    }
    if (!first || !last) return null
    const start = Number(got.from[first.k])
    const end = Number(got.to[last.k])
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null
    out.push({ start, end })
  }

  // 前後が入れ替わっていないか(向こうの時刻が乱れていたら使わない)
  for (let i = 1; i < out.length; i += 1) {
    if (out[i].start < out[i - 1].start) return null
  }
  return out
}

/**
 * **文字ごとの、本当の時刻**(2026-09 利用者の指摘)。
 *
 *   > 再生中の文章のハイライトのタイミングをもっと正確にできないですか?
 *
 * 段落ごとの MP3 で鳴らすとき、色は **`wordMarks()` の見積もり**で
 * 動いていた(語の長さと句読点から、全体の長さを比で割ったもの)。
 * **合っているのは合計だけ**で、途中はどこもずれている。
 *
 * ところが ElevenLabs は、頼めば**文字ごとの時刻をただで返す。**
 * だから見積もりをやめて、**返ってきた時刻をそのまま使う。**
 *
 * 【ここは「当てはめ」だけを担う】
 *   `alignment.characters` は**向こうが実際に読んだ文字**なので、
 *   こちらが渡した英文と**空白の入り方だけが違う**ことがある
 *   (`spansOf` と同じ事情)。だから**空白を数えずに突き合わせる。**
 *
 * 【合わなければ、何も返さない】
 *   当てずっぽうで当てはめると、**別の語の時刻で光る。**
 *   ずれた対は、無いより悪い(`spansOf` と同じ考え方)。
 *
 * @param {object} alignment 窓口が控えた `alignment` そのもの
 * @param {string} text その英文(画面が描いているものと同じ文字列)
 * @returns {{start:number[],end:number[]}|null}
 *   英文の**何文字目**が何秒に始まり、何秒に終わるか(空白は `NaN`)
 */
export function charTimesOf(alignment, text) {
  const got = partsOf(alignment)
  const src = String(text ?? '')
  if (!got || !src) return null

  const { list: marks, hit } = walker(got.chars)(src)
  if (!marks.length || hit / marks.length < MIN_HIT) return null

  const start = new Array(src.length).fill(NaN)
  const end = new Array(src.length).fill(NaN)
  for (const m of marks) {
    if (m.k < 0) continue                 // 書き換えられた文字。**埋めない**
    const a = Number(got.from[m.k])
    const b = Number(got.to[m.k])
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue
    start[m.at] = a
    end[m.at] = b
  }
  return { start, end }
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
 * **その範囲に入る文だけの区間**(2026-09 利用者の指定・集中モード)。
 *
 *   > 長い段落を集中モードの一塊として区切った場合、集中モード内では
 *   > それらを段落として扱い、繰り返し再生できるようにしてください。
 *
 * 集中モードは長い段落を**文の切れ目で**割って1枚ずつ出す
 * (`focusChunks`)。くり返し「段落」が元の段落を回すと、
 * **画面は次のかけらへ進んでしまう。** そこで、いま出しているかけらの
 * 「何文字目から何文字目まで」を渡して、回す区間をそこに狭める。
 *
 * **範囲は文字で言う。** 秒で言うと、鳴らす側と画面で数え方が2通りになる。
 * かけらの端は必ず文の端と重なる(文の切れ目でしか割らない)ので、
 * 中に入る文を拾えば、そのまま区間になる。
 *
 * @param {Array} sentences `{ start, end, charIndex }` の並び(秒でも割合でもよい)
 * @param {{from:number,to:number}|null} range その段落の何文字目から何文字目まで
 * @param {number} base その並びが数え始めている、段落の中の文字位置
 * @returns {{start:number,end:number}|null} 狭められないときは `null`
 */
export function spanForRange(sentences, range, base = 0) {
  if (!Array.isArray(sentences) || !sentences.length) return null
  if (!range || !Number.isFinite(range.from) || !Number.isFinite(range.to)) return null
  const inside = sentences.filter((s) => {
    const c = (s.charIndex ?? 0) + base
    return c >= range.from && c < range.to
  })
  if (!inside.length) return null
  return { start: inside[0].start, end: inside[inside.length - 1].end }
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
