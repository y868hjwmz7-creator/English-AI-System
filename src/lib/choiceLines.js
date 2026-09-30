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
 * **何にも依存しない形**(素の node でそのまま確かめられる)。
 */

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
