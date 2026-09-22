/**
 * **この人に出す冊を、1行1冊でえらぶ**(第5.186節・2026-09 実機・利用者の指定)。
 *
 * ============================================================================
 *   > 教材のアサイン内に説明は一才必要ありません。消してください。
 *   > シンプルに単語帳とquick responseの冊を選ぶ方法と同じ仕様にしてください。
 *
 * 【前はこうだった】
 *
 *   冊ごとに `<section className="card">` があり、見出しと**説明が3〜4段落**
 *   付いていた。実機(iPhone)では**単語帳の冊を見るだけで画面3枚ぶん**を
 *   送ることになり、**どれを出しているのかが一目で分からなかった。**
 *
 * 【いまはこう】
 *
 *   **単語帳 / Quick Response の「冊をえらぶ」とまったく同じ形**である ——
 *   `.shelf`(`BookShelf.jsx`)の 1行1冊。印(●/○)+ 名前 + 数だけ。
 *
 *       ● 文法30日集中講座と基礎単語
 *       ○ 業種べつの単語帳                      ▸
 *
 *   **見た目を新しく作っていない。** 同じ CSS を着せているので、
 *   片方を直せば両方が動く(**呼び名・色・幅を2か所に書かない**・CLAUDE.md)。
 *
 * 【説明のかわりに、数と印が言う】
 *
 *   「まだ1冊も出していません」は **○** が、
 *   「いま2つの Unit を出しています」は **● + 「2 Unit」** が言っている。
 *   **同じことを2つ見せない** —— 消したのは重複であって、中身ではない。
 *
 *   **色だけに頼らない**(CLAUDE.md)ので、印(●/○)・太字・枠・地色・
 *   `aria-pressed` の5つで示す。`BookShelf` とまったく同じ作法である。
 *
 * 【中に区切りがある冊は、押すと開く】
 *
 *   業種べつの単語帳は **35 冊**、Native Flow は **6 Unit** ある。
 *   `BookShelf` が「開いている冊の行の中」に区切りを出すのと同じ形で、
 *   **その行の中**に出す。畳んであるので、ふだんは4行しか見えない。
 *
 * 【自分では何も読み込まない】
 *
 *   `props` で受け取るだけなので、骨組み(Supabase 無し)でも描ける
 *   (**描けないものは測れない**・CLAUDE.md)。
 *
 * 【置く場所は2つ。中身は1つ】
 *
 *   ゲストのページ(単語帳 / Quick Response のタブ)と、
 *   左メニューの「アサインする」。**どちらも、この部品を呼ぶだけ**である。
 * ============================================================================
 *
 * @param group    どちらの帳面の冊か(`'word'` / `'qr'`)。
 *                 **振り分けは `featuresIn()` 1か所**(ここで id を並べない)
 * @param features いま出している名前(`Set`)
 * @param busy     いま決めている名前(`null` なら決めていない)
 * @param note     押した結果 `{ kind: 'busy'|'ok'|'ng', text }`
 * @param onFeature 素の冊を押した(出す / 外すの判断は呼ぶ側)
 * @param shelfOn / shelfOff / onShelf  業種べつの単語帳(`group === 'word'`)
 * @param units / unitsOn / onUnit / onAll  Native Flow(`group === 'qr'`)
 */
import { useState } from 'react'
import { featuresIn } from '../data/learnerFeatures.js'
import { SHELF_BOOK_LABEL } from '../data/shelves.js'
import { NF_BOOK_LABEL } from '../data/nativeFlow.js'
import ShelfAssign from './ShelfAssign.jsx'
import AssignNote from './AssignNote.jsx'
import NativeFlowAssign from './NativeFlowAssign.jsx'

export default function AssignShelf({
  group = 'word', features = null, busy = null, note = null, onFeature = null,
  shelfOn = [], shelfOff = [], onShelf = null,
  units = [], unitsOn = [], onUnit = null, onAll = null,
}) {
  /** **どの行を開いているか。** 冊は1つずつ見るものなので、開くのも1つ */
  const [open, setOpen] = useState(null)

  const rows = [
    /* **どちらの帳面の冊かは `featuresIn()` が知っている**(第5.181節)。
       ここで `id === 'basics'` と書き分けない */
    ...featuresIn(group).map((f) => ({
      id: f.id,
      label: f.label,
      on: !!features && features.has(f.id),
      pick: () => onFeature?.(f),
    })),
    ...(group === 'word' ? [{
      id: 'shelf',
      label: SHELF_BOOK_LABEL,
      on: shelfOn.length > 0,
      /** **数は数える。書き写さない** */
      n: shelfOn.length,
      unit: '冊',
      sub: (
        <ShelfAssign shelfOn={shelfOn} shelfOff={shelfOff}
                     busy={!!busy} onPick={onShelf} />
      ),
    }] : []),
    ...(group === 'qr' ? [{
      id: 'nf',
      label: NF_BOOK_LABEL,
      on: unitsOn.length > 0,
      n: unitsOn.length,
      unit: 'Unit',
      sub: (
        <NativeFlowAssign units={units} on={unitsOn}
                          busy={!!busy} onPick={onUnit} onAll={onAll} />
      ),
    }] : []),
  ]

  return (
    <>
      <div className="shelf assignshelf" role="group" aria-label="この人に出す冊">
        {rows.map((r) => {
          const shown = !!r.sub && open === r.id
          return (
            <div key={r.id} className={`shelf-row${r.on ? ' shelf-row--on' : ''}`}>
              <button
                type="button"
                className="shelf-pick"
                disabled={!!busy}
                /* **押すと何が起きるかを、読み上げにも伝える。**
                   中に区切りがある冊は「開く」、素の冊は「出す / 外す」で、
                   **役目が違うものに同じ合図を付けない** */
                {...(r.sub ? { 'aria-expanded': shown } : { 'aria-pressed': r.on })}
                onClick={() => (r.sub ? setOpen(shown ? null : r.id) : r.pick?.())}
              >
                <span className="shelf-mark" aria-hidden="true">{r.on ? '●' : '○'}</span>
                <span className="shelf-name">{r.label}</span>
                {/* **いま決めている行が分かる**(`busy` で全部止まるので、
                    どれを押したのか分からないと待てない)。
                    **0 は出さない** —— 「0 冊」は空っぽに見えるが、
                    ○ がもう同じことを言っている(同じことを2つ見せない) */}
                {busy === r.id
                  ? <span className="shelf-n" aria-hidden="true">…</span>
                  : r.n > 0 && <span className="shelf-n">{r.n} {r.unit}</span>}
                {r.sub && (
                  <span className="shelf-open" aria-hidden="true">{shown ? '▾' : '▸'}</span>
                )}
              </button>
              {shown && <div className="shelf-sub">{r.sub}</div>}
            </div>
          )
        })}
      </div>
      {/* **押した結果は、必ずこの場に出す**(画面のいちばん上に出さない・
          CLAUDE.md)。**成功と失敗を、同じ見た目で終わらせない** */}
      <AssignNote note={note} />
    </>
  )
}
