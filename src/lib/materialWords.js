/**
 * **その教材の「語句」**(単語 / フレーズの演習に並んでいるもの)。
 *
 * ============================================================================
 * 【なぜ要るか】(2026-09 利用者の指摘)
 *
 *   > 単語・フレーズの宿題をアサインされたことがゲスト側でわかるようにし、
 *   > とりあえずその単語とフレーズだけに取り組めるよう(任意)に
 *   > しないと、今のままでは何も気づかない
 *
 *   0047 で「共有したら、その教材の語がゲストの単語帳に入る」ようにしたが、
 *   **入れただけで、ゲストの画面には1文字も出していなかった。**
 *   単語帳を開いても、ほかの語に混ざって並ぶだけである。
 *   **黙って入れない**(CLAUDE.md)を、こちら側で破っていた。
 *
 *   だから「今週の宿題」のカードに
 *   **何語入ったか**と**その語だけ練習する道**を出す。
 *   そのために「この教材の語句は何か」を1か所で数える。
 *
 * 【なぜ何にも依存しない形で置くのか】
 *
 *   `src/lib/materials.js` は Supabase(`import.meta.env`)を引き連れて
 *   いるので、**素の node で一度も読み込めない。** ここは教材の中身を
 *   ほどくだけの算段なので、切り出しておけば `npm run test:play` が
 *   数字で確かめられる(`playMark.js` / `clozeSentence.js` と同じ考え方)。
 *
 * 【そろえ方(`normWord`)は、ここでは掛けない】
 *
 *   あれは `src/lib/vocab.js` にあり、Supabase を引き連れている。
 *   **そろえ方を4か所目に書き写さない**(SQL / 窓口 / 画面の3か所で
 *   そろえるのに苦労した)。ここは**教材に書いてあるとおり**を返し、
 *   そろえるのは呼ぶ側でやる。
 */

/**
 * 語句の演習かどうか。**`add_material_words()`(0047)と同じ2つ。**
 *
 * 記事の「本文に出てきた語句」(`vocab_note`)は入らない ——
 * あちらはゲストが本文の中で触って自分で選ぶ道がすでにあり、
 * 全部入れると記事1本ごとに8語ずつ勝手に溜まる(0047 と同じ判断)。
 * **片方だけ変えない。** 変えるならここと SQL の両方である。
 */
export const isVocabSection = (typeId) =>
  typeId === 'vocabulary' || typeId === 'phrase'

/**
 * その教材に並んでいる語句。
 *
 * @returns {{en: string, ja: string, kind: 'word'|'phrase'}[]}
 *          語句の演習が無ければ**空の配列**(呼ぶ側は行ごと出さない)
 */
export function materialWordsOf(material) {
  const out = []
  const seen = new Set()
  for (const sec of material?.sections ?? []) {
    if (!isVocabSection(sec?.exercise_type)) continue
    for (const it of sec?.items ?? []) {
      const en = String(it?.prompt_en ?? '').trim()
      if (!en) continue
      // 同じ語が2度並んでいても1つに数える(単語帳では1行になる)
      const key = en.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      out.push({
        en,
        ja: String(it?.prompt_ja ?? '').trim(),
        kind: sec.exercise_type === 'phrase' ? 'phrase' : 'word',
      })
    }
  }
  return out
}

/** 語句の演習を持っている教材か。**行を出すかどうかの判断はここ1か所** */
export const hasMaterialWords = (material) => materialWordsOf(material).length > 0
