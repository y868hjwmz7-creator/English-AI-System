/**
 * 「止めた場所から再び再生する」の検証(2026-09 利用者の指定)。
 *
 *   > 全文を聞いている途中にストップを押し、もう一度再生を押すと、
 *   > また元に戻ってしまいます。止めた場所から再び再生する機能がほしいです。
 *   > これは段落ごとの再生ボタンでも同じ仕様にしてください。
 *
 * **この決まりは、間違えても `npm run lint` にも `npm run build` にも
 * 引っかからない。** しかも間違い方が
 *
 *   ・押すたびに終わりぎわから鳴る(控えを消し忘れる)
 *   ・いつまでも頭から鳴る(控えを取り出せていない)
 *   ・別の教材の秒数から鳴る(目印を見ていない)
 *
 * のように、**実際に押してみるまで分からない**形になる。
 * だから素の node で確かめられる形(`src/lib/playMark.js`)に切り出して、
 * ここで機械的に見張る。**この検証を外さないこと。**
 */
import {
  finished, hasMark, nowPlaying, stopped, takeMark,
} from '../src/lib/playMark.js'
import { SESSION_SIZE, buildSession } from '../src/lib/wordQuiz.js'
import {
  bestStreak, collectRows, goalLine, goalPart,
  praiseFor, streakLine, weekLine, STREAK_FROM,
} from '../src/lib/gamify.js'
import {
  MAX_CHARS, MAX_PARTS, pastedParagraphs, speakerLine, speechBrief,
} from '../src/lib/speechDraft.js'
import {
  EXERCISE_TYPES, SCALABLE_SECTIONS, amountsFor, defaultSectionsFor,
  exerciseLabel, isPassageSection, noteIsAnswer, sectionLabel, sectionsFor,
} from '../src/data/exerciseTypes.js'
import { canDeleteMaterial, deleteWarning } from '../src/lib/materialDelete.js'
import {
  MATERIAL_KINDS, bodyWord, canPasteBody, isPassageKind, usesScene,
} from '../src/data/materialKinds.js'
import {
  COMMON_HOBBY_SPEECH_SCENES, SPEECH_SCENES, sceneLabel, speechScenesFor,
} from '../src/data/genres.js'
import { readFileSync } from 'node:fs'

let ng = 0
const ok = (cond, name, extra = '') => {
  if (cond) console.log(`✓ ${name}${extra ? ` — ${extra}` : ''}`)
  else { ng += 1; console.log(`✗ ${name}${extra ? ` — ${extra}` : ''}`) }
}

/** 毎回まっさらから始める(検証どうしが干渉しないように・CLAUDE.md) */
const reset = () => { nowPlaying(null); finished() }

console.log('\n▶ 止めたら、その場所を覚える')
reset()
nowPlaying('all|m1|s1', 3)
stopped(12.5)
ok(hasMark('all|m1|s1'), '控えがある')
{
  const m = takeMark('all|m1|s1')
  ok(m && m.index === 3 && m.at === 12.5, '何段落目の何秒めかを覚えている',
    m ? `${m.index} 段落目の ${m.at} 秒` : 'なし')
}

console.log('\n▶ 取り出したら消える(同じ場所へ二度戻さない)')
reset()
nowPlaying('all|m1|s1', 2)
stopped(5)
takeMark('all|m1|s1')
ok(takeMark('all|m1|s1') === null, '2度目は空になる')

console.log('\n▶ 目印が違えば、頭から鳴る')
reset()
nowPlaying('all|m1|s1', 4)
stopped(9)
ok(takeMark('all|m2|s1') === null, '別の教材では控えを使わない')
ok(takeMark('one|us-female|Hello.') === null, '段落ごとの Listen にも渡さない')
ok(takeMark(null) === null, '目印が無ければ、いつも頭から')
ok(hasMark('all|m1|s1'), 'もとの控えは残っている(取り違えて消さない)')

console.log('\n▶ 最後まで鳴りきったら、次は頭から')
reset()
nowPlaying('all|m1|s1', 5)
finished()
ok(takeMark('all|m1|s1') === null, '鳴りきったあとに控えは残らない')
// **ここが本丸。** 消し忘れると「押すたびに終わりぎわから鳴る」になる
reset()
nowPlaying('one|v|Hi.', 0)
stopped(3)
takeMark('one|v|Hi.')       // 再開した
nowPlaying('one|v|Hi.', 0)
finished()                   // 今度は最後まで鳴った
ok(takeMark('one|v|Hi.') === null, '再開 → 最後まで、のあとも頭から')

console.log('\n▶ 鳴り出す前に止めたときは、覚えない')
reset()
nowPlaying('all|m1|s1', 1)
stopped(0)
ok(takeMark('all|m1|s1') === null, '0 秒では覚えない')
reset()
nowPlaying('all|m1|s1', 1)
stopped(0.2)
ok(takeMark('all|m1|s1') === null, '0.3 秒に満たなければ覚えない(押し間違い)')
reset()
nowPlaying('all|m1|s1', 1)
stopped(0.4)
ok(takeMark('all|m1|s1') !== null, '0.3 秒を超えていれば覚える')

console.log('\n▶ 端末の声のときは覚えない')
/* 端末の声(Web Speech)には「何秒めか」を知る手段が無く、
   `stopClip()` は 0 を返す。**中途半端に覚えるより、頭から鳴るほうが
   説明できる**(CLAUDE.md「あやふやなことを言わない」と同じ考え方) */
reset()
nowPlaying('one|v|Hello there.', 0)
stopped(0)
ok(takeMark('one|v|Hello there.') === null, '秒数が分からないものは控えない')

console.log('\n▶ 別のものを鳴らし始めたら、前の控えは捨てる')
/* 捨てないと、**教材を替えたのに前の教材の秒数から鳴る。**
   `stopped()` は「いま鳴っているもの」を見て控えを作り直す */
reset()
nowPlaying('all|m1|s1', 3)
stopped(8)                    // m1 を止めた
nowPlaying('all|m2|s1', 0)    // 別の教材を鳴らし始めた
stopped(4)                    // それも止めた
ok(takeMark('all|m1|s1') === null, '前の教材の控えは残っていない')
ok(takeMark('all|m2|s1') !== null, 'いま止めたほうだけが残る')

console.log('\n▶ 鳴っていないのに止めても、控えを作らない')
reset()
stopped(20)
ok(takeMark('all|m1|s1') === null, '何も鳴っていなければ控えない')

/* ══════════════════════════════════════════════════════════════════
 * **おさらい**(2026-09 利用者の指定)
 *
 *   > 一巡しただけで「今日はもう出すものがありません」となってしまいます。
 *   > 反復してランダムに出題するよう変更してください。
 *
 * ふだんの復習は「まだ」を先に出す(苦手な語が枠から外れないように)。
 * ところが**おさらいは何度も回すもの**なので、その並びのままだと
 * **毎回おなじ「まだ」の語ばかり**が出て、ほかが一度も出てこない。
 * ここが壊れても `npm run lint` にも `npm run build` にも
 * 引っかからず、**何度か回してみるまで分からない。**
 * ══════════════════════════════════════════════════════════════════ */
console.log('\n▶ おさらいは、まるごと混ぜて出す')
{
  const rows = []
  for (let i = 0; i < 30; i += 1) {
    rows.push({
      word_norm: `w${i}`,
      // 3語だけ「まだ」。ふだんはこの3語が必ず先に来る
      status: i < 3 ? 'unknown' : 'learning',
    })
  }

  // ふだん(おさらいではない)… 「まだ」が必ず先頭に来る
  const normal = buildSession(rows)
  ok(normal.length === SESSION_SIZE, `1回は ${SESSION_SIZE} 語`)
  ok(normal.slice(0, 3).every((r) => r.status === 'unknown'),
    'ふだんは「まだ」が先に出る')

  /* おさらい … **先頭が「まだ」に固定されていないこと**を見る。
     「出てきた語の種類を数える」だけでは足りない —— ふだんの並びでも
     残りの枠は混ざるので、何回か回せば全部が顔を出してしまう。
     **実際にそれで、外しても赤くならなかった。**

     30語のうち「まだ」は3語なので、まるごと混ぜていれば
     先頭が「まだ」になるのは10回に1回ほど。20回すべてが「まだ」なら、
     それは**混ぜていない**(ふだんの並びのまま)ということである。 */
  let headYet = 0
  const seen = new Set()
  for (let n = 0; n < 20; n += 1) {
    const s = buildSession(rows, SESSION_SIZE, { shuffleAll: true })
    if (s[0].status === 'unknown') headYet += 1
    for (const r of s) seen.add(r.word_norm)
  }
  ok(headYet < 20, `おさらいは先頭も混ざる(20回のうち「まだ」が先頭 ${headYet} 回)`)
  ok(seen.size > 20, `おさらいは毎回ちがう顔ぶれ(20回で ${seen.size} / 30 語)`)

  // **同じ語を2つ入れない**(混ぜても重ならない)
  const one = buildSession(rows, SESSION_SIZE, { shuffleAll: true })
  ok(new Set(one.map((r) => r.word_norm)).size === one.length,
    'おさらいでも、同じ語は1回しか出ない')

  // 語が少なければ、あるだけ出す(足りないと言って止まらない)
  const few = buildSession(rows.slice(0, 4), SESSION_SIZE, { shuffleAll: true })
  ok(few.length === 4, '語が足りなければ、あるだけ出す')
}

/* ══════════════════════════════════════════════════════════════════
 * やり終えたときの手応え(`gamify.js`)
 *
 *   > 単語帳とクイックレスポンス帳にゲーミフィケーションを追加したいです
 *
 *   画面の中に書くと**素の node で一度も確かめられない**ので、
 *   `playMark.js` と同じく何にも依存しない形へ切り出してある。
 *   ここでは**決まりそのもの**を見る ——
 *   ①短い連続で騒がない ②責めない ③日ではなく週 ④0で割らない
 * ══════════════════════════════════════════════════════════════════ */
{
  console.log('\n▶ やり終えたときの手応え(gamify)')

  const of = (...flags) => flags.map((f) => ({ ok: !!f }))

  // ── いちばん長い連続 ────────────────────────────────────────
  ok(bestStreak([]) === 0, '答えが無ければ 0')
  ok(bestStreak(of(1, 1, 0, 1, 1, 1, 0)) === 3, 'いちばん長いところを数える(3)')
  ok(bestStreak(of(0, 0, 0)) === 0, '1つも無ければ 0')
  ok(bestStreak(of(1, 1, 1, 1)) === 4, '全部つながれば、その数')
  ok(bestStreak(null) === 0, '一覧でないものを渡されても落ちない')

  /* **短い連続では出さない。** 2連続で「2 連続!」と出しても、
     うれしくないうえ場所を食うだけである(数を並べない・CLAUDE.md) */
  ok(streakLine(of(1, 1)) === '', `${STREAK_FROM} より短い連続では、何も言わない`)
  ok(streakLine(of(1, 1, 1)).includes('3'), '3 連続からは言う')

  // ── 声かけ。**結果から決める**(押すたびに変わらない)────────────
  {
    // **押すたびに言葉が入れ替わらない**(スラッシュリーディングの
    // `praiseFor()` と同じ作法。混ぜると、目が言葉のほうへ行って気が散る)
    const said = new Set()
    for (let i = 0; i < 20; i += 1) said.add(praiseFor(7, 10))
    ok(said.size === 1, '同じ結果なら、いつも同じ言葉(混ぜない)')
  }
  ok(praiseFor(10, 10).includes('Perfect'), '全部そろえば Perfect')
  ok(praiseFor(9, 10) !== praiseFor(5, 10), '点数で言葉が変わる')
  ok(praiseFor(0, 0) === '', '答えが無ければ、何も言わない')
  /* **いちばん下でも責めない。** 知らないことは失敗ではない
     (「まだ」を赤くしないのと同じ考え方・CLAUDE.md) */
  {
    const worst = praiseFor(0, 10)
    const 責める = ['だめ', 'ダメ', '悪い', 'もっと', '足りない', '残念']
    ok(worst.length > 0 && !責める.some((w) => worst.includes(w)),
      `0点でも責めない(「${worst}」)`)
  }

  // ── 週の続き。**日ではなく週**(0019 の決まり)──────────────────
  ok(weekLine({ days: 0, weeks: 0 }) === '', '記録が無ければ、行ごと出さない')
  ok(weekLine({ days: 3, weeks: 5 }).includes('週'), '週で数えている')
  ok(!/連続\s*\d+\s*日|\d+\s*日連続/.test(weekLine({ days: 3, weeks: 5 })),
    '「◯日連続」とは書かない(1日休んだだけで途切れ、やめる理由になる)')

  // ── 集まり具合 ──────────────────────────────────────────────
  {
    const rows = [
      { industry: 'it', known: 10, learning: 10 },
      { industry: 'med', known: 30, learning: 10 },
      { industry: 'law', known: 0, learning: 0 },   // 出会っていない分野
      { industry: '', known: 5, learning: 5 },      // 名前が無い
    ]
    const got = collectRows(rows, { limit: 3 })
    ok(got.length === 2, '出会っていない分野と、名前の無い行は出さない')
    ok(got[0].industry === 'med', '覚えた語が多い順に並ぶ')
    ok(Math.abs(got[0].ratio - 0.75) < 1e-9, 'そろい具合は 覚えた / 出会った')
    ok(collectRows([{ industry: 'x', known: 0, learning: 0 }]).length === 0,
      '0で割らない(出会っていない分野は落とす)')
    ok(collectRows(rows, { limit: 1 }).length === 1, '出す数を絞れる')
    ok(collectRows(null).length === 0, '一覧でないものを渡されても落ちない')
  }

  /* ── **画面が、本当にこれを使っているか** ───────────────────────
       定義だけあって誰も呼ばなければ、何も起きない
       (`noteFnRev` を定義だけして呼んでいなかったのと同じ落とし穴)。
       **終わりの1枚は、単語帳と Quick Response で同じ部品**である —— 
       書き写すと、必ず片方だけ古くなる(CLAUDE.md) */
  {
    const read = (f) => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8')
    const sr = read('components/SessionResult.jsx')
    ok(/praiseFor|streakLine|weekLine/.test(sr), '終わりの1枚が、手応えの決まりを使っている')
    ok(/playSfx\(/.test(sr), 'やり切った合図(音)を鳴らしている')
    for (const [what, file] of [
      ['単語帳', 'components/Wordbook.jsx'],
      ['Quick Response の復習', 'components/QrReview.jsx'],
    ]) {
      const t = read(file)
      ok(/<SessionResult/.test(t), `${what}が、終わりの1枚を同じ部品で出している`)
    }
    ok(/<CollectRows/.test(read('components/Wordbook.jsx')),
      '単語帳が、集まり具合を出している')
    ok(/loadVocabByIndustry/.test(read('components/Wordbook.jsx')),
      '集まり具合のもとを、実際に読みに行っている')
  }

  /* ── 週の目標(0042)──────────────────────────────────────────
       **「決めていない」と「まだ届いていない」は別物である。**
       0 のときに「0 / 0」と出すと、何もしていないように見える。
       だから `goalPart()` は `null` を返し、画面は行ごと出さない。 */
  {
    ok(goalPart(0, 5) === null, '目標を決めていなければ、何も出さない')
    ok(goalPart(null, 5) === null, '目標が無い(null)ときも、何も出さない')
    ok(goalLine(0, 5, '語') === '', '目標が無ければ、1行も書かない')

    const yet = goalPart(50, 20)
    ok(yet !== null && yet.hit === false, '届いていないときは、達成にしない')
    ok(goalLine(50, 20, '語').includes('あと 30'), '残りの数を出す',
      goalLine(50, 20, '語'))

    const hit = goalPart(50, 50)
    ok(hit.hit === true, 'ちょうど届いたら達成')
    ok(goalPart(50, 80).hit === true, '超えても達成のまま')
    ok(goalLine(50, 80, '文').includes('達成'), '達成したと書く',
      goalLine(50, 80, '文'))
    /* **責めない・煽らない**(「まだ」を赤くしないのと同じ考え方) */
    ok(!/遅れ|足りません|できていません/.test(goalLine(50, 1, '語')),
      '届いていなくても、責める言葉を使わない', goalLine(50, 1, '語'))
    /* 数え方の言葉は、呼ぶ側が決める(語 / 文) */
    ok(goalLine(10, 3, '文').includes('文') && !goalLine(10, 3, '文').includes('語'),
      '数え方の言葉が、そのまま出る')
    ok(goalPart(50, -3).done === 0, 'ありえない数(負)でも落ちない')

    /* **画面が、本当にこれを使っているか。**
       定義だけあって誰も呼ばなければ、目標は決められても出てこない */
    const read = (f) => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8')
    const gb = read('components/GoalBar.jsx')
    ok(/goalPart|goalLine/.test(gb), '目標の帯が、決まりを1か所から読んでいる')
    for (const [what, file] of [
      ['単語帳', 'components/Wordbook.jsx'],
      ['Quick Response の復習', 'components/QrReview.jsx'],
    ]) {
      const t = read(file)
      ok(/<GoalBar/.test(t), `${what}が、週の目標を出している`)
      ok(/loadWeeklyGoal/.test(t), `${what}が、週の目標を読みに行っている`)
    }
    /* **続けた記録は、Quick Response にも。** 週で数える(0042) */
    ok(/loadQrWeek/.test(read('components/QrReview.jsx')),
      'Quick Response が、続けた記録を読みに行っている')
    ok(/week=\{week\}/.test(read('components/QrReview.jsx')),
      'Quick Response の終わりの1枚に、週の続きが渡っている')
    /* **決めるのはトレーナー。** ゲストの画面から呼ばない */
    ok(/setWeeklyGoal/.test(read('components/TrainerLearners.jsx')),
      'トレーナーの画面から、週の目標を決められる')
    for (const [what, file] of [
      ['単語帳', 'components/Wordbook.jsx'],
      ['Quick Response の復習', 'components/QrReview.jsx'],
    ]) {
      ok(!/setWeeklyGoal/.test(read(file)),
        `${what}からは、目標を決められない(自分で下げられる目標は目標にならない)`)
    }
  }
}

/*
 * ============================================================================
 * **Speech練習**(2026-09 利用者の指定)
 *
 *   > 自分でスピーチなどを考えてもらったものをそのままコピペして
 *   > 指定する音声で text to speech をして…
 *
 * 貼った原稿の切り方も、窓口へ渡す指定も、**画面の中に書くと
 * 素の node で一度も確かめられない。** だから切り出してある
 * (`playMark.js` / `gamify.js` と同じ考え方)。ここで見張る。
 * ============================================================================
 */
{
  console.log('\n▶ Speech練習(貼った原稿・窓口へ渡す指定)')

  // ① 段落の切り方。**上から順に見て、当てはまった時点で決める**
  ok(pastedParagraphs('A.\n\nB.\n\nC.').length === 3, '空行で段落が分かれる')
  ok(pastedParagraphs('A.\n\n\n\nB.').length === 2, '空行が続いても、増えない')
  ok(pastedParagraphs('A.\nB.\nC.').length === 3, '空行が無ければ、改行で分かれる')
  ok(pastedParagraphs('  \n  ').length === 0, '空っぽなら 0 段落')
  ok(pastedParagraphs(null).length === 0, '何も渡されなくても落ちない')
  ok(pastedParagraphs('Hello.').length === 1, '1文だけなら、切らない')

  // **1本の長い塊は、文で切ってまとめる。**
  // 切らないと「全部を一度に」しか練習できず、段落ごとの Listen も効かない
  const long = Array.from({ length: 12 },
    (_, i) => `This is sentence number ${i} and it carries a few more words.`).join(' ')
  const parts = pastedParagraphs(long)
  ok(parts.length > 1, '長い1本の原稿は、文で切ってまとめる', `${parts.length} 段落`)
  ok(parts.join(' ').split(/\s+/).length === long.split(/\s+/).length,
    '1語も落とさない(余りを捨てない)')

  // 段落の上限。**際限なく作らせない**
  const many = pastedParagraphs(Array.from({ length: 80 }, (_, i) => `S${i}.`).join('\n'))
  ok(many.length === MAX_PARTS, `段落は ${MAX_PARTS} で止まる`)

  /* **1段落の長さの上限**(2026-09 実機・利用者の指摘)。
       > 音声をアメリカ女性…を選んだのに、本当に質の悪い男性の声になりました。

     読み上げの窓口(`speak`)は1回に 2,000 文字までしか受け取らない。
     超えると 400 で断られ、**端末の声**に落ちる —— 選んだ声とは
     何の関係もない声で鳴る。**自分で書いた原稿は1段落が桁違いに長い**ので、
     ここで必ず収める。**どの切り方で来たものも通る**ことまで見る */
  {
    const sen = 'This is one sentence that carries a fair number of words in it. '
    const huge = sen.repeat(40)                       // 約 2,500 文字の1段落
    const cases = [
      ['空行で切った道', `${huge}\n\n${huge}`],
      ['改行で切った道', `${huge}\n${huge}`],
      ['1段落だけの道', huge],
    ]
    for (const [name, src] of cases) {
      const got = pastedParagraphs(src)
      const longest = Math.max(...got.map((x) => x.length))
      ok(longest <= MAX_CHARS, `${name}でも、1段落は ${MAX_CHARS} 文字を超えない`,
        `いちばん長い段落 ${longest} 文字 / ${got.length} 段落`)
      // **1語も落とさない。** 収めるために捨てては、原稿が変わってしまう
      ok(got.join(' ').split(/\s+/).filter(Boolean).length
        === src.split(/\s+/).filter(Boolean).length, `${name}で、1語も落ちない`)
    }
    ok(MAX_CHARS < 2000, '窓口の上限(2,000)に、余裕を持って収まっている')
    // **ふつうの長さの段落は、1文字も動かさない**(言われた場所だけを直す)
    const plain = 'A short paragraph. It stays exactly as it is.'
    ok(pastedParagraphs(plain)[0] === plain, '短い段落は、1文字も動かさない')
  }

  /* **本文の呼び名は、教材の種類から決める**(2026-09 実機・利用者の指摘)。
       > また、サブタイトルが「記事」というのも直して下さい。

     Speech練習の本文は演習としては `article` なので、そのまま名前を出すと
     「記事(5 段落)」になっていた。**判断は `sectionLabel` 1か所** */
  ok(sectionLabel('speech', 'article') === 'スピーチ',
    'Speech練習の本文は「スピーチ」と出る', sectionLabel('speech', 'article'))
  ok(sectionLabel('reading', 'article') === '記事', '記事は、これまでどおり「記事」')
  ok(sectionLabel('dialogue', 'dialogue') === '会話', '会話も変わっていない')
  ok(sectionLabel('meeting', 'dialogue') === '会議', '会議も変わっていない')
  ok(sectionLabel('speech', 'listening') === exerciseLabel('listening'),
    '本文でない演習の名前は、種類で変わらない')

  // ② 話し手の1行。**空の欄は出さない**
  ok(speakerLine({}) === '', '何も入れなければ、1文字も出さない')
  ok(speakerLine({ name: 'Taro' }) === 'Taro', '名前だけでも成り立つ')
  ok(speakerLine({ company: 'ABC' }) === 'ABC', '会社名だけでも成り立つ')
  ok(speakerLine({ name: 'Taro', company: 'ABC', dept: 'Sales', role: 'Head' })
    === 'Taro(ABC Sales Head)', '4つそろえば、括弧でまとめる',
  speakerLine({ name: 'Taro', company: 'ABC', dept: 'Sales', role: 'Head' }))

  // ③ 窓口へ渡す指定。**ここが記事とスピーチを分ける唯一の場所**
  const brief = speechBrief({ scene: '乾杯のあいさつ', hint: '30秒', who: { name: 'Taro' } })
  ok(/記事ではありません/.test(brief), '「記事ではない」と、はっきり言う')
  ok(/1人/.test(brief), '1人が話しきる、と言う')
  ok(/乾杯のあいさつ/.test(brief), '場面が入る')
  ok(/Taro/.test(brief), '話し手が入る')
  /* **`/話し手/` では見分けられない。** 「話し手を切り替えないでください」
     という決まり文句が、いつも入っているためである(実測で気づいた)。
     見るのは**その行の頭**(`・話し手:`)にする */
  ok(!/・話し手:/.test(speechBrief({ scene: '乾杯のあいさつ' })),
    '話し手を入れていなければ、その行ごと出さない')
  ok(/夏祭り/.test(speechBrief({ subject: '夏祭り' })), '自分で書いた話題も入る')

  // ④ 場面。**会話の場面を混ぜない**(1人が話しきる場面ではない)
  ok(SPEECH_SCENES.length >= 10, 'スピーチの場面がひととおりある',
    `${SPEECH_SCENES.length} 件`)
  const ids = SPEECH_SCENES.map((x) => x.id)
  ok(new Set(ids).size === ids.length, '場面の id が重なっていない')
  ok(!ids.includes('negotiation') && !ids.includes('trouble'),
    '会話の場面(交渉・トラブル対応)は混ざっていない')
  ok(speechScenesFor('golf') === COMMON_HOBBY_SPEECH_SCENES,
    '趣味では、趣味のスピーチの場面が出る')
  ok(speechScenesFor('it') === SPEECH_SCENES, '仕事では、仕事のスピーチの場面が出る')
  // **名前を引けること。** 引けないと、教材の名前に id がそのまま出る
  ok(sceneLabel('sp_toast') === '乾杯のあいさつ', '場面の名前を引ける',
    sceneLabel('sp_toast'))
  ok(sceneLabel('sph_wedding') === '結婚式のスピーチ', '趣味の場面の名前も引ける')
  // **画面にそのまま出る文字列に、強調の書き方(**)を混ぜない**(実測で見つけた)
  ok(![...SPEECH_SCENES, ...COMMON_HOBBY_SPEECH_SCENES]
    .some((x) => /\*\*/.test(x.hint) || /\*\*/.test(x.label)),
  '場面の名前と説明に、強調の記号が混ざっていない')

  // ⑤ 種類としての Speech練習
  ok(MATERIAL_KINDS.some((k) => k.id === 'speech'), '教材の種類に Speech練習がある')
  ok(isPassageKind('speech'), '本文を1本作る種類として数える')
  ok(usesScene('speech'), '場面を選ぶ種類として数える')
  ok(canPasteBody('speech'), '原稿を貼れる種類である')
  ok(!canPasteBody('reading') && !canPasteBody('dialogue'),
    '記事・会話には貼る欄を出さない(言われた場所だけを直す)')
  ok(bodyWord('speech') === 'スピーチ', '呼び名は「スピーチ」')
  ok(bodyWord('reading') === '記事' && bodyWord('dialogue') === '会話'
    && bodyWord('meeting') === '会議', 'ほかの呼び名は1つも変わっていない')

  // ⑥ **画面が、本当にこれを使っているか**
  {
    const read = (f) => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8')
    const form = read('components/MaterialForm.jsx')
    ok(/pastedParagraphs/.test(form), '作る画面が、貼った原稿を段落に切っている')
    /* **「名前が出てくるか」では足りない**(CLAUDE.md)。
       本文を作る道から分岐を外しても、`scriptParts` の側に名前が残るので
       緑のままだった(実測)。**呼んでいる形**で見る */
    ok(/if \(pasted\.length\) return generateFromScript/.test(form),
      '貼ってあれば、本文を AI に作らせない道へ分かれている')
    ok(/speechBrief/.test(form), '作る画面が、スピーチとしての指定を渡している')
    ok(/speechScenesFor/.test(form), '作る画面が、スピーチの場面を出している')
    ok(/generateFromScript/.test(form), '貼った原稿から作る道がある')
    ok(/canPasteBody\(kind\)/.test(form), '貼れるかどうかを、判断1か所に任せている')
  }
}

/**
 * ============================================================================
 * ⑨ 教材を消す(2026-09 利用者の指定)
 *
 *   > また、ゲストに作った教材を消す方法を作って下さい。
 *   > 全ての場面にて「教材を消す」の機能を追加したいです。
 *   > トレーナーだけの機能です。ゲストには消せません
 *
 * **消せる人を1人でも増やしたら、それは事故である。**
 * 画面が間違えても RLS が断るが、**断られるまで気づけない**ので
 * ここで表そのものを見張る。
 * ============================================================================
 */
{
  console.log('\n▶ 教材を消す(誰が消せるか・何を伝えるか)')

  const mine = { id: 'm1', created_by: 't1' }
  const other = { id: 'm2', created_by: 't2' }
  const trainer = { id: 't1', role: 'trainer' }
  const owner = { id: 'o1', role: 'owner' }
  const guest = { id: 'g1', role: 'learner' }

  ok(canDeleteMaterial(mine, trainer), '作った本人は消せる')
  ok(!canDeleteMaterial(other, trainer), '人の教材は、トレーナーには消せない')
  ok(canDeleteMaterial(other, owner), '管理者は、人の教材でも消せる(0044)')
  ok(canDeleteMaterial(mine, owner), '管理者は、自分の教材も消せる')
  // **ゲストは、どうやっても消せない**(言われたことの中心)
  ok(!canDeleteMaterial(mine, guest) && !canDeleteMaterial(other, guest),
    'ゲストには消せない(自分あて・人のものとも)')
  ok(!canDeleteMaterial({ id: 'm3', created_by: 'g1' }, guest),
    '「自分が作ったこと」になっていても、ゲストには消せない')
  // **役割が分からないうちは出さない**(既定は見せない)
  ok(!canDeleteMaterial(mine, { id: 't1' }), '役割が分からなければ、消せない')
  ok(!canDeleteMaterial(null, trainer) && !canDeleteMaterial(mine, null),
    '何も渡されなくても落ちない')
  // **`created_by` を取ってこないと、自分の教材でもボタンが出ない**
  ok(!canDeleteMaterial({ id: 'm4' }, trainer),
    '`created_by` が無ければ、トレーナーには出さない(取り違えて消さない)')

  // 消す前の一文。**何が消えて、何が残るのかを書く**
  {
    const w0 = deleteWarning(0)
    const w3 = deleteWarning(3)
    const wNull = deleteWarning(null)
    ok(/3 人/.test(w3), '共有している人数を出す', w3)
    ok(/まだ誰にも/.test(w0), '0 人なら「まだ誰にも共有していない」と言う')
    /* **数えられなかったときを 0 と取り違えない。**
       「まだ誰にも共有していません」は、そのとき嘘になる */
    ok(!/まだ誰にも/.test(wNull), '数えられなければ、0 人とは言わない', wNull)
    ok(/元には戻せません/.test(w3), '元に戻せないことを、必ず書く')
    ok(/単語帳/.test(w3), '単語帳の語は消えないことを書く')
    /* **画面にそのまま出る文字列に、強調の記号を混ぜない**
       (場面の説明で実際にやってしまった) */
    ok(![w0, w3, wNull].some((x) => /\*\*/.test(x)),
      '強調の記号(**)が混ざっていない')
  }

  // **画面が、本当にこれを使っているか。** 定義だけあって誰も呼ばなければ同じ
  {
    const read = (f) => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8')
    const del = read('components/MaterialDelete.jsx')
    ok(/canDeleteMaterial\(material, me\)/.test(del),
      '部品が、消せるかどうかを判断1か所に任せている')
    ok(/if \(!canDeleteMaterial\(material, me\)\) return null/.test(del),
      '消せない人には、ボタンごと出さない(選ばせてから断らない)')
    ok(/deleteWarning\(shared\)/.test(del), '押したら、何が消えるかを出す')
    ok(/ask \? run\(\) : start\(\)/.test(del), '2段で押させる(押し間違いを受け止める)')
    ok(/materialShareCount\(material\.id\)/.test(del),
      '共有している人数を、押したときに数える')

    /* **置く場所は2つ**(教材の画面 / ゲストのカードの過去の宿題)。
       ゲストの「今週の宿題」には置かない —— あちらはゲストの画面である */
    for (const f of ['components/TrainerMaterials.jsx', 'components/TrainerLearners.jsx']) {
      ok(/<MaterialDelete/.test(read(f)), `${f.split('/').pop()} に置いてある`)
    }
    ok(!/MaterialDelete/.test(read('components/LearnerHomework.jsx')),
      'ゲストの「今週の宿題」には置いていない(ゲストには消せません)')

    /* **`created_by` を取ってこないと、宿題のカードでボタンが出ない。**
       画面もライブラリも lint を通るので、**開くまで分からない** */
    const lib = read('lib/materials.js')
    ok(/industry, genre, scene, created_by,/.test(lib),
      '過去の宿題の問い合わせが `created_by` を取ってきている')
    ok(/if \(!data\?\.length\)[\s\S]{0,200}消せません/.test(lib),
      'RLS の「0件」を、失敗として返している(成功と同じ見た目で終わらせない)')
  }

  /* **表の側も見張る。** 画面を直しても、ポリシーが無ければ管理者は消せない */
  {
    const sql = readFileSync(
      new URL('../supabase/migrations/0044_delete_material.sql', import.meta.url), 'utf8')
    ok(/for delete/.test(sql), '0044 が delete のポリシーを足している')
    ok(/using \(public\.is_owner\(\)\)/.test(sql), '足すのは管理者だけ(is_owner)')
    ok(!/is_trainer|is_admin/.test(sql.replace(/--.*$/gm, '')),
      'トレーナーには足していない(人の教材を消せない)')
  }
}

/**
 * ============================================================================
 * ⑩ 想定される質問(0045・2026-09 利用者の指定)
 *
 *   > 作成したスピーチに対して、聴衆から想定される質問を作る機能を
 *   > 実装して下さい。質問は、他の演習と同じように個数を5個、10個と
 *   > 選べるようにして下さい。
 *
 * **演習の種類を足す場所は4つある**(画面・窓口の指示・窓口の欄・表の制約)。
 * 1か所でも抜けると、**発行した瞬間に**止まるか、その演習だけ作られない。
 * `npm run lint` も `npm run build` も通るので、機械で見張る。
 * ============================================================================
 */
{
  console.log('\n▶ 想定される質問(スピーチの質疑)')

  const qa = EXERCISE_TYPES.find((t) => t.id === 'audience_qa')
  ok(!!qa, '演習の種類に「想定される質問」がある')
  ok(qa?.label === '想定される質問', '名前は「想定される質問」', qa?.label)
  /* **正解が無いので `answer` を持たない**(ディスカッションと同じ)。
     欄を出せば AI は必ず何かを書く */
  ok(!qa?.fields.includes('answer'), '解答の欄を持たない(正解が無い)')
  ok(qa?.fields.includes('question') && qa?.fields.includes('question_ja'),
    '質問と、その訳を持つ(訳が無いと質問そのものが壁になる)')
  ok(qa?.fields.includes('note'), '答え方の手がかり(日本語)を持つ')
  ok(qa?.audioFrom === 'question', '質問には読み上げが付く(質疑は聞き取りから始まる)')
  ok(!isPassageSection('audience_qa'), '本文の演習ではない(問で数える)')

  // **`note` が答えの側に来るのは、質問があって解答が無い演習だけ**
  ok(noteIsAnswer('audience_qa') && noteIsAnswer('discussion'),
    '想定される質問とディスカッションは、手がかりが答えの側に来る')
  ok(!noteIsAnswer('vocab_note'), '語句の補足は「答え」ではない(例文と使いどころ)')
  ok(!noteIsAnswer('comprehension') && !noteIsAnswer('article'),
    '解答のある演習・本文は、これまでどおり')

  // 5問 → 倍で 10問。**外すこともできる**
  {
    const of = (kind, amounts, include) => sectionsFor(kind, amounts, include)
      .find((s) => s.exercise_type === 'audience_qa')
    ok(of('speech')?.count === 5, '既定は5問')
    ok(of('speech', { audience_qa: 'double' })?.count === 10, '「倍」で10問')
    ok(!of('speech', null, { audience_qa: false }), 'チェックを外せば作らない')
    ok(SCALABLE_SECTIONS.includes('audience_qa'), '問数を選べる演習に入っている')
    ok(amountsFor('audience_qa').length === 2,
      '選べるのは標準と倍の2つ(3倍は文型ドリルだけ)')
  }

  /* **Speech練習だけに入れる。** 記事にも会話にも、話し終えたあとの聴衆はいない */
  {
    const has = (kind) => defaultSectionsFor(kind)
      .some((s) => s.exercise_type === 'audience_qa')
    ok(has('speech'), 'Speech練習には入っている')
    ok(!has('reading') && !has('dialogue') && !has('meeting') && !has('pattern'),
      'ほかの種類には入れていない(言われた場所だけを直す)')
    // 並びは「本文 → 内容の理解 → ディスカッション → 想定される質問 → 語句」
    const order = defaultSectionsFor('speech').map((s) => s.exercise_type)
    ok(order.indexOf('audience_qa') > order.indexOf('discussion')
      && order.indexOf('audience_qa') < order.indexOf('vocab_note'),
    '話し終えたあとに来るので、設問のうしろ・語句の前に置く', order.join(' → '))
  }

  // **足す場所は4つ。1か所でも抜けると、発行した瞬間に止まる**
  {
    const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')
    const gw = read('supabase/functions/generate-material/index.ts')
    ok(/audience_qa:\s*\n?\s*'想定される質問/.test(gw), '窓口に、書き方の指示がある')
    ok(/audience_qa:\s+\{ required: \['question', 'question_ja', 'note'\]/.test(gw),
      '窓口の欄に、解答が入っていない(strict で形を縛る)')
    ok(/sectionType === 'audience_qa'/.test(gw),
      '窓口が「本文が要る演習」として数えている(本文が無いと質問は作れない)')
    const sql = read('supabase/migrations/0045_audience_qa.sql')
    ok(/'comprehension', 'discussion', 'audience_qa', 'vocab_note'/.test(sql),
      '表の制約に入っている(0045)')
    /* **画面が本当に使っているか。** 定義だけあって誰も呼ばなければ、
       ディスカッションのときと同じで**手がかりがどこからも開けない** */
    const lv = read('src/components/LessonView.jsx')
    ok(/secNoteIsAnswer && it\.note/.test(lv),
      'レッスン表示が、手がかりを開けるようにしている')
    ok(/手がかりを見る/.test(lv), '「解答」と書かない(正解が無いものに解答は無い)')
  }

  /* **場面を足した**(利用者の指定「『プレゼン』などを追加して下さい」)。
     **上の17件は1つも消していない。** 声の名簿と同じで、
     知っている id を控えておかないと**黙って減っても気づけない** */
  {
    const KNOWN = [
      'sp_intro', 'sp_newjob', 'sp_standup', 'sp_progress', 'sp_proposal',
      'sp_product', 'sp_booth', 'sp_pitch', 'sp_conference', 'sp_training',
      'sp_townhall', 'sp_award', 'sp_toast', 'sp_farewell', 'sp_apology',
      'sp_interview', 'sp_talk',
      // ここから 2026-09 に足したプレゼンまわり
      'sp_deck', 'sp_demo', 'sp_kickoff', 'sp_result', 'sp_webinar', 'sp_handover',
    ]
    const ids = SPEECH_SCENES.map((s) => s.id)
    const gone = KNOWN.filter((id) => !ids.includes(id))
    ok(!gone.length, '知っている場面が1つも消えていない', gone.join(', '))
    ok(ids.length === KNOWN.length,
      `場面は ${KNOWN.length} 件(足したら KNOWN にも書き足す)`, `${ids.length} 件`)
    ok(ids.includes('sp_deck') && sceneLabel('sp_deck').includes('プレゼン'),
      '「プレゼン」がある', sceneLabel('sp_deck'))
    ok(new Set(ids).size === ids.length, '場面の id が重なっていない')
    ok(!SPEECH_SCENES.some((x) => /\*\*/.test(x.hint) || /\*\*/.test(x.label)),
      '足した場面にも、強調の記号(**)が混ざっていない')
  }
}

console.log(ng
  ? `\n❌ ${ng} 件が意図どおりではありません`
  : '\n✅ 止めた場所からの再生の検証は、すべて意図どおりです')
process.exit(ng ? 1 : 0)
