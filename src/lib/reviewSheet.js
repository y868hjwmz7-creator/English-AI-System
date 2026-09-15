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
import { shelfLabel } from '../data/shelves.js'
import { tierOf } from '../data/basicsCourse.js'

/**
 * 単語帳の行を、紙の対に直す。
 *
 * **英語が無い行は落とす**(鍵が無いので、そもそも語として成り立たない)。
 * **訳が無い行は落とさない。** 控えがまだ引けていないだけで、
 * 語そのものは単語帳に入っている —— **黙って減らさない**(CLAUDE.md)。
 * そのときは左が空のまま並ぶ。
 *
 * 【品詞とレベルも持たせる】(2026-09 実機・利用者の指定)
 *
 *   > また、品詞とレベルも。
 *
 *   **新しい入れ物は1つも作っていない。** 品詞は `pos`、レベルは
 *   `material_level`(CEFR)で、どちらも**行がもともと持っている** ——
 *   自分の単語帳は `review_words()`(0048 でレベルを返すようにした)、
 *   棚は `joinRow()`(`shelfReviews.js`)、基礎単語は `basicRows()`。
 *   `Wordbook.jsx` の読み込みが、控えの無い語にだけ
 *   `posLabel(posGroupOf(...))` を当てて**日本語にそろえてある**ので、
 *   ここは受け取るだけでよい(**そろえ方を2か所に持たない**)。
 *
 *   **無い語は空のまま。** 当てずっぽうで埋めない ——
 *   品詞の分からない語に「名詞」と刷ると、**間違いを紙で配る**ことになる。
 */
export function wordSheetPairs(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map((r) => ({
      key: r?.word_norm || r?.display || '',
      ja: r?.meaning_ja || '',
      en: r?.display || r?.word_norm || '',
      pos: r?.pos || '',
      level: r?.material_level || '',
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

/* ══════════════════════════════════════════════════════════════════════
 * **どの単語帳を刷ったのかを、題に書く**(2026-09 実機・利用者の指定)
 *
 *   > 業種別の単語帳をプリントアウトした時、またはPDF化した時に、
 *   > タイトルの部分を「単語」だけでなく「ビジネス一般」と
 *   > ページ数、そして各単語に番号を振ってください。
 *
 * 単語帳は**3冊ある**(自分の / 業種べつ / 基礎単語)のに、題は
 * ずっと「単語帳」だけだった。**刷った紙を見ても、どの冊なのか
 * 分からない。** 200 語で 10 枚になるので、なおさらである。
 *
 * **判断をここ1か所に置く。** `Wordbook.jsx` は Supabase を
 * 引き連れていて**素の node で一度も走らせられない**ので、
 * 画面の中で組み立てると確かめる術が無い(`playMark.js` と同じ考え方)。
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * いま開いている冊の名前。**自分の単語帳は空**(題が「単語帳」で足りる)。
 *
 * **名前の一覧をここに書かない。** 棚は `shelfLabel()`、段は
 * `tierOf()` が持っている —— 分野や段を足したときに、
 * **ここだけ古くなる**ことが起こりえない。
 *
 * 棚は**1冊ずつ開く**のがふつうだが(プルダウン)、複数でも並べて出す。
 */
export function bookLabel({ book = 'my', shelves = [], tier = '' } = {}) {
  if (book === 'shelf') {
    /* **空の id を引かない。** `shelfLabel('')` は「汎用」を返すので、
       そのまま通すと**選んでいない棚の名前が題に出る** ——
       紙に嘘を刷ることになる(検証がここを捕まえた)。
       **知らない id は、そのまま出す** —— あちらは
       `shelfLabel()` の決まりに従い、黙って落とさない */
    return (Array.isArray(shelves) ? shelves : [])
      .filter(Boolean)
      .map((id) => shelfLabel(id))
      .filter(Boolean)
      .join(' / ')
  }
  if (book === 'basic') return tierOf(tier).label
  return ''
}

/**
 * 紙の題。**「誰の」と「どの冊か」を、この1か所で組み立てる。**
 *
 * @param owner 敬称まで付けた名前(トレーナーが開いているとき)。無ければ空
 */
export function sheetTitle({ owner = '', book = 'my', shelves = [], tier = '' } = {}) {
  const head = owner ? `${owner}の単語帳` : '単語帳'
  const what = bookLabel({ book, shelves, tier })
  return what ? `${head} — ${what}` : head
}

/**
 * CSS の文字列(`"…"`)に直す。**紙のどのページにも題を出すために要る。**
 *
 * ページの下に出す文字は `@page { @bottom-left { content: … } }` が
 * 描くので、**DOM には無い。** そこへ値を渡す道は
 * **カスタムプロパティしか無い**(`content: var(--sheet-name, "")`)ので、
 * 題を CSS の文字列として書き直して `<html>` に置く。
 *
 * **引用符と `\` を必ず逃がす。** 逃がさないと、題に `"` が1つ入った
 * だけで**その宣言ごと壊れ、どのページにも何も出なくなる。**
 * 改行も CSS の文字列には直に書けないので、空白に直す。
 */
export function cssString(s) {
  return `"${String(s ?? '').replace(/[\\"]/g, '\\$&').replace(/\s+/g, ' ').trim()}"`
}
