/**
 * **66 の型(Quick Response の冊)の検証**。
 *
 * ============================================================================
 * 【2026-09 に、専用の画面をやめた】(利用者の指定)
 *
 *   > マイクで「話す」の機能は入りません。削除です。全ての型で削除してください。
 *   > そして、型のトレーニングの UI は廃止して、
 *   > quick response の UI にそのままコンテンツを移してください
 *
 *   だから、この検証も**採点(`judgeShift`)を見るのをやめた** ——
 *   採点はマイクのためだけに在り、まとめて消したからである。
 *   代わりに見るのは「**問が Quick Response の行になっているか**」である。
 *
 * 【この検証が守るもの】
 *
 *   ① お題の答えが、**狙った型に当たる**こと。
 *      1つでも当たらなければ、お手本のほうが間違っていることになる
 *   ② **素の文が、どの型にも当たらない**こと。
 *      素の文がすでにその型なら、「言い換え」の練習が成り立たない
 *   ③ 66 型を**1つも落としていない**こと
 *      (**一覧を勝手に減らさない**・`.claude/rules/common.md`)
 *   ④ 型の名前が `sentenceFrames.js` と**1文字も違わない**こと。
 *      違うと「型が2つある」ことになり、どちらが本物か分からなくなる
 *   ⑤ 出す問が、**機械で確かめてある**こと(`swapQuestions()` の安全弁)。
 *      確かめずに出して「ちがう型です」と言ったら、
 *      正しく言えた人に嘘をつくことになる
 *   ⑥ 行の形が **`nativeFlowRows()` と1文字も違わない**こと。
 *      ずれると `QrReview.jsx` が書き分けを持つ(数え方が2通りになる)
 *   ⑦ **マイクも打ち込む欄も、どこにも無い**こと
 *
 * 【いちばん危ない形を、検証の中に必ず置く】(CLAUDE.md)
 *
 *   空の文字列・知らない型・知らない中身の id・`SAME_SHAPE` の組・
 *   **同じ英文が二度**・**同じ日本語が二度**。
 *   「無ければ素通り」する形だけを並べると、壊しても緑のままになる。
 *
 * 【値を書き写さない。性質で見る】(CLAUDE.md)
 *
 *   「66 問ある」と書かない。**お題を1つ足した日に赤くなる**からである。
 *   見るのは「型の数と、覆った型の数が同じか」という**関係**のほう。
 * ============================================================================
 */
import { readFileSync, existsSync } from 'node:fs'
import { FRAME_SHIFTS, SHIFT_SCENES, shiftCount } from '../src/data/frameShift.js'
import { FRAME_SECTIONS } from '../src/data/sentenceFrames.js'
import { SAME_SHAPE, frameFormOf } from '../src/lib/frameMatch.js'
import {
  SWAP_GROUP, shiftQuestions, shiftTargetOf, swapFillers, swapQuestions,
} from '../src/lib/frameShift.js'
import { SWAP_BLANK, SWAP_FRAMES, SWAP_SLOTS, swapFrameOf } from '../src/data/phraseSwap.js'
import { SUBJ_KINDS } from '../src/data/swapParts.js'
import { NOUN_PHRASES } from '../src/data/nounPhrases.js'
import { nativeFlowRows } from '../src/data/nativeFlow.js'
import {
  FIRST_FRAME_PART, FRAME_PARTS, FRAME_PART_KEY,
  framePartOf, framePartTitle, frameQrCounts, frameQrRows, frameQuestions,
} from '../src/lib/frameQr.js'

const ROOT = new URL('..', import.meta.url).pathname
/** **コメントを落としてから数える。** 説明文にも同じ語が出てくる(CLAUDE.md) */
const code = (p) => readFileSync(ROOT + p, 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|[^:])\/\/.*$/gm, '$1 ')
const raw = (p) => readFileSync(ROOT + p, 'utf8')

let ng = 0
const ok = (cond, label, extra = '') => {
  if (cond) { console.log('  ✓', label) } else { ng += 1; console.log('  ✗', label, extra) }
}
const head = (t) => console.log(`\n▶ ${t}`)

/** `sentenceFrames.js` が持っている 66 型(**こちらが本物**) */
const FORMS = []
for (const s of FRAME_SECTIONS) for (const g of s.groups) for (const r of g.rows) FORMS.push(r.form)

/* ────────────────────────────────────────────────────────────
   ① 答えが、狙った型に当たるか
   ──────────────────────────────────────────────────────────── */
head('答えが、狙った型に当たるか')
{
  const miss = []
  for (const t of FRAME_SHIFTS) {
    for (const s of t.shifts) {
      const got = frameFormOf(s.ex)
      if (got !== shiftTargetOf(s.form)) {
        miss.push(`${t.id} 狙い「${s.form}」→ ${got ? `「${got}」` : '見分けられない'}  | ${s.ex}`)
      }
    }
  }
  ok(miss.length === 0, `答え ${shiftCount()} 問が、すべて狙った型に当たる`,
    `\n    ${miss.slice(0, 6).join('\n    ')}`)
}

/* ────────────────────────────────────────────────────────────
   ② 素の文が、どの型にも当たらないか
      **「出る」と「出ない」の両方を見る**(CLAUDE.md)
   ──────────────────────────────────────────────────────────── */
head('素の文が、どの型にも当たらないか')
{
  const bad = FRAME_SHIFTS
    .filter((t) => frameFormOf(t.base))
    .map((t) => `${t.id} → 「${frameFormOf(t.base)}」  | ${t.base}`)
  ok(bad.length === 0, `素の文 ${FRAME_SHIFTS.length} 本は、どれも 66 型のどれでもない`,
    `\n    ${bad.slice(0, 6).join('\n    ')}`)
}

/* ────────────────────────────────────────────────────────────
   ③ 66 型を1つも落としていないか
      **数を書き写さない。** 「型の数 = 覆った型の数」という関係で見る
   ──────────────────────────────────────────────────────────── */
head('66 型を1つも落としていないか')
{
  const used = new Set()
  for (const t of FRAME_SHIFTS) for (const s of t.shifts) used.add(s.form)
  const miss = FORMS.filter((f) => !used.has(f))
  ok(miss.length === 0,
    `${FORMS.length} 型すべてに、少なくとも1問ある`,
    `\n    覆っていない型: ${miss.join(' / ')}`)
  /* **逆も見る。** 一覧に無い型を勝手に書いていないか */
  const stray = [...used].filter((f) => !FORMS.includes(f))
  ok(stray.length === 0, '一覧に無い型を、勝手に増やしていない',
    `\n    知らない型: ${stray.join(' / ')}`)
}

/* ────────────────────────────────────────────────────────────
   ④ お題そのものの形
   ──────────────────────────────────────────────────────────── */
head('お題そのものの形')
{
  const ids = FRAME_SHIFTS.map((t) => t.id)
  ok(new Set(ids).size === ids.length, 'お題の id が重なっていない')

  const qids = shiftQuestions().map((q) => q.qid)
  ok(new Set(qids).size === qids.length, '問の id(お題:型)が重なっていない')

  const sceneIds = new Set(SHIFT_SCENES.map((s) => s.id))
  const badScene = FRAME_SHIFTS.filter((t) => !sceneIds.has(t.scene)).map((t) => t.id)
  ok(badScene.length === 0, '場面の id が、札の一覧にある', `\n    ${badScene.join(' / ')}`)

  const empty = FRAME_SHIFTS.filter((t) => !t.ja?.trim() || !t.base?.trim() || !t.shifts?.length)
  ok(empty.length === 0, 'お題・素の文・言い換える先が、どれも空でない',
    `\n    ${empty.map((t) => t.id).join(' / ')}`)

  const notEn = shiftQuestions().filter((q) => !/[A-Za-z]/.test(q.ex)).map((q) => q.qid)
  ok(notEn.length === 0, 'お手本が英語で書かれている', `\n    ${notEn.join(' / ')}`)
}

/* ────────────────────────────────────────────────────────────
   ⑤ `SAME_SHAPE`(見分けられないと宣言してある組)を吸収しているか
      **画面にこの事情を持ち込まない**
   ──────────────────────────────────────────────────────────── */
head('SAME_SHAPE を吸収しているか')
{
  ok(SAME_SHAPE.size > 0, '見分けられない組が、宣言されている')
  for (const [from, to] of SAME_SHAPE) {
    ok(shiftTargetOf(from) === to.as, `「${from}」は「${to.as}」として見る`)
    /* **その型を狙ったお題のお手本が、読み替え先に当たるか。**
       読み替えを外すと、ここだけが赤くなる */
    const q = shiftQuestions().find((x) => x.form === from)
    if (q) ok(frameFormOf(q.ex) === to.as, `「${from}」のお手本が「${to.as}」に当たる`)
  }
  ok(shiftTargetOf('そんな型は無い') === 'そんな型は無い', '知らない型は、そのまま返す')
}

/* ────────────────────────────────────────────────────────────
   ⑥ 日本語 → 英語の問(骨に肉を入れて、数をこなす)
   ──────────────────────────────────────────────────────────── */
head('日本語 → 英語の問(骨と肉)')
{
  /* **66 型ぜんぶに骨がある**(2026-09 利用者の指定
     「和らげと名詞句以外にも沢山型があったはずです……全てを網羅してください」)。
     型を足して骨を足し忘れたら赤くなる */
  const noFrame = FORMS.filter((f) => !SWAP_FRAMES.some((x) => x.form === f))
  ok(noFrame.length === 0, `66 型すべてに骨がある(${SWAP_FRAMES.length} 本)`,
    `\n    骨の無い型: ${noFrame.join(' / ')}`)
  const strayFrame = SWAP_FRAMES.filter((f) => !FORMS.includes(f.form)).map((f) => f.form)
  ok(strayFrame.length === 0, '一覧に無い型の骨を作っていない', `\n    ${strayFrame.join(' / ')}`)

  /* **席の種類が正しいか。** `own` なら自前の肉を持っているか */
  const badSlot = SWAP_FRAMES.filter(
    (f) => !SWAP_SLOTS.includes(f.slot) || (f.slot === 'own' && !(f.own ?? []).length),
  ).map((f) => f.id)
  ok(badSlot.length === 0, 'どの骨も、席の種類がはっきりしている', `\n    ${badSlot.join(' / ')}`)
  /* **主語の席は、呼ぶ主語の性格を言う。**
     言わずに総当たりにすると `The price helps us …` が出る(2026-09 実測) */
  const noPick = SWAP_FRAMES.filter((f) => f.slot === 'subj' && !SUBJ_KINDS.has(f.pick))
    .map((f) => f.id)
  ok(noPick.length === 0, '主語の骨は、どの性格の主語を呼ぶかを言っている',
    `\n    ${noPick.join(' / ')}`)
  const uselessPick = SWAP_FRAMES.filter((f) => f.slot !== 'subj' && f.pick).map((f) => f.id)
  ok(uselessPick.length === 0, '主語の席でない骨に、要らない指定を持たせていない',
    `\n    ${uselessPick.join(' / ')}`)
  /* **性格で絞っているか、書いてある形そのものを見る。**
     総当たりに戻しても、型だけ見る見張りは緑のままである ——
     `Poor planning helps us meet the deadline.` は型としては正しい
     (2026-09 実測)。**機械は意味のおかしさを捕まえない** */
  const flib = code('src/lib/frameShift.js')
  ok(/SUBJ_KINDS\.get\(f\.pick\)/.test(flib),
    '主語は、骨が呼んだ性格だけから出している(その1行が在る)')
  const kinds = [...SUBJ_KINDS.values()]
  ok(kinds.every((k) => k.length >= 8), 'どの性格の主語も 8 つ以上ある',
    kinds.map((k) => k.length).join(' / '))
  /* **どの主語も単数。** 現在形の骨に複数を入れると
     `Rising costs requires …` になる */
  const plural = kinds.flat().filter((x) => /s$/.test(x.en) && !/ss$/.test(x.en))
  ok(plural.length === 0, '主語がどれも単数(現在形の骨と合う)',
    plural.map((x) => x.en).join(' / '))

  /* **どの骨にも肉が回っているか。** 1問も出ない骨があれば行き止まり */
  const empty = SWAP_FRAMES.filter((f) => swapQuestions({ frame: f.id }).length === 0)
  ok(empty.length === 0, '1問も出ない骨が無い', `\n    ${empty.map((f) => f.id).join(' / ')}`)
  /* **薄すぎる骨が無いか。** 数が出ないと「量をこなす」にならない */
  const thin = SWAP_FRAMES.filter((f) => swapQuestions({ frame: f.id }).length < 8)
  ok(thin.length === 0, 'どの骨も 8 問以上ある',
    `\n    ${thin.map((f) => `${f.id} ${swapQuestions({ frame: f.id }).length}問`).join(' / ')}`)

  /* **入れる場所が、骨にも お題にも1つずつあるか** */
  const noBlank = SWAP_FRAMES.filter(
    (f) => !f.en.includes(SWAP_BLANK) || !f.ja.includes(SWAP_BLANK),
  ).map((f) => f.id)
  ok(noBlank.length === 0, '骨にも お題にも、入れる場所がある', `\n    ${noBlank.join(' / ')}`)
  ok(new Set(SWAP_FRAMES.map((f) => f.id)).size === SWAP_FRAMES.length, '骨の id が重なっていない')
  ok(swapFrameOf('そんな骨は無い') === null, '知らない骨は null(当てずっぽうで返さない)')

  /* **出した問は、どれも機械で確かめてあるか。**
     ここが、この練習の安全弁である —— 確かめられないものを出して
     「ちがう型です」と言ったら、正しく言えた人に嘘をつくことになる。
     **採点は消したが、出す前の確認は残っている** */
  let bad = 0
  let made = 0
  for (const f of SWAP_FRAMES) {
    const qs = swapQuestions({ frame: f.id })
    made += qs.length
    for (const q of qs) {
      if (frameFormOf(q.ex) !== shiftTargetOf(q.form)) bad += 1
      if (!q.ex.toLowerCase().includes(String(q.phrase).toLowerCase())) bad += 1
    }
  }
  ok(bad === 0, `出した ${made} 問が、どれも狙った型に当たり、入れた言葉も入っている`,
    `だめだったもの ${bad}`)
  ok(/frameFormOf\(en\) !== want/.test(flib),
    '確かめてから出している(安全弁の1行が在る)')

  /* **落とした組み合わせが多すぎないか。** 決まりを1つ変えて
     大半が落ちても、上の見張りは緑のままである(**0問でも緑**)。
     **いちばん危ない形を、検証の中に必ず置く**(CLAUDE.md)。
     **席ごとに肉が違う**ので、骨ごとに数えて足す */
  const full = SWAP_FRAMES.reduce((n, f) => n + swapFillers(f).length, 0)
  ok(made > full * 0.9, `落とした組み合わせは ${full - made} 通りだけ(全 ${full})`)
  ok(NOUN_PHRASES.length > 0, '名詞句の部品表が空でない')

  /* **骨をえらばなければ、先頭の骨**(行き止まりを作らない) */
  ok(swapQuestions().length === swapQuestions({ frame: SWAP_FRAMES[0].id }).length,
    '骨をえらばなければ、先頭の骨で出る')
  ok(swapQuestions({ frame: 'そんな骨は無い' }).length === swapQuestions().length,
    '知らない骨を渡しても落ちず、先頭の骨で出る')

  /* **問の形。** お題に英語が出ていたら、写すだけの練習になる */
  const q0 = swapQuestions({ frame: 'about' })[0]
  ok(!/[A-Za-z]{3,}/.test(q0.ja), 'お題に英語が出ていない(写すだけにならない)')
  ok(q0.base.includes(SWAP_BLANK), '骨に、入れる場所が残っている')
  ok(q0.qid.startsWith(`${SWAP_GROUP}:`), '問の id の頭が、書き写さずに付いている')
  ok(new Set(swapQuestions({ frame: 'about' }).map((x) => x.qid)).size
     === swapQuestions({ frame: 'about' }).length, '問の id が重なっていない')
}

/* ────────────────────────────────────────────────────────────
   ⑦ Quick Response の行にしているか(`frameQr.js`)
   ──────────────────────────────────────────────────────────── */
head('Quick Response の行にしているか')
{
  /* **中身は2つ。並べ替えない**(利用者の指定「『日本語→英語』と『言い換え』を
     コンテンツとして追加します」)。**id も名前も、ここでしか持たない** */
  ok(FRAME_PARTS.map((p) => p.id).join('/') === 'swap/say',
    '中身は2つ(日本語 → 英語 → 言い換え の順)', FRAME_PARTS.map((p) => p.id).join('/'))
  ok(FIRST_FRAME_PART === FRAME_PARTS[0].id, 'いちばんやさしい中身は、先頭から引いている')
  ok(FRAME_PARTS.every((p) => p.label && p.lead), 'どの中身にも、名前と1行の説明がある')
  ok(framePartOf('そんな中身は無い') === null, '知らない中身は null(当てずっぽうで返さない)')

  const counts = frameQrCounts()
  ok(counts.swap > 0 && counts.say > 0, `どちらの中身にも問がある(${counts.swap} / ${counts.say})`)
  /* **知らない id では、1問も出さない。**「無ければ素通り」を作らない ——
     ここを「先頭に落とす」にすると、選んでいないものが黙って出る */
  ok(frameQuestions('そんな中身は無い').length === 0, '知らない中身では、1問も出さない')
  ok(frameQuestions('swap').length === counts.swap, '日本語 → 英語の数が、数え上げと合う')

  /* **言い換えは、型を問に書く。** 書かないと同じ日本語が二度出て、
     どちらの答えか分からない。**「出る」と「出ない」の両方を見る** */
  const sayQ = frameQuestions('say')
  ok(sayQ.every((q) => /の型で/.test(q.ja)), '言い換えの問には、どの型で言うかが書いてある')
  ok(new Set(sayQ.map((q) => q.ja)).size === sayQ.length,
    '言い換えの問は、同じ日本語が二度出ない',
    `${new Set(sayQ.map((q) => q.ja)).size} / ${sayQ.length}`)
  /* **型を書かなければ、本当に重なるのか。** 重ならないなら、
     この見張りは何も守っていない(**赤チェックの代わり**) */
  ok(new Set(shiftQuestions().map((q) => q.ja)).size < sayQ.length,
    '型を書かなければ、日本語は重なる(だから書いている)')
  const swapQ = frameQuestions('swap')
  ok(!swapQ.some((q) => /の型で/.test(q.ja)),
    '日本語 → 英語のほうには、型を書き足していない(型は1つに決まっている)')

  /* **行の形が `nativeFlowRows()` と1文字も違わない。**
     ずれると `QrReview.jsx` が書き分けを持つ(数え方が2通りになる) */
  const nf = Object.keys(nativeFlowRows([], { today: '2026-01-01' })[0]).sort().join(',')
  const fr = Object.keys(frameQrRows([], { today: '2026-01-01' })[0]).sort().join(',')
  ok(nf === fr, '行の欄が、Native Flow と1文字も違わない', `\n    NF: ${nf}\n    型: ${fr}`)

  const rows = frameQrRows([], { today: '2026-01-01', part: 'say' })
  ok(rows.length === counts.say, '言い換えの行の数が、問の数と合う')
  ok(rows.every((r) => r.en_norm && r.en && r.ja), 'どの行にも、鍵と英文と日本語がある')
  ok(rows.every((r) => r.status === 'unknown' && r.box === 0),
    '覚え具合が無ければ「まだ」から始まる')
  ok(rows.every((r) => r.due_on === '2026-01-01'), '覚え具合が無ければ、今日から出る')
  ok(rows.every((r) => r.material_title === framePartTitle('say')),
    '紙と絞り込みに出す名前が、中身ごとに付いている', rows[0]?.material_title)
  ok(framePartTitle('swap') !== framePartTitle('say'), '中身ごとに、別の名前になる')
  /* **同じ英文が二度出ない**(CLAUDE.md・`dedup_test.sql` と同じ考え方) */
  const allRows = [...frameQrRows([], { today: '', part: 'swap' }), ...rows]
  const dup = allRows.length - new Set(allRows.map((r) => r.en_norm)).size
  ok(new Set(rows.map((r) => r.en_norm)).size === rows.length, '同じ英文が二度出ない')
  ok(/used\.has\(key\)/.test(code('src/lib/frameQr.js')),
    '重なりを落とす1行が在る(部品を足した日に効く)', `いまの重なり ${dup}`)

  /* **覚え具合が付くか。** 付かなければ、3枚の札がいつも「まだ」になる */
  const seen = [{ en_norm: rows[0].en_norm, status: 'known', box: 6, due_on: '2026-12-31' }]
  const withSeen = frameQrRows(seen, { today: '2026-01-01', part: 'say' })
  ok(withSeen[0].status === 'known' && withSeen[0].box === 6,
    '覚え具合があれば、そのまま乗る', `${withSeen[0].status} / ${withSeen[0].box}`)
  ok(withSeen.slice(1).every((r) => r.status === 'unknown'), 'ほかの行は動かない')
  /* **空・null でも落ちない** */
  ok(frameQrRows(null, {}).length > 0, '覚え具合が null でも、問は返る')
  ok(frameQrRows([], { part: 'そんな中身は無い' }).length === 0, '知らない中身では、行も0')

  ok(FRAME_PART_KEY.startsWith('eas.'), '覚えておく鍵の名前が、ほかとそろっている')
}

/* ────────────────────────────────────────────────────────────
   ⑧ 画面 —— 冊として通っているか。マイクが消えているか
   ──────────────────────────────────────────────────────────── */
head('Quick Response の冊として通っているか')
{
  ok(!existsSync(ROOT + 'src/components/FrameShift.jsx'),
    '型シフトの画面そのものが無い(廃止した)')
  ok(!existsSync(ROOT + 'src/data/frameTraining.js'),
    '型シフトの段・やることの一覧も無い(あの画面の持ちもの)')
  ok(!/fshift/.test(raw('src/styles.css')), '型シフトの見た目の指定も残っていない')

  const qr = code('src/components/QrReview.jsx')
  ok(!/FrameShift/.test(qr), 'Quick Response が、専用の画面を描いていない')
  ok(/loadFrameQr\(/.test(qr), 'Quick Response が、66 の型を冊として読んでいる')
  ok(/<QrCard/.test(qr), '1問ぶんは、ふだんの Quick Response と同じ部品')
  /* **書き分けを持たない。** 読むところ以外で `frameBook` を見ていたら、
     66 の型だけ別の道を通っていることになる */
  const frameIfs = (qr.match(/frameBook/g) ?? []).length
  ok(frameIfs <= 5, `画面が 66 の型を見分けている箇所が ${frameIfs} 個だけ`, String(frameIfs))
  ok(/<FrameParts/.test(qr), '中身(日本語 → 英語 / 言い換え)をえらぶ欄がある')
  /* **名前を画面に書き写さない。** 書き写すと、中身を足した日に片方だけ古くなる */
  ok(!/'日本語 → 英語'|'言い換え'/.test(qr), '中身の名前を、画面に書き写していない')
  ok(/FRAME_PARTS/.test(qr), '中身の一覧は frameQr.js から引いている')

  /* **マイクも打ち込む欄も無い**(2026-09 利用者の指定
     「マイクで『話す』の機能は入りません。削除です。全ての型で削除してください」)。
     **「出る」と「出ない」の両方を見る** —— `QrCard` は
     そもそも一度も持っていないので、持っていないことを名指しで見る */
  const card = code('src/components/QrCard.jsx')
  for (const [name, src] of [['Quick Response の画面', qr], ['1問ぶんの部品', card]]) {
    ok(!/recognition|SpeechRecognition|MicIcon|話す/.test(src), `${name}にマイクが無い`)
    ok(!/<textarea|type="text"/.test(src), `${name}に打ち込む欄が無い`)
  }
  /* **逆も見る。** 教材の中の練習のマイクまで消していないか
     (**言われた場所だけを直す**・CLAUDE.md)。
     消えたのは 66 の型のマイクだけで、**書き取り・音読・文ごとの練習は
     これまでどおり**である */
  ok(existsSync(ROOT + 'src/lib/recognition.js'), 'マイクの作法そのものは残っている')
  const stillMic = ['StepDictation', 'StepSentence', 'PassagePractice']
    .filter((n) => /lib\/recognition/.test(code(`src/components/${n}.jsx`)))
  ok(stillMic.length === 3, '教材の中の練習のマイクは、これまでどおり在る',
    stillMic.join(' / '))

  const app = code('src/App.jsx')
  ok(!/FrameShift/.test(app), 'App.jsx から型シフトの名残が消えている')
  ok(!/id: 'shift'/.test(app), 'メニューに行き先を残していない')

  /* **骨組み(`__screens.jsx`)は、本物と1文字も違えない**(CLAUDE.md)。
     すき間の見張り(`npm run test:bar`)がここを描く */
  const sc = code('src/__screens.jsx')
  ok(!/FrameShift/.test(sc), '骨組みからも、廃止した画面が消えている')
  ok(/<FrameParts/.test(sc), '骨組みが、本物の部品をそのまま描いている')
  ok(/frameQrCounts\(\)/.test(sc), '骨組みも、問数を本物から数えている(書き写さない)')
  const bar = code('scripts/test-bar.mjs')
  ok(/\['shift', ''\]/.test(bar), 'すき間の見張りに shift が入っている')
}

console.log(ng === 0
  ? '\n✅ 66 の型(Quick Response の冊)は、すべて意図どおりです'
  : `\n❌ ${ng} 件`)
process.exit(ng === 0 ? 0 : 1)
