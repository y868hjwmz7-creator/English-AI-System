// ============================================================================
// 英文の読み上げ音声(MP3)を返す窓口(Supabase Edge Function)
//
// 【なぜこれが必要か】(2026-08 実機で確定)
//   知り合いの iPhone で、開発中のリンクを **Google Chrome** で開いて
//   もらったところ、こちらで聞こえている声とはまるで違う、
//   ひどい声が出た、という報告があった。
//
//   これは不具合ではなく、**iOS の作りそのもの**である。
//     ・iOS では **すべてのブラウザの中身が Safari(WebKit)** である。
//       「Chrome を使えば回避できる」という手は存在しない
//     ・iOS は高品質な声を Web Speech API に **一切公開しない**
//       (実機で生 47 件を確認し、premium は 0 件だった)
//
//   つまり **端末の声に頼るかぎり、iPhone のゲストには良い音を届けられない。**
//   唯一の解は「こちらで音声を作って配る」ことである。
//
// 【どう解くか】
//   Azure の音声合成で MP3 を作り、Supabase Storage に置いて配る。
//   置き場所は **英文と話者から機械的に決まる**(SHA-256)。
//
//     tts/<話者>/<英文の指紋>.mp3
//
//   画面はまずこの場所を直接取りに行く。**あればこの関数は呼ばれない。**
//   Supabase の CDN から返るだけなので速く、費用もかからない。
//   無いときだけここが呼ばれ、作って置いてから場所を返す。
//
//   **同じ英文には二度払わない。** 教材はスクール全体で共有しているので、
//   最初の1人が再生した時点で、残り 1,499 人ぶんの音声が出来上がる。
//
// 【どの声を使うか】
//   Secrets にどちらの鍵を入れたかで決まる。**コードは触らなくてよい。**
//     GOOGLE_TTS_API_KEY を入れた           → Google(Chirp 3: HD)
//     AZURE_SPEECH_KEY + REGION だけ入れた  → Azure(DragonHD)
//   切り替えたら CLIP_REV を1つ進めること(画面側も同じ値にする)。
//
// 【費用】
//   無料枠は Azure が **毎月 50 万文字**、Google が **毎月 100 万文字**。
//   教材1本がおよそ 2,000 文字なので、月 250〜500 本まで無料枠に収まる。
//   超えたぶんは 100 万文字あたり Azure $16 前後 / Google $30 前後。
//   **文字数で課金される。同じ英文を作り直さないことが、そのまま節約になる。**
//
// 【安全のために】
//   ・ログインしている人だけが呼べる
//   ・Storage に **書き込めるのはこの関数だけ**(service_role)。
//     画面からは読むだけ(0016 の方針)
//   ・1回の呼び出しで1本だけ。まとめ送りにしない(費用が読めなくなる)
//
// 【SDK を読み込まない】
//   ここでやるのは「POST を2回する」だけである。Edge Function は
//   呼ばれるたびに立ち上がることがあり、大きな部品を読み込むと
//   その支度だけで1〜数秒かかる(`lookup-word` で実際に起きた)。
//   だから import を1つも持たない。
// ============================================================================

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const reply = (body: unknown, status = 200) =>
  /* **版は、どの応答にも付ける**(失敗のときも)。
     付け忘れた道が1本でもあると、そこだけ「古い」と誤って知らせる */
  new Response(JSON.stringify({ ...(body as object), fnRev: FN_REV }), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })

/**
 * **この窓口の版**(2026-09 利用者の実機)。**どの応答にも必ず付ける。**
 *
 * 【なぜ要るか】
 *   Ally の似せ具合を 1 → 0.1 に振っても、**音が1つも変わらなかった。**
 *   ここまで振れば声そのものが変わるはずなので、
 *   **指定が ElevenLabs まで届いていない**と考えるのが自然である。
 *
 *   ところが**それを確かめる道が、どこにも無かった。**
 *   窓口は Supabase の画面から利用者が置く。こちらからは、
 *   **いま置かれているものが新しいのか古いのかを見られない。**
 *   `elevenSettings` を読む版は 2026-09-04 に入ったので、
 *   置き直していなければ**指定は黙って捨てられる。**
 *   音は鳴るので、**誰も気づけない。**
 *
 *   だから版を返す。画面が見て、古ければトレーナーに知らせる。
 *   「検証を頼む前に、版が分かるようにする」(共通ルール)と同じ考え方。
 *
 * **窓口に手を入れたら、必ず1つ進める。**
 */
const FN_REV = '2026-09-05c'

/** 置き場所(Storage のバケツ)。0016 で作る */
const BUCKET = 'tts'

/**
 * 音声の**版**。置き場所の頭に付く(`tts/<版>/<話者>/<指紋>.mp3`)。
 *
 * **声を変えたら、ここを1つ進める。** そうしないと、前の声で作った
 * MP3 がそのまま返り続け、変えたことが誰にも伝わらない。
 *
 * **`src/lib/audioClips.js` の CLIP_REV と、必ず同じ値にすること。**
 * 画面と窓口の両方が同じ場所を計算する。片方だけ変えると、
 * 画面が見に行く場所と窓口が置く場所が食い違い、
 * **毎回作り直して毎回課金される。**
 */
const CLIP_REV = '1'

/**
 * 話者と、実際の音声名の対応。
 *
 * **`src/data/speakers.js` の PREGENERATED_SPEAKERS と id をそろえること。**
 * ばらばらにすると、同じ「Emma」なのに場所によって声が違う、が起きる。
 *
 * ============================================================================
 * 【声を2段に分ける】(2026-08 利用者の指定)
 *
 *   いちばん自然な声(ElevenLabs)を教材ぜんぶに使うと、月2,000本の規模で
 *   月6万〜12万円になる(第 5.2.1 節)。**声の良さが学習効果に直結する
 *   ところにだけ**使い、残りは無料枠に収まる声でまかなう。
 *
 *   | 段 | 使う音声 | どこで使うか |
 *   |---|---|---|
 *   | `premium`  | ElevenLabs | 記事・会話の本文、リスニング、発音・リズムの弱点 |
 *   | `standard` | Google / Azure | 文法ドリル、単語、フレーズ |
 *
 *   どちらの段になるかは**画面側が決める**(`src/lib/voiceTier.js`)。
 *   ここでは渡された段に従うだけ。**判断を2か所に置かない。**
 *
 * ============================================================================
 * 【標準の段は、話者ごとに会社を振り分ける】
 *
 *   無料枠は Google が毎月100万文字、Azure が毎月50万文字。
 *   **両方を使えば毎月150万文字まで無料**になる。
 *
 *   ただし**1本の教材の途中で会社を切り替えてはいけない。** 会話の1番目の発言が
 *   Google、2番目が Azure では、同じ役の声が変わって聞こえる。
 *   そこで**話者ごとに固定で振り分ける。** 会話は男女1人ずつになるので、
 *   自然と半々に分かれる。
 *
 *   割り当てを変えたいときは、この表を書き換えて **CLIP_REV を進める**。
 */

/** 標準の段で、その話者をどちらの会社に任せるか */
const SPEAKER_PROVIDER: Record<string, 'google' | 'azure'> = {
  'us-female': 'google',
  'us-male': 'azure',
  'uk-female': 'google',
  'uk-male': 'azure',
}

/**
 * Azure(標準の段)。**HD ではない Neural を使う。**
 *
 * 【なぜ HD を使わないか】(2026-08 に確認)
 *   Azure の無料枠(F0)は **HD 音声を含まない。** 含むのは HD でない
 *   prebuilt neural voice だけである。DragonHD を指定すると F0 では失敗する。
 *   標準の段の役目は「読み方が分かればよい」なので、Neural で足りる。
 *   良い声が要るところは ElevenLabs に任せる。
 */
const AZURE_VOICES: Record<string, { voice: string; lang: string }> = {
  'us-female': { voice: 'en-US-EmmaMultilingualNeural', lang: 'en-US' },
  'us-male': { voice: 'en-US-RyanMultilingualNeural', lang: 'en-US' },
  'uk-female': { voice: 'en-GB-SoniaNeural', lang: 'en-GB' },
  'uk-male': { voice: 'en-GB-RyanNeural', lang: 'en-GB' },
}

/**
 * Google Cloud Text-to-Speech の **Chirp 3: HD**(標準の段)。
 * 無料枠は毎月100万文字。超えると100万文字あたり $30。
 *
 * `要確認`: 声の名前と、鍵だけで呼べること(サービスアカウントが要らないこと)。
 * こちらから Google には通信できないため、**実機で確かめていない。**
 * 間違っていても壊れない(端末の声に戻る)。そのときは窓口が返す `detail` に
 * Google の返事がそのまま入るので、それを見て直す。
 */
const GOOGLE_VOICES: Record<string, { voice: string; lang: string }> = {
  'us-female': { voice: 'en-US-Chirp3-HD-Achernar', lang: 'en-US' },
  'us-male': { voice: 'en-US-Chirp3-HD-Charon', lang: 'en-US' },
  'uk-female': { voice: 'en-GB-Chirp3-HD-Achernar', lang: 'en-GB' },
  'uk-male': { voice: 'en-GB-Chirp3-HD-Charon', lang: 'en-GB' },
}

/**
 * ElevenLabs(良い段)。**どの声を使うかは画面が決めて送ってくる。**
 *
 * 【なぜ窓口が声の名簿を持たないのか】(2026-08 に方針を変えた)
 *   利用者は訛りごとに何人も声を選ぶ(10訛り × 3人なら30人)。
 *   名前・性別・向き(ナレーション / 会話)は画面が要るので、
 *   名簿は `src/data/clipVoices.js` にある。
 *   **窓口にも同じ名簿を置くと、30行を2か所でそろえることになる。**
 *   いつか必ずずれるので、置かない。
 *
 *   Voice ID は**鍵ではない。** ElevenLabs の声を指す番号にすぎず、
 *   これだけでは何もできない(API キーが別に要る)。だから画面から
 *   送ってもらう。**API キーは Secrets のまま。** あれは鍵である。
 *
 * 【送られてきた id は形だけ確かめる】
 *   ログインしている人しか呼べないが、思わぬ値でそのまま呼ばない。
 */
const cleanElevenId = (raw: unknown) => {
  const id = String(raw ?? '').trim()
  return /^[A-Za-z0-9]{16,48}$/.test(id) ? id : ''
}

/**
 * ElevenLabs のモデル。**Secrets の ELEVENLABS_MODEL で差し替えられる。**
 *
 * 【既定は v3。利用者が選んだ声が v3 だからである】(2026-09 利用者の指定)
 *
 *   > 私は全ての音声サンプルをV3からのみ選んでいます。
 *   > 忘れないように記録してください。私が使うのはV3の音声のみです。
 *
 *   **名簿(`src/data/clipVoices.js`)の声は、すべて ElevenLabs の
 *   v3 で聴いて選ばれている。** ところがここは長らく
 *   `eleven_multilingual_v2` を頼んでいた。つまり
 *   **利用者が聴いた音と、このアプリが鳴らす音は、別のモデルの出力**
 *   だった。これは二度と尋ねない決まりごとなので、既定に据える。
 *
 * 【落ちる道は用意しておく】
 *   v3 が使えるかどうかは**プランによる**。こちらからは確かめられない
 *   (この環境から ElevenLabs へは鍵が無く、Supabase にも届かない)。
 *   断られたら v2 で作り直し、**どちらで作ったかを返す**
 *   (`madeModel`)。**黙って別のモデルに落ちない。**
 */
const ELEVEN_MODEL_DEFAULT = 'eleven_v3'

/** 断られたときに落ちる先。**ここまでで止める**(際限なく試さない) */
const ELEVEN_MODEL_FALLBACK = 'eleven_multilingual_v2'

/** 画面から受け取ってよいモデル。**知らない名前は既定に落とす。**
    書き間違いをそのまま ElevenLabs へ流すと 422 で断られ、音が鳴らなくなる */
const ELEVEN_MODELS = [ELEVEN_MODEL_DEFAULT, ELEVEN_MODEL_FALLBACK]

/** v3 かどうか。落ち方と `stability` の丸め方が変わる。
    **区切りは `_`。** `[^\w]` にすると `_` が語の文字なので当たらない
    (`eleven_v3` が v3 でないことになる。実際に間違えた) */
const isV3 = (model: string) => /(^|_)v3($|_)/.test(model)

/**
 * v3 が受け取る `stability` は、**とびとびの3つ**だと言われている
 * (0 / 0.5 / 1)。**こちらでは確かめられない**ので、
 * **先回りして丸めない。**
 *
 * 断られたときにだけ、いちばん近い値に寄せてもう一度試す。
 * 先に丸めると、v3 が 0.35 を受け取れる場合に
 * **利用者の指定(0.35)を勝手に書き換える**ことになる。
 */
const V3_STABILITY = [0, 0.5, 1]
const snapStability = (v: number) =>
  V3_STABILITY.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a))

const DEFAULT_VOICE = 'us-female'

/**
 * 1回で作る英文の長さの上限。
 *
 * 記事は段落ごと、会話は発言ごとに読み上げるので、実際はこれより短い。
 * 上限を置くのは、**誤って本文まるごとを送ったときに費用が跳ねない**ようにするため。
 */
const MAX_CHARS = 2000

/**
 * 英文の「指紋」。**画面側(`src/lib/audioClips.js`)と同じ規則にすること。**
 * ずれると同じ英文の音声を二度作ることになり、そのぶん課金される。
 *
 * 空白の連なりだけをそろえる。**小文字にはしない。**
 * 大文字か小文字かで読み方(強調・略語の読み)が変わるためである。
 */
const normText = (text: string) => String(text ?? '').replace(/\s+/g, ' ').trim()

async function fingerprint(voiceId: string, text: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${voiceId}|${text}`)
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** SSML に埋め込むための記号の置き換え */
const escapeXml = (text: string) =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')

/**
 * Azure に作らせる。
 *
 * **速さは変えない。** 自然な速さで作り、遅く・速くするのは画面側
 * (`playbackRate`)の仕事である。段階ごとに作ると費用も置き場所も5倍になる。
 * (DragonHD はそもそも `prosody` の速さ指定に対応していないので、
 *  この決め方でちょうど噛み合っている)
 */
async function synthAzure(
  text: string, speaker: { voice: string; lang: string }, key: string, region: string,
) {
  const ssml =
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis"`
    + ` xml:lang="${speaker.lang}"><voice name="${speaker.voice}">`
    + `${escapeXml(text)}</voice></speak>`

  const res = await fetch(
    `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`,
    {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': key,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
        'User-Agent': 'english-ai-system',
      },
      body: ssml,
    },
  )
  if (!res.ok) {
    return { error: humanTtsError('Azure', res.status, await res.text().catch(() => '')) }
  }
  return { audio: await res.arrayBuffer() }
}

/**
 * Google Cloud Text-to-Speech に作らせる(Chirp 3: HD)。
 *
 * 鍵1つで呼べる形にしてある(`?key=`)。サービスアカウントの JSON を
 * 扱わせない。**利用者に秘密鍵ファイルを触らせない**ためである。
 *
 * 返ってくるのは base64 の文字列なので、ここでバイト列に戻す。
 */
async function synthGoogle(
  text: string, speaker: { voice: string; lang: string }, key: string,
) {
  const res = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(key)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { text },
        voice: { languageCode: speaker.lang, name: speaker.voice },
        // Chirp 3: HD は速さ・高さの指定に対応していない。**付けない。**
        audioConfig: { audioEncoding: 'MP3' },
      }),
    },
  )
  if (!res.ok) {
    return { error: humanTtsError('Google', res.status, await res.text().catch(() => '')) }
  }
  const body = await res.json().catch(() => ({}))
  const b64 = String(body?.audioContent ?? '')
  if (!b64) {
    return {
      error: {
        error: GENERIC,
        detail: 'Google が音声を返しませんでした。返事: '
          + JSON.stringify(body).slice(0, 300),
        fatal: false,
      },
    }
  }
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i)
  return { audio: bytes.buffer }
}

/**
 * ElevenLabs に作らせる(良い段)。
 *
 * MP3 がそのまま返るので、変換は要らない。
 * **速さも高さも指定しない。** 自然な速さで作り、遅く・速くするのは
 * 画面側(`playbackRate`)の仕事である。
 */
/**
 * 画面から来た ElevenLabs の指定を、そのまま渡せる形にする。
 *
 * **窓口は声の名簿を持たない**(訛りの一覧は画面側だけが持つ)。
 * だからここでは「どの声か」ではなく、**中身が正しいか**だけを見る。
 *
 *   ・知らない欄は捨てる
 *   ・0〜1 の数に丸める(範囲の外を送ると 422 で断られる)
 *   ・1つも残らなければ `null`(= 何も添えない。これまでどおり)
 */
const ELEVEN_SETTING_KEYS = ['stability', 'similarity_boost', 'style'] as const

function cleanElevenSettings(raw: unknown): Record<string, number | boolean> | null {
  if (!raw || typeof raw !== 'object') return null
  const src = raw as Record<string, unknown>
  const out: Record<string, number | boolean> = {}
  for (const k of ELEVEN_SETTING_KEYS) {
    const n = Number(src[k])
    if (Number.isFinite(n)) out[k] = Math.min(Math.max(n, 0), 1)
  }
  if (typeof src.use_speaker_boost === 'boolean') {
    out.use_speaker_boost = src.use_speaker_boost
  }
  return Object.keys(out).length ? out : null
}

async function synthEleven(
  text: string, voiceId: string, key: string, model: string,
  settings: Record<string, number | boolean> | null = null,
) {
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': key,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      /* **指定が来たときだけ添える。**
         付けない声には、これまでどおり何も送らない(ElevenLabs の既定)。
         いまの音を変えないためである(2026-09 利用者の指定) */
      body: JSON.stringify(
        settings ? { text, model_id: model, voice_settings: settings }
          : { text, model_id: model },
      ),
    },
  )
  if (!res.ok) {
    return { error: humanTtsError('ElevenLabs', res.status, await res.text().catch(() => '')) }
  }
  return { audio: await res.arrayBuffer() }
}

/**
 * **v3 で作る。断られたら落ちる。** そして**どれで作ったかを返す。**
 *
 * 上から順に試して、通った時点で終わり。**3回で止める。**
 *
 *   ① 頼まれたモデル(既定は v3)＋ 画面から来た指定そのまま
 *   ② v3 のときだけ … `stability` をとびとびの値(0 / 0.5 / 1)に寄せて
 *   ③ v2 ＋ 指定そのまま
 *
 * ②があるのは、v3 が `stability` に 0.35 のような値を受け取らない
 * という話があるためである。**確かめていない**ので先回りはせず、
 * 断られたときにだけ寄せる。
 *
 * **黙って落ちない。** 返した `model` は応答に載せる(`madeModel`)ので、
 * 「v3 のはずが v2 だった」を画面から見分けられる。
 */
async function synthElevenBest(
  text: string, voiceId: string, key: string, model: string,
  settings: Record<string, number | boolean> | null,
) {
  const tries: Array<{ model: string; settings: typeof settings; why: string }> = [
    { model, settings, why: '頼まれたまま' },
  ]
  if (isV3(model) && settings && typeof settings.stability === 'number') {
    const snapped = snapStability(settings.stability as number)
    if (snapped !== settings.stability) {
      tries.push({
        model,
        settings: { ...settings, stability: snapped },
        why: `stability を ${snapped} に寄せた`,
      })
    }
  }
  if (model !== ELEVEN_MODEL_FALLBACK) {
    tries.push({ model: ELEVEN_MODEL_FALLBACK, settings, why: 'v3 が使えなかった' })
  }

  let last: { error?: unknown } = {}
  for (const t of tries) {
    const made = await synthEleven(text, voiceId, key, t.model, t.settings)
    if (made.audio) {
      return {
        audio: made.audio,
        madeModel: t.model,
        madeStability: typeof t.settings?.stability === 'number'
          ? (t.settings.stability as number) : undefined,
        modelNote: t === tries[0] ? undefined : t.why,
      }
    }
    last = made
  }
  return last
}

// ── ここから mp3-fade ────────────────────────────────────────────────
//    (`scripts/check-mp3-fade.mjs` が**この印のあいだを取り出して**
//     素の node で走らせる。型注釈を書かないこと)
/**
 * ============================================================================
 * 【発言の終わりの「プチッ」を消す】(2026-09 利用者の指定)
 *
 *   > またアツゲン(発言)の後ろにプチッと入ります。
 *   > まるでトランシーバーで通信しているようです。本気で解決策を考えてください
 *
 * 【何が起きていたか】(実測してから書いている)
 *   利用者が落とした MP3(14発言・50秒)を波形にほどいて、
 *   **発言の終わりが「いくつ」で終わっているか**を1つずつ数えた。
 *
 *   14発言のうち **6発言が、音のある途中でぶつりと 0 に落ちていた。**
 *   いちばん大きいもので **0.11(-19dBFS)** — 1点で 0 まで落ちる。
 *   波形が途中の値のまま急に途切れれば、そこで「プチッ」と鳴る。
 *
 *   **これは ElevenLabs が返す MP3 そのものの中にある。**
 *   落ちたところから、その MP3 が終わるまでは 11〜25ms しかない
 *   (フレーム1枚 = 26ms より短い)。つまり**音が鳴っている最中に、
 *   その音声ファイルが終わっている。**
 *
 * 【だから「切り落とし」では直せなかった】(2026-09・取り下げ済み)
 *   プチッの手前まで削るには**実音声を削る**しかない。実際、
 *   150ms では残り、200ms では「発言の最後が消えました。ダメです」だった。
 *   **削る場所に答えは無い。**
 *
 * 【`fadeGain` でも直せない】
 *   あれは `<audio>` の `volume` を動かすもので、
 *   **iPhone は `volume` を無視する**(CLAUDE.md)。
 *   つまり利用者の端末では1ミリも効いていない。
 *
 * 【ここでやること】
 *   **音のデータには一切触れずに、終わりだけを段々小さくする。**
 *
 *   MP3 は「グラニュール」(約13ms)ごとに、
 *   **その塊全体の大きさを表す `global_gain` という 8 ビットの数**を持つ。
 *   1 減らすと 1.5dB 小さくなる(mp3gain と同じ考え方)。
 *   ここだけを書き換えるので、
 *
 *   - **音は1ビットも作り直していない**(利用者の指定と矛盾しない)
 *   - **1バイトも増えない**(長さも中身の並びもそのまま)
 *   - **1ミリ秒も削っていない**(小さくするだけ。語尾は消えない)
 *   - グラニュールどうしは重ねて復号されるので、**段差にならない**
 *
 * 【実測(利用者が落とした,その MP3 で確かめた)】
 *   いちばん大きな段差 **0.1117(-19.0dBFS)→ 0.0033(-49.6dBFS)。**
 *   6発言とも直り、終わりの音量はほとんど変わっていない。
 *
 * 【効く範囲】
 *   ElevenLabs の MP3(44.1kHz・モノラル・CRC 無し)だけ。
 *   Azure / Google は 24kHz(MPEG2)なので**何もしない。**
 *   言われたのは発言(会話)の話であり、あちらは元から後ろに無音がある。
 * ============================================================================
 */
/** 終わりのグラニュールから遡って、何 dB 下げるか */
const FADE_RAMP = [66, 42, 24, 12, 5]

/** MPEG1・モノラルの side info における `global_gain` のビット位置 */
const FADE_GAIN_BITS = [39, 98]

const FADE_BITRATES = [
  0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0,
]

/** その場所に「MPEG1・モノラル・CRC 無し」のフレームの頭があるか */
function fadeFrameAt(b, i) {
  if (i + 4 > b.length) return null
  if (b[i] !== 0xff || (b[i + 1] & 0xe0) !== 0xe0) return null
  const b1 = b[i + 1]
  const b2 = b[i + 2]
  if (((b1 >> 3) & 3) !== 3) return null        // MPEG1 だけ
  if (((b1 >> 1) & 3) !== 1) return null        // Layer III だけ
  if ((b1 & 1) === 0) return null               // CRC 付きは触らない
  if (((b[i + 3] >> 6) & 3) !== 3) return null  // モノラルだけ
  const bi = (b2 >> 4) & 15
  const si = (b2 >> 2) & 3
  if (bi === 0 || bi === 15 || si === 3) return null
  const rate = [44100, 48000, 32000][si]
  const bitrate = FADE_BITRATES[bi] * 1000
  if (!bitrate) return null
  const len = Math.floor((1152 / 8) * bitrate / rate) + ((b2 >> 1) & 1)
  return { at: i, len }
}

function fadeReadBits(b, base, off, n) {
  let v = 0
  for (let k = 0; k < n; k += 1) {
    const p = off + k
    v = (v << 1) | ((b[base + (p >> 3)] >> (7 - (p & 7))) & 1)
  }
  return v
}

function fadeWriteBits(b, base, off, n, v) {
  for (let k = 0; k < n; k += 1) {
    const p = off + k
    const idx = base + (p >> 3)
    const mask = 1 << (7 - (p & 7))
    if ((v >> (n - 1 - k)) & 1) b[idx] |= mask
    else b[idx] &= ~mask
  }
}

/**
 * MP3 の**終わりだけ**をなだらかに下げた写しを返す。
 *
 * 触れない形(MPEG2・ステレオ・CRC 付き)のときは、
 * **元のものをそのまま返す。**「直せないなら、何もしない」
 */
function fadeMp3Tail(input) {
  const bytes = new Uint8Array(input)
  const frames = []
  let i = 0
  while (i < bytes.length) {
    const f = fadeFrameAt(bytes, i)
    if (!f) { i += 1; continue }
    frames.push(f)
    i += f.len
  }
  // フレームが少なすぎるものは触らない(下げる余地がない)
  if (frames.length < FADE_RAMP.length) return bytes
  const out = new Uint8Array(bytes)
  let g = 0
  for (let k = frames.length - 1; k >= 0 && g < FADE_RAMP.length; k -= 1) {
    const base = frames[k].at + 4
    for (let gr = 1; gr >= 0 && g < FADE_RAMP.length; gr -= 1) {
      const off = FADE_GAIN_BITS[gr]
      const cur = fadeReadBits(out, base, off, 8)
      const cut = Math.round(FADE_RAMP[g] / 1.5)
      fadeWriteBits(out, base, off, 8, Math.max(0, cur - cut))
      g += 1
    }
  }
  return out
}
// ── ここまで mp3-fade ────────────────────────────────────────────────

/**
 * ============================================================================
 * 【本文を1本で作る】(2026-09 利用者の指定)
 *
 *   > 会話は、話者ごとに個別MP3を生成してアプリ側で連結せず、
 *   > ElevenLabs の Text to Dialogue API を使い、複数の voice_id を指定して
 *   > 会話全体を1本の音声として生成する。
 *   > 可能なら with-timestamps を使用し、各発話の開始・終了時刻を保存する。
 *
 *   発言と発言の「プチッ」は、**つなぎ目があるから出る。**
 *   1本で作れば、つなぎ目そのものが無くなる。
 *
 * 【2つの窓口を使い分ける】
 *   声が2人以上 … `/v1/text-to-dialogue/with-timestamps`(会話・会議)
 *   声が1人     … `/v1/text-to-speech/{id}/with-timestamps`(記事)
 *
 * 【確かめた決まりごと】(2026-09 に ElevenLabs の説明で確認)
 *   ・Text to Dialogue は **v3 専用**。声は **10人まで**
 *   ・`settings` は **stability だけ**を受け取る
 *   ・**全ターン合わせて 2,000 文字**が目安。超えると途中で切れる
 *   ・時刻は `alignment` に**文字ごと**で返る
 *
 * 【区切りの計算は、ここでやらない】
 *   `alignment` を**そのまま**控えて、画面側(`src/lib/wholeAudio.js`)が
 *   「何番目は何秒から何秒か」を出す。窓口に置くと、
 *   **窓口を配置し直すまで直せない**うえ、素の node で確かめられない。
 * ============================================================================
 */

/** 会話(Text to Dialogue)で、全ターン合わせて出せる文字数 */
const MAX_DIALOGUE_CHARS = 2000

/** 記事(1人が通しで読む)で出せる文字数 */
const MAX_NARRATION_CHARS = 2800

/** ElevenLabs から「音声 + 文字ごとの時刻」を受け取る */
async function synthElevenTimed(
  url: string, key: string, payload: Record<string, unknown>,
) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': key,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const raw = await res.text().catch(() => '')
    return { error: humanTtsError('ElevenLabs', res.status, raw) }
  }
  let json: Record<string, unknown>
  try { json = await res.json() } catch {
    return {
      error: {
        error: GENERIC,
        detail: 'ElevenLabs の返事を読めませんでした(JSON ではありません)。',
        fatal: false,
      },
    }
  }
  const b64 = String(json.audio_base64 ?? '')
  if (!b64) {
    return {
      error: {
        error: GENERIC,
        detail: 'ElevenLabs が音声を返しませんでした(audio_base64 が空)。',
        fatal: false,
      },
    }
  }
  const bin = atob(b64)
  const audio = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i += 1) audio[i] = bin.charCodeAt(i)
  return { audio, alignment: json.alignment ?? null }
}

/**
 * 1本にまとめて作る。**会話は Text to Dialogue、記事は通常の窓口。**
 *
 * v3 で断られたら v2 に落ちる…という道は**作らない。**
 * Text to Dialogue は v3 専用なので、落ちる先が無い。
 * 失敗したら画面が**これまでどおり発言ごと**に作る(行き止まりにしない)。
 */
async function synthWhole(
  texts: string[], elevenIds: string[], key: string,
  settings: Record<string, number | boolean> | null,
) {
  const unique = [...new Set(elevenIds)]
  const total = texts.reduce((n, t) => n + t.length, 0)

  if (unique.length > 1) {
    if (unique.length > 10) {
      return {
        error: {
          error: GENERIC,
          detail: `話す人が ${unique.length} 人います。Text to Dialogue は 10 人までです。`,
          fatal: false,
        },
      }
    }
    if (total > MAX_DIALOGUE_CHARS) {
      return {
        error: {
          error: GENERIC,
          detail: `会話が長すぎます(${total} 文字)。`
            + `1本にまとめられるのは ${MAX_DIALOGUE_CHARS} 文字までです。`,
          fatal: false,
        },
      }
    }
    const made = await synthElevenTimed(
      'https://api.elevenlabs.io/v1/text-to-dialogue/with-timestamps?output_format=mp3_44100_128',
      key,
      {
        inputs: texts.map((t, i) => ({ text: t, voice_id: elevenIds[i] })),
        model_id: ELEVEN_MODEL_DEFAULT,
        // **stability しか受け取らない**(確認済み)。ほかは送らない
        ...(settings && typeof settings.stability === 'number'
          ? { settings: { stability: settings.stability } } : {}),
      },
    )
    return { ...made, madeModel: ELEVEN_MODEL_DEFAULT, kind: 'dialogue' }
  }

  if (total > MAX_NARRATION_CHARS) {
    return {
      error: {
        error: GENERIC,
        detail: `本文が長すぎます(${total} 文字)。`
          + `1本にまとめられるのは ${MAX_NARRATION_CHARS} 文字までです。`,
        fatal: false,
      },
    }
  }
  const made = await synthElevenTimed(
    `https://api.elevenlabs.io/v1/text-to-speech/${unique[0]}/with-timestamps`
      + '?output_format=mp3_44100_128',
    key,
    {
      // **段落の切れ目は空行で渡す。** 区切りは `alignment` から出すので、
      // ここで印を入れる必要はない(印を入れると、それも読まれてしまう)
      text: texts.join('\n\n'),
      model_id: ELEVEN_MODEL_DEFAULT,
      ...(settings ? { voice_settings: settings } : {}),
    },
  )
  return { ...made, madeModel: ELEVEN_MODEL_DEFAULT, kind: 'narration' }
}

/**
 * Azure からの断りを、**画面に出せる日本語**にする。
 *
 * 【ゲストには、仕組みの内側を見せない】(`lookup-word` と同じ考え方)
 *   ・`error`  … 誰に見せてもよい一般的な言い方
 *   ・`detail` … 原因と、直し方。**トレーナー・管理者にだけ**出す
 *   ・`fatal`  … 待っても直らないもの。画面はその間、取りに来るのをやめる
 *
 *   どちらを出すかは画面側が決める(`src/lib/viewer.js`)。
 *   **役割の判定を窓口と画面の2か所に置かない。**
 *
 * 【そもそも画面には出さない】
 *   音声は、失敗しても**端末の声で読み上げる**ところまで戻るだけである。
 *   だから普段は何も出さない。この文言は、トレーナーが
 *   「なぜ iPhone で声が悪いままなのか」を調べるときのためにある。
 */
const GENERIC = 'いま音声を用意できません。端末の声で読み上げます。'

const humanTtsError = (who: string, status: number, raw: string) => {
  const text = String(raw ?? '')
  if (status === 401 || status === 403) {
    return {
      error: GENERIC,
      detail: `${who} の鍵が正しくありません。Supabase の`
        + ' Edge Functions → Secrets を確認してください'
        + '(Azure は AZURE_SPEECH_KEY と AZURE_SPEECH_REGION、'
        + ' Google は GOOGLE_TTS_API_KEY)。',
      fatal: true,
    }
  }
  if (status === 429) {
    return {
      error: GENERIC,
      detail: `${who} の呼び出し上限に当たりました。`
        + '無料枠(Azure は毎月50万文字 / Google は毎月100万文字)を'
        + '使い切っている可能性があります。使用量を確認してください。',
      fatal: false,
    }
  }
  if (status === 402 || /quota|credit/i.test(text)) {
    // ElevenLabs はクレジットを使い切ると 401 / 402 で断る。
    // **待っても直らない**ので、この画面のあいだは取りに来させない
    return {
      error: GENERIC,
      detail: `${who} のクレジットを使い切りました。`
        + 'プランを上げるか、翌月まで待ってください。'
        + '(標準の声で読み上げる演習は、これまでどおり鳴ります)',
      fatal: true,
    }
  }
  if (status >= 500) {
    return { error: GENERIC, detail: `${who} 側が応答していません(${status})。`, fatal: false }
  }
  // 400 は**声の名前が使えない**ときにも来る。返事をそのまま載せる。
  // ここを削ると、DragonHD が使えないリージョンだったときに原因が分からない
  return {
    error: GENERIC,
    detail: `${who} からの応答: ${status} ${text.slice(0, 300)}`,
    fatal: false,
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  // どこに時間がかかっているのかを測って返す。**体感で議論しない。**
  const startedAt = Date.now()

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // ── 1. ログインしている人か確かめる ────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return reply({ error: 'ログインが必要です。画面を読み込み直してください。' }, 401)
    }
    const who = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: authHeader, apikey: anonKey },
    })
    if (!who.ok) {
      return reply({
        error: 'ログインの期限が切れています。画面を読み込み直してから、もう一度お試しください。',
      }, 401)
    }

    // ── 2. 送られてきた内容 ────────────────────────────────
    let body: Record<string, unknown>
    try { body = await req.json() } catch { return reply({ error: '内容を読めませんでした' }, 400) }

    /* ── 版を訊くだけの呼び出し(2026-09 実機)─────────────────
     *
     *   > トレーナーの画面に赤い知らせが出なくなってます
     *
     *   版の見比べは**音声を作ったときにしか起きていなかった。**
     *   MP3 がすでに置いてあれば画面は窓口を呼ばないので
     *   (`clipUrl` は場所を計算するだけ)、**古い窓口のまま
     *   何も知らせが出ない。**「無ければ素通り」する検証そのもの
     *   だった(CLAUDE.md)。
     *
     *   だから**訊くためだけの呼び出し**を用意する。
     *   ここで返るのは版だけ。**音声は作らないので1円もかからない。**
     *
     *   古い窓口はこの `ping` を知らないので、下の
     *   「読み上げる英文がありません」で 400 を返す。
     *   **それでよい** —— 版が付いていないことが、そのまま
     *   「古い」という答えになる。 */
    if (body.ping) return reply({ ok: true })

    /* ── 本文を1本で作る(2026-09 利用者の指定)──────────────────
     *
     *   会話は Text to Dialogue、記事は通常の窓口を
     *   **with-timestamps** で呼び、MP3 と**文字ごとの時刻**を置く。
     *   つなぎ目が無くなるので、発言のあいだの「プチッ」も無くなる。
     *
     *   **区切りの計算はしない。** `alignment` をそのまま控えて、
     *   画面側(`src/lib/wholeAudio.js`)が「何番目は何秒から何秒か」を出す。
     *
     *   ここで失敗しても、画面は**これまでどおり発言ごと**に作る。
     *   だから行き止まりにはならない。 */
    if (body.whole) {
      const w = body.whole as Record<string, unknown>
      const texts = (Array.isArray(w.texts) ? w.texts : [])
        .map((t) => normText(String(t ?? ''))).filter(Boolean)
      const elevenIds = (Array.isArray(w.elevenIds) ? w.elevenIds : [])
        .map((v) => cleanElevenId(v))
      const mark = String(w.mark ?? '')
      const wantForce = !!body.force

      if (texts.length < 2 || elevenIds.length !== texts.length
        || elevenIds.some((v) => !v) || !mark || mark.length > 20000) {
        return reply({ error: GENERIC, detail: '1本にまとめる材料がそろっていません。', fatal: false }, 400)
      }

      const wholeKey = Deno.env.get('ELEVENLABS_API_KEY')
      if (!wholeKey) {
        // **鍵が無いだけ。** 画面はこれまでどおり発言ごとに作る
        return reply({
          error: GENERIC,
          detail: '1本にまとめるには ElevenLabs の鍵が要ります'
            + '(Supabase の Edge Functions → Secrets → ELEVENLABS_API_KEY)。',
          fatal: false,
        }, 502)
      }

      const wholePath = `${CLIP_REV}/premium/whole/${await fingerprint('whole', mark)}`
      const mp3Url = `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${wholePath}.mp3`
      const jsonUrl = `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${wholePath}.json`

      if (!wantForce) {
        const already = await fetch(mp3Url, { method: 'HEAD' })
        if (already.ok) {
          return reply({ url: mp3Url, jsonUrl, cached: true, ms: Date.now() - startedAt })
        }
      }

      const made = await synthWhole(
        texts, elevenIds, wholeKey, cleanElevenSettings(body.elevenSettings),
      )
      if (made.error) return reply(made.error, 502)
      if (!made.audio?.byteLength) {
        return reply({
          error: GENERIC,
          detail: 'ElevenLabs が空の音声を返しました。',
          fatal: false,
        }, 502)
      }

      // **終わりだけをなだらかに下げる**(1本になっても、最後の1回は残る)
      const wholeAudio = fadeMp3Tail(made.audio)
      const put = await fetch(`${supabaseUrl}/storage/v1/object/${BUCKET}/${wholePath}.mp3`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
          'Content-Type': 'audio/mpeg',
          'Cache-Control': 'public, max-age=31536000, immutable',
          'x-upsert': 'true',
        },
        body: wholeAudio,
      })
      if (!put.ok) {
        const raw = await put.text().catch(() => '')
        return reply({
          error: GENERIC,
          detail: `音声を置けませんでした(${put.status})。${raw.slice(0, 200)}`,
          fatal: /bucket not found/i.test(raw),
        }, 502)
      }

      /* **時刻は、そのまま控える。** ここで区切りに直すと、
         直したくなったときに**窓口の置き直しが要る**ことになる */
      await fetch(`${supabaseUrl}/storage/v1/object/${BUCKET}/${wholePath}.json`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=31536000, immutable',
          'x-upsert': 'true',
        },
        body: JSON.stringify({
          rev: FN_REV, kind: made.kind, texts, alignment: made.alignment ?? null,
        }),
      })

      return reply({
        url: mp3Url,
        jsonUrl,
        cached: false,
        kind: made.kind,
        parts: texts.length,
        chars: texts.reduce((n, t) => n + t.length, 0),
        madeModel: made.madeModel,
        ms: Date.now() - startedAt,
      })
    }

    const text = normText(String(body.text ?? ''))
    if (!text) return reply({ error: '読み上げる英文がありません' }, 400)
    if (text.length > MAX_CHARS) {
      return reply({
        error: GENERIC,
        detail: `英文が長すぎます(${text.length} 文字)。`
          + `1回に作れるのは ${MAX_CHARS} 文字までです。段落や発言ごとに分けて呼んでください。`,
        fatal: false,
      }, 400)
    }

    // ── どの声で作るか ──────────────────────────────────────
    //
    //   段(premium / standard)は**画面が決めて渡してくる**
    //   (`src/lib/voiceTier.js`)。ここでは従うだけ。
    //   **判断を2か所に置かない。** 置けば必ず食い違う。
    const tier = String(body.tier ?? 'standard') === 'premium' ? 'premium' : 'standard'

    const googleKey = Deno.env.get('GOOGLE_TTS_API_KEY')
    const azureKey = Deno.env.get('AZURE_SPEECH_KEY')
    const azureRegion = Deno.env.get('AZURE_SPEECH_REGION')
    const elevenKey = Deno.env.get('ELEVENLABS_API_KEY')
    const hasGoogle = !!googleKey
    const hasAzure = !!(azureKey && azureRegion)

    // 頼まれた声。**訛りの一覧は画面側(`src/data/clipVoices.js`)だけが持つ。**
    // ここは知らない id が来てもよい。ファイル名として安全な形にだけ丸める
    const voiceId = String(body.voice ?? '').replace(/[^a-z0-9-]/gi, '').slice(0, 40)
      || DEFAULT_VOICE
    // 標準の段での代役。**窓口が知っている4つのどれか**でなければ既定に落とす
    const base = SPEAKER_PROVIDER[String(body.base ?? '')] ? String(body.base) : DEFAULT_VOICE

    // 良い段。**Voice ID を入れていない声は、標準の段の音で作る。**
    // 失敗にはしない。鳴らないより、標準の声で鳴るほうがよい
    // **作り直すか。** あっても上書きする(下の「すでにあるなら」を飛ばす)
    const force = body.force === true
    const elevenVoice = elevenKey ? cleanElevenId(body.elevenVoice) : ''
    /* **訛りを最大限に活かす指定**(2026-09 利用者の指定)。
       画面(`src/data/clipVoices.js` の `voiceSettingsOf`)が決めて渡す。
       **窓口は名簿を持たない**ので、ここでは中身だけを確かめる。
       知らない欄は捨て、数は 0〜1 に丸める(そのまま渡すと 422 で断られる) */
    const elevenSettings = cleanElevenSettings(body.elevenSettings)
    /* **どのモデルで作るか**(2026-09 利用者の指定)。
       利用者は ElevenLabs の画面で**聴いてから**声を選ぶので、
       **聴いたモデルで作らないと別物になる。**
       声ごとの指定は名簿(`src/data/clipVoices.js` の `voiceModelOf`)が持ち、
       ここへ渡ってくる。**窓口は名簿を持たない。**

       知らない名前は受けない。**画面の書き間違いを、そのまま
       ElevenLabs へ流さない**(422 で断られて、音が鳴らなくなる)。
       環境変数(`ELEVENLABS_MODEL`)は**すべてに優先する逃げ道**として残す。 */
    const elevenModel = Deno.env.get('ELEVENLABS_MODEL')
      ?? (ELEVEN_MODELS.includes(String(body.elevenModel ?? ''))
        ? String(body.elevenModel) : ELEVEN_MODEL_DEFAULT)
    const usePremium = tier === 'premium' && !!elevenVoice

    // 標準の段。代役の話者ごとに会社を決めてある。
    // **片方しか鍵が無いときは、あるほうを使う**(止まるより鳴るほうがよい)
    let standardProvider: 'google' | 'azure' | null = SPEAKER_PROVIDER[base]
    if (standardProvider === 'google' && !hasGoogle) standardProvider = hasAzure ? 'azure' : null
    if (standardProvider === 'azure' && !hasAzure) standardProvider = hasGoogle ? 'google' : null

    const provider = usePremium ? 'eleven' : standardProvider

    /* 置き場所。**実際に作った段で置く。**
     *
     * 【なぜ「頼まれた段」で置かないのか】(2026-09 実機)
     *
     *   > 新しく教材を作ったが elevenlabs の音声が反映されていないぞ！
     *
     *   以前は頼まれた段(`tier`)のまま置いていた。すると
     *   **ELEVENLABS_API_KEY を入れる前に一度でも鳴らした英文は、
     *   標準の声の MP3 が「良い段」の場所に居座る。**
     *   画面はそこを見に行き、あれば鳴らして終わりなので、
     *   **あとから鍵を入れても、その英文だけは永久に標準の声のまま**だった。
     *
     *   実際に作った段で置けば、良い段の場所は空のままになる。
     *   鍵を入れたあとに開けば、そこで初めて良い声が作られる。
     *
     *   代わりに、落ちているあいだは**画面が毎回この窓口を呼ぶ**ことになる。
     *   ただし**作り直しはしない**(標準の段にはもう置いてあるので、
     *   下の「すでにあるなら、作らない」で返る)。課金は増えない。
     *
     * (あとで声の id を足したときは `CLIP_REV` を進める) */
    const madeTier = usePremium ? 'premium' : 'standard'
    const path = `${CLIP_REV}/${madeTier}/${voiceId}/${await fingerprint(voiceId, text)}.mp3`
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${path}`

    // ── 3. すでにあるなら、作らない ────────────────────────
    //
    //   画面も先に同じ場所を見に行くので、ここへ来る時点では普通は無い。
    //   それでも見るのは、**同じ英文を2人が同時に開いたとき**に
    //   二重に作って二重に課金されるのを防ぐためである。
    /* **作り直しを頼まれたときは、あるかどうかを見ない**(2026-09 実機)。
     *
     *   > Mika のひとつ目の発言だけ、明らかに ElevenLabs ではない
     *   > 酷い音声になってしまいます。
     *
     * 上の `madeTier` を入れる前の窓口は、良い声で作れなかったときも
     * **良い段の場所に標準の声で置いていた。** そこにいったん置かれると、
     * 画面はその場所を見て「ある」ので鳴らして終わり、
     * **窓口はもう呼ばれない。** だから鍵を入れても、その英文だけ直らない。
     *
     * 直す道が要る。`force` が来たら、あっても作り直して上書きする
     * (置くときの `x-upsert` はもともと付いている)。
     * **頼まれたときだけ。** 自動では作り直さない —
     * 作り直しはそのまま ElevenLabs への課金になる。 */
    if (!force) {
      const already = await fetch(publicUrl, { method: 'HEAD' })
      if (already.ok) {
        return reply({ url: publicUrl, cached: true, ms: Date.now() - startedAt })
      }
    }

    // ── 4. 作らせる ────────────────────────────────────────
    if (!provider) {
      // **まだ用意していないだけ**なので、これは失敗ではない扱いにする。
      // 画面は端末の声に戻り、この画面のあいだ取りに来るのをやめる。
      return reply({
        error: GENERIC,
        detail: '音声合成がまだ設定されていません。Supabase の Edge Functions →'
          + ' Secrets に、次を追加してください。'
          + ' ① GOOGLE_TTS_API_KEY(標準の声・毎月100万文字まで無料)'
          + ' ② AZURE_SPEECH_KEY と AZURE_SPEECH_REGION(標準の声・毎月50万文字まで無料)'
          + ' ③ ELEVENLABS_API_KEY(本文などの良い声。'
          + '声は src/data/clipVoices.js に登録する)',
        fatal: true,
      }, 503)
    }

    let made: {
      audio?: ArrayBuffer; error?: unknown
      madeModel?: string; madeStability?: number; modelNote?: string
    }
    if (provider === 'eleven') {
      made = await synthElevenBest(
        text, elevenVoice, elevenKey!,
        elevenModel,
        elevenSettings,
      )
    } else if (provider === 'google') {
      made = await synthGoogle(text, GOOGLE_VOICES[base], googleKey!)
    } else {
      made = await synthAzure(text, AZURE_VOICES[base], azureKey!, azureRegion!)
    }
    if (made.error) return reply(made.error, 502)
    const audio = made.audio!
    if (!audio.byteLength) {
      // **中身が0件のまま「成功」を返さない。**
      return reply({
        error: GENERIC,
        detail: `${provider} が空の音声を返しました。`
          + '英文に読める文字が無い可能性があります。',
        fatal: false,
      }, 502)
    }

    /*
     * ── 4.5 発言の終わりを、なだらかに下げる ───────────────
     *
     *   **置く前に1回だけ**行う(上の `fadeMp3Tail` を見よ)。
     *   ここでやっておけば、
     *
     *   - 画面はこれまでどおり**置いてある MP3 をそのまま鳴らす**だけ。
     *     音の通り道は1ミリも増えない(③で高くついた失敗をくり返さない)
     *   - **iPhone でも効く**(`volume` を使っていないため)
     *   - 1本にまとめて落とす音声も、これをつなぐので**同じように直る**
     *
     *   ElevenLabs のときだけにしてある。**言われたのは発言の話**であり、
     *   標準の段(Azure / Google)は 24kHz なので `fadeMp3Tail` は
     *   どのみち何もしない。
     */
    const stored = provider === 'eleven' ? fadeMp3Tail(audio) : audio

    // ── 5. 置く ────────────────────────────────────────────
    //
    //   書き込めるのはここだけ(service_role)。x-upsert を付けるのは、
    //   同時に2人が同じ英文を開いたときに「もうある」で落ちないようにするため。
    const put = await fetch(`${supabaseUrl}/storage/v1/object/${BUCKET}/${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'x-upsert': 'true',
      },
      body: stored,
    })
    if (!put.ok) {
      const raw = await put.text().catch(() => '')
      return reply({
        error: GENERIC,
        detail: `音声を置けませんでした(${put.status})。`
          + `Supabase の Storage に「${BUCKET}」バケツがあるか確認してください`
          + '(0016 の SQL で作られます)。' + raw.slice(0, 200),
        fatal: /bucket not found/i.test(raw),
      }, 502)
    }

    return reply({
      url: publicUrl,
      cached: false,
      chars: text.length,
      // どの声で作ったかを返す。**聞き比べのときに、これが手がかりになる**
      provider,
      tier,
      // **実際に作った段。** 頼まれた段と違うことがある(上の `madeTier`)
      madeTier,
      /* **実際に作ったモデル。** 既定は v3(利用者が選んだ声は v3 である)。
         プランで使えなければ v2 に落ちるので、**落ちたことが分かるように返す。**
         `modelNote` は、落ちた理由(v3 が使えなかった / stability を寄せた) */
      madeModel: made.madeModel,
      madeStability: made.madeStability,
      modelNote: made.modelNote,
      // 良い声を頼まれたのに用意できなかったことを、係の人に伝える。
      // **どの鍵が足りないのかまで書く。** 「なぜか良い声にならない」で
      // 悩ませない(JSON の書き間違いは、これが無いと見つけられない)
      fellBack: tier === 'premium' && !usePremium,
      detail: tier === 'premium' && !usePremium
        ? (elevenKey
          ? `"${voiceId}" に ElevenLabs の Voice ID が入っていないので、`
            + '標準の声で作りました。src/data/clipVoices.js の elevenId を'
            + '確かめてください。'
          : 'ELEVENLABS_API_KEY が設定されていないので、標準の声で作りました。')
        : undefined,
      ms: Date.now() - startedAt,
    })
  } catch (e) {
    return reply({
      error: GENERIC,
      detail: `窓口で予期しない失敗が起きました: ${(e as Error)?.message ?? e}`,
      fatal: false,
    }, 500)
  }
})
