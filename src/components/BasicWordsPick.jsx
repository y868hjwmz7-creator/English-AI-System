import { useState } from 'react'
import { COURSE_TIERS, tierOf } from '../data/basicsCourse.js'
import { wordListFor, wordsForTier } from '../lib/basicsCourse.js'
import { addBasicWords, basicWordsSupported } from '../lib/vocab.js'
import { StepsIcon } from './Icons.jsx'

/**
 * 基礎単語(基本360語 / 標準1200語)を、**それだけで選べる単語帳にする**。
 *
 * ============================================================================
 * 【なぜ要るか】(2026-09 利用者の指定)
 *
 *   > そして、講座の中の単語はそれぞれ基本360語、標準1200語、として
 *   > そもそもが独立して選べる単語帳にしてください
 *
 *   0052 で入れた基礎単語は、**30日講座の中にしか無かった。**
 *   「1日目を開いて、12語ずつ入れる」でしか単語帳へ入らないので、
 *   **講座をやらない人には、この語に触れる道が1つも無かった。**
 *   しかも 1,200 語を入れるには 30 日ぶん開いて 30 回押すことになる。
 *
 * 【新しい練習を作らない】(CLAUDE.md)
 *
 *   入る先はこれまでと同じ `word_reviews` で、間隔をあけた復習
 *   (0015〜0039)も、箱に応じた出題の形も、**そのまま効く。**
 *   「その段だけを練習する」も、**教材の語だけに絞る道**(0047 の `only`)を
 *   そのまま使う。**この画面のためだけの仕組みは1つも作っていない。**
 *
 * 【押すのは1つだけ】
 *
 *   「入れる」と「絞る」を2つのボタンに分けると、**入れる前に絞った人が
 *   0語の単語帳を見る**ことになる(行き止まり)。
 *   だから1つにまとめ、**何が起きるかは押す前に1行で書く。**
 *   すでに入っている語には触らないので、**何度押しても安全**である。
 *
 * 【0円である】
 *
 *   訳は `src/data/basicWords.js` に書いてあり、単語帳が
 *   `basicJaOf()` で出す。**窓口(AI)を1回も呼ばない。**
 *   1,200 語を `lookupWord` で引くと 120 円ほどかかるうえ、
 *   入れ終わるまで何分も待たせることになる。
 *
 * 【0053 を貼る前でも壊れない】
 *
 *   一度断られたら `basicWordsSupported()` が偽になり、
 *   **そのあとは呼びに行かない。** 断り方も、何をすればよいかまで書く。
 */
export default function BasicWordsPick({
  learnerId = null, learnerName = '', onPicked = null,
}) {
  /* **誰の単語帳に入るのかを、はっきり言う**(`WordbookAdd` と同じ作法)。
     トレーナーがゲストのページから押すときは、入る先はゲストである */
  const name = String(learnerName ?? '').trim()
  const honored = /(さん|様|先生)$/.test(name) ? name : `${name} さん`
  const whose = learnerId ? `${name ? honored : 'このゲスト'}の単語帳` : '単語帳'

  const [open, setOpen] = useState(false)
  /** どちらの段か。**初めは基本360語**(やさしいほうから) */
  const [tier, setTier] = useState(COURSE_TIERS[0].id)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState(null)

  const info = tierOf(tier)
  const rows = wordsForTier(tier)

  /**
   * その段を、単語帳に入れてから絞る。
   *
   * **絞るのは呼ぶ側**(`Wordbook` → `App`)。ここで `rows` を触らない ——
   * 絞り込みは 0047 で作った道が1つあるだけで、**2つ持たない。**
   */
  const run = async () => {
    setBusy(true)
    setNote(null)
    const { data, error } = await addBasicWords(wordListFor(tier), learnerId)
    setBusy(false)
    if (error) { setNote({ ng: true, text: error }); return }
    /* **何語「新しく」入ったのかを言う。** 0 を「失敗」と読ませない ——
       2度目に押したときは、すでに全部入っているのが正しい */
    setNote({
      text: data > 0
        ? `${data} 語を新しく入れました(残りの ${rows.length - data} 語は、すでに入っていました)。`
        : `${rows.length} 語とも、すでに入っていました。`,
    })
    onPicked?.(wordListFor(tier), info.label)
  }

  return (
    <div className="wb-add basicpick">
      <button type="button" className="btn btn--ghost btn--small wb-add-open"
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}>
        <StepsIcon />
        {open ? '基礎単語を閉じる' : '基礎単語(基本360語 / 標準1200語)'}
      </button>

      {open && (
        <div className="wb-add-body">
          {/* ── どちらの段か ────────────────────────────────
              **基本360語 は 標準1200語 の一部。** 別の一覧を持たない */}
          <div className="chiprow" role="group" aria-label="基礎単語の段">
            {COURSE_TIERS.map((t) => (
              <button key={t.id} type="button"
                      className={`chip${t.id === tier ? ' chip--on' : ''}`}
                      aria-pressed={t.id === tier}
                      onClick={() => { setTier(t.id); setNote(null) }}>
                {t.label}
                <span className="chip-count">{wordsForTier(t.id).length} 語</span>
              </button>
            ))}
          </div>
          <p className="basicpick-hint">{info.hint}</p>

          {/* **何が起きるかを、押す前に1行で書く**(CLAUDE.md)。
              **お金はかからない**ことも、はっきり言う */}
          <p className="basicpick-lead">
            {whose}に {rows.length} 語を「まだ」として入れ、
            <strong>この {rows.length} 語だけ</strong>を練習します。
            すでに入っている語の覚え具合は<strong>1つも戻りません</strong>。
            <span className="basicpick-free">お金はかかりません。</span>
          </p>

          <div className="btn-row">
            <button type="button" className="btn btn--primary"
                    disabled={busy || !basicWordsSupported()}
                    onClick={run}>
              {busy ? '入れています…' : `${info.label}を練習する`}
            </button>
          </div>

          {note && (
            <p className={note.ng ? 'notice notice--warn' : 'muted'}>{note.text}</p>
          )}
        </div>
      )}
    </div>
  )
}
