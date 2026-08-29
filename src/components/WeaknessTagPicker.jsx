/**
 * 弱点タグを選ぶ部品。教材を探すときと作るときの両方で使う。
 *
 * 【なぜ閉じておくのか】(2026-08 利用者の指定)
 *   タグは44個ある。全部を並べると、スマホでは画面が3つ分ほど埋まり、
 *   その下にある「作る」ボタンまで届かない。
 *   **はじめは見出しだけを出し、必要な見出しだけ開く。**
 *
 *   見出しは6つ。発音 / リズム / 文法 / 表現 / 単語 / 流暢性。
 *   発音の中は「子音」「母音」の小見出しでさらに分けてある。
 *
 * 【選んだものは、閉じていても見える】
 *   閉じた見出しの中で選んだタグが見えないと、
 *   **何を選んだのか分からなくなる。** 見出しの行に数を出し、
 *   選んだタグは上にまとめて並べる。そこから外すこともできる。
 */
import { useState } from 'react'
import { groupsOf, weaknessTagLabel, weaknessTagsByCategory } from '../data/weaknessTags.js'

export default function WeaknessTagPicker({
  selected = [], onChange, includeDrills = true, defaultOpen = null,
}) {
  const [open, setOpen] = useState(() => (defaultOpen ? [defaultOpen] : []))

  const toggleTag = (id) =>
    onChange(selected.includes(id) ? selected.filter((t) => t !== id) : [...selected, id])

  const toggleOpen = (id) =>
    setOpen(open.includes(id) ? open.filter((x) => x !== id) : [...open, id])

  const categories = weaknessTagsByCategory()
    .map((c) => ({ ...c, tags: c.tags.filter((t) => includeDrills || t.kind === 'weakness') }))
    .filter((c) => c.tags.length)

  return (
    <div className="tagpicker">
      {/* いま選んでいるもの。**閉じていても見える場所に置く** */}
      {selected.length > 0 && (
        <div className="tagpicker-chosen">
          <span className="tagpicker-chosen-label">選んでいる弱点</span>
          <div className="tagpicker-tags">
            {selected.map((id) => (
              <button key={id} type="button" className="tagchip is-on"
                      onClick={() => toggleTag(id)}
                      title="押すと外します">
                {weaknessTagLabel(id)}<span className="tagchip-x">✕</span>
              </button>
            ))}
          </div>
          <button type="button" className="btn btn--link" onClick={() => onChange([])}>
            すべて外す
          </button>
        </div>
      )}

      {categories.map((category) => {
        const count = category.tags.filter((t) => selected.includes(t.id)).length
        const isOpen = open.includes(category.id)
        return (
          <div key={category.id} className={`tagcat${isOpen ? ' is-open' : ''}`}>
            <button type="button" className="tagcat-head"
                    aria-expanded={isOpen}
                    onClick={() => toggleOpen(category.id)}>
              <span className="tagcat-mark">{isOpen ? '▾' : '▸'}</span>
              <span className="tagcat-name">{category.label}</span>
              {count > 0 && <span className="tagcat-count">{count}</span>}
              <span className="tagcat-hint">{category.hint}</span>
            </button>

            {isOpen && (
              <div className="tagcat-body">
                {groupsOf(category.tags).map((group) => (
                  <div key={group.name} className="tagpicker-group">
                    {group.name && <span className="tagpicker-label">{group.name}</span>}
                    <div className="tagpicker-tags">
                      {group.tags.map((tag) => (
                        <button
                          key={tag.id}
                          type="button"
                          className={`tagchip${selected.includes(tag.id) ? ' is-on' : ''}`}
                          onClick={() => toggleTag(tag.id)}
                          title={tag.hint ?? ''}
                          aria-pressed={selected.includes(tag.id)}
                        >
                          {tag.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
