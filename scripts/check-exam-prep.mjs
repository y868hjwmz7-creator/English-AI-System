/**
 * ============================================================================
 * **テスト対策の PART が、本当に作れる形になっているか**(第5.309節)
 *
 *   > 各テストの試験の構成を調べ、各PART毎に対策の練習問題を
 *   > 作成できるようにしたいです。
 *
 * ── なぜ機械で見るのか ──────────────────────────────────────
 *
 *   PART は **69 個**ある。1つでも
 *
 *     ・表の制約に無い演習を使っている
 *     ・作り方(`make`)が空
 *     ・写真が要るのに、えらべる一覧に出ている
 *
 *   と、**その PART をえらんだ人だけが「作れませんでした」に当たる。**
 *   `npm run lint` も `npm run build` も通る —— **えらぶまで分からない。**
 *
 * ── **いちばん危ない形を、検証の中に必ず1つ置く**(CLAUDE.md)────
 *
 *   ここでは「**書いた `make` が、演算子の優先順位で消えていないか**」
 *   である。実際に書いたその日に踏んだ ——
 *
 *       + 'question に …' + g.write === 'summary' ? 'A' : 'B'
 *
 *   `+` は `? :` より先に効くので、**手前の文がまるごと条件式に飲まれ、
 *   いつも同じ枝が返る。** 画面も検証も、それでは気づけない。
 *   だから**長さと、頭の文字**の両方を数える。
 * ============================================================================
 */
import { readFileSync } from 'node:fs'

const {
  DEFAULT_EXAM, EXAMS, EXAM_KIND, examBrief, examBriefByKey, examKeyOf, examLabel,
  examOf, examOutline, examPartLine, examPartOf, examPartsOf, examSectionsByKey,
  examSectionsOf, examSkipLine, examSkipsOf, examTitle, firstPartOf,
  BLANK_AXES, FORMATS, TRAPS, choiceBrief, choicesOf, formatOf, partialOf,
} = await import('../src/data/examPrep.js')
const { DROP_REASONS, emptyDropCounts, isExhausted }
  = await import('../src/lib/dropReasons.js')
const { EXERCISE_TYPES, defaultSectionsFor, isBlankItem, isPassageSection, sectionsFor }
  = await import('../src/data/exerciseTypes.js')
const { MATERIAL_KINDS, NEW_MATERIAL_KINDS, isExamKind, needsWeakTag }
  = await import('../src/data/materialKinds.js')

let bad = 0
const ok = (s) => console.log(`✓ ${s}`)
const ng = (s, d = '') => { bad += 1; console.log(`✗ ${s}${d ? `\n    ${d}` : ''}`) }

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')
/** **コメントを落としてから数える**(CLAUDE.md)。説明にも同じ語が出る */
const noC = (t) => t.replace(/\/\*[\s\S]*?\*\/|\{\/\*[\s\S]*?\*\/\}/g, '')

/** すべての PART を、試験ごと平らに並べる(えらべないものも含む) */
const ALL = EXAMS.flatMap((e) => (e.parts ?? []).map((p) => ({ exam: e, part: p })))
/** **えらべる PART だけ** */
const PICKABLE = EXAMS.flatMap((e) => examPartsOf(e.id).map((p) => ({ exam: e, part: p })))

/* ══════════════════════════════════════════════════════════════════
   ① **一覧そのものの形**
   ══════════════════════════════════════════════════════════════════ */
{
  /* **「無ければ素通り」する検証を書かない**(CLAUDE.md)。
     一覧が空でも緑になる形にしない —— **下限を置く** */
  if (EXAMS.length < 6) {
    ng('試験 … 数が少なすぎる(利用者が並べた6種類より減っている)', EXAMS.length)
  } else ok(`試験 … ${EXAMS.length} 種類`)
  if (PICKABLE.length < 40) {
    ng('PART … えらべる数が少なすぎる(検証が何も見ていないのと同じ)', PICKABLE.length)
  } else ok(`PART … えらべるもの ${PICKABLE.length} 個 / 全部で ${ALL.length} 個`)

  /* **利用者が並べた6つが、ぜんぶ入っているか。**
     「英検」は級ごとに分けてあるので、**前方一致**で見る */
  const 欲しい = ['TOEIC L&R', '英検', 'VERSANT', 'TOEIC Speaking', 'TOEFL', 'IELTS']
  const 無い = 欲しい.filter((w) => !EXAMS.some((e) => e.label.startsWith(w)))
  if (無い.length) ng('試験 … 利用者が挙げたものが足りない', 無い.join(' / '))
  else ok(`試験 … 利用者が挙げた ${欲しい.length} つは、ぜんぶ並んでいる`)

  /* **id が重なっていないか**(重なると、あとのほうが永久に引けない) */
  const ids = EXAMS.map((e) => e.id)
  if (new Set(ids).size !== ids.length) {
    ng('試験 … id が重なっている', ids.join(' / '))
  } else ok('試験 … id は重なっていない')
  const 重なり = EXAMS
    .map((e) => [e.id, (e.parts ?? []).map((p) => p.id)])
    .filter(([, ps]) => new Set(ps).size !== ps.length)
    .map(([id, ps]) => `${id} … ${ps.join(' / ')}`)
  if (重なり.length) ng('PART … 同じ試験の中で id が重なっている', 重なり.join('\n    '))
  else ok('PART … 同じ試験の中で id は重なっていない')
}

/* ══════════════════════════════════════════════════════════════════
   ② **えらべる PART は、どれも本当に作れるか**
   ══════════════════════════════════════════════════════════════════ */
{
  const 演習 = new Set(EXERCISE_TYPES.map((t) => t.id))
  const 悪い = []
  for (const { exam, part } of PICKABLE) {
    const 頭 = `${exam.id} / ${part.id}`
    if (!part.label) 悪い.push(`${頭} … 名前が無い`)
    if (!part.what) 悪い.push(`${頭} … 何をする問題かが無い`)
    if (!(part.sections ?? []).length) 悪い.push(`${頭} … 演習の組み合わせが無い`)
    for (const sec of part.sections ?? []) {
      if (!演習.has(sec.exercise_type)) {
        悪い.push(`${頭} … 知らない演習「${sec.exercise_type}」`)
      }
      if (!(Number(sec.count) > 0)) 悪い.push(`${頭} … ${sec.exercise_type} の数が 0`)
    }
  }
  if (悪い.length) ng('PART … 作れない形のものがある', 悪い.join('\n    '))
  else ok(`PART … えらべる ${PICKABLE.length} 個は、どれも作れる形`)

  /* ── **表の制約に、その演習が入っているか** ──
     入っていないと、**発行した瞬間に**
     「violates check constraint material_sections_type_check」で止まる。
     `lint` も `build` も通る(CLAUDE.md「演習の種類を足す場所は5つ」) */
  const 制約 = read('supabase/migrations/0007_material_sections.sql')
  const 一覧 = /material_sections_type_check check \(exercise_type in \(([\s\S]*?)\)\)/
    .exec(制約)?.[1] ?? ''
  const 許す = new Set([...一覧.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]))
  if (許す.size < 10) {
    ng('PART … 表の制約を読み取れていない(探し方が壊れている)', 許す.size)
  } else {
    const 外 = [...new Set(PICKABLE.flatMap(({ part }) =>
      (part.sections ?? []).map((s) => s.exercise_type)))].filter((t) => !許す.has(t))
    if (外.length) {
      ng('PART … 表の制約に無い演習を使っている(発行した瞬間に止まる)', 外.join(' / '))
    } else ok(`PART … 使っている演習は、ぜんぶ表の制約(${許す.size} 個)の中`)
  }

  /* ── **演習の種類を1つも増やしていないか** ──
     増やすなら窓口・表・Quick Response まで直すことになる(5か所)。
     「増やしていない」を、ここで機械的に留める */
  const 使う = new Set(PICKABLE.flatMap(({ part }) =>
    (part.sections ?? []).map((s) => s.exercise_type)))
  ok(`PART … 使っている演習は ${使う.size} 種類(${[...使う].sort().join(' / ')})`)
}

/* ══════════════════════════════════════════════════════════════════
   ③ **作り方(`make`)が、本当に届く形か**

   **ここがこの検証のいちばん大事なところ。** 実際に、書いたその日に
   演算子の優先順位で**手前の文がまるごと消えた**(英検の意見論述)。
   ══════════════════════════════════════════════════════════════════ */
{
  const 短い = []
  const 頭が違う = []
  for (const { exam, part } of PICKABLE) {
    const m = String(part.make ?? '')
    /* **長さで見る。** 数を書き写しているのではなく、
       「指示と呼べる長さがあるか」という性質である */
    if (m.length < 80) 短い.push(`${exam.id} / ${part.id} … ${m.length} 文字`)
    /* **頭に試験と PART の名前が来ているか。**
       消えたときは、途中の文だけが残って頭が無くなる ——
       **長さだけでは捕まらない**(残った側が長いことがある) */
    if (!m.startsWith(exam.label) && !m.includes(part.label.split(' ')[0])) {
      頭が違う.push(`${exam.id} / ${part.id} … 「${m.slice(0, 24)}…」`)
    }
  }
  if (短い.length) {
    ng('作り方 … 短すぎるものがある(演算子の優先順位で消えていないか)',
      短い.join('\n    '))
  } else ok(`作り方 … えらべる ${PICKABLE.length} 個とも 80 文字以上`)
  if (頭が違う.length) {
    ng('作り方 … 頭が試験・PART の名前で始まっていない(手前が消えている)',
      頭が違う.join('\n    '))
  } else ok('作り方 … どれも、試験か PART の名前から始まる')

  /* ══════════════════════════════════════════════════════════════
     **書いた欄が、その演習に本当に在るか**

     ★ **`answer_ja` が一覧から漏れていた**(2026-10-01・第5.336節)。
     `answer` のほうが先に当たり、そのあと `_ja` が続くので
     **どの場所でも拾えていなかった** —— あの欄を間違えても素通りした。
     **長い名前を先に並べる**(`answer_ja` → `answer_alt` → `answer`)。

     道具の形は `strict: true` なので、**在らない欄は必ず消える。**
     しかも **必須の欄が空のまま返ると、その問は丸ごと落とされる** ——
     5回作り直しても 0 問になり、「中身が空で返ってきました」としか出ない。

     **書いたその日に2つ踏んだ**(第5.309節)。
       ・`fill_blank` の `hint` を「空にする」と書いた
         → `hint` は必須だったので、**全問が落ちて 0 問**になる
       ・`read_aloud` に `note` を書かせようとした
         → あの演習に `note` の欄は無い(必須も任意も無し)

     どちらも**作ってみるまで分からない。** だから機械で突き合わせる。
     ══════════════════════════════════════════════════════════════ */
  {
    const fnSrc = read('supabase/functions/generate-material/index.ts')
    const blk = /const SECTION_FIELDS[\s\S]*?\n}\n/.exec(fnSrc)?.[0] ?? ''
    const 欄 = {}
    const 必須 = {}
    for (const mm of blk.matchAll(
      /(\w+):\s*\{\s*required:\s*\[([^\]]*)\],\s*optional:\s*\[([^\]]*)\]/g)) {
      必須[mm[1]] = [...mm[2].matchAll(/'(\w+)'/g)].map((x) => x[1])
      欄[mm[1]] = new Set([...必須[mm[1]],
        ...[...mm[3].matchAll(/'(\w+)'/g)].map((x) => x[1])])
    }
    if (Object.keys(欄).length < 10) {
      ng('欄 … 窓口の欄の一覧を読み取れていない(探し方が壊れている)', Object.keys(欄).length)
    } else {
      /* **日本語の「◯◯ に」「◯◯ は」だけを拾う。**
         英語の「your answer」まで数えると、どの PART も赤くなる */
      const RE = new RegExp('(?:^|[^a-z_])(prompt_en|prompt_ja|question_ja|question'
        + '|answer_ja|answer_alt|answer|audio_text|hint|note|source_en|phonetic)\\s*(?:に|には|は)', 'g')
      const 無い = []
      let 言及ぜんぶ = 0
      for (const { exam, part } of PICKABLE) {
        const ある = new Set((part.sections ?? [])
          .flatMap((sec) => [...(欄[sec.exercise_type] ?? [])]))
        /* ★ **窓口へ渡る文ぜんぶを見る**(第5.336節)。
             `make` だけを見ていたが、選択肢の指示(`choiceBrief`)も
             **欄を名指しする。** そちらが間違っていても気づけなかった */
        const 言及 = [...new Set([...examBrief(exam.id, part.id).matchAll(RE)]
          .map((x) => x[1]))]
        言及ぜんぶ += 言及.length
        const 外 = 言及.filter((f) => !ある.has(f))
        if (外.length) 無い.push(`${exam.id} / ${part.id} … ${外.join(', ')}`)
      }
      if (言及ぜんぶ < 60) {
        ng('欄 … 欄の名前をほとんど拾えていない(見張りが素通りしている)', 言及ぜんぶ)
      } else if (無い.length) {
        ng('欄 … その演習に無い欄を書かせようとしている(道具の形から必ず消える)',
          無い.join('\n    '))
      } else ok(`欄 … ${言及ぜんぶ} 回の指名は、どれもその演習に在る欄`)

      /* ── **「空にする」と書いた欄が、必須になっていないか** ──
         必須の欄が空だと、**その問は丸ごと落ちる**(0 問になる) */
      const 空にする = []
      for (const { exam, part } of PICKABLE) {
        for (const m2 of part.make.matchAll(/(\w+)\s*(?:は|には)空にする/g)) {
          for (const sec of part.sections ?? []) {
            if ((必須[sec.exercise_type] ?? []).includes(m2[1])) {
              空にする.push(`${exam.id} / ${part.id} … ${sec.exercise_type} の ${m2[1]}`)
            }
          }
        }
      }
      if (空にする.length) {
        ng('欄 … 必須の欄を「空にする」と書いている(全問が落ちて 0 問になる)',
          空にする.join('\n    '))
      } else ok('欄 … 「空にする」と書いた欄は、どれも必須ではない')
    }
  }

  /* ── **窓口へ渡す形**(`examBrief`)── */
  const 例 = examBrief(DEFAULT_EXAM, firstPartOf(DEFAULT_EXAM))
  if (!例.includes('# 試験対策') || !例.includes('## ') || 例.length < 150) {
    ng('作り方 … 窓口へ渡す形が組み立てられていない', 例.slice(0, 120))
  } else ok('作り方 … 窓口へは「# 試験対策 / ## PART / 本番では… / 作り方」で渡る')
  /* **「出る」と「出ない」の両方を見る**(CLAUDE.md)——
     知らない鍵で何かを返すと、**どの PART でも同じ指示**になる */
  for (const 鍵 of ['', 'nope:nope', 'toeic_lr:nope', 'nope:p5']) {
    if (examBriefByKey(鍵)) {
      ng('作り方 … 知らない鍵でも何かを返している(別の PART の指示が混ざる)', 鍵)
    }
  }
  ok('作り方 … 知らない鍵では、何も返さない')
  /* **PART ごとに中身が違うか。** 同じものを返していたら、
     えらんでも何も変わらない(「何も変わらない = 届いていない」) */
  const 束 = PICKABLE.map(({ exam, part }) => examBrief(exam.id, part.id))
  if (new Set(束).size !== 束.length) {
    ng('作り方 … 中身が同じ PART がある(えらんでも変わらない)',
      `${束.length} 個のうち、違うものは ${new Set(束).size} 個`)
  } else ok(`作り方 … ${束.length} 個とも中身が違う`)
}

/* ══════════════════════════════════════════════════════════════════
   ④ **写真が要る PART は、えらべない。けれど黙っては消さない**
   ══════════════════════════════════════════════════════════════════ */
{
  const 飛ばす = EXAMS.flatMap((e) => examSkipsOf(e.id).map((p) => ({ e, p })))
  if (!飛ばす.length) {
    ng('作れない PART … 1つも無い(検証が何も見ていないのと同じ)')
  } else ok(`作れない PART … ${飛ばす.length} 個(${飛ばす.map(({ p }) => p.label).join(' / ')})`)
  /* **理由が書いてあるか。**「作れません」だけでは、こちらの作りかけなのか
     そもそも無理なのかが分からない */
  const 訳なし = 飛ばす.filter(({ p }) => !String(p.cannot ?? '').trim())
  if (訳なし.length) ng('作れない PART … 理由が書いていない', 訳なし.map(({ p }) => p.label).join(' / '))
  else ok('作れない PART … どれも理由が書いてある')
  /* **えらべる一覧に混ざっていないか**(効かない操作を見せない) */
  const 混入 = PICKABLE.filter(({ part }) => part.cannot)
  if (混入.length) {
    ng('作れない PART … えらべる一覧に混ざっている', 混入.map(({ part }) => part.label).join(' / '))
  } else ok('作れない PART … えらべる一覧には出ない')
  /* **「出る」と「出ない」の両方を見る**(CLAUDE.md)——
     いつも1行出す形にしても、いつも空にしても、片方だけでは緑になる */
  const 出る = EXAMS.filter((e) => examSkipLine(e.id))
  const 出ない = EXAMS.filter((e) => !examSkipLine(e.id))
  if (!出る.length) ng('作れない PART … 1行が、どの試験でも出ない(黙って消している)')
  else if (!出ない.length) ng('作れない PART … 1行が、どの試験でも出る(要らない空白が残る)')
  else ok(`作れない PART … 1行は ${出る.length} 試験で出て、${出ない.length} 試験では出ない`)
  /* **理由も1行に入っているか** */
  const ひと行 = examSkipLine('toeic_lr')
  if (!ひと行.includes('写真')) ng('作れない PART … 1行に理由が入っていない', ひと行)
  else ok(`作れない PART … 1行はこう出る:「${ひと行}」`)
}

/* ══════════════════════════════════════════════════════════════════
   ⑤ **教材の種類と、演習の構成**
   ══════════════════════════════════════════════════════════════════ */
{
  if (!MATERIAL_KINDS.some((k) => k.id === EXAM_KIND)) {
    ng('教材の種類 … `exam` が名簿に無い')
  } else ok('教材の種類 … `exam`(テスト対策)が名簿にある')
  if (!NEW_MATERIAL_KINDS.some((k) => k.id === EXAM_KIND)) {
    ng('教材の種類 … 作る画面の選択肢に出ていない(作れない)')
  } else ok('教材の種類 … 作る画面の選択肢に出る')
  if (!isExamKind(EXAM_KIND) || isExamKind('reading') || isExamKind('')) {
    ng('教材の種類 … `isExamKind()` の見分けが合っていない')
  } else ok('教材の種類 … `isExamKind()` は `exam` のときだけ true')
  /* **弱点タグを必須にしない。** 判断は `needsWeakTag()` 1か所 */
  if (needsWeakTag(EXAM_KIND)) {
    ng('教材の種類 … テスト対策に弱点タグを必須にしている(PART が「何の練習か」である)')
  } else if (!needsWeakTag('pattern')) {
    ng('教材の種類 … 文型ドリルまで弱点タグが要らなくなっている(緩めすぎ)')
  } else ok('教材の種類 … テスト対策は弱点タグが要らない / 文型ドリルは要る')

  /* ── **PART ごとに構成が変わるか** ──
     変わらなければ、どの PART をえらんでも同じ教材になる */
  const 形 = (key) => defaultSectionsFor(EXAM_KIND, key)
    .map((s) => `${s.exercise_type}:${s.count}`).join(',')
  const 束 = PICKABLE.map(({ exam, part }) => 形(examKeyOf(exam.id, part.id)))
  if (new Set(束).size < 5) {
    ng('構成 … PART をえらんでも、ほとんど同じ形になる', `違う形は ${new Set(束).size} とおり`)
  } else ok(`構成 … PART ごとに ${new Set(束).size} とおりの形になる`)
  /* **鍵が無いときに、黙って文型ドリルへ落ちないか**(いちばん危ない形) */
  const 鍵なし = 形('')
  const ドリル = defaultSectionsFor('pattern').map((s) => `${s.exercise_type}:${s.count}`).join(',')
  if (鍵なし === ドリル) {
    ng('構成 … 鍵が無いと、黙って文型ドリルの構成に落ちている', 鍵なし)
  } else if (!鍵なし) {
    ng('構成 … 鍵が無いと、構成が空になる(何も作れない)')
  } else ok(`構成 … 鍵が無いときは、最初の PART の形(${鍵なし})`)
  /* **ほかの種類は1つも変わっていないか。**
     `defaultSectionsFor` に引数を足した日に、ここだけ静かに変わりうる */
  const ずれ = MATERIAL_KINDS.map((k) => k.id).filter((k) => k !== EXAM_KIND)
    .filter((k) => defaultSectionsFor(k).map((s) => s.exercise_type).join(',')
      !== defaultSectionsFor(k, 'toeic_lr:p5').map((s) => s.exercise_type).join(','))
  if (ずれ.length) {
    ng('構成 … テスト対策以外の種類まで、鍵で形が変わっている', ずれ.join(' / '))
  } else ok('構成 … テスト対策以外の種類は、鍵を渡しても1つも変わらない')
  /* **`sectionsFor` にも鍵が通っているか**(画面が呼ぶのはこちら) */
  const 通し = sectionsFor(EXAM_KIND, null, null, examKeyOf('toeic_lr', 'p5'))
    .map((s) => s.exercise_type).join(',')
  if (通し !== 'fill_blank') {
    ng('構成 … `sectionsFor()` に鍵が通っていない(画面が呼ぶのはこちら)', 通し)
  } else ok('構成 … `sectionsFor()` にも鍵が通る')
}

/* ══════════════════════════════════════════════════════════════════
   ⑥ **本文から作るか、1問ずつ作るか**

   これまでは種類で決めていた(`isPassageKind`)。テスト対策は PART で
   変わるので、**組んだ構成の1つめ**で決める形に変えた。
   **これまでの種類では、答えが1つも変わらないこと**を数える。
   ══════════════════════════════════════════════════════════════════ */
{
  const { isPassageKind } = await import('../src/data/materialKinds.js')
  const ずれ = MATERIAL_KINDS.map((k) => k.id).filter((k) => k !== EXAM_KIND)
    .filter((k) => isPassageKind(k)
      !== isPassageSection(defaultSectionsFor(k)[0]?.exercise_type))
  if (ずれ.length) {
    ng('道の分かれ目 … これまでの種類で答えが変わってしまう', ずれ.join(' / '))
  } else ok('道の分かれ目 … これまでの種類では、答えが1つも変わらない')
  /* **テスト対策は、PART によって両方あるか。**
     片方しか無ければ、分ける意味がない */
  const 本文 = PICKABLE.filter(({ exam, part }) =>
    isPassageSection(defaultSectionsFor(EXAM_KIND, examKeyOf(exam.id, part.id))[0]?.exercise_type))
  if (!本文.length || 本文.length === PICKABLE.length) {
    ng('道の分かれ目 … テスト対策の PART が、片方の道にしか行かない', `${本文.length} / ${PICKABLE.length}`)
  } else ok(`道の分かれ目 … 本文から作る PART ${本文.length} 個 / 1問ずつ作る PART ${PICKABLE.length - 本文.length} 個`)
}

/* ══════════════════════════════════════════════════════════════════
   ⑦ **画面と窓口が、本当にこれを使っているか**

   道具だけ作っても、画面が呼んでいなければ何も起きない
   (`noteFnRev` で踏んだ落とし穴)。
   ══════════════════════════════════════════════════════════════════ */
{
  const form = noC(read('src/components/MaterialForm.jsx'))
  const mats = noC(read('src/lib/materials.js'))
  const fn = noC(read('supabase/functions/generate-material/index.ts'))

  const 見る = [
    [/EXAMS\.map\(\(x\) =>/.test(form), '画面 … 試験の選択肢を、名簿から並べている'],
    [/examPartsOf\(examId\)\.map\(\(x\) =>/.test(form), '画面 … PART の選択肢を、名簿から並べている'],
    [/examOutline\(examId\)/.test(form), '画面 … 本番の構成(いまの状態)を出している'],
    [/examPartLine\(examId, partId\)/.test(form), '画面 … その PART の問数と中身を出している'],
    [/examSkipLine\(examId\)/.test(form), '画面 … 作れない PART の1行を出している'],
    [/setPartId\(firstPartOf\(next\)\)/.test(form),
      '画面 … 試験を変えたら PART も入れ替える(選択肢に無い値を残さない)'],
    [/examTitle\(examId, partId\)/.test(form), '画面 … 教材の名前に、試験と PART を入れている'],
    [/examKeyOf\(examId, partId\)/.test(form), '画面 … 鍵は `examKeyOf()` から組む(書き写さない)'],
    [/sectionsFor\(kind, amounts, include, isExamKind\(kind\) \? examKey : ''\)/.test(form),
      '画面 … 構成の組み立てに、鍵を渡している'],
    [/isPassageSection\(plan\[0\]\?\.exercise_type\)/.test(form),
      '画面 … 道の分かれ目は、組んだ構成の1つめで決める'],
    [/examId, partId,/.test(form), '画面 … 試験と PART を控えている(戻ったときに食い違わない)'],
    [/if \(f\.examId\) setExamId\(f\.examId\)/.test(form), '画面 … 控えから戻している'],
    /* ★ **式そのものを書き写していた**(2026-10-01・第5.332節で赤くなった)。
         応答問題を足したとき、**4か所の同じ式を関数1つに寄せた** ——
         それだけでここが赤くなった。**画面は正しいのに、見張りが古い。**
         **値を書き写さない。性質で見る**(CLAUDE.md)——
         「作り方を返す関数が、テスト対策では `examBriefByKey()` を返す」
         「`examPart:` は、どれもその同じ関数を通る」の2つで見る */
    [/isExamKind\(kind\)\) return examBriefByKey\(examKey\)/.test(form),
      '画面 … その PART の作り方を、窓口へ送っている'],
    [/examPart = ''/.test(mats), '道具 … `generateSection` が `examPart` を受け取る'],
    [/^\s*examPart,$/m.test(mats), '道具 … `generateSection` が `examPart` を窓口へ渡す'],
    [/const examPart = String\(body\.examPart \?\? ''\)/.test(fn),
      '窓口 … `examPart` を受け取る'],
    [/!needsContext && !examPart/.test(fn),
      '窓口 … テスト対策では、弱点タグが無くても断らない'],
    /* ★ **式を書き写していた**(第5.338節でまた踏んだ・3度め)。
         もとは「examPart ? `${examPart}` と書いてあるか」を**そのまま**
         探していたので、**改行を1つ足しただけで赤くなった。**
         **名前で在ることだけを見て、中身の形は見ない**(CLAUDE.md) */
    [fn.includes('examPart') && /\bexamPart\b[^\n]*\?/.test(fn),
      '窓口 … 依頼の文に差し込んでいる'],
  ]
  for (const [pass, name] of 見る) (pass ? ok(name) : ng(name))

  /* ── **送る回数を数える。** 本文のあとの段に渡し忘れると、
       本文だけ試験の形で、設問はふつうの内容理解になる ── */
  /* ★ **寄せた関数の名前で数える**(第5.332節)。
       **1つでも素通りすると、その道だけ試験の形にならない。**

       **「3か所以上あるか」では見ない**(赤チェックで素通りした)——
       4か所のうち1つを空にしても、残り3つで通ってしまった。
       **全部が同じ1つの関数を通っているか**で見る:
         ・`examPart:` の数(どう書いてあっても拾う)
         ・そのうち「関数を呼んでいる」数
       **2つが一致し、関数が1種類**でなければ赤くする。
       関数の名前は書き写さない(寄せ先を変えても付いてくる) */
  const 全 = (form.match(/examPart:/g) ?? []).length
  const 渡す = [...form.matchAll(/examPart:\s*([A-Za-z_$][\w$]*)\(\)/g)].map((m) => m[1])
  const 回 = (全 === 渡す.length && new Set(渡す).size === 1) ? 渡す.length : 0
  if (回 < 3) {
    ng('画面 … 作る道のどれかで、PART の作り方を送っていない', `${回} か所`)
  } else ok(`画面 … 作る道 ${回} か所すべてで、PART の作り方を送っている`)

  /* ── **読み上げの無い PART では、声の欄を出さない** ──
       出しても何も鳴らない(効かない操作を見せない・CLAUDE.md)。
       **「出る」と「出ない」の両方を見る** —— 片方だけだと、
       いつも出す形にしても、いつも消す形にしても緑になる */
  {
    const { hasAnyAudio } = await import('../src/lib/voicePlan.js')
    const 無 = PICKABLE.filter(({ exam, part }) =>
      !hasAnyAudio(EXAM_KIND, [], examKeyOf(exam.id, part.id)))
    const 有 = PICKABLE.length - 無.length
    if (!無.length) ng('声の欄 … 読み上げの無い PART が1つも無い(見張りが素通りしている)')
    else if (!有) ng('声の欄 … どの PART にも読み上げが無い(数え方が壊れている)')
    else ok(`声の欄 … 読み上げの無い PART ${無.length} 個 / ある PART ${有} 個`)
    /* **これまでの種類では、1つも消えないこと** */
    const 消える = MATERIAL_KINDS.map((k) => k.id).filter((k) => k !== EXAM_KIND)
      .filter((k) => !hasAnyAudio(k, []))
      .filter((k) => NEW_MATERIAL_KINDS.some((n) => n.id === k))
    if (消える.length) {
      ng('声の欄 … これまでの種類でも消えてしまう', 消える.join(' / '))
    } else ok('声の欄 … これまでの種類では、1つも消えない')
    /* **数える。** 同じ形が2か所(話す人 / 声の出し方)にあるので、
       「在るか」で見ると**片方を外しても、もう片方に当たって緑のまま**になる
       (赤チェックでそれを踏んだ・共通ルール「先に数える」) */
    const 見て分けている = (form.match(/voicePool\.length > 0 && 読み上げあり/g) ?? []).length
    if (見て分けている < 2) {
      ng('声の欄 … 読み上げの有無を見ていない欄がある(話す人 / 声の出し方の2つ)',
        `${見て分けている} か所`)
    } else ok(`声の欄 … ${見て分けている} か所とも \`hasAnyAudio()\` を見て出し分ける`)
    if (!/voicePlanLine\(kind, tagIds,[\s\S]{0,300}?isExamKind\(kind\) \? examKey : ''\)/.test(form)) {
      ng('声の欄 … 欄の下の1行に、PART を渡していない(いつも最初の PART の話になる)')
    } else ok('声の欄 … 欄の下の1行にも、PART を渡している')
  }

  /* ── **本文の呼び名は、PART で変わる** ──
       テスト対策の本文は、記事のことも会話のこともある。
       種類だけで決めると、TOEIC Part 7 まで「会話」と出る */
  {
    const { sectionLabel } = await import('../src/data/exerciseTypes.js')
    const 記事 = sectionLabel(EXAM_KIND, 'article')
    const 会話 = sectionLabel(EXAM_KIND, 'dialogue')
    if (記事 !== '記事' || 会話 !== '会話') {
      ng('本文の呼び名 … テスト対策で、演習と食い違っている', `article→${記事} / dialogue→${会話}`)
    } else ok('本文の呼び名 … テスト対策では、演習の名前そのもの(記事 / 会話)')
    /* **ほかの種類は1つも変わっていないか**(`bodyWord()` を触ったので) */
    const これまで = [['reading', '記事'], ['dialogue', '会話'], ['meeting', '会議'],
      ['speech', 'スピーチ'], ['pattern', '会話']]
    const ずれ = これまで.filter(([k, w]) => sectionLabel(k, 'article') !== w)
      .map(([k, w]) => `${k} … ${sectionLabel(k, 'article')}(前は ${w})`)
    if (ずれ.length) ng('本文の呼び名 … これまでの種類まで変わっている', ずれ.join(' / '))
    else ok('本文の呼び名 … これまでの5種類は1つも変わっていない')
  }

  /* ── **窓口に一覧を書き写していないか**(`angle` と同じ作法)── */
  const 書き写し = ['TOEIC', 'VERSANT', 'IELTS', 'TOEFL', '英検'].filter((w) => fn.includes(w))
  if (書き写し.length) {
    ng('窓口 … 試験の一覧を書き写している(1つ直すたびに配り直すことになる)',
      書き写し.join(' / '))
  } else ok('窓口 … 試験の名前を1つも書いていない(一覧は画面が持つ)')

  /* ── **窓口の版を進めたか**(届かないときに、そう言えるように)── */
  const fnRev = /const FN_REV = '([\d-]+)'/.exec(fn)?.[1] ?? ''
  const need = /export const NEED_GEN_REV = '([\d-]+)'/.exec(mats)?.[1] ?? ''
  if (!fnRev || fnRev !== need) {
    ng('版 … 窓口の版と、画面が求める版が食い違っている', `窓口 ${fnRev} / 画面 ${need}`)
  } else ok(`版 … 窓口と画面で、同じ版を見ている(${fnRev})`)
}

/* ══════════════════════════════════════════════════════════════════
   ⑧ **画面に出す文字**
   ══════════════════════════════════════════════════════════════════ */
{
  /* **画面にそのまま出る文字列に `**` を混ぜない**(CLAUDE.md)。
     Markdown としては読まれないので、そのまま見える */
  const 出る文字 = [
    ...EXAMS.map((e) => e.label),
    ...EXAMS.map((e) => e.outline),
    ...ALL.map(({ part }) => part.label),
    ...ALL.map(({ part }) => part.what ?? ''),
    ...EXAMS.map((e) => examSkipLine(e.id)),
    ...PICKABLE.map(({ exam, part }) => examPartLine(exam.id, part.id)),
    ...PICKABLE.map(({ exam, part }) => examTitle(exam.id, part.id)),
  ]
  const 強調 = 出る文字.filter((t) => String(t).includes('**'))
  if (強調.length) ng('画面の文字 … 強調の書き方が混じっている', 強調.join('\n    '))
  else ok(`画面の文字 … ${出る文字.length} 本とも、強調の書き方が混じっていない`)

  /* **知らない id でも落ちない**(行き止まりを作らない) */
  const 落ちない = [
    examOf('nope') === null,
    examLabel('nope') === 'nope',
    examPartsOf('nope').length === 0,
    examPartOf('nope', 'nope') === null,
    firstPartOf('nope') === '',
    examSectionsOf('nope', 'nope').length === 0,
    examSectionsByKey('nope').length === 0,
    examOutline('nope') === '',
    examSkipLine('nope') === '',
    examPartLine('nope', 'nope') === '',
    examTitle('nope', 'nope') === '',
  ]
  if (落ちない.some((x) => !x)) ng('知らない id … 何かを返している(別の試験に化ける)')
  else ok('知らない id … どれも空を返す(落ちない・化けない)')
}

/* ══════════════════════════════════════════════════════════════════════
   ★ **答え方が、本番と同じ形になっているか**(第5.336節・2026-10-01)

     > 先ほど TOEIC L&R の PART7 を作ったら、基本4択の選択肢問題の
     > はずなのに記述形式だった、意見を問う問題があったりして
     > めちゃくちゃでした。

   出どころは「選択肢の指示を PART ごとに手で書いていたこと」である。
   Part 2・5・6 には書いてあったが、**Part 3・4・7 には1行も無かった** ——
   設問が `comprehension`(内容の理解)で、あれは**自由記述**だからである。

   いまは PART が「本番は何択か」だけを宣言し、文は `choiceBrief()` が作る。
   **ここが見張るのは、その宣言と、組み立てた文が食い違っていないこと。**
   ══════════════════════════════════════════════════════════════════════ */
console.log('\n▶ 答え方(第5.336節)')
{
  /* ── ① **全 PART が答え方を宣言しているか** ──
         宣言が無いと `choicesOf()` は 0 を返すので、
         **4択の PART でも選択肢の指示が入らない**(報告された壊れ方) */
  const 無宣言 = ALL.filter(({ part }) => !formatOf(part))
  if (無宣言.length) {
    ng('答え方 … 宣言していない PART がある(選択肢の指示が入らない)',
      無宣言.map(({ exam, part }) => `${exam.id} / ${part.id}`).join(' / '))
  } else ok(`答え方 … ${ALL.length} 個とも宣言している`)

  /* **一覧に無い id を書いていないか**(書いても静かに 0 になる) */
  const 知らない = ALL.filter(({ part }) => part.format && !FORMATS[part.format])
  if (知らない.length) {
    ng('答え方 … 一覧に無い id を書いている', 知らない.map(({ part }) => part.format).join(' / '))
  } else ok(`答え方 … id は ${Object.keys(FORMATS).length} 種類の中だけ`)

  /* ── ② **選択肢の数と、組み立てた文が合っているか** ──
         **値を書き写さない。性質で見る**(CLAUDE.md)——
         「(D)」という文字ではなく、**宣言した数だけ記号が出ているか**を数える */
  const 記号 = ['(A)', '(B)', '(C)', '(D)']
  const 食い違い = []
  const 足りない = []
  for (const { exam, part } of PICKABLE) {
    const n = choicesOf(part)
    const brief = examBrief(exam.id, part.id)
    const 出た = 記号.filter((m) => brief.includes(m)).length
    if (n >= 2) {
      if (出た !== n) 食い違い.push(`${exam.id}/${part.id} … ${n}択なのに記号 ${出た} 個`)
      /* ★ **報告された壊れ方そのものを、名指しで禁じているか** */
      if (!brief.includes('自由記述') || !brief.includes('意見を問う問にしない')) {
        足りない.push(`${exam.id}/${part.id}`)
      }
    } else if (出た > 0) {
      /* **出ない側。** 話す・書く・音読の PART に選択肢の指示が混ざっていないか */
      食い違い.push(`${exam.id}/${part.id} … 選択肢なしなのに記号 ${出た} 個`)
    }
  }
  if (食い違い.length) {
    ng('答え方 … 宣言した数と、作り方の中の記号が合っていない', 食い違い.join('\n    '))
  } else {
    const 択 = PICKABLE.filter(({ part }) => choicesOf(part) >= 2).length
    ok(`答え方 … 選択肢のある ${択} 個は宣言どおりの記号・`
      + `残り ${PICKABLE.length - 択} 個には記号が1つも出ない`)
  }
  if (足りない.length) {
    ng('答え方 … 「自由記述にしない / 意見を問う問にしない」が入っていない',
      足りない.join(' / '))
  } else ok('答え方 … 選択肢のある PART はぜんぶ、自由記述と意見の問を名指しで禁じている')

  /* ── ③ **調べた事実と合っているか**(2026-10-01 に調べた)──
         **数を書き写すのではなく、本番の形との食い違いを見る** */
  const toeic = examOf('toeic_lr')
  const 三択 = toeic.parts.filter((p) => choicesOf(p) === 3).map((p) => p.id)
  const 四択 = toeic.parts.filter((p) => choicesOf(p) === 4).map((p) => p.id)
  if (三択.join() !== 'p2' || 四択.length !== toeic.parts.length - 1) {
    ng('TOEIC L&R … 本番は Part 2 だけが3択で、ほかはぜんぶ4択',
      `3択 ${三択.join('/') || 'なし'} / 4択 ${四択.join('/')}`)
  } else ok(`TOEIC L&R … Part 2 だけ3択・ほか ${四択.length} 個は4択(本番どおり)`)

  /** その試験の PART に書いてある問数を足す(「2問」→ 2) */
  const 問数 = (examId) => (examOf(examId)?.parts ?? [])
    .reduce((n, p) => n + Number(/^(\d+)/.exec(p.real ?? '')?.[1] ?? 0), 0)

  /* **TOEIC Speaking は 11 問。** もとは古い構成(Q3 が1問・Q10 が解決策)で、
     **本番に無い PART が1つ並んでいた** */
  if (問数('toeic_s') !== 11) {
    ng('TOEIC Speaking … 本番は 11 問(音読2 + 写真2 + 応答3 + 提示情報3 + 意見1)',
      `${問数('toeic_s')} 問になっている`)
  } else ok('TOEIC Speaking … PART の問数を足すと 11 問(本番どおり)')
  const 解決策 = examOf('toeic_s').parts.some((p) => /解決策/.test(p.label))
  if (解決策) {
    ng('TOEIC Speaking … いまの公式の構成に無い「解決策を提案する問題」が残っている')
  } else ok('TOEIC Speaking … 古い構成の PART は残っていない')

  /* **VERSANT は 63 問**(8 + 16 + 24 + 10 + 3 + 2) */
  if (問数('versant') !== 63) {
    ng('VERSANT … 本番は 63 問', `${問数('versant')} 問になっている`)
  } else ok('VERSANT … PART の問数を足すと 63 問(本番どおり)')

  /* **TOEFL iBT(2026年の形)。** Speaking 11問 / Writing 12題 と、
     PART に書いてある数が合っていること */
  const toefl = examOf('toefl').parts
  const 数 = (pre) => toefl.filter((p) => p.id.startsWith(pre))
    .reduce((n, p) => n + Number(/^(\d+)/.exec(p.real ?? '')?.[1] ?? 0), 0)
  if (数('s_') !== 11 || 数('w_') !== 12) {
    ng('TOEFL iBT … 2026年の形は Speaking 11問 / Writing 12題',
      `Speaking ${数('s_')} / Writing ${数('w_')}`)
  } else ok('TOEFL iBT … Speaking 11問 / Writing 12題(2026年の形どおり)')

  /* ── ④ **本番の1セット**を書いた PART は、作り方にそれが入るか ── */
  const セット = ALL.filter(({ part }) => part.set)
  if (セット.length < 4) {
    ng('本番の1セット … 書いてある PART が少なすぎる(見張りが素通りする)', セット.length)
  } else {
    const 漏れ = セット.filter(({ exam, part }) =>
      !examBrief(exam.id, part.id).includes(part.set))
    if (漏れ.length) {
      ng('本番の1セット … 作り方に入っていない',
        漏れ.map(({ part }) => part.id).join(' / '))
    } else ok(`本番の1セット … ${セット.length} 個とも、そのまま窓口へ渡る`)
  }

  /* ── ③' **選択肢の指示が、その演習に在る欄だけを名指ししているか** ──
         上の「欄」の節は **PART の演習ぜんぶの和**で見るので、
         本文(`article`)が `prompt_en` を持っていると、
         **設問の選択肢を本文の欄に入れさせても気づけない**(赤チェックで
         実際に素通りした)。だから**演習1つだけ**を渡して確かめる */
  {
    const fnSrc2 = read('supabase/functions/generate-material/index.ts')
    const blk2 = /const SECTION_FIELDS[\s\S]*?\n}\n/.exec(fnSrc2)?.[0] ?? ''
    const 欄2 = {}
    for (const mm of blk2.matchAll(
      /(\w+):\s*\{\s*required:\s*\[([^\]]*)\],\s*optional:\s*\[([^\]]*)\]/g)) {
      欄2[mm[1]] = new Set([...mm[2].matchAll(/'(\w+)'/g), ...mm[3].matchAll(/'(\w+)'/g)]
        .map((x) => x[1]))
    }
    const RE2 = new RegExp('(?:^|[^a-z_])(prompt_en|prompt_ja|question_ja|question'
      + '|answer_ja|answer_alt|answer|audio_text|hint|note|source_en|phonetic)\\s*(?:に|には|は)', 'g')
    const 外2 = []
    let 見た = 0
    for (const t of ['fill_blank', 'comprehension', 'listening']) {
      const 文 = choiceBrief(4, [{ exercise_type: t }])
      if (!文) { 外2.push(`${t} … 選択肢の指示が組み立てられない`); continue }
      for (const f of new Set([...文.matchAll(RE2)].map((x) => x[1]))) {
        見た += 1
        if (!(欄2[t] ?? new Set()).has(f)) 外2.push(`${t} に無い欄 ${f} を名指ししている`)
      }
    }
    if (見た < 6) {
      ng('選択肢の指示 … 欄の名前をほとんど拾えていない(見張りが素通りしている)', 見た)
    } else if (外2.length) {
      ng('選択肢の指示 … その演習に無い欄を名指ししている(選択肢が別の欄へ入る)',
        外2.join('\n    '))
    } else ok(`選択肢の指示 … ${見た} 個の欄は、どれもその演習そのものに在る`)
  }

  /* ── ④' **画面の1行に、答え方が出ているか** ──
         「4択のはずなのに記述形式だった」とき、**作る前に何択なのかが
         どこにも出ていなかった**(第5.187節「見えないものは信じられない」)。
         **同じことを2つ出さないこと**も見る(CLAUDE.md) */
  {
    const 出ない = []
    const 重なり = []
    for (const { exam, part } of PICKABLE) {
      const 行 = examPartLine(exam.id, part.id)
      const 答 = formatOf(part)?.label ?? ''
      if (答 && !行.includes(答)) 出ない.push(`${exam.id}/${part.id}`)
      const 部 = 行.split(' … ')
      if (new Set(部).size !== 部.length) 重なり.push(`${exam.id}/${part.id} … ${行}`)
    }
    if (出ない.length) {
      ng('画面の1行 … 答え方が出ていない(作る前に何択か分からない)',
        出ない.join(' / '))
    } else ok(`画面の1行 … ${PICKABLE.length} 個とも、答え方が出る`)
    if (重なり.length) {
      ng('画面の1行 … 同じことを2つ出している', 重なり.join('\n    '))
    } else ok('画面の1行 … 同じことを2度書いていない')
  }

  /* ── ⑤ **設問の数が、本番の1セットで割り切れるか** ──
         Part 3 は「会話1本につき3問」なのに設問 6 問だった ——
         **会話1本に2セット分**が付いていた(本番に無い形)。

         ★ **はじめ「1セット分を超えたら赤」と書いて、2つ空振りした**
            (第5.337節)。TOEFL の Read in Daily Life は
            「短い文1つにつき2問」で、**短い文を3つ作るから設問 6 問が正しい。**
            **超えているかではなく、何セット分になるかで見る。**

           ①**1セットの問数で割り切れる**(端数の問が宙に浮かない)
           ②**セット数が、本文の数を超えない**(1つの段落に2セット分を付けない) */
  const 端数 = []
  const はみ出し = []
  let 数えた = 0
  for (const { exam, part } of PICKABLE) {
    const m = /設問(\d+)問/.exec(part.set ?? '')
    if (!m) continue
    const ひと組 = Number(m[1])
    const 問 = (part.sections ?? [])
      .find((x) => x.exercise_type === 'comprehension')?.count ?? 0
    if (!問) continue
    数えた += 1
    if (問 % ひと組) {
      端数.push(`${exam.id}/${part.id} … 1セット ${ひと組}問 なのに 設問 ${問}問(割り切れない)`)
      continue
    }
    /* 本文の数(段落・発言)より多くのセットを作らせない */
    const 本文 = (part.sections ?? [])
      .find((x) => x.exercise_type === 'article' || x.exercise_type === 'dialogue')?.count ?? 0
    const セット数 = 問 / ひと組
    if (本文 && セット数 > 本文) {
      はみ出し.push(`${exam.id}/${part.id} … ${セット数} セット分なのに、本文は ${本文} しかない`)
    }
  }
  /* **1つも数えていなければ赤**(見張りが何もしていないのと同じ) */
  if (数えた < 5) {
    ng('本番の1セット … 設問の数を数えた PART が少なすぎる(見張りが素通りする)', 数えた)
  } else if (端数.length) {
    ng('本番の1セット … 設問が1セット分で割り切れない', 端数.join('\n    '))
  } else if (はみ出し.length) {
    ng('本番の1セット … セット数が本文の数を超えている', はみ出し.join('\n    '))
  } else ok(`本番の1セット … ${数えた} 個とも、設問がセットできれいに割れる`)
}


/* ══════════════════════════════════════════════════════════════════
   ★ **級ごと・型ごとに、本番とそろっているか**(第5.337節)

     > テスト対策内の全てのテストについて公式に公表されているテスト形式と
     > 傾向や表示を確認して、アプリ内の対策の教材も揃えてください

   いちばん大きな食い違いは**英検**だった ——
   **6つの級ぜんぶに、まったく同じ7つの PART** を出していた。
   ここは「どの級にも同じものを出していないか」を機械で見る。
   ══════════════════════════════════════════════════════════════════ */
console.log('\n▶ 級ごと・型ごとの形(第5.337節)')
{
  const 英検 = EXAMS.filter((e) => e.id.startsWith('eiken_'))
  const 大問 = (id) => (examOf(id)?.parts ?? []).map((p) => p.id).join(',')

  /* ── ① **級ごとに大問の並びが違う** ──
         ぜんぶ同じだったら赤(**それが直す前の姿**である) */
  const 並び = new Set(英検.map((e) => 大問(e.id)))
  if (英検.length < 6) ng('英検 … 級が少なすぎる(見張りが素通りする)', 英検.length)
  else if (並び.size < 2) {
    ng('英検 … どの級も、まったく同じ大問を出している(級ごとの違いが落ちている)',
      [...並び][0])
  } else ok(`英検 … ${英検.length} 級で、大問の並びが ${並び.size} 通り(級ごとに違う)`)

  /* ── ② **会話文の文空所補充は、3級と準2級だけ** ──
         **出る側と出ない側の両方を見る**(CLAUDE.md) */
  const 会話あり = 英検.filter((e) => 大問(e.id).includes('r_conv')).map((e) => e.id).sort()
  const 会話なし = 英検.filter((e) => !大問(e.id).includes('r_conv')).map((e) => e.id).sort()
  const 会話の正 = ['eiken_3', 'eiken_p2'].sort()
  if (String(会話あり) !== String(会話の正)) {
    ng('英検 … 会話文の文空所補充が、本番と違う級に出ている',
      `出ている: ${会話あり} / 本番は: ${会話の正}`)
  } else if (会話なし.length !== 4) {
    ng('英検 … 会話文の文空所補充が無い級の数が合わない', 会話なし.length)
  } else ok(`英検 … 会話文の文空所補充は ${会話あり.length} 級だけ・残り ${会話なし.length} 級には無い`)

  /* ── ③ **長文の語句空所補充は、3級に無い** ── */
  const 長文空所なし = 英検.filter((e) => !大問(e.id).includes('r2')).map((e) => e.id)
  if (String(長文空所なし) !== String(['eiken_3'])) {
    ng('英検 … 長文の語句空所補充が無い級が、本番と違う',
      `無い級: ${長文空所なし} / 本番は: eiken_3 だけ`)
  } else ok('英検 … 長文の語句空所補充は、3級にだけ無い(本番どおり)')

  /* ── ④ **英作文の1題めは、級によって要約か Eメールか** ──
         ★ **準2級プラスは要約である。** それまで Eメールにしていた */
  const 要約 = []
  const メール = []
  for (const e of 英検) {
    const w = (e.parts ?? []).find((p) => p.id === 'w1')
    if (!w) { ng('英検 … 英作文の1題めが無い級がある', e.id); continue }
    if (w.label.includes('要約')) 要約.push(e.id)
    else if (w.label.includes('Eメール')) メール.push(e.id)
    else ng('英検 … 英作文の1題めが、要約でも Eメールでもない', `${e.id} … ${w.label}`)
  }
  const 要約の正 = ['eiken_1', 'eiken_p1', 'eiken_2', 'eiken_p2p']
  const メールの正 = ['eiken_p2', 'eiken_3']
  if (String(要約.sort()) !== String(要約の正.sort())) {
    ng('英検 … 要約が出る級が、本番と違う', `いま: ${要約} / 本番は: ${要約の正.sort()}`)
  } else if (String(メール.sort()) !== String(メールの正.sort())) {
    ng('英検 … Eメールが出る級が、本番と違う', `いま: ${メール} / 本番は: ${メールの正.sort()}`)
  } else ok(`英検 … 要約 ${要約.length} 級 / Eメール ${メール.length} 級(準2級プラスは要約)`)

  /* ── ⑤ **リーディングの大問の問数の和が、公式の総数と合う** ──
         **数を書き写さない。** 大問の `real` から足して、総数と突き合わせる */
  const 総数 = {
    eiken_1: 35, eiken_p1: 31, eiken_2: 31, eiken_p2p: 31, eiken_p2: 29, eiken_3: 30,
  }
  const 合わない = []
  for (const e of 英検) {
    const 和 = (e.parts ?? [])
      .filter((p) => ['r1', 'r_conv', 'r2', 'r3'].includes(p.id))
      .reduce((n, p) => n + (Number(/(\d+)問/.exec(p.real ?? '')?.[1]) || 0), 0)
    if (和 !== 総数[e.id]) 合わない.push(`${e.id} … 大問の和 ${和}問 / 公式は ${総数[e.id]}問`)
  }
  if (合わない.length) {
    ng('英検 … リーディングの大問の和が、公式の総数と合わない', 合わない.join('\n    '))
  } else ok(`英検 … ${英検.length} 級とも、大問の和が公式のリーディング総数と合う`)

  /* ── ⑥ **二次試験は、級ごとに3つの形** ──
         1級はスピーチ(作れる)/ 準1級は4コマイラスト(**作れない**)/
         ほかは面接(**イラストの問だけ作れない**) */
  const 面接 = Object.fromEntries(英検.map((e) =>
    [e.id, (e.parts ?? []).find((p) => p.id === 's1')]))
  const 無い = Object.entries(面接).filter(([, p]) => !p).map(([id]) => id)
  if (無い.length) ng('英検 … 二次試験が無い級がある', 無い.join(' / '))
  else {
    const 作れない = Object.entries(面接).filter(([, p]) => p.cannot).map(([id]) => id)
    const 一部 = Object.entries(面接).filter(([, p]) => partialOf(p)).map(([id]) => id)
    const 丸ごと作れる = Object.entries(面接)
      .filter(([, p]) => !p.cannot && !partialOf(p)).map(([id]) => id)
    if (String(作れない) !== String(['eiken_p1'])) {
      ng('英検 … 二次試験を丸ごと作れない級が、本番と違う',
        `いま: ${作れない} / 本番で絵が要るのは準1級(4コマ)だけ`)
    } else if (String(丸ごと作れる) !== String(['eiken_1'])) {
      ng('英検 … 絵の要らない二次試験が、1級だけになっていない', `いま: ${丸ごと作れる}`)
    } else if (一部.length !== 4) {
      ng('英検 … イラストの問だけ作れない級の数が合わない', `${一部.length} 級 … ${一部}`)
    } else {
      ok(`英検 … 二次試験は3つの形(スピーチ 1級 / 4コマで作れない 準1級`
        + ` / イラストの問だけ作れない ${一部.length} 級)`)
    }
  }

  /* ── ⑦ **英作文の語数が、級ごとに違う** ──
         **級ごとに書き写していないこと**を見る ——
         同じ語数を使い回していたら、どこかの級が間違っている */
  const 語数 = 英検.map((e) => {
    const w2 = (e.parts ?? []).find((p) => p.id === 'w2')
    return /(\d+〜\d+語)/.exec(w2?.real ?? '')?.[1] ?? ''
  })
  if (語数.some((x) => !x)) {
    ng('英検 … 意見論述の語数が入っていない級がある', 語数.join(' / '))
  } else if (new Set(語数).size < 5) {
    ng('英検 … 意見論述の語数が、級をまたいで同じになっている', 語数.join(' / '))
  } else ok(`英検 … 意見論述の語数は ${new Set(語数).size} 通り(${語数.join(' / ')})`)

  /* ── ⑧ **同じ大問でも、級ごとに別の作り方になっている** ──
         ★ **はじめ「作り方に級の名前が入っているか」で見て、空振りした**
            (第5.337節)。級の名前は `e.label` から引いているので、
            **同じ出どころを突き合わせていた** ——
            どの級も「英検」に書き換えても緑のままだった。
            **自分と同じところを見ない。級どうしを見比べる。**

         ★ **2度めも空振りした。** `examBrief()` には**問数**が入るので、
            級ごとに問数が違うだけで**ぜんぶ違う文**になってしまう ——
            作り方(`make`)から級の名前と CEFR を落としても緑だった。
            **窓口に渡る文の全体ではなく、`make` そのものを見比べる。**

         どの級にもある大問で、**6つの `make` がぜんぶ違う**ことを見る。
         1つでも同じなら、**その2つの級で同じ問ができる。** */
  const 共通の大問 = ['r1', 'r3', 'w2', 'l1']
  const かぶり = []
  for (const id of 共通の大問) {
    const 文 = 英検.map((e) => examPartOf(e.id, id)?.make).filter(Boolean)
    if (文.length !== 英検.length) { かぶり.push(`${id} … 持っていない級がある`); continue }
    if (new Set(文).size !== 文.length) かぶり.push(`${id} … 作り方が同じ級がある`)
  }
  if (かぶり.length) {
    ng('英検 … 級がちがうのに、作り方が同じ大問がある', かぶり.join('\n    '))
  } else {
    ok(`英検 … どの級にもある ${共通の大問.length} 個の大問は、`
      + `${英検.length} 級ぶんの作り方(make)がぜんぶ違う`)
  }

  /* ── ⑨ **TOEFL のセクションの順番が、本番どおり** ──
         2026年の形は Reading → Listening → **Writing → Speaking**。
         それまで Speaking が Writing より先に並んでいた */
  const toefl = examPartsOf('toefl').map((p) => p.id)
  const 段 = (id) => (id.startsWith('r_') ? 0 : id.startsWith('l_') ? 1
    : id.startsWith('w_') ? 2 : 3)
  const 逆 = toefl.map(段).some((v, i, a) => i > 0 && v < a[i - 1])
  if (toefl.length < 10) ng('TOEFL iBT … PART が少なすぎる(見張りが素通りする)', toefl.length)
  else if (逆) {
    ng('TOEFL iBT … セクションの順番が本番と違う(Reading → Listening → Writing → Speaking)',
      toefl.join(' / '))
  } else ok(`TOEFL iBT … ${toefl.length} 個が本番の順(Reading → Listening → Writing → Speaking)`)

  /* ── ⑩ **TOEFL の Listening は4つの型** ──
         それまで「Listening」1つにまとめていた(古い `l1` は消えている) */
  const 聞く = examPartsOf('toefl').filter((p) => p.id.startsWith('l'))
  if (聞く.length !== 4) {
    ng('TOEFL iBT … Listening の型が4つになっていない', 聞く.map((p) => p.id).join(' / '))
  } else if (聞く.some((p) => p.id === 'l1')) {
    ng('TOEFL iBT … まとめていた古い Listening(l1)が残っている')
  } else {
    /* **問数の幅の下限の和が、公式の上限(47問)を超えない** */
    const 下限 = 聞く.reduce((n, p) => n + (Number(/(\d+)/.exec(p.real ?? '')?.[1]) || 0), 0)
    if (!(下限 > 0 && 下限 <= 47)) {
      ng('TOEFL iBT … Listening の問数が、公式の 47 問に収まらない', 下限)
    } else ok(`TOEFL iBT … Listening は4つの型・問数の下限の和 ${下限} 問(公式は 47 問まで)`)
  }

  /* ── ⑪ **IELTS には「2つの Not Given」が両方ある** ──
         事実を見る True/False/Not Given と、
         筆者の意見を見る Yes/No/Not Given は**別の設問形式**である */
  const ielts読む = examBrief('ielts', 'r1')
  const 事実 = ielts読む.includes('True, False or Not Given')
  const 意見 = ielts読む.includes('Yes, No or Not Given')
  if (!事実 || !意見) {
    ng('IELTS … Not Given の2つの形がそろっていない',
      `事実(True/False): ${事実} / 意見(Yes/No): ${意見}`)
  } else ok('IELTS … Not Given は2つとも入っている(事実 True/False / 意見 Yes/No)')

  /* ── ⑫ **IELTS の語数制限に、数字の扱いが入っている** ──
         IELTS は**数字を1語と数えない**ので、
         「NO MORE THAN TWO WORDS」だけだと正解の形が変わる */
  const 記入 = ['l1', 'l2', 'r1'].map((id) => examBrief('ielts', id))
  const 足りない = 記入.filter((b) => !b.includes('AND/OR A NUMBER'))
  if (足りない.length) {
    ng('IELTS … 語数制限に「AND/OR A NUMBER」が入っていない PART がある', 足りない.length)
  } else ok(`IELTS … 記入式の ${記入.length} 個とも、語数制限に数字の扱いが入っている`)

  /* ── ⑬ **作れない部分は、画面にも窓口にも出る** ──
         **出る側と出ない側の両方**(CLAUDE.md)。
         `partial` を持つ PART には出て、持たない PART には出ない */
  const 一部ある = PICKABLE.filter(({ part }) => partialOf(part))
  const 一部ない = PICKABLE.filter(({ part }) => !partialOf(part))
  if (一部ある.length < 4) {
    ng('作れない部分 … `partial` を持つ PART が少なすぎる(見張りが素通りする)', 一部ある.length)
  } else {
    const 漏れ = []
    for (const { exam, part } of 一部ある) {
      const 行 = examPartLine(exam.id, part.id)
      const 文 = examBrief(exam.id, part.id)
      if (!行.includes(partialOf(part))) 漏れ.push(`${exam.id}/${part.id} … 画面の1行に出ていない`)
      if (!文.includes(partialOf(part))) 漏れ.push(`${exam.id}/${part.id} … 窓口に伝えていない`)
      if (!/1つも作らない/.test(文)) 漏れ.push(`${exam.id}/${part.id} … 「作らない」と言っていない`)
    }
    /* **持たない PART に出ていたら赤**(どこにでも出す形に書き換えても緑にならないため) */
    const 余り = 一部ない.filter(({ exam, part }) =>
      /作れません/.test(examPartLine(exam.id, part.id))
      || /1つも作らない/.test(examBrief(exam.id, part.id)))
    if (漏れ.length) ng('作れない部分 … 伝わっていない', 漏れ.slice(0, 4).join('\n    '))
    else if (余り.length) {
      ng('作れない部分 … 持っていない PART にも出ている',
        余り.map(({ exam, part }) => `${exam.id}/${part.id}`).slice(0, 4).join(' / '))
    } else {
      ok(`作れない部分 … ${一部ある.length} 個は画面と窓口の両方に出て、`
        + `残り ${一部ない.length} 個には1つも出ない`)
    }
  }

  /* ── ⑭ **VERSANT は、答える秒数が本番どおり** ──
         本番は Part A 15秒 / Part E 30秒 / Part F 40秒。
         **作り方の文にも入れる** —— 長さを決める根拠だからである */
  const 秒 = { a: 15, e: 30, f: 40 }
  const 秒の漏れ = []
  for (const [id, n] of Object.entries(秒)) {
    const part = examPartOf('versant', id)
    if (!part) { 秒の漏れ.push(`versant/${id} … PART が無い`); continue }
    if (!part.real.includes(`${n}秒`)) 秒の漏れ.push(`versant/${id} … ${n}秒 が問数の欄に無い`)
    if (!examBrief('versant', id).includes(`${n}秒`)) {
      秒の漏れ.push(`versant/${id} … ${n}秒 が作り方に無い`)
    }
  }
  if (秒の漏れ.length) ng('VERSANT … 本番の応答時間が入っていない', 秒の漏れ.join('\n    '))
  else ok(`VERSANT … ${Object.keys(秒).length} 個とも、本番の応答時間が画面と作り方の両方に入る`)

  /* ── ⑮ **TOEIC Speaking は、準備と解答の秒数が全 PART に入る** ── */
  const sp = examPartsOf('toeic_s')
  const 秒なし = sp.filter((p) => !/秒/.test(p.real ?? ''))
  if (sp.length < 4) ng('TOEIC Speaking … PART が少なすぎる(見張りが素通りする)', sp.length)
  else if (秒なし.length) {
    ng('TOEIC Speaking … 解答の秒数が入っていない PART がある',
      秒なし.map((p) => p.id).join(' / '))
  } else ok(`TOEIC Speaking … ${sp.length} 個とも、準備と解答の秒数が出る`)
}


/* ══════════════════════════════════════════════════════════════════
   ★ **4択が4択にならなかった根**(第5.338節・2026-10-01 利用者の指摘)

     > TOEIC PART5 は四択でしょう？調べて同じようにしてくださいと
     > 依頼したはずですが。

   前日に「4択にする」と窓口へ伝える文は作った(第5.336節)。
   **それでも4択にならなかった。** 根は3つ重なっていた。

     ①**窓口で、PART の指示が演習の説明より「前」にあった。**
       あとに書いたほうが勝つので、**後ろの「hint に与える語」**が効いた
     ②**選択肢の置き場所が食い違っていた。** 作り方は `prompt_en` と
       言っていたが、**記号を散らす仕組みも、行に割る仕組みも `question`**
     ③**行に割る部品がレッスン表示の中にだけ在った。**
       ゲストの画面と紙では、4つの選択肢が1行の団子だった
   ══════════════════════════════════════════════════════════════════ */
console.log('\n▶ 4択が4択になるか(第5.338節)')
{
  const fn = noC(read('supabase/functions/generate-material/index.ts'))

  /* ── ① **PART の指示は、演習の説明より「後ろ」にあるか** ──
         **ここが今回の根である。** 前に置くと、後ろの演習の説明に負ける */
  /* ★ **はじめ、別の場所にある同じ名前を測っていた**(第5.338節)。
       `SECTION_INSTRUCTIONS[sectionType]` も `examPart` も**ファイルに
       何度も出てくる**(欄の定義・受け取り・弱点タグの判定)。
       いちばん手前と、いちばん後ろを比べていたので、
       **並べ替えても必ず「後ろにある」ことになり、緑のままだった。**
       **いちばん近い対**(依頼の文を組み立てている並びの中の2つ)で測る。
       どちらも**この形では1つしか無い**ことを、先に数えて確かめてある。 */
  const 演習の説明 = fn.indexOf('`${SECTION_INSTRUCTIONS[sectionType]}`')
  const PARTの指示 = fn.search(/\n\s*examPart\s*\n\s*\?/)
  if (演習の説明 < 0 || PARTの指示 < 0) {
    ng('窓口 … 並び順を測れない(探し方が壊れている)', `${演習の説明} / ${PARTの指示}`)
  } else if (PARTの指示 < 演習の説明) {
    ng('窓口 … PART の指示が、演習の説明より前にある(後ろの説明に負ける)',
      `PART ${PARTの指示} < 演習 ${演習の説明}`)
  } else ok('窓口 … PART の指示は、演習の説明より後ろにある(あとが勝つ)')

  /* ── ② **食い違ったときどちらが勝つかを、言葉でも言っているか** ── */
  if (!/食い違う[^\n]*PART の指示が勝つ/.test(fn)) {
    ng('窓口 … 食い違ったときどちらが勝つかを言っていない')
  } else ok('窓口 … 食い違ったら PART の指示が勝つ、と言っている')

  /* ── ③ **選択肢の置き場所が、みんなが見ている欄と同じか** ──
         **値を書き写さない。** 「記号を散らす仕組み」が読んでいる欄を
         `choiceLines.js` から**読み取って**、作り方が名指しする欄と比べる */
  const lines = noC(read('src/lib/choiceLines.js'))
  const 散らす = /splitChoices\(it\.(\w+)\)/.exec(lines)?.[1] ?? ''
  const 作り方 = /\$\{f\.ask\} には/.test(noC(read('src/data/examPrep.js')))
  const 四択の欄 = new Set()
  for (const { exam, part } of PICKABLE) {
    if (choicesOf(part) < 2) continue
    const b = examBrief(exam.id, part.id)
    for (const f of ['question', 'prompt_en']) {
      if (new RegExp(`(?:^|[^a-z_])${f} には`).test(b)) 四択の欄.add(f)
    }
  }
  if (!散らす || !作り方) {
    ng('選択肢の欄 … 読み取れない(探し方が壊れている)', `${散らす} / ${作り方}`)
  } else if (四択の欄.size !== 1 || !四択の欄.has(散らす)) {
    ng('選択肢の欄 … 作り方と、記号を散らす仕組みで食い違っている',
      `作り方: ${[...四択の欄]} / 散らす仕組み: ${散らす}`)
  } else ok(`選択肢の欄 … 作り方も記号を散らす仕組みも \`${散らす}\`(1つにそろっている)`)

  /* ── ④ **その欄が、道具の形で許されているか** ──
         許されていないと、**書かせても落とされて4択にならない** */
  const blk = /const SECTION_FIELDS[\s\S]*?\n}\n/.exec(fn)?.[0] ?? ''
  const 穴埋めの欄 = /fill_blank:\s*\{[\s\S]*?optional:\s*\[([^\]]*)\]/.exec(blk)?.[1] ?? ''
  const 画面の欄 = /id: 'fill_blank'[\s\S]*?fields: \[([^\]]*)\]/
    .exec(noC(read('src/data/exerciseTypes.js')))?.[1] ?? ''
  const ある = (t) => new RegExp(`'${散らす}'`).test(t)
  if (!blk || !画面の欄) {
    ng('選択肢の欄 … 道具の形を読み取れない(探し方が壊れている)')
  } else if (!ある(穴埋めの欄) || !ある(画面の欄)) {
    ng(`選択肢の欄 … 穴埋めで \`${散らす}\` が許されていない(書かせても落ちる)`,
      `窓口: ${ある(穴埋めの欄)} / 画面: ${ある(画面の欄)}`)
  } else ok(`選択肢の欄 … 穴埋めでも \`${散らす}\` が許されている(窓口と画面の両方)`)

  /* ── ⑤ **行に割る部品を、3つの画面ぜんぶが通しているか** ──
         ★ **レッスン表示の中にだけ在った。** ゲストの画面と紙では
            4つの選択肢が1行の団子だった。**開く場所で形が違っていた** */
  const 部品 = 'ChoiceLines'
  const 画面 = ['LessonView', 'MaterialBody', 'LearnerHomework']
  const 通っていない = []
  for (const 名 of 画面) {
    const src = noC(read(`src/components/${名}.jsx`))
    if (!new RegExp(`import ${部品} from`).test(src)) {
      通っていない.push(`${名} … 部品を取り込んでいない`)
      continue
    }
    /* **設問を、その部品に渡しているか**(取り込んだだけでは何もしない) */
    if (!new RegExp(`<${部品}[\\s\\S]{0,400}?text=\\{it\\.question\\}`).test(src)) {
      通っていない.push(`${名} … 設問を部品に渡していない`)
    }
  }
  if (通っていない.length) {
    ng('選択肢の行割り … 通っていない画面がある', 通っていない.join('\n    '))
  } else ok(`選択肢の行割り … ${画面.length} 画面とも、設問を同じ部品に通している`)

  /* ── ⑥ **部品は1つだけ**(画面の中に写しが残っていないか) ──
         出したつもりで**元が残る**と、片方だけ古くなる(CLAUDE.md) */
  const 写し = 画面.filter((名) =>
    /function ChoiceLines\s*\(/.test(noC(read(`src/components/${名}.jsx`))))
  if (写し.length) {
    ng('選択肢の行割り … 画面の中に部品の写しが残っている', 写し.join(' / '))
  } else ok('選択肢の行割り … 部品は `components/ChoiceLines.jsx` 1つだけ')
}


/* ══════════════════════════════════════════════════════════════════
   ★ **誤りの選択肢が、ちゃんと紛らわしいか**(第5.339節・利用者の指定)

     > 選択肢は TOEIC の傾向を研究して、正解が簡単にはわかりにくくして
     > ください

   それまで「**紛らわしい選択肢**にする」の1行だけだった。
   AI は**明らかに違うもの**を並べるので、読まなくても消去法で当たる。
   いまは**演習の種類ごとの作り方**(`TRAPS`)を1か所に持つ。
   ══════════════════════════════════════════════════════════════════ */
console.log('\n▶ 誤りの選択肢の作り方(第5.339節)')
{
  const 選べる = PICKABLE.filter(({ part }) => choicesOf(part) >= 2)
  if (選べる.length < 10) {
    ng('誤りの選択肢 … 選択肢のある PART が少なすぎる(見張りが素通りする)', 選べる.length)
  } else {
    /* ── ① **どの PART にも、誤りの作り方がそのまま入っているか** ──
           ★ **はじめ「『誤りの選択肢は、次の作り方から』が在るか」で見て、
              空所補充だけ赤くなった。** あちらにはその一文が無かった
              (「4つを1つの軸でそろえる」しか書いていなかった)——
              **見張りが見つけた本当の抜け**だったので、作り方を足した。
           **文を書き写さない。** `TRAPS` を読み取って突き合わせる */
    const 演習の = (part) => (part.sections ?? []).find((x) =>
      ['fill_blank', 'comprehension', 'listening'].includes(x.exercise_type))?.exercise_type
    const 対応 = { fill_blank: TRAPS.fill_blank, comprehension: TRAPS.read, listening: TRAPS.listen }
    const 無い = []
    for (const { exam, part } of 選べる) {
      const t = 演習の(part)
      if (!t) { 無い.push(`${exam.id}/${part.id} … 設問を持つ演習が無い`); continue }
      if (!examBrief(exam.id, part.id).includes(対応[t])) {
        無い.push(`${exam.id}/${part.id} … ${t} の作り方が入っていない`)
      }
    }
    if (無い.length) {
      ng('誤りの選択肢 … 作り方が入っていない PART がある', 無い.slice(0, 4).join('\n    '))
    } else ok(`誤りの選択肢 … ${選べる.length} 個とも、その演習の作り方がそのまま入る`)

    /* ── ② **3つの作り方が、どれも別の文になっているか** ──
           書き写して作ると、読む問と聞く問が同じ文になる */
    const 文 = Object.values(TRAPS)
    const 使われている = new Set(選べる.map(({ part }) => 演習の(part)).filter(Boolean))
    if (文.length < 3) {
      ng('誤りの選択肢 … 作り方が3種類そろっていない', 文.length)
    } else if (new Set(文).size !== 文.length) {
      ng('誤りの選択肢 … 作り方が同じ文になっている種類がある',
        `${文.length} 種類 / 文は ${new Set(文).size} 通り`)
    } else if (使われている.size !== 3) {
      ng('誤りの選択肢 … 使われていない作り方がある', [...使われている].join(' / '))
    } else ok(`誤りの選択肢 … ${文.length} 種類の作り方は、どれも別の文で、どれも使われている`)

    /* ── ③ **正解は言い換え、誤答は元の語そのまま** が入っているか ──
           ★ **これが TOEIC で正解を落とす最大の理由**だと、解説がそろって
              書いている。読む問と聞く問の両方に入っていること */
    const 言い換え = 選べる.filter(({ exam, part }) => {
      const b = examBrief(exam.id, part.id)
      const t = (part.sections ?? []).find((x) => ['comprehension', 'listening']
        .includes(x.exercise_type))
      return t && /そのまま使わずに言い換える|言い換えで書く/.test(b)
        && /誤りの選択肢にこそ/.test(b)
    })
    const 対象 = 選べる.filter(({ part }) => (part.sections ?? [])
      .some((x) => ['comprehension', 'listening'].includes(x.exercise_type)))
    if (対象.length < 5) {
      ng('誤りの選択肢 … 読む / 聞く問が少なすぎる(見張りが素通りする)', 対象.length)
    } else if (言い換え.length !== 対象.length) {
      ng('誤りの選択肢 … 「正解は言い換え・誤答は元の語そのまま」が抜けている PART がある',
        `${言い換え.length} / ${対象.length}`)
    } else {
      ok(`誤りの選択肢 … 読む / 聞く ${対象.length} 個とも、`
        + '「正解は言い換え・誤答は元の語そのまま」が入る')
    }

    /* ── ④ **空所補充に、軸がぜんぶ並んでいるか** ──
           ★ **はじめ「1つの軸でそろえる」という文字そのもので探して、
              第5.340節で赤くなった**(軸を8つにしたとき言い回しが変わった)。
              **仕組みは1ミリも壊れていないのに、見張りだけが赤くなる**形である
              (CLAUDE.md「式も、関数の名前も書き写さない」)。
           **`BLANK_AXES` から読み取って、1つ残らず並ぶか**を見る */
    const 空所 = 選べる.filter(({ part }) => (part.sections ?? [])
      .some((x) => x.exercise_type === 'fill_blank'))
    const 欠け = []
    for (const { exam, part } of 空所) {
      const b = examBrief(exam.id, part.id)
      const 無い = BLANK_AXES.filter((x) => !b.includes(x.aim) || !b.includes(x.opts))
      if (無い.length) 欠け.push(`${exam.id}/${part.id} … ${無い.map((x) => x.aim).join(' / ')}`)
    }
    if (空所.length < 5) {
      ng('誤りの選択肢 … 空所補充の PART が少なすぎる(見張りが素通りする)', 空所.length)
    } else if (欠け.length) {
      ng('誤りの選択肢 … 空所補充に、並んでいない軸がある', 欠け.slice(0, 3).join('\n    '))
    } else {
      ok(`誤りの選択肢 … 空所補充 ${空所.length} 個とも、`
        + `${BLANK_AXES.length} つの軸がぜんぶ並ぶ`)
    }

    /* ── ⑤ **選択肢の数を書き写していないか** ──
           ★ **その場で踏んだ。**「4つの選択肢は、長さと形をそろえる」と
              書いたら、**3択の Part 2 でもそう出た。**
           **3択の PART には「3つ」、4択には「4つ」**と出ること */
    const 数の食い違い = []
    for (const { exam, part } of 選べる) {
      const n = choicesOf(part)
      const b = examBrief(exam.id, part.id)
      const m = /\*\*(\d)つの選択肢は、長さと形/.exec(b)
      if (!m) 数の食い違い.push(`${exam.id}/${part.id} … 長さの決まりが無い`)
      else if (Number(m[1]) !== n) {
        数の食い違い.push(`${exam.id}/${part.id} … 本番は ${n} 択なのに「${m[1]}つ」と出る`)
      }
    }
    /* **3択と4択の両方を数える。** 片方しか無ければ、書き写しても気づけない */
    const 三択 = 選べる.filter(({ part }) => choicesOf(part) === 3).length
    const 四択 = 選べる.filter(({ part }) => choicesOf(part) === 4).length
    if (!(三択 > 0 && 四択 > 0)) {
      ng('誤りの選択肢 … 3択と4択の両方が無いと、数の書き写しを見つけられない',
        `3択 ${三択} / 4択 ${四択}`)
    } else if (数の食い違い.length) {
      ng('誤りの選択肢 … 選択肢の数を書き写している', 数の食い違い.slice(0, 3).join('\n    '))
    } else {
      ok(`誤りの選択肢 … 長さの決まりは、3択 ${三択} 個 / 4択 ${四択} 個とも本番の数で出る`)
    }

    /* ── ⑥ **作り方を2か所に書いていないか** ──
           PART ごとの `make` に書き写すと、片方だけ古くなる */
    const 写し = []
    for (const { exam, part } of ALL) {
      if (!part.make) continue
      if (/音が似ている語|音の似た語/.test(part.make)) {
        写し.push(`${exam.id}/${part.id} … 「音が似ている語」を make に書いている`)
      }
    }
    if (写し.length) {
      ng('誤りの選択肢 … 作り方を PART ごとに書き写している', 写し.join('\n    '))
    } else ok('誤りの選択肢 … 作り方は `TRAPS` 1か所だけ(PART に写しが無い)')
  }
}


/* ══════════════════════════════════════════════════════════════════
   ★ **空所補充の軸**(第5.340節・利用者の指定)

     > 接続詞、前置詞問題 / 関係詞問題 / 受動、能動と分詞形容詞をからめた問題
     > / 数の問題 / 代名詞、再帰代名詞問題。これらも忘れずに

   軸が3つ(品詞 / 動詞の形 / 語彙)しか無かった。言われた5つを足して8つ。
   **一覧は1か所**(`BLANK_AXES`)にして、作り方の文も数もそこから組む。
   ══════════════════════════════════════════════════════════════════ */
console.log('\n▶ 空所補充の軸(第5.340節)')
{
  /* ── ① **言われた5つが、ぜんぶ入っているか** ──
         **名前そのものではなく、何で決まるかで探す**(言い回しを変えても残る) */
  const 要る = [
    ['接続詞と前置詞', /接続詞.*前置詞|前置詞.*接続詞/],
    ['関係詞', /関係詞/],
    ['受動と能動・分詞形容詞', /受動.*能動|分詞/],
    ['数(可算と不可算)', /可算|単数と複数|数を表す語/],
    ['代名詞と再帰代名詞', /再帰代名詞/],
  ]
  const 名 = BLANK_AXES.map((x) => `${x.aim}${x.opts}`).join('\n')
  const 無い = 要る.filter(([, re]) => !re.test(名)).map(([x]) => x)
  if (BLANK_AXES.length < 8) {
    ng('軸 … 8つに足りない(言われた5つを足したはず)', BLANK_AXES.length)
  } else if (無い.length) {
    ng('軸 … 言われた型が入っていない', 無い.join(' / '))
  } else ok(`軸 … ${BLANK_AXES.length} つあり、言われた ${要る.length} つがぜんぶ入っている`)

  /* ── ② **どの軸にも「4つの関係」が書いてあるか** ──
         何を問うかだけでは、**AI は4つをばらばらに作る** */
  const 空 = BLANK_AXES.filter((x) => !String(x.aim ?? '').trim()
    || String(x.opts ?? '').trim().length < 20)
  if (空.length) {
    ng('軸 … 4つの関係が書かれていない軸がある', 空.map((x) => x.aim).join(' / '))
  } else ok(`軸 … ${BLANK_AXES.length} つとも、4つがどう関係するかまで書いてある`)

  /* ── ③ **軸の数を書き写していないか** ──
         ★ **文の中の番号(①②…)を数えて、宣言した数と突き合わせる。**
            数を手で書いていたら、軸を足した日にここがずれる */
  /* **選択肢の無い空所補充は、軸の話ではない**(第5.340節で赤くなった)。
     TOEFL の Complete the Words は**語そのものを書き入れる**ので、
     4つの選択肢が無い。**見張りのほうが広すぎた** */
  const 空所の = PICKABLE.filter(({ part }) => choicesOf(part) >= 2
    && (part.sections ?? []).some((x) => x.exercise_type === 'fill_blank'))
  const ずれ = []
  for (const { exam, part } of 空所の) {
    const b = examBrief(exam.id, part.id)
    const 言った = Number(/次の (\d+) つの軸/.exec(b)?.[1])
    const 数えた = [...'①②③④⑤⑥⑦⑧⑨⑩'].filter((c) => b.includes(c)).length
    if (!言った) ずれ.push(`${exam.id}/${part.id} … 軸の数が出ていない`)
    else if (言った !== BLANK_AXES.length) {
      ずれ.push(`${exam.id}/${part.id} … 「${言った}つ」と出るが、一覧は ${BLANK_AXES.length} つ`)
    } else if (数えた < BLANK_AXES.length) {
      ずれ.push(`${exam.id}/${part.id} … 「${言った}つ」と言って ${数えた} つしか並べていない`)
    }
  }
  if (空所の.length < 5) {
    ng('軸 … 空所補充の PART が少なすぎる(見張りが素通りする)', 空所の.length)
  } else if (ずれ.length) {
    ng('軸 … 数を書き写している(一覧と食い違う)', ずれ.slice(0, 3).join('\n    '))
  } else ok(`軸 … 空所補充 ${空所の.length} 個とも、数も並びも一覧から出ている`)

  /* ── ④ **一覧を PART の `make` に書き写していないか** ──
         両方に書くと、片方に足して片方に足し忘れる(今回がそれだった) */
  const 写し = []
  for (const { exam, part } of ALL) {
    if (!part.make) continue
    const 当たり = BLANK_AXES.filter((x) => part.make.includes(x.aim))
    if (当たり.length >= 2) {
      写し.push(`${exam.id}/${part.id} … 軸の名前を ${当たり.length} つ書き写している`)
    }
  }
  if (写し.length) {
    ng('軸 … PART の作り方に、一覧を書き写している', 写し.join('\n    '))
  } else ok('軸 … 一覧は `BLANK_AXES` 1か所だけ(PART に写しが無い)')

  /* ── ⑤ **窓口へ渡る文が、切られる長さを超えていないか** ──
         ★ **軸を足すと文が伸びる。** 窓口は `.slice(0, 2000)` で切るので、
            超えたぶんは**黙って消える**(いちばん悪い壊れ方)。
         **上限を書き写さない。窓口から読み取る**(あちらを変えたら付いてくる) */
  const fnSrc = noC(read('supabase/functions/generate-material/index.ts'))
  const 上限 = Number(/examPart[^\n]*slice\(0,\s*(\d+)\)/.exec(fnSrc)?.[1])
  if (!上限) {
    ng('長さ … 窓口の上限を読み取れない(探し方が壊れている)')
  } else {
    const 長さ = PICKABLE.map(({ exam, part }) =>
      [`${exam.id}/${part.id}`, examBrief(exam.id, part.id).length])
    const 超え = 長さ.filter(([, n]) => n > 上限)
    const 最長 = 長さ.reduce((a, b) => (b[1] > a[1] ? b : a))
    if (超え.length) {
      ng(`長さ … 窓口の上限 ${上限} 文字を超えている(そのぶん黙って消える)`,
        超え.map(([k, n]) => `${k} … ${n} 文字`).slice(0, 3).join('\n    '))
    } else if (最長[1] > 上限 * 0.95) {
      /* **あと5%を切ったら赤。** 1つ足した日に、気づかず切られるのを防ぐ */
      ng(`長さ … 上限 ${上限} 文字まで、あと ${上限 - 最長[1]} 文字しかない`,
        `いちばん長いのは ${最長[0]} の ${最長[1]} 文字`)
    } else {
      ok(`長さ … いちばん長い ${最長[0]} で ${最長[1]} 文字`
        + `(窓口の上限 ${上限} 文字の ${Math.round(最長[1] / 上限 * 100)}%)`)
    }
  }
}


/* ══════════════════════════════════════════════════════════════════
   ★ **窓口で任意の欄を、画面が必須にしていないか**(第5.341節・実機)

     > 3回とも設問が作られないです

   TOEIC Part 5 が**毎回 0 問**になっていた。
   作り方は「hint は空にする」(本番に与える語は無い)と言っているのに、
   **画面の `isBlankItem` が `hint` を必須にしていた** ——
   正しく作られた問が1問残らず「空の問」として落ちていた。

   **窓口の側は、同じことに気づいて先に直してあった。**
   `SECTION_FIELDS.fill_blank` の `hint` は任意で、コメントにも
   「必須のままだと 5回作り直しても 0 問になる」と書いてある。
   **片方だけ直して、片方に書き写し忘れた**のがこれである。
   ══════════════════════════════════════════════════════════════════ */
console.log('\n▶ 必須の欄が、窓口と画面でそろっているか(第5.341節)')
{
  const fnSrc = read('supabase/functions/generate-material/index.ts')
  const blk = /const SECTION_FIELDS[\s\S]*?\n}\n/.exec(fnSrc)?.[0] ?? ''
  const 窓口 = {}
  for (const mm of blk.matchAll(
    /(\w+):\s*\{\s*required:\s*\[([^\]]*)\],\s*optional:\s*\[([^\]]*)\]/g)) {
    窓口[mm[1]] = {
      req: new Set([...mm[2].matchAll(/'(\w+)'/g)].map((x) => x[1])),
      opt: new Set([...mm[3].matchAll(/'(\w+)'/g)].map((x) => x[1])),
    }
  }

  if (Object.keys(窓口).length < 10) {
    ng('必須の欄 … 窓口の一覧を読み取れていない(探し方が壊れている)',
      Object.keys(窓口).length)
  } else {
    /* ── ① **画面が必須とみなす欄は、窓口でも必須か** ──
           ★ **ここが今回の根。** 窓口が任意にしている欄を画面が必須にすると、
              **窓口は空で返してよいのに、画面が1問残らず落とす。**
           **欄の名前を書き写さない** —— `isBlankItem` に
           「その欄だけ空の問」を渡して、落とされるかで測る */
    const ずれ = []
    let 数えた = 0
    for (const t of EXERCISE_TYPES) {
      const w = 窓口[t.id]
      if (!w) continue
      数えた += 1
      for (const f of t.fields) {
        /* **その欄だけを空にした問**を作って、落とされるかを見る */
        const 問 = Object.fromEntries(t.fields.map((x) => [x, x === f ? '' : 'x']))
        if (!isBlankItem(t.id, 問)) continue      // 無くても成り立つ欄
        if (w.opt.has(f)) {
          ずれ.push(`${t.id}/${f} … 窓口は任意なのに、画面は必須(空で返ると全部落ちる)`)
        } else if (!w.req.has(f)) {
          ずれ.push(`${t.id}/${f} … 画面は必須なのに、窓口はその欄を知らない`)
        }
      }
    }
    if (数えた < 10) {
      ng('必須の欄 … 突き合わせた演習が少なすぎる(見張りが素通りする)', 数えた)
    } else if (ずれ.length) {
      ng('必須の欄 … 窓口と画面で食い違っている', ずれ.slice(0, 5).join('\n    '))
    } else ok(`必須の欄 … ${数えた} 種類とも、画面が必須にする欄は窓口でも必須`)

    /* ── ② **本番そっくりの問が、落とされないか** ──
           ★ **決まりだけ見ても足りない。** 実際に作られる形を1つ通す
             (CLAUDE.md「いちばん危ない形を、検証の中に必ず1つ置く」) */
    const Part5の問 = {
      prompt_en: 'The new assistant manager （　　　） the weekly reports since she joined.',
      question: 'Choose the best answer.\n(A) prepare\n(B) prepares\n(C) has prepared\n(D) will prepare',
      hint: '',
      answer: '(C) has prepared',
      note: '現在完了が要るため',
    }
    /* **出る側と出ない側の両方**(CLAUDE.md) */
    const 本当に空 = { prompt_en: '', question: '', hint: '', answer: '' }
    if (isBlankItem('fill_blank', Part5の問)) {
      ng('必須の欄 … 本番そっくりの Part 5 の問が、空として落とされる(0 問になる)')
    } else if (!isBlankItem('fill_blank', 本当に空)) {
      ng('必須の欄 … 本当に空の問が落とされない(落とす仕組みが効いていない)')
    } else ok('必須の欄 … 本番そっくりの Part 5 の問は残り、本当に空の問だけが落ちる')

    /* ── ③ **文型ドリルの穴埋め(選択肢なし)も残るか** ──
           `question` を必須にすると、**あちらが1問残らず落ちる** */
    const ドリルの問 = { prompt_en: 'I （　　　） it yesterday.', hint: 'do', answer: 'did' }
    if (isBlankItem('fill_blank', ドリルの問)) {
      ng('必須の欄 … 選択肢の無い穴埋め(文型ドリル)が落とされる')
    } else ok('必須の欄 … 選択肢の無い穴埋め(文型ドリル)も残る')
  }

  /* ── ④ **落とした理由を、取り違えずに出しているか** ──
         ★ **「前と同じ・似すぎていた」と決めつけて出していた。**
            本当は「欄が空」で落ちていたので、**嘘の知らせ**だった */
  const form = noC(read('src/components/MaterialForm.jsx'))
  const lib = noC(read('src/lib/materials.js'))
  const 理由の数 = Object.keys(DROP_REASONS).length
  if (理由の数 < 5) {
    ng('落とした理由 … 種類が少なすぎる(数え分けていない)', 理由の数)
  } else if (new Set(Object.values(DROP_REASONS)).size !== 理由の数) {
    ng('落とした理由 … 同じ呼び名の理由がある', Object.values(DROP_REASONS).join(' / '))
  } else if (!/落とす\('blank'\)/.test(lib) || !/落とす\('similar'\)/.test(lib)) {
    ng('落とした理由 … 理由を付けずに数えている場所がある')
  } else if (/前と同じ・似すぎていた \$\{dropped\}/.test(form)) {
    ng('落とした理由 … 画面が、理由を決めつけて出している(嘘の知らせになる)')
  } else if (!/dropReasonLine\(droppedWhy\)/.test(form)) {
    ng('落とした理由 … 画面が、理由を出していない')
  } else ok(`落とした理由 … ${理由の数} 種類を数え分けて、そのまま画面に出す`)

  /* ── ⑤ **「出尽くした」と言ってよいかを、決まりで分けているか** ──
         空や形で落ちているのに「英文が出尽くしています」と言わない */
  const 出尽くし = isExhausted({ ...emptyDropCounts(), dup: 10 })
  const 出尽くしでない = isExhausted({ ...emptyDropCounts(), blank: 10 })
  const 数えていない = isExhausted(emptyDropCounts())
  if (!出尽くし) ng('出尽くし … 同じ英文ばかりでも「出尽くした」と言わない')
  else if (出尽くしでない) ng('出尽くし … 欄が空で落ちたのに「出尽くした」と言う(嘘になる)')
  else if (数えていない) ng('出尽くし … 1問も落ちていないのに「出尽くした」と言う')
  else ok('出尽くし … 前に出た英文で落ちたときだけ言う(空・形のときは言わない)')
}

console.log(bad === 0 ? '\n✅ テスト対策の検証は、すべて意図どおりです' : `\n❌ ${bad} 件`)
process.exit(bad === 0 ? 0 : 1)
