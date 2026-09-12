/**
 * 単語帳 / Quick Response 帳を、**紙に出すための対に直す。**
 *
 * 【何のためか】(2026-09 利用者の指定)
 *
 *   > 単語帳やクイックレスポン帖の内容を印刷する機能を追加してください。
 *   > フォーマットは、左に日本語、右に英語が来るようにしてください。
 *   > 教材を印刷、PDFにした時のクイックレスポンの部分と同じ仕様です
 *
 *   紙があれば、アプリを開けない場所でも同じ練習ができる
 *   (`QuickResponseSheet` を作ったときと、まったく同じ理由)。
 *
 * 【見た目は作らない。**教材の紙と同じものを使う**】
 *   左が日本語・右が英語という並びは、すでに
 *   `styles.css` の `.qrsheet-list` / `.qrsheet-ja` / `.qrsheet-en` が
 *   持っている(教材の紙のいちばん後ろのページ)。
 *   **同じ見た目を2か所に書き写さない**(CLAUDE.md)ので、
 *   ここは**対に直すだけ**にして、描くほうはその指定に乗せる。
 *
 * 【なぜ画面に書かないか】
 *   `Wordbook.jsx` も `QrReview.jsx` も Supabase を引き連れていて、
 *   **素の node で一度も走らせられない**(`playMark.js` と同じ考え方)。
 *   対の作り方をここへ出しておけば、`npm run test:play` が
 *   1つずつ機械的に確かめられる。
 */

/**
 * 単語帳の行を、紙の対に直す。
 *
 * **英語が無い行は落とす**(鍵が無いので、そもそも語として成り立たない)。
 * **訳が無い行は落とさない。** 控えがまだ引けていないだけで、
 * 語そのものは単語帳に入っている —— **黙って減らさない**(CLAUDE.md)。
 * そのときは左が空のまま並ぶ。
 */
export function wordSheetPairs(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map((r) => ({
      key: r?.word_norm || r?.display || '',
      ja: r?.meaning_ja || '',
      en: r?.display || r?.word_norm || '',
    }))
    .filter((p) => p.en)
}

/**
 * Quick Response の復習の行を、紙の対に直す。
 *
 * **訳の無い文は入っていない**(教材から溜めるときに落としている)ので、
 * ここでは英語の有無だけを見る。
 */
export function qrSheetPairs(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map((r) => ({
      key: r?.en_norm || r?.en || '',
      ja: r?.ja || '',
      en: r?.en || '',
    }))
    .filter((p) => p.en)
}

/**
 * 紙の副題。**何を刷ったのかが、紙だけ見て分かるようにする。**
 *
 * 単語帳も Quick Response 帳も**絞り込んだ状態のまま刷る**ので、
 * 数だけでは「ぜんぶ刷ったのか、絞ったのか」が分からない。
 * 絞っているときは、そう書く(**黙って絞らない**・CLAUDE.md)。
 *
 * 日付は**呼ぶ側が渡す**(この関数は端末の時計を見ない)。
 */
export function sheetNote({ count, unit, group = '', narrowed = 0, date = '' }) {
  const bits = [`全 ${count} ${unit}`]
  if (group) bits.push(group)
  if (narrowed > 0) bits.push(`絞り込み ${narrowed} 件`)
  if (date) bits.push(date)
  return bits.join(' / ')
}
