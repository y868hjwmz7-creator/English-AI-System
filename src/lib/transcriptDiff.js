/**
 * お手本の英文と、実際に話した内容を**単語ごとに**突き合わせる。
 *
 * 点数を1つ出すのではなく、**どの語が言えて、どの語が抜けたか**を返す。
 * 「78点」と言われても次に何を直せばよいか分からないが、
 * 「to が抜けている」と見えれば直せる。
 *
 * ★これは発音の良し悪しを測るものではない。
 *   音声認識が聞き取れたかどうかを見ているだけである。
 *   ただし「聞き取ってもらえない発音」は実用上通じない発音なので、
 *   練習の手がかりとしては十分に働く。この前提は画面にも書く。
 */

/** 突き合わせ用に、記号を落として小文字にする */
const norm = (word) => String(word ?? '').toLowerCase().replace(/[^a-z0-9']/g, '')

/** 英文を単語に分ける(記号は語にくっつけたまま残す。表示に使うため) */
const words = (text) => String(text ?? '').trim().split(/\s+/).filter(Boolean)

/**
 * よくある聞き取りのゆれ。これを別の語として赤くすると、
 * 言えているのに直しようのない指摘ばかりになる。
 */
const SAME = [
  ['okay', 'ok'], ['gonna', 'goingto'], ['wanna', 'wantto'],
  ['cannot', 'cant'], ['its', "it's"], ['im', "i'm"],
]
const samePair = (a, b) => SAME.some(([x, y]) =>
  (a === x && b === y) || (a === y && b === x))

const equal = (a, b) => {
  const x = norm(a)
  const y = norm(b)
  if (!x || !y) return false
  return x === y || samePair(x, y)
}

/**
 * 2つの語の並びを突き合わせる(最長共通部分列)。
 *
 * @returns {Array<{word: string, state: 'ok'|'missed'|'extra'}>}
 *   ok     … 言えていた
 *   missed … お手本にあるのに聞き取れなかった(抜けた・違う音になった)
 *   extra  … お手本に無いものが聞こえた(言い足した・別の語になった)
 */
export function compareTranscript(target, spoken) {
  const a = words(target)
  const b = words(spoken)

  // 最長共通部分列の表を作る
  const table = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0))
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      table[i][j] = equal(a[i], b[j])
        ? table[i + 1][j + 1] + 1
        : Math.max(table[i + 1][j], table[i][j + 1])
    }
  }

  const out = []
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    if (equal(a[i], b[j])) { out.push({ word: a[i], state: 'ok' }); i += 1; j += 1 }
    else if (table[i + 1][j] >= table[i][j + 1]) { out.push({ word: a[i], state: 'missed' }); i += 1 }
    else { out.push({ word: b[j], state: 'extra' }); j += 1 }
  }
  while (i < a.length) { out.push({ word: a[i], state: 'missed' }); i += 1 }
  while (j < b.length) { out.push({ word: b[j], state: 'extra' }); j += 1 }
  return out
}

/**
 * 言えた割合。
 * お手本の語のうち、いくつ聞き取ってもらえたか。
 * **発音の点数ではない。** 目安として出すだけで、主役は上の色分けである。
 */
export function spokenRatio(diff) {
  const target = diff.filter((d) => d.state !== 'extra')
  if (!target.length) return 0
  return target.filter((d) => d.state === 'ok').length / target.length
}
