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
  /**
   * 帯の題。「教材をさがす」など。
   * **渡さなければ題を出さない**(2026-09)。教材の画面では、
   * 「探す / 条件で絞り込む / 作る」を1つの箱にまとめたので、
   * 題は箱の側にある。**同じ題を2つ並べない。**
   */
  title = '',
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
  /**
   * **畳めるようにする**(2026-09 利用者の指定)。
   *
   *   > 宿題を探すも折りたたみ式にしてください。
   *   > そして検索バーの下の「3件」は丸などで囲って何か配色してください。
   *   > そして位置は宿題を探すの文字の反対側、検索バーの右端の上に
   *
   * 渡さなければ**これまでと1ドットも変わらない**(教材の画面はそのまま)。
   * 畳んだときは、見た目も開け閉めも**「宿題をしぼる」とまったく同じ**に
   * する(`card material-search`)—— すぐ下に並ぶので、
   * **形が違うと2つの別物に見える。**
   */
  collapsible = false,
  open = false,
  onOpenChange = null,
  /**
   * 帯の下に、そのまま入れるもの(2026-09 実機・利用者の指定)。
   *
   *   > 「教材をさがす」と「教材を絞る」を１つにまとめて
   *
   * ゲストのページには、**畳める箱が2つ縦に並んで**いた
   * (「宿題をさがす」と「宿題をしぼる」)。どちらも同じ見た目で、
   * **どちらを開けばよいのか押すまで分からない。**
   * 中身は「名前で引く」と「取り組みで絞る」で、
   * **どちらも一覧を狭めるという1つのこと**である。
   *
   * **畳めるときだけ効く。** 教材の画面(`collapsible` を渡さない)は
   * これまでと1ドットも変わらない。
   */
  children = null,
}) {
  /* 件数の札。**題の反対側(右端)に置く**(利用者の指定)。
     色は「条件で絞り込む (3)」と**同じ `finder-badge`** を使う ——
     うすい地色 + 同じ色の文字 + 枠線(CLAUDE.md「選んでいる印」の作法)。
     **ここで新しい配色を作らない** */
  const badge = count != null
    ? <span className="finder-badge searchbar-badge">{count} 件</span>
    : null

  const row = (
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
      {/* 畳めるときは、件数の札を**題の行(summary)の右端**に出すので、
          ここには出さない。**同じ数を2か所に出さない** */}
      {!collapsible && count != null && (
        <span className="searchbar-count">{count} 件</span>
      )}
    </div>
  )

  if (collapsible) {
    return (
      <details
        className="card material-search searchbar--fold"
        open={open}
        onToggle={(e) => onOpenChange?.(e.currentTarget.open)}
      >
        <summary className="card-title material-search-sum">
          {title}
          {badge}
        </summary>
        {row}
        {children}
      </details>
    )
  }

  return (
    <section className="searchbar" aria-label={title || placeholder}>
      {title && <h2 className="searchbar-title">{title}</h2>}
      {row}
    </section>
  )
}
