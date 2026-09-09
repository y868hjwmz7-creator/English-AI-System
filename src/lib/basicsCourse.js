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

/**
 * その日・その段の語。
 *
 * **厳選360 は「1200 の一部」である。** 別の一覧を持たない ——
 * 2つ持つと、片方だけ直したときに食い違う。
 *
 * @param no   何日目か(1〜30)
 * @param tier 'core'(厳選360)/ 'full'(中学英語1200)
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
