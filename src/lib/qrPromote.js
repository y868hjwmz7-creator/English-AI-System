/**
 * **育った語の「出会った文」を、Quick Response 帳へ送る**(2026-09 利用者の指定)。
 *
 * ============================================================================
 * 【何のためか】
 *
 *   単語帳と Quick Response は、いま**つながっていない。**
 *   語を覚えても、その語を使った**文をまるごと言う**練習には回らない。
 *
 *       ① 語を知る          4択・思い出す
 *       ② 語を文の中で使う   穴埋め(出会った文の、その語を伏せる)
 *       ③ 語を言える         日本語 → 英語
 *       ④ 文をまるごと言える  Quick Response      ← ここが切れていた
 *
 *   **材料はもうそろっている。** 単語帳の行は `seen_in` / `seen_in_ja`
 *   (出会った文とその訳・0018)を持っていて、棚の語も
 *   `example_en` / `example_ja` が同じ欄に入っている(`shelfReviews.js`)。
 *   `mark_qr`(0040)が受け取るのは「英文 + 訳」なので、**形がそのまま合う。**
 *
 *   **表も列も SQL も増えない。AI も1回も呼ばない = 0円。**
 *
 * 【いつ送るか ——「箱4」ではない】
 *
 *   はじめ「箱4に上がったら」と書いたが、**これは誤りだった。**
 *   `review_next()`(0058)は「覚えかけ」の箱を **3 で止める**ので、
 *   箱4以上へ行けるのは「覚えた」を押した語だけである。
 *   ほとんどの語は箱3で足踏みし、**一生届かない。**
 *
 *   正しい目印は **`learn_streak`(続けて思い出せた回数)**のほうである。
 *   `KNOWN_AFTER` は、もともと**一覧に「覚えた」を出してよいか**を
 *   決めている数でもある(`canMarkKnown`)。
 *   **同じ判断**である ——「この語はもう身に付いたと言ってよいか」。
 *   だから**数を2か所に書かない。** ここが持ち、`vocab.js` が読み直す。
 *
 * 【自動で送る】(2026-09 利用者の指定)
 *
 *   > 自動でOK
 *
 *   トレーナーがボタンで送る道も作れたが、**押す人がいない日は
 *   永久に届かない。** ゲストの練習が、人の手待ちになる。
 *
 * 【何にも依存しない】
 *   Supabase も `import.meta.env` も引き連れていない
 *   (`playMark.js` / `frameMatch.js` と同じ)。
 *   `npm run test:play` が、これを直に読んで数える。
 *   **窓口を呼ぶところは `qrReviews.js` の `promoteGrownWords()`。**
 * ============================================================================
 */
import { normEn } from './textNorm.js'

/**
 * **その語が「身に付いた」と言える、続けて思い出せた回数。**
 *
 * 答えている問は2つあるが、**判断は1つ**である ——
 * ①一覧に「覚えた」のボタンを出してよいか(`canMarkKnown`・`vocab.js`)
 * ②その語の文を Quick Response へ送ってよいか(ここ)
 *
 * **早すぎると破綻する。** 棚を開いた瞬間に 200 文が入ると、
 * Quick Response 帳が一巡できなくなる。
 * **遅すぎても届かない。** 卒業(25回)を待つと3か月かかる。
 */
export const KNOWN_AFTER = 10

/**
 * 1回の読み込みで送る上限。**溜まり方に、止まる条件を持たせる**(CLAUDE.md)。
 *
 * 10 に届く語は1日に数語なので、ふだんはこの上限に当たらない。
 * **当たるのは、棚をまるごと入れ直したときのような、数の多い日だけ**である。
 */
export const PROMOTE_MAX = 10

/** 送った文を覚えておく場所(端末ごと)。**退けた文を掘り返さないため** */
export const PROMOTE_KEY = 'qrPromoted'

/**
 * **文として短すぎないか。**
 *
 * `seen_in` には、語そのものや2語の言い回しが入っていることがある。
 * Quick Response は**文をまるごと言う**練習なので、それでは成り立たない。
 */
const LONG_ENOUGH = 3

/**
 * その行から、Quick Response へ送る文を取り出す。**送れなければ `null`。**
 *
 * **既定は「送らない」側**(CLAUDE.md)。次のどれかに当たれば送らない。
 *
 * - まだ育っていない(`learn_streak` が `KNOWN_AFTER` に届いていない)
 * - 出会った文が無い / その訳が無い(手で入れた語・基礎単語がこれにあたる)。
 *   **ここで AI に例文を作らせない = 0円**
 * - 文が3語に満たない
 * - 出会った文が、その語そのもの(伏せる場所が無く、問にならない)
 */
export function promotableOf(row) {
  if (Number(row?.learn_streak ?? 0) < KNOWN_AFTER) return null
  const en = String(row?.seen_in ?? '').trim()
  const ja = String(row?.seen_in_ja ?? '').trim()
  if (!en || !ja) return null
  const norm = normEn(en)
  if (!norm || norm.split(' ').length < LONG_ENOUGH) return null
  if (norm === normEn(row?.word_norm ?? '')) return null
  return {
    en,
    ja,
    norm,
    word: row?.word_norm ?? '',
    materialId: row?.material_id ?? null,
  }
}

/**
 * 送る文を選ぶ。**判断はここ1か所。** 画面で数え直さない。
 *
 * 【すでに溜まっている文を、ここで外さない】
 *   外すのは**データベースの仕事**である(`learner_id, en_norm` の
 *   一意の決まり + `ignoreDuplicates`)。画面で数え直すと、
 *   読んでから書くまでのあいだに増えたぶんを取りこぼす。
 *   **数え方を2通り持たない**(CLAUDE.md)。
 *
 * @param {Array} rows 単語帳の行(読み込んだままのもの)
 * @param {object} opts
 *   - `already` … **前に送ったことのある**文。ゲストが「もう出さない」で
 *     退けた文は表から消えるので、データベースでは止められない。
 *     **こちらが黙って掘り返さない**ために、端末に控えておく
 *   - `max`     … 1回の上限
 */
export function pickPromotions(rows, { already = [], max = PROMOTE_MAX } = {}) {
  const skip = new Set([...already].filter(Boolean))
  const out = []
  const seen = new Set()
  for (const r of rows ?? []) {
    const p = promotableOf(r)
    if (!p) continue
    // **同じ文が2語ぶん来ることがある。** 鍵は英文なので1つにまとめる
    if (skip.has(p.norm) || seen.has(p.norm)) continue
    seen.add(p.norm)
    out.push(p)
    if (out.length >= max) break
  }
  return out
}
