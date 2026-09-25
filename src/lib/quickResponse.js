/**
 * Quick Response(日本語を見て、すぐ英語で言う)の材料を、
 * 教材からそのまま組み立てる。
 *
 * 【なぜ新しく作らせないのか】
 *   教材には**すでに英語と日本語が対で入っている**(`prompt_en` / `prompt_ja`、
 *   和文英訳は `answer`)。AI に作り直させれば1回ぶん課金され、
 *   しかも「宿題でやった文とは違う文」になる。
 *   **Quick Response は、その教材の復習である。** 別の文では意味がない。
 *
 *   したがってこの仕組みは、
 *   **SQL も、Edge Function も、生成の費用も要らない。**
 *   いま Supabase にある教材が、貼り直しなしでそのまま使える。
 *
 * 【出す順番は、教材の順のまま】
 *   単語帳は「毎回混ぜる」(並び順で覚えてしまうため)が、こちらは違う。
 *   記事と会話には**話の流れ**があり、混ぜると場面が飛ぶ。
 *   1本の教材を通しでやるものなので、順番はそのままにする。
 */
import { exerciseLabel, isChunkSection } from '../data/exerciseTypes.js'
/* かたまりの練習(第5.230節)。**そろえ方は `chunkDrills()` 1か所** ——
   片方しか無い組を落とす決まりを、出す側で書き写さない(CLAUDE.md) */
import { chunkDrills } from '../data/chunkKinds.js'
/* 例文(第5.254節)。**そろえ方は  1か所** */
import { wordExamples } from '../data/exerciseTypes.js'
import { alignedSentences } from './sentencePair.js'

/**
 * 演習の種類ごとに、「日本語(出す側)」と「英語(答え)」がどの欄にあるか。
 *
 * **ここに無い種類は Quick Response にしない。**
 *   `fill_blank`  … 日本語が無い(英文の穴埋め)
 *   `listening`   … 日本語が無い(音を聞いて答える)
 *   `comprehension` … 設問も答えも英語。訳して言うものではない
 *   `discussion`  … 設問は英語で、**正解が無い。** 対にならない
 */
const PAIR_FIELDS = {
  // 英文和訳は、和訳のほうが `answer` に入っている
  translate_en_ja: { ja: 'answer', en: 'prompt_en', group: 'sentence' },
  translate_ja_en: { ja: 'prompt_ja', en: 'answer', group: 'sentence' },
  article:         { ja: 'prompt_ja', en: 'prompt_en', group: 'sentence' },
  dialogue:        { ja: 'prompt_ja', en: 'prompt_en', group: 'sentence' },
  /* **覚えておきたい表現は、単語 / フレーズとは別の組**(第5.235節・
     2026-09 利用者の指定「独立した選択肢として追加してください」)。
     もとは `word` に混ぜていたので、**単語 / フレーズを選ぶと
     かたまりも一緒に出てきていた。** 狙いが違う ——
     あちらは「語をすばやく引き出す」、こちらは「本文に出たかたまりを言う」 */
  vocab_note:      { ja: 'prompt_ja', en: 'prompt_en', group: 'chunk' },
  vocabulary:      { ja: 'prompt_ja', en: 'prompt_en', group: 'word' },
  phrase:          { ja: 'prompt_ja', en: 'prompt_en', group: 'word' },
  /* ══════════════════════════════════════════════════════════════
     **「日本語 → 英語で言う」も、同じ組に入れる**(第5.256節・2026-09-25)

       > 教材内の Quick Response に、文章と単語フレーズと別れていてほしいのに、
       > Quick Response がある所によって仕様に偏りがある気がします

     0067 で演習を2つ足したとき、**ここに足し忘れていた。**
     そのため単語 / フレーズの教材では、**言う練習の問が
     Quick Response に1問も出てこなかった。**
     「演習の種類を足す4か所」に、**ここが入っていなかった**
     (`docs/notes/01` の一覧に5つめとして足した)。 */
  vocab_recall:    { ja: 'prompt_ja', en: 'answer', group: 'word' },
  phrase_recall:   { ja: 'prompt_ja', en: 'answer', group: 'word' },
  // 旧「長文」。既存の教材でも使えるように残す
  read_aloud:      { ja: 'prompt_ja', en: 'prompt_en', group: 'sentence' },
  overlapping:     { ja: 'prompt_ja', en: 'prompt_en', group: 'sentence' },
  shadowing:       { ja: 'prompt_ja', en: 'prompt_en', group: 'sentence' },
  repeating:       { ja: 'prompt_ja', en: 'prompt_en', group: 'sentence' },
}

/**
 * 取り組み方は2通り(2026-09 利用者の指定)。
 *
 *   > クイックレスポンスを画面で取り組むときは、文章のモードと、
 *   > 出てきたフレーズ、単語のモードを切り替えれるようにしてください。
 *
 * **どちらも同じ教材の同じ英文**である。違うのは長さと狙い。
 *   ・**文章** … 本文と和訳。文を丸ごと口から出せるようにする
 *   ・**フレーズ・単語** … 「出てきた語句」。語をすばやく引き出せるようにする
 *
 * 混ぜて1本にすると、長い文と1語が交互に来て、頭の切り替えが追いつかない。
 * **どちらをやるかは、その場で決められるようにする。**
 */
export const QR_MODES = [
  { id: 'sentence', label: '文章' },
  { id: 'word', label: 'フレーズ・単語' },
  /* **覚えておきたい表現**(第5.235節・2026-09 利用者の指定)。

       > 「単語/フレーズ」と「文章」をいままで通り入れ、そして新たに
       > 「覚えておきたい表現」が選択された教材はそれも quick response に
       > **独立した選択肢として**追加してください

     **その教材に無ければ、選択肢ごと出ない**(0件の取り組み方は出さない)。
     中身は**かたまりそのもの + その練習ぜんぶ**である(`chunkPairs`)。 */
  { id: 'chunk', label: '覚えておきたい表現' },
]

/**
 * ============================================================================
 * **Quick Response に出さない種類。理由つきで、ここに名指しする**(第5.256節)
 *
 * 2026-09-25 利用者の指摘。
 *
 *   > 教材内の Quick Response に、文章と単語フレーズと別れていてほしいのに、
 *   > Quick Response がある所によって仕様に偏りがある気がします
 *
 * 偏りの出どころは**足し忘れ**だった。0067 で演習を2つ足したとき、
 * `PAIR_FIELDS` に入れ忘れ、**その教材だけ Quick Response が薄かった。**
 *
 * **「入れ忘れ」と「わざと入れない」を、見分けられるようにする。**
 * 上の `PAIR_FIELDS` と、この一覧の**どちらにも入っていない種類**が
 * あれば `npm run test:play` が赤くなる —— 演習を足した人は、
 * **どちらかに入れるまで気づける。**
 * ============================================================================
 */
export const QR_SKIP = {
  fill_blank: '日本語が無い(英文の穴埋め)',
  listening: '日本語が無い(音を聞いて答える)',
  error_correction: '日本語が無い(英文の誤りを直す)',
  comprehension: '設問も答えも英語。訳して言うものではない',
  discussion: '設問は英語で、**正解が無い**。対にならない',
  audience_qa: '同上(聴衆からの質問。正解が無い)',
  culture_note: '2026-09 に廃止した演習。古い教材のためだけに残っている',
}

/** その種類が Quick Response に使えるか */
export const canQuickRespond = (exerciseType) => Boolean(PAIR_FIELDS[exerciseType])

/** 対にできる種類(**画面に一覧を書き写さない**) */
export const QR_PAIR_TYPES = Object.keys(PAIR_FIELDS)

/**
 * **「まだ」を押したとき、どの冊に溜めるか**(0066・第5.237節)。
 *
 *   > 教材の中の quick response の「覚えておきたい表現」から「まだ」を押して
 *   > 自分の quick response 帳の中に加えられたものは、「覚えておきたい表現集」の
 *   > タグをつけておき、自分の quick response とは別に、単体の冊として
 *   > ためていけないですか?
 *   (2026-09 利用者の指定)
 *
 * **取り組み方の id を、そのまま冊の id にしてある。**
 * 2か所で訳すと必ず食い違う(CLAUDE.md「呼び名を2か所に書かない」)。
 *
 * **ここに無い取り組み方は、溜めない。既定は溜めない側**である ——
 * 単語・フレーズ(`word`)は**単語帳**が持っており、
 * 同じ語の覚え具合を2か所で動かさない(このファイルの冒頭)。
 */
export const QR_SAVED_MODES = ['sentence', 'chunk']

/** その1問を復習に溜めるか。**画面の中で `group === '…'` と書かない** */
export const qrSaves = (pair) => QR_SAVED_MODES.includes(pair?.group)

/** どの冊へ溜めるか(`null` なら溜めない) */
export const qrSourceOf = (pair) => (qrSaves(pair) ? pair.group : null)

/**
 * **「覚えておきたい表現集」の呼び名。ここ1か所**(0066・第5.237節)。
 * 演習の名前(「覚えておきたい表現」)とは**別の文字列**である ——
 * あちらは教材の中の1節、こちらは溜まっていく冊の名前。
 */
export const CHUNK_BOOK_LABEL = '覚えておきたい表現集'

/**
 * その冊が読む、溜めた文の種類(0066)。
 *
 * **ファイルの冊(Native Flow / 66 の型)は `null`** —— あちらは
 * `qr_reviews` から引くのではなく、ファイルの問に覚え具合をかぶせている。
 * **判断はここ1か所**(画面で冊の id を比べない)。
 */
export const qrSourceOfBook = (book) => (
  book === 'chunk' ? 'chunk' : book === 'my' ? 'sentence' : null)

/**
 * 教材から、日本語と英語の対をぜんぶ集める。
 *
 * @param material 教材
 * @param mode `'sentence'`(文章)/ `'word'`(フレーズ・単語)/
 *   省略すると**両方**。印刷の控えは両方まとめて出す
 * @returns {{ja, en, speaker, from, group, key}[]}
 *   **1文ずつの対だけ。** 訳が段落ぶんしか無いものは入らない
 */
export function quickResponsePairs(material, mode = null) {
  const out = []
  for (const sec of material?.sections ?? []) {
    const map = PAIR_FIELDS[sec.exercise_type]
    if (!map) continue
    /* **段では切り捨てない**(第5.256節・2026-09-25)。
       もとはここで `map.group !== mode` の段をまるごと飛ばしていた。
       ところが**段の中には、別の組の対が入っている** ——
       単語の段の中の例文と練習は「文章」である。
       段で切ると、**それがまるごと落ちて1問も出てこなかった。**
       **絞るのは、1問ずつ。いちばん最後に1回だけ。** */
    const from = exerciseLabel(sec.exercise_type)
    ;(sec.items ?? []).forEach((it, i) => {
      const ja = String(it[map.ja] ?? '').trim()
      const en = String(it[map.en] ?? '').trim()
      // **どちらか欠けているものは出さない。**
      // 日本語だけ出して英語が空だと、答え合わせができない
      if (!ja || !en) return
      const key = it.id ?? `${sec.id ?? sec.exercise_type}-${i}`
      const speaker = String(it.speaker ?? '').trim()
      // **1文ずつにほどく**(2026-08 の指摘)。
      // 記事の1項目は段落なので、そのままでは日本語が5行も出てしまう。
      // 訳の数が合わないときは切らない(`alignedSentences`)
      /* **どの表現にぶら下がっているか**(第5.243節・2026-09-23 利用者の指定)。
         かたまりの節では、**その表現そのもの**と**その表現を使った練習**が
         ひと続きに並ぶ。紙では表現を見出しにして、練習を表現ごとに
         数え直すので、**どの表現の下にいるか**を対そのものに持たせる。
         鍵(`key`)の形を紙の側で読み解かせない ——
         **数え方を2通り持たない**(CLAUDE.md)。
         かたまりの節でなければ、3つとも入らない(既定は「無い」側)。 */
      const 表現 = isChunkSection(sec.exercise_type)
        ? { headKey: key, head: en, headJa: ja }
        : null
      alignedSentences(en, ja).forEach((pair, k) => {
        // **1文ごとの問題が Quick Response の定義である**(2026-08 の指定)。
        // 訳が段落ぶんしか無いものは、1文の問題にならないので**出さない。**
        // 「段落の訳」と断って出すくらいなら、出さないほうがよい
        if (!pair.aligned) return
        out.push({
          ja: pair.ja, en: pair.en, from, speaker, group: map.group,
          key: `${key}-${k}`,
          ...(表現 ? { ...表現, isHead: true } : {}),
        })
      })
      /* **かたまりの練習も、ぜんぶ対にする**(第5.235節・利用者の指定
         「**すべての**日本語と英語もクイックレスポンスと同じように」)。

         **かたまりの後ろに置く。** 先に「その表現そのもの」を言えてから、
         それを使った文へ進む(教材の紙もこの順で並んでいる)。

         **切り直さない。** 練習は作るときから1問1対で、
         `chunkDrills()` が片方しか無い組をすでに落としている。
         ここで `alignedSentences` に通すと、英文が2文になっている組を
         **黙って捨てる**ことになる(CLAUDE.md「黙って落とさない」)。 */
      /* ══════════════════════════════════════════════════════════
         **対になっているものは、全部出す**(第5.256節・2026-09-25)

         もとは**かたまりのときだけ**練習をほどいていた。
         単語 / フレーズにも練習と例文が付いた日(第5.254節)、
         **そこだけ出てこない**ことになった —— これが「所によって偏る」
         の正体である。**種類で分けるのをやめる。**

         **組は、中身の形で決める。**
         ・かたまり … 利用者が**独立した組**にした(第5.235節)ので、
           その表現も、その練習も、まとめて「覚えておきたい表現」
         ・それ以外 … **文は「文章」**である
           (単語 / フレーズそのものは上の `map.group` で「フレーズ・単語」)
         ══════════════════════════════════════════════════════════ */
      const 中の組 = isChunkSection(sec.exercise_type) ? map.group : 'sentence'
      chunkDrills(it).forEach((d, k) => {
        out.push({
          ja: d.ja, en: d.en, from, speaker, group: 中の組,
          key: `${key}-d${k}`, ...表現,
        })
      })
      /* 例文(第5.254節)。**練習とまったく同じ扱い** ——
         英語と日本語が対になっているものを、片方だけ出さない */
      wordExamples(it).forEach((x, k) => {
        out.push({
          ja: x.ja, en: x.en, from, speaker, group: 中の組,
          key: `${key}-x${k}`, ...表現,
        })
      })
    })
  }
  /* **絞るのは、1問ずつ**(第5.256節)。段ごとではない ——
     段の組と、その中の対の組は**別物**である */
  return mode ? out.filter((p) => p.group === mode) : out
}

/**
 * 取り組み方ごとの問数。**選ぶ前に、いくつあるか分かるようにする。**
 * 0件の取り組み方は画面に出さない(効かない操作を見せない・CLAUDE.md)。
 */
export function quickResponseCounts(material) {
  const all = quickResponsePairs(material)
  /* **一覧は `QR_MODES` 1か所。** ここに `sentence` / `word` と書き並べて
     いたので、**取り組み方を足した日に、その1つだけ 0 件のまま**になり
     (`counts[m.id] > 0` で画面から消える)、**誰も気づけない**
     (CLAUDE.md「数え方を2通り持たない」) */
  return Object.fromEntries(QR_MODES.map((m) =>
    [m.id, all.filter((x) => x.group === m.id).length]))
}

/** その教材で Quick Response ができるか(1つでも対があるか) */
export const hasQuickResponse = (material) => quickResponsePairs(material).length > 0

/**
 * **覚えておきたい表現を、表現ごとに束ねる**(第5.243節・2026-09-23 実機)。
 *
 *   > 覚えておきたい表現の見出しをしっかりつけてほしいです。
 *   > PDF化したときに①の「bring up」⑧の「look into」⑭の「keep up with」など、
 *   > これらピックアップした表現ごとに見出しにして、問題の番号も
 *   > それぞれ①〜⑥(問題数に応じて)にするべきです。
 *
 * 紙では 42 問が**ひと続きの通し番号**で並んでいた。表現そのもの(bring up)も
 * 番号の付いた1問として混ざっているので、**どこからどこまでが同じ表現の
 * 練習なのか、紙を見ても分からない。**
 *
 * **表現を見出しにして、練習をその下で数え直す。**
 *
 * 【画面はこれまでどおり】
 *   画面の Quick Response は1問ずつ出すので、見出しは要らない。
 *   表現そのものも**1問として出す**(言えるようにするのが狙い)。
 *   変えたのは**紙の並べ方**だけで、問の中身は1つも増えても減ってもいない。
 *
 * @param {{headKey?: string}[]} pairs `quickResponsePairs(material, 'chunk')`
 * @returns {{key: string, en: string, ja: string, pairs: object[]}[]}
 *   **表現そのものは `pairs` に入れない**(見出しになるため)
 */
export function chunkGroups(pairs) {
  const out = []
  const byKey = new Map()
  for (const p of pairs ?? []) {
    // **かたまりでない対は、ここでは束ねない**(既定は「入れない」側)
    if (!p?.headKey) continue
    let g = byKey.get(p.headKey)
    if (!g) {
      g = { key: p.headKey, en: p.head ?? '', ja: p.headJa ?? '', pairs: [] }
      byKey.set(p.headKey, g)
      out.push(g)
    }
    if (!p.isHead) g.pairs.push(p)
  }
  return out
}
