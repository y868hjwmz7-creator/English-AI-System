/**
 * ============================================================================
 * **ゲストの持ちものから、テストを1本の教材として作る**(第5.263節)
 *
 * 2026-09-25 利用者の指定。
 *
 *   > ゲストのページに教材や彼らの単語帳、quick response 帳があります。
 *   > それらのデータを基にテストを作りたいです。
 *
 * 2026-09-26 実機・利用者の指摘(**作り直した理由**)。
 *
 *   > テストですが、こんなのでは使い物になりません。
 *   > 穴埋め問題の日本語がないのをまず直してください。
 *   > 基本は左に日本語、右に英語です。解答とか入りません。
 *   > その場で答えが見れないとだめです。
 *
 *   訊いたうえでの答え —— **穴埋めをやめて日本語 → 英語だけに**、
 *   そして**テストは、ひとつの教材としてちゃんと作る。**
 *
 * 【前の作りが間違っていた】
 *   「テストは残さない。作って、見て、刷るだけ」と判断したのは
 *   **こちらの都合**だった(表を増やしたくなかった)。
 *   残らないと、次のレッスンで開けず・共有できず・探せない。
 *   **利用者が言った「テスト」は、教材のことだった。**
 *
 * 【新しい画面も、新しい紙も作らない】
 *   作るのは `kind = 'test'` の教材1本である。あとは全部もうある。
 *
 *   | 見たいもの | どこが出すか |
 *   |---|---|
 *   | 画面(その場で答えを見る) | `LessonView` の「解答を見る」 |
 *   | 紙(左=日本語・右=英語) | `QuickResponseSheet`(教材の紙) |
 *   | さがす | トレーナーの「教材」→ 種類「テスト」 |
 *   | ゲストの手元 | 今週の宿題(共有するので) |
 *
 * 【ここは、つなぐだけ】
 *   組むのは `examBuild.js`(**素の node で確かめられる**)、
 *   引いてくるのは `examSources.js`、作るのは `createMaterial()`。
 *
 * 【AI を1回も呼ばない = 0円】
 *   問題は作らない。**すでにある英文と訳の対を組み替えるだけ**である。
 * ============================================================================
 */
import { useState } from 'react'
import {
  DEFAULT_EXAM_COUNT, EXAM_COUNTS, EXAM_KIND, EXAM_SOURCES,
  buildExam, examEmptyNote, examLevel, examMadeText, examSections, examTitle,
} from '../lib/examBuild.js'
import { loadExamRows } from '../lib/examSources.js'
import { assignMaterial, createMaterial } from '../lib/materials.js'
import { today } from '../lib/format.js'

export default function ExamMaker({
  learnerId, learnerName = '', level = null, createdBy = null,
  materials = [], onMade = null,
}) {
  /* **出どころは複数。既定は「単語帳」と「Quick Response 帳」** ——
     この2つは問い合わせ1回ずつで済み、教材のえらび直しが要らない */
  const [sources, setSources] = useState(['word', 'qr'])
  const [picked, setPicked] = useState([])          // どの教材から引くか
  const [count, setCount] = useState(DEFAULT_EXAM_COUNT)
  const [said, setSaid] = useState('')
  const [warn, setWarn] = useState('')
  const [busy, setBusy] = useState(false)

  const toggle = (list, id) =>
    (list.includes(id) ? list.filter((x) => x !== id) : [...list, id])

  /* 押しても何も起きない形は、押せるようにしない(行き止まりを作らない)。
     「教材」だけをえらんで1本も選んでいなければ、引ける英文が無い */
  const つくれる = sources.some((s) => s !== 'material' || picked.length > 0)

  /**
   * **テストを1本の教材にして、そのゲストに共有する。**
   * **AI は1回も呼ばない(0円)** —— もう入っているものを組み替えるだけ。
   */
  const make = async () => {
    if (busy) return
    setBusy(true); setSaid(''); setWarn('')
    try {
      const { rows, failed } = await loadExamRows(learnerId, {
        sources, materialIds: picked,
      })
      const items = buildExam(rows, { count })
      /* **1問もできなかったら、作らない。** 空の教材を残さない。
         **何が足りなかったのかを言う**(黙って落とさない・CLAUDE.md) */
      if (!items.length) {
        setWarn(failed.length
          ? `${failed.join(' / ')} を読めませんでした`
          : examEmptyNote(sources))
        return
      }
      const { data, error } = await createMaterial({
        title: examTitle(learnerName, today()),
        level: examLevel(level),
        kind: EXAM_KIND,
        /* **弱点タグは要らない**(`needsWeakTag()`)。中身はこの人の
           持ちものそのもので、弱点で引くものではない */
        sections: examSections(items),
        createdBy,
        /* **共有の範囲は既定(スクール)のまま。** 別のトレーナーが
           代わりに入ったときも、この人の宿題を開けるようにしておく */
      })
      if (error) { setWarn(error); return }
      /* **作ったら、その人に共有する。** ここまでやらないと
         ゲストの手元に出ない(作っただけでは行き止まりである) */
      const { error: shareError } = await assignMaterial({
        materialId: data.id, learnerIds: [learnerId], assignedBy: createdBy,
      })
      if (shareError) {
        /* **起きたことをそのまま言う。** 教材はできている ——
           「作れませんでした」と言うと、二重に作ることになる */
        setWarn(`テストは作りましたが、共有できませんでした: ${shareError}`)
        return
      }
      setSaid(examMadeText(items.length, count, learnerName))
      /* **読めなかった出どころは、黙って飲み込まない** ——
         問題が少ない理由を、その場で言う(CLAUDE.md) */
      if (failed.length) setWarn(`${failed.join(' / ')} を読めませんでした`)
      /* **次にすることを、その場に1つだけ。** 過去の宿題へ移す ——
         作ったテストが先頭に出るので、そこから開いて刷れる */
      if (onMade) onMade(data.id)
    } catch {
      setWarn('テストを作れませんでした')
    } finally {
      setBusy(false)
    }
  }

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

      {/* **「出し方」の欄は無い**(第5.263節)。問いは日本語 → 英語だけである
          —— 形が1つしか無いものを選ばせない(効かない操作を見せない) */}
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
                disabled={busy || !つくれる} onClick={make}>
          {busy ? '作っています…' : 'テストを作って共有する'}
        </button>
      </div>

      {/* **失敗の知らせは、その操作をした場所に出す**(CLAUDE.md) */}
      {warn && <p className="notice notice--warn">{warn}</p>}
      {said && <p className="field-hint">{said}</p>}
    </div>
  )
}
