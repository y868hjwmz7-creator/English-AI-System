/**
 * レベルの区分。スクールで実際に使っている14段階。
 *
 * CEFR(ヨーロッパ言語共通参照枠)を基に、各段階の「上のほう」を
 * 「+」で表し、下端に Pre-Basic / Basic、上端に Proficiency を足したもの。
 *
 * **ゲストのレベルと教材のレベルで同じ物差しを使う。**
 * 違う物差しにすると、トレーナーが頭の中で変換することになり、
 * 「このゲストにどの教材か」の判断が鈍る。
 *
 * id は変えないこと(データベースの値と一致している必要がある)。
 * ja(日本語の補足)は自由に変えてよい。
 */
export const CEFR_LEVELS = [
  { id: 'Pre-Basic',   label: 'Pre-Basic',   ja: '基礎の前段階' },
  { id: 'Basic',       label: 'Basic',       ja: '基礎' },
  { id: 'A1',          label: 'A1',          ja: '入門' },
  { id: 'A1+',         label: 'A1+',         ja: 'A1 と A2 の間' },
  { id: 'A2',          label: 'A2',          ja: '初級' },
  { id: 'A2+',         label: 'A2+',         ja: 'A2 と B1 の間' },
  { id: 'B1',          label: 'B1',          ja: '中級' },
  { id: 'B1+',         label: 'B1+',         ja: 'B1 と B2 の間' },
  { id: 'B2',          label: 'B2',          ja: '中上級' },
  { id: 'B2+',         label: 'B2+',         ja: 'B2 と C1 の間' },
  { id: 'C1',          label: 'C1',          ja: '上級' },
  { id: 'C1+',         label: 'C1+',         ja: 'C1 と C2 の間' },
  { id: 'C2',          label: 'C2',          ja: '熟達' },
  { id: 'Proficiency', label: 'Proficiency', ja: 'C2 を超える運用力' },
]

export const cefrLabel = (id) => {
  const level = CEFR_LEVELS.find((l) => l.id === id)
  return level ? `${level.label}(${level.ja})` : '未判定'
}

/** 並び順の番号。ゲストより少し上の教材を選ぶ、といった比較に使う。 */
export const cefrIndex = (id) => CEFR_LEVELS.findIndex((l) => l.id === id)

/**
 * スコアの種類。範囲はデータベース側の制限と必ず同じにする。
 * ここを緩めても、登録はデータベースが弾く。
 */
export const SCORE_TESTS = [
  // **点数の幅は、実際の試験に合わせる**(2026-08 利用者の指定)。
  //   > VERSANTの新形式は10-90点満点 / TOEICは100-990です
  { id: 'toeic',   label: 'TOEIC',   min: 100, max: 990, step: 5 },
  { id: 'versant', label: 'VERSANT', min: 10,  max: 90,  step: 1 },
  { id: 'other',   label: 'その他',  min: 0,  max: 9999, step: 1 },
]

export const scoreTestLabel = (id) => SCORE_TESTS.find((t) => t.id === id)?.label ?? id
