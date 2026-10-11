/**
 * **ビジネス単語 200 語** —— 単語帳の冊(2026-10 利用者の指定)。
 *
 *   > また、ビジネス単語200語も
 *
 * 【なぜファイルに書いてあるか】
 *   **AI を1回も呼ばない = 0円**にするため。
 *   基礎単語(`basicWords.js`)・コロケーション(`collocations.js`)と
 *   まったく同じ考え方である。**表も列も SQL も1行も要らない** ——
 *   覚え具合だけが `word_reviews` に残る(`src/lib/businessWords.js`)。
 *
 * 【どれも1語。例文つき】
 *   ・**1語だけ**にしてある(`kind: 'word'` が嘘にならない)。
 *     句は、すでに3冊ある(コロケーション / 名詞句 / 副詞句)
 *   ・**例文は必須**(CLAUDE.md「単語帳に例文は必須」)。
 *     人は文脈ごと覚えるし、例文が無いと穴埋め(箱3)が作れない
 *   ・**例文の中に、その語がそのまま出てくる**
 *     (`npm run test:play` が 200 語ぜんぶ数えている)。
 *     活用させると、穴埋めがその語を見つけられない
 *
 * 【ほかの冊と1語も重なっていない】
 *   覚え具合の鍵は**そろえた語**(`normWord`)なので、重なると
 *   **2つの冊で同じ語の覚え具合が動く。** `npm run test:play` が
 *   「基礎単語・コロケーション・名詞句・副詞句と1語も重なっていない」を
 *   見張っている(**実際に 15 語ぶつかっていたので、入れ替えた**)。
 *
 * 【10 の組 × 20 語】
 *   仕事の場面で引けるように、**場面ごと**に分けてある。
 *   組は絞り込みと紙の見出しに出る(`material_title`)。
 *   **一覧を勝手に減らさない。並べ替えない**(CLAUDE.md)。
 *
 * @property w   語(**これが単語帳に入る**)
 * @property ja  意味
 * @property pos 品詞の印(`n` / `v` / `adj` / `adv`)。画面には日本語で出る
 * @property en  例文
 * @property ex  例文の訳
 * @property g   どの組か(`BIZ_GROUPS` の id)
 */

/** 画面に出す冊の名前。**1か所に持つ**(書き写さない) */
export const BIZ_BOOK_LABEL = 'ビジネス単語'

/** 場面の組。**10 組 × 20 語 = 200 語** */
export const BIZ_GROUPS = [
  { id: 'meeting', label: '会議・打ち合わせ' },
  { id: 'nego', label: '交渉・合意' },
  { id: 'sales', label: '営業・顧客' },
  { id: 'project', label: '計画・進行管理' },
  { id: 'finance', label: '数字・業績' },
  { id: 'hr', label: '組織・人事' },
  { id: 'quality', label: '品質・改善' },
  { id: 'legal', label: '契約・法務' },
  { id: 'supply', label: '物流・調達' },
  { id: 'report', label: '報告・連絡' },
]

export const BUSINESS_WORDS = [
  // ── 会議・打ち合わせ ──────────────────────────────────────────────
  { g: 'meeting', w: 'agenda', pos: 'n', ja: '議題', en: 'Let us go through the agenda first.', ex: 'まず議題を確認しましょう' },
  { g: 'meeting', w: 'minutes', pos: 'n', ja: '議事録', en: 'I will send the minutes after the meeting.', ex: '会議のあとで議事録を送ります' },
  { g: 'meeting', w: 'attendee', pos: 'n', ja: '出席者', en: 'Every attendee received a copy.', ex: '出席者全員に資料が渡りました' },
  { g: 'meeting', w: 'preside', pos: 'v', ja: '議長を務める', en: 'She will preside over the meeting on Friday.', ex: '金曜の会議は彼女が議長を務めます' },
  { g: 'meeting', w: 'adjourn', pos: 'v', ja: '散会する', en: 'Let us adjourn and continue tomorrow.', ex: 'いったん散会して明日続けましょう' },
  { g: 'meeting', w: 'brief', pos: 'v', ja: '要点を伝える', en: 'Please brief the team before noon.', ex: '正午までにチームへ要点を伝えてください' },
  { g: 'meeting', w: 'pinpoint', pos: 'v', ja: '的を絞って示す', en: 'Can you pinpoint the cause?', ex: '原因を的を絞って示せますか' },
  { g: 'meeting', w: 'reschedule', pos: 'v', ja: '日程を組み直す', en: 'We had to reschedule the review.', ex: 'レビューの日程を組み直しました' },
  { g: 'meeting', w: 'convene', pos: 'v', ja: '招集する', en: 'We will convene again next week.', ex: '来週もう一度集まります' },
  { g: 'meeting', w: 'facilitate', pos: 'v', ja: '進行役を務める', en: 'He can facilitate the workshop.', ex: '彼がワークショップの進行役をできます' },
  { g: 'meeting', w: 'consensus', pos: 'n', ja: '合意', en: 'We reached a consensus quickly.', ex: 'すぐに合意に達しました' },
  { g: 'meeting', w: 'outline', pos: 'v', ja: '概略を述べる', en: 'Let me outline the plan in three minutes.', ex: '3分で計画の概略をお話しします' },
  { g: 'meeting', w: 'recap', pos: 'v', ja: '要点をもう一度言う', en: 'Let me recap the main points.', ex: '要点をもう一度まとめます' },
  { g: 'meeting', w: 'intervene', pos: 'v', ja: '割って入る', en: 'The manager had to intervene.', ex: '上司が割って入ることになりました' },
  { g: 'meeting', w: 'participate', pos: 'v', ja: '参加する', en: 'I can participate in the morning session.', ex: '午前の回には参加できます' },
  { g: 'meeting', w: 'reminder', pos: 'n', ja: '念押しの知らせ', en: 'I sent a reminder this morning.', ex: '今朝、念押しの知らせを送りました' },
  { g: 'meeting', w: 'remote', pos: 'adj', ja: '遠隔の', en: 'Most of the team is remote this week.', ex: '今週はチームのほとんどが遠隔勤務です' },
  { g: 'meeting', w: 'punctual', pos: 'adj', ja: '時間どおりの', en: 'He is always punctual.', ex: '彼はいつも時間どおりです' },
  { g: 'meeting', w: 'briefly', pos: 'adv', ja: '手短に', en: 'Let me explain briefly.', ex: '手短に説明します' },
  { g: 'meeting', w: 'moderator', pos: 'n', ja: '司会', en: 'The moderator kept us on time.', ex: '司会が時間を守ってくれました' },

  // ── 交渉・合意 ──────────────────────────────────────────────
  { g: 'nego', w: 'negotiate', pos: 'v', ja: '交渉する', en: 'We negotiate prices every quarter.', ex: '四半期ごとに価格を交渉します' },
  { g: 'nego', w: 'counteroffer', pos: 'n', ja: '対案', en: 'They sent a counteroffer yesterday.', ex: '先方は昨日、対案を送ってきました' },
  { g: 'nego', w: 'concession', pos: 'n', ja: '譲歩', en: 'We made one small concession.', ex: '1つだけ小さく譲歩しました' },
  { g: 'nego', w: 'leverage', pos: 'n', ja: '交渉を有利にする力', en: 'We have little leverage in this deal.', ex: 'この取引ではこちらに強みがほとんどありません' },
  { g: 'nego', w: 'compromise', pos: 'n', ja: '妥協', en: 'A compromise is better than no deal.', ex: '話が流れるより妥協したほうがよい' },
  { g: 'nego', w: 'deadlock', pos: 'n', ja: '行き詰まり', en: 'The talks hit a deadlock.', ex: '話し合いは行き詰まりました' },
  { g: 'nego', w: 'proposal', pos: 'n', ja: '提案書', en: 'Our proposal is on the table now.', ex: 'こちらの提案書は先方の手元にあります' },
  { g: 'nego', w: 'bargain', pos: 'v', ja: '値段を交渉する', en: 'They like to bargain hard.', ex: '先方はしっかり値段を交渉してきます' },
  { g: 'nego', w: 'settle', pos: 'v', ja: '決着させる', en: 'Let us settle this today.', ex: '今日のうちに決着させましょう' },
  { g: 'nego', w: 'withdraw', pos: 'v', ja: '取り下げる', en: 'They decided to withdraw the offer.', ex: '先方は申し出を取り下げました' },
  { g: 'nego', w: 'waive', pos: 'v', ja: '放棄する', en: 'We will waive the fee this time.', ex: '今回は手数料を免除します' },
  { g: 'nego', w: 'renegotiate', pos: 'v', ja: '再交渉する', en: 'We may renegotiate next year.', ex: '来年は再交渉するかもしれません' },
  { g: 'nego', w: 'persuade', pos: 'v', ja: '説得する', en: 'We need to persuade the client to wait.', ex: 'お客様に待っていただくよう説得する必要があります' },
  { g: 'nego', w: 'finalize', pos: 'v', ja: '最終決定する', en: 'Let us finalize the terms tomorrow.', ex: '条件は明日、最終決定しましょう' },
  { g: 'nego', w: 'objection', pos: 'n', ja: '異議', en: 'There was one objection from legal.', ex: '法務から異議が1つ出ました' },
  { g: 'nego', w: 'incentive', pos: 'n', ja: '動機づけの条件', en: 'We added an incentive to close faster.', ex: '早く決めてもらうための条件を1つ足しました' },
  { g: 'nego', w: 'mutual', pos: 'adj', ja: '互いの', en: 'We found a mutual benefit.', ex: '互いの利益になる点が見つかりました' },
  { g: 'nego', w: 'tentative', pos: 'adj', ja: '暫定の', en: 'This is a tentative agreement.', ex: 'これは暫定の合意です' },
  { g: 'nego', w: 'reluctant', pos: 'adj', ja: '気乗りしない', en: 'They were reluctant at first.', ex: '先方は最初、気乗りしない様子でした' },
  { g: 'nego', w: 'firmly', pos: 'adv', ja: 'きっぱりと', en: 'She firmly refused the price.', ex: '彼女はその価格をきっぱり断りました' },

  // ── 営業・顧客 ──────────────────────────────────────────────
  { g: 'sales', w: 'prospect', pos: 'n', ja: '見込み客', en: 'She found a promising prospect.', ex: '彼女は有望な見込み客を見つけました' },
  { g: 'sales', w: 'pipeline', pos: 'n', ja: '案件の流れ', en: 'Our pipeline looks healthy.', ex: '案件の流れは良い状態です' },
  { g: 'sales', w: 'quota', pos: 'n', ja: '販売目標', en: 'He reached his quota in May.', ex: '彼は5月に販売目標に届きました' },
  { g: 'sales', w: 'upsell', pos: 'v', ja: '上位の品を売る', en: 'We upsell to existing users.', ex: 'いまのお客様に上位の品をおすすめします' },
  { g: 'sales', w: 'churn', pos: 'n', ja: '解約率', en: 'Churn went down last quarter.', ex: '前の四半期は解約率が下がりました' },
  { g: 'sales', w: 'retention', pos: 'n', ja: '引き留め', en: 'Retention is our main focus.', ex: 'いちばん力を入れているのは引き留めです' },
  { g: 'sales', w: 'referral', pos: 'n', ja: '紹介', en: 'Most leads come from referral.', ex: '見込み客の多くは紹介から来ます' },
  { g: 'sales', w: 'testimonial', pos: 'n', ja: '推薦の声', en: 'We added a customer testimonial.', ex: 'お客様の推薦の声を1つ載せました' },
  { g: 'sales', w: 'demo', pos: 'n', ja: '実演', en: 'Can we book a demo for Thursday?', ex: '木曜に実演の予約を入れられますか' },
  { g: 'sales', w: 'onboarding', pos: 'n', ja: '導入の手助け', en: 'Onboarding takes about two weeks.', ex: '導入の手助けには2週間ほどかかります' },
  { g: 'sales', w: 'quote', pos: 'n', ja: '見積り', en: 'I will send a quote by Friday.', ex: '金曜までに見積りを送ります' },
  { g: 'sales', w: 'subscription', pos: 'n', ja: '継続の契約', en: 'The subscription renews monthly.', ex: '継続の契約は毎月更新されます' },
  { g: 'sales', w: 'discount', pos: 'n', ja: '値引き', en: 'They asked for a bigger discount.', ex: '先方はもっと大きな値引きを求めてきました' },
  { g: 'sales', w: 'renewal', pos: 'n', ja: '更新', en: 'The renewal date is in March.', ex: '更新の日は3月です' },
  { g: 'sales', w: 'territory', pos: 'n', ja: '担当区域', en: 'He covers the western territory.', ex: '彼は西側の担当区域を見ています' },
  { g: 'sales', w: 'commission', pos: 'n', ja: '歩合', en: 'Her commission depends on sales.', ex: '彼女の歩合は売上で決まります' },
  { g: 'sales', w: 'outreach', pos: 'n', ja: '働きかけ', en: 'Our outreach starts on Monday.', ex: '働きかけは月曜から始めます' },
  { g: 'sales', w: 'competitor', pos: 'n', ja: '競合', en: 'A new competitor entered the market.', ex: '新しい競合が市場に入ってきました' },
  { g: 'sales', w: 'loyalty', pos: 'n', ja: '愛着', en: 'Loyalty raises repeat orders.', ex: '愛着が、くり返しの注文を増やします' },
  { g: 'sales', w: 'persistent', pos: 'adj', ja: 'ねばり強い', en: 'A good seller is persistent.', ex: '良い営業はねばり強いものです' },

  // ── 計画・進行管理 ──────────────────────────────────────────────
  { g: 'project', w: 'milestone', pos: 'n', ja: '節目', en: 'We passed the first milestone.', ex: '最初の節目を通過しました' },
  { g: 'project', w: 'deliverable', pos: 'n', ja: '成果物', en: 'The deliverable is due on the tenth.', ex: '成果物の期限は10日です' },
  { g: 'project', w: 'scope', pos: 'n', ja: '範囲', en: 'The scope grew too fast.', ex: '範囲が広がりすぎました' },
  { g: 'project', w: 'backlog', pos: 'n', ja: '未処理の山', en: 'The backlog is shrinking.', ex: '未処理の山は減ってきています' },
  { g: 'project', w: 'bottleneck', pos: 'n', ja: '詰まっている所', en: 'Approval is the bottleneck.', ex: '詰まっているのは承認です' },
  { g: 'project', w: 'kickoff', pos: 'n', ja: '始まりの会', en: 'The kickoff is on Monday.', ex: '始まりの会は月曜です' },
  { g: 'project', w: 'timeline', pos: 'n', ja: '日程', en: 'The timeline is tight.', ex: '日程はきついです' },
  { g: 'project', w: 'allocate', pos: 'v', ja: '割り当てる', en: 'We allocate two engineers to it.', ex: 'そこへ技術者を2人、割り当てます' },
  { g: 'project', w: 'prioritize', pos: 'v', ja: '優先する', en: 'Let us prioritize the login bug.', ex: 'ログインの不具合を優先しましょう' },
  { g: 'project', w: 'escalate', pos: 'v', ja: '上へ上げる', en: 'I had to escalate the issue.', ex: 'その件は上へ上げました' },
  { g: 'project', w: 'delegate', pos: 'v', ja: '任せる', en: 'You should delegate more.', ex: 'もっと人に任せたほうがよいです' },
  { g: 'project', w: 'revise', pos: 'v', ja: '手直しする', en: 'We revise the plan each month.', ex: '計画は毎月、手直しします' },
  { g: 'project', w: 'contingency', pos: 'n', ja: '万一への備え', en: 'We kept a contingency budget.', ex: '万一への備えの予算を残しておきました' },
  { g: 'project', w: 'dependency', pos: 'n', ja: '依存関係', en: 'There is a dependency on the API.', ex: 'API への依存関係が1つあります' },
  { g: 'project', w: 'workload', pos: 'n', ja: '仕事量', en: 'His workload doubled this month.', ex: '今月、彼の仕事量は倍になりました' },
  { g: 'project', w: 'workflow', pos: 'n', ja: '作業の流れ', en: 'The new workflow saves time.', ex: '新しい作業の流れで時間が浮きます' },
  { g: 'project', w: 'handover', pos: 'n', ja: '引き継ぎ', en: 'The handover took one day.', ex: '引き継ぎには1日かかりました' },
  { g: 'project', w: 'overdue', pos: 'adj', ja: '期限を過ぎた', en: 'Three tasks are overdue.', ex: '3つの作業が期限を過ぎています' },
  { g: 'project', w: 'feasible', pos: 'adj', ja: '実現できる', en: 'The plan is feasible.', ex: 'その計画は実現できます' },
  { g: 'project', w: 'accordingly', pos: 'adv', ja: 'それに合わせて', en: 'We will adjust the plan accordingly.', ex: 'それに合わせて計画を直します' },

  // ── 数字・業績 ──────────────────────────────────────────────
  { g: 'finance', w: 'revenue', pos: 'n', ja: '売上', en: 'Revenue rose by eight percent.', ex: '売上は8%伸びました' },
  { g: 'finance', w: 'margin', pos: 'n', ja: '利益率', en: 'The margin is too thin.', ex: '利益率が薄すぎます' },
  { g: 'finance', w: 'overhead', pos: 'n', ja: '間接費', en: 'Overhead went up this year.', ex: '今年は間接費が上がりました' },
  { g: 'finance', w: 'allocation', pos: 'n', ja: '割り当てられた額', en: 'The allocation was cut by ten percent.', ex: '割り当てられた額が1割、減りました' },
  { g: 'finance', w: 'expenditure', pos: 'n', ja: '支出', en: 'Expenditure exceeded the plan.', ex: '支出が計画を超えました' },
  { g: 'finance', w: 'audit', pos: 'n', ja: '監査', en: 'The audit starts in June.', ex: '監査は6月に始まります' },
  { g: 'finance', w: 'asset', pos: 'n', ja: '資産', en: 'The building is our biggest asset.', ex: 'あの建物がいちばん大きな資産です' },
  { g: 'finance', w: 'liability', pos: 'n', ja: '負債', en: 'We reduced our liability.', ex: '負債を減らしました' },
  { g: 'finance', w: 'turnover', pos: 'n', ja: '売上高', en: 'Turnover reached ten million.', ex: '売上高は1千万に達しました' },
  { g: 'finance', w: 'breakeven', pos: 'n', ja: '損益の分かれ目', en: 'We hit breakeven in March.', ex: '3月に損益の分かれ目に届きました' },
  { g: 'finance', w: 'cashflow', pos: 'n', ja: '資金の流れ', en: 'Cashflow is our weak point.', ex: '弱いのは資金の流れです' },
  { g: 'finance', w: 'depreciation', pos: 'n', ja: '減価償却', en: 'Depreciation lowers the figure.', ex: '減価償却でその数字は下がります' },
  { g: 'finance', w: 'variance', pos: 'n', ja: '差異', en: 'The variance was within range.', ex: '差異は許される範囲でした' },
  { g: 'finance', w: 'shareholder', pos: 'n', ja: '株主', en: 'Every shareholder received a letter.', ex: '株主全員に手紙が届きました' },
  { g: 'finance', w: 'valuation', pos: 'n', ja: '評価額', en: 'The valuation doubled in a year.', ex: '1年で評価額が倍になりました' },
  { g: 'finance', w: 'benchmark', pos: 'n', ja: '比べるための基準', en: 'We use last year as a benchmark.', ex: '去年を基準にして比べます' },
  { g: 'finance', w: 'reimburse', pos: 'v', ja: '払い戻す', en: 'We reimburse travel costs.', ex: '交通費は払い戻します' },
  { g: 'finance', w: 'subsidize', pos: 'v', ja: '補助する', en: 'The city will subsidize the course.', ex: '市がその講座を補助します' },
  { g: 'finance', w: 'profitable', pos: 'adj', ja: '採算のとれる', en: 'The line is finally profitable.', ex: 'あの事業はやっと採算がとれました' },
  { g: 'finance', w: 'quarterly', pos: 'adj', ja: '四半期ごとの', en: 'We publish quarterly results.', ex: '四半期ごとの業績を出しています' },

  // ── 組織・人事 ──────────────────────────────────────────────
  { g: 'hr', w: 'recruit', pos: 'v', ja: '採用する', en: 'We recruit twice a year.', ex: '年に2回、採用します' },
  { g: 'hr', w: 'applicant', pos: 'n', ja: '応募者', en: 'Each applicant takes a short test.', ex: '応募者はみな短い試験を受けます' },
  { g: 'hr', w: 'appraisal', pos: 'n', ja: '査定', en: 'The appraisal happens in April.', ex: '査定は4月にあります' },
  { g: 'hr', w: 'promotion', pos: 'n', ja: '昇進', en: 'She earned a promotion this year.', ex: '彼女は今年、昇進しました' },
  { g: 'hr', w: 'headcount', pos: 'n', ja: '人員数', en: 'Headcount stayed flat.', ex: '人員数は変わりませんでした' },
  { g: 'hr', w: 'payroll', pos: 'n', ja: '給与の支払い', en: 'Payroll runs on the twenty-fifth.', ex: '給与の支払いは25日です' },
  { g: 'hr', w: 'mentor', pos: 'n', ja: '指導役', en: 'Every newcomer gets a mentor.', ex: '新しい人にはみな指導役が付きます' },
  { g: 'hr', w: 'subordinate', pos: 'n', ja: '部下', en: 'He trusts his subordinate.', ex: '彼は部下を信頼しています' },
  { g: 'hr', w: 'supervisor', pos: 'n', ja: '上司', en: 'Ask your supervisor first.', ex: 'まず上司に訊いてください' },
  { g: 'hr', w: 'workforce', pos: 'n', ja: '働く人たち全体', en: 'Our workforce is growing.', ex: '働く人の数が増えています' },
  { g: 'hr', w: 'allowance', pos: 'n', ja: '手当', en: 'The housing allowance went up.', ex: '住宅手当が上がりました' },
  { g: 'hr', w: 'overtime', pos: 'n', ja: '残業', en: 'Overtime dropped this month.', ex: '今月は残業が減りました' },
  { g: 'hr', w: 'competency', pos: 'n', ja: '職務に必要な力', en: 'The competency list was updated.', ex: '必要な力の一覧が新しくなりました' },
  { g: 'hr', w: 'probation', pos: 'n', ja: '試用期間', en: 'Probation lasts three months.', ex: '試用期間は3か月です' },
  { g: 'hr', w: 'vacancy', pos: 'n', ja: '欠員', en: 'We have one vacancy in sales.', ex: '営業に1つ欠員があります' },
  { g: 'hr', w: 'resign', pos: 'v', ja: '辞任する', en: 'She will resign in May.', ex: '彼女は5月に辞めます' },
  { g: 'hr', w: 'retain', pos: 'v', ja: '引き留める', en: 'We want to retain good staff.', ex: '良い人には残ってもらいたいです' },
  { g: 'hr', w: 'assign', pos: 'v', ja: '割り当てる', en: 'They assign tasks on Monday.', ex: '仕事の割り当ては月曜です' },
  { g: 'hr', w: 'eligible', pos: 'adj', ja: '資格のある', en: 'You are eligible for the bonus.', ex: '賞与の対象になります' },
  { g: 'hr', w: 'temporarily', pos: 'adv', ja: '一時的に', en: 'He is temporarily in Osaka.', ex: '彼は一時的に大阪にいます' },

  // ── 品質・改善 ──────────────────────────────────────────────
  { g: 'quality', w: 'defect', pos: 'n', ja: '欠陥', en: 'The defect was found early.', ex: '欠陥は早い段階で見つかりました' },
  { g: 'quality', w: 'compliance', pos: 'n', ja: '決まりを守ること', en: 'Compliance is not optional.', ex: '決まりを守るのは選べることではありません' },
  { g: 'quality', w: 'inspection', pos: 'n', ja: '検査', en: 'The inspection passed without issues.', ex: '検査は問題なく通りました' },
  { g: 'quality', w: 'rework', pos: 'n', ja: '手直し', en: 'Rework costs us two days.', ex: '手直しに2日かかります' },
  { g: 'quality', w: 'downtime', pos: 'n', ja: '止まっている時間', en: 'Downtime fell to almost zero.', ex: '止まっている時間はほぼ無くなりました' },
  { g: 'quality', w: 'tolerance', pos: 'n', ja: '許される幅', en: 'The tolerance is very small.', ex: '許される幅はとても小さいです' },
  { g: 'quality', w: 'countermeasure', pos: 'n', ja: '対策', en: 'The countermeasure worked well.', ex: 'その対策はよく効きました' },
  { g: 'quality', w: 'traceability', pos: 'n', ja: '後から追えること', en: 'Traceability is required by law.', ex: '後から追えることが法律で求められます' },
  { g: 'quality', w: 'deviation', pos: 'n', ja: '決まりからの外れ', en: 'One deviation was reported.', ex: '決まりから外れた例が1件、報告されました' },
  { g: 'quality', w: 'scrap', pos: 'n', ja: '使えなくなった品', en: 'Scrap went down by half.', ex: '使えなくなった品は半分に減りました' },
  { g: 'quality', w: 'yield', pos: 'n', ja: '良品の割合', en: 'The yield improved after the change.', ex: '変更のあと、良品の割合が上がりました' },
  { g: 'quality', w: 'recurrence', pos: 'n', ja: '再発', en: 'We stopped the recurrence.', ex: '再発を止めました' },
  { g: 'quality', w: 'threshold', pos: 'n', ja: '境目の値', en: 'The threshold is fifty units.', ex: '境目の値は50個です' },
  { g: 'quality', w: 'standardize', pos: 'v', ja: '形をそろえる', en: 'We standardize every form.', ex: '書式はすべてそろえます' },
  { g: 'quality', w: 'streamline', pos: 'v', ja: '無駄をなくす', en: 'We streamline the process each year.', ex: '毎年、手順の無駄をなくします' },
  { g: 'quality', w: 'calibrate', pos: 'v', ja: '目を合わせる', en: 'We calibrate the sensors monthly.', ex: '計器は毎月、目を合わせます' },
  { g: 'quality', w: 'certify', pos: 'v', ja: '認証する', en: 'They certify each batch.', ex: 'ひと束ごとに認証します' },
  { g: 'quality', w: 'verify', pos: 'v', ja: '確かめる', en: 'Please verify the result twice.', ex: '結果は2回確かめてください' },
  { g: 'quality', w: 'preventive', pos: 'adj', ja: '予防の', en: 'Preventive work saves money.', ex: '予防の手当てはお金を節約します' },
  { g: 'quality', w: 'consistent', pos: 'adj', ja: 'ぶれない', en: 'The quality is consistent.', ex: '品質はぶれていません' },

  // ── 契約・法務 ──────────────────────────────────────────────
  { g: 'legal', w: 'clause', pos: 'n', ja: '条項', en: 'Please read clause four again.', ex: '第4条項をもう一度読んでください' },
  { g: 'legal', w: 'breach', pos: 'n', ja: '違反', en: 'A breach would end the deal.', ex: '違反があれば取引は終わります' },
  { g: 'legal', w: 'indemnity', pos: 'n', ja: '損害の補償', en: 'The indemnity covers both sides.', ex: '補償は双方に効きます' },
  { g: 'legal', w: 'arbitration', pos: 'n', ja: '仲裁', en: 'Arbitration is faster than court.', ex: '仲裁は裁判より早いです' },
  { g: 'legal', w: 'confidentiality', pos: 'n', ja: '守秘', en: 'Confidentiality applies for five years.', ex: '守秘は5年間続きます' },
  { g: 'legal', w: 'amendment', pos: 'n', ja: '修正の取り決め', en: 'The amendment was signed today.', ex: '修正の取り決めに今日、署名しました' },
  { g: 'legal', w: 'jurisdiction', pos: 'n', ja: '管轄', en: 'Jurisdiction is Tokyo.', ex: '管轄は東京です' },
  { g: 'legal', w: 'warranty', pos: 'n', ja: '保証', en: 'The warranty lasts one year.', ex: '保証は1年です' },
  { g: 'legal', w: 'disclosure', pos: 'n', ja: '開示', en: 'Disclosure is required here.', ex: 'ここでは開示が求められます' },
  { g: 'legal', w: 'infringement', pos: 'n', ja: '権利の侵害', en: 'The infringement was accidental.', ex: 'その侵害はうっかりしたものでした' },
  { g: 'legal', w: 'patent', pos: 'n', ja: '特許', en: 'We filed a patent last year.', ex: '去年、特許を出しました' },
  { g: 'legal', w: 'trademark', pos: 'n', ja: '商標', en: 'The trademark is registered.', ex: '商標は登録済みです' },
  { g: 'legal', w: 'provision', pos: 'n', ja: '規定', en: 'One provision is unclear.', ex: '規定の1つがはっきりしません' },
  { g: 'legal', w: 'counterparty', pos: 'n', ja: '相手方', en: 'The counterparty agreed in writing.', ex: '相手方は書面で同意しました' },
  { g: 'legal', w: 'litigation', pos: 'n', ja: '訴訟', en: 'Litigation is our last option.', ex: '訴訟は最後の手です' },
  { g: 'legal', w: 'terminate', pos: 'v', ja: '解除する', en: 'Either side can terminate early.', ex: 'どちらからでも早く解除できます' },
  { g: 'legal', w: 'comply', pos: 'v', ja: '従う', en: 'We comply with local rules.', ex: '現地の決まりに従います' },
  { g: 'legal', w: 'enforce', pos: 'v', ja: '守らせる', en: 'They will enforce the rule from May.', ex: '5月からその決まりを守らせます' },
  { g: 'legal', w: 'binding', pos: 'adj', ja: '拘束力のある', en: 'The contract is binding.', ex: 'その契約には拘束力があります' },
  { g: 'legal', w: 'statutory', pos: 'adj', ja: '法で定められた', en: 'This is a statutory duty.', ex: 'これは法で定められた義務です' },

  // ── 物流・調達 ──────────────────────────────────────────────
  { g: 'supply', w: 'procurement', pos: 'n', ja: '調達', en: 'Procurement takes four weeks.', ex: '調達には4週間かかります' },
  { g: 'supply', w: 'subcontractor', pos: 'n', ja: '下請けの会社', en: 'The subcontractor finished early.', ex: '下請けの会社は早く仕上げました' },
  { g: 'supply', w: 'inventory', pos: 'n', ja: '在庫', en: 'Inventory is too high right now.', ex: 'いま在庫が多すぎます' },
  { g: 'supply', w: 'shipment', pos: 'n', ja: '出荷', en: 'The shipment left on Monday.', ex: '出荷は月曜に出ました' },
  { g: 'supply', w: 'freight', pos: 'n', ja: '貨物の運賃', en: 'Freight costs rose sharply.', ex: '運賃が大きく上がりました' },
  { g: 'supply', w: 'customs', pos: 'n', ja: '税関', en: 'Customs held the box for a day.', ex: '税関で1日止まりました' },
  { g: 'supply', w: 'warehouse', pos: 'n', ja: '倉庫', en: 'The warehouse is nearly full.', ex: '倉庫はほぼ満杯です' },
  { g: 'supply', w: 'forwarder', pos: 'n', ja: '運送を手配する会社', en: 'Our forwarder handles the papers.', ex: '書類は運送会社がやってくれます' },
  { g: 'supply', w: 'tariff', pos: 'n', ja: '関税', en: 'The tariff changed in April.', ex: '関税は4月に変わりました' },
  { g: 'supply', w: 'scarcity', pos: 'n', ja: '品薄', en: 'Scarcity of parts delayed the line.', ex: '部品の品薄で生産が遅れました' },
  { g: 'supply', w: 'surplus', pos: 'n', ja: '余り', en: 'We sold the surplus cheaply.', ex: '余りは安く売りました' },
  { g: 'supply', w: 'logistics', pos: 'n', ja: '物流', en: 'Logistics is the hard part.', ex: '難しいのは物流です' },
  { g: 'supply', w: 'pallet', pos: 'n', ja: '荷台', en: 'One pallet holds forty boxes.', ex: '荷台1つで40箱入ります' },
  { g: 'supply', w: 'consignment', pos: 'n', ja: '委託した品', en: 'The consignment arrived safely.', ex: '委託した品は無事に着きました' },
  { g: 'supply', w: 'backorder', pos: 'n', ja: '取り寄せ', en: 'Two items are on backorder.', ex: '2品は取り寄せになっています' },
  { g: 'supply', w: 'vendor', pos: 'n', ja: '売ってくれる会社', en: 'The vendor raised prices.', ex: '仕入れ先が値上げしました' },
  { g: 'supply', w: 'replenish', pos: 'v', ja: '補充する', en: 'We replenish stock weekly.', ex: '在庫は毎週、補充します' },
  { g: 'supply', w: 'expedite', pos: 'v', ja: '急がせる', en: 'Can you expedite the order?', ex: '注文を急がせられますか' },
  { g: 'supply', w: 'outsource', pos: 'v', ja: '外に出す', en: 'We outsource packaging.', ex: '梱包は外に出しています' },
  { g: 'supply', w: 'traceable', pos: 'adj', ja: '後から追える', en: 'Every box is traceable.', ex: 'どの箱も後から追えます' },

  // ── 報告・連絡 ──────────────────────────────────────────────
  { g: 'report', w: 'attachment', pos: 'n', ja: '添付', en: 'The attachment is missing.', ex: '添付が付いていません' },
  { g: 'report', w: 'recipient', pos: 'n', ja: '受け取る人', en: 'Every recipient must reply.', ex: '受け取った人はみな返信してください' },
  { g: 'report', w: 'draft', pos: 'n', ja: '下書き', en: 'The draft is almost ready.', ex: '下書きはもうすぐできます' },
  { g: 'report', w: 'abstract', pos: 'n', ja: '要旨', en: 'The abstract is on page one.', ex: '要旨は1ページ目です' },
  { g: 'report', w: 'inquiry', pos: 'n', ja: '問い合わせ', en: 'We got an inquiry from Osaka.', ex: '大阪から問い合わせが来ました' },
  { g: 'report', w: 'correspondence', pos: 'n', ja: 'やりとりの記録', en: 'Keep the correspondence on file.', ex: 'やりとりは記録に残しておいてください' },
  { g: 'report', w: 'memo', pos: 'n', ja: '覚書', en: 'A short memo will do.', ex: '短い覚書で十分です' },
  { g: 'report', w: 'briefing', pos: 'n', ja: '説明の場', en: 'The briefing starts at ten.', ex: '説明は10時に始まります' },
  { g: 'report', w: 'disclaimer', pos: 'n', ja: '断り書き', en: 'Add a disclaimer at the end.', ex: '最後に断り書きを足してください' },
  { g: 'report', w: 'status', pos: 'n', ja: '進み具合', en: 'What is the status now?', ex: 'いまの進み具合はどうですか' },
  { g: 'report', w: 'notify', pos: 'v', ja: '知らせる', en: 'Please notify the team today.', ex: '今日チームに知らせてください' },
  { g: 'report', w: 'acknowledge', pos: 'v', ja: '受け取ったと伝える', en: 'Please acknowledge this email.', ex: 'このメールを受け取ったと返してください' },
  { g: 'report', w: 'forward', pos: 'v', ja: '転送する', en: 'I will forward the thread to you.', ex: 'そのやりとりを転送します' },
  { g: 'report', w: 'highlight', pos: 'v', ja: '目立たせる', en: 'Let me highlight one risk.', ex: '1つの危なさを目立たせておきます' },
  { g: 'report', w: 'attach', pos: 'v', ja: '添える', en: 'I will attach the file.', ex: 'ファイルを添えます' },
  { g: 'report', w: 'validate', pos: 'v', ja: '妥当か確かめる', en: 'Please validate the figures by noon.', ex: '正午までに数字が妥当か確かめてください' },
  { g: 'report', w: 'reiterate', pos: 'v', ja: 'もう一度はっきり言う', en: 'Let me reiterate the deadline.', ex: '期限をもう一度はっきり言わせてください' },
  { g: 'report', w: 'circulate', pos: 'v', ja: '回す', en: 'We circulate the report weekly.', ex: '報告は毎週、回しています' },
  { g: 'report', w: 'pending', pos: 'adj', ja: '保留中の', en: 'Two approvals are pending.', ex: '承認が2つ保留中です' },
  { g: 'report', w: 'verbatim', pos: 'adv', ja: '一語一句そのまま', en: 'She quoted him verbatim.', ex: '彼女は彼の言葉を一語一句そのまま引きました' },
]

import { normWord } from '../lib/textNorm.js'
import { posGroupOf, posLabel } from '../lib/posGroups.js'
import { bookVoice } from '../lib/bookVoice.js'

/** その組。**知らない id は null**(当てずっぽうで返さない) */
export const bizGroupOf = (id) =>
  BIZ_GROUPS.find((g) => g.id === String(id ?? '')) ?? null

/**
 * 絞り込みと紙に出す名前。**`material_title` に入れる。**
 *
 * 冊の名前を頭に付けてあるので、自分の単語帳の教材名と並んでも
 * **どちらの冊の語か、ひと目で分かる**(コロケーションと同じ作法)。
 * **冊の名前は `BIZ_BOOK_LABEL` 1か所から引く**(書き写さない)。
 */
export const bizWordTitle = (id) => {
  const g = bizGroupOf(id)
  return g ? `${BIZ_BOOK_LABEL} ${g.label}` : BIZ_BOOK_LABEL
}

/**
 * ファイルの 200 語 × その人の覚え具合。
 *
 * **行の無い語は「まだ・箱0・今日出す」。** 待たせる理由がない。
 * **行の形は `collocationRows()` と1つ残らず同じ** ——
 * ずれると `Wordbook.jsx` が書き分けを持つ(数え方が2通りになる)。
 *
 * @param seen   `word_reviews` の行(`word_norm` で引く)
 * @param today  きょうの日付。`due_on` の既定になる
 */
export function businessWordRows(seen = [], { today = '' } = {}) {
  const map = new Map(
    (seen ?? []).map((r) => [String(r?.word_norm ?? ''), r]).filter(([k]) => k),
  )
  return BUSINESS_WORDS.map((x) => {
    const key = normWord(x.w)
    const s = map.get(key) ?? null
    return {
      word_norm: key,
      display: x.w,
      /* **どれも1語**(`npm run test:play` が見張っている) */
      kind: 'word',
      /* **画面には日本語で出す**(`n` のままだと札に「n」と出る)。
         対応表はここに書かない —— `posGroups.js` 1か所 */
      pos: posLabel(posGroupOf(x.pos)),
      meaning_ja: x.ja,
      /* **出会った文は、この冊の例文そのもの。** 人は文脈ごと覚える(0018)。
         例文が無いと**穴埋め(箱3)が作れない** */
      seen_in: x.en,
      seen_in_ja: x.ex,
      status: s?.status ?? 'unknown',
      box: s?.box ?? 0,
      due_on: s?.due_on ?? today,
      updated_at: s?.updated_at ?? null,
      added_at: s?.added_at ?? null,
      material_id: null,
      material_title: bizWordTitle(x.g),
      material_industry: null,
      material_kind: null,
      material_genre: null,
      material_scene: null,
      material_level: null,
      /* ★ **固定の冊は、良い声で読む**(第5.446節・④)。
         **どの声・どの段かは `bookVoice.js` 1か所。** ここに書き写さない ——
         置く場所の数だけ食い違い、**置き場所が変われば二度課金**になる */
      ...bookVoice(),
      learn_streak: s?.learn_streak ?? 0,
    }
  })
}
