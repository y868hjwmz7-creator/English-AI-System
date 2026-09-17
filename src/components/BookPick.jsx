/**
 * **帯の左に置く「冊名 ▾」**(第5.167節・2026-09 利用者の指定)。
 *
 * ============================================================================
 *   > quick response と単語帳は、トップ画面をなくしませんか?
 *   > サイドバーや下のタブからクリックしたらすぐに実際のトレーニングの画面に飛び、
 *   > その画面にメニューを足す。
 *
 * 【なぜ帯に常時出すのか】
 *
 *   トップ画面が無くなると、**いまどの帳面をやっているのかが分からなくなる。**
 *   いちばん怖いのは**冊を間違えたまま進むこと**なので、
 *   名前は畳まずに、常に見えているところへ置く。
 *
 * 【押したら何が出るか】
 *
 *   `SettingsSheet`(「出しかた」で使っているもの)に `BookShelf` を入れる。
 *   スマホでは下から、広い画面では吹き出し。**どちらも、もう在る。**
 *   **新しい入れ物を作らない**(CLAUDE.md)。
 *
 * 【冊が1つしか無ければ、何も出さない】
 *
 *   トレーナーがゲストの単語帳を開く画面には、冊の切り替えがもともと無い。
 *   押しても1つしか出ない札を置かない(**効かない操作を見せない**)。
 *
 * @param books  冊の一覧(`[{ id, label }]`)
 * @param book   いま開いている冊の id
 * @param counts 冊ごとの件数(`{ [id]: 数 }`)。無ければ数を出さない
 * @param unit   件数の単位(`'語'` / `'問'`)
 * @param onPick 選ばれた冊の id
 * @param sub    **いま開いている冊の行の中**に出すもの(棚・段・Unit・中身・型)
 * @param title  シートの見出し
 * ============================================================================
 */
import { useRef, useState } from 'react'
import BookShelf from './BookShelf.jsx'
import SettingsSheet from './SettingsSheet.jsx'

export default function BookPick({
  books = [], book = null, counts = null, unit = '語', onPick = null, sub = null,
  title = 'どの帳面をやりますか',
}) {
  /* 開いているかどうかは**覚えない。** 毎日選ぶものではないので、
     開くたびに畳んだところから始めてよい(`ReviewScope` と同じ作法) */
  const [open, setOpen] = useState(false)
  const btnRef = useRef(null)

  /** **冊が1つなら、えらぶ場所は要らない**(`BookShelf` と同じ判断) */
  if (books.length < 2) return null
  const now = books.find((b) => b.id === book) ?? books[0]

  return (
    <>
      <button type="button"
              ref={btnRef}
              className={`btn btn--small bookpick${open ? ' chip--on' : ''}`}
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}>
        {/* **名前は切らない。** 狭い画面では入るところまでで「…」になる
            (`.bookpick-name` が受け持つ)。絵だけにはしない */}
        <span className="bookpick-name">{now?.label ?? ''}</span>
        <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <SettingsSheet
          anchorEl={btnRef.current}
          onClose={() => setOpen(false)}
          title={title}
          /* 中の区切り(段・棚・Unit・型)を変えると高さが変わる。
             **置き直す合図を渡す**(`ReviewScope` と同じ) */
          placeKey={`${book}/${books.length}`}
        >
          <BookShelf books={books} book={book} counts={counts} unit={unit}
                     sub={sub}
                     onPick={(id) => { onPick?.(id); setOpen(false) }} />
        </SettingsSheet>
      )}
    </>
  )
}
