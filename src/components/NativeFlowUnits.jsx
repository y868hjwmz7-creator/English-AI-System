
/**
 * **Native Flow を、Unit ごとに練習する**(2026-09 利用者の指定)。
 *
 * ============================================================================
 *   > UNIT毎に分けて quick response が出来るようにしてください。
 *
 * 【なぜ要るか】
 *
 *   Vol.1 だけで **690 問**ある。1冊のまま回すと、
 *   **何をどこまでやったのかが分からない。**
 *   原本が Unit 1〜6 に分けてあるのは、**表現の種類がそこで変わる**
 *   からである(1〜2単語 / 3〜4単語 / 句 / 4〜6単語 / 長い表現 / 数字)。
 *
 * 【`ShelfBooks` とまったく同じ形にする】
 *
 *   業種べつの単語帳も「出された冊から、いま開く1冊を選ぶ」である。
 *   **同じことをするものを、別の見た目で2つ作らない**(CLAUDE.md)。
 *
 * 【「ぜんぶ」を残す】
 *
 *   棚は 35 冊あるので「1冊選ぶ」しかないが、こちらは**6つ**で、
 *   しかも**いままで 690 問を通しで回せていた。**
 *   選べるものを黙って減らさない(**勝手に狭めない**)。
 *
 * 【自分では何も読まない】
 *
 *   問数は `NATIVE_FLOW_UNITS` がファイルに持っている(**0円**)。
 *   出してよい Unit は**呼ぶ側が決める**(`nfUnitsFor()` 1か所)——
 *   **`QrCard` / `ShelfBooks` と同じ「props で受け取る部品」**なので、
 *   骨組み(Supabase 無し)でもそのまま描ける(**描けないものは測れない**)。
 * ============================================================================
 *
 * @param units  出してよい Unit(`nfUnitsFor()` が決めたもの)
 * @param picked いま開いている Unit の番号。`null` なら「ぜんぶ」
 * @param onPick 選ばれた Unit の番号(「ぜんぶ」は `null`)
 */
export default function NativeFlowUnits({ units = [], picked = null, onPick = null }) {
  /** **出す Unit が1つも無ければ、欄ごと出さない**(効かない操作を見せない) */
  if (!units.length) return null

  /* **知らない番号が残っていても、「ぜんぶ」に落ちる。**
     `<select>` に無い値を渡すとブラウザが勝手に先頭を選ぶので、
     画面と中身が食い違う(`ShelfBooks` で踏んだ落とし穴) */
  const now = units.some((u) => u.id === Number(picked)) ? String(picked) : ''
  const all = units.reduce((n, u) => n + u.n, 0)

  return (
    <div className="wb-add nfunits">
      {/* **名前と欄を横に並べる決まりは、もう在る**(`.field--inline`)。
          ここで書き写さない */}
      <label className="field field--inline nfunits-pick">
        <span className="field-label">Unit</span>
        <select className="input" value={now}
                onChange={(e) => onPick?.(e.target.value ? Number(e.target.value) : null)}>
          {/* **「ぜんぶ」を先に置く。** これまでの通し練習を残す道である。
              **1つしか出ていない人には、それが「ぜんぶ」と同じ**なので、
              下の Unit と数が並んでも混乱しない */}
          <option value="">ぜんぶ({all} 問)</option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              Unit {u.id} {u.label}({u.n} 問)
            </option>
          ))}
        </select>
      </label>
      <p className="tip basicpick-lead">
        えらんだ Unit の問だけを練習します。
        <strong>自分の Quick Response 帳とは混ざりません。</strong>
        言えた記録は、Unit を切り替えても残ります。
      </p>
    </div>
  )
}
