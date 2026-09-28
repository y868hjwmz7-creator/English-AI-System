/**
 * **教材を作る窓口が、断られた理由をそのまま出すか**(第5.294節)
 *
 * 2026-09-28 実機・利用者の指摘。
 *
 *   > 何が起きていますか？ 文型トレーニングが3回連続で作れませんでした
 *
 * 画面には「内容が安全上の理由で断られました。**弱点の指定を見直して
 * ください。**」と出ていたが、**弱点が原因だとは誰も確かめていなかった。**
 * 断りには `stop_details`(`category` と `explanation`)が付いてくるのに、
 * **1文字も読まずに捨てていた**(もらえる正解を捨てない・CLAUDE.md)。
 *
 * 【なぜ素の node で走らせられるのか】
 *   窓口は Deno で動き、**この環境からは1度も動かせない**(第5.247節)。
 *   そこで **`refusalNote()` だけを切り出して** esbuild で型を落とし、
 *   素の node で呼ぶ。中身は**本物のファイルから読む**ので、
 *   窓口を直せば、この検証も一緒に動く(**書き写さない**)。
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'supabase/functions/generate-material/index.ts')
const src = readFileSync(SRC, 'utf8')

let bad = 0
const ok = (t) => console.log(`✓ ${t}`)
const ng = (t, d = '') => { bad += 1; console.log(`✗ ${t}${d ? `\n    ${d}` : ''}`) }

/* ── ① 断りの道は、ぜんぶ1か所を通るか ──────────────────────
   **コメントを落としてから数える**(CLAUDE.md)—— 説明の中にも同じ語が出る */
const 素 = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
/* **添え書きのある道は4行になる。** 窓は広めに取る ——
   狭いと「見つからない = 緑」ではなく「数が足りない = 赤」になるが、
   **どこが漏れたのか分からない**ので、素通りと同じくらい困る */
const 断り = [...素.matchAll(/stop_reason === 'refusal'\)\s*\{\s*([\s\S]{0,300}?)\n\s*\}/g)]
  .map((m) => m[1].trim())
if (断り.length < 5) {
  ng('断り … 見つけた道が少なすぎる(形が変わった?)', `${断り.length} か所`)
} else {
  const 外れ = 断り.filter((b) => !/^return refusalNote\(/.test(b))
  if (外れ.length) {
    ng('断り … 1か所を通っていない道がある', 外れ.join('\n    '))
  } else ok(`断り … ${断り.length} か所とも \`refusalNote()\` 1か所を通る`)
}

/* ── ② **決めつけの1文が残っていないか** ──
   「弱点の指定を見直してください」は、確かめずに書いた原因である。

   **コメントを落としてから数える**(CLAUDE.md)—— 上の説明(JSDoc)に
   **何が悪かったのかを書き残してある**ので、`src` のまま探すと
   **自分の説明に当たって、永久に赤いまま**になる(2026-09 に何度も踏んだ) */
if (/弱点の指定を見直してください/.test(素)) {
  ng('断り … 原因を決めつける文が残っている',
    '何が引っかかったのかは、返ってきた `category` にしか書いていない')
} else ok('断り … 原因を決めつけない(切り分け方だけを書く)')

/* ── ③ **本当にそう返るか。** 切り出して、素の node で呼ぶ ── */
const at = src.indexOf('function refusalNote(')
if (at < 0) {
  ng('断り … `refusalNote()` が無い')
} else {
  const body = src.slice(at, src.indexOf('\n}', at) + 2)
  const dir = mkdtempSync(join(tmpdir(), 'refusal-'))
  const js = execFileSync(join(ROOT, 'node_modules/.bin/esbuild'),
    ['--loader=ts', '--format=esm'], { encoding: 'utf8', input: `export ${body}` })
  const mod = join(dir, 'refusal.mjs')
  writeFileSync(mod, js)
  const { refusalNote } = await import(mod)

  /* **いちばん危ない形を、検証の中に必ず1つ置く**(CLAUDE.md)——
     ここでは「理由が1つも返ってこない」形である */
  const 出る = refusalNote(
    { stop_reason: 'refusal', stop_details: { category: 'cyber', explanation: 'なんとかの理由' } })
  if (!/cyber/.test(出る.error) || !/なんとかの理由/.test(出る.error)) {
    ng('断り … 返ってきた分類と説明を、画面に出していない', 出る.error)
  } else ok(`断り … 分類と説明をそのまま出す(${出る.error.slice(0, 40)}…)`)

  const 出ない = refusalNote({ stop_reason: 'refusal' })
  if (!/理由は返ってきませんでした/.test(出ない.error)) {
    ng('断り … 理由が無いときに、黙って消している', 出ない.error)
  } else ok('断り … 理由が返らなければ「返ってきませんでした」と書く')

  /* **null が来ても「null」と書かない**(0 と null を取り違えない) */
  const ぬる = refusalNote({ stop_reason: 'refusal', stop_details: { category: null, explanation: null } })
  if (/null|undefined/.test(ぬる.error)) {
    ng('断り … 空の値がそのまま画面に出ている', ぬる.error)
  } else ok('断り … 空の値を、そのまま画面に出さない')

  /* **添え書きは、渡したときだけ**(効かない案内を出さない) */
  const 添え = refusalNote({ stop_reason: 'refusal' }, '1つずつ外してください。')
  if (!/1つずつ外してください。$/.test(添え.error)) {
    ng('断り … 添え書きが付いていない', 添え.error)
  } else if (/1つずつ外して/.test(出ない.error)) {
    ng('断り … 渡していないのに添え書きが付く', 出ない.error)
  } else ok('断り … 添え書きは、渡したときだけ付く')

  /* **記録にも残る**(画面に出す文とは別に、切り分け用) */
  if (!/stop_reason: refusal/.test(出る.detail ?? '')) {
    ng('断り … 記録(detail)に残っていない', String(出る.detail))
  } else ok('断り … 記録にも `stop_reason` と分類が残る')
}

/* ══════════════════════════════════════════════════════════════════
   **失敗の知らせを、空にしない**(第5.295節・2026-09-28 実機)

     > 1、2回目はただの「作成できませんでした」だか「失敗しました」
     > という表示でした

   知らせの箱は `作れませんでした。` + 中身 の2段でできている。
   中身が空だと**見出しだけ**が残り、何が起きたのか誰にも分からない。
   `e?.message ?? String(e)` は **`??` が空っぽの文字を素通りさせる**ので、
   `e.message` が `''` のとき、そのまま `''` が入っていた。
   ══════════════════════════════════════════════════════════════════ */
{
  const { failText, FAIL_UNKNOWN } = await import('../src/lib/failText.js')

  /* ── ① **空っぽは、ぜんぶ言葉に変わる** ──
     **いちばん危ない形を、検証の中に必ず1つ置く**(CLAUDE.md)——
     ここでは `new Error('')`(実際に起きた形)である */
  const 空 = [new Error(''), new Error('   '), '', '   ', undefined, null,
    'undefined', 'null', {}, { message: '' }]
  const 残り = 空.filter((v) => failText(v) !== FAIL_UNKNOWN)
  if (残り.length) {
    ng('失敗の知らせ … 空のまま画面へ出る形がある',
      残り.map((v) => `${JSON.stringify(v) ?? String(v)} → "${failText(v)}"`).join('\n    '))
  } else ok(`失敗の知らせ … ${空.length} とおりの空っぽが、ぜんぶ言葉になる`)

  /* ── ② **「出る」と「出ない」の両方を見る** ──
     何でも決まり文句に置き換える形に書き換えたら、
     **本当の理由まで消える。** そちらも赤くする */
  const 本物 = [[new Error('本当の理由'), '本当の理由'],
    ['生成に失敗しました: 504', '生成に失敗しました: 504'],
    ['  前後に空白  ', '前後に空白']]
  const 消えた = 本物.filter(([v, want]) => failText(v) !== want)
  if (消えた.length) {
    ng('失敗の知らせ … 本当の理由まで置き換えている',
      消えた.map(([v, want]) => `ほしい "${want}" / 出た "${failText(v)}"`).join('\n    '))
  } else ok('失敗の知らせ … 理由があるときは、そのまま出す(消さない)')

  /* ── ③ **決まり文句に、推測を書いていない** ──
     「通信が切れた」「時間切れ」は**確かめていない**
     (分かっていないことを、分かったように書かない・CLAUDE.md) */
  if (/通信が切れ|時間切れ|タイムアウト|混雑/.test(FAIL_UNKNOWN)) {
    ng('失敗の知らせ … 確かめていない原因を書いている', FAIL_UNKNOWN)
  } else ok('失敗の知らせ … 決まり文句に、確かめていない原因を書いていない')

  /* ── ④ **呼ぶ側が、本当に通っているか** ──
     定義だけあって誰も呼ばなければ、何も起きない */
  const 通る = [
    ['仕事の記録', 'src/lib/generateJob.js', /error: failText\(e\)/],
    ['教材を作る画面', 'src/components/MaterialForm.jsx', /setError\(failText\(message\)\)/],
  ]
  const 抜け = []
  for (const [what, file, re] of 通る) {
    const t = readFileSync(join(ROOT, file), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    if (!re.test(t)) 抜け.push(`${what}(${file})`)
    /* **素通りさせる形が残っていないか** */
    if (/\?\.message \?\? String\(/.test(t)) 抜け.push(`${what} … \`??\` の素通りが残っている`)
  }
  if (抜け.length) {
    ng('失敗の知らせ … `failText()` を通っていない場所がある', 抜け.join('\n    '))
  } else ok('失敗の知らせ … 記録する側も、画面に出す側も `failText()` 1か所を通る')
}

console.log(bad === 0 ? '\n✅ 教材を作る失敗の知らせは、すべて意図どおりです' : `\n❌ ${bad} 件`)
process.exit(bad === 0 ? 0 : 1)
