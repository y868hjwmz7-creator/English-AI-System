/**
 * ============================================================================
 * **動きの決まり**(第5.371節・2026-10-04 利用者の指定)
 *
 *   > 今このアプリを世に売り出すとしたらあなたは何が足りないと思いますか？
 *   > …本当に驚く、英語が驚くほど上達し、驚くほど楽しいアプリに変えてください。
 *
 * ── 測ってから決めた ────────────────────────────────────────────
 *
 *   `src/styles.css` は **10,893 行**あって、色の変数は **432 個**、
 *   `var(--…)` は **2,330 回**使われている。**色と間は、よく作られている。**
 *   ところが —— **`@keyframes` は 3 つ、`transition` は 19 か所**だけだった。
 *
 *   つまり**動きが、ほとんど無い。**
 *   押しても何も返らず、画面はパッと入れ替わり、やり終えても何も起きない。
 *   **これが「安く見える」いちばんの原因**である(中身ではなく、手触り)。
 *
 * ── なぜ1か所に持つのか ──────────────────────────────────────
 *
 *   長さと曲線を画面ごとに書くと、**同じ押し心地が2つ以上生まれる。**
 *   呼び名・色・幅を2か所に書かないのと、まったく同じ話である(CLAUDE.md)。
 *
 * ── **場所を動かす動きは、作らない**(CLAUDE.md の決まりを守る)──
 *
 *   「押しても、まわりの物が動かない」は利用者の指定である。
 *   だから動かすのは **`transform` と `opacity` だけ**にしてある ——
 *   あの2つは**まわりの配置を1px も変えない。**
 *   幅・高さ・余白・`display` は、動きの中で触らない。
 *
 * ── **滑る動きが苦手な人がいる** ───────────────────────────────
 *
 *   端末が「動きを減らす」と言っているときは、**動かさない。**
 *   消すのではなく**即座に終わらせる**(0 秒)—— 何が起きたかは残る。
 *   判断は `motionOff()` 1か所。CSS 側も
 *   `@media (prefers-reduced-motion: reduce)` で同じことを言う。
 *
 * **何にも依存していない。** だから `npm run test:feel` が素の node で測れる
 * (CLAUDE.md「素の node で走らせられる形に切り出す」)。
 * ============================================================================
 */

/**
 * 動きの長さ(ミリ秒)。**4段だけ**にしてある。
 *
 * 段を増やすと「どれを使うか」で迷い、迷った数だけ押し心地がばらける。
 *
 * | 段 | 何に |
 * |---|---|
 * | `tap` | 押した瞬間の返り。**人が「すぐ」と感じる上限**がこのあたり |
 * | `move` | 物が出る・消える・入れ替わる |
 * | `sheet` | 下から出るシート・吹き出し |
 * | `cheer` | やり終えたときの祝福。**ここだけ長くてよい** |
 */
export const MOTION_MS = {
  tap: 110,
  move: 180,
  sheet: 240,
  cheer: 620,
}

/**
 * 曲線。**3つだけ。**
 *
 * - `out` … 出てくるもの。速く始まって、そっと止まる(いちばん使う)
 * - `in`  … 消えるもの。そっと始まって、速く去る
 * - `pop` … 跳ねる。**祝福と、正解のときだけ**。多用すると安っぽくなる
 */
export const MOTION_EASE = {
  out: 'cubic-bezier(0.22, 0.61, 0.36, 1)',
  in: 'cubic-bezier(0.55, 0.06, 0.68, 0.19)',
  pop: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
}

/**
 * **動きを減らしてほしいと言われているか。**
 *
 * **既定は「動かす」側ではない** —— 分からないときは動かさない、までは
 * しない(それでは誰にも動きが届かない)。
 * 端末が**はっきりそう言ったときだけ**止める。
 */
export const motionOff = () => {
  try {
    return typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch { return false }
}

/** その動きに使う長さ。**動きを減らすなら 0**(消さずに、即座に終わらせる) */
export const motionMs = (kind = 'move') => (motionOff() ? 0 : (MOTION_MS[kind] ?? MOTION_MS.move))

/**
 * ★ **数を数え上げる**(第5.371節)。
 *
 * 点数が「85」とだけ出るのと、**0 から 85 まで駆け上がる**のは、
 * 同じ数字でも受け取り方がまるで違う。**やり切ったことが体で分かる。**
 *
 * **数そのものは渡された値のまま**で、途中の見せ方だけを作る ——
 * **値を書き換えない**(数えられなかったら、その行ごと出さない・CLAUDE.md)。
 *
 * @param {number} to 最後の数
 * @param {number} ms かける時間
 * @param {number} t  いま何ミリ秒めか
 * @returns {number} そのときに出す整数
 */
export const countUpAt = (to, ms, t) => {
  const n = Number(to)
  if (!Number.isFinite(n)) return 0
  if (!(ms > 0) || t >= ms) return Math.round(n)
  if (t <= 0) return 0
  /* そっと止まる(`out` と同じ気持ち)。1 - (1-x)^3 */
  const x = t / ms
  return Math.round(n * (1 - (1 - x) ** 3))
}

/**
 * 並んでいるものを、**少しずつ遅らせて出す**(stagger)。
 *
 * 全部が同時に現れると「描き直した」ように見える。
 * 1枚ずつ遅らせると「並べた」ように見える。
 *
 * **遅れは積み上げない。** 20 枚あっても最後が 1 秒後では、
 * 待たされているだけである —— **上限を置く。**
 */
export const STAGGER_MS = 28
export const STAGGER_MAX = 6

export const staggerMs = (i) => (motionOff()
  ? 0
  : Math.min(Number(i) || 0, STAGGER_MAX) * STAGGER_MS)

/**
 * 画面に渡す CSS の変数。**CSS に数を書き写さない。**
 *
 * `styles.css` は `var(--motion-tap)` のように読むだけにしてある ——
 * 長さを変えたい日に、**ここ1か所**で変わる。
 */
export const motionVars = () => ({
  '--motion-tap': `${MOTION_MS.tap}ms`,
  '--motion-move': `${MOTION_MS.move}ms`,
  '--motion-sheet': `${MOTION_MS.sheet}ms`,
  '--motion-cheer': `${MOTION_MS.cheer}ms`,
  '--ease-out': MOTION_EASE.out,
  '--ease-in': MOTION_EASE.in,
  '--ease-pop': MOTION_EASE.pop,
})
