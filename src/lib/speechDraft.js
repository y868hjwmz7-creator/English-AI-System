/**
 * **Speech練習**(2026-09 利用者の指定)。
 *
 *   > 自分でスピーチなどを考えてもらったものをそのままコピペして
 *   > 指定する音声で text to speech をして、オーバーラッピングや
 *   > シャドーイングのように練習できるモードが欲しいです。
 *   > 基本的に「記事」と同じで大丈夫なのですが、タイトルを
 *   > 「Speech練習」などにしてほしいです。
 *   > 内容は、自分で手入力が基本、業界とシチュエーションなどを選べば
 *   > それに合わせた Speech を作ってくれるのも最高です。
 *   > その際に「会社名」「自分の名前」「役職」「部署名」なども任意で
 *   > 指定すればそれに沿って Speech(モノローグ)を作成してくれる機能です
 *
 * ============================================================================
 * 【なぜここに切り出したのか】
 *
 *   `MaterialForm.jsx` の中に書くと、**素の node で一度も確かめられない**
 *   (`playMark.js` / `mp3Join.js` / `gamify.js` と同じ考え方)。
 *   このファイルは**何にも依存しない**ので、`npm run test:play` が
 *   段落の切り方も、窓口へ渡す文言も、機械的に見張れる。
 *
 * 【窓口(`generate-material`)には手を入れていない】
 *
 *   スピーチかどうかで変わるのは**書き方**だけで、
 *   出来上がりの形(段落ごとに `prompt_en` / `prompt_ja`)は
 *   記事(`article`)とまったく同じである。
 *   形は `SECTION_FIELDS` が `strict: true` で保証しているので、
 *   ここで足すのは「どう書くか」の指示だけになる。
 *
 *   その指示は、**すでにある `subject`(話題の指定)に組み立てて渡す。**
 *   窓口の中に書いても画面から渡しても、AI に届く文字列は同じである。
 *   こうすると **`generate-material` の置き直しが1回も要らない**
 *   (会議を `kind` の値1つだけで足したのと同じ考え方・0037)。
 *   `FN_REV` も進めない。
 */
import { splitEnSentences } from './sentencePair.js'

/** 1段落にまとめる語数の目安。**長すぎると1息で読めない** */
const WORDS_PER_PART = 45

/** 貼った原稿から作る段落の上限。**際限なく作らせない** */
export const MAX_PARTS = 30

/**
 * **1段落の長さの上限**(2026-09 実機・利用者の指摘)。
 *
 *   > Speech練習で音声をアメリカ女性…を選んだのに、本当に質の悪い
 *   > 男性の声になりました。ElevenLabs のものではないです。
 *
 * **読み上げの窓口(`speak`)は、1回に 2,000 文字までしか受け取らない。**
 * それを超えると 400 で断られ、画面は**端末の声**に落ちる
 * (利用者の画面には「読み上げ音声を作れませんでした。端末の声で
 * 鳴らしています」と出ていた)。端末の声は選んだ声とは何の関係もないので、
 * **女性を選んだのに男性の、しかも質の悪い声**になる。
 *
 * **AI が書く記事は1段落 300 文字ほど**なので、この上限に当たることが
 * なかった。ところが**自分で書いた原稿は、1段落が桁違いに長い**
 * (実機では1段落で 1,000 文字を超えていた)。
 *
 * だから**貼った時点で、窓口が読める長さに収める。**
 *
 * - **900 文字。** 窓口の上限(2,000)にはまだ遠く、
 *   ここを少し変えても足りなくなることがない
 * - **切るのは、長すぎる段落だけ。** ふつうの長さの段落は1文字も動かさない
 * - 切れ目は**必ず文の切れ目**。文の途中では切らない
 */
export const MAX_CHARS = 900

/**
 * **1本にまとめて読み上げられる長さの上限**(窓口の `MAX_NARRATION_CHARS`)。
 *
 * これを超えると「1本にまとめる」ができず、**段落ごとの読み上げに落ちる。**
 * 落ちても鳴るので止めはしないが、**押す前に伝える**
 * (「見えない費用は管理できない」と同じ考え方)。
 */
export const WHOLE_CHARS = 2800

/**
 * 長すぎる段落を、文の切れ目で分ける。
 * **上限に収まっていれば、1文字も動かさない。**
 */
function capped(part) {
  if (part.length <= MAX_CHARS) return [part]
  const out = []
  let buf = []
  let len = 0
  for (const sen of splitEnSentences(part)) {
    // **文1つで上限を超えるときは、その文だけで1段落にする。**
    // 文の途中では切らない(切ると読み上げも意味も壊れる)
    if (len && len + sen.length + 1 > MAX_CHARS) {
      out.push(buf.join(' ')); buf = []; len = 0
    }
    buf.push(sen)
    len += sen.length + 1
  }
  if (buf.length) out.push(buf.join(' '))
  return out.filter(Boolean)
}

/**
 * 貼った原稿を、段落に切る。
 *
 * **切り方は上から順に見て、当てはまった時点で決める**(`turnGap.js` と同じ)。
 *
 *   ① 空行があれば、そこで切る   … 書いた人が段落を決めている
 *   ② 改行があれば、そこで切る   … 1行1文で書く人がいる
 *   ③ どちらも無ければ、文で切って ~45語ずつまとめる
 *
 * **③を「切らない」にしない。** 1本の長い塊のままだと、
 * オーバーラッピングもシャドーイングも「全部を一度に」しかできず、
 * 段落ごとの Listen も、止めた場所からの再開も効かなくなる。
 *
 * @param text 貼り付けられた英文
 * @returns 段落の配列(空なら [])
 */
export function pastedParagraphs(text) {
  const src = String(text ?? '').replace(/\r\n?/g, '\n').trim()
  if (!src) return []

  /* **長すぎる段落は、ここで必ず分ける。**
     どの切り方で来たものも、最後にこれを通す ——
     1か所でも通らない道があると、そこだけ端末の声に落ちる */
  const tidy = (list) => list
    .map((x) => x.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .flatMap(capped)
    .slice(0, MAX_PARTS)

  // ① 空行(1つ以上の空っぽの行)で切る
  if (/\n[ \t]*\n/.test(src)) return tidy(src.split(/\n[ \t]*\n+/))

  // ② 改行で切る
  if (src.includes('\n')) return tidy(src.split('\n'))

  // ③ 文で切って、語数でまとめる
  const sentences = splitEnSentences(src)
  if (sentences.length <= 1) return tidy([src])

  const out = []
  let buf = []
  let words = 0
  for (const s of sentences) {
    buf.push(s)
    words += s.split(/\s+/).filter(Boolean).length
    if (words >= WORDS_PER_PART) { out.push(buf.join(' ')); buf = []; words = 0 }
  }
  // **余りは捨てない。** 直前の段落にくっつける(1文だけの段落を作らない)
  if (buf.length) {
    if (out.length) out[out.length - 1] += ` ${buf.join(' ')}`
    else out.push(buf.join(' '))
  }
  return tidy(out)
}

/**
 * 話し手の肩書きを1行にまとめる。**空の欄は出さない。**
 *
 *   山田太郎(株式会社ABC 営業部 部長)
 *   株式会社ABC             ← 名前だけ空でも成り立つ
 *
 * @param who `{ name, company, role, dept }`。どれも任意
 * @returns 1行。何も無ければ空文字
 */
export function speakerLine(who = {}) {
  const t = (v) => String(v ?? '').replace(/\s+/g, ' ').trim()
  const name = t(who.name)
  const inside = [t(who.company), t(who.dept), t(who.role)].filter(Boolean).join(' ')
  if (name && inside) return `${name}(${inside})`
  return name || inside
}

/**
 * 窓口へ渡す「話題の指定」(`subject`)を組み立てる。
 *
 * **ここが、記事とスピーチを分ける唯一の場所である。**
 * 窓口は `subject` を
 *
 *     # 話題(指定あり)
 *     {subject}
 *     この話題で書くこと。
 *
 * として指示に差し込むので、**書き方の指定もここに書ける。**
 *
 * 【必ず書くこと】
 *   ・**記事ではない**とはっきり言う(`article` の指示が効いているため)
 *   ・**1人が最後まで話しきる**(会話にさせない)
 *   ・**聞き手に向かって話す言い方**にする(読み物の文体にしない)
 *   ・**話し手の肩書きは、名乗るのではなく中身に効かせる。**
 *     毎段落で会社名を繰り返されると、練習にならない
 *
 * 【話し方の型(`style`)は、ここで足す】(2026-09 利用者の指定)
 *
 *   有名なスピーチの**原稿そのもの**は著作物なので入れられない
 *   (`src/data/speechStyles.js`)。入れられるのは**話し方**である。
 *   型を渡されたら、その特徴を書いたうえで
 *   **「実在の人物の名前と、その人の言葉をそのまま使わない」**と
 *   はっきり書く。書かないと、AI は名前を出そうとする。
 *
 * @param opt.scene    場面の名前(`sceneLabel`)
 * @param opt.hint     場面の説明(`sceneHint`)
 * @param opt.who      `{ name, company, role, dept }`
 * @param opt.subject  利用者が自分で書いた話題(任意)
 * @param opt.style    話し方の型 `{ label, hint }`(任意)
 */
export function speechBrief({
  scene = '', hint = '', who = {}, subject = '', style = null,
} = {}) {
  const lines = [
    'これは記事ではありません。**1人が聴衆の前で話すスピーチ(モノローグ)の原稿**です。',
    '・最初から最後まで、同じ1人が話します。話し手を切り替えないでください。',
    '・読み物の文体ではなく、**聞き手に語りかける話し言葉**で書いてください。',
    '・段落は、話の流れ(つかみ → 中身 → まとめ)がたどれるように並べてください。',
  ]
  const place = [scene, hint].filter(Boolean).join(' — ')
  if (place) lines.push(`・場面: ${place}`)

  const speaker = speakerLine(who)
  if (speaker) {
    lines.push(`・話し手: ${speaker}`)
    lines.push('　この肩書きに合う立場・話し方にしてください。'
      + '**毎段落で名乗らせないこと**(名乗るとしても最初の1回だけ)。')
  }

  /* **話し方の型。** 場面(どこで話すか)とは別で、掛け合わせられる。
     **人の名前は出させない** —— 学ぶのは話し方であって、
     その人の言葉をなぞることではない(著作権の問題にもなる) */
  const styleLabel = String(style?.label ?? '').trim()
  if (styleLabel) {
    const how = String(style?.hint ?? '').trim()
    lines.push(`・話し方: ${styleLabel}${how ? ` — ${how}` : ''}`)
    lines.push('　この話し方の特徴を、原稿そのものに反映させてください。'
      + '**実在の人物の名前や、その人が実際に言った言葉は使わないでください。**'
      + 'まねるのは話し方だけで、中身はこの場面に合わせて新しく書きます。')
  }

  const own = String(subject ?? '').trim()
  if (own) lines.push(`・話す中身: ${own}`)

  return lines.join('\n')
}
