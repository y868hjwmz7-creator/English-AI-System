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
/* ★ **重複を見る鍵**（第5.345節）。`materials.js` から出してあるので、
     **素の node でそのまま測れる**（あちらは `import.meta.env` を引き連れている） */
const K = await import('../src/lib/dedupKeys.js')
/* ★ **作り直しの回数**（第5.347節） */
const A = await import('../src/lib/genAttempts.js')
const { DEFAULT_SECTIONS, defaultSectionsFor, sectionsFor, exerciseType }
  = await import('../src/data/exerciseTypes.js')
const { MATERIAL_KINDS, NEW_MATERIAL_KINDS, canShuffleKind, isResponseKind, needsWeakTag,
  repeatsAnswer }
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
  /* **訳を書かせているか** —— 無いと Quick Response に回せない */
  is(/answer_ja/.test(選) && /answer_ja/.test(開), '応答の訳を書かせている')
  /* ★ **選択肢について、AI に何も言わなくなった**(第5.350節)。

       第5.344節では「別解を選択肢に入れない」「正解に似せない」
       「音の似た語を混ぜない」を**作り方の文で**言っていた。
       **2度めの指摘で、指示では直らないと分かった**ので、
       **選択肢はこちらで組み立てる**ことにした(`responseChoices.js`)。

       だから、ここで作り方の文を見る見張りは**下の節へ移してある** ——
       「誤りが1つも重複しない」「ほかの問の正解が出てこない」
       「長さで見分けられない」を、**組み立てた結果そのもので**測る。
       **決まりは1つも軽くなっていない。見る場所が変わっただけである。** */
  is(!/音が似/.test(選), '応答問題では「音の似た語を混ぜる」と書いていない')
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

console.log('\n▶ 解答の音声を、開く前に支度しているか(第5.334節)')
{
  /* ★ 2026-10-01 実機・利用者の指摘。

       > しかもロードが遅いです。開く前に音声が完成していてすぐに
       > 聴けるという仕様はどこに行ってしまったのですか？

     測ったら、30 問の応答問題で**質問 30 本・解答 0 本**だった ——
     支度(`sectionRestClips`)は `audioTextOf()` しか見ておらず、
     あれは**その演習の読み上げ欄**(リスニングなら `audio_text`)を返す。
     **応答問題では、解答こそが練習したい表現**である。

     **「出る」と「出ない」の両方を見る**(CLAUDE.md)——
     応答問題では解答が入り、**テスト対策では入らない**
     (ほかの種類まで入れると、押さなかった解答の音声まで課金になる)。 */
  const { sectionRestClips } = await import('../src/lib/audioPlaylist.js')
  const { answerHasAudio } = await import('../src/data/exerciseTypes.js')
  /* **いちばん危ない形を1つ置く**(CLAUDE.md)——
     **解答が空の問**。入れてしまうと、空の英文で窓口を呼ぶ */
  const items = [
    { question: 'Q1', audio_text: 'Q1 spoken', answer: 'Me too.', answer_ja: '私も' },
    { question: 'Q2', audio_text: 'Q2 spoken', answer: 'Not yet.', answer_ja: 'まだ' },
    { question: 'Q3', audio_text: 'Q3 spoken', answer: '  ', answer_ja: '' },
  ]
  const mat = (kind) => ({
    kind, voiceIds: [], tags: [],
    sections: [{ exercise_type: 'listening', items }],
  })
  /* **値を書き写さない。性質で見る**(CLAUDE.md)——
     「5本」と書くと、問を1つ足した日に見張りだけが古くなる */
  const 解答のある問 = items.filter((it) => D.answerSpeakText(it)).length
  const 質問 = items.length
  const 応答 = sectionRestClips(mat('response'), mat('response').sections[0])
  is(応答.length === 質問 + 解答のある問,
    '応答問題では、質問と解答の両方を支度する',
    `${応答.length} 本 = 質問 ${質問} + 解答 ${解答のある問}`)
  is(応答.some((c) => c.text === 'Me too.'),
    '支度する英文が、解答そのものになっている')
  is(!応答.some((c) => !String(c.text ?? '').trim()),
    '解答が空の問は、支度しない(空の英文で窓口を呼ばない)')
  /* **声も段も、画面(`AnswerEn` → `SpeakButton`)とまったく同じ**で
     なければ、**支度した音声が1本も当たらない**(= 待つ + 二度課金) */
  const 質問の札 = 応答.find((c) => c.text === 'Q1 spoken')
  const 解答の札 = 応答.find((c) => c.text === 'Me too.')
  is(質問の札?.voiceId === 解答の札?.voiceId && 質問の札?.tier === 解答の札?.tier,
    '解答の声と段が、質問とまったく同じ(置き場所が食い違わない)',
    `${解答の札?.tier} / ${解答の札?.voiceId}`)
  /* **出ない側。** テスト対策も同じリスニングの段だが、解答は支度しない */
  const テスト = sectionRestClips(mat('exam'), mat('exam').sections[0])
  is(テスト.length === 質問 && !テスト.some((c) => c.text === 'Me too.'),
    'テスト対策では、解答を支度しない(ほかの種類に広げていない)',
    `${テスト.length} 本`)
  /* **解答が英語の演習でなければ、支度しない。**
     ここを見ずに足すと、英文和訳(`translate_en_ja`)の**日本語の解答**を
     英語の声で読ませることになる(判断は `answerHasAudio()` 1か所)。 */
  const 聞ける = noC(R('src/lib/audioPlaylist.js'))
  is(/answerHasAudio\(section\.exercise_type\)/.test(聞ける),
    '読み上げが付く解答だけに絞っている(判断は answerHasAudio 1か所)')
  is(answerHasAudio('listening') && !answerHasAudio('translate_en_ja'),
    'その判断そのものが、出る側と出ない側で分かれている')
  /* **欄を書き写していないか。** 聞き流しと支度で別の欄を読むと、
     置き場所が食い違って1本も当たらない(CLAUDE.md) */
  is(/answerSpeakText\(it\)/.test(聞ける) && !/it\?\.answer \?\? ''/.test(聞ける),
    '解答の欄を、支度の側に書き写していない(answerSpeakText 1か所)')
}

console.log('\n▶ 読み上げられる文 → 応答 の対で並べられるか(第5.355節)')
{
  /* ★ 2026-10-03 実機・利用者の指定。

       > 応答問題、VERSANT PART Aなど、応答系の問題の聞き流しが、
       > 解答の正解の選択肢が読み上げられるだけになっています。
       > 読み上げられる文→応答（正解の選択肢）だからこそ聞き流しの意味が
       > あるというものです。

     **これまでは応答(正解)だけを並べていた**(第5.334節)。
     聞くほうには**何への応答なのかが分からない。**

     **種類(`kind`)では見分けない** —— 応答問題も VERSANT Part A も
     同じ `listening` である(`asksAndReplies()` 1か所)。 */
  const { responseAnswers } = await import('../src/lib/audioPlaylist.js')
  const mat = {
    kind: 'response', voiceIds: [], tags: [],
    sections: [
      { exercise_type: 'listening', items: [
        { audio_text: 'Can you help me?', prompt_ja: '手伝ってくれる?',
          answer: 'Me too.', answer_ja: '私も' },
        /* **いちばん危ない形を1つ**(CLAUDE.md)—— 応答の無い問 */
        { audio_text: 'Q2', answer: '', answer_ja: 'から' },
      ] },
      { exercise_type: 'listening', items: [
        { audio_text: 'Are you done?', answer: 'Not yet.', answer_ja: 'まだ' },
      ] },
    ],
  }
  const got = responseAnswers(mat)
  is(got.length === 2, '応答の無い問は落とす', `${got.length} 件`)
  is(got[0]?.en === 'Me too.' && got[1]?.en === 'Not yet.',
    '段をまたいで、出た順に並ぶ')
  is(got[0]?.ja === '私も', '応答の訳も添える')
  /* ★ **ここが第5.355節そのもの。** 読み上げられる文が入っているか */
  is(got[0]?.ask === 'Can you help me?' && got[1]?.ask === 'Are you done?',
    '読み上げられる文が、対で入っている', got[0]?.ask)
  is(got[0]?.askJa === '手伝ってくれる?', '読み上げられる文の訳も、対で入っている')

  /* ★ **読み上げる欄を書き写していないか**(CLAUDE.md「数え方を2通り
       持たない」)。`audio_text` と書き写すと、**読み方を直した英文**
       (`audioTextOf()` が選ぶ)と別の音声を探すことになる */
  const pl = noC(R('src/lib/audioPlaylist.js'))
  const 対 = pl.match(/export function responseAnswers[\s\S]*?\n\}/)?.[0] ?? ''
  is(/ask: audioTextOf\(it, type\)/.test(対),
    '読み上げる欄は audioTextOf() 1か所(書き写していない)')
  is(/askJa: audioJaOf\(it, type\)/.test(対),
    '訳の欄も audioJaOf() 1か所')

  /* **出る側 / 出ない側**(CLAUDE.md)。
     **テスト対策(VERSANT Part A)でも鳴る** —— そこが利用者の指定である。
     出ないのは「応答する段が1つも無い教材」のほう */
  is(responseAnswers({ ...mat, kind: 'exam' }).length === got.length,
    'テスト対策(VERSANT Part A)でも、同じだけ並ぶ')
  /* ★ **いちばん近い相手で測る**(CLAUDE.md)。
       `read_aloud` のように**解答そのものが無い**段で測ると、
       「解答に読み上げが付くか」だけで落ちてしまい、
       **「問を隠しているか」の半分が1度も効かない**(赤チェックで緑だった)。
       `fill_blank` は**解答に読み上げが付く**が、**問は画面に出ている** */
  const 別の段 = { ...mat, sections: [{ exercise_type: 'fill_blank', items: [
    { audio_text: 'x', answer: 'y' }] }] }
  is(responseAnswers(別の段).length === 0,
    '応答する段が無ければ、1件も返さない(穴うめの段では鳴らさない)')
  /* **いちばん危ない形**(CLAUDE.md)—— 段が1つも無い教材 */
  is(responseAnswers({ kind: 'response' }).length === 0 && responseAnswers(null).length === 0,
    '段が1つも無い教材でも落ちない')
  /* **判断を2か所に持っていないか。** `asksAndReplies()` 1か所である */
  is(/asksAndReplies\(type\)/.test(対) && !/isResponseKind|kind ===/.test(対),
    '種類では見分けない(判断は asksAndReplies 1か所)')
  const { asksAndReplies } = await import('../src/data/exerciseTypes.js')
  const { answerHasAudio, exerciseType } = await import('../src/data/exerciseTypes.js')
  /* **2つの条件が、どちらも効いているか。**
     ①解答に読み上げが付く(`read_aloud` は付かない)
     ②問を聞くほうに見せていない(`fill_blank` は見せている) */
  is(asksAndReplies('listening') && !asksAndReplies('read_aloud'),
    '解答に読み上げの付かない段では、鳴らさない')
  is(!asksAndReplies('fill_blank') && answerHasAudio('fill_blank')
    && !exerciseType('fill_blank')?.hidePromptFromLearner,
    '問が画面に出ている段では、鳴らさない(読み上げられる文が無いため)')
}

console.log('\n▶ 応答の聞き流し(第5.334節 / 第5.355節)')
{
  /* ★ 2026-10-01 利用者の指定。

       > その上で、応答問題には正解の聞き流しモードを作ります。
       > 問題順をシャッフルもできる仕様です。

     **新しい画面を作っていない。** 聞き流し(`WordRadio`)は
     「音声が自動で進み、間を選べて、やめるまで回りつづける」——
     **必要なものが、もうぜんぶ在る**(`radioSteps` の節と同じ考え方)。
     足りなかったのは**何を鳴らすか**だけである。 */
  const { responseRadioRows } = await import('../src/lib/audioPlaylist.js')
  const { radioVoiceOf, radioTextOf, radioJaOf, radioAskOf, radioAskJaOf,
    radioList, radioSteps, radioModesFor, radioGapsOf, hidesAnswer, RADIO_ORDERS,
    DEFAULT_RADIO_GAP, DEFAULT_SAY_GAP } = await import('../src/lib/wordRadio.js')
  const mat = {
    kind: 'response', voiceIds: [], tags: [],
    sections: [{ exercise_type: 'listening', items: [
      { audio_text: 'Could you give me a hand?', prompt_ja: '手伝ってもらえますか。',
        answer: 'I appreciate your help.', answer_ja: '助かります。' },
      { audio_text: 'Q2', answer: 'Not yet.', answer_ja: 'まだ' },
      { audio_text: 'Q3', answer: '  ' },
    ] }],
  }
  const rows = responseRadioRows(mat)
  const 応答のある問 = mat.sections[0].items.filter((it) => D.answerSpeakText(it)).length
  is(rows.length === 応答のある問, '応答のある問だけが並ぶ',
    `${rows.length} 件 / 応答のある問 ${応答のある問}`)
  /* **聞き流しが読む欄に、そのまま入っているか。**
     ここが食い違うと、**1件も鳴らずに素通りする**(`radioTextOf` が空を返す) */
  is(rows.every((r) => radioTextOf(r)) && radioTextOf(rows[0]) === 'I appreciate your help.',
    '応答が、聞き流しが読む欄(`radioTextOf`)に入っている', radioTextOf(rows[0]))
  is(radioJaOf(rows[0]) === '助かります。', '応答の訳も、聞き流しが読む欄に入っている')
  /* ★ **第5.355節。** 読み上げられる文も、聞き流しが読む欄に入っているか */
  is(radioAskOf(rows[0]) === 'Could you give me a hand?',
    '読み上げられる文が、聞き流しが読む欄(`radioAskOf`)に入っている')
  is(radioAskJaOf(rows[0]) === '手伝ってもらえますか。',
    'その訳も、聞き流しが読む欄(`radioAskJaOf`)に入っている')

  /* ★ **対で鳴るか**(第5.355節)。
       **並べ方は `radioSteps()` 1か所** —— 画面の中で組み立てない。
       **値を書き写さない。性質で見る**(CLAUDE.md)—— 「2本め」ではなく
       「英語が鳴る順が、読み上げられる文 → 応答になっているか」で見る */
  const 英 = (steps) => steps.filter((s) => s.kind === 'en').map((s) => s.text)
  const 日 = (steps) => steps.filter((s) => s.kind === 'ja').map((s) => s.text)
  /* **読み方の id を書き写さない。** `hidesAnswer()` が
     「答えを隠すほう = 言う練習」を教える(判断は1か所) */
  const 読み方 = radioModesFor('qr')
  const 言うid = 読み方.find((m) => hidesAnswer(m.id))?.id
  const 聞くid = 読み方.find((m) => !hidesAnswer(m.id))?.id
  is(言うid && 聞くid, '聞き流しに「聞く」と「言う」が、両方そのまま在る',
    読み方.map((m) => m.label).join(' / '))
  const 聞 = radioSteps(rows[0], 聞くid, DEFAULT_RADIO_GAP)
  is(英(聞).join(' / ') === 'Could you give me a hand? / I appreciate your help.',
    '聞き流しは、読み上げられる文 → 応答 の順に鳴る', 英(聞).join(' / '))
  /* **いちばん危ない形を1つ**(CLAUDE.md)—— **読み上げの文の訳が無い問。**
     ここで黙って落とすと、訳の無い問だけ**応答しか鳴らなくなる** */
  const 訳なし = radioSteps(rows[1], 聞くid, DEFAULT_RADIO_GAP)
  is(英(訳なし).join(' / ') === 'Q2 / Not yet.',
    '読み上げの文の訳が無くても、英語は対で鳴る', 英(訳なし).join(' / '))
  /* **間を置いているか。** 続けて鳴ると、どちらが応答か分からない */
  const 間 = 聞.findIndex((s) => s.kind === 'wait')
  is(間 > 0 && 間 < 聞.length - 1, '読み上げられる文と応答のあいだに、間がある')

  /* ★ **日本語 → 英語でも同じ**(利用者の指定)。
       **読み上げの文(日)→ 応答(日)→ 読み上げの文(英)→ 応答(英)** */
  const 言 = radioSteps(rows[0], 言うid, DEFAULT_SAY_GAP)
  is(日(言).join(' / ') === '手伝ってもらえますか。 / 助かります。',
    '言う練習は、読み上げの文(日)→ 応答(日)の順に出る', 日(言).join(' / '))
  is(英(言).join(' / ') === 'Could you give me a hand? / I appreciate your help.',
    'そのあと、読み上げの文(英)→ 応答(英)の順に鳴る', 英(言).join(' / '))
  /* **日本語が2つとも、英語より先に出ているか**(順が入れ替わっていない) */
  const 日の位置 = 言.map((s, n) => (s.kind === 'ja' ? n : -1)).filter((n) => n >= 0)
  const 英の位置 = 言.map((s, n) => (s.kind === 'en' ? n : -1)).filter((n) => n >= 0)
  is(Math.max(...日の位置) < Math.min(...英の位置),
    '日本語2つが、英語2つより先に出る(日→日→英→英)')
  /* **言う番(自分で言う間)が、英語の前にあるか** */
  const 言う番 = 言.findIndex((s) => s.you)
  is(言う番 > Math.max(...日の位置) && 言う番 < Math.min(...英の位置),
    '自分で言う間が、日本語のあとで英語の前にある')

  /* ★ **出ない側。** ふつうの行(単語帳・Quick Response)は1ミリも変わらない ——
       あちらに `ask` は無いので、**これまでどおり1本だけ鳴る** */
  const 素 = radioSteps({ en: 'Hello.', ja: 'こんにちは' }, 聞くid, DEFAULT_RADIO_GAP)
  /* ★ **英文だけで見ない。** ふつうの行は英文が2回なので、対にしてしまっても
       **同じ2本に見える**(実際、赤チェックで緑のままだった)。
       **間の長さが違う** —— ふつうの行は「くり返しの間」、
       対は「語と語の間」である。**値は書き写さず、作る側から読み取る** */
  const 間の = radioGapsOf(DEFAULT_RADIO_GAP, 聞くid)
  const 待ち = (steps) => steps.filter((s) => s.kind === 'wait').map((s) => s.ms)
  is(英(素).join(' / ') === 'Hello. / Hello.' && 待ち(素).join() === String(間の.repeat),
    '単語帳と Quick Response は、これまでどおり(くり返しの間で2回)',
    `${英(素).join(' / ')} / 間 ${待ち(素).join()}ms`)
  is(待ち(聞).join() === String(間の.word) && 間の.word !== 間の.repeat,
    '対で鳴らすときは、語と語の間(くり返しの間ではない)',
    `${待ち(聞).join()}ms ≠ くり返し ${間の.repeat}ms`)
  is(!radioAskOf({ en: 'Hello.' }) && !radioAskJaOf(null),
    '読み上げられる文の無い行では、空を返す')

  /* ★ **声と段は、支度(`sectionRestClips`)から引いているか。**
       書き写すと、**支度した MP3 に1本も当たらない**(待ち + 二度課金)。
       **第5.355節で、引く鍵が「応答」から「読み上げられる文」に変わった** ——
       あちらはどの教材でも支度してあるので、テスト対策でも当たる */
  const { sectionRestClips } = await import('../src/lib/audioPlaylist.js')
  const 支度 = sectionRestClips(mat, mat.sections[0])
    .find((c) => c.text === 'Could you give me a hand?')
  const 声 = radioVoiceOf(rows[0])
  is(声.clipVoice === 支度?.voiceId && 声.clipTier === 支度?.tier,
    '聞き流しの声と段が、支度した音声とまったく同じ',
    `${声.clipTier} / ${声.clipVoice}`)
  /* **テスト対策でも声が引けるか**(応答で引いていたら、ここが空になる) */
  const 試 = responseRadioRows({ ...mat, kind: 'exam' })
  is(radioVoiceOf(試[0]).clipVoice === 支度?.voiceId,
    'テスト対策でも、支度した声が引ける(読み上げられる文で引いている)')
  /* **出ない側。** 単語帳と Quick Response の行には `clipVoice` が無いので、
     **あの2つは1ミリも変わらない** */
  is(Object.keys(radioVoiceOf({ en: 'x' })).length === 0
    && Object.keys(radioVoiceOf(null)).length === 0,
    '声の渡っていない行では、これまでどおり(単語帳と QR は変わらない)')
  /* **段が分からないときは渡さない。** 当て推量で `standard` と書くと、
     良い声で支度したものを取りに行かなくなる(= もう一度作る) */
  is(!('clipTier' in radioVoiceOf({ clipVoice: 'us-female' })),
    '段が分からないときは、段を当て推量で渡さない')
  /* **応答する段が1つも無ければ、聞き流しに渡すものが無い** */
  is(responseRadioRows({ ...mat, sections: [{ exercise_type: 'read_aloud',
    items: [{ audio_text: 'x', answer: 'y' }] }] }).length === 0
    && responseRadioRows(null).length === 0,
    '応答する段が無ければ、聞き流しに渡すものが無い')

  /* ★ **問題順のシャッフル**(利用者の指定)。
       **混ぜ方を2つ持たない** —— 聞き流しがもう持っている
       「ランダム」(`radioList`)に載せる。だから `responseRadioRows()` は
       **混ぜない**(渡す前に混ぜると、あちらの欄と二重になる) */
  is(RADIO_ORDERS.some((o) => o.id === 'shuffle') && RADIO_ORDERS.some((o) => o.id === 'seq'),
    '聞き流しに「出た順」と「ランダム」の両方がある')
  const 多い = Array.from({ length: 24 }, (_, i) => ({ en: `s${i}`, ja: '' }))
  const 出た順 = radioList(多い, 'seq', 'all').map((r) => r.en).join(',')
  const 混ぜた = Array.from({ length: 8 },
    () => radioList(多い, 'shuffle', 'all').map((r) => r.en).join(','))
  is(出た順 === 多い.map((r) => r.en).join(','), '「出た順」は、並べ替えない')
  is(混ぜた.some((x) => x !== 出た順), '「ランダム」は、並びが変わる')
  /* **渡す側が混ぜていないこと。** 二重に混ぜると「出た順」が効かなくなる */
  const pl = noC(R('src/lib/audioPlaylist.js'))
  is(!/shuffled\(/.test(pl), '渡す側では混ぜていない(混ぜ方を2つ持たない)')

  /* ★ **画面が本当に通しているか。**
       素の関数だけ見ると、**画面が渡していなくても緑になる**(第5.330節で踏んだ) */
  const lv = noC(R('src/components/LessonView.jsx'))
  is(/responseRadioRows\(material\)/.test(lv),
    'レッスン表示が、聞き流しに渡す一覧を引いている')
  is(/<WordRadio[\s\S]{0,400}rows=\{answerRadio\}/.test(lv),
    'レッスン表示が、その一覧で `WordRadio` を描いている')
  is(/answerRows\.length > 0 && \(/.test(lv),
    '応答が1つも無ければ、ボタンごと出さない(行き止まりを作らない)')
  /* ★ **呼び名**(第5.355節)。「正解を聞き流す」では、
       鳴るものが正解だけだと読める —— **いまは対で鳴る** */
  is(/応答を聞き流す/.test(lv) && !/正解を聞き流す/.test(lv),
    '画面の呼び名が「応答を聞き流す」になっている')
  /* **判断を画面に置いていないか**(置く場所の数だけ食い違う) */
  is(!/isResponseKind\(/.test(lv),
    'レッスン表示は、応答問題かどうかを一度も見ない(判断は1か所)')
  /* ★ **鳴らす側と先読みする側の両方が、同じ声を通っているか。**
       片方だけだと、**先読みが別の声を取りに行って二度課金**になる
       (`materialRestClips` で踏んだのと同じ形・第5.289節) */
  const wr = noC(R('src/components/WordRadio.jsx'))
  is(/readAloud\(st\.text, \{ rate, \.\.\.radioVoiceOf\(row\) \}\)/.test(wr),
    '聞き流しが鳴らすとき、その行の声で鳴らす')
  is(/prepareRead\(w\.text, w\.ja[\s\S]{0,120}: radioVoiceOf\(次の行\)\)/.test(wr),
    '聞き流しが先読みするときも、同じ声を取りに行く')
  /* **骨組みは、本物と1文字も違えない**(CLAUDE.md)——
     応答問題の教材が骨組みに無いと、ボタンが1度も描かれない */
  const sc = noC(R('src/__screens.jsx'))
  is(/kind: 'response'/.test(sc), '骨組みに、応答問題の教材がある')
  is(/asResponse = q\.get\('kind'\) === 'response'/.test(sc),
    '骨組みを `?kind=response` で開ける')
  /* **いちばん危ない形を、骨組みの中に1つ置く**(CLAUDE.md)——
     **英文の無い問**。落とさなければ、空の英文で窓口を呼ぶ */
  const 骨 = sc.match(/id: 'test-response'[\s\S]*?\n\} : asExam/)?.[0] ?? ''
  is(/answer: ''/.test(骨), '骨組みの応答問題に、英文の無い問が混ざっている')
}

console.log('\n▶ 正解が、本当に「応答」になるか(第5.344節)')
{
  /* ★ 2026-10-02 実機・利用者の指摘。

       > 変ですよね、独り言はなしにしましょう！
       > 純粋に応答としてふさわしいものを解答にします

     実機ではこの2つが出ていた。**どちらも応答になっていない。**

       Mom, I want to show you my new dance moves!  → Look at me.
         … **同じ子どもの続きのセリフ**(独り言)
       Will you be paying with cash or credit card today? → Cash or charge?
         … **同じ店員の言い換え**(おうむ返し)

     **見る語は、決まりの中身そのもの**にする ——
     「入れ替わる」「続きのセリフ」「おうむ返し」の3つが、この決まりである。 */
  const 選 = D.responseBrief({ form: 'choices', phrases: [{ en: 'After you.', ja: 'お先にどうぞ。' }] })
  const 開 = D.responseBrief({ form: 'open', phrases: [{ en: 'After you.', ja: 'お先にどうぞ。' }] })
  const 決まり = ['入れ替わる', '続きのセリフ', 'おうむ返し']
  const 欠け = 決まり.filter((w) => !選.includes(w))
  is(!欠け.length, '話す人が入れ替わり、独り言もおうむ返しも禁じている',
    欠け.length ? `欠けている: ${欠け.join(' / ')}` : 決まり.join(' / '))

  /* ★ **形(選択肢あり / なし)で分けていないか。**
       独り言になっていたのは**正解そのもの**であって、誤りの選択肢ではない。
       下の `形` の側へ入れると、**選択肢なしのときだけ直らない** ——
       **いちばん危ない形を、検証の中に必ず1つ置く**(CLAUDE.md) */
  const 片方だけ = 決まり.filter((w) => 選.includes(w) !== 開.includes(w))
  is(!片方だけ.length, '選択肢なしの形でも、まったく同じ決まりが出る',
    片方だけ.length ? `選択肢ありにしか無い: ${片方だけ.join(' / ')}` : '2つの形で同じ')

  /* **実機で出た2つの例が、そのまま入っているか。**
     言葉で言うより、**外した形を1つ見せる**ほうが効く(第5.339節と同じ) */
  const 例 = ['Look at me.', 'Cash or charge?']
  is(例.every((x) => 選.includes(x)), '実機で出た「応答になっていない例」を見せている',
    例.join(' / '))

  /* ★ **窓口へ届く長さ。**(2026-10-02 実測)

       この欄(`examPart`)は**テスト対策と分け合っている**(第5.332節)。
       応答問題は**正解にする表現をそのまま並べて送る**ので、
       文の長い Native Flow を 15 個えらぶと**上限を超え、
       末尾の表現が黙って消える** —— 消えたぶんだけ問が少なく作られる。

       **上限を書き写さない。窓口から読み取る**(第5.340節と同じ作法)。
       **いちばん長くなる形で測る** ——
       「選べるいちばん多い問数」で、「実データのいちばん長い表現」を並べる。 */
  const fn = R('supabase/functions/generate-material/index.ts')
  const 上限 = Number(/examPart[^\n]*slice\(0,\s*(\d+)\)/.exec(fn)?.[1])
  const { nativeFlowRows } = await import('../src/data/nativeFlow.js')
  const 長い順 = [...nativeFlowRows()].sort((a, b) =>
    (String(b.en ?? '') + String(b.ja ?? '')).length
    - (String(a.en ?? '') + String(a.ja ?? '')).length)
  const 要る = D.phrasesNeeded(Math.max(...D.RESPONSE_COUNTS))
  const 最長 = D.RESPONSE_FORMS
    .map((f) => [f.id, D.responseBrief({ form: f.id, phrases: 長い順.slice(0, 要る) }).length])
    .sort((a, b) => b[1] - a[1])[0]
  if (!上限) {
    ng('長さ … 窓口の上限を読み取れない(探し方が壊れている)')
  } else if (最長[1] > 上限) {
    ng(`長さ … 窓口の上限 ${上限} 文字を超えている(末尾の表現が黙って消える)`,
      `${最長[0]} … ${最長[1]} 文字 / 表現 ${要る} 個`)
  } else if (最長[1] > 上限 * 0.95) {
    ng(`長さ … 上限 ${上限} 文字まで、あと ${上限 - 最長[1]} 文字しかない`,
      `${最長[0]} … ${最長[1]} 文字`)
  } else {
    ok(`長さ … いちばん長い形(${最長[0]}・表現 ${要る} 個)で ${最長[1]} 文字`
      + `(窓口の上限 ${上限} 文字の ${Math.round(最長[1] / 上限 * 100)}%)`)
  }
}


console.log('\n▶ えらんだ問数が、そのまま出来るか(第5.345節)')
{
  /* ★ 2026-10-02 実機・利用者の指摘。

       > 応答問題で15個のフレーズをテキストから入れる、を選択すると
       > その倍の問題数30を選択していて、そうなるはずなのに、
       > 15問になってしまっています。
       > 恐らく指定できる問題数全てで同じ仕様になってしまっています

     **重複を見る鍵に `answer` が入っていた。**
     応答問題は**1つの表現を2回、正解にする**設計なので、
     **2回目が1問残らず「前に出した英文」として落ちていた** —— きっちり半分。

     **実データの形で測る**(決まりだけ見ても足りない・第5.341節で学んだ)。 */
  const 要る = D.phrasesNeeded(Math.max(...D.RESPONSE_COUNTS))
  const 表現 = Array.from({ length: 要る }, (_, i) => `Phrase number ${i}.`)
  /** 1つの表現が `TIMES_PER_PHRASE` 回、正解になる問の一覧(窓口が返す形) */
  const 作られた = []
  for (let r = 0; r < D.TIMES_PER_PHRASE; r += 1) {
    for (const en of 表現) 作られた.push({ audio_text: `Question ${r} for ${en}`, answer: en })
  }
  const 欲しい数 = D.questionsFrom(表現.map((en) => ({ en, ja: 'え' })))

  /* ── ① **応答問題では、同じ解答が何度出ても落ちない** ── */
  const 応答 = K.dropDuplicates(作られた, new Set(), repeatsAnswer('response'))
  is(応答.kept.length === 欲しい数,
    `応答問題では、${欲しい数} 問がそのまま残る(解答が ${D.TIMES_PER_PHRASE} 回出ても落ちない)`,
    `残った ${応答.kept.length} 問 / 落ちた ${応答.dropped.length} 問`)

  /* ── ② **出ない側。** ふつうの教材では、これまでどおり落ちる ──
         ここを見ないと、**どの教材でも落とさない形**に書き換えても緑のまま */
  const ふつう = K.dropDuplicates(作られた, new Set(), repeatsAnswer('pattern'))
  is(ふつう.kept.length === 表現.length,
    'ふつうの教材では、同じ解答は、これまでどおり落ちる',
    `残った ${ふつう.kept.length} 問`)

  /* ── ③ **いちばん危ない形。** 緩めすぎていないか ──
         **読み上げる質問が同じなら、応答問題でも落とす**
         (作り方も「同じ質問を繰り返さない」と言っている) */
  const 同じ質問 = [
    { audio_text: 'Shall we go over the numbers?', answer: 'Sounds good.' },
    { audio_text: 'Shall we go over the numbers?', answer: 'After you.' },
  ]
  const 質問かぶり = K.dropDuplicates(同じ質問, new Set(), repeatsAnswer('response'))
  is(質問かぶり.kept.length === 1,
    '応答問題でも、読み上げる質問が同じものは落ちる',
    `残った ${質問かぶり.kept.length} 問`)

  /* ── ④ **判断は1か所か。** 画面でも `materials.js` でも
         `kind === 'response'` と書いていないか */
  const 自前 = ['src/components/MaterialForm.jsx', 'src/lib/materials.js']
    .filter((f) => /kind === 'response'/.test(noC(R(f))))
  is(!自前.length, "判断は `repeatsAnswer()` 1か所(画面でも `kind === 'response'` と書かない)",
    自前.join(' / '))
  is(repeatsAnswer('response') && !repeatsAnswer('exam') && !repeatsAnswer(''),
    '応答問題だけが真(テスト対策の Part 2 は、同じ応答が2回出たら本当の重複)')

  /* ── ⑤ **画面が、本当に渡しているか** ──
         **素の関数だけ見ると、画面が渡していなくても緑になる**(第5.330節で踏んだ) */
  const form = noC(R('src/components/MaterialForm.jsx'))
  is(/repeatAnswer: repeatsAnswer\(kind\)/.test(form),
    '画面が、生成の呼び出しに判断を渡している')

  /* ── ⑥ **落とす検査ぜんぶに通っているか** ──
       ★ **1か所でも渡し忘れると、そこで落ちて半分に戻る。**
         `generateSectionUnique` の中の呼び出しを**1つずつ数える** */
  const mat = noC(R('src/lib/materials.js'))
  const 中身 = mat.slice(mat.indexOf('export async function generateSectionUnique'))
  const 呼び出し = [...中身.matchAll(/\b(sentencesOf|rawSentencesOf|dropDuplicates)\(([^)]*)\)/g)]
  const 渡し忘れ = 呼び出し.filter((m) => !/repeatAnswer/.test(m[2]))
  is(呼び出し.length >= 5 && !渡し忘れ.length,
    `落とす検査 ${呼び出し.length} か所とも、判断を受け取っている`,
    渡し忘れ.length ? 渡し忘れ.map((m) => m[0]).join(' / ') : '')
}


console.log('\n▶ 解答を声にするとき、記号は読まない(第5.346節)')
{
  /* ★ 2026-10-02 利用者の指定。

       > テスト対策(TOEIC L&R Part 2)の解答が、記号の「(A)」ごと
       > 読み上げられます。直しますか → はい、しかし既存の教材の
       > 作り直しは必要ありません。

     `answer` には**記号と語句の両方**が入っている(第5.331節)。
     **画面にはそのまま出すが、声にするときは記号を落とす。** */
  is(D.answerSpeakText({ answer: '(A) Next Monday morning.' }) === 'Next Monday morning.',
    '記号つきの解答から、記号を落として鳴らす',
    D.answerSpeakText({ answer: '(A) Next Monday morning.' }))

  /* ★ **応答問題の音声は1本も作り直さない**(利用者の指定)。
       あちらの `answer` には記号が無いので、**文字が1つも変わらない**
       (= 指紋が同じ = 0円)。**ここが変わると、まるごと再課金になる** */
  const 記号なし = 'Just bring yourself.'
  is(D.answerSpeakText({ answer: 記号なし }) === 記号なし,
    '記号の無い解答は、1文字も変えない(応答問題の音声は作り直さない)')

  /* **いちばん危ない形を、検証の中に必ず1つ置く**(CLAUDE.md)——
     **文の中の括弧まで落としてはいけない** */
  const 文中 = 'We met (again) last week.'
  is(D.answerSpeakText({ answer: 文中 }) === 文中,
    '文の途中の括弧は落とさない(頭の記号だけ)')
  is(D.answerSpeakText({}) === '' && D.answerSpeakText(null) === '',
    '解答が無ければ、空を返す(落ちない)')

  /* ── **押して鳴らす側も、同じ関数を通っているか** ──
       ★ **支度(`sectionRestClips`)と聞き流しはこの関数を通る。**
         押す側だけ別の文字を渡すと、**支度した音声が1本も当たらず、
         待つうえに二度課金**になる(CLAUDE.md「数え方を2通り持たない」) */
  const ans = noC(R('src/components/AnswerEn.jsx'))
  is(/answerSpeakText\(/.test(ans), '押して鳴らす側も、同じ関数を通している')
  is(!/<SpeakButton text=\{body\}/.test(ans),
    '押して鳴らす側が、画面に出す文字をそのまま渡していない')
  /* **判断を2か所に持たない。** 画面の中で記号を落としていないか */
  const 自前 = ['AnswerEn', 'LessonView', 'MaterialBody', 'LearnerHomework']
    .filter((名) => /\(\[A-D\]\)|\(A\) /.test(noC(R(`src/components/${名}.jsx`))))
  is(!自前.length, '画面の中で、記号を自前に落としていない', 自前.join(' / '))
}


console.log('\n▶ 自分でえらぶときは、問数に上限が無い(第5.347節)')
{
  /* ★ 2026-10-02 利用者の指定。

       > 応答問題において、自分で入れたい表現を選んだ場合は、
       > 問題数はその2倍になるという仕様でお願いいたします。
       > つまり、問題数に制限はないということです。 */

  /* ── ① **判断は1か所か**(出る側と出ない側の両方)── */
  is(D.picksCount('auto') && !D.picksCount('manual'),
    'おまかせは問数をえらび、自分でえらぶときはえらばない(判断は1か所)')

  /* ── ② **えらんだ数 × 回数が、そのまま問数になるか** ──
         **上限が無い**ので、`RESPONSE_COUNTS` のいちばん多い数より
         多くえらんでも、そのぶん増える */
  const 多い = D.phrasesNeeded(Math.max(...D.RESPONSE_COUNTS)) * 4
  const 表現 = Array.from({ length: 多い }, (_, i) => ({ en: `p${i}`, ja: `え${i}` }))
  const plan = D.responsePlan([{ exercise_type: 'listening', count: 0 }], true, 表現)
  is(plan[0].count === 多い * D.TIMES_PER_PHRASE,
    `えらんだ ${多い} 個が、そのまま ${多い * D.TIMES_PER_PHRASE} 問になる(上限で切られない)`,
    `${plan[0].count} 問`)

  /* ── ③ **「足りない」と言わないか** ──
         ★ **いちばん危ない形を、検証の中に必ず1つ置く**(CLAUDE.md)——
           **目標の問数より少なくえらんだとき**。目標を渡すと
           「◯問には△個が必要です」と出て、**えらんだ本人に嘘を言う** */
  const 少し = 表現.slice(0, 3)
  const 自分で = D.responseNote(少し, null)
  const おまかせ = D.responseNote(少し, Math.max(...D.RESPONSE_COUNTS))
  is(!/必要です/.test(自分で) && /必要です/.test(おまかせ),
    '自分でえらぶときは「◯問には△個が必要です」と言わない(おまかせでは言う)',
    自分で)

  /* ── ④ **画面が、問数の欄を出し分けているか** ──
         **素の関数だけ見ると、画面が通していなくても緑になる**(第5.330節) */
  const form = noC(R('src/components/MaterialForm.jsx'))
  is(/\{picksCount\(resPick\) && \(/.test(form),
    '画面が、問数の欄を `picksCount()` で出し分けている')
  is(!/resPick === 'manual'/.test(form),
    "画面の中で `resPick === 'manual'` と書いていない(判断を2か所に持たない)")
  is(/responseNote\(next, picksCount\(resPick\) \? resCount : null\)/.test(form),
    '画面が、自分でえらぶときは目標の問数を渡していない')

  /* ── ⑤ **作り直しの回数が、頼んだ問数に足りるか** ──
       ★ 窓口は**1回に 30 問まで**しか作らない。作り直しが5回の決め打ちだと
         **150 問が天井**で、そこから先は黙って足りなくなる。
         **1回あたりの数は、窓口のコードから読み取る**(書き写さない) */
  const fn = R('supabase/functions/generate-material/index.ts')
  const ひと回ぶん = [...fn.matchAll(/Math\.min\(Math\.max\(Number\(body\.count[^)]*\), 1\), (\d+)\)/g)]
    .map((m) => Number(m[1]))
  const そろって = ひと回ぶん.length >= 1 && ひと回ぶん.every((n) => n === A.GEN_PER_CALL)
  is(そろって, '窓口が1回に作る数と、こちらの数がそろっている',
    `窓口 ${ひと回ぶん.join(' / ')} / こちら ${A.GEN_PER_CALL}`)
  const 届かない = [10, 30, 100, 200, 400, 1000]
    .filter((n) => A.genAttempts(n) * A.GEN_PER_CALL < n)
  is(!届かない.length, '頼んだ問数に、作り直しの回数が足りる(10〜1000 問)',
    届かない.join(' / '))
  /* **止まる条件は残す**(CLAUDE.md)。何回でも回さない */
  is(A.genAttempts(30) === 5 && A.genAttempts(1e9) < 1e9,
    '少ないときはこれまでどおり 5 回で、止まる条件も残っている',
    `30 問 → ${A.genAttempts(30)} 回`)
  is(/genAttempts\(wanted\)/.test(noC(R('src/lib/materials.js'))),
    '作る側が、その回数を通している')

  /* ── ⑥ **冊をまるごとえらんでも、窓口で切られないか** ──
       **上限が無い**ので、**いちばん多い形は「冊ぜんぶ」**である。
       切られると**末尾の表現が黙って消える**(第5.344節で踏んだ形) */
  const 上限 = Number(/examPart[^\n]*slice\(0,\s*(\d+)\)/.exec(fn)?.[1])
  const { nativeFlowRows } = await import('../src/data/nativeFlow.js')
  const 冊 = nativeFlowRows()
  const まるごと = D.responseBrief({ form: 'choices', phrases: 冊 }).length
  if (!上限) {
    ng('長さ … 窓口の上限を読み取れない(探し方が壊れている)')
  } else if (まるごと > 上限) {
    ng(`長さ … 冊ぜんぶ(${冊.length} 個)で上限 ${上限} 文字を超える(末尾が黙って消える)`,
      `${まるごと} 文字`)
  } else {
    ok(`長さ … 冊ぜんぶ(${冊.length} 個 = ${冊.length * D.TIMES_PER_PHRASE} 問)でも`
      + ` ${まるごと} 文字(窓口の上限 ${上限} 文字の ${Math.round(まるごと / 上限 * 100)}%)`)
  }
}

console.log('\n▶ 解答の訳は、えらんだ表現から埋まるか(第5.349節)')
{
  /* **表現の訳はファイルにある。** AI に書かせる必要がなく、
     書かせると**空で返ることがある**(実機で「解答に英語しか出ない」) */
  const 表現 = [
    { en: 'I appreciate your help.', ja: '助かります。' },
    { en: "That's exactly what I had in mind.", ja: 'まさにそう考えていました。' },
  ]
  const 空 = [{ answer: 'I appreciate your help.', answer_ja: '' }]
  is(D.fillAnswerJa(空, true, 表現)[0].answer_ja === '助かります。',
    '空の訳が、えらんだ表現から埋まる')

  /* **大文字小文字や句読点のちがいを吸収する。**
     **いちばん危ない形を入れる**(CLAUDE.md)—— そのままの文字で
     突き合わせていたら、ここで落ちる */
  const ちがう形 = [{ answer: "that's EXACTLY  what i had in mind", answer_ja: '' }]
  is(D.fillAnswerJa(ちがう形, true, 表現)[0].answer_ja === 'まさにそう考えていました。',
    '大文字小文字・句読点・空白がちがっても埋まる')

  /* ★ **記号つきの解答でも埋まる**(テスト対策は「(A) …」の形)。
       **読む欄と同じ落とし方を通している**かを見る */
  const 記号つき = [{ answer: '(B) I appreciate your help.', answer_ja: '' }]
  is(D.fillAnswerJa(記号つき, true, 表現)[0].answer_ja === '助かります。',
    '記号「(B)」が付いた解答でも埋まる(読む欄と同じ落とし方)')

  /* **黙って上書きしない。** AI が場面に合わせて言い換えていることがある */
  const すでに = [{ answer: 'I appreciate your help.', answer_ja: 'もう書いてある訳' }]
  is(D.fillAnswerJa(すでに, true, 表現)[0].answer_ja === 'もう書いてある訳',
    'すでに訳があるものは、黙って上書きしない')

  /* **嘘の訳を付けない。** 一覧に無い英文には何も足さない
     (0 と null を取り違えない、と同じ考え方) */
  const 知らない = [{ answer: 'Something else entirely.', answer_ja: '' }]
  is(D.fillAnswerJa(知らない, true, 表現)[0].answer_ja === '',
    '一覧に無い英文には、何も付けない(似ている別の訳を当てない)')

  /* **出ない側も見る**(CLAUDE.md)。応答問題でなければ1問も触らない ——
     `on` を無視して全部に埋める形に書き換えても、ここで赤くなる */
  is(D.fillAnswerJa(空, false, 表現)[0].answer_ja === '',
    '応答問題でなければ、1問も触らない')
  /* 表現を1つも渡していないときも、落ちずにそのまま返す */
  is(D.fillAnswerJa(空, true, [])[0].answer_ja === ''
    && D.fillAnswerJa(空, true, undefined)[0].answer_ja === '',
    '表現が1つも無ければ、そのまま返す(落ちない)')

  /* **画面が通しているか。** 関数があっても、呼んでいなければ効かない。
     **名前を先に読み取ってから**その名前で数える(式を書き写さない) */
  const form = noC(R('src/components/MaterialForm.jsx'))
  is(/fillAnswerJa\(\s*items\s*,\s*resOn\s*,\s*resPhrases\s*\)/.test(form),
    '画面が、生成の直後に `fillAnswerJa()` を通している')
  /* **画面の中で種類を見分けていない**(判断は1か所) */
  is(!/kind\s*===\s*'response'/.test(form),
    "画面の中で `kind === 'response'` と書いていない")
}

console.log('\n▶ 読み上げた英文の訳は、解答を開くまで出ないか(第5.346 / 5.349節)')
{
  /* ★ **2026-10-02 実機の指摘**(第5.349節)。

       > 初めから読み上げられる文の日本語訳が選択肢の上に表示されていました
       > …解答を見ない限り訳は見れないようにしたいところです

     出どころは**端末に残っていた古い版**だった(いまの版は出さない)。
     だから**ここで止めておく** —— 3つの画面のどれかで、
     `prompt_ja` を素のまま出す行が戻ったら赤くなる。

     **「出る」と「出ない」の両方を見る**(CLAUDE.md) */
  for (const f of [
    'src/components/LessonView.jsx',
    'src/components/MaterialBody.jsx',
    'src/components/LearnerHomework.jsx',
  ]) {
    const src = noC(R(f))
    const 名 = f.split('/').pop()
    /* ①**素のまま出す行には、必ず「聞く演習ではない」の条件が付く。**
         `{it.prompt_ja && ...}` だけの行が1つでもあったら赤 */
    const 素のまま = [...src.matchAll(/\{\s*it\.prompt_ja\s*&&\s*(!?)\s*(\w*)/g)]
      .filter((m) => !(m[1] === '!' && m[2] === 'audioJaOf'))
    is(!素のまま.length,
      `${名} … 読み上げた英文の訳を、素のまま出す行が無い`,
      素のまま.map((m) => m[0]).join(' / '))
    /* ②**出す側もある。** 1つも出さない形に書き換えたら、ここで赤くなる */
    is((src.match(/audioJaOf\(it, sec\.exercise_type\)/g) ?? []).length >= 2,
      `${名} … 訳は audioJaOf() を通して出している`)
  }
}

console.log('\n▶ 読み上げの最後に答えが入っていたら落とすか(第5.350節)')
{
  const 答 = 'I appreciate your help.'
  const 問 = (heard) => [{ audio_text: heard, answer: 答 }]
  const 落とす = (heard) => D.stripHeardAnswer(問(heard), true)[0].audio_text

  is(落とす(`Could you give me a hand with these boxes? ${答}`)
    === 'Could you give me a hand with these boxes?',
    '読み上げの最後に入った答えが落ちる')

  /* **大文字小文字・句読点のちがいも落ちる**(normEn を通している) */
  is(落とす('Could you give me a hand? i APPRECIATE your help')
    === 'Could you give me a hand?',
    '大文字小文字・句読点がちがっても落ちる')

  /* ★ **いちばん危ない形**(CLAUDE.md)。**1文しか無ければ触らない** ——
       落とすと読み上げが空になり、その問は鳴らしようがなくなる */
  is(落とす(答) === 答, '1文しか無ければ触らない(読み上げを空にしない)')

  /* **途中の文は落とさない。** 抜くと残った文がつながらなくなる */
  const 途中 = `${答} Could you give me a hand?`
  is(落とす(途中) === 途中, '途中に入っているときは触らない(末尾だけを落とす)')

  /* **略語のピリオドで切らない**(文の切り方は sentenceSplit.js 1か所) */
  is(落とす(`Mr. Smith is waiting at the front desk. ${答}`)
    === 'Mr. Smith is waiting at the front desk.',
    '略語のピリオドで切らない(Mr. Smith が残る)')

  /* **答えが入っていなければ、1文字も変えない** */
  const そのまま = 'Could you give me a hand? It will only take a minute.'
  is(落とす(そのまま) === そのまま, '答えが入っていなければ、1文字も変えない')

  /* **出ない側**(CLAUDE.md)。応答問題でなければ触らない */
  is(D.stripHeardAnswer(問(`Could you help? ${答}`), false)[0].audio_text
    === `Could you help? ${答}`,
    '応答問題でなければ、1問も触らない')

  /* **作り方の文でも禁じている。** 落とす仕組みと両方でふさぐ */
  const rule = (await import('../src/data/replyRule.js')).REPLY_RULE
  is(/audio_text の中に answer を入れない/.test(rule),
    '作り方の文(REPLY_RULE)が「読み上げに答えを入れない」と言っている')
  /* **テスト対策の Part 2 にも、同じ決まりが届く**(文は1か所) */
  const { examBrief } = await import('../src/data/examPrep.js')
  is(examBrief('toeic_lr', 'p2').includes('audio_text の中に answer を入れない'),
    'TOEIC L&R Part 2 にも、その決まりがそのまま届く')

  /* **画面が通しているか**(名前を先に読み取ってから数える) */
  const form = noC(R('src/components/MaterialForm.jsx'))
  is(/stripHeardAnswer\(\s*items\s*,\s*resOn\s*\)/.test(form),
    '画面が `stripHeardAnswer()` を通している')
}

console.log('\n▶ 同じ解答の問が、続けて出ないか(第5.350節)')
{
  const 並び = (items) => items.map((x) => x.answer).join('')
  const 隣が同じ = (items) => items
    .filter((x, i) => i > 0 && x.answer === items[i - 1].answer).length

  const 問 = 'AABBCC'.split('').map((a, i) => ({ answer: a, id: i }))
  is(隣が同じ(D.spreadSameAnswer(問, true)) === 0,
    '同じ解答が隣に並ばない', 並び(D.spreadSameAnswer(問, true)))

  /* **1問も捨てない。** 並べ替えるだけである */
  const out = D.spreadSameAnswer(問, true)
  is(out.length === 問.length
    && new Set(out.map((x) => x.id)).size === 問.length,
    '問は1つも増えず、減らず、入れ替わっただけ')

  /* ★ **いちばん危ない形**(CLAUDE.md)。**本番でいちばん多い形**で測る ——
       30 問 = 15 表現 × 2 回。短い例だと、まぐれで緑になる */
  const 本番 = Array.from({ length: 15 }, (_, k) => k)
    .flatMap((k) => [{ answer: `p${k}` }, { answer: `p${k}` }])
  is(隣が同じ(D.spreadSameAnswer(本番, true)) === 0,
    `30 問(15 表現 × ${D.TIMES_PER_PHRASE} 回)でも、隣に同じ解答が1つも無い`)

  /* ★ **並べようがない残りが出ても、問を捨てない**。
       **入力の選び方で2度つまずいた**(CLAUDE.md「その1本を外したときに
       赤くなる入力を選ぶ」)—— `A A A` は**解答が1種類**なので
       いちばん手前の早い return で返り、**最後まで通らない。**
       `A A A B` にすると「A B A」まで置いたところで**残りが A だけ**になり、
       置けなくなる道をちゃんと通る */
  const 置けない = ['A', 'A', 'A', 'B'].map((a, i) => ({ answer: a, id: i }))
  const 残した = D.spreadSameAnswer(置けない, true)
  is(残した.length === 4 && new Set(残した.map((x) => x.id)).size === 4,
    '置けなくなっても、問を1つも捨てない', 残した.map((x) => x.answer).join(''))
  /* 解答が1種類しか無ければ、何もしない(そこで返る) */
  const 同じだけ = [{ answer: 'A' }, { answer: 'A' }, { answer: 'A' }]
  is(D.spreadSameAnswer(同じだけ, true).length === 3,
    '解答が1種類しか無ければ、そのまま返す')

  /* **出ない側。** 応答問題でなければ並べ替えない */
  is(並び(D.spreadSameAnswer(問, false)) === 'AABBCC',
    '応答問題でなければ、並べ替えない')

  /* **画面では、交互に並べ直したあとに通す** —— 先に置くと打ち消される */
  const form = noC(R('src/components/MaterialForm.jsx'))
  const 交互 = form.indexOf('interleave(tagIds')
  const 散らす = form.indexOf('spreadSameAnswer(items')
  is(交互 > 0 && 散らす > 交互,
    '画面が、交互に並べ直したあとに `spreadSameAnswer()` を通している')
}

console.log('\n▶ 誤りの選択肢を、こちらで組み立てているか(第5.350節)')
{
  const C = await import('../src/lib/responseChoices.js')
  /* 決まった並びにするための乱数(検証のため。**仕組みは触らない**) */
  const 種 = () => { let n = 1; return () => ((n = (n * 1103515245 + 12345) % 2147483648) / 2147483648) }
  /* ★ **読み取りは本物の切り分けを通す**(第5.350節)。
       はじめ `split('\n')` で読んでいたので、`spreadAnswerMarks()` が
       **空白でつなぎ直した**あとは1つも読み取れず、
       **仕組みは正しいのに見張りだけが赤くなった**(CLAUDE.md
       「見比べる相手は、できるだけ近いもの」) */
  const { splitChoices, choiceBody } = await import('../src/lib/choiceLines.js')
  const 選択肢 = (it) => splitChoices(it.question).choices.map(choiceBody)

  is(C.choicePool().length > 300,
    `候補が十分にある(${C.choicePool().length} 件)`)

  /* ★ **いちばん危ない形**(CLAUDE.md)。**本番でいちばん多い 30 問**で測る ——
       少ない問数だと、使いまわしていても気づけない。

       ★ **正解は、候補と同じ一覧から取る**(2度めのつまずき)。
         はじめ `This is answer number 3.` のような**候補に無い文**を
         正解にしていたので、「ほかの問の正解を誤りに混ぜない」の1本を
         外しても**緑のまま**だった —— 混ざりようがない文だったのである
         (CLAUDE.md「その1本を外したときに赤くなる入力を選ぶ」)。
         本番でも、正解は Native Flow の表現そのものである */
  const 表現 = C.choicePool().slice(0, 15)
  const 本番 = 表現.flatMap((en) => [{ answer: en }, { answer: en }])
  const out = C.buildChoices(本番, true, { rand: 種() })
  is(out.every((it) => 選択肢(it).length === D.CHOICE_COUNT),
    `30 問とも、選択肢が ${D.CHOICE_COUNT} つできる`)
  is(out.every((it, i) => 選択肢(it).includes(本番[i].answer)),
    '30 問とも、正解が選択肢の中に入っている')

  const 誤り = out.flatMap((it, i) => 選択肢(it).filter((c) => c !== 本番[i].answer))
  is(誤り.length === out.length * (D.CHOICE_COUNT - 1)
    && new Set(誤り.map(K.normEn ?? ((x) => x))).size === 誤り.length,
    `誤りの選択肢 ${誤り.length} 個が、1つも重複していない(使いまわさない)`)

  /* **ほかの問の正解を、誤りに混ぜない**(どちらが正しいか分からなくなる) */
  const 正解ぜんぶ = new Set(本番.map((x) => x.answer))
  is(!誤り.some((c) => 正解ぜんぶ.has(c)),
    'ほかの問の正解が、誤りの選択肢に出てこない')

  /* **長さで見分けられないか。** 正解がいちばん長い / 短いばかりでは、
     中身を読まなくても当たってしまう(第5.339節と同じ考え方) */
  const 語数 = (t) => String(t).trim().split(/\s+/).length
  const いちばん長い = out.filter((it, i) => {
    const cs = 選択肢(it)
    return 語数(本番[i].answer) === Math.max(...cs.map(語数))
      && cs.filter((c) => 語数(c) === 語数(本番[i].answer)).length === 1
  }).length
  is(いちばん長い <= out.length / 2,
    `正解がいちばん長い問が半分以下(${いちばん長い} / ${out.length} 問)`)

  /* **候補が足りなければ触らない**(黙って選択肢を減らさない) */
  const 足りない = C.buildChoices([{ answer: 'Yes.' }], true, { pool: ['Only one.'], rand: 種() })
  is(!足りない[0].question, '候補が足りなければ、選択肢を作らない(減らさない)')

  /* **出ない側。** 選択肢を出さない形・応答問題でないときは触らない */
  is(!C.buildChoices([{ answer: 'Yes.' }], false, { rand: 種() })[0].question,
    '選択肢を出さない形では、1問も触らない')

  /* ★ **正解の位置は `spreadAnswerMarks()` が散らす**(第5.331節)。
       組み立てた形をあちらが読めなければ、**正解が全部 (C) に並ぶ** */
  const { spreadAnswerMarks } = await import('../src/lib/choiceLines.js')
  const 散らした = spreadAnswerMarks(out)
  const 位置 = 散らした.map((it) => 選択肢(it).findIndex((c) => c === it.answer))
  is(!位置.includes(-1) && new Set(位置).size >= 2,
    `正解の位置が散る(あちらが読める形になっている・位置 ${[...new Set(位置)].sort().join('/')})`)

  /* **記号を書き写していない**(呼び名は choiceLines.js 1か所) */
  const src = noC(R('src/lib/responseChoices.js'))
  is(/CHOICE_MARKS/.test(src) && !/\['A',\s*'B'/.test(src),
    '記号の一覧を書き写していない(`CHOICE_MARKS` を引いている)')
  /* **混ぜ方も書き写していない**(shuffle.js 1か所) */
  is(/shuffled\(/.test(src) && !/Fisher|Math\.floor\(rand\(\)/.test(src),
    '自前の混ぜ方を書いていない(`shuffled()` を通している)')

  /* **AI には作らせていない**(作り方の文が「空にする」と言っている) */
  const brief = D.responseBrief({ form: 'choices', phrases: [{ en: 'Sure.', ja: 'もちろん。' }] })
  /* ★ **「空にする」とは言わない**(第5.353節)。窓口は空の欄がある問を
       落とすので、**言った日に 0 件になる**。言うのは「選択肢を書くな」である */
  is(/選択肢\(A\)\(B\)\(C\)は書かない/.test(brief),
    '作り方の文が「選択肢は書かない」と言っている(AI に作らせない)')
  is(!/の形で並べる/.test(brief),
    '作り方の文が、選択肢を並べろとは言っていない')

  /* **画面が通している**(選択肢を出す形のときだけ) */
  const form = noC(R('src/components/MaterialForm.jsx'))
  is(/buildChoices\(\s*items\s*,\s*resOn && hasChoices\(resForm\)\s*\)/.test(form),
    '画面が、選択肢を出す形のときだけ `buildChoices()` を通している')
}

console.log('\n▶ 窓口が必須にしている欄を、作り方が「空にする」と言っていないか(第5.353節)')
{
  /* ★ **2026-10-03 実機。5回連続で「listening の中身が空で返ってきました」。**

       出どころは、前の日(第5.350節)にこちらが書いた
       「question は**空にする**」である。窓口は**空の欄がある問を落とす**ので、
       **1問残らず落ちて 0 件**になっていた。

     **第5.341節とまったく同じ形**(窓口と画面で必須の欄が食い違う)。
     あちらは窓口が任意にしたのに画面が必須のままで、今度は**逆向き**だった。
     **だから、向きを問わずに突き合わせる。** */
  const fn = R('supabase/functions/generate-material/index.ts')
  const m = /listening:\s*\{\s*required:\s*\[([^\]]*)\]/.exec(fn)
  const 必須 = m ? [...m[1].matchAll(/'(\w+)'/g)].map((x) => x[1]) : []
  is(必須.length >= 3, `窓口の必須の欄を読み取れている(${必須.join(' / ') || 'なし'})`)

  const 表現 = [{ en: 'Sure, that works for me.', ja: 'ええ、それで大丈夫です。' }]
  for (const form of D.RESPONSE_FORMS.map((f) => f.id)) {
    const 文 = D.responseBrief({ form, phrases: 表現 })
    /* 「<欄> は**空にする**」と言っている必須の欄を探す */
    const 空にしろ = 必須.filter((f) => new RegExp(`${f} は\\*\\*空にする`).test(文))
    is(!空にしろ.length,
      `${form} … 窓口が必須にしている欄を「空にする」と言っていない`,
      空にしろ.join(' / '))
  }

  /* **選択肢ありの形は、question に何を入れるかを言っている。**
     **文は `CHOICE_LEAD` 1か所**(書き写さない) */
  const 選 = D.responseBrief({ form: 'choices', phrases: 表現 })
  is(選.includes(`question には「${D.CHOICE_LEAD}」`),
    '選択肢ありの形は、question に入れる文を言っている(空にしない)')

  /* ★ **「自分で言う」形も、ちゃんと作れるか。**
       こちらは第5.332節からずっと「question は空にする」と言っていた ——
       **窓口が必須だったので、その形は一度も作れていなかった。**
       いまは窓口が任意にしてあるので通る */
  is(!必須.includes('question'),
    '窓口は question を必須にしていない(設問の無い問が、ほんとうに在る)')
}

console.log('\n▶ 同じ設問を二度と作らないか(テスト対策と応答問題・第5.354節)')
{
  /* ★ **2026-10-03 実機。「同じレベルで2つ教材を作ったら 5 個くらい同じ設問」。**

       出どころは**照合が1文も見ていなかったこと**である。
       `used_sentences()`(0008 の SQL)は**ゲストか弱点タグで絞った教材**しか
       見ないのに、テスト対策と応答問題は**タグが要らず、作る時点では
       まだ誰にも共有していない** —— どちらの条件にも当たらなかった。 */
  const { asksUnique } = await import('../src/data/materialKinds.js')

  /* **出る側と出ない側の両方**(CLAUDE.md)。全部 true を返す形に
     書き換えても緑にならないよう、**当たらない種類も数える** */
  is(asksUnique('exam') && asksUnique('response'),
    'テスト対策と応答問題では、設問をスクール全体で照合する')
  const ほか = NEW_MATERIAL_KINDS.filter((k) => !asksUnique(k.id))
  is(ほか.length >= 3,
    'ほかの種類はこれまでどおり(作れる教材が痩せない)',
    ほか.map((k) => k.id).join(' / '))

  /* ★ **解答は見ない。** 応答問題は1つの表現をわざと2回正解にするし、
       単語の解答は1語である —— 入れると**ありふれた語が永久に使えなくなる** */
  const 問 = { prompt_en: '', audio_text: 'What is frozen water called?', answer: 'Ice.' }
  is(K.askKeysOf(問).length === 1 && !K.askKeysOf(問).some((k) => /ice/.test(k)),
    '設問の鍵に、解答を入れていない', K.askKeysOf(問).join(' / '))
  /* **読んで答える問も、聞いて答える問も、どちらも拾う** */
  is(K.askKeysOf({ prompt_en: 'She ( ) early.' }).length === 1
    && K.askKeysOf({ audio_text: 'Are you free?' }).length === 1
    && K.askKeysOf({}).length === 0,
    '読む問も聞く問も拾い、空なら何も返さない')
  /* **そろえた形と、もとの文字の両方を出す**(問い合わせには、もとの文字を渡す) */
  is(K.rawAsksOf(問)[0] === 'What is frozen water called?',
    '問い合わせには、もとの文字のまま渡す')

  /* **作る側が、その段を通しているか。** 関数があっても呼んでいなければ効かない */
  const mats = noC(R('src/lib/materials.js'))
  is(/askUnique && survived\.length/.test(mats),
    '作る側が、設問の照合を1段通している')
  is(/findUsedAsks\(asks\)/.test(mats), '照合は台帳をまるごと見ている(絞らない)')
  /* ★ **まとめて1回で訊かない。** 長い英文を並べると URL が切られ、
       **切られたぶんは「使われていない」ことになる** */
  is(/ASK_CHUNK/.test(mats) && /i \+= ASK_CHUNK/.test(mats),
    '照合を小分けにしている(長い URL で切られない)')

  /* **画面が渡しているか。** 判断は1か所で、画面で種類を見分けない */
  const form = noC(R('src/components/MaterialForm.jsx'))
  is(/askUnique: asksUnique\(kind\)/.test(form),
    '画面が `asksUnique(kind)` を渡している')

  /* ★ **誘導のほうも直っているか**(落とすだけだと、問数が足りなくなる)。
       タグが無ければ、**同じ種類(同じ PART)**から集める */
  /* **道は2つある**(本文を作る道と、ドリル / テスト対策の道)。
     **両方**が同じ集め方をしていること —— 片方だけだと、
     **タグの要らない種類がまた素通りする**(それが今回の形である) */
  const 集め方 = (form.match(/await loadUsedSentencesLike\(likeQuery\(\)\)/g) ?? []).length
  is(集め方 === 2,
    'タグが無いときも、同じ種類から避ける英文を集めている(2つの道とも)',
    `${集め方} か所`)
  /* **PART で絞っているか** —— テスト対策は `kind` がぜんぶ `exam` なので、
     絞らないと TOEIC の英文で VERSANT Part A の棚が埋まる */
  is(/titleLike: isExamKind\(kind\) \? examTitle\(examId, partId\)/.test(form),
    '集めるとき、同じ PART のものに絞っている')
  is(/if \(titleLike\) query = query\.ilike\('title'/.test(noC(R('src/lib/materials.js'))),
    '絞り込みが、本当に問い合わせに効いている')
}

console.log(bad === 0 ? '\n✅ 応答問題の検証は、すべて意図どおりです' : `\n❌ ${bad} 件`)
process.exit(bad === 0 ? 0 : 1)
