/**
 * **言い換えの「束」** —— 同じ内容を、いくつもの型で言う(2026-09 利用者の指定)。
 *
 * ============================================================================
 *   > 日本語→英語 / 言い換え ともに型毎の問題数を大幅に増やしてください
 *
 * 【なぜ「束」なのか】
 *
 *   言い換えは **「同じ内容を、別の型で言う」** 練習である。
 *   だから**内容を1つ書けば、そこに乗る型の数だけ問ができる。**
 *
 *     内容: 「この道具のおかげで、家で働ける」
 *       S allows 人 to do        … This tool allows you to work from home.
 *       S enables 人 to do       … This tool enables you to work from home.
 *       S helps 人 (to) do       … This tool helps you work from home.
 *       S makes it possible to do… This tool makes it possible to work from home.
 *
 *   ここに**肉(`swapParts.js` の動詞 52・短い文 40 など)**を掛ける。
 *   束1つ = 型の数 × 肉の数。**これが「掛け算で問を作る」**(CLAUDE.md)。
 *
 *   手で書いた 37 のお題(`frameShift.js`)は**1つも消していない。**
 *   あちらは**場面のある本物の言い回し**で、こちらは**数**である。
 *   役目が違うので、2つとも要る。
 *
 * 【肉は書き足さない。`swapParts.js` を借りる】
 *
 *   動詞も短い文も、日本語 → 英語の練習とまったく同じ一覧を使う。
 *   **部品を1つ足すと、両方の練習が同時に増える**(数え方を2通り持たない)。
 *   束だけの肉が要るときは `own` に書く(骨の `own` と同じ作法)。
 *
 * 【型が1つだけの束もある】
 *
 *   相方の無い型(`All 人 have to do is do` など)は、**1つでも置く。**
 *   言い換えとしては痩せているが、**その型の問が1問のままよりずっと良い。**
 *   **一覧を勝手に減らさない**(`.claude/rules/common.md`)。
 *
 * 【機械で確かめてから出す】
 *
 *   `sayQuestions()` が、組み立てた英文を `frameFormOf()` に通す。
 *   **狙いの型に見えないものは、はじめから出さない** ——
 *   出して「ちがう型です」と言ったら、正しく言えた人に嘘をつくことになる。
 *   だから**ここに書いた型と英文が食い違っていても、画面には出ない。**
 *
 * 【実在の名前を入れない】
 *
 *   会社名・人名・商品名は書かない(`speechStyles.js` と同じ決まり)。
 *
 * @property id    束の id(問の id の頭になる)
 * @property list  肉をどこから取るか(`verb` / `clause` / `noun` / `own`)
 * @property own   その束だけの肉(`list: 'own'` のときだけ)
 * @property ja    日本語のお題。**`___` に肉の日本語が入る。型をまたいで同じ**
 * @property says  型ごとの英文。**`___` に肉の英語が入る**
 * @property says[].ing `list: 'verb'` のとき、原形ではなく ~ing を入れる
 * ============================================================================
 */

/** `___` の目印。**`phraseSwap.js` と同じ形**(2か所に別の印を作らない) */
export { SWAP_BLANK as SAY_BLANK } from './phraseSwap.js'

/** 肉の出どころ。**一覧を勝手に減らさない** */
export const SAY_LISTS = ['verb', 'clause', 'noun', 'own']

/* ── 束だけの肉 ─────────────────────────────────────────────
   **`swapParts.js` に無いものだけ**をここに置く。
   向こうに在るもの(動詞・短い文・名詞句)は借りる。 */

/** 話題(「〜については」の中身) */
const TOPICS = [
  { en: 'the schedule', ja: '予定' },
  { en: 'the budget', ja: '予算' },
  { en: 'pricing', ja: '値付け' },
  { en: 'quality', ja: '品質' },
  { en: 'staffing', ja: '人の手当て' },
  { en: 'the timeline', ja: '日程' },
  { en: 'delivery', ja: '納品' },
  { en: 'training', ja: '研修' },
  { en: 'safety', ja: '安全' },
  { en: 'the contract', ja: '契約' },
  { en: 'support', ja: '支援' },
  { en: 'the design', ja: '設計' },
  { en: 'testing', ja: '試験' },
  { en: 'the launch date', ja: '開始の日' },
  { en: 'cost', ja: '費用' },
  { en: 'communication', ja: '連絡の取り方' },
  { en: 'the process', ja: '進め方' },
  { en: 'the next step', ja: '次の一手' },
]

/** 判断のもとになるもの(「〜を見たうえで」の中身) */
const SOURCES = [
  { en: 'the data', ja: 'そのデータ' },
  { en: 'the report', ja: 'その報告書' },
  { en: 'the feedback', ja: 'もらった意見' },
  { en: 'the numbers', ja: 'その数字' },
  { en: 'the survey', ja: 'その調査' },
  { en: 'the test results', ja: '試験の結果' },
  { en: 'the first draft', ja: '最初の下書き' },
  { en: 'the customer reviews', ja: 'お客様の評価' },
  { en: 'the budget', ja: '予算' },
  { en: 'the proposal', ja: 'その提案' },
  { en: 'the schedule', ja: 'その予定' },
  { en: 'the latest figures', ja: '最新の数字' },
]

/** 気がかりなもの(「私が気にしているのは」の中身) */
const CONCERNS = [
  { en: 'the price', ja: '値段' },
  { en: 'the timing', ja: '時期' },
  { en: 'the quality', ja: '品質' },
  { en: 'the schedule', ja: '予定' },
  { en: 'the workload', ja: '仕事の量' },
  { en: 'the paperwork', ja: '書類仕事' },
  { en: 'the cost', ja: '費用' },
  { en: 'the delay', ja: '遅れ' },
  { en: 'the noise', ja: '騒音' },
  { en: 'the deadline', ja: '締め切り' },
  { en: 'the budget', ja: '予算' },
  { en: 'the process', ja: '進め方' },
  { en: 'the handover', ja: '引き継ぎ' },
  { en: 'the language barrier', ja: '言葉の壁' },
  { en: 'the staffing', ja: '人の手当て' },
  { en: 'the risk', ja: '危なさ' },
]

/** 結果(「〜につながる」の中身) */
const RESULTS = [
  { en: 'delays', ja: '遅れ' },
  { en: 'extra cost', ja: '余計な費用' },
  { en: 'confusion', ja: '混乱' },
  { en: 'rework', ja: 'やり直し' },
  { en: 'mistakes', ja: 'まちがい' },
  { en: 'complaints', ja: '苦情' },
  { en: 'overtime', ja: '残業' },
  { en: 'lost time', ja: '無駄な時間' },
  { en: 'a drop in quality', ja: '品質の低下' },
  { en: 'misunderstanding', ja: '行き違い' },
  { en: 'stress', ja: '負担' },
  { en: 'higher costs', ja: '費用の増加' },
  { en: 'more questions', ja: '質問の増加' },
  { en: 'a better result', ja: 'より良い結果' },
]

/** 人の状態(「みんな〜になった」の中身) */
const ADJ = [
  { en: 'nervous', ja: '不安になった' },
  { en: 'calm', ja: '落ち着いた' },
  { en: 'busy', ja: '忙しくなった' },
  { en: 'uncertain', ja: '迷った' },
  { en: 'tired', ja: '疲れた' },
  { en: 'happy', ja: '喜んだ' },
  { en: 'confident', ja: '自信を持った' },
  { en: 'worried', ja: '心配になった' },
  { en: 'alert', ja: '気を張った' },
  { en: 'focused', ja: '集中した' },
  { en: 'comfortable', ja: '気が楽になった' },
  { en: 'curious', ja: '興味を持った' },
  { en: 'cautious', ja: '慎重になった' },
  { en: 'motivated', ja: 'やる気になった' },
]

/** 要るもの(「〜が要る」の中身) */
const NEEDS = [
  { en: 'patience', ja: '辛抱' },
  { en: 'careful planning', ja: '入念な準備' },
  { en: 'a quick decision', ja: '素早い判断' },
  { en: 'extra time', ja: '余分な時間' },
  { en: 'close teamwork', ja: '密な連携' },
  { en: 'a second opinion', ja: 'もう一人の意見' },
  { en: 'more testing', ja: 'さらなる試験' },
  { en: 'clear rules', ja: 'はっきりした決まり' },
  { en: 'a bigger budget', ja: 'より多い予算' },
  { en: 'regular checks', ja: '定期的な確認' },
  { en: 'good timing', ja: '良い時期' },
  { en: 'strong support', ja: '手厚い支援' },
]

/** 書きもの(関係詞・過去分詞の頭) */
const THINGS = [
  { en: 'report', ja: '報告書' }, { en: 'file', ja: 'ファイル' },
  { en: 'quote', ja: '見積もり' }, { en: 'invoice', ja: '請求書' },
  { en: 'summary', ja: '要約' }, { en: 'draft', ja: '下書き' },
  { en: 'proposal', ja: '提案書' }, { en: 'agenda', ja: '式次第' },
  { en: 'estimate', ja: '見積書' }, { en: 'contract', ja: '契約書' },
  { en: 'form', ja: '用紙' }, { en: 'slide', ja: '資料の1枚' },
  { en: 'photo', ja: '写真' }, { en: 'sample', ja: '見本' },
  { en: 'plan', ja: '計画' }, { en: 'note', ja: '控え' },
  { en: 'list', ja: '一覧' }, { en: 'schedule', ja: '予定表' },
]

/** 人・組織(関係詞・現在分詞の頭) */
const PEOPLE = [
  { en: 'team', ja: 'チーム' }, { en: 'group', ja: '班' },
  { en: 'engineer', ja: '技術者' }, { en: 'designer', ja: '設計の人' },
  { en: 'vendor', ja: '取引先' }, { en: 'partner', ja: '組んでいる相手' },
  { en: 'agency', ja: '代理店' }, { en: 'department', ja: '部署' },
  { en: 'developer', ja: '開発の人' }, { en: 'consultant', ja: '相談役' },
  { en: 'supplier', ja: '仕入れ先' }, { en: 'contractor', ja: '請け負う会社' },
  { en: 'analyst', ja: '分析の人' }, { en: 'translator', ja: '翻訳の人' },
  { en: 'manager', ja: '管理職' }, { en: 'lawyer', ja: '弁護士' },
]

/** 比べる先(「費用というより〜」の中身) */
const COMPARE = [
  { en: 'timing', ja: '時期' }, { en: 'quality', ja: '品質' },
  { en: 'communication', ja: '連絡の取り方' }, { en: 'planning', ja: '準備' },
  { en: 'staffing', ja: '人の手当て' }, { en: 'priority', ja: '優先順位' },
  { en: 'scope', ja: '範囲' }, { en: 'trust', ja: '信頼' },
  { en: 'speed', ja: '速さ' }, { en: 'clarity', ja: '分かりやすさ' },
  { en: 'training', ja: '研修' }, { en: 'process', ja: '進め方' },
]

/** やり方(`the way / the reason` の中身) */
const WAYS = [
  { en: 'he explained it', ja: '彼が説明した' },
  { en: 'we handle complaints', ja: '苦情に対応する' },
  { en: 'they run meetings', ja: '彼らが会議を進める' },
  { en: 'the team works together', ja: 'チームで動く' },
  { en: 'she presents numbers', ja: '彼女が数字を見せる' },
  { en: 'we share files', ja: 'ファイルを渡す' },
  { en: 'the system is set up', ja: '仕組みが組んである' },
  { en: 'they check the quality', ja: '彼らが品質を確かめる' },
  { en: 'we keep the record', ja: '記録を残す' },
  { en: 'he reads the numbers', ja: '彼が数字を読む' },
  { en: 'they train new staff', ja: '彼らが新しい人を育てる' },
  { en: 'we decide the order', ja: '順番を決める' },
]

/** 名詞にしたもの(`名詞化` の中身) */
const NOMINALS = [
  { en: 'Her decision to leave', ja: '彼女が辞めるという判断' },
  { en: 'The introduction of the new rule', ja: '新しい決まりの導入' },
  { en: 'The cancellation of the order', ja: '注文の取り消し' },
  { en: 'His explanation of the delay', ja: '彼の遅れの説明' },
  { en: 'The completion of the audit', ja: '監査の完了' },
  { en: 'The reduction of the budget', ja: '予算の削減' },
  { en: 'The announcement of the merger', ja: '合併の発表' },
  { en: 'The improvement in quality', ja: '品質の向上' },
  { en: 'The delay of the launch', ja: '開始の遅れ' },
  { en: 'The refusal of the offer', ja: '申し出の断り' },
  { en: 'The approval of the budget', ja: '予算の承認' },
  { en: 'The discovery of the error', ja: '誤りの発見' },
]

/** 目標の中身(`同格` の後ろ) */
const TARGETS = [
  { en: 'a 20% increase', ja: '20%増' },
  { en: 'a shorter lead time', ja: '納期の短縮' },
  { en: 'a stable supply', ja: '安定した供給' },
  { en: 'a clear process', ja: 'はっきりした進め方' },
  { en: 'a lower cost', ja: 'より低い費用' },
  { en: 'a faster delivery', ja: 'より早い納品' },
  { en: 'a higher standard', ja: 'より高い水準' },
  { en: 'a smaller team', ja: 'より小さなチーム' },
  { en: 'a wider reach', ja: 'より広い届き方' },
  { en: 'a steady income', ja: '安定した収入' },
  { en: 'a better fit', ja: 'より合うもの' },
  { en: 'a common format', ja: '共通の書き方' },
]

/** 「〜すればするほど」の後ろ */
const MORES = [
  { en: 'the faster we improve', ja: '速く伸びる' },
  { en: 'the fewer mistakes we make', ja: 'まちがいが減る' },
  { en: 'the easier it gets', ja: '楽になる' },
  { en: 'the better we get', ja: '上手くなる' },
  { en: 'the more confident we feel', ja: '自信がつく' },
  { en: 'the less we worry', ja: '心配しなくなる' },
  { en: 'the smoother it runs', ja: 'なめらかに進む' },
  { en: 'the quicker we finish', ja: '早く終わる' },
  { en: 'the more natural it sounds', ja: '自然に聞こえる' },
  { en: 'the clearer our answers become', ja: '答えがはっきりする' },
  { en: 'the calmer we stay', ja: '落ち着いていられる' },
  { en: 'the fewer questions we get', ja: '質問が減る' },
]

/**
 * **束の一覧。並べ替えない。減らさない。**
 *
 * 型の名前は `sentenceFrames.js` と**1文字も違えない** ——
 * 違うと「型が2つある」ことになり、`npm run test:shift` が赤くなる。
 */
export const SAY_BUNDLES = [
  {
    id: 'enable', list: 'verb',
    ja: 'この道具のおかげで、___ことができる',
    says: [
      { form: 'S allows 人 to do', en: 'This tool allows you to ___.' },
      { form: 'S enables 人 to do', en: 'This tool enables you to ___.' },
      { form: 'S helps 人 (to) do', en: 'This tool helps you ___.' },
      { form: 'S makes it possible to do', en: 'This tool makes it possible to ___.' },
    ],
  },
  {
    id: 'block', list: 'verb',
    ja: 'その遅れのせいで、___ことができない',
    says: [
      { form: 'S keeps 人 from ~ing', en: 'The delay keeps us from ___.', ing: true },
      { form: 'S prevents 人 from ~ing', en: 'The delay prevents us from ___.', ing: true },
      { form: 'S stops 人 from ~ing', en: 'The delay stops us from ___.', ing: true },
      { form: 'S discourages 人 from ~ing', en: 'The delay discourages us from ___.', ing: true },
    ],
  },
  {
    id: 'push', list: 'verb',
    ja: 'その結果を見て、私たちは___ことになった',
    says: [
      { form: 'S encourages 人 to do', en: 'The result encourages us to ___.' },
      { form: 'S inspires 人 to do', en: 'The result inspires us to ___.' },
      { form: 'S leads 人 to do', en: 'The result leads us to ___.' },
      { form: 'S prompts 人 to do', en: 'The result prompts us to ___.' },
      { form: 'S forces 人 to do', en: 'The result forces us to ___.' },
      { form: 'S makes 人 do(原形)', en: 'The result makes us ___.' },
    ],
  },
  {
    id: 'rule', list: 'verb',
    ja: '新しい決まりで、私たちは___ことになる',
    says: [
      { form: 'S requires 人 to do', en: 'The new rule requires us to ___.' },
      { form: 'S forces 人 to do', en: 'The new rule forces us to ___.' },
      { form: 'S makes 人 do(原形)', en: 'The new rule makes us ___.' },
    ],
  },
  {
    id: 'hard', list: 'verb',
    ja: 'その騒音のせいで、___のが難しい',
    says: [
      { form: 'S makes it hard for 人 to do', en: 'The noise makes it hard for us to ___.' },
      { form: 'S keeps 人 from ~ing', en: 'The noise keeps us from ___.', ing: true },
    ],
  },
  {
    id: 'involve', list: 'verb',
    ja: 'この仕事には、___ことが含まれる',
    says: [
      { form: 'S involves ~ing', en: 'This job involves ___.', ing: true },
      { form: 'S requires 人 to do', en: 'This job requires you to ___.' },
    ],
  },
  {
    id: 'time', list: 'verb',
    ja: '___のに3週間かかる',
    says: [
      { form: 'S takes (人) 時間 to do', en: 'It takes us three weeks to ___.' },
      { form: 'It takes 時間 to do', en: 'It takes three weeks to ___.' },
    ],
  },
  {
    id: 'soften', list: 'verb',
    ja: '___のは、どうでしょう',
    says: [
      { form: 'It might be worth ~ing', en: 'It might be worth ___.', ing: true },
      { form: 'We may want to ~', en: 'We may want to ___.' },
      { form: 'What if we ~', en: 'What if we ___?' },
      { form: 'Would it be possible to ~', en: 'Would it be possible to ___?' },
      { form: 'I was wondering if you could ~', en: 'I was wondering if you could ___.' },
    ],
  },
  {
    id: 'gerund', list: 'verb',
    ja: '___のは大事だ',
    says: [
      { form: '動名詞', en: '___ is important.', ing: true },
      { form: '形式主語 it', en: 'It is important to ___.' },
    ],
  },
  {
    id: 'connect', list: 'verb',
    ja: '人手が足りない。だから___',
    says: [
      { form: "That's why ~", en: "That's why we ___." },
      { form: 'Which means ~', en: 'We are short-staffed, which means we ___.' },
    ],
  },
  {
    id: 'why', list: 'verb',
    ja: 'そういうわけで、私たちは___',
    says: [
      { form: 'S is why ~', en: 'This is why we ___.' },
      { form: 'S explains why ~', en: 'That explains why we ___.' },
    ],
  },
  {
    id: 'onlydo', list: 'verb',
    ja: '___だけで大丈夫です',
    says: [
      { form: 'All 人 have to do is do', en: 'All you have to do is ___.' },
    ],
  },
  {
    id: 'thatsaid', list: 'verb',
    ja: 'とはいえ、___べきだ',
    says: [
      { form: 'That said, ~', en: 'That said, we should ___.' },
    ],
  },
  {
    id: 'notonly', list: 'verb',
    ja: '時間が浮いただけでなく、___のにも役立った',
    says: [
      { form: 'Not only ~ but also …', en: 'Not only did it save time, but it also helped us ___.' },
    ],
  },
  {
    id: 'fact', list: 'clause',
    ja: '___ということが、気がかりだ',
    says: [
      { form: 'the fact that', en: 'The fact that ___ worries me.' },
      { form: 'what 節', en: 'What worries me is that ___.' },
    ],
  },
  {
    id: 'tell', list: 'clause',
    ja: 'そのデータは、___ことを示している',
    says: [
      { form: 'S shows / suggests (that) ~', en: 'The data shows that ___.' },
      { form: 'S reminds 人 that ~', en: 'The data reminds us that ___.' },
    ],
  },
  {
    id: 'reason', list: 'clause',
    ja: '___ので、方針を変えた',
    says: [
      { form: 'The reason ~ is that …', en: 'The reason we changed the plan is that ___.' },
      { form: 'Which means ~', en: '___, which means we changed the plan.' },
    ],
  },
  {
    id: 'topic', list: 'own', own: TOPICS,
    ja: '___については、もう少し待つべきだ',
    says: [
      { form: 'When it comes to ~', en: 'When it comes to ___, we should wait.' },
      { form: 'As for ~', en: 'As for ___, we should wait.' },
      { form: 'In terms of ~', en: 'In terms of ___, we should wait.' },
    ],
  },
  {
    id: 'given', list: 'own', own: SOURCES,
    ja: '___を見たうえで、待つことにした',
    says: [
      { form: 'Given (that) ~', en: 'Given ___, we decided to wait.' },
      { form: 'Based on ~', en: 'Based on ___, we decided to wait.' },
      { form: '分詞構文', en: 'Having reviewed ___, we decided to wait.' },
    ],
  },
  {
    id: 'focus', list: 'own', own: CONCERNS,
    ja: '私が気にしているのは、___だ',
    says: [
      { form: 'It is X that / who ~', en: 'It is ___ that worries me.' },
      { form: 'What ~ is …', en: 'What worries me is ___.' },
    ],
  },
  {
    id: 'thereis', list: 'own', own: CONCERNS,
    ja: '___に問題がある',
    says: [
      { form: 'There is / are ~', en: 'There is a problem with ___.' },
    ],
  },
  {
    id: 'compare', list: 'own', own: COMPARE,
    ja: '費用というより、___の問題だ',
    says: [
      { form: 'less about A than B', en: 'It is less about cost than ___.' },
      { form: 'A rather than B', en: 'It is ___ rather than cost.' },
      /* **冠詞を落とさない。** `It is not cost but timing.` は正しい英語だが、
         `frameMatch` は**裸の名詞が続くと見分けられない**と宣言している
         (`frameShift.js` の頭)。見分けられない文を出すと、
         **正しく言えた人に「ちがう型です」と言うことになる** */
      { form: 'not A but B', en: 'It is not the cost but the ___.' },
    ],
  },
  {
    id: 'result', list: 'own', own: RESULTS,
    ja: '準備不足は、___につながる',
    says: [
      { form: 'S causes 名詞', en: 'Poor planning causes ___.' },
      { form: 'S leads to 名詞', en: 'Poor planning leads to ___.' },
      { form: 'S results in 名詞', en: 'Poor planning results in ___.' },
    ],
  },
  {
    id: 'bring', list: 'own', own: RESULTS,
    ja: '新しい仕組みは、私たちに___をもたらす',
    says: [
      { form: 'S brings 人 名詞', en: 'The new system brings us ___.' },
      { form: 'S results in 名詞', en: 'The new system results in ___.' },
    ],
  },
  {
    id: 'state', list: 'own', own: ADJ,
    ja: 'その知らせで、みんな___',
    says: [
      { form: 'S makes 人 形容詞', en: 'The news makes everyone ___.' },
      { form: 'S leaves 人 形容詞', en: 'The news leaves everyone ___.' },
      { form: 'S keeps 人/物 形容詞', en: 'The news keeps everyone ___.' },
    ],
  },
  {
    id: 'need', list: 'own', own: NEEDS,
    ja: 'この案件には、___が要る',
    says: [
      { form: 'S requires 名詞', en: 'This project requires ___.' },
      { form: 'S calls for 名詞', en: 'This project calls for ___.' },
    ],
  },
  {
    id: 'thing', list: 'own', own: THINGS,
    ja: '昨日送った___',
    says: [
      { form: '関係詞', en: 'the ___ that we sent yesterday' },
      { form: '過去分詞', en: 'the ___ sent yesterday' },
    ],
  },
  {
    id: 'people', list: 'own', own: PEOPLE,
    ja: 'それに取り組んでいる___',
    says: [
      { form: '関係詞', en: 'the ___ that is working on it' },
      { form: '現在分詞', en: 'the ___ working on it' },
    ],
  },
  {
    id: 'way', list: 'own', own: WAYS,
    ja: '___やり方は、うまくいっている',
    says: [
      { form: 'the way / the reason', en: 'The way ___ works well.' },
    ],
  },
  {
    id: 'nominal', list: 'own', own: NOMINALS,
    ja: '___に、取引先は驚いた',
    says: [
      { form: '名詞化(動詞→名詞)', en: '___ surprised the client.' },
    ],
  },
  {
    id: 'target', list: 'own', own: TARGETS,
    ja: '私たちの狙い、つまり___',
    says: [
      { form: '同格', en: 'our target, ___' },
    ],
  },
  {
    id: 'more', list: 'own', own: MORES,
    ja: '急げば急ぐほど、___',
    says: [
      { form: 'The 比較級, the 比較級', en: 'The faster we go, ___.' },
    ],
  },
]
