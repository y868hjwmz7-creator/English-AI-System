/**
 * 単語帳 / Quick Response 帳の控え(**紙にだけ出す**)。
 *
 * 【なぜ要るか】(2026-09 利用者の指定)
 *
 *   > ちなみに、単語帳やクイックレスポン帖の内容を印刷する機能を
 *   > 追加してください。
 *   > フォーマットは、左に日本語、右に英語が来るようにしてください。
 *   > 教材を印刷、PDFにした時のクイックレスポンの部分と同じ仕様です
 *
 * 【**同じ仕様**を、そのまま使う】
 *   教材の紙のいちばん後ろのページ(`QuickResponseSheet`)は、
 *   すでに「左に日本語・右に英語」で刷っている。
 *   その見た目は `styles.css` の
 *   **`.qrsheet-list` / `.qrsheet-ja` / `.qrsheet-en` 1か所**にあるので、
 *   ここはその指定に乗るだけにする ——
 *   **同じ見た目を2か所に書き写さない**(CLAUDE.md)。
 *   片方を直したときに、もう片方だけ古くなることが起こりえない。
 *
 * 【`print-only` で出す】
 *   画面には出さない。`styles.css` の `.print-only` が
 *   ふだんは隠し、印刷のときだけ出す(`QuickResponseSheet` と同じ作法)。
 *
 * 【中身は作らない】
 *   対は `reviewSheet.js` が作る。**数え方を2通り持たない。**
 */
import { SHEET_ID } from '../lib/printSheet.js'

export default function ReviewSheet({ title, note, lead, pairs }) {
  const list = Array.isArray(pairs) ? pairs : []
  if (!list.length) return null

  return (
    <div className="print-only" id={SHEET_ID}>
      {/* 紙に出したときの見出し。**何の紙か分からないものが配られると、
          あとで整理できない**(教材の紙と同じ作法・`MaterialBody`) */}
      <div className="print-head">
        <strong>{title}</strong>
        <div>{note}</div>
      </div>
      <p className="card-hint lesson-instruction">{lead}</p>
      <ol className="qrsheet-list">
        {list.map((p, i) => (
          <li key={`${p.key || p.en}:${i}`}>
            <span className="qrsheet-ja">{p.ja}</span>
            <span className="qrsheet-en" lang="en">{p.en}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
