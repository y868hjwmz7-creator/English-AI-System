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

/** 配列からランダムに1つ選ぶ */
function pickRandom(list) {
  if (!list.length) return null
  return list[Math.floor(Math.random() * list.length)]
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
      return pickRandom(byGender(gender)) || voices[0]
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
      if (requestedGender) return pickRandom(byGender(requestedGender)) || voices[0]
      return pickRandom(voices) || voices[0]
    }
  }
}

/** その性別の話者が使えるか(ボタンを出すかどうかの判定に使う) */
export function hasGender(voices, gender) {
  return voices.some((v) => genderOf(v) === gender)
}
