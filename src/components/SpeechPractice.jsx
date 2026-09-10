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
 *   1文ずつは `SpeakButton`、単語帳は `lookupWord` → `setWordStatus`。
 */
import { useState } from 'react'
import { speechParts, speechPhrases, speechWordList } from '../lib/speechPractice.js'
import useBodyAudio from '../lib/useBodyAudio.js'
import { SPEECH_RATES, loadRateId, rateOf, saveRateId } from '../lib/speechRate.js'
import useWordStatuses, { markIn } from '../lib/useWordStatuses.js'
import { lookupWord, normWord, setWordStatus } from '../lib/vocab.js'
import { PREMIUM } from '../lib/voiceTier.js'
import { phraseKind, seenSentenceFor } from '../lib/writingReview.js'
import EnglishText from './EnglishText.jsx'
import { MicIcon, PlusIcon, SpeakerIcon, StopIcon } from './Icons.jsx'
import RepeatToggle from './RepeatToggle.jsx'
import SpeakButton from './SpeakButton.jsx'
import Stepper from './Stepper.jsx'

export default function SpeechPractice({ speech, learnerId = null }) {
  const [rateId, setRateId] = useState(loadRateId)
  const [view, setView] = useState('en')          // 'en' | 'ja'
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState(null)
  const [added, setAdded] = useState(() => new Set())
  const { statuses, mark } = useWordStatuses(learnerId)
  /* **通しの読み上げは `useBodyAudio` に任せる。**
     鳴っているか / 用意しています… / 止めた場所からの再開は、
     ぜんぶあちらが持っている。**書き写さない** */
  const audio = useBodyAudio()

  const parts = speechParts(speech)
  const phrases = speechPhrases(speech)
  const sentences = speech?.review?.sentences ?? []
  const notes = speech?.review?.notes ?? []

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
      word: p.en, sentence: sentence || p.en, level: 'B1',
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
        <button type="button" className="btn btn--small btn--ghost"
                onClick={() => setView((v) => (v === 'en' ? 'ja' : 'en'))}>
          {view === 'en' ? '訳を見る' : '英語に戻す'}
        </button>
      </div>

      <ol className="speech-sentences">
        {sentences.map((s, i) => (
          <li key={`${i}-${s.en}`} className={audio.now === i ? 'is-on' : ''}>
            {/* 番号は**紙と同じ丸**(`.num-badge`)。**数字を自分で入れる**
                (①②③ の文字は端末ごとに形も大きさも違う・CLAUDE.md) */}
            <span className="num-badge" aria-hidden="true">{i + 1}</span>
            <div className="speech-line">
              {view === 'en' ? (
                <div className="writing-en">
                  <EnglishText text={s.en} textJa={s.ja} level="B1"
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
              <SpeakButton text={s.en} clipVoice={speech.voice_id ?? undefined}
                           tier={PREMIUM} rate={rateOf(rateId)} />
            </div>
          </li>
        ))}
      </ol>

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
