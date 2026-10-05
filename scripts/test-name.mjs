/**
 * ============================================================================
 * **教材の呼び名の検証**(第5.384節・2026-10-05 利用者の指定)
 *
 *   > 同じレベルで「応答問題」をいくつか作ってゲストにアサインすると、
 *   > 一番大きく表示される題名がすべて同じなので、見分けがつかず探しにくい、
 *   > 分かりにくいです。…… 大切な部分です。
 *
 * ── ここでいちばん危ない形 ────────────────────────────────
 *
 *   **「名前が付いた」だけで緑にしない。**
 *   いちばん困るのは**同じ名前が2つ並ぶこと**なので、
 *   **違う中身の教材に、違う名前が付くこと**まで measure する。
 *
 *   **「出ない側」も見る** —— トレーナーが書いた名前は上書きしない。
 *   ここを測らないと、「いつも中身から組む」に書き換えても緑のままである。
 *
 * ── 素の node で走る ────────────────────────────────────
 *
 *   `materialName.js` は Supabase も `import.meta.env` も引き連れていない。
 *   画面を描かずに、決まりだけを確かめられる。
 * ============================================================================
 */
import { readFileSync } from 'node:fs'

let bad = 0
const ok = (s, d = '') => console.log(`✓ ${s}${d ? ` — ${d}` : ''}`)
const ng = (s, d = '') => { bad += 1; console.log(`✗ ${s}${d ? `\n    ${d}` : ''}`) }
const is = (cond, name, d = '') => (cond ? ok(name, d) : ng(name, d))
const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')
/* **コメントを落としてから数える。** 説明にも同じ語が出るので、
   落とさずに数えると、いつも当たってしまう(CLAUDE.md) */
const noC = (t) => t.replace(/\/\*[\s\S]*?\*\/|\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\/.*$/gm, '')

const N = await import('../src/lib/materialName.js')
const K = await import('../src/data/materialKinds.js')

/** 実機で起きたとおりの形。**応答問題は、1つの表現を2回 正解にする**(第5.332節) */
const 応答 = (表現, level = 'A2+') => ({
  title: `2026-10-02 / ${level}`,
  level,
  kind: 'response',
  sections: [{
    seq: 1,
    items: 表現.flatMap((en, i) => [
      { seq: i * 2 + 1, answer: en },
      { seq: i * 2 + 2, answer: en },
    ]),
  }],
})

console.log('\n▶ 呼び名の決まり(素の node で測る)')
{
  const a = N.materialName(応答(['Could you send it by Friday?', 'I will check and get back to you.']))
  is(a.from === N.NAME_FROM.CONTENT, '教材名がレベルだけなら、中身から組む', JSON.stringify(a))
  is(a.name.includes('Could you send it by Friday?'), '先頭の表現が、そのまま名前に入る', a.name)

  /* ★ **重なりを数えない。** 応答問題は同じ表現を2回出すので、
       数え方を間違えると「ほか 3 表現」のように倍で出る */
  is(/ほか 1 表現/.test(a.name), '同じ表現を2回出しても、1つと数える', a.name)

  /* ★ **ここが本番。違う中身なら、違う名前になるか。**
       「名前が付いた」だけでは、いちばん困る形(同じ名前が2つ並ぶ)を見ていない */
  const b = N.materialName(応答(['Sorry to keep you waiting.', 'Let me double-check that.']))
  is(a.name !== b.name, '中身が違えば、名前も違う', `${a.name}\n    ${b.name}`)

  /* ★ **レベルが違うだけでは、まだ区別できない**(利用者の写真はこの形)。
       日付も同じなので、**中身しか手がかりが無い** */
  const 同じ = N.materialName(応答(['Could you send it by Friday?', 'I will check and get back to you.'], 'B1'))
  is(同じ.name === a.name, 'レベルが違っても、中身が同じなら同じ名前', 同じ.name)
}

console.log('\n▶ どれを名前にするか(先に当たったものが勝つ)')
{
  /* ① トレーナーが書いた名前は、**上書きしない**(出ない側) */
  const t = N.materialName({ title: '2026-10-02 / 納期の交渉 / B1', level: 'B1', kind: 'response' })
  is(t.from === N.NAME_FROM.TYPED && t.name === '納期の交渉',
    'トレーナーが書いた名前は、そのまま勝つ', JSON.stringify(t))

  /* **中身があっても、書いた名前が勝つ** —— ここを測らないと
     「いつも中身から組む」に書き換えても緑のまま */
  const 中身つき = { ...応答(['Could you send it by Friday?']), title: '2026-10-02 / 納期の交渉 / B1' }
  is(N.materialName(中身つき).from === N.NAME_FROM.TYPED,
    '中身があっても、書いた名前のほうが勝つ')

  /* ② AI の付けた呼び名 */
  const n = N.materialName({ title: '2026-10-02 / A2+', level: 'A2+', kind: 'response', headlineJa: '金曜までの納期交渉' })
  is(n.from === N.NAME_FROM.NICKNAME && n.name === '金曜までの納期交渉',
    'AI の呼び名は、中身から組むより先に出る', JSON.stringify(n))

  /* **中身より先に出るか** —— 順番が逆だと、せっかくの呼び名が出ない */
  const 両方 = { ...応答(['Could you send it by Friday?']), headlineJa: '金曜までの納期交渉' }
  is(N.materialName(両方).from === N.NAME_FROM.NICKNAME, '呼び名は、中身から組むより先')

  /* ★ **本文のある教材では、呼び名を名前にしない**(出ない側)。
       あちらは英語の見出しが名前の役をしていて、`headline_ja` は
       その訳として**見出しのすぐ下にもう出ている**(2行に同じものを並べない) */
  const 本文 = N.materialName({
    title: '2026-10-02 / A2+', level: 'A2+', kind: 'reading',
    headline: 'A Quiet Revolution', headlineJa: '静かな革命',
  })
  is(本文.from !== N.NAME_FROM.NICKNAME, '本文のある教材では、見出しの訳を名前にしない', JSON.stringify(本文))

  /* ④ 最後の砦。**レベルを出すくらいなら、種類を出す** ——
       レベルはすぐ下の札にもう在る(同じことを2つ見せない) */
  const k = N.materialName({ title: '2026-10-02 / A2+', level: 'A2+', kind: 'response' })
  is(k.from === N.NAME_FROM.KIND, '中身がまだ読めていなければ、種類の名前', JSON.stringify(k))
  is(k.name === K.kindLabel('response'), '種類の呼び名は、一覧から読む(書き写さない)', k.name)
  is(k.name !== 'A2+', 'レベルは、大きい名前に出さない', k.name)
}

console.log('\n▶ レベルの見分け(ここを間違えると、ふつうの教材の名前まで消える)')
{
  is(N.nameIsLevel('A2+', 'A2+') === true, 'レベルそのものなら、名前ではない')
  is(N.nameIsLevel('a2+', 'A2+') === true, '大文字小文字は見ない')
  is(N.nameIsLevel('納期の交渉', 'A2+') === false, 'ふつうの名前は、レベルではない')
  /* ★ **出ない側。** ここが `true` に寄ると、名前のある教材まで消える */
  is(N.nameIsLevel('', 'A2+') === false, '空は、レベルではない')
  is(N.nameIsLevel('A2+', '') === false, 'レベルが分からなければ、レベルではない')
  is(N.nameIsLevel('A2', 'A2+') === false, '似ているだけの級は、別もの')
}

console.log('\n▶ 中身の読み方')
{
  /* **並びは `seq`。** Supabase は読んできた順を約束しない */
  const ばらばら = {
    title: '2026-10-02 / A2+', level: 'A2+', kind: 'response',
    sections: [
      { seq: 2, items: [{ seq: 1, answer: 'Second one.' }] },
      { seq: 1, items: [{ seq: 2, answer: 'Later.' }, { seq: 1, answer: 'First one.' }] },
    ],
  }
  is(N.materialPhrases(ばらばら)[0] === 'First one.',
    '読んできた順ではなく、seq の順で先頭を選ぶ', N.materialPhrases(ばらばら).join(' / '))

  /* **空の欄は数えない**(0 と null を取り違えない・CLAUDE.md) */
  const 空あり = {
    title: '2026-10-02 / A2+', level: 'A2+', kind: 'response',
    sections: [{ seq: 1, items: [
      { seq: 1, answer: '  ' }, { seq: 2, answer: null },
      { seq: 3, answer: 'Only one.' },
    ] }],
  }
  is(N.materialPhrases(空あり).length === 1, '空の欄は、表現として数えない')
  is(N.materialName(空あり).name === 'Only one.', '1つだけなら「ほか」を付けない', N.materialName(空あり).name)

  /* **答えの無い演習でも、英文があれば拾う**(単語・フレーズは `prompt_en`) */
  const 語 = {
    title: '2026-10-02 / A2+', level: 'A2+', kind: 'word',
    sections: [{ seq: 1, items: [{ seq: 1, prompt_en: 'procurement' }] }],
  }
  is(N.materialName(語).from === N.NAME_FROM.CONTENT, '答えの欄が無くても、英文があれば拾う')

  /* ★ **長い表現は切る。** 上限は書き写さず、あちらから読む
       (書き写すと、長さを変えた日に期待も一緒に動いて素通りする) */
  const 長い = 'x'.repeat(N.PHRASE_MAX + 40)
  const 切れた = N.shortPhrase(長い)
  is(切れた.length <= N.PHRASE_MAX, '長い表現は、見出しに入る長さに切る', `${切れた.length} 字`)
  is(切れた.endsWith('…'), '切ったことを隠さない', 切れた.slice(-4))
  is(N.shortPhrase('short') === 'short', '短い表現は、そのまま')

  /* **渡されなくても落ちない**(行き止まりを作らない) */
  for (const v of [null, undefined, {}, { sections: null }]) {
    if (typeof N.materialName(v)?.name !== 'string') ng('教材が無くても落ちない', String(v))
  }
  ok('教材が無くても落ちない')
}

console.log('\n▶ 画面の側(呼び名を決める場所は1つ)')
{
  const 名 = read('src/lib/materialName.js')
  is(!/supabase|import\.meta\.env/.test(noC(名)),
    '呼び名の決まりは、素の node で走る形になっている')

  /* ★ **画面の中で種類やレベルを書き分けていないか**(CLAUDE.md) */
  const 画面 = ['src/components/MaterialTitle.jsx', 'src/components/TrainerLearners.jsx',
    'src/components/LearnerHomework.jsx', 'src/components/TrainerMaterials.jsx']
  const 書き分け = 画面.filter((f) => /kind === 'response'|main === level/.test(noC(read(f))))
  is(!書き分け.length, '画面が、教材の種類で名前を書き分けていない', 書き分け.join(' / '))

  /* ★ **`MaterialTitle` を呼ぶところが、ぜんぶ教材を渡しているか。**
       1か所でも渡し忘れると、そこだけ古い名前(レベル)が出る ——
       **画面を開くまで誰にも分からない形**である */
  const 呼び出し = []
  for (const f of ['src/components/SoundPractice.jsx', 'src/components/AssignBooks.jsx',
    'src/components/TrainerMaterials.jsx', 'src/components/LearnerHomework.jsx',
    'src/components/MaterialBody.jsx', 'src/components/LessonView.jsx',
    'src/components/TrainerLearners.jsx', 'src/__screens.jsx']) {
    const t = noC(read(f))
    for (const m of t.matchAll(/<MaterialTitle\b[\s\S]*?\/>/g)) {
      呼び出し.push({ f, 渡した: /\bmaterial=\{/.test(m[0]) })
    }
  }
  is(呼び出し.length >= 8, `MaterialTitle を呼ぶところを、ぜんぶ数えた`, `${呼び出し.length} か所`)
  const 抜け = 呼び出し.filter((c) => !c.渡した).map((c) => c.f)
  is(!抜け.length, 'どの呼び出しも、教材そのものを渡している', 抜け.join(' / '))

  /* **`MaterialTitle` が、渡された教材から名前を決めているか** */
  const 見出し = noC(read('src/components/MaterialTitle.jsx'))
  is(/materialName\(/.test(見出し), '見出しは、呼び名を1か所から取っている')

  /* ★ **骨組みは、本物と1文字も違えない**(CLAUDE.md) */
  const 骨 = noC(read('src/__screens.jsx'))
  is(/<MaterialTitle[^/]*material=\{/.test(骨), '骨組みも、教材そのものを渡している')
}

console.log('\n▶ トレーナーの画面に、中身が届いているか')
{
  /* ★ **過去の宿題の一覧は、もともと中身を読んでいなかった**(数だけ)。
       読まないままだと、**呼び名はいつも「応答問題」になる** ——
       `materialName()` だけ直しても、実機では何も変わらない */
  const mats = read('src/lib/materials.js')
  const 宿題 = mats.slice(mats.indexOf('export async function loadLearnerAssignments'))
  const 範囲 = 宿題.slice(0, 宿題.indexOf('export async function', 10))
  is(/material_items \([^)]*\banswer\b/.test(範囲),
    'トレーナーの一覧も、呼び名に使う欄を読んでいる')
  is(/sections:/.test(範囲), '読んだ中身を、本文のときと同じ形にそろえている')
  /* **重くしていないか** —— 本文も訳も読んでいない(名前に要らない) */
  is(!/prompt_ja|audio_text|note/.test(範囲), '名前に要らない欄までは読んでいない')
}

console.log('\n▶ AI の一言の呼び名(第5.384節・案3)')
{
  const fn = read('supabase/functions/generate-material/index.ts')
  const form = noC(read('src/components/MaterialForm.jsx'))

  /* ★ **本文のある教材には頼まない**(あちらは `headline` が名前) */
  is(/if \(!isPassage && isFirst\) \{[\s\S]{0,400}?headline_ja/.test(fn),
    '呼び名は、本文を持たない教材の最初の演習でだけ作らせる')
  /* **何を書かせるかが、ちゃんと指定されているか** ——
     種類の名前やレベルを返されたら、いまと何も変わらない。
     ★ **目じるしは1つに絞る**(CLAUDE.md)—— `headline_ja` の欄は
     **2か所にある**(本文の「見出しの訳」と、ここの「呼び名」)。
     そのまま探すと手前の本文のほうに当たり、**この指定を消しても緑**になる */
  const 呼び名節 = fn.slice(fn.indexOf('if (!isPassage && isFirst) {'))
  const 指示 = 呼び名節.slice(0, 呼び名節.indexOf('required.push'))
  is(/種類の名前を書かない/.test(指示) && /レベル/.test(指示),
    '種類の名前とレベルは書かないように、はっきり頼んでいる')

  /* ★ **受け取って、保存まで届いているか。**
       窓口だけ直して画面に書き写していない、がこのリポジトリで何度も起きた */
  is(/result\.headline_ja/.test(form), '画面が、返ってきた呼び名を受け取っている')
  is(/headlineJa: nick/.test(form), '受け取った呼び名を、保存する側まで渡している')
  /* **最初の1本だけ** —— 演習ごとに集めると言い換えが並ぶ(指導ポイントと同じ) */
  is(/result\.headline_ja && !nick/.test(form), '呼び名は、最初の演習で1本だけ受け取る')
}

console.log(bad ? `\n❌ ${bad} 件が意図どおりではありません`
  : '\n✅ 教材の呼び名の検証は、すべて意図どおりです')
process.exit(bad ? 1 : 0)
