/**
 * **週の目標**と、**Quick Response の続けた記録**(0042)。
 *
 * 2026-09 利用者の指定(ゲーミフィケーション)。
 *
 *   > 続けた記録を QR にも
 *   > 週の目標と、達成の印
 *
 * ============================================================================
 * 【なぜ「週」なのか】
 *
 *   日ごとの連続記録は、**1日休んだ瞬間に途切れる。**
 *   そして途切れたことが、そのままやめる理由になる。
 *   このスクールは**週2回のレッスン**に合わせて宿題を出しているので、
 *   毎日やる前提そのものが合っていない。
 *   単語帳が 0019 でそうしているのと**まったく同じ考え方**である。
 *
 * 【目標を決めるのはトレーナー。ゲストではない】
 *
 *   **自分で下げられる目標は、目標にならない。**
 *   だから `set_weekly_goal()` は担当トレーナー(と管理者)だけが呼べる。
 *   ゲストは読めるが書けない。**判定は SQL の中**(0042)であって、
 *   画面には持たせない —— 2か所に置くと必ず食い違う。
 *
 * 【0042 を貼る前でも壊れない】
 *
 *   関数が無ければ**そのまま「決めていない」として返す。**
 *   目標が出ないだけで、単語帳も Quick Response もこれまでどおり動く。
 *   一度断られたら覚えておき、そのあとは呼びに行かない
 *   (`qrReviewSupported()` と同じ作法)。
 *
 * 【言葉と算段は `gamify.js` にある】
 *
 *   `goalPart()` / `goalLine()` はこのファイルに置かない。
 *   ここは Supabase を引き連れているので、**素の node で一度も
 *   走らせられない**(`readAloud.js` と同じ)。
 *   だから**判断だけを、何にも依存しない形へ出してある**
 *   (`playMark.js` / `mp3Join.js` と同じ考え方)。
 *
 * 例外は投げず、必ず { data, error } の形で返す。
 */
import { supabase } from './supabase.js'

const ok = (data) => ({ data, error: null })
const ng = (error) => ({ data: null, error })

/** 目標が無いときの形。**画面はこれを何も出さない印として読む** */
export const NO_GOAL = { wordsGoal: 0, wordsDone: 0, sentGoal: 0, sentDone: 0 }

/** 週の続き具合が無いときの形 */
export const NO_WEEK = { days: 0, answered: 0, correct: 0, weeks: 0 }

/**
 * **0042 を貼る前は、二度と呼びに行かない。**
 * 断られるたびに窓口を叩いても、貼るまで直らない
 * (「外部の窓口を自動で呼ぶものには、止まる条件を持たせる」・CLAUDE.md)。
 */
let supported = true
export function weeklyGoalSupported() { return supported }

/** 関数がまだ無い、という断りか(貼る前) */
function missing(error) {
  const s = `${error?.code ?? ''} ${error?.message ?? ''}`
  return /PGRST202|42883|does not exist|Could not find the function/i.test(s)
}

/**
 * Quick Response の続き具合(0042 の `qr_week`)。
 * 単語帳の `loadVocabWeek()` と**同じ形**を返す。
 *
 * @param learnerId 誰のぶんか。省くと自分
 */
export async function loadQrWeek(learnerId = null) {
  if (!supabase) return ok(NO_WEEK)
  const { data, error } = await supabase.rpc('qr_week', { p_learner: learnerId })
  // 貼る前でも画面は出す。**数が出ないだけで、復習はできる**
  if (error) return ok(NO_WEEK)
  return ok((Array.isArray(data) ? data[0] : data) ?? NO_WEEK)
}

/**
 * 週の目標と、今週やった数(0042 の `weekly_goal`)。
 * **数え方は DB に置く。** 画面で足し直さない。
 */
export async function loadWeeklyGoal(learnerId = null) {
  if (!supabase || !supported) return ok(NO_GOAL)
  const { data, error } = await supabase.rpc('weekly_goal', { p_learner: learnerId })
  if (error) {
    if (missing(error)) supported = false
    return ok(NO_GOAL)
  }
  const r = (Array.isArray(data) ? data[0] : data) ?? {}
  return ok({
    wordsGoal: Number(r.words_goal) || 0,
    wordsDone: Number(r.words_done) || 0,
    sentGoal: Number(r.sent_goal) || 0,
    sentDone: Number(r.sent_done) || 0,
  })
}

/**
 * 週の目標を決める(トレーナー・管理者だけ)。
 *
 * **0 は「決めていない」。** 消す道を別に作らない ——
 * 0 にすれば目標そのものが画面から消える。
 */
export async function setWeeklyGoal(learnerId, words = 0, sentences = 0) {
  if (!supabase) return ng(new Error('Supabase が設定されていません'))
  if (!learnerId) return ng(new Error('ゲストが決まっていません'))
  const { error } = await supabase.rpc('set_weekly_goal', {
    p_learner: learnerId,
    p_words: Math.max(0, Math.round(Number(words) || 0)),
    p_sentences: Math.max(0, Math.round(Number(sentences) || 0)),
  })
  if (error) {
    if (missing(error)) {
      supported = false
      return ng(new Error('週の目標の仕組み(0042)が、まだ入っていません'))
    }
    return ng(error)
  }
  return ok(true)
}
