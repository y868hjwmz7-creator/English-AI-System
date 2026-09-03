/**
 * **集中モード** — 1段落ずつ、画面に固定して語を調べる(2026-09 利用者の指定)。
 *
 * **画面に出す名前は「集中モード」**(利用者が選んだ)。
 * コードの中の名前(`FocusReader` / `.focus-*`)は変えていない。
 *
 *   > スマホやパッド、タッチのデバイスで取り組む際に、教材、特に記事と
 *   > ダイアローグ、会議で、はじめに単語を調べて単語帳に飛ばす段階では
 *   > 段落ごとに画面を固定し、ブラウザの機能をシャットアウトできる
 *   > ようにしたいです。そのモードの時は段落を進める、戻るのボタンを
 *   > 配置して、ドラッグなどをしてもブラウザの影響を受けないように。
 *
 * ============================================================================
 * 【考え方】**「送らせない」のではなく「送る必要をなくす」**
 *
 *   語のタップと画面送りが喧嘩していたのは、**画面が送れる状態だったから**
 *   である。iOS はいったん送り始めると `touchmove` を取り消せない。
 *   **時間や判定で戦うかぎり、この穴は塞げない**(3度踏んだ・CLAUDE.md)。
 *
 *   ところが**1段落だけを画面ぴったりに出せば、送るものが無くなる。**
 *   ページは動かず、アドレスバーも出入りせず、引っぱって更新も起きない。
 *   **戦わずに消える。**
 *
 * ============================================================================
 * 【ブラウザを締め出す — できること・できないこと】
 *
 *   | 邪魔なもの | 止まるか | どうやって |
 *   |---|---|---|
 *   | ページ全体が動く | **止まる** | 画面ぴったり。送るものを無くす |
 *   | 引っぱって更新 | **止まる** | `overscroll-behavior: contain` |
 *   | アドレスバーの出入り | **止まる** | 送らなければ動かない |
 *   | 二度叩いての拡大 | **止まる** | `touch-action: manipulation` |
 *   | 長押しメニュー | **止まる** | `-webkit-touch-callout`(すでにある) |
 *   | **指2本での拡大** | **止まらない** | iOS は `user-scalable=no` を無視する |
 *   | **端からの戻るスワイプ** | **止まらない** | Safari の仕様。JS から触れない |
 *
 *   止まらない2つは**避ける**。端に押すものを置かず、
 *   ホーム画面に追加してもらえばアドレスバーごと消える(`manifest`)。
 *
 * ============================================================================
 * 【訳は「並べる」のではなく「入れ替える」】(2026-09 利用者の判断)
 *
 *   > 画面を切り替えれるようにするのが良いと考えています
 *
 *   理由は2つ。
 *   ①**並べるとこのモードが壊れる。** 箱が2倍になり、送らないと読めない
 *   ②**訳が隣にあると、英語を読まずに済んでしまう。** 記事の紙で
 *     すでに同じ判断をしている(「本文の訳を出さない」・CLAUDE.md)
 *
 *   - **箱の高さは中身で変わらない**(残りいっぱいを取る)。切り替えても
 *     ボタンが1ミリも動かない。並べる案との決定的な差である
 *   - **段落を送ったら、必ず英語に戻す。** 訳のまま送ると、次の段落も
 *     日本語で始まり、**英語を一度も読まないまま最後まで行けてしまう**
 *     (くり返しを覚えないのと同じ作法)
 *   - **戻る道は同じボタン**(「訳を見る」⇄「英語に戻す」)
 *   - **訳が無い段落では、ボタンを出さない**(効かない操作を見せない)
 *
 * ============================================================================
 * 【横スワイプで送らない】
 *
 *   自然に見えるが、**2語以上をなぞって調べる操作**とぶつかる。
 *   端のスワイプは「戻る」とも誤爆する。**ボタンだけにする。**
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import EnglishText from './EnglishText.jsx'
import SpeakButton from './SpeakButton.jsx'
import RepeatToggle from './RepeatToggle.jsx'
import { CloseIcon } from './Icons.jsx'
import { castClipSpeakers, voiceFor } from '../lib/voiceCast.js'
import { resolveVoices } from '../data/clipVoices.js'
import { useProgress } from '../lib/progress.js'
import { markIn } from '../lib/useWordStatuses.js'
import { normWord } from '../lib/vocab.js'

/**
 * 英文から、そろえた形(`normWord`)の語を重複なく取り出す。
 * 切り方は `vocab.js` の決まりに合わせる。**2か所に持たない**ための薄い包み。
 */
function wordsOf(text) {
  const seen = new Set()
  for (const raw of String(text ?? '').split(/[^A-Za-z'’-]+/)) {
    const w = normWord(raw)
    if (w) seen.add(w)
  }
  return seen
}

/* **段落ごとの「◯語入れました」は出さない**(2026-09 利用者の指定
   「集中モード内の、この段落、発言で〜語入れましたみたいのはやはりいらない」)。
   数えるだけの行で、読むものが1行増えるほうの害が大きかった。
   **まとめの1枚(`allPicked`)は残してある** — あちらは教材ぜんぶの控えである。
   `statuses` が Map だという注意は、その `allPicked` の側に効いている */

export default function FocusReader({
  section, isDialogue = false, voiceIds = null, tier,
  level = 'B1', wordStatuses = null, onMarkWord = null,
  materialId = null, learnerId = null, onClose,
  /**
   * **どこから始めるか**(2026-09 利用者の指定)。
   *
   *   > KENJI が大体画面の中心に来ている時は集中モードを押したら
   *   > ②KENJI の集中モードに入り…
   *
   * 呼ぶ側(`LessonView`)が「いま紙のまん中に出ている発言」を渡す。
   * **これは「どこまで見たか」の控えより強い。** 目はいまその発言の上に
   * あるので、別のところから始まると探し直すことになる。
   * `null`(見えていない・呼ばれ方が違う)のときは、これまでどおり
   * **覚えている場所**から始まる。
   */
  startAt = null,
  /**
   * **紙の幅をそのまま引き継ぐ**(2026-09 利用者の指定
   * 「PCで集中モードに入った時は、それまでの画面幅を引き継いでください」)。
   *
   * `w100`〜`w150` / `wfit`(`LessonView` の `WIDTHS`)。
   * 紙で 130% にして読んでいた人が、集中モードに入った瞬間に
   * **別の幅に変わっては落ち着かない。** 同じ1本の教材を、
   * 同じ幅で読み続けられるようにする。
   * 狭い画面では紙がもともと画面いっぱいなので、見た目は変わらない。
   */
  width = 'w100',
}) {
  const items = useMemo(
    () => (section?.items ?? []).filter((it) => String(it?.prompt_en ?? '').trim()),
    [section],
  )
  const markWord = markIn(onMarkWord, materialId, learnerId)

  /** どこまで見たか。**ほかの練習と同じように覚える**(`useProgress`) */
  const key = `eas.prog.${materialId ?? 'x'}.${section?.id ?? 'x'}.focus`
  const [at, setAt] = useProgress(key, 0, learnerId)
  /** 見終わった段落。**印を付けて、どこまでやったか一目で分かるようにする** */
  const [done, setDone] = useProgress(`${key}.done`, [], learnerId)

  /**
   * **入ってきたときに指定された場所**(紙のまん中に出ていた発言)。
   *
   * 控え(`at`)より**こちらが強い。** ただし効くのは入った直後だけで、
   * ◀ ▶ を1度でも押したら控えの側に戻す(`go` が `null` にする)。
   * **控えそのものは書き換えない。** 覗いただけで
   * 「ここまで見た」が動くと、次に開いたときに話が飛ぶ。
   */
  const [from, setFrom] = useState(
    () => (Number.isFinite(startAt) && startAt >= 0 ? startAt : null),
  )
  // **控えていた場所が範囲の外になっていることがある**(教材を直したあと)。
  // そのまま使うと空の段落になるので、必ず中に収める(CLAUDE.md)
  const index = Math.min(
    Math.max(Number(from ?? at) || 0, 0), Math.max(items.length - 1, 0),
  )
  const item = items[index] ?? null

  /** いま訳を出しているか。**段落を送ったら必ず英語に戻す** */
  const [showJa, setShowJa] = useState(false)
  /** 最後の1枚(調べた語のまとめ)を出しているか */
  const [wrap, setWrap] = useState(false)
  /** 読み上げをくり返すか(2026-09 利用者の指定)。**覚えない** */
  const [loop, setLoop] = useState(false)

  const bodyRef = useRef(null)

  const cast = useMemo(
    () => castClipSpeakers(items.map((it) => it.speaker), voiceIds),
    [items, voiceIds],
  )
  const soloVoice = useMemo(() => resolveVoices(voiceIds)[0], [voiceIds])

  /** 段落を移る。**英語に戻し、箱のいちばん上へ送る** */
  const go = (next) => {
    const n = Math.min(Math.max(next, 0), items.length - 1)
    setShowJa(false)
    setWrap(false)
    // 送った時点で、控えの側に戻す(以後は「どこまで見たか」が効く)
    setFrom(null)
    setAt(n)
    // 見た段落に印を付ける(重ねて入れない)
    const list = Array.isArray(done) ? done : []
    if (!list.includes(index)) setDone([...list, index])
    if (bodyRef.current) bodyRef.current.scrollTop = 0
  }

  // Esc で閉じる。**開いているものから閉じる**(まとめ → 本体)
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        if (wrap) setWrap(false)
        else onClose?.()
        return
      }
      // **早く帰る条件を足したら、その下を必ず見る**(CLAUDE.md)。
      // 矢印での送りは、この下にある
      if (wrap) return
      if (e.key === 'ArrowRight') go(index + 1)
      if (e.key === 'ArrowLeft') go(index - 1)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  })

  /* 開いているあいだは、**うしろの画面を動かさない。**
     かぶせて開くメニュー(`AppNav`)と同じ作法。
     これが無いと、この画面の外側が指で送れてしまう */
  useEffect(() => {
    const before = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = before }
  }, [])

  /**
   * 教材ぜんぶで「知らなかった」と付けた語(まとめの1枚)。
   *
   * **早く帰る前に置く。** hook は必ず同じ順で呼ばれなければならないので、
   * `return null` より下に書くと、段落が空になった回だけ数が変わって落ちる
   */
  const allPicked = useMemo(() => {
    if (!wordStatuses?.get) return []
    const out = []
    const seenW = new Set()
    for (const it of items) {
      for (const w of wordsOf(it.prompt_en)) {
        if (seenW.has(w)) continue
        seenW.add(w)
        if (wordStatuses.get(w) === 'unknown') out.push(w)
      }
    }
    return out
  }, [items, wordStatuses])

  if (!item) return null

  const total = items.length
  const unit = isDialogue ? '発言' : '段落'
  const seen = Array.isArray(done) ? done : []
  const clipVoice = voiceFor(cast, item.speaker, soloVoice)
  const last = index >= total - 1

  return (
    <div className={`focus focus--${width}`}
         role="dialog" aria-modal="true" aria-label="集中モード">
      {/* ── 上の帯。**細く1行。** 送るものを増やさない ────────── */}
      <div className="focus-top">
        <button type="button" className="btn btn--small btn--ghost" onClick={onClose}>
          <CloseIcon />閉じる
        </button>
        <span className="focus-count">
          {wrap ? '調べた語' : `${index + 1} / ${total} ${unit}`}
        </span>
        {/* 見終わった段落の印。**どこまでやったか一目で分かる** */}
        <span className="focus-dots" aria-hidden="true">
          {items.map((it, i) => (
            <span key={it.id ?? i}
                  className={`focus-dot${i === index ? ' is-now' : ''}`
                    + (seen.includes(i) ? ' is-done' : '')} />
          ))}
        </span>
      </div>

      {/* ── 本文。**ここだけが送れる**(`overscroll-behavior: contain`)── */}
      <div className="focus-body" ref={bodyRef}>
        {wrap ? (
          <div className="focus-wrap">
            <p className="focus-wrap-lead">
              この教材で <strong>{allPicked.length} 語</strong> を単語帳に入れました。
            </p>
            {allPicked.length > 0 ? (
              <ul className="focus-wrap-list" lang="en">
                {allPicked.map((w) => <li key={w}>{w}</li>)}
              </ul>
            ) : (
              <p className="focus-wrap-none">
                まだ1語も入れていません。語を叩くと意味が出て、そこから入れられます。
              </p>
            )}
          </div>
        ) : (
          <>
            {/* ── 何番目か(2026-09 利用者の指定)──────────────────
                > 集中モード内も①や②のような番号を入れてください。

                **紙と同じ丸の番号にそろえる**(`.lesson-items > li::before`)。
                レッスンは紙を見ながら話すので、「2番のところ」と言えば
                どちらを見ていても同じ場所を指せる。
                上の帯の「3 / 14 発言」は**どこまで来たか**の目安であって、
                本文の隣にある番号とは役目が違う。

                **話す人がいなくても出す**(記事の段落にも紙は番号を振っている)。
                英語と訳のどちらでも出すので、**切り替えても行は動かない** */}
            <div className="focus-who">
              <span className="num-badge" aria-hidden="true">{index + 1}</span>
              {isDialogue && item.speaker && (
                <span className="focus-speaker" lang="en">{item.speaker}</span>
              )}
            </div>
            {/* **入れ替える。並べない。**
                訳のときは語を押せない(英語がそこに無いので、引くものが無い) */}
            {showJa ? (
              <p className="focus-ja">{item.prompt_ja}</p>
            ) : (
              <p className="focus-en">
                {/* **ここだけは、狭い画面でも語を押せる**(2026-09 利用者の指定)。
                    1段落を画面に固定しているので送るものが無く、
                    タップと画面送りが喧嘩しない。**調べるのはここでする** */}
                <EnglishText text={item.prompt_en} textJa={item.prompt_ja} level={level}
                             statuses={wordStatuses} onMark={markWord}
                             tappable="always" />
              </p>
            )}
          </>
        )}
      </div>

      {/* ── すぐ元に戻る(2026-09 利用者の指定)────────────────
          > そしてすぐに元に戻れるボタンも作ってください。

          **入った場所と、出る場所を同じにする。** 紙の右下の「集中モード」を
          押して入り、同じ右下を押して戻る。左上の「✕ 閉じる」も残してあるが、
          スマホでは**親指がいちばん届かないのが左上**である。

          **帯の上に浮かせる**(`bottom: 100%`)。帯そのものに置くと
          「次 ▶」と重なるか、320px で1行に収まらなくなる。 */}
      <div className="focus-barwrap">
        <button type="button" className="btn btn--small focus-exit" onClick={onClose}>
          <CloseIcon />集中モードを終える
        </button>

      {/* ── 下の帯。**親指が届くのは下半分**。端からは離す ────── */}
      <div className="focus-bar">
        {wrap ? (
          <button type="button" className="btn btn--primary focus-wide"
                  onClick={() => setWrap(false)}>
            本文に戻る
          </button>
        ) : (
          <>
            <button type="button" className="btn focus-move"
                    onClick={() => go(index - 1)} disabled={index === 0}>
              ◀ 前
            </button>

            <div className="focus-mid">
              {/* **音も訳も両方出す**(2026-09 利用者の指定) */}
              <SpeakButton text={item.prompt_en} clipVoice={clipVoice} tier={tier}
                           className="btn--small" repeat={loop} />
              {/* **くり返し**(2026-09 利用者の指定
                  「これは集中モードで、全てのデバイスで同じにしてください」)。
                  まねて言うには、同じ発言を何度も聴く */}
              <RepeatToggle on={loop} onChange={setLoop} />
              {/* 訳が無い段落では出さない(効かない操作を見せない) */}
              {item.prompt_ja && (
                <button type="button" className="btn btn--small btn--ghost"
                        onClick={() => setShowJa((v) => !v)}>
                  {showJa ? '英語に戻す' : '訳を見る'}
                </button>
              )}
            </div>

            {last ? (
              <button type="button" className="btn btn--primary focus-move"
                      onClick={() => { go(index); setWrap(true) }}>
                まとめ
              </button>
            ) : (
              <button type="button" className="btn focus-move"
                      onClick={() => go(index + 1)}>
                次 ▶
              </button>
            )}
          </>
        )}
      </div>
      </div>
    </div>
  )
}
