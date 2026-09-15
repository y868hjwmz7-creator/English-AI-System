/**
 * **業種べつの単語帳を、それだけで練習する**(0058・2026-09 利用者の指定)。
 *
 *   > 最終的にこうやって混ぜたくないんですよ。これは独立した単語帳に
 *   > したいんです。…チェックを入れた分野だけ単語が学べるようにしたいです
 *
 * ============================================================================
 * 【「追加する」という段そのものを、無くした】
 *
 *   0057 では、棚の語を **`word_reviews` に入れてから**練習した。
 *   ところが入れた瞬間に、教材で出会った語と**同じ1冊に混ざる。**
 *
 *   いまは混ぜない。**棚はそれだけで練習でき、覚え具合は
 *   `shelf_reviews`(0058)に、棚の側として残る。**
 *
 *   | 何 | どこ | 誰のものか |
 *   |---|---|---|
 *   | 棚に並ぶ語 | `shelf_words`(0057) | スクール全体で1組 |
 *   | 覚え具合 | `shelf_reviews`(0058) | ゲスト1人ずつ |
 *
 * 【行の形は、`review_words()` とまったく同じにする】
 *
 *   そうすれば `Wordbook.jsx` は、**どちらの冊でも1文字も書き分けずに**
 *   描ける(出題の形・4択・絞り込み・聞き流し・紙まで、そのまま効く)。
 *   **同じ画面を2つ持たない**(単語帳で3度言われた失敗)。
 *
 *   `material_*` の欄には、棚の中身をそのまま置く。
 *
 *   | 欄 | 何が入るか | すると何が効くか |
 *   |---|---|---|
 *   | `material_industry` | 棚の id | 「分野」の絞り込み |
 *   | `material_scene`    | その語の場面 | 「場面・話題」の絞り込み |
 *   | `material_level`    | その語のレベル | 「レベル」の絞り込み |
 *
 *   **新しい絞り込みを1つも作っていない。**
 *
 * 【まだ答えていない語には、行が無い】
 *
 *   `shelf_reviews` に行ができるのは、**答えたときだけ**である。
 *   だから読むときに**左から突き合わせて**、行の無い語は
 *   「まだ・箱0・今日出す」として組み立てる。
 *   これで「まとめて入れる」仕組みも、その上限も要らなくなった。
 *
 * 【0058 を貼る前でも壊れない】
 *
 *   一度断られたら覚えておき、そのあとは呼びに行かない
 *   (`shelfWordsSupported()` と同じ作法)。覚え具合が残らないだけで、
 *   棚を読むことも、自分の単語帳もこれまでどおり動く。
 *
 * 例外は投げず、必ず { data, error } の形で返す。
 */
import { supabase } from './supabase.js'
import { loadShelfWords } from './shelfWords.js'
import { normWord } from './vocab.js'

const ok = (data) => ({ data, error: null })
const ng = (error) => ({ data: null, error })

let supported = true
/** 棚の覚え具合が使えるか(0058 を貼ってあるか) */
export function shelfReviewsSupported() { return supported }

/** 表がまだ無い、という断りか(貼る前) */
function missing(error) {
  const s = `${error?.code ?? ''} ${error?.message ?? ''}`
  return /42P01|PGRST205|PGRST202|42883|does not exist|schema cache|Could not find/i.test(s)
}

/** 貼っていないときの言い方。**どこで・何をするかまで書く** */
const notYet = () => new Error(
  '業種べつの単語帳の覚え具合(0058)が、まだ Supabase にありません。'
  + ' GitHub のリポジトリにあるファイル(supabase/apply/pending_matome.sql)を、'
  + 'Supabase の 左メニュー「SQL Editor」で実行してください'
  + '(教材・宿題・単語帳の中身には触れない SQL です)。',
)

/** 1回に読む語の上限。**際限なく読まない**(35冊ぜんぶで1万語ある) */
export const SHELF_LIMIT = 3000

/** きょうの日付(端末の日付。`.slice(0, 10)` だと世界標準時になる) */
const today = () => {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/**
 * 棚の語と、その人の覚え具合を突き合わせて1つの行にする。
 *
 * **`review_words()` が返す形に合わせる。** 呼ぶ側が
 * 「どちらの冊から来た行か」を見分けずに済むようにするためである。
 * ただ1つだけ足すのが **`shelf`**(どの棚の語か)——
 * 答えを書き戻すときに要る(同じ語が2つの棚にあってもよい)。
 */
function joinRow(word, seen) {
  return {
    word_norm: word.word_norm,
    display: word.display || word.word_norm,
    kind: word.kind || 'word',
    pos: word.pos || '',
    meaning_ja: word.meaning_ja || '',
    // **出会う文は棚が持っている。** これで穴埋め(箱3)がそのまま効く
    seen_in: word.example_en || null,
    seen_in_ja: word.example_ja || null,
    status: seen?.status ?? 'unknown',
    box: seen?.box ?? 0,
    // **まだ答えていない語は「今日出す」。** 待たせる理由がない
    due_on: seen?.due_on ?? today(),
    updated_at: seen?.updated_at ?? word.created_at ?? null,
    // 「いつのぶん」の絞り込みは**出会った日**で数える(`reviewScope.js`)。
    // 棚の語は、棚に並んだ日がそれにあたる
    added_at: seen?.added_at ?? word.created_at ?? null,
    material_id: null,
    material_title: null,
    material_industry: word.industry ?? null,
    material_kind: null,
    material_genre: null,
    material_scene: word.scene || null,
    material_level: word.level || null,
    learn_streak: seen?.learn_streak ?? 0,
    /** **どの棚の語か。** 答えを書き戻すときに要る */
    shelf: word.industry,
  }
}

/**
 * チェックを入れた棚の語を、覚え具合つきで読む。
 *
 * **状態では絞らない。** 3枚の札(まだ / 覚えかけ / 覚えた)の数も、
 * 「出しかた」の札の数も、**読んだ行から数える**ので、
 * 状態で分けて読むと数が合わなくなる(自分の単語帳は SQL 側が数えるが、
 * こちらは表を直に読めるので、その必要がない)。
 *
 * @param learnerId 誰の覚え具合か(省くと自分)
 * @param shelves   棚の id の一覧。**空なら1行も返さない**
 */
export async function loadShelfWordbook({ learnerId = null, shelves = [] } = {}) {
  const list = (shelves ?? []).map((s) => String(s ?? '')).filter(Boolean)
  if (!supabase || !list.length) return ok([])

  /* 棚そのものは 0057 の道で読む。**読み方を2通り持たない** */
  const packs = await Promise.all(list.map((id) => loadShelfWords(id)))
  const bad = packs.find((p) => p.error)
  if (bad) return ng(bad.error)
  const words = packs.flatMap((p) => p.data ?? []).slice(0, SHELF_LIMIT)
  if (!words.length) return ok([])

  /* 覚え具合。**0058 を貼る前は、ここが空のまま返る**(全部「まだ」になる) */
  let seen = []
  if (supported) {
    const who = learnerId
      ?? (await supabase.auth.getUser()).data?.user?.id
      ?? null
    if (who) {
      const { data, error } = await supabase
        .from('shelf_reviews')
        .select('industry, word_norm, status, box, due_on, learn_streak,'
          + ' added_at, updated_at')
        .eq('learner_id', who)
        .in('industry', list)
      if (error) {
        if (!missing(error)) return ng(error)
        supported = false
      } else {
        seen = data ?? []
      }
    }
  }

  /* 棚と語で1つの鍵にする。**値はもとのまま(NUL)。書き方だけエスケープ**
     (2026-09)。もとは**生の NUL を1バイト**書いてあったので、
     git がこのファイルを「バイナリ」と見なし、**差分も grep も効かなかった。**
     `\u0000` と書けば**同じ値のまま**、ふつうの文字列として読める */
  const map = new Map(seen.map((r) => [`${r.industry}\u0000${r.word_norm}`, r]))
  return ok(words.map((w) => joinRow(w, map.get(`${w.industry}\u0000${w.word_norm}`))))
}

/**
 * 棚の語に「まだ / 覚えかけ / 覚えた」を付ける。
 *
 * **`setWordStatus()` とまったく同じ形で返す**(呼ぶ側が書き分けずに済む)。
 * **自分の単語帳には1行も書かない** —— それがこの機能の要である。
 *
 * @param shelf     どの棚の語か
 * @param word      語(そろえる前でよい)
 * @param status    known / learning / unknown
 * @param learnerId 誰の記録にするか(省くと自分)
 */
export async function setShelfWordStatus(shelf, word, status, { learnerId = null } = {}) {
  const norm = normWord(word)
  if (!norm) return ng(new Error('英語の語ではありません'))
  if (!shelf) return ng(new Error('どの単語帳の語なのかが決まっていません'))
  if (!supabase) return ng(new Error('Supabase が設定されていません'))
  if (!['known', 'learning', 'unknown'].includes(status)) {
    return ng(new Error('状態が正しくありません'))
  }
  if (!supported) return ng(notYet())

  const { data, error } = await supabase.rpc('mark_shelf_word', {
    p_industry: shelf,
    p_norm: norm,
    p_status: status,
    ...(learnerId ? { p_learner: learnerId } : {}),
  })
  if (error) {
    if (missing(error)) { supported = false; return ng(notYet()) }
    return ng(error)
  }
  return ok({ norm, ...(Array.isArray(data) ? data[0] : data) ?? {} })
}

/**
 * 棚ごとの覚え具合の数。
 *
 * **読むのは自分(または開いているゲスト)のぶんだけ。**
 * 何語あるかは `loadShelfCounts()`(0057)が別に持っている ——
 * あちらは棚そのものの数で、**誰のものでもない。**
 *
 * **いまはどの画面も呼んでいない。** 35 冊のチェックの欄に
 * 「覚えかけ 10 / 覚えた 3」を添えるためのものだったが、
 * 2026-09 に**プルダウンへ改めた**ときに出す場所が無くなった
 * (いま開いている冊のぶんは、**すぐ下の3枚の札**が出している ——
 * **同じものを2か所に出さない**)。
 * **道そのものは消していない**(`LinkIcon` と同じ扱い)。
 *
 * @returns {{[industry: string]: {learning: number, known: number}}}
 */
export async function loadShelfProgress(learnerId = null) {
  if (!supabase || !supported) return ok({})
  const who = learnerId
    ?? (await supabase.auth.getUser()).data?.user?.id
    ?? null
  if (!who) return ok({})
  const { data, error } = await supabase
    .from('shelf_reviews')
    .select('industry, status')
    .eq('learner_id', who)
    .limit(SHELF_LIMIT)
  if (error) {
    if (missing(error)) { supported = false; return ok({}) }
    return ok({})            // 数が出ないだけ。**騒がない**
  }
  const out = {}
  for (const r of data ?? []) {
    const n = out[r.industry] ?? (out[r.industry] = { learning: 0, known: 0 })
    if (r.status === 'known') n.known += 1
    else if (r.status === 'learning') n.learning += 1
  }
  return ok(out)
}
