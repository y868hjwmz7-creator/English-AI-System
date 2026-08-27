// ============================================================================
// 教材の下書きを作る受付窓口(Supabase Edge Function)
//
// 【なぜサーバー側でやるのか】
//   Claude API の鍵は、ブラウザに置いてはいけない。置くと、アプリを開いた
//   誰もがその鍵で好きなだけ生成でき、費用が青天井になる。
//   鍵はこの関数の中だけにあり、ブラウザにも GitHub にも出ない。
//
// 【この窓口がすること】
//   1. 送ってきた人がトレーナーか管理者かを確かめる(生徒は使えない)
//   2. 演習を1つぶん生成して返す
//   3. **保存はしない。** 下書きを返すだけ
//
//   保存しないのは意図的である。トレーナーが目を通して直す工程を
//   飛ばさせないため(仕様書 第5.13.5節)。共有ライブラリなので、
//   悪い教材1つが1,500人に届く。
//
// 【1回に1演習だけ作る理由】
//   40問を一度に作らせると、1回の応答が長くなり時間切れになりやすい。
//   10問ずつ4回に分ければ、失敗しても1演習の作り直しで済み、
//   画面に進み具合も出せる。
// ============================================================================
import Anthropic from 'npm:@anthropic-ai/sdk@0.71.0'
import { createClient } from 'jsr:@supabase/supabase-js@2'

// ────────────────────────────────────────────────────────────────
// 教材を生成させるときの指示
//
// 手本は docs/MATERIAL_EXAMPLE.md(利用者が実際にレッスンで作っているドリル)。
// **形だけでなく、指導ポイントの粒度や解答の書き方まで写す。**
//
// この指示は毎回同じなので、キャッシュを効かせて費用を抑える。
//
// ※ 画面から配置できるよう、あえて1ファイルにまとめてある。
//   分けたほうが読みやすいが、配置の手順が増えると事故のもとになる。
// ────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `あなたは日本のパーソナル英語スクールのトレーナーを補助する。
生徒の弱点に対応した練習ドリルを作るのが仕事である。

# もっとも大事な原則

**量は定着の条件である。削ってはいけない。**
同じ文法を使った違う文章を数十本くり返して、はじめて理屈ではなく
頭が語順に慣れる。指示された問数は必ず満たすこと。

# 手本(このスクールの実物)

教材:「名詞 + to不定詞 =〜すべき/〜する必要のある」

① 英文和訳 × 10
   出題: I have several things to do before the meeting.
   解答: 会議の前にやるべきことがいくつかあります。

② 穴埋め × 10(与える語つき)
   出題: I have a lot of emails (　　　) today.
   与える語: reply to
   解答: to reply to
   補足: reply to an email なので、最後の to を落とさない。

③ 和文英訳 × 10(解答例)
   出題: 今日やるべきことがたくさんあります。
   解答例: I have a lot of things to do today.
   別解: I have many things to do today.

④ リスニング + 理解 × 10(英文は見せずに読み上げる)
   読み上げ: I have three things to do before I leave the office.
   設問: How many things does the speaker need to do?
   解答: Three.

教材全体の指導ポイント:
   emails to reply to のように、reply to の to を落とさないこと。

# 作るときに必ず守ること

1. **1つの文法ポイントに絞る。** 複数の文法を混ぜない
2. **同じ文型で、場面と語彙だけを変える。** 定着が狙いなので変化は最小限
3. **業務で実際に使う場面にする**(会議、メール、顧客、書類、締切、報告)。
   業界が指定されていれば、その業界の場面に寄せる
4. **穴埋めには「落とし穴」を1つ以上入れる。**
   手本の reply to のように、間違えて初めて身につくもの。
   落とし穴を入れた問には、なぜ間違えやすいかを補足に書く
5. **和文英訳は「解答例」として出し、自然な別解も添える**
6. **リスニングの設問は、英文を聞かないと答えられないものにする。**
   常識や推測で答えられる質問は意味がない
7. 英文は**自然で、実際に使われる言い方**にする。教科書的な不自然さを避ける
8. 日本語訳は**その文法の感覚が伝わる訳し方**にする
   (to不定詞なら「〜すべき」と訳して感覚をつかませる)

# レベルの目安

Pre-Basic / Basic … 中学1〜2年程度。文は短く、語彙は基礎のみ
A1 / A1+ … 中学卒業程度。身近な場面
A2 / A2+ … 高校基礎。日常業務の簡単なやりとり
B1 / B1+ … 業務で使える。会議やメールの標準的な表現
B2 / B2+ … 込み入った議論、抽象的な話題
C1 / C1+ / C2 / Proficiency … 微妙な言い回し、専門的な議論

# 出力

emit_section という道具だけを使って返すこと。文章での説明は要らない。`

/** 演習の種類ごとの、追加の指示 */
const SECTION_INSTRUCTIONS: Record<string, string> = {
  translate_en_ja:
    '英文和訳。prompt_en に英文、answer に日本語訳を入れる。audio_text は prompt_en と同じにする。',
  fill_blank:
    '穴埋め。prompt_en に（　　　）を含む英文、hint に与える語(原形など)、answer に空欄に入る形を入れる。'
    + 'audio_text は入れない。落とし穴の問には note に理由を書く。',
  translate_ja_en:
    '和文英訳。prompt_ja に日本語、answer に解答例、answer_alt に別解(改行区切り、1〜2個)を入れる。'
    + 'audio_text は answer と同じにする。',
  listening:
    'リスニング。audio_text に読み上げる英文、question に英語の設問、answer に解答を入れる。'
    + 'prompt_en と prompt_ja は入れない(英文を見せないため)。'
    + '設問は、英文を聞かないと答えられないものにする。',
  read_aloud:   '音読。prompt_en に英文、prompt_ja に訳、audio_text は prompt_en と同じにする。',
  overlapping:  'オーバーラッピング。prompt_en に英文、prompt_ja に訳、audio_text は prompt_en と同じ。',
  shadowing:    'シャドーイング。prompt_en に英文、prompt_ja に訳、audio_text は prompt_en と同じ。',
  repeating:    'リピーティング。1文を短めにする。prompt_en に英文、prompt_ja に訳、audio_text は prompt_en と同じ。',
  vocabulary:   '単語。prompt_en に語、prompt_ja に意味と使い方、audio_text は prompt_en と同じ。',
  phrase:       'フレーズ。prompt_en にフレーズ、prompt_ja に意味と使う場面、audio_text は prompt_en と同じ。',
}

/** 生成した中身を受け取るための道具の形 */
const EMIT_SECTION_TOOL = {
  name: 'emit_section',
  description: '作った演習を返す',
  strict: true,
  input_schema: {
    type: 'object',
    additionalProperties: false,
    required: ['instruction', 'items'],
    properties: {
      instruction: { type: 'string', description: 'この演習の指示文(日本語)' },
      teaching_point: {
        type: 'string',
        description: '教材全体にかかる指導ポイント。1〜2文。最初の演習でだけ入れる',
      },
      items: {
        type: 'array',
        description: '設問',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['answer'],
          properties: {
            prompt_en:  { type: 'string', description: '英語で提示するもの' },
            prompt_ja:  { type: 'string', description: '日本語で提示するもの' },
            hint:       { type: 'string', description: '与える語(穴埋め)' },
            question:   { type: 'string', description: '設問(リスニング)' },
            answer:     { type: 'string', description: '解答 / 解答例' },
            answer_alt: { type: 'string', description: '別解。改行区切り' },
            audio_text: { type: 'string', description: '読み上げる英文' },
            note:       { type: 'string', description: '1問ごとの補足' },
          },
        },
      },
    },
  },
} as const

// ────────────────────────────────────────────────────────────────
// ここから受付窓口の本体
// ────────────────────────────────────────────────────────────────

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status, headers: { ...cors, 'Content-Type': 'application/json' },
  })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return reply({ error: 'POST で呼んでください' }, 405)

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) {
    return reply({
      error: 'Claude の鍵が設定されていません。'
        + 'Supabase の Edge Functions → Secrets に ANTHROPIC_API_KEY を登録してください。',
    }, 500)
  }

  // ── 1. 送ってきた人を確かめる ────────────────────────────
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return reply({ error: 'ログインしていません' }, 401)

  const url = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const asCaller = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user: caller } } = await asCaller.auth.getUser()
  if (!caller) return reply({ error: 'ログインの情報が確認できませんでした' }, 401)

  // 役割はサーバー側で確かめる。ブラウザから送られた値は信用しない。
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  })
  const { data: profile } = await admin
    .from('profiles').select('role, status').eq('id', caller.id).maybeSingle()

  if (!['trainer', 'owner'].includes(profile?.role ?? '') || profile?.status !== 'active') {
    return reply({ error: '教材を作る権限がありません' }, 403)
  }

  // ── 2. 送られてきた内容を確かめる ────────────────────────
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return reply({ error: '内容を読めませんでした' }, 400) }

  const sectionType = String(body.sectionType ?? '')
  const count = Math.min(Math.max(Number(body.count ?? 10), 1), 20)
  const topic = String(body.topic ?? '').trim()          // 弱点タグの名前と例
  const level = String(body.level ?? 'B1')
  const industry = String(body.industry ?? '').trim()
  const isFirst = Boolean(body.isFirst)

  if (!SECTION_INSTRUCTIONS[sectionType]) {
    return reply({ error: `演習の種類が正しくありません: ${sectionType}` }, 400)
  }
  if (!topic) return reply({ error: '弱点(何の練習か)を指定してください' }, 400)

  // ── 3. 生成する ──────────────────────────────────────────
  const client = new Anthropic({ apiKey })

  const userPrompt = [
    `# 何の練習か`,
    topic,
    ``,
    `# レベル`,
    level,
    industry ? `\n# 業界\n${industry}の場面に寄せること。` : '\n# 業界\n指定なし(どの職種にも通じる場面にする)。',
    ``,
    `# 作る演習`,
    `${SECTION_INSTRUCTIONS[sectionType]}`,
    ``,
    `**${count} 問ちょうど**作ること。減らさないこと。`,
    isFirst ? '\nこれが最初の演習なので、teaching_point(教材全体の指導ポイント)も入れること。' : '',
  ].join('\n')

  try {
    const response = await client.messages.create({
      model: 'claude-opus-5',
      max_tokens: 16000,
      // 指示は毎回同じなので、キャッシュを効かせて費用を抑える
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      tools: [EMIT_SECTION_TOOL as unknown as Anthropic.Tool],
      tool_choice: { type: 'tool', name: 'emit_section' },
      messages: [{ role: 'user', content: userPrompt }],
    })

    if (response.stop_reason === 'refusal') {
      return reply({ error: '内容が安全上の理由で断られました。弱点の指定を見直してください。' }, 400)
    }

    const block = response.content.find((b) => b.type === 'tool_use')
    if (!block || block.type !== 'tool_use') {
      return reply({ error: '生成の結果を読み取れませんでした。もう一度お試しください。' }, 502)
    }

    const result = block.input as {
      instruction?: string
      teaching_point?: string
      items?: Record<string, string>[]
    }

    return reply({
      ok: true,
      section: {
        exercise_type: sectionType,
        instruction: result.instruction ?? '',
        items: result.items ?? [],
      },
      teaching_point: result.teaching_point ?? null,
      // 画面に「いくら使ったか」を出せるようにしておく
      usage: {
        input: response.usage.input_tokens,
        output: response.usage.output_tokens,
        cacheRead: response.usage.cache_read_input_tokens ?? 0,
      },
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    // 鍵の誤りと使いすぎは、原因が分かるように書き分ける
    if (/authentication|invalid x-api-key|401/i.test(message)) {
      return reply({ error: 'Claude の鍵が正しくありません。Secrets の ANTHROPIC_API_KEY を確認してください。' }, 500)
    }
    if (/rate.?limit|429/i.test(message)) {
      return reply({ error: '短い時間に作りすぎました。少し待ってからお試しください。' }, 429)
    }
    if (/credit|billing|402/i.test(message)) {
      return reply({ error: 'Claude の残高が不足しています。Anthropic Console でご確認ください。' }, 402)
    }
    return reply({ error: `生成に失敗しました: ${message}` }, 500)
  }
})
