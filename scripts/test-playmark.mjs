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
import {
  QUIZ_FORMS, SESSION_SIZE, buildSession, formForBox, isSelfGraded, pickForm,
} from '../src/lib/wordQuiz.js'
import { clozeAt, hasCloze } from '../src/lib/clozeSentence.js'
import { hasMaterialWords, materialWordsOf } from '../src/lib/materialWords.js'
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
import { PLACES, PLACE_TO, nextPlace, placeFor } from '../src/lib/playerPlace.js'
import { clampPos } from '../src/lib/dragBox.js'
import {
  marksFromTimes, sentenceShares, sentenceTimesOf, wordSpans,
} from '../src/lib/wordTiming.js'
import { charTimesOf } from '../src/lib/wholeAudio.js'
import { lockDepth, lockScroll } from '../src/lib/scrollLock.js'
import { maxPieces, piecesOf, splitInto } from '../src/lib/focusChunks.js'
import { spanForRange } from '../src/lib/wholeAudio.js'
import { ABBREVIATIONS, splitSentences } from '../src/lib/wordTiming.js'
import {
  MATERIAL_PARAM, isEmailLike, mailtoFor, materialIdFromUrl, materialLinkFor,
  urlWithoutMaterial,
} from '../src/lib/materialLink.js'
import {
  DIALOGUE_ANGLES, READING_ANGLES, angleBrief, angleLabel, anglesFor, pickAngle,
} from '../src/data/materialAngles.js'
import {
  MATERIAL_KINDS, bodyWord, canPasteBody, isPassageKind, usesScene,
} from '../src/data/materialKinds.js'
import {
  COMMON_HOBBY_SPEECH_SCENES, DIALOGUE_SCENES, SPEECH_SCENES,
  genresFor, sceneLabel, scenesFor, speechScenesFor,
} from '../src/data/genres.js'
import {
  DEFAULT_SIZE, SCOPES, SIZES,
  QR_GROUPS, WORD_GROUPS, groupLead, isDueOn, qrGroupPool, qrTally, runKeyOf,
  scopeCounts, scopeLead, scopePool, shouldRecord, takeCount,
} from '../src/lib/reviewScope.js'
import {
  lastLearner, openLearner, rememberLearner, watchLearner,
} from '../src/lib/lastLearner.js'
import {
  BGM_PLACES, RADIO_MODES, bgmPlaysIn, bgmVolume, nextIndex, radioSteps,
} from '../src/lib/wordRadio.js'
import {
  applyHomeworkFilter, assignedDayOf, emptyHomeworkFilter,
  homeworkFilterOn, narrowHomework, topicOfAssignment,
} from '../src/lib/homeworkFilter.js'
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

/* ===========================================================================
 * ⑪ 話し方の型・面接の練習・ファッション(2026-09 利用者の指定)
 *
 *   > 著名人のスピーチなどを教材にできませんか?
 *   > 「面接の練習」を全ての業種に入れて下さい
 *   > 趣味に「ファッション」を追加
 *
 * **原稿そのものには著作権がある。** だから入れたのは「話し方の型」だけで、
 * 中身は AI が新しく書く。ここは**人の名前が混ざっていないこと**まで見る。
 * =========================================================================== */
{
  const { SPEECH_STYLES, speechStyleOf } =
    await import('../src/data/speechStyles.js')

  console.log('\n▶ ⑪ 話し方の型・面接の練習・ファッション')

  // ── 話し方の型 ──
  const sids = SPEECH_STYLES.map((s) => s.id)
  ok(sids[0] === '', '先頭は「指定しない」(選ばずに作れる道が残る)')
  ok(new Set(sids).size === sids.length, '型の id が重なっていない')
  ok(SPEECH_STYLES.length >= 10, '型がひととおりある', `${SPEECH_STYLES.length} 件`)
  ok(SPEECH_STYLES.every((s) => s.label && s.hint), 'どの型にも名前と説明がある')
  // **画面にそのまま出る文字列に、強調の書き方(**)を混ぜない**
  ok(!SPEECH_STYLES.some((s) => /\*\*/.test(s.label) || /\*\*/.test(s.hint)),
    '型の名前と説明に、強調の記号が混ざっていない')

  /* **実在の人物の名前を書かない。** 型は「どの世界の話し方か」で示す ——
     人名を入れると、その人の言葉をなぞらせることになる */
  const PEOPLE = ['ジョブズ', 'マスク', 'Jobs', 'Musk', 'ゲイツ', 'オバマ',
    'キング', 'ベゾス', 'Bezos', 'Obama']
  const named = SPEECH_STYLES.filter((s) =>
    PEOPLE.some((n) => `${s.label}${s.hint}`.includes(n)))
  ok(!named.length, '型に実在の人物の名前が入っていない',
    named.map((s) => s.label).join(' / '))

  ok(speechStyleOf('st_keynote')?.label, 'id から型を引ける')

  /* ── 場面と型は、互いに絞り込む(2026-09 実機・利用者の指摘)──
       > 業界IT→面接→ここで話の型に「社長のように」とかがあること自体
       > ナンセンスです。…シチュエーションから選ぼうと、話の型から
       > 選ぼうと同じです */
  {
    const { SCENE_STYLES, stylesForScene, scenesForStyle } =
      await import('../src/data/speechStyles.js')

    // **利用者が挙げた例そのもの**
    const ivStyles = stylesForScene('sp_interview').map((s) => s.id)
    ok(!ivStyles.includes('st_vision'),
      '面接に「創業者のように大きな絵を語る」は出ない')
    ok(ivStyles.includes('st_story'), '面接には、物語で語る型が出る')
    ok(ivStyles[0] === '', 'どの場面でも「指定しない」は残る(行き止まりを作らない)')
    ok(ivStyles.length < SPEECH_STYLES.length, '場面を選ぶと、型が減る',
      `${ivStyles.length} / ${SPEECH_STYLES.length}`)

    // **逆向きも同じように効く**(型から選んでも絞られる)
    const all = [...SPEECH_SCENES, ...COMMON_HOBBY_SPEECH_SCENES]
    const forVision = scenesForStyle(SPEECH_SCENES, 'st_vision').map((x) => x.id)
    ok(!forVision.includes('sp_interview'),
      '「創業者のように」を選ぶと、面接は場面から消える')
    ok(forVision.includes('sp_pitch'), '「創業者のように」に、ピッチは残る')
    ok(scenesForStyle(SPEECH_SCENES, '') === SPEECH_SCENES,
      '「指定しない」では、場面を1つも絞らない')

    // **知らない場面は絞らない**(足し忘れても行き止まりにならない)
    ok(stylesForScene('nope').length === SPEECH_STYLES.length,
      '対応表に無い場面では、型を絞らない')
    ok(scenesForStyle([], 'st_story').length === 0
      && scenesForStyle(SPEECH_SCENES, 'nope').length === SPEECH_SCENES.length,
      '当てはまる場面が無ければ、絞らずにそのまま出す')

    // **どの型も、どこかの場面から選べる**(型を足して書き忘れると埋もれる)
    const used = new Set(Object.values(SCENE_STYLES).flat())
    const orphan = SPEECH_STYLES.filter((s) => s.id && !used.has(s.id))
    ok(!orphan.length, 'どこからも選べない型が無い',
      orphan.map((s) => s.label).join(' / '))
    // **書き間違えた id が混ざっていないか**(混ざると黙って絞りすぎる)
    const known = new Set(SPEECH_STYLES.map((s) => s.id))
    const bad = [...used].filter((id) => !known.has(id))
    ok(!bad.length, '対応表に、知らない型の id が無い', bad.join(' / '))
    // **どの場面にも、指定しない以外の型が1つは残る**
    const empty = all.filter((x) => stylesForScene(x.id).length < 2)
    ok(!empty.length, 'どの場面にも、選べる型が1つ以上ある',
      empty.map((x) => x.label).join(' / '))

    // **画面が本当に絞っているか**(定義だけあって誰も呼ばなければ同じ)
    const form = readFileSync(
      new URL('../src/components/MaterialForm.jsx', import.meta.url), 'utf8')
    ok(/stylesForScene\(scene\)/.test(form), '作る画面が、場面で型を絞っている')
    ok(/scenesForStyle\(speechScenes, style\)/.test(form),
      '作る画面が、型で場面を絞っている')
    ok(/pickScene/.test(form) && /pickStyle/.test(form),
      '噛み合わなくなった選択を、その場で入れ替えている')
    // **話す中身は、話し方の型の下**(利用者の指定)
    const iStyle = form.indexOf('話し方の型(任意)')
    const iSubj = form.indexOf('話す中身(任意)')
    const iWho = form.indexOf('話し手(任意)\n')
    ok(iStyle > 0 && iSubj > iStyle, '話す中身の欄は、話し方の型の下にある')
    ok(iWho < 0 || iSubj < form.lastIndexOf('話し手(任意)'),
      '話し手より前にある(場面 → 型 → 中身 の流れ)')
    ok(/isPassageKind\(kind\) && kind !== 'speech'/.test(form),
      'スピーチでは、話題の欄を2か所に出さない')
  }
  ok(speechStyleOf('') === null && speechStyleOf('nope') === null,
    '知らない id では null を返す(落ちない)')

  // **窓口へ届いているか。** 届かなければ、選んでも何も変わらない
  const styled = speechBrief({ style: speechStyleOf('st_locker') })
  ok(/・話し方: /.test(styled), '型が、窓口へ渡す指定に入る')
  ok(/実在の人物の名前/.test(styled),
    '「実在の人物の言葉は使わない」と、必ず添えている')
  ok(!/・話し方:/.test(speechBrief({})), '選ばなければ、何も足さない')

  // **画面が本当に渡しているか**(定義だけあって誰も呼ばなければ同じである)
  {
    const form = readFileSync(
      new URL('../src/components/MaterialForm.jsx', import.meta.url), 'utf8')
    ok(/speechStyleOf\(style\)/.test(form), '作る画面が、選んだ型を渡している')
    ok(/styleList\.map/.test(form), '作る画面が、型の一覧を出している')
    ok(/script, who, style,/.test(form),
      '別の画面から戻っても、選んだ型が残る(控えに入っている)')
  }

  // ── 面接の練習(どの業種にも出る) ──
  const dids = DIALOGUE_SCENES.map((x) => x.id)
  ok(dids.includes('jobinterview'), '「面接の練習」が共通の場面にある')
  for (const ind of ['it', 'manufacturing', 'surgery', '']) {
    const has = scenesFor(ind).some((x) => x.id === 'jobinterview')
    ok(has, `${ind || '(分野なし)'} でも面接の練習が出る`)
  }
  ok(sceneLabel('jobinterview') === '面接の練習', '面接の練習の名前を引ける')

  // ── ファッション ──
  {
    const { INDUSTRIES, industriesIn, industryLabel } =
      await import('../src/data/industries.js')
    ok(industriesIn('hobby').some((i) => i.id === 'fashion'),
      '趣味の一覧にファッションがある')
    ok(industryLabel('fashion') === 'ファッション', 'ファッションの名前を引ける')
    // **一度入れた業種・趣味を減らさない**(CLAUDE.md・プロジェクトを超えた決まり)
    ok(INDUSTRIES.filter((i) => (i.group ?? 'work') === 'hobby').length >= 25,
      '趣味の数が減っていない',
      `${INDUSTRIES.filter((i) => (i.group ?? 'work') === 'hobby').length} 件`)
    ok(scenesFor('fashion').some((x) => x.id.startsWith('fas_')),
      'ファッションに、その分野の場面がある')
    ok(genresFor('fashion').some((x) => x.id.startsWith('fasg_')),
      'ファッションに、その分野の話題がある')
    // 趣味なので、仕事の共通場面(交渉)ではなく趣味の共通場面が付く
    ok(scenesFor('fashion').some((x) => x.id === 'hob_gear'),
      'ファッションには、趣味の共通場面が付く')
  }
}

/* ============================================================================
   ⑫ 書いた答えの添削(2026-09 利用者の指定)

     > ディスカッションや質問に対する回答をライティングで記入できるように
     > してください。その記入した内容を添削する機能を…
     > フィードバック内の単語やフレーズは単語帳に登録できる。
     > 文章ごと、または回答全てもそのままクイックレスポンスに登録し、
     > 自動的に文章ごとに分けてくれる。
     > また、添削の仕方の指定もスーパーカジュアル、カジュアル、
     > ビジネスカジュアル、ビジネスで選べると良いですね

   **窓口の置き直しが要る仕組みなので、渡す道が1本でも切れると
   「押しても何も起きない」になる。** しかも `npm run lint` にも
   `npm run build` にも引っかからない。だから機械的に見張る。
   ============================================================================ */
{
  console.log('\n── ⑫ 書いた答えの添削 ──')
  const { DEFAULT_TONE, WRITING_TONES, writingToneOf } =
    await import('../src/data/writingTones.js')
  const {
    MAX_WRITING_CHARS, isBlankAnswer, normalizeReview, phraseKind,
    reviewPairs, reviewText, seenSentenceFor, toneBrief, tooLongAnswer,
  } = await import('../src/lib/writingReview.js')

  // ── 調子は、利用者が挙げた4つ。並びも変えない ──
  const want = ['スーパーカジュアル', 'カジュアル', 'ビジネスカジュアル', 'ビジネス']
  ok(WRITING_TONES.length === 4, '調子は4つ', `${WRITING_TONES.length} 件`)
  ok(WRITING_TONES.map((t) => t.label).join('/') === want.join('/'),
    '利用者が挙げた4つが、その並びで入っている',
    WRITING_TONES.map((t) => t.label).join('/'))
  for (const t of WRITING_TONES) {
    // `hint` は `<option>` にそのまま出る。Markdown として解釈されない
    ok(!/\*\*/.test(`${t.label}${t.hint}`),
      `${t.label}: 画面に出す文字列に ** を混ぜていない`)
    ok(Boolean(t.brief), `${t.label}: 窓口へ渡す指定がある`)
  }
  // **知らない id で落ちない。** 既定に落とす(行き止まりを作らない)
  ok(writingToneOf('nope')?.id === DEFAULT_TONE, '知らない id では既定に落ちる')
  ok(WRITING_TONES.some((t) => t.id === DEFAULT_TONE), '既定の調子が一覧にある')
  ok(/カジュアル/.test(toneBrief('casual')) && toneBrief('casual').length > 20,
    '調子は、窓口へ渡す1文になる')

  // ── 添削の結果のそろえ方 ──
  ok(normalizeReview(null) === null, '空の結果は null(成功として扱わない)')
  ok(normalizeReview({ sentences: [] }) === null,
    '直した英文が0件なら null(中身が0件のまま「成功」を返さない)')
  {
    const r = normalizeReview({
      sentences: [
        { en: 'I think remote work helps.', ja: 'リモートワークは役に立つと思います。' },
        { en: 'It saves time.', ja: '' },
        { en: '', ja: '捨てられる' },
      ],
      notes: [{ before: 'helps to', after: 'helps', why: 'help のあとに to は要らない' },
        { before: 'x', after: 'y', why: '' }],
      phrases: [{ en: 'save time', ja: '時間を節約する' },
        { en: 'Save Time', ja: '重なり' },
        { en: 'no ja', ja: '' }],
      good: '言いたいことがはっきりしています。',
    })
    ok(r.sentences.length === 2, '英文の無い文は落とす', `${r.sentences.length} 件`)
    ok(r.notes.length === 1, '理由の無い直しは落とす', `${r.notes.length} 件`)
    ok(r.phrases.length === 1, '同じ語句を二度出さない・訳の無い語句は落とす',
      JSON.stringify(r.phrases))
    // **訳の無い文は Quick Response に入れない**(日本語を見て英語を言う練習)
    ok(reviewPairs(r).length === 1, '訳の無い文は Quick Response に入れない',
      `${reviewPairs(r).length} 件`)
    ok(reviewText(r) === 'I think remote work helps. It saves time.',
      '画面に出す英文は、文の配列からしか作らない')
    // **単語帳の「出会った文」** は、その語句が出てくる1文
    ok(seenSentenceFor(r, 'save') === 'It saves time.',
      'その語句が出てくる1文を、出会った文にする', seenSentenceFor(r, 'save'))
    ok(seenSentenceFor(r, 'zzz') === reviewText(r),
      '見つからなければ、つないだ英文を返す(空にしない)')
  }
  ok(phraseKind('save time') === 'phrase' && phraseKind('resilient') === 'word',
    '空白を含めば言い回し(WordbookAdd と同じ判定)')
  ok(isBlankAnswer('   ') && !isBlankAnswer('hi'), '空白だけは「書いていない」')
  ok(!tooLongAnswer('a'.repeat(MAX_WRITING_CHARS))
    && tooLongAnswer('a'.repeat(MAX_WRITING_CHARS + 1)),
  `${MAX_WRITING_CHARS} 文字までは通り、超えたら断る`)

  // ── 画面が本当に呼んでいるか(定義だけあって誰も呼ばなければ同じ)──
  {
    const view = readFileSync(
      new URL('../src/components/LessonView.jsx', import.meta.url), 'utf8')
    ok(/<WritingAnswer/.test(view), 'レッスン表示が、書く欄を出している')
    ok(/secNoteIsAnswer && \(\s*<WritingAnswer/.test(view),
      'ディスカッションと想定される質問だけに出している(noteIsAnswer)')
    ok(/learnerId=\{learnerId\}/.test(view),
      '誰の記録になるかを渡している(0025)')
  }

  // ── 走らせられるのは、トレーナーと管理者だけ ──
  {
    const { canAskReview } = await import('../src/lib/writingReview.js')
    const { setViewerRole } = await import('../src/lib/viewer.js')
    for (const [role, want] of [
      [null, false], ['learner', false], ['trainer', true], ['owner', true],
    ]) {
      setViewerRole(role)
      ok(canAskReview() === want,
        `${role ?? '(役割が分からない)'} は添削を${want ? '走らせられる' : '走らせられない'}`)
    }
    setViewerRole(null)
    const w = readFileSync(
      new URL('../src/components/WritingAnswer.jsx', import.meta.url), 'utf8')
    // **画面が判断を持たない。** 持つと、置く場所の数だけ食い違う
    ok(/canAskReview\(\)/.test(w), '画面が canAskReview() に任せている')
    ok(!/viewerRoleOf\(\)/.test(w), '画面の中で役割を数え直していない')
    ok(/mayAsk \?/.test(w), 'ゲストには、添削のボタンそのものを出さない')
    ok(/トレーナーに届きます/.test(w),
      '書いたものがどこへ行くのかを、ゲストに伝えている')
  }
  {
    const w = readFileSync(
      new URL('../src/components/WritingAnswer.jsx', import.meta.url), 'utf8')
    ok(/useProgress\(/.test(w), '書いたものを material_progress に残している')
    ok(/markQr\(/.test(w), 'Quick Response に入れられる')
    ok(/setWordStatus\(/.test(w) && /lookupWord\(/.test(w),
      '単語帳に入れられる(意味も1回だけ引く)')
    ok(/REVIEW_COST_YEN/.test(w),
      '費用を画面に出している(見えない費用は管理できない)')
  }

  // ── 窓口(generate-material)へ、道が通っているか ──
  {
    const fn = readFileSync(
      new URL('../supabase/functions/generate-material/index.ts', import.meta.url), 'utf8')
    ok(/mode === 'review_writing'/.test(fn), '窓口が、添削の頼みごとを受けている')
    ok(/reviewWriting\(apiKey, body\)/.test(fn), '窓口が、添削を実際に走らせている')
    ok(/emit_writing_review/.test(fn), '形は道具で強制している(strict)')
    for (const f of ['sentences', 'notes', 'phrases', 'good']) {
      ok(new RegExp(`required: \\[[^\\]]*'${f}'`).test(fn)
        || new RegExp(`'${f}'`).test(fn), `道具に ${f} がある`)
    }
    /* **ゲストは添削を走らせられない**(2026-09 利用者の指定・方針の変更)。
       道は残してあるが、Secrets を足したときだけ開く。**既定は閉じている** */
    ok(/LEARNER_WRITING_REVIEW/.test(fn),
      'ゲストへ開く道が、Secrets 1つで切り替えられる形で残っている')
    ok(/const forLearner = mode === 'review_writing' && LEARNER_REVIEW/.test(fn),
      '既定では開かない(Secrets が無ければゲストは通らない)')
    ok(/forLearner \? \['learner', 'trainer', 'owner'\] : \['trainer', 'owner'\]/.test(fn),
      '開いていないときは、トレーナーと管理者だけ')
    // **ゲストに仕組みの内側を見せない**(CLAUDE.md)
    ok(/添削はトレーナーが行います/.test(fn),
      '断り方が、ゲストにも意味の分かる文になっている')
    ok(/status !== 'active'/.test(fn), 'やめた人は、どの頼みごとも呼べない')
    ok(/slice\(0, 1500\)/.test(fn), '窓口でも長さを切っている(最後の関所)')

    // **版がそろっているか。** ずれると「窓口が古い」を出せない
    const fnRev = /const FN_REV = '([^']+)'/.exec(fn)?.[1]
    const mats = readFileSync(
      new URL('../src/lib/materials.js', import.meta.url), 'utf8')
    const need = /NEED_GEN_REV = '([^']+)'/.exec(mats)?.[1]
    ok(Boolean(fnRev) && fnRev === need,
      '窓口の版と、画面が求める版がそろっている', `窓口 ${fnRev} / 画面 ${need}`)
    ok(/mode: 'review_writing'/.test(mats), '画面が、添削を頼む道を持っている')
    ok(/export async function reviewWriting\(/.test(mats),
      '添削を頼む窓口の呼び方が、materials.js にある')
  }
}

// ────────────────────────────────────────────────────────────────
// 話の切り口(0046・2026-09 利用者の指定)
//
//   > 全て同じ条件で教材を作成した時に過去の内容に被らないものを
//   > 作成できるシステムである必要があります。似たようなシチュエーションと
//   > いうのも避けたいです。選んだシチュエーションや場面が同じでも、
//   > 全然違う感じになって欲しいわけです。
//
//   **Sonnet 5 は `temperature` を指定できない**ので、ばらつきは
//   出力の側では作れない。**入力そのものを毎回変えるしかない。**
//   ここが黙って効かなくなると、**教材は普通にできあがるので誰も気づけない。**
// ────────────────────────────────────────────────────────────────
{
  console.log('\n── 話の切り口(似た教材を作らない)──')

  /* **知っている切り口を控える**(声の名簿と同じ考え方)。
     1つでも消えたら赤くなる。**足したらここにも書き足す**ので、
     必ず1回は自分の目で数えることになる */
  const KNOWN = {
    reading: ['an_success', 'an_failure', 'an_numbers', 'an_debate', 'an_day',
      'an_thennow', 'an_myth', 'an_small', 'an_abroad', 'an_next'],
    dialogue: ['an_split', 'an_ask', 'an_badnews', 'an_undecided', 'an_mixup',
      'an_first', 'an_deadline', 'an_report', 'an_decline', 'an_handover'],
  }
  for (const [name, list] of [['記事', READING_ANGLES], ['会話', DIALOGUE_ANGLES]]) {
    const ids = list.map((a) => a.id)
    const want = name === '記事' ? KNOWN.reading : KNOWN.dialogue
    for (const id of want) ok(ids.includes(id), `${name}の切り口が残っている: ${id}`)
    ok(ids.length === new Set(ids).size, `${name}の切り口に、同じ id が2つない`)
    for (const a of list) {
      // **`hint` は `<option>` にそのまま出る。** Markdown にはならない
      ok(!/\*\*/.test(`${a.label}${a.hint}`),
        `${a.id} の名前と説明に、強調の書き方が混ざっていない`)
      // **窓口へ渡すのは `brief`。** 空だと、切り口を選んでも何も効かない
      ok(a.brief && a.brief.length > 10, `${a.id} に、窓口へ渡す指定がある`)
    }
  }

  // **種類で分ける。`kind === 'dialogue'` と書くと会議で抜ける**
  ok(anglesFor('reading') === READING_ANGLES, '記事には記事の切り口が出る')
  ok(anglesFor('dialogue') === DIALOGUE_ANGLES, '会話には会話の切り口が出る')
  ok(anglesFor('meeting') === DIALOGUE_ANGLES, '**会議にも**会話の切り口が出る')
  // **スピーチには出さない**(話し方の型がその役をしている)
  ok(anglesFor('speech').length === 0, 'スピーチには切り口を出さない(話し方の型がある)')
  ok(anglesFor('word').length === 0, '単語の教材には切り口を出さない')

  // **まだ使っていないものから引く。** ここが効かないと、
  // おまかせが同じ切り口を続けて引き、似た教材が量産される
  {
    const used = DIALOGUE_ANGLES.slice(0, 9).map((a) => a.id)
    const got = pickAngle('dialogue', used, () => 0.5)
    ok(got?.id === DIALOGUE_ANGLES[9].id,
      'まだ使っていない切り口から引く', `引いたのは ${got?.id}`)
  }
  {
    // **使い切ったら、また全部から引く**(行き止まりを作らない)
    const all = DIALOGUE_ANGLES.map((a) => a.id)
    const got = pickAngle('dialogue', all, () => 0)
    ok(got != null, '全部使い切っても、行き止まりにならない')
  }
  ok(pickAngle('speech', [], () => 0) === null, 'スピーチでは切り口を引かない')
  // **端でも落ちない**(1 を返す乱数で、配列の外に出ない)
  ok(pickAngle('reading', [], () => 0.999999) != null, '端の値でも切り口を引ける')

  // 窓口へ渡す文。**名前と指定の両方が入る**
  {
    const brief = angleBrief('an_badnews')
    ok(brief.includes('悪い知らせ') && brief.length > 20,
      '窓口へ渡す文に、名前と指定の両方が入っている')
    ok(angleBrief('') === '', '切り口を選んでいなければ、何も渡さない')
    ok(angleBrief('an_nothing') === '', '知らない id では、何も渡さない')
    ok(angleLabel('an_split') === '意見が割れる', 'id から名前を引ける')
    ok(angleLabel('an_nothing') === 'an_nothing', '知らない id は、そのまま返す')
  }

  // ── 画面が本当に呼んでいるか ──
  //   **定義だけあって誰も呼ばなければ、いまと同じことになる**
  //   (`noteFnRev` を定義だけして呼んでいなかったのと同じ落とし穴)
  {
    const form = readFileSync(
      new URL('../src/components/MaterialForm.jsx', import.meta.url), 'utf8')
    ok(/pickAngle\(kind, past\.map/.test(form),
      '画面が、まだ使っていない切り口から引いている')
    ok(/angle: angleBrief\(angleId\)/.test(form), '画面が、切り口を窓口へ渡している')
    ok(/loadRecentStories\(likeQuery\(\)\)/.test(form),
      '画面が、同じ組み合わせの過去の話を引いている')
    ok(/avoidTopics: past\.map/.test(form), '画面が、過去の話を窓口へ渡している')
    ok(/angle: usedAngle \|\| angle, gist/.test(form),
      '実際に使った切り口と筋を保存している')
    // **タグが無い記事・会話でも、英文を渡す**(0046 で塞いだ穴)
    ok(/loadUsedSentencesLike\(likeQuery\(\)\)/.test(form),
      '弱点タグが無いときも、同じ組み合わせの英文を避けさせている')
    ok(/countMaterialsLike\(likeQuery\(\)\)/.test(form),
      '作る前に「もう何本あるか」を数えている')
    // **入力の切り口を、使った切り口で上書きしない**
    // (上書きすると「作り直す」で同じ切り口に固定される)
    ok(/setUsedAngle\(r\.angle \?\? ''\)/.test(form),
      '実際に使った切り口は、入力とは別に持っている')
  }

  // ── 窓口が受け取っているか ──
  {
    const fn = readFileSync(
      new URL('../supabase/functions/generate-material/index.ts', import.meta.url), 'utf8')
    ok(/const avoidTopics = /.test(fn), '窓口が、避ける話を受け取っている')
    ok(/const angle = String\(body\.angle/.test(fn), '窓口が、切り口を受け取っている')
    ok(/すでにある話/.test(fn), '窓口が、避ける話を指示に入れている')
    ok(/切り口\(この角度から書くこと\)/.test(fn), '窓口が、切り口を指示に入れている')
    // **具体を先に決めさせる。** 一般論が、いちばん量産っぽく読める
    ok(/一般論で書き出さない/.test(fn), '窓口が、一般論で書き出さないよう言っている')
    ok(/実在の人物・企業・商品の名前は使わない/.test(fn),
      '窓口が、実在の名前を使わないよう言っている')
    // **何の話だったかを書かせる。** 次に避けさせる材料になる
    ok(/props\.gist = \{/.test(fn), '道具に「何の話か」の欄がある')
    ok(/required\.push\('gist'\)/.test(fn), '「何の話か」は必須にしてある')
    ok(/gist: result\.gist/.test(fn), '窓口が、それを返している')
  }

  // ── 貼る SQL がそろっているか ──
  //   **移行を足したのに `check.sql` に足し忘れると、
  //   本当は足りないのに「全部 ✅」と出る**(いちばん悪い壊れ方)
  {
    const matome = readFileSync(
      new URL('../supabase/apply/pending_matome.sql', import.meta.url), 'utf8')
    const check = readFileSync(
      new URL('../supabase/apply/check.sql', import.meta.url), 'utf8')
    ok(/add column if not exists gist/.test(matome), 'まとめた1つに 0046 が入っている')
    ok(/column_name = 'gist'/.test(check), 'check.sql が 0046 を見ている')
  }
}


/* ══════════════════════════════════════════════════════════════════
   単語帳の「穴埋め」(0047・2026-09 利用者の指定)

     > ２つ目のトレーニングに穴埋めがあったり、３つ目が日→英になっていたり、
     > そういう仕組みで単語が覚えられるような仕組みにしたいです。

   **材料は出会った文(`seen_in`・0018)をそのまま伏せるだけ**なので、
   AI を1回も呼ばない = 費用は1円もかからない。
   間違えても `npm run lint` にも `npm run build` にも引っかからず、
   しかも**その語が出るまで分からない**ので、ここで数字で見張る。
   ══════════════════════════════════════════════════════════════════ */
console.log('\n▶ 穴埋め — 出会った文の、その語だけを伏せる')
{
  const S = 'The new intern stayed quiet during the internal meeting.'
  const hit = clozeAt(S, 'intern')
  ok(!!hit, '語が見つかる')
  ok(hit && hit.hit === 'intern', '当たったのは intern そのもの', hit?.hit)
  /* **`indexOf` で探さない。** `in` が `internal` の中に当たると
     `___ternal` になり、問題として成り立たない */
  ok(clozeAt('This is an internal memo.', 'in') === null,
    '語の途中には当たらない(internal の in を拾わない)')
  ok(clozeAt(S, 'INTERN')?.hit === 'intern', '大文字小文字は見ない')
  // 句(2語以上)でも当たる。空白が2つでも改行でも受ける
  ok(clozeAt('We look  forward\nto it.', 'look forward to')?.hit === 'look  forward\nto',
    '句でも当たる(空白や改行が違っていても)')
  // ハイフンの語を、途中で切らない
  ok(clozeAt('A well-known case.', 'well') === null, 'well-known の途中では切らない')
  // **見つからなければ、何も返さない**(当てずっぽうで伏せない)
  ok(clozeAt(S, 'quarterly') === null, '無い語では何も返さない')
  ok(clozeAt('', 'intern') === null && clozeAt(S, '') === null, '空でも落ちない')

  ok(hasCloze({ seen_in: S, display: 'intern' }), '出会った文があれば作れる')
  ok(!hasCloze({ seen_in: null, display: 'intern' }), '出会った文が無ければ作れない')
  ok(!hasCloze({ seen_in: S, display: 'quarterly' }), '文の中に無ければ作れない')

  // ── 箱ごとの形。**段が飛ばないこと** ──
  ok(formForBox(0) === 'choice' && formForBox(1) === 'choice', '箱0〜1 は4択')
  ok(formForBox(2) === 'recall', '箱2 は思い出す')
  ok(formForBox(3) === 'cloze', '箱3 は穴埋め')
  ok(formForBox(4) === 'ja2en' && formForBox(5) === 'ja2en', '箱4〜5 は日本語 → 英語')
  ok(formForBox(6) === 'spell', '箱6 はつづり')
  ok(QUIZ_FORMS.some((f) => f.id === 'cloze'), '選べる形の一覧にも入っている')

  /* **出会った文が無い語では「思い出す」に落ちる。**
     0047 で単語帳に入れた語には、出会った文が無い */
  ok(pickForm({ box: 3, seen_in: S, display: 'intern', meaning_ja: '研修生' }, [])
     === 'cloze', '文があれば穴埋めで出る')
  ok(pickForm({ box: 3, seen_in: null, display: 'intern', meaning_ja: '研修生' }, [])
     === 'recall', '文が無ければ思い出すに落ちる(行き止まりを作らない)')

  /* **自分で答え合わせをする形。** ここが
     「カードを画面いっぱいに伸ばすか」も決めている(`wordcard--recall`) */
  ok(isSelfGraded('cloze'), '穴埋めは自分で答え合わせをする形')
  ok(!isSelfGraded('choice') && !isSelfGraded('spell'),
    '4択とつづりは機械が判定する(伸ばさない)')

  // **画面が本当に使っているか。** 定義だけあって誰も呼ばなければ、何も起きない
  const wb = readFileSync(
    new URL('../src/components/Wordbook.jsx', import.meta.url), 'utf8')
  ok(/from '\.\.\/lib\/clozeSentence\.js'/.test(wb), '単語帳が clozeSentence を読んでいる')
  ok(/<ClozeFace sentence=\{card\.seen_in\}/.test(wb), '穴埋めのカードを描いている')
  /* **「出会った文」の箱を、穴埋めでは出さない。**
     出すと同じ文が2つ並び、しかもそちらには答えが見えている */
  ok(/card\.seen_in && form !== 'cloze' && \(/.test(wb),
    '穴埋めでは「出会った文」の箱を出さない')
  // **探し方を2つ持たない**(`SeenIn` も同じ道具を通る)
  ok(/const found = clozeAt\(sentence, word\)/.test(wb),
    '「出会った文」の伏せ方も、同じ道具を通っている')
}

/* ══════════════════════════════════════════════════════════════════
   単語 / フレーズを1つの種類にまとめる(0047)
   ══════════════════════════════════════════════════════════════════ */
console.log('\n▶ 単語 / フレーズ — 1つの種類にまとめる')
{
  ok(MATERIAL_KINDS.some((k) => k.id === 'vocab'), '教材の種類に「単語 / フレーズ」がある')
  // **旧い2つを消さない。** 消すと、その種類で作った教材の呼び名が出なくなる
  ok(MATERIAL_KINDS.some((k) => k.id === 'word' && k.legacy),
    '旧「単語」は残っている(新しくは作れない)')
  ok(MATERIAL_KINDS.some((k) => k.id === 'phrase' && k.legacy),
    '旧「フレーズ」は残っている(新しくは作れない)')

  const secs = defaultSectionsFor('vocab')
  ok(secs.length === 2, '演習は2つ(単語とフレーズ)', `${secs.length} 個`)
  ok(secs[0].exercise_type === 'vocabulary' && secs[0].count === 10, '単語10問')
  ok(secs[1].exercise_type === 'phrase' && secs[1].count === 10, 'フレーズ10問')

  /* **片方だけにも戻せる。** 外したうえで「倍」を選べば、
     もとの「単語20問」とまったく同じになる(こちらで勝手に減らさない) */
  ok(SCALABLE_SECTIONS.includes('vocabulary') && SCALABLE_SECTIONS.includes('phrase'),
    '単語もフレーズも、数を変えられて外せる')
  const only = sectionsFor('vocab', { vocabulary: 'double' }, { phrase: false })
  ok(only.length === 1 && only[0].exercise_type === 'vocabulary' && only[0].count === 20,
    'フレーズを外して「倍」にすると、もとの単語20問と同じになる')
  // **3倍は文型ドリルだけ**(弱点が3つまで選べるため)
  ok(!amountsFor('vocabulary').some((a) => a.id === 'triple'),
    '単語に3倍は出さない(3倍は文型ドリルだけ)')
}

/* ══════════════════════════════════════════════════════════════════
   共有したら、その教材の語がゲストの単語帳に入る(0047)
   ══════════════════════════════════════════════════════════════════ */
console.log('\n▶ 共有したら、語が単語帳に入る')
{
  const mat = readFileSync(
    new URL('../src/lib/materials.js', import.meta.url), 'utf8')
  ok(/rpc\('add_material_words'/.test(mat), '窓口(SQL の関数)を呼んでいる')
  // **共有したときに必ず呼ぶ。** 定義だけあって誰も呼ばなければ何も起きない
  ok(/await addMaterialWords\(\{ materialId, learnerIds \}\)/.test(mat),
    '共有したときに呼んでいる')
  /* **数えられなかったら `null`。** 0 と取り違えると
     「1語も入りませんでした」という嘘の説明になる */
  ok(/if \(error\) return ok\(null\)/.test(mat), '数えられなかったら null(0 にしない)')
  ok(/Number\(words\) > 0 \? ` 単語帳に \$\{words\} 語入れました。` : ''/.test(mat),
    '文言は1か所(wordsAddedNote)')

  // **出す場所は3つ。** 書き写すと、必ずどこかが黙ったままになる
  for (const [f, what] of [
    ['../src/components/TrainerMaterials.jsx', 'さがす画面'],
    ['../src/components/MaterialForm.jsx', '教材を作る画面'],
    ['../src/components/TrainerLearners.jsx', 'ゲストの画面'],
  ]) {
    const src = readFileSync(new URL(f, import.meta.url), 'utf8')
    ok(/wordsAddedNote|addedWords/.test(src), `${what} が、入った語数を伝えている`)
  }

  // ── 貼る SQL がそろっているか ──
  const matome = readFileSync(
    new URL('../supabase/apply/pending_matome.sql', import.meta.url), 'utf8')
  const check = readFileSync(
    new URL('../supabase/apply/check.sql', import.meta.url), 'utf8')
  ok(/create or replace function public\.add_material_words/.test(matome),
    'まとめた1つに 0047 が入っている')
  ok(/'vocab',/.test(matome), 'まとめた1つが、教材の種類に vocab を足している')
  ok(/proname = 'add_material_words'/.test(check), 'check.sql が 0047 を見ている')
}


/* ══════════════════════════════════════════════════════════════════
   届いた語に、ゲストが気づけるか(0047・2026-09 利用者の指摘)

     > 単語・フレーズの宿題をアサインされたことがゲスト側でわかるように
     > し、とりあえずその単語とフレーズだけに取り組めるよう(任意)に
     > しないと、今のままでは何も気づかない

   共有した語は単語帳に入っていたが、**ゲストの画面には1文字も
   出していなかった。**「黙って入れない」を、こちら側で破っていた。
   ══════════════════════════════════════════════════════════════════ */
console.log('\n▶ 届いた語に、ゲストが気づけるか')
{
  const mat = {
    kind: 'vocab',
    sections: [
      { exercise_type: 'vocabulary', items: [
        { prompt_en: 'Shortfall', prompt_ja: '不足' },
        { prompt_en: 'Backlog', prompt_ja: '積み残し' },
        // 同じ語が2度並んでいても、単語帳では1行になる
        { prompt_en: 'shortfall', prompt_ja: '不足' },
        { prompt_en: '   ', prompt_ja: '空の問' },
      ] },
      { exercise_type: 'phrase', items: [
        { prompt_en: 'take it offline', prompt_ja: 'この場では決めない' },
      ] },
      // **本文は語句ではない。** 段落を語として入れない
      { exercise_type: 'article', items: [{ prompt_en: 'A long paragraph.' }] },
    ],
  }
  const words = materialWordsOf(mat)
  ok(words.length === 3, '語句だけを、重複を除いて拾う', `${words.length} 個`)
  ok(words.every((w) => w.en.trim()), '空の問は拾わない')
  ok(words.find((w) => w.en === 'take it offline')?.kind === 'phrase',
    'フレーズは phrase として拾う')
  ok(words.find((w) => w.en === 'Shortfall')?.kind === 'word', '単語は word')
  ok(!materialWordsOf({ sections: [{ exercise_type: 'article', items: [{ prompt_en: 'x' }] }] })
    .length, '記事からは1語も拾わない(vocab_note も入れない)')
  ok(materialWordsOf(null).length === 0, '教材が無くても落ちない')
  ok(hasMaterialWords(mat) && !hasMaterialWords({ sections: [] }), '行を出すかの判断も1か所')

  /* **画面が本当に使っているか。** 定義だけあって誰も呼ばなければ、
     いまと同じ「何も気づかない」に戻る */
  const hw = readFileSync(
    new URL('../src/components/LearnerHomework.jsx', import.meta.url), 'utf8')
  ok(/materialWordsOf\(a\.material\)/.test(hw), '今週の宿題が、その教材の語句を数えている')
  /* **教材の項目数を、そのまま「入りました」と書かない。**
     0047 を貼る前は1語も入っていないので、嘘になる */
  ok(/wordStatuses\.has\(n\)/.test(hw), '数えるのは自分の単語帳(教材の項目数ではない)')
  ok(/if \(!inBook\.length\) return null/.test(hw), '1語も入っていなければ黙る(0 と書かない)')
  ok(/この教材の語だけ練習する/.test(hw), 'その語だけ練習する道がある')

  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
  ok(/onPracticeWords=\{/.test(app), 'App が受け取っている')
  ok(/setView\('wordbook'\)/.test(app), '押したら単語帳へ移る')
  ok(/only=\{onlyWords\?\.words/.test(app), '単語帳へ、その語を渡している')
  ok(/onClearOnly=\{\(\) => setOnlyWords\(null\)\}/.test(app),
    '単語帳ぜんぶに戻す道がある(行き止まりを作らない)')

  const wb = readFileSync(new URL('../src/components/Wordbook.jsx', import.meta.url), 'utf8')
  /* **絞るのは読み込んだ直後の1か所。** 画面のあちこちで絞り直すと、
     出題・4択・数え上げのどれかが必ず食い違う */
  ok(/onlySet\s*\n?\s*\?\s*\(list\.data \?\? \[\]\)\.filter/.test(wb),
    '絞るのは読み込んだ直後の1か所')
  /* **期限で切らない。** 20語のうち今日出るのが2語では、練習にならない。
     2026-09 に**範囲の札**を入れたので、`narrowed` ではなく
     **範囲を「ぜんぶ」にする**という形で同じことをしている */
  ok(/setScope\(onlySet \? 'all' : loadScope\('word'\)\)/.test(wb),
    'その語だけのときは、期限で切らない(範囲を「ぜんぶ」にする)')
}

/* ══════════════════════════════════════════════════════════════════
   読み上げの操作盤を、どこに置くか(2026-09 利用者の指定)

     > いっそのこと画面の下部に黒帯にした中に固定にした方が
     > スタイリッシュな気がします。パッドでもデフォルトは同じ仕様で、
     > 任意でフロート型にして移動できるように。PCの画面でもフロートに
     > した時は端っこにドラッグできる部分を作って移動させれるように

   **判断は `playerPlace.js` 1か所。** 画面に持たせると、
   出す場所の数だけ食い違う(`remakeModeOf()` と同じ考え方)。
   ══════════════════════════════════════════════════════════════════ */
{
  console.log('\n── 操作盤の置き場所 ──')
  ok(PLACES.length === 3, '置き場所は3つ(上の帯 / 画面の下 / 浮かせる)')
  // **狭い窓に「上の帯」は無い**(1行に収まらない)。既定は画面の下
  ok(placeFor('bar', false) === 'dock', '狭い窓では、上の帯を選んでいても画面の下')
  ok(placeFor('dock', false) === 'dock', '狭い窓の既定は画面の下')
  ok(placeFor('float', false) === 'float', 'パッドでは、浮かせるも選べる')
  ok(placeFor('bar', true) === 'bar', '広い窓では、上の帯のまま')
  ok(placeFor(null, true) === 'bar', '知らない値は上の帯に落とす')
  ok(placeFor('nowhere', false) === 'dock', '知らない値は、狭い窓では画面の下')

  /* ── **スマホには「浮かせる」を持たせない**(2026-09 実機・利用者の指定)
         > フロートさせると下に変な隙間ができる、しかも戻せない。
         > フロートさせると機能を無くしてくださいと先ほど頼みませんでしたか?

       浮かせると、押すものが画面の幅に入りきらず
       **置き場所のボタンが画面の外**へ出て、黒帯へ戻せなくなっていた。
       だから**選べる場所そのものを黒帯だけ**にする。
       ここを「スマホでも float を返す」に戻すと、この3行が赤くなる */
  ok(placeFor('float', false, false) === 'dock', 'スマホでは、覚えていても黒帯')
  ok(placeFor('dock', false, false) === 'dock', 'スマホの既定も黒帯')
  ok(nextPlace('dock', false, false) === null
    && nextPlace('float', false, false) === null,
  'スマホには行き先が無い(切り替えのボタンごと出ない)')

  // **押すたびに次へ移る。** 3回で必ず元へ戻る(行き止まりを作らない)
  ok(nextPlace('bar', true) === 'dock' && nextPlace('dock', true) === 'float'
    && nextPlace('float', true) === 'bar', '広い窓は3つを回る')
  ok(nextPlace('dock', false) === 'float' && nextPlace('float', false) === 'dock',
    'パッドは2つを行き来する(上の帯へは行かない)')
  ok(PLACES.every((p) => PLACE_TO[p] && !PLACE_TO[p].includes('undefined')),
    'どの行き先にも、読める言葉が付いている')

  /* **画面の外に残さない。** 窓を小さくしたあと外に出ると、
     二度と掴めなくなる */
  const box = { w: 300, h: 50 }
  ok(clampPos({ x: 999, y: 999 }, box, { w: 400, h: 300 })?.x === 100,
    '窓の外へ出したら、右端で止める')
  ok(clampPos({ x: -50, y: -50 }, box, { w: 400, h: 300 })?.y === 0,
    '左上より外へは出さない')
  ok(clampPos({ x: 10, y: 10 }, { w: 500, h: 400 }, { w: 400, h: 300 })?.x === 0,
    '箱が窓より大きいときは、左上にそろえる')
  ok(clampPos(null, box, { w: 400, h: 300 }) === null, '決めていなければ何も返さない')
  ok(clampPos({ x: NaN, y: 0 }, box, { w: 400, h: 300 }) === null, '数でなければ何も返さない')

  /* つまんで動かせるのは**パッド以上**だけ(2026-09 利用者の判断)。
     スマホでは浮いた操作盤だけで画面幅のほとんどを使うので、
     動かす余地が無い —— 効かない操作を見せない */
  ok(clampPos({ x: 5, y: 5 }, box, { w: 400, h: 300 })?.x === 5, '中にあればそのまま')

  /* **画面が本当に使っているか。** 定義だけあって誰も呼ばなければ、
     いまと同じ「右下に浮いたまま」に戻る */
  const lv = readFileSync(
    new URL('../src/components/LessonView.jsx', import.meta.url), 'utf8')
  ok(/placeFor\(place, fitsInBar, padUp\)/.test(lv),
    'レッスン表示が placeFor に任せている(スマホかどうかも渡している)')
  ok(/nextPlace\(spot, fitsInBar, padUp\)/.test(lv),
    '次の行き先も nextPlace に任せている')
  /* **行き先が無いときに押せてしまわないか。** `placeNext` が `null` なら
     `PlayerBar` はボタンを描かないが、押されたときの受け皿も要る */
  ok(/const v = nextPlace\(spot, fitsInBar, padUp\)\s*\n\s*if \(!v\) return/.test(lv),
    '行き先が無ければ、置き場所を書き換えない')
  ok(/className="player-dock no-print"/.test(lv), '画面の下の黒帯を描いている')
  ok(!/spot === 'float' \|\| \(!fitsInBar && floatOpen\)/.test(lv),
    '古い出し分け(右下だけ)が残っていない')

  /* 集中モードでも、鳴っている段落をそのまま開く(2026-09 利用者の指定)

       > 集中モードでも再生中の文章がハイライトされるようにして下さい。
       > 何もしなければ次の段落、または発言などに進むようにして下さい。

     集中モードは1つだけを描くので、音が次の発言へ移ると
     **その発言は画面に出ていない。** 色を付ける相手がいないので
     ハイライトも消え、画面は1つめのまま止まって見えていた(実測)。 */
  const pp = readFileSync(
    new URL('../src/components/PassagePractice.jsx', import.meta.url), 'utf8')
  ok(/const byItem = focus && current\.unit === 'passage'/.test(pp),
    '段落 / 発言を1つずつ出しているときだけ動かす')
  ok(/if \(byItem && id\) \{[\s\S]{0,120}section\.items\.findIndex/.test(pp),
    '番号は section.items から数え直す(鳴らす側の並びは英文の無い項目を落としている)')
  ok(/setFocusAt\(n\)/.test(pp), '鳴っている段落を、そのまま開く')
}

/* ── 長い段落は、入るまで割る(2026-09 利用者の指定)────────────────

     > 段落が長い場合、せっかく集中モードに入ってもそこでスクロールが
     > 発生してしまっています。ちょうど良い単語数、内容で区切る仕様に
     > しないと通常モードと同じ操作感の悪さを引き継いでしまい、
     > 集中モードの存在意義が問われてしまいます

   ここで見るのは**算段だけ**(1語も落とさないか・文の切れ目で切るか・
   訳がずれないか)。**何枚に割るかは画面が測って決める**ので、
   そちらは `npm run test:bar` が実際に描いて数えている。 */
{
  const T = 'Good morning. I want to start with a number. Our team handled four '
    + 'thousand tickets. Almost a third came from three screens. They worked as '
    + 'designed. Nobody could tell what would happen next.'

  // **1語も落とさない。** つなぐと元に戻る
  let allBack = true
  for (let n = 1; n <= 10; n += 1) {
    if (splitInto(T, n).map((p) => p.text).join('') !== T) allBack = false
  }
  ok(allBack, '割ってつなぐと、元の英文に1文字も違わず戻る')

  // **文の数より多くは割れない**(行き止まりを作らない)
  ok(maxPieces(T) === 6, `文は 6 つ(${maxPieces(T)})`)
  ok(splitInto(T, 6).length === 6, '6つには割れる')
  ok(splitInto(T, 10).length === 6, '文の数より多くは割れない(そのまま返す)')
  ok(splitInto('Only one sentence here.', 3).length === 1, '1文なら割らない')
  ok(splitInto(T, 1).length === 1, '1を渡したら、そのまま')

  // **`at` は元の英文の何文字目か。** 足さないと、色が段落の先頭に戻る
  const three = splitInto(T, 3)
  ok(three.every((p) => T.slice(p.at, p.at + p.text.length) === p.text),
    'at が元の英文の位置を指している')
  ok(three[0].at === 0, '1枚目は先頭から')

  // **文の途中では切らない**
  ok(three.slice(1).every((p) => /^[A-Z]/.test(p.text.trim())),
    '切れ目は文の切れ目(かけらは大文字で始まる)')

  // **訳は、数が合ったときだけ割る**(ずれた対は、無いより悪い)
  const pair = piecesOf(
    { prompt_en: 'One two. Three four. Five six.', prompt_ja: 'いち に。さん し。ご ろく。' }, 3)
  ok(pair.length === 3 && pair[1].ja === 'さん し。' && !pair[1].jaWhole,
    '文の数が合えば、訳も一緒に割る')
  const whole = piecesOf(
    { prompt_en: 'One two. Three four. Five six.', prompt_ja: 'まとめた訳です。' }, 3)
  ok(whole.every((p) => p.ja === 'まとめた訳です。' && p.jaWhole),
    '数が合わなければ、段落の訳をそのまま添える(印を立てる)')
  const noJa = piecesOf({ prompt_en: 'One two. Three four.', prompt_ja: '' }, 2)
  ok(noJa.every((p) => !p.jaWhole), '訳が無い段落では、印を立てない')

  /* **画面が本当に使っているか。** 定義だけあって誰も呼ばなければ、
     長い段落はこれまでどおり中で送ることになる */
  const fr = readFileSync(
    new URL('../src/components/FocusReader.jsx', import.meta.url), 'utf8')
  ok(/piecesOf\(item, cut\)/.test(fr), '集中モードが piecesOf を呼んでいる')
  ok(/if \(cut >= maxPieces\(item\.prompt_en\)\) return/.test(fr),
    '文の数より多くは割らない(止まる条件がある)')
  ok(/b\.scrollHeight <= b\.clientHeight \+ 1/.test(fr),
    '**測って**決めている(語数の決め打ちではない)')
  ok(/readingAt - \(piece\?\.at \?\? 0\)/.test(fr),
    'かけらの頭を引いてから色を付けている')
  ok(!/text=\{item\.prompt_en\}/.test(fr),
    '段落まるごとを描いていない(割ったかけらを描いている)')

  /* ── **かけらを「段落」としてくり返す**(2026-09 利用者の指定)────
       > 集中モード内ではそれらを段落として扱い、繰り返し再生できるように
       > してください。現状では…段落は元々の段落を参照してしまい、
       > 次のページに進んでしまいます */
  const S = [
    { start: 0, end: 3, charIndex: 0 },
    { start: 3, end: 7, charIndex: 20 },
    { start: 7, end: 9, charIndex: 55 },
  ]
  const r1 = spanForRange(S, { from: 0, to: 55 })
  ok(r1 && r1.start === 0 && r1.end === 7, '1枚目は、その中の文の頭から終わりまで')
  const r2 = spanForRange(S, { from: 55, to: 90 })
  ok(r2 && r2.start === 7 && r2.end === 9, '2枚目は、2枚目の文だけ')
  ok(spanForRange(S, null) === null, '範囲が無ければ狭めない(段落まるごと)')
  ok(spanForRange(S, { from: 500, to: 900 }) === null, '入る文が無ければ狭めない')
  ok(spanForRange([], { from: 0, to: 9 }) === null, '文が無ければ狭めない')
  /* **かけらの中で数え直している並び**(窓口の都合で分けた段落)にも効く */
  const CH = [{ start: 0, end: 2, charIndex: 0 }, { start: 2, end: 5, charIndex: 30 }]
  const r3 = spanForRange(CH, { from: 100, to: 140 }, 100)
  ok(r3 && r3.start === 0 && r3.end === 5, 'かけらの頭(base)を足してから当てる')

  ok(/partRangeOf: \(i\) => \(i === atRef\.current \? rangeRef\.current : null\)/.test(fr),
    '集中モードが、いま開いている段落のときだけ範囲を渡している')
  ok(/from: piece\.at, to: piece\.at \+ piece\.en\.length/.test(fr),
    '範囲は「その段落の英文の何文字目から何文字目まで」')
  ok(/pieces\.length > 1 && piece/.test(fr),
    '割っていない段落では範囲を渡さない(段落まるごと回る)')
  ok(/parts: items\.map\(\(it\) => \(\{[\s\S]{0,80}text: it\.prompt_en/.test(fr),
    '**鳴らす英文は段落まるごとのまま**(かけらを鳴らすと、そのぶん課金される)')
}

/* ── ピリオドが付いても、文の終わりではない語(2026-09 利用者の指定)──

     > Ph. D / Dr. Hara など、ピリオドが含まれるが文の終わりを示すわけでは
     > ない語句のリストを作り、これらのピリオドを文の終わりとして
     > 捉えないよう改善してください。 */
{
  const cut = (t) => splitSentences(t).map((s) => t.slice(s.start, s.end).trim())
  const one = (t, why) => ok(cut(t).length === 1, `${why} … ${JSON.stringify(cut(t))}`)
  const two = (t, why) => ok(cut(t).length === 2, `${why} … ${JSON.stringify(cut(t))}`)

  one('Dr. Hara joined us today.', '敬称のあとで切らない(Dr.)')
  one('She has a Ph. D in physics.', '離して書いた学位でも切らない(Ph. D)')
  one('He has a Ph.D. in physics.', '**次が小文字**なら切らない')
  one('The U.S. team met at 9 a.m. and left.', 'つないだ形の途中で切らない')
  one('The cost rose 3.5 percent.', '小数点で切らない')
  one('Mr. Smith met Mrs. Lee at St. Paul.', '1文の中に3つあっても切らない')
  two('She holds a Ph.D. Everyone applauded.', '**学位で本当に文が終わる**ときは切る')
  two('The U.S. team met at 9 a.m. Then they left.', '同上(a.m. のあと)')
  two('Choose option A. Then press start.', '**1文字だけ**は略語にしない')
  two('The answer is no. We move on.', 'ふつうの語(no)は略語にしない')
  two('Wait! Really?', '`!` `?` はこれまでどおり')
  one('No full stop here', '句点が無ければ1文のまま')

  // **ふつうの語として文末に立つものを、一覧に入れていないか**
  const RISKY = ['no', 'apt', 'etc', 'al', 'sun', 'sat', 'mon', 'sec', 'min', 'max']
  const bad = ABBREVIATIONS.filter((w) => RISKY.includes(w))
  ok(bad.length === 0, `文末に立つ語を一覧に入れていない${bad.length ? `(${bad})` : ''}`)
  ok(ABBREVIATIONS.every((w) => w === w.toLowerCase()), '一覧は小文字でそろえてある')
}

/* ── 教材へのリンク(`?m=…`・2026-09 利用者の指定)────────────────

     > 「教材をシェア」ボタンをつけてトレーナー間でシェアできるように
     > してください。これで教材へのリンクをシェアできるようにします。

   このアプリには**ルーティングが無い**(画面はタブで切り替える)ので、
   道は増やさず、印を1つ付けるだけにしてある。

   見るのは4つ。
     ①いま開いている URL を土台にするか(決め打ちにしない)
     ②**UUID 以外を受け取らないか**(`[data-mid="…"]` にそのまま入る)
     ③**`m` だけを外し、`?v=` は残すか**
     ④**画面が本当に呼んでいるか**(作っただけでは何も起きない) */
{
  const ID = '11111111-2222-3333-4444-555555555555'
  const loc = (search = '', pathname = '/English-AI-System/') => ({
    origin: 'https://y868hjwmz7-creator.github.io', pathname, search, hash: '',
  })

  ok(materialLinkFor(ID, loc()) === `https://y868hjwmz7-creator.github.io/English-AI-System/?${MATERIAL_PARAM}=${ID}`,
    'リンクは、いま開いている URL を土台にする')
  ok(materialLinkFor(ID, { origin: 'http://localhost:5173', pathname: '/' })
    === `http://localhost:5173/?${MATERIAL_PARAM}=${ID}`,
    '手元の開発サーバーでも、そこを指す')
  ok(materialLinkFor(ID, { pathname: '/' }) === null,
    '**当てずっぽうの URL を返さない**(origin が無ければ null)')
  ok(materialLinkFor('drop table', loc()) === null, 'id の形が違えば作らない')

  ok(materialIdFromUrl(`?${MATERIAL_PARAM}=${ID}`) === ID, '印から id を読む')
  ok(materialIdFromUrl(`${MATERIAL_PARAM}=${ID}`) === ID, '`?` は有っても無くてもよい')
  ok(materialIdFromUrl(`?v=1cfc831&${MATERIAL_PARAM}=${ID}`) === ID,
    '`?v=` と一緒に付いていても読める')
  ok(materialIdFromUrl('?v=1cfc831') === null, '印が無ければ null')
  ok(materialIdFromUrl('') === null, '空でも落ちない')
  // **選択子ごと壊れるものを、受け取らない**
  ok(materialIdFromUrl(`?${MATERIAL_PARAM}=" ]. x`) === null, '引用符の混じった id は落とす')
  ok(materialIdFromUrl(`?${MATERIAL_PARAM}=1234`) === null, 'UUID の形でなければ落とす')

  ok(urlWithoutMaterial(loc(`?${MATERIAL_PARAM}=${ID}`)) === '/English-AI-System/',
    '取り出したら、印を外す')
  ok(urlWithoutMaterial(loc(`?v=1cfc831&${MATERIAL_PARAM}=${ID}`)) === '/English-AI-System/?v=1cfc831',
    '**`?v=` は残す**(消してよいのは `m` だけ)')
  ok(urlWithoutMaterial(loc('?v=1cfc831')) === '/English-AI-System/?v=1cfc831',
    '印が無ければ、そのまま')

  /* **画面が本当に呼んでいるか。**
     作っただけで誰も呼んでいなければ、リンクは一度も開けない
     (`noteFnRev` を定義だけして呼んでいなかったのと同じ落とし穴) */
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
  ok(app.includes('materialIdFromUrl(window.location.search)'),
    'App が、開いた瞬間に印を読んでいる')
  ok(app.includes('urlWithoutMaterial(window.location)'),
    'App が、読んだあと印を外している')
  ok(app.includes('askOpenId={askOpenId}'),
    'App が、`TrainerMaterials` へ渡している')
  const tm = readFileSync(new URL('../src/components/TrainerMaterials.jsx',
    import.meta.url), 'utf8')
  ok(tm.includes('<MaterialShare material={m} />'),
    '画面が `MaterialShare` を置いている')
  ok(tm.includes('setLinkMiss(true)'),
    '見つからなければ、**黙らない**')
  // **リンクの作り方は `MaterialShare` に預けた。**
  // さがす画面が自分でも作っていたら、直したときに片方だけ古くなる
  ok(!tm.includes("from '../lib/materialLink.js'"),
    'さがす画面は、リンクを自分では作らない')
}

/* ── 渡し方は2つ(2026-09 利用者の指定)──────────────────────────

     > シェアする際はメールアドレスを入れる、またはリンクを生成して
     > 好きなところに貼り付けれるように、2つから選べると良いですね

   ①メールで送る … **こちらからは送らない。** 利用者のメールソフトを開く
   ②リンクをコピー … リンクをそのまま出す

   宛先の形を**厳しく見ない。** 正しい住所を弾くほうが害が大きい。 */
{
  const URL2 = 'https://x.example/App/?m=11111111-2222-3333-4444-555555555555'

  ok(isEmailLike('a@b.com'), 'ふつうのメールアドレス')
  ok(isEmailLike(' a@b.com '), '前後の空白は落とす')
  ok(isEmailLike('a@b.com, c@d.co.jp'), 'コンマで区切れば複数書ける')
  ok(isEmailLike('a+tag@b.co.jp'), '**厳しく見ない**(`+` を弾かない)')
  ok(!isEmailLike(''), '空は宛先ではない')
  ok(!isEmailLike('   '), '空白だけも宛先ではない')
  ok(!isEmailLike('abc'), '`@` が無ければ宛先ではない')
  ok(!isEmailLike('a@b'), 'ドットが無ければ宛先ではない')
  ok(!isEmailLike('a@b.com, おかしい'), '1つでも形が違えば、まとめて断る')

  const mail = mailtoFor({ to: 'a@b.com', title: '会議に出る', url: URL2 })
  ok(mail.startsWith('mailto:a@b.com?'), '宛先はそのまま(`@` を壊さない)')
  ok(mail.includes(`subject=${encodeURIComponent('教材のリンク: 会議に出る')}`),
    '件名に教材名が入る')
  ok(mail.includes(encodeURIComponent(URL2)), '本文にリンクが入る')
  ok(mail.includes(encodeURIComponent('\r\n')),
    '改行は `\\r\\n`(`\\n` だけでは行が変わらないメールソフトがある)')
  ok(mailtoFor({ to: 'a@b.com, c@d.jp', title: 'x', url: URL2 })
    .startsWith('mailto:a@b.com,c@d.jp?'), '複数の宛先はコンマでつなぐ')
  ok(mailtoFor({ to: 'abc', title: 'x', url: URL2 }) === null,
    '**選ばせてから断らない**(形が違えば null → 画面は押せなくする)')
  ok(mailtoFor({ to: 'a@b.com', title: 'x', url: null }) === null,
    'リンクが無ければ作らない')
  ok(mailtoFor({ to: 'a@b.com', title: '', url: URL2 })
    .includes(encodeURIComponent('教材のリンク')),
    '教材名が無くても件名は空にしない')

  /* **画面が本当に2つとも出しているか。**
     片方だけになっても `npm run build` は通る */
  const ms = readFileSync(new URL('../src/components/MaterialShare.jsx',
    import.meta.url), 'utf8')
  ok(ms.includes('materialLinkFor(material.id, window.location)')
    && !/[`'"]\?m=/.test(ms), '`MaterialShare` もリンクの形を書き写していない')
  /* **「名前が出てくるか」で見ない**(CLAUDE.md)。この部品は説明の中でも
     同じ言葉を使っているので、**書いてある形**まで見ないと、
     見出しを消しても緑のままになる(実際にそうなった)。
     **画面に本当に出ているか**は `npm run test:bar` が描いて確かめる */
  ok(ms.includes('mailtoFor(')
    && ms.includes('<p className="field-label">① メールで送る</p>'),
    '①メールで送るがある')
  ok(ms.includes('navigator.clipboard.writeText')
    && ms.includes('<p className="field-label">② リンクをコピー'),
    '②リンクをコピーがある')
  ok(ms.includes('readOnly'),
    '**リンクはいつも見えるところに出す**(コピーを断る端末でも手で選べる)')
  ok(ms.includes('やめる'), '**やめるを、走らせるボタンのとなりに置く**')
  ok(!ms.includes('navigator.share'),
    '**2つから選ぶ。** 共有シートを3つめとして足さない(利用者の指定)')
}

/* ══════════════════════════════════════════════════════════════════
 * **ハイライトのタイミングを、見積もりから本当の時刻へ**(2026-09)
 *
 *   > 再生中の文章のハイライトのタイミングをもっと正確にできないですか?
 *
 * 段落ごとの MP3 では、語の色も文の区間も**語の重みで割った見積もり**
 * だった(`wordMarks` / `sentenceShares`)。合っているのは合計だけである。
 *
 * ElevenLabs は音声と一緒に**文字ごとの時刻**を返す(課金は文字数なので
 * **1円も増えない**)。窓口がそれを MP3 のとなりに控えるようにしたので、
 * ここでは読むだけでよい。
 *
 * **当てはまらないときは `null` / 空を返して、見積もりに戻す。**
 * ずれた区間は無いより悪い —— ◀ ▶ が**別の文へ飛ぶ**からである。
 * ══════════════════════════════════════════════════════════════════ */
{
  /** その英文の、1文字ずつの時刻を作る(空白は飛ばす・窓口の返す形) */
  const align = (text, per = 0.1) => {
    const chars = []
    const from = []
    const to = []
    let t = 0
    for (const ch of text) {
      chars.push(ch)
      if (/\s/.test(ch)) { from.push(t); to.push(t); continue }
      from.push(t); t += per; to.push(t)
    }
    return {
      characters: chars,
      character_start_times_seconds: from,
      character_end_times_seconds: to,
    }
  }

  const TEXT = 'Hi there. How are you?'

  // ── ① 文字ごとの時刻を、画面が描く英文に当てはめる ──────────────
  const times = charTimesOf(align(TEXT), TEXT)
  ok(times && times.start.length === TEXT.length, '英文と同じ長さで返る')
  ok(Number.isNaN(times.start[2]), '空白は NaN(音になっていない)')
  ok(times.start[0] === 0, '1文字目は 0 秒から')

  /* **空白のそろえ方が違っても当てはまる**(控えは `normText` で作られる)。
     非空白の並びが同じなら、`charTimesOf` はそのまま当たる */
  const LOOSE = '  Hi   there.\nHow are you?  '
  const loose = charTimesOf(align('Hi there. How are you?'), LOOSE)
  ok(loose && loose.start.length === LOOSE.length,
    '**画面が描いている文字列で数える**(空白のそろえ方が違ってもよい)')
  ok(Number.isNaN(loose.start[0]) && loose.start[2] === 0,
    '前の空白は飛ばして、`H` から数える')

  // ── ② 語の印(色)は、割り算ではなく本当の時刻から ────────────────
  const marks = marksFromTimes(TEXT, times)
  ok(marks.length === wordSpans(TEXT).length, '語の数だけ印が出る')
  ok(marks[0].at === 0, '1つめの印は英文の頭を指す')
  ok(marks.every((m, i) => i === 0 || m.until >= marks[i - 1].until),
    '**時刻は前へ戻らない**(戻る並びは当てにしない)')
  ok(Math.abs(marks[0].until - 200) < 1, '`Hi` は 2 文字ぶん = 0.2 秒')
  ok(marksFromTimes(TEXT, null).length === 0,
    '**控えが無ければ空。** 見積もりに戻る(行き止まりを作らない)')
  ok(marksFromTimes(TEXT, { start: [], end: [] }).length === 0,
    '長さが合わなければ空(当てずっぽうで色を付けない)')

  // ── ③ 文の区間も、本当の時刻から ────────────────────────────────
  const sents = sentenceTimesOf(TEXT, times)
  ok(sents && sents.length === 2, '2文に分かれる')
  ok(sents[0].charIndex === 0 && sents[1].charIndex === TEXT.indexOf('How'),
    '**`charIndex` は画面が描いている英文の位置**(集中モードが範囲で使う)')
  ok(sents[0].start === 0, '1文目は 0 秒から')
  ok(Math.abs(sents[1].start - 0.8) < 0.001,
    '2文目は `Hi there.` の 8 文字ぶん = 0.8 秒から')
  ok(sents[0].end <= sents[1].start, '文どうしが重ならない')

  /* **返す形は `sharesToTimes()` とそろえる。**
     そろっていないと `repeatSeek` / `seekSentence` / `spanForRange` が
     経路ごとに違う動きをする */
  const shape = sentenceShares(TEXT)
  ok(shape.length === sents.length, '見積もりと同じ数の区間になる')
  ok(sents.every((s) => 'start' in s && 'end' in s && 'charIndex' in s),
    '見積もりとまったく同じ形(呼ぶ側はどちらか知らなくてよい)')

  ok(sentenceTimesOf(TEXT, null) === null, '控えが無ければ null')
  ok(sentenceTimesOf(TEXT, { start: [1], end: [1] }) === null,
    '長さが合わなければ null(**当てずっぽうで区切らない**)')
  ok(sentenceTimesOf('...', charTimesOf(align('...'), '...')) !== null
    || true, '記号だけでも落ちない')

  // 前へ戻る時刻(当てはめが崩れている)は、まるごと断る
  const broken = charTimesOf(align(TEXT), TEXT)
  for (let i = 0; i < TEXT.indexOf('How'); i += 1) {   // 1文目だけ、うしろへ
    if (Number.isFinite(broken.start[i])) { broken.start[i] += 5; broken.end[i] += 5 }
  }
  ok(sentenceTimesOf(TEXT, broken) === null,
    '**時刻が前へ戻る並びは断る**(ずれた区間は、無いより悪い)')

  // ── ④ 画面(readAloud)が、本当に使っているか ────────────────────
  const ra = readFileSync(new URL('../src/lib/readAloud.js', import.meta.url), 'utf8')
  ok(ra.includes('async function exactTimesFor'),
    '控えを読む窓口が1か所にある')
  ok(/tier !== PREMIUM/.test(ra.slice(ra.indexOf('async function exactTimesFor'))),
    '**標準の段では読みに行かない**(控えがあるのは ElevenLabs だけ)')
  ok((ra.match(/exactTimesFor\(/g) ?? []).length >= 3,
    '**段落ごと・通しの両方で呼んでいる**(片方だけだと、そこだけ見積もり)')
  ok((ra.match(/alignment: exact\?\.alignment \?\? null/g) ?? []).length === 2,
    '`playClip` に控えを渡している(渡し忘れても音は鳴るので気づけない)')
  ok(ra.includes('holdCursor(exact.sents, null)'),
    '文の区間も、控えがあれば本当の時刻で控える')
  ok(ra.includes('sentenceShares(piece.text)') && ra.includes('sharesToTimes(shares, dur)'),
    '**控えが無いときの見積もりは残す**(行き止まりを作らない)')

  /* **送れなかったときに、控えを進めない**(2026-09)。
     進めると、その段落が画面に出た瞬間には「もう送った文」になっていて、
     **1文目だけが永久に光らない** */
  const tell = ra.slice(ra.indexOf('function tellSentence'))
  const cut = tell.slice(0, tell.indexOf('\n}\n'))
  ok(cut.indexOf('sp.item !== only()') < cut.indexOf('state.at = hit'),
    '**送れたときだけ控えを進める**(順を戻すと1文目が光らなくなる)')

  // ── ⑤ 窓口が、控えを作って置いているか ──────────────────────────
  const sp = readFileSync(new URL('../supabase/functions/speak/index.ts',
    import.meta.url), 'utf8')
  ok(sp.includes('/with-timestamps'),
    '**時刻ごと受け取る。** 課金は文字数なので1円も増えない')
  ok(sp.includes(".replace(/\\.mp3$/, '.json')"),
    'MP3 と同じ道の `.json` に控える(画面と同じ規則)')
  ok(sp.includes("FN_REV = '2026-09-07'"), '窓口の版を1つ進めてある')

  const ac = readFileSync(new URL('../src/lib/audioClips.js', import.meta.url), 'utf8')
  ok(ac.includes("NEED_FN_REV = '2026-09-07'"),
    '画面が求める版も、そろえてある(古ければ赤く知らせる)')
  ok(ac.includes('export async function clipAlignment'),
    '控えを読む道がある')
  ok(!/clipAlignment[\s\S]{0,600}askForClip/.test(ac),
    '**控えを読むだけ。窓口は呼ばない**(0円)')
  ok(/prefetchClip[\s\S]{0,400}clipAlignment\(/.test(ac),
    '**次の段落の控えも温めておく**(段落の切れ目で待たせない)')
  ok(ac.includes('marksFromTimes(body, charTimesOf(alignment, body))'),
    '`playClip` が、控えがあれば見積もらない')
}

/* ══════════════════════════════════════════════════════════════
   うしろを送れなくする鍵は、**数える**(2026-09 実機・利用者の指摘)

     > スクロールを始めるとサイドバーのハンバーガーが触れなくなる

   画面ぜんぶを覆うものが4つあり(かぶせて開くメニュー・レッスン表示・
   集中モード・単語帳の集中モード)、**それぞれが勝手に `body` の
   `overflow` を控えて戻していた。** 入れ子になると `hidden` が
   取り残され、`position: sticky` が効かなくなって
   **上の帯ごと ☰ が画面の外へ流れ出る**(実測 上端 8px → −592px)。
   ══════════════════════════════════════════════════════════════ */
{
  const fake = { body: { style: { overflow: '' } } }
  const has = () => fake.body.style.overflow

  ok(lockDepth() === 0, '鍵 … はじめは1枚も掛かっていない')

  const a = lockScroll(fake)
  ok(has() === 'hidden' && lockDepth() === 1, '鍵 … 1枚めで送れなくなる')
  const b = lockScroll(fake)
  ok(has() === 'hidden' && lockDepth() === 2, '鍵 … 2枚めも重ねて掛かる')

  /* **ここが本命。** 外す順が入れ替わっても、最後は元へ戻る ——
     単語帳の復習を開いた状態で ☰ を開き、メニューから別の画面へ移ると
     この順になる(先に開いたほうが先に外れる) */
  a()
  ok(has() === 'hidden' && lockDepth() === 1,
    '鍵 … **逆順で外しても**、まだ1枚残っているあいだは送れないまま')
  b()
  ok(has() === '' && lockDepth() === 0,
    '鍵 … **最後の1枚が外れたときだけ元へ戻る**(hidden が取り残されない)')

  a(); b()
  ok(has() === '' && lockDepth() === 0, '鍵 … 二度外しても数がずれない')

  /* 元が空でないときも、**その値へ戻す**(勝手に空にしない) */
  fake.body.style.overflow = 'auto'
  const c = lockScroll(fake)
  const d = lockScroll(fake)
  d(); c()
  ok(has() === 'auto', '鍵 … 元の値が空でなくても、そこへ戻す')

  ok(typeof lockScroll(null) === 'function' && lockDepth() === 0,
    '鍵 … `document` が無くても落ちない(素の node でも読み込める)')

  /* **画面が自前で `body` を触っていないか。**
     ここが1つでも残ると、また同じ取り残しが起きる */
  for (const f of ['AppNav', 'FocusFrame', 'Wordbook', 'LessonView']) {
    const src = readFileSync(new URL(`../src/components/${f}.jsx`, import.meta.url), 'utf8')
    ok(!src.includes('body.style.overflow'),
      `鍵 … ${f} は自前で \`body\` を触っていない`)
    ok(src.includes('lockScroll()'), `鍵 … ${f} は \`lockScroll()\` を呼んでいる`)
  }
}

/* ══════════════════════════════════════════════════════════════
   開いていたゲストのまま戻る(2026-09 実機・利用者の指摘)

     > 何か一つ間違えるとすぐにゲスト一覧に飛んでしまい、
     > ゲストと画面共有中に非常にやりにくい
   ══════════════════════════════════════════════════════════════ */
{
  rememberLearner(null)
  ok(lastLearner() === null, 'ゲストの控え … はじめは空(一覧から始まる)')
  rememberLearner('abc')
  ok(lastLearner() === 'abc', 'ゲストの控え … 開いた人を覚える')
  rememberLearner(null)
  ok(lastLearner() === null, 'ゲストの控え … 一覧に戻ったら忘れる')

  const src = readFileSync(new URL('../src/components/TrainerLearners.jsx',
    import.meta.url), 'utf8')
  ok(src.includes('rememberLearner(id); setOpenIdRaw(id)'),
    'ゲストの控え … **開け閉めの5か所すべて**が控えを通る(1か所で包む)')
  ok(/const back = lastLearner\(\)[\s\S]{0,40}openDetail\(back\)/.test(src),
    'ゲストの控え … 戻ってきたら `openDetail` で**中身ごと**開き直す')
  ok(!src.includes("openId === l.id ? setOpenId(null) : openDetail(l.id)"),
    'ゲストの控え … **名前をもう一度押しても閉じない**(誤タップの元だった)')

  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
  ok(app.includes('if (id === view) setNavTick'),
    'ゲストの控え … **同じ画面をもう一度押したときだけ**数える'
    + '(教材を見に行って戻るだけでは一覧に飛ばない)')
}


// ══════════════════════════════════════════════════════════════════════
// 復習の「いつのぶん・何問ずつ」(2026-09 利用者の指定)
//
//   > 結局ただランダムに出てくるだけですごく仕組みが分かりにくい。
//   > …出題範囲の時系列での絞りかた…その時に復習したい…個数だ。
//
// **算段は `reviewScope.js` 1か所。** 画面(`Wordbook` / `QrReview`)は
// Supabase を引き連れていて素の node で走らせられないので、
// ここで数字として見張る。
// ══════════════════════════════════════════════════════════════════════
{
  /* ── Quick Response の3つの数(2026-09 実機・利用者の指定)──────────
     > 「今日出す」「溜まっている」の意味が私にも分からないので、
     > そもそも文言を変えたいですね。

     調べたところ「帳面ぜんぶの数」を大きく出すアプリはほとんど無く、
     しかも**この単語帳にはすでに「まだ / 覚えかけ / 覚えた」**があった。
     利用者がそちらにそろえることを選んだ。

     **SQL は1行も要らない** —— `qr_items` が返す箱から数える。
     **箱の番号そのものは画面に出さない**(仕組みの内側の数字)。 */
  {
    const t = qrTally([
      { box: 0 }, { box: 0 },              // まだ 2
      { box: 1 }, { box: 3 }, { box: 5 },  // 言えかけ 3
      { box: 6 },                          // 言える 1
    ])
    ok(t.yet === 2 && t.mid === 3 && t.done === 1,
      '復習の数 … 箱から3つに束ねる', `まだ ${t.yet} / 言えかけ ${t.mid} / 言える ${t.done}`)
    ok(qrTally([]).yet === 0 && qrTally(null).done === 0,
      '復習の数 … 空のときは 0')
    /* **箱が無い行も「まだ」に数える。** 0040 を貼る前や古い行で
       `box` が来なくても、**数え落とさない** */
    ok(qrTally([{}]).yet === 1, '復習の数 … 箱の無い行も数える')

    /* **文言は `QR_GROUPS` 1か所**(2026-09)。画面は札を並べるだけなので、
       言葉はここにしか無い。**数える段と、押して出てくる段が同じ**である */
    ok(QR_GROUPS.map((g) => g.label).join('/') === 'まだ/言えかけ/言える',
      '復習の数 … 文言が「まだ / 言えかけ / 言える」(単語帳と同じ数え方)',
      QR_GROUPS.map((g) => g.label).join('/'))
    ok(WORD_GROUPS.map((g) => g.label).join('/') === 'まだ/覚えかけ/覚えた',
      '復習の数 … 単語帳は「まだ / 覚えかけ / 覚えた」',
      WORD_GROUPS.map((g) => g.label).join('/'))
    /* **単語帳の段の id は `word_reviews.status` そのもの。**
       対応表を持たないので、ここがずれると読み込む段が変わる */
    ok(WORD_GROUPS.map((g) => g.id).join('/') === 'unknown/learning/known',
      '復習の数 … 単語帳の段の id は status そのもの')

    /* ── その段だけを取り出す(Quick Response)──────────────── */
    const G = [{ box: 0 }, { box: 2 }, { box: 6 }, { box: 6 }]
    ok(qrGroupPool(G, 'done').length === 2 && qrGroupPool(G, 'yet').length === 1,
      '段を押す … その段だけを取り出す')
    ok(qrGroupPool(G, null).length === 4, '段を押す … 押していなければ、ぜんぶ')
    ok(groupLead(QR_GROUPS, null).includes('押すと'),
      '段を押す … 押していないときは、押せることを言う')
    ok(groupLead(QR_GROUPS, 'done').includes('「言える」')
      && groupLead(QR_GROUPS, 'done').includes('もう一度押す'),
      '段を押す … 押しているときは、戻り方まで言う', groupLead(QR_GROUPS, 'done'))

    /* **画面が本当に使っているか。** 定義だけあって誰も呼ばなければ、
       札は押せないままになる(「名前が出てくるか」で見ない・CLAUDE.md) */
    const qr = readFileSync(new URL('../src/components/QrReview.jsx', import.meta.url), 'utf8')
      .replace(/\/\*[\s\S]*?\*\/|\{\/\*[\s\S]*?\*\/\}/g, '')
    ok(/qrTally\(rows\)/.test(qr), '復習の数 … QrReview が `qrTally()` を呼んでいる')
    ok(/<ReviewStats/.test(qr) && /qrGroupPool\(rows, group\)/.test(qr),
      '段を押す … QrReview が押せる札を出し、その段で絞っている')
    const wb = readFileSync(new URL('../src/components/Wordbook.jsx', import.meta.url), 'utf8')
      .replace(/\/\*[\s\S]*?\*\/|\{\/\*[\s\S]*?\*\/\}/g, '')
    ok(/<ReviewStats/.test(wb) && /onPick=\{pickGroup\}/.test(wb),
      '段を押す … 単語帳が押せる札を出している')
    /* **押したら、範囲を「ぜんぶ」へ移す。** そうしないと「覚えた」語は
       次に出る日が先なので、押した瞬間に0件になる */
    ok(/setScope\(id \? 'all' : loadScope\('word'\)\)/.test(wb)
      && /setScope\(id \? 'all' : loadScope\('qr'\)\)/.test(qr),
      '段を押す … 押したら範囲を「ぜんぶ」に移す(押した瞬間に0件にしない)')

    /* ── 中に入ってからも絞り込める(2026-09 利用者の指定)──────── */
    ok(runKeyOf({ scope: 'due', size: 10, filter: { level: 'B1' } })
       !== runKeyOf({ scope: 'due', size: 10, filter: { level: 'B2' } }),
      '出しかた … レベルを変えたら、組み直す合図が変わる')
    /* **何も変えていなければ、同じ合図。** ここが変わると、
       答えるたびに組み直されて「1 / 10 語」から先へ進まなくなる */
    const 同じ = [
      runKeyOf({ scope: 'due', size: 10, filter: { day: null } }),
      runKeyOf({ scope: 'due', size: 10, filter: {} }),
    ]
    ok(同じ[0] === 同じ[1], '出しかた … 何も変えなければ、組み直さない', 同じ[0])
    /* **「名前が出てくるか」で見ない**(CLAUDE.md)。`compact` は説明の中にも
       出てくるので、**使っている形**(`<ReviewScope` に続く)で見る */
    ok(/<ReviewScope\s+compact/.test(wb) && /<ReviewScope\s+compact/.test(qr),
      '出しかた … 復習の最中にも、同じ「出しかた」を出している')
    ok(/runKeyOf\(\{ scope, size, filter, group \}\)/.test(wb)
      && /runKeyOf\(\{ scope, size, filter, group \}\)/.test(qr),
      '出しかた … 変わったかどうかを `runKeyOf()` で見張っている')
  }

  console.log('\n▶ 復習の範囲と個数')

  const T = '2026-08-30'
  /** その日に入った1件を作る */
  const row = (day, due = null) => ({
    added_at: `${day}T09:00:00+09:00`, due_on: due, word_norm: `w-${day}-${due}`,
  })
  const rows = [
    row('2026-08-30', '2026-08-30'),   // 今日入って、今日が期限
    row('2026-08-28', '2026-08-30'),   // 2日前・今日が期限
    row('2026-08-25', '2026-09-20'),   // 5日前・先取り
    row('2026-08-20', '2026-09-20'),   // 10日前・先取り
    row('2026-07-25', '2026-09-20'),   // 36日前
    row('2026-03-01', '2026-09-20'),   // 半年に近い
    { word_norm: 'old', added_at: null, due_on: '2026-09-20' }, // 出会った日が分からない
  ]

  const n = (id) => scopePool(rows, id, T).length
  ok(n('due') === 2, '範囲 … 「今日出す」は期限が来ているものだけ', `${n('due')} 件`)
  ok(n('d7') === 3, '範囲 … 「1週間」は7日前の日付以降', `${n('d7')} 件`)
  ok(n('d14') === 4, '範囲 … 「2週間」', `${n('d14')} 件`)
  ok(n('d30') === 4, '範囲 … 「1か月」(36日前は入らない)', `${n('d30')} 件`)
  ok(n('d90') === 5, '範囲 … 「3か月」', `${n('d90')} 件`)
  ok(n('all') === rows.length,
    '範囲 … 「ぜんぶ」は期限も出会った日も見ない(いまの「おさらい」と同じ)')
  ok(n('d182') === 6 && n('all') === 7,
    '範囲 … **出会った日が分からない古い行は、時系列の札に入らない**'
    + '(当てずっぽうで入れない)')

  /* **数え上げと、実際に出るものが食い違わない。**
     食い違うと「23 問あります」と書いてあるのに別の数が出る */
  const counts = scopeCounts(rows, T)
  ok(SCOPES.every((s) => counts[s.id] === scopePool(rows, s.id, T).length),
    '範囲 … 札に出す数と、実際に出るものが**同じ道**を通っている')

  // ── 個数 ───────────────────────────────────────────────
  ok(takeCount(10, 23) === 10 && takeCount(30, 23) === 23,
    '個数 … 選んだ数と、範囲にある数の**小さいほう**')
  ok(takeCount('all', 23) === 23, '個数 … 「ぜんぶ」は範囲にあるだけ出す')
  ok(SIZES.length === 5 && SIZES.includes(5) && SIZES.includes(10)
    && SIZES.includes(20) && SIZES.includes(30) && SIZES.includes('all'),
    '個数 … 5 / 10 / 20 / 30 / ぜんぶ(利用者の指定)')
  ok(DEFAULT_SIZE === SESSION_SIZE,
    '個数 … 既定は `SESSION_SIZE` から取る(同じ数を2か所に書かない)')

  // ── 遅く出す方へは動かさない ─────────────────────────────
  const due = { dueOn: '2026-08-30', addedAt: '2026-08-01T00:00:00Z' }
  const ahead = { dueOn: '2026-09-20', addedAt: '2026-08-01T00:00:00Z' }
  ok(shouldRecord(false, { ...ahead, today: T }) === true,
    '記録 … **「まだ」はいつでも記録する**(早く出す方へ動かすだけ)')
  ok(shouldRecord(true, { ...due, today: T }) === true,
    '記録 … 「言える」は、期限が来ていればふつうどおり進む')
  ok(shouldRecord(true, { ...ahead, today: T }) === false,
    '記録 … **先取りでは進めない**(次に出る日を動かさない)')
  ok(shouldRecord(true, { ...due, today: T, already: true }) === false,
    '記録 … この回でもう進めたものは、二度進めない')
  ok(shouldRecord(false, { ...due, today: T, already: true }) === true,
    '記録 … それでも「まだ」は記録する')
  /* **入れたばかりのものは、その日のうちに出す**(2026-09 実機の直し)。
     ここが落ちると、手で入れた語が入れた日に1回も出てこない */
  ok(isDueOn('2026-08-31', '2026-08-30T22:00:00+09:00', T) === true,
    '記録 … 入れたばかりのものは、その日のうちに出す(0030 を貼る前の道)')

  // ── 押す前に、何が起きるかを言う ────────────────────────
  ok(scopeLead('d7', '問').includes('1週間以内に出会った問'),
    '説明 … 押す前に、その札で何が出るのかを1行で言う')
  ok(scopeLead('all', '語').includes('期限は見ません'),
    '説明 … 「ぜんぶ」は期限を見ないことを、はっきり書く')

  // ── 画面が本当に使っているか(定義だけあって誰も呼ばなければ同じ)──
  const rs = readFileSync(new URL('../src/components/ReviewScope.jsx',
    import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\/|\{\/\*[\s\S]*?\*\/\}/g, '')
  ok(/disabled=\{n === 0\}/.test(rs),
    '札 … **0件の札は押せない**(効かない操作を見せない)')
  ok(rs.includes('<span className="chip-count">{n}</span>'),
    '札 … **数を札の中に出す**(数が見えないと範囲を選べない)')

  for (const [file, where, unit] of [
    ['Wordbook', 'word', '語'], ['QrReview', 'qr', '問'],
  ]) {
    const src = readFileSync(new URL(`../src/components/${file}.jsx`,
      import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\/|\{\/\*[\s\S]*?\*\/\}/g, '')
    ok(/<ReviewScope/.test(src) && src.includes(`unit="${unit}"`),
      `${file} … 同じ部品(ReviewScope)を使っている`)
    ok(src.includes(`saveScope('${where}'`) && src.includes(`loadScope('${where}'`),
      `${file} … 選んだ範囲を覚える(単語帳と Quick Response で別に)`)
    ok(/shouldRecord\(/.test(src),
      `${file} … 記録するかどうかを shouldRecord() に任せている`)
    ok(!/\bsetExtra\(/.test(src),
      `${file} … 「おさらい」の特別扱い(extra)は残っていない`)
  }
}

/* ==========================================================================
 * 聞き流しと、自作の音楽(2026-09 利用者の指定)
 *
 *   > また、これからは自作の音楽が流れるようにしたいです。
 *   > それとか音楽を流しながらどんどん登録されている単語が
 *   > 読まれるモードも欲しいですね
 * ========================================================================== */
{
  console.log('\n▶ 聞き流しと音楽')

  /* ── 読み方は、利用者が挙げた2つだけ ────────────────────── */
  ok(RADIO_MODES.length === 2
    && RADIO_MODES.map((m) => m.id).join(',') === 'en,enja',
    '読み方 … 2つだけ(英語だけ / 英語 → 間 → 日本語)',
    RADIO_MODES.map((m) => m.id).join(','))

  /* ── その1語を、どの順で読むか ─────────────────────────── */
  const 語 = { display: 'take on', meaning_ja: '引き受ける' }
  const en = radioSteps(語, 'en')
  ok(en.length === 3 && en[0].kind === 'en' && en[1].kind === 'wait' && en[2].kind === 'en',
    '英語だけ … 英語 → 間 → 英語 の3つ(日本語は読まない)',
    en.map((s) => s.kind).join(' '))
  ok(!en.some((s) => s.kind === 'ja'),
    '英語だけ … 意味は1つも読まない')

  const 両方 = radioSteps(語, 'enja')
  ok(両方.map((s) => s.kind).join(' ') === 'en wait ja',
    '英語 → 間 → 日本語 … その順で返る',
    両方.map((s) => s.kind).join(' '))
  ok(両方[1].ms > 1000,
    '英語 → 間 → 日本語 … 思い出すための間がある(1秒以上)', String(両方[1].ms))

  /* **無いものをあるように見せない。** 訳が無ければ、英語だけを読む */
  const 訳なし = radioSteps({ display: 'gist' }, 'enja')
  ok(訳なし.length === 1 && 訳なし[0].kind === 'en',
    '訳が無い語 … 英語だけを読む(無音の「間」を置かない)',
    訳なし.map((s) => s.kind).join(' '))
  /* **英語が無ければ、何も返さない。**「読んだことにして」次へ送ると、
     無音の時間だけが延びる */
  ok(radioSteps({ meaning_ja: '意味だけ' }, 'enja').length === 0,
    '英語が無い語 … 何も返さない')
  ok(radioSteps(null).length === 0, '空の行 … 何も返さない')

  /* ── 最後まで行ったら、頭へ戻る ─────────────────────────── */
  ok(nextIndex(0, 3) === 1 && nextIndex(2, 3) === 0,
    '聞き流し … 最後まで行ったら頭から回り直す')
  ok(nextIndex(0, 0) === 0, '聞き流し … 0語でも壊れない')

  /* ── 音楽を流す場所。**切る場所を必ず用意する** ──────────── */
  ok(BGM_PLACES[0].id === 'off' && BGM_PLACES[0].plays.length === 0,
    '音楽 … いちばん上が「流さない」(レッスン中に切れる)')
  ok(!bgmPlaysIn('off', 'radio') && !bgmPlaysIn('off', 'app'),
    '音楽 … 「流さない」ならどこでも鳴らない')
  ok(bgmPlaysIn('radio', 'radio') && !bgmPlaysIn('radio', 'review'),
    '音楽 … 「聞き流しのときだけ」は、復習では鳴らない')
  ok(bgmPlaysIn('always', 'app') && bgmPlaysIn('always', 'radio'),
    '音楽 … 「ずっと」はどこでも鳴る')
  /* **知らない id は、既定に落とす**(行き止まりを作らない) */
  ok(bgmPlaysIn('しらない', 'radio'),
    '音楽 … 知らない指定は、既定(聞き流しのときだけ)に落ちる')

  /* ── 音の大きさ。**下げるだけで、通り道は変えない** ────────── */
  ok(bgmVolume(true) < bgmVolume(false) && bgmVolume(false) <= 1,
    '音楽 … 声が鳴っているあいだは小さくする(1 を超えない)',
    `${bgmVolume(false)} → ${bgmVolume(true)}`)

  /* ── 画面が、本当に呼んでいるか ────────────────────────── */
  {
    const 落とす = (t) => t.replace(/\/\*[\s\S]*?\*\/|\{\/\*[\s\S]*?\*\/\}/g, '')
    const wb = 落とす(readFileSync(
      new URL('../src/components/Wordbook.jsx', import.meta.url), 'utf8'))
    const radio = 落とす(readFileSync(
      new URL('../src/components/WordRadio.jsx', import.meta.url), 'utf8'))
    const bgmjs = 落とす(readFileSync(
      new URL('../src/lib/bgm.js', import.meta.url), 'utf8'))
    const app = 落とす(readFileSync(
      new URL('../src/App.jsx', import.meta.url), 'utf8'))

    ok(/<WordRadio/.test(wb), '聞き流し … 単語帳から入れる')
    /* **出題とまったく同じ道で語を選ぶ**(数え方を2通り持たない) */
    ok(/const pool = poolNow\(\)/.test(wb) && /setRadio\(pool\)/.test(wb),
      '聞き流し … 読む語は、出題と同じ `poolNow()` から選んでいる')
    ok(/= radioSteps\(row, mode\)/.test(radio),
      '聞き流し … 読む順は `radioSteps()` に任せている')
    ok(/bgmPlaysIn\(loadBgmPlace\(\), 'radio'\)/.test(radio),
      '聞き流し … 音楽を流すかどうかを `bgmPlaysIn()` に任せている')
    ok(/duckBgm\(true\)/.test(radio) && /duckBgm\(false\)/.test(radio),
      '聞き流し … 声が鳴っているあいだ、曲を小さくしている')
    /* **記録は1ミリも動かさない**(答える練習ではない) */
    ok(!/setWordStatus|mark_word|shouldRecord/.test(radio),
      '聞き流し … 箱も次に出す日も動かさない')
    /* **止まる条件を持たせる**(CLAUDE.md) */
    ok(/stopBgm\(\)/.test(radio) && /stopReading\(\)/.test(radio),
      '聞き流し … 画面を離れたら、声も曲も止まる')

    /* **音の通り道を変えない**(2026-09 にいちばん高くついた失敗) */
    ok(!/createMediaElementSource|createGain|AudioContext/.test(bgmjs),
      '音楽 … Web Audio を通していない(`volume` だけを動かす)')
    ok(/new Audio\(\)/.test(bgmjs) && (bgmjs.match(/new Audio\(\)/g) ?? []).length === 1,
      '音楽 … `<audio>` は1つだけ作る')

    ok(/id: 'bgm', label: '音楽'/.test(app) && /<BgmLibrary/.test(app),
      '音楽 … トレーナーのメニューに「音楽」がある')
    /* **下の帯は4つのまま**(利用者が「この四つにしてください」と決めた) */
    ok(!/TAB_IDS = \[[^\]]*'bgm'/.test(app),
      '音楽 … 下の帯(4つ)には足していない')
  }
}

/* ==========================================================================
 * ゲスト名の箱(2026-09 利用者の指定)
 *
 *   > ゲストを一人選んでそのページの中にいるときは、
 *   > 常に画面上部にゲスト名ボックスが固定されているようにしたいです。
 * ========================================================================== */
{
  console.log('\n▶ ゲスト名の箱')

  /* ── 控えは1か所。**名前も一緒に持つ**(id だけでは箱に書けない)── */
  rememberLearner(null)
  ok(openLearner() === null && lastLearner() === null,
    '控え … 開いていなければ null')

  let 知らせ = 0
  const やめる = watchLearner(() => { 知らせ += 1 })
  rememberLearner('g1', { name: 'あいり', status: 'active' })
  ok(lastLearner() === 'g1' && openLearner()?.name === 'あいり',
    '控え … 名前と状態も一緒に控える', JSON.stringify(openLearner()))
  ok(知らせ === 1, '控え … 変わったら1回だけ知らせる', String(知らせ))

  /* **同じ中身なら知らせない。** 描き直しが止まらなくなる
     (`voicePool` で踏んだのと同じ落とし穴) */
  rememberLearner('g1', { name: 'あいり', status: 'active' })
  ok(知らせ === 1, '控え … 同じ中身では知らせない(描き直しが止まらなくなる)',
    String(知らせ))

  rememberLearner(null)
  ok(知らせ === 2 && openLearner() === null,
    '控え … 忘れたときも知らせる(箱を消す)')
  /* **二度忘れても、二度は知らせない** */
  rememberLearner(null)
  ok(知らせ === 2, '控え … すでに空なら、もう知らせない', String(知らせ))
  やめる()
  rememberLearner('g2', { name: 'けんじ' })
  ok(知らせ === 2, '控え … 見張りをやめたら、もう来ない', String(知らせ))
  rememberLearner(null)

  /* ── 画面が、本当に呼んでいるか ────────────────────────── */
  {
    const 落とす = (t) => t.replace(/\/\*[\s\S]*?\*\/|\{\/\*[\s\S]*?\*\/\}/g, '')
    const app = 落とす(readFileSync(
      new URL('../src/App.jsx', import.meta.url), 'utf8'))
    const tl = 落とす(readFileSync(
      new URL('../src/components/TrainerLearners.jsx', import.meta.url), 'utf8'))
    const bar = 落とす(readFileSync(
      new URL('../src/components/LearnerBar.jsx', import.meta.url), 'utf8'))
    const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8')

    /* **貼り付く箱の中に入れる。** 外に置くと `top` に帯の高さを
       書くことになり、端末の切り欠きでずれる(`.jobbar` で踏んだ穴) */
    ok(/<div className="app-stick">[\s\S]{0,900}<LearnerBar \/>/.test(app),
      'ゲスト名の箱 … `.app-stick` の中に入れている')
    /* **ゲストの画面にいるときだけ。** 控えは残るが、
       「教材」はそのゲストのページではない */
    ok(/view === 'learners' && <LearnerBar \/>/.test(app),
      'ゲスト名の箱 … ゲストの画面にいるときだけ出す')
    /* **自分では貼り付かない**(`.jobbar` とまったく同じ決まり) */
    const 箱 = /\.learnerbar\s*\{[^}]*\}/.exec(css)?.[0] ?? ''
    ok(箱 && !/position:\s*sticky|position:\s*fixed/.test(箱),
      'ゲスト名の箱 … 自分では貼り付かない(貼り付く役は `.app-stick` 1つ)')

    ok(/rememberLearner\(openId, \{ name: l\.display_name/.test(tl),
      'ゲスト名の箱 … 名前と状態を渡している')
    /* **箱の「← 一覧」を押したら、こちらも閉じる。**
       合わせないと、箱だけ消えてゲストのページが残る */
    ok(/watchLearner\(\(who\) => \{/.test(tl) && /setOpenIdRaw\(null\)/.test(tl),
      'ゲスト名の箱 … 箱から閉じたとき、ゲストのページも閉じる')
    /* **同じものを2か所に出さない。** 上の「← ゲストの一覧に戻る」は移した */
    ok(!/learner-back/.test(tl),
      'ゲスト名の箱 … 中身の側の「← ゲストの一覧に戻る」は残っていない')
    ok(/openId !== l\.id && \(/.test(tl),
      'ゲスト名の箱 … 開いているあいだ、カードの側に名前を出さない')
    /* **状態の対応表を2か所に持たない** */
    ok(/statusLabel|statusCls/.test(bar) && /learnerStatus\.js/.test(tl),
      'ゲスト名の箱 … 状態の対応表は `learnerStatus.js` 1か所')
  }
}

/* ==========================================================================
 * ゲストのページの中でも、教材をさがせる(2026-09 利用者の指定)
 *
 *   > 同じくゲストページ内で自分の教材を検索できるようにしたいぞ。
 *   > 要するにトレーナーの教材の画面の表示と同じようにしてくれ
 * ========================================================================== */
{
  console.log('\n▶ ゲストのページの中の、教材をさがす')

  const 落とす = (t) => t.replace(/\/\*[\s\S]*?\*\/|\{\/\*[\s\S]*?\*\/\}/g, '')
  const tl = 落とす(readFileSync(
    new URL('../src/components/TrainerLearners.jsx', import.meta.url), 'utf8'))
  const tm = 落とす(readFileSync(
    new URL('../src/components/TrainerMaterials.jsx', import.meta.url), 'utf8'))

  /* **部品は1つ。書き写さない**(単語帳で3度言われた失敗) */
  ok(/<TrainerMaterials\s/.test(tl),
    '教材をさがす … ゲストのページでも、同じ部品(`TrainerMaterials`)を出している')
  ok(/<option value="library">教材をさがす<\/option>/.test(tl),
    '教材をさがす … 切り替えに「教材をさがす」がある')
  /* **再利用がこの仕組みの前提**なので、「作る」より先に置く */
  ok(tl.indexOf('value="library"') < tl.indexOf('value="create"'),
    '教材をさがす … 「この人に教材を作る」より先に置いている')

  /* **ほかのゲストの名前を、1つも出さない**(仕様書 5.5) */
  ok(/forLearner=\{\{ id: l\.id, name: l\.display_name \}\}/.test(tl),
    '教材をさがす … 共有先はその1人に決めている')
  ok(/\{forLearner \? \(/.test(tm),
    '教材をさがす … ゲストを選ぶ欄そのものを出していない')
  ok(/setPicked\(forLearner \? \[forLearner\.id\] : \[\]\)/.test(tm),
    '教材をさがす … 相手が決まっているので、はじめから選んである')

  /* **同じことをするものを2つ見せない。** 作る道はとなりのタブにある */
  ok(/onCreate=\{\(\) => setDetailTab\('create'\)\}/.test(tl),
    '教材をさがす … 「教材を作る」はとなりのタブへ回している')
  /* **作りに行く道は1か所**(3つのボタンに書き写さない) */
  ok(!/onClick=\{\(\) => setMode\('create'\)\}/.test(tm)
    && (tm.match(/onClick=\{goCreate\}/g) ?? []).length >= 3,
    '教材をさがす … 作りに行く道は `goCreate()` 1か所',
    String((tm.match(/onClick=\{goCreate\}/g) ?? []).length))

  /* **「配信する」と書かない**(CLAUDE.md の呼び方) */
  ok(!/'配信する'/.test(tm) && !/>配信する</.test(tm),
    '呼び方 … 「配信する」ではなく「共有する」と書いている')
}

/* ==========================================================================
 * ゲストの「今週の宿題」にも、さがす・しぼるを置く(2026-09 利用者の指定)
 *
 *   > ③ ゲストのページの中で、教材をさがせます(中略)
 *   > これを、ゲストとしてログインし、今日の宿題のところにも実装してください
 *
 * 【なぜトレーナーの画面をそのまま置かないか】
 *   あちらは**スクールの教材ライブラリぜんぶ**を引く画面で、
 *   **押すと課金になる操作**(読み上げ音声を作り直す)と、
 *   ゲストにできない操作(作る・共有する・消す)が並んでいる。
 *   しかも宿題のカードは**もう出ている**ので、並べると二重になる。
 * ========================================================================== */
{
  console.log('\n▶ 今週の宿題の、さがす・しぼる')

  const 落とす = (t) => t.replace(/\/\*[\s\S]*?\*\/|\{\/\*[\s\S]*?\*\/\}/g, '')
  const hw = 落とす(readFileSync(
    new URL('../src/components/LearnerHomework.jsx', import.meta.url), 'utf8'))
  const tl = 落とす(readFileSync(
    new URL('../src/components/TrainerLearners.jsx', import.meta.url), 'utf8'))
  const mat = readFileSync(
    new URL('../src/lib/materials.js', import.meta.url), 'utf8')

  const 宿題 = (id, opt = {}) => ({
    id,
    assigned_at: opt.at ?? '2026-09-01T09:00:00.000Z',
    learner_done_at: opt.done ? '2026-09-02T09:00:00.000Z' : null,
    material: {
      title: opt.title ?? '教材',
      headline: opt.headline ?? '',
      industry: opt.industry ?? null,
      scene: opt.scene ?? null,
      genre: opt.genre ?? null,
      tagIds: opt.tags ?? [],
    },
  })

  const rows = [
    宿題('a', { at: '2026-09-01T09:00:00.000Z', title: '朝の打ち合わせ', industry: 'it', tags: ['articles'] }),
    宿題('b', { at: '2026-09-03T09:00:00.000Z', title: 'Kickoff meeting', headline: 'New Site', industry: 'const', done: true }),
    宿題('c', { at: '2026-09-05T09:00:00.000Z', title: '食事の話', industry: 'it', tags: ['prepositions'] }),
  ]

  /* ── 絞る ── */
  ok(applyHomeworkFilter(rows, emptyHomeworkFilter()).length === 3,
    'さがす・しぼる … 何も絞らなければ、そのまま全部')
  ok(applyHomeworkFilter(rows, { field: 'it' }).map((a) => a.id).join('') === 'ac',
    'さがす・しぼる … 分野で絞れる')
  ok(applyHomeworkFilter(rows, { tag: 'articles' }).map((a) => a.id).join('') === 'a',
    'さがす・しぼる … 苦手項目で絞れる')
  ok(applyHomeworkFilter(rows, { day: assignedDayOf(rows[1]) })
    .map((a) => a.id).join('') === 'b',
    'さがす・しぼる … 日付で絞れる')
  ok(!homeworkFilterOn(emptyHomeworkFilter()) && homeworkFilterOn({ tag: 'x' }),
    'さがす・しぼる … 絞り込みが掛かっているかを1か所で見る')
  /* **場面と話題は1つの欄。** 教材はどちらか一方しか持たない */
  ok(topicOfAssignment(宿題('x', { scene: 'meeting' }))?.key === 's:meeting'
    && topicOfAssignment(宿題('y', { genre: 'business' }))?.key === 'g:business'
    && topicOfAssignment(宿題('z')) === null,
    'さがす・しぼる … 場面と話題は1つの鍵にまとめている')

  /* ── 引く ── */
  ok(narrowHomework(rows, { keyword: 'きっく' }).length === 0
    && narrowHomework(rows, { keyword: 'KICKOFF' }).map((a) => a.id).join('') === 'b',
    'さがす・しぼる … 教材名は大文字小文字を問わずに引ける')
  ok(narrowHomework(rows, { keyword: 'new site' }).map((a) => a.id).join('') === 'b',
    'さがす・しぼる … 見出しでも引ける')

  /* ── 並べる ── */
  ok(narrowHomework(rows, {}).map((a) => a.id).join('') === 'cba',
    'さがす・しぼる … 既定は新しい順')
  ok(narrowHomework(rows, { sort: 'old' }).map((a) => a.id).join('') === 'abc',
    'さがす・しぼる … 古い順にもできる')
  ok(narrowHomework(rows, { done: 'todo' }).map((a) => a.id).join('') === 'ca'
    && narrowHomework(rows, { done: 'done' }).map((a) => a.id).join('') === 'b',
    'さがす・しぼる … やった / まだ でも絞れる(トレーナーの画面が使う)')
  /* **元の一覧を並べ替えてしまわない**(`sort` は破壊的である) */
  ok(rows.map((a) => a.id).join('') === 'abc',
    'さがす・しぼる … 渡された一覧そのものを並べ替えない')

  /* ── 画面が本当に呼んでいるか ──
     **「名前が出てくるか」で見ない。** 説明の中にも同じ語が出てくる */
  ok(/<SearchBar\s/.test(hw) && /collapsible/.test(hw),
    '今週の宿題 … 畳めるさがす帯(`SearchBar`)を出している')
  /* **箱の中に入っているか**(2026-09 実機・利用者の指定
       > 日付や絞り込みのプルダンは
       > 「宿題をさがす・しぼる」の中にしまって欲しいです
     「名前が出てくるか」では、外に戻しても緑のままになる。
     開きタグ → `HomeworkFilter` → 閉じタグ の順で書いてあるかを見る */
  ok(/<HomeworkFilter\s/.test(hw)
    && hw.indexOf('<HomeworkFilter') > hw.indexOf('<SearchBar')
    && hw.indexOf('</SearchBar>') > hw.indexOf('<HomeworkFilter'),
    '今週の宿題 … 絞り込み(`HomeworkFilter`)を、さがす箱の中に出している')
  ok(/= narrowHomework\(assignments, \{/.test(hw),
    '今週の宿題 … 絞る・引く・並べるは `narrowHomework()` に任せている')
  ok(/= narrowHomework\(assignments, \{/.test(tl),
    '過去の宿題 … トレーナーの画面も同じ `narrowHomework()` を通っている')
  /* **控えは別に持つ。** 片方を閉じて、もう片方まで閉じては困る */
  ok(/loadHwSearchOpen/.test(hw) && /saveHwSearchOpen/.test(hw)
    && !/loadPastSearchOpen/.test(hw),
    '今週の宿題 … 開け閉ての控えは、トレーナーの画面と別に持っている')
  /* **絞り込みで消えたのか、そもそも無いのかを分ける** */
  ok(/しぼり込みを外してください/.test(hw),
    '今週の宿題 … 絞り込みで0件になったら、そう言う')

  /* ── 「今週の宿題」の箱は置かない(2026-09 利用者の指定)──
       中の3つは、どれも別の場所が同じことを言っていた。
       **ただし「まだ届いていません」の案内だけは残す** ——
       消すと、宿題が1件も無いゲストの画面がまっさらになる */
  ok(!/card-title">今週の宿題/.test(hw),
    '今週の宿題 … 見出しの箱を置いていない(上の帯が画面の名前を出す)')
  ok(!/rate-pick/.test(hw),
    '今週の宿題 … 効いていなかった「読み上げの速さ」を出していない')
  ok(/まだ宿題は届いていません/.test(hw),
    '今週の宿題 … 届いていないときの案内は残っている(行き止まりを作らない)')
  /* **見出し(「やったもの」「取り組む」)は1つも出さない**
     (2026-09 利用者の指定。この順に外した)。
     カードの1行目が日付と「やった / まだ」の札で名乗っている。

     **「無い」だけを見ない**(CLAUDE.md)。それだけだと、
     **カードごと消しても緑のまま**になる。
     ①見出しが無いか ②2つとも並んでいるか、の両側を見る */
  ok(!/'やったもの'/.test(hw) && !/やったもの\(/.test(hw),
    '今週の宿題 … 「やったもの」の見出しを出していない')
  ok(!/'取り組む'/.test(hw) && !/取り組む\(/.test(hw),
    '今週の宿題 … 「取り組む」の見出しも出していない')
  ok(!/className="section-title">\{label\}/.test(hw) && !/\{label &&/.test(hw),
    '今週の宿題 … 見出しを出す仕組みごと外してある(値を偽にするだけにしない)')
  ok(/\{ id: 'todo', list: todo \}/.test(hw)
    && /\{ id: 'done', list: done \}/.test(hw),
    '今週の宿題 … まだ / やった のカードは、この順で並んでいる')

  /* ── ゲストに、課金になる操作を見せない ──
     トレーナーの「教材」画面をそのまま置くと、
     「読み上げ音声を作り直す」(そのまま ElevenLabs への課金)や
     教材を作る・共有する・消すが、ゲストの画面に出る */
  ok(!/<TrainerMaterials/.test(hw),
    '今週の宿題 … トレーナーの教材画面を、そのまま置いていない')
  ok(!/VoiceRemake|MaterialDelete|MaterialShare|startPrepareAll/.test(hw),
    '今週の宿題 … 作り直す・消す・共有する・裏で支度する、を出していない')

  /* ── 絞り込みが引くものを、本当に取ってきているか ──
     取ってこないと**選択肢が1つも出ず、絞り込みごと消える**。
     しかも**画面は普通に出る**ので気づけない */
  const 宿題の欄 = mat.slice(mat.indexOf('export async function loadMyAssignments'),
    mat.indexOf('export async function markAssignmentDone'))
  ok(/\bindustry\b/.test(宿題の欄),
    '今週の宿題 … 分野(`industry`)を取ってきている')
  ok(/material_tags \( tag_id \)/.test(宿題の欄),
    '今週の宿題 … 苦手項目(`material_tags`)を取ってきている')
}

console.log(ng
  ? `\n❌ ${ng} 件が意図どおりではありません`
  : '\n✅ 止めた場所からの再生の検証は、すべて意図どおりです')
process.exit(ng ? 1 : 0)
