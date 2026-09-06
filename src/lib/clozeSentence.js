/**
 * **出会った文の中の、その語を伏せる**(穴埋め・2026-09 利用者の指定)。
 *
 *   > ２つ目のトレーニングに穴埋めがあったり、３つ目が日→英になっていたり、
 *   > そういう仕組みで単語が覚えられるような仕組みにしたいです。
 *
 * ============================================================================
 * 【材料を新しく作らない】
 *
 *   穴埋めの文は **`word_reviews.seen_in`(0018)をそのまま使う。**
 *   あれは「その語に初めて出会った文」で、単語帳に入った時点で残っている。
 *   **AI を1回も呼ばない**ので、**費用は1円もかからない。**
 *
 *   人は文脈ごと覚える(0018 の考え方)。だから
 *   **その語に出会ったその文**で伏せるのがいちばん効く。
 *   例文を作らせると、覚えた文脈とは別の文になってしまう。
 *
 * 【なぜ何にも依存しない形で置くのか】
 *
 *   `src/lib/vocab.js` は Supabase(`import.meta.env`)を引き連れているので、
 *   **素の node で一度も読み込めない。** ここは
 *   「どこを伏せるか」を決めるだけの算段なので、切り出しておけば
 *   `npm run test:play` が数字で確かめられる
 *   (`playMark.js` / `gamify.js` / `materialKinds.js` と同じ考え方)。
 *
 * 【語の切れ目で当てる。`indexOf` で探さない】
 *
 *   単純な `indexOf` だと、`in` が **`internal` の中**に当たる。
 *   すると「内部の」を伏せたつもりが `___ternal` になり、
 *   問題として成り立たない。**前後が英字でないところ**だけを見る。
 *
 * 【見つからなければ、何も返さない】
 *
 *   手で入れた語(`WordbookAdd`)には出会った文が無いし、
 *   文のほうを直した教材では語が消えていることもある。
 *   **当てずっぽうで伏せない** —— 呼ぶ側(`pickForm`)が
 *   「思い出す」形へ落とす(`sentencePair.js` と同じ考え方)。
 */

/** 正規表現の中で意味を持つ文字を、ただの文字に戻す */
const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * 文の中から、その語(句)のあった場所を探す。
 *
 * @param {string} sentence 出会った文(`seen_in`)
 * @param {string} word     伏せたい語。句(`look forward to`)でもよい
 * @returns {{before: string, hit: string, after: string}|null}
 *          見つからなければ **null**(呼ぶ側が別の形へ落とす)
 */
export function clozeAt(sentence, word) {
  const text = String(sentence ?? '')
  const needle = String(word ?? '').trim()
  if (!text || !needle) return null

  /* 句のあいだの空白は、文のほうで**改行や2つの空白**になっていることが
     ある(教材の英文をそのまま控えているため)。`\s+` で受ける。
     前後は「英字・アポストロフィ・ハイフンでないこと」で見る ——
     `well-known` の途中で切れないようにするためである */
  const re = new RegExp(
    `(^|[^A-Za-z'’-])(${esc(needle).replace(/\s+/g, '\\s+')})(?![A-Za-z'’-])`,
    'i',
  )
  const m = re.exec(text)
  if (!m) return null

  const at = m.index + m[1].length
  return {
    before: text.slice(0, at),
    hit: text.slice(at, at + m[2].length),
    after: text.slice(at + m[2].length),
  }
}

/**
 * その語で穴埋めを作れるか。
 * **`pickForm()` がここだけを見る。** 画面で数え直さない。
 */
export const hasCloze = (row) =>
  !!clozeAt(row?.seen_in, row?.display || row?.word_norm)
