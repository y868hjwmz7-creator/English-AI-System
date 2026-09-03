/**
 * ② スラッシュリーディング(2026-08 利用者の指定)。
 *
 * > 文章をスラッシュ( / )で区切り、意味ごとのカタマリで文法と意味を理解し、
 * > カタマリ毎の訳を前から言えるようにするトレーニング。
 *
 * 【作り直した理由 ①】(2026-08「壊滅的に使いづらい」)
 *   はじめは**語と語のあいだ**を押させていた。2つ駄目だった。
 *     ・あいだに押せる帯を置いたので、**最初から全部にスラッシュが
 *       入っているように見えた**
 *     ・狙いが細く、スマホで押しにくい
 *
 *   いまは**語そのものを押す。**「この語から新しいカタマリ」という
 *   意味なので、押すとその語の**前**にスラッシュが出る。
 *
 * 【作り直した理由 ②】(2026-08 利用者の判断。**模範との比べっこをやめた**)
 *
 *   > そもそもが区切り方を比べる自体が難しいです。視覚からパッと入って
 *   > 来ません。比べる気も起こりません。そして、区切り方は、ルールとして
 *   > 決めたこと以外、正解はないからです。
 *
 *   以前は「模範の区切り」を出して見比べさせ、合っている数・模範には無い数・
 *   あと何か所、まで数えていた。**これは採点である。**
 *   けれども区切り方に正解は無い。模範は決まりから作った1つの案にすぎず、
 *   案と違うだけのものを並べると、**決まりに反している1本**が埋もれる。
 *
 *   いまの形は3段である(利用者が書いた設計そのまま)。
 *
 *     ① 自分なりに区切りを入れる
 *        → **決まりに反する区切りだけ**、その場で赤い吹き出しが出る
 *     ② 区切り終わったら「この区切りで訳を出す」を押す
 *     ③ **自分の区切りが入った英文**と、それに対応する訳が一緒に出る
 *
 *   出したあとは、上の英文(訳なし)が**練習用**、下の対が**確認用**である。
 *
 * 【決まりは `chunker.js` の `slashProblem()` 1か所】
 *   利用者が挙げた NG は、どれも閉じた語のリストで判定できる。
 *   1文ごとに課金する理由がない。判定を画面に書き写さない。
 *
 * 【訳は教材の控え(0021)から組み立てる。押すたびに課金しない】
 *   **どこで切るかは決まり、何と訳すかは教材の控え。**
 *   自分の区切りに合わせた訳は `chunkPairsAtMarks()` が控えを組み替えて作る。
 *   控えの無い教材では出さない。**無いものを、あるように見せない。**
 */
import { Fragment, useEffect, useState } from 'react'
import { useProgress } from '../lib/progress.js'
import { checkSlashes, judgeSlashes, wordsOf } from '../lib/chunker.js'
import { chunkPairsOfAtMarks, storedChunks } from '../lib/chunkJa.js'
import { bodyUnitWord, slashUnitsFor } from '../lib/sixSteps.js'
import SpeakButton from './SpeakButton.jsx'

/**
 * 決まりに反する区切りが1つも無いときの声かけ(2026-08 利用者の指定)。
 *
 *   > 違反している区切りはありません、ではなくて、結果的に違反の数がゼロなら
 *   > fantastic! などポジティブな声かけに、変えましょう
 *
 * 「◯◯はありません」は、**無いことの報告**であって褒め言葉ではない。
 * うまく区切れたのだから、そう言う。
 */
const PRAISE = [
  'Fantastic! きれいに区切れています',
  'Great job! 決まりどおりです',
  'Perfect! 迷いのない区切りです',
  'Excellent! 前から読めるカタマリです',
  'Nice work! この調子です',
]

/**
 * どれを出すかは**段落ごとに決める。**
 * 押すたびに入れ替わると、目が言葉のほうへ行って気が散る。
 */
const praiseFor = (id) => PRAISE[
  [...String(id ?? '')].reduce((n, c) => n + c.charCodeAt(0), 0) % PRAISE.length
]

/** そのブロックの中身(項目)。「文章全体」では複数の段落が入る */
const partsOf = (s) => s.parts ?? [{ id: s.id, prompt_en: s.text }]

/** 訳の控え(0021)があるブロックか。無ければ「訳を出す」を出さない */
const hasJaOf = (s) => partsOf(s).some((p) => storedChunks(p))

export default function SlashReading({
  blocks, clipVoice, tier, rate, unit, onUnitChange, progressAt = null,
  learnerId = null,
  /** 会話・会議か。**単位の言葉が変わる**(段落ごと / 発言ごと・2026-09) */
  isDialogue = false,
  /** 何番から数えるか。集中モードでは1つだけ渡すので、外から番号をもらう */
  startNo = 1,
}) {
  /* **入れかけの区切りを覚えておく**(2026-08 利用者の指定)。
     20か所入れたあとで別のタブを見に行くと、やり直しになっていた。
     鍵の形は `progress.js` に1か所だけ置いてある。 */
  const [marks, setMarks] = useProgress(`${progressAt}.marks`, {}, learnerId)
  const [shown, setShown] = useProgress(`${progressAt}.shown`, {}, learnerId)
  // **通しで見る**(2026-08 利用者の指定)。段落ごとの作業と切り替える
  const [review, setReview] = useState(false)

  // **まとめて出せるようにする**(2026-08 利用者の指定)。
  //
  //   > これは段落ごとでも全体を一度にでもどちらでもできるようにして
  //   > 欲しいです。
  //
  // 段落ごとに区切っていくと、押すボタンが段落の数だけになる。
  // 全部入れ終わってから見直したいときは、**1回で出せたほうが早い。**
  // 段落ごとに出す道は残す(1つずつ確かめたいときのため)。
  const jaBlocks = blocks.filter((b) => hasJaOf(b) || b.ja)
  const allOpen = jaBlocks.length > 0 && jaBlocks.every((b) => shown[b.id])
  const toggleAll = () => setShown(allOpen
    ? {}
    : Object.fromEntries(jaBlocks.map((b) => [b.id, true])))

  //
  // **まちがいは、次にどこかを触ったら消える**(2026-08 利用者の指定)。
  // 指摘を読んだあと、自分で消して回らなくてよい。
  // ただし**いま押したものは残す。** 消してしまうと、吹き出しが
  // 出た瞬間に消えて、何を言われたのか読めない。
  const dropWrong = (list, text, keep = null) => {
    const bad = new Set(checkSlashes(text, list).map((n) => n.at))
    if (!bad.size) return list
    return list.filter((i) => i === keep || !bad.has(i))
  }

  /** その区切りだけを消す(吹き出しを押したとき) */
  const remove = (id, at) => setMarks((m) => ({
    ...m, [id]: (m[id] ?? []).filter((i) => i !== at),
  }))

  const toggle = (id, at, text) => setMarks((m) => {
    const now = new Set(m[id] ?? [])
    if (now.has(at)) now.delete(at)
    else now.add(at)
    const next = dropWrong([...now].sort((a, b) => a - b), text, at)
    return { ...m, [id]: next }
  })

  // 語**以外**を押したときも消す。画面のどこを触っても、指摘は片づく
  useEffect(() => {
    const onClick = (e) => {
      if (e.target.closest?.('.slash-word')) return
      setMarks((m) => {
        let changed = false
        const next = { ...m }
        for (const blk of blocks) {
          const cur = m[blk.id]
          if (!cur?.length) continue
          const kept = dropWrong(cur, blk.text)
          if (kept.length !== cur.length) { next[blk.id] = kept; changed = true }
        }
        return changed ? next : m
      })
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [blocks])

  return (
    <div className="slash">
      <div className="slash-head">
        {/* **1文ずつでは細かすぎる**(2026-08 の指摘)。
            段落(会話・会議は発言)ごとか、本文まるごとかを選ぶ。
            **言葉は教材の形から決める**(2026-09 利用者の指定)。
            会話なのに「段落ごと」と出ていた */}
        <label className="rate-pick">
          <span>単位</span>
          <select value={unit} onChange={(e) => onUnitChange(e.target.value)}>
            {slashUnitsFor(isDialogue).map((u) => (
              <option key={u.id} value={u.id} title={u.hint}>{u.label}</option>
            ))}
          </select>
        </label>
        {/* **2つ以上あるときだけ出す。** 1つしかないなら、
            その段落のボタンと同じことをする札が2つ並ぶだけになる */}
        {jaBlocks.length > 1 && !review && (
          <button type="button"
                  className={`btn btn--small${allOpen ? '' : ' btn--primary'}`}
                  onClick={toggleAll}>
            {allOpen ? 'すべての訳を隠す' : 'すべての区切りで訳を出す'}
          </button>
        )}
        {/* ★ **つないだものを1枚で**見られるようにする(2026-08 利用者の指定)

              > 全ての段落が終わった後には、各段落の区切った文と訳を全て
              > 繋いであるものを用意してあげて参照できるようにしたいな。
              > ボタンを押せば切り替わるような仕組みが良い

            【いつでも押せるようにした】(2026-09 利用者の指摘)

              > 段落ごとに分けた英文と訳は、すべてつながって見れる場所が
              > 欲しいです。

            はじめは**全段落の訳を出したあとだけ**出していた。虫食いの一枚を
            見せないためである。ところが**そこへ行き着く道が見えず**、
            「そういう場所が欲しい」と言われた。

            **押したときに、こちらで全段落の訳を出してから切り替える。**
            そうすれば虫食いにならず、しかも1回で着く。
            「効かないボタンを出さない」も守れている。 */}
        {jaBlocks.length > 1 && (
          <button type="button"
                  className={`btn btn--small${review ? '' : ' btn--primary'}`}
                  onClick={() => {
                    // **通しへ行くときは、足りない訳をここで出しておく**
                    if (!review && !allOpen) toggleAll()
                    setReview((v) => !v)
                  }}>
            {review ? '区切りに戻る' : '通しで見る'}
          </button>
        )}
      </div>

      {/* **やり方の説明は、ここには置かない**(2026-09 利用者の指定)。
            > 青くハイライトした文言は不必要です。消してください

          同じことは上の「やり方」(`SIX_STEPS` の `how`)に書いてあり、
          畳んで開ける形になっている。**同じ説明を2か所に置かない。**
          読むものが増えると、本文そのものが下へ押し出される。 */}

      {/* ★ 通しの一枚。**押すところは置かない。** 参照するためのものなので、
          区切りを触れるようにすると練習用と見分けが付かなくなる */}
      {review ? (
        <div className="answer-box slash-review">
          <p className="answer-box-label">通し(自分の区切りと訳)</p>
          {blocks.map((b) => (
            <div className="slash-review-block" key={b.id}>
              {b.speaker && (
                <span className="passage-speaker" lang="en">{b.speaker}</span>
              )}
              <MinePairs parts={partsOf(b)} marks={marks[b.id] ?? []} />
            </div>
          ))}
        </div>
      ) : (
      <ol className="slash-list">
        {blocks.map((s, n) => {
          const words = wordsOf(s.text)
          const mine = marks[s.id] ?? []
          const open = shown[s.id]
          // **1本ずつ、その場で判定する**(2026-08 利用者の指定)。
          // 見るのは「決まりに反していないか」だけ。模範とは比べない
          const judge = judgeSlashes(s.text, mine)
          // 自分の区切りに合わせた訳。控えが無い教材では null
          const parts = partsOf(s)
          const hasJa = hasJaOf(s)
          return (
            <li key={s.id} className="qa-row slash-row">
              {/* **操作は右上にまとめる。** 話者の名前と反対側に置くと、
                  本文と解答をそのぶん上に寄せられる(2026-08 の指摘) */}
              <div className="row-head">
                {/* **番号を出す**(2026-09 利用者の指定
                    「どのページでも段落番号とか全て入れてください」)。
                    紙とレッスンで「2番のところ」と同じ場所を指せる */}
                <span className="dictation-no">{startNo + n}</span>
                {s.speaker && <span className="passage-speaker" lang="en">{s.speaker}</span>}
                <span className="row-tools">
                  <SpeakButton text={s.text} className="etext-listen"
                               clipVoice={clipVoice} tier={tier} rate={rate} />
                  {/* **出せる訳があるときだけ出す。** 押しても何も出ない
                      ボタンを置かない(無いものをあるように見せない)。

                      **控えが無い教材でも、段落の訳は出す**(2026-08 実機)。
                      ② を作り直したときに `hasJa` だけで出し分けてしまい、
                      **段落ごとに訳を見る道を落としていた。**
                      > 各段落ごとに訳を出す機能がなくなってしまいました。 */}
                  {(hasJa || s.ja) && (
                    <button type="button"
                            className={`btn btn--small${open ? '' : ' btn--primary'}`}
                            onClick={() => setShown((v) => ({ ...v, [s.id]: !v[s.id] }))}>
                      {open ? '訳を隠す' : (hasJa ? 'この区切りで訳を出す' : '訳を出す')}
                    </button>
                  )}
                  {mine.length > 0 && (
                    <button type="button" className="btn btn--small btn--link"
                            onClick={() => setMarks((m) => ({ ...m, [s.id]: [] }))}>
                      区切りを消す
                    </button>
                  )}
                </span>
              </div>

              {/* 押すのは**語**。押すとその語の前にスラッシュが出る。
                  押すまでは、ただの英文のまま。
                  **訳を出したあとも、ここは訳なしのまま**にしておく
                  (2026-08 利用者の指定。ここが練習用、下が確認用) */}
              <p className="slash-line" lang="en">
                {/* 空白は**囲みの外**に置く。中に入れると `white-space: nowrap`
                    が効いて改行できる場所が無くなり、長い文が画面から
                    はみ出した(実測) */}
                {words.map((w, i) => (
                  <Fragment key={i}>
                    <span className="slash-w">
                      {mine.includes(i) && (
                        <span className={`slash-mark is-${judge.at[i]?.state ?? 'plain'}`}
                              title={judge.at[i]?.why || ''}
                              aria-label={judge.at[i]?.state === 'ng'
                                ? '決まりに反する区切り' : '区切り'}>
                          /
                        </span>
                      )}
                      {/* **まちがいは、その場に吹き出しで出す。**
                          下にまとめて並べていたので、どの区切りの話なのか
                          ぱっと見て分からなかった(2026-08 の指摘)。
                          ここに出せば、直せば消える */}
                      {judge.at[i]?.state === 'ng' && (
                        /* **吹き出しを押すと、そのまちがいごと消える**
                           (2026-08 利用者の指定)。読んだらすぐ片づけられる */
                        <button type="button" className="slash-tip"
                                title={`${judge.at[i].why}(押すと消えます)`}
                                aria-label={`${judge.at[i].short}。押すとこの区切りを消します`}
                                onClick={() => remove(s.id, i)}>
                          {judge.at[i].short}
                        </button>
                      )}
                      {i === 0 ? (
                        <span className="slash-word is-first">{w}</span>
                      ) : (
                        <button type="button"
                                className={`slash-word${mine.includes(i) ? ' is-on' : ''}`}
                                aria-pressed={mine.includes(i)}
                                aria-label={`${w} の前で区切る`}
                                onClick={() => toggle(s.id, i, s.text)}>
                          {w}
                        </button>
                      )}
                    </span>
                    {' '}
                  </Fragment>
                ))}
              </p>

              {/* **数えない。** 合っている数・模範には無い数・あと何か所、は
                  採点であり、区切り方に正解が無い以上、意味を持たない(2026-08)。
                  1つも反していなければ、**褒める**(2026-08 利用者の指定) */}
              {mine.length > 0 && judge.ng === 0 && (
                <p className="slash-score">
                  <span className="slash-score-done">{praiseFor(s.id)}</span>
                </p>
              )}

              {open && (
                <div className="answer-box slash-answer">
                  <p className="answer-box-label">自分の区切りと訳</p>
                  <MinePairs parts={parts} marks={mine} />
                  {/* 控えが無い教材では、これまでどおり文ぜんぶの訳を出す。
                      **無いものを、あるように見せない** */}
                  {!hasJa && s.ja && (
                    <p className="slash-ja">
                      {/* **会話・会議では「発言の訳」**(2026-09 利用者の指定) */}
                      {s.jaIsWhole && (
                        <span className="slash-ja-label">{bodyUnitWord(isDialogue)}の訳</span>
                      )}
                      {s.ja}
                    </p>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ol>
      )}
    </div>
  )
}

/**
 * ブロック全体で持っている区切りの位置を、**項目ごとに割り直す。**
 *
 * 「文章全体」を選ぶと、段落をつないだ1本の英文になる(`blocksOf`)。
 * 区切りの位置はそのつないだ英文の語数で数えているが、
 * **訳の控えは項目(段落 / 発言)ごと**にある。割り直さないと、
 * 2段落目以降の区切りが訳と食い違う。
 */
function splitMarks(parts, marks) {
  let off = 0
  return parts.map((part) => {
    const n = wordsOf(part.prompt_en).length
    const local = marks.filter((k) => k > off && k < off + n).map((k) => k - off)
    off += n
    return { part, local }
  })
}

/**
 * 自分の区切りに訳を当てたものを描く。
 * **段落の箱からも、通しの一覧からも同じものを使う。**
 * 見た目を2か所に書き写すと、片方だけ直り忘れる。
 */
function MinePairs({ parts, marks }) {
  return splitMarks(parts, marks).map(({ part, local }, i) => {
    const pairs = chunkPairsOfAtMarks(part, local)
    // 控えが無い / 数が合わない。**黙って英語だけを出さない。**
    // 何が起きたのか分からず、直す道も見えない(2026-08 実機)
    if (!pairs) {
      return (
        <div key={part.id ?? i}>
          <p className="slash-out" lang="en">{part.prompt_en}</p>
          {storedChunks(part) && (
            <p className="notice notice--warn slash-stale">
              この本文の訳は、まだ用意できていません。
              <br />
              教材をさがす画面でこの教材を開くと、<strong>裏で作り直します</strong>
              (少し待ってから、もう一度開いてください)。
            </p>
          )}
        </div>
      )
    }
    return (
      <p className="slash-out slash-out--mine" key={part.id ?? i}>
        <span className="chunked">
          {pairs.map((p, n) => (
            <span className="chunk" key={n}>
              <span className="chunk-en" lang="en">
                {n > 0 && <span className="chunk-bar" aria-hidden="true">/</span>}
                {/* 控えの境目でない自分の区切りも、英語には出す。
                    訳はそのカタマリぶんをまとめて置く */}
                {p.segs.map((seg, k) => (
                  <Fragment key={k}>
                    {k > 0 && (
                      <span className="chunk-bar chunk-bar--mine" aria-hidden="true">/</span>
                    )}
                    {seg}
                  </Fragment>
                ))}
              </span>
              {/* **訳がいくつも重なったときは、行を分ける**(2026-09 実機)。
                  自分の区切りが控えの境目と重ならないと、そのカタマリには
                  **いくつもの訳がまとまって入る。** つないで1本にすると
                  「今日時間を作ってくれて話しておきたかったスケジュールに…」と、
                  日本語として読めない棒になっていた(利用者の写真)。
                  **区切り記号は足さない**(訳の側にスラッシュは出さない
                  ・2026-08 利用者の指定)。行を分けるだけで読めるようになる */}
              {(p.jaParts?.length ?? 0) > 1 ? (
                <span className="chunk-ja chunk-ja--many">
                  {p.jaParts.map((t, k) => <span key={k}>{t}</span>)}
                </span>
              ) : (
                <span className="chunk-ja">{p.ja || '　'}</span>
              )}
            </span>
          ))}
        </span>
      </p>
    )
  })
}
