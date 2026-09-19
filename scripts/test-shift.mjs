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
import { FRAME_GROUPS, FRAME_SECTIONS, frameGroupCount } from '../src/data/sentenceFrames.js'
import { SAME_SHAPE, frameFormOf } from '../src/lib/frameMatch.js'
import {
  SWAP_GROUP, sayQuestions, shiftQuestions, shiftTargetOf, swapFillers, swapQuestions,
} from '../src/lib/frameShift.js'
import { SAY_BLANK, SAY_BUNDLES, SAY_LISTS } from '../src/data/frameSay.js'
import { SWAP_BLANK, SWAP_FRAMES, SWAP_SLOTS, swapFrameOf } from '../src/data/phraseSwap.js'
import { SUBJ_KINDS, SWAP_CLAUSES, SWAP_VERBS } from '../src/data/swapParts.js'
import { NOUN_PHRASES } from '../src/data/nounPhrases.js'
import { nativeFlowRows } from '../src/data/nativeFlow.js'
import {
  FIRST_FRAME_PART, FRAME_BOOK_LABEL, FRAME_FORM_KEY, FRAME_PARTS,
  FRAME_PART_KEY, QR_HINT_KEY, frameFormFilter, frameFormOk, frameGroupValue,
  frameHintOf, framePartOf, framePartTitle, frameQrCounts, frameQrForms,
  frameQrGroups, frameQrRows, frameQuestions,
} from '../src/lib/frameQr.js'

const ROOT = new URL('..', import.meta.url).pathname
/** **コメントを落としてから数える。** 説明文にも同じ語が出てくる(CLAUDE.md) */
const code = (p) => readFileSync(ROOT + p, 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|[^:])\/\/.*$/gm, '$1 ')
const raw = (p) => readFileSync(ROOT + p, 'utf8')
/** CSS も**コメントを落としてから**数える。説明文に同じ名前が出てくる(CLAUDE.md) */
const css = (p) => raw(p).replace(/\/\*[\s\S]*?\*\//g, ' ')

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
  /* **肉の数が、そのまま問の数になる**(2026-09 利用者の指定
     「型毎の問題数を大幅に増やしてください」)。
     部品を減らすと**その席を持つ骨すべてが痩せる**ので、ここで下限を持つ。
     **床は、いまの数より下に置く** —— 1つ足すたびに赤くなっては困る */
  const kinds = [...SUBJ_KINDS.values()]
  ok(kinds.every((k) => k.length >= 20), 'どの性格の主語も 20 以上ある',
    kinds.map((k) => k.length).join(' / '))
  ok(SWAP_VERBS.length >= 40, `動詞が 40 以上ある(${SWAP_VERBS.length})`)
  ok(SWAP_CLAUSES.length >= 30, `短い文が 30 以上ある(${SWAP_CLAUSES.length})`)
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

  /* **型は、問の文に混ぜない**(2026-09 利用者の指定でヒントに移した)。
     混ぜると**聞き流しが読み上げ**(`radioJaOf()` は `ja` を読む)、
     **紙にもそのまま刷られる**(`qrSheetPairs()` も `ja` を使う)。
     **「出る」と「出ない」の両方を見る** */
  const sayQ = frameQuestions('say')
  const swapQ = frameQuestions('swap')
  ok(![...sayQ, ...swapQ].some((q) => /の型で|の形/.test(q.ja)),
    '問の日本語に、型を混ぜていない(聞き流しも紙も読むところ)')
  ok([...sayQ, ...swapQ].every((q) => FORMS.includes(q.form)),
    'どの問も、型を持っている(66 型の一覧にあるもの)')
  /* **型を出さなければ、本当に見分けられないのか。** 見分けられるなら、
     ヒントも絞り込みも要らないことになる(**赤チェックの代わり**) */
  ok(new Set(sayQ.map((q) => q.ja)).size < sayQ.length,
    '言い換えは、同じ日本語が2度以上出る(だからヒントと絞り込みが要る)',
    `別の日本語 ${new Set(sayQ.map((q) => q.ja)).size} / 問 ${sayQ.length}`)
  /* **手で書いた 37 のお題を、1つも落としていない**(2026-09)。
     束(`frameSay.js`)で数を増やしたときに、**あちらを消して
     置き換えていないか**を見る —— 場面のある本物の言い回しは、
     機械で組んだ文では代われない(**勝手に消さない**・CLAUDE.md) */
  const sayJa = new Set(sayQ.map((q) => q.ja))
  const lostJa = shiftQuestions().filter((q) => !sayJa.has(q.ja)).map((q) => q.qid)
  ok(lostJa.length === 0, '手で書いたお題の日本語が、1つも落ちていない',
    `\n    ${lostJa.slice(0, 5).join(' / ')}`)

  /* **行の形。** `nativeFlowRows()` の欄を**1つも欠かさない** ——
     欠けると `QrReview.jsx` が書き分けを持つ(数え方が2通りになる)。
     **足したものは名指しで書く** —— 黙って増やすと、
     「同じ形」と言いながら中身が離れていく */
  const nfKeys = Object.keys(nativeFlowRows([], { today: '2026-01-01' })[0])
  const frKeys = Object.keys(frameQrRows([], { today: '2026-01-01' })[0])
  const lack = nfKeys.filter((k) => !frKeys.includes(k))
  ok(lack.length === 0, 'Native Flow の欄を、1つも欠かしていない', `\n    足りない: ${lack.join(' / ')}`)
  const extra = frKeys.filter((k) => !nfKeys.includes(k))
  /* **足したものは、2つとも名指しで書く**(黙って増やさない)。
     `hint` … ヒントに出す型
     `askEn` … 言い換えの出題に出す素の英文(第5.198節)。
     **並びも決め打ちにしない** —— 欄の書き順を変えただけで
     赤くなるのは、この見張りの役目ではない */
  ok([...extra].sort().join(',') === 'askEn,hint',
    '足したのは `hint` と `askEn` の2つだけ', extra.join(',') || '(無し)')

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
  ok(new Set([FRAME_PART_KEY, FRAME_FORM_KEY, QR_HINT_KEY]).size === 3,
    '覚えておく鍵が、3つとも別のもの')
}

/* ────────────────────────────────────────────────────────────
   ⑦-2 言い換えの束(2026-09 利用者の指定「型毎の問題数を大幅に増やして」)
   ──────────────────────────────────────────────────────────── */
head('言い換えの束')
{
  /* **束の型は、66 型の一覧にあるか。** 無ければ「型が2つある」ことになる */
  const forms = SAY_BUNDLES.flatMap((b) => (b.says ?? []).map((x) => x.form))
  const stray = [...new Set(forms)].filter((f) => !FORMS.includes(f))
  ok(stray.length === 0, '束の型が、66 型の一覧にある', `\n    ${stray.join(' / ')}`)
  ok(SAY_BUNDLES.every((b) => b.id && b.ja && (b.says ?? []).length),
    'どの束にも、id と日本語と型がある')
  ok(new Set(SAY_BUNDLES.map((b) => b.id)).size === SAY_BUNDLES.length,
    '束の id が重なっていない')
  ok(SAY_BUNDLES.every((b) => SAY_LISTS.includes(b.list)),
    '肉の出どころが、一覧にあるものだけ')
  ok(SAY_BUNDLES.filter((b) => b.list === 'own').every((b) => (b.own ?? []).length),
    '自前の肉を使う束は、肉を持っている')
  /* **日本語にも英文にも、入れる場所が1つずつあるか** */
  const noBlank = SAY_BUNDLES.filter(
    (b) => !b.ja.includes(SAY_BLANK) || (b.says ?? []).some((x) => !x.en.includes(SAY_BLANK)),
  ).map((b) => b.id)
  ok(noBlank.length === 0, 'どの束にも、肉を入れる場所がある', `\n    ${noBlank.join(' / ')}`)

  const qs = sayQuestions()
  ok(qs.length > 0, `束から ${qs.length} 問できている`)
  /* **出した問は、どれも狙った型に当たるか。** ここが安全弁である */
  const bad = qs.filter((q) => frameFormOf(q.ex) !== shiftTargetOf(q.form))
  ok(bad.length === 0, '束から出した問が、どれも狙った型に当たる',
    `\n    ${bad.slice(0, 4).map((q) => q.form + ' | ' + q.ex).join('\n    ')}`)
  /* **落とした組み合わせが多すぎないか。** 決まりを1つ変えて大半が落ちても、
     上の見張りは緑のままである(**0問でも緑**・CLAUDE.md) */
  const plan = SAY_BUNDLES.reduce((n, b) => {
    const meat = b.list === 'own' ? (b.own ?? []).length
      : b.list === 'clause' ? SWAP_CLAUSES.length
      : b.list === 'noun' ? NOUN_PHRASES.length : SWAP_VERBS.length
    return n + meat * (b.says ?? []).length
  }, 0)
  ok(qs.length > plan * 0.7, `落とした組み合わせは ${plan - qs.length} 通り(全 ${plan})`)

  /* **文は大文字で始まる。** `___ is important.` のように肉が頭に来る骨が
     あるので、そのままだと `working from home is important.` になる。
     **名詞のかたまりの型(関係詞・同格など)は小文字で正しい** ——
     だから「文の形のものだけ」を見る */
  const lower = qs.filter((q) => /[.?]$/.test(q.ex) && /^[a-z]/.test(q.ex))
  ok(lower.length === 0, '文の形の問は、大文字で始まる',
    `\n    ${lower.slice(0, 4).map((q) => q.ex).join('\n    ')}`)
  /* **日本語に英語を混ぜない**(写すだけの練習になる) */
  const enJa = qs.filter((q) => /[A-Za-z]{3,}/.test(q.ja)).map((q) => q.qid)
  ok(enJa.length === 0, 'お題に英語が出ていない', `\n    ${enJa.slice(0, 3).join(' / ')}`)
  ok(new Set(qs.map((q) => q.qid)).size === qs.length, '問の id が重なっていない')

  /* **同じ内容を、別の型で。** それが言い換えである ——
     型が1つしかない束ばかりなら、それは「日本語 → 英語」と同じものになる。
     **「有る」と「無い」の両方を見る**(1つだけの束も、わざと置いてある) */
  const many = SAY_BUNDLES.filter((b) => (b.says ?? []).length >= 2)
  ok(many.length > SAY_BUNDLES.length / 2,
    `型が2つ以上ある束が ${many.length} / ${SAY_BUNDLES.length}`)
}

/* ────────────────────────────────────────────────────────────
   ⑦-3 型ごとの問数(2026-09 利用者の指定「大幅に増やしてください」)
   ──────────────────────────────────────────────────────────── */
head('型ごとの問数')
{
  /**
   * どの型にも、これだけは要る。**下回ったら赤くする。**
   *
   * **床は中身ごとに違う。** 日本語 → 英語は骨1本に肉を掛けるので厚く、
   * 言い換えは**相方の無い型**(`名詞化` など)が薄い ——
   * そこへ同じ床を当てると、**厚いほうの痩せを見逃す。**
   */
  const FLOOR = { swap: 16, say: 8 }
  for (const part of FRAME_PARTS.map((p) => p.id)) {
    const forms = frameQrForms(part)
    const thin = forms.filter((f) => f.n < FLOOR[part])
    ok(thin.length === 0, `${part} … どの型にも ${FLOOR[part]} 問以上ある`,
      `\n    ${thin.map((f) => `${f.form} ${f.n}問`).join(' / ')}`)
    /* **数え上げと、実際に出る行が合うか。**
       別々に数えると、**札には 52 問と出て 51 問しか出てこない**
       (2026-09 に踏んだ)。**数え方を2通り持たない**(CLAUDE.md) */
    const rows = frameQrRows([], { today: '', part })
    ok(forms.reduce((n, f) => n + f.n, 0) === rows.length,
      `${part} … 札の数を足すと、出てくる行の数と合う`,
      `${forms.reduce((n, f) => n + f.n, 0)} / ${rows.length}`)
    const one = forms[0]
    ok(frameQrRows([], { today: '', part, form: one.form }).length === one.n,
      `${part} … 1つの型で絞っても、札の数と合う`)
  }
}

/* ────────────────────────────────────────────────────────────
   ⑧ ヒント(2026-09 利用者の指定「ヒントは『-の形』」)
   ──────────────────────────────────────────────────────────── */
head('ヒント')
{
  /* **ヒントに出すのは、型の名前そのもの**(2026-09 利用者の指定
     「青で囲まれた『〜の型』をヒントに」)。文言も見た目も `QrCard` が持ち、
     **答えを開いたあとに出る札とまったく同じもの**である */
  ok(frameHintOf('S allows 人 to do') === 'S allows 人 to do',
    'ヒントに出すのは、型の名前そのもの', frameHintOf('S allows 人 to do'))
  /* **型が分からなければ、当てずっぽうで出さない。**
     **「出る」と「出ない」の両方を見る**(CLAUDE.md) */
  ok(frameHintOf(null) === null && frameHintOf('') === null,
    '型が分からない行には、ヒントを作らない')

  for (const part of FRAME_PARTS.map((p) => p.id)) {
    const rows = frameQrRows([], { today: '', part })
    ok(rows.every((r) => r.hint), `${part} … どの行にもヒントがある`)
    /* **型の名前が、そのままヒントに入っているか。**
       見分け直さず、問が持っている型をそのまま渡している */
    ok(rows.every((r) => FORMS.includes(r.hint)),
      `${part} … ヒントが、66 型の一覧にある名前そのもの`)
  }
  /* **逆も見る。** ふだんの Quick Response と Native Flow は
     ヒントを持たない —— だからあちらにボタンが出ない */
  ok(nativeFlowRows([], { today: '' }).every((r) => r.hint === undefined),
    'Native Flow の行は、ヒントを持たない(ボタンごと出ない)')

  const qr = code('src/components/QrReview.jsx')
  const card = code('src/components/QrCard.jsx')
  /* **押した状態は、呼ぶ側が持つ**(2026-09 利用者の指定
     「一度ボタンを押したら問題を跨いでも、もう一度押すまで出続ける」)。
     カードは問ごとに描き直されるので、**あちらに持つと1問で消える** */
  ok(!/useState\([\s\S]{0,20}hintOn/.test(card), 'カードは、押した状態を自分で持たない')
  ok(/hintOn/.test(card) && /onHint/.test(card), 'カードは、押した状態を受け取って描くだけ')
  ok(/hintOn=\{hintOn\}/.test(qr) && /onHint=\{pickHint\}/.test(qr),
    '画面が、押した状態を持ってカードへ渡している')
  ok(new RegExp(`localStorage\\.setItem\\(QR_HINT_KEY`).test(qr),
    '押したままにできる(端末に覚える)')
  /* **型の名前を、画面に書き写していない** */
  ok(!/S allows 人 to do/.test(qr) && !/S allows 人 to do/.test(card),
    '型の名前を、画面に書き写していない')
  /* **ヒントを持たない問には、ボタンを出さない**(効かない操作を見せない) */
  ok(/onHint && pair\.hint/.test(card), 'ヒントを持たない問には、ボタンを出さない')

  /* **ヒントと、答えの下の型は、同じ札**(2026-09 利用者の指定
     「青で囲まれた『〜の型』をヒントに」)。
     **同じことを2つの見た目で見せない**(CLAUDE.md)ので、
     部品も見た目の指定も1つにまとめてある。
     **「有る」と「無い」の両方を見る** —— 別の見た目を作り直したら赤くなる */
  ok(/function FrameTag/.test(card), '型の札は、部品1つにまとめてある')
  ok((card.match(/<FrameTag/g) ?? []).length === 2,
    'その札を、ヒントと答えの下の2か所で使っている',
    String((card.match(/<FrameTag/g) ?? []).length))
  ok(!/qr-hint/.test(card) && !/\.qr-hint\b/.test(css('src/styles.css')),
    'ヒント専用の見た目を、別に持っていない')
  ok((card.match(/qr-frame"/g) ?? []).length === 1,
    '札の見た目の指定も、1か所だけ')
}

/* ────────────────────────────────────────────────────────────
   ⑨ 型で絞る(2026-09 利用者の指定「絞り込めるようにして欲しい」)
   ──────────────────────────────────────────────────────────── */
head('型で絞る')
{
  for (const part of FRAME_PARTS.map((p) => p.id)) {
    const forms = frameQrForms(part)
    /* **並びは `sentenceFrames.js` のまま。** 問を数えた順に並べると、
       書いた順になる(**一覧を勝手に並べ替えない**) */
    const order = forms.map((f) => FORMS.indexOf(f.form))
    ok(order.every((n, i) => i === 0 || n > order[i - 1]),
      `${part} … 型の並びが、66 型の一覧のまま`)
    /* **1問も無い型は出さない**(開いた先が空になる・行き止まり) */
    ok(forms.every((f) => f.n > 0), `${part} … 1問も無い型は出さない`)
    /* **数を足すと、問の数と合う**(黙って落としていない) */
    ok(forms.reduce((n, f) => n + f.n, 0) === frameQuestions(part).length,
      `${part} … 型ごとの数を足すと、問の数と合う`)
    /* **組の名前も書き写していない**(`sentenceFrames.js` から引く) */
    ok(forms.every((f) => f.group), `${part} … どの型にも、組の名前が付いている`)
    /* **絞ると、その型だけになる** */
    const one = forms[0]
    const rows = frameQrRows([], { today: '', part, form: one.form })
    ok(rows.length === one.n, `${part} … 絞ると、その型の数だけ出る`,
      `${rows.length} / ${one.n}`)
    ok(rows.every((r) => r.hint === frameHintOf(one.form)),
      `${part} … 絞ったあと、どの行もその型`)
    /* **絞らなければ、ぜんぶ**(逆も見る) */
    ok(frameQrRows([], { today: '', part, form: null }).length > rows.length,
      `${part} … 絞らなければ、ぜんぶ出る`)
    /* **知らない型では0問。** 黙って「ぜんぶ」に落とさない ——
       落とすと、選んでいないものが出る(いちばん分かりにくい) */
    ok(frameQrRows([], { today: '', part, form: 'そんな型は無い' }).length === 0,
      `${part} … 知らない型では、1問も出さない`)
  }
  /* **66 型ぜんぶが絞れる**(一覧を勝手に減らさない) */
  ok(frameQrForms('swap').length === FORMS.length,
    `日本語 → 英語は、66 型すべてで絞れる(${frameQrForms('swap').length})`)

  const qr = code('src/components/QrReview.jsx')
  const parts = code('src/components/FrameParts.jsx')
  ok(/frameQrGroups\(/.test(qr), '画面が、絞れる型の一覧を引いている')
  ok(/loadFrameQr\(\{ learnerId, part, form \}\)/.test(qr),
    '型を渡して読み込んでいる(絞ったぶんだけ読む)')
  ok(/nfKey, part, form\]/.test(qr), '型を変えたら読み直す(前の型の問が残らない)')
  ok(/optgroup/.test(parts), '66 本を組ごとにまとめて出している')
  /* **66 本を画面に書き写していない** */
  ok(!/S allows 人 to do/.test(parts) && !/S allows 人 to do/.test(qr),
    '型の名前を、画面に書き写していない')
  /* **やりかけを持ち越さない。** 冊・Unit・中身・型の4つとも。
     出す問が変わる操作は4つある。**ただし、捨て方は2通りである**
     (第5.191節・2026-09 実機で直した)。

       | 何を変えた | どうする |
       |---|---|
       | **冊**(自分の帳 / Native Flow / 型) | `dropRun()` —— 始めからやり直す |
       | **Unit・中身・型**(冊の中で絞った) | `afterNarrow()` —— 組み直すだけ |

     **絞るたびに `dropRun()` を呼ぶと、そのたびに練習が始まり直し、
     本棚のシートごと畳まれて、2つめを選べなかった。**
     しかも `dropRun()` は絞り込み(`filter` / `group`)も消すので、
     **いま絞ったものが、その場で消えていた。**

     **数を書き写さず、4つそろっていることで見る。** */
  const drops = (qr.match(/dropRun\(\)/g) ?? []).length
  const narrows = (qr.match(/^\s+afterNarrow\(\)$/gm) ?? []).length
  ok(drops === 1, '冊を替えたら、始めからやり直す', `dropRun ${drops} か所`)
  ok(narrows === 3, '冊の中で絞ったら、組み直す(始め直さない)', `afterNarrow ${narrows} か所`)
  ok(drops + narrows === 4,
    '冊・Unit・中身・型の4つとも、やりかけを捨てる', String(drops + narrows))
  /* **中身を書き写していない。** 1つ足し忘れると、
     **前の冊の問が次の冊で出続ける**(いちばん分かりにくい壊れ方) */
  ok((qr.match(/setRun\(null\); setPending/g) ?? []).length === 1,
    'やりかけの捨て方は1か所だけ(4か所に書き写していない)')
}

/* ────────────────────────────────────────────────────────────
   ⑩ 系(「〜系ぜんぶ」・第5.177節)
   ──────────────────────────────────────────────────────────── */
head('系(〜系ぜんぶ)')
{
  /* **人に見せる数は、系の数**(2026-09 利用者の指定
     「66の型ですが、実際はもっと少ないはずです。写真のように『させる系』で
     一つと数えた時の数に変えてください」)。

     **数を書き写さない**(CLAUDE.md「値を書き写さない。性質で見る」)——
     見るのは「系のほうが少ない」という**関係**である */
  ok(frameGroupCount() === FRAME_GROUPS.length, '系の数は、系の一覧から数えている')
  ok(frameGroupCount() < FORMS.length,
    `系のほうが、型より少ない(${frameGroupCount()} / ${FORMS.length})`)

  /* **1つも落としていない・並べ替えてもいない**(`.claude/rules/common.md`)。
     系に束ねるときに1本でも落ちると、**その型は永久に出てこない** */
  const flat = FRAME_GROUPS.flatMap((g) => g.forms)
  ok(flat.length === FORMS.length && flat.every((f, i) => f === FORMS[i]),
    '系をつなぐと、型の一覧とぴったり同じ(落とさない・並べ替えない)',
    `${flat.length} / ${FORMS.length}`)
  ok(new Set(FRAME_GROUPS.map((g) => g.key)).size === FRAME_GROUPS.length,
    '系の鍵が、1つも重なっていない')

  /* **短い呼び名(`kei`)は、組ごとに1つだけ。**
     無いと「系ぜんぶ」という名無しの選択肢になり、
     重なると**どちらを選んだのか分からなくなる** */
  const noKei = FRAME_GROUPS.filter((g) => !g.kei)
  ok(noKei.length === 0, 'どの系にも、短い呼び名がある',
    noKei.map((g) => g.key).join(' / '))
  ok(new Set(FRAME_GROUPS.map((g) => g.kei)).size === FRAME_GROUPS.length,
    '短い呼び名が、1つも重なっていない')

  /* **「〜系ぜんぶ」の値と、型の名前が重ならない。**
     同じ欄に入れるので、重なると**別のものが出る**(いちばん怖い壊れ方) */
  ok(FRAME_GROUPS.every((g) => !FORMS.includes(frameGroupValue(g.key))),
    '「〜系ぜんぶ」の値は、どの型の名前とも重ならない')
  ok(FORMS.every((f) => {
    const only = frameFormFilter(f)
    return only.length === 1 && only[0] === f
  }), '型ひとつの値は、そのまま1本に直る')
  ok(frameFormFilter(null) === null && frameFormFilter('') === null,
    '空なら「ぜんぶ」(絞らない)')

  for (const part of FRAME_PARTS.map((p) => p.id)) {
    const groups = frameQrGroups(part)
    ok(groups.length === frameGroupCount(),
      `${part} … 欄に出る系の数が、系の数と同じ`,
      `${groups.length} / ${frameGroupCount()}`)
    /* **並びは `sentenceFrames.js` のまま**(一覧を勝手に並べ替えない) */
    const order = groups.map((g) => FRAME_GROUPS.findIndex((x) => x.key === g.key))
    ok(order.every((n, i) => i === 0 || n > order[i - 1]),
      `${part} … 系の並びが、一覧のまま`)
    /* **数え方を2通り持たない。** 系の数は、中の型を足したものと合う */
    ok(groups.every((g) => g.n === g.rows.reduce((n, f) => n + f.n, 0)),
      `${part} … 系の問数が、中の型を足した数と合う`)
    ok(groups.reduce((n, g) => n + g.n, 0) === frameQuestions(part).length,
      `${part} … 系の数を足すと、問の数と合う`)
    ok(groups.every((g) => g.kei && g.label && g.value),
      `${part} … どの系にも、呼び名と見出しと値がそろっている`)

    /* **絞ると、その系だけが出る。「出る」と「出ない」の両方を見る**
       (CLAUDE.md)—— 片方だけだと、
       **どこにも出さない形・ぜんぶ出す形**に書き換えても緑のまま */
    const g0 = groups[0]
    const rows = frameQrRows([], { today: '', part, form: g0.value })
    ok(rows.length === g0.n, `${part} … ${g0.kei}系ぜんぶで絞ると、その数だけ出る`,
      `${rows.length} / ${g0.n}`)
    const hints = new Set(rows.map((r) => r.hint))
    ok(hints.size === g0.rows.length,
      `${part} … その系の型が、ぜんぶ混ざって出る(1本に絞られていない)`,
      `${hints.size} / ${g0.rows.length}`)
    const inGroup = new Set(g0.rows.map((f) => f.form))
    ok(rows.every((r) => inGroup.has(r.hint)),
      `${part} … よその系の型は、1問も混ざらない`)
    ok(rows.length < frameQrRows([], { today: '', part }).length,
      `${part} … 系で絞ると、絞らないときより少ない`)
    ok(frameQrRows([], { today: '', part, form: g0.rows[0].form }).length < rows.length,
      `${part} … 型ひとつのほうが、系ぜんぶより少ない`)
    /* **知らない系では0問。** 黙って「ぜんぶ」に落とさない
       —— 選んでいないものが出るほうが分かりにくい(型ひとつと同じ作法) */
    ok(frameQrRows([], { today: '', part, form: frameGroupValue('そんな系は無い') }).length === 0,
      `${part} … 知らない系では、1問も出さない`)

    /* **「ぜんぶ」に落とす判断は1か所**(`frameFormOk()`)。
       ここも「答える」と「答えない」の両方を見る */
    ok(frameFormOk(part, g0.value) && frameFormOk(part, g0.rows[0].form),
      `${part} … 系も型も、選べると答える`)
    ok(!frameFormOk(part, frameGroupValue('そんな系は無い'))
      && !frameFormOk(part, 'そんな型は無い')
      && !frameFormOk(part, null) && !frameFormOk(part, ''),
      `${part} … 知らないもの・空には、選べないと答える`)
  }

  /* **冊の名前に出るのは、系の数**(第5.177節)。
     **数を書き写さず、どちらの数が入っているかで見る** */
  ok(FRAME_BOOK_LABEL.includes(String(frameGroupCount())),
    `冊の名前に、系の数が入っている(${FRAME_BOOK_LABEL})`)
  ok(!FRAME_BOOK_LABEL.includes(String(FORMS.length)),
    '冊の名前に、型の数は出てこない')
  ok(framePartTitle('swap').startsWith(FRAME_BOOK_LABEL),
    '紙と絞り込みに出る名前も、同じ冊の名前から作る')
  ok(FRAME_PARTS.every((p) => !/\d+ 型/.test(p.lead)),
    '中身の説明にも、型の数を書き写していない')

  const qr = code('src/components/QrReview.jsx')
  const sc = code('src/__screens.jsx')
  const parts = code('src/components/FrameParts.jsx')
  ok(/FRAME_BOOK_LABEL/.test(qr) && /FRAME_BOOK_LABEL/.test(sc),
    '画面も骨組みも、冊の名前を frameQr.js から引いている')
  /* **書き写していない。** 骨組みだけ古い名前になると、
     **骨組みでは緑・本物では別の名前**になる(CLAUDE.md で何度も転んだ形) */
  ok(!/\d+ の型/.test(qr) && !/\d+ の型/.test(sc),
    '冊の名前を、画面にも骨組みにも書き写していない')
  /* **「〜系ぜんぶ」を、画面が出している** */
  ok(/\{g\.kei\}系ぜんぶ/.test(parts), '欄に「〜系ぜんぶ」が出る')
  ok(/value=\{g\.value\}/.test(parts),
    '「〜系ぜんぶ」の値は、frameQrGroups() が作ったものをそのまま使う')
  ok(!/g\.rows\.reduce/.test(parts), '系ごとの問数を、画面で数え直していない')
  ok(/frameQrGroups\(/.test(sc), '骨組みも、系ごとの一覧を本物から引いている')
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

head('言い換えは、英文を英文に言い換える(第5.198節)')
{
  /* 2026-09 実機・利用者の指摘。

       > 14の型の「言い換え」トレーニングが機能していません。
       > 日本語→英語と同じになってしまっています。「言い換え」は英語が
       > 書いてあり、それを型に則って別の形の英語で言い換えるトレーニングです。

     **そのとおりだった。** 束から作った問は日本語と答えしか持たず、
     画面は日本語を出すしかなかった —— つまり**和文英訳**である。

     見るのは4つ。**どれか1つでも欠けると、また和文英訳に戻る。**
       ①言い換えの問は、**ぜんぶ**素の英文を持つ
       ②素の英文は **66 型のどれでもない**(素の文である)
       ③素の英文と答えは**別の文**である
       ④**日本語 → 英語には、素の英文が無い**(あちらは訳す練習のまま) */
  const say = frameQuestions('say')
  const swap = frameQuestions('swap')

  const 無 = say.filter((q) => !q.askEn)
  ok(say.length > 0 && 無.length === 0,
    `言い換え ${say.length} 問ぜんぶに、素の英文がある`, `無いもの ${無.length} 問`)

  /* **これが、この練習の安全弁である。** 素の文がもう型になっていたら、
     「別の型で言い直す」お題として成り立たない
     (実際、名詞化の素の文が**もう名詞化されていた**) */
  const 型 = say.filter((q) => q.askEn && frameFormOf(q.askEn))
  ok(型.length === 0, '素の英文は、66 型のどれでもない(素の言い方である)',
    型.slice(0, 2).map((q) => `${frameFormOf(q.askEn)} | ${q.askEn}`).join(' / '))

  const 同 = say.filter((q) => q.askEn && normEnLocal(q.askEn) === normEnLocal(q.en))
  ok(同.length === 0, '素の英文と答えは、別の文である', `${同.length} 問`)

  /* **「無い」側も見る。** 片方だけだと、**どの問にも英文を付ける形**に
     書き換えても緑のままになる(CLAUDE.md) */
  const 余 = swap.filter((q) => q.askEn)
  ok(swap.length > 0 && 余.length === 0,
    '日本語 → 英語には、素の英文が無い(あちらは訳す練習のまま)', `${余.length} 問`)

  /* 束の側。**32 の束ぜんぶに素の文の骨がある**(1つ抜けるとその束だけ
     和文英訳に戻り、**画面を開くまで分からない**) */
  const 骨無 = SAY_BUNDLES.filter((b) => !b.base)
  ok(骨無.length === 0, `束 ${SAY_BUNDLES.length} 個ぜんぶに、素の文の骨がある`,
    骨無.map((b) => b.id).join(' / '))
  const 穴 = SAY_BUNDLES.filter((b) => !String(b.base ?? '').includes(SAY_BLANK))
  ok(穴.length === 0, '素の文の骨には、肉を入れる場所がある',
    穴.map((b) => b.id).join(' / '))

  /* 組み上がった文の形。**肉が入っていること・頭が大文字であること** */
  /* **`null` で落ちない形で書く**(CLAUDE.md「0 と `null` を取り違えない」)。
     素の英文が欠けた問が1つでもあると、ここで例外になって
     **この先の見張りが1本も走らなくなる** —— 赤チェックで実際に踏んだ。
     **落ちる見張りは、見張っていないのと同じ**である */
  const 残 = say.filter((q) => String(q.askEn ?? '').includes(SAY_BLANK))
  ok(残.length === 0, '素の英文に、入れ忘れた場所が残っていない', `${残.length} 問`)
  const 小 = say.filter((q) => /^[a-z]/.test(String(q.askEn ?? '')))
  ok(小.length === 0, '素の英文は、大文字で始まる',
    小.slice(0, 2).map((q) => q.askEn).join(' / '))

  /* **`plain`(素の言い方)を使う束**。`the 比較級` と名詞化は、
     肉そのものが型の一部なので、素の文には別の形が要る。
     **その道が切れていないか**を、実際に組んで確かめる */
  const 素の言い方 = SAY_BUNDLES.filter((x) => x.baseUse === 'plain')
  ok(素の言い方.length > 0, '肉そのものが型の一部になる束がある(the 比較級 / 名詞化)')
  for (const b of 素の言い方) {
    const 欠 = (b.own ?? []).filter((x) => !x.plain)
    ok((b.own ?? []).length > 0 && 欠.length === 0,
      `束「${b.id}」の肉には、素の言い方(plain)がそろっている`, `${欠.length} 個`)
  }

  /* **行まで届いているか。** ここで落ちると、
     数は合っているのに**画面だけが日本語のまま**になる */
  const rows = frameQrRows([], { part: 'say' })
  ok(rows.length > 0 && rows.every((r) => r.askEn),
    '溜める行(frameQrRows)まで、素の英文が届く')
  ok(frameQrRows([], { part: 'swap' }).every((r) => !r.askEn),
    '日本語 → 英語の行には、素の英文が付かない')

  /* **1問の形(`qrPairOf`)は、素の node で呼べない**
     —— `qrReviews.js` が Supabase を引き連れている。
     ここは書いてあるかだけを見て、**本当に届くかは
     `npm run test:bar` が本物の画面で確かめる**(第5.198節) */
  const pairSrc = readFileSync(
    new URL('../src/lib/qrReviews.js', import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
  ok(/askEn: row\?\.askEn/.test(pairSrc), '1問の形(qrPairOf)が、素の英文を写している')

  /* **画面が、素の英文を出す道を持っているか。**
     持っていなければ、データだけ増やして**何も変わらない**
     (CLAUDE.md「何も変わらないは、届いていないという意味である」) */
  const card = readFileSync(
    new URL('../src/components/QrCard.jsx', import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  ok(/pair\.askEn/.test(card), '画面が、素の英文を見ている')
  /* **`qr-ask` で探さない。** `qr-ask-ja`(訳)にも同じ字が入っているので、
     出題の場所を消しても当たってしまう(**赤チェックで踏んだ**・CLAUDE.md
     「素の文字列を置き換えるときは、先に数える」)。**閉じ引用符まで見る** */
  ok(/className="qr-ask"/.test(card), '素の英文を出す場所がある(`.qr-ask`)')
  ok(/className="qr-ask-ja"/.test(card), '訳を出す場所がある(`.qr-ask-ja`)')
  ok(/訳を見る/.test(card) && /訳を隠す/.test(card), '訳を出す道がある')
  ok(/答えを見る/.test(card) && /英語を見る/.test(card),
    '言い換えでは「答えを見る」、日本語 → 英語では「英語を見る」と書く')
}

/** 空白のならしだけ。**`textNorm.js` を引き連れない**(素の node で走らせる) */
function normEnLocal(t) {
  return String(t ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

console.log(ng === 0
  ? '\n✅ 型の冊(Quick Response)は、すべて意図どおりです'
  : `\n❌ ${ng} 件`)
process.exit(ng === 0 ? 0 : 1)
