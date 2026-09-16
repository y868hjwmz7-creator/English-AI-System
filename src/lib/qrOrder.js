/**
 * **Quick Response の並べ方。算段だけ**(2026-09)。
 *
 * ============================================================================
 * 【なぜ `qrReviews.js` から出したか】
 *
 *   あちらは Supabase を引き連れているので、**素の node で一度も
 *   走らせられない**(`playMark.js` / `frameMatch.js` / `qrPromote.js` と
 *   同じ話)。ところが並べ方は**純粋な算段**で、
 *   「型でまとめる」(パタプラ)を足した回に、**どう並ぶのかを
 *   機械的に確かめたくなった。**
 *
 *   **読む側は1行も変わっていない** —— `qrReviews.js` が
 *   ここから読み直して、そのまま出し直している
 *   (`textNorm.js` へ `normWord` を出したときとまったく同じ作法)。
 * ============================================================================
 */
import { frameFormOf } from './frameMatch.js'

export const QR_ORDERS = [
  { id: 'shuffle', label: '混ぜる' },
  { id: 'material', label: '教材の順' },
  /**
   * **型でまとめる**(2026-09 利用者の指定「パタプラのようにしたい」)。
   *
   * パターンプラクティスの芯は「**型は固定したまま、中身だけ入れ替える**」
   * である。`I'd like to ___` を続けて何本も言うから、
   * **型のほうが手に残る。** 混ぜてしまうと、1本ごとに型を探し直すことになり、
   * それはパターンプラクティスではない。
   *
   * **新しい仕組みを作っていない。** どの文がどの型かは
   * `frameMatch.js`(2026-09)がもう言えるので、**並べ方を1つ足すだけ**で
   * 「型を固定して入れ替える」練習になる。
   */
  { id: 'frame', label: '型でまとめる' },
]

/** 並べ替える。`shuffle` は呼ぶたびに違う並びになる */
export function orderQrPairs(list, order) {
  const rows = [...(list ?? [])]
  if (order === 'frame') {
    /* **型ごとにまとめ、その中は溜まった順。**
       型を言い当てられなかった文(`null`)は**後ろにまとめる** ——
       落とさない(**黙って消さない**)。前に混ぜると、
       型の並びが途切れて、入れ替えの練習にならない */
    const key = (r) => frameFormOf(r?.en ?? '') ?? ''
    return rows.sort((a, b) => {
      const fa = key(a); const fb = key(b)
      if (fa !== fb) {
        if (!fa) return 1
        if (!fb) return -1
        return fa.localeCompare(fb, 'ja')
      }
      return String(a.added_at ?? '').localeCompare(String(b.added_at ?? ''))
    })
  }
  if (order === 'material') {
    // 教材ごとにまとめ、その中は溜まった順。**話の流れが戻る**
    return rows.sort((a, b) => {
      const t = String(a.material_title ?? '').localeCompare(String(b.material_title ?? ''), 'ja')
      if (t !== 0) return t
      return String(a.added_at ?? '').localeCompare(String(b.added_at ?? ''))
    })
  }
  for (let i = rows.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[rows[i], rows[j]] = [rows[j], rows[i]]
  }
  return rows
}
