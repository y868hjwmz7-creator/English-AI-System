/**
 * 自分のアイコン(2026-09 利用者の指定)。
 *
 *   > 空いたスペースには、ゲストが選んだアイコンを入れれるとよいです。
 *
 * 【出すのと、選ぶのを分けてある】
 *   ・`<Avatar>`       … 丸の中に出すだけ。トレーナーのゲスト一覧など
 *   ・`<AvatarPicker>` … 自分で選ぶ。**左のメニューの下、自分の名前の隣**
 *
 *   **選べるのは本人だけ。** トレーナーの画面では出すだけにしてある
 *   (人のアイコンを勝手に変えられるようにはしない)。
 *
 * 【選んでいない人も、空の丸にしない】
 *   名前の頭文字を出す(`initialOf`)。空の丸だと、選び忘れなのか
 *   まだ読めていないのかが見分けられない。
 *
 * 【色は名前から決める】
 *   同じ人はいつも同じ色になる。並んだときに見分けやすく、
 *   **こちらが色を持たなくてよい**(表も列も増えない)。
 */
import { useEffect, useRef, useState } from 'react'
import { AVATAR_GROUPS, initialOf } from '../data/avatars.js'
import { CloseIcon } from './Icons.jsx'

/** 名前から決まる色。**同じ名前なら必ず同じ色**になる */
const hueOf = (name) => {
  let h = 0
  for (const ch of (name ?? '')) h = (h * 31 + ch.codePointAt(0)) % 360
  return h
}

/**
 * @param {string} name    その人の名前(頭文字と色に使う)
 * @param {string} avatar  選んだアイコン。無ければ頭文字を出す
 * @param {'sm'|'md'|'lg'} size
 */
export default function Avatar({ name = '', avatar = null, size = 'md', className = '' }) {
  const pic = (avatar ?? '').trim()
  return (
    <span className={`avatar avatar--${size}${pic ? ' avatar--pic' : ''} ${className}`}
          style={pic ? undefined : { '--avatar-hue': hueOf(name) }}
          aria-hidden="true">
      {pic || initialOf(name)}
    </span>
  )
}

/**
 * 自分のアイコンを選ぶ。押すと一覧が開く。
 *
 * 【閉じ方は3つとも用意する】
 *   外側を押す / Esc / もう一度押す。メニューの中に出るので、
 *   1つしか無いと閉じ方を探すことになる(サイドメニューと同じ考え方)。
 *
 * @param {string} name
 * @param {string} value    いま選んでいるもの
 * @param {Function} onPick 選んだとき。`null` なら「使わない」
 */
export function AvatarPicker({ name = '', value = null, onPick }) {
  const [open, setOpen] = useState(false)
  const boxRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const onDown = (e) => { if (!boxRef.current?.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false) } }
    document.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [open])

  const pick = (v) => { onPick?.(v); setOpen(false) }

  return (
    <span className="avatar-pick" ref={boxRef}>
      <button type="button" className="avatar-pick-btn"
              aria-expanded={open}
              title="自分のアイコンを選ぶ"
              onClick={() => setOpen((x) => !x)}>
        <Avatar name={name} avatar={value} size="sm" />
        <span className="sr-only">自分のアイコンを選ぶ</span>
      </button>

      {open && (
        <div className="avatar-menu">
          <div className="avatar-menu-head">
            <span className="avatar-menu-title">アイコンを選ぶ</span>
            <button type="button" className="nav-icon-btn"
                    onClick={() => setOpen(false)} aria-label="閉じる">
              <CloseIcon />
            </button>
          </div>
          <div className="avatar-menu-body">
            {AVATAR_GROUPS.map((g) => (
              <div key={g.label} className="avatar-group">
                <span className="avatar-group-label">{g.label}</span>
                <div className="avatar-grid">
                  {g.items.map((it) => (
                    <button key={it} type="button"
                            className={`avatar-opt${value === it ? ' is-on' : ''}`}
                            aria-pressed={value === it}
                            onClick={() => pick(it)}>
                      {it}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {/* **選ばない道も残す。** 選び直せないと、押すのがこわい */}
          <button type="button" className="btn btn--ghost btn--small avatar-clear"
                  onClick={() => pick(null)}>
            アイコンを使わない(頭文字にする)
          </button>
        </div>
      )}
    </span>
  )
}
