/**
 * **名詞句** —— 単語帳(2026-09 利用者の指定)。
 *
 *   > どのビジネスでも使える「名詞句」を厳選し、単語帳に一つのコンテンツとして
 *   > 置き、5文だけでなく、そこを言い換える練習ができるようにしたい。
 *   > 名詞句とは、名詞だけでなく目的語もセットにしたいところです。
 *
 * ============================================================================
 * 【「目的語もセット」を、どう読んだか】
 *
 *   **芯の名詞だけでは、文に入らない。**
 *   `decision` を覚えても `the decision to postpone` は出てこない。
 *   だから**うしろに続くところまで、ひとかたまりで覚える。**
 *
 *     ×  decision            … 芯だけ。文に入れるとき毎回つまずく
 *     ○  a decision to postpone  … そのまま主語にも目的語にもなる
 *
 *   **組1〜4が、この「うしろに続きを持つ名詞句」**である(52 件)。
 *   組5・6は **2語で1つになっている名詞句**(`a tight deadline` /
 *   `a cost breakdown`・28 件)で、**文の中で同じ席に入る**ので入れてある。
 *   ご指定と少しずれるので、**要らなければ組ごと外せる形**にしてある。
 *
 * 【なぜ「型」と組にすると効くのか】
 *
 *   66 の型(`sentenceFrames.js`)は**骨**で、名詞句は**肉**である。
 *   `What ~ is …` の `~` に何を入れるかが出てこないと、型は使えない。
 *
 *     What worries me is 〔 the cost of delay 〕.
 *     What worries me is 〔 a lack of information 〕.
 *
 *   **同じ骨に、違う肉を入れる**のが「言い換える練習」である。
 *
 * 【なぜファイルに書いてあるか】
 *
 *   **AI を1回も呼ばない = 0円。**
 *   コロケーション(`collocations.js`)・基礎単語(`basicWords.js`)と
 *   まったく同じ考え方である。**表も列も SQL も1行も要らない** ——
 *   覚え具合だけが `word_reviews` に残る(`src/lib/nounPhraseWords.js`)。
 *
 * 【鍵は「そろえた語句」】
 *
 *   単語帳の鍵は `normWord(p)` である。どれも空白を含むので**句**
 *   (`kind: 'phrase'`)。**`head` を鍵にしない** ——
 *   あれは「芯はどの名詞か」の手がかりである。
 *
 * 【`head` を意味の欄に混ぜない】
 *
 *   混ぜると**4択の選択肢に英語が出て、答えが見えてしまう**
 *   (「答えを出しておいて、答えさせない」・CLAUDE.md)。
 *   コロケーションの `base` とまったく同じ注意である。
 *
 * 【実在の名前を入れない】
 *
 *   会社名・人名・商品名は書かない(`speechStyles.js` と同じ決まり)。
 *
 * 【一覧を勝手に減らさない】
 *
 *   `npm run test:play` が **80 件**と、組ごとの中身を数えている
 *   (コロケーションと同じ場所で見る。**見る場所を増やさない**)。
 *
 * @property g    うしろに続く形の組(`of` / `todo` / `prep` / `that` / `adj` / `nn`)
 * @property head 芯の名詞(**鍵ではない。意味にも出さない**)
 * @property p    名詞句(**これが単語帳に入る**)
 * @property n    意味(単語帳の「意味」)
 * @property en   例文。**必ず `p` をそのまま含む**(`npm run test:play` が見張る)
 * @property ja   例文の訳
 */
import { normWord } from '../lib/textNorm.js'
import { posGroupOf, posLabel } from '../lib/posGroups.js'

/** うしろに続く形の組。**並べ替えない。減らさない** */
export const NOUN_PHRASE_GROUPS = [
  { id: 'of', label: 'OF', name: 'A の B', point: '中身・度合い・範囲を言う。いちばん数が多い' },
  { id: 'todo', label: 'TO DO', name: '〜するための / 〜するという', point: '名詞のうしろに to 不定詞が続く' },
  { id: 'prep', label: 'PREP', name: '前置詞が決まっている', point: 'to / for / in / on / with。名詞ごとに相手が決まっている' },
  { id: 'that', label: 'THAT', name: '〜という(中身が文)', point: '名詞のうしろに文がまるごと続く' },
  { id: 'adj', label: 'ADJ + N', name: '形容詞 + 名詞', point: '2語で1つ。仕事でそのまま出てくる' },
  { id: 'nn', label: 'N + N', name: '名詞 + 名詞', point: '2語で1つの言葉になっているもの' },
]

/** 厳選 80 件。**並べ替えない。減らさない** */
export const NOUN_PHRASES = [
  // -- OF ... A の B
  { g: 'of', head: 'cost', p: 'the cost of delay', n: '遅れにかかる費用', en: 'We underestimated the cost of delay.', ja: '遅れにかかる費用を、低く見積もっていた' },
  { g: 'of', head: 'scope', p: 'the scope of the project', n: '案件の範囲', en: 'Let us agree on the scope of the project first.', ja: 'まず案件の範囲を決めましょう' },
  { g: 'of', head: 'risk', p: 'the risk of delay', n: '遅れる危険', en: 'There is the risk of delay if we start late.', ja: '始めるのが遅いと、遅れる危険がある' },
  { g: 'of', head: 'lack', p: 'a lack of information', n: '情報の不足', en: 'A lack of information slowed us down.', ja: '情報の不足が、進みを遅くした' },
  { g: 'of', head: 'purpose', p: 'the purpose of the meeting', n: '会議の目的', en: 'Let me restate the purpose of the meeting.', ja: '会議の目的を、もう一度言います' },
  { g: 'of', head: 'quality', p: 'the quality of the work', n: '仕事の質', en: 'The quality of the work has improved.', ja: '仕事の質が上がった' },
  { g: 'of', head: 'number', p: 'the number of requests', n: '依頼の件数', en: 'The number of requests doubled last month.', ja: '先月、依頼の件数が2倍になった' },
  { g: 'of', head: 'rest', p: 'the rest of the team', n: 'チームの残りの人', en: 'I will inform the rest of the team.', ja: 'チームの残りの人に伝えます' },
  { g: 'of', head: 'copy', p: 'a copy of the report', n: '報告書の写し', en: 'Could you send me a copy of the report?', ja: '報告書の写しを送ってもらえますか' },
  { g: 'of', head: 'end', p: 'the end of the quarter', n: '四半期の終わり', en: 'We need this by the end of the quarter.', ja: '四半期の終わりまでに要ります' },
  { g: 'of', head: 'summary', p: 'a summary of the results', n: '結果の要約', en: 'He sent a summary of the results.', ja: '彼は結果の要約を送った' },
  { g: 'of', head: 'value', p: 'the value of the contract', n: '契約の金額', en: 'The value of the contract went up.', ja: '契約の金額が上がった' },
  { g: 'of', head: 'amount', p: 'the amount of work', n: '仕事の量', en: 'The amount of work surprised us.', ja: '仕事の量に驚いた' },
  { g: 'of', head: 'series', p: 'a series of problems', n: '続けて起きた問題', en: 'A series of problems delayed the launch.', ja: '問題が続いて、発売が遅れた' },

  // -- TO DO ... 〜するための / 〜するという
  { g: 'todo', head: 'ability', p: 'the ability to adapt', n: '合わせて変わる力', en: 'The ability to adapt matters more than experience.', ja: '合わせて変わる力は、経験より大事だ' },
  { g: 'todo', head: 'decision', p: 'the decision to postpone', n: '延期するという判断', en: 'The decision to postpone came too late.', ja: '延期するという判断が、遅すぎた' },
  { g: 'todo', head: 'opportunity', p: 'an opportunity to grow', n: '伸びる機会', en: 'This is an opportunity to grow.', ja: 'これは伸びる機会だ' },
  { g: 'todo', head: 'plan', p: 'a plan to cut costs', n: '費用を下げる計画', en: 'We need a plan to cut costs.', ja: '費用を下げる計画が要る' },
  { g: 'todo', head: 'need', p: 'the need to move faster', n: 'もっと速く動く必要', en: 'Everyone feels the need to move faster.', ja: 'みんな、もっと速く動く必要を感じている' },
  { g: 'todo', head: 'chance', p: 'a chance to explain', n: '説明する機会', en: 'Give him a chance to explain.', ja: '彼に説明する機会をあげてください' },
  { g: 'todo', head: 'right', p: 'the right to decide', n: '決める権利', en: 'The client has the right to decide.', ja: '決める権利は、取引先にある' },
  { g: 'todo', head: 'way', p: 'a way to save time', n: '時間を縮めるやり方', en: 'We found a way to save time.', ja: '時間を縮めるやり方が見つかった' },
  { g: 'todo', head: 'time', p: 'the time to review', n: '見直す時間', en: 'We did not have the time to review it.', ja: 'それを見直す時間が無かった' },
  { g: 'todo', head: 'effort', p: 'an effort to improve', n: '良くしようという動き', en: 'This is an effort to improve the process.', ja: 'これは進め方を良くしようという動きだ' },
  { g: 'todo', head: 'permission', p: 'permission to share', n: '共有してよいという許可', en: 'We need permission to share the file.', ja: 'ファイルを共有してよいという許可が要る' },
  { g: 'todo', head: 'reason', p: 'a reason to wait', n: '待つ理由', en: 'I do not see a reason to wait.', ja: '待つ理由が見当たらない' },
  { g: 'todo', head: 'willingness', p: 'the willingness to change', n: '変わろうという姿勢', en: 'The willingness to change is the hard part.', ja: '変わろうという姿勢が、いちばん難しい' },

  // -- PREP ... 前置詞が決まっている
  { g: 'prep', head: 'solution', p: 'a solution to the problem', n: '問題の解決策', en: 'We found a solution to the problem.', ja: '問題の解決策が見つかった' },
  { g: 'prep', head: 'answer', p: 'the answer to your question', n: 'ご質問への答え', en: 'Here is the answer to your question.', ja: 'ご質問への答えです' },
  { g: 'prep', head: 'reason', p: 'the reason for the delay', n: '遅れの理由', en: 'Let me explain the reason for the delay.', ja: '遅れの理由を説明します' },
  { g: 'prep', head: 'demand', p: 'the demand for this service', n: 'この仕事への需要', en: 'The demand for this service is rising.', ja: 'この仕事への需要が伸びている' },
  { g: 'prep', head: 'increase', p: 'an increase in cost', n: '費用の増え', en: 'We saw an increase in cost last quarter.', ja: '前の四半期に、費用が増えた' },
  { g: 'prep', head: 'drop', p: 'a drop in sales', n: '売上の落ち込み', en: 'A drop in sales worried the team.', ja: '売上の落ち込みが、チームを心配させた' },
  { g: 'prep', head: 'change', p: 'a change in the schedule', n: '予定の変更', en: 'There was a change in the schedule.', ja: '予定に変更があった' },
  { g: 'prep', head: 'impact', p: 'the impact on the budget', n: '予算への響き', en: 'We should check the impact on the budget.', ja: '予算への響きを確かめたほうがいい' },
  { g: 'prep', head: 'update', p: 'an update on the project', n: '案件の近ごろの様子', en: 'Could you give us an update on the project?', ja: '案件の近ごろの様子を教えてもらえますか' },
  { g: 'prep', head: 'problem', p: 'a problem with the data', n: 'データの不具合', en: 'There is a problem with the data.', ja: 'データに不具合がある' },
  { g: 'prep', head: 'issue', p: 'an issue with the delivery', n: '納品でのもめごと', en: 'We had an issue with the delivery.', ja: '納品でもめごとが起きた' },
  { g: 'prep', head: 'meeting', p: 'a meeting with the client', n: '取引先との打ち合わせ', en: 'I have a meeting with the client at three.', ja: '3時に、取引先との打ち合わせがある' },
  { g: 'prep', head: 'interest', p: 'the interest in this idea', n: 'この案への関心', en: 'The interest in this idea is growing.', ja: 'この案への関心が高まっている' },
  { g: 'prep', head: 'request', p: 'a request for more time', n: '時間をもらう頼み', en: 'We sent a request for more time.', ja: '時間をもらう頼みを出した' },
  { g: 'prep', head: 'approach', p: 'the approach to this task', n: 'この仕事の進め方', en: 'Let us rethink the approach to this task.', ja: 'この仕事の進め方を、考え直しましょう' },
  { g: 'prep', head: 'delay', p: 'a delay in the approval', n: '承認の遅れ', en: 'A delay in the approval stopped the work.', ja: '承認の遅れで、仕事が止まった' },
  { g: 'prep', head: 'difference', p: 'the difference between the two', n: '2つの違い', en: 'Explain the difference between the two.', ja: '2つの違いを説明してください' },

  // -- THAT ... 〜という(中身が文)
  { g: 'that', head: 'fact', p: 'the fact that we are behind', n: '遅れているという事実', en: 'The fact that we are behind worries the client.', ja: '遅れているという事実が、取引先を心配させている' },
  { g: 'that', head: 'idea', p: 'the idea that price decides everything', n: '値段で全部決まるという考え', en: 'The idea that price decides everything is wrong.', ja: '値段で全部決まるという考えは間違いだ' },
  { g: 'that', head: 'risk', p: 'the risk that the deadline slips', n: '締め切りがずれる危険', en: 'We should name the risk that the deadline slips.', ja: '締め切りがずれる危険を、言葉にしておくべきだ' },
  { g: 'that', head: 'news', p: 'the news that the launch moved', n: '発売がずれたという知らせ', en: 'The news that the launch moved reached us late.', ja: '発売がずれたという知らせは、遅れて届いた' },
  { g: 'that', head: 'sense', p: 'the sense that something is off', n: '何かおかしいという感じ', en: 'I have the sense that something is off.', ja: '何かおかしいという感じがある' },
  { g: 'that', head: 'assumption', p: 'the assumption that nothing changes', n: '何も変わらないという前提', en: 'The assumption that nothing changes is risky.', ja: '何も変わらないという前提は、危うい' },
  { g: 'that', head: 'concern', p: 'the concern that costs will rise', n: '費用が上がるという心配', en: 'The concern that costs will rise is fair.', ja: '費用が上がるという心配は、もっともだ' },
  { g: 'that', head: 'agreement', p: 'the agreement that we split the cost', n: '費用を折半するという取り決め', en: 'The agreement that we split the cost is in writing.', ja: '費用を折半するという取り決めは、文書にしてある' },

  // -- ADJ + N ... 形容詞 + 名詞(2語で1つ)
  { g: 'adj', head: 'deadline', p: 'a tight deadline', n: 'きつい締め切り', en: 'We are working to a tight deadline.', ja: 'きつい締め切りで動いている' },
  { g: 'adj', head: 'estimate', p: 'a rough estimate', n: 'おおまかな見積もり', en: 'Give me a rough estimate first.', ja: 'まず、おおまかな見積もりをください' },
  { g: 'adj', head: 'cause', p: 'the root cause', n: '根っこの原因', en: 'We have not found the root cause yet.', ja: '根っこの原因が、まだ見つかっていない' },
  { g: 'adj', head: 'picture', p: 'the bigger picture', n: '全体像', en: 'Let us look at the bigger picture.', ja: '全体像を見ましょう' },
  { g: 'adj', head: 'breakdown', p: 'a clear breakdown', n: 'はっきりした内訳', en: 'Send me a clear breakdown of the cost.', ja: '費用の、はっきりした内訳を送ってください' },
  { g: 'adj', head: 'priority', p: 'our top priority', n: 'いちばん先にやること', en: 'Safety is our top priority.', ja: '安全が、いちばん先にやることだ' },
  { g: 'adj', head: 'step', p: 'the next step', n: '次の一手', en: 'What is the next step?', ja: '次の一手は何ですか' },
  { g: 'adj', head: 'notice', p: 'short notice', n: '急な知らせ', en: 'Sorry for the short notice.', ja: '急な知らせで、申し訳ありません' },
  { g: 'adj', head: 'point', p: 'a fair point', n: 'もっともな指摘', en: 'That is a fair point.', ja: 'それは、もっともな指摘です' },
  { g: 'adj', head: 'version', p: 'the final version', n: '最終版', en: 'Please use the final version.', ja: '最終版を使ってください' },
  { g: 'adj', head: 'change', p: 'a minor change', n: '小さな変更', en: 'It is only a minor change.', ja: 'ほんの小さな変更です' },
  { g: 'adj', head: 'concern', p: 'a major concern', n: '大きな心配ごと', en: 'Cost is a major concern here.', ja: 'ここでは、費用が大きな心配ごとだ' },
  { g: 'adj', head: 'ground', p: 'common ground', n: '歩み寄れるところ', en: 'We found common ground quickly.', ja: 'すぐに、歩み寄れるところが見つかった' },
  { g: 'adj', head: 'timeline', p: 'a realistic timeline', n: '無理のない日程', en: 'We need a realistic timeline.', ja: '無理のない日程が要る' },
  { g: 'adj', head: 'situation', p: 'the current situation', n: 'いまの状況', en: 'Let me describe the current situation.', ja: 'いまの状況を説明します' },
  { g: 'adj', head: 'plan', p: 'a long-term plan', n: '長い目で見た計画', en: 'This is a long-term plan.', ja: 'これは、長い目で見た計画だ' },
  { g: 'adj', head: 'cost', p: 'the overall cost', n: '全体の費用', en: 'The overall cost went down.', ja: '全体の費用が下がった' },
  { g: 'adj', head: 'win', p: 'a quick win', n: 'すぐ出せる成果', en: 'Let us start with a quick win.', ja: 'すぐ出せる成果から始めましょう' },

  // -- N + N ... 名詞 + 名詞(2語で1つの言葉)
  { g: 'nn', head: 'breakdown', p: 'a cost breakdown', n: '費用の内訳', en: 'Please attach a cost breakdown.', ja: '費用の内訳を付けてください' },
  { g: 'nn', head: 'report', p: 'a progress report', n: '進み具合の報告', en: 'I sent a progress report on Friday.', ja: '金曜に、進み具合の報告を送った' },
  { g: 'nn', head: 'maker', p: 'a decision maker', n: '決める立場の人', en: 'We need a decision maker in the room.', ja: '決める立場の人に、入ってもらう必要がある' },
  { g: 'nn', head: 'request', p: 'a customer request', n: 'お客さんからの頼み', en: 'This came from a customer request.', ja: 'これは、お客さんからの頼みで始まった' },
  { g: 'nn', head: 'plan', p: 'a project plan', n: '案件の計画書', en: 'We need a project plan before Friday.', ja: '金曜までに、案件の計画書が要る' },
  { g: 'nn', head: 'update', p: 'a status update', n: 'いまどうなっているかの報告', en: 'Could I get a status update?', ja: 'いまどうなっているかの報告をもらえますか' },
  { g: 'nn', head: 'cut', p: 'a budget cut', n: '予算の削り', en: 'A budget cut changed everything.', ja: '予算が削られて、すべてが変わった' },
  { g: 'nn', head: 'meeting', p: 'a team meeting', n: 'チームの打ち合わせ', en: 'We have a team meeting every Monday.', ja: '毎週月曜に、チームの打ち合わせがある' },
  { g: 'nn', head: 'assessment', p: 'a risk assessment', n: '危なさの見立て', en: 'They asked for a risk assessment.', ja: '危なさの見立てを出すよう言われた' },
  { g: 'nn', head: 'extension', p: 'a deadline extension', n: '締め切りの延ばし', en: 'We asked for a deadline extension.', ja: '締め切りを延ばしてほしいと頼んだ' },
]

/** id から組を引く。知らない id は `null`(**当てずっぽうで返さない**) */
export const nounPhraseGroupOf = (id) => NOUN_PHRASE_GROUPS.find((g) => g.id === id) ?? null

/**
 * 単語帳の「どの教材の語か」に出す名前。
 *
 * 「名詞句」を頭に付けてあるので、自分の単語帳の教材名と並んでも
 * **どちらの冊の語句か、ひと目で分かる**(コロケーションと同じ作法)。
 */
export const nounPhraseTitle = (id) => {
  const g = nounPhraseGroupOf(id)
  return g ? `名詞句 ${g.label}(${g.name})` : '名詞句'
}

/**
 * ファイルの 80 件 × その人の覚え具合。
 *
 * **行の無い語句は「まだ・箱0・今日出す」。** 待たせる理由がない。
 * 形は `collocationRows()` と**1文字も違えない** ——
 * `Wordbook.jsx` から下を書き分けないためである。
 *
 * @param seen   `word_reviews` の行(`word_norm` で引く)
 * @param today  きょうの日付。`due_on` の既定になる
 */
export function nounPhraseRows(seen = [], { today = '' } = {}) {
  const map = new Map(
    (seen ?? []).map((r) => [String(r?.word_norm ?? ''), r]).filter(([k]) => k),
  )
  return NOUN_PHRASES.map((x) => {
    const key = normWord(x.p)
    const s = map.get(key) ?? null
    return {
      word_norm: key,
      display: x.p,
      /* **どれも空白を含むので句である**(`the cost of delay`) */
      kind: 'phrase',
      pos: posLabel(posGroupOf('phr')),
      /* **意味だけ。** `head`(芯の名詞)は混ぜない ——
         混ぜると4択の選択肢に英語が出て、答えが見えてしまう */
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
      material_title: nounPhraseTitle(x.g),
      material_industry: null,
      material_kind: null,
      material_genre: null,
      material_scene: null,
      material_level: null,
      learn_streak: s?.learn_streak ?? 0,
    }
  })
}
