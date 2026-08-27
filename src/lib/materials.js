/**
 * 教材と宿題のやりとり。
 *
 * すべて Supabase の RLS(アクセス制御)の内側で動く。
 * 「見えてはいけないものは、そもそも返ってこない」ため、
 * ここでは権限の判定を行わない。画面の出し分けは見た目の都合であって、
 * 安全性はデータベース側が担保している。
 *
 * 例外は投げず、必ず { data, error } の形で返す。
 * error は日本語の文字列(そのまま画面に出せる)。
 */
import { supabase } from './supabase.js'

const ok = (data) => ({ data, error: null })
const ng = (error) => ({ data: null, error })

const fail = (e, fallback) => ng(e?.message ? `${fallback}: ${e.message}` : fallback)

export const MATERIAL_KINDS = [
  { id: 'passage', label: '長文', hint: '音読・オーバーラッピング・シャドーイング・リピーティングで使う' },
  { id: 'word',    label: '単語', hint: '単語学習で使う' },
  { id: 'phrase',  label: 'フレーズ', hint: 'フレーズ学習で使う' },
]

export const LEVELS = [
  { id: 1, label: '初級' },
  { id: 2, label: '中級' },
  { id: 3, label: '上級' },
]

export const kindLabel = (id) => MATERIAL_KINDS.find((k) => k.id === id)?.label ?? id
export const levelLabel = (n) => LEVELS.find((l) => l.id === n)?.label ?? `レベル${n}`

// ── 生徒の一覧 ────────────────────────────────────────────────

/**
 * 自分が担当している生徒。
 * 2回に分けて問い合わせている。learner_admins は生徒と講師の両方が
 * profiles を指しているため、1回でつなぐと指定が複雑になり壊れやすい。
 */
export async function loadMyLearners() {
  if (!supabase) return ng('Supabase が設定されていません')

  const { data: links, error: linkError } = await supabase
    .from('learner_admins')
    .select('learner_id, started_on, handover_note')
    .is('ended_on', null)
  if (linkError) return fail(linkError, '担当している生徒を読めませんでした')
  if (!links?.length) return ok([])

  const { data: people, error: peopleError } = await supabase
    .from('profiles')
    .select('id, display_name, status')
    .in('id', links.map((l) => l.learner_id))
    .order('display_name')
  if (peopleError) return fail(peopleError, '生徒の情報を読めませんでした')

  const noteOf = new Map(links.map((l) => [l.learner_id, l.handover_note]))
  return ok((people ?? []).map((p) => ({ ...p, handoverNote: noteOf.get(p.id) ?? null })))
}

// ── 教材ライブラリ ────────────────────────────────────────────

/**
 * 教材を探す。**これが既定の動線である**(仕様書 第5.5節)。
 * 新しく作るより、すでにある教材を見つけるほうが速い。
 */
export async function searchMaterials({ tagIds = [], level = null, keyword = '' } = {}) {
  if (!supabase) return ng('Supabase が設定されていません')

  // 弱点タグで絞る場合は、まず該当する教材の id を集める
  let idsWithTag = null
  if (tagIds.length) {
    const { data, error } = await supabase
      .from('material_tags').select('material_id').in('tag_id', tagIds)
    if (error) return fail(error, '弱点タグで絞り込めませんでした')
    idsWithTag = [...new Set((data ?? []).map((r) => r.material_id))]
    if (!idsWithTag.length) return ok([])
  }

  let query = supabase
    .from('materials')
    .select(`
      id, title, level, kind, status, visibility, instruction_ja, created_by, created_at,
      material_tags ( tag_id ),
      material_items ( id, seq, text_en, text_ja, note_ja )
    `)
    .order('created_at', { ascending: false })
    .limit(50)

  if (idsWithTag) query = query.in('id', idsWithTag)
  if (level) query = query.eq('level', level)
  if (keyword.trim()) query = query.ilike('title', `%${keyword.trim()}%`)

  const { data, error } = await query
  if (error) return fail(error, '教材を読めませんでした')

  return ok((data ?? []).map(normalizeMaterial))
}

const normalizeMaterial = (m) => ({
  ...m,
  tagIds: (m.material_tags ?? []).map((t) => t.tag_id),
  items: [...(m.material_items ?? [])].sort((a, b) => a.seq - b.seq),
})

// ── 教材を作る ────────────────────────────────────────────────

/**
 * 教材を1件作る。英文と弱点タグも同時に入れる。
 *
 * ブラウザからの操作なので、3つの登録をまとめて1つの取引にはできない。
 * 途中で失敗したら、作りかけの教材を消して中途半端な状態を残さない。
 */
export async function createMaterial({
  title, level, kind, instruction_ja = '', visibility = 'school',
  items = [], tagIds = [], createdBy,
}) {
  if (!supabase) return ng('Supabase が設定されていません')

  const clean = items
    .map((it, i) => ({
      seq: i + 1,
      text_en: String(it.text_en ?? '').trim(),
      text_ja: String(it.text_ja ?? '').trim() || null,
      note_ja: String(it.note_ja ?? '').trim() || null,
    }))
    .filter((it) => it.text_en)

  if (!String(title).trim()) return ng('教材名を入れてください')
  if (!clean.length) return ng('英文を1つ以上入れてください')
  if (!tagIds.length) return ng('弱点タグを1つ以上選んでください(選ばないと、あとから見つけられません)')

  const { data: material, error: materialError } = await supabase
    .from('materials')
    .insert({
      title: String(title).trim(),
      level, kind,
      instruction_ja: String(instruction_ja).trim() || null,
      visibility,
      status: 'published',
      published_at: new Date().toISOString(),
      created_by: createdBy,
    })
    .select('id')
    .single()
  if (materialError) return fail(materialError, '教材を作れませんでした')

  const rollback = async (message) => {
    await supabase.from('materials').delete().eq('id', material.id)
    return ng(message)
  }

  const { error: itemsError } = await supabase
    .from('material_items')
    .insert(clean.map((it) => ({ ...it, material_id: material.id })))
  if (itemsError) return rollback(`英文を登録できませんでした: ${itemsError.message}`)

  const { error: tagsError } = await supabase
    .from('material_tags')
    .insert(tagIds.map((tag_id) => ({ material_id: material.id, tag_id })))
  if (tagsError) return rollback(`弱点タグを登録できませんでした: ${tagsError.message}`)

  return ok({ id: material.id })
}

// ── 配信する ──────────────────────────────────────────────────

/**
 * 1つの教材を、複数の生徒にまとめて配信する。
 * 週60レッスンの規模では、同じ弱点の生徒が必ず複数いるため
 * まとめて配信できることが前提になる(仕様書 第5.5節)。
 */
export async function assignMaterial({ materialId, learnerIds, assignedBy, dueOn = null }) {
  if (!supabase) return ng('Supabase が設定されていません')
  if (!learnerIds?.length) return ng('配信する生徒を選んでください')

  const { error } = await supabase.from('assignments').insert(
    learnerIds.map((learner_id) => ({
      material_id: materialId,
      learner_id,
      assigned_by: assignedBy,
      due_on: dueOn,
    })),
  )
  if (error) {
    // 休会中・退会済の生徒には配信できない(データベース側で止めている)
    if (/row-level security|violates/i.test(error.message)) {
      return ng('配信できませんでした。休会中または退会済の生徒が含まれていないか確認してください。')
    }
    return fail(error, '配信できませんでした')
  }
  return ok({ count: learnerIds.length })
}

// ── 生徒側:自分の宿題 ────────────────────────────────────────

export async function loadMyAssignments() {
  if (!supabase) return ng('Supabase が設定されていません')

  const { data, error } = await supabase
    .from('assignments')
    .select(`
      id, assigned_at, due_on, learner_done_at,
      materials (
        id, title, level, kind, instruction_ja,
        material_items ( id, seq, text_en, text_ja, note_ja )
      )
    `)
    .order('assigned_at', { ascending: false })
    .limit(50)
  if (error) return fail(error, '宿題を読めませんでした')

  return ok((data ?? []).map((a) => ({
    ...a,
    material: a.materials
      ? { ...a.materials, items: [...(a.materials.material_items ?? [])].sort((x, y) => x.seq - y.seq) }
      : null,
  })))
}

/**
 * 「やった」を記録する。
 * 生徒が書き換えられるのはこの欄だけ(列単位の権限で絞ってある)。
 */
export async function markAssignmentDone(assignmentId, done = true) {
  if (!supabase) return ng('Supabase が設定されていません')
  const { error } = await supabase
    .from('assignments')
    .update({ learner_done_at: done ? new Date().toISOString() : null })
    .eq('id', assignmentId)
  if (error) return fail(error, '記録できませんでした')
  return ok(true)
}

/** トレーナー側:担当生徒の取り組み状況 */
export async function loadAssignmentsForLearner(learnerId) {
  if (!supabase) return ng('Supabase が設定されていません')
  const { data, error } = await supabase
    .from('assignments')
    .select('id, assigned_at, due_on, learner_done_at, admin_checked_at, materials ( id, title, level )')
    .eq('learner_id', learnerId)
    .order('assigned_at', { ascending: false })
    .limit(50)
  if (error) return fail(error, '取り組み状況を読めませんでした')
  return ok(data ?? [])
}
