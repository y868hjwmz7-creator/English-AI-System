/**
 * **テストの紙**(第5.260節・2026-09-25 利用者の指定「画面と紙の両方」)。
 *
 * 【中身は作らない】
 *   問題を組むのは `examBuild.js`。ここは**受け取って描くだけ**である
 *   (`ReviewSheet` / `QrCard` / `VolumeRow` と同じ作法 ——
 *    **描けないものは測れない**)。
 *
 * 【`print-only` で出す】
 *   画面には出さない。`styles.css` の `.print-only` が
 *   ふだんは隠し、印刷のときだけ出す(`ReviewSheet` と同じ作法)。
 *
 * 【2枚組にする ——「問題」と「答え」】
 *   1枚目が問題、2枚目が答えである。**同じ紙に答えを刷らない** ——
 *   テストにならない。
 *   分けるのは `.examsheet-answers`(`styles.css` 1か所)。
 *
 * 【どのページの下にも題を出す】
 *   `--sheet-name` に置く(`ReviewSheet` とまったく同じ道)。
 *   **紙をやめたら必ず外す** —— 外さないと、そのあと教材を刷ったときに
 *   テストの題が下に出たままになる。
 */
import { useLayoutEffect } from 'react'
import { SHEET_ID } from '../lib/printSheet.js'
import { cssString } from '../lib/reviewSheet.js'
import { examCountNote } from '../lib/examBuild.js'

export default function ExamSheet({ title, note, items }) {
  const list = Array.isArray(items) ? items : []

  useLayoutEffect(() => {
    if (!list.length) return undefined
    const root = document.documentElement
    root.style.setProperty('--sheet-name', cssString(title))
    return () => root.style.removeProperty('--sheet-name')
  }, [title, list.length])

  if (!list.length) return null

  return (
    <div className="print-only" id={SHEET_ID}>
      <div className="print-head">
        <strong>{title}</strong>
        <div>{note}</div>
      </div>

      {/* **名前と日付を書く欄。** 紙は配られて戻ってくるものなので、
          誰のものか分からなくなる */}
      <div className="examsheet-who">
        <span>名前</span>
        <span className="examsheet-line" />
        <span>点</span>
        <span className="examsheet-line examsheet-line--short" />
      </div>

      <ol className="examsheet-list">
        {list.map((q) => (
          <li key={q.no}>
            {/* **問いは、形によって英語だったり日本語だったりする。**
                英語のところにだけ `lang="en"` を付ける ——
                囲みに付けると、日本語の問いまで英語の字づかいで刷られる
                (`ReviewSheet` で踏んだところと同じ) */}
            <span className={`examsheet-q${q.form === 'blank' ? ' examsheet-q--en' : ''}`}
                  {...(q.form === 'blank' ? { lang: 'en' } : {})}>
              {q.question}
            </span>
            <span className="examsheet-line examsheet-line--answer" />
          </li>
        ))}
      </ol>

      {/* ── 答え(2枚目)──────────────────────────────────
          **改ページは、囲みの側に持たせる**(`.frames-sheet` と同じ作法)。
          空の `<div>` を挟む書き方は、紙にしか効かないものが
          画面の流れに残るので使わない */}
      <div className="examsheet-answers">
        <div className="print-head">
          <strong>{title} — 答え</strong>
          <div>{examCountNote(list)}</div>
        </div>
        <ol className="examsheet-list examsheet-list--key">
          {list.map((q) => (
            <li key={q.no}>
              <span className="examsheet-a" lang="en">{q.answer}</span>
              {/* **穴埋めのときは、もとの英文も出す。** 伏せた1語だけでは、
                  どの文の話だったのか読み返せない */}
              {q.form === 'blank' && <span className="examsheet-full" lang="en">{q.en}</span>}
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
