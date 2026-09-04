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
 *   > 全ての声の音量の平均値をとり、そこに全てを合わせてみてください
 *
 *   平均に合わせる倍率を出し、**全体を割って 1 以下に収める。**
 *   `volume` は下げることしかできないためで、
 *   **声どうしの比は変わらない。**
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

/** 控えの鍵。**測り方の版が入っている**(`MEASURE_REV`) */
const LOUD_KEY = 'eas.loud.2'

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
  store.set(LOUD_KEY, JSON.stringify(table))
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

// ── ③ 明らかに測り損ねたものが混じったとき ─────────────────
//
// **ここは実際にそろえるのを壊していた**(2026-09)。
// 以前は「そろえ先の下限 0.05」で押し上げていたので、
// 本当にいちばん小さい声が 0.04 だと、
//   小さい声 … 1 倍のまま 0.04 / ほかの声 … 0.05 まで下がる
// となり、**いちばん小さい声だけがそろわなかった。**
// いまは押し上げずに、**測り損ねたものを外す。**
console.log('\n▶ 測り損ねたものが混じったとき')
const m3 = await withVoices([['broken', 0.005], ['a', 0.04], ['b', 0.10]])
const g3 = ['broken', 'a', 'b'].map((v) => ({ v, g: m3.gainFor('premium', v) }))
for (const r of g3) console.log(`   ${r.v.padEnd(6)} 倍率 ${r.g.toFixed(3)}`)
check('まともな2声はそろう(0.04 と 0.10)',
  Math.abs(0.04 * g3[1].g - 0.10 * g3[2].g) < 1e-6,
  `${(0.04 * g3[1].g).toFixed(4)} と ${(0.10 * g3[2].g).toFixed(4)}`)
check('いちばん小さい声(0.04)は、まったく触らない', g3[1].g === 1)
check('測り損ねたものに引きずられない(0.005 に合わせない)',
  0.10 * g3[2].g > 0.01)

// ── ③' 下げすぎない ───────────────────────────────────────
console.log('\n▶ 差が開きすぎているとき(下げすぎないか)')
const m3b = await withVoices([['tiny', 0.05], ['huge', 0.50]])
const huge = m3b.gainFor('premium', 'huge')
console.log(`   huge   倍率 ${huge.toFixed(3)}`)
check('0.20 より下へは下げない', huge >= 0.20 - 1e-9)

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

// ── ⑥ 差し替えのときに「プチッ」と鳴らさないこと ──────────────
//
// 2026-09 利用者の指摘。
//
//   > 発言と発言の間、特に、ひとつの発言の終わりに小さく
//   > 「プチっ」というノイズが入ってます。
//
// `<audio>` は**1つだけを使い回している**(iPhone の解錠をやり直さない
// ため)。次の発言に移るとき、鳴り終わったままの `<audio>` に新しい
// `src` を入れて `load()` する。**これは再生の仕組みをいったん壊して
// 作り直す操作**で、そのとき音の出口に段差ができる。
//
// だから **`pause()` して `volume = 0` にしてから差し替える。**
// 段差ができても、音量が 0 なら聞こえない。
// **順番が命なので、順番そのものを見張る**(入れ替わっても
// `npm run lint` にも `npm run build` にも引っかからない)。
console.log('\n▶ 差し替えの前に、止めて黙らせているか')
const clips = await import('node:fs/promises')
  .then((fs) => fs.readFile(new URL('../src/lib/audioClips.js', import.meta.url), 'utf8'))
// **`tryPlay` の中だけを見る。** ファイル全体から探すと、
// 止めるところの `el.pause()` を拾ってしまう(実際に拾って、
// 通っているように見えていた)
const iTry = clips.indexOf('const tryPlay =')
const iPause = clips.indexOf('el.pause()', iTry)
const iMute = clips.indexOf('el.volume = 0', iTry)
const iSrc = clips.indexOf('el.src = src', iTry)
check('差し替えの前に `pause()` している', iTry >= 0 && iPause >= 0 && iSrc >= 0 && iPause < iSrc,
  `pause=${iPause} / src=${iSrc}`)
check('差し替えの前に `volume = 0` にしている', iMute >= 0 && iSrc >= 0 && iMute < iSrc,
  `volume=${iMute} / src=${iSrc}`)
check('そのあとで本当の音量を入れ直している(`applyGain`)',
  clips.indexOf('applyGain(el', iSrc) > iSrc)

// ── ⑦ 入りと終わりを、なだらかにしているか ──────────────────
//
// 2026-09 利用者の指摘。
//
//   > まだ会話の発言と発言の間にプチっと入りますね。入る時と入らない時が
//   > あります。…音の終わりをなだらかなフェードアウトにするとか、
//   > 何かできるはずです。ここは音に関することで、このアプリのキモです
//
// **「プチッ」は、波形が途中の値のまま急に途切れると鳴る。**
// 一度は「差し替える前に `volume = 0`」で直したつもりだったが、
// **0 に跳ぶこと自体が段差**なので、鳴る場所を移しただけだった。
// **こちらには音が聞こえない。** だから曲線そのものを数字で見張る。
console.log('\n▶ 入りと終わりが、なだらかか')
const { FADE_IN, FADE_OUT, FADE_STEP, FADE_TAIL, fadeGain } = m3
const G = 0.4

check('鳴り始めは 0 から', fadeGain(G, 0, 9999) === 0)
check('入りきったら、その声の音量になる', fadeGain(G, FADE_IN, 9999) === G)
check('鳴り終わりは 0 になる', fadeGain(G, 9999, 0) === 0)
// **終わりの手前で 0 に届いていること。** 10ms 刻みにしてもなお、
// 最後の一刻みは「残り 33ms」で終わっていた(音量 0.11 のまま切れる)。
// 時計の揺らぎと、`ended` が長さぴったりでは来ないためである
check('終わりの手前で、もう 0 になっている', fadeGain(G, 9999, FADE_TAIL) === 0,
  `残り ${FADE_TAIL}ms の時点で 0`)
// **実測では、最後の一刻みが「残り 33ms」で終わっていた。**
// そこまで遅れても、残る音量が小さければ段差にならない
check('最後の一刻みが遅れても、残るのは音量の1割以下',
  fadeGain(G, 9999, 35) <= G * 0.1,
  `残り 35ms で ${(fadeGain(G, 9999, 35) / G * 100).toFixed(1)}%`)
check('終わりに向かって下がる',
  fadeGain(G, 9999, FADE_OUT * 0.25) < fadeGain(G, 9999, FADE_OUT * 0.75))
check('まん中はそのままの音量', fadeGain(G, 5000, 5000) === G)

// **段差が残っていないか。** いちばん大事なところ。
// 音量は 10ms ごとに動かすので、その刻みで見て
// **1回の変わり幅が音量の 1/3 を超えない**こと(超えると段差として聞こえる)
const steps = []
for (let t = 0; t <= FADE_OUT + FADE_TAIL + 20; t += FADE_STEP) {
  steps.push(fadeGain(G, 9999, FADE_OUT + FADE_TAIL - t))
}
let worst = 0
for (let i = 1; i < steps.length; i += 1) worst = Math.max(worst, Math.abs(steps[i] - steps[i - 1]))
check('1回に変わる幅が小さい(段差にならない)', worst <= G / 3,
  `いちばん大きい変わり幅 ${worst.toFixed(3)} / 音量 ${G}`)

// **鳴り始めも同じ。** 実測では最初の一刻みが 17〜21ms に来る。
// そこでいきなり音量の3割を超えて持ち上がると、そこが段差になる
check('鳴り始めの1刻みめが、持ち上がりすぎない', fadeGain(G, 21, 9999) <= G / 3,
  `21ms の時点で ${(fadeGain(G, 21, 9999) / G * 100).toFixed(1)}%`)

// **短い音では、入りと終わりが重なる。** 足し合わせず、小さいほうを採る
check('短い音でも 1 を超えない', fadeGain(1, 5, 5) <= 1)
check('短い音では、小さいほうを採る',
  fadeGain(G, 10, 10) === Math.min(fadeGain(G, 10, 9999), fadeGain(G, 9999, 10)))

// **測っていない声(1 倍)でも、ちゃんと下がる**
check('1 倍の声でも終わりは 0 になる', fadeGain(1, 9999, 0) === 0)
// 値がおかしくても落ちない
check('数字でない値でも落ちない', fadeGain(NaN, 10, 10) === 0)
check('0 の声は 0 のまま', fadeGain(0, 10, 10) === 0)

// **入りは短く、終わりは長く。** 頭の子音を削らないため
check('入りより終わりのほうが長い', FADE_OUT > FADE_IN, `入り ${FADE_IN}ms / 終わり ${FADE_OUT}ms`)
check('終わりが長すぎない(語尾が痩せる)', FADE_OUT + FADE_TAIL <= 200,
  `${FADE_OUT} + ${FADE_TAIL} = ${FADE_OUT + FADE_TAIL}ms`)

// **画面側でも、`fade` を毎コマ回していること。**
// 語の印が無いときだけ回さない、では終わりが急に切れる
check('印が無くても、10ms ごとに音量を見ている',
  !/if \(marks\.length\) frame = /.test(clips)
  && clips.includes('window.setInterval(tick, FADE_STEP)'))
check('画面の描き替え(rAF)には頼っていない(粗すぎた)',
  !clips.includes('requestAnimationFrame'))
check('止めるときもなだらかに下げている(`FADE_STOP`)',
  clips.includes('FADE_STOP') && clips.includes('setInterval'))

console.log(failed
  ? `\n❌ ${failed} 件が意図どおりではありません`
  : '\n✅ 音量そろえの検証はすべて意図どおりです')
process.exit(failed ? 1 : 0)
