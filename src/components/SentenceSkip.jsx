/**
 * **鳴らすボタンと、その両脇の ◀ ▶ を、1つの錠剤にまとめる**
 * (2026-09 利用者の指定)。
 *
 *   > listenボタンの横の三角ボタンで段落しか切り替わりません。
 *   > あと、ボタンのデザインがひどいです。
 *   > 角の丸い四角か楕円の中に◀︎［英語を聞く］▶︎こんな感じにしてください
 *
 * ============================================================================
 * 【何が「ひどかった」か】
 *
 *   ボタンが**3つばらばらに並んでいた**(◀◀ / Listen / ▶▶)。
 *   しかも 2026-09 に 1文ずつの ◁▷ を足したので、
 *   **同じ行に三角が2組**になり、どちらが何を動かすのか分からなくなった。
 *
 *   だから**1つの錠剤にまとめ、三角も1組だけ**にする。
 *
 *       ╭──────────────────────────╮
 *       │  ◀   🔊 Listen (全体)   ▶  │
 *       ╰──────────────────────────╯
 *
 * ============================================================================
 * 【三角が動かす単位】**文が先。無ければ段落**
 *
 *   利用者の指定は「1文ずつ飛ばしたり戻したり」である。
 *   文の区間は、**1本にまとめた音声と一緒に控えた時刻**から出す
 *   (`sentenceSpansOf`)。だから**1本を作れた教材でしか出せない。**
 *
 *   1本を作れなかった教材(鍵が無い・名簿に無い声が混じっている・
 *   時刻が本文と合わない)では、**これまでどおり段落を送る。**
 *   **押しても何も起きないボタンを見せない**ためである(CLAUDE.md)。
 *   どちらを動かすかは、触れたときの説明(`title`)に必ず書く。
 *
 * 【押せないときは、押せなくする】
 *   端(いちばん前 / いちばん後ろ)では `disabled` にする。
 *   ぐるっと回すと「いま端にいる」ことが分からない(`Stepper` と同じ作法)。
 *
 * 【三角は文字で描く】
 *   絵文字は端末ごとに形も大きさも違う(`PlayerBar` / `Stepper` と同じ)。
 */
import { useEffect, useState } from 'react'
import { canSkipSentence, skipSentence, watchSentenceSkip } from '../lib/readAloud.js'

/**
 * @param children  まん中に置くもの(鳴らすボタンそのもの)
 * @param onStep    文で動かせないときの逃げ道(段落を送る)。
 *                  渡さなければ、文で動かせないあいだは三角を出さない
 * @param canBack   `onStep` のとき、前へ動けるか
 * @param canNext   `onStep` のとき、次へ動けるか
 * @param unit      段落 / 発言(説明に出す言葉)
 */
export default function SentenceSkip({
  children, className = '',
  onStep = null, canBack = true, canNext = true, unit = '段落',
}) {
  /* 1文ずつ動かせるか。**知っているのは `readAloud.js`** なので、
     そちらに訊く(判断を画面に持たせない) */
  const [bySentence, setBySentence] = useState(canSkipSentence)
  useEffect(() => watchSentenceSkip(setBySentence), [])

  /* **三角は、いつも出す。**(2026-09 利用者の指定の形が
     `◀ ［英語を聞く］ ▶` そのものである)

     鳴っていないあいだだけ消す作りにしていたら、**ふだんは錠剤の中に
     ボタンが1つあるだけ**になり、指定された形になっていなかった。
     動かせないときは**押せなくする**(`Stepper` と同じ作法)。
     ぐるっと回さないのも同じ理由 —— いま端にいることが分からなくなる。 */
  const go = (d) => {
    if (bySentence && skipSentence(d)) return
    onStep?.(d)
  }
  const dead = (d) => {
    if (bySentence) return false                 // 鳴っている。文で動かせる
    if (!onStep) return true                     // 動かす先が無い
    return d < 0 ? !canBack : !canNext
  }
  const label = (d) => (bySentence
    ? `1文${d < 0 ? 'もどる' : 'すすむ'}`
    : `${d < 0 ? '前' : '次'}の${unit}`)

  return (
    <span className={`listenpill ${className}`.trim()}>
      <button type="button" className="listenpill-arrow"
              title={label(-1)} aria-label={label(-1)}
              disabled={dead(-1)} onClick={() => go(-1)}>◀</button>
      <span className="listenpill-mid">{children}</span>
      <button type="button" className="listenpill-arrow"
              title={label(1)} aria-label={label(1)}
              disabled={dead(1)} onClick={() => go(1)}>▶</button>
    </span>
  )
}
