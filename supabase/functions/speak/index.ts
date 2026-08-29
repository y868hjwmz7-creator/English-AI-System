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
 * 【なぜ2社ぶんあるか】(2026-08 利用者の指摘)
 *   「抑揚や人間らしさで求めているレベルには少し足りない」。
 *   知り合いが Google(Gemini)で作ったアプリの音声がとても人間的だった、
 *   という話が出発点である。
 *
 *   声の質は、聞いてみないと分からない。**聞き比べられるようにしておく。**
 *   どちらを使うかは **Secrets にどちらの鍵を入れたか**で決まる。
 *   コードは触らなくてよい。
 *
 *     GOOGLE_TTS_API_KEY を入れた           → Google(Chirp 3: HD)
 *     AZURE_SPEECH_KEY + REGION だけ入れた  → Azure(DragonHD)
 *
 *   **切り替えたら CLIP_REV を1つ進めること。** 前の声の MP3 が残る。
 */

/**
 * Azure。**DragonHD** は Azure でいちばん人間に近い段階の音声である。
 * `Neural` より抑揚が豊かで、間の取り方が自然になる。
 *
 * `要確認`: **DragonHD はアメリカ英語にしかない。** イギリス英語は
 * Neural のまま置いてある。使えるリージョンも限られている。
 * 使えないと Azure が 400 を返すので、そのときは `:DragonHDLatestNeural`
 * を外して `en-US-AvaMultilingualNeural` のように Neural に戻すこと。
 */
const AZURE_VOICES: Record<string, { voice: string; lang: string }> = {
  'us-female': { voice: 'en-US-Ava:DragonHDLatestNeural', lang: 'en-US' },
  'us-male': { voice: 'en-US-Andrew:DragonHDLatestNeural', lang: 'en-US' },
  'uk-female': { voice: 'en-GB-SoniaNeural', lang: 'en-GB' },
  'uk-male': { voice: 'en-GB-RyanNeural', lang: 'en-GB' },
}

/**
 * Google Cloud Text-to-Speech の **Chirp 3: HD**。
 * 知り合いのアプリで「とても人間的」と言われたのと同じ系統の音声である。
 * 無料枠は毎月100万文字(Azure の2倍)。超えると100万文字あたり $30。
 *
 * `要確認`: 声の名前と、**鍵だけで呼べること**(サービスアカウントが
 * 要らないこと)。こちらから Google には通信できないため、
 * **実機で確かめていない。** 間違っていても壊れない(端末の声に戻るだけ)。
 * そのときは窓口が返す `detail` に Google の返事がそのまま入るので、
 * それを見て直す。
 */
const GOOGLE_VOICES: Record<string, { voice: string; lang: string }> = {
  'us-female': { voice: 'en-US-Chirp3-HD-Achernar', lang: 'en-US' },
  'us-male': { voice: 'en-US-Chirp3-HD-Charon', lang: 'en-US' },
  'uk-female': { voice: 'en-GB-Chirp3-HD-Achernar', lang: 'en-GB' },
  'uk-male': { voice: 'en-GB-Chirp3-HD-Charon', lang: 'en-GB' },
}

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

    // ── どちらの会社に作らせるか ────────────────────────────
    //
    //   **鍵がどちらにあるかで決まる。** コードを触らずに切り替えられる。
    //   Google を入れたらそちらが優先(あとから足すほうが「試したいほう」)。
    const googleKey = Deno.env.get('GOOGLE_TTS_API_KEY')
    const azureKey = Deno.env.get('AZURE_SPEECH_KEY')
    const azureRegion = Deno.env.get('AZURE_SPEECH_REGION')
    const provider = googleKey ? 'google' : (azureKey && azureRegion ? 'azure' : null)
    const table = provider === 'google' ? GOOGLE_VOICES : AZURE_VOICES

    const voiceId = table[String(body.voice ?? '')] ? String(body.voice) : DEFAULT_VOICE
    const speaker = table[voiceId]
    const path = `${CLIP_REV}/${voiceId}/${await fingerprint(voiceId, text)}.mp3`
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${path}`

    // ── 3. すでにあるなら、作らない ────────────────────────
    //
    //   画面も先に同じ場所を見に行くので、ここへ来る時点では普通は無い。
    //   それでも見るのは、**同じ英文を2人が同時に開いたとき**に
    //   二重に作って二重に課金されるのを防ぐためである。
    const already = await fetch(publicUrl, { method: 'HEAD' })
    if (already.ok) {
      return reply({ url: publicUrl, cached: true, ms: Date.now() - startedAt })
    }

    // ── 4. 作らせる ────────────────────────────────────────
    if (!provider) {
      // **まだ用意していないだけ**なので、これは失敗ではない扱いにする。
      // 画面は端末の声に戻り、この画面のあいだ取りに来るのをやめる。
      return reply({
        error: GENERIC,
        detail: '音声合成がまだ設定されていません。Supabase の Edge Functions →'
          + ' Secrets に、次のどちらかを追加してください。'
          + ' ① AZURE_SPEECH_KEY と AZURE_SPEECH_REGION(Azure DragonHD)'
          + ' ② GOOGLE_TTS_API_KEY(Google Chirp 3: HD)',
        fatal: true,
      }, 503)
    }

    const made = provider === 'google'
      ? await synthGoogle(text, speaker, googleKey!)
      : await synthAzure(text, speaker, azureKey!, azureRegion!)
    if (made.error) return reply(made.error, 502)
    const audio = made.audio!
    if (!audio.byteLength) {
      // **中身が0件のまま「成功」を返さない。**
      return reply({
        error: GENERIC,
        detail: `${provider === 'google' ? 'Google' : 'Azure'} が空の音声を返しました。`
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
      // どちらの声で作ったかを返す。**聞き比べのときに、これが手がかりになる**
      provider,
      voice: speaker.voice,
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
