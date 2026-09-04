/**
 * Quick Response — 日本語を見て、すぐ英語で言う。
 *
 * 【何のためか】(2026-08 利用者の指定)
 *   利用者のスクールのトレーニングの1つ。
 *   読んで分かる力と、**話すときに口から出てくる力は別物**である。
 *   宿題でひととおり読んだあと、同じ英文を日本語から言い直すことで、
 *   「見れば分かる」を「言える」に変える。
 *
 * 【材料は作らない。教材にあるものをそのまま使う】
 *   教材には英語と日本語がすでに対で入っている(`quickResponse.js`)。
 *   AI に作り直させれば1回ぶん課金され、しかも
 *   **宿題でやった文とは別の文**になる。それでは復習にならない。
 *   したがって **SQL も Edge Function も生成の費用も要らない。**
 *
 * 【出し方の決まり】単語帳の「日本語 → 英語」と同じ考え方でそろえる
 *   ・**答えの2つ(言えた / 言えなかった)は最初から押せる。**
 *     分かっているものをいちいち開かせない。「英語を見る」は真ん中
 *   ・**開く前に音を鳴らさない。** 鳴らせば答えが聞こえてしまう
 *   ・**順番は教材のまま。** 記事と会話には話の流れがあり、混ぜると場面が飛ぶ
 *     (単語帳は逆に毎回混ぜる。あちらは並び順で覚えてしまうため)
 *
 * 【「まだ」を押した文は残す】(0040・2026-09 利用者の指定・**方針の変更**)
 *   もとは「記録は残さない」だった(単語帳の箱と2か所で動くのを避けるため)。
 *   けれども**言えなかった文は、その教材を開き直さないと二度と出てこない。**
 *
 *   > 教材の中で取り組んだ Quick Response の中で「まだ」を押したものは、
 *   > Quick Response という復習用の機能を独立して作り、
 *   > ひとつのアカウントにつきひとつ持たせてください。
 *
 *   溜める先は単語帳とは**別のもの**(あちらは語、こちらは文)なので、
 *   同じものが2か所で動くことにはならない。
 *   溜めるのは**文章だけ**で、単語・フレーズは単語帳に任せる。
 *   仕組みは `src/lib/qrReviews.js` 1か所。
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { QR_MODES, quickResponseCounts, quickResponsePairs } from '../lib/quickResponse.js'
import { voiceTierFor } from '../lib/voiceTier.js'
import { resolveVoices } from '../data/clipVoices.js'
import { stopReading } from '../lib/readAloud.js'
import QrCard from './QrCard.jsx'
import { CloseIcon } from './Icons.jsx'
import FocusFrame from './FocusFrame.jsx'
import { usePracticeLog } from '../lib/practice.js'
import { progressKey, useProgress } from '../lib/progress.js'
import { markIn } from '../lib/useWordStatuses.js'
import { markQr } from '../lib/qrReviews.js'
import { answerFeedback } from '../lib/haptics.js'

export default function QuickResponse({
  material, onClose, wordStatuses = null, onMarkWord = null, paper = false,
  learnerId = null,
  /**
   * **集中モード**(2026-09 実機・利用者の指摘
   * 「Quick Response で集中モードを押すと違うトレーニングになってしまいます」)。
   *
   * 押すと**本文を読んで語を調べる画面**(`FocusReader`)が開いていた。
   * 6Steps で一度直したのと**同じ取り違え**である —
   * 集中モードは「いま取り組んでいることを、1つずつ画面に固定する」もので、
   * 別のトレーニングへ移るものではない。
   * ここは**もともと1問ずつ**なので、骨組み(`FocusFrame`)に載せるだけでよい。
   *
   * 開いているかどうかは**レッスン表示の側が持つ**(ボタンがあちらの行にある)。
   */
  focus = false, focusWidth = 'w100', onFocusClose = null,
  /**
   * 速さ・文字の大きさ・紙の幅・印刷(2026-09 利用者の指定)。
   * **どの集中モードでも同じものを、同じ場所に置く。**
   */
  focusSettings = null,
}) {
  /* **取り組み方は2通り**(2026-09 利用者の指定)。
       > 文章のモードと、出てきたフレーズ、単語のモードを
       > 切り替えれるようにしてください。
     どちらが何問あるかは先に数える。**0件の側は出さない**
     (効かない操作を見せない・CLAUDE.md) */
  const counts = useMemo(() => quickResponseCounts(material), [material])
  const modes = QR_MODES.filter((m) => counts[m.id] > 0)
  /* **選んだ取り組み方を覚えておく。** 開き直すたびに選ばせない。
     控えが無い教材(片方しか無い)のときは、ある側に落とす */
  const [savedMode, setMode] = useProgress(
    progressKey(material?.id, 'qr', 'mode'), modes[0]?.id ?? 'sentence', learnerId,
  )
  const mode = counts[savedMode] > 0 ? savedMode : (modes[0]?.id ?? 'sentence')
  const pairs = useMemo(() => quickResponsePairs(material, mode), [material, mode])
  // 取り組みを**裏で数える**(0022)。ゲストのぶんだけ数える
  usePracticeLog('quick_response', true, learnerId)
  /* **どの教材で会ったかを添える**(0024) */
  const markWord = markIn(onMarkWord, material?.id, learnerId)
  /* **何問目まで進んだかを覚えておく**(2026-08 利用者の指定)。
     途中で別のページへ行って戻ると、1問目に戻っていた。
     **鍵に取り組み方を入れる。** 文章とフレーズでは問数が違うので、
     1つの鍵で持つと切り替えたときに範囲の外を指す */
  const [savedAt, setAt] = useProgress(
    progressKey(material?.id, 'qr', `at-${mode}`), 0, learnerId,
  )
  // **控えていた場所が、範囲の外になっていることがある**(教材を直したあと)。
  // そのまま使うと問が空になるので、必ず中に収める
  const at = Math.min(Math.max(0, savedAt), Math.max(0, pairs.length - 1))
  const doneRef = useRef([])          // 言えた / 言えなかったの記録(この1回ぶん)
  const [finished, setFinished] = useState(false)

  /* 出題の枠まわり(開く・入るかどうかを測る・送りを戻す・くり返し)は
     **`QrCard` が持つ**(0040)。復習の画面と同じ部品にするためである */

  // 画面を離れるときは、鳴っているものを止める
  useEffect(() => () => stopReading(), [])

  const card = pairs[at] ?? null
  // 本文は良い声で読む。判断は `voiceTier.js` 1か所
  const tier = voiceTierFor({ exerciseType: 'article', tags: material?.tagIds })
  const clipVoice = resolveVoices(material?.voiceIds ?? material?.voice_ids)[0]

  const answer = (ok) => {
    /* **押した手応えを返す**(2026-09 利用者の指定)。
       言えたら**ピンポン**、まだなら低く1つだけ。触る端末のときだけ */
    answerFeedback(ok)
    /* **「まだ」を押した文は、復習に溜める**(0040・2026-09 利用者の指定)。
       これまでは「記録は残さない」と決めていたが、利用者の指定で変えた。
       溜める先は単語帳とは別(あちらは語、こちらは文)なので、
       同じものが2か所で動くことにはならない。
       ・**まだ**   → 溜める
       ・**言えた** → **すでに溜まっている文だけ**箱を1つ上げる
         (`onlyExisting`)。言えた文をわざわざ溜めない
       溜めるのは**文章だけ**(単語・フレーズは単語帳に任せる・利用者の指定)。
       誰の記録になるかは `learnerId` が決める(0025 と同じ考え方)。
       **待たない。** 溜めるのは裏の仕事で、次の問へ進むのを止める理由がない */
    if (card?.group === 'sentence') {
      markQr(card, ok ? 'learning' : 'unknown', {
        materialId: material?.id ?? null, learnerId, onlyExisting: ok,
      })
    }
    doneRef.current = [...doneRef.current, { ...card, ok }]
    if (at + 1 >= pairs.length) { setFinished(true); return }
    setAt(at + 1)
  }

  const restart = () => {
    doneRef.current = []
    setAt(0); setFinished(false)
  }

  /**
   * 取り組み方を変える。
   *
   * **何問目まで進んだかは、取り組み方ごとに覚えている**(鍵が別)。
   * だからここで `setAt(0)` はしない。戻ってきたら続きから始められる。
   * この1回ぶんの数え(言えた / まだ)だけを白紙に戻す。
   */
  const switchMode = (next) => {
    doneRef.current = []
    setFinished(false); stopReading()
    setMode(next)
  }

  if (!pairs.length) {
    return (
      <section className={`qr${paper ? ' qr--paper' : ''}`}>
        <div className="qr-head">
          <strong className="qr-title">Quick Response</strong>
          {onClose && (
            <button type="button" className="nav-icon-btn" onClick={onClose}
                    aria-label="Quick Response を閉じる"><CloseIcon /></button>
          )}
        </div>
        <p className="hint">
          この教材には、日本語と英語が対になった文がありません。
          <br />
          穴埋めとリスニングは英文だけ、内容の理解は設問も答えも英語なので、
          Quick Response には使えません。
        </p>
      </section>
    )
  }

  const ok = doneRef.current.filter((x) => x.ok).length

  /* 集中モードでは、**紙の上と同じ見た目**にする(`.focus-paper` の中なので、
     囲みも地色も要らない)。自分の ✕ も出さない —
     出る道は上の帯の「閉じる」と、右下の「集中モードを終える」である
     (**同じことをするものを2つ見せない**) */
  const onPaper = paper || focus
  const body = (
    <section className={`qr${onPaper ? ' qr--paper' : ''}`}>
      <div className="qr-head">
        {/* 紙(大きく表示)では、すぐ上のボタンが「Quick Response」なので
            ここには出さない。**同じ言葉を20px 離して2度書かない** */}
        {!onPaper && <strong className="qr-title">Quick Response</strong>}
        {/* **取り組み方**(2026-09 利用者の指定)。
            両方あるときだけ出す。片方しか無い教材で選ばせても意味がない。
            **プルダウンにする**(6Steps と同じ考え方。札を並べると
            狭い画面で2段になり、紙の上では場所を食う) */}
        {modes.length > 1 && (
          <div className="qr-mode" role="group" aria-label="取り組み方">
            {modes.map((m) => (
              <button key={m.id} type="button"
                      className={`qr-modebtn${mode === m.id ? ' is-active' : ''}`}
                      aria-pressed={mode === m.id}
                      onClick={() => switchMode(m.id)}>
                {m.label} <span className="qr-modecount">{counts[m.id]}</span>
              </button>
            ))}
          </div>
        )}
        <span className="qr-count">
          {finished ? `${pairs.length} / ${pairs.length}` : `${at + 1} / ${pairs.length}`}
        </span>
        {onClose && !focus && (
          <button type="button" className="nav-icon-btn" onClick={onClose}
                  aria-label="Quick Response を閉じる"><CloseIcon /></button>
        )}
      </div>

      {/* どこまで来たか。**終わりが見えないと続かない**(単語帳と同じ) */}
      <div className="qr-bar" aria-hidden="true">
        <span style={{ width: `${Math.round(((finished ? pairs.length : at) / pairs.length) * 100)}%` }} />
      </div>

      {finished ? (
        <div className="qr-result">
          <p className="qr-result-score">
            <strong>{ok} / {pairs.length} 言えました。</strong>
          </p>
          <ul className="qr-result-list">
            {doneRef.current.filter((x) => !x.ok).map((x, i) => (
              <li key={i}>
                <span className="qr-result-ja">{x.ja}</span>
                <span lang="en">{x.en}</span>
              </li>
            ))}
          </ul>
          {ok === pairs.length
            ? <p className="hint">全部言えました。</p>
            : <p className="hint">上に出ているのが、言えなかった文です。</p>}
          <div className="btn-row">
            <button type="button" className="btn btn--primary" onClick={restart}>
              もう一度
            </button>
            {onClose && (
              <button type="button" className="btn" onClick={onClose}>とじる</button>
            )}
          </div>
        </div>
      ) : (
        /* **1問ぶんの見た目は `QrCard` 1か所**(0040)。
           復習の画面(`QrReview`)と**同じ部品**を使う。
           書き写すと必ず片方だけ古くなる(単語帳で踏んだ失敗)。
           教材の中では言葉づかいを「まだ / 言えた」のままにする
           (2026-09 利用者の指定。復習の画面だけ「まだ / 言える」) */
        <QrCard pair={card} no={at + 1} level={material?.level}
                clipVoice={clipVoice} tier={tier}
                wordStatuses={wordStatuses} onMarkWord={markWord}
                onAnswer={answer} yetLabel="まだ" okLabel="言えた" />
      )}
    </section>
  )

  /* **骨組みは `FocusFrame` 1つ**(`FocusReader` / `StepFocus` と共通)。
     下の帯は**渡さない** — Quick Response は「まだ / 言えた」で進むので、
     ◀ 前 / 次 ▶ を置くと進め方が2つになる */
  if (!focus) return body
  return (
    <FocusFrame
      className="qrfocus"
      /* **紙の幅をそのまま引き継ぐ**(ほかの集中モードと同じ) */
      width={focusWidth}
      learnerId={learnerId}
      /* 線は**取り組み方 × 何問目**ごとに持つ */
      page={`${mode}:${at}`}
      scrollKey={`${mode}:${at}`}
      onClose={onFocusClose}
      settings={focusSettings}
    >
      {body}
    </FocusFrame>
  )
}
