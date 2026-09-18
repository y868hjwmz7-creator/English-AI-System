/**
 * **型の冊の、どの中身を練習するか**(2026-09 利用者の指定)。
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
 *   **型を書き写さない。** 一覧も並びも組の名前も系ごとの問数も
 *   `frameQrGroups()`(`sentenceFrames.js` の並び)が持つ。
 *   `<optgroup>` は、その組の名前をそのまま見出しにするだけである。
 *
 * 【「〜系ぜんぶ」を、組の見出しの下に1つ置く】(2026-09 利用者の指定)
 *
 *   > 選択肢に「〜系全て」を追加してください。
 *
 *   `S allows 人 to do` と `S enables 人 to do` は、
 *   覚える側から見れば**同じ「させる」の言い方違い**である。
 *   1本ずつしか選べないと、**系をまとめて練習する道が無い。**
 *
 *   **数も名前も、こちらで作らない** —— `frameQrGroups()` が
 *   `kei`(短い呼び名)と `n`(系ぜんぶの問数)を持って来る。
 *   ここで足し算すると、**札の数と出てくる問がずれる**(CLAUDE.md)。
 *
 * @param parts  中身の一覧(`FRAME_PARTS`)
 * @param counts 中身ごとの問数(`frameQrCounts()`)
 * @param picked いま開いている中身の id
 * @param onPick 選ばれた中身の id
 * @param groups 絞れる型の一覧を、系ごとに束ねたもの(`frameQrGroups()`)
 * @param form   いま絞っているもの。`null` なら「ぜんぶ」
 * @param onForm 選ばれた絞り方(「ぜんぶ」は `null`)
 */
export default function FrameParts({
  parts = [], counts = {}, picked = null, onPick = null,
  groups = [], form = null, onForm = null,
}) {
  /** **中身が1つも無ければ、欄ごと出さない**(効かない操作を見せない) */
  if (!parts.length) return null

  /* **知らない id が残っていても、いちばんやさしいものに落ちる。**
     `<select>` に無い値を渡すとブラウザが勝手に先頭を選ぶので、
     画面と中身が食い違う(`ShelfBooks` で踏んだ落とし穴) */
  const now = parts.some((p) => p.id === picked) ? picked : parts[0].id
  const lead = parts.find((p) => p.id === now)?.lead ?? ''
  /* **知らない絞り方が残っていても、「ぜんぶ」に落ちる**(`ShelfBooks` と同じ)。
     **この欄に出しているものと突き合わせる** —— 型ひとつでも系ぜんぶでも同じ */
  const pick = new Set(
    groups.flatMap((g) => [g.value, ...g.rows.map((f) => f.form)]),
  )
  const nowForm = pick.has(form) ? form : ''
  /* **全体の問数も足し算しない。** 系ごとの数を足すだけである */
  const all = groups.reduce((n, g) => n + g.n, 0)

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
      {groups.length > 0 && (
        <label className="field field--inline nfunits-pick">
          <span className="field-label">型</span>
          <select className="input" value={nowForm}
                  onChange={(e) => onForm?.(e.target.value || null)}>
            {/* **「ぜんぶ」を先に置く。** これまでの通し練習を残す道である */}
            <option value="">ぜんぶ({all} 問)</option>
            {groups.map((g) => (
              <optgroup key={g.key} label={g.label}>
                {/* **「〜系ぜんぶ」を、その系のいちばん上に**(2026-09 利用者の指定)。
                    **呼び名が無い系には出さない**(「系ぜんぶ」になってしまう) */}
                {g.kei && (
                  <option value={g.value}>{g.kei}系ぜんぶ({g.n} 問)</option>
                )}
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
