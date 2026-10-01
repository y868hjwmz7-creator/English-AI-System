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
      '誤りの選択肢には、**質問の語と音が似ている語**を混ぜる。',
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
export const RESPONSE_SOURCES = [
  { id: 'text', label: 'テキスト', hint: 'Native Flow / RIZAP の冊。UNIT を選べる' },
  { id: 'wordbook', label: 'ゲストの単語帳', hint: '印を付けた語・フレーズ' },
  { id: 'qr', label: 'ゲストの Quick Response 帳', hint: '溜めた文' },
]
export const DEFAULT_RESPONSE_SOURCE = 'text'

/** 「テキスト」をえらんでいるか。**判断は1か所**(画面で `=== 'text'` と書かない) */
export const usesTextBook = (sourceId) => sourceId === 'text'

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
