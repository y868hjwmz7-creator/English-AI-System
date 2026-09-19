/**
 * ============================================================================
 * **数を、言葉にする**(第5.205節・2026-09 利用者の指定)
 *
 * > 画面表示用の英語(Written Form)と、TTS に渡す自然な読み上げ用英語
 * > (Spoken Form)が異なる表記を正しく変換する。
 * > 単純な文字置換ではなく、文脈を判定してから適切な spoken form へ変換する。
 *
 * ここは**文脈を見ない層**である。「25 を cardinal として読むと
 * twenty-five」「1908 を year として読むと nineteen oh eight」のように、
 * **クラスが決まったあとの言い方**だけを受け持つ。
 * **どのクラスか**を決めるのは `speakText.js` の仕事である。
 *
 * ── なぜ分けるか ────────────────────────────────────────
 *
 *   同じ `2026` が、cardinal なら two thousand twenty-six、
 *   year なら twenty twenty-six である。**判断と言い方を混ぜると、
 *   どちらを直しているのか分からなくなる**(CLAUDE.md「判断は1か所に持つ」)。
 *
 * ── 何にも依存しない ───────────────────────────────────
 *
 *   `import` は0個。**素の node でそのまま走る**ので、
 *   `npm run test:speak` が数字を全部突き合わせられる
 *   (**描けないものは測れない**・CLAUDE.md)。
 * ============================================================================
 */

/** 0〜19。**並べ替えない** */
const ONES = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
  'seventeen', 'eighteen', 'nineteen',
]

/** 20・30…90(添字が十の位) */
const TENS = [
  '', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety',
]

/** 1,000 ごとの位。**大きいほうから使う** */
const SCALES = [
  [1000000000000000, 'quadrillion'],
  [1000000000000, 'trillion'],
  [1000000000, 'billion'],
  [1000000, 'million'],
  [1000, 'thousand'],
]

/** 序数にするときだけ形が変わる語 */
const ORDINAL_ONES = [
  'zeroth', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh',
  'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth', 'thirteenth', 'fourteenth',
  'fifteenth', 'sixteenth', 'seventeenth', 'eighteenth', 'nineteenth',
]
const ORDINAL_TENS = [
  '', '', 'twentieth', 'thirtieth', 'fortieth', 'fiftieth', 'sixtieth',
  'seventieth', 'eightieth', 'ninetieth',
]

/** イギリス英語だけが挟む `and`。**アメリカ英語は挟まない** */
const andFor = (locale) => (String(locale ?? '').startsWith('en-GB') ? 'and ' : '')

/** 0〜99 */
function under100(n) {
  if (n < 20) return ONES[n]
  const t = Math.floor(n / 10)
  const o = n % 10
  return o ? `${TENS[t]}-${ONES[o]}` : TENS[t]
}

/** 0〜999。`and` はイギリス英語のときだけ */
function under1000(n, locale) {
  if (n < 100) return under100(n)
  const h = Math.floor(n / 100)
  const rest = n % 100
  if (!rest) return `${ONES[h]} hundred`
  return `${ONES[h]} hundred ${andFor(locale)}${under100(rest)}`
}

/**
 * **整数を言葉にする**(CARDINAL)。
 *
 *   25        → twenty-five
 *   100       → one hundred
 *   1250      → one thousand two hundred fifty(en-US)
 *             → one thousand two hundred and fifty(en-GB)
 *   1000000   → one million
 *
 * @param {number|string} value  整数(負・小数は呼ぶ側で分ける)
 * @param {object} [o]
 * @param {string} [o.locale='en-US']
 * @returns {string|null} 言葉。**整数でなければ `null`**(当てずっぽうで返さない)
 */
export function cardinal(value, { locale = 'en-US' } = {}) {
  const n = typeof value === 'string' ? Number(value.replace(/[, ]/g, '')) : Number(value)
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null
  if (n < 0) return `minus ${cardinal(-n, { locale })}`
  if (n < 1000) return under1000(n, locale)
  /* **安全に言えるのは、桁が数えきれるうちだけ。**
     これを超えたら `null` を返して、**呼ぶ側が1桁ずつ読む側へ落とす** */
  if (n >= 1e18) return null

  const parts = []
  let rest = n
  for (const [unit, name] of SCALES) {
    if (rest < unit) continue
    const many = Math.floor(rest / unit)
    rest %= unit
    parts.push(`${cardinal(many, { locale })} ${name}`)
  }
  if (rest) {
    /* **イギリス英語は、最後の 100 未満の前に `and` を挟む**
       (one thousand two hundred **and** fifty) */
    parts.push(rest < 100 ? `${andFor(locale)}${under100(rest)}` : under1000(rest, locale))
  }
  return parts.join(' ')
}

/**
 * **序数**(ORDINAL)。`1st → first` / `21st → twenty-first` /
 * `102nd → one hundred second`。
 */
export function ordinal(value, { locale = 'en-US' } = {}) {
  const n = typeof value === 'string' ? Number(value.replace(/[, ]/g, '')) : Number(value)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) return null
  if (n < 20) return ORDINAL_ONES[n]
  if (n < 100) {
    const t = Math.floor(n / 10)
    const o = n % 10
    return o ? `${TENS[t]}-${ORDINAL_ONES[o]}` : ORDINAL_TENS[t]
  }
  /* **最後のかたまりだけを序数にする。** 前は cardinal のまま
     (one hundred **second** / twenty-one thousand **first**) */
  const head = cardinal(n, { locale })
  if (!head) return null
  const at = head.lastIndexOf(' ')
  const last = at < 0 ? head : head.slice(at + 1)
  const rest = at < 0 ? '' : head.slice(0, at + 1)
  /* `twenty-five` のようにつないだ形は、**うしろだけ**序数にする */
  const dash = last.lastIndexOf('-')
  if (dash >= 0) {
    const tail = ordinalOfWord(last.slice(dash + 1))
    return tail ? `${rest}${last.slice(0, dash)}-${tail}` : null
  }
  const tail = ordinalOfWord(last)
  return tail ? `${rest}${tail}` : null
}

/** 1語を序数にする(`five → fifth` / `hundred → hundredth`) */
function ordinalOfWord(word) {
  const i = ONES.indexOf(word)
  if (i >= 0) return ORDINAL_ONES[i]
  const t = TENS.indexOf(word)
  if (t >= 0) return ORDINAL_TENS[t]
  if (word === 'hundred') return 'hundredth'
  if (word === 'thousand') return 'thousandth'
  if (['million', 'billion', 'trillion', 'quadrillion'].includes(word)) return `${word}th`
  return null
}

/**
 * **1桁ずつ読む**(識別番号・電話・暗証番号)。
 *
 *   007 → zero zero seven(`zero: 'oh'` なら oh oh seven)
 *
 * **通常の整数にしない。** `007` を `seven` と読むと別のものになる。
 *
 * @param {string} digitsText 数字の並び(数字以外は落とす)
 * @param {object} [o]
 * @param {'zero'|'oh'} [o.zero='zero'] 0 の読み方
 * @param {boolean} [o.pairs=false] `55 → double five` を使うか(主にイギリス英語)
 */
export function digitsWords(digitsText, { zero = 'zero', pairs = false } = {}) {
  const src = String(digitsText ?? '').replace(/\D/g, '')
  if (!src) return null
  const say = (c) => (c === '0' ? zero : ONES[Number(c)])
  if (!pairs) return [...src].map(say).join(' ')
  /* **同じ数字が続いたら double / triple**(イギリス英語の電話番号) */
  const out = []
  let i = 0
  while (i < src.length) {
    let n = 1
    while (i + n < src.length && src[i + n] === src[i]) n += 1
    if (n >= 3) { out.push(`triple ${say(src[i])}`); i += 3; continue }
    if (n === 2) { out.push(`double ${say(src[i])}`); i += 2; continue }
    out.push(say(src[i])); i += 1
  }
  return out.join(' ')
}

/**
 * **小数**(DECIMAL)。**小数点以下は1桁ずつ**である。
 *
 *   3.14 → three point one four
 *   0.05 → zero point zero five
 *   .5   → zero point five
 */
export function decimalWords(text, { locale = 'en-US', zero = 'zero' } = {}) {
  const m = /^(-|−|\+)?(\d[\d,]*)?\.(\d+)$/.exec(String(text ?? '').trim())
  if (!m) return null
  const sign = m[1] ? (m[1] === '+' ? 'plus ' : 'minus ') : ''
  const head = m[2] ? cardinal(m[2].replace(/,/g, ''), { locale }) : zero
  if (head === null) return null
  const tail = digitsWords(m[3], { zero })
  if (!tail) return null
  return `${sign}${head} point ${tail}`
}

/** 分母の言い方。2 と 4 だけ、別の名前を持つ */
function denomWord(den, many, { locale = 'en-US' } = {}) {
  if (den === 2) return many ? 'halves' : 'half'
  if (den === 4) return many ? 'quarters' : 'quarter'
  const w = ordinal(den, { locale })
  if (!w) return null
  return many ? `${w}s` : w
}

/**
 * **分数**(FRACTION)。
 *
 *   1/2 → one half      2/3 → two thirds
 *   1/3 → one third     3/8 → three eighths
 */
export function fractionWords(num, den, { locale = 'en-US' } = {}) {
  const a = Number(num)
  const b = Number(den)
  if (!Number.isInteger(a) || !Number.isInteger(b) || b <= 0 || a < 0) return null
  const top = cardinal(a, { locale })
  const bottom = denomWord(b, a !== 1, { locale })
  if (!top || !bottom) return null
  return `${top} ${bottom}`
}

/**
 * **帯分数**(MIXED FRACTION)。`2½ → two and a half` /
 * `5 3/4 → five and three quarters`。
 *
 * **1 のときだけ `a half` と言う**(`one half` ではない)。
 */
export function mixedFractionWords(whole, num, den, { locale = 'en-US' } = {}) {
  const w = cardinal(whole, { locale })
  const f = fractionWords(num, den, { locale })
  if (!w || !f) return null
  return `${w} and ${Number(num) === 1 ? f.replace(/^one /, 'a ') : f}`
}

/**
 * **年**(YEAR)。**ふつうの整数とは別のクラスである。**
 *
 *   1492 → fourteen ninety-two
 *   1908 → nineteen oh eight
 *   1900 → nineteen hundred
 *   2000 → two thousand
 *   2003 → two thousand three
 *   2012 → twenty twelve
 *   2026 → twenty twenty-six
 *   1066 → ten sixty-six
 */
export function yearWords(value, { locale = 'en-US' } = {}) {
  const n = typeof value === 'string' ? Number(value) : Number(value)
  if (!Number.isInteger(n) || n < 0) return null
  /* **1000 より小さい年は、ふつうの整数で読む**(300 BC → three hundred) */
  if (n < 1000) return cardinal(n, { locale })
  if (n > 9999) return cardinal(n, { locale })
  const hi = Math.floor(n / 100)
  const lo = n % 100
  /* **2000 年代のはじめ 10 年は two thousand ◯**
     (twenty oh three とも言うが、こちらが広い) */
  if (hi === 20 && lo < 10) return lo ? `two thousand ${ONES[lo]}` : 'two thousand'
  if (!lo) return `${under100(hi)} hundred`
  if (lo < 10) return `${under100(hi)} oh ${ONES[lo]}`
  return `${under100(hi)} ${under100(lo)}`
}

/**
 * **年代**(DECADE)。`1980s → the nineteen eighties` / `2000s → the two thousands`。
 */
export function decadeWords(value, { locale = 'en-US' } = {}) {
  const n = Number(value)
  if (!Number.isInteger(n) || n < 0) return null
  if (n % 10 !== 0) return null
  const tens = n % 100
  if (n >= 2000 && tens === 0) return `the ${cardinal(n, { locale })}s`
  const head = yearWords(n, { locale })
  if (!head) return null
  /* `nineteen eighty` → `nineteen eighties`(`y` を `ies` に) */
  return `the ${head.replace(/y$/, 'ies').replace(/([^s])$/, '$1s')}`
}

/** 100 未満の言い方。**外からも使う**(時刻・番地) */
export const under100Words = under100

/** 1語の序数化。**外からも使う**(単位のついた序数) */
export const ordinalWordOf = ordinalOfWord
