/**
 * ============================================================================
 * **相棒**(第5.371 → 5.373 → 5.374 → 5.375 → **第5.376節**)
 *
 *   2026-10-05 利用者の指定。
 *
 *   > 妖怪シリーズにしてください
 *
 *   受け取った見本(素材サイトの一覧)は**顔だけではなく、立ち姿**だった。
 *   だから**全身**に描き直してある。
 *
 * ── **あの絵そのものは1つも写していない** ──────────────────
 *
 *   見本は素材サイト(PIXTA)のもので、透かしも入っていた。
 *   **妖怪は昔からある題材**なので、作風だけを合わせて、こちらで描き起こした。
 *
 * ── 前の回で分かった「描き方」は、そのまま守る(第5.375節) ──
 *
 *   | あちら | こちら(直す前) |
 *   |---|---|
 *   | **線が震えている** | 定規で引いたような、なめらかな曲線 |
 *   | **左右がそろっていない** | きっちり左右対称 |
 *   | **笑っていない。真顔** | 大きな目にハイライト、にっこり |
 *   | **鼻が1本の線** | 鼻が無い |
 *
 *   震えは `handLine.js` 1か所に持たせてある ——
 *   12 体ぶんの線を手で歪ませると、**足した1体だけ妙にきれい**になる。
 *   **同じ種なら、いつも同じ形**(描き直すたびに歪み直したら気味が悪い)。
 *
 * ── 顔は**1か所で描いて、どの妖怪にも乗せる** ────────────────
 *
 *   全身になったので、顔の置き場も大きさも妖怪ごとに違う。
 *   それでも**顔を12通り書き写さない** ——
 *   各体が `顔: { cx, cy, s }` を1つ持ち、`Face` がそこへ描く
 *   (CLAUDE.md「判断は1か所に持つ」)。
 *
 *   **`<g transform="scale()">` で縮めない。** あれをやると
 *   **線の太さまで縮んで**、小さい顔の妖怪だけ線が細くなる ——
 *   並べたときに、そこだけ弱って見える。
 *   だから**点のほうを計算して置く**(`P()`)。線の太さは 12 体とも同じ。
 *
 *   顔の違いは2つだけ。**どちらも `形` が持つ。**
 *   ・`目数: 1` … からかさ・ひとつめこぞう
 *   ・`鼻: false` … からかさ(傘に鼻は無い)/ てんぐ(**自前の長い鼻**がある)
 *
 * ── **箱の大きさは、どの妖怪でも 1px も動かない** ──────────
 *
 *   `viewBox` は 12 体とも `0 0 64 64`。**小さいときの切り出しもしない**
 *   —— 妖怪は**立ち姿の形で見分ける**ものなので、顔だけ抜くと
 *   ぬりかべといったんもめんの区別がつかなくなる(えらぶ画面がそれである)。
 * ============================================================================
 */
import { buddyAlt, buddyBreathes } from '../lib/buddy.js'
import { BUDDY_KIND_DEFAULT, buddyKindOf } from '../lib/buddyKind.js'
import { useBuddyKind } from '../lib/useBuddyKind.js'
import { 手のまる, 手の形, 手の線, 手の四角 } from '../lib/handLine.js'

/* 顔の中の置き場。**左右をそろえない** —— 右目のほうが少し高く、少し大きい。
   この座標は「顔だけの紙」のもので、(32, 37) がまん中である */
const 目 = { lx: 25, ly: 31.5, lr: 2.6, rx: 39, ry: 30, rr: 3.1 }

/**
 * 6 つの顔。**笑わせない。**
 * 見分けるのは、目の形と口と「上を見ているか」だけである。
 *
 * @param {object} p
 * @param {object} p.顔 その妖怪の顔の置き場 `{ cx, cy, s, 目数, 鼻 }`
 */
function Face({ face, seed, 顔 }) {
  const { cx, cy, s = 1, 目数 = 2, 鼻 = true } = 顔
  /* 顔の紙(32, 37 がまん中)から、全身の紙へ置き直す。
     **太さは縮まない** —— 点だけを動かしている */
  const P = (x, y) => [cx + (x - 32) * s, cy + (y - 37) * s]
  const L = (pts) => pts.map(([x, y]) => P(x, y))
  const 上 = face === 'think' ? -2.5 : 0
  const 大 = face === 'cheer' ? 1.1 : 1
  const 閉じ目 = face === 'glad' || face === 'proud'
  const 瞬き = face === 'rest' ? 'buddy-blink' : undefined
  const 一つ目 = 目数 === 1
  const [nx, ny] = P(32, 30.5 + 上)
  const [lx, ly] = P(目.lx, 目.ly + 上)
  const [rx, ry] = P(目.rx, 目.ry + 上)
  return (
    <>
      {閉じ目 ? (
        <g className="buddy-ink2" fill="none">
          {一つ目 ? (
            <path d={手の線(L([[26, 31], [32, 26.5], [38, 31.5]]), seed + 31, 0.5)} />
          ) : (
            <>
              <path d={手の線(L([[目.lx - 4, 目.ly + 1], [目.lx, 目.ly - 2.6], [目.lx + 4, 目.ly + 0.6]]), seed + 31, 0.5)} />
              <path d={手の線(L([[目.rx - 4.5, 目.ry + 0.6], [目.rx, 目.ry - 3], [目.rx + 4.5, 目.ry + 1.2]]), seed + 32, 0.5)} />
            </>
          )}
        </g>
      ) : (
        <g className="buddy-ink">
          {一つ目 ? (
            /* **ひとつ目は大きい。** 2つぶんの重さを1つで持たせる */
            <path className={瞬き}
                  d={手のまる(nx, ny, 6 * s * 大, 6.4 * s * 大, seed + 11, { n: 11, amp: 0.55 })} />
          ) : (
            <>
              {/* **左右で大きさも高さも違う。** そろえると、とたんに機械の絵になる */}
              <path className={瞬き}
                    d={手のまる(lx, ly, 目.lr * s * 大, (目.lr + 0.4) * s * 大, seed + 11, { n: 8, amp: 0.45 })} />
              <path className={瞬き}
                    d={手のまる(rx, ry, (目.rr + 0.2) * s * 大, 目.rr * s * 大, seed + 12, { n: 8, amp: 0.45 })} />
            </>
          )}
        </g>
      )}
      {/* ★ **鼻。** あちらの絵で、いちばん効いていた1本。
            **ひとつ目には出さない** —— 大きな目の真下に縦線が来るので、
            描いてみると**目と鼻が1本の棒につながって見えた**(第5.376節) */}
      {鼻 && !一つ目 ? (
        <path className="buddy-ink2" fill="none"
              d={手の線(L([[32.5, 34], [32, 39.5]]), seed + 13, 0.6)} />
      ) : null}
      <Mouth face={face} seed={seed} P={P} L={L} s={s} />
    </>
  )
}

function Mouth({ face, seed, P, L, s }) {
  /* 口は**短い線。少し曲がっている。**にっこりさせない */
  if (face === 'listen') {
    const [mx, my] = P(31, 45)
    return <path className="buddy-ink" d={手のまる(mx, my, 3 * s, 3.4 * s, seed + 21, { n: 8, amp: 0.4 })} />
  }
  if (face === 'cheer') {
    return <path className="buddy-ink"
                 d={手の形(L([[26, 43], [32, 44], [38, 43], [36, 49], [31, 50.5], [27, 48]]), seed + 22, 0.7)} />
  }
  if (face === 'glad' || face === 'proud') {
    return <path className="buddy-ink2" fill="none"
                 d={手の線(L([[26, 44], [29, 46.5], [33, 47], [37.5, 44.5]]), seed + 23, 0.5)} />
  }
  if (face === 'think') {
    return <path className="buddy-ink2" fill="none"
                 d={手の線(L([[27, 45.5], [30, 43.5], [33, 46], [37, 44]]), seed + 24, 0.5)} />
  }
  return <path className="buddy-ink2" fill="none"
               d={手の線(L([[27, 45], [32, 45.8], [37, 44.6]]), seed + 25, 0.5)} />
}

const 考え = (face, seed) => (face === 'think' ? (
  <g className="buddy-dots">
    <path d={手のまる(53, 11, 1.7, 1.7, seed + 41, { n: 7, amp: 0.3 })} />
    <path d={手のまる(58, 7, 2.1, 2.1, seed + 42, { n: 7, amp: 0.3 })} />
    <path d={手のまる(62, 3, 2.4, 2.4, seed + 43, { n: 7, amp: 0.3 })} />
  </g>
) : null)

const きらめき = (face, seed) => (face === 'proud' ? (
  <g className="buddy-out" fill="none">
    <path d={手の線([[5, 3], [5, 11]], seed + 51, 0.6)} />
    <path d={手の線([[1, 7], [9, 7]], seed + 52, 0.6)} />
    <path d={手の線([[59, 3], [59, 9]], seed + 53, 0.6)} />
    <path d={手の線([[56, 6], [62, 6]], seed + 54, 0.6)} />
  </g>
) : null)

/* ══ 12 体の妖怪。**立ち姿で見分ける** ════════════════════════
   `solid` … 塗りつぶし。3体だけにしてある ——
             全部おなじ描き方だと、並べたときに退屈になる
   `顔`    … 顔の置き場。`s` は顔の大きさ(線の太さは縮まない)
   描く順は**奥から手前**。うしろのものを先に置く。

   **この並びは、実際に描いて1体ずつ直したものである**(第5.376節)。
   はじめの版では、ぬりかべが**壁に見えず楕円**になり、ろくろくびの首が
   **結び目**になり、ひとつめこぞうの**目と鼻が1本の棒**につながった。
   **推測でいじらない。まず描いて見る**(CLAUDE.md)。 */
const 形 = {
  /* かっぱ … **頭の皿**(白く塗って、頭の上に乗せる)・甲羅 */
  kappa: { solid: false, seed: 1101, 顔: { cx: 32, cy: 28, s: 0.82 }, 描く: (q) => (<>
    <path className="buddy-out" fill="none" d={手の線([[19, 42], [8, 47]], q + 2, 0.7)} />
    <path className="buddy-out" fill="none" d={手の線([[45, 42], [56, 47]], q + 3, 0.7)} />
    <path className="buddy-out" fill="none" d={手の線([[25, 57], [23, 62]], q + 4, 0.6)} />
    <path className="buddy-out" fill="none" d={手の線([[39, 57], [41, 62]], q + 5, 0.6)} />
    <path className="buddy-body" d={手のまる(32, 45, 15, 13, q + 1, { n: 11, amp: 1.3 })} />
    <path className="buddy-body" d={手のまる(32, 27, 16, 15, q, { n: 13, amp: 1.5 })} />
    <path className="buddy-body" d={手のまる(32, 13.5, 9.5, 3.2, q + 6, { n: 11, amp: 0.5 })} />
  </>) },
  /* おに … 2本の角・腰巻 */
  oni: { solid: true, seed: 2202, 顔: { cx: 32, cy: 26, s: 0.82 }, 描く: (q) => (<>
    <path className="buddy-out" fill="none" d={手の線([[24, 56], [23, 62]], q + 5, 0.6)} />
    <path className="buddy-out" fill="none" d={手の線([[40, 56], [41, 62]], q + 6, 0.6)} />
    <path className="buddy-body" d={手の形([[20, 16], [16, 4], [23, 9], [28, 13]], q + 1, 0.8)} />
    <path className="buddy-body" d={手の形([[45, 15], [49, 3], [42, 8], [37, 12]], q + 2, 0.8)} />
    <path className="buddy-body" d={手の形([[21, 38], [32, 37], [43, 38], [45, 47], [47, 57], [32, 58], [17, 57], [19, 47]], q + 3, 1.2)} />
    <path className="buddy-band" d={手の形([[21, 47], [32, 46], [43, 47], [44, 52], [43, 56], [32, 57], [21, 56], [20, 52]], q + 4, 0.8)} />
    <path className="buddy-body" d={手のまる(32, 25, 16.5, 15, q, { n: 13, amp: 1.5 })} />
  </>) },
  /* てんぐ … **長い鼻**・兜巾・羽。鼻は自前なので、顔の鼻は出さない */
  tengu: { solid: false, seed: 3303, 顔: { cx: 30, cy: 25, s: 0.78, 鼻: false }, 描く: (q) => (<>
    <path className="buddy-out" fill="none" d={手の線([[26, 57], [25, 62]], q + 6, 0.6)} />
    <path className="buddy-out" fill="none" d={手の線([[38, 57], [39, 62]], q + 7, 0.6)} />
    <path className="buddy-body" d={手の形([[21, 40], [12, 33], [4, 29], [7, 37], [1, 41], [8, 44], [4, 50], [19, 49]], q + 1, 1)} />
    <path className="buddy-body" d={手の形([[43, 40], [52, 33], [60, 29], [57, 37], [63, 41], [56, 44], [60, 50], [45, 49]], q + 2, 1)} />
    <path className="buddy-body" d={手の形([[23, 38], [32, 37], [41, 38], [43, 47], [44, 57], [32, 58], [20, 57], [21, 47]], q + 3, 1.2)} />
    <path className="buddy-body" d={手のまる(30, 24, 15.5, 14.5, q, { n: 13, amp: 1.5 })} />
    <path className="buddy-body" d={手の形([[26, 13], [30, 7], [34, 13], [33, 16], [27, 16]], q + 4, 0.6)} />
    <path className="buddy-body" d={手の形([[29, 25], [34, 24], [55, 37], [50, 43]], q + 5, 1.1)} />
  </>) },
  /* ゆきおんな … 長い髪・裾のない着物(浮いている) */
  yuki: { solid: false, seed: 4404, 顔: { cx: 32, cy: 24, s: 0.76 }, 描く: (q) => (<>
    <path className="buddy-body" d={手の形([[23, 37], [41, 37], [47, 55], [32, 62], [17, 55]], q + 3, 1.4)} />
    <path className="buddy-out" fill="none" d={手の線([[27, 37], [32, 45], [37, 37]], q + 4, 0.6)} />
    <path className="buddy-body" d={手の形([[32, 9], [20, 12], [13, 22], [15, 46], [21, 38], [24, 48], [29, 30]], q + 1, 1.3)} />
    <path className="buddy-body" d={手の形([[32, 9], [44, 12], [51, 22], [49, 46], [43, 38], [40, 48], [35, 30]], q + 2, 1.3)} />
    <path className="buddy-body" d={手のまる(32, 23, 14, 14, q, { n: 13, amp: 1.4 })} />
  </>) },
  /* からかさ … **ひとつ目**・長い舌・1本足の下駄 */
  kasa: { solid: false, seed: 5505, 顔: { cx: 32, cy: 23.5, s: 0.95, 目数: 1 }, 描く: (q) => (<>
    <path className="buddy-out" fill="none" d={手の線([[32, 34], [32, 50]], q + 4, 0.7)} />
    <path className="buddy-body" d={手の四角(22, 50, 42, 56, q + 5, { amp: 0.7 })} />
    <path className="buddy-body" d={手の形([[32, 7], [50, 19], [57, 33], [43, 30], [32, 35], [21, 30], [7, 33], [14, 19]], q, 1.5)} />
    <path className="buddy-out" fill="none" d={手の線([[32, 9], [21, 30]], q + 1, 0.6)} />
    <path className="buddy-out" fill="none" d={手の線([[32, 9], [43, 30]], q + 2, 0.6)} />
    <path className="buddy-body" d={手の形([[28, 32], [36, 32], [33, 46]], q + 3, 0.9)} />
  </>) },
  /* ざしきわらし … おかっぱ(塗りつぶした髪)・着物 */
  zashiki: { solid: false, seed: 6606, 顔: { cx: 32, cy: 27, s: 0.8 }, 描く: (q) => (<>
    <path className="buddy-out" fill="none" d={手の線([[25, 57], [24, 62]], q + 4, 0.6)} />
    <path className="buddy-out" fill="none" d={手の線([[39, 57], [40, 62]], q + 5, 0.6)} />
    <path className="buddy-body" d={手の形([[22, 39], [32, 38], [42, 39], [45, 48], [47, 58], [32, 59], [17, 58], [19, 48]], q + 1, 1.2)} />
    <path className="buddy-out" fill="none" d={手の線([[27, 39], [32, 47], [37, 39]], q + 2, 0.6)} />
    <path className="buddy-body" d={手のまる(32, 25, 16, 15, q, { n: 13, amp: 1.5 })} />
    <path className="buddy-ink" d={手の形([[32, 9], [48, 15], [50, 33], [44, 21], [32, 17], [20, 21], [14, 33], [16, 15]], q + 3, 1.2)} />
  </>) },
  /* ぬりかべ … **壁そのもの。** 小さな手足だけが出ている。
     角に点を1つずつ置くと**楕円になって、壁に見えなかった**(`手の四角`) */
  nurikabe: { solid: true, seed: 7707, 顔: { cx: 32, cy: 30, s: 0.9 }, 描く: (q) => (<>
    <path className="buddy-out" fill="none" d={手の線([[9, 30], [2, 35]], q + 1, 0.7)} />
    <path className="buddy-out" fill="none" d={手の線([[55, 30], [62, 35]], q + 2, 0.7)} />
    <path className="buddy-body" d={手の四角(16, 48, 25, 58, q + 3, { amp: 0.8 })} />
    <path className="buddy-body" d={手の四角(39, 48, 48, 58, q + 4, { amp: 0.8 })} />
    <path className="buddy-body" d={手の四角(8, 12, 56, 50, q, { amp: 1.5, 刻み: 4 })} />
  </>) },
  /* ろくろくび … **首が長く、うねっている。**座った着物。
     揺れを大きくすると**左右の縁が交わって、結び目になる** */
  rokuro: { solid: false, seed: 8808, 顔: { cx: 31, cy: 17, s: 0.68 }, 描く: (q) => (<>
    <path className="buddy-body" d={手の形([[19, 47], [32, 46], [45, 47], [48, 54], [50, 61], [32, 62], [14, 61], [16, 54]], q + 1, 1.3)} />
    <path className="buddy-out" fill="none" d={手の線([[26, 47], [32, 54], [38, 47]], q + 2, 0.6)} />
    <path className="buddy-body" d={手の形([[28, 48], [25, 40], [32, 32], [27, 25], [35, 25], [40, 32], [33, 40], [36, 48]], q + 3, 0.9)} />
    <path className="buddy-body" d={手のまる(31, 16, 13, 12, q, { n: 13, amp: 1.3 })} />
  </>) },
  /* ばけねこ … 耳・**2本の尾**(ねこまた)・ひげ */
  bakeneko: { solid: true, seed: 9909, 顔: { cx: 32, cy: 24, s: 0.8 }, 描く: (q) => (<>
    <path className="buddy-out" fill="none" d={手の線([[45, 50], [58, 43], [55, 30]], q + 3, 0.9)} />
    <path className="buddy-out" fill="none" d={手の線([[45, 54], [60, 52], [62, 38]], q + 4, 0.9)} />
    <path className="buddy-body" d={手の形([[17, 20], [13, 5], [27, 14]], q + 1, 1)} />
    <path className="buddy-body" d={手の形([[46, 19], [51, 4], [37, 14]], q + 2, 1)} />
    <path className="buddy-body" d={手の形([[21, 37], [32, 36], [43, 37], [46, 47], [48, 58], [32, 59], [16, 58], [19, 47]], q + 5, 1.3)} />
    <path className="buddy-body" d={手のまる(32, 23, 16, 14, q, { n: 13, amp: 1.5 })} />
    <path className="buddy-out" fill="none" d={手の線([[14, 27], [3, 24]], q + 6, 0.7)} />
    <path className="buddy-out" fill="none" d={手の線([[14, 31], [3, 31]], q + 7, 0.7)} />
    <path className="buddy-out" fill="none" d={手の線([[50, 27], [61, 24]], q + 8, 0.7)} />
    <path className="buddy-out" fill="none" d={手の線([[50, 31], [61, 31]], q + 9, 0.7)} />
  </>) },
  /* こなきじじい … 赤子のからだに老人の顔。**あごひげ**・まばらな毛・涙 */
  konaki: { solid: false, seed: 10101, 顔: { cx: 32, cy: 24, s: 0.8 }, 描く: (q) => (<>
    <path className="buddy-body" d={手の形([[22, 42], [32, 41], [42, 42], [44, 51], [46, 60], [32, 61], [18, 60], [20, 51]], q + 1, 1.2)} />
    <path className="buddy-body" d={手の形([[26, 37], [32, 36], [38, 37], [36, 45], [32, 52], [28, 45]], q + 3, 0.8)} />
    <path className="buddy-body" d={手のまる(32, 23, 16, 15, q, { n: 13, amp: 1.5 })} />
    <path className="buddy-out" fill="none" d={手の線([[26, 9], [25, 3]], q + 4, 0.6)} />
    <path className="buddy-out" fill="none" d={手の線([[32, 8], [33, 2]], q + 5, 0.6)} />
    <path className="buddy-out" fill="none" d={手の線([[38, 9], [40, 3]], q + 6, 0.6)} />
    <path className="buddy-out" fill="none" d={手の形([[19, 28], [23, 28], [21, 38]], q + 7, 0.7)} />
    <path className="buddy-out" fill="none" d={手の形([[42, 27], [46, 27], [44, 37]], q + 8, 0.7)} />
  </>) },
  /* いったんもめん … **布そのもの。**1枚のうねった布に顔がある。
     「顔の面」と「なびく尾」を別に描くと、**頭と胴に見えてしまう** */
  momen: { solid: false, seed: 11111, 顔: { cx: 30, cy: 21, s: 0.8 }, 描く: (q) => (<>
    <path className="buddy-body" d={手の形([[15, 7], [12, 21], [20, 35], [11, 48], [22, 61], [45, 59], [40, 46], [50, 33], [44, 19], [49, 7]], q, 1.5)} />
    <path className="buddy-out" fill="none" d={手の線([[18, 40], [28, 44], [38, 40]], q + 2, 0.7)} />
    <path className="buddy-out" fill="none" d={手の線([[20, 52], [30, 56], [40, 52]], q + 3, 0.7)} />
  </>) },
  /* ひとつめこぞう … **ひとつ目**・長い舌・ちょんまげ */
  hitotsume: { solid: false, seed: 12121, 顔: { cx: 32, cy: 22, s: 0.85, 目数: 1 }, 描く: (q) => (<>
    <path className="buddy-body" d={手の形([[22, 41], [32, 40], [42, 41], [44, 50], [46, 60], [32, 61], [18, 60], [20, 50]], q + 1, 1.2)} />
    <path className="buddy-out" fill="none" d={手の線([[27, 41], [32, 49], [37, 41]], q + 2, 0.6)} />
    <path className="buddy-body" d={手のまる(32, 24, 16, 15, q, { n: 13, amp: 1.5 })} />
    <path className="buddy-ink" d={手のまる(32, 7.5, 3.2, 2.8, q + 4, { n: 9, amp: 0.4 })} />
    <path className="buddy-body" d={手の形([[29, 33], [35, 33], [32, 48]], q + 5, 0.8)} />
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
  const 妖怪 = 形[id] ?? 形[BUDDY_KIND_DEFAULT]
  const q = 妖怪.seed
  return (
    <span
      className={`buddy buddy--${size} buddy--${face} buddy--k-${id}`
        + (妖怪.solid ? ' is-solid' : '')
        + (buddyBreathes(face) ? ' is-breathing' : '')
        + (className ? ` ${className}` : '')}
      role="img"
      aria-label={buddyAlt(face)}
    >
      <svg viewBox="0 0 64 64" focusable="false" aria-hidden="true">
        {妖怪.描く(q)}
        <Face face={face} seed={q} 顔={妖怪.顔} />
        {考え(face, q)}
        {きらめき(face, q)}
      </svg>
    </span>
  )
}
