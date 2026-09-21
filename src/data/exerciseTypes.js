/**
 * 演習の種類。
 *
 * 実際のドリルは「教材=1つの文法ポイント」の中に、
 * 和訳・誤り訂正・英訳・リスニングといった演習が並ぶ形をしている
 * (穴埋めは 2026-09 に誤り訂正へ差し替えた)。
 * 種類ごとに、使う欄とゲストへの見せ方が違う。
 *
 * fields … その演習で使う欄。作成画面はこれを見て入力欄を出し分ける。
 * audioFrom … お手本音声を作る元にする欄。null なら音声を作らない。
 * answerLang … **`answer` に入るのが英語か日本語か。**
 *   `answer` を持つ演習は、必ずどちらかを書く(`answerHasAudio()` の項)。
 * grammarFrom … **文法解説(SVOC)を作る元にする欄。** null なら作らない。
 *   **どの演習にも必ず書く**(`grammarSource()` の項)。書き忘れると
 *   `npm run test:play` が赤くなる —— `answerLang` とまったく同じ形である。
 */
/* **本文の呼び名**(記事 / 会話 / 会議 / スピーチ)。
   `sectionLabel()` で使う。**種類の一覧は持たない**(あちらが1か所) */
import { bodyWord } from './materialKinds.js'
/* かたまりの分類(第5.230節)。**呼び名はあちら1か所** */
import { CHUNK_KINDS, isChunkText } from './chunkKinds.js'

export const EXERCISE_TYPES = [
  {
    id: 'translate_en_ja', label: '英文和訳',
    instruction: '次の英文を日本語に訳しなさい。',
    fields: ['prompt_en', 'answer'], audioFrom: 'prompt_en',
    /* 問題文が**完全な英文**である。骨組みを見せるのにいちばん向く */
    grammarFrom: 'prompt_en',
    /* **`answer` に入るのは和訳(日本語)である。**
       だから解答に読み上げを付けない(`answerHasAudio()`)。
       2026-09 利用者の指定 —— 実機の写真では、緑の解答の枠
       「→ 店長は新しいスタッフを幸せにします。」の下に Listen が出ていた */
    answerLang: 'ja',
    hideAnswerFromLearner: true,
  },
  /*
   * 誤り訂正(2026-09 利用者の指定)。**穴埋めの置き換えである。**
   *
   *   > そもそもこの穴埋めはいらないかもしれない。
   *   > なぜなら、穴埋めは複数の回答が考えられる場合があり、すっきりしない
   *
   * 穴埋めは、空欄に入りうる語が1つに決まらないことがある。
   * しかも「与える語」がそのまま答えになると、**問題文の中に答えが見える**
   * (2026-09 実機)。誤り訂正なら、**直すべき1か所と、直した形が
   * どちらも1つに決まる。** 弱点をそのまま誤りにできるので、
   * 「弱点 → 教材」の循環にもよく合う。
   *
   * **音声は付けない**(`audioFrom: null`)。読み上げる元になる英文が
   * 誤った文しかなく、**誤った文を手本として聞かせてはいけない。**
   * 直した文を読ませると、答えが耳から入ってしまう。
   * これは穴埋めのときと同じ扱いである。
   */
  {
    id: 'error_correction', label: '誤り訂正',
    instruction: '次の英文には誤りが1か所あります。見つけて直しなさい。',
    fields: ['prompt_en', 'answer', 'note'], audioFrom: null,
    /* **誤った文を解説しない。** `prompt_en` は誤りを含む文なので、
       そこに「これが S で、これが V で」と札を付けると、
       **間違った形を覚えさせる。** 解説するのは `answer`(直した英文)である。
       音声を `answer` にだけ付けてあるのと、まったく同じ理由である */
    grammarFrom: 'answer',
    /* `answer` は**直した英文まるごと**なので英語である。
       **問題文には音を付けないが、解答には付く** —— あちらは
       誤った文しかなく手本にできないのに対し、こちらは
       **解答を開いたあとにだけ出る**ので、答えが先に耳から入らない */
    answerLang: 'en',
    hideAnswerFromLearner: true,
  },
  /*
   * 穴埋め。**新規では使わない**(2026-09 に誤り訂正へ差し替えた)。
   * すでに作った教材を開くために残してある。旧「長文」と同じ扱い。
   */
  {
    id: 'fill_blank', label: '穴埋め',
    instruction: 'カッコ内の語を使って文を完成させなさい。',
    fields: ['prompt_en', 'hint', 'answer'], audioFrom: null,
    /* **解説できる英文が、どこにも無い。**
       `prompt_en` は（　　　）が開いたままで文になっておらず、
       `answer` は空欄に入る語1つである。**当てずっぽうで埋めない**
       (埋めた文を作ると、解説と画面の英文が食い違う) */
    grammarFrom: null,
    answerLang: 'en',
    hideAnswerFromLearner: true,
  },
  {
    id: 'translate_ja_en', label: '和文英訳',
    instruction: '次の日本語を英語にしなさい。',
    fields: ['prompt_ja', 'answer', 'answer_alt'], audioFrom: 'answer',
    /* 英語は解答例の側にしかない。**音声と同じ欄**である */
    grammarFrom: 'answer',
    answerLang: 'en',
    hideAnswerFromLearner: true,
  },
  {
    id: 'listening', label: 'リスニング + 理解',
    instruction: '英文は見ずに聞くこと。聞いたあとの質問に答えなさい。',
    fields: ['audio_text', 'question', 'answer'], audioFrom: 'audio_text',
    /* **聞く英文そのもの**を解説する。設問や解答より、こちらが本体である */
    grammarFrom: 'audio_text',
    answerLang: 'en',
    hideAnswerFromLearner: true, hidePromptFromLearner: true,
  },
  // ── 本文(まとまった1本)────────────────────────────────
  //
  // article と dialogue は「設問」ではなく「読み物」である。
  // 1つの演習の中に段落(または発言)が順に並び、それで1本になる。
  // ゲストはこの本文に対して、音読・オーバーラッピング・シャドーイング・
  // リピーティングを行う。**取り組み方は本文の中で切り替える。**
  // 以前は取り組み方ごとに演習を分けていたため、まとまった文章にならず、
  // 短い英文が並ぶだけになっていた(仕様書 第5.17節)。
  {
    id: 'article', label: '記事',
    instruction: '記事を読んでください。声に出す練習は、下のボタンで切り替えられます。',
    fields: ['prompt_en', 'prompt_ja'], audioFrom: 'prompt_en',
    grammarFrom: 'prompt_en',
    isPassage: true,
  },
  {
    id: 'dialogue', label: '会話',
    instruction: '会話を読んでください。役を決めて声に出すと効果が上がります。',
    fields: ['speaker', 'prompt_en', 'prompt_ja'], audioFrom: 'prompt_en',
    grammarFrom: 'prompt_en',
    isPassage: true,
  },
  {
    id: 'comprehension', label: '内容の理解',
    instruction: '本文の内容について、英語で答えなさい。',
    // 設問も英語なので、読み上げを付ける。「音声はどんな場面でも欲しい」
    // という要望による(2026-08)。聞き取れないと設問自体が壁になる。
    //
    // **設問も解答も訳を持つ**(0035・2026-09 利用者の指定)。
    //
    //   > 内容理解の設問と解答の訳を見れるようにしてください。音も聞けるように。
    //   > そして解答や設問も単語の意味を調べて単語帳に追加できるように
    //
    // 日本語が1つも無いため、設問の意味が取れないと**設問そのものが壁**になり、
    // 本文を理解できていたのかどうかが確かめられなかった。
    // **0035 を貼る前に作った教材には入っていない**(訳が出ないだけ)。
    fields: ['question', 'question_ja', 'answer', 'answer_ja'], audioFrom: 'question',
    /* **解答の側を解説する。** 設問は疑問文で語順が入れ替わっており、
       五文型の骨組みがいちばん見えにくい形である。
       解答は本文の内容をそのまま言い直した平叙文なので、
       「誰が どうする 何を」がそのまま出る */
    grammarFrom: 'answer',
    /* **解答は英語である**(訳は `answer_ja` に別に入っている)。
       だから読み上げが付く —— これは 0035 の利用者の指定そのもので、
       「音も聞けるように」と言われた場所である */
    answerLang: 'en',
    hideAnswerFromLearner: true,
  },
  /*
   * ディスカッション(2026-09 利用者の指定)。
   *
   *   > 内容理解５問に追加して、新しいページにディスカッションというものを
   *   > 追加してれ。これも基本は５問、設定により１０問にできるように
   *
   * **内容の理解とは別物である。** あちらは「本文に何が書いてあったか」を
   * 確かめるもので、答えは本文の中にある。こちらは**本文をきっかけに
   * 自分の考えを話す**もので、正解が無い。
   * だから `answer` を持たない。代わりに `note` に、話を広げる観点と
   * 使える表現を日本語で入れる(トレーナーがその場で使う手がかり)。
   * 設問は英語なので、内容の理解と同じく読み上げを付ける。
   */
  {
    id: 'discussion', label: 'ディスカッション',
    instruction: '本文をきっかけに、自分の考えを英語で話してみてください。正解はありません。',
    fields: ['question', 'note'], audioFrom: 'question',
    /* 英語は設問にしかない(`note` は日本語の手がかり) */
    grammarFrom: 'question',
  },
  /*
   * **想定される質問**(2026-09 利用者の指定)。
   *
   *   > 作成したスピーチに対して、聴衆から想定される質問を作る機能を
   *   > 実装して下さい。質問は、他の演習と同じように個数を5個、10個と
   *   > 選べるようにして下さい。
   *
   * **ディスカッションとは、向きが逆である。**
   *   ・ディスカッション … 本文をきっかけに**自分から**考えを話す
   *   ・想定される質問   … 話し終えたあと、**相手から**投げられる
   *
   * スピーチは、本番で怖いのは原稿そのものより**そのあとの質疑**である。
   * だから「答えを読む」のではなく「答えを用意しておく」ための演習にする。
   *
   * **`answer` を持たない**(ディスカッションと同じ理由)。
   * 答えるのは話し手自身であって、正解は1つに決まらない。
   * **欄を出せば AI は必ず何かを書く**ので、最初から作らない。
   * 代わりに `note` へ、どう答えるかの筋道を日本語で入れる。
   *
   * **設問の訳は出す**(`question_ja`)。0035 と同じ理由で、
   * 日本語が1つも無いと**質問そのものが壁**になり、
   * 答えられなかったのか聞き取れなかったのかが分からない。
   *
   * 音声は付ける(`audioFrom: 'question'`)。**質疑は聞き取りから始まる。**
   */
  {
    id: 'audience_qa', label: '想定される質問',
    instruction: 'スピーチのあと、聴衆から来そうな質問です。声に出して答えてみてください。',
    fields: ['question', 'question_ja', 'note'], audioFrom: 'question',
    /* ディスカッションと同じ。英語は設問にしかない */
    grammarFrom: 'question',
  },
  /**
   * **覚えておきたい表現**(第5.230節・2026-09 利用者の指定)。
   *
   *   > 「本文に出た語句」ですが、これを語句というよりも、コロケーション、
   *   > 句動詞、イディオム、決まり文句、つなぎ言葉、丁寧な言い回し、
   *   > 言い換え表現などに分類されるものをピックアップし、
   *   > それぞれに練習問題を追加してほしいです。
   *   > …単語単体はここには載せない。
   *   > あくまで２語以上のチャンクを練習する場とする
   *
   * 【名前】(2026-09 利用者の指定)
   *
   *   > 「内容理解」「ディスカッション」「リスニング」「本文に出た語句」の
   *   > チェックリストの「本文に出た語句」にアサインして、
   *   > ネーミングを変更してください
   *   >
   *   > 基本はそのレベルに応じた**覚えておきたいもの**が自動で選ばれて
   *
   *   **「語句」と書かない。** 中身は2語以上のかたまりで、
   *   単語1語は1つも入らない(`isWrongShape`)。
   *   利用者の言葉そのままで **「覚えておきたい表現」** にした。
   *
   *   **作る画面のチェックリストにも、この名前が出る** ——
   *   あちらは `exerciseLabel()` を呼ぶだけで、書き写していない。
   *
   * 【どの種類の教材にも入る】(同じ指定)
   *
   *   > このページは記事、ダイアローグ、モノローグ、会議、スピーチ
   *   > すべてで生成されるようにしてください。
   *   > ただし、チェックを外したり付けたりはできるようにしてください
   *
   *   **本文を持つ4種類すべて**(`reading` / `dialogue` / `meeting` /
   *   `speech`)の既定の構成に入っている。
   *   **外せるし、数も選べる**(`SCALABLE_SECTIONS`)——
   *   標準(6〜8)か、その倍。`npm run test:play` が両方を見張る。
   *
   * 【読むだけの場所を、言う場所にした】
   *   もとは「語句 / 意味 / 例文」を並べるだけだった。
   *   **読んで終わるページは、めくられるだけで終わる**
   *   (すぐ下の `culture_note` を廃止したのと同じ理由)。
   *   いまは**分類の札**が付き、**その場で日→英を5〜10問**言える。
   *
   * 【欄】
   *   ・`prompt_en`  … かたまりそのもの(**2語以上**・`isWrongShape`)
   *   ・`prompt_ja`  … 意味
   *   ・`note`       … なぜその形になるのか(イメージの由来・使いどころ)
   *   ・`chunk_kind` … 7分類のどれか(**呼び名は `chunkKinds.js` 1か所**)
   *   ・`source_en`  … **本文の中で、実際にそう使われていた1文**
   *   ・`practice`   … 日→英の練習(**欄ではなく配列**なので `fields` に
   *     入れない —— `phrases` / `chunks` / `grammar` と同じ扱い)
   *
   * 【読み上げは、かたまりに付ける】
   *   `audioFrom` は `prompt_en` のまま。**本文の1文(`source_en`)には
   *   付けない** —— 本文はすでに記事・会話の側で音になっており、
   *   ここで別に作ると**同じ英文にもう一度課金される**(CLAUDE.md)。
   */
  {
    id: 'vocab_note', label: '覚えておきたい表現',
    instruction: '本文に出てきた かたまり です。練習して、言えるようにしてください。',
    fields: ['prompt_en', 'prompt_ja', 'note', 'chunk_kind', 'source_en'],
    audioFrom: 'prompt_en',
    /* **かたまりであって、文ではない。** `come up with` に
       S も V も O も無い。意味は語を触れば出る(0円・控えから読む) */
    grammarFrom: null,
  },
  // ── 旧「長文」で使っていたもの ────────────────────────────
  // 新規では使わない。既存の教材を読むために残してある。
  /**
   * **文化の背景**(0063 で足し、**2026-09 に廃止した**)。
   *
   *   > RIZAP ENGLISHの教材の3ページ目、「文化の背景」について。
   *   > 今のままだと何が目的だかよくわかりません。これは廃止しましょう。
   *
   * 【なぜ目的が分からなくなったか】
   *   **問いでも練習でもない、読むだけの1ページ**だった。
   *   レッスンの1回は「弱点を指摘し、その弱点の練習をする」ためにあるので、
   *   **その場ですることが無いページ**は、めくられるだけで終わる。
   *   言いたかったこと(なぜそう言うのか)は、
   *   **すぐ下の「本文に出た表現」の `note`** に入る ——
   *   あちらは**そのまま日→英の練習になる**ので、読んで終わらない。
   *
   * 【消さずに残してある理由】
   *   すでに `culture_note` の演習を持つ教材があると、
   *   **ここから消した日に、その教材が開けなくなる**(名前が引けない)。
   *   データベースの制約からも消さない —— 値の一覧を狭めると、
   *   その値が入っている DB に貼り直せなくなる(CLAUDE.md)。
   *   **新しく作る教材には、もう出ない**(`DEFAULT_SECTIONS` にも
   *   `SCALABLE_SECTIONS` にも入っていない)。
   */
  {
    id: 'culture_note', label: '文化の背景',
    instruction: 'なぜそう言うのか、日本と何が違うのかです。読んでおいてください。',
    fields: ['prompt_en', 'prompt_ja', 'note'], audioFrom: null,
    /* 中身は日本語である(`prompt_en` は見出しの語句だけ) */
    grammarFrom: null,
  },
  {
    id: 'read_aloud', label: '音読',
    instruction: 'お手本を聞いてから音読してください。',
    fields: ['prompt_en', 'prompt_ja'], audioFrom: 'prompt_en',
    grammarFrom: 'prompt_en',
  },
  {
    id: 'overlapping', label: 'オーバーラッピング',
    instruction: 'お手本に重ねて読んでください。',
    fields: ['prompt_en', 'prompt_ja'], audioFrom: 'prompt_en',
    grammarFrom: 'prompt_en',
  },
  {
    id: 'shadowing', label: 'シャドーイング',
    instruction: 'お手本を追いかけて声に出してください。',
    fields: ['prompt_en', 'prompt_ja'], audioFrom: 'prompt_en',
    grammarFrom: 'prompt_en',
  },
  {
    id: 'repeating', label: 'リピーティング',
    instruction: 'お手本を聞いてから、1文ずつ繰り返してください。',
    fields: ['prompt_en', 'prompt_ja'], audioFrom: 'prompt_en',
    grammarFrom: 'prompt_en',
  },
  // 単語・フレーズには**発音記号を入れる**(0020、2026-08 利用者の指定)。
  // 発音の練習に使う教材なのに、どう読むのかが書いていなかった
  /* **単語に SVOC は無い。** 窓口の指示が「prompt_en は1語」と決めており、
     辞書の見出し語(原形・単数)だけが入る。文ではないので解説を作らない。
     語の意味は触れば出る(`word_glosses` の控えを読むだけ・0円) */
  { id: 'vocabulary', label: '単語', instruction: '意味を覚えてください。',
    fields: ['prompt_en', 'phonetic', 'prompt_ja'], audioFrom: 'prompt_en',
    grammarFrom: null },
  /* **フレーズには骨組みがある。** 窓口の指示が形を3つに絞っており
     (動詞から始まるかたまり / 名詞のかたまり / 決まり文句)、
     どれも「どこまでが1つのかたまりか」を札で見せられる。
     `read the room` が [read = V] [the room = O] と出ると、
     単語の寄せ集めではないことがそのまま分かる */
  { id: 'phrase', label: 'フレーズ', instruction: '場面ごと覚えてください。',
    fields: ['prompt_en', 'phonetic', 'prompt_ja'], audioFrom: 'prompt_en',
    grammarFrom: 'prompt_en' },
]

export const exerciseType = (id) => EXERCISE_TYPES.find((t) => t.id === id)
export const exerciseLabel = (id) => exerciseType(id)?.label ?? id

/**
 * 数え方の単位。**本文は「問」で数えない。**
 * 記事は段落、会話は発言である(仕様書 第5.17節)。
 * 「会話(14 問)」と書くと、14個の設問があるように読めてしまう。
 */
export const countUnit = (id) => (id === 'article' ? '段落' : id === 'dialogue' ? '発言' : '問')

/** 「14 発言」「10 問」のような表示 */
export const countLabel = (id, n) => `${n} ${countUnit(id)}`

/** 欄の日本語名と入力の目安 */
export const FIELD_LABELS = {
  prompt_en:  { label: '英文(問題)',   placeholder: 'I have several things to do.' },
  prompt_ja:  { label: '日本語(問題)', placeholder: '今日やるべきことがたくさんあります。' },
  hint:       { label: '与える語',     placeholder: 'reply to' },
  question:   { label: '設問',         placeholder: 'How many things does the speaker need to do?' },
  question_ja: { label: '設問の訳',    placeholder: '話し手はいくつのことをする必要がありますか。' },
  answer:     { label: '解答',         placeholder: '会議の前にやるべきことがいくつかあります。' },
  answer_ja:  { label: '解答の訳',     placeholder: '会議の前にやるべきことがいくつかあります。' },
  answer_alt: { label: '別解(改行区切り)', placeholder: 'I have many things to do today.' },
  audio_text: { label: '読み上げる英文', placeholder: 'I have three things to do before I leave.' },
  note:       { label: '補足',         placeholder: 'reply to an email なので、最後の to を落とさない。' },
  speaker:    { label: '話す人',       placeholder: 'Sarah (Product Manager)' },
  /* 本文に出た表現(第5.230節)。**分類は選ぶもの**なので `options` を持つ。
     一覧は `chunkKinds.js` 1か所から来る(ここに書き写さない) */
  chunk_kind: { label: '分類', options: CHUNK_KINDS },
  source_en:  { label: '本文の文章',   placeholder: 'We need to come up with a plan by Friday.' },
}

/**
 * **その問は、答えが問題文の中に見えてしまっていないか。**
 *
 * 【なぜ要るか】(2026-09 実機・利用者の指摘)
 *
 *   > 答えがみえてしまっているではないですか
 *
 *   穴埋めで、こういう問が出ていた。
 *
 *     Before kickoff, could you （　　　） me where the away fans usually sit?
 *     与える語: tell
 *     → tell
 *
 *   設問には「**与えられた語を必要な形に変えること**」と書いてある。
 *   ところが `could you` のうしろは原形なので、**形を変える必要がない。**
 *   与える語がそのまま答えになり、**解答を開くまでもなく答えが見えている。**
 *
 * 【なぜ画面の側で見るのか】
 *   窓口(`generate-material`)の指示も直したが、**指示は読み飛ばされうる。**
 *   ここで落としておけば、窓口を配置し直す前でも、
 *   作り直しの仕組み(`generateSectionUnique`)が別の問に差し替える。
 *   **形は指示ではなく、こちらで確かめる**(`SECTION_FIELDS` と同じ考え方)。
 *
 * 【穴埋めだけを見る】
 *   与える語(`hint`)があるのは穴埋めだけである。
 *   ほかの演習では、答えと同じ英文が問題文に出ること自体が普通にある
 *   (英文和訳の `prompt_en` と `answer` は、そもそも別の言語)。
 */
const bareWord = (s) => String(s ?? '')
  .trim().toLowerCase()
  .replace(/[.,!?;:'"()（）　]/g, '')
  .replace(/\s+/g, ' ')

export const givesAwayAnswer = (exerciseTypeId, item) => {
  if (exerciseTypeId !== 'fill_blank') return false
  const hint = bareWord(item?.hint)
  const answer = bareWord(item?.answer)
  if (!hint || !answer) return false
  return hint === answer
}

/**
 * **無くても成り立つ欄。** これらは空でも、その問は使える。
 *
 * `phonetic` を必須にしないのは、**0020 を貼る前に作った教材**に
 * 入っていないためである(その項目は発音記号が出ないだけ)。
 * `answer_alt` は「別解があれば」の欄で、無いほうがふつうである。
 */
const SPARE_FIELDS = new Set([
  'answer_alt', 'phonetic',
  // 設問・解答の訳(0035)。**無くても、その問は使える。**
  // ここに入れておかないと、窓口を配置し直す前に作った内容の理解が
  // **1問残らず落ちて、教材そのものを作れなくなる**
  'question_ja', 'answer_ja',
  /* 分類と本文の文章(第5.230節)。**まったく同じ理由**である ——
     利用者が窓口(`generate-material`)を置き直すまで、この2つは
     返ってこない。必須にすると**表現が1つ残らず落ちて、
     教材そのものを作れなくなる。** 無くても、その問は使える
     (札が出ないだけ・本文の引用が出ないだけ) */
  'chunk_kind', 'source_en',
])

/**
 * **その問は、中身が空のまま出来上がっていないか。**
 *
 * 【なぜ要るか】(2026-09 実機・利用者の指摘)
 *
 *   フレーズ20問のうち、**1問目が空だった。** 弱点の札だけが出て、
 *   英文も発音記号も訳も無い。それでも画面には「全 20 問」と出ていた。
 *
 *   窓口(`generate-material`)の道具は `strict: true` なので、
 *   **その欄があること**までは API が保証する。ところが
 *   **空文字も「形としては正しい」**ので、そのまま通ってしまう。
 *   「中身が0件のまま『成功』を返さない」(CLAUDE.md)を、
 *   **演習まるごとではなく、1問ずつにも当てはめる。**
 *
 * 【なぜ画面の側にも置くのか】
 *   窓口の側でも落とすようにしたが、**利用者が配置し直すまでは直らない。**
 *   ここに置けば、いまの窓口のままでも作り直しが別の問に差し替える
 *   (`givesAwayAnswer` と同じ考え方)。
 */
export const isBlankItem = (exerciseTypeId, item) => {
  const type = exerciseType(exerciseTypeId)
  if (!type) return false
  const need = type.fields.filter((f) => !SPARE_FIELDS.has(f))
  if (!need.length) return false
  return need.some((f) => !String(item?.[f] ?? '').trim())
}

/**
 * **単語とフレーズを取り違えていないか。**
 *
 * 【なぜ要るか】(2026-09 実機・利用者の指摘)
 *
 *   > また、フレーズが英語的におかしいです。
 *
 *   実機では `crowd reads the room` が出ていた(正しくは `read the room`)。
 *   窓口の指示を厳しくしたが、**指示は読み飛ばされうる**ので、
 *   **こちらで確かめられることは、こちらで確かめる**
 *   (`givesAwayAnswer` と同じ考え方)。
 *
 * 【当てられることだけを見る】
 *   「主語が付いている」「動詞が三人称単数になっている」は、
 *   **語のリストでは当てられない**(`run` は名詞にも動詞にもなる)。
 *   スラッシュリーディングと同じで、**あやふやなことは言わない。**
 *
 *   確かなのは**語数**だけである。利用者の設計では、
 *   単語(`word`)とフレーズ(`phrase`)は**別の種類の教材**なので、
 *     ・フレーズが1語 … それは単語である
 *     ・単語が2語以上 … それはフレーズである(ハイフン語は1語と数える)
 *   これは取り違えようがない。
 */
export const isWrongShape = (exerciseTypeId, item) => {
  const text = String(item?.prompt_en ?? '').trim()
  if (!text) return false                       // 空は `isBlankItem` の担当
  const words = text.split(/\s+/).length
  if (exerciseTypeId === 'phrase') return words < 2
  if (exerciseTypeId === 'vocabulary') return words > 1
  /* **本文に出た表現は、2語以上**(第5.230節・利用者の指定)。

       > 単語単体はここには載せない。
       > あくまで２語以上のチャンクを練習する場とする

     窓口の指示にも書いたが、**指示は読み飛ばされうる**ので
     こちらでも落とす(フレーズのときとまったく同じ考え方)。
     **数え方は `chunkKinds.js` 1か所**から借りる —— ハイフン語を
     1語と数えるかどうかを、2通り持たない */
  if (exerciseTypeId === 'vocab_note') return !isChunkText(text)
  return false
}

/**
 * 教材の種類ごとの、既定の演習構成と問数。
 *
 * 文型ドリルの「4演習 × 10問 = 40問」は、実物のドリルに合わせた数字
 * (仕様書 第5.13.3節)。量は定着の条件なので、既定として下げない。
 * トレーナーが増減できる。
 */
export const DEFAULT_SECTIONS = {
  // **穴埋めは 2026-09 に「誤り訂正」へ差し替えた**(利用者の指定)。
  // 穴埋めは答えが1つに決まらないことがあり、しかも与える語が
  // そのまま答えになると問題文の中に答えが見えていた。
  // 4演習 × 10問 = 40問という数は変えていない(第5.13.3節)。
  pattern: [
    { exercise_type: 'translate_en_ja',  count: 10 },
    { exercise_type: 'error_correction', count: 10 },
    { exercise_type: 'translate_ja_en',  count: 10 },
    { exercise_type: 'listening',        count: 10 },
  ],
  // リーディングは「記事1本」。count は段落の数であって、問題の数ではない。
  // 6段落でおよそ 250〜350 語になる。シャドーイングに使うには、
  // これくらいの長さが要る(短い文の寄せ集めでは練習にならない)。
  // ディスカッションは**内容の理解に足す**もので、置き換えではない
  // (2026-09 利用者の指定)。内容を確かめてから考えを話す順に並べる。
  reading: [
    { exercise_type: 'article',       count: 6 },
    { exercise_type: 'comprehension', count: 5 },
    { exercise_type: 'discussion',    count: 5 },
    { exercise_type: 'vocab_note',    count: 8 },
  ],
  // ダイアローグは「会話1本」。count は発言の数。
  // 14往復ぶんで、場面がひととおり成立する長さになる。
  //
  // **内容の理解は5問**(2026-09 利用者の指定「5個・10個に戻してください」)。
  // 会話だけ 4問(倍で8問)になっていたが、記事と揃っていないと
  // 「なぜここだけ少ないのか」が説明できない。**記事と同じ5問にする。**
  dialogue: [
    { exercise_type: 'dialogue',      count: 14 },
    { exercise_type: 'comprehension', count: 5 },
    { exercise_type: 'discussion',    count: 5 },
    { exercise_type: 'vocab_note',    count: 6 },
  ],
  /**
   * **会議**(2026-09 利用者の指定「会議の教材が追加されていない」)。
   *
   * 中身は**会話とまったく同じ**である。ちがうのは
   * **出てくる人数が3〜4人**だという1点だけ
   * (立場の違う人が集まり、その場で決めていく)。
   *
   * **演習の種類(`dialogue`)は増やしていない。** 増やすと
   * `material_sections_type_check` も窓口も触ることになり、
   * すでに作った会話と別物になってしまう。
   * **足したのは `materials.kind` の値1つだけ**(0037)。
   */
  meeting: [
    { exercise_type: 'dialogue',      count: 14 },
    { exercise_type: 'comprehension', count: 5 },
    { exercise_type: 'discussion',    count: 5 },
    { exercise_type: 'vocab_note',    count: 6 },
  ],
  /**
   * **Speech練習**(2026-09 利用者の指定)。
   *
   *   > 基本的に「記事」と同じで大丈夫なのですが、タイトルを
   *   > 「Speech練習」などにしてほしいです。
   *
   * **中身は記事とまったく同じにしてある**(言われたとおり)。
   * 本文は `article`(1人が話す・段落が並ぶ)なので、
   * **演習の種類を増やしていない。**
   * `material_sections_type_check` も窓口も触らずに済む。
   *
   * 内容の理解・ディスカッション・語句が要らないときは、
   * 作る画面のチェックで外せる(`SCALABLE_SECTIONS`)。
   * **こちらで勝手に減らさない** —— 外すかどうかはトレーナーが決める。
   */
  speech: [
    { exercise_type: 'article',       count: 6 },
    { exercise_type: 'comprehension', count: 5 },
    { exercise_type: 'discussion',    count: 5 },
    /* **想定される質問**(2026-09 利用者の指定)。
       話し終えたあとに来るものなので、**本文と設問のうしろ**に置く。
       語句より前なのは、質疑まででスピーチが1本終わるためである。
       **Speech練習だけに入れる** —— 記事や会話には聴衆がいない
       (言われた場所だけを直す・CLAUDE.md) */
    { exercise_type: 'audience_qa',   count: 5 },
    { exercise_type: 'vocab_note',    count: 8 },
  ],
  /**
   * **単語 / フレーズ**(2026-09 利用者の指定・0047)。
   *
   *   > これは、フレーズのトレーニングとドッキングして
   *   > 一緒にするのも良いかもしれません。
   *
   * もとは `word`(単語20問)と `phrase`(フレーズ20問)に分かれ、
   * **どちらも演習が1つしか無かった。** 20問を1回解いて終わりなので、
   * 「トレーニングとして成り立っていない」という指摘そのものである。
   *
   * **合わせて20問のまま、単語10 + フレーズ10にする。**
   * 片方だけにしたいときは作る画面のチェックで外せて、
   * そのうえで「倍」を選べば**もとの20問とまったく同じ**になる。
   * **こちらで勝手に減らしていない。**
   */
  vocab: [
    { exercise_type: 'vocabulary', count: 10 },
    { exercise_type: 'phrase',     count: 10 },
  ],
  // 旧「単語」「フレーズ」。新規では選べないが、既存の教材を開くために残す
  word:   [{ exercise_type: 'vocabulary', count: 20 }],
  phrase: [{ exercise_type: 'phrase',     count: 20 }],
  // 旧「長文」。新規では選べないが、既存の教材を開くために残す
  passage: [
    { exercise_type: 'read_aloud',  count: 8 },
    { exercise_type: 'shadowing',   count: 8 },
  ],
}

/**
 * 本文(記事・会話)の演習かどうか。
 *
 * 本文は「問数」で数えない。段落や発言がいくつあっても1本の読み物である。
 * 弱点で分割してはいけないのも、この演習である。
 */
export const isPassageSection = (typeId) => !!exerciseType(typeId)?.isPassage

/**
 * **「かたまり + 練習」の形で描く演習かどうか**(第5.230節)。
 *
 * 画面は3つある(教材の中身 / レッスン表示 / 紙)。
 * **どれにも `sec.exercise_type === 'vocab_note'` と書かない** ——
 * 置く場所の数だけ食い違う(`remakeModeOf()` / `noteIsAnswer()` と
 * まったく同じ考え方・CLAUDE.md)。
 *
 * **見分け方は「分類の欄を持っているか」。** 演習の id を書き写すと、
 * 同じ形の演習を足した日に、画面の数だけ直すことになる。
 * **既定は `false`** —— 種類が分からないうちは、いつもの形で描く。
 */
export const isChunkSection = (typeId) =>
  (exerciseType(typeId)?.fields ?? []).includes('chunk_kind')

/**
 * **`note` が「答えの側」に来る演習かどうか。**
 *
 * ディスカッションと想定される質問には**正解が無い**ので `answer` を持たない
 * (欄を出せば AI は必ず何かを書く)。代わりに `note` へ日本語の手がかりが入り、
 * **それが答え合わせのときに出したいもの**である。
 *
 * 【なぜ要るか】(2026-09 実機)
 *
 *   レッスン表示は「解答を見る」を
 *   **`answer` か `audio_text` か、本文の訳があるときだけ**出していた。
 *   だからディスカッションの手がかりは、**どこからも開けなかった。**
 *   `MaterialBody`(紙)と「今週の宿題」では出ていたので、
 *   **レッスン表示だけが取りこぼしていた。**
 *
 * 【`vocab_note` は入らない】
 *   あちらの `note` は例文と使いどころで、**答えではない。**
 *   だから `question` を持つ演習だけに絞ってある。
 */
export const noteIsAnswer = (typeId) => {
  const fields = exerciseType(typeId)?.fields ?? []
  return fields.includes('question') && !fields.includes('answer')
}

/**
 * **解答に読み上げ(Listen)を出すかどうか。**
 *
 * 2026-09 利用者の指定。
 *
 *   > 文型トレーニングなどの解答の和訳に「listen」ボタンは不要なので
 *   > 同じ仕様になっているところは全て削除してください
 *
 * 【何が起きていたか】(実機の写真・英文和訳)
 *
 *     The manager makes the new staff happy.   [Listen] [解答を隠す]
 *     → 店長は新しいスタッフを幸せにします。
 *       [Listen]                               ← **これ**
 *
 *   英文和訳の `answer` は**和訳そのもの**、つまり日本語である。
 *   そこに読み上げを出しても、**日本語を英語の声で読む**だけで、
 *   誰の役にも立たない(効かない操作を見せない)。
 *
 * 【なぜ欄で見分けられないか】
 *   `fields` からは当てられない。英文和訳(`prompt_en` + `answer`)と
 *   誤り訂正(`prompt_en` + `answer` + `note`)は、
 *   **どちらも英語の問題文に `answer` が続く形**なのに、
 *   前者の解答は日本語、後者は英語である。
 *   `audioFrom` でも当てられない —— あれは**問題文**の音の話で、
 *   誤り訂正は `null` だが、解答(直した英文)は英語で読める。
 *
 *   だから**書く。** `answer` を持つ演習には `answerLang` を必ず置き、
 *   **`npm run test:play` が「書き忘れ」を赤くする** ——
 *   足すまで赤いままなので、演習を足す人は必ず1回、
 *   その解答が英語か日本語かを自分の目で決めることになる
 *   (声の名簿の `KNOWN` と同じ考え方)。
 *
 * 【判断はここ1か所】
 *   解答が出る場所は3つある(教材の中身 / レッスン表示 / 今週の宿題)。
 *   **画面の中で `typeId === 'translate_en_ja'` と書かない** ——
 *   置く場所の数だけ食い違う(`remakeModeOf()` と同じ考え方)。
 *   実際に使うのは `AnswerEn` の中**1か所**で、
 *   画面は演習の種類を渡すだけである。
 *
 * **既定は「出さない」。** 種類が分からないうちは鳴らさない。
 */
export const answerHasAudio = (typeId) => exerciseType(typeId)?.answerLang === 'en'

/**
 * **文法解説(SVOC)を作る元にする欄。** 無ければ `null`。
 *
 * 【なぜ欄で見分けられないか】(2026-09 利用者の指摘)
 *
 *   > そして、文法も調べられません。…… 文法を見るのはそもそも
 *   > 集中モードでない場所で見れませんか？
 *
 *   解説は**本文(記事・会話)の `prompt_en` だけ**に作っていた。
 *   だから文型ドリルを開いても、どこにも文法が出てこなかった。
 *
 *   **では設問の英文はどこにあるか** —— これが演習ごとに違う。
 *
 *   | 演習 | 解説する英文 | なぜ |
 *   |---|---|---|
 *   | 英文和訳 | `prompt_en` | 問題文が完全な英文 |
 *   | 誤り訂正 | `answer` | **誤った文を解説しない** |
 *   | 和文英訳 | `answer` | 問題文は日本語 |
 *   | リスニング | `audio_text` | 聞く英文が本体 |
 *   | 内容の理解 | `answer` | 設問は疑問文で骨組みが見えにくい |
 *
 *   `fields` からは当てられない(英文和訳と誤り訂正は**どちらも
 *   `prompt_en` + `answer`** なのに、解説する側が逆である)。
 *   `audioFrom` でも当てられない —— 誤り訂正は `null` だが、
 *   直した英文は解説できる。**だから書く。**
 *
 * 【書き忘れを赤くする】
 *   `answerLang` とまったく同じ形にしてある。**足すまで赤いまま**なので、
 *   演習を足す人は必ず1回、その演習に解説できる英文があるかを
 *   自分の目で決めることになる(`npm run test:play`)。
 *
 * 【判断はここ1か所】
 *   解説を作る側(`fillGrammar` / `addGrammar`)と、出す側
 *   (`LessonView` / `FocusReader`)と、数える側(費用の見積もり)で
 *   **同じものを見る。** 書き写すと、作った先と読む先が食い違って
 *   **作ったのに出ない**(= 二度課金される)。
 *
 * **既定は `null`。** 種類が分からないうちは作らない(課金しない)。
 */
export const grammarSource = (typeId) => exerciseType(typeId)?.grammarFrom ?? null

/**
 * **画面に出す演習の名前。**
 *
 * 【なぜ種類(`kind`)も見るのか】(2026-09 実機・利用者の指摘)
 *
 *   > また、サブタイトルが「記事」というのも直して下さい。
 *
 *   Speech練習の本文は、**記事とまったく同じ演習(`article`)**である
 *   (だから `material_sections_type_check` も窓口も触っていない)。
 *   ところが名前をそのまま出すと、Speech練習でも「記事(5 段落)」と
 *   書かれる。**会議でも同じことが起きる**(本文は `dialogue` なので
 *   「会話」と出る)。
 *
 *   **本文の呼び名は `bodyWord()` が持っている。**
 *   演習の名前をそのまま出してよいのは、本文でない演習だけである。
 *   **この判断を画面ごとに書き写さない** —— 出す場所は6か所ある。
 */
export const sectionLabel = (kind, typeId) =>
  (isPassageSection(typeId) ? bodyWord(kind) : exerciseLabel(typeId))

export const defaultSectionsFor = (kind) => DEFAULT_SECTIONS[kind] ?? DEFAULT_SECTIONS.pattern

/**
 * **文型ドリルの4演習**(2026-09 利用者の指定)。
 *
 *   > 文型トレーニングでは、すべての設問を基本10問にしてください。
 *   > 教材ひとつで40問。そして各ページの問題数を(中略)調整できるように
 *
 * 既定は10問のまま(4演習 × 10問 = 40問)。**既定を下げない**のは
 * 第5.13.3節の決まりである。増やす道だけを足してある。
 * **ここだけ3倍(30問)まで選べる**(弱点が3つまで選べるため)。
 */
export const DRILL_SECTIONS = [
  // **`fill_blank` は入れない**(2026-09 に `error_correction` へ差し替えた)。
  // ここは**これから作る**教材の話なので、古い種類は並べない
  'translate_en_ja', 'error_correction', 'translate_ja_en', 'listening',
]

/**
 * **数を増やせる演習**(2026-09 利用者の指定)。
 *
 *   > 内容理解の質問を増やしたいとき、語句を増やしたいときは
 *   > 教材作成のところで指定できるようにしてください。
 *   > ディフォルトの数またはその倍という感じの2パターン指定できると最高です。
 *
 * **本文(記事・会話)は入れない。** あちらの count は段落数・発言数で、
 * 増やすと読み物の長さそのものが変わる。長さは第5.13節で決めてある。
 * 増やすのは**本文に対して作る設問と語句**、そして**文型ドリルの4演習**である。
 */
export const SCALABLE_SECTIONS = [
  // ディスカッションも「標準(5問)/ 倍(10問)」で選べる
  // (2026-09 利用者の指定「基本は５問、設定により１０問に」)
  'comprehension', 'discussion', 'vocab_note',
  // 想定される質問も「標準(5問)/ 倍(10問)」で選べる
  // (2026-09 利用者の指定「個数を5個、10個と選べるようにして下さい」)
  'audience_qa',
  /* **単語とフレーズ**(0047)。1つの種類にまとめたので、
     「単語だけ」「フレーズだけ」に戻す道が要る。
     外したうえで「倍」を選べば、もとの20問とまったく同じになる */
  'vocabulary', 'phrase',
  ...DRILL_SECTIONS,
]

/**
 * その教材の「1つの演習の問数」(2026-09 利用者の指定)。
 *
 *   > また、絞り込みでも指定できるように
 *
 * **本文(記事・会話)は数えない。** あちらは段落数・発言数であって、
 * 問数ではない(`isPassageSection`)。
 * 数え方をここに1つだけ置く。**画面ごとに書き写さない。**
 */
export const drillCount = (sections) => (sections ?? [])
  .filter((s) => !isPassageSection(s.exercise_type))
  .reduce((max, s) => Math.max(max, s.items?.length ?? s.count ?? 0), 0)

/**
 * 10問・20問・30問のどれか。**細かい数では絞らせない**(選ぶ手間が増える)。
 * 30問まであるのは、**弱点を3つまで指定できる**からである(下記)。
 */
export const drillBucket = (sections) => {
  const n = drillCount(sections)
  if (n >= 25) return '30'
  return n >= 15 ? '20' : '10'
}

/**
 * 増やし方。**細かい数は選ばせない**(選ぶ手間が増えるだけ)。
 *
 * 【なぜ3倍(30問)まであるのか】(2026-09 利用者の指定)
 *
 *   > 30問までにしてください。なぜなら弱点を3つまで指定できるからです
 *
 *   弱点は3つまで選べる。窓口はその弱点に**できるだけ均等に**問を配る
 *   (`generate-material`)ので、1つの弱点に10問ずつ当てるには
 *   **30問**が要る。20問では、弱点3つのときに1つあたり6〜7問になる。
 *
 * **3倍が出るのは文型ドリルの4演習だけ**(`amountsFor`)。
 * 記事・会話の設問と語句は、これまでどおり標準か倍の2つである
 * (2026-09 の指定「ディフォルトの数またはその倍という感じの2パターン」)。
 */
export const AMOUNTS = [
  { id: 'default', label: '標準', times: 1 },
  { id: 'double', label: '倍', times: 2 },
  { id: 'triple', label: '3倍', times: 3 },
]

/** その演習で選べる増やし方。**3倍は文型ドリルだけ** */
export const amountsFor = (typeId) => (DRILL_SECTIONS.includes(typeId)
  ? AMOUNTS
  : AMOUNTS.filter((a) => a.id !== 'triple'))

/**
 * **1つの演習の上限。** 窓口(`generate-material`)も同じ数で丸める。
 * **片方だけ変えない。** 画面に出した数と実際の数が食い違う
 * (窓口を配置し直すまでは、20問より多くは作られない)。
 */
export const MAX_ITEMS = 30

/**
 * **その演習を入れるか。**(2026-09 利用者の指定)
 *
 *   > どの問題が何問必要なのかを都度選択できる設計にしてください。
 *   > 今は数だけ変更できる問題を、チェックによって入れるか入れないかも
 *   > 決めれるように。
 *
 * 既定は**入れる**。`include` に `false` が入っている演習だけを外す
 * (`{ listening: false }` のように、外したものだけを持つ)。
 *
 * **外せるのは `SCALABLE_SECTIONS` だけ。** 本文(記事・会話)は外せない。
 * 内容の理解・ディスカッション・語句は本文から作るので、
 * **本文が無くなると、そもそも何も作れない。**
 */
export const isIncluded = (typeId, include = null) => {
  if (!SCALABLE_SECTIONS.includes(typeId)) return true
  return include?.[typeId] !== false
}

/**
 * 既定の構成に、入れるかどうかと増やし方をかぶせる。
 *
 * @param {string} kind 教材の種類
 * @param {object} amounts `{ comprehension: 'double', ... }`
 * @param {object} include `{ listening: false, ... }`(外すものだけ)
 *
 * **上限は `MAX_ITEMS`(30)。** 窓口(`generate-material`)も同じ数で
 * 丸めるので、**片方だけ変えない。**
 */
export const sectionsFor = (kind, amounts = null, include = null) =>
  defaultSectionsFor(kind)
    .filter((s) => isIncluded(s.exercise_type, include))
    .map((s) => {
      if (!SCALABLE_SECTIONS.includes(s.exercise_type)) return s
      const pick = amounts?.[s.exercise_type]
      const times = AMOUNTS.find((a) => a.id === pick)?.times ?? 1
      if (times === 1) return s
      return { ...s, count: Math.min(s.count * times, MAX_ITEMS) }
    })
