/**
 * 復習の**出題範囲**と**個数**(2026-09 利用者の指定)。
 *
 * ============================================================================
 * 【何が問題だったか】
 *
 *   > Quick Responseと単語帳の復習について、結局ただランダムに出てくるだけで
 *   > すごく仕組みが分かりにくい。ここを意図をもって練習できるように
 *   > 変更したい。出題範囲の時系列での絞りかた(例:１週間以内・２週間以内・
 *   > ３週間以内・１か月以内・３か月以内・半年以内 etc...)、その時に復習したい
 *   > 単語やフレーズ、文章の個数だ。
 *
 *   読んで確かめたところ、指摘は**3つの穴**を指していた。
 *
 *   | | 単語帳の復習 | Quick Response の復習 |
 *   |---|---|---|
 *   | 時系列の絞り | **カレンダーで1日だけ** | 同じ |
 *   | 1回の個数 | **10語で固定** | **区切りが無い。溜まっている数だけ続く** |
 *   | 範囲の選び方 | カレンダー | 「今日出すぶん / 全部」のプルダウン |
 *
 *   とくに **Quick Response には「1回ぶん」が存在しなかった。**
 *   87問溜まっていれば「はじめる(87 問)」と出て、87問続く。
 *   単語帳には *「終わりの見えない作業は続かない。だから10語で区切る」* と
 *   書いてあるのに(`wordQuiz.js` の `SESSION_SIZE`)、**こちらで破っていた。**
 *
 * ============================================================================
 * 【なぜ「範囲」と「個数」を1か所に置くか】
 *
 *   単語帳と Quick Response は**並ぶ画面**である(どちらも左のメニューから
 *   開く、1問ずつの復習)。ところが範囲の選び方が**別物**になっていた ——
 *   片方はカレンダー、片方はプルダウン。
 *   **同じことをする2つの画面が、別の形になっている。**
 *
 *   算段をここ1つに置き、見た目は `ReviewScope.jsx` 1つに置く。
 *   **書き写すと必ず片方だけ古くなる**(単語帳で `LearnerWordbook` を
 *   別に持って踏んだ失敗・CLAUDE.md)。
 *
 * 【画面の中に書かない】
 *   `Wordbook.jsx` も `QrReview.jsx` も Supabase を引き連れているので、
 *   **素の node で一度も走らせられない。** だから算段だけを
 *   何にも依存しない形へ出してある(`playMark.js` / `mp3Join.js` と同じ考え方)。
 *   `npm run test:play` が数字で見張る。
 */
/* ★ **日付の道具と「出会った時期」は `metRange.js` 1か所**(第5.414節)。
     `addedDayOf` が**ここと `wordbookFilter.js` に2つ**書いてあった */
import { addedDayOf, daysAgo, todayKey } from './metRange.js'
/* **既定の10は `SESSION_SIZE` から取る。** 単語帳がずっとその数だった。
   同じ数を2か所に書かない(`wordQuiz.js` は素の node で読める) */
import { DEFAULT_FORM, SESSION_SIZE, formOf } from './wordQuiz.js'
import { FILTER_KEYS, countNarrowed } from './wordbookFilter.js'
/* ★ **段(覚え具合)は `learnStage.js` 1か所**(第5.406節)。
     「何を出す」の「苦手」「未学習」は、あちらの段そのものである */
import { stageOrDefaultPool } from './learnStage.js'

export { addedDayOf, daysAgo, todayKey }

/**
 * 出題範囲 —— **期限を見るか、見ないか**の2つだけ。
 *
 * ★ **「出会った時期」(`d7`〜`d182`)は、ここから出て行った**
 *    (第5.414節・段階3)。**1つも消していない** ——
 *    「詳しくしぼる」の中の**絞り込みの欄**へ移り、
 *    **カレンダーの「日付」と1つにまとまった**(`metRange.js`)。
 *
 *    もとは同じ行に「今日の復習」と「1週間以内」が混ざっていて、
 *    **「1週間」が『1週間後に出る』なのか『1週間以内に出会った』なのか、
 *    読んだだけでは決まらなかった**(第5.245節で行を2つに分けた)。
 *    **性質がちがうものは、そもそも同じ仕組みに入れない。**
 *
 * **`due`(今日の復習)は先頭のまま。** 間隔をあけて出す仕組み(箱)が
 * このアプリの背骨で、そこは壊さない。
 *
 * **`all` は、いまの「おさらい」とまったく同じもの。**
 */
export const SCOPES = [
  /* **`due` は先頭のまま。** `scopeOf()` が既定として `SCOPES[0]` を返す */
  { id: 'due', kind: 'due', label: '今日の復習' },
  { id: 'all', kind: 'all', label: 'ぜんぶ' },
]

export const scopeOf = (id) => SCOPES.find((s) => s.id === id) ?? SCOPES[0]

/* ══════════════════════════════════════════════════════════════════
   ★ **何を出す —— 4つ**(第5.414節・2026-10-07 利用者の指定・段階3)

     > 何を出す:「今日の復習」「苦手」「未学習」「ぜんぶ」の4つ。
     > それぞれに該当数を表示。初期設定は「今日の復習」。

   【なぜ1つの操作にまとめたか】

     もとは**2つの操作**だった。

       ・範囲の札(`scope`) … 今日の復習 / ぜんぶ / 1週間以内 / …
       ・段の札(`stage`)   … 未学習 / 苦手 / 学習中 / 覚えた

     「苦手なものを今日ぶんから」をやるには、**2か所を押す**必要があり、
     しかも**どちらを押したか画面の離れた場所に出ていた。**
     ゲストの多くが使っていない、という指摘の芯がここである。

     よく使う4つを**1つの行**にまとめた。
     **`scope` と `stage` の組み合わせに名前を付けただけ**で、
     **仕組みは1つも足していない**(「苦手」は `stage = 'weak'`、
     「今日の復習」は `scope = 'due'` そのもの)。

   【細かい組み合わせは、消していない】
     「今日の復習 × 学習中」のような組は、**「詳しくしぼる」の中の
     「段階」**で作れる(**勝手に狭めない**・CLAUDE.md)。
     ══════════════════════════════════════════════════════════════════ */

/**
 * **押したら何になるか**の表。**ここ1か所。**
 * 画面で `id === 'weak' ? …` と書かない(判断は1か所・CLAUDE.md)。
 */
export const PICKS = [
  { id: 'due', label: '今日の復習', scope: 'due', stage: null },
  { id: 'weak', label: '苦手', scope: 'all', stage: 'weak' },
  { id: 'new', label: '未学習', scope: 'all', stage: 'new' },
  { id: 'all', label: 'ぜんぶ', scope: 'all', stage: null },
]

export const pickOf = (id) => PICKS.find((p) => p.id === id) ?? PICKS[0]

/**
 * いまの `(scope, stage)` に当たる札。**ちょうど1つに決まる。**
 *
 * **段をえらんでいればそちらが勝つ**(「苦手」「未学習」は段そのもの)。
 * 「詳しくしぼる」で `learning` / `done` をえらんだときは、
 * **4つのどれにも当たらない**ので `''` を返す ——
 * **当てずっぽうで「ぜんぶ」を光らせない**(黙って嘘をつかない・CLAUDE.md)。
 * そのときは「◯件しぼり中」の側が、絞っていることを言う。
 */
export const pickIdOf = (scope, stage) => {
  if (stage) return PICKS.find((p) => p.stage === stage)?.id ?? ''
  return scope === 'due' ? 'due' : 'all'
}

/**
 * その札を押したら出るもの。**押す前の数も、押したあとの出題も、これ1つ。**
 * **数え方を2通り持たない**(CLAUDE.md)。
 */
export const pickPool = (rows, id, today = todayKey()) => {
  const p = pickOf(id)
  return scopePool(stageOrDefaultPool(rows, p.stage), p.scope, today)
}

/** 札に添える数。**数が見えないと選べない**(第5.245節と同じ考え方) */
export const pickCounts = (rows, today = todayKey()) => Object.fromEntries(
  PICKS.map((p) => [p.id, pickPool(rows, p.id, today).length]),
)

/**
 * 押したら何が起きるのかを、1行の日本語で言う。
 * **仕組みの内側の数字(箱の番号)は出さない**(CLAUDE.md)。
 */
export function pickLead(id, unit = '問') {
  const p = PICKS.find((x) => x.id === id)
  if (!p) return `詳しくしぼっています。`
  if (p.id === 'due') return `今日が復習の日のものから出します。`
  if (p.id === 'all') return `溜まっている${unit}ぜんぶから出します。期限は見ません。`
  return `「${p.label}」の${unit}から出します。期限は見ません。`
}

/**
 * 1回ぶんの個数。★ **10 / 20 / ぜんぶ の3つ**(第5.414節・段階3)。
 *
 *   > 何問ずつ:「10」「20」「ぜんぶ」の3つ(5と30は廃止)
 *
 * **`SESSION_SIZE`(10)は既定として残す。** 単語帳がずっとその数だった。
 * `'all'` は「範囲にあるものを全部」。
 */
export const SIZES = [10, 20, 'all']
export const DEFAULT_SIZE = SESSION_SIZE

/* ★ **聞き流しも、同じ一覧である**(第5.414節)。
     はじめ `RADIO_SIZES`(5 / 10 / 20 / 30 / ぜんぶ)を別に持ったが、
     **聞き流しの個数は「出しかた」で選んだ `size` をそのまま使う**ので、
     一覧が2つあると**選べる札と、実際に流れる数が食い違う**
     (5 をえらんでも `sizeOfValue()` が既定の 10 に落とす)。
     `npm run test:bar` が「札の一覧が『出しかた』と合っていない」と
     捕まえた —— **同じものを2つ持たない**(CLAUDE.md)。 */
export const sizeLabel = (size) => (size === 'all' ? 'ぜんぶ' : String(size))

/**
 * **プルダウンに出す言い方**(第5.262節)。「5 問」「ぜんぶ」。
 *
 * 札(`ReviewScope`)は横に並ぶので数だけで読めるが、
 * **プルダウンは1つしか見えない**ので、何の数か分からなくなる。
 *
 * **`'all'` かどうかを画面に書かせない**(判断は1か所・CLAUDE.md)——
 * 「ぜんぶ 問」という妙な言い方は、ここで塞ぐ。
 */
/**
 * **プルダウンから戻ってきた値を、`SIZES` の1つに直す**(第5.262節)。
 *
 * `<select>` の値は**いつも文字**なので、`'5'` は数の 5 に、
 * `'all'` は `'all'` のまま返す。
 *
 * **画面に `v === 'all' ? 'all' : Number(v)` と書かせない** ——
 * `'all'` をどう扱うかは、このファイルの持ちものである(判断は1か所)。
 * **知らない値は既定に落とす**(行き止まりを作らない)。
 */
export const sizeOfValue = (v) =>
  SIZES.find((n) => String(n) === String(v)) ?? DEFAULT_SIZE

export const sizePickLabel = (size, unit = '問') =>
  (size === 'all' ? sizeLabel(size) : `${sizeLabel(size)} ${unit}`)

/** 実際に出す数。`'all'` なら範囲にあるものを全部 */
export const takeCount = (size, poolLength) => (size === 'all'
  ? poolLength
  : Math.min(Number(size) || DEFAULT_SIZE, poolLength))

/**
 * いま出すものか(期限が来ているか)。
 *
 * **入れたばかりのものは、その日のうちに出す**(2026-09 実機)。
 * `mark_word()` は「まだ」を翌日に回すので、手で入れた語は
 * 入れた日に1回も出てこなかった。本当の直しは 0030 だが、
 * **貼る前でも動く道を残す**(CLAUDE.md)。
 */
export function isDueOn(dueOn, addedAt, today = todayKey()) {
  if (!dueOn) return true
  if (String(dueOn).slice(0, 10) <= today) return true
  return addedDayOf({ added_at: addedAt }) === today
}

/** 行の形で受け取る版。画面はこちらを呼ぶ */
export const isDueNow = (row, today = todayKey()) => isDueOn(row?.due_on, row?.added_at, today)

/**
 * 範囲にあてはまるものを返す。
 *
 * **絞り込み(分野・場面・教材・日付)を当てたあとの一覧を渡す。**
 * ここで二重に絞らない —— 数え上げと実際に出るものが食い違う。
 */
export function scopePool(rows, scopeId, today = todayKey()) {
  const sc = scopeOf(scopeId)
  const list = rows ?? []
  /* ★ **「出会った時期」はここから出て行った**(第5.414節)。
       いまは絞り込みの側(`inMet()`・`metRange.js`)が当てる */
  if (sc.kind === 'all') return list
  return list.filter((r) => isDueNow(r, today))
}

/** 札に添える数。**数が見えないと範囲を選べない**(ここが「直感的」の核心) */
export function scopeCounts(rows, today = todayKey()) {
  const out = {}
  for (const s of SCOPES) out[s.id] = scopePool(rows, s.id, today).length
  return out
}

/**
 * その札を選んだら何が出るのかを、1行の日本語で言う。
 *
 * **「仕組みが分かりにくい」への答えは、これである。**
 * 箱の番号や次に出す日は出さない(**仕組みの内側の数字を画面に出さない**・
 * CLAUDE.md)が、**押したら何が起きるか**は言葉で言える。
 */
export function scopeLead(scopeId, unit = '問') {
  const sc = scopeOf(scopeId)
  if (sc.kind === 'due') return `今日が復習の日のものから出します。`
  return `溜まっている${unit}ぜんぶから出します。期限は見ません。`
}

/**
 * その答えを記録するか。**遅く出す方へは動かさない**(2026-09 利用者の指定)。
 *
 * ============================================================================
 * 【なぜ要るか】
 *
 *   範囲を選べるようにすると、**まだ期限が来ていないものまで出せる。**
 *   そこで「言える」を押すたびに箱が上がると、同じ範囲を1日に3回まわした
 *   だけで箱が3つ上がり、**明日・明後日の復習が空になる。**
 *   これは「おさらい」で一度踏んだ穴とまったく同じものである。
 *
 * 【決めた規則】(利用者が選んだ)
 *
 *   | 押したもの | 記録するか |
 *   |---|---|
 *   | **まだ** | **いつでも記録する**(早く出す方へ動かすだけ) |
 *   | 言える(期限が来ている) | 記録する。ふつうどおり進む |
 *   | 言える(**先取り**) | **記録しない**(次に出す日を動かさない) |
 *   | 言える(この回でもう進めた) | **記録しない** |
 *
 *   **「早く出す方へは、いつ動かしてもよい。遅く出す方へは動かさない。」**
 *   思い出せなかったことは確かな手がかりなので、いつ押しても正しい。
 *
 *   これで「おさらい」の特別扱い(`extra`)が要らなくなる。
 *   1周目は期限が来ているものが進み、2周目にはそれが明日以降へ移っている
 *   ので、もう進まない。**守りはそのままで、規則が1つ減る。**
 *
 * @param {boolean} ok 「言える / 覚えかけ」を押したか
 * @param {object} opts `{ dueOn, addedAt, today, already }`
 *   `already` … この回でもう「言える」を記録した相手か
 */
export function shouldRecord(ok, {
  dueOn = null, addedAt = null, today = todayKey(), already = false,
} = {}) {
  if (!ok) return true
  if (already) return false
  return isDueOn(dueOn, addedAt, today)
}

/**
 * **出しかたが変わったか**を1つの文字列で表す(2026-09 利用者の指定
 * 「そして中に入ってからも絞り込みができるように」)。
 *
 * 復習に入ったあとで範囲・個数・絞り込みを変えたら、**その場で出し直す。**
 * ところが `setFilter` のすぐあとに組み直そうとしても、まだ古い値しか
 * 読めない(React は次の描き直しで反映する)。だから
 * **「変わったかどうか」を見張って、変わったら組み直す。**
 *
 * **単語帳と Quick Response で同じものを使う。** 鍵を書き写すと、
 * レベルを足したときに片方だけ組み直さない、という形になる。
 */
/**
 * ★ **いくつ絞っているか**(第5.414節・段階3)。
 *
 *   > 何か絞り込んでいるときは、見出しの横に「◯件しぼり中」と表示し、
 *   > 上部の絞り込みアイコンにも小さな印をつける。
 *
 * **絞り込みの欄(`FILTER_KEYS`)と、段階を一緒に数える。**
 * 段階は「詳しくしぼる」の中にあるので、**あれも絞り込みである** ——
 * 数えないと、段階だけを選んだときに「0件しぼり中」と出て**嘘になる。**
 *
 * **数えるものを2か所に書かない** —— `countNarrowed()` は
 * `wordbookFilter.js` が持つ一覧から数えている。
 */
export const narrowedCount = ({ filter = null, stage = null } = {}) =>
  countNarrowed(filter) + (stage ? 1 : 0)

export function runKeyOf({
  scope = '', size = '', filter = {}, group = null,
  /* **並べ方も鍵に入れる**(2026-09)。入れないと、「教材ごと」に変えても
     押し直すまで並びが変わらない。**出題の形(`form`)は入れない** ——
     あれはいま出ているカードの見せ方で、組み直すと答えかけが消える。
     **繰り返す(`repeat`)も入れない** —— 出し切ったあとに効くものである */
  order = '',
} = {}) {
  const f = filter ?? {}
  /* **鍵は `FILTER_KEYS`(`wordbookFilter.js`)から読む**(2026-09)。
     ここに `f.day, f.material, …` と書き写していたので、レベルを足した
     ときに**そこだけ反映されなかった。** 品詞を足したこの回で、
     同じ落とし穴を二度踏まないよう**一覧そのものを共有した。**
     `emptyFilter()` も `countNarrowed()` も、同じ一覧を見ている */
  return [scope, size, group ?? '', order ?? '', ...FILTER_KEYS.map((k) => f[k] ?? '')]
    .join('\u0000')
}

/**
 * 選んだものを覚えておく。**一度決めれば、毎回選ぶものではない**
 * (紙の幅・文字の大きさと同じ作法)。
 *
 * **単語帳と Quick Response で別に覚える**(`where`)。溜まっているものが
 * 違うので、片方で「1週間」を選んだらもう片方まで変わる、では困る。
 */
const KEY = (where, what) => `eas.review.${where}.${what}`

export function loadScope(where) {
  try {
    const saved = localStorage.getItem(KEY(where, 'scope'))
    return SCOPES.some((s) => s.id === saved) ? saved : SCOPES[0].id
  } catch { return SCOPES[0].id }
}

export function saveScope(where, id) {
  try { localStorage.setItem(KEY(where, 'scope'), String(id)) } catch { /* 使えなくても困らない */ }
}

export function loadSize(where) {
  try {
    const saved = localStorage.getItem(KEY(where, 'size'))
    if (saved === 'all') return 'all'
    const n = Number(saved)
    return SIZES.includes(n) ? n : DEFAULT_SIZE
  } catch { return DEFAULT_SIZE }
}

export function saveSize(where, size) {
  try { localStorage.setItem(KEY(where, 'size'), String(size)) } catch { /* 同上 */ }
}

/**
 * ============================================================================
 * 【出しかたに足した3つ】(2026-09 実機・利用者の指定)
 *
 *   > 出し方の中に、「ランダムで」と「教材ごと」選んだを選べるように、
 *   > また一度に出す個数の横に「繰り返す」ボタンも作ってください
 *
 * あわせて**出題の形**も、上の帯からここへ移した
 * (スマホで画面から切れていた・`wordQuiz.js` の頭に経緯がある)。
 *
 * **一覧はそれぞれの持ち主が持つ**(`QUIZ_FORMS` / `WORD_ORDERS` は
 * `wordQuiz.js`)。ここは**覚えておくだけ。** 一覧を書き写すと、
 * 形を1つ足したときに片方だけ古くなる。
 */

/** 出題の形。知らない id(消した `auto` / `spell`)は既定に落とす */
export function loadForm(where) {
  try { return formOf(localStorage.getItem(KEY(where, 'form'))) } catch { return DEFAULT_FORM }
}

export function saveForm(where, id) {
  try { localStorage.setItem(KEY(where, 'form'), String(id)) } catch { /* 同上 */ }
}

/** 並べ方(ランダム / 教材ごと) */
/* ══════════════════════════════════════════════════════════════════
   ★ **シャッフルと並べ方を分けた**(第5.414節・段階3・利用者の指定)

     > そのすぐ下に「シャッフル」「繰り返す」の切り替えスイッチ2つ。
     > 並べ方(教材ごと／型でまとめる)は、シャッフルがオフのときの
     > 並びとして残す。

   もとは1つの行に **ランダム / 教材ごと / 型でまとめる** が並んでいた。
   つまり「ランダム」は**並べ方の1つ**だったので、
   **「教材ごとに並べたうえでシャッフル」が作れない**し、
   いちばんよく使う入り切りが、ほかの選択肢に埋もれていた。

   いまは **シャッフル(入 / 切)** と **並べ方** の2つである。
   **一覧は呼ぶ側が持つ**(`WORD_ORDERS` / `QR_ORDERS`)—— 単語帳と
   Quick Response で並ぶものが違う(あちらには「型でまとめる」がある)。
   **どれが「ランダム」かは、その一覧が `random: true` で言う** ——
   id は単語帳が `random`、Quick Response が `shuffle` と**違う**ので、
   ここに書き写すと必ず片方だけ古くなる。
     ══════════════════════════════════════════════════════════════════ */

/** その一覧の「ランダム」。無ければ空 */
export const randomOrderId = (orders) => (orders ?? []).find((o) => o.random)?.id ?? ''

/** シャッフルが切のときにえらべる並び(ランダムを除いたもの) */
export const plainOrders = (orders) => (orders ?? []).filter((o) => !o.random)

/**
 * 実際に使う並び。**判断は1か所** —— 画面で
 * `shuffle ? 'random' : order` と書かない(id が画面ごとに違う)。
 */
export const orderToUse = (orders, { shuffle = true, order = '' } = {}) => {
  if (shuffle) return randomOrderId(orders) || order
  /* **えらんでいなければ、空のまま返す。** 並べ方の先頭を勝手に当てない ——
     空のときは `buildSession()` が**これまでの並び**(まだ → 期限の古い順 →
     箱の小さい順)で出す。**勝手に狭めない**(CLAUDE.md) */
  return plainOrders(orders).some((o) => o.id === order) ? order : ''
}

/**
 * 並べ方(シャッフルが切のときのもの)を覚えておく。
 *
 * **古い値(「ランダム」)が入っていたら、並べ方の先頭に落とす** ——
 * あれはもうシャッフルの側が持っている(**行き止まりを作らない**)。
 */
export function loadOrder(where, orders = null) {
  try {
    const saved = localStorage.getItem(KEY(where, 'order'))
    return orderToUse(orders, { shuffle: false, order: saved ?? '' })
  } catch { return '' }
}

export function saveOrder(where, id) {
  try { localStorage.setItem(KEY(where, 'order'), String(id)) } catch { /* 同上 */ }
}

/**
 * シャッフルするか。★ **既定は「する」**(第5.414節)。
 *
 * **いまと1ミリも変わらない** —— 単語帳の既定は `random`、
 * Quick Response の既定は `shuffle` で、**どちらもランダムだった。**
 *
 * **覚えていないときは、古い `order` から読み取る** ——
 * 「ランダム」にしていた人はシャッフル入、「教材ごと」にしていた人は切。
 * **黙って入れ替えない**(CLAUDE.md)。
 */
export function loadShuffle(where, orders = null) {
  try {
    const saved = localStorage.getItem(KEY(where, 'shuffle'))
    if (saved === 'on') return true
    if (saved === 'off') return false
    const old = localStorage.getItem(KEY(where, 'order'))
    return !old || old === randomOrderId(orders)
  } catch { return true }
}

export function saveShuffle(where, on) {
  try { localStorage.setItem(KEY(where, 'shuffle'), on ? 'on' : 'off') } catch { /* 同上 */ }
}

/**
 * 繰り返すか。**既定は「しない」**(いまと1ミリも変わらない)。
 *
 * 入っていると、1回ぶんを出し切っても
 * 「この範囲は終わりです。」で止まらず、もう一度その範囲を回す。
 * 利用者は前にも同じことを言っている(2026-09)——
 *
 *   > 一巡しただけで「今日はもう出すものがありません」となってしまいます。
 *   > 反復してランダムに出題するよう変更してください。
 *
 * **間隔の決まりは壊れない。** 先取りしたぶんは `shouldRecord()` が
 * 記録しないので、何周しても明日の復習が空にならない。
 */
export function loadRepeat(where) {
  try { return localStorage.getItem(KEY(where, 'repeat')) === 'on' } catch { return false }
}

export function saveRepeat(where, on) {
  try { localStorage.setItem(KEY(where, 'repeat'), on ? 'on' : 'off') } catch { /* 同上 */ }
}

/**
 * ============================================================================
 * 【段(覚え具合)は `learnStage.js` へ移した】(第5.406節・2026-10-07)
 *
 * 利用者の指定で **4段階**(未学習 / 苦手 / 学習中 / 覚えた)になった。
 * もとはここに2組(`WORD_GROUPS` / `QR_GROUPS`)あり、
 * **単語帳は `status`、Quick Response は箱**と分け方が違っていた。
 *
 * 4段階では**段と `status` が1対1でなくなった**ので
 * (「覚えた」は `learning` と `known` の両方にまたがる)、
 * **箱だけで決まる1組**にまとめ、`src/lib/learnStage.js` へ出した。
 * **単語帳も Quick Response も、そのまったく同じものを呼ぶ。**
 *
 * 【ここに控えを残していない】
 *   `WORD_GROUPS` / `QR_GROUPS` / `qrTally()` / `qrGroupOf()` /
 *   `qrGroupPool()` / `groupLead()` は**消した。**
 *   誰も呼ばない控えを残すと、次に段を触る人が
 *   **古いほうを直してしまう**(CLAUDE.md「呼び名を2か所に書かない」)。
 */
