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

# 文型ドリルを作るときに必ず守ること

(記事・会話を作るときは、この下の「読み物を作るとき」に従うこと)

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
9. **指導ポイントは箇条書きにする。** 1つの注意点につき1行、改行で区切る。
   長い1本の文にすると画面で読めない。各行に英語の例を1つ入れる

# 読み物(記事・会話)を作るときに必ず守ること

記事とダイアローグは**練習問題ではなく読み物**である。上のドリルの決まりは
当てはまらない。ここで作るものは、音読・オーバーラッピング・シャドーイング・
リピーティングに使う「まとまった1本の文章」である。

1. **短い文の寄せ集めにしない。** 前を受けて話が進み、最後に区切りがつくこと。
   段落や発言を切り離して読んでも意味が通る、という作りにしない
2. **中身で読ませる。** 具体的な事実・数字・固有の状況を入れる。
   「テクノロジーは私たちの生活を変えています」のような、
   どの業界にも当てはまる文だけで埋めない。**面白いと思わせること**が条件である
3. **その業界の人が「あるある」と思う細部を入れる。**
   業界が指定されていれば、その現場でしか出てこない言葉や事情を使う
4. 語彙とテンポは指定されたレベルに合わせる。ただし
   **内容まで子ども向けにしない。** 大人が読んで退屈しないこと
5. 会話は**場面ごとに話し方を変える。** 噂話ならくだけた言い回しと相づち、
   交渉なら条件を確かめ合う言い方、会議なら議題に沿った進め方にする
6. 会話の登場人物は**名前と立場を最初に決めて、最後まで変えない**
7. 事実として言い切る内容は、**一般に知られている範囲にとどめる。**
   実在の企業や人物の、確認できない具体的な数字や発言を作らない

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

  // ── 本文(まとまった1本)────────────────────────────────
  // ここは「設問」ではなく「読み物」を作らせる。1項目 = 1段落 / 1発言。
  // 短い文を並べるのではなく、前の段落を受けて話が進むこと。
  article:
    '記事。**1項目 = 1段落**。読み物として通して読めること。'
    + '前の段落を受けて話が進み、最後の段落で締めること。'
    + '各段落は3〜5文、45〜65語。全体で250〜350語になる。'
    + 'prompt_en に段落の英文、prompt_ja にその段落の日本語訳を入れる。'
    + 'audio_text は prompt_en と同じにする。answer は空文字にする。'
    + '**headline に記事の見出しを入れる**(英語、8語以内、内容が分かるもの)。'
    + '1段落目で何の話か分かるようにし、事実・具体例・数字を入れて、'
    + '「人に話したくなる」中身にすること。教科書調の当たり障りのない文章にしない。',
  dialogue:
    '会話。**1項目 = 1つの発言**。speaker に話す人(名前と肩書き。'
    + '例: Sarah (Product Manager))、prompt_en にその発言、'
    + 'prompt_ja に日本語訳を入れる。audio_text は prompt_en と同じ。answer は空文字。'
    + '**登場人物は2人**で、名前は最初から最後まで変えない。'
    + '1発言は1〜3文。話が始まり、進み、区切りがつくところまでを1本にする。'
    + '相づち・言いよどみ・言い換えなど、実際の会話に出るものを入れる。'
    + '**headline に会話の題名を入れる**(英語、8語以内)。'
    + '場面の指定に合わせて丁寧さを変えること。噂話と交渉で同じ話し方にしない。',
  comprehension:
    '内容理解。question に英語の設問、answer に英語の解答例を入れる。'
    + 'prompt_en と prompt_ja は入れない。answer_alt に別の言い方があれば入れる。'
    + '**本文を読まないと答えられない設問**にする。一般常識で答えられるものは作らない。'
    + '最後の1問は、内容についてどう思うかを述べさせる問い(意見を言わせるもの)にする。',
  vocab_note:
    '本文に出た語句。**本文に実際に出てきた語句だけ**を選ぶ。出てこない語を作らない。'
    + 'prompt_en に語句、prompt_ja に意味、note にその語句を使った短い例文(英語)と'
    + '使いどころの注意を入れる。audio_text は prompt_en と同じ。answer は空文字。'
    + 'ゲストのレベルにとって新しい語、または知っていても使えていない語を選ぶ。',

  // ── 旧「長文」で使っていたもの ────────────────────────────
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
      headline: {
        type: 'string',
        description: '記事の見出し / 会話の題名(英語、8語以内)。記事・会話のときだけ入れる',
      },
      teaching_point: {
        type: 'string',
        description:
          '教材全体にかかる指導ポイント。最初の演習でだけ入れる。'
          + '**1つの注意点につき1行**にし、行と行は改行(\\n)で区切る。2〜4行。'
          + '1行は40〜70字。長い1本の文にしない(画面で読めなくなる)。'
          + '各行に、その注意点が効いている英語の例を1つ入れる'
          + '(例: 「決定する」は make a decision。do a decision とは言わない)。',
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
            speaker:    { type: 'string', description: '話す人(会話のときだけ)' },
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
  // 記事のジャンル / 会話の場面 / 話題の指定。記事と会話のときだけ使う
  const genre = String(body.genre ?? '').trim()
  const scene = String(body.scene ?? '').trim()
  const subject = String(body.subject ?? '').trim()
  // 本文。内容理解と語句は、本文を読まないと作れない
  const context = String(body.context ?? '').trim().slice(0, 8000)
  // すでに使われている英文。同じ文章が二度出ると、ゲストは
  // 「前にやった」と感じて手が止まる。避けさせる。
  const avoid = Array.isArray(body.avoid) ? body.avoid.slice(0, 150).map(String) : []

  if (!SECTION_INSTRUCTIONS[sectionType]) {
    return reply({ error: `演習の種類が正しくありません: ${sectionType}` }, 400)
  }
  // 記事と会話は、弱点が無くても作れる(読み物として成立するため)。
  // 文型ドリルは何の練習か決まらないと作れない。
  const isPassage = sectionType === 'article' || sectionType === 'dialogue'
  const needsContext = sectionType === 'comprehension' || sectionType === 'vocab_note'
  if (!topic && !isPassage && !needsContext) {
    return reply({ error: '弱点(何の練習か)を指定してください' }, 400)
  }
  if (needsContext && !context) {
    return reply({ error: '本文が空です。先に記事か会話を作ってください' }, 400)
  }

  // ── 3. 生成する ──────────────────────────────────────────
  const client = new Anthropic({ apiKey })

  // 本文は「問」ではなく段落・発言なので、数え方の言い方を変える。
  // 「10問作れ」と言うと、まとまった文章ではなく設問を作りにいってしまう。
  const countLine = sectionType === 'article'
    ? `**${count} 段落ちょうど**にすること。段落を減らさないこと。`
    : sectionType === 'dialogue'
      ? `**${count} 発言ちょうど**にすること。発言を減らさないこと。`
      : `**${count} 問ちょうど**作ること。減らさないこと。`

  const userPrompt = [
    topic ? `# 注意させたい弱点\n${topic}` : '',
    isPassage && topic
      ? '本文の中に、この弱点にあたる表現を自然に何度も入れること。'
        + 'ただし**不自然な文章にしてまで入れない**。読み物として成立することが先。'
      : '',
    ``,
    `# レベル`,
    level,
    industry ? `\n# 業界\n${industry}の場面に寄せること。` : '\n# 業界\n指定なし(どの職種にも通じる場面にする)。',
    genre ? `\n# 記事のジャンル\n${genre}` : '',
    scene ? `\n# 会話の場面\n${scene}\nこの場面らしい丁寧さ・語彙・テンポにすること。` : '',
    subject
      ? `\n# 話題(指定あり)\n${subject}\nこの話題で書くこと。`
      : (isPassage ? '\n# 話題\n指定なし。業界とジャンルに合う、具体的で面白い話題を自分で決めること。'
        + '当たり障りのない一般論にしない。' : ''),
    context ? `\n# 本文(この内容から作ること)\n${context}` : '',
    ``,
    `# 作る演習`,
    `${SECTION_INSTRUCTIONS[sectionType]}`,
    ``,
    countLine,
    avoid.length
      ? `\n# すでに使った英文(これらと同じ文は絶対に作らないこと)\n`
        + avoid.map((a) => `- ${a}`).join('\n')
        + `\n\n同じ文型でも、場面・主語・目的語・数量を変えて別の文にすること。`
      : '',
    isFirst ? '\nこれが最初の演習なので、teaching_point(教材全体の指導ポイント)も入れること。' : '',
  ].join('\n')

  // 生成そのもの。**待っている間も返事の一部を送り続ける**必要があるため、
  // 実際の処理はこの関数に閉じ込め、下の ReadableStream から呼ぶ。
  const generate = async () => {
    // Anthropic 側は必ず streaming で受け取る。40問ぶんの長い応答を
    // 一括で待つと、SDK の HTTP タイムアウトに掛かる。
    const stream = client.messages.stream({
      model: 'claude-opus-5',
      max_tokens: 16000,
      // 作るものは形が決まっているので、思考は中くらいで足りる。
      // 既定(high)のままだと40問で3分を超え、Supabase 側で切られていた。
      output_config: { effort: 'medium' },
      // 指示は毎回同じなので、キャッシュを効かせて費用を抑える
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      tools: [EMIT_SECTION_TOOL as unknown as Anthropic.Tool],
      tool_choice: { type: 'tool', name: 'emit_section' },
      messages: [{ role: 'user', content: userPrompt }],
    })
    const response = await stream.finalMessage()

    if (response.stop_reason === 'refusal') {
      return { error: '内容が安全上の理由で断られました。弱点の指定を見直してください。' }
    }

    const block = response.content.find((b) => b.type === 'tool_use')
    if (!block || block.type !== 'tool_use') {
      return { error: '生成の結果を読み取れませんでした。もう一度お試しください。' }
    }

    const result = block.input as {
      instruction?: string
      headline?: string
      teaching_point?: string
      items?: Record<string, string>[]
    }

    return {
      ok: true,
      section: {
        exercise_type: sectionType,
        instruction: result.instruction ?? '',
        items: result.items ?? [],
      },
      headline: result.headline ?? null,
      teaching_point: result.teaching_point ?? null,
      // 画面に「いくら使ったか」を出せるようにしておく
      usage: {
        input: response.usage.input_tokens,
        output: response.usage.output_tokens,
        cacheRead: response.usage.cache_read_input_tokens ?? 0,
      },
    }
  }

  /** 例外を、原因の分かる日本語にする */
  const explain = (e: unknown) => {
    const message = e instanceof Error ? e.message : String(e)
    if (/authentication|invalid x-api-key|401/i.test(message)) {
      return 'Claude の鍵が正しくありません。Secrets の ANTHROPIC_API_KEY を確認してください。'
    }
    if (/rate.?limit|429/i.test(message)) {
      return '短い時間に作りすぎました。少し待ってからお試しください。'
    }
    if (/credit|billing|402/i.test(message)) {
      return 'Claude の残高が不足しています。Anthropic Console でご確認ください。'
    }
    return `生成に失敗しました: ${message}`
  }

  // ── 4. 待っている間も、少しずつ返事を送り続ける ──────────
  //
  // 【なぜこれが必要か】
  //   Supabase の関数は、**150秒のあいだ何も返さないと切られる**。
  //   40問の生成はそれを超えることがあり、利用者の画面では
  //   「2分ほど待つと、何も出ずにボタンが元に戻る」状態になっていた。
  //
  //   そこで、答えが出るまでのあいだ**空白を1文字ずつ送り続ける**。
  //   通信が生きていると見なされるため、途中で切られない。
  //   空白は JSON の前に付いても読み飛ばされるので、受け取る側は
  //   これまでどおり JSON として読める。
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const beat = setInterval(() => {
        try { controller.enqueue(encoder.encode(' ')) } catch { /* すでに閉じている */ }
      }, 5000)
      try {
        const payload = await generate()
        controller.enqueue(encoder.encode(JSON.stringify(payload)))
      } catch (e) {
        console.error(e)
        controller.enqueue(encoder.encode(JSON.stringify({ error: explain(e) })))
      } finally {
        clearInterval(beat)
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
})
