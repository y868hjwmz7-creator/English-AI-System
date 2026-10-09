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
 *   いちばん上の「RIZAP ENGLISH」は、`Loading.jsx` の
 *   `.loading-name` と**まったく同じ字づかい**である(`styles.css` で
 *   選択子を分け合っている)。読み込みが終わると、その字はそこに残り、
 *   **下に箱が並ぶ**。画面が入れ替わったようには見えない。
 *
 * ══════════════════════════════════════════════════════════════════
 * ★ **1行1つの並びに作り替えた**(2026-10-09 利用者の指定・第5.431節)
 *
 *   > 情報の見せ方、余白、文字の階層、カードの配置を改善してください
 *   > 各カードの説明文も不要です
 *   > 見やすさの観点からいくと1列のBが良さそうです。
 *   > 情報がスッと入ってきます
 *
 *   3つ描いて見比べてもらい、**1列の行**(絵が左・名前・矢印が右)に
 *   決まった。**2列だと視線が左右に往復し、長い名前
 *   (「Quick Response」)が折り返す。**
 *
 *   **説明文(`desc`)は全部やめた。** 説明が要るのは作りが
 *   分かりにくいからで、文を足して補わない(共通ルール
 *   「余計な説明書きを置かない」)。`App.jsx` の `desc:` も消してある ——
 *   **呼ぶ人がいなくなった入れ物を残さない。**
 * ══════════════════════════════════════════════════════════════════
 */
import { ChevronIcon } from './Icons.jsx'
import Buddy from './Buddy.jsx'
import { buddyFace } from '../lib/buddy.js'
import { staggerMs } from '../lib/motion.js'

/**
 * ホームそのものの id。
 *
 * **`App.jsx` と2か所に書かない。** あちらは
 *   ①`pages` に1行足す ②箱の一覧からこれを外す
 * の2か所でこの id を使うので、文字列で書くと必ず片方が残る。
 */
export const HOME_ID = 'home'

/**
 * **組の呼び名は、ここ1か所**(2026-10-09 利用者の指定・第5.431節)。
 *
 *   > ・ゲスト管理：ゲスト、アサインする、集計
 *   > ・教材・学習ツール：教材、単語帳、Quick Response
 *   > グループ名を表示し、利用者が目的から項目を探せる構成に
 *
 * `App.jsx` の `pages` が持つのは **id だけ**である ——
 * 呼び名をあちらにも書くと、変えた日に片方が古くなる(CLAUDE.md)。
 * **並びもここが決める。**
 */
export const HOME_GROUPS = [
  { id: 'guest', label: 'ゲスト管理' },
  { id: 'study', label: '教材・学習ツール' },
]

export default function AppHome({ pages = [], onPick = null }) {
  /* **ホームそのものは箱にしない。** 押しても同じ場所に留まるだけで、
     **効かない操作を見せない**(CLAUDE.md) */
  const boxes = pages.filter((p) => p.id !== HOME_ID)

  /* 組ごとに分ける。**どの組にも入っていないものは、最後にまとめて出す** ——
     画面を足して `group` を書き忘れても、**黙って消えない**(CLAUDE.md) */
  const 知らない = boxes.filter((p) => !HOME_GROUPS.some((g) => g.id === p.group))
  const 束 = HOME_GROUPS
    .map((g) => ({ 名: g.label, 中: boxes.filter((p) => p.group === g.id) }))
    .concat([{ 名: '', 中: 知らない }])
    .filter((g) => g.中.length)

  /* ★ **組が1つしか無いなら、見出しを出さない。**
       ゲストのアカウントでは「教材・学習ツール」しか並ばない ——
       そこに見出しを1つだけ置いても、何も分けていない
       (余計な説明書きを置かない・共通ルール)。 */
  const 見出しを出す = 束.length > 1

  /* 出てくる遅れは**通しの番号**で決める。組をまたいでも順に現れる */
  let 番 = -1

  return (
    <section className="home">
      <header className="home-head home-head--buddy">
        {/* ★ **相棒**(第5.381節)。**言葉は持たせない** —— 絵だけである。
             声かけは、やり終えた1枚がもう持っている(同じことを2つ見せない)。
             どの顔になるかは `buddyFace()` 1か所が決める。

             ★ **小さいほうに変えた**(第5.431節・利用者の指定
               「マスコットは現在より控えめなサイズにし、見出しや操作項目より
                目立たないように」)。**新しい数は作らない** ——
               `Buddy` がもともと持っている段(`sm`)に乗せる */}
        <Buddy face={buddyFace({})} size="sm" className="home-buddy" />
        <p className="home-eyebrow">RIZAP ENGLISH</p>
        <h2 className="home-title">どれから始めますか</h2>
      </header>

      {boxes.length ? 束.map((g) => (
        <div className="home-sect" key={g.名 || '-'}>
          {見出しを出す && g.名 && <h3 className="home-group">{g.名}</h3>}
          <div className="home-grid">
            {g.中.map((p) => {
              const Icon = p.icon
              番 += 1
              return (
                <button key={p.id} type="button" className="home-box"
                        /* ★ **少しずつ遅らせて出す**(第5.371節)。
                             同時に全部現れると「描き直した」ように見える。
                             **遅れは `staggerMs()` 1か所**が決める ——
                             ここに数を書かない。動きを減らす端末では 0 になる */
                        style={{ animationDelay: `${staggerMs(番)}ms` }}
                        onClick={() => onPick?.(p.id)}>
                  <span className="home-box-icon" aria-hidden="true">
                    {Icon ? <Icon /> : null}
                  </span>
                  <span className="home-box-label">{p.label}</span>
                  {/* **触る端末には「カーソルを載せる」が無い**(CLAUDE.md)。
                      押せることが、押す前から見て分かるようにする */}
                  <ChevronIcon className="icon home-box-go" />
                </button>
              )
            })}
          </div>
        </div>
      )) : (
        /* **行き止まりを作らない。** ふつうは起こらないが、
           黙って白い画面を出すよりは、何が起きているかを1行で言う */
        <p className="muted">行き先を読み込んでいます…</p>
      )}
    </section>
  )
}
