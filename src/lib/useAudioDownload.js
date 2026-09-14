/**
 * ============================================================================
 * 教材の音声を、**1本の MP3 にまとめて落とす**ための持ちもの。
 *
 * 【なぜ切り出すか】(2026-09 利用者の指定)
 *
 *   > 各ゲストのアカウント内でも教材の音声がダウンロードできるように
 *   > してください。
 *
 *   もとは `TrainerMaterials.jsx` の中にだけあった
 *   (状態2つ + 押したときの手続き)。ゲストの「今週の宿題」にも置くので、
 *   **同じものを2か所に書き写さない**(CLAUDE.md)。
 *   書き写すと、片方だけ古くなる —— 単語帳で3度言われた失敗である。
 *
 * 【ここは「押したあとの段取り」だけを持つ】
 *   集めるのも、つなぐのも `downloadAudio.js`。
 *   **数え方を2通り持たない** —— 何本あるかは `materialClipPieces()`、
 *   落とすのは `downloadMaterialAudio()` が決める。
 *
 * 【窓口を呼ばない = 0円】
 *   **すでにある MP3 を集めるだけ**である。まだ作られていない英文は
 *   その場でこしらえず、**何本足りないかを伝える**
 *   (見えない費用は管理できない・CLAUDE.md)。
 *   ゲストが押しても同じで、**1円もかからない。**
 * ============================================================================
 */
import { useState } from 'react'
import { downloadMaterialAudio, materialClipPieces } from './downloadAudio.js'

/**
 * @returns {{
 *   busy: ({id: string, done: number, total: number}|null),
 *   done: (object|null),
 *   pieces: (m: object) => number,
 *   label: (m: object) => string,
 *   start: (m: object) => Promise<void>,
 * }}
 */
export function useAudioDownload() {
  const [busy, setBusy] = useState(null)
  const [done, setDone] = useState(null)

  /** その教材に、集められる音声が何本あるか(0 ならボタンごと出さない) */
  const pieces = (m) => materialClipPieces(m).length

  /**
   * ボタンの文言。**進み具合は、必ず数で出す**(CLAUDE.md) ——
   * 14 本を集めるあいだ、名前のままでは止まって見える。
   */
  const label = (m) => (busy?.id === m?.id
    ? `集めています… ${busy.done} / ${busy.total}`
    : '音声ダウンロード')

  const start = async (m) => {
    if (!m?.id) return
    setDone(null)
    setBusy({ id: m.id, done: 0, total: pieces(m) })
    let r
    try {
      r = await downloadMaterialAudio(m, ({ done: d, total }) => {
        setBusy({ id: m.id, done: d, total })
      })
    } catch (e) {
      r = { ok: false, total: 0, missing: 0, error: String(e?.message ?? e) }
    }
    setBusy(null)
    setDone({ id: m.id, ...r })
  }

  return { busy, done, pieces, label, start }
}
