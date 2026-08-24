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
