/**
 * 文型ドリルで「どの単語帳の、どのレベルの、どの品詞の語を使うか」を決める
 * (2026-09 利用者の指定)。
 *
 *   > 文型トレーニングに、どの単語帳からどのレベルのどの品詞を使用するか、
 *   > を指定できるようにしたい。
 *
 * ────────────────────────────────────────────────────────────────
 * 【新しい仕組みを1つも作っていない】
 *
 *   語の渡し先は**すでにある `mustUse`**(窓口へは `reviewWords` として
 *   渡り、「それぞれ1回以上、問題文か本文の中で使うこと」と伝わる)。
 *   だから **SQL も、窓口の置き直しも要らない。** `FN_REV` も進めない。
 *
 *   | 何          | どの道を使うか                                    |
 *   |-------------|---------------------------------------------------|
 *   | ゲストの単語帳 | `loadMyWordbook()`(`review_words()`)           |
 *   | 業種べつ     | `loadShelfWordbook()`(`shelf_words`・0057)       |
 *   | 基礎単語     | `basicRows()`(ファイル。**問い合わせ0回・0円**)  |
 *   | 絞り込み     | **`applyWordbookFilter()`**(単語帳とまったく同じ) |
 *
 *   **3つとも行の形が同じ**(`review_words()` にそろえてある)ので、
 *   絞り方を書き分けずに済む。**数え方を2通り持たない。**
 *
 * 【ここには Supabase を持ち込まない】
 *   読み込みは呼ぶ側(`MaterialForm`)がする。ここは**算段だけ**なので、
 *   `npm run test:play` が素の node でそのまま走らせられる
 *   (`playMark.js` / `mp3Join.js` と同じ考え方)。
 */
import { applyWordbookFilter } from './wordbookFilter.js'
import { cefrIndex } from '../data/cefr.js'

/* ── どの単語帳から取るか ──────────────────────────────────── */

/**
 * 冊の一覧。**画面に書き写さない。**
 *
 * 単語帳の画面(`Wordbook.jsx`)の3冊と、**同じ呼び名**にしてある ——
 * 同じものが場所によって違う名前で出ると、選ぶときに迷う。
 */
export const WORD_BOOKS = [
  { id: 'learner', label: 'ゲストの単語帳', hint: 'そのゲストが出会った語' },
  { id: 'shelf',   label: '業種べつの単語帳', hint: '業種ごとに用意した語' },
  { id: 'basic',   label: '基礎単語', hint: '中学英語の 360 語 / 1200 語' },
]

/**
 * 出せる冊だけを返す。**効かない操作を見せない。**
 *
 * ゲストの単語帳は「**誰の**単語帳か」が決まらないと引けないので、
 * **ゲストを1人だけ選んでいるとき**にしか出さない
 * (「これまでの宿題から復習する」とまったく同じ決まり)。
 */
export function booksFor({ hasLearner = false } = {}) {
  return WORD_BOOKS.filter((b) => b.id !== 'learner' || hasLearner)
}

/** 基礎単語の段。**`basicsCourse.js` の `BASIC_TIERS` と同じ2つ** */
export const BASIC_TIERS = [
  { id: 'core', label: '基本360語' },
  { id: 'full', label: '標準1200語' },
]

/* ── 何語使うか ────────────────────────────────────────────── */

/**
 * いちど足せる上限。
 *
 * **`mustUse` の 20 語**(`MaterialForm` が `initial` を切っている数)に
 * そろえてある。文型ドリルは 4演習 × 10問 = 40問なので、
 * 20 語なら**おおむね2問に1語**になる。
 * それ以上は「不自然に詰め込まない」と窓口が断るだけである。
 */
export const MAX_DRILL_WORDS = 20

/** 選べる語数。**上限を超えるものは出さない** */
export const DRILL_COUNTS = [5, 10, 15, 20]

/* ── 選択肢を、いまある語から作る ──────────────────────────── */

/**
 * 行から、選べる選択肢を作る。
 *
 * **固定の一覧を持たない。** レベルも品詞も、**実際に引けた語**から
 * 組み立てる。だから
 *   ・基礎単語(レベルを持たない)では、レベルの欄がそもそも出ない
 *   ・動詞が1語も無い棚では、「動詞」が選択肢に並ばない
 * という、正しい振る舞いがひとりでに出る
 * (`WordbookFilter` とまったく同じ考え方)。
 *
 * **選べるものが1つ以下なら空を返す** —— 選んでも何も変わらない欄を
 * 見せない(**効かない操作を見せない**)。
 *
 * @param rows 単語帳の行
 * @param of   `levelOf` / `posOf`(`wordbookFilter.js`)
 */
export function optionsOf(rows, of) {
  const seen = new Map()
  for (const r of rows ?? []) {
    const hit = of(r)
    if (!hit) continue
    const cur = seen.get(hit.key)
    if (cur) cur.count += 1
    else seen.set(hit.key, { key: hit.key, label: hit.label, count: 1 })
  }
  if (seen.size <= 1) return []
  const out = [...seen.values()]
  /* レベルだけは**やさしい順**にそろえる(`cefrIndex`)。
     品詞は `POS_GROUPS` の並びで来るので、そのままでよい */
  if (out.every((o) => cefrIndex(o.key) >= 0)) {
    out.sort((a, b) => cefrIndex(a.key) - cefrIndex(b.key))
  }
  return out
}

/* ── 絞って、使う語を取り出す ──────────────────────────────── */

/**
 * レベルと品詞で絞る。**絞り方は `applyWordbookFilter()` 1か所。**
 * 単語帳の絞り込みとまったく同じものを通すので、
 * 「単語帳でこう絞ったときに出る語」と必ず一致する。
 */
export const narrowRows = (rows, { level = null, pos = null } = {}) =>
  applyWordbookFilter(rows ?? [], { level, pos })

/** 語そのもの(画面に出す形)。**空の行は落とす** */
const wordOf = (r) => String(r?.display || r?.word_norm || '').trim()

/**
 * 絞った中から、使う語を選ぶ。
 *
 * **混ぜてから取る。** 先頭から取ると、基礎単語では
 * **いつも1日目の語(i / you / am)**しか出てこない。
 * 混ぜておけば「作り直す」で別の語になり、
 * **同じような教材を作らない**(0046)という決まりにも沿う。
 *
 * @param seed 混ぜ方を決める数。**渡さなければ毎回ちがう**
 */
export function pickWords(rows, { level = null, pos = null, count = 10, seed = null } = {}) {
  const pool = narrowRows(rows, { level, pos }).map(wordOf).filter(Boolean)
  /* **同じ語を2回入れない**(そろえた形で見る必要はない ——
     ここへ来る行は、もともと単語帳の中で重複しない) */
  const uniq = [...new Set(pool)]
  const n = Math.max(0, Math.min(Number(count) || 0, MAX_DRILL_WORDS, uniq.length))
  if (!n) return []
  /* 混ぜる。`seed` を渡すと同じ並びになる(検証のため) */
  let s = seed == null ? null : Number(seed) >>> 0
  const rand = () => {
    if (s == null) return Math.random()
    /* 小さな擬似乱数。**検証のためだけ**で、鍵には使わない */
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
  const a = uniq.slice()
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a.slice(0, n)
}

/* ── 演習ごとに配る ────────────────────────────────────────── */

/**
 * 語を、演習の数だけに配る。
 *
 * **文型ドリルは4演習ある。** ところがこれまで復習の語は
 * **最初の演習にだけ**渡していた(`i === 0 ? … : []`)ので、
 * 20 語を選んでも**10問ぶんの1演習に押し込まれ**、
 * 窓口の「不自然に詰め込まない。入りきらなければ全部使わなくてよい」で
 * ほとんどが落ちていた。**配れば、40問ぜんぶに行き渡る。**
 *
 * **前から順に配る**(混ぜ直さない)。`mustUse` はトレーナーが名指しで
 * 選んだ語が先に来る並びなので、**その順を崩さない。**
 *
 *   20 語 / 4演習 → 5, 5, 5, 5
 *   10 語 / 4演習 → 3, 3, 2, 2   ← 余りは前の演習へ
 *    2 語 / 4演習 → 1, 1, 0, 0   ← **足りなければ空でよい**
 */
export function spreadWords(words, parts) {
  const list = (words ?? []).filter(Boolean)
  const n = Math.max(0, Math.floor(Number(parts) || 0))
  if (!n) return []
  const out = Array.from({ length: n }, () => [])
  if (!list.length) return out
  const base = Math.floor(list.length / n)
  const extra = list.length % n
  let at = 0
  for (let i = 0; i < n; i += 1) {
    const take = base + (i < extra ? 1 : 0)
    out[i] = list.slice(at, at + take)
    at += take
  }
  return out
}
