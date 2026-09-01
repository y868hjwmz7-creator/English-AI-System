/**
 * 押した「手応え」を返す(2026-08 利用者の要望)。
 *
 * > タッチ式のデバイスでは、ボタンを押した時にバイブや多少の音、
 * > 何でも良いのですが、ボタンを押したという感覚を得られる仕組みが
 * > 欲しいです。単語の長押しの際も。
 *
 * 【触る端末だけ】
 *   マウスには要らない。カーソルが動き、`:hover` も `:active` もあるので、
 *   押したことは目で分かる。**指は画面を隠すので、そこが分からない。**
 *
 * 【端末によってできることが違う。当て推量しない】
 *
 *   | 端末 | 使える手 |
 *   |---|---|
 *   | Android / Chrome | `navigator.vibrate`。**短く1回だけ** |
 *   | iPhone / iPad | `navigator.vibrate` は**無い**(iOS は昔から未対応)。
 *     Safari 17.4 以降の「switch の付いたチェックボックス」を切り替えると
 *     端末が振れるので、目に見えない1つを置いて、それを切り替える |
 *   | どれでもない | 何も起きない。**画面側の押した印(CSS)だけが残る** |
 *
 *   **どれも当てにしすぎない。** 効かない端末では静かに何もしない。
 *   手応えの本体は「押した印(`:active` / `.is-holding`)」であって、
 *   振動はその上乗せである。
 *
 * 【音も鳴らす】(2026-09 利用者の指定で、鳴らさない決まりを改めた)
 *
 *   > ボタンなどを押したときは音が鳴るように(中略)体で感じれる仕様です
 *   > ぶるっとしたり、おとがなったり、そういうのを実装してください
 *
 *   **ふるえと音は、同じところから出す。** 別々に書いて回ると、
 *   片方だけ鳴るボタンが必ずできる。音の作り方は `src/lib/sfx.js`。
 *   **切れるようにしてある**(左のメニューの下)。レッスン中に
 *   邪魔なときのため。
 */
import { playSfx, unlockSfx } from './sfx.js'

/** 触る端末かどうかは**その操作で**決める。端末の種類を当て推量しない */
const isTouch = (e) => e?.pointerType === 'touch'

/**
 * **直前の操作が「触る」だったか。**
 *
 * 手応えを返すのは触る端末だけである(2026-09 利用者の指定
 * 「タッチのデバイスで取り組むときは…」)。マウスで押したときは
 * カーソルも `:active` も見えているので、要らない。
 *
 * 端末の種類は当て推量しない。**その操作がどれで来たか**で決める
 * (`(hover: hover)` に賭けて何も開かなくなった件・CLAUDE.md)。
 * 1つのパソコンでマウスと画面の両方を使う人もいるので、
 * **押すたびに更新する。**
 */
let lastTouch = false
export const cameFromTouch = () => lastTouch

/** 振動の長さ(ミリ秒)。**長くしない。** 気持ち悪くなる */
const MS = { tap: 8, hold: 18 }

/** これ以上動いたら「押した」ではなく「送った」とみなす(px)。
    語の長押し(`EnglishText.jsx` の `MOVE_SLOP`)と同じ考え方 */
const MOVE_SLOP = 10

// ── iOS 用。見えないところに1つだけ置いて、切り替える ──────────
//
// Safari 17.4 で `<input type="checkbox" switch>` が入り、
// **切り替えたときに端末が短く振れる**ようになった。
// これを借りる。**1つだけ作り、作り直さない**(`<audio>` と同じ作法)。
let iosSwitch = null

function iosTap() {
  if (typeof document === 'undefined') return false
  if (!iosSwitch) {
    const el = document.createElement('input')
    el.type = 'checkbox'
    // 対応していない Safari では、この属性はただ無視される
    if (!('switch' in el)) return false
    el.setAttribute('switch', '')
    el.setAttribute('aria-hidden', 'true')
    el.tabIndex = -1
    // 見えない・触れない・場所を取らない
    el.style.cssText = 'position:fixed;top:-100px;left:-100px;width:1px;height:1px;'
      + 'opacity:0;pointer-events:none;'
    document.body.appendChild(el)
    iosSwitch = el
  }
  iosSwitch.checked = !iosSwitch.checked
  return true
}

/**
 * 手応えを返す。**触る端末で呼ばれることだけを想定している。**
 *
 * **ふるえと音を、ここから両方出す**(2026-09 利用者の指定)。
 * どちらか片方しか効かない端末があるので、両方とも試す。
 *
 * @param {'tap'|'hold'} kind tap … ふつうに押した / hold … 長押しが効いた
 */
export function tapFeedback(kind = 'tap') {
  buzz(kind)
  playSfx('tap')
}

/** ふるえだけ。音を鳴らしたくないところ(語の長押しなど)から呼ぶ */
export function buzz(kind = 'tap') {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      if (navigator.vibrate(MS[kind] ?? MS.tap)) return
    }
    iosTap()
  } catch { /* できない端末では、静かに何もしない */ }
}

/**
 * **正解・不正解の手応え**(2026-09 利用者の指定)。
 *
 *   > 正解したらピンポンとなるようにしてほしいです
 *
 * 「言えた」「覚えた」で**ピンポン**、「まだ」は低く1つだけ。
 * **まだを責めない**(2026-08「赤がいらないです」と同じ考え方)。
 *
 * **触って押したときだけ返す**(利用者の指定「タッチのデバイスで
 * 取り組むときは」)。マウスで押した人には、色と文字がすでに見えている。
 *
 * @param {boolean} ok
 */
export function answerFeedback(ok) {
  if (!lastTouch) return
  buzz(ok ? 'hold' : 'tap')
  playSfx(ok ? 'correct' : 'miss')
}

/**
 * 押したボタンすべてに手応えを付ける。**アプリで1回だけ呼ぶ。**
 *
 * 画面ごとに書いて回ると、新しいボタンで必ず抜ける
 * (`styles.css` の「どの画面にも効く決まり」と同じ考え方)。
 *
 * 【画面を送ったときは返さない】(2026-08 利用者の指定)
 *   指を置いた場所がボタンでも、そこから**送り始めたなら押していない。**
 *   `pointerdown` で返すと、送るたびに振れてしまう。
 *   そこで**指を離したときに、押しっぱなしだった場合だけ**返す。
 *   語の長押しと同じ見張り方である(`EnglishText.jsx`)。
 *
 * **語は外す。** 語は「軽く触れただけでは何も起きない」ので、
 * 触れた瞬間に振れると「押せた」と誤解させる。
 * 語は `EnglishText` の中で、意味が開いた瞬間に `tapFeedback('tap')` を呼ぶ
 * (2026-08 に長押しからタップへ改めた)。
 *
 * @returns {Function} 見張りをやめる関数
 */
export function installTapFeedback() {
  let armed = false          // いま押している最中か
  let from = null            // 指を置いた場所
  let off = null             // 見張りの後始末

  const disarm = () => {
    armed = false
    from = null
    off?.()
    off = null
  }

  const onDown = (e) => {
    disarm()
    // **触った流れの中で、音の入れ物を起こす。**
    // iOS は、触っていないところで始めた音を鳴らさない(`sfx.js`)
    unlockSfx()
    lastTouch = isTouch(e)
    if (!isTouch(e)) return
    const el = e.target?.closest?.('button, [role="button"], summary, label.chip')
    if (!el || el.disabled) return
    if (el.closest('.etext-word')) return   // 語は意味が開いたときだけ

    armed = true
    from = { x: e.clientX, y: e.clientY }
    const onMove = (ev) => {
      const t = ev.touches?.[0] ?? ev
      if (!from || t.clientX == null) return
      if (Math.hypot(t.clientX - from.x, t.clientY - from.y) > MOVE_SLOP) disarm()
    }
    // **画面が動いたら、押していない。** `scroll` は伝わらないので capture で拾う
    const onScroll = () => disarm()
    document.addEventListener('pointermove', onMove, { passive: true })
    document.addEventListener('touchmove', onMove, { passive: true })
    document.addEventListener('scroll', onScroll, { capture: true, passive: true })
    off = () => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('touchmove', onMove)
      document.removeEventListener('scroll', onScroll, { capture: true })
    }
  }

  const onUp = () => {
    const ok = armed
    disarm()
    if (ok) tapFeedback('tap')
  }

  document.addEventListener('pointerdown', onDown, { passive: true })
  document.addEventListener('pointerup', onUp, { passive: true })
  document.addEventListener('pointercancel', disarm, { passive: true })
  return () => {
    disarm()
    document.removeEventListener('pointerdown', onDown)
    document.removeEventListener('pointerup', onUp)
    document.removeEventListener('pointercancel', disarm)
  }
}
