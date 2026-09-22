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

/** その種類が Quick Response に使えるか */
export const canQuickRespond = (exerciseType) => Boolean(PAIR_FIELDS[exerciseType])

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
    if (mode && map.group !== mode) continue
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
      alignedSentences(en, ja).forEach((pair, k) => {
        // **1文ごとの問題が Quick Response の定義である**(2026-08 の指定)。
        // 訳が段落ぶんしか無いものは、1文の問題にならないので**出さない。**
        // 「段落の訳」と断って出すくらいなら、出さないほうがよい
        if (!pair.aligned) return
        out.push({
          ja: pair.ja, en: pair.en, from, speaker, group: map.group,
          key: `${key}-${k}`,
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
      if (isChunkSection(sec.exercise_type)) {
        chunkDrills(it).forEach((d, k) => {
          out.push({
            ja: d.ja, en: d.en, from, speaker, group: map.group,
            key: `${key}-d${k}`,
          })
        })
      }
    })
  }
  return out
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
