/**
 * **この人に出す Native Flow の Unit**(2026-09 利用者の指定)。
 *
 * ============================================================================
 *   > これも指定したゲストだけに届くように、
 *   > トレーナーにはデフォルトで表示されるように
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
 * @param note    押した結果 `{ kind: 'busy'|'ok'|'ng', text }`
 * @param onPick  押された Unit を受け取る(出す / 外すの判断は呼ぶ側)
 */
export default function NativeFlowAssign({
  units = [], on = [], busy = false, note = null, onPick = null,
}) {
  const shown = new Set([...on].map(Number))
  const n = units.filter((u) => shown.has(u.id)).length

  return (
    <section className="card nfassign">
      <h3 className="card-title">この人に出す「Native Flow」の Unit</h3>

      {/* **いま出している数を、先に言う。**
          札の色だけで数えさせない(**色だけに頼らない**・CLAUDE.md) */}
      {n > 0 ? (
        <p className="field-label">いま {n} つの Unit を出しています(押すと外します)</p>
      ) : (
        <p className="field-hint">
          まだ1つも出していません。この人の Quick Response 帳には、
          <strong>Native Flow が出ません。</strong>
        </p>
      )}

      <div className="chiprow" role="group" aria-label="出している Unit">
        {units.map((u) => {
          const isOn = shown.has(u.id)
          return (
            <button key={u.id} type="button"
                    className={`chip${isOn ? ' chip--on' : ''}`}
                    aria-pressed={isOn}
                    disabled={busy} onClick={() => onPick?.(u)}>
              Unit {u.id} {u.label}
              {/* **出している印は、文字でも言う。**
                  外すのか足すのか、押す前に分かるようにする */}
              <span className="chip-count">{isOn ? '外す' : `${u.n} 問`}</span>
            </button>
          )
        })}
      </div>

      {/* **押した結果は、必ずこの場に出す**(画面のいちばん上に出さない) */}
      {note && (
        <p className={note.kind === 'busy' ? 'field-hint'
          : `notice notice--${note.kind === 'ok' ? 'ok' : 'warn'}`}
           role="status">
          {note.text}
        </p>
      )}

      <p className="field-hint">
        出した Unit は、この人の Quick Response 帳に「Native Flow」として並びます。
        <strong>その人が溜めた文とは混ざりません。</strong>
        {/* **黙って隠さない。** トレーナー自身の画面との違いを、その場で言う */}
        トレーナー自身の Quick Response 帳には、指定がなくても 6 つとも出ます。
      </p>
    </section>
  )
}
