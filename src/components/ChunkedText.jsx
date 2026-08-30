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
 * 【狭い画面では、上下に並べず**同じ場所で入れ替える**】(2026-08 利用者の指定)
 *   > スマホの時は日本語と英語は切り替え表示、同じ位置になるように
 *   > してください。無理して両方見せても窮屈に感じますね。
 *
 *   スマホでは1カタマリで1行を使い切る。上下に並べると**行数が倍**になり、
 *   1段落を見るのに何度も画面を送ることになる。
 *   そこで **英語か訳のどちらか一方**だけを、同じ場所に出す。
 *
 *   - どちらを出すかは `ChunkSideToggle`(「英語 / 訳」の札)で選ぶ。
 *     **選んだら覚える**(`slashLevel.js`)。開くたびに選び直させない
 *   - **切り替えても位置が変わらないよう、訳も英語と同じ大きさで出す。**
 *     小さい字のままだと行の高さが変わり、押した札の位置がずれる
 *   - **このときは訳の側にもスラッシュを出す。** 上に英語が無いので、
 *     区切りを示すものが他に無くなる
 *   - **判断は幅だけ**(860px)。端末の種類も文字数も見ない
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
import { NARROW_AT, useChunkSide } from '../lib/slashLevel.js'
import { useWide } from '../lib/nav.js'
import SlashedText from './SlashedText.jsx'

export default function ChunkedText({ text, ja = null, level = 'beginner', showJa = true }) {
  const wide = useWide(NARROW_AT)
  const side = useChunkSide()
  const pairs = chunkPairs(text, ja, level)

  // 控えが無い / 数が合わない。**英語だけを、これまでどおり出す**
  if (!pairs) return <SlashedText text={text} level={level} />

  // 狭い画面では、上下に並べず**どちらか一方**を同じ場所に出す
  const swap = !wide && showJa
  const jaOnly = swap && side === 'ja'
  const stacked = showJa && !swap

  return (
    <span className={`chunked${swap ? ' chunked--swap' : ''}`}>
      {pairs.map((p, i) => (
        <span className="chunk" key={i}>
          {jaOnly ? (
            // **訳だけ。** 上に英語が無いので、区切りはこちらに出す
            <span className="chunk-en chunk-en--ja">
              {i > 0 && <span className="chunk-bar" aria-hidden="true">/</span>}
              <span className="chunk-band">{p.ja || '　'}</span>
            </span>
          ) : (
            <span className="chunk-en" lang="en">
              {i > 0 && <span className="chunk-bar" aria-hidden="true">/</span>}
              {p.en}
            </span>
          )}
          {stacked && <span className="chunk-ja">{p.ja || '　'}</span>}
        </span>
      ))}
    </span>
  )
}
