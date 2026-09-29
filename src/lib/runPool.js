/**
 * **何本かを同時に走らせる**(第5.307節・2026-09-29 利用者の指摘)。
 *
 *   > 教材の音声、単語やフレーズの訳は作成している段階で裏ですぐなるように
 *   > ロードされるという仕様にしましたよね。これについても相変わらず
 *   > 初めて聴くときに30-50秒くらい待たされますし…
 *
 * ============================================================================
 * 【何が遅かったか】
 *
 *   支度(`prepareJob.js`)は音声を **1本ずつ順に**作っていた。
 *   1本あたり1〜3秒かかるので、**30問の教材は全部そろうまで 30〜90 秒**。
 *   その最中に押すと、その1本ができるまで待つことになる。
 *
 *   語の意味のほうは、もともと3本ずつ同時に走っている(`vocab.js` の
 *   `PREFETCH_PARALLEL`)。**音声だけが1本ずつだった。**
 *
 * 【なぜ「まとめて投げる」ではないのか】
 *
 *   `prepareJob.js` には
 *
 *     > **1本ずつ順に。** まとめて投げると、いくらかかったのか
 *     > 分からないうちに終わる
 *
 *   と書いてあり、これは正しい。**全部を一度に投げてはいけない。**
 *   だから**本数を決めて、その数だけ**同時に走らせる ——
 *   1本ごとの結果は、これまでどおり1つずつ数えられる
 *   (**見えない費用は管理できない**・CLAUDE.md)。
 *
 * 【何にも依存しない形にしてある】
 *
 *   `prepareJob.js` は Supabase を引き連れており、**素の node では
 *   一度も走らせられない。** 算段だけをここへ出して、
 *   `npm run test:play` が確かめる(CLAUDE.md)。
 * ============================================================================
 */

/**
 * `items` を、**同時に `size` 本まで**走らせる。
 *
 * ・**1つずつ、終わったそばから知らせる**(`onEach`)。
 *   まとめて最後に渡すと、進み具合が画面に出せない
 * ・**やめると言われたら、次を始めない**(`alive`)。
 *   走っている最中のものは止められないが、**新しくは始めない**
 * ・**1つも落とさない。** 途中で投げられても、その1つを `'ng'` として
 *   数えて先へ進む —— **黙って消さない**(CLAUDE.md)
 * ・**順番は守らない。** 早く終わったものから知らせる ——
 *   支度は「何本できたか」を数えるだけで、並びを見ていない
 *
 * @param {Array} items    走らせるもの
 * @param {Function} work  `(item) => Promise<any>`
 * @param {object} o
 * @param {number} o.size  同時に走らせる本数(1以上)
 * @param {Function} o.onEach `(結果, item) => void`。**1つ終わるたび**
 * @param {Function} o.alive  `() => boolean`。偽になったら次を始めない
 * @returns {Promise<number>} 実際に走らせた本数
 */
export async function runPool(items, work, { size = 3, onEach = null, alive = null } = {}) {
  const list = Array.isArray(items) ? items : []
  if (!list.length) return 0
  /* **1本以上。** 0 を渡されて何も走らないほうが、よほど分かりにくい */
  const n = Math.max(1, Math.min(Math.floor(size) || 1, list.length))
  let next = 0
  let ran = 0
  const one = async () => {
    for (;;) {
      if (alive && !alive()) return
      if (next >= list.length) return
      const item = list[next]
      next += 1
      let got
      try {
        got = await work(item)
      } catch {
        /* **投げられても、そこで全部を止めない。**
           1本作れなかっただけで、残りの 29 本を諦めることになる */
        got = 'ng'
      }
      ran += 1
      /* **やめたあとは知らせない。** 消えた画面に数を足さない */
      if (!alive || alive()) onEach?.(got, item)
    }
  }
  await Promise.all(Array.from({ length: n }, one))
  return ran
}
