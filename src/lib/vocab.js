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
import { canSeeSystemDetail } from './viewer.js'

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

/**
 * 英文を「語」と「語でないもの」に分ける。区切りもそのまま残す。
 *
 * `at` は、もとの英文の何文字目から始まるか。
 * **読み上げ中の語に色を付けるのに要る。** ブラウザは「いま何文字目を
 * 読んでいるか」しか教えてくれないので、文字の位置で語を突き止める。
 */
export function splitWords(text) {
  const parts = []
  const re = /[A-Za-z][A-Za-z'-]*/g
  let last = 0
  let m = re.exec(text ?? '')
  while (m) {
    if (m.index > last) parts.push({ word: false, text: text.slice(last, m.index), at: last })
    parts.push({ word: true, text: m[0], norm: normWord(m[0]), at: m.index })
    last = m.index + m[0].length
    m = re.exec(text)
  }
  if (last < (text ?? '').length) parts.push({ word: false, text: text.slice(last), at: last })
  return parts
}

/**
 * 出てきた文の「指紋」。
 *
 * 控えの鍵は (語, 出てきた文) の組である。文はそのまま鍵にするには長いので、
 * そろえた文の SHA-256 の先頭16文字を使う。
 *
 * **この規則を持つのは、ここ1か所だけにする。**
 * 窓口(lookup-word)には、ここで作った鍵をそのまま渡す。
 * 両方で同じ計算をすると、必ずいつかずれる(語のそろえ方で懲りた)。
 */
export async function contextKeyOf(sentence) {
  const norm = String(sentence ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  if (!norm) return ''
  // crypto.subtle は「安全な接続(https)」でしか使えない。
  // 使えない場所でも**止まらない**ように、簡単な計算に落とす。
  // 鍵が変わるだけで、壊れはしない(そのぶん引き直しになる)。
  if (!window.crypto?.subtle) {
    let h1 = 0x811c9dc5
    let h2 = 0x01000193
    for (let i = 0; i < norm.length; i += 1) {
      h1 = Math.imul(h1 ^ norm.charCodeAt(i), 0x01000193) >>> 0
      h2 = Math.imul(h2 + norm.charCodeAt(i), 0x85ebca6b) >>> 0
    }
    return (h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0')).slice(0, 16)
  }
  const bytes = new TextEncoder().encode(norm)
  const hash = await window.crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16)
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

// ── 速さのための控え(この画面が開いているあいだだけ)──────────
//
// 【なぜ要るか】(2026-08 の指摘)
//   語に触れてから意味が出るまでが長く感じる、という報告があった。
//   一度引いた語でも、毎回こうなっていた。
//
//     ① ログインの札を確かめる
//     ② 窓口(Edge Function)を呼ぶ      ← 往復に時間がかかる
//     ③ 窓口がデータベースの控えを読む
//     ④ 返す
//
//   **控えにあるなら、窓口を通す必要はない。** 画面から直接読めばよい。
//   さらに、本文が出た時点で**まとめて先に読んでおけば**、
//   触れた瞬間に出る(通信ゼロ)。
//
//   ・memoryCache … この画面が開いているあいだ覚えておく
//   ・preloadGlosses() … 本文に出る語を**1回の問い合わせ**でまとめて読む
//   ・lookupWord() … 覚えている → データベース → 窓口 の順に探す
const memoryCache = new Map()
const cacheKey = (norm, ctx) => `${norm}\u0000${ctx}`

/** まとめ読みの待ち行列。少し待って1回にまとめる(1文ごとに投げない) */
let pending = null
let pendingTimer = null

/**
 * 本文に出てくる語の意味を、**まとめて先に読んでおく。**
 * 控えにあるものだけを読む(無いものは触れたときに引く)。
 */
export function preloadGlosses(text, sentence = text) {
  if (!supabase || !text) return
  if (!pending) pending = { words: new Set(), sentences: new Set() }
  for (const part of splitWords(text)) if (part.word) pending.words.add(part.norm)
  pending.sentences.add(sentence)

  if (pendingTimer) window.clearTimeout(pendingTimer)
  pendingTimer = window.setTimeout(runPreload, 60)
}

async function runPreload() {
  const batch = pending
  pending = null
  pendingTimer = null
  if (!batch || !batch.words.size) return

  const keys = await Promise.all([...batch.sentences].map(contextKeyOf))
  const words = [...batch.words]
  // 語が多すぎると問い合わせが長くなりすぎる。1回に400語まで
  const { data } = await supabase
    .from('word_glosses').select('*')
    .in('context_key', keys)
    .in('word_norm', words.slice(0, 400))
  for (const row of data ?? []) {
    memoryCache.set(cacheKey(row.word_norm, row.context_key), withSenses(row))
  }
}

/**
 * 先読みしない語(ごくありふれた語)。
 *
 * **教材を開いた時点で全部引くと、費用が跳ね上がる。**
 * the / is / and のような語は、誰も意味を知りたがらない。
 * ここに載っている語は先読みしない(触れれば、そのときちゃんと引く)。
 */
const COMMON = new Set(`a an the this that these those i you he she it we they
me him her us them my your his its our their mine yours
is am are was were be been being do does did done have has had
will would can could shall should may might must
and or but so if then than as of in on at to for from by with without
about into over under after before during between through
not no yes very too also just only even still yet more most much many
some any all both each every other another such same
here there where when why how what which who whom whose
one two three four five six seven eight nine ten
i'm you're we're they're it's don't doesn't didn't isn't aren't wasn't weren't
can't won't wouldn't couldn't shouldn't i've you've we've they've
get got go goes went come came make made take took give gave
say said see saw know knew think thought want wanted need needed
like liked look looked use used find found tell told ask asked
work works day time year people way thing things`.trim().split(/\s+/))

/**
 * まだ控えに無い語を、**裏で先に引いておく。**
 *
 * 【なぜ必要か】(2026-08 の要望)
 *   ウェブページのように、開いた時点で支度を済ませておきたい。
 *   触れてから引きに行くと、はじめての語はどうしても数秒待たされる。
 *
 * 【費用を跳ね上げないために】
 *   ・ごくありふれた語は引かない(上の COMMON)
 *   ・**1回に10語まとめて**引く。1語ずつ呼ぶと指示文の分だけ費用が3倍になる
 *   ・1つの教材につき **PREFETCH_LIMIT 語まで**。全部は引かない
 *   ・引いた結果はスクール全体の控えに残るので、**2人目からは無料**
 *
 *   目安: 1語あたりおよそ 0.1 円。24語で 2.4 円、しかも一度きり。
 */
const PREFETCH_LIMIT = 24
const prefetchDone = new Set()   // 同じ本文を二度先読みしない

/**
 * **待っても直らない断りが返ったら、先読みをやめる。**
 *
 * 残高切れや鍵ちがいは、何度呼んでも同じ結果になる。
 * それでも教材を開くたびに10語ずつ呼びに行くと、
 * 直らないことのために待たされ続ける(2026-08 実機で残高切れを確認)。
 * この画面を読み込み直すまで、先読みは止めたままにする。
 */
let prefetchStopped = false

export async function prefetchGlosses(entries, { level = 'B1' } = {}) {
  if (!supabase || prefetchStopped) return
  const list = (entries ?? []).filter((e) => e && e.text)
  if (!list.length) return

  const seen = new Set()
  const wanted = []
  for (const { text } of list) {
    const ctx = await contextKeyOf(text)
    for (const part of splitWords(text)) {
      if (!part.word) continue
      const key = cacheKey(part.norm, ctx)
      if (seen.has(key) || memoryCache.has(key) || prefetchDone.has(key)) continue
      if (COMMON.has(part.norm) || part.norm.length <= 2) continue
      seen.add(key)
      wanted.push({ word: part.text, sentence: text, contextKey: ctx, key })
    }
  }
  if (!wanted.length) return

  // すでに控えにあるものを外す(引き直さない)
  const { data: have } = await supabase
    .from('word_glosses').select('word_norm, context_key, senses, display, phonetic, pos, meaning_ja, example_en, note')
    .in('context_key', [...new Set(wanted.map((w) => w.contextKey))])
    .in('word_norm', [...new Set(wanted.map((w) => normWord(w.word)))].slice(0, 400))
  for (const row of have ?? []) {
    memoryCache.set(cacheKey(row.word_norm, row.context_key), withSenses(row))
  }
  const missing = wanted
    .filter((w) => !memoryCache.has(w.key))
    .slice(0, PREFETCH_LIMIT)
  if (!missing.length) return

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return

  // 10語ずつ、順番に。まとめて一度に投げると返りが遅くなる
  for (let i = 0; i < missing.length; i += 10) {
    const chunk = missing.slice(i, i + 10)
    for (const w of chunk) prefetchDone.add(w.key)
    const { data, error } = await supabase.functions.invoke('lookup-word', {
      body: { words: chunk.map(({ word, sentence, contextKey }) => ({ word, sentence, contextKey })), level },
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    // 失敗したら静かにやめる(触れれば引ける)。
    // **直らない種類の断りなら、この画面のあいだは二度と先読みしない**
    if (error || data?.error) {
      if (data?.fatal) prefetchStopped = true
      return
    }
    for (const g of data?.glosses ?? []) {
      memoryCache.set(cacheKey(g.word_norm, g.context_key), withSenses(g))
    }
  }
}

/**
 * 断りを、**見ている人に合わせて**選ぶ。
 *
 * 窓口は「誰に見せてもよい文(`error`)」と
 * 「原因と直し方(`detail`)」の両方を返す。
 * **ゲストには内側の事情を見せない**(2026-08 利用者の指定)。
 * 「Claude の残高が足りません」はゲストにできることが何も無く、
 * スクールの内側の話でしかない。
 * トレーナー・管理者には、直し方まで分かる `detail` を出す。
 */
const GENERIC_LOOKUP_ERROR =
  'いま辞書を使えません。少し時間をおいてから、もう一度お試しください。'

const shownError = (body) =>
  (canSeeSystemDetail() && body?.detail) ? body.detail : (body?.error ?? GENERIC_LOOKUP_ERROR)

/**
 * 意味と品詞を引く。**その文でふさわしい意味が先頭**で返る。
 *
 * 探す順は「覚えている → データベースの控え → 窓口」。
 * **窓口を呼ぶのは、まだ誰も引いたことのない語だけ。**
 */
export async function lookupWord({ word, sentence = '', level = 'B1' }) {
  const norm = normWord(word)
  if (!norm) return ng('英語の語ではありません')
  if (!supabase) return ng('Supabase が設定されていません')

  const ctx = await contextKeyOf(sentence)

  // ① この画面で一度引いたもの(通信なし)
  const remembered = memoryCache.get(cacheKey(norm, ctx))
  if (remembered) return ok(remembered)

  // ② データベースの控え(窓口を通さないぶん速い)
  const { data: cached } = await supabase
    .from('word_glosses').select('*')
    .eq('word_norm', norm).eq('context_key', ctx).maybeSingle()
  if (cached) {
    const gloss = withSenses(cached)
    memoryCache.set(cacheKey(norm, ctx), gloss)
    return ok(gloss)
  }

  // ③ まだ誰も引いていない語。ここで初めて窓口を呼ぶ
  //
  // **ログインの札を取り直してから渡す。** 長く開いたままのタブでは
  // 期限が切れていることがあり、そのままだと 401 が返る(2026-08 実機)。
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    return ng('ログインが切れています。画面を読み込み直してから、もう一度お試しください。')
  }

  const { data, error } = await supabase.functions.invoke('lookup-word', {
    // 鍵はここで作ったものを渡す。窓口では作り直さない(ずれないように)
    body: { word, sentence, level, contextKey: ctx },
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
  if (error) {
    let body = null
    try { body = await error.context?.json() } catch { /* 読めなければ無視 */ }
    if (body?.error) return ng(shownError(body))
    if (/Failed to send a request|FunctionsFetchError/i.test(error.message ?? '')) {
      return ng(shownError({
        error: `${GENERIC_LOOKUP_ERROR}直らないときは、担当のトレーナーにお知らせください。`,
        detail: '意味を調べる窓口につながりませんでした。'
          + 'Supabase に lookup-word を配置したか確認してください。',
      }))
    }
    return ng(shownError({
      error: GENERIC_LOOKUP_ERROR,
      detail: `調べられませんでした: ${error.message}`,
    }))
  }
  if (data?.error) return ng(shownError(data))
  if (!data?.gloss) return ng('意味を読み取れませんでした')
  // はじめて引いた語だけ、かかった時間を持たせる。
  // **速い・遅いを体感で議論しないため。** 2回目からは控えから出るので付かない
  const gloss = { ...withSenses(data.gloss), lookedUpMs: data.ms?.total ?? null }
  memoryCache.set(cacheKey(norm, ctx), { ...gloss, lookedUpMs: null })
  return ok(gloss)
}

/**
 * 品詞を、色分けのための種類に振り分ける。
 *
 * **見ただけで「これは動詞だ」と分かるようにする。**
 * 色は控えめにする。鮮やかだと、並んだときに目が疲れる。
 * 知らない品詞は「その他」にまとめる(色が付かないだけで、表示は出る)。
 */
export function posKind(pos) {
  const p = String(pos ?? '')
  if (p.includes('名詞') && !p.includes('代名詞')) return 'noun'
  if (p.includes('動詞') && !p.includes('助動詞')) return 'verb'
  if (p.includes('形容')) return 'adj'
  if (p.includes('副詞')) return 'adv'
  if (p.includes('前置') || p.includes('接続')) return 'conj'
  if (p.includes('熟語') || p.includes('句')) return 'phrase'
  return 'other'
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

/**
 * 自分の単語帳。**意味・箱・次に出す日まで揃えて返す。**
 *
 * 【なぜ要るか】(2026-08 の設計)
 *   「知らなかった」を選んでも、これまで本人からは何も見えなかった。
 *   選んだ手応えが無いと続かない。ここが復習の入口になる。
 *
 * `review_words()` は本人・担当トレーナー・管理者だけが呼べる
 * (SQL 側で確かめている)。画面側で役割を判定しない。
 */
export async function loadMyWordbook({ status = 'unknown', limit = 200, dueOnly = false } = {}) {
  if (!supabase) return ok([])
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return ok([])

  const { data, error } = await supabase.rpc('review_words', {
    p_learner: user.id,
    p_status: status,
    p_limit: limit,
    p_due_only: dueOnly,
  })
  if (error) return fail(error, '単語帳を読めませんでした')
  return ok(data ?? [])
}

/**
 * その語を**くわしく**引く。単語帳から深掘りするときに使う。
 *
 * 【なぜ吹き出しではなく、こちら側に置くのか】(2026-08 利用者の指定)
 *   > そこまでたくさん意味は必要ありません。学習者を混乱させるだけです。
 *   > それ以上は、単語帳からさらに深ぼれる仕組み
 *
 *   読んでいる途中の吹き出しは**いま要る意味1つ**でよい。
 *   腰を据えて調べたいのは単語帳のほうである。**場面が違う。**
 *
 * 控えにある**すべての文脈ぶん**を返す(同じ語でも文によって意味が違う)。
 * **新しく AI に尋ねない。** 控えを読むだけなので、費用はかからない。
 */
export async function loadGlossDetail(wordNorm) {
  if (!supabase) return ok([])
  const norm = normWord(wordNorm)
  if (!norm) return ok([])
  const { data, error } = await supabase
    .from('word_glosses')
    .select('display, phonetic, senses, pos, meaning_ja, context_key, created_at')
    .eq('word_norm', norm)
    .order('created_at', { ascending: true })
    .limit(8)
  if (error) return fail(error, 'くわしい意味を読めませんでした')
  return ok(data ?? [])
}

/**
 * 単語帳の進み具合。**続いていることが見えないと続かない。**
 *
 * 復習は「今日やることが有限で、減っていくのが見える」と続く。
 * 数だけを3つ数える。行は読まないので軽い。
 *
 * @returns {{due: number, unknown: number, known: number}}
 */
export async function loadWordbookCounts() {
  const empty = { due: 0, unknown: 0, known: 0 }
  if (!supabase) return ok(empty)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return ok(empty)

  const today = new Date().toISOString().slice(0, 10)
  const base = () => supabase
    .from('word_reviews')
    .select('word_norm', { count: 'exact', head: true })
    .eq('learner_id', user.id)

  const [due, unknown, known] = await Promise.all([
    base().eq('status', 'unknown').lte('due_on', today),
    base().eq('status', 'unknown'),
    base().eq('status', 'known'),
  ])
  // 数えられなくても画面は出す。**数が出ないだけで、復習はできる**
  return ok({
    due: due.count ?? 0,
    unknown: unknown.count ?? 0,
    known: known.count ?? 0,
  })
}

/**
 * 今週の続き具合(0019)。**日ではなく週で数える。**
 * 日ごとの連続記録は1日休んだだけで途切れ、途切れた瞬間にやめる理由になる。
 */
export async function loadVocabWeek(learnerId = null) {
  const empty = { days: 0, answered: 0, correct: 0, weeks: 0 }
  if (!supabase) return ok(empty)
  const { data, error } = await supabase.rpc('vocab_week', { p_learner: learnerId })
  // 0019 を貼る前でも画面は出す。**数が出ないだけで、復習はできる**
  if (error) return ok(empty)
  return ok((Array.isArray(data) ? data[0] : data) ?? empty)
}

/** 業界別に覚えた語(0019)。**自分の仕事の語が増えるのが見える** */
export async function loadVocabByIndustry(learnerId = null) {
  if (!supabase) return ok([])
  const { data, error } = await supabase.rpc('vocab_by_industry', { p_learner: learnerId })
  if (error) return ok([])
  return ok(data ?? [])
}

/**
 * トレーナーが単語帳を見たことを残す(0019)。
 * **人が見ていると分かることが、どんなバッジより効く。**
 */
export async function noteWordbookView(learnerId) {
  if (!supabase || !learnerId) return ok(null)
  const { error } = await supabase.rpc('note_wordbook_view', { p_learner: learnerId })
  if (error) return ok(null)   // 残せなくても、単語帳は見られる
  return ok(true)
}

/** 自分の単語帳を、誰がいつ見たか(ゲストの画面に出す) */
export async function loadWordbookViewers() {
  if (!supabase) return ok([])
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return ok([])
  const { data, error } = await supabase
    .from('wordbook_views')
    .select('trainer_id, viewed_at')
    .eq('learner_id', user.id)
    .order('viewed_at', { ascending: false })
    .limit(3)
  if (error) return ok([])
  return ok(data ?? [])
}

/**
 * 0015 を貼る前の Supabase 向けの控えめな書き込み。
 *
 * `mark_word()` がまだ無い環境で、**押しても何も起きない**状態を避ける。
 * 箱(box)と次に出す日(due_on)は決められないので、
 * 「知っていた / 知らなかった」だけを残す。
 * 0015 を貼れば、この道は通らなくなる。
 */
async function legacySetWordStatus(norm, status, materialId) {
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
  return ok({ norm, status })
}

/**
 * 「知っていた」「知らなかった」を付ける。
 *
 * **次に出す日は、画面では決めない。** SQL の `mark_word()` に任せる
 * (0015)。端末の日付や時差で食い違わないようにするためと、
 * 間隔の決まりを2か所に持たないためである。
 *
 * `kind` は 'word' か 'phrase'。句・イディオム・句動詞は 'phrase'。
 * 鍵の作り方は語と同じなので、同じ表に入る。
 */
/** 0018 を貼る前の Supabase では、文を渡す引数が無い。一度気づいたら覚える */
let noSentenceArg = false

export async function setWordStatus(word, status, {
  kind = 'word', materialId = null, sentence = null, sentenceJa = null,
} = {}) {
  const norm = normWord(word)
  if (!norm) return ng('英語の語ではありません')
  if (!supabase) return ng('Supabase が設定されていません')
  if (!['known', 'unknown'].includes(status)) return ng('状態が正しくありません')

  const args = {
    p_norm: norm,
    p_status: status,
    p_kind: kind === 'phrase' ? 'phrase' : 'word',
    p_material: materialId,
  }
  // 出会った文(0018)。**人は文脈ごと覚える。**
  // 最初の1文だけが残る(あとから上書きしないのは SQL 側の決まり)。
  // **0018 を貼る前は、この引数を受け取れない。** そのときは付けずに呼び直す
  let { data, error } = sentence && !noSentenceArg
    ? await supabase.rpc('mark_word', {
      ...args, p_sentence: sentence, p_sentence_ja: sentenceJa || null,
    })
    : await supabase.rpc('mark_word', args)
  if (error && sentence && !noSentenceArg && /p_sentence|p_sentence_ja|PGRST202|function/i.test(
    `${error.message ?? ''} ${error.code ?? ''}`,
  )) {
    noSentenceArg = true
    ;({ data, error } = await supabase.rpc('mark_word', args))
  }
  // **0015 をまだ貼っていない Supabase でも動くようにする。**
  // 貼るまでのあいだ「押しても色が付かない」状態にしない(2026-08 実機)。
  // 箱と次に出す日は付かないが、知っていた / 知らなかったは残る
  if (error && /mark_word|function|schema cache|PGRST202/i.test(
    `${error.message ?? ''} ${error.code ?? ''}`,
  )) {
    return legacySetWordStatus(norm, status, materialId)
  }
  if (error) return fail(error, '記録できませんでした')
  // 次にいつ出るかを返す。「7日後にまた出ます」と画面に出すため
  return ok({ norm, ...(Array.isArray(data) ? data[0] : data) ?? {} })
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
export async function loadReviewWords(
  learnerId, { status = 'unknown', limit = 40, dueOnly = false } = {},
) {
  if (!supabase) return ng('Supabase が設定されていません')
  if (!learnerId) return ok([])
  const { data, error } = await supabase.rpc('review_words', {
    p_learner: learnerId, p_status: status, p_limit: limit, p_due_only: dueOnly,
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
  // **今日出すべきものを先に取る**(0015)。忘れかけた頃に再会させたい。
  // 足りないぶんだけ、まだ日の来ていないものと宿題の語で埋める
  const [{ data: dueWords, error: e0 }, { data: unknownWords, error: e1 },
    { data: homework, error: e2 }] =
    await Promise.all([
      loadReviewWords(learnerId, { status: 'unknown', limit: 200, dueOnly: true }),
      loadReviewWords(learnerId, { status: 'unknown', limit: 200 }),
      loadHomeworkWords(learnerId, { limit: 200 }),
    ])
  if (e0) return ng(e0)
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

  for (const w of dueWords ?? []) add(w, 'due')
  for (const w of unknownWords ?? []) add(w, 'unknown')
  for (const w of homework ?? []) {
    if (w.status === 'known') continue   // 知っていた語は混ぜない
    add(w, w.status === 'unknown' ? 'unknown' : 'seen')
  }
  return ok(picked.slice(0, limit))
}
