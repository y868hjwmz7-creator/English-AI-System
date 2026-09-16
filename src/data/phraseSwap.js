/**
 * **名詞句を入れ替える練習**(2026-09 利用者の指定)。
 *
 *   > どのビジネスでも使える「名詞句」を厳選し、単語帳に一つのコンテンツとして
 *   > 置き、**5文だけでなく、そこを言い換える練習**ができるようにしたい。
 *
 * ============================================================================
 * 【何をする練習か】
 *
 *   66 の型は**骨**で、名詞句は**肉**である。
 *   骨を固定して、**肉だけを入れ替える。**
 *
 *     When it comes to 〔 the cost of delay 〕, we need to be careful.
 *     When it comes to 〔 a lack of information 〕, we need to be careful.
 *     When it comes to 〔 a tight deadline 〕, we need to be careful.
 *
 *   例文を5つ読むのと違い、**80 通りを自分の口から出す**ことになる。
 *
 * 【骨は「どんな名詞句でも入る」ものだけ】
 *
 *   `There is ___.` のような骨は、冠詞で当たり外れが出る
 *   (`There is a problem with the data.` は自然だが
 *   `There is the root cause.` はおかしい)。
 *   **`a` でも `the` でも自然に入る骨だけ**を7つ選んである。
 *
 * 【出せない組み合わせは、はじめから出さない】
 *
 *   7 × 80 = 560 通りのうち、**4通りだけ機械で確かめられない**
 *   (`the fact that we are behind` を入れると別の型に見える。
 *   `short notice` は冠詞が無いので `It is X that` の決まりが弾く)。
 *
 *   **確かめられないものを出して「ちがう型です」と言わない** ——
 *   正しく言えた人に嘘をつくことになる(`frameShift.js` の決まりと同じ)。
 *   だから `swapQuestions()` が**機械で確かめてから出す。**
 *   一覧を手で書かないので、**名詞句を足したときも自動で付いてくる。**
 *
 * @property id   骨の id
 * @property form 型(`sentenceFrames.js` の `form` と1文字も違えない)
 * @property en   骨。`___` のところに名詞句が入る
 * @property ja   お題の型。`___` のところに名詞句の意味が入る
 */

/** 名詞句を入れるところ。**2か所に書かない** */
export const SWAP_BLANK = '___'

/** 骨。**並べ替えない。減らさない** */
export const SWAP_FRAMES = [
  { id: 'about', form: 'When it comes to ~', en: 'When it comes to ___, we need to be careful.', ja: '___については、慎重にいきたい' },
  { id: 'asfor', form: 'As for ~', en: 'As for ___, nothing has changed.', ja: '___については、変わっていない' },
  { id: 'terms', form: 'In terms of ~', en: 'In terms of ___, we are fine.', ja: '___の点では、問題ない' },
  { id: 'based', form: 'Based on ~', en: 'Based on ___, we decided to wait.', ja: '___をふまえて、待つことにした' },
  { id: 'given', form: 'Given (that) ~', en: 'Given ___, we should wait.', ja: '___を考えると、待つべきだ' },
  { id: 'what', form: 'What ~ is …', en: 'What matters here is ___.', ja: 'ここで大事なのは___だ' },
  { id: 'itis', form: 'It is X that / who ~', en: 'It is ___ that we should discuss first.', ja: 'まず話すべきなのは___だ' },
]

/** id から骨を引く。知らない id は `null`(**当てずっぽうで返さない**) */
export const swapFrameOf = (id) => SWAP_FRAMES.find((f) => f.id === id) ?? null

/** 骨に名詞句を入れて、英文にする。**入れる場所はここだけが知っている** */
export const swapSentence = (frame, phrase) =>
  String(frame?.en ?? '').replace(SWAP_BLANK, String(phrase ?? ''))

/** 骨に意味を入れて、お題にする */
export const swapJa = (frame, meaning) =>
  String(frame?.ja ?? '').replace(SWAP_BLANK, String(meaning ?? ''))
