/**
 * 聞き流し(読み上げモード)と、音楽を流す場所 —— **算段だけ**。
 *
 * 2026-09 利用者の指定。
 *
 *   > また、これからは自作の音楽が流れるようにしたいです。
 *   > それとか音楽を流しながらどんどん登録されている単語が
 *   > 読まれるモードも欲しいですね
 *
 * ============================================================================
 * 【画面の中に書かない】
 *
 *   単語帳の画面(`Wordbook.jsx`)は Supabase を引き連れているので、
 *   **素の node で一度も走らせられない。** だから「何をどの順で読むか」と
 *   「音楽をどこで流すか」だけを、何にも依存しない形にしてある
 *   (`playMark.js` / `mp3Join.js` と同じ考え方)。
 *   `npm run test:play` が数字で見張る。
 *
 * 【2つのモードは、利用者が選んだ2つだけ】
 *
 *   > 英語だけを繰り返し、と英語→間→日本語の2モードを選べるように
 *
 *   **3つめを足さない**(`writingTones.js` の4つと同じ決まり)。
 *
 * 【費用】
 *
 *   語の読み上げは**標準の段**(Google / Azure の無料枠)で作られ、
 *   **同じ語は1回しか課金されない**(置き場所が英文の指紋で決まる)。
 *   だから2周目からは0円で、聞き流しは何時間回しても増えない。
 *   **日本語は端末の声で読む**(窓口は英語の声しか持っていない)。0円である。
 */

/**
 * 読み方は2つ。**利用者が挙げた2つ以外を足さない。**
 *
 *   | id | 何をするか | いつ向くか |
 *   |---|---|---|
 *   | `en`   | 英語を2回。日本語は出さない | 音とリズムを入れる。速く回る |
 *   | `enja` | 英語 → 間 → 日本語 | 意味を思い出す間がある |
 */
export const RADIO_MODES = [
  { id: 'en', label: '英語だけ、くり返し' },
  { id: 'enja', label: '英語 → 間 → 日本語' },
]

export const DEFAULT_RADIO_MODE = 'enja'

export const radioModeOf = (id) => RADIO_MODES.find((m) => m.id === id) ?? RADIO_MODES[1]

/** 語と語のあいだ。**続けて鳴らすと、どこで切れたのか分からない** */
export const WORD_GAP_MS = 900
/** 英語を2回読むときの、あいだ */
export const REPEAT_GAP_MS = 500
/** 英語のあと、意味を思い出すための間。**ここが `enja` のかなめ** */
export const RECALL_GAP_MS = 1400

/**
 * その1語を、どの順で読むか。
 *
 * `{ kind: 'en' | 'ja' | 'wait', text?, ms? }` を並べて返す。
 * **鳴らす側は、これをそのまま上から順に処理するだけ**でよい。
 *
 * **英語が無ければ、何も返さない。** 読むものが無い語を
 * 「読んだことにして」次へ送ると、無音の時間だけが延びる。
 * **日本語が無ければ、英語だけを読む**(`enja` を選んでいても) ——
 * 無いものをあるように見せない(CLAUDE.md)。
 *
 * @param {object} row  単語帳の1行(`display` / `word_norm` / `meaning_ja`)
 * @param {string} modeId
 */
export function radioSteps(row, modeId = DEFAULT_RADIO_MODE) {
  const en = String(row?.display || row?.word_norm || '').trim()
  if (!en) return []
  const ja = String(row?.meaning_ja || '').trim()
  const mode = radioModeOf(modeId)
  if (mode.id === 'en') {
    return [
      { kind: 'en', text: en },
      { kind: 'wait', ms: REPEAT_GAP_MS },
      { kind: 'en', text: en },
    ]
  }
  const steps = [{ kind: 'en', text: en }]
  if (ja) {
    steps.push({ kind: 'wait', ms: RECALL_GAP_MS })
    steps.push({ kind: 'ja', text: ja })
  }
  return steps
}

/** 押す前に、何が起きるかを1行で言う(`scopeLead` と同じ作法) */
export function radioLead(modeId = DEFAULT_RADIO_MODE) {
  return radioModeOf(modeId).id === 'en'
    ? '英語だけを2回ずつ読みます。意味は出しません。'
    : '英語を読んだあと少し間をおいて、日本語を読みます。'
}

/**
 * 次に読む語は何番目か。**最後まで行ったら、頭へ戻る**(聞き流し)。
 * **止まる条件は呼ぶ側が持つ**(「やめる」を押すまで)。
 */
export const nextIndex = (at, length) => (length > 0 ? (at + 1) % length : 0)

/* ==========================================================================
 * 音楽を流す場所(2026-09 利用者の指定「選べるようにしたい」)
 * ========================================================================== */

/**
 * どこで流すか。**上から順に、流れる場所が増えていく。**
 *
 * レッスン中は画面を共有するので、**切る場所を必ず用意する**
 * (いちばん上が「流さない」)。
 */
export const BGM_PLACES = [
  { id: 'off', label: '流さない', plays: [] },
  { id: 'radio', label: '聞き流しのときだけ', plays: ['radio'] },
  { id: 'review', label: '復習中も', plays: ['radio', 'review'] },
  { id: 'always', label: 'ずっと', plays: ['radio', 'review', 'app'] },
]

export const DEFAULT_BGM_PLACE = 'radio'

export const bgmPlaceOf = (id) => BGM_PLACES.find((p) => p.id === id)
  ?? BGM_PLACES.find((p) => p.id === DEFAULT_BGM_PLACE)

/**
 * いまいる場所で、音楽を流すか。
 * **判断はここ1か所** —— 画面ごとに書くと、切ったつもりで鳴り続ける。
 */
export const bgmPlaysIn = (placeId, where) => bgmPlaceOf(placeId).plays.includes(where)

const PLACE_KEY = 'eas.bgmPlace'

export function loadBgmPlace() {
  try {
    const saved = localStorage.getItem(PLACE_KEY)
    return BGM_PLACES.some((p) => p.id === saved) ? saved : DEFAULT_BGM_PLACE
  } catch { return DEFAULT_BGM_PLACE }
}

export function saveBgmPlace(id) {
  try { localStorage.setItem(PLACE_KEY, String(id)) } catch { /* 使えなくても困らない */ }
}

const MODE_KEY = 'eas.radioMode'

export function loadRadioMode() {
  try {
    const saved = localStorage.getItem(MODE_KEY)
    return RADIO_MODES.some((m) => m.id === saved) ? saved : DEFAULT_RADIO_MODE
  } catch { return DEFAULT_RADIO_MODE }
}

export function saveRadioMode(id) {
  try { localStorage.setItem(MODE_KEY, String(id)) } catch { /* 同上 */ }
}

/**
 * 音楽の大きさ。**声が鳴っているあいだは下げる**(利用者の指定
 * 「声が聞こえるよう、曲は自動で小さくします」)。
 *
 * **算段だけをここに置く。** 実際に `<audio>` を動かすのは `bgm.js`。
 */
export const BGM_VOLUME = 0.42
export const BGM_DUCKED = 0.12
export const bgmVolume = (ducked) => (ducked ? BGM_DUCKED : BGM_VOLUME)
