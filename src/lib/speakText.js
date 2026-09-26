/**
 * ============================================================================
 * **画面の英文 → 読み上げ用の英文**(第5.205節・2026-09 利用者の指定)
 *
 * > 画面表示用の英語(Written Form)と、TTS に渡す自然な読み上げ用英語
 * > (Spoken Form)が異なる表記を正しく変換する。**単純な文字置換ではなく、
 * > 文脈を判定してから**適切な spoken form へ変換する Text Normalization。
 *
 *     DISPLAY TEXT  →  speakText()  →  SPOKEN TEXT  →  TTS  →  AUDIO
 *
 * **画面に出る文字列は、1文字も変えない。**ここが返すのは別の文字列である。
 *
 * ── **一括置換をしない**(利用者の指定)────────────────────────
 *
 *   同じ字でも、まわりによって読みが変わる。
 *
 *     `Dr.`  … Doctor(うしろが人の名前)/ Drive(前が通りの名前)
 *     `St.`  … Street / Saint
 *     `1.5`  … one point five / version one point five
 *     `3/4`  … three quarters / March fourth
 *     `-`    … minus / to / 区切り
 *     `.`    … point / dot / 略語の点 / 文の終わり
 *
 *   だから**順に見ていって、その場で当てはまるものを1つ選ぶ。**
 *   長くて特殊なものから先に見る(下の `MATCHERS`)——
 *   **小数や整数を先に処理すると、URL も版番号も IP アドレスも壊れる。**
 *
 *     192.168.1.1 を one hundred ninety-two point … と読んではいけない
 *     v2.4.1      を小数として扱ってはいけない
 *     03/04/2026  を分数として扱ってはいけない
 *     $25.50      をただの小数として扱ってはいけない
 *
 * ── **分からないものは、変えない** ──────────────────────────
 *
 *   確かめられないときは**元の文字のまま TTS へ渡す。**
 *   当てずっぽうで意味を変えると、**取り返しがつかない**
 *   (CLAUDE.md「分かっていないことを、分かったように書かない」)。
 *
 * ── **何にも依存しない** ──────────────────────────────────
 *
 *   読むのは `speakNum.js` と `src/data/speakDict.js` だけ。
 *   Supabase も `import.meta.env` も引き連れていないので、
 *   **素の node でそのまま走る**(`npm run test:speak`)。
 * ============================================================================
 */
import {
  cardinal, decimalWords, decadeWords, digitsWords, fractionWords,
  mixedFractionWords, ordinal, under100Words, yearWords,
} from './speakNum.js'
import {
  ADDRESS_ABBR, CHEMICAL_NAMES, CODE_OPERATORS, COMPANY_ABBR, COUNTED_PLACES,
  CURRENCY_CODES, CURRENCY_SYMBOLS, DEGREE_ABBR, FILE_EXTENSIONS, GENERAL_ABBR,
  GREEK_LETTERS, HALVES, KEY_NAMES, LATIN_ABBR, MATH_OPERATORS, MIXED_ABBR, MONEY_SCALE,
  MONTHS, MONTH_ABBR, NAME_SUFFIXES, NUMBERED_PLACES, PERSON_TITLES, PER_UNITS,
  SAY_AS_BOOK,
  QUARTERS, SUPERSCRIPTS, SYMBOL_WORDS, TIMEZONES, UNICODE_FRACTIONS, UNITS,
  WEEKDAY_ABBR, WORD_ACRONYMS,
} from '../data/speakDict.js'
import { splitSentences } from './sentenceSplit.js'

/** 使える locale。**減らさない** */
export const LOCALES = ['en-US', 'en-GB', 'en-AU', 'en-CA', 'en-NZ', 'en-IE']

/** 使える domain。**減らさない** */
export const DOMAINS = [
  'GENERAL_ENGLISH', 'BUSINESS', 'ACADEMIC', 'SCIENCE', 'MEDICAL',
  'IT', 'PROGRAMMING', 'FINANCE', 'TRAVEL', 'ADDRESS', 'TELEPHONE',
]

/** 意味のクラス。**判定の結果を名前で持つ**(検証がここを数える) */
export const CLASSES = [
  'CARDINAL', 'ORDINAL', 'DECIMAL', 'FRACTION', 'MIXED_FRACTION', 'DATE',
  'DATE_RANGE', 'YEAR', 'DECADE', 'CENTURY', 'TIME', 'TIME_RANGE', 'DURATION',
  'MONEY', 'PERCENT', 'RATIO', 'SCORE', 'MEASURE', 'TEMPERATURE', 'DIMENSION',
  'SCIENTIFIC_NUMBER', 'MATH', 'ADDRESS', 'TELEPHONE', 'IDENTIFIER',
  'SERIAL_NUMBER', 'ROOM_NUMBER', 'FLIGHT_NUMBER', 'POSTAL_CODE', 'EMAIL',
  'URL', 'DOMAIN', 'FILE', 'VERSION', 'ABBREVIATION', 'INITIALISM', 'ACRONYM',
  /* 読み名簿にある名前(第5.269節)。**文字ずつに開かない** */
  'NAME',
  'TITLE', 'ROMAN_NUMERAL', 'CHEMISTRY', 'STATISTICS', 'PROGRAMMING',
  'PUNCTUATION', 'SOCIAL_MEDIA', 'EMOJI', 'RANGE', 'AGE', 'OTHER',
]

const WORD_CH = /[A-Za-z0-9]/
const isWordCh = (c) => !!c && WORD_CH.test(c)

/** 頭に付けて使う、その場所だけを見る正規表現 */
const at = (re, src, i) => {
  const r = new RegExp(re.source, `${re.flags.replace(/[gy]/g, '')}y`)
  r.lastIndex = i
  return r.exec(src)
}

/**
 * ── **URL かどうかの見分け**(2026-09・実際にここで転んだ)────────
 *
 *   はじめは「点でつながっていて、知っている TLD で終われば URL」に
 *   していた。ところが**国の TLD は、ふつうの英単語と同じ字**である。
 *
 *       inanimate.it       … `it`(イタリア)
 *       the meeting.In …   … `in`(インド)——**空白を打ち忘れた文**
 *
 *   どちらも「ドメイン」と読まれてしまう。**ふつうの文を壊すほうが、
 *   URL を読み落とすより悪い**(CLAUDE.md「分からないものは変えない」)。
 *
 *   ・`https://` / `www.` / `/道` が**付いていれば**、国の TLD も URL
 *   ・付いていなければ、**よく見るほうの TLD だけ**(`com` `org` …)
 *   ・国の TLD は、**その前がよく見る TLD のときだけ**(`example.co.jp`)
 */
const GENERIC_TLD = /^(com|org|net|edu|gov|mil|int|io|co|ai|app|dev|me|tv|info|biz)$/i
const COUNTRY_TLD = /^(jp|uk|us|de|fr|cn|kr|au|ca|nz|ie|in|it|es|nl|ru|br)$/i

/* ══════════════════════════════════════════════════════════════════
 * 言い方をつくる小さな道具
 * ══════════════════════════════════════════════════════════════════ */

/** 文字ずつ読む(`URL → U R L`)。**大文字のまま**で返す */
const letters = (s) => [...String(s)].filter((c) => /[A-Za-z0-9]/.test(c))
  .map((c) => c.toUpperCase()).join(' ')

/** `1,250` のようなカンマを落として数にする */
const num = (s) => Number(String(s).replace(/,/g, ''))

/** その数を、小数なら小数として・整数なら整数として読む */
function sayNumber(text, locale) {
  const s = String(text).replace(/,/g, '')
  if (s.includes('.')) return decimalWords(s, { locale })
  return cardinal(s, { locale })
}

/** 単位の単数・複数。**1 のときだけ単数**(0.5 も複数) */
const unitWord = (u, n) => (Number(n) === 1 ? u.one : u.many)

/**
 * **英語の語と同じ字の単位。** 証拠がなければ単位として読まない。
 * `in`(インチ / 前置詞)がいちばん危ない。
 */
const RISKY_UNITS = new Set(['in', 'l', 'a', 'h', 't'])

/**
 * **大文字1文字の単位**(A=アンペア・V=ボルト…)。
 *
 * ふつうの英語では、数のうしろの大文字1文字は**席や部屋の記号**である
 * (`seats 12 A, B, and C`)。**`twelve amperes` と読んでしまった**
 * (2026-09 実機)。だから `domain` が理科・医療・IT のときだけ単位にする。
 */
const CAP_UNITS = new Set(['A', 'B', 'K', 'T', 'N', 'J', 'W', 'V', 'L', 'C', 'F', 'G', 'M'])
const SCIENCE_DOMAINS = new Set(['SCIENCE', 'MEDICAL', 'IT', 'ACADEMIC'])

/** `m²` `cm³` を言葉にする */
function unitOf(sym, n) {
  const sq = /^(.+)²$/.exec(sym)
  const cu = /^(.+)³$/.exec(sym)
  if (sq && UNITS[sq[1]]) {
    return Number(n) === 1 ? `square ${UNITS[sq[1]].one}` : `square ${UNITS[sq[1]].many}`
  }
  if (cu && UNITS[cu[1]]) {
    return Number(n) === 1 ? `cubic ${UNITS[cu[1]].one}` : `cubic ${UNITS[cu[1]].many}`
  }
  return UNITS[sym] ? unitWord(UNITS[sym], n) : null
}

/** 上付き文字を、ふつうの文字に開く(`10⁶` → `10^6`) */
const plainSup = (s) => [...String(s)].map((c) => SUPERSCRIPTS[c] ?? c).join('')

/* ══════════════════════════════════════════════════════════════════
 * 当てはめる人たち。**上から順に試し、最初に当たったものを採る**
 *
 * それぞれ `(c) => ({len, say, klass}) | null` である。
 * `c` は `{src, i, locale, domain, dict, before, after}`。
 * ══════════════════════════════════════════════════════════════════ */

/** ① メールアドレス */
function mEmail(c) {
  const m = at(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+/, c.src, c.i)
  if (!m) return null
  const [local, host] = m[0].split('@')
  const say = `${spellPath(local)} at ${spellHost(host)}`
  return { len: m[0].length, say, klass: 'EMAIL' }
}

/**
 * **ドメインの読み方。** `example.com → example dot com` /
 * `example.co.jp → example dot co dot J P`。
 *
 * **いちばん後ろが2文字の国コードのときだけ、文字ずつ読む。**
 * `co` `com` `net` はそのまま語として読む —— **どれも耳になじんでいる。**
 */
function spellHost(host) {
  const bits = String(host).split('.')
  return bits.map((b, i) => {
    const last = i === bits.length - 1
    if (last && b.length === 2) return letters(b)
    return spellPath(b)
  }).join(' dot ')
}

/** `a.b_c` を「a dot b underscore c」に開く(メール・URL・ファイル名) */
function spellPath(s) {
  return String(s).split(/([._\-/@])/).map((p) => {
    if (p === '.') return 'dot'
    if (p === '_') return 'underscore'
    if (p === '-') return 'dash'
    if (p === '/') return 'slash'
    if (p === '@') return 'at'
    if (!p) return ''
    /* 2文字までの短い塊・数字だけの塊は**文字ずつ**(`co` `jp` `3`) */
    if (/^\d+$/.test(p)) return digitsWords(p) ?? p
    if (p.length <= 3 && p === p.toUpperCase() && /[A-Z]/.test(p)) return letters(p)
    return p
  }).filter(Boolean).join(' ')
}

/** ② URL・ドメイン */
function mUrl(c) {
  const m = at(/(https?:\/\/)?(www\.)?[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+(\/[^\s，。、]*)?/, c.src, c.i)
  if (!m) return null
  const scheme = m[1] ?? ''
  const host = m[0].replace(/^https?:\/\//, '').split('/')[0]
  const tail = m[0].slice((scheme + host).length)
  const bits = host.split('.')
  const last = bits[bits.length - 1]
  const prev = bits.length >= 2 ? bits[bits.length - 2] : ''
  const strong = !!scheme || !!m[2] || !!tail          // https:// / www. / 道がある
  const okTld = GENERIC_TLD.test(last)
    || (COUNTRY_TLD.test(last) && (strong || GENERIC_TLD.test(prev)))
  /* **知っている TLD で終わっていなければ、URL とは見なさない。**
     そうしないと `e.g.` も `inanimate.it` も「ドメイン」になる */
  if (!okTld) return null
  const head = c.domain === 'PROGRAMMING' || c.domain === 'IT'
    ? (scheme ? `${letters(scheme.replace(/:\/\/$/, ''))} colon slash slash ` : '')
    : ''
  const say = `${head}${spellHost(host)}${tail ? ` ${spellPath(tail)}` : ''}`
  return { len: m[0].length, say, klass: scheme || tail ? 'URL' : 'DOMAIN' }
}

/** ③ IPv4 / MAC。**ふつうの小数として読まない** */
function mIpMac(c) {
  const ip = at(/\d{1,3}(\.\d{1,3}){3}/, c.src, c.i)
  if (ip) {
    const say = ip[0].split('.').map((p) => digitsWords(p)).join(' dot ')
    return { len: ip[0].length, say, klass: 'IDENTIFIER' }
  }
  const mac = at(/([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}/, c.src, c.i)
  if (mac) {
    const say = mac[0].split(':').map((p) => letters(p)).join(' colon ')
    return { len: mac[0].length, say, klass: 'IDENTIFIER' }
  }
  return null
}

/** ④ ファイル名・拡張子 */
function mFile(c) {
  const m = at(/([A-Za-z0-9_-]+)\.([A-Za-z0-9]{1,5})/, c.src, c.i)
  if (!m) return null
  const ext = FILE_EXTENSIONS[m[2].toLowerCase()]
  if (!ext) return null
  return { len: m[0].length, say: `${spellPath(m[1])} dot ${ext}`, klass: 'FILE' }
}

/** ⑤ 版番号。**小数にしない** */
function mVersion(c) {
  const m = at(/v(?:er(?:sion)?)?\.?\s?(\d+(?:\.\d+)+)|(\d+(?:\.\d+){2,})/i, c.src, c.i)
  if (!m) return null
  const nums = m[1] ?? m[2]
  const say = `version ${nums.split('.').map((p) => cardinal(p, { locale: c.locale })).join(' point ')}`
  return { len: m[0].length, say, klass: 'VERSION' }
}

/** ⑥ 電話番号。**ふつうの整数にしない** */
function mPhone(c) {
  /* `555-1234` / `647-555-7890` / `1-800-222-3333` / `+81 90-1234-5678` */
  let m = at(/(\+?\d{1,3}[\s-])?(\(?\d{3}\)?[\s-])?\d{3}[\s-]\d{4}\b/, c.src, c.i)
  if (!m) {
    /* **空白で組に分ける書き方**(`020 7946 0958`)は、
       **電話の話をしているときだけ**拾う ——
       そうしないと、ただ並んだ数字まで電話番号にしてしまう */
    const head = c.src.slice(Math.max(0, c.i - 40), c.i)
    if (!/(phone|number|tel|fax|call|dial|reach|mobile|cell)\b[^.?!]*$/i.test(head)) return null
    m = at(/\d{3,5}(\s\d{3,4}){2}\b/, c.src, c.i)
    if (!m) return null
  }
  const pairs = c.locale.startsWith('en-GB')
  const say = m[0].split(/[\s-]+/).filter(Boolean).map((p) => {
    if (p.startsWith('+')) return `plus ${digitsWords(p) ?? ''}`
    return digitsWords(p.replace(/[()]/g, ''), { pairs }) ?? p
  }).join(', ')
  return { len: m[0].length, say, klass: 'TELEPHONE' }
}

/** 時刻ひとつぶんの言い方 */
function clock(h, min, sec, locale) {
  const H = Number(h)
  const M = Number(min)
  if (H >= 13) {
    /* 24時間表記。`18:00 → eighteen hundred hours` */
    const head = under100Words(H)
    return M === 0 ? `${head} hundred hours` : `${head} ${under100Words(M)}`
  }
  const head = under100Words(H === 0 ? 12 : H)
  let out
  if (M === 0) out = `${head} o'clock`
  else if (M < 10) out = `${head} oh ${under100Words(M)}`
  else out = `${head} ${under100Words(M)}`
  if (sec != null && sec !== '') {
    out += ` and ${under100Words(Number(sec))} ${Number(sec) === 1 ? 'second' : 'seconds'}`
  }
  return out
}

/** `a.m.` / `p.m.` を `A M` / `P M` にする */
const meridiem = (s) => (/^a/i.test(String(s)) ? 'A M' : 'P M')

const MERI = /(a\.m\.|p\.m\.|a\.m|p\.m|am|pm)/i

/** ⑦ 競技タイム(`1:23.45`)。**時計とは別のクラス** */
function mDuration(c) {
  const m = at(/(\d{1,2}):(\d{2})\.(\d{1,3})/, c.src, c.i)
  if (!m) return null
  const say = `${cardinal(m[1], { locale: c.locale })} ${Number(m[1]) === 1 ? 'minute' : 'minutes'} `
    + `${under100Words(Number(m[2]))} point ${digitsWords(m[3])} seconds`
  return { len: m[0].length, say, klass: 'DURATION' }
}

/** ⑧ 時刻(範囲も)。`9 a.m.–5 p.m.` / `9:00–10:30` / `10 a.m.` */
function mTime(c) {
  const one = String.raw`(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?(?:\s*` + MERI.source + `)?`
  const m = at(new RegExp(`${one}\\s*[–—-]\\s*${one}`, 'i'), c.src, c.i)
  if (m && (m[2] || m[4] || m[6] || m[8])) {
    /* **`9 a.m.` に「o'clock」は付けない**(`nine A M` と言う) */
    const side = (h, min, sec, meri) => (meri
      ? `${min ? clock(h, min, sec, c.locale) : under100Words(Number(h))} ${meridiem(meri)}`
      : clock(h, min ?? 0, sec, c.locale))
    const a = side(m[1], m[2], m[3], m[4])
    const b = side(m[5], m[6], m[7], m[8])
    return { len: m[0].length, say: `${a} to ${b}`, klass: 'TIME_RANGE' }
  }
  const s = at(new RegExp(one, 'i'), c.src, c.i)
  if (!s) return null
  /* **`:` も `a.m.` も無ければ、時刻ではない**(ただの数) */
  if (!s[2] && !s[4]) return null
  if (Number(s[1]) > 24) return null
  const body = clock(s[1], s[2] ?? 0, s[3], c.locale)
  const say = s[4] ? `${s[2] ? body : under100Words(Number(s[1]))} ${meridiem(s[4])}` : body
  return { len: s[0].length, say, klass: 'TIME' }
}

/** 月の名前 → 1〜12。略記も受ける */
function monthOf(word) {
  const w = String(word).replace(/\.$/, '').toLowerCase()
  const full = MONTHS.findIndex((x) => x.toLowerCase() === w)
  if (full >= 0) return full + 1
  return MONTH_ABBR[w] ?? null
}

/** 日付の「日」を序数で言う */
const dayWord = (d, locale) => ordinal(Number(d), { locale })

/** ⑨ 日付(`March 8` / `March 8 or 9` / `March 8–10` / `March 8, 2026`) */
function mDateWord(c) {
  const m = at(/([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?/, c.src, c.i)
  if (!m) return null
  const mo = monthOf(m[1])
  if (!mo) return null
  const name = MONTHS[mo - 1]
  let len = m[0].length
  let say = `${name} ${dayWord(m[2], c.locale)}`
  if (c.locale.startsWith('en-GB')) say = `the ${dayWord(m[2], c.locale)} of ${name}`

  /* **`or` / `–` でつながる日も、序数のまま**(`March 8 or 9`) */
  const more = at(/\s*(or|and|to|through|[–—-])\s*(\d{1,2})(?:st|nd|rd|th)?/, c.src, c.i + len)
  if (more) {
    const joint = /[–—-]/.test(more[1]) ? (Number(more[2]) - Number(m[2]) > 1 ? 'through' : 'to')
      : more[1]
    say += ` ${joint} ${dayWord(more[2], c.locale)}`
    len += more[0].length
  }
  /* 年が続くなら、年として読む */
  const yr = at(/,?\s*(\d{4})\b/, c.src, c.i + len)
  if (yr) {
    say += `, ${yearWords(yr[1], { locale: c.locale })}`
    len += yr[0].length
  }
  return { len, say, klass: more ? 'DATE_RANGE' : 'DATE' }
}

/** ⑩ `8 March 2026`(日 → 月 の書き方) */
function mDateDayFirst(c) {
  const m = at(/(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\.?(?:,?\s*(\d{4}))?/, c.src, c.i)
  if (!m) return null
  const mo = monthOf(m[2])
  if (!mo) return null
  let say = `the ${dayWord(m[1], c.locale)} of ${MONTHS[mo - 1]}`
  if (m[3]) say += `, ${yearWords(m[3], { locale: c.locale })}`
  return { len: m[0].length, say, klass: 'DATE' }
}

/** ⑪ 数字だけの日付(`03/08/2026`)。**分数として読まない** */
function mDateNumeric(c) {
  const m = at(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/, c.src, c.i)
  if (!m) return null
  const gb = c.locale.startsWith('en-GB') || c.locale.startsWith('en-AU')
    || c.locale.startsWith('en-NZ') || c.locale.startsWith('en-IE')
  const mo = Number(gb ? m[2] : m[1])
  const day = Number(gb ? m[1] : m[2])
  if (mo < 1 || mo > 12 || day < 1 || day > 31) return null
  const y = m[3].length === 2 ? Number(m[3]) + 2000 : Number(m[3])
  const head = gb ? `the ${dayWord(day, c.locale)} of ${MONTHS[mo - 1]}`
    : `${MONTHS[mo - 1]} ${dayWord(day, c.locale)}`
  return { len: m[0].length, say: `${head}, ${yearWords(y, { locale: c.locale })}`, klass: 'DATE' }
}

/** ⑫ 紀元前・紀元後 */
function mEra(c) {
  const ad = at(/(AD|CE)\s+(\d{1,4})/, c.src, c.i)
  if (ad) {
    return {
      len: ad[0].length,
      say: `${letters(ad[1])} ${yearWords(ad[2], { locale: c.locale })}`,
      klass: 'YEAR',
    }
  }
  const bc = at(/(\d{1,4})\s*(BCE|BC|CE|AD)\b/, c.src, c.i)
  if (bc) {
    const y = /^(BC|BCE)$/.test(bc[2]) ? cardinal(bc[1], { locale: c.locale })
      : yearWords(bc[1], { locale: c.locale })
    return { len: bc[0].length, say: `${y} ${letters(bc[2])}`, klass: 'YEAR' }
  }
  return null
}

/** ⑬ 年代(`1980s` / `'90s` / `2000s`) */
function mDecade(c) {
  /* **`the` が画面にもう書いてあるなら、こちらで足さない**
     (`the 1980s` が `the the nineteen eighties` になる) */
  const hasThe = /\bthe\s*$/i.test(c.src.slice(Math.max(0, c.i - 8), c.i))
  const drop = (w) => (hasThe && w ? w.replace(/^the /, '') : w)
  const m = at(/(\d{4})['’]?s\b/, c.src, c.i)
  if (m) {
    const say = drop(decadeWords(Number(m[1]), { locale: c.locale }))
    return say ? { len: m[0].length, say, klass: 'DECADE' } : null
  }
  /* **`in their 20s`**(年代・年齢)。`20s` を「twenty seconds」と読まない
     (2026-09・実際にここで転んだ) */
  const two = at(/([2-9]0)s\b/, c.src, c.i)
  if (two && !isWordCh(c.src[c.i - 1])) {
    return {
      len: two[0].length,
      say: `${under100Words(Number(two[1])).replace(/y$/, 'ies')}`,
      klass: 'DECADE',
    }
  }
  const short = at(/['’](\d0)s\b/, c.src, c.i)
  if (short) {
    const tens = under100Words(Number(short[1]))
    return { len: short[0].length, say: drop(`the ${tens.replace(/y$/, 'ies')}`), klass: 'DECADE' }
  }
  return null
}

/** 年として読んでよい合図が前にあるか(`in 2026` / `since 1999`) */
const YEAR_CUE = /\b(in|since|by|from|until|till|around|about|before|after|during|of|year|born|©)$/i

/** ⑭ 年(合図があるときだけ)。**無ければ、ふつうの整数で読む** */
function mYear(c) {
  const m = at(/\d{4}\b/, c.src, c.i)
  if (!m) return null
  const n = Number(m[0])
  if (n < 1000 || n > 2999) return null
  const head = c.src.slice(Math.max(0, c.i - 24), c.i).replace(/[\s,]+$/, '')
  /* **`The 2020 Summer Olympics`**。`the` + 年 + **大文字で始まる語**は、
     まず年である(`the 2000 items` のような数え上げとは形が違う) */
  const theYear = /\bthe$/i.test(head) && n >= 1900 && n <= 2099
    && at(/\s+[A-Z]/, c.src, c.i + m[0].length)
  if (!YEAR_CUE.test(head) && !theYear) return null
  /* 年のあとに単位や `%` が続くなら、年ではない */
  if (at(/\s*(%|[A-Za-z]{1,3}\b)/, c.src, c.i + m[0].length)) {
    const w = at(/\s*([A-Za-z]{1,3})\b/, c.src, c.i + m[0].length)
    if (w && (UNITS[w[1]] || w[1] === 'BC' || w[1] === 'AD')) return null
  }
  return { len: m[0].length, say: yearWords(n, { locale: c.locale }), klass: 'YEAR' }
}

/** ⑮ お金 */
function mMoney(c) {
  const syms = Object.keys(CURRENCY_SYMBOLS).map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('')
  const m = at(new RegExp(`([${syms}])\\s?(\\d[\\d,]*)(\\.(\\d{1,2}))?(?:\\s?([KMBT])\\b)?`), c.src, c.i)
  if (m) {
    const cur = CURRENCY_SYMBOLS[m[1]]
    const whole = num(m[2])
    if (m[5] && MONEY_SCALE[m[5]]) {
      const head = m[3] ? decimalWords(`${m[2]}${m[3]}`, { locale: c.locale })
        : cardinal(whole, { locale: c.locale })
      return {
        len: m[0].length,
        say: `${head} ${MONEY_SCALE[m[5]]} ${cur.many}`,
        klass: 'MONEY',
      }
    }
    let say = `${cardinal(whole, { locale: c.locale })} ${unitWord(cur, whole)}`
    if (m[4]) {
      const cents = Number(m[4].padEnd(2, '0'))
      say += cur.sub
        ? ` and ${cardinal(cents, { locale: c.locale })} ${cents === 1 ? cur.sub.one : cur.sub.many}`
        : ` point ${digitsWords(m[4])}`
    }
    return { len: m[0].length, say, klass: 'MONEY' }
  }
  /* 3文字コード(`USD 25`) */
  const code = at(/([A-Z]{3})\s?(\d+(?:,\d{3})*)(\.\d{1,2})?\b/, c.src, c.i)
  if (code && CURRENCY_CODES[code[1]]) {
    const cur = CURRENCY_CODES[code[1]]
    const v = num(code[2])
    const head = code[3] ? decimalWords(`${code[2]}${code[3]}`, { locale: c.locale })
      : cardinal(v, { locale: c.locale })
    return { len: code[0].length, say: `${head} ${unitWord(cur, v)}`, klass: 'MONEY' }
  }
  return null
}

/** ⑯ 割合(`5%` / `20–30%` / `25 bps` / `+2 pp`) */
function mPercent(c) {
  const range = at(/(\d+(?:,\d{3})*(?:\.\d+)?)\s*[–—-]\s*(\d+(?:,\d{3})*(?:\.\d+)?)\s*%/, c.src, c.i)
  if (range) {
    return {
      len: range[0].length,
      say: `${sayNumber(range[1], c.locale)} to ${sayNumber(range[2], c.locale)} percent`,
      klass: 'PERCENT',
    }
  }
  const m = at(/([+\-−])?(\d+(?:,\d{3})*(?:\.\d+)?)\s*%/, c.src, c.i)
  if (m) {
    const sign = m[1] ? (m[1] === '+' ? 'plus ' : 'minus ') : ''
    return {
      len: m[0].length,
      say: `${sign}${sayNumber(m[2], c.locale)} percent`,
      klass: 'PERCENT',
    }
  }
  const pt = at(/([+\-−])?(\d+(?:,\d{3})*(?:\.\d+)?)\s*(pps?|bps?)\b/, c.src, c.i)
  if (pt) {
    const sign = pt[1] ? (pt[1] === '+' ? 'plus ' : 'minus ') : ''
    const what = /^p/.test(pt[3]) ? 'percentage points' : 'basis points'
    return { len: pt[0].length, say: `${sign}${sayNumber(pt[2], c.locale)} ${what}`, klass: 'PERCENT' }
  }
  return null
}

/** ⑰ 温度・角度 */
function mDegree(c) {
  const t = at(/(-|−)?(\d+(?:,\d{3})*(?:\.\d+)?)\s*°\s*([CF])\b/, c.src, c.i)
  if (t) {
    const sign = t[1] ? 'minus ' : ''
    const v = num(t[2])
    return {
      len: t[0].length,
      say: `${sign}${sayNumber(t[2], c.locale)} ${v === 1 && !t[1] ? 'degree' : 'degrees'} `
        + `${t[3] === 'C' ? 'Celsius' : 'Fahrenheit'}`,
      klass: 'TEMPERATURE',
    }
  }
  const dms = at(/(\d+)\s*°\s*(\d+)\s*[′']\s*(?:(\d+)\s*[″"])?/, c.src, c.i)
  if (dms && dms[2]) {
    let say = `${cardinal(dms[1], { locale: c.locale })} degrees `
      + `${cardinal(dms[2], { locale: c.locale })} minutes`
    if (dms[3]) say += ` ${cardinal(dms[3], { locale: c.locale })} seconds`
    return { len: dms[0].length, say, klass: 'MEASURE' }
  }
  const a = at(/(-|−)?(\d+(?:,\d{3})*(?:\.\d+)?)\s*°/, c.src, c.i)
  if (a) {
    const sign = a[1] ? 'minus ' : ''
    const v = num(a[2])
    return {
      len: a[0].length,
      say: `${sign}${sayNumber(a[2], c.locale)} ${v === 1 && !a[1] ? 'degree' : 'degrees'}`,
      klass: 'MEASURE',
    }
  }
  return null
}

/** ⑱ 指数(`1.2 × 10⁶`)・べき */
function mScientific(c) {
  const m = at(/(\d+(?:\.\d+)?)\s*[×x]\s*10\s*([⁻-]?[\d⁰¹²³⁴⁵⁶⁷⁸⁹]+)/, c.src, c.i)
  if (!m) return null
  const ex = plainSup(m[2])
  const neg = ex.startsWith('-')
  const p = ordinal(Math.abs(Number(ex)), { locale: c.locale })
  if (!p) return null
  return {
    len: m[0].length,
    say: `${sayNumber(m[1], c.locale)} times ten to the ${neg ? 'minus ' : ''}${p}`,
    klass: 'SCIENTIFIC_NUMBER',
  }
}

/** ⑲ 大きさ(`5 × 10 cm` / `1920 × 1080`)。**`×` を times ではなく by と読む** */
function mDimension(c) {
  const m = at(/(\d+(?:,\d{3})*(?:\.\d+)?)\s*[×x]\s*(\d+(?:,\d{3})*(?:\.\d+)?)(?:\s*([A-Za-z]+[²³]?))?/, c.src, c.i)
  if (!m) return null
  const u = m[3] ? unitOf(m[3], num(m[2])) : null
  /* **知らない語が続いていても、大きさとしては読める。**
     そこだけ画面の文字のまま残す(当てはめごと捨てない) */
  const len = m[3] && !u ? m[0].length - m[3].length : m[0].length
  const say = `${sayNumber(m[1], c.locale)} by ${sayNumber(m[2], c.locale)}${u ? ` ${u}` : ''}`
  return { len, say, klass: 'DIMENSION' }
}

/** ⑳ 単位つきの数(`5 km` / `60 km/h` / `5 m²`)。**単数・複数をそろえる** */
function mMeasure(c) {
  const m = at(/(-|−)?(\d+(?:,\d{3})*(?:\.\d+)?)\s?([A-Za-zμ°Ω]+[²³]?)(\/([A-Za-zμ]+[²³]?))?/, c.src, c.i)
  if (!m) return null
  const v = num(m[2])
  const head = unitOf(m[3], v)
  if (!head) return null
  /* ── **英語の語と同じ字の単位は、証拠が要る**(2026-09・実際に転んだ)──
   *
   *   `Dial 911 in case of emergency.` が
   *   **`nine hundred eleven inches case`** になっていた。
   *   `in`(インチ)は、英語でいちばん多い前置詞と同じ字である。
   *
   *   だから `in` は、**うしろが句読点か、長さを言う語のときだけ**
   *   単位として読む(`6 in.` / `6 in tall`)。
   *   **迷ったら単位にしない**(CLAUDE.md「既定は『できない』側」)。 */
  /* **大文字1文字は、理科の話のときだけ単位**(`seats 12 A` は席の記号) */
  if (CAP_UNITS.has(m[3]) && !SCIENCE_DOMAINS.has(c.domain)) return null
  if (RISKY_UNITS.has(m[3])) {
    const after = c.src.slice(c.i + m[0].length)
    if (!/^\s*$|^\s*[.,;:)!?]|^\s+(tall|long|wide|deep|thick|high|away|each|apart)\b/.test(after)) {
      return null
    }
  }
  /* **`per` の相手も知っていなければ、単位として読まない** */
  let tail = ''
  if (m[5]) {
    const per = PER_UNITS[m[5]] ?? (UNITS[m[5]] ? UNITS[m[5]].one : null)
    if (!per) return null
    tail = ` per ${per}`
  }
  const sign = m[1] ? 'minus ' : ''
  return {
    len: m[0].length,
    say: `${sign}${sayNumber(m[2], c.locale)} ${head}${tail}`,
    klass: 'MEASURE',
  }
}

/** ㉑ 帯分数・分数・Unicode の分数 */
function mFraction(c) {
  const mixed = at(/(\d+)\s+(\d+)\/(\d+)\b/, c.src, c.i)
  if (mixed) {
    const say = mixedFractionWords(mixed[1], mixed[2], mixed[3], { locale: c.locale })
    if (say) return { len: mixed[0].length, say, klass: 'MIXED_FRACTION' }
  }
  const uniMixed = at(new RegExp(`(\\d+)\\s?([${Object.keys(UNICODE_FRACTIONS).join('')}])`), c.src, c.i)
  if (uniMixed) {
    const [a, b] = UNICODE_FRACTIONS[uniMixed[2]]
    const say = mixedFractionWords(uniMixed[1], a, b, { locale: c.locale })
    if (say) return { len: uniMixed[0].length, say, klass: 'MIXED_FRACTION' }
  }
  const uni = at(new RegExp(`[${Object.keys(UNICODE_FRACTIONS).join('')}]`), c.src, c.i)
  if (uni) {
    const [a, b] = UNICODE_FRACTIONS[uni[0]]
    const say = fractionWords(a, b, { locale: c.locale })
    if (say) return { len: uni[0].length, say, klass: 'FRACTION' }
  }
  const m = at(/(\d{1,3})\/(\d{1,3})\b/, c.src, c.i)
  if (m) {
    const say = fractionWords(m[1], m[2], { locale: c.locale })
    if (say) return { len: m[0].length, say, klass: 'FRACTION' }
  }
  return null
}

/** ㉒ 序数(`1st` / `21st century`) */
function mOrdinal(c) {
  const m = at(/(\d+(?:,\d{3})*)(st|nd|rd|th)\b/, c.src, c.i)
  if (!m) return null
  const say = ordinal(num(m[1]), { locale: c.locale })
  if (!say) return null
  return { len: m[0].length, say, klass: 'ORDINAL' }
}

/** ㉓ 比・得点・範囲(`3:1` / `3–2` / `5–10`) */
function mRatioRange(c) {
  const r = at(/(\d+(?:,\d{3})*)\s*:\s*(\d+(?:,\d{3})*)\b/, c.src, c.i)
  if (r) {
    return {
      len: r[0].length,
      say: `${cardinal(num(r[1]), { locale: c.locale })} to ${cardinal(num(r[2]), { locale: c.locale })}`,
      klass: 'RATIO',
    }
  }
  const m = at(/(\d+(?:,\d{3})*(?:\.\d+)?)\s*[–—]\s*(\d+(?:,\d{3})*(?:\.\d+)?)/, c.src, c.i)
    ?? at(/(\d+(?:,\d{3})*(?:\.\d+)?)\s*-\s*(\d+(?:,\d{3})*(?:\.\d+)?)(?![\d-])/, c.src, c.i)
  if (!m) return null
  /* うしろに単位が続くなら、単位もいっしょに読む(`5–10 kg`) */
  const u = at(/\s?([A-Za-zμ°]+[²³]?)\b/, c.src, c.i + m[0].length)
  const word = u ? unitOf(u[1], num(m[2])) : null
  const say = `${sayNumber(m[1], c.locale)} to ${sayNumber(m[2], c.locale)}${word ? ` ${word}` : ''}`
  return { len: m[0].length + (word ? u[0].length : 0), say, klass: 'RANGE' }
}

/** ㉔ 年齢(`5-year-old`) */
function mAge(c) {
  const m = at(/(\d+)-(year|month|week|day)-old\b/, c.src, c.i)
  if (!m) return null
  return {
    len: m[0].length,
    say: `${cardinal(m[1], { locale: c.locale })}-${m[2]}-old`,
    klass: 'AGE',
  }
}

/** ㉕ 「入れもの + 番号」(`Room 205` / `Flight 507` / `Bus 24` / `No. 1`) */
function mNumbered(c) {
  const m = at(/([A-Za-z]+)\.?\s?#?\s?(\d+(?:,\d{3})*)([A-Z])?\b/, c.src, c.i)
  if (!m) return null
  const w = m[1].toLowerCase()
  /* **番号のうしろの1文字は、そのまま読む**(`4B → four B`・第153節) */
  const tailLetter = m[3] ? ` ${m[3]}` : ''
  if (NUMBERED_PLACES.has(w)) {
    /* **ふつうの整数にしない**(`205` を two hundred five と読まない)。
       ・まん中が 0 … `205 → two oh five` / `101 → one oh one`
       ・00 で終わる … `200 → two hundred`(そう読むほうが自然)
       ・そのほか   … **1桁ずつ**(`245 → two four five`) */
    const d = m[2].replace(/,/g, '')
    let say
    if (d.length <= 2 && d[0] !== '0') {
      /* **2桁までは、ふつうに数える**(`gate 23 → gate twenty-three`)。
         1桁ずつ読むと、かえって聞き取りにくい */
      say = cardinal(Number(d), { locale: c.locale })
    } else if (d.length === 3 && d[1] === '0' && d[2] !== '0') {
      say = `${cardinal(d[0], { locale: c.locale })} oh ${cardinal(d[2], { locale: c.locale })}`
    } else if (/00$/.test(d)) {
      say = cardinal(Number(d), { locale: c.locale })
    } else {
      say = digitsWords(d)
    }
    const head = GENERAL_ABBR[w] ?? ADDRESS_ABBR[w] ?? m[1]
    return { len: m[0].length, say: `${head} ${say}${tailLetter}`, klass: 'ROOM_NUMBER' }
  }
  if (COUNTED_PLACES.has(w)) {
    /* **書いてあるとおりの大文字・小文字を残す**(`Route 66`) */
    const head = GENERAL_ABBR[w] ?? m[1]
    /* **うしろが範囲なら、範囲として読む**(`Pages 10-15 → pages ten to fifteen`)。
       ここで止めると、`-` が画面の文字のまま残る */
    const to = at(/\s*[–—-]\s*(\d+(?:,\d{3})*)\b/, c.src, c.i + m[0].length)
    if (to) {
      return {
        len: m[0].length + to[0].length,
        say: `${head} ${cardinal(num(m[2]), { locale: c.locale })} to `
          + `${cardinal(num(to[1]), { locale: c.locale })}`,
        klass: 'RANGE',
      }
    }
    return {
      len: m[0].length,
      say: `${head} ${cardinal(num(m[2]), { locale: c.locale })}`,
      klass: 'IDENTIFIER',
    }
  }
  return null
}

/** ㉖ `#5` → number five / `#English` → hashtag English / `@john` → at John */
function mSocial(c) {
  const h = at(/#(\d+(?:,\d{3})*)\b/, c.src, c.i)
  if (h) {
    return { len: h[0].length, say: `number ${cardinal(num(h[1]), { locale: c.locale })}`, klass: 'IDENTIFIER' }
  }
  const tag = at(/#([A-Za-z][A-Za-z0-9_]*)/, c.src, c.i)
  if (tag) return { len: tag[0].length, say: `hashtag ${spellPath(tag[1])}`, klass: 'SOCIAL_MEDIA' }
  const who = at(/@([A-Za-z][A-Za-z0-9_.]*)/, c.src, c.i)
  if (who) return { len: who[0].length, say: `at ${spellPath(who[1])}`, klass: 'SOCIAL_MEDIA' }
  return null
}

/** ㉗ 四半期・半期・会計年度 */
function mBusiness(c) {
  const fy = at(/FY\s?(\d{2,4})\b/, c.src, c.i)
  if (fy) {
    const y = fy[1].length === 2 ? 2000 + Number(fy[1]) : Number(fy[1])
    return { len: fy[0].length, say: `fiscal year ${yearWords(y, { locale: c.locale })}`, klass: 'YEAR' }
  }
  const q = at(/\b(Q[1-4])\b/, c.src, c.i)
  if (q) {
    const say = c.domain === 'BUSINESS' || c.domain === 'FINANCE'
      ? QUARTERS[q[1]] : `Q ${q[1][1]}`
    return { len: q[0].length, say, klass: 'IDENTIFIER' }
  }
  const h = at(/\b(H[12])\b/, c.src, c.i)
  if (h && (c.domain === 'BUSINESS' || c.domain === 'FINANCE')) {
    return { len: h[0].length, say: HALVES[h[1]], klass: 'IDENTIFIER' }
  }
  return null
}

/** ㉘ 符号つきの数(`-5` / `+5`)。**範囲の `-` と取り違えない** */
function mSigned(c) {
  const m = at(/([+\-−])(\d+(?:,\d{3})*(?:\.\d+)?)\b/, c.src, c.i)
  if (!m) return null
  /* 前が数字や語なら、符号ではない(範囲・つなぎ) */
  if (isWordCh(c.src[c.i - 1])) return null
  const sign = m[1] === '+' ? 'plus' : 'minus'
  return { len: m[0].length, say: `${sign} ${sayNumber(m[2], c.locale)}`, klass: 'CARDINAL' }
}

/** ㉘の裏 **頭に点の付く小数**(`.5` / `.05`)。**1桁ずつの識別番号にしない** */
function mLeadingDot(c) {
  if (c.src[c.i] !== '.') return null
  if (isWordCh(c.src[c.i - 1])) return null      // `3.14` は下の小数が受ける
  const m = at(/\.(\d+)\b/, c.src, c.i)
  if (!m) return null
  const say = decimalWords(m[0], { locale: c.locale })
  return say ? { len: m[0].length, say, klass: 'DECIMAL' } : null
}

/** ㉙ 小数・整数(いちばん最後) */
function mPlainNumber(c) {
  const m = at(/\d+(?:,\d{3})*(\.\d+)?/, c.src, c.i)
  if (!m) return null
  /* **先頭の 0 は、1桁ずつ**(`007` / `05`)。ふつうの整数にしない */
  if (/^0\d/.test(m[0])) {
    return { len: m[0].length, say: digitsWords(m[0]) ?? m[0], klass: 'IDENTIFIER' }
  }
  const say = sayNumber(m[0], c.locale)
  if (!say) return null
  return { len: m[0].length, say, klass: m[1] ? 'DECIMAL' : 'CARDINAL' }
}

/* ── ここから、字のほう ────────────────────────────────── */

const ROMAN = /^(M{0,3})(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/

/** **ローマ数字の形をしているが、英語の語であるもの。** 数として読まない */
const ROMAN_WORDS = new Set(['MIX', 'MID', 'DIM', 'LID', 'DID', 'CIVIL', 'MILL', 'ILL', 'ID', 'DC', 'CD', 'MC', 'LCD', 'DVD', 'IV'])

/** ローマ数字 → 数。読めなければ `null` */
function romanValue(s) {
  if (!s || !ROMAN.test(s)) return null
  const v = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 }
  let out = 0
  for (let i = 0; i < s.length; i += 1) {
    const a = v[s[i]]
    const b = v[s[i + 1]]
    out += b && b > a ? -a : a
  }
  return out || null
}

/**
 * ㉙の裏 **化学式**(`H2O` `CO2`)。
 *
 * **既定は記号読み**(`H two O`)である —— 英語の教材で出てくるのは
 * たいてい字のほうで、いきなり `water` と読むと画面と合わない。
 * `domain` が SCIENCE / MEDICAL のときだけ、意味で読む。
 */
function mChemical(c) {
  const m = at(/[A-Z][A-Za-z]{0,2}\d[A-Za-z\d]*/, c.src, c.i)
  if (!m) return null
  if (isWordCh(c.src[c.i - 1])) return null
  const semantic = c.domain === 'SCIENCE' || c.domain === 'MEDICAL'
  if (semantic && CHEMICAL_NAMES[m[0]]) {
    return { len: m[0].length, say: CHEMICAL_NAMES[m[0]], klass: 'CHEMISTRY' }
  }
  if (!CHEMICAL_NAMES[m[0]]) return null
  /* 記号読み …… `H2O → H two O` */
  const say = [...m[0]].map((ch) => (/\d/.test(ch)
    ? cardinal(Number(ch), { locale: c.locale }) : ch.toUpperCase())).join(' ')
  return { len: m[0].length, say, klass: 'CHEMISTRY' }
}

/** ㉚ 人名 + ローマ数字(`Henry VIII → Henry the Eighth`) */
function mRoman(c) {
  const m = at(/[IVXLCDM]{2,}\b/, c.src, c.i)
  if (!m) return null
  /* **1文字のローマ数字は、読まない**(2026-09・実際にここで転んだ)。
     `I` は英語でいちばん多い語である ——
     `Because I'm hungry.` が `Because the First'm hungry.` になっていた。
     `Henry VIII` `Elizabeth II` のように**2文字以上**のときだけ数として読む */
  if (ROMAN_WORDS.has(m[0])) return null
  const n = romanValue(m[0])
  if (!n) return null
  /* **前が大文字で始まる名前のときだけ**、序数にする。
     そうでなければ `I` や `MIX` をローマ数字と読んでしまう */
  const head = c.src.slice(Math.max(0, c.i - 40), c.i)
  if (!/[A-Z][a-z]+\s+$/.test(head)) return null
  const say = ordinal(n, { locale: c.locale })
  return say ? { len: m[0].length, say: `the ${say[0].toUpperCase()}${say.slice(1)}`, klass: 'ROMAN_NUMERAL' } : null
}

/** ㉛ 決め打ちの混ざった形(`MP3` `COVID-19` `CD-ROM`) */
function mMixedAbbr(c) {
  for (const [k, v] of Object.entries(MIXED_ABBR)) {
    const m = at(new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), c.src, c.i)
    if (m && !isWordCh(c.src[c.i + m[0].length])) return { len: m[0].length, say: v, klass: 'ABBREVIATION' }
  }
  return null
}

/** ㉜ 学位・ラテン語(`Ph.D.` `e.g.`) */
function mDotted(c) {
  const m = at(/([A-Za-z]\.){1,4}[A-Za-z]?\.?/, c.src, c.i)
  if (!m) return null
  const key = m[0].toLowerCase()
  const hit = DEGREE_ABBR[key] ?? LATIN_ABBR[key]
  if (hit) return { len: m[0].length, say: hit, klass: 'ABBREVIATION' }
  /* 知らない「点でつないだ形」は**文字ずつ**(`U.S.` → U S) */
  if (/^([A-Za-z]\.){2,}$/.test(m[0])) {
    return { len: m[0].length, say: letters(m[0]), klass: 'INITIALISM' }
  }
  return null
}

/** ㉝ 点で終わる略語。**`Dr.` と `St.` は文脈で決める** */
function mAbbrev(c) {
  const m = at(/([A-Za-z]{1,8})\./, c.src, c.i)
  if (!m) return null
  const w = m[1].toLowerCase()
  const after = c.src.slice(c.i + m[0].length, c.i + m[0].length + 30)
  const beforeWord = /([A-Za-z]+)[\s,]*$/.exec(c.src.slice(0, c.i))
  /* **うしろが大文字で始まる語 = 人の名前**(`Dr. Smith` / `St. Paul`) */
  const namey = /^\s+[A-Z][a-z]/.test(after)
  /* ── **前が大文字で始まる語 = 通りの名前**(`Maple Dr.` / `King St.`)──
   *
   *   ただし**文のいちばん最初の語は数えない。** 英語の文は必ず
   *   大文字で始まるので、`The Dr. was late.` の `The` まで
   *   「通りの名前」になってしまう(2026-09・実際にここで転んだ)。 */
  const headText = c.src.slice(0, c.i)
  const sentenceHead = !!beforeWord
    && /(^|[.!?]["'’”)\]]?)\s*$/.test(headText.slice(0, headText.length - beforeWord[0].length))
  const streety = !!beforeWord && /^[A-Z]/.test(beforeWord[1]) && !sentenceHead

  if (PERSON_TITLES[w] && ADDRESS_ABBR[w]) {
    /* 両方に在る字(`dr` `st`)。**決められなければ変えない** */
    if (namey && !streety) return { len: m[0].length, say: PERSON_TITLES[w], klass: 'TITLE' }
    if (streety && !namey) return { len: m[0].length, say: ADDRESS_ABBR[w], klass: 'ADDRESS' }
    if (c.domain === 'ADDRESS' || c.domain === 'TRAVEL') {
      return { len: m[0].length, say: ADDRESS_ABBR[w], klass: 'ADDRESS' }
    }
    return null
  }
  if (PERSON_TITLES[w] && namey) return { len: m[0].length, say: PERSON_TITLES[w], klass: 'TITLE' }
  if (NAME_SUFFIXES[w] && streety) return { len: m[0].length, say: NAME_SUFFIXES[w], klass: 'TITLE' }
  if (ADDRESS_ABBR[w] && streety) return { len: m[0].length, say: ADDRESS_ABBR[w], klass: 'ADDRESS' }
  if (COMPANY_ABBR[w] && streety) return { len: m[0].length, say: COMPANY_ABBR[w], klass: 'ABBREVIATION' }
  if (WEEKDAY_ABBR[w] && /^[\s,]*$|^[\s,]/.test(after)) {
    return { len: m[0].length, say: WEEKDAY_ABBR[w], klass: 'DATE' }
  }
  if (MONTH_ABBR[w]) return { len: m[0].length, say: MONTHS[MONTH_ABBR[w] - 1], klass: 'DATE' }
  if (LATIN_ABBR[w]) return { len: m[0].length, say: LATIN_ABBR[w], klass: 'ABBREVIATION' }
  /* **ふつうの略語は、うしろに数字や語が続くときだけ開く** ——
     `The answer is no.` の `no.` を number にしない */
  if (GENERAL_ABBR[w] && /^\s*[\d#]/.test(after)) {
    return { len: m[0].length, say: GENERAL_ABBR[w], klass: 'ABBREVIATION' }
  }
  return null
}

/**
 * ⓪ **読み名簿にある名前**(第5.269節・2026-09-26 利用者の指摘)。
 *
 *   > UMITOの読み方が全く直っていません。
 *
 * **いちばん先に見る。** あとに回すと、`mInitialism` が
 * 大文字の並びとして拾って**文字ずつに開いてしまう**
 * (それがこの不具合そのものだった)。
 *
 * ・**点は入れない。** 文の終わりの `UMITO.` でも名前だけを拾い、
 *   ピリオドはこれまでどおり文の終わりとして扱う
 * ・**語の途中には当てない**(`UMITOS` の頭に当たらない)。
 *   **ここでは見ない。** 当てはめる人を回す側が
 *   「うしろが字や数字なら、当てはめない」を**全員にまとめて**掛けている
 *   (`isWordCh(src[i + hit.len])`)。
 *   はじめ同じ確かめをここにも書いたが、**赤チェックで一度も赤くならず**、
 *   **効いていない1行**だと分かったので外した
 *   (CLAUDE.md「効かない指定を残さない」「判断は1か所に持つ」)
 * ・名簿は `speakDict.js` 1か所。**ここに名前を書かない**
 */
function mSayAs(c) {
  const m = at(/[A-Za-z][A-Za-z0-9&'-]*/, c.src, c.i)
  if (!m) return null
  if (isWordCh(c.src[c.i - 1])) return null
  const say = SAY_AS_BOOK[m[0]]
  if (!say) return null
  return { len: m[0].length, say, klass: 'NAME' }
}

/** ㉞ 点の付かない略語・頭字語(`CEO` `NASA` `EST`) */
function mInitialism(c) {
  const m = at(/[A-Z]{2,6}\b/, c.src, c.i)
  if (!m) return null
  if (isWordCh(c.src[c.i - 1])) return null
  const w = m[0]
  if (CHEMICAL_NAMES[w]) return { len: w.length, say: CHEMICAL_NAMES[w], klass: 'CHEMISTRY' }
  if (TIMEZONES[w]) return { len: w.length, say: TIMEZONES[w], klass: 'ABBREVIATION' }
  if (WORD_ACRONYMS.has(w)) return { len: w.length, say: w, klass: 'ACRONYM' }
  return { len: w.length, say: letters(w), klass: 'INITIALISM' }
}

/** ㉟ キーの合わせ押し(`Ctrl+C`) */
function mKeys(c) {
  const m = at(/(Ctrl|Cmd|Alt|Opt|Shift|Win)\s?\+\s?([A-Za-z0-9]+|F\d{1,2})\b/i, c.src, c.i)
  if (!m) return null
  const head = KEY_NAMES[m[1].toLowerCase()] ?? m[1]
  const tail = /^F\d+$/i.test(m[2]) ? `F ${cardinal(m[2].slice(1), { locale: c.locale })}`
    : (m[2].length === 1 ? m[2].toUpperCase() : m[2])
  return { len: m[0].length, say: `${head} ${tail}`, klass: 'PROGRAMMING' }
}

/** ㊱ 記号 */
function mSymbol(c) {
  const ch = c.src[c.i]
  if (ch === '&') return { len: 1, say: 'and', klass: 'PUNCTUATION' }
  /* **`=` `<` `>` は、前後が空いているときだけ言葉にする。**
     `<p>` や `a>b` のような詰まった形は、数式とはかぎらない */
  if (MATH_OPERATORS[ch] && /\s/.test(c.src[c.i - 1] ?? ' ') && /\s/.test(c.src[c.i + 1] ?? ' ')) {
    return { len: 1, say: MATH_OPERATORS[ch], klass: 'MATH' }
  }
  if (SYMBOL_WORDS[ch]) return { len: 1, say: SYMBOL_WORDS[ch], klass: 'PUNCTUATION' }
  if (GREEK_LETTERS[ch]) return { len: 1, say: GREEK_LETTERS[ch], klass: 'MATH' }
  if (c.domain === 'PROGRAMMING') {
    for (const [k, v] of Object.entries(CODE_OPERATORS)) {
      if (c.src.startsWith(k, c.i)) return { len: k.length, say: v, klass: 'PROGRAMMING' }
    }
  }
  return null
}

/**
 * **当てはめる順**。**長くて特殊なものが先**(利用者の指定)。
 * 入れ替えると、URL も版番号も IP アドレスも壊れる。
 */
const MATCHERS = [
  /* **読み名簿がいちばん先**(第5.269節)。あとに回すと、
     `mInitialism` が大文字の並びとして拾って文字ずつに開く */
  mSayAs,
  mEmail, mUrl, mIpMac, mFile, mVersion, mPhone,
  mDuration, mTime, mDateWord, mDateDayFirst, mDateNumeric, mEra, mDecade,
  mMoney, mPercent, mDegree, mScientific, mDimension, mMeasure,
  mFraction, mAge, mOrdinal, mYear, mBusiness, mNumbered, mSocial,
  mRatioRange, mSigned, mLeadingDot, mPlainNumber,
  mChemical, mRoman, mMixedAbbr, mDotted, mAbbrev, mInitialism, mKeys, mSymbol,
]

/**
 * ============================================================================
 * **画面の英文を、読み上げ用の英文にする。**
 *
 * @param {string} display 画面に出ている英文。**この文字列は変えない**
 * @param {object} [o]
 * @param {string} [o.locale='en-US']  `LOCALES` のどれか
 * @param {string} [o.domain='GENERAL_ENGLISH'] `DOMAINS` のどれか
 * @param {Record<string,string>} [o.dict] **利用者の名簿。いちばん強い**
 * @returns {{text: string, changed: boolean, parts: Array}}
 *   `parts` は `{at, len, say, klass}` —— **画面の何文字目が、何と読まれたか。**
 *   ハイライトを当てるときに、ここから対応が分かる
 * ============================================================================
 */
export function speakText(display, {
  locale = 'en-US', domain = 'GENERAL_ENGLISH', dict = null,
} = {}) {
  const src = String(display ?? '')
  if (!src) return { text: '', changed: false, parts: [] }
  const c = { src, i: 0, locale, domain, dict }
  /** **文を終わらせている `.` の位置。** 開いた語に、戻すために要る */
  const sentenceDots = new Set()
  for (const m of splitSentences(src)) {
    let e = m.end - 1
    while (e > m.start && /\s/.test(src[e])) e -= 1
    if (src[e] === '.') sentenceDots.add(e)
  }
  const parts = []
  let i = 0
  while (i < src.length) {
    const ch = src[i]
    if (/\s/.test(ch)) { i += 1; continue }
    /* **語の途中からは当てはめない。** `home` の `m` を meter と読まない */
    if (isWordCh(ch) && isWordCh(src[i - 1])) { i += 1; continue }

    /* **利用者の名簿が、いちばん強い**(CUSTOM PRONUNCIATION DICTIONARY) */
    const mine = dictAt(dict, src, i)
    if (mine) { parts.push({ at: i, ...mine }); i += mine.len; continue }

    c.i = i
    let hit = null
    for (const m of MATCHERS) {
      hit = m(c)
      if (hit) break
    }
    /* ── **うしろの空白まで食べない**(2026-09・実際にここで転んだ)──
     *
     *   `([KMBT])?` のような**うしろの任意のかたまり**の前に `\s?` を置くと、
     *   当たらなかったときでも**空白だけが食われる。**
     *   すると `$63 for` は `$63 ` まで当たり、**次が `f` なので**
     *   すぐ下の歯止めに引っかかって、**当てはめごと捨てられていた**
     *   (`$` が画面の文字のまま残り、`$sixty-three` になる)。
     *
     *   **1か所で削る。** 当てはめる人を1つずつ直して回ると、
     *   足した日にまた同じことが起きる(CLAUDE.md「判断は1か所に持つ」)。 */
    while (hit && hit.len > 1 && /\s/.test(src[i + hit.len - 1])) {
      hit = { ...hit, len: hit.len - 1 }
    }
    /* **うしろが字や数字なら、当てはめない。**
       `5 kilometers` の `5 k` を拾って `ilometers` を残さない */
    if (hit && isWordCh(src[i + hit.len])) hit = null
    /* ── **文の終わりの点を、落とさない**(2026-09 実機)──────────
     *
     *   `… the arrival time is 4:50 P.M. For the 10:20 departure …`
     *   の `P.M.` を開くと、**文の終わりの点まで食べてしまう。**
     *   すると向こうは**息継ぎ無しで次の文へ続けて読む** ——
     *   そこで文が切れなくなる。
     *
     *   **「その点は文を終わらせているか」は、すでに1か所が知っている**
     *   (`wordTiming.js` の `splitSentences`)。ここで判じ直さない
     *   (CLAUDE.md「判断は1か所に持つ」)。`Mr. Smith` の点は
     *   文を終わらせていないので、戻さない。 */
    if (hit && src[i + hit.len - 1] === '.' && sentenceDots.has(i + hit.len - 1)) {
      hit = { ...hit, say: `${hit.say}.` }
    }
    if (hit && hit.say != null) { parts.push({ at: i, ...hit }); i += hit.len; continue }
    i += 1
  }

  /* 当てはまったところだけを差し替える。**それ以外は1文字も動かさない**。
     **読み上げ用の文の何文字目になったか**(`sayAt`)も控える ——
     声の合図(`boundary`)は**読み上げ用の文の位置**で返ってくるので、
     これが無いと、**画面のどの語が光るかが分からない** */
  let out = ''
  let last = 0
  for (const p of parts) {
    out += src.slice(last, p.at)
    p.sayAt = out.length
    out += p.say
    last = p.at + p.len
  }
  out += src.slice(last)
  return { text: out, changed: out !== src, parts }
}

/**
 * **読み上げ用の文の位置 → 画面の英文の位置。**
 *
 * 書き換えた内側(`twenty-five dollars` の途中)を指されたら、
 * **その塊の頭**(`$25` の `$`)を返す ——
 * 画面には「twenty-five」に当たる文字が無いので、そこがいちばん近い。
 *
 * @param {{parts: Array}} got `speakText()` が返したもの
 * @param {number} spokenAt 読み上げ用の文の何文字目か
 * @returns {number} 画面の英文の何文字目か
 */
export function displayAtOf(got, spokenAt) {
  const n = Number(spokenAt)
  if (!Number.isFinite(n) || n < 0) return 0
  const parts = got?.parts ?? []
  let shift = 0
  for (const p of parts) {
    if (n < p.sayAt) break                 // **まだ手前。ずれはここまでの分だけ**
    if (n < p.sayAt + p.say.length) return p.at   // 書き換えた塊の中 → 塊の頭
    shift += p.say.length - p.len
  }
  return Math.max(0, n - shift)
}

/** 利用者の名簿から当てる。**global rule より先に見る** */
function dictAt(dict, src, i) {
  if (!dict) return null
  for (const [k, v] of Object.entries(dict)) {
    if (!k || typeof v !== 'string') continue
    if (!src.startsWith(k, i)) continue
    if (isWordCh(src[i + k.length]) && isWordCh(k[k.length - 1])) continue
    return { len: k.length, say: v, klass: 'OTHER' }
  }
  return null
}

/** 読み上げ用の英文だけが要るとき */
export const spokenForm = (display, o) => speakText(display, o).text
