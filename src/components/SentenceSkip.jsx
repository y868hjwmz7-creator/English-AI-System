/**
 * **1文ずつ、飛ばす / 戻す**(2026-09 利用者の指定)。
 *
 *   > 「全体を聞く」「段落ごと」りょうほうの横に◁▷をおいて、
 *   > 1文ずつ飛ばしたり戻したりできる仕様です
 *
 * ============================================================================
 * 【なぜできるようになったか】
 *
 *   本文の音声を**1本にまとめる**ことに統一したので、その1本と一緒に
 *   **文字ごとの時刻**(`alignment`)が控えてある。そこから
 *   **文の区間**を出せば(`sentenceSpansOf`)、
 *   「12.4 秒へ飛ぶ」で1文ぶん進んだことになる。
 *
 *   **止めて鳴らし直さない。** `currentTime` を動かすだけなので、
 *   押した瞬間にそこから続きが鳴る(黙る時間が無い)。
 *
 * ============================================================================
 * 【出す場所は2つ。中身は同じ】
 *
 *   ・「Listen (全体)」の横 … **本文ぜんぶ**を行き来する
 *   ・段落 / 発言の Listen の横 … **その段落の中だけ**で行き来する
 *
 *   どちらも `skipSentence(±1)` を呼ぶだけで、**どこまで動けるかは
 *   `readAloud.js` が控えている**(判断を画面に持たせない・CLAUDE.md)。
 *
 * ============================================================================
 * 【鳴っていないときは出さない】
 *
 *   飛ばす先が無いので、**効かない操作を見せない**(CLAUDE.md)。
 *   1本にまとめられなかった教材(鍵が無い・名簿に無い声が混じっている・
 *   時刻が本文と合わない)でも、区間が無いので出ない。
 *   **音は鳴る。** ◁▷ が出ないだけである。
 *
 * 【三角は文字で描く】
 *   絵文字は端末ごとに形も大きさも違う(`PlayerBar` / `Stepper` と同じ)。
 */
import { useEffect, useState } from 'react'
import { skipSentence, watchSentenceSkip } from '../lib/readAloud.js'

export default function SentenceSkip({ className = '' }) {
  /* **鳴り始めてから出す。** 使えるかどうかは `readAloud.js` が知っている */
  const [ready, setReady] = useState(false)
  useEffect(() => watchSentenceSkip(setReady), [])

  if (!ready) return null

  return (
    <span className={`sentskip ${className}`.trim()}>
      <button type="button" className="btn btn--small btn--ghost sentskip-btn"
              title="1文もどる" aria-label="1文もどる"
              onClick={() => skipSentence(-1)}>◁</button>
      <button type="button" className="btn btn--small btn--ghost sentskip-btn"
              title="1文すすむ" aria-label="1文すすむ"
              onClick={() => skipSentence(1)}>▷</button>
    </span>
  )
}
