/**
 * 段の札 —— **数を出すだけでなく、押せば、その段だけを復習できる。**
 *
 * 2026-09 利用者の指定。
 *
 *   > 学習者の心理としては、覚えた、を押すのは少し勇気がいるものです。
 *   > なので、それぞれ数を示すだけではなく、
 *   > タッチすればそれらを復習できるようにしたいです。
 *
 * ============================================================================
 * 【なぜ押せるようにするのか】
 *
 *   「覚えた」を押すのに勇気が要るのは、**押したらもう出てこない**と
 *   思うからである。いつでも呼び出して確かめられるなら、押すのは怖くない。
 *   数だけ出して押せない札は、**そこに何があるかを見せておいて、
 *   触らせない**という形になっていた。
 *
 * 【単語帳と Quick Response で、まったく同じものを使う】
 *   並ぶ画面なので、見た目も操作もそろえる。
 *   **同じ見た目を2か所に書き写さない**(CLAUDE.md)。
 *   ちがうのは段の分け方(`WORD_GROUPS` / `QR_GROUPS`)だけで、
 *   それは `reviewScope.js` が持っている。
 *
 * 【選んでいる印を、色だけに頼らない】
 *   うすい地色 + 同じ色の文字 + 枠線 + 太字(CLAUDE.md の決まり)。
 *   あわせて `aria-pressed` を付ける —— 読み上げ機にも伝わる。
 *
 * 【0件の札は押せない。ただし消さない】
 *   「覚えた語はまだ1つもありません」ということ自体が知らせである
 *   (`ReviewScope` の範囲の札と同じ作法)。
 */
export default function ReviewStats({
  /** `[{ id, label, n }]`。段の一覧は `reviewScope.js` が持っている */
  items,
  /** いま選んでいる段の id。`null` なら選んでいない(ぜんぶ) */
  value = null,
  /** 押されたとき。もう一度押したときは `null` が来る */
  onPick,
  /**
   * 「いま手を付けるところ」の id。その札だけ、数があるときに目立たせる
   * (もとの `counts.unknown > 0` の `is-due` をそのまま引き継いでいる)。
   */
  dueId = null,
  /** 押したら何が起きるかの1行。**押す前に分かるようにする** */
  lead = '',
}) {
  const list = items ?? []
  return (
    <>
      <div className="wb-stats">
        {list.map((it) => {
          const on = it.id === value
          const n = Number(it.n ?? 0)
          return (
            <button
              key={it.id}
              type="button"
              className={`wb-stat${n > 0 && it.id === dueId ? ' is-due' : ''}${on ? ' is-on' : ''}`}
              aria-pressed={on}
              /* **中身が無い段は押せない。** 押しても出すものが無い
                 (効かない操作を見せない・CLAUDE.md) */
              disabled={n === 0}
              onClick={() => onPick(on ? null : it.id)}
            >
              <strong>{n}</strong>
              <span className="wb-stat-label">{it.label}</span>
            </button>
          )
        })}
      </div>
      {lead && <p className="card-hint wb-stats-lead">{lead}</p>}
    </>
  )
}
