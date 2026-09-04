/**
 * **止めた場所を1つだけ覚えておく。**
 *
 * ============================================================================
 * 【なぜ要るのか】(2026-09 利用者の指定)
 *
 *   > 全文を聞いている途中にストップを押し、もう一度再生を押すと、
 *   > また元に戻ってしまいます。止めた場所から再び再生する機能がほしいです。
 *   > これは段落ごとの再生ボタンでも同じ仕様にしてください。
 *
 *   記事は6段落あるので、4段落目の途中で止めて押し直すと
 *   **また1段落目の頭から**になっていた。聞き直したいのは
 *   止めたところであって、頭ではない。
 *
 * 【なぜ別のファイルにしてあるのか】
 *   ここだけは**何にも依存しない**ので、素の node で確かめられる
 *   (`npm run test:play`)。`readAloud.js` の中に書くと、
 *   Supabase や `import.meta.env` を引き連れてしまい、
 *   **手元では一度も走らせられない。**
 *
 *   この決まりは、間違えても `npm run lint` にも `npm run build` にも
 *   引っかからない。しかも間違い方が**「いつも終わりぎわから鳴る」**
 *   のような、押してみるまで分からない形になる。だから検証を置く。
 *
 * 【覚えるのは1つだけ】
 *   2つ覚えても、次に押されるのはどちらか一方である。
 *   別のものを鳴らし始めたら、前の控えは捨てる
 *   (捨てないと、教材を替えたのに前の教材の秒数から鳴る)。
 */

/** 止めた場所。`{ key, index, at }`。**1つだけ** */
let mark = null

/**
 * いま鳴っているものを覚える。**止めるときに、これを場所に変える。**
 * @param {string|null} key   同じものかどうかの目印(呼ぶ側が決める)
 * @param {number} index      何番目を鳴らしているか(1本だけなら 0)
 */
export function nowPlaying(key, index = 0) {
  playing = key ? { key, index } : null
}
let playing = null

/**
 * 止まった。**どこまで鳴っていたかを控える。**
 *
 * @param {number} at 止めた時点の秒数
 *
 * **0.3 秒に満たないときは覚えない。** 鳴り出す前に止めたか、
 * 端末の声(途中から鳴らす手段が無い)である。そこを覚えても
 * 「途中から」にはならないし、頭から鳴るほうが説明できる。
 */
export function stopped(at) {
  mark = (playing && at > 0.3) ? { ...playing, at } : null
  playing = null
}

/**
 * 控えを**取り出して消す。**
 *
 * **取り出したらすぐ消す。** 残しておくと、再開したあと最後まで
 * 聴いたのに、次に押したときまた終わりぎわから鳴る。
 *
 * @returns {{key: string, index: number, at: number}|null}
 */
export function takeMark(key) {
  if (!key || !mark || mark.key !== key) return null
  const m = mark
  mark = null
  return m
}

/** 最後まで鳴りきった。**控えを捨てて、次は頭から** */
export function finished() {
  playing = null
  mark = null
}

/** いま控えがあるか(検証と、画面の表示に使う) */
export const hasMark = (key) => !!(key && mark && mark.key === key)
