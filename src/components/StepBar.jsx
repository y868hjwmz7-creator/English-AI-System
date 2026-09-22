/**
 * **6Steps の帯**(第5.239節・2026-09 利用者の指定)。
 *
 * ════════════════════════════════════════════════════════════════
 *   > 6steps として6つ作ると煩雑だと思うんです。
 *   > もう少しスタイリッシュかつシンプル、分かりやすく出来ないでしょうか?
 *
 * 【なぜプルダウンをやめたか】
 *
 *   プルダウンは**開くまで6つが見えない。** 順にやるものなのに、
 *   「いま何番目か」「あといくつか」が画面に出ていなかった。
 *   6つを**そのまま並べれば、それ自体が道しるべ**になる。
 *
 * 【決まりごと】
 *   ・**並びは `SIX_STEPS` のまま。** ここで並べ替えない・減らさない
 *   ・**色だけに頼らない**(共通ルール)—— いまの1つは
 *     地色 + 枠線 + 太字 + `aria-current="step"` の4つで示す
 *   ・**狭い画面では番号だけ**にして1行に収める。名前は `aria-label`
 *     と `title` に残るので、**読み上げからは消えない**
 *   ・**props で受け取るだけ**にしてある —— Supabase も窓口も要らないので、
 *     骨組み(`?screen=steps`)でそのまま描いて測れる
 * ════════════════════════════════════════════════════════════════
 *
 * @param step   いまの取り組み方の id
 * @param onChange 押したときの合図(id)
 */
import { SIX_STEPS } from '../lib/sixSteps.js'

export default function StepBar({ step, onChange, disabled = false }) {
  return (
    <div className="step-bar" role="group" aria-label="6Steps">
      {SIX_STEPS.map((s) => {
        const on = s.id === step
        return (
          <button key={s.id} type="button" disabled={disabled}
                  className={`chip step-bar-item${on ? ' chip--on' : ''}`}
                  aria-current={on ? 'step' : undefined}
                  aria-label={`${s.no} ${s.label}`} title={s.label}
                  onClick={() => onChange?.(s.id)}>
            <span className="step-bar-no" aria-hidden="true">{s.no}</span>
            {/* **名前は、広い画面でだけ出す。**狭い画面で消えるのは
                見た目だけで、読み上げは `aria-label` が受け持つ */}
            <span className="step-bar-name" aria-hidden="true">{s.label}</span>
          </button>
        )
      })}
    </div>
  )
}
