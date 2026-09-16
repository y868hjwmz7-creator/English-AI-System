/**
 * **入れ替えの「肉」** —— 骨に入れる部品(2026-09 利用者の指定)。
 *
 *   > 和らげと名詞句以外にも沢山型があったはずです。
 *   > 私が全てを思い出せないだけで、などなど、と言う書き方をしましたが、
 *   > 全てを網羅してください
 *
 * ============================================================================
 * 【なぜ部品を分けて持つのか】
 *
 *   66 の型は、**空いている席の種類が違う。**
 *
 *     `___ allows you to work from home.`     … 席は**主語**(無生物)
 *     `We may want to ___.`                   … 席は**動詞のかたまり**
 *     `When it comes to ___, …`               … 席は**名詞句**
 *     `The fact that ___ worries the client.` … 席は**文**
 *
 *   席の種類ごとに部品表を1つ持てば、**66 の骨すべてに肉が回る。**
 *   部品を1つ足すと、**その席を持つ骨すべてに効く**(掛け算)。
 *
 * 【①の型は、主語を入れ替える】
 *
 *   ① 無生物主語の要点は「**覚えるのは主語ではなく動詞**」である
 *   (`sentenceFrames.js` の節の見出し)。だから**動詞のほうを固定して、
 *   主語を入れ替える** —— 「どんなものが主語になれるか」が体に入る。
 *
 *   形容詞を入れ替える形(`S makes 人 ___`)にしなかったのは、
 *   **意味のおかしい文ができる**からである(`keeps everyone tired`)。
 *   主語の入れ替えなら、無生物どうしは**入れ替えても自然**である。
 *
 * 【実在の名前を入れない】
 *
 *   会社名・人名・商品名は書かない(`speechStyles.js` と同じ決まり)。
 * ============================================================================
 */

/**
 * **無生物の主語**(①の 31 型で使う)。**性格ごとに4つに分けてある。**
 *
 * 【なぜ分けるのか】(**書いてから気づいた**)
 *
 *   ひとつの一覧にして総当たりにしたら、**意味のおかしい文が大量に出た。**
 *
 *     ○ This tool helps us meet the deadline.
 *     × The price helps us meet the deadline.      ← 値段が助けてくれる?
 *     × Bad weather allows you to work from home.  ← 悪天候のおかげで?
 *
 *   数えると、`___ allows you to …` に自然に入るのは **20 のうち 7 つ**だけ
 *   だった。**機械は型しか見ないので、この種のおかしさは捕まらない。**
 *   だから**骨のほうが、どの性格の主語を呼ぶかを言う**(`pick`)。
 *
 * 【どれも単数にしてある】
 *
 *   `___ requires patience.` のように**現在形の骨**があるので、
 *   複数の主語を混ぜると `Rising costs requires …` になる。
 *   **一覧の側で単数にそろえる**(骨ごとに書き分けない)。
 */

/** 後押しするもの(させる・可能にする・良い結果をもたらす) */
export const SUBJ_GOOD = [
  { en: 'This tool', ja: 'この道具' },
  { en: 'The update', ja: 'この更新' },
  { en: 'The new system', ja: '新しい仕組み' },
  { en: 'Remote access', ja: '遠隔でつなげること' },
  { en: 'A simple change', ja: 'ちょっとした変更' },
  { en: 'A clear plan', ja: 'はっきりした計画' },
  { en: 'The new rule', ja: '新しい決まり' },
  { en: 'Regular practice', ja: '毎日の練習' },
  { en: 'The checklist', ja: 'その確認表' },
  { en: 'Better training', ja: 'より良い研修' },
]

/** 妨げるもの・困らせるもの(させない・悪い結果をもたらす) */
export const SUBJ_BAD = [
  { en: 'Poor planning', ja: '準備不足' },
  { en: 'The delay', ja: 'その遅れ' },
  { en: 'The noise', ja: 'その騒音' },
  { en: 'A tight deadline', ja: 'きつい締め切り' },
  { en: 'A lack of information', ja: '情報の不足' },
  { en: 'The budget cut', ja: '予算の削減' },
  { en: 'Bad weather', ja: '悪天候' },
  { en: 'The rising cost', ja: '費用の上がり' },
  { en: 'A sudden change', ja: '急な変更' },
  { en: 'The long meeting', ja: '長い会議' },
]

/** 知らせるもの(示す・説明する・思い出させる) */
export const SUBJ_INFO = [
  { en: 'The data', ja: 'そのデータ' },
  { en: 'The report', ja: 'その報告書' },
  { en: 'His comment', ja: '彼の一言' },
  { en: 'The chart', ja: 'その図' },
  { en: 'The email', ja: 'そのメール' },
  { en: 'The survey', ja: 'その調査' },
  { en: 'Her question', ja: '彼女の質問' },
  { en: 'The feedback', ja: 'もらった意見' },
]

/** 仕事・案件(要る・かかる・含む) */
export const SUBJ_TASK = [
  { en: 'This project', ja: 'この案件' },
  { en: 'The setup', ja: 'その段取り' },
  { en: 'This job', ja: 'この仕事' },
  { en: 'The rollout', ja: 'その展開' },
  { en: 'The audit', ja: 'その監査' },
  { en: 'This request', ja: 'この依頼' },
  { en: 'The review', ja: 'その見直し' },
  { en: 'The migration', ja: 'その移行' },
]

/** 性格の一覧。**骨の `pick` は、ここにある名前しか使えない** */
export const SUBJ_KINDS = new Map([
  ['good', SUBJ_GOOD], ['bad', SUBJ_BAD], ['info', SUBJ_INFO], ['task', SUBJ_TASK],
])

/**
 * **動詞のかたまり**(`to ___` / `We may want to ___` などで使う)。
 *
 * `bare` は原形、`ing` は ~ing 形。**~ing を機械で作らない** ——
 * `cut → cutting` のように子音を重ねるものがあり、必ずどこかで間違える。
 * **書いてあるものを引く = 0円**(CLAUDE.md)。
 */
export const SWAP_VERBS = [
  { bare: 'work from home', ing: 'working from home', ja: '家で働く' },
  { bare: 'cut the cost in half', ing: 'cutting the cost in half', ja: '費用を半分にする' },
  { bare: 'share files instantly', ing: 'sharing files instantly', ja: 'その場でファイルを渡す' },
  { bare: 'start earlier', ing: 'starting earlier', ja: '早く始める' },
  { bare: 'check the numbers again', ing: 'checking the numbers again', ja: '数字をもう一度確かめる' },
  { bare: 'move the deadline', ing: 'moving the deadline', ja: '締め切りを動かす' },
  { bare: 'hire anywhere', ing: 'hiring anywhere', ja: 'どこの人でも採用する' },
  { bare: 'split it into two phases', ing: 'splitting it into two phases', ja: '二段階に分ける' },
  { bare: 'report weekly', ing: 'reporting weekly', ja: '毎週報告する' },
  { bare: 'ask for more time', ing: 'asking for more time', ja: '時間をもらうよう頼む' },
  { bare: 'review the contract', ing: 'reviewing the contract', ja: '契約を見直す' },
  { bare: 'train new staff', ing: 'training new staff', ja: '新しい人を育てる' },
  { bare: 'raise the price', ing: 'raising the price', ja: '値段を上げる' },
  { bare: 'meet the deadline', ing: 'meeting the deadline', ja: '締め切りに間に合わせる' },
  { bare: 'keep the cost down', ing: 'keeping the cost down', ja: '費用を抑える' },
  { bare: 'send the report today', ing: 'sending the report today', ja: '今日、報告書を送る' },
  { bare: 'talk to the client', ing: 'talking to the client', ja: '取引先と話す' },
  { bare: 'change the plan', ing: 'changing the plan', ja: '方針を変える' },
  { bare: 'wait one more week', ing: 'waiting one more week', ja: 'もう1週間待つ' },
  { bare: 'find the root cause', ing: 'finding the root cause', ja: '根っこの原因を見つける' },
  { bare: 'explain it again', ing: 'explaining it again', ja: 'もう一度説明する' },
  { bare: 'book the room early', ing: 'booking the room early', ja: '部屋を早めに押さえる' },
  { bare: 'cancel the order', ing: 'cancelling the order', ja: '注文を取り消す' },
  { bare: 'reach the target', ing: 'reaching the target', ja: '目標に届く' },
]

/**
 * **短い文**(`The fact that ___` / `That is why ___` などで使う)。
 * 主語と動詞がそろっていて、前に何を付けても成り立つものだけ。
 */
export const SWAP_CLAUSES = [
  { en: 'demand is rising', ja: '需要が伸びている' },
  { en: 'we are behind schedule', ja: '予定より遅れている' },
  { en: 'the client changed the plan', ja: '取引先が方針を変えた' },
  { en: 'costs went up', ja: '費用が上がった' },
  { en: 'the team is short-staffed', ja: 'チームの人手が足りない' },
  { en: 'nobody asked', ja: '誰も質問しなかった' },
  { en: 'the numbers look good', ja: '数字は良さそうだ' },
  { en: 'the deadline moved', ja: '締め切りがずれた' },
  { en: 'we need more time', ja: 'もっと時間が要る' },
  { en: 'the system is down', ja: '仕組みが止まっている' },
  { en: 'sales dropped last month', ja: '先月、売上が落ちた' },
  { en: 'the report is ready', ja: '報告書ができている' },
  { en: 'he missed the train', ja: '彼は電車に乗り遅れた' },
  { en: 'the price is too high', ja: '値段が高すぎる' },
  { en: 'everyone agreed', ja: '全員が賛成した' },
  { en: 'it takes three weeks', ja: '3週間かかる' },
]
