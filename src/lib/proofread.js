/**
 * ============================================================================
 * **作った英文を、出す前に読み返す**(第5.358節・2026-10-03 実機・利用者の指摘)
 *
 *   > VERSANTのPART Aの問題、この添付のような問題文は意味不明です。
 *   > **こういうバグが起こらないような仕組みは作れますか？**
 *
 * 実機ではこう出ていた。
 *
 *     読み上げた英文: What do you call the first meal of a wedding day
 *                     called a party after it?
 *     訳            : 結婚式の後に開かれるパーティーを何と呼びますか?
 *     正解          : A reception(披露宴)
 *
 *   **訳も正解も正しい。英文だけが壊れている。**
 *   `call` と `called` が1文に2回入り、関係詞のつなぎが崩れている ——
 *   言いたかったのは `What do you call the party held after a wedding?` である。
 *
 * ── **決まりで見つけようとして、measured で諦めた** ──────────────
 *
 *   「同じ語幹が1文に2回出たら壊れている」を思いつき、**実データで測った。**
 *
 *     Native Flow 690 件中 **13 件**が引っかかる(1.9%)
 *       from time to time / over and over again / Same old same old.
 *       on a first come first served basis / What's done is done.
 *       It ain't over till it's over. / kinda right and kinda wrong …
 *
 *   **どれも正しい英語である。** これで落とすと**良い問を黙って捨てる**
 *   (CLAUDE.md「黙って落とさない」)。しかも捕まえられるのは
 *   **この1つの崩れ方だけ**で、ほかの壊れ方は素通りする。
 *   **決まりでは無理だと、測って決めた。**
 *
 * ── だから **読み返す**(AI をもう1回・ただし桁違いに安い)────────
 *
 *   作り終わった英文だけを並べて、**壊れているものはどれか**を聞く。
 *
 *     送るもの … 英文だけ(30 問で 60 行ほど・900 語)
 *     返るもの … 壊れている行の番号と、その理由だけ
 *
 *   **教材を作る呼び出しの 1/30 ほど**である(あちらは指示も作り方も長い)。
 *   使ったぶんは `usage` に足すので、**画面の「かかった費用」にそのまま乗る**
 *   (見えない費用を作らない・CLAUDE.md)。
 *
 *   落とした問は**作り直しの輪がそのまま埋める**
 *   (`generateSectionUnique` の中に置いたので、ほかの落とし方と同じ扱い)。
 *   **理由も分けて数える**(`broken`)—— 第5.341節で「落とした理由を
 *   決めつけて出した」ために3回ぶんを無駄にしたので、ここでも分ける。
 *
 * ── なぜ別のファイルなのか ──────────────────────────────
 *
 *   `materials.js` は Supabase と `import.meta.env` を引き連れており、
 *   **手元で一度も走らせられない。** 算段だけをここへ出せば、
 *   素の node でそのまま読める(`dropReasons.js` / `dedupKeys.js` と同じ作法)。
 *
 * **何も取り込んでいない。** そのまま保つこと。
 * ============================================================================
 */

/**
 * **読み返す欄。** 人が声に出す英文と、画面に出る英文である。
 *
 * **訳(`*_ja`)は入れない** —— 壊れていたのは英文のほうで、
 * 訳まで送ると語数が倍になる(送る語数ぶん課金される)。
 * **解答(`answer`)は入れる** —— あれも読み上げるし、画面にも出る。
 */
export const PROOF_FIELDS = ['audio_text', 'prompt_en', 'answer', 'text_en']

/**
 * **これより短いものは送らない。**
 *
 * 2語以下(`Me too.` / `Not yet.` / `Sure.`)は**文法が壊れようがない。**
 * 送っても壊れていると言われないので、語数ぶんが無駄になるだけである。
 */
export const MIN_WORDS = 3

const words = (s) => String(s ?? '').trim().split(/\s+/).filter(Boolean)

/**
 * **読み返しに送る英文を、問から集める。**
 *
 * **同じ英文は1度だけ**(同じ行を2回送れば、2回ぶん課金される)。
 * **並びは出た順**で、呼ぶ側はこの並びの番号で受け取る。
 *
 * @param {Array<object>} items 作った問
 * @returns {string[]} 送る英文(重複なし)
 */
export function proofLines(items) {
  const seen = new Set()
  const out = []
  for (const it of items ?? []) {
    for (const f of PROOF_FIELDS) {
      const v = String(it?.[f] ?? '').trim()
      /* **英語でないものを送らない。** 訳の欄に英文を入れる教材は無い */
      if (!/[A-Za-z]/.test(v)) continue
      if (words(v).length < MIN_WORDS) continue
      const key = v.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      out.push(v)
    }
  }
  return out
}

/**
 * **壊れている英文を1つでも持つ問を落とす。**
 *
 * **落とさずに直さないのは、直した英文の訳が古くなるからである** ——
 * `answer_ja` も `prompt_ja` も、もとの英文に合わせて書かれている。
 * **落として作り直させるほうが、食い違いを作らない。**
 *
 * @param {Array<object>} items 作った問
 * @param {Iterable<string>} broken 壊れている英文(`proofLines` が返した形のまま)
 * @returns {{kept: object[], dropped: object[]}}
 */
export function dropBroken(items, broken) {
  const ng = new Set([...(broken ?? [])]
    .map((s) => String(s ?? '').trim().toLowerCase()).filter(Boolean))
  const kept = []
  const dropped = []
  /* **1つも無ければ、何も触らない**(いちばん危ない形・CLAUDE.md) */
  if (!ng.size) return { kept: [...(items ?? [])], dropped }
  for (const it of items ?? []) {
    const 壊れ = PROOF_FIELDS.some((f) => ng.has(String(it?.[f] ?? '').trim().toLowerCase()))
    if (壊れ) dropped.push(it)
    else kept.push(it)
  }
  return { kept, dropped }
}
