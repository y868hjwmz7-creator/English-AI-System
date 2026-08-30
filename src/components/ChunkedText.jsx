/**
 * カタマリごとの訳を、**英語のすぐ下**に並べて描く(2026-08 利用者の指定)。
 *
 *     How long / is the ride?
 *     どれくらい    乗っているのは
 *
 * 【並び順】(2026-08 利用者の指定で改めた)
 *   > スラッシュリーディングは英語が上、訳が下でお願いします。
 *
 *   はじめは訳を上に置いていた(利用者の紙がその形だったため)。
 *   画面では**英語を先に読んで、下で意味を確かめる**ほうが合う。
 *
 * 【訳は、そのカタマリの**まん中**に置く】(2026-08 利用者の指定)
 *   > 日本語を英語のスラッシュとスラッシュの間の真ん中に
 *
 *   左に寄せると、英語が長いカタマリでどこに対応する訳なのか分かりにくい。
 *   まん中に置けば、上の英語のどこを指しているか目で追える。
 *   **訳の側にスラッシュは出さない。** 区切りは上の英語が示している。
 *
 * 【訳が無いときは、英語だけを出す】
 *   カタマリの訳は教材に控えてある(0021)。控えの無い教材
 *   (0021 より前に作ったもの)や、あとから英文を直した教材では
 *   **数が合わないので出さない。** ずれた対は、無いより害が大きい。
 *
 * 【1カタマリ = 1つの縦の組】
 *   訳と英語を別々の行に分けて書くと、幅が変わったときに縦がずれる。
 *   カタマリごとに縦の組を作り、それを横に流して折り返させる。
 *   こうすると、どの幅でも訳と英語の対応が崩れない。
 */
import { chunkPairs } from '../lib/chunkJa.js'
import SlashedText from './SlashedText.jsx'

export default function ChunkedText({ text, ja = null, level = 'beginner', showJa = true }) {
  const pairs = chunkPairs(text, ja, level)
  // 控えが無い / 数が合わない。**英語だけを、これまでどおり出す**
  if (!pairs) return <SlashedText text={text} level={level} />

  return (
    <span className="chunked">
      {pairs.map((p, i) => (
        <span className="chunk" key={i}>
          <span className="chunk-en" lang="en">
            {i > 0 && <span className="chunk-bar" aria-hidden="true">/</span>}
            {p.en}
          </span>
          {showJa && <span className="chunk-ja">{p.ja || '　'}</span>}
        </span>
      ))}
    </span>
  )
}
