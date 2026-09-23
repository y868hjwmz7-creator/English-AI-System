// ============================================================================
// 意味の近さで重複を弾く窓口(Supabase Edge Function)
//
// 【なぜこれが必要か】
//   「I have work to do.」と「I have a job to do.」は、文字としては
//   別の文なので 0008 の照合を素通りする。しかしゲストから見れば同じ練習である。
//
//   意味の近さを測るには、英文を384個の数値の並びに変換する必要がある。
//   この変換は **Supabase の Edge Function の中で完結する**(gte-small)。
//   外部のサービスに文章を送らず、新しい鍵も要らず、追加の費用もかからない。
//
// 【この窓口がすること】
//   1. 送ってきた人がトレーナーか確かめる(ここを飛ばすと誰でも呼べる)
//   2. 照合する範囲の中で、まだ変換していない英文を変換して貯める
//      (0008 より前からある教材の分。一度やれば次からは要らない)
//   3. 候補の英文を変換し、近すぎるものを返す
//
// 【呼び出し方(アプリ側)】
//   supabase.functions.invoke('check-similar', {
//     body: { candidates: ['I have work to do.', ...],
//             learnerId: '…' | null, tagIds: ['infinitive'], threshold: 0.92 }
//   })
//
//   返るもの:
//     { tooSimilar: [{ index: 0, sentence: '…', matched: '…', similarity: 0.94 }],
//       indexed: 12 }        // 今回ついでに変換した既存の文の数
//
// 【できないこと】
//   gte-small は英語専用で、512語を超える文は切り詰められる。
//   このアプリが扱うのは1文ずつの練習文なので問題にならない。
// ============================================================================
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

// データベースの public.norm_en() と**同じ規則**。
// 3か所(SQL・画面・ここ)で同じ形にそろえないと、判定がずれる。
const normEn = (text: string) =>
  String(text ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

// ============================================================================
// **件数ではなく、時間で止める**(第5.247節・2026-09-23)
//
// Edge Function は **1回の呼び出しで CPU 2秒** までしか使えない。
// 英文を数値に変換する処理は CPU を使うため、まとめて行うと
// 「CPU Time exceeded」で関数ごと落ちる。落ちると応答に CORS の印が
// 付かず、画面には「窓口につながりません」としか出ない(2026-08 実機)。
//
// 【なぜ件数をやめたか】
//   もとは「候補12件 + 古い英文5件」と**件数で**決め打ちしていた。
//   ところが1件にかかる時間は決め打ちできない ——
//   **1回目の変換には、模型を読み込む時間がまるごと乗る。**
//   だから「17件なら2秒に収まる」とは言えず、収まらない日は
//   **判定がまるごと落ちる**(利用者の実機で、黄色い知らせが出ていた)。
//
//   **時間を測って、境目の手前で止める。** そうすれば、
//   速い日は多く見られるし、遅い日でも**落ちずに、見た分だけ返せる。**
//
// 【順番も変えた。**頼まれた仕事を先にやる**】
//   もとは「古い英文の埋め合わせ」を**先に**していた。
//   予算を先に使い切るので、**肝心の候補を見る前に落ちる。**
//   いまは 候補 → 照合 → (余った時間で)埋め合わせ の順である。
//
// 【見た数を必ず返す】
//   時間切れで全部は見られなかったとき、**黙って「近いものは無い」と
//   返さない**(CLAUDE.md「黙って絞らない」)。`checked` を返し、
//   画面がそれを知らせる。
// ============================================================================

/** 変換に使ってよい時間。2秒の手前で止める(残りは照合と後片づけに使う) */
const BUDGET_MS = 1200

/** 1回に見る候補の上限。**1つの演習の上限(30問)にそろえてある** */
const CANDIDATE_LIMIT = 30

/** ついでに埋め合わせる古い英文の上限(時間が余ったときだけ) */
const BACKFILL_LIMIT = 5

/**
 * 実際の処理。
 *
 * **この中で例外が出ても、必ず日本語の理由を JSON で返す。**
 * 関数がそのまま落ちると、応答に CORS の印が付かず、ブラウザからは
 * 「窓口につながりませんでした」としか見えない。何が起きたのか
 * 分からないのがいちばん困る。
 */
const handle = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return reply({ error: 'POST で呼んでください' }, 405)

  /* **どこまで進んだかを持つ**(第5.247節)。
     落ちたときに「窓口につながりません」としか出ないのが、
     いちばん困るところだった。**どの段で、何ミリ秒使って落ちたか**を
     返せば、画面にそのまま出せる(CLAUDE.md「道が2つあるものは、
     いまどちらを通ったかを見えるようにしてから直す」)。 */
  const t0 = performance.now()
  const ms = () => Math.round(performance.now() - t0)
  let stage = '受け取り'

  const url = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // ── 1. 送ってきた人を確かめる ────────────────────────────
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return reply({ error: 'ログインしていません' }, 401)

  const asCaller = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user: caller } } = await asCaller.auth.getUser()
  if (!caller) return reply({ error: 'ログインの情報が確認できませんでした' }, 401)

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
  const { data: callerProfile } = await admin
    .from('profiles').select('role, status').eq('id', caller.id).maybeSingle()

  if (callerProfile?.status !== 'active'
      || (callerProfile?.role !== 'trainer' && callerProfile?.role !== 'owner')) {
    return reply({ error: '教材を作れるのはトレーナーだけです' }, 403)
  }

  // ── 2. 送られてきた内容 ──────────────────────────────────
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return reply({ error: '送られた内容を読めませんでした' }, 400)
  }

  /* **番号をずらさない**(第5.247節)。
     もとは `filter()` で空の候補を**取り除いて**いたので、
     **そのうしろの番号が1つずつ繰り上がっていた。**
     返す `idx` は呼んだ側の並びの番号でなければならないので、
     ずれると**違う問を落とす。**
     取り除かず、**空の候補はその場に残したまま飛ばす。** */
  const candidates = (Array.isArray(body.candidates) ? body.candidates : [])
    .map((c) => String(c ?? ''))
    .slice(0, CANDIDATE_LIMIT)
  /** 中身のある候補の番号だけ(空の行は、変換も照合もしない) */
  const liveIdx = candidates
    .map((c, i) => (normEn(c) ? i : -1)).filter((i) => i >= 0)
  const learnerId = body.learnerId ? String(body.learnerId) : null
  const tagIds = Array.isArray(body.tagIds) && body.tagIds.length
    ? body.tagIds.map((t) => String(t))
    : null
  const threshold = Number.isFinite(Number(body.threshold))
    ? Math.min(Math.max(Number(body.threshold), 0.5), 1)
    : 0.92

  if (!liveIdx.length) return reply({ tooSimilar: [], indexed: 0, checked: 0, ms: ms() })
  if (!learnerId && !tagIds) {
    return reply({ error: '照合する範囲(ゲストか弱点)を指定してください' }, 400)
  }

  // 担当していないゲストを指定していないか。ここもサーバー側で確かめる。
  if (learnerId) {
    const { data: link } = await admin
      .from('learner_admins').select('id')
      .eq('admin_id', caller.id).eq('learner_id', learnerId)
      .is('ended_on', null).maybeSingle()
    if (!link && callerProfile.role !== 'owner') {
      return reply({ error: '担当していないゲストは指定できません' }, 403)
    }
  }

  stage = '変換の仕組みを用意する'
  let session: { run: (t: string, o: unknown) => Promise<number[]> }
  try {
    // deno-lint-ignore no-explicit-any
    session = new (globalThis as any).Supabase.ai.Session('gte-small')
  } catch {
    return reply({
      error: '英文を数値に変換する仕組みを使えませんでした。'
        + 'Supabase の Edge Runtime が古い可能性があります。',
      stage, ms: ms(),
    }, 500)
  }

  const embed = (text: string) => session.run(text, { mean_pool: true, normalize: true })

  /* ── 3. **頼まれた仕事を先にやる。候補を変換する** ──────────
     もとはここで「古い英文の埋め合わせ」をしていた(いまは第5段)。
     **予算を先に使い切ると、肝心の候補を見る前に落ちる。**

     **時間で止める。** 1件目には模型の読み込みがまるごと乗るので、
     件数では決め打ちできない(第5.247節)。
     **1件は必ず変換する** —— 0件で「近いものは無し」を返すと、
     それは嘘になる。 */
  stage = '候補を数値にする'
  const sent: number[] = []          // 実際に送った候補の、呼んだ側での番号
  const embeddings: number[][] = []
  try {
    for (const i of liveIdx) {
      if (sent.length && ms() > BUDGET_MS) break   // **境目の手前で止める**
      embeddings.push(await embed(candidates[i]))
      sent.push(i)
    }
  } catch (e) {
    console.error(e)
    return reply({ error: '英文を数値に変換できませんでした', stage, ms: ms() }, 500)
  }

  // ── 4. 照合する ──────────────────────────────────────────
  //   ここも**呼び出した人として**。関数の中でトレーナーかどうかと、
  //   担当しているゲストかどうかが確かめられる。
  stage = '近さを照合する'
  const { data: hits, error } = await asCaller.rpc('similar_sentences', {
    p_learner: learnerId,
    p_tags: tagIds,
    p_embeddings: embeddings,
    p_threshold: threshold,
  })
  if (error) {
    console.error(error)
    return reply({
      error: `近さを照合できませんでした: ${error.message}`, stage, ms: ms(),
    }, 500)
  }

  // 候補の変換結果を貯めておく。次に同じ文が出たときの変換を省ける。
  stage = '候補を控える'
  try {
    const rows = sent.map((idx, k) => ({
      text_norm: normEn(candidates[idx]), embedding: JSON.stringify(embeddings[k]),
    }))
    await admin.from('sentence_embeddings').upsert(rows, { onConflict: 'text_norm' })
  } catch (e) {
    console.error('候補の変換結果を保存できませんでした', e)
  }

  /* ── 5. **時間が余っていたら**、古い英文を埋め合わせる ──────
     0008 より前からある教材の英文には並びが無い。並びが無い文は
     照合の相手にならず、素通りしてしまう。**余った時間でだけ**進める ——
     ここで落ちると、せっかく出した答えごと失う。 */
  stage = '古い英文を埋め合わせる'
  let indexed = 0
  try {
    if (ms() < BUDGET_MS) {
      // 読み出しは**呼び出した人として**行う。管理者の鍵で呼ぶと
      // auth.uid() が空になり、関数の中の権限の確認が働かない。
      const { data: missing } = await asCaller.rpc('sentences_without_embedding', {
        p_learner: learnerId, p_tags: tagIds, p_limit: BACKFILL_LIMIT,
      })
      const list: string[] = (missing ?? []).map((r: unknown) =>
        typeof r === 'string' ? r : String((r as { sentences_without_embedding?: string })
          ?.sentences_without_embedding ?? ''))
        .filter(Boolean)

      const rows = []
      for (const text of list) {
        if (ms() > BUDGET_MS) break            // **ここでも境目を見る**
        rows.push({ text_norm: text, embedding: JSON.stringify(await embed(text)) })
      }
      if (rows.length) {
        await admin.from('sentence_embeddings').upsert(rows, { onConflict: 'text_norm' })
        indexed = rows.length
      }
    }
  } catch (e) {
    // 埋めきれなくても、出した答えはそのまま返す。次の呼び出しで続きが埋まる
    console.error('既存の英文の変換に失敗しました', e)
  }

  return reply({
    indexed,
    threshold,
    /** **見た数と、渡された数。** 足りなければ画面がそう言う(黙って絞らない) */
    checked: sent.length,
    total: liveIdx.length,
    ms: ms(),
    /* `idx` は**送った並び**の番号なので、**呼んだ側の並びに戻す。**
       空の候補を飛ばしているぶん、そのままでは1つずつずれる */
    tooSimilar: (hits ?? []).map((h: { idx: number; matched: string; similarity: number }) => ({
      index: sent[h.idx],
      sentence: candidates[sent[h.idx]],
      matched: h.matched,
      similarity: h.similarity,
    })),
  })
}

Deno.serve(async (req) => {
  try {
    return await handle(req)
  } catch (e) {
    console.error('check-similar で予期しない失敗', e)
    const message = e instanceof Error ? e.message : String(e)
    return reply({ error: `意味の近さを調べられませんでした: ${message}` }, 500)
  }
})
