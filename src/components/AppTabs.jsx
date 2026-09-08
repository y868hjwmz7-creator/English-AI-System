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
            {/* **名前は切らない。**「Quick…」では何のボタンか分からない
                (Quick Response の札で一度学んだこと・CLAUDE.md)。
                入らないぶんは2行に折り返させる */}
            <span className="app-tab-label">{p.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
