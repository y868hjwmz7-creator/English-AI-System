/**
 * 文法30日集中講座 — 算段(0052・2026-09 利用者の指定)。
 *
 * **何にも依存しない形にしてある**(`playMark.js` と同じ考え方)。
 * `Wordbook.jsx` も `courseDays.js` も Supabase を引き連れていて
 * **素の node で一度も走らせられない**ので、
 * 「何日目を出すか」「何語出すか」「どこまで進んだか」の算段だけをここに置く。
 * `npm run test:play` が数字で見張る。
 */
import { COURSE_DAYS, COURSE_LENGTH, dayOf, tierOf } from '../data/basicsCourse.js'
import { BASIC_WORDS } from '../data/basicWords.js'
import { posGroupOf, posLabel } from './posGroups.js'

/**
 * その日・その段の語。
 *
 * **基本360語 は「1200 の一部」である。** 別の一覧を持たない ——
 * 2つ持つと、片方だけ直したときに食い違う。
 *
 * @param no   何日目か(1〜30)
 * @param tier 'core'(基本360語)/ 'full'(標準1200語)
 */
export function wordsForDay(no, tier = 'core') {
  const day = Number(no)
  if (!Number.isInteger(day) || day < 1 || day > COURSE_LENGTH) return []
  const core = tierOf(tier).id === 'core'
  return BASIC_WORDS.filter((w) => w.day === day && (!core || w.core))
}

/** その段の語ぜんぶ(単語帳へまとめて入れるときに使う) */
export const wordsForTier = (tier = 'core') => (
  tierOf(tier).id === 'core' ? BASIC_WORDS.filter((w) => w.core) : BASIC_WORDS.slice()
)

/**
 * その段の英単語だけを並べる(0053 の `add_basic_words()` へ渡す形)。
 * **画面で `map` を書き写さない** —— 渡す形は1か所で決める。
 */
export const wordListFor = (tier = 'core') => wordsForTier(tier).map((w) => w.w)

/**
 * 基礎単語の訳。**窓口(AI)を1回も呼ばない = 0円。**
 *
 * ============================================================================
 * 【なぜ要るか】(2026-09 利用者の指定)
 *
 *   > 講座の中の単語はそれぞれ基本360語、標準1200語、として
 *   > そもそもが独立して選べる単語帳にしてください
 *
 *   段まるごと(360〜1,200語)を単語帳へ入れると、**そのどれにも
 *   意味の控え(`word_glosses`)が無い。** そのままでは単語帳に
 *   「(意味の控えがありません)」が並び、4択も作れない
 *   (まちがいの選択肢は意味から作るため)。
 *
 *   **その訳は `basicWords.js` にもう書いてある。**
 *   控えが無いときだけ、そちらを出す ——
 *   `review_words()`(0047)が教材の `prompt_ja` を出すのと
 *   **まったく同じ考え方**である。
 *
 * 【そろえ方(`normWord`)は、ここでは掛けない】
 *
 *   あれは `src/lib/vocab.js` にあり、Supabase を引き連れている。
 *   **そろえ方を4か所目に書き写さない**(SQL / 窓口 / 画面の3か所で
 *   そろえるのに苦労した・`materialWords.js` と同じ判断)。
 *   `basicWords.js` の `w` は**もともとそろえた形**である
 *   (`/^[a-z'-]+$/` を `npm run test:play` が見張っている)ので、
 *   そろえた語をそのまま鍵として引ける。
 *
 * @param norm そろえた語(`normWord()` を通したもの)
 * @returns 訳。**知らない語は空**(当てずっぽうで返さない)
 */
const BASIC_JA = new Map(BASIC_WORDS.map((w) => [w.w, w.ja]))
export const basicJaOf = (norm) => BASIC_JA.get(String(norm ?? '')) ?? ''

/**
 * 基礎単語の品詞。**訳とまったく同じ考え方**(2026-09 利用者の指定)。
 *
 *   > 全ての単語に対して効くようにして欲しいのが
 *   > 品詞ごとに分ける絞り込み機能です。
 *
 * 段まるごとを単語帳へ入れると、そのどれにも意味の控え
 * (`word_glosses`)が無い。**品詞もそこに入っている**ので、
 * そのままでは 1,200 語が丸ごと「品詞で絞れない語」になり、
 * **「全ての単語に効く」にならない。**
 *
 * 短い印(`n` / `v` / `adj`)のまま返す —— そろえるのは
 * **`posGroupOf()`(`posGroups.js`)1か所**の役目である。
 *
 * @param norm そろえた語(`normWord()` を通したもの)
 * @returns 品詞の印。**知らない語は空**(当てずっぽうで返さない)
 */
const BASIC_POS = new Map(BASIC_WORDS.map((w) => [w.w, w.pos]))
export const basicPosOf = (norm) => BASIC_POS.get(String(norm ?? '')) ?? ''

/**
 * 30日ぶんの一覧に、**終えたかどうか**を添える。
 *
 * @param doneDays 終えた日の番号(サーバーから読んだもの)
 */
export function courseList(doneDays = []) {
  const done = new Set((doneDays ?? []).map(Number))
  return COURSE_DAYS.map((d) => ({ ...d, done: done.has(d.no) }))
}

/**
 * **次にやる日。**
 *
 * 終えていない**いちばん小さい番号**を返す。
 * 飛ばして進んでもよいので、「終えた数 + 1」では出さない ——
 * 3日目だけ飛ばした人を、いつまでも4日目に留めてしまう。
 *
 * 全部終えていれば `null`(呼ぶ側が「ぜんぶ終わりました」を出す)。
 */
export function nextDay(doneDays = []) {
  const done = new Set((doneDays ?? []).map(Number))
  for (const d of COURSE_DAYS) if (!done.has(d.no)) return d.no
  return null
}

/**
 * 進み具合(0〜1)。**0で割らない。**
 * 画面はこの数字を帯の幅にするので、範囲の外を返さない。
 */
export function courseRatio(doneDays = []) {
  if (!COURSE_LENGTH) return 0
  const done = new Set((doneDays ?? []).map(Number).filter((n) => n >= 1 && n <= COURSE_LENGTH))
  return Math.min(done.size / COURSE_LENGTH, 1)
}

/**
 * その日の1行の要約(画面と読み上げの両方で使う)。
 * **範囲の外なら空**(当てずっぽうで文を作らない)。
 */
export function dayLine(no, tier = 'core') {
  const d = dayOf(no)
  if (!d) return ''
  return `${d.no}日目 ${d.title} — ${wordsForDay(d.no, tier).length} 語`
}

/**
 * その日を、Quick Response と同じ「英語 + 訳」の対にする。
 *
 * **新しい練習を作らない**(CLAUDE.md)。例文はそのまま
 * `QrCard` に渡せる形にしておけば、口に出す練習はもう画面にある。
 */
export const dayPairs = (no) => (dayOf(no)?.examples ?? [])
  .map((x, i) => ({ key: `d${no}-${i}`, en: x.en, ja: x.ja }))

/**
 * その段の語を、**単語帳の行**(`review_words()` が返す形)にそろえる。
 *
 * ============================================================================
 * 【なぜ要るか】(2026-09 利用者の指定)
 *
 *   > 基礎単語360/1200も業種別の横に置いてください。
 *
 *   基礎単語は**3冊目の単語帳**になった(「自分の単語帳 / 業種べつ /
 *   基礎単語」)。**行の形をそろえておけば、`Wordbook.jsx` は
 *   どの冊でも1文字も書き分けずに描ける** —— 出題の形も4択も
 *   絞り込みも聞き流しも紙も、そのまま効く
 *   (`shelfReviews.js` の `joinRow()` とまったく同じ考え方)。
 *
 * 【覚え具合は、自分の単語帳に残す】
 *
 *   ここが**業種べつとの唯一の違い**である。棚は
 *   「混ぜたくない」という指定だったので `shelf_reviews`(0058)に
 *   分けたが、基礎単語は 0053 で**逆の指定**を受けている。
 *
 *     > 講座から単語帳に登録を押せば、
 *     > 単語帳の中の自分の普段の単語に追加される感じで
 *
 *   だから読む先も書く先も `word_reviews` のままで、
 *   **新しい表も RPC も1つも作っていない**(SQL は1行も要らない)。
 *
 * 【まだ答えていない語には、行が無い】
 *
 *   `word_reviews` に行ができるのは**答えたとき**である。
 *   だから左(段の語)から突き合わせて、行の無い語は
 *   「まだ・箱0・今日出す」として組み立てる ——
 *   **「まず入れる」を押さなくても、そのまま練習できる。**
 *
 * 【0円である】
 *
 *   訳も品詞も `basicWords.js` に書いてある。**窓口(AI)を1回も呼ばない。**
 *   1,200 語を `lookupWord` で引くと 120 円ほどかかる。
 *
 * @param tier  'core'(基本360語)/ 'full'(標準1200語)
 * @param seen  その人の `word_reviews`(`word_norm` を持つ行の一覧)
 * @param today きょうの日付。**呼ぶ側が渡す**(素の node で確かめるため)
 */
export function basicRows(tier = 'core', seen = [], { today = '' } = {}) {
  const map = new Map(
    (seen ?? []).map((r) => [String(r?.word_norm ?? ''), r]).filter(([k]) => k),
  )
  return wordsForTier(tier).map((w) => {
    const s = map.get(w.w) ?? null
    return {
      word_norm: w.w,
      display: w.w,
      /* `basicWords.js` の `w` は**空白を含まない**(`test:play` が
         見張っている)ので、どれも語である(言い回しは入らない) */
      kind: 'word',
      /* **画面には日本語で出す。** 印は `n` / `v` なので、そのまま入れると
         語の上の小さな札に「n」と出る。**対応表はここに書かない** */
      pos: posLabel(posGroupOf(w.pos)),
      meaning_ja: w.ja,
      /* **出会った文は持たない。** 基礎単語は語だけの一覧なので、
         穴埋め(箱3)は `pickForm()` が「思い出す」に落とす
         (**行き止まりを作らない**) */
      seen_in: null,
      seen_in_ja: null,
      status: s?.status ?? 'unknown',
      box: s?.box ?? 0,
      /* **まだ答えていない語は「今日出す」。** 待たせる理由がない */
      due_on: s?.due_on ?? today,
      updated_at: s?.updated_at ?? null,
      added_at: s?.added_at ?? null,
      material_id: null,
      material_title: null,
      material_industry: null,
      material_kind: null,
      material_genre: null,
      material_scene: null,
      material_level: null,
      learn_streak: s?.learn_streak ?? 0,
    }
  })
}
