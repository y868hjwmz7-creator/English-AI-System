/**
 * **コロケーション基本動詞** —— 単語帳(2026-09 利用者の指定)。
 *
 *   > これらを教材として独立させて登録せよ。
 *   > Native flow は Quick Response 教材、コロケーション基本動詞は単語帳だ。
 *
 * 【出どころ】
 *   利用者が渡した PDF。**5つの基本動詞 × 10 = 50 件**で、
 *   どの行も「もとの動詞 / コロケーション / ニュアンス / 英文 / 和訳」を持つ。
 *
 *     decide  ->  make a decision  判断する(フォーマル)
 *                 I need to make a decision soon.
 *
 * 【なぜファイルに書いてあるか】
 *   **AI を1回も呼ばない = 0円**にするため。
 *   基礎単語(`basicWords.js`)とまったく同じ考え方である。
 *   **表も列も SQL も1行も要らない** —— 覚え具合だけが
 *   `word_reviews` に残る(`src/lib/collocationWords.js`)。
 *
 * 【鍵は「そろえた語句」】
 *   単語帳の鍵は `normWord(phrase)` である。
 *   `make a decision` は**空白を含むので句**(`kind: 'phrase'`)。
 *   **`base` を鍵にしない** —— あれは「1語で言うと何か」の手がかりである。
 *
 * 【`base` を意味の欄に混ぜない】
 *   `nuance`(判断する)は、たいてい `base`(decide)の訳そのものである。
 *   混ぜると**4択の選択肢に英語が出て、答えが見えてしまう**
 *   (「答えを出しておいて、答えさせない」・CLAUDE.md)。
 *   だからデータには持つが、**行の意味には出さない。**
 *
 * 【一覧を勝手に減らさない】
 *   `npm run test:play` が **10動詞 × 10 = 100 件**を数えている。
 *
 * @property v     どの基本動詞の組か(`make` / `take` / `give` / `have` / `do`)
 * @property base  1語で言うとどうなるか(**鍵ではない**)
 * @property p     コロケーション(**これが単語帳に入る語句**)
 * @property n     ニュアンス(単語帳の「意味」)
 * @property en    例文
 * @property ja    例文の訳
 */
export const COLLOCATION_VERBS = [
  { id: 'make', label: 'MAKE', name: '何かを生み出す・作る系', point: '「無から作る・変化を生む」イメージ' },
  { id: 'take', label: 'TAKE', name: '行動・受け取る・実行系', point: '「自分が何かを受けて動く」' },
  { id: 'give', label: 'GIVE', name: '与える・影響系', point: '「何かを相手に渡す」' },
  { id: 'have', label: 'HAVE', name: '状態・経験系', point: '「状態として持っている」' },
  { id: 'do', label: 'DO', name: '作業・処理系', point: '「具体的な作業をこなす」' },
  /* **ビジネスで使うもの**(2026-09 利用者の指定
     「ビジネスで使用するコロケーション50」)。
     **冊は増やさない。同じ冊の後ろへ足す** —— 利用者の指定
     「同じ冊に足して 100 件に」。冊が増えると置き場所を覚え直すことになる
     (docs/notes/22 の決まり)。**並べ替えない** */
  { id: 'meet', label: 'MEET', name: '満たす・間に合わせる', point: '「求められた線に届かせる」' },
  { id: 'reach', label: 'REACH', name: 'たどり着く', point: '「話し合って、ある地点まで来る」' },
  { id: 'raise', label: 'RAISE', name: '上げる・持ち出す', point: '「高くする / 場に出す」' },
  { id: 'set', label: 'SET', name: '決める・据える', point: '「これでいく、と置く」' },
  { id: 'handle', label: 'HANDLE', name: 'さばく・対応する', point: '「降ってきたものを引き受けて処理する」' },
]

/** 原本の 50 件 + ビジネスの 50 件 = **100 件**(2026-09 利用者の指定)。
    **並べ替えない。減らさない。後ろへ足す** */
export const COLLOCATIONS = [
  // -- MAKE ... 何かを生み出す・作る系 / 「無から作る・変化を生む」イメージ
  { v: 'make', base: 'decide', p: 'make a decision', n: '判断する（フォーマル）', en: 'I need to make a decision soon.', ja: 'すぐに決断しないといけない' },
  { v: 'make', base: 'reserve', p: 'make a reservation', n: '予約する', en: 'I made a reservation for two.', ja: '2人分の予約をした' },
  { v: 'make', base: 'plan', p: 'make a plan', n: '計画する', en: 'We should make a plan before we go.', ja: '行く前に計画を立てたほうがいい' },
  { v: 'make', base: 'choose', p: 'make a choice', n: '選択する', en: 'You have to make a choice.', ja: 'あなたは選択しなければならない' },
  { v: 'make', base: 'suggest', p: 'make a suggestion', n: '提案する', en: 'He made a good suggestion.', ja: '彼は良い提案をした' },
  { v: 'make', base: 'explain', p: 'make an explanation', n: '説明する（やや硬い）', en: 'She made an explanation about the issue.', ja: '彼女はその問題について説明した' },
  { v: 'make', base: 'apologize', p: 'make an apology', n: '謝罪する（フォーマル）', en: 'He made an apology for his mistake.', ja: '彼は自分のミスを謝罪した' },
  { v: 'make', base: 'improve', p: 'make an improvement', n: '改善する', en: 'They made an improvement to the design.', ja: '彼らはデザインを改善した' },
  { v: 'make', base: 'arrange', p: 'make arrangements', n: '手配する', en: 'We made arrangements for the trip.', ja: '旅行の手配をした' },
  { v: 'make', base: 'progress', p: 'make progress', n: '進歩する', en: 'She is making progress in her studies.', ja: '彼女は勉強で進歩している' },
  // -- TAKE ... 行動・受け取る・実行系 / 「自分が何かを受けて動く」
  { v: 'take', base: 'decide', p: 'take a decision', n: '英式・フォーマル', en: 'I need to take a decision soon.', ja: 'すぐに決断しないといけない' },
  { v: 'take', base: 'act', p: 'take action', n: '行動する', en: 'The government must take action immediately.', ja: '政府はすぐに行動を起こさなければならない' },
  { v: 'take', base: 'rest', p: 'take a rest', n: '休憩する', en: 'You should take a rest.', ja: '休んだほうがいいよ' },
  { v: 'take', base: 'break', p: 'take a break', n: '休憩する（カジュアル）', en: 'Let’s take a break.', ja: '休憩しよう' },
  { v: 'take', base: 'risk', p: 'take a risk', n: 'リスクを取る', en: 'He decided to take a risk.', ja: '彼はリスクを取ることに決めた' },
  { v: 'take', base: 'responsibility', p: 'take responsibility', n: '責任を負う', en: 'She took responsibility for the mistake.', ja: '彼女はそのミスの責任を取った' },
  { v: 'take', base: 'opportunity', p: 'take an opportunity', n: '機会を活かす', en: 'You should take this opportunity.', ja: 'この機会を活かすべきだよ' },
  { v: 'take', base: 'exam', p: 'take an exam', n: '試験を受ける', en: 'I have to take an exam tomorrow.', ja: '明日試験を受けなければならない' },
  { v: 'take', base: 'seat', p: 'take a seat', n: '座る（丁寧）', en: 'Please take a seat.', ja: 'お座りください' },
  { v: 'take', base: 'time', p: 'take time', n: '時間がかかる', en: 'It takes time to learn a language.', ja: '言語を習得するには時間がかかる' },
  // -- GIVE ... 与える・影響系 / 「何かを相手に渡す」
  { v: 'give', base: 'advise', p: 'give advice', n: '助言する', en: 'He gave me good advice.', ja: '彼は私に良いアドバイスをくれた' },
  { v: 'give', base: 'suggest', p: 'give a suggestion', n: '提案する', en: 'She gave a helpful suggestion.', ja: '彼女は役立つ提案をした' },
  { v: 'give', base: 'explain', p: 'give an explanation', n: '説明する', en: 'The teacher gave an explanation.', ja: '先生は説明をした' },
  { v: 'give', base: 'present', p: 'give a presentation', n: 'プレゼンする', en: 'I will give a presentation tomorrow.', ja: '明日プレゼンをします' },
  { v: 'give', base: 'answer', p: 'give an answer', n: '回答する', en: 'He gave the correct answer.', ja: '彼は正しい答えを出した' },
  { v: 'give', base: 'speech', p: 'give a speech', n: 'スピーチする', en: 'She gave a speech at the event.', ja: '彼女はそのイベントでスピーチをした' },
  { v: 'give', base: 'permission', p: 'give permission', n: '許可する', en: 'They gave us permission to enter.', ja: '彼らは入る許可をくれた' },
  { v: 'give', base: 'support', p: 'give support', n: '支援する', en: 'My friends gave me a lot of support.', ja: '友達がたくさん支えてくれた' },
  { v: 'give', base: 'feedback', p: 'give feedback', n: 'フィードバックする', en: 'The teacher gave me useful feedback.', ja: '先生は有益なフィードバックをくれた' },
  { v: 'give', base: 'call', p: 'give a call', n: '電話する（やや古め）', en: 'I’ll give you a call later.', ja: '後で電話するね' },
  // -- HAVE ... 状態・経験系 / 「状態として持っている」
  { v: 'have', base: 'rest', p: 'have a rest', n: '休憩する', en: 'You should have a rest.', ja: '休んだほうがいいよ' },
  { v: 'have', base: 'break', p: 'have a break', n: '休憩する', en: 'Let’s have a break.', ja: '休憩しよう' },
  { v: 'have', base: 'talk', p: 'have a talk', n: '話す', en: 'We need to have a talk.', ja: '話し合いが必要だ' },
  { v: 'have', base: 'meeting', p: 'have a meeting', n: '会議する', en: 'We will have a meeting tomorrow.', ja: '明日会議をします' },
  { v: 'have', base: 'discussion', p: 'have a discussion', n: '議論する', en: 'They had a discussion about the issue.', ja: '彼らはその問題について議論した' },
  { v: 'have', base: 'experience', p: 'have an experience', n: '経験する', en: 'I had an amazing experience.', ja: '素晴らしい経験をした' },
  { v: 'have', base: 'problem', p: 'have a problem', n: '問題を抱える', en: 'I’m having a problem with my computer.', ja: 'パソコンに問題がある' },
  { v: 'have', base: 'idea', p: 'have an idea', n: '思いつく', en: 'I have an idea.', ja: 'いい考えがある' },
  { v: 'have', base: 'look', p: 'have a look', n: '見てみる', en: 'Have a look at this.', ja: 'これを見て' },
  { v: 'have', base: 'try', p: 'have a try', n: '試す（ややカジュアル）', en: 'Let me have a try.', ja: 'やらせてみて' },
  // -- DO ... 作業・処理系 / 「具体的な作業をこなす」
  { v: 'do', base: 'work', p: 'do work', n: '仕事をする', en: 'I have to do some work today.', ja: '今日は仕事をしないといけない' },
  { v: 'do', base: 'task', p: 'do a task', n: '作業をする', en: 'He did a difficult task.', ja: '彼は難しい作業をこなした' },
  { v: 'do', base: 'homework', p: 'do homework', n: '宿題をする', en: 'She is doing her homework.', ja: '彼女は宿題をしている' },
  { v: 'do', base: 'research', p: 'do research', n: '研究する', en: 'They are doing research on the topic.', ja: '彼らはそのテーマについて研究している' },
  { v: 'do', base: 'business', p: 'do business', n: 'ビジネスをする', en: 'He does business with foreign companies.', ja: '彼は海外企業と取引している' },
  { v: 'do', base: 'exercise', p: 'do exercise', n: '運動する', en: 'I do exercise every morning.', ja: '毎朝運動をしている' },
  { v: 'do', base: 'cleaning', p: 'do cleaning', n: '掃除する', en: 'She did the cleaning yesterday.', ja: '彼女は昨日掃除をした' },
  { v: 'do', base: 'damage', p: 'do damage', n: '被害を与える', en: 'The storm did serious damage.', ja: 'その嵐は大きな被害を与えた' },
  { v: 'do', base: 'favor', p: 'do a favor', n: '頼みごとをする', en: 'Can you do me a favor?', ja: 'お願いがあるんだけど' },
  { v: 'do', base: 'check', p: 'do a check', n: '確認する', en: 'I need to do a check before leaving.', ja: '出発前に確認する必要がある' },
  // -- MEET ... 満たす・間に合わせる(2026-09 利用者の指定「ビジネスで使用するコロケーション50」)
  { v: 'meet', base: 'finish', p: 'meet the deadline', n: '締め切りに間に合わせる', en: 'We managed to meet the deadline.', ja: 'なんとか締め切りに間に合わせた' },
  { v: 'meet', base: 'satisfy', p: 'meet the requirements', n: '条件を満たす', en: 'This design meets the requirements.', ja: 'この設計は条件を満たしている' },
  { v: 'meet', base: 'achieve', p: 'meet the target', n: '目標に届く', en: 'We did not meet the target this quarter.', ja: '今期は目標に届かなかった' },
  { v: 'meet', base: 'supply', p: 'meet the demand', n: '需要に応える', en: 'We cannot meet the demand right now.', ja: 'いまは需要に応えられない' },
  { v: 'meet', base: 'qualify', p: 'meet the standard', n: '水準に達する', en: 'The samples meet the standard.', ja: '見本は水準に達している' },
  { v: 'meet', base: 'please', p: 'meet expectations', n: '期待に応える', en: 'The result did not meet expectations.', ja: '結果は期待に応えられなかった' },
  { v: 'meet', base: 'afford', p: 'meet the budget', n: '予算に収める', en: 'The plan has to meet the budget.', ja: '計画は予算に収める必要がある' },
  { v: 'meet', base: 'qualify', p: 'meet the criteria', n: '基準に当てはまる', en: 'Only two vendors meet the criteria.', ja: '基準に当てはまる取引先は2社だけだ' },
  { v: 'meet', base: 'keep', p: 'meet the schedule', n: '日程どおりに進める', en: 'We are working hard to meet the schedule.', ja: '日程どおりに進めようと動いている' },
  { v: 'meet', base: 'serve', p: 'meet the needs', n: '求めに応える', en: 'This tool meets the needs of small teams.', ja: 'この道具は、小さなチームの求めに応える' },

  // -- REACH ... たどり着く
  { v: 'reach', base: 'agree', p: 'reach an agreement', n: '合意する', en: 'Both sides reached an agreement.', ja: '両者は合意した' },
  { v: 'reach', base: 'decide', p: 'reach a decision', n: '結論を出す', en: 'We reached a decision yesterday.', ja: '昨日、結論を出した' },
  { v: 'reach', base: 'conclude', p: 'reach a conclusion', n: '結論に至る', en: 'It is too early to reach a conclusion.', ja: '結論に至るのは早すぎる' },
  { v: 'reach', base: 'compromise', p: 'reach a compromise', n: '折り合う', en: 'They reached a compromise on the price.', ja: '値段で折り合った' },
  { v: 'reach', base: 'agree', p: 'reach a consensus', n: '意見をそろえる', en: 'The team reached a consensus.', ja: 'チームの意見がそろった' },
  { v: 'reach', base: 'understand', p: 'reach an understanding', n: '了解し合う', en: 'We reached an understanding with the client.', ja: '取引先と了解し合えた' },
  { v: 'reach', base: 'settle', p: 'reach a settlement', n: '話をつける', en: 'The two firms reached a settlement.', ja: '2社は話をつけた' },
  { v: 'reach', base: 'achieve', p: 'reach a milestone', n: '節目に届く', en: 'We reached a milestone last week.', ja: '先週、節目に届いた' },
  { v: 'reach', base: 'fill', p: 'reach capacity', n: 'いっぱいになる', en: 'The warehouse has reached capacity.', ja: '倉庫はいっぱいになった' },
  { v: 'reach', base: 'attract', p: 'reach an audience', n: '相手に届く', en: 'The campaign reached a wider audience.', ja: 'その取り組みは、より広い相手に届いた' },

  // -- RAISE ... 上げる・持ち出す
  { v: 'raise', base: 'worry', p: 'raise a concern', n: '懸念を伝える', en: 'She raised a concern about the timeline.', ja: '彼女は日程について懸念を伝えた' },
  { v: 'raise', base: 'mention', p: 'raise an issue', n: '問題を持ち出す', en: 'He raised an issue in the meeting.', ja: '彼は会議で問題を持ち出した' },
  { v: 'raise', base: 'increase', p: 'raise the price', n: '値上げする', en: 'We had to raise the price.', ja: '値上げせざるをえなかった' },
  { v: 'raise', base: 'ask', p: 'raise a question', n: '疑問を出す', en: 'That raises a question about the data.', ja: 'それは、データについて疑問を出す' },
  { v: 'raise', base: 'promote', p: 'raise awareness', n: '知ってもらう', en: 'The campaign raised awareness.', ja: 'その取り組みで、知ってもらえた' },
  { v: 'raise', base: 'improve', p: 'raise the standard', n: '水準を上げる', en: 'Training raised the standard.', ja: '研修で、水準が上がった' },
  { v: 'raise', base: 'finance', p: 'raise funds', n: '資金を集める', en: 'They raised funds from three investors.', ja: '3社から資金を集めた' },
  { v: 'raise', base: 'challenge', p: 'raise the bar', n: '求める高さを上げる', en: 'The new rule raised the bar.', ja: '新しい決まりで、求める高さが上がった' },
  { v: 'raise', base: 'object', p: 'raise an objection', n: '異議を出す', en: 'Nobody raised an objection.', ja: '誰も異議を出さなかった' },
  { v: 'raise', base: 'promise', p: 'raise expectations', n: '期待を高める', en: 'The demo raised expectations.', ja: '実演で、期待が高まった' },

  // -- SET ... 決める・据える
  { v: 'set', base: 'schedule', p: 'set a deadline', n: '締め切りを決める', en: 'Let us set a deadline for the draft.', ja: '下書きの締め切りを決めましょう' },
  { v: 'set', base: 'aim', p: 'set a target', n: '目標を決める', en: 'We set a target of 20%.', ja: '20%という目標を決めた' },
  { v: 'set', base: 'budget', p: 'set a budget', n: '予算を決める', en: 'They set a budget for the project.', ja: 'その案件の予算を決めた' },
  { v: 'set', base: 'plan', p: 'set the agenda', n: '議題を決める', en: 'Who will set the agenda?', ja: '誰が議題を決めますか' },
  { v: 'set', base: 'establish', p: 'set a precedent', n: '前例を作る', en: 'This decision sets a precedent.', ja: 'この判断は、前例を作る' },
  { v: 'set', base: 'lead', p: 'set the tone', n: '雰囲気を決める', en: 'The first slide sets the tone.', ja: '最初の1枚が、雰囲気を決める' },
  { v: 'set', base: 'prioritize', p: 'set priorities', n: '優先を決める', en: 'We need to set priorities first.', ja: 'まず優先を決める必要がある' },
  { v: 'set', base: 'explain', p: 'set expectations', n: '見通しをそろえる', en: 'Set expectations early with the client.', ja: '取引先と、早めに見通しをそろえる' },
  { v: 'set', base: 'limit', p: 'set a limit', n: '上限を決める', en: 'We set a limit on overtime.', ja: '残業に上限を決めた' },
  { v: 'set', base: 'schedule', p: 'set a date', n: '日取りを決める', en: 'Shall we set a date for the review?', ja: '見直しの日取りを決めましょうか' },

  // -- HANDLE ... さばく・対応する
  { v: 'handle', base: 'manage', p: 'handle a complaint', n: '苦情に対応する', en: 'She handled the complaint calmly.', ja: '彼女は落ち着いて、苦情に対応した' },
  { v: 'handle', base: 'process', p: 'handle the paperwork', n: '書類仕事をさばく', en: 'Who handles the paperwork?', ja: '誰が書類仕事をさばきますか' },
  { v: 'handle', base: 'process', p: 'handle a request', n: '依頼をさばく', en: 'We handle every request within a day.', ja: 'どの依頼も1日でさばく' },
  { v: 'handle', base: 'endure', p: 'handle pressure', n: '重圧に耐える', en: 'He handles pressure well.', ja: '彼は重圧によく耐える' },
  { v: 'handle', base: 'negotiate', p: 'handle the negotiation', n: '交渉を受け持つ', en: 'She will handle the negotiation.', ja: '交渉は彼女が受け持つ' },
  { v: 'handle', base: 'manage', p: 'handle a crisis', n: '危機に対処する', en: 'The team handled the crisis well.', ja: 'チームは、よく危機に対処した' },
  { v: 'handle', base: 'arrange', p: 'handle the details', n: '細かいところを片づける', en: 'I will handle the details.', ja: '細かいところは、私が片づけます' },
  { v: 'handle', base: 'manage', p: 'handle the workload', n: '仕事量をさばく', en: 'Two people cannot handle this workload.', ja: '2人では、この仕事量はさばけない' },
  { v: 'handle', base: 'answer', p: 'handle an objection', n: '反対をさばく', en: 'He handled the objection calmly.', ja: '彼は落ち着いて、反対をさばいた' },
  { v: 'handle', base: 'arrange', p: 'handle the logistics', n: '段取りを受け持つ', en: 'Our partner handles the logistics.', ja: '段取りは、組んでいる相手が受け持つ' },
]

/* ==========================================================================
 * 覚え具合と突き合わせて、単語帳の1行にする
 *
 * **`review_words()`(0048)が返すのと、1つ残らず同じ形**にしてある。
 * だから `Wordbook.jsx` は、冊が変わっても**1文字も書き分けていない** ——
 * 出題も4択も絞り込みも聞き流しも紙も、そのまま効く
 * (`basicRows()` / `shelfReviews.js` とまったく同じ考え方)。
 *
 * **動詞の切り替えを作らない。** 50 件しかないので、
 * 段に分ける理由がない(基礎単語が 1,200 語あるのとは事情が違う)。
 * ========================================================================== */
import { normWord } from '../lib/textNorm.js'
import { posGroupOf, posLabel } from '../lib/posGroups.js'

/** その動詞の組。**知らない id は null**(当てずっぽうで返さない) */
export const collocationVerbOf = (id) =>
  COLLOCATION_VERBS.find((v) => v.id === String(id ?? '').toLowerCase()) ?? null

/**
 * 絞り込みと紙に出す名前。**`material_title` に入れる。**
 *
 * 「コロケーション」を頭に付けてあるので、自分の単語帳の教材名と
 * 並んでも**どちらの冊の語句か、ひと目で分かる。**
 */
export const collocationTitle = (id) => {
  const v = collocationVerbOf(id)
  return v ? `コロケーション ${v.label}(${v.name})` : 'コロケーション'
}

/**
 * ファイルの 50 件 × その人の覚え具合。
 *
 * **行の無い語句は「まだ・箱0・今日出す」。** 待たせる理由がない。
 *
 * @param seen   `word_reviews` の行(`word_norm` で引く)
 * @param today  きょうの日付。`due_on` の既定になる
 */
export function collocationRows(seen = [], { today = '' } = {}) {
  const map = new Map(
    (seen ?? []).map((r) => [String(r?.word_norm ?? ''), r]).filter(([k]) => k),
  )
  return COLLOCATIONS.map((x) => {
    const key = normWord(x.p)
    const s = map.get(key) ?? null
    return {
      word_norm: key,
      display: x.p,
      /* **どれも空白を含むので句である**(`make a decision`)。
         `npm run test:play` が「`p` は必ず2語以上」を見張っている */
      kind: 'phrase',
      pos: posLabel(posGroupOf('phr')),
      /* **意味はニュアンスだけ。** `base`(1語で言うと decide)は混ぜない ——
         混ぜると**4択の選択肢に英語が出て、答えが見えてしまう** */
      meaning_ja: x.n,
      /* **出会った文は、原本の例文そのもの。** 人は文脈ごと覚える(0018) */
      seen_in: x.en,
      seen_in_ja: x.ja,
      status: s?.status ?? 'unknown',
      box: s?.box ?? 0,
      due_on: s?.due_on ?? today,
      updated_at: s?.updated_at ?? null,
      added_at: s?.added_at ?? null,
      material_id: null,
      material_title: collocationTitle(x.v),
      material_industry: null,
      material_kind: null,
      material_genre: null,
      material_scene: null,
      material_level: null,
      learn_streak: s?.learn_streak ?? 0,
    }
  })
}
