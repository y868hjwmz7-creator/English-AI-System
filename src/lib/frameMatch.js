/**
 * 英文の「型」を見分ける — **決まりだけで。AI を1回も呼ばない**(2026-09)。
 *
 * ============================================================================
 * 【何のためか】(2026-09 利用者の指定)
 *
 *   > 型の見分け、使い分けは必ず実現したいトレーニングです
 *
 *   `src/data/sentenceFrames.js` の 66 型は、いまは**巻末に刷るだけ**である。
 *   眺めるだけでは「この文はどの型か」が身に付かない。
 *   **手元の英文が、その 66 型のどれなのかを言えれば**、
 *   単語帳も Quick Response も**型べつに練習できる。**
 *
 * 【なぜ AI に尋ねないか】
 *
 *   単語帳の語も Quick Response の問も**千を超える。**
 *   1文ごとに尋ねると、そのたびに課金になる
 *   (CLAUDE.md「見えない費用は管理できない」)。
 *   スラッシュリーディングの区切り(`chunker.js`)と同じで、
 *   **閉じたリストと記号だけ**で見分ける。**0円**である。
 *
 * 【当てられないものは `null`。黙る】
 *
 *   **取り違えるくらいなら、見落とすほう**を選ぶ
 *   (`SURE_PREPS` / `abbrevAt` とまったく同じ考え方)。
 *   型を言い当てられなかった文は「型なし」で、絞り込みにも出てこない。
 *   **当てずっぽうで型を付けると、練習そのものが嘘になる。**
 *
 * 【一覧を2か所に書かない】
 *
 *   型の名前(`form`)は **`sentenceFrames.js` が唯一の出どころ**である。
 *   ここの規則は、その文字列をそのまま鍵に使う。食い違ったら
 *   `frameRuleAudit()` が知らせる —— `npm run test:frame` が毎回まわすので、
 *   **型を足して規則を足し忘れる**ことが起こりえない
 *   (`check.sql` と移行の関係とまったく同じ作法)。
 *
 *   語の一覧(前置詞・冠詞・形容詞・数)は **`chunker.js` から読む。**
 *   書き写すと必ず片方だけ古くなる。
 *
 * 【何にも依存しない】
 *
 *   Supabase も `import.meta.env` も引き連れていないので、
 *   **素の node で走らせられる**(`playMark.js` / `posGroups.js` と同じ)。
 *   `npm run test:frame` が、これを直に読んで数える。
 * ============================================================================
 */
import { FRAME_SECTIONS } from '../data/sentenceFrames.js'
import {
  DETERMINERS, NUMBER_WORDS, OBJECT_PRONOUNS, PREPOSITIONS,
  SUBJECT_PRONOUNS, isAdjective, isParticiple, NOT_PARTICIPLES,
  INDEFINITE_PRONOUNS, PLAIN_ADVERBS, TAIL_ADVERBS,
} from './chunker.js'

/* ────────────────────────────────────────────────────────────────
   1. そろえ方 —— **記号と短縮形だけ**を直す
   ──────────────────────────────────────────────────────────────── */

/**
 * **短縮形をほどく。閉じた一覧である。**
 *
 * `That's why ~` `There's ~` `It's X that ~` は、**ほどかないと当たらない。**
 *
 * 【代名詞と疑問詞だけに絞る理由】
 *   `the company's plan` の `'s` は**所有**であって「is」ではない。
 *   一般の名詞まで機械的にほどくと `the company is plan` になり、
 *   **無かったはずの be 動詞が生まれる。** だから一覧を閉じる。
 */
const CONTRACTIONS = new Map([
  ["it's", 'it is'], ["that's", 'that is'], ["there's", 'there is'],
  ["what's", 'what is'], ["here's", 'here is'], ["who's", 'who is'],
  ["he's", 'he is'], ["she's", 'she is'], ["let's", 'let us'],
  ["i'm", 'i am'],
  ["we're", 'we are'], ["you're", 'you are'], ["they're", 'they are'],
  ["i've", 'i have'], ["we've", 'we have'],
  ["you've", 'you have'], ["they've", 'they have'],
  ["i'd", 'i would'], ["we'd", 'we would'], ["you'd", 'you would'],
  ["they'd", 'they would'], ["he'd", 'he would'], ["she'd", 'she would'],
  ["i'll", 'i will'], ["we'll", 'we will'], ["you'll", 'you will'],
  ["they'll", 'they will'], ["he'll", 'he will'], ["she'll", 'she will'],
  ["it'll", 'it will'],
  ["don't", 'do not'], ["doesn't", 'does not'], ["didn't", 'did not'],
  ["isn't", 'is not'], ["aren't", 'are not'],
  ["wasn't", 'was not'], ["weren't", 'were not'],
  ["can't", 'can not'], ["couldn't", 'could not'],
  ["won't", 'will not'], ["wouldn't", 'would not'],
  ["shouldn't", 'should not'],
  ["haven't", 'have not'], ["hasn't", 'has not'], ["hadn't", 'had not'],
])

/**
 * **文の終わりの記号があるか。**
 *
 * これは飾りではない。③「1文を後ろへ伸ばす」の4つ
 * (関係詞・現在分詞・過去分詞・同格)は**名詞のかたまり**であって、
 * 文ではない。**文と区別できる唯一の目印がこれ**である(下の `nounFragment`)。
 */
const ENDS_SENTENCE = /[.!?]["'）)\]]*\s*$/

/**
 * 記号をそろえる。**合字や引用符の違いで当たらなくなるのを防ぐ。**
 *
 * `normEn()`(`textNorm.js`)は使わない —— あちらは**記号を全部落とす**ので、
 * 同格(`our goal, a 20% increase`)や
 * 「The 比較級, the 比較級」の**コンマが消える。**
 * 役目が違うので、2つあってよい。
 */
export const frameNorm = (text) => String(text ?? '')
  .replace(/[‘’ʼ`]/g, "'")
  .replace(/[“”]/g, '"')
  .replace(/[–—]/g, '-')
  .replace(/…/g, '...')
  .toLowerCase()
  .replace(/\s+/g, ' ')
  .trim()

/**
 * 語に割る。**コンマは1語として残す**(同格と「The 比較級, the 比較級」で要る)。
 *
 * 文末の記号は落とす —— 落とさないと `twice.` が `twice` と別語になる。
 */
export const frameWords = (text) => {
  const s = frameNorm(text).replace(/([,;:])/g, ' $1 ')
  const out = []
  for (const raw of s.split(/\s+/)) {
    const t = raw.replace(/^[^a-z0-9,'%-]+/, '').replace(/[^a-z0-9,'%-]+$/, '')
    if (!t) continue
    const opened = CONTRACTIONS.get(t)
    if (opened) out.push(...opened.split(' '))
    else out.push(t)
  }
  return out
}

/* ────────────────────────────────────────────────────────────────
   2. 語の一覧 —— **ここにしか無いものだけ**を置く
   ──────────────────────────────────────────────────────────────── */

/**
 * **「どれくらい」の長さを表す名詞。**
 *
 * `chunker.js` の `TIME_NOUNS` は**「いつ」**の一覧(`next month` の `month`)で、
 * `hour` も `minute` も入っていない。**あちらに足さない** ——
 * 足すとスラッシュの落ちる場所が変わる(言われていない場所を直すことになる)。
 * **役目が違う一覧なので、2つあってよい。**
 */
const TIME_SPAN = new Set([
  'second', 'seconds', 'minute', 'minutes', 'hour', 'hours',
  'day', 'days', 'week', 'weeks', 'month', 'months',
  'year', 'years', 'decade', 'decades',
  'time', 'times', 'moment', 'moments', 'while', 'ages', 'night', 'nights',
])

/**
 * **人を指す目的語。** `S brings 人 名詞` と `S takes (人) 時間 to do` で要る。
 *
 * `chunker.js` の `OBJECT_PRONOUNS` には `this` `that` `it` も入っている
 * (あちらは「目的語になりうる語」の一覧)。ここで要るのは**人**だけなので、
 * あちらを絞って使わず、**人の分だけ**を別に持つ。
 */
const PERSON_OBJ = new Set([
  'me', 'us', 'him', 'her', 'them', 'you',
  'everyone', 'everybody', 'someone', 'somebody', 'people',
])

/**
 * **`make / leave / keep 人 形容詞` の席に立つ形容詞のうち、
 * `chunker.js` の一覧に無いもの。**
 *
 * あちらは「**ほかの品詞にもなる語は入れない**」という決まりで作ってある
 * (`hard` は副詞、`clear` は動詞、`ready` は入っていない)。
 * スラッシュの区切りでは**それが正しい** —— 取り違えると正しい区切りを咎める。
 *
 * ここは事情が違う。**席がすでに決まっている** ——
 * `made everyone ___` の `___` は形容詞か原形の動詞しか来ない。
 * だから**もう少し広く取れる。**
 */
const FRAME_ADJ = new Set([
  'ready', 'clear', 'easier', 'harder', 'open', 'shut', 'alive',
  'awake', 'alone', 'aware', 'alert', 'calm', 'quiet', 'clean', 'dry',
  'wet', 'simple', 'complete', 'current', 'honest', 'fair', 'sure',
  'interested', 'excited', 'bored', 'confused', 'motivated', 'focused',
  'engaged', 'informed', 'organized', 'relaxed', 'satisfied', 'stuck',
  'unchanged', 'safe', 'sharp', 'short', 'warm', 'cool',
  /* **実データで取り違えたぶん**(2026-09)。`to make matters worse` が
     `worse` を原形の動詞と見なされて `S makes 人 do(原形)` になっていた */
  'better', 'worse', 'best', 'worst', 'crazy', 'sick', 'wrong', 'fine',
  'glad', 'mad', 'upset', 'sleepy', 'hungry', 'thirsty', 'proud',
])

/**
 * **副詞にもなる語は、入れない。**
 *
 * `He left the office early.` が `S leaves 人 形容詞` になっていた
 * (2026-09 実データ)。`early` `late` `fast` `hard` `high` `low` `free` は
 * **形容詞にも副詞にもなる。** `chunker.js` の形容詞の一覧が
 * これらを入れていないのは**正しい判断**で、ここでも同じにする。
 *
 * その代わり **`S keeps 人/物 形容詞` で `keeps costs low` を取り逃がす。**
 * 取り違えるより、見落とすほうを選ぶ(CLAUDE.md)。
 */
const ADV_TOO = new Set([
  'early', 'late', 'fast', 'hard', 'high', 'low', 'free', 'even',
  'light', 'dark', 'well', 'home', 'away', 'back', 'enough',
  'first', 'next', 'anyway', 'anymore', 'twice', 'once', 'forever',
])

/**
 * **`make it ___ (for 人) to do` の席に立つ形容詞。**
 *
 * ここは**席が固まっている**(`it` と `to do` に挟まれている)ので、
 * `hard` のように副詞にもなる語を入れても取り違えない。
 * 型の名前が `possible` `hard` と名指ししているので、**その一覧を持つ。**
 */
const IT_ADJ = new Set([
  'possible', 'impossible', 'easy', 'easier', 'hard', 'harder',
  'difficult', 'simple', 'clear', 'tough', 'safe', 'cheap', 'expensive',
  'quick', 'slow', 'painless', 'natural', 'worth',
])

const adjHere = (w) => !!w && !ADV_TOO.has(w) && (FRAME_ADJ.has(w) || isAdjective(w))

/** be 動詞。**「文かどうか」の判断に使う** */
const BE = new Set(['is', 'are', 'was', 'were', 'am', 'be', 'been', 'being'])

/**
 * **文になっている目印。**
 *
 * これが1つも無ければ「名詞のかたまりかもしれない」と見る。
 * **閉じた一覧にしてある** —— `-s` や `-ed` で終わる語を動詞と見なすと、
 * `errors`(名詞)まで動詞になり、何でも文になってしまう。
 */
const FINITE = new Set([
  ...BE,
  'can', 'could', 'will', 'would', 'shall', 'should', 'may', 'might', 'must',
  'do', 'does', 'did', 'have', 'has', 'had',
])

/** つなぎ・関係詞。目的語の切れ目になる */
const CLAUSE_WORDS = new Set([
  'and', 'or', 'but', 'so', 'because', 'that', 'which', 'who', 'whom',
  'whose', 'when', 'where', 'while', 'if', 'though', 'although', 'than',
])

/* ────────────────────────────────────────────────────────────────
   3. 動詞の活用 —— **閉じた一覧**(推測で作らない)
   ──────────────────────────────────────────────────────────────── */

/**
 * 型が名指ししている動詞の活用。**この 25 語だけ**である。
 *
 * 機械的に `-s` `-ed` を付けて作らない —— `lead` の過去は `led`、
 * `bring` は `brought`、`take` は `took` で、**規則では出ない。**
 */
const VERB_FORMS = {
  allow: ['allow', 'allows', 'allowed', 'allowing'],
  enable: ['enable', 'enables', 'enabled', 'enabling'],
  help: ['help', 'helps', 'helped', 'helping'],
  encourage: ['encourage', 'encourages', 'encouraged', 'encouraging'],
  inspire: ['inspire', 'inspires', 'inspired', 'inspiring'],
  lead: ['lead', 'leads', 'led', 'leading'],
  prompt: ['prompt', 'prompts', 'prompted', 'prompting'],
  force: ['force', 'forces', 'forced', 'forcing'],
  make: ['make', 'makes', 'made', 'making'],
  keep: ['keep', 'keeps', 'kept', 'keeping'],
  prevent: ['prevent', 'prevents', 'prevented', 'preventing'],
  stop: ['stop', 'stops', 'stopped', 'stopping'],
  discourage: ['discourage', 'discourages', 'discouraged', 'discouraging'],
  require: ['require', 'requires', 'required', 'requiring'],
  take: ['take', 'takes', 'took', 'taking', 'taken'],
  involve: ['involve', 'involves', 'involved', 'involving'],
  call: ['call', 'calls', 'called', 'calling'],
  cause: ['cause', 'causes', 'caused', 'causing'],
  result: ['result', 'results', 'resulted', 'resulting'],
  bring: ['bring', 'brings', 'brought', 'bringing'],
  leave: ['leave', 'leaves', 'left', 'leaving'],
  show: ['show', 'shows', 'showed', 'shown', 'showing'],
  suggest: ['suggest', 'suggests', 'suggested', 'suggesting'],
  explain: ['explain', 'explains', 'explained', 'explaining'],
  remind: ['remind', 'reminds', 'reminded', 'reminding'],
}

const formsOf = (key) => new Set(VERB_FORMS[key])

/** その動詞が出てくる場所(いちばん先のもの)。無ければ -1 */
const verbAt = (w, key) => {
  const set = formsOf(key)
  return w.findIndex((t) => set.has(t))
}

/* ────────────────────────────────────────────────────────────────
   4. 形をほどく道具
   ──────────────────────────────────────────────────────────────── */

/**
 * 動詞のうしろの**目的語の切れ目**を、短いほうから順に試す。
 *
 * `made everyone nervous` は目的語1語、
 * `keeps your english sharp` は2語である。**どこで切れるかは、
 * うしろに何が来るかでしか決まらない**ので、呼ぶ側に判断させる。
 *
 * **冠詞・前置詞・つなぎで終わる目的語は返さない** ——
 * `made a decision` の `a` を目的語と見なすと、
 * `decision` が原形の動詞に見えてしまう(実際そうなった)。
 */
function* objectEnds(w, i, max = 4) {
  for (let n = 1; n <= max; n += 1) {
    const k = i + n + 1
    if (k >= w.length) return
    const tail = w[k - 1]
    /* `her` は**冠詞でもあり、人の目的語でもある**(`inspired her to learn`)。
       冠詞だからと外すと、この型が丸ごと落ちる。**人の目的語なら残す** */
    if ((DETERMINERS.has(tail) && !PERSON_OBJ.has(tail)) || PREPOSITIONS.has(tail)
      || CLAUSE_WORDS.has(tail) || tail === ',') continue
    /* **形容詞で終わる目的語は無い。** `made a good fortune` の `good` を
       目的語の終わりと見ると、`fortune` が原形の動詞に見える(実データ) */
    if (adjHere(tail) && !PERSON_OBJ.has(tail)) continue
    yield k
  }
}

/** 動詞 + 目的語 + `to do`(`S allows 人 to do` の形) */
const objThenTo = (w, key) => {
  const i = verbAt(w, key)
  if (i < 0 || w[i + 1] === 'to') return false
  for (const k of objectEnds(w, i)) {
    if (w[k] === 'to' && /^[a-z]+$/.test(w[k + 1] ?? '')) return true
  }
  return false
}

/** 動詞 + 目的語 + `from ~ing`(`S keeps 人 from ~ing` の形) */
const objThenFromIng = (w, key) => {
  const i = verbAt(w, key)
  if (i < 0) return false
  for (const k of objectEnds(w, i)) {
    if (w[k] === 'from' && /ing$/.test(w[k + 1] ?? '')) return true
  }
  return false
}

/**
 * 動詞 + 目的語 + **その次に来るもの**。`make / leave / keep / help` で使う。
 *
 * 【いちばん手前の切れ目だけを見る】(2026-09 実データ)
 *
 *   `It makes me feel good about myself.` を**奥まで探しに行かせる**と、
 *   目的語を `me feel` と取って `good` に行き着き、
 *   **`S makes 人 形容詞` になっていた。** 正しくは `makes me feel` で
 *   `S makes 人 do(原形)` である。
 *
 *   目的語は**動詞のすぐうしろから始まる**のだから、
 *   **成り立つ切れ目のうち、いちばん手前が答え**である。
 *   奥を許すと、必ずどこかで形容詞に行き着く。
 */
const complementOf = (w, key) => {
  const i = verbAt(w, key)
  if (i < 0) return null
  for (const k of objectEnds(w, i)) {
    const j = DEGREE.has(at(w, k)) ? k + 1 : k
    const t = at(w, j)
    if (!t) return null
    if (adjHere(t)) return 'adj'
    if (!/^[a-z]+$/.test(t)) return null
    if (DETERMINERS.has(t) || PREPOSITIONS.has(t) || CLAUSE_WORDS.has(t)) return null
    if (NUMBER_WORDS.has(t) || SUBJECT_PRONOUNS.has(t) || OBJECT_PRONOUNS.has(t)) return null
    if (/ly$/.test(t) || (isParticiple(t) && !NOT_PARTICIPLES.has(t))) return null
    /* **`-ly` で終わらない副詞**(2026-09 実データ)。
       `make a decision soon` の `soon` を原形の動詞と見なしていた。
       一覧は `chunker.js` から読む —— **書き写さない** */
    if (PLAIN_ADVERBS.has(t) || TAIL_ADVERBS.has(t) || ADV_TOO.has(t)) return null
    return 'bare'
  }
  return null
}

/**
 * `S helps 人 (to) do` —— `to` が挟まっても同じ型である。
 *
 * **`to` を飛ばしてから** `complementOf` と同じ判断をする。
 */
const helpsBare = (w) => {
  const i = verbAt(w, 'help')
  if (i < 0) return false
  if (complementOf(w, 'help') === 'bare') return true
  for (const k of objectEnds(w, i)) {
    if (at(w, k) !== 'to') return false
    return /^[a-z]+$/.test(at(w, k + 1))
  }
  return false
}

/**
 * `take` + (人) + 時間 + `to do`。
 *
 * **`(人)` が居るかどうかだけ**が、①3 の `S takes (人) 時間 to do` と
 * ①7 の `It takes 時間 to do` を分ける —— 型の名前がそう書いてある。
 */
const takeTime = (w) => {
  const i = verbAt(w, 'take')
  if (i < 0) return null
  let j = i + 1
  const person = PERSON_OBJ.has(w[j] ?? '')
  if (person) j += 1
  let k = j
  while (k < w.length && (NUMBER_WORDS.has(w[k]) || /^\d+$/.test(w[k])
    || DETERMINERS.has(w[k]) || w[k] === 'of' || w[k] === 'about')) k += 1
  if (!TIME_SPAN.has(w[k] ?? '')) return null
  if (w[k + 1] !== 'to' || !/^[a-z]+$/.test(w[k + 2] ?? '')) return null
  return { person }
}

/**
 * **文ではなく、名詞のかたまりか。**
 *
 * ③「1文を後ろへ伸ばす」の4つは、型そのものが名詞のかたまりである
 * (`the report that we sent yesterday`)。
 *
 * 【なぜ「文の終わりの記号が無いこと」で見るか】
 *
 *   `The door opened slowly.` は**ふつうの文**だが、語の並びだけを見ると
 *   `the + 名詞 + 過去分詞 + 副詞` で、`the report sent yesterday` と
 *   **1文字も違わない形**である。**語では割れない。**
 *
 *   割れる目印は1つしかない ——**書いた人が文として閉じたかどうか**である。
 *   教材の英文にも Quick Response の問にも、必ず終わりの記号が付いている。
 *   だから**記号で割る。**
 *
 * 【見落とすほうを選んでいる】
 *
 *   この決まりだと、**文の中に埋まっている関係詞は拾えない**
 *   (`The report that we sent yesterday arrived.`)。
 *   拾おうとすると `that` を含む文がぜんぶ関係詞になり、**取り違える。**
 *   CLAUDE.md の「既定は『できない』『見せない』側」に従う。
 */
const nounFragment = (w, raw) => {
  if (ENDS_SENTENCE.test(String(raw ?? ''))) return false
  if (!DETERMINERS.has(w[0] ?? '')) return false
  if (w.some((t) => FINITE.has(t))) return false
  return w.length >= 3
}

/* ────────────────────────────────────────────────────────────────
   5. 規則 —— **並び順が意味を持つ。上から順に、当たったもの勝ち**

   並べ方の決まりは1つだけ。**狭いものを先に置く。**
   `S leads to 名詞` より `S leads 人 to do` が先、
   `S requires 名詞` より `S requires 人 to do` が先、
   `形式主語 it` より `It is X that / who ~` が先である。
   ──────────────────────────────────────────────────────────────── */

const line = (w) => w.join(' ')
const at = (w, i) => w[i] ?? ''
const DEGREE = new Set(['very', 'so', 'too', 'quite', 'really', 'pretty', 'extremely'])
const COMPARATIVE = (t) => t === 'more' || t === 'less' || t === 'fewer'
  || t === 'better' || t === 'worse' || /^[a-z]{3,}er$/.test(t)

/**
 * 名詞化の語尾。**動詞から作った名詞の目印**(`decide` → `decision`)。
 *
 * **`-ure` `-al` `-th` `-sis` は入れない**(2026-09 実データ)。
 * `temperature` `total` `month` に**元の動詞が無い。**
 * `The temperature dropped …` が名詞構文になっていた。
 * **当てられるものだけを見る。**
 */
const NOMINAL_TAIL = /(tion|sion|ment|ance|ence|ity|ness)$/

/** 動詞として立っていそうな語。**`-s` `-ed` まで見る**(ここは最後の砦なので広く取る) */
const looksFinite = (t) => FINITE.has(t) || /^[a-z]{3,}(s|ed)$/.test(t)

/**
 * **`-ing` で終わる分詞か。**
 *
 * `nothing` `anything` も `-ing` で終わる(2026-09 実データ。
 * `Nothing is impossible.` が動名詞になっていた)。
 * `chunker.js` の `INDEFINITE_PRONOUNS` で外す —— **一覧を書き写さない。**
 */
const ingHere = (t) => /ing$/.test(t) && isParticiple(t)
  && !NOT_PARTICIPLES.has(t) && !INDEFINITE_PRONOUNS.has(t)

const hasToDo = (w, from = 0) => {
  for (let i = from; i < w.length - 1; i += 1) {
    if (w[i] === 'to' && /^[a-z]+$/.test(w[i + 1])) return true
  }
  return false
}

/**
 * 66 型の見分け方。**`form` は `sentenceFrames.js` の文字列をそのまま書く。**
 *
 * 書き間違えても `frameRuleAudit()` が知らせるので、黙って効かなくなることはない。
 */
export const FRAME_RULES = [
  /* ── ③ 語そのものが目印になるもの。いちばん確かなので先に見る ── */
  { form: 'Not only ~ but also …', hit: (w, s) => /\bnot only\b/.test(s) && /\bbut\b/.test(s) },
  { form: 'I was wondering if you could ~', hit: (w, s) => /\bwas wondering if\b/.test(s) },
  { form: 'Would it be possible to ~', hit: (w, s) => /\bwould it be possible to\b/.test(s) },
  { form: 'It might be worth ~ing', hit: (w, s) => /\b(might|may|would) be worth\b/.test(s) },
  { form: 'We may want to ~', hit: (w, s) => /\b(may|might) want to\b/.test(s) },
  { form: 'What if we ~', hit: (w) => at(w, 0) === 'what' && at(w, 1) === 'if' },
  { form: 'When it comes to ~', hit: (w, s) => /\bwhen it comes to\b/.test(s) },
  { form: 'In terms of ~', hit: (w, s) => /\bin terms of\b/.test(s) },
  { form: 'As for ~', hit: (w) => at(w, 0) === 'as' && at(w, 1) === 'for' },
  /* `Given` は文頭だけ。`We were given the budget` を巻き込まないため */
  { form: 'Given (that) ~', hit: (w) => at(w, 0) === 'given' },
  { form: 'Based on ~', hit: (w) => at(w, 0) === 'based' && at(w, 1) === 'on' },
  { form: 'That said, ~', hit: (w, s) => /\bthat said\b/.test(s) },
  { form: 'Which means ~', hit: (w, s) => /\bwhich means\b/.test(s) },
  { form: "That's why ~", hit: (w) => at(w, 0) === 'that' && at(w, 1) === 'is' && at(w, 2) === 'why' },
  { form: 'the fact that', hit: (w, s) => /\bthe fact that\b/.test(s) },
  /* `The reason ~ is that …`(③)を、`the way / the reason`(②)より先に見る */
  { form: 'The reason ~ is that …', hit: (w, s) => at(w, 0) === 'the' && at(w, 1) === 'reason' && /\bis that\b/.test(s) },
  { form: 'the way / the reason', hit: (w) => at(w, 0) === 'the' && (at(w, 1) === 'way' || at(w, 1) === 'reason') },
  { form: 'All 人 have to do is do', hit: (w, s) => /\ball (you|we|i|they|he|she|one) (have|has|had) to do is\b/.test(s) },
  { form: 'less about A than B', hit: (w, s) => /\bless about\b/.test(s) && /\bthan\b/.test(s) },
  {
    form: 'The 比較級, the 比較級',
    hit: (w) => {
      if (at(w, 0) !== 'the' || !COMPARATIVE(at(w, 1))) return false
      for (let i = 2; i < w.length - 2; i += 1) {
        if (w[i] === ',' && w[i + 1] === 'the' && COMPARATIVE(at(w, i + 2))) return true
      }
      return false
    },
  },
  {
    /* `not … but …` は**間が近いときだけ。** 離れていると、ただの否定文に当たる */
    form: 'not A but B',
    hit: (w) => {
      const n = w.indexOf('not')
      if (n < 0) return false
      const b = w.indexOf('but', n + 1)
      if (b < 0 || b - n > 5) return false
      const nx = at(w, b + 1)
      return DETERMINERS.has(nx) || NUMBER_WORDS.has(nx) || adjHere(nx)
    },
  },
  { form: 'A rather than B', hit: (w, s) => /\brather than\b/.test(s) },
  { form: 'There is / are ~', hit: (w) => at(w, 0) === 'there' && BE.has(at(w, 1)) },
  {
    /* `It is X that / who ~`。**うしろが形容詞なら②の形式主語**なので外す */
    form: 'It is X that / who ~',
    hit: (w) => {
      if (at(w, 0) !== 'it' || !BE.has(at(w, 1))) return false
      if (adjHere(at(w, 2))) return false
      if (DEGREE.has(at(w, 2)) && adjHere(at(w, 3))) return false
      return w.slice(3).some((t) => t === 'that' || t === 'who')
    },
  },
  {
    /* `What ~ is …`。
       **`what` の次が be 動詞や助動詞なら、ただの疑問文**である ——
       `What is your name?` `What do you wanna be?`
       `What have you been up to?`(2026-09 実データで3つとも拾っていた) */
    form: 'What ~ is …',
    hit: (w) => at(w, 0) === 'what' && !FINITE.has(at(w, 1))
      && w.slice(2).some((t) => BE.has(t)),
  },
  { form: 'S explains why ~', hit: (w) => { const i = verbAt(w, 'explain'); return i >= 0 && at(w, i + 1) === 'why' } },
  /* `That's why` は上で取ってある。ここに来るのは `This is why` のほう */
  { form: 'S is why ~', hit: (w, s) => /\b(is|was) why\b/.test(s) },

  /* ── ① 無生物主語。**動詞で見分ける**(型そのものがそう言っている) ── */
  {
    form: 'S makes it hard for 人 to do',
    hit: (w) => {
      const i = verbAt(w, 'make')
      if (i < 0 || at(w, i + 1) !== 'it') return false
      if (!IT_ADJ.has(at(w, i + 2)) || at(w, i + 3) !== 'for') return false
      return hasToDo(w, i + 4)
    },
  },
  {
    /* 型の名前は `possible` だが、**その席に立つのは形容詞**である。
       `easy` `hard` でも同じ型なので、形容詞なら当てる */
    form: 'S makes it possible to do',
    hit: (w) => {
      const i = verbAt(w, 'make')
      if (i < 0 || at(w, i + 1) !== 'it') return false
      if (!IT_ADJ.has(at(w, i + 2))) return false
      return at(w, i + 3) === 'to' && /^[a-z]+$/.test(at(w, i + 4))
    },
  },
  /* `(人)` が居るかどうかだけが、この2つを分ける */
  { form: 'It takes 時間 to do', hit: (w, s, t) => !!t && !t.person && at(w, 0) === 'it' },
  { form: 'S takes (人) 時間 to do', hit: (w, s, t) => !!t },

  { form: 'S keeps 人 from ~ing', hit: (w) => objThenFromIng(w, 'keep') },
  { form: 'S prevents 人 from ~ing', hit: (w) => objThenFromIng(w, 'prevent') },
  { form: 'S stops 人 from ~ing', hit: (w) => objThenFromIng(w, 'stop') },
  { form: 'S discourages 人 from ~ing', hit: (w) => objThenFromIng(w, 'discourage') },

  { form: 'S allows 人 to do', hit: (w) => objThenTo(w, 'allow') },
  { form: 'S enables 人 to do', hit: (w) => objThenTo(w, 'enable') },
  { form: 'S encourages 人 to do', hit: (w) => objThenTo(w, 'encourage') },
  { form: 'S inspires 人 to do', hit: (w) => objThenTo(w, 'inspire') },
  { form: 'S prompts 人 to do', hit: (w) => objThenTo(w, 'prompt') },
  { form: 'S forces 人 to do', hit: (w) => objThenTo(w, 'force') },
  { form: 'S requires 人 to do', hit: (w) => objThenTo(w, 'require') },
  { form: 'S leads 人 to do', hit: (w) => objThenTo(w, 'lead') },

  { form: 'S leads to 名詞', hit: (w) => { const i = verbAt(w, 'lead'); return i >= 0 && at(w, i + 1) === 'to' && !!at(w, i + 2) } },
  { form: 'S results in 名詞', hit: (w) => { const i = verbAt(w, 'result'); return i >= 0 && at(w, i + 1) === 'in' && !!at(w, i + 2) } },
  { form: 'S involves ~ing', hit: (w) => { const i = verbAt(w, 'involve'); return i >= 0 && /ing$/.test(at(w, i + 1)) } },
  { form: 'S calls for 名詞', hit: (w) => { const i = verbAt(w, 'call'); return i >= 0 && at(w, i + 1) === 'for' && !!at(w, i + 2) } },
  {
    form: 'S requires 名詞',
    hit: (w) => {
      const i = verbAt(w, 'require')
      const nx = at(w, i + 1)
      return i >= 0 && !!nx && nx !== 'to' && !PREPOSITIONS.has(nx) && !CLAUSE_WORDS.has(nx)
    },
  },
  {
    /* 文頭の `cause` は「because」の話し言葉なので外す */
    form: 'S causes 名詞',
    hit: (w) => {
      const i = verbAt(w, 'cause')
      const nx = at(w, i + 1)
      return i >= 1 && !!nx && nx !== 'to' && !PREPOSITIONS.has(nx) && !CLAUSE_WORDS.has(nx)
    },
  },
  {
    /* **人のうしろに前置詞が来たら、この型ではない。**
       `What brought you to Japan?` は「人に名詞を持ってくる」ではない(実データ) */
    form: 'S brings 人 名詞',
    hit: (w) => {
      const i = verbAt(w, 'bring')
      if (i < 0 || !PERSON_OBJ.has(at(w, i + 1)) || w.length <= i + 2) return false
      return !PREPOSITIONS.has(at(w, i + 2)) && !CLAUSE_WORDS.has(at(w, i + 2))
    },
  },
  {
    form: 'S reminds 人 that ~',
    hit: (w) => {
      const i = verbAt(w, 'remind')
      if (i < 0) return false
      for (const k of objectEnds(w, i)) if (w[k] === 'that') return true
      return false
    },
  },
  {
    /* `(that)` は省けるので、**うしろが節かどうか**で見る。
       名詞だけが続くとき(`shows a rise`)は当てない —— **見落とすほう** */
    form: 'S shows / suggests (that) ~',
    hit: (w) => {
      const i = ['show', 'suggest'].map((k) => verbAt(w, k)).filter((n) => n >= 0).sort((a, b) => a - b)[0]
      if (i === undefined) return false
      const rest = w.slice(i + 1, i + 6)
      if (rest[0] === 'that') return true
      return rest.some((t) => FINITE.has(t))
    },
  },

  { form: 'S makes 人 形容詞', hit: (w) => complementOf(w, 'make') === 'adj' },
  { form: 'S leaves 人 形容詞', hit: (w) => complementOf(w, 'leave') === 'adj' },
  { form: 'S keeps 人/物 形容詞', hit: (w) => complementOf(w, 'keep') === 'adj' },
  { form: 'S helps 人 (to) do', hit: (w) => helpsBare(w) },
  { form: 'S makes 人 do(原形)', hit: (w) => complementOf(w, 'make') === 'bare' },

  /* ── ② 主語の席に、何を入れるか ── */
  {
    /* `Having reviewed the data, we decided to wait.` —— **コンマが目印** */
    form: '分詞構文',
    hit: (w) => {
      const head = at(w, 0)
      if (head !== 'having' && !ingHere(head)
        && !(isParticiple(head) && !NOT_PARTICIPLES.has(head))) return false
      for (let i = 1; i <= Math.min(8, w.length - 3); i += 1) {
        if (w[i] === ',') return w.length - i >= 3
      }
      return false
    },
  },
  {
    form: '形式主語 it',
    hit: (w) => {
      if (at(w, 0) !== 'it' || !BE.has(at(w, 1))) return false
      const j = DEGREE.has(at(w, 2)) ? 3 : 2
      return adjHere(at(w, j)) && hasToDo(w, j + 1)
    },
  },
  {
    form: '動名詞',
    hit: (w) => {
      if (!ingHere(at(w, 0))) return false
      return w.slice(1).some(looksFinite)
    },
  },
  {
    /* 主語の頭が「動詞から作った名詞」か。**冠詞と形容詞を飛ばして、
       いちばん手前の名詞**を見る(`Her decision to leave …` の `decision`) */
    form: '名詞化(動詞→名詞)',
    hit: (w) => {
      let i = 0
      while (i < w.length && (DETERMINERS.has(w[i]) || NUMBER_WORDS.has(w[i]) || adjHere(w[i]))) i += 1
      const head = at(w, i)
      if (i === 0 || head.length < 7 || !NOMINAL_TAIL.test(head)) return false
      if (/ing$/.test(head)) return false
      return w.slice(i + 1).some(looksFinite)
    },
  },

  /* ── ③ 1文を後ろへ伸ばす。**名詞のかたまりのときだけ**(上の `nounFragment`)── */
  {
    form: '同格',
    hit: (w, s, t, frag) => {
      if (!frag) return false
      for (let i = 2; i < w.length - 1; i += 1) {
        if (w[i] === ',' && (DETERMINERS.has(at(w, i + 1)) || NUMBER_WORDS.has(at(w, i + 1)) || /^\d/.test(at(w, i + 1)))) return true
      }
      return false
    },
  },
  {
    form: '関係詞',
    hit: (w, s, t, frag) => frag
      && w.slice(2, -1).some((x) => x === 'that' || x === 'which' || x === 'who' || x === 'whom' || x === 'whose'),
  },
  {
    form: '現在分詞',
    hit: (w, s, t, frag) => {
      if (!frag) return false
      for (let i = 2; i < w.length - 1; i += 1) {
        if (ingHere(w[i])) return true
      }
      return false
    },
  },
  {
    form: '過去分詞',
    hit: (w, s, t, frag) => {
      if (!frag) return false
      for (let i = 2; i < w.length - 1; i += 1) {
        if (/ing$/.test(w[i]) || !isParticiple(w[i]) || NOT_PARTICIPLES.has(w[i])) continue
        if (/ly$/.test(at(w, i + 1))) continue
        return true
      }
      return false
    },
  },
]

/**
 * **見分けない型。理由をここに書く。**
 *
 * 黙って落とさない —— `frameRuleAudit()` が
 * 「規則も無く、ここにも書いていない型」を赤にする。
 */
export const SAME_SHAPE = new Map([
  ['what 節', {
    as: 'What ~ is …',
    why: 'どちらも「what 節を主語の席に置く」形で、**語の並びが1文字も違わない。**'
      + '②は「主語の席に何を入れるか」、③は「焦点を当てる」と役目で分けてあるが、'
      + '役目は英文の形に出てこない。**取り違えるくらいなら、③に寄せる。**',
  }],
])

/* ────────────────────────────────────────────────────────────────
   6. 呼び口
   ──────────────────────────────────────────────────────────────── */

/** 型の名前 → どの節・どの組か。**`sentenceFrames.js` から作る**(書き写さない) */
export const FRAME_INDEX = (() => {
  const map = new Map()
  for (const sec of FRAME_SECTIONS) {
    for (const g of sec.groups) {
      for (const r of g.rows) {
        map.set(r.form, {
          form: r.form,
          ex: r.ex,
          sectionId: sec.id,
          sectionNo: sec.no,
          sectionLabel: sec.label,
          groupId: g.id,
          groupLabel: g.label,
        })
      }
    }
  }
  return map
})()

/** 型の一覧(並びは `sentenceFrames.js` のまま。**並べ替えない**) */
export const FRAME_FORMS = [...FRAME_INDEX.keys()]

/**
 * 英文の型を見分ける。**当てられなければ `null`。**
 *
 * @param {string} text 英文(1文)
 * @returns {?object} `FRAME_INDEX` の中身と同じ形。当てられなければ null
 */
export function matchFrame(text) {
  const raw = String(text ?? '')
  if (!raw.trim()) return null
  const w = frameWords(raw)
  if (w.length < 2) return null
  const s = line(w)
  const t = takeTime(w)
  const frag = nounFragment(w, raw)
  for (const rule of FRAME_RULES) {
    if (!rule.hit(w, s, t, frag)) continue
    const found = FRAME_INDEX.get(rule.form)
    if (found) return found
  }
  return null
}

/**
 * **一度見分けた文は、覚えておく。**
 *
 * 単語帳も Quick Response 帳も**千を超える行**を持ち、
 * 絞り込みの選択肢を作るときと、絞るときの**二度**通る。
 * 描き直しのたびに 65 の規則を全部当て直すと、
 * 「CPU 2秒」(`docs/notes/04-起動と窓口と通信.md`)に近づく。
 *
 * **答えは英文だけで決まる**ので、控えていて食い違うことがない。
 */
const MEMO = new Map()
const MEMO_MAX = 4000

/** 型の名前だけ。無ければ null。**控えを引く** */
export const frameFormOf = (text) => {
  const key = String(text ?? '')
  if (!key.trim()) return null
  if (MEMO.has(key)) return MEMO.get(key)
  const form = matchFrame(key)?.form ?? null
  if (MEMO.size >= MEMO_MAX) MEMO.clear()
  MEMO.set(key, form)
  return form
}

/**
 * 規則と型の一覧が食い違っていないか。**`npm run test:frame` が毎回まわす。**
 *
 * - `missing` … 型はあるのに、規則も「見分けない」札も無い
 * - `extra`   … 規則が、`sentenceFrames.js` に無い型を指している(書き間違い)
 * - `dup`     … 同じ型に規則が2つある
 */
export function frameRuleAudit() {
  const ruled = FRAME_RULES.map((r) => r.form)
  const seen = new Set()
  const dup = []
  for (const f of ruled) {
    if (seen.has(f)) dup.push(f)
    seen.add(f)
  }
  const extra = ruled.filter((f) => !FRAME_INDEX.has(f))
  const missing = FRAME_FORMS.filter((f) => !seen.has(f) && !SAME_SHAPE.has(f))
  const strayShape = [...SAME_SHAPE.keys()].filter((f) => !FRAME_INDEX.has(f))
  return { missing, extra, dup, strayShape }
}
