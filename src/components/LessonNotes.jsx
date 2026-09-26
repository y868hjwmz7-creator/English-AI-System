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
 * 【ゲストも書ける。ただし**自分の欄**だけ】(0070・第5.267節)
 *
 *   > ゲストログインしたさいの「セッションの記録」を、
 *   > ゲストも入力、編集できるようにしたいです。
 *   > 同時に書いても大丈夫なようにしてください。(2026-09-26 利用者の指定)
 *
 *   **欄は2つ。** トレーナーの記録(`body`)と、ゲストの記録(`learner_body`)。
 *   お互いの欄は読めるが、**書けるのは自分の欄だけ**なので、
 *   同時に書いても、どちらも消えない。
 *
 *   決まりは 0032 の RLS と 0070 の `set_learner_note()` にある。
 *   ここは出し分けるだけで、**判定を作らない。**
 *
 * 【大きく表示する】(第5.267節・2026-09-26 利用者の指定)
 *
 *   > セッション中にセッションの記録をトレーナーが画面共有しているときに、
 *   > これを画面いっぱい、または半分などに大きくして使用できるように
 *
 *   **骨組みは `FocusFrame`(`plain`)をそのまま使う** ——
 *   教材の「セッションで使う(大きく表示)」と同じものである。
 *   幅の一覧も `sheetWidths.js` 1か所(**半分**から画面いっぱいまで)。
 *
 * 【カレンダーは `CalendarPopover` を使う】
 *   出す場所の決め方も閉じ方も、どの吹き出しでも同じである
 *   (**同じ決まりを2か所に持たない**・CLAUDE.md)。
 *   ただし単語帳と違い、**書いていない日も押せる**(`anyDay`)。
 *   これから書く日を選べないと、その日のメモが作れない。
 */
import { useEffect, useRef, useState } from 'react'
import { loadNote, loadNoteDays, saveLearnerNote, saveNote } from '../lib/lessonNotes.js'
import { shortDate, toDateKey, today } from '../lib/format.js'
import { getSession } from '../lib/auth.js'
import { viewerRoleOf } from '../lib/viewer.js'
import CalendarPopover from './CalendarPopover.jsx'
/* **大きく表示**(第5.267節)。教材の「セッションで使う」と同じ骨組み */
import FocusFrame from './FocusFrame.jsx'
import Stepper from './Stepper.jsx'
import { ScreenIcon } from './Icons.jsx'
import { NOTE_WIDTHS, widthOf } from '../data/sheetWidths.js'

/** 大きく表示したときの幅。**覚える**(一度決めれば毎回は触らない) */
const BIG_KEY = 'eas.noteBigWidth'
const loadBigW = () => {
  try { return widthOf(window.localStorage.getItem(BIG_KEY), NOTE_WIDTHS) } catch { return 'w100' }
}
const saveBigW = (id) => {
  try { window.localStorage.setItem(BIG_KEY, String(id)) } catch { /* 使えなくても困らない */ }
}

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
  /**
   * **選んでいる日を、呼ぶ側にも知らせる**(第5.219節)。
   *
   * 「今週の宿題」は、その日にアサインされた教材とその日に印を付けた語を
   * 並べて出す。**その判断は呼ぶ側が持つ** —— ここは日付を選ぶ道具で
   * あって、宿題のことを知らない(**判断を2か所に置かない**)。
   */
  onDate = null,
}) {
  /* **書けるのはトレーナーと管理者だけ**(0032)。
     役割は `viewer.js` に1つだけ置いてある。**判定をここに作らない。**
     「担当しているゲストか」までは RLS が見るので、画面では見ない
     (窓口と画面の2か所に判定を置かない・CLAUDE.md) */
  const canWrite = viewerRoleOf() === 'trainer' || viewerRoleOf() === 'owner'
  const [me, setMe] = useState(null)
  /* **ゲストは、自分の記録だけ書ける**(0070・第5.267節)。
     「自分の記録か」はここで見るしかない —— ほかの人の記録を開いている
     ときは書けない。**書けるかどうかの最後の砦は関数の中**である
     (`set_learner_note()` が `auth.uid()` の行しか触らない) */
  const canWriteMine = !!me && me === learnerId
  const [date, setDate] = useState(today)
  const [body, setBody] = useState('')
  /** ゲストの記録(`learner_body`)。**トレーナーの欄とは別に持つ** */
  const [mine, setMine] = useState('')
  /** 大きく表示しているか(第5.267節)と、そのときの幅 */
  const [big, setBig] = useState(false)
  const [bigW, setBigW] = useState(loadBigW)
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
  /* **ゲストの欄も、同じ作法で控える。** 入れ物を分けるのは、
     2つの欄が**別々の間合いで**送られるからである
     (1つにすると、あとから書いたほうが前のぶんを消す) */
  const myTimer = useRef(null)
  const myPending = useRef(null)
  const meRef = useRef(null)
  meRef.current = me

  useEffect(() => { getSession().then((s) => setMe(s?.user?.id ?? null)) }, [])

  /* **選んでいる日を知らせる。** 開いた時点でも1回知らせるので、
     呼ぶ側は「まだ何も選ばれていない」を考えなくてよい */
  useEffect(() => { onDate?.(date) }, [date])

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
    /* **ゲストの書きかけも、同じように送り切る**(第5.267節)。
       片方だけ送ると、日を変えただけで消える */
    if (myPending.current) {
      window.clearTimeout(myTimer.current)
      saveLearnerNote(myPending.current)
      myPending.current = null
    }
    ready.current = false
    setLoading(true)
    setError('')
    setState('')
    loadNote(learnerId, date).then(({ data, error: e }) => {
      if (!alive) return
      if (e) setError(e)
      setBody(data?.body ?? '')
      /* **0070 を貼る前は、この欄そのものが無い。**
         そのときは空のまま —— 画面は壊れず、ゲストの欄が出ないだけである */
      setMine(data?.learner_body ?? '')
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

  /**
   * **ゲストが、自分の欄を書く**(0070・第5.267節)。
   *
   * **間合いも作法も、トレーナーの欄とまったく同じ。**
   * ちがうのは送り先だけで、`set_learner_note()` は
   * **トレーナーの欄(`body`)に触らない** —— だから同時に書いても消えない。
   */
  const editMine = (text) => {
    setMine(text)
    if (!canWriteMine || !ready.current) return
    setState('書いています…')
    myPending.current = { dateKey: date, body: text }
    window.clearTimeout(myTimer.current)
    myTimer.current = window.setTimeout(async () => {
      const { error: e } = await saveLearnerNote(myPending.current)
      myPending.current = null
      if (e) { setError(e); setState(''); return }
      setError('')
      setState('保存しました')
      setWrote(new Date().toISOString())
      /* カレンダーの印も合わせる。**両方の欄が空になったときだけ消える**
         (決まりは `set_learner_note()` の中・数え方を2通り持たない) */
      setDays((list) => {
        const has = list.includes(date)
        const any = text.trim() || body.trim()
        if (any && !has) return [date, ...list]
        if (!any && has) return list.filter((d) => d !== date)
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
    /* **ゲストの書きかけも送り切る**(第5.267節)。
       片方だけだと、閉じただけで消える */
    window.clearTimeout(myTimer.current)
    if (myPending.current) {
      saveLearnerNote(myPending.current)
      myPending.current = null
    }
  }, [])

  const isToday = date === today()

  /**
   * **欄1つぶん。** 書ける人には書く欄を、そうでない人には読む欄を出す。
   *
   * **2つの欄で、形を変えない**(トレーナーの記録 / ゲストの記録)——
   * 別々に書くと、片方だけ古くなる(CLAUDE.md)。
   */
  const 欄 = (what, value, canEdit, onEdit, hint) => (
    <div className="notes-one" key={what}>
      <p className="field-label">{what}</p>
      {canEdit ? (
        <textarea
          className="notes-board"
          value={value}
          onChange={(e) => onEdit(e.target.value)}
          placeholder={hint}
          aria-label={`${withWeek(date)} の${what}`}
        />
      ) : value.trim() ? (
        /* **改行はそのまま出す**(白い紙と同じ見え方) */
        <div className="notes-read">{value}</div>
      ) : (
        <p className="muted">まだありません。</p>
      )}
    </div>
  )

  /* ── 中身。**大きく表示でも、ふだんの画面でも同じものを出す** ──────
       書き写すと、片方だけ古くなる(CLAUDE.md) */
  const 中身 = (
    <>
      {/* ── どの日か ────────────────────────────────────────
          **日付は、いちばん上に大きく出す。** どの日の記録を書いて
          いるのか分からないまま書かせない */}
      <div className="notes-bar">
        <button type="button" className="btn btn--ghost btn--small"
                aria-label="前の日" onClick={() => setDate((d) => shift(d, -1))}>‹</button>
        {/* **白い箱を新しく作らない**(2026-09 利用者の指定・共通ルール)。
            既にある形から選ぶ —— ここは「ならぶもの」なので灰
            (`btn--quiet`)。両どなりの ‹ › は枠線だけ */}
        <button type="button" className="btn btn--small btn--quiet notes-date"
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
        {/* **大きく表示**(第5.267節・2026-09-26 利用者の指定)。
            画面共有のときに、記録そのものを大きくして使う。
            **大きくしている最中は出さない** —— 中には「閉じる」がある
            (同じことをするものを2つ見せない・CLAUDE.md) */}
        {!bare && !big && (
          <button type="button" className="btn btn--small btn--ghost"
                  onClick={() => setBig(true)}>
            <ScreenIcon />大きく表示
          </button>
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
      ) : (
        /* ── **欄は2つ**(0070・第5.267節)──────────────────
             トレーナーの記録とゲストの記録。**書けるのは自分の欄だけ**
             なので、同時に書いても、どちらも消えない。

             **ゲストの欄は、書ける人か、もう何か書いてあるときだけ出す。**
             読むだけの人に空の欄を見せても、できることが何も無い
             (**効かない操作を見せない**・CLAUDE.md)。 */
        <div className="notes-fields">
          {欄('トレーナーの記録', body, canWrite, edit,
            'この日のセッションのこと。\n'
            + '・つまずいたところ\n・次までにやってもらうこと\n・次回すること')}
          {(canWriteMine || mine.trim()) && 欄(
            'ゲストの記録', mine, canWriteMine, editMine,
            '気づいたこと・聞きたいこと・次までにやること',
          )}
        </div>
      )}

      {wrote && (
        <p className="muted notes-foot">
          最後に書かれたのは {shortDate(String(wrote).slice(0, 10))}
        </p>
      )}
    </>
  )

  /* ── **大きく表示**(第5.267節)────────────────────────────
       骨組みは `FocusFrame`(`plain`)—— 教材の「セッションで使う」と
       まったく同じものである(**書き写さない**・CLAUDE.md)。
       幅は `sheetWidths.js` の一覧から選ぶ(**半分**から画面いっぱいまで)。 */
  if (big) {
    return (
      <FocusFrame
        className="notesbig"
        plain
        width={bigW}
        learnerId={learnerId}
        page="notes"
        onClose={() => setBig(false)}
        top={(
          <Stepper label="幅" options={NOTE_WIDTHS} value={bigW}
                   className="lesson-widths"
                   onChange={(id) => { setBigW(id); saveBigW(id) }} />
        )}
      >
        <div className="stack notes notes--big">
          <h3 className="card-title">
            セッションの記録{learnerName ? `(${learnerName} さん)` : ''}
          </h3>
          {中身}
        </div>
      </FocusFrame>
    )
  }

  return (
    <div className="stack notes">
      {!bare && (
        <h3 className="card-title">
          セッションの記録{learnerName ? `(${learnerName} さん)` : ''}
        </h3>
      )}
      {中身}
    </div>
  )
}
