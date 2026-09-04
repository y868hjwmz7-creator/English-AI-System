/**
 * **「読み上げの声」の札。** 押すと、誰がどの声で読むかが出る。
 *
 * 【なぜ要るか】(2026-09 利用者の指定)
 *
 *   > 各教材のトップにスピーカーが確認できるタブをつけてください
 *
 *   声そのものに癖がある(語尾に雑音が乗る・息が荒い)ことがあり、
 *   **気づけるのは聞いた利用者だけ**である。ところが声は教材に
 *   id で保存されているだけなので、「あの声を外して」と言うには
 *   **名前が見えていなければならない。**
 *
 *   はじめは、さがす画面のカードに**いつも出ている1行**にしていた。
 *   けれども毎回読むものではないので、**ふだんは畳んでおく**
 *   (利用者の指定)。押したときだけ名前が出る。
 *
 * 【決まりごと】
 *   ・出すのは**話す人がいる教材だけ**(会話・会議)。
 *     記事・ドリル・単語では `castList()` が `null` を返すので、
 *     この札そのものが出ない(**効かない操作を見せない**)
 *   ・**声を選んでいない教材でも出す。** 空でも音は鳴る
 *     (代役に落ちる)ので、**鳴るなら名前が出る**
 *     (2026-09 実機「Mikaの音声が誰なのか確認できません」)
 *   ・**当て方は `castList()` 1か所に任せる。** ここで数え直すと、
 *     画面に出す名前と、実際に鳴る声がずれる
 *   ・**開け閉めは覚えない。** 確かめたいときにだけ開くものである
 *     (取り組み方の説明と同じ考え方)
 *   ・**紙には出さない**(`no-print`)。記事・会話の紙は
 *     「書き込むための用紙」で、中身は決まっている(仕様書 5.70)
 */
import { useState } from 'react'
import { castList } from '../lib/voiceCast.js'

export default function CastChip({ material, className = '' }) {
  const [open, setOpen] = useState(false)
  const list = castList(material)
  if (!list?.length) return null

  return (
    <div className={`cast-chip no-print${className ? ` ${className}` : ''}`}>
      <button type="button"
              className={`chip cast-chip-btn${open ? ' chip--on' : ''}`}
              aria-expanded={open}
              onClick={() => setOpen(!open)}>
        {/* **印は文字で描く。** 絵文字は端末ごとに形も大きさも違う */}
        <span className="cast-chip-mark" aria-hidden="true">{open ? '▾' : '▸'}</span>
        読み上げの声
      </button>
      {/* **1人ずつ行を分ける。** つないで1本にすると、
          3人・4人の会議では読み取れない棒になる */}
      {open && (
        <ul className="cast-chip-list">
          {list.map((c) => (
            <li key={c.speaker}>
              <span className="cast-chip-who">{c.speaker}</span>
              <span className="cast-chip-eq" aria-hidden="true">=</span>
              <span className="cast-chip-voice">{c.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
