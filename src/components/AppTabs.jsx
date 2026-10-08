import { Fragment } from 'react'
/**
 * 画面の下に貼り付く、行き先の帯(2026-09 利用者の指定)。
 *
 *   > ゲストとしてログインするとメニューにたどり着く方法が
 *   > 1番上までスクロールしてハンバーガーを押すしかないのが
 *   > かなり不便かつ分かりにくいです。改善してください
 *
 * 【何が問題だったか】
 *
 *   上の帯(`.app-topbar`)は**貼り付いている**ので、送っても ☰ は
 *   画面の上に残る(実測: 390px で 900px 送っても上端 8px・押せる)。
 *   **「一番上まで戻らないと押せない」形にはなっていなかった。**
 *
 *   本当の問題は**入口が1つしか無く、しかも隠れていること**である。
 *   ゲストの行き先は4つ(今週の宿題 / 単語帳 / Quick Response /
 *   スピーチ練習)しかないのに、その全部が**絵1つの裏**にある。
 *   どこへ行けるのかは、押してみるまで分からない。
 *
 * 【なぜ画面の下か】(利用者が選んだ)
 *
 *   読み上げの操作盤で**まったく同じ判断をしている** ——
 *   「いっそのこと画面の下部に黒帯にした中に固定にした方が
 *   スタイリッシュな気がします」(`.player-dock`)。
 *   スマホでいちばん親指が届くのは下端で、しかも送っても消えない。
 *
 * 【決まりごと】
 *
 * - **出す行き先は、呼ぶ側(`App.jsx` の `TAB_IDS`)が決める。**
 *   ここは渡されたものを並べるだけ。**4つに絞ってある**
 *   (2026-09 利用者の指定「教材、単語帳、Quick Response、スピーチ
 *   この四つにしてください」)。トレーナーにも出す
 * - **狭い画面だけ**(768px 未満)。それ以上ではメニューが
 *   絵だけの柱として常に見えているので、**同じことをするものが2つ**になる
 * - **☰ は残す。** 下の帯は行き先を出すだけで、
 *   メニューの中の設定(配色・音)はこれまでどおり ☰ の中にある
 * - **いまいる画面の印は、色だけに頼らない**(CLAUDE.md)。
 *   うすい地色 + 同じ色の文字 + 太字 + 上の細い帯の4つで示す
 * - **安全な余白(`env(safe-area-inset-bottom)`)を必ず取る。**
 *   iPhone の下端のバーに、押すものが隠れる
 */
export default function AppTabs({ pages = [], view, onChange }) {
  const list = (pages ?? []).filter(Boolean)
  if (!list.length) return null

  return (
    <nav className="app-tabs" aria-label="行き先">
      {list.map((p) => {
        const Icon = p.icon
        const on = p.id === view
        return (
          <button
            key={p.id}
            type="button"
            className={`app-tab${on ? ' is-on' : ''}`}
            aria-current={on ? 'page' : undefined}
            onClick={() => onChange(p.id)}
          >
            <span className="app-tab-icon">{Icon ? <Icon /> : null}</span>
            {/* ★ **語ごとに1行**(第5.407節・2026-10-07 利用者の指定)。

                  > 「Quick」と「Response」の2行に折り返し、中央揃えで表示する
                  > (以前の表示が気に入っていたため)

                **名前は切らない。**「Quick…」では何のボタンか分からない
                (Quick Response の札で一度学んだこと・CLAUDE.md)。

                **折り返しを CSS まかせにすると、画面の幅で変わる** ——
                390px では札が 98px あって「Quick Response」が1行で収まり、
                320px でだけ2行になっていた(実測)。
                **幅を決め打ちして狭める**のは、字の大きさを変えた日に
                効かなくなる(CLAUDE.md「値を書き写さない。性質で見る」)。

                そこで**空白で区切って、語ごとに1行**にする。
                ・空白を含まない名前(教材 / 今週の宿題 / 単語帳 /
                  スピーチ練習)は**1語なので、これまでどおり1行**
                ・語の途中では決して切れない(「Quick Respo / nse」にならない)
                **読み上げには、語のあいだの空白をそのまま残す** ——
                `Quick Response` と1つの名前として読まれる */}
            <span className="app-tab-label">
              {String(p.label ?? '').split(/\s+/).filter(Boolean).map((w, i) => (
                <Fragment key={`${w}-${i}`}>
                  {i > 0 ? ' ' : null}
                  <span className="app-tab-word">{w}</span>
                </Fragment>
              ))}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
