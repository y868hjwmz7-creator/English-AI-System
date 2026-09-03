/**
 * **会話の間**(`src/lib/turnGap.js`)を数字で確かめる。
 *
 * 【なぜ要るか】
 *   こちらには音が聞こえない(`test-loudness.mjs` と同じ)。
 *   「食い気味かどうか」は耳でしか分からないので、
 *   **せめて「どの型に当てはめたか」は機械的に確かめる。**
 *
 *   間違った間は、無い間より気持ちが悪い。とくに
 *   **付加疑問(だよね?)を、ふつうの疑問文と取り違えない**ことが大事である。
 *   取り違えると、同意を求めただけなのに1秒近く黙る。
 *
 * 使い方: `npm run test:gap`
 */
import { GAP_VALUES, turnGapMs } from '../src/lib/turnGap.js'
import { voiceRateOf } from '../src/data/clipVoices.js'

const { BASE, QUICK, THINK, BREATH, MAX_GAP } = GAP_VALUES

let failed = 0
const check = (label, ok, detail = '') => {
  if (ok) {
    console.log(`✓ ${label}${detail ? ` — ${detail}` : ''}`)
  } else {
    console.error(`❌ ${label}${detail ? ` — ${detail}` : ''}`)
    failed += 1
  }
}

/** 実際に出た値を見せながら確かめる */
const gap = (prev, next) => turnGapMs(prev, next)
const shows = (prev, next) => `${gap(prev, next)}ms`

// ── ① 食い気味になるべきところ ────────────────────────────
console.log('\n▶ 食い気味(すぐ返る)')

const quickCases = [
  ['言い終わっていない(—)',
    "I'd push back a little —", 'Sorry, but the cap has to move.'],
  ['言いよどんで消えた(...)',
    'I was thinking we could...', 'We could split the basket.'],
  ['相づちで始まる(Right)',
    'The indemnity cap is too high for that basket.', "Right, that's my concern too."],
  ['同意で始まる(Exactly)',
    'We need the IP reps tightened.', 'Exactly what I was going to say.'],
  ['即答(Of course)',
    'Could you send the markup tonight?', 'Of course, I will.'],
  ['付加疑問(, right?)',
    "That's the standard position, right?", 'It is, in most deals.'],
  ["付加疑問(, isn't it?)",
    "The cap is proportionate, isn't it?", 'It is now.'],
]
for (const [label, prev, next] of quickCases) {
  check(label, gap(prev, next) === QUICK, shows(prev, next))
}

// ── ② 考えてから答えるところ ──────────────────────────────
console.log('\n▶ 考えてから答える')

check('言いよどみで始まる(Well)',
  gap('So where do you land on the cap?', "Well, I'd need to check with the client.") >= THINK,
  shows('So where do you land on the cap?', "Well, I'd need to check with the client."))

check('言いよどみで始まる(Let me)',
  gap('What is your number?', 'Let me look at the schedule first.') >= THINK,
  shows('What is your number?', 'Let me look at the schedule first.'))

check('ふつうの疑問文には間が空く',
  gap('What would you propose instead?', 'A five percent cap on that basket.') >= THINK,
  shows('What would you propose instead?', 'A five percent cap on that basket.'))

check('長い問いほど、少し長くなる',
  gap('Given where we landed on the IP reps and the disclosure schedules, '
    + 'what cap would your client actually accept for that specific basket?', 'Ten percent.')
  > gap('What cap?', 'Ten percent.'),
  `${shows('Given where we landed on the IP reps and the disclosure schedules, '
    + 'what cap would your client actually accept for that specific basket?', 'Ten percent.')}`
  + ` と ${shows('What cap?', 'Ten percent.')}`)

// ── ③ ふつうの受け答え ────────────────────────────────────
console.log('\n▶ ふつうの受け答え')

check('どれにも当てはまらなければ、基準の間',
  gap('Our client is willing to beef up the IP reps.',
    "That's fair, though the cap has to come down.") === BASE,
  shows('Our client is willing to beef up the IP reps.',
    "That's fair, though the cap has to come down."))

// **次の発言に、即答の語も言いよどみも入れないこと。** それらが先に当たると
// 「前が長い」の枝を通らない(この検証を書いたとき、実際に取り違えた)
const longPrev = 'Our client is willing to beef up the IP reps, but only if the indemnity cap '
  + 'for that specific basket comes down to something far more proportionate '
  + 'than what the current draft sets out across every single category here.'
check('前が長ければ、少しだけ足す',
  gap(longPrev, 'The principle is acceptable to us.') > BASE,
  shows(longPrev, 'The principle is acceptable to us.'))

// ── ④ 取り違えてはいけないもの ────────────────────────────
//
// **ここが、この検証のいちばん大事なところである。**
// 「?で終わって、最後のコンマから先が短い」だけで付加疑問と判定すると、
// 並べて訊いているだけの文まで食い気味になる。
console.log('\n▶ 取り違えないか')

const listQ = 'Would you rather take the escrow, the holdback, or juice?'
check('並べて訊いているだけの文を、付加疑問と取り違えない',
  gap(listQ, 'The escrow.') >= THINK, shows(listQ, 'The escrow.'))

check('「No」で始まる否定の即答は、食い気味でよい',
  gap('Can we close on Friday?', 'No, the consents are not in.') === QUICK,
  shows('Can we close on Friday?', 'No, the consents are not in.'))

// ── ⑤ 上限と下限 ──────────────────────────────────────────
console.log('\n▶ 行きすぎないか')

// `It depends.` は言いよどみの語なので使わない(④が先に当たって⑤を通らない)
const veryLongQ = `${'What do you think about this point? '.repeat(30)}What is your view?`
check('どんなに長くても上限を超えない',
  gap(veryLongQ, 'The cap should be five percent.') <= MAX_GAP,
  shows(veryLongQ, 'The cap should be five percent.'))
check('長い問いは、ちゃんと上限まで伸びている',
  gap(veryLongQ, 'The cap should be five percent.') > THINK,
  shows(veryLongQ, 'The cap should be five percent.'))

check('どんな組み合わせでも、間は必ず 0 より大きい',
  [['', ''], ['a', 'b'], ['?', '?'], ['—', '—']]
    .every(([p, n]) => turnGapMs(p, n) > 0))

// ── ⑥ 同じ人が続けて話すとき(記事の段落)────────────────
//
// **受け答えの規則を当てない。** 相づちも付加疑問も「相手がいる」話であって、
// 一人で読んでいるところには無い。当てると
// 「段落が Right, で始まったので食い気味」という、意味のない間になる。
console.log('\n▶ 記事の段落(同じ人が続けて話す)')

const same = (prev, next) => turnGapMs(prev, next, { sameVoice: true })

check('段落の切れ目には、受け答えより長い息継ぎを置く',
  same('The market moved sharply last week.', 'Analysts had expected a slower shift.')
  === BREATH && BREATH > BASE,
  `${same('The market moved sharply last week.', 'Analysts had expected a slower shift.')}ms`)

check('相づちの語で始まっても、食い気味にしない',
  same('The market moved sharply last week.', 'Right of way was the next issue.') === BREATH,
  `${same('The market moved sharply last week.', 'Right of way was the next issue.')}ms`)

check('付加疑問で終わっても、食い気味にしない',
  same("It was a fair price, right?", 'The buyers thought otherwise.') > QUICK,
  `${same("It was a fair price, right?", 'The buyers thought otherwise.')}ms`)

check('問いかけで終わっていれば、一拍おく',
  same('So what changed?', 'Three things, mostly.') > BREATH,
  `${same('So what changed?', 'Three things, mostly.')}ms`)

check('言い終わっていなければ、続きなので詰める',
  same('The plan was simple —', 'buy low, wait, and sell.') === QUICK,
  `${same('The plan was simple —', 'buy low, wait, and sell.')}ms`)

check('段落でも上限を超えない',
  same(veryLongQ, 'The answer is complicated.') <= MAX_GAP,
  `${same(veryLongQ, 'The answer is complicated.')}ms`)

// ── ⑦ 声ごとの速さの補正 ──────────────────────────────────
//
// **v3 は `speed` に対応していない**ので、鳴らすときの playbackRate で直す。
// MP3 は作り直さないため、費用はかからない。
console.log('\n▶ 声ごとの速さの補正')

check('Jofra は 1.2 倍', voiceRateOf('uk-3') === 1.2, `${voiceRateOf('uk-3')}`)
check('Henry は 1.2 倍', voiceRateOf('uk-4') === 1.2, `${voiceRateOf('uk-4')}`)
check('指定していない声は 1 倍のまま(全員を速くしない)',
  ['us-1', 'us-2', 'uk-1', 'uk-2', 'au-1', 'au-3'].every((id) => voiceRateOf(id) === 1))
check('名簿に無い声でも落ちない', voiceRateOf('us-female') === 1)

console.log(failed
  ? `\n❌ ${failed} 件が意図どおりではありません`
  : '\n✅ 会話の間の検証はすべて意図どおりです')
process.exit(failed ? 1 : 0)
