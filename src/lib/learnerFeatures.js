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
 * **その1つを出しているゲスト**を引く(2026-09 利用者の指定)。
 *
 *   > 業種別の単語帳を指定したゲストに、トレーナーアカウントの
 *   > 業種別単語帳から…アサインする方法を実装してください。
 *
 * ゲストのページからは1人ずつ決められるが(`loadLearnerFeatures`)、
 * **単語帳の側から見るときは「この1冊を、誰に出しているか」**が要る。
 *
 * **絞るのは `feature` だけ。** 誰のぶんが返るかは **RLS が決める**
 * (0055「自分と担当トレーナーが見る」)ので、
 * **画面にもここにも、担当かどうかの判定を書かない**
 * —— 判定を2か所に置くと、必ず食い違う(CLAUDE.md)。
 *
 * @returns `Set`(出しているゲストの id だけ)
 */
export async function loadFeatureLearners(feature) {
  if (!supabase || !supported || !feature) return ok(new Set())
  const { data, error } = await supabase
    .from('learner_features')
    .select('learner_id, enabled')
    .eq('feature', feature)
  if (error) {
    if (missing(error)) supported = false
    // **騒がない。** 読めなければ既定(誰にも出していない)である
    return ok(new Set())
  }
  const on = new Set()
  for (const r of data ?? []) if (r?.enabled) on.add(r.learner_id)
  return ok(on)
}

/** 0059 より前の窓口が、自分のぶんを断ったときの言い方 */
const NOT_MINE = /このゲストの担当ではありません/

/**
 * 出す / 出さないを決める(担当トレーナーと管理者だけ)。
 *
 * **門番は `set_learner_feature()` の中**(0055)。画面に持たせない。
 *
 * @param self 自分自身のぶんか(0059)。**断り方を読み替えるためだけに使う**
 *             —— 通す / 通さないを決めるのは、あくまで SQL の側である
 */
export async function setLearnerFeature(learnerId, feature, on, { self = false } = {}) {
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
    /* **窓口が古いことを、そのまま出さない**(CLAUDE.md
       「そのまま出すと誤診させる」・`reviewWriting()` と同じ作法)。
       0059 より前の `set_learner_feature()` は自分のぶんを知らないので、
       **「このゲストの担当ではありません」**と断る。ところが相手は自分で、
       自分の担当かどうかを疑わせても直しようがない ——
       貼る SQL が届いていないことのほうを言う */
    if (self && NOT_MINE.test(`${error?.message ?? ''}`)) {
      return ng(new Error(
        '自分自身に単語帳を出す仕組み(0059)が、まだ入っていません。'
        + 'Supabase の SQL Editor に supabase/apply/pending_matome.sql を貼ってください。',
      ))
    }
    return ng(error)
  }
  return ok(true)
}
