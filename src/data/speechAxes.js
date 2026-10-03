/**
 * ============================================================================
 * **用件 × 感情 × 相手への態度 × 会話上の反応**(第5.361節・2026-10-03 利用者の指定)
 *
 *   > 感情を表す・相手に働きかける・反応するという観点でも、軸を広げられる。
 *   > ただし、これらは全部を「話す目的」という一つの欄に詰め込むより、
 *   > 次のように分けると教材の組み合わせを作りやすい。
 *   >   ・発話の目的：頼む、断る、謝る、知らせる、説得する
 *   >   ・感情・状態：怒っている、弱っている、喜んでいる、不安がある
 *   >   ・相手への態度：叱る、励ます、嫌味を言う、気遣う
 *   >   ・会話上の反応：反論する、受け流す、言い訳する、共感する
 *   >
 *   > たとえば「仕事のミスを報告する」場面でも、「焦って言い訳する」
 *   > 「落ち込んで謝る」「怒って責任を追及する」「冷静に再発防止策を
 *   > 提案する」と、感情や態度を変えるだけで会話の内容が大きく変わる。
 *
 * ── なぜ軸を分けるのか(利用者の言うとおりである)──────────────
 *
 *   1つの欄に 90 個を並べると、**1本の教材で1つしか選べない。**
 *   4つに分ければ **掛け算**になる ——
 *   いまの一覧で **5 × 36 × 28 × 21 = 105,840 通り**。
 *   場面(83分野 × 平均21場面 = 1,700通り)と掛ければ、
 *   **事実上、同じ組み合わせは二度と出ない。**
 *
 * ── 置き方は `materialAngles.js`(切り口)とまったく同じ ──────────
 *
 *   ・**閉じた一覧で持つ。** AI に「毎回ちがう気持ちで」と頼まない
 *     (頼んでも寄るものは寄る。しかも `temperature` は指定できない)
 *   ・**一度入れた値は、指示がないかぎり減らさない**(共通ルール)
 *   ・**何にも依存しない。** 素の node でそのまま見張れる
 *   ・**`materials.stance` に保存する**(0074)——
 *     保存しないと「**まだ使っていないものから引く**」ができない
 *
 * ── どこに値を置いたか(**利用者の一覧を、1つも捨てていない**)──────
 *
 *   利用者は 90 個を**4つのまとまり**で挙げ、そのあと**4つの軸**を示した。
 *   まとまりと軸は、ほぼそのまま対応する。
 *
 *     「感情を表す」27 個      → **感情・状態**
 *     「相手への働きかけ」26 個 → **相手への態度**
 *     「会話で反応する」14 個   → **会話上の反応**
 *     「意見や態度を示す」20 個 → **3つに分かれた**(下記)
 *
 *   **「意見や態度を示す」の分け方**(こちらの判断。直すのはここ1か所)
 *
 *     → 会話上の反応 … 賛成する / 反対する / 同意する / 異議を唱える /
 *                      疑問を呈する / 納得する / 納得できないと伝える(7)
 *     → 感情・状態   … 迷う / ためらう / 決意する / 覚悟を示す / 勇み立つ /
 *                      意欲を見せる / 諦める / 開き直る / 強がる(9)
 *     → 相手への態度 … 遠慮する / 気遣う / 本音を打ち明ける / 秘密を明かす(4)
 *
 *   **`謝る` と `説得する` は「発話の目的」に置いた。**
 *   利用者の一覧では「相手への働きかけ」にも入っていたが、
 *   **同じ言葉を2つの軸に出すと、どちらを選べばよいか分からなくなる。**
 *   軸として名指しされたほう(発話の目的)を採った。
 *
 *   **「発話の目的」は、利用者が挙げた5つだけ**にしてある ——
 *   ほかの3軸のような長い一覧をもらっていないので、**勝手に足さない**
 *   (CLAUDE.md「勝手に広げない」)。足すならここ1か所である。
 *
 * ── 英語を添えてある理由 ────────────────────────────────
 *
 *   「苛立つ」と「うんざりする」は、日本語だけ渡すと AI の中で混ざる。
 *   **短い英語(`en`)を1つ添えて、取り違えようのない形**にしてある
 *   (訳させるためではない。**どの気持ちかを決めるため**)。
 *
 * ── 出す画面 ──────────────────────────────────────────
 *
 *   **話し手がいる教材だけ**(会話・会議・応答問題)。
 *   読み物には話し手がいないので「怒っている」も「受け流す」も成り立たない
 *   —— **効かない操作を見せない**(CLAUDE.md)。
 *   判断は `stanceWorks()` 1か所。画面で `kind === …` と書かない。
 * ============================================================================
 */

import { isDialogueKind, isResponseKind } from './materialKinds.js'

/** 選んでいない(=おまかせ)を表す値。**画面でも窓口でもこれ1つ** */
export const STANCE_NONE = ''

/**
 * **4つの軸。** `lead` は窓口へ渡す文の頭に付く1行である。
 *
 * **`lead` に「説明させない」を書いてあるのが肝心なところ。**
 * 書かないと AI は `I'm really anxious about this.` と**気持ちを言葉で
 * 説明する** —— それでは練習にならない。**言い方に出させる。**
 */
export const SPEECH_AXES = [
  {
    id: 'purpose', label: '発話の目的', col: 'pu',
    hint: 'この会話で、何をしようとしているか',
    lead: '**話し手の用件**(この会話で何をしようとしているか)',
    values: [
      { id: 'pu_ask', label: '頼む', en: 'ask a favor' },
      { id: 'pu_refuse', label: '断る', en: 'turn something down' },
      { id: 'pu_apologize', label: '謝る', en: 'apologize' },
      { id: 'pu_inform', label: '知らせる', en: 'break the news' },
      { id: 'pu_persuade', label: '説得する', en: 'persuade' },
    ],
  },
  {
    id: 'emotion', label: '感情・状態', col: 'em',
    hint: 'どんな気持ちで話しているか',
    lead: '**話し手の気持ち**',
    values: [
      { id: 'em_angry', label: '怒る', en: 'angry' },
      { id: 'em_glad', label: '喜ぶ', en: 'delighted' },
      { id: 'em_sad', label: '悲しむ', en: 'sad' },
      { id: 'em_down', label: '落ち込む', en: 'dejected' },
      { id: 'em_weak', label: '弱っている', en: 'worn out' },
      { id: 'em_uneasy', label: '不安がる', en: 'anxious' },
      { id: 'em_worried', label: '心配する', en: 'worried about someone' },
      { id: 'em_surprised', label: '驚く', en: 'surprised' },
      { id: 'em_puzzled', label: '戸惑う', en: 'at a loss' },
      { id: 'em_confused', label: '困惑する', en: 'confused' },
      { id: 'em_rushed', label: '焦る', en: 'flustered and rushing' },
      { id: 'em_irritated', label: '苛立つ', en: 'irritated' },
      { id: 'em_frustrated', label: '悔しがる', en: 'galled' },
      { id: 'em_letdown', label: '失望する', en: 'let down' },
      { id: 'em_reassured', label: '安心する', en: 'reassured' },
      { id: 'em_relieved', label: 'ほっとする', en: 'relieved' },
      { id: 'em_moved', label: '感動する', en: 'moved' },
      { id: 'em_grateful', label: '感謝する', en: 'grateful' },
      { id: 'em_shy', label: '照れる', en: 'bashful' },
      { id: 'em_embarrassed', label: '恥ずかしがる', en: 'embarrassed' },
      { id: 'em_lonely', label: '寂しがる', en: 'lonely' },
      { id: 'em_hopeful', label: '期待する', en: 'hopeful' },
      { id: 'em_excited', label: 'わくわくする', en: 'excited' },
      { id: 'em_proud', label: '誇らしく思う', en: 'proud' },
      { id: 'em_fedup', label: 'うんざりする', en: 'fed up' },
      { id: 'em_afraid', label: '怖がる', en: 'afraid' },
      { id: 'em_doubtful', label: '疑う', en: 'suspicious' },
      { id: 'em_torn', label: '迷う', en: 'torn' },
      { id: 'em_hesitant', label: 'ためらう', en: 'hesitant' },
      { id: 'em_determined', label: '決意する', en: 'determined' },
      { id: 'em_resolved', label: '覚悟を示す', en: 'braced for it' },
      { id: 'em_firedup', label: '勇み立つ', en: 'fired up' },
      { id: 'em_eager', label: '意欲を見せる', en: 'eager' },
      { id: 'em_resigned', label: '諦める', en: 'resigned' },
      { id: 'em_defiant', label: '開き直る', en: 'unapologetic' },
      { id: 'em_bluffing', label: '強がる', en: 'putting on a brave face' },
    ],
  },
  {
    id: 'attitude', label: '相手への態度', col: 'at',
    hint: '相手に対して、どう振る舞うか',
    lead: '**相手への態度**',
    values: [
      { id: 'at_scold', label: '叱る', en: 'scold' },
      { id: 'at_caution', label: '注意する', en: 'point something out' },
      { id: 'at_chide', label: 'たしなめる', en: 'chide gently' },
      { id: 'at_encourage', label: '励ます', en: 'encourage' },
      { id: 'at_comfort', label: '慰める', en: 'comfort' },
      { id: 'at_seekcomfort', label: 'なぐさめを求める', en: 'look for reassurance' },
      { id: 'at_praise', label: '褒める', en: 'praise' },
      { id: 'at_acknowledge', label: '認める', en: 'give credit' },
      { id: 'at_celebrate', label: '祝う', en: 'celebrate' },
      { id: 'at_welcome', label: '歓迎する', en: 'welcome' },
      { id: 'at_forgive', label: '許す', en: 'let it go' },
      { id: 'at_blame', label: '責める', en: 'blame' },
      { id: 'at_condemn', label: '非難する', en: 'condemn' },
      { id: 'at_protest', label: '抗議する', en: 'protest' },
      { id: 'at_complain', label: '苦情を言う', en: 'complain' },
      { id: 'at_gripe', label: '愚痴を言う', en: 'vent' },
      { id: 'at_snide', label: '嫌味を言う', en: 'make a snide remark' },
      { id: 'at_sarcastic', label: '皮肉を言う', en: 'be sarcastic' },
      { id: 'at_tease', label: 'からかう', en: 'tease' },
      { id: 'at_joke', label: '冗談を言う', en: 'crack a joke' },
      { id: 'at_provoke', label: '挑発する', en: 'provoke' },
      { id: 'at_calm', label: 'なだめる', en: 'calm them down' },
      { id: 'at_remind', label: '念を押す', en: 'drive the point home' },
      { id: 'at_advise', label: '忠告する', en: 'warn them' },
      { id: 'at_holdback', label: '遠慮する', en: 'hold back out of politeness' },
      { id: 'at_considerate', label: '気遣う', en: 'be considerate' },
      { id: 'at_openup', label: '本音を打ち明ける', en: 'open up' },
      { id: 'at_confide', label: '秘密を明かす', en: 'confide a secret' },
    ],
  },
  {
    id: 'reaction', label: '会話上の反応', col: 're',
    hint: '相手の言ったことを、どう受けるか',
    lead: '**相手の発言の受け方**',
    values: [
      { id: 're_empathize', label: '共感する', en: 'empathize' },
      { id: 're_echo', label: '驚いて聞き返す', en: 'echo it back in surprise' },
      { id: 're_interrupt', label: '話を遮る', en: 'cut in' },
      { id: 're_shift', label: '話題を変える', en: 'change the subject' },
      { id: 're_falter', label: '言いよどむ', en: 'falter and trail off' },
      { id: 're_excuse', label: '言い訳する', en: 'make an excuse' },
      { id: 're_dodge', label: 'ごまかす', en: 'gloss over it' },
      { id: 're_clarify', label: '誤解を解く', en: 'clear up a misunderstanding' },
      { id: 're_brushoff', label: '聞き流す', en: 'let it pass' },
      { id: 're_deflect', label: '受け流す', en: 'deflect it lightly' },
      { id: 're_drawout', label: '相手の発言を促す', en: 'draw them out' },
      { id: 're_probe', label: '相手の真意を探る', en: 'probe what they really mean' },
      { id: 're_lighten', label: '場を和ませる', en: 'lighten the mood' },
      { id: 're_fill', label: '沈黙を埋める', en: 'fill the silence' },
      { id: 're_agree', label: '賛成する', en: 'agree' },
      { id: 're_oppose', label: '反対する', en: 'oppose' },
      { id: 're_concur', label: '同意する', en: 'go along with it' },
      { id: 're_object', label: '異議を唱える', en: 'object' },
      { id: 're_question', label: '疑問を呈する', en: 'raise a question' },
      { id: 're_convinced', label: '納得する', en: 'be convinced' },
      { id: 're_unconvinced', label: '納得できないと伝える', en: 'say you are not convinced' },
    ],
  },
]

/** 軸を id で引く。**画面に一覧を書き写さない** */
export const axisOf = (axisId) => SPEECH_AXES.find((a) => a.id === axisId) ?? null

/** その軸の値を引く。知らないものは `null`(当て推量で返さない) */
export const axisValueOf = (axisId, valueId) =>
  axisOf(axisId)?.values.find((v) => v.id === valueId) ?? null

/**
 * ★ **この種類の教材に、4つの軸を出すか**(判断は1か所)。
 *
 * **話し手がいる教材だけ。** 読み物には話し手がいないので
 * 「怒っている」も「受け流す」も成り立たない ——
 * 効かない操作を見せない(CLAUDE.md)。
 */
export const stanceWorks = (kind) => isDialogueKind(kind) || isResponseKind(kind)

/* ── しまい方 ──────────────────────────────────────────
     **4つを1つの文字列にして `materials.stance` に入れる**(0074)。
     列を4つ増やすより、利用者が貼る SQL が1つで済む。
     **つなぎ方・ほどき方は、この2つの関数だけ**が知っている。 */
const SEP = '|'

/** えらんだものを、しまう形にする。**空の軸は入れない** */
export const stanceText = (picked) => SPEECH_AXES
  .map((a) => String(picked?.[a.id] ?? '').trim())
  .filter(Boolean)
  .join(SEP)

/** しまってある形から、軸ごとに戻す。**知らない値は捨てる** */
export function parseStance(text) {
  const out = {}
  for (const raw of String(text ?? '').split(SEP)) {
    const id = raw.trim()
    if (!id) continue
    const axis = SPEECH_AXES.find((a) => a.values.some((v) => v.id === id))
    if (axis && !out[axis.id]) out[axis.id] = id
  }
  return out
}

/**
 * ★ **まだ使っていないものから1つ引く**(おまかせ)。
 *
 * 使い切ったら、また全部から引く(行き止まりを作らない)。
 * `rand` を外から渡せるのは、**素の node で確かめられるようにするため**
 * (`pickAngle()` とまったく同じ作法)。
 *
 * @param axisId 軸
 * @param used これまでに使った値の id(`materials.stance` をほどいたもの)
 */
export function pickStance(axisId, used = [], rand = Math.random) {
  const list = axisOf(axisId)?.values ?? []
  if (!list.length) return null
  const seen = new Set((used ?? []).filter(Boolean))
  const fresh = list.filter((v) => !seen.has(v.id))
  const pool = fresh.length ? fresh : list
  return pool[Math.min(Math.floor(rand() * pool.length), pool.length - 1)] ?? pool[0]
}

/**
 * ★ **窓口へ渡す文**(第5.361節)。
 *
 * **1つも選んでいなければ、空を返す** ——
 * 空の見出しだけを送ると、AI は「指定がある」と読んで勝手に埋める。
 *
 * **気持ちや態度を、言葉で説明させない。** ここが肝心なところで、
 * 書かないと `I'm really anxious about this.` のように**気持ちそのものを
 * 口に出す** —— それでは練習にならない。**言い方に出させる。**
 *
 * @param picked `{ purpose, emotion, attitude, reaction }`
 */
export function stanceBrief(picked) {
  const lines = []
  for (const a of SPEECH_AXES) {
    const v = axisValueOf(a.id, String(picked?.[a.id] ?? '').trim())
    if (v) lines.push(`${a.lead}: ${v.label}(${v.en})`)
  }
  if (!lines.length) return ''
  return [
    '【この会話の人物設定】',
    ...lines,
    '',
    '**気持ちや態度を、そのまま言葉で説明させない。**',
    '「I am anxious.」「I am angry.」のように言わせず、',
    '**語の選び方・文の長さ・言いよどみ・くり返し・間の取り方**に出す',
    '（焦っているなら文が短く切れ、落ち込んでいるなら語数が減り、',
    '苛立っているなら相手の言葉を遮る、というように）。',
    '**設定を1つ変えるだけで会話の中身が変わる**ところまで書き分ける。',
  ].join('\n')
}
