/**
 * **型シフト** — 66 の型を、カテゴリーごとのトレーニングにする(2026-09 利用者の指定)。
 *
 *   > 画期的なトレーニングを作りたいです
 *   > これら 66 の型をカテゴリー別に分け、
 *   > それぞれを活用するためのトレーニングを作りたい
 *
 * ============================================================================
 * 【画面は2つ】
 *
 *   ① トレーニングの一覧 …… 14 のカテゴリー。何をする練習かと、進み具合
 *   ② その1つのドリル   …… もとの言い方 → 指定の型で言い直す
 *
 *   **一覧から入る形にした。** 66 問を1本の列にして「型の組」で絞る形だと、
 *   **何の練習をしているのかが最後まで出てこない**(2026-09 に一度そうした)。
 *   カテゴリーごとに頭の使い方が違うので、**入口で分ける。**
 *
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
 *   呼ぶのは `judgeShift()` / `shiftSay()` / `shiftTrainings()` だけ。
 *   **`frameMatch` を直に触らない**(`npm run test:shift` が見張る)。
 *   「何をする練習か」も `frameTraining.js` が持っており、ここでは書き分けない。
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
 *   (`.claude/rules/common.md`)。子に `margin-bottom` を付けて回らない。
 *   **`<details>` そのものに `display` を書かない** ——
 *   書くと畳んでいても中身が場所を取る(2026-09 実測)。
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
  SWAP_GROUP,
  judgeShift, loadShiftDone, saveShiftDone,
  shiftQuestions, shiftSay, shiftSceneOf, shiftTrainings,
  swapFrames, swapQuestions,
} from '../lib/frameShift.js'
import { SHIFT_SCENES } from '../data/frameShift.js'
import { QUIZ_GROUP, quizGroups, quizQuestions, quizTraining } from '../lib/frameQuiz.js'
import FrameQuiz from './FrameQuiz.jsx'
import { isRecognitionSupported, startRecognition } from '../lib/recognition.js'
import { ChevronIcon, MicIcon, RepeatIcon, StopIcon } from './Icons.jsx'
import { answerFeedback } from '../lib/haptics.js'

export default function FrameShift() {
  /** いま開いているトレーニング(組の id)。**`null` なら一覧** */
  const [pick, setPick] = useState(null)
  /** 場面での絞り込み。**`null` はぜんぶ**(黙って絞らない) */
  const [scene, setScene] = useState(null)
  /** 名詞句を入れ替える練習で、いま使っている骨。**`null` なら先頭** */
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

  /* **⑤ 見分けるは、いちばん後ろに足す**(前へ割り込ませない)。
     `shiftTrainings()` の中では作らない —— あちらからここを読むと
     読み込みが輪になる(`frameQuiz` → `frameShift` → `frameQuiz`) */
  const trainings = useMemo(
    () => [...shiftTrainings(done), quizTraining(done)], [done],
  )
  const here = trainings.find((t) => t.id === pick) ?? null
  /** 名詞句を入れ替える練習かどうか。**画面の中で id を比べるのはここだけ** */
  const swapping = pick === SWAP_GROUP
  /** 見分ける練習かどうか。**画面の中で id を比べるのはここだけ** */
  const quizzing = pick === QUIZ_GROUP
  const frames = useMemo(() => swapFrames(), [])
  /* **骨は 66 本ある。** そのまま並べると札の壁になるので、
     **まず組をえらび、その中の骨をえらぶ**(2段)。
     組の入れ物は `scene` を使い回す ——**絞り込みを2つ持たない** */
  const swapGroups = useMemo(
    () => [...new Map(frames.map((f) => [f.groupId, { id: f.groupId, label: f.groupLabel }])).values()],
    [frames],
  )
  const shownFrames = useMemo(
    () => (scene ? frames.filter((f) => f.groupId === scene) : frames),
    [frames, scene],
  )
  /** いま使っている骨。**選んでいなければ、出ている中の先頭** */
  const activeFrame = shownFrames.some((f) => f.id === frame)
    ? frame : (shownFrames[0]?.id ?? null)
  const qGroups = useMemo(() => quizGroups(), [])
  const qs = useMemo(
    () => (!pick ? []
      : quizzing ? quizQuestions({ group: scene })
        : swapping ? swapQuestions({ frame: activeFrame })
          : shiftQuestions({ group: pick, scene })),
    [pick, scene, activeFrame, swapping, quizzing],
  )
  /* **範囲の外に出さない。** 絞り込みを変えると数が変わる
     (やりかけの控えと同じ注意・CLAUDE.md) */
  const nth = Math.min(Math.max(0, at), Math.max(0, qs.length - 1))
  const q = qs[nth] ?? null

  /* 問が変われば、言ったことも判定もお手本も消す。
     **前の問の判定を、次の問に残さない** */
  useEffect(() => {
    setSaid(''); setResult(null); setOpenEx(false); setMicNote('')
  }, [q?.qid])

  /* トレーニングや絞り込みを変えたら先頭へ。**途中の番号のまま残さない** */
  useEffect(() => { setAt(0) }, [pick, scene, frame])

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
    /* **入れるはずの名詞句も、判定に渡す。**
       入れ替えの練習だけが `phrase` を持つ(ふだんの型シフトは `null`) */
    const j = judgeShift(text, q?.form ?? '', { phrase: q?.phrase ?? null })
    setResult(j)
    if (j.verdict === SHIFT_EMPTY) return
    answerFeedback(j.verdict === SHIFT_OK)
    /* **言えた問だけ控える。** 型ごとの到達度は `shiftMap()` が数える */
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

  /* ── ① トレーニングの一覧 ───────────────────────────── */
  if (!here) {
    /** 節の見出しは、**変わったときだけ**出す(同じ見出しを何度も書かない) */
    let lastNo = null
    /** **同じ「やること」を続けて出さない。** ①の7組は同じ指示である */
    let lastAsk = null
    const total = trainings.reduce((n, t) => n + t.total, 0)
    const got = trainings.reduce((n, t) => n + t.done, 0)
    return (
      <section className="stack fshift">
        <header className="card fshift-head">
          <h2 className="fshift-title"><RepeatIcon /> 型シフト</h2>
          <p className="fshift-lead">
            もとの言い方を、指定された型で言い直します。
            言い直した文が、その型になっているかを機械が見ます。
          </p>
          <p className="muted fshift-note">
            カテゴリーごとに、やることが違います。
            やりたいものを選んでください。言えた問: {got} / {total}
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
                {head && (
                  <h3 className="fshift-secline">{t.no} {t.sectionLabel}</h3>
                )}
                <button type="button" className="card fshift-card"
                        onClick={() => { setPick(t.id); setScene(null); setFrame(null) }}>
                  <span className="fshift-cardtop">
                    <span className="fshift-cardname">{t.label}</span>
                    <ChevronIcon />
                  </span>
                  {/* **何をする練習かを、開く前に言う。**
                      ただし同じ指示が続くときは、はじめの1枚にだけ出す */}
                  {showAsk && <span className="fshift-cardmove">{ask}</span>}
                  {/* **この組に入っている型の名前。** 組ごとに必ず違う ——
                      「やること」だけだと①の7枚が見分けられない */}
                  <span className="fshift-cardforms">
                    {t.forms.slice(0, 3).join(' / ')}
                    {t.forms.length > 3 && ` ほか ${t.forms.length - 3}`}
                  </span>
                  <span className="fshift-cardcount">
                    {t.total} 問
                    {/* **0 と null を取り違えない。** 0 のときも数で出す */}
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

  /* ── ② そのトレーニングのドリル ─────────────────────── */
  const say = result ? shiftSay(result) : null
  const doneHere = qs.filter((x) => done.has(x.qid)).length

  return (
    <section className="stack fshift">
      <header className="card fshift-head">
        <div className="fshift-back">
          <button type="button" className="btn btn--small btn--ghost"
                  onClick={() => { setPick(null); setScene(null); setFrame(null) }}>
            トレーニングの一覧へ
          </button>
        </div>
        <h2 className="fshift-title">
          <RepeatIcon /> {here.label}
        </h2>
        <p className="fshift-lead">
          <strong>やること:</strong> {here.move?.ask ?? ''}
        </p>
        {/* **なぜ効くかは畳まない。** 理由が無いと続かない */}
        {here.move?.why && <p className="muted fshift-note">{here.move.why}</p>}
      </header>

      {/* **絞り込みは畳んでおく**(2026-09・390px で実測)。
          開いたままだと問が画面の外まで押し出される。
          **掛かっている絞り込みは、畳んだままでも見える**ようにする
          ——「黙って絞らない」(CLAUDE.md) */}
      <details className="card fshift-filter">
        <summary className="fshift-sum">
          {swapping ? '骨をえらぶ' : quizzing ? '型の組でしぼる' : '場面でしぼる'}
          {swapping ? (
            <span className="finder-badge fshift-mark">
              {frames.find((x) => x.id === activeFrame)?.label ?? ''}
            </span>
          ) : scene && (
            <span className="finder-badge fshift-mark">
              {shiftSceneOf(scene)?.label ?? ''}
            </span>
          )}
          <span className="muted fshift-sumcount">{qs.length} 問</span>
        </summary>
        {/* **`<details>` そのものに `display` を書かない。**
            書くと、畳んでいても中身が場所を取り続ける(2026-09 実測・
            見えないまま下の問と重なる)。**並べるのは、この入れ物の役目** */}
        <div className="fshift-filterbody">
          <div className="chiprow">
            {swapping ? (
              /* **骨は「ぜんぶ」を出さない。** 1つに固定するのがこの練習である
                 —— 混ぜると「肉だけに気を使う」ができなくなる。
                 **2段でえらぶ**(組 → その中の骨)。66 本を1列に並べると壁になる */
              <>
                <button type="button"
                        className={`btn btn--small ${scene ? 'btn--ghost' : ''}`}
                        onClick={() => { setScene(null); setFrame(null) }}>組ぜんぶ</button>
                {swapGroups.map((g) => (
                  <button key={g.id} type="button"
                          className={`btn btn--small ${scene === g.id ? '' : 'btn--ghost'}`}
                          onClick={() => { setScene(g.id); setFrame(null) }}>{g.label}</button>
                ))}
              </>
            ) : quizzing ? (
              /* **見分けるは、型の組でしぼる。** 入れ物は `scene` を使い回す ——
                 **絞り込みを2つ持たない**(CLAUDE.md「数え方を2通り持たない」) */
              <>
                <button type="button"
                        className={`btn btn--small ${scene ? 'btn--ghost' : ''}`}
                        onClick={() => setScene(null)}>ぜんぶ</button>
                {qGroups.map((g) => (
                  <button key={g.id} type="button"
                          className={`btn btn--small ${scene === g.id ? '' : 'btn--ghost'}`}
                          onClick={() => setScene(g.id)}>{g.label}</button>
                ))}
              </>
            ) : (
              <>
                <button type="button"
                        className={`btn btn--small ${scene ? 'btn--ghost' : ''}`}
                        onClick={() => setScene(null)}>ぜんぶ</button>
                {SHIFT_SCENES.map((s) => (
                  <button key={s.id} type="button"
                          className={`btn btn--small ${scene === s.id ? '' : 'btn--ghost'}`}
                          onClick={() => setScene(s.id)}>{s.label}</button>
                ))}
              </>
            )}
          </div>
          {swapping && (
            /* **2段目 —— えらんだ組の中の骨。** 何問あるかも添える
               (**黙って絞らない**。どれを押すと何問になるかが見える) */
            <div className="chiprow">
              {shownFrames.map((f) => (
                <button key={f.id} type="button"
                        className={`btn btn--small ${activeFrame === f.id ? '' : 'btn--ghost'}`}
                        onClick={() => setFrame(f.id)}>
                  {f.label} <span className="muted">{f.count}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </details>

      {quizzing ? (
        /* **本物の部品をそのまま描く。** 問と控えは、ここが渡す */
        <FrameQuiz questions={qs} done={done} onRight={markDone} />
      ) : !q ? (
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

            <div className="fshift-base">
              {/* **渡しているものが違えば、札も違う。**
                  ふだんは「もとの言い方」、入れ替えの練習では「骨」 */}
              <span className="field-label">{q.give ?? 'もとの言い方'}</span>
              <p className="fshift-baseen">{q.base}</p>
            </div>

            {/* **入れるものの英語は見せない。**
                見せると写すだけになる —— 意味はお題の日本語に出ている。
                **何を入れるかは `q.give`(骨の札)が言っている**ので、
                ここで席の種類ごとに書き分けない(CLAUDE.md) */}
            {q.phrase && (
              <p className="muted fshift-hint">
                入れるものは、お題の日本語に出ています。
                思い出せなければ、お手本を見てください。
              </p>
            )}

            {/* **入れ替えの練習では出さない。** 骨にその型がそのまま
                書いてあるので、**同じことを2つ見せる**ことになる(CLAUDE.md) */}
            {!q.phrase && (
              <div className="fshift-target">
                <span className="field-label">この型で言い直す</span>
                <p className="fshift-form">{q.form}</p>
              </div>
            )}

            {/* **書き込む欄は置かない**(2026-09 実機・利用者の指定)。

                  > 書き込む欄はいらないですね。基本的にタイプするのは面倒なので
                  > 型シフトトレーニングについては書き込みはなしを共通仕様にしてください

                これは**話す練習**である。打たせると、打つ速さの練習になってしまう。
                この画面には `input` も `textarea` も1つも置かない ——
                `npm run test:shift` が機械で見張っている。 */}
            <div className="fshift-answer">
              {/* **聞き取った文は、必ず見せる。**
                  何と聞こえたか分からないと、判定に納得できない。

                  **マイクが使えない端末では、箱ごと出さない** ——
                  出しても一生うまらないし、「マイクを押して」という
                  **効かない案内**になる(CLAUDE.md) */}
              {isRecognitionSupported() && (
                <>
                  <span className="field-label">言い直した文</span>
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
                  /* **行き止まりを作らない**(CLAUDE.md)。
                     音声認識に対応していない端末でも、お手本を見て声に出し、
                     自分で「言えた」を押せる。**打たせない**のは同じである */
                  <button type="button" className="btn"
                          onClick={() => q && markDone(q.qid)}>
                    言えた
                  </button>
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
                      disabled={nth <= 0} onClick={() => setAt(nth - 1)}>前へ</button>
              <button type="button" className="btn"
                      disabled={nth >= qs.length - 1} onClick={() => setAt(nth + 1)}>次へ</button>
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
