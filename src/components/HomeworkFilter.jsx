/**
 * 過去の宿題の絞り込み — **日付・分野・場面・苦手項目。**
 *
 * 【なぜ要るか】(2026-08 利用者の指定)
 *
 *   > ここも日付のタブを入れ、その中に新しい順、古い順の機能を
 *   > まとめてくれ。日付タブの右に業界、趣味、シチュエーション、話題で
 *   > 絞り込む機能を、そしてもう一つは苦手項目から絞り込む機能だ
 *
 *   レッスンの前に「この人に、この分野で何を出したか」を引きたい。
 *   宿題は溜まっていくので、並んでいるだけでは探せなくなる。
 *
 * 【単語帳の絞り込みと、同じ考え方でそろえてある】
 *   ・**選択肢が1つ以下の欄は出さない**(効かない操作を見せない・CLAUDE.md)
 *   ・**場面と話題は1つの欄。** 教材はどちらか一方しか持たないので、
 *     分けると片方はいつも空になる
 *   ・**日付にまつわる操作は、日付の吹き出しの中にまとめる**(並び順も)
 *   ・絞り込みは**手元で行う。** 選ぶたびに Supabase へ聞き直さない
 *
 * 【カレンダーは共通の部品】
 *   `CalendarPopover` を単語帳と分け合っている。
 *   **同じ見た目を2か所に書き写さない。**
 */
import { useRef, useState } from 'react'
import { toDateKey } from '../lib/format.js'
import CalendarPopover from './CalendarPopover.jsx'
import { industryLabel } from '../data/industries.js'
import { genreLabel, sceneLabel } from '../data/genres.js'
import { weaknessTagLabel } from '../data/weaknessTags.js'
import { CalendarIcon, CloseIcon } from './Icons.jsx'

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
 * 絞り込みを当てる。**判断はここ1か所。** 画面ごとに書くとずれる。
 *
 * @param {Array} rows 宿題ぜんぶ
 * @param {{day, field, topic, tag}} filter
 */
export function applyHomeworkFilter(rows, filter) {
  const { day = null, field = null, topic = null, tag = null } = filter ?? {}
  if (!day && !field && !topic && !tag) return rows
  return (rows ?? []).filter((a) => {
    if (day && assignedDayOf(a) !== day) return false
    if (field && fieldOfAssignment(a)?.key !== field) return false
    if (topic && topicOfAssignment(a)?.key !== topic) return false
    if (tag && !(a.material?.tagIds ?? []).includes(tag)) return false
    return true
  })
}

export default function HomeworkFilter({
  rows, value, onChange, sort, onSort,
}) {
  const [openCal, setOpenCal] = useState(false)
  const btnRef = useRef(null)

  const list = rows ?? []
  const { day = null, field = null, topic = null, tag = null } = value ?? {}

  const days = [...new Set(list.map(assignedDayOf).filter(Boolean))].sort().reverse()

  /** 同じものを2度並べない。鍵で1つにまとめる */
  const uniq = (pairs) => {
    const seen = new Map()
    for (const x of pairs) if (x && !seen.has(x.key)) seen.set(x.key, x)
    return [...seen.values()]
  }
  const fields = uniq(list.map(fieldOfAssignment))
    .sort((a, b) => a.label.localeCompare(b.label, 'ja'))
  const topics = uniq(list.map(topicOfAssignment))
  const scenes = topics.filter((t) => t.group === 'シチュエーション')
  const genres = topics.filter((t) => t.group === '話題')

  /* 苦手項目(弱点タグ)。**その人に出したものだけ**が出る。
     39個ぜんぶ並べても、ほとんどが0件で選びようがない */
  const tagCounts = new Map()
  for (const a of list) {
    for (const t of a.material?.tagIds ?? []) {
      tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1)
    }
  }
  const tags = [...tagCounts.entries()].sort((x, y) => y[1] - x[1])

  const show = {
    day: days.length > 1,
    field: fields.length > 1,
    topic: topics.length > 1,
    tag: tags.length > 1,
  }
  // **日付の吹き出しには並び順も入っている**ので、並べ替えられるなら出す
  if (onSort && days.length > 0) show.day = true
  if (!Object.values(show).some(Boolean)) return null

  const on = Boolean(day || field || topic || tag)
  const set = (patch) => onChange({ ...value, ...patch })

  return (
    <div className="wbfilter">
      {show.day && (
        <button type="button" ref={btnRef}
                className={`btn btn--small ${day ? 'btn--quiet' : 'btn--ghost'}`}
                aria-expanded={openCal}
                onClick={() => setOpenCal((x) => !x)}>
          <CalendarIcon />
          {day ? day.replace(/^\d{4}-/, '').replace('-', '/') : '日付・並び順'}
        </button>
      )}

      {show.field && (
        <label className="wbfilter-pick">
          <span className="sr-only">分野で絞る</span>
          <select value={field ?? ''} onChange={(e) => set({ field: e.target.value || null })}>
            <option value="">分野: すべて</option>
            {fields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select>
        </label>
      )}

      {show.topic && (
        <label className="wbfilter-pick">
          <span className="sr-only">場面・話題で絞る</span>
          <select value={topic ?? ''} onChange={(e) => set({ topic: e.target.value || null })}>
            <option value="">場面・話題: すべて</option>
            {scenes.length > 0 && (
              <optgroup label="シチュエーション">
                {scenes.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
              </optgroup>
            )}
            {genres.length > 0 && (
              <optgroup label="話題">
                {genres.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
              </optgroup>
            )}
          </select>
        </label>
      )}

      {show.tag && (
        <label className="wbfilter-pick">
          <span className="sr-only">苦手項目で絞る</span>
          <select value={tag ?? ''} onChange={(e) => set({ tag: e.target.value || null })}>
            <option value="">苦手項目: すべて</option>
            {tags.map(([t, n]) => (
              <option key={t} value={t}>{weaknessTagLabel(t)}({n})</option>
            ))}
          </select>
        </label>
      )}

      {on && (
        <button type="button" className="btn btn--ghost btn--small"
                onClick={() => onChange({ day: null, field: null, topic: null, tag: null })}>
          <CloseIcon />すべて
        </button>
      )}

      {openCal && (
        <CalendarPopover
          anchorEl={btnRef.current}
          days={days}
          value={day}
          onPick={(d) => set({ day: d })}
          onClose={() => setOpenCal(false)}
          sort={sort}
          onSort={onSort}
          sortOptions={[
            { id: 'new', label: '新しい順' },
            { id: 'old', label: '古い順' },
          ]}
        />
      )}
    </div>
  )
}
