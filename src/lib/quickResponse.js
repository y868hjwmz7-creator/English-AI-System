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
  translate_en_ja: { ja: 'answer', en: 'prompt_en' },
  translate_ja_en: { ja: 'prompt_ja', en: 'answer' },
  article:         { ja: 'prompt_ja', en: 'prompt_en' },
  dialogue:        { ja: 'prompt_ja', en: 'prompt_en' },
  vocab_note:      { ja: 'prompt_ja', en: 'prompt_en' },
  vocabulary:      { ja: 'prompt_ja', en: 'prompt_en' },
  phrase:          { ja: 'prompt_ja', en: 'prompt_en' },
  // 旧「長文」。既存の教材でも使えるように残す
  read_aloud:      { ja: 'prompt_ja', en: 'prompt_en' },
  overlapping:     { ja: 'prompt_ja', en: 'prompt_en' },
  shadowing:       { ja: 'prompt_ja', en: 'prompt_en' },
  repeating:       { ja: 'prompt_ja', en: 'prompt_en' },
}

/** その種類が Quick Response に使えるか */
export const canQuickRespond = (exerciseType) => Boolean(PAIR_FIELDS[exerciseType])

/**
 * 教材から、日本語と英語の対をぜんぶ集める。
 *
 * @returns {{ja, en, speaker, from, key, jaIsWhole}[]}
 *   `jaIsWhole` は「訳が段落ぶんしか無い」という印。画面が札を出す
 */
export function quickResponsePairs(material) {
  const out = []
  for (const sec of material?.sections ?? []) {
    const map = PAIR_FIELDS[sec.exercise_type]
    if (!map) continue
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
        out.push({
          ja: pair.ja, en: pair.en, from, speaker,
          jaIsWhole: !pair.aligned,
          key: `${key}-${k}`,
        })
      })
    })
  }
  return out
}

/** その教材で Quick Response ができるか(1つでも対があるか) */
export const hasQuickResponse = (material) => quickResponsePairs(material).length > 0
