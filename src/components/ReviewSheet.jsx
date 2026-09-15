/**
 * 単語帳 / Quick Response 帳の控え(**紙にだけ出す**)。
 *
 * 【なぜ要るか】(2026-09 利用者の指定)
 *
 *   > ちなみに、単語帳やクイックレスポン帖の内容を印刷する機能を
 *   > 追加してください。
 *   > フォーマットは、左に日本語、右に英語が来るようにしてください。
 *   > 教材を印刷、PDFにした時のクイックレスポンの部分と同じ仕様です
 *
 * 【**同じ仕様**を、そのまま使う】
 *   教材の紙のいちばん後ろのページ(`QuickResponseSheet`)は、
 *   すでに「左に日本語・右に英語」で刷っている。
 *   その見た目は `styles.css` の
 *   **`.qrsheet-list` / `.qrsheet-ja` / `.qrsheet-en` 1か所**にあるので、
 *   ここはその指定に乗るだけにする ——
 *   **同じ見た目を2か所に書き写さない**(CLAUDE.md)。
 *   片方を直したときに、もう片方だけ古くなることが起こりえない。
 *
 * 【`print-only` で出す】
 *   画面には出さない。`styles.css` の `.print-only` が
 *   ふだんは隠し、印刷のときだけ出す(`QuickResponseSheet` と同じ作法)。
 *
 * 【中身は作らない】
 *   節に分けるのは `wordSheetSections()`(`reviewSheet.js`)。
 *   **数え方を2通り持たない。**
 *
 * 【品詞ごとに分けて、小見出しを付ける】(2026-09 利用者の指定)
 *
 *   > 単語帳のPDF化の際に、品詞ごとに並び替えて、
 *   > 小見出しをつけて表示されるようにしてほしい。
 *
 *   **通し番号は、節をまたいで続ける。** `ol.qrsheet-list` は
 *   自分で `counter-reset: qr` を持っている(教材の紙がそうなっている)ので、
 *   節ごとに `<ol>` を出すと**どの節も 1 から振り直される。**
 *   包み(`.qrsheet-groups`)の側で1度だけ数え始め、
 *   中の `<ol>` には振り直させない(指定は `styles.css` 1か所)。
 *   こうすれば**教材の紙は1ドットも変わらない**(あちらに包みは無い)。
 *
 * 【巻末にレクチャーを入れる】(2026-09 利用者の指定)
 *
 *   > 単語帳の巻末とか間、どこでもよいけど、このレクチャーを入れて
 *   > ただの単語帳ではなく、使いこなすことをイメージできる単語帳にしたい。
 *
 *   中身は `FramesSheet`。**Quick Response 帳には出さない** ——
 *   言われたのは単語帳である(**言われた場所だけを直す**)。
 *
 * 【どのページの下にも、題とページ数を出す】(2026-09 実機・利用者の指定)
 *
 *   > タイトルの部分を「単語」だけでなく「ビジネス一般」と
 *   > ページ数、そして各単語に番号を振ってください。
 *
 *   200 語は **10 枚**になる。ところが題(`print-head`)は
 *   **1枚目にしか出ない**ので、2枚目から先は何の紙か分からなくなる。
 *
 *   ページの下に出せるのは **`@page` の余白の箱**だけで、あれは
 *   **DOM に無い。** 値を渡す道はカスタムプロパティしかないので、
 *   **`<html>` に題を置く**(`--sheet-name`)。ページ数のほうは
 *   `counter(page) / counter(pages)` で CSS が自分で数える。
 *
 *   **紙をやめたら必ず外す。** 外さないと、そのあと教材を刷ったときに
 *   単語帳の題が下に出たままになる。
 */
import { useLayoutEffect } from 'react'
import { SHEET_ID } from '../lib/printSheet.js'
import { cssString } from '../lib/reviewSheet.js'
import FramesSheet from './FramesSheet.jsx'

export default function ReviewSheet({ title, note, lead, sections, frames = false }) {
  const list = Array.isArray(sections) ? sections.filter((s) => s?.pairs?.length) : []
  const count = list.reduce((n, s) => n + s.pairs.length, 0)

  /* **描き終わる前に置く**(`useLayoutEffect`)。`usePrintSheet` は
     描き終わったあとに `window.print()` を呼ぶので、そこに間に合わせる */
  useLayoutEffect(() => {
    if (!count) return undefined
    const root = document.documentElement
    root.style.setProperty('--sheet-name', cssString(title))
    return () => root.style.removeProperty('--sheet-name')
  }, [title, count])

  if (!count) return null

  return (
    <div className="print-only" id={SHEET_ID}>
      {/* 紙に出したときの見出し。**何の紙か分からないものが配られると、
          あとで整理できない**(教材の紙と同じ作法・`MaterialBody`) */}
      <div className="print-head">
        <strong>{title}</strong>
        <div>{note}</div>
      </div>
      <p className="card-hint lesson-instruction">{lead}</p>

      {/* **番号を数え始めるのは、ここ1か所。** 中の `<ol>` は振り直さない */}
      <div className="qrsheet-groups">
        {list.map((sec) => (
          <div key={sec.id} className="qrsheet-group">
            {/* **小見出しは、中身のあるときだけ。** Quick Response 帳は
                名前を持たない節を1つ渡してくるので、そこには出ない */}
            {sec.label && (
              <h4 className="qrsheet-title">{sec.label}({sec.pairs.length} 語)</h4>
            )}
            <ol className="qrsheet-list">
              {sec.pairs.map((p, i) => (
                <li key={`${p.key || p.en}:${i}`}>
                  <span className="qrsheet-ja">{p.ja}</span>
                  {/* **`lang="en"` は語そのものに付ける。** 囲みに付けると、
                      すぐ隣に置く品詞(日本語)まで英語の字づかいで刷られる
                      (`.print-target [lang="en"]` が 12.5pt にする) */}
                  <span className="qrsheet-en">
                    <span className="qrsheet-word" lang="en">{p.en}</span>
                    {/* 品詞とレベルは**答えの側に、小さく添える。**
                        左の列に置くと、いちばん速く読みたい日本語が混む。
                        **無いものは出さない**(空の札を並べない) */}
                    {(p.pos || p.level) && (
                      <span className="qrsheet-tags">
                        {[p.pos, p.level].filter(Boolean).join(' · ')}
                      </span>
                    )}
                  </span>
                  {/* 例文(出会った文)。**両方の列にまたがって、下の行に置く。**
                      左右に割ると、語の訳と例文の訳が同じ列で混ざる。
                      **無い語は行ごと出さない**(空の行で紙を間延びさせない) */}
                  {p.ex && (
                    <span className="qrsheet-ex">
                      <span lang="en">{p.ex}</span>
                      {p.exJa && <span className="qrsheet-exja">{p.exJa}</span>}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>

      {/* 巻末のレクチャー。**単語帳だけ**(Quick Response 帳には渡さない) */}
      {frames && <FramesSheet />}
    </div>
  )
}
