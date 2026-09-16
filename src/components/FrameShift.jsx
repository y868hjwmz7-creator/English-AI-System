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
  judgeShift, loadShiftDone, saveShiftDone,
  shiftQuestions, shiftSay, shiftSceneOf, shiftTrainings,
} from '../lib/frameShift.js'
import { SHIFT_SCENES } from '../data/frameShift.js'
import { isRecognitionSupported, startRecognition } from '../lib/recognition.js'
import { ChevronIcon, MicIcon, RepeatIcon, StopIcon } from './Icons.jsx'
import { answerFeedback } from '../lib/haptics.js'

export default function FrameShift() {
  /** いま開いているトレーニング(組の id)。**`null` なら一覧** */
  const [pick, setPick] = useState(null)
  /** 場面での絞り込み。**`null` はぜんぶ**(黙って絞らない) */
  const [scene, setScene] = useState(null)
  const [at, setAt] = useState(0)
  const [said, setSaid] = useState('')
  const [result, setResult] = useState(null)
  const [openEx, setOpenEx] = useState(false)
  const [listening, setListening] = useState(false)
  /** マイクの失敗。**その操作をした場所に出す**(画面のいちばん下に出さない) */
  const [micNote, setMicNote] = useState('')
  const [done, setDone] = useState(loadShiftDone)
  const sessionRef = useRef(null)

  const trainings = useMemo(() => shiftTrainings(done), [done])
  const here = trainings.find((t) => t.id === pick) ?? null
  const qs = useMemo(
    () => (pick ? shiftQuestions({ group: pick, scene }) : []),
    [pick, scene],
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
  useEffect(() => { setAt(0) }, [pick, scene])

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
                        onClick={() => { setPick(t.id); setScene(null) }}>
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
                  onClick={() => { setPick(null); setScene(null) }}>
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
          場面でしぼる
          {scene && (
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
      </details>

      {!q ? (
        /* **行き止まりを作らない。** 0問になったら、戻る道を出す */
        <div className="card fshift-none">
          <p>この場面では、問がありません。</p>
          <button type="button" className="btn btn--small"
                  onClick={() => setScene(null)}>
            場面のしぼり込みを外す
          </button>
        </div>
      ) : (
        <>
          <div className="card fshift-q">
            <div className="fshift-qhead">
              <span className="chip-count">{nth + 1} / {qs.length}</span>
              <span className="fshift-scene">{shiftSceneOf(q.scene)?.label ?? ''}</span>
              {done.has(q.qid) && <span className="fshift-doneflag">言えた</span>}
            </div>

            <p className="fshift-ja">{q.ja}</p>

            <div className="fshift-base">
              <span className="field-label">もとの言い方</span>
              <p className="fshift-baseen">{q.base}</p>
            </div>

            <div className="fshift-target">
              <span className="field-label">この型で言い直す</span>
              <p className="fshift-form">{q.form}</p>
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
