/**
 * Quick Response の控え(**紙にだけ出す**)。
 *
 * 【なぜ要るか】(2026-09 利用者の指定)
 *
 *   > クイックレスポンスの部分も印刷できるようにしてください。
 *   > ページは一番後ろで大丈夫です。
 *
 *   Quick Response は画面でやる練習なので、印刷では**練習の画面そのものを
 *   出さない**(ボタンも進み具合も紙には要らない)。
 *   代わりに、**日本語と英語の対を一覧**にして紙のいちばん後ろに置く。
 *   紙があれば、アプリを開けない場所でも同じ練習ができる。
 *
 * 【中身は作らない】
 *   対は教材にあるものをそのまま使う(`quickResponse.js`)。
 *   画面でやるものと**同じ文・同じ順**である。
 *
 * 【取り組み方は分けて出す】
 *   画面では「文章」と「フレーズ・単語」を切り替えるが、
 *   **紙は控えなので両方を続けて出す。** 見出しで分ける。
 *
 * 【`print-only` で出す】
 *   画面には出さない。`styles.css` の `.print-only` が
 *   ふだんは隠し、印刷のときだけ出す。
 */
import { QR_MODES, quickResponsePairs } from '../lib/quickResponse.js'

export default function QuickResponseSheet({ material }) {
  const groups = QR_MODES
    .map((m) => ({ ...m, pairs: quickResponsePairs(material, m.id) }))
    .filter((g) => g.pairs.length > 0)
  if (!groups.length) return null

  return (
    <section className="print-only qrsheet">
      <h3 className="lesson-section section-title">Quick Response</h3>
      <p className="card-hint lesson-instruction">
        左の日本語を見て、すぐに英語で言いましょう。右が答えです。
      </p>
      {groups.map((g) => (
        <div key={g.id} className="qrsheet-group">
          {/* 取り組み方が2つあるときだけ、見出しで分ける */}
          {groups.length > 1 && (
            <h4 className="qrsheet-title">{g.label}({g.pairs.length} 問)</h4>
          )}
          <ol className="qrsheet-list">
            {g.pairs.map((p) => (
              <li key={p.key}>
                <span className="qrsheet-ja">{p.ja}</span>
                <span className="qrsheet-en" lang="en">{p.en}</span>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </section>
  )
}
