/**
 * こちらで作った読み上げ音声(MP3)を鳴らす。
 *
 * ============================================================================
 * 【なぜ必要になったか】(2026-08 実機の報告)
 *
 *   知り合いの iPhone で、開発中のリンクを **Google Chrome** で開いて
 *   もらったところ、こちらで聞こえている声とはまるで違う、
 *   ひどい声が出た。
 *
 *   これは不具合ではなく、**iOS の作りそのもの**である。
 *     ・iOS では、**すべてのブラウザの中身が Safari(WebKit)**。
 *       「Chrome を使えば回避できる」という手は存在しない
 *     ・iOS は高品質な声を Web Speech API に **一切公開しない**
 *       (実機で生 47 件を確認し、premium は 0 件)
 *
 *   つまり **端末の声に頼るかぎり、iPhone のゲストには良い音を届けられない。**
 *   唯一の解が、こちらで音声を作って配ることである。
 *
 * ============================================================================
 * 【どこから来るか】
 *
 *   置き場所は、英文と話者から**計算で決まる。**
 *
 *       tts/<版>/<段>/<話者>/<英文の SHA-256>.mp3
 *
 *   目録の表を持たない。**持つと必ずファイルと食い違う。**
 *   場所が計算で出るなら、取りに行って「鳴ったか、鳴らなかったか」で判る。
 *
 *     1. まずその場所を `<audio>` に渡す。**あれば、これだけで終わり。**
 *        Supabase の CDN から返り、2回目からは端末の控えから出る
 *     2. 無ければ窓口(`speak` 関数)に作らせ、返ってきた場所で鳴らす
 *     3. それも駄目なら false を返す。呼んだ側が端末の声に戻す
 *
 *   **1 で済むかぎり、窓口も Azure も呼ばれない。** 費用も通信も増えない。
 *
 * ============================================================================
 * 【止まる条件を持たせる】
 *
 *   外部の窓口を自動で呼ぶものには、必ず止まる条件を持たせる。
 *   Anthropic の残高が切れたとき、開くたびに呼びに行き、直らないことのために
 *   待たされ続けた(2026-08 実機)。同じ失敗をここで繰り返さない。
 *
 *   窓口が `fatal`(鍵が無い・設定していない)を返したら、
 *   **その画面のあいだは二度と取りに行かない。** 端末の声で読み上げる。
 *
 * ============================================================================
 * 【iPhone で鳴らすための作法】
 *
 *   iOS は「利用者が押した流れの中で始まった再生」しか許さない。
 *   ところが MP3 は取りに行くぶん待ちが入るので、押した流れが切れてしまう。
 *
 *   そこで **`<audio>` は最初に1つだけ作り、最初に画面へ触れた瞬間に
 *   無音を鳴らして解錠しておく。** 以後は待ちを挟んでも鳴らせる。
 *   録音の `AudioContext` で学んだ作法(1つだけ作り、作り直さない)と同じ。
 */
import {
  DEFAULT_BASE, baseVoiceOf, elevenIdOf, voiceModelOf, voiceRateOf, voiceSettingsOf,
} from '../data/clipVoices.js'
import { isSupabaseConfigured, supabase, supabaseUrl } from './supabase.js'
import { PREMIUM, STANDARD } from './voiceTier.js'
import { charTimesOf, spansOf, wholeMark } from './wholeAudio.js'
import { markIndexAt, marksFromTimes, wordMarks } from './wordTiming.js'
import {
  FADE_STEP, FADE_STOP, applyGain, fadeGain, isMeasured, measureClip,
} from './loudness.js'

/** 0016 で作るバケツ。窓口(supabase/functions/speak)と同じ名前にすること */
const BUCKET = 'tts'

/**
 * 音声の**版**。置き場所の頭に付く(`tts/<版>/<話者>/<指紋>.mp3`)。
 *
 * **`supabase/functions/speak/index.ts` の CLIP_REV と、必ず同じ値にすること。**
 * 画面と窓口の両方が同じ場所を計算する。片方だけ変えると、画面が見に行く
 * 場所と窓口が置く場所が食い違い、**毎回作り直して毎回課金される。**
 *
 * 声を変えたとき(会社を替えた・DragonHD にしたなど)に1つ進める。
 * 進めないと、前の声で作った MP3 がそのまま返り続ける。
 */
const CLIP_REV = '1'

/**
 * 話者の指定が無いときの声。
 * 一覧と丸め方は `src/data/clipVoices.js` に置いてある。**2か所に持たない。**
 */
export const DEFAULT_CLIP_VOICE = DEFAULT_BASE

/**
 * 置き場所に使う名前。
 *
 * **良い声は名簿の id、標準の声は代役の名前**にする。
 * こうすると、同じ訛り・同じ性別の声どうしは**標準の音声を共有できる。**
 * ドリルのぶんを、声の数だけ作り直さずに済む。
 */
const pathVoice = (voiceId, tier) =>
  (tier === 'premium' ? String(voiceId || DEFAULT_BASE) : baseVoiceOf(voiceId))

// ── この画面のあいだ覚えておくこと ──────────────────────────
//
// **開くたびに同じ失敗を繰り返さない。** どれも画面を読み込み直せば消える。
let stopped = false          // 窓口が fatal を返した。もう取りに行かない
let lastDetail = null        // 係の人にだけ見せる原因(`src/lib/viewer.js` が判断)
const urlCache = new Map()   // 指紋 → 鳴らせる URL
const gaveUp = new Set()     // 窓口に頼んでも駄目だったもの

/**
 * ============================================================================
 * **作り直した印は、ページを読み込み直しても残す。**(2026-09 実機)
 *
 * 【何が起きていたか】
 *   利用者が「読み上げ音声を作り直す」を押し、ElevenLabs に課金までして
 *   作り直したのに、**耳では何も変わらなかった。**
 *
 *   作り直した MP3 は**元と同じ場所に上書き**される
 *   (置き場所は `<版>/<段>/<声の id>/<英文の指紋>.mp3` で、
 *   設定もモデルも道に入っていない)。ところが窓口は、置くときに
 *
 *       Cache-Control: public, max-age=31536000, immutable
 *
 *   を付けている。**`immutable` は「1年のあいだ、問い合わせすらするな」**
 *   という意味なので、端末に残った**古い MP3 がそのまま鳴り続ける。**
 *
 *   `remakeClip()` は `?v=<時刻>` を付けて別の URL にしていたが、
 *   **その印は `urlCache`(このモジュールの中)にしか無かった。**
 *   画面を読み込み直せば消えるので、**次に開いた人には古い音が鳴る。**
 *   しかも**音は鳴る**ので、「作り直したのに直っていない」としか見えない。
 *
 * 【だから、印を端末に残す】
 *   `clipUrl()` は、その英文を作り直したことがあれば `?v=` を付けて返す。
 *   **1年もちの控えを必ず素通りする。**
 *
 *   ・**作り直した英文だけ**に付く。ほかは素の URL のままなので、
 *     控えはこれまでどおり効く(通信も費用も増えない)
 *   ・**時刻は上書きする。** 2回作り直せば、2回とも新しい URL になる
 *   ・入れ物が膨らまないよう、**新しいものから 4000 件**だけ残す
 *   ・localStorage が使えない端末では、その画面のあいだだけ覚える
 *     (**印が無くても音は鳴る。** 作り直しが届かないだけ)
 */
const REMADE_KEY = 'eas.clipRemade'
const REMADE_MAX = 4000
let remade = null

const loadRemade = () => {
  if (remade) return remade
  remade = {}
  try {
    const raw = window.localStorage.getItem(REMADE_KEY)
    const got = raw ? JSON.parse(raw) : null
    if (got && typeof got === 'object') remade = got
  } catch { /* 使えない端末では、この画面のあいだだけ覚える */ }
  return remade
}

/** その英文を作り直したか。作り直していれば、控えを外すための印を返す */
const remadeMark = (mark) => {
  const v = loadRemade()[mark]
  return typeof v === 'number' && v > 0 ? String(v) : ''
}

const noteRemade = (mark, stamp) => {
  const map = loadRemade()
  map[mark] = stamp
  const keys = Object.keys(map)
  if (keys.length > REMADE_MAX) {
    // 古いものから落とす。**新しいほうが、いま鳴らしたいものである**
    keys.sort((a, b) => map[a] - map[b])
      .slice(0, keys.length - REMADE_MAX)
      .forEach((k) => { delete map[k] })
  }
  try {
    window.localStorage.setItem(REMADE_KEY, JSON.stringify(map))
  } catch { /* 入らなくても、この画面のあいだは効く */ }
}

/** 係の人向けの、直近の原因。ゲストには出さない */
export const lastClipDetail = () => lastDetail

/**
 * **窓口(`speak`)が、いつの版か。**(2026-09 実機)
 *
 * 【なぜ要るか】
 *   Ally の似せ具合を 1 → 0.1 に振っても、利用者の耳では
 *   **音が1つも変わらなかった。** ここまで振れば声そのものが変わるので、
 *   **指定が ElevenLabs まで届いていない**と考えるのが自然である。
 *
 *   窓口は Supabase の画面から**利用者が置く。**
 *   `elevenSettings` を読む版が入ったのは 2026-09-04 なので、
 *   それより前のものが置かれていれば、**指定は黙って捨てられる。**
 *   しかも**音は鳴る**(既定で作られる)ので、**誰も気づけない。**
 *
 *   だから窓口に版を返させ、**古ければ係の人に知らせる。**
 *   「検証を頼む前に、版が分かるようにする」(共通ルール)。
 *
 *   **2026-09-04b から、モデルの既定が v3 になった**(利用者が選んだ声は
 *   すべて v3 である)。置き直していない窓口は、いまも v2 で作っている。
 *   **音は鳴るので、これも黙っていると気づけない。**
 *
 *   **2026-09-07 から、文字ごとの時刻を `.json` に控える**(`with-timestamps`)。
 *   置き直していない窓口は控えを作らないので、**色は見積もりのまま**である。
 *   やはり**音は鳴る**ので、黙っていると気づけない。
 *
 * **`undefined` は「古い」と読む。** 版を返さない = 版を付ける前のもの。
 */
export const NEED_FN_REV = '2026-09-11'

let fnRev = null
/** 窓口の版。まだ一度も呼んでいなければ `null` */
export const clipFnRev = () => fnRev
/** 置き直しが要るか。**まだ分からないうちは false**(既定は騒がない) */
export const clipFnStale = () => fnRev !== null && fnRev < NEED_FN_REV

/**
 * 窓口が古いことを伝える1文。古くなければ `null`。
 *
 * **音声を作れたときも、これだけは残す。** 古い窓口でも音は鳴るので
 * (既定の設定で作られる)、引っ込めると**永久に気づけない。**
 */
const staleNote = () => (clipFnStale()
  ? '読み上げの窓口(speak)が古いため、ElevenLabs の v3 と、'
    + '声の細かい指定(訛りの強さ・雑音の出やすさ)が反映されていません。'
    + `いま置かれているのは ${fnRev}、必要なのは ${NEED_FN_REV} 以降です。`
    + ' Supabase → Edge Functions → speak を置き直してください。'
  : null)

/**
 * @param {string|undefined} rev 窓口が返した版
 * @param {boolean} absentIsOld
 *   **版が付いてこないことを「古い」と読んでよいか。**
 *
 *   `ping` だけが `true` である —— あちらは版を訊きに行く道なので、
 *   返ってこなければ版を付ける前のものだと分かる。
 *
 *   **ふつうの呼び出しでは `false`。**(2026-09 実機・こちらの見落とし)
 *   窓口が 400 を返すと、supabase-js は **`data` を `null` にして、
 *   中身を `error` の側に入れる。** そのため `body.fnRev` が
 *   いつも `undefined` になり、**英文が1つ長すぎただけで
 *   「窓口が古い」と言い出していた。** 版とは何の関係もない。
 */
const noteFnRev = (rev, absentIsOld = false) => {
  const has = typeof rev === 'string' && rev
  if (!has && !absentIsOld) return
  const got = has ? rev : '(版なし)'
  if (got === fnRev) return
  fnRev = got
  /* **黙って落とさない。** 音は鳴ってしまうので、言わないと気づけない */
  const note = staleNote()
  if (note) setDetail(note)
}

/**
 * **窓口が断ったときの、本当の理由を読む。**(2026-09 実機・利用者の指摘)
 *
 *   > 読み上げ音声を作れませんでした。端末の声で鳴らしています。
 *   > Edge Function returned a non-2xx status code
 *
 * この「non-2xx」は **supabase-js の決まり文句**であって、理由ではない。
 * 窓口はちゃんと `detail`(「英文が長すぎます(2,340 文字)」など)を
 * 返しているのに、**2xx でないときは `data` が `null` になる**ため、
 * こちらが**それを一度も読んでいなかった。**
 *
 * つまり**画面にも、こちらにも、本当の理由が一度も届いていなかった。**
 * どこがどう駄目なのか分からないまま、何日でも見当違いを直せる。
 */
async function errBody(error) {
  try {
    const got = await error?.context?.json?.()
    return got && typeof got === 'object' ? got : {}
  } catch { return {} }
}

/**
 * **窓口に、版だけを訊きに行く**(2026-09 実機・利用者の指摘)。
 *
 *   > トレーナーの画面に赤い知らせが出なくなってます
 *
 * 【なぜ出なくなったか】
 *   版の見比べ(`noteFnRev`)は **`askForClip()` の中にしかなかった。**
 *   ところがそこが呼ばれるのは、**その英文の MP3 がまだ無いとき**だけ
 *   である(`clipUrl()` は置き場所を計算して返すだけで、窓口を呼ばない)。
 *
 *   つまり**すでに音声のある教材を開いて聴くかぎり、窓口は一度も
 *   呼ばれず、古いままでも何も知らせが出ない。**
 *   新しい英文を作った日にだけ出る、当てにならない知らせだった。
 *   「**『無ければ素通り』する形の検証を書かない**」(CLAUDE.md)を、
 *   検証の側ではなく、この知らせの側で破っていた。
 *
 * 【だから、訊きに行く】
 *   `ping` は**版を返すだけ**の呼び出しで、**音声を作らないので
 *   1円もかからない。** 1回の画面につき1度だけ。
 *
 *   - **古い窓口は `ping` を知らない**ので 400 を返す。
 *     版も付いてこないので「古い」と読まれる。**それが正しい答えである**
 *   - **失敗しても何もしない。** `stopped` を立てない・`detail` も
 *     窓口の言葉では書き換えない。ここは版を訊くだけの道であって、
 *     読み上げそのものを止めてよい場所ではない
 */
let asked = false
export async function checkClipGateway() {
  if (asked || !supabase || !canUseClips()) return
  asked = true
  try {
    const { data, error } = await supabase.functions.invoke('speak', { body: { ping: true } })
    const rev = data?.fnRev ?? (await errBody(error)).fnRev
    /* **ここだけは「版が付いてこない = 古い」と読んでよい。**
       `ping` は版を訊きに行く道なので、返らないのは付ける前のものである */
    noteFnRev(rev, true)
  } catch { /* 届かなくても、読み上げは止めない */ }
}

/**
 * **音声を作れなかった理由を、係の人に知らせる。**(2026-09 実機)
 *
 * `speak` を配置していなかったあいだ、画面は**黙って端末の声に落ちて**
 * いた。理由(`lastDetail`)は集めていたのに、**どこからも読んでいなかった。**
 * そのため「良い声にならない」ことに、何日も気づけなかった。
 *
 * 「**成功と失敗が、同じ見た目で終わってはいけない**」(CLAUDE.md)。
 * 出す相手はトレーナーと管理者だけで、**ゲストには出さない**
 * (仕組みの内側の話で、ゲストにできることは何も無い)。
 * その判断は画面側(`src/lib/viewer.js`)が持つ。ここは伝えるだけである。
 */
const troubleListeners = new Set()
export const onClipTrouble = (fn) => {
  troubleListeners.add(fn)
  return () => troubleListeners.delete(fn)
}
/**
 * **本当に音声を作れなかったとき**だけ添える1文。
 *
 * 版が古いことを伝えるだけの知らせ(`noteFnRev`)には**付けない。**
 * あちらは音声を作りに行ってすらいない。
 */
const FAILED = '読み上げ音声を作れませんでした。端末の声で鳴らしています。'

/**
 * **窓口が言った理由だけ**(決まり文句を除いたもの)。
 * どの段落で落ちたかを添えて出し直すときに使う。
 */
let lastReason = ''

/**
 * **端末の声に落ちたことを、場所つきで知らせる。**(2026-09 実機・利用者の指摘)
 *
 *   > このspeech練習の教材、9段落目だけ最低な質の日本語英語の女性の
 *   > 音声になっているので直してください。
 *
 * これまでは「読み上げ音声を作れませんでした」としか出なかったので、
 * **17 段落のどれが落ちたのか、聴き通すまで分からなかった。**
 * iPhone の端末の声は**日本語の声が英語を読む**ので、
 * 気づいたときには「最低な質の音声」として耳に入っている。
 *
 * **場所を言う。** 呼ぶのは、実際に端末の声へ落ちた側である
 * (`readAloud.js`)—— 何段落目かを知っているのはあちらだけである。
 */
export function noteFellBack(where) {
  setDetail(`${where}${FAILED}${lastReason ? ` ${lastReason}` : ''}`)
}

const setDetail = (d) => {
  lastDetail = d
  // **知らせで画面を落とさない。** 伝えられなくても、音は鳴る
  troubleListeners.forEach((fn) => { try { fn(d) } catch { /* 無視する */ } })
}

/**
 * **直ったら、知らせを引っ込める**(2026-09 実機・利用者の指摘)。
 *
 *   > そして、音声がちゃんと作られているのにいまだにこの表示が消えないです。
 *
 * 知らせは**出しっぱなし**だった。一度でも失敗すると、そのあと
 * 音声がちゃんと作られるようになっても、✕ を押すまで居座る。
 * **利用者から見れば「直したのに直っていない」にしか見えない。**
 *
 * **成功と失敗を同じ見た目で終わらせない**(CLAUDE.md)のは、
 * 裏返せば**直ったことも同じだけはっきり見せる**ということである。
 * 窓口が音声を返せた時点で、その知らせはもう本当ではない。
 *
 * **`null` を送る。** 受け取る画面(`App.jsx`)がそれで消す。
 *
 * **ただし「窓口が古い」だけは残す。** あちらは音が鳴っても本当のままで、
 * 引っ込めると**永久に気づけない**(だから版を返させるようにした)。
 */
const clearDetail = () => {
  const keep = staleNote()
  if (lastDetail === keep) return
  setDetail(keep)
}

/**
 * そもそも取りに行けるか。
 * Supabase 未設定(手元での確認や1ファイル版)ではいつも false になり、
 * これまでどおり端末の声で読み上げる。
 */
export const canUseClips = () =>
  !stopped
  && isSupabaseConfigured
  && !!supabaseUrl
  && typeof window !== 'undefined'
  // 指紋は SHA-256 で取る。**http:// や file:// では使えない**(仕様上)
  && !!window.crypto?.subtle

/**
 * 英文の「指紋」。**窓口(`supabase/functions/speak`)と同じ規則にすること。**
 * ずれると同じ英文の音声を二度作ることになり、そのぶん課金される。
 *
 * 空白の連なりだけをそろえる。**小文字にはしない。**
 * 大文字か小文字かで読み方(強調・略語の読み)が変わるためである。
 */
const normText = (text) => String(text ?? '').replace(/\s+/g, ' ').trim()

async function fingerprint(voiceId, text) {
  const bytes = new TextEncoder().encode(`${voiceId}|${text}`)
  const hash = await window.crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * 置き場所。**段(`tier`)も鍵に入れる。**
 * 同じ英文でも、良い声と標準の声では別のファイルである。
 * 入れないと、先に作られたほうが両方に返ってしまう。
 */
const publicUrlOf = (tier, voiceId, hash) =>
  `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${CLIP_REV}/${tier}/${voiceId}/${hash}.mp3`

// ── 鳴らす道具は1つだけ ────────────────────────────────────
//
// iPhone のために、**作り直さない。** 作り直すと解錠がやり直しになる。
let element = null
let primed = false

/** 止めるときのなだらかな下げ。**割り込まれたら捨てる** */
let stopFade = 0
const cancelStopFade = () => {
  if (stopFade) { window.clearInterval(stopFade); stopFade = 0 }
}
/** 再生の世代。新しい再生が始まったら、古い再生の後始末は何もしない */
let generation = 0

function audioElement() {
  if (element) return element
  element = new Audio()
  element.preload = 'auto'
  return element
}

/** 無音を1回鳴らして解錠する。**利用者が触れた流れの中で呼ぶこと** */
function prime() {
  if (primed) return
  primed = true
  try {
    const el = audioElement()
    // 0.05 秒の無音(16bit モノラル 8kHz)。
    // 中身を作るのは、長い base64 の文字列をコードに貼らないため
    const samples = 400
    const buf = new ArrayBuffer(44 + samples * 2)
    const view = new DataView(buf)
    const put = (o, t) => { for (let i = 0; i < t.length; i += 1) view.setUint8(o + i, t.charCodeAt(i)) }
    put(0, 'RIFF'); view.setUint32(4, 36 + samples * 2, true); put(8, 'WAVEfmt ')
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true)
    view.setUint32(24, 8000, true); view.setUint32(28, 16000, true)
    view.setUint16(32, 2, true); view.setUint16(34, 16, true)
    put(36, 'data'); view.setUint32(40, samples * 2, true)
    el.src = URL.createObjectURL(new Blob([view], { type: 'audio/wav' }))
    const played = el.play()
    if (played?.catch) played.catch(() => { /* 解錠できなくても、押した直後の再生は鳴る */ })
  } catch { /* ここで落ちても、読み上げそのものは止めない */ }
}

if (typeof document !== 'undefined') {
  // 最初に画面へ触れた瞬間に解錠する。**押してから探しても間に合わない**
  const once = () => {
    prime()
    document.removeEventListener('pointerdown', once, true)
    document.removeEventListener('keydown', once, true)
  }
  document.addEventListener('pointerdown', once, true)
  document.addEventListener('keydown', once, true)
}

/**
 * 窓口に作らせる。**ここだけが Azure を使わせる入口である。**
 * 駄目だった理由が「待っても直らない」ものなら、以後は取りに行かない。
 */
async function askForClip(text, pathName, tier, rosterId, force = false) {
  if (!supabase) return null
  try {
    const { data, error } = await supabase.functions.invoke('speak', {
      body: {
        text, voice: pathName, tier,
        // **作り直す**(2026-09 実機)。あっても上書きさせる。
        // 頼まれたときだけ — 作り直しはそのまま課金になる
        ...(force ? { force: true } : {}),
        // 標準の段での代役。**声の名簿は画面側だけが持つ**ので、
        // 窓口が知らない声を選んでも、これを見れば読み上げられる
        base: baseVoiceOf(rosterId),
        // ElevenLabs の Voice ID。名簿(`src/data/clipVoices.js`)にある。
        // 無ければ窓口は標準の声で作る
        elevenVoice: elevenIdOf(rosterId) || undefined,
        /* **訛りを最大限に活かす指定**(2026-09 利用者の指定)。
           **どの声にも必ず添える**(「全てのスピーカーに適用してください。
           アメリカのスピーカーでもです」)。
           名簿に無い id(代役)でも同じものが返る。
           判断は `voiceSettingsOf()` 1か所(名簿の側) */
        elevenSettings: voiceSettingsOf(rosterId),
        /* **その声を、どのモデルで鳴らすか**(2026-09 利用者の指定)。
           利用者は ElevenLabs の画面で**聴いてから**選んでいるので、
           **聴いたモデルで鳴らさないと別物になる。**
           名簿に書いていない声は v3(`voiceModelOf` が既定を返す)。
           **判断は名簿の側1か所** —— 窓口は受け取って渡すだけである */
        elevenModel: voiceModelOf(rosterId),
      },
    })
    /* **窓口が断ったときは、中身が `error` の側に入る。**
       `data ?? {}` だけで済ませていたので、**理由を一度も読めていなかった**
       (2026-09 実機。画面には「non-2xx」という決まり文句しか出ていなかった) */
    const body = data ?? await errBody(error)
    noteFnRev(body.fnRev)
    // **`cached` も返す。** 作り直しを頼んだのに「もうある」で返ってきたら、
    // それは**窓口がまだ古い**という意味である(下の `remakeClip`)
    /* **作れたら、前の知らせを引っ込める。** 一度失敗しても、
       次に作れたのなら「作れませんでした」はもう本当ではない */
    if (body.url) {
      /* **落ちたのなら、黙って消さない**(2026-09 実機)。
       *
       *   > イギリスの男性、Jofra でスピーチを作成しようとしたら、
       *   > google の女性の音声で生成されました。
       *
       * 窓口が良い声に断られて標準の声に落ちたときも `url` は返る。
       * ここで消すと**音は鳴るので、なぜ声が違うのかを知る道が
       * どこにも無くなる。** 文は窓口が言い切っているので、そのまま出す
       * (**起きたことは、呼んだ側がいちばんよく知っている**) */
      if (body.fellBack && body.detail) {
        lastReason = body.detail
        setDetail(body.detail)
      } else {
        lastReason = ''
        clearDetail()
      }
      return { url: body.url, cached: !!body.cached }
    }
    if (body.fatal) stopped = true
    /* **知らせは、それだけで意味が通る1文にする**(2026-09 実機)。
       画面の側に「作れませんでした」と決め打ちしていたので、
       **版が古いことを伝えるだけの知らせにも**その文が付き、
       **作ろうともしていないのに「作れませんでした」**と出ていた。
       起きたことは呼んだ側がいちばんよく知っている。ここで書く */
    lastReason = body.detail || error?.message || ''
    if (lastReason) setDetail(`${FAILED} ${lastReason}`)
    return null
  } catch (e) {
    // 窓口をまだ配置していないと、ここに来る。**毎回叩きに行かない**
    stopped = true
    lastReason = `読み上げ音声の窓口につながりません(${e?.message ?? e})。`
      + 'Supabase の Edge Functions に speak が配置されているか確認してください。'
    setDetail(`${FAILED} ${lastReason}`)
    return null
  }
}

/**
 * その英文の MP3 が置かれる**はずの**場所を返す。
 *
 * **あるかどうかは、ここでは確かめない。** 先に HEAD で問い合わせると
 * 往復が1回増え、控えが効いていて一瞬で鳴るはずの場合まで遅くなる。
 * 「鳴ったか、鳴らなかったか」で判るので、それで足りる。
 */
export async function clipUrl(text, voiceId = DEFAULT_CLIP_VOICE, tier = STANDARD) {
  if (!canUseClips()) return null
  const body = normText(text)
  if (!body) return null
  const voice = pathVoice(voiceId, tier)
  const key = `${tier}|${voice}|${body}`
  if (urlCache.has(key)) return urlCache.get(key)
  if (gaveUp.has(key)) return null

  const hash = await fingerprint(voice, body)
  const url = publicUrlOf(tier, voice, hash)
  /* **作り直した英文なら、控えを素通りさせる。**
     置き場所は同じままなので、印が無いと端末に残った1年もちの
     古い MP3 が鳴り、**作り直しが永久に届かない**(上の節) */
  const mark = remadeMark(`${tier}|${hash}`)
  const out = mark ? `${url}?v=${mark}` : url
  urlCache.set(key, out)
  return out
}

/* ══════════════════════════════════════════════════════════════════
 * **文字ごとの、本当の時刻**(2026-09 利用者の指摘)
 *
 *   > 再生中の文章のハイライトのタイミングをもっと正確にできないですか?
 *
 * 段落ごとの MP3 では、色は **`wordMarks()` の見積もり**で動いていた
 * (語の長さと句読点から、全体の長さを比で割る)。**合っているのは
 * 合計だけ**で、途中はどこもずれる —— 長い語・数字・固有名詞が来ると、
 * そこから先がまとめて前後する。
 *
 * 窓口(`speak`・`2026-09-07` から)は、ElevenLabs から返ってくる
 * **文字ごとの時刻**を MP3 のとなりに `.json` で置くようになった。
 * あるなら読んで、**見積もりをやめる。**
 *
 * 【無くても壊れない】
 *   **作り直すまで、すでにある MP3 には `.json` が無い。**
 *   そのときは `null` を返し、これまでどおり見積もりで動く
 *   (行き止まりを作らない)。
 *
 * 【一度読んだら覚える。無かったことも覚える】
 *   段落を行き来するたびに取りに行かない。**無かった**ことも覚える ——
 *   古い教材で、段落を送るたびに 404 を出し続けない。
 * ══════════════════════════════════════════════════════════════════ */

/** 読んだ時刻(と、無かったという答え)。この画面のあいだだけ */
const timesCache = new Map()

/**
 * その英文の「文字ごとの時刻」を取りに行く。
 *
 * **窓口は呼ばない。** 置いてある `.json` を読むだけなので、
 * **1円もかからない**(まだ無ければ、ただ無いと分かるだけ)。
 *
 * @returns {Promise<object|null>} `alignment` そのもの。無ければ `null`
 */
export async function clipAlignment(text, voiceId = DEFAULT_CLIP_VOICE, tier = STANDARD) {
  if (!canUseClips()) return null
  const body = normText(text)
  if (!body) return null
  const voice = pathVoice(voiceId, tier)
  const key = `${tier}|${voice}|${body}`
  if (timesCache.has(key)) return timesCache.get(key)

  const hash = await fingerprint(voice, body)
  // **MP3 と同じ道の `.json`。** 窓口と同じ規則にすること
  const base = publicUrlOf(tier, voice, hash).replace(/\.mp3$/, '.json')
  /* **作り直した英文なら、控えを素通りさせる**(`clipUrl` とまったく同じ印)。
     作り直すと音が変わるので、**古い時刻のまま光ると、音とずれる** */
  const mark = remadeMark(`${tier}|${hash}`)
  const url = mark ? `${base}?v=${mark}` : base
  let out = null
  try {
    const res = await fetch(url)
    if (res.ok) {
      const got = await res.json()
      /* **同じ英文のものか、必ず確かめる。** 置き場所は英文の指紋で
         決まるので、ふつうはずれない。それでも念のため見る ——
         **別の英文の時刻で光るのは、光らないより悪い** */
      out = (got && normText(got.text) === body) ? (got.alignment ?? null) : null
    }
  } catch { /* 読めなくても困らない。見積もりに戻るだけ */ }
  timesCache.set(key, out)
  return out
}

/** 「その場所には無かった」と分かったときに呼ぶ。窓口に作らせて場所を返す */
export async function makeClip(text, voiceId = DEFAULT_CLIP_VOICE, tier = STANDARD) {
  if (!canUseClips()) return null
  const body = normText(text)
  const voice = pathVoice(voiceId, tier)
  const key = `${tier}|${voice}|${body}`
  if (gaveUp.has(key)) return null
  const made = await askForClip(body, voice, tier, voiceId)
  if (!made?.url) { gaveUp.add(key); urlCache.delete(key); return null }
  urlCache.set(key, made.url)
  return made.url
}

/**
 * **もう一度作り直す**(2026-09 実機)。
 *
 *   > Mika のひとつ目の発言だけ、明らかに ElevenLabs ではない
 *   > 酷い音声になってしまいます。
 *
 * 良い段の場所に**標準の声の MP3 が居座っている**ことがある
 * (窓口を直す前に一度でも鳴らした英文。`speak` の `madeTier` の説明)。
 * 画面はその場所を見て「ある」ので鳴らして終わり、窓口はもう呼ばれない。
 * だから**こちらから作り直させる道**が要る。
 *
 * 【置き場所は同じなので、控えを外す】
 *   同じ URL のまま中身だけが変わる。ブラウザにも CDN にも
 *   **1年もつ**指定(`max-age=31536000`)で入っているので、
 *   そのままでは古い音のまま鳴る。**うしろに印を足して別の URL にする。**
 */
export async function remakeClip(text, voiceId = DEFAULT_CLIP_VOICE, tier = STANDARD) {
  if (!canUseClips()) return null
  const body = normText(text)
  if (!body) return null
  const voice = pathVoice(voiceId, tier)
  const key = `${tier}|${voice}|${body}`
  const made = await askForClip(body, voice, tier, voiceId, true)
  if (!made?.url) return null
  /* **「もうあるので作りませんでした」で返ってきたら、作り直せていない。**
     窓口がまだ古い(`force` を知らない)ということなので、
     **成功として返さない。** 成功と失敗を同じ見た目で終わらせない
     (CLAUDE.md)。押した人は「直したのに直らない」で悩むことになる */
  if (made.cached) {
    setDetail('読み上げ音声を作り直せませんでした。Supabase の Edge Functions →'
      + ' speak を、いまのコードで配置し直してください'
      + '(いまの窓口は「作り直す」に対応していません)。')
    return null
  }
  /* **控えを素通りさせる。** 印は作り直した時刻(必ず毎回ちがう値になる)。
     **端末にも残す**(`noteRemade`)。ここだけに置いていたので、
     画面を読み込み直すと素の URL に戻り、1年もちの古い MP3 が
     鳴っていた —— **課金して作り直したものが、誰にも届いていなかった** */
  const stamp = Date.now()
  noteRemade(`${tier}|${await fingerprint(voice, body)}`, stamp)
  const fresh = `${made.url}?v=${stamp}`
  gaveUp.delete(key)
  urlCache.set(key, fresh)
  /* **時刻の控えも忘れる。** 作り直すと音が変わるので、
     覚えたままだと**古い時刻で光り、音とずれる。**
     ここで消せば、次に鳴らすときに新しい `.json` を読みに行く */
  timesCache.delete(key)
  return fresh
}

/* ══════════════════════════════════════════════════════════════════
 * 本文を**1本で**取りに行く(2026-09 利用者の指定)
 *
 *   > 会話は、話者ごとに個別MP3を生成してアプリ側で連結せず、
 *   > ElevenLabs の Text to Dialogue API を使い…1本の音声として生成する。
 *
 *   継ぎ目が無くなるので、発言と発言のあいだの「プチッ」も無くなる。
 *   区切り(何番目が何秒から何秒か)は `wholeAudio.js` が出す。
 *   **判断を2か所に置かない。**
 *
 *   **失敗しても行き止まりにしない。** ここが null を返したら、
 *   呼んだ側(`readAloud.js`)は**これまでどおり発言ごと**に鳴らす。
 * ══════════════════════════════════════════════════════════════════ */

/** 一度取れたものは覚えておく(同じ教材を開くたびに問い合わせない) */
const wholeCache = new Map()
/** 作れないと分かったもの。**この画面のあいだ、二度と頼まない** */
const wholeGaveUp = new Set()

/** 直近の「1本にまとめられなかった理由」。**支度の帯がそのまま出す** */
let wholeNote = null
export const lastWholeDetail = () => wholeNote

/** 置き場所。**窓口と同じ規則にすること**(ずれると二重に課金される) */
const wholeUrlOf = (hash, ext) =>
  `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${CLIP_REV}/premium/whole/${hash}.${ext}`

/** 控えた時刻(JSON)を読む。**無ければ null**(まだ作られていない) */
async function readWholeJson(url) {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return await res.json()
  } catch { return null }
}

/**
 * 1本にまとめるときの**鍵**。
 *
 * **`wholeClip` と `wholeClipUrl` が、同じものを使う。**
 * 片方に書き写すと、**置き場所が食い違って二重に課金される**
 * (`speakChunks` を作り直しの側に通していなかったのと同じ根)。
 *
 * @returns {{mark, body, voices, elevenIds}|null} 1本にできないなら null(理由は `wholeNote`)
 */
function wholeKeyOf(texts, voiceIds) {
  const body = (texts ?? []).map((t) => normText(t))
  const voices = voiceIds ?? []
  if (body.length < 2 || voices.length !== body.length) {
    wholeNote = '本文が2つ以上ありません'
    return null
  }
  if (body.some((t) => !t)) { wholeNote = '空の本文があります'; return null }

  // **名簿に無い声が混じっていたら、1本にはできない**(Voice ID が要る)
  const elevenIds = voices.map((v) => elevenIdOf(v))
  if (elevenIds.some((v) => !v)) {
    /* 名簿に無い声(代役)が混じっている。**Voice ID が無いと1本にできない** */
    wholeNote = '名簿に無い声が混じっています(教材の声を選び直すと1本にできます)'
    return null
  }
  return { mark: wholeMark(voices, body), body, voices, elevenIds }
}

/**
 * **もう置いてある1本を探すだけ。** 窓口は呼ばないので**1円もかからない。**
 *
 * ── なぜ要るのか(2026-09 実機)─────────────────────────────────
 *
 *   > 2度通しで再生しているのにこう表示される
 *   > 「まだ作られていない音声が 14 本あります (全 14 本)」
 *
 *   **本文の読み上げは「1本にまとめる」に統一されている**(CLAUDE.md)。
 *   つまり通しで聴いても、**発言ごとの MP3 は1本も作られない。**
 *   ところが音声のダウンロードは発言ごとに集めていたので、
 *   **何度聴いても、永久に「14 本足りません」**と出ていた。
 *
 *   あちらに要るのは **MP3 の中身だけ**で、時刻(区切り)は要らない。
 *   だから `wholeClip` とは別に、**置いてあるかどうかだけ**を見る。
 *
 * - **`wholeGaveUp` は見ない。** あれは「時刻が本文と合わない」でも立つが、
 *   そのとき **MP3 そのものは置いてある。** 落とすぶんには何の支障もない
 * - **作らない。** 無ければ `null` を返すだけ(**見えない費用は管理できない**)
 *
 * @returns {Promise<string|null>} 置いてあれば URL、まだなら null
 */
export async function wholeClipUrl({ texts, voiceIds }) {
  if (!canUseClips() || !supabase) return null
  const key = wholeKeyOf(texts, voiceIds)
  if (!key) return null
  /* **作り直したものは、控えの側に `?v=` 付きで入っている。**
     素の URL を返すと、1年もちの古い MP3 を落とすことになる */
  if (wholeCache.has(key.mark)) return wholeCache.get(key.mark).url ?? null
  const mp3 = wholeUrlOf(await fingerprint('whole', key.mark), 'mp3')
  try {
    const res = await fetch(mp3, { method: 'HEAD' })
    return res.ok ? mp3 : null
  } catch { return null }
}

/**
 * 本文まるごとの音声を取りに行く。
 *
 * @param {object} o
 * @param {string[]} o.texts    段落 / 発言の英文(並び順そのまま)
 * @param {string[]} o.voiceIds その項目を読む声(名簿の id)。texts と同じ長さ
 * @param {boolean} o.force     あっても作り直す(課金される)
 * @returns {Promise<{url: string, spans: Array}|null>}
 */
export async function wholeClip({ texts, voiceIds, force = false }) {
  if (!canUseClips() || !supabase) return null
  const key = wholeKeyOf(texts, voiceIds)
  if (!key) return null
  const { mark, body, voices, elevenIds } = key

  if (!force && wholeCache.has(mark)) return wholeCache.get(mark)
  if (!force && wholeGaveUp.has(mark)) return null

  const hash = await fingerprint('whole', mark)
  const mp3 = wholeUrlOf(hash, 'mp3')
  const json = wholeUrlOf(hash, 'json')

  // ① すでに置いてあれば、窓口を呼ばない(1円もかからない)
  if (!force) {
    const had = await readWholeJson(json)
    if (had) {
      const spans = spansOf(had.alignment, body)
      /* **時刻そのものも返す。** 1文ずつの ◁▷ は、同じ時刻から
         文の区間を出す(`sentenceSpansOf`)。**二度取りに行かない** */
      const out = spans ? { url: mp3, spans, alignment: had.alignment } : null
      if (!out) {
        /* **時刻が当てはまらない。** 区切れないものを当てずっぽうで
           区切ると、別の発言の場所を指す。1本にするのはあきらめる。
           **知らせは出さない**(下記・段落ごとの音声でちゃんと鳴る) */
        wholeGaveUp.add(mark)
        wholeNote = '控えた時刻が本文と合いません'
        return null
      }
      wholeCache.set(mark, out)
      wholeNote = null
      return out
    }
  }

  // ② 無いので作らせる
  try {
    const { data, error } = await supabase.functions.invoke('speak', {
      body: {
        tier: PREMIUM,
        ...(force ? { force: true } : {}),
        // **設定は先頭の声のもの。** Text to Dialogue は全体に1つしか取らない
        elevenSettings: voiceSettingsOf(voices[0]),
        whole: { mark, texts: body, elevenIds },
      },
    })
    const res = data ?? await errBody(error)
    noteFnRev(res.fnRev)
    if (!res.url) {
      /* **黙って落ちない。** ここで諦めても、呼んだ側は
         これまでどおり発言ごとに鳴らすので、音は出る */
      wholeNote = res.detail || error?.message || '窓口が音声を返しませんでした'
      wholeGaveUp.add(mark)
      return null
    }
    const made = await readWholeJson(force ? `${json}?v=${Date.now()}` : json)
    const spans = spansOf(made?.alignment, body)
    if (!spans) {
      wholeNote = '読み上げ音声の時刻を読めませんでした'
      wholeGaveUp.add(mark)
      return null
    }
    /* **作り直したときは、控えを素通りさせる。** 置き場所は同じままで、
       1年もつ指定で入っているため(`remakeClip` と同じ落とし穴) */
    const stamp = force ? `?v=${Date.now()}` : ''
    const out = { url: `${res.url}${stamp}`, spans, alignment: made.alignment }
    wholeCache.set(mark, out)
    wholeGaveUp.delete(mark)
    wholeNote = null
    clearDetail()
    return out
  } catch (e) {
    wholeNote = `窓口につながりません(${e?.message ?? e})`
    wholeGaveUp.add(mark)
    return null
  }
}

/**
 * 次に鳴らすものを、いま鳴らしているあいだに用意しておく。
 * 会話は発言ごとに1本なので、これが無いと発言のたびに間があく。
 * **失敗しても何もしない。** 先読みのために画面を止めない。
 */
export function prefetchClip(text, voiceId = DEFAULT_CLIP_VOICE, tier = STANDARD) {
  if (!canUseClips()) return
  /* **文字ごとの時刻も、ここで温めておく**(2026-09)。
     控えに入っていれば、次の段落は**待たずに**正確な色で鳴らせる。
     `.json` は数十 KB で、しかも同じ CDN から来る。
     読めなくても困らない —— これまでどおり見積もりに戻るだけである */
  clipAlignment(text, voiceId, tier).catch(() => {})
  clipUrl(text, voiceId, tier).then((url) => {
    if (!url) return
    // **`fetch` では取りに行かない。** 別のドメインなので CORS の許しが要る。
    // `<audio>` の先読みなら要らず、しかも端末の控えにそのまま入る。
    // ここで作った札は鳴らさない。控えを温めるためだけのもの
    const warm = new Audio()
    warm.preload = 'auto'
    warm.addEventListener('error', () => { makeClip(text, voiceId, tier) })
    warm.src = url
    warm.load()
  }).catch(() => {})
}

/**
 * 鳴っているものを止める。
 *
 * **待っている約束(Promise)も、その場で終わらせる。**
 * 止めても `ended` は来ないので、終わらせないと呼んだ側が待ち続ける。
 */
let endCurrent = null

/**
 * @returns {number} **止めた時点で、どこまで鳴っていたか**(秒)。
 *
 * 【なぜ返すのか】(2026-09 利用者の指定)
 *
 *   > 全文を聞いている途中にストップを押し、もう一度再生を押すと、
 *   > また元に戻ってしまいます。止めた場所から再び再生する機能がほしいです。
 *
 * **控えるのはここではない。** ここは「いま鳴っているもの」しか知らず、
 * それが何番目の段落なのかも、どの教材のものなのかも分からない。
 * だから**数字だけを返し、覚えるのは `readAloud.js` 1か所**にする
 * (判断を2か所に置かない・CLAUDE.md)。
 */
/**
 * **いま鳴っているものの、いまの秒**。鳴っていなければ `null`。
 * 1文ずつの送り戻し(◁▷)が、飛ぶ先を決めるために使う。
 */
export function clipTime() {
  if (!element || element.paused) return null
  const t = Number(element.currentTime)
  return Number.isFinite(t) ? t : null
}

/**
 * **いま鳴っているものの長さ(秒)**。鳴っていなければ `null`。
 *
 * 1本にまとめられなかった教材では、文の区間を**割合**で控えてある
 * (`sentenceShares`)。押された瞬間にこれを掛けて秒に直す。
 */
export function clipDuration() {
  if (!element || element.paused) return null
  const d = Number(element.duration)
  return Number.isFinite(d) && d > 0 ? d : null
}

/**
 * いま鳴っているものの「なだらかな上げ下げの起点」を書き換える窓口。
 * **鳴らしているあいだだけ入っている**(`playClip` が入れ、終わりで外す)。
 */
let fadeOrigin = null

/**
 * **鳴らしたまま、場所だけを移す**(2026-09 利用者の指定・1文ずつの ◁▷)。
 *
 * **止めて鳴らし直さない。** 止めると `stopClip()` が
 * 「どこまで聴いたか」を控えてしまううえ、鳴らし直しのあいだ黙る。
 * `currentTime` を動かすだけなら、その場で続きが鳴る。
 *
 * ────────────────────────────────────────────────────────────────
 * **戻したら、なだらかな上げ下げの起点も一緒に戻す**(2026-09)
 *
 *   `fadeGain` は「鳴らし始めてから何ミリ秒か」で入りの音量を決める。
 *   その起点(`from`)は**鳴らし始めた場所**に固定してあったので、
 *   **そこより前へ戻すと、経過が負になって音量が 0 のまま**になる。
 *   30 秒戻せば、30 秒間まるごと無音である。
 *
 *   ◁ で1文戻したときも、くり返しで文の頭へ戻すときも、必ず起きる。
 *   **音は「鳴っている」ので、押した人には固まったようにしか見えない。**
 *   戻した先を新しい起点にすれば、そこから 70ms で入り直す。
 * ────────────────────────────────────────────────────────────────
 *
 * ────────────────────────────────────────────────────────────────
 * **戻す前に、出力そのものを止めて黙らせる**(`hush`・2026-09 実機・5手め)
 *
 *   > 一瞬なのですが前の発言や文の最後の音が入ります。
 *   > 一瞬といえど違和感は非常に大きいです。
 *
 *   **Chromium では、この漏れは1刻みも起きない**(本物の `<audio>` で
 *   実測。440Hz → 880Hz の音を作り、戻したあと 400ms を 5ms ごとに
 *   解析して 0 刻み)。つまり**頭出しの外れではない。**
 *
 *   残るのは **iPhone** である。このファイルの各所に書いてあるとおり、
 *   **iOS は `<audio>` の `volume` を無視する。** だから
 *
 *     ・`fadeGain` のなだらかな上げ下げ … **効かない**
 *     ・差し替えの前に `volume = 0`     … **効かない**
 *
 *   の2つが**どちらも死んでいて、戻した瞬間の音がそのまま出る。**
 *   「プチっ」を切り落としで消せなかったときと**まったく同じ壁**である。
 *
 *   **`pause()` は `volume` に頼らない。** 出力そのものが止まるので、
 *   iPhone でも確実に黙る。止めて・移して・鳴らし直す ——
 *   **音の通り道は1ミリも変えていない**(Web Audio を通さない)。
 *
 *   - **`stopClip()` は通らない。** あれは「どこまで聴いたか」を控え、
 *     世代を進めて見張りを終わらせてしまう。ここで使うのは
 *     `el.pause()` / `el.play()` だけである
 *   - **`play()` が断られても、そこで終わらせない**(`catch`)。
 *     `<audio>` は1つを使い回しており、**すでに解錠されている**ので
 *     ふつうは通る(`stopClip` → 次を鳴らす、で毎回やっていることである)
 *   - **ふだんの ◁▷ には渡さない。** あちらは押した人が場所を動かす操作で、
 *     一瞬の途切れより**すぐ鳴り出すこと**のほうが大事である
 * ────────────────────────────────────────────────────────────────
 *
 * @param {number} sec 移す先の秒
 * @param {object} [o]
 * @param {boolean} o.hush 戻す前に出力を止めて黙らせるか(くり返しの折り返し)
 * @returns {boolean} 移せたか(鳴っていなければ false)
 */
export function seekClip(sec, { hush = false } = {}) {
  if (!element || element.paused) return false
  const t = Number(sec)
  if (!Number.isFinite(t) || t < 0) return false
  const el = element
  // **鳴らし直すのは、止めたときだけ**(断られても、そこで終わらせない)
  const wake = () => { try { el.play()?.catch?.(() => {}) } catch { /* 鳴らし直せなくても、次の折り返しで直る */ } }
  if (hush) {
    try { el.volume = 0 } catch { /* iOS は volume を無視する */ }
    try { el.pause() } catch { /* 止められなくても困らない */ }
  }
  try { el.currentTime = t } catch {
    if (hush) wake()
    return false
  }
  // **音量は `fade()` が入れ直す。** ここで戻すと、入りのフェードを飛ばす
  fadeOrigin?.(t)
  if (hush) wake()
  return true
}

export function stopClip() {
  generation += 1
  fadeOrigin = null
  const end = endCurrent
  endCurrent = null
  let at = 0
  if (element) {
    const el = element
    try {
      at = Number(el.currentTime) || 0
      cancelStopFade()
      /* **鳴っている途中で止めるときも、なだらかに下げる**
         (2026-09 利用者の指摘)。いきなり止めると、波形が途中の値のまま
         途切れて「プチッ」と鳴る。**60ms かけて 0 まで下げてから止める。**

         止めたこと自体はすぐに効く(`generation` はもう進めてある)ので、
         押した人を待たせてはいない。鳴っていなければ、その場で止める。 */
      if (!el.paused && el.volume > 0) {
        const from = el.volume
        const step = 10
        let left = FADE_STOP
        stopFade = window.setInterval(() => {
          left -= step
          if (left <= 0) {
            cancelStopFade()
            try { el.volume = 0; el.pause(); el.currentTime = 0 } catch { /* 無視 */ }
            return
          }
          try { el.volume = Math.max(0, from * (left / FADE_STOP)) } catch { cancelStopFade() }
        }, step)
      } else {
        el.volume = 0
        el.pause()
        el.currentTime = 0
      }
    } catch { /* 止められなくても困らない */ }
  }
  end?.()
  return at
}

/**
 * MP3 で読み上げる。鳴らせたら true、鳴らせなければ false を返す。
 * false のときは、呼んだ側が端末の声に切り替える。
 *
 * @param {object} o
 * @param {string} o.text     読み上げる英文
 * @param {string} o.voiceId  話者(`PREGENERATED_SPEAKERS` の id)
 * @param {number} o.rate     速さの倍率。MP3 は自然な速さで作ってあるので、
 *                            遅く・速くするのはここ(`playbackRate`)で行う
 * @param {Function} o.onWord いま読んでいる語の位置({charIndex})
 * @param {Function} o.onStart 鳴り始めたときに1回
 */
export async function playClip({
  text, voiceId = DEFAULT_CLIP_VOICE, tier = STANDARD,
  rate = 1, onWord = null, onStart = null,
  /**
   * **途中から鳴らす**(秒・2026-09 利用者の指定「止めた場所から再び再生」)。
   * 終わりぎわは 0 に落とす(残り 0.3 秒から鳴らしても意味がない)。
   */
  startAt = 0,
  /**
   * **すでに分かっている音声を、そのまま鳴らす**(2026-09)。
   * 本文まるごとの1本(`wholeClip`)はここから渡す。
   * 渡されたときは、置き場所を計算しないし、窓口にも作らせない。
   */
  srcUrl = null,
  /**
   * **途中で止める**(秒)。1本の中の「その発言だけ」を鳴らすために使う。
   * 0 なら最後まで鳴らす。
   */
  stopAt = 0,
  /** いま何秒めか(1本の中で、いま何番目かを知らせるために使う) */
  onTime = null,
  /**
   * **文字ごとの本当の時刻**(`clipAlignment()` の返り値・2026-09)。
   * 渡されたら、語の色は**見積もりではなくこれ**で動く。
   * 渡さなければ、これまでどおり `wordMarks()` で見積もる。
   */
  alignment = null,
} = {}) {
  if (!canUseClips()) return false
  const body = normText(text)
  if (!body && !srcUrl) return false

  let url = srcUrl || await clipUrl(body, voiceId, tier)
  if (!url) return false

  const mine = (generation += 1)
  const el = audioElement()

  /**
   * 1回だけ鳴らしてみる。鳴らせなければ false。
   *
   * 【差し替えは、必ず「止めて・黙らせて」から】(2026-09 利用者の指摘)
   *
   *   > 発言と発言の間、特に、ひとつの発言の終わりに小さく
   *   > 「プチっ」というノイズが入ってます。
   *
   *   `<audio>` は**1つだけを使い回している**(iPhone の解錠をやり直さない
   *   ため)。次の発言に移るとき、鳴り終わったままの `<audio>` に
   *   新しい `src` を入れて `load()` している。**これは再生の仕組みを
   *   いったん壊して作り直す操作**で、そのとき音の出口に段差ができる。
   *   これが発言の切れ目で「プチッ」と鳴っていた正体である。
   *
   *   **鳴らす音そのものは変えない**(音の通り道を変えない・CLAUDE.md)。
   *   することは2つだけ。
   *
   *   ① 先に `pause()`。鳴っている最中に作り直させない
   *   ② **`volume` を 0 にしてから差し替える。** 段差ができても、
   *      音量が 0 なら**聞こえない。** 本当の音量は、読み込みが
   *      終わったあと `applyGain()` が入れ直す(この順は変えない)
   *
   *   ②は**すでに使っている `<audio>` の `volume`** であって、
   *   `GainNode` ではない。通り道は1ミリも増えていない。
   */
  const tryPlay = (src) => new Promise((resolve) => {
    let settled = false
    const done = (ok) => {
      if (settled) return
      settled = true
      el.removeEventListener('loadeddata', onLoaded)
      el.removeEventListener('error', onError)
      resolve(ok)
    }
    const onLoaded = () => done(true)
    const onError = () => done(false)
    el.addEventListener('loadeddata', onLoaded)
    el.addEventListener('error', onError)
    try {
      // 止めるときの下げが走っていたら捨てる(これから別の音を鳴らす)
      cancelStopFade()
      // ① 鳴っている最中に作り直させない
      el.pause()
      // ② 差し替えのあいだは黙らせる。**段差ができても聞こえない。**
      //    本当の音量は、下の `applyGain()` が読み込みのあとに入れ直す
      el.volume = 0
      el.src = src
      el.load()
    } catch { done(false) }
    // 取りに行けないまま待ち続けない。10秒で諦めて端末の声に戻す
    window.setTimeout(() => done(false), 10000)
  })

  let ok = await tryPlay(url)
  if (mine !== generation) return true   // 止められた・別のものが始まった
  if (!ok) {
    // **渡された音声が鳴らせないなら、そこで諦める**(作り直させない)
    if (srcUrl) return false
    // その場所には無かった。窓口に作らせる
    url = await makeClip(body, voiceId, tier)
    if (!url) return false
    if (mine !== generation) return true
    ok = await tryPlay(url)
    if (!ok) return false
    if (mine !== generation) return true
  }

  // **声ごとの速さの補正を掛ける**(2026-09 利用者の指定)。
  // もともと遅い声(Jofra / Henry)がある。ElevenLabs の v3 は `speed` に
  // 対応していないので窓口では直せず、鳴らすときに直す。
  // **MP3 は作り直さない**ので、費用はかからない
  el.playbackRate = rate * voiceRateOf(voiceId)
  // 速さを変えても声の高さは変えない(既定でそうなるが、明示しておく)
  if ('preservesPitch' in el) el.preservesPitch = true

  // **いちばん小さい声に合わせて下げる。上げはしない**(2026-09 利用者の指定)。
  // まだ測っていない声は 1(そのまま)なので、
  // **その声の1本目だけはそろわない。** 鳴らし終えたあとに測って覚える
  const pathName = pathVoice(voiceId, tier)
  /* **この声の音量。** すぐには入れず、下の `tick` が**なだらかに上げる。**
     いきなり 0 から本来の音量へ跳ぶと、そこに段差ができて「プチッ」と鳴る
     (2026-09 利用者の指摘。下の `FADE_IN` / `FADE_OUT`) */
  const gain = applyGain(el, tier, pathName)
  el.volume = 0

  /* **止めた場所から鳴らす**(2026-09 利用者の指定)。
     `loadeddata` まで来ているので、ここでは長さが分かっている。
     **終わりぎわは頭から鳴らす** — 残り 0.3 秒から再開しても、
     押した人には「鳴らなかった」ようにしか見えない。 */
  if (startAt > 0) {
    const len = Number(el.duration) || 0
    try { el.currentTime = (len && startAt >= len - 0.3) ? 0 : startAt } catch { /* 無視 */ }
  }

  return new Promise((resolve) => {
    let frame = 0
    let index = -1
    let shown = -1                       // いま入れてある音量(入れ直しを減らす)
    /* **本当の時刻があるなら、見積もらない**(2026-09 利用者の指摘)。
       `wordMarks()` は語の長さと句読点から全体の長さを比で割るので、
       **合っているのは合計だけ**である。窓口が控えた文字ごとの時刻
       (`clipAlignment`)を渡してもらえたら、そちらをそのまま使う。
       当てはめられなければ空が返るので、**そのときは見積もりに戻る** */
    const exact = alignment ? marksFromTimes(body, charTimesOf(alignment, body)) : []
    const marks = exact.length ? exact : wordMarks(body, (el.duration || 0) * 1000)
    /* 鳴らし始めた場所(続きから鳴らすとき)。
       **戻したときは書き換える** — `seekClip()` を参照 */
    let from = Number(el.currentTime) || 0
    const moveOrigin = (t) => { from = Number(t) || 0 }
    fadeOrigin = moveOrigin

    /* **画面の描き替え(約 16ms)ではなく、10ms ごとに回す**(2026-09 実測)。
       rAF だと鳴り終わりの最後のコマが「残り 41ms」で、
       **音量 0.205 のまま終わっていた** — 半分の高さから急に切れていた。
       語の色もここで進めるが、10ms は 16ms より細かいので損はしない */
    const stopTrack = () => { if (frame) { window.clearInterval(frame); frame = 0 } }

    /**
     * **入りと終わりを、なだらかにする**(2026-09 利用者の指摘)。
     *
     *   > まだ会話の発言と発言の間にプチっと入りますね。
     *   > 音の終わりをなだらかなフェードアウトにするとか、何かできるはずです。
     *
     * **前の直しでは足りなかった。** 差し替えの前に `volume = 0` にしたが、
     * **0 に「跳ぶ」こと自体が段差である。** 波形が途中の値のまま
     * いきなり 0 になれば、そこで「プチッ」と鳴る。
     * 音量を**時間をかけて**下げれば、段差そのものが無くなる。
     *
     * **音の通り道は変えない**(CLAUDE.md でいちばん高くついた失敗)。
     * 動かすのは、もともと使っている `<audio>` の `volume` だけである。
     *
     * **速さで割る。** `currentTime` は音声の中の時間なので、
     * 1.2 倍で鳴らしていれば、実際の時間はその 1/1.2 で過ぎる。
     */
    const fade = () => {
      const r = el.playbackRate || 1
      const now = Number(el.currentTime) || 0
      const len = Number(el.duration) || 0
      // 鳴り始めてから何ミリ秒か / 終わりまで何ミリ秒か(どちらも実際の時間)
      const inMs = ((now - from) / r) * 1000
      /* **終わりは「止める場所」から数える。** 1本の中の1発言だけを
         鳴らすとき、ファイルの終わりまで数えると
         **下げ始める前に切れて「プチッ」と鳴る** */
      const until = stopAt > 0 ? stopAt : len
      const outMs = until ? ((until - now) / r) * 1000 : Infinity
      // **決め方は `loudness.js` 1か所**(手元で確かめられる形にしてある)
      const v = fadeGain(gain, inMs, outMs)
      // 0.005 より細かい差は耳に届かない。入れ直す回数を減らす
      if (Math.abs(v - shown) >= 0.005 || (v === 0 && shown !== 0)) {
        shown = v
        try { el.volume = v } catch { /* iOS は volume を無視する */ }
      }
    }

    const tick = () => {
      if (mine !== generation) { stopTrack(); return }
      fade()
      // **長さも一緒に渡す。** 1本にまとめられなかった教材では、
      // 文の区間を割合で持っているので、秒に直すのにこれが要る
      onTime?.(Number(el.currentTime) || 0, Number(el.duration) || 0)
      /* **区間の終わりで止める**(2026-09)。1本にまとめた音声から
         「その発言だけ」を鳴らすときに使う。**`ended` は来ない**ので、
         ここで終わりを見て、自分で終わらせる */
      if (stopAt > 0 && (Number(el.currentTime) || 0) >= stopAt) {
        try { el.pause() } catch { /* 止められなくても困らない */ }
        finish()
        return
      }
      const next = markIndexAt(marks, el.currentTime * 1000)
      if (next >= 0 && next !== index) {
        index = next
        onWord?.({ charIndex: marks[index].at, charLength: 0 })
      }
    }

    const finish = () => {
      if (endCurrent === finish) endCurrent = null
      // **鳴り終わったら、起点の窓口を閉じる**(次の1本のものと混ざらない)
      if (fadeOrigin === moveOrigin) fadeOrigin = null
      el.removeEventListener('ended', finish)
      el.removeEventListener('error', finish)
      stopTrack()
      /* **測るのは、鳴り終わってから**(2026-09)。
         測る側は Web Audio で MP3 をほどく(`weighted()`)。
         **鳴っている最中にそれを始めると、音が一瞬途切れることがある。**
         「入る時と入らない時がある」に合う — 測るのは
         **声ごとに1回だけ**なので、その1本のときだけ起きる。

         **先に測らない**という決まりはそのままである(待たせない)。
         変えたのは「鳴らし始めた瞬間」から「鳴り終わった瞬間」へ、
         という**いつ**だけで、測る中身は1つも変えていない。 */
      /* **1本にまとめた音声は測らない**(2026-09)。
         あれは声が2人ぶん混ざっているので、「その声の大きさ」にならない。
         しかも 50 秒ぶんをほどくことになる。
         **ElevenLabs の側でそろえてくれている**ので、そのまま鳴らす */
      if (!srcUrl && !isMeasured(tier, pathName)) measureClip(url, tier, pathName)
      if (mine === generation) onWord?.(null)
      resolve(true)
    }
    el.addEventListener('ended', finish)
    el.addEventListener('error', finish)
    endCurrent = finish

    const started = el.play()
    if (started?.catch) {
      started.catch(() => {
        // 解錠できていないと、ここに来る。端末の声に戻す
        el.removeEventListener('ended', finish)
        el.removeEventListener('error', finish)
        stopTrack()
        resolve(false)
      })
    }
    onStart?.()
    /* **印が無くても回す。** 語の色だけでなく、入りと終わりの
       なだらかさ(`fade`)もここが受け持っている */
    frame = window.setInterval(tick, FADE_STEP)
  })
}
