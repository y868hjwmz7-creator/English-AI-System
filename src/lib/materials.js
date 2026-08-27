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
import { CEFR_LEVELS, cefrLabel } from '../data/cefr.js'
import { supabase } from './supabase.js'

// 教材のレベルはゲストのレベルと同じ物差し(CEFR)を使う
export { CEFR_LEVELS, cefrLabel }

const ok = (data) => ({ data, error: null })
const ng = (error) => ({ data: null, error })

const fail = (e, fallback) => ng(e?.message ? `${fallback}: ${e.message}` : fallback)

export const MATERIAL_KINDS = [
  { id: 'pattern', label: '文型ドリル', hint: '同じ文法で違う文章をくり返す。定着が狙い' },
  { id: 'passage', label: '長文', hint: '音読・オーバーラッピング・シャドーイング・リピーティングで使う' },
  { id: 'word',    label: '単語', hint: '単語学習で使う' },
  { id: 'phrase',  label: 'フレーズ', hint: 'フレーズ学習で使う' },
]

export const kindLabel = (id) => MATERIAL_KINDS.find((k) => k.id === id)?.label ?? id

// ── ゲストの一覧 ────────────────────────────────────────────────

/**
 * 自分が担当しているゲスト。
 * 2回に分けて問い合わせている。learner_admins はゲストと講師の両方が
 * profiles を指しているため、1回でつなぐと指定が複雑になり壊れやすい。
 */
export async function loadMyLearners() {
  if (!supabase) return ng('Supabase が設定されていません')

  const { data: links, error: linkError } = await supabase
    .from('learner_admins')
    .select('learner_id, started_on, handover_note')
    .is('ended_on', null)
  if (linkError) return fail(linkError, '担当しているゲストを読めませんでした')
  if (!links?.length) return ok([])

  const { data: people, error: peopleError } = await supabase
    .from('profiles')
    .select('id, display_name, status')
    .in('id', links.map((l) => l.learner_id))
    .order('display_name')
  if (peopleError) return fail(peopleError, 'ゲストの情報を読めませんでした')

  const noteOf = new Map(links.map((l) => [l.learner_id, l.handover_note]))
  return ok((people ?? []).map((p) => ({ ...p, handoverNote: noteOf.get(p.id) ?? null })))
}

// ── 教材ライブラリ ────────────────────────────────────────────

/**
 * 教材を探す。**これが既定の動線である**(仕様書 第5.5節)。
 * 新しく作るより、すでにある教材を見つけるほうが速い。
 */
export async function searchMaterials({
  tagIds = [], level = null, keyword = '', industry = null,
} = {}) {
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
      id, title, level, kind, status, visibility, industry, instruction_ja, created_by, created_at,
      teaching_point,
      material_tags ( tag_id ),
      material_sections (
        id, seq, exercise_type, instruction,
        material_items ( id, seq, prompt_en, prompt_ja, hint, question,
                         answer, answer_alt, audio_text, note )
      )
    `)
    .order('created_at', { ascending: false })
    .limit(50)

  if (idsWithTag) query = query.in('id', idsWithTag)
  if (level) query = query.eq('level', level)
  // 業界を選んだときは「その業界」と「汎用」の両方を出す。
  // 汎用の教材はどのゲストにも使えるため、隠すと選択肢が不当に狭まる。
  if (industry) query = query.or(`industry.eq.${industry},industry.is.null`)
  if (keyword.trim()) query = query.ilike('title', `%${keyword.trim()}%`)

  const { data, error } = await query
  if (error) return fail(error, '教材を読めませんでした')

  return ok((data ?? []).map(normalizeMaterial))
}

const sortBySeq = (list) => [...(list ?? [])].sort((a, b) => a.seq - b.seq)

const normalizeMaterial = (m) => {
  const sections = sortBySeq(m.material_sections).map((sec) => ({
    ...sec, items: sortBySeq(sec.material_items),
  }))
  return {
    ...m,
    tagIds: (m.material_tags ?? []).map((t) => t.tag_id),
    sections,
    // 教材全体で何問あるか(一覧の目安に出す)
    itemCount: sections.reduce((n, sec) => n + sec.items.length, 0),
  }
}

// ── 教材を作る ────────────────────────────────────────────────

/**
 * 教材を1件作る。英文と弱点タグも同時に入れる。
 *
 * ブラウザからの操作なので、3つの登録をまとめて1つの取引にはできない。
 * 途中で失敗したら、作りかけの教材を消して中途半端な状態を残さない。
 */
const ITEM_FIELDS = [
  'prompt_en', 'prompt_ja', 'hint', 'question', 'answer', 'answer_alt', 'audio_text', 'note',
]

/** 空の欄を落として、中身のある設問だけを残す */
const cleanItems = (items) =>
  (items ?? [])
    .map((it) => {
      const row = {}
      for (const f of ITEM_FIELDS) {
        const v = String(it[f] ?? '').trim()
        if (v) row[f] = v
      }
      return row
    })
    .filter((row) => Object.keys(row).length > 0)

export async function createMaterial({
  title, level, kind, instruction_ja = '', teaching_point = '',
  visibility = 'school', industry = null,
  sections = [], tagIds = [], createdBy,
}) {
  if (!supabase) return ng('Supabase が設定されていません')

  const cleanSections = sections
    .map((sec) => ({ ...sec, items: cleanItems(sec.items) }))
    .filter((sec) => sec.items.length)

  if (!String(title).trim()) return ng('教材名を入れてください')
  if (!cleanSections.length) return ng('設問を1つ以上入れてください')
  if (!tagIds.length) return ng('弱点タグを1つ以上選んでください(選ばないと、あとから見つけられません)')

  const { data: material, error: materialError } = await supabase
    .from('materials')
    .insert({
      title: String(title).trim(),
      level, kind,
      instruction_ja: String(instruction_ja).trim() || null,
      teaching_point: String(teaching_point).trim() || null,
      visibility,
      industry: industry || null,
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

  // 演習をまとめて作り、返ってきた id に設問をぶら下げる
  const { data: madeSections, error: sectionError } = await supabase
    .from('material_sections')
    .insert(cleanSections.map((sec, i) => ({
      material_id: material.id,
      seq: i + 1,
      exercise_type: sec.exercise_type,
      instruction: String(sec.instruction ?? '').trim() || null,
    })))
    .select('id, seq')
  if (sectionError) return rollback(`演習を登録できませんでした: ${sectionError.message}`)

  const idOfSeq = new Map((madeSections ?? []).map((r) => [r.seq, r.id]))
  const rows = cleanSections.flatMap((sec, i) =>
    sec.items.map((it, j) => ({
      ...it,
      section_id: idOfSeq.get(i + 1),
      material_id: material.id,
      seq: j + 1,
    })))

  const { error: itemsError } = await supabase.from('material_items').insert(rows)
  if (itemsError) return rollback(`設問を登録できませんでした: ${itemsError.message}`)

  const { error: tagsError } = await supabase
    .from('material_tags')
    .insert(tagIds.map((tag_id) => ({ material_id: material.id, tag_id })))
  if (tagsError) return rollback(`弱点タグを登録できませんでした: ${tagsError.message}`)

  return ok({ id: material.id })
}

// ── 配信する ──────────────────────────────────────────────────

/**
 * 1つの教材を、複数のゲストにまとめて配信する。
 * 週60レッスンの規模では、同じ弱点のゲストが必ず複数いるため
 * まとめて配信できることが前提になる(仕様書 第5.5節)。
 */
export async function assignMaterial({ materialId, learnerIds, assignedBy, dueOn = null }) {
  if (!supabase) return ng('Supabase が設定されていません')
  if (!learnerIds?.length) return ng('配信するゲストを選んでください')

  const { error } = await supabase.from('assignments').insert(
    learnerIds.map((learner_id) => ({
      material_id: materialId,
      learner_id,
      assigned_by: assignedBy,
      due_on: dueOn,
    })),
  )
  if (error) {
    // 休会中・退会済のゲストには配信できない(データベース側で止めている)
    if (/row-level security|violates/i.test(error.message)) {
      return ng('共有できませんでした。休会中または退会済のゲストが含まれていないか確認してください。')
    }
    return fail(error, '共有できませんでした')
  }
  return ok({ count: learnerIds.length })
}

// ── ゲスト側:自分の宿題 ────────────────────────────────────────

export async function loadMyAssignments() {
  if (!supabase) return ng('Supabase が設定されていません')

  const { data, error } = await supabase
    .from('assignments')
    .select(`
      id, assigned_at, due_on, learner_done_at,
      materials (
        id, title, level, kind, instruction_ja, teaching_point,
        material_sections (
          id, seq, exercise_type, instruction,
          material_items ( id, seq, prompt_en, prompt_ja, hint, question,
                           answer, answer_alt, audio_text, note )
        )
      )
    `)
    .order('assigned_at', { ascending: false })
    .limit(50)
  if (error) return fail(error, '宿題を読めませんでした')

  return ok((data ?? []).map((a) => ({
    ...a,
    material: a.materials ? normalizeMaterial(a.materials) : null,
  })))
}

/**
 * 「やった」を記録する。
 * ゲストが書き換えられるのはこの欄だけ(列単位の権限で絞ってある)。
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

/** トレーナー側:担当ゲストの取り組み状況 */
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

// ── ゲストの一覧(レベルとスコア付き) ──────────────────────────

/**
 * 担当しているゲストを、CEFR と最新スコアつきで読む。
 * 一覧に出すのは「いちばん新しい TOEIC」と「いちばん新しい VERSANT」だけ。
 * 履歴すべてを毎回読むのは無駄なので、データベース側でまとめてある
 * (learner_latest_scores)。
 */
export async function loadMyLearnersDetailed() {
  if (!supabase) return ng('Supabase が設定されていません')

  const { data: links, error: linkError } = await supabase
    .from('learner_admins')
    .select('learner_id, started_on, handover_note')
    .is('ended_on', null)
  if (linkError) return fail(linkError, '担当しているゲストを読めませんでした')
  if (!links?.length) return ok([])

  const ids = links.map((l) => l.learner_id)

  const [{ data: people, error: peopleError }, { data: scores, error: scoreError }] =
    await Promise.all([
      supabase.from('profiles')
        .select('id, display_name, status, status_note, cefr, industry')
        .in('id', ids).order('display_name'),
      supabase.from('learner_latest_scores')
        .select('learner_id, test_type, score, taken_on').in('learner_id', ids),
    ])
  if (peopleError) return fail(peopleError, 'ゲストの情報を読めませんでした')
  if (scoreError) return fail(scoreError, 'スコアを読めませんでした')

  const noteOf = new Map(links.map((l) => [l.learner_id, l.handover_note]))
  const scoreOf = new Map()
  for (const s of scores ?? []) {
    if (!scoreOf.has(s.learner_id)) scoreOf.set(s.learner_id, {})
    scoreOf.get(s.learner_id)[s.test_type] = { score: Number(s.score), takenOn: s.taken_on }
  }

  return ok((people ?? []).map((p) => ({
    ...p,
    handoverNote: noteOf.get(p.id) ?? null,
    scores: scoreOf.get(p.id) ?? {},
  })))
}

/** ゲストの CEFR レベルを記録する(トレーナーのみ) */
export async function setLearnerCefr(learnerId, cefr) {
  if (!supabase) return ng('Supabase が設定されていません')
  const { error } = await supabase
    .from('profiles').update({ cefr: cefr || null }).eq('id', learnerId)
  if (error) return fail(error, 'レベルを記録できませんでした')
  return ok(true)
}

/** スコアを1件記録する(トレーナーのみ) */
export async function addLearnerScore({ learnerId, testType, score, takenOn, note, recordedBy }) {
  if (!supabase) return ng('Supabase が設定されていません')
  const value = Number(score)
  if (!Number.isFinite(value)) return ng('スコアを数字で入れてください')
  if (!takenOn) return ng('受験日を入れてください')

  const { error } = await supabase.from('learner_scores').insert({
    learner_id: learnerId, test_type: testType, score: value,
    taken_on: takenOn, note: note || null, recorded_by: recordedBy,
  })
  if (error) {
    if (/learner_scores_range|violates check/i.test(error.message)) {
      return ng('スコアが範囲の外です。TOEIC は 10〜990、VERSANT は 20〜80 です。')
    }
    return fail(error, 'スコアを記録できませんでした')
  }
  return ok(true)
}

/** スコアの履歴(1人ぶん) */
export async function loadScoreHistory(learnerId) {
  if (!supabase) return ng('Supabase が設定されていません')
  const { data, error } = await supabase
    .from('learner_scores')
    .select('id, test_type, score, taken_on, note')
    .eq('learner_id', learnerId)
    .order('taken_on', { ascending: false })
  if (error) return fail(error, 'スコアの履歴を読めませんでした')
  return ok(data ?? [])
}

/** 在籍状態を変える(受講中 / 休会中 / 退会済) */
export async function setLearnerStatus(learnerId, status, note) {
  if (!supabase) return ng('Supabase が設定されていません')
  const { error } = await supabase.rpc('set_learner_status', {
    p_learner_id: learnerId, p_status: status, p_note: note || null,
  })
  if (error) return fail(error, '在籍状態を変えられませんでした')
  return ok(true)
}

// ── AI に下書きを作らせる ─────────────────────────────────────

/**
 * 演習を1つぶん生成する。
 *
 * **保存はしない。下書きが返るだけ。**
 * トレーナーが目を通して直す工程を飛ばさせないため(仕様書 第5.13.5節)。
 *
 * 1回に1演習だけ作るのは、40問を一度に作らせると応答が長くなり
 * 時間切れになりやすいため。10問ずつなら失敗しても作り直しが軽い。
 */
export async function generateSection({
  sectionType, count = 10, topic, level, industry = '', isFirst = false, avoid = [],
}) {
  if (!supabase) return ng('Supabase が設定されていません')

  const { data, error } = await supabase.functions.invoke('generate-material', {
    body: { sectionType, count, topic, level, industry, isFirst, avoid },
  })

  if (error) {
    // 受付窓口が返した日本語の理由を拾う
    let detail = ''
    try { detail = (await error.context?.json())?.error ?? '' } catch { /* 読めなければ無視 */ }
    if (/Failed to send a request|FunctionsFetchError/i.test(error.message ?? '')) {
      return ng('生成の窓口につながりませんでした。'
        + 'Supabase に generate-material を配置したか確認してください。')
    }
    return ng(detail || `生成に失敗しました: ${error.message}`)
  }
  if (data?.error) return ng(data.error)
  return ok(data)
}

// ── アカウントを発行する ──────────────────────────────────────

/**
 * ゲスト(またはトレーナー)のアカウントを作る。
 *
 * 管理者の鍵が要る操作なので、Supabase のサーバー上の受付窓口
 * (create-user)に任せる。ブラウザは「誰を作りたいか」を送るだけで、
 * 鍵には触れない(仕様書 第5.8節)。
 *
 * トレーナーが作れるのはゲストだけ。これは窓口の側で強制している。
 */
export async function createAccount({ loginId, password, displayName, role = 'learner' }) {
  if (!supabase) return ng('Supabase が設定されていません')

  const { data, error } = await supabase.functions.invoke('create-user', {
    body: { loginId, password, displayName, role },
  })

  if (error) {
    let detail = ''
    try { detail = (await error.context?.json())?.error ?? '' } catch { /* 読めなければ無視 */ }
    if (/Failed to send a request|FunctionsFetchError/i.test(error.message ?? '')) {
      return ng('アカウント発行の窓口につながりませんでした。'
        + 'Supabase に create-user を配置したか確認してください。')
    }
    return ng(detail || `アカウントを作れませんでした: ${error.message}`)
  }
  if (data?.error) return ng(data.error)
  return ok(data.user)
}

// ── すでにある英文(重複を避けるため) ──────────────────────────

/**
 * その弱点タグですでに使われている英文を集める。
 *
 * 同じ文章が二度出ると、ゲストは「前にやった」と感じて手が止まる。
 * 生成のときにこの一覧を渡し、避けさせる。
 *
 * 数が多くなりすぎないよう、直近の教材から集めて上限をかける。
 */
export async function loadUsedSentences(tagIds, limit = 120) {
  if (!supabase || !tagIds?.length) return ok([])

  const { data: tagged, error: tagError } = await supabase
    .from('material_tags').select('material_id').in('tag_id', tagIds).limit(60)
  if (tagError) return fail(tagError, 'すでにある英文を読めませんでした')
  const ids = [...new Set((tagged ?? []).map((r) => r.material_id))]
  if (!ids.length) return ok([])

  const { data, error } = await supabase
    .from('material_items')
    .select('prompt_en, audio_text, answer')
    .in('material_id', ids)
    .limit(400)
  if (error) return fail(error, 'すでにある英文を読めませんでした')

  const seen = new Set()
  for (const row of data ?? []) {
    for (const v of [row.prompt_en, row.audio_text, row.answer]) {
      const text = String(v ?? '').trim()
      // 英語の文だけを集める(和訳や日本語の設問は対象外)
      if (text && /^[\x20-\x7E\u2018\u2019\u201C\u201D]+$/.test(text) && /[a-zA-Z]/.test(text)) {
        seen.add(text)
      }
    }
  }
  return ok([...seen].slice(-limit))
}

/** 生成した設問から、すでにある英文と同じものを取り除く */
export function dropDuplicates(items, usedSet) {
  const kept = []
  const dropped = []
  for (const it of items ?? []) {
    const key = String(it.prompt_en || it.audio_text || it.answer || '').trim()
    if (key && usedSet.has(key)) dropped.push(key)
    else { kept.push(it); if (key) usedSet.add(key) }
  }
  return { kept, dropped }
}
