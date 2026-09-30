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
import { speechLevelOf, speechLines, speechPhrases, speechWordList } from '../lib/speechPractice.js'
/* **音声のダウンロード**(第5.300節・利用者の指定)。
   押したあとの段取りも知らせの文言も、**教材とまったく同じ1か所**を使う
   —— 書き写すと、直したときに片方だけ古くなる(CLAUDE.md)。
   **「文章をコピー」と「集中モード」は第5.302節で外した**(利用者の指定) */
import { useAudioDownload } from '../lib/useAudioDownload.js'
import { downloadSpeechAudio } from '../lib/downloadAudio.js'
import { speechClipPieces } from '../lib/audioPlaylist.js'
import AudioDownloadNote from './AudioDownloadNote.jsx'
import { lookupWord, normWord, setWordStatus } from '../lib/vocab.js'
/* **通しで鳴らすボタンの文字は `wholePlay.js` 1か所**(第5.290節・利用者の指定
   「もちろん、全てに全体を聞くを追加して」)*/
import { phraseKind, seenSentenceFor } from '../lib/writingReview.js'
import { DownloadIcon, MicIcon, PlusIcon } from './Icons.jsx'
/* **押しても、まわりの物が動かない**(第5.281節) —— 文字数が変わるので要る */
import SteadyLabel from './SteadyLabel.jsx'

export default function SpeechPractice({ speech, learnerId = null, level = null }) {
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState(null)
  const [added, setAdded] = useState(() => new Set())
  /* **数え方も落とし方も、スピーチのものを渡すだけ。**
     状態・進み具合・文言は教材と同じ道具が持っている */
  const dl = useAudioDownload({
    count: (sp) => speechClipPieces(
      (sp?.review?.sentences ?? []).map((x) => x?.en), sp?.voice_id || null,
    ),
    download: downloadSpeechAudio,
  })

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

  return (
    <div className="card speech-practice">
      <h4 className="card-title">添削の結果</h4>

      {/* **できていたところを先に出す。** 直すところしか言われないと、
          次に書く気が起きない */}
      {speech.review.good && <p className="writing-good">{speech.review.good}</p>}

      {/* ★ **練習そのものは、モノローグ教材の画面が受け持つ**
             (2026-09-30 利用者の指定・第5.323節)

             > 普通の他の教材の画面、つまり1枚目の写真と同じ仕様に
             > する様にしてください。仕組みも同じです。
             > つまり、モノローグの教材と全て同じです。

           ここに在った**自前の音声プレーヤー・文の一覧・訳を見る・速さ**は、
           まるごと `LessonView` に置き換わった(`speechAsMaterial()`)。
           **同じことをする道具を2通り持たない**(CLAUDE.md)。

           このカードに残るのは、**ほかの教材には無いもの**だけである ——
           講評・直したところ・覚えたい語句・音声ダウンロード。
           教材の画面では**畳んだ札の中**に入る(利用者が選んだ案)。 */}
      <div className="speech-bar">
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
