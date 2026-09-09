/**
 * 文法30日集中講座の進み具合を、読み書きする(0052)。
 *
 * **入れ物は1つだけ**(`course_days`)。ゲスト × 段 × 日で1行で、
 * 「終えた」ことしか持たない ——
 * 講座は測るためのものではなく、順にたどるためのものである。
 *
 * **0052 を貼る前でも壊れない。** 一度断られたら覚えておき、
 * そのあとは呼びに行かない(`weeklyGoalSupported()` と同じ作法)。
 * 進み具合が残らないだけで、30日の中身も単語もそのまま見られる。
 */
import { supabase } from './supabase.js'

const ok = (data) => ({ data, error: null })
const ng = (error) => ({ data: null, error })

/**
 * **0052 がまだのときは、二度と呼びに行かない。**
 * 開くたびに断られ続けるのを避ける(残高切れの先読みと同じ考え方)。
 */
let supported = true
export const courseSupported = () => supported

/** その表・その関数がまだ無い、という断りか */
const missing = (e) => /course_days|course_progress|does not exist|schema cache/i
  .test(`${e?.message ?? ''} ${e?.details ?? ''} ${e?.hint ?? ''}`)

/**
 * 終えた日の番号を読む。
 *
 * @param course 'core' | 'full'
 * @param learnerId 誰の記録か(省くと自分)
 * @returns {number[]} 終えた日(小さい順)
 */
export async function loadCourseDays(course, learnerId = null) {
  if (!supabase || !supported) return ok([])
  const { data, error } = await supabase.rpc('course_progress', {
    p_learner: learnerId, p_course: course,
  })
  if (error) {
    if (missing(error)) { supported = false; return ok([]) }
    return ng('講座の進み具合を読めませんでした')
  }
  return ok((data ?? []).map((r) => Number(r.day)).filter(Number.isInteger))
}

/**
 * その日を「終えた」ことにする。
 *
 * **書けるのは本人だけ**(0052 の RLS)。トレーナーが代わりに
 * 終えたことにする道は作らない —— 講座はゲストが自分で進めるものである。
 *
 * **同じ日を二度押しても増えない**(主キーで弾かれるだけ)。
 */
export async function markCourseDay(course, day, learnerId) {
  if (!supabase) return ng('Supabase が設定されていません')
  if (!supported) return ng('講座の進み具合の置き場(0052)が、まだ Supabase にありません。'
    + ' GitHub のリポジトリにあるファイル(supabase/apply/pending_matome.sql)を、'
    + 'Supabase の 左メニュー「SQL Editor」で実行してください'
    + '(教材・宿題・ゲストの情報には触れない SQL です)。')
  if (!learnerId) return ng('ログインしていません')

  const { error } = await supabase
    .from('course_days')
    .insert({ learner_id: learnerId, course, day: Number(day) })
  if (error) {
    // すでに終えている(主キーの重なり)。**失敗にしない**
    if (error.code === '23505') return ok(true)
    if (missing(error)) { supported = false; return ng('講座の進み具合の置き場(0052)が、まだ Supabase にありません。') }
    return ng('終えた記録を残せませんでした')
  }
  return ok(true)
}

/** 終えた印を外す(押し間違いを戻せるようにする。**行き止まりを作らない**) */
export async function unmarkCourseDay(course, day, learnerId) {
  if (!supabase || !supported || !learnerId) return ok(true)
  const { error } = await supabase
    .from('course_days').delete()
    .eq('learner_id', learnerId).eq('course', course).eq('day', Number(day))
  if (error) return ng('終えた記録を外せませんでした')
  return ok(true)
}
