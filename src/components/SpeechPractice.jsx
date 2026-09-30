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
 *   通しは `useBodyAudio`(紙と同じ道具)、
 *   1文ずつは `SpeakButton`、単語帳は `lookupWord` → `setWordStatus`、
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
import { useState } from 'react'
import {
  speechLevelOf, speechLines, speechParts, speechPhrases,
  speechWholeSlice, speechWordList,
} from '../lib/speechPractice.js'
import useBodyAudio from '../lib/useBodyAudio.js'
/* **音声のダウンロード**(第5.300節・利用者の指定)。
   押したあとの段取りも知らせの文言も、**教材とまったく同じ1か所**を使う
   —— 書き写すと、直したときに片方だけ古くなる(CLAUDE.md)。
   **「文章をコピー」と「集中モード」は第5.302節で外した**(利用者の指定) */
import { useAudioDownload } from '../lib/useAudioDownload.js'
import { downloadSpeechAudio } from '../lib/downloadAudio.js'
import { speechClipPieces } from '../lib/audioPlaylist.js'
import AudioDownloadNote from './AudioDownloadNote.jsx'
import { SPEECH_RATES, loadRateId, rateOf, saveRateId } from '../lib/speechRate.js'
import useWordStatuses, { markIn } from '../lib/useWordStatuses.js'
import { lookupWord, normWord, setWordStatus } from '../lib/vocab.js'
import { PREMIUM } from '../lib/voiceTier.js'
/* **通しで鳴らすボタンの文字は `wholePlay.js` 1か所**(第5.290節・利用者の指定
   「もちろん、全てに全体を聞くを追加して」)*/
import { phraseKind, seenSentenceFor } from '../lib/writingReview.js'
import EnglishText from './EnglishText.jsx'
import { DownloadIcon, MicIcon, PlusIcon } from './Icons.jsx'
/* ★ **音声プレーヤーは、紙とまったく同じ部品**(2026-09-30 利用者の指定・
     第5.322節)
     > スピーチ練習にも同じプレーヤーを配置してください
   もとは「全体を聞く」+「繰り返す」+ 速さの欄を自分で並べていた。
   **同じことをする道具を2通り持つと、片方だけ古くなる**(CLAUDE.md)。 */
import PlayerBar from './PlayerBar.jsx'
import SpeakButton from './SpeakButton.jsx'
/* **押しても、まわりの物が動かない**(第5.281節) —— 文字数が変わるので要る */
import SteadyLabel from './SteadyLabel.jsx'
import Stepper from './Stepper.jsx'

export default function SpeechPractice({ speech, learnerId = null, level = null }) {
  const [rateId, setRateId] = useState(loadRateId)
  const [view, setView] = useState('en')          // 'en' | 'ja'
  /* プレーヤーの速さの数字を押した回数。**真偽ではなく数で持つ** ——
     真偽だと、2度めに押しても値が変わらず、欄へ寄らない */
  const [wantRate, setWantRate] = useState(0)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState(null)
  const [added, setAdded] = useState(() => new Set())
  const { statuses, mark } = useWordStatuses(learnerId)
  /* **通しの読み上げは `useBodyAudio` に任せる。**
     鳴っているか / 用意しています… / 止めた場所からの再開は、
     ぜんぶあちらが持っている。**書き写さない** */
  const audio = useBodyAudio()
  /* **数え方も落とし方も、スピーチのものを渡すだけ。**
     状態・進み具合・文言は教材と同じ道具が持っている */
  const dl = useAudioDownload({
    count: (sp) => speechClipPieces(
      (sp?.review?.sentences ?? []).map((x) => x?.en), sp?.voice_id || null,
    ),
    download: downloadSpeechAudio,
  })

  const parts = speechParts(speech)
  const phrases = speechPhrases(speech)
  /* **描くのも、鳴らすのも、区間を数えるのも、この1つの並び**
     (`speechLines`)。番号が1つでもずれると、**別の文が鳴る** */
  const sentences = speechLines(speech)
  const notes = speech?.review?.notes ?? []
  /* **レベルはゲストのものを使う**(2026-09 利用者の指定)。
     判断は `speechLevelOf()` 1か所 —— 画面で `'B1'` と書かない */
  const lv = speechLevelOf(level)

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

  /**
   * 1文ぶんの中身。
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

      {/* ★ **紙とまったく同じ音声プレーヤー**(第5.322節)。
             `place="dock"` そのままで、**画面に貼り付けない**だけ
             (`--inline`)—— ここはページの中のカードである。

           **単位は「文」。** ここでは1つの部が1文なので、
           くり返しは **しない / 文 / 全文** の3段になる
           (`repeatUnitsFor()` が、呼び名の重なる段を落とす)。 */}
      <div className="player-dock player-dock--inline no-print">
        <PlayerBar
          place="dock"
          playing={audio.playing}
          waiting={audio.waiting} secs={audio.secs}
          at={audio.now} total={parts.length} unit="文"
          onToggle={() => audio.toggle({
            parts, rate: rateOf(rateId), tier: PREMIUM,
            resumeKey: `speech|${speech.id}`,
          })}
          onJump={(n) => audio.jump({
            parts, rate: rateOf(rateId), tier: PREMIUM,
            resumeKey: `speech|${speech.id}`, startIndex: n,
          })}
          repeat={audio.repeat} onRepeat={audio.setRepeat}
          /* **いまの速さは読むだけ。** 変えるのは下の欄1つ
             (紙が「設定」を開くのと同じ考え方) */
          rateText={SPEECH_RATES.find((r) => r.id === rateId)?.label ?? null}
          onOpenRate={() => setWantRate((n) => n + 1)}
        />
      </div>

      <div className="speech-bar">
        {/* 速さは**端末に覚えた1つ**を使う(どの画面でも同じ速さで鳴る)。
            **プレーヤーの数字を押すと、ここへ来る**(道は1つ) */}
        <Stepper label="速さ" options={SPEECH_RATES} value={rateId}
                 focusMe={wantRate}
                 onChange={(id) => { audio.stop(); setRateId(id); saveRateId(id) }} />
        {/* **並べない。入れ替える。** 並べると箱が2倍になる */}
        <button type="button" className="btn btn--small btn--ghost speech-swap"
                onClick={() => setView((v) => (v === 'en' ? 'ja' : 'en'))}>
          {view === 'en' ? '訳を見る' : '英語に戻す'}
        </button>
        {/* **音声のダウンロード**(第5.300節)。
            集めるのも文言も、教材と同じ1か所を通る。
            **窓口は呼ばないので、1円もかからない** */}
        {dl.pieces(speech) > 0 && (
          <button type="button" className="btn btn--small btn--ghost speech-dl"
                  disabled={!!dl.busy} onClick={() => dl.start(speech)}>
            <DownloadIcon />
            <SteadyLabel keep={dl.labelKeep(speech)}>{dl.label(speech)}</SteadyLabel>
          </button>
        )}
      </div>
      {/* **知らせは、押した場所のすぐ下**(行の中に入れると横に並ぶ) */}
      <AudioDownloadNote done={dl.done} materialId={speech.id} speech />

      <ol className="speech-sentences">
        {sentences.map((s, i) => (
          <li key={`${i}-${s.en}`} className={audio.now === i ? 'is-on' : ''}>
            {lineOf(s, i)}
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
