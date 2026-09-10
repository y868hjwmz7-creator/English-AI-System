/**
 * ホーム — **読み込みが終わったら、まず行き先を並べる**(2026-09 利用者の指定)。
 *
 *   > ロードの後いきなり教材が映るのではなく、何か箱を並べて、
 *   > 選択したモードに飛ぶ仕様にしたいです
 *
 * 【なぜ要るか】
 *   これまでは、読み込みが終わった瞬間に**いちばん上の画面**
 *   (トレーナーなら「教材」、ゲストなら「今週の宿題」)が出ていた。
 *   ほかにどこへ行けるのかは、☰ を押すまで分からない。
 *   **入口が1つしか無く、しかも隠れている**という、下の帯
 *   (`AppTabs`)を作ったときとまったく同じ形の不便である。
 *
 * 【並べるのは `pages` そのまま】
 *   名前も絵も、**一覧は `App.jsx` の `pages` 1か所**である
 *   (メニューも上の帯もそこを見ている)。ここはそれを受け取って
 *   箱にするだけで、**行き先の一覧を持たない。**
 *   画面を足せば、ここにも自動で並ぶ。
 *
 *   **役割で並ぶものが変わる**のも、そのまま効く ——
 *   ゲストに「教材」の箱は出ない(`pages` に入っていない)。
 *
 * 【名前や役割は出さない】
 *   誰でログインしているかは、左のメニューの下と、ゲストの箱が言う。
 *   ここへ書き写すと**同じものが2か所**に出る(CLAUDE.md)。
 *   この画面の役目は「どこへ行くか」だけにしてある。
 *
 * 【起動画面の続きに見えるようにしてある】
 *   いちばん上の「English AI System」は、`Loading.jsx` の
 *   `.loading-name` と**まったく同じ字づかい**である(`styles.css` で
 *   選択子を分け合っている)。読み込みが終わると、その字はそこに残り、
 *   **下に箱が並ぶ**。画面が入れ替わったようには見えない。
 */
import { ChevronIcon } from './Icons.jsx'

/**
 * ホームそのものの id。
 *
 * **`App.jsx` と2か所に書かない。** あちらは
 *   ①`pages` に1行足す ②箱の一覧からこれを外す
 * の2か所でこの id を使うので、文字列で書くと必ず片方が残る。
 */
export const HOME_ID = 'home'

export default function AppHome({ pages = [], onPick = null }) {
  /* **ホームそのものは箱にしない。** 押しても同じ場所に留まるだけで、
     **効かない操作を見せない**(CLAUDE.md) */
  const boxes = pages.filter((p) => p.id !== HOME_ID)

  return (
    <section className="home">
      <header className="home-head">
        <p className="home-eyebrow">English AI System</p>
        <h2 className="home-title">どれから始めますか</h2>
      </header>

      {boxes.length ? (
        <div className="home-grid">
          {boxes.map((p) => {
            const Icon = p.icon
            return (
              <button key={p.id} type="button" className="home-box"
                      onClick={() => onPick?.(p.id)}>
                <span className="home-box-icon" aria-hidden="true">
                  {Icon ? <Icon /> : null}
                </span>
                <span className="home-box-name">
                  <span className="home-box-label">{p.label}</span>
                  {/* **触る端末には「カーソルを載せる」が無い**(CLAUDE.md)。
                      押せることが、押す前から見て分かるようにする */}
                  <ChevronIcon className="icon home-box-go" />
                </span>
                {/* 説明は `pages` が持つ(**呼び名と説明を2か所に分けない**)。
                    **無ければ行ごと出さない** —— 空の行を置かない */}
                {p.desc && <span className="home-box-desc">{p.desc}</span>}
              </button>
            )
          })}
        </div>
      ) : (
        /* **行き止まりを作らない。** ふつうは起こらないが、
           黙って白い画面を出すよりは、何が起きているかを1行で言う */
        <p className="muted">行き先を読み込んでいます…</p>
      )}
    </section>
  )
}
