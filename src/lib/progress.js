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
 *
 * 【ゲストとトレーナーで分かち合う】(2026-08 利用者の指定・0025)
 *
 *   > スラッシュリーディングの区切りやディクテーションで書き込んだことや、
 *   > 取り組んだ回数なども同じ扱いとしてゲスト側に共有され保存される。
 *
 *   レッスンは一緒に進めるので、書き込んだものは**ゲストの学習そのもの**
 *   である。端末の中だけに置いていては、ゲストの画面にも、
 *   トレーナーの別の端末にも出ない。そこで `material_progress`(0025)にも
 *   置く。**端末の控えは残す**(先に出せば待たされないし、
 *   Supabase が無くても動く)。
 *
 *   **あとから書いたほうが上書きしてよい**(利用者の指定)。
 *     > レッスン中にトレーナーが書いたものが、ゲストの書きかけを
 *     > 消してよいですか → 大丈夫です。添削できるからその方が良いです。
 *
 *   だから「どちらが新しいか」を争わせない。読むときはサーバーを採り、
 *   書くときは少し待ってからそのまま上書きする。
 */
import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabase.js'

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

/* ── ここから下は、ゲストとトレーナーで分かち合うための仕組み(0025)── */

/** 鍵から「どの教材の、何の途中か」を取り出す。`eas.prog.<教材>.<以下>` */
function partsOf(key) {
  const rest = String(key ?? '').slice(PREFIX.length)
  const at = rest.indexOf('.')
  if (at < 0) return null
  const materialId = rest.slice(0, at)
  const scope = rest.slice(at + 1)
  // 教材が決まっていないもの(`x`)は、端末の中だけに置く
  if (!materialId || materialId === 'x' || !scope) return null
  return { materialId, scope }
}

/** 何ミリ秒だまってから送るか。1文字ごとに送ると通信が増えすぎる */
const PUSH_WAIT = 1200
const timers = new Map()

/** サーバーから読む。読めなければ null(端末の控えを使う) */
async function pull(learnerId, key) {
  const p = partsOf(key)
  if (!supabase || !learnerId || !p) return null
  const { data, error } = await supabase
    .from('material_progress')
    .select('data')
    .eq('learner_id', learnerId)
    .eq('material_id', p.materialId)
    .eq('scope', p.scope)
    .maybeSingle()
  // **貼る前でも動くようにする。** 表が無ければ静かに端末の控えを使う
  if (error || !data) return null
  return data.data ?? null
}

/**
 * サーバーへ送る。**少しだまってから、そのまま上書きする。**
 * 例外は外に出さない(書けなくても練習は止まらない)。
 */
function push(learnerId, key, value) {
  const p = partsOf(key)
  if (!supabase || !learnerId || !p) return
  const id = `${learnerId}|${key}`
  if (timers.has(id)) window.clearTimeout(timers.get(id))
  timers.set(id, window.setTimeout(async () => {
    timers.delete(id)
    try {
      await supabase.from('material_progress').upsert({
        learner_id: learnerId,
        material_id: p.materialId,
        scope: p.scope,
        data: value ?? {},
        updated_at: new Date().toISOString(),
      }, { onConflict: 'learner_id,material_id,scope' })
    } catch { /* 書けなくても、端末の控えは残っている */ }
  }, PUSH_WAIT))
}

/**
 * `useState` と同じように使えて、**中身が端末に残る**もの。
 *
 * **鍵が変わったら読み直す。** 別の教材・別の段落に移ったとき、
 * 前のものが残っていては困る。読み直しは**レンダーの中**で行う
 * (`useEffect` にすると、1回ぶん古い値を新しい鍵で書いてしまう)。
 *
 * `learnerId` を渡すと、**その人の記録として Supabase にも置く**(0025)。
 * ゲスト自身なら自分の id、トレーナーがゲストのカードで開いているなら
 * そのゲストの id。渡さなければ、これまでどおり端末の中だけ。
 *
 * **まず端末の控えを出す。** 通信を待ってから描くと、
 * 開いた瞬間に書きかけが消えたように見える。
 */
export function useProgress(key, initial, learnerId = null) {
  const [value, setValue] = useState(() => read(key, initial))
  const loadedFor = useRef(key)
  const pulledFor = useRef(null)
  if (loadedFor.current !== key) {
    loadedFor.current = key
    pulledFor.current = null
    setValue(read(key, initial))
  }

  // サーバーにあれば、そちらを採る(**あとから書いたほうが勝つ**)
  useEffect(() => {
    if (!learnerId) return undefined
    const id = `${learnerId}|${key}`
    if (pulledFor.current === id) return undefined
    pulledFor.current = id
    let alive = true
    pull(learnerId, key).then((remote) => {
      if (!alive || remote == null) return
      // 鍵が変わっていたら捨てる(古い教材の中身を入れない)
      if (loadedFor.current !== key) return
      write(key, remote)
      setValue(remote)
    })
    return () => { alive = false }
  }, [key, learnerId])

  useEffect(() => {
    // 鍵と中身がそろっているときだけ書く
    if (loadedFor.current !== key) return
    write(key, value)
    // **読み終わる前には送らない。** 端末の控えでサーバーを上書きしてしまう
    if (learnerId && pulledFor.current === `${learnerId}|${key}`) {
      push(learnerId, key, value)
    }
  }, [key, value, learnerId])
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
