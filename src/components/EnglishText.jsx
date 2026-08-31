/**
 * 英文を「1語ずつ触れる」形で出す。
 *
 * 【何ができるか】(2026-08 の要望)
 *   ・語に触れると**意味と品詞**が出る。**その文でふさわしい意味が先頭**
 *   ・その場で「知っていた」「知らなかった」を選べる
 *   ・**「知らなかった」と付けた語は色が変わり、次に開いても色のまま**
 *
 * 【触り方】(2026-08 利用者の指定)
 *
 *   | 端末 | 開き方 |
 *   |---|---|
 *   | パソコン(マウス・ペン) | 語を**クリック**する |
 *   | スマホ・タブレット | 語を**軽く叩く**(指を離したときに開く) |
 *
 *   **カーソルを置いただけでは開かない。** 読んでいる途中で次々に開くと、
 *   本文が読めなくなる。
 *
 *   【なぜ「長押し」をやめたか】(2026-08 実機・3度目)
 *
 *     > タッチで使用するデバイスだと相変わらずスクロールしようと
 *     > タッチすると単語の意味が出てしまいます。
 *
 *     長押しは **押しているあいだに開く。** 指を置いて少し迷ってから
 *     画面を送ると、送り始める前に 450ms が過ぎて開いてしまう。
 *     動いたら取り消す見張りを足しても、**動く前に開いてしまうので
 *     間に合わない。** 時間で判定するかぎり、この穴は塞げない。
 *
 *     そこで **「指を離したときに決める」**ようにした。
 *     画面を送るときの指は**必ず動く**ので、
 *     「動かずに離れた」ことがそのままタップの証拠になる。
 *     押している長さは見ない(迷って長く触れても、動かなければタップ)。
 *
 *     ダブルタップにはしなかった。iOS では拡大の操作とぶつかり、
 *     **2語以上をなぞって調べる道**(下記)とも両立しにくい。
 *     1回叩くだけで開くほうが、調べる回数の多い読解では速い。
 *
 *   【送りを止めるための1回は、タップとみなさない】
 *     画面が流れているときに叩くのは「止めたい」であって
 *     「調べたい」ではない。**直前に画面が動いていたら開かない。**
 *
 *   判定は「その操作がどれで来たか」(`pointerType`)で行う。
 *   `(hover: hover)` のような**環境の当て推量に賭けない。**
 *   一度この判定を外して「何をしても開かない」状態になった(2026-08)。
 *
 *   【開いたら、閉じる操作をするまで留まる】
 *   語から外れた瞬間に閉じていたため、「知っていた」を押そうと
 *   カーソルを動かすと途中で消えていた(2026-08 の指摘)。
 *   いまは ✕ / 外側を押す / Esc / 同じ語をもう一度押す、で閉じる。
 *
 * 【意味はいつ引くか】
 *   **開いたときに初めて引く。** 本文を出した時点で全部引くと、
 *   1画面で何十回も窓口を呼ぶことになり、費用も時間もかかる。
 *   一度引いた語はスクール全体の控えに残るので、2回目からは無料で出る。
 *
 * 【印刷には出さない】
 *   紙には語の枠も色も要らない。`no-print` で消す。
 */
import { useEffect, useRef, useState } from 'react'
import { lookupWord, normWord, preloadGlosses, splitWords } from '../lib/vocab.js'
import { splitSentences } from '../lib/wordTiming.js'
import GlossPopover from './GlossPopover.jsx'
import { tapFeedback } from '../lib/haptics.js'

/**
 * **画面が動いた直後は、叩いてもタップとみなさない**(ms)。
 *
 * 流れている画面を止めるための1回は「調べたい」ではない。
 * 送り終えてから軽く間があけば、ふつうに開く。
 */
const SCROLL_QUIET_MS = 400

/**
 * **画面が最後に動いた時刻。**
 *
 * 語ごと・本文ごとに見張ると、同じ見張りが画面に何十個も並ぶ。
 * ここに1つだけ置いて、どの `EnglishText` からも同じものを見る。
 */
let lastScrollAt = 0
let scrollWatched = false
function watchScrollOnce() {
  if (scrollWatched || typeof document === 'undefined') return
  scrollWatched = true
  // **capture で拾う。** 紙(`.lesson-sheet`)のように、中で送る要素の
  // `scroll` は上まで伝わらない
  document.addEventListener('scroll', () => { lastScrollAt = Date.now() },
    { capture: true, passive: true })
}

/**
 * これ以上動いたら「押した」ではなく「動かした」とみなす(px)。
 *
 * 【なぜ要るか】(2026-08 実機)
 *   > iPhoneとiPadでスクロールしようとすると単語の意味が出て来てしまいます
 *
 *   画面を送るとき、指は**同じ語の上に留まったまま**縦に動く。
 *   これまでは「指の下の語が変わったか」しか見ていなかったので、
 *   語が変わらない縦の動きは長押しと区別できず、450ms で開いてしまった。
 *   **指が動いたかどうかを、距離で見る。**
 */
const MOVE_SLOP = 10

export default function EnglishText({
  text, textJa = '', level = 'B1', statuses = null, onMark = null,
  className = '', lang = 'en', readingAt = null,
}) {
  const [openIndex, setOpenIndex] = useState(null)  // いま開いている語
  const [gloss, setGloss] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const holdOff = useRef(null)     // 見張りをやめる後始末
  const startPt = useRef(null)     // 指を置いた場所(動いたかを距離で見る)
  const scrolledRef = useRef(false)  // 指を置いてから画面が動いたか
  const tapRef = useRef(false)     // いまの指の動きは、まだタップでありうるか
  const [holding, setHolding] = useState(false)  // いま指を置いているか(手応え)
  const heldRef = useRef(false)    // なぞり・タップで開いた直後か(続く click を捨てる)
  const touchRef = useRef(false)   // 直前の操作が「触る」だったか
  const rootRef = useRef(null)
  const anchorRef = useRef(null)   // 吹き出しを出す位置(語 or なぞった範囲の先頭)
  const parts = splitWords(text ?? '')

  // ── なぞって句を選ぶ ────────────────────────────────────
  //
  // 【なぜ要るか】(2026-08 利用者の指定)
  //   > on の上でクリックし、house までドラッグしたら、まとめて
  //   > ハイライトされ、そのフレーズの訳が出てくるようにできないか？
  //
  //   `on the house` のような言い回しは、1語ずつ見ても意味が分からない。
  //   教材が拾った要点フレーズ(`PhraseChips`)だけでは、
  //   **その場で気づいたものを調べられない。**
  //
  // 【ブラウザの範囲選択は使わない】
  //   語には `user-select: none` を掛けてある(iPhone の長押しメニューを
  //   止めるため)。外すとあの問題が戻る。そこで**自前でなぞりを見る。**
  //   こうすると、マウスでも指でも同じ操作になる。
  const dragFrom = useRef(null)          // なぞり始めた語
  const [dragTo, setDragTo] = useState(null)   // いま指・カーソルの下にある語
  const [range, setRange] = useState(null)     // 確定した範囲 [from, to]

  /** その座標にある語の番号。無ければ null */
  const wordAt = (x, y) => {
    const el = document.elementFromPoint(x, y)?.closest?.('[data-widx]')
    const n = el ? Number(el.dataset.widx) : NaN
    return Number.isInteger(n) ? n : null
  }

  // なぞっている最中と、確定した範囲。どちらも同じ色で示す
  const span = range ?? (dragFrom.current != null && dragTo != null
    && dragTo !== dragFrom.current ? [dragFrom.current, dragTo] : null)
  const lo = span ? Math.min(span[0], span[1]) : -1
  const hi = span ? Math.max(span[0], span[1]) : -2

  /**
   * 記録してある言い回しが、この本文のどこに出てくるか。
   *
   * 【なぜ要るか】(2026-08 の指摘)
   *   `on the house` を「知らなかった」と付けても、本文では `on` だけに
   *   色が付いていた。**言い回しは、はじめの語から終わりの語まで
   *   ひとつながりで示さないと、何を覚えるのか分からない。**
   *
   * `statuses` の鍵は「そろえた形」なので、空白を含むものが言い回しである。
   * 語をそろえて並べ、同じ並びを本文の中から探す。
   */
  const phraseSpans = (() => {
    if (!statuses?.size) return []
    const words = []
    parts.forEach((part, i) => { if (part.word) words.push({ i, norm: part.norm }) })
    const found = []
    for (const [key, st] of statuses) {
      if (!key.includes(' ')) continue
      const needle = key.split(' ')
      for (let w = 0; w + needle.length <= words.length; w += 1) {
        let hit = true
        for (let k = 0; k < needle.length; k += 1) {
          if (words[w + k].norm !== needle[k]) { hit = false; break }
        }
        if (hit) found.push({ from: words[w].i, to: words[w + needle.length - 1].i, status: st })
      }
    }
    return found
  })()

  /** 吹き出しに出す状態。句を開いているときは**句そのもの**の状態 */
  const popStatus = (() => {
    if (!range) return null
    const head = parts[range[0]]
    const tail = parts[range[1]]
    if (!head || !tail) return null
    const phrase = (text ?? '').slice(head.at, tail.at + tail.text.length).trim()
    return statuses?.get(normWord(phrase)) ?? null
  })()

  // いま読み上げているところ。**語ではなく、文**で色を付ける。
  //
  // 【なぜ文にしたか】(2026-08 利用者の指定)
  //   > 読み上げている単語のハイライトは、別に文章毎でも大丈夫です。
  //   > フルストップからフルストップまでをハイライト。
  //
  //   語ごとに色を付けていたが、合図(`boundary`)を出さない端末では
  //   時間からの見積もりに頼るしかなく、**1語ずれると目に見えて
  //   気持ちが悪い。** 利用者の会社PCの英語の声は3つとも合図を出さない。
  //   文の単位なら、多少ずれても「いまこの文を読んでいる」は正しいままである。
  //   **精度を上げるより、外れても困らない見せ方を選ぶ。**
  //
  //   合図が来る端末・MP3(長さが正確に分かる)では、そのぶん切り替わりも
  //   正確になる。**どちらの経路でも同じ見え方になる。**
  const sentences = splitSentences(text ?? '')
  const readingSpan = readingAt == null
    ? null
    : sentences.find((sp) => readingAt >= sp.start && readingAt < sp.end) ?? null

  /** この指の動きは、もうタップではない(動いた・送られた) */
  const cancelHold = () => {
    tapRef.current = false
    // 見張り(動いたか・画面が送られたか)も一緒に外す
    holdOff.current?.()
    holdOff.current = null
    setHolding(false)
  }

  /**
   * 指を置いているあいだ、**動いたら・画面が送られたら、タップをやめる。**
   *
   * 語そのものの `onPointerMove` だけでは足りない。
   *   ・縦に送るとき、指は同じ語の上に留まる(語が変わらないので気づけない)
   *   ・画面が動き始めると、iOS は語への `pointermove` を送らなくなる
   * そこで**書類ぜんぶ**を見張る。`scroll` は伝わらないので capture で拾う。
   */
  const watchHold = (x, y) => {
    startPt.current = { x, y }
    scrolledRef.current = false
    const onMove = (ev) => {
      const t = ev.touches?.[0] ?? ev
      const p = startPt.current
      if (!p || t.clientX == null) return
      if (Math.hypot(t.clientX - p.x, t.clientY - p.y) > MOVE_SLOP) cancelHold()
    }
    // **画面が送られたら、なぞりの選択もやめる。** 送っただけなのに
    // 2語をなぞったことにされると、身に覚えのない意味が出る
    const onScroll = () => { scrolledRef.current = true; cancelHold() }
    document.addEventListener('pointermove', onMove, { passive: true })
    document.addEventListener('touchmove', onMove, { passive: true })
    document.addEventListener('scroll', onScroll, { capture: true, passive: true })
    holdOff.current = () => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('touchmove', onMove)
      document.removeEventListener('scroll', onScroll, { capture: true })
    }
  }

  const close = () => {
    cancelHold()
    setOpenIndex(null)
    setGloss(null)
    setError(null)
    setRange(null)
    dragFrom.current = null
    setDragTo(null)
  }

  const open = async (index, part) => {
    cancelHold()
    if (openIndex === index && gloss) return   // すでに出ている
    setOpenIndex(index)
    setGloss(null)
    setError(null)
    setBusy(true)
    const { data, error: e } = await lookupWord({ word: part.text, sentence: text, level })
    setBusy(false)
    if (e) { setError(e); return }
    setGloss(data)
  }

  /**
   * なぞった範囲を1つの言い回しとして引く。
   * **もとの英文からそのまま切り出す。** 語を空白でつなぎ直すと、
   * ハイフンやアポストロフィのある語で形が変わってしまう。
   */
  const openRange = async (from, to) => {
    const a = Math.min(from, to)
    const b = Math.max(from, to)
    const head = parts[a]
    const tail = parts[b]
    if (!head?.word || !tail?.word) return
    const phrase = (text ?? '').slice(head.at, tail.at + tail.text.length).trim()
    if (!phrase) return

    setRange([a, b])
    setOpenIndex(a)
    anchorRef.current = rootRef.current?.querySelector(`[data-widx="${a}"]`) ?? null
    setGloss(null)
    setError(null)
    setBusy(true)
    const { data, error: e } = await lookupWord({ word: phrase, sentence: text, level })
    setBusy(false)
    if (e) { setError(e); return }
    setGloss(data)
  }

  useEffect(() => cancelHold, [])

  // **本文が出た時点で、控えにある語をまとめて読んでおく。**
  // 触れてから読みに行くと、そのぶん待たされる(2026-08 の指摘)。
  // 同じ画面の何本もの文が同時に頼むので、少し待って1回にまとめている。
  useEffect(() => { preloadGlosses(text) }, [text])

  // 外側を押す / Esc で閉じる。**留めたものを閉じる手段が要る**
  useEffect(() => {
    if (openIndex === null) return undefined
    const onDown = (e) => {
      // 吹き出しは body の直下に出る(切られないため)。
      // **中を押したときに閉じてはいけない**
      if (rootRef.current?.contains(e.target)) return
      if (e.target?.closest?.('.etext-pop')) return
      close()
    }
    const onKey = (e) => { if (e.key === 'Escape') close() }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [openIndex])


  const mark = async (status) => {
    if (!onMark) return
    // **出会った文も一緒に記録する**(0018)。人は文脈ごと覚える。
    // 単語帳で「どこで会ったか」を出すと、思い出す手がかりになる。
    // 語が入っている**その文だけ**を渡す(段落まるごとでは長すぎる)
    const seen = readingSpanOf()
    // 文の日本語。**英文と和訳が1対1のときだけ渡す。**
    // 段落まるごとの訳を1文の訳として控えると、嘘になる
    const seenJa = sentences.length === 1 ? (textJa ?? '').trim() || null : null
    if (range) {
      // なぞって選んだ言い回し。**語ではなく句として記録する**
      const head = parts[range[0]]
      const tail = parts[range[1]]
      const phrase = (text ?? '').slice(head.at, tail.at + tail.text.length).trim()
      await onMark(normWord(phrase), status, 'phrase', seen, seenJa)
      close()
      return
    }
    const part = parts[openIndex]
    if (!part) return
    await onMark(part.norm, status, 'word', seen, seenJa)
    close()
  }

  /** いま開いている語が入っている**文だけ**を切り出す */
  const readingSpanOf = () => {
    const at = parts[range ? range[0] : openIndex]?.at
    if (at == null) return null
    const sp = sentences.find((x) => at >= x.start && at < x.end)
    return ((sp ? (text ?? '').slice(sp.start, sp.end) : text) ?? '').trim() || null
  }

  /**
   * 2語以上のまとまりを、**ひとつの箱で囲む。**
   *
   * 【なぜ要るか】(2026-08 の指摘)
   *   語ごとに色を付けると、語と語のあいだで線が切れる。
   *   空白にも同じ色を付けてみたが、`<button>` と `<span>` では
   *   下端の位置が 7px ずれていて(実測)、継ぎ目が残った。
   *   **囲む箱を1つにすれば、ずれようがない。**
   *   行をまたいでも、行ごとに正しく引かれる(インライン要素の性質)。
   *
   * **1語のときも同じ囲みで描く。** 別の仕組みで描いていたため、
   * 1語の赤だけ高さが違って見えた(2026-08 の指摘)。
   * 同じ箱で描けば、そろえる努力が要らない。
   *
   * まとまりは3種類。**なぞっている最中がいちばん優先**である
   * (いま選んでいるものが見えないと操作できない)。
   */
  const runs = []
  {
    let i = 0
    while (i < parts.length) {
      if (i >= lo && i <= hi) {
        // 選んだ範囲が、記録してある言い回しとぴったり同じなら、
        // **その言い回しの色のままにする。** 押した瞬間に紫から青へ
        // 変わると、同じものを見ているように思えない(2026-08)
        const same = phraseSpans.find((x) => x.from === lo && x.to === hi)
        runs.push({
          cls: same ? `is-phrase is-${same.status}` : 'is-picked',
          from: i, to: hi, phrase: same ?? null,
        })
        i = hi + 1
        continue
      }
      const sp = phraseSpans.find((x) => i >= x.from && i <= x.to)
      if (sp) {
        runs.push({ cls: `is-phrase is-${sp.status}`, from: sp.from, to: sp.to, phrase: sp })
        i = sp.to + 1
        continue
      }
      const st = parts[i].word ? (statuses?.get(parts[i].norm) ?? null) : null
      runs.push({ cls: st ? `is-word is-${st}` : null, from: i, to: i, phrase: null })
      i += 1
    }
  }

  /**
   * 部品ひとつぶん。語なら押せるボタン、そうでなければただの文字。
   *
   * `run` に言い回しが入っているときは、**その中のどの語を押しても
   * まとまりの意味を出す**(2026-08 の指定)。ひとまとまりとして
   * 色を付けているのに、押すと1語の意味が出るのでは辻褄が合わない。
   */
  const renderPart = (part, i, run = null) => {
        if (!part.word) return <span key={i}>{part.text}</span>
        const asPhrase = run?.phrase ?? null
        // 囲みが色を持つので、語そのものには色を付けない(縞にならないように)
        const status = null
        const isOpen = asPhrase ? openIndex === asPhrase.from : openIndex === i
        return (
          <span key={i} className="etext-word-wrap">
            <button
              type="button"
              data-widx={i}
              className={`etext-word${status ? ` is-${status}` : ''}`
                + `${isOpen ? ' is-open' : ''}`
                + `${holding && dragFrom.current === i ? ' is-holding' : ''}`}
              aria-expanded={isOpen}
              // どの操作で来たかで分ける。**環境の当て推量に賭けない**
              onPointerDown={(e) => {
                touchRef.current = e.pointerType === 'touch'
                heldRef.current = false
                // なぞりの起点。指でもマウスでも同じ
                dragFrom.current = i
                setDragTo(i)
                setRange(null)
                if (!touchRef.current) return
                // 触る端末: **指を離したときに決める。** 押している長さは見ない
                cancelHold()
                watchScrollOnce()
                // **画面を送った直後の1回は、送りを止めるためのもの**
                tapRef.current = Date.now() - lastScrollAt > SCROLL_QUIET_MS
                watchHold(e.clientX, e.clientY)
                // **触れていることが見て分かるようにする**(2026-08 の要望)
                setHolding(true)
              }}
              // iPhone・iPad の長押しメニュー(コピー / Google で検索)を出さない。
              // CSS の -webkit-touch-callout と合わせて二重に止める
              onContextMenu={(e) => e.preventDefault()}
              onPointerUp={(e) => {
                const scrolled = scrolledRef.current
                const wasTap = tapRef.current
                const el = e.currentTarget
                cancelHold()
                const from = dragFrom.current
                const to = wordAt(e.clientX, e.clientY)
                dragFrom.current = null
                setDragTo(null)
                // **画面を送っただけのときは、何もしない。**
                // 送っている途中で指が別の語に渡ると、なぞったことにされていた
                if (scrolled) return
                // **2語以上をなぞったら、まとめて1つの言い回しとして引く**
                if (from != null && to != null && to !== from) {
                  heldRef.current = true   // 続く click を捨てる
                  openRange(from, to)
                  return
                }
                // **触る端末は、ここで開く**(2026-08 に長押しから改めた)。
                // 動かずに離れたときだけ。画面を送るときの指は必ず動く
                if (!touchRef.current || !wasTap) return
                heldRef.current = true     // 続く click を捨てる
                tapFeedback('tap')
                anchorRef.current = el.closest('.etext-run') ?? el
                if (isOpen) close()
                else if (asPhrase) openRange(asPhrase.from, asPhrase.to)
                else open(i, part)
              }}
              onPointerCancel={() => {
                cancelHold()
                dragFrom.current = null
                setDragTo(null)
              }}
              onPointerMove={(e) => {
                if (dragFrom.current == null) return
                const at = wordAt(e.clientX, e.clientY)
                if (at != null && at !== dragTo) setDragTo(at)
                // なぞり始めたら、長押しでの1語表示はやめる
                if (at != null && at !== dragFrom.current) cancelHold()
                else if (touchRef.current && at == null) cancelHold()
              }}
              onClick={(e) => {
                // 長押し・なぞりで開いた直後の click は捨てる(すぐ閉じてしまうため)
                if (heldRef.current) { heldRef.current = false; return }
                // 触る端末では、軽く触れただけでは開かない
                if (touchRef.current) return
                anchorRef.current = e.currentTarget.closest('.etext-run') ?? e.currentTarget
                if (isOpen) close()
                else if (asPhrase) openRange(asPhrase.from, asPhrase.to)
                else open(i, part)
              }}
            >
              {part.text}
            </button>

            {/* 開いたら、閉じる操作をするまで留まる。
                離れた瞬間に閉じていたため、中のボタンを押せなかった。
                吹き出しは body の直下に出す(親に切られないため) */}
            {isOpen && (
              <GlossPopover
                anchorEl={anchorRef.current}
                gloss={gloss} busy={busy} error={error}
                status={range ? popStatus : status}
                fallbackText={asPhrase
                  ? (text ?? '').slice(parts[asPhrase.from].at,
                    parts[asPhrase.to].at + parts[asPhrase.to].text.length).trim()
                  : part.text}
                onMark={onMark ? (next) => mark(next) : null}
                onClose={close}
              />
            )}
          </span>
        )
  }

  const renderRun = (run) => {
    const inner = []
    for (let i = run.from; i <= run.to; i += 1) inner.push(renderPart(parts[i], i, run))
    if (!run.cls) return inner
    // 吹き出しを開いているあいだは、**まとまり全体が選ばれたまま**に見せる。
    // どれについての意味を見ているのか、目で追えるようにするため
    const open = openIndex !== null && openIndex >= run.from && openIndex <= run.to
    return (
      <span key={`run-${run.from}`}
            className={`etext-run ${run.cls}${open ? ' is-open' : ''}`}>
        {inner}
      </span>
    )
  }

  // 文ごとに1つの箱でくくる。**読み上げの色は、この箱に付ける。**
  //
  // 語や空白に別々に色を付けると、帯が階段状になる。
  // `<button>` は `display: inline` を指定しても効かず、Chromium では
  // `inline-block` になる。実測で語の箱は 31.6px、空白の箱は 21.0px
  // だった。囲みが1つならずれようがない(`.etext-run` と同じ考え方)。
  //
  // 箱は**ただのインライン**にする。折り返し方を変えないため。
  // 行をまたぐと、行ごとに帯が引かれる。蛍光ペンで引いたのと同じ形になる。
  const groups = sentences.map(() => [])
  runs.forEach((run) => {
    const at = parts[run.from]?.at ?? 0
    let gi = sentences.findIndex((sp) => at >= sp.start && at < sp.end)
    if (gi < 0) gi = groups.length - 1
    groups[gi].push(run)
  })

  return (
    <span className={`etext ${className}`} lang={lang} ref={rootRef}>
      {groups.map((rs, gi) => (
        <span key={`sent-${gi}`}
              className={`etext-sent${sentences[gi] === readingSpan ? ' is-reading' : ''}`}>
          {rs.map(renderRun)}
        </span>
      ))}
    </span>
  )
}
