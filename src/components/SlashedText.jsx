/**
 * 区切り(スラッシュ)を入れた英文を、読むためだけに描く。
 *
 * ② スラッシュリーディングは**自分で押して入れる**画面だが、
 * ③⑤(オーバーラッピング・シャドーイング)では**出来上がったものを
 * 見ながら声に出す**ので、押せる必要はない。
 * 区切りの決まりは②と同じ(`chunker.js`)。**2か所に持たない。**
 */
import { Fragment } from 'react'
import { slashesFor, wordsOf } from '../lib/chunker.js'

export default function SlashedText({ text, level = 'beginner' }) {
  const words = wordsOf(text)
  // `level` が null なら、区切りを出さずに素の英文として描く
  const marks = new Set(level ? slashesFor(text, level).map((x) => x.at) : [])
  return (
    <span lang="en">
      {words.map((w, i) => (
        <Fragment key={i}>
          {/* 空白は囲みの外に置く。中に入れると改行できる場所が無くなる */}
          <span className="slash-w">
            {marks.has(i) && <span className="slash-mark" aria-hidden="true">/</span>}
            {w}
          </span>
          {' '}
        </Fragment>
      ))}
    </span>
  )
}
