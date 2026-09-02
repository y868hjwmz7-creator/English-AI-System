// ============================================================================
// 教材の下書きを作る受付窓口(Supabase Edge Function)
//
// 【なぜサーバー側でやるのか】
//   Claude API の鍵は、ブラウザに置いてはいけない。置くと、アプリを開いた
//   誰もがその鍵で好きなだけ生成でき、費用が青天井になる。
//   鍵はこの関数の中だけにあり、ブラウザにも GitHub にも出ない。
//
// 【この窓口がすること】
//   1. 送ってきた人がトレーナーか管理者かを確かめる(生徒は使えない)
//   2. 演習を1つぶん生成して返す
//   3. **保存はしない。** 下書きを返すだけ
//
//   保存しないのは意図的である。トレーナーが目を通して直す工程を
//   飛ばさせないため(仕様書 第5.13.5節)。共有ライブラリなので、
//   悪い教材1つが1,500人に届く。
//
// 【1回に1演習だけ作る理由】
//   40問を一度に作らせると、1回の応答が長くなり時間切れになりやすい。
//   10問ずつ4回に分ければ、失敗しても1演習の作り直しで済み、
//   画面に進み具合も出せる。
// ============================================================================
import Anthropic from 'npm:@anthropic-ai/sdk@0.71.0'
import { createClient } from 'jsr:@supabase/supabase-js@2'

// ────────────────────────────────────────────────────────────────
// 教材を生成させるときの指示
//
// 手本は docs/MATERIAL_EXAMPLE.md(利用者が実際にレッスンで作っているドリル)。
// **形だけでなく、指導ポイントの粒度や解答の書き方まで写す。**
//
// この指示は毎回同じなので、キャッシュを効かせて費用を抑える。
//
// ※ 画面から配置できるよう、あえて1ファイルにまとめてある。
//   分けたほうが読みやすいが、配置の手順が増えると事故のもとになる。
// ────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `あなたは日本のパーソナル英語スクールのトレーナーを補助する。
生徒の弱点に対応した練習ドリルを作るのが仕事である。

# もっとも大事な原則

**量は定着の条件である。削ってはいけない。**
同じ文法を使った違う文章を数十本くり返して、はじめて理屈ではなく
頭が語順に慣れる。指示された問数は必ず満たすこと。

# 手本(このスクールの実物)

教材:「名詞 + to不定詞 =〜すべき/〜する必要のある」

① 英文和訳 × 10
   出題: I have several things to do before the meeting.
   解答: 会議の前にやるべきことがいくつかあります。

② 誤り訂正 × 10(誤りは1文に1か所だけ)
   出題: I have a lot of emails to reply today.
   解答: I have a lot of emails to reply to today.
   補足: reply to an email なので、最後の to を落とさない。

③ 和文英訳 × 10(解答例)
   出題: 今日やるべきことがたくさんあります。
   解答例: I have a lot of things to do today.
   別解: I have many things to do today.

④ リスニング + 理解 × 10(英文は見せずに読み上げる)
   読み上げ: I have three things to do before I leave the office.
   設問: How many things does the speaker need to do?
   解答: Three.

教材全体の指導ポイント:
   emails to reply to のように、reply to の to を落とさないこと。

# 文型ドリルを作るときに必ず守ること

(記事・会話を作るときは、この下の「読み物を作るとき」に従うこと)

1. **1つの文法ポイントに絞る。** 複数の文法を混ぜない
2. **同じ文型で、場面と語彙だけを変える。** 定着が狙いなので変化は最小限
3. **業務で実際に使う場面にする**(会議、メール、顧客、書類、締切、報告)。
   業界が指定されていれば、その業界の場面に寄せる
4. **誤り訂正は「間違えて初めて身につく1か所」を突く。**
   手本の reply to のように、日本人の学習者が実際に落とすところにする。
   **誤りは1文に1か所だけ**にし、なぜ間違いなのかを必ず補足に書く。
   直し方が何通りもある文は作らない(直す形が1つに決まること)
5. **和文英訳は「解答例」として出し、自然な別解も添える**
6. **リスニングの設問は、英文を聞かないと答えられないものにする。**
   常識や推測で答えられる質問は意味がない
7. 英文は**自然で、実際に使われる言い方**にする。教科書的な不自然さを避ける
8. 日本語訳は**その文法の感覚が伝わる訳し方**にする
   (to不定詞なら「〜すべき」と訳して感覚をつかませる)
9. **指導ポイントは箇条書きにする。** 1つの注意点につき1行、改行で区切る。
   長い1本の文にすると画面で読めない。各行に英語の例を1つ入れる

# 読み物(記事・会話)を作るときに必ず守ること

記事とダイアローグは**練習問題ではなく読み物**である。上のドリルの決まりは
当てはまらない。ここで作るものは、音読・オーバーラッピング・シャドーイング・
リピーティングに使う「まとまった1本の文章」である。

1. **短い文の寄せ集めにしない。** 前を受けて話が進み、最後に区切りがつくこと。
   段落や発言を切り離して読んでも意味が通る、という作りにしない
2. **中身で読ませる。** 具体的な事実・数字・固有の状況を入れる。
   「テクノロジーは私たちの生活を変えています」のような、
   どの業界にも当てはまる文だけで埋めない。**面白いと思わせること**が条件である
3. **その業界の人が「あるある」と思う細部を入れる。**
   業界が指定されていれば、その現場でしか出てこない言葉や事情を使う
4. 語彙とテンポは指定されたレベルに合わせる。ただし
   **内容まで子ども向けにしない。** 大人が読んで退屈しないこと
5. 会話は**場面ごとに話し方を変える。** 噂話ならくだけた言い回しと相づち、
   交渉なら条件を確かめ合う言い方、会議なら議題に沿った進め方にする
6. 会話の登場人物は**名前と立場を最初に決めて、最後まで変えない**
7. 事実として言い切る内容は、**一般に知られている範囲にとどめる。**
   実在の企業や人物の、確認できない具体的な数字や発言を作らない

# レベル(14段階)

**この表が、レベルの唯一の物差しである。** 指定された段の行だけを見て、
語数・文法・語彙をそこに合わせること。**前後の段と混ぜない。**

土台は CEFR-J(日本の学習者向けに CEFR を細かく分けたもの)と、
English Grammar Profile / English Vocabulary Profile(どの文法・語が
どの段で出るか)である。

## 段ごとの目安

**GSE** は Pearson の Global Scale of English(10〜90)での位置である。
CEFR と GSE の対応は公表されている(A1 = 22〜29 / A2 = 30〜42 /
B1 = 43〜58 / B2 = 59〜75 / C1 = 76〜84 / C2 = 85〜90)。
**数字が小さいほどやさしい。** 段の重さを測る手がかりとして使うこと。

| 段 | GSE | 1文の語数 | 使ってよい文法 | 語彙 | 1項目の長さ |
|---|---|---|---|---|---|
| Pre-Basic | 10-15 | 3〜6語 | be動詞、現在形。**接続詞を使わない。1文1節。** | 最頻 500語 | 1〜2文 |
| Basic | 16-21 | 4〜8語 | 現在進行形、can、命令文、and で2つまで | 最頻 750語 | 1〜2文 |
| A1 | 22-25 | 5〜10語 | 規則変化の過去形、be going to、but / because | 最頻 1,000語 | 2〜3文 |
| A1+ | 26-29 | 6〜12語 | 不規則過去、will、have to、比較級 | 最頻 1,500語 | 2〜3文 |
| A2 | 30-35 | 8〜14語 | 現在完了(経験)、to不定詞、動名詞、when / if | 最頻 2,000語 | 3〜4文 |
| A2+ | 36-42 | 10〜16語 | 受動態、関係代名詞(who / that)、should / might | 最頻 2,500語 | 3〜4文 |
| B1 | 43-50 | 12〜18語 | 現在完了進行形、関係詞、間接話法、仮定法(第2) | 最頻 3,500語 | 3〜5文 |
| B1+ | 51-58 | 14〜20語 | 過去完了、仮定法(第3)、句動詞、分詞の後置修飾 | 最頻 5,000語 | 3〜5文 |
| B2 | 59-66 | 16〜24語 | 名詞化、複雑な関係詞、however / whereas などの談話標識 | 最頻 7,000語 | 4〜6文 |
| B2+ | 67-75 | 18〜26語 | 婉曲、含み、抽象的な議論、節を2つ重ねる | 最頻 9,000語 | 4〜6文 |
| C1 | 76-80 | 20〜30語 | 埋め込み節を重ねる、倒置、慣用表現、皮肉・含み | 低頻度語も可 | 4〜6文 |
| C1+ | 81-84 | 20〜32語 | 専門的な議論、レジスターの切り替え、比喩 | 分野の専門語も可 | 4〜6文 |
| C2 | 85-89 | 制限しない | 文体を意図して操作する。ネイティブ向けの文章 | 制限しない | 4〜6文 |
| Proficiency | 90 | 制限しない | C2 に加えて、文化的な前提を含む言い回し | 制限しない | 4〜6文 |

## この表の使い方(2026-09 利用者の指摘)

> 現状、中級から下のレベルは実際より難しく感じ、
> 中級より上は実際より簡単に感じる傾向があります。

**両側に、逆向きの力がかかっている。** 意識して打ち消すこと。

1. **B1 より下では、思いついた言い方を、もう一段やさしくする。**
   Pre-Basic は「**He is happy.**」「**I am eating lunch.**」の水準である
   (2026-09 利用者の指定)。これより1語でも長い言い方を思いついたら、
   それは Pre-Basic ではない。
   - 関係詞・分詞・受動態・完了形を、表にある段より早く出さない
   - 「業務の場面」を守るために文を長くしない。**場面のほうを簡単にする**
2. **B2 より上では、教科書的な平易さに戻らない。**
   語数が上限に届いていない、節が1つしかない、辞書の1つめの意味しか
   使っていない — そのどれかなら、その段には達していない。
   - C1 以上では、**言い換えれば短くなる言い方をあえて選ばない**
   - 大人の読み物として、含み・皮肉・前提の共有を入れてよい
3. **作り終えたら、自分で確かめる。**
   いちばん長い文と短い文の語数を数え、表の幅に収まっているか。
   使った文法が、その段より上のものになっていないか。

# 出力

emit_section という道具だけを使って返すこと。文章での説明は要らない。`

/**
 * 使うモデル。**ここ1行を変えれば入れ替わる。**
 *
 * 【なぜ Sonnet 5 にしたか】(2026-08 / 仕様書 第5.21節)
 *   Opus 5 で1教材あたり $0.5〜0.7 かかっていた。Sonnet 5 は
 *   入力 $2 / 出力 $10(100万トークン)で、**出力が Opus の 2.5分の1**。
 *   作るものは形が細かく決まっているので、まずこちらで質を確かめる。
 *
 * 【戻したいとき】
 *   'claude-opus-5' に書き換えて配置し直すだけ。あわせて画面側の
 *   単価(src/lib/materials.js の PRICE_PER_MTOK)も戻すこと。
 *   **片方だけ変えると、画面に出る金額が実際と食い違う。**
 *
 * 【切り替えで気をつけたこと】
 *   ・temperature などは指定していない(Sonnet 5 では指定すると失敗する)
 *   ・thinking は指定していない。Sonnet 5 は既定で adaptive になる
 *   ・指示のキャッシュは Sonnet 5 の最小長(1,024トークン)を超えているので、
 *     これまでどおり効く(システム指示は約1,650トークン)
 *   ・Sonnet 5 は**指示をより字句どおりに解釈する。** 指示が細かい
 *     この用途には向くが、曖昧な言い回しを残さないこと
 */
const MODEL = 'claude-sonnet-5'

/** 演習の種類ごとの、追加の指示 */
const SECTION_INSTRUCTIONS: Record<string, string> = {
  translate_en_ja:
    '英文和訳。prompt_en に英文、answer に日本語訳を入れる。',
  /* 誤り訂正(2026-09 利用者の指定)。**穴埋めの置き換えである。**

       > そもそもこの穴埋めはいらないかもしれない。
       > なぜなら、穴埋めは複数の回答が考えられる場合があり、すっきりしない

     誤り訂正なら、**直す1か所も、直した形も1つに決まる。**
     弱点をそのまま誤りにできるので、「弱点 → 教材」の循環にもよく合う。 */
  error_correction:
    '誤り訂正。prompt_en に**誤りを1か所だけ含む英文**、answer に**直した英文まるごと**、'
    + 'note に**何がどう間違っているのか**の説明(日本語)を入れる。'
    + '**誤りは1文に1か所だけ。** 2か所あると、どちらを直すのか決まらない。'
    + '**指定された弱点にあたる誤り**にする。関係のないところを間違えさせない。'
    + '**日本人の学習者が実際にやる間違い**にする。'
    + '(冠詞の抜け・三単現の s・時制の一致・前置詞の取り違え・可算/不可算・語順など)'
    + 'ネイティブがしない不自然な壊し方(語をでたらめに並べ替えるなど)はしない。'
    + '**直し方が1つに決まる文にする。** 直した形が何通りもある文は作らない。'
    + '**answer には、直した英文を1文まるごと**入れる。直した語だけを入れない。'
    + '(ゲストは書き換えた文全体を見て確かめる)'
    + 'note は「be動詞のあとなので過去分詞にする」のように、'
    + '**なぜそうなるのか**まで書く。「間違いです」とだけ書かない。',

  // 穴埋め。**新規では使わない**(2026-09 に誤り訂正へ差し替えた)。
  // 既存の教材を作り直せるように残してある
  fill_blank:
    '穴埋め。prompt_en に（　　　）を含む英文、hint に与える語(原形など)、answer に空欄に入る形を入れる。'
    + '落とし穴の問には note に理由を書く。'
    /* **与える語と解答を同じにしない**(2026-09 実機・利用者の指摘)。
       「与える語: tell / 解答: tell」という問が出ていた。`could you` の
       うしろは原形なので形を変える必要がなく、**解答を開くまでもなく
       答えが問題文の中に書いてある。** 空欄の位置そのものが誤っている。 */
    + '**hint と answer を同じ語にしてはいけない。**'
    + '「与える語: tell / 解答: tell」では、問題文の中に答えが書いてあるのと同じである。'
    + '**空欄は、形を変えないと入らないところにだけ作る**'
    + '(時制・三単現・過去分詞・比較級・複数形・動名詞・受け身など)。'
    + '助動詞や to のうしろのように**原形のまま入る位置には空欄を作らない。**'
    + 'また、**答えが1つに決まる空欄にする。** 複数の語が当てはまる位置には作らない。',
  translate_ja_en:
    '和文英訳。prompt_ja に日本語、answer に解答例、answer_alt に別解(改行区切り、1〜2個)を入れる。',
  listening:
    'リスニング。audio_text に読み上げる英文、question に英語の設問、answer に解答を入れる。'
    + '設問は、英文を聞かないと答えられないものにする。',

  // ── 本文(まとまった1本)────────────────────────────────
  // ここは「設問」ではなく「読み物」を作らせる。1項目 = 1段落 / 1発言。
  // 短い文を並べるのではなく、前の段落を受けて話が進むこと。
  article:
    '記事。**1項目 = 1段落**。読み物として通して読めること。'
    + '前の段落を受けて話が進み、最後の段落で締めること。'
    + '各段落は3〜5文、45〜65語。全体で250〜350語になる。'
    + 'prompt_en に段落の英文、prompt_ja にその段落の日本語訳を入れる。'
    /* **英語1文 = 日本語1文**(2026-09 実機)。
       画面は文の数で英語と訳を対にしている(ディクテーション・
       Quick Response)。数が合わないと**対を作れず、
       段落まるごとの訳が何度も並ぶ。**
       コロンや「—」のところで2文に分けたくなるが、分けない */
    + '**prompt_ja の文の数は、prompt_en の文の数と必ず同じにする。**'
    + '英語1文を日本語2文に分けない(コロンや — のところでも分けない)。'
    + '画面は文の数で英語と訳を対にしているので、数が合わないと訳が出せない。'
    + '**items に入れるのは段落そのものだけ。** 見出しの一覧・要約・登場人物の'
    + '紹介など、段落でないものを項目にしない。'
    + '1段落目で何の話か分かるようにし、事実・具体例・数字を入れて、'
    + '「人に話したくなる」中身にすること。教科書調の当たり障りのない文章にしない。',
  dialogue:
    '会話。**1項目 = 1人の1回の発言**。speaker に話す人(名前と肩書き。'
    + '例: Sarah (Product Manager))、prompt_en にその発言の英語、'
    + 'prompt_ja に日本語訳を入れる。'
    + '**items に入れるのは発言だけ。** 登場人物の一覧を項目にしない。'
    + '**prompt_en が空の項目を作らない。** 話す人の名前だけの項目は発言ではない。'
    + '**登場人物は2人**で、名前は最初から最後まで変えない。'
    + '2人が交互に話し、指定された数の発言で1本の会話になること。'
    + '1発言は1〜3文。話が始まり、進み、区切りがつくところまでを1本にする。'
    + '相づち・言いよどみ・言い換えなど、実際の会話に出るものを入れる。'
    + '場面の指定に合わせて丁寧さを変えること。噂話と交渉で同じ話し方にしない。',
  comprehension:
    '内容理解。question に英語の設問、answer に英語の解答例を入れる。'
    + 'prompt_en と prompt_ja は入れない。answer_alt に別の言い方があれば入れる。'
    + '**本文を読まないと答えられない設問**にする。一般常識で答えられるものは作らない。'
    + '最後の1問は、内容についてどう思うかを述べさせる問い(意見を言わせるもの)にする。',
  /* ディスカッション(2026-09 利用者の指定)。
     **内容理解とは別物である。** あちらは本文に答えが書いてあるが、
     こちらは**正解が無い**。だから answer を持たせない。
     代わりに note へ、話を広げる観点と使える表現を日本語で書かせる
     (レッスン中にトレーナーがそのまま使う手がかりになる)。 */
  discussion:
    'ディスカッション。question に英語の設問、note に日本語の手がかりを入れる。'
    + '**answer は入れない。正解のある問いを作らない。**'
    + '本文の内容をきっかけに、**自分の経験・意見・提案を話させる**問いにする。'
    + '「本文に何と書いてあったか」を答えさせる問い(内容理解)は作らない。'
    + 'はい / いいえ で終わる問いにしない。理由や具体例まで話したくなる問いにする。'
    + '設問はゲストのレベルで読める英語にする(本文より難しくしない)。'
    + 'note には、①話を広げる観点(日本語)と ②答えるときに使える英語表現を'
    + '2〜3個、80字以内で書く。',
  vocab_note:
    '本文に出た語句。**本文に実際に出てきた語句だけ**を選ぶ。出てこない語を作らない。'
    + 'prompt_en に語句、prompt_ja に意味、note にその語句を使った短い例文(英語)と'
    + '使いどころの注意を入れる。'
    + 'ゲストのレベルにとって新しい語、または知っていても使えていない語を選ぶ。',

  // ── 旧「長文」で使っていたもの ────────────────────────────
  read_aloud:   '音読。prompt_en に英文、prompt_ja に訳を入れる。',
  overlapping:  'オーバーラッピング。prompt_en に英文、prompt_ja に訳を入れる。',
  shadowing:    'シャドーイング。prompt_en に英文、prompt_ja に訳を入れる。',
  repeating:    'リピーティング。1文を短めにする。prompt_en に英文、prompt_ja に訳を入れる。',
  vocabulary:   '単語。prompt_en に語、prompt_ja に意味と使い方を入れる。',
  phrase:       'フレーズ。prompt_en にフレーズ、prompt_ja に意味と使う場面を入れる。',
}

/** 1問(1段落・1発言)の欄の説明 */
const ITEM_FIELDS: Record<string, { type: string; description: string }> = {
  prompt_en:  { type: 'string', description: '英語で提示するもの' },
  prompt_ja:  { type: 'string', description: '日本語で提示するもの' },
  hint:       { type: 'string', description: '与える語(穴埋め)' },
  question:   { type: 'string', description: '設問(英語)' },
  answer:     { type: 'string', description: '解答 / 解答例' },
  answer_alt: { type: 'string', description: '別解。改行区切り' },
  // 以前は「prompt_en と同じにする」と指示していた。同じ英文を2回
  // 書かせることになり、出力の課金がその分増えていた。
  // 読み上げは prompt_en から行えるので、**リスニングのときだけ**入れる。
  audio_text: { type: 'string', description: '読み上げる英文' },
  note:       { type: 'string', description: '1問ごとの補足' },
  speaker:    { type: 'string', description: '話す人(名前と肩書き。例: Sarah (Product Manager))' },
  tag_no:     { type: 'integer', description: 'その問がどの弱点か(1から始まる番号)' },
  // 発音記号(0020)。**単語・フレーズの教材だけ。**
  // 発音の練習をする教材なのに、どう読むのかが書いていなかった
  // (2026-08 利用者の指定)。作る時点で一緒に書かせれば、
  // 1教材につき1回で済む。開くたびに引くと、費用が20倍になる。
  phonetic: {
    type: 'string',
    description: 'prompt_en の発音記号(IPA)。**スラッシュは付けない。**'
      + 'アメリカ英語。語のあいだは半角スペースで区切る。'
      + '強勢の印(ˈ ˌ)を必ず入れる。例: dræft ðə ˈkɑːntrækt',
  },
  // 本文の要点フレーズ(0015)。**語をまたぐ言い回しは、語1つでは拾えない。**
  // look forward to / put off のようなものを、作る時点で拾っておく。
  // 開くたびに拾わせると、費用が毎回かかり、何が出るかも分からない。
  phrases: {
    type: 'array',
    description: 'この文の要点となる言い回し(コロケーション・イディオム・句動詞)。'
      + '**0〜2個。無ければ空の配列。** 1語で分かるものは入れない',
    items: {
      type: 'object',
      additionalProperties: false,
      required: ['text', 'note'],
      properties: {
        text: { type: 'string', description: '本文に出てくるとおりの形(英語、2〜5語)' },
        note: { type: 'string', description: '意味と使い方(日本語、40字以内)' },
      },
    },
  },
}

/**
 * 演習の種類ごとに、**必ず入れる欄**と、入れてもよい欄。
 *
 * 【なぜ種類ごとに分けるのか】(2026-08)
 *   以前は全種類で1つの形を使い、必須は `answer` だけだった。
 *   会話では `answer` は空文字でよいので、**実質どんな形でも通ってしまう。**
 *   実際、14発言を頼んだのに「話す人だけの項目が2つ」という、
 *   登場人物の一覧のようなものが返ってきた(実機で確認)。
 *   本文の英語が無いので音声も出せず、シャドーイングもできない。
 *
 *   **形は指示文ではなく、道具の形で縛る。** 指示文は読み飛ばされうるが、
 *   道具の形(strict)は API が保証する。会話なら speaker・prompt_en・
 *   prompt_ja が必ず入る。要らない欄は最初から出さないので、
 *   **余計な出力に課金されることもない。**
 */
const SECTION_FIELDS: Record<string, { required: string[]; optional: string[] }> = {
  translate_en_ja: { required: ['prompt_en', 'answer'], optional: ['note', 'tag_no', 'phrases'] },
  // 誤り訂正は **note が必須。** なぜ間違いなのかが無いと、直す意味が薄い
  error_correction: { required: ['prompt_en', 'answer', 'note'], optional: ['tag_no'] },
  // 穴埋め。新規では使わないが、既存の教材を作り直せるように残す
  fill_blank:      { required: ['prompt_en', 'hint', 'answer'], optional: ['note', 'tag_no'] },
  translate_ja_en: { required: ['prompt_ja', 'answer'], optional: ['answer_alt', 'note', 'tag_no'] },
  listening:       { required: ['audio_text', 'question', 'answer'], optional: ['note', 'tag_no'] },

  // 本文。**英語と訳が必ず要る。** これが無いと音声も出せない
  article:         { required: ['prompt_en', 'prompt_ja'], optional: ['phrases'] },
  dialogue:        { required: ['speaker', 'prompt_en', 'prompt_ja'], optional: ['phrases'] },
  comprehension:   { required: ['question', 'answer'], optional: ['answer_alt'] },
  // ディスカッションは**正解が無い**ので answer を出さない。
  // 欄そのものを出さなければ、書きようがない(`strict: true`)
  discussion:      { required: ['question', 'note'], optional: [] },
  vocab_note:      { required: ['prompt_en', 'prompt_ja', 'note'], optional: [] },

  // 発音記号は**必須**にする。発音の練習に使う教材なので、
  // 「あったり無かったり」では困る(`strict: true` が形を保証する)
  vocabulary:      { required: ['prompt_en', 'prompt_ja', 'phonetic'], optional: ['note', 'tag_no'] },
  phrase:          { required: ['prompt_en', 'prompt_ja', 'phonetic'], optional: ['note', 'tag_no'] },

  // 旧「長文」で使っていたもの。既存の教材を作り直せるように残す
  read_aloud:      { required: ['prompt_en', 'prompt_ja'], optional: [] },
  overlapping:     { required: ['prompt_en', 'prompt_ja'], optional: [] },
  shadowing:       { required: ['prompt_en', 'prompt_ja'], optional: [] },
  repeating:       { required: ['prompt_en', 'prompt_ja'], optional: [] },
}

/** 要点フレーズを拾わせる演習。**本文と英文があるものだけ。** */
const PHRASE_TYPES = new Set(['article', 'dialogue', 'translate_en_ja'])

/**
 * 生成した中身を受け取るための道具の形を、演習の種類に合わせて組み立てる。
 * `strict: true` なので、ここで決めた形どおりの JSON しか返ってこない。
 */
const emitSectionTool = (sectionType: string, isFirst: boolean) => {
  const fields = SECTION_FIELDS[sectionType] ?? { required: ['answer'], optional: [] }
  const itemProps: Record<string, unknown> = {}
  for (const name of [...fields.required, ...fields.optional]) {
    itemProps[name] = ITEM_FIELDS[name]
  }

  const isPassage = sectionType === 'article' || sectionType === 'dialogue'
  const props: Record<string, unknown> = {
    instruction: { type: 'string', description: 'この演習の指示文(日本語)' },
    items: {
      type: 'array',
      description: isPassage ? '本文(1項目 = 1段落 / 1発言)' : '設問',
      items: {
        type: 'object',
        additionalProperties: false,
        required: fields.required,
        properties: itemProps,
      },
    },
  }
  const required = ['instruction', 'items']

  if (isPassage) {
    props.headline = {
      type: 'string',
      description: '記事の見出し / 会話の題名(英語、8語以内、内容が分かるもの)',
    }
    required.push('headline')
  }
  if (isFirst) {
    props.teaching_point = {
      type: 'string',
      description:
        '教材全体にかかる指導ポイント。'
        + '**1つの注意点につき1行**にし、行と行は改行(\\n)で区切る。2〜4行。'
        + '1行は40〜70字。長い1本の文にしない(画面で読めなくなる)。'
        + '各行に、その注意点が効いている英語の例を1つ入れる'
        + '(例: 「決定する」は make a decision。do a decision とは言わない)。',
    }
    required.push('teaching_point')
  }

  return {
    name: 'emit_section',
    description: '作った演習を返す',
    strict: true,
    input_schema: {
      type: 'object',
      additionalProperties: false,
      required,
      properties: props,
    },
  }
}

// ────────────────────────────────────────────────────────────────
// カタマリごとの訳(0021)
//
// 【何を頼むのか】(2026-08 利用者の指定)
//   > スラッシュリーディングの英文の下に日本語の訳が
//   > スラッシュに分けて表示されているのが分かるはずです。
//
//       どれくらいの長さですか / 乗っているのは
//       How long              / is the ride?
//
// 【どこで切るかは、こちらでは決めない】
//   区切る場所は画面側の決まり(`src/lib/chunker.js`)が閉じた語のリストで
//   決めている。ここへ届くのは**切り終わったカタマリ**である。
//   AI がするのは訳だけ。**決まりで書けるものを AI に頼まない。**
//
// 【なぜ関数を増やさず、この窓口に足したのか】
//   1関数1ファイルにしてあるのは**配置の手順を増やさないため**である
//   (CLAUDE.md)。訳づくりは教材づくりの一部で、呼ぶのも同じトレーナーなので、
//   関数を1つ増やすより、この窓口に頼みごとを1つ足すほうが手が少ない。
// ────────────────────────────────────────────────────────────────

const CHUNK_SYSTEM = `あなたは日本のパーソナル英語スクールのトレーナーを補助する。
スラッシュリーディング(意味のカタマリごとに前から訳す練習)の
**カタマリごとの訳**を作るのが仕事である。

# 守ること

1. **カタマリの数と順番を変えない。** 渡された数と同じ数だけ、同じ順で返す。
   まとめない・分けない・入れ替えない
2. **英語の語順のまま、前から訳す。** 日本語として自然な語順に直さない。
   前から読む型を身につけるための訳である
3. **直訳寄りにする。** 意訳して情報を足したり削ったりしない
4. 1つのカタマリの訳は、**そのカタマリだけの意味**にする。
   次のカタマリの意味を先に書かない
5. **隣のカタマリと同じことを二度書かない。**
   訳はあとでつなげて出すので、重なると同じ言葉が2回並ぶ
6. カタマリは文の一部なので、**言い切らなくてよい。**
   「乗っているのは」「もし雨が降ったら」のような、途中で終わる形でよい
7. 前置詞のカタマリは「〜で」「〜に」「〜から」のように、
   **助詞で終わる形**にすると前から読める
8. **1カタマリは20字以内**を目安に短くする
9. 英語で省かれている主語を、日本語で補わない
10. **名詞と、それをうしろから説明する語句(分詞・関係詞)が
    1つのカタマリに入っているときだけ、語順を入れ替える。**
    英語は名詞のうしろから説明するが、日本語は名詞の前から説明する
    (連体修飾)。**「〜は…している」と、述語のように訳してはいけない。**
    これは 2 の例外で、ここだけは日本語の語順に直す
11. **主語だけのカタマリは、主語だけを訳す。目的語だけのカタマリは、
    目的語だけを訳す**(2026-09 利用者の指定)。
    日本語は「主語 → 目的語 → 動詞」の順なので、主語のカタマリを訳す
    ときに**動詞や目的語の意味まで書いてしまいやすい。**
    書いてしまうと、次のカタマリの訳が空になり、
    **どの英語がどの日本語に当たるのかが分からなくなる。**
    - 主語だけのカタマリ … 「〜が」「〜は」で終える
    - 目的語だけのカタマリ … 「〜を」「〜に」で終える
    - 動詞のカタマリ … 「〜した」「〜している」で終える
    **カタマリの中に無い語の意味を、そのカタマリの訳に入れない。**
    これは 4 と 5 を、主語・目的語について言い直したものである

# 例

  How long / is the ride?
  →「どれくらいの長さですか」「乗っているのは」

  I have several things / to do / before the meeting.
  →「いくつかやることがあります」「するべき」「会議の前に」

  are hard / to ignore.
  →「難しい」「無視するのが」
    ×「無視するのは難しい」「無視するのは」(5 に反する。二度書いている)

  The boy running / in the park just said hello to me.
  →「走っている男の子は」「公園でたった今私にこんにちはと言った」
    ×「男の子は走っている」(10 に反する。走っているが述語になっている)

  Phone scams targeting elderly people / are increasing.
  →「高齢者を狙う電話詐欺が」「増えている」

  A pair of shoes / and a water bottle / are enough.
  →「靴一足」「と水筒一本」「あれば十分です」
    ※ and で始まるカタマリは「と〜」「そして〜」で始める。
      前のカタマリに混ぜて「靴一足と水筒」と書かない

  The money raised / by the fund went to schools.
  →「集められたお金は」「その基金によって学校へ行った」

  A small cloud outage last week / caused big problems / for an online store.
  →「先週の小さなクラウド障害が」「大きな問題を引き起こした」「あるオンラインストアに」
    ×「小さなクラウド障害が先週大きな問題を引き起こした」「」「あるオンラインストアに」
      (11 に反する。1つめのカタマリに、2つめの動詞と目的語まで書いている)

  Some customers / asked for a refund.
  →「一部の顧客が」「返金を求めた」
    ×「一部の顧客が返金を求めた」「」(11 に反する)

  The office bought / a new coffee machine.
  →「その事務所が買った」「新しいコーヒーメーカーを」
    ※ 目的語だけのカタマリは、目的語だけを訳す

# 出力

emit_chunk_ja という道具だけを使って返すこと。文章での説明は要らない。`

/** カタマリごとの訳を受け取る道具。`strict: true` なので形は API が保証する */
const chunkJaTool = {
  name: 'emit_chunk_ja',
  description: 'カタマリごとの訳を返す',
  strict: true,
  input_schema: {
    type: 'object',
    additionalProperties: false,
    required: ['parts'],
    properties: {
      parts: {
        type: 'array',
        description: '渡された本文と同じ数、同じ順',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['no', 'ja'],
          properties: {
            no: { type: 'integer', description: '本文の番号(渡されたもの)' },
            ja: {
              type: 'array',
              description: 'カタマリごとの訳。**カタマリと同じ数、同じ順**',
              items: { type: 'string' },
            },
          },
        },
      },
    },
  },
}

/**
 * カタマリごとの訳を作る。
 *
 * **数が合わないものは返さない。** ずれた対は、無いより害が大きい
 * (画面側の `chunkPairs()` も、数が合わなければ訳を出さない)。
 */
async function makeChunkJa(apiKey: string, body: Record<string, unknown>) {
  const parts = (Array.isArray(body.parts) ? body.parts : [])
    .map((raw) => {
      const p = (raw ?? {}) as { no?: unknown; chunks?: unknown }
      return {
        no: Number(p.no ?? 0),
        chunks: (Array.isArray(p.chunks) ? p.chunks : [])
          .map((c) => String(c ?? '').trim()).filter(Boolean),
      }
    })
    // カタマリが1つしかないものは、区切る意味がないので送らない
    .filter((p) => Number.isInteger(p.no) && p.no > 0 && p.chunks.length > 1)
    // 記事6段落・会話14発言を1回で賄える。これ以上は画面側が分けて呼ぶ
    .slice(0, 30)

  if (!parts.length) return { error: '訳を作る本文がありませんでした' }

  const listing = parts
    .map((p) => `## ${p.no}(${p.chunks.length} カタマリ)\n`
      + p.chunks.map((c, i) => `${i + 1}. ${c}`).join('\n'))
    .join('\n\n')

  const client = new Anthropic({ apiKey })
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 16000,
    output_config: { effort: 'medium' },
    system: [{ type: 'text', text: CHUNK_SYSTEM }],
    tools: [chunkJaTool as unknown as Anthropic.Tool],
    tool_choice: { type: 'tool', name: 'emit_chunk_ja' },
    messages: [{
      role: 'user',
      content: `# カタマリ\n\n${listing}\n\n`
        + `**${parts.length} 件すべて**を返すこと。`
        + `各件の訳の数は、その件に並んだ番号の数とちょうど同じにすること。`
        + `**1つのカタマリの訳に、そのカタマリに無い語の意味を入れないこと。**`
        + `主語だけのカタマリは主語だけ、目的語だけのカタマリは目的語だけを訳す。`,
    }],
  })
  const response = await stream.finalMessage()

  if (response.stop_reason === 'refusal') {
    return { error: '内容が安全上の理由で断られました。' }
  }
  if (response.stop_reason === 'max_tokens') {
    return { error: '本文が長すぎて途中で切れました。段落を分けてお試しください。' }
  }

  const block = response.content.find((b) => b.type === 'tool_use')
  if (!block || block.type !== 'tool_use') {
    return { error: '訳の結果を読み取れませんでした。もう一度お試しください。' }
  }
  const result = block.input as { parts?: { no?: number; ja?: string[] }[] }

  // **数が合ったものだけを返す。** 合わないものは黙って落とさず、数を返す
  const want = new Map(parts.map((p) => [p.no, p.chunks.length]))
  const kept: { no: number; ja: string[] }[] = []
  const seen = new Set<number>()
  for (const r of result.parts ?? []) {
    const no = Number(r?.no ?? 0)
    const ja = (Array.isArray(r?.ja) ? r.ja : []).map((x) => String(x ?? '').trim())
    if (!want.has(no) || seen.has(no)) continue
    // **数が合わないものは使わない。** ずれた対は、無いより害が大きい
    if (ja.length !== want.get(no)) continue
    seen.add(no)
    kept.push({ no, ja })
  }
  // 頼んだのに返ってこなかった / 数が合わなかったものの数
  const skipped = parts.length - kept.length

  if (!kept.length) {
    return {
      error: 'カタマリの数が合う訳が1件も返りませんでした。もう一度お試しください。',
    }
  }

  return {
    ok: true,
    parts: kept,
    skipped,
    stop_reason: response.stop_reason ?? null,
    usage: {
      input: response.usage.input_tokens,
      output: response.usage.output_tokens,
      cacheRead: response.usage.cache_read_input_tokens ?? 0,
    },
  }
}

// ────────────────────────────────────────────────────────────────
// ここから受付窓口の本体
// ────────────────────────────────────────────────────────────────

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status, headers: { ...cors, 'Content-Type': 'application/json' },
  })

/** 例外を、原因の分かる日本語にする */
const explain = (e: unknown) => {
  const message = e instanceof Error ? e.message : String(e)
  if (/authentication|invalid x-api-key|401/i.test(message)) {
    return 'Claude の鍵が正しくありません。Secrets の ANTHROPIC_API_KEY を確認してください。'
  }
  if (/rate.?limit|429/i.test(message)) {
    return '短い時間に作りすぎました。少し待ってからお試しください。'
  }
  if (/credit|billing|402/i.test(message)) {
    return 'Claude の残高が不足しています。Anthropic Console でご確認ください。'
  }
  return `生成に失敗しました: ${message}`
}

/**
 * 待っている間も、少しずつ返事を送り続ける。
 *
 * 【なぜ必要か】
 *   Supabase の関数は、**150秒のあいだ何も返さないと切られる**。
 *   40問の生成はそれを超えることがあり、利用者の画面では
 *   「2分ほど待つと、何も出ずにボタンが元に戻る」状態になっていた。
 *
 *   そこで、答えが出るまでのあいだ**空白を1文字ずつ送り続ける**。
 *   通信が生きていると見なされるため、途中で切られない。
 *   空白は JSON の前に付いても読み飛ばされるので、受け取る側は
 *   これまでどおり JSON として読める。
 *
 * **教材づくりと訳づくりの両方でこれが要る。** 2か所に書き写さない。
 */
const streamed = (run: () => Promise<unknown>) => {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const beat = setInterval(() => {
        try { controller.enqueue(encoder.encode(' ')) } catch { /* すでに閉じている */ }
      }, 5000)
      try {
        controller.enqueue(encoder.encode(JSON.stringify(await run())))
      } catch (e) {
        console.error(e)
        controller.enqueue(encoder.encode(JSON.stringify({ error: explain(e) })))
      } finally {
        clearInterval(beat)
        controller.close()
      }
    },
  })
  return new Response(stream, { headers: { ...cors, 'Content-Type': 'application/json' } })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return reply({ error: 'POST で呼んでください' }, 405)

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) {
    return reply({
      error: 'Claude の鍵が設定されていません。'
        + 'Supabase の Edge Functions → Secrets に ANTHROPIC_API_KEY を登録してください。',
    }, 500)
  }

  // ── 1. 送ってきた人を確かめる ────────────────────────────
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return reply({ error: 'ログインしていません' }, 401)

  const url = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const asCaller = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user: caller } } = await asCaller.auth.getUser()
  if (!caller) return reply({ error: 'ログインの情報が確認できませんでした' }, 401)

  // 役割はサーバー側で確かめる。ブラウザから送られた値は信用しない。
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  })
  const { data: profile } = await admin
    .from('profiles').select('role, status').eq('id', caller.id).maybeSingle()

  if (!['trainer', 'owner'].includes(profile?.role ?? '') || profile?.status !== 'active') {
    return reply({ error: '教材を作る権限がありません' }, 403)
  }

  // ── 2. 送られてきた内容を確かめる ────────────────────────
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return reply({ error: '内容を読めませんでした' }, 400) }

  // **頼みごとは2つある。** 教材の下書き(既定)と、カタマリごとの訳(0021)。
  // 訳づくりは教材づくりの一部なので、関数を増やさずここで分ける
  // (関数を増やすと、利用者が Supabase の画面で配置する手順が増える)。
  if (String(body.mode ?? '') === 'chunk_ja') {
    return streamed(() => makeChunkJa(apiKey, body))
  }

  const sectionType = String(body.sectionType ?? '')
  /* **1つの演習の上限は30**(2026-09 利用者の指定)。
       > 30問までにしてください。なぜなら弱点を3つまで指定できるからです
     弱点は3つまで選べ、問はその弱点にできるだけ均等に配る。
     1つの弱点に10問ずつ当てるには30問が要る。
     **画面側(`exerciseTypes.js` の `MAX_ITEMS`)と同じ数にする。**
     片方だけ変えると、画面に出した数と実際の数が食い違う */
  const count = Math.min(Math.max(Number(body.count ?? 10), 1), 30)
  const topic = String(body.topic ?? '').trim()          // 弱点タグの名前と例
  // 混合ドリル。以前は弱点ごとに呼び分けていたため、弱点3つで
  // 4演習 × 3 = 12回の生成になっていた。**1回にまとめて費用を1/3にする。**
  // 分け方と交互の並びは、この中で指示する。
  const topics = (Array.isArray(body.topics) ? body.topics : [])
    .map((t) => String(t ?? '').trim()).filter(Boolean).slice(0, 3)
  const level = String(body.level ?? 'B1')
  const industry = String(body.industry ?? '').trim()
  const isFirst = Boolean(body.isFirst)
  // 記事のジャンル / 会話の場面 / 話題の指定。記事と会話のときだけ使う
  const genre = String(body.genre ?? '').trim()
  const scene = String(body.scene ?? '').trim()
  const subject = String(body.subject ?? '').trim()
  // 本文。内容理解と語句は、本文を読まないと作れない
  const context = String(body.context ?? '').trim().slice(0, 8000)
  // すでに使われている英文。同じ文章が二度出ると、ゲストは
  // 「前にやった」と感じて手が止まる。避けさせる。
  const avoid = Array.isArray(body.avoid) ? body.avoid.slice(0, 150).map(String) : []
  // 復習として**必ず入れる語**。これまでの宿題に出て、ゲストが
  // 「知らなかった」と付けたものなど(第5.23節)。
  // 上限を切ってあるのは、指示が長くなりすぎると本来の指定が薄まるため。
  const reviewWords = (Array.isArray(body.reviewWords) ? body.reviewWords : [])
    .map((w) => String(w ?? '').trim()).filter(Boolean).slice(0, 20)

  if (!SECTION_INSTRUCTIONS[sectionType]) {
    return reply({ error: `演習の種類が正しくありません: ${sectionType}` }, 400)
  }
  // 記事と会話は、弱点が無くても作れる(読み物として成立するため)。
  // 文型ドリルは何の練習か決まらないと作れない。
  const isPassage = sectionType === 'article' || sectionType === 'dialogue'
  // 本文を読まないと作れない演習。**ディスカッションもここに入る**
  // (本文をきっかけに話させるので、本文が無いと問いが作れない)
  const needsContext = sectionType === 'comprehension'
    || sectionType === 'discussion' || sectionType === 'vocab_note'
  if (!topic && !isPassage && !needsContext) {
    return reply({ error: '弱点(何の練習か)を指定してください' }, 400)
  }
  if (needsContext && !context) {
    return reply({ error: '本文が空です。先に記事か会話を作ってください' }, 400)
  }

  // ── 3. 生成する ──────────────────────────────────────────
  const client = new Anthropic({ apiKey })

  // 本文は「問」ではなく段落・発言なので、数え方の言い方を変える。
  // 「10問作れ」と言うと、まとまった文章ではなく設問を作りにいってしまう。
  const countLine = sectionType === 'article'
    ? `**${count} 段落ちょうど**にすること。段落を減らさないこと。`
    : sectionType === 'dialogue'
      ? `**${count} 発言ちょうど**にすること。発言を減らさないこと。`
      : `**${count} 問ちょうど**作ること。減らさないこと。`

  // 弱点が複数のときの指示。番号で返させ、画面側で並べ替える。
  const mixedLine = topics.length > 1
    ? `# 混ぜる弱点(${topics.length}つ)\n`
      + topics.map((t, i) => `${i + 1}. ${t}`).join('\n')
      + `\n\n**${count}問を、この ${topics.length} つの弱点にできるだけ均等に分ける**`
      + `(例: 10問を3つなら 4/3/3)。`
      + `**1問ずつ交互に並べる**(1番の弱点 → 2番 → 3番 → 1番 …)。`
      + `まとめて並べない。`
      + `**各問に tag_no(1〜${topics.length})を必ず入れる。**`
    : ''

  const userPrompt = [
    mixedLine,
    !mixedLine && topic ? `# 注意させたい弱点\n${topic}` : '',
    isPassage && topic
      ? '本文の中に、この弱点にあたる表現を自然に何度も入れること。'
        + 'ただし**不自然な文章にしてまで入れない**。読み物として成立することが先。'
      : '',
    ``,
    `# レベル`,
    /* **段の名前だけでは足りない**(2026-09 利用者の指摘)。
       「中級より下は難しく、上は簡単」に寄っていたので、
       システム指示の表の**その行だけを見る**ことを、依頼のたびに念を押す。
       表そのものはキャッシュに載っているので、ここは数十トークンで済む。 */
    level,
    `**「レベル(14段階)」の表で、${level} の行だけ**を見ること。`
      + `前後の段と混ぜない。1文の語数・使ってよい文法・語彙を、その行に合わせる。`
      + `作り終えたら、いちばん長い文と短い文の語数を数えて確かめること。`,
    industry ? `\n# 業界\n${industry}の場面に寄せること。` : '\n# 業界\n指定なし(どの職種にも通じる場面にする)。',
    genre ? `\n# 記事のジャンル\n${genre}` : '',
    scene ? `\n# 会話の場面\n${scene}\nこの場面らしい丁寧さ・語彙・テンポにすること。` : '',
    subject
      ? `\n# 話題(指定あり)\n${subject}\nこの話題で書くこと。`
      : (isPassage ? '\n# 話題\n指定なし。業界とジャンルに合う、具体的で面白い話題を自分で決めること。'
        + '当たり障りのない一般論にしない。' : ''),
    context ? `\n# 本文(この内容から作ること)\n${context}` : '',
    ``,
    `# 作る演習`,
    `${SECTION_INSTRUCTIONS[sectionType]}`,
    ``,
    countLine,
    // **同じ「必ず入れる語」でも、演習の種類で言い方を変える。**
    // 単語・フレーズの教材では「この語で作る」が正しいが、
    // 文型ドリルや記事では「問題文の中で使う」でなければおかしくなる。
    // 単語帳から作った教材(2026-08)は、どの種類にもなりうる
    reviewWords.length
      ? (sectionType === 'vocabulary' || sectionType === 'phrase'
        ? `\n# 必ず入れる語(復習)\n`
          + reviewWords.map((w) => `- ${w}`).join('\n')
          + `\n\nこれらは、このゲストが過去の宿題で出会った語である。`
          + `**先頭から順にこの語で作り**、足りない分だけ新しい語を足すこと。`
          + `同じ語を2回出さない。意味・使い方は、**復習として身に付く**ように書く。`
        : `\n# 必ず使う語(復習)\n`
          + reviewWords.map((w) => `- ${w}`).join('\n')
          + `\n\nこれらは、このゲストが過去の宿題で出会って`
          + `「知らなかった」と付けた語である。`
          + `**それぞれ1回以上、問題文か本文の中で使うこと。**`
          + `語形は変えてよい(複数形・過去形など)。`
          + `**不自然に詰め込まない。1つの問題に1語**が基本で、`
          + `入りきらなければ全部使わなくてよい。`)
      : '',
    avoid.length
      ? `\n# すでに使った英文(これらと同じ文は絶対に作らないこと)\n`
        + avoid.map((a) => `- ${a}`).join('\n')
        + `\n\n同じ文型でも、場面・主語・目的語・数量を変えて別の文にすること。`
      : '',
    isFirst ? '\nこれが最初の演習なので、teaching_point(教材全体の指導ポイント)も入れること。' : '',
    // 要点フレーズ。**語をまたぐ言い回しは、語1つでは拾えない。**
    // 拾えるのは本文と英文のある演習だけなので、その形のときだけ頼む
    PHRASE_TYPES.has(sectionType)
      ? `\n# phrases(各項目の要点となる言い回し)\n`
        + `その文に**コロケーション・イディオム・句動詞**があれば、`
        + `**0〜2個**だけ phrases に入れること。`
        + `\n- text は**本文に出てくるとおりの形**で書く(活用も変えない)`
        + `\n- **1語で意味が分かるものは入れない。** 2〜5語のまとまりに限る`
        + `\n- note は意味と使い方を40字以内の日本語で`
        + `\n- 見つからない文では**空の配列**にする。無理に作らない`
      : '',
  ].join('\n')

  // 生成そのもの。**待っている間も返事の一部を送り続ける**必要があるため、
  // 実際の処理はこの関数に閉じ込め、下の ReadableStream から呼ぶ。
  //
  // 【1回だけやり直す】(2026-08 利用者の指摘)
  //
  //   > 「教材が作成できません」と表示され、もう一度条件も変えずに
  //   > そのままの状態で作成し直すと次は上手くいったりします。
  //   > 安定させれないものでしょうか？
  //
  //   道具(`emit_section`)は呼ばれているのに `items` が**空の配列**で
  //   返ってくることが、まれにある(`stop_reason: tool_use`)。
  //   形は `strict: true` で保証されているが、**空の配列も「形としては正しい」**
  //   ので API は通してしまう。
  //
  //   利用者が押し直せば直るのだから、**こちらで押し直す。**
  //   費用は増えない(失敗した1回はどのみち課金されている)。
  //   2回目には「前回は空だった」と伝えて、同じことを繰り返させない。
  //   **2回で止める。** 際限なく試すと、残高切れのときに待たされ続ける
  //   (「外部の窓口を自動で呼ぶものには、止まる条件を持たせる」)。
  const runOnce = async (retryNote: string) => {
    // Anthropic 側は必ず streaming で受け取る。40問ぶんの長い応答を
    // 一括で待つと、SDK の HTTP タイムアウトに掛かる。
    const stream = client.messages.stream({
      model: MODEL,
      // **上限であって、使う量ではない。** 実際に出た分しか課金されないので、
      // 上げても費用は増えない。ここで足りないと、途中で切られた中途半端な
      // 結果が「空っぽ」として返り、原因の分からない失敗になる(下の確認を参照)。
      // 会話14発言・記事6段落は日本語訳も付くため、16000 では届かないことがある。
      max_tokens: 32000,
      // 作るものは形が決まっているので、思考は中くらいで足りる。
      // 既定(high)のままだと40問で3分を超え、Supabase 側で切られていた。
      output_config: { effort: 'medium' },
      // 指示は毎回同じなので、キャッシュを効かせて費用を抑える
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      tools: [emitSectionTool(sectionType, isFirst) as unknown as Anthropic.Tool],
      tool_choice: { type: 'tool', name: 'emit_section' },
      messages: [{ role: 'user', content: userPrompt + retryNote }],
    })
    const response = await stream.finalMessage()

    if (response.stop_reason === 'refusal') {
      return { error: '内容が安全上の理由で断られました。弱点の指定を見直してください。' }
    }
    // **途中で切られた場合は、必ずここで止める。**
    // 切られると、道具に渡す JSON が途中までしか届かない。SDK は読める
    // ところまでを返すので、items が丸ごと欠けた「空っぽの成功」になる。
    // これを見逃すと、次の演習で「本文が空です」という、
    // 何が起きたのか分からない失敗になる(2026-08 実機)。
    if (response.stop_reason === 'max_tokens') {
      return {
        error: `${sectionType} が長すぎて途中で切れました。`
          + '問数(段落数・発言数)を減らすか、もう一度お試しください。',
      }
    }

    const block = response.content.find((b) => b.type === 'tool_use')
    if (!block || block.type !== 'tool_use') {
      return { retry: true, error: '生成の結果を読み取れませんでした。もう一度お試しください。' }
    }

    const result = block.input as {
      instruction?: string
      headline?: string
      teaching_point?: string
      items?: Record<string, string>[]
    }

    // **中身が0件のまま「成功」を返さない。**
    // 呼んだ側は次の演習へ進んでしまい、失敗の場所が分からなくなる。
    if (!Array.isArray(result.items) || result.items.length === 0) {
      return {
        // `retry` が立っていると、下の `generate` がもう一度だけ試す
        retry: true,
        // **仕組みの内側の言葉を画面に出さない**(2026-08 利用者の指定)。
        // `tool_use` と書かれても、利用者にできることは何も無い。
        // 原因の切り分けに要るので、記録にだけ残す
        detail: `stop_reason: ${response.stop_reason ?? 'unknown'}`,
        error: `${sectionType} の中身が空で返ってきました。もう一度お試しください。`,
      }
    }

    return {
      ok: true,
      section: {
        exercise_type: sectionType,
        instruction: result.instruction ?? '',
        items: result.items ?? [],
      },
      headline: result.headline ?? null,
      teaching_point: result.teaching_point ?? null,
      // 何が起きたのかを追えるようにしておく。原因の切り分けに要る
      stop_reason: response.stop_reason ?? null,
      // 画面に「いくら使ったか」を出せるようにしておく
      usage: {
        input: response.usage.input_tokens,
        output: response.usage.output_tokens,
        cacheRead: response.usage.cache_read_input_tokens ?? 0,
      },
    }
  }

  /**
   * **空で返ってきたときだけ、1回だけやり直す。**
   *
   * 断られた(`refusal`)・長すぎて切れた(`max_tokens`)は、
   * 同じことをもう一度頼んでも同じ結果になる。**やり直さない。**
   */
  const generate = async () => {
    const first = await runOnce('')
    const retryable = Boolean((first as Record<string, unknown>).retry)
    if (!retryable) return first
    const again = await runOnce(
      '\n\n# 注意(やり直し)\n'
      + '前回、items が空の配列で返ってきました。**items には必ず中身を入れること。**'
      + '指定された数(段落数・発言数・問数)ぶんを、省略せずに書くこと。',
    )
    // 2回目も駄目なら、そのまま失敗として返す。**際限なく試さない**
    return again
  }

  // ── 4. 待っている間も、少しずつ返事を送り続ける(`streamed`)──
  return streamed(generate)
})
