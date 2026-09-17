/**
 * **66 の型の、どの中身を練習するか**(2026-09 利用者の指定)。
 *
 * ============================================================================
 *   > 型のトレーニングの UI は廃止して、
 *   > quick response の UI にそのままコンテンツを移してください
 *
 * 【`NativeFlowUnits` とまったく同じ形にする】
 *
 *   あちらも「冊の中から、いま開く1つを選ぶ」である。
 *   **同じことをするものを、別の見た目で2つ作らない**(CLAUDE.md)。
 *   置き場所も(`.wb-add`)、名前と欄の並べ方も(`.field--inline`)、
 *   説明の1行も、あちらから1文字も変えていない。
 *
 * 【「ぜんぶ」を置かない】
 *
 *   Native Flow は **690 問を通しで回せていた**ので「ぜんぶ」を残した。
 *   こちらは**もともと別々の練習**(段1 / 段2)で、通しは1度も無い。
 *   しかも混ぜると 1,879 対 66 で、**言い換えが埋もれて出てこない。**
 *
 * 【自分では何も読まない】
 *
 *   問数は `frameQr.js` が数える(**0円**)。一覧も名前も向こうが持つ。
 *   **`QrCard` / `NativeFlowUnits` と同じ「props で受け取る部品」**なので、
 *   骨組み(Supabase 無し)でもそのまま描ける(**描けないものは測れない**)。
 * ============================================================================
 *
 * 【型で絞る欄も、ここに置く】(2026-09 利用者の指定)
 *
 *   > quick response 内で型のトレーニングをする際に、絞り込めるようにして欲しい。
 *
 *   **「出しかた」の中には入れない。** あちらは読み込んだ問の中から選ぶ
 *   絞り込みで、こちらは**出す問そのものが変わる**(Unit とまったく同じ)。
 *   同じ場所に並べると、押したときに起きることが2通りになる。
 *
 *   **66 本を書き写さない。** 一覧も並びも組の名前も
 *   `frameQrForms()`(`sentenceFrames.js` の並び)が持つ。
 *   `<optgroup>` は、その組の名前をそのまま見出しにするだけである。
 *
 * @param parts  中身の一覧(`FRAME_PARTS`)
 * @param counts 中身ごとの問数(`frameQrCounts()`)
 * @param picked いま開いている中身の id
 * @param onPick 選ばれた中身の id
 * @param forms  絞れる型の一覧(`frameQrForms()`)
 * @param form   いま絞っている型。`null` なら「ぜんぶ」
 * @param onForm 選ばれた型(「ぜんぶ」は `null`)
 */
export default function FrameParts({
  parts = [], counts = {}, picked = null, onPick = null,
  forms = [], form = null, onForm = null,
}) {
  /** **中身が1つも無ければ、欄ごと出さない**(効かない操作を見せない) */
  if (!parts.length) return null

  /* **知らない id が残っていても、いちばんやさしいものに落ちる。**
     `<select>` に無い値を渡すとブラウザが勝手に先頭を選ぶので、
     画面と中身が食い違う(`ShelfBooks` で踏んだ落とし穴) */
  const now = parts.some((p) => p.id === picked) ? picked : parts[0].id
  const lead = parts.find((p) => p.id === now)?.lead ?? ''
  /* **知らない型が残っていても、「ぜんぶ」に落ちる**(`ShelfBooks` と同じ) */
  const nowForm = forms.some((f) => f.form === form) ? form : ''
  const all = forms.reduce((n, f) => n + f.n, 0)
  /* **組ごとにまとめる。** 66 本を1列に並べると、どこに何があるか分からない。
     **並びは `frameQrForms()` のまま** —— ここで並べ替えない */
  const groups = []
  for (const f of forms) {
    const last = groups[groups.length - 1]
    if (last && last.label === f.group) last.rows.push(f)
    else groups.push({ label: f.group, rows: [f] })
  }

  return (
    <div className="wb-add nfunits">
      {/* **名前と欄を横に並べる決まりは、もう在る**(`.field--inline`)。
          ここで書き写さない */}
      <label className="field field--inline nfunits-pick">
        <span className="field-label">中身</span>
        <select className="input" value={now}
                onChange={(e) => onPick?.(e.target.value)}>
          {parts.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}({counts[p.id] ?? 0} 問)
            </option>
          ))}
        </select>
      </label>
      {/* **型で絞る**(2026-09 利用者の指定)。中身の欄のすぐ下に置く ——
          どちらも「出す問そのものが変わる」ものなので、同じ場所にまとめる。
          **1つも型が無ければ、欄ごと出さない**(効かない操作を見せない) */}
      {forms.length > 0 && (
        <label className="field field--inline nfunits-pick">
          <span className="field-label">型</span>
          <select className="input" value={nowForm}
                  onChange={(e) => onForm?.(e.target.value || null)}>
            {/* **「ぜんぶ」を先に置く。** これまでの通し練習を残す道である */}
            <option value="">ぜんぶ({all} 問)</option>
            {groups.map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.rows.map((f) => (
                  <option key={f.form} value={f.form}>{f.form}({f.n} 問)</option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
      )}
      {/* **何をする練習かを、その場で1行。** 選ぶたびに入れ替わる ——
          説明を1つにまとめると、**選んでいないほうの説明も読まされる** */}
      <p className="tip basicpick-lead">
        {lead}
        <strong>自分の Quick Response 帳とは混ざりません。</strong>
        できた記録は、中身を切り替えても残ります。
      </p>
    </div>
  )
}
