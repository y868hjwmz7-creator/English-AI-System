import { SHELF_GROUPS } from '../data/shelves.js'

/**
 * **業種べつの単語帳を、この人に出す / 外す**(0057)。
 *
 *   > そして、ゲストにはトレーナーが指定した単語帳のみが追加されるのです。
 *
 * ## 「冊の行の中」に入る中身である(第5.186節)
 *
 *   > 教材のアサイン内に説明は一才必要ありません。消してください。
 *   > シンプルに単語帳とquick responseの冊を選ぶ方法と同じ仕様にしてください。
 *
 * もとは自分で `<section className="card">` と見出しと**説明3段落**を
 * 持っていた。いまは `AssignShelf` の「業種べつの単語帳」の行を開いたときに、
 * **その行の中**に出る中身だけになっている
 * (`BookShelf` の `sub` とまったく同じ位置)。
 *
 * **囲みも見出しも知らせも、持たない。** 外側は `AssignShelf` の役目である
 * —— **置く場所の数だけ食い違う**(CLAUDE.md)。
 *
 * ## なぜ部品に切り出してあるか
 *
 * もとは `TrainerLearners.jsx` の中に直に書いてあった。ところがあの画面は
 * **Supabase を引き連れている**ので、`npm run test:bar` の骨組み
 * (Supabase 無し)では**1ドットも描かれない。**
 * **描けないものは測れない**(`SpeechBoard` → `SpeechPractice` と同じ話)。
 *
 * 実際、そのあいだに**押した結果がどこにも出ない**という不具合が
 * 入り込み、実機で指摘されるまで誰も気づけなかった(2026-09)。
 *
 *   > アサインしたい単語帳を選んだ後にできることがなにもありませんし、
 *   > アサインされる様子もありません。
 *
 * だから **`QrCard` / `WordRadio` / `JobBar` と同じ「props で受け取る部品」**
 * にしてある。**自分では何も読み込まない。**
 *
 * ## 決まりごと
 *
 * - **選んだ瞬間に出す。**「出す」ボタンは置かない
 *   —— 押すものが2つになるだけで、決めることは1つしかない
 * - **35冊あるので、札を35個並べない。** 選んで足し、押して外す
 *
 * @param shelfOn  いま出している棚(`{ id, label, group }`)
 * @param shelfOff まだ出していない棚
 * @param busy     いま切り替えている最中か
 * @param onPick   押された棚を受け取る(出す / 外すの判断は呼ぶ側)
 */
export default function ShelfAssign({ shelfOn, shelfOff, busy, onPick }) {
  return (
    <div className="shelfassign">
      {/* **いま出している冊は、押すと外せる。**
          1冊も出していないときは、この行ごと出さない
          —— **空の入れ物で場所を取らない**(`DrillHead` と同じ作法) */}
      {shelfOn.length > 0 && (
        <div className="chiprow" role="group" aria-label="出している単語帳">
          {shelfOn.map((s) => (
            <button key={s.id} type="button" className="chip chip--on"
                    disabled={busy} onClick={() => onPick(s)}>
              {s.label}
              <span className="chip-count">外す</span>
            </button>
          ))}
        </div>
      )}

      <label className="field">
        {/* **この1行だけは残す。** 説明ではなく、**プルダウンの名前**である
            —— 無いと、何を選ぶ欄なのか分からない */}
        <span className="field-label">単語帳を足す</span>
        <select className="input" value="" disabled={busy}
                onChange={(e) => {
                  const s = shelfOff.find((x) => x.id === e.target.value)
                  if (s) onPick(s)
                }}>
          <option value="">えらぶと、すぐ出します…</option>
          {SHELF_GROUPS.map((g) => {
            const list = shelfOff.filter((s) => s.group === g.id)
            if (!list.length) return null
            return (
              <optgroup key={g.id} label={g.label}>
                {list.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </optgroup>
            )
          })}
        </select>
      </label>
    </div>
  )
}
