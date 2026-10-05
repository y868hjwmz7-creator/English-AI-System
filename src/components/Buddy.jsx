/**
 * ============================================================================
 * **相棒**(第5.371 → 5.373 → 5.374 → 5.375 → 5.376 → 5.377 → **第5.378節**)
 *
 *   2026-10-05 利用者。18 体を出したところ、こう返ってきた。
 *
 *   > 表情を可愛くしすぎです。媚びているように見えます
 *   > また、妖怪っぽさが全然なく、個性が潰れています。
 *   > 笑顔など入りません。笑顔はない、でもだんだん親しみが湧く相棒。
 *   > **爬虫類をペットにしている人の気持ち**と似ているかもしれません
 *
 *   **こちらの失敗は2つ、はっきりしている。**
 *
 *   **①笑顔を描いていた。** `glad` / `proud` / `cheer` の口が**上向きの弧**
 *   だった。「真顔にする」と毎回書きながら、**口だけ笑わせていた。**
 *
 *   **②着物・帯・足・腕を、18 体ぜんぶで共有した**(第5.377節)。
 *   「足した1体だけ丈が違う」のを嫌って土台を1つにしたが、
 *   **そろえた結果、こちらの手で個性を潰していた** ——
 *   ぬりかべもいったんもめんも、同じ人形に別の帽子を載せた絵になっていた。
 *
 *   **線の作風をそろえることと、からだの型紙をそろえることは、別である。**
 *   見本の一覧も、線はそろっていて**силуэт(形)は1つも同じでない。**
 *
 * ── 目は**爬虫類**にした(ここがこの版の肝) ─────────────────
 *
 *   **縦のスリットの瞳**にしてある。笑わないのに目で分かる ——
 *   そして**少しだけ不気味**で、見ているうちに情が湧く。
 *   利用者の言う「爬虫類をペットにしている人の気持ち」は、これだと判断した。
 *
 *   **口は、どの顔でも曲げない。** 真一文字か、縦に開くか、斜めか。
 *   表情は**まぶたと瞳の太さ**だけで出す。
 *
 *   | 顔 | まぶた | 瞳 | 口 |
 *   |---|---|---|---|
 *   | `rest`   | ふつう | 細い | 真一文字 |
 *   | `listen` | ふつう | 中 | 小さく縦に開く |
 *   | `think`  | **片目だけ下がる** | 細い | 斜めの直線 |
 *   | `cheer`  | **見開く** | **太い** | 縦に開く |
 *   | `glad`   | **水平に閉じる** | — | 真一文字 |
 *   | `proud`  | **半分** | 細い | 真一文字 + きらめき |
 *
 * ── 暖色を1色だけ足した ────────────────────────────────────
 *
 *   「ポップに」。**1体につき1か所だけ**、暖色(橙)を置く
 *   —— 皿の水・腰巻・舌・鬼火・腹。**たくさん塗ると、とたんに子ども向けになる。**
 *   色そのものは、以前いただいた指定(**暖色・橙または黄**)に合わせてある。
 *
 * ── **妖怪ごとの癖**(だんだん親しみが湧く仕掛け) ───────────
 *
 *   止まっている絵は、何度見ても同じである。
 *   **1体につき1つだけ、ゆっくり動く場所**を持たせた ——
 *   皿がゆれる / 尾がゆれる / 舌がのびる / 涙が落ちる / 布がうねる。
 *   **押したときではなく、ただ置いてあるときに動く。**
 *   気づくのは2回目か3回目で、そこから情が湧く。
 *
 *   癖は**4種類だけ**(`sway` / `pulse` / `drift` / `drip`)。
 *   18 通り書くと、足した1体だけ動きが違う。
 *   **動きを減らす設定の人には、1つも動かさない。**
 *
 * ── **あの絵そのものは1つも写していない** ──────────────────
 *
 *   見本は素材サイト(PIXTA)のもので、透かしも入っていた。
 *   **妖怪は昔からある題材**なので、作風だけを合わせて描き起こしてある。
 *
 * ── 顔は**1か所で描いて、どの妖怪にも乗せる** ────────────────
 *
 *   **`<g transform="scale()">` で縮めない。** 線の太さまで縮む。
 *   **点のほうを計算して置く**(`P()`)。線の太さは 18 体とも同じ。
 * ============================================================================
 */
import { buddyAlt, buddyBreathes } from '../lib/buddy.js'
import { BUDDY_KIND_DEFAULT, buddyKindOf } from '../lib/buddyKind.js'
import { useBuddyKind } from '../lib/useBuddyKind.js'
import { 手のまる, 手の形, 手の線, 手の四角 } from '../lib/handLine.js'

/* 顔の中の置き場。**左右をそろえない** —— 右目のほうが少し大きく、少し高い。
   この座標は「顔だけの紙」のもので、(32, 37) がまん中である */
const 目 = {
  左: { x: 25.5, y: 31, rx: 4.3, ry: 3.5 },
  右: { x: 38.5, y: 30.2, rx: 4.7, ry: 3.9 },
  一つ: { x: 32, y: 30, rx: 6.2, ry: 5.4 },
}

/**
 * 6 つの顔。**笑わせない。口は1度も曲げない。**
 * 表情は**まぶたと瞳**だけで出す(第5.378節)。
 */
function Face({ face, seed, 顔 }) {
  const { cx, cy, s = 1, 目数 = 2 } = 顔
  const P = (x, y) => [cx + (x - 32) * s, cy + (y - 37) * s]
  const L = (pts) => pts.map(([x, y]) => P(x, y))
  const 見開く = face === 'cheer'
  const 閉じ = face === 'glad'
  const 半目 = face === 'proud'
  const 片目 = face === 'think'
  const 瞬き = face === 'rest' ? 'buddy-blink' : undefined
  /* **瞳の太さが、この相棒のいちばんの表情である。**
     猫や蛇と同じで、見開くと太く、落ち着くと細い */
  const 瞳 = 見開く ? 3.6 : face === 'listen' ? 2.2 : 1.2
  const 玉 = 見開く ? 1.18 : 1

  /** 目を1つ描く。`下げ` が 1 ならまぶたが半分下りている */
  const 片方 = (e, key, 下げ) => {
    const [ex, ey] = P(e.x, e.y)
    const rx = e.rx * s * 玉
    const ry = e.ry * s * 玉 * (下げ ? 0.52 : 1)
    const cy2 = 下げ ? ey + e.ry * s * 0.4 : ey
    return (
      <g key={key} className={瞬き}>
        <path className="buddy-eye" d={手のまる(ex, cy2, rx, ry, seed + key * 7 + 11, { n: 11, amp: 0.3 })} />
        <path className="buddy-pupil"
              d={手の四角(ex - (瞳 * s) / 2, cy2 - ry * 0.92, ex + (瞳 * s) / 2, cy2 + ry * 0.92,
                seed + key * 7 + 12, { amp: 0.14, 刻み: 2 })} />
        {下げ ? (
          <path className="buddy-ink2" fill="none"
                d={手の線([[ex - rx, cy2 - ry * 1.3], [ex + rx, cy2 - ry * 1.1]], seed + key * 7 + 13, 0.25)} />
        ) : null}
      </g>
    )
  }

  /** 閉じた目。**上向きの弧にしない**(あれが笑顔である)——**真横の直線** */
  const 閉じ目 = (e, key) => {
    const [ex, ey] = P(e.x, e.y)
    const rx = e.rx * s
    return <path key={key} className="buddy-ink2" fill="none"
                 d={手の線([[ex - rx, ey], [ex, ey + 0.25], [ex + rx, ey - 0.15]], seed + key * 7 + 21, 0.3)} />
  }

  const 目たち = 目数 === 1
    ? (閉じ ? [閉じ目(目.一つ, 1)] : [片方(目.一つ, 1, 半目)])
    : 閉じ
      ? [閉じ目(目.左, 1), 閉じ目(目.右, 2)]
      : [片方(目.左, 1, 半目 || 片目), 片方(目.右, 2, 半目)]

  return (
    <>
      {目たち}
      {/* ★ **鼻は描かない**(第5.377節)。てんぐの長い鼻だけは `形` が持つ */}
      <Mouth face={face} seed={seed} P={P} L={L} s={s} />
    </>
  )
}

/**
 * 口。**どの顔でも曲げない。**
 * 上向きの弧を1本でも描いたら、そこで媚びた顔になる(第5.378節)。
 */
function Mouth({ face, seed, P, L, s }) {
  const 四角い口 = (x1, y1, x2, y2, k) => {
    const [a, b] = P(x1, y1)
    const [c, d] = P(x2, y2)
    return <path className="buddy-ink buddy-mouth" d={手の四角(a, b, c, d, seed + k, { amp: 0.25, 刻み: 2 })} />
  }
  if (face === 'listen') return 四角い口(30.3, 42.6, 33.7, 46.4, 31)
  if (face === 'cheer') return 四角い口(29.4, 41.8, 34.6, 47.8, 32)
  if (face === 'think') {
    return <path className="buddy-ink2 buddy-mouth" fill="none"
                 d={手の線(L([[29, 45], [32, 44.2], [35.2, 43.4]]), seed + 33, 0.3)} />
  }
  /* 真一文字。**まん中を下げない**(下げると、への字でも笑いでもなく、ただ歪む) */
  return <path className="buddy-ink2 buddy-mouth" fill="none"
               d={手の線(L([[28.8, 44.2], [32, 44.1], [35.2, 43.9]]), seed + 34, 0.3)} />
}

/* ══ 18 体の妖怪 ═══════════════════════════════════════════════
   **型紙は持たない。** 1体ずつ、別のからだを書く ——
   そろえた結果、個性を潰したのが第5.377節である。

   `solid` … 塗りつぶし。1体だけ(うみぼうず)
   `顔`    … 顔の置き場。`s` は顔の大きさ(線の太さは縮まない)
   `暖`    … 暖色を置く場所は**1体につき1か所**。塗りすぎると子ども向けになる
   `癖`    … 置いてあるだけで、ゆっくり動く場所。**1体につき1つ**
   描く順は**奥から手前**。うしろのものを先に置く */
const 形 = {
  /* かっぱ … **甲羅が大きい亀。**頭の皿に水(暖色)。水かきの手足 */
  kappa: { solid: false, seed: 1101, 顔: { cx: 32, cy: 19, s: 0.6 }, 描く: (q) => (<>
    <path className="buddy-body" d={手の形([[16, 48], [22, 46], [24, 56], [14, 57]], q + 5, 0.6)} />
    <path className="buddy-body" d={手の形([[48, 48], [42, 46], [40, 56], [50, 57]], q + 6, 0.6)} />
    <path className="buddy-body" d={手の形([[20, 36], [8, 40], [4, 48], [12, 46], [10, 52], [16, 46]], q + 3, 0.7)} />
    <path className="buddy-body" d={手の形([[44, 36], [56, 40], [60, 48], [52, 46], [54, 52], [48, 46]], q + 4, 0.7)} />
    <path className="buddy-body" d={手のまる(32, 40, 16, 12.5, q + 1, { n: 13, amp: 1.2 })} />
    <path className="buddy-out" fill="none" d={手の線([[23, 38], [32, 35], [41, 38]], q + 2, 0.4)} />
    <path className="buddy-out" fill="none" d={手の線([[21, 45], [32, 42], [43, 45]], q + 9, 0.4)} />
    <path className="buddy-out" fill="none" d={手の線([[32, 29], [32, 50]], q + 10, 0.4)} />
    <path className="buddy-body" d={手のまる(32, 17, 10.5, 9.5, q, { n: 13, amp: 1 })} />
    <path className="buddy-warm buddy-sway" d={手のまる(32, 7.5, 8, 2.8, q + 7, { n: 11, amp: 0.35 })} />
  </>) },
  /* おに … **肩が張った大柄。**2本の角、虎の腰巻(暖色)、金棒 */
  oni: { solid: false, seed: 2202, 顔: { cx: 31, cy: 20, s: 0.66 }, 描く: (q) => (<>
    <path className="buddy-body" d={手の形([[22, 52], [29, 52], [29, 60], [20, 60]], q + 7, 0.5)} />
    <path className="buddy-body" d={手の形([[36, 52], [43, 52], [44, 60], [35, 60]], q + 8, 0.5)} />
    <path className="buddy-out" fill="none" d={手の線([[17, 34], [10, 44]], q + 5, 0.4)} />
    <path className="buddy-out" fill="none" d={手の線([[45, 34], [52, 30]], q + 9, 0.4)} />
    <path className="buddy-body" d={手の形([[18, 31], [31, 29], [44, 31], [46, 42], [48, 54], [31, 55], [14, 54], [16, 42]], q + 1, 1.1)} />
    <path className="buddy-warm" d={手の形([[16, 43], [31, 41], [46, 43], [47, 49], [31, 51], [15, 49]], q + 2, 0.6)} />
    <path className="buddy-body" d={手のまる(31, 18, 12.5, 11, q, { n: 13, amp: 1.2 })} />
    <path className="buddy-body" d={手の形([[22, 11], [19, 2], [21, 1.4], [26, 6], [29, 9]], q + 3, 0.4)} />
    <path className="buddy-body" d={手の形([[40, 10], [43, 1], [41, 0.6], [36, 5], [33, 8]], q + 4, 0.4)} />
    <path className="buddy-body buddy-sway" d={手の形([[49, 8], [58, 7], [59, 24], [60, 44], [54, 45], [52, 24]], q + 6, 0.5)} />
  </>) },
  /* てんぐ … **鼻が画面を横切るほど長い。**羽、一本歯の下駄 */
  tengu: { solid: false, seed: 3303, 顔: { cx: 26, cy: 20, s: 0.58 }, 描く: (q) => (<>
    <path className="buddy-body" d={手の形([[20, 30], [8, 22], [2, 30], [10, 32], [3, 38], [13, 38], [19, 36]], q + 3, 0.8)} />
    <path className="buddy-out" fill="none" d={手の線([[26, 52], [26, 60]], q + 5, 0.4)} />
    <path className="buddy-body" d={手の四角(18, 60, 35, 63.5, q + 6, { amp: 0.4 })} />
    <path className="buddy-body" d={手の形([[16, 30], [26, 28], [36, 30], [38, 41], [40, 52], [26, 53], [12, 52], [14, 41]], q + 1, 1.1)} />
    <path className="buddy-warm" d={手の形([[14, 41], [26, 39], [38, 41], [39, 46], [26, 48], [13, 46]], q + 2, 0.5)} />
    <path className="buddy-body" d={手のまる(26, 18, 11, 10, q, { n: 13, amp: 1.1 })} />
    <path className="buddy-body" d={手の形([[23, 7], [26, 2], [29, 7], [28, 10], [24, 10]], q + 4, 0.35)} />
    <path className="buddy-body buddy-sway" d={手の形([[27, 22], [31, 20], [60, 29], [55, 34]], q + 7, 0.8)} />
  </>) },
  /* ゆきおんな … **裾が消える。**長い髪、帯(暖色)、降る雪 */
  yuki: { solid: false, seed: 4404, 顔: { cx: 32, cy: 20, s: 0.58 }, 描く: (q) => (<>
    <path className="buddy-body" d={手の形([[24, 30], [32, 29], [40, 30], [43, 42], [46, 58], [32, 63], [18, 58], [21, 42]], q + 1, 1)} />
    <path className="buddy-warm" d={手の形([[21, 41], [32, 39], [43, 41], [44, 47], [32, 49], [20, 47]], q + 2, 0.5)} />
    <path className="buddy-body" d={手の形([[32, 7], [21, 10], [15, 20], [16, 48], [22, 36], [25, 52], [29, 23]], q + 3, 1)} />
    <path className="buddy-body" d={手の形([[32, 7], [43, 10], [49, 20], [48, 48], [42, 36], [39, 52], [35, 23]], q + 4, 1)} />
    <path className="buddy-body" d={手のまる(32, 18, 10.5, 10, q, { n: 13, amp: 1 })} />
    <g className="buddy-out buddy-drip" fill="none">
      <path d={手のまる(7, 20, 1.7, 1.7, q + 5, { n: 7, amp: 0.25 })} />
      <path d={手のまる(57, 16, 1.5, 1.5, q + 6, { n: 7, amp: 0.25 })} />
      <path d={手のまる(9, 42, 1.6, 1.6, q + 7, { n: 7, amp: 0.25 })} />
      <path d={手のまる(55, 38, 1.8, 1.8, q + 8, { n: 7, amp: 0.25 })} />
    </g>
  </>) },
  /* からかさ … **傘そのもの。**ひとつ目、長い舌(暖色)、一本足の下駄 */
  kasa: { solid: false, seed: 5505, 顔: { cx: 32, cy: 18, s: 0.8, 目数: 1 }, 描く: (q) => (<>
    <path className="buddy-out" fill="none" d={手の線([[32, 30], [32, 46]], q + 4, 0.4)} />
    <path className="buddy-body" d={手の四角(22, 46, 42, 51, q + 5, { amp: 0.4 })} />
    <path className="buddy-out" fill="none" d={手の線([[26, 51], [26, 58]], q + 6, 0.4)} />
    <path className="buddy-out" fill="none" d={手の線([[38, 51], [38, 58]], q + 7, 0.4)} />
    <path className="buddy-body" d={手の形([[32, 2], [50, 13], [58, 27], [44, 25], [32, 29], [20, 25], [6, 27], [14, 13]], q, 1.1)} />
    <path className="buddy-out" fill="none" d={手の線([[32, 4], [20, 25]], q + 1, 0.5)} />
    <path className="buddy-out" fill="none" d={手の線([[32, 4], [44, 25]], q + 2, 0.5)} />
    <path className="buddy-warm buddy-pulse" d={手の形([[29, 26], [35, 26], [32, 41]], q + 3, 0.5)} />
  </>) },
  /* ざしきわらし … **小柄。**おかっぱ(濃い)、着物(暖色)、小さい手 */
  zashiki: { solid: false, seed: 6606, 顔: { cx: 32, cy: 22, s: 0.56 }, 描く: (q) => (<>
    <path className="buddy-body" d={手の形([[26, 50], [31, 50], [31, 58], [25, 58]], q + 6, 0.4)} />
    <path className="buddy-body" d={手の形([[33, 50], [38, 50], [39, 58], [33, 58]], q + 7, 0.4)} />
    <path className="buddy-out" fill="none" d={手の線([[25, 35], [19, 44]], q + 4, 0.4)} />
    <path className="buddy-out" fill="none" d={手の線([[39, 35], [45, 44]], q + 5, 0.4)} />
    <path className="buddy-warm" d={手の形([[25, 32], [32, 31], [39, 32], [41, 41], [43, 51], [32, 52], [21, 51], [23, 41]], q + 1, 0.9)} />
    <path className="buddy-out" fill="none" d={手の線([[28, 32], [32, 39], [36, 32]], q + 2, 0.4)} />
    <path className="buddy-body" d={手のまる(32, 20, 10.5, 10, q, { n: 13, amp: 1 })} />
    <path className="buddy-ink buddy-sway" d={手の形([[32, 8], [43, 13], [44, 27], [40, 17], [32, 14], [24, 17], [20, 27], [21, 13]], q + 3, 0.7)} />
  </>) },
  /* ぬりかべ … **横長の壁。**足だけが下に出ている。目が大きく離れている */
  nurikabe: { solid: false, seed: 7707, 顔: { cx: 32, cy: 26, s: 1.15 }, 描く: (q) => (<>
    <path className="buddy-body" d={手の四角(16, 44, 25, 57, q + 3, { amp: 0.5 })} />
    <path className="buddy-body" d={手の四角(39, 44, 48, 57, q + 4, { amp: 0.5 })} />
    <path className="buddy-body" d={手の四角(4, 8, 60, 46, q, { amp: 1.3, 刻み: 5 })} />
    <path className="buddy-warm" d={手の四角(4, 38, 60, 46, q + 5, { amp: 0.8, 刻み: 5 })} />
    <path className="buddy-out buddy-sway" fill="none" d={手の線([[4, 24], [0.5, 32]], q + 1, 0.4)} />
    <path className="buddy-out" fill="none" d={手の線([[60, 24], [63.5, 32]], q + 2, 0.4)} />
  </>) },
  /* ろくろくび … **首が画面いっぱい。**小さい頭、小さい座った胴、帯(暖色) */
  rokuro: { solid: false, seed: 8808, 顔: { cx: 31, cy: 11, s: 0.44 }, 描く: (q) => (<>
    <path className="buddy-body" d={手の形([[22, 48], [32, 47], [42, 48], [46, 54], [49, 61], [32, 62], [15, 61], [18, 54]], q + 1, 0.9)} />
    <path className="buddy-warm" d={手の形([[18, 53], [32, 51], [46, 53], [47, 57], [32, 58], [17, 57]], q + 2, 0.5)} />
    <path className="buddy-body" d={手の形([[29, 49], [24, 40], [34, 31], [27, 22], [34, 20], [40, 30], [33, 39], [35, 49]], q + 3, 0.7)} />
    <path className="buddy-body buddy-sway" d={手のまる(31, 10, 8.5, 8, q, { n: 13, amp: 0.8 })} />
  </>) },
  /* ばけねこ … **四つ足 + 二又の尾。**頭に手ぬぐい(暖色) */
  bakeneko: { solid: false, seed: 9909, 顔: { cx: 24, cy: 24, s: 0.55 }, 描く: (q) => (<>
    <path className="buddy-out buddy-sway" fill="none" d={手の線([[46, 42], [57, 34], [53, 22]], q + 3, 0.7)} />
    <path className="buddy-out buddy-sway" fill="none" d={手の線([[46, 45], [59, 43], [62, 31]], q + 4, 0.7)} />
    <path className="buddy-body" d={手の形([[16, 15], [12, 5], [24, 12]], q + 1, 0.6)} />
    <path className="buddy-body" d={手の形([[32, 14], [36, 4], [26, 11]], q + 2, 0.6)} />
    <path className="buddy-body" d={手の四角(17, 48, 23, 55, q + 7, { amp: 0.4 })} />
    <path className="buddy-body" d={手の四角(36, 48, 42, 55, q + 8, { amp: 0.4 })} />
    <path className="buddy-body" d={手の形([[16, 35], [28, 31], [42, 33], [48, 42], [44, 50], [24, 51], [13, 45]], q + 5, 1)} />
    <path className="buddy-body" d={手のまる(24, 23, 11.5, 10.5, q, { n: 13, amp: 1 })} />
    <path className="buddy-warm" d={手の形([[14, 15], [24, 11], [34, 15], [33, 19], [24, 16], [15, 19]], q + 6, 0.5)} />
    <path className="buddy-out" fill="none" d={手の線([[12, 25], [3, 22]], q + 9, 0.4)} />
    <path className="buddy-out" fill="none" d={手の線([[12, 29], [3, 30]], q + 10, 0.4)} />
  </>) },
  /* こなきじじい … **大きい頭に小さいからだ。**ひげ、腹掛け(暖色)、落ちる涙 */
  konaki: { solid: false, seed: 10101, 顔: { cx: 32, cy: 20, s: 0.66 }, 描く: (q) => (<>
    <path className="buddy-body" d={手の形([[26, 50], [31, 50], [31, 57], [25, 57]], q + 7, 0.4)} />
    <path className="buddy-body" d={手の形([[33, 50], [38, 50], [39, 57], [33, 57]], q + 8, 0.4)} />
    <path className="buddy-out" fill="none" d={手の線([[25, 40], [18, 47]], q + 5, 0.4)} />
    <path className="buddy-out" fill="none" d={手の線([[39, 40], [46, 47]], q + 6, 0.4)} />
    <path className="buddy-body" d={手の形([[25, 37], [32, 36], [39, 37], [41, 44], [42, 51], [32, 52], [22, 51], [23, 44]], q + 1, 0.8)} />
    <path className="buddy-warm" d={手の形([[27, 39], [32, 38], [37, 39], [38, 46], [32, 48], [26, 46]], q + 2, 0.5)} />
    <path className="buddy-body" d={手の形([[27, 30], [32, 29], [37, 30], [35, 38], [32, 44], [29, 38]], q + 3, 0.6)} />
    <path className="buddy-body" d={手のまる(32, 19, 13, 12, q, { n: 13, amp: 1.2 })} />
    <path className="buddy-out" fill="none" d={手の線([[26, 7], [25, 1]], q + 9, 0.4)} />
    <path className="buddy-out" fill="none" d={手の線([[32, 6], [33, 0.5]], q + 10, 0.4)} />
    <path className="buddy-out" fill="none" d={手の線([[38, 7], [40, 1]], q + 11, 0.4)} />
    <g className="buddy-out buddy-drip" fill="none">
      <path d={手の形([[20, 23], [23, 23], [21.5, 30]], q + 12, 0.35)} />
      <path d={手の形([[41, 22], [44, 22], [42.5, 29]], q + 13, 0.35)} />
    </g>
  </>) },
  /* いったんもめん … **1枚の長い布。**顔は上の端、手は布の端。裏地が暖色 */
  momen: { solid: false, seed: 11111, 顔: { cx: 31, cy: 14, s: 0.52 }, 描く: (q) => (<>
    <path className="buddy-out" fill="none" d={手の線([[18, 14], [8, 18]], q + 3, 0.4)} />
    <path className="buddy-out" fill="none" d={手の線([[45, 13], [55, 17]], q + 4, 0.4)} />
    <path className="buddy-body" d={手の形([[3, 17], [8, 15], [10, 21], [5, 23]], q + 5, 0.3)} />
    <path className="buddy-body" d={手の形([[57, 16], [62, 14], [64, 20], [59, 22]], q + 6, 0.3)} />
    <g className="buddy-drift">
      <path className="buddy-body" d={手の形([
        [19, 4], [16, 16], [27, 28], [17, 40], [27, 52], [22, 61],
        [43, 60], [38, 50], [47, 38], [36, 26], [46, 15], [44, 4],
      ], q, 0.8)} />
      <path className="buddy-warm" d={手の形([[23, 55], [42, 54], [43, 60], [22, 61]], q + 1, 0.4)} />
      <path className="buddy-out" fill="none" d={手の線([[18, 24], [27, 21], [36, 25]], q + 2, 0.4)} />
      <path className="buddy-out" fill="none" d={手の線([[21, 36], [31, 33], [41, 37]], q + 7, 0.4)} />
      <path className="buddy-out" fill="none" d={手の線([[20, 47], [30, 44], [40, 48]], q + 8, 0.4)} />
    </g>
  </>) },
  /* ひとつめこぞう … **ひとつ目。**長い舌(暖色)、小坊主、小柄 */
  hitotsume: { solid: false, seed: 12121, 顔: { cx: 32, cy: 19, s: 0.72, 目数: 1 }, 描く: (q) => (<>
    <path className="buddy-body" d={手の形([[26, 51], [31, 51], [31, 58], [25, 58]], q + 6, 0.4)} />
    <path className="buddy-body" d={手の形([[33, 51], [38, 51], [39, 58], [33, 58]], q + 7, 0.4)} />
    <path className="buddy-out" fill="none" d={手の線([[25, 38], [19, 47]], q + 4, 0.4)} />
    <path className="buddy-out" fill="none" d={手の線([[39, 38], [45, 47]], q + 5, 0.4)} />
    <path className="buddy-body" d={手の形([[25, 35], [32, 34], [39, 35], [41, 43], [43, 52], [32, 53], [21, 52], [23, 43]], q + 1, 0.9)} />
    <path className="buddy-out" fill="none" d={手の線([[28, 35], [32, 42], [36, 35]], q + 2, 0.4)} />
    <path className="buddy-body" d={手のまる(32, 18, 12.5, 11.5, q, { n: 13, amp: 1.1 })} />
    <path className="buddy-warm buddy-pulse" d={手の形([[29, 27], [35, 27], [32, 40]], q + 3, 0.5)} />
  </>) },
  /* きゅうび … **四つ足のきつね。**尾が扇のように広がる(先が暖色) */
  kitsune: { solid: false, seed: 13131, 顔: { cx: 18, cy: 24, s: 0.48 }, 描く: (q) => (<>
    <g className="buddy-sway">
      <path className="buddy-body" d={手の形([[36, 38], [36, 12], [45, 15], [41, 40]], q + 1, 0.7)} />
      <path className="buddy-body" d={手の形([[37, 40], [48, 15], [55, 21], [43, 43]], q + 2, 0.7)} />
      <path className="buddy-body" d={手の形([[38, 42], [56, 25], [61, 34], [45, 46]], q + 3, 0.7)} />
      <path className="buddy-body" d={手の形([[38, 45], [60, 40], [60, 50], [44, 51]], q + 4, 0.7)} />
      <path className="buddy-warm" d={手の形([[36, 12], [45, 15], [43, 21], [36, 18]], q + 11, 0.4)} />
    </g>
    <path className="buddy-body" d={手の四角(16, 46, 22, 54, q + 9, { amp: 0.4 })} />
    <path className="buddy-body" d={手の四角(29, 46, 35, 54, q + 10, { amp: 0.4 })} />
    <path className="buddy-body" d={手の形([[12, 34], [24, 29], [38, 32], [43, 41], [37, 49], [20, 50], [9, 44]], q + 6, 1)} />
    <path className="buddy-body" d={手の形([[11, 17], [8, 5], [18, 13]], q + 7, 0.6)} />
    <path className="buddy-body" d={手の形([[24, 16], [29, 5], [19, 12]], q + 8, 0.6)} />
    <path className="buddy-body" d={手のまる(18, 23, 11, 10, q, { n: 13, amp: 1 })} />
  </>) },
  /* うみぼうず … **黒い坊主。**波(暖色)から立ち上がり、両腕を上げている */
  umibozu: { solid: true, seed: 14141, 顔: { cx: 32, cy: 24, s: 0.95 }, 描く: (q) => (<>
    <path className="buddy-body" d={手の形([[16, 30], [4, 16], [0.5, 22], [11, 36]], q + 2, 0.7)} />
    <path className="buddy-body" d={手の形([[48, 30], [60, 16], [63.5, 22], [53, 36]], q + 3, 0.7)} />
    <path className="buddy-body" d={手の形([[32, 4], [48, 13], [53, 31], [51, 46], [32, 48], [13, 46], [11, 31], [16, 13]], q, 1.2)} />
    <g className="buddy-warm-line buddy-drift" fill="none">
      <path d={手の線([[1, 50], [12, 45], [23, 51], [34, 45], [45, 51], [56, 45], [63, 50]], q + 1, 0.5)} />
      <path d={手の線([[2, 58], [13, 53], [24, 59], [35, 53], [46, 59], [57, 53], [63, 58]], q + 4, 0.5)} />
    </g>
  </>) },
  /* とうふこぞう … **笠をかぶり、お盆に豆腐(暖色)。**ひょろりと細い */
  toufu: { solid: false, seed: 15151, 顔: { cx: 32, cy: 23, s: 0.52 }, 描く: (q) => (<>
    <path className="buddy-body" d={手の形([[27, 52], [31, 52], [31, 59], [26, 59]], q + 6, 0.4)} />
    <path className="buddy-body" d={手の形([[33, 52], [37, 52], [38, 59], [33, 59]], q + 7, 0.4)} />
    <path className="buddy-body" d={手の形([[27, 32], [32, 31], [37, 32], [38, 42], [39, 53], [32, 54], [25, 53], [26, 42]], q + 1, 0.8)} />
    <path className="buddy-out" fill="none" d={手の線([[27, 35], [23, 42]], q + 2, 0.4)} />
    <path className="buddy-out" fill="none" d={手の線([[37, 35], [41, 42]], q + 3, 0.4)} />
    <path className="buddy-body" d={手の四角(19, 42, 45, 46, q + 4, { amp: 0.35 })} />
    <path className="buddy-warm buddy-sway" d={手の四角(26, 35, 38, 42, q + 5, { amp: 0.3 })} />
    <path className="buddy-body" d={手のまる(32, 21, 9.5, 9, q, { n: 13, amp: 0.9 })} />
    <path className="buddy-body" d={手の形([[32, 3], [52, 16], [12, 16]], q + 8, 0.7)} />
  </>) },
  /* ゆうれい … **足が無い。**三角の額当て(暖色)、垂れた手、ゆらぐ鬼火 */
  yurei: { solid: false, seed: 16161, 顔: { cx: 32, cy: 19, s: 0.58 }, 描く: (q) => (<>
    <path className="buddy-out" fill="none" d={手の線([[24, 33], [15, 38], [17, 45]], q + 3, 0.5)} />
    <path className="buddy-out" fill="none" d={手の線([[40, 33], [49, 38], [47, 45]], q + 4, 0.5)} />
    <path className="buddy-body" d={手の形([[24, 29], [32, 28], [40, 29], [44, 42], [38, 56], [32, 63], [26, 56], [20, 42]], q + 2, 1)} />
    <path className="buddy-body" d={手の形([[32, 6], [20, 10], [14, 21], [18, 42], [23, 30], [26, 40], [29, 19]], q + 5, 1)} />
    <path className="buddy-body" d={手の形([[32, 6], [44, 10], [50, 21], [46, 42], [41, 30], [38, 40], [35, 19]], q + 6, 1)} />
    <path className="buddy-body" d={手のまる(32, 18, 10.5, 10, q, { n: 13, amp: 1 })} />
    <path className="buddy-warm" d={手の形([[32, 3], [38, 12], [26, 12]], q + 1, 0.35)} />
    <g className="buddy-warm-line buddy-pulse" fill="none">
      <path d={手の形([[6, 14], [9, 20], [7, 25], [3, 25], [2, 20]], q + 7, 0.3)} />
      <path d={手の形([[57, 10], [60, 16], [58, 21], [54, 21], [53, 16]], q + 8, 0.3)} />
    </g>
  </>) },
  /* かまいたち … **鎌の腕(刃が暖色)のいたち。**走る風の線 */
  kamaitachi: { solid: false, seed: 17171, 顔: { cx: 30, cy: 18, s: 0.56 }, 描く: (q) => (<>
    <path className="buddy-body" d={手の形([[25, 48], [30, 48], [30, 56], [24, 56]], q + 8, 0.4)} />
    <path className="buddy-body" d={手の形([[33, 48], [38, 48], [39, 56], [33, 56]], q + 9, 0.4)} />
    <path className="buddy-out" fill="none" d={手の線([[22, 32], [13, 28]], q + 2, 0.4)} />
    <path className="buddy-out" fill="none" d={手の線([[38, 32], [47, 28]], q + 3, 0.4)} />
    <path className="buddy-warm" d={手の形([[13, 29], [3, 20], [1, 29], [12, 33]], q + 4, 0.4)} />
    <path className="buddy-warm" d={手の形([[47, 29], [57, 20], [59, 29], [48, 33]], q + 5, 0.4)} />
    <path className="buddy-body" d={手の形([[24, 29], [30, 28], [36, 29], [39, 38], [40, 49], [30, 50], [20, 49]], q + 1, 0.9)} />
    <path className="buddy-body" d={手の形([[22, 11], [19, 2], [28, 9]], q + 6, 0.5)} />
    <path className="buddy-body" d={手の形([[37, 10], [41, 1], [32, 8]], q + 7, 0.5)} />
    <path className="buddy-body" d={手のまる(30, 17, 10, 9.5, q, { n: 13, amp: 0.9 })} />
    <g className="buddy-out buddy-drift" fill="none">
      <path d={手の線([[46, 42], [60, 40]], q + 10, 0.4)} />
      <path d={手の線([[48, 48], [62, 47]], q + 11, 0.4)} />
      <path d={手の線([[44, 54], [58, 53]], q + 12, 0.4)} />
    </g>
  </>) },
  /* ばけだぬき … **腹が大きい。**葉っぱ、丸い耳、ふくらむ腹(暖色) */
  tanuki: { solid: false, seed: 18181, 顔: { cx: 32, cy: 17, s: 0.56 }, 描く: (q) => (<>
    <path className="buddy-out" fill="none" d={手の線([[48, 46], [60, 40]], q + 5, 0.6)} />
    <path className="buddy-body" d={手の形([[21, 12], [17, 3], [27, 10]], q + 1, 0.5)} />
    <path className="buddy-body" d={手の形([[43, 11], [47, 2], [37, 9]], q + 2, 0.5)} />
    <path className="buddy-body" d={手の四角(21, 52, 28, 59, q + 7, { amp: 0.4 })} />
    <path className="buddy-body" d={手の四角(36, 52, 43, 59, q + 8, { amp: 0.4 })} />
    <path className="buddy-out" fill="none" d={手の線([[16, 34], [8, 44]], q + 9, 0.4)} />
    <path className="buddy-out" fill="none" d={手の線([[48, 34], [56, 44]], q + 10, 0.4)} />
    <path className="buddy-body" d={手のまる(32, 38, 17, 15, q + 3, { n: 13, amp: 1.2 })} />
    <path className="buddy-warm buddy-pulse" d={手のまる(32, 42, 9, 7.5, q + 6, { n: 11, amp: 0.5 })} />
    <path className="buddy-body" d={手のまる(32, 16, 11, 10, q, { n: 13, amp: 1 })} />
    <path className="buddy-body" d={手の形([[32, 6], [40, 0.5], [37, 8]], q + 4, 0.35)} />
  </>) },
}

const 考え = (face, seed) => (face === 'think' ? (
  <g className="buddy-dots">
    <path d={手のまる(53, 11, 1.6, 1.6, seed + 41, { n: 7, amp: 0.3 })} />
    <path d={手のまる(58, 7, 2, 2, seed + 42, { n: 7, amp: 0.3 })} />
    <path d={手のまる(62, 3, 2.3, 2.3, seed + 43, { n: 7, amp: 0.3 })} />
  </g>
) : null)

const きらめき = (face, seed) => (face === 'proud' ? (
  <g className="buddy-warm-line" fill="none">
    <path d={手の線([[4, 2], [4, 10]], seed + 51, 0.5)} />
    <path d={手の線([[0.5, 6], [7.5, 6]], seed + 52, 0.5)} />
    <path d={手の線([[60, 2], [60, 8]], seed + 53, 0.5)} />
    <path d={手の線([[57, 5], [63, 5]], seed + 54, 0.5)} />
  </g>
) : null)

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
