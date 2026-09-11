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
 * 読み方。**いまは「英語だけ」1つである。**
 *
 * ══════════════════════════════════════════════════════════════════
 * **日本語を読み上げる道は、外した**(2026-09 実機・利用者の指定)
 *
 *   > 日本語入りはいらないですね!こえの質が悪すぎます!
 *
 * 【なぜ質が悪いのか。直しようが無かった】
 *   英語は**こちらで作った MP3**(ElevenLabs)を鳴らしている。
 *   ところが**窓口は英語の声しか持っていない**ので、日本語だけは
 *   **端末の声**(`speechSynthesis`)で読ませていた。
 *   あれは端末まかせで、
 *
 *     ・iPhone は**良い声を Web Speech API に一切公開しない**
 *       (CLAUDE.md「iOS の録音」の節。実機で premium 0 件)
 *     ・会社PC(Windows / Chrome)の声も端末しだいで、こちらから選べない
 *
 *   **こちらから直せるつまみが1つも無い。** 英語と並べて鳴らすと、
 *   質の差がそのまま耳につく。
 *
 * 【消した。偽にして残さない】
 *   `enja`(英語 → 間 → 日本語)と `jaen`(日本語 → 間 → 英語)を、
 *   読み方の一覧からも `radioSteps()` からも、鳴らす側からも外した。
 *   **残すと、次に見た人が「まだ使うのかもしれない」と読む**
 *   (「サンプルデータに戻す」を消したときと同じ作法)。
 *
 * 【画面の日本語は消していない】
 *   カードには訳がこれまでどおり出る。**言われたのは声の話**であって、
 *   目で読む訳ではない(**言われた場所だけを直す**)。
 *
 * 【戻す日が来たら】
 *   日本語も窓口で作れるようになった日(Azure / Google の日本語の声)には、
 *   ここに `{ id: 'enja', … }` を足し、`radioSteps()` に枝を戻す。
 *   **端末の声には二度と戻さない** —— 質を選べないことが、消した理由である。
 * ══════════════════════════════════════════════════════════════════
 *
 * **場面ごとに、利用者が挙げたもの以外を足さない**
 * (`writingTones.js` の4つと同じ決まり)。
 */
const MODE_EN = { id: 'en', label: '英語だけ、くり返し' }

/** 単語帳の読み方 */
export const RADIO_MODES = [MODE_EN]
/** Quick Response の読み方(**単語帳と同じ**。向きの違いは日本語と一緒に消えた) */
export const QR_RADIO_MODES = [MODE_EN]

export const DEFAULT_RADIO_MODE = 'en'

/**
 * 場面ごとの持ちもの。**読み方の一覧も、覚える鍵も、ここ1か所。**
 *
 * `reviewScope.js` の `loadScope('qr')` / `saveScope('qr', id)` と同じ形
 * である。**覚える鍵は場面で分けたまま**にしてある ——
 * **間の長さが場面で違う**からである(語は短く、文は長い)。
 * 読み方が1つに戻ったいまも、この分けかたは変えない。
 */
const WHERES = {
  word: { modes: RADIO_MODES, modeKey: 'eas.radioMode', gapKey: 'eas.radioGap' },
  qr: { modes: QR_RADIO_MODES, modeKey: 'eas.qrRadioMode', gapKey: 'eas.qrRadioGap' },
}

const whereOf = (where) => WHERES[where] ?? WHERES.word

/** その画面に出す読み方。**画面の中に一覧を書き写さない** */
export const radioModesFor = (where = 'word') => whereOf(where).modes

/**
 * 覚えている値を、その画面の一覧に収める。
 * **知らない id はその画面の既定(最後のもの)に落とす** —— 行き止まりを作らない。
 * 端末に `enja` / `jaen` が残っていても、ここで `en` に落ちる。
 */
export const radioModeOf = (id, where = 'word') => {
  const { modes } = whereOf(where)
  return modes.find((m) => m.id === id) ?? modes[modes.length - 1]
}

/* --------------------------------------------------------------------------
 * 間(ま)の長さ —— 2026-09 利用者の指定
 *
 *   > そして、単語帳もだが、間の時間設定もできるようにしてくれ。
 *
 * **選ぶのは「考える間」の秒数1つだけ。** 間は3種類ある
 * (考える間 / 語と語のあいだ / くり返しのあいだ)が、3つとも選ばせると
 * どれを触ればよいのか分からなくなる。だから**基準を1つ選ばせ、
 * 残りは同じ比でそろって動かす**(`turnGap.js` で「比はそのままで、
 * 値だけを半分にする」と決めたのと、まったく同じ考え方)。
 * **片方だけ縮めると、そこだけ不自然に詰まる。**
 * ------------------------------------------------------------------------ */

/**
 * 語と語のあいだ。**続けて鳴らすと、どこで切れたのか分からない**(比の基準)。
 *
 * ══════════════════════════════════════════════════════════════════
 * **900 → 500 に縮めた**(2026-09 実機・利用者の指定)
 *
 *   > 単語帳の繰り返しモード、違う単語に移る際の間を 0.5 秒くらいまで
 *   > 縮められませんか?同じ単語の2回繰り返す際の間は今のままでOKです
 *
 * 【まず測った。推測でいじらない】
 *   端末の声の入口を差し替えて、鳴り終わりから次の鳴り始めまでを数えた。
 *
 *   | 選んだ秒 | 同じ語の2回のあいだ | **別の語へ移るときの間** |
 *   |---|---|---|
 *   | 0.5秒 | 180ms | **322ms** |
 *   | 1.5秒(既定) | 537ms | **965ms** |
 *   | 3秒 | 1072ms | 1930ms |
 *
 *   既定で **965ms ≒ 1秒**。「0.5秒くらいまで」はここを指している。
 *
 * 【動かしたのは、この1つの比だけ】
 *   `REPEAT_GAP_MS` は1ミリも触っていない(「同じ単語の2回繰り返す際の
 *   間は今のままでOK」)。`RECALL_GAP_MS`(基準)も動かさない ——
 *   動かすと**両方**が変わってしまう。
 *
 *   **結果として `REPEAT_GAP_MS` と同じ値になった。** 名前は残す ——
 *   役目が違うので、片方だけ動かしたくなる日が来る。
 *   いまは既定で **語と語 536ms / 同じ語 536ms** と、ほぼ同じ長さで並ぶ。
 *   これは利用者が言った2つ(「0.5秒くらい」+「今のまま」)から
 *   そのまま出てくる値である。
 *
 * 【間を縮めるだけでは足りなかった】
 *   実際に耳に届く間は **「決めた間 + 次の語の音声を用意する待ち」**である。
 *   聞き流しは**次の語を1つも先読みしていなかった**ので、語が変わるたびに
 *   MP3 と文字ごとの時刻(`.json`)を取りに行っていた。
 *   だから `WordRadio` が**いま鳴らしているあいだに次の語を用意する**
 *   (`prepareRead()`)。**同じ語の2回目には起きない**(もう控えにある)ので、
 *   「別の語のときだけ長い」という聞こえ方の、もう半分の出どころだった。
 * ══════════════════════════════════════════════════════════════════
 */
export const WORD_GAP_MS = 500
/** 英語を2回読むときの、あいだ(比の基準) */
export const REPEAT_GAP_MS = 500
/**
 * **比の基準**(選んだ秒が、そのままこの値になる)。
 *
 * もとは「日本語を読む前の、考える間」だった。日本語の読み上げを外した
 * いまは**どの間にも直に使われていない**が、**基準としては残す** ——
 * 動かすと `word` と `repeat` の比が変わり、
 * **これまでと聞こえ方が変わってしまう。**
 */
export const RECALL_GAP_MS = 1400

/**
 * 選べる間。**既定(1.5秒)は、これまでの 1.4 秒とほぼ同じ**なので、
 * 何も触らなければ聞こえ方は1ミリも変わらない。
 */
export const RADIO_GAPS = [
  { id: 500, label: '0.5秒' },
  { id: 1000, label: '1秒' },
  { id: 1500, label: '1.5秒' },
  { id: 2000, label: '2秒' },
  { id: 3000, label: '3秒' },
  { id: 5000, label: '5秒' },
]

export const DEFAULT_RADIO_GAP = 1500

const MIN_GAP = 200
const MAX_GAP = 10000

/**
 * 選んだ秒から、3つの間を出す。**比は動かさない。**
 *
 *   考える間 = 選んだ秒
 *   語と語   = 選んだ秒 × (500 / 1400)   ← 2026-09 に 900 から縮めた
 *   くり返し = 選んだ秒 × (500 / 1400)
 *
 * **知らない値・範囲の外は既定に落とす**(行き止まりを作らない)。
 */
export function radioGapsOf(gapMs = DEFAULT_RADIO_GAP) {
  const n = Number(gapMs)
  const recall = Number.isFinite(n) && n >= MIN_GAP && n <= MAX_GAP
    ? Math.round(n)
    : DEFAULT_RADIO_GAP
  return {
    recall,
    word: Math.round(recall * (WORD_GAP_MS / RECALL_GAP_MS)),
    repeat: Math.round(recall * (REPEAT_GAP_MS / RECALL_GAP_MS)),
  }
}

/**
 * その行で読む英語。**「読むものがあるか」を決めるのは、ここ1か所。**
 *
 * 画面の側で `r.display || r.word_norm` と書き写すと、**空白だけの語**が
 * 一覧に残る(`' '` は真だが、trim すると空になる)。すると
 * `radioSteps()` が空を返し、**鳴らす側が待たずに次へ送り続けて画面が固まる。**
 * **数え方を2通り持たない。**
 *
 * **単語帳の行(`display` / `word_norm`)と、Quick Response の行(`en`)の
 * 両方を読む。** そうしておけば、聞き流しの画面は1つで足りる
 * (`QrCard` を教材の中と復習で分けなかったのと同じ考え方)。
 */
export const radioTextOf = (row) => String(
  row?.display || row?.word_norm || row?.en || '',
).trim()

/** その行の日本語。**同じ理由で、こちらも1か所**(単語帳 `meaning_ja` / QR `ja`) */
export const radioJaOf = (row) => String(row?.meaning_ja || row?.ja || '').trim()

/**
 * その1つを、どの順で読むか。
 *
 * `{ kind: 'en' | 'wait', text?, ms? }` を並べて返す。
 * **鳴らす側は、これをそのまま上から順に処理するだけ**でよい。
 *
 * **英語が無ければ、何も返さない。** 読むものが無い語を
 * 「読んだことにして」次へ送ると、無音の時間だけが延びる。
 *
 * **`ja` は返さない**(2026-09 利用者の指定・上記)。読み上げるのは
 * 英語だけである。**画面に出す訳は、これまでどおり**(`radioJaOf`)。
 *
 * @param {object} row  単語帳の1行 / Quick Response の1問
 * @param {string} modeId いまは `en` だけ
 * @param {number} gapMs  間(ミリ秒)。3つの間は同じ比で動く
 */
export function radioSteps(row, modeId = DEFAULT_RADIO_MODE, gapMs = DEFAULT_RADIO_GAP) {
  const en = radioTextOf(row)
  if (!en) return []
  const gaps = radioGapsOf(gapMs)
  return [
    { kind: 'en', text: en },
    { kind: 'wait', ms: gaps.repeat },
    { kind: 'en', text: en },
  ]
}

/** 押す前に、何が起きるかを1行で言う(`scopeLead` と同じ作法) */
export function radioLead() {
  return '英語だけを2回ずつ読みます。意味は画面に出ます。'
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

/**
 * 覚えている読み方。**場面ごとに別に覚える**(単語帳 / Quick Response)。
 * `loadScope('qr')` と同じ形で、**呼ぶ側は場面の名前だけを渡す。**
 */
export function loadRadioMode(where = 'word') {
  const { modes, modeKey } = whereOf(where)
  try {
    const saved = localStorage.getItem(modeKey)
    return modes.some((m) => m.id === saved) ? saved : modes[modes.length - 1].id
  } catch { return modes[modes.length - 1].id }
}

export function saveRadioMode(id, where = 'word') {
  try { localStorage.setItem(whereOf(where).modeKey, String(id)) } catch { /* 同上 */ }
}

/** 覚えている間の長さ。**知らない値は既定に落とす**(行き止まりを作らない) */
export function loadRadioGap(where = 'word') {
  try {
    const saved = Number(localStorage.getItem(whereOf(where).gapKey))
    return RADIO_GAPS.some((g) => g.id === saved) ? saved : DEFAULT_RADIO_GAP
  } catch { return DEFAULT_RADIO_GAP }
}

export function saveRadioGap(ms, where = 'word') {
  try { localStorage.setItem(whereOf(where).gapKey, String(ms)) } catch { /* 同上 */ }
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
