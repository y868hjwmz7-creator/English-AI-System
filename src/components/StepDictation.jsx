/**
 * ① ディクテーション + まね音読(2026-08 利用者の指定)。
 *
 * > 1文ずつ繰り返し聞き、聞こえたと思うものをタイピングする、
 * > もしくは手元ノートなどに書き取る。
 * > なので、1文ずつ独立して音を再生、繰り返しができる UI が欲しいです。
 * > そして「解答を見る」で英文と訳が見れるしくみ。
 * > その後は文章ごとに発音をまねる練習をするステップ
 *
 * 【打ってもよいし、打たなくてもよい】
 *   手元のノートに書く人もいる。**入力欄を必須にしない。**
 *   打った人にだけ、語ごとの照らし合わせを出す。
 *
 * 【照らし合わせは、点数ではなく「どこが違うか」】
 *   `compareTranscript()` を使う。話して確かめるのと同じ仕組みで、
 *   **「to が抜けている」と見えれば直せる。**
 *   点数を1つ出しても、次に何を直せばよいか分からない。
 */
import { useMemo, useState } from 'react'
import { compareTranscript, spokenRatio } from '../lib/transcriptDiff.js'
import { isRecognitionSupported } from '../lib/recognition.js'
import EnglishText from './EnglishText.jsx'
import SpeakButton from './SpeakButton.jsx'
import { MicIcon, StopIcon } from './Icons.jsx'
import RepeatToggle from './RepeatToggle.jsx'
import { DICTATION_LEVELS, groupSentences } from '../lib/sixSteps.js'
import { SPEECH_RATES, loadRateId, rateOf, saveRateId } from '../lib/speechRate.js'
import { useProgress } from '../lib/progress.js'

export default function StepDictation({
  sentences, clipVoice, tier, rate, level,
  wordStatuses, onMarkWord, listeningId, onCheck, results,
  size, onSizeChange, progressAt = null, learnerId = null,
}) {
  // **書きかけを覚えておく**(2026-08 利用者の指定)。
  // 別のタブを見て戻ったら消えていた、という報告があった
  const [typed, setTyped] = useProgress(`${progressAt}.typed`, {}, learnerId)
  const [shown, setShown] = useProgress(`${progressAt}.shown`, {}, learnerId)
  // **1文ずつでは細かすぎることがある。**「Hi!」だけで1問にしても
  // 書き取る意味がない(2026-08 実機)。難易度を上げるほど、
  // 一度に覚える文が増える
  const blocks = useMemo(() => groupSentences(sentences, size), [sentences, size])

  /**
   * **速さとくり返しは、文ごとに持つ**(2026-09 利用者の指定)。
   *
   *   > stopボタンがあるのですが、これは必要ありませんので消してください。
   *   > そしてその横の再生スピード調整タブも、削除しする代わりに
   *   > 各文につけてください。また、同じく各文にリピート再生と
   *   > 一度の再生を切り替えるボタンも。
   *
   * 書き取りは**1文ずつ**の練習である。聞き取れない文だけをゆっくりにしたい、
   * その文だけをくり返したい、という使い方になる。
   * 上の帯にあった速さは、**どの文を鳴らすときも同じ**になってしまう。
   *
   * 【最後に選んだ速さは覚える】
   *   ほかの文を鳴らすときも、たいていは同じ速さでよい。
   *   毎回選び直させない(`saveRateId`。ほかの画面と同じ鍵)。
   * 【くり返しは覚えない】
   *   鳴りっぱなしになる指定である。**次に開いたときは、必ず1回に戻す。**
   */
  /* **開いたときの速さ。ここは動かさない。**
     ある文の速さを変えたら、**その文だけ**が変わる。
     ここも一緒に動かすと「1つ変えたら全部変わった」ように見える(実測) */
  const [rateId] = useState(loadRateId)
  const [rateById, setRateById] = useState({})
  const [repeatIds, setRepeatIds] = useState(() => new Set())
  const rateFor = (id) => rateById[id] ?? rateId

  return (
    <div className="dictation">
      <div className="slash-head">
        <label className="rate-pick">
          <span>難易度</span>
          <select value={DICTATION_LEVELS.find((x) => x.size === size)?.id ?? 'easy'}
                  onChange={(e) => onSizeChange(
                    DICTATION_LEVELS.find((x) => x.id === e.target.value)?.size ?? 1,
                  )}>
            {DICTATION_LEVELS.map((l) => (
              <option key={l.id} value={l.id} title={l.hint}>{l.label}({l.size}文ずつ)</option>
            ))}
          </select>
        </label>
      </div>

      <ol className="dictation-list">
        {blocks.map((s, n) => {
          const open = shown[s.id]
          const mine = typed[s.id] ?? ''
          const diff = open && mine.trim() ? compareTranscript(s.text, mine) : null
          const spoken = results[s.id]
          return (
            <li key={s.id} className="qa-row dictation-row">
              {/* **操作は右上にまとめる。** 話者の名前と反対側に置くと、
                  本文と解答をそのぶん上に寄せられる(2026-08 の指摘) */}
              <div className="row-head">
                <span className="dictation-no">{n + 1}</span>
                {s.speaker && <span className="passage-speaker" lang="en">{s.speaker}</span>}
                <span className="row-tools">
                  <SpeakButton text={s.text} className="etext-listen"
                               clipVoice={clipVoice} tier={tier}
                               /* もとの速さ(取り組み方ごと)に、この文の倍率を掛ける */
                               rate={rateOf(rateFor(s.id), rate)}
                               repeat={repeatIds.has(s.id)} />
                  {/* **くり返すか、1回だけか。** 見た目も文言も
                      `RepeatToggle` 1か所に置いてある(2026-09 に部品へ出した)。
                      同じボタンが Quick Response・集中モード・③④⑤ にも並ぶ */}
                  <RepeatToggle on={repeatIds.has(s.id)}
                                onChange={() => setRepeatIds((v) => {
                                  const next = new Set(v)
                                  if (next.has(s.id)) next.delete(s.id)
                                  else next.add(s.id)
                                  return next
                                })} />
                  {/* この文だけの速さ。**覚えるのは最後に選んだもの** */}
                  <label className="row-rate">
                    <span className="sr-only">この文を鳴らす速さ</span>
                    <select value={rateFor(s.id)}
                            onChange={(e) => {
                              const v = e.target.value
                              // **変えるのは、この文だけ**
                              setRateById((m) => ({ ...m, [s.id]: v }))
                              // 次に開いたときの初めの速さとして覚える
                              saveRateId(v)
                            }}>
                      {SPEECH_RATES.map((r) => (
                        <option key={r.id} value={r.id}>{r.label}</option>
                      ))}
                    </select>
                  </label>
                  <button type="button" className="btn btn--small"
                          onClick={() => setShown((v) => ({ ...v, [s.id]: !v[s.id] }))}>
                    {open ? '解答を隠す' : '解答を見る'}
                  </button>
                  {/* 解答を出したあとが「まね音読」。
                      **出す前に話させない。** 何を言えばよいか分からない */}
                  {open && isRecognitionSupported() && (
                    <button type="button"
                            className={`btn btn--small${listeningId === s.id ? ' btn--primary' : ''}`}
                            onClick={() => onCheck(s)}>
                      {listeningId === s.id
                        ? <><StopIcon />話し終わったら押す</>
                        : <><MicIcon />まねて言う</>}
                    </button>
                  )}
                </span>
              </div>

              <textarea
                className="dictation-input" lang="en" rows={2}
                autoCapitalize="off" autoCorrect="off" spellCheck="false"
                placeholder="聞こえたとおりに書く(手元のノートに書くなら、空のままで構いません)"
                value={mine}
                onChange={(e) => setTyped((t) => ({ ...t, [s.id]: e.target.value }))}
              />

              {/* **照らし合わせは、書いた欄のすぐ下に置く。**
                  合っている=緑 / まちがい=赤。線も併せて付ける */}
              {diff && (
                <div className="dict-diff">
                  <p className="dict-diff-line">
                    {diff.map((d, i) => (
                      <span key={i} className={`w w--${d.state}`}>{d.word}</span>
                    ))}
                  </p>
                  <p className="dict-diff-score">
                    <strong>{diff.filter((d) => d.state === 'ok').length} / {diff.filter((d) => d.state !== 'extra').length} 語</strong>
                    {' '}合っています
                    {/* **余分な語も数える。** 数えないと、まちがいだらけでも
                        「4 / 4 合っています」と出てしまう(実測) */}
                    {diff.some((d) => d.state === 'extra')
                      && `(お手本に無い語が ${diff.filter((d) => d.state === 'extra').length} つ)`}
                    <span className="dict-key">
                      <span className="w w--ok">緑</span>=合っている
                      <span className="w w--missed">赤の取り消し線</span>=書けなかった
                      <span className="w w--extra">赤の波線</span>=お手本に無い語
                    </span>
                  </p>
                </div>
              )}

              {open && (
                <div className="answer-box dictation-answer">
                  <p className="answer-box-label">解答</p>
                  <p className="dictation-en">
                    <EnglishText text={s.text} textJa={s.ja} level={level}
                                 statuses={wordStatuses} onMark={onMarkWord} />
                  </p>
                  {s.ja && (
                    <p className="passage-ja">
                      {s.jaIsWhole && <span className="slash-ja-label">段落の訳</span>}
                      {s.ja}
                    </p>
                  )}
                </div>
              )}

              {/* まねて言った結果 */}
              {spoken && (
                <div className="transcript">
                  <p className="transcript-line">
                    {spoken.diff.map((d, i) => (
                      <span key={i} className={`w w--${d.state}`}>{d.word} </span>
                    ))}
                  </p>
                  <p className="field-hint">
                    {Math.round(spokenRatio(spoken.diff) * 100)}% 聞き取れました
                  </p>
                </div>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
