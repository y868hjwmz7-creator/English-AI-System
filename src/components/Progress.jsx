/**
 * **達成具合** —— 自分の進み具合を、じっくり見るページ(2026-09 利用者の指定)。
 *
 * ============================================================================
 *   > ゲストアカウントの単語帳と quick response も同じ仕様にしましょう。
 *   > 達成具合を確認するには別の専用ページに飛んで出来るようにすれば良いので
 *
 * 【なぜ独立したページなのか】
 *
 *   単語帳と Quick Response は**開いた瞬間に問が出る**形になった(第5.167節)。
 *   進み具合の3枚の札は、**練習の手前に居座っていた**ものである ——
 *   見ても、見て何かを変えられるわけではない。
 *
 *   **調べたら、ゲストには進み具合を見る場所が1つも無かった。**
 *   トレーナーには「ゲスト」画面、管理者には「集計」があるが、
 *   **ゲスト自身が自分の積み上がりを眺めるページは無かった。**
 *
 * 【行き止まりを作らない】
 *
 *   ここは、2つのタブの**戻る場所**でもある(`×` と「おわる」の行き先)。
 *   だから**必ず、練習へ戻るボタンを置く。** 見て終わりにしない。
 *
 * 【いまは「帳面ごと」。冊ごとの内訳は、まだ無い】
 *
 *   冊によって**数の出どころが違う**(`word_reviews` / 棚 / 基礎単語 /
 *   ファイルの冊)。冊ごとに出すには**読み込みを冊の数だけ増やす**ことになる。
 *   **黙って縮めたのではない** —— 次の段として `docs/PROJECT_SPEC.md` に
 *   書いてある。いまは**帳面ごとの合計**を出す。
 *
 * 【新しい仕組みを作らない】
 *
 *   数え方も見た目も、**もう在るもの**を使う ——
 *   `loadWordbookCounts()` / `qrTally()` / `ReviewStats` / `GoalBar` /
 *   `weekLine()`。**書き写さない**(CLAUDE.md)。
 * ============================================================================
 *
 * @param learnerId 誰の進み具合か(省くとログインしている本人)
 * @param onGo      練習へ戻る(`'wordbook'` / `'qr'`)
 */
import { useEffect, useMemo, useState } from 'react'
import Loading from './Loading.jsx'
import ReviewStats from './ReviewStats.jsx'
import GoalBar from './GoalBar.jsx'
import { CardsIcon, BoltIcon } from './Icons.jsx'
import { loadWordbookCounts } from '../lib/vocab.js'
import { loadQrReviews, qrReviewSupported } from '../lib/qrReviews.js'
import { QR_GROUPS, WORD_GROUPS, qrTally } from '../lib/reviewScope.js'
import { NO_GOAL, NO_WEEK, loadQrWeek, loadWeeklyGoal } from '../lib/goals.js'
import { weekLine } from '../lib/gamify.js'
import { isSupabaseConfigured } from '../lib/supabase.js'

export default function Progress({ learnerId = null, onGo = null }) {
  const [busy, setBusy] = useState(true)
  const [words, setWords] = useState(null)
  const [qr, setQr] = useState(null)
  const [week, setWeek] = useState(NO_WEEK)
  const [goal, setGoal] = useState(NO_GOAL)

  useEffect(() => {
    let alive = true
    const run = async () => {
      setBusy(true)
      const [w, q, wk, aim] = await Promise.all([
        loadWordbookCounts(learnerId),
        /* **段ごと読む**(`status: null`)。
           復習の画面は `'todo'`(まだ + 練習中)しか読んでいないので、
           そのまま真似ると**「できた」がいつでも 0** になる ——
           **0 と「読んでいない」を取り違えない**(CLAUDE.md)。
           ここは眺めるページなので、1回だけ多く読んでよい */
        loadQrReviews(learnerId, { status: null, limit: 1000 }),
        loadQrWeek(learnerId),
        loadWeeklyGoal(learnerId),
      ])
      if (!alive) return
      /* **0 と `null` を取り違えない**(CLAUDE.md)。
         読めなかったら `null` のまま —— **その帳面ごと出さない。**
         `0` と出すと「空っぽ」に見えるが、**読めていないだけ**である */
      setWords(w.error ? null : (w.data ?? null))
      /* **0件と「入れ物がまだ無い」を取り違えない**(CLAUDE.md)。
         0040 を貼っていない Supabase では `loadQrReviews()` は
         **黙って空の一覧を返す**(画面を落とさないため)。
         そのまま数えると「まだ 0 / 練習中 0 / できた 0」と出て、
         **やり切ったように見える。** 読めていないだけである */
      setQr(q.error || !qrReviewSupported() ? null : qrTally(q.data ?? []))
      if (wk.data) setWeek(wk.data)
      if (aim.data) setGoal(aim.data)
      setBusy(false)
    }
    run()
    return () => { alive = false }
  }, [learnerId])

  /** 単語帳の3枚。**数え方は `WORD_GROUPS` の id そのもの**(書き写さない) */
  const wordItems = useMemo(
    () => WORD_GROUPS.map((g) => ({ ...g, n: words?.[g.id] ?? 0 })),
    [words],
  )
  const qrItems = useMemo(
    () => QR_GROUPS.map((g) => ({ ...g, n: qr?.[g.id] ?? 0 })),
    [qr],
  )

  if (!isSupabaseConfigured) {
    return (
      <section className="card">
        <h2 className="card-title">達成具合</h2>
        <p className="hint">
          Supabase が設定されていないため、進み具合は溜まりません。
          練習そのものは、そのまま使えます。
        </p>
        <Practice onGo={onGo} />
      </section>
    )
  }

  return (
    <section className="card">
      <h2 className="card-title">達成具合</h2>

      {busy ? <Loading /> : (
        <>
          {/* **続けた記録と、週の目標。** どちらも、もう在る部品
              (`weekLine()` / `GoalBar`)。**書き写さない**。

              **`tip` を付けない**(2026-09)。あれは
              「一度読めば足りる説明」を畳む印で(第5.166節)、
              **ここは数そのもの**である。じっくり見るためのページなのに、
              いちばん見たい「◯週つづけて」が既定で畳まれていた。
              **1日も記録が無ければ、行ごと出ない**(`weekLine()` が空を返す) */}
          {weekLine(week) && <p className="card-hint prog-week">{weekLine(week)}</p>}
          <GoalBar goal={goal.wordsGoal} done={goal.wordsDone} unit="語" />
          <GoalBar goal={goal.sentGoal} done={goal.sentDone} unit="文" />

          {/* **帳面ごとに1つ。** 押せる札にしない —— ここは眺める場所で、
              その段だけを復習するのは練習の画面の仕事である
              (**同じことをするものを2つ見せない**・CLAUDE.md) */}
          <h3 className="prog-head"><CardsIcon />単語帳</h3>
          {words ? (
            <ReviewStats items={wordItems} />
          ) : (
            <p className="hint">単語帳の数を読めませんでした。</p>
          )}

          <h3 className="prog-head"><BoltIcon />Quick Response</h3>
          {qr ? (
            <ReviewStats items={qrItems} />
          ) : (
            /* **読めなかった理由まで言う。** 0040 を貼っていなければ、
               そもそも入れ物が無い(**黙って 0 と出さない**) */
            <p className="hint">
              {qrReviewSupported()
                ? 'Quick Response の数を読めませんでした。'
                : 'この Supabase にはまだ復習の入れ物(0040 の SQL)が入っていません。'
                  + ' 貼るまでは、ここに数が溜まりません。'}
            </p>
          )}
        </>
      )}

      <Practice onGo={onGo} />
    </section>
  )
}

/**
 * **練習へ戻る道。** ここは `×` と「おわる」の行き先でもあるので、
 * **必ず出す**(行き止まりを作らない・CLAUDE.md)。
 * 読み込みが終わっていなくても押せる —— 練習は数と関係がない。
 */
function Practice({ onGo }) {
  if (!onGo) return null
  return (
    <div className="btn-row prog-go">
      <button type="button" className="btn btn--primary" onClick={() => onGo('wordbook')}>
        <CardsIcon />単語帳をやる
      </button>
      <button type="button" className="btn btn--primary" onClick={() => onGo('qr')}>
        <BoltIcon />Quick Response をやる
      </button>
    </div>
  )
}
