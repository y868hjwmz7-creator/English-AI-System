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
// 【費用】
//   Azure の無料枠は **毎月 50 万文字**。教材1本がおよそ 2,000 文字なので、
//   月に 250 本まで無料枠に収まる。超えたぶんは 100 万文字あたり $16。
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
 * 話者と、Azure の音声名の対応。
 *
 * **`src/data/speakers.js` の PREGENERATED_SPEAKERS と id をそろえること。**
 * `scripts/generate-audio.mjs`(練習用の例文を作る道具)とも同じ声にしてある。
 * ばらばらにすると、同じ「Emma」なのに場所によって声が違う、が起きる。
 */
const VOICES: Record<string, { voice: string; lang: string }> = {
  'us-female': { voice: 'en-US-EmmaMultilingualNeural', lang: 'en-US' },
  'us-male': { voice: 'en-US-RyanMultilingualNeural', lang: 'en-US' },
  'uk-female': { voice: 'en-GB-SoniaNeural', lang: 'en-GB' },
  'uk-male': { voice: 'en-GB-RyanNeural', lang: 'en-GB' },
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

const humanAzureError = (status: number, raw: string) => {
  const text = String(raw ?? '')
  if (status === 401 || status === 403) {
    return {
      error: GENERIC,
      detail: 'Azure の鍵かリージョンが正しくありません。Supabase の'
        + ' Edge Functions → Secrets の AZURE_SPEECH_KEY と'
        + ' AZURE_SPEECH_REGION を確認してください。',
      fatal: true,
    }
  }
  if (status === 429) {
    return {
      error: GENERIC,
      detail: 'Azure の呼び出し上限に当たりました。無料枠(毎月50万文字)を'
        + '使い切っている可能性があります。Azure ポータル →'
        + ' 音声サービス → 使用量で確認してください。',
      fatal: false,
    }
  }
  if (status >= 500) {
    return { error: GENERIC, detail: `Azure 側が応答していません(${status})。`, fatal: false }
  }
  return {
    error: GENERIC,
    detail: `Azure からの応答: ${status} ${text.slice(0, 200)}`,
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

    const voiceId = VOICES[String(body.voice ?? '')] ? String(body.voice) : DEFAULT_VOICE
    const speaker = VOICES[voiceId]
    const path = `${voiceId}/${await fingerprint(voiceId, text)}.mp3`
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

    // ── 4. Azure に作らせる ────────────────────────────────
    const azureKey = Deno.env.get('AZURE_SPEECH_KEY')
    const azureRegion = Deno.env.get('AZURE_SPEECH_REGION')
    if (!azureKey || !azureRegion) {
      // **まだ用意していないだけ**なので、これは失敗ではない扱いにする。
      // 画面は端末の声に戻り、この画面のあいだ取りに来るのをやめる。
      return reply({
        error: GENERIC,
        detail: '音声合成がまだ設定されていません。Supabase の Edge Functions →'
          + ' Secrets に AZURE_SPEECH_KEY と AZURE_SPEECH_REGION を追加してください。',
        fatal: true,
      }, 503)
    }

    // 速さは変えずに、**自然な速さで作る。**
    // 遅くするのは画面側(`playbackRate`)の仕事である。
    // ここで遅くすると、速さの段階ごとに別のファイルが要る = 費用が5倍になる。
    const ssml =
      `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis"`
      + ` xml:lang="${speaker.lang}"><voice name="${speaker.voice}">`
      + `${escapeXml(text)}</voice></speak>`

    const made = await fetch(
      `https://${azureRegion}.tts.speech.microsoft.com/cognitiveservices/v1`,
      {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': azureKey,
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
          'User-Agent': 'english-ai-system',
        },
        body: ssml,
      },
    )
    if (!made.ok) {
      const raw = await made.text().catch(() => '')
      return reply(humanAzureError(made.status, raw), 502)
    }
    const audio = await made.arrayBuffer()
    if (!audio.byteLength) {
      // **中身が0件のまま「成功」を返さない。**
      return reply({
        error: GENERIC,
        detail: 'Azure が空の音声を返しました。英文に読める文字が無い可能性があります。',
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
