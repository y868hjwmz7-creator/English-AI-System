/**
 * **冊を「この人に出す / 外す」の判断と、知らせの文**(第5.181節)。
 *
 * ============================================================================
 *   > 新しい冊をアサインするのは各ゲストの単語帳もquick response帳、
 *   > もしくは「アサインする」の機能を作り、その中から教材、単語帳の冊、
 *   > quick responseの冊を選べるようにしたいです。
 *
 * 【なぜ切り出したか】
 *
 *   配る場所が**2つ**になった(ゲストのページ / 「アサインする」の画面)。
 *   どちらも同じことをするので、**判断と文言を書き写すと必ず食い違う**
 *   (CLAUDE.md「呼び名・判断を2か所に書かない」)。
 *
 *   React の持ちもの(state)は画面ごとでよい。**同じでなければ困るのは、
 *   ①どれが出ているか ②どれを書き換えるか ③何と言うか** の3つである。
 *
 * 【Supabase を引き連れない】
 *
 *   窓口を呼ぶのは画面の側(`setLearnerFeature`)。ここは算段だけなので、
 *   **`npm run test:play` が素の node でそのまま走らせられる**
 *   (`playMark.js` / `drillWords.js` と同じ考え方)。
 *
 * 【名前の作り方は、ここでも書かない】
 *
 *   `shelf:<分野>` は `shelfFeature()`、`nf:<番号>` は `nfFeature()` が作る。
 *   **ここで `'shelf:' + id` と書かない** —— 置く場所の数だけ食い違う。
 * ============================================================================
 */
import { shelfFeature, shelfList } from '../data/shelves.js'
import { NATIVE_FLOW_UNITS, nfFeature, unitName } from '../data/nativeFlow.js'

/** 出している業種べつの単語帳。**並びは `shelfList()` のまま** */
export const shelvesOn = (features = null) => shelfList()
  .filter((s) => !!features && features.has(shelfFeature(s.id)))

/** まだ出していない業種べつの単語帳(えらんで足す欄に並ぶ) */
export const shelvesOff = (features = null) => shelfList()
  .filter((s) => !features || !features.has(shelfFeature(s.id)))

/** 出している Native Flow の Unit の番号。**並びは `NATIVE_FLOW_UNITS` のまま** */
export const nfUnitsOn = (features = null) => NATIVE_FLOW_UNITS
  .filter((u) => !!features && features.has(nfFeature(u.id)))
  .map((u) => u.id)

/**
 * **丸ごと出す / 外すときに、本当に書き換えるものだけ**を返す。
 *
 * 6つとも呼ぶと、**変えていない Unit まで書き直す**ことになる。
 * すでにその向きのものは、窓口を呼ばない。
 */
export const nfAllTodo = (features = null, on = true) => NATIVE_FLOW_UNITS
  .map((u) => nfFeature(u.id))
  .filter((id) => (!!features && features.has(id)) !== !!on)

/* ── 知らせの文。**画面に書き写さない** ─────────────────────── */

/** 冊の呼び名(業種べつ)。**知らせと画面で言い方を変えない** */
export const shelfTitle = (shelf) => `業種べつの単語帳「${shelf?.label ?? ''}」`

/** 冊の呼び名(Native Flow の Unit)。**呼び名は `unitName()` 1か所** */
export const nfUnitTitle = (u) => `Native Flow「${unitName(u)}」`

/** 押した直後の1行(まだ通っていない) */
export const busyText = (title, on) => (on
  ? `「${title}」を出しています…`
  : `「${title}」を外しています…`)

/** 通ったときの1行。**誰に・何を・どうしたか**を、そのまま言う */
export const doneText = (name, title, on) => (on
  ? `${name} さんの画面に「${title}」を出しました。`
  : `${name} さんの画面から「${title}」を外しました。`)

/** 丸ごとのとき、押す前からそうなっていた場合の1行(黙って何もしない、をしない) */
export const nfAllNoneText = (name, on) => (on
  ? `${name} さんには、すでに ${NATIVE_FLOW_UNITS.length} つとも出しています。`
  : `${name} さんには、もともと1つも出していません。`)

/** 丸ごとのとき、いま何をしているかの1行 */
export const nfAllBusyText = (n, on) => (on
  ? `Unit を ${n} つ出しています…`
  : `Unit を ${n} つ外しています…`)

/** 丸ごとが通ったときの1行 */
export const nfAllDoneText = (name, on) => (on
  ? `${name} さんの画面に Native Flow を ${NATIVE_FLOW_UNITS.length} つとも出しました。`
  : `${name} さんの画面から Native Flow を外しました。`)

/**
 * **途中で断られたときの1行。**
 *
 * 「失敗しました」だけだと、**いくつ出たのかが分からない。**
 * どこまで通ったかを、そのまま言う(`eraseNow` と同じ作法)。
 */
export const stoppedText = (done, err) => `${done} つまで済みましたが、`
  + `そこで止まりました: ${err?.message ?? err}`
