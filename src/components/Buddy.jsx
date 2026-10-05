/**
 * ============================================================================
 * **相棒**(第5.371 → 5.373 → 5.374 → 第5.375節)
 *
 *   2026-10-05 利用者。手描きのアイコン集の写真が**2度**届いた。
 *   並べて見比べて、**違うのは題材ではなく「描き方」**だと分かった。
 *
 *   | あちら | こちら(直す前) |
 *   |---|---|
 *   | **線が震えている** | 定規で引いたような、なめらかな曲線 |
 *   | **左右がそろっていない**(目の高さも大きさも違う) | きっちり左右対称 |
 *   | **笑っていない。真顔** | 大きな目にハイライト、にっこり |
 *   | **鼻が1本の線** | 鼻が無い |
 *   | 人も混じる(めがね・ひげ) | ぜんぶ生きもの・食べもの |
 *
 *   つまり**「整ったかわいいアイコン」**を作っていた。
 *   あちらは**「キモかわ」**である。そこを直した。
 *
 * ── **あの絵そのものは1つも写していない** ──────────────────
 *
 *   見せてもらったのは素材サイト(illustAC)のもので、透かしも入っていた。
 *   **作風は真似てよいが、絵そのものを写すのは別の話**である。
 *
 * ── 震えは `handLine.js` 1か所 ─────────────────────────────
 *
 *   12 人ぶんの線を手で歪ませると、**足した1人だけ妙にきれい**になる。
 *   形のほうは素直に書いて、**震えは通すだけ**にしてある。
 *   **同じ種なら、いつも同じ形**(描き直すたびに歪み直したら気味が悪い)。
 *
 * ── 顔は**真顔**。左右をそろえない ─────────────────────────
 *
 *   ・目は**大きさも高さも違う**点2つ。**ハイライトは入れない**
 *     (あれが「整ったかわいさ」の正体だった)
 *   ・**鼻を1本の線で入れる**(あちらの絵の、いちばん効いている部分)
 *   ・口は**短い線。少し曲がっている**
 *
 *   それでも 6 つの顔は見分けられる —— 下の `Face` を見ること。
 *
 * ── **箱の大きさは、顔でも相棒でも 1px も動かない** ──────────
 * ============================================================================
 */
import { buddyAlt, buddyBreathes } from '../lib/buddy.js'
import { BUDDY_KIND_DEFAULT, buddyKindOf } from '../lib/buddyKind.js'
import { useBuddyKind } from '../lib/useBuddyKind.js'
import { 手のまる, 手の形, 手の線 } from '../lib/handLine.js'

/* 顔の置き場。**左右をそろえない** —— 右目のほうが少し高く、少し大きい */
const 目 = { lx: 25, ly: 31.5, lr: 2.6, rx: 39, ry: 30, rr: 3.1 }

/**
 * 6 つの顔。**笑わせない。**
 * 見分けるのは、目の形と口と「上を見ているか」だけである。
 */
function Face({ face, seed }) {
  const 上 = face === 'think' ? -2.5 : 0
  const 大 = face === 'cheer' ? 1.1 : 1
  const 閉じ目 = face === 'glad' || face === 'proud'
  return (
    <>
      {閉じ目 ? (
        <g className="buddy-ink2" fill="none">
          <path d={手の線([[目.lx - 4, 目.ly + 1], [目.lx, 目.ly - 2.6], [目.lx + 4, 目.ly + 0.6]], seed + 31, 0.5)} />
          <path d={手の線([[目.rx - 4.5, 目.ry + 0.6], [目.rx, 目.ry - 3], [目.rx + 4.5, 目.ry + 1.2]], seed + 32, 0.5)} />
        </g>
      ) : (
        <g className="buddy-ink">
          {/* **左右で大きさも高さも違う。** そろえると、とたんに機械の絵になる */}
          <path className={face === 'rest' ? 'buddy-blink' : undefined}
                d={手のまる(目.lx, 目.ly + 上, 目.lr * 大, (目.lr + 0.4) * 大, seed + 11, { n: 8, amp: 0.45 })} />
          <path className={face === 'rest' ? 'buddy-blink' : undefined}
                d={手のまる(目.rx, 目.ry + 上, (目.rr + 0.2) * 大, 目.rr * 大, seed + 12, { n: 8, amp: 0.45 })} />
        </g>
      )}
      {/* ★ **鼻。** あちらの絵で、いちばん効いていた1本 */}
      <path className="buddy-ink2" fill="none"
            d={手の線([[32.5, 34], [32, 39.5]], seed + 13, 0.6)} />
      <Mouth face={face} seed={seed} />
    </>
  )
}

function Mouth({ face, seed }) {
  /* 口は**短い線。少し曲がっている。**にっこりさせない */
  if (face === 'listen') {
    return <path className="buddy-ink" d={手のまる(31, 45, 3, 3.4, seed + 21, { n: 8, amp: 0.4 })} />
  }
  if (face === 'cheer') {
    return <path className="buddy-ink" d={手の形([[26, 43], [32, 44], [38, 43], [36, 49], [31, 50.5], [27, 48]], seed + 22, 0.7)} />
  }
  if (face === 'glad' || face === 'proud') {
    return <path className="buddy-ink2" fill="none"
                 d={手の線([[26, 44], [29, 46.5], [33, 47], [37.5, 44.5]], seed + 23, 0.5)} />
  }
  if (face === 'think') {
    return <path className="buddy-ink2" fill="none"
                 d={手の線([[27, 45.5], [30, 43.5], [33, 46], [37, 44]], seed + 24, 0.5)} />
  }
  return <path className="buddy-ink2" fill="none"
               d={手の線([[27, 45], [32, 45.8], [37, 44.6]], seed + 25, 0.5)} />
}

const 考え = (face, seed) => (face === 'think' ? (
  <g className="buddy-dots">
    <path d={手のまる(51, 13, 1.7, 1.7, seed + 41, { n: 7, amp: 0.3 })} />
    <path d={手のまる(56, 8.5, 2.1, 2.1, seed + 42, { n: 7, amp: 0.3 })} />
    <path d={手のまる(61, 4, 2.5, 2.5, seed + 43, { n: 7, amp: 0.3 })} />
  </g>
) : null)

const きらめき = (face, seed) => (face === 'proud' ? (
  <g className="buddy-out" fill="none">
    <path d={手の線([[7, 11], [7, 19]], seed + 51, 0.6)} />
    <path d={手の線([[3, 15], [11, 15]], seed + 52, 0.6)} />
    <path d={手の線([[55, 6], [55, 12]], seed + 53, 0.6)} />
    <path d={手の線([[52, 9], [58, 9]], seed + 54, 0.6)} />
  </g>
) : null)

/* ══ 12 人。**かたちと持ちものだけ** ══════════════════════════
   生きもの・食べもの・人を混ぜてある ——
   似たものばかりだと、並べたときに「選んだ気」がしない */
const 形 = {
  robo: { solid: false, seed: 101, 描く: (q) => (<>
    <path className="buddy-out" fill="none" d={手の線([[32, 11], [31, 4]], q + 1, 0.7)} />
    <path className="buddy-ink" d={手のまる(31, 3, 2.4, 2.4, q + 2, { n: 8, amp: 0.4 })} />
    <path className="buddy-out" fill="none" d={手の線([[4, 28], [11, 29]], q + 3, 0.7)} />
    <path className="buddy-out" fill="none" d={手の線([[53, 29], [60, 27]], q + 4, 0.7)} />
    <path className="buddy-body" d={手の形([[16, 13], [32, 11], [49, 14], [51, 32], [49, 51], [32, 53], [15, 51], [13, 32]], q, 1.5)} />
  </>) },
  cat: { solid: false, seed: 202, 描く: (q) => (<>
    <path className="buddy-body" d={手の形([[13, 23], [11, 8], [26, 16]], q + 1, 1.2)} />
    <path className="buddy-body" d={手の形([[52, 22], [54, 7], [39, 16]], q + 2, 1.2)} />
    <path className="buddy-body" d={手のまる(32, 32, 21, 20, q, { n: 13, amp: 1.5 })} />
    <path className="buddy-out" fill="none" d={手の線([[7, 32], [15, 33]], q + 3, 0.7)} />
    <path className="buddy-out" fill="none" d={手の線([[8, 39], [15, 37]], q + 4, 0.7)} />
    <path className="buddy-out" fill="none" d={手の線([[57, 33], [49, 33]], q + 5, 0.7)} />
  </>) },
  dog: { solid: false, seed: 303, 描く: (q) => (<>
    <path className="buddy-body" d={手の形([[17, 17], [6, 26], [8, 44], [20, 46], [22, 30]], q + 1, 1.4)} />
    <path className="buddy-body" d={手の形([[47, 18], [58, 27], [55, 45], [44, 46], [42, 31]], q + 2, 1.4)} />
    <path className="buddy-body" d={手のまる(32, 32, 19, 21, q, { n: 13, amp: 1.6 })} />
  </>) },
  bear: { solid: true, seed: 404, 描く: (q) => (<>
    <path className="buddy-body" d={手のまる(15, 16, 7.5, 7, q + 1, { n: 10, amp: 1.1 })} />
    <path className="buddy-body" d={手のまる(49, 15, 7, 7.5, q + 2, { n: 10, amp: 1.1 })} />
    <path className="buddy-body" d={手のまる(32, 33, 21, 20, q, { n: 13, amp: 1.5 })} />
  </>) },
  bird: { solid: false, seed: 505, 描く: (q) => (<>
    <path className="buddy-out" fill="none" d={手の線([[30, 11], [27, 4], [33, 2]], q + 1, 0.8)} />
    <path className="buddy-body" d={手のまる(32, 33, 20, 20, q, { n: 13, amp: 1.5 })} />
    <path className="buddy-body" d={手の形([[24, 40], [40, 40], [32, 48]], q + 2, 1)} />
  </>) },
  alien: { solid: true, seed: 606, 描く: (q) => (<>
    <path className="buddy-body" d={手のまる(32, 34, 21, 22, q, { n: 13, amp: 1.5 })} />
    <path className="buddy-out" fill="none" d={手の線([[24, 15], [19, 7], [18, 2]], q + 1, 0.8)} />
    <path className="buddy-out" fill="none" d={手の線([[41, 15], [47, 7], [48, 2]], q + 2, 0.8)} />
    <path className="buddy-ink" d={手のまる(18, 2, 2.4, 2.4, q + 3, { n: 8, amp: 0.4 })} />
    <path className="buddy-ink" d={手のまる(48, 2, 2.1, 2.1, q + 4, { n: 8, amp: 0.4 })} />
  </>) },
  ghost: { solid: false, seed: 707, 描く: (q) => (<>
    <path className="buddy-body" d={手の形([
      [32, 8], [48, 14], [52, 30], [52, 52], [45, 48], [39, 54], [32, 48], [25, 54], [19, 48], [12, 52], [12, 30], [16, 14],
    ], q, 1.4)} />
  </>) },
  rice: { solid: false, seed: 808, 描く: (q) => (<>
    <path className="buddy-body" d={手の形([[32, 6], [44, 28], [57, 56], [32, 58], [7, 56], [20, 28]], q, 1.6)} />
    <path className="buddy-band" d={手の形([[16, 50], [32, 52], [48, 50], [49, 57], [32, 58.5], [15, 57]], q + 1, 0.9)} />
  </>) },
  egg: { solid: false, seed: 909, 描く: (q) => (<>
    <path className="buddy-body" d={手のまる(32, 34, 18, 22, q, { n: 13, amp: 1.5 })} />
    <path className="buddy-out" fill="none"
          d={手の線([[16, 22], [22, 17], [27, 21], [33, 15], [39, 20], [45, 15], [49, 20]], q + 1, 0.8)} />
  </>) },
  glasses: { solid: false, seed: 1010, 描く: (q) => (<>
    <path className="buddy-body" d={手のまる(32, 32, 20, 21, q, { n: 13, amp: 1.5 })} />
    <path className="buddy-out" fill="none" d={手のまる(目.lx - 0.5, 目.ly, 7.5, 7, q + 1, { n: 10, amp: 0.7 })} />
    <path className="buddy-out" fill="none" d={手のまる(目.rx + 1, 目.ry, 7, 7.5, q + 2, { n: 10, amp: 0.7 })} />
    <path className="buddy-out" fill="none" d={手の線([[32, 31], [33, 30]], q + 3, 0.5)} />
  </>) },
  beard: { solid: false, seed: 1111, 描く: (q) => (<>
    <path className="buddy-body" d={手のまる(32, 29, 18, 19, q, { n: 13, amp: 1.5 })} />
    <path className="buddy-body" d={手の形([
      [15, 36], [18, 50], [22, 62], [27, 52], [32, 63], [37, 52], [42, 62], [46, 49], [49, 35], [42, 45], [32, 48], [22, 45],
    ], q + 1, 1.3)} />
  </>) },
  turnip: { solid: true, seed: 1212, 描く: (q) => (<>
    <path className="buddy-body" d={手の形([[30, 14], [20, 7], [15, 1], [24, 4], [31, 9]], q + 1, 1)} />
    <path className="buddy-body" d={手の形([[34, 14], [42, 6], [49, 2], [44, 9], [36, 13]], q + 2, 1)} />
    <path className="buddy-body" d={手のまる(32, 34, 18, 20, q, { n: 13, amp: 1.5 })} />
  </>) },
}

/**
 * @param {object} p
 * @param {string} p.face  `buddyFace()` が決めた顔
 * @param {string} [p.size] `'sm'` / `'md'` / `'lg'`
 * @param {string} [p.kind] **ふだんは渡さない**(選ばれているものを自分で読む)
 */
export default function Buddy({ face = 'rest', size = 'md', kind, className = '' }) {
  const 選び = useBuddyKind()
  const id = buddyKindOf(kind ?? 選び)
  const 人 = 形[id] ?? 形[BUDDY_KIND_DEFAULT]
  const q = 人.seed
  return (
    <span
      className={`buddy buddy--${size} buddy--${face} buddy--k-${id}`
        + (人.solid ? ' is-solid' : '')
        + (buddyBreathes(face) ? ' is-breathing' : '')
        + (className ? ` ${className}` : '')}
      role="img"
      aria-label={buddyAlt(face)}
    >
      <svg viewBox="0 0 64 64" focusable="false" aria-hidden="true">
        {人.描く(q)}
        <Face face={face} seed={q} />
        {考え(face, q)}
        {きらめき(face, q)}
      </svg>
    </span>
  )
}
