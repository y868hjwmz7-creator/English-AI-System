/**
 * ============================================================================
 * **ビジネス必須チャンク集** —— 冊 → 段 → 組 の3段(第5.199節)
 *
 * 2026-09 利用者の指定。
 *
 *   > 私のやりたいことは、quick responseの中の14の型、その中のさせる系、
 *   > その中のS enables 人 to do、のようにビジネス必須チャンク集(冊名)、
 *   > その中の名詞句、その中の-ing、5WH +SV、などなど。
 *   > 副詞句の中の前置詞句、などなどという置き方です。
 *
 *   > 今の3冊をこの中へまとめる
 *   > 名詞句まとめ、というのも独立して残しておいてください。
 *   > この仕様は全てに共通とします。
 *
 * ── どこが変わったのか ────────────────────────────────────────
 *
 *   **冊が3つ横に並んでいた**(コロケーション / 名詞句 / 副詞句)。
 *   それを**1つの冊の中の3つの段**にする。
 *
 *     これまで … 自分の単語帳 / 業種べつ / 基礎単語 / コロケーション / 名詞句 / 副詞句
 *     これから … 自分の単語帳 / 業種べつ / 基礎単語 / **ビジネス必須チャンク集**
 *                                                   ├ 名詞句 … まとめ / OF / TO DO / …
 *                                                   ├ 副詞句 … まとめ / いつ / … / 前置詞句
 *                                                   └ コロケーション … まとめ / MAKE / …
 *
 *   **`14 の型` とまったく同じ形**である(冊 → 中身 → 型)。
 *   **同じことをするものを、別の見た目で2つ作らない**(CLAUDE.md)。
 *
 * ── 「まとめ」は、どの段にも必ず置く ──────────────────────────
 *
 *   利用者の指定「**この仕様は全てに共通とします**」。
 *   組を1つずつしか選べないと、**その段をまるごと練習する道が無い。**
 *   型の冊の「〜系ぜんぶ」と同じ考え方である。
 *
 *   **「まとめ」は空文字**(`CHUNK_ALL`)。組の id と同じ欄に入れるので、
 *   **組の id に空文字を使わない**ことだけ守ればよい(下で見張る)。
 *
 * ── 覚え具合は、1語も動かない ────────────────────────────────
 *
 *   **鍵は語句そのもの**(`word_norm`)で、冊の名前はどこにも入っていない。
 *   だから**並べ替えても、まとめても、覚えた記録はそのまま**である。
 *   表も列も SQL も1行も増えない。
 *
 * ── Supabase を引き連れない ──────────────────────────────────
 *
 *   読み込みは `nounPhraseWords.js` などがする。ここは**一覧と数え上げだけ**で、
 *   `import.meta.env` が付いてこないので**素の node で走らせられる**
 *   (CLAUDE.md「素の node で走らせられる形に切り出す」)。
 * ============================================================================
 */
import {
  NOUN_PHRASES, NOUN_PHRASE_GROUPS, nounPhraseTitle,
} from '../data/nounPhrases.js'
import {
  ADVERB_PHRASES, ADVERB_PHRASE_GROUPS, adverbPhraseTitle,
} from '../data/adverbPhrases.js'
import {
  COLLOCATIONS, COLLOCATION_VERBS, collocationTitle,
} from '../data/collocations.js'

/** 冊の名前。**画面にも骨組みにも検証にも書き写さない** */
export const CHUNK_BOOK_LABEL = 'ビジネス必須チャンク集'

/**
 * **段(冊の中の3つ)。並べ替えない。減らさない。**
 *
 * `id` は、これまで冊の id だったものをそのまま使う(`np` / `adv` / `col`)。
 * **変えない** —— 画面の中の書き分けも、検証も、この id で書いてある。
 */
export const CHUNK_PARTS = [
  { id: 'np', label: '名詞句', lead: '文の席に入るひとかたまり。主語にも目的語にもなります。' },
  { id: 'adv', label: '副詞句', lead: '文にそえるひとかたまり。いつ・どのくらい・どんな立場で、を足します。' },
  { id: 'col', label: 'コロケーション', lead: '動詞と目的語の決まった組み合わせ。' },
]

/** いちばん先の段。**「先頭」と書かない** —— 並びを変えたら意味が変わる */
export const FIRST_CHUNK_PART = CHUNK_PARTS[0].id

/** id から1行を引く。知らない id は `null`(**当てずっぽうで返さない**) */
export const chunkPartOf = (id) => CHUNK_PARTS.find((p) => p.id === id) ?? null

/** **「まとめ」を指す値。** 組の id と同じ欄に入れるので、空文字にしてある */
export const CHUNK_ALL = ''

/** 「名詞句まとめ」。**段の名前から作る。書き写さない** */
export const chunkAllLabel = (part) => `${chunkPartOf(part)?.label ?? ''}まとめ`

/**
 * その段の、**中身と組の一覧**。ここだけが3つの出どころを知っている。
 *
 * **画面で `part === 'np'` と書かない**(置く場所の数だけ食い違う)。
 */
const SOURCE = {
  np: { rows: NOUN_PHRASES, groups: NOUN_PHRASE_GROUPS, title: nounPhraseTitle },
  adv: { rows: ADVERB_PHRASES, groups: ADVERB_PHRASE_GROUPS, title: adverbPhraseTitle },
  col: { rows: COLLOCATIONS, groups: COLLOCATION_VERBS, title: collocationTitle },
}

/** その段にいくつ入っているか(**0円**。ファイルを数えるだけ) */
export const chunkPartCount = (part) => (SOURCE[part]?.rows ?? []).length

/**
 * **組の一覧**(3段目)。先頭は必ず「◯◯まとめ」。
 *
 * **数もここで数える。** 画面で数え直すと、
 * **札には 21 語と出て、出てくるのは 20 語**になる(CLAUDE.md)。
 * **1件も無い組は出さない**(開いた先が空になる・行き止まりを作らない)。
 *
 * @returns {Array<{id, label, name, n}>}
 */
export function chunkGroups(part) {
  const src = SOURCE[part]
  if (!src) return []
  const out = [{
    id: CHUNK_ALL, label: chunkAllLabel(part), name: '', n: src.rows.length,
  }]
  for (const g of src.groups) {
    const n = src.rows.filter((x) => (x.g ?? x.v) === g.id).length
    if (n > 0) out.push({ id: g.id, label: g.label, name: g.name, n })
  }
  return out
}

/**
 * いま出しているものの名前。**題にも紙にも、これを使う。**
 *
 * - 組をえらんでいない … `ビジネス必須チャンク集 / 名詞句まとめ`
 * - 組をえらんだ       … `ビジネス必須チャンク集 / 名詞句 OF(A の B)`
 *
 * **組の名前は、それぞれの `◯◯Title()` から引く。書き写さない。**
 */
export function chunkTitle(part, group = CHUNK_ALL) {
  const p = chunkPartOf(part)
  if (!p) return CHUNK_BOOK_LABEL
  /* **知らない組に「まとめ」の名前を付けない。**
     絞るほうは 0 件を返す(下の `chunkGroupPick`)ので、
     ここだけ「まとめ」と書くと**題と中身が食い違う** ——
     数え方を2通り持たないのと、同じ話である */
  if (!group) return `${CHUNK_BOOK_LABEL} / ${chunkAllLabel(part)}`
  if (!chunkGroupOk(part, group)) return `${CHUNK_BOOK_LABEL} / ${p.label}`
  return `${CHUNK_BOOK_LABEL} / ${SOURCE[part].title(group)}`
}

/**
 * **その組だけに絞る。判断はここ1か所**(CLAUDE.md)。
 *
 * - 「まとめ」(空)… **そのまま返す**(絞らない)
 * - 組の id … その組だけ
 * - **知らない組 … 空**(0件)。**黙って「ぜんぶ」に落とさない** ——
 *   選んでいないものが出るほうが分かりにくい(型の冊とまったく同じ作法)
 *
 * **行に欄を足していない。** 行はもともと `material_title` に組の名前を
 * 持っており、その名前を作るのは**ここが呼ぶのと同じ関数**である
 * (`nounPhraseTitle()` など)。だから**ずれようがない** ——
 * 新しい欄を足すと `review_words()` と形が変わり、
 * `QrReview` / `Wordbook` が書き分けを持つことになる(数え方が2通り)。
 *
 * @param rows  その段の行(`nounPhraseRows()` などが作ったもの)
 * @param part  いまの段
 * @param group いまの組(空なら「まとめ」)
 */
export function chunkPool(rows, part, group) {
  const list = rows ?? []
  if (!group) return list
  const src = SOURCE[part]
  if (!src || !chunkGroupOk(part, group)) return []
  const want = src.title(group)
  return list.filter((r) => r.material_title === want)
}

/**
 * えらんだ組が、いまの段で出せるものか。
 * **出せない組が残っていたら「まとめ」に落とす**(行き止まりを作らない)。
 */
export const chunkGroupOk = (part, group) =>
  !group || chunkGroups(part).some((x) => x.id === group)
