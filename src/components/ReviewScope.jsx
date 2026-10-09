/**
 * 復習の「出しかた」 —— **上は3段だけ。細かいものは畳む**
 * (第5.414節・2026-10-07 利用者の指定・段階3)。
 *
 *   > 今は項目が多すぎて、ゲストの多くが使っていない。
 *   > ここをスッキリさせるのが最重要。
 *
 * ============================================================================
 * 【何が多すぎたのか】(直す前に数えた)
 *
 *   | 段 | 中身 | 数 |
 *   |---|---|---|
 *   | 何を出す | 今日の復習 / ぜんぶ | 2 |
 *   | 出会った時期 | 1週間〜半年 | 6 |
 *   | 何問ずつ | 5 / 10 / 20 / 30 / ぜんぶ + 繰り返す | 6 |
 *   | 訊き方 | 4択 / 思い出す / 穴埋め / 日本語→英語 | 4 |
 *   | 並べ方 | ランダム / 教材ごと / 型でまとめる | 3 |
 *   | しぼる | 日付・分野・教材のレベル・品詞・型・場面・教材 | 7 |
 *   | ほかの道具 | 聞き流す / 印刷 / 例文 / 巻末の型 | 4 |
 *
 *   **32 個が1枚に並んでいた。** しかも**段の札(4段階)は別の場所**に
 *   あったので、「苦手なものを今日ぶんから」をやるには
 *   **離れた2か所を押す**必要があった。
 *
 * 【いまの形】
 *
 *   ┌─ 何を出す ────────────────────────┐
 *   │ [今日の復習 12] [苦手 8] [未学習 40] [ぜんぶ 60] │  ← 4つ
 *   ├─ 何問ずつ ────────────────────────┤
 *   │ [10] [20] [ぜんぶ]    ⇄ シャッフル  ⟳ 繰り返す  │  ← 3つ + スイッチ2つ
 *   ├─ 訊き方(単語帳だけ)──────────────────┤
 *   │ [4択] [思い出す] [穴埋め] [日本語 → 英語]        │
 *   ├────────────────────────────────┤
 *   │ ▸ 詳しくしぼる          2件しぼり中  すべて解除 │  ← 畳んである
 *   ├────────────────────────────────┤
 *   │           [ 10 問で始める ]                     │
 *   └────────────────────────────────┘
 *
 * 【消していないもの】(**勝手に狭めない**・CLAUDE.md)
 *   ・出会った時期(1週間〜半年)… 「詳しくしぼる」の中。
 *     **カレンダーの「日付」と1つにまとまった**(`metRange.js`)——
 *     どちらも「単語帳に入った日」を見ていたからである
 *   ・段階(4段階)・並べ方・教材・教材のレベル・分野・品詞・型・場面
 *     … 「詳しくしぼる」の中
 *   ・聞き流す・印刷 / PDF・例文をつける・巻末に型のレクチャー
 *     … **☰ メニューの中**(呼ぶ側が渡す)
 *
 * 【札は `.chip` を使い回す】
 *   うすい地色 + 同じ色の文字 + 枠線 + 太字。**色だけに頼らない**ので
 *   プレインでも見分けられる。**ここで新しい配色を作らない。**
 */
import { useRef, useState } from 'react'
import {
  DUE_LABEL, PICKS, SIZES, isDueNow, pickCounts, pickLead, pickPool, plainOrders,
  sizeOfValue, sizePickLabel, takeCount, todayKey,
} from '../lib/reviewScope.js'
/* ★ **段階(4段階)は `learnStage.js` 1か所**(第5.406節)。
     「何を出す」の「苦手」「未学習」も、ここの段そのものである */
import { LEARN_STAGES, stageTally } from '../lib/learnStage.js'
import SettingsSheet from './SettingsSheet.jsx'
import {
  ChevronIcon, CloseIcon, FocusIcon, RepeatIcon, ShuffleIcon, SortIcon,
} from './Icons.jsx'

/**
 * @param {Array}  rows   **絞り込みを当てたあと・段階を当てる前**の一覧。
 *   段階は「何を出す」と「詳しくしぼる」の両方が使うので、
 *   **当てる前のものを渡す**(当てたあとを渡すと、札の数が
 *   いま選んでいる段のぶんだけになり、押せる札が消える)
 * @param {string} unit   数える単位(「語」/「問」)
 * @param {string} pick   いま選んでいる「何を出す」の id(`pickIdOf()` から)
 * @param {number|'all'} size 1回ぶんの数
 */
export default function ReviewScope({
  rows, unit = '問', pick, onPick, size, onSize, onStart,
  /** 絞り込みの中身(呼ぶ側が渡す)。単語帳と Quick Response で並ぶものが違う */
  children = null,
  /** いくつ絞っているか(`narrowedCount()` から)。**畳んでいても分かるように** */
  narrowed = 0,
  /** ぜんぶ外す。**渡さなければ、そのボタンは出ない**(効かない操作を見せない) */
  onClearAll = null,
  /** **「出しかた」のボタンだけを出す**(復習の最中。上の帯から開く) */
  compact = false,
  /** 覚え具合(4段階)。**「詳しくしぼる」の中** */
  stage = null, onStage = null,
  /** 出題の形(単語帳だけ)。**渡さなければ、その段ごと出ない** */
  forms = null, form = null, onForm = null,
  /** 並べ方。**シャッフルが切のときの並び**(ランダムは一覧から外して出す) */
  orders = null, order = null, onOrder = null,
  /** シャッフル / 繰り返す。**スイッチ2つ** */
  shuffle = true, onShuffle = null,
  repeat = false, onRepeat = null,
  /**
   * ★ **期限で絞るか**(第5.437節・2026-10-09 利用者の指定)。
   * `'due'` なら「そろそろ忘れる頃」のものだけ。札とは**別の軸**である。
   * **渡されなければ、そのスイッチは出ない**(効かない操作を見せない)。
   */
  scope = 'all', onScope = null,
  /**
   * ★ **いまの画面の道具**(2026-10-09 利用者の指定)。
   *
   *   > Quick Responseや単語帳のPDF/印刷の機能を左のハンバーガーに
   *   > 入れるのをやめてください。右上のメニューに入れてください。
   *   > とにかく、左のハンバーガーメニューに余計なものを追加しないでください。
   *
   * 第5.414節で ☰ の中へ出していたが、**左の☰は「どこへ行くか」**であって
   * 「いまの画面で何をするか」ではない。**ここ(右上)に置く。**
   * **渡されなければ、その段ごと出ない**(効かない操作を見せない)。
   */
  tools = null,
}) {
  const today = todayKey()
  /* ★ **期限は、札ではなくスイッチが決める**(第5.437節)。
     数え上げと出題の両方に、同じ `scope` を通す(**数え方を2通り持たない**) */
  const counts = pickCounts(rows, today, scope)
  const pool = pickPool(rows, pick, today, scope)
  const take = takeCount(size, pool.length)
  /* **先取りが何件あるか。** ここで「次に出す日を動かさない」ことを
     先に言っておく。黙って動かさないと、進めたつもりで進んでいない */
  const ahead = pool.filter((r) => !isDueNow(r, today)).length
  /** 段階ごとの数。**読み込んだ行から数える**(第5.406節) */
  const stageN = stageTally(rows)
  /* **選ぶものは、吹き出しの中へ。** 開いているかどうかは覚えない */
  const [open, setOpen] = useState(false)
  /* ★ **「詳しくしぼる」は、初期状態で畳む**(利用者の指定・段階3)。
       `<details>` は使わない —— **見出しの行に別のボタンを置くと、
       押すたびに畳みが動く**(共通ルール)。畳んでいるあいだは**描かない** */
  const [moreOpen, setMoreOpen] = useState(false)
  const sortRef = useRef(null)

  /** 並べ方は「ランダム」を外したもの。**あれはスイッチが持っている** */
  const 並べ方 = plainOrders(orders)

  /** 1段ぶんの見出し。**言葉は呼ぶ側に書かせない** */
  const 見出し = (id, 文字) => (
    <p className="rscope-head" id={`rscope-${id}`}>{文字}</p>
  )

  /** 札1つ。**色も形も `.chip` 1つから**(新しい配色を作らない) */
  const 札 = ({
    key: k, on, n = null, disabled = false, label, onClick, icon = null, extra = '',
  }) => (
    <button
      key={k}
      type="button"
      disabled={disabled}
      aria-pressed={on}
      className={`chip rscope-chip${extra ? ` ${extra}` : ''}${on ? ' chip--on' : ''}`}
      onClick={onClick}
    >
      {icon}
      {label}
      {n != null && <span className="chip-count">{n}</span>}
    </button>
  )

  /* ══════════════════════════════════════════════════════════════
     上の3段。**ゲストが見るのは、ここだけで足りる**
     ══════════════════════════════════════════════════════════════ */
  const 上の3段 = (
    <>
      {/* ① **何を出す** —— 4つ。それぞれに数を出す(第5.414節)。
             **どれが光るかは `pickIdOf()` 1か所**が決める */}
      {見出し('what', '何を出す')}
      <div className="chiprow" role="group" aria-labelledby="rscope-what">
        {PICKS.map((p) => 札({
          key: p.id,
          on: p.id === pick,
          n: counts[p.id] ?? 0,
          /* **0件の札は押せない。** ただし**消さない** ——
             「苦手は無い」ことも、それ自体が知らせである */
          disabled: (counts[p.id] ?? 0) === 0,
          label: p.label,
          onClick: () => onPick(p.id),
        }))}
      </div>

      {/* ★ **何問ずつ・シャッフル・繰り返すは、下に貼り付く帯へ移した**
             (第5.437節・2026-10-09 利用者の指定)。
             > 変更した後も「何問ずつ」「シャッフル」「繰り返し」が
             > 常にどこかに表示されているのがベストです
             スクロールしても消えないので、**ここから出した** */}

      {/* ③ **訊き方**(単語帳だけ)。**渡されなければ、この段ごと出ない** */}
      {forms && forms.length > 0 && (
        <>
          {見出し('form', '訊き方')}
          <div className="chiprow" role="group" aria-labelledby="rscope-form">
            {forms.map((f) => 札({
              key: f.id, on: f.id === form, label: f.label, onClick: () => onForm(f.id),
            }))}
          </div>
        </>
      )}
    </>
  )

  /* ══════════════════════════════════════════════════════════════
     **詳しくしぼる** —— 畳んである。開くと段階・並べ方・絞り込み
     ══════════════════════════════════════════════════════════════ */
  const 詳しくしぼる = (
    <div className="rscope-more">
      {/* **押すものは、一覧の末尾に置かない**(共通ルール)。
          畳みの札と「すべて解除」を**同じ行**に置くので、
          中身が増えても場所が動かない */}
      <div className="rscope-more-head">
        <button
          type="button"
          className="btn btn--small btn--ghost rscope-more-btn"
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen((v) => !v)}
        >
          <ChevronIcon className={`icon rscope-more-arrow${moreOpen ? ' is-open' : ''}`} />
          詳しくしぼる
        </button>
        {/* **絞っていることは、畳んでいても分かるようにする。**
            黙って絞ると「なぜ1件しか出ないのか」が分からない */}
        {narrowed > 0 && (
          <span className="rscope-narrowed">{narrowed}件しぼり中</span>
        )}
        {narrowed > 0 && onClearAll && (
          <button
            type="button"
            className="btn btn--small btn--ghost rscope-clear"
            onClick={onClearAll}
          >
            <CloseIcon />すべて解除
          </button>
        )}
      </div>

      {/* **畳んでいるあいだは描かない。** `<details>` に `display: grid` を
          書くと、畳んでいても中身が場所を取り続ける(共通ルール) */}
      {moreOpen && (
        <div className="rscope-more-body">
          {/* **段階(4段階)。** 一覧も呼び名も `learnStage.js` 1か所 */}
          {onStage && (
            <>
              {見出し('stage', '段階')}
              <div className="chiprow" role="group" aria-labelledby="rscope-stage">
                {LEARN_STAGES.map((g) => 札({
                  key: g.id,
                  on: g.id === stage,
                  n: stageN[g.id] ?? 0,
                  /* **0件の段は押せない**(効かない操作を見せない)。
                     ただし**消さない** —— 「苦手は無い」ことも知らせである */
                  disabled: (stageN[g.id] ?? 0) === 0,
                  label: g.label,
                  /* **もう一度押すと外れる**(`pickGroup` と同じ作法) */
                  onClick: () => onStage(g.id === stage ? null : g.id),
                }))}
              </div>
            </>
          )}

          {/* **並べ方** —— シャッフルが切のときの並び。
              **1つでも出す** —— あれは「入れる / 入れない」の切り替えでもある
              (単語帳は「教材ごと」1つきりで、外せば**これまでの並び**
              = まだ → 期限の古い順 → 箱の小さい順 になる) */}
          {並べ方.length > 0 && (
            <>
              {見出し('order', 'シャッフルを切ったときの並び')}
              <div className="chiprow" role="group" aria-labelledby="rscope-order">
                {並べ方.map((o) => 札({
                  key: o.id,
                  on: o.id === order,
                  disabled: shuffle,
                  label: o.label,
                  /* **もう一度押すと外れる**(段階の札と同じ作法)。
                     外すと、これまでの並びに戻る */
                  onClick: () => onOrder(o.id === order ? '' : o.id),
                }))}
              </div>
            </>
          )}

          {children}
        </div>
      )}
    </div>
  )

  /**
   * ★ **いまの画面の道具**(2026-10-09 利用者の指定)。
   *
   * **「詳しくしぼる」の中に置かない。** はじめ `{children}` のすぐ下に
   * 書いたら、**畳んでいるあいだは1つも出てこなかった**
   * (測って気づいた・2026-10-09)。
   * **畳みの外**に、いちばん下の段として置く。
   */
  const 道具 = tools ? <div className="rscope-tools">{tools}</div> : null

  /** この欄の呼び名。**絵だけにしたので、言葉はここ1か所が持つ** */
  const 出しかたと呼ぶ = '出しかた'

  /** 始めるボタンの字。**2か所に書き写さない**(シートの帯と、始める前の画面) */
  const 始める文字 = pool.length === 0
    ? `出すものがありません`
    : `この出しかたで始める(${take} ${unit})`

  /* ══════════════════════════════════════════════════════════════
     ★ **下に貼り付く帯**(第5.437節・2026-10-09 利用者の指定)

       > 出す数を選択した後に1番下に「この10問で出す」というボタンが
       > 出ますが、これは慣れていないと見逃すボタンですし、UIとして
       > 分かりにくいです。(略)変更した後も「何問ずつ」「シャッフル」
       > 「繰り返し」が常にどこかに表示されているのがベストです

     **スクロールしても動かない**(`position: sticky`)ので、
     どこまで送っても始めるボタンと設定が目に入る。

     **問数はプルダウン**(5 から選べるので、札では横に並ばない)。
     **シャッフルと繰り返すは絵だけ** —— 下のプレーヤーとまったく同じ絵を
     使う(`ShuffleIcon` / `RepeatIcon` は `Icons.jsx` 1か所)。
     ══════════════════════════════════════════════════════════════ */
  const 帯 = (
    <div className="rscope-bar">
      <div className="rscope-bar-row">
        {/* **何問ずつ。** 言い方は `sizePickLabel()` 1か所(「5 問」「ぜんぶ」) */}
        <label className="rscope-size">
          <span className="sr-only">{`何${unit}ずつ`}</span>
          <select
            value={String(size)}
            onChange={(e) => onSize(sizeOfValue(e.target.value))}
          >
            {SIZES.map((n) => (
              <option key={String(n)} value={String(n)}>{sizePickLabel(n, unit)}</option>
            ))}
          </select>
        </label>
        {onShuffle && (
          <button
            type="button"
            aria-pressed={shuffle}
            aria-label="ランダム"
            title="ランダム"
            className={`btn btn--quiet rscope-sw${shuffle ? ' chip--on' : ''}`}
            onClick={() => onShuffle(!shuffle)}
          >
            <ShuffleIcon />
          </button>
        )}
        {onRepeat && (
          <button
            type="button"
            aria-pressed={repeat}
            aria-label="くり返す"
            title="くり返す"
            className={`btn btn--quiet rscope-sw${repeat ? ' chip--on' : ''}`}
            onClick={() => onRepeat(!repeat)}
          >
            <RepeatIcon />
          </button>
        )}
        {/* ★ **期限のスイッチ。字で書く**(第5.437節)——
             絵にすると「出会った時期」(日付の絞り込み)と見分けが付かない */}
        {onScope && 札({
          key: 'due',
          on: scope === 'due',
          label: DUE_LABEL,
          onClick: () => onScope(scope === 'due' ? 'all' : 'due'),
        })}
      </div>
      <button
        type="button"
        className="btn btn--primary rscope-start"
        disabled={pool.length === 0}
        onClick={() => { setOpen(false); onStart?.() }}
      >
        <FocusIcon />{始める文字}
      </button>
    </div>
  )

  /** 絵と、その中身。**畳んだ形でも、始める前でも、これ1つ** */
  const 出しかた = (
    <>
      <button
        type="button"
        ref={sortRef}
        /* **聞き流しのボタンと、ひと組に見せる**(第5.264節)。
           **文字は出さない** —— 2026-09 の指定のままで、
           そろえるのは**形と絵の描き方**だけである */
        className={`btn btn--small btn--ghost rscope-sort${open ? ' chip--on' : ''}`}
        aria-expanded={open}
        aria-label={出しかたと呼ぶ}
        title={出しかたと呼ぶ}
        onClick={() => setOpen((v) => !v)}
      >
        <SortIcon />
        {narrowed > 0 && <span className="chip-count">{narrowed}</span>}
      </button>
      {open && (
        <SettingsSheet
          anchorEl={sortRef.current}
          /* ★ **閉じたら、入力の印をこのボタンへ戻す**(2026-10-09)。
               中の `<select>`(詳しくしぼる)を触ると、**閉じたあとも
               印がそこに残る。** 矢印キーは「字を打っている最中は
               1つも効かせない」(`cardMove.js` の `typing`)ので、
               **そのまま練習に戻っても ← → ↑ ↓ が効かない**
               —— 利用者の指摘「Quick Response 上で矢印キーが
               効かなくなりました」。
               **開いた本人に戻す**のは、吹き出しの決まりどおりでもある */
          onClose={() => { setOpen(false); sortRef.current?.focus() }}
          title={出しかたと呼ぶ}
          /* 札を押すと数が変わり、箱の高さも変わる。**置き直す合図を渡す** */
          placeKey={`${pick}/${size}/${narrowed}/${form}/${order}/${repeat}/${shuffle}/${moreOpen}`}
        >
          {/* **流れる中身**(ここだけがスクロールする) */}
          <div className="rscope-scroll">
            {上の3段}
            {詳しくしぼる}
            {道具}
            {/* **押したら何が起きるかを1行で言う。** 箱の番号は出さない */}
            <p className="tip card-hint rscope-lead">
              {pickLead(pick, unit, scope)}
              {repeat && ` 出し切っても止まらず、もう一度この範囲を回します。`}
            </p>
            {ahead > 0 && (
              <p className="card-hint rscope-lead">
                このうち <strong>{ahead} {unit}</strong>は先取りなので、
                正解しても<strong>次に出る日は動きません</strong>
                (同じ範囲を何度も回して先へ飛ぶと、明日の復習が空になるためです)。
              </p>
            )}
          </div>
          {/* ★ **帯は、流れる中身の外**(第5.437節)——
                中に入れると一緒に流れてしまい、貼り付かない。
                **押したら、この箱を閉じる** —— 開いたまま出題に戻ると、
                設定が練習の上に居座る(`.setpop` は z-index 200) */}
          {帯}
        </SettingsSheet>
      )}
    </>
  )

  /* **復習の最中は、ボタンだけ。** 「◯問で始める」はシートの中にある */
  if (compact) return 出しかた

  return (
    <div className="rscope">
      <div className="btn-row rscope-go">
        <button
          type="button"
          className="btn btn--primary"
          disabled={pool.length === 0}
          onClick={onStart}
        >
          {/* **字は1か所から**(第5.437節)。シートの帯と同じものを使う */}
          <FocusIcon />{始める文字}
        </button>
        {出しかた}
      </div>

      <p className="tip card-hint rscope-lead">
        {pickLead(pick, unit, scope)}
        {repeat && ` 出し切っても止まらず、もう一度この範囲を回します。`}
      </p>

      {/* **先取りの断りは畳まない。** あれは説明ではなく
          **「押しても記録が動かない」という知らせ**である */}
      {ahead > 0 && (
        <p className="card-hint rscope-lead">
          このうち <strong>{ahead} {unit}</strong>は先取りなので、
          正解しても<strong>次に出る日は動きません</strong>
          (同じ範囲を何度も回して先へ飛ぶと、明日の復習が空になるためです)。
        </p>
      )}
    </div>
  )
}
