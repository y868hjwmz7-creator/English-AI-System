/**
 * **すでにある教材に、足りない演習だけを足す**(第5.234節)。
 *
 * 【何を解いているか】(2026-09 利用者の指定)
 *
 *   > RIZAP ENGLISH / Booking a Bus / Conversation 1 — UNIT 1
 *   > この教材を改めて新しい Generate material で作成しなおせませんか
 *
 *   新しい演習(「覚えておきたい表現」)は、**これから作る教材にしか付かない。**
 *   すでにある教材には、何をしても付かなかった。
 *   かといって作り直すと、**本文が別の文章になってしまう** ——
 *   利用者が欲しいのは「この教材のまま、足りないものを足す」ことである。
 *
 * 【本文には、絶対に触れない】
 *   足すのは**本文から作る演習だけ**である(内容の理解・ディスカッション・
 *   覚えておきたい表現・想定される質問)。本文(記事・会話)は作り直さない。
 *
 *   - 英文が1文字も変わらないので、**読み上げ音声も作り直しにならない**
 *     (置き場所の鍵は英文の指紋・CLAUDE.md「1回だけ課金される」)
 *   - ゲストがもう練習した本文が、目の前で書き換わることもない
 *
 * 【本文が無ければ、何も足せない】
 *   設問は**本文を渡して**作る(第5.17節)。文型ドリル・単語帳には本文が
 *   無いので、**何も返さない。既定は「できない」側**(CLAUDE.md)。
 *
 * 【足したものは、末尾に付く】
 *   `material_sections` は `unique (material_id, seq)` なので、
 *   並べ直すには**在る行の番号もずらす**ことになる。すでに配った教材の
 *   並びを、足すついでに触りたくない。
 *   **実際に足りないのは、どの種類でもいちばん後ろの演習である**
 *   (「覚えておきたい表現」は `DEFAULT_SECTIONS` の最後)ので、
 *   末尾に付ければそのまま正しい並びになる。
 *
 * 【なぜ何にも依存しない形にしてあるか】
 *   `materials.js` は Supabase を、画面(JSX)はブラウザを引き連れていて、
 *   **素の node で一度も走らせられない**(`playMark.js` と同じ考え方)。
 *   算段だけをここに置けば `npm run test:play` で数字を見られる。
 */
import { isPassageSection, sectionsFor } from '../data/exerciseTypes.js'

/** その教材が、もう持っている演習の種類 */
export const sectionTypesOf = (material) =>
  new Set((material?.sections ?? [])
    .map((s) => s?.exercise_type)
    .filter(Boolean))

/** 本文の演習(記事・会話)。**種類を書き写さない** —— `isPassageSection()` が決める */
export const bodySectionOf = (material) =>
  (material?.sections ?? []).find((s) => isPassageSection(s?.exercise_type)) ?? null

/**
 * 本文の英文を、AI に渡す形につなぐ。
 *
 * **作るときとまったく同じ形にしてある**(`generateFromScript` は
 * 段落を `\n\n` でつないで `context` に渡す)。**2通りに数えない。**
 */
export const bodyTextOf = (material) => (bodySectionOf(material)?.items ?? [])
  .map((it) => String(it?.prompt_en ?? '').trim())
  .filter(Boolean)
  .join('\n\n')

/**
 * **足りない演習。**
 *
 * - 本文は入れない(**作り直さない**)
 * - すでにある種類は入れない(**二度作らない**)
 * - 本文が無ければ、何も返さない
 *
 * @returns {{exercise_type: string, count: number}[]} 既定の並びのまま
 */
export const fillableSections = (material) => {
  if (!bodyTextOf(material)) return []
  const have = sectionTypesOf(material)
  return sectionsFor(material?.kind)
    .filter((s) => !isPassageSection(s.exercise_type))
    .filter((s) => !have.has(s.exercise_type))
}

/**
 * 足せるものがあるか。**ボタンを出すかどうかの判断は、ここ1か所**
 * (効かない操作を見せない・CLAUDE.md)。
 */
export const canFillMaterial = (material) => fillableSections(material).length > 0

/** 窓口を1回呼ぶたびの土台(指示文と本文)ぶん(円) */
export const FILL_CALL_YEN = 0.5
/** 1問あたり(円) */
export const FILL_ITEM_YEN = 0.3

/**
 * **作る前の見積もり。**
 *
 * **これは見積もりであって、実額ではない。** 本文が長いほど上ぶれする。
 * 画面では「およそ」と添えること
 * (**分かっていないことを、分かったように書かない**・CLAUDE.md)。
 *
 * **0 件のときは 0 円。** 呼ばないので土台もかからない
 * (CLAUDE.md「0 と `null` を取り違えない」)。
 *
 * @param list `fillableSections()` が返す組(選び直したあとのもの)
 * @returns {{sections: number, items: number, yen: number}}
 */
export const fillGuess = (list) => {
  const picked = (list ?? []).filter((s) => s?.exercise_type && s.count > 0)
  const items = picked.reduce((n, s) => n + s.count, 0)
  return {
    sections: picked.length,
    items,
    yen: picked.length
      ? Math.round((FILL_CALL_YEN * picked.length + FILL_ITEM_YEN * items) * 10) / 10
      : 0,
  }
}
