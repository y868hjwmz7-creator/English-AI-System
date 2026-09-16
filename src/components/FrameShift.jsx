/**
 * **型シフト** — 1つの内容を、指定された型で言い直す(2026-09 利用者の指定)。
 *
 *   > 画期的なトレーニングを作りたいです
 *
 * ============================================================================
 * 【ふつうの英語アプリと、どこが違うのか】
 *
 *   パタプラ・スピフルは「**語**を入れ替える」。瞬間英作文は「和文 → 英文」の
 *   1対1。ここでやるのは「**型**を入れ替える」——
 *   同じ内容を、`It is X that ~` でも `What ~ is …` でも言えるようにする。
 *
 *   そして**言い直した文が本当にその型かを、機械が採点する**
 *   (`src/lib/frameMatch.js`・66 型を決まりで見分ける)。**AI を呼ばない = 0円。**
 *
 * 【判断を、この画面に持ち込まない】
 *
 *   呼ぶのは `judgeShift()` と `shiftSay()` だけ。
 *   **`frameMatch` を直に触らない**(`npm run test:shift` が見張る)。
 *   置く場所の数だけ食い違う、は何度も踏んだ落とし穴である(CLAUDE.md)。
 *
 * 【✕を付けない】
 *
 *   見分けられなかったときに「間違い」と出さない。
 *   `frameMatch` は**迷ったら黙る**ので、「見分けられない」は
 *   「間違っている」ではないからである。**正しく言えた人に嘘をつかない。**
 *
 * 【隙間は `gap` で作る】
 *
 *   縦に並ぶ別々の物のあいだには、必ず目に見える隙間を置く
 *   (`.claude/rules/common.md`「別々の物を、すき間ゼロでくっつけない」)。
 *   子に `margin-bottom` を付けて回らない。横に並ぶ組も同じ。
 *
 * 【この段では音を鳴らさない】
 *
 *   お手本の読み上げは `speak` の窓口を呼ぶので**課金される。**
 *   **見えない費用は管理できない**(CLAUDE.md)ので、
 *   足すかどうかは利用者に確かめてからにする。
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  SHIFT_EMPTY, SHIFT_OK,
  judgeShift, loadShiftDone, saveShiftDone,
  shiftGroups, shiftQuestions, shiftSay, shiftSceneOf,
} from '../lib/frameShift.js'
import { SHIFT_SCENES } from '../data/frameShift.js'
import { isRecognitionSupported, startRecognition } from '../lib/recognition.js'
import { MicIcon, RepeatIcon, StopIcon } from './Icons.jsx'
import { answerFeedback } from '../lib/haptics.js'

export default function FrameShift() {
  /** 絞り込み。**`null` はぜんぶ**(黙って絞らない) */
  const [scene, setScene] = useState(null)
  const [group, setGroup] = useState(null)
  const [at, setAt] = useState(0)
  const [said, setSaid] = useState('')
  const [result, setResult] = useState(null)
  const [openEx, setOpenEx] = useState(false)
  const [listening, setListening] = useState(false)
  /** マイクの失敗。**その操作をした場所に出す**(画面のいちばん下に出さない) */
  const [micNote, setMicNote] = useState('')
  const [done, setDone] = useState(loadShiftDone)
  const sessionRef = useRef(null)

  const groups = useMemo(() => shiftGroups(), [])
  /** いま掛かっている絞り込み。**畳んだままでも見せる**(黙って絞らない) */
  const pickedLabel = [
    shiftSceneOf(scene)?.label ?? null,
    groups.find((g) => g.id === group)?.label ?? null,
  ].filter(Boolean).join(' / ')
  const qs = useMemo(() => shiftQuestions({ scene, group }), [scene, group])
  /* **範囲の外に出さない。** 絞り込みを変えると数が変わる
     (やりかけの控えと同じ注意・CLAUDE.md) */
  const here = Math.min(Math.max(0, at), Math.max(0, qs.length - 1))
  const q = qs[here] ?? null

  /* 問が変われば、言ったことも判定もお手本も消す。
     **前の問の判定を、次の問に残さない** */
  useEffect(() => {
    setSaid(''); setResult(null); setOpenEx(false); setMicNote('')
  }, [q?.qid])

  /* 絞り込みを変えたら先頭へ。**途中の番号のまま残さない** */
  useEffect(() => { setAt(0) }, [scene, group])

  /** 言い直した文を見る。**判定はここ1か所からしか呼ばない** */
  const check = (text) => {
    const j = judgeShift(text, q?.form ?? '')
    setResult(j)
    if (j.verdict === SHIFT_EMPTY) return
    answerFeedback(j.verdict === SHIFT_OK)
    if (j.verdict === SHIFT_OK && q) {
      /* **言えた問だけ控える。** 型ごとの到達度は `shiftMap()` が数える */
      setDone((prev) => {
        if (prev.has(q.qid)) return prev
        const next = new Set(prev); next.add(q.qid)
        return saveShiftDone(next)
      })
    }
  }

  /** 話して答える。もう一度押すと止めて、結果を見る */
  const talk = async () => {
    if (listening) { sessionRef.current?.stop(); return }
    setMicNote(''); setResult(null)
    setListening(true)
    const session = startRecognition()
    sessionRef.current = session
    try {
      const { text } = await session.done
      setSaid(text)
      check(text)
    } catch (e) {
      setMicNote(e?.message ?? '聞き取れませんでした。')
    } finally {
      setListening(false)
      sessionRef.current = null
    }
  }

  /* 画面を離れるときに、マイクを掴んだままにしない(iOS で必ず効いてくる) */
  useEffect(() => () => { sessionRef.current?.stop() }, [])

  const say = result ? shiftSay(result) : null
  const doneHere = qs.filter((x) => done.has(x.qid)).length

  return (
    <section className="stack fshift">
      <header className="card fshift-head">
        <h2 className="fshift-title"><RepeatIcon /> 型シフト</h2>
        <p className="fshift-lead">
          ふつうの言い方を、指定された型で言い直します。
          言い直した文が、その型になっているかを機械が見ます。
        </p>
        <p className="muted fshift-note">
          正しくても見分けられないことがあります。そのときは
          「たしかめられませんでした」と出ます。間違いという意味ではありません。
        </p>
      </header>

      {/* **絞り込みは畳んでおく**(2026-09・390px で実測)。
          型の組が 14 あるので、開いたままだと**問が画面の外まで押し出される**
          (狭い画面で 600px ぶん)。**掛かっている絞り込みは、
          畳んだままでも見える**ようにする ——「黙って絞らない」(CLAUDE.md) */}
      <details className="card fshift-filter">
        <summary className="fshift-sum">
          絞りこむ
          {pickedLabel && <span className="finder-badge fshift-mark">{pickedLabel}</span>}
          <span className="muted fshift-sumcount">{qs.length} 問</span>
        </summary>
        {/* **`<details>` そのものに `display` を書かない。**
            書くと、畳んでいても中身が場所を取り続ける(2026-09 実測・
            見えないまま下の問と重なる)。**並べるのは、この入れ物の役目** */}
        <div className="fshift-filterbody">
        <div className="fshift-filterrow">
          <span className="field-label">場面</span>
          <div className="chiprow">
            <button type="button"
                    className={`btn btn--small ${scene ? 'btn--ghost' : ''}`}
                    onClick={() => setScene(null)}>ぜんぶ</button>
            {SHIFT_SCENES.map((s) => (
              <button key={s.id} type="button"
                      className={`btn btn--small ${scene === s.id ? '' : 'btn--ghost'}`}
                      onClick={() => setScene(s.id)}>{s.label}</button>
            ))}
          </div>
        </div>
        <div className="fshift-filterrow">
          <span className="field-label">型の組</span>
          <div className="chiprow">
            <button type="button"
                    className={`btn btn--small ${group ? 'btn--ghost' : ''}`}
                    onClick={() => setGroup(null)}>ぜんぶ</button>
            {groups.map((g) => (
              <button key={g.id} type="button"
                      className={`btn btn--small ${group === g.id ? '' : 'btn--ghost'}`}
                      onClick={() => setGroup(g.id)}>{g.label}</button>
            ))}
          </div>
        </div>
        </div>
      </details>

      {!q ? (
        /* **行き止まりを作らない。** 0問になったら、戻る道を出す */
        <div className="card fshift-none">
          <p>この絞り込みでは、問がありません。</p>
          <button type="button" className="btn btn--small"
                  onClick={() => { setScene(null); setGroup(null) }}>
            絞り込みを外す
          </button>
        </div>
      ) : (
        <>
          <div className="card fshift-q">
            <div className="fshift-qhead">
              <span className="chip-count">{here + 1} / {qs.length}</span>
              <span className="fshift-scene">{shiftSceneOf(q.scene)?.label ?? ''}</span>
              {done.has(q.qid) && <span className="fshift-doneflag">言えた</span>}
            </div>

            <p className="fshift-ja">{q.ja}</p>

            <div className="fshift-base">
              <span className="field-label">ふつうの言い方</span>
              <p className="fshift-baseen">{q.base}</p>
            </div>

            <div className="fshift-target">
              <span className="field-label">この型で言い直す</span>
              <p className="fshift-form">{q.form}</p>
              {q.groupLabel && (
                <p className="muted fshift-group">{q.sectionNo} {q.groupLabel}</p>
              )}
            </div>

            <div className="fshift-answer">
              <label className="field-label" htmlFor="fshift-said">言い直した文</label>
              <textarea id="fshift-said" className="fshift-input" rows={2}
                        value={said} onChange={(e) => setSaid(e.target.value)}
                        placeholder="ここに打つか、下のマイクで話します" />
              <div className="btn-row fshift-acts">
                <button type="button" className="btn" onClick={() => check(said)}>
                  見てもらう
                </button>
                {isRecognitionSupported() && (
                  <button type="button"
                          className={`btn ${listening ? 'btn--ghost' : ''}`}
                          onClick={talk}>
                    {listening ? <><StopIcon /> 止める</> : <><MicIcon /> 話す</>}
                  </button>
                )}
                <button type="button" className="btn btn--ghost"
                        onClick={() => setOpenEx((v) => !v)}>
                  {openEx ? 'お手本を隠す' : 'お手本を見る'}
                </button>
              </div>
              {/* **失敗の知らせは、その操作をした場所に出す** */}
              {micNote && <p className="fshift-mic" role="alert">{micNote}</p>}
            </div>

            {say && say.head && (
              /* **成功と失敗を、同じ見た目で終わらせない。**
                 色だけに頼らず、地色 + 枠線 + 太字の見出しで分ける */
              <div className={`fshift-verdict fshift-verdict--${say.tone}`} role="status">
                <p className="fshift-vhead">{say.head}</p>
                {say.body && <p className="fshift-vbody">{say.body}</p>}
              </div>
            )}

            {openEx && (
              <div className="fshift-ex">
                <span className="field-label">お手本</span>
                <p className="fshift-exen">{q.ex}</p>
              </div>
            )}
          </div>

          <div className="card fshift-move">
            <div className="btn-row fshift-moverow">
              <button type="button" className="btn btn--ghost"
                      disabled={here <= 0} onClick={() => setAt(here - 1)}>前へ</button>
              <button type="button" className="btn"
                      disabled={here >= qs.length - 1} onClick={() => setAt(here + 1)}>次へ</button>
            </div>
            <p className="muted fshift-count">
              言えた問: {doneHere} / {qs.length}
            </p>
          </div>
        </>
      )}
    </section>
  )
}
