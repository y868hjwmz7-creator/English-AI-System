/**
 * 読み上げの速さ。
 *
 * 【なぜ要るか】
 *   同じ速さでは、シャドーイングに入れないゲストがいる。
 *   逆に慣れた人には遅すぎて、練習にならない。
 *   利用者の指定で **5段階**、画面に1つだけ置く(2026-08)。
 *
 * 【どう効くか】
 *   ここの値は**掛け算の倍率**である。読み上げのもとの速さ(0.9 など)に掛ける。
 *   ゲスト側の「音読 / オーバーラッピング / シャドーイング / リピーティング」は
 *   取り組み方ごとに、もとの速さが違う。倍率にしておけば、
 *   **その差を保ったまま**全体を速く・遅くできる。
 *
 * 【覚えておく】
 *   選んだ速さは端末に覚えさせる(localStorage)。
 *   毎回選び直すのでは、置く意味がない。
 */
export const SPEECH_RATES = [
  { id: '120', label: '速い',        factor: 1.2 },
  { id: '110', label: 'やや速い',    factor: 1.1 },
  { id: '100', label: '普通',        factor: 1.0 },
  { id: '90',  label: '少しゆっくり', factor: 0.9 },
  { id: '80',  label: 'ゆっくり',    factor: 0.8 },
]

export const DEFAULT_RATE_ID = '100'

const KEY = 'eas.speechRate'

/** 覚えている速さ。無ければ「普通」 */
export function loadRateId() {
  try {
    const id = window.localStorage.getItem(KEY)
    return SPEECH_RATES.some((r) => r.id === id) ? id : DEFAULT_RATE_ID
  } catch {
    // 保存が使えない設定の端末でも、読み上げ自体は使えなければならない
    return DEFAULT_RATE_ID
  }
}

export function saveRateId(id) {
  try { window.localStorage.setItem(KEY, id) } catch { /* 使えなくても困らない */ }
}

/** もとの速さに倍率を掛ける。速すぎ・遅すぎで聞き取れなくならないよう挟む */
export function rateOf(id, base = 0.9) {
  const factor = SPEECH_RATES.find((r) => r.id === id)?.factor ?? 1
  return Math.min(1.6, Math.max(0.5, base * factor))
}
