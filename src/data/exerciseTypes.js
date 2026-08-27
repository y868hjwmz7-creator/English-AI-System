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
  { id: 'vocabulary', label: '単語', instruction: '意味を覚えてください。',
    fields: ['prompt_en', 'prompt_ja'], audioFrom: 'prompt_en' },
  { id: 'phrase', label: 'フレーズ', instruction: '場面ごと覚えてください。',
    fields: ['prompt_en', 'prompt_ja'], audioFrom: 'prompt_en' },
]

export const exerciseType = (id) => EXERCISE_TYPES.find((t) => t.id === id)
export const exerciseLabel = (id) => exerciseType(id)?.label ?? id

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
  passage: [
    { exercise_type: 'read_aloud',  count: 8 },
    { exercise_type: 'shadowing',   count: 8 },
  ],
  word:   [{ exercise_type: 'vocabulary', count: 20 }],
  phrase: [{ exercise_type: 'phrase',     count: 20 }],
}

export const defaultSectionsFor = (kind) => DEFAULT_SECTIONS[kind] ?? DEFAULT_SECTIONS.pattern
