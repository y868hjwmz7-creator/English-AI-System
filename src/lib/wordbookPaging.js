/**
 * 単語帳を**終わりまで読む**(第5.404節・2026-10-07 利用者の指摘)。
 *
 * ============================================================================
 * 【何が起きていたか】
 *
 *   「出しかた」の札が、**「今日の復習 1000」「ぜんぶ 1000」**で止まっていた。
 *
 *   1000 という数は、**このアプリのどこにも書いていない。**
 *   アプリは 5,000 語まで頼んでいて、SQL 側の上限(`wordbook_limit()`)も
 *   5,000 である。出どころは **PostgREST(Supabase)が1回に返す行数の上限**で、
 *   既定が **1,000 行**である。
 *
 *   しかも単語帳は**期限の古い順**に返ってくるので、1,000 行で切られると
 *   **その 1,000 行は全部が期限切れ = 今日の復習**になる。
 *   だから2つの札が、そろって 1000 と出ていた。
 *
 * 【同じ罠を、棚の語を数えるところでは一度踏んで、直してある】
 *
 *   `shelfWords.js` の `loadShelfCounts()` に、まったく同じ注意書きがある
 *   (「`.range()` を付けずに読むと、そこで切られて**後ろの棚がまるごと
 *   0 語**になる」)。**あちらは直してあって、こちらは直っていなかった。**
 *   **1か所で踏んだ罠は、同じ読み方をしている場所を全部数える。**
 *
 * 【どう直したか】
 *
 *   ①**分けて読む。**「1ページぶんに満たなくなるまで読む」——
 *     棚とまったく同じ数え方である。**Supabase の設定には頼らない。**
 *   ②**読む順を決める。** 決めないと、ページのあいだで同じ行が二度来たり、
 *     抜けたりする(棚と同じ理由)。鍵は `word_norm`(1人の中で重ならない)。
 *   ③**画面に出す順は、読んだ順ではなく `sortWordbook()` で決め直す。**
 *     ②で並べ替えてしまうので、**そのままでは一覧が五十音順になる。**
 *     SQL が返していたのと**同じ順**にそろえ直してから渡す ——
 *     画面も、出題も、1文字も変えないためである。
 *
 * 【ここに置く理由】
 *   `vocab.js` は Supabase を引き連れているので、**素の node で一度も
 *   走らせられない。** 算段だけを何にも依存しない形へ出す
 *   (`playMark.js` / `reviewScope.js` と同じ考え方)。
 *   `npm run test:play` が、偽の窓口を渡して数字で見張る。
 */

/**
 * 1回に頼む行数。**棚(`shelfWords.js`)と同じ 1000。**
 *
 * PostgREST の既定の上限そのものである。これより小さくしても正しく動くが、
 * 問い合わせの回数が増えるだけで得が無い。
 */
export const WORDBOOK_PAGE = 1000

/** 際限なく読まない。1000 × 30 = 3万行で止める(棚と同じ) */
export const WORDBOOK_MAX_PAGES = 30

/**
 * 「その範囲はもう無い」という断りか(PostgREST の `PGRST103`)。
 *
 * **ここだけが見分ける。** 呼ぶ側で文字を探し回ると、
 * 言い回しが変わった日に片方だけ古くなる。
 */
export const outOfRange = (error) => {
  const code = String(error?.code ?? '')
  const message = `${error?.message ?? ''} ${error?.details ?? ''} ${error ?? ''}`
  return code === 'PGRST103' || /range not satisfiable/i.test(message)
}

/**
 * 終わりまで読む。**1回の問い合わせで数え切らない。**
 *
 * @param {Function} page `(from, to) => Promise<{ data, error }>`
 *        その範囲を読む手。**窓口のことは、ここでは知らない**
 * @param {object} opts
 *   - `keyOf` … 行の鍵。**同じ行が二度来ても1つにする**(既定は `word_norm`)
 *   - `size` … 1ページの行数
 *   - `maxPages` … 際限なく読まないための上限
 * @returns {Promise<{data: Array|null, error: any}>}
 *
 * **読めなかったら、そこで止めて知らせる。**
 * 途中まで返すと「黙って絞った」ことになる(CLAUDE.md)。
 */
export async function readAllRows(page, {
  keyOf = (r) => r?.word_norm,
  size = WORDBOOK_PAGE,
  maxPages = WORDBOOK_MAX_PAGES,
} = {}) {
  const seen = new Map()
  let from = 0
  for (let i = 0; i < maxPages; i += 1) {
    const { data, error } = await page(from, from + size - 1)
    /* **「その範囲はもう無い」は、失敗ではない**(第5.404節)。
       ちょうど1ページぶんで終わったとき、次の1回は**終わりの先**を頼む。
       PostgREST はそれを断ることがある(`PGRST103` / Range Not Satisfiable)。
       **そこで赤くすると、ちょうど 1,000 語の人だけ単語帳が開かなくなる。**
       **1回目で断られたときは、本物の失敗として扱う**(`from > 0` を見る) */
    if (error && from > 0 && outOfRange(error)) break
    if (error) return { data: null, error }
    const rows = data ?? []
    for (const r of rows) {
      const k = keyOf(r)
      /* **鍵が無い行は、鍵で束ねない**(数が減ってしまう)。
         そのまま1つとして入れる */
      if (k == null || k === '') seen.set(Symbol('名無し'), r)
      else if (!seen.has(k)) seen.set(k, r)
    }
    /* **1ページぶんに満たなければ、そこで終わり**(棚と同じ)。
       上限が 5,000 でも 1,000 でも、同じ形で正しく終わる ——
       上限が頼んだ数より大きければ、1回で抜ける(増える問い合わせは0回) */
    if (rows.length < size) break
    from += rows.length
  }
  return { data: [...seen.values()], error: null }
}

/**
 * 画面に出す順。**SQL(`review_words()`)が返していたのと同じ並び**である。
 *
 *     order by (status = 'learning'), due_on, box, updated_at desc
 *
 * 分けて読むために `word_norm` の順で読んでいるので、
 * **ここで並べ直さないと、一覧が五十音順に変わってしまう。**
 * 画面を1文字も変えないために、読んだあと必ずこれを通す。
 *
 * **いちばん後ろに `word_norm` を足してある。** SQL の4つだけでは
 * 同じ値の行が並んだときに順が決まらず、**読むたびに一覧が入れ替わる。**
 */
export function sortWordbook(rows) {
  /* 「まだ」が先、「練習中」が後(SQL の `(status = 'learning')` と同じ) */
  const half = (r) => (r?.status === 'learning' ? 1 : 0)
  const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0)
  const txt = (v) => String(v ?? '')
  return [...(rows ?? [])].sort((a, b) => (
    half(a) - half(b)
    /* 日付も時刻も、**そのまま文字として比べられる形**で返ってくる
       ("2026-10-07" / "2026-10-07T01:23:45+00:00")。
       `new Date()` を通さないので、時差でずれない */
    || txt(a.due_on).localeCompare(txt(b.due_on))
    || num(a.box) - num(b.box)
    || txt(b.updated_at).localeCompare(txt(a.updated_at))
    || txt(a.word_norm).localeCompare(txt(b.word_norm))
  ))
}
