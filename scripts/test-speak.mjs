/**
 * **読み上げ用の英文への書き換え**を、実際の文で数える(第5.205節)。
 *
 *   > 画面表示用の英語(Written Form)と、TTS に渡す自然な読み上げ用英語
 *   > (Spoken Form)が異なる表記を正しく変換する。**単純な文字置換ではなく、
 *   > 文脈を判定してから**適切な spoken form へ変換する(2026-09 利用者の指定)
 *
 * ============================================================================
 * 【この検証が守るもの】
 *
 *   ① 数の言い方(整数・序数・年・年代・小数・分数・1桁ずつ)が正しいこと
 *   ② **文脈で読みが変わるもの**が、両方の向きで正しいこと
 *      (`Dr.` = Doctor / Drive、`St.` = Saint / Street …)
 *   ③ **壊してはいけないもの**が壊れないこと ——
 *      IP アドレス・版番号・日付・お金を、小数や分数として読まない
 *   ④ **変えてはいけない文が、1文字も変わらないこと。**
 *      「変える」側だけを見ると、**何でも書き換える形**に壊しても緑になる
 *   ⑤ **本物の教材を全部通して**、読み上げ用の文に**数字も記号も残らない**こと。
 *      `$sixty-three` のような**半端な書き換え**は、ここでしか見つからない
 *   ⑥ 画面の英文は**1文字も変えない**(Written Form と Spoken Form を分ける)
 *   ⑦ 窓口に渡すところで、**本当に呼んでいる**こと
 *
 * 【いちばん危ない形を、必ず1つ置く】(CLAUDE.md)
 *
 *   空の文字列・数字も記号も無い文・数字だけの文・
 *   **判断がつかない形**(`3/4` `03/04/2026`)・
 *   **英語の語と同じ字の単位**(`911 in case`)・
 *   **英語の語と同じ形のローマ数字**(`I` `MIX`)。
 *
 * 【なぜ素の node で走るのか】
 *   `speakText.js` は Supabase も `import.meta.env` も引き連れていない。
 *   **だから、ここで直に読める**(`frameMatch.js` と同じ作法)。
 * ============================================================================
 */
import { readFileSync } from 'node:fs'
import {
  cardinal, decadeWords, decimalWords, digitsWords, fractionWords,
  mixedFractionWords, ordinal, yearWords,
} from '../src/lib/speakNum.js'
import {
  CLASSES, DOMAINS, LOCALES, displayAtOf, speakText, spokenForm,
} from '../src/lib/speakText.js'
import { UNITS, WORD_ACRONYMS } from '../src/data/speakDict.js'
import { NATIVE_FLOW } from '../src/data/nativeFlow.js'
import { COLLOCATIONS } from '../src/data/collocations.js'
import { FRAME_SECTIONS } from '../src/data/sentenceFrames.js'
/* **読み方の指定**(第5.266節)。素の node でそのまま走る */
import { applySayAs, parseSayAs, sayAsText, spellKana } from '../src/lib/sayAs.js'
/* **読み名簿**(第5.269節)。大文字の並びでも文字ずつに開かない名前 */
import { SAY_AS_BOOK } from '../src/data/speakDict.js'

const ROOT = new URL('..', import.meta.url).pathname
const readD = (p) => readFileSync(ROOT + p, 'utf8')
/** **コメントを落としてから数える。** 説明文にも同じ語が出てくる */
const code = (p) => readD(p)
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|[^:])\/\/.*$/gm, '$1 ')

let ng = 0
const ok = (cond, label, extra = '') => {
  if (cond) { console.log('  ✓', label) } else { ng += 1; console.log('  ✗', label, extra) }
}

/* ══════════════════════════════════════════════════════════════════
   ① 数の言い方
   ══════════════════════════════════════════════════════════════════ */
console.log('\n── ① 数の言い方 ──')
{
  const num = [
    [25, 'twenty-five'], [100, 'one hundred'],
    [1250, 'one thousand two hundred fifty'], [1000000, 'one million'],
  ]
  ok(num.every(([n, w]) => cardinal(n) === w), '整数(CARDINAL)',
    num.map(([n]) => `${n}=${cardinal(n)}`).join(' / '))
  /* **イギリス英語だけが `and` を挟む。**
     どちらも見ないと、片方に寄せても緑のままになる */
  ok(cardinal(125, { locale: 'en-GB' }) === 'one hundred and twenty-five'
    && cardinal(125) === 'one hundred twenty-five',
  'en-GB は `and` を挟み、en-US は挟まない', cardinal(125, { locale: 'en-GB' }))

  const ord = [[1, 'first'], [2, 'second'], [3, 'third'], [4, 'fourth'],
    [21, 'twenty-first'], [22, 'twenty-second'], [23, 'twenty-third'], [102, 'one hundred second']]
  ok(ord.every(([n, w]) => ordinal(n) === w), '序数(ORDINAL)',
    ord.filter(([n, w]) => ordinal(n) !== w).map(([n, w]) => `${n}→${ordinal(n)}≠${w}`).join(' / '))

  const yr = [[1492, 'fourteen ninety-two'], [1908, 'nineteen oh eight'],
    [1999, 'nineteen ninety-nine'], [2000, 'two thousand'], [2003, 'two thousand three'],
    [2012, 'twenty twelve'], [2026, 'twenty twenty-six'], [1066, 'ten sixty-six']]
  ok(yr.every(([n, w]) => yearWords(n) === w), '年(YEAR)は、整数とは別の言い方',
    yr.filter(([n, w]) => yearWords(n) !== w).map(([n, w]) => `${n}→${yearWords(n)}≠${w}`).join(' / '))
  /* **年と整数が、同じ言い方になっていないこと。**
     同じなら「年のクラス」が無いのと同じである */
  ok(yearWords(2026) !== cardinal(2026), '年と整数は、言い方が違う',
    `${yearWords(2026)} / ${cardinal(2026)}`)

  ok(decadeWords(1980) === 'the nineteen eighties' && decadeWords(2000) === 'the two thousands',
    '年代(DECADE)', `${decadeWords(1980)} / ${decadeWords(2000)}`)
  ok(decimalWords('3.14') === 'three point one four'
    && decimalWords('0.05') === 'zero point zero five'
    && decimalWords('.5') === 'zero point five',
  '小数は、小数点以下を1桁ずつ', decimalWords('3.14'))
  ok(fractionWords(1, 2) === 'one half' && fractionWords(2, 3) === 'two thirds'
    && fractionWords(3, 8) === 'three eighths' && fractionWords(3, 4) === 'three quarters',
  '分数(FRACTION)', fractionWords(3, 8))
  ok(mixedFractionWords(2, 1, 2) === 'two and a half'
    && mixedFractionWords(5, 3, 4) === 'five and three quarters',
  '帯分数は `and a half`(one half ではない)', mixedFractionWords(2, 1, 2))
  ok(digitsWords('007') === 'zero zero seven'
    && digitsWords('007', { zero: 'oh' }) === 'oh oh seven'
    && digitsWords('555', { pairs: true }) === 'triple five',
  '1桁ずつ(先頭ゼロ・oh・double/triple)', digitsWords('007'))
  /* **先頭ゼロを、ふつうの整数にしない** */
  ok(digitsWords('05') !== cardinal(5), '`05` を `five` と読まない', digitsWords('05'))
  /* **数えきれない大きさは、`null` を返して呼ぶ側に任せる** */
  ok(cardinal(1e19) === null && cardinal('x') === null && ordinal(-1) === null,
    '読めないものは null を返す(当てずっぽうで返さない)')
}

/* ══════════════════════════════════════════════════════════════════
   ② 文の書き換え。**仕様書の例を、そのまま突き合わせる**
   ══════════════════════════════════════════════════════════════════ */
console.log('\n── ② 文の書き換え ──')
const say = (t, o) => spokenForm(t, o)
/** @type {Array<[string, string, object?]>} 画面の文 / 読み上げ用の文 */
const TABLE = [
  // 利用者があげた例
  ['The meeting starts at 10 a.m. on March 8.',
    'The meeting starts at ten A M on March eighth.'],
  ['The price is $25.50.', 'The price is twenty-five dollars and fifty cents.'],
  ['Drive 5 km at 60 km/h.', 'Drive five kilometers at sixty kilometers per hour.'],
  ['$25', 'twenty-five dollars'],
  ['5 km', 'five kilometers'],
  ['Mr. Smith', 'Mister Smith'],
  ['March 8', 'March eighth'],
  ['March 8 or 9', 'March eighth or ninth'],
  // 実機でずれていた文(第5.204節)
  ["There's a 10 A.M. departure each day.", "There's a ten A M departure each day."],
  ["It's $63 for the morning departure.", "It's sixty-three dollars for the morning departure."],
  ['It will be an additional $20.', 'It will be an additional twenty dollars.'],
  // 単数・複数
  ['1 kg', 'one kilogram'],
  ['2 kg', 'two kilograms'],
  ['$1', 'one dollar'],
  // 日付・年・年代
  ['March 8, 2026', 'March eighth, twenty twenty-six'],
  ['March 8-10', 'March eighth through tenth'],
  ['in 1999', 'in nineteen ninety-nine'],
  ['the 1980s', 'the nineteen eighties'],
  ['21st century', 'twenty-first century'],
  ['300 BC', 'three hundred B C'],
  ['AD 1066', 'A D ten sixty-six'],
  // 時刻
  ['9:30', 'nine thirty'],
  ['9:05', 'nine oh five'],
  ['9:00', "nine o'clock"],
  // **文の終わりの点は、開いた語に戻す**(そこで文が切れなくなるため)
  ['It starts at 12:30 p.m.', 'It starts at twelve thirty P M.'],
  ['18:00', 'eighteen hundred hours'],
  ['We work 9 a.m.-5 p.m. here.', 'We work nine A M to five P M here.'],
  // お金・割合
  ['£20', 'twenty pounds'],
  ['¥5,000', 'five thousand yen'],
  ['$5K', 'five thousand dollars'],
  ['USD 25', 'twenty-five U.S. dollars'],
  ['5%', 'five percent'],
  ['20-30%', 'twenty to thirty percent'],
  ['25 bps', 'twenty-five basis points'],
  // 単位・温度・角度・大きさ
  ['10 kg', 'ten kilograms'],
  ['60 mph', 'sixty miles per hour'],
  ['5 m²', 'five square meters'],
  ['5 m³', 'five cubic meters'],
  ['25°C', 'twenty-five degrees Celsius'],
  ['45°', 'forty-five degrees'],
  ['5 × 10 cm', 'five by ten centimeters'],
  // 比・得点・範囲・年齢
  ['3:1', 'three to one'],
  ['16:9', 'sixteen to nine'],
  ['5-10', 'five to ten'],
  ['a 5-year-old', 'a five-year-old'],
  // 敬称・略語
  ['Dr. Smith', 'Doctor Smith'],
  ['Prof. Smith', 'Professor Smith'],
  ['I met John Smith Jr.', 'I met John Smith Junior.'],
  ['King Charles III', 'King Charles the Third'],
  ['Henry VIII', 'Henry the Eighth'],
  ['CEO', 'C E O'],
  ['NASA', 'NASA'],
  ['MP3', 'M P three'],
  // 識別番号・版・URL(**ふつうの数にしない**)
  ['Room 205', 'Room two oh five'],
  ['Flight 507', 'Flight five oh seven'],
  ['Bus 24', 'Bus twenty-four'],
  ['555-1234', 'five five five, one two three four'],
  ['v2.4.1', 'version two point four point one'],
  ['192.168.1.1', 'one nine two dot one six eight dot one dot one'],
  ['report.pdf', 'report dot P D F'],
  ['john@example.com', 'john at example dot com'],
  ['#5', 'number five'],
  // イギリス英語
  ['March 8', 'the eighth of March', { locale: 'en-GB' }],
  ['1,250', 'one thousand two hundred and fifty', { locale: 'en-GB' }],
]
{
  const bad = TABLE.filter(([src, want, o]) => say(src, o) !== want)
  ok(bad.length === 0, `仕様書の例 ${TABLE.length} 本が、そのとおりに読まれる`,
    bad.map(([src, want, o]) => `「${src}」→「${say(src, o)}」≠「${want}」`).join(' / '))
}

/* ══════════════════════════════════════════════════════════════════
   ③ **壊してはいけないもの**(利用者の指定 PROCESSING PRIORITY)
   ══════════════════════════════════════════════════════════════════ */
console.log('\n── ③ 壊してはいけないもの ──')
{
  const ip = say('192.168.1.1')
  ok(!/hundred|point one hundred/.test(ip), 'IP アドレスを、ふつうの小数として読まない', ip)
  const ver = say('v2.4.1')
  ok(/version/.test(ver) && !/two point four one/.test(ver), '版番号を、小数として読まない', ver)
  const date = say('03/08/2026')
  ok(/March|of March/.test(date) && !/eighths|over/.test(date), '日付を、分数として読まない', date)
  const money = say('$25.50')
  ok(/cents/.test(money) && !/twenty-five point five/.test(money),
    'お金を、ただの小数として読まない', money)
  const mail = say('john.smith@example.co.jp')
  ok(/ at /.test(mail) && !/point/.test(mail), 'メールの点を、小数点として読まない', mail)
  /* **範囲の `-` を minus と読まない / 負の数の `-` を範囲と読まない** */
  ok(!/minus/.test(say('pages 5-10')), '範囲の `-` を minus と読まない', say('pages 5-10'))
  ok(/minus/.test(say('It dropped -5 degrees')), '負の数の `-` は minus',
    say('It dropped -5 degrees'))
  /* **`/` の読み分け** */
  ok(/per/.test(say('60 km/h')) && /half/.test(say('1/2'))
    && /slash/.test(say('https://example.com/home')),
  '`/` を per / 分数 / slash に読み分ける')
}

/* ══════════════════════════════════════════════════════════════════
   ④ **文脈で決める**(同じ字・違う読み)。**両方の向きを見る**
   ══════════════════════════════════════════════════════════════════ */
console.log('\n── ④ 文脈で決める ──')
{
  ok(/Doctor/.test(say('Dr. Smith is here.')), '`Dr.` + 人の名前 → Doctor', say('Dr. Smith is here.'))
  ok(/Drive/.test(say('We live on Maple Dr.')), '`Dr.` + 通りの名前 → Drive', say('We live on Maple Dr.'))
  ok(/Saint/.test(say('St. Paul was there.')), '`St.` + 人の名前 → Saint', say('St. Paul was there.'))
  ok(/Street/.test(say('It is on King St.')), '`St.` + 通りの名前 → Street', say('It is on King St.'))
  /* **決められなければ、変えない**(当てずっぽうで意味を変えない) */
  ok(say('The Dr. was late.') === 'The Dr. was late.',
    '決められない `Dr.` は、変えない', say('The Dr. was late.'))
  /* **英語の語と同じ字の単位** */
  ok(!/inch/.test(say('Dial 911 in case of emergency.')),
    '`in`(前置詞)を inches と読まない', say('Dial 911 in case of emergency.'))
  ok(/inches/.test(say('It is 6 in.')), '`6 in.` は inches', say('It is 6 in.'))
  /* **英語の語と同じ形のローマ数字** */
  ok(say("Because I'm hungry.") === "Because I'm hungry.",
    '`I`(代名詞)をローマ数字と読まない', say("Because I'm hungry."))
  ok(/the Second/.test(say('Elizabeth II')), '人名のうしろのローマ数字は序数')
  /* **domain で変わるもの** */
  ok(/first quarter/.test(say('Q1', { domain: 'BUSINESS' }))
    && !/first quarter/.test(say('Q1')),
  '`Q1` は business のときだけ「first quarter」', say('Q1', { domain: 'BUSINESS' }))
  ok(/water/.test(say('H2O', { domain: 'SCIENCE' })) && /H two O/.test(say('H2O')),
    '`H2O` は science のときだけ意味で読む', say('H2O'))
  /* **利用者の名簿が、いちばん強い** */
  ok(say('SQL', { dict: { SQL: 'sequel' } }) === 'sequel' && say('SQL') === 'S Q L',
    '利用者の名簿が、決まりより先に効く', say('SQL', { dict: { SQL: 'sequel' } }))
}

/* ══════════════════════════════════════════════════════════════════
   ④の裏 **文の終わりの点を、食べたままにしない**(2026-09 実機)
   ══════════════════════════════════════════════════════════════════ */
console.log('\n── ④の裏 文の終わりの点 ──')
{
  /* `P.M.` の点は、**文の終わりの点を兼ねている。**
     食べたままだと、向こうは息継ぎ無しで次の文へ続けて読む */
  const one = say('The arrival time is 4:50 P.M. For the 10:20 departure, it is late.')
  ok(/P M\. For/.test(one), '文を終わらせている点は、開いた語に戻す', one)
  /* **戻しすぎない。** `Mr.` の点は文を終わらせていない */
  const two = say('Mr. Smith is here.')
  ok(two === 'Mister Smith is here.', '略語だけの点は、戻さない', two)
  /* 文の終わりが略語のときも戻す */
  ok(say('We meet on Mon.') === 'We meet on Monday.', '文の終わりの略語にも、点を戻す',
    say('We meet on Mon.'))
  /* **文の途中の `a.m.` には戻さない** */
  ok(say('At 7 A.M. the bus leaves.') === 'At seven A M the bus leaves.',
    '文の途中の点は、戻さない', say('At 7 A.M. the bus leaves.'))
}

/* ══════════════════════════════════════════════════════════════════
   ④の裏 **大文字1文字は、席の記号であって単位ではない**(2026-09 実機)
   ══════════════════════════════════════════════════════════════════ */
console.log('\n── ④の裏 大文字1文字 ──')
{
  const seat = say('I can give you seats 12 A, B, and C.')
  ok(!/amperes?/.test(seat), '`12 A` を「amperes」と読まない', seat)
  ok(/twelve A,/.test(seat), '数だけを言葉にして、記号はそのまま残す', seat)
  /* **理科の話のときは、単位として読む**(「出る」側も見る) */
  ok(/amperes/.test(say('The current is 12 A.', { domain: 'SCIENCE' })),
    '理科の話なら、`12 A` はアンペア', say('The current is 12 A.', { domain: 'SCIENCE' }))
  /* 小文字の単位は、これまでどおり */
  ok(say('It is 12 m long.') === 'It is twelve meters long.',
    '小文字の単位は、これまでどおり読む', say('It is 12 m long.'))
}

/* ══════════════════════════════════════════════════════════════════
   ⑤ **変えてはいけない文は、1文字も変えない**(「出ない」側)
   ══════════════════════════════════════════════════════════════════ */
console.log('\n── ⑤ 変えない側 ──')
{
  const KEEP = [
    'Could you tell me where the station is?',
    "I'm not sure whether he will come.",
    'The answer is no.',
    'She has a well-known brother-in-law.',
    "Let's take a rain check on that.",
    'It was a long and difficult day, but we made it.',
    'Is it going OK?',
    '',
  ]
  const moved = KEEP.filter((t) => speakText(t).text !== t)
  ok(moved.length === 0, `数字も記号も無い文 ${KEEP.length} 本は、1文字も変わらない`,
    moved.map((t) => `「${t}」→「${say(t)}」`).join(' / '))
  ok(KEEP.every((t) => speakText(t).changed === false),
    '変えていないときは changed が false')
  /* **画面の文字列そのものを、書き換えていないこと** */
  const src = 'The price is $25.50.'
  const before = `${src}`
  speakText(src)
  ok(src === before, '画面の英文は、1文字も変えない(Written Form を守る)')
}

/* ══════════════════════════════════════════════════════════════════
   ⑤の裏 **読み上げ用の位置 → 画面の位置**(`displayAtOf`)

   端末の声は、合図(`boundary`)を**読み上げ用の文の位置**で返す。
   戻さないと、`$25` のところから先が**ずっとずれたまま**になる。
   ══════════════════════════════════════════════════════════════════ */
console.log('\n── ⑤の裏 位置の戻し ──')
{
  const src = 'Pay $25 now and 5 km later.'
  const got = speakText(src)
  const at = (w) => displayAtOf(got, got.text.indexOf(w))
  ok(at('Pay') === src.indexOf('Pay'), '書き換えの手前は、そのままの位置', String(at('Pay')))
  ok(at('twenty-five') === src.indexOf('$25'), '書き換えた塊の中は、塊の頭を返す', String(at('twenty-five')))
  ok(at('dollars') === src.indexOf('$25'), '塊の途中でも、塊の頭', String(at('dollars')))
  ok(at('now') === src.indexOf('now'), '書き換えのうしろは、ずれを引いた位置', String(at('now')))
  ok(at('later') === src.indexOf('later'), '2つ書き換えたあとも、合っている', String(at('later')))
  /* **書き換えが無ければ、位置は1つも動かない** */
  const plain = speakText('No numbers here at all.')
  ok([0, 3, 10, 20].every((i) => displayAtOf(plain, i) === i),
    '書き換えが無い文では、位置は動かない')
  ok(displayAtOf(got, -1) === 0 && displayAtOf(got, NaN) === 0,
    '数でない位置を渡しても落ちない')
}

/* ══════════════════════════════════════════════════════════════════
   ⑥ **本物の教材を全部通す。** 半端な書き換えは、ここでしか出ない
   ══════════════════════════════════════════════════════════════════ */
console.log('\n── ⑥ 本物の教材を全部通す ──')
{
  const texts = []
  const walk = (v, d = 0) => {
    if (d > 7) return
    if (typeof v === 'string') { texts.push(v); return }
    if (Array.isArray(v)) { v.forEach((x) => walk(x, d + 1)); return }
    if (v && typeof v === 'object') Object.values(v).forEach((x) => walk(x, d + 1))
  }
  walk(NATIVE_FLOW); walk(COLLOCATIONS); walk(FRAME_SECTIONS)
  const en = texts.filter((t) => t.length >= 8 && /[A-Za-z]{3}/.test(t)
    && !/[ぁ-んァ-ヶ一-龠]/.test(t))
  ok(en.length > 300, `教材の英文 ${en.length} 本を通す`)

  /* **読み上げ用の文に、通貨や `%` が残っていないこと。**
     残っていたら「半端な書き換え」である(`$sixty-three` の形) */
  const left = en.map((t) => [t, say(t)])
    .filter(([, s]) => /[$£€¥₩₹%°]/.test(s))
  ok(left.length === 0, '書き換えたあとに、通貨や % の記号が残らない',
    left.slice(0, 3).map(([t, s]) => `「${t}」→「${s}」`).join(' / '))

  /* **数字も残っていないこと**(読み上げ用なので、声にならない字は残さない) */
  const digits = en.map((t) => [t, say(t)]).filter(([, s]) => /\d/.test(s))
  ok(digits.length === 0, '書き換えたあとに、数字が残らない',
    digits.slice(0, 5).map(([t, s]) => `「${t}」→「${s}」`).join(' / '))

  /* **通したうちの何本かは、本当に変わっていること。**
     1本も変わらなければ、**何もしない形**に壊しても緑のままになる */
  const n = en.filter((t) => speakText(t).changed).length
  ok(n >= 20, `そのうち ${n} 本が、本当に書き換わっている`)
}

/* ══════════════════════════════════════════════════════════════════
   ⑦ 窓口へ渡すところで、**本当に呼んでいる**
   ══════════════════════════════════════════════════════════════════ */
console.log('\n── ⑦ 本当に呼んでいるか ──')
{
  const clips = code('src/lib/audioClips.js')
  ok(/from '\.\/speakText\.js'/.test(clips), '`audioClips.js` が読み上げ用の英文を読んでいる')
  /* **鍵も、読み上げ用の英文で取る。** 画面の文字で取ると、
     読み方の決まりを直しても**古い音が鳴り続ける** */
  const n = (clips.match(/spokenForm\(/g) ?? []).length
  ok(n >= 1, '`spokenForm()` を通している', `${n} か所`)
  /* **指紋(置き場所)も、読み上げ用の英文で取っていること。**
     画面の英文で取ると、読み方の決まりを直しても**古い音が鳴り続ける** */
  ok(/const ttsBody = \(text\) => spokenForm\(normText\(text\)\)/.test(clips)
    && (clips.match(/const body = ttsBody\(text\)/g) ?? []).length >= 4,
  '指紋も、読み上げ用の英文から取っている')

  const speech = code('src/lib/speech.js')
  ok(/speakText\(/.test(speech), '端末の声の道も、同じ書き換えを通る')
  /* **合図の位置を、画面の位置へ戻していること。**
     戻さないと、`$25` のところから先が**ずっとずれる** */
  ok(/displayAtOf\(/.test(speech), '端末の声の合図を、画面の英文の位置へ戻している')
  /* **語の色は、画面の英文で数えていること**(窓口へ渡す英文ではない) */
  ok(/marksFromTimes\(onScreen/.test(clips) && /wordMarks\(onScreen/.test(clips),
    '語の色は、画面の英文の位置で動かす')

  /* **一覧を、2か所に書き写していない** */
  const txt = code('src/lib/speakText.js')
  ok(!/'kilometers'|'Mister'|'twenty-five'/.test(txt),
    '読み方を `speakText.js` に書き写していない(名簿は `speakDict.js` 1か所)')
  ok(LOCALES.length >= 2 && DOMAINS.length >= 10 && CLASSES.length >= 40,
    `locale ${LOCALES.length} / domain ${DOMAINS.length} / クラス ${CLASSES.length}`)
  ok(Object.keys(UNITS).length >= 40 && WORD_ACRONYMS.size >= 20,
    `単位 ${Object.keys(UNITS).length} / 語として読む頭字語 ${WORD_ACRONYMS.size}`)
}

/* ══════════════════════════════════════════════════════════════════
   **読み方の指定**(第5.266節・2026-09-26 利用者の指定)

     > UMITO のような会社の名前をしてして記事やダイアローグを作ろうとすると、
     > 英語の読みが「ゆーえむあいてぃーおー」と言われてしまいます。
     > これを何とかできませんか?
     > 他のケースでもうまく対応できるよう汎用性のある解決策を考えてください。
     > 例えば「細かい指定」内に読み方も含めればOKなど、、、
   ══════════════════════════════════════════════════════════════════ */
{
  console.log('\n▶ 読み方の指定(第5.266節)')
  const noC6 = (t) => t.replace(/\/\*[\s\S]*?\*\/|\{\/\*[\s\S]*?\*\/\}/g, '')
  const read6 = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')

  /* ── ① かな → 英語風のつづり ────────────────────────── */
  ok(spellKana('ウミト') === 'Oo-mee-toh',
    'かな → つづり … ウミト は Oo-mee-toh', String(spellKana('ウミト')))
  /* **ひらがなでも同じ。** 書き方の違いで読めなくなるのは、こちらの都合 */
  ok(spellKana('うみと') === spellKana('ウミト'),
    'かな → つづり … ひらがなでも同じ結果になる')
  /* **促音は、次の子音を重ねる**(いちばん危ない形を置く) */
  ok(spellKana('サッポロ') === 'Sap-poh-roh',
    'かな → つづり … 小さい「ッ」は、次の子音を重ねる', String(spellKana('サッポロ')))
  /* **拗音を割らない**(`キャ` を `キ` + `ャ` にしない) */
  ok(spellKana('キャノン') === 'Kya-noh-n',
    'かな → つづり … 拗音(キャ)を2文字に割らない', String(spellKana('キャノン')))
  /* **読めない字が混ざったら、黙る**(当てずっぽうで音を作らない)。
     **いちばん危ないのは「半分だけ読める」形**である ——
     `ウミ人` を `Oo-mee` にしてしまうと、**直したつもりで別の音**になる。
     読めない字がぜんぶの形(`UMITO` / `海人`)だけを見ていると、
     **読み飛ばす作りに壊しても緑のまま**になる(赤チェックで実測) */
  ok(spellKana('ウミ人') === null,
    'かな → つづり … 半分だけ読める形も `null`(半分だけ直さない)',
    String(spellKana('ウミ人')))
  ok(spellKana('UMITO') === null && spellKana('海人') === null && spellKana('') === null,
    'かな → つづり … 読めない字が混ざったら `null`(黙る)')
  /* **空白を作らない。** 語の数が変わると、語ごとの色がずれる */
  ok(!/\s/.test(String(spellKana('トヨタジドウシャ'))),
    'かな → つづり … 空白を入れない(語の数を変えない)')

  /* ── ② 「細かい指定」からの拾い方 ──────────────────── */
  const 表 = parseSayAs('唐揚げ工場の話。UMITO=ウミト、KDDI＝ケーディーディーアイ / Sakura=さくら')
  ok(表.UMITO === 'Oo-mee-toh' && 表.KDDI && 表.Sakura,
    `読み方 … 句点のあと・全角の＝・スラッシュ区切りでも拾う(${Object.keys(表).join(' / ')})`)
  /* **書いていないものは拾わない**(ふつうの指定を読み方にしない) */
  ok(Object.keys(parseSayAs('生成AIのルール作り。賛成と反対の両方を出す')).length === 0,
    '読み方 … `=` が無ければ、1つも拾わない')
  /* **1文字の名前は拾わない。** 本文の `a` が総取り替えになると
     取り返しがつかない(いちばん危ない形) */
  ok(!('a' in parseSayAs('a=あ')) && !('3' in parseSayAs('3=three')),
    '読み方 … 1文字の名前も、数字で始まる名前も拾わない')
  /* **読めない読みは、その1件だけ捨てる**(半分だけ直さない) */
  ok(Object.keys(parseSayAs('UMITO=海人')).length === 0,
    '読み方 … 読めない読みは、その1件を捨てる')

  /* ── ③ 英文への当て方 ──────────────────────────── */
  ok(applySayAs('We visited UMITO today.', 表) === 'We visited Oo-mee-toh today.',
    '読み方 … 英文の中の名前を置き換える')
  /* **語の切れ目でだけ当てる**(`UMITOS` の中に当たらない) */
  ok(applySayAs('UMITOS is different.', 表) === 'UMITOS is different.',
    '読み方 … 語の途中には当てない')
  /* **表が空なら、1文字も変えない**(指紋が変わらない = 0円) */
  ok(applySayAs('Nothing changes here.', {}) === 'Nothing changes here.'
    && sayAsText('Nothing changes here.', 表) === '',
  '読み方 … 変えるものが無ければ、1文字も変えない(0円)')

  /* ══════════════════════════════════════════════════════════════
     **読み名簿 —— 1文字ずつに開いていたのは、こちらのコードだった**
     (第5.269節・2026-09-26 実機・利用者の指摘)

       > UMITOの読み方が全く直っていません。
       > 細かい指定で読み方を指定するべきなのですか?

     `speakText()` が `We visited UMITO.` を
     `We visited U M I T O.` に**書き換えていた。**
     細かい指定に書いても、根っこはそのままだった。
     ══════════════════════════════════════════════════════════════ */
  {
    const 名 = Object.keys(SAY_AS_BOOK)[0] ?? ''
    ok(!!名 && SAY_AS_BOOK[名] && !/\s/.test(SAY_AS_BOOK[名]),
      `読み名簿 … 名前が登録してあり、読みに空白が無い(${名} = ${SAY_AS_BOOK[名]})`)
    /* **名簿の値を書き写さない。** 名簿から引いて突き合わせる ——
       書き写すと、読みを直した日に期待値も一緒に動く(CLAUDE.md) */
    const 言う = (t) => speakText(t).text
    ok(言う(`We visited ${名} today.`) === `We visited ${SAY_AS_BOOK[名]} today.`,
      '読み名簿 … 文の途中の名前を、文字ずつに開かない',
      言う(`We visited ${名} today.`))
    /* **文の終わりでも効く。** 点まで名前として拾うと、名簿に当たらず
       素通りする —— いちばん見落としやすい形 */
    ok(言う(`I work at ${名}.`).includes(SAY_AS_BOOK[名]),
      '読み名簿 … 文の終わり(ピリオドの直前)でも効く', 言う(`I work at ${名}.`))
    /* **語の途中には当てない**(`UMITOS` の頭に当たらない) */
    ok(!言う(`${名}S is different.`).includes(SAY_AS_BOOK[名]),
      '読み名簿 … 語の途中には当てない', 言う(`${名}S is different.`))
    /* **名簿に無いものは、これまでどおり。** ここが緩むと
       `IBM` まで語として読まれる(**迷ったら文字ずつ**・CLAUDE.md) */
    ok(言う('IBM and USA are fine.') === 'I B M and U S A are fine.',
      '読み名簿 … 名簿に無い大文字の並びは、これまでどおり文字ずつ',
      言う('IBM and USA are fine.'))
    ok(言う('NASA is fine.') === 'NASA is fine.',
      '読み名簿 … 語として読む頭字語(NASA)も、これまでどおり')
    /* **意味のクラスも持つ**(検証がここを数える) */
    ok(speakText(`${名} is here.`).parts.some((p2) => p2.klass === 'NAME'),
      '読み名簿 … 名前として数えている(`NAME`)')
  }

  /* ── ④ 画面と保存の側が、本当にそれを通しているか ────────── */
  const play6 = noC6(read6('src/lib/audioPlaylist.js'))
  /* **読み上げにする欄は `audioTextOf()` 1か所** */
  ok(/const said = String\(it\?\.audio_text \?\? ''\)\.trim\(\)/.test(play6)
    && /if \(said && from !== 'audio_text'\) return said/.test(play6),
  '読み方 … 読み上げにする英文は `audioTextOf()` 1か所が決める')
  /* **リスニングでは二重にしない**(あちらは `audio_text` が画面にも出る) */
  ok(/from !== 'audio_text'/.test(play6),
    '読み方 … リスニングでは二重にしない(その文字は画面にも出る)')
  /* **画面が書き写していないか。** 書き写すと、そこだけ素通りする */
  for (const f of [
    'src/components/LessonView.jsx',
    'src/components/MaterialBody.jsx',
    'src/components/LearnerHomework.jsx',
  ]) {
    const src6 = noC6(read6(f))
    ok(!/it\[(secType|type)\.audioFrom\]/.test(src6),
      `読み方 … ${f.split('/').pop()} が読む欄を書き写していない`)
  }
  /* **保存の側**。`topic`(細かい指定)から表を作って、設問に焼き込む */
  const mat6 = noC6(read6('src/lib/materials.js'))
  ok(/const say = parseSayAs\(topic\)/.test(mat6)
    && /cleanItems\(sec\.items, sec\.exercise_type, say\)/.test(mat6),
  '読み方 … 「細かい指定」から表を作って、設問に渡している')
  /* **リスニングには焼き込まない・上書きしない・空なら欄を作らない** */
  ok(/from !== 'audio_text' && !row\.audio_text/.test(mat6) && /if \(said\) row\.audio_text = said/.test(mat6),
    '読み方 … リスニングには焼き込まず、もう在る欄も上書きしない')
  /* **支度は、読み方を直したあとの英文で作る**(第5.269節)。
     画面が持っている元の `sections` を渡すと、支度で作った音と
     あとで探す場所の指紋が食い違い、**同じ文に二度課金される** */
  ok(/return ok\(\{ id: material\.id, sections: cleanSections \}\)/.test(mat6),
    '読み方 … 組み直したあとの演習を返している(支度が同じ英文で作れる)')
  const form6 = noC6(read6('src/components/MaterialForm.jsx'))
  ok(/sections: data\.sections \?\? sections/.test(form6),
    '読み方 … 発行の直後の支度は、保存された側の演習で作る(二度課金しない)')

  /* **書き方の案内は1か所**(6つの種類に書き写さない) */
  const kinds6 = noC6(read6('src/data/materialKinds.js'))
  ok((kinds6.match(/UMITO=ウミト/g) ?? []).length === 1
    && /export const SAY_AS_HINT/.test(kinds6),
  '読み方 … 書き方の案内は `SAY_AS_HINT` 1か所')
}

/* ────────────────────────────────────────────────────────────
   おしまい
   ──────────────────────────────────────────────────────────── */
console.log(`\n突き合わせ ${TABLE.length} 本`)
if (ng > 0) {
  console.log(`\n❌ ${ng} 件、意図どおりではありません`)
  process.exit(1)
}
console.log('\n✅ 読み上げ用の英文への書き換えは、すべて意図どおりです')
