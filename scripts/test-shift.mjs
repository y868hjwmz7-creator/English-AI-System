/**
 * **型シフトの検証**(2026-09 利用者の指定「画期的なトレーニングを作りたいです」)。
 *
 * ============================================================================
 * 【この検証が守るもの】
 *
 *   ① お題の答えが、**狙った型に当たる**こと。
 *      1つでも当たらなければ、ゲストは正しく言えても ○ をもらえない
 *   ② **素の文が、どの型にも当たらない**こと。
 *      素の文がすでにその型なら、「言い直す」練習が成り立たない
 *   ③ 66 型を**1つも落としていない**こと
 *      (**一覧を勝手に減らさない**・`.claude/rules/common.md`)
 *   ④ 型の名前が `sentenceFrames.js` と**1文字も違わない**こと。
 *      違うと「型が2つある」ことになり、どちらが本物か分からなくなる
 *   ⑤ 判定の**4つの道が全部出る**こと。
 *      `ok` しか出ない形・`unsure` しか出ない形に書き換えても、
 *      片方しか見ていなければ緑のままになる(CLAUDE.md)
 *   ⑥ **画面が判定を書き写していない**こと。
 *      `frameMatch` を直に触っていたら、置く場所の数だけ食い違う
 *
 * 【いちばん危ない形を、検証の中に必ず置く】(CLAUDE.md)
 *
 *   空の文字列・知らない型・`SAME_SHAPE` の組・素の文そのもの・
 *   **0問になる絞り込み**。
 *   「無ければ素通り」する形だけを並べると、壊しても緑のままになる。
 *
 * 【値を書き写さない。性質で見る】(CLAUDE.md)
 *
 *   「66 問ある」と書かない。**お題を1つ足した日に赤くなる**からである。
 *   見るのは「型の数と、覆った型の数が同じか」という**関係**のほう。
 * ============================================================================
 */
import { readFileSync } from 'node:fs'
import { FRAME_SHIFTS, SHIFT_SCENES, shiftCount } from '../src/data/frameShift.js'
import { FRAME_SECTIONS } from '../src/data/sentenceFrames.js'
import { SAME_SHAPE, frameFormOf } from '../src/lib/frameMatch.js'
import {
  SHIFT_EMPTY, SHIFT_NOPHRASE, SHIFT_OK, SHIFT_OTHER, SHIFT_UNSURE, SWAP_GROUP,
  judgeShift, shiftQuestions, shiftSay, shiftSceneOf, shiftMap,
  shiftTargetOf, shiftTrainings, swapFillers, swapFrames, swapQuestions,
} from '../src/lib/frameShift.js'
import { SWAP_BLANK, SWAP_FRAMES, SWAP_SLOTS, swapFrameOf } from '../src/data/phraseSwap.js'
import { SUBJ_KINDS } from '../src/data/swapParts.js'
import { NOUN_PHRASES } from '../src/data/nounPhrases.js'
import {
  QUIZ_CHOICES, QUIZ_GROUP, QUIZ_MAX_PER_FORM,
  judgeQuiz, quizGroups, quizQuestions, quizTraining,
} from '../src/lib/frameQuiz.js'
import { MOVE_OF_GROUP, SHIFT_MOVES, moveOfGroup } from '../src/data/frameTraining.js'

const ROOT = new URL('..', import.meta.url).pathname
/** **コメントを落としてから数える。** 説明文にも同じ語が出てくる(CLAUDE.md) */
const code = (p) => readFileSync(ROOT + p, 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|[^:])\/\/.*$/gm, '$1 ')

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
  ok(empty.length === 0, 'お題・素の文・言い直す先が、どれも空でない',
    `\n    ${empty.map((t) => t.id).join(' / ')}`)

  /* **実在の名前を入れない**(`speechStyles.js` / `sentenceFrames.js` と同じ決まり)。
     ここでは「よく使われる会社名らしきもの」を機械で当てられないので、
     **数えられることだけ**を見る —— 英文が英字で書かれているか */
  const notEn = shiftQuestions().filter((q) => !/[A-Za-z]/.test(q.ex)).map((q) => q.qid)
  ok(notEn.length === 0, 'お手本が英語で書かれている', `\n    ${notEn.join(' / ')}`)
}

/* ────────────────────────────────────────────────────────────
   ⑤ 判定の4つの道が、全部出るか
      **片方だけ見ると、どこにも ○ を出さない形にしても緑になる**(CLAUDE.md)
   ──────────────────────────────────────────────────────────── */
head('判定の4つの道が、全部出るか')
{
  const target = 'It is X that / who ~'
  const cases = [
    [SHIFT_OK, 'It is the price that worries me.'],
    [SHIFT_OTHER, 'What worries me is the price.'],
    /* **いちばん危ない形。** 素の文は正しい英語だが、型ではない ——
       ここで ✕ を出したら、正しく言えた人に嘘をつくことになる */
    [SHIFT_UNSURE, 'The price worries me.'],
    [SHIFT_EMPTY, ''],
    [SHIFT_EMPTY, '   '],
  ]
  for (const [want, said] of cases) {
    const got = judgeShift(said, target).verdict
    ok(got === want, `「${said || '(空)'}」 → ${want}`, `いま ${got}`)
  }
  /* **4つが全部ちがう文字列であること。** 同じにすると、上の5件は
     全部通るのに、画面では何も区別できなくなる */
  ok(new Set([SHIFT_OK, SHIFT_OTHER, SHIFT_UNSURE, SHIFT_EMPTY]).size === 4,
    '4つの判定が、それぞれ別のもの')

  /* **知らない型を渡しても落ちない**(既定は「できない」側) */
  ok(judgeShift('It is the price that worries me.', 'そんな型は無い').verdict === SHIFT_OTHER,
    '知らない型を渡しても落ちず、○ にもしない')
  ok(judgeShift(null, null).verdict === SHIFT_EMPTY, 'null を渡しても落ちない')
}

/* ────────────────────────────────────────────────────────────
   ⑥ `SAME_SHAPE`(見分けられないと宣言してある組)を吸収しているか
      **画面にこの事情を持ち込まない**
   ──────────────────────────────────────────────────────────── */
head('SAME_SHAPE を吸収しているか')
{
  ok(SAME_SHAPE.size > 0, '見分けられない組が、宣言されている')
  for (const [from, to] of SAME_SHAPE) {
    ok(shiftTargetOf(from) === to.as, `「${from}」は「${to.as}」として見る`)
    /* **その型を狙ったお題が、ちゃんと ○ になるか。**
       読み替えを外すと、ここだけが赤くなる */
    const q = shiftQuestions().find((x) => x.form === from)
    if (q) ok(judgeShift(q.ex, from).verdict === SHIFT_OK, `「${from}」のお題が ○ になる`)
  }
}

/* ────────────────────────────────────────────────────────────
   ⑦ 見せる言葉(`shiftSay`)
      **成功と失敗を、同じ見た目で終わらせない**(CLAUDE.md)
   ──────────────────────────────────────────────────────────── */
head('見せる言葉')
{
  const t = 'It is X that / who ~'
  const sOk = shiftSay(judgeShift('It is the price that worries me.', t))
  const sOther = shiftSay(judgeShift('What worries me is the price.', t))
  const sUnsure = shiftSay(judgeShift('The price worries me.', t))
  const sEmpty = shiftSay(judgeShift('', t))

  const tones = [sOk.tone, sOther.tone, sUnsure.tone, sEmpty.tone]
  ok(new Set(tones).size === 4, '4つの見せ方が、それぞれ別のもの', tones.join(' / '))
  ok(new Set([sOk.head, sOther.head, sUnsure.head]).size === 3,
    '見出しが、3つとも別の文')
  ok(!sEmpty.head, '何も言っていないときは、何も出さない')

  /* **✕ と書かない。**「間違い」と言い切らない —— `frameMatch` は迷ったら黙る */
  ok(!/間違|誤り|✕|×/.test(sUnsure.head + sUnsure.body),
    '「たしかめられない」を、間違い扱いしていない',
    `${sUnsure.head} / ${sUnsure.body}`)
  ok(!/間違|誤り|✕|×/.test(sOther.head + sOther.body),
    '「ちがう型」を、間違い扱いしていない',
    `${sOther.head} / ${sOther.body}`)
  /* **ちがう型のときは、いま何になっているかを言う**(黙って落とさない) */
  ok(sOther.body.includes('What ~ is …'), 'ちがう型のとき、いまの型の名前を出す', sOther.body)

  /* 画面にそのまま出る文字列に `**` を混ぜない(CLAUDE.md) */
  const texts = [sOk, sOther, sUnsure].flatMap((x) => [x.head, x.body])
  ok(!texts.some((x) => x.includes('**')), '画面に出る文に ** を混ぜていない')
}

/* ────────────────────────────────────────────────────────────
   ⑧ 絞り込みと数え上げ
      **0問になる絞り込みを、検証の中に必ず置く**(CLAUDE.md)
   ──────────────────────────────────────────────────────────── */
head('カテゴリーごとのトレーニング')
{
  const all = shiftQuestions()
  ok(all.length === shiftCount(), '問の数が、お題の数え上げと合う')

  /* **組は `sentenceFrames.js` が持っている。** ここで別の分け方を作らない */
  const groups = []
  for (const sec of FRAME_SECTIONS) for (const g of sec.groups) groups.push(g)

  const all2 = shiftTrainings()
  /* **④ 名詞句を入れ替えるは、組ではない。** いちばん後ろに1枚だけ足してある */
  const ts = all2.filter((t) => t.id !== SWAP_GROUP)
  ok(ts.length === groups.length,
    `型の組のトレーニングが ${ts.length} 本(組の数と同じ)`, `組は ${groups.length}`)
  ok(all2[all2.length - 1].id === SWAP_GROUP,
    '名詞句を入れ替えるは、いちばん後ろ(前へ割り込ませない)')

  /* **並びを変えていないか。** 問を書いた順に並べると、型の一覧と食い違う */
  ok(ts.map((t) => t.id).join(',') === groups.map((g) => g.id).join(','),
    '並びが sentenceFrames.js のまま(並べ替えていない)')

  /* **いちばん効いた見張り。** 組ごとの問の数が、その組の型の数と合うか。
     `what 節`(②)の問が、読み替え先の `What ~ is …`(③)の組へ
     入り込んでいたのを、これで見つけた(2026-09) */
  const wrong = ts
    .filter((t) => t.total !== groups.find((g) => g.id === t.id).rows.length)
    .map((t) => `${t.label} 問${t.total} / 型${groups.find((g) => g.id === t.id).rows.length}`)
  ok(wrong.length === 0, '組ごとの問の数が、その組の型の数と合う',
    `\n    ${wrong.join('\n    ')}`)

  /* **組を足したら「やること」も足す。** 足すまで赤い
     (`check.sql` と移行の関係とまったく同じ作法) */
  const noMove = groups.filter((g) => !moveOfGroup(g.id)).map((g) => g.id)
  ok(noMove.length === 0, '14 の組すべてに「やること」がある', `\n    ${noMove.join(' / ')}`)
  /* **④ 名詞句を入れ替えるだけは、`sentenceFrames.js` の組ではない。**
     組は 14 のままで、練習だけが1つ多い(**名指しで外す**) */
  /* **④ 名詞句を入れ替える と ⑤ 見分ける だけは、`sentenceFrames.js` の
     組ではない。** 組は 14 のままで、練習だけが2つ多い(**名指しで外す**) */
  const NOT_GROUP = [SWAP_GROUP, QUIZ_GROUP]
  const strayMove = [...MOVE_OF_GROUP.keys()]
    .filter((g) => !NOT_GROUP.includes(g) && !groups.some((x) => x.id === g))
  ok(strayMove.length === 0, '知らない組を勝手に増やしていない', `\n    ${strayMove.join(' / ')}`)
  ok(NOT_GROUP.every((g) => MOVE_OF_GROUP.has(g)),
    '組ではない練習にも「やること」がある')
  /* **使われていない「やること」を置き去りにしない**(逆も見る) */
  const usedMoves = new Set([...groups.map((g) => moveOfGroup(g.id)?.id),
    ...NOT_GROUP.map((g) => moveOfGroup(g)?.id)])
  const idle = SHIFT_MOVES.filter((m) => !usedMoves.has(m.id)).map((m) => m.id)
  ok(idle.length === 0, 'どの「やること」も、いずれかの組で使われている',
    `\n    ${idle.join(' / ')}`)

  /* **指示と理由が、どれも空でない。** 空だと画面に何も出ない */
  const thin = SHIFT_MOVES.filter((m) => !m.label?.trim() || !m.ask?.trim() || !m.why?.trim())
  ok(thin.length === 0, 'やることの名前・指示・理由が、どれも空でない',
    `\n    ${thin.map((m) => m.id).join(' / ')}`)
  /* 画面にそのまま出る文字列に ** を混ぜない(CLAUDE.md) */
  ok(!SHIFT_MOVES.some((m) => `${m.label}${m.ask}${m.why}`.includes('**')),
    'やることの文に ** を混ぜていない')

  /* **カードに出す型の名前が、その組のものだけか** */
  const badForms = ts.filter((t) => {
    const mine = new Set(groups.find((g) => g.id === t.id).rows.map((r) => r.form))
    return t.forms.some((f) => !mine.has(f)) || t.forms.length !== t.total
  }).map((t) => t.label)
  ok(badForms.length === 0, 'カードの型の名前が、その組のものと過不足なく合う',
    `\n    ${badForms.join(' / ')}`)

  /* **足して全部になるか。** どこかの組に入っていない問があれば合わない */
  const byGroup = ts.reduce((n, t) => n + shiftQuestions({ group: t.id }).length, 0)
  ok(byGroup === all.length, '組ごとに数えて足すと、全部になる', `${byGroup} / ${all.length}`)

  const byScene = SHIFT_SCENES.reduce((n, x) => n + shiftQuestions({ scene: x.id }).length, 0)
  ok(byScene === all.length, '場面ごとに数えて足すと、全部になる', `${byScene} / ${all.length}`)

  /* **いちばん危ない形。** 知らない組・場面を渡すと 0 問になる ——
     0 のときに「ぜんぶ返す」形になっていたら、ここで赤くなる */
  ok(shiftQuestions({ scene: 'そんな場面は無い' }).length === 0,
    '知らない場面で絞ると 0 問になる(黙ってぜんぶ返さない)')
  ok(shiftQuestions({ group: 'そんな組は無い' }).length === 0,
    '知らない組で絞ると 0 問になる')
  /* **絞らないときは、ぜんぶ返す**(逆も見る) */
  ok(shiftQuestions({ scene: null, group: null }).length === all.length,
    '絞らなければ、ぜんぶ返る')

  ok(shiftSceneOf('そんな場面は無い') === null, '知らない場面は null(当てずっぽうで返さない)')
  ok(shiftSceneOf(SHIFT_SCENES[0].id)?.label === SHIFT_SCENES[0].label, '知っている場面は引ける')
  ok(moveOfGroup('そんな組は無い') === null, '知らない組のやることは null')

  /* **言えた数が、渡した控えのとおりに数えられるか**(0 と null を取り違えない) */
  const one = all[0]
  const withOne = shiftTrainings(new Set([one.qid]))
  ok(withOne.reduce((n, t) => n + t.done, 0) === 1, '言えた問が 1 と数えられる')
  ok(shiftTrainings().every((t) => t.done === 0), '控えを渡さなければ 0 のまま')
  ok(shiftTrainings(null).every((t) => t.done === 0), 'null を渡しても落ちない')
}

head('入れ替えて数をこなす練習')
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
  /* **性格ごとの数がそろっているか。** 1つの性格に偏ると、
     その性格を呼ぶ骨だけ問が多くなる */
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

  ok(SWAP_FRAMES.length >= 5, `骨が ${SWAP_FRAMES.length} 本ある`)
  /* **骨の型は、66 型の一覧にあるか。** 無ければ「型が2つある」ことになる */
  const strayForm = SWAP_FRAMES.filter((f) => !FORMS.includes(f.form)).map((f) => f.form)
  ok(strayForm.length === 0, '骨の型が、66 型の一覧にある', `\n    ${strayForm.join(' / ')}`)
  /* **入れる場所が、骨にも お題にも1つずつあるか** */
  const noBlank = SWAP_FRAMES.filter(
    (f) => !f.en.includes(SWAP_BLANK) || !f.ja.includes(SWAP_BLANK),
  ).map((f) => f.id)
  ok(noBlank.length === 0, '骨にも お題にも、名詞句を入れる場所がある',
    `\n    ${noBlank.join(' / ')}`)
  ok(new Set(SWAP_FRAMES.map((f) => f.id)).size === SWAP_FRAMES.length, '骨の id が重なっていない')
  ok(swapFrameOf('そんな骨は無い') === null, '知らない骨は null(当てずっぽうで返さない)')

  /* **出した問は、どれも機械で確かめられるか。**
     ここが、この練習の安全弁である —— 確かめられないものを出して
     「ちがう型です」と言ったら、正しく言えた人に嘘をつくことになる */
  let bad = 0
  let made = 0
  for (const f of SWAP_FRAMES) {
    const qs = swapQuestions({ frame: f.id })
    made += qs.length
    for (const q of qs) {
      if (judgeShift(q.ex, q.form, { phrase: q.phrase }).verdict !== SHIFT_OK) bad += 1
    }
  }
  ok(bad === 0, `出した ${made} 問が、どれも機械で ○ になる`, `だめだったもの ${bad}`)

  /* **落とした組み合わせが多すぎないか。** 決まりを1つ変えて
     大半が落ちても、上の見張りは緑のままである(**0問でも緑**)。
     **いちばん危ない形を、検証の中に必ず置く**(CLAUDE.md)。
     **席ごとに肉が違う**ので、骨ごとに数えて足す */
  const full = SWAP_FRAMES.reduce((n, f) => n + swapFillers(f).length, 0)
  ok(made > full * 0.9, `落とした組み合わせは ${full - made} 通りだけ(全 ${full})`)
  ok(NOUN_PHRASES.length > 0, '名詞句の部品表が空でない')

  /* **札。** 問が出ない骨は札にも出さない(行き止まりを作らない) */
  const tags = swapFrames()
  ok(tags.length === SWAP_FRAMES.length, `骨の札が ${tags.length} 枚(問の出る骨ぶん)`)
  ok(tags.every((t) => t.count > 0 && t.groupId && t.groupLabel),
    'どの札も、問の数と型の組を持っている')
  ok(tags.reduce((n, t) => n + t.count, 0) === made, '札の数を足すと、問の数と合う')

  /* **骨をえらばなければ、先頭の骨**(行き止まりを作らない) */
  ok(swapQuestions().length === swapQuestions({ frame: SWAP_FRAMES[0].id }).length,
    '骨をえらばなければ、先頭の骨で出る')
  ok(swapQuestions({ frame: 'そんな骨は無い' }).length === swapQuestions().length,
    '知らない骨を渡しても落ちず、先頭の骨で出る')

  /* **問の形。** お題に英語が出ていたら、写すだけの練習になる */
  const q0 = swapQuestions({ frame: 'about' })[0]
  ok(!/[A-Za-z]{3,}/.test(q0.ja), 'お題に英語が出ていない(写すだけにならない)')
  ok(q0.base.includes(SWAP_BLANK), '渡す骨に、入れる場所が残っている')
  ok(q0.give && q0.give !== 'もとの言い方', '渡しているものの札が、ふだんと違う')
  ok(q0.phrase && q0.ex.toLowerCase().includes(q0.phrase.toLowerCase()),
    'お手本に、入れるはずの名詞句が入っている')
  ok(new Set(swapQuestions({ frame: 'about' }).map((x) => x.qid)).size
     === swapQuestions({ frame: 'about' }).length, '問の id が重なっていない')

  /* **型は合っているが、名詞句が入っていない**という道が出るか。
     **これが出ないと、骨さえ言えれば ○ になってしまう** */
  const noPhrase = judgeShift('When it comes to money, we need to be careful.',
    q0.form, { phrase: q0.phrase })
  ok(noPhrase.verdict === SHIFT_NOPHRASE, '名詞句が入っていなければ ○ にしない',
    noPhrase.verdict)
  /* **ふだんの型シフトは、この道を通らない**(逆も見る) */
  ok(judgeShift('When it comes to money, we need to be careful.', q0.form).verdict === SHIFT_OK,
    '名詞句を渡さなければ、これまでどおり ○ になる')
  /* **5つの判定が、それぞれ別のもの** */
  ok(new Set([SHIFT_OK, SHIFT_OTHER, SHIFT_UNSURE, SHIFT_EMPTY, SHIFT_NOPHRASE]).size === 5,
    '5つの判定が、それぞれ別のもの')
  const sayNo = shiftSay(noPhrase)
  ok(sayNo.tone === 'nophrase' && sayNo.head && sayNo.body.includes(q0.phrase),
    '入れるはずの名詞句を、知らせの中に出す', `${sayNo.head} / ${sayNo.body}`)
  ok(!/間違|誤り|✕|×/.test(sayNo.head + sayNo.body),
    '「名詞句が入っていない」を、間違い扱いしていない')

  /* **画面が、この練習を出しているか** */
  const view = code('src/components/FrameShift.jsx')
  ok(/swapQuestions\(/.test(view), '画面が swapQuestions() を呼んでいる')
  ok(/swapFrames\(/.test(view), '画面が骨の札を出している')
  /* **66 本を1列に並べない。** 組をえらんでから骨をえらぶ(2段) */
  ok(/swapGroups/.test(view), '骨を、まず組でまとめて出している')
  ok(/shownFrames/.test(view), 'えらんだ組の中の骨だけを出している')
  ok(/activeFrame/.test(view), 'えらんでいなければ、出ている中の先頭を使う')
  ok(/phrase: q\?\.phrase/.test(view), '画面が、入れる名詞句を判定に渡している')
  /* **英語を見せない。** 見せると写すだけになる */
  ok(!/\{q\.phrase\}/.test(view), '入れる名詞句の英語を、画面に出していない')
  /* **同じことを2つ見せない。** 骨に型がそのまま書いてある */
  ok(/\{!q\.phrase && \(/.test(view), '入れ替えの練習では、型の名前を重ねて出さない')
  ok(/pick === SWAP_GROUP/.test(view), '画面の中で id を直に書き比べていない(1か所)')
}

head('見分ける練習(4択)')
{
  const qs = quizQuestions()
  ok(qs.length > 100, `問が ${qs.length} ある(素材を1文も書いていない)`)

  /* **見分けられないと宣言してある型は、答えにも選択肢にも出さない。**
     `what 節` と `What ~ is …` は同じ形なので、どちらも正しい問になる */
  const hidden = [...SAME_SHAPE.keys()]
  ok(!qs.some((q) => hidden.includes(q.form)), '見分けられない型は、答えにしない')
  ok(!qs.some((q) => q.choices.some((c) => hidden.includes(c))),
    '見分けられない型は、選択肢にも出さない')
  const forms = new Set(qs.map((q) => q.form))
  ok(forms.size === FORMS.length - hidden.length,
    `${forms.size} 型を覆っている(66 − ${hidden.length})`)

  /* **選択肢の形。** 正解が入っていない・重なっている問があれば赤 */
  const badChoice = qs.filter((q) => q.choices.length !== QUIZ_CHOICES
    || new Set(q.choices).size !== QUIZ_CHOICES
    || !q.choices.includes(q.form))
  ok(badChoice.length === 0, `どの問も選択肢が ${QUIZ_CHOICES} つで、正解を含む`,
    `\n    ${badChoice.slice(0, 3).map((q) => q.qid).join(' / ')}`)

  /* **まぎらわしい選択肢を出す。** でたらめだと、組さえ分かれば当たる。
     同じ組に3つ以上ある型では、はずれも同じ組から出ているか */
  const sameGroup = qs.filter((q) => {
    const g = FRAME_SECTIONS.flatMap((x) => x.groups).find((x) => x.id === q.groupId)
    if (!g || g.rows.length < QUIZ_CHOICES) return true
    return q.choices.every((c) => g.rows.some((r) => r.form === c))
  })
  ok(sameGroup.length === qs.length, 'まぎらわしい選択肢(同じ組)から出している',
    `${sameGroup.length} / ${qs.length}`)

  /* **出す文は、機械で確かめてある。**
     確かめられない文を出して「ちがいます」と言ったら、
     正しく選んだ人に嘘をつくことになる */
  const unsure = qs.filter((q) => frameFormOf(q.en) !== shiftTargetOf(q.form))
  ok(unsure.length === 0, '出す文は、どれも機械でその型に当たる',
    `\n    ${unsure.slice(0, 3).map((q) => q.en).join('\n    ')}`)

  /* **2つの見張りが、互いを吸っていた**(2026-09)。
     「確かめてから入れる」と「見分けられない型を外す」は、
     **どちらか片方を外しても、もう片方が拾ってしまう。**
     いまの素材はどれも型に当たるので、上の数え上げも 0 のまま緑である
     ——「赤チェックで赤くならないのは、壊し方が違うという知らせ」(CLAUDE.md)。
     **だから、書いてある形そのものを数える。** 片方を消したら赤くなる */
  const qlib = code('src/lib/frameQuiz.js')
  ok(/if \(frameFormOf\(text\) !== form\) return/.test(qlib),
    '素材を入れる前に、機械で確かめている(その1行が在る)')
  ok(/HIDDEN\.has\(form\)/.test(qlib),
    '見分けられない型を、素材の段で外している(その1行が在る)')
  ok(/const HIDDEN = new Set\(SAME_SHAPE\.keys\(\)\)/.test(qlib),
    '外す型の一覧を、SAME_SHAPE から引いている(書き写していない)')

  /* **いちばん効いた見張り。** 生の文は7つの型に 80 ずつ偏っているので、
     上限を外すと**同じ型ばかり出る。** どの型も上限以下か */
  const tally = new Map()
  for (const q of qs) tally.set(q.form, (tally.get(q.form) ?? 0) + 1)
  const over = [...tally].filter(([, n]) => n > QUIZ_MAX_PER_FORM)
  ok(over.length === 0, `どの型も ${QUIZ_MAX_PER_FORM} 問まで(偏らせない)`,
    `\n    ${over.slice(0, 3).map(([f, n]) => `${f} が ${n} 問`).join(' / ')}`)

  /* **並びが動かないか。** 描き直すたびに選択肢が動くと、押す先が変わる */
  const again = quizQuestions()
  ok(again[0].choices.join() === qs[0].choices.join()
     && again[40].choices.join() === qs[40].choices.join(),
    '描き直しても、選択肢の並びが動かない')
  /* **全部が同じ並びではない**(逆も見る。混ぜていなければ、これが赤くなる) */
  ok(qs.some((q) => q.choices[0] !== q.form), '正解がいつも先頭、にはなっていない')

  /* **絞り込み。** 知らない組は0問、絞らなければぜんぶ */
  ok(quizGroups().length > 1, `型の組が ${quizGroups().length} 出る`)
  ok(quizQuestions({ group: 'そんな組は無い' }).length === 0, '知らない組で絞ると 0 問')
  ok(quizQuestions({ group: null }).length === qs.length, '絞らなければ、ぜんぶ返る')
  const byG = quizGroups().reduce((n, g) => n + quizQuestions({ group: g.id }).length, 0)
  ok(byG === qs.length, '組ごとに数えて足すと、全部になる', `${byG} / ${qs.length}`)

  /* **判定。** 押していないときを「正解」にしない */
  ok(judgeQuiz(qs[0].form, qs[0]).right === true, '正しい型を選べば当たり')
  const other = qs[0].choices.find((c) => c !== qs[0].form)
  ok(judgeQuiz(other, qs[0]).right === false, 'ちがう型を選べば、はずれ')
  ok(judgeQuiz(null, qs[0]).answered === false, 'まだ押していないときは、答えていない扱い')
  ok(judgeQuiz(null, qs[0]).right === false, 'まだ押していないときを、当たりにしない')
  ok(judgeQuiz('なにか', null).answered === false, '問が無くても落ちない')

  /* **一覧の1枚** */
  const card = quizTraining(new Set([qs[0].qid]))
  ok(card.id === QUIZ_GROUP && card.total === qs.length, '一覧の1枚が、問の数と合う')
  ok(card.done === 1, '当てた問が 1 と数えられる')
  ok(quizTraining().done === 0 && quizTraining(null).done === 0,
    '控えを渡さなくても落ちない')
  ok(card.move?.ask, '見分けるにも「やること」がある')

  /* **画面が本当に呼んでいるか** */
  const qv = code('src/components/FrameQuiz.jsx')
  ok(/judgeQuiz\(/.test(qv), '画面が judgeQuiz() を呼んでいる')
  ok(!/picked === q\.form|q\.form === picked/.test(qv),
    '画面の中で、合っているかを書き比べていない')
  /* **書き込む欄は置かない**(型シフトの共通仕様) */
  ok(!/<textarea|<input/.test(qv), '見分ける練習にも、書き込む欄が無い')
  /* **二度押しで答えが変わらない** */
  ok(/disabled=\{!!picked\}/.test(qv), '一度押したら、選び直せない')
  /* **色だけに頼らない**(CLAUDE.md)。印の文字も出す */
  ok(/正しい型/.test(qv) && /選んだもの/.test(qv), '色だけでなく、文字でも示している')

  const view = code('src/components/FrameShift.jsx')
  ok(/<FrameQuiz\s/.test(view), '一覧から、見分ける練習へつながっている')
  ok(/quizTraining\(/.test(view), '一覧に、見分けるの1枚を足している')
  ok(/pick === QUIZ_GROUP/.test(view), '画面の中で id を直に書き比べていない(1か所)')
  /* **後ろへ足す。並べ替えない** */
  const list = shiftTrainings()
  ok(view.indexOf('shiftTrainings(done), quizTraining(done)') > 0,
    '見分けるは、いちばん後ろに足している')
  ok(list.every((t) => t.id !== QUIZ_GROUP),
    '見分けるを shiftTrainings() の中で作っていない(読み込みが輪にならない)')
}

/* ────────────────────────────────────────────────────────────
   ⑨ 型ごとの到達度(次の段「型の地図」の土台)
   ──────────────────────────────────────────────────────────── */
head('型ごとの到達度')
{
  const none = shiftMap(new Set())
  ok(none.length === FORMS.length, `型の数だけ行が出る(${none.length})`)
  ok(none.every((m) => m.done === 0), '何も言えていなければ、0 のまま')

  const one = shiftQuestions()[0]
  const some = shiftMap(new Set([one.qid]))
  ok(some.find((m) => m.form === one.form).done === 1, '言えた問が 1 と数えられる')
  ok(some.filter((m) => m.done > 0).length === 1, '言えていない型まで数えていない')
  /* **Set 以外を渡しても落ちない**(読めなかったときに来る) */
  ok(shiftMap(null).every((m) => m.done === 0), 'null を渡しても落ちない')
}

/* ────────────────────────────────────────────────────────────
   ⑩ 画面が、判定を書き写していないか
      **算段だけ直っていても、画面が呼んでいなければ何も変わらない**
   ──────────────────────────────────────────────────────────── */
head('画面が、判定を書き写していないか')
{
  const view = code('src/components/FrameShift.jsx')

  /* **`frameMatch` を直に触らない。** 触ると、判定が2か所になる */
  ok(!/frameMatch|frameFormOf|FRAME_INDEX/.test(view),
    '画面が frameMatch を直に触っていない')

  /* **使っている形で数える。** 名前が出てくるだけでは足りない(CLAUDE.md) */
  ok(/judgeShift\(/.test(view), '画面が judgeShift() を呼んでいる')
  ok(/shiftSay\(/.test(view), '画面が shiftSay() を呼んでいる')
  ok(/shiftQuestions\(/.test(view), '画面が shiftQuestions() を呼んでいる')
  ok(/shiftTrainings\(/.test(view), '画面が shiftTrainings() を呼んでいる')

  /* **カテゴリーの名前も、やることも、画面で書き写さない** */
  ok(!/モノ・ことを主語にして/.test(view), '「やること」の文を画面に書き写していない')
  /* **席の種類ごとに、画面で書き分けない。** 何を入れるかは骨の札が言う */
  ok(!/主語を入れる|動詞のかたまりを入れる/.test(view),
    '入れるものの名前を、画面に書き写していない')
  ok(/q\.give/.test(view), '渡しているものの札は、出題の側が決めている')
  ok(/move\?\.ask/.test(view), '「やること」は frameTraining.js から引いている')

  /* **一覧から入る形になっているか。** 66 問を1本の列にすると、
     何の練習をしているのかが最後まで出てこない(2026-09 に一度そうした) */
  ok(/fshift-card/.test(view), 'トレーニングの一覧(カード)がある')
  ok(/トレーニングの一覧へ/.test(view), 'ドリルから一覧へ戻れる(行き止まりを作らない)')

  /* **判定の文字列を書き写していない。** `'ok'` と直に書くと、
     あちらを変えた日に画面だけ古くなる */
  ok(!/['"]unsure['"]|['"]other['"]/.test(view),
    '画面が判定の文字列を書き写していない')

  /* **お手本を、はじめから出していない。** 出ていたら練習にならない */
  ok(/openEx/.test(view), 'お手本は、押したときだけ出す')

  /* **マイクの知らせを、その場に出す**(画面のいちばん下に出さない) */
  ok(/micNote/.test(view), 'マイクの失敗を、その操作をした場所に出す')

  /* ── **書き込む欄を置かない**(2026-09 実機・利用者の指定)──────

       > 書き込む欄はいらないですね。基本的にタイプするのは面倒なので
       > 型シフトトレーニングについては書き込みはなしを共通仕様にしてください

     これは**話す練習**である。打たせると、打つ速さの練習になってしまう。
     **共通仕様**なので、14 のカテゴリーでも名詞句の入れ替えでも同じ ——
     この画面に `input` / `textarea` が1つでもあれば赤くする。 */
  ok(!/<textarea/.test(view), '型シフトに、書き込む欄(textarea)を置いていない')
  ok(!/<input/.test(view), '型シフトに、書き込む欄(input)を置いていない')
  ok(!/onChange=/.test(view), '打った文字を受け取っていない')
  /* **聞き取った文は、必ず見せる。**
     何と聞こえたか分からないと、判定に納得できない */
  ok(/fshift-heard/.test(view), '聞き取った文を、画面に出している')

  /* **対応していない端末を、行き止まりにしない**(CLAUDE.md)。
     マイクが無い端末では「言えた」を自分で押せる。**打たせないのは同じ** */
  ok(/isRecognitionSupported\(\) \? \(/.test(view),
    'マイクが使えるかで、出すものを変えている')
  ok(/markDone\(q\.qid\)/.test(view),
    'マイクが使えない端末でも、言えたを控えられる(行き止まりを作らない)')
  ok(/!isRecognitionSupported\(\) && \(/.test(view),
    'マイクが使えないときは、その理由を画面に出す')
  /* **控えに足すのは1か所だけ。** 2か所あると数え方が食い違う */
  ok((view.match(/saveShiftDone\(/g) || []).length === 1,
    '言えた問を控えるのは、1か所だけ')

  /* **絞り込みは畳んである**(390px で問が画面の外へ押し出されるため)。
     ただし **黙って絞らない** —— 掛かっている条件は畳んだままでも見せる */
  ok(/<details className="card fshift-filter">/.test(view), '絞り込みは畳んである')
  /* **掛かっている絞り込みを、畳んだままでも見せる**(黙って絞らない)。
     **「出る」と「出ない」の両方を見る** —— 絞っていなければ札は出さない */
  ok(/<summary className="fshift-sum">[\s\S]*?finder-badge[\s\S]*?<\/summary>/.test(view),
    '畳んだ見出しの中に、掛かっている絞り込みの札がある')
  ok(/: scene && \(/.test(view), '絞っていないときは、札を出さない')
}

/* ────────────────────────────────────────────────────────────
   ⑪ 画面が、アプリに組み込まれているか
      **作っただけで、どこからも開けない**を防ぐ
   ──────────────────────────────────────────────────────────── */
head('画面が、アプリに組み込まれているか')
{
  const app = code('src/App.jsx')
  ok(/<FrameShift\s*\/>/.test(app), 'App.jsx が FrameShift を描いている')
  ok(/id:\s*'shift'/.test(app), 'メニューに行き先がある')
  ok(/view === 'shift'/.test(app), '行き先から画面へつながっている')

  /* **骨組み(`__screens.jsx`)にも在る** —— すき間の見張りが通る */
  const sc = code('src/__screens.jsx')
  ok(/<FrameShift\s*\/>/.test(sc), '骨組みが、本物の部品をそのまま描いている')
  const bar = code('scripts/test-bar.mjs')
  ok(/\['shift', ''\]/.test(bar), 'すき間の見張りに shift が入っている')
  ok(/\['quiz', ''\]/.test(bar), 'すき間の見張りに quiz が入っている')
  ok(/<FrameQuiz\s/.test(sc), '骨組みが、見分けるの部品もそのまま描いている')
}

console.log(ng === 0 ? '\n✅ 型シフトは、すべて意図どおりです' : `\n❌ ${ng} 件`)
process.exit(ng === 0 ? 0 : 1)
