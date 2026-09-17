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
 * @param parts  中身の一覧(`FRAME_PARTS`)
 * @param counts 中身ごとの問数(`frameQrCounts()`)
 * @param picked いま開いている中身の id
 * @param onPick 選ばれた中身の id
 */
export default function FrameParts({
  parts = [], counts = {}, picked = null, onPick = null,
}) {
  /** **中身が1つも無ければ、欄ごと出さない**(効かない操作を見せない) */
  if (!parts.length) return null

  /* **知らない id が残っていても、いちばんやさしいものに落ちる。**
     `<select>` に無い値を渡すとブラウザが勝手に先頭を選ぶので、
     画面と中身が食い違う(`ShelfBooks` で踏んだ落とし穴) */
  const now = parts.some((p) => p.id === picked) ? picked : parts[0].id
  const lead = parts.find((p) => p.id === now)?.lead ?? ''

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
