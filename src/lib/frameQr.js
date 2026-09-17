/**
 * **66 の型を、Quick Response の問にする**(2026-09 利用者の指定)。
 *
 * ============================================================================
 *   > マイクで「話す」の機能は入りません。削除です。全ての型で削除してください。
 *   > そして、型のトレーニングの UI は廃止して、
 *   > quick response の UI にそのままコンテンツを移してください
 *
 * 【新しい仕組みを1つも作っていない】
 *
 *   | 何 | どの道を使うか |
 *   |---|---|
 *   | 問 | `phraseSwap.js` / `frameShift.js`(**ファイル・0円**) |
 *   | 覚え具合 | **`qr_reviews`(0040)** —— ふだんの Quick Response と同じ |
 *   | 溜める | `markQr()` → `mark_qr` |
 *   | 出題・絞り込み・聞き流し・紙 | `QrReview.jsx` そのまま |
 *
 *   **`loadNativeFlowQr()` と1文字も違わない形**にしてある。
 *   行の形をそろえてあるので、`QrReview.jsx` から下は書き分けが要らない。
 *
 *   **端末に持っていた控え(`eas.frameShift.done`)は捨てた。**
 *   専用の画面が無くなったので、覚え具合は Quick Response と同じ
 *   `qr_reviews` に乗る —— **数え方を2通り持たない**(CLAUDE.md)。
 *
 * 【コンテンツは2つのまま。混ぜない】
 *
 *   利用者の指定(2026-09)は
 *   「その中に『日本語→英語』と『言い換え』をコンテンツとして追加します」。
 *   **どちらも残す。** ただし**1つずつ開く** ——
 *   混ぜると 1,879 対 66 なので、**言い換えが埋もれて出てこない**
 *   (黙って絞るのと同じことになる)。
 *
 *   「ぜんぶ」は置かない。**もともと2つは別の練習**であり、
 *   通しで回せていたものを取り上げるわけではない。
 *
 * 【言い換えは、型を問のほうに書く】
 *
 *   お題1つに型が2つ以上あるので(37 お題 → 66 問)、
 *   **型を出さないと、同じ日本語が2度出て、どちらの答えか分からない。**
 *   もとの画面が「この型で言い直す」と出していたものを、そのまま問に入れる。
 *
 *   日本語 → 英語のほうは**型が1つに決まっている**ので、足さない
 *   (`QrCard` が答えの下に型を出す・`showFrame`)。
 *
 * 【Supabase を引き連れない】
 *
 *   読み込み(`loadFrameQr()`)だけを `frameQrLoad.js` へ出してある。
 *   ここに置くと `import.meta.env` が付いてきて、
 *   **`npm run test:shift` が素の node で1行も走らせられない**
 *   (CLAUDE.md「素の node で走らせられる形に切り出す」)。
 *   **描けないものは測れない**のと同じ話である。
 * ============================================================================
 */
import { SWAP_FRAMES } from '../data/phraseSwap.js'
import { shiftQuestions, swapQuestions } from './frameShift.js'
import { normEn } from './textNorm.js'

/**
 * **中身は2つ。並べ替えない。**
 *
 * `swap` が先なのは、**やさしい順**だからである(もとの段1 → 段2)。
 * 画面はこの一覧を並べるだけで、名前を書き写さない。
 */
export const FRAME_PARTS = [
  { id: 'swap', label: '日本語 → 英語', lead: '日本語を見て、その型で英語を言います。66 型ぜんぶに問があります。' },
  { id: 'say', label: '言い換え', lead: '伝えたいことを、指定の型で言います。型は問に書いてあります。' },
]

/** いちばんやさしい中身。**「先頭」と書かない** —— 並びを変えたら意味が変わる */
export const FIRST_FRAME_PART = FRAME_PARTS[0].id

/** id から1行を引く。知らない id は `null`(**当てずっぽうで返さない**) */
export const framePartOf = (id) => FRAME_PARTS.find((p) => p.id === id) ?? null

/** 紙と絞り込みに出す名前。**`material_title` に入る。ここ1か所で作る** */
export const framePartTitle = (id) => {
  const p = framePartOf(id)
  return p ? `66 の型(${p.label})` : '66 の型'
}

/**
 * その中身の問を、**`{ en, ja }` の形**にほどく。
 *
 * **確かめてから出すのは `swapQuestions()` の仕事**(骨に入れてみて
 * 狙いの型に見えない組み合わせは、はじめから出さない)。ここでは並べるだけ。
 *
 * @param part `'swap'` / `'say'`。知らない id は**空**(当てずっぽうで出さない)
 */
export function frameQuestions(part = FIRST_FRAME_PART) {
  if (part === 'say') {
    /* **型を問に書く。** お題1つに型が2つ以上あるので、
       書かないと同じ日本語が2度出て、どちらの答えか分からない */
    return shiftQuestions().map((q) => ({ ja: `${q.ja}(「${q.form}」の型で)`, en: q.ex }))
  }
  if (part !== 'swap') return []
  const out = []
  /* **骨の並びは `phraseSwap.js` のまま。** ここで並べ替えない */
  for (const f of SWAP_FRAMES) {
    for (const q of swapQuestions({ frame: f.id })) out.push({ ja: q.ja, en: q.ex })
  }
  return out
}

/**
 * 問 × 覚え具合 → `qr_items()` とそろえた行。
 *
 * **`nativeFlowRows()` と同じ形を返す。** ここがずれると、
 * `QrReview.jsx` が書き分けを持つことになる(**数え方を2通り持たない**)。
 *
 * **同じ英文は二度出さない。** いまは1つも重なっていないが、
 * 部品を足した日に重なりうる —— 重なると**同じ札が2枚出て、数も二重**になる。
 */
export function frameQrRows(seen = [], { today = '', part = FIRST_FRAME_PART } = {}) {
  const map = new Map(
    (seen ?? []).map((r) => [String(r?.en_norm ?? ''), r]).filter(([k]) => k),
  )
  const title = framePartTitle(part)
  const out = []
  const used = new Set()
  for (const q of frameQuestions(part)) {
    const key = normEn(q.en)
    if (!key || used.has(key)) continue
    used.add(key)
    const s = map.get(key) ?? null
    out.push({
      en_norm: key,
      en: q.en,
      ja: q.ja,
      /* **話す人はいない。** 会話から溜めた問と違い、ここは1問ずつの表現である */
      speaker: null,
      status: s?.status ?? 'unknown',
      box: s?.box ?? 0,
      learn_streak: s?.learn_streak ?? 0,
      due_on: s?.due_on ?? today,
      added_at: s?.added_at ?? null,
      updated_at: s?.updated_at ?? null,
      /* **教材にしていない**ので、id は持たない(`materials` に行が無い) */
      material_id: null,
      material_title: title,
      material_industry: null,
      material_kind: null,
      material_genre: null,
      material_scene: null,
      material_level: null,
    })
  }
  return out
}

/** 中身ごとの問数。**画面で数え直さない**(札の数と出る問が食い違う) */
export const frameQrCounts = () => Object.fromEntries(
  FRAME_PARTS.map((p) => [p.id, frameQuestions(p.id).length]),
)

/** どの中身を開いていたかを覚える鍵。**2か所に書かない**(CLAUDE.md) */
export const FRAME_PART_KEY = 'eas.frameQr.part'
