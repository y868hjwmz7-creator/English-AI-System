/**
 * ============================================================================
 * **読み方の名簿**(第5.205節・2026-09 利用者の指定)
 *
 * 記号・略語・単位・通貨を**どう声にするか**だけを持つ。
 * **どれに当てはまるかを決める算段は、ここに書かない**(`speakText.js`)。
 *
 * ── 決まり ──────────────────────────────────────────────
 *
 *   ・**一覧を勝手に減らさない。並べ替えも減らすに当たる**(CLAUDE.md)
 *   ・**単数と複数を、両方持つ。** `1 kg` は kilogram、`2 kg` は kilograms。
 *     `foot → feet` のように `s` を足すだけでない語があるので、
 *     **規則で作らずに、書いておく**
 *   ・**同じものを2か所に書かない。** ここに在るものを
 *     `speakText.js` 側で書き直さない
 *   ・`wordTiming.js` の `ABBREVIATIONS` とは**役目が違う。**
 *     あちらは「その `.` は文の終わりか」を見分けるための一覧で、
 *     **読み方を持っていない**(だから `etc.` `no.` をわざと外してある)。
 *     こちらは読み方の名簿である。**混ぜない**
 * ============================================================================
 */

/* ══════════════════════════════════════════════════════════════════
 * 単位(SI・非SI)。`one` / `many` の2つを持つ
 * ══════════════════════════════════════════════════════════════════ */

/** @type {Record<string, {one: string, many: string}>} */
export const UNITS = {
  // ── 長さ
  m: { one: 'meter', many: 'meters' },
  mm: { one: 'millimeter', many: 'millimeters' },
  cm: { one: 'centimeter', many: 'centimeters' },
  km: { one: 'kilometer', many: 'kilometers' },
  'μm': { one: 'micrometer', many: 'micrometers' },
  um: { one: 'micrometer', many: 'micrometers' },
  nm: { one: 'nanometer', many: 'nanometers' },
  // ── 重さ
  g: { one: 'gram', many: 'grams' },
  mg: { one: 'milligram', many: 'milligrams' },
  kg: { one: 'kilogram', many: 'kilograms' },
  t: { one: 'ton', many: 'tons' },
  // ── 時間
  s: { one: 'second', many: 'seconds' },
  ms: { one: 'millisecond', many: 'milliseconds' },
  min: { one: 'minute', many: 'minutes' },
  h: { one: 'hour', many: 'hours' },
  hr: { one: 'hour', many: 'hours' },
  // ── 電気・力・エネルギー
  A: { one: 'ampere', many: 'amperes' },
  mA: { one: 'milliampere', many: 'milliamperes' },
  V: { one: 'volt', many: 'volts' },
  kV: { one: 'kilovolt', many: 'kilovolts' },
  W: { one: 'watt', many: 'watts' },
  kW: { one: 'kilowatt', many: 'kilowatts' },
  MW: { one: 'megawatt', many: 'megawatts' },
  GW: { one: 'gigawatt', many: 'gigawatts' },
  Wh: { one: 'watt-hour', many: 'watt-hours' },
  kWh: { one: 'kilowatt-hour', many: 'kilowatt-hours' },
  J: { one: 'joule', many: 'joules' },
  kJ: { one: 'kilojoule', many: 'kilojoules' },
  N: { one: 'newton', many: 'newtons' },
  Pa: { one: 'pascal', many: 'pascals' },
  kPa: { one: 'kilopascal', many: 'kilopascals' },
  hPa: { one: 'hectopascal', many: 'hectopascals' },
  // ── 周波数
  Hz: { one: 'hertz', many: 'hertz' },
  kHz: { one: 'kilohertz', many: 'kilohertz' },
  MHz: { one: 'megahertz', many: 'megahertz' },
  GHz: { one: 'gigahertz', many: 'gigahertz' },
  // ── 量
  L: { one: 'liter', many: 'liters' },
  l: { one: 'liter', many: 'liters' },
  mL: { one: 'milliliter', many: 'milliliters' },
  ml: { one: 'milliliter', many: 'milliliters' },
  // ── 情報
  B: { one: 'byte', many: 'bytes' },
  KB: { one: 'kilobyte', many: 'kilobytes' },
  MB: { one: 'megabyte', many: 'megabytes' },
  GB: { one: 'gigabyte', many: 'gigabytes' },
  TB: { one: 'terabyte', many: 'terabytes' },
  // ── 温度(記号は `°C` 側で受ける)
  K: { one: 'kelvin', many: 'kelvins' },
  // ── 非SI(ヤード・ポンド法)
  ft: { one: 'foot', many: 'feet' },
  in: { one: 'inch', many: 'inches' },
  yd: { one: 'yard', many: 'yards' },
  mi: { one: 'mile', many: 'miles' },
  lb: { one: 'pound', many: 'pounds' },
  lbs: { one: 'pound', many: 'pounds' },
  oz: { one: 'ounce', many: 'ounces' },
  gal: { one: 'gallon', many: 'gallons' },
  pt: { one: 'pint', many: 'pints' },
  mph: { one: 'mile per hour', many: 'miles per hour' },
  kt: { one: 'knot', many: 'knots' },
  // ── 角度・ページなど、単位のように付くもの
  px: { one: 'pixel', many: 'pixels' },
}

/**
 * **`/` でつなぐ単位**(COMPOUND UNITS)。`km/h → kilometers per hour`。
 * 組み立ては `speakText.js` がする。ここは**分母の言い方**だけ。
 */
export const PER_UNITS = {
  h: 'hour', hr: 'hour', s: 'second', min: 'minute', d: 'day', day: 'day',
  m: 'meter', km: 'kilometer', kg: 'kilogram', g: 'gram', L: 'liter', l: 'liter',
  'm²': 'square meter', 'm³': 'cubic meter', 'cm³': 'cubic centimeter',
  week: 'week', month: 'month', year: 'year', capita: 'capita', person: 'person',
}

/** **SI の接頭辞そのもの**(`mm → millimeter` の説明に使う) */
export const SI_PREFIXES = {
  n: 'nano', 'μ': 'micro', u: 'micro', m: 'milli', c: 'centi', d: 'deci',
  da: 'deca', h: 'hecto', k: 'kilo', M: 'mega', G: 'giga', T: 'tera', P: 'peta',
}

/* ══════════════════════════════════════════════════════════════════
 * 通貨
 * ══════════════════════════════════════════════════════════════════ */

/**
 * 記号 → 読み方。`sub` は小数点以下の単位(セント・ペンス)。
 * **`sub` が無い通貨は、小数を「point 〜」と読む**(円・ウォン)。
 */
export const CURRENCY_SYMBOLS = {
  $: { one: 'dollar', many: 'dollars', sub: { one: 'cent', many: 'cents' } },
  '£': { one: 'pound', many: 'pounds', sub: { one: 'penny', many: 'pence' } },
  '€': { one: 'euro', many: 'euros', sub: { one: 'cent', many: 'cents' } },
  '¥': { one: 'yen', many: 'yen', sub: null },
  '₩': { one: 'won', many: 'won', sub: null },
  '₹': { one: 'rupee', many: 'rupees', sub: { one: 'paisa', many: 'paise' } },
  '₽': { one: 'ruble', many: 'rubles', sub: { one: 'kopek', many: 'kopeks' } },
  '₺': { one: 'lira', many: 'lira', sub: null },
  '₫': { one: 'dong', many: 'dong', sub: null },
  '฿': { one: 'baht', many: 'baht', sub: null },
}

/** 3文字コード → 読み方(`USD 25 → twenty-five U.S. dollars`) */
export const CURRENCY_CODES = {
  USD: { one: 'U.S. dollar', many: 'U.S. dollars' },
  EUR: { one: 'euro', many: 'euros' },
  GBP: { one: 'pound', many: 'pounds' },
  JPY: { one: 'Japanese yen', many: 'Japanese yen' },
  CNY: { one: 'Chinese yuan', many: 'Chinese yuan' },
  KRW: { one: 'Korean won', many: 'Korean won' },
  AUD: { one: 'Australian dollar', many: 'Australian dollars' },
  CAD: { one: 'Canadian dollar', many: 'Canadian dollars' },
  CHF: { one: 'Swiss franc', many: 'Swiss francs' },
  HKD: { one: 'Hong Kong dollar', many: 'Hong Kong dollars' },
  SGD: { one: 'Singapore dollar', many: 'Singapore dollars' },
  INR: { one: 'Indian rupee', many: 'Indian rupees' },
}

/** `$5K` `$2M` `$1.5B`。**文脈を確かめてから使う** */
export const MONEY_SCALE = { K: 'thousand', M: 'million', B: 'billion', T: 'trillion' }

/* ══════════════════════════════════════════════════════════════════
 * 敬称・肩書き・会社
 * ══════════════════════════════════════════════════════════════════ */

/** **人に付く敬称**(うしろに大文字で始まる名前が来る) */
export const PERSON_TITLES = {
  mr: 'Mister', mrs: 'Missus', ms: 'Miz', mx: 'Mix', dr: 'Doctor',
  prof: 'Professor', rev: 'Reverend', hon: 'Honorable', fr: 'Father',
  gov: 'Governor', sen: 'Senator', rep: 'Representative', amb: 'Ambassador',
  pres: 'President', gen: 'General', col: 'Colonel', maj: 'Major',
  capt: 'Captain', lt: 'Lieutenant', sgt: 'Sergeant', cpl: 'Corporal',
  adm: 'Admiral', messrs: 'Messieurs', mme: 'Madame', mlle: 'Mademoiselle',
  st: 'Saint',
}

/** 名前のうしろに付くもの */
export const NAME_SUFFIXES = { jr: 'Junior', sr: 'Senior' }

/** 会社・組織 */
export const COMPANY_ABBR = {
  ltd: 'Limited', inc: 'Incorporated', corp: 'Corporation', co: 'Company',
  llc: 'L L C', plc: 'P L C', bros: 'Brothers', univ: 'University',
  dept: 'Department', assn: 'Association', intl: 'International',
}

/** 住所。**`Dr.` と `St.` は、人の敬称と同じ字である**(文脈で決める) */
export const ADDRESS_ABBR = {
  st: 'Street', ave: 'Avenue', rd: 'Road', blvd: 'Boulevard', dr: 'Drive',
  ln: 'Lane', hwy: 'Highway', ct: 'Court', pl: 'Place', sq: 'Square',
  pkwy: 'Parkway', ter: 'Terrace', apt: 'apartment', ste: 'suite',
  fl: 'floor', rm: 'room', bldg: 'building', mt: 'Mount', ft: 'Fort',
}

/* ══════════════════════════════════════════════════════════════════
 * ふつうの略語・ラテン語
 * ══════════════════════════════════════════════════════════════════ */

export const GENERAL_ABBR = {
  no: 'number', nos: 'numbers', approx: 'approximately', est: 'estimated',
  vol: 'volume', vols: 'volumes', fig: 'figure', figs: 'figures',
  ch: 'chapter', chap: 'chapter', ed: 'edition', eds: 'editors',
  p: 'page', pp: 'pages', para: 'paragraph', sec: 'section',
  min: 'minimum', max: 'maximum', avg: 'average', qty: 'quantity',
  ext: 'extension', incl: 'including', excl: 'excluding',
  attn: 'attention', ref: 'reference', misc: 'miscellaneous',
  temp: 'temperature', tel: 'telephone', asap: 'as soon as possible',
}

export const LATIN_ABBR = {
  'e.g.': 'for example', 'i.e.': 'that is', etc: 'et cetera', vs: 'versus',
  cf: 'compare', 'et al.': 'and others', 'n.b.': 'note well',
  'a.m.': 'A M', 'p.m.': 'P M',
}

/** 学位。**文字ずつ読む** */
export const DEGREE_ABBR = {
  'ph.d.': 'P H D', 'm.a.': 'M A', 'b.a.': 'B A', 'm.s.': 'M S',
  'b.s.': 'B S', 'm.d.': 'M D', 'j.d.': 'J D', 'b.sc.': 'B S C',
  'm.sc.': 'M S C', mba: 'M B A', msc: 'M S C', bsc: 'B S C',
}

/* ══════════════════════════════════════════════════════════════════
 * 月・曜日
 * ══════════════════════════════════════════════════════════════════ */

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/** 略記 → 何月目(1 から)。**`May` は略さないので入れない** */
export const MONTH_ABBR = {
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7,
  aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
}

export const WEEKDAYS = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
]

export const WEEKDAY_ABBR = {
  sun: 'Sunday', mon: 'Monday', tue: 'Tuesday', tues: 'Tuesday',
  wed: 'Wednesday', thu: 'Thursday', thur: 'Thursday', thurs: 'Thursday',
  fri: 'Friday', sat: 'Saturday',
}

/* ══════════════════════════════════════════════════════════════════
 * 記号
 * ══════════════════════════════════════════════════════════════════ */

/** 1文字で、そのまま言葉になる記号 */
export const SYMBOL_WORDS = {
  '©': 'copyright', '®': 'registered trademark', '™': 'trademark',
  '°': 'degrees', '±': 'plus or minus', '∞': 'infinity',
  '§': 'section', '¶': 'paragraph', '†': 'dagger', '‡': 'double dagger',
  '•': 'bullet', '≈': 'approximately', '≠': 'is not equal to',
  '≤': 'is less than or equal to', '≥': 'is greater than or equal to',
  '×': 'times', '÷': 'divided by', '√': 'the square root of',
  '∛': 'the cube root of', '∑': 'sigma', '∏': 'pi', '∆': 'delta',
  '→': 'arrow', '←': 'left arrow', '↔': 'double arrow',
  '½': 'one half', '⅓': 'one third', '⅔': 'two thirds',
  '¼': 'one quarter', '¾': 'three quarters', '⅕': 'one fifth',
  '⅖': 'two fifths', '⅗': 'three fifths', '⅘': 'four fifths',
  '⅙': 'one sixth', '⅚': 'five sixths', '⅛': 'one eighth',
  '⅜': 'three eighths', '⅝': 'five eighths', '⅞': 'seven eighths',
}

/** Unicode の分数 → `[分子, 分母]`。**帯分数のときに数として要る** */
export const UNICODE_FRACTIONS = {
  '½': [1, 2], '⅓': [1, 3], '⅔': [2, 3], '¼': [1, 4], '¾': [3, 4],
  '⅕': [1, 5], '⅖': [2, 5], '⅗': [3, 5], '⅘': [4, 5],
  '⅙': [1, 6], '⅚': [5, 6], '⅛': [1, 8], '⅜': [3, 8], '⅝': [5, 8], '⅞': [7, 8],
}

/** 上付き文字 → ふつうの文字(`10⁶` `m²`) */
export const SUPERSCRIPTS = {
  '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4',
  '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
  '⁻': '-', '⁺': '+',
}

/** ギリシャ文字 */
export const GREEK_LETTERS = {
  'α': 'alpha', 'β': 'beta', 'γ': 'gamma', 'δ': 'delta', 'ε': 'epsilon',
  'ζ': 'zeta', 'η': 'eta', 'θ': 'theta', 'ι': 'iota', 'κ': 'kappa',
  'λ': 'lambda', 'μ': 'mu', 'ν': 'nu', 'ξ': 'xi', 'ο': 'omicron',
  'π': 'pi', 'ρ': 'rho', 'σ': 'sigma', 'τ': 'tau', 'υ': 'upsilon',
  'φ': 'phi', 'χ': 'chi', 'ψ': 'psi', 'ω': 'omega',
  'Α': 'Alpha', 'Β': 'Beta', 'Γ': 'Gamma', 'Δ': 'Delta', 'Θ': 'Theta',
  'Λ': 'Lambda', 'Ξ': 'Xi', 'Π': 'Pi', 'Σ': 'Sigma', 'Φ': 'Phi',
  'Ψ': 'Psi', 'Ω': 'Omega',
}

/* ══════════════════════════════════════════════════════════════════
 * 略語の読み方(文字ずつ / 語として)
 * ══════════════════════════════════════════════════════════════════ */

/**
 * **語として読む頭字語**(ACRONYMS)。ここに無い大文字の並びは
 * **文字ずつ**読む(INITIALISM)。
 *
 * **迷ったら文字ずつ**である —— 知らない語を無理に語として読ませると、
 * 聞いたことのない音になる。
 */
export const WORD_ACRONYMS = new Set([
  'NASA', 'NATO', 'UNESCO', 'UNICEF', 'RADAR', 'LASER', 'SCUBA', 'AIDS',
  'OPEC', 'ASEAN', 'FIFA', 'UEFA', 'IKEA', 'SIM', 'PIN', 'RAM', 'ROM',
  'JPEG', 'GIF', 'WIFI', 'ZIP', 'SWIFT', 'NIMBY', 'TOEIC', 'TOEFL',
  /* **`OK` を `O K` と読ませない**(2026-09・実際にここで転んだ) */
  'OK', 'OKAY', 'PIN', 'FAQ', 'ASAP', 'DIY', 'VIP',
])

/** **決め打ちで読む、混ざった形**(MIXED ABBREVIATIONS) */
export const MIXED_ABBR = {
  JPEG: 'J peg', 'CD-ROM': 'C D ROM', 'COVID-19': 'COVID nineteen',
  MP3: 'M P three', MP4: 'M P four', 'Wi-Fi': 'Wi Fi', IPv4: 'I P version four',
  IPv6: 'I P version six', 'K-pop': 'K pop', 'T-shirt': 'T shirt',
  'X-ray': 'X ray', 'e-mail': 'email', '3D': 'three D', '4K': 'four K',
}

/** 時間帯。**略称のまま文字ずつ読む**(完全形は domain で選ぶ) */
export const TIMEZONES = {
  EST: 'Eastern Standard Time', EDT: 'Eastern Daylight Time',
  CST: 'Central Standard Time', CDT: 'Central Daylight Time',
  MST: 'Mountain Standard Time', MDT: 'Mountain Daylight Time',
  PST: 'Pacific Standard Time', PDT: 'Pacific Daylight Time',
  JST: 'Japan Standard Time', GMT: 'G M T', UTC: 'U T C', BST: 'British Summer Time',
}

/* ══════════════════════════════════════════════════════════════════
 * 数式・プログラム
 * ══════════════════════════════════════════════════════════════════ */

/** ふつうの文章にも出る算術の記号 */
export const MATH_OPERATORS = {
  '+': 'plus', '=': 'equals', '>': 'is greater than', '<': 'is less than',
}

/** **コードのときだけ**読む記号(`domain: 'PROGRAMMING'`) */
export const CODE_OPERATORS = {
  '===': 'triple equals', '!==': 'bang equals equals', '==': 'double equals',
  '!=': 'not equal', '&&': 'and and', '||': 'or or', '++': 'plus plus',
  '--': 'minus minus', '=>': 'fat arrow', '->': 'arrow', '::': 'double colon',
  '?.': 'optional chaining', '|': 'pipe', '\\': 'backslash', '^': 'caret',
  '_': 'underscore', '~': 'tilde', '*': 'asterisk',
}

/** キーボードの合わせ押し */
export const KEY_NAMES = {
  ctrl: 'Control', cmd: 'Command', alt: 'Alt', opt: 'Option',
  shift: 'Shift', tab: 'Tab', esc: 'Escape', win: 'Windows',
}

/** ファイルの種類。**`.pdf` は文字ずつ、`.wav` は語として** */
export const FILE_EXTENSIONS = {
  pdf: 'P D F', jpg: 'J P G', jpeg: 'J peg', png: 'P N G', gif: 'GIF',
  mp3: 'M P three', mp4: 'M P four', wav: 'wav', csv: 'C S V',
  txt: 'text', doc: 'doc', docx: 'doc X', xls: 'X L S', xlsx: 'X L S X',
  ppt: 'P P T', pptx: 'P P T X', zip: 'zip', html: 'H T M L', htm: 'H T M',
  js: 'J S', json: 'jason', css: 'C S S', svg: 'S V G', webp: 'web P',
}

/** 化学。**教材では記号読みを既定にする**(意味読みは domain で選ぶ) */
export const CHEMICAL_NAMES = {
  H2O: 'water', CO2: 'carbon dioxide', O2: 'oxygen', N2: 'nitrogen',
  NaCl: 'sodium chloride', CH4: 'methane', NH3: 'ammonia', SO2: 'sulfur dioxide',
}

/** 四半期・半期。**business のときだけ意味に開く** */
export const QUARTERS = { Q1: 'first quarter', Q2: 'second quarter', Q3: 'third quarter', Q4: 'fourth quarter' }
export const HALVES = { H1: 'first half', H2: 'second half' }

/**
 * **番号が付く「入れもの」**。うしろの数字を**1桁ずつ / 2桁ずつ**読む
 * (`Room 205 → room two oh five`)。
 * **ふつうの整数として読まない**(`two hundred five` にしない)。
 */
export const NUMBERED_PLACES = new Set([
  'room', 'flight', 'gate', 'suite', 'apartment', 'apt', 'ste', 'unit',
  'extension', 'ext', 'box', 'pin', 'otp', 'member', 'booking', 'order',
  'ticket', 'seat', 'platform', 'track', 'channel', 'port',
])

/** **ふつうの整数で読む「番号」**(`Bus 24 → bus twenty-four`) */
export const COUNTED_PLACES = new Set([
  'bus', 'train', 'route', 'line', 'chapter', 'section', 'page', 'pages',
  'figure', 'table', 'number', 'no', 'volume', 'part', 'step', 'level',
  'grade', 'floor', 'question', 'unit',
])
