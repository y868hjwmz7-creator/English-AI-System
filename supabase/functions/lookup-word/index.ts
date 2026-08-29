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
import Anthropic from 'npm:@anthropic-ai/sdk@0.65.0'
import { createClient } from 'jsr:@supabase/supabase-js@2'

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

// 使うモデル。generate-material と合わせてある。
// **変えたら画面側の単価(PRICE_PER_MTOK)も一緒に変えること。**
const MODEL = 'claude-sonnet-5'

const SYSTEM_PROMPT = `あなたは日本人のビジネス英語学習者に語の意味を教える辞書である。

# 守ること
1. **意味を1〜4件返す。** そして
   **その文でふさわしい意味を必ず先頭に置く。**
   例: 「The trains run every ten minutes.」の run なら
   1番目に「(電車が)走る・運行する」、2番目以降に「運営する」「動かす」。
   「She runs a small bakery.」の run なら
   1番目に「(店を)経営する・運営する」、2番目以降に「走る」。
   **辞書の並び順を機械的に写さない。** 文を読んで決めること
2. 2件目以降は、**その語を学ぶうえで知っておくべき他の意味**を、
   よく使う順に並べる。無理に4件にしない。1件で十分なら1件でよい
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
  strict: true,
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
        description: '意味。**その文でふさわしいものを先頭に**、1〜4件',
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

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

    // ── 3. 控えにあれば、それを返す(費用がかからない) ─────
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false },
    })
    const { data: cached } = await admin
      .from('word_glosses').select('*')
      .eq('word_norm', wordNorm).eq('context_key', contextKey).maybeSingle()
    if (cached) return reply({ gloss: cached, cached: true })

    // ── 4. 無ければ1語だけ引く ─────────────────────────────
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) {
      return reply({
        error: 'Claude の鍵が設定されていません。Supabase の Edge Functions → Secrets に'
          + ' ANTHROPIC_API_KEY を追加してください。',
      }, 500)
    }

    const client = new Anthropic({ apiKey })
    const response = await client.messages.create({
      model: MODEL,
      // 返すのは短い1件だけ。ここが大きいと、間違って長く書かせたときに響く
      max_tokens: 1500,
      // 辞書を引くだけなので、考える量は最小でよい(費用は考えた分もかかる)
      output_config: { effort: 'low' },
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      tools: [EMIT_GLOSS_TOOL as unknown as Anthropic.Tool],
      tool_choice: { type: 'tool', name: 'emit_gloss' },
      messages: [{
        role: 'user',
        content: [
          `# 語\n${raw}`,
          sentence ? `\n# 出てきた文\n${sentence}` : '',
          `\n# 学習者のレベル\n${level}`,
        ].join(''),
      }],
    })

    if (response.stop_reason === 'refusal') {
      return reply({ error: 'この語は調べられませんでした。' }, 200)
    }
    const block = response.content.find((b) => b.type === 'tool_use')
    if (!block || block.type !== 'tool_use') {
      return reply({ error: '意味を読み取れませんでした。もう一度お試しください。' }, 200)
    }
    const out = block.input as {
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
        input: response.usage.input_tokens,
        output: response.usage.output_tokens,
      },
    })
  } catch (e) {
    console.error(e)
    const message = e instanceof Error ? e.message : String(e)
    if (/authentication|invalid x-api-key|401/i.test(message)) {
      return reply({ error: 'Claude の鍵が正しくありません。' }, 200)
    }
    if (/rate.?limit|429/i.test(message)) {
      return reply({ error: '短い時間に調べすぎました。少し待ってからお試しください。' }, 200)
    }
    return reply({ error: `調べられませんでした: ${message}` }, 200)
  }
})
