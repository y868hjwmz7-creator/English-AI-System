/**
 * **声ごとの音量そろえ**(`src/lib/loudness.js`)を数字で確かめる。
 *
 * 【なぜ要るか】(2026-09 利用者の問い)
 *
 *   > あなたはボリュームを感じることはできるのですか?
 *
 *   **できない。** こちらが見ているのは波形から計算した数字(RMS)だけで、
 *   「息の音が目立つ」かどうかは聞かなければ分からない。
 *   だから**耳の代わりに、数字で確かめられることは全部確かめる。**
 *
 * 【いまのやり方】(2026-09 利用者の指定)
 *
 *   > 1番小さな声に合わせて、それ以上大きくしない
 *
 *   **倍率が必ず 1 以下であること**が、この版のいちばん大事な性質である。
 *   1 を超えた瞬間に、息の音も破裂音も一緒に大きくなる。
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
 * `loudness.js` は測った結果をモジュールの中に控える(ブラウザではそれでよい)。
 * 検証では中身を差し替えて何通りも試すので、
 * **読み直させないと1つめの値がずっと使われる。**
 * 実際、これを入れる前は2つめ以降が素通りしていた。
 */
let seq = 0
async function withVoices(voices) {
  seq += 1
  const mod = await import(`../src/lib/loudness.js?v=${seq}`)
  const table = {}
  for (const [voice, rms] of voices) table[mod.loudKey('premium', voice)] = { rms }
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
// よくある値。小さい声(0.06)・ふつう(0.09)・大きい声(0.14)
console.log('\n▶ 3人の声をそろえる')
const three = [['quiet', 0.06], ['mid', 0.09], ['loud', 0.14]]
const m1 = await withVoices(three)
const after = three.map(([v, rms]) => {
  const g = m1.gainFor('premium', v)
  return { v, g, rms: rms * g }
})
for (const r of after) {
  console.log(`   ${r.v.padEnd(6)} 倍率 ${r.g.toFixed(3)} → 大きさ ${r.rms.toFixed(4)}`)
}

const rmsList = after.map((r) => r.rms)
check('そろっている(いちばん大きい声との差が 5% 以内)',
  Math.max(...rmsList) / Math.min(...rmsList) < 1.05,
  `差 ${((Math.max(...rmsList) / Math.min(...rmsList) - 1) * 100).toFixed(1)}%`)

// **この版のいちばん大事な性質。** 1 を超えた瞬間に息の音も大きくなる
check('**1つも大きくしていない**(倍率はすべて 1 以下)',
  after.every((r) => r.g <= 1),
  `いちばん大きい倍率 ${Math.max(...after.map((r) => r.g)).toFixed(3)}`)

check('いちばん小さい声は、まったく触らない(1 倍ちょうど)',
  after.find((r) => r.v === 'quiet').g === 1)

check('大きい声だけが下がる', after.find((r) => r.v === 'loud').g < 1)

// ── ② 1人しか測っていないとき ─────────────────────────────
console.log('\n▶ 1人しか測っていないとき')
const m2 = await withVoices([['solo', 0.09]])
const solo = m2.gainFor('premium', 'solo')
console.log(`   solo   倍率 ${solo.toFixed(3)}`)
check('比べる相手がいないので、触らない(1 倍)', solo === 1)

// ── ③ 極端に小さい測定が混じったとき ───────────────────────
//
// 間の多い音声・一部しか鳴らなかった MP3 で起こりうる。
// **そこへ全員を合わせると、何も聞こえなくなる**ので下限を置いてある
console.log('\n▶ 極端に小さい測定が混じったとき(下限が効くか)')
const m3 = await withVoices([['broken', 0.005], ['normal', 0.10]])
const normal = m3.gainFor('premium', 'normal')
console.log(`   normal 倍率 ${normal.toFixed(3)} → 大きさ ${(0.10 * normal).toFixed(4)}`)
check('下限(0.05)より下へは合わせない', 0.10 * normal >= 0.05 - 1e-9)

// ── ③' 下げすぎない ───────────────────────────────────────
console.log('\n▶ 差が開きすぎているとき(下げすぎないか)')
const m3b = await withVoices([['tiny', 0.05], ['huge', 0.50]])
const huge = m3b.gainFor('premium', 'huge')
console.log(`   huge   倍率 ${huge.toFixed(3)}`)
check('0.30 より下へは下げない', huge >= 0.30 - 1e-9)

// ── ④ 測っていない声 ──────────────────────────────────────
console.log('\n▶ まだ測っていない声')
check('そのまま鳴らす(1 倍)', m3.gainFor('premium', 'unknown') === 1)

// ── ⑤ 音の通り道を変えないこと ────────────────────────────
//
// **ここは実機で痛い目を見たところである**(2026-09)。
// 一度 Web Audio(`MediaElementAudioSourceNode` → `GainNode`)を通したが、
//
//   > 小さな音量に合わせたはずなのに1回目の再生からバリバリ雑音だらけです
//
// 音を小さくする掛け算は雑音を作れない。**原因は通り道のほうだった。**
// いまは `<audio>` の `volume` だけを使う(倍率が 1 以下なので足りる)。
console.log('\n▶ 音の通り道を変えていないか')
const src = await import('node:fs/promises')
  .then((fs) => fs.readFile(new URL('../src/lib/loudness.js', import.meta.url), 'utf8'))
for (const banned of ['createMediaElementSource', 'createGain', 'crossOrigin']) {
  check(`\`${banned}\` を使っていない(通り道を変えない)`, !src.includes(banned))
}

console.log(failed
  ? `\n❌ ${failed} 件が意図どおりではありません`
  : '\n✅ 音量そろえの検証はすべて意図どおりです')
process.exit(failed ? 1 : 0)
