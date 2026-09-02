/**
 * **声ごとの音量そろえ**(`src/lib/loudness.js`)を数字で確かめる。
 *
 * 【なぜ要るか】(2026-09 利用者の問い)
 *
 *   > あなたはボリュームを感じることはできるのですか?
 *
 *   **できない。** こちらが見ているのは波形から計算した数字
 *   (平均の大きさ RMS と、いちばん大きいところ peak)だけで、
 *   「息の音が目立つ」かどうかは聞かなければ分からない。
 *
 *   だから**耳の代わりに、数字で確かめられることは全部確かめる。**
 *     ・そろえたあと、どの声も同じ大きさになるか
 *     ・**1 を超えて割れないか**
 *     ・小さい声を**持ち上げていないか**(息の音が大きくなる原因)
 *
 * 【やり方】(2026-09 利用者の指定)
 *
 *   > 小さい声のボリュームに合わせ、大きい声のボリュームを落とし、
 *   > そこから全体的に少し音量を上げる。
 *
 * 使い方: `npm run test:audio`
 */

// `loudness.js` は端末の控え(localStorage)を読む。**先に用意しておく**
const store = new Map()
globalThis.window = {
  localStorage: {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
  },
}

/**
 * **毎回まっさらな控えで読み直す。**
 * `loudness.js` は測った結果をモジュールの中に控える(ブラウザでは
 * それでよい)。検証では中身を差し替えて何通りも試すので、
 * **読み直させないと1つめの値がずっと使われる。**
 * 実際、これを入れる前は2つめ以降が素通りしていた。
 */
let seq = 0
async function withVoices(voices) {
  const table = {}
  seq += 1
  const mod = await import(`../src/lib/loudness.js?v=${seq}`)
  for (const [voice, rms, peak] of voices) table[mod.loudKey('premium', voice)] = { rms, peak }
  store.set('eas.loud', JSON.stringify(table))
  return mod
}

let failed = 0
const check = (label, ok, detail = '') => {
  if (ok) {
    console.log(`✓ ${label}${detail ? ` — ${detail}` : ''}`)
  } else {
    console.error(`❌ ${label}${detail ? ` — ${detail}` : ''}`)
    failed += 1
  }
}

// ── ① 3人の声をそろえる ───────────────────────────────────
//
// よくある値。小さい声(0.06)・ふつう(0.09)・大きい声(0.14)。
// peak は、いちばん大きいところ(破裂音など)
console.log('\n▶ 3人の声をそろえる')
const three = [['quiet', 0.06, 0.70], ['mid', 0.09, 0.85], ['loud', 0.14, 0.95]]
const m1 = await withVoices(three)

const after = three
  .map(([v, rms, peak]) => {
    const g = m1.gainFor('premium', v)
    return { v, g, rms: rms * g, peak: peak * g }
  })
for (const r of after) {
  console.log(`   ${r.v.padEnd(6)} 倍率 ${r.g.toFixed(3)}`
    + ` → 大きさ ${r.rms.toFixed(4)} / いちばん大きいところ ${r.peak.toFixed(3)}`)
}

const rmsList = after.map((r) => r.rms)
const spread = Math.max(...rmsList) / Math.min(...rmsList)
check('そろっている(いちばん大きい声といちばん小さい声の差が 5% 以内)',
  spread < 1.05, `差 ${((spread - 1) * 100).toFixed(1)}%`)

check('割れない(どの声も 1 を超えない)',
  after.every((r) => r.peak <= 1), `最大 ${Math.max(...after.map((r) => r.peak)).toFixed(3)}`)

// **ここが今回の変更の要**。持ち上げると、声だけでなく息の音も同じ倍率で上がる
check('小さい声を持ち上げすぎない(倍率は全体の底上げぶんまで)',
  after.every((r) => r.g <= 1.25 + 1e-9),
  `いちばん大きい倍率 ${Math.max(...after.map((r) => r.g)).toFixed(3)}`)

check('大きい声は下がる', after.find((r) => r.v === 'loud').g < 1)

// ── ② 1人しか測っていないとき ─────────────────────────────
console.log('\n▶ 1人しか測っていないとき')
const m2 = await withVoices([['solo', 0.09, 0.70]])
const solo = m2.gainFor('premium', 'solo')
console.log(`   solo   倍率 ${solo.toFixed(3)}`)
check('全体の底上げぶんだけかかる', Math.abs(solo - 1.25) < 1e-6)

// ── ②' 割れそうなときは、底上げのほうを削る ──────────────────
//
// **この検証が、書いたときの思い込みを1つ捕まえた。**
// 「1人なら必ず 1.25 倍」と思っていたが、いちばん大きいところが
// 0.80 もある声では 1.25 倍にすると 1.0 を超えて**割れる。**
// 音量より、割れないことが先である。
console.log('\n▶ いちばん大きいところが 1 に近い声')
const m2b = await withVoices([['peaky', 0.09, 0.80]])
const peaky = m2b.gainFor('premium', 'peaky')
console.log(`   peaky  倍率 ${peaky.toFixed(3)} → いちばん大きいところ ${(0.80 * peaky).toFixed(3)}`)
check('底上げより、割れないことを優先する', peaky < 1.25 && 0.80 * peaky <= 1)

// ── ③ 極端に小さい測定が混じったとき ───────────────────────
//
// 間の多い音声・一部しか鳴らなかった MP3 で起こりうる。
// **そこへ全員を合わせると、何も聞こえなくなる**ので下限を置いてある
console.log('\n▶ 極端に小さい測定が混じったとき(下限が効くか)')
const m3 = await withVoices([['broken', 0.005, 0.10], ['normal', 0.10, 0.85]])
const normal = m3.gainFor('premium', 'normal')
console.log(`   normal 倍率 ${normal.toFixed(3)} → 大きさ ${(0.10 * normal).toFixed(4)}`)
check('下限(0.05)より下へは合わせない', 0.10 * normal >= 0.05 * 1.25 - 1e-6)

// ── ④ 測っていない声 ──────────────────────────────────────
console.log('\n▶ まだ測っていない声')
check('そのまま鳴らす(1 倍)', m3.gainFor('premium', 'unknown') === 1)

console.log(failed
  ? `\n❌ ${failed} 件が意図どおりではありません`
  : '\n✅ 音量そろえの検証はすべて意図どおりです')
process.exit(failed ? 1 : 0)
