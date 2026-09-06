/**
 * **やり終えたときの手応え**(2026-09 利用者の指定
 * 「単語帳とクイックレスポンス帳にゲーミフィケーションを追加したいです」)。
 *
 * ============================================================================
 * 【何を足して、何を足さないか】
 *
 *   このアプリには、**すでに決まっていること**がある。取り違えない。
 *
 *   | すでにある決まり | ここでどう効くか |
 *   |---|---|
 *   | **続いているのは「日」ではなく「週」で数える**(0019) | 日の連続記録は作らない |
 *   | **仕組みの内側の数字を、画面に出さない** | 箱の番号・次に出す日は出さない |
 *   | **数を並べただけでは、何も伝わらない** | いつも見えるのは1つだけにする |
 *   | **「まだ」を赤くしない。責めない** | 点が低い回にも、責める言葉を出さない |
 *   | **人が見ていると分かることが、どんなバッジより効く**(0019) | 印だけで釣らない |
 *
 *   **ゲスト同士のランキングは作らない。** レッスンはゲストと画面を共有
 *   しながら行うので、他のゲストの名前や数字が映ると事故になる
 *   (仕様書 5.5・2026-08 実機で指摘を受けた件)。
 *   競う相手は**自分の記録**である。
 *
 * 【なぜここに切り出すのか】
 *   画面(`SessionResult.jsx`)の中に書くと、**素の node で一度も
 *   確かめられない。** `playMark.js` / `mp3Join.js` と同じ考え方で、
 *   何にも依存しない形にしてある(`npm run test:play` が見張る)。
 */

/**
 * その回の**いちばん長い連続**(思い出せた数)。
 *
 * **点数だけでは「調子」が出ない。** 8/10 でも、続けて8つ当てたのと
 * 1つおきに外したのとでは手応えが違う。
 *
 * @param list `[{ ok: true / false }, …]`(答えた順)
 */
export function bestStreak(list = []) {
  let best = 0
  let run = 0
  for (const x of Array.isArray(list) ? list : []) {
    if (x && x.ok) {
      run += 1
      if (run > best) best = run
    } else {
      run = 0
    }
  }
  return best
}

/**
 * 連続の言い方。**短い連続では出さない。**
 * 2連続で「2 連続!」と出しても、うれしくないし場所を食うだけである
 * (「数を並べただけでは、何も伝わらない」)。
 */
export const STREAK_FROM = 3

export function streakLine(list = []) {
  const n = bestStreak(list)
  return n >= STREAK_FROM ? `${n} 連続で思い出せました` : ''
}

/**
 * 声かけ。**結果から決める**(押すたびに変わらない)。
 *
 * スラッシュリーディングの `praiseFor()` と同じ作法である ——
 * 押すたびに言葉が入れ替わると、目が言葉のほうへ行って気が散る。
 *
 * **いちばん下でも責めない。** 知らないことは失敗ではない
 * (「まだ」を赤くしないのと同じ考え方・CLAUDE.md)。
 */
export function praiseFor(ok = 0, total = 0) {
  const n = Number(total) || 0
  if (n <= 0) return ''
  const got = Math.max(0, Math.min(Number(ok) || 0, n))
  if (got === n) return 'Perfect! 全部そろいました'
  const r = got / n
  if (r >= 0.8) return 'いい調子です'
  if (r >= 0.5) return 'よく粘りました'
  if (got > 0) return '思い出せたものがあります'
  return '出会えたことが、次につながります'
}

/**
 * 週の続き具合(0019 の `vocab_week`)。**日ではなく週。**
 *
 * 日ごとの連続記録は1日休んだ瞬間に途切れ、**それがやめる理由になる。**
 * 週2回のレッスンに合わせた宿題なので、毎日やる前提が合っていない。
 *
 * @param week `{ days, weeks }`
 */
export function weekLine(week) {
  const days = Math.max(0, Number(week?.days) || 0)
  const weeks = Math.max(0, Number(week?.weeks) || 0)
  if (!days && !weeks) return ''
  const parts = []
  if (days) parts.push(`今週 ${days} 日`)
  if (weeks) parts.push(`${weeks} 週つづけて`)
  return parts.join(' / ')
}

/**
 * **集める楽しみ**(2026-09 利用者の指定)。
 *
 * `vocab_by_industry()`(0019)は**ずっと前からある**のに、
 * **どこからも呼んでいなかった。** 自分の仕事の語がそろっていくのは、
 * 数字の中でいちばん「自分のこと」に見える。
 *
 * @param rows  `[{ industry, known, learning }, …]`
 * @param limit いくつ出すか。**多く並べると、どれも読まれない**
 */
export function collectRows(rows = [], { limit = 3 } = {}) {
  return (Array.isArray(rows) ? rows : [])
    .map((r) => {
      const known = Math.max(0, Number(r?.known) || 0)
      const learning = Math.max(0, Number(r?.learning) || 0)
      const total = known + learning
      return {
        industry: String(r?.industry ?? ''),
        known,
        learning,
        total,
        // そろい具合。**0で割らない**
        ratio: total ? known / total : 0,
      }
    })
    .filter((r) => r.industry && r.total > 0)
    // **覚えた語が多い順。** 同じなら、出会った語が多い順
    .sort((a, b) => (b.known - a.known) || (b.total - a.total)
      || a.industry.localeCompare(b.industry))
    .slice(0, Math.max(0, limit))
}
