/**
 * 集中モードの「書き込む」と「メモ」— **2つの集中モードで分け合う。**
 *
 * ============================================================================
 * 【なぜ要るのか】(2026-09 利用者の指定)
 *
 *   > そして、集中モードでも上部のバーに「書き込む」や「メモ」を
 *   > 配置してください。
 *
 *   集中モードは**1つだけに向き合う場所**である。レッスン中に
 *   「ここに線を引きたい」「いま気づいたことを残したい」と思うのは、
 *   まさにその最中である。ところがこの2つはレッスン表示の帯にしか無く、
 *   **いったん出ないと使えなかった。**
 *
 * 【なぜ部品(hook)にするのか】
 *   集中モードは2つある(`FocusReader` と `StepFocus`)。
 *   同じものを2か所に書くと、**片方だけ古くなる**
 *   (単語帳で `LearnerWordbook` を別に持って踏んだ失敗・CLAUDE.md)。
 *   状態も見た目もここ1か所に置き、**両方の帯へ同じものを渡す。**
 *
 * 【レッスン表示と同じ作法にそろえてある】
 *   - **書き込みのあいだは、帯をまるごと入れ替える**(2段にすると
 *     読むところがそのぶん狭くなる)。**戻る道は必ず先頭に置く**
 *   - **板は送る箱の中に敷く**(`.focus-body`)。外に置くと、
 *     送ったときに線だけが取り残される(会議アプリのペンと同じ失敗)
 *   - **保存しない。** 閉じれば消える板書である。残したいことはメモに書く
 *   - **メモが書けるのは担当トレーナー(と管理者)だけ。**
 *     判定は `viewer.js` の1か所を通す(**ここに作らない**)
 */
import { useState } from 'react'
import InkLayer from './InkLayer.jsx'
import LessonNotes from './LessonNotes.jsx'
import { NoteIcon, PenIcon } from './Icons.jsx'
import { INK_COLORS, INK_TOOLS, INK_WIDTH } from '../data/inkTools.js'
import { viewerRoleOf } from '../lib/viewer.js'

/**
 * @param learnerId 誰のセッションか(無ければメモは出さない)
 * @param page      いま何番目か。**線はここごとに持つ**
 *                  (別の段落の線が重なって出ると訳が分からない)
 * @param bodyRef   送る箱(`.focus-body`)。板はこの中に敷く
 *
 * @returns {{pen, tools, penBar, inkLayer, notesPane}}
 *   `tools`     … 上の帯に置くボタン(書き込む / メモ)
 *   `penBar`    … 書き込み中に、帯とまるごと入れ替える中身
 *   `inkLayer`  … 送る箱の中に敷く板
 *   `notesPane` … 本文の横に並べるメモ(狭い画面では下)
 */
export function useFocusBoard({ learnerId = null, page = 0, bodyRef }) {
  const [pen, setPen] = useState(false)
  const [inkColor, setInkColor] = useState(INK_COLORS[0].color)
  const [inkTool, setInkTool] = useState('pen')
  const [ink, setInk] = useState({})     // 何番目か → 線の配列
  const [notes, setNotes] = useState(false)

  /* **相手がいるときだけ出す。** トレーナーの「教材」画面から開いたときは
     `learnerId` が無い(誰のセッションでもない) */
  const canNote = !!learnerId
    && (viewerRoleOf() === 'trainer' || viewerRoleOf() === 'owner')

  const lines = ink[page] ?? []
  const setLines = (next) => setInk((m) => ({ ...m, [page]: next }))

  const tools = (
    <>
      {/* **狭い画面では絵だけになる**(`.wide-text`)ので、
          読み上げのための名前を必ず添える */}
      <button type="button" className="btn btn--small btn--ghost"
              aria-label="書き込む" onClick={() => setPen(true)}>
        <PenIcon /><span className="wide-text">書き込む</span>
      </button>
      {canNote && (
        <button type="button"
                className={`btn btn--small${notes ? ' btn--primary' : ' btn--ghost'}`}
                aria-label="メモ" aria-pressed={notes}
                onClick={() => setNotes((v) => !v)}>
          <NoteIcon /><span className="wide-text">メモ</span>
        </button>
      )}
    </>
  )

  /* 書き込み中の帯。**レッスン表示の `.lesson-ink` と同じ並び**
     (終える → 道具 → 色 → ひとつ戻す → 全部消す) */
  const penBar = (
    <div className="lesson-ink focus-ink">
      <button type="button" className="btn btn--small btn--primary"
              onClick={() => setPen(false)}>
        <PenIcon /><span className="mid-text">書き込みを終える</span>
      </button>
      <div className="ink-tools" role="group" aria-label="書き込みの道具">
        {INK_TOOLS.map((t) => (
          <button key={t.id} type="button"
                  className={`theme-btn${inkTool === t.id ? ' is-active' : ''}`}
                  aria-pressed={inkTool === t.id}
                  onClick={() => setInkTool(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      {/* **消しゴムのときは色を出さない。** 効かない操作を見せない */}
      {inkTool !== 'eraser' && INK_COLORS.map((c) => (
        <button key={c.id} type="button"
                className={`ink-color${inkColor === c.color ? ' is-on' : ''}`}
                style={{ '--ink-color': c.color }}
                aria-label={`${c.label}で書く`} aria-pressed={inkColor === c.color}
                onClick={() => setInkColor(c.color)} />
      ))}
      <button type="button" className="btn btn--small"
              disabled={!lines.length}
              onClick={() => setLines(lines.slice(0, -1))}>
        ひとつ戻す
      </button>
      <button type="button" className="btn btn--small"
              disabled={!lines.length}
              onClick={() => setLines([])}>
        全部消す
      </button>
    </div>
  )

  const inkLayer = (
    <InkLayer sheetRef={bodyRef} active={pen} color={inkColor}
              tool={inkTool} width={INK_WIDTH}
              strokes={lines} onChange={setLines} />
  )

  const notesPane = (notes && canNote) ? (
    <aside className="lesson-notes no-print" aria-label="セッションの記録">
      <div className="lesson-notes-head">
        <strong>セッションの記録</strong>
        <button type="button" className="btn btn--small"
                onClick={() => setNotes(false)}>閉じる</button>
      </div>
      <LessonNotes learnerId={learnerId} bare />
    </aside>
  ) : null

  return { pen, tools, penBar, inkLayer, notesPane }
}
