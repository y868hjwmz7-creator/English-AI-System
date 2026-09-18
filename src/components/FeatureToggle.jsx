/**
 * **この人の画面に出す / 出さない**を切り替える1行(第5.181節)。
 *
 * ============================================================================
 *   > 新しい冊をアサインするのは各ゲストの単語帳もquick response帳、
 *   > もしくは「アサインする」の機能を作り、その中から教材、単語帳の冊、
 *   > quick responseの冊を選べるようにしたいです。
 *
 * 【なぜ部品に切り出したか】
 *
 *   もとは `TrainerLearners.jsx` の中に直に書いてあり、
 *   **「レベルとスコア」のタブ**に置いてあった。
 *   ところが利用者の指定(2026-09)は、決める場所を**出る場所のとなり**へ、
 *   である。
 *
 *     > ゲストへの単語帳のアサインは、レベルとスコアからではなく、
 *     > ゲストの単語帳からできるようにしてください。
 *
 *   同じことを**単語帳のタブ・Quick Response のタブ・「アサインする」の画面**の
 *   3か所で出すので、**書き写すと必ず食い違う**(CLAUDE.md)。
 *
 * 【`ShelfAssign` / `NativeFlowAssign` と同じ「props で受け取る部品」】
 *
 *   自分では何も読み込まない。骨組み(Supabase 無し)でもそのまま描ける
 *   (**描けないものは測れない**・CLAUDE.md)。
 *
 * 【見た目は1ドットも変えていない】
 *
 *   切り出す前の JSX をそのまま持ってきてある。
 *   **寄せたついでに直さない**(`.claude/rules/common.md`)。
 * ============================================================================
 *
 * @param feature 一覧の1行(`{ id, label, hint }`)
 * @param on      いま出しているか
 * @param busy    いま決めている最中か
 * @param onPick  押されたら呼ばれる(出す / 外すの判断は呼ぶ側)
 */
export default function FeatureToggle({
  feature = null, on = false, busy = false, onPick = null,
}) {
  /** **中身が無ければ、行ごと出さない**(何の話か分からない札を出さない) */
  if (!feature?.id) return null

  return (
    <div className="feature-row">
      <button type="button"
              className={`btn btn--toggle${on ? ' is-active' : ''}`}
              disabled={busy}
              aria-pressed={on}
              onClick={() => onPick?.(feature)}>
        {busy
          ? '決めています…'
          : `${on ? '出しています' : '出していません'} — ${feature.label}`}
      </button>
      {feature.hint && <p className="field-hint">{feature.hint}</p>}
    </div>
  )
}
