/**
 * 左のメニュー(サイドメニュー)と、その上の帯。
 *
 * 【なぜタブをやめたのか】(2026-08 利用者の指定)
 *   > スマホ、パッドでは「ハンバーガーメニュー」も導入してください。
 *   > PCでもサイドメニューを開閉できるデザインに。
 *
 *   横に並べたタブは、画面が6つになると**スマホで必ずはみ出す。**
 *   横に流して見せてはいたが、「いま何個あるのか」が分からず、
 *   端の項目は指でなぞらないと出てこなかった。
 *   縦に並べれば、**数がそのまま見える。**
 *
 * 【2つの形を、1つの部品で出す】
 *   | 画面の幅 | 形 |
 *   |---|---|
 *   | 1024px 以上(PC) | 画面を**押し出して**並ぶ。細くたたむと絵だけになる |
 *   | 1024px 未満(スマホ・パッド) | ふだんは隠れ、☰ で**かぶせて**開く |
 *
 *   **どちらも同じ中身**である。作り分けると、片方だけ直し忘れる。
 *   幅の判定は `useWide()` 1か所(`src/lib/nav.js`)。
 *
 * 【閉じ方は4つとも用意する】
 *   かぶせて開いているときは、**外側を押す / ✕ / Esc / 項目を選ぶ**の
 *   どれでも閉じる。1つしか無いと、閉じ方を探すことになる。
 */
import { useEffect, useRef } from 'react'
import { CloseIcon, MenuIcon } from './Icons.jsx'

/**
 * **青い小さな丸**(2026-09 利用者の指定)。
 *
 *   > 完成した際も音に加えて視覚的にもわかるサインをください。
 *   > 例えばサイドバーとトップバーの教材の横に青い小さな丸が点灯する、など
 *
 * 音は聞こえないことがある(音を切っている・レッスン中・席を外している)。
 * **目でも分かる印を、同じ場所に残しておく。**
 *
 * - `running` … 作っている最中。**ゆっくり息をする**
 * - `done`    … できあがって、まだ受け取っていない。**点きっぱなし**
 *
 * **色だけに頼らない**(CLAUDE.md)。読み上げにも言葉で伝える。
 */
const DOT_TEXT = { running: '作っています', done: '下書きができました' }

function NavDot({ kind, onIcon = false }) {
  return (
    <span className={`nav-dot nav-dot--${kind}${onIcon ? ' nav-dot--on-icon' : ''}`}>
      <span className="visually-hidden">{DOT_TEXT[kind] ?? ''}</span>
    </span>
  )
}

export default function AppNav({
  items, value, onChange, open, onClose, wide, title, footer,
}) {
  const panelRef = useRef(null)
  const list = (items ?? []).filter(Boolean)
  const drawer = !wide && open      // かぶせて開いている状態

  // かぶせて開いているあいだは、後ろの画面を動かさない。
  // 動くと「どっちを触っているのか」が分からなくなる。
  useEffect(() => {
    if (!drawer) return undefined
    const before = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = before }
  }, [drawer])

  // Esc で閉じる。**開いているものから閉じる**(画面ごと閉じない)
  useEffect(() => {
    if (!drawer) return undefined
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [drawer, onClose])

  // 開いたら、中の最初のボタンへ移る。キーボードだけで使う人のため
  useEffect(() => {
    if (drawer) panelRef.current?.querySelector('button')?.focus()
  }, [drawer])

  const pick = (id) => { onChange(id); if (!wide) onClose() }

  return (
    <>
      {/* かぶせているときの、うしろの膜。押すと閉じる */}
      {drawer && <div className="nav-scrim" onClick={onClose} aria-hidden="true" />}

      <nav
        ref={panelRef}
        id="app-nav"
        className={`app-nav${open ? ' is-open' : ' is-closed'}${wide ? ' is-wide' : ' is-drawer'}`}
        aria-label="画面の切り替え"
        aria-hidden={!wide && !open ? 'true' : undefined}
      >
        <div className="app-nav-head">
          {/* 細くたたんだときは、名前を出さずに絵だけにする */}
          <span className="app-nav-brand">{title}</span>
          {/* ✕ は**かぶせて開いているときだけ**。
              PC では帯の ☰ が同じ役目をするので、2つ並べない。
              同じことをするボタンが2つ見えると、違いを探すことになる */}
          {!wide && (
            <button type="button" className="nav-icon-btn"
                    onClick={onClose} aria-label="メニューを閉じる">
              <CloseIcon />
            </button>
          )}
        </div>

        <ul className="app-nav-list">
          {list.map((item) => {
            const Icon = item.icon
            const on = value === item.id
            return (
              <li key={item.id}>
                <button type="button" title={item.badgeTitle ?? item.label}
                        aria-current={on ? 'page' : undefined}
                        className={`app-nav-item${on ? ' is-active' : ''}`}
                        onClick={() => pick(item.id)}>
                  <span className="app-nav-icon">
                    {Icon ? <Icon /> : null}
                    {/* **絵の隅にも出す。** 細くたたむと名前が消えるので、
                        名前の横だけに置くと見えなくなる */}
                    {item.badge && <NavDot kind={item.badge} onIcon />}
                  </span>
                  <span className="app-nav-label">{item.label}</span>
                  {item.badge && <NavDot kind={item.badge} />}
                </button>
              </li>
            )
          })}
        </ul>

        {footer && <div className="app-nav-foot">{footer}</div>}
      </nav>
    </>
  )
}

/**
 * 画面のいちばん上の帯。**どこにいても ☰ が同じ場所にある。**
 * 名前(いまどの画面か)も出す。スマホでは左のメニューが隠れているので、
 * ここだけが「いまどこか」を伝える場所になる。
 */
export function AppTopbar({
  onToggle, open, wide, pageLabel, badge = null, right = null,
}) {
  return (
    <div className="app-topbar">
      <button type="button" className="nav-icon-btn nav-burger"
              onClick={onToggle}
              aria-expanded={open} aria-controls="app-nav"
              aria-label={open && wide ? 'メニューをたたむ' : 'メニューを開く'}>
        <MenuIcon />
      </button>
      <span className="app-topbar-title">
        {pageLabel}
        {/* いま見ている画面に印が付いているときだけ。
            **ほかの画面の印を、この帯に出さない。**
            「単語帳」の横に青い丸が出ると、何の印か分からない */}
        {badge && <NavDot kind={badge} />}
      </span>
      {right && <div className="app-topbar-right">{right}</div>}
    </div>
  )
}
