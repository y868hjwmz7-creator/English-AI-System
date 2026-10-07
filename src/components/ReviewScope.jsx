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
  PICKS, SIZES, isDueNow, pickCounts, pickLead, pickPool, plainOrders,
  sizeLabel, takeCount, todayKey,
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
}) {
  const today = todayKey()
  const counts = pickCounts(rows, today)
  const pool = pickPool(rows, pick, today)
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

      {/* ② **何問ずつ** —— 10 / 20 / ぜんぶ。**そのすぐ下にスイッチ2つ** */}
      {見出し('many', `何${unit}ずつ`)}
      <div className="chiprow" role="group" aria-labelledby="rscope-many">
        {SIZES.map((s) => 札({
          key: String(s), on: s === size, label: sizeLabel(s), onClick: () => onSize(s),
        }))}
      </div>
      {(onShuffle || onRepeat) && (
        <div className="chiprow rscope-switches">
          {onShuffle && 札({
            key: 'shuffle',
            on: shuffle,
            label: 'シャッフル',
            icon: <ShuffleIcon />,
            onClick: () => onShuffle(!shuffle),
          })}
          {onRepeat && 札({
            key: 'repeat',
            on: repeat,
            label: '繰り返す',
            icon: <RepeatIcon />,
            onClick: () => onRepeat(!repeat),
          })}
        </div>
      )}

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
                  label: g.label,
                  /* **もう一度押すと外れる**(`pickGroup` と同じ作法) */
                  onClick: () => onStage(g.id === stage ? null : g.id),
                }))}
              </div>
            </>
          )}

          {/* **並べ方** —— シャッフルが切のときの並び。
              **2つ以上なければ、選ぶ意味がない**(効かない操作を見せない) */}
          {並べ方.length > 1 && (
            <>
              {見出し('order', 'シャッフルを切ったときの並び')}
              <div className="chiprow" role="group" aria-labelledby="rscope-order">
                {並べ方.map((o) => 札({
                  key: o.id,
                  on: o.id === order,
                  disabled: shuffle,
                  label: o.label,
                  onClick: () => onOrder(o.id),
                }))}
              </div>
            </>
          )}

          {children}
        </div>
      )}
    </div>
  )

  /** この欄の呼び名。**絵だけにしたので、言葉はここ1か所が持つ** */
  const 出しかたと呼ぶ = '出しかた'

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
          onClose={() => setOpen(false)}
          title={出しかたと呼ぶ}
          /* 札を押すと数が変わり、箱の高さも変わる。**置き直す合図を渡す** */
          placeKey={`${pick}/${size}/${narrowed}/${form}/${order}/${repeat}/${shuffle}/${moreOpen}`}
        >
          {上の3段}
          {詳しくしぼる}
          {/* ★ **いちばん下に「◯問で始める」**(利用者の指定・段階3)。
                 「押す前に出題数が分かるようにする」—— 数は `takeCount()`
                 1か所から出す(**書き写さない**)。
                 **押したら、この箱を閉じる** —— 開いたまま出題に戻ると、
                 設定が練習の上に居座る(`.setpop` は z-index 200) */}
          <div className="btn-row rscope-go">
            <button
              type="button"
              className="btn btn--primary"
              disabled={pool.length === 0}
              onClick={() => { setOpen(false); onStart?.() }}
            >
              <FocusIcon />
              {pool.length === 0
                ? `出すものがありません`
                : `${take} ${unit}で始める`}
            </button>
          </div>
          {/* **押したら何が起きるかを1行で言う。** 箱の番号は出さない */}
          <p className="tip card-hint rscope-lead">
            {pickLead(pick, unit)}
            {repeat && ` 出し切っても止まらず、もう一度この範囲を回します。`}
          </p>
          {ahead > 0 && (
            <p className="card-hint rscope-lead">
              このうち <strong>{ahead} {unit}</strong>は先取りなので、
              正解しても<strong>次に出る日は動きません</strong>
              (同じ範囲を何度も回して先へ飛ぶと、明日の復習が空になるためです)。
            </p>
          )}
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
          <FocusIcon />
          {pool.length === 0
            ? `出すものがありません`
            : `${take} ${unit}で始める`}
        </button>
        {出しかた}
      </div>

      <p className="tip card-hint rscope-lead">
        {pickLead(pick, unit)}
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
