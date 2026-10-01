import { dropsLead, splitChoices } from '../lib/choiceLines.js'

/**
 * **設問を、選択肢ごとの行にして出す**(2026-09-30 利用者の指定・第5.329節)。
 *
 *   > 毎問題に choose... は不必要なので省き、1番上の取り組み方を開いた
 *   > 時に見れるようにすれば十分です。
 *   > そして、選択肢だけ3行に改行して並べてください。
 *
 * **教材そのものは1文字も書き換えない。** 画面に出すときに割るだけなので、
 * **すでにある教材にもそのまま効く**(作り直し = 課金をしない)。
 *
 * ── ★ **レッスン表示から、ここへ出した**(第5.338節・2026-10-01)────
 *
 *   > TOEIC PART5 は四択でしょう？調べて同じようにしてくださいと
 *   > 依頼したはずですが。
 *
 *   **この部品は `LessonView.jsx` の中にだけ在った。** だから
 *   **ゲストの宿題の画面と、教材の中身(紙)では、4つの選択肢が
 *   1行の団子のまま**だった —— 同じ教材なのに、開く場所で形が違う。
 *
 *   **出したついでに中身を直していない**(見た目も振る舞いも同じ)。
 *   変えたのは1つだけで、**包む箱の名前を `cls` で受け取る**ようにした
 *   (画面ごとに字の大きさの決まりが違うため)。
 *   既定は `lesson-en` なので、**レッスン表示は1ミリも変わらない。**
 *
 * @param {string} text  設問(選択肢を含むことがある)
 * @param {string|string[]} drop 出さなくてよいもの。**1つでも配列でも受ける**。
 *        ①演習ぜんぶで同じ指示文(「取り組み方」へ回したもの)
 *        ②★**すぐ上に出ている英文**(第5.342節)——
 *          穴埋めでは `question` の頭に `prompt_en` の写しが入ることがあり、
 *          **同じ文が2回出る。** 判断は `dropsLead()` 1か所。
 *        **その問だけ違う指示なら、ここに残して出す**(黙って消さない)
 * @param {(t: string) => React.ReactNode} en 英文を描く中身(画面ごとに違う)
 * @param {string} cls   1行を包む箱の名前
 */
export default function ChoiceLines({ text, drop = '', en, cls = 'lesson-en' }) {
  const { lead, choices } = splitChoices(text)
  if (!choices.length) return <div className={cls}>{en(text)}</div>
  const 前 = dropsLead(lead, drop) ? '' : lead
  return (
    <div className="choice-lines">
      {前 && <div className={cls}>{en(前)}</div>}
      {choices.map((c) => <div className={cls} key={c}>{en(c)}</div>)}
    </div>
  )
}
