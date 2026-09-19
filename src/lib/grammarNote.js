/**
 * 文法解説(SVOC と修飾要素)。
 *
 * 【何を解いているか】(2026-09 利用者の指定)
 *
 *   > 文章ごとにSVOCと修飾要素についての解説をしてくれる、
 *   > 文法解説モードが欲しい。
 *
 *   スラッシュリーディング(②)は「どこで切るか」を教えるが、
 *   **切ったかたまりが文の中で何の役をしているか**は言わない。
 *   「どれが主語で、どれが動詞で、どこからが飾りか」が見えないと、
 *   長い文になったとたんに読めなくなる。
 *
 *       The office / bought / a new coffee machine / last week.
 *          S          V            O                  M
 *
 * 【役割を2つに割ってある】(カタマリの訳・0021 とまったく同じ考え方)
 *   ・**どこで文を切るか** … 決まりで出す(`splitEnSentences`)。AI に頼まない
 *   ・**どれが S / V / O / C / M か** … 決まりでは書けない。
 *     教材を作るときに1回だけ作り、`material_items.grammar` に控える(0051)
 *
 *   **一般の動詞は、語のリストでは当てられない**(`chunker.js` に何度も
 *   書いてある。`run` は名詞にも動詞にもなる)。だから SVOC は
 *   **決まりでは出せない。** ここだけは AI に頼むしかない。
 *
 * 【数が合わなければ、出さない】
 *   `sentencePair.js` / `chunkJa.js` と同じ決まりである。
 *   **ずれた対は、無いより悪い。** 別の文の解説が出るくらいなら、
 *   何も出さないほうがよい。
 *
 * 【なぜ何にも依存しない形にしてあるか】
 *   `materials.js` は Supabase を、画面(JSX)はブラウザを引き連れていて、
 *   **素の node で一度も走らせられない**(`playMark.js` と同じ考え方)。
 *   算段だけをここに置けば `npm run test:play` で数字を見られる。
 */
import { grammarSource } from '../data/exerciseTypes.js'
import { splitEnSentences } from './sentencePair.js'

/**
 * 役の一覧。**閉じたリストにしてある。**
 *
 * ここに無い役が返ってきたら、その文の解説は**使わない**
 * (色も名前も付けられないので、画面に出しようがない)。
 * 五文型(SV / SVC / SVO / SVOO / SVOC)を説明するには、この5つで足りる。
 */
export const ROLES = {
  S: { label: '主語',   hint: '誰が・何が' },
  V: { label: '動詞',   hint: 'どうする・どうである' },
  O: { label: '目的語', hint: '何を・誰に' },
  C: { label: '補語',   hint: '主語や目的語が「何であるか」を言う' },
  M: { label: '修飾語', hint: 'いつ・どこで・どのように。**無くても文は成り立つ**' },
}

/** 役の並び順(札の色を決めるときに使う)。**画面で並べ直さない** */
export const ROLE_IDS = Object.keys(ROLES)

/**
 * 文型の一覧。**五文型そのままにしてある。**
 *
 * 日本の中学・高校で教わる呼び方なので、利用者のゲストが
 * 学校で聞いた言葉とそのまま重なる。**独自の名前を作らない。**
 */
export const PATTERNS = {
  SV:   '第1文型(S + V)',
  SVC:  '第2文型(S + V + C)',
  SVO:  '第3文型(S + V + O)',
  SVOO: '第4文型(S + V + O + O)',
  SVOC: '第5文型(S + V + O + C)',
}

/** 突き合わせ用にそろえる(空白の数だけの違いは同じものとみなす) */
const norm = (text) => String(text ?? '').replace(/\s+/g, ' ').trim()

/**
 * **空白をすべて落として**突き合わせる。
 *
 * つないだものが元の文に戻るかを見るときは、こちらを使う。
 * `last week .` と `last week.` のような**空白の入り方の違いだけ**で
 * 落とすと、中身は正しいのに解説が丸ごと出なくなる。
 *
 * 並びは保たれるので、**語が抜けた・増えた・入れ替わった**のときは
 * これでも必ず食い違う(そこは見逃さない)。
 */
const tight = (text) => String(text ?? '').replace(/\s+/g, '')

/**
 * **字と数字だけを残す。** 句読点も空白も落とす。
 *
 * 【なぜ `tight()` と2つ要るのか】(第5.211節・2026-09 実機)
 *
 *   `tight()` は空白だけを落とすので、**句読点は残る。**
 *   1文の中では、それでよい —— かたまりをつないで元の文に戻るかを
 *   見るときは、`,` や `"` が落ちていないことまで見たい。
 *
 *   ところが**文と文のあいだ**では、それが仇になった。
 *
 *       Let's see . . . there's a 7:15 departure in the morning.
 *
 *   これを文に切ると、**2つめが `"."` だけ**になる。
 *   `.` に S も V も無いので解説は作れず、
 *   「1文でも欠けたら項目ごと返さない」で**発言まるごと消えていた**
 *   (実機の写真。Mary の発言にだけ「文法を見る」が出ていなかった)。
 *
 *   **字と数字で見れば、句読点だけの「文」は最初から数に入らない。**
 *   抜けたのが本物の文なら、字が足りなくなるので必ず気づく。
 *
 * **第5.206節(ハイライトが消えた)とまったく同じ穴である。**
 * あのとき片方だけ直して、こちらを残していた。
 */
const bones = (text) => String(text ?? '').replace(/[^\p{L}\p{N}]/gu, '')

/**
 * 控えた文が、元の英文の**どこに当たるか**を、順に歩いて当てる。
 *
 * **並び順どおりに、重ならずに収まっていること**まで見る。
 * 1つでも見つからなければ `null` —— その控えは信用しない
 * (別の文の解説が出るくらいなら、何も出さないほうがよい)。
 *
 * **位置の物差しは1つ**(`bones`)。出す側(`grammarForPiece`)と
 * 確かめる側(`storedGrammar`)で別々に数えると、かならず食い違う。
 *
 * @returns {{s: object, start: number, end: number}[]|null} 字と数字で数えた位置
 */
function placeSentences(list, fullText) {
  const all = bones(fullText)
  const out = []
  let at = 0
  for (const s of list ?? []) {
    const b = bones(s?.en)
    if (!b) return null
    const i = all.indexOf(b, at)
    if (i < 0) return null
    out.push({ s, start: i, end: i + b.length })
    at = i + b.length
  }
  return out
}

/**
 * **その項目の、解説する英文。** 無ければ空文字。
 *
 * 【なぜ項目だけでは決まらないか】(2026-09 利用者の指摘)
 *
 *   > そして、文法も調べられません。
 *
 *   以前ここは `item.prompt_en` を直に見ていた。だから解説は
 *   **本文(記事・会話)にしか付かず**、文型ドリルを開いても
 *   文法はどこにも出てこなかった。
 *
 *   ところが**設問の英文がどの欄に入るかは、演習ごとに違う。**
 *   誤り訂正の `prompt_en` は**誤った文**なので、そこを解説すると
 *   間違った形を教えることになる。和文英訳の `prompt_en` は無く、
 *   英語は `answer` にしかない。
 *
 *   **その対応は `exerciseTypes.js` の `grammarFrom` 1か所に書いてある。**
 *   ここでも画面でも `type === '…'` と書かない。
 *
 * @param item 教材の項目
 * @param typeId 演習の種類(`sec.exercise_type`)
 */
export const grammarTextOf = (item, typeId) => {
  const from = grammarSource(typeId)
  return from ? String(item?.[from] ?? '').trim() : ''
}

/**
 * 教材ぜんぶから、解説できる項目を集める。
 *
 * **作る側と数える側で、同じものを見る**(CLAUDE.md
 * 「数え方を2通り持たない」)。金額の見積もりもここから数える。
 *
 * @param sections `material.sections`
 * @returns {{item: object, type: string}[]}
 */
export const grammarItems = (sections) => (sections ?? [])
  .flatMap((sec) => (sec?.items ?? [])
    .map((it) => ({ item: it, type: sec?.exercise_type })))
  .filter((x) => grammarTextOf(x.item, x.type))

/**
 * **これから作る相手だけ。**(まだ無い / 英文が変わった / 数が合わない)
 *
 * `addGrammar()` が呼ぶものと、画面が金額を見積もるものを
 * **同じ関数**にしてある。別々に数えると、出した金額と
 * 実際に呼ぶ回数が食い違う。
 */
export const grammarTodo = (sections) =>
  grammarItems(sections).filter((x) => needsGrammar(x.item, x.type))

/**
 * **その英文の、どこまでに札が付いたか。** 全部なら `true`。
 *
 * **数え方はここ1か所。** 項目まるごと(`grammarFull`)でも、
 * 割ったかけら(`FocusReader`)でも、同じ物差しで数える ——
 * 別々に数えると、片方だけ「出していない文があります」と出る。
 *
 * 句読点だけの「文」は、字も数字も持たないので**数に入らない。**
 * だから `Let's see . . .` は「全部に札が付いた」になる。
 */
export function grammarCovers(list, text) {
  const spots = placeSentences(list, text)
  if (!spots) return false
  const covered = spots.reduce((n, x) => n + (x.end - x.start), 0)
  return covered >= bones(text).length
}

/**
 * 教材の項目から、解説を作らせる一覧を組み立てる。
 *
 * **1項目(段落 / 発言 / 1問)= 1件。** 文はこちらで切って渡す。
 * 窓口に切らせると、**数が合っているかを確かめる術が無くなる。**
 *
 * @param list `grammarItems()` / `grammarTodo()` が返す組
 * @returns {{no: number, item: object, en: string, sentences: string[]}[]}
 */
export function grammarPlan(list) {
  return (list ?? [])
    .map((x, n) => {
      const en = grammarTextOf(x?.item, x?.type)
      return {
        no: n + 1,
        item: x?.item,
        en: norm(en),
        /* **字も数字も無い「文」は、はじめから送らない**(第5.211節)。
           `Let's see . . .` を切ると `"."` だけの「文」ができるが、
           そこに S も V も無い。**作れないものを頼まない** ——
           頼めば窓口はそのぶん課金し、返ってきたものは必ず落ちる */
        sentences: splitEnSentences(en).filter((t) => bones(t)),
      }
    })
    .filter((p) => p.sentences.length > 0)
}

/* ── **AI を呼ぶ前に、回数と語数と金額を画面に出す**(CLAUDE.md)────
 *
 * 解説は**裏で作る**(2026-09 利用者の指定「作る(裏で・金額を出して)」)。
 * 押していないぶん、**いくらかかったのかが見えなくなりやすい。**
 * だから始めた時点で数字を出す。
 *
 * 【どう見積もっているか】
 *   Claude Sonnet 5(入力 $2 / 出力 $10・100万トークン)、1ドル 150 円。
 *   ・1回ごとの土台(指示文 約1,400トークン)…… およそ 0.4 円
 *   ・1文ごと(入力 約30 + 出力 約120トークン)… およそ 0.2 円
 *   40 問の文型ドリルなら、1文ずつとして **およそ 8 円**である。
 *
 * **値を書き写さない。** 画面は `grammarCost()` が返したものを出すだけで、
 * 掛け算を持たない。
 * ── */

/** 窓口を1回呼ぶたびの土台(指示文)ぶん(円) */
export const GRAMMAR_CALL_YEN = 0.4
/** 1文あたり(円) */
export const GRAMMAR_SENTENCE_YEN = 0.2

/**
 * これだけ作ると、いくらかかるか。
 *
 * **0 件のときは 0 円を返す**(呼ばないので、土台もかからない)。
 * 数えられなかったのではなく、本当に 0 である
 * (CLAUDE.md「0 と `null` を取り違えない」)。
 *
 * @param list `grammarTodo()` が返す組
 * @returns {{items: number, sentences: number, words: number, yen: number}}
 */
export function grammarCost(list) {
  const plan = grammarPlan(list)
  const sentences = plan.reduce((n, p) => n + p.sentences.length, 0)
  const words = plan.reduce(
    (n, p) => n + p.en.split(/\s+/).filter(Boolean).length, 0,
  )
  const raw = plan.length
    ? GRAMMAR_CALL_YEN + GRAMMAR_SENTENCE_YEN * sentences
    : 0
  return {
    items: plan.length,
    sentences,
    words,
    // 小数1桁まで。**切り上げない** —— 実際より高く見せても嘘になる
    yen: Math.round(raw * 10) / 10,
  }
}

/**
 * 1文ぶんの解説を確かめて、そろっていれば返す。
 *
 * **落とすのは3つのときだけ。**
 *   ① 役の一覧に無いものが混じっている
 *   ② かたまりをつないでも、元の文に戻らない(語が抜けた・増えた)
 *   ③ 動詞(V)が1つも無い(文の解説になっていない)
 *
 * `note`(日本語の説明)は**必須にしない。** 無ければ札だけを出す。
 * かたまりの色分けそのものに値打ちがあるので、
 * 説明が無いことを理由に丸ごと落とすほうが害が大きい。
 */
function cleanSentence(raw) {
  const en = String(raw?.en ?? '').trim()
  if (!en) return null
  const parts = (Array.isArray(raw?.parts) ? raw.parts : [])
    .map((p) => ({ t: String(p?.t ?? '').trim(), r: String(p?.r ?? '').trim() }))
    .filter((p) => p.t)
  if (!parts.length) return null
  // ① 知らない役が混じっていたら使わない
  if (parts.some((p) => !ROLES[p.r])) return null
  // ② つないで元の文に戻らなければ使わない
  if (tight(parts.map((p) => p.t).join(' ')) !== tight(en)) return null
  // ③ 動詞が無いものは、文の解説になっていない
  if (!parts.some((p) => p.r === 'V')) return null
  const pattern = String(raw?.pattern ?? '').trim()
  return {
    en,
    // 知らない文型の名前は出さない(**あやふやなことを言わない**)
    pattern: PATTERNS[pattern] ? pattern : '',
    parts,
    note: String(raw?.note ?? '').trim(),
  }
}

/**
 * その項目の控えを読む。**英文が変わっていたら返さない。**
 *
 * あとから本文を直すと、解説と文の対が狂う。
 *
 * 【**落とすのは、その1文だけ**】(第5.211節・2026-09 実機の指摘)
 *
 *   > 文法ボタンが表示される発言や段落とされないものがあります
 *
 *   もとは「**1文でも欠けたら、その項目ごと返さない**」だった。
 *   虫食いの解説を出さないための決まりだったが、実機では
 *   **1文のせいで発言まるごと消える**ほうが、ずっと害が大きかった。
 *
 *       Let's see . . . there's a 7:15 departure in the morning. …
 *              ↑ ここが `"."` だけの「文」になり、S も V も無い
 *
 *   しかも `GrammarNote` は**1文ごとに、その英文そのものを出す。**
 *   「どの文に解説が付いているのか分からない」は起きない。
 *
 *   **代わりに、順番と場所は厳しく見る**(`placeSentences`)。
 *   控えた文が、元の英文の中に**並び順どおり・重ならずに**
 *   収まっていなければ、これまでどおり項目ごと返さない ——
 *   **別の文の解説が出るくらいなら、何も出さないほうがよい。**
 *
 * 【`splitEnSentences()` で数え直さない】
 *   略語の決まり(`ABBREVIATIONS`)を直すと文の数が変わるので、
 *   数え直すと**すでに作った解説が丸ごと出なくなる**
 *   (カタマリの訳で一度踏んだ穴。だから控えた文そのものを持っている)。
 *
 * @returns {{list: object[], full: boolean}} `full` は**全部の文に札が付いたか**
 */
function readGrammar(item, typeId) {
  const none = { list: [], full: true }
  const en = grammarTextOf(item, typeId)
  if (!en) return none
  const g = item?.grammar
  if (!g || typeof g !== 'object') return none
  if (norm(g.en) !== norm(en)) return none
  const raw = Array.isArray(g.sentences) ? g.sentences : null
  if (!raw?.length) return none

  const out = []
  for (const s of raw) {
    const c = cleanSentence(s)
    // **その1文だけ落とす。** 項目ごとは落とさない
    if (c) out.push(c)
  }
  if (!out.length) return none

  // 並び順どおりに、重ならずに収まっているか
  if (!placeSentences(out, en)) return none
  return { list: out, full: grammarCovers(out, en) }
}

/**
 * その項目の控えを取り出す。無ければ `null`。
 *
 * @returns {{en: string, pattern: string, parts: {t: string, r: string}[], note: string}[]|null}
 */
export function storedGrammar(item, typeId) {
  const { list } = readGrammar(item, typeId)
  return list.length ? list : null
}

/**
 * **全部の文に札が付いたか。**
 *
 * `false` のときは、画面が1行そえる(**黙って落とさない**・CLAUDE.md)。
 * 短い相づち(`Sure.` のような、動詞の無い返事)では起こりうる。
 */
export const grammarFull = (item, typeId) => readGrammar(item, typeId).full

/**
 * その項目の解説を、**作り直したほうがよいか。**
 *
 * **判断はここ1か所。** 画面にも `materials.js` にも書かない。
 *   ① まだ解説が無い
 *   ② 控えが使えない(英文を直した・文の数が合わない・役がおかしい)
 *
 * ③(切れ目がいまの決まりと違う)は**作らない。**
 * 文の切り方はこちらの決まりだが、控えた文そのものを持っているので、
 * 決まりを変えてもずれない。**数え直さないから、作り直しも要らない。**
 */
export function needsGrammar(item, typeId) {
  if (!grammarTextOf(item, typeId)) return false
  /* **1文でも札が付いていれば、作り直さない**(第5.211節)。
     ここを `grammarFull()` にすると、`Sure.` のような
     動詞の無い返事が1つ混じっているだけで**開くたびに課金される。**
     窓口に頼み直しても、同じものが返ってくる */
  return !storedGrammar(item, typeId)
}

/**
 * 画面から呼ぶ入口。項目と演習の種類を渡すと、解説か null が返る。
 *
 * **種類を渡し忘れると `null` が返る**(`grammarSource()` の既定が
 * `null` のため)。黙って `prompt_en` を見に行かせない —— 渡し忘れに
 * 気づかないまま、**誤り訂正の誤った文に札が付く**ほうが害が大きい。
 */
export const grammarOf = (item, typeId) => storedGrammar(item, typeId)

/* ══════════════════════════════════════════════════════════════
 * 集中モードの「見せ方」— 英語 / 訳 / 文法
 *
 * 【なぜ1つのボタンで回すのか】
 *   集中モードの下の帯は**すでに4つで埋まっている**
 *   (CLAUDE.md「5つめを足すと狭い画面であふれる」)。
 *   ボタンをもう1つ置く場所は無い。
 *
 *   `RepeatUnit`(しない / 文 / 段落 / 全文)とまったく同じ形にする ——
 *   **1つのボタンで、押すたびに次へ移る。** 多くても3回で戻る。
 *   ボタンの文言は**次に何が出るか**を言うので、押す前に分かる。
 *
 * 【無いものは飛ばす】
 *   訳の無い段落・解説の無い教材がある(0051 より前に作ったもの)。
 *   出せないものを見せると、押しても何も起きない
 *   (**効かない操作を見せない**)。だから飛ばす。
 *   どちらも無ければ、呼ぶ側がボタンごと出さない(`hasOtherView`)。
 *
 * **画面の中に `showJa ? … : …` と書かない。** 見せ方は3つになったので、
 * 真偽値で持つと必ずどこかで取りこぼす。判断はここ1か所。
 * ══════════════════════════════════════════════════════════════ */

/** 見せ方の並び。**この順で回る** */
export const VIEWS = ['en', 'ja', 'grammar']

/** ボタンに出す文言。**次に何が出るか**を言う */
export const VIEW_LABEL = {
  en:      { head: '英語', tail: 'に戻す' },
  ja:      { head: '訳',   tail: 'を見る' },
  grammar: { head: '文法', tail: 'を見る' },
}

/**
 * いまの見せ方から、次の見せ方へ。**出せないものは飛ばす。**
 *
 * @param now 'en' | 'ja' | 'grammar'
 * @param have {{ja?: boolean, grammar?: boolean}} その段落に何があるか
 */
export function nextView(now, have = {}) {
  const has = { en: true, ja: Boolean(have.ja), grammar: Boolean(have.grammar) }
  const i = Math.max(VIEWS.indexOf(now), 0)
  for (let k = 1; k <= VIEWS.length; k += 1) {
    const v = VIEWS[(i + k) % VIEWS.length]
    if (has[v]) return v
  }
  return 'en'
}

/** 英語のほかに出せるものがあるか(**無ければボタンごと出さない**) */
export const hasOtherView = (have = {}) => nextView('en', have) !== 'en'

/**
 * その「かけら」に入る文だけを取り出す。
 *
 * 集中モードは、**長い段落を入るまで割る**(`focusChunks.js`)。
 * 解説は段落まるごとに付いているので、割ったときは
 * **いま出しているかけらのぶんだけ**を出さないと、
 * 画面に無い文の解説まで並ぶ。
 *
 * 【位置は「空白でない文字の数」で当てる】
 *   `wholeAudio.js` の区切りとまったく同じ考え方である。
 *   空白の入り方が変わっても揺るがない。
 *   **当てはまらない文は落とす** —— 当てずっぽうで入れると、
 *   画面に無い文の解説が出る。
 *
 * @param sentences 段落ぶんの解説
 * @param fullText  段落まるごとの英文
 * @param at        かけらの頭が、段落の何文字目か
 * @param pieceText かけらの英文
 */
export function grammarForPiece(sentences, fullText, at, pieceText) {
  const list = Array.isArray(sentences) ? sentences : []
  if (!list.length) return []
  // 割っていないときは、そのまま全部(**余計な計算をしない**)
  if (at == null || !pieceText) return list
  /* **位置は `placeSentences()` 1か所で当てる**(第5.211節)。
     以前はここで「前の文の長さを足していく」形で数えていたが、
     **札の付かない文が1つあると、そこから先が全部ずれる。**
     探して当てれば、抜けがあってもずれない */
  const spots = placeSentences(list, fullText)
  if (!spots) return []
  const start = bones(String(fullText ?? '').slice(0, at)).length
  const end = start + bones(pieceText).length
  return spots.filter((x) => x.start >= start && x.end <= end).map((x) => x.s)
}

/**
 * その教材に、解説がどれだけ入っているか。
 *
 * **数えられなかったら `null` を返さない** —— ここは「本文の項目のうち
 * 何件に解説があるか」なので、0 は本当に 0 である。
 * 呼ぶ側が「まだ 0 件」と「本文が無い」を見分けられるよう、
 * 分母も一緒に返す。
 */
export function grammarTally(sections) {
  const list = grammarItems(sections)
  return {
    total: list.length,
    done: list.filter((x) => storedGrammar(x.item, x.type)).length,
  }
}
