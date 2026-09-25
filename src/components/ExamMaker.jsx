/**
 * ============================================================================
 * **ゲストの持ちものから、テストを作る**(第5.260節)
 *
 * 2026-09-25 利用者の指定。
 *
 *   > ゲストのページに教材や彼らの単語帳、quick response 帳があります。
 *   > それらのデータを基にテストを作りたいです。
 *
 * 利用者の答え(その場で訊いた)。
 *
 *   ・出どころは **都度えらぶ。複数同時にえらべる**
 *   ・形は **日本語 → 英語 と 穴埋めを混ぜる**
 *   ・**画面と紙の両方**
 *   ・**AI は使わない(0円)**
 *
 * 【新しい表も、新しい SQL も要らない】
 *   テストは**残さない。** 作って、見て、刷るだけである。
 *   残す形にすると表が1つ増え、貼る SQL が増え、
 *   「いつのテストか」を管理する画面まで要る ——
 *   **言われた範囲を超える**(勝手に広げない・CLAUDE.md)。
 *
 * 【自分では組まない・自分では引かない】
 *   組むのは `examBuild.js`(**素の node で確かめられる**)、
 *   引いてくるのは `examSources.js`、紙は `ExamSheet`。
 *   ここは**つなぐだけ**である。
 *
 * 【画面と紙は、同じ問題を出す】
 *   **組むのは1回だけ**で、画面も紙も**同じ `items`** を見る。
 *   押すたびに組み直すと、画面で見た問題と紙の問題が食い違う
 *   (**数え方を2通り持たない**・CLAUDE.md)。
 * ============================================================================
 */
import { useState } from 'react'
import {
  DEFAULT_EXAM_COUNT, DEFAULT_EXAM_FORM, EXAM_COUNTS, EXAM_FORMS, EXAM_SOURCES,
  buildExam, examCountNote, examNote, examTitle,
} from '../lib/examBuild.js'
import { loadExamRows } from '../lib/examSources.js'
import { SHEET_ID, usePrintSheet } from '../lib/printSheet.js'
import { today } from '../lib/format.js'
import ExamSheet from './ExamSheet.jsx'

export default function ExamMaker({ learnerId, learnerName = '', materials = [] }) {
  /* **出どころは複数。既定は「単語帳」と「Quick Response 帳」** ——
     この2つは問い合わせ1回ずつで済み、教材のえらび直しが要らない */
  const [sources, setSources] = useState(['word', 'qr'])
  const [picked, setPicked] = useState([])          // どの教材から引くか
  const [count, setCount] = useState(DEFAULT_EXAM_COUNT)
  const [form, setForm] = useState(DEFAULT_EXAM_FORM)
  const [items, setItems] = useState([])
  const [said, setSaid] = useState('')
  const [warn, setWarn] = useState('')
  const [busy, setBusy] = useState(false)
  const [printing, setPrinting] = useState(false)

  const title = examTitle(learnerName, today())
  usePrintSheet(printing, () => setPrinting(false))

  const toggle = (list, id) =>
    (list.includes(id) ? list.filter((x) => x !== id) : [...list, id])

  /**
   * **テストを組む。AI は1回も呼ばない(0円)。**
   * もう入っているものを読んで、並べ替えるだけである。
   */
  const make = async () => {
    if (busy) return
    setBusy(true); setSaid(''); setWarn('')
    try {
      const { rows, failed } = await loadExamRows(learnerId, {
        sources, materialIds: picked,
      })
      const got = buildExam(rows, { count, form })
      setItems(got)
      setSaid(examNote(got.length, count, sources))
      /* **黙って絞らない**(CLAUDE.md)。読めなかった出どころがあれば、
         問題数が少ない理由をその場で言う */
      if (failed.length) setWarn(`${failed.join(' / ')} を読めませんでした`)
    } catch {
      setItems([])
      setWarn('テストを作れませんでした')
    } finally {
      setBusy(false)
    }
  }

  /* **教材をえらんだのに1本も選んでいない**、は行き止まりである */
  const 足りない = sources.length === 0
    || (sources.includes('material') && picked.length === 0 && sources.length === 1)

  return (
    <div className="card card--form exammaker">
      <div className="exammaker-pick">
        <span className="nav-setting-label">どこから出すか</span>
        <div className="theme-switch" role="group" aria-label="どこから出すか">
          {EXAM_SOURCES.map((s) => (
            <button key={s.id} type="button" title={s.hint}
                    className={`theme-btn${sources.includes(s.id) ? ' is-active' : ''}`}
                    aria-pressed={sources.includes(s.id)}
                    onClick={() => { setSources(toggle(sources, s.id)); setSaid('') }}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* **教材は「どれから」まで選ぶ。** 宿題は何十本もあるので、
          全部読むとその数だけ往復する(しかも問題が散らばる)。
          **えらべる教材が1本も無ければ、欄そのものを出さない**
          —— 押せるのに何も起きない、を作らない */}
      {sources.includes('material') && (
        materials.length === 0 ? (
          <p className="field-hint">この人に出してある教材がまだありません。</p>
        ) : (
          <div className="exammaker-pick">
            <span className="nav-setting-label">どの教材から({picked.length} 本)</span>
            <div className="exammaker-list">
              {materials.map((m) => (
                <button key={m.id} type="button"
                        className={`theme-btn${picked.includes(m.id) ? ' is-active' : ''}`}
                        aria-pressed={picked.includes(m.id)}
                        onClick={() => { setPicked(toggle(picked, m.id)); setSaid('') }}>
                  {m.title}
                </button>
              ))}
            </div>
          </div>
        )
      )}

      <div className="exammaker-pick">
        <span className="nav-setting-label">出し方</span>
        <div className="theme-switch" role="group" aria-label="出し方">
          {EXAM_FORMS.map((f) => (
            <button key={f.id} type="button" title={f.hint}
                    className={`theme-btn${form === f.id ? ' is-active' : ''}`}
                    onClick={() => { setForm(f.id); setSaid('') }}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="exammaker-pick">
        <span className="nav-setting-label">何問</span>
        <div className="theme-switch" role="group" aria-label="何問">
          {EXAM_COUNTS.map((n) => (
            <button key={n} type="button"
                    className={`theme-btn${count === n ? ' is-active' : ''}`}
                    onClick={() => { setCount(n); setSaid('') }}>
              {n} 問
            </button>
          ))}
        </div>
      </div>

      <div className="btn-row">
        <button type="button" className="btn btn--primary"
                disabled={busy || 足りない} onClick={make}>
          {busy ? '作っています…' : 'テストを作る'}
        </button>
        {/* **刷れるのは、問題があるときだけ**(効かない操作を見せない) */}
        {items.length > 0 && (
          <button type="button" className="btn btn--ghost"
                  disabled={printing} onClick={() => setPrinting(true)}>
            {printing ? '紙にしています…' : '印刷 / PDFで保存'}
          </button>
        )}
      </div>

      {/* **失敗の知らせは、その操作をした場所に出す**(CLAUDE.md) */}
      {warn && <p className="notice notice--warn">{warn}</p>}
      {said && <p className="field-hint">{said}</p>}

      {/* ── 画面に出す ──────────────────────────────────
          **紙とまったく同じ問題**である(組むのは1回だけ) */}
      {items.length > 0 && (
        <>
          <p className="field-hint">{examCountNote(items)}</p>
          <ol className="exammaker-quiz">
            {items.map((q) => (
              <li key={q.no}>
                <span className={`exammaker-q${q.form === 'blank' ? ' exammaker-q--en' : ''}`}
                      {...(q.form === 'blank' ? { lang: 'en' } : {})}>
                  {q.question}
                </span>
                {/* **答えは畳んでおく。** 開いたまま並べると、
                    画面で見ながら解けない */}
                <details className="exammaker-ans">
                  <summary>答え</summary>
                  <div className="exammaker-ans-body">
                    <span lang="en">{q.answer}</span>
                    {q.form === 'blank' && (
                      <span className="exammaker-full" lang="en">{q.en}</span>
                    )}
                    {q.from && <span className="exammaker-from">{q.from}</span>}
                  </div>
                </details>
              </li>
            ))}
          </ol>
        </>
      )}

      {/* **紙は、押されてから描く**(`usePrintSheet` が描き終わってから刷る)。
          ふだんは `.print-only` が隠している */}
      {printing && (
        <ExamSheet title={title} note={examCountNote(items)} items={items} />
      )}
      {/* 紙の出し先。**id は `printSheet.js` 1か所が持つ** */}
      {!printing && <div id={SHEET_ID} hidden />}
    </div>
  )
}
