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
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })

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
 * 既定は実績のある `eleven_multilingual_v2`。
 * v3 を試すときは Secrets に `eleven_v3` を入れる(プランによっては
 * 使えないことがあるため、既定にはしない)。
 */
const ELEVEN_MODEL_DEFAULT = 'eleven_multilingual_v2'

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
async function synthEleven(text: string, voiceId: string, key: string, model: string) {
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': key,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({ text, model_id: model }),
    },
  )
  if (!res.ok) {
    return { error: humanTtsError('ElevenLabs', res.status, await res.text().catch(() => '')) }
  }
  return { audio: await res.arrayBuffer() }
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

    let made: { audio?: ArrayBuffer; error?: unknown }
    if (provider === 'eleven') {
      made = await synthEleven(
        text, elevenVoice, elevenKey!,
        Deno.env.get('ELEVENLABS_MODEL') ?? ELEVEN_MODEL_DEFAULT,
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
      body: audio,
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
