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


/** 当てはまったと認める最低の割合。これを下回ったら使わない */
const MIN_HIT = 0.6

/**
 * ============================================================================
 * **項目と項目のあいだに鳴っている音を、どこで切るか**(第5.204節・2026-09 実機)
 *
 *   > 10 A.M. とか $25 とか、March 8 or 9、など、
 *   > **数字が出てくるとズレます。**2単語分くらいのズレでも
 *   > すごくストレスがあるので、ここは詰めてしっかり修正したいです(利用者)
 *
 * 向こうは数字を**読み下して声にする**(`$25` →「twenty-five dollars」)。
 * だから `$` `2` `5` は `alignment` のどの文字にも当たらない。
 *
 * もとは**最後に当てはまった文字で、その項目を終わり**にしていた。
 * すると `It will be an additional $20.` は
 * **「additional」を言い終わった瞬間に終わる** ——
 * 次の文は「twenty dollars」を言っている最中に光り始める。
 * 利用者の言う「2単語分くらい先に進む」は、これである。
 *
 * ── **切れ目は、空白で見つける** ──────────────────────────
 *
 *   **空白は「間(ま)」である** —— そこでは声が出ていない。
 *   項目と項目をつなぐとき、こちらは必ず空白(や改行)ではさむ。
 *   だから**向こうが読んだ文字の並びの中にある空白のかたまり**が、
 *   そのまま切れ目である。秒を当てずっぽうで足し引きしない。
 *
 *       … additional[ ]twenty[ ]dollars.[ ]It will …
 *                                        ↑ここが切れ目
 *
 *   ・**前の項目に読み下しがある**(`$20.`)… **いちばん後ろ**のかたまり。
 *     そこまでは、前の項目が言っている
 *   ・**うしろの項目に読み下しがある**(`$25 is …`)… **いちばん前**の
 *     かたまり。そこから先は、うしろの項目が言っている
 *   ・**両方にある** … どちらの空白か決められないので、**字の数で分ける**
 *     (`SEP` のぶんだけは、どちらのものでもない「間」として残す)
 *   ・**どちらにも無い** … 残っているのは句読点だけである。
 *     **その数で、同じように決める** ——
 *     `Hello there.` なら「いちばん後ろの空白まで」= ピリオドの終わりまで。
 *     **文字1つずつで当てていた頃と、1ミリ秒も変わらない**
 *
 * ── **数字が無くても、同じ決まりが通る** ────────────────────
 *
 *   `Hello there.` の `.` も「当てはまらなかった文字」である
 *   (語で当てるので、句読点は当たらない)。いちばん後ろの空白まで、
 *   つまり**ピリオドの終わりまで**が前の文 ——
 *   **文字1つずつで当てていた頃と、同じ答えになる。**
 *   **決まりを2つ持たない**(CLAUDE.md「判断は1か所に持つ」)。
 * ============================================================================
 */

/** 字の数で分けるとき、どちらのものでもない「間」のぶん */
const SEP = 1

/**
 * 向こうの `a` 文字目と `b` 文字目のあいだにある、**空白のかたまり**。
 *
 * @returns {Array<[number, number]>} `[はじめ, おわり]` の並び(どちらも含む)
 */
function spaceRuns(chars, a, b) {
  const runs = []
  for (let i = a + 1; i < b; i += 1) {
    if (!isSpace(chars[i])) continue
    const last = runs[runs.length - 1]
    if (last && last[1] === i - 1) last[1] = i
    else runs.push([i, i])
  }
  return runs
}

/** 語のかたまりを作る文字(字と数字。語の中のアポストロフィも入れる) */
const isWordChar = (c) => /[\p{L}\p{N}]/u.test(c)
const isInWord = (c) => isWordChar(c) || c === "'" || c === '’'

/**
 * 文字の並びを、**語のかたまり**に分ける。
 *
 * @returns {Array<{word:string, at:number[]}>}
 *   `at` は、その語を作っている文字の位置(**画面の英文の何文字目か**)
 */
function wordsOf(chars) {
  const out = []
  let now = null
  for (let i = 0; i < chars.length; i += 1) {
    const c = String(chars[i] ?? '')
    if (isInWord(c)) {
      /* **語の頭がアポストロフィなら、語ではない**(引用符のことが多い) */
      if (!now && !isWordChar(c)) continue
      if (!now) { now = { word: '', at: [] }; out.push(now) }
      now.word += c.toLowerCase()
      now.at.push(i)
    } else {
      /* **語の終わりのアポストロフィは落とす**(`dogs'` の `'`) */
      now = null
    }
  }
  /* **後ろのアポストロフィを、語から外す**(`don't` の `t` は残す) */
  for (const w of out) {
    while (w.word.length > 1 && !isWordChar(w.word[w.word.length - 1])) {
      w.word = w.word.slice(0, -1)
      w.at.pop()
    }
  }
  return out.filter((w) => w.word)
}

/** 語をどれだけ先まで探すか。**近くだけを見る**(遠くへ飛ばない) */
const WORD_LOOKAHEAD = 12

/**
 * ============================================================================
 * 向こうの読んだ文字の上を、順に歩く道具を作る。
 *
 * **1つの道具を使い回す**(項目をまたいでも位置を持ち越す)。
 * 作り直すと、2つめの項目が先頭から探し直して**前へ戻る。**
 *
 * ── **語のかたまりで当てる**(第5.204節・2026-09 実機)──────────
 *
 *   > 10 A.M. とか $25 とか、March 8 or 9、など、
 *   > **数字が出てくるとズレます**(利用者)
 *
 *   もとは**文字を1つずつ**、先へ 60 文字ぶん探していた。
 *   向こうは数字を声にするとき読み下す(`$25` →「twenty-five dollars」)
 *   ので、`$` `2` `5` はどこにも当たらない。そこまでは織り込み済みだった。
 *
 *   **本当に効いていたのは、そのあとである。**
 *
 *       画面 `There's a 10 A.M. departure each day.`
 *       音   `There's a ten A M departure each day.`
 *
 *   `A` は当たる。ところが次の **`.` が、文末のピリオドに当たった** ——
 *   同じ文字が先に在れば、いくら離れていても飛びつくからである。
 *   位置が文末まで飛んだので、**そこから先の `M` も `departure` も
 *   `each day` も、ぜんぶ外れた。** 当たったのは 31 文字中 10 文字
 *   (0.32)で、**下限 0.6 を割って当てはめごと断られ**、
 *   文まるごとが見積もりに落ちていた。見積もりは数字を
 *   「2文字ぶん」としか数えないので、**そこから先が全部先に進む。**
 *
 * ── だから、**語で当てる** ──────────────────────────────
 *
 *   ・`.` `,` `'` のような**1文字では当てない。** 遠くへ飛ぶ元凶である
 *   ・語は**まるごと一致したときだけ**当てる(`departure` = `departure`)。
 *     一致すれば**長さも同じ**なので、中の文字は1対1で並ぶ
 *   ・数字や読み下された語は当たらない。**そこは空のまま返す** ——
 *     埋めるのは呼ぶ側(`charTimesOf` が、当たった語と語のあいだの
 *     音をそこへ配る)。**ここで当てずっぽうをしない**
 *   ・探すのは**近くの語だけ**(`WORD_LOOKAHEAD`)。遠くは見ない
 *
 * ── どれだけ当たったかは、**字と数字だけ**で数える ────────────
 *
 *   句読点はもう当てないので、それを分母に入れると**句読点の多い文**が
 *   不当に低く出て、また断られる。**数えるのは字と数字だけ。**
 * ============================================================================
 */
function walker(chars) {
  const src = wordsOf(chars)
  /** いま、向こうの何語目まで来たか */
  let w = 0

  /**
   * @param {string} text 当てはめたい英文
   * @returns {{list:Array<{at:number,k:number}>, hit:number, rate:number}}
   *   `at` は英文の何文字目か、`k` は向こうの何文字目か(-1 = 当たらず)。
   *   `rate` は**字と数字のうち、当たった割合**
   */
  return (text) => {
    const body = String(text ?? '')
    /* **文字列のまま渡す。** ここで出る `at` は**画面の英文の何文字目か**で、
       呼ぶ側(`charTimesOf` の `start[]`・`sentenceTimesOf` の `charIndex`)も
       同じ数え方をしている。`[...body]` にすると数え方が2通りになる */
    const mine = wordsOf(body)
    /** 英文の何文字目 → 向こうの何文字目 */
    const hitAt = new Map()

    for (const one of mine) {
      /* **近くの語だけを見る。** 見つからなければ、その語は当てない */
      let found = -1
      for (let j = w; j < src.length && j < w + WORD_LOOKAHEAD; j += 1) {
        if (src[j].word === one.word) { found = j; break }
      }
      if (found < 0) continue
      const got = src[found]
      /* **まるごと一致しているので、長さも同じ。**
         そうでなければ当てない(1対1に並ばない) */
      if (got.at.length !== one.at.length) { w = found + 1; continue }
      one.at.forEach((at, i) => hitAt.set(at, got.at[i]))
      w = found + 1
    }

    const list = []
    let solid = 0
    let hit = 0
    for (let i = 0; i < body.length; i += 1) {
      const c = body[i]
      if (isSpace(c)) continue
      if (isWordChar(c)) solid += 1
      const k = hitAt.has(i) ? hitAt.get(i) : -1
      if (k >= 0 && isWordChar(c)) hit += 1
      list.push({ at: i, k })
    }
    return { list, hit, rate: solid ? hit / solid : 0 }
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
  const raw = []
  for (const text of list) {
    /* ── **字も数字も無い「文」を、断る理由にしない**(2026-09 実機)──
     *
     *   `Let's see . . . there's a 7:15 departure` を文に切ると、
     *   **`.` だけの「文」**ができる(`splitSentences`)。
     *   語で当てるようにした日から、そこは当たる語が0本なので
     *   割合が 0 になり、**本文まるごと当てはめを断っていた。**
     *   利用者の「**ハイライトが消えました**」は、これである。
     *
     *   **当てはめようがないものは、断る理由にならない。**
     *   幅0の区間を置いて、あとで**次の文の頭**に合わせる ——
     *   そこに置けば、次の文がすぐ勝つので**ちらつかない。** */
    if (!wordsOf(text).length) { raw.push(null); continue }
    const { list: marks, rate } = walk(text)
    if (!marks.length || rate < MIN_HIT) return null
    /* **その項目で、最初に当てはまった文字と最後に当てはまった文字。**
       書き換えられた場所(数字・記号)は当たらないので飛ばす */
    const first = marks.find((m) => m.k >= 0)
    let last = null
    let lastAt = -1
    for (let i = marks.length - 1; i >= 0; i -= 1) {
      if (marks[i].k >= 0) { last = marks[i]; lastAt = i; break }
    }
    if (!first || !last) return null
    /** 声になる文字か(字と数字)。**句読点は、声にならない** */
    const say = (m) => isWordChar(text[m.at])
    const headMarks = marks.slice(0, marks.indexOf(first))
    const tailMarks = marks.slice(lastAt + 1)
    raw.push({
      first,
      last,
      /** 頭・終わりに、当てはまらなかった文字が**何字**あるか(空白は数えない) */
      head: headMarks.length,
      tail: tailMarks.length,
      /** そのうち、**声になる**のは何字か(読み下された数字は、ここに入る) */
      headSay: headMarks.filter(say).length,
      tailSay: tailMarks.filter(say).length,
    })
  }

  /* **1つも当てはめられなければ、そこで断る**(全部が句読点だけ) */
  if (raw.every((r) => !r)) return null

  /** 音声の、いちばん最初といちばん最後 */
  const headSec = Number(got.from[0])
  const tailSec = Number(got.to[got.to.length - 1])

  const starts = raw.map((r) => (r ? Number(got.from[r.first.k]) : NaN))
  const ends = raw.map((r) => (r ? Number(got.to[r.last.k]) : NaN))

  /* **いちばん最初の項目が、当てはまらない文字で始まっているとき。**
     その前には何も無いので、音声の頭まで戻す */
  if (raw[0] && raw[0].head > 0 && Number.isFinite(headSec) && headSec < starts[0]) {
    starts[0] = headSec
  }

  /* **あいだの音の切れ目を、空白のかたまりで見つける**(上の注記) */
  for (let i = 0; i < raw.length - 1; i += 1) {
    if (!raw[i] || !raw[i + 1]) continue          // 語の無い「文」は、下で置く
    /* **どちらに読み下しがあるかで決める。**
       どちらにも無ければ、残った文字(句読点)の数で決める ——
       そうすると、**文字1つずつで当てていた頃と同じ答え**になる */
    let mine = raw[i].tailSay
    let yours = raw[i + 1].headSay
    if (!mine && !yours) { mine = raw[i].tail; yours = raw[i + 1].head }
    if (!mine && !yours) continue          // **どちらにも余りが無い。動かさない**

    const from = ends[i]
    const to = starts[i + 1]
    if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) continue

    if (mine && yours) {
      /* **どの空白が切れ目か決められない。** 字の数で分け、
         `SEP` のぶんだけは、どちらのものでもない「間」として残す */
      const all = raw[i].tail + raw[i + 1].head + SEP
      const w = to - from
      ends[i] = from + (w * raw[i].tail) / all
      starts[i + 1] = to - (w * raw[i + 1].head) / all
      continue
    }

    /* **切れ目の空白を1つ選ぶ。** その前は前の項目、その先はうしろの項目 ——
       **どちらも同じ1つの空白で切る**(切れ目を2つ持たない) */
    const runs = spaceRuns(got.chars, raw[i].last.k, raw[i + 1].first.k)
    if (!runs.length) {
      /* 空白が1つも無い(詰めてつないだ)。**字の数で分ける** */
      const w = to - from
      ends[i] = from + (w * mine) / (mine + yours)
      starts[i + 1] = ends[i]
      continue
    }
    /* 読み下しが**前の項目**にあるなら、いちばん**後ろ**の空白。
       **うしろの項目**にあるなら、いちばん**前**の空白 */
    const [p, q] = mine ? runs[runs.length - 1] : runs[0]
    const cutEnd = Number(got.to[p - 1])
    const cutStart = Number(got.from[q + 1])
    if (Number.isFinite(cutEnd) && cutEnd > from && cutEnd <= to) ends[i] = cutEnd
    if (Number.isFinite(cutStart) && cutStart < to && cutStart >= ends[i]) {
      starts[i + 1] = cutStart
    }
  }

  /* **いちばん最後の項目が、当てはまらない文字で終わっているとき。**
     そのあとには何も無いので、音声の終わりまで伸ばす */
  const lastOne = raw.length - 1
  if (raw[lastOne] && raw[lastOne].tail > 0
    && Number.isFinite(tailSec) && tailSec > ends[lastOne]) {
    ends[lastOne] = tailSec
  }

  /* **語の無い「文」を、次の文の頭に置く**(幅0)。
     次が無ければ、音声の終わりに置く。**前に置かない** ——
     前に置くと、そこで一瞬だけ `.` が光ってしまう */
  for (let i = raw.length - 1; i >= 0; i -= 1) {
    if (raw[i]) continue
    const next = i + 1 < raw.length ? starts[i + 1] : tailSec
    const put = Number.isFinite(next) ? next : tailSec
    starts[i] = put
    ends[i] = put
  }

  const out = []
  for (let i = 0; i < raw.length; i += 1) {
    const start = starts[i]
    const end = ends[i]
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

  const { list: marks, rate } = walker(got.chars)(src)
  if (!marks.length || rate < MIN_HIT) return null

  const start = new Array(src.length).fill(NaN)
  const end = new Array(src.length).fill(NaN)
  for (const m of marks) {
    if (m.k < 0) continue                 // 書き換えられた文字。下でまとめて埋める
    const a = Number(got.from[m.k])
    const b = Number(got.to[m.k])
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue
    start[m.at] = a
    end[m.at] = b
  }

  /* ── **読み下された数字にも、時刻を入れる**(第5.204節・2026-09 実機)
   *
   *   > 10 A.M. とか $25 とか、March 8 or 9、など、
   *   > 数字が出てくるとズレます(利用者)
   *
   *   `$25` は「twenty-five dollars」と声になるので、`$` `2` `5` は
   *   どの文字にも当たらない。**そこを空のままにしていた**ので、
   *   語ごとに光らせる側は**その語を飛ばして次へ進む。**
   *   利用者の言う「2単語分くらい先に進む」は、これである。
   *
   *   **当てずっぽうで埋めるのとは違う。** 当てはまった文字と文字の
   *   あいだの音は、**そのあいだの文字が鳴っている時間そのもの**である
   *   (ほかの何かが鳴っているわけがない)。だから
   *   **その区間を、あいだの文字の数で分ける。**
   *
   *   **両端が当てはまっているところだけ埋める。**
   *   ・前が無い(文の頭が数字)… 音声の頭から、次に当たった文字まで
   *   ・後ろが無い(文の終わりが数字)… ここでは埋めない ——
   *     その文が音声のどこで終わるかは、この関数には分からない
   *     (`spansOf` が項目の終わりとして受け持つ)。
   *     **分からないものを、分かったように埋めない**(CLAUDE.md) */
  const solid = marks.filter((m) => m.k >= 0)
  if (solid.length) {
    const fill = (from, to, gap) => {
      /* 幅が無ければ、そこに全部を置く(**時刻を逆に進めない**) */
      const span = to - from
      const step = gap.length > 0 ? span / gap.length : 0
      gap.forEach((at, i) => {
        start[at] = from + step * i
        end[at] = from + step * (i + 1)
      })
    }
    let gap = []
    let prevEnd = Number(got.from[0])
    for (const m of marks) {
      if (m.k < 0) { gap.push(m.at); continue }
      const a = Number(start[m.at])
      if (gap.length && Number.isFinite(prevEnd) && Number.isFinite(a) && a > prevEnd) {
        fill(prevEnd, a, gap)
      }
      gap = []
      if (Number.isFinite(end[m.at])) prevEnd = end[m.at]
    }
    /* ── **終わりに残った文字にも、時刻を入れる**(第5.214節・2026-09 実機)
     *
     *   > on March 8 でハイライトが前に進んでしまう現象が直っていません
     *
     *   **測ったら、そこだけ時刻が1つも入っていなかった。**
     *
     *       画面 : I'd like to book a seat on March 8.
     *       声   : I'd like to book a seat on March eighth.
     *              …  March  こちら 1.35 / 正解 1.35
     *                 8.     こちら  --              ← 時刻なし
     *
     *   `8.` は声では `eighth.` なので、どの文字にも当たらない。
     *   ここを空のままにすると、語ごとに光らせる側は
     *   **その語を飛ばして次へ進む。** 文の終わりが数字の文は、
     *   そこで必ず1語ぶん先へ出る。利用者の言う
     *   「**on March 8 で先に進む**」は、これである。
     *
     *   **以前は「この関数には分からない」と書いて埋めなかった。**
     *   それが誤りだった —— **当てはまった最後の文字より後ろに、
     *   まだ声が残っているなら、それがその文字の音である**
     *   (ほかの何かが鳴っているわけがない)。あいだを埋めるのと
     *   まったく同じ理屈で、**推測ではない。**
     *
     *   残っていなければ(声もそこで終わっているなら)、これまでどおり
     *   埋めない。**無いものを、あるように見せない。** */
    if (gap.length && Number.isFinite(prevEnd)) {
      const lastK = solid[solid.length - 1].k
      let tail = null
      for (let i = got.to.length - 1; i > lastK; i -= 1) {
        const v = Number(got.to[i])
        if (Number.isFinite(v) && v > 0) { tail = v; break }
      }
      if (Number.isFinite(tail) && tail > prevEnd) fill(prevEnd, tail, gap)
    }
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
 * ============================================================================
 * **音声の長さが、本当に分かっているか**(2026-09 実機・37手め)
 *
 *   > 未だに文のハイライトが実際の音声よりも先に進んでしまいます。
 *   > **初めて再生する時は顕著**で、2、3回目から少し落ち着くのですが、
 *   > それでも全体として一文くらいハイライトが先に進んでしまいます。
 *
 * ── **0 を「そろっている」と読んでいた** ──────────────────────
 *
 *   `<audio>` は、メタデータを読み終えるまで `duration` に **`NaN`** を返す。
 *   ところが鳴らす側は `Number(el.duration) || 0` と書いていたので、
 *   **「分からない」が 0 になって**渡っていた。
 *
 *   受け取った `clockScaleOf(alignEnd, 0)` は `d <= 0` で **1** を返す。
 *   1 は「**そろっている**(配り直す時間は無い)」という意味なので、
 *   `clockFitOf()` は `how: 'same'` を返し、
 *
 *     ・区間を**1ミリ秒も動かさない**
 *     ・`sure = true` になり、守りの余裕(`slipOf`)まで外れる
 *     ・**向こうが返した区切り(`segments`)も、まるごと素通りする**
 *
 *   しかも時計を合わせるのは**鳴り出したあとの1回きり**(`clockDone`)
 *   なので、**そのあと長さが分かっても、もう直らない。**
 *
 *   実機の数字がそのまま裏づけになっている ——
 *   **控え 64.96 秒 / 音声 66.04 秒**。1.08 秒ぶん音声のほうが長いのに、
 *   合わせずに鳴らせば、終わりでちょうど**一文ぶん**先に進む。
 *
 * ── なぜ「初めて」だけ顕著なのか ────────────────────────────
 *
 *   2回目からは MP3 が端末の控えにあるので、**最初のひと刻みには
 *   もう長さが分かっている。** だから合わせが効く。
 *   初回は 4G で落としながら鳴らすので、間に合わない。
 *   **利用者の「初めて聞くことが多い」は、いちばん悪い側である。**
 *
 * ── 直し方 ────────────────────────────────────────────────
 *
 *   **分からないうちは、合わせない。** 分かってから1回だけ合わせる。
 *   **`null` と 0 を取り違えない**(CLAUDE.md)——
 *   ここが、この不具合そのものだった。
 *
 * @param {number} d `el.duration`(まだなら `NaN`)
 * @returns {number|null} 秒。**分からなければ `null`**
 * ============================================================================
 */
export function knownDur(d) {
  const n = Number(d)
  /* **`Infinity` も「分からない」側**。長さの決まらない音では、
     倍率も窓も出しようがない */
  return Number.isFinite(n) && n > 0 ? n : null
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
/* ══════════════════════════════════════════════════════════════════
 * **発言の区切りは、向こうが返している**(2026-09・32手め)
 *
 *   > 真剣に調査しすでに成功している方法をまず探ってください。
 *   > この手の機能は世の中に溢れています(利用者)
 *
 * ── 世の中のやり方 ─────────────────────────────────────────────
 *
 *   読み上げに合わせて字を光らせる仕組み(読み上げ絵本・カラオケ・
 *   語学アプリ)は、どれも**同じ形**をしている。
 *
 *     ①音声を作った仕組みから、**区切りの時刻をそのまま受け取る**
 *     ②その時刻を SRT / VTT のような「キュー」として持つ
 *     ③鳴らすときは `currentTime` をキューの頭へ動かし、
 *      終わりを過ぎたら戻す
 *
 *   **どこも、波形から沈黙を探して時刻を当て直してはいない。**
 *   受け取った時刻が正解だからである。
 *
 * ── こちらが31回やっていたこと ───────────────────────────────
 *
 *   ElevenLabs の会話の窓口(Text to Dialogue)は、
 *   **`voice_segments` に発言ごとの本当の開始・終了秒**を返す。
 *   ところが窓口は `alignment`(文字ごと)だけを控えていた。
 *
 *   **`alignment` には、発言と発言のあいだの無音が入っていない**
 *   —— あの無音は、どの文字のものでもないからである。だから
 *
 *     控え 74.00 秒 / 音声 76.93 秒 / 継ぎ目 0.00 0.00 0.00 …
 *
 *   となる(利用者の画面に出た数字そのもの)。記事(1人が話しきる道)が
 *   ずっと正常だったのは、**段落の切れ目に渡した空行が文字として
 *   数えられる**からで、20手めの分かれ目の話とも噛み合う。
 *
 *   14手めは足りない時間を継ぎ目に**均等に**配り、17・19・31手めは
 *   **波形から測ろう**とした。どれも**正解を捨てたうえでの当て推量**
 *   だった。
 *
 * ── だから、そのまま使う ───────────────────────────────────────
 *
 *   `offs[i] = 向こうが言う発言の頭 − 控えが言う発言の頭`
 *
 *   これを控えの区間に足すだけで、**発言の頭は実測と1ミリ秒も違わない。**
 *   発言の**中**の文と文は、もともと控えの時計で正しい(そこには
 *   無音が挟まれていない)ので、同じずれを当てれば全部そろう。
 *
 *   **波をほどく必要も、しきい値も、均等配りも要らなくなる。**
 * ══════════════════════════════════════════════════════════════════ */

/** 1つめの発言のずれの上限。ここが大きいなら、対が食い違っている */
export const SEG_HEAD = 0.5
/** うしろへ戻る向きの、許す揺らぎ(無音は増える一方のはずである) */
export const SEG_BACK = 0.05

/**
 * **`voice_segments` から、項目ごとのずれを出す。**
 *
 * @param {Array} segments 窓口が控えた `voice_segments` そのもの
 * @param {Array<{start:number,end:number}>} spans `spansOf()` の返り値
 * @returns {number[]|null} 項目ごとに足す秒。**合わなければ `null`**
 *
 * 【合わなければ、何も返さない】
 *   当てずっぽうでずらすと、**別の発言の場所を指す。**
 *   ずれた対は、無いより悪い(`spansOf` と同じ考え方)。
 *   返さなければ、これまでどおりの受け皿に落ちるだけである。
 */
function orderSegs(segments, n) {
  const segs = Array.isArray(segments) ? segments : null
  if (!segs || !n || segs.length !== n) return null
  /* **並び順で当てない。** 向こうは `dialogue_input_index` で
     「渡した何番目の入力か」を言っている。無いときだけ並び順に落とす */
  const by = new Array(n).fill(null)
  segs.forEach((s, i) => {
    const at = Number.isFinite(Number(s?.dialogue_input_index))
      ? Number(s.dialogue_input_index) : i
    if (at >= 0 && at < by.length && !by[at]) by[at] = s
  })
  return by.some((s) => !s) ? null : by
}

export function segOffsOf(segments, spans) {
  const list = Array.isArray(spans) ? spans : null
  if (!list || !list.length) return null
  const by = orderSegs(segments, list.length)
  if (!by) return null

  const offs = []
  for (let i = 0; i < list.length; i += 1) {
    const real = Number(by[i].start_time_seconds)
    const said = Number(list[i]?.start)
    if (!Number.isFinite(real) || !Number.isFinite(said)) return null
    offs.push(real - said)
  }
  // ①1つめは、どちらの時計でも頭のはずである
  if (Math.abs(offs[0]) > SEG_HEAD) return null
  // ②無音は増える一方。**減る向きに大きく動くなら、対が食い違っている**
  for (let i = 1; i < offs.length; i += 1) {
    if (offs[i] < offs[i - 1] - SEG_BACK) return null
  }
  return offs
}


/**
 * ============================================================================
 * **発言の「終わり」も使う**(第5.214節・2026-09 実機・利用者の指摘)
 *
 *   > 文ごとのリピートをしたら、相変わらず最後まで再生される前に折り返され、
 *   > 前の文の途中から繰り返されます。学習用アプリとしてこれは致命的です。
 *
 * ── なぜ起きるか ─────────────────────────────────────────────
 *
 *   控えの時計より、鳴っている音のほうが長い(実機で **控え 64.00 秒 /
 *   音声 65.41 秒**)。この 1.41 秒が、そのまま症状になる。
 *
 *     ・控えの終わり `b` を過ぎた時点で戻す → **音はまだ `b + δ` まで続く**
 *       ＝ 最後まで再生される前に折り返す
 *     ・控えの頭 `a` へ飛ぶ → **音の上ではまだ前の文の中**
 *       ＝ 前の文の途中から繰り返される
 *
 *   **2つの症状は、1つの原因である。**
 *
 * ── こちらが捨てていた正解 ───────────────────────────────────
 *
 *   `voice_segments` は発言ごとに
 *   **`start_time_seconds` と `end_time_seconds` の両方**を返している。
 *   ところが 32手め(`segOffsOf`)は**始まりしか読んでいなかった。**
 *
 *   だから「発言の頭」だけが実測に合い、**発言の中は控えの時計のまま**
 *   だった。1つの発言が数文あれば、その中で先へ進んでいく。
 *
 *   **もらえる正解を捨てない。まず、返ってくるものを全部読む**(CLAUDE.md)。
 *   これは 39手のあいだ、ずっと目の前にあった。
 *
 * ── 何をするか ───────────────────────────────────────────────
 *
 *   発言 i について、**控えの窓**(`said`)を**本当の窓**(`real`)へ写す。
 *
 *       t' = real.start + (t − said.start) × (real の幅) ÷ (said の幅)
 *
 *   頭も尻も実測に合い、あいだは幅の比で配る。
 *   **当て推量が1つも入らない** —— どちらの窓も向こうが言った数字である。
 *
 * ── 合わなければ、何も返さない ───────────────────────────────
 *
 *   当てずっぽうで伸ばすと、**別の文の場所を指す。**
 *   ずれた対は、無いより悪い(`spansOf` と同じ考え方)。
 *   返さなければ、これまでどおり `segOffsOf` の受け皿に落ちるだけである。
 * ============================================================================
 */

/** 幅の比の、許す範囲。これを外れたら対が食い違っている */
export const SEG_K_MIN = 0.5
export const SEG_K_MAX = 2

/**
 * **発言ごとの「控えの窓 → 本当の窓」。**
 *
 * @param {Array} segments 窓口が控えた `voice_segments` そのもの
 * @param {Array<{start:number,end:number}>} spans 項目ごとの区間(控えの時計)
 * @returns {{from:number,span:number,to:number,k:number}[]|null}
 */
export function segWindowsOf(segments, spans) {
  const list = Array.isArray(spans) ? spans : null
  if (!list || !list.length) return null
  const by = orderSegs(segments, list.length)
  if (!by) return null

  const out = []
  let prevEnd = -Infinity
  for (let i = 0; i < list.length; i += 1) {
    const a = Number(by[i].start_time_seconds)
    const b = Number(by[i].end_time_seconds)
    const p = Number(list[i]?.start)
    const q = Number(list[i]?.end)
    if (![a, b, p, q].every(Number.isFinite)) return null
    // 窓が逆さ・つぶれている / 前の発言より前に戻る → 対が食い違っている
    if (b <= a || q <= p || a < prevEnd - SEG_BACK) return null
    const k = (b - a) / (q - p)
    if (!(k >= SEG_K_MIN && k <= SEG_K_MAX)) return null
    out.push({ from: p, span: q - p, to: a, k })
    prevEnd = b
  }
  // ①1つめは、どちらの時計でも頭のはずである(`segOffsOf` と同じ歯止め)
  if (Math.abs(out[0].to - out[0].from) > SEG_HEAD) return null
  return out
}

/**
 * 区間を、**発言ごとの窓へ写す。**
 *
 * 何番目の項目かの見方は `shiftItems()` とそろえる ——
 * `item`(文の区間)、無ければ並び順(項目の区間)。
 * **数え方を2通り持たない。**
 */
export function fitWindows(list, wins) {
  if (!Array.isArray(list) || !Array.isArray(wins) || !wins.length) return list
  return list.map((s, i) => {
    const item = Number.isFinite(s.item) ? s.item : i
    const w = wins[item]
    if (!w) return s
    const at = (t) => w.to + (t - w.from) * w.k
    return { ...s, start: at(s.start), end: at(s.end) }
  })
}

/**
 * **発言ごとの実測を、いちばん良い形で1つに決める**(第5.214節)。
 *
 * **窓(始まり+終わり)が使えるならそちら。** だめなら頭だけ(32手め)。
 * **呼ぶ側に 2通りの分岐を置かない**(CLAUDE.md「判断は1か所に持つ」)——
 * 1本の中の1項目を鳴らす道と、通しで鳴らす道の**2か所**から呼ばれる。
 *
 * @returns {{how:'windows'|'heads', wins:Array|null, offs:number[]|null}|null}
 */
export function segFitOf(segments, spans) {
  const wins = segWindowsOf(segments, spans)
  if (wins) return { how: 'windows', wins, offs: null }
  const offs = segOffsOf(segments, spans)
  return offs ? { how: 'heads', wins: null, offs } : null
}

/** その決め方で、区間を写す。**渡さなければ何もしない** */
export const segApply = (list, fit) => (!fit ? list
  : fit.wins ? fitWindows(list, fit.wins) : shiftItems(list, fit.offs))

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

/**
 * 区間を、**項目ごとに測ったぶんだけずらす**(2026-09 実機・17手め)。
 *
 * `shiftSeams()` は「どの継ぎ目も同じ間(ま)」という**当て推量**である。
 * 実際の間は継ぎ目ごとに違うので、音声から測れたときはこちらを使う
 * (`seamFind.js`)。**ずらすだけ。伸ばさない**のは同じ。
 *
 * 何番目の項目かの見方も `shiftSeams()` とそろえる ——
 * `item`(文の区間)、無ければ並び順(項目の区間)。
 * **数え方を2通り持たない。**
 */
export function shiftItems(list, offs) {
  if (!Array.isArray(list) || !Array.isArray(offs) || !offs.length) return list
  return list.map((s, i) => {
    const item = Number.isFinite(s.item) ? s.item : i
    const d = Number(offs[item])
    if (!Number.isFinite(d) || d === 0) return s
    return { ...s, start: s.start + d, end: s.end + d }
  })
}

/**
 * 区間を、**1つずつ測ったぶんだけずらす**(2026-09 実機・19手め)。
 *
 * `shiftItems()` は「同じ項目の文には、同じずれ」である。だから
 * **発言の中の文と文の継ぎ目は、控えの時計のまま**だった ——
 * ElevenLabs が空白に何秒を割り当てたか任せで、たいてい足りない。
 * 文そのものを測れたときは、こちらで**1文ずつ**当てる。
 *
 * **ずらすだけ。伸ばさない**のは `shiftItems()` と同じ。
 */
export function shiftEach(list, offs) {
  if (!Array.isArray(list) || !Array.isArray(offs) || offs.length !== list.length) return list
  return list.map((s, i) => {
    const d = Number(offs[i])
    if (!Number.isFinite(d) || d === 0) return s
    return { ...s, start: s.start + d, end: s.end + d }
  })
}

/** 控えの秒 → 音声の秒(続きから始めたときの飛び先を合わせ直す) */
export function fitTime(sec, fit, spans) {
  /* **窓で写したときは、同じ写し方で秒も写す**(第5.214節)。
     ここを足し忘れると、続きから始めたときの飛び先だけが古い時計のままで、
     **鳴り出しの一瞬だけ別の場所へ跳ぶ** */
  if (fit?.wins) {
    const t0 = Number(sec) || 0
    const w = fit.wins[Math.max(0, indexAtTime(spans, t0))]
    return w ? w.to + (t0 - w.from) * w.k : t0
  }
  if (fit?.how === 'measured') {
    const t0 = Number(sec) || 0
    const i = Math.max(0, indexAtTime(spans, t0))
    return t0 + (Number(fit.offs?.[i]) || 0)
  }
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
 *
 *   → **この2行は 18手めで取り下げた。** 下の `REPEAT_LOOK` を見ること。
 *     刻みは飛ぶし、**超えた最初のひと刻み**では
 *     すでに次の声が鳴っている。
 */
const REPEAT_EPS = 0.04

/**
 * **折り返しは「間(ま)のまん中」ではなく、「声が終わったところ」で**
 * (2026-09 実機・21手め)。
 *
 *   > ダメですね。次の音が入ります。
 *   > いい加減にプロらしい仕事をしてください。(利用者)
 *
 * ## 20回直して直らなかったのは、**測り方が間違っていた**から
 *
 * 検証(⑭)は、`repeatSeek()` が折り返しを返した**その瞬間に音が止まる**
 * ものとして数えていた。だから緑だった。
 *
 * **実機では止まらない。** 決めてから本当に黙るまでに、
 *
 *   ①そのひと刻みの残りの処理(色・文の位置・かけらの絞り込み…)
 *   ②`pause()` が音の側へ届くまで
 *   ③すでに端末へ渡してある音が鳴りきるまで
 *
 * の**遅れ**がある。**その遅れのぶん、次の声が鳴る。**
 * 15ms 先取りしても、遅れが 30ms あれば足りない。
 * **数えていない量を、定数で当てにいっていた。**
 *
 * ## 折り返す場所が、そもそも間違っていた
 *
 * `foldAt()` は**間のまん中**を返していた。つまり
 * **わざわざ間の半分まで鳴らしてから**止めていたことになる。
 * 遅れは、そこから**次の声へ直に食い込む。**
 *
 * | | 折り返す場所 | 遅れを受け止める余裕 |
 * |---|---|---|
 * | 前 | 間のまん中 | **間の半分だけ** |
 * | いま | **声が終わったところ** | **間ぜんぶ** |
 *
 * **止める場所と、戻る先は別物である。**
 * 戻る先は、これまでどおり**間のまん中**でよい(4手め)——
 * あちらは「頭出しが手前に外れても、前の声に食い込まない」ための値である。
 * **止めるほうは、早ければ早いほどよい。**
 *
 * ## それでも足りないぶんだけ、自分の声の終わりをもらう
 *
 * 間が `REPEAT_LEAD` より狭い継ぎ目では、間ぜんぶを使っても足りない。
 * そこだけ**足りないぶんを、自分の声の終わりから**もらう。
 *
 *   もらう量 = max(0, REPEAT_LEAD − 間)
 *
 * - 間が `REPEAT_LEAD` より広ければ **1ミリ秒ももらわない**(声は1つも欠けない)
 * - 間が 0 なら `REPEAT_LEAD` ぶんもらう(**自分の声の終わりがそのぶん欠ける**)
 *
 * **なぜ欠けるほうを選ぶか。** 耳は**音の立ち上がり**にとても鋭く、
 * **消えぎわ**には鈍い。次の語の頭(破裂音・子音の立ち上がり)が
 * 30ms 鳴れば、はっきり「入った」と分かる。ところが自分の声の
 * 消えぎわが 50ms 短くなっても、ほとんど気づかない。
 * **同じ 50ms でも、聞こえ方がまるで違う。**
 *
 * 18手めは逆を選んでいた(「欠けるのは多くても 15ms」を守った)。
 * **その優先順位が、そもそも間違っていた。**
 *
 * ## 50ms では足りなかった(2026-09 実機・22手め)
 *
 *   > 次の文の音がいまだに入ります。
 *
 * **21手めで、こちらから訊いた「どちらに外れているか」への答えである。**
 * 向きが確かめられたので、もう推測ではない ——
 * **決めてから黙るまでの遅れが、見込んだ 50ms より大きい。**
 *
 * **これは「定数をいじる」のとは違う。** 21手めで作った仕組みが、
 * まさにこの1つを**外から決められるように**してある。
 * 利用者が向きを1つ言えば、動かすところは1か所に決まる。
 *
 * **上げても、間(ま)のある継ぎ目は1ミリ秒も欠けない。**
 * もらうのは `max(0, (REPEAT_LEAD + ひと刻み) − 間)` なので、
 * 間が 130ms より広ければ**もらう量は 0** である。
 * 払うのは**間がほとんど無い継ぎ目だけ** —— そこは
 * 自分の声の終わりが最大 130ms 欠ける。
 *
 * **上限は、利用者の耳が決めている。** 切り落としを試した回で
 * **150ms は「まだ散見される」で通り、200ms は「発言の最後が
 * 消えました。ダメです」だった。** だからその手前に置く。
 *
 * **こちらでは、遅れそのものを測れない。** JS からは
 * 「`pause()` を呼んでから本当に黙るまで」を読む手段がない
 * (`currentTime` は止めた位置で凍るだけである)。
 * だから**測るのではなく、耐える量を決める。**
 *
 * ## 0.12 は、**2つの別物を1つの数にしていた**(2026-09 実機・24手め)
 *
 *   > 先日はスコットランドの音声だけがおかしく、それを直そうとしたら
 *   > 他の教材のリピートまでおかしくなりました。つまり、理由は分からないが、
 *   > スコットランドの音声の教材だけが何かしらの不備があり、
 *   > それに合わせすぎで汎用性がなくなってしまった可能性があります
 *
 * **利用者の見立てが、そのまま当たっていた。** ここが吸っていたのは
 * **別々の2つ**である。
 *
 * | 何を吸うか | 何のものか | 大きさ |
 * |---|---|---|
 * | **遅れ**(決めてから黙るまで) | **端末**のもの。教材によらない | **0.05**(21手めで実測) |
 * | **境目のずれ**(控えが言う秒と、本当に声が終わる秒の差) | **その教材**のもの | 会話の道 ≈ `SLIP` / **記事は 0** |
 *
 * 22手めで 0.05 → 0.12 に上げたのは**後者のため**だった。ところが
 * この定数は**全教材にかかる。** つまり
 * **控えが正しい教材まで、直すものが無いのに払っていた。**
 *
 * **実測(控えが正しい教材で、いま何ミリ秒を捨てていたか)。**
 *
 * | 間(ま) | 自分の声の終わり |
 * |---|---|
 * | 0ms | **130ms 欠ける** |
 * | 50ms | 80ms 欠ける |
 * | 100ms | 30ms 欠ける |
 * | 130ms 以上 | 0 |
 *
 * **利用者は「150ms でもまだ散見される」「200ms は発言の最後が消えて
 * ダメ」と言っている。** その帯に、直す必要のない教材まで入れていた。
 *
 * **だから 0.05 に戻す。** 境目のずれは `SLIP` が別に持ち、
 * **信じられない教材にだけ足す**(`slipOf()`)。
 * **上げ下げで帳尻を合わせるのをやめ、出どころで分ける。**
 *
 * ## **やっと測った。遅れは 0 だった**(2026-09 実機・26手め)
 *
 *   > 声の後ろが切れます。短い文は必ず後ろが切れます(利用者)
 *
 * **「短い文は必ず」が決め手だった。** 削る量は**間(ま)の広さだけ**で
 * 決まり、文の長さはどこにも入っていない。**同じ 70ms でも、
 * 2秒の文では語尾の余韻だが、`Right.` では /t/ がまるごと消える。**
 *
 * ── **模型の中で、一度も測っていない量が1つだけ残っていた** ────────
 *
 *   この値は「決めてから、本当に黙るまでの遅れ」を見込むものだが、
 *   **21手めで推測して置き、22手めで耳を頼りに上げただけ**である
 *   (しかもその 22手めは、あとで**別の教材の境目のずれ**だったと分かった)。
 *   **21手めの戒め「模型に無い量は、いくら直しても当たらない」を、
 *   模型の中の量にも当てはめていなかった。**
 *
 * ── 測り方 ────────────────────────────────────────────────────
 *
 *   **振幅が位置に比例する WAV**(3秒・440Hz)を本物の `<audio>` で鳴らし、
 *   `currentTime` が 1.000 秒になった瞬間に黙らせて、
 *   **そのあと出てきた音の大きさ**から「どこまで出たか」を逆算する。
 *
 *   | やり方 | 決めたあとに出た音(5回) |
 *   |---|---|
 *   | `volume=0` → `muted` → `pause()` | **0 / 0 / 0 / 0 / 0 ms** |
 *   | `pause()` だけ | **0 / 0 / 0 / 0 / 0 ms** |
 *   | 素の頭出しだけ | **0 / 0 / 0 / 0 / 0 ms** |
 *
 *   しかも**決める前に捕まえた位置は 978ms** —— 出口は `currentTime` より
 *   **22ms 遅れている。** つまり `currentTime = X` で止めると、
 *   聴いている人は **X より手前**までしか聴いていない。
 *   **先の音は1ミリ秒も出ない。**
 *
 * ── だから 0 にする ───────────────────────────────────────────
 *
 *   **起きていないことに備えて、毎回声の後ろを削っていた。**
 *   ひと刻みぶん(`step`)は `foldNeed()` が別に足すので、ここは 0 でよい。
 *
 *   - **境目のずれ(`SLIP`)は残す。** あれは別のもので、
 *     会話の道では実在する(20手め)
 *   - **`landSec()` には影響しない**(あちらは頭出しの吸い寄せ・25手め)
 *   - **iPhone では測れていない。** もし「次の文の音が入る」に振れたら、
 *     **つまみはここ1つ**である(ひと刻みずつ上げる)
 */
export const REPEAT_LEAD = 0

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

/* ══════════════════════════════════════════════════════════════════
 * **戻したあと、頭の少し手前にいても「その中」と読む**(2026-09・35手め)
 *
 *   > 発言や段落の一文目をリピートする際に、リピートするたびに
 *   > 画面が一瞬切り替わるような挙動をします(利用者)
 *
 * ── なぜ一文目だけなのか ───────────────────────────────────
 *
 *   戻す先は `landSec()` が決めており、**わざと頭の `SEEK_LEAD` 手前**に
 *   置いてある(前の声に食い込ませないため・4手め)。しかも MP3 の
 *   頭出しは**フレームの切れ目に吸い寄せられる**(`FRAME_SEC`)。
 *
 *   ふつうの文なら、その数十ミリ秒は**同じ発言の中**なので何も起きない。
 *   ところが**一文目**では、そこが**前の発言の側**である。すると
 *
 *     `indexAtTime()` が1つ前の発言を返す → 画面がそちらへ切り替わる
 *     → 数十ミリ秒後に境目を越えて、また戻る
 *
 *   これが「一瞬切り替わる」の正体である。**音は1ミリ秒もずれていない。**
 *   ずれているのは「いまどこにいるか」の読み方だけである。
 *
 * ── 直し ──────────────────────────────────────────────────
 *
 *   **戻す先の作り方から、そのまま出す。** 手前に置いた量
 *   (`SEEK_LEAD`)と、吸い寄せられる量(`FRAME_SEC`)の合計より
 *   手前でなければ、**もうその項目の中にいる**と読む。
 *
 *   **新しい数を決め打ちしない** —— どちらも、その値がある理由が
 *   別の節に書いてある(CLAUDE.md「数えられるものを決め打ちにしない」)。
 *
 * ── **先へは効かせない**(2026-09 実機・36手め・こちらの入れ違い)───
 *
 *   > 初めの分は直りました。ちなみに、最後の文でもなりますので、
 *   > こちらも修正お願いします(利用者)
 *
 *   35手めは `indexAtTime(spans, sec + lead)` と書いた。これは
 *   「手前にいても中と読む」と同時に、**次の項目にも 46ms 早く
 *   切り替わる**ということである。すると
 *
 *     **最後の文**をくり返すと、折り返す直前の1〜4コマだけ
 *     **次の発言**に切り替わり、戻したあとにまた戻る
 *
 *   —— 一文目で消したのと同じちらつきを、**最後の文で作っていた。**
 *
 *   要るのは**戻る向きの歯止めだけ**である。前へは、これまでどおり
 *   本当に頭へ着いてから切り替える(`stickyIndex`)。
 * ══════════════════════════════════════════════════════════════════ */
export const HEAD_LEAD = SEEK_LEAD + FRAME_SEC

/**
 * **いま出しているものから、わずかに戻っただけなら、そのままにする。**
 *
 * 前へは何もしない —— **先取りすると、最後の文で同じちらつきが出る。**
 *
 * @param {Array<{start:number}>} spans 区間(項目でも文でもよい)
 * @param {number} sec いまの秒
 * @param {number|null} shown いま出している番号
 * @param {number} [lead] これだけ手前までは「まだその中」と読む
 * @returns {number} 出すべき番号
 */
export function stickyIndex(spans, sec, shown, lead = HEAD_LEAD) {
  const i = indexAtTime(spans, sec)
  if (i < 0 || shown === null || shown === undefined || shown < 0) return i
  /* **いま出しているものの頭から、これだけ手前まで。**
     大きく戻ったのは人が送ったのだから、そのまま従う
     (◀◀ で1つ前の段落へ、など)。

     **「1つだけ手前のときに限る」という歯止めは置かない**
     —— 2つ手前で、なお 46ms 以内という並びは作れなかった
     (発言も文も、それより短くはならない)。
     **確かめられない歯止めを置かない**(31手めの `FLOOR_CAP` と同じ) */
  if (i >= shown) return i
  const head = Number(spans[shown]?.start)
  if (!Number.isFinite(head)) return i
  return (head - (Number(sec) || 0) <= (Number(lead) || 0)) ? shown : i
}

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
 *
 * ## **ここは小さくしてはいけなかった**(2026-09 実機・25手め)
 *
 *   > 半分くらいの文が終わる前に折り返され、
 *   > 前の文の最後の部分から始まります(利用者)
 *
 * 24手めで、`REPEAT_LEAD` と同じ理屈で1枚へ戻した。**それが誤りだった。**
 * 間(ま)が 30ms の継ぎ目で頼む先を出すと、こうなる。
 *
 * | | 頼む先 | 吸い寄せられた最悪 |
 * |---|---|---|
 * | 3枚 | **頭 + 48.6ms**(声の中) | ちょうど前の声の終わり |
 * | 1枚 | 頭 − 3.8ms(間の中) | ちょうど前の声の終わり |
 *
 * **最悪値は同じ。ちがうのは、どちらへ倒してあるか**である。
 * 3枚は「必ず声の中へ入る」側に倒してあり、1枚は**間の上でぎりぎり
 * 釣り合っている** —— ほんの少しでも手前に外れれば前の声である。
 *
 * **折り返しと頭出しは、優先順が違う。**
 *
 * | | 何を失うか | 利用者の判断 |
 * |---|---|---|
 * | 折り返し(`REPEAT_LEAD`) | **自分の声の終わり** | 150ms で「散見される」 |
 * | 頭出し(`SEEK_MISS`) | **前の声が入る**(倒し方を誤ると) | 「一瞬といえど違和感は非常に大きい」 |
 *
 * だから**同じ物差しで動かさない。**
 * `REPEAT_LEAD` は教材ごとに絞ってよいが、**ここは絞らない**
 * (`landSec()` は `slip` を受け取らない)。
 *
 * ## **道具ごと消した**(2026-09 実機・29手め)
 *
 * **あらかじめ倒すのをやめた**ので、この見込みは誰も使わなくなった
 * (`landSec()` の節)。手前に外れたぶんは、`seekClip()` の着地の見張りが
 * **黙ったまま**直す —— **同じ役目のものを2つ持たない。**
 *
 * **値を偽にして残さない。** 残すと、次に見た人が「まだ使うのかもしれない」
 * と読み、また配線する(0.12 の埋め合わせで3回それをやった)。
 * 吸い寄せの大きさそのものは `FRAME_SEC`(物の決まり)が持っている。
 */

/**
 * **境目のずれ**(秒)。**その教材の控えを、どれだけ信じてよいか。**
 *
 * 控えが「ここで声が終わる」と言う秒と、**本当に終わる秒**の食い違いである。
 * `REPEAT_LEAD`(遅れ)や `SEEK_MISS`(吸い寄せ)と違い、
 * **端末のものでも物の決まりでもなく、その教材のもの**である。
 *
 * | どんな教材か | ずれ |
 * |---|---|
 * | 記事・スピーチ(1人が話しきる) | **0**。控えは空白まで数えている |
 * | 会話・会議(発言ごとに作ってつなぐ) | **あり**。継ぎ目の無音が控えに入っていない |
 *
 * この分かれ目は **`clockFitOf()` の `how` がすでに答えている**
 * (20手めで、どちらの窓口で作られたかまで突き止めてある)。
 * ところが**折り返しの側からは、一度も見ていなかった。**
 *
 * ## **0.12 は、根を直したあとの残りかすだった**(2026-09 実機・28手め)
 *
 *   > 再び1ミリも変わりません(利用者・2回続けて)
 *
 * **2回続けて「変わらない」は、道が違うという意味である。**
 * 声の後ろを削る道を数え直すと、**5つ**あった。
 *
 * | 鳴り方 | 区間の出どころ | 27手めまで |
 * |---|---|---|
 * | 1本 | そろっている(`same`) | 10ms |
 * | 1本 | 音から測った(`measured`) | 10ms |
 * | 1本 | **測れず、均等に配った** | **130ms** |
 * | 発言ごと | `.json` の本当の時刻 | 10ms |
 * | 発言ごと | **語の重みからの見積もり** | **130ms** |
 *
 * **時刻の控えが付く前に作った音声は、いちばん下に落ちる。**
 * あそこは見積もりなので**文と文が地続き**(間が 0)——
 * **毎回きっちり 130ms 削られる。** 24〜27手めは、
 * そこへ**一度も届いていなかった。**
 *
 * ── **0.12 の出どころを、もう一度たどる** ─────────────────────
 *
 *   22手めで「次の文の音がいまだに入ります」と言われて上げた値である。
 *   ところがその原因は、**20手めで突き止め、14・17・19手めで
 *   根から直してある**(継ぎ目の無音が控えに入っていなかった。
 *   いまは音から測って合わせる)。
 *
 *   **つまりこれは、根を直したあとに残っていた埋め合わせである。**
 *   遅れは実測 0(`REPEAT_LEAD` の節)。境目のずれは測って直した。
 *   **守るものが無いのに、毎回 130ms 払っていた。**
 *
 * ── **見積もりの道では、そもそも守れていない** ─────────────────
 *
 *   語の重みから割った区間は `end[i] === start[i+1]`(地続き)である。
 *   その**当てずっぽうの境目**から 130ms 手前で折り返しても、
 *   **何も守っていない** —— ずれているのは境目そのもので、
 *   手前に寄せれば**必ずそのぶん声が消える**だけである。
 *
 * ── だから、ひと刻み2つぶんにする ─────────────────────────────
 *
 *   **どの道でも、声の後ろを削るのは 30ms を超えない。**
 *   利用者が「散見される」と言った 150ms の 1/5 である。
 *
 *   **仕組みは残す。** 「この教材の境目をどれだけ信じてよいか」は
 *   本当に道ごとに違うし、**次に「次の文の音が入る」に振れたときの
 *   つまみ**でもある(`REPEAT_LEAD` と2つ)。
 */
export const SLIP = 0.02

/**
 * **その教材のずれ。** 控えを信じてよければ 0、そうでなければ `SLIP`。
 *
 * **既定は「信じない」。** 取り違えたときの害が、桁で違うからである。
 *
 *   信じてよい教材を「信じない」と読む … 声の終わりが少し欠ける
 *   信じられない教材を「信じる」と読む … **次の文の音が入る**
 *
 * 利用者が「一瞬といえど違和感は非常に大きい」と言ったのは**後者**である。
 *
 * @param {boolean} sure 控えの秒をそのまま信じてよいか
 */
export function slipOf(sure) {
  return sure === true ? 0 : SLIP
}

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
 * その区間を**鳴らし終える秒**(18手め)。ここを越えたら、もう次の声である。
 *
 * ふだんは次の区間との**縁(間のまん中)**だが、控えの終わりが
 * 実際より長いと縁が次の声より後ろに来る。**そこは次の声の頭で止める** ——
 * 先取りが**次の声に食い込んでは、直した意味がない。**
 */
/**
 * **足りないぶんだけ、自分の声の終わりからもらう**(21手め)。
 *
 * 遅れを受け止めるのに `REPEAT_LEAD` 要る。まず**間(ま)から**使い、
 * 足りないぶんだけ声をもらう。**間が足りていれば 0**(1ミリ秒も欠けない)。
 */
export function foldNeed(list, i, step = 0, slip = SLIP) {
  const e = Number(list[i]?.end)
  const n = Number(list[i + 1]?.start)
  if (!Number.isFinite(e) || !Number.isFinite(n)) return 0
  /* 受け止めるのは**3つ**である。1つでも落とすと、間がぎりぎりの継ぎ目で
     ひと刻みぶんだけ次の声が鳴る(実測で見つけた)。
       ①決めてから黙るまでの遅れ … `REPEAT_LEAD`(**端末**のもの)
       ②ひと刻み遅れて気づくぶん … `step`
       ③控えの境目そのもののずれ … `slip`(**その教材**のもの・24手め)
     ③を定数に混ぜていたので、**ずれの無い教材まで払っていた** */
  const s = Number.isFinite(step) && step > 0 ? step : 0
  const p = Number.isFinite(slip) && slip > 0 ? slip : 0
  return Math.max(0, (REPEAT_LEAD + p + s) - Math.max(0, n - e))
}

/**
 * **その並びで、いちばん多く削る量**(秒・27手め)。
 *
 *   > 1ミリも変わっていません(2026-09 実機・利用者)
 *
 * **「何も変わらない」は、届いていないという意味である**(CLAUDE.md)。
 * ところが**どれだけ削っているかは、画面のどこにも出ていなかった。**
 * だから直すたびに、届いたのかどうかを利用者に推測させていた。
 *
 * **`[調査中]` の行に出す。** 次の報告で、届いたかが一目で分かる。
 * **原因が分かったら、その行ごと外す。**
 */
export function foldWorst(list, step = 0, slip = SLIP) {
  if (!Array.isArray(list) || list.length < 2) return 0
  let worst = 0
  for (let i = 0; i < list.length - 1; i += 1) {
    const need = foldNeed(list, i, step, slip)
    if (need > worst) worst = need
  }
  return worst
}

/**
 * **止める場所。** 声が終わったところ(足りなければ、その少し手前)。
 *
 * **戻る先(`backEdge` = 間のまん中)とは別物である。**
 * 止めるのは早いほどよく、戻るのは間のまん中がよい。
 */
function foldAt(list, i, step = 0, slip = SLIP) {
  const n = Number(list[i + 1]?.start)
  if (!Number.isFinite(n)) return NaN
  const e = Number(list[i]?.end)
  if (!Number.isFinite(e) || e > n) return n
  return e - foldNeed(list, i, step, slip)
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
 * ── **あらかじめ倒すのをやめた**(2026-09 実機・29手め)───────────
 *
 *   > まだ、ズレまくってます(利用者)
 *
 *   **同じ役目のものが2つあった。**
 *
 *   | | 何をしていたか | 効いていたか |
 *   |---|---|---|
 *   | ここ | **あらかじめ 78.6ms 声の中へ倒す** | 効いていた |
 *   | `seekClip` の着地の見張り | **黙らせたまま**着いた先を見て、手前なら直す | **一度も働いていない** |
 *
 *   見張りが働かなかったのは、`LAND_EPS` が `SEEK_MISS` と
 *   **同じ値に welded** されていたからである ——
 *   「78.6ms より大きく外れたら直す」ところへ、
 *   こちらがあらかじめ 78.6ms 倒していたので、**その先へは行かない。**
 *
 *   **残ったのは、頭の欠けだけだった。** 間(ま)の無い継ぎ目では
 *   **毎回その文の頭から 78.6ms が消える。**
 *   `Right.` のような短い文では、語頭の子音がまるごとである。
 *
 * ── **直しているあいだは、音が1ミリ秒も出ない** ───────────────
 *
 *   `seekClip(hush)` は ①`muted` にして止める ②移す
 *   ③`seeked` で着いた先を見る ④手前なら、もう一度頼む ⑤**それから鳴らす**
 *   (6手め)。つまり**手前に外れても、聴こえない。**
 *   **あらかじめ倒しておく必要が、そもそも無い。**
 *
 *   だからここは**その文の頭**を頼む。間があるぶんだけ `SEEK_LEAD` 手前へ
 *   寄せるが、**前の声には決して届かない**(`s - gap` で止める)。
 *
 * @param {number} start その区間の頭(控えの秒)
 * @param {number} gap 前の区間との間(ま)。負なら 0 として見る
 * @returns {number} 頼む秒
 */
export function landSec(start, gap) {
  const s = Number(start)
  if (!Number.isFinite(s)) return NaN
  const g = Math.max(0, Number(gap) || 0)
  /* 間があるぶんだけ手前へ寄せる。**前の声には届かない**(`s - g` で止める)。
     手前に外れたぶんは、`seekClip()` の着地の見張りが**黙ったまま**直す */
  return Math.max(s - Math.min(SEEK_LEAD, g), s - g)
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
 *
 * ── 18手め:**越えるのを待たない**(`REPEAT_LEAD` の節)──────────
 *
 *   越えてから気づくかぎり、**ひと刻みぶんは必ず次の声が鳴る。**
 *   だから ⓐ **次のひと刻みで越えるなら、いま戻す**(先取り)。
 *   越えてしまったときの受け皿として ⓑ を残す。
 *
 *   **ⓑは、前のひと刻みが分かるなら「越えた瞬間」だけで見る。**
 *   前は「縁から 40ms 以内」で見ていたので、
 *   **刻みが 120ms 飛ぶと窓ごと跳び越して、折り返しが丸ごと消えていた**
 *   (実測。そのときは次の文が最後まで鳴ってしまう)。
 */
function doneWindow(list, t, duration, prev = null, slip = SLIP) {
  const i = windowAt(list, t)
  /* **`Number(null)` は 0 である。** そのまま渡すと「前のひと刻みは 0 秒」
     になり、**どこにいても『いま縁を越えた』と読まれる**
     (実際にそう書いて、検証に捕まえてもらった) */
  const p = prev === null || prev === undefined ? NaN : Number(prev)
  /* ひと刻みの幅。**人が送ったぶん(`JUMP` 超え)は数に入れない** */
  const step = Number.isFinite(p) && t > p && t - p < JUMP ? t - p : 0

  // ⓐ 次のひと刻みで止める場所に届く = この窓はもう鳴らし終える
  if (i >= 0 && i < list.length - 1) {
    const at = foldAt(list, i, step, slip)
    /* **先取りは「もらった量」まで**(21手め)。間が足りているところでは
       `foldNeed()` が 0 を返すので**1ミリ秒も先取りしない** ——
       止める場所そのものが声の終わりなので、遅れは間が受け止める。
       間の狭いところでだけ、もらったぶんを先取りする */
    const look = Math.min(step, foldNeed(list, i, step, slip))
    if (Number.isFinite(at) && t + look >= at) return i
  }
  // ⓑ 手前の窓の縁を、いま越えたところ(先取りが間に合わなかったとき)
  if (i > 0) {
    const edge = backEdge(list, i)
    const crossed = Number.isFinite(p) ? p < edge : t - edge <= REPEAT_EPS
    if (crossed) return i - 1
  }
  // ⓒ いちばん最後は、次の縁が無いので音声の終わりで見る
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
 * @param {number|null} o.prev **前のひと刻みの秒**(18手め)。
 *   ひと刻みの幅を見積もって**越える前に折り返す**ために要る。
 *   渡さなければ先取りしない(これまでどおりの動き)。
 *   持っているのは `makeRepeatSeeker()` なので、**`seeker.last()` を渡す**
 *   —— 数え方を2通り持たない
 * @returns {number|null} 戻る先の秒
 *
 * 【文の区間が無いときは、段落で回す】
 *   文の区間は1本にまとめた音声の時刻から出す。出せないのは
 *   **1本そのものが作れていないとき**で、そのときは段落が
 *   こちらの知っているいちばん細かい単位である。
 *   **何も起きないより、近い単位で回すほうがよい**(行き止まりを作らない)。
 */
export function repeatSeek(unit, sec, {
  spans = null, sentences = null, duration = 0, window = null, prev = null, slip = SLIP,
} = {}) {
  if (!REPEAT_UNITS.includes(unit) || unit === 'off') return null
  const t = Number(sec) || 0
  const items = Array.isArray(spans) && spans.length ? spans : null
  const sents = Array.isArray(sentences) && sentences.length ? sentences : null

  /* **並びから回すときは、「鳴らし終えた窓」を探す**(2026-09 実機・7手め)。
     「いまの窓の終わりに来たか」で見ると、**必ず声の途中で折り返す**
     (`doneWindow()` の節)。越えてから、手前の窓へ戻す */
  /* **`slip` がかかるのは折り返しの側だけ。** 戻る先(`landEdge`)には
     かけない —— あちらは「前の声が入るかどうか」で、優先順が違う(25手め) */
  const done = (list) => {
    const i = doneWindow(list, t, duration, prev, slip)
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
 * **ひと刻みでこれ以上飛んだら、人が動かしたかもしれない**(秒)。
 *
 * ふつうは 10ms(速さ 2.5 倍でも 25ms)しか進まない。
 * **短い文を1つ送っただけでも見分けられる**よう、小さめに取る。
 *
 * **ここまでで決めない**(23手め・下の `humanSeek()`)。
 * **ひと刻みが遅れただけでも、ここは軽々と超える** ——
 * そのときも音は鳴り続けているので、`currentTime` は同じだけ進む。
 * ここは「見に行くかどうか」の入口で、決めるのは `humanSeek()` である。
 */
export const JUMP = 0.1

/**
 * **音が進みうる、いちばん速い倍率。**
 *
 * 利用者が選ぶ速さは 70〜130%、声ごとの補正(`voiceRateOf`)は
 * 2.5 倍が上限なので、掛け合わせて **3.25 倍**。少し余裕を見て 3.5 とする。
 * **これより速く `currentTime` が進んだら、鳴って進んだのではない。**
 */
export const MAX_PLAY_RATE = 3.5

/** 時計のゆらぎを吸う余裕(秒)。刻みも時計も、きっかりには来ない */
export const TICK_SLACK = 0.05

/**
 * **ひと刻みの飛びは、人が送ったのか。それとも刻みが遅れただけか**
 * (2026-09 実機・23手め)。
 *
 *   > 今日こそは文ごとのリピートを直してください。
 *
 * ── ここまで、22回とも外していた理由 ────────────────────────────
 *
 *   `makeRepeatSeeker()` は「ひと刻みで `JUMP`(100ms)以上飛んだら
 *   人が送った」と読み、そこから `REPEAT_HOLD`(250ms)のあいだ
 *   **折り返しをまるごと止めていた**(9手め)。
 *
 *   ところが**ひと刻みは、いつも 10ms で来るとは限らない。**
 *   `setInterval(tick, 10)` は、そのあいだに
 *   React の描き直し(語を1つずつ `<button>` で描いている)・
 *   MP3 の読み込み・端末の画面送りが挟まれば、平気で 100ms を超える。
 *
 *   **そのとき音は止まらない。** 音は端末の側で鳴り続けているので、
 *   `currentTime` はきっちり進む。つまり
 *   **「刻みが遅れただけ」が「人が送った」と読まれ、
 *   そこから 250ms、折り返しが1回も効かなくなる。**
 *   その 250ms のあいだに縁を通り過ぎるので、
 *   **次の文が丸ごと鳴ってしまう。**
 *
 *   実測(間 100ms の継ぎ目・ひと刻み 10ms・途中で1回だけ止める)。
 *
 *   | 止まった長さ | 折り返し | 次の声 |
 *   |---|---|---|
 *   | 90ms | 0.990 秒 | **0ms** |
 *   | **110ms** | **2.110 秒** | **1000ms(まる1文)** |
 *
 *   利用者の言う「**たまに**次の文の音がはいります」と、そのまま合う ——
 *   **たまに刻みが遅れる**からである。
 *
 * ── 見分ける量は「時計」だった ──────────────────────────────────
 *
 *   **模型に無い量は、いくら直しても当たらない**(21手めの戒め)。
 *   これまでの見分けは `currentTime` だけを見ていたが、
 *   その2つは `currentTime` の上では**まったく同じ形**をしている。
 *
 *   | | 音の進み | **本当の時間** |
 *   |---|---|---|
 *   | 刻みが遅れた | +300ms | **+300ms**(音は鳴り続けている) |
 *   | 人が送った | +2,000ms | **+10ms**(押しただけ) |
 *
 *   **本当の時間で説明が付く進み方なら、それは鳴って進んだのである。**
 *
 * - **うしろへ飛んだら、いつでも人である。** 音がひとりでに戻ることはない
 * - **時計を渡さなければ、これまでどおり**(`JUMP` だけで見る)。
 *   呼ぶ側が知らないときに、勝手な見分けをしない
 * - **取り違えの向きは、わざと片側に寄せてある。** 送ったのを
 *   遅れと読み違えても**その文をもう1周するだけ**だが、
 *   遅れを送りと読み違えると**次の文が丸ごと鳴る。** 害が桁で違う
 *
 * @param {number} t    いまの秒(`currentTime`)
 * @param {number} last 前のひと刻みの秒
 * @param {number|null} now  いまの本当の時刻(ミリ秒)。無ければ `null`
 * @param {number|null} then 前のひと刻みの本当の時刻(ミリ秒)
 * @returns {boolean} 人が動かしたか
 */
export function humanSeek(t, last, now = null, then = null) {
  const a = Number(t)
  const b = Number(last)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false
  const moved = a - b
  if (Math.abs(moved) <= JUMP) return false
  // うしろへ飛ぶのは、いつでも人である(音はひとりでに戻らない)
  if (moved < 0) return true
  /* **`Number(null)` は 0 である**(このファイルの `doneWindow()` で
     一度踏んでいる)。そのまま渡すと「時計は 0 ミリ秒だった」になり、
     **たまたま正しく見えるだけ**の判定になる。無いものは無いと書く */
  const n = now === null || now === undefined ? NaN : Number(now)
  const p = then === null || then === undefined ? NaN : Number(then)
  // 時計が分からなければ、これまでどおり `JUMP` だけで見る
  if (!Number.isFinite(n) || !Number.isFinite(p) || n < p) return true
  // **本当の時間で説明が付く進み方なら、鳴って進んだのである**
  return moved > ((n - p) / 1000) * MAX_PLAY_RATE + TICK_SLACK
}

/**
 * **くり返しで戻すときの見張り。**
 *
 * ひと刻みごとに `next(back, sec, now)` を呼ぶ。返るのは
 * **`seekClip()` に渡す秒**で、戻さないときは `null`。
 *
 * **`now`(いまの本当の時刻・ミリ秒)を渡す**(23手め)。
 * 渡さないと「刻みが遅れただけ」を「人が送った」と読み違え、
 * **そこから 250ms のあいだ折り返しが1回も効かない**
 * (= 次の文が丸ごと鳴る)。見分けは `humanSeek()` 1か所。
 *
 * @param {object} [o]
 * @param {number} o.hold  戻した先から、もう戻さない長さ(秒)
 * @param {number} o.off   「外した」とみなす手前のずれ(秒)
 * @param {number} o.tries 外したときに直す回数
 * @param {number} o.ticks 着いた先を見張るひと刻みの数
 * @returns {{next: (back: number|null, sec: number) => number|null,
 *            last: () => number|null}}
 *   `last()` は**前のひと刻みの秒**(18手め)。`repeatSeek()` の `prev` に
 *   そのまま渡す —— **前の刻みを覚えている場所を2つ持たない**
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
  /** 前のひと刻みの、**本当の時刻**(ミリ秒)。渡されたときだけ入る */
  let lastNow = null

  return {
    /** 前のひと刻みの秒。**`repeatSeek()` に渡して先取りに使う**(18手め) */
    last() { return last },

    next(back, sec, now = null) {
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
       *
       *   **ただし「飛んだ」だけでは足りない**(23手め)。
       *   ひと刻みが遅れても `currentTime` は同じだけ飛ぶ ——
       *   **音は端末の側で鳴り続けている**からである。
       *   見分けるのは**本当の時間**で、判断は `humanSeek()` 1か所。
       *   ここで読み違えると、**次の文が丸ごと鳴る。**
       */
      if (!land && last !== null && humanSeek(t, last, now, lastNow)) {
        holdUntil = t + hold
      }
      last = t
      lastNow = Number.isFinite(Number(now)) ? Number(now) : null

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
