/**
 * ============================================================================
 * **オフラインのとき、画面に何を出すか。1か所だけ**(第5.372節)
 *
 *   **「余計な説明書きは全て排除」**(利用者の指定)なので、出すのは
 *   **いまの状態**と**押せる操作**だけである。使い方は1文字も書かない。
 *
 *   **素の node で走る** —— 画面を描かずに、出す / 出さないを確かめられる。
 * ============================================================================
 */

/**
 * 帯に出すもの。**何も無ければ `null`**(空の帯で場所を取らない)。
 *
 * **新しい版のほうを先に出す。** あちらは**押せる**が、
 * 電波が無いことはこちらでは直せない —— 押せるほうを手前に置く。
 * ただし**電波が無いあいだは、読み込み直しても新しい版は降りてこない**ので、
 * そのときは電波の話を出す。
 *
 * @returns {{text:string, action:string|null}|null}
 */
export function offlineNote({ offline = false, update = false } = {}) {
  if (update && !offline) return { text: '新しい版があります', action: '読み込み直す' }
  if (offline) return { text: '電波がありません', action: null }
  return null
}

/** 2桁にそろえる(**時刻は端末のもの**。こちらでずらさない) */
const 二桁 = (n) => String(n).padStart(2, '0')

/**
 * **いつ取った控えか。** 画面はこれをそのまま出す。
 *
 * **「黙って出さない」**(CLAUDE.md)—— 古い宿題を、
 * 今日のものとして見せてはいけない。
 *
 * @param {number} at  控えた時刻(ミリ秒)
 * @param {number} now いまの時刻。**渡せるようにしてある**(測るため)
 * @returns {string} 時刻が読めなければ**空**(行ごと出さない)
 */
export function copyAgeText(at, now = Date.now()) {
  if (!Number.isFinite(at) || at <= 0) return ''
  const d = new Date(at)
  if (Number.isNaN(d.getTime())) return ''
  const t = new Date(now)
  const 同じ日 = d.getFullYear() === t.getFullYear()
    && d.getMonth() === t.getMonth() && d.getDate() === t.getDate()
  return 同じ日
    ? `きょう ${二桁(d.getHours())}:${二桁(d.getMinutes())} の控え`
    : `${d.getMonth() + 1}月${d.getDate()}日 ${二桁(d.getHours())}:${二桁(d.getMinutes())} の控え`
}
