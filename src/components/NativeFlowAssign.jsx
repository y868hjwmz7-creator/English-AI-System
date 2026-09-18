/**
 * **Native Flow の Unit を、この人に出す / 外す**(2026-09 利用者の指定)。
 *
 * ============================================================================
 *   > これも指定したゲストだけに届くように、
 *   > トレーナーにはデフォルトで表示されるように
 *
 * 【「冊の行の中」に入る中身である】(第5.186節)
 *
 *   > 教材のアサイン内に説明は一才必要ありません。消してください。
 *   > シンプルに単語帳とquick responseの冊を選ぶ方法と同じ仕様にしてください。
 *
 *   もとは自分で `<section className="card">` と見出しと**説明2段落**を
 *   持っていた。いまは `AssignShelf` の「Native Flow」の行を開いたときに、
 *   **その行の中**に出る中身だけである(`ShelfAssign` とまったく同じ位置)。
 *
 * 【入れ物は、棚(業種べつの単語帳)とまったく同じ】
 *
 *   0055 の `learner_features`(ゲスト × 名前で1行)に
 *   **`nf:<Unit の番号>`** で入る。作り方は `nfFeature()`(`nativeFlow.js`)
 *   1か所で、**ここで `'nf:' + id` と書かない。**
 *   新しい表も、新しい窓口も、**貼る SQL も1つも増えていない。**
 *
 * 【札を6つ並べる。プルダウンにしない】
 *
 *   `ShelfAssign` がプルダウンなのは **35 冊あるから**である
 *   (CLAUDE.md「35冊あるので、札を35個並べない」)。
 *   こちらは**6つ**なので、**いま出ているものが一目で分かる札のほうがよい。**
 *   決まりを形だけ真似ると、かえって見えなくなる。
 *
 * 【自分では何も読み込まない】
 *
 *   `ShelfAssign` / `QrCard` と同じ「**props で受け取る部品**」。
 *   `TrainerLearners.jsx` は Supabase を引き連れているので、
 *   あそこに直に書くと**骨組みでは1ドットも描かれない。**
 *   **描けないものは測れない**(実際、それで「押しても何も起きない」が
 *   実機で指摘されるまで残った・2026-09)。
 * ============================================================================
 *
 * @param units   Unit ぜんぶ(`NATIVE_FLOW_UNITS`)。**呼ぶ側が渡す**
 * @param on      いま出している Unit の番号(`Set` でも配列でもよい)
 * @param busy    いま切り替えている最中か
 * @param onPick  押された Unit を受け取る(出す / 外すの判断は呼ぶ側)
 * @param onAll   **丸ごと**出す / 外す(2026-09 利用者の指定
 *                「ユニット毎、または丸ごとアサイン出来るように」)。
 *                `true` なら出す・`false` なら外す。渡さなければ、その行は出ない
 */
import { unitName } from '../data/nativeFlow.js'

export default function NativeFlowAssign({
  units = [], on = [], busy = false, onPick = null, onAll = null,
}) {
  const shown = new Set([...on].map(Number))
  const n = units.filter((u) => shown.has(u.id)).length
  /* **数は数える。書き写さない**(Vol.2 で Unit が増えても、ひとりでに合う) */
  const allQ = units.reduce((t, u) => t + u.n, 0)

  return (
    <div className="nfassign">
      <div className="chiprow" role="group" aria-label="出している Unit">
        {units.map((u) => {
          const isOn = shown.has(u.id)
          return (
            <button key={u.id} type="button"
                    className={`chip${isOn ? ' chip--on' : ''}`}
                    aria-pressed={isOn}
                    disabled={busy} onClick={() => onPick?.(u)}>
              {/* **呼び名は `unitName()` 1か所**(第5.175節) */}
              {unitName(u)}
              {/* **出している印は、文字でも言う。**
                  外すのか足すのか、押す前に分かるようにする */}
              <span className="chip-count">{isOn ? '外す' : `${u.n} 問`}</span>
            </button>
          )
        })}
      </div>

      {/* **丸ごと**(2026-09 利用者の指定「ユニット毎、または丸ごと」)。

          1つずつ押すと**6回**かかる。ふだんは「この人には Native Flow を
          ぜんぶ渡す」で足りるので、そこを1回で済ませる。

          **数は数えて出す**(`units` から)。Vol.2 で Unit が増えても
          ひとりでに合う —— **書き写すと、増やした日に嘘になる。**

          **「ぜんぶ外す」は、出しているときだけ出す**
          (効かない操作を見せない・CLAUDE.md)。
          **すき間は `.btn-row` の `gap`** で付く —— 子に余白を付けて回らない */}
      {onAll && (
        <div className="btn-row">
          <button type="button" className="btn btn--small" disabled={busy || n === units.length}
                  onClick={() => onAll(true)}>
            ぜんぶ出す({units.length} Unit・{allQ} 問)
          </button>
          {n > 0 && (
            <button type="button" className="btn btn--ghost btn--small" disabled={busy}
                    onClick={() => onAll(false)}>
              ぜんぶ外す
            </button>
          )}
        </div>
      )}
    </div>
  )
}
