/**
 * **セッションの記録を、1本にまとめる**(第5.303節・2026-09-28 利用者の指定)。
 *
 *   > ゲストとトレーナー共有のセッションの記録をまとめて一本化、
 *   > つまり日付と内容を見出しをつけてまとめて出力する機能や、
 *   > セッションの記録内の単語やフレーズを元に教材を作れたりすると最高です。
 *
 * ============================================================================
 * 【なぜ何にも依存しない形で置くか】
 *
 *   `lessonNotes.js` は Supabase を引き連れているので、**素の node で
 *   一度も走らせられない**(`playMark.js` / `mp3Join.js` / `focusChunks.js` と
 *   同じ話・CLAUDE.md)。組み立てと語の拾い方は**算段だけ**なので、
 *   ここへ出して `npm run test:play` が確かめる。
 *
 * 【0円】
 *
 *   語句は **AI に拾わせない。** 記録に書いてある英字を、決まりで拾うだけ
 *   である(**ファイルに書いてあるものは引き直さない = 0円**・CLAUDE.md)。
 *   当てられないものは**黙って捨てない** —— 拾った順にぜんぶ並べ、
 *   どれを使うかはトレーナーが選ぶ。
 *
 * 【呼び名は、ここ1か所】
 *
 *   「トレーナーの記録」「ゲストの記録」は、画面にも紙にも出る。
 *   **2か所に書くと、必ず片方だけ古くなる**(CLAUDE.md)。
 * ============================================================================
 */
import { shortDate } from './format.js'
import { normWord } from './textNorm.js'

/** 欄の呼び名。**画面も紙も、ここから読む** */
export const NOTE_TRAINER = 'トレーナーの記録'
export const NOTE_LEARNER = 'ゲストの記録'

/**
 * 記録の行を、**日付ごとの1節**に組み直す。
 *
 * ・**空の欄は入れない。** 見出しだけあって中身の無い節を作らない
 * ・**新しい日から**並べる(画面の一覧と同じ向き)
 * ・`on_date` はそのまま日付の鍵(`YYYY-MM-DD`)にそろえる
 *
 * @param {Array} rows `lesson_notes` の行(`on_date` / `body` / `learner_body`)
 * @returns {Array<{date: string, parts: Array<{who: string, text: string}>}>}
 */
export function noteSections(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map((r) => {
      const date = String(r?.on_date ?? '').slice(0, 10)
      const parts = [
        { who: NOTE_TRAINER, text: String(r?.body ?? '').trim() },
        { who: NOTE_LEARNER, text: String(r?.learner_body ?? '').trim() },
      ].filter((p) => p.text)
      return { date, parts }
    })
    .filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s.date) && s.parts.length)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
}

/**
 * 記録の中の**英字の続き**。
 *
 * 記録は日本語の中に英語が混じる。`run into trouble が出なかった` のように
 * 書かれるので、**空白でつながっている英単語は、まとめて1つの句**にする
 * (句を1語ずつに割ると、`look forward to` が拾えない・`PhraseChips` と同じ考え)。
 *
 * **行をまたがない。** 改行で切れるので、次の行の書き出しが
 * 前の行の末尾にくっつくことがない(`\s` ではなく `[ \t]` で見る)。
 */
const RUN = /[A-Za-z][A-Za-z'’‘-]*(?:[ \t]+[A-Za-z][A-Za-z'’‘-]*)*/g

/** 突き合わせ用の鍵。**曲がった引用符は、まっすぐに直してから**そろえる */
const keyOf = (text) => normWord(String(text).replace(/[’‘]/g, "'"))

/**
 * 記録の中の単語・フレーズを拾う(**AI を呼ばない = 0円**)。
 *
 * ・**出てきた順**(新しい日から)。並べ替えない
 * ・同じものは1つに。**見せるのは、書いてあったままの形**
 * ・1文字だけのもの(`a` / `I`)は捨てる —— 教材の「必ず使う語」にならない
 *
 * @param {Array} rows `lesson_notes` の行
 * @returns {Array<string>} 拾った語句
 */
export function noteWords(rows) {
  const out = []
  const seen = new Set()
  for (const sec of noteSections(rows)) {
    for (const part of sec.parts) {
      for (const run of part.text.match(RUN) ?? []) {
        const one = run.trim()
        if (one.length < 2) continue
        const key = keyOf(one)
        if (!key || seen.has(key)) continue
        seen.add(key)
        out.push(one)
      }
    }
  }
  return out
}

/**
 * 紙の題。**誰の記録かを、紙そのものに書く** ——
 * 配られた紙が誰のものか分からないと、あとで整理できない
 * (`ReviewSheet` / `MaterialBody` と同じ作法)。
 */
export const noteSheetTitle = (learnerName) => {
  const name = String(learnerName ?? '').trim()
  return name ? `セッションの記録(${name})` : 'セッションの記録'
}

/**
 * 日付の見出し。**画面にも紙にも、同じ形で出す**(書き写さない・CLAUDE.md)。
 *
 * 曜日まで出す —— レッスンは曜日で決まっているので、
 * 「9/27」だけでは、どの回か分かりにくい。
 */
const WEEK = ['日', '月', '火', '水', '木', '金', '土']
export const noteDay = (dateKey) => {
  const key = String(dateKey ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return key
  const d = new Date(`${key}T00:00:00`)
  return `${shortDate(key)}(${WEEK[d.getDay()]})`
}
