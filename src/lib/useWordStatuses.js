/**
 * 「知っていた / 知らなかった」を扱う仕掛けを、1か所にまとめたもの。
 *
 * 【なぜ部品にしたか】(2026-08 利用者の指定)
 *   > トレーナーもゲストと同じく日々英語学習を進めております。
 *   > トレーナー側にも吹き出し内に「知っている」「知らなかった」を追加して。
 *
 *   これまでゲストの画面(`LearnerHomework`)にしか入れていなかった。
 *   同じものをトレーナーの画面へ写すと、**同じ処理が3つに増える。**
 *   増えると、片方だけ直して食い違う(語の吹き出しで一度やっている)。
 *
 * 【誰の記録になるか】
 *   `word_reviews` の主キーは (ログインしている人, 語) である。
 *   トレーナーが付ければ**トレーナー自身の記録**になり、
 *   担当ゲストの記録には一切触れない。RLS が `learner_id = auth.uid()` で
 *   縛っているので、取り違えは起こらない(仕様書 第5.23.5節)。
 *   テーブルの列名が `learner_id` なのは DB の呼び方であって、
 *   「ゲストのもの」という意味ではない。
 */
import { useCallback, useEffect, useState } from 'react'
import { clearWordStatus, loadMyWordStatuses, setWordStatus } from './vocab.js'

export default function useWordStatuses() {
  const [statuses, setStatuses] = useState(() => new Map())
  const [error, setError] = useState(null)

  useEffect(() => {
    loadMyWordStatuses().then(({ data }) => { if (data) setStatuses(data) })
  }, [])

  /**
   * 語に「知っていた / 知らなかった」を付ける(null で取り消し)。
   * **手元の表示を先に変える。** 通信を待って色が変わるのでは、
   * 押した手ごたえが無い。失敗したら元に戻す。
   */
  const mark = useCallback(async (norm, status, kind = 'word') => {
    let before = null
    setStatuses((m) => {
      before = m
      const next = new Map(m)
      if (status) next.set(norm, status)
      else next.delete(norm)
      return next
    })
    const { error: e } = status
      ? await setWordStatus(norm, status, { kind })
      : await clearWordStatus(norm)
    if (e) { setError(e); if (before) setStatuses(before) }
  }, [])

  /** 画面から読み直したいとき(単語帳で状態を変えたあとなど) */
  const reload = useCallback(async () => {
    const { data } = await loadMyWordStatuses()
    if (data) setStatuses(data)
  }, [])

  return { statuses, mark, reload, error }
}
