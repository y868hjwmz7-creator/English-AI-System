/**
 * 単語帳の**巻末に刷る「英文の型」のレクチャー**(2026-09 利用者の指定)。
 *
 *   > そして、単語帳の巻末とか間、どこでもよいけど、このレクチャーを入れて
 *   > ただの単語帳ではなく、使いこなすことをイメージできる単語帳にしたい。
 *
 * 【画面には出さない。紙だけ】
 *   `print-only` に乗せる(`ReviewSheet` / `QuickResponseSheet` と同じ作法)。
 *   **新しい紙から始める**(`break-before: page`)—— 語の一覧の余りに
 *   続けて出すと、最後の品詞の続きのように見える。
 *
 * 【中身は `src/data/sentenceFrames.js` 1か所】
 *   **型をここに書き写さない。** 書き写すと、資料(`docs/sentence-frames.html`)
 *   を直したときに**紙だけが古くなる。**
 *
 * 【見た目は、すでにある指定に乗せる】
 *   小見出しは `.qrsheet-title`、表は `.frames-list`(この紙だけの新しい指定)。
 *   **`.qrsheet-list` は使わない** —— あちらは
 *   「左が日本語・右が英語」+ **通し番号**で、語に番号を振るためのものである。
 *   型に番号を振ると、**語の番号と見分けが付かなくなる。**
 */
import { FRAME_SECTIONS, FRAMES_LEAD } from '../data/sentenceFrames.js'

export default function FramesSheet() {
  return (
    <section className="print-only frames-sheet">
      <div className="print-head">
        <strong>英文の「型」— 覚えた語を、文にする</strong>
        <div>{FRAMES_LEAD}</div>
      </div>

      {FRAME_SECTIONS.map((sec) => (
        <div key={sec.id} className="frames-part">
          <h3 className="frames-head">
            <span className="frames-no">{sec.no}</span>{sec.label}
          </h3>
          {sec.lead && <p className="frames-lead">{sec.lead}</p>}

          {sec.groups.map((g) => (
            <div key={g.id} className="frames-group">
              {/* 小見出しは、語の一覧と同じ `.qrsheet-title`。
                  **紙の中で見出しの顔が2つにならない**ようにそろえる */}
              <h4 className="qrsheet-title">{g.label}</h4>
              {/* 型ごとに1行。**型が左、例文が右**(語の一覧と同じ向き) */}
              <ul className="frames-list">
                {g.rows.map((r) => (
                  <li key={r.form}>
                    <span className="frames-form">{r.form}</span>
                    <span className="frames-ex" lang="en">{r.ex}</span>
                  </li>
                ))}
              </ul>
              {/* 覚えるときの注意。**無いものは出さない** */}
              {g.note && <p className="frames-note">{g.note}</p>}
            </div>
          ))}
        </div>
      ))}

      {/* **苦手タグにつながっている**ことを、その場で言う(0060)。
          型そのものを弱点として指摘できるので、練習に回せる */}
      <p className="frames-note frames-tail">
        うまく出てこない型があれば、トレーナーに伝えてください。
        「無生物主語」「名詞構文」は苦手項目として登録してあるので、
        その型だけを練習する教材が作れます。
      </p>
    </section>
  )
}
