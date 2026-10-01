/**
 * ============================================================================
 * **応答問題が、本当に作れる形になっているか**(0073・第5.332節)
 *
 * 2026-10-01 利用者の指定。
 *
 *   > NATIVE FLOW で学ぶ表現が応答の正解となるようにするんです。
 *   > 選択肢 A-C から選ぶんです。または、選択肢なしにも出来るように
 *   > 作成時に選べるように。また、いくつか正解の候補がある場合は
 *   > 別解を設け、明記すること。
 *   > 20問選んだ時は10個の表現がそれぞれ2回ずつ正解になるようにします。
 *
 * ── なぜ機械で見るのか ──────────────────────────────────────
 *
 *   この教材は**答えが先に決まっている**という、ほかに無い形である。
 *   窓口へ渡す「作り方」が1行欠けただけで、
 *
 *     ・正解がテキストの表現にならない
 *     ・1つの表現が1回しか出ない(**量をこなせない**)
 *     ・別解が選択肢に混ざって、**正解が2つある4択**になる
 *
 *   という壊れ方をする。**どれも `lint` も `build` も通り、
 *   実際に1本作って読むまで分からない**(= 課金してから分かる)。
 *
 * ── **いちばん危ない形を、検証の中に必ず1つ置く**(CLAUDE.md)────
 *
 *   ここでは「**表現が1つも引けなかったとき**」である。
 *   黙って0問の教材を作ると、**押した人には成功に見える。**
 * ============================================================================
 */
import { readFileSync } from 'node:fs'

const R = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')
/** コメントを落としてから数える(**説明の中の語に当たらない**・CLAUDE.md) */
const noC = (t) => t.replace(/\/\*[\s\S]*?\*\/|\{\/\*[\s\S]*?\*\/\}/g, '')

const D = await import('../src/lib/responseDrill.js')
const { DEFAULT_SECTIONS, defaultSectionsFor, sectionsFor, exerciseType }
  = await import('../src/data/exerciseTypes.js')
const { MATERIAL_KINDS, NEW_MATERIAL_KINDS, canShuffleKind, isResponseKind, needsWeakTag }
  = await import('../src/data/materialKinds.js')
const { EXAM_SOURCES } = await import('../src/lib/examBuild.js')

let bad = 0
const ok = (s, d = '') => console.log(`✓ ${s}${d ? ` — ${d}` : ''}`)
const ng = (s, d = '') => { bad += 1; console.log(`✗ ${s}${d ? `\n    ${d}` : ''}`) }
const is = (cond, name, d = '') => (cond ? ok(name, d) : ng(name, d))

console.log('\n▶ 教材の種類として、ちゃんと居るか')
{
  const row = MATERIAL_KINDS.find((k) => k.id === 'response')
  is(!!row && !!row.label && !!row.hint, '一覧に居て、呼び名と1行がある', row?.label)
  is(NEW_MATERIAL_KINDS.some((k) => k.id === 'response'),
    '新しく作れる種類に入っている(旧い扱いになっていない)')
  /* **判断は1か所。** 画面で `kind === 'response'` と書かないための関数 */
  is(isResponseKind('response') && !isResponseKind('exam') && !isResponseKind(''),
    '応答問題かどうかの判断が1か所にある(出る側と出ない側の両方)')
  /* **問が並ぶ教材なのでシャッフルできる。** 本文のある教材はできない */
  is(canShuffleKind('response') && !canShuffleKind('reading'),
    'シャッフルできる(本文の教材はできない)')
  /* **弱点タグは要らない** —— 何の練習かは「どの表現を正解にしたか」で決まる。
     **「出る」と「出ない」の両方を見る**(CLAUDE.md)—— 全部 `false` を
     返す形に書き換えても緑にならないよう、**まだ必須の種類が残っている**
     ことも数える。**どの種類かは書き写さない**(性質で見る) */
  const 必須が残る = NEW_MATERIAL_KINDS.some((k) => needsWeakTag(k.id))
  is(!needsWeakTag('response') && 必須が残る,
    '弱点タグを必須にしない(必須の種類は、ちゃんと残っている)',
    NEW_MATERIAL_KINDS.filter((k) => needsWeakTag(k.id)).map((k) => k.id).join(' / '))
}

console.log('\n▶ 構成は「リスニング + 理解」1つだけ')
{
  const plan = defaultSectionsFor('response')
  is(plan.length === 1 && plan[0].exercise_type === 'listening',
    '演習は1つだけで、リスニング + 理解である',
    plan.map((s) => s.exercise_type).join(','))
  /* **表の制約に無い演習を使っていないか** —— 使うと発行した瞬間に止まる */
  is(plan.every((s) => !!exerciseType(s.exercise_type)),
    '使っている演習が、ぜんぶ `exerciseTypes.js` にある')
  /* **問数を決め打ちしていないか。** 決め打つと、えらんでいないのに
     作れるように見える(いちばん危ない形) */
  is(DEFAULT_SECTIONS.response.every((s) => s.count === 0),
    '既定の問数は 0(えらぶまで「0 問」と正直に出す)')
  /* **黙って文型ドリルへ落ちていないか**(`[EXAM_KIND]` と同じ心配) */
  is(defaultSectionsFor('response')[0].exercise_type
    !== defaultSectionsFor('pattern')[0].exercise_type,
  '文型ドリルの構成に落ちていない')
}

console.log('\n▶ 問数は「表現の数 × 2」')
{
  /* **値を書き写さない。性質で見る**(CLAUDE.md)——
     `TIMES_PER_PHRASE` を変えた日に、期待値も一緒に動く形にする */
  const t = D.TIMES_PER_PHRASE
  is(t >= 2, '1つの表現は2回以上出る(量をこなすため)', `${t} 回`)
  is(D.RESPONSE_COUNTS.every((n) => n % t === 0),
    'えらべる問題数は、どれも回数で割り切れる', D.RESPONSE_COUNTS.join(' / '))
  is(D.RESPONSE_COUNTS.every((n) => D.phrasesNeeded(n) === n / t),
    '問題数 → 要る表現の数が、割り算どおり',
    D.RESPONSE_COUNTS.map((n) => `${n}→${D.phrasesNeeded(n)}`).join(' / '))
  const 五 = Array.from({ length: 5 }, (_, i) => ({ en: `a${i}`, ja: `あ${i}` }))
  is(D.questionsFrom(五) === 5 * t, '表現の数 → 問数が、掛け算どおり',
    `${D.questionsFrom(五)} 問`)
  /* **既定はいちばん軽いもの。** 多いほうを既定にすると、試しに1本作る
     だけで 30 問ぶん課金される */
  is(D.DEFAULT_RESPONSE_COUNT === Math.min(...D.RESPONSE_COUNTS),
    '既定の問題数は、いちばん軽いもの', `${D.DEFAULT_RESPONSE_COUNT} 問`)
}

console.log('\n▶ 構成の問数を、えらんだ表現から差し替える')
{
  const 三 = [{ en: 'a', ja: 'あ' }, { en: 'b', ja: 'い' }, { en: 'c', ja: 'う' }]
  const plan = D.responsePlan(sectionsFor('response'), true, 三)
  is(plan.length === 1 && plan[0].count === D.questionsFrom(三),
    '応答問題では、問数が「表現 × 回数」になる', `${plan[0]?.count} 問`)
  /* **「出ない」側も見る。** ほかの種類の問数を触ったら、
     文型ドリルが 40 問でなくなる */
  const drill = sectionsFor('pattern')
  is(D.responsePlan(drill, false, 三) === drill,
    '応答問題でなければ、構成に1つも触らない')
}

console.log('\n▶ 表現のえらび方')
{
  const rows = [
    { en: 'Totally.', ja: 'まったくその通り。' },
    { en: 'Not really.', ja: 'そうでもない。' },
    // **同じ英文**(大文字小文字だけ違う)。二度出してはいけない
    { en: 'totally.', ja: 'かぶり' },
    // **訳が無い**。答え合わせができないので入れない
    { en: 'No ja.', ja: '' },
    { en: 'After you.', ja: 'お先にどうぞ。' },
  ]
  const got = D.pickPhrases(rows, 10)
  is(got.length === 3, '訳の無いものと、かぶりを落とす', `${got.length} 個`)
  is(got.every((p) => p.en && p.ja), '英語と訳が、両方そろっている')
  /* **多すぎるときは、要るぶんだけ** */
  is(D.pickPhrases(rows, 2).length === D.phrasesNeeded(2),
    '要る数より多く引いても、要るぶんだけにする')
  /* ★ **いちばん危ない形**(CLAUDE.md)—— 1つも引けなかったとき。
       **黙って0問の教材を作らない** */
  const 空 = D.pickPhrases([], 10)
  is(空.length === 0 && /1つも/.test(D.responseNote(空, 10)),
    '1つも引けなければ、そう言う(黙って0問にしない)', D.responseNote(空, 10))
  /* **足りないときは、足りないと言う**(黙って絞らない) */
  const 足りない = D.responseNote(got, 10)
  is(/3/.test(足りない) && /6/.test(足りない),
    '足りないときは、引けた数と何問になるかを言う', 足りない)
  /* **足りているときは、足りないと言わない**(出る側と出ない側の両方) */
  const 足りる = D.responseNote(Array.from({ length: 5 },
    (_, i) => ({ en: `x${i}`, ja: `え${i}` })), 10)
  is(!/しか/.test(足りる) && /10/.test(足りる),
    '足りているときは、足りないと言わない', 足りる)
}

console.log('\n▶ 窓口へ渡す「作り方」')
{
  const 表現 = [
    { en: 'Totally.', ja: 'まったくその通り。' },
    { en: 'After you.', ja: 'お先にどうぞ。' },
  ]
  const 選 = D.responseBrief({ form: 'choices', phrases: 表現 })
  const 開 = D.responseBrief({ form: 'open', phrases: 表現 })

  /* **表現がそのまま載っているか。** 載っていなければ、
     何を正解にするのかが窓口に届かない */
  is(表現.every((p) => 選.includes(p.en) && 選.includes(p.ja)),
    '正解にする表現と訳が、そのまま入っている')
  /* **1つの表現を何回出すかが書いてあるか。値は書き写さない** */
  is(選.includes(`${D.TIMES_PER_PHRASE} 問`),
    '1つの表現を何回出すかが書いてある', `${D.TIMES_PER_PHRASE} 問`)
  /* **別解を書かせているか**(利用者の指定「別解を設け、明記すること」) */
  is(/answer_alt/.test(選) && /answer_alt/.test(開),
    'どちらの形でも、別解の欄を書かせている')
  /* ★ **別解を選択肢に入れさせない。**
       入ると**正解が2つある4択**になり、答え合わせができない */
  is(/別解は選択肢に入れない/.test(選),
    '選択肢ありのときは、別解を選択肢に入れさせない')
  /* **訳を書かせているか** —— 無いと Quick Response に回せない */
  is(/answer_ja/.test(選) && /answer_ja/.test(開), '応答の訳を書かせている')

  /* **選択肢ありと、選択肢なしで、本当に違うか**(出る側と出ない側) */
  is(選.includes('(A)') && 選.includes(`${D.CHOICE_COUNT}つ`),
    '選択肢ありでは、記号と数が書いてある')
  is(!開.includes('(A)') && /question は\*\*空にする/.test(開),
    '選択肢なしでは、設問を空にさせる')
  is(選 !== 開, '2つの形で、渡す文が違う')
  /* **表現が無ければ、空を返す**(中身の無い指示を送らない) */
  is(D.responseBrief({ phrases: [] }) === '', '表現が無ければ、空を返す')
  /* **既定の形は、選択肢あり**(利用者がまず見るのはそちら) */
  is(D.hasChoices(D.DEFAULT_RESPONSE_FORM) && !D.hasChoices('open'),
    '既定は選択肢あり(判断は `hasChoices()` 1か所)')
}

console.log('\n▶ 出どころ')
{
  const ids = D.RESPONSE_SOURCES.map((s) => s.id)
  is(ids.includes('text'), 'テキストがある')
  /* **単語帳と Quick Response 帳は、テストと分け合う**(書き写さない) */
  const 分け合う = EXAM_SOURCES.filter((s) => s.id !== 'material')
  is(分け合う.every((s) => D.RESPONSE_SOURCES.some((r) => r.id === s.id && r.label === s.label)),
    'ゲストの持ちものは、テストと同じ id と呼び名を使っている',
    分け合う.map((s) => s.id).join(' / '))
  /* **「教材」は出さない** —— 正解は覚えたい表現で、本文ではない */
  is(!ids.includes('material'), '「教材」は出さない(効かない操作を見せない)')
  /* **ゲストが要るかどうかの判断が1か所** */
  is(!D.needsLearner('text') && EXAM_SOURCES.filter((s) => s.id !== 'material')
    .every((s) => D.needsLearner(s.id)),
  'テキストはゲスト不要、持ちものは要る(判断は1か所)')
  is(D.usesTextBook(D.DEFAULT_RESPONSE_SOURCE), '既定はテキスト')
  /* **知らない id でも落ちない・化けない** */
  is(D.responseSourceLabel('nope') === '' && !D.usesTextBook('nope'),
    '知らない出どころは、空を返す(落ちない・化けない)')
}

console.log('\n▶ 画面と窓口まで、本当に通っているか')
{
  const form = noC(R('src/components/MaterialForm.jsx'))
  /* **素の関数だけ見ると、画面が呼んでいなくても緑になる**(第5.330節で踏んだ) */
  is(/responsePlan\(/.test(form), '画面が、問数を差し替える関数を通している')
  is(/responseBrief\(\{\s*form: resForm, phrases: resPhrases\s*\}\)/.test(form),
    '画面が、えらんだ表現と形を「作り方」に渡している')
  is(/loadResponseRows\(/.test(form), '画面が、出どころから引く関数を呼んでいる')
  /* **作り方を1か所に寄せたか。** 4か所に書き写すと、必ず片方が古くなる */
  const 寄せた = (form.match(/examPart: makeBrief\(\)/g) ?? []).length
  is(寄せた >= 4 && !/examPart: isExamKind/.test(form),
    '「作り方」を1か所に寄せている(4か所の書き写しが残っていない)',
    `${寄せた} か所が同じ関数を通る`)
  /* **一覧を画面に書き写していないか** */
  is(!/\[10, 20, 30\]/.test(form), '問題数の一覧を、画面に書き写していない')
  is(!/'choices'|'open'/.test(form.replace(/resPick === 'manual'/g, '')),
    '出し方の id を、画面に書き写していない')
  /* **表現をえらぶ前に作らせないか** */
  is(/resOn && resPhrases\.length === 0/.test(form),
    '表現をえらぶ前は、作るボタンを押せない')
  /* ★ **倍率の欄を出していないか**(2026-10-01 実機・利用者の指摘)。

       > 応答問題の問題数、0, 0、3倍という意味がわかりません。

     問数は上でえらんだ問題数と表現で決まっているので、**同じことを
     決める場所が2つ**になっていた。しかも既定が 0 問なので
     「標準 0 / 倍 0 / 3倍 0」と出ていた。
     **出る側と出ない側の両方を見る**(CLAUDE.md)——
     ほかの種類では、いままでどおり出ること */
  const 倍率 = form.match(/\{\s*(!?[^\n]*?)\s*\n?\s*&&\s*defaultSectionsFor\(kind\)\.some/)
  is(/!isResponseKind\(kind\)/.test(倍率?.[0] ?? ''),
    '応答問題には、問数の倍率の欄を出さない', 倍率?.[1] ?? '(見つからない)')
  is(/defaultSectionsFor\(kind\)\.some\(\(s2\) => SCALABLE_SECTIONS/.test(form),
    'ほかの種類には、いままでどおり倍率の欄を出す')

  /* **SQL も見る。** 制約に `response` が無いと、発行した瞬間に止まる */
  const sql = R('supabase/apply/pending_matome.sql')
  is(/'response'/.test(sql), '貼る SQL に、種類の値が入っている')
  const chk = R('supabase/apply/check.sql')
  is(/'%''response''%'/.test(chk), '利用者が見る確認 SQL に、行がある')
}

console.log(bad === 0 ? '\n✅ 応答問題の検証は、すべて意図どおりです' : `\n❌ ${bad} 件`)
process.exit(bad === 0 ? 0 : 1)
