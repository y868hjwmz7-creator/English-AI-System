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
  { en: 'The shared calendar', ja: '共有のカレンダー' },
  { en: 'The new template', ja: '新しいひな形' },
  { en: 'Clear feedback', ja: 'はっきりした助言' },
  { en: 'The extra budget', ja: '追加の予算' },
  { en: 'A short daily meeting', ja: '短い朝の集まり' },
  { en: 'The updated manual', ja: '新しくした手引き' },
  { en: 'Automatic backup', ja: '自動の控え' },
  { en: 'The second reviewer', ja: 'もう一人の確認役' },
  { en: 'Early feedback', ja: '早めの意見' },
  { en: 'A written record', ja: '書いた記録' },
  { en: 'The pilot run', ja: '試しの運用' },
  { en: 'Good preparation', ja: '十分な準備' },
  { en: 'The online form', ja: 'その入力欄' },
  { en: 'A shorter agenda', ja: '短くした議題' },
  { en: 'The new supplier', ja: '新しい仕入れ先' },
  { en: 'Honest reporting', ja: '正直な報告' },
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
  { en: 'The missing file', ja: '見当たらない書類' },
  { en: 'An unclear instruction', ja: 'はっきりしない指示' },
  { en: 'The extra step', ja: '余計な手間' },
  { en: 'Heavy traffic', ja: 'ひどい渋滞' },
  { en: 'The language barrier', ja: '言葉の壁' },
  { en: 'A late reply', ja: '遅い返事' },
  { en: 'The old system', ja: '古い仕組み' },
  { en: 'Poor communication', ja: '連絡不足' },
  { en: 'The staff shortage', ja: '人手不足' },
  { en: 'A wrong assumption', ja: '思い込み' },
  { en: 'The power failure', ja: '停電' },
  { en: 'A crowded schedule', ja: '詰まった予定' },
  { en: 'The paperwork', ja: 'その書類仕事' },
  { en: 'A long approval process', ja: '長い承認の手続き' },
  { en: 'The time difference', ja: '時差' },
  { en: 'Constant interruption', ja: '絶え間ない邪魔' },
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
  { en: 'The result', ja: 'その結果' },
  { en: 'The graph', ja: 'そのグラフ' },
  { en: 'Her message', ja: '彼女の伝言' },
  { en: 'The meeting note', ja: '会議の控え' },
  { en: 'The customer review', ja: 'お客様の評価' },
  { en: 'This number', ja: 'この数字' },
  { en: 'The log', ja: 'その記録' },
  { en: 'His reply', ja: '彼の返事' },
  { en: 'The summary', ja: 'その要約' },
  { en: 'The test result', ja: '試した結果' },
  { en: 'The first draft', ja: '最初の下書き' },
  { en: 'Their answer', ja: '先方の回答' },
  { en: 'The sample', ja: 'その見本' },
  { en: 'The headline', ja: 'その見出し' },
  { en: 'This slide', ja: 'この1枚' },
  { en: 'The complaint', ja: 'その苦情' },
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
  { en: 'The launch', ja: 'その開始' },
  { en: 'This upgrade', ja: 'この入れ替え' },
  { en: 'The training', ja: 'その研修' },
  { en: 'This contract', ja: 'この契約' },
  { en: 'The inspection', ja: 'その点検' },
  { en: 'This change', ja: 'この変更' },
  { en: 'The handover', ja: 'その引き継ぎ' },
  { en: 'This order', ja: 'この注文' },
  { en: 'The repair', ja: 'その修理' },
  { en: 'This proposal', ja: 'この提案' },
  { en: 'The move', ja: 'その引っ越し' },
  { en: 'This trial', ja: 'この試験' },
  { en: 'The cleanup', ja: 'その片付け' },
  { en: 'This installation', ja: 'この設置' },
  { en: 'The negotiation', ja: 'その交渉' },
  { en: 'The redesign', ja: 'その作り直し' },
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
  { bare: 'join the call', ing: 'joining the call', ja: '通話に入る' },
  { bare: 'update the schedule', ing: 'updating the schedule', ja: '予定を更新する' },
  { bare: 'double-check the figures', ing: 'double-checking the figures', ja: '数字を二重に確かめる' },
  { bare: 'work with a smaller team', ing: 'working with a smaller team', ja: '少人数で進める' },
  { bare: 'skip the second step', ing: 'skipping the second step', ja: '2つめの手順を省く' },
  { bare: 'reply within a day', ing: 'replying within a day', ja: '一日以内に返す' },
  { bare: 'share the file in advance', ing: 'sharing the file in advance', ja: '前もってファイルを渡す' },
  { bare: 'set a clear rule', ing: 'setting a clear rule', ja: 'はっきりした決まりを作る' },
  { bare: 'cut the meeting short', ing: 'cutting the meeting short', ja: '会議を短く切り上げる' },
  { bare: 'run a quick test', ing: 'running a quick test', ja: '簡単な試験をする' },
  { bare: 'take notes in English', ing: 'taking notes in English', ja: '英語で記録を取る' },
  { bare: 'order the parts early', ing: 'ordering the parts early', ja: '部品を早めに頼む' },
  { bare: 'reduce travel', ing: 'reducing travel', ja: '移動を減らす' },
  { bare: 'answer in one line', ing: 'answering in one line', ja: '一行で答える' },
  { bare: 'fix the bug today', ing: 'fixing the bug today', ja: '不具合を今日直す' },
  { bare: 'move to the new office', ing: 'moving to the new office', ja: '新しい事務所へ移る' },
  { bare: 'plan for the worst case', ing: 'planning for the worst case', ja: '最悪の場合に備える' },
  { bare: 'learn the new tool', ing: 'learning the new tool', ja: '新しい道具を覚える' },
  { bare: 'stop the trial', ing: 'stopping the trial', ja: '試験をやめる' },
  { bare: 'drop the third option', ing: 'dropping the third option', ja: '3つめの案を落とす' },
  { bare: 'get approval first', ing: 'getting approval first', ja: '先に承認をもらう' },
  { bare: 'write it down', ing: 'writing it down', ja: '書き留める' },
  { bare: 'call the supplier', ing: 'calling the supplier', ja: '仕入れ先に電話する' },
  { bare: 'save two hours a week', ing: 'saving two hours a week', ja: '週に2時間を浮かせる' },
  { bare: 'work in pairs', ing: 'working in pairs', ja: '二人一組で進める' },
  { bare: 'test it on a small group', ing: 'testing it on a small group', ja: '少人数で試す' },
  { bare: 'close the issue', ing: 'closing the issue', ja: 'その件を終わらせる' },
  { bare: 'begin next Monday', ing: 'beginning next Monday', ja: '来週の月曜に始める' },
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
  { en: 'the budget is tight', ja: '予算が厳しい' },
  { en: 'the client is happy', ja: '取引先は満足している' },
  { en: 'we lost the file', ja: 'ファイルを無くした' },
  { en: 'the meeting ran long', ja: '会議が長引いた' },
  { en: 'nobody read the manual', ja: '誰も手引きを読まなかった' },
  { en: 'the plan changed twice', ja: '計画が二度変わった' },
  { en: 'she is on leave', ja: '彼女は休みに入っている' },
  { en: 'the parts arrived late', ja: '部品が遅れて届いた' },
  { en: 'we have two options', ja: '案が2つある' },
  { en: 'the office is closed', ja: '事務所が閉まっている' },
  { en: 'the test failed', ja: '試験に通らなかった' },
  { en: 'demand dropped sharply', ja: '需要が大きく落ちた' },
  { en: 'the rule changed', ja: '決まりが変わった' },
  { en: 'they need an answer today', ja: '先方は今日中に返事が要る' },
  { en: 'the room was too small', ja: '部屋が狭すぎた' },
  { en: 'we finished early', ja: '早く終わった' },
  { en: 'the schedule is full', ja: '予定が埋まっている' },
  { en: 'the quality improved', ja: '品質が良くなった' },
  { en: 'costs are under control', ja: '費用は抑えられている' },
  { en: 'the report was late', ja: '報告書が遅れた' },
  { en: 'no one noticed', ja: '誰も気づかなかった' },
  { en: 'the server crashed', ja: 'サーバーが落ちた' },
  { en: 'the new rule starts in April', ja: '新しい決まりは4月から始まる' },
  { en: 'we asked for more time', ja: '時間をもらうよう頼んだ' },
]
