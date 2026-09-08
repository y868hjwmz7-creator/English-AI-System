/**
 * 宿題の一覧を「絞る・引く・並べる」—— **判断はここ1か所。**
 *
 * 【なぜ画面から出したか】(2026-09 利用者の指定)
 *
 *   > ③ ゲストのページの中で、教材をさがせます(中略)
 *   > これを、ゲストとしてログインし、今日の宿題のところにも実装してください
 *
 *   同じ絞り込みが**2つの画面**に出ることになった。
 *
 *     ・トレーナーが見る「過去の宿題」(`TrainerLearners`)
 *     ・ゲスト自身の「今週の宿題」(`LearnerHomework`)
 *
 *   絞る規則・引く規則・並べる規則を画面ごとに書くと、必ず食い違う
 *   (トレーナーの画面では出るのに、ゲストの画面では出ない、が起きる)。
 *   **数え方を2通り持たない**(CLAUDE.md)。
 *
 * 【なぜ `HomeworkFilter.jsx` の中に置かないか】
 *   あちらは JSX なので、**素の node で一度も走らせられない**
 *   (`playMark.js` / `mp3Join.js` と同じ考え方)。
 *   ここに置けば `npm run test:play` が中身そのものを見張れる。
 *   `HomeworkFilter.jsx` はここから読み直して出し直しているので、
 *   **呼ぶ側は1行も変わっていない。**
 */
import { toDateKey } from './format.js'
import { industryLabel } from '../data/industries.js'
import { genreLabel, sceneLabel } from '../data/genres.js'

/** 出した日("2026-08-29")。無ければ null */
export const assignedDayOf = (a) => (a?.assigned_at
  ? toDateKey(new Date(a.assigned_at)) : null)

/** その宿題の分野(業界・趣味) */
export const fieldOfAssignment = (a) => (a?.material?.industry
  ? { key: a.material.industry, label: industryLabel(a.material.industry) }
  : null)

/** その宿題の場面・話題。**教材はどちらか一方しか持たない** */
export const topicOfAssignment = (a) => {
  const m = a?.material
  if (m?.scene) return { key: `s:${m.scene}`, label: sceneLabel(m.scene), group: 'シチュエーション' }
  if (m?.genre) return { key: `g:${m.genre}`, label: genreLabel(m.genre), group: '話題' }
  return null
}

/**
 * 絞り込みを当てる。
 *
 * @param {Array} rows 宿題ぜんぶ
 * @param {{day, field, topic, tag}} filter
 */
export function applyHomeworkFilter(rows, filter) {
  const { day = null, field = null, topic = null, tag = null } = filter ?? {}
  if (!day && !field && !topic && !tag) return rows ?? []
  return (rows ?? []).filter((a) => {
    if (day && assignedDayOf(a) !== day) return false
    if (field && fieldOfAssignment(a)?.key !== field) return false
    if (topic && topicOfAssignment(a)?.key !== topic) return false
    if (tag && !(a.material?.tagIds ?? []).includes(tag)) return false
    return true
  })
}

/**
 * 絞って・引いて・並べる。**画面はこれを呼ぶだけ。**
 *
 * @param {Array} rows
 * @param {{filter, keyword, done, sort}} opts
 *   done … `'all'`(既定)/ `'done'`(やった)/ `'todo'`(まだ)
 *   sort … `'new'`(既定・新しい順)/ `'old'`(古い順)
 */
export function narrowHomework(rows, opts = {}) {
  const { filter = null, keyword = '', done = 'all', sort = 'new' } = opts
  // **大文字小文字は問わない。** 教材名は英語の見出しを含む
  const needle = String(keyword ?? '').trim().toLowerCase()
  return applyHomeworkFilter(rows, filter)
    .filter((a) => (done === 'all' || (done === 'done') === !!a.learner_done_at))
    .filter((a) => (!needle
      || `${a.material?.title ?? ''} ${a.material?.headline ?? ''}`
        .toLowerCase().includes(needle)))
    .sort((x, y) => (sort === 'old'
      ? new Date(x.assigned_at) - new Date(y.assigned_at)
      : new Date(y.assigned_at) - new Date(x.assigned_at)))
}

/** 絞り込みが1つでも掛かっているか(「すべて」を出すかどうか) */
export const homeworkFilterOn = (filter) => Boolean(
  filter?.day || filter?.field || filter?.topic || filter?.tag,
)

/** まっさらな絞り込み */
export const emptyHomeworkFilter = () => ({
  day: null, field: null, topic: null, tag: null,
})
