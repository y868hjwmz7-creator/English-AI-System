/**
 * **副詞句** —— 単語帳(2026-09 利用者の指定)。
 *
 *   > ビジネスで使用する副詞句50
 *
 * ============================================================================
 * 【名詞句・コロケーションと、何が違うのか】
 *
 *   名詞句は**文の席に入るもの**、コロケーションは**動詞と目的語の組**である。
 *   副詞句は**文にそえるもの** —— いつ・どのくらい・どんな立場で、を足す。
 *
 *     We will send it.                          … 骨だけ
 *     We will send it 〔 by the end of the day 〕. … いつ
 *     〔 To be honest 〕, we will send it tomorrow.  … どんな立場で
 *
 *   **文の意味は変えずに、当たりと正確さを変える。**
 *   仕事の英語で「言えると急に大人びる」のがここである。
 *
 * 【なぜファイルに書いてあるか】
 *
 *   **AI を1回も呼ばない = 0円。**
 *   名詞句(`nounPhrases.js`)・コロケーション(`collocations.js`)と
 *   まったく同じ考え方である。**表も列も SQL も1行も要らない** ——
 *   覚え具合だけが `word_reviews` に残る(`src/lib/adverbPhraseWords.js`)。
 *
 * 【鍵は「そろえた語句」】
 *
 *   単語帳の鍵は `normWord(p)` である。どれも空白を含むので**句**
 *   (`kind: 'phrase'`)。
 *
 * 【一覧を勝手に減らさない】
 *
 *   `npm run test:play` が **50 件**と、組ごとの中身を数えている。
 *
 * @property g  はたらきの組
 * @property p  副詞句(**これが単語帳に入る**)
 * @property n  意味(単語帳の「意味」)。**英語を混ぜない**(4択で答えが見える)
 * @property en 例文。**必ず `p` をそのまま含む**(`npm run test:play` が見張る)
 * @property ja 例文の訳
 */
import { normWord } from '../lib/textNorm.js'
import { posGroupOf, posLabel } from '../lib/posGroups.js'

/** はたらきの組。**並べ替えない。減らさない** */
export const ADVERB_PHRASE_GROUPS = [
  { id: 'time', label: 'いつ', name: '時をそえる', point: 'いつまでに・どのくらいで' },
  { id: 'degree', label: 'どのくらい', name: '程度をそえる', point: 'どこまで当てはまるか' },
  { id: 'place', label: 'どこで', name: '場所・範囲をそえる', point: '現場で・書類の上では' },
  { id: 'stance', label: 'ことわる', name: '言い方に断りをそえる', point: '正直に言うと・厳密には' },
  { id: 'connect', label: 'つなぐ', name: '前の文とつなぐ', point: 'その結果・一方で' },
  { id: 'manner', label: 'やり方', name: 'やり方をそえる', point: '直接会って・文書で' },
  { id: 'cond', label: '条件', name: '条件・立場をそえる', point: '必要なら・いずれにせよ' },
]

/** 厳選 50 件。**並べ替えない。減らさない。後ろへ足す** */
export const ADVERB_PHRASES = [
  // -- いつ
  { g: 'time', p: 'as soon as possible', n: 'できるだけ早く', en: 'Please send it as soon as possible.', ja: 'できるだけ早く送ってください' },
  { g: 'time', p: 'by the end of the day', n: '今日じゅうに', en: 'I will finish it by the end of the day.', ja: '今日じゅうに終わらせます' },
  { g: 'time', p: 'ahead of schedule', n: '予定より早く', en: 'We finished ahead of schedule.', ja: '予定より早く終わった' },
  { g: 'time', p: 'on short notice', n: '急な話で', en: 'Thank you for coming on short notice.', ja: '急な話で来ていただき、ありがとうございます' },
  { g: 'time', p: 'in the meantime', n: 'そのあいだに', en: 'In the meantime, please review the draft.', ja: 'そのあいだに、下書きを見ておいてください' },
  { g: 'time', p: 'from now on', n: 'これからは', en: 'From now on, we will report weekly.', ja: 'これからは、毎週報告します' },

  // -- どのくらい
  { g: 'degree', p: 'more or less', n: 'だいたい', en: 'The plan is more or less ready.', ja: '計画は、だいたいできている' },
  { g: 'degree', p: 'to some extent', n: 'ある程度', en: 'I agree to some extent.', ja: 'ある程度は賛成です' },
  { g: 'degree', p: 'for the most part', n: '大部分は', en: 'For the most part, the data looks good.', ja: '大部分は、データは良さそうだ' },
  { g: 'degree', p: 'at least', n: '少なくとも', en: 'We need at least three weeks.', ja: '少なくとも3週間は要る' },
  { g: 'degree', p: 'at most', n: '多くても', en: 'It will take two days at most.', ja: '多くても2日で終わる' },
  { g: 'degree', p: 'in most cases', n: 'たいていの場合', en: 'In most cases, the client decides.', ja: 'たいていの場合、取引先が決める' },
  { g: 'degree', p: 'as a rule', n: '原則として', en: 'As a rule, we do not accept late changes.', ja: '原則として、遅い変更は受けません' },
  { g: 'degree', p: 'by and large', n: 'おおむね', en: 'By and large, the team is happy.', ja: 'おおむね、チームは満足している' },

  // -- どこで
  { g: 'place', p: 'across the board', n: '全体にわたって', en: 'Costs went up across the board.', ja: '費用が、全体にわたって上がった' },
  { g: 'place', p: 'on site', n: '現場で', en: 'Two engineers will work on site.', ja: '技術者が2人、現場で作業します' },
  { g: 'place', p: 'in house', n: '社内で', en: 'We built the tool in house.', ja: 'その道具は、社内で作った' },
  { g: 'place', p: 'on paper', n: '書類のうえでは', en: 'On paper, the plan works.', ja: '書類のうえでは、計画は成り立つ' },
  { g: 'place', p: 'in practice', n: '実際には', en: 'In practice, it takes longer.', ja: '実際には、もっと時間がかかる' },
  { g: 'place', p: 'in theory', n: '理屈のうえでは', en: 'In theory, we can finish today.', ja: '理屈のうえでは、今日じゅうに終わる' },

  // -- ことわる
  { g: 'stance', p: 'to be honest', n: '正直に言うと', en: 'To be honest, I am not sure.', ja: '正直に言うと、自信がありません' },
  { g: 'stance', p: 'to be fair', n: '公平に見れば', en: 'To be fair, they had little time.', ja: '公平に見れば、相手には時間が無かった' },
  { g: 'stance', p: 'in short', n: '手短に言えば', en: 'In short, we need more people.', ja: '手短に言えば、人手が要る' },
  { g: 'stance', p: 'in other words', n: '言いかえると', en: 'In other words, the deadline moved.', ja: '言いかえると、締め切りがずれた' },
  { g: 'stance', p: 'as far as I know', n: '私の知るかぎり', en: 'As far as I know, nothing has changed.', ja: '私の知るかぎり、変わっていません' },
  { g: 'stance', p: 'generally speaking', n: '一般に言えば', en: 'Generally speaking, smaller teams move faster.', ja: '一般に言えば、小さいチームのほうが速い' },
  { g: 'stance', p: 'strictly speaking', n: '厳密に言えば', en: 'Strictly speaking, that is not our job.', ja: '厳密に言えば、それは私たちの仕事ではない' },
  { g: 'stance', p: 'needless to say', n: '言うまでもなく', en: 'Needless to say, safety comes first.', ja: '言うまでもなく、安全が先です' },
  { g: 'stance', p: 'as a matter of fact', n: '実のところ', en: 'As a matter of fact, we already started.', ja: '実のところ、もう始めています' },
  { g: 'stance', p: 'more importantly', n: 'もっと大事なことに', en: 'More importantly, the client agreed.', ja: 'もっと大事なことに、取引先が納得した' },

  // -- つなぐ
  { g: 'connect', p: 'as a result', n: 'その結果', en: 'As a result, we missed the deadline.', ja: 'その結果、締め切りに間に合わなかった' },
  { g: 'connect', p: 'for that reason', n: 'そういう理由で', en: 'For that reason, we changed the plan.', ja: 'そういう理由で、方針を変えた' },
  { g: 'connect', p: 'on the other hand', n: '一方で', en: 'On the other hand, the cost is lower.', ja: '一方で、費用は安い' },
  { g: 'connect', p: 'in addition', n: 'そのうえ', en: 'In addition, we added two people.', ja: 'そのうえ、2人増やした' },
  { g: 'connect', p: 'at the same time', n: '同時に', en: 'At the same time, we have to watch the budget.', ja: '同時に、予算も見ておく必要がある' },
  { g: 'connect', p: 'in contrast', n: 'それに対して', en: 'In contrast, last year was quiet.', ja: 'それに対して、昨年は静かだった' },
  { g: 'connect', p: 'for example', n: 'たとえば', en: 'For example, we could split the work.', ja: 'たとえば、仕事を分けることもできる' },
  { g: 'connect', p: 'in particular', n: 'とりわけ', en: 'In particular, the timing worries me.', ja: 'とりわけ、時期が気になる' },

  // -- やり方
  { g: 'manner', p: 'on purpose', n: 'わざと', en: 'They left it out on purpose.', ja: 'わざと外したのだ' },
  { g: 'manner', p: 'by mistake', n: '間違って', en: 'I sent the old file by mistake.', ja: '間違って、古いファイルを送ってしまった' },
  { g: 'manner', p: 'step by step', n: '一歩ずつ', en: 'Let us do it step by step.', ja: '一歩ずつ進めましょう' },
  { g: 'manner', p: 'in person', n: '直接会って', en: 'I would rather discuss it in person.', ja: 'できれば、直接会って話したい' },
  { g: 'manner', p: 'over the phone', n: '電話で', en: 'We settled it over the phone.', ja: '電話で片づけた' },
  { g: 'manner', p: 'in writing', n: '文書で', en: 'Please confirm it in writing.', ja: '文書で確かめてください' },

  // -- 条件
  { g: 'cond', p: 'if necessary', n: '必要なら', en: 'We can add a session if necessary.', ja: '必要なら、1回増やせます' },
  { g: 'cond', p: 'if possible', n: 'できれば', en: 'If possible, send it today.', ja: 'できれば、今日じゅうに送ってください' },
  { g: 'cond', p: 'under the circumstances', n: 'この状況では', en: 'Under the circumstances, waiting is wise.', ja: 'この状況では、待つのが賢明だ' },
  { g: 'cond', p: 'in any case', n: 'いずれにせよ', en: 'In any case, we should tell the client.', ja: 'いずれにせよ、取引先には伝えるべきだ' },
  { g: 'cond', p: 'at your convenience', n: 'ご都合のよいときに', en: 'Please reply at your convenience.', ja: 'ご都合のよいときに、お返事ください' },
  { g: 'cond', p: 'without fail', n: '必ず', en: 'Send the report on Friday without fail.', ja: '金曜に、必ず報告書を送ってください' },
]

/** id から組を引く。知らない id は `null`(**当てずっぽうで返さない**) */
export const adverbPhraseGroupOf = (id) => ADVERB_PHRASE_GROUPS.find((g) => g.id === id) ?? null

/**
 * 単語帳の「どの教材の語か」に出す名前。
 * 「副詞句」を頭に付けてあるので、並んでもどの冊の語句か、ひと目で分かる。
 */
export const adverbPhraseTitle = (id) => {
  const g = adverbPhraseGroupOf(id)
  return g ? `副詞句 ${g.label}(${g.name})` : '副詞句'
}

/**
 * ファイルの 50 件 × その人の覚え具合。
 *
 * 形は `nounPhraseRows()` / `collocationRows()` と**1文字も違えない** ——
 * `Wordbook.jsx` から下を書き分けないためである。
 *
 * @param seen   `word_reviews` の行(`word_norm` で引く)
 * @param today  きょうの日付。`due_on` の既定になる
 */
export function adverbPhraseRows(seen = [], { today = '' } = {}) {
  const map = new Map(
    (seen ?? []).map((r) => [String(r?.word_norm ?? ''), r]).filter(([k]) => k),
  )
  return ADVERB_PHRASES.map((x) => {
    const key = normWord(x.p)
    const s = map.get(key) ?? null
    return {
      word_norm: key,
      display: x.p,
      kind: 'phrase',
      pos: posLabel(posGroupOf('phr')),
      meaning_ja: x.n,
      seen_in: x.en,
      seen_in_ja: x.ja,
      status: s?.status ?? 'unknown',
      box: s?.box ?? 0,
      due_on: s?.due_on ?? today,
      updated_at: s?.updated_at ?? null,
      added_at: s?.added_at ?? null,
      material_id: null,
      material_title: adverbPhraseTitle(x.g),
      material_industry: null,
      material_kind: null,
      material_genre: null,
      material_scene: null,
      material_level: null,
      learn_streak: s?.learn_streak ?? 0,
    }
  })
}
