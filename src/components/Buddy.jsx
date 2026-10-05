/**
 * ============================================================================
 * **相棒**(第5.371 → 5.373 → 5.374 → 5.375 → 5.376 → **第5.377節**)
 *
 *   2026-10-05 利用者。妖怪に変えた 12 体を出したところ、こう返ってきた。
 *
 *   > 無視してます?
 *   > 添付した感じの妖怪シリーズ、18こからユーザーが選べるようにしてください
 *
 *   **題材(妖怪)は合っていた。違っていたのは、また「描き方」である。**
 *   見本の写真と並べて measure したら、別物だった。
 *
 *   | 見本 | こちら(第5.376節) |
 *   |---|---|
 *   | **線が細い**(どこも同じ太さ) | 太い(2.6)。顔だけ少し細い |
 *   | **目は小さな点**。白目もハイライトも無い | 大きな楕円 |
 *   | **鼻が無い** | 1本の線を入れていた(**illustAC のほうの作法**) |
 *   | **着物・帯・足・手が、ちゃんと在る** | ずんぐりした塊に、顔が乗っていた |
 *   | **頭は全体の1/3**。からだのこしらえで見分ける | 頭が大きく、顔で見分けていた |
 *   | **鬼火・波・雪が浮いている** | 無し |
 *
 *   **前の見本(illustAC)で足したものが、今度の見本では邪魔になった。**
 *   鼻がそれである —— 第5.375節で「いちばん効いている部分」と書いて足したが、
 *   **こちらの見本には1つも無い。** 外した。
 *   **「良いもの」ではなく「いま向かっている方へ効くか」で決める**(第5.375節)。
 *
 * ── **あの絵そのものは1つも写していない** ──────────────────
 *
 *   見本は素材サイト(PIXTA)のもので、透かしも入っていた。
 *   **妖怪は昔からある題材**なので、作風だけを合わせて描き起こしてある。
 *
 * ── 立ち姿は、**土台を共有する** ────────────────────────────
 *
 *   18 体ぶんの着物と足を1体ずつ書くと、**足した1体だけ丈が違う。**
 *   `着物()` `足()` `帯()` `腕()` を通すだけにして、
 *   **妖怪ごとの違い(角・尾・傘・鎌)だけを書く。**
 *
 * ── 顔は**1か所で描いて、どの妖怪にも乗せる** ────────────────
 *
 *   顔の置き場も大きさも妖怪ごとに違う。それでも**顔を18通り書き写さない**
 *   —— 各体が `顔: { cx, cy, s }` を1つ持ち、`Face` がそこへ描く。
 *
 *   **`<g transform="scale()">` で縮めない。** あれをやると
 *   **線の太さまで縮んで**、顔の小さい妖怪だけ線が細くなる。
 *   だから**点のほうを計算して置く**(`P()`)。線の太さは 18 体とも同じ。
 *
 *   顔の違いは1つだけ。**`形` が持つ。**
 *   ・`目数: 1` … からかさ・ひとつめこぞう(**輪 + 小さな瞳**で描く)
 *
 * ── **箱の大きさは、どの妖怪でも 1px も動かない** ──────────
 *
 *   `viewBox` は 18 体とも `0 0 64 64`。**小さいときの切り出しもしない**
 *   —— 妖怪は**立ち姿の形で見分ける**ものなので、顔だけ抜くと
 *   ぬりかべといったんもめんの区別がつかなくなる(えらぶ画面がそれである)。
 * ============================================================================
 */
import { buddyAlt, buddyBreathes } from '../lib/buddy.js'
import { BUDDY_KIND_DEFAULT, buddyKindOf } from '../lib/buddyKind.js'
import { useBuddyKind } from '../lib/useBuddyKind.js'
import { 手のまる, 手の形, 手の線, 手の四角 } from '../lib/handLine.js'

/* 顔の中の置き場。**左右をそろえない** —— 右目のほうが少し高く、少し大きい。
   この座標は「顔だけの紙」のもので、(32, 37) がまん中である。
   **目は小さな点**(見本がそうである)。大きくすると、とたんに別の作風になる */
const 目 = { lx: 26, ly: 31.5, lr: 2.5, rx: 38, ry: 30.8, rr: 2.8 }

/**
 * 6 つの顔。**笑わせない。**
 * 見分けるのは、目の形と口と「上を見ているか」だけである。
 *
 * @param {object} p
 * @param {object} p.顔 その妖怪の顔の置き場 `{ cx, cy, s, 目数 }`
 */
function Face({ face, seed, 顔 }) {
  const { cx, cy, s = 1, 目数 = 2 } = 顔
  /* 顔の紙(32, 37 がまん中)から、全身の紙へ置き直す。
     **太さは縮まない** —— 点だけを動かしている */
  const P = (x, y) => [cx + (x - 32) * s, cy + (y - 37) * s]
  const L = (pts) => pts.map(([x, y]) => P(x, y))
  const 上 = face === 'think' ? -2 : 0
  const 大 = face === 'cheer' ? 1.2 : 1
  const 閉じ目 = face === 'glad' || face === 'proud'
  const 瞬き = face === 'rest' ? 'buddy-blink' : undefined
  const 一つ目 = 目数 === 1
  const [ex, ey] = P(32, 30.8 + 上)
  const [lx, ly] = P(目.lx, 目.ly + 上)
  const [rx, ry] = P(目.rx, 目.ry + 上)
  return (
    <>
      {閉じ目 ? (
        <g className="buddy-ink2" fill="none">
          {一つ目 ? (
            <path d={手の線(L([[27, 31], [32, 27.5], [37, 31.5]]), seed + 31, 0.4)} />
          ) : (
            <>
              <path d={手の線(L([[目.lx - 3.2, 目.ly + 0.8], [目.lx, 目.ly - 2.2], [目.lx + 3.2, 目.ly + 0.5]]), seed + 31, 0.4)} />
              <path d={手の線(L([[目.rx - 3.6, 目.ry + 0.5], [目.rx, 目.ry - 2.5], [目.rx + 3.6, 目.ry + 1]]), seed + 32, 0.4)} />
            </>
          )}
        </g>
      ) : 一つ目 ? (
        /* **ひとつ目は、輪と小さな瞳。** 見本の一つ目もこの描き方である。
           **瞳も `<g className="buddy-ink">` で包む** —— 2つ目のときと
           包み方が違うと、**目を数える見張りがここだけ素通りする**
           (作った日に、そうなった・第5.377節) */
        <>
          <path className="buddy-out" fill="none"
                d={手のまる(ex, ey, 4.6 * s * 大, 4.8 * s * 大, seed + 10, { n: 11, amp: 0.4 })} />
          <g className="buddy-ink">
            <path className={瞬き}
                  d={手のまる(ex, ey, 2 * s * 大, 2.1 * s * 大, seed + 11, { n: 8, amp: 0.3 })} />
          </g>
        </>
      ) : (
        <g className="buddy-ink">
          {/* **左右で大きさも高さも違う。** そろえると、とたんに機械の絵になる */}
          <path className={瞬き}
                d={手のまる(lx, ly, 目.lr * s * 大, (目.lr + 0.3) * s * 大, seed + 11, { n: 8, amp: 0.35 })} />
          <path className={瞬き}
                d={手のまる(rx, ry, (目.rr + 0.2) * s * 大, 目.rr * s * 大, seed + 12, { n: 8, amp: 0.35 })} />
        </g>
      )}
      {/* ★ **鼻は描かない。** 見本に1つも無い(第5.377節)。
            てんぐの長い鼻だけは、妖怪そのものの形なので `形` が持つ */}
      <Mouth face={face} seed={seed} P={P} L={L} s={s} />
    </>
  )
}

function Mouth({ face, seed, P, L, s }) {
  /* 口は**小さい。**にっこりさせない(見本は、どれも真顔である) */
  if (face === 'listen') {
    const [mx, my] = P(32, 43.5)
    return <path className="buddy-ink" d={手のまる(mx, my, 2.2 * s, 2.6 * s, seed + 21, { n: 8, amp: 0.3 })} />
  }
  if (face === 'cheer') {
    return <path className="buddy-ink"
                 d={手の形(L([[28, 41.5], [32, 42.5], [36, 41.5], [34.5, 46.5], [32, 47.5], [29.5, 46]]), seed + 22, 0.5)} />
  }
  if (face === 'glad' || face === 'proud') {
    return <path className="buddy-ink2" fill="none"
                 d={手の線(L([[28.5, 42], [30.5, 44.5], [33.5, 44.8], [36, 42.5]]), seed + 23, 0.4)} />
  }
  if (face === 'think') {
    return <path className="buddy-ink2" fill="none"
                 d={手の線(L([[29, 44], [31, 42.5], [33, 44.3], [35.5, 42.8]]), seed + 24, 0.4)} />
  }
  return <path className="buddy-ink2" fill="none"
               d={手の線(L([[29.5, 43.2], [32, 43.8], [34.5, 43]]), seed + 25, 0.4)} />
}

/* ══ 立ち姿の土台 ════════════════════════════════════════════
   **18 体ぶんの着物と足を1体ずつ書かない。** 足した1体だけ丈が違う ——
   並べたときに、そこだけ座りが悪くなる。
   妖怪ごとの違い(角・尾・傘・鎌)だけを、各体が書く */

/** 着物。肩から裾へ、少し広がる */
const 着物 = (q, { 上 = 31, 下 = 51, 肩 = 9, 裾 = 13 } = {}) => (
  <path className="buddy-body" d={手の形([
    [32 - 肩, 上], [32, 上 - 0.8], [32 + 肩, 上],
    [32 + (肩 + 裾) / 2, (上 + 下) / 2], [32 + 裾, 下],
    [32, 下 + 1], [32 - 裾, 下], [32 - (肩 + 裾) / 2, (上 + 下) / 2],
  ], q + 61, 0.9)} />
)

/** 足。**着物より先に描く**(裾が、足の付け根を隠す) */
const 足 = (q, y = 51) => (
  <>
    <path className="buddy-body" d={手の四角(25, y, 30.5, y + 5, q + 62, { amp: 0.4 })} />
    <path className="buddy-body" d={手の四角(33.5, y, 39, y + 5, q + 63, { amp: 0.4 })} />
  </>
)

/** 帯。**濃く塗る**(見本の着物には、たいてい帯がある) */
const 帯 = (q, y = 40) => (
  <path className="buddy-band" d={手の四角(22, y, 42, y + 4.5, q + 64, { amp: 0.35 })} />
)

/** 腕と手。**着物より先に描く** */
const 腕 = (q, { 上 = 34, 下 = 42, 肩 = 9, 先 = 14 } = {}) => (
  <>
    <path className="buddy-out" fill="none" d={手の線([[32 - 肩, 上], [32 - 先, 下]], q + 65, 0.4)} />
    <path className="buddy-out" fill="none" d={手の線([[32 + 肩, 上], [32 + 先, 下]], q + 66, 0.4)} />
    <path className="buddy-body" d={手のまる(32 - 先, 下 + 1.5, 2.4, 2.4, q + 67, { n: 8, amp: 0.25 })} />
    <path className="buddy-body" d={手のまる(32 + 先, 下 + 1.5, 2.4, 2.4, q + 68, { n: 8, amp: 0.25 })} />
  </>
)

/** 鬼火(ひとだま)。幽霊のそばに浮く小さな炎 */
const 鬼火 = (q, x, y, 大 = 1) => (
  <path className="buddy-out" fill="none" d={手の形([
    [x, y - 4 * 大], [x + 2.2 * 大, y], [x + 1.4 * 大, y + 3.4 * 大],
    [x - 1.4 * 大, y + 3.4 * 大], [x - 2.2 * 大, y],
  ], q, 0.35)} />
)

/* ══ 18 体の妖怪 ═══════════════════════════════════════════════
   `solid` … 塗りつぶし。2体だけ ——
             見本も、黒い塊は海坊主とぬりかべくらいである
   `顔`    … 顔の置き場。`s` は顔の大きさ(線の太さは縮まない)
   描く順は**奥から手前**。うしろのものを先に置く */
const 形 = {
  /* かっぱ … 頭の皿・甲羅 */
  kappa: { solid: false, seed: 1101, 顔: { cx: 32, cy: 21, s: 0.64 }, 描く: (q) => (<>
    {足(q, 50)}
    {腕(q, { 上: 34, 下: 43, 肩: 10, 先: 16 })}
    <path className="buddy-body" d={手のまる(32, 40, 11.5, 10, q + 1, { n: 12, amp: 0.9 })} />
    <path className="buddy-body" d={手のまる(32, 20, 11.5, 11, q, { n: 13, amp: 1 })} />
    <path className="buddy-body" d={手のまる(32, 9.5, 8.5, 3, q + 2, { n: 11, amp: 0.4 })} />
    <path className="buddy-out" fill="none" d={手の線([[25, 9.5], [32, 11.5], [39, 9.5]], q + 3, 0.3)} />
  </>) },
  /* おに … 2本の角・虎の腰巻・金棒 */
  oni: { solid: false, seed: 2202, 顔: { cx: 32, cy: 21, s: 0.64 }, 描く: (q) => (<>
    {足(q)}
    {腕(q)}
    <path className="buddy-body" d={手の形([[23, 13], [21, 5], [22.6, 4.4], [27, 8], [30, 11]], q + 1, 0.4)} />
    <path className="buddy-body" d={手の形([[41, 12], [43, 4], [41.4, 3.4], [37, 7], [34, 10]], q + 2, 0.4)} />
    {着物(q)}
    {帯(q)}
    <path className="buddy-body" d={手のまる(32, 20, 11.5, 11, q, { n: 13, amp: 1 })} />
    <path className="buddy-out" fill="none" d={手の線([[47, 36], [47, 52]], q + 4, 0.4)} />
    <path className="buddy-body" d={手の四角(43, 22, 51, 37, q + 3, { amp: 0.4 })} />
  </>) },
  /* てんぐ … **長い鼻**・兜巾・羽 */
  tengu: { solid: false, seed: 3303, 顔: { cx: 30, cy: 21, s: 0.6 }, 描く: (q) => (<>
    {足(q)}
    {腕(q)}
    <path className="buddy-body" d={手の形([[23, 33], [11, 26], [7, 36], [21, 40]], q + 3, 0.8)} />
    <path className="buddy-body" d={手の形([[41, 33], [53, 26], [57, 36], [43, 40]], q + 4, 0.8)} />
    {着物(q)}
    {帯(q)}
    <path className="buddy-body" d={手のまる(30, 20, 11, 10.5, q, { n: 13, amp: 1 })} />
    <path className="buddy-body" d={手の形([[29, 8], [32, 4], [35, 8], [34, 10.5], [30, 10.5]], q + 2, 0.4)} />
    <path className="buddy-body" d={手の形([[32, 23], [35, 22], [48, 28], [44, 32]], q + 1, 0.7)} />
  </>) },
  /* ゆきおんな … 長い髪・裾のない着物(浮いている)・雪 */
  yuki: { solid: false, seed: 4404, 顔: { cx: 32, cy: 21, s: 0.62 }, 描く: (q) => (<>
    {腕(q, { 上: 34, 下: 45, 肩: 8, 先: 13 })}
    <path className="buddy-body" d={手の形([[23, 31], [32, 30], [41, 31], [43, 42], [45, 56], [32, 60], [19, 56], [21, 42]], q + 1, 1)} />
    <path className="buddy-body" d={手の形([[32, 8], [22, 11], [17, 19], [18, 44], [23, 36], [26, 46], [29, 24]], q + 2, 0.9)} />
    <path className="buddy-body" d={手の形([[32, 8], [42, 11], [47, 19], [46, 44], [41, 36], [38, 46], [35, 24]], q + 3, 0.9)} />
    <path className="buddy-body" d={手のまる(32, 20, 11, 10.5, q, { n: 13, amp: 0.9 })} />
    <path className="buddy-out" fill="none" d={手のまる(8, 26, 1.6, 1.6, q + 4, { n: 7, amp: 0.3 })} />
    <path className="buddy-out" fill="none" d={手のまる(56, 22, 1.4, 1.4, q + 5, { n: 7, amp: 0.3 })} />
    <path className="buddy-out" fill="none" d={手のまる(10, 47, 1.5, 1.5, q + 6, { n: 7, amp: 0.3 })} />
    <path className="buddy-out" fill="none" d={手のまる(55, 44, 1.6, 1.6, q + 7, { n: 7, amp: 0.3 })} />
  </>) },
  /* からかさ … **ひとつ目**・長い舌・1本足の下駄 */
  kasa: { solid: false, seed: 5505, 顔: { cx: 32, cy: 19.5, s: 0.78, 目数: 1 }, 描く: (q) => (<>
    <path className="buddy-out" fill="none" d={手の線([[32, 29], [32, 45]], q + 4, 0.4)} />
    <path className="buddy-out" fill="none" d={手の線([[27, 51], [27, 57]], q + 6, 0.4)} />
    <path className="buddy-out" fill="none" d={手の線([[37, 51], [37, 57]], q + 7, 0.4)} />
    <path className="buddy-body" d={手の四角(23, 46, 41, 51, q + 5, { amp: 0.4 })} />
    <path className="buddy-body" d={手の形([[32, 5], [48, 16], [54, 28], [42, 26], [32, 30], [22, 26], [10, 28], [16, 16]], q, 1.1)} />
    <path className="buddy-out" fill="none" d={手の線([[32, 7], [22, 26]], q + 1, 0.5)} />
    <path className="buddy-out" fill="none" d={手の線([[32, 7], [42, 26]], q + 2, 0.5)} />
    <path className="buddy-body" d={手の形([[29, 28], [35, 28], [32, 39]], q + 3, 0.6)} />
  </>) },
  /* ざしきわらし … おかっぱ(塗りつぶした髪)・着物 */
  zashiki: { solid: false, seed: 6606, 顔: { cx: 32, cy: 22, s: 0.62 }, 描く: (q) => (<>
    {足(q)}
    {腕(q)}
    {着物(q)}
    {帯(q)}
    <path className="buddy-body" d={手のまる(32, 20, 11, 10.5, q, { n: 13, amp: 1 })} />
    <path className="buddy-ink" d={手の形([[32, 7], [44, 12], [45, 26], [41, 16], [32, 13], [23, 16], [19, 26], [20, 12]], q + 3, 0.8)} />
  </>) },
  /* ぬりかべ … **壁そのもの。** 小さな手足だけが出ている。
     角に点を1つずつ置くと**楕円になって、壁に見えなかった**(`手の四角`) */
  nurikabe: { solid: true, seed: 7707, 顔: { cx: 32, cy: 29, s: 0.82 }, 描く: (q) => (<>
    <path className="buddy-out" fill="none" d={手の線([[11, 30], [4, 36]], q + 1, 0.5)} />
    <path className="buddy-out" fill="none" d={手の線([[53, 30], [60, 36]], q + 2, 0.5)} />
    <path className="buddy-body" d={手の四角(19, 47, 26, 56, q + 3, { amp: 0.5 })} />
    <path className="buddy-body" d={手の四角(38, 47, 45, 56, q + 4, { amp: 0.5 })} />
    <path className="buddy-body" d={手の四角(11, 13, 53, 48, q, { amp: 1.2, 刻み: 4 })} />
  </>) },
  /* ろくろくび … **首が長く、うねっている。**座った着物。
     うねりを大きくすると、**左右の縁が交わって結び目になる** */
  rokuro: { solid: false, seed: 8808, 顔: { cx: 31, cy: 16, s: 0.55 }, 描く: (q) => (<>
    <path className="buddy-body" d={手の形([[20, 45], [32, 44], [44, 45], [47, 52], [49, 59], [32, 61], [15, 59], [17, 52]], q + 1, 1)} />
    {帯(q, 50)}
    <path className="buddy-body" d={手の形([[29, 46], [26, 38], [33, 30], [28, 23], [35, 23], [40, 30], [34, 38], [36, 46]], q + 3, 0.7)} />
    <path className="buddy-body" d={手のまる(31, 15, 10, 9.5, q, { n: 13, amp: 0.8 })} />
  </>) },
  /* ばけねこ … 耳・**2本の尾**(ねこまた)・ひげ */
  bakeneko: { solid: false, seed: 9909, 顔: { cx: 32, cy: 19, s: 0.62 }, 描く: (q) => (<>
    <path className="buddy-out" fill="none" d={手の線([[44, 48], [56, 42], [54, 31]], q + 3, 0.7)} />
    <path className="buddy-out" fill="none" d={手の線([[44, 51], [58, 50], [60, 39]], q + 4, 0.7)} />
    <path className="buddy-body" d={手の形([[21, 14], [18, 4], [28, 10]], q + 1, 0.6)} />
    <path className="buddy-body" d={手の形([[43, 13], [46, 3], [36, 10]], q + 2, 0.6)} />
    <path className="buddy-body" d={手の形([[23, 31], [32, 30], [41, 31], [44, 43], [46, 55], [32, 57], [18, 55], [20, 43]], q + 5, 1)} />
    <path className="buddy-body" d={手のまる(32, 19, 12, 10.5, q, { n: 13, amp: 1 })} />
    <path className="buddy-out" fill="none" d={手の線([[19, 20], [10, 17]], q + 6, 0.5)} />
    <path className="buddy-out" fill="none" d={手の線([[19, 24], [10, 25]], q + 7, 0.5)} />
    <path className="buddy-out" fill="none" d={手の線([[45, 20], [54, 17]], q + 8, 0.5)} />
    <path className="buddy-out" fill="none" d={手の線([[45, 24], [54, 25]], q + 9, 0.5)} />
  </>) },
  /* こなきじじい … 赤子のからだに老人の顔。あごひげ・まばらな毛・涙 */
  konaki: { solid: false, seed: 10101, 顔: { cx: 32, cy: 19, s: 0.62 }, 描く: (q) => (<>
    {足(q)}
    {腕(q)}
    {着物(q)}
    {帯(q)}
    <path className="buddy-body" d={手の形([[27, 26], [32, 25], [37, 26], [35, 34], [32, 39], [29, 34]], q + 3, 0.6)} />
    <path className="buddy-body" d={手のまる(32, 18, 11.5, 10.5, q, { n: 13, amp: 1 })} />
    <path className="buddy-out" fill="none" d={手の線([[27, 8], [26, 3]], q + 4, 0.4)} />
    <path className="buddy-out" fill="none" d={手の線([[32, 7], [33, 2]], q + 5, 0.4)} />
    <path className="buddy-out" fill="none" d={手の線([[37, 8], [39, 3]], q + 6, 0.4)} />
    <path className="buddy-out" fill="none" d={手の形([[21, 22], [24, 22], [22.5, 29]], q + 7, 0.4)} />
    <path className="buddy-out" fill="none" d={手の形([[40, 21], [43, 21], [41.5, 28]], q + 8, 0.4)} />
  </>) },
  /* いったんもめん … **布そのもの。**1枚のうねった布に顔と手がある */
  momen: { solid: false, seed: 11111, 顔: { cx: 30, cy: 18, s: 0.62 }, 描く: (q) => (<>
    <path className="buddy-out" fill="none" d={手の線([[16, 26], [8, 31]], q + 3, 0.5)} />
    <path className="buddy-out" fill="none" d={手の線([[46, 24], [54, 29]], q + 4, 0.5)} />
    <path className="buddy-body" d={手のまる(7, 32, 2.6, 2.6, q + 5, { n: 8, amp: 0.25 })} />
    <path className="buddy-body" d={手のまる(55, 30, 2.6, 2.6, q + 6, { n: 8, amp: 0.25 })} />
    <path className="buddy-body" d={手の形([[18, 6], [14, 18], [22, 30], [13, 42], [22, 56], [42, 54], [38, 42], [48, 30], [42, 17], [47, 6]], q, 1.2)} />
    <path className="buddy-out" fill="none" d={手の線([[19, 38], [28, 42], [36, 38]], q + 1, 0.5)} />
    <path className="buddy-out" fill="none" d={手の線([[21, 49], [29, 53], [37, 49]], q + 2, 0.5)} />
  </>) },
  /* ひとつめこぞう … **ひとつ目**・長い舌・ちょんまげ */
  hitotsume: { solid: false, seed: 12121, 顔: { cx: 32, cy: 19, s: 0.66, 目数: 1 }, 描く: (q) => (<>
    {足(q)}
    {腕(q)}
    {着物(q)}
    {帯(q)}
    <path className="buddy-body" d={手のまる(32, 19, 12, 11, q, { n: 13, amp: 1 })} />
    <path className="buddy-ink" d={手のまる(32, 6, 2.8, 2.4, q + 4, { n: 9, amp: 0.3 })} />
    <path className="buddy-body" d={手の形([[29.5, 27], [34.5, 27], [32, 38]], q + 5, 0.6)} />
  </>) },
  /* きゅうび … **九尾のきつね。**四つ足で、尾が扇のように広がる */
  kitsune: { solid: false, seed: 13131, 顔: { cx: 20, cy: 27, s: 0.5 }, 描く: (q) => (<>
    <path className="buddy-body" d={手の形([[38, 40], [38, 16], [46, 19], [43, 42]], q + 1, 0.7)} />
    <path className="buddy-body" d={手の形([[39, 42], [48, 19], [54, 25], [44, 45]], q + 2, 0.7)} />
    <path className="buddy-body" d={手の形([[40, 44], [55, 28], [59, 37], [45, 48]], q + 3, 0.7)} />
    <path className="buddy-body" d={手の形([[40, 46], [58, 41], [58, 50], [44, 52]], q + 4, 0.7)} />
    <path className="buddy-body" d={手の四角(20, 48, 25, 55, q + 9, { amp: 0.4 })} />
    <path className="buddy-body" d={手の四角(32, 48, 37, 55, q + 10, { amp: 0.4 })} />
    <path className="buddy-body" d={手の形([[15, 38], [26, 33], [38, 34], [44, 42], [40, 50], [24, 51], [12, 47]], q + 6, 0.9)} />
    <path className="buddy-body" d={手の形([[13, 20], [11, 10], [20, 17]], q + 7, 0.5)} />
    <path className="buddy-body" d={手の形([[26, 19], [30, 9], [21, 16]], q + 8, 0.5)} />
    <path className="buddy-body" d={手のまる(20, 26, 10, 9.5, q, { n: 13, amp: 0.9 })} />
  </>) },
  /* うみぼうず … **黒い坊主。**波から立ち上がり、両腕を上げている */
  umibozu: { solid: true, seed: 14141, 顔: { cx: 32, cy: 26, s: 0.8 }, 描く: (q) => (<>
    <path className="buddy-body" d={手の形([[16, 32], [6, 20], [2, 25], [12, 38]], q + 2, 0.7)} />
    <path className="buddy-body" d={手の形([[48, 32], [58, 20], [62, 25], [52, 38]], q + 3, 0.7)} />
    <path className="buddy-body" d={手の形([[32, 7], [47, 16], [51, 33], [49, 48], [32, 50], [15, 48], [13, 33], [17, 16]], q, 1.2)} />
    <path className="buddy-out" fill="none" d={手の線([[3, 52], [13, 48], [23, 53], [33, 48], [43, 53], [53, 48], [61, 52]], q + 1, 0.5)} />
    <path className="buddy-out" fill="none" d={手の線([[5, 59], [15, 55], [25, 60], [35, 55], [45, 60], [55, 55], [62, 59]], q + 4, 0.5)} />
  </>) },
  /* とうふこぞう … 笠をかぶり、**お盆に豆腐**をのせて立っている */
  toufu: { solid: false, seed: 15151, 顔: { cx: 32, cy: 23, s: 0.58 }, 描く: (q) => (<>
    {足(q)}
    {着物(q, { 上: 32, 下: 51, 肩: 8, 裾: 12 })}
    {帯(q, 41)}
    <path className="buddy-body" d={手のまる(32, 22, 10.5, 10, q, { n: 13, amp: 0.9 })} />
    <path className="buddy-body" d={手の形([[32, 5], [48, 17], [16, 17]], q + 1, 0.8)} />
    <path className="buddy-out" fill="none" d={手の線([[25, 34], [22, 42]], q + 2, 0.4)} />
    <path className="buddy-out" fill="none" d={手の線([[39, 34], [42, 42]], q + 3, 0.4)} />
    <path className="buddy-body" d={手の四角(27, 37, 37, 43, q + 5, { amp: 0.3 })} />
    <path className="buddy-body" d={手の四角(20, 43, 44, 47, q + 4, { amp: 0.35 })} />
  </>) },
  /* ゆうれい … 三角の額当て・長い髪・足が無い・両手を垂らす・鬼火 */
  yurei: { solid: false, seed: 16161, 顔: { cx: 32, cy: 20, s: 0.6 }, 描く: (q) => (<>
    <path className="buddy-out" fill="none" d={手の線([[24, 33], [16, 39], [18, 45]], q + 3, 0.5)} />
    <path className="buddy-out" fill="none" d={手の線([[40, 33], [48, 39], [46, 45]], q + 4, 0.5)} />
    <path className="buddy-body" d={手の形([[23, 30], [32, 29], [41, 30], [44, 42], [39, 55], [32, 61], [25, 55], [20, 42]], q + 2, 1)} />
    <path className="buddy-body" d={手の形([[32, 8], [21, 12], [16, 22], [19, 40], [24, 30], [27, 38], [29, 20]], q + 5, 0.9)} />
    <path className="buddy-body" d={手の形([[32, 8], [43, 12], [48, 22], [45, 40], [40, 30], [37, 38], [35, 20]], q + 6, 0.9)} />
    <path className="buddy-body" d={手のまる(32, 19, 10.5, 10, q, { n: 13, amp: 0.9 })} />
    <path className="buddy-body" d={手の形([[32, 5], [37, 13], [27, 13]], q + 1, 0.4)} />
    {鬼火(q + 7, 7, 20)}
    {鬼火(q + 8, 57, 15, 0.85)}
  </>) },
  /* かまいたち … **鎌の腕**を持ったいたち。風の線が走る */
  kamaitachi: { solid: false, seed: 17171, 顔: { cx: 32, cy: 19, s: 0.6 }, 描く: (q) => (<>
    {足(q, 50)}
    <path className="buddy-out" fill="none" d={手の線([[23, 33], [14, 30]], q + 2, 0.5)} />
    <path className="buddy-out" fill="none" d={手の線([[41, 33], [50, 30]], q + 3, 0.5)} />
    <path className="buddy-body" d={手の形([[14, 31], [4, 23], [3, 31], [13, 34]], q + 4, 0.5)} />
    <path className="buddy-body" d={手の形([[50, 31], [60, 23], [61, 31], [51, 34]], q + 5, 0.5)} />
    <path className="buddy-body" d={手の形([[24, 30], [32, 29], [40, 30], [43, 41], [45, 52], [32, 54], [19, 52], [21, 41]], q + 1, 1)} />
    <path className="buddy-body" d={手の形([[23, 13], [20, 4], [29, 10]], q + 6, 0.5)} />
    <path className="buddy-body" d={手の形([[41, 12], [44, 3], [35, 10]], q + 7, 0.5)} />
    <path className="buddy-body" d={手のまる(32, 18, 10.5, 10, q, { n: 13, amp: 0.9 })} />
    <path className="buddy-out" fill="none" d={手の線([[48, 8], [59, 6]], q + 8, 0.5)} />
    <path className="buddy-out" fill="none" d={手の線([[50, 14], [61, 13]], q + 9, 0.5)} />
  </>) },
  /* ばけだぬき … 大きな腹・頭に葉っぱ・丸い耳 */
  tanuki: { solid: false, seed: 18181, 顔: { cx: 32, cy: 19, s: 0.62 }, 描く: (q) => (<>
    {足(q, 50)}
    <path className="buddy-out" fill="none" d={手の線([[46, 45], [56, 41]], q + 5, 0.6)} />
    <path className="buddy-body" d={手の形([[22, 13], [19, 5], [28, 11]], q + 1, 0.5)} />
    <path className="buddy-body" d={手の形([[42, 12], [45, 4], [36, 11]], q + 2, 0.5)} />
    <path className="buddy-body" d={手のまる(32, 39, 14.5, 12.5, q + 3, { n: 12, amp: 1 })} />
    <path className="buddy-out" fill="none" d={手のまる(32, 42, 7.5, 6, q + 6, { n: 10, amp: 0.4 })} />
    <path className="buddy-body" d={手のまる(32, 18, 11, 10, q, { n: 13, amp: 0.9 })} />
    <path className="buddy-body" d={手の形([[32, 8], [39, 2], [36, 9]], q + 4, 0.4)} />
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
  <g className="buddy-out" fill="none">
    <path d={手の線([[5, 3], [5, 11]], seed + 51, 0.5)} />
    <path d={手の線([[1, 7], [9, 7]], seed + 52, 0.5)} />
    <path d={手の線([[59, 3], [59, 9]], seed + 53, 0.5)} />
    <path d={手の線([[56, 6], [62, 6]], seed + 54, 0.5)} />
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
