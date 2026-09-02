/**
 * セッションの記録(メモ)。日付ごとの、ただの白い紙(0032)。
 *
 * 2026-09 利用者の指定:
 *   > トレーニング中、または個々のゲストの情報内でセッションに関する記録や
 *   > メモをするためのフリーボード、例えばワードのようなものを呼び出せると
 *   > 嬉しいですね。それはカレンダーと同期して呼び出せるものだと嬉しいです。
 *
 * 【書式は持たない】
 *   見出しも太字も持たない。**改行だけがある白い紙**にする。
 *   ワードのような書式を持たせると、書式を保つ仕組みそのものが
 *   壊れどころになる。読むのは人であって、機械ではない。
 *
 * 【押して保存させない】
 *   レッスン中に書くものである。**「保存」を押し忘れて消える**のが
 *   いちばん困る。書き終えて 1.2 秒だまったら、こちらで送る
 *   (途中経過 `useProgress`(0025)と同じ間合い)。
 *   **読み終わる前に送らない。** 空で上書きしてしまう。
 *
 * 【ゲストにも見せる】(2026-09 利用者の判断)
 *   ゲスト本人は**読めるが、書けない。** 決まりは 0032 の RLS にある。
 *   ここは `canWrite` で出し分けるだけで、**判定を作らない。**
 *
 * 【カレンダーは `CalendarPopover` を使う】
 *   出す場所の決め方も閉じ方も、どの吹き出しでも同じである
 *   (**同じ決まりを2か所に持たない**・CLAUDE.md)。
 *   ただし単語帳と違い、**書いていない日も押せる**(`anyDay`)。
 *   これから書く日を選べないと、その日のメモが作れない。
 */
import { useEffect, useRef, useState } from 'react'
import { loadNote, loadNoteDays, saveNote } from '../lib/lessonNotes.js'
import { shortDate, toDateKey, today } from '../lib/format.js'
import { getSession } from '../lib/auth.js'
import { viewerRoleOf } from '../lib/viewer.js'
import CalendarPopover from './CalendarPopover.jsx'

/** 日付を1日ずらす */
const shift = (key, days) => {
  const d = new Date(`${key}T00:00:00`)
  d.setDate(d.getDate() + days)
  return toDateKey(d)
}

const WEEK = ['日', '月', '火', '水', '木', '金', '土']
const withWeek = (key) => {
  const d = new Date(`${key}T00:00:00`)
  return `${shortDate(key)}(${WEEK[d.getDay()]})`
}

export default function LessonNotes({
  /** 誰のセッションの記録か */
  learnerId,
  learnerName = '',
  /** レッスン表示の中に出すときは、見出しを出さない */
  bare = false,
}) {
  /* **書けるのはトレーナーと管理者だけ**(0032)。
     役割は `viewer.js` に1つだけ置いてある。**判定をここに作らない。**
     「担当しているゲストか」までは RLS が見るので、画面では見ない
     (窓口と画面の2か所に判定を置かない・CLAUDE.md) */
  const canWrite = viewerRoleOf() === 'trainer' || viewerRoleOf() === 'owner'
  const [me, setMe] = useState(null)
  const [date, setDate] = useState(today)
  const [body, setBody] = useState('')
  const [days, setDays] = useState([])
  const [loading, setLoading] = useState(true)
  const [state, setState] = useState('')      // 「書いています…」「保存しました」
  const [error, setError] = useState('')
  const [wrote, setWrote] = useState(null)    // 最後に書かれた時刻
  const [calAt, setCalAt] = useState(null)

  /* **読み終わるまで送らない。** 読み込みの途中で `body` が変わると、
     まだ空のままの中身でサーバーを上書きしてしまう(0025 と同じ落とし穴) */
  const ready = useRef(false)
  const timer = useRef(null)
  /* まだ送っていない書きかけ。**閉じるときに、これを送り切る。**
     待ち時間の途中で閉じただけで書いたものが消えるのでは、
     「保存」を押させないようにした意味がない */
  const pending = useRef(null)
  const meRef = useRef(null)
  meRef.current = me

  useEffect(() => { getSession().then((s) => setMe(s?.user?.id ?? null)) }, [])

  // その日の1枚を読む。**日付が変わったら読み直す**
  useEffect(() => {
    let alive = true
    /* **日を変える前に、書きかけを送り切る。**
       控えには書いていた日が入っているので、行き先を間違えない */
    if (pending.current) {
      window.clearTimeout(timer.current)
      saveNote({ ...pending.current, updatedBy: meRef.current })
      pending.current = null
    }
    ready.current = false
    setLoading(true)
    setError('')
    setState('')
    loadNote(learnerId, date).then(({ data, error: e }) => {
      if (!alive) return
      if (e) setError(e)
      setBody(data?.body ?? '')
      setWrote(data?.updated_at ?? null)
      setLoading(false)
      ready.current = true
    })
    return () => { alive = false }
  }, [learnerId, date])

  // カレンダーの印(書いてある日)
  useEffect(() => {
    let alive = true
    loadNoteDays(learnerId).then(({ data }) => { if (alive) setDays(data) })
    return () => { alive = false }
  }, [learnerId])

  /* 書き終えて 1.2 秒だまったら送る。**押して保存させない** */
  const edit = (text) => {
    setBody(text)
    if (!canWrite || !ready.current) return
    setState('書いています…')
    pending.current = { learnerId, dateKey: date, body: text }
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(async () => {
      const { error: e } = await saveNote({ ...pending.current, updatedBy: meRef.current })
      pending.current = null
      if (e) { setError(e); setState(''); return }
      setError('')
      setState('保存しました')
      setWrote(new Date().toISOString())
      // カレンダーの印も合わせる(空にしたら消える)
      setDays((list) => {
        const has = list.includes(date)
        if (text.trim() && !has) return [date, ...list]
        if (!text.trim() && has) return list.filter((d) => d !== date)
        return list
      })
    }, 1200)
  }

  /* **閉じるとき・日を変えるときは、書きかけを送り切る。**
     1.2 秒を待たずに閉じただけで消えるのでは、書いた人には
     「押しても何も起きない」のと同じに見える。
     戻り値は待たない(消えてゆく画面には何も出せない) */
  useEffect(() => () => {
    window.clearTimeout(timer.current)
    if (pending.current) {
      saveNote({ ...pending.current, updatedBy: meRef.current })
      pending.current = null
    }
  }, [])

  const isToday = date === today()

  return (
    <div className="stack notes">
      {!bare && (
        <h3 className="card-title">
          セッションの記録{learnerName ? `(${learnerName} さん)` : ''}
        </h3>
      )}

      {/* ── どの日か ────────────────────────────────────────
          **日付は、いちばん上に大きく出す。** どの日の記録を書いて
          いるのか分からないまま書かせない */}
      <div className="notes-bar">
        <button type="button" className="btn btn--ghost btn--small"
                aria-label="前の日" onClick={() => setDate((d) => shift(d, -1))}>‹</button>
        <button type="button" className="btn btn--small notes-date"
                onClick={(e) => setCalAt(calAt ? null : e.currentTarget)}
                aria-expanded={!!calAt}>
          {withWeek(date)}{isToday ? ' 今日' : ''}
        </button>
        <button type="button" className="btn btn--ghost btn--small"
                aria-label="次の日" onClick={() => setDate((d) => shift(d, 1))}>›</button>
        {!isToday && (
          <button type="button" className="btn btn--ghost btn--small"
                  onClick={() => setDate(today())}>今日へ</button>
        )}
        {/* **書いたかどうかを、そのつど出す。**
            成功と失敗が同じ見た目で終わってはいけない(CLAUDE.md) */}
        <span className="notes-state muted">{state}</span>
      </div>

      {calAt && (
        <CalendarPopover
          anchorEl={calAt} days={days} value={date} anyDay showAll={false}
          onPick={(k) => setDate(k ?? today())} onClose={() => setCalAt(null)} />
      )}

      {error && <div className="notice notice--warn" role="alert">{error}</div>}

      {loading ? (
        <p className="muted">開いています…</p>
      ) : canWrite ? (
        <textarea
          className="notes-board"
          value={body}
          onChange={(e) => edit(e.target.value)}
          placeholder={'この日のセッションのこと。\n'
            + '・つまずいたところ\n・次までにやってもらうこと\n・次回すること'}
          aria-label={`${withWeek(date)} のセッションの記録`}
        />
      ) : body.trim() ? (
        /* ゲストは読むだけ。**改行はそのまま出す**(白い紙と同じ見え方) */
        <div className="notes-read">{body}</div>
      ) : (
        <p className="muted">この日の記録はまだありません。</p>
      )}

      {wrote && (
        <p className="muted notes-foot">
          最後に書かれたのは {shortDate(String(wrote).slice(0, 10))}
        </p>
      )}
    </div>
  )
}
