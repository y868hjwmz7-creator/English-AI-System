/**
 * **文法タグごとの、区切りのお手本**(第5.241節・2026-09-23 利用者の指定)。
 *
 * ════════════════════════════════════════════════════════════════
 *   > 間違えている区切りをその度に送るのは時間がかかり過ぎます。
 *   > **中学英文法の文法タグ**がありますよね。それらの文法を鑑みれば
 *   > 区切り方のルールをさらに精度上げることができるはずです。
 *
 * 【なぜ「データ」として置くか】
 *
 *   区切りの決まり(`chunker.js`)は 1,200 行あり、**どの文法まで
 *   面倒を見ているのかが、読んでも分からない。**
 *   だから**文法タグ1つにつき例文を1つ**置き、
 *   「ここでは切ってはいけない」「ここでは切る」を書いておく。
 *
 *   `npm run test:chunk` が、**37 のタグすべてに例文があるか**を見る。
 *   **タグを足した日に、検証が赤くなる**(書き足さないと通らない)——
 *   「一覧は `seed_rows.sql` に書かない。制約から読み取る」と同じ考え方。
 *
 * 【`keep` と `cut`】
 *
 *   ・`keep` … **この中では切らない。** 文法上ひとかたまりのもの
 *   ・`cut`  … **この語の前では切る。** 意味の切れ目
 *
 *   **両方を書く**(CLAUDE.md「出ると出ないの両方を見る」)——
 *   `keep` だけだと「どこにも切らない」形に書き換えても緑のまま、
 *   `cut` だけだと「全部に切る」形でも緑のままになる。
 *
 * 【例文の作り方】
 *
 *   ・**その文法が主役になる、短いビジネスの文**にする
 *   ・**`keep` は、中学英文法で「ひとかたまり」と教える単位**だけにする。
 *     好みで広げない —— 広げると、正しい区切りまで咎めることになる
 * ════════════════════════════════════════════════════════════════
 *
 * @property {string} tag  `weaknessTags.js` の文法タグの id
 * @property {string} en   例文
 * @property {string[]} keep この中では切らない(語の並びで書く)
 * @property {string[]} cut  この語の前では切る
 */
export const GRAMMAR_SLASH = [
  /* ── 名詞のまわり ───────────────────────────────── */
  {
    tag: 'article', en: 'The new manager approved the final plan.',
    keep: ['The new manager', 'the final plan'], cut: ['approved'],
  },
  {
    tag: 'preposition', en: 'We talked about the budget in the meeting.',
    keep: ['about the budget', 'in the meeting'], cut: ['in'],
  },
  {
    tag: 'number-agreement', en: 'These reports need a final check.',
    keep: ['These reports', 'a final check'], cut: ['a'],
  },
  {
    tag: 'quantity', en: 'We have a few questions and a little time.',
    keep: ['a few questions', 'a little time'], cut: ['and'],
  },
  {
    tag: 'numerals', en: 'Sales grew by ninety thousand dollars last year.',
    keep: ['ninety thousand dollars'], cut: ['by'],
  },
  {
    tag: 'pronoun', en: 'We gave it to them yesterday.',
    keep: ['to them'], cut: ['it'],
  },
  {
    tag: 'nominalization', en: 'Our decision to postpone the launch surprised them.',
    keep: ['to postpone'], cut: ['surprised'],
  },
  {
    tag: 'inanimate-subject', en: 'This tool allows you to share files quickly.',
    keep: ['to share'], cut: ['to'],
  },

  /* ── 動詞のまわり ───────────────────────────────── */
  {
    tag: 'tense', en: 'We have finished the quarterly report.',
    keep: ['have finished', 'the quarterly report'], cut: ['have'],
  },
  {
    tag: 'passive', en: 'The report was written by the sales team.',
    keep: ['was written', 'by the sales team'], cut: ['was', 'by'],
  },
  {
    tag: 'modal', en: 'We should send the draft today.',
    keep: ['should send'], cut: ['should'],
  },
  {
    tag: 'be-verb', en: 'The numbers are correct this time.',
    keep: ['are correct'], cut: ['are'],
  },
  {
    tag: 'verb-form', en: 'He keeps asking the same question.',
    keep: ['keeps asking'], cut: ['the'],
  },
  {
    tag: 'gerund', en: 'They stopped guessing and asked us directly.',
    keep: ['stopped guessing'], cut: ['and'],
  },
  {
    tag: 'infinitive', en: 'We need to review the contract again.',
    keep: ['to review'], cut: ['the'],
  },
  {
    tag: 'negation', en: 'We did not agree with the new terms.',
    keep: ['did not agree'], cut: ['did', 'with'],
  },
  {
    tag: 'future', en: 'We are going to launch the service next month.',
    keep: ['are going to launch'], cut: ['are'],
  },
  {
    tag: 'third-person', en: 'She handles the overseas accounts.',
    keep: ['the overseas accounts'], cut: ['the'],
  },
  {
    /* **`it work`(目的語 + 原形)は割らない。**
       `make / it work` と動詞の前で切れるのは**わざと**である
       (動詞と目的語を切る決まり)。中学文法で割ってはいけないのは、
       目的語と原形のほうである */
    tag: 'causative', en: 'We will make it work before Friday.',
    keep: ['it work'], cut: ['it'],
  },

  /* ── 文のかたち ─────────────────────────────────── */
  {
    tag: 'sentence-pattern', en: 'Our manager called the plan risky.',
    keep: ['Our manager'], cut: ['called'],
  },
  {
    tag: 'there-is', en: 'There are two options on the table.',
    keep: ['There are'], cut: ['on'],
  },
  {
    tag: 'question', en: 'Did you send the invoice yesterday?',
    keep: ['Did you send'], cut: ['the'],
  },
  {
    tag: 'imperative', en: 'Please send the file by Friday.',
    keep: ['Please send'], cut: ['the'],
  },
  {
    tag: 'word-order', en: 'I do not know where he went.',
    keep: ['do not know'], cut: ['where'],
  },
  {
    /* **`It / was` と切れるのは、わざとである**(主語と動詞を切り、
       動詞から先に訳す決まり)。ここで見たいのは
       **`that` の前で切れているか**のほうである */
    tag: 'emphasis', en: 'It was the price that worried them.',
    keep: ['the price'], cut: ['that'],
  },
  {
    tag: 'ellipsis', en: 'Sounds good to me.',
    keep: ['Sounds good'], cut: [],
  },

  /* ── 節をつなぐ ─────────────────────────────────── */
  {
    tag: 'conjunction', en: 'We agreed, but the client asked for more time.',
    keep: ['the client'], cut: ['but'],
  },
  {
    /* **`called / us` と切れるのは、わざとである**(動詞と目的語を切る)。
       関係代名詞で見たいのは、**`who` が次のまとまりの先頭に立つ**ことである */
    tag: 'relative-pronoun', en: 'The client who called us wants a demo.',
    keep: ['who called'], cut: ['who'],
  },
  {
    tag: 'relative-adverb', en: 'This is the room where we meet every Monday.',
    keep: ['where we meet'], cut: ['where'],
  },
  {
    /* **`I / were` と切れるのは、わざとである**(主語と動詞を切る)。
       仮定法で見たいのは、**`If` が次のまとまりの先頭に立つ**ことである */
    tag: 'subjunctive', en: 'If I were you, I would wait one more week.',
    keep: ['If I'], cut: ['If'],
  },
  {
    tag: 'time-clause', en: 'When the budget is ready, we will start the work.',
    keep: ['When the budget'], cut: ['When'],
  },
  {
    tag: 'reported-speech', en: 'He said that the deal was closed.',
    keep: ['the deal'], cut: ['that'],
  },

  /* ── 分詞・比較・副詞 ───────────────────────────── */
  {
    /* **`raised / by the fund` と切れるのは、わざとである**
       (前置詞 + 名詞でひとかたまり)。分詞で見たいのは、
       **`raised` の前で切れる**ことと、前の名詞と1つに潰れないことである */
    tag: 'participle', en: 'The money raised by the fund was not enough.',
    keep: ['by the fund', 'was not enough'], cut: ['raised'],
  },
  {
    /* **`Walking / to the station` と切れるのは、わざとである**
       (前置詞 + 名詞)。分詞構文で見たいのは、
       **読点のところで主節と切れる**ことである */
    tag: 'participial-clause', en: 'Walking to the station, I saw the new sign.',
    keep: ['to the station'], cut: ['I'],
  },
  {
    tag: 'participial-adj', en: 'The result was surprising to everyone.',
    keep: ['was surprising'], cut: ['was', 'to'],
  },
  {
    /* **2つめの `as` の前で切れるのは、わざとである**
       (`than` と同じ「比べる相手」の決まり)。
       見たいのは、**1つめの `as` と形容詞が離れない**ことである */
    tag: 'comparison', en: 'This plan is as safe as the old one.',
    keep: ['as safe'], cut: ['is'],
  },
  {
    tag: 'adverb-form', en: 'She writes very clearly in every report.',
    keep: ['very clearly'], cut: ['in'],
  },
]
