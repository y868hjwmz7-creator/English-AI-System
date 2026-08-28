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

// 一度に変換する既存の文の上限。
// Edge Function には CPU 時間と記憶域の上限があり、まとめて変換すると
// 関数ごと落ちる。落ちると通信そのものが失敗し、原因が分かりにくい。
// 足りなければ次の呼び出しで続きが埋まるので、少なめにしておく。
const BACKFILL_LIMIT = 40

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

  const candidates = (Array.isArray(body.candidates) ? body.candidates : [])
    .map((c) => String(c ?? '')).filter((c) => normEn(c))
  const learnerId = body.learnerId ? String(body.learnerId) : null
  const tagIds = Array.isArray(body.tagIds) && body.tagIds.length
    ? body.tagIds.map((t) => String(t))
    : null
  const threshold = Number.isFinite(Number(body.threshold))
    ? Math.min(Math.max(Number(body.threshold), 0.5), 1)
    : 0.92

  if (!candidates.length) return reply({ tooSimilar: [], indexed: 0 })
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

  let session: { run: (t: string, o: unknown) => Promise<number[]> }
  try {
    // deno-lint-ignore no-explicit-any
    session = new (globalThis as any).Supabase.ai.Session('gte-small')
  } catch {
    return reply({
      error: '英文を数値に変換する仕組みを使えませんでした。'
        + 'Supabase の Edge Runtime が古い可能性があります。',
    }, 500)
  }

  const embed = (text: string) => session.run(text, { mean_pool: true, normalize: true })

  // ── 3. まだ変換していない既存の英文を埋める ──────────────
  //   0008 より前からある教材の英文には並びが無い。並びが無い文は
  //   照合の対象にならず、素通りしてしまう。呼ばれるたびに少しずつ埋める。
  let indexed = 0
  try {
    // 読み出しは**呼び出した人として**行う。管理者の鍵で呼ぶと
    // auth.uid() が空になり、関数の中の権限の確認が働かない。
    const { data: missing } = await asCaller.rpc('sentences_without_embedding', {
      p_learner: learnerId, p_tags: tagIds, p_limit: BACKFILL_LIMIT,
    })
    const list: string[] = (missing ?? []).map((r: unknown) =>
      typeof r === 'string' ? r : String((r as { sentences_without_embedding?: string })
        ?.sentences_without_embedding ?? ''))
      .filter(Boolean)

    if (list.length) {
      const rows = []
      for (const text of list) {
        rows.push({ text_norm: text, embedding: JSON.stringify(await embed(text)) })
      }
      await admin.from('sentence_embeddings').upsert(rows, { onConflict: 'text_norm' })
      indexed = rows.length
    }
  } catch (e) {
    // 埋めきれなくても照合そのものは続ける。次の呼び出しで続きが埋まる。
    console.error('既存の英文の変換に失敗しました', e)
  }

  // ── 4. 候補を変換して照合する ────────────────────────────
  let embeddings: number[][]
  try {
    embeddings = []
    for (const text of candidates) embeddings.push(await embed(text))
  } catch (e) {
    console.error(e)
    return reply({ error: '英文を数値に変換できませんでした' }, 500)
  }

  // ここも呼び出した人として。関数の中でトレーナーかどうかと、
  // 担当しているゲストかどうかが確かめられる。
  const { data: hits, error } = await asCaller.rpc('similar_sentences', {
    p_learner: learnerId,
    p_tags: tagIds,
    p_embeddings: embeddings,
    p_threshold: threshold,
  })
  if (error) {
    console.error(error)
    return reply({ error: `近さを照合できませんでした: ${error.message}` }, 500)
  }

  // 候補の並びも貯めておく。次に同じ文が出たときの変換を省ける。
  try {
    const rows = candidates.map((text, i) => ({
      text_norm: normEn(text), embedding: JSON.stringify(embeddings[i]),
    }))
    await admin.from('sentence_embeddings').upsert(rows, { onConflict: 'text_norm' })
  } catch (e) {
    console.error('候補の変換結果を保存できませんでした', e)
  }

  return reply({
    indexed,
    threshold,
    tooSimilar: (hits ?? []).map((h: { idx: number; matched: string; similarity: number }) => ({
      index: h.idx,
      sentence: candidates[h.idx],
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
