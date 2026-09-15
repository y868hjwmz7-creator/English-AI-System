/**
 * **語と英文の「そろえ方」。何にも依存しない**(2026-09)。
 *
 * ============================================================================
 * 【なぜ切り出したか】
 *
 *   `normWord()` は `vocab.js`、`normEn()` は `materials.js` にあった。
 *   どちらも **Supabase を引き連れている**ので、
 *   **素の node で一度も走らせられない**(`playMark.js` / `mp3Join.js` /
 *   `focusChunks.js` と同じ話)。
 *
 *   ところがこの2つは、**ファイルに持った教材**
 *   (`nativeFlow.js` / `collocations.js` / `basicWords.js`)を
 *   覚え具合と突き合わせるときに要る。突き合わせる算段は
 *   `npm run test:play` が素の node で確かめたいので、ここへ出した。
 *
 *   **読む側は1行も変わっていない** —— `vocab.js` も `materials.js` も
 *   ここから読み直して、そのまま出し直している
 *   (`MATERIAL_KINDS` を `materialKinds.js` へ移したときと同じ作法)。
 *
 * 【書き写さない】
 *
 *   **同じ規則を2か所に書かない。** ずれると控えを引き当てられず、
 *   同じ語を何度も AI に尋ねることになる(費用が増える)。
 * ============================================================================
 */

/**
 * 語のそろえ方。
 *
 * **データベースの `public.norm_word()` と、Edge Function の `normWord()` と、
 * ここの3か所で同じ規則にする。** ずれると控えを引き当てられず、
 * 同じ語を何度も AI に尋ねることになる(費用が増える)。
 */
export const normWord = (text) =>
  String(text ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9'-]+/g, ' ')
    .trim()
    .replace(/^[\s'-]+|[\s'-]+$/g, '')

/**
 * 英文を突き合わせ用の形にそろえる。
 *
 * データベースの public.norm_en() と**同じ規則**にしてある
 * (0008_sentence_ledger.sql)。片方だけ変えると、手元の判定と
 * データベースの判定がずれて、片方を素通りする。
 */
export const normEn = (text) =>
  String(text ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
