/**
 * **この冊を出す相手**(第5.179節・2026-09 利用者の指定)。
 *
 * ============================================================================
 *   > Native Flow や 14 の型は指定したゲストにだけ出るようにしたいです。
 *   > トレーナーの単語帳 / Quick Response、または、トレーナーアカウント内の
 *   > ゲストの単語帳 / Quick Response帳からアサインできるようにしたいです。
 *
 * 【入れ物は、棚(業種べつの単語帳)とまったく同じ】
 *
 *   0055 の `learner_features`(ゲスト × 名前で1行)に入る。
 *   **新しい表も、新しい窓口も、貼る SQL も1つも増えていない。**
 *   名前の作り方は `nfFeature()`(Native Flow)と `FRAME_QR`(型の冊)
 *   1か所ずつで、**ここでは組み立てない。**
 *
 * 【自分では何も読み込まない】
 *
 *   `ShelfAssign` / `NativeFlowAssign` / `QrCard` と同じ
 *   「**props で受け取る部品**」。`QrReview.jsx` は Supabase を
 *   引き連れているので、あそこに直に書くと**骨組みでは1ドットも描かれない。**
 *   **描けないものは測れない**(実際それで「押しても何も起きない」が
 *   実機で指摘されるまで残った・2026-09)。
 *
 * 【「自分」は並べない】
 *
 *   この2冊は**トレーナーには既定で出る**(`showsNfUnit()` /
 *   `showsFrameQr()`)。だから自分の行を置いても**押しても何も変わらない** ——
 *   **効かない操作を見せない**(CLAUDE.md)。
 *   そのかわり、そうだと**書く**(黙って消さない)。
 *
 * 【決まりごと(`ShelfAssign` から1文字も変えていない)】
 *
 *   - **押した瞬間に出す。**「出す」ボタンは置かない ——
 *     押すものが2つになるだけで、決めることは1つしかない
 *   - **押した結果は、必ずこの場に出す**(`note`)。画面のいちばん上に
 *     出すと、本棚を送った人には見えない(CLAUDE.md)
 *   - **色だけに頼らない** —— 印(●/○)+ 太字 + 枠 + 「出す / 外す」の文字
 * ============================================================================
 *
 * @param label  冊の名前(「14 の型」)。**画面で組み立てない**
 * @param lead   1行の説明(誰に出るのか・どこに出るのか)
 * @param rows   出せる相手。`[{ id, name, on, extra }]`。**`null` は読み込み中**
 * @param busy   いま切り替えている相手の id(`null` なら何もしていない)
 * @param note   押した結果 `{ ng, text }`
 * @param onPick 押された相手を受け取る(出す / 外すの判断は呼ぶ側)
 */
export default function BookAssign({
  label = '', lead = '', rows = null, busy = null, note = null, onPick = null,
}) {
  /** **名前が無ければ、欄ごと出さない**(何の冊の話か分からない札を出さない) */
  if (!label) return null

  return (
    <section className="bookassign">
      <p className="field-label">「{label}」を出す相手</p>
      {lead && <p className="field-hint">{lead}</p>}

      {/* **黙って空にしない。** 読んでいる最中と、いない場合を書き分ける
          (**0 と `null` を取り違えない**・CLAUDE.md) */}
      {rows === null ? (
        <p className="muted">読んでいます…</p>
      ) : rows.length === 0 ? (
        <p className="field-hint">担当しているゲストが、まだいません。</p>
      ) : (
        <div className="chiprow" role="group" aria-label={`「${label}」を出す人`}>
          {rows.map((r) => (
            <button key={r.id} type="button"
                    className={`chip${r.on ? ' chip--on' : ''}`}
                    aria-pressed={r.on ? 'true' : 'false'}
                    disabled={busy !== null}
                    onClick={() => onPick?.(r)}>
              {/* **印も出す。** 色と地色だけだと、出しているのか
                  これから出すのか読み取れない(CLAUDE.md) */}
              <span aria-hidden="true">{r.on ? '●' : '○'}</span>
              {r.name}
              <span className="chip-count">
                {busy === r.id ? '…' : (r.extra || (r.on ? '外す' : '出す'))}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* **成功と失敗を、同じ見た目で終わらせない**(CLAUDE.md) */}
      {note && (
        <p className={note.ng ? 'notice notice--warn' : 'muted'}>{note.text}</p>
      )}
    </section>
  )
}
