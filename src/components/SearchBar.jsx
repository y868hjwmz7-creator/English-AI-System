/**
 * さがす帯 — **題・検索の入力欄・並び順**。
 *
 * 【なぜ絞り込みの外に出したか】(2026-08 利用者の指定)
 *
 *   > この選択して青くなっている部分は全て、弱点タグより下、作成用のエリア外、
 *   > そして作成した教材群の上においてください。その際、「教材をさがす」の
 *   > タイトルをわかりやすく表示し、検索バーのUIをもっと現代的なデザインに
 *   > してください。この配置換えはゲストモードも同じにしてください。
 *
 *   絞り込みの箱(「教材をさがす・作る」)は**たためる。**
 *   たたむと、名前で引く手段も並び順も一緒に消えていた。
 *   けれども名前で引くのは**いちばんよく使う操作**である。
 *   だから箱の外に出し、**一覧のすぐ上に、いつも見えている状態で置く。**
 *
 * 【ゲストとトレーナーで同じものを使う】
 *   トレーナーの「教材」と、ゲストのカードの「過去の宿題」の両方で使う。
 *   **同じ見た目を2か所に書き写さない**(CLAUDE.md)。
 *
 * 【入力欄が要らない画面もある】
 *   過去の宿題には名前で引く仕組みが無い。`onKeyword` を渡さなければ
 *   入力欄ごと出さない。**効かない操作を見せない**(CLAUDE.md)。
 */
import { CloseIcon, SearchIcon } from './Icons.jsx'

export default function SearchBar({
  /** 帯の題。「教材をさがす」など */
  title,
  /** 名前で引く。渡さなければ入力欄を出さない */
  keyword = '',
  onKeyword = null,
  onSearch = null,
  placeholder = '',
  /** 並び順。`[{ id, label }]` */
  sort = '',
  onSort = null,
  sortOptions = [],
  /** 一覧の件数(「30 件」)。右端に出す */
  count = null,
}) {
  return (
    <section className="searchbar" aria-label={title}>
      <h2 className="searchbar-title">{title}</h2>
      <div className="searchbar-row">
        {onKeyword && (
          <div className="searchbar-field">
            <SearchIcon className="icon searchbar-icon" />
            {/* **`type="search"` にしない。** 端末ごとに勝手な ✕ が付き、
                こちらの ✕ と2つ並ぶ。消す操作は自分で持つ */}
            <input
              value={keyword}
              placeholder={placeholder}
              aria-label={placeholder || title}
              onChange={(e) => onKeyword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); onSearch?.() }
              }}
            />
            {keyword && (
              <button type="button" className="searchbar-clear" aria-label="入力を消す"
                      onClick={() => { onKeyword(''); onSearch?.('') }}>
                <CloseIcon />
              </button>
            )}
          </div>
        )}
        {onSort && sortOptions.length > 0 && (
          <label className="searchbar-sort">
            <span className="sr-only">並び順</span>
            <select value={sort} onChange={(e) => onSort(e.target.value)}>
              {sortOptions.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </label>
        )}
        {count != null && <span className="searchbar-count">{count} 件</span>}
      </div>
    </section>
  )
}
