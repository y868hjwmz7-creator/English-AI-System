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
  examRealCountByKey, examSectionsOf, examSkipLine, examSkipsOf, examTitle,
  firstPartOf,
  BLANK_AXES, FORMATS, TRAPS, choiceBrief, choicesOf, formatOf, partialOf,
} = await import('../src/data/examPrep.js')
const { DROP_REASONS, emptyDropCounts, isExhausted }
  = await import('../src/lib/dropReasons.js')
const { askFields, dropsLead, splitAsk } = await import('../src/lib/choiceLines.js')
/* ★ **応答が本当に応答になっているかの決まり**（第5.346節） */
const { REPLY_RULE, REPLY_RULE_SWAP } = await import('../src/data/replyRule.js')
const { EXERCISE_TYPES, amountsFor, audioJaOf, defaultSectionsFor, isBlankItem,
  isPassageSection, isScalable, MAX_ITEMS, sectionsFor }
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

  /* ★ ══ **TOEIC Part 5 は、本番と同じ問数を作る**(第5.408節)═══════

       > TOEICのPART５問題、３０問作れるようにしてください。
       > １０問しか作れないのは本番の試験と違う仕様です。

     **Part 5 は「1問 = 1項目」**(1文に空所1つ)なので、本番の問数と
     作る問数を**そのまま比べられる。**

     **数を書き写さない。** 期待する数は `real`(「30問」)から読み取り、
     作る数は `sections` から数える —— どちらかを変えた日に、
     もう片方が付いてこなければ赤くなる。
     **作り方の文に書いてある数**も、同じものかを見る
     (もとは `sections` と文の2か所に 10 が別々に書いてあった)。

     **ほかの PART には広げない。** Part 3・4・7 の `count` は
     「本文を何本作るか」であって問数ではないので、`real` と直に
     比べられない(第5.336節の「本番の1セット」)。 */
  {
    const p5 = PICKABLE.find((x) => x.exam.id === 'toeic_lr' && x.part.id === 'p5')?.part
    if (!p5) {
      ng('Part 5 … えらべる PART の中に無い', '見張りが何も測っていない')
    } else {
      const 本番 = Number(/^(\d+)問$/.exec(String(p5.real ?? '').trim())?.[1] ?? 0)
      const 作る = (p5.sections ?? []).reduce((n, sec) => n + Number(sec.count || 0), 0)
      const 文の数 = Number(/(\d+)問に均等/.exec(String(p5.make ?? ''))?.[1] ?? 0)
      if (!本番) {
        ng('Part 5 … 本番の問数を読み取れない', `real は「${p5.real}」`)
      } else if (作る !== 本番) {
        ng('Part 5 … 本番と作る問数が食い違う', `本番 ${本番} 問 / 作る ${作る} 問`)
      } else if (!文の数) {
        ng('Part 5 … 作り方の文に問数が入っていない', 'AI に何問作るのか伝わらない')
      } else if (文の数 !== 本番) {
        ng('Part 5 … 作り方の文の問数が、作る数と食い違う',
          `文は ${文の数} 問 / 作る ${作る} 問 —— 数を2か所に書いている`)
      } else {
        ok(`Part 5 … 本番と同じ ${本番} 問を作る(作り方の文も ${文の数} 問)`)
      }
    }
  }

  /* ★ ══ **問数は選べる**(第5.409節・2026-10-07 利用者の指定)═══════════

       > TOEICのPART5は10問、20問、30問を選べる形のはずなのに必ず10問になる
       > 英検大問1も選択できるようにしてください

     **押せるだけでは足りない。** もとは画面が `examKey` を渡しておらず、
     「リスニングの数」の札が並んでいた —— 押せて、何も起きなかった。
     だから**選んだ数が、本当に `sections` に出てくるか**まで見る。

     **数を書き写さない。** 段は `amountsFor()` から読み取り、
     その1つずつを `sectionsFor()` に通して、**返ってきた数と突き合わせる。** */
  {
    const 悪い = []
    let 見た = 0
    for (const { exam, part } of PICKABLE) {
      const key = examKeyOf(exam.id, part.id)
      for (const sec of part.sections ?? []) {
        /* **テスト対策は、どの演習でも数を変えられる**(`isScalable`)。
           ここが false を返す日が来たら、その時点で赤くなる */
        if (!isScalable(EXAM_KIND, sec.exercise_type)) {
          悪い.push(`${exam.id}/${part.id} … ${sec.exercise_type} の数を変えられない`)
          continue
        }
        const 段 = amountsFor(sec.exercise_type, { examKey: key, base: sec.count })
        if (段.length < 2) {
          悪い.push(`${exam.id}/${part.id} … 選べる数が ${段.length} 個しかない`)
          continue
        }
        /* **既定が1つだけあるか。** 無いと、開き直したとき黙って別の数になる */
        const 既定 = 段.filter((a) => a.id === 'default')
        if (既定.length !== 1) {
          悪い.push(`${exam.id}/${part.id} … 既定の段が ${既定.length} 個`)
          continue
        }
        if (既定[0].count !== sec.count) {
          悪い.push(`${exam.id}/${part.id} … 既定の段(${既定[0].count})が`
            + ` いまの数(${sec.count})と違う`)
          continue
        }
        /* ★ **本番の数が、段に入っているか**(第5.409節)。
             これが無いと、**本番を混ぜるのをやめても緑のまま**だった
             (段の数が減るだけで、どれを選んでも正しく出るため)——
             CLAUDE.md「無ければ素通りする形の検証を書かない」 */
        const 本番 = examRealCountByKey(key)
        if (本番 > 0 && 本番 <= MAX_ITEMS && !段.some((a) => a.count === 本番)) {
          悪い.push(`${exam.id}/${part.id} … 本番の ${本番} 問が段に無い`
            + `(${段.map((a) => a.count).join(' / ')})`)
          continue
        }
        for (const a of 段) {
          const 出た = sectionsFor(EXAM_KIND, { [sec.exercise_type]: a.id }, null, key)
            .find((x) => x.exercise_type === sec.exercise_type)?.count
          if (出た !== a.count) {
            悪い.push(`${exam.id}/${part.id} … 「${a.label}」を選んだのに ${出た} 問`)
          }
          見た += 1
        }
      }
    }
    /* ★ **1つも測っていなければ赤**(無ければ素通りさせない・CLAUDE.md) */
    if (!見た) ng('問数を選ぶ … 1つも測っていない', '段が1つも返っていない')
    else if (悪い.length) ng('問数を選ぶ … 選んだ数が出てこない', 悪い.join('\n    '))
    else {
      const p5 = PICKABLE.find((x) => x.exam.id === 'toeic_lr' && x.part.id === 'p5')?.part
      const 段 = p5 ? amountsFor(p5.sections[0].exercise_type,
        { examKey: 'toeic_lr:p5', base: p5.sections[0].count }).map((a) => a.label) : []
      ok(`問数を選ぶ … ${見た} 通りとも、選んだ数がそのまま出る`
        + `(Part 5 は ${段.join(' / ')})`)
    }
  }

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

  /* ★ **VERSANT は 40 問**(8 + 16 + 6 + 6 + 2 + 2)。**第5.348節で 63 → 40**。
       2024年1月の新形式(Versant by Pearson English Speaking and Listening Test)。
       旧形式(63問)のままだと、**本番に無い PART を2つ出す** */
  if (問数('versant') !== 40) {
    ng('VERSANT … 新形式の本番は 40 問(質問8 + 復唱16 + 会話6 + 文章6 + リテリング2 + 自由2)',
      `${問数('versant')} 問になっている`)
  } else ok('VERSANT … PART の問数を足すと 40 問(新形式どおり)')

  /* ★ **廃止された2つの PART が残っていないか**(第5.348節)。
       TOEIC Speaking の「解決策を提案する問題」と**まったく同じ形**の見張りである。
       **名前だけでなく、作り方の文も見る** —— PART を消しても、
       作り方に「並べ替えて1文にする」が残っていれば本番に無い問が作られる */
  {
    const やめた = ['文の構築', 'Sentence Build', '並べ替えて1文に', '音読']
    const 残り = []
    for (const part of examPartsOf('versant').concat(examSkipsOf('versant'))) {
      const 文 = `${part.label} ${part.what ?? ''} ${part.make ?? ''}`
      for (const 語 of やめた) {
        if (文.includes(語)) 残り.push(`versant/${part.id} … 「${語}」`)
      }
    }
    if (残り.length) {
      ng('VERSANT … 新形式で廃止された PART が残っている', 残り.join('\n    '))
    } else ok('VERSANT … 廃止された「音読」「文の構築」は、名前も作り方も残っていない')
  }

  /* ★ **本番のパッセージの長さ**(第5.348節・利用者の指摘)。

       > Story retellingは、もっと長いです。平均の単語数なども調べて

     **書いてあったのは「30〜40語」**で、旧形式の下限(30語)よりさらに短かった。
     新形式(Speaking and Listening Test)は **4〜10文・50〜150語**である。

     **数を書き写していない** —— 作り方の文から**読み取った数**が、
     旧形式の幅(30〜90)に収まっていたら赤にする。
     Part D も同じ長さなので、**2つとも**見る */
  {
    const 短すぎ = []
    for (const id of ['d', 'e']) {
      const 文 = examBrief('versant', id)
      /* 「50〜150 語」の形を読み取る(全角と半角のどちらの波線でも) */
      const m = /(\d+)\s*[〜~]\s*(\d+)\s*語/.exec(文)
      if (!m) { 短すぎ.push(`versant/${id} … パッセージの語数が作り方に無い`); continue }
      const [下, 上] = [Number(m[1]), Number(m[2])]
      if (下 < 50 || 上 < 150) {
        短すぎ.push(`versant/${id} … ${下}〜${上} 語(新形式は 50〜150 語)`)
      }
      if (!/4\s*[〜~]\s*10\s*文/.test(文)) {
        短すぎ.push(`versant/${id} … 4〜10 文 が作り方に無い`)
      }
    }
    if (短すぎ.length) {
      ng('VERSANT … パッセージが本番より短い', 短すぎ.join('\n    '))
    } else ok('VERSANT … Part D / E のパッセージは 50〜150 語・4〜10 文(新形式どおり)')
  }

  /* ★ **復唱は 5〜15 語**(第5.348節)。「最後は 18 語ほど」と書いていた ——
       **本番より長い文で練習させていた。** ここも**読み取って**見る */
  {
    const 文 = examBrief('versant', 'b')
    const 語 = [...文.matchAll(/\*\*(\d+)\s*語\*\*/g)].map((x) => Number(x[1]))
    if (語.length < 2) {
      ng('VERSANT … 復唱の語数が作り方から読み取れない', 語.join(' / ') || 'なし')
    } else if (Math.min(...語) !== 5 || Math.max(...語) !== 15) {
      ng('VERSANT … 復唱は本番の 5〜15 語にそろえる', `${Math.min(...語)}〜${Math.max(...語)} 語`)
    } else ok('VERSANT … 復唱は 5〜15 語で、順に長くなる(本番どおり)')
  }

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



/* ══════════════════════════════════════════════════════════════════
   ★ **作った英文を、出す前に読み返す**(第5.358節・2026-10-03 実機の指摘)

     > VERSANTのPART Aの問題、この添付のような問題文は意味不明です。
     > こういうバグが起こらないような仕組みは作れますか？

       What do you call the first meal of a wedding day called a party after it?
       （訳も正解も正しく、**英文だけが壊れていた**）
   ══════════════════════════════════════════════════════════════════ */
console.log('\n▶ 作った英文の読み返し(第5.358節)')
{
  const P = await import('../src/lib/proofread.js')
  const 壊れ = 'What do you call the first meal of a wedding day called a party after it?'
  const items = [
    { audio_text: 壊れ, answer: 'A reception', answer_ja: '披露宴' },
    { audio_text: 'How many days are in a week?', answer: 'Seven days', answer_ja: '7日' },
    /* **いちばん危ない形を1つ**(CLAUDE.md)—— **短い応答**。
       2語以下は文法が壊れようがないので、送れば語数ぶんの無駄になる */
    { audio_text: 'Are you ready to go?', answer: 'Me too.', answer_ja: '私も' },
  ]

  /* ── ① **送る英文を、正しく集めているか** ── */
  const lines = P.proofLines(items)
  if (!lines.includes(壊れ)) ng('読み返し … 読み上げる英文を送っていない')
  else ok('読み返し … 読み上げる英文を送っている')
  if (lines.includes('Me too.')) ng('読み返し … 2語以下まで送っている(語数の無駄)')
  else ok(`読み返し … 短すぎるものは送らない(${P.MIN_WORDS} 語から)`)
  /* **同じ英文を2回送らない**(2回ぶん課金される) */
  const 重なり = P.proofLines([...items, ...items])
  if (重なり.length !== lines.length) ng('読み返し … 同じ英文を2回送っている', `${重なり.length} / ${lines.length}`)
  else ok('読み返し … 同じ英文は1度だけ送る', `${lines.length} 行`)
  /* **訳の欄を送っていない**(英文だけでよい。送れば語数が倍になる) */
  if (P.PROOF_FIELDS.some((f) => f.endsWith('_ja'))) ng('読み返し … 訳の欄まで送っている')
  else ok('読み返し … 送るのは英文の欄だけ', P.PROOF_FIELDS.join(' / '))

  /* ── ② **壊れている英文を持つ問だけが落ちるか** ── */
  const { kept, dropped } = P.dropBroken(items, [壊れ])
  if (dropped.length !== 1 || kept.length !== items.length - 1) {
    ng('読み返し … 壊れた問だけが落ちていない', `残り ${kept.length} / 落ち ${dropped.length}`)
  } else ok('読み返し … 壊れた英文を持つ問だけが落ちる')
  /* ★ **出ない側。** 1つも壊れていなければ、1問も落ちない
       —— **いちばん危ない形**(ここで全部落ちると、教材が 0 問になる)。

       **空文字を混ぜて測る。** 窓口が行を突き合わせられなかったときに
       `en: ''` を返すことがありうる —— 空を鍵にすると、
       **その欄が空の問が1つ残らず落ちる**(`text_en` はたいてい空である)。
       **空の一覧だけで測ると、この道を1度も通らない**(CLAUDE.md) */
  const 無事 = P.dropBroken(items, ['', '   '])
  if (無事.kept.length !== items.length || 無事.dropped.length) {
    ng('読み返し … 壊れが1つも無いのに落ちている', `残り ${無事.kept.length}`)
  } else if (P.dropBroken(items, []).kept.length !== items.length) {
    ng('読み返し … 壊れの一覧が空のときに落ちている')
  } else ok('読み返し … 壊れが1つも無ければ(空文字が混ざっても)1問も落ちない')
  /* **大文字小文字・前後の空白で取り逃がさない**(窓口が返す文字と突き合わせる) */
  const ゆれ = P.dropBroken(items, [`  ${壊れ.toUpperCase()}  `])
  if (ゆれ.dropped.length !== 1) ng('読み返し … 大文字小文字や空白で取り逃がす')
  else ok('読み返し … 大文字小文字・空白のゆれでも当たる')

  /* ── ③ **決まりで落としていないか**(実データで測って諦めた) ──
         「同じ語幹が1文に2回」で落とすと、**正しい英語が 1.9% 巻き添え**になる
         (from time to time / over and over again / Same old same old …)。
         **決まりで落とす仕組みを入れていないこと**を見る */
  const 読 = noC(read('src/lib/proofread.js'))
  if (/\bstem\b|語幹|同じ語が2回/.test(読.replace(/^[^]*?export const PROOF_FIELDS/, ''))) {
    ng('読み返し … 決まりで壊れを判じている(正しい英語を巻き添えにする)')
  } else ok('読み返し … 決まりでは判じていない(落とすのは読み返しの結果だけ)')

  /* ── ④ **窓口に、読み返しの頼みごとがあるか** ── */
  const fn = noC(read('supabase/functions/generate-material/index.ts'))
  if (!/mode === 'proofread'/.test(fn)) ng('読み返し … 窓口に頼みごとが無い')
  else ok('読み返し … 窓口が `proofread` を受け取る')
  /* ★ **番号ではなく英文で返すか。** 番号で返して画面が番号で落とすと、
       **並びが1つずれただけで関係のない問が落ちる**
       (数え方を2通り持たない・CLAUDE.md) */
  if (!/bad\.push\(\{ en: lines\[no - 1\]/.test(fn)) {
    ng('読み返し … 窓口が英文そのものを返していない(番号で落とすと、ずれる)')
  } else ok('読み返し … 窓口は英文そのものを返す(番号で突き合わせない)')
  /* **「迷ったら選ばない」と言っているか。**
     正しい英文を落とすほうが、作り直しの費用になる */
  if (!/迷ったら選ばない/.test(fn)) ng('読み返し … 迷ったときの寄せ先を言っていない')
  else ok('読み返し … 迷ったら選ばない(正しい英文を落とさない側へ寄せる)')
  /* **くだけた言い方を落とさないと言っているか**(Native Flow はこれだらけ) */
  if (!/くだけた言い方/.test(fn)) ng('読み返し … 話し言葉を落とさないと言っていない')
  else ok('読み返し … 話し言葉・省略は落とさないと言っている')

  /* ── ⑤ **画面が、本当に通しているか** ──
         素の関数だけ見ると、**画面が渡していなくても緑になる**(第5.330節) */
  const lib2 = noC(read('src/lib/materials.js'))
  const form2 = noC(read('src/components/MaterialForm.jsx'))
  if (!/proofread && 通った\.length/.test(lib2)) ng('読み返し … 生成の輪が読み返していない')
  else ok('読み返し … 生成の輪の中で読み返している(落ちたぶんは作り直される)')
  if (!/落とす\('broken'\)/.test(lib2)) ng('読み返し … 落とした理由を `broken` で数えていない')
  else ok('読み返し … 落とした理由を分けて数えている')
  if (!/proofread: proofreads\(kind\)/.test(form2)) ng('読み返し … 画面が判断を渡していない')
  else ok('読み返し … 画面が `proofreads()` の判断を渡している')
  if (/kind === 'exam'|kind === 'response'/.test(form2.match(/proofread: [^\n]*/)?.[0] ?? '')) {
    ng('読み返し … 画面の中で種類を見分けている(判断は1か所)')
  } else ok('読み返し … 画面の中で種類を見分けていない')
  /* **使ったぶんを、画面の費用に足しているか**(見えない費用を作らない) */
  if (!/usage\.input \+= pr\.usage/.test(lib2)) ng('読み返し … 使ったぶんを費用に足していない')
  else ok('読み返し … 使ったぶんが、画面の「かかった費用」に乗る')
  /* **読み返せなかったときに、黙って続けていないか** */
  if (!/英文の読み返しができませんでした/.test(lib2)) {
    ng('読み返し … 読み返せなかったときに黙っている')
  } else ok('読み返し … 読み返せなくても教材は捨てず、知らせを残す')

  /* ── ⑥ **出る側 / 出ない側**(CLAUDE.md)── */
  const { proofreads } = await import('../src/data/materialKinds.js')
  if (!proofreads('exam') || !proofreads('response')) {
    ng('読み返し … テスト対策と応答問題で読み返していない')
  } else if (proofreads('reading') || proofreads('word')) {
    ng('読み返し … 言われていない種類まで広げている(そのぶん課金される)')
  } else ok('読み返し … テスト対策と応答問題だけ(言われた場所だけ)')
  /* ★ **`asksUnique()` と兼ねていないか。**
       いまは同じ顔ぶれだが、**意味が違う** ——
       1つの関数で兼ねると、片方を広げた日にもう片方も動く */
  const kinds = noC(read('src/data/materialKinds.js'))
  if (/export const proofreads = asksUnique/.test(kinds)) {
    ng('読み返し … `asksUnique()` の別名にしている(意味の違うものを兼ねている)')
  } else ok('読み返し … `asksUnique()` とは別の関数にしてある')
}

/* ══════════════════════════════════════════════════════════════════
   ★ **問題文が2回出ないか**(第5.342節・2026-10-01 実機・利用者の指摘)

     > 問題文がふたつずつ同じものが繰り返されてしまってます

   TOEIC Part 5 で、空所を含む英文が**上下に2回**出ていた。
   作り方が「question には**設問と**、4つの選択肢を入れ」と言っていたので、
   AI は**設問 = 問題文そのもの**と読んで、`prompt_en` と同じ英文を書いた。

   **穴埋めだけが違う** —— 設問文が `prompt_en` の側にある。
   内容の理解やリスニングは `question` にしか無いので、あちらは正しい。
   ══════════════════════════════════════════════════════════════════ */
console.log('\n▶ 問題文が2回出ないか(第5.342節)')
{
  /* ── ① **設問文が別の欄にある演習では、「選択肢だけ」と言っているか** ──
         **欄の名前を書き写さない。** `ASK` の宣言から読み取る */
  const 別の欄 = PICKABLE.filter(({ part }) => choicesOf(part) >= 2
    && (part.sections ?? []).some((x) => x.exercise_type === 'fill_blank'))
  const 設問が同じ欄 = PICKABLE.filter(({ part }) => choicesOf(part) >= 2
    && (part.sections ?? []).some((x) => ['comprehension', 'listening']
      .includes(x.exercise_type)))
  const 漏れ = []
  for (const { exam, part } of 別の欄) {
    const b = examBrief(exam.id, part.id)
    if (!/選択肢[^。]*だけ/.test(b)) 漏れ.push(`${exam.id}/${part.id} … 「選択肢だけ」と言っていない`)
    if (!/もう一度書かない/.test(b)) 漏れ.push(`${exam.id}/${part.id} … 「もう一度書かない」が無い`)
  }
  /* **出る側と出ない側の両方**(CLAUDE.md)。
     設問が `question` にしかない演習では、**設問も入れさせる** */
  const 余り = 設問が同じ欄.filter(({ exam, part }) =>
    !/設問と、/.test(examBrief(exam.id, part.id)))
  if (別の欄.length < 5 || 設問が同じ欄.length < 5) {
    ng('問題文の写し … 片側の PART が少なすぎる(見張りが素通りする)',
      `別の欄 ${別の欄.length} / 同じ欄 ${設問が同じ欄.length}`)
  } else if (漏れ.length) {
    ng('問題文の写し … 穴埋めで「選択肢だけ」と言っていない', 漏れ.slice(0, 3).join('\n    '))
  } else if (余り.length) {
    ng('問題文の写し … 設問が同じ欄の PART で、設問を入れさせていない',
      余り.map(({ exam, part }) => `${exam.id}/${part.id}`).slice(0, 3).join(' / '))
  } else {
    ok(`問題文の写し … 穴埋め ${別の欄.length} 個は「選択肢だけ」、`
      + `読む / 聞く ${設問が同じ欄.length} 個は「設問と選択肢」`)
  }

  /* ── ② **画面でも落ちるか**(指示は読み飛ばされうる・CLAUDE.md)──
         ★ **すでに作った教材がそのまま直る**(作り直し = 課金をしない)。
         **実際の文で測る** —— 決まりだけ見ても足りない */
  const 本文 = 'The marketing department （　　　） a new advertising strategy'
    + ' since the beginning of this quarter.'
  const 写し = dropsLead(本文, ['', 本文])
  const ちがう指示 = dropsLead('Choose the best answer.', ['', 本文])
  const 共通の指示 = dropsLead('Choose the best answer.', ['Choose the best answer.', 本文])
  /* **空白のちがいだけなら、同じものとして落とす** */
  const 空白ちがい = dropsLead(`  ${本文.replace(' a new', '  a  new')}  `, ['', 本文])
  if (!写し) ng('問題文の写し … 画面で落ちない(同じ文が2回出る)')
  else if (ちがう指示) ng('問題文の写し … その問だけの指示まで落ちる(黙って消している)')
  else if (!共通の指示) ng('問題文の写し … 演習ぜんぶで同じ指示文が落ちない')
  else if (!空白ちがい) ng('問題文の写し … 空白のちがいだけで落ちなくなる')
  else ok('問題文の写し … 画面でも落ちる(ちがう指示は残る・空白のちがいは同じ扱い)')

  /* ── ③ **3つの画面とも、すぐ上の英文を渡しているか** ──
         1つでも渡し忘れると、**その画面だけ2回出る** */
  const 渡していない = ['LessonView', 'MaterialBody', 'LearnerHomework'].filter((名) => {
    const src = noC(read(`src/components/${名}.jsx`))
    return !/drop=\{[^}]*it\.prompt_en[^}]*\}/.test(src)
  })
  if (渡していない.length) {
    ng('問題文の写し … すぐ上の英文を渡していない画面がある', 渡していない.join(' / '))
  } else ok('問題文の写し … 3画面とも、すぐ上の英文を渡している')

  /* ── ④ **比べ方は1か所か**(画面の中で文字を突き合わせていないか) ── */
  const 自前 = ['LessonView', 'MaterialBody', 'LearnerHomework', 'ChoiceLines']
    .filter((名) => /lead === |lead\.trim\(\) ===/.test(noC(read(`src/components/${名}.jsx`))))
  if (自前.length) {
    ng('問題文の写し … 画面の中で突き合わせている(判断を2か所に持たない)', 自前.join(' / '))
  } else ok('問題文の写し … 比べ方は `dropsLead()` 1か所だけ')
}


/* ══════════════════════════════════════════════════════════════════
   ★ **設問と選択肢が、1行ずつになるか**(第5.343節・2026-10-02 実機)

     > 設問は必ず改行、見やすく！選択肢も改行！

   TOEIC Part 6 で、**10 問ぜんぶ**が本文・設問・選択肢の団子だった。

     | 欄 | 入っていたもの |
     |---|---|
     | `prompt_en` | 本文 + 設問 + 選択肢(A)(B)(C)(D) ← **ぜんぶ** |
     | `question`  | **空** |

   第5.342節は `question` の側しか見ていなかったので、**素通りした。**
   ══════════════════════════════════════════════════════════════════ */
console.log('\n▶ 設問と選択肢が、1行ずつになるか(第5.343節)')
{
  /* ── ① **どこからが設問か**。**出る側と出ない側の両方**(CLAUDE.md)── */
  const 本文 = 'The office will close early on Friday.'
  const 設問 = 'What should fill the blank?'
  const 割れた = splitAsk(`${本文} ${設問}`)
  const 設問だけ = splitAsk(設問)
  const 割らない = splitAsk(`${本文} The notice says so.`)
  /* **いちばん危ない形を、検証の中に必ず1つ置く**(CLAUDE.md)——
     略語のピリオドで切ると、設問が「Smith. Who …?」になる */
  const 略語 = splitAsk(`Please contact Mr. Smith at once. ${設問}`)
  if (割れた.body !== 本文 || 割れた.ask !== 設問) {
    ng('設問の行 … 本文と設問に割れない', JSON.stringify(割れた))
  } else if (設問だけ.body || 設問だけ.ask !== 設問) {
    ng('設問の行 … 設問だけのときに、空の本文を作っている', JSON.stringify(設問だけ))
  } else if (割らない.ask) {
    ng('設問の行 … 「?」で終わらない文まで設問にしている', JSON.stringify(割らない))
  } else if (略語.ask !== 設問) {
    ng('設問の行 … 略語のピリオドを文末と取り違えている', JSON.stringify(略語))
  } else ok('設問の行 … 「?」で終わる最後の1文だけを分ける(略語では切らない)')

  /* ── ② **本文の欄に混ざった設問と選択肢を、取り出せるか** ──
         ★ **実機の文そのもので測る**(第5.341節で学んだ)。
         決まりだけ見ても、本当に作られる形は通らない */
  const 団子 = 'To All Staff, Starting next Monday, the main elevator will be closed.'
    + ' （　　　）, please use the stairs during this period.'
    + ' Question: What should fill the blank?'
    + ' (A) Therefore (B) However (C) For example (D) In addition'
  const 出した = askFields({ prompt_en: 団子, question: '' })
  const 行 = [splitAsk(出した.question).body, splitAsk(出した.question).ask,
    ...(出した.question.match(/\([A-D]\)/g) ?? [])].filter(Boolean)
  if (/\([A-D]\)/.test(出した.prompt_en)) {
    ng('設問の行 … 本文の欄に選択肢が残っている', 出した.prompt_en)
  } else if (!/Question: What should fill the blank\?$/
    .test(出した.question.split('\n')[0])) {
    ng('設問の行 … 設問が、設問の欄の1行目になっていない', 出した.question.split('\n')[0])
  } else if (出した.question.split('\n').length !== 5) {
    ng('設問の行 … 設問1行 + 選択肢4行になっていない',
      `${出した.question.split('\n').length} 行`)
  } else if (行.length !== 5) {
    ng('設問の行 … 画面に出る行が 5 つにならない', String(行.length))
  } else ok('設問の行 … 本文の欄の団子が、本文 / 設問 / 選択肢 4 行に分かれる')

  /* ── ③ **選択肢が入っていない本文は、1文字も触らない** ──
         ★ **いちばん危ない形を、検証の中に必ず1つ置く**(CLAUDE.md)。
         はじめ `He was late for the meeting.` で測っていたが、
         **「選択肢が2つ未満なら触らない」を外しても緑のまま**だった ——
         `?` で終わらない文は、どうせ割れないからである。
         **`?` で終わる本文**で測ると、欄ごと動いて赤くなる */
  const 記事 = 'Mr. Smith arrived late. Why was he late?'
  const 素通り = askFields({ prompt_en: 記事, question: '' })
  /* 選択肢が1つだけ(本文の中の「(A)」)でも触らない */
  const ひとつの英文 = 'Plan (A) was chosen. Was that right?'
  const ひとつ = askFields({ prompt_en: ひとつの英文, question: '' })
  if (素通り.prompt_en !== 記事 || 素通り.question) {
    ng('設問の行 … ふつうの本文まで割っている', JSON.stringify(素通り))
  } else if (ひとつ.prompt_en !== ひとつの英文) {
    ng('設問の行 … 選択肢が1つしかないのに割っている', ひとつ.prompt_en)
  } else ok('設問の行 … 選択肢が2つ未満の本文は、`?` で終わっても触らない')

  /* ── ④ **設問の欄にも書いてあるとき** ──
         **同じものだけ落とす。ちがえば残す**(黙って消さない・CLAUDE.md)*/
  const 同じ = askFields({ prompt_en: 団子, question: '(A) Therefore\n(B) However\n(C) For example\n(D) In addition' })
  const ちがう = askFields({ prompt_en: 団子, question: '(A) First\n(B) Second\n(C) Third\n(D) Fourth' })
  if (/\([A-D]\)/.test(同じ.prompt_en)) {
    ng('設問の行 … 同じ選択肢が両方に残っている(2回出る)')
  } else if (!/\([A-D]\)/.test(ちがう.prompt_en)) {
    ng('設問の行 … ちがう選択肢を黙って消している', ちがう.prompt_en)
  } else ok('設問の行 … 設問の欄にもあるとき、同じものだけ落とす(ちがえば残す)')

  /* ── ⑤ **3つの画面とも、同じ判断を通しているか** ──
         1つでも抜けると、**その画面だけ団子のまま**になる */
  const 画面 = ['LessonView', 'MaterialBody', 'LearnerHomework']
  const 通していない = 画面.filter((名) => !/askFields\(/.test(noC(read(`src/components/${名}.jsx`))))
  /* **判断を2か所に持たない。** 画面の中で自前に割っていないか */
  const 自前に割る = [...画面, 'ChoiceLines']
    .filter((名) => /splitChoices\(/.test(noC(read(`src/components/${名}.jsx`)))
      && 名 !== 'ChoiceLines')
  if (通していない.length) {
    ng('設問の行 … 本文の欄を分けていない画面がある', 通していない.join(' / '))
  } else if (自前に割る.length) {
    ng('設問の行 … 画面の中で自前に割っている(判断を2か所に持たない)', 自前に割る.join(' / '))
  } else ok(`設問の行 … ${画面.length} 画面とも \`askFields()\` 1か所を通している`)

  /* ── ⑥ **部品が、本文・設問・選択肢を別々の行に出しているか** ──
         ★ **関数の名前を書き写さない**(CLAUDE.md)。
         `choiceLines.js` から**読み取ってから**、その名前で性質を見る */
  const lib = noC(read('src/lib/choiceLines.js'))
  const 割る名 = (lib.match(/export function (\w+)\(lead\)/) ?? [])[1]
  const cl = noC(read('src/components/ChoiceLines.jsx'))
  if (!割る名) {
    ng('設問の行 … 設問を割る関数が `choiceLines.js` に無い')
  } else if (!cl.includes(`${割る名}(`)) {
    ng('設問の行 … 部品が、設問の切り方を自前に持っている', 割る名)
  } else if (!/\{body &&/.test(cl) || !/\{ask &&/.test(cl)) {
    ng('設問の行 … 本文と設問が、別々の行になっていない')
  } else ok('設問の行 … 部品は本文 / 設問 / 選択肢を、別々の行に出す')

  /* ── ⑦ **作り方が「本文の欄に選択肢を書かない」と言っているか** ──
         **出る側と出ない側の両方。** 設問が `question` にしか無い演習
         (内容の理解・リスニング)で言うと、嘘になる */
  const 穴埋め = PICKABLE.filter(({ part }) => choicesOf(part) >= 2
    && (part.sections ?? []).some((x) => x.exercise_type === 'fill_blank'))
  const 読む聞く = PICKABLE.filter(({ part }) => choicesOf(part) >= 2
    && !(part.sections ?? []).some((x) => x.exercise_type === 'fill_blank')
    && (part.sections ?? []).some((x) => ['comprehension', 'listening']
      .includes(x.exercise_type)))
  const 言っていない = 穴埋め.filter(({ exam, part }) =>
    !/に選択肢を書かない/.test(examBrief(exam.id, part.id)))
  const 余計 = 読む聞く.filter(({ exam, part }) =>
    /に選択肢を書かない/.test(examBrief(exam.id, part.id)))
  if (穴埋め.length < 5 || 読む聞く.length < 5) {
    ng('設問の行 … 片側の PART が少なすぎる(見張りが素通りする)',
      `穴埋め ${穴埋め.length} / 読む・聞く ${読む聞く.length}`)
  } else if (言っていない.length) {
    ng('設問の行 … 穴埋めで「本文の欄に選択肢を書かない」と言っていない',
      言っていない.map(({ exam, part }) => `${exam.id}/${part.id}`).slice(0, 3).join(' / '))
  } else if (余計.length) {
    ng('設問の行 … 設問が同じ欄の PART にまで言っている(嘘になる)',
      余計.map(({ exam, part }) => `${exam.id}/${part.id}`).slice(0, 3).join(' / '))
  } else {
    ok(`設問の行 … 穴埋め ${穴埋め.length} 個だけが「本文の欄に選択肢を書かない」`)
  }
}

/** ★ 条件をそのまま渡す形（このファイルの `ok()` は文字を出すだけ） */
const is2 = (cond, name, d = '') => (cond ? ok(d ? `${name}（${d}）` : name) : ng(name, d))


/* ══════════════════════════════════════════════════════════════════
   ★ **えらべる PART は、1つ残らず本当に作れるか**(第5.364節)

   2026-10-03 実機・利用者の指摘。

     > TOEIC speakingの教材が作れません。
     > **もうこう言う機能しないものをいちいち作られるとイライラします**

   数えたら、**えらべる 78 PART のうち 20 が、押した瞬間に断られていた。**
   ぜんぶ同じ理由 —— 本文の要る演習(`discussion`)しか段が無いのに、
   本文を作る段が1つも無かった。

   **「作れないものを一覧に出さない」は、この検証でしか守れない。**
   PART を1つ足した日に、**押すまで分からない**のでは遅い。

   **窓口の決まりを書き写さない。** 窓口のコードから
   「どの演習が本文を要るか」「どういうときに例外か」を**読み取って**
   突き合わせる(第5.340節と同じ作法)。
   ══════════════════════════════════════════════════════════════════ */
console.log('\n▶ えらべる PART は、1つ残らず作れるか(第5.364節)')
{
  const fn = noC(read('supabase/functions/generate-material/index.ts'))

  /* ── ① **窓口から「本文の要る演習」を読み取る** ── */
  const 要る文 = /const needsContext = ([\s\S]*?)\n\n/.exec(fn)?.[1] ?? ''
  const 要る = new Set([...要る文.matchAll(/sectionType === '([a-z_]+)'/g)].map((m) => m[1]))
  is2(要る.size >= 2, '窓口から「本文の要る演習」を読み取れている',
    [...要る].join(' / ') || '(読めない)')

  /* ── ② **本文を作る演習**(窓口の `isPassage`)も読み取る ── */
  const 本文文 = /const isPassage = ([\s\S]*?)\n/.exec(fn)?.[1] ?? ''
  const 本文 = new Set([...本文文.matchAll(/sectionType === '([a-z_]+)'/g)].map((m) => m[1]))
  is2(本文.size >= 2, '窓口から「本文を作る演習」を読み取れている',
    [...本文].join(' / ') || '(読めない)')

  /* ── ③ ★ **テスト対策では、本文が無くても断らない** ──
         ここが無いと、本文の無い PART は**どうやっても作れない。**
         すぐ上の `topic` には、もう同じ例外が書いてある */
  is2(/needsContext && !context && !examPart/.test(fn),
    '本文が無くても、PART の指示があれば断らない')
  /* **本文が無いことを、作り方に書いているか。**
     黙って渡さないと、「本文の内容をきっかけに」と言われた AI が
     **無い本文を探す** */
  is2(/この PART には無い/.test(fn),
    '本文が無いときは、無いとはっきり言っている')

  /* ── ④ ★ **えらべる PART を、1つずつ数える** ── */
  /* **窓口は、テスト対策のとき本文を免じているか**(③で見たのと同じ1行) */
  const 例外あり = /needsContext && !context && !examPart/.test(fn)
  const 作れない = []
  for (const { exam, part } of PICKABLE) {
    const secs = (part.sections ?? []).map((s) => s.exercise_type)
    if (!secs.length) { 作れない.push(`${exam.id}/${part.id} 段が無い`); continue }
    /* **1つめの段が本文になる**(画面の `const [bodyPlan, ...rest] = plan`)。
       そこが本文の要る演習なら、渡す本文が無いまま呼ぶことになる ——
       **テスト対策では PART の指示が代わりになる**ので、それで足りる */
    const 困る = secs.filter((t) => 要る.has(t) && !本文.has(t))
    if (!困る.length) continue
    /* 本文を作る段が手前にあれば、そこから渡される */
    if (本文.has(secs[0])) continue
    /* ★ **「作り方があるから大丈夫」と決めつけない**(第5.364節)。
         それが通るのは、**窓口がその例外を持っているときだけ**である ——
         例外を外せば、作り方があっても断られる(利用者が踏んだ形)。
         **窓口の決まりを読み取ってから**判じる(書き写さない) */
    if (例外あり && String(part.make ?? '').trim()) continue
    作れない.push(`${exam.id}/${part.id}(${part.label}) … ${困る.join('/')} に渡す本文が無い`)
  }
  is2(!作れない.length,
    `えらべる ${PICKABLE.length} PART が、1つ残らず作れる`,
    作れない.length ? `作れない: ${作れない.join(' / ')}` : `${PICKABLE.length} PART`)

  /* ── ⑤ **作れない PART は、理由を書いて外してあるか** ──
         写真が要るものなど、本当に作れないものは `cannot` で外す ——
         **一覧に出したまま断らない**(行き止まりを作らない・CLAUDE.md) */
  const 外した = EXAMS.flatMap((e) => (e.parts ?? []).filter((p) => p.cannot))
  is2(外した.length > 0 && 外した.every((p) => String(p.cannot).trim()),
    '作れない PART は、理由を書いて一覧から外してある',
    外した.map((p) => `${p.label}(${p.cannot})`).join(' / '))
  /* **外した PART には、作り方も段も要らない**(持っていたら、
     どちらが本当か分からなくなる) */
  const ちぐはぐ = 外した.filter((p) => (p.sections ?? []).length || p.make)
  is2(!ちぐはぐ.length, '外した PART は、作り方も段も持っていない',
    ちぐはぐ.map((p) => p.label).join(' / ') || '0 件')
}

console.log('\n▶ 応答と、読み上げた英文の訳(第5.346節)')
{
  /* ── ① **TOEIC L&R Part 2 に、決まりが入っているか** ──
         2026-10-02 利用者の指定「テスト対策にも入れますか → はい」。
         **文は `replyRule.js` 1か所**。ここで言い回しを書き写さず、
         **あちらから読み取って**そのまま入っているかを見る */
  const p2 = examBrief('toeic_lr', 'p2')
  is2(p2.includes(REPLY_RULE_SWAP), '応答 … TOEIC Part 2 に、決まりがそのまま入っている')

  /* ★ ── ①' **Part 2 は、応答問題のほうの決まりを使っていない**(第5.357節)──
         応答問題は利用者の指定で**「同じ人の言い足し」も認めた**が、
         **Part 2 は本番が「2人の会話」と決まっている。**
         **広げるのは、言われた場所だけ**(CLAUDE.md) */
  is2(!p2.includes(REPLY_RULE) && REPLY_RULE !== REPLY_RULE_SWAP,
    '応答 … Part 2 には、応答問題のほうの決まり(言い足しも可)が入っていない')

  /* ── ② **出ない側。** 応答をえらぶ問ではない PART にまで入れていないか ──
         入れると嘘になる(本文を聞いて設問に答える Part 3・4 は、
         そもそも「相手に返事をする」問ではない) */
  const 余計 = PICKABLE
    .filter(({ exam, part }) => examBrief(exam.id, part.id).includes(REPLY_RULE_SWAP))
    .map(({ exam, part }) => `${exam.id}/${part.id}`)
  is2(余計.length === 1 && 余計[0] === 'toeic_lr/p2',
    '応答 … その決まりが入るのは、応答をえらぶ PART だけ', 余計.join(' / ') || 'どこにも入っていない')

  /* ── ③ **決まりの中身**(話す人が入れ替わる / おうむ返し禁止) ── */
  const 欠け = ['入れ替わる', '続きのセリフ', '言い直すだけ']
    .filter((w) => !REPLY_RULE_SWAP.includes(w))
  is2(!欠け.length, '応答 … Part 2 は話す人が入れ替わり、おうむ返しも禁じている',
    欠け.join(' / '))

  /* ── ④ **読み上げた英文の訳**(2026-10-02 利用者の指定)──
       「TOEIC L&R PART2 も応答問題も、読み上げられた文の日本語訳も
         つけてください」

       **窓口が必ず書くか。** 任意にすると、そのときの気分で入ったり
       入らなかったりする(`answer_ja` を必須にしたのとまったく同じ理由) */
  const fnSrc2 = read('supabase/functions/generate-material/index.ts')
  const 欄 = /listening:\s*\{\s*required:\s*\[([^\]]*)\]/.exec(noC(fnSrc2))?.[1] ?? ''
  is2(/'prompt_ja'/.test(欄), '訳 … 窓口が、読み上げた英文の訳を必ず書く', 欄.trim())
  is2(/prompt_ja に\*\*audio_text/.test(fnSrc2),
    '訳 … 何の訳かを、窓口の指示で言っている(設問の訳と取り違えない)')

  /* ── ⑤ **画面が引く欄は1か所か** ──
       **出る側と出ない側の両方。** 声を出さない演習で誤って出ると、
       **問題文の訳として先に見えて、答えが割れる** */
  const 出る = audioJaOf({ prompt_ja: 'あ' }, 'listening')
  const 出ない = audioJaOf({ prompt_ja: 'あ' }, 'article')
  is2(出る === 'あ' && !出ない,
    '訳 … 聞いて答える演習だけが訳を持つ(記事などは持たない)')

  /* ── ⑥ **空の問として落ちないか** ──
       ★ `fields` に入れると `isBlankItem` が必須として数え、
         **訳の無い古い教材が1問残らず落ちる**(第5.341節で踏んだ形) */
  is2(!isBlankItem('listening',
    { audio_text: 'a', question: 'q', answer: 'x', answer_ja: 'や' }),
  '訳 … 訳の無い問を、空の問として落とさない')

  /* ── ⑦ **3つの画面とも、聞く前に訳を見せていないか** ──
       1画面でも素の `it.prompt_ja` を出すと、**そこだけ答えが割れる** */
  const 画面 = ['LessonView', 'MaterialBody', 'LearnerHomework']
  const 生で出す = 画面.filter((名) => {
    const src = noC(read(`src/components/${名}.jsx`))
    const 行 = [...src.matchAll(/\{it\.prompt_ja &&([^\n]*)/g)].map((m) => m[1])
    return 行.some((x) => !/audioJaOf/.test(x))
  })
  const 通していない = 画面.filter((名) => !/audioJaOf\(/.test(noC(read(`src/components/${名}.jsx`))))
  if (通していない.length) {
    ng('訳 … 読み上げた英文の訳を出していない画面がある', 通していない.join(' / '))
  } else if (生で出す.length) {
    ng('訳 … 聞く前に訳が見える画面がある(答えが割れる)', 生で出す.join(' / '))
  } else ok(`訳 … ${画面.length} 画面とも \`audioJaOf()\` を通し、聞く前には出さない`)
}

/* ============================================================================
   ★ **弱点タグも併用できる**(第5.367節・2026-10-04 利用者の指定)

     > 弱点タグも併用はできるようにしておいてください

   テスト対策と応答問題では、弱点タグは**要らない**(`needsWeakTag()`)。
   ところが**「要らない」と「効かない」を取り違えていた。**

   弱点は指示のいちばん手前にあり、PART の作り方はいちばん後ろにあって
   「この PART の指示が勝つ」と書いてある。
   **同じ細かさなら後ろが勝つ**(第5.338節)ので、えらんでも打ち消されていた。

   ── **ここで気をつけたこと**(第5.338節で踏んだ形)──────────────

     並び順を測る見張りは、**目じるしが1つだと先に数える。**
     `examPart` はファイルに何度も出てくるので、
     それで測ると**並べ替えても必ず「後ろにある」ことになる。**
   ========================================================================== */
{
  const fnSrc = read('supabase/functions/generate-material/index.ts')
  const fn = noC(fnSrc)
  const 数 = (t, x) => t.split(x).length - 1

  /* ── ① **目じるしが1つだけか**(測る前に数える)── */
  const 作り方印 = '食い違うときは、この PART の指示が勝つ'
  const 弱点印 = '上の形を崩さずに、中身をここへ寄せる'
  is2(数(fn, 作り方印) === 1 && 数(fn, 弱点印) === 1,
    '併用 … 並び順を測る目じるしは、窓口に1つずつしか無い',
    `作り方 ${数(fn, 作り方印)} / 弱点 ${数(fn, 弱点印)}`)

  /* ── ② **弱点の言い直しが、PART の作り方より後ろにあるか** ──
       **前にあると、後ろの作り方に打ち消される**(これが実際の不具合) */
  is2(fn.indexOf(弱点印) > fn.indexOf(作り方印) && fn.includes(弱点印),
    '併用 … 弱点の言い直しは、PART の作り方より後ろにある(後ろが勝つ)')

  /* ── ③ **番号つきの弱点一覧を、2通りに数えていないか** ──
       混ぜる指示と、PART のあとの言い直しの2か所が組む。
       **名前は書き写さない** —— ソースから読み取って、同じかを見る */
  const 一覧 = [...fn.matchAll(/(\w+)\.map\(\(t, i\) =>/g)].map((m) => m[1])
  is2(一覧.length >= 2 && new Set(一覧).size === 1,
    '併用 … 弱点の一覧を組むところは、どこも同じ1つの変数を読む',
    一覧.join(' / ') || '(1つも無い)')

  /* ── ④ **種類で分けていないか** ──
       テスト対策も応答問題も、作り方は同じ欄(`examPart`)で届く。
       **ここで種類を見ると、応答問題でだけ効かなくなる** */
  /* **窓を広く取らない。** はじめ手前の 160 文字を見ていたが、
     **1つ上の `SECTION_INSTRUCTIONS[sectionType]` まで入って**、
     並び順を変えただけで赤くなった(第5.367節の赤チェックで出た)。
     **見るのは、その行と、すぐ上の空でない1行だけ** */
  const 行 = fn.split('\n')
  const 印行 = 行.findIndex((l) => l.includes(弱点印))
  const 上 = 行.slice(0, 印行).reverse().find((l) => l.trim()) ?? ''
  const 条件 = `${上}\n${行[印行] ?? ''}`
  is2(/examPart/.test(条件) && !/sectionType|listening|response/.test(条件),
    '併用 … 弱点の言い直しは、種類ではなく「作り方が来ているか」で決める',
    JSON.stringify(上.trim()))

  /* ── ⑤ **窓口が、1つだけえらんだときも一覧に入れるか** ──
       画面は1つなら `topic`、2つ以上なら `topics` に入れて送る。
       **片方しか見ていないと、1つえらんだときに黙って落ちる** */
  const 組む = /const \w+ = topics\.length > 1 \? topics : \(topic \?/.test(fn)
  is2(組む, '併用 … 1つだけえらんだとき(`topic`)も、弱点の一覧に入る')

  /* ── ⑥ **画面: 必須かどうかを `needsWeakTag()` が決めているか** ──
       `isPassageKind()` で分けていたので、**テスト対策と応答問題にも
       「選んでから押してください」と出ていた**(必須ではないのに) */
  const form = noC(read('src/components/MaterialForm.jsx'))
  const 文 = '選んでから押してください'
  if (数(form, 文) !== 1) {
    ng('併用 … 「選んでから押してください」の目じるしが1つではない', String(数(form, 文)))
  } else {
    const 手前 = form.slice(Math.max(0, form.indexOf(文) - 260), form.indexOf(文))
    is2(/needsWeakTag\(/.test(手前) && !/isPassageKind\(/.test(手前),
      '併用 … 「選んでから押してください」を出すかは `needsWeakTag()` が決める',
      JSON.stringify(手前.trim().split('\n').slice(-2).join(' ')))
  }

  /* ── ⑦ **えらんだ弱点が、作り方を渡す呼び出しでも届いているか** ──
       **届かなければ、画面でえらべても何も変わらない**(効かない操作) */
  const 呼び出し = [...form.matchAll(/\{[^{}]*examPart: makeBrief\(\)[^{}]*\}/g)]
    .map((m) => m[0])
  const 落ちている = 呼び出し.filter((c) => !/\btopic:/.test(c))
  if (!呼び出し.length) {
    ng('併用 … 作り方を渡している呼び出しが1つも見つからない')
  } else if (落ちている.length) {
    ng('併用 … 弱点を渡していない呼び出しがある(えらんでも効かない)',
      `${落ちている.length} / ${呼び出し.length} か所`)
  } else {
    ok(`併用 … 作り方を渡す ${呼び出し.length} か所とも、えらんだ弱点も渡している`)
  }
}

/* ============================================================================
   ★ **同じ問題を、二度と出さない**(第5.368節・2026-10-04 利用者の指定)

     > あと、試験なだけに同じ問題を何度も出さないようお願いします

   第5.354節で「絶対に同じ設問は作らない」を入れたが、
   **鍵が `prompt_en` と `audio_text` の2つだけ**だった。
   ところが**えらべる 78 PART のうち 21 は、英文の欄が `question` しか無い**
   (英検の英作文・TOEIC Speaking の応答と意見・VERSANT Part F など)。
   **その 21 PART では、保証がまるごと働いていなかった。**

   ── **ここでいちばん効く見張り** ──────────────────────────────

     「えらべる PART を1つずつ、**その演習の形の問を作って、
     鍵が1つでも取れるか**」を見る。**演習の種類を書き写さない** ——
     どの欄が必須かは**窓口のコードから読み取る**(第5.340節)。
     これを戻すと **21 PART が赤くなる。**
   ========================================================================== */
{
  const fn = noC(read('supabase/functions/generate-material/index.ts'))
  const { askKeysOf, sentencesOf, AVOID_COLUMNS }
    = await import('../src/lib/dedupKeys.js')

  /* ── 窓口の「演習ごとの必須の欄」を読み取る ──
       **一覧をこちらに書かない。** 書き写すと、欄を変えた日に
       **仕組みは直っているのに見張りだけが赤くなる**(CLAUDE.md) */
  const 必須 = {}
  for (const m of fn.matchAll(/(\w+):\s*\{\s*required:\s*\[([^\]]*)\]/g)) {
    const 欄 = [...m[2].matchAll(/'([a-z_]+)'/g)].map((x) => x[1])
    if (欄.length) 必須[m[1]] = 欄
  }
  is2(Object.keys(必須).length >= 15,
    `設問 … 窓口から、演習ごとの必須の欄を読み取れた`, `${Object.keys(必須).length} 種類`)

  /* **その演習の形の問を1つ作る。** 英語の欄にはそれぞれ違う文を入れる ——
     同じ文を入れると、どの欄から鍵が取れたのか分からない */
  const 作る = (type, 種) => {
    const it = {}
    for (const c of 必須[type] ?? []) {
      it[c] = c.endsWith('_ja') ? `${種}の日本語` : `${種} sentence for ${c}.`
    }
    return it
  }

  /* ── ① **えらべる PART ぜんぶで、設問の鍵が取れるか** ── */
  const 取れない = []
  for (const { exam, part } of PICKABLE) {
    const key = examKeyOf(exam.id, part.id)
    for (const sec of examSectionsByKey(key) ?? []) {
      const t = sec.exercise_type
      if (!必須[t]) continue
      if (!askKeysOf(作る(t, `${exam.id}/${part.id}`)).length) {
        取れない.push(`${exam.id}/${part.id}(${t})`)
      }
    }
  }
  if (取れない.length) {
    ng(`設問 … 鍵が1つも取れない PART がある(同じ問題が何度でも出る)`,
      `${取れない.length} 件 … ${取れない.slice(0, 6).join(' / ')}`)
  } else {
    ok(`設問 … えらべる ${PICKABLE.length} PART ぜんぶで、設問の鍵が取れる`)
  }

  /* ── ② **「いつも `question` を鍵にする」になっていないか** ──
       **出る側と出ない側の両方**(CLAUDE.md)。
       `listening` の `question` には「最も適切な応答を選べ」のような
       決まり文句が入りうる。鍵にすると **2問目から1問残らず落ち、
       問数がきっちり 1 になる**(第5.345節で踏んだ形) */
  const 決まり文句 = 'Choose the best response to the statement.'
  const 聞く = askKeysOf({ audio_text: 'Could you send me the file?', question: 決まり文句 })
  const 読む = askKeysOf({ question: 'Why did the writer contact the supplier?' })
  is2(聞く.length === 1 && 読む.length === 1,
    '設問 … 本体(読む / 聞く文)があるときは、`question` を鍵にしない',
    `聞く ${聞く.length} 本 / 読むだけ ${読む.length} 本`)

  /* ── ③ **1語の解答は鍵にしない** ──
       第5.354節が `answer` を外した理由そのもの ——
       スクール全体で二度と使えなくすると、**ありふれた語が永久に使えない**。
       **2語以上(和文英訳)は鍵にする** —— あちらは問が日本語なので、
       英文は解答にしか無い */
  const 一語 = askKeysOf({ prompt_ja: '離れて働く', answer: 'remotely' })
  const 一文 = askKeysOf({ prompt_ja: '終える報告書がある', answer: 'I have a report to finish.' })
  is2(一語.length === 0 && 一文.length === 1,
    '設問 … 1語の解答は鍵にしない(2語以上の和文英訳は鍵にする)',
    `1語 ${一語.length} 本 / 1文 ${一文.length} 本`)

  /* ── ④ **意味の近さを測る文が、入れ替わっていないか** ──
       `rawSentencesOf(…)[0]` の1本だけを窓口へ送る。
       `question` を前に挟むと**測る相手が変わる**(言われていないものが動く) */
  /* **その1本を外したときに赤くなる入力を選ぶ**(CLAUDE.md)。
     はじめ `prompt_en` のある問で測ったが、**本体を前に出しても
     1本目は `prompt_en` のまま**なので緑だった(実際に空振りした)。
     **`question` が本体になる問**で測る —— そこだけが入れ替わる */
  const 一本目 = sentencesOf({
    answer: 'Sure, I will send it right away.',
    question: 'What does the woman offer to do?',
  })[0]
  is2(一本目 === 'sure i will send it right away',
    '設問 … 重複を見る英文の1本目は、これまでと同じ(`question` を前に挟まない)',
    JSON.stringify(一本目))

  /* ── ⑤ **集める側も、同じ欄を読んでいるか** ──
       **作る側と探す側で数え方を2通り持たない**(CLAUDE.md)。
       集める側に `question` が無かったので、**AI に渡す「避けてほしい
       英文」にも、前の設問が1本も入っていなかった** */
  const lib = noC(read('src/lib/materials.js'))
  is2(AVOID_COLUMNS.includes('question'),
    '設問 … 避ける英文を集めるときも `question` を読む', AVOID_COLUMNS.join(' / '))
  /* **窓を広く取らない**(第5.367節で踏んだ) ——
     `.in('material_id'` の**すぐ上の1行**だけを見る。
     `.select(…)` を括弧で囲って読もうとすると、
     中に `join(', ')` の括弧があって途中で切れる(実際に赤くなった) */
  const 行 = lib.split('\n')
  const 印 = 行.findIndex((l) => l.includes(".in('material_id'"))
  const 読む欄 = 印 > 0 ? (行[印 - 1] ?? '') : ''
  is2(/\.select\(/.test(読む欄) && /AVOID_COLUMNS/.test(読む欄),
    '設問 … 集める側は、その一覧をそのまま読む(欄を書き写さない)',
    JSON.stringify(読む欄.trim()))

  /* ── ⑥ **台帳(SQL)にも積まれるか** ──
       **3つめの道である。** 鍵を直し、集める側を直しても、
       **台帳に無ければスクール全体の照合は1件も返さない** */
  const sql = read('supabase/migrations/0075_ledger_question.sql')
  const 一覧 = /create or replace function public\.ledger_fields\(\)[\s\S]*?\$\$;/.exec(sql)?.[0] ?? ''
  is2(/'question'/.test(一覧), '設問 … 台帳に積む欄の一覧に `question` が入っている')
  /* **窓は、その1文で切る。** はじめ `[\s\S]*?` でファイルを跨いで
     探していたので、**積むところを書き換えても、下の積み直しの
     `ledger_fields()` に当たって緑のまま**だった(実際に2本空振りした)。
     **`;` までで切る** —— 1文ずつ見る */
  const 積む文 = [...sql.matchAll(/insert into public\.material_sentences[\s\S]*?;/g)]
    .map((m) => m[0])
  is2(積む文.length === 2 && 積む文.every((x) => /ledger_fields\(\)/.test(x)),
    '設問 … 台帳に積む2か所とも、その一覧を読む(欄を書き写さない)',
    `${積む文.filter((x) => /ledger_fields\(\)/.test(x)).length} / ${積む文.length} か所`)
  is2(積む文.some((x) => /from public\.material_items/.test(x)),
    '設問 … すでにある教材のぶんも積み直す(貼る前の設問が抜け落ちない)')
}

/* ============================================================================
   ★ **復唱は、英文を初めから見せない**(第5.369節・2026-10-04 利用者の指定)

     > 英文を繰り返す問題、VERSANTのPART Bのような問題ですが、
     > **初めから英文が見えている仕様は絶対にやめてください**

   **音読と復唱は正反対である。** ところが3つとも `read_aloud`(音読)で
   作っていたので、**聞く前に答えが見えていた** ——
   見て読めるなら、ただの音読である。

   ── **見分け方を、書き写さない** ──────────────────────────────

     どの PART が復唱なのかは、**その PART が自分で書いている言葉**
     (`label` / `what`)から読み取る。
     **一覧をこちらに持たない** —— PART を足した日に付いてくる。
     突き合わせる相手は**仕組みの側**(`hidePromptFromLearner`)なので、
     **同じ出どころを見ていない**(第5.337節で踏んだ形を避ける)。
   ========================================================================== */
{
  const { exerciseType, sectionOpenLabel } = await import('../src/data/exerciseTypes.js')
  const { canQuickRespond, QR_PAIR_TYPES } = await import('../src/lib/quickResponse.js')

  /** その PART は「聞いて繰り返す」ものか(PART 自身の言葉から読み取る) */
  const 復唱か = (p) => /復唱|聞こえた.*繰り返|Listen and Repeat/.test(`${p.label} ${p.what ?? ''}`)
  /** その PART は「画面の英文を読み上げる」ものか */
  const 音読か = (p) => !復唱か(p) && /音読|画面の英文/.test(`${p.label} ${p.what ?? ''}`)

  const 隠す = (t) => Boolean(exerciseType(t)?.hidePromptFromLearner)

  /* ── ① **復唱の PART は、英文を出さない演習だけを使う** ── */
  const 見えている = []
  const 復唱の数 = []
  for (const { exam, part } of PICKABLE) {
    if (!復唱か(part)) continue
    復唱の数.push(`${exam.id}/${part.id}`)
    const types = (examSectionsByKey(examKeyOf(exam.id, part.id)) ?? [])
      .map((x) => x.exercise_type)
    if (!types.length || !types.every(隠す)) 見えている.push(`${exam.id}/${part.id}(${types.join(',')})`)
  }
  if (!復唱の数.length) {
    ng('復唱 … 「聞いて繰り返す」PART が1つも見つからない(目じるしが効いていない)')
  } else if (見えている.length) {
    ng('復唱 … 英文が初めから見えている PART がある', 見えている.join(' / '))
  } else {
    ok(`復唱 … ${復唱の数.join(' / ')} は、英文を画面に出さない演習を使っている`)
  }

  /* ── ② **音読の PART は、これまでどおり英文を出す** ──
       **出る側と出ない側の両方**(CLAUDE.md)。片方だけだと、
       **ぜんぶ隠す形**に書き換えても緑のままになる */
  const 音読 = PICKABLE.filter(({ part }) => 音読か(part))
  const 隠れてしまった = 音読.filter(({ exam, part }) =>
    (examSectionsByKey(examKeyOf(exam.id, part.id)) ?? []).some((x) => 隠す(x.exercise_type)))
  if (!音読.length) {
    ng('復唱 … 「音読」の PART が1つも見つからない(比べる相手が無い)')
  } else {
    is2(!隠れてしまった.length,
      `復唱 … 音読の PART(${音読.map((x) => `${x.exam.id}/${x.part.id}`).join(' / ')})は、英文を出したまま`,
      隠れてしまった.map((x) => `${x.exam.id}/${x.part.id}`).join(' / '))
  }

  /* ── ③ **窓口が、画面に出る欄を出していない** ──
       **出していない欄は書きようがない**(`strict: true`)。
       欄の名前はこちらに書かない —— 復唱の演習を、段から読み取る */
  const 復唱型 = [...new Set(PICKABLE.filter(({ part }) => 復唱か(part))
    .flatMap(({ exam, part }) => (examSectionsByKey(examKeyOf(exam.id, part.id)) ?? [])
      .map((x) => x.exercise_type)))]
  const fnSrc3 = noC(read('supabase/functions/generate-material/index.ts'))
  for (const t of 復唱型) {
    const 欄 = new RegExp(`${t}:\\s*\\{\\s*required:\\s*\\[([^\\]]*)\\]`).exec(fnSrc3)?.[1] ?? ''
    is2(!!欄 && !/'prompt_en'/.test(欄) && /'audio_text'/.test(欄),
      `復唱 … 窓口は ${t} に画面へ出る欄を出していない(読み上げる欄だけ)`,
      欄.trim() || '(窓口にその演習が無い)')
  }

  /* ── ④ **画面が、英文を伏せて・あとで確かめられるか** ──
       **行き止まりを作らない**(CLAUDE.md)。伏せたまま確かめられないと、
       言ったあとに何を言われたのか分からない */
  const lv = noC(read('src/components/LessonView.jsx'))
  const lh = noC(read('src/components/LearnerHomework.jsx'))
  is2(/!secType\?\.hidePromptFromLearner && it\.prompt_en/.test(lv),
    '復唱 … レッスン表示は、伏せる演習の英文を出さない')
  is2(/hidePromptFromLearner && it\.audio_text/.test(lv),
    '復唱 … 開いたときに、読み上げた英文が出る(レッスン表示)')
  is2(/hidePromptFromLearner && !it\.answer && it\.audio_text/.test(lh),
    '復唱 … ゲストの画面でも、正解が無くても開いて確かめられる')
  for (const t of 復唱型) {
    is2(sectionOpenLabel(t, false) === '英文を見る',
      `復唱 … ${t} の開くボタンは「解答」と書かない`, sectionOpenLabel(t, false))
  }

  /* ── ⑤ **「演習の種類を足す場所は5つ」の5つめ** ──
       Quick Response に足し忘れると、その教材だけ薄くなる(第5.256節) */
  for (const t of 復唱型) {
    is2(canQuickRespond(t), `復唱 … ${t} が Quick Response の対にある`,
      QR_PAIR_TYPES.includes(t) ? '' : '入っていない')
  }

  /* ── ⑥ **表の制約に入っているか** ──
       足し忘れると、**発行した瞬間に**止まる(第5.256節で踏んだ形) */
  /* **1ファイルずつ見る。** はじめ2つを `join` して1度に探していたので、
     **移行から外しても、まとめた1つに残っていて緑のまま**だった
     (窓を広く取ったときの、いつもの形)。
     **移行と、利用者が貼るファイルの両方**に入っていないといけない */
  for (const f of ['supabase/migrations/0076_repeat_blind.sql',
    'supabase/apply/pending_matome.sql']) {
    const sql = read(f)
    for (const t of 復唱型) {
      is2(new RegExp(`'${t}'`).test(sql), `復唱 … ${t} が ${f.split('/').pop()} に入っている`)
    }
  }
}

console.log(bad === 0 ? '\n✅ テスト対策の検証は、すべて意図どおりです' : `\n❌ ${bad} 件`)
process.exit(bad === 0 ? 0 : 1)
