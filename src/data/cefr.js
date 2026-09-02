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
/*
 * `gse` … Pearson の **Global Scale of English**(10〜90)での位置。
 *
 * 【なぜこの数字を出すのか】(2026-09 利用者の指定)
 *
 *   > 各レベルの選択肢としての表記をよりシンプルで適切なものにしてください。
 *   > 例：A1 (GSE 20-30)など
 *
 *   これまでは「A1+(A1 と A2 の間)」のように、**位置しか言っていない
 *   説明**が並んでいた。長いわりに、選ぶ手がかりにならない。
 *
 *   GSE を出すと、**VERSANT のスコアからそのまま段を選べる。**
 *   VERSANT は Pearson の試験で、点数(10〜90)は GSE そのものである。
 *   このスクールは VERSANT を記録しているので、
 *   「このゲストは 45 点だから B1」と、迷わず決められる。
 *
 * 【数字の出どころ】
 *   CEFR と GSE の対応は Pearson が公表している(de Jong & Benigno, 2017)。
 *
 *     A1 = 22〜29 / A2 = 30〜42 / B1 = 43〜58 /
 *     B2 = 59〜75 / C1 = 76〜84 / C2 = 85〜90 / A1 未満 = 10〜21
 *
 *   **「+」の4つは Pearson 自身が公表している区切りと一致する**
 *   (A2+ = 36〜42 / B1+ = 51〜58 / B2+ = 67〜75)。
 *   残り(Pre-Basic / Basic、A1 / A1+、C1 / C1+、C2 / Proficiency)は
 *   公表された帯を**このスクールで半分に割ったもの**である。
 *   **公表値と、こちらで割ったものを取り違えないこと。**
 */
export const CEFR_LEVELS = [
  { id: 'Pre-Basic',   label: 'Pre-Basic',   ja: '基礎の前段階', gse: '10-15' },
  { id: 'Basic',       label: 'Basic',       ja: '基礎',         gse: '16-21' },
  { id: 'A1',          label: 'A1',          ja: '入門',         gse: '22-25' },
  { id: 'A1+',         label: 'A1+',         ja: 'A1 と A2 の間', gse: '26-29' },
  { id: 'A2',          label: 'A2',          ja: '初級',         gse: '30-35' },
  { id: 'A2+',         label: 'A2+',         ja: 'A2 と B1 の間', gse: '36-42' },
  { id: 'B1',          label: 'B1',          ja: '中級',         gse: '43-50' },
  { id: 'B1+',         label: 'B1+',         ja: 'B1 と B2 の間', gse: '51-58' },
  { id: 'B2',          label: 'B2',          ja: '中上級',       gse: '59-66' },
  { id: 'B2+',         label: 'B2+',         ja: 'B2 と C1 の間', gse: '67-75' },
  { id: 'C1',          label: 'C1',          ja: '上級',         gse: '76-80' },
  { id: 'C1+',         label: 'C1+',         ja: 'C1 と C2 の間', gse: '81-84' },
  { id: 'C2',          label: 'C2',          ja: '熟達',         gse: '85-89' },
  { id: 'Proficiency', label: 'Proficiency', ja: 'C2 を超える運用力', gse: '90' },
]

export const cefrLabel = (id) => {
  const level = CEFR_LEVELS.find((l) => l.id === id)
  return level ? `${level.label}(${level.ja})` : '未判定'
}

/**
 * **プルダウンの選択肢に出す表記**(2026-09 利用者の指定)。
 *
 *     A1 (GSE 22-25)
 *
 * `cefrLabel()` とは別にしてある。あちらは札や見出しに出るもので、
 * **選ぶときと、見るときでは要る情報が違う。**
 * 選ぶときは VERSANT のスコアと突き合わせたいので数字が要り、
 * 見るときは「中級」のような言葉のほうが早い。
 */
export const cefrOption = (id) => {
  const level = CEFR_LEVELS.find((l) => l.id === id)
  if (!level) return '未判定'
  return level.gse ? `${level.label} (GSE ${level.gse})` : level.label
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
