/**
 * **業種べつの単語帳(棚)の読み書き**(0057)。
 *
 * 一覧と判断は `src/data/shelves.js` にある。
 * ここは Supabase を引き連れているので、**素の node で一度も
 * 走らせられない**(`learnerFeatures.js` / `goals.js` と同じ)。
 * **判断をここに書かない。**
 *
 * 【0057 を貼る前でも壊れない】
 *
 *   表が無ければ「棚は空」として返す。一度断られたら覚えておき、
 *   そのあとは呼びに行かない(`weeklyGoalSupported()` /
 *   `basicWordsSupported()` と同じ作法)。
 *   **押せなくなるだけ**で、単語帳も復習もこれまでどおり動く。
 *
 * 例外は投げず、必ず { data, error } の形で返す。
 */
import { supabase } from './supabase.js'
import { normWord } from './vocab.js'

const ok = (data) => ({ data, error: null })
const ng = (error) => ({ data: null, error })

/** 1回に置ける語数。**際限なく送らない**(SQL 側の `limit 2000` と対) */
export const MAX_SAVE = 400

let supported = true
/** 棚が使えるか。**画面がボタンを出すかどうかの判断** */
export function shelfWordsSupported() { return supported }

/** 表がまだ無い、という断りか(貼る前) */
function missing(error) {
  const s = `${error?.code ?? ''} ${error?.message ?? ''}`
  return /42P01|PGRST205|PGRST202|42883|does not exist|schema cache|Could not find/i.test(s)
}

/** 貼っていないときの言い方。**どこで・何をするかまで書く** */
const notYet = () => new Error(
  '業種べつの単語帳(0057)が、まだ Supabase にありません。'
  + ' GitHub のリポジトリにあるファイル(supabase/apply/pending_matome.sql)を、'
  + 'Supabase の 左メニュー「SQL Editor」で実行してください'
  + '(教材・宿題・単語帳の中身には触れない SQL です)。',
)

/**
 * その棚の語をぜんぶ読む。
 *
 * **絞り込みはここでしない。** 場面での絞り込みは画面の「出しかた」が
 * 手元で行う(単語帳の絞り込みとまったく同じ作法)。
 * そうすれば、場面を選び直すたびに聞き直さずに済む。
 */
export async function loadShelfWords(industry) {
  if (!supabase || !supported || !industry) return ok([])
  const { data, error } = await supabase
    .from('shelf_words')
    .select('industry, word_norm, display, kind, pos, meaning_ja,'
      + ' example_en, example_ja, scene, level, created_at')
    .eq('industry', industry)
    .order('scene')
    .order('word_norm')
  if (error) {
    if (missing(error)) { supported = false; return ok([]) }
    return ng(error)
  }
  return ok(data ?? [])
}

/**
 * 棚ごとの語数。**棚の一覧に「何語あるか」を出すために使う。**
 *
 * 数が見えないと、どの棚がまだ空なのかが分からない
 * (「出しかた」の札に数を出すのと、まったく同じ考え方)。
 * **数えられなかったら `null`** —— 0 と取り違えると
 * 「まだ1語もありません」という嘘になる。
 */
export async function loadShelfCounts() {
  if (!supabase || !supported) return ok(null)
  const { data, error } = await supabase.from('shelf_words').select('industry')
  if (error) {
    if (missing(error)) { supported = false; return ok(null) }
    return ok(null)                     // **騒がない。** 数が出ないだけ
  }
  const n = new Map()
  for (const r of data ?? []) n.set(r.industry, (n.get(r.industry) ?? 0) + 1)
  return ok(n)
}

/**
 * 棚に語を置く(トレーナーと管理者だけ。門番は RLS)。
 *
 * **すでにある語は上書きする**(`upsert`)。作り直したときに
 * 訳や例文を直せないと、**間違ったまま直せない棚**になる。
 * ただし**ゲストの単語帳には1文字も触らない** ——
 * あちらは押したときに写した控えなので、ここを直しても動かない。
 *
 * @param industry 棚の id
 * @param rows     `{ word, ja, pos, kind, en, enJa, scene, level }` の一覧
 * @returns {number} 置いた語数
 */
export async function saveShelfWords(industry, rows) {
  if (!supabase) return ng(new Error('Supabase が設定されていません'))
  if (!supported) return ng(notYet())
  if (!industry) return ng(new Error('どの単語帳に入れるのかが決まっていません'))

  /* **そろえ方は `normWord()` 1か所。** ここで書き写さない
     (SQL / 窓口 / 画面の3か所でそろえてある規則である) */
  const seen = new Set()
  const put = []
  for (const r of rows ?? []) {
    const norm = normWord(r?.word)
    if (!norm || seen.has(norm)) continue   // **同じ棚に同じ語を二度置かない**
    seen.add(norm)
    put.push({
      industry,
      word_norm: norm,
      display: String(r?.word ?? '').trim(),
      /* 空白を含めば句。**判定はここ1か所**(`WordbookAdd` と同じ規則) */
      kind: String(r?.kind ?? '') || (/\s/.test(String(r?.word ?? '').trim()) ? 'phrase' : 'word'),
      pos: String(r?.pos ?? '').trim(),
      meaning_ja: String(r?.ja ?? '').trim(),
      example_en: String(r?.en ?? '').trim(),
      example_ja: String(r?.enJa ?? '').trim(),
      scene: String(r?.scene ?? '').trim(),
      level: String(r?.level ?? '').trim(),
    })
    if (put.length >= MAX_SAVE) break
  }
  if (!put.length) return ok(0)

  const { error } = await supabase
    .from('shelf_words')
    .upsert(put, { onConflict: 'industry,word_norm' })
  if (error) {
    if (missing(error)) { supported = false; return ng(notYet()) }
    return ng(error)
  }
  return ok(put.length)
}

/** 棚から1語だけ外す(見直して、要らないと決めたとき) */
export async function dropShelfWord(industry, wordNorm) {
  if (!supabase) return ng(new Error('Supabase が設定されていません'))
  const { error } = await supabase
    .from('shelf_words')
    .delete()
    .eq('industry', industry)
    .eq('word_norm', wordNorm)
  if (error) {
    if (missing(error)) { supported = false; return ng(notYet()) }
    return ng(error)
  }
  return ok(true)
}

/* ──────────────────────────────────────────────────────────────
 * **`addShelfWords()` は、道具ごと消した**(0058・2026-09 利用者の指定)
 *
 *   > 最終的にこうやって混ぜたくないんですよ。
 *   > これは独立した単語帳にしたいんです。
 *
 *   あれは棚の語を `word_reviews` に入れる —— つまり
 *   **自分の単語帳に混ぜる**ための道だった。混ぜないと決めたので、
 *   **値を偽にせず、関数ごと消す**(CLAUDE.md)。
 *   SQL の `add_shelf_words()` も 0058 が落としている。
 *
 *   棚はいま、`shelfReviews.js` を通して**それだけで練習できる。**
 * ────────────────────────────────────────────────────────────── */
