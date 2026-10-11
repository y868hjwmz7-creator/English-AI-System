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
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  QR_MODES, qrSaves, qrSourceOf, quickResponseCounts, quickResponsePairs,
} from '../lib/quickResponse.js'
/* ★ **声と段は、ここで求めない**(第5.446節)。
   `quickResponsePairs()` が本文と同じ道で対ごとに当てている ——
   ここで持つと、置き場所が食い違って二度課金になる */
import { stopReading } from '../lib/readAloud.js'
import QrCard from './QrCard.jsx'
import {
  CloseIcon, SortIcon,
} from './Icons.jsx'
import FocusFrame from './FocusFrame.jsx'
import { usePracticeLog } from '../lib/practice.js'
import { progressKey, useProgress } from '../lib/progress.js'
import { markIn } from '../lib/useWordStatuses.js'
import { markQr } from '../lib/qrReviews.js'
import { answerFeedback } from '../lib/haptics.js'
/* ★ **教材の中の Quick Response でも聞き流す**(第5.287節・
   2026-09-27 利用者の指定「教材内のquick responseにも聞き流しの機能を」)。

   ★ **別の画面へ飛ぶのをやめた**(第5.445節・②・2026-10-10 利用者の指摘)
   —— 聞き流しは**このカードの上の状態**である。回し続ける算段は
   `useRadioRun()` 1か所、1枚ぶんを鳴らすのは `playRadioRow()` 1か所で、
   復習の Quick Response・単語帳と**まったく同じものを通る。**
   送り方(番号を1つ進める)は `cardCursor.js` 1か所である */
import useRadioRun from '../lib/useRadioRun.js'
import { indexCursor } from '../lib/cardCursor.js'
import RadioToggle from './RadioToggle.jsx'
import RadioSettings from './RadioSettings.jsx'
import SettingsSheet from './SettingsSheet.jsx'

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

  /**
   * ★ **教材の中の Quick Response も聞き流す**(第5.287節・
   * 2026-09-27 利用者の指定「教材内のquick responseにも聞き流しの機能を」)。
   *
   * **材料は、いま画面に出している対そのもの**(`pairs`)——
   * 取り組み方(文章 / フレーズ・単語 / 覚えておきたい表現)で
   * 絞ったあとのものが、そのまま流れる。**組み直さない**ので、
   * 練習と聞き流しで中身が食い違うことがない。
   *
   * 曲は**押したときに引く**(押さない人には1回も問い合わせが飛ばない)。
   * **曲が0本でも聞き流しは始まる**(音楽が鳴らないだけ・行き止まりを作らない)。
   */
  /**
   * ★ **どこまで来たかは、控えが本体である**(第5.445節・②)。
   *
   * **画面を消すと React は描き直さない**(第5.285節)。聞き流しは
   * 間を無音の音で置いているので鳴り続けるが、**「次へ」を `setAt` だけで
   * 書くと、次に鳴らす行を読んだときまだ前の値**になり、
   * 同じ行を何度も鳴らす(2026-09 に実機で踏んだ)。
   *
   * **送るのは `putAt()` 1か所**で、控えと画面を必ず一緒に動かす。
   */
  const atRef = useRef(at)
  const putAt = (i) => { atRef.current = i; setAt(i) }
  /* **外から動いたぶんも、控えに写す**(取り組み方を替えた・読み直した) */
  useEffect(() => { atRef.current = at }, [at])
  const pairsRef = useRef(pairs)
  pairsRef.current = pairs

  /**
   * ★ **聞き流しは、このカードの上の状態**(第5.445節・②)。
   *
   * **送り方は `cardCursor.js` 1か所**(番号を1つ進める形)。
   * 端まで行ったら回り込む —— 聞き流しは終わりを決めずに回すものである。
   */
  const 送り = indexCursor({
    list: () => pairsRef.current,
    at: () => atRef.current,
    set: putAt,
  })
  const radio = useRadioRun({
    cursor: 送り,
    where: 'qr',
    /* **題は、画面に出ているものをそのまま**(第5.264節)——
       ロック画面に出るので、書き写すと冊を替えた日だけ古くなる */
    label: [material?.title, QR_MODES.find((m) => m.id === mode)?.label]
      .filter(Boolean).join(' / '),
  })
  /** 聞き流しの設定(読み方・間・曲・音量)を開いているか */
  const [setsOpen, setSetsOpen] = useState(false)
  const setsRef = useRef(null)
  const uid = useId()
  /* **出し切ったら止める。** `finished` では問のカードが消えるので、
     流し続けると**見えない1枚が鳴り続ける**(効かない操作を残さない) */
  useEffect(() => { if (finished && radio.on) radio.stop() }, [finished])

  /* 出題の枠まわり(開く・入るかどうかを測る・送りを戻す・くり返し)は
     **`QrCard` が持つ**(0040)。復習の画面と同じ部品にするためである */

  // 画面を離れるときは、鳴っているものを止める
  useEffect(() => () => stopReading(), [])

  const card = pairs[at] ?? null
  /* ★ **声と段は、対そのものが持っている**(第5.446節・2026-10-11
       利用者の指定「復習はその時の声のキャラで構いません」)。

     もとはここで**教材ぜんぶに1つ**を求めていた ——
     `exerciseType: 'article'` の決め打ちと、**1人目の声**である。
     そのため**会話教材でも、どの台詞も1人目の声**で鳴っていた。

     いまは `quickResponsePairs()` が、本文とまったく同じ道
     (`castClipSpeakers()` / `voiceFor()` / `voiceTierFor()`)で
     **役ごと・節ごと**に当てている。ここで求め直すと
     **置き場所が食い違って二度課金**になる(CLAUDE.md
     「数え方を2通り持たない」)。 */

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
       溜めるかどうかと、**どの冊へ溜めるか**は `quickResponse.js` 1か所
       (`qrSaves()` / `qrSourceOf()`)。**ここで `group === '…'` と書かない** ——
       取り組み方を足した日に、画面の数だけ直すことになる(CLAUDE.md)。
       単語・フレーズは**単語帳**が持つので溜めない(利用者の指定)。
       「覚えておきたい表現」は**別の冊**へ溜まる(0066・第5.237節)。
       誰の記録になるかは `learnerId` が決める(0025 と同じ考え方)。
       **待たない。** 溜めるのは裏の仕事で、次の問へ進むのを止める理由がない */
    if (qrSaves(card)) {
      markQr(card, ok ? 'learning' : 'unknown', {
        materialId: material?.id ?? null, learnerId, onlyExisting: ok,
        source: qrSourceOf(card),
      })
    }
    doneRef.current = [...doneRef.current, { ...card, ok }]
    if (at + 1 >= pairs.length) { setFinished(true); return }
    /* **送るのは `putAt()` 1か所**(第5.445節)—— 控えと画面を一緒に動かす */
    putAt(at + 1)
  }

  const restart = () => {
    doneRef.current = []
    putAt(0); setFinished(false)
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
     **出る道は、上の帯の「閉じる」1つ**である
     (**同じことをするものを2つ見せない**)。

     右下の「集中モードを終える」は**第5.250節で消えた** ——
     この画面は下の帯を渡さないので、浮かせる先が無く、
     「言えた」に重なっていた(`FocusFrame` 側で決めている) */
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
        {/* ★ **聞き流し**(第5.287節)。**見た目も言葉も、復習の
            Quick Response とまったく同じ**(`qr-top-listen`)——
            同じことをするものを、別の見た目で出さない。

            ★ **押すと、このカードのまま流れ始める**(第5.445節・③)。
            もとは**別の画面へ飛んでいた。** 流しているあいだは「とめる」
            になり、金が入る —— **中身は `RadioToggle` 1か所**である */}
        <RadioToggle className="qr-top-listen" unit="問"
                     on={radio.on} onToggle={radio.toggle}
                     count={pairs.length} disabled={pairs.length === 0} />
        {/* ★ **聞き流しの設定は、三本線と丸から**(第5.445節・④・
            2026-10-10 利用者の指定「聞き流しの設定は右上にしましょう」)。
            **絵は復習の「出しかた」と同じ `SortIcon`** ——
            同じ働きのボタンに、同じ絵(歯車は使わない・共通ルール) */}
        <button type="button" ref={setsRef}
                className="nav-icon-btn qr-top-sets"
                aria-label="聞き流しの設定" title="聞き流しの設定"
                aria-expanded={setsOpen}
                onClick={() => setSetsOpen((v) => !v)}>
          <SortIcon />
        </button>
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
              <button type="button" className="btn btn--ghost" onClick={onClose}>とじる</button>
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
                /* ★ **声と段は渡さない**(第5.446節)—— 対そのものが
                   持っており、`QrCard` がそこから取る(受け皿の props に
                   同じものを入れると、**2か所に同じ値**を持つことになる) */
                wordStatuses={wordStatuses} onMarkWord={markWord}
                /* ★ **流しているあいだ、4つめの絵は ■**(第5.445節・②)。
                   **絵は4つのまま** —— 5つめを足さない(利用者の指摘) */
                radioOn={radio.on} onRadioStop={radio.stop}
                onAnswer={answer} yetLabel="まだ" okLabel="言えた" />
      )}
    </section>
  )

  /**
   * ★ **聞き流しは、どちらの出し方の上にも置く**(第5.287節)。
   *
   * この画面は**2通りの返し方**を持っている(紙の中と、集中モード)。
   * 片方にだけ置くと、**入口によって聞き流せたり聞き流せなかったり**する。
   *
   * 題は**いま出している教材と取り組み方**をそのまま並べる ——
   * 聞きながら「何を聞いているのか」が分かる(第5.264節)。
   */
  const overlays = setsOpen ? (
    <SettingsSheet
      anchorEl={setsRef.current}
      onClose={() => setSetsOpen(false)}
      title="聞き流しの設定"
      /* 読み方を変えると間の札が入れ替わり、箱の高さが変わる。
         **置き直す合図を渡す** */
      placeKey={`${radio.settings.mode}/${radio.settings.gap}/${radio.settings.pick}`}
    >
      {/* **欄の形は `RadioSettings` 1か所**(復習の「出しかた」の中と
          まったく同じもの)。ここは置き場所だけを決める */}
      <RadioSettings uid={uid} {...radio.settings} />
    </SettingsSheet>
  ) : null

  /* **骨組みは `FocusFrame` 1つ**(`FocusReader` / `StepFocus` と共通)。
     下の帯は**渡さない** — Quick Response は「まだ / 言えた」で進むので、
     ◀ 前 / 次 ▶ を置くと進め方が2つになる */
  if (!focus) {
    return (
      <>
        {body}
        {overlays}
      </>
    )
  }
  return (
    <>
      <FocusFrame
        /* ★ **終わったら、入れ物も中身なりに伸ばす**(第5.387節)。
             伸ばさないと、終わりの一覧が**地の色を塗っている箱からはみ出し**、
             途中から背景が切り替わる(実測 2906px の一覧が 809px の紙の中にいた) */
        className={`qrfocus${finished ? ' is-done' : ''}`}
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
      {overlays}
    </>
  )
}
