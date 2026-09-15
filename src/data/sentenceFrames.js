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
          { form: 'S allows 人 to do', ex: 'This tool allows you to share files instantly.' },
          { form: 'S enables 人 to do', ex: 'The update enabled us to cut the cost in half.' },
          { form: 'S helps 人 (to) do', ex: 'The training helped the team work faster.' },
          { form: 'S encourages 人 to do', ex: 'The results encouraged us to expand.' },
          { form: 'S inspires 人 to do', ex: 'Working overseas inspired her to learn Spanish.' },
          { form: 'S leads 人 to do', ex: 'The delay led us to rethink the schedule.' },
          { form: 'S prompts 人 to do', ex: 'The complaint prompted us to review the process.' },
          { form: 'S forces 人 to do', ex: 'Rising costs forced them to raise prices.' },
          { form: 'S makes 人 do(原形)', ex: 'The music made everyone relax.' },
        ],
      },
      {
        id: 'block',
        label: '2. させない(妨げる)',
        // **4つとも `from + ~ing`。** ばらばらに覚えると、本番で
        // `to` と取り違える。1つの型として一度に渡す(資料の指摘そのまま)
        note: '4つとも from + ~ing です。ばらばらに覚えると to と取り違えます。',
        rows: [
          { form: 'S keeps 人 from ~ing', ex: 'Fear of mistakes keeps many people from speaking up.' },
          { form: 'S prevents 人 from ~ing', ex: 'The rain prevented us from starting on time.' },
          { form: 'S stops 人 from ~ing', ex: 'Nothing is stopping you from asking.' },
          { form: 'S discourages 人 from ~ing', ex: 'The long form discourages people from applying.' },
        ],
      },
      {
        id: 'need',
        label: '3. 要る・かかる',
        rows: [
          { form: 'S requires 名詞', ex: 'Learning a language requires patience.' },
          { form: 'S requires 人 to do', ex: 'This project requires everyone to report weekly.' },
          { form: 'S takes (人) 時間 to do', ex: 'It took us three days to fix the bug.' },
          { form: 'S involves ~ing', ex: 'The role involves traveling twice a month.' },
          { form: 'S calls for 名詞', ex: 'The situation calls for a quick decision.' },
        ],
      },
      {
        id: 'result',
        label: '4. もたらす(結果)',
        rows: [
          { form: 'S causes 名詞', ex: 'The update caused several errors.' },
          { form: 'S leads to 名詞', ex: 'Poor planning leads to delays.' },
          { form: 'S results in 名詞', ex: 'The change resulted in a 10% drop.' },
          { form: 'S brings 人 名詞', ex: 'The new line brought us 200 new customers.' },
        ],
      },
      {
        id: 'state',
        label: '5. 人を、ある状態にする',
        rows: [
          { form: 'S makes 人 形容詞', ex: 'The news made everyone nervous.' },
          { form: 'S leaves 人 形容詞', ex: 'The delay left us short on time.' },
          { form: 'S keeps 人/物 形容詞', ex: 'Regular practice keeps your English sharp.' },
        ],
      },
      {
        id: 'show',
        label: '6. 示す・説明する(会議で頻出)',
        rows: [
          { form: 'S shows / suggests (that) ~', ex: 'The data shows that demand is rising.' },
          { form: 'S explains why ~', ex: 'That explains why he was late.' },
          { form: 'S is why ~', ex: 'This is why we changed suppliers.' },
          { form: 'S reminds 人 that ~', ex: 'The chart reminds us that growth has slowed.' },
        ],
      },
      {
        id: 'it',
        label: '7. it を立てる形(無生物主語の親戚)',
        rows: [
          { form: 'S makes it possible to do', ex: 'Remote tools make it possible to hire anywhere.' },
          { form: 'S makes it hard for 人 to do', ex: 'The noise made it hard for me to focus.' },
          { form: 'It takes 時間 to do', ex: 'It takes three months to see results.' },
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
          { form: '動名詞', ex: 'Cutting corners saves time now but costs more later.' },
          { form: '名詞化(動詞→名詞)', ex: 'Her decision to leave surprised everyone.' },
          { form: 'what 節', ex: 'What matters is consistency.' },
          { form: 'the fact that', ex: 'The fact that no one asked worries me.' },
          { form: 'the way / the reason', ex: 'The way he explained it made sense.' },
          { form: '形式主語 it', ex: 'It is important to check twice.' },
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
          { form: 'It is X that / who ~', ex: "It's the price that worries me." },
          { form: 'What ~ is …', ex: 'What we need is more time.' },
          { form: 'All 人 have to do is do', ex: 'All you have to do is send the file.' },
          { form: 'The reason ~ is that …', ex: 'The reason we changed is that the old one broke.' },
          { form: 'There is / are ~', ex: "There's a problem with the schedule." },
        ],
      },
      {
        id: 'topic',
        label: '話題を先に置く(前置き)',
        note: 'When it comes to と Given は、仕事の英語でとくに回数が多い型です。',
        rows: [
          { form: 'When it comes to ~', ex: "When it comes to pricing, we're flexible." },
          { form: 'As for ~', ex: 'As for the schedule, nothing has changed.' },
          { form: 'In terms of ~', ex: 'In terms of cost, this is the best option.' },
          { form: 'Given (that) ~', ex: 'Given the budget, we should wait.' },
          { form: 'Based on ~', ex: 'Based on the data, demand is growing.' },
        ],
      },
      {
        id: 'connect',
        label: '文と文をつなぐ',
        note: 'Which means は会話でとても多いのに、教材では出にくい型です。',
        rows: [
          { form: "That's why ~", ex: "That's why we moved the meeting." },
          { form: 'Which means ~', ex: "We're short-staffed, which means we need to start earlier." },
          { form: 'That said, ~', ex: "It's expensive. That said, it's still worth trying." },
          { form: 'Not only ~ but also …', ex: 'Not only did it save time, but it also cut costs.' },
        ],
      },
      {
        id: 'extend',
        label: '1文を後ろへ伸ばす',
        rows: [
          { form: '関係詞', ex: 'the report that we sent yesterday' },
          { form: '現在分詞', ex: 'the team working on it' },
          { form: '過去分詞', ex: 'the report sent yesterday' },
          { form: '同格', ex: 'our goal, a 20% increase' },
          { form: '分詞構文', ex: 'Having reviewed the data, we decided to wait.' },
        ],
      },
      {
        id: 'soften',
        label: 'やわらげる・提案する(仕事で効く)',
        rows: [
          { form: 'It might be worth ~ing', ex: 'It might be worth checking again.' },
          { form: 'I was wondering if you could ~', ex: 'I was wondering if you could send it today.' },
          { form: 'Would it be possible to ~', ex: 'Would it be possible to move the meeting?' },
          { form: 'We may want to ~', ex: 'We may want to wait a week.' },
          { form: 'What if we ~', ex: 'What if we split it into two phases?' },
        ],
      },
      {
        id: 'compare',
        label: '比べる',
        rows: [
          { form: 'less about A than B', ex: "It's less about cost than timing." },
          { form: 'The 比較級, the 比較級', ex: 'The more we practice, the faster we improve.' },
          { form: 'not A but B', ex: "It's not a delay but a change of plan." },
          { form: 'A rather than B', ex: "We'd start in May rather than April." },
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
