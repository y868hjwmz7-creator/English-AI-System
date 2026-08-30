// ============================================================================
// 語の意味と品詞を返す窓口(Supabase Edge Function)
//
// 【なぜこれが必要か】
//   宿題の本文に出てくる語に触れたとき、その場で意味と品詞を出したい
//   (2026-08 の要望)。しかし辞書をアプリに同梱すると重くなりすぎ、
//   すべての語を教材と一緒に作らせると出力の費用が跳ね上がる。
//
//   そこで **触れたときに1語だけ引き、引いた結果をスクール全体で共有する。**
//   一度引いた語は word_glosses に残り、以後は誰が触れても
//   データベースを読むだけで出る。**同じ語に二度払わない。**
//
// 【費用】
//   1語あたりの出力はごく短い(30〜60トークン程度)。
//   Sonnet 5 の出力は 100万トークンで $10 なので、
//   **新しい語1つあたり およそ 0.0005 円**。以後は無料。
//
// 【意味は文の中で決まる】
//   run は「走る」とは限らない。利用者の指定で、
//   **その文でふさわしい意味を先頭に置き、他の意味も続けて出す**
//   (2026-08)。画面では先頭を大きく、二番目以降を小さく出す。
//
//   そのため控えの鍵は **(語, 出てきた文の指紋) の組**にしてある。
//   同じ教材の同じ文なら、最初の1人が触れたときだけ費用がかかり、
//   以後は誰が触れても無料。別の文に出てきた同じ語は、そのとき一度だけ引く。
//
// 【呼び出し方(アプリ側)】
//   supabase.functions.invoke('lookup-word', {
//     body: { word: 'deployment', sentence: 'The deployment failed.',
//             level: 'B1', contextKey: '…' }
//   })
//   contextKey は画面側(src/lib/vocab.js)が作る。ここでは作り直さない。
//   返るもの: { gloss: { word_norm, display, phonetic, senses: [{pos,
//               meaning_ja, example_en, note}, …] }, cached: true | false }
//   senses は**ふさわしい順**。先頭がその文での意味。
//
// 【安全のために】
//   ・ログインしている人だけが呼べる
//   ・**控えへの書き込みはこの関数だけ**(service_role)。画面からは読むだけ
//   ・1回の呼び出しで1語だけ。まとめ送りにしない(費用が読めなくなる)
// ============================================================================
// **Anthropic の SDK は読み込まない。**
//   Edge Function は呼ばれるたびに立ち上がることがある(コールドスタート)。
//   npm の大きな部品を読み込むと、その支度だけで1〜数秒かかる。
//   ここでやるのは「1回 POST する」だけなので、fetch で直接呼ぶ。
//   これは**モデルを速いものに替えるより効く**ことがある(2026-08)。
import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

/** Claude からの断り。言い換え済みの文を持たせて、そのまま画面に出せるようにする */
/** Claude からの断り。画面に出す文と、係の人だけに見せる原因を持つ */
class ApiError extends Error {
  detail: string
  fatal: boolean
  constructor(info: { message: string; detail: string; fatal: boolean }) {
    super(info.message)
    this.detail = info.detail
    this.fatal = info.fatal
  }
}

/**
 * Claude からの断りを、**画面に出せる日本語**にする。
 *
 * そのまま出すと `400 {"type":"error","error":{...}}` という英語の JSON が
 * 吹き出しに並び、何が起きたのか分からない(2026-08 実機)。
 *
 * 【ゲストには、内側の事情を見せない】(2026-08 利用者の指定)
 *   「Claude の残高が足りません」はゲストに見せる言葉ではない。
 *   ゲストにできることは何も無く、スクールの内側の話でしかない。
 *
 *   ・`message` … 誰に見せてもよい一般的な言い方
 *   ・`detail`  … 原因と、直し方。**トレーナー・管理者にだけ**出す
 *
 *   どちらを出すかは画面側が決める(`src/lib/viewer.js`)。
 *   ここでは両方返すだけにする。**役割の判定を2か所に置かない。**
 */
const GENERIC = 'いま辞書を使えません。少し時間をおいてから、もう一度お試しください。'
const ASK_STAFF = '直らないときは、担当のトレーナーにお知らせください。'

const humanApiError = (status: number, raw: string) => {
  const text = String(raw ?? '')
  if (/credit balance is too low|insufficient[_ ]?(quota|credit)|billing/i.test(text)) {
    return {
      message: `${GENERIC}${ASK_STAFF}`,
      detail: 'Claude の残高が足りません。'
        + 'Anthropic Console → Plans & Billing で追加してください。'
        + '(すでに調べたことのある語は、これまでどおり出ます)',
      fatal: true,   // 待っても直らない
    }
  }
  if (status === 401 || /invalid x-api-key|authentication/i.test(text)) {
    return {
      message: `${GENERIC}${ASK_STAFF}`,
      detail: 'Claude の鍵が正しくありません。'
        + 'Supabase の Edge Functions → Secrets の ANTHROPIC_API_KEY を確認してください。',
      fatal: true,
    }
  }
  if (status === 429 || /rate.?limit/i.test(text)) {
    return {
      message: '短い時間に調べすぎました。少し待ってからお試しください。',
      detail: `Anthropic の呼び出し上限に当たりました(${status})。`,
      fatal: false,
    }
  }
  if (status >= 500) {
    return {
      message: GENERIC,
      detail: `Claude 側が応答していません(${status})。`,
      fatal: false,
    }
  }
  return {
    message: `${GENERIC}${ASK_STAFF}`,
    detail: `Claude からの応答: ${status} ${text.slice(0, 200)}`,
    fatal: false,
  }
}

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })

// データベースの public.norm_word() と**同じ規則**。
// SQL・画面・ここの3か所でそろえないと、控えを引き当てられない。
const normWord = (text: string) =>
  String(text ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9'-]+/g, ' ')
    .trim()
    .replace(/^[\s'-]+|[\s'-]+$/g, '')

/**
 * 出てきた文の「指紋」。
 *
 * 文はそのまま鍵にするには長すぎる。そろえてから SHA-256 を取り、
 * 先頭16文字を使う。**そろえ方を変えると、これまでの控えを
 * 引き当てられなくなる**(費用が増えるだけで壊れはしない)。
 */
async function contextKeyOf(sentence: string): Promise<string> {
  const norm = String(sentence ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  if (!norm) return ''
  const bytes = new TextEncoder().encode(norm)
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16)
}

/**
 * 使うモデル。**ここ1行を変えれば入れ替わる。**
 *
 * 【いまは Sonnet 5】(2026-08 利用者の指定で Haiku 4.5 から戻した)
 *   Haiku 4.5 に替えても**体感は変わらなかった**。
 *   つまり遅さの原因はモデルではなく、**関数の立ち上がり**だった。
 *   質は Sonnet 5 のほうが安定するので、こちらに戻してある。
 *
 * 【Haiku 4.5 を試したときの記録】
 *   語に触れてから意味が出るまでが長い、という指摘があった。
 *   控えにある語は通信なしで出るようにしたが(第5.23.11節)、
 *   **まだ誰も引いていない語は AI に尋ねるぶん、どうしてもかかる。**
 *
 *   ここでやっているのは「辞書を1語引く」だけで、出力は30〜60トークンと短い。
 *   **教材を作る仕事とは、求められる質がまるで違う。**
 *   速さが実用性に直結するこの用途では Haiku が向く。
 *
 *   費用も下がる(出力 100万トークンあたり $10 → $5)。
 *   ただし**費用が理由ではない。** 速さが理由である。
 *
 * 【教材の生成は替えていない】
 *   `generate-material` は Sonnet 5 のまま。あちらは質が要る。
 *
 * 【また Haiku 4.5 を試したいとき】
 *   'claude-haiku-4-5' に書き換え、**下の output_config(effort)を消す。**
 *   Haiku 4.5 は effort に対応しておらず、付けたまま呼ぶと失敗する。
 *
 * 【替えるときに気をつけたこと】
 *   ・Haiku 4.5 は `output_config.effort` に**対応していない**。
 *     付けたまま呼ぶと失敗する。だからこの関数では指定しない
 *   ・`thinking` も指定しない。辞書を引くだけなので考える必要がない。
 *     指定しなければ、この世代のモデルは考えずにすぐ答える
 *   ・この関数の費用は画面に出していないので、単価の表示は直さなくてよい
 *     (生成の単価 PRICE_PER_MTOK は generate-material 用である)
 *   ・Haiku 4.5 は**指示が4,096トークン以上ないとキャッシュに載らない。**
 *     ここの指示は700トークンほどなので**載らない**(エラーにはならず、
 *     黙って載らないだけ)。入力は1回あたり1円未満なので実害はない
 */
const MODEL = 'claude-sonnet-5'

/**
 * 先読みで、1回にまとめて引く語の数。
 *
 * **1語ずつ呼ばない。** 指示文(約700トークン)が語の数だけかかり、
 * 1語あたりの費用が3倍近くになる。まとめれば指示文は1回で済む。
 * 大きくしすぎると、返ってくるまでが長くなり、途中で切られる危険も増す。
 */
const BATCH_LIMIT = 10

const SYSTEM_PROMPT = `あなたは日本人のビジネス英語学習者に語の意味を教える辞書である。

# 守ること
1. **意味を1〜3件返す。** そして
   **その文でふさわしい意味を必ず先頭に置く。**
   例: 「The trains run every ten minutes.」の run なら
   1番目に「(電車が)走る・運行する」、2番目以降に「運営する」「動かす」。
   「She runs a small bakery.」の run なら
   1番目に「(店を)経営する・運営する」、2番目以降に「走る」。
   **辞書の並び順を機械的に写さない。** 文を読んで決めること
2. 2件目以降は、**その語を学ぶうえで知っておくべき他の意味**を、
   よく使う順に並べる。**無理に3件にしない。1件で十分なら1件でよい。**
   読んでいる途中に出す吹き出しなので、多いほど学習者は混乱する
   (2026-08 利用者の指定)
3. 品詞は日本語で1語(名詞 / 動詞 / 形容詞 / 副詞 / 前置詞 / 接続詞 /
   代名詞 / 助動詞 / 間投詞 / 熟語 のいずれか)。**意味ごとに付ける**
   (run は「走る」なら動詞、「運営」なら動詞、「連続」なら名詞)
4. 意味は**日本語で30字以内**。言い換えを2つまで「・」で並べてよい
5. 例文は**短い1文**(8語以内)。渡された文をそのまま写さない。
   **その意味で使っている例**にする
6. 注意は、**日本人が間違えやすい点があるときだけ**。無ければ空文字。
   先頭の意味にだけ付ければよい
7. 見出し(display)は、渡された語の**そのままの形**にする。
   原形に戻さない(went を go にしない)。活用形なら意味の中で触れる
8. 発音記号(phonetic)は**渡された語のその形**の読み方を、
   国際音声記号(IPA)で。前後のスラッシュは付けない(例: rʌn)。
   **その文での読み方**にする。同じ綴りでも文脈で変わる語がある
   (read は現在なら riːd、過去なら red。live は動詞なら lɪv、
   形容詞なら laɪv)。アメリカ英語を基本にする

# 出力
emit_gloss という道具だけを使って返すこと。文章での説明は要らない。`

const EMIT_GLOSS_TOOL = {
  name: 'emit_gloss',
  description: '語の意味を返す',
  // strict は呼び出すときに付ける(通らなければ外して引き直すため)
  input_schema: {
    type: 'object',
    additionalProperties: false,
    required: ['display', 'phonetic', 'senses'],
    properties: {
      display: { type: 'string', description: '見出し。渡された語のままの形' },
      phonetic: {
        type: 'string',
        description: 'その文での読み方(IPA)。スラッシュは付けない。例: rʌn',
      },
      senses: {
        type: 'array',
        description: '意味。**その文でふさわしいものを先頭に**、1〜3件',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['pos', 'meaning_ja', 'example_en', 'note'],
          properties: {
            pos:        { type: 'string', description: '品詞(日本語で1語)' },
            meaning_ja: { type: 'string', description: '意味(日本語30字以内)' },
            example_en: { type: 'string', description: 'その意味で使った短い例文(英語8語以内)' },
            note:       { type: 'string', description: '間違えやすい点。無ければ空文字' },
          },
        },
      },
    },
  },
}

/** まとめて引くときの受け皿。1回の呼び出しで何語も返す */
const EMIT_GLOSSES_TOOL = {
  name: 'emit_glosses',
  description: '複数の語の意味をまとめて返す',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    required: ['items'],
    properties: {
      items: {
        type: 'array',
        description: '渡された語と**同じ数・同じ順**で返す',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['display', 'phonetic', 'senses'],
          properties: {
            display:  { type: 'string', description: '見出し。渡された語のままの形' },
            phonetic: { type: 'string', description: 'その文での読み方(IPA)。スラッシュは付けない' },
            senses: {
              type: 'array',
              description: '意味。**その文でふさわしいものを先頭に**、1〜3件',
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['pos', 'meaning_ja', 'example_en', 'note'],
                properties: {
                  pos:        { type: 'string' },
                  meaning_ja: { type: 'string' },
                  example_en: { type: 'string' },
                  note:       { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  },
}

/** 語ひとつぶんの控えの形にそろえる */
const toGloss = (raw: string, wordNorm: string, contextKey: string,
                 out: { display?: string; phonetic?: string; senses?: Record<string, string>[] }) => {
  const senses = (out.senses ?? [])
    .filter((x) => String(x?.meaning_ja ?? '').trim())
    .slice(0, 4)
    .map((x) => ({
      pos: x.pos ?? '',
      meaning_ja: x.meaning_ja,
      example_en: x.example_en ?? '',
      note: x.note ?? '',
    }))
  if (!senses.length) return null
  return {
    word_norm: wordNorm,
    context_key: contextKey,
    display: out.display || raw,
    phonetic: String(out.phonetic ?? '').replace(/^\/+|\/+$/g, '').trim() || null,
    pos: senses[0].pos,
    meaning_ja: senses[0].meaning_ja,
    example_en: senses[0].example_en || null,
    note: senses[0].note || null,
    senses,
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  // どこに時間がかかっているのかを測って返す。
  // **速い・遅いを体感で議論しない。** 数字で見る(2026-08)
  const startedAt = Date.now()
  let askedAt = 0

  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    // ── 1. ログインしている人か確かめる ────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return reply({ error: 'ログインが必要です。画面を読み込み直してください。' }, 401)
    }

    const asCaller = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    })
    const { data: { user: caller } } = await asCaller.auth.getUser()
    if (!caller) {
      // 長く開いたままのタブで、ログインの札の期限が切れているとここに来る。
      // **何をすればよいかまで書く。** 文言だけでは利用者は動けない
      return reply({
        error: 'ログインの期限が切れています。画面を読み込み直してから、もう一度お試しください。',
      }, 401)
    }

    // ── 2. 送られてきた内容 ────────────────────────────────
    let body: Record<string, unknown>
    try { body = await req.json() } catch { return reply({ error: '内容を読めませんでした' }, 400) }

    // 控えに書き込むのはこの関数だけ(service_role)。画面からは読むだけ
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false },
    })

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) {
      return reply({
        error: 'Claude の鍵が設定されていません。Supabase の Edge Functions → Secrets に'
          + ' ANTHROPIC_API_KEY を追加してください。',
      }, 500)
    }

    // ── まとめて引く(先読み)────────────────────────────────
    //
    //   教材を開いたときに、まだ控えに無い語を**裏で先に引いておく**
    //   (2026-08 の要望)。触れたときには出来上がっている。
    //
    //   **1語ずつ呼ばない。** 指示文(約700トークン)が語の数だけかかり、
    //   費用が3倍近くになる。10語をまとめて1回で引く。
    if (Array.isArray(body.words) && body.words.length) {
      const items = (body.words as Record<string, string>[])
        .map((w) => ({
          raw: String(w.word ?? '').trim().slice(0, 60),
          sentence: String(w.sentence ?? '').trim().slice(0, 400),
          contextKey: String(w.contextKey ?? '').slice(0, 32),
        }))
        .filter((w) => normWord(w.raw))
        .slice(0, BATCH_LIMIT)
      if (!items.length) return reply({ glosses: [] })

      const prompt = [
        '# 調べる語(この順で、同じ数だけ返すこと)',
        ...items.map((w, i) => `${i + 1}. ${w.raw}\n   出てきた文: ${w.sentence}`),
        `\n# 学習者のレベル\n${String(body.level ?? 'B1').slice(0, 20)}`,
      ].join('\n')

      askedAt = Date.now()
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 4000,
          output_config: { effort: 'low' },
          system: [{ type: 'text', text: SYSTEM_PROMPT }],
          tools: [EMIT_GLOSSES_TOOL],
          tool_choice: { type: 'tool', name: 'emit_glosses' },
          messages: [{ role: 'user', content: prompt }],
        }),
      })
      if (!res.ok) {
        const text = await res.text()
        // **裏で先に引いているだけなので、画面には出さない。**
        // 直せる種類の断り(残高・鍵)かどうかを画面に伝え、
        // それ以上むだに呼ばないようにする
        const info = humanApiError(res.status, text)
        return reply({ error: info.message, detail: info.detail, fatal: info.fatal }, 200)
      }
      const data = await res.json()
      const block = (data.content ?? []).find((b: { type: string }) => b.type === 'tool_use')
      const out = (block?.input?.items ?? []) as Record<string, string>[]

      const glosses = []
      for (let i = 0; i < items.length; i += 1) {
        const g = out[i] ? toGloss(items[i].raw, normWord(items[i].raw), items[i].contextKey, out[i]) : null
        if (g) glosses.push(g)
      }
      if (glosses.length) {
        const { error: saveError } = await admin
          .from('word_glosses').upsert(glosses, { onConflict: 'word_norm,context_key' })
        if (saveError) console.error('控えに残せませんでした', saveError)
      }
      return reply({
        glosses,
        ms: { total: Date.now() - startedAt, setup: askedAt - startedAt, ai: Date.now() - askedAt },
      })
    }

    const raw = String(body.word ?? '').trim().slice(0, 60)
    const wordNorm = normWord(raw)
    if (!wordNorm) return reply({ error: '英語の語を指定してください' }, 400)

    const sentence = String(body.sentence ?? '').trim().slice(0, 400)
    const level = String(body.level ?? 'B1').trim().slice(0, 20)
    // **鍵は画面側で作ったものを使う。** 両方で同じ計算をすると、
    // いつか必ずずれる(語のそろえ方で懲りた)。
    // 古い画面からの呼び出しに備えて、無ければここで作る。
    const contextKey = typeof body.contextKey === 'string' && body.contextKey
      ? body.contextKey.slice(0, 32)
      : await contextKeyOf(sentence)

    // ── 3. ここへ来るのは「控えに無い語」だけ ────────────────
    //
    //   控えは**画面側が先に読んでいる**(src/lib/vocab.js)。
    //   ここでもう一度読むと、その往復のぶんだけ遅くなるだけである。
    //   同じ語を2人が同時に引いても、下の upsert で上書きされるだけで害はない。

    // ── 4. 1語だけ引く ────────────────────────────────────

    /**
     * 実際に尋ねる(REST を直接叩く)。
     *
     * `strict: true` は「返す形を API が保証する」指定である。
     * 断られたときだけ外して引き直す(モデルによっては通らないため)。
     */
    const ask = async (strict: boolean) => {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: MODEL,
          // 返すのは短い1件だけ
          max_tokens: 1000,
          // 辞書を引くだけなので、考える量は最小でよい
          // ※ Haiku 4.5 に替えるときは、この1行を消すこと
          output_config: { effort: 'low' },
          system: [{ type: 'text', text: SYSTEM_PROMPT }],
          tools: [{ ...EMIT_GLOSS_TOOL, strict }],
          tool_choice: { type: 'tool', name: 'emit_gloss' },
          messages: [{
            role: 'user',
            content: [
              `# 語\n${raw}`,
              sentence ? `\n# 出てきた文\n${sentence}` : '',
              `\n# 学習者のレベル\n${level}`,
            ].join(''),
          }],
        }),
      })
      if (!res.ok) {
        const text = await res.text()
        throw new ApiError(humanApiError(res.status, text))
      }
      return await res.json()
    }

    let response
    askedAt = Date.now()
    try {
      response = await ask(true)
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      // 形の指定を断られたときだけ、外してもう一度。
      // それ以外の失敗(鍵・上限など)は、そのまま下の catch に任せる
      if (!/strict|schema|input_schema|\b400\b/i.test(message)) throw e
      console.warn('形の指定が通らなかったので、外して引き直します', message)
      response = await ask(false)
    }

    if (response.stop_reason === 'refusal') {
      return reply({ error: 'この語は調べられませんでした。' }, 200)
    }
    const block = (response.content ?? []).find((b: { type: string }) => b.type === 'tool_use')
    if (!block) {
      return reply({ error: '意味を読み取れませんでした。もう一度お試しください。' }, 200)
    }
    const out = (block.input ?? {}) as {
      display?: string; phonetic?: string; senses?: Record<string, string>[]
    }
    // **中身が0件のまま「成功」を返さない**(第5.19.6節と同じ考え方)
    const senses = (out.senses ?? [])
      .filter((x) => String(x?.meaning_ja ?? '').trim())
      .slice(0, 4)
      .map((x) => ({
        pos: x.pos ?? '',
        meaning_ja: x.meaning_ja,
        example_en: x.example_en ?? '',
        note: x.note ?? '',
      }))
    if (!senses.length) {
      return reply({ error: '意味が空で返ってきました。もう一度お試しください。' }, 200)
    }

    // 古い列にも先頭の意味を入れておく。0011 の形で読む場所が残っていても壊れない
    const gloss = {
      word_norm: wordNorm,
      context_key: contextKey,
      display: out.display || raw,
      // 前後のスラッシュが付いてくることがある。控えには裸で入れ、
      // 画面側で /…/ を付ける(出し方を1か所にまとめるため)
      phonetic: String(out.phonetic ?? '').replace(/^\/+|\/+$/g, '').trim() || null,
      pos: senses[0].pos,
      meaning_ja: senses[0].meaning_ja,
      example_en: senses[0].example_en || null,
      note: senses[0].note || null,
      senses,
    }

    // ── 5. 控えに残す。**次からは無料で出る** ───────────────
    //   同時に別の人が同じ語を引くことがあるので、衝突は無視する。
    const { error: saveError } = await admin
      .from('word_glosses').upsert(gloss, { onConflict: 'word_norm,context_key' })
    if (saveError) console.error('控えに残せませんでした', saveError)

    return reply({
      gloss,
      cached: false,
      usage: {
        input: response.usage?.input_tokens ?? 0,
        output: response.usage?.output_tokens ?? 0,
      },
      // 内訳。支度(立ち上がり)と、AI に尋ねている時間を分けて返す
      ms: {
        total: Date.now() - startedAt,
        setup: askedAt - startedAt,
        ai: Date.now() - askedAt,
      },
    })
  } catch (e) {
    console.error(e)
    // すでに日本語に言い換えてあるものは、そのまま出す。
    // **残高切れ・鍵ちがいは待っても直らない。** その場合は fatal を付けて、
    // 画面側にこれ以上むだに呼ばせない
    if (e instanceof ApiError) {
      return reply({ error: e.message, detail: e.detail, fatal: e.fatal }, 200)
    }
    const message = e instanceof Error ? e.message : String(e)
    return reply({ error: `調べられませんでした: ${message}` }, 200)
  }
})
