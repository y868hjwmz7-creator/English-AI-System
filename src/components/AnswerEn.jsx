/**
 * 解答の英語を出す(2026-09 利用者の指定)。
 *
 *   > 内容理解の設問と解答の訳を見れるようにしてください。音も聞けるように。
 *   > そして解答や設問も単語の意味を調べて単語帳に追加できるようにしてください。
 *
 * 【なぜ部品にしたか】
 *   解答が出る場所は**3つ**ある(トレーナーの「教材の中身」/ レッスン表示 /
 *   ゲストの「今週の宿題」)。**同じ見た目を3か所に書き写さない**(CLAUDE.md)。
 *   書き写すと、必ずどこかだけ古くなる。
 *
 * 【これまで】
 *   解答は**ただの文字**だった。だから
 *     ・語に触れても意味が出ない(単語帳にも入れられない)
 *     ・読み上げられない
 *     ・訳が無い
 *   設問のほうは `EnglishText` で描いてあったので、**片方だけができていた。**
 *
 * 【出す順】
 *   英語 → 訳 → Listen。**訳はボタンより上に置く。**
 *   下に置くと、狭い画面で画面の外へ押し出される(「答えはボタンの上に出す」)。
 */
import EnglishText from './EnglishText.jsx'
import SpeakButton from './SpeakButton.jsx'

export default function AnswerEn({
  text, ja = '', level = null,
  statuses = null, onMark = null,
  /** 読み上げに使う声。**渡さなければ Listen を出さない**(効かない操作を見せない) */
  clipVoice = undefined, tier = undefined, voice = null, rate = null,
  /** その画面の解答行の見た目(`detail-answer` / `lesson-answer` など) */
  className = '',
  /** 訳の行の見た目。画面ごとに地色が違う */
  jaClassName = 'answer-ja',
}) {
  const body = String(text ?? '').trim()
  if (!body) return null
  return (
    <>
      <div className={className}>
        <span aria-hidden="true">→ </span>
        <EnglishText text={body} level={level} statuses={statuses} onMark={onMark} />
      </div>
      {String(ja ?? '').trim() && <div className={jaClassName}>{ja}</div>}
      {clipVoice !== undefined && (
        <div className="item-audio">
          <SpeakButton text={body} voice={voice} clipVoice={clipVoice} tier={tier}
                       {...(rate == null ? {} : { rate })} />
        </div>
      )}
    </>
  )
}
