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

/* ══════════════════════════════════════════════════════════════════
 * **控えた時刻の時計と、鳴らしている音声の時計を合わせる**
 * (2026-09 実機・利用者の指摘)
 *
 *   > 相変わらず音声と文章ごとのハイライトが大きくズレます。
 *   > 14発言の会話で大体2-3発言分くらいハイライトが発言より
 *   > 先に進んでしまいます。これは恐らく感情を込めて間をとった時などに
 *   > ハイライトが先に進むからのように見受けられます。
 *
 * 【まず測った。当てはめは犯人ではない】
 *   14発言の会話を作り、①そのまま ②1か所だけ読み下し ③余分な文字
 *   ④短縮形の展開 で `spansOf()` を通したところ、**どれも誤差 0.00 秒**
 *   だった(数字を全部読み下したときだけ `null` を返して、これまでどおり
 *   発言ごとの音声に落ちる)。**文字の当てはめでは、先へは進まない。**
 *
 * 【残るのは「時計そのもの」しかない】
 *   ずれが**発言を追うごとに積み上がる**なら、原因は当てはめではなく
 *   **控えた時刻の時計が、鳴っている音声より速い**ことである。
 *   ElevenLabs の Text to Dialogue は、発言と発言のあいだに
 *   **間(無音)を入れて1本にする。** その無音が `alignment` の秒に
 *   入っていなければ、
 *
 *       控えの秒 … 話している時間だけを足したもの
 *       音声の秒 … 話している時間 + 間
 *
 *   となり、**間を1つ通るたびに、ハイライトがそのぶん先に出る。**
 *   13 の継ぎ目で 0.7 秒ずつなら **9 秒 = 2〜3発言ぶん**で、
 *   利用者の言う数と合う。
 *
 * 【こちらからは、どちらが原因かを確かめられない】
 *   この環境から ElevenLabs にも Supabase にも届かないので、
 *   **本物の `alignment` を見ることができない。**
 *   だから**原因を決め打ちしない直し方**にする ——
 *   控えの終わりの秒と、**実際の音声の長さ**を突き合わせ、
 *   食い違っていたらその比で伸ばす。
 *
 *   ・時計が丸ごと速い(比の違い)     → そのまま直る
 *   ・間が抜けている(継ぎ目に溜まる) → ほぼ直る(`test:mp3` ⑩ の実測)
 *   ・**そろっていれば、1ミリ秒も動かさない**
 *
 * 【安全弁を必ず付ける】(CLAUDE.md「落とす仕組みには安全弁」)
 *   ・2% 以内なら**そろっているとみなす**(触らない)
 *   ・大きく外れていたら、当てはめそのものが崩れている。**触らない**
 *     (当てずっぽうで伸ばすと、合っていたものまで壊れる)
 * ══════════════════════════════════════════════════════════════════ */

/**
 * これ以内なら「そろっている」。1ミリ秒も動かさない(**秒**)。
 *
 * ── **比で見ていた。それが穴だった**(2026-09 実機・8手め)────────
 *
 *   > 文章を早く切りすぎなんですよ。少しタイミングが改善に向かいましたが、
 *   > まだズレていて、前の文の最後の部分が入り、
 *   > 文が終わる前に繰り返しに入っています
 *
 *   ここは **`|r - 1| <= 0.02`(2%)**で見ていた。ところが
 *
 *     50 秒の音声で 2% ＝ **1 秒**
 *
 *   である。**その 1 秒を、まるごと「そろっている」として放置していた。**
 *   しかも比のずれは**後ろへ行くほど大きくなる**ので、
 *
 *     前のほうの文 … ずれが小さい → **大丈夫**
 *     後ろのほうの文 … ずれが大きい → **前の文の最後が入る**
 *
 *   利用者の言う「**ダメな文と大丈夫な文がある**」と、そのまま合う。
 *
 *   **ハイライトでは気づけない。** あちらは「いまこの文」が合っていれば
 *   よく、端が数百ミリ秒ずれても目には正しく見える
 *   (CLAUDE.md「精度を上げるより、外れても困らない見せ方を選ぶ」)。
 *   **くり返しは、まさにその端で使う。**
 *
 *   **遊びは、比ではなく秒で持つ。** 「全体で 30ms 以内ならそろっている」
 *   なら、音声が長くなっても遊びは増えない。
 * ──────────────────────────────────────────────────────────────
 */
const CLOCK_SAME = 0.03
/** ここを外れたら、そもそも別物である。**伸ばさない** */
const CLOCK_MIN = 0.6
const CLOCK_MAX = 1.8

/**
 * 控えた時刻の**終わりの秒**(最後に時刻の付いた文字が鳴り終わる秒)。
 * 取れなければ `null`。
 */
export function alignEndOf(alignment) {
  const got = partsOf(alignment)
  if (!got) return null
  for (let i = got.to.length - 1; i >= 0; i -= 1) {
    const v = Number(got.to[i])
    if (Number.isFinite(v) && v > 0) return v
  }
  return null
}

/**
 * **控えの秒 → 音声の秒**に直すための倍率。
 *
 * @param {number} alignEnd 控えの終わりの秒(`alignEndOf`)
 * @param {number} duration 実際の音声の長さ(`el.duration`)
 * @returns {number} 倍率。**分からない・そろっている・外れすぎ は 1**
 */
export function clockScaleOf(alignEnd, duration) {
  const a = Number(alignEnd)
  const d = Number(duration)
  if (!Number.isFinite(a) || !Number.isFinite(d) || a <= 0 || d <= 0) return 1
  /* **遊びは秒で見る。比で見ない**(2026-09 実機・8手め)。
     比で 2% は、50 秒の音声では **1 秒**である。
     しかも後ろへ行くほど大きくなるので、
     **後ろの文だけが「前の文の最後が入る」**ことになる */
  if (Math.abs(d - a) <= CLOCK_SAME) return 1
  const r = d / a
  if (r < CLOCK_MIN || r > CLOCK_MAX) return 1
  return r
}

/**
 * 区間を、その倍率で伸ばす。**`item` も `charIndex` もそのまま持ち越す。**
 * 倍率が 1 なら、**同じ配列をそのまま返す**(触らない)。
 */
export function scaleSpans(spans, scale) {
  const k = Number(scale)
  if (!Array.isArray(spans) || !Number.isFinite(k) || k === 1) return spans
  return spans.map((s) => ({ ...s, start: s.start * k, end: s.end * k }))
}

/**
 * 継ぎ目に、これだけの間(ま)も無ければ「控えに間が入っていない」。
 *
 * 人が話を交代するときの無音は、どんなに詰まっていても 0.1 秒は空く。
 * 控えがそれより短い間しか言っていないなら、**向こうが間を数えていない。**
 */
export const SEAM_TIGHT = 0.08

/** 並びのまん中の値(外れ値に引きずられない) */
function median(list) {
  const a = list.filter((v) => Number.isFinite(v)).sort((x, y) => x - y)
  if (!a.length) return null
  const h = a.length >> 1
  return a.length % 2 ? a[h] : (a[h - 1] + a[h]) / 2
}

/**
 * **余った時間を、どこへ配るか**(2026-09 実機・14手め)。
 *
 * ── なぜ要るのか ───────────────────────────────────────────────
 *
 *   利用者の画面に出た数字は、こうだった。
 *
 *     控え 88.40 秒 / 音声 89.73 秒 / 倍率 1.0150
 *
 *   **倍率が 1 ではない。** つまり 8手めの「遊びを秒で見る」は届いており、
 *   時計合わせ(`clockScaleOf`)は**効いている。**
 *   それでも直らないのだから、残っているのは**配り方**である。
 *
 *   `scaleSpans` は、余った 1.33 秒を**時間に比例して**配る。
 *   ところが Text to Dialogue の音声は、**発言ごとに作ったものを
 *   つないだもの**で、数え落とされた時間は
 *   **継ぎ目(発言と発言のあいだ)に溜まっている。**
 *
 *     発言が同じ長さなら … 時間に比例 ≒ 継ぎ目の数に比例 → **たまたま合う**
 *     発言の長さがばらばらなら … **数百ミリ秒ずれる**
 *
 *   だから「長い発言のあとの文」だけが前の音を引きずる。
 *   利用者の言う「**ダメな文と大丈夫な文がある**」と、そのまま合う。
 *
 * ── **推測で決めない。控えに訊く**(CLAUDE.md)───────────────────
 *
 *   余った時間が「継ぎ目にある」のか「**終わりの余韻**にある」のかは、
 *   こちらからは聴けない。**けれども控えが知っている。**
 *
 *     継ぎ目の間(ま)が **ほとんど 0** … 向こうは間を数えていない
 *                                      → **余りは継ぎ目にある**
 *     継ぎ目の間が **0.1 秒以上ある**  … 向こうは間を数えている
 *                                      → 余りは継ぎ目ではない
 *
 *   前者だけを新しく配り直し、後者は**これまでどおり**(比で配る)。
 *   **効く場所を、測って決めた1つに絞る。**
 *
 * @param {Array<{start:number,end:number}>} spans 項目ごとの区間(控えの時計)
 * @param {number} alignEnd 控えの終わりの秒
 * @param {number} duration 実際の音声の長さ
 * @returns {{how:'same'|'scale'|'seam', k:number, per:number, gaps:number[]}}
 */
export function clockFitOf(spans, alignEnd, duration) {
  const k = clockScaleOf(alignEnd, duration)
  const list = Array.isArray(spans) ? spans : []
  const gaps = []
  for (let i = 1; i < list.length; i += 1) {
    const g = Number(list[i]?.start) - Number(list[i - 1]?.end)
    if (Number.isFinite(g)) gaps.push(g)
  }
  if (k === 1) return { how: 'same', k: 1, per: 0, gaps }
  const extra = Number(duration) - Number(alignEnd)
  // 継ぎ目が無い(1人が話しきる)ときは、配る先そのものが無い
  if (!(extra > 0) || gaps.length < 1) return { how: 'scale', k, per: 0, gaps }
  const mid = median(gaps)
  if (!(mid !== null && mid < SEAM_TIGHT)) return { how: 'scale', k, per: 0, gaps }
  /* **終わりのぶんを取り分けない。** 取り分けると1つぶんだけ配りが減り、
     こちらの言う「文の頭」が**本当より手前**になる。
     すると戻したときに**前の文の最後が入る** —— まさに直したい症状である。
     余らせるなら、**遅い側に外す**ほうがましである(頭が数十ミリ秒
     欠けるだけで、`SEEK_LEAD` がそのぶんを見ている)。 */
  return { how: 'seam', k: 1, per: extra / gaps.length, gaps }
}

/**
 * 区間を、**継ぎ目のぶんだけうしろへずらす。**
 *
 * **伸ばさない。** 話している時間そのものは控えのとおりで、
 * ずれているのは「その発言がいつ始まるか」だけである。
 *
 * 何番目の項目かは `item`(文の区間)、無ければ並び順(項目の区間)。
 */
export function shiftSeams(list, per) {
  const p = Number(per)
  if (!Array.isArray(list) || !Number.isFinite(p) || p <= 0) return list
  return list.map((s, i) => {
    const item = Number.isFinite(s.item) ? s.item : i
    const d = item * p
    return { ...s, start: s.start + d, end: s.end + d }
  })
}

/** 控えの秒 → 音声の秒(続きから始めたときの飛び先を合わせ直す) */
export function fitTime(sec, fit, spans) {
  const t = Number(sec) || 0
  if (!fit || fit.how === 'same') return t
  if (fit.how === 'scale') return t * fit.k
  return t + Math.max(0, indexAtTime(spans, t)) * fit.per
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
 * **いちばん最後の区間だけ**、この手前で折り返す(秒)。
 *
 * 音声の終わりまで待つと、**`ended` に先を越されて折り返せない。**
 * 10ms ごとに見ているので、これだけあれば取りこぼさない
 * (`audioClips.js` の `FADE_STEP`)。速さ 2.5 倍でも 25ms しか進まない。
 *
 * ── **途中の区間では、1ミリ秒も先取りしない**(2026-09 実機・7手め)──
 *
 *   > 文が終わる前に繰り返しに入り、
 *   > **速かった分だけ**前の文の最後が入ります。不愉快です
 *
 *   **これを全部の区間に掛けていた。** すると
 *
 *     ・折り返しが 40ms 早い → **文の最後 40ms が切れる**
 *     ・戻る先も同じだけ早い → **その 40ms が、前の文の最後として鳴る**
 *
 *   利用者の言う「**速かった分だけ**」が、まさにこれである。
 *
 *   **間(ま)のある文では起きない。** あちらの折り返しは
 *   「間のまん中」= 声の終わりより**後ろ**なので、40ms 引いてもまだ後ろ。
 *   **間の無い文だけが、声の途中で折り返していた** ——
 *   「ダメな文と大丈夫な文がある」の、もう半分の答えである。
 *
 *   **先取りは要らない。** 10ms ごとに見ているので、
 *   **超えた最初のひと刻みで必ず捕まる。**
 */
const REPEAT_EPS = 0.04

/**
 * **戻す先は、その声の頭の「これだけ手前」まで寄せる**(2026-09 実機・4手め)。
 *
 *   > 一瞬なのですが前の発言や文の最後の音が入ります。
 *   > 一瞬といえど違和感は非常に大きいです。
 *
 * 窓の縁(`backEdge`)は**間(ま)のまん中**にある。ところが
 * **頭出しは手前に外れる**(フレーム1枚 26ms)ので、そこを頼むと
 * 着地が**間のまん中より手前** ＝ **前の声の中**になる。
 *
 * だから**頼む先だけ、声の頭ぎりぎりまで寄せる。**
 * 外れても、着くのは**間の中**である。
 *
 * **縁そのものは動かさない** —— あれは「いまどの窓にいるか」を数えるもので、
 * 動かすと前の文へ戻り続ける(下の節)。**頼む先と、縁は別物である。**
 *
 * **これは「間があるとき」の値である。** 間が足りないところでは
 * 向きが逆になる(下の `landSec`・15手め)。
 */
export const SEEK_LEAD = 0.02

/**
 * **MP3 のフレーム1枚**(44.1kHz で 26.12ms)。
 *
 * 頭出しは**必ずフレームの切れ目に吸い寄せられる。** しかも
 * 吸い寄せられる向きは**手前**である(頼んだ秒を含むフレームの頭から鳴る)。
 * つまり **頼んだ秒より最大このぶん早く鳴り出す。**
 *
 * `SEEK_LEAD` は「間(ま)の中へ少し寄せる」ための**手前向き**の値なので、
 * **間が無いところでは向きが逆になる**(下の `landEdge`)。
 */
export const FRAME_SEC = 0.0262

/**
 * **頭出しが、頼んだ秒よりどれだけ手前に着きうるか**(秒)。
 *
 * **フレーム1枚では足りなかった**(2026-09 実機・16手め)。
 *
 *   > まだ前の音が入る → 逃がす量が足りない(1枚では足りていない)
 *
 * 15手めは「吸い寄せられるのはフレーム1枚ぶん」という**物の決まり**だけを
 * 見込んでいた。ところが実機ではまだ前の声が入る。つまり
 * **フレームの切れ目のほかにも、手前へ外す何かがある。**
 * 思い当たるのは、長い1本を**ファイルの大きさから見積もって飛ぶ**こと・
 * 端末に溜まっていた音が鳴りきること・`currentTime` が
 * 「頼んだ秒」を返しながら音だけ手前にいること、の3つだが、
 * **こちらでは1つも確かめられない**(この環境から iOS Safari は動かせない)。
 *
 * だから**外れの大きさを、こちらで見込む量として1つの名前にした。**
 * `FRAME_SEC` は**物の決まり**(MP3 のフレーム長)なので動かさない。
 * 動かすのはこちらだけである。**つまみは、この1つだけ。**
 *
 * **上げると前の声が入らなくなり、下げると文の頭が欠けなくなる。**
 * どちらの向きに外れているかは**聴ける人にしか分からない**ので、
 * 直すときは必ず利用者に**向きを1行で**訊く(Ally の雑音と同じ作法)。
 *
 * **`LAND_EPS`(着地の見張り)も、ここから取る。**
 * 書き写すと、値を変えた日に片方だけが古くなる。
 */
export const SEEK_MISS = FRAME_SEC * 3

/* ══════════════════════════════════════════════════════════════════
 * **折り返しは、声の端ではなく「間(ま)のまん中」に置く**
 * (2026-09 実機・利用者の指摘)
 *
 *   > 文ごとの繰り返しをオンにすると繰り返す際に
 *   > **前の文や発言の終わりの辺りから始まり**、
 *   > 文の終わりの方で**また前の発言に戻り**繰り返されます
 *
 *   > 文や段落ごとの繰り返しをオンにすると
 *   > **文や段落が終わり切る前に**また
 *   > **前の発言や段落の最後の部分**に戻り繰り返えされます
 *
 * 【出どころは「窓の縁が、声の端そのもの」だったこと】
 *   これまでは
 *
 *     ・戻る先   … その文の**最初の文字が鳴り出した秒**
 *     ・折り返し … その文の**最後の文字が鳴り終わった秒**
 *
 *   という、**声のぎりぎりの端**を縁にしていた。しかも
 *   いまどの文にいるかは `indexAtTime()`(始まりの秒を過ぎたか)で
 *   数えていた。**この2つが噛み合うと、こうなる。**
 *
 *     ① 折り返しが**声の端ちょうど**なので、うしろの余韻を聴かずに戻る
 *        → **「文や段落が終わり切る前に」**
 *     ② 戻った先も**声の端ちょうど**。ところが MP3 の頭出しは
 *        **フレームの切れ目に吸い寄せられる**(1枚 26ms)ので、
 *        頼んだ秒より**少し手前**に着くことがある
 *     ③ すると `indexAtTime()` は**1つ前の文**だと答える。
 *        その文はとっくに終わっているので「終わりに来た」と読まれ、
 *        **その場でもう一度、1つ前の文の頭へ戻す**
 *        → **「前の文や発言の終わりの辺りから始まり、
 *            また前の発言に戻り繰り返される」**
 *
 *   **たった 1/1000 秒でも手前に着けば起きる。** しかも
 *   `npm run lint` にも `npm run build` にも引っかからず、
 *   **音は鳴っている**ので、聴いてみるまで分からない。
 *
 * 【ハイライトは平気なのに、くり返しだけが壊れる理由】
 *   ハイライトは**文のまん中あたり**で当たっていればよい
 *   (CLAUDE.md「精度を上げるより、外れても困らない見せ方を選ぶ」)。
 *   端で少し行き来しても、目には正しく見える。
 *   **くり返しは、まさにその端で使う。** ずれがそのまま音になる。
 *
 * 【直し方 — 縁を「間(ま)のまん中」へ動かし、窓で数える】
 *   文と文のあいだには**必ず静かなところ**がある(息継ぎ・発言の間)。
 *   その**まん中**を縁にすれば、
 *
 *     ・戻る先   … 静かなところ。前の声はもう鳴り終わっている
 *     ・折り返し … 静かなところ。その文はもう言い終わっている
 *     ・**少し手前に着いても、窓から出ない**(③が起きない)
 *
 *   数えるのも `indexAtTime()` をやめ、**縁で数える**(`windowAt`)。
 *   窓は縁どうしが継ぎ目なく並ぶので、どこにいても必ずどれか1つに入る。
 *
 *   間がまったく無い(端どうしがくっついている)ところでは
 *   まん中＝端なので、**これまでと1ミリ秒も変わらない。**
 *
 * 【こちらでは、本物の音声で確かめられない】
 *   この環境から ElevenLabs にも Supabase にも届かない
 *   (`clockScaleOf` を入れたときと同じ限界。CLAUDE.md にそう書いてある)。
 *   上の①②③は**症状にぴたりと合う説明**だが、**実測ではない。**
 *   だから「何秒ずれているか」を当てて足し引きはしない ——
 *   **当てずっぽうの補正は、合っている教材を壊す。**
 *   ここでしているのは「**どちらの向きに少しずれても当たる場所へ縁を置く**」
 *   だけである。
 *
 *   **そして、これだけでは直らなかった**(2026-09 実機・利用者の指摘)。
 *   残っていたのは**縁の置き方ではなく、頭出しそのもの**である
 *   (下の `makeRepeatSeeker()` の節)。**縁の話はここまで**、
 *   と線を引いておく。
 *
 * 【いちばん最後だけは、音声の終わりまで】
 *   控えの終わりは「最後の文字が鳴り終わった秒」なので、
 *   **うしろの余韻のぶん短い。** 伸ばさないと、最後の文をくり返すときに
 *   言い終わる前に戻る(発言ごとに鳴らす道では前から伸ばしてあった。
 *   **1本の道にだけ無かった** —— ここで1か所にまとめる)。
 * ══════════════════════════════════════════════════════════════════ */

/** その区間の**手前の縁**。前の区間との間(ま)のまん中に置く */
function backEdge(list, i) {
  const s = Number(list[i]?.start)
  if (!Number.isFinite(s)) return NaN
  const p = Number(list[i - 1]?.end)
  return Number.isFinite(p) ? (p + s) / 2 : s
}

/** その区間の**向こうの縁**。最後だけは音声の終わりまで伸ばす */
function frontEdge(list, i, duration = 0) {
  const e = Number(list[i]?.end)
  if (!Number.isFinite(e)) return NaN
  if (i >= list.length - 1) {
    const d = Number(duration)
    return Number.isFinite(d) && d > e ? d : e
  }
  const n = Number(list[i + 1]?.start)
  return Number.isFinite(n) ? (e + n) / 2 : e
}

/**
 * その区間へ**戻すときに頼む秒**(`landSec`)。
 *
 * ── 15手め:**間が無いところでは、逃がす向きが逆である** ────────
 *
 *   > 良くなったがまだ完全ではない(2026-09 実機・利用者)
 *
 *   実機の数字は、継ぎ目の間(ま)が **6つとも 0.00 秒**だった。
 *   つまり**控えは、どこにも間を持っていない。** すると
 *
 *     縁(まん中) = その文の頭そのもの
 *     頼む先      = 縁より手前へ行けないので、**その文の頭ちょうど**
 *
 *   ところが頭出しは**フレーム1枚(26ms)ぶん手前に吸い寄せられる。**
 *   だから**必ず前の声の中に着く。** これが残っていた「一瞬」である。
 *
 *   **`SEEK_LEAD` は、間があることを前提にした値だった。**
 *   間の中へ 20ms 寄せておけば、吸い寄せられても間の中に着く ——
 *   **間が無ければ、その 20ms がそのまま前の声である。**
 *
 * ── 直し方:**吸い寄せられても、前の声に届かない秒を頼む** ──────
 *
 *   頼む先を `T` とすると、実際に鳴り出すのは最悪 `T − SEEK_MISS` である。
 *   だから **`T − SEEK_MISS ≥ 間の始まり`** を満たせばよい。
 *
 *     間が足りている   … これまでどおり `頭 − SEEK_LEAD`(1ミリも変えない)
 *     間が足りない     … 足りないぶんだけ**うしろへ逃がす**
 *     間がまったく無い … `頭 + SEEK_MISS`(**そのぶん頭が欠ける**)
 *
 *   **欠けるのは、その文自身の頭である。**
 *   前の文の最後が入るより、そのほうがましである(利用者の
 *   「一瞬といえど違和感は非常に大きい」は**前の声**についての言葉)。
 *   **見込んだ量より深くは欠かせない**(`頭 + SEEK_MISS` で頭打ち)。
 *
 *   **逃がす量は `SEEK_MISS` 1か所。** 15手めはフレーム1枚だったが、
 *   実機では足りなかった(16手め)。**つまみはあそこだけである。**
 *
 * @param {number} start その区間の頭(控えの秒)
 * @param {number} gap 前の区間との間(ま)。負なら 0 として見る
 * @returns {number} 頼む秒
 */
export function landSec(start, gap) {
  const s = Number(start)
  if (!Number.isFinite(s)) return NaN
  const g = Math.max(0, Number(gap) || 0)
  // 手前に外れても間の中に着く、いちばん手前
  const floor = s - g + SEEK_MISS
  // 欠けてよいのは、多くても見込んだぶんまで
  const ceil = s + SEEK_MISS
  return Math.min(ceil, Math.max(s - SEEK_LEAD, floor))
}

/**
 * その区間へ**戻すときに頼む秒。**
 *
 * **縁は数えるため、こちらは頼むため**である。取り違えない ——
 * 縁を動かすと「いまどの窓にいるか」がずれて、前の文へ戻り続ける。
 */
function landEdge(list, i) {
  const s = Number(list[i]?.start)
  if (!Number.isFinite(s)) return NaN
  /* **いちばん最初だけは、逃がさない。** 前に声が無いのだから、
     手前に外れても入ってくるものが無い(頭の無音である)。
     ここで逃がすと、頭から鳴らし直すたびにそのぶん欠ける */
  if (i <= 0) return s
  const p = Number(list[i - 1]?.end)
  return landSec(s, Number.isFinite(p) ? s - p : 0)
}

/**
 * いま、どの区間の**窓**の中にいるか。
 *
 * **`indexAtTime()` では数えない。** あちらは「始まりの秒を過ぎたか」で
 * 見るので、**間(ま)のまん中へ戻した次の刻みで1つ前を指す。**
 * すると「終わりに来た」と読まれて、**前の文へ戻り続ける。**
 * 窓は縁どうしが継ぎ目なく並んでいるので、縁で数える。
 */
function windowAt(list, t) {
  for (let i = list.length - 1; i >= 1; i -= 1) {
    if (t >= backEdge(list, i)) return i
  }
  return 0
}

/**
 * **いま「鳴らし終えた窓」があれば、その番号。** 無ければ `-1`。
 *
 * ── なぜ「いまの窓の終わりに来たか」で見ないのか(2026-09 実機・7手め)──
 *
 *   > 文が終わる前に繰り返しに入り、
 *   > **速かった分だけ**前の文の最後が入ります。不愉快です
 *
 *   窓の縁は**声の切れ目**である。そして `windowAt()` は
 *   **縁に達した瞬間、もう次の窓を指す。** つまり
 *
 *     「いまの窓の終わりに来たか」で見るかぎり、
 *     **必ず縁より手前で折り返すことになる。**
 *
 *   手前で折り返せば、**その文の最後がそのぶん切れ**、
 *   戻る先も同じだけ手前になって、**前の文の最後として鳴る。**
 *   利用者の言う「**速かった分だけ**」が、まさにこれである。
 *
 *   **間(ま)のある文では起きない。** あちらの縁は「間のまん中」＝
 *   声の終わりより**後ろ**なので、少し手前でもまだ声は終わっている。
 *   **間の無い文だけが、声の途中で折り返していた** ——
 *   「ダメな文と大丈夫な文がある」の、もう半分の答えである。
 *
 * ── 直し ──────────────────────────────────────────────────────
 *
 *   **縁を越えてから、手前の窓へ戻す。**
 *   越えたということは、その窓を**最後まで鳴らした**ということである。
 *
 *   代わりに**次の窓の頭が、ひと刻みぶん(10ms・速さ 2.5 倍でも 25ms)
 *   鳴る。** 前の文の最後が切れるより、こちらのほうがずっとよい ——
 *   くり返しの継ぎ目としては、むしろ自然である。
 *
 *   **いちばん最後の窓だけは、次の縁が無い。** あそこは音声の終わりで
 *   見るしかなく、`ended` に先を越されるので**そこだけ先取りする。**
 */
function doneWindow(list, t, duration) {
  const i = windowAt(list, t)
  // ① 手前の窓の縁を、いま越えたところ = その窓を最後まで鳴らした
  if (i > 0 && t - backEdge(list, i) <= REPEAT_EPS) return i - 1
  // ② いちばん最後は、次の縁が無いので音声の終わりで見る
  if (i === list.length - 1 && t >= frontEdge(list, i, duration) - REPEAT_EPS) return i
  return -1
}

/**
 * **くり返しの折り返し先の秒。** まだ終わりに来ていなければ `null`。
 *
 * @param {string} unit 'off' / 'sentence' / 'item' / 'all'
 * @param {number} sec  いまの秒
 * @param {object} o
 * @param {Array} o.spans     項目(段落 / 発言)の区間
 * @param {Array} o.sentences 文の区間(`sentenceSpansOf()`)
 * @param {number} o.duration 音声ぜんぶの長さ(秒)。**最後の区間を伸ばす**
 * @param {{start:number,end:number}|null} o.window
 *   集中モードが出しているかけらの区間(`spanForRange()` が縁まで込みで返す)。
 *   **渡されたらそのまま使う** —— あれは本文の途中なので、
 *   「最後だから音声の終わりまで」を当てはめてはいけない
 * @returns {number|null} 戻る先の秒
 *
 * 【文の区間が無いときは、段落で回す】
 *   文の区間は1本にまとめた音声の時刻から出す。出せないのは
 *   **1本そのものが作れていないとき**で、そのときは段落が
 *   こちらの知っているいちばん細かい単位である。
 *   **何も起きないより、近い単位で回すほうがよい**(行き止まりを作らない)。
 */
export function repeatSeek(unit, sec, {
  spans = null, sentences = null, duration = 0, window = null,
} = {}) {
  if (!REPEAT_UNITS.includes(unit) || unit === 'off') return null
  const t = Number(sec) || 0
  const items = Array.isArray(spans) && spans.length ? spans : null
  const sents = Array.isArray(sentences) && sentences.length ? sentences : null

  /* **並びから回すときは、「鳴らし終えた窓」を探す**(2026-09 実機・7手め)。
     「いまの窓の終わりに来たか」で見ると、**必ず声の途中で折り返す**
     (`doneWindow()` の節)。越えてから、手前の窓へ戻す */
  const done = (list) => {
    const i = doneWindow(list, t, duration)
    return i < 0 ? null : landEdge(list, i)
  }

  let win = null
  if (unit === 'sentence') {
    const list = sents || items
    return list ? done(list) : null
  }
  if (unit === 'item') {
    // 集中モードのかけらは、縁まで込みで渡されている
    if (!window) return items ? done(items) : null
    win = window
  } else if (unit === 'all') {
    // **全文は、いつも頭へ戻す。** 途中から鳴らし始めていても、
    // 「全文をくり返す」と言った以上は本文の頭から回る
    if (items) {
      win = { start: Number(items[0].start), end: frontEdge(items, items.length - 1, duration) }
    }
  }
  /* ここへ来るのは**集中モードのかけら**と**全文**だけ。
     どちらも「そのひとかたまりの終わり」＝音声の終わりか、かけらの端で、
     **その先に次の窓が無い。** だから、これまでどおり少し手前で見る */
  if (!win || !Number.isFinite(win.start) || !Number.isFinite(win.end)) return null
  if (t < win.end - REPEAT_EPS) return null
  /* **頼むのは `land`(声の頭ぎりぎり)。** 縁は数えるためのものである。
     **ここで縁と比べ直さない** —— 縁より手前へ行かない守りは
     `landEdge()` 1か所にある(**判断を2か所に置かない**)。
     集中モードのかけらのように `land` を持たない窓だけ、縁をそのまま使う */
  const to = Number(win.land)
  return Number.isFinite(to) ? to : win.start
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
 * **縁は `repeatSeek` と同じ考え方で取る**(2026-09 実機)。
 * かけらの端も、前後の文との**間(ま)のまん中**に置く。
 * そうしないと、ここだけ「前の文のしっぽから始まり、言い終わる前に戻る」
 * が残る。**縁の決め方を2通り持たない。**
 *
 * **縁は、狭める前の並びから取る。** 先に絞り込んでから縁を取ると、
 * 絞った側の端がいつも「いちばん最後」になり、
 * **本文の途中のかけらまで音声の終わりまで伸びる。**
 * だから絞り込みは `keep` で言い、**並びそのものは丸ごと渡す。**
 *
 * @param {Array} sentences `{ start, end, charIndex }` の並び(秒でも割合でもよい)
 * @param {{from:number,to:number}|null} range その段落の何文字目から何文字目まで
 * @param {number} base その並びが数え始めている、段落の中の文字位置
 * @param {object} [o]
 * @param {number} o.duration 音声ぜんぶの長さ(秒)。**いちばん最後だけ伸びる**
 * @param {Function|null} o.keep その段落のものだけを拾う見分け方
 * @returns {{start:number,end:number,land:number}|null} 狭められないときは `null`
 */
export function spanForRange(sentences, range, base = 0, { duration = 0, keep = null } = {}) {
  if (!Array.isArray(sentences) || !sentences.length) return null
  if (!range || !Number.isFinite(range.from) || !Number.isFinite(range.to)) return null
  const inside = []
  sentences.forEach((s, i) => {
    if (keep && !keep(s, i)) return
    const c = (s.charIndex ?? 0) + base
    if (c >= range.from && c < range.to) inside.push(i)
  })
  if (!inside.length) return null
  return {
    start: backEdge(sentences, inside[0]),
    end: frontEdge(sentences, inside[inside.length - 1], duration),
    land: landEdge(sentences, inside[0]),
  }
}

/* ══════════════════════════════════════════════════════════════════
 * **戻したあとの見張り**(2026-09 実機・利用者の指摘・3手め)
 *
 *   > 文、段落ごとの繰り返し、依然として直っていません。
 *
 *   縁を間(ま)のまん中へ移しても(上の節)、まだ直らなかった。
 *   残っていたのは「**頼んだ秒に、本当に着いているか**」を
 *   **一度も見ていなかった**ことである。
 *
 * 【MP3 の頭出しは、頼んだ秒に着くとは限らない】
 *   `el.currentTime = t` は「そこへ行ってくれ」と頼むだけで、
 *   実際に着く場所は**フレームの切れ目に吸い寄せられる**(1枚 26ms)。
 *   しかも長い1本では、ブラウザが**ファイルの大きさから見積もって**
 *   飛ぶので、**数百ミリ秒ずれることがある。**
 *
 *   手前に着くと、こうなる。
 *
 *     ① 前の文のしっぽが鳴る  → **「前の発言の終わりの辺りから始まり」**
 *     ② そこは前の窓の終わりぎわなので、また戻される
 *        → **「文が終わり切る前に、前の発言の最後の部分に戻り繰り返される」**
 *
 *   ②の歯止めは前からあったが、**「戻した先のすぐそば(0.25 秒)」**
 *   という**位置**で見ていた。**ずれがそれより大きいと素通りする。**
 *
 * 【直し方は2つ。どちらも「ずれがどれだけ大きくても」効く】
 *   ⓐ **歯止めを、位置ではなく「この秒を過ぎるまで」にする。**
 *      戻した先から少し先まで、もう戻さない。手前に着こうが
 *      先に着こうが、**前の窓へ戻る道そのものが塞がる。**
 *      短い文で行き止まりにならないよう、上限は**窓の半分まで。**
 *   ⓑ **着いた先を見て、外していたら1回だけ直す。**
 *      手前に着いていたら、そのぶん先を頼み直す。
 *      **直すのは1回まで**(際限なく飛び直すと、そこで鳴らなくなる)。
 *
 *   ⓑは**すぐには見に行かない。** 頼んだ直後の `currentTime` は
 *   「頼んだ秒」をそのまま返すことがあり、本当に着いた先が分かるのは
 *   少しあとである。だから**しばらく見張って**から決める。
 *
 * 【ここに置く理由】
 *   `readAloud.js` は Supabase を引き連れていて**素の node で
 *   一度も走らせられない**(`playMark.js` と同じ考え方)。
 *   算段だけを何にも依存しない形にしておけば、
 *   **押してみなくても**確かめられる。
 * ══════════════════════════════════════════════════════════════════ */

/** 戻した先から、これだけ先へ進むまで、もう戻さない(秒) */
export const REPEAT_HOLD = 0.25
/**
 * 頼んだ秒より、これだけ手前に着いたら「外した」とみなす(秒)。
 *
 * **2026-09 に 0.12 → 0.03 へ下げた**(実機・利用者の指摘)。
 *
 *   > 一瞬なのですが前の発言や文の最後の音が入ります。
 *   > 一瞬といえど違和感は非常に大きいです。
 *
 * **「一瞬なら耳に届かない」は、こちらの思い込みだった。**
 * 語尾の子音が 0.1 秒混じるだけで、はっきり分かる。
 * フレーム1枚(26ms)ぶんの吸い寄せは `SEEK_LEAD` が吸うので、
 * ここはそれより大きいずれだけを拾えばよい。
 */
export const SEEK_OFF = 0.03
/** 外したときに直すのは、1回だけ */
export const SEEK_TRIES = 1
/** 着いた先を見張るひと刻みの数(`audioClips.js` は 10ms ごと) */
export const LAND_TICKS = 12
/** これだけ離れていたら、こちらの戻しのせいではない(◀ ▶ で送られた) */
export const FAR = 1
/**
 * **ひと刻みでこれ以上飛んだら、鳴って進んだのではなく人が動かした**(秒)。
 *
 * ふつうは 10ms(速さ 2.5 倍でも 25ms)しか進まない。
 * **短い文を1つ送っただけでも見分けられる**よう、小さめに取る。
 */
export const JUMP = 0.1

/**
 * **くり返しで戻すときの見張り。**
 *
 * ひと刻みごとに `next(back, sec)` を呼ぶ。返るのは
 * **`seekClip()` に渡す秒**で、戻さないときは `null`。
 *
 * @param {object} [o]
 * @param {number} o.hold  戻した先から、もう戻さない長さ(秒)
 * @param {number} o.off   「外した」とみなす手前のずれ(秒)
 * @param {number} o.tries 外したときに直す回数
 * @param {number} o.ticks 着いた先を見張るひと刻みの数
 * @returns {{next: (back: number|null, sec: number) => number|null}}
 */
export function makeRepeatSeeker({
  hold = REPEAT_HOLD, off = SEEK_OFF, tries = SEEK_TRIES, ticks = LAND_TICKS,
} = {}) {
  /** この秒を過ぎるまで、もう戻さない */
  let holdUntil = -Infinity
  /** いま戻した先の控え。`{ to, ask, tries, left }` */
  let land = null
  /** 前のひと刻みの秒。**人が送ったかを見分けるため** */
  let last = null

  return {
    next(back, sec) {
      const t = Number(sec)
      if (!Number.isFinite(t)) return null

      /* ── ⓒ **人が送ったら、そこはくり返さない**(2026-09 実機・9手め)──
       *
       *   > 繰り返しはほとんど解決されました。しかし、文送り、発言送り、
       *   > 段落送りが効かなくなりました
       *
       *   7手めで「**縁を越えたら、手前の窓へ戻す**」にした。ところが
       *   **送りの行き先は「文の頭」＝まさに縁のすぐ後ろ**である。
       *   だから送った瞬間に「手前の窓を鳴らし終えた」と読まれ、
       *   **そのまま引き戻されていた。**
       *
       *   ふつうに鳴っていれば、ひと刻みで進むのは 10ms
       *   (速さ 2.5 倍でも 25ms)だけである。**それより大きく飛んだら、
       *   鳴って進んだのではなく、誰かが動かした。**
       *
       *   **自分が戻した直後は除く**(`land` が立っている)。
       */
      if (!land && last !== null && Math.abs(t - last) > JUMP) {
        holdUntil = t + hold
      }
      last = t

      /* ── ⓑ 着いた先を見る ───────────────────────────────── */
      if (land) {
        const gap = land.to - t              // + なら、頼んだ秒より手前
        /* **大きく外れているときは、こちらの戻しのせいではない**
           (◀ ▶ で送られた・別の段落へ移った)。**直さない** ——
           頭出しの外れは長くても数百ミリ秒で、`FAR` ほどは離れない */
        if (gap > off && gap < FAR && land.tries < tries) {
          land.tries += 1
          land.ask += gap
          land.left = ticks
          return land.ask
        }
        land.left -= 1
        if (land.left <= 0 || gap >= FAR || gap <= -FAR) land = null
        return null
      }

      /* ── ⓐ 戻す ──────────────────────────────────────── */
      /* **遠くへ送られたら、歯止めは古い。** ◀ ▶ で1文戻したときなど、
         こちらの戻しとは関係のない場所にいる。そのまま待たせると
         **そこを1周ぶん黙って飛ばす**(行き止まりを作らない)。

         **戻す先が来る前に見る。** あとに置くと、戻ってきたときには
         もう `holdUntil` のすぐ手前まで来ていて、**一度も捨てられない**
         (実際にそう書いて、検証に捕まえてもらった) */
      if (t < holdUntil - hold - FAR) holdUntil = -Infinity
      if (back === null || !Number.isFinite(Number(back))) return null
      const to = Number(back)
      if (t < holdUntil) return null
      /* 戻した先から、**窓の半分**か `hold` 秒か、短いほうまで待つ。
         窓の長さは「いま(＝窓の終わり)− 戻す先」で分かる。
         短い文で待ちすぎると、**そこを二度と回せなくなる** */
      holdUntil = to + Math.min(hold, Math.max(0, (t - to) / 2))
      land = { to, ask: to, tries: 0, left: ticks }
      return to
    },
  }
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
