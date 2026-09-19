/**
 * ============================================================================
 * **RIZAP ENGLISH の教材を、ゲストに出す**(第5.202節)
 *
 * 2026-09 利用者の指定。
 *
 *   > UNIT ごと、丸ごと、それぞれお願いします。UNIT 毎の場合はプルダウンで
 *
 * ── 単語帳の冊とは、出し方がちがう ────────────────────────
 *
 *   単語帳・Quick Response の冊は `learner_features`(その人に出す / 出さない)
 *   だが、**こちらは教材である。** 教材は `assignments` に入れて
 *   **今週の宿題として届く** —— 既存の「教材をゲストに共有する」と
 *   まったく同じ道である(`assignMaterial()`)。
 *   **新しい配り方を作らない**(同じことをするものを2つ作らない・CLAUDE.md)。
 *
 * ── UNIT の数は、数えない。読む ──────────────────────────
 *
 *   `rizapBooks.js` は冊の名前しか持っていない。
 *   何 UNIT 入っているかは**そのとき Supabase を読んで数える** ——
 *   UNIT を足した日に、画面の数だけ古くなるのを避ける。
 *
 * ── もう出してあるものは、二度出さない ──────────────────────
 *
 *   「丸ごと」を2回押したら、宿題が2倍になる ——
 *   **押した人には、増えたのか増えていないのか分からない。**
 *   だから**すでに出してある UNIT を先に読み、残りだけを出す。**
 *   出すものが1つも無ければ、そう言う(黙って成功と言わない)。
 * ============================================================================
 */
import { supabase } from './supabase.js'
import { assignMaterial } from './materials.js'

const ok = (data) => ({ data, error: null })
const ng = (message) => ({ data: null, error: { message } })

/**
 * **その冊に入っている UNIT**(番号の順)。
 *
 * @param {string} series 冊の id(`materials.series`)
 * @returns {Promise<{data: Array<{id, unit_no, headline}>|null, error}>}
 *   **読めなかったら `null`。空の配列にしない** ——
 *   「0 UNIT です」と「読めませんでした」を取り違えない(CLAUDE.md)
 */
export async function loadRizapUnits(series) {
  if (!supabase) return ok([])
  const { data, error } = await supabase
    .from('materials')
    .select('id, unit_no, headline, title')
    .eq('series', series)
    .not('unit_no', 'is', null)
    .order('unit_no', { ascending: true })
  if (error) return { data: null, error }
  return ok(data ?? [])
}

/**
 * **その人にもう出してある教材の id。**
 *
 * @returns {Promise<{data: Set<string>|null, error}>}
 */
export async function loadAssignedIds(learnerId, materialIds) {
  if (!supabase) return ok(new Set())
  if (!learnerId || !materialIds?.length) return ok(new Set())
  const { data, error } = await supabase
    .from('assignments')
    .select('material_id')
    .eq('learner_id', learnerId)
    .in('material_id', materialIds)
  if (error) return { data: null, error }
  return ok(new Set((data ?? []).map((r) => r.material_id)))
}

/**
 * **出す。** 丸ごとでも1つでも、通る道は同じである。
 *
 * @param {object} o
 * @param {string}   o.learnerId  出す相手
 * @param {string}   o.assignedBy 出した人(トレーナー)
 * @param {string[]} o.materialIds 出す教材(UNIT)
 * @returns {Promise<{data: {sent: number, already: number}|null, error}>}
 */
export async function assignRizap({ learnerId, assignedBy, materialIds }) {
  if (!supabase) return ng('Supabase が設定されていません')
  if (!learnerId) return ng('出す相手を選んでください')
  if (!materialIds?.length) return ng('この冊には、まだ UNIT が1つも入っていません')

  const { data: already, error: readError } = await loadAssignedIds(learnerId, materialIds)
  if (readError) return { data: null, error: readError }

  /* **もう出してあるものは、二度出さない。** 押すたびに宿題が増えると、
     ゲストの画面に同じ UNIT が何本も並ぶ */
  const rest = materialIds.filter((id) => !already.has(id))
  if (!rest.length) {
    return ok({ sent: 0, already: materialIds.length })
  }

  /* **1本ずつ出す。** `assignMaterial()` は「1つの教材を複数のゲストへ」
     なので、向きが逆である。**新しい窓口を作らず、あれを繰り返す** ——
     配れる相手の決まり(休会中・退会済は配れない)も、そのまま効く */
  for (const materialId of rest) {
    const { error } = await assignMaterial({
      materialId, learnerIds: [learnerId], assignedBy,
    })
    if (error) return { data: null, error }
  }
  return ok({ sent: rest.length, already: already.size })
}
