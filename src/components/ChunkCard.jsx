/**
 * **本文から拾った かたまり 1つ**(第5.230節・2026-09 利用者の設計)。
 *
 * ============================================================================
 * 利用者が、そのまま形まで描いて指定した。
 *
 *   ┌─────────────────────────────────┐
 *   │ come up with              句動詞 │   ← 札で分類が分かる
 *   │ 〜を思いつく                     │
 *   │ 「上がってくる」= 考えが浮かぶ   │   ← 由来・使い方
 *   │ 「本文の文章」                   │
 *   │                                 │
 *   │ [ 練習する ]                     │   ← 押すと下に開く
 *   └─────────────────────────────────┘
 *        ↓ 押すと
 *   ┌─────────────────────────────────────────────┐
 *   │ 1  いい案を思いつきました      [解答を見る] │
 *   │ 2  何も思いつかなかった        [解答を見る] │
 *
 * 【なぜこの形か】(利用者の言葉)
 *
 *   > 「練習する」をクリックすると５問から１０問の日本語が表示され、
 *   > それぞれ「解答を見る」のボタンがある。このような設計はどうでしょうか？
 *
 *   **レッスンのその場で挑める**ことが条件である。
 *   だから ①畳んである(表現が6〜8個あるので、開いたままだと
 *   その下が画面の外へ出る)②押した瞬間に出る(**作るのは教材を
 *   作るときに一緒**なので、待ち時間 0 秒・0 円)。
 *
 * 【押すものは、一覧の末尾に置かない】(`.claude/rules/common.md`)
 *   「練習する」は**かたまりの見出しの行**に置く。一覧の下に置くと、
 *   説明が長い表現では下へ流れて見つからない。
 *
 * 【説明の文は置かない】(同)
 *   「押すと練習が始まります」とは書かない。**押せば分かる。**
 *
 * 【自分では何も読まない】
 *   props で受け取るだけなので、骨組み(Supabase 無し)でもそのまま描ける
 *   (**描けないものは測れない**・CLAUDE.md)。
 *   語に触って意味を出す仕掛け(`EnglishText`)は**呼ぶ側が差し込む** ——
 *   レッスン表示と紙とで、渡すものが違うためである。
 * ============================================================================
 *
 * @param item     その問(`prompt_en` / `prompt_ja` / `note` /
 *                 `chunk_kind` / `source_en` / `practice`)
 * @param open     練習を開いているか
 * @param onOpen   開け閉めの合図。**渡さなければ「練習する」を出さない**
 * @param shown    解答を開けてある問の番号(`Set`)
 * @param onShow   解答を開く合図(番号を渡す)
 * @param en       かたまりの英語を描くもの(語に触れる形にするため)
 * @param source   本文の1文を描くもの。**無ければ素の文字で出す**
 * @param audio    読み上げのボタン(呼ぶ側が組む)
 */
import { chunkDrills, chunkKindLabel } from '../data/chunkKinds.js'
/* 例文(第5.254節)。**そろえ方はあちら1か所**(`chunkDrills` と同じ作法) */
import { wordExamples } from '../data/exerciseTypes.js'

export default function ChunkCard({
  item, open = false, onOpen = null,
  shown = null, onShow = null,
  en = null, source = null, audio = null,
  /**
   * **例文を開いているか**(第5.254節・2026-09-23 利用者の指定)。
   *
   *   > 基本、例文が小見出しとして3つくらいあってから日→英があるとベスト。
   *   > 例文は折りたたみ式に。日→英も折りたたみ。
   *
   * **渡さなければ「例文」を出さない**(`onOpen` と同じ作法)。
   * かたまりには例文が無い(本文の1文がその役をしている)ので、
   * あちらはこれまでどおり1つも変わらない。
   */
  exOpen = false, onExOpen = null,
}) {
  const drills = chunkDrills(item)
  const examples = wordExamples(item)
  /* **当てられなければ黙る**(CLAUDE.md)。分類が入っていない
     古い教材で「その他」と書くと、無いものを在るように見せる */
  const kind = chunkKindLabel(item?.chunk_kind)
  const sourceEn = String(item?.source_en ?? '').trim()
  const note = String(item?.note ?? '').trim()
  const ja = String(item?.prompt_ja ?? '').trim()

  return (
    <div className="chunk">
      <div className="chunk-head">
        <div className="chunk-en" lang="en">{en ?? item?.prompt_en}</div>
        {/* **色だけに頼らない**(CLAUDE.md)—— うすい地色 + 枠線 + 太字 */}
        {kind && <span className="chunk-kind">{kind}</span>}
      </div>
      {ja && <div className="chunk-ja">{ja}</div>}
      {note && <div className="chunk-note">{note}</div>}
      {/* **本文の中で、実際にそう使われていた1文。**
          読み上げは付けない —— 本文の側ですでに音になっており、
          ここで別に作ると同じ英文にもう一度課金される(CLAUDE.md) */}
      {sourceEn && (
        <div className="chunk-source" lang="en">{source ?? sourceEn}</div>
      )}
      {/* **押すものは見出しの行に**…と言いたいところだが、ここは
          読み物ではなく1枚のカードで、上から下まで数行しかない。
          札の行に混ぜると、分類の札と押すものが見分けにくくなる
          (**同じ行に、読むものと押すものを混ぜない**)。
          **中身の数で場所が動かない**という肝心のところは守れている ——
          練習の一覧は、このボタンの**下**に出る */}
      <div className="chunk-acts no-print">
        {audio}
        {/* **例文が先、練習があと**(第5.254節・利用者の指定の順)。
            **効かない操作を見せない** —— 例文が1つも無ければ出さない */}
        {!!examples.length && onExOpen && (
          <button type="button" className="btn btn--small btn--ghost chunk-ex-go"
                  aria-expanded={exOpen}
                  onClick={() => onExOpen(!exOpen)}>
            {exOpen ? '例文を閉じる' : `例文(${examples.length})`}
          </button>
        )}
        {/* **効かない操作を見せない。** 練習が1問も無ければ出さない */}
        {!!drills.length && onOpen && (
          <button type="button" className="btn btn--small btn--primary chunk-go"
                  aria-expanded={open}
                  onClick={() => onOpen(!open)}>
            {open ? '練習を閉じる' : '練習する'}
          </button>
        )}
      </div>
      {/* ── 例文(第5.254節)────────────────────────────────
          **練習とまったく同じ作法** —— 描いてから隠す。
          畳んだまま印刷したときに例文が消えないようにする */}
      {!!examples.length && (
        <ul className={`chunk-examples${exOpen ? '' : ' is-closed'}`}>
          {examples.map((x, i) => (
            <li key={i} className="chunk-example">
              <span className="chunk-example-en" lang="en">{x.en}</span>
              <span className="chunk-example-ja">{x.ja}</span>
            </li>
          ))}
        </ul>
      )}
      {/* ── 練習(日→英)────────────────────────────────────

          **描いてから隠す。閉じているあいだも描く**(2026-09 利用者の指定
          「紙にも表示されるようにしてください」)。
          描かないでいると、**畳んだまま印刷したときに練習が消える** ——
          レッスン表示の「取り組み方」が `<details>` をやめたのと
          まったく同じ理由である(CLAUDE.md)。

          **組みは Quick Response の紙と同じものを使う**(利用者の指定
          「quick response と同じように、左側に日本語、右側に解答の英語」)。
          `qrsheet-list` / `qrsheet-ja` / `qrsheet-en` を付けるだけで、
          紙の指定(丸い通し番号・2列・下の罫線)が**そのまま効く** ——
          **同じ見た目を2か所に書き写さない**(CLAUDE.md)。
          画面には1つも響かない(あちらの指定は紙のときだけ効く)。 */}
      {!!drills.length && (
        <ol className={`chunk-drills qrsheet-list${open ? '' : ' is-closed'}`}>
          {drills.map((d, i) => (
            <li key={i} className="chunk-drill">
              <span className="chunk-drill-ja qrsheet-ja">{d.ja}</span>
              {/* **紙には出さない。** 紙では解答が最初から右に出ている */}
              {/* **色を決めずに置かない**(共通ルール・第5.242節)。
                  「解答を見る」は答えではなく**開く**ものなので、枠線だけ */}
              <button type="button" className="btn btn--small btn--ghost chunk-drill-show no-print"
                      aria-expanded={!!shown?.has(i)}
                      onClick={() => onShow?.(i)}>
                {shown?.has(i) ? '解答を隠す' : '解答を見る'}
              </button>
              <span className={`chunk-drill-en qrsheet-en${shown?.has(i) ? '' : ' is-hidden'}`}
                    lang="en">{d.en}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
