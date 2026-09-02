/**
 * 教材の読み上げに使える**声の名簿**。
 *
 * ============================================================================
 * 【利用者が編集するのは、この下の CLIP_VOICES だけです】
 *
 *   ElevenLabs で気に入った声を見つけたら、**1行足すだけ**です。
 *
 *     { id: 'us-3', accent: 'us', gender: 'female', use: 'narration',
 *       label: 'Rachel', elevenId: '21m00Tcm4TlvDq8ikWAM' },
 *
 *   | 欄 | 何を書くか |
 *   |---|---|
 *   | `id`       | この名簿の中だけの合言葉。**他と重ならなければ何でもよい**。`us-3` など |
 *   | `accent`   | 下の CLIP_ACCENTS の id(`us` `uk` `sc` …) |
 *   | `gender`   | `female` か `male` |
 *   | `use`      | `narration` / `conversation` / `both`。下の【向き】を参照 |
 *   | `label`    | 画面に出す名前。ElevenLabs で見えている名前のままでよい |
 *   | `elevenId` | ElevenLabs の Voice ID(⋮ → Copy voice ID) |
 *
 *   **1つの訛りに何人でも登録できます。** 3人でも5人でも構いません。
 *   会話では、その中から選んだ人が役ごとに話します。
 *
 * ============================================================================
 * 【向き(`use`)— ElevenLabs の分類をそのまま持ち込む】(2026-08 利用者の指定)
 *
 *   > ナレーションや記事の朗読向きの声と、会話向きの感情豊かな声も
 *   > カテゴリーとして分けてありました。これはアプリ内でも活用したいです。
 *
 *   ElevenLabs の一覧には「Narrative Story」「Conversational」といった
 *   分類が付いている。**あれは的を射ている。** 記事の朗読に感情豊かな声を
 *   当てると芝居がかって聞きづらく、会話に淡々としたナレーションの声を
 *   当てると人と話している感じがしない。
 *
 *   | `use` | ElevenLabs の分類のめやす | アプリのどこで出るか |
 *   |---|---|---|
 *   | `narration`    | Narrative Story / Informative Educational | 記事、文型ドリル、単語、フレーズ |
 *   | `conversation` | Conversational / Entertainment Tv         | 会話(ダイアローグ) |
 *   | `both`         | どちらにも使える、と自分で判断したもの     | 両方に出る |
 *
 *   **教材の種類で、選べる声が自動的に絞られる。** 会話を作るときは
 *   会話向きだけ、記事なら朗読向きだけが並ぶ。取り違えようがない。
 *
 *   **`id` は一度決めたら変えないこと。** 変えると、その声で作った
 *   音声の置き場所が変わり、作り直し(= 課金)になります。
 *
 * ============================================================================
 * 【なぜ Voice ID をここに書くのか】(2026-08 に方針を変えた)
 *
 *   はじめは Supabase の Secrets に置いていた。しかし声が増えると、
 *   **名前と性別はコード、id は Secrets、と2か所に分かれる。**
 *   30人ぶんを2か所でそろえるのは、いつか必ずずれる。
 *
 *   Voice ID は**鍵ではない。** ElevenLabs の声を指す番号にすぎず、
 *   これだけでは何もできない(API キーが別に要る)。
 *   だから**1か所にまとめる**ほうがよい。
 *   **API キーは Secrets のまま。** あれは鍵である。
 *
 * ============================================================================
 * 【標準の段(Google / Azure)には、この訛りが無い】
 *
 *   持っているのはほぼアメリカ英語とイギリス英語だけ。
 *   スコットランドやインドの声は無い。そこで**代役**に落とす。
 *
 *     記事・会話の本文、発音・リズムのドリル → ElevenLabs(選んだ声)
 *     それ以外の演習                        → 代役(Google / Azure)
 *
 *   代役は「アメリカ寄り(米・加)なら us、それ以外は uk」× 性別で決まる。
 *   **同じ訛り・同じ性別の声どうしは、代役を共有する。**
 *   ドリルの音声はそのぶん作り直さずに済む。
 */

/** 訛りの一覧。画面の選択肢の順番でもある */
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

export const DEFAULT_ACCENT = 'us'

/** 声の向き。教材の種類で自動的に絞る */
export const VOICE_USES = [
  { id: 'narration', label: 'ナレーション向き', hint: '記事の朗読・ドリル・単語' },
  { id: 'conversation', label: '会話向き', hint: '感情のある受け答え' },
  { id: 'both', label: 'どちらでも', hint: '両方に出る' },
]

/**
 * 教材の種類から、要る声の向きを決める。
 * **ここ1か所で決める。** 画面ごとに書くと必ず食い違う。
 */
export const voicePurposeFor = (kind) =>
  (kind === 'dialogue' ? 'conversation' : 'narration')

/** その教材に要る声の人数。会話は2人、それ以外は1人 */
export const voiceCountFor = (kind) => (kind === 'dialogue' ? 2 : 1)

export const accentLabel = (id) =>
  CLIP_ACCENTS.find((a) => a.id === id)?.label ?? id

// ============================================================================
// ★★★ ここに声を足してください ★★★
//
//   2026-09、利用者が ElevenLabs で選んだ10人を入れた。
//   足したい声があれば、下と同じ形で1行足すだけでよい。足した順に並ぶ。
//
//     { id: 'sc-1', accent: 'sc', gender: 'male', use: 'both',
//       label: 'Angus', elevenId: 'ここに Voice ID' },
//
//   **`id` は一度決めたら変えないこと。** 変えると音声の置き場所が変わり、
//   作り直し(= 課金)になる。
//
//   【`use` は、いまぜんぶ `both` にしてある】
//     ElevenLabs 側の分類(Narrative Story / Conversational)を
//     こちらでは確かめていないので、**あやふやなことを書かず**
//     「どちらでも使える」にしてある。
//     使ってみて「この声は会話向きだ」と分かったら、その行の `use` を
//     `conversation`(または `narration`)に書き換えるだけでよい。
//     そうすると、記事を作るときの選択肢から自動的に外れる。
//
//   【声を**入れ替える**ときは、CLIP_REV を進める】
//     すでにある行の `elevenId` を別の声に差し替えたときだけである。
//     **足すだけなら進めなくてよい。** 音声の置き場所は
//     `<版>/<段>/<声の id>/<英文の指紋>.mp3` で、声の id が道に入っている。
//     足しただけなら新しい道になるので、前の音声とぶつからない。
//     (進めると**すべての音声が作り直しになる。** 迂闊に進めない)
// ============================================================================
export const CLIP_VOICES = [
  // ── アメリカ ────────────────────────────────────────────
  { id: 'us-1', accent: 'us', gender: 'female', use: 'both',
    label: 'Jessica', elevenId: 'cgSgspJ2msm6clMCkdW9' },
  { id: 'us-2', accent: 'us', gender: 'male', use: 'both',
    label: 'David Esposito', elevenId: 'iEw1wkYocsNy7I7pteSN' },

  // ── イギリス ────────────────────────────────────────────
  { id: 'uk-1', accent: 'uk', gender: 'female', use: 'both',
    label: 'Sky', elevenId: 'QeRkfdkzgy4CefJ3AcII' },
  { id: 'uk-2', accent: 'uk', gender: 'female', use: 'both',
    label: 'Sophia', elevenId: 'LM5QaByxyWDmNhcQTYiS' },
  { id: 'uk-3', accent: 'uk', gender: 'male', use: 'both',
    label: 'Jofra', elevenId: 'NuRyEq0OdD9mMOyd51UZ' },
  { id: 'uk-4', accent: 'uk', gender: 'male', use: 'both',
    label: 'Henry', elevenId: 'KP6QbSvtyKSTfuh4UzcQ' },

  // ── オーストラリア ──────────────────────────────────────
  { id: 'au-1', accent: 'au', gender: 'female', use: 'both',
    label: 'Brenna', elevenId: 'L4bD71zGAYHMT7a6MLwc' },
  { id: 'au-2', accent: 'au', gender: 'female', use: 'both',
    label: 'Emma', elevenId: '56bWURjYFHyYyVf490Dp' },
  { id: 'au-3', accent: 'au', gender: 'male', use: 'both',
    label: 'Tom', elevenId: 'DYkrAHD8iwork3YSUBbs' },
  { id: 'au-4', accent: 'au', gender: 'male', use: 'both',
    label: 'Brad', elevenId: 'vVnXvLYPFjIyE2YrjUBE' },
]

// ── ここから下は仕組み。触らなくてよい ──────────────────────────

/** 標準の段(Google / Azure)がそのまま持っている声 */
export const BASE_VOICES = ['us-female', 'us-male', 'uk-female', 'uk-male']

export const DEFAULT_BASE = 'us-female'

/** 訛りと性別から、標準の段での代役を決める */
export const baseOf = (accent, gender) =>
  `${['us', 'ca'].includes(accent) ? 'us' : 'uk'}-${gender === 'male' ? 'male' : 'female'}`

export const findVoice = (id) => CLIP_VOICES.find((v) => v.id === id) ?? null

/** 名簿に無い id でも落とさない。代役だけは必ず決まる */
export const baseVoiceOf = (id) => {
  const v = findVoice(id)
  if (v) return baseOf(v.accent, v.gender)
  // 名簿に無いものは、id そのものが代役の名前かもしれない(`us-female` など)
  return BASE_VOICES.includes(id) ? id : DEFAULT_BASE
}

/** その声で ElevenLabs を使えるか(Voice ID が入っているか) */
export const elevenIdOf = (id) => String(findVoice(id)?.elevenId ?? '').trim()

/** 画面に出す名前。「Rachel(アメリカ・女性)」 */
export const voiceLabel = (id) => {
  const v = findVoice(id)
  if (!v) return id
  return `${v.label}(${accentLabel(v.accent)}・${v.gender === 'male' ? '男性' : '女性'})`
}

/** その訛りに登録されている声。向きを指定すると、その向きだけに絞る */
export const voicesOfAccent = (accent, purpose = null) => CLIP_VOICES.filter(
  (v) => v.accent === accent
    && (!purpose || v.use === purpose || v.use === 'both'),
)

/** その向きの声が1人でもいる訛り。**選べない訛りを並べない** */
export const accentsWithVoices = (purpose = null) =>
  CLIP_ACCENTS.filter((a) => voicesOfAccent(a.id, purpose).length > 0)

/**
 * おまかせ。その訛りから **n 人**を選ぶ。
 *
 * **男女が交互になるように選ぶ。** 会話で同じ性別が続くと、
 * どちらが話しているのか耳で分からない。
 *
 * 選ぶのは**教材を作るとき1回だけ**で、結果は教材に保存する。
 * 開くたびに選び直すと、**同じ教材なのに毎回ちがう声になり、
 * そのたびに音声を作り直す(= 課金される)。**
 */
export function pickVoices(accent, n = 1, purpose = null) {
  const pool = voicesOfAccent(accent, purpose)
  if (!pool.length) return []
  const shuffled = [...pool].sort(() => Math.random() - 0.5)
  const byGender = { female: shuffled.filter((v) => v.gender === 'female'),
    male: shuffled.filter((v) => v.gender === 'male') }
  const out = []
  let want = byGender.female.length >= byGender.male.length ? 'female' : 'male'
  while (out.length < n) {
    const other = want === 'female' ? 'male' : 'female'
    const pick = byGender[want].shift() ?? byGender[other].shift()
    if (!pick) break
    out.push(pick.id)
    want = other
  }
  // 人数が足りなければ、そのぶんは使い回す(黙って別の訛りにしない)
  while (out.length < n && out.length) out.push(out[out.length % out.length])
  return out
}

/**
 * 教材に保存された声の並びを、使える形に整える。
 * 空なら「その訛りの代役1人」にする(声をまだ登録していないとき)。
 */
export function resolveVoices(voiceIds, accent = DEFAULT_ACCENT) {
  const list = (voiceIds ?? []).filter((id) => findVoice(id))
  if (list.length) return list
  return [baseOf(accent, 'female')]
}
