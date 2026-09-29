/**
 * ============================================================================
 * **テスト対策 —— 試験と、その PART**(第5.309節・2026-09-29 利用者の指定)
 *
 *   > 次に、TOEICスピーキングテストやVERSANTの対策の教材を作りたいです。
 *   > 教材→テスト対策→TOEIC L＆R / 英検 / VERSANT / TOEIC Speaking /
 *   > TOEFL / IELTS などを選べると最高です。
 *   > 各テストの試験の構成を調べ、各PART毎に対策の練習問題を
 *   > 作成できるようにしたいです。
 *
 * ── ここに何を置いているか ──────────────────────────────────
 *
 *   試験ごとに **PART の一覧**と、その PART が
 *
 *     ①本番では何問で、何をする問題なのか(`real` / `what`)
 *     ②この仕組みでは**どの演習の組み合わせ**で作るのか(`sections`)
 *     ③AI に**何を作らせるのか**(`make`)
 *
 *   を持たせてある。**画面も窓口も、ここ1か所から引く。**
 *
 * ── 演習の種類は1つも増やしていない ────────────────────────
 *
 *   0037(会議)・0043(モノローグ)・0069(テスト)と**まったく同じ
 *   やり方**である —— 足したのは `materials.kind` の値 `exam` 1つだけ。
 *   `material_sections_type_check` も、`EXERCISE_TYPES` も触っていない。
 *
 *   | PART の形 | 使う演習(どれも 0007 からある) |
 *   |---|---|
 *   | 文書・会話を読んで(聞いて)設問に答える | `article` / `dialogue` + `comprehension` |
 *   | 空所に入る語句を選ぶ | `fill_blank` |
 *   | 聞いて答える | `listening` |
 *   | 音読・復唱する文 | `read_aloud` |
 *   | 正解が無い(話す・書く) | `discussion` |
 *   | 日本語を見て英語で言う | `translate_ja_en` |
 *   | 出てきた語句を覚える | `vocab_note` |
 *
 * ── **窓口に一覧を書き写さない**(CLAUDE.md)────────────────────
 *
 *   `make` の文は、画面が窓口へ `examPart` として**そのまま送る。**
 *   切り口(`angle`)・かたまりの分類(`chunkKinds`)とまったく同じ作法である。
 *   ここを1行直したいだけで、利用者に窓口の置き直しを頼むことにならない。
 *
 * ── **写真が要る PART は出さない**(効かない操作を見せない)──────
 *
 *   TOEIC L&R の Part 1(写真描写)と TOEIC Speaking の Q3(写真描写)は、
 *   **写真が無ければ問題にならない。** この仕組みは写真を作れないので、
 *   **えらべる一覧には出さない。** ただし**黙って消さない** ——
 *   試験をえらぶと、その1行(`examSkipLine`)が「いまの状態」として出る。
 *
 * ── 数字は**調べたものだけ**書いている ──────────────────────
 *
 *   2026-09-29 に調べて確かめた数字だけを `real` に書いてある。
 *   **確かめられなかったものは、書いていない**(空にしてある)——
 *   分かっていないことを、分かったように書かない(共通ルール)。
 *   とくに **TOEFL iBT は 2026年1月21日から形が変わっている**ので、
 *   古い形(Reading 2パッセージ / Speaking 4タスク)は書いていない。
 *
 * ── Supabase を引き連れない ─────────────────────────────────
 *
 *   何も取り込んでいないので、`npm run test:exam` が素の node で
 *   そのまま読み込んで確かめられる(`materialKinds.js` と同じ考え方)。
 * ============================================================================
 */

/** 教材の種類の id。**画面でも窓口でも、この値を書き写さない** */
export const EXAM_KIND = 'exam'

/* ══════════════════════════════════════════════════════════════════
   よく出てくる作り方の決まり。**1か所に持つ**(呼び名を2か所に書かない)
   ══════════════════════════════════════════════════════════════════ */

/** どの PART にも共通して言うこと */
const COMMON = '**本番そっくりの出題**にすること。'
  + '実在の企業名・人名・商品名は使わない(架空の名前にする)。'

/** 4つの選択肢から選ぶ問題の作り方 */
const CHOICES = '選択肢は**4つ**(A)(B)(C)(D)を prompt_en の下に改行で並べ、'
  + 'answer には**記号と語句の両方**(例「(B) has been」)を入れる。'
  + '**紛らわしい選択肢**にする —— 品詞ちがい・時制ちがい・語形ちがいを混ぜ、'
  + '明らかに違うものを並べない。note に**なぜ他が入らないのか**を日本語で書く。'

/** 3つの選択肢から選ぶ問題(TOEIC Part 2) */
const CHOICES3 = '選択肢は**3つ**(A)(B)(C)を question の下に改行で並べ、'
  + 'answer には**記号と応答の両方**を入れる。'

/* ══════════════════════════════════════════════════════════════════
   試験の一覧。**利用者が並べた順**(TOEIC L&R → 英検 → VERSANT →
   TOEIC Speaking → TOEFL → IELTS)。**勝手に並べ替えない**(CLAUDE.md)
   ══════════════════════════════════════════════════════════════════ */

export const EXAMS = [
  /* ────────────────────────────────────────────────────────────
     TOEIC Listening & Reading(2016年5月〜の形)
     200問・約2時間。リスニング100問(45分)+ リーディング100問(75分)
     ──────────────────────────────────────────────────────────── */
  {
    id: 'toeic_lr',
    label: 'TOEIC L&R',
    full: 'TOEIC Listening & Reading Test',
    outline: '200問・約2時間(リスニング100問 45分 / リーディング100問 75分)',
    parts: [
      { id: 'p1', label: 'Part 1 写真描写問題', real: '6問',
        what: '1枚の写真について4つの説明を聞き、いちばん合うものを選ぶ',
        cannot: '写真が要るため' },
      { id: 'p2', label: 'Part 2 応答問題', real: '25問',
        what: '質問や発言を聞き、3つの応答からいちばん合うものを選ぶ',
        sections: [{ exercise_type: 'listening', count: 10 }],
        make: `TOEIC L&R Part 2(応答問題)。${COMMON}`
          + 'audio_text に**質問または発言を1文**(10〜15語)、'
          + 'question に「Choose the best response.」と3つの応答、'
          + 'answer に正解を入れる。'
          + `${CHOICES3}`
          + '**Yes / No で答えられない疑問文**(WH疑問文・付加疑問・'
          + '選択疑問・平叙文での依頼)を半分以上入れる —— 本番はそこが難しい。'
          + '誤りの選択肢には、**質問の語と音が似ている語**を混ぜる。' },
      { id: 'p3', label: 'Part 3 会話問題', real: '39問(1つの会話につき3問 × 13)',
        what: '2〜3人の短い会話を聞き、設問3問に答える',
        sections: [
          { exercise_type: 'dialogue', count: 10 },
          { exercise_type: 'comprehension', count: 6 },
        ],
        make: `TOEIC L&R Part 3(会話問題)。${COMMON}`
          + '**職場での短い会話**にする(依頼・日程調整・不具合の報告・'
          + '出張の手配・シフト交代など)。1つの会話は 10 発言ほどで、'
          + '**結論が出ないまま終わってもよい**。'
          + '設問は「話し手は誰か」「何が問題か」「次に何をするか」の'
          + '3つの型を混ぜる。' },
      { id: 'p4', label: 'Part 4 説明文問題', real: '30問(1つの説明文につき3問 × 10)',
        what: '1人が話す短い説明(アナウンス・留守電・広告など)を聞き、設問3問に答える',
        sections: [
          { exercise_type: 'article', count: 3 },
          { exercise_type: 'comprehension', count: 6 },
        ],
        make: `TOEIC L&R Part 4(説明文問題)。${COMMON}`
          + '**1人が話す 90〜130 語の短い talk** にする。'
          + '館内アナウンス・留守番電話・ラジオ広告・会議の冒頭・'
          + '工場見学の案内など、**話す場面がはっきりしたもの**にする。'
          + '書き言葉の記事にしない —— **声に出して読む文**である。' },
      { id: 'p5', label: 'Part 5 短文穴埋め問題', real: '30問',
        what: '1文の空所に入る語句を4つから選ぶ(文法・語彙)',
        sections: [{ exercise_type: 'fill_blank', count: 10 }],
        make: `TOEIC L&R Part 5(短文穴埋め問題)。${COMMON}`
          + 'prompt_en に**空所（　　　）を1つ含む1文**(15〜25語)、'
          + 'hint は空にする(本番に「与える語」は無い)、'
          + `answer に入る語句を入れる。${CHOICES}`
          + '狙いは**品詞の見分け・動詞の形・接続詞と前置詞の区別・'
          + '関係詞・語彙(コロケーション)**。この5つを均等に配る。'
          + '**ビジネスの文脈**にする(社内連絡・契約・出荷・採用など)。' },
      { id: 'p6', label: 'Part 6 長文穴埋め問題', real: '16問(1つの文書につき4問 × 4)',
        what: '文書の中の空所に入る語句・文を4つから選ぶ',
        sections: [{ exercise_type: 'fill_blank', count: 10 }],
        make: `TOEIC L&R Part 6(長文穴埋め問題)。${COMMON}`
          + '**Part 5 と決定的に違うのは、前後を読まないと決まらないこと。**'
          + 'prompt_en に、**空所（　　　）を1つ含む 3〜4 文のかたまり**を'
          + '入れる(メール・社内通知・お知らせの一部)。'
          + `${CHOICES}`
          + '狙いは**接続副詞(However / Therefore など)・時制・代名詞・'
          + '文の挿入**。とくに「1文まるごとを選ぶ問」を 10 問中 3 問入れる。'
          + '**1文だけ読めば答えが決まる問は作らない** —— それは Part 5 である。' },
      { id: 'p7', label: 'Part 7 読解問題', real: '54問(1つの文書 29問 / 複数の文書 25問)',
        what: 'メール・記事・告知などを読み、設問に答える',
        sections: [
          { exercise_type: 'article', count: 5 },
          { exercise_type: 'comprehension', count: 8 },
          { exercise_type: 'vocab_note', count: 6 },
        ],
        make: `TOEIC L&R Part 7(読解問題)。${COMMON}`
          + '**ビジネス文書**にする —— メール・社内通知・求人広告・'
          + '請求書つきの案内・記事のいずれか。'
          + '日付・金額・部署名・担当者名といった**具体**を必ず入れる'
          + '(本番の設問は、そこを訊く)。'
          + '設問には「NOT / EXCEPT で訊く問」「文の位置を訊く問」'
          + '「言い換えを訊く問(the word "X" is closest in meaning to)」を'
          + '必ず混ぜる。' },
    ],
  },

  /* ────────────────────────────────────────────────────────────
     英検(実用英語技能検定)

     **級ごとに1つの試験として並べる。** 級が変われば語彙も話題も
     まるで違うので、「英検」だけえらべても問題は作れない。

     2024年度の変更(3級以上):**ライティングが1題 → 2題**になった。
       ・1級 / 準1級 / 2級 … 要約問題が加わった
       ・準2級 / 3級       … Eメール問題が加わった
     あわせてリーディングの問数が減っている。
     **準2級プラスは 2025年度の新設級**である。
     ──────────────────────────────────────────────────────────── */
  ...[
    { id: 'eiken_1', label: '英検 1級', cefr: 'C1 相当', write: 'summary',
      outline: '筆記100分 + リスニング約35分 + 二次試験(面接)', real1: '' },
    { id: 'eiken_p1', label: '英検 準1級', cefr: 'B2 相当', write: 'summary',
      outline: '筆記90分 + リスニング約30分(29問)+ 二次試験(面接)', real1: '' },
    { id: 'eiken_2', label: '英検 2級', cefr: 'B1 相当', write: 'summary',
      outline: '筆記85分 + リスニング約25分(30問)+ 二次試験(面接)',
      real1: '17問', real2: '6問', real3: '8問' },
    { id: 'eiken_p2p', label: '英検 準2級プラス', cefr: 'A2〜B1 相当', write: 'email',
      outline: '2025年度に新設された級(準2級と2級のあいだ)', real1: '' },
    { id: 'eiken_p2', label: '英検 準2級', cefr: 'A2 相当', write: 'email',
      outline: '筆記75分 + リスニング約25分 + 二次試験(面接)', real1: '' },
    { id: 'eiken_3', label: '英検 3級', cefr: 'A1 相当', write: 'email',
      outline: '筆記65分 + リスニング約25分 + 二次試験(面接)', real1: '' },
  ].map((g) => ({
    id: g.id,
    label: g.label,
    full: `実用英語技能検定 ${g.label.replace('英検 ', '')}`,
    outline: `${g.outline}・${g.cefr}`,
    parts: [
      { id: 'r1', label: '大問1 短文の語句空所補充', real: g.real1 ?? '',
        what: '短い文や会話文の空所に入る語句を4つから選ぶ(単語・熟語・文法)',
        sections: [{ exercise_type: 'fill_blank', count: 10 }],
        make: `${g.label} 大問1(短文の語句空所補充)。${COMMON}`
          + `**${g.cefr}** の語彙と文法にそろえる。`
          + 'prompt_en に**空所（　　　）を1つ含む1〜2文**、hint は空にする、'
          + `answer に入る語句を入れる。${CHOICES}`
          + '**単語・熟語(句動詞)・文法を、10問におよそ 5:3:2 で配る**'
          + ' —— 本番はこの順に並ぶ。'
          + '会話形式(A: … B: …)の問も 2〜3 問混ぜる。' },
      { id: 'r2', label: '大問2 長文の語句空所補充', real: g.real2 ?? '',
        what: '説明文の空所に入る語句を4つから選ぶ。前後を読まないと決まらない',
        sections: [{ exercise_type: 'fill_blank', count: 10 }],
        make: `${g.label} 大問2(長文の語句空所補充)。${COMMON}`
          + `**${g.cefr}** にそろえる。`
          + 'prompt_en に、**空所（　　　）を1つ含む 3〜4 文のかたまり**を'
          + '入れる(説明文の一部)。'
          + `${CHOICES}`
          + '狙いは**つなぎ言葉(However / As a result / For example)と、'
          + '前の文を受ける言い換え**。'
          + '**1文だけで決まる問は作らない**(それは大問1である)。' },
      { id: 'r3', label: '大問3 長文の内容一致選択', real: g.real3 ?? '',
        what: 'Eメールや説明文を読み、内容に合うものを4つから選ぶ',
        sections: [
          { exercise_type: 'article', count: 5 },
          { exercise_type: 'comprehension', count: 8 },
          { exercise_type: 'vocab_note', count: 6 },
        ],
        make: `${g.label} 大問3(長文の内容一致選択)。${COMMON}`
          + `**${g.cefr}** の語彙で書く。`
          + '**英検の長文らしい話題**にする —— 環境・科学・歴史・'
          + '社会のしくみ・ある人物の取り組みなど。'
          + '各段落に**1つずつ設問の種**を置く(本番は段落の順に問われる)。'
          + '設問は、本文の語をそのまま使わず**言い換えて**訊く。' },
      { id: 'w1', label: g.write === 'summary' ? '英作文 要約' : '英作文 Eメール',
        real: '1題(2024年度から加わった)',
        what: g.write === 'summary'
          ? '英文を読み、決められた語数で要約する'
          : '外国人の友達からのEメールに返信する',
        sections: g.write === 'summary'
          ? [
            { exercise_type: 'article', count: 4 },
            { exercise_type: 'discussion', count: 5 },
          ]
          : [{ exercise_type: 'discussion', count: 5 }],
        make: g.write === 'summary'
          ? `${g.label} 英作文(要約)。${COMMON}`
            + `**${g.cefr}** で書く。`
            + '本文は**意見が分かれる話題**にし、賛成・反対の両方を出す'
            + '(要約するときに「何を落とすか」の判断が要るようにする)。'
            + '設問(question)は「この英文を◯語程度で要約しなさい」の形にし、'
            + 'note に**要約に必ず入れるべき点を3つ**、日本語で書く'
            + '(ゲストが自分で見比べられるようにする)。'
          : `${g.label} 英作文(Eメール)。${COMMON}`
            + `**${g.cefr}** で書く。`
            + 'question に、外国人の友達から届いた**5〜6文のEメール**を'
            + '英語でそのまま入れる。**下線部の話題について質問が2つ**'
            + '含まれるようにする(本番はそこに答える)。'
            + 'note に**返信に必ず入れる点**を日本語で書く。' },
      { id: 'w2', label: '英作文 意見論述', real: '1題',
        what: '与えられた話題について、自分の意見とその理由を書く',
        sections: [{ exercise_type: 'discussion', count: 5 }],
        make: `${g.label} 英作文(意見論述)。${COMMON}`
          + `**${g.cefr}** の受験者が書ける話題にする。`
          + 'question に **TOPIC を英語1文**で入れ、'
          /* **かっこを省かない。** `+` は `? :` より先に効くので、
             括らずに書くと**手前の文がまるごと条件式に飲まれ、
             いつも同じ枝が返る**(書いたその日に踏んだ・第5.309節)。
             `npm run test:exam` が、全 PART の `make` の長さを数えて見張る */
          + (g.write === 'summary'
            ? 'note に**書くときの型**(主張 → 理由2つ → まとめ)と、'
              + '使える観点を3つ、日本語で書く。'
            : 'POINTS(使ってよい観点)を2つ英語で添える。'
              + 'note に**書くときの型**(主張 → 理由2つ → まとめ)を日本語で書く。') },
      { id: 'l1', label: 'リスニング', real: g.id === 'eiken_p1' ? '29問' : '',
        what: '会話や説明文を聞き、内容に合うものを選ぶ',
        sections: [{ exercise_type: 'listening', count: 10 }],
        make: `${g.label} リスニング。${COMMON}`
          + `**${g.cefr}** にそろえる。`
          + 'audio_text に**読み上げる英文**(会話なら A: / B: を付けて 4〜6 往復、'
          + '説明文なら 60〜90 語)、question に英語の設問、answer に解答を入れる。'
          + '**会話と説明文を半分ずつ**にする。'
          + '設問は、英文を聞かないと答えられないものにする。' },
      { id: 's1', label: '二次試験(面接)', real: '',
        what: 'パッセージの音読 → 内容についての質問 → 自分の意見',
        sections: [
          { exercise_type: 'article', count: 3 },
          { exercise_type: 'comprehension', count: 3 },
          { exercise_type: 'discussion', count: 4 },
        ],
        make: `${g.label} 二次試験(面接)。${COMMON}`
          + `**${g.cefr}** にそろえる。`
          + '本文は**声に出して読む 50〜70 語のパッセージ**にする'
          + '(1文が長すぎないこと。音読するためである)。'
          + '内容の理解は**パッセージを見ながら答える問**にする。'
          + 'ディスカッションは**パッセージから離れた、社会についての質問**に'
          + 'する —— 本番の No.3 / No.4 はそうなっている。' },
    ],
  })),

  /* ────────────────────────────────────────────────────────────
     VERSANT(Versant English Test)
     63問・15〜20分。**機械が採点する**ので、正解が1つに決まる問が多い
     ──────────────────────────────────────────────────────────── */
  {
    id: 'versant',
    label: 'VERSANT',
    full: 'Versant English Test(スピーキング・リスニング)',
    outline: '63問・15〜20分。Part A〜F の6つ。CEFR A2〜C1 を見分ける',
    parts: [
      { id: 'a', label: 'Part A 音読(Reading)', real: '8問',
        what: '画面に出た英文を、指示された番号のものだけ読み上げる',
        sections: [{ exercise_type: 'read_aloud', count: 12 }],
        make: `Versant Part A(音読)。${COMMON}`
          + 'prompt_en に**1文だけ**(8〜14語)、prompt_ja にその訳を入れる。'
          + '**文どうしをつなげない** —— 1問1文で、話はつながらなくてよい。'
          + '構文も語彙もやさしくする(本番は「すらすら読めるか」を見ている)。'
          + '**読みまちがえやすい音**を必ず入れる —— '
          + '子音が3つ続くところ(strengths)・th と s・l と r・'
          + '語尾の -ed と -s・数字と固有名詞。' },
      { id: 'b', label: 'Part B 復唱(Repeats)', real: '16問',
        what: '聞こえた英文を、そのまま繰り返す。だんだん長くなる',
        sections: [{ exercise_type: 'read_aloud', count: 16 }],
        make: `Versant Part B(復唱)。${COMMON}`
          + 'prompt_en に**1文だけ**、prompt_ja にその訳を入れる。'
          + '**だんだん長くする** —— 1問目は 5 語ほど、最後は 18 語ほどにし、'
          + '**順に増やす**(ここが Part A といちばん違う)。'
          + '長い文は、**関係詞・分詞・接続詞で1回だけ**伸ばす。'
          + 'ばらばらの語を並べただけの文にしない —— 意味が取れれば覚えられる。' },
      { id: 'c', label: 'Part C 短文質問への応答(Short Answer Questions)', real: '24問',
        what: '短い質問を聞き、1語か短い句で答える',
        sections: [{ exercise_type: 'listening', count: 12 }],
        make: `Versant Part C(短文質問への応答)。${COMMON}`
          + 'audio_text に**質問1文**(8〜15語)、question には'
          + '「Answer in one word or a short phrase.」と入れ、'
          + 'answer には**1語か短い句**を入れる。'
          + '**知識ではなく、聞き取りと常識で答えられる問**にする'
          + '(例: How many days are there in a week?)。'
          + '専門知識・固有名詞・計算の要る問は作らない。'
          + 'note に**聞き取りの山になる語**を日本語で書く。' },
      { id: 'd', label: 'Part D 文の構築(Sentence Builds)', real: '10問',
        what: 'ばらばらの3つのかたまりを、意味の通る1文に並べ替えて言う',
        sections: [{ exercise_type: 'translate_ja_en', count: 10 }],
        make: `Versant Part D(文の構築)。${COMMON}`
          + '**prompt_ja に、並べ替える3つのかたまりを日本語で書かずに、'
          + '英語のかたまりをそのまま並べて入れる。** 形は必ずこうする ——'
          + '「次の3つのかたまりを並べ替えて1文にする: (1) … / (2) … / (3) …」。'
          + '**わざと順番を入れ替えて**出すこと(正しい順で並べない)。'
          + 'answer に**正しく並べた1文**を入れる。'
          + 'answer_alt には、**別の並べ方でも通る場合だけ**その文を入れる'
          + '(無ければ空)。'
          + '1文は 8〜14 語。**並べ方が1つに決まる文**にする。' },
      { id: 'e', label: 'Part E ストーリーリテリング(Story Retelling)', real: '3問',
        what: '短い話を聞き、自分の言葉で言い直す',
        sections: [
          { exercise_type: 'article', count: 3 },
          { exercise_type: 'discussion', count: 3 },
        ],
        make: `Versant Part E(ストーリーリテリング)。${COMMON}`
          + '本文は**30〜40 語の短い話**にする(1段落 = 1つの話)。'
          + '**誰が・どこで・何をして・どうなったか**がはっきりする話にする'
          + '(本番は、その4つを言い直せるかを見ている)。'
          + '意見や説明ではなく、**出来事**にする。'
          + 'ディスカッションの question は'
          + '「Retell this story in your own words.」の形にし、'
          + 'note に**言い直すときに落としてはいけない点**を日本語で3つ書く。' },
      { id: 'f', label: 'Part F 自由回答(Open Questions)', real: '2問',
        what: '身近な話題について、自分の考えを話す',
        sections: [{ exercise_type: 'discussion', count: 6 }],
        make: `Versant Part F(自由回答)。${COMMON}`
          + 'question に**英語の質問1文**を入れる。'
          + '**身近で、誰でも答えられる話題**にする'
          + '(家族・仕事・住んでいる街・休みの日・好きな食べ物など)。'
          + '専門知識の要る話題にしない。'
          + 'note に**答えの組み立て方**(結論 → 理由 → 具体例)と、'
          + '使える表現を2つ、日本語で書く。' },
    ],
  },

  /* ────────────────────────────────────────────────────────────
     TOEIC Speaking
     11問・約20分・200点満点。5つの型に分かれる
     ──────────────────────────────────────────────────────────── */
  {
    id: 'toeic_s',
    label: 'TOEIC Speaking',
    full: 'TOEIC Speaking Test',
    outline: '11問・約20分・200点満点',
    parts: [
      { id: 'q12', label: 'Q1-2 音読問題', real: '2問',
        what: '画面の英文を、45秒の準備のあと読み上げる',
        sections: [{ exercise_type: 'read_aloud', count: 8 }],
        make: `TOEIC Speaking Q1-2(音読問題)。${COMMON}`
          + 'prompt_en に**40〜60 語のまとまった読み上げ原稿**を1問分、'
          + 'prompt_ja にその訳を入れる。'
          + '**声に出して読むもの**にする —— 館内アナウンス・ラジオ広告・'
          + '電話の自動応答・イベントの案内。'
          + '**3つ以上の項目を並べる文**(A, B, and C)を必ず1回入れる'
          + ' —— 本番はそこの抑揚を見ている。'
          /* **`read_aloud` に `note` の欄は無い**(第5.309節)。
             書かせようとしても、道具の形に無いので**必ず消える** ——
             `npm run test:exam` が、欄の有る無しを突き合わせて見張る */
          + '数字・固有名詞・カンマで区切る列挙を必ず入れ、'
          + '**息の切れ目がはっきりする文**にする。' },
      { id: 'q3', label: 'Q3 写真描写問題', real: '1問',
        what: '1枚の写真を30秒で説明する',
        cannot: '写真が要るため' },
      { id: 'q46', label: 'Q4-6 応答問題', real: '3問',
        what: '身近な話題について、電話インタビューに答える(15秒/15秒/30秒)',
        sections: [{ exercise_type: 'discussion', count: 6 }],
        make: `TOEIC Speaking Q4-6(応答問題)。${COMMON}`
          + '**1つの話題について3問ひと組**で作る(6問なら2組)。'
          + 'question に英語の質問を入れる。'
          + '**同じ話題で、だんだん深くする** —— '
          + '1問目は事実(いつ・どこで)、2問目も短く答えられる事実、'
          + '3問目は**理由や意見を30秒話す問**にする。'
          + '話題は身近なもの(買い物・通勤・食事・休日・スマートフォン)。'
          + 'note に**答えの組み立て方**と、使える表現を日本語で書く。' },
      { id: 'q79', label: 'Q7-9 提示された情報に基づく応答問題', real: '3問',
        what: '予定表や日程表を読み、それを見ながら電話の質問に答える',
        sections: [
          { exercise_type: 'article', count: 3 },
          { exercise_type: 'comprehension', count: 6 },
        ],
        make: `TOEIC Speaking Q7-9(提示された情報に基づく応答)。${COMMON}`
          + '本文は**予定表そのもの**にする —— 会議の議事日程・研修の時間割・'
          + '出張の行程表・面接の予定のいずれか。'
          + '**時刻・場所・担当者・所要時間**を必ず入れる(本番はそこを訊く)。'
          + '文章で書かず、「9:00–9:30 Opening remarks (Ms. Tanaka, Hall A)」の'
          + 'ように**行で並べる。**'
          + '設問は電話の質問の形にし、'
          + '3問目は**2つ以上の情報をまとめて答える問**にする。' },
      { id: 'q10', label: 'Q10 解決策を提案する問題', real: '1問',
        what: '留守番電話の相談を聞き、60秒で解決策を提案する',
        sections: [
          { exercise_type: 'article', count: 2 },
          { exercise_type: 'discussion', count: 3 },
        ],
        make: `TOEIC Speaking Q10(解決策を提案する問題)。${COMMON}`
          + '本文は**留守番電話のメッセージ**にする(60〜90 語)。'
          + '**困っていることが1つ、はっきり**していること'
          + '(届かない・間違いが届いた・予約が取れない・機器が動かない)。'
          + '名乗り・用件・折り返しのお願い、の順に話す。'
          + 'ディスカッションの question は'
          + '「Respond as if you work for the company. Restate the problem, '
          + 'then propose a solution.」の形にし、'
          + 'note に**必ず言うこと**(相手の名前・困りごとの言い直し・'
          + '提案・次にすること)を日本語で書く。' },
      { id: 'q11', label: 'Q11 意見を述べる問題', real: '1問',
        what: '示された意見に賛成か反対かを、60秒で理由とともに話す',
        sections: [{ exercise_type: 'discussion', count: 6 }],
        make: `TOEIC Speaking Q11(意見を述べる問題)。${COMMON}`
          + 'question に**賛否が分かれる意見を英語1文**で入れ、'
          + '「Do you agree or disagree? Give reasons.」を添える。'
          + '**仕事や暮らしに関わる話題**にする(在宅勤務・社内研修・'
          + '転職・会議の長さ・制服・出張)。'
          + 'note に**60秒の組み立て**(立場 → 理由1 → 具体例 → 理由2 → まとめ)と、'
          + '使える表現を日本語で書く。' },
    ],
  },

  /* ────────────────────────────────────────────────────────────
     TOEFL iBT

     **2026年1月21日から形が変わっている。** 全体で約90分。
     Reading と Listening は**2つのモジュールに分かれ、
     1つ目の出来で2つ目の難しさが変わる**(アダプティブ)。
     古い形(Reading 2パッセージ / Speaking Task 1-4)は、もう無い。
     ──────────────────────────────────────────────────────────── */
  {
    id: 'toefl',
    label: 'TOEFL iBT',
    full: 'TOEFL iBT(2026年1月21日からの形)',
    outline: '約90分。Reading 最大30分 / Listening 29分 / Speaking 約8分 / Writing 最大23分',
    parts: [
      { id: 'r_daily', label: 'Reading: Read in Daily Life', real: '',
        what: '暮らしの中の短い文章(掲示・案内・やりとり)を読んで答える',
        sections: [
          { exercise_type: 'article', count: 3 },
          { exercise_type: 'comprehension', count: 6 },
        ],
        make: `TOEFL iBT Reading「Read in Daily Life」。${COMMON}`
          + '**大学の暮らしの中の短い文章**にする —— 寮の掲示・'
          + '学生向けメール・イベントの案内・図書館の利用案内。'
          + '学術論文の文体にしない。'
          + '日付・場所・条件・締切といった**具体**を必ず入れる。' },
      { id: 'r_acad', label: 'Reading: Read an Academic Passage', real: '',
        what: '学術的な文章を読んで答える',
        sections: [
          { exercise_type: 'article', count: 6 },
          { exercise_type: 'comprehension', count: 8 },
          { exercise_type: 'vocab_note', count: 8 },
        ],
        make: `TOEFL iBT Reading「Read an Academic Passage」。${COMMON}`
          + '**大学1年生の教科書の1節**のように書く —— '
          + '生物学・地質学・天文学・考古学・心理学・美術史のいずれか。'
          + '**専門用語は出したらその場で言い換えて説明する**(本番もそうする)。'
          + '設問には「言い換えを訊く問」「筆者の意図を訊く問」'
          + '「NOT / EXCEPT で訊く問」を必ず混ぜる。' },
      { id: 'r_words', label: 'Reading: Complete the Words', real: '',
        what: '文章の中の、文字が欠けた語を完成させる',
        sections: [{ exercise_type: 'fill_blank', count: 10 }],
        make: `TOEFL iBT Reading「Complete the Words」。${COMMON}`
          + '**選択肢を出さない問である。**'
          + 'prompt_en に **2〜3 文のかたまり**を入れ、その中の1語を'
          + '「gr____」のように**先頭の2〜3文字だけ残して**欠けさせる。'
          + 'hint は空にする。answer に**その語のつづり全体**を入れる。'
          + '**前後を読めば1語に決まる**ようにする(何語も当てはまる欄にしない)。'
          + 'note に**なぜその語に決まるのか**を日本語で書く。'
          + '欠けさせるのは、**その文章の話題を支える中身のある語**にする'
          + '(the / of のような機能語を欠けさせない)。' },
      { id: 'l1', label: 'Listening', real: '',
        what: '講義や会話を聞いて答える',
        sections: [{ exercise_type: 'listening', count: 10 }],
        make: `TOEFL iBT Listening。${COMMON}`
          + 'audio_text に**読み上げる英文**を入れる —— '
          + '半分は**大学の講義の一部**(80〜120 語・1人が話す)、'
          + '半分は**学生と職員(または教授)のやりとり**'
          + '(A: / B: を付けて 4〜6 往復)にする。'
          + 'question に英語の設問、answer に解答を入れる。'
          + '**話し手の態度や言いよどみを訊く問**を必ず2問入れる'
          + '(本番はそこを見ている)。' },
      { id: 's_repeat', label: 'Speaking: Listen and Repeat', real: '7問',
        what: '聞こえた短い文を、そのまま繰り返す(準備時間なし)',
        sections: [{ exercise_type: 'read_aloud', count: 14 }],
        make: `TOEFL iBT Speaking「Listen and Repeat」。${COMMON}`
          + 'prompt_en に**1文だけ**、prompt_ja にその訳を入れる。'
          + '**だんだん長くする**(はじめは 6 語ほど、終わりは 18 語ほど)。'
          + '話題は**大学の暮らしか、日常**にする。'
          + '**口に出して自然な文**にする —— 書き言葉の1文にしない。' },
      { id: 's_interview', label: 'Speaking: Take an Interview', real: '4問',
        what: '1つの話題について4つの質問に、それぞれ45秒で答える',
        sections: [{ exercise_type: 'discussion', count: 8 }],
        make: `TOEFL iBT Speaking「Take an Interview」。${COMMON}`
          + '**1つの話題について4問ひと組**で作る(8問なら2組)。'
          + 'question に英語の質問を入れる。'
          + '**同じ話題を4問で掘り下げる** —— '
          + '経験 → その理由 → 別の見方 → 自分の考え、の順にする。'
          + '話題は**大学生活か、若い社会人の暮らし**にする。'
          + 'note に**45秒の組み立て**を日本語で書く。' },
      { id: 'w_sentence', label: 'Writing: Build a Sentence', real: '10問',
        what: 'ばらばらの語句を並べ替えて、やりとりに合う1文を作る',
        sections: [{ exercise_type: 'translate_ja_en', count: 10 }],
        make: `TOEFL iBT Writing「Build a Sentence」。${COMMON}`
          + 'prompt_ja に、**やりとりの流れと、並べ替える語句**を'
          + '次の形で入れる ——「A: …(英語) / B: …(英語) の流れに合うように、'
          + '次の語句を並べ替えて1文にする: (1) … / (2) … / (3) … / (4) …」。'
          + '**わざと順番を入れ替えて**出すこと。'
          + 'answer に**正しく並べた1文**を入れる。'
          + '**並べ方が1つに決まる文**にする。'
          + '狙いは**語順・時制の一致・関係詞・従属節の位置**。' },
      { id: 'w_email', label: 'Writing: Write an Email', real: '1問',
        what: '場面に合わせて、必要なことを伝えるメールを7分で書く',
        sections: [{ exercise_type: 'discussion', count: 5 }],
        make: `TOEFL iBT Writing「Write an Email」。${COMMON}`
          + 'question に、**メールを書く場面を英語で**入れる'
          + '(誰に・なぜ・何を伝えるのか)。'
          + '**大学での場面**にする —— 教授に締切の延長を頼む・'
          + '寮の部屋の不具合を知らせる・履修の相談をする・'
          + 'イベントの手伝いを申し出る。'
          + '**伝えるべきことを2つ**、場面の中にはっきり置く。'
          + 'note に**メールの型**(件名 → 名乗り → 用件 → 依頼 → 結び)と、'
          + '使える表現を日本語で書く。' },
      { id: 'w_discussion', label: 'Writing: Write for an Academic Discussion', real: '1問',
        what: '授業の掲示板で、教授の問いと学生の書き込みに応えて書く',
        sections: [{ exercise_type: 'discussion', count: 5 }],
        make: `TOEFL iBT Writing「Write for an Academic Discussion」。${COMMON}`
          + 'question に、**掲示板のやりとりをそのまま英語で**入れる ——'
          + '①教授の問い(2〜3文)②学生Aの書き込み(2〜3文)'
          + '③学生Bの書き込み(2〜3文)。'
          + '**学生2人の意見は食い違わせる**(どちらに寄るかを選べるようにする)。'
          + '話題は**授業で議論になるもの**(都市計画・教育・技術と仕事・'
          + '環境政策)にする。'
          + 'note に**書き方**(どちらかの意見に触れてから自分の立場を出す)を'
          + '日本語で書く。' },
    ],
  },

  /* ────────────────────────────────────────────────────────────
     IELTS
     2時間45分。Listening 30分(40問)/ Reading 60分(40問)/
     Writing 60分(2題)/ Speaking 11〜14分(3パート)
     ──────────────────────────────────────────────────────────── */
  {
    id: 'ielts',
    label: 'IELTS',
    full: 'IELTS(Academic)',
    outline: '2時間45分。Listening 30分40問 / Reading 60分40問 / Writing 60分 / Speaking 11〜14分',
    parts: [
      { id: 'l1', label: 'Listening Part 1・2(日常の場面)', real: '各10問',
        what: 'Part 1 は2人の会話、Part 2 は1人の説明。どちらも日常の場面',
        sections: [{ exercise_type: 'listening', count: 10 }],
        make: `IELTS Listening Part 1・2(日常の場面)。${COMMON}`
          + 'audio_text に**読み上げる英文**を入れる —— '
          + '半分は**申し込みや問い合わせの電話**(A: / B: を付けて 5〜7 往復)、'
          + '半分は**施設やイベントの案内**(1人が話す・80〜120 語)。'
          + '**イギリス英語**の言い回しにする。'
          + '**数字・つづり・固有名詞**(電話番号・郵便番号・人名のつづり・'
          + '金額・日付)を必ず入れる —— 本番はそこを書き取らせる。'
          + '設問は**語数制限つきの記入式**にし、'
          + 'question の末尾に「(NO MORE THAN TWO WORDS)」を付ける。' },
      { id: 'l2', label: 'Listening Part 3・4(学びの場面)', real: '各10問',
        what: 'Part 3 は学生どうしの話し合い、Part 4 は講義',
        sections: [{ exercise_type: 'listening', count: 10 }],
        make: `IELTS Listening Part 3・4(学びの場面)。${COMMON}`
          + 'audio_text に**読み上げる英文**を入れる —— '
          + '半分は**学生2〜3人の話し合い**(課題の進め方・調査の分担)、'
          + '半分は**講義**(1人が話す・100〜140 語)。'
          + '**イギリス英語**にする。'
          + '**意見が変わるところ・言い直すところ**を必ず入れる'
          + '(本番の Part 3 はそこを訊く)。' },
      { id: 'r1', label: 'Reading Passage', real: '3パッセージ・40問',
        what: '学術的な長文を読み、さまざまな形式の設問に答える',
        sections: [
          { exercise_type: 'article', count: 6 },
          { exercise_type: 'comprehension', count: 8 },
          { exercise_type: 'vocab_note', count: 8 },
        ],
        make: `IELTS Academic Reading。${COMMON}`
          + '**一般向けの科学・歴史・社会の読み物**にする'
          + '(新聞の日曜版や雑誌の特集のような文体)。'
          + '**段落ごとに主題をはっきり**させる —— '
          + '本番は「見出しと段落を結ぶ問」があるためである。'
          + '設問には必ず'
          + '**True / False / Not Given の問を3問**入れる'
          + '(question を「True, False or Not Given:」で始め、'
          + '**Not Given になる問を1問は必ず入れる**)。'
          + '残りは見出し合わせ・語数制限つきの記入式にする。' },
      { id: 'w1', label: 'Writing Task 1(図表の説明)', real: '150語以上・20分',
        what: 'グラフや図の特徴を選んで、比べながら説明する',
        sections: [{ exercise_type: 'discussion', count: 5 }],
        make: `IELTS Academic Writing Task 1(図表の説明)。${COMMON}`
          + 'question に、**図表そのものを文字で**書く ——'
          + '「The table below shows …」に続けて、'
          + '**行と列のある表を英語で並べる**(画像は使えないので、'
          + '数字が読み取れる形にする)。'
          + '年・国・項目・単位を必ず入れ、**上がり下がりや山**が'
          + 'はっきり読み取れる数字にする。'
          + 'note に**書き方**(全体の傾向を1文 → 目立つ2点 → 比較)と、'
          + '使える表現(increase / peak / remain steady など)を日本語で書く。'
          + '**自分の意見は書かせない**(Task 1 では減点される)。' },
      { id: 'w2', label: 'Writing Task 2(小論文)', real: '250語以上・40分',
        what: '与えられた主張について、自分の考えを論じる',
        sections: [{ exercise_type: 'discussion', count: 5 }],
        make: `IELTS Writing Task 2(小論文)。${COMMON}`
          + 'question に **IELTS の設問そのままの形**で入れる ——'
          + '背景1文 + 問い1文 + 「Give reasons for your answer and include '
          + 'any relevant examples from your own knowledge or experience.」。'
          + '**問いの型を混ぜる** —— 賛否を問うもの、両方の見方を求めるもの、'
          + '利点と欠点を問うもの、原因と対策を問うもの。'
          + '話題は**社会について**(教育・環境・都市・技術・働き方)。'
          + 'note に**段落の組み立て**と、'
          + '**問いの型ごとに答え方が違うこと**を日本語で書く。' },
      { id: 's1', label: 'Speaking Part 1(身近な質問)', real: '4〜5分',
        what: '自分のことや身の回りのことについて、短く答える',
        sections: [{ exercise_type: 'discussion', count: 8 }],
        make: `IELTS Speaking Part 1(身近な質問)。${COMMON}`
          + 'question に**英語の質問1文**を入れる。'
          + '**話題ごとに3〜4問ひと組**にする'
          + '(住んでいるところ・仕事や勉強・趣味・天気・食べ物)。'
          + '**短く答える問**にする(20〜30秒)。'
          + 'note に**ひとことで終わらせない足し方**'
          + '(答え → 理由か具体例を1つ)を日本語で書く。' },
      { id: 's2', label: 'Speaking Part 2(スピーチ)', real: '1〜2分・準備1分',
        what: 'カードの題について、1分準備して1〜2分話す',
        sections: [{ exercise_type: 'discussion', count: 5 }],
        make: `IELTS Speaking Part 2(スピーチ)。${COMMON}`
          + 'question に **Cue Card をそのままの形**で入れる ——'
          + '「Describe …」に続けて、'
          + '「You should say:」と**4つの観点を箇条書き**'
          + '(最後は必ず「and explain why …」にする)。'
          + '題は**思い出せるもの**にする(会った人・行った場所・'
          + '買ったもの・覚えている日・学んだこと)。'
          + 'note に**1〜2分の配り方**(観点1つにつき2〜3文)を日本語で書く。' },
      { id: 's3', label: 'Speaking Part 3(掘り下げ)', real: '4〜5分',
        what: 'Part 2 の話題を広げ、社会についての考えを問われる',
        sections: [{ exercise_type: 'discussion', count: 8 }],
        make: `IELTS Speaking Part 3(掘り下げ)。${COMMON}`
          + 'question に**英語の質問1文**を入れる。'
          + '**個人の話ではなく、社会全体についての問い**にする'
          + '(「〜は昔と比べてどう変わったか」「〜すべきなのは誰か」'
          + '「将来〜はどうなるか」)。'
          + '**4問ひと組**で、だんだん抽象的にする。'
          + 'note に**答え方**(一般論 → 理由 → 例外にも触れる)を日本語で書く。' },
    ],
  },
]

/* ══════════════════════════════════════════════════════════════════
   引き方。**画面も窓口も、ここから引く**(判断は1か所)
   ══════════════════════════════════════════════════════════════════ */

/** 既定の試験・PART。**画面で書き写さない** */
export const DEFAULT_EXAM = EXAMS[0].id

/** その id の試験。無ければ null(**勝手に既定へ落とさない**) */
export const examOf = (examId) => EXAMS.find((e) => e.id === examId) ?? null

/** 画面に出す試験の名前。知らない id はそのまま返す(行き止まりを作らない) */
export const examLabel = (examId) => examOf(examId)?.label ?? String(examId ?? '')

/**
 * **えらべる PART だけ**を返す。写真が要るものは入らない。
 *
 * **`cannot` を持つ行は、消さずに残してある** ——
 * 「本番にはあるが、ここでは作れない」を言えるようにするためである
 * (`examSkipLine`)。
 */
export const examPartsOf = (examId) =>
  (examOf(examId)?.parts ?? []).filter((p) => !p.cannot)

/** **作れない PART**。`examSkipLine` と検証が使う */
export const examSkipsOf = (examId) =>
  (examOf(examId)?.parts ?? []).filter((p) => p.cannot)

/** その PART。無ければ null */
export const examPartOf = (examId, partId) =>
  (examOf(examId)?.parts ?? []).find((p) => p.id === partId) ?? null

/** その試験の、最初にえらばれる PART */
export const firstPartOf = (examId) => examPartsOf(examId)[0]?.id ?? ''

/**
 * **その PART を、どの演習の組み合わせで作るか。**
 *
 * **`count` ごと返す。** 画面が数を書き写すと、ここを直した日に食い違う。
 */
export const examSectionsOf = (examId, partId) =>
  examPartOf(examId, partId)?.sections ?? []

/**
 * **試験と PART を、1つの文字列にする**(`"toeic_lr:p5"`)。
 *
 * `defaultSectionsFor(kind, …)` に渡すためのものである。
 * **引数を2つ増やさない** —— `sectionsFor` / `voicePlan` まで
 * 順に増えていくので、**持ち回るのは1つだけ**にする。
 * **組み立てと読み解きを、必ずこの2つ1組で持つ**(数え方を2通り持たない)。
 */
export const examKeyOf = (examId, partId) => `${examId ?? ''}:${partId ?? ''}`

/** `"toeic_lr:p5"` → その PART の演習の組み合わせ。知らない鍵は空 */
export const examSectionsByKey = (key) => {
  const [examId, partId] = String(key ?? '').split(':')
  return examSectionsOf(examId, partId)
}

/** `"toeic_lr:p5"` → 窓口へ送る作り方。知らない鍵は空 */
export const examBriefByKey = (key) => {
  const [examId, partId] = String(key ?? '').split(':')
  return examBrief(examId, partId)
}

/**
 * **窓口へ送る、その PART の作り方。**
 *
 * 試験の名前と PART の名前を頭に付ける —— AI に
 * 「何の試験の、どの PART か」が分かるようにするためである。
 */
export const examBrief = (examId, partId) => {
  const exam = examOf(examId)
  const part = examPartOf(examId, partId)
  if (!exam || !part || !part.make) return ''
  return [
    `# 試験対策(${exam.full})`,
    `## ${part.label}`,
    `本番では ${part.real || '(問数は級・回によって違う)'} ——「${part.what}」。`,
    part.make,
    '**この PART の形に、必ずそろえること。**',
  ].join('\n')
}

/**
 * **教材の名前の既定**(「TOEIC L&R Part 5 短文穴埋め問題」)。
 *
 * **試験と PART は、どこにも保存していない。** 列を増やすと
 * 利用者に貼ってもらう SQL が増えるためで、そのかわり
 * **名前に入れて残す**(さがす画面の言葉でそのまま見つかる)。
 */
export const examTitle = (examId, partId) => {
  const exam = examOf(examId)
  const part = examPartOf(examId, partId)
  if (!exam || !part) return ''
  return `${exam.label} ${part.label}`
}

/**
 * **本番では、いくつ・何分か**(欄の下に出す1行)。
 * **説明ではなく「いまの状態」**である(CLAUDE.md)。
 */
export const examOutline = (examId) => examOf(examId)?.outline ?? ''

/**
 * **作れない PART を、黙って消さない**(CLAUDE.md)。
 *
 * 1行だけ出す。無ければ空を返すので、**空のときは行ごと出さない。**
 */
export const examSkipLine = (examId) => {
  const skip = examSkipsOf(examId)
  if (!skip.length) return ''
  /* **理由もいっしょに言う。** 「作れません」だけだと、
     こちらの作りかけなのか、そもそも無理なのかが分からない */
  const 訳 = [...new Set(skip.map((p) => p.cannot))].join(' / ')
  return `${skip.map((p) => p.label).join(' / ')}は${訳}作れません`
}

/**
 * **その PART の、1行の説明**(PART をえらんだ下に出す)。
 * 本番の問数と、何をする問題かを**そのまま**出す。
 */
export const examPartLine = (examId, partId) => {
  const part = examPartOf(examId, partId)
  if (!part) return ''
  return [part.real, part.what].filter(Boolean).join(' … ')
}
