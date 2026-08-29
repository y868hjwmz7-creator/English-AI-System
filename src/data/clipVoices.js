/**
 * 教材の読み上げに使える**声の一覧**。
 *
 * ============================================================================
 * 【なぜ要るか】(2026-08 利用者の指定)
 *
 *   > ElevenLabs の声を決めたら、教材作成の際に好きな声を選べるように
 *   > 出来ますか？ アクセントの種類が恐らく10くらい、それに男女、
 *   > くらいで選ぼうと思っています
 *
 *   ビジネス英語では、**相手の訛りが聞き取れないと仕事にならない。**
 *   インド・シンガポール・スコットランドの英語は、教科書の
 *   アメリカ英語しか聞いていないと歯が立たない。
 *   教材ごとに相手を変えられることには、それ自体に練習の価値がある。
 *
 * ============================================================================
 * 【この表が持つもの / 持たないもの】
 *
 *   持つ  … id・画面に出す名前・アクセント・性別・標準の段での代役
 *   持たない … **ElevenLabs の声の id。** あれは利用者が選ぶものであり、
 *              Supabase の Secrets(`ELEVENLABS_VOICES`)に置く。
 *              選び直すたびにコードを触ることになってはいけない
 *
 *   つないでいるのは **この表の id** だけである。Secrets の JSON の鍵を
 *   ここの id と同じにすれば結びつく。**同じ情報を2か所に持たない。**
 *
 * ============================================================================
 * 【標準の段には、この訛りは無い】
 *
 *   Google と Azure が持っているのは、ほぼアメリカ英語とイギリス英語だけ。
 *   スコットランドやジャマイカの声は無い。
 *   そこで各行に **`base`(標準の段での代役)** を持たせてある。
 *
 *     記事・会話の本文、発音・リズムのドリル → ElevenLabs(選んだ訛り)
 *     それ以外の演習                        → base の声(Google / Azure)
 *
 *   1本の教材の中で声が変わるが、**演習が変われば声も変わってよい。**
 *   本文とドリルは、そもそも別の取り組みである。
 *
 * ============================================================================
 * 【アクセントを増やすと、音声も増える】
 *
 *   置き場所の鍵は(段, 話者, 英文)である。同じ英文を3つの訛りで作れば
 *   **3倍かかる。** 教材ごとに1つ選ぶ、という使い方を崩さないこと。
 *
 * ============================================================================
 * 【この一覧は、利用者が決めるもの】
 *
 *   下は**たたき台**である。ビジネスで出会う相手を想定して10並べてある。
 *   利用者が ElevenLabs で声を選んだら、**この表を作り直してよい。**
 *   `id` を変えると、その声で作った音声は作り直しになる(鍵が変わるため)。
 */

/** 訛りの並び。画面の選択肢の順番でもある */
export const CLIP_ACCENTS = [
  { id: 'us', label: 'アメリカ',        hint: '標準。既定はこれ' },
  { id: 'uk', label: 'イギリス',        hint: 'RP(容認発音)' },
  { id: 'au', label: 'オーストラリア',  hint: '母音が大きく動く' },
  { id: 'ca', label: 'カナダ',          hint: 'アメリカに近い' },
  { id: 'ie', label: 'アイルランド',    hint: 'r を強く読む' },
  { id: 'sc', label: 'スコットランド',  hint: '巻き舌の r。聞き取りが難しい' },
  { id: 'in', label: 'インド',          hint: '取引先で出会いやすい' },
  { id: 'sg', label: 'シンガポール',    hint: '同上。アジアの英語' },
  { id: 'nz', label: 'ニュージーランド', hint: 'オーストラリアに近い' },
  { id: 'za', label: '南アフリカ',      hint: '母音が独特' },
]

export const accentLabel = (id) =>
  CLIP_ACCENTS.find((a) => a.id === id)?.label ?? id

/** 性別。**話す人の役を分けるためのもの**で、それ以上の意味は持たせない */
export const CLIP_GENDERS = [
  { id: 'female', label: '女性' },
  { id: 'male', label: '男性' },
]

/**
 * 声の一覧。訛り × 男女。
 *
 * `base` は標準の段(Google / Azure)での代役。
 * `us-female` / `us-male` / `uk-female` / `uk-male` の4つは、
 * 標準の段がそのまま持っている声なので、自分自身が代役になる。
 */
export const CLIP_VOICES = CLIP_ACCENTS.flatMap((accent) =>
  CLIP_GENDERS.map((gender) => ({
    id: `${accent.id}-${gender.id}`,
    accent: accent.id,
    gender: gender.id,
    label: `${accent.label}(${gender.label})`,
    // 標準の段では、アメリカ寄りは us、イギリス諸島・その他は uk に寄せる
    base: `${['us', 'ca'].includes(accent.id) ? 'us' : 'uk'}-${gender.id}`,
  })),
)

/** 標準の段(Google / Azure)がそのまま持っている声 */
export const BASE_VOICES = ['us-female', 'us-male', 'uk-female', 'uk-male']

export const DEFAULT_VOICE_ID = 'us-female'

export const findVoice = (id) => CLIP_VOICES.find((v) => v.id === id) ?? null

export const voiceLabel = (id) => findVoice(id)?.label ?? id

/** 使える id に丸める。知らない id が来ても落とさない */
export const clipVoiceId = (id) => (findVoice(id) ? id : DEFAULT_VOICE_ID)

/** 標準の段で使う代役。知らない id なら既定 */
export const baseVoiceOf = (id) => findVoice(id)?.base ?? DEFAULT_VOICE_ID

/** その訛りの、指定した性別の声 */
export const voiceOf = (accent, gender) =>
  CLIP_VOICES.find((v) => v.accent === accent && v.gender === gender)?.id
  ?? DEFAULT_VOICE_ID
