/**
 * 文法30日集中講座(2026-09 利用者の指定)。
 *
 *   > pre basic と basic に基礎単語習得モードとか文法30日集中講座などが
 *   > 欲しい。日本ではいわゆる中学英語と呼ばれるものだ。
 *   > **ただ網羅するのではなく**、単語と基礎的な文法の仕組みを
 *   > **楽しんで身に付けられる**コースにして欲しい。
 *
 * 【並べ方は「文法書の順」ではなく「話せる順」】
 *   中学英語の教科書は「be動詞 → 一般動詞 → 三単現 → …」と
 *   **文法の都合**で並ぶ。この講座は**言えるようになる順**に並べた。
 *
 *     1日目 … 名乗る(I am 〜)
 *     2日目 … 好きなものを言う(I like 〜)
 *     4日目 … 相手に訊く(Do you 〜?)
 *
 *   4日目で**やりとりが成立する。** そこまでで自己紹介と質問ができる。
 *   「網羅するのではなく」という指定は、ここに効かせてある。
 *
 * 【30日を3つに割ってある】
 *   | 日 | 何ができるようになるか |
 *   |---|---|
 *   | 1〜10 | **いま**のことを言う・訊く(現在) |
 *   | 11〜20 | **時間**と**場所**を足す(過去・未来・前置詞・くらべる) |
 *   | 21〜30 | **言いたいことを長くする**(不定詞・接続詞・関係詞) |
 *
 * 【単語は別のファイル】
 *   語は `src/data/basicWords.js` が持ち、**1語1日**に割り当ててある。
 *   ここに書き写すと、**同じ一覧を2か所に持つ**ことになる。
 *
 * 【弱点タグとつなぐ】
 *   各日に `tagIds` を持たせてある(`src/data/weaknessTags.js` の id)。
 *   **その日でつまずいたら、そのタグで教材を作れる** ——
 *   このアプリの中心は「弱点から教材を作って共有する」ことなので、
 *   講座もそこへつながっていないと、行き止まりになる。
 *
 * 【何も新しく作らない】
 *   例文の読み上げは `SpeakButton`、語は単語帳(`mark_word`)、
 *   問は Quick Response と同じ形。**この講座のためだけの仕組みを作らない。**
 */

/**
 * 30日の中身。**日は1から30まで、飛ばさない。**
 *
 * @property no       何日目か
 * @property title    その日の題(**文法用語だけにしない**。何ができるかを添える)
 * @property aim      ねらい(1行)
 * @property points   仕組みの説明。**1行に1つ**(指導ポイントと同じ作法)
 * @property examples 例文。**必ず訳を付ける**(訳の無い英文は出さない)
 * @property tagIds   つまずいたときに教材を作る弱点タグ
 */
export const COURSE_DAYS = [
  // ── 1〜10日目 … いまのことを言う・訊く ────────────────────
  {
    no: 1,
    title: 'be動詞 — 名乗る',
    aim: '「私は〜です」で、自分のことを言えるようになる',
    points: [
      'be動詞は「A = B」を作る。I am / You are / He is の3つだけ覚える',
      '短くして言うのがふつう(I am → I\'m、You are → You\'re)',
      '「〜ではない」は not を be動詞のうしろに置く(I\'m not 〜)',
    ],
    examples: [
      { en: "I'm Kenji.", ja: '私はケンジです。' },
      { en: "I'm from Osaka.", ja: '大阪の出身です。' },
      { en: "You're early today.", ja: '今日は早いですね。' },
      { en: "I'm not busy now.", ja: 'いまは忙しくありません。' },
    ],
    tagIds: ['be-verb'],
  },
  {
    no: 2,
    title: '一般動詞 — 好きなもの・持っているもの',
    aim: '「私は〜する」で、自分のことをもう一段くわしく言える',
    points: [
      'be動詞以外の動詞は、主語のすぐうしろに原形を置くだけ',
      '**be動詞と一般動詞は、同じ文に2つ入らない**(× I am like 〜)',
      '「〜しない」は don\'t を動詞の前に置く(I don\'t eat 〜)',
    ],
    examples: [
      { en: 'I like coffee.', ja: 'コーヒーが好きです。' },
      { en: 'I have two brothers.', ja: '兄弟が2人います。' },
      { en: 'I work at a bank.', ja: '銀行で働いています。' },
      { en: "I don't drink beer.", ja: 'ビールは飲みません。' },
    ],
    tagIds: ['verb-form'],
  },
  {
    no: 3,
    title: '名詞と a / the — ものの言い方',
    aim: '「1つ」か「いくつか」かを、言い分けられる',
    points: [
      '数えられるものが1つなら a / an を付ける(a book / an apple)',
      '2つ以上なら、うしろに -s を付ける(books / apples)',
      '相手も分かっているものには the を使う(the station = あの駅)',
      '水・お金・情報は数えられない。a も -s も付けない',
    ],
    examples: [
      { en: 'I need a pen.', ja: 'ペンが1本要ります。' },
      { en: 'I have three meetings today.', ja: '今日は会議が3つあります。' },
      { en: 'The train is late.', ja: '(その)電車が遅れています。' },
      { en: 'I want some water.', ja: '水がほしいです。' },
    ],
    tagIds: ['article'],
  },
  {
    no: 4,
    title: '疑問文 — 相手に訊く',
    aim: '「〜ですか」「〜しますか」で、会話が続くようになる',
    points: [
      'be動詞は前に出すだけ(You are 〜 → Are you 〜?)',
      '一般動詞は Do を頭に置く(You like 〜 → Do you like 〜?)',
      '答えは Yes, I do. / No, I don\'t. のように**同じ形**で返す',
      'What / Where / When / Who / Why / How は、その頭に置く',
    ],
    examples: [
      { en: 'Are you free tomorrow?', ja: '明日は空いていますか。' },
      { en: 'Do you have time now?', ja: 'いま時間はありますか。' },
      { en: 'Where do you live?', ja: 'どこに住んでいますか。' },
      { en: 'What time is it?', ja: 'いま何時ですか。' },
    ],
    tagIds: ['question'],
  },
  {
    no: 5,
    title: '三人称単数の -s — 人の話をする',
    aim: '自分と相手以外の話を、正しい形で言える',
    points: [
      '主語が he / she / it・人の名前1人のときだけ、動詞に -s を付ける',
      'have だけは has になる',
      '疑問文と否定文では does を使い、**動詞は原形に戻る**(× Does he likes)',
    ],
    examples: [
      { en: 'She works in Tokyo.', ja: '彼女は東京で働いています。' },
      { en: 'He has two children.', ja: '彼には子どもが2人います。' },
      { en: 'Does she speak English?', ja: '彼女は英語を話しますか。' },
      { en: "My boss doesn't use email much.", ja: '上司はあまりメールを使いません。' },
    ],
    tagIds: ['third-person'],
  },
  {
    no: 6,
    title: '代名詞 — 誰のもの・誰に',
    aim: '同じ名前をくり返さずに話せる',
    points: [
      '主語なら I / you / he / she / we / they',
      '「〜を・〜に」なら me / you / him / her / us / them',
      '「〜の」なら my / your / his / her / our / their',
      'it は「もの」だけでなく、天気・時間・距離にも使う',
    ],
    examples: [
      { en: 'Can you call me later?', ja: 'あとで電話してもらえますか。' },
      { en: 'This is my desk.', ja: 'ここが私の机です。' },
      { en: 'I sent them the file.', ja: '彼らにそのファイルを送りました。' },
      { en: "It's cold today.", ja: '今日は寒いです。' },
    ],
    tagIds: ['pronoun'],
  },
  {
    no: 7,
    title: '現在進行形 — いま何をしているか',
    aim: '「いま〜しています」が言える',
    points: [
      'be動詞 + 動詞の -ing。**be動詞を忘れない**(× I working)',
      'いまこの瞬間のことに使う',
      'know / like / want のように「状態」を表す動詞は、ふつう -ing にしない',
    ],
    examples: [
      { en: "I'm working on the report.", ja: 'いま報告書を作っています。' },
      { en: 'She is talking to a client.', ja: '彼女はお客さまと話しています。' },
      { en: 'What are you doing?', ja: '何をしているのですか。' },
      { en: "It's raining.", ja: '雨が降っています。' },
    ],
    tagIds: ['tense'],
  },
  {
    no: 8,
    title: '形容詞と副詞 — どんな・どのように',
    aim: 'ものと動きに説明を足せる',
    points: [
      '形容詞は名詞の前(a big room)か、be動詞のうしろ(It is big)',
      '副詞は動詞のようすを言う。多くは形容詞 + ly(slow → slowly)',
      'good(形容詞)と well(副詞)は形が違う。**ここを取り違えやすい**',
      'very / really / a little で強さを足せる',
    ],
    examples: [
      { en: "It's a small office.", ja: '小さなオフィスです。' },
      { en: 'Please speak slowly.', ja: 'ゆっくり話してください。' },
      { en: 'She speaks English well.', ja: '彼女は英語を上手に話します。' },
      { en: "I'm a little tired.", ja: '少し疲れています。' },
    ],
    tagIds: ['adverb-form'],
  },
  {
    no: 9,
    title: 'can — できること・お願い',
    aim: '「〜できます」「〜してもらえますか」が言える',
    points: [
      'can のうしろは**必ず原形**(× can to go / × can goes)',
      '「できない」は can\'t',
      'Can you 〜? は頼むとき、Can I 〜? は許しをもらうとき',
      'Could you 〜? にすると、ぐっと丁寧になる',
    ],
    examples: [
      { en: 'I can drive.', ja: '運転できます。' },
      { en: "I can't come today.", ja: '今日は行けません。' },
      { en: 'Can you help me?', ja: '手伝ってもらえますか。' },
      { en: 'Could you say that again?', ja: 'もう一度おっしゃっていただけますか。' },
    ],
    tagIds: ['modal'],
  },
  {
    no: 10,
    title: '命令文と Let\'s — 頼む・誘う',
    aim: '相手を動かす言い方ができる',
    points: [
      '主語を言わずに、動詞の原形から始める(Sit down.)',
      'Please を付けると柔らかくなる。**それでも強い**ので、仕事では Could you 〜? が無難',
      '「〜しないで」は Don\'t + 原形',
      'Let\'s + 原形 で「〜しましょう」',
    ],
    examples: [
      { en: 'Please have a seat.', ja: 'どうぞお掛けください。' },
      { en: "Don't worry.", ja: '心配しないでください。' },
      { en: "Let's start.", ja: '始めましょう。' },
      { en: 'Take your time.', ja: 'ゆっくりどうぞ。' },
    ],
    tagIds: ['imperative'],
  },

  // ── 11〜20日目 … 時間と場所を足す ──────────────────────────
  {
    no: 11,
    title: '過去の be動詞 — 昨日のこと',
    aim: '「〜でした」が言える',
    points: [
      'am / is → was、are → were の2つだけ',
      '否定は wasn\'t / weren\'t',
      '疑問文は Was 〜? / Were 〜? と前に出す',
    ],
    examples: [
      { en: 'I was busy yesterday.', ja: '昨日は忙しかったです。' },
      { en: 'The meeting was long.', ja: '会議は長かったです。' },
      { en: 'Were you at home?', ja: '家にいましたか。' },
      { en: "It wasn't difficult.", ja: '難しくありませんでした。' },
    ],
    tagIds: ['tense'],
  },
  {
    no: 12,
    title: '過去形(規則) — 何をしたか',
    aim: '昨日したことを話せる',
    points: [
      '多くの動詞は -ed を付けるだけ(work → worked)',
      '否定と疑問では didn\'t / Did を使い、**動詞は原形に戻る**',
      '主語が he でも she でも、形は変わらない(過去形は1つだけ)',
    ],
    examples: [
      { en: 'I called him yesterday.', ja: '昨日、彼に電話しました。' },
      { en: 'We finished the work.', ja: 'その仕事を終えました。' },
      { en: "I didn't check my email.", ja: 'メールを確認しませんでした。' },
      { en: 'Did you talk to her?', ja: '彼女と話しましたか。' },
    ],
    tagIds: ['tense'],
  },
  {
    no: 13,
    title: '不規則な過去形 — よく使う形をまとめて',
    aim: 'よく使う動詞の過去形が、すぐ口から出る',
    points: [
      '形が変わるものは決まっている。**よく使う30個ほどを先に覚える**',
      'go → went、have → had、say → said、get → got、take → took',
      'come → came、see → saw、do → did、make → made、know → knew',
      '否定と疑問では didn\'t / Did なので、**そこでは原形に戻る**',
    ],
    examples: [
      { en: 'I went to Tokyo last week.', ja: '先週、東京へ行きました。' },
      { en: 'She said yes.', ja: '彼女は「はい」と言いました。' },
      { en: 'We had lunch together.', ja: '一緒に昼食をとりました。' },
      { en: 'I got your message.', ja: 'メッセージを受け取りました。' },
    ],
    tagIds: ['tense'],
  },
  {
    no: 14,
    title: '過去進行形 — そのとき何をしていたか',
    aim: '出来事が重なったときの言い方ができる',
    points: [
      'was / were + 動詞の -ing',
      '「〜していたとき、…した」は when とつなぐ',
      '過去形は「した」、過去進行形は「している最中だった」',
    ],
    examples: [
      { en: 'I was cooking then.', ja: 'そのとき料理をしていました。' },
      { en: 'She was waiting outside.', ja: '彼女は外で待っていました。' },
      { en: 'I was driving when you called.', ja: '電話をくれたとき、運転中でした。' },
      { en: 'What were you doing?', ja: '何をしていたのですか。' },
    ],
    tagIds: ['tense'],
  },
  {
    no: 15,
    title: '未来 — 予定を言う',
    aim: '「〜します」「〜するつもりです」が言い分けられる',
    points: [
      'will は、その場で決めたこと・きっとそうなること',
      'be going to は、**もう決まっている**予定',
      '近い予定は、現在進行形でも言える(I\'m meeting him at three.)',
      'どちらもうしろは原形',
    ],
    examples: [
      { en: "I'll call you back.", ja: 'かけ直します。' },
      { en: "I'm going to visit Osaka next month.", ja: '来月、大阪へ行く予定です。' },
      { en: 'It will rain tonight.', ja: '今夜は雨が降るでしょう。' },
      { en: "I'm meeting him at three.", ja: '3時に彼と会います。' },
    ],
    tagIds: ['future'],
  },
  {
    no: 16,
    title: 'There is / are — 「〜がある」',
    aim: 'その場に何があるかを言える',
    points: [
      'うしろの名詞が1つなら is、2つ以上なら are',
      '**There は「そこ」という意味ではない。** 場所は文の最後に足す',
      '疑問文は Is there 〜? / Are there 〜?',
    ],
    examples: [
      { en: 'There is a café near the station.', ja: '駅の近くにカフェがあります。' },
      { en: 'There are two options.', ja: '選択肢が2つあります。' },
      { en: 'Is there a problem?', ja: '何か問題がありますか。' },
      { en: "There isn't enough time.", ja: '時間が足りません。' },
    ],
    tagIds: ['there-is'],
  },
  {
    no: 17,
    title: '前置詞(場所) — どこにあるか',
    aim: '場所を正しく言える',
    points: [
      'in は「中」(in the room)、on は「面に接して」(on the desk)',
      'at は「点」(at the station / at the door)',
      'near / next to / in front of / behind / between で位置を足す',
      '**日本語からは決められない。** 組み合わせごと覚える',
    ],
    examples: [
      { en: "It's in my bag.", ja: 'かばんの中にあります。' },
      { en: 'The file is on the desk.', ja: 'ファイルは机の上にあります。' },
      { en: "I'll wait at the entrance.", ja: '入口で待っています。' },
      { en: "It's next to the bank.", ja: '銀行のとなりです。' },
    ],
    tagIds: ['preposition'],
  },
  {
    no: 18,
    title: '前置詞(時) — いつか',
    aim: '時間・曜日・日付を正しく言える',
    points: [
      'at は時刻(at 3:00)、on は曜日と日付(on Monday)、in は月・年・季節(in May)',
      'before / after / until / from 〜 to 〜 で幅を言う',
      'next week / last month / tomorrow には前置詞を付けない',
    ],
    examples: [
      { en: "Let's meet at ten.", ja: '10時に会いましょう。' },
      { en: 'The event is on Friday.', ja: 'そのイベントは金曜です。' },
      { en: 'I started in April.', ja: '4月に始めました。' },
      { en: 'I need it by Monday.', ja: '月曜までに必要です。' },
    ],
    tagIds: ['preposition'],
  },
  {
    no: 19,
    title: '数と量 — どれくらい',
    aim: '「いくつ」「どれくらい」を言い分けられる',
    points: [
      '数えられるものは many / a few、数えられないものは much / a little',
      'some は肯定文、any は疑問文と否定文で使うことが多い',
      '**すすめるときは疑問文でも some**(Would you like some tea?)',
      'a lot of はどちらにも使える',
    ],
    examples: [
      { en: 'I have a few questions.', ja: '質問がいくつかあります。' },
      { en: "There isn't much time.", ja: 'あまり時間がありません。' },
      { en: 'Do you have any plans?', ja: '何か予定はありますか。' },
      { en: 'Would you like some coffee?', ja: 'コーヒーはいかがですか。' },
    ],
    tagIds: ['quantity'],
  },
  {
    no: 20,
    title: 'くらべる — 比較級と最上級',
    aim: '2つ・3つ以上をくらべて言える',
    points: [
      '短い語は -er / -est(big → bigger → biggest)',
      '長い語は more / most を前に置く(more useful)',
      'good → better → best、bad → worse → worst は形が変わる',
      '「同じくらい」は as 〜 as',
    ],
    examples: [
      { en: 'This one is cheaper.', ja: 'こちらのほうが安いです。' },
      { en: "It's the best option.", ja: 'いちばん良い選択肢です。' },
      { en: 'This is more useful than that.', ja: 'これはあれより役に立ちます。' },
      { en: "It's not as expensive as I thought.", ja: '思ったほど高くありません。' },
    ],
    tagIds: ['comparison'],
  },

  // ── 21〜30日目 … 言いたいことを長くする ────────────────────
  {
    no: 21,
    title: '不定詞(to + 原形) — したいこと・するために',
    aim: '目的や希望を1文で言える',
    points: [
      'want to / need to / try to / decide to のうしろは to + 原形',
      '「〜するために」も to + 原形(I came to see you.)',
      '「〜するもの」と名詞のうしろにも付く(something to eat)',
    ],
    examples: [
      { en: 'I want to ask you something.', ja: 'ひとつ伺いたいことがあります。' },
      { en: 'I came to see the manager.', ja: '店長に会いに来ました。' },
      { en: 'I need something to write with.', ja: '書くものが必要です。' },
      { en: "It's easy to use.", ja: '使いやすいです。' },
    ],
    tagIds: ['infinitive'],
  },
  {
    no: 22,
    title: '動名詞(-ing) — 「〜すること」',
    aim: '「〜するのが好き」が言える',
    points: [
      '動詞に -ing を付けると「〜すること」という名詞になる',
      'enjoy / finish / stop / mind のうしろは **-ing**(× enjoy to 〜)',
      'like / start / begin は、どちらでもよい',
      '前置詞のうしろは必ず -ing(good at cooking)',
    ],
    examples: [
      { en: 'I enjoy cooking.', ja: '料理をするのが楽しいです。' },
      { en: 'I finished writing the report.', ja: '報告書を書き終えました。' },
      { en: 'Thank you for coming.', ja: '来てくださってありがとうございます。' },
      { en: "I'm good at listening.", ja: '聞くのは得意です。' },
    ],
    tagIds: ['gerund'],
  },
  {
    no: 23,
    title: '接続詞 — 文をつなぐ',
    aim: '短い文を1つにまとめられる',
    points: [
      'and(そして)・but(でも)・so(だから)・or(または)',
      'because は理由。**答えるときは Because 〜 だけでもよい**',
      'つなぎ言葉を使うと、話が急に「大人っぽく」聞こえる',
    ],
    examples: [
      { en: 'I called him, but he was out.', ja: '電話しましたが、彼は外出中でした。' },
      { en: 'It was late, so I took a taxi.', ja: '遅かったので、タクシーに乗りました。' },
      { en: "I'm tired because I worked late.", ja: '遅くまで働いたので疲れています。' },
      { en: 'Tea or coffee?', ja: '紅茶とコーヒー、どちらにしますか。' },
    ],
    tagIds: ['conjunction'],
  },
  {
    no: 24,
    title: 'when と if — そのときは・もし〜なら',
    aim: '条件を付けて話せる',
    points: [
      'when は「〜のとき」、if は「もし〜なら」',
      '**その中では、未来のことでも現在形で言う**(× when I will arrive)',
      '前に置いても、うしろに置いてもよい。前に置いたらコンマを打つ',
    ],
    examples: [
      { en: "I'll call you when I arrive.", ja: '着いたら電話します。' },
      { en: 'If it rains, we will cancel.', ja: 'もし雨なら中止します。' },
      { en: 'Let me know if you need help.', ja: '手伝いが要るなら教えてください。' },
      { en: 'When I was a student, I lived in Kyoto.', ja: '学生のころ、京都に住んでいました。' },
    ],
    tagIds: ['time-clause'],
  },
  {
    no: 25,
    title: '助動詞 — 強さを変える',
    aim: '同じことを、丁寧にも強くも言える',
    points: [
      'must / have to(しなければならない)・should(したほうがよい)',
      'may / might(かもしれない)・would(〜だろう・丁寧)',
      'うしろは**必ず原形**',
      '**丁寧さは助動詞で決まる。** Can → Could → Would で柔らかくなる',
    ],
    examples: [
      { en: 'I have to leave now.', ja: 'もう出なければなりません。' },
      { en: 'You should ask him.', ja: '彼に訊いたほうがいいですよ。' },
      { en: 'It may take a week.', ja: '1週間かかるかもしれません。' },
      { en: 'Would you like to join us?', ja: 'ご一緒しませんか。' },
    ],
    tagIds: ['modal'],
  },
  {
    no: 26,
    title: '受動態 — されたことを言う',
    aim: '誰がしたかを言わずに済ませられる',
    points: [
      'be動詞 + 過去分詞',
      '**誰がしたかが分からない・言う必要がないとき**に使う',
      '言いたいときは by 〜 を足す',
      '仕事のメールでよく出る(It was sent / It is scheduled)',
    ],
    examples: [
      { en: 'The report was sent yesterday.', ja: '報告書は昨日送られました。' },
      { en: 'English is spoken here.', ja: 'ここでは英語が話されています。' },
      { en: 'The meeting is scheduled for Monday.', ja: '会議は月曜に予定されています。' },
      { en: 'It was made in Japan.', ja: '日本製です。' },
    ],
    tagIds: ['passive'],
  },
  {
    no: 27,
    title: '現在完了 — 経験・ずっと・もう',
    aim: '「〜したことがある」「もう〜した」が言える',
    points: [
      'have / has + 過去分詞',
      '経験(I have been to 〜)・継続(I have lived here for 〜)・完了(I have finished)',
      '**yesterday のような「いつ」とは一緒に使えない。** そのときは過去形',
      'ever / never / already / yet と一緒によく出る',
    ],
    examples: [
      { en: 'I have been to London.', ja: 'ロンドンへ行ったことがあります。' },
      { en: 'I have worked here for five years.', ja: 'ここで5年働いています。' },
      { en: 'Have you finished yet?', ja: 'もう終わりましたか。' },
      { en: "I've never tried it.", ja: '一度も試したことがありません。' },
    ],
    tagIds: ['tense'],
  },
  {
    no: 28,
    title: '関係代名詞 — 人やものを説明する',
    aim: '名詞にうしろから説明を足せる',
    points: [
      '人には who、ものには which、どちらでも that が使える',
      '**日本語と順番が逆。** 英語は名詞のうしろから説明する',
      '「〜を」に当たるときは、省いてもよい(the book I read)',
    ],
    examples: [
      { en: 'The man who called you is here.', ja: 'あなたに電話した人が来ています。' },
      { en: 'This is the file which I sent.', ja: 'これが私の送ったファイルです。' },
      { en: 'I know a place that serves good coffee.', ja: 'おいしいコーヒーの店を知っています。' },
      { en: 'The book I read was great.', ja: '私が読んだ本はとても良かったです。' },
    ],
    tagIds: ['relative-pronoun'],
  },
  {
    no: 29,
    title: 'that 節と間接疑問 — 「〜だと思います」',
    aim: '自分の考えを、やわらかく伝えられる',
    points: [
      'I think (that) 〜 で、そのあとに文をまるごと置ける。that は省いてよい',
      '**間接疑問では、語順がふつうの文に戻る**(× I don\'t know where is it)',
      'I\'m not sure / I\'m afraid を前に置くと、やわらかくなる',
    ],
    examples: [
      { en: 'I think it will work.', ja: 'うまくいくと思います。' },
      { en: "I don't know where he is.", ja: '彼がどこにいるか分かりません。' },
      { en: 'Do you know what this means?', ja: 'これがどういう意味か分かりますか。' },
      { en: "I'm afraid I can't make it.", ja: '申し訳ありませんが、行けません。' },
    ],
    tagIds: ['reported-speech'],
  },
  {
    no: 30,
    title: '総まとめ — 会話でそのまま使う型',
    aim: '30日ぶんを、その場で組み立てて言える',
    points: [
      'ここまでの型を組み合わせれば、日常と仕事の会話はほぼ足りる',
      '**言えなかった型を1つだけ選んで、そこから教材を作る**',
      '完璧に言うより、止まらずに言い直すほうが伝わる',
    ],
    examples: [
      { en: "I'm sorry, could you say that again?", ja: 'すみません、もう一度おっしゃっていただけますか。' },
      { en: "I think we should ask him, because he knows the details.", ja: '彼に訊くべきだと思います。詳しいので。' },
      { en: "I've been working on it, but it isn't finished yet.", ja: '取り組んでいますが、まだ終わっていません。' },
      { en: 'If you have time tomorrow, I would like to talk about it.', ja: '明日お時間があれば、その件をお話ししたいです。' },
    ],
    tagIds: ['sentence-pattern'],
  },
]

/** 何日あるか。**画面で数え直さない** */
export const COURSE_LENGTH = COURSE_DAYS.length

/**
 * コースは2段(2026-09 利用者の指定)。
 *
 *   > 超初心者は「厳選360」初心者は「中学英語1200」と2段組で。
 *   > コンセプトはコミュニケーションのため。
 *
 * **文法の30日は、どちらの段でも同じ。** 違うのは**語の数**だけである。
 * 文法の仕組みは「超初心者だから半分」にはできない ——
 * be動詞を知らずに疑問文は作れないので、削ると穴が空く。
 *
 * @property words 1日あたりの語数(`basicWords.js` の `core` で絞る)
 */
export const COURSE_TIERS = [
  {
    id: 'core',
    label: '厳選360',
    ja: 'まず、これだけ',
    hint: '1日 12 語。**話すために本当に要る語だけ**を選んである',
    levels: ['Pre-Basic'],
  },
  {
    id: 'full',
    label: '中学英語1200',
    ja: '中学英語をひととおり',
    hint: '1日 40 語。厳選360 を含む',
    levels: ['Basic'],
  },
]

/** 知らない id は、いちばんやさしい段に落とす(**行き止まりを作らない**) */
export const tierOf = (id) => COURSE_TIERS.find((t) => t.id === id) ?? COURSE_TIERS[0]

/**
 * そのレベルに合う段。**決めつけず、初めの1つを選んでおくだけ。**
 * ゲストは画面でいつでも切り替えられる。
 */
export function tierForLevel(level) {
  const hit = COURSE_TIERS.find((t) => t.levels.includes(String(level ?? '')))
  return (hit ?? COURSE_TIERS[0]).id
}

/** 何日目の中身か。**範囲の外は null**(当てずっぽうで返さない) */
export const dayOf = (no) => COURSE_DAYS.find((d) => d.no === Number(no)) ?? null
