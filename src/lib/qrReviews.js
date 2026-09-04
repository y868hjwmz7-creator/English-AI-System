/**
 * Quick Response の復習 — 「まだ」を押した文を溜め、あとから出し直す(0040)。
 *
 * 【なぜ要るか】(2026-09 利用者の指定)
 *
 *   > 教材の中で取り組んだ Quick Response の中で「まだ」を押したものは、
 *   > Quick Response という復習用の機能を独立して作り、
 *   > ひとつのアカウントにつきひとつ持たせてください。
 *   > 「まだ」「おぼえかけ」の仕組みは同じです。
 *
 *   これまでは「記録は残さない」と決めていた(単語帳の箱と2か所で
 *   動くのを避けるため)。**利用者の指定で、この決まりを変える。**
 *   単語帳が**語**に対してしていることを、こちらは**文**に対してする。
 *   溜まる先が違うので、同じものが2か所で動くことにはならない。
 *
 * 【溜めるのは「文章」だけ】(利用者の指定)
 *   単語・フレーズ(`group === 'word'`)は**単語帳**が持つ。
 *   ここへは入れない。**同じ語の覚え具合を2か所で動かさない。**
 *
 * 【鍵は「そろえた英文」】
 *   `material_items` の id ではない。Quick Response の1問は
 *   「1項目を文でほどいたもの」なので、**文の切り方を直すと番号がずれる。**
 *   英文そのものを鍵にすれば、決まりが変わってもずれない。
 *   おまけに**教材をまたいで1つにまとまる**(利用者の指定)。
 *
 *   そろえ方は **`normEn()`(`materials.js`)をそのまま使う。**
 *   データベース側にも同じ規則の `norm_en()`(0008)がある。
 *   **同じことをする規則を2つ持たない**(語のそろえ方で懲りた)。
 *
 * 【間隔の決まりは、画面に持たない】
 *   何日後に出すかは `mark_qr()`(SQL)が決める。単語帳とまったく同じ
 *   数字(卒業25回・休み30日)である。**2か所に持たない。**
 *
 * 例外は投げず、必ず { data, error } の形で返す。
 */
import { supabase } from './supabase.js'
import { normEn } from './materials.js'

const ok = (data) => ({ data, error: null })
const ng = (error) => ({ data: null, error })
const fail = (e, fallback) => ng(e?.message ? `${fallback}: ${e.message}` : fallback)

export { normEn }

/**
 * **0040 をまだ貼っていない Supabase では、何も起きない。**
 *
 * 貼る前に「まだ」を押しても、赤い知らせを出したりはしない
 * (押しているのは Quick Response のボタンで、溜めるのは裏の仕事である)。
 * **一度気づいたら覚えておき、そのあとは呼びに行かない。**
 * 呼ぶたびに待たされるほうが害が大きい。
 */
let notReady = false

/** 0040 が入っているか。画面がボタンや札を出すかどうかの判断に使う */
export const qrReviewSupported = () => !notReady

const missing = (error) => /qr_reviews|mark_qr|qr_items|drop_qr|schema cache|PGRST202|does not exist/i
  .test(`${error?.message ?? ''} ${error?.code ?? ''}`)

/**
 * 1問を溜める / 箱を動かす。
 *
 * @param {object} pair `{ en, ja, speaker }`(`quickResponsePairs()` の1件)
 * @param {'unknown'|'learning'|'known'} status
 *   `unknown` = まだ / `learning` = 言える / `known` = もう出さない
 * @param {object} opts
 *   - `materialId` … 最初に出会った教材(絞り込みの手がかり)
 *   - `learnerId`  … **誰の記録にするか**(0025 と同じ考え方)。
 *     トレーナーがゲストのページで押したときは、そのゲストの id。
 *     渡さなければログインしている本人のもの
 *   - `onlyExisting` … **すでに溜まっている文だけ**を動かす。
 *     教材の中で「言えた」を押したときに使う(新しく溜めない)
 */
export async function markQr(pair, status, {
  materialId = null, learnerId = null, onlyExisting = false,
} = {}) {
  if (!supabase || notReady) return ok(null)
  const en = String(pair?.en ?? '').trim()
  const ja = String(pair?.ja ?? '').trim()
  if (!en || !ja || !normEn(en)) return ok(null)
  if (!['unknown', 'learning', 'known'].includes(status)) return ng('状態が正しくありません')

  const { data, error } = await supabase.rpc('mark_qr', {
    p_en: en,
    p_ja: ja,
    p_status: status,
    p_material: materialId,
    p_speaker: pair?.speaker || null,
    // **0040 より前の関数は無いので、そもそも呼べない。**
    // 渡さないときは既定(自分)になる
    ...(learnerId ? { p_learner: learnerId } : {}),
    ...(onlyExisting ? { p_only_existing: true } : {}),
  })
  if (error) {
    // **貼る前は静かに何もしない**(押した本人には Quick Response が
    // ふつうに進む。溜まらないだけである)
    if (missing(error)) { notReady = true; return ok(null) }
    return fail(error, '復習に残せませんでした')
  }
  return ok((Array.isArray(data) ? data[0] : data) ?? null)
}

/**
 * 復習に出す文を読む。
 *
 * `qr_items()` は本人・担当トレーナー・管理者だけが呼べる(SQL 側で確かめる)。
 * **画面側で役割を判定しない。** 必ず食い違う。
 *
 * @param {string} learnerId 誰の復習か。渡さなければログインしている本人
 * @param {object} opts `{ status, limit, dueOnly }`
 *   `status` は `'todo'`(まだ + 言えかけ)/ `'unknown'` / `'learning'` / `'known'`
 */
export async function loadQrReviews(learnerId = null, {
  status = 'todo', limit = 200, dueOnly = false,
} = {}) {
  if (!supabase || notReady) return ok([])
  let who = learnerId
  if (!who) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return ok([])
    who = user.id
  }
  const { data, error } = await supabase.rpc('qr_items', {
    p_learner: who, p_status: status, p_limit: limit, p_due_only: dueOnly,
  })
  if (error) {
    if (missing(error)) { notReady = true; return ok([]) }
    return fail(error, '復習を読めませんでした')
  }
  return ok(data ?? [])
}

/**
 * 復習から外す(間違えて溜めたとき)。
 * **消す道を必ず用意する。** 溜まる一方だと、押し間違えた1問が出続ける。
 */
export async function dropQr(en, { learnerId = null } = {}) {
  if (!supabase || notReady) return ok(null)
  const { error } = await supabase.rpc('drop_qr', {
    p_en: String(en ?? ''),
    ...(learnerId ? { p_learner: learnerId } : {}),
  })
  if (error) {
    if (missing(error)) { notReady = true; return ok(null) }
    return fail(error, '外せませんでした')
  }
  return ok(true)
}

/**
 * 復習の進み具合。**終わりが見えないと続かない**(単語帳と同じ)。
 *
 * `qr_items()` を1回呼んで数える。行を読むことになるが、
 * 開いたときの1回だけである(単語帳の担当ゲストぶんと同じ作法)。
 */
export async function loadQrCounts(learnerId = null) {
  const empty = { due: 0, unknown: 0, learning: 0, total: 0 }
  const { data, error } = await loadQrReviews(learnerId, { status: 'todo', limit: 500 })
  if (error) return ok(empty)
  const list = data ?? []
  const today = new Date().toISOString().slice(0, 10)
  return ok({
    due: list.filter((r) => String(r.due_on ?? '').slice(0, 10) <= today).length,
    unknown: list.filter((r) => r.status !== 'learning').length,
    learning: list.filter((r) => r.status === 'learning').length,
    total: list.length,
  })
}

/**
 * 溜めた行を、Quick Response の1問の形に直す。
 *
 * **画面は「教材から来た問」と「復習から来た問」を区別しない。**
 * 同じ形にしておけば、出し方(`QuickResponse` の描き方)を書き写さずに済む。
 */
export const qrPairOf = (row) => ({
  en: row?.en ?? '',
  ja: row?.ja ?? '',
  speaker: row?.speaker ?? '',
  from: row?.material_title ?? '',
  group: 'sentence',
  key: row?.en_norm ?? row?.en ?? '',
  // 絞り込みに使う手がかり(`WordbookFilter` と同じ名前でそろえる)
  material_title: row?.material_title ?? null,
  material_industry: row?.material_industry ?? null,
  material_genre: row?.material_genre ?? null,
  material_scene: row?.material_scene ?? null,
  added_at: row?.added_at ?? null,
  status: row?.status ?? 'unknown',
  box: row?.box ?? 0,
  learn_streak: row?.learn_streak ?? 0,
  due_on: row?.due_on ?? null,
})

/**
 * 並べ方は2通り(2026-09 利用者の指定「2つを選べるようにしたいです」)。
 *
 *   ・**混ぜる** … 並び順で覚えてしまうのを防ぐ(単語帳と同じ考え方)
 *   ・**教材の順** … 記事と会話には話の流れがある(教材の中の Quick Response と同じ)
 *
 * 復習は教材をまたいで溜まるので、**どちらが良いかは人による。**
 * だから選べるようにする。
 */
export const QR_ORDERS = [
  { id: 'shuffle', label: '混ぜる' },
  { id: 'material', label: '教材の順' },
]

/** 並べ替える。`shuffle` は呼ぶたびに違う並びになる */
export function orderQrPairs(list, order) {
  const rows = [...(list ?? [])]
  if (order === 'material') {
    // 教材ごとにまとめ、その中は溜まった順。**話の流れが戻る**
    return rows.sort((a, b) => {
      const t = String(a.material_title ?? '').localeCompare(String(b.material_title ?? ''), 'ja')
      if (t !== 0) return t
      return String(a.added_at ?? '').localeCompare(String(b.added_at ?? ''))
    })
  }
  for (let i = rows.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[rows[i], rows[j]] = [rows[j], rows[i]]
  }
  return rows
}
