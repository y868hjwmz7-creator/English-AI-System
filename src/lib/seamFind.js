/**
 * **継ぎ目を、音声そのものから測る**(2026-09 実機・17手め)。
 *
 * ══════════════════════════════════════════════════════════════════
 * ## なぜ要るのか —— 16手めは、この教材では**1ミリ秒も効いていなかった**
 *
 *   > まだ、というよりも前回とズレ方に違いがない、
 *   > または体感できる変化がありません。
 *
 * 利用者の言うとおりだった。**手を動かす前に数字で確かめた。**
 * 実機の教材(14発言 / 控え 88.40 秒 / 音声 89.73 秒 / 継ぎ目 0.00)を
 * そのまま作って `landSec()` に通すと、
 *
 *     継ぎ目のぶん(`shiftSeams`)  … 0.1023 秒
 *     頼む先 `landSec(s, 0.1023)` … **s − 0.02**(＝ `SEEK_LEAD`)
 *
 * `landSec` が逃がすのは **間(ま)が `SEEK_LEAD + SEEK_MISS` より
 * 狭いときだけ**である。ここは 0.1023 秒あるので**枝に入らない。**
 * 15手め(1枚)でも 16手め(3枚)でも、**返す値は同じ s − 0.02** ——
 * つまり **14手め以降、この教材のために何も変わっていなかった。**
 *
 * ## だから、残っているのは「頼む先」ではなく「時計」である
 *
 * 14手めは、数え落とされた 1.33 秒を**継ぎ目に均等に**配った
 * (13 本 × 0.102 秒)。ところが ElevenLabs の間は**継ぎ目ごとに違う。**
 *
 *     ある継ぎ目の本当の間が 0.04 秒だったら
 *       → こちらの時計は「前の声は 0.102 秒前に終わっている」と言う
 *       → s − 0.02 を頼むと、**前の声の中に 0.04 秒ぶん入る**
 *
 * **均等に配るかぎり、継ぎ目ごとのずれは残る。**
 * 利用者の「ダメな文と大丈夫な文がある」と、そのまま合う。
 *
 * ## 推測をやめる。**音を測る**
 *
 * 間がどこにあるかは、**音声そのものが知っている。**
 * MP3 をほどいて、静かなところを数えれば、継ぎ目の本当の位置が出る。
 *
 *   - **これは測るためだけの処理である。鳴らす音には一切かからない**
 *     (`loudness.js` の `weighted()` と同じ立場。CLAUDE.md
 *      「測る側で Web Audio を使うのは構わない」)
 *   - **窓口を1回も呼ばない = 0円。** MP3 は鳴らすために
 *     どのみち落としているので、**通信も起きない**(端末の控えが効く)
 *   - **測れなければ `null`。** これまでどおり均等に配る
 *     (**行き止まりを作らない**)
 *
 * ## ここには何も持ち込まない(素の node で走る)
 *
 * `playMark.js` / `mp3Join.js` / `focusChunks.js` と同じ考え方。
 * Supabase も `import.meta.env` も Web Audio も持たないので、
 * `npm run test:mp3` が**作った波形で1つずつ確かめられる。**
 * ══════════════════════════════════════════════════════════════════
 */

/** 何秒ごとに大きさを測るか */
export const HOP_SEC = 0.01

/** いちばん大きいところから、これだけ下なら「静か」 */
export const QUIET_RATIO = 0.03

/** どんなに静かでも、これより下は測り損ねとみなさない */
export const ABS_FLOOR = 0.0008

/** これより短い静けさは、間ではない(語と語のあいだ) */
export const MIN_SILENCE = 0.05

/** これより短い音は、声ではない(ノイズ・リップノイズ) */
export const MIN_SPEECH = 0.06

/** 前の発言の終わりから、これだけ手前までは「次の発言」とみなす */
export const SEAM_TOL = 0.08

/** 継ぎ目の間が、これより広いことはない */
export const MAX_GAP = 2.5

/** ずれがこれを超えたら、測り損ねている */
export const MAX_OFF = 3

/** これだけの割合が素直に当たらなければ、測れたことにしない */
export const MIN_HIT = 0.7

/**
 * **静けさの底を、下から何%のところで見るか**(31手め)。
 *
 * 平均でも中央値でもなく**下から10%**にするのは、
 * 音声のほとんどが声で埋まっていても、いちばん静かな1割は
 * 「さーっ」だけが残っているところだからである。
 */
export const FLOOR_PCT = 0.1

/**
 * **試すしきい値**(2026-09・30手め → 31手め で**梯子**にした)。
 *
 * 30手めは「別のしきい値なら何本に分かれるか」を**数えるだけ**だった。
 * ところが `[調査中]` を待つあいだ、利用者は何も変わらない画面を
 * 使い続けることになる。**数えられるなら、その場で試せばよい。**
 *
 * `measureSeams()` が上から順に試し、**最初に測れたもの**を採る。
 * `rms` はもう出してあるので、**通信も費用も1ミリも増えない**
 * (窓口を1回も呼ばない = 0円)。
 *
 * **いちばん上は `QUIET_RATIO` そのもの**なので、
 * **いままで測れていた教材は、1本目でそのまま測れる**
 * (2本目以降に降りるのは、いままで**測れていなかった**ものだけ)。
 */
export const TRY_RATIOS = [QUIET_RATIO, 0.08, 0.16]

/**
 * **直近の測り損ねの理由**(2026-09・30手め)。
 *
 * 17手めは `null` を返すだけで、`[調査中]` の行には
 * 「継ぎ目を数え切れませんでした」としか出していなかった。
 * **なぜ数え切れなかったのかは、どこにも出ていない。**
 * 11手め(「道が2つあるものは、どちらを通ったかを見えるようにしてから
 * 直す」)と、まったく同じ抜けを1段下でやっていた。
 *
 * **書くだけ。読む側の判断には一切使わない**ので、
 * `loudness.js` で踏んだ「モジュールに残って2つめ以降が素通りする」
 * 落とし穴には当たらない(呼ぶたびに必ず上書きする)。
 *
 * @returns {{why:string, runs:number, tries?:Array<{q:number,n:number}>}|null}
 */
let failWhy = null
export const lastSeamFail = () => failWhy

/**
 * 10ms ごとの大きさ(RMS)を出す。
 *
 * **耳の重み付け(K特性)は掛けない。** あれは「どれくらい大きく
 * 聞こえるか」を測るためのもので、こちらが知りたいのは
 * **鳴っているか・黙っているか**だけである。掛けるには Web Audio が要り、
 * ここが素の node で走らなくなる。
 *
 * @param {Float32Array|number[]} samples 波(1ch)
 * @param {number} rate 1秒あたりの点の数
 * @param {number} [hop] 何秒ごとに測るか
 * @returns {Float32Array} 1コマぶんの大きさ
 */
export function frameRms(samples, rate, hop = HOP_SEC) {
  const n = samples?.length | 0
  const r = Number(rate) || 0
  if (!n || r <= 0) return new Float32Array(0)
  const step = Math.max(1, Math.round(r * hop))
  const out = new Float32Array(Math.ceil(n / step))
  for (let i = 0, k = 0; i < n; i += step, k += 1) {
    const to = Math.min(n, i + step)
    let sum = 0
    for (let j = i; j < to; j += 1) {
      const v = samples[j]
      sum += v * v
    }
    out[k] = Math.sqrt(sum / Math.max(1, to - i))
  }
  return out
}

/**
 * **静けさの底**(2026-09・31手め)。下から `FLOOR_PCT` のところ。
 *
 * 雑音の乗った音声では、**いちばん静かなところでも 0 ではない。**
 * その高さを知らずにピークからだけ境目を決めると、
 * **音声ぜんぶが1つのかたまり**になり、継ぎ目が1本も見つからない。
 *
 * @param {Float32Array|number[]} rms
 * @returns {number} 底(0 以上)
 */
export function noiseFloor(rms) {
  const n = rms?.length | 0
  if (!n) return 0
  const a = Float64Array.from(rms)
  a.sort()
  const floor = a[Math.min(n - 1, Math.floor(n * FLOOR_PCT))]
  return Number.isFinite(floor) && floor > 0 ? floor : 0
}

/**
 * 「静か」の境目。**底とピークのあいだで決める。**
 *
 * 決め打ちの値にすると、小さく録れた声で本文まるごとが静かになる。
 *
 * ## **底が 0 に近ければ、いままでとまったく同じ値である**(31手め)
 *
 *     底 ≒ 0 のとき … 0 + (ピーク − 0) × ratio = ピーク × ratio
 *
 * つまり**きれいに録れた音声では、この直しは1ミリも効かない**
 * (いままで測れていたものが、これで壊れることはない)。
 * 効くのは**雑音が乗っていて、底が持ち上がっている**ときだけである。
 *
 * @param {Float32Array|number[]} rms
 * @param {number} [ratio] 底からピークまでの、どれだけ上を境目にするか
 */
export function quietLevel(rms, ratio = QUIET_RATIO) {
  let peak = 0
  for (let i = 0; i < rms.length; i += 1) if (rms[i] > peak) peak = rms[i]
  const q = Number.isFinite(ratio) ? ratio : QUIET_RATIO
  /* **底を頭打ちにしない。** ほとんど間の無い音声では、底が
     ふつうの声の高さまで来ることがある。すると境目も上がって
     細かく刻まれるが、**短い音は `MIN_SPEECH` が落とす**ので
     run が足りなくなり、**これまでどおり `null` に落ちる**だけである
     (行き止まりを作らない)。**確かめられない歯止めを置かない** */
  const floor = noiseFloor(rms)
  return Math.max(floor + (peak - floor) * q, ABS_FLOOR)
}

/**
 * 鳴っているところ(声の run)を並べて返す。
 *
 * **短い静けさでは切らない**(語と語のあいだで刻まれる)。
 * **短い音は落とす**(リップノイズを1つの発言と数えない)。
 *
 * @returns {Array<{from:number,to:number}>} 秒
 */
export function speechRuns(rms, hop = HOP_SEC, {
  level = null, minSilence = MIN_SILENCE, minSpeech = MIN_SPEECH,
} = {}) {
  if (!rms?.length) return []
  const cut = Number.isFinite(level) ? level : quietLevel(rms)
  const gapFrames = Math.max(1, Math.round(minSilence / hop))
  const runs = []
  let from = -1
  let quiet = 0
  for (let i = 0; i < rms.length; i += 1) {
    if (rms[i] >= cut) {
      if (from < 0) from = i
      quiet = 0
    } else if (from >= 0) {
      quiet += 1
      if (quiet >= gapFrames) {
        runs.push({ from: from * hop, to: (i - quiet + 1) * hop })
        from = -1
        quiet = 0
      }
    }
  }
  if (from >= 0) runs.push({ from: from * hop, to: rms.length * hop })
  return runs.filter((r) => r.to - r.from >= minSpeech)
}

/**
 * **控えの区間を、測った継ぎ目に合わせる。**
 *
 * 返すのは**項目ごとのずれ(秒)**である。区間そのものを作り直さない ——
 * `shiftItems()` に渡せば、文の区間(`item` を持つ)にも同じずれが当たる。
 * **ずらすだけ。伸ばさない**(話している時間は控えのとおり)。
 *
 * ## 見つけ方 —— 「前の発言が終わったあと、最初に鳴り出すところ」
 *
 * 控えの継ぎ目は 0 なので、`spans[k].start + offs[k-1]` は
 * **前の発言の声が終わった秒**である。そこから先で最初に鳴り出す run が、
 * 次の発言の頭にほかならない。
 *
 * **発言の途中の息継ぎに引っかからない。** あれは前の発言の声が
 * 終わるより**手前**で始まるので、この探し方では通り過ぎている。
 *
 * ## **間の無い継ぎ目は、間が無いのが答えである**
 *
 * 40ms しか空いていない継ぎ目は、語と語のあいだと見分けが付かない
 * (`MIN_SILENCE`)。そこは**1つの run のまま**になるが、
 * それは「前の発言のすぐあとに次が始まる」ということなので、
 * **前と同じずれを当てればよい。** 測り損ねではない。
 *
 * **1本でも見分けが付かないと全部やめる、にしない。**
 * 13 本のうち1本が詰まっているだけで、残り 12 本の実測を捨てることになる。
 *
 * @param {Array<{start:number,end:number}>} spans 控えの区間(項目ごと)
 * @param {Array<{from:number,to:number}>} runs 測った声のところ
 * @param {number} duration 音声ぜんぶの長さ(秒)
 * @returns {{offs:number[], hit:number, tight:number, loose:number}|null}
 *   測れなければ `null`
 */
export function seamOffsets(spans, runs, duration = 0) {
  /* **なぜ測れなかったのかを、必ず残す**(30手め)。
     呼ぶたびに上書きするので、前の呼び出しの理由が混ざることはない */
  const no = (why) => {
    failWhy = { why, runs: Array.isArray(runs) ? runs.length : 0 }
    return null
  }
  if (!Array.isArray(spans) || spans.length < 2) return no('区間が2つに満たない')
  if (!Array.isArray(runs) || !runs.length) return no('声のところが1つも無い')

  const offs = new Array(spans.length).fill(0)
  // 頭の無音ぶん(いちばん最初の声が鳴り出すところに合わせる)
  offs[0] = runs[0].from - Number(spans[0].start)
  let last = runs[0].from
  let hit = 0
  let tight = 0
  let loose = 0

  for (let k = 1; k < spans.length; k += 1) {
    const prevEnd = Number(spans[k - 1].end) + offs[k - 1]
    /* ⓪ **前の声が、まだ続いている** = 間が無いということである。
          前と同じずれを当てて、次へ進む(測り損ねではない) */
    const inside = runs.find((r) => prevEnd > r.from && prevEnd < r.to - MIN_SILENCE)
    if (inside) {
      offs[k] = offs[k - 1]
      last = Math.max(last, prevEnd)
      tight += 1
      continue
    }
    // ① 前の声が終わったあと、最初に鳴り出すところ
    let pick = runs.find((r) => r.from > last && r.from >= prevEnd - SEAM_TOL)
    if (pick) hit += 1
    else {
      /* ② 見つからないのは、控えの終わりが実際より長いとき。
            **いちばん近いところを採る**(行き止まりを作らない) */
      let best = null
      for (const r of runs) {
        if (r.from <= last) continue
        if (!best || Math.abs(r.from - prevEnd) < Math.abs(best.from - prevEnd)) best = r
      }
      pick = best
      if (pick) loose += 1
    }
    if (!pick) return no(`声のところが足りない(${k}/${spans.length - 1} 本目で尽きた)`)
    if (pick.from - prevEnd > MAX_GAP) {
      return no(`間が広すぎる(${(pick.from - prevEnd).toFixed(2)} 秒)`)
    }
    offs[k] = pick.from - Number(spans[k].start)
    last = pick.from
  }

  // ── 測り損ねを、そのまま使わない ──────────────────────────────
  if (hit + tight < Math.ceil((spans.length - 1) * MIN_HIT)) {
    return no(`当てが多い(素直に当たったのは ${hit + tight}/${spans.length - 1} 本)`)
  }
  for (let k = 0; k < offs.length; k += 1) {
    if (!Number.isFinite(offs[k])) return no('ずれが数にならない')
    if (Math.abs(offs[k]) > MAX_OFF) {
      return no(`ずれが大きすぎる(${offs[k].toFixed(2)} 秒 / 上限 ${MAX_OFF} 秒)`)
    }
  }
  for (let k = 1; k < spans.length; k += 1) {
    const a = Number(spans[k - 1].start) + offs[k - 1]
    const b = Number(spans[k].start) + offs[k]
    if (!(b > a)) return no(`順が逆になった(${k} 本目)`)
  }
  // 間が無いだけの継ぎ目は「測れた」に数えるが、全部そうなら測れていない
  if (!hit) return no(`どの継ぎ目にも間が無い(${tight} 本とも詰まっている)`)
  const d = Number(duration) || 0
  if (d > 0) {
    const tail = Number(spans[spans.length - 1].end) + offs[offs.length - 1]
    if (tail > d + 0.5) return no(`終わりが音声より先(${(tail - d).toFixed(2)} 秒)`)
  }
  failWhy = null
  return { offs, hit, tight, loose }
}

/**
 * 波から、そのまま項目ごとのずれを出す(上の3つをつないだだけ)。
 *
 * ## **1つのしきい値で決めない。測れるまで降りる**(31手め)
 *
 * 30手めは「別のしきい値なら何本に分かれるか」を**数えるだけ**にして、
 * 利用者の報告を待つことにした。**それが誤りだった** ——
 * 30回めの直しで「なにひとつ変わっていない」と言わせている。
 * **数えられるなら、その場で試せばよい。**
 *
 *   - **1本目は `QUIET_RATIO` そのもの。** いままで測れていた教材は、
 *     そこで測れて終わる(**1ミリ秒も変わらない**)
 *   - 降りるのは**測れなかったときだけ。** `rms` はもう出してあるので、
 *     **通信も費用も増えない**(窓口を1回も呼ばない = 0円)
 *   - 全部だめなら、これまでどおり `null` —— 均等に配るへ落ちる
 *     (**行き止まりを作らない**)
 *
 * 高いしきい値で**発言の途中まで切れてしまっても害は無い。**
 * `seamOffsets()` は「前の声が終わったあと、最初に鳴り出すところ」しか
 * 採らないので、途中で増えた run は**手前にいるぶん、必ず読み飛ばされる。**
 *
 * @returns {{offs:number[], hit:number, loose:number, runs:number, q:number}|null}
 */
export function measureSeams(samples, rate, spans, duration = 0) {
  const rms = frameRms(samples, rate)
  if (!rms.length) {
    failWhy = { why: '波をほどけない', runs: 0 }
    return null
  }
  const len = duration || (samples.length / rate)
  const tries = []
  let first = null
  for (const q of TRY_RATIOS) {
    const runs = speechRuns(rms, HOP_SEC, { level: quietLevel(rms, q) })
    tries.push({ q, n: runs.length })
    const got = seamOffsets(spans, runs, len)
    if (got) return { ...got, runs: runs.length, q }
    if (!first) first = failWhy
  }
  /* **どの段でも測れなかった。** 何を試して何本に分かれたかを残す ——
     これが `[調査中]` の行に出るので、次の報告1つで出どころが決まる */
  if (failWhy) failWhy.tries = tries
  return null
}

/**
 * **文のずれから、項目(段落 / 発言)のずれを出す**(2026-09 実機・19手め)。
 *
 * 文で測ったなら、**項目のずれはその項目の1つめの文のずれ**である
 * (項目の頭と、その1つめの文の頭は、同じ文字を指している)。
 * **もう一度測らない** —— 2度測ると、片方だけずれたときに
 * 色と折り返しが食い違う(**数え方を2通り持たない**)。
 *
 * @param {Array<{item:number}>} sents 文の区間(`item` を持つ)
 * @param {number[]} offs 文ごとのずれ
 * @param {number} count 項目の数
 * @returns {number[]} 項目ごとのずれ
 */
export function itemOffsFrom(sents, offs, count) {
  const n = Math.max(0, Number(count) || 0)
  const out = new Array(n).fill(0)
  const seen = new Array(n).fill(false)
  const list = Array.isArray(sents) ? sents : []
  list.forEach((s, i) => {
    const k = Number(s?.item)
    if (!Number.isInteger(k) || k < 0 || k >= n || seen[k]) return
    const d = Number(offs?.[i])
    if (!Number.isFinite(d)) return
    seen[k] = true
    out[k] = d
  })
  /* 文が1つも無い項目(英文が空)は、手前と同じずれにする。
     0 のまま残すと、そこだけ控えの時計へ戻ってしまう */
  for (let k = 1; k < n; k += 1) if (!seen[k]) out[k] = out[k - 1]
  return out
}
