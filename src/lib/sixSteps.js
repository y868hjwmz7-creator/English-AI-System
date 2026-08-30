/**
 * 6Steps — 利用者のスクールのトレーニング(2026-08 利用者の指定)。
 *
 * 【いちばん大事なこと】
 *   6つは**別々の教材ではない。同じ本文に対する取り組み方**である。
 *   だから演習(セクション)として分けない。分けたために「長文」が
 *   16個の短文になった失敗が、すでに一度ある(仕様書 第5.17節)。
 *
 *   もともとこの画面にあった「音読 / オーバーラッピング / シャドーイング /
 *   リピーティング」の4つが、**そのまま 6Steps の一部**だった。
 *   横に別のボタンを足すのではなく、**この切り替えを 6Steps に置き換える。**
 *   同じことをするものが2つ並ぶのを避けるためである。
 *
 * 【単位が2通りある】
 *   ①②④⑥ は**1文ずつ**。③⑤ は**本文まるごと**。
 *   本文の項目は「段落(記事)」「発言(会話)」なので、
 *   1文ずつのステップでは `alignedSentences()` でさらに分ける
 *   (**訳も1文ずつに合わせる。** 数が合わないときだけ段落の訳を添える)。
 */
import { alignedSentences } from './sentencePair.js'

/**
 * @property {string} id       内部の名前
 * @property {string} no       画面に出す番号(①〜⑥)
 * @property {string} label    画面に出す名前
 * @property {string} aim      このステップで何ができるようになるか(1行)
 * @property {string[]} how    やり方。**1つの手順につき1行。**
 *   1つの `<p>` に流したところ、改行も区切りも無い棒になって読めなかった
 *   (指導ポイントで一度学んだこと・`TeachingNote.jsx`)。
 *   `**…**` で囲んだところは太字にする
 * @property {'sentence'|'passage'} unit  1文ずつか、本文まるごとか
 * @property {number} rate     お手本の速さ(掛け算のもと)
 * @property {boolean} script  本文の英語を見せるか(⑤だけ false)
 */
export const SIX_STEPS = [
  {
    id: 'dictation', no: '①', label: 'ディクテーション',
    unit: 'sentence', rate: 0.9, script: false,
    aim: '聞こえた音を、そのまま文字にできるようにする',
    how: [
      '**1文ずつ Listen を押し、何度でも聞く。**',
      '聞こえたとおりに**書き取る**(手元のノートでもよい)。',
      '「解答を見る」で英文と訳が出る。打った人は**どこが違ったか**が色で出る。',
      'そのあと、お手本を**まねて声に出す。**',
    ],
  },
  {
    id: 'slash', no: '②', label: 'スラッシュリーディング',
    unit: 'sentence', rate: 0.9, script: true,
    aim: '意味のカタマリごとに、前から順に訳せるようにする',
    how: [
      '**新しいカタマリが始まる語を押す。** その語の前にスラッシュが入る。',
      '前から順に、カタマリごとの意味を**声に出して**言ってみる。',
      '区切り方がおかしいと、その場で**指摘が出る。**',
      '「解答を見る」で**模範の区切りと、その理由**が出る。',
    ],
  },
  {
    id: 'overlap', no: '③', label: 'オーバーラッピング',
    unit: 'passage', rate: 0.85, script: true,
    aim: 'お手本と同じ速さ・リズム・音で読めるようにする',
    how: [
      '本文を**見ながら**、お手本と**同時に重ねて**読む。',
      'まず**音だけ**をまねる。',
      '慣れたら、**意味と語順も考えながら**音もまねる。',
    ],
  },
  {
    id: 'meaning', no: '④', label: '意味音読',
    unit: 'sentence', rate: 0.9, script: true,
    aim: '意味と文法を分かったうえで読めるようにする',
    how: [
      '②で分かった意味と文法を**考えながら**読む。',
      '**速く読むのが目的ではない。** 自分が分かる速さでかみしめて読む。',
      '慣れたら、1文読んで**顔を上げ、日本語 → 英語**の順に言う。',
      '言えなくなったら、また**見ながら読む**に戻ってよい。',
    ],
  },
  {
    id: 'shadow', no: '⑤', label: 'シャドーイング',
    unit: 'passage', rate: 0.85, script: false,
    aim: '文字を見ないでも、音についていけるようにする',
    how: [
      '③を、**本文を見ないで**行う。',
      'お手本の**少しあと**を追いかけて読む。',
      '追いつけなくなったら「本文を出す」で戻してよい。',
    ],
  },
  {
    id: 'repeat', no: '⑥', label: 'リピーティング',
    unit: 'sentence', rate: 0.9, script: false,
    aim: '聞いた1文を、覚えて口に出せるようにする',
    how: [
      '1文を**通して聞き**、聞き終わってから同じ英文を口に出す。',
      '慣れたら、**日本語で意味を言ってから**英語を言う。',
      '**分からなくなったら、もう一度聞く。**',
    ],
  },
]

export const stepOf = (id) => SIX_STEPS.find((s) => s.id === id) ?? SIX_STEPS[0]

/** ④⑥ の「2段階目」。1文読む → 日本語 → 英語 */
export const HAS_LOOKUP = new Set(['meaning', 'repeat'])

/**
 * 本文の項目(段落 / 発言)を、**1文ずつ**にほどく。
 *
 * ①②④⑥ は1文が単位である。記事の項目は段落なので、そのままでは大きすぎる。
 * 文の切り方は読み上げと同じ `splitSentences()` を使う(`sentencePair.js` 経由)。
 * **切り方を2か所に持たない。** ずれると、聞いた文と書く文が食い違う。
 *
 * 訳も1文ずつに合わせる。**数が合わないときだけ**段落の訳を添え、
 * `jaIsWhole` を立てて画面に札を出させる。**無いものを、あるように見せない。**
 */
export function sentencesOf(items) {
  const out = []
  ;(items ?? []).forEach((item, n) => {
    const en = String(item.prompt_en ?? '').trim()
    if (!en) return
    // **訳も1文ずつに合わせる。** 段落の訳をそのまま添えていたので、
    // 英文1文に対して段落まるごとの訳が付いていた(2026-08 の指摘)。
    // 数が合わないときだけ、段落の訳を添えて札を付ける
    alignedSentences(en, item.prompt_ja).forEach((pair, i) => {
      out.push({
        id: `${item.id ?? n}-${i}`,
        text: pair.en,
        speaker: item.speaker ?? '',
        ja: pair.ja,
        jaIsWhole: !pair.aligned,
        itemId: item.id ?? n,
      })
    })
  })
  return out
}

/* ── 練習する「かたまり」の大きさ ─────────────────────────────
   1文ずつでは細かすぎることがある(2026-08 の指摘)。
   ステップによって、ちょうどよい大きさが違う。 */

/** **これより短いものは、次とまとめる。**
    「Hi!」だけで1問にすると、書き取る意味がない(2026-08 実機) */
const TOO_SHORT = 22

/**
 * ① ディクテーションの難易度。
 * **上げるほど、一度に覚える文が増える**(2026-08 利用者の指定)。
 */
export const DICTATION_LEVELS = [
  { id: 'easy', label: '初級', size: 1, hint: '1文ずつ書き取る' },
  { id: 'mid', label: '中級', size: 2, hint: '2文つづけて聞いてから書き取る' },
  { id: 'hard', label: '上級', size: 3, hint: '3文つづけて聞いてから書き取る' },
]

/**
 * ② スラッシュリーディングの単位(2026-08 利用者の指定)。
 * > 一文ずつにすると細かすぎるので「段落ごと」と「文章全体」の2種類
 */
export const SLASH_UNITS = [
  { id: 'para', label: '段落ごと', hint: '段落(会話は発言)ごとに区切る' },
  { id: 'whole', label: '文章全体', hint: '本文をまるごと1つとして区切る' },
]

/**
 * 文をいくつかずつのかたまりにまとめる。
 *
 * **短すぎるものは、数に関わらず次とまとめる。**
 * 「Hi!」だけを1問にしても、聞き取る手がかりが無い。
 */
export function groupSentences(sentences, size = 1) {
  const out = []
  let buf = []
  const flush = () => {
    if (!buf.length) return
    out.push({
      id: buf[0].id,
      text: buf.map((x) => x.text).join(' '),
      // 話す人が途中で変わったら、まとめて出す
      speaker: [...new Set(buf.map((x) => x.speaker).filter(Boolean))].join(' / '),
      ja: [...new Set(buf.map((x) => x.ja).filter(Boolean))].join(''),
      // **まとめただけでは「段落の訳」にならない。**
      // 1文ずつの訳がそろっているなら、つないだものはそのまま正しい訳である
      jaIsWhole: buf.some((x) => x.jaIsWhole),
      count: buf.length,
    })
    buf = []
  }
  for (const s of sentences) {
    buf.push(s)
    const long = buf.map((x) => x.text).join(' ').length >= TOO_SHORT
    if (buf.length >= size && long) flush()
  }
  // 最後に短いものが残ったら、**前のかたまりにくっつける**
  if (buf.length) {
    const tail = buf.map((x) => x.text).join(' ')
    if (out.length && tail.length < TOO_SHORT) {
      const last = out[out.length - 1]
      last.text = `${last.text} ${tail}`
      last.ja = [...new Set([last.ja, ...buf.map((x) => x.ja)].filter(Boolean))].join('')
      last.jaIsWhole = true
      last.count += buf.length
    } else flush()
  }
  return out
}

/**
 * ② の単位。段落(会話は発言)ごと、または本文まるごと1つ。
 *
 * **`parts` に、もとの項目をそのまま持たせる。**
 * カタマリごとの訳(0021)は**項目ごと**に控えてあるので、
 * 「文章全体」でつないだときも、訳は項目ごとに出す必要がある。
 * つないだ文の区切りを作り直すと、控えの数と合わなくなる。
 */
export function blocksOf(items, unit = 'para') {
  const list = (items ?? [])
    .map((it, n) => ({
      id: it.id ?? `b${n}`,
      text: String(it.prompt_en ?? '').trim(),
      speaker: it.speaker ?? '',
      ja: it.prompt_ja ?? '',
      jaIsWhole: false,
      parts: [it],
    }))
    .filter((x) => x.text)
  if (unit !== 'whole' || list.length < 2) return list
  return [{
    id: 'whole',
    text: list.map((x) => x.text).join(' '),
    speaker: '',
    ja: list.map((x) => x.ja).filter(Boolean).join(''),
    jaIsWhole: true,
    parts: list.flatMap((x) => x.parts),
  }]
}

/**
 * ③⑤ の本文の見せ方(2026-08 の要望)。**3通り**ある。
 *
 * > 素の文章を見ながら、スラッシュを表示させた状態で、
 * > またはスラッシュと真下にスラッシュ付きの日本語を表示しながら、
 * > 合計3パターンでのオーバーラッピングができると最高だ。
 *
 * 3つめ(区切りごとの訳)は、教材に控えた訳を使う(0021)。
 * **控えの無い教材では出せない**ので、そのときは英語だけを出す
 * (`ChunkedText` が受け止める)。
 */
export const PASSAGE_VIEWS = [
  { id: 'plain', label: '素の文章', hint: '区切りを出さずに読む' },
  { id: 'slash', label: '区切りを出す', hint: '意味のカタマリで区切って読む' },
  { id: 'chunk', label: '区切り + 訳', hint: 'カタマリの上に、そのカタマリの訳を出す' },
]
