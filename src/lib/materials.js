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
  { id: 'pattern',  label: '文型ドリル',
    hint: '同じ文法で違う文章をくり返す。定着が狙い。4演習 × 10問 = 40問' },
  { id: 'reading',  label: 'リーディング(記事)',
    hint: '業界別のニュースや読み物を1本。音読・シャドーイングに使う' },
  { id: 'dialogue', label: 'ダイアローグ(会話)',
    hint: '場面を決めた会話を1本。役を決めて声に出す' },
  { id: 'word',     label: '単語', hint: '単語学習で使う' },
  { id: 'phrase',   label: 'フレーズ', hint: 'フレーズ学習で使う' },
  // 旧「長文」。新規では選べないが、既存の教材の表示に使う
  { id: 'passage',  label: '長文(旧)', hint: '作り直す前の形。新しくは作れない', legacy: true },
]

/** 新しく作れる種類(旧いものを除く) */
export const NEW_MATERIAL_KINDS = MATERIAL_KINDS.filter((k) => !k.legacy)

/** 本文を1本作る種類(記事・会話)かどうか。問数ではなく長さで考える */
export const isPassageKind = (kind) => kind === 'reading' || kind === 'dialogue'

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
  kind = null, genre = null, scene = null,
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
      teaching_point, headline, genre, scene, topic, voice_ids,
      material_tags ( tag_id ),
      material_sections (
        id, seq, exercise_type, instruction,
        material_items ( id, seq, prompt_en, prompt_ja, hint, question,
                         answer, answer_alt, audio_text, note, tag_id, speaker,
                         phrases )
      )
    `)
    .order('created_at', { ascending: false })
    .limit(50)

  if (idsWithTag) query = query.in('id', idsWithTag)
  if (level) query = query.eq('level', level)
  // 業界を選んだときは「その業界」と「汎用」の両方を出す。
  // 汎用の教材はどのゲストにも使えるため、隠すと選択肢が不当に狭まる。
  if (industry) query = query.or(`industry.eq.${industry},industry.is.null`)
  if (kind) query = query.eq('kind', kind)
  // 記事と会話は、弱点ではなくジャンル・場面で探すことが多い
  if (genre) query = query.eq('genre', genre)
  if (scene) query = query.eq('scene', scene)
  // 見出しでも引けるようにする。記事は見出しで覚えているため
  if (keyword.trim()) {
    const k = keyword.trim()
    query = query.or(`title.ilike.%${k}%,headline.ilike.%${k}%`)
  }

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
    // 読み上げに使う声の並び(0017)。空なら画面側が既定に丸める
    voiceIds: m.voice_ids ?? [],
    sections,
    // 教材全体で何問あるか(一覧の目安に出す)
    itemCount: sections.reduce((n, sec) => n + sec.items.length, 0),
  }
}

/**
 * 教材を1件、中身ごと読む。
 *
 * 過去の宿題の一覧は、軽くするために**中身を読んでいない**(数だけ)。
 * レッスンで大きく表示するときは中身が要るので、そのときだけ読む。
 */
export async function loadMaterial(materialId) {
  if (!supabase) return ng('Supabase が設定されていません')
  if (!materialId) return ng('教材が指定されていません')

  const { data, error } = await supabase
    .from('materials')
    .select(`
      id, title, level, kind, status, visibility, industry, instruction_ja, created_by, created_at,
      teaching_point, headline, genre, scene, topic, voice_ids,
      material_tags ( tag_id ),
      material_sections (
        id, seq, exercise_type, instruction,
        material_items ( id, seq, prompt_en, prompt_ja, hint, question,
                         answer, answer_alt, audio_text, note, tag_id, speaker,
                         phrases )
      )
    `)
    .eq('id', materialId)
    .maybeSingle()
  if (error) return fail(error, '教材の中身を読めませんでした')
  if (!data) return ng('教材が見つかりませんでした')
  return ok(normalizeMaterial(data))
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
  // 混合ドリルで「この問題はどの弱点か」。単一の弱点の教材では空
  'tag_id',
  // 会話で「誰の発言か」。記事や文型ドリルでは空
  'speaker',
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
      // 本文の要点フレーズ(0015)。**文字ではなく配列なので別に扱う。**
      // 中身の無いものは落とす。空の配列を入れても場所を取るだけ
      const phrases = (Array.isArray(it.phrases) ? it.phrases : [])
        .map((ph) => ({
          text: String(ph?.text ?? '').trim(),
          note: String(ph?.note ?? '').trim(),
        }))
        .filter((ph) => ph.text)
      if (phrases.length) row.phrases = phrases
      return row
    })
    .filter((row) => Object.keys(row).length > 0)

export async function createMaterial({
  title, level, kind, instruction_ja = '', teaching_point = '',
  visibility = 'school', industry = null,
  headline = '', genre = '', scene = '', topic = '', voiceIds = null,
  sections = [], tagIds = [], createdBy,
}) {
  if (!supabase) return ng('Supabase が設定されていません')

  const cleanSections = sections
    .map((sec) => ({ ...sec, items: cleanItems(sec.items) }))
    .filter((sec) => sec.items.length)

  if (!String(title).trim()) return ng('教材名を入れてください')
  if (!cleanSections.length) return ng('設問を1つ以上入れてください')
  // 弱点タグは、あとから教材を見つけるための索引である(第5.5節)。
  // ただし記事と会話は、ジャンル・場面・見出しで探せるので必須にしない。
  // 弱点に紐づかない読み物を作れないと、そもそも作れる幅が狭くなる。
  if (!tagIds.length && !isPassageKind(kind)) {
    return ng('弱点タグを1つ以上選んでください(選ばないと、あとから見つけられません)')
  }

  const { data: material, error: materialError } = await supabase
    .from('materials')
    .insert({
      title: String(title).trim(),
      level, kind,
      instruction_ja: String(instruction_ja).trim() || null,
      teaching_point: String(teaching_point).trim() || null,
      visibility,
      industry: industry || null,
      // 記事・会話のときだけ入る。文型ドリルでは空のまま
      headline: String(headline ?? '').trim() || null,
      genre: genre || null,
      scene: scene || null,
      topic: String(topic ?? '').trim() || null,
      // 読み上げに使う声の並び(0017)。空なら既定(アメリカ英語・女性)
      voice_ids: (voiceIds ?? []).length ? voiceIds : null,
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

  if (tagIds.length) {
    const { error: tagsError } = await supabase
      .from('material_tags')
      .insert(tagIds.map((tag_id) => ({ material_id: material.id, tag_id })))
    if (tagsError) return rollback(`弱点タグを登録できませんでした: ${tagsError.message}`)
  }

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
        id, title, level, kind, instruction_ja, teaching_point, headline, genre, scene, topic,
        voice_ids,
        material_sections (
          id, seq, exercise_type, instruction,
          material_items ( id, seq, prompt_en, prompt_ja, hint, question,
                           answer, answer_alt, audio_text, note, tag_id, speaker,
                           phrases )
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

/**
 * そのゲストに、これまで共有した教材の一覧(トレーナー用)。
 *
 * レッスンの前に「先週何を出したか」「やったか」を見る画面で使う。
 * 見えるのは担当しているゲストの分だけ(RLS が担保する)。
 */
export async function loadLearnerAssignments(learnerId, limit = 50) {
  if (!supabase) return ng('Supabase が設定されていません')

  const { data, error } = await supabase
    .from('assignments')
    .select(`
      id, assigned_at, due_on, learner_done_at, admin_checked_at,
      materials (
        id, title, level, kind, headline, teaching_point, voice_ids,
        material_tags ( tag_id ),
        material_sections ( id, material_items ( id ) )
      )
    `)
    .eq('learner_id', learnerId)
    .order('assigned_at', { ascending: false })
    .limit(limit)
  if (error) return fail(error, '過去の宿題を読めませんでした')

  return ok((data ?? []).map((a) => ({
    ...a,
    material: a.materials
      ? {
        ...a.materials,
        tagIds: (a.materials.material_tags ?? []).map((t) => t.tag_id),
        voiceIds: a.materials.voice_ids ?? [],
        itemCount: (a.materials.material_sections ?? [])
          .reduce((n, sec) => n + (sec.material_items?.length ?? 0), 0),
      }
      : null,
  })))
}

/** ゲストの学習記録のまとめ(取り組んだ量を見るため) */
export async function loadLearnerSummary(learnerId) {
  if (!supabase) return ng('Supabase が設定されていません')

  const { data, error } = await supabase
    .from('study_logs')
    .select('studied_on, minutes, category')
    .eq('user_id', learnerId)
    .order('studied_on', { ascending: false })
    .limit(200)
  if (error) return fail(error, '学習記録を読めませんでした')

  const logs = data ?? []
  return ok({
    days: new Set(logs.map((l) => l.studied_on)).size,
    minutes: logs.reduce((n, l) => n + (Number(l.minutes) || 0), 0),
    lastOn: logs[0]?.studied_on ?? null,
  })
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
  sectionType, count = 10, topic, topics = [], level, industry = '',
  isFirst = false, avoid = [], genre = '', scene = '', subject = '', context = '',
  reviewWords = [],
}) {
  if (!supabase) return ng('Supabase が設定されていません')

  const { data, error } = await supabase.functions.invoke('generate-material', {
    body: {
      sectionType, count, topic, topics, level, industry, isFirst, avoid,
      // 記事のジャンル / 会話の場面 / 話題の指定 / すでに作った本文
      genre, scene, subject, context,
      // 復習として必ず入れる語(単語・フレーズの教材で使う)
      reviewWords,
    },
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

// ── 同じ英文を二度出さない ────────────────────────────────────
//
// 【なぜ2段構えなのか】
//   ① 生成の前に、使った英文をいくつか AI に見せて避けさせる
//      (loadUsedSentences)。これは「なるべく違う文を作らせる」ための
//      誘導であって、保証ではない。AI が指示を外すこともあるし、
//      一度に渡せる数にも限りがある。
//   ② 生成のあとに、データベースへ問い合わせて既出の文を落とす
//      (findUsedSentences)。**保証はこちらが担う。**
//      候補の数だけを問い合わせるので、教材が何万件に増えても効く。
//
//   ②だけでも重複は防げるが、落としてばかりでは問数が足りなくなる。
//   ①で当たりを減らし、②で取りこぼしを止める。

/**
 * 英文を突き合わせ用の形にそろえる。
 *
 * データベースの public.norm_en() と**同じ規則**にしてある
 * (0008_sentence_ledger.sql)。片方だけ変えると、手元の判定と
 * データベースの判定がずれて、片方を素通りする。
 */
export const normEn = (text) =>
  String(text ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/**
 * 1つの設問に含まれる英文をすべて取り出す(そろえた形で)。
 *
 * 提示文・読み上げ文・解答のどれか1つでも既出と一致すれば、
 * その設問は「前に出した文」である。穴埋めの提示文は「___」が
 * 空白に潰れるため、解答文と同じ形になる。
 */
export const sentencesOf = (item) =>
  [item?.prompt_en, item?.audio_text, item?.answer].map(normEn).filter(Boolean)

/** 設問から、そのまま照合に出せる生の英文を取り出す */
export const rawSentencesOf = (item) =>
  [item?.prompt_en, item?.audio_text, item?.answer]
    .map((v) => String(v ?? '').trim()).filter(Boolean)

/**
 * その弱点タグですでに使われている英文を集める(①の誘導用)。
 *
 * 上限をかけている。全部渡すと指示が長くなりすぎるため。
 * 取りこぼしは②で止まるので、ここは網羅していなくてよい。
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

/**
 * 候補の英文のうち、すでに使ったものを返す(②の保証用)。
 *
 *   learnerId … そのゲストに共有済みの教材すべて(弱点を問わない)
 *   tagIds    … 同じ弱点のライブラリ全体(まだ誰にも共有していない分も)
 *
 * 返るのは「そろえた形」の集合なので、normEn() を通したものと突き合わせる。
 */
export async function findUsedSentences(candidates, { learnerId = null, tagIds = null } = {}) {
  if (!supabase || !candidates?.length) return ok(new Set())

  const { data, error } = await supabase.rpc('used_sentences', {
    p_learner: learnerId || null,
    p_tags: tagIds?.length ? tagIds : null,
    p_candidates: candidates,
  })
  if (error) return fail(error, 'すでに使った英文を照合できませんでした')
  return ok(new Set(
    (data ?? []).map((r) => (typeof r === 'string' ? r : r?.used_sentences)).filter(Boolean),
  ))
}

/**
 * 生成した設問から、すでにある英文と同じものを取り除く。
 *
 * usedSet は「そろえた形」の集合。残した設問の英文はその場で
 * usedSet に足す。同じ生成の中で同じ文が二度出るのも防ぐため。
 */
export function dropDuplicates(items, usedSet) {
  const kept = []
  const dropped = []
  for (const it of items ?? []) {
    const keys = sentencesOf(it)
    if (!keys.length) { kept.push(it); continue }
    if (keys.some((k) => usedSet.has(k))) dropped.push(keys[0])
    else { kept.push(it); keys.forEach((k) => usedSet.add(k)) }
  }
  return { kept, dropped }
}

/**
 * 生成にかかる費用の目安。
 *
 * **いま使っているのは Claude Sonnet 5**(100万トークンあたり
 * 入力 $2 / 出力 $10)。**出力には「考えている時間」も含まれる。**
 * 教材づくりの費用は、ほぼ全額がここで決まる(第5.21節)。
 * キャッシュから読んだ分は入力の1割。
 *
 * **モデルを変えたら、ここも必ず変える。**
 * 使うモデルは supabase/functions/generate-material/index.ts の MODEL。
 * 片方だけ変えると、画面に出る金額が実際と食い違う。
 *   Opus 5   … { input: 5, output: 25, cacheRead: 0.5 }
 *   Sonnet 5 … { input: 2, output: 10, cacheRead: 0.2 }
 *   Haiku 4.5… { input: 1, output: 5,  cacheRead: 0.1 }
 */
export const PRICE_PER_MTOK = { input: 2, output: 10, cacheRead: 0.2 }

/** トークン数から、おおよその金額(ドル)を出す */
export const estimateCost = (usage) => {
  if (!usage) return 0
  return ((usage.input ?? 0) * PRICE_PER_MTOK.input
    + (usage.output ?? 0) * PRICE_PER_MTOK.output
    + (usage.cacheRead ?? 0) * PRICE_PER_MTOK.cacheRead) / 1_000_000
}

/**
 * 意味が「近すぎる」と見なす境目。
 *
 * 0〜1 で、1 が同じ意味。**実際の教材で調整する前提の初期値である。**
 * 同じ文法の40問はそもそも構造が似ているため、下げすぎると正しい問題まで
 * 弾いてしまう。上げすぎると「ほぼ同じ」が通る。
 * 変えるときはここ1か所だけを直す(仕様書 第5.16.2節)。
 */
export const SIMILARITY_THRESHOLD = 0.92

/**
 * 候補の英文のうち、意味が近すぎるものを探す(③の保証用)。
 *
 * 0008 の照合は「一字一句同じ」しか見ない。
 * 「I have work to do.」と「I have a job to do.」は素通りする。
 * そこで英文を384個の数値に変換して近さを測る。変換は Supabase の
 * サーバー上で完結するので、文章が外部に出ず、費用もかからない
 * (仕様書 第5.16.2節)。
 *
 * 返るのは [{ index, sentence, matched, similarity }] の並び。
 * index は渡した candidates の何番目か。
 */
export async function findSimilarSentences(candidates, {
  learnerId = null, tagIds = null, threshold = SIMILARITY_THRESHOLD,
} = {}) {
  if (!supabase || !candidates?.length) return ok([])
  if (!learnerId && !tagIds?.length) return ok([])

  const { data, error } = await supabase.functions.invoke('check-similar', {
    body: { candidates, learnerId: learnerId || null, tagIds: tagIds ?? null, threshold },
  })

  if (error) {
    let detail = ''
    try { detail = (await error.context?.json())?.error ?? '' } catch { /* 読めなければ無視 */ }
    if (/Failed to send a request|FunctionsFetchError/i.test(error.message ?? '')) {
      // 配置していない場合と、配置したが関数の中で落ちた場合の両方でここに来る。
      // 落ちると応答に CORS の印が付かず、ブラウザからは区別がつかない。
      // どちらなのかは Supabase の Logs にしか出ないので、そこを案内する。
      return ng('意味の近さを調べる窓口が応答しませんでした。'
        + '関数が CPU の上限(2秒)で止まった可能性があります。'
        + 'Supabase → Edge Functions → check-similar → Logs に '
        + '「CPU Time exceeded」と出ていれば、それです。')
    }
    return ng(detail || `意味の近さを調べられませんでした: ${error.message}`)
  }
  if (data?.error) return ng(data.error)
  return ok(data?.tooSimilar ?? [])
}

/**
 * 1つの演習を、指定の問数がそろうまで作る。
 *
 * 重複で落ちた分は作り直す。落としたまま進むと、40問のはずが
 * 34問になり、「量が定着の条件」という前提が崩れる(第5.13節)。
 * ただし無限には粘らない。同じ弱点で英文が出尽くしていることも
 * あるため、3回試して足りなければ、足りないまま返して画面に出す。
 *
 * 落とし方は3段。
 *   ① 手元で分かる重複(この生成の中の重複・すでに知っている英文)
 *   ② データベースに照合(一字一句同じ英文)
 *   ③ 意味の近さで照合(ほぼ同じ英文)  ← similar が false なら飛ばす
 */
export async function generateSectionUnique(params, {
  usedSet, learnerIds = [], tagIds, similar = true, threshold = SIMILARITY_THRESHOLD,
}) {
  const wanted = params.count
  const items = []
  const tooSimilar = []
  let droppedTotal = 0
  let instruction = ''
  let teachingPoint = null
  let warning = null
  let useSimilar = similar
  const usage = { input: 0, output: 0, cacheRead: 0 }

  for (let attempt = 0; attempt < 3 && items.length < wanted; attempt += 1) {
    const { data, error } = await generateSection({
      ...params,
      count: wanted - items.length,
      avoid: [...usedSet].slice(-120),
    })
    if (error) return { error }
    instruction = instruction || data.section?.instruction || ''
    teachingPoint = teachingPoint || data.teaching_point || null
    // 何回作り直したかも含めて足す。実際に使った分を出すため
    usage.input += data.usage?.input ?? 0
    usage.output += data.usage?.output ?? 0
    usage.cacheRead += data.usage?.cacheRead ?? 0

    // ① 手元で分かる重複
    const { kept, dropped } = dropDuplicates(data.section?.items ?? [], usedSet)
    droppedTotal += dropped.length

    // ② 一字一句同じ英文(データベースに照合)
    //    共有する相手が複数いるときは、**全員ぶん**を見る。
    //    照合は索引が効くので、人数が増えても軽い。
    const candidates = kept.flatMap(rawSentencesOf)
    const used = new Set()
    for (const scope of learnerIds.length ? learnerIds : [null]) {
      const { data: hit, error: lookupError } = await findUsedSentences(candidates, {
        learnerId: scope, tagIds,
      })
      if (lookupError) return { error: lookupError }
      hit.forEach((k) => used.add(k))
    }

    const survived = []
    for (const it of kept) {
      const keys = sentencesOf(it)
      if (keys.some((k) => used.has(k))) {
        droppedTotal += 1
        keys.forEach((k) => usedSet.add(k))   // 二度と候補に出さない
      } else {
        survived.push(it)
      }
    }

    // ③ 意味が近すぎる英文
    let close = new Set()
    if (useSimilar && survived.length) {
      // 1問につき1文だけ照合する。提示文と解答は同じ意味なので、
      // 両方送ると同じ判定を2回することになる。
      const texts = survived.map((it) => rawSentencesOf(it)[0] ?? '')
      // 意味の近さは変換に時間がかかるため、1人ずつは回さない。
      // 相手が1人ならその人、複数ならライブラリ全体(弱点)で見る。
      const { data: hits, error: simError } = await findSimilarSentences(texts, {
        learnerId: learnerIds.length === 1 ? learnerIds[0] : null, tagIds, threshold,
      })
      if (simError) {
        // 窓口が未配置でも生成そのものは止めない。
        // 一字一句の照合(②)は効いているので、重複が素通りするわけではない。
        // ただし黙って続けない。何が効いていないかを画面に出す。
        warning = simError
        useSimilar = false
      }
      for (const h of hits ?? []) {
        close.add(h.index)
        tooSimilar.push(h)
      }
    }

    survived.forEach((it, i) => {
      if (close.has(i)) {
        droppedTotal += 1
        sentencesOf(it).forEach((k) => usedSet.add(k))
      } else if (items.length < wanted) {
        items.push(it)
      }
    })
  }

  return {
    section: { exercise_type: params.sectionType, instruction, items },
    dropped: droppedTotal,
    tooSimilar,
    warning,
    short: wanted - items.length,
    teaching_point: teachingPoint,
    usage,
  }
}
