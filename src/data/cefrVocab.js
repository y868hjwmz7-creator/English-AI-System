/**
 * CEFR の段階ごとの「必要な語数」のめやす。
 *
 * 【なぜ要るか】(2026-08 の提案)
 *   XP やレベルは**意味のない数字**である。増えても何も分からない。
 *   このアプリには CEFR が14段階あるのだから、**そちらに結びつける。**
 *
 *     B1 で必要な語のうち 62% を覚えました / 次の B1+ まで あと 340 語
 *
 *   数字が「あと何をすればよいか」に変われば、意味のある目標になる。
 *
 * 【この数字の出どころ】
 *   語学教育で広く使われている**めやす**である。厳密な基準ではない。
 *   `要確認`: 利用者のスクールの基準に合わせて直してよい。
 *   直すのはこの表1か所だけ。
 */
export const CEFR_VOCAB = [
  { level: 'A1', words: 600 },
  { level: 'A1+', words: 900 },
  { level: 'A2', words: 1200 },
  { level: 'A2+', words: 1800 },
  { level: 'B1', words: 2500 },
  { level: 'B1+', words: 3250 },
  { level: 'B2', words: 4000 },
  { level: 'B2+', words: 5000 },
  { level: 'C1', words: 6000 },
  { level: 'C1+', words: 7500 },
  { level: 'C2', words: 9000 },
]

/** その段階に必要な語数。分からない段階なら null */
export const wordsFor = (level) =>
  CEFR_VOCAB.find((c) => c.level === level)?.words ?? null

/** ひとつ上の段階 */
export const nextLevel = (level) => {
  const i = CEFR_VOCAB.findIndex((c) => c.level === level)
  return i >= 0 && i + 1 < CEFR_VOCAB.length ? CEFR_VOCAB[i + 1] : null
}

/**
 * 覚えた語の数から、その段階の達成率を出す。
 *
 * **単語帳に入っているのは「知らなかった語」だけ**である。
 * もともと知っている語は入っていないので、これは
 * 「この仕組みで覚えた語」の数え上げにすぎない。**そう書いて出す。**
 */
export function cefrProgress(level, known) {
  const need = wordsFor(level)
  if (!need) return null
  const next = nextLevel(level)
  return {
    need,
    known,
    percent: Math.min(100, Math.round((known / need) * 100)),
    next: next ? { level: next.level, remain: Math.max(0, next.words - known) } : null,
  }
}
