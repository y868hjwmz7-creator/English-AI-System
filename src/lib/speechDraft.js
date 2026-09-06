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

  const tidy = (list) => list
    .map((x) => x.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
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
 * @param opt.scene    場面の名前(`sceneLabel`)
 * @param opt.hint     場面の説明(`sceneHint`)
 * @param opt.who      `{ name, company, role, dept }`
 * @param opt.subject  利用者が自分で書いた話題(任意)
 */
export function speechBrief({ scene = '', hint = '', who = {}, subject = '' } = {}) {
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

  const own = String(subject ?? '').trim()
  if (own) lines.push(`・話す中身: ${own}`)

  return lines.join('\n')
}
