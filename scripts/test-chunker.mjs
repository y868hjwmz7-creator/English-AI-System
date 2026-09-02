/**
 * スラッシュリーディング(②)の区切りの検証。
 *
 * **決まりで書いたものは、決まりで確かめられる。**
 * ここが崩れると、模範の区切りが自分の決まりに違反したまま出る。
 * 前置詞や助動詞を足したときは、必ずここを通すこと。
 *
 *   npm run test:chunk
 */
import {
  checkSlashes, chunksOf, postModifier, slashesFor, wordsOf,
} from '../src/lib/chunker.js'
import {
  baseChunks, chunkPairs, chunkPairsAtMarks, needsChunkJa, storedChunks,
} from '../src/lib/chunkJa.js'
import { alignedSentences } from '../src/lib/sentencePair.js'

let ng = 0
const ok = (name, cond, detail = '') => {
  console.log(`${cond ? '✓' : '✗'} ${name}${cond || !detail ? '' : `\n    ${detail}`}`)
  if (!cond) ng += 1
}
const cut = (s, lv) => chunksOf(s, slashesFor(s, lv).map((x) => x.at)).join(' / ')

const S = {
  office: 'The office bought a new coffee machine for the meeting room last week.',
  going: 'I am going to talk to my manager about the new plan.',
  hasTo: 'She has to finish the report before she leaves for the day.',
  that: 'We think that the price of the machine is too high.',
  wants: 'He wants to know where the meeting will be held.',
  rinse: 'Please rinse the pot in the kitchen before you leave for the day.',
  // 「以前」の意味の副詞 before が文末に来る形(2026-08 利用者の指定)
  seenBefore: 'I had seen the report before. Then I sent it to the client.',
  // 所有格と、接続詞でつながる文
  owner: "The company's plan and the budget were approved by the board.",
  // 動詞のあと・前の名詞を説明する分詞(2026-08 利用者の指定)
  trend: 'But the trend has a darker side too.',
  caught: 'A few streamers have been caught talking up a stock while quietly selling their own shares.',
  raised: 'The money raised by the fund went to local schools.',
}

console.log('▶ 模範の区切りが、自分の決まりを守っていること')
for (const [name, text] of Object.entries(S)) {
  for (const lv of ['beginner', 'middle', 'advanced']) {
    const marks = slashesFor(text, lv).map((x) => x.at)
    const notes = checkSlashes(text, marks)
    ok(`${name} / ${lv}`, notes.length === 0,
      `${cut(text, lv)}\n    ${notes.map((n) => n.text).join('\n    ')}`)
  }
}

console.log('\n▶ 上級ほど区切りが減る(利用者の指定)')
for (const [name, text] of Object.entries(S)) {
  const b = slashesFor(text, 'beginner').length
  const m = slashesFor(text, 'middle').length
  const a = slashesFor(text, 'advanced').length
  ok(`${name}: 初級 ${b} ≥ 中級 ${m} ≥ 上級 ${a}`, b >= m && m >= a)
}

console.log('\n▶ 決まりに反する区切りには、必ず注意が出る')
// 語: 0 The 1 office 2 bought 3 a 4 new 5 coffee 6 machine 7 for 8 the ...
ok('区切りの最後が前置詞', checkSlashes(S.office, [8]).length > 0)
ok('冠詞のあとで切る', checkSlashes(S.office, [4]).length > 0)
// 0 I 1 am 2 going 3 to 4 talk ...
ok('be going to の途中で切る', checkSlashes(S.going, [3]).length > 0)
ok('has to の途中で切る', checkSlashes(S.hasTo, [2]).length > 0)

// 0 The 1 company's 2 plan 3 and 4 the 5 budget ...
ok("所有格('s)のあとで切る", checkSlashes(S.owner, [2]).length > 0)
ok('and のあとで切る', checkSlashes(S.owner, [4]).length > 0)
// 0 The 1 office 2 bought 3 a 4 new 5 coffee 6 machine 7 for 8 the ...
ok('前置詞と冠詞のあいだで切る', checkSlashes(S.office, [8]).length > 0)

/* ── 取り違えようのある語は、咎めない(2026-08 実機で誤判定を2つ出した)──
   > 他にも前置詞にも副詞にもなり得る単語で同じケースがあれば
   > それらについても OK

   間違った注意は、何も言われないより困る(「あやふやなことを言わない」)。 */
console.log('\n▶ 前置詞・冠詞・助動詞と取り違えやすい語は、咎めない')
{
  // 実機で赤い吹き出しが出た2つ(2026-08)
  const apps = 'Apps like this let a trader share their screen.'
  // 0 Apps 1 like 2 this 3 let ...  ← this は**代名詞**。区切ってよい
  ok('like this / let(this は代名詞)', checkSlashes(apps, [3]).length === 0)
  ok('I like / this(like は動詞)', checkSlashes('I like this app very much.', [2]).length === 0)
  const pull = 'Some streams pull in more than five thousand viewers.'
  // 0 Some 1 streams 2 pull 3 in 4 more ...  ← in は**句動詞の副詞**
  ok('pull in / more(in は句動詞の副詞)', checkSlashes(pull, [4]).length === 0)
  ok('give up / the plan', checkSlashes('They give up the plan today.', [3]).length === 0)
  // 本動詞にもなる助動詞
  ok('I have / two things(have は本動詞)',
    checkSlashes('I have two things to do.', [2]).length === 0)
  ok('The problem is / that we are late.',
    checkSlashes('The problem is that we are late.', [3]).length === 0)
  // 代名詞にもなる that
  ok('Apps like that / let(that は代名詞)',
    checkSlashes('Apps like that let a trader share.', [3]).length === 0)
  // 名詞にもなる while
  ok('after a while / they left(while は名詞)',
    checkSlashes('They waited for a while and then left.', [5]).length === 0)
  // それでも、取り違えようのないものは咎める
  ok('will のあとは咎める', checkSlashes('He will finish the report today.', [2]).length > 0)
  ok('of のあとは咎める', checkSlashes('The price of the machine is high.', [3]).length > 0)
  ok('while(接続詞)のあとは咎める',
    checkSlashes('They talk while they buy and sell stocks.', [3]).length > 0)
}

console.log('\n▶ 正しい区切りには、何も言わない')
ok('前置詞の前で切る', checkSlashes(S.office, [7]).length === 0)
ok('接続詞の前で切る', checkSlashes(S.that, [2]).length === 0)

/* ── 文の切れ目は、いつでも正しい(2026-08 利用者の指定)──────────
   > 「以前」という意味の副詞として before が使用され、文の最後に置かれ、
   > ピリオドが続き、そのピリオドとその後の文の始まりの間に区切りを
   > 置くことは何ら問題はありません。

   before / after / since / over … は前置詞にも副詞にもなる。
   語のリストではどちらか当てられないが、**文が終わっていれば
   前置詞ではありえない**(前置詞ならうしろに名詞が要る)。 */
console.log('\n▶ 文の切れ目・読点のあとは、何が来ていても咎めない')
// 0 I 1 had 2 seen 3 the 4 report 5 before. 6 Then 7 I 8 sent ...
ok('文末の before のあと(「以前」の意味)', checkSlashes(S.seenBefore, [6]).length === 0)
ok('模範もそこで切っている', slashesFor(S.seenBefore, 'beginner').some((x) => x.at === 6))
{
  const comma = 'We met in Tokyo, and the plan changed after that.'
  // 0 We 1 met 2 in 3 Tokyo, 4 and 5 the ...
  ok('読点のあと', checkSlashes(comma, [4]).length === 0)
  const over = 'The meeting is over. We can go home now.'
  // 0 The 1 meeting 2 is 3 over. 4 We ...
  ok('文末の over のあと(「終わって」の意味)', checkSlashes(over, [4]).length === 0)
}

/* ── 句動詞は、動詞と副詞で1つ(2026-08 利用者の指定)──────────────
   > 句動詞、たとえば Get up at 6am. だとしたら、Get up / at 6am です。
   > この場合の up は前置詞ではなく、副詞であり、get とセットとして
   > 考えるべきです。文中の pull in も同じことです。

   同じ語が前置詞にもなるので、**「動詞 + 副詞」の対**で持っている。
   掛け合わせると `look / at the sky` を咎めてしまう。 */
console.log('\n▶ 句動詞は、動詞と副詞のあいだで切らない')
{
  const up = 'Get up at 6am and start the day.'
  const pull = 'Some streams pull in more than five thousand viewers.'
  ok('Get / up は咎める', checkSlashes(up, [1]).length > 0)
  ok('pull / in は咎める', checkSlashes(pull, [3]).length > 0)
  ok('活用しても当たる(filling out)',
    checkSlashes('She is filling out the form now.', [3]).length > 0)
  // 模範も同じ形になる
  ok('模範が Get up / at 6am になる',
    cut(up, 'beginner').startsWith('Get up / at'), cut(up, 'beginner'))
  ok('模範が pull in を切らない',
    !cut(pull, 'beginner').includes('pull /'), cut(pull, 'beginner'))
  // **前置詞のときは咎めない。** 掛け合わせにしていたら、ここが落ちる
  ok('look / at the sky は咎めない',
    checkSlashes('They look at the sky every night.', [2]).length === 0)
  ok('go / up the stairs は咎めない',
    checkSlashes('We go up the stairs to the office.', [2]).length === 0)
}

/* ── 数字や記号が混じった語を、語のリストに当てない(2026-08 実測)──
   前は `6am` が `am`(be動詞)に化け、`at / 6am` という
   自分の決まりに反する区切りを模範が作っていた。 */
console.log('\n▶ 数字混じりの語を、助動詞や前置詞と間違えない')
{
  const t = 'Get up at 6am and start the day.'
  ok('6am の前で切らない', !cut(t, 'beginner').includes('at / 6am'), cut(t, 'beginner'))
  ok('模範が決まりを破っていない',
    checkSlashes(t, slashesFor(t, 'beginner').map((x) => x.at)).length === 0)
  const n = 'He typed 5,000 by mistake and the 24-year-old viewer saw it.'
  ok('5,000 や 24-year-old でも決まりを破らない',
    checkSlashes(n, slashesFor(n, 'beginner').map((x) => x.at)).length === 0,
    cut(n, 'beginner'))
}

/* ── 形容詞・分詞と名詞のあいだ(2026-08 利用者の指定)──────────────
   > 形容詞と名詞の間に区切りを入れても注意されません。これは注意する
   > ように変えるべきです。ただ、I am happy / because … みたいに
   > 後ろが名詞ではない場合は OK であるべきです。
   > 例：I saw some people / dancing in the park. でも OK だし、
   >     I saw / some people dancing in the park. でも OK です。 */
console.log('\n▶ 形容詞・分詞は、うしろの名詞と離さない')
{
  ok('a new / habit', checkSlashes('A new habit is spreading fast.', [2]).length > 0)
  ok('a careful / plan',
    checkSlashes('We need a careful plan for the meeting.', [4]).length > 0)
  ok('a broken / window(不規則な分詞)',
    checkSlashes('He opened a broken window in the room.', [4]).length > 0)
  ok('a growing / number',
    checkSlashes('There is a growing number of viewers.', [4]).length > 0)
  ok('比較級でも当たる(a safer / way)',
    checkSlashes('They found a safer way to do it.', [4]).length > 0)
}

console.log('\n▶ 述語の形容詞・うしろが名詞でないときは、咎めない')
{
  ok('I am happy / because …',
    checkSlashes("I am happy because I have passed an exam.", [3]).length === 0)
  ok('It feels safer / than …',
    checkSlashes('It feels safer than reading a textbook.', [3]).length === 0)
  ok('He is good / at math.', checkSlashes('He is good at math.', [3]).length === 0)
  ok('She is very tired / today.',
    checkSlashes('She is very tired today.', [4]).length === 0)
  ok('The report is very important / for us.',
    checkSlashes('The report is very important for us.', [5]).length === 0)
}

/* うしろから名詞を修飾する分詞は、**切っても切らなくてもよい**(利用者の指定) */
console.log('\n▶ うしろから修飾する分詞は、どちらでも咎めない')
{
  const t = 'They saw some people dancing in the park.'
  ok('some people / dancing …', checkSlashes(t, [4]).length === 0)
  ok('They saw / some people dancing …', checkSlashes(t, [2]).length === 0)
  ok('The man standing / there is my boss.',
    checkSlashes('The man standing there is my boss.', [3]).length === 0)
  ok('He lost / the game(過去形であって分詞ではない)',
    checkSlashes('He lost the game yesterday.', [2]).length === 0)
  ok('He is working / on the report(前置詞を取る動詞)',
    checkSlashes('He is working on the report now.', [3]).length === 0)
  ok('She looks / after the children',
    checkSlashes('She looks after the children every day.', [2]).length === 0)
  ok('We stand / by the door',
    checkSlashes('We stand by the door and wait.', [2]).length === 0)
}

/* ── 控えを細かくする(2026-08 利用者の指定)──────────────────────
   訳は控えの境目でしか分けられない。ゲストがどこで切っても真下に来るよう、
   ありうる切れ目をあらかじめ入れておく。 */
console.log('\n▶ ありうる切れ目を、控えに入れてある')
{
  const has = (t, piece) => cut(t, 'beginner').includes(piece)
  // 前置詞 + 代名詞は、前の名詞にかかる2語のかたまり
  const apps = 'Apps like this let a trader share their screen.'
  ok('Apps like this / let …', has(apps, 'Apps like this / let'), cut(apps, 'beginner'))
  // 句動詞のあと
  const pull = 'Some streams pull in more than five thousand viewers.'
  ok('pull in / more than …', has(pull, 'pull in / more'), cut(pull, 'beginner'))
  // 名詞のうしろに立つ -ing
  const scams = 'Phone scams targeting elderly people were spreading fast.'
  ok('Phone scams / targeting …', has(scams, 'scams / targeting'), cut(scams, 'beginner'))
  // 副詞・主語の代名詞(前に足したもの)
  const week = 'He withdrew about 30,000 yen a week suddenly started asking.'
  ok('… week / suddenly …', has(week, 'week / suddenly'), cut(week, 'beginner'))
  const spring = 'Last spring she noticed something odd.'
  ok('Last spring / she …', has(spring, 'spring / she'), cut(spring, 'beginner'))
  // 比べる相手を導く than の前(2026-08 利用者の指定で足した)
  const safer = 'For beginners, it feels safer than reading a textbook.'
  ok('safer / than reading …', has(safer, 'safer / than reading'), cut(safer, 'beginner'))
  ok('than が1語だけのカタマリにならない',
    !cut(safer, 'beginner').includes('/ than /'), cut(safer, 'beginner'))
  // 数量の more than は切らない
  const many = 'Some streams pull in more than five thousand viewers.'
  ok('more than five thousand は切らない',
    !cut(many, 'beginner').includes('more / than'), cut(many, 'beginner'))
  // うしろに -ing を取る動詞は、そのあいだで切らない
  const stopped = 'She stopped guessing and started copying the timing.'
  ok('stopped / guessing と切らない',
    !cut(stopped, 'beginner').includes('stopped / guessing'), cut(stopped, 'beginner'))
  ok('keep watching も切らない',
    !cut('They keep watching the stream every night.', 'beginner').includes('keep / watching'))
  // **どれも、自分の決まりを破っていないこと**
  for (const t of [apps, pull, scams, week, spring, safer, many, stopped]) {
    ok(`決まりを破っていない: ${t.slice(0, 24)}…`,
      checkSlashes(t, slashesFor(t, 'beginner').map((x) => x.at)).length === 0,
      cut(t, 'beginner'))
  }
}

/* ── 動詞のあとで切る(2026-08 利用者の指定)──────────────────────
   > 動詞の後も初心者には区切ってもらいたいポイントです。

   控えの切れ目としてだけ足してある。**注意する側には足していない**
   (取り違えたときに「間違った注意」を出さないため)。 */
console.log('\n▶ 動詞と目的語のあいだに、切れ目がある')
{
  const has = (t, piece) => cut(t, 'beginner').includes(piece)
  ok('The office bought / a new coffee machine',
    has(S.office, 'bought / a new'), cut(S.office, 'beginner'))
  ok('the trend has / a darker side(has は本動詞)',
    has(S.trend, 'has / a darker'), cut(S.trend, 'beginner'))
  ok('a real trader places / an order',
    has('They can see when a real trader places an order.', 'places / an order'),
    cut('They can see when a real trader places an order.', 'beginner'))
  ok('活用しても当たる(opened / a new branch)',
    has('The company opened a new branch in Osaka.', 'opened / a new'),
    cut('The company opened a new branch in Osaka.', 'beginner'))
  // **句動詞の副詞は目的語ではない。** ここで切ると `talk up` が割れる
  ok('talking up / a stock(句動詞は割らない)',
    !cut(S.caught, 'beginner').includes('talking / up'), cut(S.caught, 'beginner'))
  /* **動詞を数え上げるのをやめた**(2026-09 利用者の指定)。
     > 動詞の目的語を動詞とは分けて考えるのが初心者です。
     > どうにかしてあらゆる他動詞について一括でこのルールを変えれないですか?

     一覧に無い動詞でも切れること。「名詞のかたまりの始まり」から見ている */
  ok('一覧に無い動詞でも切れる(emailed / the client)',
    has('She emailed the client a summary after the meeting.', 'emailed / the client'),
    cut('She emailed the client a summary after the meeting.', 'beginner'))
  ok('一覧に無い動詞でも切れる(hired / a new designer)',
    has('They hired a new designer last month.', 'hired / a new designer'),
    cut('They hired a new designer last month.', 'beginner'))
  // **それだけで名詞になる語**(2026-09 実機。`anything` が拾えていなかった)
  ok('buy / anything fancy(不定代名詞も目的語)',
    has("Before you buy anything fancy, here's the truth.", 'buy / anything'),
    cut("Before you buy anything fancy, here's the truth.", 'beginner'))
  // `-ing` で終わるだけの語を、分詞と間違えない
  ok('anything を分詞と間違えない',
    !postModifier(wordsOf('Before you buy anything fancy, and more.'), 3))
  ok('morning を分詞と間違えない',
    !postModifier(wordsOf('We met Sarah morning and evening.'), 2))
  // 名詞にもなる語を、動詞と取り違えない
  ok('the plan / のあとでは切らない(冠詞のうしろは名詞)',
    !cut('We need the plan a week before the meeting.', 'beginner').includes('plan / a'),
    cut('We need the plan a week before the meeting.', 'beginner'))
  ok('a new place のあとでは切らない(形容詞のうしろは名詞)',
    !cut('They found a new place a few days ago.', 'beginner').includes('place / a'),
    cut('They found a new place a few days ago.', 'beginner'))
  // 疑問文の頭の Do / Did は助動詞。ここでは切らない
  ok('Do / the students … と切らない',
    !cut('Do the students know the answer?', 'beginner').startsWith('Do /'),
    cut('Do the students know the answer?', 'beginner'))
  ok('have been caught を割らない',
    !cut(S.caught, 'beginner').includes('have / been'), cut(S.caught, 'beginner'))
}

/* ── 前の名詞を説明する分詞(2026-08 利用者の指定)────────────────
   > 後は、前の名詞を説明する分詞も初心者は分けて考えます。 */
console.log('\n▶ 前の名詞を説明する分詞の前に、切れ目がある')
{
  const has = (t, piece) => cut(t, 'beginner').includes(piece)
  ok('The money / raised by the fund', has(S.raised, 'money / raised'),
    cut(S.raised, 'beginner'))
  ok('Phone scams / targeting …(-ing も同じ)',
    has('Phone scams targeting elderly people were spreading fast.', 'scams / targeting'))
  ok('was raised は割らない(助動詞のうしろ)',
    !cut('The money was raised by the fund last year.', 'beginner').includes('was / raised'),
    cut('The money was raised by the fund last year.', 'beginner'))
  ok('a broken window は割らない(冠詞のうしろ)',
    !cut('He opened a broken window in the room.', 'beginner').includes('broken / window'),
    cut('He opened a broken window in the room.', 'beginner'))
  ok('quietly selling は割らない(副詞のうしろ)',
    !cut(S.caught, 'beginner').includes('quietly / selling'), cut(S.caught, 'beginner'))
  ok('by reading books は割らない(前置詞のうしろ)',
    !cut('She learns English by reading books every night.', 'beginner').includes('by / reading'),
    cut('She learns English by reading books every night.', 'beginner'))
  ok('stopped guessing は割らない(-ing を取る動詞のうしろ)',
    !cut('She stopped guessing and started copying the timing.', 'beginner').includes('stopped / guessing'))
}

console.log('\n▶ カタマリをつなぐと、もとの文に戻る')
for (const [name, text] of Object.entries(S)) {
  for (const lv of ['beginner', 'middle', 'advanced']) {
    const joined = cut(text, lv).split(' / ').join(' ')
    ok(`${name} / ${lv}`, joined === wordsOf(text).join(' '), joined)
  }
}

/* ── カタマリごとの訳(0021)────────────────────────────────
   訳は**初級の区切り**でそろえて控えてある。
   中級・上級はその**一部**なので、隣どうしをつないで作る。
   この前提が崩れると、**英語と訳の対がずれる**(いちばん害が大きい)。 */

console.log('\n▶ 中級・上級の区切りは、初級の区切りの一部である(訳をつなげる前提)')
for (const [name, text] of Object.entries(S)) {
  const base = new Set(slashesFor(text, 'beginner').map((x) => x.at))
  for (const lv of ['middle', 'advanced']) {
    const rest = slashesFor(text, lv).map((x) => x.at).filter((i) => !base.has(i))
    ok(`${name} / ${lv}`, rest.length === 0, `初級に無い区切り: ${rest.join(', ')}`)
  }
}

/* ── 控えの単位(2026-09 利用者の指定)──────────────────────────
   > 分詞修飾の訳し方がおかしいことが多いです。
   > the boy running in the park just said hello to me. の訳が
   > 「男の子は走っている / がたった今私にこんにちはと言いました」
   > 本来は、「走っている男の子」であるべきです

   **英語の区切りは変えていない。** 変えたのは訳を作る単位だけで、
   前の名詞を説明する語句は名詞と1つにまとめる。 */
console.log('\n▶ 控えの数は、初級のカタマリの数と同じ(分詞修飾のぶんだけ少ない)')
for (const [name, text] of Object.entries(S)) {
  const words = wordsOf(text)
  const marks = slashesFor(text, 'beginner').map((x) => x.at)
  const merged = marks.filter((i) => postModifier(words, i)).length
  ok(name, baseChunks(text).length === marks.length + 1 - merged,
    `控え ${baseChunks(text).length} / 区切り ${marks.length} / まとめた ${merged}`)
}

console.log('\n▶ 前の名詞を説明する語句は、名詞と1つのカタマリにする')
{
  const boy = 'The boy running in the park just said hello to me.'
  ok('分詞は名詞とまとめる(走っている男の子)',
    baseChunks(boy)[0] === 'The boy running', baseChunks(boy).join(' / '))
  // **英語の区切りそのものは、これまでどおり出す**(初心者は分けて考える)
  ok('英語の区切りは残っている(2026-08 の指定は変えていない)',
    slashesFor(boy, 'beginner').some((m) => m.at === 2), '「running の前」で切る')

  const scams = 'Phone scams targeting elderly people are increasing.'
  ok('-ing の分詞',
    baseChunks(scams)[0] === 'Phone scams targeting elderly people',
    baseChunks(scams).join(' / '))
  ok('-ed の分詞',
    baseChunks(S.raised)[0] === 'The money raised', baseChunks(S.raised).join(' / '))
  // **名詞の説明ではない分詞は、まとめない**(助動詞のあと・冠詞のあと)
  const broken = 'He found a broken window in the office this morning.'
  ok('冠詞のあとの分詞はまとめる相手がいない',
    baseChunks(broken).every((c) => c !== ''), baseChunks(broken).join(' / '))
  ok('つなぐともとの文に戻る(どの文でも)',
    Object.values({ ...S, boy, scams, broken })
      .every((t) => baseChunks(t).join(' ') === wordsOf(t).join(' ')))
}

/* ── 並べているもののつなぎ(2026-09 利用者の指定)──────────────
   > 同格の and の時に二つに分けれていません。
   > 例えば、A pair of shoes / and a water bottle を
   > /靴一足と水筒/ となってしまいます。そうではなく、
   > 靴一足 / と水筒一本 となるように修正してください */
console.log('\n▶ 並べているもの(and / or)の前で切る')
{
  const pair = 'A pair of shoes and a water bottle are enough.'
  ok('and の前が切れ目になる',
    baseChunks(pair).includes('and a water bottle'), baseChunks(pair).join(' / '))
  ok('and のところで切っても咎めない', checkSlashes(pair, [4]).length === 0)
  ok('and のあとで切るのは、これまでどおり咎める', checkSlashes(pair, [5]).length > 0)
  const or = 'You can bring a towel or a small mat to the class.'
  ok('or の前も切れ目になる',
    baseChunks(or).some((c) => c.startsWith('or ')), baseChunks(or).join(' / '))
  // **強さ1(初級だけ)。** 並べているだけで、意味が変わるわけではない
  ok('上級では出さない',
    !slashesFor(pair, 'advanced').some((m) => m.at === 4),
    slashesFor(pair, 'advanced').map((m) => m.why).join(' | '))
}

/* ── 訳を二度書かない(2026-09 実機)────────────────────────────
   窓口が隣のカタマリの意味まで書いてしまうことがあり、
   つなぐと「無視するのは難しい無視するのは」と出ていた。 */
console.log('\n▶ 訳をつなぐとき、同じことを二度書かない')
{
  const text = 'The numbers are hard to ignore.'
  const parts = ['The numbers', 'are hard', 'to ignore.']
  const item = {
    prompt_en: text,
    chunks: { en: text, parts, ja: ['数字は', '無視するのは難しい', '無視するのは'] },
  }
  // 自分の区切りを入れずに通しで見る = 3つがつながる
  const one = chunkPairsAtMarks(text, storedChunks(item), [], parts)
  ok('重なった訳は一度だけ出す',
    one?.[0]?.ja === '数字は無視するのは難しい', JSON.stringify(one))
  // **短い助詞は消さない**(行きすぎないこと)
  const keep = chunkPairsAtMarks('A B C', ['のは', 'のは です', ''], [], ['A', 'B', 'C'])
  ok('3文字に満たない訳は消さない', keep?.[0]?.ja?.startsWith('のは'), JSON.stringify(keep))
}

/* ── 1文ずつの対(2026-09 実機)──────────────────────────────
   > ディクテーション内での訳が、1文ずつになっていません。
   > 段落の訳が繰り返し表示されているだけです。

   英語1文がコロンのところで日本語2文に訳され、数が合わなかった。
   長さの比で当てられるときだけまとめる(外れそうならやらない)。 */
console.log('\n▶ 日本語のほうが文が多いときは、長さの比でまとめる')
{
  const en = "So you've decided to start going to the gym — nice, welcome to the club."
    + " Before you buy anything fancy, here's the honest truth:"
    + " you don't need a 15,000-yen pair of shoes on day one."
    + ' A basic pair of training shoes for about 4,000 yen and a water bottle'
    + ' are genuinely enough for your first month.'
    + " Most beginners waste money on gear before they've even figured out"
    + " if they'll actually show up three times a week."
  const ja = 'ジムに通うことに決めたんですね、いいですね、ようこそ。'
    + '派手なものを買う前に正直に言っておきます。初日から1万5千円の靴は要りません。'
    + '4千円ほどの基本的なトレーニングシューズと水筒があれば最初の1か月は十分です。'
    + 'ほとんどの初心者は、そもそも週3回本当に通えるか分かる前に道具にお金を'
    + '使いすぎてしまいます。'
  const out = alignedSentences(en, ja)
  ok('英語4文・日本語5文でも、1文ずつの対になる',
    out.length === 4 && out.every((p) => p.aligned),
    out.map((p) => `${p.aligned}: ${p.ja.slice(0, 12)}`).join('\n    '))
  ok('2文めには、コロンの前後の2文がまとまって付く',
    out[1]?.ja.startsWith('派手なものを') && out[1]?.ja.includes('初日から'))
  ok('4文めは最後の文だけ', out[3]?.ja.startsWith('ほとんどの初心者は'))

  // **当てられないときは、これまでどおり「段落の訳」に落ちる**
  const bad = 'Hi. ' + 'This is a very long sentence about the office. '.repeat(4) + 'End.'
  const badJa = `${'これは'.repeat(60)}とても長い最初の文です。短い。短い。短い。`
  ok('長さの比が合わないときは、まとめない',
    alignedSentences(bad, badJa).every((p) => !p.aligned))
}

console.log('\n▶ どのレベルでも、対をつなぐともとの文と訳に戻る')
for (const [name, text] of Object.entries(S)) {
  // 控えの代わりに、番号を訳のかわりに入れて突き合わせる
  const ja = baseChunks(text).map((_, i) => `＜${i}＞`)
  for (const lv of ['beginner', 'middle', 'advanced']) {
    const pairs = chunkPairs(text, ja, lv)
    const en = pairs?.map((p) => p.en).join(' ')
    const jp = pairs?.map((p) => p.ja).join('')
    ok(`${name} / ${lv} 英語`, en === wordsOf(text).join(' '), String(en))
    ok(`${name} / ${lv} 訳`, jp === ja.join(''), String(jp))
    /* そのレベルのカタマリの数と、対の数が合っていること。
       **数えるのは控えの切れ目**(`baseChunks`)である。
       分詞修飾は名詞とまとめてあるので、区切りの数とは一致しない
       (2026-09。訳を正しく出すために、そこは1つの単位で訳す) */
    const words = wordsOf(text)
    const kept = slashesFor(text, lv).map((x) => x.at)
      .filter((i) => !postModifier(words, i)).length
    ok(`${name} / ${lv} 数`, pairs?.length === kept + 1,
      `対 ${pairs?.length} / 切れ目 ${kept}`)
  }
}

console.log('\n▶ 数が合わない控えは、使わない(ずれた対は無いより悪い)')
{
  const text = S.office
  const short = baseChunks(text).slice(1).map((_, i) => `＜${i}＞`)
  ok('1つ足りない控え', chunkPairs(text, short, 'beginner') === null)
  ok('控えが無い', chunkPairs(text, null, 'beginner') === null)
  ok('控えが配列でない', chunkPairs(text, '訳', 'beginner') === null)
}

console.log('\n▶ 英文を直した教材の控えは、引き当てない')
{
  const text = S.office
  const ja = baseChunks(text).map((_, i) => `＜${i}＞`)
  ok('英文が同じなら引き当てる',
    storedChunks({ prompt_en: text, chunks: { en: text, ja } })?.length === ja.length)
  ok('英文が変わっていたら引き当てない',
    storedChunks({ prompt_en: `${text} Yes.`, chunks: { en: text, ja } }) === null)
  ok('空白の数だけの違いは同じとみなす',
    storedChunks({ prompt_en: text.replace(' ', '  '), chunks: { en: text, ja } }) !== null)
}

/* ── 自分の区切りに訳を当てる(2026-08 利用者の指定)──────────────
   > ③自分の区切りが反映された英文とそれに対応する日本語訳が
   > 一緒に表示される

   訳を切れるのは控えの境目だけ。境目でない区切りは、英語には出すが
   訳はまとめて置く。**英語も訳も、つなげばもとに戻る**ことが肝心である。 */

console.log('\n▶ 自分の区切りに訳を当てても、つなぐともとに戻る')
for (const [name, text] of Object.entries(S)) {
  const ja = baseChunks(text).map((_, i) => `＜${i}＞`)
  const base = slashesFor(text, 'beginner').map((x) => x.at)
  const total = wordsOf(text).length
  // ①控えの境目どおり ②その一部 ③境目に無いところも混ぜる ④何も入れない
  const cases = {
    '控えどおり': base,
    '一部だけ': base.filter((_, i) => i % 2 === 0),
    '境目に無い区切りも混ぜる': [...new Set([...base, 1, Math.max(1, total - 1)])],
    '区切りを入れていない': [],
  }
  for (const [how, marks] of Object.entries(cases)) {
    const pairs = chunkPairsAtMarks(text, ja, marks)
    const en = pairs?.map((p) => p.segs.join(' ')).join(' ')
    const jp = pairs?.map((p) => p.ja).join('')
    ok(`${name} / ${how} 英語`, en === wordsOf(text).join(' '), String(en))
    ok(`${name} / ${how} 訳`, jp === ja.join(''), String(jp))
  }
}

console.log('\n▶ 自分の区切りは、控えの境目でなくても英語に出る')
{
  const text = S.office   // 0 The 1 office 2 bought 3 a 4 new ...
  const ja = baseChunks(text).map((_, i) => `＜${i}＞`)
  const pairs = chunkPairsAtMarks(text, ja, [2])
  ok('境目でない区切りでも、英語は2つに割れている',
    pairs?.[0]?.segs.length === 2, JSON.stringify(pairs?.[0]))
  ok('訳はまとめて1つ', typeof pairs?.[0]?.ja === 'string' && pairs[0].ja.length > 0)
  ok('控えが無ければ出さない', chunkPairsAtMarks(text, null, [2]) === null)
}

/* ── 控えの切れ目を残す・作り直しの判断(2026-08)────────────────
   表示のたびに切れ目を計算し直していたので、決まりを直すと
   すでに作った訳が丸ごと出なくなった。控えたときの切れ目を残せばずれない。 */

console.log('\n▶ 控えた切れ目(parts)があれば、決まりを変えてもずれない')
{
  const text = S.office
  // わざと**粗い**切れ目で控える(2カタマリ)。いまの決まりはもっと細かい
  const parts = [wordsOf(text).slice(0, 7).join(' '), wordsOf(text).slice(7).join(' ')]
  const item = { prompt_en: text, chunks: { en: text, ja: ['＜0＞', '＜1＞'], parts } }
  const pairs = chunkPairs(text, storedChunks(item), 'beginner', parts)
  ok('粗い控えでも対が作れる', pairs?.length === 2, JSON.stringify(pairs))
  ok('つなぐともとの文に戻る',
    pairs?.map((p) => p.en).join(' ') === wordsOf(text).join(' '))
  ok('自分の区切りでも対が作れる',
    chunkPairsAtMarks(text, storedChunks(item), [7], parts)?.length === 2)
}

console.log('\n▶ 作り直しが要るかの判断は1か所(needsChunkJa)')
{
  const text = S.office
  const now = baseChunks(text)
  const ja = now.map((_, i) => `＜${i}＞`)
  ok('控えが無ければ作る', needsChunkJa({ prompt_en: text }) === true)
  ok('数が合わなければ作る',
    needsChunkJa({ prompt_en: text, chunks: { en: text, ja: ['1つだけ'] } }) === true)
  ok('いまの決まりどおりなら、作り直さない',
    needsChunkJa({ prompt_en: text, chunks: { en: text, ja, parts: now } }) === false)
  // **いまのほうが細かければ、一度だけ作り直す**(訳を真下にそろえるため)
  const long = S.rinse
  const coarse = [wordsOf(long).slice(0, 5).join(' '), wordsOf(long).slice(5).join(' ')]
  ok(`いまのほうが細かければ作り直す(いま ${baseChunks(long).length} > 控え 2)`,
    baseChunks(long).length > 2 && needsChunkJa({
      prompt_en: long, chunks: { en: long, ja: ['＜0＞', '＜1＞'], parts: coarse },
    }) === true)
}

console.log(ng === 0 ? '\n✅ 区切りの検証はすべて意図どおりです' : `\n❌ ${ng} 件おかしい`)
process.exit(ng === 0 ? 0 : 1)
