/**
 * セッションの記録の控え(**紙にだけ出す**・第5.303節・2026-09-28 利用者の指定)。
 *
 *   > 日付と内容を見出しをつけてまとめて出力する機能
 *
 * 【`print-only` で出す】
 *   画面には出さない。`styles.css` の `.print-only` が
 *   ふだんは隠し、印刷のときだけ出す(`ReviewSheet` と同じ作法)。
 *
 * 【出す場所の id も、`printSheet.js` が持っている】
 *   `SHEET_ID` を画面ごとに書くと、片方を変えたときに**紙が真っ白になる。**
 *
 * 【中身は組み立てない】
 *   日付ごとに分けるのは `noteSections()`(`noteDigest.js`)1か所。
 *   **数え方を2通り持たない**(CLAUDE.md)。
 */
import { noteDay } from '../lib/noteDigest.js'
import { SHEET_ID } from '../lib/printSheet.js'

export default function NotesSheet({ title = '', sections = [] }) {
  if (!sections.length) return null

  return (
    <div className="print-only" id={SHEET_ID}>
      {/* **何の紙か分からないものが配られると、あとで整理できない**
          (`ReviewSheet` / `MaterialBody` と同じ作法) */}
      <div className="print-head">
        <strong>{title}</strong>
        <div>{sections.length} 日ぶん</div>
      </div>

      {sections.map((sec) => (
        <section className="notesheet-day" key={sec.date}>
          <h4 className="notesheet-date">{noteDay(sec.date)}</h4>
          {sec.parts.map((p) => (
            <div className="notesheet-part" key={p.who}>
              <div className="notesheet-who">{p.who}</div>
              {/* **改行はそのまま**(書いたとおりに刷る) */}
              <div className="notesheet-text">{p.text}</div>
            </div>
          ))}
        </section>
      ))}
    </div>
  )
}
