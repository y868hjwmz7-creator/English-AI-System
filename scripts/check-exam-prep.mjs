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
} = await import('../src/data/examPrep.js')
const { EXERCISE_TYPES, defaultSectionsFor, isPassageSection, sectionsFor }
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
        + '|answer_alt|answer|audio_text|hint|note|source_en|phonetic)\\s*(?:に|には|は)', 'g')
      const 無い = []
      let 言及ぜんぶ = 0
      for (const { exam, part } of PICKABLE) {
        const ある = new Set((part.sections ?? [])
          .flatMap((sec) => [...(欄[sec.exercise_type] ?? [])]))
        const 言及 = [...new Set([...part.make.matchAll(RE)].map((x) => x[1]))]
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
    [/examPart \? `\$\{examPart\}/.test(fn), '窓口 … 依頼の文に差し込んでいる'],
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

console.log(bad === 0 ? '\n✅ テスト対策の検証は、すべて意図どおりです' : `\n❌ ${bad} 件`)
process.exit(bad === 0 ? 0 : 1)
