/**
 * **◀ いまの設定 ▶**(2026-09 利用者の指定)。
 *
 *   > 上部バーの機能について、画面幅、文字の大きさ、そして読み上げの速さ、
 *   > 全てを画面幅と文字の大きさのUIに統一し、そして、現在の設定の左右に
 *   > 三角を置くデザインにしてください。そうすればスペースを有効に使えます。
 *   > ◀︎標準▶︎
 *
 * 【なぜ場所が空くのか】
 *   選択肢を全部並べる形(札を横に並べる・プルダウン)は、
 *   **段の数だけ横に伸びる。** 紙の幅は 100〜150% と「画面に合わせる」で
 *   7段、読み上げの速さは 70〜130% で 13段になったので、
 *   並べるやり方はもう成り立たない。
 *   三角なら**いまの1つ分の幅**しか要らない。段が増えても太らない。
 *
 * 【決まりごと】
 *   ・**並びは「小さい順」。** ◀ で下がり、▶ で上がる。
 *     数直線と同じ向きにしておかないと、押すたびに迷う
 *   ・**端まで来たら、そのボタンを押せなくする**(`disabled`)。
 *     ぐるっと回すと「いま端にいる」ことが分からない
 *   ・**押せる大きさを割らない。** 三角は小さく見えるが、
 *     押せる面(`.stepper-arrow`)は 34px 取ってある
 *   ・**三角は自分で描く**(文字の ◀ ▶ を使う)。
 *     絵文字は端末ごとに形も大きさも違う(CLAUDE.md)
 *   ・読み上げ機には「いま何が選ばれているか」を言葉で伝える
 *     (`aria-label` に見出しと値の両方を入れる)
 */
export default function Stepper({
  /** 何の設定か(「速さ」「文字」「幅」)。**画面にも出す。**
      3つとも同じ形になったので、見出しが無いとどれがどれか分からない */
  label,
  /** `[{ id, label }, …]`。**小さい順に並べておく** */
  options = [],
  value,
  onChange,
  className = '',
}) {
  const list = options ?? []
  const at = Math.max(0, list.findIndex((o) => o.id === value))
  const now = list[at] ?? null
  const go = (step) => {
    const next = list[at + step]
    if (next) onChange?.(next.id)
  }

  if (list.length === 0) return null

  return (
    <div className={`stepper ${className}`} role="group"
         aria-label={`${label}(いま ${now?.label ?? ''})`}>
      <span className="stepper-label" aria-hidden="true">{label}</span>
      <button type="button" className="stepper-arrow"
              onClick={() => go(-1)} disabled={at <= 0}
              aria-label={`${label}を1つ下げる`}>◀</button>
      {/* **数字は幅がそろうようにする**(`tabular-nums`)。
          そろえないと、押すたびに三角の位置が左右にずれる */}
      <span className="stepper-now">{now?.label}</span>
      <button type="button" className="stepper-arrow"
              onClick={() => go(1)} disabled={at >= list.length - 1}
              aria-label={`${label}を1つ上げる`}>▶</button>
    </div>
  )
}
