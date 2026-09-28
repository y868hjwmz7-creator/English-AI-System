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
{
  /** 本物のファイルから、その関数の本体だけを取り出す(**書き写さない**) */
  const 取り出す = (名) => {
    const at = src.indexOf(`function ${名}(`)
    if (at < 0) return ''
    /* 宣言の頭(`async ` や `export ` の手前)まで戻す */
    const 頭 = src.lastIndexOf('\n', at) + 1
    return src.slice(頭, src.indexOf('\n}', at) + 2)
  }
  const みっつ = ['stopInfoOf', 'finishStream', 'refusalNote'].map(取り出す)
  if (みっつ.some((b) => !b)) {
    ng('断り … 取り出せない関数がある',
      ['stopInfoOf', 'finishStream', 'refusalNote']
        .filter((n, i) => !みっつ[i]).join(' / '))
  } else {
    const dir = mkdtempSync(join(tmpdir(), 'refusal-'))
    const js = execFileSync(join(ROOT, 'node_modules/.bin/esbuild'),
      ['--loader=ts', '--format=esm'], {
        encoding: 'utf8',
        input: みっつ.map((b) => `export ${b.replace(/^\s*(async )?function/, '$1function')}`)
          .join('\n'),
      })
    const mod = join(dir, 'refusal.mjs')
    writeFileSync(mod, js)
    const { refusalNote, finishStream } = await import(mod)

    /* ══════════════════════════════════════════════════════════════
       **ここが第5.298節の本体である。**

       SDK(`@anthropic-ai/sdk@0.71.0`)の `MessageStream` は、
       `message_delta` から `stop_reason` / `stop_sequence` / 使用量しか
       写さない。**`stop_details` はどこにも写らない。**
       だから `finalMessage()` の返りを何度読んでも、永久に空だった。

       **いちばん危ない形を、検証の中に必ず1つ置く**(CLAUDE.md)——
       ここでは「**最後の返りに理由が無い**」(= 本物と同じ形)である。
       `finalMessage()` の側から読む書き方に戻したら、ここが赤くなる。
       ══════════════════════════════════════════════════════════════ */
    /** 本物の SDK と同じふるまいをする、にせの流し込み */
    const にせ = (delta, 最後 = { stop_reason: 'refusal' }) => ({
      on: (name, cb) => {
        if (name !== 'streamEvent') return
        cb({ type: 'message_start', message: { stop_reason: null } })
        if (delta) cb({ type: 'message_delta', delta })
        cb({ type: 'message_stop' })
      },
      finalMessage: async () => 最後,
    })

    const 生から = await finishStream(にせ({
      stop_reason: 'refusal',
      stop_details: { category: 'cyber', explanation: 'なんとかの理由' },
    }))
    if (生から.stopInfo.category !== 'cyber'
      || 生から.stopInfo.explanation !== 'なんとかの理由') {
      ng('断り … 生の出来事から理由を取っていない(SDK は写してくれない)',
        JSON.stringify(生から.stopInfo))
    } else ok('断り … 最後の返りに理由が無くても、生の出来事から取る')

    /* **「出る」と「出ない」の両方を見る**(CLAUDE.md)——
       最後の返りにだけ理由があっても、ちゃんと拾う(SDK が直った日のため) */
    const 返りから = await finishStream(にせ(null,
      { stop_reason: 'refusal', stop_details: { category: 'bio', explanation: '' } }))
    if (返りから.stopInfo.category !== 'bio') {
      ng('断り … 最後の返りに理由があるのに読んでいない',
        JSON.stringify(返りから.stopInfo))
    } else ok('断り … 最後の返りに理由があれば、そちらからも取る')

    /* **理由が1つも無いとき、返ってきたものをそのまま出す** ——
       「返ってきませんでした」で終えると、次もここで手が止まる */
    const 中身だけ = await finishStream(にせ({ stop_reason: 'refusal' }))
    const 出た = refusalNote(中身だけ.stopInfo)
    if (!/stop_reason/.test(出た.error)) {
      ng('断り … 理由が無いときに、返ってきたものを捨てている', 出た.error)
    } else ok(`断り … 理由が無ければ、返ってきたものをそのまま出す`)

    const 出る = refusalNote({ category: 'cyber', explanation: 'なんとかの理由', raw: '' })
    if (!/cyber/.test(出る.error) || !/なんとかの理由/.test(出る.error)) {
      ng('断り … 返ってきた分類と説明を、画面に出していない', 出る.error)
    } else ok(`断り … 分類と説明をそのまま出す(${出る.error.slice(0, 40)}…)`)

    const 出ない = refusalNote({ category: '', explanation: '', raw: '' })
    if (!/理由は返ってきませんでした/.test(出ない.error)) {
      ng('断り … 理由が無いときに、黙って消している', 出ない.error)
    } else ok('断り … 何も返らなければ「返ってきませんでした」と書く')

    /* **null が来ても「null」と書かない**(0 と null を取り違えない) */
    const ぬる = refusalNote(
      (await finishStream(にせ({ stop_details: { category: null, explanation: null } }))).stopInfo)
    if (/\bnull\b|\bundefined\b/.test(ぬる.error.replace(/\{[\s\S]*\}/, ''))) {
      ng('断り … 空の値がそのまま画面に出ている', ぬる.error)
    } else ok('断り … 空の値を、そのまま画面に出さない')

    /* **添え書きは、渡したときだけ**(効かない案内を出さない) */
    const 添え = refusalNote({ category: '', explanation: '', raw: '' }, '1つずつ外してください。')
    if (!/1つずつ外してください。$/.test(添え.error)) {
      ng('断り … 添え書きが付いていない', 添え.error)
    } else if (/1つずつ外して/.test(出ない.error)) {
      ng('断り … 渡していないのに添え書きが付く', 出ない.error)
    } else ok('断り … 添え書きは、渡したときだけ付く')

    /* **控えは短く切る**(長い JSON で知らせの箱が画面を埋めない) */
    const 長い = await finishStream(にせ(
      { stop_reason: 'refusal', なにか: 'あ'.repeat(500) }))
    if (長い.stopInfo.raw.length > 200) {
      ng('断り … 控えを切っていない', `${長い.stopInfo.raw.length} 文字`)
    } else ok(`断り … 控えは ${長い.stopInfo.raw.length} 文字までに切る`)
  }
}

/* ── ④ **理由を、誰も読まない欄に隠していないか**(第5.298節)──
   第5.294節では理由を `detail` にも入れていたが、**画面の側に
   それを読む場所が無かった**(`grep` で 0 件)。**二重に届いていなかった。**
   だから `refusalNote()` は **`error` 1つだけ**を返す。
   (**空っぽのときの `detail` は別の話** —— あちらは
   「仕組みの内側の言葉を画面に出さない」という 2026-08 の指定であり、
   利用者に出す文はそれだけで足りている) */
{
  const at = src.indexOf('function refusalNote(')
  const body = at < 0 ? '' : src.slice(at, src.indexOf('\n}', at) + 2)
    .replace(/\/\*[\s\S]*?\*\//g, '')
  if (!body) {
    ng('断り … `refusalNote()` が無い')
  } else if (/\bdetail\b/.test(body)) {
    ng('断り … 理由を、画面が読まない欄(`detail`)に入れている',
      '利用者には一生届かない。`error` に入れること')
  } else ok('断り … 理由は `error` 1つだけに入れる(隠し場所を作らない)')
}

/* ── ⑤ **生の出来事を見る道を、通っているか**(第5.298節)──
   定義だけあって誰も呼ばなければ、何も起きない。
   **`finalMessage()` を直に呼ぶ形が戻っていないか**も見る。

   **道具そのものは数えない** —— `finishStream()` の中では
   `finalMessage()` を呼ぶのが正しい(ここを数えると永久に赤い) */
{
  const at = 素.indexOf('function finishStream(')
  const 道具 = at < 0 ? '' : 素.slice(at, 素.indexOf('\n}', at) + 2)
  const よそ = 道具 ? 素.replace(道具, '') : 素
  const 呼ぶ数 = (よそ.match(/await finishStream\(client\.messages\.stream\(\{/g) ?? []).length
  const 直呼び = (よそ.match(/await stream\.finalMessage\(\)/g) ?? []).length
  if (!道具) {
    ng('断り … `finishStream()` が無い')
  } else if (呼ぶ数 < 5) {
    ng('断り … `finishStream()` を通っていない道がある', `${呼ぶ数} か所`)
  } else if (直呼び) {
    ng('断り … `finalMessage()` を直に呼ぶ形が戻っている',
      `${直呼び} か所。理由が取れなくなる`)
  } else ok(`断り … ${呼ぶ数} か所とも \`finishStream()\` を通る(直呼びは0)`)
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
