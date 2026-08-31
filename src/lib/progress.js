/**
 * トレーニングの**途中経過**を、端末に覚えておく。
 *
 * 【なぜ要るか】(2026-08 利用者の指定)
 *
 *   > 各種トレーニングをやり途中で他のページに行ってから戻ると
 *   > 途中まで区切ったスラッシュリーディングや書き途中だった
 *   > ディクテーションが消えてしまいます。
 *   > メインの画面のように情報が維持されるように変更してください。
 *
 *   画面を離れると部品が消えるので、`useState` の中身も一緒に消える。
 *   スラッシュを20か所入れたあとで別のタブを見に行くと、
 *   **やり直しになる。** 配色や文字の大きさを覚えているのと同じように、
 *   **やりかけの作業も覚えておく。**
 *
 * 【どこに置くか】
 *   localStorage(`src/lib/store.js` と同じ端末の中)。
 *   途中経過は**その人がその端末でやりかけていること**であって、
 *   スクール全体で共有するものではない。表も増やさない。
 *
 * 【鍵の形】
 *
 *     eas.prog.<教材のid>.<演習のid>.<何の途中か>
 *
 *   教材の id を頭に入れてあるので、**教材ごとにまとめて消せる**
 *   (トレーナーの「この教材の練習の記録を消す」)。
 *
 * 【単語帳には触れない】(利用者の指定)
 *
 *   > ただしこれまで単語帳に登録した単語は消えないように。
 *
 *   単語帳(`word_reviews`)は Supabase の表であって、ここには無い。
 *   したがって、ここを何度消しても単語帳は減らない。
 *   **消せるものと消せないものを、置き場所で分けてある。**
 */
import { useEffect, useRef, useState } from 'react'

const PREFIX = 'eas.prog.'

/** 途中経過の置き場所。教材ごとにまとめて消せるように id を頭に置く */
export const progressKey = (materialId, sectionId, what) =>
  `${PREFIX}${materialId ?? 'x'}.${sectionId ?? 'x'}.${what}`

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    if (raw == null) return fallback
    return JSON.parse(raw)
  } catch { return fallback }
}

function write(key, value) {
  try {
    // 空(まだ何もしていない)は残さない。消し忘れを増やさない
    const empty = value == null
      || (typeof value === 'object' && Object.keys(value).length === 0)
    if (empty) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch { /* 使えなくても、その回だけ覚えないだけ */ }
}

/**
 * `useState` と同じように使えて、**中身が端末に残る**もの。
 *
 * **鍵が変わったら読み直す。** 別の教材・別の段落に移ったとき、
 * 前のものが残っていては困る。読み直しは**レンダーの中**で行う
 * (`useEffect` にすると、1回ぶん古い値を新しい鍵で書いてしまう)。
 */
export function useProgress(key, initial) {
  const [value, setValue] = useState(() => read(key, initial))
  const loadedFor = useRef(key)
  if (loadedFor.current !== key) {
    loadedFor.current = key
    setValue(read(key, initial))
  }
  useEffect(() => {
    // 鍵と中身がそろっているときだけ書く
    if (loadedFor.current === key) write(key, value)
  }, [key, value])
  return [value, setValue]
}

/**
 * その教材の途中経過を、まとめて消す(2026-08 利用者の指定)。
 *
 *   > ただしトレーナー側の教材に関しては教材毎に記録をリセットする
 *   > 機能をつけてください。
 *
 * **消えるのは、この端末に残っている途中経過だけ。**
 * 単語帳・宿題の記録・取り組みの記録には触れない(置き場所が違う)。
 *
 * @returns {number} 消した数
 */
export function clearMaterialProgress(materialId) {
  const head = `${PREFIX}${materialId ?? 'x'}.`
  let n = 0
  try {
    const keys = []
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i)
      if (k && k.startsWith(head)) keys.push(k)
    }
    for (const k of keys) { localStorage.removeItem(k); n += 1 }
  } catch { /* 使えない端末では、そもそも残っていない */ }
  return n
}

/** その教材に、消せる途中経過が残っているか(ボタンを出すかの判断) */
export function hasMaterialProgress(materialId) {
  const head = `${PREFIX}${materialId ?? 'x'}.`
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i)
      if (k && k.startsWith(head)) return true
    }
  } catch { /* 使えない端末では無い */ }
  return false
}
