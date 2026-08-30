/**
 * 発音記号。
 *
 * 【なぜ要るか】(2026-08 利用者の指定)
 *   > フレーズや単語、発音のトレーニングはすべて発音記号を表示してください。
 *
 *   発音の練習をする教材なのに、どう読むのかが書いていなかった。
 *   お手本の音は鳴らせるが、**耳で聞いただけでは、どの音を出しているのかが
 *   分からない。** 記号があれば「語尾に母音を足さない」のような注意も、
 *   目で確かめられる。
 *
 * 【中身は教材に入っている】
 *   `material_items.phonetic`(0020)。**開くたびに引かない。**
 *   引いて回ると 1教材20項目 × ゲスト500人ぶんの呼び出しになる
 *   (要点フレーズ `phrases` と同じ考え方)。
 *
 * 【スラッシュはここで付ける】
 *   控えの中身は記号だけ。`/ /` は画面が付ける。
 *   AI が付けたり付けなかったりしても、見た目が揃う。
 */
export default function Phonetic({ value, className = '' }) {
  const text = String(value ?? '').trim().replace(/^\/+|\/+$/g, '').trim()
  if (!text) return null
  return (
    <span className={`phonetic ${className}`.trim()} lang="en-fonipa" aria-label={`発音記号 ${text}`}>
      /{text}/
    </span>
  )
}
