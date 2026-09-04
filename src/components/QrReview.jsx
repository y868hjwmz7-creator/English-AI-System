/**
 * Quick Response(復習)— 「まだ」を押した文が、ここに溜まる(0040)。
 *
 * 【何のためか】(2026-09 利用者の指定)
 *
 *   > 教材の中で取り組んだ Quick Response の中で「まだ」を押したものは、
 *   > Quick Response という復習用の機能を独立して作り、
 *   > ひとつのアカウントにつきひとつ持たせてください。
 *   > UI は通常の Quick Response の画面と同じです。
 *   > 単語と同じく、「テキスト」「日付」「業界」「シチュエーション」などから
 *   > 絞り込んで練習できるようにしてください。
 *   > 「まだ」「おぼえかけ」の仕組みは同じです。
 *
 *   教材の中の Quick Response は**その教材の通し**である。だから
 *   言えなかった文は、その教材を開き直さないと二度と出てこない。
 *   ここは**教材をまたいだ、その人ひとりぶんの復習**である。
 *   単語帳が**語**に対してしていることを、こちらは**文**に対してする。
 *
 * 【1問ぶんの見た目は `QrCard` 1つ】
 *   教材の中の Quick Response と**同じ部品**を使う。
 *   **同じ見た目を2か所に書き写さない**(CLAUDE.md)。
 *   ちがうのはボタンの言葉づかいだけ(「まだ」/「言える」)。
 *
 * 【誰の復習か】(単語帳と同じ)
 *   `learnerId` を渡さなければ、ログインしている本人のもの。
 *   トレーナーがゲストのページから開いたときは、そのゲストのもの。
 *   **見てよいかどうかは SQL(`qr_items`)が決める。** 画面で判定しない。
 */
import { useEffect, useMemo, useState } from 'react'
import {
  QR_ORDERS, loadQrReviews, markQr, orderQrPairs, qrPairOf, qrReviewSupported,
} from '../lib/qrReviews.js'
import WordbookFilter, { applyWordbookFilter } from './WordbookFilter.jsx'
import QrCard from './QrCard.jsx'
import { stopReading } from '../lib/readAloud.js'
import { usePracticeLog } from '../lib/practice.js'
import { answerFeedback } from '../lib/haptics.js'
import { isSupabaseConfigured } from '../lib/supabase.js'

/** 並べ方は覚えておく。**一度決めれば、毎回選ぶものではない**
    (紙の幅・文字の大きさと同じ作法。`slashLevel.js` と同じ書き方) */
const ORDER_KEY = 'eas.qrOrder'
const loadOrder = () => {
  try {
    const saved = localStorage.getItem(ORDER_KEY)
    return QR_ORDERS.some((o) => o.id === saved) ? saved : 'shuffle'
  } catch { return 'shuffle' }
}
const saveOrder = (id) => {
  try { localStorage.setItem(ORDER_KEY, id) } catch { /* 使えなくても困らない */ }
}

export default function QrReview({ learnerId = null, learnerName = '' }) {
  const [rows, setRows] = useState([])
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState({ day: null, material: null, field: null, topic: null })
  const [order, setOrder] = useState(loadOrder)
  /** **今日出すぶんだけ**が既定。箱(間隔)を置いている意味がそこにある */
  const [dueOnly, setDueOnly] = useState(true)
  /** いま解いている一覧。`null` なら、まだ始めていない */
  const [run, setRun] = useState(null)
  const [at, setAt] = useState(0)
  const [done, setDone] = useState([])

  // 取り組みを**裏で数える**(0022)。ゲストのぶんだけ数える
  usePracticeLog('quick_response', Boolean(run), learnerId)

  const reload = async () => {
    setBusy(true)
    const { data, error: e } = await loadQrReviews(learnerId, { status: 'todo', limit: 500 })
    if (e) setError(e); else setError(null)
    setRows(data ?? [])
    setBusy(false)
  }

  useEffect(() => { reload() }, [learnerId])

  // 画面を離れるときは、鳴っているものを止める
  useEffect(() => () => stopReading(), [])

  const today = new Date().toISOString().slice(0, 10)
  /* 絞り込みは**手元で行う**(単語帳と同じ)。`qr_items()` は 500 件まで
     返しているので、選ぶたびに Supabase へ聞き直さない。待ち時間も費用も増えない */
  const shown = useMemo(() => {
    const list = applyWordbookFilter(rows, filter)
    return dueOnly
      ? list.filter((r) => String(r.due_on ?? '').slice(0, 10) <= today)
      : list
  }, [rows, filter, dueOnly, today])

  const dueCount = rows.filter((r) => String(r.due_on ?? '').slice(0, 10) <= today).length

  const start = () => {
    setRun(orderQrPairs(shown.map(qrPairOf), order))
    setAt(0)
    setDone([])
  }

  const stop = () => {
    stopReading()
    setRun(null)
    // **答えた結果を映し直す。** 箱が動いているので、残り数が変わる
    reload()
  }

  const answer = async (ok) => {
    const card = run[at]
    /* **押した手応えを返す。** 言えたらピンポン、まだなら低く1つだけ */
    answerFeedback(ok)
    /* 「まだ」は箱を 0 に戻して翌日、「言える」は箱を1つ上げる。
       **何日後に出すかは SQL(`mark_qr`)が決める。** 画面には持たない */
    await markQr(card, ok ? 'learning' : 'unknown', { learnerId })
    setDone((d) => [...d, { ...card, ok }])
    setAt((i) => i + 1)
  }

  /** **もう出さない**(間違えて溜めた文・すっかり言えるようになった文) */
  const retire = async () => {
    const card = run[at]
    await markQr(card, 'known', { learnerId })
    setDone((d) => [...d, { ...card, ok: true }])
    setAt((i) => i + 1)
  }

  const who = learnerName ? `${learnerName} さんの` : ''

  if (!isSupabaseConfigured) {
    return (
      <section className="card">
        <h2 className="card-title">Quick Response(復習)</h2>
        <p className="hint">
          Supabase が設定されていないため、復習は溜まりません。
        </p>
      </section>
    )
  }

  // ── 解いているあいだ ───────────────────────────────────────
  if (run && run.length) {
    const finished = at >= run.length
    const okCount = done.filter((x) => x.ok).length
    return (
      <section className="qr">
        <div className="qr-head">
          <strong className="qr-title">Quick Response(復習)</strong>
          <span className="qr-count">
            {finished ? `${run.length} / ${run.length}` : `${at + 1} / ${run.length}`}
          </span>
          <button type="button" className="btn btn--ghost btn--small" onClick={stop}>
            とじる
          </button>
        </div>

        {/* どこまで来たか。**終わりが見えないと続かない**(単語帳と同じ) */}
        <div className="qr-bar" aria-hidden="true">
          <span style={{ width: `${Math.round((Math.min(at, run.length) / run.length) * 100)}%` }} />
        </div>

        {finished ? (
          <div className="qr-result">
            <p className="qr-result-score">
              <strong>{okCount} / {run.length} 言えました。</strong>
            </p>
            <ul className="qr-result-list">
              {done.filter((x) => !x.ok).map((x, i) => (
                <li key={i}>
                  <span className="qr-result-ja">{x.ja}</span>
                  <span lang="en">{x.en}</span>
                </li>
              ))}
            </ul>
            {okCount === run.length
              ? <p className="hint">全部言えました。</p>
              : <p className="hint">上に出ているのが、言えなかった文です。また明日出ます。</p>}
            <div className="btn-row">
              <button type="button" className="btn btn--primary" onClick={stop}>
                おわる
              </button>
            </div>
          </div>
        ) : (
          /* **1問ぶんは、教材の中の Quick Response とまったく同じ部品**(`QrCard`)。
             ちがうのはボタンの言葉だけ(2026-09 利用者の指定)。
             教材の中は「その場で言えたか」、こちらは「これから言えるか」を訊く */
          <QrCard
            pair={run[at]} no={at + 1}
            onAnswer={answer}
            yetLabel="まだ" okLabel="言える"
            extra={(
              /* **消す道を必ず用意する。** 溜まる一方だと、押し間違えた1問が
                 ずっと出続ける。答えではない操作なので、枠線だけのボタンにする */
              <button type="button" className="btn btn--ghost btn--small" onClick={retire}>
                もう出さない
              </button>
            )}
          />
        )}
      </section>
    )
  }

  // ── 始める前 ───────────────────────────────────────────────
  return (
    <section className="card">
      <h2 className="card-title">{who}Quick Response(復習)</h2>
      <p className="hint">
        教材の Quick Response で<strong>「まだ」を押した文</strong>が、ここに溜まります。
        単語帳と同じで、<strong>言えるようになるほど出てくる間隔があきます。</strong>
      </p>

      {!qrReviewSupported() && (
        <p className="notice notice--warn">
          この Supabase にはまだ復習の入れ物(0040 の SQL)が入っていません。
          貼るまでは、教材の Quick Response はこれまでどおり使えますが、
          「まだ」を押した文は溜まりません。
        </p>
      )}
      {error && <div className="notice notice--warn" role="alert">{error}</div>}

      {busy ? (
        <p className="muted">読み込み中…</p>
      ) : rows.length === 0 ? (
        <p className="hint">
          まだ1問も溜まっていません。教材の Quick Response で「まだ」を押すと、
          その文がここに入ります。
        </p>
      ) : (
        <>
          {/* 数の札は**単語帳と同じ見た目**(`.wb-stats`)。
              「今日出す」だけを目立たせる。そこが行動につながる数である */}
          <div className="wb-stats">
            <span className={`wb-stat${dueCount > 0 ? ' is-due' : ''}`}>
              <strong>{dueCount}</strong>
              <span className="wb-stat-label">今日出す</span>
            </span>
            <span className="wb-stat">
              <strong>{rows.length}</strong>
              <span className="wb-stat-label">溜まっている</span>
            </span>
          </div>

          {/* **絞り込みは単語帳と同じ部品**(`WordbookFilter`)。
              ちがうのは、**教材名のプルダウンを出す**という1点だけ
              (2026-09 利用者の指定「『テキスト』= 教材の名前で絞る」)。
              単語帳のほうは、利用者の指定で出さないままにしてある */}
          <WordbookFilter rows={rows} value={filter} onChange={setFilter} showMaterial />

          <div className="qrrev-opts">
            <label className="wbfilter-pick">
              <span className="sr-only">並べ方</span>
              <select value={order}
                      onChange={(e) => { setOrder(e.target.value); saveOrder(e.target.value) }}>
                {QR_ORDERS.map((o) => (
                  <option key={o.id} value={o.id}>並べ方: {o.label}</option>
                ))}
              </select>
            </label>
            <label className="wbfilter-pick">
              <span className="sr-only">どれを出すか</span>
              <select value={dueOnly ? 'due' : 'all'}
                      onChange={(e) => setDueOnly(e.target.value === 'due')}>
                <option value="due">今日出すぶん</option>
                <option value="all">溜まっているぶん全部</option>
              </select>
            </label>
          </div>

          <div className="btn-row">
            <button type="button" className="btn btn--primary"
                    disabled={shown.length === 0} onClick={start}>
              {shown.length ? `はじめる(${shown.length} 問)` : '出すものがありません'}
            </button>
          </div>
          {shown.length === 0 && (
            <p className="hint">
              {dueOnly
                ? '今日出すものはありません。よくできました。'
                : 'この絞り込みに当てはまる文がありません。'}
            </p>
          )}
        </>
      )}
    </section>
  )
}
