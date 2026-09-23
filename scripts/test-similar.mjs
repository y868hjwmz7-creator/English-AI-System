/**
 * **意味の近さを調べる窓口の検証**(`npm run test:similar`・第5.247節)
 *
 * ============================================================================
 * 【なぜ要るのか】
 *
 *   2026-09-23、利用者から「文型トレーニングを作る際に、意味の近さの判定が
 *   効いていない」と指摘された。調べると、
 *
 *     ・0009(表と関数)は入っている  … `check.sql` で確認
 *     ・窓口は配られている            … GitHub Actions の実行 4 で確認
 *
 *   のに、画面には「意味の近さの判定が働きませんでした」が出ていた。
 *   **つまり、窓口が動いている最中に落ちていた。**
 *
 *   窓口(`supabase/functions/check-similar/index.ts`)は Deno で動き、
 *   Supabase の AI(gte-small)を使う。**この環境では1度も走らせられない。**
 *   だから**走らせられる形を先に作る**(共通ルール)——
 *   Supabase も Deno も AI も偽物に差し替え、**算段だけ**を確かめる。
 *
 * 【何を見るか】
 *
 *   ① 空の候補があっても、返す番号がずれない(**違う問を落とさない**)
 *   ② 遅いときは境目の手前で止まり、**落ちずに**「見た数」を返す
 *   ③ 余裕があるときは全部見て、古い英文の埋め合わせもする
 *   ④ 30問(3倍)でも 12 問で打ち切られない
 *   ⑤ 中身が1つも無ければ、1回も変換しない(0円・0秒)
 *
 * 【`ok()` の形】
 *   `ok(条件, 名前, 補足)`。`test-playmark.mjs` と**同じ形**にしてある
 *   (CLAUDE.md「検証ごとに `ok()` の形が違う」で転んだため)。
 * ============================================================================
 */
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const SRC = join(ROOT, 'supabase/functions/check-similar/index.ts')

let ng = 0
const ok = (cond, name, extra = '') => {
  if (cond) console.log(`✓ ${name}${extra ? ` — ${extra}` : ''}`)
  else { ng += 1; console.log(`✗ ${name}${extra ? ` — ${extra}` : ''}`) }
}

/* ──────────────────────────────────────────────────────────────
 * 窓口を、素の node から呼べる形にする。
 *
 * **書き写さない。本物のファイルをそのまま読む** —— 写すと、
 * 直した日に検証だけが古いままになる(CLAUDE.md「骨組みは本物と
 * 1文字も違えない」と同じ考え方)。
 * ────────────────────────────────────────────────────────────── */
let ts = readFileSync(SRC, 'utf8')
const before = ts
ts = ts.replace(/^import \{ createClient \}.*$/m, 'const createClient = globalThis.__createClient')
ts = ts.replace(/Deno\.serve\(async \(req\) => \{[\s\S]*$/m, 'export { handle }')
if (ts === before) {
  console.log('✗ 窓口の形が変わっています(import と Deno.serve を見つけられません)')
  process.exit(1)
}
const dir = mkdtempSync(join(tmpdir(), 'check-similar-'))
const js = execFileSync(join(ROOT, 'node_modules/.bin/esbuild'),
  ['--loader=ts', '--format=esm'], { encoding: 'utf8', input: ts })
const mod = join(dir, 'handle.mjs')
writeFileSync(mod, js)

/* ── 偽物 ───────────────────────────────────────────────────── */
globalThis.Deno = { env: { get: () => 'x' } }

/** 1件の変換にかける時間(ミリ秒)。**CPU を実際に使う** */
let embedMs = 1
let embedCalls = 0
globalThis.Supabase = { ai: { Session: class {
  async run() {
    embedCalls += 1
    const until = performance.now() + embedMs
    while (performance.now() < until) { /* 待つのではなく、使う */ }
    return new Array(384).fill(0.1)
  }
} } }

let rpcHits = []
let missingList = []
/** 埋め合わせを頼みに行った回数。**要らない問い合わせを投げていないか** */
let askedMissing = 0
const chain = (result) => new Proxy({}, {
  get: (_t, k) => {
    if (k === 'then') return undefined
    if (k === 'maybeSingle') return async () => result
    return () => chain(result)
  },
})
globalThis.__createClient = () => ({
  auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
  from: (t) => {
    if (t === 'profiles') return chain({ data: { role: 'trainer', status: 'active' } })
    if (t === 'learner_admins') return chain({ data: { id: 'l1' } })
    return { upsert: async () => ({ error: null }) }
  },
  rpc: async (name) => {
    if (name === 'similar_sentences') return { data: rpcHits, error: null }
    askedMissing += 1
    return { data: missingList, error: null }
  },
})

const { handle } = await import(mod)
const call = (body) => handle(new Request('http://x', {
  method: 'POST', headers: { Authorization: 'Bearer x' }, body: JSON.stringify(body),
}))

console.log('▶ 意味の近さを調べる窓口(check-similar)')

/* ── ① 空の候補があっても、番号がずれない ───────────────────
   **いちばん危ない形を、検証の中に必ず1つ置く**(CLAUDE.md)。
   もとは空を `filter()` で取り除いていたので、うしろの番号が
   1つずつ繰り上がり、**違う問を落としていた。** */
{
  embedMs = 1; embedCalls = 0
  rpcHits = [{ idx: 2, matched: 'old', similarity: 0.95 }]   // **送った並び**の2番目
  missingList = []
  const r = await (await call({
    candidates: ['A one.', 'B two.', '', 'D four.', 'E five.'], tagIds: ['t1'],
  })).json()
  ok(r.tooSimilar?.length === 1, '空の候補 … 1件返る')
  ok(r.tooSimilar?.[0]?.index === 3, '空の候補 … 番号がずれない(もとの 3 を指す)',
    `index=${r.tooSimilar?.[0]?.index}`)
  ok(r.tooSimilar?.[0]?.sentence === 'D four.', '空の候補 … 文もその番号のもの',
    String(r.tooSimilar?.[0]?.sentence))
  ok(embedCalls === 4, '空の候補 … 空は変換しない', `${embedCalls} 回`)
  ok(r.checked === 4 && r.total === 4, '空の候補 … 見た数と渡された数を返す',
    `checked=${r.checked} total=${r.total}`)
}

/* ── ② 遅いときは、境目の手前で止める ─────────────────────
   **落ちると1件も判定できない。** 見た分だけ返すほうがよい */
{
  embedMs = 300; embedCalls = 0; askedMissing = 0
  rpcHits = []; missingList = ['old one', 'old two']
  const cands = Array.from({ length: 30 }, (_, i) => `Sentence number ${i}.`)
  const t = performance.now()
  const res = await call({ candidates: cands, tagIds: ['t1'] })
  const spent = performance.now() - t
  const r = await res.json()
  ok(res.status === 200, '時間切れ … 落ちずに 200 を返す', `status=${res.status}`)
  ok(r.checked < r.total, '時間切れ … 全部は見ていないと言う(黙って絞らない)',
    `checked=${r.checked} / total=${r.total}`)
  ok(r.checked >= 1, '時間切れ … それでも1件は必ず見る', `checked=${r.checked}`)
  ok(spent < 2000, '時間切れ … 2秒の手前で返す', `${Math.round(spent)} ミリ秒`)
  ok(r.indexed === 0, '時間切れ … 余裕が無いので、埋め合わせはしない')
  /* **頼みに行くことすらしない。** 内側で「1件も変換しない」だけだと、
     要らない問い合わせは投げたままになる —— そこは**別の1本で見る**
     (CLAUDE.md「ほかの見張りに吸われると、外れていても緑になる」) */
  ok(askedMissing === 0, '時間切れ … 埋め合わせを頼みにも行かない',
    `${askedMissing} 回`)
}

/* ── ③ 余裕があるときは、全部見て埋め合わせもする ───────────
   **「出る」と「出ない」の両方を見る**(CLAUDE.md)。
   ②だけだと、埋め合わせを**まるごと消しても**緑のままになる */
{
  embedMs = 1; embedCalls = 0; askedMissing = 0
  rpcHits = []; missingList = ['old one', 'old two']
  const cands = Array.from({ length: 10 }, (_, i) => `Fast sentence ${i}.`)
  const r = await (await call({ candidates: cands, tagIds: ['t1'] })).json()
  ok(r.checked === 10 && r.total === 10, '余裕あり … 10問ぜんぶ見る',
    `checked=${r.checked}`)
  ok(askedMissing === 1, '余裕あり … 埋め合わせを頼みに行く', `${askedMissing} 回`)
  ok(r.indexed === 2, '余裕あり … 古い英文も埋め合わせる', `indexed=${r.indexed}`)
}

/* ── ④ 3倍(30問)でも打ち切られない ───────────────────────
   もとは `CANDIDATE_LIMIT = 12` で、**13問目から素通り**だった */
{
  embedMs = 1; embedCalls = 0
  rpcHits = []; missingList = []
  const cands = Array.from({ length: 30 }, (_, i) => `Triple ${i}.`)
  const r = await (await call({ candidates: cands, tagIds: ['t1'] })).json()
  ok(r.checked === 30, '3倍 … 30問ぜんぶ見る', `checked=${r.checked}`)
}

/* ── ⑤ 中身が1つも無ければ、1回も変換しない ───────────────── */
{
  embedMs = 1; embedCalls = 0
  const r = await (await call({ candidates: ['', '  ', '...'], tagIds: ['t1'] })).json()
  ok(r.tooSimilar?.length === 0 && r.checked === 0, '空ばかり … 0件で返す')
  ok(embedCalls === 0, '空ばかり … 1回も変換しない(0円・0秒)')
}

/* ── ⑥ 照合する範囲が無ければ、断る ───────────────────────── */
{
  embedMs = 1; embedCalls = 0
  const res = await call({ candidates: ['A one.'] })
  ok(res.status === 400, '範囲なし … 400 で断る', `status=${res.status}`)
  ok(embedCalls === 0, '範囲なし … 断る前に変換しない')
}

console.log(ng
  ? `\n❌ ${ng} 件が意図どおりではありません`
  : '\n✅ 意味の近さを調べる窓口は、すべて意図どおりです')
process.exit(ng ? 1 : 0)
