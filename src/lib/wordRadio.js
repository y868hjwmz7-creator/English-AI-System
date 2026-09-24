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
 * 読み方。**もとは「英語だけ」1つだった。**
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

/* ══════════════════════════════════════════════════════════════════
   **言う練習**(2026-09 利用者の指定「パタプラのようにしたい」)

   調べたところ、パタプラ(パタプライングリッシュ)の芯は4つだった。

     ・**テキストを見ない。** 耳で聞いて、**間(ポーズ)の中で声に出す**
     ・**チャンク**(2〜8語の意味のかたまり)単位で口に出す
     ・**型を固定して、中身だけ入れ替える**
     ・**Type A(かたまりのリピート)→ Type B(文のリピート)**の段

   **新しい画面を作らない。** 聞き流し(`WordRadio`)は
   「音声が自動で進み、間を選べて、やめるまで回りつづける」——
   **必要なものが、もうぜんぶ在る。** 足りないのは
   **どの順で鳴らすか**だけなので、ここ(`radioSteps`)に足す。

   **3つめを足さない**という上の決まりは、
   **利用者がここを名指しで変えたので、そのぶんだけ解けている。**
   思いつきで足したものは、いまも1つも無い。
   ══════════════════════════════════════════════════════════════════ */

/** ①日本語を見て、間の中で言い、そのあと答えが鳴る(パタプラの芯) */
const MODE_SAY = { id: 'say', label: '言う練習(間 → 答え)' }
/* ══════════════════════════════════════════════════════════════════
   **チャンク系の2つは、まるごと外した**(第5.251節・2026-09-23 利用者の指定)

     > quick response の聞き流しモードのチャンク系の2つは排除です。
     > **ややこしく、分かりにくいので排除です。**
     > 私のアイデアに技術が追いつかないと判断しました。

   外したのは「チャンクで積む」と「慣れるまでチャンク、慣れたら1文」。
   **組み立てる関数(`chunkSteps` / `drillChunks`)ごと消した** ——
   値を偽にして残すと、次に見た人が「まだ使うのかもしれない」と読む
   (`duckBgm` を道具ごと消したのと同じ作法)。

   **残るのは2つ。** 英語だけ / 言う練習(日本語 → 英語)である。
   ══════════════════════════════════════════════════════════════════ */

/**
 * 単語帳の読み方。**変えていない。**
 *
 * 言われたのは **Quick Response** である(「quick response を、特に
 * パタプラのようにしたいです」)。語は文ではないので**チャンクに割れず**、
 * 「言う練習」も語の意味を見て言うだけで、いまの形とほとんど変わらない。
 * **言われた場所だけを直す**(CLAUDE.md)。
 */
export const RADIO_MODES = [MODE_EN]
/** Quick Response の読み方。**文なので、パタプラの4つが効く** */
export const QR_RADIO_MODES = [MODE_EN, MODE_SAY]

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
  /* `sayGapKey` … **「日本語 → 英語」のあいだ**(第5.251節)。
     英語だけの「間」とは意味が違うので、**別に覚える** */
  qr: {
    modes: QR_RADIO_MODES,
    modeKey: 'eas.qrRadioMode',
    gapKey: 'eas.qrRadioGap',
    sayGapKey: 'eas.qrSayGap',
  },
}

const whereOf = (where) => WHERES[where] ?? WHERES.word

/** その画面に出す読み方。**画面の中に一覧を書き写さない** */
export const radioModesFor = (where = 'word') => whereOf(where).modes

/**
 * **その場面・その読み方で、間に何を選べるか**(第5.251節)。
 *
 * 一覧も、覚える鍵も、既定も**ここ1か所**で決まる ——
 * 画面の中で `mode === 'say' ? SAY_GAPS : RADIO_GAPS` と書くと、
 * **選ぶ側と覚える側で食い違う**(CLAUDE.md「数え方を2通り持たない」)。
 */
const gapSetOf = (where, modeId) => {
  const w = whereOf(where)
  return String(modeId) === MODE_SAY.id && w.sayGapKey
    ? {
      list: SAY_GAPS, key: w.sayGapKey, def: DEFAULT_SAY_GAP,
      label: '日本語 → 英語のあいだ',
    }
    : {
      list: RADIO_GAPS, key: w.gapKey, def: DEFAULT_RADIO_GAP,
      label: '間の長さ',
    }
}

/**
 * その欄が何を決めているか(読み上げのための名前)。
 *
 * **画面の中で `mode === 'say'` と書かない**(CLAUDE.md)。
 * 一覧・鍵・既定と同じところから出す —— 片方だけ古くなる。
 */
export const radioGapLabelFor = (where = 'word', modeId = DEFAULT_RADIO_MODE) => (
  gapSetOf(where, modeId).label
)

/** その場面・その読み方で選べる間。**画面はこれをそのまま並べる** */
export const radioGapsFor = (where = 'word', modeId = DEFAULT_RADIO_MODE) => (
  gapSetOf(where, modeId).list
)

/**
 * 覚えている値を、その画面の一覧に収める。
 * **知らない id はその画面の既定(最後のもの)に落とす** —— 行き止まりを作らない。
 * 端末に `enja` / `jaen` が残っていても、ここで `en` に落ちる。
 */
export const radioModeOf = (id, where = 'word') => {
  const { modes } = whereOf(where)
  /* **知らない読み方は、既定に落とす**(端末に残った `enja` / `jaen` など)。
     **`modes[modes.length - 1]`(いちばん最後)ではない** ——
     読み方が1つしか無かったころは先頭と末尾が同じだったので、
     どちらで書いても同じだった。読み方を4つに増やした日に、
     **古い値が「慣れるまでチャンク」に落ちる**ようになっていた
     (`npm run test:play` が見つけた・2026-09)。
     落とし先は `DEFAULT_RADIO_MODE` 1か所である */
  return modes.find((m) => m.id === id)
    ?? modes.find((m) => m.id === DEFAULT_RADIO_MODE)
    ?? modes[0]
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
 *   **その日が来た(下記)。**
 * ══════════════════════════════════════════════════════════════════
 * **500 → 250。もう一段詰めた**(2026-09 実機・利用者の指定)
 *
 *   > また、単語と Quick Response の聞き流しの間ですが、
 *   > **違う単語同士の間をもっと詰めれませんか？もっとサクサク
 *   > 読み上げてほしいです。**
 *
 *   前の回で 900 → 500 に縮めたが、**それでもまだ長かった。**
 *   既定(1.5秒)で **536ms → 268ms**(実測は下記)。
 *
 * 【動かしたのは、やはりこの1つの比だけ】
 *   `REPEAT_GAP_MS` は**今度も1ミリも触っていない** ——
 *   前の回の「同じ単語の2回繰り返す際の間は今のままでOKです」は
 *   **取り消されていない**(言われた場所だけを直す)。
 *
 *   **その結果、語と語(268ms)のほうが、同じ語の2回(536ms)より
 *   短くなった。** 拍としては裏返っているが、
 *   **同じ語が2回続くこと自体が、いちばん強い区切りの手がかり**なので、
 *   聞き分けは崩れない。**利用者が言った2つから、そのまま出てくる値**である。
 *   気になるようなら `REPEAT_GAP_MS` を同じだけ縮める(1行)。
 *
 * 【単語帳と Quick Response の両方に、この1か所で効く】
 *   どちらも `radioGapsOf()` を通る(`WordRadio` は部品1つ)。
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
export const WORD_GAP_MS = 250
/**
 * 英語を2回読むときの、あいだ(比の基準)。
 *
 * **2026-09 の2度の指定(500 → 250)では、1ミリも触っていない。**
 * 利用者が「同じ単語の2回繰り返す際の間は今のままでOK」と言ったのは
 * この値である。
 */
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

/* ══════════════════════════════════════════════════════════════════
   **「日本語 → 英語」のあいだ**(第5.251節・2026-09-23 利用者の指定)

     > この日本語→英語の日本語が言われてから英語が言われるまでの時間、
     > そしてそもそも日本が言われるまでの時間、これが今は長い。
     > **これも最速にしましょう。その上で日本語→英語の間の設定が
     > できるようにしたい。**

   長さの出どころは2つあった。**分けて考える。**

   | 出どころ | 直し方 |
   |---|---|
   | **待つと決めてある間** | ここ(選べるようにする) |
   | **音声を取りに行く待ち** | 先読み(`radioWarmups`)。**0 にする** |

   訳(日本語)は**一度も先読みしていなかった**ので、問が変わるたびに
   MP3 を取りに行っていた。これが「そもそも日本語が言われるまで」である。
   **値をいくら縮めても、こちらは1ミリも縮まらない**
   (CLAUDE.md「値を上げ下げする前に、届いているかを確かめる」)。

   **「すぐ」(0秒)を入れてある。** 最速はここである。
   **既定は 0.5秒** —— 言う練習なので、一拍だけ残す。

   **英語だけの「間」(`RADIO_GAPS`)とは、別に覚える。**
   意味が違うものを1つの値で兼ねると、片方を縮めた日に
   もう片方まで動く(**呼び名を2か所に書かない**の裏返し)。
   ══════════════════════════════════════════════════════════════════ */
export const SAY_GAPS = [
  { id: 0, label: 'すぐ' },
  { id: 500, label: '0.5秒' },
  { id: 1000, label: '1秒' },
  { id: 1500, label: '1.5秒' },
  { id: 2000, label: '2秒' },
  { id: 3000, label: '3秒' },
  { id: 5000, label: '5秒' },
]

export const DEFAULT_SAY_GAP = 500

const MIN_GAP = 200
const MAX_GAP = 10000

/**
 * 選んだ秒から、3つの間を出す。**比は動かさない。**
 *
 *   考える間 = 選んだ秒
 *   語と語   = 選んだ秒 × (250 / 1400)   ← 2026-09 に 900 → 500 → 250
 *   くり返し = 選んだ秒 × (500 / 1400)   ← **一度も動かしていない**
 *
 * **知らない値・範囲の外は既定に落とす**(行き止まりを作らない)。
 */
export function radioGapsOf(gapMs = DEFAULT_RADIO_GAP, modeId = DEFAULT_RADIO_MODE) {
  /* **言う練習では、選んだ値は「日本語 → 英語」のあいだ1つだけ**
     (第5.251節)。語と語・くり返しは**いちばん速いところで固定**する ——
     あの2つは言われていないので、**いまの既定とほぼ同じ値**である
     (1.5秒のとき 268 / 536ms、固定して 250 / 500ms)。
     同じ比で動かすと、「すぐ」を選んだ日に**くり返しまで 0 になる。** */
  if (String(modeId) === MODE_SAY.id) {
    const n = Number(gapMs)
    return {
      recall: SAY_GAPS.some((g) => g.id === n) ? n : DEFAULT_SAY_GAP,
      word: WORD_GAP_MS,
      repeat: REPEAT_GAP_MS,
    }
  }
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
/**
 * **訳を読むか**(2026-09 利用者の指定「日本語の声のIDです」)。
 *
 * パタプラは**音声完結**で、訳も音声の中に入る。
 * だから**言う練習では訳を読む** —— 画面を見ずに練習できるのが芯である。
 *
 * **聞き流し(英語だけ)では読まない。** あちらは 2026-09 の指定で
 * 英語だけにしたもので、**そこは1ミリも変えていない。**
 *
 * 読む声は `JA_VOICE`(`clipVoices.js`)1か所。
 * **端末の声には二度と落とさない**(`clipOnly`・`readAloud.js`)。
 */
const jaStep = (ja) => {
  const t = String(ja ?? '').trim()
  /* **訳が無ければ、読まない。** 空を鳴らそうとすると、
     窓口が断って端末の声へ落ちる道に入る */
  return t ? [{ kind: 'ja', text: t }] : []
}

/** ①訳が鳴る → 間の中で言う → 答えが鳴る → もう一度 */
const saySteps = (en, gaps, ja) => [
  ...jaStep(ja),
  /* **訳のあとに間を置く。** ここが「自分が言う番」である ——
     答えを鳴らしてから間を置くと、**ただのリピートになる**。

     **「すぐ」(0秒)を選んだら、段そのものを置かない**(第5.251節)。
     `ms: 0` の段を残すと、**画面に「言う番」が一瞬ちらつく** ——
     待たないと決めたのに待っているように見える */
  ...(gaps.recall > 0 ? [{ kind: 'wait', ms: gaps.recall, you: true }] : []),
  { kind: 'en', text: en },
  { kind: 'wait', ms: gaps.repeat },
  { kind: 'en', text: en },
]

export function radioSteps(row, modeId = DEFAULT_RADIO_MODE, gapMs = DEFAULT_RADIO_GAP) {
  const en = radioTextOf(row)
  if (!en) return []
  /* **読み方も渡す**(第5.251節)。渡さないと「言う練習」でも
     英語だけの道を通り、**「すぐ」(0秒)が既定の 1.5 秒に落ちる**
     ——「知らない値は既定に落とす」が、そのまま効いてしまう。
     実測で見つけた(`ja wait(1500) en` と出た) */
  const gaps = radioGapsOf(gapMs, modeId)
  const ja = radioJaOf(row)
  const id = String(modeId ?? '')
  if (id === MODE_SAY.id) return saySteps(en, gaps, ja)
  return [
    { kind: 'en', text: en },
    { kind: 'wait', ms: gaps.repeat },
    { kind: 'en', text: en },
  ]
}

/**
 * **その読み方は、答えを先に見せないか。**
 *
 * 言う練習では、英文が画面に出ていたら**読み上げているだけ**になる。
 * 判断はここ1か所。画面で `mode === 'say'` と書かない。
 */
export const hidesAnswer = (modeId) => modeId === MODE_SAY.id

/* **押す前の1行(`radioLead`)は、まるごと消した**(第5.252節)。

     > 下の説明と曲名を消して

   画面に出す先が無くなったものを、道具だけ残さない ——
   次に見た人が「まだ使うのかもしれない」と読む
   (`duckBgm` / `chunkSteps` と同じ作法)。 */

/**
 * **その1つを鳴らすのに、どの音声が要るか**(第5.251節)。
 *
 * 先読みする側が**鍵を書き写さないため**にある。
 * **歩み(`radioSteps`)そのものから読む** —— ここで
 * 「言う練習なら訳も要る」と書くと、**読む順を変えた日に、
 * 先読みだけが古いまま**になる(CLAUDE.md「数え方を2通り持たない」)。
 *
 * 返すのは `{ ja, text }` の並び。同じものは1つにまとめる
 * (英語は2回鳴るが、取りに行くのは1回でよい)。
 *
 * **間の長さは関係しない**ので渡さない —— 鳴らすものは変わらない。
 */
export const radioWarmups = (row, modeId = DEFAULT_RADIO_MODE) => {
  const out = []
  const seen = new Set()
  for (const st of radioSteps(row, modeId)) {
    if (st.kind !== 'en' && st.kind !== 'ja') continue
    const key = `${st.kind}:${st.text}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ ja: st.kind === 'ja', text: st.text })
  }
  return out
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
  const { modeKey } = whereOf(where)
  /* **落とし方を2通り持たない**(2026-09)。ここにも
     `modes[modes.length - 1]`(いちばん最後)と書いてあった ——
     読み方が1つのころは先頭と末尾が同じなので、どちらでも同じだった。
     4つに増やした日、**端末に残った `jaen` が「慣れるまでチャンク」に
     落ちて、聞き流しのつもりが言う練習になった**
     (`npm run test:bar` が「読んでいる文と画面がずれている」で見つけた)。
     **落とし先は `radioModeOf()` 1か所**である */
  try {
    return radioModeOf(localStorage.getItem(modeKey), where).id
  } catch { return DEFAULT_RADIO_MODE }
}

export function saveRadioMode(id, where = 'word') {
  try { localStorage.setItem(whereOf(where).modeKey, String(id)) } catch { /* 同上 */ }
}

/**
 * 覚えている間の長さ。**知らない値は既定に落とす**(行き止まりを作らない)。
 *
 * **読み方ごとに別に覚える**(第5.251節)。「英語だけ」の間と
 * 「日本語 → 英語」のあいだは**別のもの**なので、
 * 片方を縮めても、もう片方は動かない。
 */
export function loadRadioGap(where = 'word', modeId = DEFAULT_RADIO_MODE) {
  const { list, key, def } = gapSetOf(where, modeId)
  try {
    const saved = Number(localStorage.getItem(key))
    return list.some((g) => g.id === saved) ? saved : def
  } catch { return def }
}

export function saveRadioGap(ms, where = 'word', modeId = DEFAULT_RADIO_MODE) {
  try {
    localStorage.setItem(gapSetOf(where, modeId).key, String(ms))
  } catch { /* 同上 */ }
}

/* **音の大きさは、ここには無い**(2026-09 利用者の指定)。
 *
 *   > 英語の音声と音楽を独立してそれぞれ音量を調整出来るようにしたいです。
 *   > 英語音声が再生される時に自動で音楽の音量を下げる機能は必要ありません
 *
 * 大きさは**聴く人が決める**ものになったので、英語の音声のぶんと並べて
 * `src/lib/mixVolume.js` 1か所に置いてある。
 * 自動で下げる仕組み(`BGM_DUCKED` / `bgmVolume()` / `duckBgm()`)は
 * **道具ごと消した** —— 値を偽にして残すと、次に見た人が
 * 「まだ使うのかもしれない」と読む。 */
