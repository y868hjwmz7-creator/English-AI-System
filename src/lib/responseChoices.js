/**
 * ============================================================================
 * **応答問題の「誤りの選択肢」を、こちらで組み立てる**
 * (第5.350節・2026-10-02 実機・利用者の指摘)
 *
 *   > また、選択肢ももっと増やしてください。同じもので使いまわし過ぎですので、
 *   > 全然関係ないものももっと入れないとです
 *
 * ── なぜ AI に作らせるのをやめたか ──────────────────────────
 *
 *   **2度めの指摘である。** 第5.344節では作り方の文を厳しくした
 *   (「正解に似せない」「話題も場面もかみ合わない応答にする」)。
 *   **それでも使いまわしは直らなかった。** 理由は2つある。
 *
 *     ①1回の呼び出しの中で、AI の「手持ち」が尽きる
 *     ②**呼び出しをまたぐと、前に何を出したかを知らない**
 *       (30 問ごとに別の呼び出しになる・第5.347節)
 *
 *   **指示では直せない形**である。だから**こちらで組み立てる。**
 *
 * ── こちらで組み立てると、4つが同時に効く ───────────────────
 *
 *   | | |
 *   |---|---|
 *   | **使いまわさない** | 1つの教材の中で、同じ選択肢を二度出さない |
 *   | **本当に関係がない** | 690 の表現から引く。正解とかみ合いようがない |
 *   | **長さがそろう** | 正解と語数の近いものから選ぶ(長いものが正解、にならない) |
 *   | **0円** | ファイルに書いてあるものは引き直さない(CLAUDE.md) |
 *
 * ── 正解の位置は、ここで決めない ──────────────────────────
 *
 *   `spreadAnswerMarks()`(第5.331節)が、**保存する直前に**段ごと均して
 *   散らす。ここで決めると**数え方が2通り**になる(CLAUDE.md)。
 *   ここは「正解と誤りを並べる」だけで、記号もあちらが振り直す。
 *
 * ── 何も取り込まない、にはできない ────────────────────────
 *
 *   候補の出どころ(`nativeFlow.js`)だけは要る。**データのファイルなので
 *   Supabase も `import.meta.env` も引き連れていない** ——
 *   `npm run test:response` が素の node でそのまま確かめられる。
 * ============================================================================
 */
import { nativeFlowRows } from '../data/nativeFlow.js'
import { normEn } from './textNorm.js'
/* **記号は `choiceLines.js` 1か所**(呼び名を2か所に書かない) */
import { CHOICE_MARKS } from './choiceLines.js'
/* **混ぜ方は `shuffle.js` 1か所。** 自前の混ぜ方を書かない(CLAUDE.md) */
import { shuffled } from './shuffle.js'
import { CHOICE_COUNT, CHOICE_LEAD, answerSpeakText } from './responseDrill.js'

/** 語数。**長さをそろえるのに使う** */
const words = (s) => String(s ?? '').trim().split(/\s+/).filter(Boolean).length

/** 1度組み立てたら控える(690 行を毎回組み直さない) */
let 控え = null

/**
 * **誤りの選択肢の候補。**
 *
 * Native Flow(690 の会話表現)を使う。**どれも「応答」の形**なので、
 * 並べても不自然にならない —— 単語帳の語を混ぜると
 * 「応答が1語だけ」になって、選択肢として浮く。
 */
export function choicePool() {
  if (控え) return 控え
  控え = nativeFlowRows()
    .map((r) => String(r?.en ?? '').trim())
    .filter(Boolean)
  return 控え
}

/**
 * ★ **選択肢を組み立てる。**
 *
 * - **この教材の正解は、1つも誤りに使わない**(ほかの問の正解が
 *   誤りの選択肢として出ると、どちらが正しいのか分からなくなる)
 * - **1つの教材の中で、同じ誤りを二度使わない**(「使いまわし過ぎ」の直し)
 * - **語数が正解に近いものから選ぶ** —— ただし近い順に並べて
 *   **広めの枠から混ぜて引く**(いちばん近いものだけを取ると、
 *   候補が偏って**また使いまわしになる**)
 * - **候補が足りなければ、その問は触らない**(黙って選択肢を減らさない)
 *
 * @param {Array} items 問(`answer` を持つ)
 * @param {boolean} on 選択肢を出す形か
 *   (`isResponseKind(kind) && hasChoices(form)`。**ここで判じ直さない**)
 * @param {object} [o]
 *   - `pool` … 候補(既定は `choicePool()`)
 *   - `count` … 選択肢の数(既定は `CHOICE_COUNT`)
 *   - `rand` … 乱数(検証から決まった並びを作るため)
 * @returns {Array} `question` を組み立て直した問
 */
export function buildChoices(items, on, { pool = null, count = CHOICE_COUNT, rand } = {}) {
  const rows = items ?? []
  if (!on || !(count >= 2) || count > CHOICE_MARKS.length) return rows
  const 候補 = pool ?? choicePool()
  if (!候補.length) return rows
  /** この教材の正解ぜんぶ。**誤りには使わない** */
  const 正解 = new Set(rows.map((it) => normEn(answerSpeakText(it))).filter(Boolean))
  /** もう誤りに使った鍵。**二度使わない** */
  const 使った = new Set()
  const 欲しい = count - 1
  return rows.map((it) => {
    const ans = answerSpeakText(it)
    if (!ans) return it
    const 残り = 候補.filter((c) => {
      const k = normEn(c)
      return k && !正解.has(k) && !使った.has(k)
    })
    /* **足りなければ触らない。** 選択肢を黙って減らさない */
    if (残り.length < 欲しい) return it
    const n = words(ans)
    /* 語数の近い順。**同じ語数の中の順は、元の並びのまま**(安定) */
    const 近い = 残り
      .map((c, i) => ({ c, d: Math.abs(words(c) - n), i }))
      .sort((a, b) => (a.d - b.d) || (a.i - b.i))
      .map((x) => x.c)
    /* **枠は広めに取る。** 狭いと候補が偏り、また使いまわしになる */
    const 枠 = 近い.slice(0, Math.max(欲しい * 10, 30))
    const えらぶ = shuffled(枠, rand).slice(0, 欲しい)
    えらぶ.forEach((c) => 使った.add(normEn(c)))
    /* **位置は `spreadAnswerMarks()` が散らす**(ここで決めない) */
    const 並び = [...えらぶ, ans]
    const lines = 並び.map((b, k) => `(${CHOICE_MARKS[k]}) ${b}`)
    return { ...it, question: [CHOICE_LEAD, ...lines].join('\n') }
  })
}
