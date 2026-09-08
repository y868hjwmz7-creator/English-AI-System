/**
 * 復習を始める前の帯 — **いつのぶんを、何問ずつ**(2026-09 利用者の指定)。
 *
 *   > 結局ただランダムに出てくるだけですごく仕組みが分かりにくい。
 *   > ここを意図をもって練習できるように変更したい。出題範囲の時系列での
 *   > 絞りかた…その時に復習したい単語やフレーズ、文章の個数だ。
 *   > これを直感的に選択できる仕組みを作り上げたい。
 *
 * ============================================================================
 * 【「直感的」の核心は、**数を札の中に出すこと**】
 *
 *   「1週間以内」を選べるようにするだけでは足りない。
 *   **その範囲に何問あるのかが見えないと、範囲を選べない。**
 *   だから札そのものに数を書く。
 *
 *       ┏━━━━┓ ┌────┐ ┌────┐ ┌─────┐
 *       ┃今日 ┃ │1週間│ │2週間│ │1か月 │  …
 *       ┃ 12 ┃ │ 23 │ │ 41 │ │ 68  │
 *       ┗━━━━┛ └────┘ └────┘ └─────┘
 *
 *   **0件の札は押せなくする**(効かない操作を見せない・CLAUDE.md)。
 *   選んでいた札が0件になったら、**その場で押せる札へ移す**
 *   (`SCENE_STYLES` の `pickScene` と同じ作法。黙って空のまま置かない)。
 *
 * 【押す前に、何が起きるかを1行で言う】
 *   箱の番号や次に出す日は出さない(**仕組みの内側の数字を画面に出さない**)。
 *   けれども**押したら何が起きるか**は言葉で言える。
 *   それが「仕組みが分かりにくい」への答えである。
 *
 * 【単語帳と Quick Response で、まったく同じものを使う】
 *   いままでは片方がカレンダー、片方がプルダウンで**別物**だった。
 *   **同じ見た目を2か所に書き写さない**(CLAUDE.md)。
 *   ちがうのは数える単位(語 / 問)だけなので、`unit` で渡す。
 *
 * 【札は `.chip` を使い回す】
 *   うすい地色 + 同じ色の文字 + 枠線 + 太字。**色だけに頼らない**ので
 *   プレインでも見分けられる。数の丸も `.chip-count` がすでにある。
 *   **ここで新しい配色を作らない。**
 */
import { useRef, useState } from 'react'
import {
  SCOPES, SIZES, scopeCounts, scopeLead, scopePool, sizeLabel, takeCount, todayKey, isDueNow,
} from '../lib/reviewScope.js'
import SettingsSheet from './SettingsSheet.jsx'
import { FocusIcon, GearIcon } from './Icons.jsx'

/**
 * @param {Array}  rows   絞り込みを当てたあとの一覧
 * @param {string} unit   数える単位(「語」/「問」)
 * @param {string} whole  「ぜんぶ」のときの呼び名(「単語帳」/「復習」)
 * @param {string} scope  いま選んでいる範囲の id
 * @param {number|'all'} size 1回ぶんの数
 * @param {Function} onScope / onSize / onStart
 */
export default function ReviewScope({
  rows, unit = '問', scope, size, onScope, onSize, onStart,
  /* **絞り込みも、ここに入れる**(2026-09 実機・利用者の指定)。
     日付・分野・場面・教材・並べ方は、画面に散らばっていた。
     **設定は1か所**にまとめ、押すものを「出す」と「出しかた」の
     2つだけにする。中身は呼ぶ側が渡す —— 単語帳と Quick Response で
     並ぶものが違う(教材の絞り込みは復習にだけある)ためである */
  children = null,
  /** いま何で絞っているか(0 なら絞っていない)。札の数として出す */
  narrowed = 0,
  /**
   * **「出しかた」のボタンだけを出す**(2026-09 利用者の指定
   * 「そして中に入ってからも絞り込みができるように」)。
   *
   * 復習に入ったあと、上の帯からも同じものを開けるようにする。
   * **中身を書き写さない** —— 札も絞り込みも、始める前とまったく同じものが
   * 出る。ちがうのは「◯語を出す」のボタンを出さない点だけで、
   * あちらは**入るためのボタン**なので、もう入っている場所には要らない。
   * 変えたその場で組み直すのは、呼ぶ側(`runKeyOf` を見張る)の役目である。
   */
  compact = false,
}) {
  const today = todayKey()
  const counts = scopeCounts(rows, today)
  const pool = scopePool(rows, scope, today)
  const take = takeCount(size, pool.length)
  /* **先取りが何件あるか。** ここで「次に出す日を動かさない」ことを
     先に言っておく。黙って動かさないと、進めたつもりで進んでいない */
  const ahead = pool.filter((r) => !isDueNow(r, today)).length
  /* **選ぶものは、吹き出しの中へ**(2026-09 実機・利用者の指定)。
     開いているかどうかは覚えない —— 毎回選ぶものではない */
  const [open, setOpen] = useState(false)
  const gearRef = useRef(null)

  /* 札2つぶんの中身。**吹き出しの中にだけ置く。**
     ここを外にも書くと、同じものが2か所に出る */
  const 選ぶ欄 = (
    <>
      <p className="rscope-head" id="rscope-when">いつのぶん</p>
      <div className="chiprow" role="group" aria-labelledby="rscope-when">
        {SCOPES.map((s) => {
          const n = counts[s.id] ?? 0
          const on = s.id === scope
          return (
            <button
              key={s.id}
              type="button"
              /* **0件の札は押せない。** ただし**消さない** ——
                 「1か月以内には無い」ことも、それ自体が知らせである */
              disabled={n === 0}
              aria-pressed={on}
              className={`chip rscope-chip${on ? ' chip--on' : ''}`}
              onClick={() => onScope(s.id)}
            >
              {s.label}
              <span className="chip-count">{n}</span>
            </button>
          )
        })}
      </div>

      <p className="rscope-head" id="rscope-many">{`何${unit}ずつ`}</p>
      <div className="chiprow" role="group" aria-labelledby="rscope-many">
        {SIZES.map((s) => (
          <button
            key={String(s)}
            type="button"
            aria-pressed={s === size}
            className={`chip rscope-chip${s === size ? ' chip--on' : ''}`}
            onClick={() => onSize(s)}
          >
            {sizeLabel(s)}
          </button>
        ))}
      </div>
    </>
  )

  /** ⚙ と、その中身。**畳んだ形でも、始める前でも、これ1つ** */
  const 出しかた = (
    <>
      <button
        type="button"
        ref={gearRef}
        className={`btn btn--small${open ? ' chip--on' : ''}`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <GearIcon />
        出しかた
        {/* **絞っていることは、畳んでいても分かるようにする。**
            黙って絞ると「なぜ1件しか出ないのか」が分からない
            (さがす画面の `.finder-badge` と同じ考え方) */}
        {narrowed > 0 && <span className="chip-count">{narrowed}</span>}
      </button>
      {open && (
        <SettingsSheet
          anchorEl={gearRef.current}
          onClose={() => setOpen(false)}
          title="出しかた"
          /* 札を押すと数が変わり、箱の高さも変わる。**置き直す合図を渡す** */
          placeKey={`${scope}/${size}/${narrowed}`}
        >
          {選ぶ欄}
          {children && (
            <>
              <p className="rscope-head">しぼる</p>
              {children}
            </>
          )}
          {/* **畳んだ形では、ここに1行を出す。** 始める前は下に出ているが、
              復習の最中は帯の中なので、置ける場所がここしかない */}
          {compact && (
            <p className="card-hint rscope-lead">
              {scopeLead(scope, unit)}
              {' '}
              変えると、その場で出し直します。
            </p>
          )}
        </SettingsSheet>
      )}
    </>
  )

  /* **復習の最中は、ボタンだけ。** 「◯語を出す」は入るためのものなので、
     もう入っている場所には要らない(効かない操作を見せない・CLAUDE.md) */
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
          {/* **押す前に、何が起きるかを書く。**
              数が同じときに「23 問から 23 問」と書くと、かえって読みにくい */}
          {pool.length === 0
            ? `出すものがありません`
            : take >= pool.length
              ? `${pool.length} ${unit}を出す`
              : `${pool.length} ${unit}から ${take} ${unit}を出す`}
        </button>
        {出しかた}
      </div>

      <p className="card-hint rscope-lead">
        {scopeLead(scope, unit)}
        {ahead > 0 && (
          <>
            {' '}
            このうち <strong>{ahead} {unit}</strong>は先取りなので、
            正解しても<strong>次に出る日は動きません</strong>
            (同じ範囲を何度も回して先へ飛ぶと、明日の復習が空になるためです)。
          </>
        )}
      </p>
    </div>
  )
}
