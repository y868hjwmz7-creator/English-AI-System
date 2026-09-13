import { useState } from 'react'
import { tierOf } from '../data/basicsCourse.js'
import { wordListFor, wordsForTier } from '../lib/basicsCourse.js'
import { addBasicWords, basicWordsSupported } from '../lib/vocab.js'
import { StepsIcon } from './Icons.jsx'

/**
 * 基礎単語の段を、**自分の単語帳にも入れる**。
 *
 * ============================================================================
 * 【いまの役目】(2026-09 利用者の指定)
 *
 *   > 基礎単語360/1200も業種別の横に置いてください。
 *
 *   基礎単語は**3冊目の単語帳**になった(「自分の単語帳 / 業種べつ /
 *   基礎単語」)。段の語は `basicWords.js` に書いてあるので、
 *   **入れなくても、開いた瞬間から練習できる。**
 *
 *   だからこの欄の役目は1つだけになった ——
 *   **その段を、自分の単語帳のほうにも並べる**ことである。
 *   0053 の指定はいまも生きている。
 *
 *     > 講座から単語帳に登録を押せば、
 *     > 単語帳の中の自分の普段の単語に追加される感じで
 *
 *   **道具ごと消していない。** 消すと、教材の語と一緒に並べて
 *   練習する道が無くなる(**一度入れたものを勝手に減らさない**)。
 *
 * 【段は、外から受け取る】
 *
 *   以前はここが段の札を持っていたが、いまは**冊の中の段の切り替え**
 *   (`Wordbook.jsx`)がそれである。**同じことをするものを2つ見せない** ——
 *   ここに札を残すと、上の段と食い違うことが起こりうる。
 *
 * 【絞り込みは、もう要らない】
 *
 *   0053 では「入れてから、その段だけに絞る」だった(`onPicked`)。
 *   **冊そのものがその絞り込みである。** だから外へ知らせる道は外した。
 *
 * 【0円である】
 *
 *   訳は `src/data/basicWords.js` に書いてあり、単語帳が
 *   `basicJaOf()` で出す。**窓口(AI)を1回も呼ばない。**
 *   1,200 語を `lookupWord` で引くと 120 円ほどかかるうえ、
 *   入れ終わるまで何分も待たせることになる。
 *
 * 【0053 を貼る前でも壊れない】
 *
 *   一度断られたら `basicWordsSupported()` が偽になり、
 *   **そのあとは呼びに行かない。** 断り方も、何をすればよいかまで書く。
 *   **練習そのものは、貼る前でもできる**(この欄が押せないだけ)。
 */
export default function BasicWordsPick({
  tier = 'core', learnerId = null, learnerName = '', onAdded = null,
}) {
  /* **誰の単語帳に入るのかを、はっきり言う**(`WordbookAdd` と同じ作法)。
     トレーナーがゲストのページから押すときは、入る先はゲストである */
  const name = String(learnerName ?? '').trim()
  const honored = /(さん|様|先生)$/.test(name) ? name : `${name} さん`
  const whose = learnerId ? `${name ? honored : 'このゲスト'}の単語帳` : '自分の単語帳'

  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState(null)

  const info = tierOf(tier)
  const rows = wordsForTier(info.id)

  /** その段を、自分の単語帳にも並べる */
  const run = async () => {
    setBusy(true)
    setNote(null)
    const { data, error } = await addBasicWords(wordListFor(info.id), learnerId)
    setBusy(false)
    if (error) { setNote({ ng: true, text: error }); return }
    /* **何語「新しく」入ったのかを言う。** 0 を「失敗」と読ませない ——
       2度目に押したときは、すでに全部入っているのが正しい */
    setNote({
      text: data > 0
        ? `${data} 語を新しく入れました(残りの ${rows.length - data} 語は、すでに入っていました)。`
        : `${rows.length} 語とも、すでに入っていました。`,
    })
    onAdded?.()
  }

  return (
    <div className="wb-add basicpick">
      <button type="button" className="btn btn--ghost btn--small wb-add-open"
              aria-expanded={open}
              onClick={() => { setOpen((v) => !v); setNote(null) }}>
        <StepsIcon />
        {open ? '入れるのをやめる' : `${whose}にも入れる`}
      </button>

      {open && (
        <div className="wb-add-body">
          {/* **何が起きるかを、押す前に1行で書く**(CLAUDE.md)。
              **お金はかからない**ことも、はっきり言う */}
          <p className="basicpick-lead">
            {info.label}の {rows.length} 語を、{whose}にも「まだ」として並べます。
            <strong>この画面の練習には要りません</strong>
            (ここではもう {rows.length} 語とも出ています)。
            すでに入っている語の覚え具合は<strong>1つも戻りません</strong>。
            <span className="basicpick-free">お金はかかりません。</span>
          </p>

          <div className="btn-row">
            <button type="button" className="btn btn--primary"
                    disabled={busy || !basicWordsSupported()}
                    onClick={run}>
              {busy ? '入れています…' : `${whose}にも入れる`}
            </button>
          </div>

          {note && (
            <p className={note.ng ? 'notice notice--warn' : 'muted'}>{note.text}</p>
          )}
        </div>
      )}
    </div>
  )
}
