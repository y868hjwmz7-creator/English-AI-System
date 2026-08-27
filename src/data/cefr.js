/**
 * CEFR(ヨーロッパ言語共通参照枠)のレベル。
 *
 * 生徒のレベルと教材のレベルで**同じ物差し**を使う。
 * 違う物差しにすると、トレーナーが頭の中で変換することになり、
 * 「この生徒にどの教材か」の判断が鈍る。
 */
export const CEFR_LEVELS = [
  { id: 'A1', label: 'A1', ja: '入門' },
  { id: 'A2', label: 'A2', ja: '初級' },
  { id: 'B1', label: 'B1', ja: '中級' },
  { id: 'B2', label: 'B2', ja: '中上級' },
  { id: 'C1', label: 'C1', ja: '上級' },
  { id: 'C2', label: 'C2', ja: '熟達' },
]

export const cefrLabel = (id) => {
  const level = CEFR_LEVELS.find((l) => l.id === id)
  return level ? `${level.label}(${level.ja})` : '未判定'
}

/**
 * スコアの種類。範囲はデータベース側の制限と必ず同じにする。
 * ここを緩めても、登録はデータベースが弾く。
 */
export const SCORE_TESTS = [
  { id: 'toeic',   label: 'TOEIC',   min: 10, max: 990, step: 5 },
  { id: 'versant', label: 'VERSANT', min: 20, max: 80,  step: 1 },
  { id: 'other',   label: 'その他',  min: 0,  max: 9999, step: 1 },
]

export const scoreTestLabel = (id) => SCORE_TESTS.find((t) => t.id === id)?.label ?? id
