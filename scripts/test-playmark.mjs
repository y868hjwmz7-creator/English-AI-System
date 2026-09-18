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
  DEFAULT_FORM, DEFAULT_ORDER, QUIZ_FORMS, SESSION_SIZE, WORD_ORDERS,
  buildSession, formOf, isSelfGraded, orderOf, orderWords, pickForm,
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
  EXERCISE_TYPES, SCALABLE_SECTIONS, amountsFor, answerHasAudio, defaultSectionsFor,
  exerciseLabel, isPassageSection, noteIsAnswer, sectionLabel, sectionsFor,
} from '../src/data/exerciseTypes.js'
import { canDeleteMaterial, deleteWarning } from '../src/lib/materialDelete.js'
import { PLACES, PLACE_TO, nextPlace, placeFor } from '../src/lib/playerPlace.js'
import { clampPos } from '../src/lib/dragBox.js'
import {
  bookLabel, cssString, qrSheetPairs, sheetNote, sheetTitle, wordSheetPairs,
} from '../src/lib/reviewSheet.js'
import {
  MAX_SPEECH_CHARS, SPEECH_COST_YEN, SPEECH_LEVEL_FALLBACK, isBlankDraft,
  isReviewed, sortSpeeches, speechCostYen, speechLevelOf, speechLines,
  speechParts, speechPhrases, speechTitleOf, speechWholeSlice, speechWordList,
  tooLongDraft,
} from '../src/lib/speechPractice.js'
import { MAX_WRITING_CHARS } from '../src/lib/writingReview.js'
import {
  markIndexAt, marksFromTimes, sentenceShares, sentenceTimesOf, wordSpans,
} from '../src/lib/wordTiming.js'
import { charTimesOf } from '../src/lib/wholeAudio.js'
import {
  JOB_COST, SCENE_HINT_MAX, SHELF_PICK_KEY, WORDS_PER_BOOK, WORDS_PER_JOB,
  isShelf, levelTally, pickedShelves, shelfFeature,
  shelfCountOf, shelfIdOfFeature, shelfList, shelfOf, shelfSceneNames, shelfScenes, shelfTarget,
  shelfTodo, shelvesFor, showsShelf,
} from '../src/data/shelves.js'
import { CEFR_LEVELS, SHELF_LEVELS, cefrOption } from '../src/data/cefr.js'
import { INDUSTRIES } from '../src/data/industries.js'
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
  BASICS, LEARNER_FEATURES, featureOf, showsBasics,
} from '../src/data/learnerFeatures.js'
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
  BGM_PLACES, DEFAULT_RADIO_GAP, QR_RADIO_MODES, RADIO_GAPS, RADIO_MODES,
  bgmPlaysIn, drillChunks, hidesAnswer,
  nextIndex, radioGapsOf, radioJaOf, radioLead, radioModeOf,
  radioModesFor, radioSteps, radioTextOf,
} from '../src/lib/wordRadio.js'
import {
  DEFAULT_BGM, DEFAULT_VOICE, VOL_STEP,
  bgmLevel, clampLevel, pctLabel, setBgmLevel, setVoiceLevel, voiceLevel,
  volumeWorks,
} from '../src/lib/mixVolume.js'
import {
  applyHomeworkFilter, assignedDayOf, emptyHomeworkFilter,
  homeworkFilterOn, narrowHomework, topicOfAssignment,
} from '../src/lib/homeworkFilter.js'
import {
  KNOWN_AFTER as PROMOTE_KNOWN_AFTER, PROMOTE_MAX,
  pickPromotions, promotableOf,
} from '../src/lib/qrPromote.js'
import {
  NATIVE_FLOW_UNITS, nativeFlowRows, nfFeature, nfUnitOfFeature,
  nfUnitsFor, showsNfUnit, unitName, unitTitle,
} from '../src/data/nativeFlow.js'
import { QR_ORDERS, orderQrPairs } from '../src/lib/qrOrder.js'
import { frameFormOf } from '../src/lib/frameMatch.js'
import {
  CLIP_ACCENTS, JA_VOICE, accentsWithVoices, elevenIdOf, voicesOfAccent,
} from '../src/data/clipVoices.js'
import { NATIVE_FLOW } from '../src/data/nativeFlow.js'
import { FRAME_SECTIONS } from '../src/data/sentenceFrames.js'
import { existsSync, readFileSync, readdirSync } from 'node:fs'

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
      /* ここから 2026-09 に足したあいさつまわり(第5.182節・利用者の指定
         「挨拶、クライアントとのプロジェクトの初めての挨拶、など
         考えられる場面を作り出してください」) */
      'sp_greet', 'sp_client1st', 'sp_visit', 'sp_welcome', 'sp_online',
      'sp_newyear', 'sp_social', 'sp_thanks', 'sp_closing',
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
    /* **第5.178節で `owner` 1つに寄せた。** 生の `learnerId` を配ると、
       帯の名札で切り替えても、ここだけ前の相手のままになる */
    ok(/learnerId=\{owner\}/.test(view),
      '誰の記録になるかを渡している(0025 / 第5.178節)')
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
    /* **窓口はいちばん大きい上限を持つ**(2026-09・0054)。
       画面の側は置く場所ごとに上限を持ち、ディスカッションの答えは
       1,500(`MAX_WRITING_CHARS`)、スピーチの原稿は 3,000
       (`MAX_SPEECH_CHARS`)。**小さいほうに合わせると、
       スピーチの終わりが黙って落ちる** */
    ok(Number(/body\.answer \?\? ''\)\.trim\(\)\.slice\(0, (\d+)\)/.exec(fn)?.[1] ?? 0) >= 1500,
      '窓口でも長さを切っている(最後の関所)')

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

  /* ── 選べる形は4つ。**「おまかせ」と「つづりを書く」は外した** ──
     (2026-09 実機・利用者の指定「実際にはおまかせではなくずっと四択なので
     なくしましょう。そして、綴りを描くもいらないです」) */
  ok(QUIZ_FORMS.length === 4, '選べる形は4つ')
  ok(QUIZ_FORMS.some((f) => f.id === 'cloze'), '穴埋めは残っている')
  ok(!QUIZ_FORMS.some((f) => f.id === 'spell'), 'つづりを書くは外した')
  ok(!QUIZ_FORMS.some((f) => f.id === 'auto'), 'おまかせは一覧に無い')
  ok(DEFAULT_FORM === 'choice', '既定は4択')
  /* **端末に残った古い id を、そのまま渡さない。**
     消した `auto` / `spell` が localStorage に残っている人がいる */
  ok(formOf('auto') === 'choice' && formOf('spell') === 'choice',
    '消した形は既定に落ちる')
  ok(formOf('cloze') === 'cloze', '在る形はそのまま')
  ok(pickForm({ box: 0, meaning_ja: '研修生' }, [], 'auto') !== 'spell',
    'おまかせを渡しても、つづりにはならない')

  /* **出会った文が無い語では「思い出す」に落ちる。**
     0047 で単語帳に入れた語には、出会った文が無い */
  ok(pickForm({ seen_in: S, display: 'intern', meaning_ja: '研修生' }, [], 'cloze')
     === 'cloze', '文があれば穴埋めで出る')
  ok(pickForm({ seen_in: null, display: 'intern', meaning_ja: '研修生' }, [], 'cloze')
     === 'recall', '文が無ければ思い出すに落ちる(行き止まりを作らない)')

  /* **自分で答え合わせをする形。** ここが
     「カードを画面いっぱいに伸ばすか」も決めている(`wordcard--recall`) */
  ok(isSelfGraded('cloze'), '穴埋めは自分で答え合わせをする形')
  ok(!isSelfGraded('choice'), '4択は機械が判定する(伸ばさない)')

  /* ── 並べ方(ランダム / 教材ごと)── 2026-09 利用者の指定 */
  ok(WORD_ORDERS.length === 2 && DEFAULT_ORDER === 'random', '並べ方は2つ。既定はランダム')
  ok(orderOf('material') === 'material' && orderOf('zzz') === 'random',
    '知らない並べ方は既定に落ちる')
  const MIX = [
    { word_norm: 'a', material_title: '2026-09-01 / 朝礼' },
    { word_norm: 'b', material_title: '' },
    { word_norm: 'c', material_title: '2026-09-08 / 交渉' },
    { word_norm: 'd', material_title: '2026-09-01 / 朝礼' },
  ]
  const byMat = orderWords(MIX, 'material').map((r) => r.word_norm)
  ok(byMat.length === 4, '**1語も落とさない**(並べ替えは減らす道具ではない)')
  ok(byMat[0] === 'c', '新しい教材が先')
  ok(byMat[1] === 'a' && byMat[2] === 'd', '同じ教材はまとまる')
  ok(byMat[3] === 'b', '教材の無い語(手で入れた語)は、いちばん後ろ')
  ok(orderWords(MIX, 'random').length === 4, 'ランダムでも数は変わらない')
  /* **「教材ごと」を選んだら混ぜない。** 混ぜたら選んだ意味が無い */
  const sess = buildSession(MIX, 4, { shuffleAll: true, order: 'material' })
  ok(sess.map((r) => r.word_norm).join('') === 'cadb',
    '「教材ごと」では、混ぜずにその並びで出す')

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
  /* **開け閉めは呼ぶ側が持つ**(2026-09 に「共有」をボタン1つへまとめた)。
     `material={m}` だけを探すと、**ゲストと共有の道を落としても緑**になる */
  ok(/<MaterialShare\s+material=\{m\}/.test(tm)
    && tm.includes('open={assigningId === m.id}')
    && tm.includes('guest={('),
    '画面が `MaterialShare` を置き、ゲストと共有の中身を渡している')
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

  /* ── 渡す道は、ボタン1つ(2026-09 利用者の指定)──────────────────

       > 「教材をシェア」と「教材をゲストと共有」はボタンをひとつにして
       > その中でゲストと共有なのか普通の共有なのかを選べるように

     **「札があるか」だけを見ない。** それだと、**ゲスト側を出さない形**に
     書き換えても緑になる。**どちらが既定か**と、
     **渡されていなければリンクに落ちるか**まで見る。 */
  ok(ms.includes("['guest', 'ゲストと共有'], ['link', 'リンクを渡す']"),
    '**2つから選べる**(ゲストと共有 / リンクを渡す)')
  ok(ms.includes("useState(guest ? 'guest' : 'link')")
    && ms.includes("setWay(guest ? 'guest' : 'link')"),
    '**既定はゲストと共有。** 開くたびにそこから始める')
  ok(ms.includes("const now = guest ? way : 'link'"),
    '**ゲストを渡されていなければ、その道は無い**(効かない操作を見せない)')
  ok(ms.includes("now === 'guest' ? (") && ms.includes('guest\n'),
    '**並べない。入れ替える** —— 並べると箱が画面2枚ぶんになる')
  /* **開け閉めは呼ぶ側が持つ。** 中に閉じ込めると、共有し終わったときに
     閉じる合図をもう1本渡すことになる */
  ok(ms.includes('onOpen') && ms.includes('onClose') && !ms.includes('useState(false)'),
    '**開け閉めは外から決める**(`open` / `onOpen` / `onClose`)')
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

  /* ── **間(ま)のある本物の音声で、光り出す秒がずれないか**(2026-09 実測)
   *
   *   > やっぱり再生中の英文のハイライトが実際の音とずれます。
   *
   * 上の `align()` には間が1つも無いので、**壊しても気づけない。**
   * 文と文のあいだに 0.5 秒の間を入れた時刻を作って、
   * 「2文目が光り出す秒」と「2文目が本当に鳴り出す秒」を突き合わせる。
   * ── */
  {
    const GAP = 'Hi there. How are you?'
    const chars = []
    const from = []
    const to = []
    let t = 0
    for (let i = 0; i < GAP.length; i += 1) {
      const ch = GAP[i]
      chars.push(ch)
      if (/\s/.test(ch)) {
        // 文の切れ目(`.` の直後の空白)にだけ、0.5 秒の間を置く
        const pause = GAP[i - 1] === '.' ? 0.5 : 0
        from.push(t); t += pause; to.push(t)
        continue
      }
      from.push(t); t += 0.1; to.push(t)
    }
    const al = {
      characters: chars,
      character_start_times_seconds: from,
      character_end_times_seconds: to,
    }
    const tm = charTimesOf(al, GAP)
    const ms = marksFromTimes(GAP, tm)
    const ss = sentenceTimesOf(GAP, tm)
    const head = GAP.indexOf('How')
    let lit = null
    for (let x = 0; x < 6000; x += 10) {
      const i = markIndexAt(ms, x)
      if (i >= 0 && ms[i].at >= head) { lit = x / 1000; break }
    }
    ok(Math.abs(ss[1].start - 1.3) < 0.001,
      '2文目は 1.3 秒から鳴る(`Hi there.` 0.8 秒 + 間 0.5 秒)')
    ok(lit !== null && Math.abs(lit - ss[1].start) <= 0.011,
      '**間があっても、2文目は鳴り出す秒に光る**'
      + `(光る ${lit} 秒 / 鳴る ${ss[1].start} 秒)`)
  }

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
  /* **版そのものを書き写さない**(2026-09)。ここが見たいのは
     「**時刻の控えが入った版より新しいか**」であって、いまの値ではない。
     等号で書いていたので、**別の回で版を進めるたびにここが赤くなった。**
     版がそろっているかは `npm run test:voice` が見ている */
  const TIMESTAMPS_FROM = '2026-09-07'
  const fnRev = sp.match(/^const FN_REV = '([^']+)'/m)?.[1] ?? ''
  ok(fnRev >= TIMESTAMPS_FROM, `窓口の版が ${TIMESTAMPS_FROM} 以降である(いま ${fnRev || '読めない'})`)

  const ac = readFileSync(new URL('../src/lib/audioClips.js', import.meta.url), 'utf8')
  const needRev = ac.match(/^export const NEED_FN_REV = '([^']+)'/m)?.[1] ?? ''
  ok(needRev >= TIMESTAMPS_FROM && needRev === fnRev,
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
    /* **段の名前は、単語帳も Quick Response も同じ**(2026-09 利用者の指定
       「統一感が欲しいのです」「使い方や数の概念がよく分からないようです」)。

       **前の決定を上書きしている** —— もとは「単語帳は語、Quick Response は
       文だから言葉を分ける」として「覚えた」/「言える」にしていた。
       **ゲストには伝わっていなかった。**

       **値を書き写さず、2つがそろっているかを見る。**
       片方だけ書き換えても赤くなる —— そこが、この見張りの仕事である */
    ok(QR_GROUPS.map((g) => g.label).join('/')
       === WORD_GROUPS.map((g) => g.label).join('/'),
      '復習の数 … 段の名前が、単語帳と Quick Response で同じ',
      `${WORD_GROUPS.map((g) => g.label).join('/')} / ${QR_GROUPS.map((g) => g.label).join('/')}`)
    ok(WORD_GROUPS.map((g) => g.label).join('/') === 'まだ/練習中/できた',
      '復習の数 … 段の名前は「まだ / 練習中 / できた」',
      WORD_GROUPS.map((g) => g.label).join('/'))
    /* **「できた」は語でも文でも型でも真になる。**
       66 の型の画面も、同じ言葉を使っている */
    {
      /* **この節には `readD` が無い**(下のほうの節だけが持っていた)。
         借りずに、その場で読む —— **無い名前を呼ぶと、そこで落ちて
         残りの検証がまるごと走らなくなる**(実際にそうなった) */
      /* **66 の型は、Quick Response の冊になった**(2026-09 利用者の指定
         「型のトレーニングの UI は廃止して、quick response の UI に
         そのままコンテンツを移してください」)。
         専用の画面が無くなったので、段の札も答えのボタンも
         **ふだんの Quick Response とまったく同じもの**である。
         残った欄(`FrameParts`)の言葉だけを、ここで見る */
      const fparts = readFileSync(new URL('../src/components/FrameParts.jsx',
        import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
      ok(/できた/.test(fparts) && !/言えた/.test(fparts),
        '復習の数 … 66 の型の欄も、同じ言葉を使っている(「言えた」は残っていない)')

      /* **紙にも、同じ言葉が出るか**(2026-09)。
         `Wordbook.jsx` の `VIEWS` が段の名前を**書き写していた**ので、
         **画面は「できた」・紙は「覚えた」**になっていた。
         **呼び名を2か所に書かない**(CLAUDE.md)。

         **「無い」と「有る」の両方を見る** —— 書き写しが消えただけでは、
         紙にどこからも名前が出ない形に落ちても緑になる */
      const wbSrc = readFileSync(new URL('../src/components/Wordbook.jsx',
        import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
      ok(!/label: '覚え/.test(wbSrc),
        '復習の数 … 段の名前を `VIEWS` に書き写していない(紙だけ古くならない)')
      ok(/WORD_GROUPS\.find\(\(g\) => g\.id === current\.id\)/.test(wbSrc),
        '復習の数 … 紙の「どの段か」も `WORD_GROUPS` から引く')
    }
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
    ok(groupLead(QR_GROUPS, 'done').includes('「できた」')
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
    /* 単語帳には**並べ方**が増えた(2026-09)。Quick Response には無い */
    ok(/runKeyOf\(\{ scope, size, filter, group, order \}\)/.test(wb)
      && /runKeyOf\(\{ scope, size, filter, group \}\)/.test(qr),
      '出しかた … 変わったかどうかを `runKeyOf()` で見張っている')

    /* ── 出題の形・並べ方・繰り返す(2026-09 実機・利用者の指定)──
       > スマホでの「おまかせ」が画面に入り切らずに切れています。
       > …出し方の中に、「ランダムで」と「教材ごと」選んだを選べるように、
       > また一度に出す個数の横に「繰り返す」ボタンも作ってください */
    const rd = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')
    const rs = rd('src/components/ReviewScope.jsx')
    ok(/forms && forms\.length > 0 &&/.test(rs) && /orders && orders\.length > 0 &&/.test(rs),
      '出しかた … 渡さなければ、その行ごと出さない(効かない操作を見せない)')
    ok(/onRepeat && \(/.test(rs), '出しかた … 繰り返すも、渡したときだけ出す')
    /* **「一度に出す個数の横」**(利用者の指定)。同じ `chiprow` の中にいる */
    ok(/aria-labelledby="rscope-many"[\s\S]{0,900}?rscope-repeat[\s\S]{0,200}?<\/div>/.test(rs),
      '出しかた … 繰り返すは、何語ずつと同じ行にある')
    /* **画面が本当に渡しているか。** 定義だけあっても何も出ない */
    ok(/forms=\{QUIZ_FORMS\}/.test(wb) && /orders=\{WORD_ORDERS\}/.test(wb),
      '出しかた … 単語帳が、形と並べ方を渡している')
    ok((wb.match(/onRepeat=\{\(on\) =>/g) ?? []).length === 2,
      '出しかた … 始める前と、復習の最中の**両方**に渡している')
    /* **上の帯からは外した。** スマホで画面から切れていた */
    ok(!/wb-formpick/.test(wb), '出しかた … 上の帯に出題の形を置いていない')
    ok(!/おまかせ/.test(wb), '出しかた … 「おまかせ」という言葉を画面に出していない')
    /* **繰り返すなら、行き止まりを作らない** */
    ok(/: repeat[\s\S]{0,400}?もう一度この範囲を回す/.test(wb),
      '出しかた … 繰り返すなら、出し切っても止まらない')
    ok(/この範囲は終わりです/.test(wb),
      '出しかた … 繰り返さないときは、これまでどおり終わりと言う')

    /* ── 読める語の上限(0056)── 2026-09 実機・利用者の問い
       > なぜ「まだ」が1900個以上あるのに出し方で選べるのが200個なのですか？ */
    ok(/limit: WORDBOOK_LIMIT,/.test(wb),
      '上限 … 単語帳は `WORDBOOK_LIMIT` を渡す(数字を書き写さない)')
    const voc = rd('src/lib/vocab.js')
    ok(/export const WORDBOOK_LIMIT = \d+/.test(voc), '上限 … 出どころは `vocab.js` 1か所')
    ok(/limit = WORDBOOK_LIMIT,/.test(voc), '上限 … 既定にもそれを使っている')
    ok(/wordbook_limit\(\)/.test(rd('supabase/migrations/0056_wordbook_limit.sql')),
      '上限 … SQL 側の出どころも1か所(`wordbook_limit()`)')
    ok(!/least\(coalesce\(p_limit, 200\), 5000\)/
      .test(rd('supabase/migrations/0056_wordbook_limit.sql')),
      '上限 … SQL に数字を書き写していない')
    /* **読めていないことを、黙って隠さない** */
    ok(/capped > 0 && \(/.test(wb), '上限 … 切られていたら、画面がそう言う')
    ok(/WORDBOOK_LIMIT_OLD/.test(wb), '上限 … 切られたかどうかも、数字を書き写さない')
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

  /* ── **読むのは英語だけ**(2026-09 利用者の指定)───────────────
   *
   *   > 日本語入りはいらないですね!こえの質が悪すぎます!
   *
   * 日本語は**端末の声**でしか読めず、質を選べなかった
   * (iPhone は良い声を Web Speech API に公開しない・CLAUDE.md)。
   * だから `enja` / `jaen` を、一覧からも `radioSteps()` からも外した。
   * ── */
  ok(RADIO_MODES.length === 1 && RADIO_MODES[0].id === 'en',
    '読み方(単語帳) … 英語だけの1つ',
    RADIO_MODES.map((m) => m.id).join(','))
  /* **ここは、利用者の指定で開いた**(2026-09「パタプラのようにしたい」)。
     Quick Response には「言う練習」「チャンクで積む」「慣れるまで…」が
     足してある(下の「パタプラ風の『言う練習』」の節が中身を見る)。
     **見るのは「いちばん上が、これまでの『英語だけ』のままか」** ——
     既定が動くと、毎日使っている人の耳が黙って変わる */
  ok(QR_RADIO_MODES[0].id === 'en',
    '読み方(Quick Response) … いちばん上は、これまでの「英語だけ」',
    QR_RADIO_MODES.map((m) => m.id).join(','))
  ok(radioModesFor('qr') === QR_RADIO_MODES && radioModesFor('word') === RADIO_MODES,
    '読み方 … 場面ごとの一覧を `radioModesFor()` 1か所から引く')
  /* **端末に残っている古い値も、行き止まりにしない** —— `enja` / `jaen` を
     選んだまま更新した人が、読み方の分からない画面に着かないようにする */
  ok(radioModeOf('enja', 'word').id === 'en' && radioModeOf('jaen', 'qr').id === 'en',
    '読み方 … 端末に残っている `enja` / `jaen` は `en` に落ちる',
    `${radioModeOf('enja', 'word').id} / ${radioModeOf('jaen', 'qr').id}`)

  /* ── その1語を、どの順で読むか ─────────────────────────── */
  const 語 = { display: 'take on', meaning_ja: '引き受ける' }
  const en = radioSteps(語, 'en')
  ok(en.length === 3 && en[0].kind === 'en' && en[1].kind === 'wait' && en[2].kind === 'en',
    '英語だけ … 英語 → 間 → 英語 の3つ(日本語は読まない)',
    en.map((s) => s.kind).join(' '))

  /* **どの読み方を渡しても、日本語は1つも読まない。**
     `radioSteps` に枝を戻すと、ここが赤くなる */
  const 訳あり = ['en', 'enja', 'jaen', 'でたらめ', undefined]
    .flatMap((m) => radioSteps(語, m))
    .concat(radioSteps({ en: 'Could you walk me through it?', ja: '説明してもらえますか。' }, 'jaen'))
  ok(!訳あり.some((s) => s.kind === 'ja'),
    '**訳があっても、日本語は1つも読まない**(端末の声には戻さない)',
    [...new Set(訳あり.map((s) => s.kind))].join(' '))

  /* 訳のあるなしで、読む順は変わらない(読むのは英語だけである) */
  ok(radioSteps({ display: 'gist' }, 'en').map((s) => s.kind).join(' ') === 'en wait en',
    '訳が無い語 … これまでどおり、英語を2回読む')
  /* **英語が無ければ、何も返さない。**「読んだことにして」次へ送ると、
     無音の時間だけが延びる */
  ok(radioSteps({ meaning_ja: '意味だけ' }, 'en').length === 0,
    '英語が無い語 … 何も返さない')
  ok(radioSteps(null).length === 0, '空の行 … 何も返さない')

  /* **画面に出す訳は消していない**(言われたのは声の話である) */
  const 文 = { en: 'Could you walk me through the numbers?', ja: '数字を説明してもらえますか。' }
  ok(radioJaOf(文) === 文.ja && radioJaOf(語) === 語.meaning_ja,
    '訳 … **画面に出す訳は、これまでどおり引ける**(消したのは声だけ)')

  /* ── **語でも文でも、同じ1か所で読む**(部品を2つ持たない)──────── */
  ok(radioTextOf({ display: 'take on' }) === 'take on'
    && radioTextOf({ en: 'Hello there.' }) === 'Hello there.',
  '読むもの … 単語帳の行(`display`)も Quick Response の行(`en`)も引ける')
  ok(radioJaOf({ meaning_ja: '引き受ける' }) === '引き受ける'
    && radioJaOf({ ja: 'こんにちは。' }) === 'こんにちは。',
  '訳 … 単語帳の行(`meaning_ja`)も Quick Response の行(`ja`)も引ける')
  ok(radioTextOf({ display: '   ' }) === '',
    '読むもの … 空白だけの行は「読むものが無い」と答える')

  /* ── 間(ま)の長さ(2026-09 利用者の指定「間の時間設定もできるように」)──
   *
   *   **選ぶのは「考える間」1つだけ。** 語と語のあいだも、くり返しの
   *   あいだも、**同じ比でそろって動く**(`turnGap.js` の
   *   「比はそのままで、値だけを半分にする」とまったく同じ考え方)。
   *   **片方だけ縮めると、そこだけ不自然に詰まる。**
   */
  ok(RADIO_GAPS.length >= 4 && RADIO_GAPS.every((g) => Number.isInteger(g.id) && g.label),
    '間 … 段が並んでいて、どれにも秒数の名前が付いている',
    RADIO_GAPS.map((g) => g.label).join(' / '))
  ok(RADIO_GAPS.some((g) => g.id === DEFAULT_RADIO_GAP),
    '間 … 既定が段の中にある(選び直せる)')
  {
    const 短 = radioGapsOf(500)
    const 長 = radioGapsOf(5000)
    ok(短.recall === 500 && 長.recall === 5000,
      '間 … 選んだ秒が、そのまま比の基準になる')
    /* **比を見る。値そのものでは見ない** —— 基準を動かしても、
       この見張りはそのまま生きている。
       **ぴったり同じにはならない**(ミリ秒に丸めるため)ので、
       ずれが 1% に収まっているかで見る */
    const 比 = (g) => [g.word / g.recall, g.repeat / g.recall]
    const [w1, r1] = 比(短)
    const [w2, r2] = 比(長)
    ok(Math.abs(w1 - w2) < 0.01 && Math.abs(r1 - r2) < 0.01,
      '間 … 語と語・くり返しのあいだも、同じ比でそろって動く',
      `${w1.toFixed(3)},${r1.toFixed(3)} / ${w2.toFixed(3)},${r2.toFixed(3)}`)
    ok(長.word > 短.word && 長.repeat > 短.repeat,
      '間 … 長くすれば、3つとも長くなる')
    /* **知らない値・範囲の外は既定に落とす**(行き止まりを作らない) */
    ok(radioGapsOf('でたらめ').recall === DEFAULT_RADIO_GAP
      && radioGapsOf(0).recall === DEFAULT_RADIO_GAP
      && radioGapsOf(999999).recall === DEFAULT_RADIO_GAP,
    '間 … 知らない値・範囲の外は既定に落ちる')
    /* ── **違う語へ移るときの間は、もっと短く**(2026-09 実機・利用者の指定)
     *
     *   1回目:
     *   > 違う単語に移る際の間を 0.5 秒くらいまで縮められませんか?
     *   > 同じ単語の2回繰り返す際の間は今のままでOKです
     *
     *   2回目(**もう一段**):
     *   > 違う単語同士の間をもっと詰めれませんか？
     *   > もっとサクサク読み上げてほしいです。
     *
     *   実測は **965ms → 536ms → 268ms**。
     *   **動かしてよいのは「語と語」だけ** —— 「くり返し」は
     *   「今のままでOK」と言われたきり取り消されていないので、537ms のまま。
     *
     *   **しきい値も一緒に下げる。** 下げないと、
     *   500 に戻しても緑のままになる(「無ければ素通り」する検証を書かない)。 */
    const 既定 = radioGapsOf()
    ok(Math.abs(既定.recall - 1400) <= 200,
      '間 … 基準は、これまで(1.4秒)とほぼ同じ', `${既定.recall}ms`)
    ok(既定.word >= 180 && 既定.word <= 330,
      '間 … 既定で、違う語へ移るときの間がサクサク',
      `${既定.word}ms(965 → 536 → いま)`)
    /* **「語と語」だけが縮んだか。** くり返しまで一緒に縮めていないこと
       (そちらは「今のままでOK」)を、比そのもので見る */
    ok(既定.word < 既定.repeat,
      '間 … 縮めたのは「語と語」だけ(くり返しは触っていない)',
      `語と語 ${既定.word}ms / くり返し ${既定.repeat}ms`)
    /* **「今のまま」を見張る。** ここを動かすと、利用者が
       「OK」と言った長さが黙って変わる */
    ok(Math.abs(既定.repeat - 537) <= 30,
      '間 … 同じ語を2回読むあいだは、これまでのまま',
      `${既定.repeat}ms`)
  }
  /* **選んだ間が、本当に読む順に効いているか。**
     `radioSteps` が `radioGapsOf` を通っていなければ、
     間を変えても何も起きない(しかも音は鳴るので気づけない) */
  ok(radioSteps(語, 'en', 3000)[1].ms > radioSteps(語, 'en', 500)[1].ms,
    '間 … くり返しのあいだに効く')
  ok(radioSteps(文, 'en', 3000)[1].ms > radioSteps(文, 'en', 500)[1].ms,
    '間 … Quick Response の文でも同じように効く')

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

  /* ── 英語の音声と音楽の大きさ(2026-09 利用者の指定)───────────

       > アプリに好きな音楽を追加し、英語の音声と音楽を独立してそれぞれ
       > 音量を調整出来るようにしたいです。
       > 英語音声が再生される時に自動で音楽の音量を下げる機能は必要ありません

     **何も触らなければ、いままでと同じ音量で鳴る**こと(既定)。
     **範囲の外・知らない値は既定に落とす**こと(行き止まりを作らない)。 */
  /* **既定は、つまみの刻みの上に置く。** 0.42 のままだと、画面に「40%」と
     出ているのに中身は 42% という食い違いが残る(0049 との差は耳で分からない) */
  ok(DEFAULT_BGM === 0.4 && clampLevel(DEFAULT_BGM, 0) === DEFAULT_BGM,
    '音量 … 音楽の既定は、これまで(0049 の 0.42)とほぼ同じ 0.4(刻みの上)')
  ok(clampLevel(DEFAULT_VOICE, 0) === DEFAULT_VOICE,
    '音量 … 英語の音声の既定も、刻みの上にある')
  ok(DEFAULT_VOICE === 1,
    '音量 … 英語の音声の既定は 1(触らなければ、いままでと 1 ミリも変わらない)')
  ok(clampLevel(2, 0.5) === 1 && clampLevel(-1, 0.5) === 0,
    '音量 … 範囲の外は 0〜1 に収める')
  ok(clampLevel('あ', 0.42) === 0.42 && clampLevel(undefined, 1) === 1,
    '音量 … 知らない値は既定に落とす(行き止まりを作らない)')
  ok(clampLevel(0.37, 1) === 0.35 && clampLevel(0.33, 1) === 0.35,
    `音量 … ${VOL_STEP * 100}% 刻みにそろえる`,
    `0.37 → ${clampLevel(0.37, 1)}`)
  /* **小数の誤差をそのまま画面に出さない**(0.35000000000000003) */
  ok(String(clampLevel(0.35, 1)) === '0.35' && pctLabel(0.35) === '35%',
    '音量 … 画面に出す言い方は 1 か所(小数の誤差が出ない)')
  /* **それぞれ別に覚える**(片方を動かして、もう片方が動かないこと) */
  {
    const v0 = voiceLevel()
    const b0 = bgmLevel()
    setVoiceLevel(0.3)
    ok(voiceLevel() === 0.3 && bgmLevel() === b0,
      '音量 … 英語の音声を動かしても、音楽は動かない')
    setBgmLevel(0.8)
    ok(bgmLevel() === 0.8 && voiceLevel() === 0.3,
      '音量 … 音楽を動かしても、英語の音声は動かない')
    setVoiceLevel(v0)
    setBgmLevel(b0)
  }
  /* **端末が受け付けるかは、名前(UA)では決めない。** 素の node には
     `Audio` が無いので、ここでは「分からなければ効く」に落ちる */
  ok(volumeWorks() === true,
    '音量 … 分からない端末では、つまみを出す(行き止まりを作らない)')

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
    ok(/= radioSteps\(row, mode, gap\)/.test(radio),
      '聞き流し … 読む順も、間の長さも `radioSteps()` に任せている')

    /* ── **いま読んでいる語は、控えが本体**(2026-09 実機・利用者の指摘)──
     *
     *   > 一つの単語が4回読み上げられたり、3回だったり、2回だったり…
     *   > 画面に表示されている単語とメチャクチャにズレてしまってます
     *
     *   もとは `atRef.current = at` と**描くたびに写して**いた。ところが
     *   繰り返しは `setAt()` で進めたあと、**描き直しを待たずに次の周へ入る。**
     *   React の状態はその場では変わっていないので、**同じ語をもう一度読み**、
     *   しかも `setAt` が2回ぶん進むので**そこから先は画面が1つ先**を指す。
     *
     *   だから見るのは3つ。**どれか1つでも戻ると、また同じことが起きる。**
     */
    ok(!/atRef\.current\s*=\s*at\b/.test(radio),
      '聞き流し … 描くたびに控えを写していない(写すと同じ語を二度読む)')
    ok(/const move = \(i\) => \{ atRef\.current = i; setAt\(i\) \}/.test(radio),
      '聞き流し … 進めるのは `move()` 1か所(控えと画面を一緒に動かす)')
    /* **変数の名前で探さない。**「更新の形」そのもので見る ——
       はじめ `setAt\(\(i\)` と書いていたので、`setAt((i2) => …)` に
       名前を変えただけで**素通りした**(赤チェックで気づいた) */
    ok(!/setAt\(\s*\(\s*\w+\s*\)\s*=>/.test(radio),
      '聞き流し … `setAt` だけで進めていない(控えと食い違う)')
    /* **進めるのが先、間を置くのがあと。** 逆にすると、音が出た時点で
       画面がまだ1つ前になる(実測: gist を読んでいるのに画面は take on) */
    ok(/move\(nextIndex\(i, list\.length\)\)\s*\n\s*await wait\(gaps\.word\)/.test(radio),
      '聞き流し … 先に進めてから、語のあいだの間を置く(画面が追いつく)')
    /* **語と語のあいだも、選んだ間から出す。** ここで `WORD_GAP_MS` を
       直に使うと、間を変えても**そこだけ動かない**(しかも音は鳴る) */
    ok(/const gaps = radioGapsOf\(gap\)/.test(radio) && !/wait\(WORD_GAP_MS\)/.test(radio),
      '聞き流し … 3つの間を `radioGapsOf()` 1か所から出している')
    /* ── **次の語を、いま鳴らしているあいだに用意しているか**
     *   (2026-09 実機・利用者の指定「違う単語に移る際の間を…」)
     *
     *   耳に届く間は**「決めた間 + 用意の待ち」**である。語が変わると
     *   MP3 と文字ごとの時刻を取りに行くが、**同じ語の2回目には起きない**
     *   (もう控えにある)ので、「別の語のときだけ長い」になる。
     *   **間の値を縮めただけでは、半分しか直らない。**
     *
     *   **「名前が出てくるか」で見ない**(CLAUDE.md)—— 説明の中にも
     *   `prepareRead` と書いてあるので、**呼んでいる形**で見る。 */
    ok(/prepareRead\(radioTextOf\(list\[nextIndex\(/.test(radio),
      '聞き流し … 次の語を、いま鳴らしているあいだに用意している')
    /* **`readAloud()` と同じ既定で用意する。** `prefetchClip` を画面から
       直に呼ぶと、話者と段を**呼ぶ側が書き写す**ことになり、
       用意した場所と実際に鳴らす場所が食い違う(しかも音は鳴る) */
    ok(!/prefetchClip/.test(radio),
      '聞き流し … 話者と段を書き写していない(`prepareRead()` に任せる)')
    /* **見張り(`useEffect`)に間を入れる。** 入れないと、
       選び直しても**押し直すまで効かない** */
    ok(/\[on, mode, gap, list\.length, rate\]/.test(radio),
      '聞き流し … 間を変えたら、その場で読み直す')
    /* **出す文字も1か所を通す**(鳴らす側と画面で数え方を2通り持たない) */
    ok(/radioTextOf\(now\)/.test(radio) && /radioJaOf\(now\)/.test(radio),
      '聞き流し … 画面に出す文字も `radioTextOf()` / `radioJaOf()` を通る')

    /* ── **日本語は読まない**(2026-09 利用者の指定)────────────────
     *
     *   > 日本語入りはいらないですね!こえの質が悪すぎます!
     *
     *   一覧から外すだけでは足りない —— **鳴らす側に道が残っていると、
     *   誰かが枝を戻した日にまた鳴る。** 端末の声を呼ぶところごと消す。
     */
    ok(!/japaneseVoice/.test(radio),
      '聞き流し … **端末の声で日本語を読む道が、鳴らす側に残っていない**')
    /* **読み方が1つしか無いなら、選ばせない**(効かない操作を見せない) */
    ok(/modes\.length > 1 &&/.test(radio),
      '聞き流し … 読み方は、2つ以上あるときだけ出す')
    /* **画面の訳は消していない**(言われたのは声の話である) */
    ok(/className=\{`radio-ja/.test(radio),
      '聞き流し … 訳は、これまでどおり画面に出す')

    /* ── Quick Response の聞き流し(2026-09 利用者の指定)────────────
     *
     *   > Quick Responseにも聞き流しを作ってくれ。
     *
     *   **部品は単語帳とまったく同じ `WordRadio`。** 渡すのは
     *   「どの画面から来たか」だけである。**`where="qr"` を渡し忘れると、
     *   間の長さを単語帳と分けて覚えられない**(語は短く、文は長い)。
     */
    const qr = 落とす(readFileSync(
      new URL('../src/components/QrReview.jsx', import.meta.url), 'utf8'))
    ok(/<WordRadio/.test(qr), '聞き流し … Quick Response から入れる')
    ok(/where="qr"/.test(qr),
      '聞き流し … Quick Response は自分の持ちもの(間の長さ)で鳴る')
    ok(/onClick=\{listen\}/.test(qr), '聞き流し … Quick Response に入口のボタンがある')
    /* **出題とまったく同じ道で文を選ぶ**(数え方を2通り持たない)。
       `shown` は範囲の札と絞り込みを当てたあとの一覧である */
    ok(/orderQrPairs\(shown\.map\(qrPairOf\), order\)/.test(qr),
      '聞き流し … 読む文は、出題と同じ `shown` と並べ方から選んでいる')
    /* **記録は1ミリも動かさない**(答える練習ではない)。
       `listen()` の中で `markQr` を呼んでいないこと */
    ok(!/const listen[\s\S]{0,400}?markQr/.test(qr),
      '聞き流し … Quick Response でも、箱も次に出す日も動かさない')
    /* 「読むものがあるか」の判断を書き写さない —— 空白だけの語が残ると、
       鳴らす側が待たずに回り続けて画面ごと固まる */
    ok(/filter\(\(r\) => radioTextOf\(r\)\)/.test(radio),
      '聞き流し … 読む語の絞り込みは `radioTextOf()` に任せている')
    ok(/const en = radioTextOf\(row\)/.test(
      落とす(readFileSync(new URL('../src/lib/wordRadio.js', import.meta.url), 'utf8'))),
    '聞き流し … `radioSteps()` も同じ `radioTextOf()` を通る')
    ok(/bgmPlaysIn\(loadBgmPlace\(\), 'radio'\)/.test(radio),
      '聞き流し … 音楽を流すかどうかを `bgmPlaysIn()` に任せている')
    /* **自動で下げる仕組みは、道具ごと消した**(2026-09 利用者の指定
       「英語音声が再生される時に自動で音楽の音量を下げる機能は
       必要ありません」)。値を偽にして残すと、次に見た人が
       「まだ使うのかもしれない」と読む */
    {
      const 消えた = [
        'src/lib/bgm.js', 'src/lib/wordRadio.js', 'src/lib/mixVolume.js',
        'src/components/WordRadio.jsx', 'src/components/BgmLibrary.jsx', 'src/App.jsx',
      ].filter((f) => /duckBgm|BGM_DUCKED|bgmVolume\(/.test(
        落とす(readFileSync(new URL(`../${f}`, import.meta.url), 'utf8'))))
      ok(消えた.length === 0,
        '音楽 … 自動で小さくする仕組みは、道具ごと消えている',
        消えた.join(' / '))
    }
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

    /* ── 選んだ大きさが、本当に効いているか(2026-09 利用者の指定)──────

         **道は3つある。1つでも切れていると、そこだけ効かない。**
         しかも**音は鳴る**ので、聴いた人にしか分からない
         (`elevenSettings` が届いていなかったのと、まったく同じ形の穴)。 */
    {
      const mix = 落とす(readFileSync(
        new URL('../src/lib/mixVolume.js', import.meta.url), 'utf8'))
      const clips = 落とす(readFileSync(
        new URL('../src/lib/audioClips.js', import.meta.url), 'utf8'))
      const sp = 落とす(readFileSync(
        new URL('../src/lib/speech.js', import.meta.url), 'utf8'))
      const row = 落とす(readFileSync(
        new URL('../src/components/VolumeRow.jsx', import.meta.url), 'utf8'))

      /* **算段は素の node で走らせられる形にしてある**
         (`playMark.js` と同じ考え方)。ここが Supabase を持つと、
         上の丸めの検証そのものが書けなくなる */
      ok(!/supabase|import\.meta\.env/.test(mix),
        '音量 … 算段は Supabase を持たない(素の node で確かめられる)')
      /* **通り道は変えない。** `GainNode` に通せば iPhone でも効くが、
         2026-09 にそれをやって全部の声で雑音が乗った */
      ok(!/createMediaElementSource|createGain|GainNode/.test(mix),
        '音量 … Web Audio を通していない(`volume` だけを動かす)')

      /* ① 英語の音声(1本にまとめた音声も、発言ごとの MP3 も、ここを通る) */
      ok(/fadeGain\(base \* voiceLevel\(\)/.test(clips),
        '音量 … 英語の音声に、選んだ大きさが掛かっている')
      /* **`gainFor()` の側では掛けない。** あちらは声どうしをそろえる
         ためのもので、`npm run test:audio` が「1 以下か」を見張っている */
      ok(!/voiceLevel/.test(落とす(readFileSync(
        new URL('../src/lib/loudness.js', import.meta.url), 'utf8'))),
      '音量 … 声どうしをそろえる倍率(`gainFor`)には混ぜていない')
      /* ② 端末の声(MP3 を作れなかったときの受け皿)。
         ここだけいつも最大だと、その1本だけ大きくなる */
      ok((sp.match(/utterance\.volume = voiceLevel\(\)/g) ?? []).length === 2
        && !/utterance\.volume = 1\b/.test(sp),
      '音量 … 端末の声にも、選んだ大きさが効く(2か所とも)')
      /* ③ 音楽。**覚えるのと当てるのを、画面に2回呼ばせない** */
      ok(/el\.volume = bgmLevel\(\)/.test(bgmjs) && /to\(bgmLevel\(\), 700\)/.test(bgmjs),
        '音量 … 音楽は、選んだ大きさで鳴り始める')
      ok(/export function setBgmVolume/.test(bgmjs)
        && /if \(el && !el\.paused\) to\(got, 150\)/.test(bgmjs),
      '音量 … 鳴っている最中につまみを動かしても、その場で追う')

      /* ── 画面が、本当に呼んでいるか ──────────────────────
         **定義だけあって誰も呼ばなければ、何も起きない**
         (`noteFnRev` を定義だけして呼んでいなかったのと同じ落とし穴)。 */
      ok(/onVoiceVol=\{\(v\) => setVoiceVol\(setVoiceLevel\(v\)\)\}/.test(app),
        '音量 … 画面が、英語の音声の大きさを本当に覚えさせている')
      ok(/onBgmVol=\{\(v\) => setBgmVol\(setBgmVolume\(v\)\)\}/.test(app),
        '音量 … 画面が、音楽の大きさを本当に効かせている')
      /* **効かない端末では、つまみを出さずに理由を言う**
         (「効かない操作を見せない」+「黙って消さない」)。
         **端末の名前では決めない** —— `volumeWorks()` が実際に試す。
         2026-09 に「設定」へまとめたので、置き場所は `NavSettings.jsx` */
      const navset = 落とす(readFileSync(
        new URL('../src/components/NavSettings.jsx', import.meta.url), 'utf8'))
      ok(/volumeWorks\(\) \? \(/.test(navset) && /nav-vol-no/.test(navset),
        '音量 … 受け付けない端末では、つまみを出さずに理由を1行で言う')
      ok(!/iPhone|iPad|userAgent/.test(mix),
        '音量 … 端末の名前(UA)では決めない')
      /* **部品は自分で覚えない**(`test:bar` がそのまま描いて測れる) */
      ok(!/localStorage|setVoiceLevel|setBgmVolume/.test(row),
        '音量 … つまみの部品は、受け取って描くだけ(自分では覚えない)')
    }

    ok(/id: 'bgm', label: '音楽'/.test(app) && /<BgmLibrary/.test(app),
      '音楽 … トレーナーのメニューに「音楽」がある')
    /* **下の帯は4つのまま**(利用者が「この四つにしてください」と決めた) */
    ok(!/TAB_IDS = \[[^\]]*'bgm'/.test(app),
      '音楽 … 下の帯(4つ)には足していない')
  }
}

/* ==========================================================================
 * 設定は「設定」1つにまとめ、メニューのいちばん下に置く
 * (2026-09 利用者の指定)
 *
 *   > サイドバーの「配色」から「教材の支度」までの項目をすべてまとめて
 *   > 「設定」としてサイドバーの一番下に配置してください。
 *
 * 設定が**7つ縦に並んで**いた。どれも**一度決めたら何度も触らないもの**
 * なのに、メニューを開くたびに行き先(画面の一覧)と同じだけの高さを
 * 占めていた。**畳んで1つにまとめ、いちばん下へ置いた。**
 *
 * 【ここは算段。描いて測るのは `npm run test:bar`】
 *   ①7つとも入っているか ②既定で閉じているか ③いちばん下にいるか
 *   ④画面が本当に呼んでいるか ⑤部品が自分で覚えていないか
 * ========================================================================== */
{
  console.log('\n▶ 設定')
  const readS = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')
  const noCS = (t) => t.replace(/\/\*[\s\S]*?\*\/|\{\/\*[\s\S]*?\*\/\}/g, '')
  const app = noCS(readS('src/App.jsx'))
  const set = noCS(readS('src/components/NavSettings.jsx'))

  /* ① **7つとも入っている。一度入れたものを勝手に減らさない**(共通ルール) */
  {
    const WANT = ['配色', '色づかい', '説明の文', '押したときの音',
      '英語の音声', '音楽', '教材の支度']
    const 無い = WANT.filter((n) => !set.includes(n))
    ok(無い.length === 0,
      `設定 … 7つとも入っている${無い.length ? `(足りない: ${無い.join(' / ')})` : ''}`)
  }

  /* ② **既定は閉じている。** `open` を書くと、まとめた意味が無くなる。
     **開け閉めも覚えない** —— 毎回触るものではないので、覚えていると
     次にメニューを開いたときに行き先より先に設定が目に入る */
  ok(/<details className="nav-settings">/.test(set),
    '設定 … 既定で畳んである(`open` を書いていない)')
  ok(!/localStorage|loadTheme|loadPalette|loadTips|soundOn|prepareAllOn/.test(set),
    '設定 … 部品は受け取って描くだけ(自分では覚えない)')
  /* **絵文字を使わない**(端末ごとに形も大きさも違う) */
  ok(/GearIcon/.test(set) && !/⚙/.test(set),
    '設定 … 歯車は `GearIcon`(絵文字を使わない)')

  /* ③ **いちばん下。** 自分の欄(名前・役割・ログアウト)より下にいること。
     **ソースの並びで見る** —— 描いた位置は `npm run test:bar` が測る */
  {
    const foot = app.slice(app.indexOf('const navFooter = ('),
      app.indexOf('<AppNav'))
    const acc = foot.indexOf('className="nav-account"')
    const set2 = foot.indexOf('<NavSettings')
    ok(acc >= 0 && set2 > acc,
      '設定 … 自分の欄より下(メニューのいちばん下)にいる')
  }

  /* ④ **画面が本当に呼んでいるか。**
     定義だけあって誰も呼ばなければ、何も起きない
     (`noteFnRev` を定義だけして呼んでいなかったのと同じ落とし穴)。
     **「名前が出てくるか」で見ない** —— 渡している形で数える */
  {
    const WANT = [
      /theme=\{theme\} onTheme=\{setTheme\}/,
      /palette=\{palette\} onPalette=\{setPalette\}/,
      /tips=\{tips\} onTips=\{setTips\}/,
      /sound=\{sound\} onSound=/,
      /voiceVol=\{voiceVol\} onVoiceVol=/,
      /bgmVol=\{bgmVol\} onBgmVol=/,
      /prepare=\{prepAll\} onPrepare=/,
    ]
    const 抜け = WANT.filter((re) => !re.test(app)).length
    ok(抜け === 0, `設定 … 画面が7つとも渡している${抜け ? `(${抜け} 件が抜けている)` : ''}`)
  }
  /* **「教材の支度」はトレーナーと管理者だけ**(費用が出ていく) */
  ok(/showPrepare=\{profile\?\.role === 'trainer' \|\| profile\?\.role === 'owner'\}/.test(app),
    '設定 … 「教材の支度」はトレーナーと管理者だけに出す')

  /* ⑤ **まとめた証拠。** App.jsx に設定の欄が残っていないこと ——
     残っていると、**同じ設定が2か所**に出る(CLAUDE.md) */
  ok(!/nav-setting-label">(配色|色づかい|説明の文|押したときの音|教材の支度)/.test(app),
    '設定 … 同じ設定を2か所に出していない')
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


/* ══════════════════════════════════════════════════════════════════
   文法解説(SVOC と修飾要素・0051・2026-09 利用者の指定)

     > 文章ごとにSVOCと修飾要素についての解説をしてくれる、
     > 文法解説モードが欲しい。

   **ずれた解説は、無いより悪い**(別の文の骨組みが出る)。
   ところが間違えても `npm run lint` にも `npm run build` にも
   引っかからず、しかも**画面には何か出る**ので気づけない。
   だから算段を何にも依存しない形(`src/lib/grammarNote.js`)へ出して、
   ここで数字で見張る。
   ══════════════════════════════════════════════════════════════════ */
{
  const {
    PATTERNS, ROLES, VIEWS, grammarForPiece, grammarPlan,
    hasOtherView, needsGrammar, nextView, storedGrammar,
  } = await import('../src/lib/grammarNote.js')

  const EN = 'The office bought a new coffee machine last week. She looks tired.'
  const good = {
    prompt_en: EN,
    grammar: {
      en: EN,
      sentences: [
        {
          en: 'The office bought a new coffee machine last week.',
          pattern: 'SVO',
          parts: [
            { t: 'The office', r: 'S' }, { t: 'bought', r: 'V' },
            { t: 'a new coffee machine', r: 'O' }, { t: 'last week.', r: 'M' },
          ],
          note: '「誰が どうする 何を」の第3文型。',
        },
        {
          en: 'She looks tired.',
          pattern: 'SVC',
          parts: [{ t: 'She', r: 'S' }, { t: 'looks', r: 'V' }, { t: 'tired.', r: 'C' }],
          note: '主語 = どんな状態か、を言う第2文型。',
        },
      ],
    },
  }

  // ── 役と文型は、閉じたリストにしてある ──
  ok(Object.keys(ROLES).join('') === 'SVOCM',
    '文法解説 … 役は S / V / O / C / M の5つだけ', Object.keys(ROLES).join(''))
  ok(Object.keys(PATTERNS).length === 5 && PATTERNS.SVOC,
    '文法解説 … 文型は五文型そのまま')

  // ── そろっていれば、そのまま返る ──
  ok(storedGrammar(good)?.length === 2, '文法解説 … そろっていれば返る')
  ok(!needsGrammar(good), '文法解説 … そろっていれば作り直さない')

  // ── **英文が変わっていたら返さない**(あとから本文を直したとき) ──
  ok(storedGrammar({ ...good, prompt_en: `${EN} And more.` }) === null,
    '文法解説 … 英文が変わっていたら返さない')
  ok(needsGrammar({ ...good, prompt_en: `${EN} And more.` }),
    '文法解説 … 英文が変わっていたら作り直す')

  // ── **つないで元の文に戻らなければ、その項目ごと返さない** ──
  /* **動詞を落とさない。** それだと「動詞が無い」の見張り(③)にも
     引っかかるので、この行だけを外しても赤くならない
     (実際にそうなった)。**飾り(M)を落として、②だけを試す** */
  const dropped = JSON.parse(JSON.stringify(good))
  dropped.grammar.sentences[0].parts.splice(3, 1)   // `last week.` を落とす
  ok(storedGrammar(dropped) === null,
    '文法解説 … かたまりをつないで元の文に戻らなければ返さない')

  // ── **知らない役が混じっていたら返さない** ──
  const weird = JSON.parse(JSON.stringify(good))
  weird.grammar.sentences[1].parts[1].r = 'X'
  ok(storedGrammar(weird) === null, '文法解説 … 知らない役が混じっていたら返さない')

  // ── **動詞が無い文は返さない**(文の解説になっていない) ──
  const noV = JSON.parse(JSON.stringify(good))
  noV.grammar.sentences[1].parts[1].r = 'M'
  ok(storedGrammar(noV) === null, '文法解説 … 動詞が1つも無ければ返さない')

  // ── **文が1つ足りなければ返さない**(最後の1文だけ解説が無い、を防ぐ) ──
  const short = JSON.parse(JSON.stringify(good))
  short.grammar.sentences.pop()
  ok(storedGrammar(short) === null, '文法解説 … 文が足りなければ返さない')

  // ── **空白の入り方の違いだけでは落とさない** ──
  const spacey = JSON.parse(JSON.stringify(good))
  spacey.grammar.sentences[1].parts[2].t = 'tired .'
  ok(storedGrammar(spacey)?.length === 2,
    '文法解説 … 空白の入り方の違いだけでは落とさない')

  // ── 窓口へ渡す一覧は、こちらで文に切って渡す ──
  const plan = grammarPlan([{ prompt_en: EN }, { prompt_en: '' }, { prompt_en: 'Go.' }])
  ok(plan.length === 2 && plan[0].no === 1 && plan[0].sentences.length === 2,
    '文法解説 … 本文を文に切って渡し、空の項目は番号を飛ばす',
    JSON.stringify(plan.map((p) => [p.no, p.sentences.length])))

  // ── 割った段落では、そのかけらのぶんだけ ──
  const at = EN.indexOf('She looks')
  const piece2 = grammarForPiece(storedGrammar(good), EN, at, EN.slice(at))
  ok(piece2.length === 1 && piece2[0].en.startsWith('She'),
    '文法解説 … 割った段落では、いま出しているかけらの文だけを出す',
    JSON.stringify(piece2.map((s) => s.en)))
  ok(grammarForPiece(storedGrammar(good), EN, null, null).length === 2,
    '文法解説 … 割っていないときは、そのまま全部')

  // ── 見せ方は1つのボタンで回る。**無いものは飛ばす** ──
  ok(VIEWS.join(',') === 'en,ja,grammar', '文法解説 … 見せ方は 英語 → 訳 → 文法 の順')
  ok(nextView('en', { ja: true, grammar: true }) === 'ja'
    && nextView('ja', { ja: true, grammar: true }) === 'grammar'
    && nextView('grammar', { ja: true, grammar: true }) === 'en',
    '文法解説 … 3つそろっていれば、押すたびに次へ回る')
  ok(nextView('en', { ja: false, grammar: true }) === 'grammar',
    '文法解説 … 訳が無い段落では、訳を飛ばす')
  ok(nextView('en', { ja: true, grammar: false }) === 'ja'
    && nextView('ja', { ja: true, grammar: false }) === 'en',
    '文法解説 … 解説が無い教材では、文法を飛ばす')
  ok(!hasOtherView({}) && hasOtherView({ grammar: true }),
    '文法解説 … どちらも無ければ、ボタンごと出さない')

  // ── **画面が本当に呼んでいるか**(定義だけあって誰も呼ばなければ同じ) ──
  const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')
  const noComment = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
  const focus = noComment(read('src/components/FocusReader.jsx'))
  ok(/<GrammarNote\s/.test(focus), '文法解説 … 集中モードが `GrammarNote` を描いている')
  ok(/nextView\(view, have\)/.test(focus),
    '文法解説 … 見せ方の回し方を `nextView()` に任せている(画面で書かない)')
  ok(/hasOtherView\(have\)/.test(focus),
    '文法解説 … 出せるものが無ければ、ボタンごと出さない')
  ok(!/showJa \? '英語' : '訳'/.test(focus),
    '文法解説 … 真偽値の出し分けが残っていない')
  ok(/= grammarForPiece\(/.test(focus),
    '文法解説 … 割った段落では、かけらのぶんだけを渡している')

  const mats = noComment(read('src/lib/materials.js'))
  ok(/optLast\('grammar'\)/.test(mats), '文法解説 … `grammar` の列を取ってきている')
  ok((mats.match(/optLast\('grammar'\)/g) ?? []).length === 3,
    '文法解説 … 3か所の問い合わせすべてで取ってきている',
    String((mats.match(/optLast\('grammar'\)/g) ?? []).length))
  ok(/mode: 'grammar'/.test(mats), '文法解説 … 窓口に `mode: grammar` で頼んでいる')
  ok(/row\.grammar = \{/.test(mats), '文法解説 … 発行するときに控えている')

  const form = noComment(read('src/components/MaterialForm.jsx'))
  ok(/await fillGrammar\(/.test(form),
    '文法解説 … 教材を作るときに1回だけ作っている')
  ok((form.match(/await fillGrammar\(/g) ?? []).length === 2,
    '文法解説 … 記事・会話と、貼った原稿の**両方**で作っている',
    String((form.match(/await fillGrammar\(/g) ?? []).length))
  ok(/plan\.length \+ 2 : plan\.length/.test(form),
    '文法解説 … 段が2つ増えたぶん、帯の総数も足してある')

  const tm = noComment(read('src/components/TrainerMaterials.jsx'))
  ok(/needsGrammarIn\(m\)/.test(tm) && /makeGrammar\(m\)/.test(tm),
    '文法解説 … 前に作った教材は、使うときに裏で足している')
  ok(/triedGrammar/.test(tm),
    '文法解説 … 1つの教材につき1回だけ(止まる条件を持たせる)')

  // ── 窓口 ──
  const fn = noComment(read('supabase/functions/generate-material/index.ts'))
  ok(/mode === 'grammar'/.test(fn), '文法解説 … 窓口が `mode: grammar` を受けている')
  ok(/name: 'emit_grammar'/.test(fn) && /strict: true/.test(fn),
    '文法解説 … 道具の形は `strict: true` で保証している')
  /* **版は「これ以降」で見る。** そのあとも窓口に手を入れるたびに
     進むので(0054 で `2026-09-10` にした)、等号で書くと
     **関係のない回に赤くなる。** 見たいのは「0051 の版に達しているか」 */
  ok((/const FN_REV = '([^']+)'/.exec(fn)?.[1] ?? '') >= '2026-09-09',
    '文法解説 … 窓口に手を入れたので、版を1つ進めてある')
  ok((/NEED_GEN_REV = '([^']+)'/.exec(read('src/lib/materials.js'))?.[1] ?? '') >= '2026-09-09',
    '文法解説 … 画面が見る版も、そろえてある')

  // ── 貼る SQL がそろっているか ──
  const matome = read('supabase/apply/pending_matome.sql')
  const check = read('supabase/apply/check.sql')
  ok(/add column if not exists grammar/.test(matome),
    '文法解説 … まとめた1つに 0051 が入っている')
  ok(/column_name = 'grammar'/.test(check),
    '文法解説 … check.sql が 0051 を見ている')
}


/* ══════════════════════════════════════════════════════════════════
   文法30日集中講座 + 基礎単語(0052・2026-09 利用者の指定)

     > pre basic と basic に基礎単語習得モードとか文法30日集中講座などが
     > 欲しい。日本ではいわゆる中学英語と呼ばれるものだ。
     > ただ網羅するのではなく、単語と基礎的な文法の仕組みを
     > 楽しんで身に付けられるコースにして欲しい。

   **一覧は、勝手に減らさない**(プロジェクトを超えた決まり)。
   1,200 語 / 基本360語 / 30日は、**数えないと崩れたことに気づけない。**
   ══════════════════════════════════════════════════════════════════ */
{
  const { BASIC_WORDS } = await import('../src/data/basicWords.js')
  const {
    COURSE_DAYS, COURSE_LENGTH, COURSE_TIERS, dayOf, tierForLevel, tierOf,
  } = await import('../src/data/basicsCourse.js')
  const {
    courseList, courseRatio, dayPairs, nextDay, wordsForDay, wordsForTier,
  } = await import('../src/lib/basicsCourse.js')
  const { weaknessTags } = await import('../src/data/weaknessTags.js')

  // ── 数。**減らさない** ──
  ok(BASIC_WORDS.length === 1200, '基礎単語 … 1,200 語ある', String(BASIC_WORDS.length))
  ok(BASIC_WORDS.filter((w) => w.core).length === 360,
    '基礎単語 … 基本360語 が 360 語ある',
    String(BASIC_WORDS.filter((w) => w.core).length))
  ok(COURSE_LENGTH === 30 && COURSE_DAYS.length === 30,
    '30日講座 … 30日ある', String(COURSE_DAYS.length))

  // ── **同じ語を二度入れない。** 単語帳の鍵は語そのものである ──
  {
    const seen = new Set()
    const dup = []
    for (const w of BASIC_WORDS) { if (seen.has(w.w)) dup.push(w.w); seen.add(w.w) }
    ok(dup.length === 0, '基礎単語 … 同じ語が二度出てこない', dup.slice(0, 8).join(' '))
  }
  // ── `normWord` と同じそろえ方(小文字・英字だけ)──
  ok(BASIC_WORDS.every((w) => /^[a-z'-]+$/.test(w.w)),
    '基礎単語 … 語は小文字の英字だけ(単語帳の鍵とそろえる)',
    BASIC_WORDS.filter((w) => !/^[a-z'-]+$/.test(w.w)).map((w) => w.w).join(' '))
  // ── **訳が空の語を入れない**(単語帳に入れたときに意味が出ない)──
  ok(BASIC_WORDS.every((w) => String(w.ja ?? '').trim()),
    '基礎単語 … 訳が空の語が1つも無い')
  // ── 日の割り当て ──
  {
    const byDay = {}
    const core = {}
    for (const w of BASIC_WORDS) {
      byDay[w.day] = (byDay[w.day] ?? 0) + 1
      if (w.core) core[w.day] = (core[w.day] ?? 0) + 1
    }
    const days = Object.keys(byDay).map(Number).sort((a, b) => a - b)
    ok(days.length === 30 && days[0] === 1 && days[29] === 30,
      '基礎単語 … 1〜30 日にもれなく割り当ててある')
    ok(days.every((d) => byDay[d] === 40),
      '基礎単語 … どの日も 40 語',
      days.filter((d) => byDay[d] !== 40).map((d) => `${d}:${byDay[d]}`).join(' '))
    ok(days.every((d) => core[d] === 12),
      '基礎単語 … どの日も 基本360語 が 12 語',
      days.filter((d) => core[d] !== 12).map((d) => `${d}:${core[d]}`).join(' '))
  }

  // ── 段は2つ。**基本360語 は 1200 の一部**(別の一覧を持たない)──
  ok(COURSE_TIERS.length === 2 && COURSE_TIERS[0].id === 'core' && COURSE_TIERS[1].id === 'full',
    '30日講座 … 段は2つで、id は core / full のまま')
  ok(wordsForTier('core').length === 360 && wordsForTier('full').length === 1200,
    '30日講座 … 段ごとの語数がそろっている')
  {
    const full = new Set(wordsForTier('full').map((w) => w.w))
    ok(wordsForTier('core').every((w) => full.has(w.w)),
      '30日講座 … 基本360語 は、すべて 1200 の中にある')
  }
  ok(wordsForDay(1, 'core').length === 12 && wordsForDay(1, 'full').length === 40,
    '30日講座 … 1日ぶんの語数(12 / 40)')
  ok(wordsForDay(0).length === 0 && wordsForDay(31).length === 0,
    '30日講座 … 範囲の外は空(当てずっぽうで返さない)')
  ok(tierOf('しらない').id === 'core',
    '30日講座 … 知らない段は、やさしいほうに落ちる(行き止まりを作らない)')

  // ── レベルから初めの1つを選ぶ ──
  ok(tierForLevel('Pre-Basic') === 'core' && tierForLevel('Basic') === 'full',
    '30日講座 … レベルから初めの段を選ぶ')
  ok(tierForLevel('B1') === 'core',
    '30日講座 … 知らないレベルでも、必ずどちらかになる')

  // ── 進み具合。**飛ばして進んでもよい** ──
  ok(nextDay([]) === 1, '30日講座 … 何もしていなければ1日目')
  ok(nextDay([1, 2, 4]) === 3,
    '30日講座 … 飛ばした日があれば、そこへ戻す(「終えた数 + 1」で出さない)',
    String(nextDay([1, 2, 4])))
  ok(nextDay(Array.from({ length: 30 }, (_, i) => i + 1)) === null,
    '30日講座 … すべて終えたら null')
  ok(courseRatio([]) === 0 && Math.abs(courseRatio([1, 2, 3]) - 0.1) < 1e-9,
    '30日講座 … 進み具合(0で割らない)')
  ok(courseRatio([1, 99, 0]) <= 1,
    '30日講座 … 範囲の外の日を渡しても、1を超えない')
  ok(courseList([2]).find((d) => d.no === 2)?.done === true
    && courseList([2]).find((d) => d.no === 1)?.done === false,
    '30日講座 … 終えた印が付く')

  // ── 中身の作法 ──
  ok(COURSE_DAYS.every((d) => d.points?.length && d.examples?.length),
    '30日講座 … どの日にも、仕組みの説明と例文がある')
  ok(COURSE_DAYS.every((d) => d.examples.every((x) => x.en?.trim() && x.ja?.trim())),
    '30日講座 … 例文には**必ず訳がある**(無いものをあるように見せない)')
  ok(dayPairs(1).length === dayOf(1).examples.length && dayPairs(99).length === 0,
    '30日講座 … 例文は Quick Response と同じ対の形で渡せる')

  // ── **弱点タグは、画面の一覧に必ずある** ──
  {
    const ids = new Set(weaknessTags.map((t) => t.id))
    const bad = [...new Set(COURSE_DAYS.flatMap((d) => d.tagIds ?? []))].filter((x) => !ids.has(x))
    ok(bad.length === 0, '30日講座 … 使っている弱点タグが、画面の一覧に全部ある', bad.join(' '))
  }

  // ── **画面が本当に呼んでいるか**(定義だけあって誰も呼ばなければ同じ) ──
  const read2 = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')
  const noC = (t) => t.replace(/\/\*[\s\S]*?\*\/|\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\/.*$/gm, '')
  const app = noC(read2('src/App.jsx'))
  ok(/<BasicsCourse me=\{profile\}/.test(app), '30日講座 … 画面から開ける')
  ok(/id: 'course'/.test(app), '30日講座 … メニューに出ている')
  /* **改行をまたげる形で見る。** `pages` の行は説明(`desc`)が付いて
     複数行になった(2026-09・ホーム)。`&& { id:` を1行の形で探していたので、
     **中身は1文字も変わっていないのに赤くなった** */
  /* **トレーナーには出さない、かつ指定したゲストにだけ出す**(0055)。
     > これは、トレーナー側から指定したゲストにのみ映るようにしてください */
  ok(/!isTrainer && basicsOn\)\) && \{\s*id: 'course'/.test(app),
    '30日講座 … ゲスト専用で、しかも指定したゲストにだけ出る')
  ok(!/'course'/.test(app.slice(app.indexOf('const TAB_IDS'), app.indexOf('const TAB_IDS') + 400)),
    '30日講座 … 下の帯は4つのまま(利用者が決めている)')

  const cs = noC(read2('src/components/BasicsCourse.jsx'))
  ok(/await lookupWord\(/.test(cs) && /await setWordStatus\(/.test(cs),
    '30日講座 … 単語帳へは `WordbookAdd` と同じ道で入れる')
  ok(/stop\.current/.test(cs),
    '30日講座 … まとめて入れるのを、途中でやめられる(止まる条件を持たせる)')
  ok(/\$\{words\.length\} 語をまとめて/.test(cs),
    '30日講座 … 押す前に何語かを出す(見えない費用は管理できない)')

  // ── 貼る SQL がそろっているか ──
  ok(/create table if not exists public\.course_days/.test(read2('supabase/apply/pending_matome.sql')),
    '30日講座 … まとめた1つに 0052 が入っている')
  ok(/table_name = 'course_days'/.test(read2('supabase/apply/check.sql')),
    '30日講座 … check.sql が 0052 を見ている')
  ok(/delete from public\.course_days where learner_id = p_learner/
    .test(read2('supabase/migrations/0052_basics_course.sql')),
    '30日講座 … ゲストを消すときに、講座の記録も消す(表を足したら消す側にも足す)')

  /* ══════════════════════════════════════════════════════════════
     基礎単語を、**それだけで選べる単語帳にする**(0053・2026-09 利用者の指定)

       > そして、講座の中の単語はそれぞれ基本360語、標準1200語、として
       > そもそもが独立して選べる単語帳にしてください

     見るのは4つ。
       ① 呼び名が「基本360語 / 標準1200語」で、**id は変えていない**
       ② 訳をファイルから引ける(**窓口を1回も呼ばない = 0円**)
       ③ 画面が本当に呼んでいるか(絞り込みは `App.jsx` の1つだけ)
       ④ 貼る SQL がそろっているか
     ══════════════════════════════════════════════════════════════ */
  const { basicJaOf, wordListFor } = await import('../src/lib/basicsCourse.js')

  // ── ① 呼び名。**id は 0052 の check と course_days に入っている** ──
  ok(COURSE_TIERS[0].label === '基本360語' && COURSE_TIERS[1].label === '標準1200語',
    '基礎単語 … 呼び名は「基本360語」「標準1200語」',
    COURSE_TIERS.map((t) => t.label).join(' / '))
  ok(COURSE_TIERS.every((t) => !/\*\*/.test(`${t.label}${t.ja}${t.hint}`)),
    '基礎単語 … 画面にそのまま出る文字列に `**` を混ぜない')

  // ── ② 訳はファイルから引く。**AI を1回も呼ばない** ──
  ok(basicJaOf(BASIC_WORDS[0].w) === BASIC_WORDS[0].ja,
    '基礎単語 … そろえた語から訳を引ける(0円)')
  ok(basicJaOf('zzzznotaword') === '' && basicJaOf(null) === '',
    '基礎単語 … 知らない語には空を返す(当てずっぽうで返さない)')
  ok(wordListFor('core').length === 360 && wordListFor('full').length === 1200
    && wordListFor('core').every((w) => typeof w === 'string'),
    '基礎単語 … 窓口へ渡す形(英単語だけの一覧)を1か所で作る')

  // ── ③ 画面が本当に呼んでいるか ──
  const wb = noC(read2('src/components/Wordbook.jsx'))
  ok(/<BasicWordsPick\s/.test(wb), '基礎単語 … 単語帳の画面に置いてある')
  ok(/meaning_ja: r\.meaning_ja \|\| basicJaOf\(r\.word_norm\)/.test(wb),
    '基礎単語 … 控えが無いときだけ、ファイルの訳を当てる')
  ok(/if \(r\.meaning_ja && r\.pos\) return r/.test(wb),
    '基礎単語 … 控えがある語は、1文字も書き換えない')
  /* **絞り込みは `App.jsx` の1つだけ。** 基礎単語は 2026-09 に冊そのものへ
     移したので、いまここを使うのはスピーチの語句である */
  ok(/onPicked=\{onPickWords\}/.test(wb),
    '基礎単語 … 絞り込みは外(App)に任せる(同じ道を2つ持たない)')

  const bp = noC(read2('src/components/BasicWordsPick.jsx'))
  ok(/await addBasicWords\(wordListFor\(info\.id\), learnerId\)/.test(bp),
    '基礎単語 … まとめて入れるのは `addBasicWords()` 1回だけ')
  ok(!/lookupWord/.test(bp),
    '基礎単語 … 1,200 語ぶんの意味を引きに行かない(0円のまま)')
  ok(/basicWordsSupported\(\)/.test(bp),
    '基礎単語 … 0053 がまだのときは、押せなくする(効かない操作を見せない)')
  ok(/お金はかかりません/.test(bp),
    '基礎単語 … 何が起きるかを、押す前に書く')

  /* **3つめ(何で絞っているか)は 0054 で足した。**
     基礎単語は既定の「この段の語」のまま(渡さない)*/
  ok(/onPickWords=\{\(words, label, what = 'この段の語'\) =>/.test(app),
    '基礎単語 … App が絞り込みを1つだけ持っている')
  ok(/onlyWhat=\{onlyWords\?\.what/.test(app),
    '基礎単語 … 何で絞っているのかを、呼ぶ側が言う(「この教材の語」と嘘をつかない)')

  // ── ④ 貼る SQL ──
  ok(/create or replace function public\.add_basic_words/
    .test(read2('supabase/apply/pending_matome.sql')),
    '基礎単語 … まとめた1つに 0053 が入っている')
  ok(/proname = 'add_basic_words'/.test(read2('supabase/apply/check.sql')),
    '基礎単語 … check.sql が 0053 を見ている')

  /* ══════════════════════════════════════════════════════════════
     基礎単語を、**3冊目の単語帳にする**(2026-09 利用者の指定)

       > 基礎単語360/1200も業種別の横に置いてください。

     「横」が指しているのは**冊の切り替えの行**である
     (「自分の単語帳 / 業種べつ」)。0053 では下の畳んだ欄で
     「入れてから、その段だけに絞る」だったので、
     **入れるまで1語も練習できなかった。**

     見るのは3つ。
       ① 行の形が `review_words()` とそろっているか(画面が書き分けずに済む)
       ② 覚え具合は**自分の単語帳**に残る(棚とは逆・0053 の指定)
       ③ 画面が本当に呼んでいるか
     ══════════════════════════════════════════════════════════════ */
  {
    const { basicRows } = await import('../src/lib/basicsCourse.js')
    const { BASIC_TIER_KEY, loadBasicTier, saveBasicTier } =
      await import('../src/data/basicsCourse.js')

    // ── ① 数と形 ──
    const core = basicRows('core', [], { today: '2026-09-13' })
    const full = basicRows('full', [], { today: '2026-09-13' })
    ok(core.length === 360 && full.length === 1200,
      '基礎単語の冊 … 段ごとに 360 / 1,200 語そろう',
      `${core.length} / ${full.length}`)

    /* **`review_words()` が返す形にそろえる。** そろっていないと、
       出題・4択・絞り込み・聞き流し・紙のどこかで黙って抜ける */
    const WANT = ['word_norm', 'display', 'kind', 'pos', 'meaning_ja',
      'seen_in', 'seen_in_ja', 'status', 'box', 'due_on', 'updated_at',
      'added_at', 'material_id', 'material_title', 'material_industry',
      'material_kind', 'material_genre', 'material_scene', 'material_level',
      'learn_streak']
    const miss = WANT.filter((k) => !(k in core[0]))
    ok(miss.length === 0,
      '基礎単語の冊 … 行の形が `review_words()` とそろっている', miss.join(' '))

    /* **まだ答えていない語は「まだ・箱0・今日出す」。**
       待たせる理由がない —— ここが「入れなくても練習できる」の中身である */
    ok(core[0].status === 'unknown' && core[0].box === 0
      && core[0].due_on === '2026-09-13',
      '基礎単語の冊 … 答えていない語は、そのまま今日出す')
    ok(core.every((r) => r.meaning_ja),
      '基礎単語の冊 … 訳が空の語が1つも無い(0円のまま4択が作れる)')
    /* **画面には日本語で出す。** 印は `n` / `v` なので、
       そのままだと語の上の小さな札に「n」と出る */
    ok(core.every((r) => !/^[a-z]+$/.test(r.pos)),
      '基礎単語の冊 … 品詞は日本語にしてから渡す',
      core.find((r) => /^[a-z]+$/.test(r.pos))?.pos ?? '')
    /* **出会った文は持たない。** 穴埋め(箱3)は `pickForm()` が
       「思い出す」に落とす(行き止まりを作らない) */
    ok(core.every((r) => r.seen_in === null),
      '基礎単語の冊 … 出会った文は持たない(穴埋めは思い出すに落ちる)')

    // ── 覚え具合を突き合わせる ──
    const seen = basicRows('core', [{
      word_norm: core[0].word_norm, status: 'learning', box: 3,
      due_on: '2026-10-01', learn_streak: 7, added_at: '2026-09-01',
    }], { today: '2026-09-13' })
    ok(seen[0].status === 'learning' && seen[0].box === 3
      && seen[0].due_on === '2026-10-01' && seen[0].learn_streak === 7,
      '基礎単語の冊 … 答えた語は、その覚え具合をそのまま持つ')
    ok(seen[1].status === 'unknown',
      '基礎単語の冊 … 答えていない語は、突き合わせても「まだ」のまま')

    // ── 段は覚える。**知らない値はやさしい段に落とす** ──
    ok(BASIC_TIER_KEY === 'eas.basicTier' && typeof saveBasicTier === 'function',
      '基礎単語の冊 … 段を覚える鍵は1か所(画面に書かない)')
    ok(loadBasicTier() === 'core',
      '基礎単語の冊 … 覚えていなければ、やさしい段から始める')

    // ── ② 覚え具合は自分の単語帳。**棚とは逆**(0053 の指定) ──
    const br = noC(read2('src/lib/basicReviews.js'))
    ok(/from\('word_reviews'\)/.test(br),
      '基礎単語の冊 … 覚え具合は自分の単語帳(`word_reviews`)から読む')
    ok(!/review_words/.test(br),
      '基礎単語の冊 … `review_words()` を通さない(上限で切られて後ろが「まだ」になる)')
    ok(!/lookupWord/.test(br),
      '基礎単語の冊 … 意味を引きに行かない(0円のまま)')

    // ── ③ 画面が本当に呼んでいるか ──
    ok(/const basicBook = book === 'basic'/.test(wb),
      '基礎単語の冊 … 3冊目として持っている')
    /* **`hasSub` が付いた**(第5.173節)。見ているのは
       「`showBasics` のときだけ並べるか」で、そこは1文字も変わっていない */
    ok(/\.\.\.\(showBasics \? \[\{ id: 'basic', label: '基礎単語'/.test(wb),
      '基礎単語の冊 … 冊の一覧は1か所。0055 で外された人には並べない')
    ok(/: loadBasicWordbook\(\{ learnerId, tier \}\)/.test(wb),
      '基礎単語の冊 … 画面が本当に読みに行っている')
    ok(/className="chiprow wb-tiers"/.test(wb),
      '基礎単語の冊 … 段の切り替え(基本360語 / 標準1200語)を出す')
    ok(/\{basicBook && \(\s*<BasicWordsPick/.test(wb),
      '基礎単語の冊 … 「自分の単語帳にも入れる」は、この冊の中に置く')
    /* **書き戻す先は自分の単語帳のまま。** 棚だけが `shelf_reviews` へ行く */
    ok(/\? await setShelfWordStatus\(row\.shelf/.test(wb)
      && /: await setWordStatus\(row\.word_norm/.test(wb),
      '基礎単語の冊 … 答えは自分の単語帳へ書き戻す(棚だけが別)')
    /* **「棚ではない」で書かない。** 書くと、冊を足すたびに
       置いた場所の数だけ食い違う */
    ok(!/\{!shelfBook &&/.test(wb),
      '基礎単語の冊 … 自分の単語帳だけの欄は `myBook` で出し分ける')
  }

  /* ══════════════════════════════════════════════════════════════
     品詞で絞る(2026-09 利用者の指定)

       > 全ての単語に対して効くようにして欲しいのが
       > 品詞ごとに分ける絞り込み機能です。

     **「全ての単語に対して」がこの検証のかなめである。**
     `pos` に入っている文字は2通りある ——
     窓口(`lookup-word`)が引いた**日本語**と、基礎単語の**短い印**。
     片方しか見ないと、**もう片方の語が丸ごと絞れない**まま緑になる。

     見るのは5つ。
       ① そろえ方(2通りの言葉が同じまとまりへ / 知らない語は空)
       ② **基礎単語 1,200 語が1つ残らず振り分けられるか**
       ③ 絞り込みの鍵に入っているか(**`runKeyOf` が書き写していないか**)
       ④ 絞り方そのもの
       ⑤ 画面が本当に呼んでいるか
     ══════════════════════════════════════════════════════════════ */
  const { POS_GROUPS, posGroupOf, posLabel } = await import('../src/lib/posGroups.js')
  const { basicPosOf } = await import('../src/lib/basicsCourse.js')
  const {
    FILTER_KEYS, applyWordbookFilter, posOf,
  } = await import('../src/lib/wordbookFilter.js')

  // ── ① そろえ方。**2通りの言葉が、同じまとまりへ行くか** ──
  ok(posGroupOf('名詞') === 'noun' && posGroupOf('n') === 'noun',
    '品詞 … 日本語(名詞)と短い印(n)が、同じまとまりになる',
    `${posGroupOf('名詞')} / ${posGroupOf('n')}`)
  ok(posGroupOf('他動詞') === 'verb' && posGroupOf('助動詞') === 'verb'
    && posGroupOf('v') === 'verb',
    '品詞 … 他動詞・助動詞も「動詞」へ寄せる(窓口は閉じた一覧ではない)')
  ok(posGroupOf('句動詞') === 'phrase' && posGroupOf('phr') === 'phrase',
    '品詞 … 句動詞・イディオムは「熟語・言い回し」へ')
  ok(posGroupOf('名詞・動詞') === 'noun',
    '品詞 … 2つ書いてあったら、最初に当たったものを採る')
  ok(posGroupOf('  名詞。') === 'noun' && posGroupOf('Noun') === 'noun',
    '品詞 … 前後の空白・大文字小文字・末尾の「。」は落とす')
  ok(posGroupOf('うんこ') === '' && posGroupOf('') === '' && posGroupOf(null) === '',
    '品詞 … 知らない言葉は空。**当てずっぽうで振り分けない**')
  ok(!POS_GROUPS.some((g) => /その他|ほか/.test(g.label)),
    '品詞 … 「その他」を作らない(名詞と助動詞が混ざって出る)')
  ok(new Set(POS_GROUPS.map((g) => g.id)).size === POS_GROUPS.length
    && POS_GROUPS.every((g) => posLabel(g.id) === g.label),
    '品詞 … id が重なっておらず、名前は `posLabel()` から引ける')

  // ── ② **基礎単語が1語残らず振り分けられるか** ──
  {
    const miss = BASIC_WORDS.filter((w) => !posGroupOf(basicPosOf(w.w)))
    ok(miss.length === 0,
      '品詞 … 基礎単語 1,200 語が、1語残らず振り分けられる',
      miss.slice(0, 5).map((w) => `${w.w}(${w.pos})`).join(' / '))
  }
  ok(basicPosOf('zzzznotaword') === '' && basicPosOf(null) === '',
    '品詞 … 知らない語には空を返す(訳とまったく同じ作法)')

  // ── ③ 絞り込みの鍵。**`runKeyOf` が一覧を書き写していないか** ──
  ok(FILTER_KEYS.includes('pos'),
    '品詞 … 絞り込みの鍵の一覧に入っている')
  ok(runKeyOf({ scope: 'due', size: 10, filter: { pos: 'noun' } })
     !== runKeyOf({ scope: 'due', size: 10, filter: { pos: 'verb' } }),
    '品詞 … 品詞を変えたら、出題を組み直す(`runKeyOf` が変わる)')
  {
    const rs = noC(read2('src/lib/reviewScope.js'))
    ok(/FILTER_KEYS\.map/.test(rs) && !/f\.level \?\? ''/.test(rs),
      '品詞 … `runKeyOf` が `FILTER_KEYS` を読む(鍵を書き写さない)')
  }

  // ── ④ 絞り方そのもの ──
  {
    const rows = [
      { word_norm: 'a', pos: '名詞' },
      { word_norm: 'b', pos: 'n' },
      { word_norm: 'c', pos: '他動詞' },
      { word_norm: 'd', pos: 'うんこ' },
      { word_norm: 'e' },
    ]
    const nouns = applyWordbookFilter(rows, { pos: 'noun' })
    ok(nouns.length === 2 && nouns.every((r) => 'ab'.includes(r.word_norm)),
      '品詞 … 「名詞」で絞ると、日本語の語も短い印の語も残る',
      nouns.map((r) => r.word_norm).join(''))
    ok(applyWordbookFilter(rows, { pos: 'verb' }).length === 1,
      '品詞 … 「動詞」で絞ると、他動詞の語が残る')
    ok(applyWordbookFilter(rows, {}).length === 5,
      '品詞 … 絞らなければ、品詞の分からない語もこれまでどおり出る')
    ok(posOf(rows[3]) === null && posOf(rows[4]) === null,
      '品詞 … 分からない語は `null`(選択肢にも出ない)')
  }

  // ── ⑤ 画面が本当に呼んでいるか ──
  {
    const wf = noC(read2('src/components/WordbookFilter.jsx'))
    ok(/posOf\(r\)\?\.key/.test(wf) && /POS_GROUPS\.filter/.test(wf),
      '品詞 … 絞り込みの画面が、その一覧から選択肢を作っている')
    ok(/pos: poss\.length > 1/.test(wf),
      '品詞 … 選べるものが1つ以下なら、行ごと出さない(効かない操作を見せない)')
    ok(/set\(\{ pos: e\.target\.value \|\| null \}\)/.test(wf),
      '品詞 … 選んだら、その値が絞り込みへ渡る')
    ok(!/pos === '名詞'|pos === 'n'/.test(wf),
      '品詞 … 画面の中で品詞を見分けない(`posGroupOf()` 1か所)')

    ok(/pos: r\.pos \|\| posLabel\(posGroupOf\(basicPosOf\(r\.word_norm\)\)\)/.test(wb),
      '品詞 … 控えが無いときだけ、基礎単語の品詞を当てる')
    ok(/if \(r\.meaning_ja && r\.pos\) return r/.test(wb),
      '品詞 … 控えがある語は、1文字も書き換えない')
  }

  /* ── **生の NUL を、ソースに書かない**(2026-09 にここで踏んだ)──
     `NO_MATERIAL` と `runKeyOf` の区切りは、**1バイトの NUL をそのまま**
     書いてあった。すると **git がそのファイルを「バイナリ」と見なし、
     差分も grep も効かなくなる**(実際、品詞を足すあいだ
     `WordbookFilter.jsx` の差分が1行も読めなかった)。
     `\u0000` と書けば**値は同じまま**、ふつうの文字列として読める。 */
  {
    /* **一覧を手で持たない**(2026-09・三度目に踏んで改めた)。
       はじめは4つのファイル名を並べていたが、**並べたところしか見ない**。
       実際 `shelfReviews.js` に同じものを書いたときは**素通りした。**
       `src/` をまるごと歩けば、**書き足さなくても検証が付いてくる**
       (`seed_rows.sql` に一覧を書かず、制約から読み取るのと同じ考え方)。 */
    const walk = (dir) => readdirSync(new URL(`../${dir}/`, import.meta.url),
      { withFileTypes: true })
      .flatMap((e) => (e.isDirectory()
        ? walk(`${dir}/${e.name}`)
        : (/\.(js|jsx|ts|tsx|css|html)$/.test(e.name) ? [`${dir}/${e.name}`] : [])))
    const files = walk('src')
    const bad = files.filter((f) => read2(f).includes('\u0000'))
    ok(bad.length === 0,
      'ソース … 生の NUL を書かない(git がバイナリと見なし、差分も grep も効かなくなる)',
      bad.join(' / '))
  }

  /* ── **読み込み中の画面**(2026-09 利用者の指定)────────────────────
       > アプリのロード中の画面を統一してスタイリッシュに映るようにせよ。
       > 今は田中みなみの画面が一瞬映ったりして微妙だ

     実測(1.5Mbps・390px)すると、**6.7 秒のあいだ何も出ていなかった** ——
     はじめの2秒は CSS すら届いていない**素の白**、そのあと 4.7 秒は
     **地色だけの画面**である。しかも役割が分かる前の `pages` は
     **ゲストの一覧**なので、トレーナーで入っても
     **一瞬だけゲストの画面が映って**から「教材」へ跳んでいた。

     どちらも **`npm run lint` にも `npm run build` にも引っかからない。**
     遅い回線で開いてみるまで分からないので、ここで見張る。 */
  {
    const html = read2('index.html')
    const loading = read2('src/components/Loading.jsx')
    const app = read2('src/App.jsx')
    const theme = read2('src/lib/theme.js')

    /* ① 起動画面が `index.html` に在る。**JavaScript より先に描く**もの
          なので、React の側にいくら書いても、いちばん待つあいだは出ない */
    ok(/<div id="root">\s*<div class="loading loading--full"/.test(html)
      && html.includes('class="loading-name"')
      && html.includes('class="loading-bar"')
      && html.includes('class="loading-note"')
      && html.includes('読み込み中…'),
    '起動画面 … index.html の #root の中に、はじめから描いてある')

    /* ② **`Loading.jsx` と同じ形。** 入れ替わった瞬間に画面が動かないよう、
          名前も文言もそろえる。**片方だけ直すと、そこで飛ぶ** */
    const cls = ['loading loading--full', 'loading-name', 'loading-bar', 'loading-note']
    const inBoth = cls.every((c) => html.includes(c)
      && loading.includes(c.replace('loading loading--full', 'loading--full')))
    ok(inBoth && loading.includes('読み込み中…'),
      '起動画面 … Loading.jsx と、名前も文言もそろっている')

    /* ③ **配色の印を、描く前に付ける。** これが無いと「明るい」を選んで
          いる人の端末が暗い設定のとき、**一瞬だけ暗い画面**が出る。
          鍵の名前は `theme.js` と同じでなければ、読めない */
    const key = /const KEY = '([^']+)'/.exec(theme)?.[1] ?? ''
    ok(key && html.includes(`localStorage.getItem('${key}')`)
      && html.includes("setAttribute('data-theme'"),
    `起動画面 … 配色の印(${key})を、描く前に付ける`)

    /* ④ **役割が分かるまで、中身を描かない。**
          `pages` は役割で中身が変わるので、プロフィールを読み終える前は
          ゲストの一覧になる。すると「メニューに無い画面なら先頭へ移す」が
          働いて、**トレーナーにゲストの画面が一瞬映る** */
    ok(/const booting = isSupabaseConfigured && !!session && !profileRead/.test(app),
      '起動 … 役割が分かるまでを `booting` 1か所で決める')
    ok(/if \(!authChecked \|\| booting\) \{/.test(app),
      '起動 … `booting` のあいだは、中身ではなく起動画面を出す')
    ok(/\n\s*if \(booting\) return\n\s*const ids = pageIds/.test(app),
      '起動 … `booting` のあいだは、画面を先頭へ移さない')

    /* ⑤ **引けなくても抜け出せる。** プロフィールが空で返ったときに
          読み終えた印を立てないと、**起動画面から二度と出られない** */
    /* **0055 で「この人に出すもの」も一緒に読むようになった。**
       どちらが転んでも、読み終えた印は必ず立てる */
    ok(/loadProfile\(session\.user\.id\)\.catch\(\(\) => null\)/.test(app)
      && /\.then\(\(\[p, f\]\) => done\(p, f\), \(\) => done\(null, null\)\)/.test(app)
      && /setProfile\(p\); setFeatures\(f\); setProfileRead\(true\)/.test(app),
    '起動 … プロフィールが引けなくても、起動画面から抜け出せる')

    /* ⑥ **画面まるごとの「読み込み中…」は、1つの部品に寄せる。**
          実測すると、同じ文字が `.loading` / `.muted` / `.hint` の
          **3つの見た目**で出ていた(字の大きさも色も違う) */
    const screens = [
      'src/App.jsx',
      'src/components/TrainerLearners.jsx',
      'src/components/TrainerMaterials.jsx',
      'src/components/LearnerHomework.jsx',
      'src/components/Wordbook.jsx',
      'src/components/QrReview.jsx',
    ]
    const missing = screens.filter((f) => !/<Loading[ />]/.test(read2(f)))
    ok(missing.length === 0,
      '読み込み中 … 画面まるごとのときは、6つとも Loading を使う',
      missing.join(' / '))

    /* ── ホーム(2026-09 利用者の指定)──────────────────────────
     *
     *   > ロードの後いきなり教材が映るのではなく、何か箱を並べて、
     *   > 選択したモードに飛ぶ仕様にしたいです
     *
     * **見えるところは `npm run test:bar` が描いて数える。**
     * こちらは**描いても分からない形**だけを見る ——
     * id を文字列で書いていないか、下の帯に混ざっていないか、
     * リンクの道が残っているか、行き先の一覧を2つ持っていないか。 */
    const home = noC(read2('src/components/AppHome.jsx'))
    const appSrc = noC(read2('src/App.jsx'))
    ok(/export const HOME_ID = 'home'/.test(home),
      'ホーム … id は `AppHome.jsx` 1か所が持つ')
    /* **`App.jsx` は2か所でこの id を使う**(`pages` に足す / 箱から外す)。
       文字列で書くと、名前を変えたときに必ず片方が残る */
    ok(/id: HOME_ID/.test(appSrc) && /view === HOME_ID/.test(appSrc)
      && !/'home'/.test(appSrc),
      'ホーム … `App.jsx` は `HOME_ID` を使う(文字列で書かない)')
    /* **箱にホームそのものを並べない**(押しても同じ場所に留まる) */
    ok(/pages\.filter\(\(p\) => p\.id !== HOME_ID\)/.test(home),
      'ホーム … ホームそのものは箱にしない(効かない操作を見せない)')
    /* **行き先の一覧を2つ持たない。** 名前も絵も説明も `pages` 1か所 */
    ok(!/id: '(materials|wordbook|qr|homework)'/.test(home),
      'ホーム … 行き先の一覧を自分で持たない(`pages` をそのまま並べる)')
    /* **開いた瞬間はホーム。ただしリンク(`?m=…`)で来た人はその教材へ** */
    ok(/useState\(askOpenId \? 'materials' : HOME_ID\)/.test(appSrc),
      'ホーム … 開いた瞬間はホーム(リンクで来た人だけ教材)')
    ok(/setView\(isTrainer && askOpenId \? 'materials' : HOME_ID\)/.test(appSrc),
      'ホーム … ログインした直後もホーム(リンクで来た人だけ教材)')
    /* **下の帯は4つのまま**(利用者が「この四つに」と決めている) */
    ok(!/HOME_ID/.test(
      appSrc.slice(appSrc.indexOf('const TAB_IDS'), appSrc.indexOf('const TAB_IDS') + 400),
    ), 'ホーム … 下の帯には足さない(☰ から戻る)')
    /* **説明も `pages` が持つ。** 呼び名と説明を2か所に分けない */
    ok((appSrc.match(/\n\s+desc: '/g) ?? []).length >= 8,
      'ホーム … 1行の説明は `pages` が持つ(呼び名と2か所に分けない)')

    /* ── 解答の読み上げ(2026-09 利用者の指定)────────────────
     *
     *   > 文型トレーニングなどの解答の和訳に「listen」ボタンは不要なので
     *   > 同じ仕様になっているところは全て削除してください
     *
     * 英文和訳の `answer` は**和訳そのもの(日本語)**なので、
     * そこに Listen を出しても日本語を英語の声で読むだけになる。 */

    /* ① **書き忘れを赤くする。** `fields` からも `audioFrom` からも
          解答の言語は当てられない(英文和訳と誤り訂正が同じ形になる)ので、
          `answerLang` を書くしかない。**足すまで赤いまま**なので、
          演習を足す人は必ず1回、自分の目で決めることになる */
    const noLang = EXERCISE_TYPES
      .filter((t) => (t.fields ?? []).includes('answer'))
      .filter((t) => t.answerLang !== 'en' && t.answerLang !== 'ja')
      .map((t) => t.id)
    ok(noLang.length === 0,
      '解答の読み上げ … `answer` を持つ演習は、必ず `answerLang` を書く',
      noLang.join(' / '))

    /* ② **和訳には出さない。英語には出す。**
          `comprehension` を落とさないこと —— あれは 0035 の
          利用者の指定(「音も聞けるように」)そのものである */
    ok(answerHasAudio('translate_en_ja') === false,
      '解答の読み上げ … 英文和訳(解答は和訳)には出さない')
    ok(['error_correction', 'fill_blank', 'translate_ja_en', 'listening', 'comprehension']
      .every((id) => answerHasAudio(id) === true),
    '解答の読み上げ … 解答が英語の5つには、これまでどおり出す')
    ok(answerHasAudio(null) === false && answerHasAudio('nope') === false,
      '解答の読み上げ … 種類が分からないうちは出さない(既定は鳴らさない)')

    /* ③ **判断は1か所。** 画面ごとに書くと、置く場所の数だけ食い違う。
          **「名前が出てくるか」で見ない** —— 説明にも import にも
          同じ語があるので、**使っている形**で見る */
    const answerEn = noC(read2('src/components/AnswerEn.jsx'))
    ok(/clipVoice !== undefined && answerHasAudio\(typeId\)/.test(answerEn),
      '解答の読み上げ … `AnswerEn` が `answerHasAudio()` に任せている')

    /* ④ **3つの画面が、演習の種類を渡している。**
          渡し忘れると既定(鳴らさない)に落ちるので、
          **内容の理解の Listen が黙って消える** */
    const answerScreens = [
      'src/components/MaterialBody.jsx',
      'src/components/LessonView.jsx',
      'src/components/LearnerHomework.jsx',
    ]
    const noType = answerScreens
      .filter((f) => !/typeId=\{sec\.exercise_type\}/.test(noC(read2(f))))
    ok(noType.length === 0,
      '解答の読み上げ … 3つの画面とも、演習の種類を渡している',
      noType.join(' / '))

    /* ⑤ **画面の中で種類を見分けない。**
          `typeId === 'translate_en_ja'` と書くと、演習を足すたびに
          3か所を直すことになる(`remakeModeOf()` と同じ考え方) */
    const hardCoded = [...answerScreens, 'src/components/AnswerEn.jsx']
      .filter((f) => /translate_en_ja|answerLang/.test(noC(read2(f))))
    ok(hardCoded.length === 0,
      '解答の読み上げ … 画面の中で演習の種類を見分けていない',
      hardCoded.join(' / '))
  }
}

/* ════════════════════════════════════════════════════════════════
   スピーチ練習 — 原稿・添削・音声・単語帳(0054・2026-09 利用者の指定)

     > ゲストアカウントのスピーチ内から受け取ったスピーチの原稿をAIにより
     > 添削し、そしてその文の音声を作成、ゲスト側で練習できる機能です。
     > トレーナー側からもゲスト毎にスピーチを登録できます。
     > そして、単語帳にはスピーチの単語帳も作ります。

   **新しい仕組みを1つも作っていない**ことを、ここで見張る ——
   添削は `mode: 'review_writing'`、音は `useBodyAudio`、
   語句は `lookupWord` → `setWordStatus`、絞り込みは `App.jsx` の1つ。
   どれかが**自前のものに置き換わったら赤くする。**
   ════════════════════════════════════════════════════════════════ */
console.log('\nスピーチ練習(0054)')
{
  const read3 = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')
  const noC3 = (t) => t.replace(/\/\*[\s\S]*?\*\/|\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\/.*$/gm, '')

  // ── ① 長さの上限。**窓口は、画面のいちばん大きい上限以上を受け取る** ──
  ok(MAX_SPEECH_CHARS === 3000,
    'スピーチ … 原稿の上限は 3,000 文字(話して4分ぶん)')
  ok(MAX_SPEECH_CHARS > MAX_WRITING_CHARS,
    'スピーチ … ディスカッションの答え(1,500)より長く取ってある')
  {
    /* **窓口が切る数が小さいと、終わりが黙って落ちる。**
       `npm run lint` にも `npm run build` にも引っかからない */
    const fn = read3('supabase/functions/generate-material/index.ts')
    const cut = /body\.answer \?\? ''\)\.trim\(\)\.slice\(0, (\d+)\)/.exec(fn)
    ok(cut && Number(cut[1]) >= MAX_SPEECH_CHARS,
      'スピーチ … 窓口も 3,000 文字まで受け取る(切って黙らない)',
      cut ? `窓口 ${cut[1]}` : '見つからない')
    /* **窓口に手を入れたら `FN_REV` を必ず1つ進める**(CLAUDE.md)。
       画面の `NEED_GEN_REV` とそろっていないと、
       置き直したのに「古い」と言い続ける */
    const rev = /const FN_REV = '([^']+)'/.exec(fn)
    const need = /export const NEED_GEN_REV = '([^']+)'/
      .exec(read3('src/lib/materials.js'))
    ok(rev && need && rev[1] === need[1],
      'スピーチ … 窓口の版と、画面が求める版がそろっている',
      rev && need ? `窓口 ${rev[1]} / 画面 ${need[1]}` : '見つからない')
  }
  ok(tooLongDraft('a'.repeat(MAX_SPEECH_CHARS + 1))
    && !tooLongDraft('a'.repeat(MAX_SPEECH_CHARS)),
    'スピーチ … ちょうど上限までは通し、1文字でも超えたら断る')
  ok(isBlankDraft('   \n ') && !isBlankDraft(' hi '),
    'スピーチ … 空白だけの原稿は「まだ書いていない」')

  // ── ② 題名。**「無題」で終わらせない** ──
  ok(speechTitleOf({ title: '来週の乾杯' }) === '来週の乾杯',
    'スピーチ … 題名があれば、それを出す')
  ok(speechTitleOf({ title: '  ', draft: '\n\nGood morning, everyone.\nI want to ...' })
    === 'Good morning, everyone.',
    'スピーチ … 題名が空なら、原稿の1行目から作る')
  ok(speechTitleOf({}) === '書きかけのスピーチ',
    'スピーチ … 原稿も空なら、そう言う(一覧で選べる名前にする)')
  ok(speechTitleOf({ draft: 'x'.repeat(80) }).length === 41,
    'スピーチ … 長い1行目は 40 文字で切って「…」を付ける')

  // ── ③ 添削が済むまで、練習の場所を出さない ──
  //     直す前の英文を鳴らすと、**まちがった英語を手本として聞かせる**
  const reviewed = {
    id: 's1', voice_id: 'us-1', updated_at: '2026-09-10T00:00:00Z',
    review: {
      sentences: [
        { en: 'Good morning, everyone.', ja: 'みなさん、おはようございます。' },
        { en: '', ja: 'これは空なので出さない' },
        { en: 'Thank you for coming.', ja: 'お越しくださりありがとうございます。' },
      ],
      phrases: [{ en: 'thank you for', ja: '〜をありがとう' }, { en: '', ja: 'x' }],
      notes: [], good: 'よく書けています',
    },
  }
  ok(!isReviewed({ draft: 'x' }) && !isReviewed({ review: { sentences: [] } }),
    'スピーチ … 添削が済んでいなければ「まだ」')
  ok(isReviewed(reviewed), 'スピーチ … 直した英文が1文でもあれば「添削ずみ」')

  // ── ④ 通しの読み上げ。**1文で1つ。声は全部同じ** ──
  {
    const parts = speechParts(reviewed)
    ok(parts.length === 2, 'スピーチ … 空の文は鳴らさない(2文)')
    ok(parts.every((p) => p.clipVoice === 'us-1'),
      'スピーチ … 1人が最後まで話しきる(声は全部同じ)')
    ok(speechParts({}).length === 0,
      'スピーチ … 添削が無ければ、鳴らすものも無い')
    /* **描く並びと、鳴らす並びは同じもの。**
       1つでもずれると、**別の文が光り、別の文が鳴る** */
    ok(speechLines(reviewed).length === parts.length,
      'スピーチ … 描く文の数と、鳴らす文の数がそろっている')
  }

  // ── ④' **音声は1本にまとめる**(2026-09 利用者の指定) ──
  //     > 音声については「1本にまとめる」の仕様に統一しましょう。
  //     1文ずつの Listen も、その1本の中の区間を鳴らす(二度課金しない)
  {
    const slice = speechWholeSlice(reviewed, 1)
    ok(slice && slice.index === 1 && slice.texts.length === 2,
      'スピーチ … 1文ずつの Listen は、1本の中の区間を指す')
    ok(slice && slice.texts[1] === 'Thank you for coming.',
      'スピーチ … **空の文を抜いた並び**で数える(描くときと同じ番号)',
      slice ? slice.texts.join(' / ') : 'null')
    ok(slice && slice.voiceIds.length === slice.texts.length
      && slice.voiceIds.every((v) => v === 'us-1'),
      'スピーチ … 声は人数ぶん揃えて渡す(1人が最後まで話しきる)')
    /* **断るときは `null`。** 呼ぶ側はこれまでどおり1文ずつ鳴らすので、
       音は必ず出る(**行き止まりを作らない**) */
    ok(speechWholeSlice({ voice_id: 'us-1', review: { sentences: [{ en: 'Hi.' }] } }, 0) === null,
      'スピーチ … 1文しか無ければ、1本にまとめない')
    ok(speechWholeSlice({ ...reviewed, voice_id: null }, 0) === null,
      'スピーチ … 声が決まっていなければ、1本にまとめない(Voice ID が要る)')
    ok(speechWholeSlice(reviewed, 2) === null && speechWholeSlice(reviewed, -1) === null,
      'スピーチ … 並びの外の番号では区間を作らない(別の文を鳴らさない)')
  }

  // ── ④'' **レベルはゲストのものを使う**(2026-09 利用者の指定) ──
  ok(speechLevelOf('A2+') === 'A2+' && speechLevelOf('C1') === 'C1',
    'スピーチ … 名簿にあるレベルは、そのまま使う')
  ok(speechLevelOf(null) === SPEECH_LEVEL_FALLBACK
    && speechLevelOf('') === SPEECH_LEVEL_FALLBACK
    && speechLevelOf('X9') === SPEECH_LEVEL_FALLBACK,
    'スピーチ … まだ判定していない / 知らない値は、既定に落とす')

  // ── ⑤ 単語帳に入れる語句。**別の一覧を作らない** ──
  ok(speechPhrases(reviewed).length === 1
    && speechWordList(reviewed)[0] === 'thank you for',
    'スピーチ … 覚えたい語句は、添削の `phrases` そのまま')

  // ── ⑥ 費用。**多めに見せない**(押すのをためらわせない) ──
  ok(speechCostYen('') === 0, 'スピーチ … 空なら 0 円')
  ok(speechCostYen('a'.repeat(10)) === 1, 'スピーチ … 短くても 1 円は出す')
  ok(speechCostYen('a'.repeat(MAX_SPEECH_CHARS)) === SPEECH_COST_YEN,
    'スピーチ … いちばん長くて 4 円')

  // ── ⑦ 並び。**新しく直したものが上** ──
  {
    const list = sortSpeeches([
      { id: 'a', updated_at: '2026-09-01T00:00:00Z', title: 'ふるい' },
      { id: 'b', updated_at: '2026-09-09T00:00:00Z', title: 'あたらしい' },
    ])
    ok(list[0].id === 'b', 'スピーチ … 新しい順に並べる')
  }

  // ── ⑧ **画面が本当に呼んでいるか**(定義だけあっても何も起きない) ──
  const board = noC3(read3('src/components/SpeechBoard.jsx'))
  ok(/canAskReview\(\)/.test(board),
    'スピーチ … 添削を走らせられるかは `canAskReview()` に任せている')
  ok(!/viewerRoleOf\(\)/.test(board),
    'スピーチ … 画面の中で役割を見分けていない(判断を2か所に置かない)')
  ok(/await reviewWriting\(\{/.test(board),
    'スピーチ … 添削は `mode: review_writing` の道をそのまま使う')
  ok(/<SpeechPractice speech=\{open\} learnerId=\{learnerId\} level=\{level\} \/>/.test(board),
    'スピーチ … 練習の中身は `SpeechPractice`(レベルもそのまま渡す)')
  /* **レベルをベタ書きしない**(2026-09 利用者の指定)。
     書くと Pre-Basic の人にも C2 の人にも**同じ難しさ**で直してくる */
  ok(/level: speechLevelOf\(level\)/.test(board) && !/level: 'B1'/.test(board),
    'スピーチ … 添削はゲストのレベルで頼む(`speechLevelOf()` 1か所)')
  /* **調子は、スピーチだけ別に覚える**(利用者の指定)。
     鍵の名前を画面に書かない —— `writingReview.js` の `TONE_KEYS` が持つ */
  ok(/loadWritingTone\(TONE_WHERE\)/.test(board)
    && /saveWritingTone\(e\.target\.value, TONE_WHERE\)/.test(board),
    'スピーチ … 添削の調子は、ディスカッションとは別に覚える')
  ok(!/eas\.speechTone|eas\.writingTone/.test(board),
    'スピーチ … 覚える鍵の名前を、画面に書き写していない')
  {
    /* **同じ鍵で覚えると、片方を直すともう片方まで変わる** */
    const wr = read3('src/lib/writingReview.js')
    ok(/writing: 'eas\.writingTone'/.test(wr) && /speech: 'eas\.speechTone'/.test(wr),
      'スピーチ … 調子の鍵は場面ごとに分けてある')
  }
  /* **`SpeechPractice` は props で中身を受け取る。**
     こうしておくと `npm run test:bar` が本物の部品のまま測れる ——
     `SpeechBoard` は自分で読み込むので、Supabase の無い骨組みでは
     **何も描かれない**(描けないものは測れない) */
  const prac = noC3(read3('src/components/SpeechPractice.jsx'))
  ok(/useBodyAudio\(\)/.test(prac),
    'スピーチ … 通しの読み上げは `useBodyAudio`(紙・集中モードと同じ道具)')
  ok(/tier=\{PREMIUM\}/.test(prac) && /tier: PREMIUM/.test(prac),
    'スピーチ … 良い声の段で鳴らす(1文ずつも、通しも)')
  ok(/await lookupWord\(/.test(prac) && /await setWordStatus\(/.test(prac),
    'スピーチ … 1語ずつ単語帳へ入れる道も、`WordbookAdd` と同じ')
  ok(!/RepeatUnit/.test(prac),
    'スピーチ … 1文が1つの部なので、「文」と「段落」を2つ見せない')
  /* **1本にまとめた音声の区間を鳴らす**(2026-09 利用者の指定)。
     渡さなくなると**その文だけの MP3 を別に作って二度課金する**が、
     **音は鳴る**ので押してみても気づけない */
  ok(/whole=\{speechWholeSlice\(speech, i\)\}/.test(prac),
    'スピーチ … 1文ずつの Listen に、1本の中の区間を渡している')
  /* **集中モードは `FocusFrame` をそのまま使う**(骨組みを2つ持たない)。
     **6Steps は足していない**(利用者の指定「今のままに集中モードだけつけて」) */
  ok(/<FocusFrame/.test(prac) && /className="speechfocus"/.test(prac),
    'スピーチ … 集中モードの骨組みは `FocusFrame` 1つ')
  ok(!/SIX_STEPS|StepFocus/.test(prac),
    'スピーチ … 6Steps は足していない(言われた場所だけを直す)')
  /* **中身は書き写さない。** ふだんの一覧と同じ `lineOf()` を渡す */
  ok(/\{lineOf\(sentences\[at\], at\)\}/.test(prac)
    && /\{lineOf\(s, i\)\}/.test(prac),
    'スピーチ … 集中モードの中身は、ふだんの一覧とまったく同じもの')
  ok(/level=\{lv\}/.test(prac) && /level: lv/.test(prac) && !/level="B1"/.test(prac),
    'スピーチ … 語の意味も、ゲストのレベルで引く')

  const pron = noC3(read3('src/components/PronunciationPractice.jsx'))
  ok(/<SpeechBoard level=\{me\?\.cefr \?\? null\} \/>/.test(pron),
    'スピーチ … 「スピーチ練習」の画面に出ていて、自分のレベルを渡している')

  /* ── 単語とフレーズの音は、いま出していない(2026-09 利用者の指定)──────
       > 発音の機能は一度廃止してください。
       > いつでも戻せるように

     **消していない。閉じてある。**「いつでも戻せるように」という指定なので、
     見るのは3つ ——①既定で閉じているか ②道が残っているか
     ③画面が判断を自分で持っていないか。
     `LEARNER_WRITING_REVIEW`(ゲストの添削)の裏の道と同じ作法である */
  const sndSw = noC3(read3('src/data/soundPractice.js'))
  ok(/export const SOUND_PRACTICE_ON = false/.test(sndSw),
    '発音の廃止 … 既定は「出さない」(戻す日はこの1行を true にするだけ)')
  ok(/export function soundPracticeOn\s*\(/.test(sndSw),
    '発音の廃止 … 出すかどうかの判断は `soundPracticeOn()` 1か所')

  /* **道が残っているか。** 部品ごと消すと、戻したい日に画面を書き直すことに
     なり、そのときには「なぜ廃止したのか」の経緯も失われている */
  const snd = noC3(read3('src/components/SoundPractice.jsx'))
  ok(/SPEAK_TYPES/.test(snd) && /className="pron-list"/.test(snd),
    '発音の廃止 … 練習の中身は消していない(`SoundPractice.jsx` に残してある)')

  /* **画面の中で `SOUND_PRACTICE_ON` と直に書かない** ——
     置く場所の数だけ食い違う(`remakeModeOf()` と同じ考え方)。
     **「名前が出てくるか」で見ない**(説明の中にも同じ語がある)ので、
     コメントを落としたうえで**使っている形**で見る */
  ok(/\{soundPracticeOn\(\) && <SoundPractice \/>\}/.test(pron),
    '発音の廃止 … 画面は `soundPracticeOn()` に任せている')
  ok(!/SOUND_PRACTICE_ON/.test(pron) && !/SPEAK_TYPES/.test(pron),
    '発音の廃止 … 画面は判断も中身も自分で持っていない')

  const learners = noC3(read3('src/components/TrainerLearners.jsx'))
  ok(/detailTab === 'speech'/.test(learners)
    && /<SpeechBoard learnerId=\{l\.id\}/.test(learners)
    && /level=\{l\.cefr \?\? null\}/.test(learners),
    'スピーチ … ゲストのページからも登録でき、そのゲストのレベルで頼む')

  // ── ⑨ 単語帳。**絞り込みは `App.jsx` の1つ** ──
  const wb = noC3(read3('src/components/Wordbook.jsx'))
  ok(/<SpeechWordsPick learnerId=/.test(wb),
    'スピーチ … 単語帳に「スピーチの語句」が出ている')
  const pick = noC3(read3('src/components/SpeechWordsPick.jsx'))
  ok(/onPicked\?\.\(speechWordList\(now\), speechTitleOf\(now\), 'このスピーチの語句'\)/
    .test(pick),
    'スピーチ … 絞り込みは呼ぶ側(`App.jsx`)に任せ、何で絞ったかも渡す')
  ok(/await lookupWord\(/.test(pick) && /await setWordStatus\(/.test(pick),
    'スピーチ … 単語帳へは `WordbookAdd` と同じ道(意味も1回だけ引く)')
  ok(!/add_basic_words|rpc\(/.test(pick),
    'スピーチ … 語句は語でも句でもあるので、`add_basic_words` は使わない')
  const app3 = noC3(read3('src/App.jsx'))
  ok(/onPickWords=\{\(words, label, what = 'この段の語'\) =>/.test(app3),
    'スピーチ … 何で絞っているのかは、呼ぶ側が言う(入れ物は1つのまま)')

  // ── ⑩ **貼る SQL がそろっているか** ──
  ok(/table_name = 'speeches'/.test(read3('supabase/apply/check.sql')),
    'スピーチ … `check.sql` に 0054 の行がある')
  ok(/create table if not exists public\.speeches/
    .test(read3('supabase/apply/pending_matome.sql')),
    'スピーチ … まとめた1つに 0054 が入っている')
  ok(/delete from public\.speeches where learner_id = p_learner/
    .test(read3('supabase/migrations/0054_speeches.sql')),
    'スピーチ … 表を足したら、消す側(`erase_learner`)にも足す')
}

/* ══════════════════════════════════════════════════════════════════
 * ⑫ **準備が済んでいるかを、アプリが自分で訊く**(2026-09 実機・利用者の問い)
 *
 *   > ①supabase/apply/pending_matome.sql を貼る ②generate-material を置き直す。
 *   > これをやったかどうか覚えていません。この現象がなん度も起きています。
 *   > あなたで把握できる方法はないのですか？
 *
 * 【この検証が守るもの】
 *   ・**印が古びないこと** —— 移行を足したら `NEWEST_MIGRATION` も直す
 *     (直すまで赤いまま。`check.sql` とまったく同じ作法)
 *   ・**版を訊く道が、ただのままであること** —— 窓口の
 *     「読めない中身は、いちばん手前で断る」を消す・順を下げると、
 *     **この問い合わせがそのまま課金になる**
 *   ・**画面が本当に呼んでいること** —— 定義だけあって誰も呼ばなければ、
 *     いままでと何も変わらない(`noteFnRev` で踏んだ落とし穴)
 * ══════════════════════════════════════════════════════════════════ */
{
  const read4 = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')
  const noC4 = (t) => t.replace(/\/\*[\s\S]*?\*\/|\{\/\*[\s\S]*?\*\/\}/g, '')

  const state = read4('src/lib/setupState.js')

  /* ── 印は、いちばん新しい移行とそろっているか ── */
  const newest = readdirSync(new URL('../supabase/migrations/', import.meta.url))
    .filter((f) => /^\d{4}_.*\.sql$/.test(f))
    .sort()
    .at(-1)
  const newestNo = newest.slice(0, 4)
  ok(new RegExp(`NEWEST_MIGRATION = '${newestNo}'`).test(state),
    `準備の状態 … 印がいちばん新しい移行(${newestNo})にそろっている`,
    `いちばん新しいのは ${newest}`)

  /* **表を作らない移行もある**(0056 は関数の上限を上げるだけ)。
     `table` なら表の有無、`rpc` なら関数の有無を印にする。
     どちらでも「**その移行が本当に作るもの**」であることは変わらない */
  const markT = /NEWEST_MARK = \{\s*table: '([a-z_]+)'/.exec(noC4(state))?.[1] ?? ''
  const markF = /NEWEST_MARK = \{\s*rpc: '([a-z_]+)'/.exec(noC4(state))?.[1] ?? ''
  /* **行そのものを印にすることもある**(0060 は弱点タグを2行足すだけで、
     表も列も関数も1つも増えない)。`weakness_tags` は 0001 からあるので、
     表の有無で見ると**貼る前でも「もう入っています」と出る** ——
     CLAUDE.md が「いちばん悪い壊れ方」と呼んでいるものである */
  const markR = /row: \{ column: '[a-z_]+', value: '([a-z-]+)' \}/
    .exec(noC4(state))?.[1] ?? ''
  const makesMark = (src) => {
    /* **行の印を先に見る。** `table` も一緒に書いてあるので、
       順を逆にすると「表を作っているか」で見てしまい、必ず落ちる */
    if (markR && markT) {
      return new RegExp(`insert into public\\.${markT}\\b[\\s\\S]*'${markR}'`).test(src)
    }
    if (markT) return new RegExp(`create table if not exists public\\.${markT}\\b`).test(src)
    if (markF) return new RegExp(`create or replace function public\\.${markF}\\(`).test(src)
    return false
  }
  ok(makesMark(read4(`supabase/migrations/${newest}`)),
    `準備の状態 … 印(${markT || markF || '(無し)'})は、その移行が本当に作るものである`)
  /* **まとめた1つに入っていなければ、貼っても印は現れない** */
  ok(makesMark(read4('supabase/apply/pending_matome.sql')),
    '準備の状態 … その印は、まとめた1つ(`pending_matome.sql`)にも入っている')

  /* ── 表の有無だけを見る。**ほかの理由と混ぜない** ── */
  ok(/42P01|PGRST205/.test(state) && /schema cache/.test(state),
    '準備の状態 … 「そんな表は無い」だけを「まだです」と読む')
  ok(/return 'unknown'/.test(state),
    '準備の状態 … 分からないときは `unknown`(騒がない)')
  /* **押せる URL を渡す**(`raw.` は非公開のリポジトリでは開けない) */
  ok(/github\.com\/[^\s']+\/blob/.test(state) && !/raw\.githubusercontent/.test(state),
    '準備の状態 … 貼るものは、押せる URL で渡している')
  /* **画面にそのまま出る文字列に、`**` を混ぜない**(CLAUDE.md)。
     Markdown としては読まれないので、画面にそのまま見える。
     実際にこの回で1つ混ぜていた(描いて実測して気づいた) */
  ok(!/\*\*/.test(noC4(state).replace(/\s\/\/.*$/gm, '')),
    '準備の状態 … 画面に出る文に、強調の書き方が混じっていない')

  /* ── ②の版は、0円で訊いている ── */
  const mats4 = noC4(read4('src/lib/materials.js'))
  ok(/export async function checkGenGateway\(force = false\)/.test(mats4),
    '準備の状態 … 生成の窓口にも、版を訊きに行く道がある')
  ok(/invoke\('generate-material', \{[\s\S]{0,300}?body: '\(版を訊くだけ/.test(mats4),
    '準備の状態 … 読めない中身を送って、いちばん手前で断らせる(0円)')
  ok(/Failed to send a request\|FunctionsFetchError/.test(mats4)
    && /return\s+\/\/ 届いていない/.test(mats4),
    '準備の状態 … 届かなかったときは「古い」と言わない')

  /* **窓口の側で、この道を塞がないこと。**
     `req.json()` の断りは Claude を1度も呼ばないいちばん手前にある。
     消す・順を下げると、版を訊くだけの問い合わせが課金になる */
  const fn4 = read4('supabase/functions/generate-material/index.ts')
  const cut = fn4.indexOf("if (mode === 'chunk_ja')")
  const head = fn4.slice(0, cut > 0 ? cut : fn4.length)
  ok(cut > 0 && /catch \{ return reply\(\{ error: '内容を読めませんでした' \}, 400\) \}/
    .test(head),
    '準備の状態 … 窓口は、読めない中身を Claude より手前で断っている')
  ok(/genRev: FN_REV/.test(fn4),
    '準備の状態 … 窓口は、どの応答にも版を付けている')

  /* ── 画面が本当に呼んでいるか ── */
  /* **「名前が出てくるか」で見ない**(赤チェックで実際に素通りした)。
     `// await checkGenGateway(force)` と**打ち消しても文字は残る**ので、
     **行の頭から**見る */
  ok(/^\s*await checkGenGateway\(force\)$/m.test(noC4(state)),
    '準備の状態 … ②は `checkGenGateway()` に任せている(数え方を2通り持たない)')
  const note4 = noC4(read4('src/components/SetupStatus.jsx'))
  ok(/pendingSetup\(\)\.then\(/.test(note4) && /await pendingSetup\(true\)/.test(note4),
    '準備の状態 … 画面が訊きに行き、済ませたあとは確かめ直せる')
  ok(/if \(!canSeeSystemDetail\(\)\) return null/.test(note4),
    '準備の状態 … ゲストには出さない(既定は「見せない」)')
  ok(/if \(!done \|\| !todo\.length\) return null/.test(note4),
    '準備の状態 … 済んでいれば1ドットも出さない')
  ok(/<SetupStatus role=\{profile\?\.role \?\? null\} \/>/.test(noC4(read4('src/App.jsx'))),
    '準備の状態 … `App.jsx` が本当に置いている')

  /* **印を読むときに、列の名前を書かない**(0055 で踏みかけた)。
     `select('id')` のままだと、`id` を持たない表を印に選んだ瞬間、
     断りが「そんな列は無い」(42703)になって `noTable()` をすり抜け、
     **入っていないのに黙る**ことになる */
  ok(/\.from\(NEWEST_MARK\.table\)\.select\('\*'\)/.test(noC4(state)),
    '準備の状態 … 印は「表があるか」だけを見る(列の名前を書かない)')
  /* **関数の印も読めること**(0056)。読めないと、貼る前でも黙ってしまう */
  ok(/await supabase\.rpc\(NEWEST_MARK\.rpc\)/.test(noC4(state)),
    '準備の状態 … 関数の印も見に行く')
  /* **行の印も読めること**(0060)。**0件を「まだです」と読む**のがかなめで、
     ここが `if (!error) return 'ok'` のままだと、
     **表さえあれば「もう入っています」**になって印の意味が消える */
  ok(/NEWEST_MARK\.row/.test(noC4(state))
    && /\.eq\(column, value\)\.limit\(1\)/.test(noC4(state))
    && /return \(data\?\.length \?\? 0\) > 0 \? 'ok' : 'missing'/.test(noC4(state)),
  '準備の状態 … 行の印も見に行き、0件は「まだです」と読む')
  ok(/PGRST202/.test(noC4(state)) && /42883/.test(noC4(state)),
    '準備の状態 … 「そんな関数は無い」も「まだです」と読む')
}

/* ══════════════════════════════════════════════════════════════════
   ⑬ **ゲストごとに「出すもの」を決める**(0055・2026-09 利用者の指定)

     > ゲストの画面から
     > 基礎英文法講座と基本単語を取り除いてください。
     > これは、トレーナー側から指定したゲストにのみ映るようにしてください

   【この検証が守るもの】
     ・**判断が1か所であること** —— 画面の中で `role === 'learner'` と
       書くと、置く場所の数だけ食い違う(`remakeModeOf()` と同じ)
     ・**既定が「出さない」であること** —— 役割が分からないうちも出さない
     ・**2つで1つであること** —— 30日講座と基礎単語は、同じ判断で出る
     ・**画面が本当に呼んでいること** —— 一覧だけ作って誰も見なければ、
       いままでと何も変わらない
   ══════════════════════════════════════════════════════════════════ */
{
  const read5 = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')
  const noC5 = (t) => t.replace(/\/\*[\s\S]*?\*\/|\{\/\*[\s\S]*?\*\/\}/g, '')

  /* ── 一覧 ── */
  ok(LEARNER_FEATURES.length >= 1
    && LEARNER_FEATURES.every((f) => f.id && f.label && f.hint),
    '出すもの … 一覧の1行ずつに id・呼び名・説明がある')
  ok(new Set(LEARNER_FEATURES.map((f) => f.id)).size === LEARNER_FEATURES.length,
    '出すもの … id が重なっていない')
  ok(!!featureOf(BASICS) && featureOf('なにもない') === null,
    '出すもの … 知らない id は `null`(当てずっぽうで返さない)')
  /* **画面にそのまま出る文字列に、`**` を混ぜない**(CLAUDE.md)。
     `<p>` に出るので Markdown としては読まれず、そのまま見える */
  ok(!LEARNER_FEATURES.some((f) => /\*\*/.test(`${f.label}${f.hint}`)),
    '出すもの … 画面に出る文に、強調の書き方が混ざっていない')

  /* ── 判断(`showsBasics`)。**既定は「出さない」** ── */
  const on = new Set([BASICS])
  ok(showsBasics({ role: 'trainer', features: null }) === true
    && showsBasics({ role: 'owner', features: null }) === true,
    '出すもの … ゲスト以外には、これまでどおり出す')
  ok(showsBasics({ role: 'learner', features: on }) === true,
    '出すもの … 入れたゲストには出す')
  ok(showsBasics({ role: 'learner', features: new Set() }) === false,
    '出すもの … 入れていないゲストには出さない')
  ok(showsBasics({ role: 'learner', features: null }) === false,
    '出すもの … 読めていないゲストには出さない')
  ok(showsBasics({ role: null, features: null }) === false
    && showsBasics() === false,
    '出すもの … 役割が分からないうちは出さない(既定は「出さない」)')

  /* ── 画面が本当に呼んでいるか ──
     **「名前が出てくるか」で見ない** —— 使っている形で見る */
  const app = noC5(read5('src/App.jsx'))
  ok(/showsBasics\(\{ role: profile\?\.role \?\? null, features \}\)/.test(app),
    '出すもの … `App.jsx` は `showsBasics()` に任せている')
  ok(!/role === 'learner'.*basics|basics.*role === 'learner'/i.test(app),
    '出すもの … `App.jsx` の中で役割をベタ書きしていない')
  ok(/!isTrainer && basicsOn\)\) && \{\s*id: 'course'/.test(app),
    '出すもの … 30日講座は、指定したゲストにだけ出る')
  ok(/showBasics=\{basicsOn\}/.test(app),
    '出すもの … 基礎単語にも、まったく同じ判断を渡している(2つで1つ)')

  const wb = noC5(read5('src/components/Wordbook.jsx'))
  ok(/showBasics = true,/.test(wb),
    '出すもの … 単語帳の既定は真(トレーナー自身の単語帳は変わらない)')
  /* **2026-09 に、基礎単語は3冊目の単語帳になった**(利用者の指定
     「基礎単語360/1200も業種別の横に置いてください」)。
     判断の渡り方は1文字も変わっていない —— 見る場所が
     「畳んだ欄を出すか」から「冊を並べるか」へ移っただけである */
  ok(/showBasics \? \[\{ id: 'basic', label: '基礎単語'/.test(wb),
    '出すもの … 単語帳は、渡された判断を本当に見ている')
  ok(!/showsBasics|viewerRoleOf/.test(wb),
    '出すもの … 単語帳の中で、自分で役割を見ていない')

  /* ── トレーナーが決める側 ── */
  const tl = noC5(read5('src/components/TrainerLearners.jsx'))
  /* **第5.181節で、帳面ごとに分けて出すようにした**(`featuresIn()`)。
     見たいのは「一覧を回している(書き写していない)」ことのほうである */
  /* **第5.186節で `AssignShelf` に寄せた。** 一覧を回すのはあちらで、
     画面が渡すのは**どちらの帳面か**(`group`)だけである */
  ok(/group="word"/.test(tl) && /group="qr"/.test(tl),
    '出すもの … 帳面を名指しで渡している(画面で振り分けていない)')
  {
    const as = noC5(read5('src/components/AssignShelf.jsx'))
    ok(/featuresIn\(group\)\.map\(/.test(as),
      '出すもの … 冊の一覧は回している(書き写していない)')
  }
  ok(/await setLearnerFeature\(learner\.id, feat\.id, next\)/.test(tl),
    '出すもの … 決める欄は `setLearnerFeature()` を呼んでいる')
  ok(/loadLearnerFeatures\(id\)/.test(tl),
    '出すもの … そのゲストのぶんを読んでいる')

  /* ── 判断を、Supabase 側のファイルに書き写していないか ── */
  const lib5 = noC5(read5('src/lib/learnerFeatures.js'))
  ok(!/export function showsBasics/.test(lib5),
    '出すもの … 判断は `src/data/` 1か所(素の node で確かめられる形)')

  /* ── 貼る SQL がそろっているか ── */
  for (const f of ['supabase/migrations/0055_learner_features.sql',
    'supabase/apply/pending_matome.sql']) {
    const sql = read5(f)
    ok(/create table if not exists public\.learner_features/.test(sql)
      && /create policy "担当トレーナーが決める" on public\.learner_features/.test(sql)
      && /create or replace function public\.set_learner_feature/.test(sql)
      && /delete from public\.learner_features where learner_id = p_learner/.test(sql),
      `出すもの … ${f.split('/').pop()} に表・RLS・窓口・消す行がそろっている`)
  }
  /* **名前の一覧(check)を置かない** —— 置くと、1つ足すたびに
     SQL を貼り直してもらうことになる(`material_sections_type_check` の落とし穴) */
  ok(!/check \(feature in/.test(read5('supabase/migrations/0055_learner_features.sql')),
    '出すもの … `feature` に一覧(check)を置いていない(足すのに SQL が要らない)')
}

/* ────────────────────────────────────────────────────────────
   単語帳 / Quick Response 帳を紙に出す(2026-09 利用者の指定)

     > ちなみに、単語帳やクイックレスポン帖の内容を印刷する機能を
     > 追加してください。
     > フォーマットは、左に日本語、右に英語が来るようにしてください。
     > 教材を印刷、PDFにした時のクイックレスポンの部分と同じ仕様です

   ここで見るのは**算段**である ——
   対の作り方・落とすもの・副題・**画面が本当に呼んでいるか**。
   **紙の見え方(左が日本語・右が英語)は `npm run test:bar` が
   印刷モードで描いて測る。** 役目が違うので、片方だけにしない。
   ──────────────────────────────────────────────────────────── */
{
  const readS = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')
  const noCS = (t) => t.replace(/\/\*[\s\S]*?\*\/|\{\/\*[\s\S]*?\*\/\}/g, '')

  /* ── 対に直す ── */
  const wp = wordSheetPairs([
    { word_norm: 'take on', display: 'take on', meaning_ja: '引き受ける' },
    { word_norm: 'gist', display: '', meaning_ja: '要点' },
    { word_norm: '', display: '', meaning_ja: 'これは落ちる' },
  ])
  ok(wp.length === 2, '紙 … 英語の無い行は落ちる')
  ok(wp[0].ja === '引き受ける' && wp[0].en === 'take on',
    '紙 … 左が日本語(意味)、右が英語(語)')
  ok(wp[1].en === 'gist',
    '紙 … `display` が空でも `word_norm` から英語を取る')
  /* **訳が無い語は落とさない。** 控えがまだ引けていないだけである */
  const wp2 = wordSheetPairs([{ word_norm: 'gist', display: 'gist', meaning_ja: '' }])
  ok(wp2.length === 1 && wp2[0].ja === '' && wp2[0].en === 'gist',
    '紙 … 訳の無い語も落とさない(黙って減らさない)')
  ok(wordSheetPairs(null).length === 0 && wordSheetPairs(undefined).length === 0,
    '紙 … 一覧でないものを渡しても落ちない')

  /* ── 品詞とレベル(2026-09 実機・利用者の指定「また、品詞とレベルも。」)──
     **新しい入れ物を作っていない。** 行がもともと持っている
     `pos` と `material_level` を、そのまま持たせるだけである */
  const wp3 = wordSheetPairs([
    {
      word_norm: 'take on', display: 'take on', meaning_ja: '引き受ける',
      pos: '熟語', material_level: 'B1',
    },
    { word_norm: 'gist', display: 'gist', meaning_ja: '要点' },
  ])
  ok(wp3[0].pos === '熟語' && wp3[0].level === 'B1',
    '紙 … 品詞とレベルを持つ(`pos` / `material_level` から)')
  ok(wp3[1].pos === '' && wp3[1].level === '',
    '紙 … 分からない語は空のまま(当てずっぽうで埋めない)')

  /* ── どの単語帳を刷ったのかを、題に書く ──
       > タイトルの部分を「単語」だけでなく「ビジネス一般」と… */
  ok(sheetTitle({}) === '単語帳', '紙 … 自分の単語帳は「単語帳」だけ')
  ok(sheetTitle({ owner: 'Airi さん' }) === 'Airi さんの単語帳',
    '紙 … 誰の単語帳かを題に書く')
  ok(sheetTitle({ book: 'shelf', shelves: ['business'] }) === '単語帳 — ビジネス全般',
    '紙 … 業種べつは、棚の名前を題に書く')
  ok(sheetTitle({ owner: 'Airi さん', book: 'shelf', shelves: ['business'] })
    === 'Airi さんの単語帳 — ビジネス全般',
    '紙 … 誰の・どの冊かを、両方とも題に書く')
  ok(sheetTitle({ book: 'basic', tier: 'full' }) === '単語帳 — 標準1200語',
    '紙 … 基礎単語は、段の名前を題に書く')
  ok(bookLabel({ book: 'shelf', shelves: ['business', 'it'] }) === 'ビジネス全般 / IT・技術',
    '紙 … 棚を2冊開いていれば、2つとも書く')
  ok(bookLabel({ book: 'shelf', shelves: [] }) === ''
    && bookLabel({ book: 'shelf', shelves: ['', null] }) === '',
    '紙 … 棚を1冊も開いていなければ、題に足さない')
  /* **知らない id は、そのまま出す**(`shelfLabel()` の決まりに従う)。
     題から**黙って落とさない** —— 分野を組み替えたあとでも、
     何を刷ったのかが紙に残る(**黙って減らさない**・CLAUDE.md)。
     **ここで名前の引き方を書き換えない**(一覧は `shelves.js` 1か所) */
  ok(bookLabel({ book: 'shelf', shelves: ['zzz'] }) === 'zzz',
    '紙 … 名前の引けない棚も、題から黙って落とさない')
  ok(bookLabel({}) === '' && bookLabel() === '',
    '紙 … 冊の名前は、渡さなくても落ちない')

  /* ── ページの下へ渡す題(`@page` の余白の箱)──
     **引用符と `\` を逃がす。** 逃がさないと、題に `"` が1つ入った
     だけで宣言ごと壊れ、**どのページにも何も出なくなる** */
  ok(cssString('単語帳 — ビジネス全般') === '"単語帳 — ビジネス全般"',
    '紙 … 題を CSS の文字列に直す')
  ok(cssString('a "b" c') === '"a \\"b\\" c"', '紙 … 引用符を逃がす')
  ok(cssString('a \\ b') === '"a \\\\ b"', '紙 … `\\` を逃がす')
  ok(cssString('a\nb  c') === '"a b c"', '紙 … 改行と連なる空白は1つに直す')
  ok(cssString(null) === '""' && cssString(undefined) === '""',
    '紙 … 題が無くても落ちない')

  const qp = qrSheetPairs([
    { en_norm: 'we need it', en: 'We need it.', ja: 'それが要ります。' },
    { en_norm: '', en: '', ja: '英語が無いので落ちる' },
  ])
  ok(qp.length === 1 && qp[0].ja === 'それが要ります。' && qp[0].en === 'We need it.',
    '紙 … Quick Response も、左が日本語・右が英語')

  /* ── 副題(何を刷ったのかが、紙だけ見て分かる)── */
  ok(sheetNote({ count: 12, unit: '語' }) === '全 12 語',
    '紙 … 絞っていなければ、数だけ')
  const note = sheetNote({ count: 3, unit: '語', group: '覚えかけ', narrowed: 2, date: '2026-09-12' })
  ok(note.includes('全 3 語') && note.includes('覚えかけ')
    && note.includes('絞り込み 2 件') && note.includes('2026-09-12'),
    '紙 … 絞っているときは、そう書く(黙って絞らない)')
  ok(!sheetNote({ count: 1, unit: '問', narrowed: 0 }).includes('絞り込み'),
    '紙 … 絞っていないのに「絞り込み」と書かない')

  /* ── 出す場所の id は1か所 ── */
  ok(/id=\{SHEET_ID\}/.test(readS('src/components/ReviewSheet.jsx')),
    '紙 … 部品は `SHEET_ID` を使っている(id を書き写していない)')
  ok(!/id="review-sheet"/.test(noCS(readS('src/components/Wordbook.jsx')))
    && !/id="review-sheet"/.test(noCS(readS('src/components/QrReview.jsx'))),
    '紙 … 画面の中に id を書き写していない')

  /* ── 見た目を書き写していないか ──
     **教材の紙とまったく同じ指定に乗る**のがこの回の肝である。
     `.qrsheet-*` を使わずに独自の入れ物を作ると、
     片方を直したときに、もう片方だけ古くなる */
  const sheet = readS('src/components/ReviewSheet.jsx')
  ok(/className="qrsheet-list"/.test(sheet)
    && /className="qrsheet-ja"/.test(sheet)
    && /className="qrsheet-en"/.test(sheet),
    '紙 … 教材の紙の Quick Response と同じ指定に乗っている')
  /* **`lang="en"` は語そのものに付ける。** 囲みに付けると、
     すぐ隣の品詞(日本語)まで英語の字づかい(12.5pt)で刷られる */
  ok(/className="qrsheet-word" lang="en"/.test(sheet),
    '紙 … 英語そのものに `lang="en"` を付けている')
  ok(!/className="qrsheet-en" lang="en"/.test(sheet),
    '紙 … 囲みには `lang="en"` を付けない(品詞まで英語の字になる)')
  /* **無い札は出さない。** 空の札を並べると、紙に意味のない点が増える */
  ok(/\(p\.pos \|\| p\.level\) && \(/.test(noCS(sheet)),
    '紙 … 品詞もレベルも無い語には、札そのものを出さない')

  /* ── どのページの下にも題を出す(`--sheet-name`)──
     ページの下の文字は `@page` の余白の箱が描くので **DOM に無い。**
     渡す道はカスタムプロパティしかない。
     **紙をやめたら必ず外す** —— 外さないと、そのあと教材を刷ったときに
     単語帳の題が下に出たままになる */
  const sheetC = noCS(sheet)
  ok(/setProperty\('--sheet-name', cssString\(title\)\)/.test(sheetC),
    '紙 … 題を `<html>` に置く(どのページの下にも出すため)')
  ok(/removeProperty\('--sheet-name'\)/.test(sheetC),
    '紙 … 紙をやめたら、題を外す(教材の紙に残さない)')
  ok(/useLayoutEffect\(/.test(sheetC),
    '紙 … 描き終わる前に置く(`window.print()` に間に合わせる)')

  /* ── 画面が本当に呼んでいるか ──
     **「名前が出てくるか」で見ない**(CLAUDE.md)。
     説明の中にも同じ言葉があるので、**使っている形**で見る */
  const wbS = noCS(readS('src/components/Wordbook.jsx'))
  /* **`shownRows` であることだけを見る**(例文をつけるかは別の話・
     2026-09 に足した第2引数まで書き写すと、そこを直すたびにここが赤くなる) */
  ok(/=\s*wordSheetPairs\(shownRows[,)]/.test(wbS),
    '紙 … 単語帳は、いま画面に出ている一覧をそのまま刷る')
  ok(/usePrintSheet\(printing,/.test(wbS),
    '紙 … 単語帳は、描き終わってから刷る(`usePrintSheet`)')
  ok(/\{printing && \(\s*<ReviewSheet/.test(wbS),
    '紙 … 単語帳は、刷る一瞬だけ中身を描く')
  ok(/setPrinting\(true\)/.test(wbS), '紙 … 単語帳に、刷るボタンがある')
  /* **題の組み立ては1か所。** 画面の中で `book === 'shelf'` と書くと、
     冊を足すたびに食い違う(`remakeModeOf()` と同じ考え方) */
  ok(/title=\{sheetTitle\(\{/.test(wbS),
    '紙 … 単語帳は、題を `sheetTitle()` に組ませる')
  ok(!/title=\{learnerName \?/.test(wbS),
    '紙 … 画面の中で題を組み立てていない')

  /* ── ページ数(`@page` の余白の箱)──
     **`@page` を分けて書く。** `size` / `margin` と同じ規則に混ぜると、
     余白の箱を読めないブラウザで**用紙の大きさごと落ちる**恐れがある。
     実測(Chromium・A4・200 行): `1 / 6` 〜 `6 / 6` が右下に出た */
  const css = noCS(readS('src/styles.css'))
  ok(/@bottom-right\s*\{[^}]*counter\(page\)[^}]*counter\(pages\)/.test(css),
    '紙 … ページ数を余白の箱に出す(`counter(page) / counter(pages)`)')
  ok(/@bottom-left\s*\{[^}]*var\(--sheet-name, ""\)/.test(css),
    '紙 … どのページの下にも題を出す(控えは空の文字列)')
  ok(/@page \{ size: A4;[^}]*\}/.test(css),
    '紙 … 用紙の大きさは、余白の箱とは別の `@page` に書く')

  const qrS = noCS(readS('src/components/QrReview.jsx'))
  ok(/=\s*qrSheetPairs\(filtered\)/.test(qrS),
    '紙 … Quick Response 帳は、段と絞り込みを当てたものを刷る')
  ok(/usePrintSheet\(printing,/.test(qrS),
    '紙 … Quick Response 帳も、描き終わってから刷る')
  ok(/\{printing && \(\s*<ReviewSheet/.test(qrS),
    '紙 … Quick Response 帳も、刷る一瞬だけ中身を描く')
  ok(/setPrinting\(true\)/.test(qrS), '紙 … Quick Response 帳に、刷るボタンがある')

  /* ── 印の付け方を2通り持っていないか ──
     `markPrint()` を切り出したのは、検証が**同じ道**を通れるようにするため。
     `printElement()` が自分でも印を付け直していたら、そこで食い違う */
  const pr = noCS(readS('src/lib/print.js'))
  ok(/export function markPrint\(/.test(pr) && /export function printElement\(/.test(pr),
    '紙 … 印を付けるところが切り出してある')
  ok(/const undo = markPrint\(element, opts\)/.test(pr),
    '紙 … `printElement()` は `markPrint()` を通る(印の付け方は1か所)')
  ok((pr.match(/classList\.add\('print-path'\)/g) ?? []).length === 1,
    '紙 … `print-path` を付けているところは1か所だけ')
}

/* ────────────────────────────────────────────────────────────
   業種べつの単語帳(棚・0057・2026-09 利用者の指定)

     > 何冊も違う単語帳を持てるようにしてほしいんです。基本は自分の単語帳、
     > Quick Response が表示され、他の独立した業種や趣味別の単語帳とは
     > そもそも混ざらないようにしたいんです。
     > …そして、ゲストにはトレーナーが指定した単語帳のみが追加されるのです。

     > 単語帳は業種ごと、出し方の中に場面やシチュエーションで絞り込み

   ここで見るのは**算段**である —— 棚の一覧・棚の当て方・名前の作り方・
   出し分け・**画面が本当に呼んでいるか**・貼る SQL がそろっているか。
   **描いて測るほうは `npm run test:bar`。** 役目が違う。
   ──────────────────────────────────────────────────────────── */
{
  const readS = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')
  const noCS = (t) => t.replace(/\/\*[\s\S]*?\*\/|\{\/\*[\s\S]*?\*\/\}/g, '')

  /* ── 棚の一覧は、`industries.js` の親そのもの ──
     **別の一覧を作らない。** 分野を足せば棚もひとりでに1冊増える */
  const list = shelfList()
  const parents = INDUSTRIES.filter((i) => !i.parent)
  ok(list.length === parents.length,
    `棚 … 冊の数は親の分野と同じ(${list.length} 冊)`)
  ok(list.every((s) => parents.some((p) => p.id === s.id)),
    '棚 … 一覧を別に持っていない(親の分野そのもの)')
  ok(list.some((s) => s.group === 'work') && list.some((s) => s.group === 'hobby'),
    '棚 … お仕事と趣味・娯楽の両方がある')

  /* ── 種類は、親の棚に落ちる ──
     利用者の「カテゴリーがかぶるものであれば既存のものに追加」が、
     `parentOf()` 1つでそのまま満たされる */
  ok(shelfOf('medical') === 'med',
    '棚 … 種類(医療・介護)は、親(医療)の棚に入る')
  ok(shelfOf('it') === 'it', '棚 … 種類を持たない分野は、自分の棚に入る')
  ok(shelfOf(null) === null && shelfOf('そんな分野') === null,
    '棚 … 知らない分野は、当てずっぽうで棚に入れない')
  ok(!isShelf('medical') && isShelf('med'),
    '棚 … 種類そのものは棚を持たない(冊が二重にならない)')

  /* ── 場面べつは、やめた ──(2026-09 利用者の指定)
       > 場面別はやめましょう。細かすぎる。35冊、これだけにしましょう。

     場面は**窓口へ渡す手がかり**として残る。**区切りではない** */
  ok(shelfScenes('it').length > 0, '棚 … その棚の場面が引ける')
  ok(shelfScenes('med').length >= shelfScenes('medical').length,
    '棚 … 親の棚では、種類ぜんぶの場面が集まる')
  ok(shelfScenes('そんな分野').length === 0, '棚 … 知らない棚の場面は空')
  const hints = shelfSceneNames('energy')
  ok(hints.length > 0 && hints.length <= SCENE_HINT_MAX
    && hints.every((s) => typeof s === 'string' && s),
    '棚 … 窓口へ渡す場面は、名前だけ・上限つき')

  /* **どの冊も同じ語数。** 場面の数で変えない ——
     変えると、エネルギー 960 語・ゲーム 168 語のように桁が違うものができる */
  ok(shelfTarget() === WORDS_PER_BOOK, '棚 … 1冊の語数は、どの冊も同じ')
  ok(shelfScenes('energy').length !== shelfScenes('gaming').length,
    '棚 … 場面の数は、冊によってまるで違う(だから語数の根拠にしない)')

  /* ── まとめて作る ──
     **足りないぶんだけ**を、**20 語ずつ**に割る。
     だから何度押しても安全である */
  const empty = shelfTodo('it')
  ok(empty.length === Math.ceil(WORDS_PER_BOOK / WORDS_PER_JOB)
    && empty.reduce((n, j) => n + j.count, 0) === WORDS_PER_BOOK
    && empty.every((j) => j.shelf === 'it' && j.count <= WORDS_PER_JOB),
    '棚 … 空の棚では、1冊ぶんを 20 語ずつに割る')
  ok(empty[0].from === 1 && empty[0].to === WORDS_PER_JOB
    && empty[empty.length - 1].to === WORDS_PER_BOOK,
    '棚 … 何語目から何語目までかを持つ(帯に出す)')
  ok(shelfTodo('it', WORDS_PER_BOOK).length === 0,
    '棚 … そろっていれば、作るものが無い(同じ語を作り直さない)')
  const part = shelfTodo('it', WORDS_PER_BOOK - 5)
  ok(part.length === 1 && part[0].count === 5 && part[0].from === WORDS_PER_BOOK - 4,
    '棚 … 足りないぶんだけ作る(超えて作らない)')
  ok(shelfTodo('it', 999).length === 0, '棚 … 多すぎても、マイナスにならない')
  ok(shelfTodo('そんな棚').length === 0, '棚 … 知らない棚では、作るものが無い')
  ok(JOB_COST.min > 0 && JOB_COST.max > JOB_COST.min,
    '棚 … 1回の見積もりに幅がある(押す前に金額を出すため)')

  /* ── ゲストへの指定の名前 ──
     **新しい表を作らない。** 0055 の `learner_features` に
     `shelf:<分野の id>` で入る。**名前の作り方はここ1か所** */
  ok(shelfFeature('it') === 'shelf:it', '棚 … 名前は `shelf:<分野の id>`')
  ok(shelfFeature('medical') === null,
    '棚 … 棚でないものには、名前を作らない')
  ok(shelfIdOfFeature('shelf:it') === 'it',
    '棚 … 名前から棚を引ける')
  ok(shelfIdOfFeature('basics') === null
    && shelfIdOfFeature('shelf:medical') === null
    && shelfIdOfFeature(null) === null,
    '棚 … 別の名前・棚でないものは `null`')

  /* ── 出し分け ── **誰でも「出された冊だけ」**(0059・方針の変更)

       > その代わり、業種別単語帳のページではトレーナーは
       > 自分自身にアサイン出来るように改良してください。

     もとは「**ゲスト以外にはぜんぶ出す**」だった。利用者が改めたので、
     **役割を見ないこと**そのものを数える —— さもないと、
     どこかに `role === 'learner'` を書き戻しても緑のままになる。 */
  ok(!showsShelf({ role: 'trainer', features: new Set() }, 'it'),
    '棚 … トレーナーにも、出していなければ出さない(0059・方針の変更)')
  ok(!showsShelf({ role: 'owner', features: new Set() }, 'it'),
    '棚 … 管理者にも、出していなければ出さない')
  ok(showsShelf({ role: 'trainer', features: new Set(['shelf:it']) }, 'it'),
    '棚 … トレーナーは、自分に出した冊が開ける')
  ok(!showsShelf({ role: 'learner', features: new Set() }, 'it'),
    '棚 … ゲストには、入れていなければ出さない')
  ok(showsShelf({ role: 'learner', features: new Set(['shelf:it']) }, 'it'),
    '棚 … ゲストには、トレーナーが入れた棚だけ出す')
  /* **役割で分かれていないこと**を、同じ `features` で突き合わせる。
     どちらかだけを見ると、片側に書き戻しても気づけない */
  ok(showsShelf({ role: 'trainer', features: new Set(['shelf:it']) }, 'it')
    === showsShelf({ role: 'learner', features: new Set(['shelf:it']) }, 'it')
    && showsShelf({ role: 'trainer', features: new Set() }, 'it')
    === showsShelf({ role: 'learner', features: new Set() }, 'it'),
    '棚 … 役割では分けない(出すかどうかは `learner_features` だけが決める)')
  ok(!showsShelf({ role: null, features: null }, 'it'),
    '棚 … 読めていないうちは出さない(既定は出さない)')
  ok(!showsShelf({ features: new Set(['shelf:medical']) }, 'medical'),
    '棚 … 棚でないものは、誰にも出さない')
  ok(shelvesFor({ features: new Set(['shelf:it']) }).length === 1,
    '棚 … その人に出す棚だけを並べる(画面で `filter` を書き写さない)')
  ok(shelvesFor({ role: 'trainer', features: new Set() }).length === 0,
    '棚 … トレーナーも、1冊も出していなければ0冊')
  ok(shelvesFor({ role: 'owner', features: new Set() }).length === 0,
    '棚 … 管理者も同じ(指定なしで全冊にしない)')
  ok(shelvesFor({ role: 'learner', features: new Set() }).length === 0,
    '棚 … ゲストは、指定が無ければ0冊')
  ok(list.length > 0
    && shelvesFor({ features: new Set(list.map((s) => `shelf:${s.id}`)) }).length
      === list.length,
    '棚 … ぜんぶ出せば、ぜんぶ並ぶ(絞りすぎていない)')

  /* ── 画面が本当に呼んでいるか ──
     **「名前が出てくるか」で見ない**(CLAUDE.md)。
     説明の中にも同じ言葉があるので、**使っている形**で見る */
  const appS = noCS(readS('src/App.jsx'))
  ok(/shelvesFor\(\{ features \}\)/.test(appS),
    '棚 … `App.jsx` が `shelvesFor()` で出し分けている')
  /* **役割を渡し戻していないか。** 渡すと、判断そのものは1か所のままでも
     「トレーナーだけ別」を書き足す下地に戻る */
  ok(!/shelvesFor\(\{\s*role:/.test(appS),
    '棚 … `App.jsx` は `shelvesFor()` に役割を渡していない(0059)')
  ok(/shelves=\{myShelves\}/.test(appS),
    '棚 … 単語帳に、その人の棚を渡している')
  ok(!/'shelf:'\s*\+/.test(appS), '棚 … 画面で名前を組み立てていない')

  /* ── **独立した単語帳**(0058・2026-09 利用者の指定)──
       > 最終的にこうやって混ぜたくないんですよ。
       > これは独立した単語帳にしたいんです。

     **「出る」と「出ない」の両方を見る** ——
     混ぜる道が残っていないことも、必ず数える */
  const wbS = noCS(readS('src/components/Wordbook.jsx'))
  ok(/<ShelfBooks\s+shelves=\{shelves\}/.test(wbS),
    '棚 … 単語帳が `ShelfBooks`(チェックの欄)を描いている')
  ok(/await setShelfWordStatus\(row\.shelf, row\.word_norm, status/.test(wbS),
    '棚 … 答えは棚の側(`shelf_reviews`)に書き戻す')
  ok(/loadShelfWordbook\(\{ learnerId, shelves: shelfPick \}\)/.test(wbS),
    '棚 … チェックを入れた分野の語だけを読む')
  ok(!/addShelfWords/.test(wbS) && !/ShelfPick from/.test(wbS),
    '棚 … 自分の単語帳へ混ぜる道は、道具ごと消してある')
  ok(!existsSync(new URL('../src/components/ShelfPick.jsx', import.meta.url)),
    '棚 … `ShelfPick.jsx` はファイルごと消してある(値を偽にして残さない)')
  ok(!/export async function addShelfWords/.test(readS('src/lib/shelfWords.js')),
    '棚 … `addShelfWords()` も消してある')

  const pickS = noCS(readS('src/components/ShelfBooks.jsx'))
  ok(/if \(!shelves\.length\) return null/.test(pickS),
    '棚 … 出す棚が無ければ、欄ごと出さない')
  /* **2026-09 にチェックの一覧からプルダウンへ改めた**(利用者の指定)。
       > こんなに沢山のチェックリストは必要ありません。アサインされた
       > 業種のものだけがプルダウンで表示されれば十分です。
     **「プルダウンか」だけを見ない** —— チェックが残っていないことも数える */
  ok(/<select /.test(pickS) && /<optgroup /.test(pickS),
    '棚 … 分野はプルダウンで選ぶ(お仕事 / 趣味に分ける)')
  ok(!/type="checkbox"/.test(pickS),
    '棚 … 35個のチェックは、道具ごと消してある(値を偽にして残さない)')
  ok(/<option value="">/.test(pickS),
    '棚 … 「分野をえらぶ」に戻せる(**行き止まりを作らない**)')
  ok(!/loadShelfWords|loadShelfCounts|supabase/.test(pickS),
    '棚 … `ShelfBooks` は自分では読まない(props で受け取る部品)')

  /* ══════════════════════════════════════════════════════════
     **棚の語数を、`counts[id]` と書かない**(2026-09 実機)

       > なぜ０語になっているのですか？

     `loadShelfCounts()` が返すのは **`Map`** なのに、`ShelfBooks` が
     `counts[s.id]` と**オブジェクトのつもりで**読んでいた。
     Map をそう読むと**必ず `undefined`** で、`?? 0` に落ちて
     **35 冊ぜんぶが「0 語」**になる。
     CLAUDE.md の「`wordStatuses` は Map である」と**まったく同じ穴**。

     **「気をつける」では二度目を防げない。** 読む側が形を知らなくて
     よいように、`shelfCountOf()` 1か所を通す ── そのうえで
     **オブジェクトの読み方が戻っていないか**を、ここで数える */
  ok(shelfCountOf(new Map([['it', 7]]), 'it') === 7,
    '棚 … `Map` で数えられる')
  ok(shelfCountOf({ it: 7 }, 'it') === 7,
    '棚 … 素のオブジェクトでも数えられる(読む側は形を知らなくてよい)')
  ok(shelfCountOf(new Map([['it', 7]]), 'biz') === 0,
    '棚 … 数えた結果その棚が無ければ 0 語')
  ok(shelfCountOf(null, 'it') === null && shelfCountOf(undefined, 'it') === null,
    '棚 … **数えられなかったら `null`**(0 と取り違えて嘘をつかない)')
  ok(/shelfCountOf\(counts, s\.id\)/.test(pickS),
    '棚 … `ShelfBooks` は `shelfCountOf()` を通す')
  ok(!/counts\[/.test(pickS),
    '棚 … `counts[...]`(オブジェクトの読み方)が残っていない')
  ok(/shelfCountOf\(counts, s\.id\)/.test(noCS(readS('src/components/ShelfBuilder.jsx'))),
    '棚 … 棚を作る画面も、同じ `shelfCountOf()` を通す(数え方を2通り持たない)')
  ok(/n === null \? '' :/.test(pickS),
    '棚 … 数えていないときは、語数そのものを出さない')

  /* ══════════════════════════════════════════════════════════
     **「聞き流す」と「印刷 / PDF」を、すき間ゼロでくっつけない**
     (2026-09 実機・利用者の指摘)

       > 「聞き流す」と「印刷・PDF」ボタンの間に隙間がありません。
       > これは PC での表示ですが、すべてのデバイスでこれが
       > 起こらないように徹底してください。

     **描いて測るのは `npm run test:bar`**(横に並ぶ組も見るようにした)。
     ところが**あちらが測れるのは単語帳だけ** —— `?screen=qrrev` は
     `QrCard` 1枚しか描かないので、**Quick Response 側は
     描いて測れない。** だから**書いてある形**で見る。

     **`margin` で離さない。`gap` で離す**(`.claude/rules/common.md`)——
     余白は縦にしか効かないので、横に並べると 0px になる。 */
  for (const [f, s] of [
    ['Wordbook.jsx', noCS(readS('src/components/Wordbook.jsx'))],
    ['QrReview.jsx', noCS(readS('src/components/QrReview.jsx'))],
  ]) {
    const 行 = /<div className="wb-tools">([\s\S]*?)<\/div>/.exec(s)?.[1] ?? ''
    ok((行.match(/wb-listen/g) ?? []).length === 2,
      `すき間 … ${f} は「聞き流す」と「印刷 / PDF」を1つの行にまとめている`)
  }
  {
    /* **コメントを落としてから読む。** 落とさないと、すぐ上の説明に書いた
       「もとは `.wb-listen { margin-top: 10px }` だった」に当たって
       **直してあるのに赤くなる**(実際にそうなった) */
    const css = noCS(readS('src/styles.css'))
    ok(/\.wb-tools \{[^}]*gap:/.test(css),
      'すき間 … `.wb-tools` は `gap` で離す(`margin` は横に効かない)')
    /* **値そのものを読む。** `(?!0)` のような書き方は `[^}]*` が
       後戻りして**いつでも当たる** —— 実際、いちど素通りした */
    const 余白 = /margin-top:\s*([^;]+)/
      .exec(/\.wb-listen \{([^}]*)\}/.exec(css)?.[1] ?? '')?.[1]?.trim()
    ok(!余白 || /^0(px)?$/.test(余白),
      'すき間 … `.wb-listen` は自分で余白を持たない(離すのは親の役目)',
      余白 ?? '(持っていない)')
  }
  /* **骨組みが本物と食い違うと、検証は何も守らない**(CLAUDE.md)。
     ここが `Object.fromEntries(...)` だったので、画面が Map を
     オブジェクトで読んでいても**骨組みでは正しく数が出ていた** */
  ok(/counts=\{new Map\(/.test(noCS(readS('src/__screens.jsx'))),
    '棚 … 骨組みも本物と同じ `Map` を渡す')
  /* **数える側も、1回の問い合わせで数え切らない。**
     PostgREST は1回に返す行数に上限を持つ(既定 1,000)。
     35 冊 × 200 語 = 7,000 行なので、`.range()` を付けずに読むと
     **後ろの棚がまるごと 0 語**になる ——
     利用者が見たのと**同じ見え方をする、別の原因**である */
  {
    const sw = noCS(readS('src/lib/shelfWords.js'))
    const 数える = /export async function loadShelfCounts\(\)[\s\S]*?\n\}/.exec(sw)?.[0] ?? ''
    ok(/\.range\(/.test(数える),
      '棚 … 語数は、終わりまで読む(1回の上限で切られない)')
    ok(/\.order\(/.test(数える),
      '棚 … 並び順を決めて読む(ページのあいだで抜け・重なりを作らない)')
  }
  /* 「数えていない」と「数えたら 0 だった」を、入れ物で見分ける */
  ok(/useState\(null\)\s*$/m.test(wbS.split('shelfCounts')[1]?.slice(0, 40) ?? '')
    || /const \[shelfCounts, setShelfCounts\] = useState\(null\)/.test(wbS),
    '棚 … 単語帳の控えの初めの値は `null`(`{}` にしない)')
  /* **1冊だけの人には、開いてある**(選択肢が1つのプルダウンを
     選ばせるのは、押す回数が1つ増えるだけ)。判断は `Wordbook` の1か所 */
  ok(/if \(!next\.length && shelves\.length === 1\) next = \[shelves\[0\]\.id\]/.test(wbS),
    '棚 … 出せる冊が1つしかなければ、それを開く')

  /* ── チェックの控え ── */
  ok(pickedShelves(['it', 'nope', 'it'], list).join() === 'it',
    '棚 … 出せない棚と重なりは落とす(見えていない冊の語を混ぜない)')
  ok(pickedShelves(null, list).length === 0, '棚 … 壊れた控えでも落ちない')
  ok(SHELF_PICK_KEY === 'eas.shelfPick', '棚 … 鍵の名前は `shelves.js` 1か所')

  /* ── 棚を作る画面 ──
     **場面べつをやめた。** 1冊ぶんをまとめて作る道と、止まる条件を見る */
  const buildS = noCS(readS('src/components/ShelfBuilder.jsx'))
  ok(/= useMemo\(\(\) => shelfTodo\(shelf, have\)/.test(buildS),
    '棚 … 足りないぶんは `shelfTodo()` が決める(画面で数え直さない)')
  ok(/onClick=\{makeAll\}/.test(buildS)
    && /const makeAll = \(\) => \{ runJobs\(todo\) \}/.test(buildS),
    '棚 … 「ぜんぶ作る」で、1冊ぶんをまとめて作る')
  ok(/onClick=\{makeOne\}/.test(buildS)
    && /const makeOne = \(\) => \{ runJobs\(todo\.slice\(0, 1\)\) \}/.test(buildS),
    '棚 … まず1回ぶんだけ見る道も残してある(同じ `runJobs()` を通る)')
  ok(!/場面\(1つだけ作るとき\)/.test(buildS) && !/setScene\(/.test(buildS),
    '棚 … 場面のプルダウンは、道具ごと消してある(場面べつはやめた)')
  ok(/if \(stop\.current\) break/.test(buildS)
    && /onClick=\{\(\) => \{ stop\.current = true \}\}/.test(buildS),
    '棚 … 止まる条件を持たせてある(「やめる」で次の回へ進まない)')
  ok(/\{run\.at \+ 1\} \/ \{run\.total\} 回/.test(buildS)
    && /\{run\.from\}〜\{run\.to\} 語目/.test(buildS),
    '棚 … あと何回か・何語目かを、走っているあいだ出す')
  ok(/todo\.length \* JOB_COST\.min/.test(buildS)
    && /\{todoWords\} 語/.test(buildS),
    '棚 … 押す前に、語数と金額を出す(見えない費用は管理できない)')
  ok(/この単語帳に入れる/.test(buildS) && /setDraft\(\[\.\.\.made\]\)/.test(buildS),
    '棚 … まとめて作っても、入れる前に必ず目を通す')
  ok(/scenes = shelfSceneNames\(shelf\)/.test(buildS)
    && /\n\s+scenes,\n/.test(buildS),
    '棚 … 場面は、偏らせないための手がかりとしてまとめて渡す')

  const trS = noCS(readS('src/components/TrainerLearners.jsx'))
  /* **第5.181節で、どれが出ているかの判断は `assignBooks.js` へ移した。**
     名前を作るところ(`shelfFeature`)は、どちらにしても通る */
  ok(/shelfFeature\(shelf\.id\)/.test(trS),
    '棚 … ゲストへの指定も `shelfFeature()` を通る')
  ok(!/'shelf:'\s*\+/.test(trS), '棚 … トレーナーの画面でも名前を組み立てていない')

  /* ── 窓口(0057 の `mode`)── */
  const fn = readS('supabase/functions/generate-material/index.ts')
  ok(/mode === 'shelf_words'/.test(fn),
    '棚 … 窓口が `mode: shelf_words` を受け取っている')
  ok(/name: 'emit_shelf_words'/.test(fn) && /strict: true/.test(fn),
    '棚 … 形は道具(`strict: true`)が保証している')
  /* **場面べつはやめた。** 窓口は場面が無くても作れる ——
     残っていると、いまの画面からは1回も呼べなくなる */
  ok(/const scenes = \(Array\.isArray\(body\.scenes\)/.test(fn)
    && !/if \(!industry \|\| !scene\)/.test(fn),
    '棚 … 窓口は場面を要求しない(手がかりとしてまとめて受け取る)')
  const matS = noCS(readS('src/lib/materials.js'))
  ok(/mode: 'shelf_words'/.test(matS),
    '棚 … 画面から `mode: shelf_words` を渡している')
  /* **古い窓口の断りを、そのまま出さない**(誤診させない・CLAUDE.md) */
  ok(/業種と場面が要ります/.test(matS),
    '棚 … 古い窓口の断りを「窓口が古い」と読み替える')
  ok(/NEED_GEN_REV = '2026-09-13b'/.test(matS)
    && /const FN_REV = '2026-09-13b'/.test(fn),
    '棚 … 窓口の版が、画面と窓口でそろっている')

  /* ── **レベル**(2026-09 利用者の指定)──────────────────────
       > ３５冊にした単語帳、それぞれレベルを指定して学べるようにしたい。
       > Basic / A1 / A2 / B1 / B2 / C1 / C2 / Proficiency
       > カッコでGSEスコアも添えて / レベルは絞り込みで指定できればOK  */
  ok(SHELF_LEVELS.join(' ')
     === 'Basic A1 A2 B1 B2 C1 C2 Proficiency',
    '棚 … 段は利用者が挙げた8つ、やさしい順',
    SHELF_LEVELS.join(' '))
  /* **別の表を作らない。** 8つはどれも `CEFR_LEVELS` の id なので、
     名前も GSE も `cefrOption()` がそのまま出せる */
  {
    const lost = SHELF_LEVELS.filter(
      (id) => !CEFR_LEVELS.some((l) => l.id === id && l.gse))
    ok(lost.length === 0,
      '棚 … 段はどれも `CEFR_LEVELS` にあり、GSE を持っている', lost.join(' / '))
    const noGse = SHELF_LEVELS.filter((id) => !/\(GSE /.test(cefrOption(id)))
    ok(noGse.length === 0,
      '棚 … 選択肢には GSE が添う(例 ' + cefrOption('A1') + ')', noGse.join(' / '))
  }
  /* **窓口にも同じ8つがある**(窓口からは `src/` を読めない)。
     **足すまで赤いまま**なので、必ず1回は自分の目で数えることになる */
  {
    const m = fn.match(/enum: \[([^\]]*)\],\n\s*\},\n\s*ex_en/)
    const got = m ? [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]) : []
    ok(got.join(' ') === SHELF_LEVELS.join(' '),
      '棚 … 窓口の段の一覧が、画面と1つも食い違っていない', got.join(' '))
  }
  /* **1つの段を指定しない。** 20 語がそこに寄り、散らす指示と打ち消し合う */
  ok(!/ゲストのレベルの目安/.test(noCS(fn)) && !/level: String\(job\?\.level/.test(matS),
    '棚 … レベルは渡さない(絞り込みで選ぶものになった)')
  ok(/散らす/.test(fn),
    '棚 … 窓口に「段を散らす」を書いてある')
  /* **段の散らばりを、作る場所で見せる。** 偏っても
     ゲストの画面には何も出ない(選べるものが1つの欄は出ない) */
  ok(levelTally([{ level: 'B1' }, { level: 'A2' }, { level: 'B1' }, {}])
       .map((l) => `${l.id}${l.count}`).join(' ') === 'A21 B12',
    '棚 … 段ごとの語数は、やさしい順に数える')
  ok(levelTally([{ level: 'ZZ' }, { level: 'B1' }])[1]?.id === 'ZZ',
    '棚 … 知らない段は、いちばん後ろへ回す(真ん中に混ぜない)')
  ok(/levelTally\(rows\)/.test(buildS),
    '棚 … 作る画面が、段ごとの語数を出している')
  /* **絞り込みの名前は `cefrOption`。** `cefrLabel` だと GSE が付かない */
  {
    const wf = noCS(readS('src/lib/wordbookFilter.js'))
    ok(/label: cefrOption\(row\.material_level\)/.test(wf),
      '棚 … レベルの選択肢に GSE を添える(`cefrOption`)')
  }

  /* ── 貼る SQL がそろっているか ──
     **移行を足したら3つとも直す**(CLAUDE.md) */
  const mig = readS('supabase/migrations/0057_shelf_words.sql')
  ok(/create table if not exists public\.shelf_words/.test(mig),
    '棚 … 0057 が表を作る')
  ok(!/industry\s+text\s+not null\s+check/.test(mig),
    '棚 … `industry` に check を置いていない(分野を足すたびに貼り直さない)')
  ok(!/create table[\s\S]*learner_shelves/.test(mig),
    '棚 … ゲストへの指定に、新しい表を作っていない(0055 を使う)')
  const matome = readS('supabase/apply/pending_matome.sql')
  ok(/create table if not exists public\.shelf_words/.test(matome),
    '棚 … まとめた1つに 0057 が入っている')
  const check = readS('supabase/apply/check.sql')
  ok(/shelf_words/.test(check), '棚 … `check.sql` に 0057 の行がある')
  ok(/create table if not exists public\.shelf_reviews/.test(matome),
    '棚 … まとめた1つに 0058(独立した単語帳)が入っている')
  ok(/drop function if exists public\.add_shelf_words/.test(matome),
    '棚 … まとめた1つが、混ぜる関数を落としている')
  ok(/shelf_reviews/.test(check), '棚 … `check.sql` に 0058 の行がある')
  /* **「画面の印が 0058 を見ている」は、ここに書かない。**
     移行を1つ足すたびに**この行だけが古くなる**(実際、0059 で赤くなった)。
     印がいちばん新しい移行にそろっているかは、
     **`supabase/migrations/` を読む ⑫ が数えている** ——
     あちらは番号を書き写していないので、足しても古びない。
     **同じことを2か所で数えない**(CLAUDE.md) */
}

/* ══════════════════════════════════════════════════════════════════════
 * 単語帳をゲストに出す道(①)と、音声のダウンロード(②)
 *
 *   > ①業種別の単語帳を指定したゲストに、トレーナーアカウントの
 *   > 業種別単語帳から、もしくはトレーナーアカウント内のゲストのページから
 *   > アサインする方法を実装してください。
 *   > ②各ゲストのアカウント内でも教材の音声がダウンロードできるように
 *   > してください。(2026-09 利用者の指定)
 *
 * どちらも**すでにある道に乗せただけ**なので、危ないのは
 * 「**画面が本当に呼んでいるか**」と「**文言が1か所か**」である。
 * 定義だけあって誰も呼ばなければ、画面は普通に出るので気づけない。
 * ══════════════════════════════════════════════════════════════════════ */
{
  const readS = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')
  const noCS = (t) => t.replace(/\/\*[\s\S]*?\*\/|\{\/\*[\s\S]*?\*\/\}/g, '')

  /* ── ① 業種べつの単語帳を、その画面からゲストに出す ── */
  const build = noCS(readS('src/components/ShelfBuilder.jsx'))
  const feats = noCS(readS('src/lib/learnerFeatures.js'))

  ok(/loadFeatureLearners\(shelfFeature\(shelf\)\)/.test(build),
    '単語帳を出す … 作る画面が、いま誰に出しているかを引いている')
  ok(/await setLearnerFeature\(who\.id, feat, next/.test(build),
    '単語帳を出す … 作る画面が、出す / 出さないを決められる')

  /* ── **自分自身にも出せる**(0059・2026-09 利用者の指定)──

       > その代わり、業種別単語帳のページではトレーナーは
       > 自分自身にアサイン出来るように改良してください。

     **「自分が並ぶか」だけを見ない** —— 並べただけで
     ①窓口に自分と伝えていない ②出したあと読み直させていない
     のどれでも、**画面は普通に出るので気づけない。** */
  ok(/\{ id: me\.id, display_name: '自分', self: true \}/.test(build),
    '自分に出す … 出す相手の先頭に自分が並ぶ(`loadMyLearners()` に自分は入らない)')
  ok(/setLearnerFeature\(who\.id, feat, next, \{ self: !!who\.self \}\)/.test(build),
    '自分に出す … 自分のぶんだと窓口に伝える(断り方を読み替えるため)')
  ok(/if \(who\.self\) onSelfChange\?\.\(\)/.test(build),
    '自分に出す … 出したら、その場で読み直させる(次に開くまで増えない、を防ぐ)')
  /* **`App.jsx` が渡しているか。** 受け取る側だけでは何も起きない */
  const app59 = noCS(readS('src/App.jsx'))
  ok(/<ShelfBuilder me=\{profile\} onSelfChange=\{reloadFeatures\} \/>/.test(app59),
    '自分に出す … `App.jsx` が自分と読み直しを渡している')
  ok(/loadLearnerFeatures\(\)\.then\(\(r\) => setFeatures\(r\.data\)/.test(app59),
    '自分に出す … 読み直すと `features` が入れ替わる')
  /* **0059 より前の断りを、そのまま出さない**(CLAUDE.md
     「そのまま出すと誤診させる」)。自分の担当かどうかを疑わせない */
  ok(/このゲストの担当ではありません/.test(feats)
    && /0059/.test(feats),
    '自分に出す … 窓口が古いときは「0059 がまだ」と読み替える')
  /* **貼る SQL がそろっているか。** 移行だけ書いてまとめた1つに足し忘れると、
     利用者が貼っても入らない(CLAUDE.md・いちばん悪い壊れ方) */
  {
    const mig = readS('supabase/migrations/0059_self_features.sql')
    const matome = readS('supabase/apply/pending_matome.sql')
    const check = readS('supabase/apply/check.sql')
    /* **RPC と RLS の両方**を数える。**二重に塞ぐ**のが 0055 からの作法で、
       片方だけ見ていると**もう片方を落としても緑のまま**になる
       (実際に赤チェックで素通りした) */
    ok(/create or replace function public\.can_set_own_features/.test(mig),
      '自分に出す … 0059 が `can_set_own_features()` を作る')
    ok(/p_learner = auth\.uid\(\) and public\.can_set_own_features\(\)/.test(mig),
      '自分に出す … 決める窓口(RPC)の門番に「自分のぶん」がある')
    ok(/learner_id = auth\.uid\(\) and public\.can_set_own_features\(\)/.test(mig),
      '自分に出す … 書き換えのポリシー(RLS)にも、同じ1つがある')
    ok(/create or replace function public\.can_set_own_features/.test(matome),
      '自分に出す … まとめた1つ(pending_matome.sql)にも 0059 が入っている')
    ok(/can_set_own_features/.test(check),
      '自分に出す … 利用者が見る check.sql にも 0059 の行がある')
  }
  /* **名前を組み立てない。** `'shelf:' + id` と書くと、
     `shelfFeature()` を直した日にここだけ古くなる */
  ok(!/['"`]shelf:/.test(build),
    '単語帳を出す … 名前を画面で組み立てていない(`shelfFeature()` 1か所)')
  /* **担当かどうかの判定を、画面にも引く側にも書かない** ——
     誰のぶんが返るかは RLS(0055)が決める */
  ok(/\.eq\('feature', feature\)/.test(feats)
    && !/learner_admins/.test(feats),
    '単語帳を出す … 引くのは `feature` だけ(担当の判定は RLS に任せる)')
  /* **0055 を貼る前は、押せないことを言う**(黙って効かないようにしない) */
  ok(/learnerFeaturesSupported\(\)/.test(build),
    '単語帳を出す … 0055 を貼る前は、そう言う')
  /* **ゲストのページからの道も、消していない**(2つとも要る) */
  const tl = noCS(readS('src/components/TrainerLearners.jsx'))
  /* **押せる形で数える。** `shelfFeature(s.id)` だけだと、
     一覧を作る `useMemo` にも当たって**欄を消しても緑**になる。

     **2026-09 に `ShelfAssign` へ切り出した** —— あの欄は
     `TrainerLearners.jsx` の中にあり、この画面は Supabase を
     引き連れているので**骨組みでは1ドットも描けなかった**
     (**描けないものは測れない**)。そのあいだに
     「押した結果がどこにも出ない」形が入り込んだ(実機で指摘された)。 */
  ok(/<AssignShelf\s/.test(tl),
    '単語帳を出す … ゲストのページからの道も残っている')
  ok(/onShelf=\{\(sh\) => pickShelf\(l, sh\)\}/.test(tl),
    '単語帳を出す … えらんだ棚が、ちゃんと渡っている')
  /* **押した結果は、押した場所に出す**(CLAUDE.md)。
     画面のいちばん上(`message` / `error`)に出していたので、
     単語帳のタブまで送った人には**1文字も見えなかった** */
  ok(/note=\{wordNote\}/.test(tl),
    '単語帳を出す … 結果を、その欄に出している')
  ok(/\{ quiet: true \}/.test(tl),
    '単語帳を出す … 上の帯には同じ知らせを出していない')
  /* **置き場所は「単語帳」のタブ**(2026-09 利用者の指定)。

       > ゲストへの単語帳のアサインは、レベルとスコアからではなく、
       > ゲストの単語帳からできるようにしてください。

     **「ファイルの中に在るか」では足りない** —— それだと
     「レベルとスコア」へ戻しても緑のままになる。
     **タブとタブのあいだ**にいることまで見る */
  {
    const wb = tl.indexOf("detailTab === 'wordbook'")
    const qr = tl.indexOf("detailTab === 'qr'")
    const rec = tl.indexOf("detailTab === 'record'")
    /* **目印は `<AssignShelf`。** 題そのものは部品の中へ移った */
    const at = tl.indexOf('<AssignShelf')
    ok(wb > 0 && qr > wb && at > wb && at < qr,
      '単語帳を出す … 出す欄が「単語帳」のタブの中にある')
    ok(rec > 0 && !(at > rec),
      '単語帳を出す … 「レベルとスコア」には戻していない')
  }

  /* ── ② 教材の音声を、ゲストの画面からも落とせる ── */
  const hw = noCS(readS('src/components/LearnerHomework.jsx'))
  const tm = noCS(readS('src/components/TrainerMaterials.jsx'))

  for (const [name, src] of [['今週の宿題', hw], ['教材', tm]]) {
    ok(/=\s*useAudioDownload\(\)/.test(src),
      `音声を落とす … ${name}が \`useAudioDownload()\` を使っている`)
    ok(/<AudioDownloadNote\s/.test(src),
      `音声を落とす … ${name}が知らせを \`AudioDownloadNote\` に任せている`)
    /* **文言を書き写さない。** 片方だけ古くなる */
    ok(!/1つにまとめました/.test(src),
      `音声を落とす … ${name}が知らせの文を自分で持っていない`)
    /* **本文がある教材だけに出す**(効かない操作を見せない) */
    ok(/dlPieces\((m|a\.material)\) > 0/.test(src),
      `音声を落とす … ${name}が、本文のある教材にだけ出している`)
  }
  /* **窓口を呼ばない = 0円。** ゲストが押しても課金されない */
  const dl = noCS(readS('src/lib/useAudioDownload.js'))
  ok(!/askForClip|speak/.test(dl),
    '音声を落とす … 集めるだけで、窓口を呼んでいない(0円)')
  /* **足りないときの逃げ道は、画面によって違う** ——
     「読み上げ音声を作り直す」はトレーナーの画面にしかない */
  const note = noCS(readS('src/components/AudioDownloadNote.jsx'))
  ok(/trainer/.test(note) && /読み上げ音声を作り直す/.test(note),
    '音声を落とす … 足りないときの逃げ道を、画面ごとに書き分けている')
  ok(/<AudioDownloadNote done=\{dlDone\} materialId=\{m\.id\} trainer \/>/.test(tm),
    '音声を落とす … トレーナーの画面だけが、作り直しの逃げ道を出す')
  ok(!/trainer/.test(hw.match(/<AudioDownloadNote[^/]*\/>/)?.[0] ?? ''),
    '音声を落とす … ゲストには、そこに無いボタンを案内しない')
}

/* ─────────────────────────────────────────────────────────────
   説明の文を、既定では出さない(2026-09 利用者の指定)

     > 全てのデザインから言葉による説明を省いてください。
     > 目指すのは説明がない、直感的なUIです。
     > ここでは「上の「学ぶ分野をえらぶ」で、練習したい分野にチェックを
     > 入れてください。」などです。

   **消したのではない。畳んである。**「いつでも戻せるように」と
   同じ作法なので、見るのは3つ ——
   ①既定で閉じているか ②道が残っているか
   ③**画面が判断を自分で持っていないか。**

   あわせて、**残すと決めたもの**に印が付いていないことも数える。
   どれもこのリポジトリに先に書いてある決まりである(費用・取り消せない・
   0件の知らせ・黙って消さない・教材の中身)。
   **「畳んだか」だけを見ると、知らせまで畳んでも緑のまま**になる。
   ───────────────────────────────────────────────────────────── */
{
  const readS = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')
  const noCS = (t) => t.replace(/\/\*[\s\S]*?\*\/|\{\/\*[\s\S]*?\*\/\}/g, '')
  const tips = noCS(readS('src/lib/tips.js'))

  /* ① 既定は「出さない」 */
  ok(/return 'off'/.test(tips) && /:\s*'off'/.test(tips),
    '説明の文 … 読めないときも、既定は「出さない」')
  ok(/TIPS\s*=\s*\[[\s\S]*id:\s*'off'[\s\S]*id:\s*'on'[\s\S]*\]/.test(tips),
    '説明の文 … 出す / 出さないの2つだけ')

  /* ② 道が残っている(消して作り直さない) */
  ok(/data-tips/.test(tips) && /export function applyTips/.test(tips),
    '説明の文 … 戻す道(`data-tips`)が残っている')

  /* ③ 判断は1か所。**画面の中で `data-tips` と書かない** */
  {
    const wrote = []
    for (const f of readdirSync('src/components')) {
      if (!f.endsWith('.jsx')) continue
      if (/data-tips|loadTips|applyTips/.test(noCS(readS(`src/components/${f}`)))) wrote.push(f)
    }
    ok(wrote.length === 0,
      `説明の文 … 画面が判断を自分で持っていない${wrote.length ? `(${wrote.join(' / ')})` : ''}`)
  }
  const app = noCS(readS('src/App.jsx'))
  ok(/=\s*useState\(loadTips\)/.test(app) && /applyTips\(tips\)/.test(app),
    '説明の文 … App.jsx が本当に呼んでいる')
  /* 2026-09 に「設定」へまとめたので、置き場所は `NavSettings.jsx`。
     **App.jsx が値を渡していること**も一緒に見る ——
     片方だけでは、渡さないまま欄だけ出す形に書き換えても緑になる */
  ok(/<Pick label="説明の文" options=\{TIPS\}/.test(noCS(readS('src/components/NavSettings.jsx')))
    && /tips=\{tips\} onTips=\{setTips\}/.test(app),
  '説明の文 … 左のメニューの下から切り替えられる')

  /* 畳む決まりは styles.css の1行だけ。**部品ごとに書いて回らない** */
  const css = readS('src/styles.css')
  const hide = css.match(/^:root:not\(\[data-tips="on"\]\) \.tip \{[^}]*\}/m)
  ok(!!hide && /display:\s*none\s*!important/.test(hide[0]),
    '説明の文 … 畳む決まりは styles.css の1行だけ(必ず勝つ)')
  ok((css.match(/\.tip[\s,{]/g) || []).length <= 2,
    '説明の文 … `.tip` に、部品ごとの上書きを増やしていない')

  /* ④ **残すと決めたものに、印を付けていない。**
        画面の該当行を名指しで数える(文言そのもので探す) */
  const keep = [
    ['MaterialForm.jsx', '出力 {done.spent.output', '費用'],
    ['ShelfBuilder.jsx', 'AI を {todo.length} 回呼ぶので', '費用'],
    ['MaterialDelete.jsx', '{deleteWarning(shared)}', '取り消せない操作'],
    ['TrainerLearners.jsx', '取り消せません。', '取り消せない操作'],
    ['TrainerMaterials.jsx', 'この端末に残っている、この教材の', '取り消せない操作'],
    ['LearnerHomework.jsx', 'まだ宿題は届いていません', '0件の知らせ'],
    ['LearnerHomework.jsx', 'この条件に当てはまる宿題はありません', '絞り込みの知らせ'],
    ['WritingAnswer.jsx', 'そのままトレーナーに届きます', '黙って消さない'],
    ['SpeechBoard.jsx', '書いた原稿はトレーナーに届いています', '黙って消さない'],
    ['MaterialBody.jsx', '{sec.instruction}', '教材の中身'],
    ['MaterialBody.jsx', '{it.note}', '教材の中身'],
    ['WordRadio.jsx', '覚えた・まだ の記録は動きません', '黙って動かさない'],
  ]
  for (const [f, text, why] of keep) {
    const src = readS(`src/components/${f}`)
    const at = src.indexOf(text)
    if (at < 0) { ok(false, `説明の文 … ${f} に「${text}」が見当たらない`); continue }
    /* その行(または直前の開きタグ)に `tip` が付いていないこと */
    const head = src.slice(Math.max(0, src.lastIndexOf('<', at)), at + text.length)
    ok(!/className="[^"]*\btip\b/.test(head),
      `説明の文 … ${why}は畳まない(${f})`)
  }

  /* ⑤ 利用者が名指ししたものは、本当に畳んである */
  const wb = readS('src/components/Wordbook.jsx')
  ok(/className="tip hint">\s*\n\s*上の「学ぶ分野」/.test(wb),
    '説明の文 … 「上の『学ぶ分野』で…」を畳んである')
  /* **文を畳んだぶん、形で言う**(行き止まりを作らない) */
  const sb = noCS(readS('src/components/ShelfBooks.jsx'))
  /* **青いボタンは、もう無い**(2026-09 にプルダウンへ改めた)。
     形で言う役目は**プルダウンそのもの**が引き継いでいる ——
     押すところが1つしか無く、選んでいなければ「分野をえらぶ」と出る */
  ok(/<option value="">分野をえらぶ/.test(sb),
    '説明の文 … 1冊も選んでいなければ、欄が「分野をえらぶ」と言う')
  ok(/className="tip basicpick-lead"/.test(sb),
    '説明の文 … 棚のえらび方の説明も畳んである')

  /* ⑥ 2026-09「こういうの、いらないです」で名指しされた3つ。
        **どれも消していない。畳んであるだけ**である */
  const rs = noCS(readS('src/components/ReviewScope.jsx'))
  /* 「今日出すぶんから出します。」は**2か所**にある(始める前 / 復習の最中)。
     **片方だけ畳むと、もう片方に出たまま残る** */
  ok((rs.match(/className="tip card-hint rscope-lead"/g) ?? []).length === 2,
    '説明の文 … 「今日出すぶんから出します。」を2か所とも畳んである')
  /* **先取りの断りは、説明ではなく知らせ**である(黙って動かさない)。
     畳んだ文と**同じ段落にいた**ので、行を分けてある。

     **上の `keep` の表では捕まらない。** あちらは「その行の手前の
     開きタグに `tip` が付いていないか」を見るが、段落へ戻すと
     手前に来るのが `<>` なので、**混ぜ直しても緑のまま**になる
     (実際に赤チェックで素通りした)。だから**自分の `<p>` にいるか**で見る */
  ok(/\{ahead > 0 && \(\s*\n\s*<p className="card-hint rscope-lead">/.test(rs),
    '説明の文 … 先取りの断りは、畳まない行に分けてある')
  ok(/className="tip hint wb-capped"/.test(wb),
    '説明の文 … 「いまこの画面に読めているのは…」を畳んである')
  /* 「何が何問」の行は**2つの画面にある**(教材のカード / 過去の宿題)。
     2026-09 利用者の指定「揃えてください」。**片方だけ畳むと、
     同じものが画面によって出たり出なかったりする** */
  for (const [名, 道] of [
    ['教材のカード', 'src/components/TrainerMaterials.jsx'],
    ['過去の宿題', 'src/components/TrainerLearners.jsx'],
  ]) {
    ok(/className="tip muted material-parts"/.test(noCS(readS(道))),
      `説明の文 … ${名}の「何が何問」を畳んである`)
  }
}

/*
 * ============================================================================
 * ▶ 文型ドリルで使う語を「単語帳 × レベル × 品詞」で指定する(2026-09)
 *
 *   > 文型トレーニングに、どの単語帳からどのレベルのどの品詞を使用するか、
 *   > を指定できるようにしたい。(利用者の指定)
 *
 *   **新しい仕組みを1つも作っていない。** 選んだ語はすでにある `mustUse`
 *   へ足され、窓口には `reviewWords` として渡る。だから
 *   **SQL も、窓口の置き直しも要らない。AI も1回も呼ばない(0円)。**
 *
 *   ここで見るのは**算段**と、**画面が本当に呼んでいるか**の2つ。
 *   見た目は測れない —— `MaterialForm` は Supabase を引き連れており、
 *   `npm run test:bar` の骨組みでは1ドットも描かれない
 *   (**描けないものは測れない**・CLAUDE.md)。
 * ============================================================================
 */
{
  console.log('\n▶ 文型ドリルで使う語を、単語帳から絞って選ぶ')
  const readD = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')
  const noD = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

  const dw = await import('../src/lib/drillWords.js')
  const { levelOf, posOf } = await import('../src/lib/wordbookFilter.js')
  const { isDrillKind } = await import('../src/data/materialKinds.js')

  /* ── ① 種類の見分け ─────────────────────────────────── */
  ok(isDrillKind('pattern') && !isDrillKind('reading') && !isDrillKind('vocab')
    && !isDrillKind('dialogue'),
  '文型ドリルの語 … 文型ドリルだけを見分ける(`isDrillKind`)')

  /* ── ② 出せる冊だけを出す ───────────────────────────── */
  const noOne = dw.booksFor({ hasLearner: false }).map((b) => b.id)
  const withOne = dw.booksFor({ hasLearner: true }).map((b) => b.id)
  ok(!noOne.includes('learner') && withOne.includes('learner')
    && noOne.includes('shelf') && noOne.includes('basic'),
  '文型ドリルの語 … ゲストを1人選んでいないと「ゲストの単語帳」を出さない')

  /* ── ③ 選択肢は、引けた語から作る ───────────────────── */
  const rows = [
    { word_norm: 'reduce', display: 'reduce', pos: '動詞', material_level: 'B1' },
    { word_norm: 'delay',  display: 'delay',  pos: '名詞', material_level: 'A2' },
    { word_norm: 'ensure', display: 'ensure', pos: '動詞', material_level: 'B2' },
    { word_norm: 'prompt', display: 'prompt', pos: '動詞', material_level: 'A2' },
    /* **品詞が分からない語**。当てずっぽうで「その他」に入れない */
    { word_norm: 'hmm',    display: 'hmm',    pos: '',     material_level: 'A2' },
  ]
  const lv = dw.optionsOf(rows, levelOf)
  ok(lv.map((o) => o.key).join(',') === 'A2,B1,B2',
    '文型ドリルの語 … レベルは、やさしい順にそろえる')
  ok(lv.find((o) => o.key === 'A2')?.count === 3,
    '文型ドリルの語 … 選択肢に、その語数を出す')
  const ps = dw.optionsOf(rows, posOf)
  ok(ps.map((o) => o.key).sort().join(',') === 'noun,verb',
    '文型ドリルの語 … 品詞が分からない語は、選択肢に混ぜない')

  /* **選べるものが1つ以下なら、欄そのものを出さない**
     (効かない操作を見せない)。基礎単語はレベルを持たないので、ここに落ちる */
  const flat = rows.map((r) => ({ ...r, material_level: null }))
  ok(dw.optionsOf(flat, levelOf).length === 0,
    '文型ドリルの語 … レベルが1つも無ければ、欄を出さない')
  ok(dw.optionsOf([{ pos: '動詞' }, { pos: '動詞' }], posOf).length === 0,
    '文型ドリルの語 … 選べるものが1つしかなければ、欄を出さない')

  /* ── ④ 絞って、取り出す ─────────────────────────────── */
  ok(dw.narrowRows(rows, { pos: 'verb' }).length === 3
    && dw.narrowRows(rows, { level: 'A2', pos: 'verb' }).length === 1,
  '文型ドリルの語 … レベルと品詞で絞る(`applyWordbookFilter` を通す)')

  const got = dw.pickWords(rows, { pos: 'verb', count: 10, seed: 1 })
  ok(got.length === 3 && got.every((w) => ['reduce', 'ensure', 'prompt'].includes(w)),
    '文型ドリルの語 … 足りなければ、あるだけ返す')
  ok(dw.pickWords(rows, { pos: 'verb', count: 2, seed: 1 }).length === 2,
    '文型ドリルの語 … 頼んだ数で切る')
  ok(dw.pickWords(rows, { count: 999, seed: 1 }).length
    === Math.min(rows.length, dw.MAX_DRILL_WORDS),
  '文型ドリルの語 … 上限(20 語)を超えない')
  ok(dw.pickWords([{ display: 'a' }, { display: 'a' }, { display: '' }], { count: 5, seed: 1 })
    .join(',') === 'a',
  '文型ドリルの語 … 同じ語を2回入れない。空の行は落とす')

  /* **混ぜてから取る。** 先頭から取ると、基礎単語では
     いつも1日目の語(i / you / am)しか出てこない */
  const many = Array.from({ length: 40 }, (_, i) => ({ display: `w${i}`, pos: '動詞' }))
  const a1 = dw.pickWords(many, { count: 10, seed: 1 }).join(',')
  const a2 = dw.pickWords(many, { count: 10, seed: 9 }).join(',')
  ok(a1 !== a2 && a1 !== many.slice(0, 10).map((x) => x.display).join(','),
    '文型ドリルの語 … 先頭から取らない(混ぜてから選ぶ)')

  /* ── ⑤ 演習ごとに配る ───────────────────────────────── */
  const four = (n) => dw.spreadWords(Array.from({ length: n }, (_, i) => `w${i}`), 4)
  ok(four(20).map((x) => x.length).join(',') === '5,5,5,5',
    '文型ドリルの語 … 20 語は、4演習へ 5 語ずつ配る')
  ok(four(10).map((x) => x.length).join(',') === '3,3,2,2',
    '文型ドリルの語 … 余りは前の演習へ')
  ok(four(2).map((x) => x.length).join(',') === '1,1,0,0',
    '文型ドリルの語 … 足りなければ、空の演習があってよい')
  /* **並びを崩さない。** `mustUse` はトレーナーが名指しで選んだ語が先に来る */
  ok(four(8).flat().join(',') === Array.from({ length: 8 }, (_, i) => `w${i}`).join(','),
    '文型ドリルの語 … 配っても、語の順は崩さない')
  ok(dw.spreadWords([], 4).length === 4 && dw.spreadWords(['a'], 0).length === 0,
    '文型ドリルの語 … 語が無くても・演習が無くても転ばない')

  /* ── ⑥ 画面が本当に呼んでいるか ─────────────────────── */
  const mf = noD(readD('src/components/MaterialForm.jsx'))
  ok(/const drillOn = isDrillKind\(kind\)/.test(mf),
    '文型ドリルの語 … 画面は `isDrillKind()` に任せる(種類をベタ書きしない)')
  ok(!/kind === 'pattern'/.test(mf),
    "文型ドリルの語 … 画面の中で `kind === 'pattern'` と書かない")
  ok(/\{drillOn && \(/.test(mf),
    '文型ドリルの語 … 欄は、文型ドリルのときだけ出す')
  ok(/= booksFor\(\{ hasLearner: !!wordLearner \}\)/.test(mf),
    '文型ドリルの語 … 冊の一覧は `booksFor()` から引く')
  ok(/= useMemo\(\(\) => optionsOf\(wordRows, levelOf\)/.test(mf)
    && /= useMemo\(\(\) => optionsOf\(wordRows, posOf\)/.test(mf),
  '文型ドリルの語 … レベルと品詞の選択肢は `optionsOf()` から作る')
  ok(/= pickWords\(wordRows, \{/.test(mf),
    '文型ドリルの語 … 語は `pickWords()` で選ぶ')
  ok(/wordLevels\.length > 0 && \(/.test(mf) && /wordPoss\.length > 0 && \(/.test(mf),
    '文型ドリルの語 … 選べるものが無い欄は、画面にも出さない')
  ok(/disabled=\{wordHit === 0\}/.test(mf),
    '文型ドリルの語 … 0 語のときは押せない(効かない操作を見せない)')
  ok(/この条件に当てはまる語は <strong>\{wordHit\} 語<\/strong>/.test(mf),
    '文型ドリルの語 … 押す前に、当てはまる語の数を出す')

  /* **足す。入れ替えない。** 単語帳の画面から渡された語が消えては困る */
  ok(/setMustUse\(\[\.\.\.mustUse, \.\.\.add\]\)/.test(mf),
    '文型ドリルの語 … 選んだ語は、いまの一覧に足す(入れ替えない)')
  ok(/const have = new Set\(mustUse\.map\(normWord\)\)/.test(mf),
    '文型ドリルの語 … 同じ語を二重に足さない(何度押しても安全)')

  /* **配っているか。** 文型ドリルだけで、ほかは今までどおり */
  ok(/const share = isDrillKind\(kind\) \? spreadWords\(mergedReview\(\), plan\.length\) : null/
    .test(mf),
  '文型ドリルの語 … 文型ドリルのときだけ、語を演習ごとに配る')
  ok(/reviewWords: share \? \(share\[i\] \?\? \[\]\) : \(i === 0 \? mergedReview\(\) : \[\]\)/
    .test(mf),
  '文型ドリルの語 … 単語・フレーズは、これまでどおり最初の演習へ渡す')

  /* **0円であること。** 語を選ぶのに窓口(AI)を1回も呼ばない */
  const pick = /const addDrillWords = \(\) => \{[\s\S]*?\n  \}/.exec(mf)?.[0] ?? ''
  ok(pick && !/generateSection|lookupWord|askForClip|supabase/.test(pick),
    '文型ドリルの語 … 語を選ぶのに、窓口を1回も呼ばない(0円)')

  /* **`status` を渡さない**(`null` = ぜんぶ)。「まだ」だけに絞ると、
     その人がもう覚えた語で文型を練習できなくなる */
  ok(/loadMyWordbook\(\{ status: null, learnerId: wordLearner \}\)/.test(mf),
    '文型ドリルの語 … ゲストの単語帳は、覚えた語も含めて引く')
  /* **基礎単語はファイルから。** 問い合わせ0回・0円 */
  ok(/basicRows\(wordTier, \[\], \{\}\)/.test(mf),
    '文型ドリルの語 … 基礎単語はファイルから読む(問い合わせ0回)')

  /* ── ⑦ 算段は、素の node で走る形にしてある ─────────── */
  const lib = readD('src/lib/drillWords.js')
  ok(!/from '\.\/supabase\.js'|import\.meta\.env/.test(lib),
    '文型ドリルの語 … 算段に Supabase を持ち込まない(素の node で確かめられる)')
}


/* ══════════════════════════════════════════════════════════════════════
 * 単語帳の紙 — **品詞ごとの小見出し・例文の有無・巻末のレクチャー**
 *
 * 2026-09 利用者の指定。
 *
 *   > 単語帳のPDF化の際に、品詞ごとに並び替えて、小見出しをつけて
 *   > 表示されるようにしてほしい。また、例文をつける、つけないも
 *   > 選べるようにしたい。そして、単語帳の巻末とか間、どこでもよいけど、
 *   > このレクチャーを入れてただの単語帳ではなく、
 *   > 使いこなすことをイメージできる単語帳にしたい。
 *
 * **ここでは算段だけを見る。** 見た目(左が日本語・右が英語か、
 * 小見出しが本当に出ているか)は `npm run test:bar` が**描いて測る** ——
 * 役目が違うので、両方要る。
 * ══════════════════════════════════════════════════════════════════════ */
{
  console.log('\n▶ 単語帳の紙 — 品詞ごとの小見出し / 例文 / 巻末のレクチャー')
  const readD = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')
  /* **「名前が出てくるか」で見ない**(CLAUDE.md)。この節のコメントには
     `qrsheet-list` も `pos === '名詞'` もそのまま書いてあるので、
     **落としてから**使っている形で数える */
  const noNote = (src) => src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
  const sheet = await import('../src/lib/reviewSheet.js')
  const frames = await import('../src/data/sentenceFrames.js')

  const ROWS = [
    { word_norm: 'plan', display: 'plan', meaning_ja: '計画', pos: '名詞',
      seen_in: 'We changed the plan.', seen_in_ja: '計画を変えました。' },
    // **基礎単語の短い印。** 日本語1語と混ぜてある ——
    // `posGroupOf()` を通していないと、この語だけ落ちる
    { word_norm: 'postpone', display: 'postpone', meaning_ja: '延期する', pos: 'v' },
    { word_norm: 'take on', display: 'take on', meaning_ja: '引き受ける', pos: '熟語' },
    // **品詞の分からない語。** 落とさず、いちばん後ろへ
    { word_norm: 'gist', display: 'gist', meaning_ja: '要点' },
    // **窓口が返す知らない言葉。** 当てずっぽうで名詞に入れない
    // (`句動詞` は `posGroups.js` の一覧にあるので、ここでは使わない ——
    //  一覧に在る言葉で試すと、**振り分けを壊しても緑のまま**になる)
    { word_norm: 'ASAP', display: 'ASAP', meaning_ja: 'できるだけ早く', pos: '略語' },
  ]

  /* ── ① 品詞ごとに分ける ──────────────────────────── */
  const secs = sheet.wordSheetSections(sheet.wordSheetPairs(ROWS))
  ok(secs.length === 4, '紙の節 … 品詞ごとに分かれる',
    secs.map((x) => `${x.label}(${x.pairs.length})`).join(' / '))
  ok(secs[0].label === '名詞' && secs[1].label === '動詞',
    '紙の節 … 並びは絞り込みと同じ(名詞 → 動詞 …)')
  /* **短い印(`v`)も動詞へ。** `pos === '動詞'` と書いていたら、ここで落ちる */
  ok(secs[1].pairs.some((x) => x.en === 'postpone'),
    '紙の節 … 基礎単語の短い印(v)も、動詞にまとまる')
  /* **分からないものは、いちばん後ろの節へ。落とさない** */
  const last = secs[secs.length - 1]
  ok(last.id === 'none' && last.pairs.length === 2,
    '紙の節 … 品詞の分からない語は、落とさずいちばん後ろへ',
    `${last.label}(${last.pairs.length})`)
  ok(!secs.some((x) => x.label === 'その他'),
    '紙の節 … 当てずっぽうの「その他」を作らない')
  /* **1語も落ちていない** */
  ok(secs.reduce((n, x) => n + x.pairs.length, 0) === ROWS.length,
    '紙の節 … 1語も落ちていない')
  /* **0語の節は出さない**(空の小見出しを刷らない) */
  ok(!secs.some((x) => x.pairs.length === 0), '紙の節 … 0語の節は出さない')

  /* ── ② Quick Response 帳は分けない ─────────────────── */
  const flat = sheet.wordSheetSections(sheet.wordSheetPairs(ROWS), { byPos: false })
  ok(flat.length === 1 && flat[0].label === '' && flat[0].pairs.length === ROWS.length,
    '紙の節 … byPos を偽にすると、小見出しの無い1つの節になる')
  ok(sheet.wordSheetSections([], { byPos: false }).length === 0,
    '紙の節 … 1つも無ければ、節も作らない')

  /* ── ③ 例文をつける / つけない ────────────────────── */
  const noEx = sheet.wordSheetPairs(ROWS)
  ok(!('ex' in noEx[0]), '紙の例文 … つけないときは、欄ごと持たせない')
  const withEx = sheet.wordSheetPairs(ROWS, { example: true })
  ok(withEx[0].ex === 'We changed the plan.' && withEx[0].exJa === '計画を変えました。',
    '紙の例文 … 出会った文(seen_in)と、その訳をそのまま使う')
  ok(!('ex' in withEx[1]),
    '紙の例文 … 出会った文の無い語には、空の行を作らない')
  /* **新しく作らない = 0円。** 窓口を1回も呼ばない */
  ok(!/lookupWord|generateSection|supabase|import\.meta\.env/.test(readD('src/lib/reviewSheet.js')),
    '紙の例文 … 例文を新しく作らない(窓口を1回も呼ばない・0円)')
  /* **既定は「つける」。** この指定の眼目である */
  ok(sheet.loadSheetExample() === true, '紙の例文 … 既定は「つける」')
  /* **鍵の名前は1か所。** 画面に書かない */
  ok(!/eas\.sheetExample/.test(readD('src/components/Wordbook.jsx')),
    '紙の例文 … 覚える鍵の名前を、画面に書かない')

  /* ── ④ 巻末のレクチャー ───────────────────────────── */
  ok(frames.FRAME_SECTIONS.length === 3 && frames.frameCount() >= 60,
    '巻末のレクチャー … ①②③の3節で、型が 60 以上ある',
    `${frames.frameCount()} 型`)
  /* **実在の人物・会社の名前を入れない**(`speechStyles.js` と同じ決まり) */
  const names = /Elon|Musk|Jobs|Apple|Google|Microsoft|Amazon|Tesla/
  ok(!frames.FRAME_SECTIONS.some((x) => x.groups.some((g) =>
    g.rows.some((r) => names.test(r.ex) || names.test(r.form)))),
  '巻末のレクチャー … 例文に実在の人物・企業の名前を入れない')
  /* **型が重なっていない**(同じ型を2度刷らない) */
  {
    const all = frames.FRAME_SECTIONS.flatMap((x) => x.groups.flatMap((g) => g.rows.map((r) => r.form)))
    ok(new Set(all).size === all.length, '巻末のレクチャー … 同じ型が2度出てこない')
  }
  /* **資料と食い違わない。**
     `docs/sentence-frames.html` はトレーナーに渡す詳しいほうで、
     こちらはゲストが引く一覧である。**役目は違うが、型が違ってはいけない** ——
     片方に足して、もう片方に足し忘れると**言っていることが2つ**になる */
  {
    const html = readD('docs/sentence-frames.html')
      .replace(/<[^>]*>/g, '')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
    const miss = []
    for (const sec of frames.FRAME_SECTIONS) {
      for (const g of sec.groups) {
        for (const r of g.rows) {
          if (!html.includes(r.form.replace(/\s+/g, ' '))) miss.push(`型 ${r.form}`)
          if (!html.includes(r.ex.replace(/\s+/g, ' '))) miss.push(`例 ${r.ex}`)
        }
      }
    }
    ok(miss.length === 0,
      '巻末のレクチャー … 型と例文が、docs/sentence-frames.html と食い違わない',
      miss.slice(0, 3).join(' / '))
  }
  /* **型を画面に書き写さない**(資料を直したときに、紙だけ古くなる) */
  {
    const fs2 = noNote(readD('src/components/FramesSheet.jsx'))
    ok(/from '\.\.\/data\/sentenceFrames\.js'/.test(fs2),
      '巻末のレクチャー … 型は sentenceFrames.js から読む(書き写さない)')
    ok(!/S allows|keeps 人 from/.test(fs2),
      '巻末のレクチャー … 画面の中に型を書かない')
  }
  /* **語の番号と見分けが付かなくなるので、型には番号を振らない** */
  ok(!/qrsheet-list/.test(noNote(readD('src/components/FramesSheet.jsx'))),
    '巻末のレクチャー … 語の一覧(通し番号つき)の指定に乗せない')

  /* ── ⑤ 画面が本当に呼んでいるか ───────────────────── */
  {
    const wb = readD('src/components/Wordbook.jsx')
    ok(/= wordSheetSections\(sheetPairs\)/.test(wb),
      '単語帳の紙 … 画面が wordSheetSections() を通している')
    ok(/wordSheetPairs\(shownRows, \{ example: sheetEx \}\)/.test(wb),
      '単語帳の紙 … 例文をつけるかを、対の作り方へ渡している')
    ok(/sections=\{sheetSections\}/.test(wb) && /frames=\{sheetFrames\}/.test(wb),
      '単語帳の紙 … 節と、巻末のレクチャーを渡している')
    /* **既定は「つける」**(利用者の指定は「入れて」である)。
       ただし 66 型は5ページほどになるので、**断る道も残す** */
    ok(sheet.loadSheetFrames() === true, '巻末のレクチャー … 既定は「つける」')
    ok(!/eas\.sheetFrames/.test(wb),
      '巻末のレクチャー … 覚える鍵の名前を、画面に書かない')
    /* **何型ぶん増えるのかを、押す前に出す**(画面で数え直さない) */
    ok(/\{frameCount\(\)\} 型/.test(wb),
      '巻末のレクチャー … 押す前に、型の数を出す')
    /* **画面で品詞を書き分けない**(基礎単語の `v` で必ず抜ける) */
    ok(!/pos === '名詞'|pos === '動詞'/.test(noNote(wb)),
      '単語帳の紙 … 画面の中で品詞を名指ししない')
    const qr = readD('src/components/QrReview.jsx')
    ok(/wordSheetSections\(sheetPairs, \{ byPos: false \}\)/.test(qr),
      'Quick Response 帳 … 品詞では分けない(文に品詞は無い)')
    ok(!/frames/.test(qr),
      'Quick Response 帳 … 巻末のレクチャーは出さない(言われた場所だけを直す)')
    /* **骨組みは本物と1文字も違えない**(CLAUDE.md)。
       ここが食い違うと、`npm run test:bar` は何も守らない */
    const sc = readD('src/__screens.jsx')
    ok(/sections=\{wordSheetSections\(wordSheetPairs\(SHEET_ROWS, \{ example \}\)\)\}/.test(sc),
      '骨組み … 本物と同じ道で節を作っている')
  }
}

/* ══════════════════════════════════════════════════════════════════════
 * Native Flow Vol.1(Quick Response 教材)と
 * コロケーション基本動詞(単語帳)   2026-09 利用者の指定
 *
 *   > これらを教材として独立させて登録せよ。
 *   > Native flow は Quick Response 教材、コロケーション基本動詞は単語帳だ。
 *
 * **どちらもファイルに書いてある = AI を1回も呼ばない = 0円。**
 * 見るのは6つ ——①数が減っていないか ②原本のとおりか
 * ③行の形が `qr_items()` / `review_words()` と同じか
 * ④絞り込みが効く形になっているか ⑤答えが漏れていないか
 * ⑥**画面が本当に呼んでいるか。**
 * ══════════════════════════════════════════════════════════════════════ */
console.log('\n▶ Native Flow と コロケーションと名詞句と副詞句(ファイルに持った教材)')
{
  const readD = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')
  /* **「名前が出てくるか」で見ない**(CLAUDE.md)。この節にも
     `loadNativeFlowQr` などがコメントで出てくるので、落としてから数える */
  const noNote = (src) => src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

  const nf = await import('../src/data/nativeFlow.js')
  const col = await import('../src/data/collocations.js')
  const np = await import('../src/data/nounPhrases.js')
  const adv = await import('../src/data/adverbPhrases.js')
  const { normEn, normWord } = await import('../src/lib/textNorm.js')

  /* ── ① 一覧を勝手に減らさない ───────────────────────── */
  ok(nf.NATIVE_FLOW.length === 690,
    'Native Flow … 690 問ある', `いま ${nf.NATIVE_FLOW.length}`)
  ok(nf.NATIVE_FLOW_UNITS.length === 6,
    'Native Flow … Unit は 6 つ', `いま ${nf.NATIVE_FLOW_UNITS.length}`)
  ok(nf.NATIVE_FLOW_UNITS.every((u) => u.n === nf.NATIVE_FLOW.filter((x) => x.u === u.id).length),
    'Native Flow … Unit ごとの数が、一覧と中身で合っている')
  /* **基本動詞 50 + ビジネス 50 = 100**(2026-09 利用者の指定
     「ビジネスで使用するコロケーション50」「同じ冊に足して 100 件に」)。
     **数を書き写さず、組の数 × 10 という関係で見る** ——
     組を足したときに、期待値も一緒に動く */
  ok(col.COLLOCATIONS.length === col.COLLOCATION_VERBS.length * 10,
    `コロケーション … ${col.COLLOCATION_VERBS.length} 動詞 × 10 = ${col.COLLOCATIONS.length} 件`,
    `いま ${col.COLLOCATIONS.length}`)
  ok(col.COLLOCATION_VERBS.every((v) => col.COLLOCATIONS.filter((x) => x.v === v.id).length === 10),
    'コロケーション … どの動詞の組も 10 件ちょうど')
  /* **組を勝手に増やしていないか**(逆も見る) */
  ok(col.COLLOCATIONS.every((x) => col.collocationVerbOf(x.v)),
    'コロケーション … 一覧に無い動詞の組を使っていない')

  /* ── ② 原本のとおりに持つ ───────────────────────────── */
  /* **合字は直す。** PDF の組版で1文字になっているので、
     そのままだと `normEn` でも読み上げでも別の語になる */
  const LIG = /[ﬀ-ﬆ]/
  ok(!nf.NATIVE_FLOW.some((x) => LIG.test(x.en) || LIG.test(x.ja)),
    'Native Flow … 合字(fi / fl)が1つも残っていない')
  ok(!col.COLLOCATIONS.some((x) => LIG.test(x.en) || LIG.test(x.p)),
    'コロケーション … 合字が1つも残っていない')
  ok(nf.NATIVE_FLOW.every((x) => x.en.trim() && x.ja.trim()),
    'Native Flow … 英文も訳も、空の問が1つも無い')
  ok(col.COLLOCATIONS.every((x) => x.p.trim() && x.n.trim() && x.en.trim() && x.ja.trim()),
    'コロケーション … 空の欄が1つも無い')
  /* **句である**(`make a decision`)。1語だと `kind: 'phrase'` が嘘になる */
  ok(col.COLLOCATIONS.every((x) => x.p.includes(' ')),
    'コロケーション … どれも2語以上(句として単語帳に入る)')
  /* **例文の中に、その語句が出てくるか。** 出てこないと
     「出会った文」が手がかりにならず、穴埋め(箱3)も作れない。

     **動詞では当てられない** —— `make a decision` の例文は `made`、
     `do damage` の例文は `did` である(活用は語のリストでは追えない)。
     **当てられることだけを見る**(CLAUDE.md)ので、**名詞のほう**を見る。
     あちらは活用しないので、50 件とも当たる */
  const inSentence = col.COLLOCATIONS.filter(
    (x) => normEn(x.en).split(' ').includes(normEn(x.p.split(' ').pop())))
  ok(inSentence.length === col.COLLOCATIONS.length,
    'コロケーション … 例文の中に、その語句の名詞が出てくる',
    `${inSentence.length} / ${col.COLLOCATIONS.length}`)

  /* ── ③ 行の形が、表から来る行と1つ残らず同じか ──────────── */
  const QR_FIELDS = ['en_norm', 'en', 'ja', 'speaker', 'status', 'box', 'learn_streak',
    'due_on', 'added_at', 'updated_at', 'material_id', 'material_title',
    'material_industry', 'material_kind', 'material_genre', 'material_scene', 'material_level']
  const nfRows = nf.nativeFlowRows([], { today: '2026-09-15' })
  ok(nfRows.length === 690, 'Native Flow … 行も 690 出る')
  ok(QR_FIELDS.every((k) => k in nfRows[0]) && Object.keys(nfRows[0]).length === QR_FIELDS.length,
    'Native Flow … qr_items() と同じ欄がそろっている',
    QR_FIELDS.filter((k) => !(k in nfRows[0])).join(' ') || 'ぴったり')

  const WORD_FIELDS = ['word_norm', 'display', 'kind', 'pos', 'meaning_ja', 'seen_in',
    'seen_in_ja', 'status', 'box', 'due_on', 'updated_at', 'added_at', 'material_id',
    'material_title', 'material_industry', 'material_kind', 'material_genre',
    'material_scene', 'material_level', 'learn_streak']
  const colRows = col.collocationRows([], { today: '2026-09-15' })
  ok(colRows.length === col.COLLOCATIONS.length,
    `コロケーション … 行も ${colRows.length} 出る`)
  ok(WORD_FIELDS.every((k) => k in colRows[0]) && Object.keys(colRows[0]).length === WORD_FIELDS.length,
    'コロケーション … review_words() と同じ欄がそろっている',
    WORD_FIELDS.filter((k) => !(k in colRows[0])).join(' ') || 'ぴったり')

  /* **行の無い問は「まだ・箱0・今日出す」**(待たせる理由がない) */
  ok(nfRows.every((r) => r.status === 'unknown' && r.box === 0 && r.due_on === '2026-09-15'),
    'Native Flow … まだ答えていない問は「まだ・箱0・今日出す」')
  ok(colRows.every((r) => r.status === 'unknown' && r.box === 0 && r.due_on === '2026-09-15'),
    'コロケーション … まだ答えていない語句は「まだ・箱0・今日出す」')

  /* **覚え具合は、そろえた形で突き合わせる**(鍵は英文 / 語句そのもの) */
  const seenNf = [{ en_norm: normEn(nf.NATIVE_FLOW[3].en), status: 'learning', box: 2,
    due_on: '2026-12-01', learn_streak: 4 }]
  const hit = nf.nativeFlowRows(seenNf, { today: '2026-09-15' })[3]
  ok(hit.status === 'learning' && hit.box === 2 && hit.due_on === '2026-12-01'
     && hit.learn_streak === 4,
    'Native Flow … 覚え具合が、そろえた英文で当たる')
  const seenCol = [{ word_norm: normWord(col.COLLOCATIONS[7].p), status: 'known', box: 6,
    due_on: '2026-12-31', learn_streak: 30 }]
  const hitC = col.collocationRows(seenCol, { today: '2026-09-15' })[7]
  ok(hitC.status === 'known' && hitC.box === 6 && hitC.learn_streak === 30,
    'コロケーション … 覚え具合が、そろえた語句で当たる')

  /* ── ④ 絞り込みが効く形か(**新しい欄を作らない**)─────────── */
  /* Unit は `material_title` に入れてある。だから Quick Response の
     「教材の名前で絞る」がそのまま効く(棚が `material_industry` を
     使い回したのと同じ話)。**ここが空だと、Unit で絞れなくなる** */
  ok([...new Set(nfRows.map((r) => r.material_title))].length === 6,
    'Native Flow … material_title に Unit が入っている(6種)')
  /* **呼び名は `unitName()` 1か所**(第5.175節)。番号と中身のあいだが
     スペース1つだと、`Unit 5 7単語以上` で**どこまでが番号か読めない** */
  ok(nfRows.every((r) => /^Native Flow【Unit \d+】./.test(r.material_title)),
    'Native Flow … どの Unit だか、名前を見れば分かる(【 】で囲ってある)')
  ok([...new Set(colRows.map((r) => r.material_title))].length === col.COLLOCATION_VERBS.length,
    `コロケーション … material_title に動詞の組が入っている(${col.COLLOCATION_VERBS.length}種)`)
  /* **知らない id は null**(当てずっぽうで返さない) */
  ok(nf.unitOf(99) === null && col.collocationVerbOf('zzz') === null,
    '知らない id … null を返す(当てずっぽうで返さない)')
  ok(nf.unitTitle(99) === 'Native Flow' && col.collocationTitle('zzz') === 'コロケーション',
    '知らない id … 名前は行き止まりにしない')

  /* ── ⑤ 答えが漏れていないか ─────────────────────────── */
  /* `base`(1語で言うと decide)を意味に混ぜると、
     **4択の選択肢に英語が出て、答えが見えてしまう**(CLAUDE.md) */
  ok(colRows.every((r) => !/[A-Za-z]{3,}/.test(r.meaning_ja)),
    'コロケーション … 意味の欄に英語を混ぜない(4択で答えが見える)')
  ok(col.COLLOCATIONS.every((x, i) => colRows[i].meaning_ja === x.n),
    'コロケーション … 意味はニュアンスそのもの')
  /* **出会った文は、原本の例文そのもの**(人は文脈ごと覚える・0018) */
  ok(col.COLLOCATIONS.every((x, i) => colRows[i].seen_in === x.en && colRows[i].seen_in_ja === x.ja),
    'コロケーション … 出会った文は、原本の例文そのもの')

  /* ── ⑥ 画面が本当に呼んでいるか ─────────────────────── */
  const wb = noNote(readD('src/components/Wordbook.jsx'))
  ok(/loadCollocationWordbook\(\{ learnerId \}\)/.test(wb),
    '単語帳 … 画面が loadCollocationWordbook() を呼んでいる')
  ok(/showCol \? \[\{ id: 'col', label: 'コロケーション' \}\] : \[\]/.test(wb),
    '単語帳 … 冊の一覧に「コロケーション」が在る(出すかは呼ぶ側が決める)')
  /* **トレーナーがゲストの単語帳を開く画面を、1ドットも変えていない。**
     既定は「出さない」で、`App.jsx`(自分の単語帳)だけが渡す */
  ok(/showCol = false/.test(wb), '単語帳 … コロケーションの既定は「出さない」')
  const app = noNote(readD('src/App.jsx'))
  ok(/<Wordbook\s+showCol/.test(app), '単語帳 … 自分の単語帳にだけ出している')
  ok(!/showCol/.test(noNote(readD('src/components/TrainerLearners.jsx'))),
    '単語帳 … ゲストの単語帳を開く画面には渡していない')
  ok(/colBook = book === 'col'/.test(wb) && /shelfBook \|\| basicBook \|\| colBook/.test(wb),
    '単語帳 … 表を直に読む冊として扱っている')
  /* **並びで見ない。入っているかで見る**(2026-09)。
     もとは `tier, colBook])` と**末尾の並びそのもの**を探していたので、
     見張りに1つ足しただけで赤くなった。**壊れていないものが赤くなると、
     本当に壊れているものを見落とす**(CLAUDE.md) */
  ok(/\}, \[[^\]]*\bcolBook\b[^\]]*\]\)/.test(wb),
    '単語帳 … 冊が変わったら読み直す(見張りに入っている)')

  /* ── ⑦ 名詞句(単語帳の5冊目)─────────────────────────
     2026-09 利用者の指定
       > どのビジネスでも使える「名詞句」を厳選し、
       > 単語帳に一つのコンテンツとして置き……

     **コロケーションと1文字も違わない形にしてある**ので、
     見る中身も同じにそろえる(読み方を2通り持たない)。 */
  /* **100 件**(2026-09 利用者の指定「ビジネスで使用する名詞句100」) */
  ok(np.NOUN_PHRASES.length === 100,
    '名詞句 … 100 件ある', `いま ${np.NOUN_PHRASES.length}`)
  ok(np.NOUN_PHRASE_GROUPS.length === 6
     && np.NOUN_PHRASE_GROUPS.every((g) => np.NOUN_PHRASES.some((x) => x.g === g.id)),
    '名詞句 … 6つの組があり、どれにも中身がある')
  /* **知らない組を勝手に増やしていないか**(逆も見る) */
  ok(np.NOUN_PHRASES.every((x) => np.nounPhraseGroupOf(x.g)),
    '名詞句 … 一覧に無い組を使っていない')
  ok(np.NOUN_PHRASES.every((x) => x.p.trim() && x.n.trim() && x.en.trim() && x.ja.trim()),
    '名詞句 … 空の欄が1つも無い')
  ok(np.NOUN_PHRASES.every((x) => x.p.includes(' ')),
    '名詞句 … どれも2語以上(句として単語帳に入る)')
  ok(!np.NOUN_PHRASES.some((x) => LIG.test(x.en) || LIG.test(x.p)),
    '名詞句 … 合字が1つも残っていない')
  /* **鍵が重なっていないか。** 重なると、片方の覚え具合がもう片方に付く */
  const npKeys = np.NOUN_PHRASES.map((x) => normWord(x.p))
  ok(new Set(npKeys).size === npKeys.length, '名詞句 … そろえた語句が重なっていない')
  /* **例文の中に、その語句がそのまま出てくるか。**
     ここがいちばん効く —— 出てこない例文だと、
     **文脈ごと覚える**という単語帳の前提がくずれる(0018)。
     大文字小文字は見ない(文頭に来ると `A lack of …` になる) */
  const npIn = np.NOUN_PHRASES.filter((x) => x.en.toLowerCase().includes(x.p.toLowerCase()))
  ok(npIn.length === np.NOUN_PHRASES.length, '名詞句 … 例文の中に、その語句がそのまま出てくる',
    `${npIn.length} / ${np.NOUN_PHRASES.length}`)
  /* **芯の名詞は、語句の中に入っているか**(`head` の書き間違い) */
  ok(np.NOUN_PHRASES.every((x) => x.p.toLowerCase().includes(x.head.toLowerCase())),
    '名詞句 … 芯の名詞が、語句の中にある')

  const npRows = np.nounPhraseRows([], { today: '2026-09-15' })
  ok(npRows.length === np.NOUN_PHRASES.length, `名詞句 … 行も ${npRows.length} 出る`)
  ok(WORD_FIELDS.every((k) => k in npRows[0]) && Object.keys(npRows[0]).length === WORD_FIELDS.length,
    '名詞句 … review_words() と同じ欄がそろっている',
    WORD_FIELDS.filter((k) => !(k in npRows[0])).join(' ') || 'ぴったり')
  ok(npRows.every((r) => r.status === 'unknown' && r.box === 0 && r.due_on === '2026-09-15'),
    '名詞句 … まだ答えていない語句は「まだ・箱0・今日出す」')
  const seenNp = [{ word_norm: normWord(np.NOUN_PHRASES[9].p), status: 'known', box: 5,
    due_on: '2026-12-31', learn_streak: 12 }]
  const hitN = np.nounPhraseRows(seenNp, { today: '2026-09-15' })[9]
  ok(hitN.status === 'known' && hitN.box === 5 && hitN.learn_streak === 12,
    '名詞句 … 覚え具合が、そろえた語句で当たる')
  /* **答えが漏れていないか。** 芯の名詞を意味に混ぜると 4択に英語が出る */
  ok(npRows.every((r) => !/[A-Za-z]{3,}/.test(r.meaning_ja)),
    '名詞句 … 意味の欄に英語を混ぜない(4択で答えが見える)')
  ok([...new Set(npRows.map((r) => r.material_title))].length === 6,
    '名詞句 … material_title に組が入っている(6種)')
  ok(np.nounPhraseGroupOf('zzz') === null && np.nounPhraseTitle('zzz') === '名詞句',
    '名詞句 … 知らない id は null。名前は行き止まりにしない')

  /* **画面が本当に呼んでいるか。** 算段だけ直っていても、
     画面が呼んでいなければ何も変わらない */
  ok(/loadNounPhraseWordbook\(\{ learnerId \}\)/.test(wb),
    '単語帳 … 画面が loadNounPhraseWordbook() を呼んでいる')
  ok(/showNp \? \[\{ id: 'np', label: '名詞句' \}\] : \[\]/.test(wb),
    '単語帳 … 冊の一覧に「名詞句」が在る(出すかは呼ぶ側が決める)')
  ok(/showNp = false/.test(wb), '単語帳 … 名詞句の既定は「出さない」')
  ok(/showNp/.test(app), '単語帳 … 自分の単語帳にだけ出している')
  ok(!/showNp/.test(noNote(readD('src/components/TrainerLearners.jsx'))),
    '単語帳 … ゲストの単語帳を開く画面には渡していない')
  ok(/npBook = book === 'np'/.test(wb) && /colBook \|\| npBook/.test(wb),
    '単語帳 … 表を直に読む冊として扱っている')
  /* **並びで見ない。入っているかで見る**(2026-09 の教訓) */
  ok(/\}, \[[^\]]*\bnpBook\b[^\]]*\]\)/.test(wb),
    '単語帳 … 冊が変わったら読み直す(見張りに入っている)')
  /* **冊は後ろへ足す。並べ替えない**(docs/notes/22 の決まり) ——
     前へ割り込ませると、ゲストが覚えた置き場所が全部ずれる */
  ok(wb.indexOf("id: 'col'") < wb.indexOf("id: 'np'"),
    '単語帳 … 新しい冊を後ろへ足している(並べ替えていない)')

  /* ── ⑧ 副詞句(単語帳の6冊目)─────────────────────────
     2026-09 利用者の指定「ビジネスで使用する副詞句50」。
     **名詞句と1文字も違わない形**にしてあるので、見る中身も同じにそろえる */
  ok(adv.ADVERB_PHRASES.length === 50,
    '副詞句 … 50 件ある', `いま ${adv.ADVERB_PHRASES.length}`)
  ok(adv.ADVERB_PHRASE_GROUPS.length > 1
     && adv.ADVERB_PHRASE_GROUPS.every((g) => adv.ADVERB_PHRASES.some((x) => x.g === g.id)),
    `副詞句 … ${adv.ADVERB_PHRASE_GROUPS.length} つの組があり、どれにも中身がある`)
  ok(adv.ADVERB_PHRASES.every((x) => adv.adverbPhraseGroupOf(x.g)),
    '副詞句 … 一覧に無い組を使っていない')
  ok(adv.ADVERB_PHRASES.every((x) => x.p.trim() && x.n.trim() && x.en.trim() && x.ja.trim()),
    '副詞句 … 空の欄が1つも無い')
  ok(adv.ADVERB_PHRASES.every((x) => x.p.includes(' ')),
    '副詞句 … どれも2語以上(句として単語帳に入る)')
  ok(!adv.ADVERB_PHRASES.some((x) => LIG.test(x.en) || LIG.test(x.p)),
    '副詞句 … 合字が1つも残っていない')
  const advKeys = adv.ADVERB_PHRASES.map((x) => normWord(x.p))
  ok(new Set(advKeys).size === advKeys.length, '副詞句 … そろえた語句が重なっていない')
  /* **例文の中に、その語句がそのまま出てくるか。** ここがいちばん効く */
  const advIn = adv.ADVERB_PHRASES.filter(
    (x) => x.en.toLowerCase().includes(x.p.toLowerCase()))
  ok(advIn.length === adv.ADVERB_PHRASES.length,
    '副詞句 … 例文の中に、その語句がそのまま出てくる',
    `${advIn.length} / ${adv.ADVERB_PHRASES.length}`)

  const advRows = adv.adverbPhraseRows([], { today: '2026-09-15' })
  ok(advRows.length === adv.ADVERB_PHRASES.length, `副詞句 … 行も ${advRows.length} 出る`)
  ok(WORD_FIELDS.every((k) => k in advRows[0])
     && Object.keys(advRows[0]).length === WORD_FIELDS.length,
    '副詞句 … review_words() と同じ欄がそろっている',
    WORD_FIELDS.filter((k) => !(k in advRows[0])).join(' ') || 'ぴったり')
  ok(advRows.every((r) => r.status === 'unknown' && r.box === 0 && r.due_on === '2026-09-15'),
    '副詞句 … まだ答えていない語句は「まだ・箱0・今日出す」')
  const seenAdv = [{ word_norm: normWord(adv.ADVERB_PHRASES[5].p), status: 'known', box: 4,
    due_on: '2026-12-31', learn_streak: 9 }]
  const hitA = adv.adverbPhraseRows(seenAdv, { today: '2026-09-15' })[5]
  ok(hitA.status === 'known' && hitA.box === 4 && hitA.learn_streak === 9,
    '副詞句 … 覚え具合が、そろえた語句で当たる')
  ok(advRows.every((r) => !/[A-Za-z]{3,}/.test(r.meaning_ja)),
    '副詞句 … 意味の欄に英語を混ぜない(4択で答えが見える)')
  ok([...new Set(advRows.map((r) => r.material_title))].length
     === adv.ADVERB_PHRASE_GROUPS.length,
    '副詞句 … material_title に組が入っている')
  ok(adv.adverbPhraseGroupOf('zzz') === null && adv.adverbPhraseTitle('zzz') === '副詞句',
    '副詞句 … 知らない id は null。名前は行き止まりにしない')

  ok(/loadAdverbPhraseWordbook\(\{ learnerId \}\)/.test(wb),
    '単語帳 … 画面が loadAdverbPhraseWordbook() を呼んでいる')
  ok(/showAdv \? \[\{ id: 'adv', label: '副詞句' \}\] : \[\]/.test(wb),
    '単語帳 … 冊の一覧に「副詞句」が在る(出すかは呼ぶ側が決める)')
  ok(/showAdv = false/.test(wb), '単語帳 … 副詞句の既定は「出さない」')
  ok(/showAdv/.test(app), '単語帳 … 自分の単語帳にだけ出している')
  ok(!/showAdv/.test(noNote(readD('src/components/TrainerLearners.jsx'))),
    '単語帳 … ゲストの単語帳を開く画面には渡していない')
  ok(/advBook = book === 'adv'/.test(wb) && /npBook \|\| advBook/.test(wb),
    '単語帳 … 表を直に読む冊として扱っている')
  ok(/\}, \[[^\]]*\badvBook\b[^\]]*\]\)/.test(wb),
    '単語帳 … 冊が変わったら読み直す(見張りに入っている)')
  /* **冊は後ろへ足す。並べ替えない**(docs/notes/22 の決まり) */
  ok(wb.indexOf("id: 'np'") < wb.indexOf("id: 'adv'"),
    '単語帳 … 新しい冊を後ろへ足している(並べ替えていない)')

  const qr = noNote(readD('src/components/QrReview.jsx'))
  ok(/loadNativeFlowQr\(\{ learnerId, units:/.test(qr),
    'Quick Response 帳 … 画面が loadNativeFlowQr() を Unit つきで呼んでいる')
  /* **呼び名は `NF_BOOK_LABEL` 1か所**(第5.186節)。名前で数えない */
  ok(/nfUnits\.length \? \[\{ id: 'nf', label: NF_BOOK_LABEL/.test(qr),
    'Quick Response 帳 … 出す Unit が1つも無ければ、冊ごと出さない')
  ok(/nfUnits = \[\]/.test(qr), 'Quick Response 帳 … 既定は空(渡さない画面では出ない)')
  ok(!/showNf/.test(qr), 'Quick Response 帳 … 「出すか」と「どれを出すか」を2つ持っていない')
  /* **`/>` まで数えない**(第5.167節で `onClose` が付き、複数行になった)。
     見たいのは「自分の帳にだけ `nfUnits` を渡している」ことである */
  ok(/<QrReview nfUnits=\{myNfUnits\}/.test(app)
    && (app.match(/<QrReview /g) ?? []).length === 1,
    'Quick Response 帳 … 自分の帳にだけ出している')
  /* **渡していないこと**を見る。第5.181節で `nfUnitsOn()`(どれが
     出ているかの判断)を読むようになったので、**名前が出るだけでは赤にしない** */
  ok(!/nfUnits=/.test(noNote(readD('src/components/TrainerLearners.jsx'))),
    'Quick Response 帳 … ゲストのページから開く画面には渡していない')
  ok(/\}, \[[^\]]*\blearnerId\b[^\]]*\bbook\b[^\]]*\]\)/.test(qr),
    'Quick Response 帳 … 冊が変わったら読み直す')

  /* **そろえ方を書き写さない**(`textNorm.js` 1か所) */
  const nfSrc = noNote(readD('src/data/nativeFlow.js'))
  const colSrc = noNote(readD('src/data/collocations.js'))
  ok(/from '\.\.\/lib\/textNorm\.js'/.test(nfSrc) && /from '\.\.\/lib\/textNorm\.js'/.test(colSrc),
    'そろえ方は textNorm.js 1か所(書き写さない)')
  ok(!/toLowerCase\(\)\s*\.replace/.test(nfSrc + colSrc),
    'そろえ方を、データの側に書き写していない')

  /* ── ⑦ 貼る SQL がそろっているか(0062)──────────────── */
  /* **`setupState.js` は import できない** —— Supabase を引き連れており、
     素の node では `import.meta.env` が無くて落ちる。**ソースで見る** */
  const setup = noNote(readD('src/lib/setupState.js'))
  ok(/NEWEST_MIGRATION = '0062'/.test(setup),
    '0062 … いちばん新しい移行として登録してある')
  ok(/rpc: 'qr_limit'/.test(setup),
    '0062 … 印は qr_limit()(表も列も増えない移行だから)')
  ok(!/row: \{ column/.test(setup),
    '0062 … 前の印(行を見る形)が残っていない')
  const matome = readD('supabase/apply/pending_matome.sql')
  ok(/create or replace function public\.qr_limit\(\)/.test(matome),
    '0062 … まとめた1つ(pending_matome.sql)に入っている')
  ok(/least\(coalesce\(p_limit, 200\), public\.qr_limit\(\)\)/.test(matome),
    '0062 … qr_items() の上限が qr_limit() から読まれている')
  /* **500 の決め打ちは残っていてよい** —— まとめた1つは 0041 以降を
     **順に並べたもの**なので、0048 の段も入っている。
     見るのは「**そのあとに 0062 が来て、上書きされるか**」である */
  ok(matome.lastIndexOf('public.qr_limit()')
     > matome.lastIndexOf('least(coalesce(p_limit, 200), 500)'),
    '0062 … 上限の差し替えが、0048 の 500 より後に来ている(貼れば上書きされる)')
  ok(/proname = 'qr_limit'/.test(readD('supabase/apply/check.sql')),
    '0062 … check.sql にも行が足してある')
}

/* ══════════════════════════════════════════════════════════════════════
   育った語の例文を、Quick Response 帳へ送る(2026-09 利用者の指定「自動でOK」)

   **いちばん危ないのは「送りすぎ」ではなく「送り直し」である。**
   `mark_qr` は「まだ」で入れ直すと**箱も回数も 0 に戻す**ので、
   すでに溜まっている文をもう一度送ると、
   **ゲストが積み上げた進み具合を、こちらが崩す。**
   だからそこを名指しで見る。
   ══════════════════════════════════════════════════════════════════════ */
{
  console.log('\n▶ 育った語の例文を Quick Response 帳へ送る')
  const readD = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')
  const noNote = (src) => src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1 ')

  /** 育った語1行ぶん。**値を書き写さず、性質で作る** */
  const row = (o = {}) => ({
    word_norm: 'decision',
    learn_streak: PROMOTE_KNOWN_AFTER,
    seen_in: 'I need to make a decision soon.',
    seen_in_ja: 'すぐに決断しないといけない',
    ...o,
  })

  // ── 送る(出る)
  ok(!!promotableOf(row()), '十分に育った語は、出会った文を送る')
  ok(promotableOf(row()).en === row().seen_in, '送るのは、出会った文そのもの(作り直さない)')
  ok(promotableOf(row()).ja === row().seen_in_ja, '訳も、出会ったときのものを送る')

  // ── 送らない(出ない)。**両方を見ないと、何も守らない**
  ok(promotableOf(row({ learn_streak: PROMOTE_KNOWN_AFTER - 1 })) === null,
    'あと1回足りない語は、送らない')
  ok(promotableOf(row({ learn_streak: 0 })) === null, '入ったばかりの語は、送らない')
  ok(promotableOf(row({ seen_in: null })) === null,
    '出会った文が無ければ送らない(**AI に作らせない = 0円**)')
  ok(promotableOf(row({ seen_in_ja: '' })) === null, '訳が無ければ送らない')
  ok(promotableOf(row({ seen_in: 'Decision.' })) === null,
    '出会った文が語そのものなら送らない(伏せる場所が無い)')
  ok(promotableOf(row({ seen_in: 'No way.' })) === null, '3語に満たない文は送らない')

  // ── **送り直さない**(ここがいちばん危ない)
  const one = promotableOf(row())
  ok(pickPromotions([row()], { already: [one.norm] }).length === 0,
    '前に送った文は、もう一度送らない(「もう出さない」を掘り返さない)')
  ok(pickPromotions([row()], {}).length === 1, '前に送っていなければ、ちゃんと送る')

  // ── 同じ文が2語ぶん来ても、1つにまとめる
  ok(pickPromotions([row(), row({ word_norm: 'soon' })], {}).length === 1,
    '同じ文が2語ぶん来ても、送るのは1つ')

  // ── **止まる条件を持たせる**(CLAUDE.md)
  const many = Array.from({ length: PROMOTE_MAX + 5 },
    (unused, i) => row({ word_norm: `w${i}`, seen_in: `This is sentence number ${i} here.` }))
  ok(pickPromotions(many, {}).length === PROMOTE_MAX,
    `1回に送るのは ${PROMOTE_MAX} 文まで(棚を入れ直した日に溢れない)`)

  // ── **ふだんは通信が1回も増えない**
  ok(pickPromotions([row({ learn_streak: 0 })], {}).length === 0,
    '送る文が無い日は、1件も選ばない(窓口を呼ぶ前に終わる)')

  // ── 実データ(コロケーションの 50 件)で確かめる
  const colRaw = (await import('../src/lib/../data/collocations.js'))
    .collocationRows([], { today: '2026-09-15' })
  const colGrown = colRaw.map((r) => ({ ...r, learn_streak: PROMOTE_KNOWN_AFTER }))
  const colPick = pickPromotions(colGrown, { max: colGrown.length })
  ok(colPick.length > 20, `コロケーションの例文も送れる(${colPick.length} / ${colGrown.length})`)
  ok(colPick.every((p) => p.norm.split(' ').length >= 3), '送るのは、どれも3語以上の文')
  ok(pickPromotions(colRaw, { max: colRaw.length }).length === 0,
    '育っていないうちは、1文も送らない(**開いた瞬間に流し込まない**)')

  // ── 数を2か所に書かない
  const voc = noNote(readD('src/lib/vocab.js'))
  ok(/export \{ KNOWN_AFTER \} from '\.\/qrPromote\.js'/.test(voc),
    '`KNOWN_AFTER` の出どころは `qrPromote.js` 1か所')
  ok(!/KNOWN_AFTER = \d/.test(voc), '`vocab.js` が数そのものを持っていない')

  // ── 表への入れ方。**ここに、いちばん危ないものが2つある**
  const qrSrc = readD('src/lib/qrReviews.js')
  const qr = noNote(qrSrc)
  ok(/export async function promoteGrownWords/.test(qr), '送る窓口が在る')
  ok(/pickPromotions\(/.test(qr), '誰を送るかは `qrPromote.js` に任せている')
  const body = qr.slice(qr.indexOf('export async function promoteGrownWords'))
  /* ① **`mark_qr()` を通さない。** あれは「まだ」で呼ぶと
     `qr_days.answered` を1つ増やすので、ゲストが1問も答えていないのに
     **その日の取り組みの数が水増しされる**(記録を黙って汚す) */
  ok(!/markQr\(/.test(body),
    '**`mark_qr()` を通していない**(通すと、答えていない数が記録に足される)')
  /* ② **すでに在る行に触らない。** 触ると箱も回数も 0 に戻る */
  ok(/ignoreDuplicates: true/.test(body),
    '**すでに溜まっている文には1文字も触らない**(触ると進み具合が 0 に戻る)')
  ok(/onConflict: 'learner_id,en_norm'/.test(body),
    '重なりの見分けは、表の一意の決まりと同じ鍵で見ている')
  /* **既定値に任せる。** 書き写すと 0040 を変えた日に片方だけ古くなる */
  ok(!/\bbox:|\blearn_streak:|\bdue_on:|\bstatus:/.test(body),
    '箱・回数・出す日・状態を書き写していない(0040 の既定値に任せる)')
  ok(/\.select\('en_norm'\)/.test(body),
    '**実際に入ったぶんだけ**数えている(数え方を2通り持たない)')

  // ── 画面が呼んでいるか
  const wb = noNote(readD('src/components/Wordbook.jsx'))
  ok(/promoteGrownWords\(/.test(wb), '単語帳が、その窓口を呼んでいる')
  ok(/if \(learnerId\) return/.test(wb),
    '**ゲスト本人の単語帳のときだけ送る**(トレーナーが見ただけで増やさない)')
  ok(/promoted\?\.sent > 0/.test(wb), '送ったときだけ、画面に1行出す(黙って足さない)')
  ok(/setPromoted\(null\)/.test(wb), '読み直すたびに数え直す(前の知らせを持ち越さない)')
  const css = readD('src/styles.css')
  const pro = css.match(/\.wb-promoted \{[^}]*\}/)?.[0] ?? ''
  ok(/border:/.test(pro) && /background:/.test(pro),
    '知らせが色だけに頼っていない(枠線 + 地色)')
}

/* ══════════════════════════════════════════════════════════════════════
   Native Flow を Unit ごとに / 指定したゲストにだけ(2026-09 利用者の指定)

     > UNIT毎に分けて quick response が出来るようにしてください。
     > そして、これも指定したゲストだけに届くように、
     > トレーナーにはデフォルトで表示されるように

   **いちばん危ないのは「出しすぎ」である。**
   指定していない Unit がゲストに出てしまうと、
   **こちらが決めた配布の約束を、こちらで破る。**
   だから「出る」と「出ない」の両方を、役割ごとに見る。
   ══════════════════════════════════════════════════════════════════════ */
{
  console.log('\n▶ Native Flow の Unit と、その配布')
  const readD = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')
  const noNote = (src) => src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1 ')

  // ── Unit ごとに分ける
  const all = nativeFlowRows()
  ok(all.length === 690, `Unit を渡さなければ、これまでどおり 690 問(${all.length})`)
  /* **数を書き写さない。** 原本が持っている数(`u.n`)と突き合わせる */
  let sum = 0
  for (const u of NATIVE_FLOW_UNITS) {
    const rows = nativeFlowRows([], { units: [u.id] })
    sum += rows.length
    ok(rows.length === u.n,
      `Unit ${u.id} … 原本の数だけ出る(${rows.length} / ${u.n})`)
    ok(rows.every((r) => r.material_title.includes(`Unit ${u.id}`)),
      `Unit ${u.id} … ほかの Unit の問が混ざっていない`)
  }
  ok(sum === all.length, `Unit を足すと、ぜんぶと同じ数になる(${sum} / ${all.length})`)
  ok(nativeFlowRows([], { units: [2, 5] }).length
     === NATIVE_FLOW_UNITS.filter((u) => [2, 5].includes(u.id)).reduce((n, u) => n + u.n, 0),
    '2つえらべば、その2つぶんだけ出る')
  ok(nativeFlowRows([], { units: [] }).length === 0, '1つも選ばなければ、0 問(黙って全部出さない)')
  ok(nativeFlowRows([], { units: [99] }).length === 0, '知らない Unit を渡しても、何も出ない')

  // ── 名前の作り方(`learner_features` に入れる名前)
  ok(nfFeature(3) === 'nf:3', '名前は `nf:<Unit の番号>`(棚の `shelf:` と同じ入れ物)')
  ok(nfUnitOfFeature(nfFeature(3)) === 3, '名前から Unit に戻せる')
  ok(nfFeature(0) === null && nfFeature(99) === null,
    '知らない Unit には名前を作らない(当てずっぽうで返さない)')
  ok(nfUnitOfFeature('shelf:it') === null && nfUnitOfFeature('basics') === null,
    'ほかの名前(棚・講座)を Unit と取り違えない')

  // ── **誰に出るか。** 出る側と出ない側の両方を見る
  const T = { role: 'trainer' }
  const O = { role: 'owner' }
  const G = (list) => ({ role: 'learner', features: new Set(list.map(nfFeature)) })
  ok(nfUnitsFor(T).length === NATIVE_FLOW_UNITS.length,
    '**トレーナーには、指定がなくてもぜんぶ出る**(利用者の指定)')
  ok(nfUnitsFor(O).length === NATIVE_FLOW_UNITS.length, '管理者にもぜんぶ出る')
  ok(nfUnitsFor(G([])).length === 0,
    '**ゲストには、出していなければ1つも出ない**(指定したゲストだけに届く)')
  ok(nfUnitsFor(G([2, 5])).map((u) => u.id).join(',') === '2,5',
    'ゲストには、出した Unit だけが出る')
  ok(showsNfUnit(G([2, 5]), 2) === true && showsNfUnit(G([2, 5]), 3) === false,
    '出した Unit は出て、出していない Unit は出ない')
  ok(nfUnitsFor({}).length === 0,
    '**役割が分からないうちは出さない**(読み込みの途中・引けなかったとき)')
  ok(nfUnitsFor({ role: 'learner' }).length === 0, '控えが読めていないゲストにも出さない')
  /* **棚とはわざと違う。** あちらは役割を見ない(2026-09 の方針転換)。
     ここで寄せると、利用者の指定「トレーナーにはデフォルトで表示される」を破る */
  const shSrc = noNote(readD('src/data/shelves.js'))
  ok(/export function showsShelf/.test(shSrc) && !/role !== 'learner'/.test(shSrc),
    '棚は役割を見ないまま(寄せたついでに直していない)')

  // ── 並びを勝手に変えない
  ok(NATIVE_FLOW_UNITS.map((u) => u.id).join(',') === '1,2,3,4,5,6',
    'Unit の並びは原本のまま(並べ替えは減らすに当たる)')

  // ── 画面が呼んでいるか
  const qrSrc = noNote(readD('src/components/QrReview.jsx'))
  ok(/NativeFlowUnits/.test(qrSrc), 'Quick Response 帳が Unit の切り替えを出している')
  /* 第5.167節で**本棚の行の中**へ移した(`bookSub`)。
     条件は `nfBook && (` から `nfBook ? (` に変わったが、
     **「その冊を開いているときだけ」という決まりは1つも変えていない** */
  ok(/const bookSub = nfBook \? \(/.test(qrSrc),
    '**Native Flow を開いているときだけ**出す(効かない操作を見せない)')
  ok(/NF_UNIT_KEY/.test(qrSrc) && !/eas\.nfUnit/.test(qrSrc),
    '覚えておく鍵の名前を、画面に書き写していない')
  ok(/nfUnits\.some\(\(u\) => u\.id === unitWanted\)/.test(qrSrc),
    '**出せなくなった Unit は黙って落ちる**(見えない問が出題に混ざらない)')

  const appSrc = noNote(readD('src/App.jsx'))
  ok(/nfUnitsFor\(\{ role: profile\?\.role \?\? null, features \}\)/.test(appSrc),
    '誰に出すかの判断は `nfUnitsFor()` 1か所(画面で役割を見ない)')

  const tlSrc = noNote(readD('src/components/TrainerLearners.jsx'))
  /* **第5.186節で `AssignShelf` に寄せた。** Unit の札はその中にある */
  ok(/<AssignShelf[\s/>]/.test(tlSrc) && /units=\{NATIVE_FLOW_UNITS\}/.test(tlSrc),
    'ゲストのページに、Unit を出す欄が在る')
  /* **ユニット毎にも、丸ごとにも**(2026-09 利用者の指定)。
     1つずつ押すと6回かかるので、「ぜんぶ渡す」を1回で済ませる */
  ok(/onAll=\{\(on\) => setNfAll\(l, on\)\}/.test(tlSrc),
    'ゲストのページから、丸ごと出す / 外すができる')
  ok(/const setNfAll = async/.test(tlSrc), '丸ごとの窓口が在る')
  const bulk = tlSrc.slice(tlSrc.indexOf('const setNfAll = async'))
    .slice(0, tlSrc.slice(tlSrc.indexOf('const setNfAll = async')).indexOf('const changeCefr'))
  /* **`toggleFeature()` を6回呼ばない。** あれは押すたびに `features` を
     見て向きを決めるので、続けて呼ぶと2回目以降が逆向きに倒れる */
  ok(!/toggleFeature\(/.test(bulk),
    '丸ごとは `toggleFeature()` を繰り返し呼んでいない(向きが逆に倒れる)')
  /* **第5.181節で `nfAllTodo()` へ移した**(配る場所が2つになったため)。
     中身そのものは `npm run test:play` の第5.181節の節が呼んで確かめている */
  ok(/nfAllTodo\(features, on\)/.test(bulk),
    'すでにその向きの Unit には、窓口を呼ばない(変えていないものを書き直さない)')
  ok(/done \+= 1/.test(bulk),
    'どこまで通ったかを数えている(途中で断られても黙って落ちない)')
  const nfaJsx = noNote(readD('src/components/NativeFlowAssign.jsx'))
  ok(/units\.reduce\(/.test(nfaJsx),
    '「ぜんぶ」の問数は数えて出す(Vol.2 で増えても、ひとりでに合う)')
  ok(/n > 0 && \(/.test(nfaJsx),
    '「ぜんぶ外す」は、出しているときだけ出す(効かない操作を見せない)')
  ok(/onAll = null/.test(nfaJsx), '丸ごとの行も、渡されなければ出ない')
  ok(/nfFeature\(u\.id\)/.test(tlSrc),
    "名前の作り方は `nfFeature()` 1か所(`'nf:' + id` と書いていない)")
  ok(!/'nf:'/.test(tlSrc + qrSrc + appSrc), 'どの画面も名前を組み立てていない')
  /* **読み込みの行ではなく、置いてある場所**で見る。
     `indexOf('NativeFlowAssign')` だと、いちばん上の `import` に当たって
     必ず手前になる(**測り方が違うと、壊れていなくても赤くなる**) */
  ok(/detailTab === 'qr'/.test(tlSrc) && tlSrc.indexOf('group="qr"')
     > tlSrc.indexOf("detailTab === 'qr'"),
    '置き場所は Quick Response のタブ(出した結果がすぐ下にある)')
  ok(/set_learner_feature|toggleFeature/.test(tlSrc),
    '窓口は 0055 の `set_learner_feature()` のまま(新しい窓口を作っていない)')

  // ── **部品は props だけで描ける**(描けないものは測れない)
  const unitsJsx = noNote(readD('src/components/NativeFlowUnits.jsx'))
  const assignJsx = noNote(readD('src/components/NativeFlowAssign.jsx'))
  ok(!/supabase|useState|useEffect|load[A-Z]/.test(unitsJsx + assignJsx),
    '2つとも、自分では何も読み込まない(骨組みでそのまま描ける)')
  ok(/if \(!units\.length\) return null/.test(unitsJsx),
    '出す Unit が無ければ、欄ごと出さない')
  const screens = noNote(readD('src/__screens.jsx'))
  /* **練習で選ぶ Unit(`NativeFlowUnits`)と、出す Unit(`AssignShelf`)は
     別のものである。** 骨組みは2つとも描く —— 片方だけだと、
     どちらかを壊しても緑のままになる */
  ok(/NativeFlowUnits/.test(screens) && /<AssignShelf[\s/>]/.test(screens),
    '骨組みが2つとも描いている(`?screen=nfunits` / `?screen=assign`)')

  // ── **貼る SQL は1つも増えていない**(入れ物は 0055 のまま)
  const check = readD('supabase/apply/check.sql')
  ok(!/nf_units|native_flow/i.test(check),
    '新しい表も関数も作っていない(check.sql に足すものが無い)')
}

/* ══════════════════════════════════════════════════════════════════════
   パタプラ風の「言う練習」(2026-09 利用者の指定)

     > quick response を、特に「パタプラのようにしたいです。」

   **いちばん危ないのは「いままでの聞き流しが変わってしまう」ことである。**
   読み方を足しただけのつもりが、既定(英語だけ)の並びまで動いていたら、
   **毎日使っている人の耳が、黙って変わる。**
   だから「足したもの」と同じだけ「変えていないもの」を見る。
   ══════════════════════════════════════════════════════════════════════ */
{
  console.log('\n▶ パタプラ風の「言う練習」')
  const readD = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')
  const noNote = (src) => src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1 ')

  const LONG = 'If you think you are going to be late for the meeting, '
    + 'please let us know as early as you can.'
  const SHORT = 'Absolutely.'
  const JA = '締め切りが厳しくても、できるだけ早く知らせてください。'
  const row = (o = {}) => ({ en: LONG, ja: JA, box: 0, ...o })
  const GAP = 2000
  const g = radioGapsOf(GAP)

  // ── 読み方の一覧
  ok(QR_RADIO_MODES.length === 4,
    `Quick Response の読み方が4つある(${QR_RADIO_MODES.map((m) => m.id).join('/')})`)
  ok(QR_RADIO_MODES[0].id === 'en', '**いちばん上はこれまでの「英語だけ」**(既定を変えていない)')
  /* **単語帳は1ドットも変えていない。** 言われたのは Quick Response である */
  ok(RADIO_MODES.length === 1 && RADIO_MODES[0].id === 'en',
    '単語帳の読み方は「英語だけ」のまま(言われた場所だけを直す)')
  ok(new Set(QR_RADIO_MODES.map((m) => m.id)).size === QR_RADIO_MODES.length,
    '同じ id の読み方が2つ無い')

  // ── **これまでの聞き流しが、1ミリも変わっていない**
  const before = radioSteps(row(), 'en', GAP)
  ok(before.length === 3 && before[0].kind === 'en' && before[1].kind === 'wait'
    && before[2].kind === 'en' && before[1].ms === g.repeat,
    '**「英語だけ」の並びは、これまでと1つも違わない**(英語 → くり返しの間 → 英語)')
  ok(!before.some((st) => st.you), '「英語だけ」には「言う番」が無い(聞くだけの練習のまま)')
  ok(radioSteps(row(), 'しらない読み方', GAP).length === before.length,
    '知らない読み方は、既定に落ちる(行き止まりを作らない)')

  // ── ① 言う練習(訳 → 言う番 → 答え)
  const say = radioSteps(row(), 'say', GAP)
  ok(say[0].kind === 'ja' && say[0].text === JA,
    '**訳から始まる**(2026-09 利用者の指定・パタプラは音声完結)')
  ok(say[1].kind === 'wait' && say[1].you === true,
    '**訳のつぎは「言う番」**(答えを先に鳴らすと、ただのリピートになる)')
  ok(say.filter((st) => st.kind === 'en').length === 2, '答えは2回鳴る')
  ok(say[1].ms === g.recall, '「言う番」の長さは、ゲストが選んだ「考える間」')
  ok(say.filter((st) => st.kind === 'ja').length === 1, '訳は1回だけ鳴る')
  /* **訳が無い問でも落ちない。** 空を鳴らそうとすると、窓口が断って
     端末の声へ落ちる道に入る(そこが、外したはずのものである) */
  const noJa = radioSteps({ en: 'Sure.', box: 1 }, 'say', GAP)
  ok(!noJa.some((st) => st.kind === 'ja'), '訳が無ければ、訳は鳴らさない')
  ok(noJa[0].kind === 'wait' && noJa[0].you === true, '訳が無ければ、言う番から始まる')

  // ── ② チャンクで積む
  const ch = radioSteps(row(), 'chunk', GAP)
  ok(ch[0].kind === 'ja',
    '**かたまりで積むときも、訳から**(何を言うのか分からないままでは音真似になる)')
  const chunks = ch.filter((st) => st.kind === 'chunk')
  ok(chunks.length >= 3, `かたまりに割れている(${chunks.length} かたまり)`)
  /* **約束できることだけを見る**(CLAUDE.md「当てられることだけを見る」)。
     パタプラのかたまりは 2〜8語だが、**上は約束できない** ——
     区切りはスラッシュリーディングが決めており、長い節は長いままである。
     **下は約束できる**(1語のかたまりは、となりへ寄せてある) */
  ok(chunks.every((st) => st.text.split(' ').length >= 2),
    '**1語だけのかたまりを作らない**(1語では言い直す単位にならない)',
    chunks.map((st) => st.text.split(' ').length).join(','))
  ok(ch[ch.length - 1].kind === 'en' && ch[ch.length - 3].kind === 'en',
    '**最後は1文まるごと**(積み上げて終わる)')
  ok(chunks.map((st) => st.text).join(' ') === LONG,
    'かたまりを足すと、もとの文に戻る(**1語も落としていない**)')
  /* **「言う番」は、どれも同じ長さ。** 4〜8語のかたまりを
     「語と語のあいだ」(既定 268ms)で言い直させていた、を直した回 */
  ok(ch.filter((st) => st.you).every((st) => st.ms === g.recall),
    '**かたまりのあとの「言う番」も「考える間」**(短い間では言い直せない)')
  /* **割れない文は、1文まるごとに落ちる**(同じ音が3回続かない) */
  ok(radioSteps(row({ en: SHORT }), 'chunk', GAP)
    .every((st) => st.kind !== 'chunk'),
  '割れない短い文は、かたまりにしない')

  /* **実データで数える。** 1文だけ見ても「たまたま合っていた」が分からない */
  {
    const ens = [...NATIVE_FLOW.map((x) => x.en),
      ...FRAME_SECTIONS.flatMap((sec) => sec.groups.flatMap((gr) => gr.rows.map((r) => r.ex)))]
    const sizes = []
    let broken = 0
    let split = 0
    for (const en of ens) {
      const cs = drillChunks(en)
      if (!cs.length) continue
      split += 1
      if (cs.join(' ') !== en.trim().replace(/\s+/g, ' ')) broken += 1
      for (const c of cs) sizes.push(c.split(' ').length)
    }
    ok(split > 100, `実データで、かたまりに割れる文がある(${split} 文 / ${ens.length} 文)`)
    ok(broken === 0, '**どの文も、かたまりを足せばもとに戻る**(1語も落としていない)')
    ok(Math.min(...sizes) >= 2, `1語のかたまりが1つも無い(いちばん短くて ${Math.min(...sizes)} 語)`)
    /* **ほとんどが 8語以下**(パタプラの粒度)。**割合で見る** ——
       ぴったりの数を書き写すと、文を足した日に期待値も一緒に動く */
    ok(sizes.filter((n) => n <= 8).length > sizes.length * 0.9,
      `かたまりのほとんどが8語以下(${(sizes.filter((n) => n <= 8).length / sizes.length * 100).toFixed(1)}%)`)
  }

  // ── ③ Type A → Type B(箱で切り替える)
  ok(radioSteps(row({ box: 0 }), 'step', GAP).some((st) => st.kind === 'chunk'),
    '**まだ言えていない文(箱0)は、かたまりから**(Type A)')
  ok(!radioSteps(row({ box: 1 }), 'step', GAP).some((st) => st.kind === 'chunk'),
    '**一度言えた文(箱1以上)は、1文まるごと**(Type B)')
  ok(!radioSteps(row({ box: 6 }), 'step', GAP).some((st) => st.kind === 'chunk'),
    '進んだ文も1文まるごと')

  /* ── **訳を読むのは、窓口の声だけ。端末の声には二度と戻さない** ──
     2026-09 に外したのは端末の声のほうで、そこは戻していない */
  ok(!radioSteps(row(), 'en', GAP).some((st) => st.kind === 'ja'),
    '**聞き流し(英語だけ)には、訳の段が1つも無い**(1ミリも変えていない)')
  ok(['enja', 'jaen', 'でたらめ', undefined]
    .flatMap((m) => radioSteps(row(), m, GAP))
    .every((st) => st.kind !== 'ja'),
  '端末に残った古い値(`enja` / `jaen`)でも、訳は鳴らない')
  ok(JA_VOICE === 'ja-1' && elevenIdOf(JA_VOICE).length > 10,
    `訳を読む声に Voice ID が入っている(${elevenIdOf(JA_VOICE).slice(0, 6)}…)`)
  /* **英語の声を選ぶ画面には、1つも出てはいけない** ——
     出ると、日本語の声が英文を読む教材が作れてしまう */
  ok(!CLIP_ACCENTS.some((a) => a.id === 'ja'), '訛りの一覧に `ja` を足していない')
  ok(!accentsWithVoices().flatMap((a) => voicesOfAccent(a.id)).some((v) => v.id === JA_VOICE),
    '**訳の声は、どの訛りの選択肢にも出ない**(英文を読ませない)')
  ok(!accentsWithVoices('narration').flatMap((a) => voicesOfAccent(a.id, 'narration'))
    .some((v) => v.id === JA_VOICE), 'ナレーションの選択肢にも出ない')
  const ra = noNote(readD('src/lib/readAloud.js'))
  ok(/clipOnly = false/.test(ra), '**端末の声に落とさない**道は、渡されたときだけ効く(既定は落とす)')
  ok(/if \(clipOnly\) \{/.test(ra), '落とさないと言われたら、鳴らさずに終える')
  const rj0 = noNote(readD('src/components/WordRadio.jsx'))
  ok(/clipOnly: true/.test(rj0) && /clipVoice: JA_VOICE/.test(rj0),
    '訳は `JA_VOICE` で読み、端末の声には落とさない')
  ok(!/'ja-1'/.test(rj0), "画面に声の id を書き写していない(`'ja-1'` と書かない)")
  ok(/clipTier: PREMIUM/.test(rj0),
    '訳は良い段で頼む(標準の段に落とすと、代役の英語の声になる)')

  // ── 答えを隠すか。**「出る」と「出ない」の両方**
  ok(hidesAnswer('say') && hidesAnswer('chunk') && hidesAnswer('step'),
    '言う練習では、答えを先に見せない')
  ok(!hidesAnswer('en'), '**聞き流し(英語だけ)では、これまでどおり見せる**')

  // ── 押す前に、何が起きるかを言う
  const leads = ['en', 'say', 'chunk', 'step'].map((m) => radioLead(m))
  ok(new Set(leads).size === leads.length, '読み方ごとに、違う説明が出る')
  ok(leads.every((t) => t.length > 10), 'どの読み方にも説明がある(黙って始めない)')

  // ── かたまりの割り方は `chunker.js` 1か所
  ok(drillChunks(SHORT).length === 0, '割れない文は、かたまりを返さない')
  ok(drillChunks('').length === 0, '空の文でも落ちない')
  const wr = noNote(readD('src/lib/wordRadio.js'))
  ok(/slashesFor\(en, 'middle'\)/.test(wr),
    'かたまりはスラッシュリーディングの「中級」から作る(割り方を2つ持たない)')
  ok(!/\bsplit\(\/\[,\.\]/.test(wr), '自前で文を切り直していない')

  // ── 型でまとめる(パターンプラクティスの芯)
  ok(QR_ORDERS.some((o) => o.id === 'frame'), '並べ方に「型でまとめる」が在る')
  const mixed = [
    { en: 'Poor planning leads to delays.', added_at: '1' },
    { en: 'Sure.', added_at: '2' },
    { en: 'This tool allows you to share files instantly.', added_at: '3' },
    { en: 'The new system allows staff to book rooms online.', added_at: '4' },
    { en: 'Totally.', added_at: '5' },
  ]
  const byFrame = orderQrPairs(mixed, 'frame')
  ok(byFrame.length === mixed.length, '並べ替えても、1つも落ちない(黙って消さない)')
  const forms = byFrame.map((r) => frameFormOf(r.en))
  const allowAt = forms.map((f, i) => (f === 'S allows 人 to do' ? i : -1)).filter((i) => i >= 0)
  ok(allowAt.length === 2 && allowAt[1] - allowAt[0] === 1,
    '**同じ型は、となりどうしに並ぶ**(型を固定して、中身だけ入れ替える)')
  ok(forms[forms.length - 1] === null && forms[forms.length - 2] === null,
    '型を言い当てられなかった文は、**後ろにまとめる**(落とさない)')
  ok(orderQrPairs(mixed, 'material').length === mixed.length,
    'ほかの並べ方は、これまでどおり')

  // ── 画面が呼んでいるか
  const rj = noNote(readD('src/components/WordRadio.jsx'))
  ok(/hidesAnswer\(mode\)/.test(rj), '画面が `hidesAnswer()` を呼んでいる(判断を書き写さない)')
  ok(/radioLead\(mode\)/.test(rj), '説明も読み方から出している')
  ok(/setLine\(st\.text\)/.test(rj),
    '**鳴っているものを、そのまま画面に出す**(かたまりのときはかたまり)')
  ok(/setLine\(null\); setOpen\(false\)/.test(rj),
    '問が変わったら答えを閉じる(前の答えが残らない)')
  ok(/st\.you \? 'you' : null/.test(rj),
    '「言う番」を画面に出している(黙って止まらない)')
  const qv = noNote(readD('src/components/QrReview.jsx'))
  ok(/言う練習・聞き流し/.test(qv),
    '入口の名前が中身と合っている(聞き流しだけの場所ではなくなった)')
  const css = readD('src/styles.css')
  const you = css.match(/\.radio-en--you \{[^}]*\}/)?.[0] ?? ''
  ok(/border:/.test(you) && /background:/.test(you),
    '「言う番」の1行が色だけに頼っていない(枠線 + 地色)')
}

/* ══════════════════════════════════════════════════════════════════════
   **開いたらすぐ始まる**(第5.167節・2026-09 利用者の提案)

     > quick response と単語帳は、トップ画面をなくしませんか?
     > サイドバーや下のタブからクリックしたらすぐに実際のトレーニングの
     > 画面に飛び、その画面にメニューを足す。

   ここで見るのは、**黙って落ちやすいもの**である。

   ①「開いた瞬間に1問目」が**本当に自動で走るか**
   ② 帯に**冊名が出ているか**(冊を間違えたまま進むのがいちばん怖い)
   ③ 移した道具(聞き流す・紙に出す)が**設定の中に残っているか**
   ④ **やりかけを持ち越さない**(冊を変えたら捨てる)
   ⑤ とじたときの**行き先があるか**(行き止まりを作らない)

   **「出る」と「出ない」の両方を見る**(CLAUDE.md)——
   一度しか走らない印(`started`)が無ければ、とじた人を押し戻してしまう。
   ══════════════════════════════════════════════════════════════════════ */
{
  console.log('\n▶ 単語帳と Quick Response は、開いたらすぐ始まる(5.167)')
  const readD = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')
  const noNote = (src) => src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1 ')
  /* **コメントを落としてから、使っている形で数える**(CLAUDE.md)——
     説明にも同じ語が出るので、名前が出てくるかでは見ない */
  const wb = noNote(readD('src/components/Wordbook.jsx'))
  const qr = noNote(readD('src/components/QrReview.jsx'))
  const app = noNote(readD('src/App.jsx'))
  const pick = noNote(readD('src/components/BookPick.jsx'))
  const shelf = noNote(readD('src/components/BookShelf.jsx'))
  const prog = noNote(readD('src/components/Progress.jsx'))
  const scope = noNote(readD('src/components/ReviewScope.jsx'))

  // ── ① 開いた瞬間に1問目 ────────────────────────────────
  /* **印の名前は `opened` に変わった**(第5.172節)。
     「始めたか」だと、**1問も無くて始められなかったとき**に立たず、
     開くときの帯(`Loading`)が永遠に出たままになる。
     **決まりは1つも変えていない** —— 一度だけ走り、とじた人を押し戻さない */
  ok(/if \(!isQuiz \|\| loading \|\| opened\) return/.test(wb),
    '単語帳が、開いていなければ自分で始める(設定の画面を通らない)')
  ok(/if \(busy \|\| opened\) return/.test(qr),
    'Quick Response が、開いていなければ自分で始める')
  /* **一度しか走らない**。これが無いと、「とじる」で一覧へ戻った人を
     そのまま押し戻す(**行き止まりの反対で、出口が無くなる**) */
  ok(/const \[opened, setOpened\] = useState\(false\)/.test(qr),
    'Quick Response が「開くときの判断が済んだか」を持っている(押し戻さない)')
  /* **2つの `if` を1つにまとめた**(第5.173節)。出すものが無いときは
     一覧へ戻すので、同じ枝になった —— 決まりは1つも変えていない */
  ok(/if \(!rowsRef\.current\.length \|\| poolNow\(\)\.length === 0\)/.test(wb),
    '1語も無ければ入らない(空の画面をそのまま使う)')
  ok(/if \(shown\.length === 0\) \{/.test(qr),
    '1問も無ければ入らない(同上)')

  // ── ② 帯に冊名 ──────────────────────────────────────────
  /* **「出る」と「出ない」の両方**。`bookPick` が1か所で作られ、
     **始める前と帯の2か所で使われている**ことを数える ——
     数えないと、どちらか片方だけに出す形に書き換えても緑のままになる */
  ok((wb.match(/\{bookPick\}/g) ?? []).length >= 2,
    '単語帳の冊名が、始める前と復習の帯の両方に出る(書き写さず1つを使い回す)')
  ok((qr.match(/\{bookPick\}/g) ?? []).length >= 3,
    'Quick Response の冊名が、3つの画面すべてに出る(Supabase 未設定の画面も)')
  ok(/const bookPick = \(\s*<BookPick/.test(wb) && /const bookPick = \(\s*<BookPick/.test(qr),
    '冊をえらぶ部品は1つ(`BookPick`)—— 呼び名を2か所に書かない')
  ok(!/chiprow wb-books/.test(wb) && !/chiprow wb-books/.test(qr),
    '横に並べる古い札は残っていない(同じことをするものを2つ見せない)')

  // ── 本棚そのもの ────────────────────────────────────────
  ok(/if \(books\.length < 2\) return null/.test(shelf)
    && /if \(books\.length < 2\) return null/.test(pick),
    '冊が1つなら、えらぶ場所を出さない(効かない操作を見せない)')
  ok(/aria-current=\{on \? 'true' : undefined\}/.test(shelf)
    && /\{on \? '●' : '○'\}/.test(shelf),
    'いま開いている冊を、色だけに頼らずに示す(印 + `aria-current`)')
  ok(/Number\.isFinite\(n\)/.test(shelf),
    '数えられなかった冊に `0 語` と書かない(0 と null を取り違えない)')

  // ── ③ 移した道具 ────────────────────────────────────────
  ok(/tools = null,/.test(scope) && /<p className="rscope-head">ほかの道具<\/p>/.test(scope),
    '「出しかた」が、ほかの道具を預かれる(渡さなければ段ごと出ない)')
  /* **作る形(`const toolsBox =`)は数えない。使う形だけを数える** ——
     数え方が1つだと、置き場所を1つ減らしても緑のままになる */
  const uses = (src) => (src.match(/toolsBox/g) ?? []).length - 1
  ok(/const toolsBox = \(/.test(wb) && uses(wb) >= 2,
    '単語帳の聞き流す・紙に出すが、始める前と設定の中の両方にある(1か所から描く)')
  ok(/const toolsBox = \(/.test(qr) && uses(qr) >= 2,
    'Quick Response も同じ(黙って落とさない)')

  // ── ④ やりかけを持ち越さない ────────────────────────────
  ok(/const dropRun = \(\) => \{/.test(wb) && /setStarted\(false\)/.test(wb),
    '単語帳が、冊を変えたらやりかけを捨てて、新しい冊の1問目を出す')
  ok(/const dropRun = \(\) => \{[\s\S]*?setOpened\(false\)[\s\S]*?\}/.test(qr),
    'Quick Response も同じ(4か所に書き写さない)')

  // ── ⑤ とじたときの行き先 ────────────────────────────────
  ok(/onClose = null,/.test(wb) && /onClose = null,/.test(qr),
    '2つとも、とじたときの行き先を受け取れる(渡さなければ一覧へ戻る)')
  /* **数える。**「1つでもあるか」で見ると、**片方を消しても緑のまま**に
     なる —— 単語帳のとじる口は**2つ**ある(復習の帯と、終わりの1枚) */
  ok((wb.match(/onClose \? onClose\(\) : setRunning\(false\)/g) ?? []).length === 2,
    '単語帳の2つのとじる口が、どちらも渡された行き先へ行く')
  ok(/onClose\?\.\(\)/.test(qr),
    'Quick Response の「おわる」も同じ')
  ok((app.match(/onClose=\{\(\) => setView\('progress'\)\}/g) ?? []).length === 2,
    '自分の単語帳と Quick Response の行き先が、どちらも達成具合')
  ok(/id: 'progress', label: '達成具合'/.test(app),
    '左メニューに「達成具合」が1行ある')
  ok(!/'progress'/.test(app.match(/const TAB_IDS = [\s\S]*?\n\n/)?.[0] ?? ''),
    '下の帯は4つのまま(利用者が決めている)')
  /* **ここも数える。** 達成具合の画面は2つある(Supabase が設定されている
     ときと、されていないとき)。**どちらにも戻る道を置く** */
  ok(/function Practice\(\{ onGo \}\)/.test(prog)
    && (prog.match(/<Practice onGo=\{onGo\} \/>/g) ?? []).length === 2,
    '達成具合の2つの画面の、どちらからも練習へ戻れる(行き止まりを作らない)')
  ok(/status: null, limit: 1000/.test(prog),
    '達成具合は段ごと読む(`todo` だけだと「できた」がいつでも 0 になる)')
  /* **もう1つの「0 と null を取り違えない」。** 0040 を貼っていない
     Supabase では `loadQrReviews()` が**黙って空の一覧を返す**ので、
     そのまま数えると「まだ 0 / 練習中 0 / できた 0」と出て、
     **やり切ったように見える** */
  ok((prog.match(/qrReviewSupported\(\)/g) ?? []).length >= 2,
    '入れ物(0040)が無いときは、数えずにそう言う(0 と嘘をつかない)')
  /* `tip` は**説明を畳む印**(第5.166節)であって、数に付けるものではない。
     じっくり見るためのページなのに、いちばん見たい「◯週つづけて」が
     既定で畳まれていた */
  ok(/\{weekLine\(week\) && </.test(prog) && !/"tip[^"]*">\{weekLine/.test(prog),
    '続けた記録を畳まない。1日も記録が無ければ、行ごと出ない')
}

/* ══════════════════════════════════════════════════════════════════════
   **左上は ☰。開くときは帯1本**(第5.172節・2026-09 利用者の指定)

     > quick response も単語帳も左上は閉じる「❌」ボタンではなく、
     > 他のところと同じくハンバーガーをおいてサイドバーが出せるように
     > してください。それから、単語帳と quick response を開く際に、
     > 変な画面切り替えが出ないよう、ローディングバーでスタイリッシュに
     > してください。聞き流しの時も左上にはバーガーです。

   ここで見るのは、**黙って壊れやすいもの**である。

   ①「渡されたときだけ ☰」になっているか(**両方を見る**)
   ② 教材の中の集中モードは**✕ のまま**か(あちらの ✕ には行き先がある)
   ③ 聞き流しに**やめる道が残っているか**(☰ だけにすると戻れない)
   ④ 判断が済むまで**帯1本**か。**1問も無い帳面で止まらないか**
   ⑤ メニューが**集中している画面の上に出る**か(z-index)
   ⑥ PC の柱を**たたんでしまわない**か
   ══════════════════════════════════════════════════════════════════════ */
{
  console.log('\n▶ 左上は ☰。開くときは帯1本(5.172)')
  const readD = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')
  const noNote = (src) => src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1 ')
  const css = (src) => src.replace(/\/\*[\s\S]*?\*\//g, ' ')
  const frame = noNote(readD('src/components/FocusFrame.jsx'))
  const wb = noNote(readD('src/components/Wordbook.jsx'))
  const qr = noNote(readD('src/components/QrReview.jsx'))
  const radio = noNote(readD('src/components/WordRadio.jsx'))
  const app = noNote(readD('src/App.jsx'))
  const nav = noNote(readD('src/components/AppNav.jsx'))
  const sheetSrc = noNote(readD('src/components/ReviewScope.jsx'))
  const st = css(readD('src/styles.css'))

  // ── ① 渡されたときだけ ☰(「出る」と「出ない」の両方) ──────
  ok(/onMenu = null,/.test(frame)
    && /onMenu \? \([\s\S]{0,200}?focus-burger/.test(frame),
    '集中モードの左上は、☰ を渡されたときだけ ☰ になる')
  ok(/<CloseIcon \/><span className="wide-text">閉じる<\/span>/.test(frame),
    '渡されなければ、これまでどおり ✕ 閉じる(行き先のある画面は変えない)')
  /* **3か所とも数える。** 1つでもあるかで見ると、
     **どれか1つに付け忘れても緑のまま**になる */
  ok(/onMenu = null,/.test(wb) && (wb.match(/focus-burger/g) ?? []).length === 2,
    '単語帳の2つの帯(復習と、終わりの1枚)が、どちらも ☰ になる')
  ok(/onMenu = null,/.test(qr) && /onMenu=\{onMenu\}/.test(qr),
    'Quick Response も ☰ を受け取って、集中モードへ渡している')
  ok(/onMenu = null,/.test(radio) && /onMenu=\{onMenu\}/.test(radio),
    '聞き流しも ☰ を受け取っている(利用者の指定)')
  /* **聞き流しには、単語帳と Quick Response の両方から入る。**
     片方だけ渡すと、そちらからは ☰ が出ない */
  ok((wb.match(/onMenu=\{onMenu\}/g) ?? []).length >= 1
    && (qr.match(/onMenu=\{onMenu\}/g) ?? []).length >= 2,
    '聞き流しへ、単語帳からも Quick Response からも ☰ が渡る')

  // ── ② 教材の中の集中モードは ✕ のまま ────────────────────
  for (const f of ['FocusReader', 'StepFocus', 'QuickResponse', 'SpeechPractice']) {
    ok(!/onMenu/.test(noNote(readD(`src/components/${f}.jsx`))),
      `${f} は ✕ のまま(閉じたら読んでいた教材に戻る)`)
  }

  // ── ③ 聞き流しの、やめる道 ──────────────────────────────
  ok(/onMenu && \([\s\S]{0,200}?聞き流しをやめる/.test(radio),
    '☰ にした聞き流しには、やめる道を残す(行き止まりを作らない)')

  // ── ④ 開くときは帯1本 ───────────────────────────────────
  /* **冊を替えているあいだは通さない**(第5.173節)。あちらは
     帯も本棚も残したまま、下だけを入れ替える */
  ok(/if \(!running && !switching && \(loading \|\| !opened\)\) return <Loading \/>/.test(wb),
    '単語帳は、判断が済むまで帯1本(0 / 0 / 0 の札をちらつかせない)')
  ok(/if \(\(busy \|\| !opened\) && !switching\) return <Loading \/>/.test(qr),
    'Quick Response も同じ')
  /* **出題中に通してはいけない。** 通すと、答えたあとの読み直しのたびに
     出題が消えて帯になる */
  ok(/!running &&/.test(wb), '出題しているあいだは、帯に戻らない')
  /* **「始めたか」では見張らない。** 1問も無い帳面で立たないので、
     **永遠に読み込み中**になる */
  ok(/setOpened\(true\)[\s\S]{0,240}?if \(!rowsRef\.current\.length/.test(wb),
    '単語帳は、先に「判断が済んだ」を立てる(1語も無い帳面で止まらない)')
  ok(/setOpened\(true\)[\s\S]{0,160}?if \(shown\.length === 0\)/.test(qr),
    'Quick Response も同じ')
  ok(/setOpened\(false\)/.test(wb) && /setOpened\(false\)/.test(qr),
    '冊を変えたら、判断からやり直す(新しい冊の1問目が出る)')

  // ── ⑤ メニューは、集中している画面の上に出す ──────────────
  ok(/overFocus = false,/.test(nav) && /nav-scrim--over/.test(nav) && /' is-over'/.test(nav),
    'メニューは1つのまま。かぶさる高さだけを変えられる')
  ok(/\.nav-scrim--over \{[^}]*z-index: 125/.test(st)
    && /\.app-nav\.is-drawer\.is-over \{[^}]*z-index: 130/.test(st),
    'かぶせて開いたときだけ、集中モード(120)より上に出る')
  ok(/\.nav-scrim \{[^}]*z-index: 50/.test(st) && /\.app-nav\.is-drawer \{[^}]*z-index: 60/.test(st),
    'いつものメニューの高さ(50 / 60)は動かしていない')
  ok(/open=\{navOpen \|\| focusMenu\} wide=\{navPush && !focusMenu\}/.test(app),
    '集中モードから開くときは、柱ではなく引き出しにする')

  // ── ⑥ PC の柱をたたまない ───────────────────────────────
  ok(/focusMenu \? setFocusMenu\(false\) : setNavOpen\(false\)/.test(app),
    'かぶせたメニューを閉じても、PC の柱はたたまない(覚えた設定を壊さない)')
  ok((app.match(/onMenu=\{openFocusMenu\}/g) ?? []).length === 2,
    '単語帳と Quick Response の両方に ☰ を渡している')

  // ── 設定の箱が、聞き流しの上に居座らない ──────────────────
  /* `.sheet-back` は 200、集中モードは 120。**閉じないと上に残る** */
  ok(/if \(e\.target\.closest\('button'\)\) setOpen\(false\)/.test(sheetSrc),
    '「出しかた」の道具を押したら、その箱は閉じる(聞き流しの上に残らない)')
}

/* ══════════════════════════════════════════════════════════════════════
   **切り替えでちらつかせない。音は洒落たものに**
   (第5.173節・2026-09 利用者の指摘)

     > どの冊をやるのかを切り替える際に画面がチラつくのと、冊の中にさらに
     > 選択肢があるはずなのに選択肢が出ずに切り替わり、もう一度選択肢を
     > 出すとやっと更なる選択肢が表示されるという二度手間に…
     > また、正解時の音ももっと洒落たものにしてください。
     > 普段から押した音が出るようにしてください

   **ちらつきと二度手間は、根が1つ**である ——
   替えた瞬間に画面ぜんぶを描き直していたので、
   **本棚のシートごと消えていた**(あれは出題の箱の中にある)。

   音は**鳴らして数える**(`test:audio` と同じ考え方・こちらには
   音が聞こえない)。**「ピンポン」と書いてあるか**では見ない。
   ══════════════════════════════════════════════════════════════════════ */
{
  console.log('\n▶ 切り替えでちらつかせない。音は洒落たものに(5.173)')
  const readD = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')
  const noNote = (src) => src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1 ')
  const wb = noNote(readD('src/components/Wordbook.jsx'))
  const qr = noNote(readD('src/components/QrReview.jsx'))
  const pick = noNote(readD('src/components/BookPick.jsx'))
  const hap = noNote(readD('src/lib/haptics.js'))

  // ── ① 冊を替えても、箱を畳まない ────────────────────────
  /* **`dropRun()` が箱を倒していないこと**を数える。倒すと、
     その中にある本棚のシートまで一緒に消えて、開き直す手間になる */
  const wbDrop = wb.match(/const dropRun = \(\) => \{[\s\S]*?\n  \}/)?.[0] ?? ''
  const qrDrop = qr.match(/const dropRun = \(\) => \{[\s\S]*?\n  \}/)?.[0] ?? ''
  ok(wbDrop && !/setRunning\(false\)/.test(wbDrop),
    '単語帳は、冊を替えても出題の箱を畳まない(本棚が消えない)')
  ok(qrDrop && !/setLive\(false\)/.test(qrDrop),
    'Quick Response も同じ')
  ok(/setSwitching\(true\)/.test(wbDrop) && /setSwitching\(true\)/.test(qrDrop),
    '替えている最中だと分かるようにしている(はじめて開いたときとは分ける)')
  ok(/\{running && !result && \(/.test(wb),
    '単語帳の箱は、中身が空でも出したまま(帯が残る)')
  ok(/if \(live\) \{/.test(qr) && /const \[live, setLive\] = useState\(false\)/.test(qr),
    'Quick Response も「箱を出すか」と「中に何を描くか」を分けている')
  /* **中身が無いあいだは、そこだけが帯になる。** 帯(冊名 ▾)は動かない */
  ok(/\{!card \? \([\s\S]{0,400}?<Loading \/>/.test(wb),
    '単語帳は、替えている最中も帯の下だけが読み込みの帯になる')
  /* **置き場所が下がった**(第5.174節)。冊名と進み具合の帯は
     そのまま残り、**その下だけ**が読み込みの帯になる */
  ok(/\{n === 0 \? \([\s\S]{0,400}?<Loading \/>/.test(qr),
    'Quick Response も同じ')
  /* **出すものが無い冊に替えたら、一覧へ戻す**(帯のまま止めない) */
  ok(/setRunning\(false\)\s*\n\s*return/.test(wb) && /setLive\(false\)\s*\n\s*return/.test(qr),
    '出すものが無い冊に替えたら、一覧の画面へ戻す(読み込み中のまま止めない)')
  /* **読み直しのあいだ、結果の箱を消さない** */
  ok(/\{isQuiz && result && running && \(/.test(wb),
    '読み直しのあいだも、終わりの1枚は消えない')

  // ── ② 中に選択肢がある冊は、本棚を閉じない ────────────────
  ok(/if \(!books\.find\(\(b\) => b\.id === id\)\?\.hasSub\) setOpen\(false\)/.test(pick),
    '中にまだ選ぶものがある冊は、本棚を閉じない(二度手間にしない)')
  /* **どの冊に中身があるかは、呼ぶ側が持つ。** ここで id を並べない */
  ok(!/'shelf'|'basic'|'nf'|'frame'/.test(pick),
    '本棚は、冊の id を1つも知らない(冊を足しても食い違わない)')
  ok(/id: 'shelf', label: '業種べつ', hasSub: true/.test(wb)
    && /id: 'basic', label: '基礎単語', hasSub: true/.test(wb),
    '単語帳の「業種べつ」と「基礎単語」に、中身がある印が付いている')
  /* **型の冊の名前は書き写さない**(第5.177節)。
     `FRAME_BOOK_LABEL` 1か所から引いているので、ここでも名前では数えない */
  ok(/id: 'nf', label: NF_BOOK_LABEL, hasSub: true/.test(qr)
    && /id: 'frame', label: FRAME_BOOK_LABEL, hasSub: true/.test(qr),
    'Quick Response の「Native Flow」と型の冊も同じ')
  /* **「出る」と「出ない」の両方**。中身の無い冊にまで付けると、
     選んだのに閉じない(押すところを探すことになる) */
  ok(!/label: '自分の単語帳', hasSub/.test(wb) && !/label: 'コロケーション', hasSub/.test(wb),
    '中に選ぶものが無い冊には付けない(選んだら閉じる)')

  // ── ③ 押した音は、いつも鳴らす ───────────────────────────
  ok(/if \(lastTouch\) buzz\(kind\)/.test(hap) && /\n  playSfx\('tap'\)/.test(hap),
    '押した音はいつも鳴り、ふるえは触る端末だけ')
  ok(/if \(lastTouch\) buzz\(ok \? 'hold' : 'tap'\)/.test(hap)
    && !/if \(!lastTouch\) return/.test(hap),
    '正解・まだの音も、マウスで押した人に鳴る')
  /* **見張りそのものを、マウスで止めない。** ここで帰っていたので、
     パソコンでは1回も鳴っていなかった */
  ok(!/lastTouch = isTouch\(e\)\s*\n\s*if \(!isTouch\(e\)\) return/.test(hap),
    '見張りがマウスの操作で打ち切られていない')

  // ── ④ 音そのものを鳴らして数える(**耳の代わり**)──────────
  {
    /* **書いてある言葉では見ない。** 実際に組み立てた波を数える */
    const sched = []
    class Osc {
      constructor() {
        this.type = 'sine'
        this.frequency = { setValueAtTime: (v) => { this.f = v } }
      }
      connect(n) { this.g = n; return n }
      start(t) { this.t0 = t }
      stop(t) { sched.push({ type: this.type, f: this.f, t0: this.t0, t1: t, peak: this.g?.peak }) }
    }
    class Gain {
      constructor() {
        this.gain = {
          setValueAtTime: () => {},
          exponentialRampToValueAtTime: (v) => {
            if (v < 1 && v > (this.peak ?? 0)) this.peak = v
          },
        }
      }
      connect() { return {} }
    }
    globalThis.window = {
      AudioContext: class {
        constructor() { this.state = 'running'; this.currentTime = 0; this.destination = {} }
        createOscillator() { return new Osc() }
        createGain() { return new Gain() }
        resume() { return Promise.resolve() }
      },
      localStorage: { getItem: () => null, setItem: () => {} },
    }
    const { playSfx } = await import('../src/lib/sfx.js')
    const take = (kind) => { sched.length = 0; playSfx(kind); return sched.map((x) => ({ ...x })) }

    const tap = take('tap')
    ok(tap.length >= 2 && tap.every((x) => x.type === 'sine'),
      '押した音は、正弦を重ねている(小さくしても芯が残る)')
    ok(Math.max(...tap.map((x) => x.t1)) <= 0.09,
      '押した音は 0.09 秒より短い(たくさん鳴るので、耳に残らない)')

    const cor = take('correct')
    ok(cor.length >= 3, '正解の音は3つ以上(ピンポンの2つから増えた)')
    ok(cor.every((x) => x.type === 'sine'),
      '正解の音は正弦(三角のまま重ねると、倍音がぶつかって濁る)')
    /* **重なっていることが、和音に聞こえる理由である。**
       前は 0.10 秒ずらしで、ほとんど重なっていなかった */
    let over = 0
    for (let i = 0; i < cor.length; i++) {
      for (let j = i + 1; j < cor.length; j++) {
        if (cor[i].t0 < cor[j].t1 && cor[j].t0 < cor[i].t1) over += 1
      }
    }
    ok(over >= 3, `正解の音は重なって鳴る(${over} 組)—— だから和音になる`)
    /* **ハ長調の分散和音。** 値は書き写さず、**比**で見る
       (定数を書き写すと、変えた日に期待値も一緒に動く・CLAUDE.md) */
    const base = Math.min(...cor.map((x) => x.f))
    const ratio = [...new Set(cor.map((x) => Math.round((x.f / base) * 100) / 100))].sort((a, b) => a - b)
    ok(ratio.length >= 3
      && Math.abs(ratio[1] - 1.26) < 0.03      // 長三度
      && Math.abs(ratio[2] - 1.5) < 0.03,      // 完全五度
      `上がっていく和音になっている(${ratio.join(' : ')})`)
    ok(Math.max(...cor.map((x) => x.t1)) <= 0.6,
      '正解の音は 0.6 秒より短い(答えて 0.9 秒で次へ進むので、切れない)')

    /* **変えていないものは、変わっていない**(言われた場所だけを直す) */
    const miss = take('miss')
    ok(miss.length === 1 && miss[0].type === 'triangle' && Math.round(miss[0].f) === 392,
      '「まだ」の音は1文字も変えていない(責めない・低く1つだけ)')
    ok(take('done').every((x) => x.type === 'triangle'),
      '裏の仕事が終わった音も、変えていない')
  }
}

/* ══════════════════════════════════════════════════════════════════════
   **帯は3つ。長い冊名は札で切れ、全文はタイトルが受け止める**
   (第5.176節・2026-09 実機・利用者の指定)

     > quick response 帳、ダサくなったので、単語帳と同じ仕様に戻してください。
     > …選択肢のタブをそのまま下に移すのはダサいと思います。
     > つまり、タブが画面幅に収まるようにすると、冊のタイトルが長いものは、
     > 省略されて表示されることになる。
     > その分コンテンツの方にタイトルとして全文をきちんと表示する。
     > 1/30などは進捗バーにしましょう

   **はみ出していた本当の中身は「1 / 30」だった**(第5.174節では
   冊名まで下ろしてしまい、**単語帳と形が違ってしまった**)。
   数を進み具合の帯に任せれば、帯は ☰ / 冊名 ▾ / 出しかた の3つ ——
   **単語帳とまったく同じ**になる。

   **押すところ(帯の札)と、読むところ(タイトル)を分ける。**
   ══════════════════════════════════════════════════════════════════════ */
{
  console.log('\n▶ 帯は3つ。長い冊名は札で切れ、全文はタイトルへ(5.176)')
  const readD = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')
  const noNote = (src) => src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1 ')
  const css = (src) => src.replace(/\/\*[\s\S]*?\*\//g, ' ')
  const qr = noNote(readD('src/components/QrReview.jsx'))
  const wb = noNote(readD('src/components/Wordbook.jsx'))
  const sk = noNote(readD('src/__screens.jsx'))
  const title = noNote(readD('src/components/DrillTitle.jsx'))
  const st = css(readD('src/styles.css'))

  // ── (1) 帯は3つ。単語帳と同じ並び ─────────────────────────
  ok(/top=\{bookPick\}/.test(qr),
    'Quick Response の冊名 ▾ は帯にある(単語帳と同じ並び)')
  ok(!/focus-count|qrrev-at|qrrev-head/.test(qr),
    '帯にも紙にも「1 / 30」は無い(進み具合の帯が言う)')
  ok(!/focus-top-right/.test(qr) && !/\.focus-top-right \{/.test(st),
    '右端へ寄せる指定は消してある(効かない指定を残さない)')
  /* **進み具合は、1問=1つの区切りで出す**(第5.180節で帯から変えた)。
     数字は出さない —— 目で数えられるものを、もう一度言わない */
  ok(/<DrillHead label=\{bookLabel\} total=\{n\} done=\{at\} \/>/.test(qr),
    '進み具合は個数のバーで出す(数字を出さない)')
  ok(!/qr-bar/.test(qr), 'ひと続きの帯は、この画面から消してある')

  // ── (2) 長い冊名は、札で切れる ──────────────────────────
  /* **`.btn--small` が `flex-shrink: 0` を持っている。**
     打ち消さないと札が縮まず、**となりの「出しかた」が画面の外へ出る** */
  ok(/\.btn--small \{[^}]*flex-shrink: 0/.test(st),
    '小さい札は、ふだんは縮まない(ここは変えていない)')
  ok(/\.bookpick \{[^}]*flex: 0 1 auto/.test(st)
    && /\.bookpick \{[^}]*min-width: 0/.test(st),
    '冊名の札だけは縮む(帯に収まる)')
  ok(/\.bookpick-name \{[^}]*text-overflow: ellipsis/.test(st),
    '縮んだぶんは「…」で切る(押すところは残る)')

  // ── (3) 全文は、タイトルが受け止める ────────────────────
  ok(/export default function DrillTitle/.test(title)
    && /if \(!t\) return null/.test(title),
    '名前が空なら、タイトルの行ごと出さない')
  ok(/<h3 className="drill-title">/.test(title),
    'タイトルは見出しとして読ませる(読み上げが「いまどの帳面か」を拾える)')
  /* **2つの画面が、同じ部品を使う**(利用者の指定「単語帳と同じ仕様に」)。
     書き写すと、必ず片方だけ古くなる */
  for (const [src, name] of [[qr, 'Quick Response'], [wb, '単語帳']]) {
    /* **「どう書いてあるか」ではなく「書き写していないか」で見る。**
       第5.179節で Quick Response は `bookLabel` を挟む形になった
       (出す相手の欄と名前を分け合う)。**書き方を1つに縛ると、
       寄せた日に赤くなる** —— 見たいのは
       「`books` から引いている・二度引いていない」のほうである */
    ok(/<DrillHead label=\{/.test(src),
      `${name} … 名前と進み具合を、同じ部品(DrillHead)に渡す`)
    const 引く = (src.match(/books\.find\(\(b\) => b\.id === book\)\?\.label/g) ?? []).length
    ok(引く === 1,
      `${name} … 名前は books 1か所から引く(書き写していない)`, String(引く))
    /* **カードの中の上**に置く(第5.180節・利用者の指定
       「quick response のようにコンテンツの上部にタイトルを」)。
       単語帳はカードの外に置いていたので、置き場所が割れていた */
    ok(/(<section className="qr">|<div className="wordcard)/.test(src),
      `${name} … コンテンツの入れ物がある`)
  }
  ok(/\.drill-title \{[^}]*margin: 0/.test(st),
    'タイトルは余白を持たない(すき間は親の gap で作る)')

  // ── (4) 骨組みは、本物と1文字も違えない ───────────────────
  ok(/top=\{plain \? \(\s*<BookPick/.test(sk),
    '骨組みも、復習のときだけ冊名 ▾ を帯に置く')
  ok(/topEnd=\{plain \? \(\s*<ReviewScope/.test(sk),
    '骨組みの帯にも「出しかた」がある(3つそろえないと、はみ出しを測れない)')
  ok(/\{plain && <DrillTitle label="自分の Quick Response 帳" \/>\}/.test(sk),
    '骨組みのタイトルは、いちばん長い冊名(短いと切れ方を測れない)')
}

/* ══════════════════════════════════════════════════════════════════════
   **Unit の呼び名は【 】で囲み、1か所で作る**
   (第5.175節・2026-09 実機・利用者の指定)

     > UNIT5 と次の数字の間にスペースしかなく、見づらいです。
     > 【UNIT5】という風にしてください。これも全ての場所で同じルールです

   前は `Unit 5 7単語以上の長い表現` で、**番号と中身のあいだが
   スペース1つ**だった。数字のとなりに数字が来ると、
   **どこまでが番号か読み取れない。**

   しかも同じ形を**4か所がそれぞれ書いていた** ——
   絞り込みの名前・Unit をえらぶ欄・トレーナーが出す欄・出した知らせ。
   **直すのに画面を回ることになる**(CLAUDE.md「呼び名を2か所に書かない」)。
   ══════════════════════════════════════════════════════════════════════ */
{
  console.log('\n▶ Unit の呼び名は【 】で囲み、1か所で作る(5.175)')
  const readD = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')
  const noNote = (src) => src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1 ')

  /* **鳴らして数える**のと同じで、**呼んで読む** ——
     書いてある文字ではなく、出てきた名前そのものを見る */
  ok(NATIVE_FLOW_UNITS.every((u) => unitName(u) === `【Unit ${u.id}】${u.label}`),
    '呼び名は【Unit ◯】+ 中身(番号と中身がくっつかない)')
  ok(NATIVE_FLOW_UNITS.every((u) => !/【Unit \d+】\s/.test(unitName(u))),
    '【 】のうしろに、よけいなスペースを入れていない')
  /* **知らない番号に、名前を作らない**(当てずっぽうで返さない) */
  ok(unitName(null) === '' && unitName(undefined) === '',
    '知らない Unit には名前を作らない')
  ok(NATIVE_FLOW_UNITS.every((u) => unitTitle(u.id) === `Native Flow${unitName(u)}`),
    '絞り込みの名前も、同じ呼び名から作っている')

  /* ── **4か所とも、1か所から呼んでいるか** ────────────────
     **「出る」と「出ない」の両方を見る** ——
     組み立てている形(`Unit {u.id}`)が1つも残っていないことも数える */
  for (const f of [
    'src/components/NativeFlowUnits.jsx',
    'src/components/NativeFlowAssign.jsx',
    'src/components/TrainerLearners.jsx',
  ]) {
    const src = noNote(readD(f))
    const name = f.split('/').pop()
    ok(/unitName\(/.test(src), `${name} … 呼び名を unitName() から取っている`)
    ok(!/Unit \$\{u\.id\}|Unit \{u\.id\}/.test(src),
      `${name} … 自分では組み立てていない(直すのに回らなくていい)`)
  }
  const nf = noNote(readD('src/data/nativeFlow.js'))
  ok((nf.match(/【Unit \$\{u\.id\}】/g) ?? []).length === 1,
    '呼び名を作っているのは、ファイルの中でも1か所だけ')
}

/* ────────────────────────────────────────────────────────────────
   第5.178節 いま誰の記録として残るか(2026-09 利用者の指摘)

     > ゲストページ内のそのゲストの宿題になっている教材内で単語やフレーズを
     > 単語帳に登録しているはずなのに、明らかに他のゲストが登録した単語などが
     > 入っていることがあります。しっかり分けて管理する体制にしてください。

   **渡し忘れが、そのまま「自分」になる**のがいちばん怖い。
   `setWordStatus()` は `learnerId` を渡さなければ黙って `auth.uid()` に
   書くので、**props を1つ書き忘れただけで、別の人の単語帳に入る。**
   だから「書いてあるか」を機械で数える。
   ──────────────────────────────────────────────────────────────── */
{
  const read = (f) => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8')
  const noNote = (src) => src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1 ')

  /* **レッスン表示を描いている場所は、ぜんぶ誰の記録かを渡す。**
     `<LessonView` から最初の `/>` までを1つとして数える ——
     属性は何行にもまたがる(`[^>]*` では `=>` に当たって切れる) */
  const tags = (src) => {
    const out = []
    for (const m of src.matchAll(/<LessonView\b/g)) {
      const end = src.indexOf('/>', m.index)
      if (end > 0) out.push(src.slice(m.index, end))
    }
    return out
  }
  const 画面 = ['App.jsx', '__screens.jsx',
    'components/TrainerLearners.jsx', 'components/TrainerMaterials.jsx',
    'components/LearnerHomework.jsx']
  let 数 = 0
  for (const f of 画面) {
    for (const tag of tags(noNote(read(f)))) {
      数 += 1
      ok(/learnerId=/.test(tag),
        `${f} … レッスン表示に「誰の記録か」を渡している`,
        tag.replace(/\s+/g, ' ').slice(0, 60))
    }
  }
  /* **数そのものも見る。** 0個なら、上の見張りは1本も回らない */
  ok(数 >= 3, `レッスン表示を描いている場所が ${数} か所ある`, String(数))

  /* **見る側と書く側が、同じ1つを使う**(第5.178節)。
     ここが別々だと、色は自分・記録はゲスト、という食い違いになる */
  const tm = noNote(read('components/TrainerMaterials.jsx'))
  ok(/useWordStatuses\(sessionFor\)/.test(tm),
    '教材の画面 … 映す記録も、選んだ相手のもの')
  ok(/onLearnerChange=\{setSessionFor\}/.test(tm),
    '教材の画面 … 帯の名札で切り替えられる(受け止める親がいる)')
  ok(/markIn\(markWord, m\.id, sessionFor\)/.test(tm),
    '教材の画面 … 紙に出すときも、選んだ相手の記録になる')

  /* **ゲストのページからは切り替えさせない**(画面共有中の取り違えを防ぐ)。
     「渡している」と「渡していない」の両方を数える —— 片方だけだと、
     **どこでも切り替えられる形**に書き換えても緑のままになる */
  const tl = noNote(read('components/TrainerLearners.jsx'))
  ok(/learnerId=\{openId\}/.test(tl), 'ゲストのページ … 相手はそのゲストで決まっている')
  ok(!/onLearnerChange/.test(tl), 'ゲストのページ … 切り替えは渡していない(名札だけ)')

  /* **レッスン表示の中では、1つの `owner` だけを配る。**
     生の `learnerId` を子に配ると、切り替えても片方だけ古いままになる */
  const lv = noNote(read('components/LessonView.jsx'))
  ok(/const owner = learnerId \?\? null/.test(lv),
    'レッスン表示 … 誰の記録かを1つに持っている')
  ok(/markIn\(onMarkWord, material\?\.id, owner\)/.test(lv),
    'レッスン表示 … 語も、その1つの相手に入る')
  ok(!/learnerId=\{learnerId\}/.test(lv),
    'レッスン表示 … 子には生の learnerId を配っていない')
  const 子 = (lv.match(/learnerId=\{owner\}/g) ?? []).length
  ok(子 >= 4, `レッスン表示 … 子もぜんぶ同じ相手を見ている(${子} か所)`, String(子))
  /* **「出す」の条件ごと数える。** `<SessionOwner` が書いてあるかだけ見ると、
     **`{false && …}` に書き換えても緑のまま**になる(赤チェックで踏んだ)。
     ゲストには出さない判断(`canNote`)も、ここで一緒に見る */
  ok(/\{canNote && \(\s*<SessionOwner/.test(lv),
    'レッスン表示 … 誰の記録かを、トレーナーにだけ出している')
  /* **メモの中に、相手を選ぶ欄を残していない**(同じことを2つ見せない) */
  ok(!/誰のセッションの記録ですか/.test(lv),
    'レッスン表示 … 相手を選ぶ欄は、名札の1か所だけ')

  /* **文言は1か所**(`ownerLabel`)。画面に書き写すと、必ず片方だけ古くなる */
  const so = noNote(read('components/SessionOwner.jsx'))
  ok(/export const ownerLabel/.test(so), '名札 … 文言を1か所で作っている')
  ok(!/さんの記録/.test(lv), 'レッスン表示 … 文言を書き写していない')
  /* **押せるのは、受け止める親がいるときだけ**(行き止まりを作らない) */
  ok(/if \(!onPick\)/.test(so), '名札 … 受け止める親がいなければ、押せない名札')
  /* **並べるのは `BookShelf`。** 印・太字・枠の作法を書き写さない */
  ok(/<BookShelf/.test(so), '名札 … 並べ方は BookShelf に任せている')
  ok(!/shelf-mark/.test(so), '名札 … 並べ方を書き写していない')

  /* **骨組みが、本物の部品をそのまま描いている**(CLAUDE.md) */
  const sc = noNote(read('__screens.jsx'))
  ok(/<SessionOwner/.test(sc), '骨組み … 本物の名札を描いている')
  ok(/q\.get\('owner'\) === 'fixed'/.test(sc), '骨組み … 押せない名札も描いている')
  ok(/q\.get\('owner'\) === 'empty'/.test(sc), '骨組み … 担当がいないときも描いている')
  /* **すき間の見張りにも入っている**(足すまで見張られない) */
  const bar = noNote(readFileSync(new URL('../scripts/test-bar.mjs', import.meta.url), 'utf8'))
  ok(/\['owner', ''\]/.test(bar), 'すき間の見張りに owner が入っている')
}

/* ────────────────────────────────────────────────────────────────
   第5.179節 Native Flow と型の冊を、指定したゲストにだけ出す

     > Native Flow や 14 の型は指定したゲストにだけ出るようにしたいです。
     > トレーナーの単語帳 / Quick Response、または、トレーナーアカウント内の
     > ゲストの単語帳 / Quick Response帳からアサインできるようにしたいです。

   **呼んで確かめる。** 「書いてあるか」だけだと、
   判断を逆にしても(`role === 'learner'` を落としても)緑のままになる。
   ──────────────────────────────────────────────────────────────── */
{
  const read = (f) => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8')
  const noNote = (src) => src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1 ')
  const feat = await import('../src/data/learnerFeatures.js')

  /* **名前は1か所**(`FRAME_QR`)。画面にも `frameQr.js` にも書き写さない */
  ok(typeof feat.FRAME_QR === 'string' && feat.FRAME_QR.length > 0,
    '型の冊の名前が、1か所にある', feat.FRAME_QR)
  ok(feat.LEARNER_FEATURES.some((f) => f.id === feat.FRAME_QR),
    'ゲストのページの「出すもの」にも並ぶ(トレーナーの2つ目の入り口)')
  /* **どの行にも、どこに出るのかまで書いてある**(「出しました」で終わらせない) */
  ok(feat.LEARNER_FEATURES.every((f) => f.label && f.hint),
    'どの「出すもの」にも、名前と説明がある')
  ok(new Set(feat.LEARNER_FEATURES.map((f) => f.id)).size === feat.LEARNER_FEATURES.length,
    '「出すもの」の名前が、1つも重なっていない')

  /* **呼んで確かめる。** 4通りとも見る —— **出る / 出ない の両方** */
  const 型 = feat.showsFrameQr
  ok(型({ role: 'trainer', features: null }) === true,
    'トレーナーには、指定にかかわらず出る')
  ok(型({ role: 'owner', features: null }) === true, '管理者にも出る')
  ok(型({ role: 'learner', features: new Set() }) === false,
    'ゲストには、出していなければ出ない')
  ok(型({ role: 'learner', features: new Set([feat.FRAME_QR]) }) === true,
    'ゲストにも、出していれば出る')
  ok(型({}) === false, '役割が分からないうちは出さない(既定は「出さない」側)')
  /* **Native Flow と同じ形。** 似ているからと棚(トレーナーも絞る)に寄せない */
  const nf = await import('../src/data/nativeFlow.js')
  ok(nf.showsNfUnit({ role: 'trainer', features: null }, 1) === 型({ role: 'trainer', features: null }),
    'Native Flow と、トレーナーの扱いがそろっている')

  /* **画面は判断しない。** 受け取るだけ(`nfUnits` とまったく同じ作法) */
  const qr = noNote(read('components/QrReview.jsx'))
  ok(/frameOn = false/.test(qr), 'Quick Response は、出すかどうかを受け取るだけ')
  ok(/\.\.\.\(frameOn \? \[\{ id: 'frame'/.test(qr),
    '出すときだけ、型の冊を本棚に並べる')
  ok(!/showsFrameQr/.test(qr), '画面の中で判断していない')
  const app = noNote(read('App.jsx'))
  ok(/showsFrameQr\(\{ role: profile\?\.role \?\? null, features \}\)/.test(app),
    'App が判断して渡している')
  ok(/<QrReview nfUnits=\{myNfUnits\} frameOn=\{myFrameQr\}/.test(app),
    '自分の Quick Response 帳に渡している')

  /* **出す相手の欄は、もう帳面には無い**(第5.185節・2026-09 利用者の指定)。

       > Quick response のアサイン機能と単語帳のアサイン機能を、
       > トレーナーの単語帳と quick response 帳から消してください

     **「出ない」側を見る**(CLAUDE.md)。消したつもりで戻しても、
     ここが無ければ**緑のまま**になる。 */
  ok(!/BookAssign|ASSIGN_BOOKS|assignBox/.test(qr),
    '自分の Quick Response 帳に、出す相手の欄は無い(第5.185節)')
  ok(!/loadMyLearners|setLearnerFeature|loadFeatureMap|viewerRoleOf/.test(qr),
    '配るための読み書きも、もう持っていない(0円で済むものは0円で)')
  /* **消したのは置き場所だけ。配る道は2つ残っている** ——
     ゲストのページと「アサインする」。**黙って機能ごと消さない** */
  const tl = noNote(read('components/TrainerLearners.jsx'))
  const asg2 = noNote(read('components/AssignBooks.jsx'))
  /* **`<AssignShelf` だけで探さない。** `<AssignShelfX` に
     書き換えても当たってしまう(**赤チェックで踏んだ**・CLAUDE.md
     「置き換える前に `grep -n` で数える」の裏返し) */
  ok(/<AssignShelf[\s/>]/.test(tl), '配る道① ゲストのページは残っている')
  ok(/<AssignShelf[\s/>]/.test(asg2), '配る道② 「アサインする」も残っている')
  /* **部品ごと消した。** 使っていない部品を置いておくと、
     次に触る人が「まだ在る」と思って呼び戻す */
  const ある = existsSync(new URL('../src/components/BookAssign.jsx', import.meta.url))
  ok(!ある, '使わなくなった `BookAssign.jsx` は、部品ごと消してある')
  const sc = noNote(read('__screens.jsx'))
  ok(!/BookAssign|bookassign/.test(sc), '骨組みからも消してある(描けない画面を残さない)')
  const bar = noNote(readFileSync(new URL('../scripts/test-bar.mjs', import.meta.url), 'utf8'))
  ok(!/bookassign/.test(bar), 'すき間の見張りからも消してある')
}

/* ────────────────────────────────────────────────────────────────
   第5.180節 名前と進み具合を、2つの画面でそろえる

     > quick response のようにコンテンツの上部にタイトルを、
     > そして単語帳 のように個数のバーを。それで統一してください。

   **並びで1つなのだから、入れ物ごと1つにする。** 名前だけを部品にして
   バーを画面ごとに書いていたから、置き場所も形も割れた。
   ──────────────────────────────────────────────────────────────── */
{
  const read = (f) => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8')
  const noNote = (src) => src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1 ')
  const css = (src) => src.replace(/\/\*[\s\S]*?\*\//g, ' ')
  const head = noNote(read('components/DrillHead.jsx'))
  const qr = noNote(read('components/QrReview.jsx'))
  const wb = noNote(read('components/Wordbook.jsx'))
  const st = css(read('styles.css'))

  /* **自分では何も読まない部品**(骨組みでもそのまま描ける) */
  ok(!/supabase|useEffect|useState/i.test(head),
    '名前と進み具合の部品は、props で受け取るだけ')
  /* **名前の部品を、二重に持たない** */
  ok(/<DrillTitle label=\{label\} \/>/.test(head),
    '名前は、これまでの部品(DrillTitle)をそのまま使う')
  /* **空の帯を出さない・空の行で場所を取らない**(黙って出さない) */
  ok(/if \(!String\(label \?\? ''\)\.trim\(\) && n === 0\) return null/.test(head),
    '名前も数も無ければ、入れ物ごと出さない')
  ok(/\{n > 0 && \(/.test(head), '数が 0 ならバーを出さない')
  /* **数えられない値を 0 として描かない**(「1問しかない」と読めてしまう) */
  ok(/Number\.isFinite\(Number\(total\)\)/.test(head),
    '数えられない値は、区切りを作らない')

  /* **2つの画面が、同じ部品を同じ順で使う** */
  for (const [src, name] of [[qr, 'Quick Response'], [wb, '単語帳']]) {
    ok(/<DrillHead label=\{/.test(src), `${name} … 同じ部品を使っている`)
    ok(!/wb-run-bar|qr-bar/.test(src), `${name} … 前のバーは残っていない`)
  }
  /* **単語帳は、替えている最中にも出す**(画面のどこも動かない・第5.173節)。
     **数えて見る** —— 1か所だけだと、替えているあいだ題が消える */
  const 置いた = (wb.match(/\{drillHead\}/g) ?? []).length
  ok(置いた === 2, `単語帳 … カードと、替えている最中の両方に置く(${置いた})`,
    String(置いた))
  /* **数え方を2通り持たない** */
  const 数える = (wb.match(/doneRef\.current\.length/g) ?? []).length
  ok(数える === 1, `単語帳 … 進み具合を数えるのは1か所(${数える})`, String(数える))

  /* **CSS も1つ。** 古い名前を残さない(片方だけ直す事故のもと) */
  ok(/\.drill-bar \{/.test(st) && /\.drill-head \{/.test(st),
    '見た目の指定も、1つの名前にまとめてある')
  ok(!/\.wb-run-bar/.test(st), '古い名前(.wb-run-bar)は残っていない')
  /* **`.qr-bar` は残す** —— 教材の中の Quick Response が使っている。
     **言われた場所だけを直す**(CLAUDE.md) */
  ok(/\.qr-bar \{/.test(st) && /qr-bar/.test(noNote(read('components/QuickResponse.jsx'))),
    '教材の中の Quick Response は、これまでどおり(言われた場所だけ直す)')
  /* **すき間は親の gap で作る**(`.claude/rules/common.md`) */
  ok(/\.drill-head \{[^}]*gap: var\(--sp-8\)/.test(st),
    '名前とバーのすき間は、親の gap で作る')
}

/* ────────────────────────────────────────────────────────────────
   第5.181節 アサインする(冊を、この人に出す)

     > 新しい冊をアサインするのは各ゲストの単語帳もquick response帳、
     > もしくは「アサインする」の機能を作り、その中から教材、単語帳の冊、
     > quick responseの冊を選べるようにしたいです。

   配る場所が**2つ**になった(ゲストのページ / 「アサインする」の画面)。
   **判断と文言を書き写すと、必ず片方だけ古くなる。**
   ──────────────────────────────────────────────────────────────── */
{
  const read = (f) => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8')
  const noNote = (src) => src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1 ')
  const feat = await import('../src/data/learnerFeatures.js')
  const ab = await import('../src/lib/assignBooks.js')
  const nf = await import('../src/data/nativeFlow.js')
  const sh = await import('../src/data/shelves.js')

  /* **どちらの帳面の冊かは、一覧が知っている**(画面で振り分けない) */
  ok(feat.LEARNER_FEATURES.every((f) => f.group === 'word' || f.group === 'qr'),
    'どの冊にも、どちらの帳面かが書いてある')
  ok(feat.featuresIn('word').length > 0 && feat.featuresIn('qr').length > 0,
    '単語帳の冊と Quick Response の冊が、両方ある')
  /* **足すと両方に出る**(合わせると一覧そのものになる) */
  ok(feat.featuresIn('word').length + feat.featuresIn('qr').length
    === feat.LEARNER_FEATURES.length, '振り分けで、1つも落ちていない')
  /* **知らない組は空。** 当てずっぽうで全部返さない(既定は「出さない」側) */
  ok(feat.featuresIn('そんな帳面は無い').length === 0, '知らない帳面には、1冊も出さない')

  /* **判断は呼んで確かめる。** 書いてあるかだけだと、逆にしても緑のまま */
  const 空 = new Set()
  const 全部 = new Set([
    ...sh.shelfList().map((s) => sh.shelfFeature(s.id)),
    ...nf.NATIVE_FLOW_UNITS.map((u) => nf.nfFeature(u.id)),
  ])
  ok(ab.shelvesOn(空).length === 0 && ab.shelvesOff(空).length === sh.shelfList().length,
    '1冊も出していなければ、出している側は空・出していない側はぜんぶ')
  ok(ab.shelvesOn(全部).length === sh.shelfList().length && ab.shelvesOff(全部).length === 0,
    'ぜんぶ出していれば、逆になる')
  ok(ab.shelvesOn(null).length === 0, '読めていないときは、出していない扱い(既定は出さない側)')
  ok(ab.nfUnitsOn(全部).length === nf.NATIVE_FLOW_UNITS.length
    && ab.nfUnitsOn(空).length === 0, 'Native Flow も、出ている / 出ていないが逆になる')
  /* **すでにその向きのものは、窓口を呼ばない**(変えていない冊まで書き直さない) */
  ok(ab.nfAllTodo(全部, true).length === 0 && ab.nfAllTodo(空, true).length === nf.NATIVE_FLOW_UNITS.length,
    '丸ごと出すとき、すでに出している Unit は書き直さない')
  ok(ab.nfAllTodo(全部, false).length === nf.NATIVE_FLOW_UNITS.length && ab.nfAllTodo(空, false).length === 0,
    '丸ごと外すときも、同じ')
  /* **文言は、誰に・何を・どうしたかを言う** */
  ok(/山田/.test(ab.doneText('山田', 'X', true)) && /出しました/.test(ab.doneText('山田', 'X', true))
    && /外しました/.test(ab.doneText('山田', 'X', false)),
    '知らせは、誰に・何を・どうしたかを言う')
  ok(ab.doneText('山田', 'X', true) !== ab.doneText('山田', 'X', false),
    '出したときと外したときで、言い方が変わる')
  ok(/3/.test(ab.stoppedText(3, new Error('だめ'))) && /だめ/.test(ab.stoppedText(3, new Error('だめ'))),
    '途中で断られたら、どこまで通ったかと理由を言う')

  /* **Supabase を引き連れない**(素の node で走らせられる) */
  const abSrc = noNote(readFileSync(new URL('../src/lib/assignBooks.js', import.meta.url), 'utf8'))
  ok(!/supabase|import\.meta\.env/i.test(abSrc), '判断と文言は、素の node で走らせられる')
  /* **名前の作り方は、ここでも書かない** */
  ok(!/'shelf:'|'nf:'/.test(abSrc), "名前('shelf:…' / 'nf:…')を組み立てていない")

  /* **2つの画面が、同じところから引いている** */
  const tl = noNote(read('components/TrainerLearners.jsx'))
  const asg = noNote(read('components/AssignBooks.jsx'))
  for (const [src, name] of [[tl, 'ゲストのページ'], [asg, 'アサインする']]) {
    ok(/from '\.\.\/lib\/assignBooks\.js'/.test(src), `${name} … 判断と文言を1か所から引いている`)
    ok(!/さんの画面に「/.test(src), `${name} … 知らせの文を書き写していない`)
    ok(/<AssignShelf[\s/>]/.test(src), `${name} … 冊の行は同じ部品`)
  }
  /* **「レベルとスコア」からは移した**(決める場所と、出る場所をそろえる) */
  ok(!/LEARNER_FEATURES\.map/.test(tl),
    'ゲストのページ … 冊の札を、レベルとスコアの中に置いていない')
  ok(/group="word"/.test(tl) && /group="qr"/.test(tl),
    'ゲストのページ … 単語帳のタブと Quick Response のタブに分けて出す')

  /* **メニューに足した。ゲストは追い出す**(効かない画面を見せない) */
  const app = noNote(read('App.jsx'))
  ok(/id: 'assign', label: 'アサインする'/.test(app), 'メニューに「アサインする」がある')
  ok(/'materials', 'learners', 'admin', 'assign'/.test(app),
    'ゲストが開いたら、宿題の画面へ戻す')
  ok(/<AssignBooks \/>/.test(app), '行き先が描かれている')

  /* **教材は、ここには出さない**(利用者の指定で冊だけ) */
  ok(!/loadMaterials|assignMaterial/.test(asg), 'アサインする … 教材は出していない(冊だけ)')

  /* **骨組みが、本物の札を描いている** */
  const sc = noNote(read('__screens.jsx'))
  ok(/<AssignShelf[\s/>]/.test(sc), '骨組み … 本物の行を描いている')
  ok(/group="word"/.test(sc) && /group="qr"/.test(sc),
    '骨組み … 2つの帳面とも描いている(振り分けを壊したら赤くなる)')
  const bar = noNote(readFileSync(new URL('../scripts/test-bar.mjs', import.meta.url), 'utf8'))
  ok(/\['assign', ''\]/.test(bar), 'すき間の見張りに assign が入っている')
}

/* ────────────────────────────────────────────────────────────────
   第5.183節 場面の欄が、空になって行き止まりにならないこと

     > 教材→Speech練習→業界→エネルギーの種類まで選択し、以前ならスピーチの
     > 詳細を選べたのに、今は選べなくなっています。

   こちらでは再現しなかった(描いて数えて 23 個あった)。それでも
   **「押せるのに何も入っていない欄」が出る形**にはなっていたので、
   ①どの業界でも場面が必ず1つ以上あること
   ②万一0件でも、黙って空の欄を出さないこと
   の2つを見張る。
   ──────────────────────────────────────────────────────────────── */
{
  const g = await import('../src/data/genres.js')
  const ind = await import('../src/data/industries.js')
  const noNote = (src) => src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1 ')

  /* **どの業界・趣味でも、場面が空にならない。**
     ここが空になると、画面には**何も選べない欄**が出る */
  const 空スピーチ = ind.INDUSTRIES.filter((x) => g.speechScenesFor(x.id).length === 0)
  ok(空スピーチ.length === 0, 'どの業界でも、スピーチの場面が1つ以上ある',
    空スピーチ.map((x) => x.id).join(', '))
  const 空会話 = ind.INDUSTRIES.filter((x) => g.scenesFor(x.id).length === 0)
  ok(空会話.length === 0, 'どの業界でも、会話の場面が1つ以上ある',
    空会話.map((x) => x.id).join(', '))
  /* **登録の無い業界でも落ちない**(当てずっぽうの id を渡してみる) */
  ok(g.speechScenesFor('そんな業界は無い').length > 0
    && g.scenesFor('そんな業界は無い').length > 0,
    '知らない業界でも、共通の場面に落ちる(行き止まりにならない)')

  /* **万一0件でも、空の欄を出さない**(黙って行き止まりにしない) */
  const mf = noNote(readFileSync(new URL('../src/components/MaterialForm.jsx', import.meta.url), 'utf8'))
  ok(/sceneList\.length === 0 \?/.test(mf),
    '場面が0件のときは、選ぶ欄のかわりに断りを出す')
  ok(/notice notice--warn/.test(mf) && /再読み込み/.test(mf),
    'その断りに、どうすればよいかまで書いてある')
}

/* ────────────────────────────────────────────────────────────────
   第5.184節 「出しかた」は、絵だけにする

     > そして、単語帳とクイックレスポンスの右上の「出し方」を
     > 添付したソートアイコンにして、文字をなくしてください

   **見た目(大きさ・絵が真ん中にいるか)は `npm run test:bar` が描いて
   測る。** こちらで見るのは、素の node で読めること —— つまり
   **どの絵を使っているか**と、**名前を消していないか**である。

   **歯車を使い回さない**(CLAUDE.md「違うものに、同じ名前を付けない」の
   絵の側)。歯車は「設定」、ソートアイコンは「並べ方・絞り方」である。
   ──────────────────────────────────────────────────────────────── */
{
  const noNote = (src) => src
    .replace(/\/\*[\s\S]*?\*\/|\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1 ')
  const read = (f) => noNote(readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8'))
  const icons = read('components/Icons.jsx')
  const rs = read('components/ReviewScope.jsx')

  /* **絵そのものがあるか。** 添付の絵は**長さの違う横3本線**である */
  ok(/export function SortIcon\b/.test(icons), 'ソートアイコンがある(`SortIcon`)')
  {
    const m = icons.match(/export function SortIcon[\s\S]*?\n\}/)
    const d = (m?.[0].match(/d="([^"]+)"/) ?? [])[1] ?? ''
    /* **`h` の長さを読む。** 3本とも同じ長さだと「ただの三本線(☰)」で、
       メニューの絵と見分けが付かない ——
       **値を書き写さず、性質(短くなっていく)で見る**(CLAUDE.md) */
    const 長さ = [...d.matchAll(/h(\d+(?:\.\d+)?)/g)].map((x) => Number(x[1]))
    ok(長さ.length === 3, '横線は3本', 長さ.join(' / '))
    ok(長さ.length === 3 && 長さ[0] > 長さ[1] && 長さ[1] > 長さ[2],
      '上から順に短くなる(☰ と見分けが付く)', 長さ.join(' / '))
  }

  /* **使っているのは、その絵か。** 絵を足しただけで使っていなければ
     画面は変わらない。**歯車に戻したら赤くなる** */
  ok(/<SortIcon\b/.test(rs), '「出しかた」が `SortIcon` を描いている')
  ok(!/GearIcon/.test(rs), '「出しかた」に歯車を使っていない(役目が違う)')

  /* **文字を消しても、名前は消さない。**
     読み上げには「ボタン」としか聞こえなくなる(**黙って消さない**) */
  ok(/aria-label=\{出しかたと呼ぶ\}/.test(rs) && /title=\{出しかたと呼ぶ\}/.test(rs),
    '名前は `aria-label` と `title` が持っている')
  /* **呼び名を2か所に書かない。** 素の文字列で書くと、片方だけ古くなる */
  ok((rs.match(/'出しかた'/g) ?? []).length === 1,
    '「出しかた」という文字列は1か所だけ', `${(rs.match(/'出しかた'/g) ?? []).length} か所`)

  /* **見張りのほうも、文字で探していないか。**
     `test-bar` の「畳んだ箱を開く」は `textContent` で押していた ——
     文字を消したら当たらなくなり、**黙って見張りが減る** */
  const bar = noNote(readFileSync(new URL('../scripts/test-bar.mjs', import.meta.url), 'utf8'))
  ok(/getAttribute\('aria-label'\)[\s\S]{0,120}出しかた|出しかた[\s\S]{0,200}getAttribute\('aria-label'\)/.test(bar),
    'すき間の見張りが、絵だけのボタンも `aria-label` で押せる')
}

/* ────────────────────────────────────────────────────────────────
   第5.186節 アサインの欄を、冊をえらぶのと同じ 1行1冊にする

     > 教材のアサイン内に説明は一才必要ありません。消してください。
     > シンプルに単語帳とquick responseの冊を選ぶ方法と同じ仕様にしてください。

   **見た目(1行1冊・印・数・畳んだ形)は `npm run test:bar` が描いて測る。**
   こちらで見るのは、素の node で読めること —— つまり
   **説明を持っていないか**と、**呼び名を2か所に書いていないか**である。
   ──────────────────────────────────────────────────────────────── */
{
  const noNote = (src) => src
    .replace(/\/\*[\s\S]*?\*\/|\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1 ')
  const read = (f) => noNote(readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8'))

  /* **説明を持っていない**(利用者の指定「一才必要ありません」)。
     コメントを落としてから、**使っている形**で数える(CLAUDE.md)——
     説明の文にも `field-hint` という語は出てくる */
  for (const f of ['AssignShelf', 'ShelfAssign', 'NativeFlowAssign', 'AssignBooks']) {
    const src = read(`components/${f}.jsx`)
    ok(!/className="tip|className={`tip/.test(src), `${f} … 説明の囲み(tip)を持っていない`)
  }
  /* **`field-hint` は1つも無い。** `ShelfAssign` の「単語帳を足す」は
     `field-label`(欄の名前)であって、説明ではない */
  for (const f of ['AssignShelf', 'ShelfAssign', 'NativeFlowAssign']) {
    ok(!/field-hint/.test(read(`components/${f}.jsx`).replace(/note\.kind === 'busy'\s*\n?\s*\? 'field-hint'/g, ' ')),
      `${f} … 説明の1行(field-hint)を持っていない`)
  }

  /* **中身の部品は、囲みも見出しも持たない**(外側は `AssignShelf` の役目)。
     持つと、開いた行の中に**カードが入れ子**になって見た目が割れる */
  for (const f of ['ShelfAssign', 'NativeFlowAssign']) {
    const src = read(`components/${f}.jsx`)
    ok(!/className="card|card-title/.test(src), `${f} … 囲みと見出しを持っていない`)
  }

  /* **見た目は、冊をえらぶのと同じものを着る**(`.shelf`)。
     別の名前を作ると、そこから2つの見た目に分かれていく */
  const as = read('components/AssignShelf.jsx')
  ok(/className="shelf assignshelf"/.test(as), '冊の行は `.shelf` を着ている(`BookShelf` と同じ)')
  /* **呼び名は、データの側が持つ**(書き写さない) */
  ok(/SHELF_BOOK_LABEL/.test(as) && !/'業種べつの単語帳'/.test(as),
    '「業種べつの単語帳」は `SHELF_BOOK_LABEL` から引いている')
  ok(/NF_BOOK_LABEL/.test(as) && !/'Native Flow'/.test(as),
    '「Native Flow」は `NF_BOOK_LABEL` から引いている')
  /* **その呼び名を、知らせの文も使っている**(画面と知らせで言い方を変えない) */
  const ab = read('lib/assignBooks.js')
  ok(/SHELF_BOOK_LABEL/.test(ab) && /NF_BOOK_LABEL/.test(ab),
    '知らせの文も、同じ呼び名から作っている')

  /* **使わなくなった部品は、部品ごと消してある**(`FeatureToggle`) */
  ok(!existsSync(new URL('../src/components/FeatureToggle.jsx', import.meta.url)),
    '使わなくなった `FeatureToggle.jsx` は消してある')

  /* **すき間の見張りが、畳んだ冊の行を開いているか。**
     ここを足し忘れると、35 冊のプルダウンも Unit の札も
     **誰も測らなくなる**(「出しかた」の文字を消したときと同じ形)。
     **見張りの見張り**である */
  const bar = noNote(readFileSync(new URL('../scripts/test-bar.mjs', import.meta.url), 'utf8'))
  ok(/\.assignshelf \.shelf-pick[\s\S]{0,200}aria-expanded[\s\S]{0,80}click\(\)/.test(bar),
    'すき間の見張りが、畳んだ冊の行も開いてから測る')
}

console.log(ng
  ? `\n❌ ${ng} 件が意図どおりではありません`
  : '\n✅ 止めた場所からの再生の検証は、すべて意図どおりです')
process.exit(ng ? 1 : 0)
