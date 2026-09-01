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
import { exerciseLabel } from '../data/exerciseTypes.js'
import { alignedSentences } from './sentencePair.js'

/**
 * 演習の種類ごとに、「日本語(出す側)」と「英語(答え)」がどの欄にあるか。
 *
 * **ここに無い種類は Quick Response にしない。**
 *   `fill_blank`  … 日本語が無い(英文の穴埋め)
 *   `listening`   … 日本語が無い(音を聞いて答える)
 *   `comprehension` … 設問も答えも英語。訳して言うものではない
 */
const PAIR_FIELDS = {
  // 英文和訳は、和訳のほうが `answer` に入っている
  translate_en_ja: { ja: 'answer', en: 'prompt_en', group: 'sentence' },
  translate_ja_en: { ja: 'prompt_ja', en: 'answer', group: 'sentence' },
  article:         { ja: 'prompt_ja', en: 'prompt_en', group: 'sentence' },
  dialogue:        { ja: 'prompt_ja', en: 'prompt_en', group: 'sentence' },
  vocab_note:      { ja: 'prompt_ja', en: 'prompt_en', group: 'word' },
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
]

/** その種類が Quick Response に使えるか */
export const canQuickRespond = (exerciseType) => Boolean(PAIR_FIELDS[exerciseType])

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
  return {
    sentence: all.filter((x) => x.group === 'sentence').length,
    word: all.filter((x) => x.group === 'word').length,
  }
}

/** その教材で Quick Response ができるか(1つでも対があるか) */
export const hasQuickResponse = (material) => quickResponsePairs(material).length > 0
