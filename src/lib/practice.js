/**
 * 取り組みを、**裏で数える**(0022・2026-08 の設計変更)。
 *
 * > 回数や時間を裏で記録し、トレーナー側のゲストの情報に反映される仕組みです。
 *
 * これまではゲストが自分で「何分やった」と入力する画面(学習の記録)だった。
 * **入力そのものが手間で、しかも入れ忘れる。**
 * やったことはこちらが数える。ゲストは何も入力しない。
 *
 * 【数え方の決まり】
 *   ・**見えている時間だけ**数える。裏に回した端末の時間は数えない
 *     (開きっぱなしで一晩置かれると、数字が意味を失う)
 *   ・**1分ごとに送る。** 1回ごとに送ると、通信も行も増えすぎる
 *   ・**回数は、その画面で1回だけ**数える(開いた回数であって、
 *     問題を解いた回数ではない)
 *   ・**長すぎるものは切る。** 1回に足せるのは1時間まで(DB 側でも切る)
 *
 * 【記録するのはゲストだけ】
 *   トレーナーも同じ画面を使う(教材の下見・トレーナー自身の学習)。
 *   数えても害はない(`learner_practice()` はゲストだけを返す)が、
 *   **要らないものは送らない。**
 *
 * 【貼る前でも壊れない】
 *   0022 がまだなら、**静かに何もしない。** 記録が付かないだけで、
 *   宿題も単語帳もこれまでどおり動く(第5.23節)。
 */
import { useEffect, useRef } from 'react'
import { supabase } from './supabase.js'
import { viewerRoleOf } from './viewer.js'

/** 何に取り組んだか。**DB(0022)の `log_practice` と同じ言葉を使う** */
export const PRACTICE_KINDS = {
  homework: '今週の宿題',
  six_steps: '6Steps',
  quick_response: 'Quick Response',
  wordbook: '単語帳',
  pronunciation: '発音練習',
}

/** 何秒ごとに送るか。短くすると通信が増え、長くすると閉じたときに取りこぼす */
const FLUSH_MS = 60_000

/** 0022 がまだ無いと分かったら、その画面のあいだは呼ばない */
let missing = false

const looksMissing = (error) => {
  const text = `${error?.message ?? ''} ${error?.details ?? ''} ${error?.hint ?? ''}`
  return error?.code === 'PGRST202' || /could not find|does not exist|schema cache/i.test(text)
}

/**
 * 取り組みを足す。**失敗しても画面には何も出さない。**
 * 記録は本筋ではないので、これで練習が止まってはいけない。
 */
export async function logPractice(kind, seconds = 0, times = 0) {
  if (!supabase || missing) return
  if (!PRACTICE_KINDS[kind]) return
  const s = Math.round(Math.max(0, seconds))
  const t = Math.max(0, Math.round(times))
  if (!s && !t) return

  const { error } = await supabase.rpc('log_practice', {
    p_kind: kind, p_seconds: s, p_times: t,
  })
  if (error && looksMissing(error)) {
    missing = true
    // **黙って落とさない。** 何が足りないのかは残しておく
    console.warn('取り組みの記録(0022)がまだありません。'
      + 'GitHub のリポジトリにある supabase/apply/pending_2026-08-29.sql を'
      + 'Supabase の SQL Editor で実行すると、トレーナー側に反映されます')
  }
}

/**
 * その画面にいるあいだ、取り組みを数える。**画面で1回だけ呼ぶ。**
 *
 * @param {string} kind    PRACTICE_KINDS のどれか
 * @param {boolean} active 数えるかどうか(開いているタブだけ数えたいときに使う)
 */
export function usePracticeLog(kind, active = true) {
  const since = useRef(null)    // いま数え始めた時刻
  const counted = useRef(false) // 回数をもう1つ数えたか

  useEffect(() => {
    // **ゲストのぶんだけ数える。** 要らないものは送らない
    if (!active || !supabase || viewerRoleOf() !== 'learner') return undefined

    const start = () => { if (since.current == null) since.current = Date.now() }
    /** いままで数えた秒を送って、時計を戻す */
    const flush = (stop) => {
      if (since.current == null) return
      const sec = (Date.now() - since.current) / 1000
      since.current = stop ? null : Date.now()
      // 5秒に満たないものは送らない。開いてすぐ閉じただけである
      if (sec < 5) return
      const first = !counted.current
      counted.current = true
      logPractice(kind, sec, first ? 1 : 0)
    }

    start()
    const timer = window.setInterval(() => flush(false), FLUSH_MS)
    // **見えている時間だけ数える。** 裏に回したら止め、戻ったら再開する
    const onVisible = () => {
      if (document.visibilityState === 'hidden') flush(true)
      else start()
    }
    document.addEventListener('visibilitychange', onVisible)
    // 画面を閉じる・別のページへ行くときの取りこぼしを減らす
    window.addEventListener('pagehide', () => flush(true))

    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      flush(true)
    }
  }, [kind, active])
}

// ── トレーナー側から読む / 送る ────────────────────────────────

const ok = (data) => ({ data, error: null })
const ng = (error) => ({ data: null, error })
const fail = (e, fallback) => ng(e?.message ? `${fallback}: ${e.message}` : fallback)

/** 0022 がまだのときは、**空を返して静かに終わる**(画面は壊れない) */
const notYet = (error) => looksMissing(error) || /relation .* does not exist/i.test(error?.message ?? '')

/**
 * 担当ゲストの取り組みを、1人1行でまとめて読む(トレーナー)。
 * **数え方は DB(`learner_practice`)に置いてある。** 画面に持たない。
 */
export async function loadLearnerPractice(days = 14) {
  if (!supabase) return ok([])
  const { data, error } = await supabase.rpc('learner_practice', { p_days: days })
  if (error) {
    if (notYet(error)) return ok([])
    return fail(error, '取り組みを読めませんでした')
  }
  return ok((data ?? []).map((r) => ({
    learnerId: r.learner_id,
    name: r.display_name,
    lastOn: r.last_on,
    days: r.days ?? 0,
    times: r.times ?? 0,
    seconds: r.seconds ?? 0,
    kinds: r.kinds ?? {},
  })))
}

/**
 * リマインドを送る。**トレーナーが押したときだけ呼ばれる。**
 * 自動では送らない(2026-08 利用者の指定)。だからゲストの画面に
 * 「トレーナーから」と出しても嘘にならない。
 */
export async function sendReminder(learnerId, message = '') {
  if (!supabase) return ng('Supabase が設定されていません')
  const { data, error } = await supabase.rpc('send_reminder', {
    p_learner_id: learnerId, p_message: message || null,
  })
  if (error) {
    if (notYet(error)) {
      return ng('リマインドの置き場(0022)が、まだ Supabase にありません。'
        + ' GitHub のリポジトリにあるファイル(supabase/apply/pending_2026-08-29.sql)を、'
        + 'Supabase の 左メニュー「SQL Editor」で実行してからお試しください。')
    }
    return fail(error, 'リマインドを送れませんでした')
  }
  return ok(data)
}

/** 自分あての、まだ見ていないリマインド(ゲスト) */
export async function loadMyReminder() {
  if (!supabase) return ok(null)
  const { data, error } = await supabase
    .from('reminders')
    .select('id, sent_at, message, seen_at')
    .is('seen_at', null)
    .order('sent_at', { ascending: false })
    .limit(1)
  if (error) {
    if (notYet(error)) return ok(null)
    return fail(error, 'お知らせを読めませんでした')
  }
  return ok(data?.[0] ?? null)
}

/** 見たことを残す。**ゲストが変えられるのはここだけ**(列単位の grant) */
export async function markReminderSeen(id) {
  if (!supabase || !id) return ok(null)
  const { error } = await supabase.rpc('seen_reminder', { p_id: id })
  if (error && !notYet(error)) return fail(error, 'お知らせを閉じられませんでした')
  return ok(true)
}

/** 「◯日前 / 3日 12回 45分」の1行にする。**数え方は DB、言い方はここ** */
export function practiceLine(row) {
  if (!row || !row.lastOn) return 'アプリでの取り組み: まだありません'
  const days = Math.round((Date.now() - new Date(`${row.lastOn}T00:00:00`).getTime()) / 86400000)
  const when = days <= 0 ? '今日' : days === 1 ? 'きのう' : `${days} 日前`
  const min = Math.round((row.seconds ?? 0) / 60)
  const kinds = Object.entries(row.kinds ?? {})
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `${PRACTICE_KINDS[k] ?? k} ${n}`)
    .join(' / ')
  return `最後は ${when} ・ 2週間で ${row.days} 日 ${row.times} 回 ${min} 分`
    + (kinds ? ` ・ ${kinds}` : '')
}
