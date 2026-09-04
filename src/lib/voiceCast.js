/**
 * 会話の登場人物に、**それぞれ別の声**を割り当てる。
 *
 * 【なぜ必要か】
 *   会話の教材は2人が交互に話す。ところが読み上げは全部同じ声だったため、
 *   **どちらが話しているのか耳で分からなかった**(2026-08 の指摘)。
 *   シャドーイングは「その人になりきって言う」練習なので、
 *   声が分かれていないと役を追えない。
 *
 * 【どう決めるか】
 *   1. 名前から性別を推測する(下の一覧。**あくまで手がかり**)
 *   2. 推測できないときは、**出てくる順に女性・男性と交互**に割り当てる
 *   3. 同じ声を2人に割り当てない。声が足りなければ、そのときだけ使い回す
 *
 *   **名前からの推測は外れることがある。** 一覧に無い名前は交互になる。
 *   確実にするなら、生成のときに人物の性別も返させる必要がある
 *   (いまは行っていない。出力が増えるため)。
 */
import { DEFAULT_BASE, baseOf, resolveVoices, voiceLabel } from '../data/clipVoices.js'
import { genderOf } from '../data/speakers.js'

/** 女性名としてよく使われるもの(手がかり。網羅は目指さない) */
const FEMALE_NAMES = [
  'aiko', 'akiko', 'amy', 'ana', 'anna', 'anne', 'aya', 'ayaka', 'beth', 'carol',
  'chie', 'chloe', 'clara', 'diana', 'elena', 'emily', 'emma', 'erika', 'eri',
  'grace', 'hana', 'hannah', 'haruka', 'julia', 'kaori', 'karen', 'kate', 'keiko',
  'laura', 'linda', 'lisa', 'lucy', 'mai', 'maria', 'mari', 'mary', 'maya', 'megan',
  'mika', 'miki', 'nana', 'naomi', 'natsuki', 'nina', 'noriko', 'olivia', 'rachel',
  'rie', 'rina', 'sachiko', 'sakura', 'sara', 'sarah', 'sophie', 'sophia', 'susan',
  'tomoko', 'yui', 'yuka', 'yuki', 'yumi', 'yuri',
]

/** 男性名としてよく使われるもの(同上) */
const MALE_NAMES = [
  'aaron', 'adam', 'akira', 'alex', 'andrew', 'ben', 'brian', 'carlos', 'chris',
  'daichi', 'daniel', 'dave', 'david', 'eric', 'george', 'hiroshi', 'ian', 'james',
  'jason', 'john', 'josh', 'ken', 'kenji', 'kevin', 'kenta', 'liam', 'luke', 'mark',
  'masa', 'masaru', 'michael', 'mike', 'nathan', 'noah', 'oliver', 'paul', 'peter',
  'ryan', 'ryo', 'ryota', 'sam', 'shota', 'steve', 'takashi', 'taro', 'tom', 'tomo',
  'william', 'yuta', 'yusuke',
]

/** 「Naomi (QA Engineer)」→「naomi」 */
export const speakerKey = (speaker) => String(speaker ?? '').trim().toLowerCase()

/** 「Naomi (QA Engineer)」→「naomi」(肩書きを落とした下の名前) */
const firstName = (speaker) => speakerKey(speaker).split('(')[0].trim().split(/\s+/)[0] ?? ''

/** 名前から性別を推測する。分からなければ 'unknown' */
export function guessGender(speaker) {
  const name = firstName(speaker)
  if (!name) return 'unknown'
  if (FEMALE_NAMES.includes(name)) return 'female'
  if (MALE_NAMES.includes(name)) return 'male'
  return 'unknown'
}

/**
 * 出てくる順に、話す人と性別を決める。
 *
 * **端末の声にも、こちらで作った音声にも、同じ決め方を使う。**
 * 別々に書くと、同じ会話なのに経路によって役の性別が入れ替わる。
 *
 * @returns {Array<{name: string, gender: 'female'|'male'}>}
 */
function assignGenders(speakers) {
  const names = []
  for (const s of speakers ?? []) {
    const k = speakerKey(s)
    if (k && !names.includes(k)) names.push(k)
  }
  // 推測できない人には、女性・男性を交互に当てる。
  // 先に決まった人の性別を見て、次はその逆から探す。
  let nextGuess = 'female'
  return names.map((name) => {
    let gender = guessGender(name)
    if (gender === 'unknown') gender = nextGuess
    nextGuess = gender === 'female' ? 'male' : 'female'
    return { name, gender }
  })
}

/**
 * 話す人ごとの**端末の声**を決める。
 *
 * @param {Array} voices  loadEnglishVoices() の結果(良い順に並んでいる)
 * @param {Array<string>} speakers 出てくる順の話す人(重複していてよい)
 * @returns {Map<string, SpeechSynthesisVoice>} 話す人 → 声
 */
export function castVoices(voices, speakers) {
  const cast = new Map()
  if (!voices?.length) return cast

  const pool = (gender) => voices.filter((v) => genderOf(v) === gender)
  const used = new Set()
  const take = (list) => list.find((v) => !used.has(v.name))

  for (const { name, gender } of assignGenders(speakers)) {
    const picked = take(pool(gender))
      ?? take(pool(gender === 'female' ? 'male' : 'female'))
      ?? take(voices)
      ?? voices[0]
    if (picked) {
      cast.set(name, picked)
      used.add(picked.name)
    }
  }
  return cast
}

/**
 * 話す人ごとに、**教材に選んだ声を順に配る。**
 *
 * 【なぜ「順に」なのか】(2026-08 利用者の指定)
 *   > 会話となると最低でも2人ずつ、または3人ずついると良い気がします
 *
 *   教材には声の**並び**が入っている(`materials.voice_ids`、0017)。
 *   トレーナーが「話す人1 / 話す人2」として選んだ順そのものなので、
 *   **出てくる順にそのまま当てる。** 名前から性別を推測して当て直すと、
 *   選んだとおりにならず、なぜそうなったのか説明できない。
 *
 *   声が足りないときは先頭に戻って使い回す。**黙って別の訛りにしない。**
 *
 * @param {Array<string>} speakers 出てくる順の話す人(重複していてよい)
 * @param {Array<string>} voiceIds 教材に選んだ声の並び
 * @returns {Map<string, string>} 話す人 → 声 id
 */
export function castClipSpeakers(speakers, voiceIds = null) {
  const list = resolveVoices(voiceIds)
  const cast = new Map()
  const names = []
  for (const sp of speakers ?? []) {
    const k = speakerKey(sp)
    if (k && !names.includes(k)) names.push(k)
  }
  names.forEach((name, i) => cast.set(name, list[i % list.length]))
  return cast
}

/** 話す人に合う声。割り当てが無ければ既定の声を返す */
export const voiceFor = (cast, speaker, fallback = null) =>
  cast.get(speakerKey(speaker)) ?? fallback

/**
 * 端末の声から、**こちらで作った音声の話者**を決める。
 *
 * 【なぜ要るか】(2026-08)
 *   iPhone では良い声を出せないため、教材の読み上げは
 *   こちらで作った MP3 に切り替えた(`audioClips.js`)。
 *   ところが画面はこれまで「端末の声」を持ち回っている。
 *   会話の役ごとの声も、`castVoices()` が端末の声で割り当てている。
 *
 *   **画面の作りを変えずに切り替えられるように**、
 *   端末の声から性別と訛りだけを読み取り、同じ組み合わせの話者に移す。
 *   女性の声には女性を、イギリス英語にはイギリス英語を当てる。
 *
 *   `castVoices()` は男女を交互に割り当てるので、会話の2人は
 *   **ここを通しても別々の話者になる。** 役を耳で追えることは保たれる。
 *
 * 【外れたときも困らない】
 *   性別が分からない声は女性に寄せる。声が1つも無い端末では既定に落ちる。
 *   お手本として不自然になることはない。
 */
export function clipSpeakerFor(voice) {
  if (!voice) return DEFAULT_BASE
  const gender = genderOf(voice) === 'male' ? 'male' : 'female'
  const accent = /^en-gb/i.test(voice.lang ?? '') ? 'uk' : 'us'
  return baseOf(accent, gender)
}

/**
 * ============================================================================
 * 教材のカードに出す **「誰がどの声で読むか」の1行。**
 *
 * 【なぜ要るか】(2026-09 利用者の指定)
 *
 *   > この「クラスに出る」の Mika 役の声を今後使用しないように
 *   > 変更を加えてください。
 *
 *   声そのものに癖があることは、**聞いた人にしか分からない。**
 *   ところが声は教材に id で保存されているだけで、
 *   **どの声だったのかを見る場所がどこにも無かった。**
 *
 * 【なぜここに置くか】(2026-09 実機・2手め)
 *
 *   > Mikaの音声が誰なのか確認できません
 *
 *   はじめは `TrainerMaterials.jsx` の中に書き、
 *   **`voice_ids` が空なら何も出さない**ことにしていた。
 *   けれども空でも音は鳴る —— `castClipSpeakers()` が
 *   `resolveVoices()` で**代役に落とす**からである。
 *   つまり「出す声はあるのに、名前だけが出ない」状態で、
 *   **いちばん知りたいときに何も出なかった。**
 *
 *   **鳴るなら、必ず名前が出る。** 判断は `castClipSpeakers()` に任せ、
 *   ここでは何も数え直さない(数え直すと、画面に出す名前と
 *   実際に鳴る声がずれる)。
 *
 *   画面から切り離してあるので、**素の node で確かめられる**
 *   (`npm run test:voice`)。画面の中に書くと、一度も走らせられない。
 *
 * @param {object} material `normalizeMaterial()` を通した教材
 * @returns {string|null} 「Mika = Jessica(アメリカ・女性) / …」
 */
export function castLine(material) {
  /* **会議の本文も `dialogue` である**(演習の種類は増やしていない)。
     だから、ここは1つ見るだけで会話にも会議にも効く */
  const body = (material?.sections ?? [])
    .find((sec) => sec.exercise_type === 'dialogue')
  if (!body) return null

  /* 出てきた順に、**元の表記のまま**並べる。
     `castClipSpeakers()` が返す鍵は小文字にそろえた形なので、
     そのまま出すと「mika」になってしまう */
  const names = []
  for (const it of body.items ?? []) {
    const sp = String(it.speaker ?? '').trim()
    if (sp && !names.includes(sp)) names.push(sp)
  }
  if (!names.length) return null

  const ids = material?.voiceIds ?? material?.voice_ids
  const cast = castClipSpeakers(names, ids)
  return names
    .map((n) => `${n.split(' (')[0]} = ${voiceLabel(voiceFor(cast, n))}`)
    .join(' / ')
}
