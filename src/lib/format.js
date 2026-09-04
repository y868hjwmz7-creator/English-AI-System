/** 日付・数値の表示を整える小さな道具箱 */

/** Date を "2026-08-24" の形にする */
export function toDateKey(date) {
  const d = date instanceof Date ? date : new Date(date)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 今日の日付を "2026-08-24" の形で返す */
export function today() {
  return toDateKey(new Date())
}

/** "2026-08-24" を "8/24" の形にする(グラフの軸ラベル用) */
export function shortDate(dateKey) {
  const [, m, d] = dateKey.split('-')
  return `${Number(m)}/${Number(d)}`
}

/** 分を "1時間20分" のような読みやすい形にする */
export function formatMinutes(minutes) {
  if (!minutes) return '0分'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}分`
  if (m === 0) return `${h}時間`
  return `${h}時間${m}分`
}

/** 直近 n 日分の日付キーの配列を、古い順で返す */
export function lastNDays(n, from = new Date()) {
  const days = []
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(from)
    d.setDate(d.getDate() - i)
    days.push(toDateKey(d))
  }
  return days
}

/**
 * 連続学習日数(ストリーク)を数える。
 * 今日か昨日に記録があればそこから遡って、記録が途切れるまで数えます。
 */
export function calculateStreak(dateKeys) {
  const set = new Set(dateKeys)
  const cursor = new Date()

  // 今日まだ記録がなければ、昨日から数え始める(今日はまだ終わっていないため)
  if (!set.has(toDateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1)
    if (!set.has(toDateKey(cursor))) return 0
  }

  let streak = 0
  while (set.has(toDateKey(cursor))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

/**
 * 教材名を、見出し・条件・日付に分ける。
 *
 * 教材名は「2026-08-27 / 数の表現 + 数字 / B1 / 製造 / テスト太郎」の
 * ように、日付から始まり「/」で条件が続く形で自動生成される。
 * 並べ替えや検索には都合がよいが、**そのまま1行で出すと
 * 「何の教材か」が読み取れない**(2026-08 の指摘)。
 *
 * 表示するときだけ分ける。**保存されている教材名は変えない。**
 * 既にある教材もそのまま直り、名前で並べ替えたときの順序も保たれる。
 *
 * @returns {{ date: string|null, main: string, tags: string[] }}
 *   date … 先頭の日付(無ければ null)
 *   main … 見出しにするもの(ふつうは弱点の名前)
 *   tags … 小さな札にするもの(レベル・業界・ゲスト名など)
 */
export function parseMaterialTitle(title) {
  const text = String(title ?? '').trim()
  const m = /^(\d{4}-\d{2}-\d{2})\s*\/\s*(.*)$/.exec(text)
  const date = m ? m[1] : null
  const rest = (m ? m[2] : text).trim()
  // **「 / 」(前後に空白)でだけ区切る。**
  // 弱点の名前そのものに「/」が入ることがある(分詞(ing/ed) など)。
  // 空白なしの「/」まで区切ると、名前が「分詞(ing」と「ed)」に割れる
  // (2026-08 実機で発生)。教材名の自動生成も「 / 」でつないでいる。
  const parts = rest.split(/\s+\/\s+/).map((x) => x.trim()).filter(Boolean)
  return { date, main: parts[0] ?? rest, tags: parts.slice(1) }
}

/** 先頭の日付だけが要るとき(印刷の見出しなど) */
export function splitTitleDate(title) {
  const { date, main, tags } = parseMaterialTitle(title)
  return { date, title: [main, ...tags].join(' / ') }
}

/**
 * 複製の教材名。**日付は今日にし、うしろに訛りを添える。**
 *
 * 教材名は `YYYY-MM-DD / 主題 / 弱点…` の形をしている
 * (`parseMaterialTitle`)。同じ主題の教材が2本並ぶので、
 * **どちらがどの訛りかが名前で分かる**ようにしておく。
 */
export function copyTitleFor(title, accentName, today = new Date()) {
  const { main, tags } = parseMaterialTitle(title)
  const ymd = today.toISOString().slice(0, 10)
  const name = accentName ? `${main}(${accentName})` : main
  return [ymd, name, ...tags].join(' / ')
}
