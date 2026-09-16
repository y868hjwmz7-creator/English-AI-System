/**
 * **型シフト** —— 66 の型を、組ごとに「3段の道」で鍛える(2026-09 利用者の指定)。
 *
 *   > 画期的なトレーニングを作りたいです
 *   > これら 66 の型をカテゴリー別に分け、それぞれを活用するための…
 *   > どうするのが学習者が一番使いやすく、仕組みを理解しやすいでしょうか
 *
 * ============================================================================
 * 【画面は2つ。中は3段】
 *
 *   ① トレーニングの一覧 …… 14 の組 +「まぜて見分ける」
 *   ② 組を1つ開いた画面 …… **段1 見分ける → 段2 入れ替える → 段3 言い直す**
 *
 *   もとは「言い直す」「入れ替える」「見分ける」が**バラバラの入口**だった。
 *   「させる」を鍛えたい人は**3か所を回る**ことになり(①1組で9問・
 *   ④で86問・⑤で27問)、**その3つが同じ型の練習だとは画面のどこにも
 *   書いていなかった。** いまは組を1つ押せば、いつも同じ順で3段が並ぶ ——
 *   **1つの組でやれば、残り13組も全部同じだと分かる。**
 *
 * 【判断を、この画面に持ち込まない】
 *
 *   段の一覧と順は `frameTraining.js`、問は `frameShift.js` / `frameQuiz.js`、
 *   採点は `judgeShift()` / `judgeQuiz()`。
 *   **`frameMatch` を直に触らない**(`npm run test:shift` が見張る)。
 *
 * 【書き込む欄は置かない】(2026-09 利用者の指定・**共通仕様**)
 *
 *   > 書き込む欄はいらないですね。基本的にタイプするのは面倒なので
 *   これは**話す練習**である。打たせると、打つ速さの練習になってしまう。
 *
 * 【隙間は `gap` で作る】
 *
 *   `<details>` そのものに `display` を書かない ——
 *   書くと畳んでいても中身が場所を取る(2026-09 実測)。
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  SHIFT_EMPTY, SHIFT_OK,
  judgeShift, loadShiftDone, saveShiftDone,
  shiftQuestions, shiftSay, shiftSceneOf, shiftTrainings,
  swapFrames, swapQuestions,
} from '../lib/frameShift.js'
import { SHIFT_SCENES } from '../data/frameShift.js'
import { FIRST_STAGE, SHIFT_STAGES } from '../data/frameTraining.js'
import { isRecognitionSupported, startRecognition } from '../lib/recognition.js'
import { ChevronIcon, MicIcon, RepeatIcon, StopIcon } from './Icons.jsx'
import { answerFeedback } from '../lib/haptics.js'

export default function FrameShift() {
  /** いま開いている組(`QUIZ_GROUP` なら「まぜて見分ける」)。**`null` なら一覧** */
  const [pick, setPick] = useState(null)
  /** いまの段。**開いたらいちばんやさしい段から** */
  const [stage, setStage] = useState(FIRST_STAGE)
  /** 場面(段3)/ 型の組(まぜて見分ける)。**`null` はぜんぶ**(黙って絞らない) */
  const [scene, setScene] = useState(null)
  /** 骨(段2)。**`null` なら、出ている中の先頭** */
  const [frame, setFrame] = useState(null)
  const [at, setAt] = useState(0)
  const [said, setSaid] = useState('')
  const [result, setResult] = useState(null)
  const [openEx, setOpenEx] = useState(false)
  const [listening, setListening] = useState(false)
  /** マイクの失敗。**その操作をした場所に出す**(画面のいちばん下に出さない) */
  const [micNote, setMicNote] = useState('')
  const [done, setDone] = useState(loadShiftDone)
  const sessionRef = useRef(null)

  /* **数えるのは1回だけ。** 組ごとに呼び直すと、同じ数え上げを 14 回やることになる */
  const allBones = useMemo(() => swapFrames(), [])
  const swapBy = useMemo(() => {
    const m = new Map()
    for (const f of allBones) m.set(f.groupId, (m.get(f.groupId) ?? 0) + f.count)
    return m
  }, [allBones])

  /** 一覧に出す 14 組。**段ごとの数も添える** */
  const trainings = useMemo(() => shiftTrainings(done).map((t) => ({
    ...t,
    counts: { swap: swapBy.get(t.id) ?? 0, say: t.total },
  })), [done, swapBy])

  const here = trainings.find((t) => t.id === pick) ?? null
  /** この組の骨(段2)。**組の外の骨は出さない** */
  const myBones = useMemo(
    () => allBones.filter((f) => f.groupId === pick), [allBones, pick],
  )
  const activeFrame = myBones.some((f) => f.id === frame)
    ? frame : (myBones[0]?.id ?? null)

  /** いま出す問。**段で分かれるのはここ1か所** */
  const qs = useMemo(() => {
    if (!here) return []
    if (stage === 'swap') return swapQuestions({ frame: activeFrame })
    return shiftQuestions({ group: pick, scene })
  }, [here, stage, pick, scene, activeFrame])

  /* **範囲の外に出さない。** 段や絞り込みを変えると数が変わる */
  const nth = Math.min(Math.max(0, at), Math.max(0, qs.length - 1))
  const q = qs[nth] ?? null

  /* 問が変われば、言ったことも判定もお手本も消す */
  useEffect(() => {
    setSaid(''); setResult(null); setOpenEx(false); setMicNote('')
  }, [q?.qid])
  /* 組・段・絞り込みを変えたら先頭へ。**途中の番号のまま残さない** */
  useEffect(() => { setAt(0) }, [pick, stage, scene, activeFrame])

  /** 言えた問を控える。**数え方を2通り持たない**ので、足すのはここだけ */
  const markDone = (qid) => {
    setDone((prev) => {
      if (prev.has(qid)) return prev
      const next = new Set(prev); next.add(qid)
      return saveShiftDone(next)
    })
  }

  /** 言い直した文を見る。**判定はここ1か所からしか呼ばない** */
  const check = (text) => {
    const j = judgeShift(text, q?.form ?? '', { phrase: q?.phrase ?? null })
    setResult(j)
    if (j.verdict === SHIFT_EMPTY) return
    answerFeedback(j.verdict === SHIFT_OK)
    if (j.verdict === SHIFT_OK && q) markDone(q.qid)
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

  const open = (id) => { setPick(id); setStage(FIRST_STAGE); setScene(null); setFrame(null) }
  const close = () => { setPick(null); setStage(FIRST_STAGE); setScene(null); setFrame(null) }

  /* ── ① トレーニングの一覧 ───────────────────────────── */
  if (!here) {
    let lastNo = null
    let lastAsk = null
    return (
      <section className="stack fshift">
        <header className="card fshift-head">
          {/* **冊の札が「66 の型」と言っているので、見出しで繰り返さない**
              (**同じことをするものを2つ見せない**・CLAUDE.md) */}
          <p className="fshift-lead">
            鍛えたい型の組をえらぶと、
            <strong>日本語 → 英語</strong> と <strong>言い換え</strong> の
            2つが出ます。どの組でも、いつも同じ2つです。
          </p>
          <p className="muted fshift-note">
            答えるのはマイクです。打ち込む欄はありません。
          </p>
        </header>

        <div className="fshift-menu">
          {trainings.map((t) => {
            const head = t.no !== lastNo ? t.no : null
            lastNo = t.no
            const ask = t.move?.ask ?? ''
            const showAsk = ask && ask !== lastAsk
            lastAsk = ask
            return (
              <div key={t.id} className="fshift-menuitem">
                {head && <h3 className="fshift-secline">{t.no} {t.sectionLabel}</h3>}
                <button type="button" className="card fshift-card" onClick={() => open(t.id)}>
                  <span className="fshift-cardtop">
                    <span className="fshift-cardname">{t.label}</span>
                    <ChevronIcon />
                  </span>
                  {showAsk && <span className="fshift-cardmove">{ask}</span>}
                  <span className="fshift-cardforms">
                    {t.forms.slice(0, 3).join(' / ')}
                    {t.forms.length > 3 && ` ほか ${t.forms.length - 3}`}
                  </span>
                  {/* **段ごとの数を、開く前に見せる。** どれだけこなせるかが分かる */}
                  <span className="fshift-cardcount">
                    {SHIFT_STAGES.map((s) => (
                      <span key={s.id} className="fshift-cardstage">
                        {s.label} {t.counts[s.id]}
                      </span>
                    ))}
                    <span className="fshift-carddone">言えた {t.done}</span>
                  </span>
                </button>
              </div>
            )
          })}
        </div>
      </section>
    )
  }

  /* ── ② 組を1つ開いた画面(3段) ───────────────────── */
  const say = result ? shiftSay(result) : null
  const nowStage = SHIFT_STAGES.find((s) => s.id === stage)

  return (
    <section className="stack fshift">
      <header className="card fshift-head">
        <div className="fshift-back">
          <button type="button" className="btn btn--small btn--ghost" onClick={close}>
            トレーニングの一覧へ
          </button>
        </div>
        <h2 className="fshift-title"><RepeatIcon /> {here.label}</h2>
        <p className="fshift-lead"><strong>やること:</strong> {here.move?.ask ?? ''}</p>
        {here.move?.why && <p className="muted fshift-note">{here.move.why}</p>}

        {(
          /* **段はいつも2つ、いつもこの順。** 左がやさしい */
          <div className="fshift-stages">
            {SHIFT_STAGES.map((s) => (
              <button key={s.id} type="button"
                      className={`btn fshift-stage${stage === s.id ? ' fshift-stage--on' : ' btn--ghost'}`}
                      aria-pressed={stage === s.id}
                      onClick={() => { setStage(s.id); setScene(null); setFrame(null) }}>
                <span className="fshift-stageno">{s.no}</span>
                <span className="fshift-stagename">{s.label}</span>
                <span className="fshift-stagen">{here.counts?.[s.id] ?? 0}</span>
              </button>
            ))}
          </div>
        )}
        {nowStage && <p className="muted fshift-note">{nowStage.hint}</p>}
      </header>

      {/* 段ごとの絞り込み */}
      {(
        <details className="card fshift-filter">
          <summary className="fshift-sum">
            {stage === 'swap' ? '型をえらぶ' : '場面でしぼる'}
            {stage === 'swap' ? (
              <span className="finder-badge fshift-mark">
                {myBones.find((x) => x.id === activeFrame)?.label ?? ''}
              </span>
            ) : scene && (
              <span className="finder-badge fshift-mark">
                {SHIFT_SCENES.find((x) => x.id === scene)?.label ?? ''}
              </span>
            )}
            <span className="muted fshift-sumcount">{qs.length} 問</span>
          </summary>
          {/* **`<details>` そのものに `display` を書かない。**
              書くと、畳んでいても中身が場所を取り続ける(2026-09 実測) */}
          <div className="fshift-filterbody">
            <div className="chiprow">
              {stage === 'swap' ? (
                /* **型は「ぜんぶ」を出さない。** 1つに固定するのがこの段である ——
                   混ぜると「言い方に迷わない」が成り立たなくなる */
                myBones.map((f) => (
                  <button key={f.id} type="button"
                          className={`btn btn--small ${activeFrame === f.id ? '' : 'btn--ghost'}`}
                          onClick={() => setFrame(f.id)}>
                    {f.label} <span className="muted">{f.count}</span>
                  </button>
                ))
              ) : (
                <>
                  <button type="button"
                          className={`btn btn--small ${scene ? 'btn--ghost' : ''}`}
                          onClick={() => setScene(null)}>ぜんぶ</button>
                  {SHIFT_SCENES.map((x) => (
                    <button key={x.id} type="button"
                            className={`btn btn--small ${scene === x.id ? '' : 'btn--ghost'}`}
                            onClick={() => setScene(x.id)}>{x.label}</button>
                  ))}
                </>
              )}
            </div>
          </div>
        </details>
      )}

      {!q ? (
        /* **行き止まりを作らない。** 0問になったら、戻る道を出す */
        <div className="card fshift-none">
          <p>この絞り込みでは、問がありません。</p>
          <button type="button" className="btn btn--small"
                  onClick={() => { setScene(null); setFrame(null) }}>
            しぼり込みを外す
          </button>
        </div>
      ) : (
        <>
          <div className="card fshift-q">
            <div className="fshift-qhead">
              <span className="chip-count">{nth + 1} / {qs.length}</span>
              {q.scene && (
                <span className="fshift-scene">{shiftSceneOf(q.scene)?.label ?? ''}</span>
              )}
              {done.has(q.qid) && <span className="fshift-doneflag">言えた</span>}
            </div>

            <p className="fshift-ja">{q.ja}</p>

            {/* **Quick Response では、もとの英文(骨)を出さない**(2026-09
                利用者の指定「シンプルな quick response に。日本語→英語です」)。
                出すのは**日本語のお題と型の名前だけ** ——
                英文を見せると、写すだけの練習になる */}
            {!q.phrase && (
              <div className="fshift-base">
                <span className="field-label">もとの言い方</span>
                <p className="fshift-baseen">{q.base}</p>
              </div>
            )}

            {/* **型は、どちらの段でも出す。**
                出さないと `This tool lets you …` のような別の言い方でも
                正しくなってしまい、「ちがう型です」が理不尽になる */}
            <div className="fshift-target">
              <span className="field-label">
                {q.phrase ? 'この型で英語を言う' : 'この型で言い直す'}
              </span>
              <p className="fshift-form">{q.form}</p>
            </div>

            {/* **書き込む欄は置かない**(2026-09 利用者の指定・共通仕様)。
                これは話す練習である。打たせると、打つ速さの練習になる */}
            <div className="fshift-answer">
              {isRecognitionSupported() && (
                <>
                  {/* **「言い直した文」と書かない。** 日本語 → 英語の段では
                      言い直していない —— **どちらの段でも真になる言い方**にする */}
                  <span className="field-label">言った文</span>
                  <p className={`fshift-heard${said ? '' : ' fshift-heard--none'}`}>
                    {said || 'マイクを押して、声に出して言ってください'}
                  </p>
                </>
              )}
              <div className="btn-row fshift-acts">
                {isRecognitionSupported() ? (
                  <button type="button"
                          className={`btn ${listening ? 'btn--ghost' : ''}`}
                          onClick={talk}>
                    {listening ? <><StopIcon /> 止める</> : <><MicIcon /> 話す</>}
                  </button>
                ) : (
                  /* **行き止まりを作らない。** 打たせないのは同じ */
                  <button type="button" className="btn"
                          onClick={() => markDone(q.qid)}>言えた</button>
                )}
                <button type="button" className="btn btn--ghost"
                        onClick={() => setOpenEx((v) => !v)}>
                  {openEx ? 'お手本を隠す' : 'お手本を見る'}
                </button>
              </div>
              {!isRecognitionSupported() && (
                <p className="muted fshift-hint">
                  この端末のブラウザは音声認識に対応していないため、
                  機械で確かめられません。お手本を見て、声に出して確かめてください。
                </p>
              )}
              {micNote && <p className="fshift-mic" role="alert">{micNote}</p>}
            </div>

            {say && say.head && (
              /* **成功と失敗を、同じ見た目で終わらせない** */
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
                      disabled={nth <= 0} onClick={() => setAt(nth - 1)}>前へ</button>
              <button type="button" className="btn"
                      disabled={nth >= qs.length - 1} onClick={() => setAt(nth + 1)}>次へ</button>
            </div>
            <p className="muted fshift-count">
              言えた問: {qs.filter((x) => done.has(x.qid)).length} / {qs.length}
            </p>
          </div>
        </>
      )}
    </section>
  )
}
