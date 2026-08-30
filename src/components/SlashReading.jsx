/**
 * ② スラッシュリーディング(2026-08 利用者の指定)。
 *
 * > 文章をスラッシュ( / )で区切り、意味ごとのカタマリで文法と意味を理解し、
 * > カタマリ毎の訳を前から言えるようにするトレーニング。
 *
 * 【作り直した理由】(2026-08「壊滅的に使いづらい」)
 *   はじめは**語と語のあいだ**を押させていた。2つ駄目だった。
 *     ・あいだに押せる帯を置いたので、**最初から全部にスラッシュが
 *       入っているように見えた**
 *     ・狙いが細く、スマホで押しにくい
 *
 *   いまは**語そのものを押す。**「この語から新しいカタマリ」という
 *   意味なので、押すとその語の**前**にスラッシュが出る。
 *     ・語は大きいので、指で確実に狙える
 *     ・押すまで何も出ない。**素の英文のまま**始まる
 *     ・スラッシュリーディングの教え方(意味の切れ目の前に入れる)とも合う
 *
 * 【模範の区切りは、決まりで出す。AI に頼まない】
 *   利用者が挙げた決まりは、どれも閉じた語のリストで判定できる
 *   (`src/lib/chunker.js`)。1文ごとに課金する理由がない。
 *
 * 【まだ無いもの】
 *   **カタマリごとの訳例。** どこで切るかは決まりで分かるが、
 *   そのカタマリを日本語で何と言うかは決まりでは書けない。
 *   いまは文ぜんぶの訳を出している(仕様書 第5.29.3節)。
 */
import { Fragment, useEffect, useState } from 'react'
import { SLASH_LEVELS, checkSlashes, judgeSlashes, wordsOf } from '../lib/chunker.js'
import { SLASH_UNITS } from '../lib/sixSteps.js'
import SpeakButton from './SpeakButton.jsx'

/** 区切りを入れた英文を描く。`marks` は「その語の前で切る」語の番号 */
function Slashed({ words, marks, tone = '' }) {
  return (
    <p className={`slash-out${tone ? ` slash-out--${tone}` : ''}`} lang="en">
      {words.map((w, i) => (
        <Fragment key={i}>
          <span className="slash-w">
            {marks.includes(i) && <span className="slash-mark" aria-label="区切り">/</span>}
            {w}
          </span>
          {' '}
        </Fragment>
      ))}
    </p>
  )
}

export default function SlashReading({
  blocks, clipVoice, tier, rate, level, onLevelChange, unit, onUnitChange,
}) {
  const [marks, setMarks] = useState({})   // 文ごとの区切り
  const [shown, setShown] = useState({})   // 「解答を見る」を押した文

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
            段落(会話は発言)ごとか、本文まるごとかを選ぶ */}
        <label className="rate-pick">
          <span>単位</span>
          <select value={unit} onChange={(e) => onUnitChange(e.target.value)}>
            {SLASH_UNITS.map((u) => (
              <option key={u.id} value={u.id} title={u.hint}>{u.label}</option>
            ))}
          </select>
        </label>
        <label className="rate-pick">
          <span>区切りの細かさ</span>
          <select value={level} onChange={(e) => onLevelChange(e.target.value)}>
            {SLASH_LEVELS.map((l) => (
              <option key={l.id} value={l.id} title={l.hint}>{l.label}</option>
            ))}
          </select>
        </label>
      </div>

      <ol className="slash-list">
        {blocks.map((s) => {
          const words = wordsOf(s.text)
          const mine = marks[s.id] ?? []
          const open = shown[s.id]
          // **1本ずつ、その場で判定する**(2026-08 利用者の指定)
          const judge = judgeSlashes(s.text, mine, level)
          const model = judge.model
          return (
            <li key={s.id} className="qa-row slash-row">
              {/* **操作は右上にまとめる。** 話者の名前と反対側に置くと、
                  本文と解答をそのぶん上に寄せられる(2026-08 の指摘) */}
              <div className="row-head">
                {s.speaker && <span className="passage-speaker" lang="en">{s.speaker}</span>}
                <span className="row-tools">
                  <SpeakButton text={s.text} className="etext-listen"
                               clipVoice={clipVoice} tier={tier} rate={rate} />
                  <button type="button" className="btn btn--small"
                          onClick={() => setShown((v) => ({ ...v, [s.id]: !v[s.id] }))}>
                    {open ? '解答を隠す' : '解答を見る'}
                  </button>
                  {mine.length > 0 && (
                    <button type="button" className="btn btn--small btn--link"
                            onClick={() => setMarks((m) => ({ ...m, [s.id]: [] }))}>
                      区切りを消す
                    </button>
                  )}
                </span>
              </div>

              {/* 押すのは**語**。押すとその語の前にスラッシュが出る。
                  押すまでは、ただの英文のまま */}
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
                              aria-label={judge.at[i]?.state === 'ok' ? '合っている区切り'
                                : judge.at[i]?.state === 'ng' ? '決まりに反する区切り' : '区切り'}>
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

              {/* 入れた瞬間に分かる judge。
                  **模範と違う = まちがい、ではない。** 切り方には幅がある。
                  決まりに反しているものだけを「ちがう」と言う */}
              {mine.length > 0 && (
                <p className="slash-score">
                  <span className="slash-score-ok">合っている {judge.ok}</span>
                  {judge.ng > 0 && <span className="slash-score-ng">ちがう {judge.ng}</span>}
                  {judge.plain > 0 && <span className="slash-score-plain">模範には無い {judge.plain}</span>}
                  {judge.missing > 0 && (
                    <span className="slash-score-rest">あと {judge.missing} か所</span>
                  )}
                  {judge.missing === 0 && judge.ng === 0 && (
                    <span className="slash-score-done">模範どおりです</span>
                  )}
                </p>
              )}

              {open && (
                <div className="answer-box slash-answer">
                  <p className="answer-box-label">
                    模範の区切り({SLASH_LEVELS.find((l) => l.id === level)?.label})
                    {mine.length > 0 && (
                      <button type="button" className="btn btn--link slash-copy"
                              onClick={() => setMarks((m) => ({ ...m, [s.id]: model }))}>
                        この区切りに合わせる
                      </button>
                    )}
                  </p>
                  {/* **自分の区切りと同じ形で出す。** 形が違うと見比べられない。
                      理由の一覧は**廃止した**(2026-08「見づらいだけ」)。
                      長い文だと12行並び、読むものではなくなっていた。
                      理由は1本ずつ、スラッシュに触れると出る(`title`) */}
                  <Slashed words={words} marks={model} tone="model" />
                  {s.ja && (
                    <p className="slash-ja">
                      {s.jaIsWhole && <span className="slash-ja-label">段落の訳</span>}
                      {s.ja}
                    </p>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
