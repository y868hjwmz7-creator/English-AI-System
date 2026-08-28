/**
 * 語彙の定着(意味の表示 / 知っていた・知らなかった / 復習)。
 *
 * 【考え方】
 *   宿題に出てきた語がそのまま流れていくのを止める。
 *   ゲストが本文の語に触れると意味が出て、その場で
 *   「知っていた / 知らなかった」を選べる。選んだものは残り、
 *   **次に同じ教材を開いても色が付いたまま**になる。
 *   トレーナーは、その「知らなかった」を材料に単語の教材を作る。
 *
 * 【意味はどこから来るか】
 *   スクール全体で共有する控え(word_glosses)から。無ければ
 *   Edge Function(lookup-word)が1語だけ AI に尋ね、控えに残す。
 *   **同じ語に二度払わない。** 2人目以降は無料で出る。
 *
 * 例外は投げず、必ず { data, error } の形で返す。
 */
import { supabase } from './supabase.js'

const ok = (data) => ({ data, error: null })
const ng = (error) => ({ data: null, error })
const fail = (e, fallback) => ng(e?.message ? `${fallback}: ${e.message}` : fallback)

/**
 * 語のそろえ方。
 *
 * **データベースの `public.norm_word()` と、Edge Function の `normWord()` と、
 * ここの3か所で同じ規則にする。** ずれると控えを引き当てられず、
 * 同じ語を何度も AI に尋ねることになる(費用が増える)。
 */
export const normWord = (text) =>
  String(text ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9'-]+/g, ' ')
    .trim()
    .replace(/^[\s'-]+|[\s'-]+$/g, '')

/** 英文を「語」と「語でないもの」に分ける。区切りもそのまま残す */
export function splitWords(text) {
  const parts = []
  const re = /[A-Za-z][A-Za-z'-]*/g
  let last = 0
  let m = re.exec(text ?? '')
  while (m) {
    if (m.index > last) parts.push({ word: false, text: text.slice(last, m.index) })
    parts.push({ word: true, text: m[0], norm: normWord(m[0]) })
    last = m.index + m[0].length
    m = re.exec(text)
  }
  if (last < (text ?? '').length) parts.push({ word: false, text: text.slice(last) })
  return parts
}

/**
 * 意味と品詞を引く。**その文でふさわしい意味が先頭**で返る。
 *
 * 控えの鍵は「語 + 出てきた文」の組である。文の指紋の作り方は
 * 窓口(lookup-word)の中にしかないので、**画面からは控えを直接読まない。**
 * 同じ規則を4か所目に増やすと、必ずずれる(第5.23.7節)。
 *
 * 窓口は、控えにあればそれを返す(費用なし)。無ければ1語だけ引いて残す。
 */
export async function lookupWord({ word, sentence = '', level = 'B1' }) {
  const norm = normWord(word)
  if (!norm) return ng('英語の語ではありません')
  if (!supabase) return ng('Supabase が設定されていません')

  const { data, error } = await supabase.functions.invoke('lookup-word', {
    body: { word, sentence, level },
  })
  if (error) {
    let detail = ''
    try { detail = (await error.context?.json())?.error ?? '' } catch { /* 読めなければ無視 */ }
    if (/Failed to send a request|FunctionsFetchError/i.test(error.message ?? '')) {
      return ng('意味を調べる窓口につながりませんでした。'
        + 'Supabase に lookup-word を配置したか確認してください。')
    }
    return ng(detail || `調べられませんでした: ${error.message}`)
  }
  if (data?.error) return ng(data.error)
  if (!data?.gloss) return ng('意味を読み取れませんでした')
  return ok(withSenses(data.gloss))
}

/**
 * 控えの形をそろえる。
 * 0012 より前に作った控えは `senses` を持たない。古い列から組み立てる。
 */
function withSenses(gloss) {
  const senses = Array.isArray(gloss?.senses) && gloss.senses.length
    ? gloss.senses
    : [{
      pos: gloss?.pos ?? '',
      meaning_ja: gloss?.meaning_ja ?? '',
      example_en: gloss?.example_en ?? '',
      note: gloss?.note ?? '',
    }].filter((x) => x.meaning_ja)
  return { ...gloss, senses, phonetic: gloss?.phonetic ?? null }
}

// ── 知っていた / 知らなかった ────────────────────────────────

/**
 * 自分(ゲスト)が付けた語の状態をすべて読む。
 * 画面を開いたときに1回だけ呼び、あとは手元で持つ。
 * 語ごとに問い合わせると、1画面で何十回も往復することになる。
 */
export async function loadMyWordStatuses() {
  if (!supabase) return ok(new Map())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return ok(new Map())

  const { data, error } = await supabase
    .from('word_reviews').select('word_norm, status').eq('learner_id', user.id)
  if (error) return fail(error, '語の記録を読めませんでした')
  return ok(new Map((data ?? []).map((r) => [r.word_norm, r.status])))
}

/** 「知っていた」「知らなかった」を付ける。同じ語は上書きする */
export async function setWordStatus(word, status, materialId = null) {
  const norm = normWord(word)
  if (!norm) return ng('英語の語ではありません')
  if (!supabase) return ng('Supabase が設定されていません')
  if (!['known', 'unknown'].includes(status)) return ng('状態が正しくありません')

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return ng('ログインが必要です')

  const { error } = await supabase.from('word_reviews').upsert({
    learner_id: user.id,
    word_norm: norm,
    status,
    material_id: materialId,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'learner_id,word_norm' })
  if (error) return fail(error, '記録できませんでした')
  return ok(norm)
}

/** 付けた記録を取り消す(間違えて押したとき) */
export async function clearWordStatus(word) {
  const norm = normWord(word)
  if (!norm || !supabase) return ng('取り消せませんでした')
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return ng('ログインが必要です')
  const { error } = await supabase
    .from('word_reviews').delete().eq('learner_id', user.id).eq('word_norm', norm)
  if (error) return fail(error, '取り消せませんでした')
  return ok(norm)
}

// ── トレーナーが復習の材料を集める ────────────────────────────

/** そのゲストが「知らなかった」と付けた語(意味付き、新しい順) */
export async function loadReviewWords(learnerId, { status = 'unknown', limit = 40 } = {}) {
  if (!supabase) return ng('Supabase が設定されていません')
  if (!learnerId) return ok([])
  const { data, error } = await supabase.rpc('review_words', {
    p_learner: learnerId, p_status: status, p_limit: limit,
  })
  if (error) return fail(error, '復習する語を読めませんでした')
  return ok(data ?? [])
}

/** これまで配信した教材に出てきた語句(単語・フレーズ・語句の演習から) */
export async function loadHomeworkWords(learnerId, { limit = 200 } = {}) {
  if (!supabase) return ng('Supabase が設定されていません')
  if (!learnerId) return ok([])
  const { data, error } = await supabase.rpc('homework_words', {
    p_learner: learnerId, p_limit: limit,
  })
  if (error) return fail(error, '宿題に出た語を読めませんでした')
  return ok(data ?? [])
}

/**
 * 復習の材料をまとめる。
 *
 * **優先順位を決めておく。** 何を混ぜるかが人によって変わると、
 * 「体系立てて復習する」ことにならない。
 *
 *   1. 知らなかったと付けた語(いちばん強い手がかり)
 *   2. 宿題に出たが、まだ何も付けていない語
 *   3. 知っていたと付けた語は**混ぜない**(復習の必要が薄い)
 *
 * 同じ語は1回だけ。新しい順に並べる。
 */
export async function collectReviewWords(learnerId, { limit = 20 } = {}) {
  const [{ data: unknownWords, error: e1 }, { data: homework, error: e2 }] =
    await Promise.all([
      loadReviewWords(learnerId, { status: 'unknown', limit: 200 }),
      loadHomeworkWords(learnerId, { limit: 200 }),
    ])
  if (e1) return ng(e1)
  if (e2) return ng(e2)

  const picked = []
  const seen = new Set()
  const add = (word, source) => {
    const norm = normWord(word.display ?? word.word_norm)
    if (!norm || seen.has(norm)) return
    seen.add(norm)
    picked.push({
      word: word.display ?? word.word_norm,
      meaning: word.meaning_ja ?? '',
      source,
    })
  }

  for (const w of unknownWords ?? []) add(w, 'unknown')
  for (const w of homework ?? []) {
    if (w.status === 'known') continue   // 知っていた語は混ぜない
    add(w, w.status === 'unknown' ? 'unknown' : 'seen')
  }
  return ok(picked.slice(0, limit))
}
