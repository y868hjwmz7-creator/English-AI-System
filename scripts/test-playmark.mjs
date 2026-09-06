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
  MAX_PARTS, pastedParagraphs, speakerLine, speechBrief,
} from '../src/lib/speechDraft.js'
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

console.log(ng
  ? `\n❌ ${ng} 件が意図どおりではありません`
  : '\n✅ 止めた場所からの再生の検証は、すべて意図どおりです')
process.exit(ng ? 1 : 0)
