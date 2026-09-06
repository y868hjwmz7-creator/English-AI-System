/**
 * **書いた答えと、その添削**(2026-09 利用者の指定)。
 *
 *   > 次に、ディスカッションや質問に対する回答をライティングで記入できる
 *   > ようにしてください。その記入した内容を添削する機能を実装できますか?
 *   > そして添削とフィードバックがもらえる仕組みです。フィードバック内の
 *   > 単語やフレーズは単語帳に登録できる。文章ごと、または回答全ても
 *   > そのままクイックレスポンスに登録し、自動的に文章ごとに分けてくれる。
 *   > また、添削の仕方の指定もスーパーカジュアル、カジュアル、
 *   > ビジネスカジュアル、ビジネスで選べると良いですね
 *
 * ============================================================================
 * 【出す場所は2つ】
 *
 *   ディスカッションと想定される質問が**画面に見えている**のは、
 *   レッスン表示(`LessonView`)と、ゲストの「今週の宿題」
 *   (`LearnerHomework`)の2つである。
 *   **`MaterialBody` には置かない** —— あちらは `is-closed` で、
 *   **紙に出すためだけに描いている**(画面には出ない)。
 *
 *   **同じ見た目を2か所に書き写さない**(CLAUDE.md)ので、部品は1つにする。
 *
 * 【書いたものは、どこに残るのか】
 *
 *   `material_progress`(0025)。ディクテーションの書きかけ・
 *   スラッシュの区切りとまったく同じ道(`useProgress`)なので、
 *   **SQL は1行も要らない。**
 *
 *   `learnerId` を渡した画面で書けば**そのゲストの記録**になる。
 *   ゲストが家で書いたものが、レッスンでトレーナーの画面にも出る。
 *   トレーナーの「教材」から書いたものは、これまでどおり
 *   **トレーナー自身のもの**(0025 の決まりそのまま)。
 *
 * 【紙には出さない】
 *   記事・会話の紙は「書き込むための用紙」である(仕様書 5.70)。
 *   空の入力欄を刷っても仕方がないので `no-print`。
 */
import { useEffect, useRef, useState } from 'react'
import EnglishText from './EnglishText.jsx'
import SpeakButton from './SpeakButton.jsx'
import { PenIcon, PlusIcon } from './Icons.jsx'
import { WRITING_TONES } from '../data/writingTones.js'
import { progressKey, useProgress } from '../lib/progress.js'
import { reviewWriting } from '../lib/materials.js'
import { markQr, qrReviewSupported } from '../lib/qrReviews.js'
import { lookupWord, normWord, setWordStatus } from '../lib/vocab.js'
import {
  MAX_WRITING_CHARS, REVIEW_COST_YEN, isBlankAnswer, loadWritingTone,
  normalizeReview, phraseKind, reviewPairs, saveWritingTone,
  seenSentenceFor, toneBrief, tooLongAnswer,
} from '../lib/writingReview.js'

export default function WritingAnswer({
  materialId, sectionId, itemKey,
  question = '', questionJa = '', context = '', level = 'B1',
  learnerId = null,
  statuses = null, onMark = null,
  /** 読み上げに使う声。**渡さなければ Listen を出さない**(効かない操作を見せない) */
  clipVoice = undefined, tier = undefined, rate = null,
}) {
  /* **1問で1つの控え。** 鍵に問の番号まで入れてあるので、
     別の問を書いても混ざらない(`material_progress` の scope になる) */
  const key = progressKey(materialId, `${sectionId ?? 'x'}.${itemKey}`, 'writing')
  const [saved, setSaved] = useProgress(key, {}, learnerId)

  const text = String(saved?.text ?? '')
  const review = saved?.review ?? null
  /* **調子は覚える**(一度決める設定は覚える・CLAUDE.md)。
     その問で一度選んでいれば、そちらが勝つ */
  const [tone, setTone] = useState(() => saved?.tone || loadWritingTone())
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [secs, setSecs] = useState(0)
  const [error, setError] = useState(null)
  const [note, setNote] = useState(null)
  const [added, setAdded] = useState(() => new Set())
  const areaRef = useRef(null)

  /* **開いた時点で書いたものがあれば、開いたまま始める。**
     書いたことを見せずに畳んでおくと、書いたこと自体を忘れる */
  const started = Boolean(text.trim() || review)
  const showBody = open || started

  /* **経過秒数を出す。** 何%かも分からないまま待たせない(CLAUDE.md) */
  useEffect(() => {
    if (!busy) { setSecs(0); return undefined }
    const t = window.setInterval(() => setSecs((n) => n + 1), 1000)
    return () => window.clearInterval(t)
  }, [busy])

  const long = tooLongAnswer(text)

  const ask = async () => {
    setError(null)
    setNote(null)
    if (isBlankAnswer(text)) { setError('先に英語で答えを書いてください。'); return }
    if (long) {
      setError(`長すぎます(${text.trim().length} 文字)。`
        + `${MAX_WRITING_CHARS} 文字までにしてください。`)
      return
    }
    setBusy(true)
    const { data, error: e } = await reviewWriting({
      answer: text.trim(),
      toneBrief: toneBrief(tone),
      question, questionJa, context, level,
    })
    setBusy(false)
    if (e) { setError(e); return }
    const got = normalizeReview({ ...(data.review ?? {}), tone })
    if (!got) { setError('添削の結果を読み取れませんでした。もう一度お試しください。'); return }
    setAdded(new Set())
    setSaved({ text, tone, review: got })
  }

  /** Quick Response に入れる。**「まだ」から始める**(復習に出る) */
  const toQr = async (pairs, label) => {
    setError(null)
    setNote(null)
    if (!pairs.length) { setError('入れられる文がありませんでした。'); return }
    setBusy(true)
    let ok = 0
    for (const p of pairs) {
      const { error: e } = await markQr(p, 'unknown', { materialId, learnerId })
      if (!e) ok += 1
    }
    setBusy(false)
    /* **0040 を貼る前は、静かに何も起きない**(`markQr` の決まり)。
       それを「入れました」と言うと嘘になる */
    if (!qrReviewSupported()) {
      setError('Quick Response の復習は、まだ使えません(0040 を貼ってください)。')
      return
    }
    setNote(`${label}を Quick Response の復習に入れました(${ok} 文)。`)
  }

  /** 単語帳に入れる。**意味も1回だけ引いて控える**(`WordbookAdd` と同じ) */
  const toWordbook = async (p) => {
    setError(null)
    setNote(null)
    const norm = normWord(p.en)
    if (!norm) { setError('英語の語句ではないので、単語帳に入れられません。'); return }
    setBusy(true)
    const sentence = seenSentenceFor(review, p.en)
    const { error: lookupError } = await lookupWord({
      word: p.en, sentence: sentence || p.en, level,
    })
    const { error: e } = await setWordStatus(p.en, 'unknown', {
      kind: phraseKind(p.en), sentence: sentence || null, learnerId,
    })
    setBusy(false)
    if (e) { setError(e); return }
    setAdded((prev) => new Set(prev).add(p.en))
    setNote(`「${norm}」を単語帳に入れました。`
      + (lookupError ? ' 意味の控えは取れませんでした。' : ''))
  }

  const pairs = reviewPairs(review)

  return (
    <div className="writing no-print">
      {!showBody && (
        <button type="button" className="btn btn--ghost btn--small"
                onClick={() => { setOpen(true); window.setTimeout(() => areaRef.current?.focus(), 0) }}>
          <PenIcon />英語で答えを書く
        </button>
      )}

      {showBody && (
        <>
          <label className="field writing-field">
            <span>
              英語で答えを書く
              <span className="field-hint">
                {MAX_WRITING_CHARS} 文字まで。書いたものは残ります
              </span>
            </span>
            <textarea ref={areaRef} lang="en" rows={4} value={text}
                      placeholder="I think remote work helps people focus, but ..."
                      onChange={(e) => setSaved({ ...saved, text: e.target.value, tone })} />
          </label>

          <div className="writing-tools">
            <label className="writing-tone">
              <span>添削の調子</span>
              <select value={tone}
                      onChange={(e) => {
                        setTone(e.target.value)
                        saveWritingTone(e.target.value)
                        setSaved({ ...saved, tone: e.target.value })
                      }}>
                {WRITING_TONES.map((t) => (
                  <option key={t.id} value={t.id}>{t.label} — {t.hint}</option>
                ))}
              </select>
            </label>
            {/* **費用を出す**(見えない費用は管理できない・CLAUDE.md) */}
            <button type="button" className="btn btn--primary btn--small"
                    disabled={busy || !text.trim() || long} onClick={ask}>
              {busy ? `添削してもらっています…（${secs} 秒）`
                : review ? `もう一度 添削してもらう（およそ ${REVIEW_COST_YEN} 円）`
                  : `添削してもらう（およそ ${REVIEW_COST_YEN} 円）`}
            </button>
          </div>

          {long && (
            <p className="notice notice--error writing-note">
              長すぎます（{text.trim().length} 文字）。{MAX_WRITING_CHARS} 文字までにしてください。
            </p>
          )}
          {/* **押した場所のすぐ下に出す**(CLAUDE.md) */}
          {error && <p className="notice notice--error writing-note">{error}</p>}
          {note && <p className="notice notice--ok writing-note">{note}</p>}

          {review && (
            <div className="writing-review">
              {/* **できていたところを先に出す。** 直すところしか言われないと、
                  次に書く気が起きない */}
              {review.good && (
                <p className="writing-good">{review.good}</p>
              )}

              <h5 className="writing-head">直した英文</h5>
              <ol className="writing-sentences">
                {review.sentences.map((s, i) => (
                  <li key={`${i}-${s.en}`}>
                    <div className="writing-en">
                      <EnglishText text={s.en} level={level}
                                   statuses={statuses} onMark={onMark} />
                    </div>
                    {s.ja && <div className="writing-ja">{s.ja}</div>}
                    <div className="writing-row">
                      {clipVoice !== undefined && (
                        <SpeakButton text={s.en} clipVoice={clipVoice} tier={tier}
                                     {...(rate == null ? {} : { rate })} />
                      )}
                      {s.ja && (
                        <button type="button" className="btn btn--ghost btn--small"
                                disabled={busy}
                                onClick={() => toQr([{ en: s.en, ja: s.ja }], 'この文')}>
                          <PlusIcon />この文を Quick Response へ
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ol>

              {pairs.length > 1 && (
                <div className="btn-row">
                  <button type="button" className="btn btn--small" disabled={busy}
                          onClick={() => toQr(pairs, '答えぜんぶ')}>
                    <PlusIcon />答えぜんぶを Quick Response へ（{pairs.length} 文）
                  </button>
                </div>
              )}

              {review.notes.length > 0 && (
                <>
                  <h5 className="writing-head">直したところ</h5>
                  <ul className="writing-notes">
                    {review.notes.map((n, i) => (
                      <li key={`${i}-${n.why}`}>
                        {(n.before || n.after) && (
                          <div className="writing-diff">
                            <span className="writing-before" lang="en">{n.before}</span>
                            <span aria-hidden="true"> → </span>
                            <span className="writing-after" lang="en">{n.after}</span>
                          </div>
                        )}
                        <div className="writing-why">{n.why}</div>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {review.phrases.length > 0 && (
                <>
                  <h5 className="writing-head">覚えたい語句</h5>
                  <ul className="writing-phrases">
                    {review.phrases.map((p) => (
                      <li key={p.en}>
                        <span className="writing-phrase-en" lang="en">{p.en}</span>
                        <span className="writing-phrase-ja">{p.ja}</span>
                        <button type="button" className="btn btn--ghost btn--small"
                                disabled={busy || added.has(p.en)}
                                onClick={() => toWordbook(p)}>
                          {added.has(p.en) ? '入れました' : <><PlusIcon />単語帳へ</>}
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
