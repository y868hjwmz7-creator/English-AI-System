/**
 * 教材の見出し。
 *
 * 【なぜ部品にしたか】
 *   教材名は「2026-08-27 / 数の表現 + 数字 / B1 / 製造」の形で
 *   自動生成される。そのまま1行で出すと、**日付と条件に埋もれて
 *   「何の教材か」が読み取れない**(2026-08 の指摘)。
 *
 *   よくある作りに合わせた:
 *     ・見出しは**弱点だけ**を大きく
 *     ・レベル・業界・ゲスト名は**小さな札**にして下に並べる
 *     ・日付は右上に小さく
 *
 *   一覧・レッスン表示・紙の全部で同じ見え方にするため、部品にしてある。
 *   **保存されている教材名は変えない。** 既にある教材もそのまま直る。
 */
import { parseMaterialTitle } from '../lib/format.js'

export default function MaterialTitle({
  title, fallbackTags = [], headline = null, as: Tag = 'h3', size = 'card',
}) {
  const { date, main, tags } = parseMaterialTitle(title)
  // 教材名に条件が入っていれば、それを札にする。手で付けた名前など、
  // 入っていないときは呼び出し側から渡されたもの(レベル・種類・業界)を使う。
  const chips = (tags.length ? tags : fallbackTags).filter(Boolean)

  return (
    <div className={`mtitle mtitle--${size}`}>
      <div className="mtitle-row">
        <Tag className="mtitle-main">{main || '(名前のない教材)'}</Tag>
        {date && <span className="mtitle-date">{date}</span>}
      </div>
      {headline && <div className="mtitle-headline" lang="en">{headline}</div>}
      {chips.length > 0 && (
        <div className="mtitle-chips">
          {chips.map((c, i) => <span key={i} className="mtitle-chip">{c}</span>)}
        </div>
      )}
    </div>
  )
}
