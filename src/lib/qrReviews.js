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
import { PROMOTE_KEY, pickPromotions } from './qrPromote.js'

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

/**
 * **0066(冊)が入っているか**(第5.237節)。
 *
 * 入っていない Supabase に `p_source` を送ると、**呼び出しごと断られる**
 * (「そんな引数は無い」)。そうなると**「まだ」を押しても1問も溜まらない** ——
 * いちばん悪い壊れ方である。
 *
 * **はじめは送ってみて、断られたら二度と送らない。** そのあとも
 * これまでどおり溜まり続ける(冊が分かれないだけ)。
 * **黙って落とさない**(CLAUDE.md)—— 画面には `qrSourceSupported()` で出せる。
 */
let sourceReady = true

/** 0066 が入っているか。**画面が冊を出すかどうかの判断に使う** */
export const qrSourceSupported = () => sourceReady

/** 0040 が入っているか。画面がボタンや札を出すかどうかの判断に使う */
export const qrReviewSupported = () => !notReady

const missing = (error) => /qr_reviews|mark_qr|qr_items|drop_qr|schema cache|PGRST202|does not exist/i
  .test(`${error?.message ?? ''} ${error?.code ?? ''}`)

/**
 * **「p_source という引数は無い」と断られたか**(0066 を貼る前)。
 *
 * PostgREST は、引数の合う関数が見つからないと `PGRST202` を返す。
 * `missing()` とは**分けて見る** —— あちらは「関数そのものが無い」で、
 * そのときは**溜めるのをあきらめる**。こちらは**冊を外して溜め直す**。
 * **同じ扱いにすると、0066 を貼る前に1問も溜まらなくなる。**
 */
const noSourceArg = (error) => /p_source|PGRST202|does not exist|schema cache/i
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
 *   - `source` … **どの冊に溜めるか**(0066・第5.237節)。
 *     `'sentence'`(自分の Quick Response 帳)/ `'chunk'`(覚えておきたい表現集)。
 *     **決めるのは `qrSourceOf()` 1か所**(`quickResponse.js`)。
 *     **入れるときだけ効き、あとから移らない**(SQL 側で `on conflict` から
 *     外してある)—— 途中で移すと、ゲストが溜めた冊から黙って消える。
 *     **0066 を貼る前の Supabase では、渡しても静かに無視される**
 *     (関数に無い引数なので、そもそも送らない)
 */
export async function markQr(pair, status, {
  materialId = null, learnerId = null, onlyExisting = false, source = null,
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
    /* **0066 より前の関数には無い引数なので、渡さない**
       (`p_learner` とまったく同じ作法)。渡すと呼び出しごと断られ、
       **「まだ」を押しても1問も溜まらなくなる** */
    ...(sourceReady && source ? { p_source: source } : {}),
  })
  if (error) {
    /* **0066 を貼る前は、冊なしでやり直す**(第5.237節)。
       ここで戻ると**「まだ」を押しても1問も溜まらない。**
       冊が分かれないだけで、溜まること自体はこれまでどおりにする */
    if (sourceReady && source && noSourceArg(error)) {
      sourceReady = false
      return markQr(pair, status, { materialId, learnerId, onlyExisting })
    }
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
  status = 'todo', limit = 200, dueOnly = false, source = null,
} = {}) {
  if (!supabase || notReady) return ok([])
  let who = learnerId
  if (!who) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return ok([])
    who = user.id
  }
  /* **冊で絞る**(0066・第5.237節)。渡さなければ、これまでどおりぜんぶ返る
     (達成具合の集計・Native Flow・66 の型は、こちらを使う)。
     **0066 より前の関数には無い引数なので、送らない**(`markQr` と同じ作法) */
  const 冊 = sourceReady && source ? { p_source: source } : {}
  const { data, error } = await supabase.rpc('qr_items', {
    p_learner: who, p_status: status, p_limit: limit, p_due_only: dueOnly, ...冊,
  })
  if (error) {
    /* **0066 を貼る前は、冊なしで読み直す。** ここで戻ると
       **復習の一覧そのものが空になる**(いちばん悪い壊れ方)。
       そのときは冊が分かれず、これまでどおり全部が出る */
    if (sourceReady && source && noSourceArg(error)) {
      sourceReady = false
      return loadQrReviews(learnerId, { status, limit, dueOnly })
    }
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
  /* **ヒント**(2026-09 利用者の指定)。66 の型の行だけが持っている。
     持っていない行(自分の帳・Native Flow)は `null` なので、
     **あちらにはヒントのボタンが出ない**(効かない操作を見せない・CLAUDE.md) */
  hint: row?.hint ?? null,
  /* **出題に出す英文**(第5.198節)。**言い換えの行だけが持つ。**
     持っていない行は `null` なので、これまでどおり日本語が問になる
     —— 書き分けは `QrCard` が1か所でする */
  askEn: row?.askEn ?? null,
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
/* **並べ方は `qrOrder.js` 1か所**(2026-09)。あちらは何にも依存しない形なので、
   `npm run test:play` が素の node で確かめられる。**呼ぶ側は1行も変わらない** */
export { QR_ORDERS, orderQrPairs } from './qrOrder.js'

/* ────────────────────────────────────────────────────────────────
   育った語の例文を、Quick Response 帳へ送る(2026-09 利用者の指定)
   ──────────────────────────────────────────────────────────────── */

/**
 * 前に送った文(端末ごとに覚えておく)。
 *
 * **これが要るのは1つの理由からである。** ゲストが「もう出さない」で
 * 退けた文は `qr_reviews` から**消える**(`dropQr`)。溜まっている文を
 * 見るだけだと、次に単語帳を開いたときに**同じ文をこちらが掘り返す。**
 *
 * 端末をまたがないので、**別の端末では一度だけ掘り返ることがある。**
 * そのときは「もう出さない」をもう一度押せば済む。
 * ここを表に持つと列が増えるので、いまはそこまでしない。
 */
const readPromoted = () => {
  try {
    const raw = window.localStorage.getItem(PROMOTE_KEY)
    const list = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list : []
  } catch { return [] }
}

const writePromoted = (list) => {
  try {
    // **際限なく溜めない。** 新しいほうから 2,000 件だけ残す
    window.localStorage.setItem(PROMOTE_KEY, JSON.stringify(list.slice(-2000)))
  } catch { /* 端末が断ることがある。送ったこと自体は表に残っている */ }
}

/**
 * 単語帳の行のうち、**十分に育ったもの**の「出会った文」を
 * Quick Response 帳へ送る。
 *
 * **判断は `qrPromote.js` 1か所**(誰を送るか・いくつまで)。
 * ここがするのは、表へ入れることと、送った控えを残すことだけである。
 *
 * ============================================================================
 * 【`mark_qr()` を通さない。**表へ直に入れる**】(2026-09)
 *
 *   はじめ `markQr()` を呼んでいた。**2つ、まずいことが起きる。**
 *
 *   ① **その日の取り組みの数が水増しされる。**
 *      `mark_qr()` は「まだ」で呼ぶと `qr_days.answered` を1つ増やす
 *      (0042)。ゲストは1問も答えていないのに、
 *      **こちらが送ったぶんだけ「答えた」ことになる。**
 *      正答率は下がり、続けた記録は膨らむ。**記録を黙って汚す。**
 *
 *   ② **すでに溜まっている文の進み具合が 0 に戻る。**
 *      `mark_qr('unknown')` は箱も回数も 0 にする。
 *      ゲストが積み上げたものを、こちらが崩す。
 *
 *   どちらも**新しく入れるときには要らない処理**である。
 *   `qr_reviews` は `(learner_id, en_norm)` が一意で、
 *   `status` / `box` / `learn_streak` / `due_on` の既定値が
 *   **ちょうど「まだ・箱0・今日出す」**(0040)なので、
 *   **入れるだけで、`mark_qr` と同じ形の行になる。**
 *
 *   `ignoreDuplicates` を付ければ、**すでに在る行には1文字も触らない。**
 *   しかも `.select()` が**実際に入ったぶんだけ**返すので、
 *   「何文足したか」を数え直さずに済む(**数え方を2通り持たない**)。
 *
 *   表へ直に書けるのは、**自分の行だからである**
 *   (`qr_reviews_own_write` / 0040)。RLS は1行も緩めていない。
 *
 * 【ほとんどの読み込みでは、通信が1回も増えない】
 *   送る文が1つも無ければ、`pickPromotions()` が空を返してそこで終わる。
 *   `KNOWN_AFTER` に届く語は1日に数語なので、ふだんはここで打ち切る。
 * ============================================================================
 *
 * @param {Array} rows 単語帳の行(読み込んだままのもの)
 * @returns {{data:{sent:number, words:string[]}}} 送った数
 */
export async function promoteGrownWords(rows, { learnerId = null } = {}) {
  const none = { sent: 0, words: [] }
  if (!supabase || notReady) return ok(none)
  const already = readPromoted()
  const list = pickPromotions(rows, { already })
  if (!list.length) return ok(none)

  let who = learnerId
  if (!who) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return ok(none)
    who = user.id
  }

  /* **既定値に任せる**(`status` / `box` / `learn_streak` / `due_on`)。
     ここに書き写すと、0040 の決まりを変えた日に片方だけ古くなる */
  const { data, error } = await supabase
    .from('qr_reviews')
    .upsert(list.map((p) => ({
      learner_id: who,
      en_norm: p.norm,
      en: p.en,
      ja: p.ja,
      material_id: p.materialId,
    })), { onConflict: 'learner_id,en_norm', ignoreDuplicates: true })
    .select('en_norm')

  if (error) {
    // **0040 を貼る前は、静かに何もしない**(単語帳の練習は止めない)
    if (missing(error)) { notReady = true; return ok(none) }
    return ok(none)
  }

  /* **入らなかったぶんも控えておく。** すでに在る文なので、
     次に開いたときにもう一度うかがう必要がない */
  writePromoted([...already, ...list.map((p) => p.norm)])

  const put = new Set((data ?? []).map((r) => r.en_norm))
  const done = list.filter((p) => put.has(p.norm))
  return ok({ sent: done.length, words: done.map((p) => p.word) })
}
