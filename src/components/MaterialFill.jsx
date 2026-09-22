/**
 * **すでにある教材に、足りない演習だけを足す欄**(第5.234節)。
 *
 * 【何を解いているか】(2026-09 利用者の指定)
 *
 *   > RIZAP ENGLISH / Booking a Bus / Conversation 1 — UNIT 1
 *   > この教材を改めて新しい Generate material で作成しなおせませんか
 *
 *   新しい演習は、これから作る教材にしか付かなかった。作り直すと
 *   **本文が別の文章になってしまう。**
 *
 * 【決まりごと】
 *   ・**足せるかどうかの判断は `materialFill.js` 1か所。**
 *     ここで `exercise_type === '…'` と書かない(CLAUDE.md)
 *   ・**既定は「全部作る」。** 足りないから出している欄である。
 *     外したものだけを控える
 *   ・**押す前に、問数と金額を出す**(見えない費用は管理できない)
 *   ・**やめる道を、必ず並べて置く**(`VoiceRemake` と同じ・2026-09 実機)
 *   ・**見た目は、教材を作る画面のチェックリストと同じものを使う**
 *     (`amount-row` / `amount-pick`)。同じことをするものを2つ作らない
 *   ・**props で受け取るだけ**にしてある —— Supabase が要らないので、
 *     骨組み(`?screen=fill`)でそのまま描いて測れる
 */
import { useState } from 'react'
import { exerciseLabel } from '../data/exerciseTypes.js'
import { fillGuess, fillableSections } from '../lib/materialFill.js'

export default function MaterialFill({ material, busy, onRun, onCancel }) {
  /* **外したものだけを持つ。** 既定は全部作る。
     **フックは、早い return より前に置く**(CLAUDE.md) */
  const [off, setOff] = useState({})

  const all = fillableSections(material)
  const picked = all.filter((s) => !off[s.exercise_type])
  const guess = fillGuess(picked)

  /* **足せるものが無ければ、欄ごと出さない**(効かない操作を見せない)。
     ボタンの側も同じ判断で出していないので、ここに来ることは無い ——
     **それでも「できない」側を既定にしておく**(CLAUDE.md) */
  if (!all.length) return null

  return (
    <div className="material-fill">
      <div className="amount-row">
        {all.map((s) => {
          const on = !off[s.exercise_type]
          return (
            <div key={s.exercise_type}
                 className={`amount-pick${on ? '' : ' is-off'}`}>
              <label className="amount-label">
                <input type="checkbox" checked={on} disabled={busy}
                       onChange={() => setOff({ ...off, [s.exercise_type]: on })} />
                <span>
                  {exerciseLabel(s.exercise_type)}
                  <span className="amount-count">{s.count}</span>
                </span>
              </label>
              {!on && <span className="amount-off">入れません</span>}
            </div>
          )
        })}
      </div>

      <p className="notice notice--warn">
        <strong>本文はそのままです。</strong>
        いまの本文から、選んだ演習だけを作って後ろに足します
        (<strong>読み上げ音声は作り直しになりません</strong>)。
        <br />
        {/* **0 と `null` を取り違えない**(CLAUDE.md)。
            1つも選ばれていないのは「数えられなかった」のではなく、
            本当に 0 である。**そのときは金額を出さない** */}
        {guess.sections > 0 ? (
          <>
            <strong>{guess.items} 問</strong>を作ります(Claude に課金されます。
            およそ <strong>{guess.yen} 円</strong>)。
          </>
        ) : (
          <>作る演習が、1つも選ばれていません。</>
        )}
      </p>

      <div className="btn-row">
        <button type="button" className="btn btn--small btn--quiet"
                disabled={busy || guess.sections === 0}
                onClick={() => onRun(picked)}>
          この演習を足す
        </button>
        <button type="button" className="btn btn--small btn--ghost" disabled={busy}
                onClick={onCancel}>
          やめる
        </button>
      </div>
    </div>
  )
}
