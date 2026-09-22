/**
 * **ゲストを選ぶ欄**(第5.238節・2026-09 利用者の指定)。
 *
 * ════════════════════════════════════════════════════════════════
 *   > ゲストのリストは開くためのボタンを一つ配置し、
 *   > デフォルトでは名前を記入して検索する仕様にしてください。
 *
 * 【なぜ】
 *   担当は1人あたり25人。**25人ぶんのチェックが常に並んでいると、
 *   その下にあるものが画面の外へ押し出される**
 *   (`.claude/rules/common.md`「長い一覧は、開くまで羅列しない」)。
 *
 * 【決まりごと】
 *   ・**既定は名前で探す。** 一覧は「一覧をひらく」を押したときだけ
 *   ・**打ったときは、開いていなくても出す** ——
 *     打ったのに何も出ないと行き止まりになる
 *   ・**選んだ人は、一覧を閉じても見えている。**
 *     見えないまま「共有する」を押すと、誰に出したのか分からない
 *   ・**押すものは、一覧の末尾に置かない**(共通ルール)。
 *     「一覧をひらく」は**見出しの行**に置く —— そこなら
 *     閉じていても押せて、場所が人数で動かない
 *   ・**`<details>` を使わない**(畳んでも中身が場所を取る・共通ルール)
 *   ・**絞り方は `learnerPick.js` 1か所。** ここで書き写さない
 *   ・**props で受け取るだけ**にしてある —— Supabase が要らないので、
 *     骨組み(`?screen=pick`)でそのまま描いて測れる
 * ════════════════════════════════════════════════════════════════
 *
 * @param people  `[{ id, display_name }]`。**`null` は読み込み中**(いない、ではない)
 * @param picked  選んでいる id
 * @param onPick  選び直したときの合図(id の配列)
 * @param label   見出し(「誰に出しますか」)
 * @param single  **1人だけ選ぶ形**(アサインする画面)。
 *   選んだらその場で閉じる —— もう一度押さないと先へ進めない、をなくす
 *   (冊をえらぶ本棚とまったく同じ作法・第5.200節)
 * @param emptyText 1人もいないときの1行。**呼ぶ側が決める** ——
 *   渡した名簿が「担当ぜんぶ」なのか「受講中だけ」なのかは、
 *   こちらからは分からない。**分かっていないことを、分かったように書かない**
 *   (CLAUDE.md)。既定は担当ぜんぶを渡された前提の言い方にしてある
 */
import { useState } from 'react'
import SearchBar from './SearchBar.jsx'
import { matchLearners, pickedNames, showsLearnerList } from '../lib/learnerPick.js'

export default function LearnerPick({
  people = null, picked = [], onPick, label = '誰に出しますか', disabled = false,
  single = false, emptyText = '担当しているゲストが、まだいません。',
}) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)

  const all = Array.isArray(people) ? people : []
  const hit = matchLearners(all, q)
  const 出す = showsLearnerList(q, open)
  const 選んだ = pickedNames(all, picked)

  const toggle = (id) => {
    /* **1人だけのときは、入れ替えてその場で閉じる。**
       外すためにもう一度押す道は要らない —— 別の人を押せば移る */
    if (single) { onPick([id]); setOpen(false); setQ(''); return }
    onPick(picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id])
  }

  return (
    <div className="learner-pick">
      <div className="learner-pick-head">
        <span className="field-label">{label}</span>
        {/* **0人のときは出さない**(効かない操作を見せない・CLAUDE.md) */}
        {all.length > 0 && (
          <button type="button" className="btn btn--small btn--ghost"
                  aria-expanded={open} disabled={disabled}
                  onClick={() => setOpen(!open)}>
            {open ? '一覧をとじる' : `一覧をひらく(${all.length})`}
          </button>
        )}
      </div>

      <SearchBar keyword={q} onKeyword={setQ} placeholder="名前で探す" />

      {/* **いまの状態。** 一覧を閉じても、誰を選んだかは見えている */}
      {選んだ.length > 0 && (
        <p className="learner-pick-now">
          選んでいます … <strong>{選んだ.join(' / ')}</strong>
        </p>
      )}

      {/* **黙って空にしない**(CLAUDE.md)。読み込み中と、いないときを書き分ける */}
      {people === null && <p className="card-hint">読んでいます…</p>}
      {people !== null && all.length === 0 && (
        <p className="card-hint">{emptyText}</p>
      )}

      {出す && hit.length > 0 && (
        <div className="assign-list">
          {hit.map((p) => (
            <label key={p.id} className="toggle">
              {/* **丸ぽちと四角を書き分ける** —— 1人だけなのか、
                  何人でも選べるのかが、形そのもので分かる(色だけに頼らない) */}
              <input type={single ? 'radio' : 'checkbox'}
                     name={single ? 'learner-pick' : undefined}
                     checked={picked.includes(p.id)} disabled={disabled}
                     onChange={() => toggle(p.id)} />
              <span>{p.display_name}</span>
            </label>
          ))}
        </div>
      )}
      {/* **黙って絞らない。** 当てはまらなかったことを、そのまま言う */}
      {出す && all.length > 0 && hit.length === 0 && (
        <p className="card-hint">当てはまるゲストがいません。</p>
      )}
    </div>
  )
}
