/**
 * **保存するファイルの名前を、1か所で決める**(第5.229節・2026-09 利用者の指定)。
 *
 *   > PDFや音声を保存する際に、デフォルトでファイル名の規則を
 *   > 指定しておきたい。日付_教材タイトル_レベル
 *
 * 【ご提案のままにしなかった理由】
 *   教材の題名は、もう **`YYYY-MM-DD / 主題 / 弱点 / レベル / 業種`** の形で
 *   作られている(`MaterialForm` の `autoTitle()`)。
 *   「日付_題名_レベル」にすると、**日付とレベルが2回ずつ**出る。
 *   利用者の選択は「**題名をそのまま使う**」。区切りを `_` に変えるだけ。
 *
 * 【決まり】
 *
 *     2026-09-21_会議で反対意見を言う_仮定法_B1_IT_問題.pdf
 *     └ 題名(「 / 」を「_」に)                      └ 中身  └ 拡張子
 *
 *   ・題名に日付が無い(手で付けた)ときは、**教材を作った日**を先頭に足す
 *     —— その教材にひとつしか無い日付なので、誰がいつ保存しても同じ名前になる
 *   ・中身の尾ひれは `問題` / `解答つき` / `音声`
 *     (利用者の選択。ゲストの PDF は「問題のみ」なので、名前で分かるようにする)
 *   ・PDF と音声で**題名の部分は同じ**。フォルダの中で必ず隣同士に並ぶ
 *
 * 【ここに置いた理由】
 *   `src/lib/*` の多くは Supabase を引き連れていて**手元で走らせられない**。
 *   これは**何にも依存しない**ので、`npm run test:mp3` から素の node で呼べる
 *   (CLAUDE.md「素の node で走らせられる形に切り出す」)。
 */

/** 中身の尾ひれ。**呼び名はここ1か所**(画面に書き写さない) */
export const FILE_PARTS = {
  quiz: '問題',
  full: '解答つき',
  audio: '音声',
}

/** ファイル名に使えない字。**落とさないと端末によっては保存できない** */
const BAD = /[\\/:*?"<>|\u0000-\u001f]/g

/** 題名の部分の上限。尾ひれと拡張子はこの外 */
const MAX = 80

/**
 * 「 / 」で割って `_` でつなぐ。
 * **空白なしの `/` までは割らない** —— 弱点の名前そのものに入っている
 * (`分詞(ing/ed)` など)。`parseMaterialTitle` と同じ切り方である。
 */
export function titleToName(title) {
  return String(title ?? '')
    .split(/\s+\/\s+/)
    .map((x) => x.replace(BAD, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('_')
}

/** 題名の先頭に日付があるか(`YYYY-MM-DD`) */
export function hasDate(title) {
  return /^\d{4}-\d{2}-\d{2}(\s|$)/.test(String(title ?? '').trim())
}

/**
 * その教材を保存するときの名前。
 *
 * @param material 教材(`title` と `created_at` を見る)
 * @param what     `'quiz'` / `'full'` / `'audio'`
 * @param ext      `'pdf'` / `'mp3'`
 */
export function materialFileName(material, what, ext) {
  const title = String(material?.title ?? '').trim()
  let name = titleToName(title)
  /* **日付が無い題名にだけ、作った日を足す。**
     あるのに足すと、日付が2回出る(それを避けるための決まりである) */
  if (name && !hasDate(title)) {
    const made = String(material?.created_at ?? '').slice(0, 10)
    if (/^\d{4}-\d{2}-\d{2}$/.test(made)) name = `${made}_${name}`
  }
  name = name.slice(0, MAX).replace(/_+$/, '')
  /* **0 と「読めなかった」を取り違えない**(CLAUDE.md)。
     題名が読めなかったときは、それと分かる控えの名前にする */
  const 本体 = name || '教材'
  const 尾 = FILE_PARTS[what]
  return `${本体}${尾 ? `_${尾}` : ''}.${ext}`
}
