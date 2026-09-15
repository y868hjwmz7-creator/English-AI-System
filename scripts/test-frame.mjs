/**
 * 英文の「型」の見分けを、**実際の文で数える**(2026-09 利用者の指定)。
 *
 *   > 型の見分け、使い分けは必ず実現したいトレーニングです
 *
 * ============================================================================
 * 【この検証が守るもの】
 *
 *   ① 型の一覧(`sentenceFrames.js` の 66 型)と、見分けの規則が
 *      **食い違っていないこと。** 型を足して規則を足し忘れたら赤くなる
 *      (`check.sql` と移行の関係とまったく同じ作法)
 *   ② 66 の例文が、**それぞれ自分の型**に当たること
 *   ③ **型が付いてはいけない文に、付かないこと。**
 *      「出る」と「出ない」の両方を見ないと、
 *      **どこにも出さない形にも、全部に出す形にも**書き換えられてしまう
 *   ④ 絞り込みが**本当に効く形**になっていること(鍵・空・数え上げ・組み直し)
 *   ⑤ **画面が本当に呼んでいる**こと。
 *      算段だけ直っていても、画面が呼んでいなければ何も変わらない
 *
 * 【いちばん危ない形を、検証の中に必ず置く】(CLAUDE.md)
 *
 *   空の文字列・1語だけの文・疑問文・終わりの記号が無い名詞のかたまり・
 *   終わりの記号が**有る**同じ並びの文。
 *   「無ければ素通り」する形だけを並べると、壊しても緑のままになる。
 *
 * 【なぜ素の node で走るのか】
 *   `frameMatch.js` は Supabase も `import.meta.env` も引き連れていない
 *   (`playMark.js` / `posGroups.js` と同じ)。だから**ここで直に読める。**
 * ============================================================================
 */
import { readFileSync } from 'node:fs'
import { FRAME_SECTIONS, frameCount } from '../src/data/sentenceFrames.js'
import {
  FRAME_FORMS, FRAME_INDEX, FRAME_RULES, SAME_SHAPE,
  frameFormOf, frameRuleAudit, frameWords, matchFrame,
} from '../src/lib/frameMatch.js'
import {
  FILTER_KEYS, applyWordbookFilter, countNarrowed, emptyFilter, frameOf,
} from '../src/lib/wordbookFilter.js'
import { runKeyOf } from '../src/lib/reviewScope.js'
import { NATIVE_FLOW } from '../src/data/nativeFlow.js'
import { COLLOCATIONS } from '../src/data/collocations.js'

const ROOT = new URL('..', import.meta.url).pathname
const readD = (p) => readFileSync(ROOT + p, 'utf8')
/** **コメントを落としてから数える。** 説明文にも同じ語が出てくる */
const code = (p) => readD(p)
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|[^:])\/\/.*$/gm, '$1 ')

let ng = 0
const ok = (cond, label, extra = '') => {
  if (cond) { console.log('  ✓', label) } else { ng += 1; console.log('  ✗', label, extra) }
}
const head = (t) => console.log(`\n▶ ${t}`)

/* ────────────────────────────────────────────────────────────
   ① 型の一覧と、見分けの規則が食い違っていないか
   ──────────────────────────────────────────────────────────── */
head('型の一覧と、見分けの規則')

const audit = frameRuleAudit()
ok(audit.missing.length === 0,
  '型を足して、規則も「見分けない」札も足し忘れていない', audit.missing.join(' / '))
ok(audit.extra.length === 0,
  '規則が、在りもしない型を指していない(書き間違い)', audit.extra.join(' / '))
ok(audit.dup.length === 0, '同じ型に、規則が2つ無い', audit.dup.join(' / '))
ok(audit.strayShape.length === 0,
  '「見分けない」札が、在りもしない型を指していない', audit.strayShape.join(' / '))

/* **一覧を勝手に減らさない**(業種・趣味・声の名簿と同じ・共通ルール) */
ok(FRAME_FORMS.length >= 66, `型が 66 以上ある(いま ${FRAME_FORMS.length})`)
ok(FRAME_FORMS.length === frameCount(),
  '型の数が、巻末に刷る数(`frameCount()`)と同じ')
ok(FRAME_INDEX.size === FRAME_FORMS.length, '同じ名前の型が2つ無い')

/* **見分けないものには、必ず理由が書いてある。黙って落とさない** */
for (const [f, v] of SAME_SHAPE) {
  ok(FRAME_INDEX.has(v.as) && (v.why ?? '').length > 20,
    `「${f}」は「${v.as}」に寄せる、と理由つきで書いてある`)
}

/* ────────────────────────────────────────────────────────────
   ② 66 の例文が、それぞれ自分の型に当たるか
   ──────────────────────────────────────────────────────────── */
head('型そのものの例文(66)')

const wantOf = (form) => SAME_SHAPE.get(form)?.as ?? form
const misses = []
let hit = 0
for (const sec of FRAME_SECTIONS) {
  for (const g of sec.groups) {
    for (const r of g.rows) {
      const got = matchFrame(r.ex)?.form ?? null
      if (got === wantOf(r.form)) hit += 1
      else misses.push(`${r.form} → ${got ?? '型なし'} | ${r.ex}`)
    }
  }
}
ok(hit === FRAME_FORMS.length,
  `66 の例文が、ぜんぶ自分の型に当たる(${hit} / ${FRAME_FORMS.length})`,
  `\n      ${misses.join('\n      ')}`)

/* **節をまたいで散らばっているか。**「全部 ①」のような形になっていないか */
const bySection = new Set(FRAME_SECTIONS.flatMap((s) => s.groups.flatMap((g) => g.rows))
  .map((r) => matchFrame(r.ex)?.sectionId).filter(Boolean))
ok(bySection.size === FRAME_SECTIONS.length,
  `①②③のどの節の型も、実際に当たっている(${bySection.size} 節)`)

/* ────────────────────────────────────────────────────────────
   ③ 型が付いてはいけない文に、付かないか
   ──────────────────────────────────────────────────────────── */
head('型が付いてはいけない文')

/** **わざと紛らわしいものだけ**を並べる。素通りする形を置かない */
const NO_FRAME = [
  ['', '空の文字列'],
  ['   ', '空白だけ'],
  ['Sure.', '1語'],
  ['What is your name?', '疑問文(What + be)'],
  ['What do you think?', '疑問文(What + 助動詞)'],
  ['What have you been up to?', '疑問文(What + have)'],
  ['Nothing is impossible.', '`-ing` で終わる代名詞'],
  ['Anything will do.', '同上'],
  ['The door opened slowly.', 'ふつうの過去の文(過去分詞と同じ並び)'],
  ['We sent the report yesterday.', '同上'],
  ['He made a good fortune from scratch.', '`make + 名詞`(原形の動詞ではない)'],
  ['I need to make a decision soon.', '`make + 名詞 + 副詞`'],
  ['He left the office early.', '`leave + 名詞 + 副詞`(early は形容詞でもある)'],
  ['The temperature dropped last night.', '`-ure` は名詞化ではない'],
  ['He is a doctor.', 'ただの be 動詞の文'],
  ['The bus leaves at noon.', '`leave` だが目的語が無い'],
  ['I showed him the report.', '`show` だが節が続かない'],
  /* **名詞のかたまりと1文字も違わない並び。** 違うのは終わりの記号だけである
     —— 下の「付いてほしい文」に `the email sent this morning` を置いてある */
  ['The email sent this morning.', '**終わりの記号が有る**ので、名詞のかたまりではない'],
  ['The report sent yesterday was wrong.', '同上(be 動詞も有る)'],
]
for (const [s, why] of NO_FRAME) {
  const got = matchFrame(s)
  ok(got === null, `型なし … ${why}`, got ? `→ ${got.form} | ${s}` : '')
}

/* ────────────────────────────────────────────────────────────
   ④ 付いてほしい文に、ちゃんと付くか(**別の語で書いたもの**)
   ──────────────────────────────────────────────────────────── */
head('型そのものの例文ではない文')

/* **例文を書き写さない。** 同じ型を、別の語で書いたもので確かめる ——
   例文だけに当たる規則(丸暗記)になっていたら、ここで赤くなる */
const OTHER_WORDS = [
  ['The new system allows staff to book rooms online.', 'S allows 人 to do'],
  ['Heavy rain prevented the team from finishing.', 'S prevents 人 from ~ing'],
  ['Poor planning leads to confusion.', 'S leads to 名詞'],
  ['The delay left the customers angry.', 'S leaves 人 形容詞'],
  ['We keep the door open.', 'S keeps 人/物 形容詞'],
  ['The noise made it hard for the team to focus.', 'S makes it hard for 人 to do'],
  ['The setup takes two hours to finish.', 'S takes (人) 時間 to do'],
  ['When it comes to safety, we never cut corners.', 'When it comes to ~'],
  ['Skipping breakfast hurts your focus.', '動名詞'],
  ['Their decision to sign delayed everything.', '名詞化(動詞→名詞)'],
  /* **名詞のかたまり**(終わりの記号が無い)。上の「付いてはいけない」と対にしてある */
  ['the file that we uploaded this morning', '関係詞'],
  ['the people waiting outside', '現在分詞'],
  ['the email sent this morning', '過去分詞'],
  ['our target, a 15% cut', '同格'],
  ['Having checked the numbers, we signed.', '分詞構文'],
]
for (const [s, want] of OTHER_WORDS) {
  const got = matchFrame(s)?.form ?? '型なし'
  ok(got === want, `${want} … ${s}`, `→ ${got}`)
}

/* **記号の書きぶりで、答えが変わらない。**
   実データのアポストロフィは右シングル引用符である(`docs/notes/20-…`) */
head('記号の書きぶりで、答えが変わらない')
ok(matchFrame('That’s why we moved the meeting.')?.form === "That's why ~",
  '右シングル引用符の `That’s why` も当たる')
ok(matchFrame("There's a problem.")?.form === matchFrame('There is a problem.')?.form,
  '短縮形をほどいても、ほどかなくても同じ型')
ok(frameWords('It’s hard.').join(' ') === 'it is hard',
  '`It’s` は `it is` にほどける')
ok(frameWords('our goal, a 20% increase').includes(','),
  'コンマは1語として残る(同格と「The 比較級, the 比較級」で要る)')

/* ────────────────────────────────────────────────────────────
   ⑤ 実データ —— **ファイルに持った教材で、取り違えていないか**
   ──────────────────────────────────────────────────────────── */
head('実データ(Native Flow 690 + コロケーション 50)')

const real = [...NATIVE_FLOW.map((x) => x.en), ...COLLOCATIONS.map((x) => x.en)]
const tagged = real.filter((e) => matchFrame(e))
ok(real.length > 700, `見る文が ${real.length} 本ある`)
ok(tagged.length > 0, '実データにも、型の付く文がある')
/* **全部に型を付ける形**に書き換えたら、ここで赤くなる。
   短い言い回しの集まりなので、型が付くほうが少ないのが正しい */
ok(tagged.length < real.length * 0.2,
  `やみくもに型を付けていない(${tagged.length} / ${real.length})`)
const kinds = new Set(real.map((e) => matchFrame(e)?.form).filter(Boolean))
ok(kinds.size >= 5, `1つの型に寄せていない(${kinds.size} 種類)`)

/* ────────────────────────────────────────────────────────────
   ⑥ 絞り込みが、本当に効く形か
   ──────────────────────────────────────────────────────────── */
head('型で絞り込む')

ok(FILTER_KEYS.includes('frame'), '絞り込みの鍵に `frame` が入っている')
ok('frame' in emptyFilter(), '「ぜんぶ外す」が `frame` も外す')
ok(countNarrowed({ frame: 'S allows 人 to do' }) === 1, '札の数に `frame` が数えられる')
ok(runKeyOf({ scope: 'all', size: 20, filter: { frame: 'S allows 人 to do' } })
  !== runKeyOf({ scope: 'all', size: 20, filter: {} }),
  '型を選ぶと、出題が組み直される(`runKeyOf`)')

/* Quick Response の問は `en`、単語帳の語は `seen_in`。**どちらも見る** */
ok(frameOf({ en: 'This tool allows you to share files instantly.' })?.key === 'S allows 人 to do',
  'Quick Response の問(`en`)から型が出る')
ok(frameOf({ seen_in: 'This tool allows you to share files instantly.' })?.key === 'S allows 人 to do',
  '単語帳の語(出会った文 `seen_in`)から型が出る')
ok(frameOf({ en: 'Sure.' }) === null, '型を言い当てられない行は、選択肢に出ない')
ok((frameOf({ en: 'What we need is more time.' })?.group ?? '').startsWith('③'),
  '見出しが節の番号から始まる(`<optgroup>` に出す)')

const SAMPLE = [
  { en: 'This tool allows you to share files instantly.' },
  { en: 'The update enabled us to cut the cost in half.' },
  { en: 'Sure.' },
]
ok(applyWordbookFilter(SAMPLE, { frame: 'S allows 人 to do' }).length === 1,
  '型で絞ると、その型の行だけになる')
ok(applyWordbookFilter(SAMPLE, {}).length === SAMPLE.length,
  '何も絞らなければ、これまでどおり全部出る')
ok(applyWordbookFilter(SAMPLE, { frame: 'A rather than B' }).length === 0,
  '当てはまらない型を選べば 0 件(黙って全部出したりしない)')

/* **控えが答えを変えない。** 二度目も同じでなければ、画面が描き直すたびに変わる */
const twice = [frameFormOf('The results encouraged us to expand.'),
  frameFormOf('The results encouraged us to expand.')]
ok(twice[0] === twice[1] && twice[0] === matchFrame('The results encouraged us to expand.').form,
  '控えを引いても、引かなくても同じ型')

/* ────────────────────────────────────────────────────────────
   ⑦ 画面が、本当に呼んでいるか
   ──────────────────────────────────────────────────────────── */
head('画面が呼んでいるか')

const filterJsx = code('src/components/WordbookFilter.jsx')
ok(/frameOf\(/.test(filterJsx), '絞り込みの行が `frameOf()` を呼んでいる')
ok(/show\.frame/.test(filterJsx) && /set\(\{ frame:/.test(filterJsx),
  '型のプルダウンが在り、選ぶと絞り込みに渡る')
ok(/FRAME_FORMS/.test(filterJsx),
  '選択肢の並びを `FRAME_FORMS` から作っている(五十音順に並べ替えていない)')
ok(/optgroup/.test(filterJsx), '①②③の見出しで分けている')

const cardJsx = code('src/components/QrCard.jsx')
ok(/frameFormOf\(/.test(cardJsx), '答えの囲みが `frameFormOf()` を呼んでいる')
ok(/showFrame/.test(cardJsx), '出すかどうかは、呼ぶ側が決める(`showFrame`)')
ok(/showFrame = false/.test(cardJsx), '**既定は出さない**(言われていない場所を変えない)')

const reviewJsx = code('src/components/QrReview.jsx')
ok(/showFrame/.test(reviewJsx), 'Quick Response の復習は、型を出す')
const qrJsx = code('src/components/QuickResponse.jsx')
ok(!/showFrame/.test(qrJsx),
  '教材の中の Quick Response には渡していない(紙と集中モードを変えない)')

/* **すき間ゼロでくっつけない**(共通ルール)。`gap` で離しているか */
const css = readD('src/styles.css')
const qrAnswer = css.match(/\.qr-answer \{[^}]*\}/g)?.join(' ') ?? ''
ok(/gap:/.test(qrAnswer), '答えと型のあいだを `gap` で離している')
ok(!/margin-top/.test(css.match(/\.qr-frame \{[^}]*\}/)?.[0] ?? ''),
  '型の札に `margin-top` を付けて回っていない')
const frameCss = css.match(/\.qr-frame \{[^}]*\}/)?.[0] ?? ''
ok(/border:/.test(frameCss) && /font-weight: *[67]00/.test(frameCss),
  '色だけに頼っていない(枠線 + 太字)')

/* ────────────────────────────────────────────────────────────
   おしまい
   ──────────────────────────────────────────────────────────── */
console.log(`\n規則 ${FRAME_RULES.length} 本 / 型 ${FRAME_FORMS.length}`)
if (ng > 0) {
  console.log(`\n❌ ${ng} 件、意図どおりではありません`)
  process.exit(1)
}
console.log('\n✅ 型の見分けは、すべて意図どおりです')
