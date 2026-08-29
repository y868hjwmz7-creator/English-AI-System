/**
 * その英文を、**どの段の声で読み上げるか**を決める。
 *
 * ============================================================================
 * 【なぜ段を分けるか】(2026-08 利用者の指定)
 *
 *   いちばん自然と言われる声(ElevenLabs)は、教材ぜんぶに使うと
 *   月6万〜12万円になる(第 5.2.1 節)。Azure と Google の無料枠に
 *   収まる声でも、読み方が分かるだけなら十分である。
 *
 *   そこで **声の良さが学習効果に直結するところにだけ**、良い声を使う。
 *
 * 【どこに効くのか】
 *
 *   ① **記事・会話の本文**
 *      音読・オーバーラッピング・シャドーイング・リピーティングの素材。
 *      「その人になりきって言う」練習なので、抑揚と間がそのまま手本になる
 *
 *   ② **リスニング**
 *      英文を見せずに聞かせる演習。**音そのものが問題**である
 *
 *   ③ **発音・リズムの弱点に当てた教材**(2026-08 利用者の追記)
 *      > ただ、文型ドリルでも、発音、リズム、イントネーションなどになると
 *      > ElevenLabs の方が良いかもしれない
 *
 *      そのとおりである。/l/ と /r/ の練習で、手本の子音が曖昧では
 *      練習にならない。リンキングや脱落は、**自然な話し方でしか現れない。**
 *      弱点タグの見出しが「発音」「リズム」なら、演習の種類にかかわらず
 *      良い声を使う。
 *
 * 【それ以外は標準の声でよい】
 *   文法の穴埋め、和文英訳、単語・フレーズの読み上げは、
 *   **読み方が分かることが目的**である。ここに良い声は要らない。
 *
 * 【置き場所が段ごとに分かれる】
 *   同じ英文でも段が違えば別の音声になるので、置き場所の鍵にも段が入る
 *   (`tts/<版>/<段>/<話者>/<指紋>.mp3`)。
 */
import { isPassageSection } from '../data/exerciseTypes.js'
import { weaknessTags } from '../data/weaknessTags.js'

/** 良い声(ElevenLabs)/ 標準の声(Google・Azure) */
export const PREMIUM = 'premium'
export const STANDARD = 'standard'

/** 声の良さが学習効果に直結する弱点の見出し */
const PREMIUM_CATEGORIES = new Set(['pronunciation', 'rhythm'])

const categoryOf = (tagId) =>
  weaknessTags.find((t) => t.id === tagId)?.category ?? null

/** 発音・リズムの弱点が1つでも入っているか */
export const hasSoundTag = (tagIds) =>
  (tagIds ?? []).some((id) => PREMIUM_CATEGORIES.has(categoryOf(id)))

/** 音そのものが問題になる演習 */
const SOUND_TYPES = new Set(['listening'])

/**
 * 段を決める。
 *
 * @param {object} o
 * @param {string} o.exerciseType 演習の種類(`exerciseTypes.js` の id)
 * @param {Array<string>} o.tags  その教材の弱点タグ
 */
export function voiceTierFor({ exerciseType = '', tags = [] } = {}) {
  if (isPassageSection(exerciseType)) return PREMIUM
  if (SOUND_TYPES.has(exerciseType)) return PREMIUM
  if (hasSoundTag(tags)) return PREMIUM
  return STANDARD
}
