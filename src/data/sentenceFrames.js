/**
 * 英文の「型」— **単語帳の巻末に刷るレクチャーの中身**(2026-09 利用者の指定)。
 *
 *   > そして、単語帳の巻末とか間、どこでもよいけど、このレクチャーを入れて
 *   > ただの単語帳ではなく、使いこなすことをイメージできる単語帳にしたい。
 *
 * 【なぜ単語帳に入れるか】
 *   単語帳は「語 → 訳」の対でしかない。**語を知っていても、
 *   どの型に入れて使うのかが分からなければ文にならない。**
 *   巻末に型の一覧があれば、覚えた語をその場で当てはめてみられる。
 *
 * 【`docs/sentence-frames.html` との関係】
 *   あちらは**トレーナーに渡す詳しい資料**(なぜその型が要るのか・
 *   教えるときの順番まで書いてある。`node scripts/make-frames-pdf.mjs` で
 *   PDF になる)。こちらは**ゲストが単語帳の裏で引く一覧**で、
 *   **型と例文だけ**に絞ってある。**役目が違うので、2つとも要る。**
 *
 *   ただし**型そのものが食い違うと、言っていることが2つになる。**
 *   だから `npm run test:play` が、ここに並べた型が
 *   `docs/sentence-frames.html` にも在ることを機械的に確かめる ——
 *   **片方に足して、もう片方に足し忘れる**ことが起こりえない。
 *
 * 【なぜ `src/data/` に置くか】
 *   画面(JSX)の中に書くと**素の node で一度も数えられない**
 *   (`playMark.js` / `materialKinds.js` と同じ考え方)。
 *
 * 【一覧を勝手に減らさない】
 *   一度入れた型は、指示がないかぎり消さない・並べ替えない
 *   (業種・趣味・声の名簿と同じ・`.claude/rules/common.md`)。
 *
 * @property form 型。**日本語の「人」「名詞」を混ぜたまま**にする ——
 *                `S allows 人 to do` のほうが、英語だけで書くより速く読める
 * @property ex   例文。**実在の人物や会社の名前を入れない**(`speechStyles.js` と同じ決まり)
 */

export const FRAME_SECTIONS = [
  {
    id: 'inanimate',
    no: '①',
    label: '無生物主語 — 覚えるのは「主語」ではなく「動詞」',
    lead:
      'うしろに人を目的語として取れる動詞を使うと、主語の席が空きます。'
      + 'そこへ「こと・もの」を入れたものが無生物主語です。'
      + 'だから覚えるのは主語ではなく、うしろに続く形まで含めた動詞のほうです。',
    groups: [
      {
        id: 'push',
        label: '1. させる(背中を押す)',
        rows: [
          { form: 'S allows 人 to do', ex: 'This tool allows you to share files instantly.', ja: 'この道具を使えば、ファイルをすぐに共有できます。' },
          { form: 'S enables 人 to do', ex: 'The update enabled us to cut the cost in half.', ja: '更新のおかげで、費用を半分にできました。' },
          { form: 'S helps 人 (to) do', ex: 'The training helped the team work faster.', ja: 'その研修で、チームの仕事が速くなりました。' },
          { form: 'S encourages 人 to do', ex: 'The results encouraged us to expand.', ja: '結果が良かったので、私たちは拡大に踏み切りました。' },
          { form: 'S inspires 人 to do', ex: 'Working overseas inspired her to learn Spanish.', ja: '海外勤務がきっかけで、彼女はスペイン語を学び始めました。' },
          { form: 'S leads 人 to do', ex: 'The delay led us to rethink the schedule.', ja: '遅れたことで、私たちは予定を考え直しました。' },
          { form: 'S prompts 人 to do', ex: 'The complaint prompted us to review the process.', ja: 'その苦情をきっかけに、私たちは手順を見直しました。' },
          { form: 'S forces 人 to do', ex: 'Rising costs forced them to raise prices.', ja: '費用が上がり、彼らは値上げせざるを得ませんでした。' },
          { form: 'S makes 人 do(原形)', ex: 'The music made everyone relax.', ja: 'その音楽で、みんながくつろぎました。' },
        ],
      },
      {
        id: 'block',
        label: '2. させない(妨げる)',
        // **4つとも `from + ~ing`。** ばらばらに覚えると、本番で
        // `to` と取り違える。1つの型として一度に渡す(資料の指摘そのまま)
        note: '4つとも from + ~ing です。ばらばらに覚えると to と取り違えます。',
        rows: [
          { form: 'S keeps 人 from ~ing', ex: 'Fear of mistakes keeps many people from speaking up.', ja: '間違いを恐れて、多くの人が発言できずにいます。' },
          { form: 'S prevents 人 from ~ing', ex: 'The rain prevented us from starting on time.', ja: '雨のせいで、時間どおりに始められませんでした。' },
          { form: 'S stops 人 from ~ing', ex: 'Nothing is stopping you from asking.', ja: '聞いてはいけない理由は、何もありません。' },
          { form: 'S discourages 人 from ~ing', ex: 'The long form discourages people from applying.', ja: '用紙が長いので、応募をためらわせています。' },
        ],
      },
      {
        id: 'need',
        label: '3. 要る・かかる',
        rows: [
          { form: 'S requires 名詞', ex: 'Learning a language requires patience.', ja: '言語を学ぶには、忍耐が要ります。' },
          { form: 'S requires 人 to do', ex: 'This project requires everyone to report weekly.', ja: 'この案件では、全員が毎週報告する必要があります。' },
          { form: 'S takes (人) 時間 to do', ex: 'It took us three days to fix the bug.', ja: 'その不具合を直すのに、3日かかりました。' },
          { form: 'S involves ~ing', ex: 'The role involves traveling twice a month.', ja: 'この職務には、月2回の出張が含まれます。' },
          { form: 'S calls for 名詞', ex: 'The situation calls for a quick decision.', ja: 'この状況では、早い決断が必要です。' },
        ],
      },
      {
        id: 'result',
        label: '4. もたらす(結果)',
        rows: [
          { form: 'S causes 名詞', ex: 'The update caused several errors.', ja: 'その更新が、いくつかの不具合を引き起こしました。' },
          { form: 'S leads to 名詞', ex: 'Poor planning leads to delays.', ja: '計画が甘いと、遅れにつながります。' },
          { form: 'S results in 名詞', ex: 'The change resulted in a 10% drop.', ja: 'その変更の結果、10%下がりました。' },
          { form: 'S brings 人 名詞', ex: 'The new line brought us 200 new customers.', ja: '新商品によって、新規のお客様が200人増えました。' },
        ],
      },
      {
        id: 'state',
        label: '5. 人を、ある状態にする',
        rows: [
          { form: 'S makes 人 形容詞', ex: 'The news made everyone nervous.', ja: 'その知らせで、みんな不安になりました。' },
          { form: 'S leaves 人 形容詞', ex: 'The delay left us short on time.', ja: '遅れのせいで、時間が足りなくなりました。' },
          { form: 'S keeps 人/物 形容詞', ex: 'Regular practice keeps your English sharp.', ja: '練習を続けていれば、英語は鈍りません。' },
        ],
      },
      {
        id: 'show',
        label: '6. 示す・説明する(会議で頻出)',
        rows: [
          { form: 'S shows / suggests (that) ~', ex: 'The data shows that demand is rising.', ja: 'このデータは、需要が伸びていることを示しています。' },
          { form: 'S explains why ~', ex: 'That explains why he was late.', ja: 'それで、彼が遅れた理由が分かりました。' },
          { form: 'S is why ~', ex: 'This is why we changed suppliers.', ja: 'こういう事情で、取引先を変えました。' },
          { form: 'S reminds 人 that ~', ex: 'The chart reminds us that growth has slowed.', ja: 'この図を見ると、成長が鈍ったことが分かります。' },
        ],
      },
      {
        id: 'it',
        label: '7. it を立てる形(無生物主語の親戚)',
        rows: [
          { form: 'S makes it possible to do', ex: 'Remote tools make it possible to hire anywhere.', ja: '遠隔の道具のおかげで、どこでも採用できます。' },
          { form: 'S makes it hard for 人 to do', ex: 'The noise made it hard for me to focus.', ja: '騒音のせいで、集中しづらかったです。' },
          { form: 'It takes 時間 to do', ex: 'It takes three months to see results.', ja: '成果が出るまでに、3か月かかります。' },
        ],
      },
    ],
  },
  {
    id: 'subject',
    no: '②',
    label: '主語の席に、何を入れるか',
    lead:
      'cut corners → cutting corners の動名詞化は、そのうちの1つです。'
      + '動詞を名詞のかたまりに変えることが、そのまま主語を作る手立てになります(名詞構文)。',
    groups: [
      {
        id: 'ways',
        label: '6つの手立て',
        rows: [
          { form: '動名詞', ex: 'Cutting corners saves time now but costs more later.', ja: '手を抜けば今は速いですが、あとで高くつきます。' },
          { form: '名詞化(動詞→名詞)', ex: 'Her decision to leave surprised everyone.', ja: '彼女が辞めると決めたことに、みんな驚きました。' },
          { form: 'what 節', ex: 'What matters is consistency.', ja: '大事なのは、続けることです。' },
          { form: 'the fact that', ex: 'The fact that no one asked worries me.', ja: '誰も質問しなかったことが、気になります。' },
          { form: 'the way / the reason', ex: 'The way he explained it made sense.', ja: '彼の説明のしかたは、筋が通っていました。' },
          { form: '形式主語 it', ex: 'It is important to check twice.', ja: '二度確かめることが大切です。' },
        ],
      },
    ],
  },
  {
    id: 'others',
    no: '③',
    label: '無生物主語以外の「型」',
    lead: 'ここからは文全体の骨の話です。役目ごとに分けます。',
    groups: [
      {
        id: 'focus',
        label: '焦点を当てる(どこを際立たせるか)',
        rows: [
          { form: 'It is X that / who ~', ex: "It's the price that worries me.", ja: '気がかりなのは、値段のほうです。' },
          { form: 'What ~ is …', ex: 'What we need is more time.', ja: '必要なのは、もっと時間です。' },
          { form: 'All 人 have to do is do', ex: 'All you have to do is send the file.', ja: 'ファイルを送っていただくだけで結構です。' },
          { form: 'The reason ~ is that …', ex: 'The reason we changed is that the old one broke.', ja: '変えた理由は、前のものが壊れたからです。' },
          { form: 'There is / are ~', ex: "There's a problem with the schedule.", ja: '予定に問題があります。' },
        ],
      },
      {
        id: 'topic',
        label: '話題を先に置く(前置き)',
        note: 'When it comes to と Given は、仕事の英語でとくに回数が多い型です。',
        rows: [
          { form: 'When it comes to ~', ex: "When it comes to pricing, we're flexible.", ja: '価格については、柔軟に対応します。' },
          { form: 'As for ~', ex: 'As for the schedule, nothing has changed.', ja: '予定については、変更はありません。' },
          { form: 'In terms of ~', ex: 'In terms of cost, this is the best option.', ja: '費用の面では、これがいちばん良い案です。' },
          { form: 'Given (that) ~', ex: 'Given the budget, we should wait.', ja: '予算を考えると、待つべきです。' },
          { form: 'Based on ~', ex: 'Based on the data, demand is growing.', ja: 'データから見て、需要は伸びています。' },
        ],
      },
      {
        id: 'connect',
        label: '文と文をつなぐ',
        note: 'Which means は会話でとても多いのに、教材では出にくい型です。',
        rows: [
          { form: "That's why ~", ex: "That's why we moved the meeting.", ja: 'だから、会議をずらしました。' },
          { form: 'Which means ~', ex: "We're short-staffed, which means we need to start earlier.", ja: '人手が足りません。つまり、早めに始める必要があります。' },
          { form: 'That said, ~', ex: "It's expensive. That said, it's still worth trying.", ja: '高いです。とはいえ、試す価値はあります。' },
          { form: 'Not only ~ but also …', ex: 'Not only did it save time, but it also cut costs.', ja: '時間が短くなっただけでなく、費用も下がりました。' },
        ],
      },
      {
        id: 'extend',
        label: '1文を後ろへ伸ばす',
        rows: [
          { form: '関係詞', ex: 'the report that we sent yesterday', ja: '昨日こちらから送った報告書' },
          { form: '現在分詞', ex: 'the team working on it', ja: 'それに取り組んでいるチーム' },
          { form: '過去分詞', ex: 'the report sent yesterday', ja: '昨日送られた報告書' },
          { form: '同格', ex: 'our goal, a 20% increase', ja: '私たちの目標、つまり20%の増加' },
          { form: '分詞構文', ex: 'Having reviewed the data, we decided to wait.', ja: 'データを確認したうえで、待つことにしました。' },
        ],
      },
      {
        id: 'soften',
        label: 'やわらげる・提案する(仕事で効く)',
        rows: [
          { form: 'It might be worth ~ing', ex: 'It might be worth checking again.', ja: 'もう一度確かめてみる価値があるかもしれません。' },
          { form: 'I was wondering if you could ~', ex: 'I was wondering if you could send it today.', ja: '本日中にお送りいただけないでしょうか。' },
          { form: 'Would it be possible to ~', ex: 'Would it be possible to move the meeting?', ja: '会議をずらすことはできますでしょうか。' },
          { form: 'We may want to ~', ex: 'We may want to wait a week.', ja: '1週間待ったほうが、よいかもしれません。' },
          { form: 'What if we ~', ex: 'What if we split it into two phases?', ja: '2段階に分けるのは、どうでしょう。' },
        ],
      },
      {
        id: 'compare',
        label: '比べる',
        rows: [
          { form: 'less about A than B', ex: "It's less about cost than timing.", ja: '問題は、費用よりも時期のほうです。' },
          { form: 'The 比較級, the 比較級', ex: 'The more we practice, the faster we improve.', ja: '練習すればするほど、上達が速くなります。' },
          { form: 'not A but B', ex: "It's not a delay but a change of plan.", ja: '遅れではなく、計画の変更です。' },
          { form: 'A rather than B', ex: "We'd start in May rather than April.", ja: '4月ではなく、5月に始めたいと思います。' },
        ],
      },
    ],
  },
]

/** 巻末に添える1行。**どう使うかを、その場で言う。** */
export const FRAMES_LEAD =
  '覚えた語を、この型に入れてみてください。'
  + '語だけでは文になりません。型に入れて初めて、口から出る形になります。'

/**
 * 型の数。**画面で数え直さない**(押す前に何ページ増えるかを言うために要る)。
 */
export const frameCount = () =>
  FRAME_SECTIONS.reduce(
    (n, s) => n + s.groups.reduce((m, g) => m + g.rows.length, 0),
    0,
  )
