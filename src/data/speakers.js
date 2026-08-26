/**
 * お手本の話者(声)に関する情報。
 *
 * ★なぜこの表が必要か
 *   ブラウザの音声機能は、声の「性別」を教えてくれません。
 *   名前しか分からないため、既知の声について自分で対応表を持つ必要があります。
 *
 * ★将来の置き換えについて
 *   端末内蔵の声は品質に限界があるため、最終的には
 *   事前に生成した音声ファイルに置き換える方針です(仕様書 5.2)。
 *   そのときも「話者を選ぶ」という考え方はそのまま使えるよう、
 *   画面側は端末の声に直接依存せず、この表を通して扱っています。
 */

import { voiceQualityLabel } from '../lib/speech.js'

/** 配列からランダムに1つ選ぶ */
function pickRandom(list) {
  if (!list.length) return null
  return list[Math.floor(Math.random() * list.length)]
}

/**
 * ★事前に生成しておくお手本の話者(4人)
 *
 *   端末に入っている音声は品質がばらばらで、iPhone では簡易版しか
 *   使えない(仕様書 3.3.4)。そのため、練習用の英文の音声を
 *   あらかじめ生成して配信し、全端末で同じ品質にする。
 *
 *   ここに定義した4人が、アプリ上の「話者」になる。
 *   端末内蔵の音声は、生成が間に合っていない文章のための予備として残す。
 *
 *   地域訛り(スコットランド英語など)は後回し(仕様書 7.1)。
 */
export const PREGENERATED_SPEAKERS = [
  { id: 'us-female', label: 'Emma', accent: 'アメリカ英語', gender: 'female', lang: 'en-US' },
  { id: 'us-male', label: 'Ryan', accent: 'アメリカ英語', gender: 'male', lang: 'en-US' },
  { id: 'uk-female', label: 'Sophie', accent: 'イギリス英語', gender: 'female', lang: 'en-GB' },
  { id: 'uk-male', label: 'Oliver', accent: 'イギリス英語', gender: 'male', lang: 'en-GB' },
]

export const findSpeaker = (id) => PREGENERATED_SPEAKERS.find((s) => s.id === id) || null

/** 設定にもとづいて、事前生成の話者を1人決める */
export function resolvePregenerated(available, settings, requestedGender = null) {
  const pool = PREGENERATED_SPEAKERS.filter((s) => available.includes(s.id))
  if (!pool.length) return null

  const byGender = (g) => pool.filter((s) => s.gender === g)
  const byId = (id) => pool.find((s) => s.id === id)

  switch (settings.mode) {
    case 'gender': {
      const g = requestedGender || settings.gender || 'female'
      return pickRandom(byGender(g)) || pool[0]
    }
    case 'fixed':
      return byId(settings.fixedSpeakerId) || pool[0]
    case 'pair': {
      const g = requestedGender || 'female'
      const id = g === 'male' ? settings.maleSpeakerId : settings.femaleSpeakerId
      return byId(id) || pickRandom(byGender(g)) || pool[0]
    }
    case 'random':
    default:
      if (requestedGender) return pickRandom(byGender(requestedGender)) || pool[0]
      return pickRandom(pool) || pool[0]
  }
}

/** 女性の声として知られている名前 */
const FEMALE = [
  // Apple
  'samantha', 'ava', 'allison', 'susan', 'karen', 'moira', 'tessa', 'serena',
  'kate', 'fiona', 'victoria', 'nicky', 'kathy', 'agnes', 'princess',
  'grandma', 'shelley', 'flo', 'sandy',
  // Google
  'google us english', 'google uk english female',
  // Microsoft
  'microsoft zira', 'microsoft aria', 'microsoft jenny', 'microsoft michelle',
  'microsoft ana', 'microsoft sonia', 'microsoft libby', 'microsoft natasha',
]

/** 男性の声として知られている名前 */
const MALE = [
  // Apple
  'daniel', 'tom', 'aaron', 'fred', 'alex', 'oliver', 'rishi', 'gordon',
  'lee', 'junior', 'ralph', 'bruce', 'albert',
  'grandpa', 'eddy', 'reed', 'rocko',
  // Google
  'google uk english male',
  // Microsoft
  'microsoft david', 'microsoft mark', 'microsoft guy', 'microsoft ryan',
  'microsoft brian', 'microsoft christopher', 'microsoft william',
]

/**
 * 声の性別を判定する。
 * 分からない場合は 'unknown' を返し、性別で絞り込む場面では除外する。
 */
export function genderOf(voice) {
  const name = (voice.name || '').toLowerCase()
  if (FEMALE.some((n) => name.startsWith(n))) return 'female'
  if (MALE.some((n) => name.startsWith(n))) return 'male'
  return 'unknown'
}

export const genderLabel = { female: '女性', male: '男性', unknown: '不明' }

/**
 * お手本の話者の選び方。
 * 利用者が設定画面で選びます。
 */
export const SPEAKER_MODES = [
  {
    id: 'random',
    label: '毎回おまかせ',
    description: '読み上げるたびに話者が変わります。いろいろな声に耳を慣らしたい方向けです。',
  },
  {
    id: 'gender',
    label: '性別だけ指定',
    description: '選んだ性別の中から、毎回ちがう話者が読み上げます。',
  },
  {
    id: 'fixed',
    label: '話者を1人に固定',
    description: '毎回おなじ話者が読み上げます。声に慣れたい方向けです。',
  },
  {
    id: 'pair',
    label: '男女1人ずつ選ぶ',
    description: '読み上げのときに、名前のボタンでどちらか選べます。',
  },
]

/**
 * ★おまかせで選ぶときは、品質の良い声だけを対象にする
 *
 *   当初は使える声すべてから無差別に選んでいた。
 *   しかし端末には品質の異なる声が混在しており、
 *   たまたま簡易な声が当たると、お手本として使い物にならない。
 *
 *   実機で、Chrome では Google の高品質な声が入っていたにもかかわらず
 *   「毎回おまかせ」が簡易な声を選び得る状態だった。
 *
 *   対処: その端末で最も良い品質の段階だけを候補にする。
 *         声の多様性は保ちつつ、品質の下限を保証できる。
 */
const QUALITY_ORDER = ['高品質', '標準', '簡易']

function bestQualityOnly(voices) {
  if (!voices.length) return voices
  for (const tier of QUALITY_ORDER) {
    const matched = voices.filter((v) => voiceQualityLabel(v) === tier)
    if (matched.length) return matched
  }
  return voices
}



/**
 * 設定にもとづいて、実際に読み上げる声を決める。
 *
 * @param {Array} voices    使える声の一覧(品質の良い順)
 * @param {object} settings { mode, gender, fixedName, femaleName, maleName }
 * @param {string} requestedGender 読み上げ時に押されたボタンの性別('female'|'male'|null)
 */
export function resolveVoice(voices, settings, requestedGender = null) {
  if (!voices.length) return null

  const byGender = (gender) => voices.filter((v) => genderOf(v) === gender)
  const byName = (name) => voices.find((v) => v.name === name)

  switch (settings.mode) {
    case 'gender': {
      const gender = requestedGender || settings.gender || 'female'
      // 品質の下限を保証したうえで、その性別の中から選ぶ
      return pickRandom(bestQualityOnly(byGender(gender))) || voices[0]
    }
    case 'fixed':
      return byName(settings.fixedName) || voices[0]
    case 'pair': {
      const gender = requestedGender || 'female'
      const name = gender === 'male' ? settings.maleName : settings.femaleName
      return byName(name) || pickRandom(byGender(gender)) || voices[0]
    }
    case 'random':
    default: {
      // 読み上げ時に性別ボタンが押されていれば、その性別の中から選ぶ
      if (requestedGender) return pickRandom(bestQualityOnly(byGender(requestedGender))) || voices[0]
      return pickRandom(bestQualityOnly(voices)) || voices[0]
    }
  }
}

/** その性別の話者が使えるか(ボタンを出すかどうかの判定に使う) */
export function hasGender(voices, gender) {
  return voices.some((v) => genderOf(v) === gender)
}
