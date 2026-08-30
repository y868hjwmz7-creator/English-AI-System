/**
 * カタマリごとの訳を、**英語の真上**に並べて描く(2026-08 利用者の指定)。
 *
 * 利用者が紙で配っている教材と同じ形にしてある。
 *
 *     どれくらいの長さですか / 乗っているのは
 *     How long              / is the ride?
 *
 * 【なぜ「上」なのか】
 *   利用者の紙も、訳が上・英語が下である。前から順に、
 *   **訳を先に見てから英語を確かめる**という読み方に合っている。
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
          {showJa && (
            <span className="chunk-ja">
              {i > 0 && <span className="chunk-bar" aria-hidden="true">/</span>}
              {p.ja || '　'}
            </span>
          )}
          <span className="chunk-en" lang="en">
            {i > 0 && <span className="chunk-bar" aria-hidden="true">/</span>}
            {p.en}
          </span>
        </span>
      ))}
    </span>
  )
}
