/**
 * **「これは、電波が無いせいか」を見分ける。1か所だけ。**(第5.372節)
 *
 * **通信が届いていない失敗は、例外ではなく `error` で返ってくることがある**
 * (2026-08 実測)。見分けないと「つながりましたが断られました」と出て、
 * **電波の話なのに設定の話だと思わせる。**
 *
 * ブラウザごとに言い方が違う。
 *
 * | どこ | 何と言うか |
 * |---|---|
 * | Chrome | `Failed to fetch` |
 * | Safari | `Load failed` |
 * | Firefox | `NetworkError when attempting to fetch resource.` |
 * | React Native | `Network request failed` |
 * | 待ちくたびれ | `withTimeout` の目じるし |
 *
 * **この一覧を2か所に書かない** —— 片方だけ古くなる(CLAUDE.md)。
 * `supabase.js` も `materials.js` も、ここを呼ぶ。
 */
const 言い方 = /failed to fetch|load failed|networkerror|network request failed|connection (closed|refused)/i

/** @param {unknown} e 文字列・Error・Supabase の error、どれでもよい */
export function isNetworkFail(e) {
  if (!e) return false
  const s = typeof e === 'string' ? e : (e.message ?? e.error_description ?? '')
  return 言い方.test(String(s))
}
