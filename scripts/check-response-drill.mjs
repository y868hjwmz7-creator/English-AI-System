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
  /* ★ **別解を選択肢に入れさせない。**
       入ると**正解が2つある4択**になり、答え合わせができない */
  is(/別解は選択肢に入れない/.test(選),
    '選択肢ありのときは、別解を選択肢に入れさせない')
  /* **訳を書かせているか** —— 無いと Quick Response に回せない */
  is(/answer_ja/.test(選) && /answer_ja/.test(開), '応答の訳を書かせている')
  /* ★ **誤りの選択肢を、正解に似せさせない**(2026-10-01 実機・利用者の指摘)。

       > 選択肢A-Cが似過ぎていて問題になっていません。
       > もっと脈絡のないランダムなものを間違えている選択肢として

     実機では「Mistakes make purple / papers / people」のように、
     **同じ文型のまま1語だけ**入れ替えたものが並んでいた。
     それは**音の聞き分け**の問題で、**覚えた表現を思い出す**練習ではない */
  is(/似せない/.test(選) && /かみ合わない/.test(選),
    '誤りの選択肢を、正解に似せさせない(脈絡のない応答にさせる)')
  /* ★ **音の似た語を混ぜさせていないか。** これは TOEIC の本番の形で、
       **応答問題には当てはまらない**(言われた場所だけを直す) */
  is(!/音が似/.test(選), '応答問題では「音の似た語を混ぜる」と書いていない')

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

console.log('\n▶ 正解の英文を、鳴る順に並べられるか(聞き流しの材料)')
{
  const mat = {
    kind: 'response',
    sections: [
      { exercise_type: 'listening', items: [
        { answer: 'Me too.', answer_ja: '私も' },
        { answer: '', answer_ja: 'から' },
      ] },
      { exercise_type: 'listening', items: [
        { answer: 'Not yet.', answer_ja: 'まだ' },
      ] },
    ],
  }
  const got = D.responseAnswers(mat, true)
  is(got.length === 2, '英文の無い問は落とす', `${got.length} 件`)
  is(got[0]?.en === 'Me too.' && got[1]?.en === 'Not yet.',
    '段をまたいで、出た順に並ぶ')
  is(got[0]?.ja === '私も', '訳も添える(聞き流しの札に出す)')
  /* **出ない側。** 応答問題でなければ空 —— 渡す側が判じ直さないため */
  is(D.responseAnswers(mat, false).length === 0,
    '応答問題でなければ、1件も返さない')
  /* **いちばん危ない形**(CLAUDE.md)—— 段が1つも無い教材 */
  is(D.responseAnswers({ kind: 'response' }, true).length === 0,
    '段が1つも無い教材でも落ちない')
}

console.log('\n▶ 正解の聞き流し(第5.334節)')
{
  /* ★ 2026-10-01 利用者の指定。

       > その上で、応答問題には正解の聞き流しモードを作ります。
       > 問題順をシャッフルもできる仕様です。

     **新しい画面を作っていない。** 聞き流し(`WordRadio`)は
     「音声が自動で進み、間を選べて、やめるまで回りつづける」——
     **必要なものが、もうぜんぶ在る**(`radioSteps` の節と同じ考え方)。
     足りなかったのは**何を鳴らすか**だけである。 */
  const { responseRadioRows } = await import('../src/lib/audioPlaylist.js')
  const { radioVoiceOf, radioTextOf, radioJaOf, radioList, RADIO_ORDERS }
    = await import('../src/lib/wordRadio.js')
  const mat = {
    kind: 'response', voiceIds: [], tags: [],
    sections: [{ exercise_type: 'listening', items: [
      { audio_text: 'Q1', answer: 'Me too.', answer_ja: '私も' },
      { audio_text: 'Q2', answer: 'Not yet.', answer_ja: 'まだ' },
      { audio_text: 'Q3', answer: '  ' },
    ] }],
  }
  const rows = responseRadioRows(mat)
  const 解答のある問 = mat.sections[0].items.filter((it) => D.answerSpeakText(it)).length
  is(rows.length === 解答のある問, '正解だけが並ぶ(英文の無い問は落ちる)',
    `${rows.length} 件 / 解答のある問 ${解答のある問}`)
  /* **聞き流しが読む欄に、そのまま入っているか。**
     ここが食い違うと、**1件も鳴らずに素通りする**(`radioTextOf` が空を返す) */
  is(rows.every((r) => radioTextOf(r)) && radioTextOf(rows[0]) === 'Me too.',
    '聞き流しが読む欄(`radioTextOf`)に入っている', radioTextOf(rows[0]))
  is(radioJaOf(rows[0]) === '私も', '訳も、聞き流しが読む欄に入っている')
  /* ★ **声と段は、支度(`sectionRestClips`)から引いているか。**
       書き写すと、**支度した MP3 に1本も当たらない**(待ち + 二度課金) */
  const { sectionRestClips } = await import('../src/lib/audioPlaylist.js')
  const 支度 = sectionRestClips(mat, mat.sections[0]).find((c) => c.text === 'Me too.')
  const 声 = radioVoiceOf(rows[0])
  is(声.clipVoice === 支度?.voiceId && 声.clipTier === 支度?.tier,
    '聞き流しの声と段が、支度した音声とまったく同じ',
    `${声.clipTier} / ${声.clipVoice}`)
  /* **出ない側。** 単語帳と Quick Response の行には `clipVoice` が無いので、
     **あの2つは1ミリも変わらない** */
  is(Object.keys(radioVoiceOf({ en: 'x' })).length === 0
    && Object.keys(radioVoiceOf(null)).length === 0,
    '声の渡っていない行では、これまでどおり(単語帳と QR は変わらない)')
  /* **段が分からないときは渡さない。** 当て推量で `standard` と書くと、
     良い声で支度したものを取りに行かなくなる(= もう一度作る) */
  is(!('clipTier' in radioVoiceOf({ clipVoice: 'us-female' })),
    '段が分からないときは、段を当て推量で渡さない')
  /* **応答問題でなければ、1件も返さない**(渡す側が判じ直さないため) */
  is(responseRadioRows({ ...mat, kind: 'exam' }).length === 0
    && responseRadioRows(null).length === 0,
    '応答問題でなければ、聞き流しに渡すものが無い')

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
    '正解が1つも無ければ、ボタンごと出さない(行き止まりを作らない)')
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

console.log(bad === 0 ? '\n✅ 応答問題の検証は、すべて意図どおりです' : `\n❌ ${bad} 件`)
process.exit(bad === 0 ? 0 : 1)
