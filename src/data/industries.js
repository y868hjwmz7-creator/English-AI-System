/**
 * 業界(分野)。教材をゲストの仕事に合わせるために使う。
 *
 * **業界は「階層」ではなく「素材の属性」である**(仕様書 第5.4.8節)。
 * データベース上は materials.industry の列1つ。増やすのも減らすのも、
 * ここに1行足す/消すだけで済み、アプリの作り直しは要らない。
 *
 * id は変えないこと(教材との紐付けに使う)。label は自由に変えてよい。
 * 指定しない場合(NULL)は「汎用」。全員に出る。
 */
export const INDUSTRIES = [
  { id: 'business',      label: 'ビジネス全般', hint: '会議、メール、電話、出張' },
  { id: 'it',            label: 'IT・技術',     hint: '開発、仕様説明、障害対応' },
  { id: 'medical',       label: '医療・介護',   hint: '患者対応、記録、多職種連携' },
  { id: 'hospitality',   label: '接客・観光',   hint: '案内、予約、トラブル対応' },
  { id: 'manufacturing', label: '製造',         hint: '工程説明、品質、安全' },
  { id: 'pharma',        label: '製薬',         hint: '治験、承認申請、品質管理、学術情報' },
]

export const industryLabel = (id) =>
  id ? (INDUSTRIES.find((i) => i.id === id)?.label ?? id) : '汎用'
