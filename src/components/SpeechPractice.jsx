/**
 * **直したスピーチで練習する**(0054・2026-09 利用者の指定)。
 *
 *   > その文の音声を作成、ゲスト側で練習できる機能です。
 *
 * ============================================================================
 * 【なぜ `SpeechBoard` から切り出したか】
 *
 *   あちらは**自分で読み込む**部品(`loadSpeeches`)なので、
 *   `npm run test:bar` の骨組み(`__screens.jsx`・Supabase 無し)では
 *   **中身が1つも描かれない。** 描けないものは測れない。
 *
 *   `QrCard` / `WordRadio` / `JobBar` と同じく、**中身を props で受け取る形**に
 *   しておけば、本物の部品と本物の CSS のまま測れる
 *   (**写した HTML では測らない**・CLAUDE.md)。
 *
 * 【直す前の原稿は、ここへ来ない】
 *   呼ぶ側が `isReviewed()` で確かめてから渡す。
 *   まちがった英語を**手本として聞かせない**(誤り訂正に音声を付けないのと
 *   まったく同じ考え方)。
 *
 * 【新しい仕組みを1つも作っていない】
 *   通しは `useBodyAudio`(紙・集中モードと同じ道具)、
 *   1文ずつは `SpeakButton`、単語帳は `lookupWord` → `setWordStatus`、
 *   集中モードは `FocusFrame`(`FocusReader` / `StepFocus` と同じ骨組み)。
 *
 * 【音声は1本にまとめる】(2026-09 利用者の指定)
 *
 *   通しの読み上げは、良い声の段で2文以上あれば
 *   `readAloudSequence` が**もともと1本にまとめて**鳴らす。
 *   ところが**1文ずつの Listen だけ**が、その文だけの MP3 を
 *   別に作っていた ——**廃止したほうの作り**である。
 *   いまは `speechWholeSlice()` を渡して、**その1本の中の区間**を鳴らす
 *   (段落ごとの Listen を `wholeSliceOf()` で直したのと同じ考え方)。
 */
import { useEffect, useState } from 'react'
import {
  speechLevelOf, speechLines, speechParts, speechPhrases, speechWholeSlice, speechWordList,
} from '../lib/speechPractice.js'
import useBodyAudio from '../lib/useBodyAudio.js'
import { SPEECH_RATES, loadRateId, rateOf, saveRateId } from '../lib/speechRate.js'
import useWordStatuses, { markIn } from '../lib/useWordStatuses.js'
import { lookupWord, normWord, setWordStatus } from '../lib/vocab.js'
import { PREMIUM } from '../lib/voiceTier.js'
import { phraseKind, seenSentenceFor } from '../lib/writingReview.js'
import EnglishText from './EnglishText.jsx'
import FocusFrame from './FocusFrame.jsx'
import { FocusIcon, MicIcon, PlusIcon, SpeakerIcon, StopIcon } from './Icons.jsx'
import RepeatToggle from './RepeatToggle.jsx'
import SpeakButton from './SpeakButton.jsx'
import Stepper from './Stepper.jsx'

export default function SpeechPractice({ speech, learnerId = null, level = null }) {
  const [rateId, setRateId] = useState(loadRateId)
  const [view, setView] = useState('en')          // 'en' | 'ja'
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState(null)
  const [added, setAdded] = useState(() => new Set())
  /** 集中モードで開いている文。**`null` なら閉じている** */
  const [focusAt, setFocusAt] = useState(null)
  const { statuses, mark } = useWordStatuses(learnerId)
  /* **通しの読み上げは `useBodyAudio` に任せる。**
     鳴っているか / 用意しています… / 止めた場所からの再開は、
     ぜんぶあちらが持っている。**書き写さない** */
  const audio = useBodyAudio()

  const parts = speechParts(speech)
  const phrases = speechPhrases(speech)
  /* **描くのも、鳴らすのも、区間を数えるのも、この1つの並び**
     (`speechLines`)。番号が1つでもずれると、**別の文が鳴る** */
  const sentences = speechLines(speech)
  const notes = speech?.review?.notes ?? []
  /* **レベルはゲストのものを使う**(2026-09 利用者の指定)。
     判断は `speechLevelOf()` 1か所 —— 画面で `'B1'` と書かない */
  const lv = speechLevelOf(level)
  /** いちばん後ろの文。**添削をやり直すと文の数が変わる**ので、必ず収める */
  const lastAt = Math.max(0, sentences.length - 1)

  /* **鳴っている文を、そのまま開く**(紙で光る段落がまん中に来るのと同じ)。
     追わないと、通しで鳴らしているあいだ**開いている1文だけが取り残される。**
     **閉じているときは何もしない**(勝手に開かない) */
  useEffect(() => {
    if (audio.now === null) return
    setFocusAt((a) => (a === null ? null : audio.now))
  }, [audio.now])

  /* Esc で終える。矢印で送る(`StepFocus` とまったく同じ作法)。
     **文字を打っている最中は横取りしない** —— 語の吹き出しや
     メモの中でカーソルを動かせなくなる */
  useEffect(() => {
    if (focusAt === null) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); setFocusAt(null); return }
      const el = e.target
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
      if (e.key === 'ArrowRight') setFocusAt((a) => Math.min(lastAt, a + 1))
      if (e.key === 'ArrowLeft') setFocusAt((a) => Math.max(0, a - 1))
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  })

  /** 覚えたい語句を単語帳へ。**`WordbookAdd` / `WritingAnswer` と同じ道** */
  const toWordbook = async (p) => {
    setNote(null)
    const norm = normWord(p.en)
    if (!norm) {
      setNote({ ng: true, text: '英語の語句ではないので、単語帳に入れられません。' })
      return
    }
    setBusy(true)
    const sentence = seenSentenceFor(speech?.review, p.en)
    /* **意味も1回だけ引く。** 引かずに入れると、単語帳で
       「意味の控えがありません」のまま残る */
    const { error: lookupError } = await lookupWord({
      word: p.en, sentence: sentence || p.en, level: lv,
    })
    const { error } = await setWordStatus(p.en, 'unknown', {
      kind: phraseKind(p.en), sentence: sentence || null, learnerId,
    })
    setBusy(false)
    if (error) { setNote({ ng: true, text: error }); return }
    setAdded((prev) => new Set(prev).add(p.en))
    setNote({
      text: `「${norm}」を単語帳に入れました。`
        + (lookupError ? ' 意味の控えは取れませんでした。' : ''),
    })
  }

  if (!sentences.length) return null

  /** 集中モードで出す文。**必ず範囲に収める**(添削をやり直すと数が変わる) */
  const at = focusAt === null ? null : Math.min(Math.max(focusAt, 0), lastAt)

  /**
   * 1文ぶんの中身。**ふだんの一覧でも、集中モードでも、これ1つ。**
   * **書き写すと、必ずどちらかだけ古くなる**(CLAUDE.md)。
   *
   * 部品(`const Line = …`)にはしない —— 描き直すたびに別の型になり、
   * `EnglishText` ごと組み直されて、語の吹き出しが閉じてしまう。
   */
  const lineOf = (s, i) => (
    <>
      {/* 番号は**紙と同じ丸**(`.num-badge`)。**数字を自分で入れる**
          (①②③ の文字は端末ごとに形も大きさも違う・CLAUDE.md) */}
      <span className="num-badge" aria-hidden="true">{i + 1}</span>
      <div className="speech-line">
        {view === 'en' ? (
          <div className="writing-en">
            <EnglishText text={s.en} textJa={s.ja} level={lv}
                         statuses={statuses}
                         /* どの教材で会ったかは無い(スピーチは教材ではない)。
                            **誰の記録にするかは渡す** —— トレーナーが
                            ゲストのページで押したら、ゲストの記録になる
                            (0025 の決まりそのまま) */
                         onMark={markIn(mark, null, learnerId)} />
          </div>
        ) : (
          <div className="writing-ja">{s.ja || '（訳がありません）'}</div>
        )}
        {/* **1本にまとめた音声の、その区間を鳴らす**(利用者の指定)。
            渡せなければ(1文だけ・声が未定)`null` になり、
            これまでどおりその文だけの MP3 で鳴る(**行き止まりを作らない**) */}
        <SpeakButton text={s.en} clipVoice={speech.voice_id ?? undefined}
                     tier={PREMIUM} rate={rateOf(rateId)}
                     whole={speechWholeSlice(speech, i)} />
      </div>
    </>
  )

  return (
    <div className="card speech-practice">
      <h4 className="card-title">直した英文で練習する</h4>

      {/* **できていたところを先に出す。** 直すところしか言われないと、
          次に書く気が起きない */}
      {speech.review.good && <p className="writing-good">{speech.review.good}</p>}

      <div className="speech-bar">
        <button type="button" className="btn btn--small btn--primary"
                onClick={() => audio.toggle({
                  parts, rate: rateOf(rateId), tier: PREMIUM,
                  resumeKey: `speech|${speech.id}`,
                })}>
          {audio.playing ? <><StopIcon />Stop</> : <><SpeakerIcon />Listen (全体)</>}
          {audio.waiting && audio.secs > 1 && `（用意しています… ${audio.secs} 秒）`}
        </button>
        {/* **`RepeatUnit`(しない / 文 / 段落 / 全文)は使わない。**
            ここでは**1文が1つの部**なので、「文」と「段落」が
            まったく同じものを指してしまう ——
            **同じことをするものを2つ見せない**(CLAUDE.md)。
            だから「くり返す / 1回」の2つにして、回すのは全文にする */}
        <RepeatToggle on={audio.repeat === 'all'}
                      onChange={(on) => audio.setRepeat(on ? 'all' : 'off')} />
        {/* 速さは**端末に覚えた1つ**を使う(どの画面でも同じ速さで鳴る) */}
        <Stepper label="速さ" options={SPEECH_RATES} value={rateId}
                 onChange={(id) => { audio.stop(); setRateId(id); saveRateId(id) }} />
        {/* **並べない。入れ替える**(集中モードの訳と同じ決まり)。
            並べると箱が2倍になり、送るものが増える */}
        <button type="button" className="btn btn--small btn--ghost speech-swap"
                onClick={() => setView((v) => (v === 'en' ? 'ja' : 'en'))}>
          {view === 'en' ? '訳を見る' : '英語に戻す'}
        </button>
        {/* **集中モード**(2026-09 利用者の指定「今のままに集中モードだけつけて」)。
            **1文ずつだけを画面に出す。** 足したのはこのボタンだけで、
            6Steps は足していない(**言われた場所だけを直す**・共通ルール) */}
        <button type="button" className="btn btn--small btn--ghost speech-focus-open"
                onClick={() => setFocusAt(audio.now ?? audio.at ?? 0)}>
          <FocusIcon />集中モード
        </button>
      </div>

      <ol className="speech-sentences">
        {sentences.map((s, i) => (
          <li key={`${i}-${s.en}`} className={audio.now === i ? 'is-on' : ''}>
            {lineOf(s, i)}
          </li>
        ))}
      </ol>

      {/* ── 集中モード ──────────────────────────────────────────
          **骨組みは `FocusFrame` 1つ**(`FocusReader` / `StepFocus` /
          Quick Response と同じもの)。**中身は作らない** ——
          ふだんの一覧とまったく同じ `lineOf()` をそのまま渡す。

          **別の練習へ移さない**(CLAUDE.md)。ここで出るのは
          **いま取り組んでいるスピーチの、その1文**である */}
      {focusAt !== null && (
        <FocusFrame
          className="speechfocus"
          learnerId={learnerId}
          page={`speech:${speech.id}:${at}`}
          scrollKey={at}
          onClose={() => setFocusAt(null)}
          /* **速さは、どの集中モードでも上の帯に置く**(利用者の指定)。
             中身はふだんの帯と**同じ `Stepper`** で、押したときの動きも同じ */
          settings={(
            <Stepper label="速さ" options={SPEECH_RATES} value={rateId}
                     onChange={(id) => { audio.stop(); setRateId(id); saveRateId(id) }} />
          )}
          top={<span className="focus-count">{at + 1} / {sentences.length} 文</span>}
          bar={(
            <>
              <button type="button" className="btn focus-move"
                      onClick={() => setFocusAt((a) => Math.max(0, a - 1))}
                      disabled={at === 0}>
                ◀ 前
              </button>
              <div className="focus-mid">
                {/* **並べない。入れ替える**(ふだんの帯と同じ決まり) */}
                <button type="button" className="btn btn--small"
                        onClick={() => setView((v) => (v === 'en' ? 'ja' : 'en'))}>
                  {view === 'en' ? '訳' : '英語'}
                </button>
              </div>
              <button type="button" className="btn focus-move"
                      onClick={() => setFocusAt((a) => Math.min(lastAt, a + 1))}
                      disabled={at >= lastAt}>
                次 ▶
              </button>
            </>
          )}
        >
          <ol className="speech-sentences speech-sentences--focus" start={at + 1}>
            <li className={audio.now === at ? 'is-on' : ''}>
              {lineOf(sentences[at], at)}
            </li>
          </ol>
        </FocusFrame>
      )}

      {notes.length > 0 && (
        <>
          <h5 className="writing-head">直したところ</h5>
          <ul className="writing-notes">
            {notes.map((n, i) => (
              <li key={`${i}-${n.why}`}>
                {(n.before || n.after) && (
                  <div className="writing-diff">
                    <span className="writing-before" lang="en">{n.before}</span>
                    <span aria-hidden="true"> → </span>
                    <span className="writing-after" lang="en">{n.after}</span>
                  </div>
                )}
                <div className="writing-why">{n.why}</div>
              </li>
            ))}
          </ul>
        </>
      )}

      {phrases.length > 0 && (
        <>
          <h5 className="writing-head">覚えたい語句</h5>
          {/* **まとめて入れる道は、単語帳の側にある**(`SpeechWordsPick`)。
              ここでは1語ずつ入れる —— **同じことをするものを2つ見せない** */}
          <ul className="writing-phrases">
            {phrases.map((p) => (
              <li key={p.en}>
                <span className="writing-phrase-en" lang="en">{p.en}</span>
                <span className="writing-phrase-ja">{p.ja}</span>
                <button type="button" className="btn btn--ghost btn--small"
                        disabled={busy || added.has(p.en)}
                        onClick={() => toWordbook(p)}>
                  {added.has(p.en) ? '入れました' : <><PlusIcon />単語帳へ</>}
                </button>
              </li>
            ))}
          </ul>
          <p className="muted speech-tolist">
            <MicIcon />
            この {speechWordList(speech).length} 語句は、単語帳の
            <strong>「スピーチの語句」</strong>からまとめて練習できます。
          </p>
        </>
      )}

      {/* **押した場所のすぐ下に出す**(CLAUDE.md) */}
      {note && (
        <p className={note.ng ? 'notice notice--error' : 'notice notice--ok'}>{note.text}</p>
      )}
    </div>
  )
}
