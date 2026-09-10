import { useEffect, useState } from 'react'
import { loadSpeeches, speechesSupported } from '../lib/speeches.js'
import {
  isReviewed, sortSpeeches, speechPhrases, speechTitleOf, speechWordList,
} from '../lib/speechPractice.js'
import { lookupWord, normWord, setWordStatus } from '../lib/vocab.js'
import { phraseKind, seenSentenceFor } from '../lib/writingReview.js'
import { MicIcon } from './Icons.jsx'

/**
 * **スピーチの語句を、単語帳に入れて練習する**(0054・2026-09 利用者の指定)。
 *
 * ============================================================================
 * 【なぜ要るか】
 *
 *   > そして、単語帳にはスピーチの単語帳も作ります。
 *
 *   添削の結果には「覚えておくとよい語句」が 3〜8 入っている
 *   (窓口の `phrases`)。ところがそれを単語帳へ入れる道は
 *   **スピーチの画面で1語ずつ押す**しかなかった。
 *   **単語帳の側からは、スピーチの語に触れる道が1つも無い。**
 *
 * 【新しい練習を作らない】(CLAUDE.md)
 *
 *   入る先はこれまでと同じ `word_reviews` で、間隔をあけた復習
 *   (0015〜0039)も、箱に応じた出題の形も、**そのまま効く。**
 *   「その語だけを練習する」も、**教材の語だけに絞る道**(0047 の `only`)を
 *   そのまま使う。**この画面のためだけの仕組みは1つも作っていない。**
 *
 * 【`BasicWordsPick` と、まったく同じ形にしてある】
 *
 *   畳んで置く・段(ここではスピーチ)を選ぶ・**押すのは1つだけ**・
 *   何が起きるかを押す前に1行で書く・すでに入っている語には触らない。
 *   **並べて置くものは、同じ形にする。**
 *
 * 【ここだけ違う ―― お金がかかる】
 *
 *   基礎単語の訳は `basicWords.js` に書いてあるので**0円**だったが、
 *   スピーチの語句は**その人だけの語**なので、意味は引くしかない。
 *   `lookupWord`(`WordbookAdd` / `WritingAnswer` と同じ道)を1語につき1回。
 *   **1語あたり約 0.1 円。押す前に、語数と金額を必ず出す**
 *   (**見えない費用は管理できない**・CLAUDE.md)。
 *
 * 【0054 を貼る前でも壊れない】
 *   `speechesSupported()` が偽になり、**欄ごと出さない。**
 *   単語帳はこれまでどおり動く。
 */
export default function SpeechWordsPick({
  learnerId = null, learnerName = '', onPicked = null,
}) {
  /* **誰の単語帳に入るのかを、はっきり言う**(`BasicWordsPick` と同じ作法) */
  const name = String(learnerName ?? '').trim()
  const honored = /(さん|様|先生)$/.test(name) ? name : `${name} さん`
  const whose = learnerId ? `${name ? honored : 'このゲスト'}の単語帳` : '単語帳'

  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [pick, setPick] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState(null)

  /* **開いたときにだけ読む。** 押さない人には問い合わせが1回も飛ばない */
  useEffect(() => {
    if (!open) return undefined
    let alive = true
    setLoading(true)
    loadSpeeches(learnerId).then(({ data, error }) => {
      if (!alive) return
      setLoading(false)
      if (error) { setNote({ ng: true, text: error }); return }
      /* **添削の済んだものだけ。** 下書きには語句が1つも無い
         (**効かない操作を見せない**・CLAUDE.md) */
      const list = sortSpeeches(data).filter(isReviewed)
      setRows(list)
      setPick((id) => (list.some((r) => r.id === id) ? id : (list[0]?.id ?? '')))
    })
    return () => { alive = false }
  }, [open, learnerId])

  const now = rows.find((r) => r.id === pick) ?? null
  const phrases = speechPhrases(now)

  /**
   * その語句を単語帳に入れてから絞る。
   *
   * **絞るのは呼ぶ側**(`Wordbook` → `App`)。ここで一覧を触らない ——
   * 絞り込みは 0047 で作った道が1つあるだけで、**2つ持たない。**
   */
  const run = async () => {
    if (!now || !phrases.length) return
    setBusy(true)
    setNote(null)
    let ok = 0
    let missed = 0
    for (const p of phrases) {
      const norm = normWord(p.en)
      if (!norm) { missed += 1; continue }
      /* **意味も1回だけ引く**(`WordbookAdd` とまったく同じ道)。
         引かずに入れると、単語帳で「意味の控えがありません」のまま残る */
      const sentence = seenSentenceFor(now.review, p.en)
      await lookupWord({ word: p.en, sentence: sentence || p.en, level: 'B1' })
      const { error } = await setWordStatus(p.en, 'unknown', {
        kind: phraseKind(p.en), sentence: sentence || null, learnerId,
      })
      if (error) missed += 1
      else ok += 1
    }
    setBusy(false)
    /* **何語入ったのかを言う。** 「すでに入っていた語は箱が戻らない」も
       押す前に書いてあるので、ここでは数だけでよい */
    setNote({
      text: `${ok} 語句を単語帳に入れました。`
        + (missed ? `(${missed} 語句は入れられませんでした)` : ''),
    })
    onPicked?.(speechWordList(now), speechTitleOf(now), 'このスピーチの語句')
  }

  /* **0054 を貼る前は、欄ごと出さない**(効かない操作を見せない) */
  if (!speechesSupported()) return null

  return (
    <div className="wb-add speechpick">
      <button type="button" className="btn btn--ghost btn--small wb-add-open"
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}>
        <MicIcon />
        {open ? 'スピーチの語句を閉じる' : 'スピーチの語句'}
      </button>

      {open && (
        <div className="wb-add-body">
          {loading ? (
            <p className="muted">読み込んでいます…</p>
          ) : !rows.length ? (
            /* **行き止まりを作らない。** どうすれば出てくるのかまで書く */
            <p className="muted">
              添削の済んだスピーチがまだありません。
              「スピーチ練習」で原稿を出し、トレーナーに添削してもらうと、
              その語句がここに並びます。
            </p>
          ) : (
            <>
              <label className="field">
                <span>どのスピーチか</span>
                <select value={pick} disabled={busy}
                        onChange={(e) => { setPick(e.target.value); setNote(null) }}>
                  {rows.map((r) => (
                    <option key={r.id} value={r.id}>
                      {speechTitleOf(r)}（{speechWordList(r).length} 語句）
                    </option>
                  ))}
                </select>
              </label>

              {/* **何が起きるかを、押す前に1行で書く**(CLAUDE.md)。
                  **お金がかかることも、はっきり言う** */}
              <p className="basicpick-lead">
                {whose}に <strong>{phrases.length} 語句</strong>を「まだ」として入れ、
                <strong>この {phrases.length} 語句だけ</strong>を練習します。
                すでに入っている語の覚え具合は<strong>1つも戻りません</strong>。
                <span className="speechpick-cost">
                  意味を引くので、<strong>およそ {Math.max(1, Math.ceil(phrases.length * 0.1))} 円</strong>かかります。
                </span>
              </p>

              <div className="btn-row">
                <button type="button" className="btn btn--primary"
                        disabled={busy || !phrases.length} onClick={run}>
                  {busy ? '入れています…' : 'このスピーチの語句を練習する'}
                </button>
              </div>
            </>
          )}

          {note && (
            <p className={note.ng ? 'notice notice--warn' : 'muted'}>{note.text}</p>
          )}
        </div>
      )}
    </div>
  )
}
