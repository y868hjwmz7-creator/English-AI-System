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
 *   short: (m: object) => string,
 *   start: (m: object) => Promise<void>,
 * }}
 */
/**
 * **スピーチでも、この1つを使う**(第5.300節・2026-09-28 利用者の指定)。
 *
 *   > ゲストのスピーチの添削、音声のダウンロードと
 *   > 文章を一本化したもののコピペを可能にしてください
 *
 * 状態も進み具合も文言も**まったく同じ**なので、
 * 書き写さずに**数え方と落とし方だけ**を差し替える
 * (**同じものを2か所に書き写さない**・CLAUDE.md)。
 * 何も渡さなければ、これまでどおり教材のふるまいである。
 *
 * @param count    何本あるか(既定: 教材のかけら)
 * @param download 落とす(既定: 教材)
 */
/** ボタンの言葉。**2か所に書き写さない**(`label` も `labelKeep` もここから) */
const 待っている = '音声ダウンロード'
const 集めている = (done, total) => `集めています… ${done} / ${total}`

export function useAudioDownload({
  count = materialClipPieces,
  download = downloadMaterialAudio,
} = {}) {
  const [busy, setBusy] = useState(null)
  const [done, setDone] = useState(null)

  /** それに、集められる音声が何本あるか(0 ならボタンごと出さない) */
  const pieces = (m) => count(m).length

  /**
   * ボタンの文言。**進み具合は、必ず数で出す**(CLAUDE.md) ——
   * 14 本を集めるあいだ、名前のままでは止まって見える。
   */
  const label = (m) => (busy?.id === m?.id ? 集めている(busy.done, busy.total) : 待っている)

  /**
   * **いちばん広くなった形**(第5.300節)。`SteadyLabel` に渡すと、
   * 押しても**ボタンの大きさも、まわりの物の場所も動かない**
   * (共通ルール「押しても、まわりの物が動かない」)。
   *
   * **言葉はここ1か所。** 呼ぶ側に書き写すと、言い方を変えた日に
   * **取っておく幅だけが古くなる**(それでは何も守らない)。
   */
  const labelKeep = (m) => [待っている, 集めている(pieces(m), pieces(m))]

  /**
   * **3つ並ぶ行のための、短い言い方**(2026-09 利用者の指定)。
   *
   *   > 適宜言葉を減らしてアイコンを活かすことで３つ並ぶように
   *   > してください。直感でわかれば良いのです。
   *
   * トレーナーの「教材」のカードは、いま
   * **PDF / 音声 / 共有**の3つを1行に並べている。そこへ
   * `label()` の「集めています… 3 / 14」を出すと、狭い画面ではみ出す。
   *
   * **削るのは動詞だけ。数は1文字も削らない**(CLAUDE.md
   * 「進み具合は、必ず数で出す」)—— 動いていることは、
   * 数が増えることと、押せなくなることが言う。
   *
   * **`label()` は残す。** ゲストの「今週の宿題」は
   * ボタンが少なく、あちらは言葉のまま入る
   * (**言われた場所だけを直す** —— 押す場所ごとに要る幅が違う)。
   */
  const short = (m) => (busy?.id === m?.id
    ? `${busy.done} / ${busy.total}`
    : '音声')

  const start = async (m) => {
    if (!m?.id) return
    setDone(null)
    setBusy({ id: m.id, done: 0, total: pieces(m) })
    let r
    try {
      r = await download(m, ({ done: d, total }) => {
        setBusy({ id: m.id, done: d, total })
      })
    } catch (e) {
      r = { ok: false, total: 0, missing: 0, error: String(e?.message ?? e) }
    }
    setBusy(null)
    setDone({ id: m.id, ...r })
  }

  return { busy, done, pieces, label, labelKeep, short, start }
}
