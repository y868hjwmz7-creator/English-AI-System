/**
 * **出会った時期**(第5.414節・2026-10-07 利用者の指定・段階3)。
 *
 * ============================================================================
 * 【なぜ1つにまとめたか】
 *
 *   > 「出会った時期」と「日付」はどちらも単語帳に入った日で絞っているので、
 *   > 1つに統合する。
 *
 *   出しかたの札に「1週間以内 / 2週間以内 / …」があり、
 *   絞り込みの中に**カレンダーで1日を選ぶ「日付」**があった。
 *   **どちらも `added_at`(単語帳・復習に入った日)を見ている。**
 *   それなのに**別の場所にあり、片方を選んでももう片方が残る。**
 *
 *   いまは**欄1つ・値1つ**である。
 *   入るのは**範囲の id**(`d7`)か、**その日そのもの**(`2026-10-01`)。
 *
 * 【ここに置いた理由】
 *   `reviewScope.js` は `wordbookFilter.js` から `FILTER_KEYS` を読み、
 *   `wordbookFilter.js` は範囲の当て方が要る。**行き合いになる**ので、
 *   どちらも依存しない形でここへ出した
 *   (`playMark.js` / `learnStage.js` と同じ作法)。
 *   **素の node で走る**ので `npm run test:play` が数字で見張れる。
 */
import { toDateKey } from './format.js'

/** 今日(端末の日付)。"2026-08-30" */
export const todayKey = () => toDateKey(new Date())

/**
 * n 日前の日付キー。
 *
 * **日付そのもので比べる**ので、時差でずれない。
 */
export function daysAgo(n, today = todayKey()) {
  const d = new Date(`${today}T00:00:00`)
  if (Number.isNaN(d.getTime())) return today
  d.setDate(d.getDate() - Number(n || 0))
  return toDateKey(d)
}

/**
 * その行が単語帳・復習に入った日。無ければ null。
 *
 * **`toDateKey` を通す**(端末の日付に直す)。`.slice(0, 10)` だと
 * 世界標準時の日付になり、夜の語が前日になる。
 * **数え方を2通り持たない** —— 前は `reviewScope.js` と
 * `wordbookFilter.js` に**同じものが2つ**書いてあった(第5.414節で1つにした)。
 */
export const addedDayOf = (row) => (row?.added_at
  ? toDateKey(new Date(row.added_at))
  : null)

/**
 * **範囲の一覧**(2026-09 利用者の指定)。
 *
 *   > 出題範囲の時系列での絞りかた(例:１週間以内・２週間以内・
 *   > ３週間以内・１か月以内・３か月以内・半年以内 etc...)
 *
 * **1つも減らしていない。** 置き場所が「出しかたの札」から
 * 「詳しくしぼる」の中へ移っただけである(**勝手に狭めない**・CLAUDE.md)。
 */
export const MET_RANGES = [
  { id: 'd7', days: 7, label: '1週間以内' },
  { id: 'd14', days: 14, label: '2週間以内' },
  { id: 'd21', days: 21, label: '3週間以内' },
  { id: 'd30', days: 30, label: '1か月以内' },
  { id: 'd90', days: 90, label: '3か月以内' },
  { id: 'd182', days: 182, label: '半年以内' },
]

export const metRangeOf = (id) => MET_RANGES.find((r) => r.id === id) ?? null

/** その日そのものか("2026-10-01" の形) */
export const isDayKey = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v ?? ''))

/**
 * 欄に出す言い方。**判断は1か所** —— 画面で `v === 'd7' ? …` と書かない。
 *
 * ・空 … 「すべて」
 * ・範囲 … 「1週間以内」
 * ・日 … 「10/01」(年は落とす。欄が狭い)
 */
export function metLabel(v) {
  const s = String(v ?? '')
  if (!s) return 'すべて'
  const r = metRangeOf(s)
  if (r) return r.label
  if (isDayKey(s)) return s.replace(/^\d{4}-/, '').replace('-', '/')
  return 'すべて'
}

/**
 * その行が、その指定に当てはまるか。
 *
 * **出会った日が分からないもの(0024 を貼る前に入った古い行)は入らない** ——
 * 当てずっぽうで入れない。**指定していなければ、ぜんぶ通す。**
 */
export function inMet(row, v, today = todayKey()) {
  const s = String(v ?? '')
  if (!s) return true
  const day = addedDayOf(row)
  if (!day) return false
  const r = metRangeOf(s)
  if (r) return day >= daysAgo(r.days, today)
  if (isDayKey(s)) return day === s
  return true
}

/**
 * その指定で何件あるか。**数が見えないと選べない**(第5.245節と同じ考え方)。
 */
export const metCount = (rows, v, today = todayKey()) =>
  (rows ?? []).filter((r) => inMet(r, v, today)).length
