/**
 * レッスンで使う表示(画面共有用)。
 *
 * 【なぜ必要か】
 *   レッスン中に画面を共有して、弱点の問題を一緒に解く。そのとき
 *   ふだんの画面はボタンやタブが多く、**共有される側には読みにくい。**
 *   利用者から「アプリ上でも PDF に近い表示にできないか」と要望があった
 *   (2026-08)。紙に刷ったときと同じ見え方を、画面の上で出す。
 *
 * 【決めたこと】
 *   ・**紙は白のまま。** 暗い配色を選んでいても、ここだけは白い紙にする。
 *     画面共有では白いほうが見やすく、「PDF に近い」という要望にも合う
 *   ・演習ごとに1枚。行ったり来たりできる。40問を延々と流さない
 *   ・**解答の出し方を切り替えられる。** レッスンでは伏せておいて、
 *     答え合わせのときに出す。トレーナーが手元で決める
 *   ・文字の大きさを3段階で変えられる。共有先の画面の大きさが分からないため
 */
import { useEffect, useRef, useState } from 'react'
import { countLabel, exerciseLabel, exerciseType, isPassageSection } from '../data/exerciseTypes.js'
import { weaknessTagLabel } from '../data/weaknessTags.js'
import { printElement } from '../lib/print.js'
import { loadEnglishVoices } from '../lib/speech.js'
import { readAloudSequence, stopReading } from '../lib/readAloud.js'
import { voiceTierFor } from '../lib/voiceTier.js'
import { castClipSpeakers, castVoices, voiceFor } from '../lib/voiceCast.js'
import { resolveVoices } from '../data/clipVoices.js'
import { SPEECH_RATES, loadRateId, rateOf, saveRateId } from '../lib/speechRate.js'
import { BoltIcon, GearIcon, PrintIcon, SpeakerIcon, StepsIcon, StopIcon } from './Icons.jsx'
import EnglishText from './EnglishText.jsx'
import { prefetchGlosses } from '../lib/vocab.js'
import MaterialTitle from './MaterialTitle.jsx'
import QuickResponse from './QuickResponse.jsx'
import PassagePractice from './PassagePractice.jsx'
import { hasQuickResponse } from '../lib/quickResponse.js'
import SpeakButton from './SpeakButton.jsx'
import PhraseChips from './PhraseChips.jsx'
import { PALETTES, applyPalette, loadPalette } from '../lib/palette.js'

const SIZES = [
  { id: 'm', label: '標準' },
  { id: 'l', label: '大' },
  { id: 'xl', label: '特大' },
]

/**
 * 文字の大きさを覚えておく。
 * **一度決めれば、毎回選ぶものではない。** 覚えないから、開くたびに
 * 上の操作欄を触ることになり、それが場所を取る原因にもなっていた。
 */
const SIZE_KEY = 'eas.lessonSize'
const loadSize = () => {
  try {
    const id = window.localStorage.getItem(SIZE_KEY)
    return SIZES.some((s) => s.id === id) ? id : 'l'
  } catch { return 'l' }
}
const saveSize = (id) => {
  try { window.localStorage.setItem(SIZE_KEY, id) } catch { /* 使えなくても困らない */ }
}

export default function LessonView({
  material, onClose,
  // ゲストが開いたときは「知っていた / 知らなかった」も付けられる。
  // トレーナーが開いたときは意味を見るだけ(申告はゲスト本人のもの)
  wordStatuses = null, onMarkWord = null,
}) {
  const sections = material?.sections ?? []
  const [page, setPage] = useState(0)
  // 解答の出し方は2通り。**両方要る。**
  //   ・右上のボタン … 全部まとめて出す / 隠す(答え合わせのとき)
  //   ・問ごとのボタン … 1問ずつ出す / 隠す(一緒に進めるとき)
  //
  // 問ごとの状態は、右上の設定に対する「例外」として持つ。
  //   全部隠しているとき … openItems に入っているものだけ出す
  //   全部出しているとき … closedItems に入っているものだけ隠す
  // こうすると、**どちらの状態からでも1問ずつ開け閉めできる。**
  // 一度見た解答をまた隠して解き直す、という使い方のため(2026-08 の要望)。
  const [showAnswers, setShowAnswers] = useState(false)
  const [openItems, setOpenItems] = useState(() => new Set())
  const [closedItems, setClosedItems] = useState(() => new Set())
  const [size, setSize] = useState(loadSize)
  // 画面の狭い端末では、めったに触らない設定をしまっておく。
  // **一度決めれば何度も要らないもの**(速さ・配色・文字の大きさ・印刷)。
  // パソコンでは常に出したままにする(CSS が決める。第5.22節)
  const [openSettings, setOpenSettings] = useState(false)
  // Esc の扱いで今の状態を見たい。`useEffect` の中から読めるように控える
  const openSettingsRef = useRef(false)
  openSettingsRef.current = openSettings
  // 通しの練習を出しているか。null / 'qr'(Quick Response)/ 'six'(6Steps)。
  // **教材1本 / 本文1本を通しでやる**ので、出しているあいだは
  // ページ送りと解答のボタンを出さない(効かないため)
  const [run, setRun] = useState(null)
  const runRef = useRef(null)
  runRef.current = run
  const qr = run === 'qr'
  // 読み上げの速さ。**画面に1つだけ。** 端末に覚えさせる(2026-08 利用者の指定)
  const [rateId, setRateId] = useState(loadRateId)
  // 読み上げ。**会話は話す人ごとに声を変える**(2026-08 の指摘)。
  // 同じ声だと、どちらが話しているのか耳で分からない。
  const [voices, setVoices] = useState([])
  const [playingAll, setPlayingAll] = useState(false)
  // いま読み上げている項目。**色で示す。**
  // 通しで聞いているとき、どこを読んでいるのか目で追えないと
  // オーバーラッピングもシャドーイングもできない(2026-08 の要望)。
  const [speakingKey, setSpeakingKey] = useState(null)
  // いま読み上げている語の位置(もとの英文の何文字目か)。
  // **語ごとに色を移していくために要る**(2026-08 利用者の指定)。
  // 合図を出さない端末(iOS の Safari)では null のままで、
  // これまでどおり「文のかたまり」の色分けだけが残る
  const [readingAt, setReadingAt] = useState(null)
  // 色を使うかどうか。**ここで選べることが要る。**
  // レッスン中はこの画面から離れないので、上の見出しまで戻れない
  const [palette, setPalette] = useState(loadPalette)
  const stopAllRef = useRef(null)

  /** 通しの読み上げを止める */
  const stopAll = () => {
    stopAllRef.current?.()
    stopAllRef.current = null
    stopReading()
    setPlayingAll(false)
    setSpeakingKey(null)
  }

  /** ページを移ったら、1問ずつの開け閉めと読み上げを元に戻す */
  const resetItems = () => {
    setOpenItems(new Set())
    setClosedItems(new Set())
    stopAll()
  }

  useEffect(() => {
    let alive = true
    loadEnglishVoices().then((list) => { if (alive) setVoices(list) })
    return () => { alive = false; stopReading() }
  }, [])

  // 読んでいるところが画面の外に出ないよう、そこまで送る。
  // `nearest` なので、すでに見えていれば動かない(押した直後に飛ばない)。
  useEffect(() => {
    if (!speakingKey) return
    document.querySelector(`[data-key="${window.CSS.escape(speakingKey)}"]`)
      ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [speakingKey])

  // **開いた時点で、まだ控えに無い語を裏で引いておく。**
  // 触れてから引きに行くと、はじめての語は数秒待たされる(2026-08 の要望)。
  // 見えているページの分だけ。全ページを一度に引くと無駄が出る。
  useEffect(() => {
    const sec = sections[page]
    if (!sec) return
    const texts = sec.items
      .map((it) => it.prompt_en || it.question || '')
      .filter(Boolean)
      .map((text) => ({ text }))
    prefetchGlosses(texts, { level: material?.level })
  }, [page, sections, material?.level])

  // 開いているあいだは、後ろの画面を動かさない
  useEffect(() => {
    const before = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = before }
  }, [])

  // Esc で閉じる。左右の矢印でページを送る。
  //
  // **`if (e.key !== 'Escape') return` を先頭に置いてはいけない。**
  // 「表示」を先に閉じる仕組みを足したとき(2026-08)これを置いてしまい、
  // **矢印でページを送れなくなっていた。** 早く帰る条件を足すときは、
  // その下にある処理が何を見ているかを必ず確かめる。
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        // **開いているものから閉じる。** いきなり画面ごと閉じない
        if (openSettingsRef.current) { setOpenSettings(false); return }
        if (runRef.current) { setRun(null); return }
        stopReading(); onClose?.()
        return
      }
      // 通しの練習のあいだはページという考え方が無い(教材1本を通す)
      if (runRef.current) return
      if (e.key === 'ArrowRight') {
        setPage((p) => Math.min(p + 1, sections.length - 1))
        resetItems()
      }
      if (e.key === 'ArrowLeft') {
        setPage((p) => Math.max(p - 1, 0))
        resetItems()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, sections.length])

  if (!material) return null
  // 弱点は教材名にも入る。**全部入っているなら、札は出さない**(同じ言葉が
  // 2度並ぶため)。1つでも欠けていれば、**全部**を札で出す。
  // 一部だけを出すと、何が抜けているのか分からない一覧になる。
  const allTags = material.tagIds ?? []
  const titleText = String(material.title ?? '')
  const extraTags = allTags.every((t) => titleText.includes(weaknessTagLabel(t))) ? [] : allTags
  const section = sections[page]
  const key = (it, i) => it.id ?? `${page}-${i}`

  /** その問の解答が出ているか */
  const isOpen = (k) => (showAnswers ? !closedItems.has(k) : openItems.has(k))

  /** その問の解答を出す / 隠す */
  const toggleItem = (k) => {
    const target = showAnswers ? closedItems : openItems
    const next = new Set(target)
    if (next.has(k)) next.delete(k)
    else next.add(k)
    if (showAnswers) setClosedItems(next)
    else setOpenItems(next)
  }
  const type = section ? exerciseType(section.exercise_type) : null
  const isPassage = section ? isPassageSection(section.exercise_type) : false
  // 話す人 → 声。会話でないときは空(既定の声が使われる)
  const cast = castVoices(voices, (section?.items ?? []).map((it) => it.speaker))
  // こちらで作った音声(MP3)の話者。端末の声から換算しない(voiceCast.js)
  // 訛りは教材が決め、性別は役ごとに決まる(0017)
  const clipCast = castClipSpeakers(
    (section?.items ?? []).map((it) => it.speaker), material.voiceIds,
  )
  // 話す人が無い教材(ドリルなど)でも、1つめの声で読む
  const soloVoice = resolveVoices(material.voiceIds)[0]
  // 良い声を使うか、標準の声で足りるか(`voiceTier.js`)。
  // 記事・会話とリスニング、それに**発音・リズムの弱点**なら良い声にする
  const tier = voiceTierFor({ exerciseType: section?.exercise_type, tags: allTags })
  // 日本語と英語が対になった文が1つでもあれば、Quick Response ができる。
  // **穴埋め・リスニング・内容の理解しか無い教材では出さない**(`quickResponse.js`)
  const qrPossible = hasQuickResponse(material)
  // 6Steps は本文(記事・会話)に対する練習である。**本文のページを探して渡す。**
  // いま開いているページが語句や設問でも、6Steps は本文に対して行う
  const passageSection = sections.find((x) => isPassageSection(x.exercise_type)) ?? null

  /** 本文を頭から通して読み上げる。話す人が変わると声も変わる */
  const playWhole = () => {
    if (playingAll) { stopAll(); setReadingAt(null); return }
    // 先に「読めるもの」だけに絞る。絞ったあとで番号を数えないと、
    // 色を付ける場所が1つずれる
    const playable = (section?.items ?? [])
      .map((it, i) => ({ it, key: key(it, i) }))
      .filter(({ it }) => String(it.prompt_en ?? '').trim())
    if (!playable.length) return
    setPlayingAll(true)
    stopAllRef.current = readAloudSequence(
      playable.map(({ it }) => ({
        text: it.prompt_en,
        voice: voiceFor(cast, it.speaker),
        clipVoice: voiceFor(clipCast, it.speaker, soloVoice),
      })),
      {
        rate: rateOf(rateId),
        clipTier: tier,
        onIndex: (i) => {
          if (i === null) { stopAllRef.current = null; setPlayingAll(false) }
          setSpeakingKey(i === null ? null : playable[i]?.key ?? null)
          setReadingAt(null)   // 次の文に移ったら、前の語の色を消す
        },
        onWord: (w) => setReadingAt(w ? w.charIndex : null),
      },
    )
  }

  return (
    <div className="lesson" role="dialog" aria-label="レッスンで使う表示">
      {/* 操作するところ。共有される側にも見えるが、紙の外に置く */}
      <div className="lesson-bar no-print">
        {/* ── いつも要るもの。**この1行に収める** ──────────────
            スマホでは操作欄が4段になり、画面の4割を占めていた
            (2026-08 実機)。レッスン中に何度も触るのは
            「閉じる・ページ送り・解答」の3つだけである。
            狭い画面では言葉も短くする(`.wide-text` を隠す)。 */}
        <button type="button" className="btn btn--small"
                aria-label="閉じる"
                onClick={() => { stopReading(); onClose?.() }}>
          ✕<span className="wide-text"> 閉じる</span>
        </button>

        {/* Quick Response のあいだは出さない。**教材1本を通しでやる**ので
            ページという考え方が無く、解答は1問ずつその場で出るためである。
            効かないボタンを残しておくほうが、迷わせる */}
        {!run && (
          <>
            <div className="lesson-pages">
              <button type="button" className="btn btn--small"
                      disabled={page === 0} aria-label="前のページ"
                      onClick={() => { setPage(page - 1); resetItems() }}>◀</button>
              <span>{page + 1} / {sections.length}</span>
              <button type="button" className="btn btn--small"
                      disabled={page >= sections.length - 1} aria-label="次のページ"
                      onClick={() => { setPage(page + 1); resetItems() }}>▶</button>
            </div>

            <button type="button"
                    className={`btn btn--small${showAnswers ? ' btn--primary' : ''}`}
                    onClick={() => {
                      // 全部出す・全部隠す。1問ずつ開いたものも一緒に閉じる
                      setShowAnswers(!showAnswers)
                      setOpenItems(new Set())
                      setClosedItems(new Set())
                    }}>
              <span className="wide-text">すべての</span>
              解答を{showAnswers ? '隠す' : '出す'}
            </button>
          </>
        )}

        {/* ── しまっておくもの ────────────────────────────────
            速さ・配色・文字の大きさ・印刷は、**一度決めれば何度も
            要らない。** 狭い画面ではここに畳み、押したときだけ出す。
            パソコンでは畳まない(CSS が決めるので、この札も出ない)。 */}
        <button type="button" className="btn btn--small lesson-more"
                aria-expanded={openSettings} aria-controls="lesson-settings"
                onClick={() => setOpenSettings((v) => !v)}>
          <GearIcon />表示
        </button>

        <div className={`lesson-settings${openSettings ? ' is-open' : ''}`}
             id="lesson-settings">
          <label className="lesson-rate">
            <span>速さ</span>
            <select value={rateId}
                    onChange={(e) => { setRateId(e.target.value); saveRateId(e.target.value); stopAll() }}>
              {SPEECH_RATES.map((r) => (
                <option key={r.id} value={r.id}>{r.label}({r.id}%)</option>
              ))}
            </select>
          </label>
          {/* 色づかい。カラー = 訳・解答・補足を色で見分ける /
              プレイン = 黒とグレーだけ(2026-08 利用者の指定) */}
          <div className="lesson-sizes">
            {PALETTES.map((p) => (
              <button key={p.id} type="button" title={p.hint}
                      className={`theme-btn${palette === p.id ? ' is-active' : ''}`}
                      onClick={() => { setPalette(p.id); applyPalette(p.id) }}>
                {p.label}
              </button>
            ))}
          </div>
          <div className="lesson-sizes">
            {SIZES.map((s) => (
              <button key={s.id} type="button"
                      className={`theme-btn${size === s.id ? ' is-active' : ''}`}
                      onClick={() => { setSize(s.id); saveSize(s.id) }}>
                {s.label}
              </button>
            ))}
          </div>
          <button type="button" className="btn btn--small"
                  onClick={() => printElement(document.getElementById('lesson-sheet'))}>
            <PrintIcon />印刷
          </button>
        </div>
      </div>

      {/* ここが「紙」。暗い配色を選んでいても白のまま */}
      {/* 通しの練習のあいだは、紙を**縦いっぱいの1枚**として使う。
          そうすると出題がまん中に落ち着き、**文の長さが変わっても
          ボタンの場所が動かない**(2026-08 の指摘) */}
      <div className={`lesson-sheet lesson-sheet--${size}${run ? ' is-running' : ''}`}
           id="lesson-sheet">
        <div className="lesson-head">
          <MaterialTitle title={material.title} headline={material.headline}
                         as="strong" size="sheet" />
          {/* **何の練習かを、紙の上に必ず残す。**
              記事・会話は場面の題名が主役になるため、弱点(文法事項)が
              どこにも出ていなかった。紙で復習するときに分からなくなる
              (2026-08 の指摘)。教材名にすでに入っているものは繰り返さない。 */}
          {extraTags.length > 0 && (
            <div className="lesson-weakness">
              <span className="lesson-weakness-label">文法事項</span>
              {extraTags.map((t) => (
                <span key={t} className="lesson-weakness-tag">{weaknessTagLabel(t)}</span>
              ))}
            </div>
          )}
        </div>

        {/* ── 通しで練習する ────────────────────────────────
            **「ページを見る」とは別の行為。** ページは教材の中身を
            順に見るもので、こちらは教材1本を通しで練習するもの。
            紙の中に置くのは、`Listen (全体)` と同じ考え方である
            (操作欄は狭い画面で場所が無い。第5.25節)。
            共有先には見えるが、印刷には出さない */}
        {(qrPossible || passageSection) && (
          <div className="practice-row no-print">
            {/* 6Steps は**本文があるときだけ。**
                文型ドリルや単語には本文が無く、音読も区切りもできない */}
            {passageSection && (
              <button type="button"
                      className={`btn btn--small${run === 'six' ? ' btn--primary' : ''}`}
                      aria-pressed={run === 'six'}
                      onClick={() => { stopAll(); setRun(run === 'six' ? null : 'six') }}>
                <StepsIcon />6Steps
              </button>
            )}
            {qrPossible && (
              <button type="button"
                      className={`btn btn--small${qr ? ' btn--primary' : ''}`}
                      aria-pressed={qr}
                      onClick={() => { stopAll(); setRun(qr ? null : 'qr') }}>
                <BoltIcon />Quick Response
              </button>
            )}
          </div>
        )}

        {run === 'six' ? (
          <PassagePractice
            section={passageSection}
            /* 見出しは紙の上にもう出ている。**同じ英語を2行続けて並べない** */
            isDialogue={passageSection.exercise_type === 'dialogue'}
            tags={allTags} voiceIds={material.voiceIds} level={material.level}
          />
        ) : qr ? (
          <QuickResponse material={material} paper onClose={() => setRun(null)} />
        ) : section && (
          <>
            <h3 className="lesson-section">
              {exerciseLabel(section.exercise_type)}
              {`（${countLabel(section.exercise_type, section.items.length)}）`}
            </h3>
            {section.instruction && <p className="lesson-instruction">{section.instruction}</p>}

            {/* **通して聞く手段を、大きく表示したときにも置く。**
                無いと、オーバーラッピングやシャドーイングができない
                (2026-08 の指摘)。話す人が変わると声も変わる。 */}
            {isPassage && (
              <div className="lesson-listen no-print">
                <button type="button" className="btn btn--small" onClick={playWhole}>
                  {playingAll ? <><StopIcon />Stop</> : <><SpeakerIcon />Listen (全体)</>}
                </button>
              </div>
            )}

            <ol className="lesson-items">
              {section.items.map((it, i) => (
                <li key={key(it, i)} data-key={key(it, i)}
                    className={speakingKey === key(it, i) ? 'is-speaking' : undefined}>
                  {it.tag_id && <span className="lesson-tag">{weaknessTagLabel(it.tag_id)}</span>}
                  {it.speaker && <div className="lesson-speaker" lang="en">{it.speaker}</div>}

                  {/* リスニングは英文を出さない。聞いて答えるため */}
                  {/* 語に触れると意味が出る。**トレーナー側にも要る。**
                      レッスン中に「この語は?」と聞かれる場所そのものなので、
                      ここに無いと画面を離れて調べることになる(2026-08 の指摘)。 */}
                  {!type?.hidePromptFromLearner && it.prompt_en && (
                    <div className="lesson-en">
                      <EnglishText text={it.prompt_en} textJa={it.prompt_ja} level={material.level}
                                   statuses={wordStatuses} onMark={onMarkWord}
                                   readingAt={speakingKey === key(it, i) ? readingAt : null} />
                    </div>
                  )}
                  {it.prompt_en && (
                    <PhraseChips phrases={it.phrases} sentence={it.prompt_en}
                                 level={material.level}
                                 statuses={wordStatuses} onMark={onMarkWord} />
                  )}
                  {/* 本文(記事・会話)の訳は、はじめは伏せる。
                      英文だけが出ていたほうがシャドーイングしやすく、
                      「訳を見る」で確かめられる。設問の日本語は伏せない。 */}
                  {it.prompt_ja && (isPassage
                    ? isOpen(key(it, i)) && <div className="lesson-ja">{it.prompt_ja}</div>
                    : <div className="lesson-ja">{it.prompt_ja}</div>)}
                  {it.question && (
                    <div className="lesson-en">
                      <EnglishText text={it.question} level={material.level}
                                   statuses={wordStatuses} onMark={onMarkWord} />
                    </div>
                  )}
                  {it.hint && <div className="lesson-note">与える語: {it.hint}</div>}

                  {type?.audioFrom && it[type.audioFrom] && (
                    <SpeakButton
                      text={it[type.audioFrom]}
                      voice={voiceFor(cast, it.speaker)}
                      clipVoice={voiceFor(clipCast, it.speaker, soloVoice)}
                      tier={tier}
                      rate={rateOf(rateId)}
                      onPlayingChange={(on) => {
                        setSpeakingKey(on ? key(it, i) : null)
                        if (!on) setReadingAt(null)
                      }}
                      onWord={(w) => setReadingAt(w ? w.charIndex : null)}
                    />
                  )}

                  {/* 解答は「全部出す」と「この問だけ出す」の両方から開ける。
                      レッスンで1問ずつ答え合わせをするために、問ごとが要る。 */}
                  {(it.answer || it.audio_text || (isPassage && it.prompt_ja)) && (
                    <button type="button" className="btn btn--small lesson-reveal"
                            aria-expanded={isOpen(key(it, i))}
                            onClick={() => toggleItem(key(it, i))}>
                      {isPassage
                        ? (isOpen(key(it, i)) ? '訳を隠す' : '訳を見る')
                        : (isOpen(key(it, i)) ? '解答を隠す' : '解答を見る')}
                    </button>
                  )}

                  {isOpen(key(it, i)) && (
                    <>
                      {/* リスニングは英文を見せずに聞かせる。答え合わせでは
                          **読み上げた英文そのもの**を出す。何を言われたのかが
                          分からないと、直しようがない(2026-08 の指摘)。 */}
                      {type?.hidePromptFromLearner && it.audio_text && (
                        <div className="lesson-heard">
                          <span className="lesson-heard-label">読み上げた英文</span>
                          <span lang="en">{it.audio_text}</span>
                        </div>
                      )}
                      {it.answer && <div className="lesson-answer">→ {it.answer}</div>}
                      {it.answer_alt && <div className="lesson-note">別解: {it.answer_alt}</div>}
                      {it.note && <div className="lesson-note">{it.note}</div>}
                    </>
                  )}
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
    </div>
  )
}
