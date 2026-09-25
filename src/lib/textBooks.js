/**
 * ============================================================================
 * **テキストの表現を引いてくる**(第5.259節)
 *
 * 2026-09-25 利用者の指定。
 *
 *   > NATIVE FLOW や RIZAP English のテキストで出た表現を混ぜれるようにしたい。
 *   > ユニットに分かれている教材は盛り込みたいフレーズがある
 *   > ユニットを選べたら最高です。
 *
 * ── **置き場所が2つある。呼ぶ側には1つに見せる** ──────────────
 *
 *   | 冊 | どこにあるか |
 *   |---|---|
 *   | Native Flow | **ファイルの中**(`src/data/nativeFlow.js`・690 件) |
 *   | RIZAP の5冊 | **Supabase**(`materials.series` = `rizap-*`) |
 *
 *   利用者の会社の教材そのもの(英文・訳)は**リポジトリに置かない** ——
 *   このリポジトリはいま公開だからである(CLAUDE.md)。
 *   だから RIZAP は読みに行くしかない。**呼ぶ側にその区別を書かせない。**
 *
 * ── **UNIT の数を、ここに書かない** ────────────────────────
 *
 *   書くと、UNIT を入れた日に**ここだけ古い数が残る。**
 *   RIZAP は `rizapAssign.js` と**同じ関数**で数える
 *   (数え方を2通り持たない・CLAUDE.md)。
 *
 * ── **0 と「読めなかった」を取り違えない** ──────────────────
 *
 *   読めなかったら `data: null` を返す。**空の配列にしない。**
 *   「その UNIT に表現が無い」と「Supabase に届かなかった」は別である。
 *
 * ── 算段は `textMix.js`(**素の node で確かめられる**)──────────
 * ============================================================================
 */
import { supabase } from './supabase.js'
import { loadRizapUnits } from './rizapAssign.js'
import { RIZAP_BOOKS } from '../data/rizapBooks.js'
import {
  NATIVE_FLOW, NATIVE_FLOW_UNITS, NF_BOOK_LABEL, unitName,
} from '../data/nativeFlow.js'
import { MIX_ALL_UNITS } from './textMix.js'

const ok = (data) => ({ data, error: null })
const ng = (message) => ({ data: null, error: message })

/** Native Flow の id。**画面にも検証にも書き写さない** */
export const NF_BOOK_ID = 'native-flow'

/**
 * **えらべる冊。並べ替えない。減らさない**(共通ルール)。
 *
 * 先頭が Native Flow なのは、**ファイルの中にあって必ず引ける**からである
 * (RIZAP はまだ1 UNIT も入っていないことがある)。
 */
export const TEXT_BOOKS = [
  { id: NF_BOOK_ID, label: NF_BOOK_LABEL, local: true },
  ...RIZAP_BOOKS.map((b) => ({ id: b.id, label: b.label, local: false })),
]

/** id から1冊。知らない id は `null`(**当てずっぽうで返さない**) */
export const textBookOf = (id) => TEXT_BOOKS.find((b) => b.id === id) ?? null

/** 画面に出す名前 */
export const textBookLabel = (id) => textBookOf(id)?.label ?? ''

/**
 * **その冊の UNIT。**
 *
 * @returns `{ data: [{ key, label }] | null, error }`
 *   `key` は `loadTextPhrases()` にそのまま渡す値である
 *   (Native Flow は番号、RIZAP は**教材の id**)。
 *   **呼ぶ側は中身を見ない** —— 見ると、置き場所の違いが画面に漏れる。
 */
export async function loadTextUnits(bookId) {
  const book = textBookOf(bookId)
  if (!book) return ng('その冊はありません')
  if (book.local) {
    return ok(NATIVE_FLOW_UNITS.map((u) => ({
      key: String(u.id), label: unitName(u), n: u.n,
    })))
  }
  const { data, error } = await loadRizapUnits(bookId)
  if (error) return ng(error.message ?? '冊の UNIT を読めませんでした')
  return ok((data ?? []).map((m) => ({
    key: String(m.id),
    /* **番号と見出しの両方を出す。** 番号だけだと、どれを選んだのか
       押した人が確かめられない(`rizapPickLabel` と同じ考え方) */
    label: `UNIT ${m.unit_no}${m.headline ? ` — ${m.headline}` : ''}`,
  })))
}

/**
 * **その UNIT の表現**(`[{ en, ja }]`)。
 *
 * @param unitKey `loadTextUnits()` が返した `key`。
 *   **`MIX_ALL_UNITS`(空)なら、その冊を丸ごと。**
 */
export async function loadTextPhrases(bookId, unitKey = MIX_ALL_UNITS) {
  const book = textBookOf(bookId)
  if (!book) return ng('その冊はありません')

  if (book.local) {
    /* **ファイルの中。Supabase を呼ばない = 0円、しかも必ず引ける** */
    const u = Number(unitKey)
    const rows = unitKey === MIX_ALL_UNITS
      ? NATIVE_FLOW
      : NATIVE_FLOW.filter((x) => Number(x.u) === u)
    return ok(rows.map((x) => ({ en: x.en, ja: x.ja })))
  }

  if (!supabase) return ng('Supabase に接続していません')

  /* **丸ごとのときも、読みに行くのは1回。**
     UNIT ごとに `loadMaterial()` を呼ぶと、18 UNIT で 18 往復する */
  let ids = [unitKey]
  if (unitKey === MIX_ALL_UNITS) {
    const got = await loadRizapUnits(bookId)
    if (got.error) return ng(got.error.message ?? '冊の UNIT を読めませんでした')
    ids = (got.data ?? []).map((m) => m.id)
    if (!ids.length) return ok([])
  }

  const { data, error } = await supabase
    .from('material_sections')
    .select('material_id, seq, material_items ( seq, prompt_en, prompt_ja )')
    .in('material_id', ids)
    .order('seq', { ascending: true })
  if (error) return ng(error.message ?? 'その UNIT の中身を読めませんでした')

  const rows = []
  for (const sec of data ?? []) {
    for (const it of sec.material_items ?? []) {
      const en = String(it?.prompt_en ?? '').trim()
      if (en) rows.push({ en, ja: String(it?.prompt_ja ?? '').trim() })
    }
  }
  return ok(rows)
}
