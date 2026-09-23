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
import PracticeRow from './PracticeRow.jsx'
import { Fragment, useEffect } from 'react'
import { useProgress } from '../lib/progress.js'
import { checkSlashes, judgeSlashes, wordsOf } from '../lib/chunker.js'
import { chunkPairsOfAtMarks, storedChunks } from '../lib/chunkJa.js'
import { bodyUnitWord } from '../lib/sixSteps.js'
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
  blocks, clipVoice, tier, rate, progressAt = null,
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

  /* ── **訳は、区切りを入れたらその場に出る**(第5.242節・2026-09-23)──

       > スラッシュリーディングの「区切りを出す、隠す」「訳を出す、隠す」
       > 「通しで見る」などの UI がアプリの作成をしている私でも
       > よくわからず混乱します。**結局スラッシュを入れ終えれば、
       > 必要なのはスラッシュを入れ終えた英文と訳が並んでいる部分だけです。**

     押すところを**3つとも消した。**
       ・段落ごとの「この区切りで訳を出す / 訳を隠す」
       ・帯の「すべての区切りで訳を出す / すべての訳を隠す」
       ・帯の「通しで見る / 区切りに戻る」(画面ごと入れ替わっていた)

     **同じことをするものを3つ見せていた**(CLAUDE.md)。しかも3つめは
     画面が入れ替わるので、**戻り方を探す**ことになっていた。

     いまは**区切りを1つ入れた時点で、そのカタマリの下に訳が出る。**
     上から下へ見ていけば、それがそのまま「通しの一枚」である ——
     **別に作る必要が無い。** */
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
      {/* **「単位」の選びは、ここには置かない**(第5.242節・2026-09-23)。
          速さと同じ帯(`.passage-tools`)へ移した ——
          同じ形の選びが2つ、**違う行・違う寄せ方**で出ていたのが、
          「統一感が無い」の正体の1つだった。
          どのステップに出すかは `SIX_STEPS.barUnit` 1か所にある */}

      {/* **やり方の説明は、ここには置かない**(2026-09 利用者の指定)。
            > 青くハイライトした文言は不必要です。消してください

          同じことは上の「やり方」(`SIX_STEPS` の `how`)に書いてあり、
          畳んで開ける形になっている。**同じ説明を2か所に置かない。**
          読むものが増えると、本文そのものが下へ押し出される。 */}

      {/* **通しの一枚は、もう作らない**(第5.242節)。
          段落を上から下へ見ていけば、それがそのまま通しである ——
          **同じものを2か所に作らない**(CLAUDE.md) */}
      <ol className="slash-list">
        {blocks.map((s, n) => {
          const words = wordsOf(s.text)
          const mine = marks[s.id] ?? []
          // **1本ずつ、その場で判定する**(2026-08 利用者の指定)。
          // 見るのは「決まりに反していないか」だけ。模範とは比べない
          const judge = judgeSlashes(s.text, mine)
          const parts = partsOf(s)
          const hasJa = hasJaOf(s)
          /* **英文は1つだけ**(第5.242節・2026-09-23 利用者の指定)。
             押して区切る行と、確かめる箱で**同じ英文を2回出していた。**
             いまは1つの英文を、訳のカタマリで束ねて描き、
             **その下に訳を置く。** 区切りを入れるまで、訳は出ない */
          const groups = jaGroupsOf(parts, mine)

          /** 語を1つ描く(番号は**ブロック全体**で数える) */
          const 語 = (i) => (
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
                    **押すと、そのまちがいごと消える**(2026-08 利用者の指定) */}
                {judge.at[i]?.state === 'ng' && (
                  <button type="button" className="slash-tip"
                          title={`${judge.at[i].why}(押すと消えます)`}
                          aria-label={`${judge.at[i].short}。押すとこの区切りを消します`}
                          onClick={() => remove(s.id, i)}>
                    {judge.at[i].short}
                  </button>
                )}
                {i === 0 ? (
                  <span className="slash-word is-first">{words[i]}</span>
                ) : (
                  <button type="button"
                          className={`slash-word${mine.includes(i) ? ' is-on' : ''}`}
                          aria-pressed={mine.includes(i)}
                          aria-label={`${words[i]} の前で区切る`}
                          onClick={() => toggle(s.id, i, s.text)}>
                    {words[i]}
                  </button>
                )}
              </span>
              {' '}
            </Fragment>
          )

          return (
            <li key={s.id} className="qa-row slash-row">
              {/* **音の要素は置かない**(2026-09-23 利用者の指定)。

                    > スラッシュリーディングには「自分で言う」とか
                    > 「真似て言う」とか言う音の要素は要らないです。
                    > 音声プレーヤーだけ常に残しておいてもらえれば十分です

                  残すのは Listen と、入れた区切りを消すものだけ。
                  **色は3つから選ぶ**(共通ルール)—— 素の白は使わない */}
              <PracticeRow no={startNo + n} speaker={s.speaker}>
                <SpeakButton text={s.text} className="etext-listen"
                             clipVoice={clipVoice} tier={tier} rate={rate} />
                {mine.length > 0 && (
                  <button type="button" className="btn btn--small btn--ghost"
                          onClick={() => setMarks((m) => ({ ...m, [s.id]: [] }))}>
                    区切りを消す
                  </button>
                )}
              </PracticeRow>

              {/* 押すのは**語**。押すとその語の前にスラッシュが出て、
                  **そのカタマリの訳が下に出る。**
                  空白は**囲みの外**に置く。中に入れると `white-space: nowrap`
                  が効いて改行できる場所が無くなり、長い文がはみ出す(実測) */}
              <div className="slash-body">
                {groups.map((g) => (
                  <div className="slash-chunk" key={g.from}>
                    <p className="slash-line" lang="en">
                      {Array.from({ length: g.to - g.from }, (_, k) => 語(g.from + k))}
                    </p>
                    {/* **区切りを入れるまでは出さない。**
                        入れた瞬間から、そのカタマリの訳がここに並ぶ */}
                    {mine.length > 0 && g.jaParts && (
                      <p className="slash-chunk-ja">
                        {g.jaParts.map((x, k) => <span key={k}>{x}</span>)}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {/* 控えが無い教材では、これまでどおり文ぜんぶの訳を出す。
                  **無いものを、あるように見せない** */}
              {mine.length > 0 && !hasJa && s.ja && (
                <p className="slash-ja">
                  {/* **会話・会議では「発言の訳」**(2026-09 利用者の指定) */}
                  {s.jaIsWhole && (
                    <span className="slash-ja-label">{bodyUnitWord(isDialogue)}の訳</span>
                  )}
                  {s.ja}
                </p>
              )}

              {/* **数えない。** 合っている数・模範には無い数・あと何か所、は
                  採点であり、区切り方に正解が無い以上、意味を持たない(2026-08)。
                  1つも反していなければ、**褒める**(2026-08 利用者の指定) */}
              {mine.length > 0 && judge.ng === 0 && (
                <p className="slash-score">
                  <span className="slash-score-done">{praiseFor(s.id)}</span>
                </p>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

/**
 * **ブロックぜんぶを、訳のカタマリで束ねる**(第5.242節・2026-09-23)。
 *
 *   > 結局スラッシュを入れ終えれば、必要なのは
 *   > スラッシュを入れ終えた英文と訳が並んでいる部分だけです
 *
 * これまでは**英文を2回**出していた —— 押して区切る行と、確かめる箱。
 * 1つにまとめるために、**押せる語を、訳のカタマリの区切りで束ねる。**
 *
 * **語の番号は、ブロック全体で数える。**「文章全体」を選ぶと段落を
 * つないだ1本になるが、**訳の控えは項目(段落 / 発言)ごと**にあるので、
 * ここで足し合わせて番号をそろえる。
 *
 * @returns {{from: number, to: number, jaParts: string[]|null}[]}
 *   `jaParts` が `null` なのは**控えが無い項目**。英文だけを描く
 */
function jaGroupsOf(parts, marks) {
  const out = []
  let off = 0
  for (const part of parts) {
    const n = wordsOf(part.prompt_en).length
    const local = marks.filter((k) => k > off && k < off + n).map((k) => k - off)
    const pairs = chunkPairsOfAtMarks(part, local)
    if (!pairs) {
      // **控えが無い / 数が合わない。** 英文はそのまま1つのかたまりで描く
      out.push({ from: off, to: off + n, jaParts: null })
    } else {
      for (const p of pairs) {
        out.push({ from: off + p.from, to: off + p.to, jaParts: p.jaParts })
      }
    }
    off += n
  }
  return out
}
