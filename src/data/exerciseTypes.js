/**
 * 演習の種類。
 *
 * 実際のドリルは「教材=1つの文法ポイント」の中に、
 * 和訳・穴埋め・英訳・リスニングといった演習が並ぶ形をしている。
 * 種類ごとに、使う欄とゲストへの見せ方が違う。
 *
 * fields … その演習で使う欄。作成画面はこれを見て入力欄を出し分ける。
 * audioFrom … お手本音声を作る元にする欄。null なら音声を作らない。
 */
export const EXERCISE_TYPES = [
  {
    id: 'translate_en_ja', label: '英文和訳',
    instruction: '次の英文を日本語に訳しなさい。',
    fields: ['prompt_en', 'answer'], audioFrom: 'prompt_en',
    hideAnswerFromLearner: true,
  },
  {
    id: 'fill_blank', label: '穴埋め',
    instruction: 'カッコ内の語を使って文を完成させなさい。',
    fields: ['prompt_en', 'hint', 'answer'], audioFrom: null,
    hideAnswerFromLearner: true,
  },
  {
    id: 'translate_ja_en', label: '和文英訳',
    instruction: '次の日本語を英語にしなさい。',
    fields: ['prompt_ja', 'answer', 'answer_alt'], audioFrom: 'answer',
    hideAnswerFromLearner: true,
  },
  {
    id: 'listening', label: 'リスニング + 理解',
    instruction: '英文は見ずに聞くこと。聞いたあとの質問に答えなさい。',
    fields: ['audio_text', 'question', 'answer'], audioFrom: 'audio_text',
    hideAnswerFromLearner: true, hidePromptFromLearner: true,
  },
  // ── 本文(まとまった1本)────────────────────────────────
  //
  // article と dialogue は「設問」ではなく「読み物」である。
  // 1つの演習の中に段落(または発言)が順に並び、それで1本になる。
  // ゲストはこの本文に対して、音読・オーバーラッピング・シャドーイング・
  // リピーティングを行う。**取り組み方は本文の中で切り替える。**
  // 以前は取り組み方ごとに演習を分けていたため、まとまった文章にならず、
  // 短い英文が並ぶだけになっていた(仕様書 第5.17節)。
  {
    id: 'article', label: '記事',
    instruction: '記事を読んでください。声に出す練習は、下のボタンで切り替えられます。',
    fields: ['prompt_en', 'prompt_ja'], audioFrom: 'prompt_en',
    isPassage: true,
  },
  {
    id: 'dialogue', label: '会話',
    instruction: '会話を読んでください。役を決めて声に出すと効果が上がります。',
    fields: ['speaker', 'prompt_en', 'prompt_ja'], audioFrom: 'prompt_en',
    isPassage: true,
  },
  {
    id: 'comprehension', label: '内容の理解',
    instruction: '本文の内容について、英語で答えなさい。',
    // 設問も英語なので、読み上げを付ける。「音声はどんな場面でも欲しい」
    // という要望による(2026-08)。聞き取れないと設問自体が壁になる。
    fields: ['question', 'answer'], audioFrom: 'question',
    hideAnswerFromLearner: true,
  },
  {
    id: 'vocab_note', label: '本文に出た語句',
    instruction: '本文に出てきた語句です。意味と使い方を確かめてください。',
    fields: ['prompt_en', 'prompt_ja', 'note'], audioFrom: 'prompt_en',
  },

  // ── 旧「長文」で使っていたもの ────────────────────────────
  // 新規では使わない。既存の教材を読むために残してある。
  {
    id: 'read_aloud', label: '音読',
    instruction: 'お手本を聞いてから音読してください。',
    fields: ['prompt_en', 'prompt_ja'], audioFrom: 'prompt_en',
  },
  {
    id: 'overlapping', label: 'オーバーラッピング',
    instruction: 'お手本に重ねて読んでください。',
    fields: ['prompt_en', 'prompt_ja'], audioFrom: 'prompt_en',
  },
  {
    id: 'shadowing', label: 'シャドーイング',
    instruction: 'お手本を追いかけて声に出してください。',
    fields: ['prompt_en', 'prompt_ja'], audioFrom: 'prompt_en',
  },
  {
    id: 'repeating', label: 'リピーティング',
    instruction: 'お手本を聞いてから、1文ずつ繰り返してください。',
    fields: ['prompt_en', 'prompt_ja'], audioFrom: 'prompt_en',
  },
  // 単語・フレーズには**発音記号を入れる**(0020、2026-08 利用者の指定)。
  // 発音の練習に使う教材なのに、どう読むのかが書いていなかった
  { id: 'vocabulary', label: '単語', instruction: '意味を覚えてください。',
    fields: ['prompt_en', 'phonetic', 'prompt_ja'], audioFrom: 'prompt_en' },
  { id: 'phrase', label: 'フレーズ', instruction: '場面ごと覚えてください。',
    fields: ['prompt_en', 'phonetic', 'prompt_ja'], audioFrom: 'prompt_en' },
]

export const exerciseType = (id) => EXERCISE_TYPES.find((t) => t.id === id)
export const exerciseLabel = (id) => exerciseType(id)?.label ?? id

/**
 * 数え方の単位。**本文は「問」で数えない。**
 * 記事は段落、会話は発言である(仕様書 第5.17節)。
 * 「会話(14 問)」と書くと、14個の設問があるように読めてしまう。
 */
export const countUnit = (id) => (id === 'article' ? '段落' : id === 'dialogue' ? '発言' : '問')

/** 「14 発言」「10 問」のような表示 */
export const countLabel = (id, n) => `${n} ${countUnit(id)}`

/** 欄の日本語名と入力の目安 */
export const FIELD_LABELS = {
  prompt_en:  { label: '英文(問題)',   placeholder: 'I have several things to do.' },
  prompt_ja:  { label: '日本語(問題)', placeholder: '今日やるべきことがたくさんあります。' },
  hint:       { label: '与える語',     placeholder: 'reply to' },
  question:   { label: '設問',         placeholder: 'How many things does the speaker need to do?' },
  answer:     { label: '解答',         placeholder: '会議の前にやるべきことがいくつかあります。' },
  answer_alt: { label: '別解(改行区切り)', placeholder: 'I have many things to do today.' },
  audio_text: { label: '読み上げる英文', placeholder: 'I have three things to do before I leave.' },
  note:       { label: '補足',         placeholder: 'reply to an email なので、最後の to を落とさない。' },
  speaker:    { label: '話す人',       placeholder: 'Sarah (Product Manager)' },
}

/**
 * 教材の種類ごとの、既定の演習構成と問数。
 *
 * 文型ドリルの「4演習 × 10問 = 40問」は、実物のドリルに合わせた数字
 * (仕様書 第5.13.3節)。量は定着の条件なので、既定として下げない。
 * トレーナーが増減できる。
 */
export const DEFAULT_SECTIONS = {
  pattern: [
    { exercise_type: 'translate_en_ja', count: 10 },
    { exercise_type: 'fill_blank',      count: 10 },
    { exercise_type: 'translate_ja_en', count: 10 },
    { exercise_type: 'listening',       count: 10 },
  ],
  // リーディングは「記事1本」。count は段落の数であって、問題の数ではない。
  // 6段落でおよそ 250〜350 語になる。シャドーイングに使うには、
  // これくらいの長さが要る(短い文の寄せ集めでは練習にならない)。
  reading: [
    { exercise_type: 'article',       count: 6 },
    { exercise_type: 'comprehension', count: 5 },
    { exercise_type: 'vocab_note',    count: 8 },
  ],
  // ダイアローグは「会話1本」。count は発言の数。
  // 14往復ぶんで、場面がひととおり成立する長さになる。
  dialogue: [
    { exercise_type: 'dialogue',      count: 14 },
    { exercise_type: 'comprehension', count: 4 },
    { exercise_type: 'vocab_note',    count: 6 },
  ],
  word:   [{ exercise_type: 'vocabulary', count: 20 }],
  phrase: [{ exercise_type: 'phrase',     count: 20 }],
  // 旧「長文」。新規では選べないが、既存の教材を開くために残す
  passage: [
    { exercise_type: 'read_aloud',  count: 8 },
    { exercise_type: 'shadowing',   count: 8 },
  ],
}

/**
 * 本文(記事・会話)の演習かどうか。
 *
 * 本文は「問数」で数えない。段落や発言がいくつあっても1本の読み物である。
 * 弱点で分割してはいけないのも、この演習である。
 */
export const isPassageSection = (typeId) => !!exerciseType(typeId)?.isPassage

export const defaultSectionsFor = (kind) => DEFAULT_SECTIONS[kind] ?? DEFAULT_SECTIONS.pattern

/**
 * **文型ドリルの4演習**(2026-09 利用者の指定)。
 *
 *   > 文型トレーニングでは、すべての設問を基本10問にしてください。
 *   > 教材ひとつで40問。そして各ページの問題数を(中略)調整できるように
 *
 * 既定は10問のまま(4演習 × 10問 = 40問)。**既定を下げない**のは
 * 第5.13.3節の決まりである。増やす道だけを足してある。
 * **ここだけ3倍(30問)まで選べる**(弱点が3つまで選べるため)。
 */
export const DRILL_SECTIONS = [
  'translate_en_ja', 'fill_blank', 'translate_ja_en', 'listening',
]

/**
 * **数を増やせる演習**(2026-09 利用者の指定)。
 *
 *   > 内容理解の質問を増やしたいとき、語句を増やしたいときは
 *   > 教材作成のところで指定できるようにしてください。
 *   > ディフォルトの数またはその倍という感じの2パターン指定できると最高です。
 *
 * **本文(記事・会話)は入れない。** あちらの count は段落数・発言数で、
 * 増やすと読み物の長さそのものが変わる。長さは第5.13節で決めてある。
 * 増やすのは**本文に対して作る設問と語句**、そして**文型ドリルの4演習**である。
 */
export const SCALABLE_SECTIONS = [
  'comprehension', 'vocab_note',
  ...DRILL_SECTIONS,
]

/**
 * その教材の「1つの演習の問数」(2026-09 利用者の指定)。
 *
 *   > また、絞り込みでも指定できるように
 *
 * **本文(記事・会話)は数えない。** あちらは段落数・発言数であって、
 * 問数ではない(`isPassageSection`)。
 * 数え方をここに1つだけ置く。**画面ごとに書き写さない。**
 */
export const drillCount = (sections) => (sections ?? [])
  .filter((s) => !isPassageSection(s.exercise_type))
  .reduce((max, s) => Math.max(max, s.items?.length ?? s.count ?? 0), 0)

/**
 * 10問・20問・30問のどれか。**細かい数では絞らせない**(選ぶ手間が増える)。
 * 30問まであるのは、**弱点を3つまで指定できる**からである(下記)。
 */
export const drillBucket = (sections) => {
  const n = drillCount(sections)
  if (n >= 25) return '30'
  return n >= 15 ? '20' : '10'
}

/**
 * 増やし方。**細かい数は選ばせない**(選ぶ手間が増えるだけ)。
 *
 * 【なぜ3倍(30問)まであるのか】(2026-09 利用者の指定)
 *
 *   > 30問までにしてください。なぜなら弱点を3つまで指定できるからです
 *
 *   弱点は3つまで選べる。窓口はその弱点に**できるだけ均等に**問を配る
 *   (`generate-material`)ので、1つの弱点に10問ずつ当てるには
 *   **30問**が要る。20問では、弱点3つのときに1つあたり6〜7問になる。
 *
 * **3倍が出るのは文型ドリルの4演習だけ**(`amountsFor`)。
 * 記事・会話の設問と語句は、これまでどおり標準か倍の2つである
 * (2026-09 の指定「ディフォルトの数またはその倍という感じの2パターン」)。
 */
export const AMOUNTS = [
  { id: 'default', label: '標準', times: 1 },
  { id: 'double', label: '倍', times: 2 },
  { id: 'triple', label: '3倍', times: 3 },
]

/** その演習で選べる増やし方。**3倍は文型ドリルだけ** */
export const amountsFor = (typeId) => (DRILL_SECTIONS.includes(typeId)
  ? AMOUNTS
  : AMOUNTS.filter((a) => a.id !== 'triple'))

/**
 * **1つの演習の上限。** 窓口(`generate-material`)も同じ数で丸める。
 * **片方だけ変えない。** 画面に出した数と実際の数が食い違う
 * (窓口を配置し直すまでは、20問より多くは作られない)。
 */
export const MAX_ITEMS = 30

/**
 * 既定の構成に、増やし方をかぶせる。
 *
 * @param {string} kind 教材の種類
 * @param {object} amounts `{ comprehension: 'double', ... }`
 *
 * **上限は `MAX_ITEMS`(30)。** 窓口(`generate-material`)も同じ数で
 * 丸めるので、**片方だけ変えない。**
 */
export const sectionsFor = (kind, amounts = null) =>
  defaultSectionsFor(kind).map((s) => {
    if (!SCALABLE_SECTIONS.includes(s.exercise_type)) return s
    const pick = amounts?.[s.exercise_type]
    const times = AMOUNTS.find((a) => a.id === pick)?.times ?? 1
    if (times === 1) return s
    return { ...s, count: Math.min(s.count * times, MAX_ITEMS) }
  })
