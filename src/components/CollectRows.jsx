/**
 * **集める楽しみ**(2026-09 利用者の指定)。
 *
 *   > 集める楽しみ(業界・場面ごと)
 *
 * ============================================================================
 * 【すでにあったのに、どこからも呼んでいなかった】
 *
 *   `vocab_by_industry()` は **0019 からある**(業界別に、覚えた語と
 *   覚えかけの語を数える)。ところが `loadVocabByIndustry()` を
 *   **呼んでいる画面が1つも無かった。**
 *   作ってあるのに、誰にも見えていなかったことになる。
 *
 * 【数字ではなく、そろい具合を出す】
 *
 *   「建設 40 語」だけでは、多いのか少ないのか分からない。
 *   **覚えた / 出会った**の比を帯にすると、**そろっていく**のが目で分かる。
 *
 *   - **3つまで。** 並べるほど、どれも読まれない(CLAUDE.md)
 *   - **色だけに頼らない。** 数(40 / 52)も必ず添える
 *   - 名前は `industryLabel()` に任せる。**対応表を2か所に持たない**
 */
import { collectRows } from '../lib/gamify.js'
import { industryLabel } from '../data/industries.js'

/**
 * @param rows  `vocab_by_industry()` が返した行
 * @param limit いくつ出すか
 */
export default function CollectRows({ rows = [], limit = 3 }) {
  const list = collectRows(rows, { limit })
  if (!list.length) return null

  return (
    <div className="collect">
      <p className="collect-head">集まり具合</p>
      <ul className="collect-list">
        {list.map((r) => (
          <li key={r.industry}>
            <span className="collect-name">{industryLabel(r.industry)}</span>
            <span className="collect-bar" aria-hidden="true">
              <span style={{ width: `${Math.round(r.ratio * 100)}%` }} />
            </span>
            {/* **数も必ず添える。** 帯の長さだけでは、何語なのか分からない */}
            <span className="collect-num">
              {r.known}<span className="collect-of"> / {r.total}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
