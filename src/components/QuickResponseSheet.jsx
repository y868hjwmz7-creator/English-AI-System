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
import { QR_MODES, chunkGroups, quickResponsePairs } from '../lib/quickResponse.js'

/** 1問を1行に。**日本語が問題、英語が答え**(左右の決まりはここ1か所) */
const 行 = (p) => (
  <li key={p.key}>
    <span className="qrsheet-ja">{p.ja}</span>
    <span className="qrsheet-en" lang="en">{p.en}</span>
  </li>
)

export default function QuickResponseSheet({ material }) {
  const groups = QR_MODES
    .map((m) => {
      const pairs = quickResponsePairs(material, m.id)
      /* **表現ごとに束ねられるか**(第5.243節)。
         **`m.id === 'chunk'` とは書かない** —— 束ねられる対だけが
         `headKey` を持っているので、**性質で分かれる**(CLAUDE.md)。
         取り組み方を足しても、ここは1行も変わらない */
      return { ...m, pairs, heads: chunkGroups(pairs) }
    })
    .filter((g) => g.pairs.length > 0)
  if (!groups.length) return null

  return (
    <section className="print-only qrsheet">
      <h3 className="lesson-section section-title">Quick Response</h3>
      <p className="card-hint lesson-instruction">
        左の日本語を見て、すぐに英語で言いましょう。右が答えです。
      </p>
      {groups.map((g) => {
        /* **表現を見出しにしたぶん、問の数が減る**(表現そのものは問ではなくなる)。
           数は**数え直して**出す —— 書き写すと、片方だけ古くなる */
        const 問 = g.heads.length
          ? g.heads.reduce((n, h) => n + h.pairs.length, 0)
          : g.pairs.length
        return (
          <div key={g.id} className="qrsheet-group">
            {/* 取り組み方が2つあるときだけ、見出しで分ける */}
            {groups.length > 1 && (
              <h4 className="qrsheet-title">
                {g.label}({g.heads.length ? `${g.heads.length} 表現・` : ''}{問} 問)
              </h4>
            )}
            {/* ── **覚えておきたい表現は、表現ごとに見出しを立てる**
                   (第5.243節・2026-09-23 実機・利用者の指定)

                   > これらピックアップした表現ごとに見出しにして、
                   > 問題の番号もそれぞれ①〜⑥(問題数に応じて)にするべきです

                 これまでは 42 問がひと続きの通し番号で、**表現そのもの
                 (bring up)も番号付きの1問として混ざっていた。**
                 どこからどこまでが同じ表現の練習なのか、紙では分からない。

                 いまは表現が見出しになり、その下の練習が1から振り直される
                 (`ol.qrsheet-list` は自分で `counter-reset` を持っている)。

                 **練習が1つも無い表現も、見出しだけ出す** ——
                 教材にあるものを黙って落とさない(CLAUDE.md) */}
            {g.heads.length ? g.heads.map((h) => (
              <div key={h.key} className="qrsheet-head">
                <h5 className="qrsheet-sub">
                  <span lang="en">{h.en}</span>
                  {h.ja && <span className="qrsheet-subja">{h.ja}</span>}
                </h5>
                {h.pairs.length > 0 && (
                  <ol className="qrsheet-list">{h.pairs.map(行)}</ol>
                )}
              </div>
            )) : (
              <ol className="qrsheet-list">{g.pairs.map(行)}</ol>
            )}
          </div>
        )
      })}
    </section>
  )
}
