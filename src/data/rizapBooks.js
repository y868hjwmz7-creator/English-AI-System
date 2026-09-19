/**
 * ============================================================================
 * **RIZAP ENGLISH の教材(5冊)**(第5.202節)
 *
 * 2026-09 利用者の指定。
 *
 *   > 教材のアサインのページから Conversation1、2、3、
 *   > Business Conversation 1、2 をアサインできるようにしてください。
 *   > UNIT ごと、丸ごと、それぞれお願いします。UNIT 毎の場合はプルダウンで
 *
 * ── **UNIT の数を、ここに書かない** ──────────────────────────
 *
 *   書くと、UNIT を入れた日に**ここだけ古い数が残る。**
 *   実際に何 UNIT 入っているかは **Supabase を読んで数える**
 *   (`rizapAssign.js`)。まだ1 UNIT も入っていない冊は、
 *   **「まだ入っていません」と出す** —— 押せるのに何も起きない、を作らない。
 *
 * ── 本文はここに1文字も無い ──────────────────────────────
 *
 *   このリポジトリは**いま公開**である(CLAUDE.md)。
 *   利用者の会社の教材そのもの(英文・訳・設問)は**すべて Supabase**に
 *   あり、ここにあるのは**冊の名前と id だけ**である。
 *
 * ── 配役は `rizapCast.js` ────────────────────────────────
 *
 *   **5冊すべてで共通**(利用者の指定「絶対に変えないで」)。
 *   冊ごとに声を変えない。
 * ============================================================================
 */

/**
 * **冊の一覧。並べ替えない。減らさない。**
 *
 * `id` は `materials.series` に入る値である。**変えない** ——
 * すでに入っている教材の行が、どの冊にも属さなくなる。
 */
export const RIZAP_BOOKS = [
  { id: 'rizap-c1', label: 'Conversation 1' },
  { id: 'rizap-c2', label: 'Conversation 2' },
  { id: 'rizap-c3', label: 'Conversation 3' },
  { id: 'rizap-b1', label: 'Business Conversation 1' },
  { id: 'rizap-b2', label: 'Business Conversation 2' },
]

/** この束の名前。**画面にも検証にも書き写さない** */
export const RIZAP_LABEL = 'RIZAP ENGLISH の教材'

/** id から1冊を引く。知らない id は `null`(**当てずっぽうで返さない**) */
export const rizapBookOf = (id) => RIZAP_BOOKS.find((b) => b.id === id) ?? null

/** 「丸ごと(ぜんぶの UNIT)」を指す値。**UNIT 番号と同じ欄に入れる** */
export const RIZAP_ALL = ''

/** 「Conversation 1 を丸ごと」。**冊の名前から作る。書き写さない** */
export const rizapAllLabel = (bookId) =>
  `${rizapBookOf(bookId)?.label ?? ''} を丸ごと`

/**
 * いま出そうとしているものの名前。**知らせの文にも、これを使う。**
 *
 * - 丸ごと … `Conversation 1 を丸ごと(18 UNIT)`
 * - 1つ   … `Conversation 1 — UNIT 3`
 */
export function rizapPickLabel(bookId, unitNo, howMany = 0) {
  const b = rizapBookOf(bookId)
  if (!b) return ''
  if (!unitNo) return `${rizapAllLabel(bookId)}(${howMany} UNIT)`
  return `${b.label} — UNIT ${unitNo}`
}
