/**
 * ============================================================================
 * **応答問題**(0073・第5.332節)
 *
 * 2026-10-01 利用者の指定。
 *
 *   > 今、完成した TOEIC L&R の PART2 問題を応用して、NATIVE FLOW の
 *   > 応答問題を作りたい。問題形式は TOEIC L&R の PART2 と同じにして
 *   > NATIVE FLOW で学ぶ表現が応答の正解となるようにするんです。
 *   > 選択肢 A-C から選ぶんです。または、選択肢なしにも出来るように
 *   > 作成時に選べるように。また、いくつか正解の候補がある場合は
 *   > 別解を設け、明記すること。
 *
 * ── **ふつうの教材と、向きが逆である** ─────────────────────
 *
 *   ふつうは「場面を決める → 英文ができる → そこから問を作る」。
 *   応答問題は**答えが先に決まっている** ——
 *   覚えたい表現が正解で、**それを引き出す質問を作らせる。**
 *
 *   だから窓口へ渡すのは「何を書くか」ではなく
 *   **「この応答が正解になる質問を作れ」**である。
 *
 * ── **1つの表現を2回出す**(利用者の指定)────────────────────
 *
 *   > 20問選んだ時は10個の表現がそれぞれ2回ずつ正解になるようにします。
 *   > 量をこなすためです。
 *
 *   **同じ問を2つ並べるのではない。** 質問が別なら、同じ表現でも
 *   別の場面で言うことになる —— そこが練習になる。
 *
 * ── 算段だけ。**素の node で走らせられる** ──────────────────
 *
 *   Supabase も `import.meta.env` も持たない(`textMix.js` と同じ作法)。
 *   引いてくるのは `responseSources.js`(あちらが Supabase を持つ)。
 * ============================================================================
 */

/* **出どころの呼び名は、テストと分け合う**(第5.260節・下の `RESPONSE_SOURCES`) */
import { EXAM_SOURCES } from './examBuild.js'
/* ★ **応答が本当に応答になっているかの決まり**（第5.344 / 5.346節）。
   **テスト対策の Part 2 と分け合う**ので、書き写さずに読む */
import { REPLY_RULE } from '../data/replyRule.js'
/* ★ **記号（(A) ）の落とし方は 1 か所**（第5.346節） */
import { choiceBody } from './choiceLines.js'
/* ★ **突き合わせは `normEn()` 1か所**（第5.349節）。
   大文字小文字・句読点・空白のちがいを吸収する規則は、
   データベースの `public.norm_en()` と**同じ**ものである ——
   ここで小さな `toLowerCase()` を書くと、**規則が2つになる** */
import { normEn } from './textNorm.js'
/* ★ **文の切り方は `sentenceSplit.js` 1か所**（第5.350節）。
   「読み上げの最後に答えが入っている」を落とすのに、文の終わりが要る ——
   ここで `/[.!?]/` と書くと、略語(Mr. / U.S.)で切れてしまう */
import { splitSentences } from './sentenceSplit.js'

/**
 * **選べる問題数**(2026-10-01 利用者の指定「選べる問題数は 10 20 30」)。
 * **既定はいちばん軽いもの** —— 多いほうを既定にすると、
 * 試しに1本作るだけで 30 問ぶん課金される。
 */
export const RESPONSE_COUNTS = [10, 20, 30]
export const DEFAULT_RESPONSE_COUNT = 10

/**
 * **1つの表現が、何回正解になるか**(利用者の指定「それぞれ2回ずつ」)。
 *
 * **ここ1か所で持つ。** 画面にも窓口にも `2` と書かない ——
 * 「3回ずつ」にしたい日が来たとき、書いた場所の数だけ食い違う。
 */
export const TIMES_PER_PHRASE = 2

/**
 * その問題数で、**表現がいくつ要るか。**
 *
 * 20 問 → 10 個(各2回)。**割り切れない数は選べない**
 * (`RESPONSE_COUNTS` はどれも 2 で割り切れる)ので、切り上げる ——
 * **足りないより、1つ多いほうが安全**である(余りは使わない)。
 */
export const phrasesNeeded = (total) =>
  Math.ceil(Math.max(0, Number(total) || 0) / TIMES_PER_PHRASE)

/** 表現の数から、作れる問の数。**`phrasesNeeded` の裏返し** */
export const questionsFrom = (phrases) =>
  Math.max(0, (phrases ?? []).length) * TIMES_PER_PHRASE

/**
 * **選択肢を出すか**(2026-10-01 利用者の指定
 * 「選択肢 A-C から選ぶ / または、選択肢なしにも出来るように」)。
 *
 * **判断はここ1か所。** 画面でも窓口でも `=== 'choices'` と書かない。
 */
export const RESPONSE_FORMS = [
  { id: 'choices', label: '選択肢から選ぶ（A・B・C）',
    hint: 'TOEIC L&R Part 2 と同じ形。3つの応答から1つを選ぶ' },
  { id: 'open', label: '選択肢なし（自分で言う）',
    hint: '質問を聞いて、自分で応答を言う。答え合わせで正解と別解が出る' },
]
export const DEFAULT_RESPONSE_FORM = 'choices'
export const hasChoices = (form) => form !== 'open'

/** いくつの選択肢を出すか。**Part 2 と同じ3つ**(記号は (A)(B)(C)) */
export const CHOICE_COUNT = 3

/**
 * **表現の選び方**(利用者の指定「完全手動でも選べるオプションも作って」)。
 *
 * `auto` … えらんだ出どころから、必要な数だけ引く
 * `manual` … トレーナーが1つずつえらぶ
 */
export const RESPONSE_PICKS = [
  { id: 'auto', label: 'おまかせ', hint: 'えらんだ出どころから、必要な数だけ引く' },
  { id: 'manual', label: '自分でえらぶ', hint: '使いたい表現を1つずつえらぶ' },
]
export const DEFAULT_RESPONSE_PICK = 'auto'

/**
 * **窓口へ渡す「作り方」**(第5.309節と同じ作法)。
 *
 * **窓口に一覧を書き写さない。** 言い回しを直すたびに関数を配り直す
 * ことになるためである —— だから**文を画面側で組んで渡す。**
 *
 * @param {object} o
 *   - `form` … `RESPONSE_FORMS` の id
 *   - `phrases` … `[{ en, ja }]` **正解になる表現**(並びのまま出す)
 *   - `times` … 1つの表現を何回出すか(既定は `TIMES_PER_PHRASE`)
 * @returns {string} 窓口の `make` にそのまま渡す文
 */
export function responseBrief({ form = DEFAULT_RESPONSE_FORM, phrases = [], times = TIMES_PER_PHRASE } = {}) {
  const rows = (phrases ?? [])
    .map((p) => ({
      en: String(p?.en ?? '').trim(),
      ja: String(p?.ja ?? '').trim(),
      /* **`need` を持っていればそれ。** 無ければ `times` 回
         （これまでの呼び方をそのまま通す） */
      need: Math.max(1, Math.round(Number(p?.need ?? times) || times)),
    }))
    .filter((p) => p.en)
  if (!rows.length) return ''
  /* ★ **表現ごとに「あと何問」を書く**（第5.359節・2026-10-03 実機の指摘）。

       > 67個の英文から134個の応答問題を作ったら、5回も6回も解答になる文も
       > あれば一度も出てこないものもありました

     窓口は**1回に 30 問まで**なので、134 問は**5〜7回に分かれる。**
     これまでは**どの回にも同じ「67個・2問ずつ」を渡していた** ——
     1回で作れるのは 15 個ぶんだけなので、AI は**毎回その場で選び直し**、
     呼び出しをまたいで何を作ったかも知らない。
     **だから偏った。**（`phraseTurn()` が、この回のぶんだけを渡す）

     **数は書かずに、行から読ませる。** 「2問ずつ」と書くと、
     1問だけ足りない表現が混ざった回で食い違う。 */
  const 一覧 = rows
    .map((p, i) => `${i + 1}. ${p.en}${p.ja ? `（${p.ja}）` : ''} … ${p.need} 問`)
    .join('\n')
  const 合計 = rows.reduce((a, p) => a + p.need, 0)
  const 共通 = [
    '応答問題。**答えが先に決まっている。**',
    `下の表現を「応答の正解」にして、**その応答が自然に返る質問や発言**を作る。`,
    `**表現ごとに、横に書いた問数ちょうど**作る（**全部で ${合計} 問**）。`,
    '**ここに書いていない表現を正解にした問は、1問も作らない。**',
    '同じ表現で2問以上作るときは、**場面の違う質問**にする',
    '（同じ質問を繰り返さない。別の場面で同じ応答を言う練習である）。',
    'audio_text に**質問または発言を1文**（10〜15語）、',
    'answer に**応答そのもの**を入れる。',
    'answer_ja に**応答の日本語訳**を入れる。',
    /* ★ **2人の会話にする**（2026-10-02 実機・第5.344節）。

         > 変ですよね、独り言はなしにしましょう！
         > 純粋に応答としてふさわしいものを解答にします

       出どころは**この教材の向きが逆だから**である ——
       答えが先に決まっているので、AI にとっては
       **その表現へつながる前フリ**を書くのがいちばん楽なのである。

       ★ **文は `REPLY_RULE` 1か所**（第5.346節）。
         テスト対策の TOEIC L&R Part 2 も同じ決まりを使うので、
         **ここに書き写すと、必ず片方だけ古くなる**。

       **形（選択肢あり / なし）では分けない。** 独り言になっていたのは
       **正解そのもの**であって、誤りの選択肢ではない ——
       下の `形` へ入れると、**選択肢なしのときだけ河が変わらない** */
    REPLY_RULE,
    /* ★ **別解**(利用者の指定「いくつか正解の候補がある場合は別解を設け、
         明記すること」)。**欄はもうある**(`answer_alt`・0007) */
    'その質問に対して**ほかにも自然な応答がある場合だけ**、',
    'answer_alt にそれを入れる（無ければ空にする）。',
    '**表現は1文字も変えない。** 下に書いたまま answer に入れる。',
  ].join('')
  const 形 = hasChoices(form)
    /* ★ **選択肢は、こちらで組み立てる**（第5.350節・2026-10-02 実機の指摘）。

         > 選択肢ももっと増やしてください。同じもので使いまわし過ぎですので、
         > 全然関係ないものももっと入れないとです

       **2度めの指摘である。** 第5.344節では作り方の文を厳しくしただけで、
       **同じ誤りの選択肢が何度も出てくるのは直らなかった** ——
       1回の呼び出しでは AI の中の「手持ち」が尽きるし、
       **呼び出しをまたぐと前に何を出したか知らない。**

       だから **AI には選択肢を作らせない。** こちらが
       Native Flow の 690 表現から、**1つの教材で二度使わずに**選ぶ
       (`responseChoices.js`)。**0円**で、**本当に関係のない応答**になり、
       **長さも正解にそろう。** */
    ? [
      /* ★ **空にさせない**（第5.353節・実機で 5 回とも 0 問になった）。
           窓口は空の欄がある問を落とすので、**「空にする」と言うと
           1問残らず落ちる**。頭の1文だけ入れさせ、
           **選択肢はこちらが組み立てて差し替える**（第5.350節）。
           **文は `CHOICE_LEAD` 1か所**（書き写さない） */
      `question には「${CHOICE_LEAD}」とだけ入れる。`,
      '**選択肢(A)(B)(C)は書かない。こちらで組み立てる。**',
    ].join('')
    : [
      'question は**空にする**（選択肢を出さない形である）。',
      '聞いた人が自分で応答を言い、答え合わせで answer と answer_alt を見る。',
    ].join('')
  return `${共通}${形}\n\n【応答の正解にする表現】\n${一覧}`
}

/**
 * ★ **この1回で頼む表現と、その問数**(第5.359節・2026-10-03 実機の指摘)。
 *
 *   > 67個の英文をNative Flowから選んで134個の応答問題を作ったら、
 *   > **5回も6回も解答になる文もあれば一度も出てこないものもありました**
 *
 * ── なぜ偏ったか(**測って分かったこと**)──────────────────
 *
 *     表現 67 個 → 問数 134 問
 *     窓口は **1回に 30 問まで** → 呼び出しは最低 5 回、上限 7 回
 *     ところが**どの回にも、同じ「67 個・2問ずつ」**を渡していた
 *
 *   1回で作れるのは **15 個ぶん**だけなので、AI は**毎回その場で
 *   15 個を選び直す。** しかも**呼び出しをまたいで何を作ったか知らない。**
 *   だから好きな表現が何度も選ばれ、選ばれない表現が残った。
 *
 *   **AI の気まぐれではない。こちらが同じ注文を5回出していた。**
 *
 * ── 直し方 ──────────────────────────────────────────
 *
 *   **その回で頼むぶんだけを渡す。**
 *   しかも「15 個ずつ順に」ではなく、**いま何問できているかを数えてから**
 *   足りないものを渡す —— こうしておけば、
 *   **落とされた問(重複・壊れた英文)も、次の回で取り返される。**
 *
 * **並びは変えない。** 元の順のまま、入るところまで取る ——
 * 並べ替えると、どの回に何が行くかが読めなくなる(CLAUDE.md
 * 「一覧を勝手に減らさない。並べ替えも減らすに当たる」)。
 *
 * @param {Array<{en,ja}>} phrases 正解にする表現(ぜんぶ)
 * @param {Array<object>} made ここまでに出来ている問
 * @param {number} need この回で頼める問数
 * @param {number} times 1つの表現を何回出すか
 * @returns {Array<{en,ja,need}>} この回で頼むぶん(**1つは必ず返す**)
 */
export function phraseTurn(phrases, made, need, times = TIMES_PER_PHRASE) {
  /* **出来ている数は、読む欄と同じ落とし方で数える**(`answerSpeakText()`)
     —— 「(A) …」の形でも突き合わせられる(`fillAnswerJa` と同じ作法) */
  const 出た = new Map()
  for (const it of made ?? []) {
    const k = normEn(answerSpeakText(it))
    if (!k) continue
    出た.set(k, (出た.get(k) ?? 0) + 1)
  }
  const 残り = (phrases ?? [])
    .map((p) => ({
      ...p,
      need: Math.max(0, times - (出た.get(normEn(p?.en)) ?? 0)),
    }))
    .filter((p) => p.need > 0 && String(p?.en ?? '').trim())

  const 枠 = Math.max(1, Math.round(Number(need) || 0))
  const out = []
  let 計 = 0
  for (const p of 残り) {
    /* **1つ目は、枠を超えても入れる** —— 0 個で頼むと何も作られない */
    if (out.length && 計 + p.need > 枠) break
    out.push(p)
    計 += p.need
  }
  return out
}

/**
 * **出どころの一覧**(利用者の指定
 * 「すべてのテキスト、そしてゲストの単語帳と quick response からえらべるように」)。
 *
 * **呼び名はここ1か所。** 画面に書き写さない。
 * 冊(テキスト)は `textBooks.js` が一覧を持っているので、**ここには書かない** ——
 * 冊を足した日に、ここだけ古くなる。
 */
export const TEXT_SOURCE = 'text'

export const RESPONSE_SOURCES = [
  { id: TEXT_SOURCE, label: 'テキスト', hint: 'Native Flow / RIZAP の冊。UNIT を選べる' },
  /* **ゲストの単語帳と Quick Response 帳は、テストとまったく同じ出どころ**
     (第5.260節)。**呼び名も id も書き写さない** —— あちら1か所から受け取る。

     **「教材」は出さない。** 応答問題の正解は**覚えたい表現**であって、
     教材の本文ではない(効かない操作を見せない・CLAUDE.md)。
     外すものを名指しするのは、**足された出どころが黙って消えない**ため ——
     `filter` で残すものを並べると、新しい出どころが出てこない */
  ...EXAM_SOURCES.filter((s) => s.id !== 'material'),
]
export const DEFAULT_RESPONSE_SOURCE = TEXT_SOURCE

/** 「テキスト」をえらんでいるか。**判断は1か所**(画面で `=== 'text'` と書かない) */
export const usesTextBook = (sourceId) => sourceId === TEXT_SOURCE

/** その出どころに、ゲストを選んでおく必要があるか(持ちものだから) */
export const needsLearner = (sourceId) => !usesTextBook(sourceId)

/** 呼び名。**一覧はここ1か所**(画面に書き写さない) */
export const responseSourceLabel = (id) =>
  RESPONSE_SOURCES.find((s) => s.id === id)?.label ?? ''

/**
 * **引いてきた行から、正解にする表現をえらぶ。**
 *
 * **足りないぶんは黙って埋めない**(黙って絞らない・CLAUDE.md)——
 * 引けた数をそのまま返し、画面が「何問になるか」を出す。
 *
 * @param {Array<{en,ja}>} rows 引いてきた表現
 * @param {number} total えらんだ問題数
 * @param {function} mix 混ぜ方(`shuffled`)。**渡さなければ並びのまま**
 */
export function pickPhrases(rows, total, mix = null) {
  const seen = new Set()
  const ok = []
  for (const r of rows ?? []) {
    const en = String(r?.en ?? '').trim()
    const ja = String(r?.ja ?? '').trim()
    // **英語と訳の両方そろっているものだけ。** 訳が無いと答え合わせができない
    if (!en || !ja) continue
    const key = en.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    ok.push({ en, ja, ...(r?.from ? { from: r.from } : {}) })
  }
  const list = mix ? mix(ok) : ok
  return list.slice(0, phrasesNeeded(total))
}

/**
 * **何問になるかの1行**(見えない数を画面に出す・CLAUDE.md)。
 *
 * **足りないときは、足りないと言う。** 黙って少ない教材を作らない。
 *
 * ── ★ **自分でえらぶときは、目標の問数が無い**(第5.347節)─────────
 *
 *   > 応答問題において、自分で入れたい表現を選んだ場合は、
 *   > 問題数はその2倍になるという仕様でお願いいたします。
 *   > つまり、問題数に制限はないということです。
 *
 *   `total` に `null` を渡すと、**「◯問には△個が必要です」を言わない。**
 *   そうでなければ、**そのぶんだけえらんだのに「足りない」と言われる。**
 */
export function responseNote(got, total) {
  const want = phrasesNeeded(total)
  const n = (got ?? []).length
  if (!n) return '表現が1つも引けませんでした。出どころを選び直してください。'
  if (n < want) {
    return `表現が ${n} 個しか引けなかったので、${questionsFrom(got)} 問になります`
      + `（${total} 問には ${want} 個が必要です）。`
  }
  return `${n} 個の表現を、それぞれ ${TIMES_PER_PHRASE} 回ずつ出します（全 ${questionsFrom(got)} 問）。`
}

/**
 * ★ **問数を、こちらが決めるか**(第5.347節・2026-10-02 利用者の指定)。
 *
 *   > 自分で入れたい表現を選んだ場合は、問題数はその2倍になる
 *   > …つまり、問題数に制限はないということです。
 *
 * **おまかせ** … 問数をえらんで、その分だけ表現を引く
 * **自分でえらぶ** … えらんだ表現の数 × 回数が問数で、**上限は無い**。
 * だから**問数の欄を出さない**(効かない操作を見せない・CLAUDE.md)。
 *
 * **判断はここ1か所。** 画面で `resPick === 'manual'` と書かない。
 */
export const picksCount = (pickId) => pickId !== 'manual'

/**
 * **応答問題の構成に、問数を差し替える**(0073・第5.332節)。
 *
 * 問数は「えらんだ表現の数 × `TIMES_PER_PHRASE`」なので、
 * `DEFAULT_SECTIONS` には書けない(作るたびに変わる)。
 * **画面が計算して書き写さない** —— ここ1か所で差し替える。
 *
 * **応答問題でなければ、1つも触らない**(渡されたものをそのまま返す)。
 *
 * @param {Array} plan `sectionsFor()` が返した構成
 * @param {boolean} on 応答問題か(`isResponseKind(kind)`。**ここで判じ直さない**)
 * @param {Array} phrases 正解にする表現
 */
export const responsePlan = (plan, on, phrases) => (on
  ? (plan ?? []).map((s) => ({ ...s, count: questionsFrom(phrases) }))
  : plan)

/**
 * ★ **応答問題で、解答として鳴らす英文**(2026-10-01・第5.334節)。
 *
 * **ここだけが決める。** 支度(`sectionRestClips`)も、聞き流しに渡す一覧
 * (`responseAnswers`)も、この1行を通る ——
 * 片方だけが別の欄を読むと、**支度した音声と、鳴らすときに探す音声の
 * 置き場所が食い違って1本も当たらない**(CLAUDE.md
 * 「数え方を2通り持たない。作る側と探す側」)。
 *
 * **`audioTextOf()` ではない。** あちらは**その演習の読み上げ欄**
 * (リスニングなら `audio_text`)を返すもので、解答の欄は見ない。
 *
 * ── ★ **記号（(A) ）は読み上げない**(2026-10-02 利用者の指定・第5.346節)─
 *
 *   > テスト対策(TOEIC L&R Part 2)の解答が、記号の「(A)」ごと
 *   > 読み上げられます。直しますか → はい
 *
 *   `answer` には**記号と語句の両方**が入っている(第5.331節で正解の記号を
 *   散らすために、そう決めた)。**画面にはそのまま出すが、声にするときは
 *   記号を落とす** —— 第5.205節「画面の英文と声にする英文を分ける」と
 *   まったく同じ考え方である。
 *
 *   **落とし方は `choiceBody()` 1か所**(`choiceLines.js`)。
 *
 *   **応答問題の音声は1本も作り直さない** —— あちらの `answer` には記号が
 *   無いので、通しても**文字が1つも変わらない**(= 指紋が同じ = 0円)。
 *   作り直しになるのは**テスト対策の解答を、押して鳴らしたとき**だけである。
 */
export const answerSpeakText = (it) => choiceBody(it?.answer)

/* ★ **「正解の英文を、鳴る順に並べる」は `audioPlaylist.js` へ移した**
     (第5.355節)。

   聞き流しは **読み上げられる文 → 応答** の対で鳴らすことになり、
   **読み上げる欄を `audioTextOf()` から引く**必要が出た。
   あちらは `audioPlaylist.js` にあり、しかも**こちらを取り込んでいる**ので、
   ここから呼ぶと輪になる。**読む欄の判断と同じ場所に置く**のが筋である
   (CLAUDE.md「数え方を2通り持たない。鳴らす側と落とす側」)。

   **中身は消していない。** `responseAnswers()` という名前のまま、
   `audioPlaylist.js` にある(あちらも素の node でそのまま測れる)。 */

/**
 * ★ **解答の訳は、えらんだ表現の側にある**（第5.349節・2026-10-02 利用者の指摘）。
 *
 *   > A2+以上でも解答に英語しか表示されていなかったのでこれを改善して欲しいです
 *
 * 応答問題の `answer` は**トレーナーがえらんだ表現そのまま**である
 * （作り方に「表現は1文字も変えない」と書いてある）。
 * つまり**その日本語訳は、はじめから手元のファイルにある** ——
 * `answer_ja` を AI に書かせる必要はなく、**書かせると空で返ることがある。**
 *
 * **ファイルに書いてあるものは引き直さない = 0円**（CLAUDE.md）。
 * ここで埋めれば、AI が何を返しても**解答の訳が無い問は作られない。**
 *
 * - **空のときだけ埋める。** AI が書いたものは上書きしない ——
 *   場面に合わせて言い換えていることがあり、**黙って別の訳に差し替えない**
 * - **一覧に無い英文は、何も付けない。** 似ている別の表現の訳を
 *   当てると、**嘘の訳**になる（0 と `null` を取り違えない、と同じ）
 * - **応答問題でなければ、1問も触らない**（`on` は呼ぶ側の
 *   `isResponseKind()` から受け取る。**ここで判じ直さない**）
 *
 * @param {Array} items 窓口が返した問
 * @param {boolean} on 応答問題か(`isResponseKind(kind)`)
 * @param {Array<{en: string, ja: string}>} phrases えらんだ表現
 * @returns {Array} 訳を埋めた問（`on` が false なら、渡したものをそのまま）
 */
export function fillAnswerJa(items, on, phrases) {
  const rows = items ?? []
  if (!on) return rows
  /* 英文 → 訳。**同じ英文が2つあれば、先に書いてあるほうを使う** */
  const 訳 = new Map()
  for (const p of phrases ?? []) {
    const key = normEn(p?.en)
    const ja = String(p?.ja ?? '').trim()
    if (!key || !ja || 訳.has(key)) continue
    訳.set(key, ja)
  }
  if (!訳.size) return rows
  return rows.map((it) => {
    if (String(it?.answer_ja ?? '').trim()) return it
    /* **読む欄と同じ落とし方を通す**（`answerSpeakText()`）——
       テスト対策のような「(A) …」の形でも突き合わせられる */
    const ja = 訳.get(normEn(answerSpeakText(it)))
    return ja ? { ...it, answer_ja: ja } : it
  })
}

/**
 * ★ **選択肢の頭に置く1文**(第5.350節)。
 *
 * **ここ1か所。** 組み立てる側(`responseChoices.js`)も、
 * 「取り組み方」へ回す仕組み(`commonLead`)も、この同じ文字を見る。
 */
export const CHOICE_LEAD = 'Choose the best response.'

/**
 * ★ **読み上げる英文の最後から、答えを落とす**
 * (第5.350節・2026-10-02 実機の指摘)。
 *
 *   > 読み上げられる分の最後に、回答となるはずのフレーズが
 *   > 丸ごと入ってしまっているケースが多いです
 *
 * 作り方の文でも禁じてある(`REPLY_RULE`)が、**指示は読み飛ばされうる。**
 * ここで落とせば、窓口を配り直す前でも直る
 * (`givesAwayAnswer` と同じ考え方・CLAUDE.md)。
 *
 * - **落とすのは「末尾の文」だけ。** 途中から抜くと、
 *   残った文がつながらなくなる(**黙って壊さない**)
 * - **1文しか無いときは触らない。** 読み上げを空にすると、
 *   その問は鳴らしようがなくなる(**黙って消さない**)
 * - 突き合わせは `normEn()` —— 大文字小文字や句読点のちがいを吸収する
 *
 * @param {Array} items 窓口が返した問
 * @param {boolean} on 応答問題か(`isResponseKind(kind)`。**ここで判じ直さない**)
 * @returns {Array} 直した問
 */
export function stripHeardAnswer(items, on) {
  const rows = items ?? []
  if (!on) return rows
  return rows.map((it) => {
    const heard = String(it?.audio_text ?? '')
    const want = normEn(answerSpeakText(it))
    if (!heard.trim() || !want) return it
    const spans = splitSentences(heard)
    /* **1文だけなら触らない。** 落とすと読み上げが空になる */
    if (spans.length < 2) return it
    let end = spans.length
    while (end > 1
      && normEn(heard.slice(spans[end - 1].start, spans[end - 1].end)) === want) end -= 1
    if (end === spans.length) return it
    const cut = heard.slice(0, spans[end - 1].end).trim()
    return cut ? { ...it, audio_text: cut } : it
  })
}

/**
 * ★ **同じ解答の問を、続けて出さない**
 * (第5.350節・2026-10-02 実機の指摘)。
 *
 *   > 2連続で同じ回答の問題が続くこともすごく多く、これも改善してください
 *
 * **出どころは、この教材の設計そのものである** ——
 * 1つの表現を `TIMES_PER_PHRASE` 回、正解にする(利用者の指定
 * 「量をこなすため」)。AI は**表現ごとにまとめて**作るので、
 * **何もしなければ必ず隣に並ぶ。**
 *
 * **解答の多い鍵から順に置き、直前と同じ鍵は後回しにする。**
 * 置けなくなった(残りが直前と同じ鍵だけ)ときは、そのまま出す ——
 * **問を捨てない。** 2問とも同じ解答しか無い教材では、並べようがない。
 *
 * @param {Array} items 問
 * @param {boolean} on 応答問題か(`isResponseKind(kind)`)
 * @returns {Array} 並べ替えた問(**元の配列は触らない**)
 */
export function spreadSameAnswer(items, on) {
  const rows = items ?? []
  if (!on || rows.length < 3) return rows
  /** 解答ごとの束。**入れた順のまま**(同じ解答の中では並べ替えない) */
  const 束 = new Map()
  rows.forEach((it, i) => {
    const key = normEn(answerSpeakText(it)) || `#${i}`
    const b = 束.get(key) ?? []
    b.push(it)
    束.set(key, b)
  })
  if (束.size < 2) return rows
  const out = []
  let 直前 = null
  while (out.length < rows.length) {
    /* **残りがいちばん多い鍵。** ただし直前と同じ鍵は飛ばす */
    let えらぶ = null
    for (const [key, b] of 束) {
      if (!b.length || key === 直前) continue
      if (えらぶ === null || b.length > 束.get(えらぶ).length) えらぶ = key
    }
    if (えらぶ === null) {
      /* 直前と同じ鍵しか残っていない。**並べようがないので、そのまま出す** */
      for (const b of 束.values()) while (b.length) out.push(b.shift())
      break
    }
    out.push(束.get(えらぶ).shift())
    直前 = えらぶ
  }
  return out
}
