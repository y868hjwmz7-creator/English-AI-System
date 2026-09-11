/**
 * スピーチ練習 — 独立した機能(2026-08 利用者の指定)。
 *
 * > 「発音練習」だけは独立した機能としてメニューに追加してください。
 *
 * **呼び名は 2026-09 に「スピーチ練習」へ変えた**(利用者の指定
 * 「『発音を練習』を『スピーチ練習』にしてください」)。
 * **id(`pronunciation`)もファイル名も変えていない** —— 覚えている画面
 * (`eas.*`)も取り組みの記録(`practice_days.kind`)もこの id で残っており、
 * 変えると**過去の記録が別物になる。**
 * **教材の種類「Speech練習」(`kind = 'speech'`)とは別物である。**
 * あちらは自分の原稿を貼って練習する教材、こちらは声に出す画面。
 *
 * ============================================================================
 * 【単語とフレーズの音は、いま出していない】(2026-09 利用者の指定)
 *
 *   > 発音の機能は一度廃止してください。
 *   > いつでも戻せるように
 *
 *   この画面には2つ入っていた。**わたしのスピーチ**(0054)と
 *   **単語とフレーズの音**である。利用者が言った「発音の機能」は後者で、
 *   前者は数日前に利用者自身が頼んだもの(しかも画面の名前が
 *   スピーチ練習である)。だから**後者だけ**を閉じた。
 *
 *   - **画面もメニューの項目も消していない。** 取り組みの記録
 *     (`practice_days.kind = 'pronunciation'`)も、これまでどおり残る
 *   - **道は `SoundPractice.jsx` にそのまま残してある。**
 *     消すと、戻したい日に画面を書き直すことになり、
 *     そのときには経緯も失われている(`LEARNER_WRITING_REVIEW` と同じ作法)
 *   - **戻す日は `src/data/soundPractice.js` の1行を `true` にするだけ**
 *
 *   **判断をここに書かない。** `soundPracticeOn()` に任せる ——
 *   画面の中に `SOUND_PRACTICE_ON` と直に書くと、置く場所の数だけ食い違う
 *   (`remakeModeOf()` / `canAskReview()` と同じ考え方)。
 */
import { soundPracticeOn } from '../data/soundPractice.js'
import { usePracticeLog } from '../lib/practice.js'
import SoundPractice from './SoundPractice.jsx'
import SpeechBoard from './SpeechBoard.jsx'

/**
 * @param me  いま開いている人のプロフィール(`App.jsx` が読んだもの)。
 *   **レベル(`cefr`)だけを使う** —— スピーチの添削を、
 *   その人の段に合わせて頼むため(2026-09 利用者の指定)。
 *   渡さなければ `speechLevelOf()` が既定に落とす(行き止まりを作らない)。
 */
export default function PronunciationPractice({ me = null }) {
  // 取り組みを**裏で数える**(0022)。ゲストのぶんだけ。
  // **廃止とは関わりがない** —— 画面そのものは、これまでどおり在る
  usePracticeLog('pronunciation')

  return (
    <div className="stack">
      {/* ── スピーチの原稿(0054・2026-09 利用者の指定)────────────
            > ゲストアカウントのスピーチ内から受け取ったスピーチの原稿を
            > AIにより添削し、そしてその文の音声を作成、ゲスト側で
            > 練習できる機能です。

          **3つめの名前を作らない。** 利用者が言った「スピーチ内から」は
          この画面のことなので、**すでにあるこの画面の中**に置く
          (CLAUDE.md「スピーチ練習」と「Speech練習」を取り違えない) */}
      <SpeechBoard level={me?.cefr ?? null} />

      {/* いまは閉じている(上記)。**戻す日は `soundPracticeOn()` の1行** */}
      {soundPracticeOn() && <SoundPractice />}
    </div>
  )
}
