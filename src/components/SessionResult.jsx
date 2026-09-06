/**
 * **やり終えたときの1枚**(2026-09 利用者の指定
 * 「単語帳とクイックレスポンス帳にゲーミフィケーションを追加したいです」)。
 *
 * ============================================================================
 * 【単語帳と Quick Response で、同じ部品を使う】
 *
 *   終わりの画面は、どちらも「点数・できなかったもの・次へ」で同じである。
 *   **書き写すと、必ず片方だけ古くなる**(単語帳で `LearnerWordbook` を
 *   別に持って踏んだ失敗・CLAUDE.md)。だから1つにまとめる。
 *
 * 【出すのは4つだけ】
 *
 *   **数を並べただけでは、何も伝わらない**(2026-09 実機の指摘)。
 *   札を5つ並べて「どれも読まれない」を一度やっている。だからここも絞る。
 *
 *   | 何 | なぜ |
 *   |---|---|
 *   | 点数(大きく) | やり切ったことが目で分かる |
 *   | 声かけ | **結果から決める**(押すたびに変わらない) |
 *   | 連続 | **3以上のときだけ。** 2連続で騒がない |
 *   | 週の続き | **日ではなく週**(0019 の決まり) |
 *
 *   できなかったものの一覧は、これまでどおり下に出す。
 *   **「また明日出ます」まで書く** —— 消えてしまうように見せない。
 *
 * 【音は1回だけ】
 *   `playSfx('done')`。**鳴らすかどうかは `sfx.js` が決める**
 *   (左のメニューで切れる)。ここで `soundOn` を見ない。
 */
import { useEffect } from 'react'
import { playSfx } from '../lib/sfx.js'
import { praiseFor, streakLine, weekLine } from '../lib/gamify.js'

/**
 * @param items    答えた順の `[{ ok, main, sub }, …]`。`ok` で数える
 * @param unit     数え方の言葉(語 / 文)
 * @param week     `{ days, weeks }`(無ければ出さない)
 * @param missLead できなかったものの上に出す一言
 * @param children 次へ進むボタンなど。**呼ぶ側が決める**
 * @param extra    点数の下に足すもの(集まり具合など)
 */
export default function SessionResult({
  items = [], unit = '語', week = null,
  missLead = '上に出ているのが、思い出せなかったものです。また明日出ます。',
  extra = null, children = null,
}) {
  const list = Array.isArray(items) ? items : []
  const total = list.length
  const ok = list.filter((x) => x?.ok).length
  const miss = list.filter((x) => !x?.ok)

  /* **やり切った合図は1回だけ。** 出た瞬間に鳴らす
     (`done` は「裏の仕事が終わった」と同じ音・`sfx.js`) */
  useEffect(() => { playSfx('done') }, [])

  const praise = praiseFor(ok, total)
  const streak = streakLine(list)
  const weeks = weekLine(week)

  return (
    <div className="sresult">
      {/* **点数は大きく。** やり切ったことが、ひと目で分かる */}
      <p className="sresult-score">
        <strong>{ok}</strong>
        <span className="sresult-of">/ {total} {unit}</span>
      </p>

      {/* 声かけ。**責めない** —— 知らないことは失敗ではない */}
      {praise && <p className="sresult-praise">{praise}</p>}

      {/* 連続と、週の続き。**どちらも無いときは行ごと出さない** */}
      {(streak || weeks) && (
        <p className="sresult-lines">
          {streak && <span className="sresult-streak">{streak}</span>}
          {weeks && <span className="sresult-week">{weeks}</span>}
        </p>
      )}

      {extra}

      {miss.length > 0 && (
        <>
          <ul className="sresult-miss">
            {miss.map((x, i) => (
              <li key={i}>
                {x.sub && <span className="sresult-sub">{x.sub}</span>}
                <span lang="en">{x.main}</span>
              </li>
            ))}
          </ul>
          <p className="hint">{missLead}</p>
        </>
      )}
      {miss.length === 0 && total > 0 && (
        <p className="hint">全部そろいました。よくできました。</p>
      )}

      {children}
    </div>
  )
}
