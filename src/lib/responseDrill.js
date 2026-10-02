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
    .map((p) => ({ en: String(p?.en ?? '').trim(), ja: String(p?.ja ?? '').trim() }))
    .filter((p) => p.en)
  if (!rows.length) return ''
  const 一覧 = rows
    .map((p, i) => `${i + 1}. ${p.en}${p.ja ? `（${p.ja}）` : ''}`)
    .join('\n')
  const 共通 = [
    '応答問題。**答えが先に決まっている。**',
    `下の表現を「応答の正解」にして、**その応答が自然に返る質問や発言**を作る。`,
    `**1つの表現につき ${times} 問**、**場面の違う質問**を作る`,
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
    ? [
      `question に「Choose the best response.」と**${CHOICE_COUNT}つ**の応答を`,
      '(A)(B)(C) の形で並べる。**正解はそのうち1つだけ**にする。',
      /* ★ **誤りの選択肢を、正解に似せない**(2026-10-01 実機・利用者の指摘)。

           > 選択肢A-Cが似過ぎていて問題になっていません。
           > もっと脈絡のないランダムなものを間違えている選択肢として
           > 置いてください。

         実機では「Mistakes make purple / papers / people」のように、
         **同じ文型のまま1語だけ**入れ替えたものが並んでいた。
         それは**音の聞き分け**の問題であって、
         **覚えた表現を思い出す**練習ではない —— この教材の狙いから外れる。

         TOEIC の対策(`examPrep.js` の Part 2)では、音の似た語を混ぜるのが
         **本番そのもの**なので、あちらは変えていない(言われた場所だけを直す)。 */
      '**誤りの選択肢は、正解に似せない。**',
      '同じ文型のまま1語だけ入れ替えたもの（例: Mistakes make purple /',
      'Mistakes make papers）は**作らない**。',
      '**話題も場面もかみ合わない応答**にする ——',
      'それだけを聞けば英語として自然だが、**その質問への答えにはならない**もの。',
      '正解と**語を重ねない**（同じ出だし・同じ語の繰り返しにしない）。',
      /* **別解を選択肢に入れない。** 4択に正解が2つ並ぶと答え合わせができない */
      '**別解は選択肢に入れない**（answer_alt にだけ書く）。',
    ].join('')
    : [
      'question は**空にする**（選択肢を出さない形である）。',
      '聞いた人が自分で応答を言い、答え合わせで answer と answer_alt を見る。',
    ].join('')
  return `${共通}${形}\n\n【応答の正解にする表現】\n${一覧}`
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

/**
 * ★ **正解の英文を、鳴る順に並べる**(2026-10-01 利用者の指定・第5.334節)。
 *
 *   > その上で、応答問題には正解の聞き流しモードを作ります。
 *   > 問題順をシャッフルもできる仕様です。
 *
 * **支度もこれを使い、聞き流しもこれを使う。**
 * 片方だけ別の並べ方をすると、**支度した音声と、鳴らすときに探す音声の
 * 置き場所が食い違って1本も当たらない**(CLAUDE.md「数え方を2通り持たない」)。
 *
 * **訳も添える**(聞き流しの札に出す)。英文の無い問は落とす。
 *
 * @param {object} material 教材(**応答問題でなければ空**)
 * @param {boolean} on 応答問題か(`isResponseKind(kind)`。**ここで判じ直さない**)
 * @returns {Array<{en: string, ja: string}>}
 */
export function responseAnswers(material, on) {
  if (!on) return []
  const out = []
  for (const sec of material?.sections ?? []) {
    for (const it of sec?.items ?? []) {
      const en = answerSpeakText(it)
      if (!en) continue
      out.push({ en, ja: String(it?.answer_ja ?? '').trim() })
    }
  }
  return out
}
