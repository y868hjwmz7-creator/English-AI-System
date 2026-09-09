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
import { toDateKey } from './format.js'
/* **既定の10は `SESSION_SIZE` から取る。** 単語帳がずっとその数だった。
   同じ数を2か所に書かない(`wordQuiz.js` は素の node で読める) */
import { SESSION_SIZE } from './wordQuiz.js'
import { FILTER_KEYS } from './wordbookFilter.js'

/** 今日(端末の日付)。"2026-08-30" */
export const todayKey = () => toDateKey(new Date())

/**
 * その行が単語帳・復習に入った日。無ければ null。
 *
 * **`toDateKey` を通す**(端末の日付に直す)。`.slice(0, 10)` だと
 * 世界標準時の日付になり、夜の語が前日になる。
 * **数え方を2通り持たない** —— `WordbookFilter` の `addedDayOf` は
 * これを出し直しているだけである。
 */
export const addedDayOf = (row) => (row?.added_at
  ? toDateKey(new Date(row.added_at))
  : null)

/** n 日前の日付キー */
export function daysAgo(n, today = todayKey()) {
  const d = new Date(`${today}T00:00:00`)
  if (Number.isNaN(d.getTime())) return today
  d.setDate(d.getDate() - Number(n || 0))
  return toDateKey(d)
}

/**
 * 出題範囲。**時系列は「出会った日」で数える**(2026-09 利用者の指定)。
 *
 *   「1週間以内」= **単語帳・復習に入った日**が7日前以降のもの。
 *   つまり「先週のレッスンで出会ったものをさらう」という使い方になる。
 *   いまのカレンダーの絞り込み(`added_at`)と**同じ日付**なので、
 *   考え方が2つに割れない。
 *
 * **`due`(今日出す)を先頭に、既定のまま残す。** 間隔をあけて出す仕組み
 * (箱)がこのアプリの背骨で、そこは壊さない。範囲は「そこに足す」のではなく
 * **「そこから広げる」**選択肢である。
 *
 * **`all` は、いまの「おさらい」とまったく同じもの。** ボタンを別に置くと
 * **同じことをするものが2つ**になるので、この札に吸収する
 * (機能は消えていない —— これまでは0件になるまで見えなかったので、
 * むしろ届きやすくなる)。
 */
export const SCOPES = [
  { id: 'due', kind: 'due', label: '今日出す' },
  { id: 'd7', kind: 'days', days: 7, label: '1週間' },
  { id: 'd14', kind: 'days', days: 14, label: '2週間' },
  { id: 'd21', kind: 'days', days: 21, label: '3週間' },
  { id: 'd30', kind: 'days', days: 30, label: '1か月' },
  { id: 'd90', kind: 'days', days: 90, label: '3か月' },
  { id: 'd182', kind: 'days', days: 182, label: '半年' },
  { id: 'all', kind: 'all', label: 'ぜんぶ' },
]

export const scopeOf = (id) => SCOPES.find((s) => s.id === id) ?? SCOPES[0]

/**
 * 1回ぶんの個数(2026-09 利用者の指定で 5 / 10 / 20 / 30 / ぜんぶ)。
 *
 * **`SESSION_SIZE`(10)は既定として残す。** 単語帳がずっとその数だった。
 * `'all'` は「範囲にあるものを全部」。
 */
export const SIZES = [5, 10, 20, 30, 'all']
export const DEFAULT_SIZE = SESSION_SIZE
export const sizeLabel = (size) => (size === 'all' ? 'ぜんぶ' : String(size))

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
  return (addedAt ? toDateKey(new Date(addedAt)) : null) === today
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
  if (sc.kind === 'all') return list
  if (sc.kind === 'due') return list.filter((r) => isDueNow(r, today))
  /* **「1週間以内」= 7日前の日付以降。** 日付そのもので比べるので、
     時差でずれない。**出会った日が分からないもの(0024 を貼る前に
     入った古い行)は入らない** —— 当てずっぽうで入れない */
  const from = daysAgo(sc.days, today)
  return list.filter((r) => {
    const d = addedDayOf(r)
    return Boolean(d) && d >= from
  })
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
  if (sc.kind === 'due') return `今日出すぶんから出します。`
  if (sc.kind === 'all') return `溜まっている${unit}ぜんぶから出します。期限は見ません。`
  return `${sc.label}以内に出会った${unit}から出します。`
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
export function runKeyOf({ scope = '', size = '', filter = {}, group = null } = {}) {
  const f = filter ?? {}
  /* **鍵は `FILTER_KEYS`(`wordbookFilter.js`)から読む**(2026-09)。
     ここに `f.day, f.material, …` と書き写していたので、レベルを足した
     ときに**そこだけ反映されなかった。** 品詞を足したこの回で、
     同じ落とし穴を二度踏まないよう**一覧そのものを共有した。**
     `emptyFilter()` も `countNarrowed()` も、同じ一覧を見ている */
  return [scope, size, group ?? '', ...FILTER_KEYS.map((k) => f[k] ?? '')].join('\u0000')
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
 * 【段(まだ / 覚えかけ / 覚えた)を選べるようにする】(2026-09 利用者の指定)
 *
 *   > 学習者の心理としては、覚えた、を押すのは少し勇気がいるものです。
 *   > なので、それぞれ数を示すだけではなく、
 *   > タッチすればそれらを復習できるようにしたいです。
 *
 * **数を出しておいて、押せないのがいちばん惜しい。**
 * 「覚えた」を押すのに勇気が要るのは、**押したらもう出てこない**と思うから
 * である。いつでも呼び出して確かめられるなら、押すのは怖くなくなる。
 *
 * 【単語帳と Quick Response で、段の決め方が違う】
 *
 *   | | 何で分けるか | なぜ |
 *   |---|---|---|
 *   | 単語帳 | `status`(unknown / learning / known) | 表がその3つで持っている |
 *   | Quick Response | **箱の番号**(0 / 1〜5 / 6) | あちらは status が learning のまま卒業する(0038) |
 *
 *   **そろえない。** 数え方をどちらかに寄せると、いま画面に出ている数が
 *   変わってしまう。**変えるのは「押せるかどうか」だけ**である。
 *   ちがうのは分け方だけなので、**見た目は `ReviewStats.jsx` 1つ**にする。
 *
 * 【覚えない】
 *   範囲(`scope`)と個数(`size`)は覚えるが、**段は覚えない。**
 *   あれは「今日はこれをさらう」というその場の選択で、
 *   覚えていると次に開いたとき**覚えた語ばかりが出てきて**、
 *   なぜそうなったのか分からない。
 */

/** 単語帳の段。**id は `word_reviews.status` そのもの**(対応表を持たない) */
export const WORD_GROUPS = [
  { id: 'unknown', label: 'まだ' },
  { id: 'learning', label: '覚えかけ' },
  { id: 'known', label: '覚えた' },
]

/**
 * Quick Response の段。**箱の番号で分ける。**
 *
 * `qr_items` の status は「まだ」を押しても `unknown`、卒業しても `learning`
 * のままなので(0038 と同じ考え方)、**箱でしか段を見分けられない。**
 */
export const QR_GROUPS = [
  { id: 'yet', label: 'まだ', has: (box) => box < 1 },
  { id: 'mid', label: '言えかけ', has: (box) => box >= 1 && box < 6 },
  { id: 'done', label: '言える', has: (box) => box >= 6 },
]

/** その行がどの段か(Quick Response) */
export const qrGroupOf = (row) => {
  const box = Number(row?.box ?? 0)
  return (QR_GROUPS.find((g) => g.has(box)) ?? QR_GROUPS[0]).id
}

/**
 * その段だけを取り出す(Quick Response)。**`null` なら全部。**
 * 単語帳は読み込むときの `status` で段が決まるので、こちらは要らない。
 */
export const qrGroupPool = (rows, groupId) => (groupId
  ? (rows ?? []).filter((r) => qrGroupOf(r) === groupId)
  : (rows ?? []))

/**
 * 段を選んだら何が起きるのかを、1行の日本語で言う。
 * **押す前に分かるようにする**(`scopeLead` と同じ作法)。
 */
export function groupLead(groups, groupId, unit = '語') {
  const g = (groups ?? []).find((x) => x.id === groupId)
  if (!g) return `押すと、その段だけを復習できます。`
  return `「${g.label}」だけを復習します。もう一度押すと、ぜんぶに戻ります。`
}

/**
 * 3つの数(**まだ / 言えかけ / 言える**)。
 *
 * ============================================================================
 * 【なぜ「今日出す / 溜まっている」をやめたか】(2026-09 実機・利用者の指定)
 *
 *   > 「今日出す」「溜まっている」の意味が私にも分からないので、
 *   > そもそも文言を変えたいですね。
 *
 *   調べたところ、**「帳面ぜんぶの数」を大きく出しているアプリは
 *   ほとんど無かった。**
 *
 *   | アプリ | 出している数 |
 *   |---|---|
 *   | Anki(日本語) | 新規 / 学習中 / 復習 —— **どれも今日やる数** |
 *   | WaniKani | Lessons / Reviews —— 同上 |
 *   | mikan | 今日の目標 / **覚えた単語数**(= 進み具合) |
 *   | reminDO・忘却曲線系 | 今日の復習 だけ |
 *
 *   「溜まっている」は**宿題が溜まる**の響きで、増えるほど悪いものに見える。
 *   実際は自分が集めてきた文で、**増えるほど良いもの**である。
 *
 *   しかも**このアプリの単語帳には、すでに「まだ / 覚えかけ / 覚えた」**が
 *   あった。こちらだけが別の数え方をしていた。利用者がそろえることを選んだ。
 *
 * 【箱から3つに束ねる。**SQL は1行も要らない**】
 *
 *   `qr_items` は箱(`box`)を返しているので、読み込んだ行から数えられる。
 *
 *   | 箱 | どう数えるか | なぜ |
 *   |---|---|---|
 *   | 0 | **まだ** | 一度も言えていない(「まだ」を押すと 0 に戻る) |
 *   | 1〜5 | **言えかけ** | 積んでいる途中 |
 *   | 6 | **言える** | 卒業(25回続いた)。30日休みに入っている |
 *
 *   **箱の番号そのものは画面に出さない**(仕組みの内側の数字・CLAUDE.md)。
 *   出すのは束ねた3つだけである。
 *
 *   **「今日いくつやるか」はここでは数えない。** すぐ下の
 *   「6 問を出す」ボタンが同じことを言っている(同じものを2か所に出さない)。
 *
 * @param {Array} rows `qr_items` が返した行
 */
export function qrTally(rows) {
  /* **段の一覧は `QR_GROUPS` 1か所。** ここで箱の境目を書き直すと、
     数えた段と、押して出てくる段が食い違う(`qrGroupOf` と同じ道を通す) */
  const out = {}
  for (const g of QR_GROUPS) out[g.id] = 0
  for (const r of rows ?? []) out[qrGroupOf(r)] += 1
  return out
}
