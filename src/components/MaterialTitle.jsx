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
  title, fallbackTags = [], headline = null, weakness = '',
  /**
   * 見出しの訳(0036・2026-09 利用者の指定「1番上のタイトルに小さな訳を」)。
   *
   * 教材名(`main`)は「意外な話」のような**短い呼び名**であって、
   * 英語の見出しの訳ではない。そのため見出しだけが、
   * **日本語のないまま**置かれていた。本文を読む前にいちばん先に
   * 目が行くところである。
   *
   * **渡されたときだけ出す。** 0036 を貼る前に作った教材には入っていない
   * (`phonetic` や `question_ja` と同じ扱い)。
   */
  headlineJa = null,
  as: Tag = 'h3', size = 'card', hideDate = false,
}) {
  const { date, main, tags } = parseMaterialTitle(title)
  // 教材名に条件が入っていれば、それを札にする。手で付けた名前など、
  // 入っていないときは呼び出し側から渡されたもの(レベル・種類・業界)を使う。
  const chips = (tags.length ? tags : fallbackTags).filter(Boolean)

  /**
   * **弱点の札だけを目立たせる**(2026-08 利用者の指定)。
   *
   * > 弱点ポイントをもう少し目立たせてください。
   *
   * 何の弱点の教材かは、選ぶときにいちばん見る情報である。
   * レベルや業界と同じ見た目だと、札の列に埋もれる。
   *
   * **どれが弱点かは、呼び出し側から受け取る。** 札の並び順や
   * 文字の形から当てない(手で名前を付けた教材では並びが変わる)。
   * 見出しそのものが弱点のとき(文型ドリル)は、札で繰り返さない。
   */
  const w = String(weakness ?? '').trim()

  /* `hideDate` は、**呼ぶ側が日付を別の場所に出すとき**に使う。
     さがす画面は「日付を右上、その下にカテゴリー名」という並びにしてある
     (2026-08 利用者の指定)ので、日付をここでは出さない。
     **2か所に出さない。** 出すと同じ日付が2つ並ぶ。 */

  return (
    <div className={`mtitle mtitle--${size}`}>
      <div className="mtitle-row">
        <Tag className="mtitle-main">{main || '(名前のない教材)'}</Tag>
        {date && !hideDate && <span className="mtitle-date">{date}</span>}
      </div>
      {/* 教材名そのものが見出しになっている古い教材では、同じ英文が2行
          続けて並んでしまう(2026-08 実機)。同じなら2行目は出さない。 */}
      {headline && headline.trim() !== (main ?? '').trim() && (
        <>
          <div className="mtitle-headline" lang="en">{headline}</div>
          {/* **英語のすぐ下に、小さく。** 添え物なので、
              見出しより先に目が行ってはいけない */}
          {String(headlineJa ?? '').trim() && (
            <div className="mtitle-headline-ja">{headlineJa}</div>
          )}
        </>
      )}
      {chips.length > 0 && (
        <div className="mtitle-chips">
          {chips.map((c, i) => (
            <span key={i}
                  className={`mtitle-chip${c === w && main.trim() !== w ? ' mtitle-chip--main' : ''}`}>
              {c}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
