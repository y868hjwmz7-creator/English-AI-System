/**
 * 学習カテゴリの定義。
 *
 * color は仕様書のグラフで使う色です。色覚特性のある方にも区別できるよう
 * 検証済みの並び順を使っています。色だけに頼らず、グラフには必ず
 * カテゴリ名を文字でも表示しています。
 */
export const categories = [
  { id: 'reading',   label: '音読',       color: 'var(--series-1)' },
  { id: 'vocab',     label: '単語',       color: 'var(--series-2)' },
  { id: 'grammar',   label: '文法',       color: 'var(--series-3)' },
  { id: 'listening', label: 'リスニング', color: 'var(--series-4)' },
  { id: 'speaking',  label: '会話',       color: 'var(--series-5)' },
]

export const categoryLabel = (id) => categories.find((c) => c.id === id)?.label ?? id
export const categoryColor = (id) => categories.find((c) => c.id === id)?.color ?? 'var(--series-1)'
