/**
 * 弱点タグを選ぶ部品。教材を探すときと作るときの両方で使う。
 *
 * 「基礎ドリル」(全子音の基本練習)は、弱点として指摘するものではないので
 * 弱点を選ぶ場面では出さない。教材を分類する場面では出す。
 */
import { weaknessTagsByCategory } from '../data/weaknessTags.js'

export default function WeaknessTagPicker({ selected = [], onChange, includeDrills = true }) {
  const toggle = (id) =>
    onChange(selected.includes(id) ? selected.filter((t) => t !== id) : [...selected, id])

  return (
    <div className="tagpicker">
      {weaknessTagsByCategory().map((category) => {
        const tags = category.tags.filter((t) => includeDrills || t.kind === 'weakness')
        if (!tags.length) return null
        return (
          <div key={category.id} className="tagpicker-group">
            <span className="tagpicker-label">{category.label}</span>
            <div className="tagpicker-tags">
              {tags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  className={`tagchip${selected.includes(tag.id) ? ' is-on' : ''}`}
                  onClick={() => toggle(tag.id)}
                  title={tag.hint ?? ''}
                  aria-pressed={selected.includes(tag.id)}
                >
                  {tag.label}
                </button>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
