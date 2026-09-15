import { SHELF_GROUPS } from '../data/shelves.js'

/**
 * **この人に出す「業種べつの単語帳」**(0057)。
 *
 *   > そして、ゲストにはトレーナーが指定した単語帳のみが追加されるのです。
 *
 * ## なぜ部品に切り出してあるか
 *
 * もとは `TrainerLearners.jsx` の中に直に書いてあった。ところがあの画面は
 * **Supabase を引き連れている**ので、`npm run test:bar` の骨組み
 * (Supabase 無し)では**1ドットも描かれない。**
 * **描けないものは測れない**(`SpeechBoard` → `SpeechPractice` と同じ話)。
 *
 * 実際、そのあいだに**押した結果がどこにも出ない**という不具合が
 * 入り込み、実機で指摘されるまで誰も気づけなかった(2026-09)。
 *
 *   > アサインしたい単語帳を選んだ後にできることがなにもありませんし、
 *   > アサインされる様子もありません。
 *
 * だから **`QrCard` / `WordRadio` / `JobBar` と同じ「props で受け取る部品」**
 * にしてある。**自分では何も読み込まない。**
 *
 * ## 決まりごと
 *
 * - **選んだ瞬間に出す。**「出す」ボタンは置かない
 *   —— 押すものが2つになるだけで、決めることは1つしかない。
 *   代わりに**そう書く**(「えらぶと、すぐ出します…」)。
 *   黙っていると「選んだあと、できることがない」と読める
 * - **押した結果は、必ずこの場に出す**(`note`)。
 *   画面のいちばん上に出すと、**単語帳のタブまで送った人には見えない**
 *   (CLAUDE.md「失敗の知らせは、その操作をした場所に出す」)
 * - **35冊あるので、札を35個並べない。** 選んで足し、押して外す
 *
 * @param shelfOn  いま出している棚(`{ id, label, group }`)
 * @param shelfOff まだ出していない棚
 * @param busy     いま切り替えている最中か
 * @param note     押した結果 `{ kind: 'busy'|'ok'|'ng', text }`
 * @param onPick   押された棚を受け取る(出す / 外すの判断は呼ぶ側)
 */
export default function ShelfAssign({ shelfOn, shelfOff, busy, note, onPick }) {
  return (
    <section className="card shelfassign">
      <h3 className="card-title">この人に出す「業種べつの単語帳」</h3>

      {/* **いま出している冊。** 見出しを出す ——
          札だけだと「外す」の文字が先に目に入り、
          これが**出ている印**だと読み取れない */}
      {shelfOn.length > 0 ? (
        <>
          <p className="field-label">いま出している単語帳</p>
          <div className="chiprow" role="group" aria-label="出している単語帳">
            {shelfOn.map((s) => (
              <button key={s.id} type="button" className="chip chip--on"
                      disabled={busy} onClick={() => onPick(s)}>
                {s.label}
                <span className="chip-count">外す</span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <p className="field-hint">
          まだ1冊も出していません。この人の単語帳には、
          <strong>業種べつの単語帳が1冊も出ません。</strong>
        </p>
      )}

      <label className="field">
        <span className="field-label">単語帳を足す</span>
        <select className="input" value="" disabled={busy}
                onChange={(e) => {
                  const s = shelfOff.find((x) => x.id === e.target.value)
                  if (s) onPick(s)
                }}>
          <option value="">えらぶと、すぐ出します…</option>
          {SHELF_GROUPS.map((g) => {
            const list = shelfOff.filter((s) => s.group === g.id)
            if (!list.length) return null
            return (
              <optgroup key={g.id} label={g.label}>
                {list.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </optgroup>
            )
          })}
        </select>
      </label>

      {/* **押した結果は、必ずこの場に出す**(2026-09 実機)。
          成功と失敗を、同じ見た目で終わらせない */}
      {note && (
        <p className={note.kind === 'busy' ? 'field-hint'
          : `notice notice--${note.kind === 'ok' ? 'ok' : 'warn'}`}
           role="status">
          {note.text}
        </p>
      )}

      {/* **「押して追加するまで混ざりません」とは、もう書かない**(0058)。
          入れる段そのものを消したので、棚の語は**独立した1冊**として並び、
          覚え具合も `shelf_reviews` に残る。
          **古い注意書きは、消し忘れると嘘になる**(CLAUDE.md) */}
      <p className="field-hint">
        出した単語帳は、この人の画面の単語帳に「業種べつ」として並びます。
        <strong>その人の語句とは混ざりません。</strong>
        {/* **下に出ているのは「自分の単語帳」だけ。** 黙って隠さず、そう書く */}
        下に出しているのはこの人の「自分の単語帳」なので、
        ここで出した1冊は下には並びません。
      </p>
    </section>
  )
}
