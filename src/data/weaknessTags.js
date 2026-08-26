/**
 * 弱点タグの定義。
 *
 * レッスンで指摘した弱点に、その場で対応した教材を出すための分類です
 * (仕様書 第 2.3 節)。教材にはこのタグを複数付けられます。
 *
 * このタグが果たす役割は2つあります。
 *   1. 教材ライブラリの検索 — 同じ弱点の教材を探して、そのまま再利用する
 *   2. 弱点の記録         — 誰にどの弱点を何回指摘したかを追い、克服を確認する
 *
 * 【id は変えないこと】
 *   label(画面に出す日本語)はあとから自由に変えて構いませんが、
 *   id は教材との紐付けに使うため、一度使い始めたら変えてはいけません。
 *   id を変えると、その id が付いていた過去の教材が行方不明になります。
 *
 * 【kind の意味】
 *   'weakness' … レッスンで「弱点」として指摘するもの。
 *                 フィードバック画面の選択肢に出ます。
 *   'drill'    … 弱点ではなく、網羅的に反復するための基礎練習。
 *                 教材の分類には使いますが、弱点の選択肢には出しません。
 *
 * タグはあとから足せます。DB のテーブルに1行足すだけで、
 * アプリの作り直しは要りません。最初から完璧を目指す必要はありません。
 */

export const weaknessCategories = [
  { id: 'consonant',  label: '発音(子音)' },
  { id: 'vowel',      label: '発音(母音)' },
  { id: 'rhythm',     label: 'リズム' },
  { id: 'grammar',    label: '文法' },
  { id: 'expression', label: '表現' },
  { id: 'fluency',    label: '流暢さ' },
]

/**
 * hint は、講師本人が後から見て取り違えないための覚え書きです。
 * 似た名前のタグ(分詞まわり、数まわり)の区別に効きます。
 * AI に教材の下書きを作らせるときにも、この hint をそのまま渡します。
 */
export const weaknessTags = [
  // ── 発音(子音) ─────────────────────────────
  { id: 'l-r',                 category: 'consonant',  kind: 'weakness', label: '/l/ と /r/',      hint: 'light / right、collect / correct' },
  { id: 's-th',                category: 'consonant',  kind: 'weakness', label: '/s/ と /th/',     hint: 'sink / think、mouse / mouth' },
  { id: 'b-v',                 category: 'consonant',  kind: 'weakness', label: '/b/ と /v/',      hint: 'best / vest、boat / vote' },
  { id: 'final-consonant',     category: 'consonant',  kind: 'weakness', label: '語尾の子音',      hint: '語尾に母音を足さない。book を「ブックゥ」にしない' },
  { id: 'consonant-cluster',   category: 'consonant',  kind: 'weakness', label: '子音連続',        hint: 'street、texts、asked のように子音が続く形' },
  { id: 'all-consonants',      category: 'consonant',  kind: 'drill',    label: '全子音の基本練習', hint: '弱点ではなく網羅型の反復ドリル。子音をひととおり通す' },

  // ── 発音(母音) ─────────────────────────────
  { id: 'short-long-vowel',    category: 'vowel',      kind: 'weakness', label: '短母音と長母音',   hint: 'ship / sheep、full / fool' },
  { id: 'schwa',               category: 'vowel',      kind: 'weakness', label: 'あいまい母音',     hint: 'about、sofa、banana の弱く読む母音' },

  // ── リズム ────────────────────────────────
  { id: 'word-stress',         category: 'rhythm',     kind: 'weakness', label: '強勢の位置',       hint: '単語のどの音節を強く読むか。PREsent / preSENT' },
  { id: 'sentence-rhythm',     category: 'rhythm',     kind: 'weakness', label: '文全体のリズム',   hint: '強く読む語と弱く読む語の緩急' },
  { id: 'linking',             category: 'rhythm',     kind: 'weakness', label: 'リンキング',       hint: '音のつながり。an apple、pick it up' },
  { id: 'reduction',           category: 'rhythm',     kind: 'weakness', label: '脱落',            hint: '消える音。next day の t、want to → wanna' },

  // ── 文法 ──────────────────────────────────
  { id: 'article',             category: 'grammar',    kind: 'weakness', label: '冠詞',            hint: 'a / an / the / 無冠詞の使い分け' },
  { id: 'preposition',         category: 'grammar',    kind: 'weakness', label: '前置詞',          hint: 'in / on / at / by / for など' },
  { id: 'tense',               category: 'grammar',    kind: 'weakness', label: '時制',            hint: '現在完了と過去形、進行形、時制の一致' },
  { id: 'number-agreement',    category: 'grammar',    kind: 'weakness', label: '単数複数',        hint: '名詞の数と動詞の一致。可算・不可算' },
  { id: 'quantity',            category: 'grammar',    kind: 'weakness', label: '数の表現',        hint: 'much / many / a few / a little / several — 量をあらわす語' },
  { id: 'numerals',            category: 'grammar',    kind: 'weakness', label: '数字',            hint: '金額・日付・桁・小数・パーセントの読み上げ。ビジネスで必須' },
  { id: 'relative-pronoun',    category: 'grammar',    kind: 'weakness', label: '関係代名詞',      hint: 'who / which / that、前置詞 + 関係代名詞' },
  { id: 'subjunctive',         category: 'grammar',    kind: 'weakness', label: '仮定法',          hint: 'If I were / would have など' },
  { id: 'comparison',          category: 'grammar',    kind: 'weakness', label: '比較表現',        hint: '比較級・最上級、as ... as、the 比較級' },
  { id: 'infinitive',          category: 'grammar',    kind: 'weakness', label: 'to不定詞',        hint: '名詞的・形容詞的・副詞的用法、動名詞との使い分け' },
  { id: 'participial-clause',  category: 'grammar',    kind: 'weakness', label: '分詞構文',        hint: 'Walking down the street, I saw ... の形' },
  { id: 'participle',          category: 'grammar',    kind: 'weakness', label: '分詞(ing/ed)',   hint: '名詞を後ろから修飾する形。the man standing there / the car parked there' },
  { id: 'participial-adj',     category: 'grammar',    kind: 'weakness', label: '分詞形容詞',      hint: '感情をあらわす形。interesting / interested、boring / bored' },
  { id: 'conjunction',         category: 'grammar',    kind: 'weakness', label: '接続詞',          hint: 'and / but / although / while / since など' },
  { id: 'ellipsis',            category: 'grammar',    kind: 'weakness', label: '省略表現',        hint: '会話で落とされる語。Sounds good. / Been there.' },
  { id: 'word-order',          category: 'grammar',    kind: 'weakness', label: '語順',            hint: '疑問文・間接疑問・副詞の位置' },

  // ── 表現 ──────────────────────────────────
  { id: 'filler',              category: 'expression', kind: 'weakness', label: 'つなぎ言葉',      hint: 'Well, / Actually, / I mean — 間をつなぐ言い方' },
  { id: 'paraphrase',          category: 'expression', kind: 'weakness', label: '言い換え',        hint: '語が出てこないときに別の言い方で伝える' },
  { id: 'fixed-phrase',        category: 'expression', kind: 'weakness', label: '決まり文句',      hint: '挨拶、依頼、断り、相づちの定型' },
  { id: 'phrasal-verb',        category: 'expression', kind: 'weakness', label: '句動詞',          hint: 'put off / come up with / look into など' },
  { id: 'idiom',               category: 'expression', kind: 'weakness', label: 'イディオム',      hint: '直訳できない慣用表現' },
  { id: 'collocation',         category: 'expression', kind: 'weakness', label: 'コロケーション',  hint: '語の相性。make a decision(× do a decision)' },

  // ── 流暢さ ────────────────────────────────
  { id: 'hesitation',          category: 'fluency',    kind: 'weakness', label: '言いよどみ',      hint: '詰まって止まる、同じ語を繰り返す' },
  { id: 'pausing',             category: 'fluency',    kind: 'weakness', label: '間の取り方',      hint: '意味の切れ目で区切る。不自然な位置で切らない' },
  { id: 'speed',               category: 'fluency',    kind: 'weakness', label: '速さ',            hint: '速すぎる / 遅すぎる。一定の速さを保つ' },
  { id: 'summarizing',         category: 'fluency',    kind: 'weakness', label: '要約',            hint: '要点だけを短くまとめて話す' },
]

/** カテゴリの並び順どおりにタグをまとめて返す(画面での表示用)。 */
export const weaknessTagsByCategory = () =>
  weaknessCategories.map((category) => ({
    ...category,
    tags: weaknessTags.filter((tag) => tag.category === category.id),
  }))

/** レッスンで「弱点」として指摘できるものだけ。基礎ドリルは含まない。 */
export const selectableWeaknessTags = () =>
  weaknessTags.filter((tag) => tag.kind === 'weakness')

export const weaknessTagLabel = (id) =>
  weaknessTags.find((tag) => tag.id === id)?.label ?? id
