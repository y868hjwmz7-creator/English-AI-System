/**
 * スラッシュリーディング(②)の区切り。
 *
 * 【なぜ AI に作らせないのか】
 *   利用者が挙げた決まりは、**どれも「閉じた語のリスト」で判定できる**。
 *
 *     ・前置詞＋名詞で区切る(区切りの最後に前置詞があるのは NG)
 *     ・助動詞と動詞(be going to / want to / have to など)は一区切り
 *
 *   前置詞も助動詞も**数が決まっている**ので、辞書に並べれば機械で判定できる。
 *   AI に頼めば1文ごとに課金され、しかも同じ文で毎回同じ答えが返る保証もない。
 *   **決まりで書けるものを、AI に頼まない。**
 *
 * 【「動詞の前で切る」は、当てられるぶんだけ】
 *   「初心者は動詞の前に必ずスラッシュ」は、**どれが動詞かを
 *   当てられないと書けない。** `run` は名詞にも動詞にもなる。
 *   ただし**助動詞と be動詞だけは数が決まっていて、しかも必ず動詞である。**
 *   そこだけを入れてある(強さ1なので**初級でしか出ない**)。
 *   一般の動詞は当て推量になるので、いまも扱わない。
 *   **あやふやなことを言わない。**
 *
 * 【機械で書けないもの】
 *   区切りごとの**訳**は決まりでは書けない。教材を作るときに1回だけ
 *   作って控える(`src/lib/chunkJa.js`・0021・仕様書 第5.29.3節)。
 *
 * 【レベルが上がるほど区切りは減る】(利用者の指定)
 *   区切りには「強さ」を持たせてある。
 *   初級はぜんぶ、中級は強さ2以上、上級は強さ3だけを出す。
 */
import { splitEnSentences } from './sentencePair.js'

/** 前置詞。**この語の前で切る。** 区切りの最後がこれになってはいけない */
const PREPOSITIONS = new Set([
  'about', 'above', 'across', 'after', 'against', 'along', 'among', 'around',
  'as', 'at', 'before', 'behind', 'below', 'beneath', 'beside', 'besides',
  'between', 'beyond', 'by', 'despite', 'down', 'during', 'except', 'for',
  'from', 'in', 'inside', 'into', 'like', 'near', 'of', 'off', 'on', 'onto',
  'outside', 'over', 'past', 'since', 'through', 'throughout', 'till', 'to',
  'toward', 'towards', 'under', 'underneath', 'until', 'up', 'upon', 'via',
  'with', 'within', 'without',
])

/** 接続詞・関係詞。**この語の前で切る。** ここが意味の切れ目になる */
const CONNECTORS = new Set([
  'although', 'because', 'before', 'but', 'however', 'if', 'once', 'since',
  'so', 'that', 'though', 'unless', 'until', 'when', 'whenever', 'where',
  'whereas', 'wherever', 'whether', 'which', 'while', 'who', 'whom', 'whose', 'why',
])

/**
 * 助動詞のまとまり。**この中では切らない。**
 * 「be going to」「have to」を途中で切ると、動詞と離れて訳せなくなる。
 * 長いものから順に見る(`have to` より `have got to` を先に当てる)。
 */
const AUX_GROUPS = [
  ['have', 'got', 'to'], ['be', 'going', 'to'], ['am', 'going', 'to'],
  ['is', 'going', 'to'], ['are', 'going', 'to'], ['was', 'going', 'to'],
  ['were', 'going', 'to'], ['used', 'to'], ['ought', 'to'],
  ['have', 'to'], ['has', 'to'], ['had', 'to'],
  ['want', 'to'], ['wants', 'to'], ['wanted', 'to'],
  ['need', 'to'], ['needs', 'to'], ['needed', 'to'],
  ['would', 'like', 'to'], ['be', 'able', 'to'], ['is', 'able', 'to'],
  ['are', 'able', 'to'], ['was', 'able', 'to'],
]

/** 1語の助動詞。**次の語(動詞)と離さない** */
const MODALS = new Set([
  'can', 'could', 'may', 'might', 'must', 'shall', 'should', 'will', 'would',
  'do', 'does', 'did', 'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had',
])

/** 冠詞・限定詞。**この語のあとで切らない。** 名詞と離れる */
const DETERMINERS = new Set([
  'a', 'an', 'the', 'this', 'that', 'these', 'those', 'my', 'your', 'his',
  'her', 'its', 'our', 'their', 'some', 'any', 'no', 'every', 'each', 'both',
])

/* ────────────────────────────────────────────────────────────────
   ★ ここから下は「ゲストに 💬 で注意する」ためだけの語のリストである。
     上のリスト(模範を組み立てるためのもの)と**わざと別にしてある。**

   【なぜ分けるのか】(2026-08 実機で誤判定を2つ出した)

     ・`Apps like this / let a trader …` に **「this は名詞と離さない」**
       → ここの `this` は**代名詞**であって冠詞ではない。区切ってよい
     ・`pull in / more than five thousand viewers` に **「in の前で区切る」**
       → ここの `in` は `pull in` の**副詞(句動詞の一部)**であって
         前置詞ではない。区切ってよい

   どちらも「前置詞にも副詞にもなり得る語」「冠詞にも代名詞にもなり得る語」
   を、語のリストだけで前置詞・冠詞と決めつけたために起きた。
   利用者が `before` について書いたことが、そのまま当てはまる。

     > 他にも前置詞にも副詞にもなり得る単語で同じケースがあれば
     > それらについても OK

   **注意するのは、取り違えようのない語だけにする。**
   見逃しても害は小さいが、**間違った注意は、何も言われないより困る**
   (「あやふやなことを言わない」)。

   模範を組み立てる側(`idealSlashes`)は、広いリストのままにしてある。
   狭めると模範の区切りが増え、**教材に控えたカタマリごとの訳(0021)と
   数が合わなくなって、訳が丸ごと出なくなる。**
   ──────────────────────────────────────────────────────────────── */

/**
 * **句動詞のかたまり**(2026-08 利用者の指定で足した)。
 *
 *   > 句動詞、たとえば Get up at 6am. だとしたら、Get up / at 6am です。
 *   > この場合の up は前置詞ではなく、副詞であり、get とセットとして
 *   > 考えるべきです。文中の pull in も同じことです。
 *
 * **動詞と副詞のあいだで切らない。** `Get / up at 6am.` は間違い。
 *
 * 【なぜ「動詞のリスト × 副詞のリスト」にしないのか】
 *   同じ語が、句動詞の副詞にも前置詞にもなる。
 *
 *   | 副詞(切らない) | 前置詞(切ってよい) |
 *   |---|---|
 *   | `pull in` の in | `run in the park` の in |
 *   | `get up` の up | `go up the stairs` の up |
 *   | `look over` の over | `fly over the city` の over |
 *
 *   掛け合わせると、**正しい区切りを咎めてしまう。**
 *   だから **「動詞 + 副詞」の対そのもの**を並べる。
 *   数は多いが閉じたリストなので、AI に頼む理由はない(この仕組みの原則)。
 *   **あやふやなものは入れない。** 見逃しても害は小さいが、
 *   間違った注意は何も言われないより困る。
 */
const PHRASAL_PAIRS = new Set([
  // **前置詞を取る動詞は入れない**(`work on the report` `look after the kids`
  //  `stand by the door` `go over the plan`)。あれは前置詞句なので、
  //  `work / on the report` と切ってよい。入れると正しい区切りを咎める
  'get up', 'get out', 'get off', 'get back', 'get away', 'get along',
  'give up', 'give back', 'give out', 'give away', 'give in',
  'take off', 'take out', 'take over', 'take on', 'take back', 'take away',
  'put on', 'put off', 'put out', 'put up', 'put away', 'put back', 'put down',
  'pick up', 'pick out',
  'set up', 'set out', 'set off', 'set aside',
  'turn on', 'turn off', 'turn out', 'turn up', 'turn down', 'turn around',
  'look up', 'look out', 'look forward',
  'find out', 'figure out', 'work out',
  'carry out', 'carry on',
  'bring in', 'bring up', 'bring back', 'bring about', 'bring out',
  'hand in', 'hand out', 'hand over',
  'call off', 'call back', 'call up',
  'come back', 'come up', 'come out', 'come in', 'come along',
  'go out', 'go back', 'go ahead',
  'run out', 'break down', 'break up', 'break out',
  'cut off', 'cut down', 'cut out',
  'fill in', 'fill out', 'fill up',
  'hold up', 'hold back',
  'keep up', 'keep on', 'keep out', 'keep away',
  'let out', 'let down', 'let in',
  'make up', 'make out',
  'move on', 'move in', 'move out',
  'pass on', 'pass out', 'pay off', 'pay back', 'point out',
  'pull in', 'pull out', 'pull up', 'pull off', 'pull back',
  'push back', 'push through',
  'send out', 'send back', 'send in', 'send off',
  'shut down', 'shut off', 'sort out',
  'stand up', 'stand out',
  'start over', 'start up', 'scale up', 'scale down',
  'throw away', 'throw out', 'try out', 'try on', 'use up', 'wake up',
  'write down', 'write up', 'write out',
  'clean up', 'close down', 'follow up', 'follow through',
  'hang up', 'hang on', 'hang out', 'help out',
  'lay off', 'lay out', 'leave out', 'leave behind', 'line up',
  'log in', 'log out', 'log on', 'open up', 'print out', 'read out',
  'save up', 'show up', 'show off',
  'sign up', 'sign in', 'sign out', 'sign off',
  'speak up', 'speak out', 'split up',
  'switch on', 'switch off', 'switch over',
  'tear down', 'tear up', 'tidy up', 'wrap up', 'warm up', 'wind up',
  'back up', 'check in', 'check out', 'drop off', 'drop out',
  'end up', 'kick off', 'knock out', 'roll out', 'sum up',
])

/** 対の先頭にある動詞(語幹)。活用を戻すときの当たり先にする */
const PHRASAL_VERBS = new Set([...PHRASAL_PAIRS].map((p) => p.split(' ')[0]))

/** 対のうしろにある副詞。ここが来たときだけ調べればよい */
const PHRASAL_PARTICLES = new Set([...PHRASAL_PAIRS].map((p) => p.split(' ')[1]))

/**
 * 動詞の活用を語幹に戻す(`getting` → `get`)。**辞書は使わない。**
 * 戻した先が句動詞の動詞でなければ、そのまま返す(当たらないだけ)。
 */
const stem = (word) => {
  const b = String(word ?? '').toLowerCase().replace(/[^a-z]/g, '')
  if (PHRASAL_VERBS.has(b)) return b
  const tries = [
    b.replace(/ies$/, 'y'), b.replace(/ied$/, 'y'),
    b.replace(/([bcdfghjklmnpqrstvwxz])\1(ing|ed)$/, '$1'),
    b.replace(/ing$/, ''), b.replace(/ing$/, 'e'),
    b.replace(/ed$/, ''), b.replace(/ed$/, 'e'),
    b.replace(/es$/, ''), b.replace(/s$/, ''),
  ]
  return tries.find((t) => t !== b && PHRASAL_VERBS.has(t)) ?? b
}

/**
 * その位置(i 語目の**前**)が、句動詞のかたまりの内側かどうか。
 * `Get up` の `up` の前なら `Get up` を返す。
 */
function insidePhrasal(words, i) {
  if (i <= 0 || i >= words.length) return null
  const here = String(words[i] ?? '').toLowerCase().replace(/[^a-z]/g, '')
  if (!PHRASAL_PARTICLES.has(here)) return null
  const verb = stem(words[i - 1])
  return PHRASAL_PAIRS.has(`${verb} ${here}`) ? `${words[i - 1]} ${words[i]}` : null
}

/**
 * **必ず前置詞**である語。副詞にも動詞にもならない。
 *
 * `in` `on` `up` `down` `off` `out` `over` `by` `about` `across` `along`
 * `around` `through` `past` `near` `behind` `under` は**句動詞の副詞**に
 * なる(`pull in` `give up` `look over`)。
 * `before` `after` `since` `until` は**副詞・接続詞**にもなる。
 * `like` は**動詞**にもなる(`I like / this`)。**どれも入れない。**
 */
const SURE_PREPS = new Set([
  'of', 'for', 'from', 'with', 'without', 'within', 'into', 'onto', 'upon',
  'at', 'to', 'during', 'among', 'amongst', 'between', 'against',
  'toward', 'towards', 'despite', 'via', 'throughout',
  'beside', 'besides', 'beneath', 'underneath', 'unlike',
])

/**
 * **必ず冠詞・限定詞**である語。代名詞にはならない。
 *
 * 利用者が挙げた NG は「**冠詞**と名詞の間」である。
 * `this` `that` `these` `those` `some` `any` `each` `both` は**代名詞**にもなり
 * (`Apps like this / let …`)、`his` `her` は**目的語の代名詞**にもなる。
 * **入れない。**
 */
const SURE_DETERMINERS = new Set([
  'a', 'an', 'the', 'my', 'your', 'our', 'their', 'its', 'every',
])

/**
 * **必ず助動詞**である語。本動詞にはならない。
 *
 * `have` `has` `had` `do` `does` `did` は**本動詞**にもなる
 * (`I have / two things`)。`is` `are` `was` `were` も
 * `The problem is / that we are late.` のようにカタマリを終えてよい。
 * **入れない。** 複数語のまとまり(`have to` など)は `AUX_GROUPS` が見る。
 */
const SURE_MODALS = new Set([
  'can', 'could', 'may', 'might', 'must', 'shall', 'should', 'will', 'would',
])

/**
 * **副詞**。`-ly` で終わる語で見分ける(2026-08 に足した)。
 *
 * 【なぜ足したか】(利用者の指定)
 *   > そもそもの訳を作成するときにあらゆる可能性を考えた区切り方にして、
 *   > 全て訳が英文に対して中央に寄るようになれば完璧です。
 *
 *   訳は**控えの切れ目でしか分けられない。** 自分の区切りがそこに無いと、
 *   2つのカタマリぶんの訳がまとめて出て、英語に対して右へずれて見える
 *   (`suddenly started asking` の前で切ったとき・実機)。
 *   **控えを細かく作っておけば、どこで切っても真下に来る。**
 *
 *   `friendly` `lovely` `likely` `early` `only` `ugly` `silly` は
 *   **形容詞**なので入れない。
 */
const LY_ADJECTIVES = new Set([
  'friendly', 'lovely', 'likely', 'unlikely', 'early', 'only', 'ugly',
  'silly', 'lonely', 'lively', 'daily', 'weekly', 'monthly', 'yearly',
  'costly', 'deadly', 'elderly', 'orderly', 'timely', 'holy', 'ally',
  'apply', 'reply', 'supply', 'family', 'rely', 'imply', 'multiply',
])

/** `-ly` で終わらない、よく出る副詞。ここも切れ目にしておく */
const PLAIN_ADVERBS = new Set([
  'almost', 'always', 'never', 'often', 'sometimes', 'still', 'already',
  'soon', 'again', 'instead', 'together', 'however', 'therefore',
  'meanwhile', 'nevertheless', 'moreover', 'furthermore', 'otherwise',
])

const isAdverb = (w) => PLAIN_ADVERBS.has(w)
  || (/^[a-z]{5,}ly$/.test(w) && !LY_ADJECTIVES.has(w))

/**
 * **前置詞の目的語になる代名詞**(2026-08 利用者の指定)。
 *
 *   > 「アプリがこのようなものは…」の部分は、「このようなアプリは」で
 *   > あるべきです。代名詞が目的語のパターンのカタマリも
 *   > 事前に準備する区切りとして実装してください。
 *
 * `Apps / like this / let …` と切ると、`Apps` だけのカタマリができ、
 * 訳が「アプリが」「このようなものは…」と分かれてしまう。
 * **`like this` は前の名詞にかかる2語のかたまり**なので、
 * `Apps like this / let …` と、うしろにまとめて切る。
 *
 * `her` `his` は**冠詞にもなる**(`of her regular customers`)ので入れない。
 * `one` も `about one / of …` と切れたほうが自然なので入れない。
 */
const OBJECT_PRONOUNS = new Set([
  'this', 'that', 'these', 'those', 'it', 'them', 'him', 'us', 'me', 'you',
])

/** 主語になる代名詞。**ここから新しいまとまりが始まることが多い** */
const SUBJECT_PRONOUNS = new Set(['i', 'you', 'he', 'she', 'it', 'we', 'they'])

/**
 * **形容詞**(2026-08 利用者の指定で足した)。
 *
 *   > 形容詞と名詞の間に区切りを入れても注意されません。
 *   > これは注意するように変えるべきです。ただ、気をつけるべきは、
 *   > I am happy / because I've passed an exam. みたいに
 *   > 後ろが名詞ではない場合は OK であるべきです。
 *
 * 【入れるのは、ほかの品詞にならない語だけ】
 *   `clean` `open` `close` `light` `free` は**動詞**、
 *   `right` `kind` `second` は**名詞**、
 *   `hard` `fast` `late` `high` `just` `only` `well` は**副詞**にもなる。
 *   **どれも入れない**(取り違えると、正しい区切りを咎める)。
 *   `-er` `-est` は語幹に戻して当てる(`safer` → `safe`)。
 */
const ADJECTIVES = new Set([
  'able', 'afraid', 'angry', 'anxious', 'available', 'awful', 'beautiful',
  'boring', 'brave', 'brief', 'bright', 'brilliant', 'busy', 'calm',
  'careful', 'cheap', 'clever', 'comfortable', 'common', 'competitive',
  'complex', 'complicated', 'confident', 'confusing', 'convenient',
  'crowded', 'curious', 'dangerous', 'delicious', 'detailed', 'difficult',
  'dirty', 'dramatic', 'eager', 'easy', 'effective', 'efficient', 'elegant',
  'empty', 'enormous', 'enthusiastic', 'essential', 'excellent', 'expensive',
  'familiar', 'famous', 'fantastic', 'flexible', 'formal', 'fortunate',
  'frequent', 'fresh', 'friendly', 'frightening', 'funny', 'generous',
  'gentle', 'global', 'gorgeous', 'grateful', 'happy', 'healthy', 'heavy',
  'helpful', 'honest', 'horrible', 'huge', 'hungry', 'ideal', 'impatient',
  'important', 'impossible', 'impressive', 'incredible', 'independent',
  'informal', 'intelligent', 'interesting', 'international', 'jealous',
  'lazy', 'legal', 'lively', 'lonely', 'loud', 'lovely', 'lucky',
  'massive', 'messy', 'modern', 'narrow', 'nervous', 'noisy', 'normal',
  'obvious', 'official', 'ordinary', 'original', 'painful', 'patient',
  'peaceful', 'perfect', 'personal', 'polite', 'poor', 'popular',
  'possible', 'powerful', 'practical', 'precise', 'previous', 'professional',
  'proud', 'quiet', 'rapid', 'rare', 'realistic', 'reasonable', 'recent',
  'relevant', 'reliable', 'remarkable', 'responsible', 'rich', 'ridiculous',
  'risky', 'rude', 'sad', 'safe', 'scary', 'secure', 'sensible', 'sensitive',
  'serious', 'severe', 'significant', 'silly', 'similar', 'simple',
  'sincere', 'slow', 'small', 'smart', 'sorry', 'special', 'specific',
  'stable', 'steady', 'strange', 'strict', 'strong', 'stupid', 'successful',
  'sudden', 'suitable', 'surprising', 'sustainable', 'talented', 'tasty',
  'terrible', 'thirsty', 'tiny', 'tired', 'traditional', 'typical', 'ugly',
  'unable', 'uncomfortable', 'unhappy', 'unusual', 'urgent', 'useful',
  'useless', 'usual', 'valuable', 'various', 'violent', 'wealthy', 'weird',
  'wonderful', 'worried', 'worthy', 'young',
  // よく出るもの。**動詞・名詞・副詞にもなる語は入れない**
  // (`clean` `open` `light` `right` `kind` `hard` `fast` `late` `high` など)
  'new', 'old', 'big', 'large', 'great', 'short', 'good', 'bad', 'nice',
  'warm', 'cold', 'hot', 'quick', 'full', 'wide', 'tall', 'thick', 'thin',
  'sharp', 'smooth', 'sweet', 'soft', 'weak', 'tough', 'main', 'major',
  'minor', 'whole', 'entire', 'extra', 'final', 'initial', 'single',
  'double', 'total', 'digital', 'financial', 'technical', 'medical',
  'political', 'social', 'economic', 'physical', 'mental', 'natural',
  'national', 'local', 'regional', 'private', 'current', 'annual',
  'basic', 'central', 'commercial', 'creative', 'critical', 'cultural',
  'daily', 'weekly', 'monthly', 'yearly', 'digital', 'direct', 'domestic',
  'electronic', 'external', 'internal', 'foreign', 'historical',
  'industrial', 'initial', 'legal', 'logical', 'moral', 'multiple',
  'mutual', 'negative', 'positive', 'potential', 'primary', 'rural',
  'scientific', 'secondary', 'strategic', 'temporary', 'urban', 'virtual',
  'visual', 'weekly',
])

/**
 * 形が不規則な過去分詞。`-ed` で終わらないので、当てるには並べるしかない。
 * **`a broken / window` を咎める**ために要る。
 * 単なる過去形と同じ形のものも入っているが、`isParticiple` を使う側で
 * 「冠詞や形容詞のうしろ」に限っているので、`He lost / the game` は咎めない。
 */
const IRREGULAR_PARTICIPLES = new Set([
  'broken', 'written', 'given', 'taken', 'spoken', 'chosen', 'driven',
  'frozen', 'hidden', 'known', 'shown', 'thrown', 'worn', 'torn', 'born',
  'lost', 'made', 'built', 'sent', 'kept', 'held', 'told', 'sold', 'felt',
  'left', 'meant', 'paid', 'done', 'seen', 'grown', 'drawn', 'blown',
])

/**
 * **つなぎの動詞**。このあとの形容詞は「述語」なので、
 * そこでカタマリを終えてよい(`I am happy / because …`)。
 */
const LINKING_VERBS = new Set([
  'be', 'am', 'is', 'are', 'was', 'were', 'been', 'being',
  'seem', 'seems', 'seemed', 'look', 'looks', 'looked',
  'feel', 'feels', 'felt', 'become', 'becomes', 'became',
  'stay', 'stays', 'stayed', 'remain', 'remains', 'remained',
  'sound', 'sounds', 'sounded', 'appear', 'appears', 'appeared',
  'taste', 'tastes', 'smell', 'smells', 'prove', 'proves', 'proved',
  'grew', 'grow', 'grows', 'getting', 'got', 'gets',
])

/** 形容詞の前に立つ副詞。`is very happy /` でも述語だと分かるようにする */
const DEGREE_WORDS = new Set([
  'very', 'so', 'too', 'quite', 'really', 'pretty', 'rather', 'extremely',
  'fairly', 'incredibly', 'especially', 'particularly', 'always', 'still',
  'already', 'not', 'never', 'more', 'most', 'less', 'least',
])

/** 形容詞かどうか。`safer` `safest` は `safe` に戻して見る */
const isAdjective = (w) => {
  if (ADJECTIVES.has(w)) return true
  for (const t of [w.replace(/er$/, ''), w.replace(/est$/, ''),
    w.replace(/er$/, 'e'), w.replace(/est$/, 'e'),
    w.replace(/ier$/, 'y'), w.replace(/iest$/, 'y')]) {
    if (t !== w && ADJECTIVES.has(t)) return true
  }
  return false
}

/** `-ing` / `-ed` の分詞。名詞の前に付けば形容詞のはたらきをする */
const isParticiple = (w) => /^[a-z]{4,}(ing|ed)$/.test(w) || IRREGULAR_PARTICIPLES.has(w)

/**
 * **カタマリの先頭にしか立てない語**(2026-08 利用者の指定で足した)。
 *
 * 接続詞・関係詞のうち、**ほかの品詞にならないもの**だけを入れてある。
 * `and / the report` のように、この語でカタマリを終えると、
 * 次のまとまりを引き連れる語だけが前に取り残される。
 *
 * `once` `before` `since` `until` `when` `where` `so` は**副詞にもなる**
 * (「以前」「そのとき」など)ので、**入れない。**
 * `that` も**代名詞**になる(`Apps like that / let …`)ので入れない。
 * `while` は**名詞**にもなる(`a while`)ので、直前が冠詞のときは咎めない。
 */
const HEAD_WORDS = new Set([
  'and', 'or', 'but', 'nor',
  'which', 'who', 'whom', 'whose',
  'because', 'although', 'though', 'unless', 'whether', 'if', 'while', 'whereas',
])

/** 文の終わり(`.` `?` `!`)。**ここでの区切りは、いつでも正しい** */
const endsSentence = (w) => /[.!?…]["'”’)\]]*$/.test(String(w ?? ''))

/** 読点(`,` `;` `:`)。ここも意味の切れ目なので、**いつでも正しい** */
const endsClause = (w) => /[,;:]["'”’)\]]*$/.test(String(w ?? ''))

/** 所有格(`the company's` の `'s`)。**次の名詞と離さない** */
const isPossessive = (w) => /['’]s$/i.test(String(w ?? '').replace(/[^A-Za-z'’]+$/, ''))

/**
 * レベルごとの出し方。
 *
 * **上級ほど区切りが減る**(利用者の指定)。減らし方は2つ組み合わせる。
 *   `min`   … 区切りの強さ。弱いものから消える
 *   `least` … **カタマリの最小の語数。** これより短くなる区切りは消す
 *
 * 語の種類だけで決めると、初級と中級がほとんど同じになる(実測)。
 * 「大きく区切る」は要するに**カタマリが長くなる**ことなので、
 * 語数でも絞るほうが、レベルの差がそのまま見た目に出る。
 */
export const LEVEL_RULE = {
  beginner: { min: 1, least: 1 },
  middle: { min: 2, least: 3 },
  advanced: { min: 3, least: 5 },
}

/** レベルの選択肢。**上級ほど区切りが減る**(利用者の指定) */
export const SLASH_LEVELS = [
  { id: 'beginner', label: '初級', hint: 'こまかく区切る。前から訳す型を覚える段階' },
  { id: 'middle', label: '中級', hint: '意味のまとまりで区切る' },
  { id: 'advanced', label: '上級', hint: '大きく区切る。長い区切りのまま前から読む' },
]

/** 英単語だけを取り出す(記号は語に付けたまま持つ) */
export function wordsOf(sentence) {
  return String(sentence ?? '').trim().split(/\s+/).filter(Boolean)
}

/**
 * 記号を落とした小文字。`don't` の `'` は残す。
 *
 * **数字や記号が混じった語は、語のリストに当てない**(2026-08 実測)。
 * 前は前後の記号だけを落としていたので、`6am` が **`am`(be動詞)**になり、
 * `at / 6am` という、自分の決まりに反する区切りを模範が作っていた。
 * `5,000` `24-year-old` も同じ。**当たらないほうが安全**なので空を返す。
 */
const bare = (w) => {
  const t = String(w ?? '').toLowerCase().replace(/^[^a-z0-9']+|[^a-z0-9']+$/g, '')
  return /^[a-z']+$/.test(t) ? t : ''
}

/**
 * その位置(i 語目の**前**)が、助動詞のまとまりの内側かどうか。
 * 内側なら切ってはいけない。
 */
function auxGroupAt(words, i) {
  for (const group of AUX_GROUPS) {
    for (let start = Math.max(0, i - group.length + 1); start < i; start += 1) {
      if (start + group.length <= i) continue
      const hit = group.every((g, k) => bare(words[start + k]) === g)
      if (hit) return group.join(' ')
    }
  }
  return null
}

/**
 * 模範を組み立てるときに「ここでは切らない」とする位置。
 *
 * **ゲストへの注意より広い。** 模範は1つの案なので、あやしいところは
 * はじめから出さないほうがよい。狭めると模範の区切りが増え、
 * **教材に控えたカタマリごとの訳(0021)と数が合わなくなる。**
 */
function insideAux(words, i) {
  const group = auxGroupAt(words, i)
  if (group) return group
  // 助動詞1語 + 動詞。あいだで切らない
  if (i > 0 && MODALS.has(bare(words[i - 1]))) return bare(words[i - 1])
  return null
}

/**
 * 模範の区切り。**語と語のあいだの番号**の集合を返す
 * (1 なら「1語目と2語目のあいだ」)。
 *
 * @returns {{at: number, strength: number, why: string}[]}
 */
export function idealSlashes(sentence) {
  const words = wordsOf(sentence)
  const out = []
  const add = (at, strength, why) => {
    if (at <= 0 || at >= words.length) return
    // **模範の側は、広いリストのまま。** ここを狭めると模範の区切りが増え、
    // 教材に控えたカタマリごとの訳(0021)と数が合わなくなって、
    // 訳が丸ごと出なくなる。ゲストへの注意(`slashProblem`)より
    // 常に厳しくしておけば、**模範が自分の決まりを破ることはない**
    // (`npm run test:chunk` の1本目がそれを見張っている)
    if (insideAux(words, at)) return                  // 助動詞と動詞は離さない
    if (insidePhrasal(words, at)) return              // 句動詞は動詞と副詞で1つ
    // 冠詞のあとで切らない(広いほう)。ただし **前置詞 + 代名詞** のあとは別。
    // `Apps like this / let …` の `this` は冠詞ではなく代名詞である(2026-08)
    const objPronoun = OBJECT_PRONOUNS.has(bare(words[at - 1]))
      && PREPOSITIONS.has(bare(words[at - 2] ?? ''))
    if (!objPronoun && DETERMINERS.has(bare(words[at - 1]))) return
    // **ゲストに注意するのと同じ決まりも通す。** 控えを細かくしたことで、
    // `An elderly man / who / usually …` のように接続詞のあとで切れる場面が
    // 出てきた(2026-08 実測)。模範が自分の決まりを破ってはいけない
    if (slashProblem(words, at)) return
    const found = out.find((x) => x.at === at)
    if (found) { if (strength > found.strength) { found.strength = strength; found.why = why } return }
    out.push({ at, strength, why })
  }

  // **文の切れ目。** ここが切れないと、段落の中で文がつながって出る
  // (「the ride? Can you」が1つのカタマリになっていた・2026-08 実測)。
  // 切り方は読み上げ・Quick Response と同じものを使う。**2か所に持たない**
  let n = 0
  for (const sent of splitEnSentences(sentence)) {
    n += wordsOf(sent).length
    add(n, 3, '文の切れ目')
  }

  words.forEach((w, i) => {
    const b = bare(w)
    // 読点のあと。**いちばん強い切れ目**
    if (/[,;:]$/.test(w)) add(i + 1, 3, '読点のあと')
    // **句動詞のあと**(2026-08 利用者の指定)。
    // `Some streams pull in / more than five thousand viewers` と切れるように
    if (insidePhrasal(words, i)) add(i + 1, 1, '句動詞のあと')
    // 接続詞・関係詞の前。ここから意味が変わる
    if (CONNECTORS.has(b)) add(i, 3, `${b} の前(ここから意味が変わる)`)
    // **前置詞 + 代名詞**は、前の名詞にかかる2語のかたまり(2026-08)。
    // ここでは切らず、**そのうしろで切る**(`Apps like this / let …`)
    else if (PREPOSITIONS.has(b) && OBJECT_PRONOUNS.has(bare(words[i + 1] ?? ''))) {
      add(i + 2, 1, `${b} + 代名詞のあと`)
    }
    // 前置詞の前。**前置詞＋名詞でひとかたまり**
    else if (PREPOSITIONS.has(b)) add(i, b === 'of' ? 1 : 2, `${b} の前(前置詞＋名詞でひとかたまり)`)
    // 副詞の前・主語の代名詞の前(2026-08)。**控えを細かくしておく**ため。
    // 強さ1なので初級でしか出ないが、訳を控える単位は初級である。
    // ここが細かいほど、ゲストがどこで切っても訳が真下に来る
    else if (isAdverb(b) || SUBJECT_PRONOUNS.has(b)) add(i, 1, `${b} の前`)
    // **名詞のうしろに立つ `-ing`**(`phone scams / targeting elderly people`)。
    // 助動詞のあと(`is spreading`)や冠詞のあとは、`add()` が断る
    else if (/^[a-z]{5,}ing$/.test(b) && !isAdjective(b)) add(i, 1, `${b} の前`)
    // 助動詞・be動詞の前。**主語と動詞を切って、動詞から先に訳す**
    //
    // 利用者の指定「初心者は動詞の前に必ずスラッシュ」のうち、
    // **機械で当てられるぶんだけ**を入れてある。一般の動詞は語のリストでは
    // 当てられない(`run` は名詞にも動詞にもなる)が、
    // **助動詞と be動詞は数が決まっていて、しかも必ず動詞である。**
    // 強さ1なので**初級でしか出ない。** 初心者向けの決まりだからである
    else if (MODALS.has(b)) add(i, 1, `${b} の前(主語と動詞を切り、動詞から先に訳す)`)
  })

  return out.sort((a, b) => a.at - b.at)
}

/** そのレベルで出す区切りだけに絞る */
export function slashesFor(sentence, level = 'beginner') {
  const rule = LEVEL_RULE[level] ?? LEVEL_RULE.beginner
  const total = wordsOf(sentence).length
  const strong = idealSlashes(sentence).filter((s) => s.strength >= rule.min)

  // 短いカタマリを作る区切りを、前から順に落としていく。
  // **強い区切り(読点・接続詞)は落とさない。** そこは意味の切れ目である
  const kept = []
  let from = 0
  for (const s of strong) {
    const short = s.at - from < rule.least
    if (short && s.strength < 3) continue
    kept.push(s)
    from = s.at
  }
  // 最後のカタマリが短くなりすぎたら、直前の区切りをやめる
  const last = kept[kept.length - 1]
  if (last && total - last.at < rule.least && last.strength < 3) kept.pop()
  return kept
}

/**
 * その位置(i 語目の**前**)に区切りを入れてよいか。
 * **駄目なときだけ**、理由を返す。よければ `null`。
 *
 * 【なぜ1か所にまとめるのか】
 *   同じ判定を「模範を作るとき」と「ゲストの区切りを見るとき」の2か所に
 *   書くと、必ず食い違う。**模範が自分の決まりに違反する**という形で出る。
 *   `npm run test:chunk` はそれを見張っているが、そもそも1つにしておく。
 *
 * 【貫いている考え方】(2026-08 利用者の指定)
 *   > 前置詞を区切りの最後に置く / 冠詞と名詞の間に区切りを置く /
 *   > 前置詞と冠詞の間に区切りを置く
 *
 *   どれも **「うしろの語にかかる語で、カタマリを終えない」** という
 *   1つのことの言い換えである。前置詞・冠詞・助動詞・接続詞・所有格は、
 *   単独では意味をなさず、次の語と組になって初めて訳せる。
 *
 * 【文の切れ目は、いつでも正しい】(利用者の指定)
 *   > 「以前」という意味の副詞として before が使用され、文の最後に置かれ、
 *   > ピリオドが続き、そのピリオドとその後の文の始まりの間に区切りを
 *   > 置くことは何ら問題はありません。他にも前置詞にも副詞にもなり得る
 *   > 単語で同じケースがあればそれらについても OK
 *
 *   `before` `after` `since` `over` `in` … は前置詞にも副詞にもなる。
 *   **どちらで使われているかは語のリストでは当てられない。**
 *   しかし**文が終わっていれば、それは前置詞ではありえない**(前置詞なら
 *   うしろに名詞が要る)。だから **`.` `?` `!` と読点のあとは、
 *   何が来ていても正しい**として、いっさい咎めない。
 *   これは当て推量ではなく、記号から確実に分かることである。
 */
/**
 * その形容詞が「述語」かどうか。**つなぎの動詞が2語前までにあるか**で見る。
 * `is happy` `feels very safe` `looks really tired` を拾う。
 */
function predicative(words, i) {
  for (let k = 2; k <= 3; k += 1) {
    const w = bare(words[i - k] ?? '')
    if (!w) continue
    if (LINKING_VERBS.has(w)) return true
    // あいだにあってよいのは、程度をあらわす副詞だけ
    if (k === 2 && !DEGREE_WORDS.has(w)) return false
  }
  return false
}

/**
 * その語は、カタマリの先頭に立つ**機能語**か。
 * 形容詞のうしろがこれなら、名詞にかかっているのではない
 * (`happy / because …` `safer / than …` `good / at …`)。
 */
function startsChunk(w) {
  return !w || PREPOSITIONS.has(w) || CONNECTORS.has(w) || MODALS.has(w)
    || HEAD_WORDS.has(w) || w === 'than' || w === 'as' || w === 'to'
}

export function slashProblem(words, i) {
  if (i <= 0 || i >= words.length) return null
  const raw = words[i - 1]
  // **文の切れ目・読点のあとは、いつでも正しい。**(上記・利用者の指定)
  if (endsSentence(raw) || endsClause(raw)) return null

  const prev = bare(raw)
  const next = bare(words[i] ?? '')

  // ⓪ 句動詞のかたまりの途中(2026-08 利用者の指定)。
  //    `Get / up at 6am.` は間違い。`Get up / at 6am.` が正しい
  const phrasal = insidePhrasal(words, i)
  if (phrasal) {
    return {
      at: i,
      short: `${phrasal} は切らない`,
      text: `「${phrasal}」は句動詞です。ここの「${words[i]}」は前置詞ではなく副詞で、`
        + `動詞とセットで1つの意味になります。あいだでは区切りません。`,
    }
  }
  // ① 助動詞のまとまりの途中(be going to / have to / 助動詞 + 動詞)。
  //    **複数語のまとまりと、取り違えようのない助動詞だけ。**
  //    `have` `do` `is` は本動詞にもなるので咎めない(上の注を参照)
  const aux = auxGroupAt(words, i) || (SURE_MODALS.has(prev) ? prev : null)
  if (aux) {
    return {
      at: i,
      short: `${aux} は切らない`,
      text: `「${aux}」の途中で区切れています。助動詞と動詞はひとかたまりで訳します。`,
    }
  }
  // ② 区切りの最後が前置詞になっている(利用者の明示した NG)
  if (SURE_PREPS.has(prev)) {
    // **前置詞と冠詞のあいだ**は、同じことだが言い方を変えたほうが分かりやすい
    const detail = DETERMINERS.has(next)
      ? `前置詞「${raw}」と冠詞「${words[i]}」のあいだで区切れています。`
        + `「${raw} ${words[i]} …」でひとかたまりです。`
      : `「${raw}」で区切りが終わっています。`
        + `前置詞＋名詞でひとかたまりなので、${raw} の前で区切ります。`
    return { at: i, short: `${raw} の前で区切る`, text: detail }
  }
  // ③ 冠詞のあとで切っている
  if (SURE_DETERMINERS.has(prev)) {
    return {
      at: i,
      short: `${raw} は名詞と離さない`,
      text: `冠詞「${raw}」のあとで区切れています。冠詞と名詞のあいだは切りません。`,
    }
  }
  // ④ 所有格('s)のあとで切っている。冠詞と同じで、次の名詞にかかる
  if (isPossessive(raw)) {
    return {
      at: i,
      short: `${raw} は名詞と離さない`,
      text: `「${raw}」は次の名詞にかかります。あいだでは区切りません。`,
    }
  }
  // ⑥ 形容詞・分詞と、そのうしろの名詞を離している(2026-08 利用者の指定)
  //
  //   > 形容詞と名詞の間に区切りを入れても注意されません。
  //   > ただ、I am happy / because … みたいに後ろが名詞ではない場合は OK
  //
  //   **形容詞が「述語」なら、そこで終えてよい。**
  //   見分け方は3つで、どれか当てはまれば咎めない。
  //     ・つなぎの動詞が2語前までにある(`is happy /` `feels very safe /`)
  //     ・うしろが**機能語**(前置詞・接続詞・助動詞・`than` `as`)
  //     ・文の切れ目・読点のあと(この関数の先頭で弾いてある)
  //
  //   分詞(`-ing` / `-ed`)は、**冠詞や形容詞のうしろに立つとき**だけ見る。
  //   `a broken / window` は咎めるが、`I saw some people / dancing …` は
  //   咎めない(利用者の指定。うしろから名詞を修飾する分詞は、
  //   **切っても切らなくてもよい**)。
  const attributive = isAdjective(prev)
    || (isParticiple(prev)
      && (DETERMINERS.has(bare(words[i - 2] ?? '')) || isAdjective(bare(words[i - 2] ?? ''))))
  if (attributive && !predicative(words, i) && !startsChunk(next)) {
    return {
      at: i,
      short: `${raw} は名詞と離さない`,
      text: `「${raw}」はうしろの名詞にかかっています。`
        + `形容詞と名詞のあいだでは区切りません。`,
    }
  }
  // ⑤ 接続詞・関係詞でカタマリを終えている。**次のまとまりの先頭に置く**
  //    `a while` `the while` は名詞なので、そこは咎めない
  const nounWhile = prev === 'while' && DETERMINERS.has(bare(words[i - 2] ?? ''))
  if (HEAD_WORDS.has(prev) && !nounWhile) {
    return {
      at: i,
      short: `${raw} の前で区切る`,
      text: `「${raw}」でカタマリが終わっています。`
        + `接続詞や関係詞は、次のまとまりの先頭に置きます。`,
    }
  }
  return null
}

/**
 * ゲストが入れた区切りを見て、直したほうがよいところを言う。
 *
 * **決まりで確かめられることだけを言う。** あやふやなことは言わない。
 * 「たぶん違う」と言われるほうが、何も言われないより困る。
 *
 * **`short` は吹き出しに出す一言。** その場に出すものなので短く。
 * `text` は詳しい言い方で、触れたときに出す(`title`)。
 */
export function checkSlashes(sentence, marks) {
  const words = wordsOf(sentence)
  return [...new Set(marks)].sort((a, b) => a - b)
    .map((i) => slashProblem(words, i))
    .filter(Boolean)
    .map((n) => ({ ...n, kind: 'ng' }))
}

/** 区切りを入れた文を、カタマリの配列にする */
export function chunksOf(sentence, marks) {
  const words = wordsOf(sentence)
  const at = [...new Set(marks)].filter((i) => i > 0 && i < words.length).sort((a, b) => a - b)
  const out = []
  let from = 0
  for (const i of [...at, words.length]) {
    if (i > from) out.push(words.slice(from, i).join(' '))
    from = i
  }
  return out
}

/**
 * ゲストが入れた区切りを、**1本ずつその場で判定する**(2026-08 利用者の指定)。
 *
 * 【模範と比べるのは、やめた】(2026-08 利用者の判断)
 *
 *   > そもそもが区切り方を比べる自体が難しいです。視覚からパッと入って
 *   > 来ません。比べる気も起こりません。そして、区切り方は、ルールとして
 *   > 決めたこと以外、正解はないからです。
 *
 *   以前は「模範にもある(緑)/ 決まりに反する(赤)/ 模範には無い(灰)」の
 *   3通りに分け、「あと N か所」まで出していた。**これは採点である。**
 *   けれども区切り方に正解は無く、模範は決まりから作った1つの案にすぎない。
 *   案と違うだけのものを灰色で並べ、足りない数まで数えると、
 *   **決まりに反している1本**が、その中に埋もれてしまう。
 *
 *   **言うのは「決まりに反している」ことだけにする。** それ以外は何も言わない。
 *
 * @returns {{at: {[n]: {state: 'ng'|'plain', why: string, short: string}}, ng: number}}
 */
export function judgeSlashes(sentence, marks) {
  const words = wordsOf(sentence)
  const at = {}
  let ng = 0
  for (const i of [...new Set(marks)].sort((a, b) => a - b)) {
    const bad = slashProblem(words, i)
    if (bad) { at[i] = { state: 'ng', why: bad.text, short: bad.short }; ng += 1 }
    else at[i] = { state: 'plain', why: '', short: '' }
  }
  return { at, ng }
}
