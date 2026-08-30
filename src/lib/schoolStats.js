/**
 * 集計(管理者だけが見る)。**数え方は DB(0023)に置いてある。**
 *
 * 【なぜ作り直したか】(2026-08 利用者の指定)
 *
 *   > 集計だけは残してください。しかし今のままでは見にくすぎるので、
 *   > 教材の種類と内容に準じたものに変えてください。
 *
 *   前の集計は **ゲストが自分で入力した学習時間**(`study_logs`)の上に
 *   立っていた。その入力欄は 0022 の設計変更で無くなっている。
 *   **入らなくなった数字を並べ続けると、いつまでも 0 のグラフが出る。**
 *
 *   いまは「教材の種類 / 弱点 / レベル」と「裏で数えた取り組み」で数える。
 *
 * 【画面に数え方を持たない】
 *   合計も割合も DB が返す。画面で足し直すと、期間の切り方や
 *   端末の時差で食い違う(`practice.js` と同じ考え方)。
 *
 * 【貼る前でも壊れない】
 *   0023 がまだなら **空を返して静かに終わる。** 画面は「まだです」と出す。
 */
import { supabase } from './supabase.js'

const ok = (data) => ({ data, error: null })
const ng = (error) => ({ data: null, error })

/** 0023 がまだ Supabase に入っていないときの断り方 */
const notYet = (error) => {
  const text = `${error?.message ?? ''} ${error?.details ?? ''} ${error?.hint ?? ''}`
  return error?.code === 'PGRST202'
    || /could not find|does not exist|schema cache/i.test(text)
}

/** 集計に使える期間。**短すぎると教材の傾向が見えない** */
export const STAT_RANGES = [
  { id: 30, label: '直近30日' },
  { id: 90, label: '直近90日' },
  { id: 365, label: '直近1年' },
]

/** 「まだ貼っていません」を、画面がそのまま出せる形で返す */
export const NOT_APPLIED = 'notYet'

const call = async (fn, args) => {
  if (!supabase) return ng('unset')
  const { data, error } = await supabase.rpc(fn, args)
  if (error) return ng(notYet(error) ? NOT_APPLIED : error.message)
  return ok(data ?? [])
}

/**
 * 集計に要るものを**まとめて1回で**読む。
 * 画面から4回呼び分けると、期間を変えるたびに順番待ちが起きる。
 */
export async function loadSchoolStats(days = 30) {
  if (!supabase) return ng('unset')
  const from = new Date(Date.now() - (days - 1) * 86400000)
    .toISOString().slice(0, 10)
  const to = new Date().toISOString().slice(0, 10)

  const [summary, byKind, byTag, byLevel, practice] = await Promise.all([
    call('school_summary', { from_date: from, to_date: to }),
    call('school_by_kind', { p_days: days }),
    call('school_by_tag', { p_days: days }),
    call('school_by_level', { p_days: days }),
    call('school_practice', { p_days: days }),
  ])

  const first = [summary, byKind, byTag, byLevel, practice].find((r) => r.error)
  if (first) return ng(first.error)

  return ok({
    summary: summary.data?.[0] ?? null,
    byKind: (byKind.data ?? []).map((r) => ({
      kind: r.kind,
      materials: r.materials ?? 0,
      fresh: r.fresh ?? 0,
      items: r.items ?? 0,
      assigned: r.assigned ?? 0,
      done: r.done ?? 0,
    })),
    byTag: (byTag.data ?? []).map((r) => ({
      tagId: r.tag_id,
      label: r.label,
      category: r.category,
      materials: r.materials ?? 0,
      assigned: r.assigned ?? 0,
      done: r.done ?? 0,
    })),
    byLevel: (byLevel.data ?? []).map((r) => ({
      level: r.level,
      materials: r.materials ?? 0,
      learners: r.learners ?? 0,
    })),
    practice: (practice.data ?? []).map((r) => ({
      kind: r.kind,
      learners: r.learners ?? 0,
      times: r.times ?? 0,
      seconds: r.seconds ?? 0,
    })),
  })
}

/** 割合(%)。**0 で割らない。** 母数が 0 のときは null(「—」と出す) */
export const rateOf = (part, whole) => (whole ? Math.round((part / whole) * 100) : null)
