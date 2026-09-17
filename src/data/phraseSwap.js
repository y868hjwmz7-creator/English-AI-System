/**
 * **入れ替えの「骨」** —— 66 型すべてに1本ずつ(2026-09 利用者の指定)。
 *
 *   > 5文だけでなく、そこを言い換える練習ができるようにしたい
 *   > 和らげと名詞句以外にも沢山型があったはずです。……全てを網羅してください
 *
 * ============================================================================
 * 【66 型ぜんぶに骨がある】
 *
 *   はじめは名詞句が入る骨 **7本だけ**だった。
 *   利用者の指摘のとおり、**それでは型の1割しか数をこなせない。**
 *   いまは `sentenceFrames.js` の **66 型すべて**に骨が1本ずつある。
 *   `npm run test:shift` が「66 型ぜんぶに骨があるか」を見張っている ——
 *   型を足して骨を足し忘れたら赤くなる。
 *
 * 【席の種類(`slot`)で、入る肉が決まる】
 *
 *   | `slot` | 入るもの | 出どころ |
 *   |---|---|---|
 *   | `subj`   | 無生物の主語(性格は `pick` が指す) | `swapParts.js`(36) |
 *   | `vp`     | 動詞のかたまり(原形) | `swapParts.js`(24) |
 *   | `ving`   | 動詞のかたまり(~ing) | 同上 |
 *   | `np`     | 名詞句 | `nounPhrases.js`(80) |
 *   | `clause` | 短い文 | `swapParts.js`(16) |
 *   | `own`    | **その骨だけの肉** | ここに書いてある |
 *
 *   **部品を1つ足すと、その席を持つ骨すべてに効く。**
 *
 * 【①は主語を入れ替える】
 *
 *   ① 無生物主語の要点は「**覚えるのは主語ではなく動詞**」なので、
 *   **動詞のほうを固定して主語を入れ替える。**
 *   形容詞を入れ替える形にしなかった理由は `swapParts.js` に書いてある。
 *
 * 【`own` を持つ骨】
 *
 *   ほかの肉を入れると**意味がおかしくなる骨**だけ、自前の肉を持つ
 *   (`the way ___` / `the ___ that we sent yesterday` / `同格` /
 *   `The 比較級, the 比較級`)。**「並んでいるから」では作らない。**
 *
 * 【出せない組み合わせは、はじめから出さない】
 *
 *   骨に肉を入れた文が**狙いの型に見えないものは、出題しない**
 *   (`swapQuestions()` が機械で確かめる)。
 *   確かめられないものを出して「ちがう型です」と言ったら、
 *   正しく言えた人に嘘をつくことになる。
 *
 * @property id   骨の id。**変えない**(覚え具合がこれで付く)
 * @property form 型(`sentenceFrames.js` の `form` と1文字も違えない)
 * @property slot 席の種類
 * @property pick `slot: 'subj'` のとき、どの性格の主語を呼ぶか
 * @property en   骨。`___` のところに肉が入る
 * @property ja   お題の型。`___` のところに肉の意味が入る
 * @property own  その骨だけの肉(`slot: 'own'` のときだけ)
 */

/** 肉を入れるところ。**2か所に書かない** */
export const SWAP_BLANK = '___'

/** 席の種類。**一覧を勝手に減らさない** */
export const SWAP_SLOTS = ['subj', 'vp', 'ving', 'np', 'clause', 'own']

/** 骨。**`sentenceFrames.js` の並びのまま。並べ替えない。減らさない** */
export const SWAP_FRAMES = [
  /* ── ① 1. させる(背中を押す)…… 主語を入れ替える ───────────── */
  { id: 'allow', form: 'S allows 人 to do', slot: 'subj', pick: 'good',  en: '___ allows you to work from home.', ja: '___のおかげで、家で働ける' },
  { id: 'enable', form: 'S enables 人 to do', slot: 'subj', pick: 'good',  en: '___ enables us to cut the cost in half.', ja: '___のおかげで、費用を半分にできる' },
  { id: 'help', form: 'S helps 人 (to) do', slot: 'subj', pick: 'good',  en: '___ helps us meet the deadline.', ja: '___のおかげで、締め切りに間に合う' },
  { id: 'encourage', form: 'S encourages 人 to do', slot: 'subj', pick: 'good',  en: '___ encouraged the team to try again.', ja: '___が、チームをもう一度やってみる気にさせた' },
  { id: 'inspire', form: 'S inspires 人 to do', slot: 'subj', pick: 'good',  en: '___ inspired us to change the plan.', ja: '___が、方針を変える気にさせた' },
  { id: 'lead2', form: 'S leads 人 to do', slot: 'subj', pick: 'bad',  en: '___ led us to rethink the schedule.', ja: '___が、日程を考え直させた' },
  { id: 'prompt', form: 'S prompts 人 to do', slot: 'subj', pick: 'info',  en: '___ prompted us to start earlier.', ja: '___が、早く始めるきっかけになった' },
  { id: 'force', form: 'S forces 人 to do', slot: 'subj', pick: 'bad',  en: '___ forced us to raise the price.', ja: '___のせいで、値段を上げざるをえなかった' },
  { id: 'makedo', form: 'S makes 人 do(原形)', slot: 'subj', pick: 'info',  en: '___ made everyone rethink the plan.', ja: '___が、みんなに計画を考え直させた' },

  /* ── ① 2. させない(妨げる) ────────────────────────────── */
  { id: 'keepfrom', form: 'S keeps 人 from ~ing', slot: 'subj', pick: 'bad',  en: '___ keeps many people from speaking up.', ja: '___が、多くの人の発言を止めている' },
  { id: 'prevent', form: 'S prevents 人 from ~ing', slot: 'subj', pick: 'bad',  en: '___ prevented us from starting on time.', ja: '___のせいで、時間どおりに始められなかった' },
  { id: 'stopfrom', form: 'S stops 人 from ~ing', slot: 'subj', pick: 'bad',  en: '___ stops us from moving faster.', ja: '___が、速く動くのを止めている' },
  { id: 'discourage', form: 'S discourages 人 from ~ing', slot: 'subj', pick: 'bad',  en: '___ discourages people from asking questions.', ja: '___が、質問しにくくさせている' },

  /* ── ① 3. 要る・かかる ─────────────────────────────── */
  { id: 'require1', form: 'S requires 名詞', slot: 'subj', pick: 'task',  en: '___ requires patience.', ja: '___には、辛抱が要る' },
  { id: 'require2', form: 'S requires 人 to do', slot: 'subj', pick: 'task',  en: '___ requires everyone to report weekly.', ja: '___では、全員が毎週報告することになる' },
  { id: 'taketime', form: 'S takes (人) 時間 to do', slot: 'subj', pick: 'task',  en: '___ takes us three weeks to finish.', ja: '___は、終えるのに3週間かかる' },
  { id: 'involve', form: 'S involves ~ing', slot: 'subj', pick: 'task',  en: '___ involves coordinating three teams.', ja: '___には、3つのチームの調整が含まれる' },
  { id: 'callfor', form: 'S calls for 名詞', slot: 'subj', pick: 'task',  en: '___ calls for a quick decision.', ja: '___には、素早い判断が要る' },

  /* ── ① 4. もたらす(結果) ──────────────────────────── */
  { id: 'cause', form: 'S causes 名詞', slot: 'subj', pick: 'bad',  en: '___ caused several errors.', ja: '___が、いくつかの不具合を生んだ' },
  { id: 'leadto', form: 'S leads to 名詞', slot: 'subj', pick: 'bad',  en: '___ leads to delays.', ja: '___は、遅れにつながる' },
  { id: 'result', form: 'S results in 名詞', slot: 'subj', pick: 'bad',  en: '___ resulted in a long delay.', ja: '___の結果、長い遅れが出た' },
  { id: 'bring', form: 'S brings 人 名詞', slot: 'subj', pick: 'good',  en: '___ brought us new customers.', ja: '___が、新しいお客さんを連れてきた' },

  /* ── ① 5. 人を、ある状態にする ──────────────────────── */
  { id: 'makeadj', form: 'S makes 人 形容詞', slot: 'subj', pick: 'bad',  en: '___ makes everyone nervous.', ja: '___が、みんなを落ち着かなくさせる' },
  { id: 'leaveadj', form: 'S leaves 人 形容詞', slot: 'subj', pick: 'bad',  en: '___ left us short on time.', ja: '___のせいで、時間が足りなくなった' },
  { id: 'keepadj', form: 'S keeps 人/物 形容詞', slot: 'subj', pick: 'good',  en: '___ keeps your English sharp.', ja: '___が、英語を鈍らせない' },

  /* ── ① 6. 示す・説明する(会議で頻出) ───────────────── */
  { id: 'show', form: 'S shows / suggests (that) ~', slot: 'subj', pick: 'info',  en: '___ shows that demand is rising.', ja: '___は、需要が伸びていることを示している' },
  { id: 'explain', form: 'S explains why ~', slot: 'subj', pick: 'info',  en: '___ explains why he was late.', ja: '___が、彼の遅れた理由を説明している' },
  { id: 'iswhy', form: 'S is why ~', slot: 'subj', pick: 'info',  en: '___ is why we changed suppliers.', ja: '___が、取引先を変えた理由だ' },
  { id: 'remind', form: 'S reminds 人 that ~', slot: 'subj', pick: 'info',  en: '___ reminds everyone that the deadline is Friday.', ja: '___が、締め切りは金曜だと思い出させる' },

  /* ── ① 7. it を立てる形 ───────────────────────────── */
  { id: 'possible', form: 'S makes it possible to do', slot: 'subj', pick: 'good',  en: '___ makes it possible to hire anywhere.', ja: '___のおかげで、どこの人でも採用できる' },
  { id: 'hardfor', form: 'S makes it hard for 人 to do', slot: 'subj', pick: 'bad',  en: '___ makes it hard for me to focus.', ja: '___のせいで、集中しにくい' },
  { id: 'ittakes', form: 'It takes 時間 to do', slot: 'vp', en: 'It takes three weeks to ___.', ja: '___のに、3週間かかる' },

  /* ── ② 主語の席に、何を入れるか ─────────────────────── */
  { id: 'gerund', form: '動名詞', slot: 'ving', en: '___ takes more time than we think.', ja: '___のは、思ったより時間がかかる' },
  {
    /* **名詞句の総当たりでは 12 / 80 しか当たらなかった**(2026-09 実測)。
       この型が言っているのは「**動詞を名詞にする**」であって、
       名詞句一般ではない。**自前の肉を持たせる**(`the way` と同じ扱い) */
    id: 'nominal',
    form: '名詞化(動詞→名詞)',
    slot: 'own',
    en: '___ surprised everyone.',
    ja: '___に、みんな驚いた',
    own: [
      { en: 'Her decision to leave', ja: '彼女が辞めるという判断' },
      { en: 'His decision to resign', ja: '彼が辞任するという判断' },
      { en: 'The introduction of the new rule', ja: '新しい決まりの導入' },
      { en: 'The cancellation of the order', ja: '注文の取り消し' },
      { en: 'Her promotion to manager', ja: '彼女の管理職への昇進' },
      { en: 'His explanation of the delay', ja: '彼の遅れの説明' },
      { en: 'The completion of the audit', ja: '監査の完了' },
      { en: 'The reduction of the budget', ja: '予算の削減' },
      { en: 'The announcement of the merger', ja: '合併の発表' },
      { en: 'Her resignation', ja: '彼女の辞任' },
      { en: 'The improvement in quality', ja: '品質の向上' },
      { en: 'The delay of the launch', ja: '開始の遅れ' },
      { en: 'His arrival at the office', ja: '彼の出社' },
      { en: 'The refusal of the offer', ja: '申し出の断り' },
      { en: 'Her request for more time', ja: '彼女の時間の願い出' },
      { en: 'The approval of the budget', ja: '予算の承認' },
      { en: 'The closure of the branch', ja: '支店の閉鎖' },
      { en: 'His return to the team', ja: '彼のチームへの復帰' },
      { en: 'The discovery of the error', ja: '誤りの発見' },
      { en: 'The expansion of the service', ja: 'その事業の拡大' },
      { en: 'Her invitation to the event', ja: '彼女への招待' },
      { en: 'The removal of the rule', ja: '決まりの撤廃' },
      { en: 'The recovery of the market', ja: '市場の回復' },
      { en: 'His agreement to the terms', ja: '彼の条件への同意' },      { en: 'The improvement in quality', ja: '品質の向上' },
      { en: 'The expansion into Asia', ja: 'アジアへの展開' },
      { en: 'The selection of a vendor', ja: '取引先の選定' },
    ],
  },
  { id: 'whatclause', form: 'what 節', slot: 'np', en: 'What matters most is ___.', ja: 'いちばん大事なのは___だ' },
  { id: 'factthat', form: 'the fact that', slot: 'clause', en: 'The fact that ___ worries the client.', ja: '___という事実が、取引先を心配させている' },
  {
    id: 'theway',
    form: 'the way / the reason',
    slot: 'own',
    en: 'The way ___ made sense.',
    ja: '___やり方は、腑に落ちた',
    own: [
      { en: 'he explained it', ja: '彼が説明した' },
      { en: 'we handle complaints', ja: '苦情に対応する' },
      { en: 'they run meetings', ja: '彼らが会議を進める' },
      { en: 'the team works together', ja: 'チームで動く' },
      { en: 'she presents numbers', ja: '彼女が数字を見せる' },
      { en: 'we share files', ja: 'ファイルを渡す' },
      { en: 'the system is set up', ja: '仕組みが組んである' },
      { en: 'she answered the question', ja: '彼女が質問に答えた' },
      { en: 'they priced the service', ja: '彼らが値段を決めた' },
      { en: 'we split the work', ja: '仕事を分けた' },
      { en: 'he closed the deal', ja: '彼が話をまとめた' },
      { en: 'the report is written', ja: '報告書の書き方' },
      { en: 'they train new staff', ja: '新しい人を育てる' },
      { en: 'we decide the order', ja: '順番を決める' },
      { en: 'she runs the project', ja: '彼女が案件を回す' },
      { en: 'they check the quality', ja: '品質を確かめる' },
      { en: 'we keep the record', ja: '記録を残す' },
      { en: 'he reads the numbers', ja: '彼が数字を読む' },
      { en: 'the tool is designed', ja: 'その道具の作り' },      { en: 'the system is set up', ja: '仕組みが組んである' },
      { en: 'they answer questions', ja: '彼らが質問に答える' },
    ],
  },
  { id: 'formalit', form: '形式主語 it', slot: 'vp', en: 'It is important to ___.', ja: '___ことが大事だ' },

  /* ── ③ 焦点を当てる ──────────────────────────────── */
  { id: 'itis', form: 'It is X that / who ~', slot: 'np', en: 'It is ___ that we should discuss first.', ja: 'まず話すべきなのは___だ' },
  { id: 'what', form: 'What ~ is …', slot: 'np', en: 'What matters here is ___.', ja: 'ここで大事なのは___だ' },
  { id: 'allhave', form: 'All 人 have to do is do', slot: 'vp', en: 'All you have to do is ___.', ja: 'あなたがすることは、___だけだ' },
  { id: 'reasonis', form: 'The reason ~ is that …', slot: 'clause', en: 'The reason we waited is that ___.', ja: '待ったのは、___からだ' },
  { id: 'thereis', form: 'There is / are ~', slot: 'np', en: 'There is no way around ___.', ja: '___は、避けて通れない' },

  /* ── ③ 話題を先に置く(前置き) ──────────────────────── */
  { id: 'about', form: 'When it comes to ~', slot: 'np', en: 'When it comes to ___, we need to be careful.', ja: '___については、慎重にいきたい' },
  { id: 'asfor', form: 'As for ~', slot: 'np', en: 'As for ___, nothing has changed.', ja: '___については、変わっていない' },
  { id: 'terms', form: 'In terms of ~', slot: 'np', en: 'In terms of ___, we are fine.', ja: '___の点では、問題ない' },
  { id: 'given', form: 'Given (that) ~', slot: 'np', en: 'Given ___, we should wait.', ja: '___を考えると、待つべきだ' },
  { id: 'based', form: 'Based on ~', slot: 'np', en: 'Based on ___, we decided to wait.', ja: '___をふまえて、待つことにした' },

  /* ── ③ 文と文をつなぐ ────────────────────────────── */
  { id: 'thatswhy', form: "That's why ~", slot: 'clause', en: 'That is why ___.', ja: 'だから、___' },
  { id: 'whichmeans', form: 'Which means ~', slot: 'clause', en: 'We are short-staffed, which means ___.', ja: '人手が足りない。つまり___' },
  { id: 'thatsaid', form: 'That said, ~', slot: 'clause', en: 'It is expensive. That said, ___.', ja: '高い。とはいえ、___' },
  { id: 'notonly', form: 'Not only ~ but also …', slot: 'vp', en: 'Not only did it save time, but it also helped us ___.', ja: '時間が浮いただけでなく、___のにも役立った' },

  /* ── ③ 1文を後ろへ伸ばす ─────────────────────────── */
  {
    id: 'relative',
    form: '関係詞',
    slot: 'own',
    en: 'the ___ that we sent yesterday',
    ja: '昨日送った___',
    own: [
      { en: 'report', ja: '報告書' }, { en: 'file', ja: 'ファイル' },
      { en: 'quote', ja: '見積もり' }, { en: 'invoice', ja: '請求書' },
      { en: 'summary', ja: '要約' }, { en: 'draft', ja: '下書き' },
      { en: 'proposal', ja: '提案書' }, { en: 'agenda', ja: '式次第' },
      { en: 'estimate', ja: '見積書' }, { en: 'contract', ja: '契約書' },
      { en: 'form', ja: '用紙' }, { en: 'slide', ja: '資料の1枚' },
      { en: 'photo', ja: '写真' }, { en: 'sample', ja: '見本' },
      { en: 'plan', ja: '計画' }, { en: 'note', ja: '控え' },
      { en: 'list', ja: '一覧' }, { en: 'schedule', ja: '予定表' },
      { en: 'manual', ja: '手引き' }, { en: 'receipt', ja: '領収書' },
      { en: 'proposal', ja: '提案書' }, { en: 'agenda', ja: '式次第' },
    ],
  },
  {
    id: 'presentp',
    form: '現在分詞',
    slot: 'own',
    en: 'the ___ working on it',
    ja: 'それに取り組んでいる___',
    own: [
      { en: 'team', ja: 'チーム' }, { en: 'group', ja: '班' },
      { en: 'engineer', ja: '技術者' }, { en: 'designer', ja: '設計の人' },
      { en: 'vendor', ja: '取引先' }, { en: 'partner', ja: '組んでいる相手' },
      { en: 'agency', ja: '代理店' }, { en: 'department', ja: '部署' },
      { en: 'developer', ja: '開発の人' }, { en: 'consultant', ja: '相談役' },
      { en: 'supplier', ja: '仕入れ先' }, { en: 'contractor', ja: '請け負う会社' },
      { en: 'analyst', ja: '分析の人' }, { en: 'translator', ja: '翻訳の人' },
      { en: 'manager', ja: '管理職' }, { en: 'lawyer', ja: '弁護士' },
      { en: 'auditor', ja: '監査の人' }, { en: 'trainer', ja: '指導する人' },
      { en: 'office', ja: '事務所' }, { en: 'branch', ja: '支店' },      { en: 'agency', ja: '代理店' }, { en: 'department', ja: '部署' },
    ],
  },
  {
    id: 'pastp',
    form: '過去分詞',
    slot: 'own',
    en: 'the ___ sent yesterday',
    ja: '昨日送られた___',
    own: [
      { en: 'report', ja: '報告書' }, { en: 'file', ja: 'ファイル' },
      { en: 'quote', ja: '見積もり' }, { en: 'invoice', ja: '請求書' },
      { en: 'summary', ja: '要約' }, { en: 'draft', ja: '下書き' },
      { en: 'proposal', ja: '提案書' }, { en: 'agenda', ja: '式次第' },
      { en: 'estimate', ja: '見積書' }, { en: 'contract', ja: '契約書' },
      { en: 'form', ja: '用紙' }, { en: 'slide', ja: '資料の1枚' },
      { en: 'photo', ja: '写真' }, { en: 'sample', ja: '見本' },
      { en: 'plan', ja: '計画' }, { en: 'note', ja: '控え' },
      { en: 'list', ja: '一覧' }, { en: 'schedule', ja: '予定表' },
      { en: 'manual', ja: '手引き' }, { en: 'receipt', ja: '領収書' },
      { en: 'proposal', ja: '提案書' }, { en: 'agenda', ja: '式次第' },
    ],
  },
  {
    id: 'apposition',
    form: '同格',
    slot: 'own',
    en: 'our goal, ___',
    ja: '私たちの目標、つまり___',
    own: [
      { en: 'a 20% increase', ja: '20%増' },
      { en: 'a shorter lead time', ja: '納期の短縮' },
      { en: 'a stable supply', ja: '安定した供給' },
      { en: 'a clear process', ja: 'はっきりした進め方' },
      { en: 'a lower cost', ja: 'より低い費用' },
      { en: 'a faster delivery', ja: 'より早い納品' },
      { en: 'a higher standard', ja: 'より高い水準' },
      { en: 'a smaller team', ja: 'より小さなチーム' },
      { en: 'a simpler process', ja: 'より簡単な進め方' },
      { en: 'a wider reach', ja: 'より広い届き方' },
      { en: 'a steady income', ja: '安定した収入' },
      { en: 'a shorter reply time', ja: '返事までの短さ' },
      { en: 'a better fit', ja: 'より合うもの' },
      { en: 'a common format', ja: '共通の書き方' },
      { en: 'a single point of contact', ja: '窓口を1つにすること' },
      { en: 'a written record', ja: '書いた記録' },
      { en: 'a calmer workplace', ja: 'より落ち着いた職場' },
      { en: 'a longer warranty', ja: 'より長い保証' },
      { en: 'a cleaner handover', ja: 'すっきりした引き継ぎ' },
      { en: 'a fair price', ja: '妥当な値段' },
      { en: 'a safer process', ja: 'より安全な進め方' },
      { en: 'a smaller gap', ja: 'より小さな差' },      { en: 'a simpler process', ja: 'より簡単な進め方' },
      { en: 'a better price', ja: 'より良い値段' },
    ],
  },
  { id: 'participle', form: '分詞構文', slot: 'vp', en: 'Having reviewed the data, we decided to ___.', ja: 'データを見たうえで、___ことにした' },

  /* ── ③ やわらげる・提案する(仕事で効く) ───────────── */
  { id: 'worth', form: 'It might be worth ~ing', slot: 'ving', en: 'It might be worth ___.', ja: '___のも、いいかもしれない' },
  { id: 'wondering', form: 'I was wondering if you could ~', slot: 'vp', en: 'I was wondering if you could ___.', ja: '___ていただけないでしょうか' },
  { id: 'possibleq', form: 'Would it be possible to ~', slot: 'vp', en: 'Would it be possible to ___?', ja: '___ことは、できますでしょうか' },
  { id: 'maywant', form: 'We may want to ~', slot: 'vp', en: 'We may want to ___.', ja: '___ほうが、いいかもしれない' },
  { id: 'whatif', form: 'What if we ~', slot: 'vp', en: 'What if we ___?', ja: '___のは、どうでしょう' },

  /* ── ③ 比べる ───────────────────────────────────── */
  { id: 'lessabout', form: 'less about A than B', slot: 'np', en: 'It is less about cost than ___.', ja: '費用よりも、___の話だ' },
  {
    id: 'themore',
    form: 'The 比較級, the 比較級',
    slot: 'own',
    en: 'The more we practice, ___.',
    ja: '練習すればするほど、___',
    own: [
      { en: 'the faster we improve', ja: '速く伸びる' },
      { en: 'the fewer mistakes we make', ja: 'まちがいが減る' },
      { en: 'the easier it gets', ja: '楽になる' },
      { en: 'the better we get', ja: '上手くなる' },
      { en: 'the more confident we feel', ja: '自信がつく' },
      { en: 'the less we worry', ja: '心配しなくなる' },
      { en: 'the smoother it runs', ja: 'なめらかに進む' },
      { en: 'the quicker we finish', ja: '早く終わる' },
      { en: 'the more natural it sounds', ja: '自然に聞こえる' },
      { en: 'the shorter our meetings get', ja: '会議が短くなる' },
      { en: 'the clearer our answers become', ja: '答えがはっきりする' },
      { en: 'the sooner we notice problems', ja: '問題に早く気づく' },
      { en: 'the stronger the team becomes', ja: 'チームが強くなる' },
      { en: 'the lower the risk gets', ja: '危なさが下がる' },
      { en: 'the more we enjoy it', ja: '楽しくなる' },
      { en: 'the harder it is to stop', ja: 'やめにくくなる' },
      { en: 'the wider our vocabulary grows', ja: '語彙が広がる' },
      { en: 'the calmer we stay', ja: '落ち着いていられる' },
      { en: 'the fewer questions we get', ja: '質問が減る' },
      { en: 'the more we notice', ja: '気づくことが増える' },      { en: 'the quicker we finish', ja: '早く終わる' },
    ],
  },
  { id: 'notabutb', form: 'not A but B', slot: 'np', en: 'It is not a cost issue but ___.', ja: '費用の問題ではなく、___だ' },
  { id: 'ratherthan', form: 'A rather than B', slot: 'np', en: 'It is ___ rather than a cost issue.', ja: '費用の問題というより、___だ' },
]

/** id から骨を引く。知らない id は `null`(**当てずっぽうで返さない**) */
export const swapFrameOf = (id) => SWAP_FRAMES.find((f) => f.id === id) ?? null

/** 骨に肉を入れて、英文にする。**入れる場所はここだけが知っている** */
export const swapSentence = (frame, filler) =>
  String(frame?.en ?? '').replace(SWAP_BLANK, String(filler ?? ''))

/** 骨に意味を入れて、お題にする */
export const swapJa = (frame, meaning) =>
  String(frame?.ja ?? '').replace(SWAP_BLANK, String(meaning ?? ''))
