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
import { EMIT_SECTION_TOOL, SECTION_INSTRUCTIONS, SYSTEM_PROMPT } from './prompt.ts'

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
