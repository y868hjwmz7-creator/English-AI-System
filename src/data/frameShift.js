/**
 * **型シフト — 同じ内容を、別の型で言い直す**(2026-09 利用者の指定)。
 *
 *   > 画期的なトレーニングを作りたいです
 *
 * ============================================================================
 * 【何が新しいのか】
 *
 *   パタプラ・スピフルは「**語**を入れ替える」練習である。
 *   瞬間英作文は「和文 → 英文」の**1対1**である。
 *   ここでやるのは「**型**を入れ替える」——
 *   1つの内容を、指定された型で言い直す。
 *
 *   **そして、言い直した文が本当にその型かを機械で採点できる。**
 *   `src/lib/frameMatch.js` が 66 型を決まりで見分けるからである
 *   (見本 66 / 66 を言い当てる・`npm run test:frame`)。
 *   **AI を呼ばないので 0円。**
 *
 * 【なぜファイルに持つのか】
 *
 *   Native Flow(`nativeFlow.js`)・コロケーション(`collocations.js`)と
 *   まったく同じ考え方である。**表も列も RPC も1つも増やさない。**
 *   お題はここ、覚え具合は既存の仕組み、画面は props だけ。
 *
 * 【なぜ「素の文」を見せるのか】
 *
 *   日本語だけを出すと「和文英訳」になり、**訳せたかどうか**の練習に戻る。
 *   ここで鍛えたいのは**言い換える力**なので、
 *   **言える形(素の文)を先に見せて、そこから型へ移してもらう。**
 *   素の文そのものは 66 型のどれでもない ——
 *   だから `frameMatch` は素の文を「型なし」と返す(それが正しい)。
 *
 * 【型の名前を、ここで作らない】
 *
 *   `form` は `src/data/sentenceFrames.js` の `form` と**1文字も違えない。**
 *   違えると「型が2つある」ことになり、どちらが本物か分からなくなる
 *   (`docs/sentence-frames.html` と `sentenceFrames.js` を
 *   `npm run test:play` が突き合わせているのと同じ理由)。
 *   `npm run test:shift` が機械で見張る。
 *
 * 【66 型を1つも落とさない】
 *
 *   最初の版から**66 型すべてに、少なくとも1つの答えがある。**
 *   あとから問を増やすときに「型の抜け」から直すのは大変だからである。
 *   `npm run test:shift` が、抜けた型があれば赤くする
 *   (**一覧を勝手に減らさない**・`.claude/rules/common.md`)。
 *
 * 【実在の名前を入れない】
 *
 *   `speechStyles.js` / `sentenceFrames.js` と同じ決まり。
 *   会社名・人名・商品名は書かない。
 *
 * @property id     問の id。**変えない**(覚え具合がこれで付く)
 * @property scene  仕事の場面。絞り込みに使う
 * @property ja     伝えたい内容(日本語)。**素の文の直訳ではなく、言いたいこと**
 * @property base   素の文。**66 型のどれでもない、ふつうの言い方**
 * @property shifts 言い直す先。`form` は `sentenceFrames.js` のものと同じ文字列
 */

/** 仕事の場面。**並べ替えない・減らさない**(絞り込みの札になる) */
export const SHIFT_SCENES = [
  { id: 'meeting', label: '会議' },
  { id: 'mail', label: 'メール' },
  { id: 'report', label: '報告' },
  { id: 'nego', label: '交渉' },
  { id: 'trouble', label: 'トラブル対応' },
  { id: 'talk', label: '面談・雑談' },
]

export const FRAME_SHIFTS = [
  {
    id: 'fs-01', scene: 'meeting',
    ja: 'この道具を使えば、その場でファイルを渡せる、と伝える',
    base: 'With this tool, you can share files right away.',
    shifts: [
      { form: 'S allows 人 to do', ex: 'This tool allows you to share files instantly.' },
      { form: 'S enables 人 to do', ex: 'This tool enables you to share files instantly.' },
      { form: 'S helps 人 (to) do', ex: 'This tool helps you share files instantly.' },
    ],
  },
  {
    id: 'fs-02', scene: 'talk',
    ja: '彼の一言で、チームがもう一度やってみる気になった',
    base: 'After he spoke, the team decided to try again.',
    shifts: [
      { form: 'S encourages 人 to do', ex: 'His words encouraged the team to try again.' },
      { form: 'S inspires 人 to do', ex: 'His words inspired the team to try again.' },
      { form: 'S prompts 人 to do', ex: 'His comment prompted the team to try again.' },
    ],
  },
  {
    id: 'fs-03', scene: 'report',
    ja: '数字を見て、方針を変えることにした',
    base: 'We saw the numbers, so we changed the plan.',
    shifts: [
      { form: 'S leads 人 to do', ex: 'The numbers led us to change the plan.' },
      { form: 'S forces 人 to do', ex: 'The numbers forced us to change the plan.' },
      { form: 'S makes 人 do(原形)', ex: 'The numbers made us change the plan.' },
    ],
  },
  {
    id: 'fs-04', scene: 'talk',
    ja: '失敗が怖くて発言できない人が多い',
    base: 'Many people are afraid of mistakes, so they do not speak up.',
    shifts: [
      { form: 'S keeps 人 from ~ing', ex: 'Fear of mistakes keeps many people from speaking up.' },
      { form: 'S prevents 人 from ~ing', ex: 'Fear of mistakes prevents many people from speaking up.' },
      { form: 'S stops 人 from ~ing', ex: 'Fear of mistakes stops many people from speaking up.' },
      { form: 'S discourages 人 from ~ing', ex: 'Fear of mistakes discourages many people from speaking up.' },
    ],
  },
  {
    id: 'fs-05', scene: 'meeting',
    ja: 'この仕事には、3つのチームの調整が要る',
    base: 'For this job, we have to coordinate three teams.',
    shifts: [
      { form: 'S requires 名詞', ex: 'This job requires careful coordination.' },
      { form: 'S involves ~ing', ex: 'This job involves coordinating three teams.' },
      { form: 'S calls for 名詞', ex: 'This job calls for close coordination.' },
    ],
  },
  {
    id: 'fs-06', scene: 'mail',
    ja: '毎週かんたんな報告を出してほしい、と頼む',
    base: 'Everyone has to report once a week on this project.',
    shifts: [
      { form: 'S requires 人 to do', ex: 'This project requires everyone to report weekly.' },
      { form: 'All 人 have to do is do', ex: 'All you have to do is send a short note on Friday.' },
    ],
  },
  {
    id: 'fs-07', scene: 'meeting',
    ja: '準備に3週間かかる、と伝える',
    base: 'We need three weeks to get ready.',
    shifts: [
      { form: 'It takes 時間 to do', ex: 'It takes three weeks to get ready.' },
      { form: 'S takes (人) 時間 to do', ex: 'The setup takes us three weeks to finish.' },
    ],
  },
  {
    id: 'fs-08', scene: 'trouble',
    ja: '準備が足りなかったせいで、遅れが出た',
    base: 'We did not prepare enough, so the project was late.',
    shifts: [
      { form: 'S causes 名詞', ex: 'Poor preparation caused the delay.' },
      { form: 'S leads to 名詞', ex: 'Poor preparation leads to delays.' },
      { form: 'S results in 名詞', ex: 'Poor preparation resulted in a long delay.' },
    ],
  },
  {
    id: 'fs-09', scene: 'report',
    ja: '新しい商品のおかげで、お客さんが200人増えた',
    base: 'We started the new line and got 200 new customers.',
    shifts: [
      { form: 'S brings 人 名詞', ex: 'The new line brought us 200 new customers.' },
    ],
  },
  {
    id: 'fs-10', scene: 'trouble',
    ja: '遅れのせいで、みんなが落ち着かず、時間も足りない',
    base: 'Because of the delay, we had no time left.',
    shifts: [
      { form: 'S makes 人 形容詞', ex: 'The delay made everyone nervous.' },
      { form: 'S leaves 人 形容詞', ex: 'The delay left us short on time.' },
    ],
  },
  {
    id: 'fs-11', scene: 'talk',
    ja: '毎日練習していれば、英語はなまらない',
    base: 'If you practice every day, your English stays sharp.',
    shifts: [
      { form: 'S keeps 人/物 形容詞', ex: 'Regular practice keeps your English sharp.' },
    ],
  },
  {
    id: 'fs-12', scene: 'report',
    ja: 'データを見ると、需要が伸びている',
    base: 'Look at the data. Demand is rising.',
    shifts: [
      { form: 'S shows / suggests (that) ~', ex: 'The data shows that demand is rising.' },
      { form: 'Based on ~', ex: 'Based on the data, demand is rising.' },
    ],
  },
  {
    id: 'fs-13', scene: 'mail',
    ja: '締め切りが金曜だということを、もう一度伝える',
    base: 'Do not forget that the deadline is Friday.',
    shifts: [
      { form: 'S reminds 人 that ~', ex: 'This email reminds everyone that the deadline is Friday.' },
    ],
  },
  {
    id: 'fs-14', scene: 'meeting',
    ja: '彼が遅れたのは、電車に乗り遅れたからだ',
    base: 'He was late because he missed the train.',
    shifts: [
      { form: 'S explains why ~', ex: 'That explains why he was late.' },
      { form: 'S is why ~', ex: 'This is why he was late.' },
      { form: 'The reason ~ is that …', ex: 'The reason he was late is that he missed the train.' },
    ],
  },
  {
    id: 'fs-15', scene: 'meeting',
    ja: '遠隔の道具があるので、どこの人でも採用できる',
    base: 'With remote tools, we can hire anywhere.',
    shifts: [
      { form: 'S makes it possible to do', ex: 'Remote tools make it possible to hire anywhere.' },
    ],
  },
  {
    id: 'fs-16', scene: 'trouble',
    ja: '騒音がひどくて、集中できなかった',
    base: 'I could not focus because of the noise.',
    shifts: [
      { form: 'S makes it hard for 人 to do', ex: 'The noise made it hard for me to focus.' },
    ],
  },
  {
    id: 'fs-17', scene: 'meeting',
    ja: '二度確かめたほうがよい、とやわらかく言う',
    base: 'We should check it twice.',
    shifts: [
      { form: '形式主語 it', ex: 'It is important to check twice.' },
      { form: 'It might be worth ~ing', ex: 'It might be worth checking twice.' },
      { form: 'We may want to ~', ex: 'We may want to check it twice.' },
    ],
  },
  {
    id: 'fs-18', scene: 'meeting',
    ja: '二段階に分けてはどうか、と提案する',
    base: 'Let us split it into two phases.',
    shifts: [
      { form: 'What if we ~', ex: 'What if we split it into two phases?' },
      { form: 'Would it be possible to ~', ex: 'Would it be possible to split it into two phases?' },
    ],
  },
  {
    id: 'fs-19', scene: 'mail',
    ja: '今日中に送ってほしい、とていねいに頼む',
    base: 'Please send it today.',
    shifts: [
      { form: 'I was wondering if you could ~', ex: 'I was wondering if you could send it today.' },
    ],
  },
  {
    id: 'fs-20', scene: 'report',
    ja: '手を抜くと、いまは早いが、あとで高くつく',
    base: 'If you cut corners, you save time now but pay more later.',
    shifts: [
      { form: '動名詞', ex: 'Cutting corners saves time now but costs more later.' },
    ],
  },
  {
    id: 'fs-21', scene: 'talk',
    ja: '彼女が辞めると決めたことに、みんな驚いた',
    base: 'She decided to leave, and everyone was surprised.',
    shifts: [
      { form: '名詞化(動詞→名詞)', ex: 'Her decision to leave surprised everyone.' },
    ],
  },
  {
    id: 'fs-22', scene: 'talk',
    ja: '大事なのは、続けることだ',
    base: 'Being consistent is the important thing.',
    shifts: [
      { form: 'what 節', ex: 'What matters is consistency.' },
    ],
  },
  {
    id: 'fs-23', scene: 'trouble',
    ja: '誰も質問しなかったことが、かえって気になる',
    base: 'No one asked, and that worries me.',
    shifts: [
      { form: 'the fact that', ex: 'The fact that no one asked worries me.' },
    ],
  },
  {
    id: 'fs-24', scene: 'talk',
    ja: '彼の説明の仕方が、腑に落ちた',
    base: 'He explained it well, and I understood.',
    shifts: [
      { form: 'the way / the reason', ex: 'The way he explained it made sense.' },
    ],
  },
  {
    id: 'fs-25', scene: 'nego',
    ja: '気になっているのは値段だ、と伝える',
    base: 'The price worries me.',
    shifts: [
      { form: 'It is X that / who ~', ex: 'It is the price that worries me.' },
      { form: 'What ~ is …', ex: 'What worries me is the price.' },
      { form: 'When it comes to ~', ex: 'When it comes to price, I have some concerns.' },
    ],
  },
  {
    id: 'fs-26', scene: 'mail',
    ja: '予定については、変わっていない',
    base: 'The schedule has not changed.',
    shifts: [
      { form: 'As for ~', ex: 'As for the schedule, nothing has changed.' },
      { form: 'In terms of ~', ex: 'In terms of the schedule, nothing has changed.' },
    ],
  },
  {
    id: 'fs-27', scene: 'nego',
    ja: '予算を考えると、いまは待つべきだ',
    base: 'We should wait because the budget is tight.',
    shifts: [
      { form: 'Given (that) ~', ex: 'Given the budget, we should wait.' },
    ],
  },
  {
    id: 'fs-28', scene: 'meeting',
    ja: '予定に問題がある、と切り出す',
    base: 'The schedule has a problem.',
    shifts: [
      { form: 'There is / are ~', ex: 'There is a problem with the schedule.' },
    ],
  },
  {
    id: 'fs-29', scene: 'report',
    ja: '人手が足りない。だから早く始める必要がある',
    base: 'We are short-staffed. We need to start earlier.',
    shifts: [
      { form: 'Which means ~', ex: 'We are short-staffed, which means we need to start earlier.' },
      { form: "That's why ~", ex: 'That is why we need to start earlier.' },
    ],
  },
  {
    id: 'fs-30', scene: 'nego',
    ja: '高いけれども、試す価値はある',
    base: 'It is expensive, but it is still worth trying.',
    shifts: [
      { form: 'That said, ~', ex: 'It is expensive. That said, it is still worth trying.' },
    ],
  },
  {
    id: 'fs-31', scene: 'report',
    ja: '時間だけでなく、費用も減った',
    base: 'It cut the time and the cost.',
    shifts: [
      { form: 'Not only ~ but also …', ex: 'Not only did it save time, but it also cut costs.' },
    ],
  },
  {
    id: 'fs-32', scene: 'report',
    ja: '昨日送った報告書のことだ、と指す',
    base: 'We sent the report yesterday. I mean that one.',
    shifts: [
      { form: '関係詞', ex: 'the report that we sent yesterday' },
      { form: '過去分詞', ex: 'the report sent yesterday' },
    ],
  },
  {
    id: 'fs-33', scene: 'meeting',
    ja: 'いま対応しているチームのことだ、と指す',
    base: 'A team is working on it. I mean that team.',
    shifts: [
      { form: '現在分詞', ex: 'the team working on it' },
    ],
  },
  {
    id: 'fs-34', scene: 'report',
    ja: '目標は20%増だ、と言い足す',
    base: 'Our goal is a 20% increase.',
    shifts: [
      { form: '同格', ex: 'our goal, a 20% increase' },
    ],
  },
  {
    id: 'fs-35', scene: 'report',
    ja: 'データを見たうえで、待つことにした',
    base: 'We reviewed the data and decided to wait.',
    shifts: [
      { form: '分詞構文', ex: 'Having reviewed the data, we decided to wait.' },
    ],
  },
  {
    id: 'fs-36', scene: 'nego',
    ja: '問題は費用ではなく、時期のほうだ',
    base: 'Timing matters more than cost.',
    shifts: [
      { form: 'less about A than B', ex: 'It is less about cost than timing.' },
      { form: 'not A but B', ex: 'It is not a cost issue but a timing issue.' },
      { form: 'A rather than B', ex: 'It is a timing issue rather than a cost issue.' },
    ],
  },
  {
    id: 'fs-37', scene: 'talk',
    ja: '練習すればするほど、速く言えるようになる',
    base: 'If you practice more, you improve faster.',
    shifts: [
      { form: 'The 比較級, the 比較級', ex: 'The more we practice, the faster we improve.' },
    ],
  },
]

/** 問の数(お題の数ではなく、**言い直す答えの数**) */
export const shiftCount = () =>
  FRAME_SHIFTS.reduce((n, t) => n + t.shifts.length, 0)
