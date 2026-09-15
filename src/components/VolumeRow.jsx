/**
 * 音量のつまみ1本(2026-09 利用者の指定)。
 *
 *   > 英語の音声と音楽を独立してそれぞれ音量を調整出来るようにしたいです。
 *
 * **2本並ぶので、部品にしてある。** 書き写すと、片方だけ古くなる。
 *
 * 【札(◀ 70% ▶)にしなかった理由】
 *   `Stepper` はレッスン表示の帯のように**場所が無いところ**のための形で、
 *   あそこは「速さ 13 段」のように押して1つずつ動かすものだった。
 *   音量は**動かしながら耳で決める**ものなので、つまみのほうが素直である
 *   (しかも置き場所はメニューの下で、幅に余裕がある)。
 *
 * 【自分では覚えない】
 *   覚えるのは `mixVolume.js`、鳴っている曲に当てるのは `bgm.js`。
 *   ここは**受け取って描くだけ**にしてあるので、`npm run test:bar` が
 *   Supabase 無しでもそのまま描いて測れる(`QrCard` / `WordRadio` と同じ作法)。
 */
import { VOL_STEP, clampLevel, pctLabel } from '../lib/mixVolume.js'

export default function VolumeRow({ label, value, onChange }) {
  return (
    <div className="nav-setting">
      <span className="nav-setting-label nav-vol-head">
        {label}
        {/* **いまの大きさを数で出す。** つまみの位置だけでは、
            もう一方と同じ大きさなのかどうかが読み取れない */}
        <span className="nav-vol-pct">{pctLabel(value)}</span>
      </span>
      <input
        className="nav-vol"
        type="range"
        min="0"
        max="1"
        step={VOL_STEP}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(clampLevel(e.target.value, value))}
      />
    </div>
  )
}
