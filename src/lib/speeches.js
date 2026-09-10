/**
 * スピーチの原稿の出し入れ(0054)。
 *
 * 2026-09 利用者の指定:
 *   > ゲストアカウントのスピーチ内から受け取ったスピーチの原稿をAIにより
 *   > 添削し、そしてその文の音声を作成、ゲスト側で練習できる機能です。
 *   > トレーナー側からもゲスト毎にスピーチを登録できます。
 *
 * 【誰が書けるか】
 *   **ゲスト本人も、担当トレーナー(と管理者)も書ける。**
 *   決まりは 0054 の RLS に置いてあり、画面はそれに合わせるだけである
 *   (**役割の判定を2か所に置かない**・CLAUDE.md)。
 *
 *   `lesson_notes`(0032)とは**ここが違う。** あちらは
 *   トレーナーが書いてゲストに渡す記録なのでゲストは読むだけだが、
 *   こちらは**ゲストが書いたものをトレーナーが直す**ものである。
 *
 * 【0054 を貼る前でも壊れない】
 *   一度断られたら覚えておき、そのあとは呼びに行かない
 *   (`basicWordsSupported()` / `courseSupported()` と同じ作法)。
 *   **スピーチが使えないだけ**で、教材も単語帳もこれまでどおり動く。
 *
 * **例外を外に出さない。** 必ず `{ data, error }` の形で返す
 * (`supabase.js` の決まり)。
 */
import { supabase, withTimeout, TIMEOUT_MARK } from './supabase.js'

const TABLE = 'speeches'

/** 読む列。**1か所にまとめる**(書き写すと、どこかだけ足りなくなる) */
const COLS = 'id, learner_id, title, draft, review, tone, voice_id,'
  + ' created_by, created_at, updated_at'

/**
 * **0054 を貼る前の Supabase には `speeches` が無い。**
 * 一度断られたら覚えておき、そのあとは呼びに行かない。
 */
let noSpeeches = false

/** スピーチの置き場があるか。**画面が欄を出すかどうかの判断に使う** */
export const speechesSupported = () => !noSpeeches

const fail = (e) => {
  const m = String(e?.message ?? e ?? '')
  if (m === TIMEOUT_MARK) return '時間内に返事がありませんでした。通信を確かめてください'
  if (/failed to fetch|load failed|networkerror/i.test(m)) {
    return 'サーバーに届きませんでした。通信を確かめてください'
  }
  if (/relation .* does not exist|42P01|schema cache/i.test(m)) {
    noSpeeches = true
    return 'スピーチの置き場がまだ用意されていません(0054 の SQL を貼ってください)'
  }
  if (/row-level security|violates row-level/i.test(m)) {
    return 'このゲストのスピーチは書けません(担当しているゲストだけ書けます)'
  }
  return m || '失敗しました'
}

/**
 * その人のスピーチを、新しい順に読む。
 *
 * @param learnerId 誰のスピーチか。**省くと自分のもの**
 *   (トレーナーが自分の画面で開いたときは、トレーナー自身のものになる ——
 *   0025 の「トレーナーが自分のために触ったものは自分の記録」と同じ)
 */
export async function loadSpeeches(learnerId = null) {
  if (!supabase || noSpeeches) return { data: [], error: null }
  try {
    let q = supabase.from(TABLE).select(COLS)
      .order('updated_at', { ascending: false }).limit(100)
    /* **誰のものかを必ず絞る。** 絞らないと、RLS が通す範囲
       (担当ゲスト全員)がまとめて出てくる —— レッスンは画面を
       共有しながら行うので、**他のゲストのスピーチが映る**(仕様書 5.5) */
    if (learnerId) q = q.eq('learner_id', learnerId)
    else {
      const { data: who } = await supabase.auth.getUser()
      const me = who?.user?.id
      if (!me) return { data: [], error: null }
      q = q.eq('learner_id', me)
    }
    const { data, error } = await withTimeout(q)
    if (error) return { data: [], error: fail(error) }
    return { data: data ?? [], error: null }
  } catch (e) {
    return { data: [], error: fail(e) }
  }
}

/**
 * 新しいスピーチを1本置く。
 *
 * **`learner_id` は呼ぶ側が決める。** トレーナーがゲストのページから
 * 置けば、そのゲストのスピーチになる(利用者の指定
 * 「トレーナー側からもゲスト毎にスピーチを登録できます」)。
 */
export async function createSpeech({ learnerId = null, title = '', draft = '', voiceId = null }) {
  if (!supabase) return { data: null, error: 'Supabase に接続していません' }
  try {
    const { data: who } = await supabase.auth.getUser()
    const me = who?.user?.id
    if (!me) return { data: null, error: 'ログインしていません' }
    const { data, error } = await withTimeout(
      supabase.from(TABLE)
        .insert({
          learner_id: learnerId || me,
          title: String(title ?? ''),
          draft: String(draft ?? ''),
          voice_id: voiceId || null,
          /* **置いた人は必ず自分。** 0054 の `with check` がそう決めている
             (他人の名前で置かせない・`lesson_notes` と同じ作法) */
          created_by: me,
        })
        .select(COLS)
        .single(),
    )
    if (error) return { data: null, error: fail(error) }
    return { data, error: null }
  } catch (e) {
    return { data: null, error: fail(e) }
  }
}

/**
 * 1本を書き直す。**送った欄だけが変わる。**
 *
 * `updated_at` は送らない。**端末の時計で決めない**(0054 の trigger が入れる)。
 */
export async function saveSpeech(id, patch = {}) {
  if (!supabase) return { data: null, error: 'Supabase に接続していません' }
  if (!id) return { data: null, error: 'どのスピーチか分かりません' }
  const row = {}
  if ('title' in patch) row.title = String(patch.title ?? '')
  if ('draft' in patch) row.draft = String(patch.draft ?? '')
  if ('review' in patch) row.review = patch.review ?? null
  if ('tone' in patch) row.tone = patch.tone ?? null
  if ('voiceId' in patch) row.voice_id = patch.voiceId || null
  if (!Object.keys(row).length) return { data: null, error: null }
  try {
    const { data, error } = await withTimeout(
      supabase.from(TABLE).update(row).eq('id', id).select(COLS).single(),
    )
    if (error) return { data: null, error: fail(error) }
    return { data, error: null }
  } catch (e) {
    return { data: null, error: fail(e) }
  }
}

/**
 * 1本を消す。
 *
 * **RLS は「消せない」を error ではなく「0件」で返す**(CLAUDE.md)。
 * 返った行数を見て、0件なら失敗として返す ——
 * **成功と失敗を、同じ見た目で終わらせない。**
 */
export async function deleteSpeech(id) {
  if (!supabase) return { data: null, error: 'Supabase に接続していません' }
  if (!id) return { data: null, error: 'どのスピーチか分かりません' }
  try {
    const { data, error } = await withTimeout(
      supabase.from(TABLE).delete().eq('id', id).select('id'),
    )
    if (error) return { data: null, error: fail(error) }
    if (!(data ?? []).length) {
      return { data: null, error: 'このスピーチは消せませんでした(権限がありません)' }
    }
    return { data: data[0], error: null }
  } catch (e) {
    return { data: null, error: fail(e) }
  }
}
