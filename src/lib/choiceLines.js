/**
 * **選択肢を行に割る**(2026-09-30 利用者の指定・第5.329節)。
 *
 *   > 毎問題に choose... は不必要なので省き、1番上の取り組み方を開いた
 *   > 時に見れるようにすれば十分です。そして、選択肢だけ3行に改行して
 *   > 並べてください。
 *
 * TOEIC L&R Part 2 の設問は、1本の文字列で入っている。
 *
 *     Choose the best response. (A) That's … (B) The task … (C) He …
 *
 * **同じ指示文が、問の数だけ並ぶ。** 25 問あれば 25 回読まされる。
 * 指示は**演習に1つ**あればよい ——「取り組み方」がその置き場所である。
 *
 * **画面に出すときに割る。** 教材そのものは1文字も書き換えない ——
 * **すでにある教材にも、そのまま効く**(作り直し = 課金をしない)。
 *
 * **素の node で、そのまま確かめられる形**。
 * 取り込んでいるのは、同じく何も取り込んでいないものだけにする。
 */

import { splitSentences } from './sentenceSplit.js'

/** 選択肢の目印。**(A)(B)(C)(D) まで**(Part 5 は4つ) */
const MARK = /\(([A-D])\)\s*/g

/**
 * @param {string} text 設問まるごと
 * @returns {{lead: string, choices: string[]}}
 *   `lead` … 選択肢より前の指示文(無ければ空)
 *   `choices` … 「(A) …」の形で1つずつ。**2つ未満なら空**
 *               (割る意味が無いものを、割らない)
 */
export function splitChoices(text) {
  const s = String(text ?? '')
  const found = [...s.matchAll(MARK)]
  if (found.length < 2) return { lead: s.trim(), choices: [] }
  const lead = s.slice(0, found[0].index).trim()
  const choices = found.map((m, i) => {
    const to = i + 1 < found.length ? found[i + 1].index : s.length
    return s.slice(m.index, to).trim()
  })
  return { lead, choices }
}

/* ======================================================================
   ★ **設問は、それだけで 1 行にする**（2026-10-02 実機・第5.343節）

     > 設問は必ず改行、見やすく！選択肢も改行！

   TOEIC Part 6 で、**本文と設問と選択肢が、ひとつの団子**になっていた。

       To All Staff, … during this period. Question: What should fill the
       blank? (A) Therefore (B) However (C) For example (D) In addition

   **文の切れ目を、ここで自前に数えない** —— `splitSentences()` が
   すでに持っている（`Mr.` のような**略語のピリオドを文末と
   取り違えない**）。**数え方を 2 通り持たない**（CLAUDE.md）。
   ====================================================================== */

/**
 * **選択肢の手前にある文を、「本文」と「設問」に分ける。**
 *
 * 設問は**いちばん後ろの 1 文で、`?` で終わるもの**だけ。
 * そうでなければ、**1 文字も分けない**（疑わしいものは触らない）。
 *
 * @returns {{body: string, ask: string}} `body` … 設問を除いた前の部分
 */
export function splitAsk(lead) {
  const s = String(lead ?? '').trim()
  if (!s) return { body: '', ask: '' }
  const spans = splitSentences(s)
  const last = spans[spans.length - 1]
  const ask = s.slice(last.start, last.end).trim()
  if (!/[?？]$/.test(ask)) return { body: s, ask: '' }
  return { body: s.slice(0, last.start).trim(), ask }
}

/* ══════════════════════════════════════════════════════════════════
   ★ **設問の頭が、すぐ上の英文の写しになっていないか**
      (第5.342節・2026-10-01 実機・利用者の指摘)

     > 問題文がふたつずつ同じものが繰り返されてしまってます

   TOEIC Part 5 で、こう出ていた。

       ① The marketing department （　　　） a new advertising strategy …
          The marketing department （　　　） a new advertising strategy …   ← 写し
          (A) has been developing
          (B) develops …

   **出どころは作り方の文**である。「question には**設問と**、4つの選択肢を
   入れ」と書いてあったので、AI は**設問 = 問題文そのもの**と読んで、
   `prompt_en` と同じ英文をもう一度書いた。
   (内容の理解やリスニングでは、設問は `question` にしか無いので正しい。
   **穴埋めだけ、設問が `prompt_en` の側にある。**)

   **作り方は直したが、指示は読み飛ばされうる**(CLAUDE.md)。
   ここで落としておけば、**すでに作った教材もそのまま直る**
   (作り直し = 課金をしない)。
   ══════════════════════════════════════════════════════════════════ */

/** 突き合わせる形。空白と全角の空白をそろえるだけで、中身は変えない */
const flat = (s) => String(s ?? '').replace(/[\s　]+/g, ' ').trim()

/**
 * その**先頭の1行**(`lead`)は、出さなくてよいか。
 *
 * @param {string} lead 選択肢の手前にある文
 * @param {string|string[]} drop 出さなくてよいもの。
 *        **1つでも配列でも受ける** —— 呼ぶ側に条件を書き散らさない
 *        (演習ぜんぶで同じ指示文 / すぐ上に出ている英文)
 */
export const dropsLead = (lead, drop) => {
  const a = flat(lead)
  if (!a) return true
  return (Array.isArray(drop) ? drop : [drop])
    .map(flat).filter(Boolean)
    .some((b) => a === b)
}

/**
 * **その演習ぜんぶで同じ指示文か。**
 *
 * 同じときだけ「取り組み方」へ回す。**1つでも違えば、まとめない** ——
 * まとめると、違う指示の問に別の指示が付く(**黙って消さない**)。
 * 指示文を持たない問が混じっているときも、まとめない。
 *
 * @param {string[]} texts 設問の一覧
 * @returns {string} まとめてよい指示文(無ければ空)
 */
export function commonLead(texts) {
  const list = (texts ?? []).map((t) => splitChoices(t))
    .filter((x) => x.choices.length)
  if (!list.length) return ''
  const first = list[0].lead
  if (!first) return ''
  return list.every((x) => x.lead === first) ? first : ''
}

/* ══════════════════════════════════════════════════════════════════════
   **正解の記号を散らす**(2026-10-01 利用者の指摘・第5.331節)

     > 昨日初めて作成した TOEIC L&R の PART2 問題は正解が全て A に
     > なっていました。これを改善してください

   AI は**正解を先に書く。** だから (A) に寄る —— 実機で 10 問すべてが
   (A) だった。**お願いして直るものではない**(文の並べ方の癖である)。

   **道具の形で強制する**(第5.294節と同じ考え方)。発行する直前に、
   **決まりで**選択肢を並べ替える。

   ── なぜ「発行する直前」なのか ────────────────────────────
     ① **画面・紙・音声・Quick Response が自動でそろう。**
        表示のときに振り直すと、紙と画面で正解の記号が食い違う
     ② **答えの読み上げは `answer` そのものが鍵である**(`answerHasAudio`)。
        表示のたびに記号を変えると**指紋が変わって二度課金**になる。
        保存する前に1度だけ決めれば、鍵は1つのまま
     ③ 窓口(Deno)に置くと、**この算段を書き写す**ことになる
        (CLAUDE.md「数え方を2通り持たない」)

   ── 混ぜ方は `shuffle.js` 1か所 ──────────────────────────
     自前の混ぜ方を書かない(単語帳・Quick Response・シャッフルと同じ)。
   ══════════════════════════════════════════════════════════════════════ */
import { shuffled } from './shuffle.js'

/** 記号(`(A) ` など)を落とした中身。**突き合わせるのはこの形** */
export const choiceBody = (text) =>
  String(text ?? '').replace(/^\s*\(([A-D])\)\s*/, '').trim()

/** その文が記号で始まっているか(元の書き方を崩さないため) */
const hasMark = (text) => /^\s*\([A-D]\)/.test(String(text ?? ''))

/**
 * 何番目を何の記号にするか。**`(A)` から順に振り直す**
 *
 * ★ **出してある**(第5.350節)。選択肢をこちらで組み立てる側
 * (`responseChoices.js`)も同じ記号を使う —— **呼び名を2か所に書かない** */
export const CHOICE_MARKS = ['A', 'B', 'C', 'D']
const MARKS = CHOICE_MARKS

/**
 * **その段の問の、正解の位置を散らす。**
 *
 * **選択肢の数ごとに分けて、均す**(3つの問と4つの問が混ざっても偏らない)。
 * 位置の一覧は `[0,1,2,0,1,2,…]` を混ぜたものなので、
 * **10 問なら 4・3・3 に必ず割れる** —— まぐれで全部 (A) になりようがない。
 *
 * **読み取れない問は、1文字も触らない**(黙って壊さない):
 *   ・選択肢が2つ未満
 *   ・`answer` がどの選択肢とも合わない
 *
 * @param {Array<object>} items `question` と `answer` を持つ問
 * @returns {Array<object>} 写し(**元の配列は触らない**)
 */
export function spreadAnswerMarks(items) {
  const rows = (items ?? []).map((it) => ({ ...it }))
  /** 振り直せる問だけを、選択肢の数ごとに分ける */
  const groups = new Map()
  const parsed = rows.map((it, i) => {
    const { lead, choices } = splitChoices(it.question)
    if (choices.length < 2) return null
    const bodies = choices.map(choiceBody)
    const want = choiceBody(it.answer)
    // **どの選択肢とも合わなければ触らない。** 当てずっぽうで動かさない
    const at = bodies.findIndex((b) => b && b === want)
    if (at < 0) return null
    const g = groups.get(choices.length) ?? []
    g.push(i)
    groups.set(choices.length, g)
    return { i, lead, bodies, at }
  })

  /** 位置の一覧。**均してから混ぜる**(混ぜてから均すと偏る) */
  const target = new Map()
  for (const [count, idxs] of groups) {
    const spread = shuffled(idxs.map((_, k) => k % count))
    idxs.forEach((i, k) => target.set(i, spread[k]))
  }

  for (const p of parsed) {
    if (!p) continue
    const to = target.get(p.i) ?? 0
    /* 正解を `to` へ動かし、残りを順に詰める。
       **選択肢の中身は1つも足さない・落とさない**(並べ替えだけ) */
    const others = p.bodies.filter((_, k) => k !== p.at)
    const body = []
    let o = 0
    for (let k = 0; k < p.bodies.length; k += 1) {
      body.push(k === to ? p.bodies[p.at] : others[o++])
    }
    const lines = body.map((b, k) => `(${MARKS[k]}) ${b}`)
    const row = rows[p.i]
    row.question = [p.lead, ...lines].filter(Boolean).join(' ')
    /* **元の書き方にそろえる。** 記号なしで来た答えに記号を足さない */
    row.answer = hasMark(row.answer)
      ? `(${MARKS[to]}) ${p.bodies[p.at]}`
      : p.bodies[p.at]
  }
  return rows
}

/* ======================================================================
   ★ **設問と選択肢が「本文の欄」に混ざっていたら、取り出す**
      (2026-10-02 実機・利用者の指摘・第5.343節)

     > 設問は必ず改行、見やすく！選択肢も改行！

   TOEIC Part 6 で、**10 問ぜんぶ**がこうなっていた。

     | 欄 | 入っていたもの |
     |---|---|
     | `prompt_en` | 本文 + 設問 + 選択肢(A)(B)(C)(D) ← **ぜんぶ** |
     | `question`  | **空** |

   **作り方は「question に選択肢だけを入れる」と言っている。**
   それでも AI は本文の欄へまとめて書いた。**指示は読み飛ばされうる**
   (CLAUDE.md)。ここで分けておけば、**すでに作った教材もそのまま直る**
   (作り直し = 課金をしない)。

   ── 触らない場合を、先に決めておく ──────────────────────
     ・**選択肢が2つ未満**なら、1文字も触らない(ふつうの本文・記事・会話)
     ・`question` にも書いてあるときは、**まったく同じ選択肢のときだけ**
       本文の側から落とす。**黙って消さない**(CLAUDE.md)

   ── なぜ画面の中で分けないのか ───────────────────────────
     3つの画面(レッスン表示・紙・ゲストの宿題)が同じ問を描く。
     **判断を3か所に書き写すと、必ずどこかだけ古くなる。**
     呼ぶ側は `{ ...it, ...askFields(it) }` と書くだけでよい ——
     **中の `it.prompt_en` / `it.question` は1行も直らない。**
   ====================================================================== */

/**
 * @param {object} item 問(`prompt_en` と `question` を持つ)
 * @returns {{prompt_en: string, question: string}}
 *   **そのまま `{ ...it, ...askFields(it) }` と重ねて使う形**で返す
 */
export const askFields = (item) => {
  const 本文 = String(item?.prompt_en ?? '')
  const 設問 = String(item?.question ?? '')
  const { lead, choices } = splitChoices(本文)
  /* ふつうの本文。**選択肢が入っていないものは、1文字も触らない** */
  if (choices.length < 2) return { prompt_en: 本文, question: 設問 }
  const { body, ask } = splitAsk(lead)
  if (!設問.trim()) {
    return { prompt_en: body, question: [ask, ...choices].filter(Boolean).join('\n') }
  }
  /* 設問の欄にも書いてある。**同じ選択肢のときだけ**本文から落とす */
  const よそ = splitChoices(設問).choices
  const 同じ = よそ.length === choices.length
    && よそ.every((x, i) => flat(choiceBody(x)) === flat(choiceBody(choices[i])))
  return { prompt_en: 同じ ? body : 本文, question: 設問 }
}
