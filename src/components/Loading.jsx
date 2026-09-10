/**
 * **読み込み中の画面は、1つにまとめる**(2026-09 利用者の指定)。
 *
 *   > アプリのロード中の画面を統一してスタイリッシュに映るようにせよ。
 *
 * 実測すると、同じ「読み込み中…」が**4つの見た目**で出ていた
 * (`.loading`(48px の余白)/ `.muted` / `.hint` / 素の `<p>`)。
 * 字の大きさも色も違うので、画面を移るたびに
 * **別のものが出ているように見えていた。**
 *
 * **`index.html` の起動画面と、まったく同じ形にしてある。**
 * JavaScript が届く前は向こうが、届いたあとはこちらが描くので、
 * **入れ替わった瞬間に、画面は1ドットも動かない。**
 * **どちらかを直したら、必ずもう片方も直す**(`theme-color` と同じ決まり)。
 *
 * - `full` … アプリぜんぶを覆うとき(起動直後)。名前も出す
 * - 既定 … 画面の中身だけを待っているとき。帯と一言だけ
 *
 * **動きは `prefers-reduced-motion` で止まる**(styles.css)。
 * 滑る動きが苦手な人には、ただの帯として出る。
 */
export default function Loading({ full = false }) {
  return (
    <div className={`loading${full ? ' loading--full' : ''}`}
         role="status" aria-live="polite">
      {full && <p className="loading-name">English AI System</p>}
      {/* 帯そのものは飾りである。読み上げるのは下の1行だけでよい */}
      <div className="loading-bar" aria-hidden="true"><span /></div>
      <p className="loading-note">読み込み中…</p>
    </div>
  )
}
