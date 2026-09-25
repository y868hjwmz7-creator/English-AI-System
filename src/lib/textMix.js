/**
 * ============================================================================
 * **テキストで出た表現を、新しい教材に混ぜる**(第5.259節)
 *
 * 2026-09-25 利用者の指定。
 *
 *   > 記事、モノローグ、ダイアローグ、会議、文系トレーニングに
 *   > NATIVE FLOW や RIZAP English のテキストで出た表現を
 *   > 混ぜれるようにしたい。
 *   > ユニットに分かれている教材は盛り込みたいフレーズがある
 *   > ユニットを選べたら最高です。
 *
 * ── **新しい渡し道を作らない** ────────────────────────────
 *
 *   窓口にはすでに **`reviewWords`(必ず使う語)** がある。
 *   あれは「ゲストが知らなかった語を、次の教材に入れさせる」ための欄で、
 *   **記事でも会話でも文型ドリルでも効く**(種類ごとに言い方を変えている)。
 *
 *   **テキストの表現も、まったく同じものである** ——
 *   「この表現を、本文か問題文の中で使え」。だから**同じ欄に載せる。**
 *   別の欄を作ると、窓口の指示文が2つに割れ、**片方だけ古くなる。**
 *
 * ── **AI を1回も余分に呼ばない = 0円** ───────────────────────
 *
 *   表現は**すでに手元にある**(Native Flow はファイルの中、
 *   RIZAP は Supabase の教材)。**引いて渡すだけ**である。
 *   教材を作るときの1回のほかに、料金は1円もかからない。
 *
 * ── ここは算段だけ。Supabase を持たない ────────────────────
 *
 *   **素の node で走らせられる形にしてある**(`playMark.js` と同じ作法)。
 *   引いてくるのは `textBooks.js`(あちらが Supabase を持つ)。
 * ============================================================================
 */

/**
 * **この5つの種類で混ぜられる**(利用者が名指しした5つ)。
 *
 *   記事 / モノローグ / ダイアローグ / 会議 / 文型トレーニング
 *
 * **単語 / フレーズには出さない。** あちらは「この語で作る」教材なので、
 * 表現を混ぜるのではなく**表現そのものがお題**である ——
 * 混ぜると、何を練習しているのか分からなくなる。
 * **判断はここ1か所**(画面で `kind === 'reading'` と書かない)。
 */
export const MIX_KINDS = ['reading', 'speech', 'dialogue', 'meeting', 'pattern']

/** その種類で、テキストの表現を混ぜられるか */
export const canMixText = (kind) => MIX_KINDS.includes(kind)

/**
 * **一度に混ぜられる数。**
 *
 * 窓口は `reviewWords` を **20 個で切る**(指示が長くなると、
 * 本来の指定が薄まるため)。ここはそれより低く取る ——
 * **「必ず使う語」は、テキストの表現だけのものではない。**
 * 単語帳から名指しで渡された語と**同じ一覧に載る**ので、
 * ここで 20 まで積むと、そちらが押し出される。
 */
/**
 * **窓口が `reviewWords` を切る数。**
 *
 * あちらは Deno の中にいるので、**この値を分け合えない**
 * (`V3_STABILITY` と同じ形)。だから `npm run test:speak` が
 * **窓口のソースと突き合わせる** —— 片方を変えたら赤くなる。
 *
 * ここで持っておくのは、**黙って落とさない**ためである。
 * 20 を超えたぶんは窓口が捨てるが、**捨てられたことを画面に出さないと、
 * 押した人には「入れたのに使われない」としか見えない。**
 */
export const REVIEW_MAX = 20

/**
 * 20 を超えたら、そのことをそのまま言う。**超えていなければ空。**
 *
 * **`**` を混ぜない**(画面にそのまま出る文字列・CLAUDE.md)。
 * 太字にしたいところは、画面の側が `<strong>` で囲む。
 */
export const overNote = (total) => (total > REVIEW_MAX
  ? `いま ${total} 個あります。届くのは先頭の ${REVIEW_MAX} 個までです`
  : '')

export const MIX_MAX = 12
export const MIX_COUNTS = [3, 5, 8, 12]
export const DEFAULT_MIX = 5

/** 「ぜんぶの UNIT」を指す値。**UNIT 番号と同じ欄に入れる** */
export const MIX_ALL_UNITS = ''

/**
 * そろえた形。**大文字小文字と前後の空白だけを落とす。**
 * 語そのものは変えない(`Totally.` の `.` は表現の一部である)。
 */
export const mixKey = (s) => String(s ?? '').trim().toLowerCase()

/**
 * **混ぜる表現を選ぶ。**
 *
 * @param rows   引いてきた表現 `[{ en, ja }]`(**順は原本のまま**)
 * @param count  何個ほしいか
 * @param taken  すでに一覧に入っているもの(**二度入れない**)
 * @param pick   どこから取るか。`'head'` = 先頭から / `'random'` = 散らす
 * @returns `[{ en, ja }]` —— **足りなければ、あるだけ返す**(黙って埋めない)
 *
 * **0 と「無い」を取り違えない**(CLAUDE.md)。
 * 引けなかったのか、その UNIT が空なのかは、呼ぶ側が知っている。
 */
export function pickMix(rows, { count = DEFAULT_MIX, taken = [], pick = 'random' } = {}) {
  const want = Math.min(Math.max(Number(count) || 0, 0), MIX_MAX)
  if (!want) return []
  const had = new Set((taken ?? []).map(mixKey))
  const live = (rows ?? [])
    .filter((r) => String(r?.en ?? '').trim())
    .filter((r) => !had.has(mixKey(r.en)))
  if (pick !== 'random') return live.slice(0, want)
  /* **散らす。** 先頭から取ると、何度押しても同じ表現ばかりになる
     (Unit 1 の `Totally.` が毎回入る)。
     **元の一覧は動かさない** —— 写してから混ぜる */
  const bag = [...live]
  for (let i = bag.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[bag[i], bag[j]] = [bag[j], bag[i]]
  }
  return bag.slice(0, want)
}

/**
 * 窓口へ渡す形(`reviewWords` は**文字の一覧**である)。
 *
 * **訳は渡さない。** 窓口に要るのは「この英語を使え」だけで、
 * 訳まで送ると指示が倍の長さになり、**本来の指定が薄まる**
 * (`reviewWords` を 20 で切っているのと同じ理由)。
 */
export const mixWords = (rows) =>
  (rows ?? []).map((r) => String(r?.en ?? '').trim()).filter(Boolean)

/**
 * いま何を混ぜたのかを、そのまま言う。
 * **「追加しました」で終わらせない**(起きたことをそのまま言う・CLAUDE.md)。
 *
 * @param bookLabel 冊の名前(`Native Flow`)
 * @param unitLabel UNIT の名前。丸ごとなら空
 * @param got       実際に足せた数
 * @param want      足したかった数
 */
export function mixNote(bookLabel, unitLabel, got, want) {
  const where = `${bookLabel}${unitLabel ? ` ${unitLabel}` : ''}`
  if (!got) return `${where} から足せる表現がありませんでした(もう全部入っています)`
  if (got < want) return `${where} から ${got} 個を足しました(${want} 個ぶんは残っていません)`
  return `${where} から ${got} 個を足しました`
}
