/**
 * **ゲストごとの「出すもの」の読み書き**(0055)。
 *
 * 一覧と判断は `src/data/learnerFeatures.js` にある。
 * ここは Supabase を引き連れているので、**素の node で一度も
 * 走らせられない**(`goals.js` / `readAloud.js` と同じ)。
 * **判断をここに書かない。**
 *
 * 【0055 を貼る前でも壊れない】
 *
 *   表が無ければ「1つも開いていない」として返す。
 *   つまり**既定のまま(講座は出ない)**で、ほかは何も変わらない。
 *   一度断られたら覚えておき、そのあとは呼びに行かない
 *   (`weeklyGoalSupported()` / `courseSupported()` と同じ作法)。
 *
 * 例外は投げず、必ず { data, error } の形で返す。
 */
import { supabase } from './supabase.js'

const ok = (data) => ({ data, error: null })
const ng = (error) => ({ data: null, error })

/** 何も開いていないとき。**画面はこれを「既定」として読む** */
export const NO_FEATURES = new Set()

let supported = true
export function learnerFeaturesSupported() { return supported }

/** 表がまだ無い、という断りか(貼る前) */
function missing(error) {
  const s = `${error?.code ?? ''} ${error?.message ?? ''}`
  return /42P01|PGRST205|PGRST202|42883|does not exist|schema cache|Could not find/i.test(s)
}

/**
 * その人に開いているものを読む。
 *
 * @param learnerId 誰のぶんか。**省くと自分**(ゲストが自分の画面で読む道)
 * @returns `Set`(開いているものの id だけ)
 */
export async function loadLearnerFeatures(learnerId = null) {
  if (!supabase || !supported) return ok(new Set())
  let q = supabase.from('learner_features').select('feature, enabled')
  // **自分のぶんは、RLS に任せて絞らない** ——
  // ログインしている人の id をここで組み立てると、道が2つになる
  if (learnerId) q = q.eq('learner_id', learnerId)
  const { data, error } = await q
  if (error) {
    if (missing(error)) supported = false
    // **騒がない。** 読めなければ既定(何も開いていない)である
    return ok(new Set())
  }
  const on = new Set()
  for (const r of data ?? []) if (r?.enabled) on.add(r.feature)
  return ok(on)
}

/**
 * 出す / 出さないを決める(担当トレーナーと管理者だけ)。
 *
 * **門番は `set_learner_feature()` の中**(0055)。画面に持たせない。
 */
export async function setLearnerFeature(learnerId, feature, on) {
  if (!supabase) return ng(new Error('Supabase が設定されていません'))
  if (!learnerId) return ng(new Error('ゲストが決まっていません'))
  if (!feature) return ng(new Error('出すものが決まっていません'))
  const { error } = await supabase.rpc('set_learner_feature', {
    p_learner: learnerId,
    p_feature: feature,
    p_on: !!on,
  })
  if (error) {
    if (missing(error)) {
      supported = false
      return ng(new Error(
        'ゲストごとに出すものを決める仕組み(0055)が、まだ入っていません。'
        + 'Supabase の SQL Editor に supabase/apply/pending_matome.sql を貼ってください。',
      ))
    }
    return ng(error)
  }
  return ok(true)
}
