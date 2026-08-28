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
//   run は「走る」とは限らない。**その語が出てきた文をそのまま渡す。**
//   ただし控えは語ごとに1つなので、**最初に引いたときの文脈の意味**が
//   残る。ここは割り切り(`要確認`。別の意味が要ると分かったら、
//   語+文脈の組で持つ形に変える)。
//
// 【呼び出し方(アプリ側)】
//   supabase.functions.invoke('lookup-word', {
//     body: { word: 'deployment', sentence: 'The deployment failed.', level: 'B1' }
//   })
//   返るもの: { gloss: { word_norm, display, pos, meaning_ja, example_en, note },
//               cached: true | false }
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

// 使うモデル。generate-material と合わせてある。
// **変えたら画面側の単価(PRICE_PER_MTOK)も一緒に変えること。**
const MODEL = 'claude-sonnet-5'

const SYSTEM_PROMPT = `あなたは日本人のビジネス英語学習者に語の意味を教える辞書である。

# 守ること
1. **文の中での意味**を答える。辞書の1番目の意味を機械的に写さない
2. 品詞は日本語で1語(名詞 / 動詞 / 形容詞 / 副詞 / 前置詞 / 接続詞 /
   代名詞 / 助動詞 / 間投詞 / 熟語 のいずれか)
3. 意味は**日本語で30字以内**。言い換えを2つまで「・」で並べてよい
4. 例文は**短い1文**(8語以内)。渡された文をそのまま写さない
5. 注意は、**日本人が間違えやすい点があるときだけ**。無ければ空文字
6. 見出し(display)は、渡された語の**そのままの形**にする。
   原形に戻さない(went を go にしない)。活用形なら意味の中で触れる

# 出力
emit_gloss という道具だけを使って返すこと。文章での説明は要らない。`

const EMIT_GLOSS_TOOL = {
  name: 'emit_gloss',
  description: '語の意味を返す',
  strict: true,
  input_schema: {
    type: 'object',
    additionalProperties: false,
    required: ['display', 'pos', 'meaning_ja', 'example_en', 'note'],
    properties: {
      display:    { type: 'string', description: '見出し。渡された語のままの形' },
      pos:        { type: 'string', description: '品詞(日本語で1語)' },
      meaning_ja: { type: 'string', description: 'この文の中での意味(日本語30字以内)' },
      example_en: { type: 'string', description: '短い例文(英語8語以内)' },
      note:       { type: 'string', description: '間違えやすい点。無ければ空文字' },
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
    if (!authHeader) return reply({ error: 'ログインが必要です' }, 401)

    const asCaller = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    })
    const { data: { user: caller } } = await asCaller.auth.getUser()
    if (!caller) return reply({ error: 'ログインの情報が確認できませんでした' }, 401)

    // ── 2. 送られてきた内容 ────────────────────────────────
    let body: Record<string, unknown>
    try { body = await req.json() } catch { return reply({ error: '内容を読めませんでした' }, 400) }

    const raw = String(body.word ?? '').trim().slice(0, 60)
    const wordNorm = normWord(raw)
    if (!wordNorm) return reply({ error: '英語の語を指定してください' }, 400)

    const sentence = String(body.sentence ?? '').trim().slice(0, 400)
    const level = String(body.level ?? 'B1').trim().slice(0, 20)

    // ── 3. 控えにあれば、それを返す(費用がかからない) ─────
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false },
    })
    const { data: cached } = await admin
      .from('word_glosses').select('*').eq('word_norm', wordNorm).maybeSingle()
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
      max_tokens: 1000,
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
    const out = block.input as Record<string, string>
    if (!out.meaning_ja) {
      return reply({ error: '意味が空で返ってきました。もう一度お試しください。' }, 200)
    }

    const gloss = {
      word_norm: wordNorm,
      display: out.display || raw,
      pos: out.pos || '',
      meaning_ja: out.meaning_ja,
      example_en: out.example_en || null,
      note: out.note || null,
    }

    // ── 5. 控えに残す。**次からは無料で出る** ───────────────
    //   同時に別の人が同じ語を引くことがあるので、衝突は無視する。
    const { error: saveError } = await admin
      .from('word_glosses').upsert(gloss, { onConflict: 'word_norm' })
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
